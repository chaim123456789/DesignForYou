// The Style agent for the design team (design-team C3, design section 10.1). Seventh in the team. Its registry name is Style; its folder here is team-style/.
// The old Style agent in ../style/agent.js stays as it is for the existing sample. This file is the new path. It is kept out of that folder
// because that agent.js is copied to docs/engine/ for the page (the page has no knowledge files beside it yet), and an old test says the old folder holds only agent.js and agent.json.
//
// A style item is a NOTE. It points at another item (its `target`, for example a floor) and carries a tag, a family, a palette and
// a sentence. It has no geometry, and the item it points at is never touched: the floor stays with Floors and ceilings.
// A fixed, rule-based step: no AI, no randomness, no clock. Taste is judged by rules here. The AI gate (Group D) may help later.
//
// What it does for each Unsure style note it owns:
//   - finds the style families the note could follow: its own tag, the surface of the floor it points at, the words of the room's
//     inspiration (its override when it has one, otherwise the overall set);
//   - one family: one option. Two families: two options (low confidence), because the choice is a matter of taste;
//   - lists every conflict pair between the chosen tag and the other tags in the room (for example warm oak against cold steel);
//   - keeps the old rule: the room's effective inspiration is added to the note's detail.
// It reads everything earlier (read only) and changes only style notes. A Locked note is never proposed for a change.
import { loadKnowledge } from '../../knowledge/load.js';
import { getEffectiveInspiration } from '../../brain/inspiration.js';
import { editable, inScope, sameValue, proposalId, ruleById } from '../common.js';
import { buildProposal } from '../../proposal.js';

export const STYLE = 'Style';
const MARKER = ' (kept in line with: ';

export function loadStyleKnowledge() {
  return {
    families: loadKnowledge('style/style-families.json').rules,
    palettes: loadKnowledge('style/palettes.json').rules,
    conflicts: loadKnowledge('style/conflict-pairs.json').rules,
  };
}

// The conflict pairs as [a, b] lists, for the Reviewer too.
export const conflictPairs = (k) => k.conflicts.map((r) => r.when.pair);

// Every pair (from the knowledge file) found between `tag` and the other tags. Returns [{ pair, ruleId, severity, with }].
export function conflictsFor(tag, others, k) {
  if (!tag) return [];
  const found = [];
  for (const rule of k.conflicts) {
    const [a, b] = rule.when.pair;
    for (const other of others) {
      if ((a === tag && b === other) || (b === tag && a === other)) found.push({ pair: [a, b], ruleId: rule.id, severity: rule.then.severity, with: other });
    }
  }
  return found;
}

// options.gate: the AI gate (src/ai/gate.js). When two options are close, the agent asks it for a taste judgement (task judge-taste).
// Cap zero, a refusal or a failure: the agent keeps its rule-based result and adds "AI was not used: ..." to the proposal.
// Without a gate nothing is asked and nothing is said. The agent never calls a model itself.
export function makeTeamStyleAgent(knowledge = loadStyleKnowledge(), options = {}) {
  const k = knowledge;
  const gate = options.gate;
  const familyOfTag = (tag) => (tag ? k.families.find((f) => f.then.tags.includes(tag)) : undefined);
  const familyOfSurface = (surface) => (surface ? k.families.find((f) => f.then.materials.includes(surface)) : undefined);
  const familyOfWords = (refs) => {
    const text = refs.map((r) => String(r).toLowerCase());
    const score = (f) => f.then.words.filter((w) => text.some((t) => t.includes(w))).length;
    const best = k.families.map((f) => ({ f, n: score(f) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || k.families.indexOf(a.f) - k.families.indexOf(b.f));
    return best.length > 0 ? best[0].f : undefined;
  };
  const paletteOf = (family) => ruleById(k.palettes, `palette-${family.id.replace('family-', '')}`).then.colours;

  function agent(view, context) {
    const mode = context && context.mode;
    const seen = view.items; // Style reads everything above it, read only
    const mine = seen.filter((i) => i.kind === 'style' && i.owner === STYLE && i.status === 'Unsure' && editable(i) && inScope(i, context));
    const proposals = [];

    for (const item of mine) {
      const target = item.value && item.value.target ? seen.find((i) => i.id === item.value.target) : undefined;
      const refs = item.room ? getEffectiveInspiration(view, item.room) : [...(view.inspiration || [])];
      const roomTags = [
        ...refs.filter((r) => familyOfTag(r)),
        ...seen.filter((i) => i.kind === 'style' && i.room === item.room && i.id !== item.id && i.value && i.value.tag).map((i) => i.value.tag),
      ];
      const own = familyOfTag(item.value.tag);
      const surface = target && target.kind === 'floor' && target.value ? familyOfSurface(target.value.surface) : undefined;
      const words = familyOfWords(refs);
      const candidates = [own, surface, words].filter((f, i, all) => f && all.indexOf(f) === i).slice(0, 2);
      const base = String(item.value.detail || '').split(MARKER)[0];
      const detail = refs.length > 0 ? `${base}${MARKER}${refs.join(', ')})` : base;

      const optionFor = (family, label) => {
        const tag = family && own === family ? item.value.tag : family ? family.then.tag : item.value.tag;
        const conflicts = conflictsFor(tag, roomTags.filter((t) => t !== tag), k);
        const value = {
          ...item.value, state: 'decided', tag, detail, conflicts,
          ...(family ? { family: family.when.family, palette: paletteOf(family), rule: family.id } : {}),
        };
        return { id: family ? family.id : 'keep-note', label, newValue: value, conflicts };
      };

      let options;
      let ruleId;
      let why;
      const name = (item.value && item.value.name) || item.id;
      if (candidates.length === 0) {
        // No family to follow: only the old rule, the room's inspiration added to the detail.
        if (detail === String(item.value.detail || '')) continue;
        options = [optionFor(undefined, `Keep the note, add the room's inspiration`)];
        ruleId = 'style-inspiration-detail'; // the old Style rule, kept
        why = `${name}: no style family matched, so only the room's inspiration was added to the note.`;
      } else if (candidates.length === 1) {
        options = [optionFor(candidates[0], `Follow ${candidates[0].when.family} (${candidates[0].then.tag})`)];
        ruleId = candidates[0].id;
        why = `${name} follows the ${candidates[0].when.family} family.`;
      } else {
        options = candidates.map((f, i) => optionFor(f, `${i === 0 && own === f ? 'Keep' : 'Follow'} ${f.when.family} (${own === f ? item.value.tag : f.then.tag})`));
        ruleId = candidates[0].id;
        const sources = [own ? 'its own tag' : null, surface ? 'the floor' : null, words ? 'the room\'s inspiration' : null].filter(Boolean);
        why = `${name}: ${sources.join(', ')} point to two families (${candidates.map((f) => f.when.family).join(' and ')}). That is a matter of taste.`;
      }
      // Two close options are a matter of taste: ask the gate. Anything but a good answer leaves the rule-based result as it is.
      let ai;
      let aiNote;
      if (gate && options.length === 2) {
        const asked = gate.ask('judge-taste', { options: options.map((o) => ({ id: o.id, tag: o.newValue.tag })) });
        const at = asked.ok ? options.findIndex((o) => o.id === asked.answer.choice) : -1;
        if (asked.ok && at >= 0) {
          if (at > 0) options.reverse();
          ai = { task: asked.task, costUsd: asked.costUsd, label: asked.label };
        } else {
          aiNote = `AI was not used: ${asked.ok ? 'the answer did not pick one of the two options.' : asked.reason}`.slice(0, 200);
        }
      }
      const clash = options[0].conflicts.length > 0 ? ` ${options[0].conflicts[0].pair.join(' against ')} is a conflict pair.` : '';
      const clean = options.map(({ conflicts, ...o }) => o);
      if (clean.some((o) => sameValue(o.newValue, item.value))) continue;
      const fields = {
        id: proposalId('style', item.id, ruleId, mode), agent: STYLE, itemId: item.id, why: `${why}${clash}`.slice(0, 200), source: 'rule', ruleId,
        confidence: clean.length === 2 ? 'low' : 'high', options: clean,
      };
      if (ai) {
        const said = `${ai.label}. AI judged taste and put "${clean[0].label}" first. Cost $${ai.costUsd}.`;
        Object.assign(fields, { source: 'ai', ruleId: ai.task, ai, why: said.slice(0, 200) });
      } else if (aiNote) {
        fields.aiNote = aiNote;
      }
      proposals.push(buildProposal(fields, { items: seen }));
    }
    return proposals;
  }

  // A custom answer is still a note: a tag from the families, and no geometry.
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object') return 'A custom answer must be an object.';
    if (value.position !== undefined) return 'A style note carries no geometry. Do not give a position.';
    if (value.tag !== undefined && value.tag !== null && !k.families.some((f) => f.then.tags.includes(value.tag))) return `The tag "${value.tag}" is not in the style families.`;
    return true;
  };
  return agent;
}
