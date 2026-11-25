// The Reviewer for the design team (design-team C4, design section 8). Last in the team. Its registry name is Reviewer; its folder
// here is team-reviewer/. The old Reviewer in ../reviewer/agent.js is not edited: an old test keeps that folder to two files and fixes
// its imports, and its agent.js is copied to docs/engine/ for the page. This agent calls the old Reviewer for its four checks, then adds:
//   - checks read from src/knowledge/reviewer/checks.json (a door that opens into furniture, a light with no switch, a room with no
//     window light),
//   - a report of stale items (an earlier change that was not re-checked),
//   - a report of items kept as is (a suggestion the user skipped),
//   - a report of Locked items that need the user's look.
// It reads everything and changes only its own report item. It returns one proposal: the new report for the Reviewer-owned clash item.
// Every report line carries a Rule-based tag. With no findings the report says "No clashes found, using these checks:" and lists them.
// A fixed, rule-based step: no AI, no randomness, no clock.
import { loadKnowledge } from '../../knowledge/load.js';
import { createReviewerAgent } from '../reviewer/agent.js';
import { loadRegistry } from '../registry.js';
import { findStale } from '../../ripple.js';
import { sourceTag } from '../../label.js';
import { conflictPairs, loadStyleKnowledge } from '../team-style/agent.js';
import {
  roomsOf, roomTypeOf, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, openingSide, alongWall, swingSquareOf, overlaps,
} from '../common.js';
import { buildProposal } from '../../proposal.js';

export const REVIEWER = 'Reviewer';
export const NO_CLASHES_PREFIX = 'No clashes found, using these checks:';

export function loadReviewerKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    checks: loadKnowledge('reviewer/checks.json').rules,
    severities: loadKnowledge('reviewer/severities.json').rules,
    openings: loadKnowledge('doors-windows/door-sizes.json').rules,
  };
}

const OLD_TYPE_TO_CHECK = Object.freeze({
  'Door or window on furniture': 'check-door-on-furniture',
  'Room override against Locked item': 'check-style-against-locked',
  'Overall style against Locked item': 'check-style-against-locked',
  'Furniture overlaps furniture': 'check-furniture-overlap',
  'Object outside its room': 'check-outside-room',
});

const fill = (sentence, parts) => sentence.replace(/\{(\w+)\}/g, (_, key) => parts[key]);

// options.registry: the loaded registry (default: read registry.json, Node only).
// options.styleKnowledge, options.knowledge: for tests. options.reviewerOptions: passed to the old Reviewer (the sample label option).
export function makeTeamReviewerAgent(options = {}) {
  const k = options.knowledge || loadReviewerKnowledge();
  const registry = options.registry || loadRegistry();
  const conflicts = conflictPairs(options.styleKnowledge || loadStyleKnowledge());
  const tolerance = ruleById(k.openings, 'doors-on-wall-tolerance').then.tolerance;
  const check = (id) => ruleById(k.checks, id);
  const severityOk = (s) => k.severities.some((r) => r.when.severity === s);
  for (const c of k.checks) if (!severityOk(c.then.severity)) throw new Error(`Check "${c.id}" has the severity "${c.then.severity}", which is not in severities.json.`);

  function agent(view, context) {
    const mode = context && context.mode;
    const reportItem = view.items.find((i) => i.kind === 'clash' && i.owner === REVIEWER);
    if (!reportItem) throw new Error('The Reviewer needs a clash report item to save its report in. None was found.');
    if (!editable(reportItem) || !inScope(reportItem, context)) return [];

    // The four checks of the first Reviewer, run as they are.
    // They compare against room sizes, so they get the size Walls decided (the first Reviewer only knew the size the user entered).
    const decided = { ...view, floors: view.floors.map((f) => ({ ...f, rooms: f.rooms.map((r) => { const z = sizeOf(r, wallItemOf(view, r.id)); return z ? { ...r, width: z.width, depth: z.depth } : r; }) })) };
    const first = createReviewerAgent({ ...(options.reviewerOptions || {}), styleConflicts: conflicts, reportItemId: reportItem.id })(decided)[0].newValue;
    const lines = first.clashes.map((c) => ({ ...c, checkId: OLD_TYPE_TO_CHECK[c.type], tag: sourceTag('rule') }));

    const rooms = roomsOf(view);
    const nameOfRoom = (id) => (rooms.find((r) => r.id === id) || { name: id }).name;
    const nameOf = (id) => {
      const it = view.items.find((i) => i.id === id);
      return it && it.value && it.value.name ? it.value.name : id;
    };
    const add = (checkId, items, roomId, parts) => {
      const c = check(checkId).then;
      lines.push({ type: c.type, items, room: roomId, description: fill(c.sentence, { room: roomId ? nameOfRoom(roomId) : '', ...parts }), severity: c.severity, checkId, tag: sourceTag('rule') });
    };

    // ---- checks from the knowledge file
    const windowCheck = check('check-no-window-light');
    for (const room of rooms) {
      const size = sizeOf(room, wallItemOf(view, room.id));
      const items = view.items.filter((i) => i.room === room.id);
      const openings = items.filter((i) => (i.kind === 'door' || i.kind === 'window') && i.value && i.value.position && !i.value.placeholder);
      const furniture = items.filter((i) => i.kind === 'layout' && i.value && i.value.position);
      if (size) {
        for (const d of openings.filter((o) => o.kind === 'door' && o.value.swing !== 'out')) {
          const side = openingSide(d.value.position, size, tolerance);
          if (!side) continue;
          const square = swingSquareOf(side, alongWall(d.value.position, size, side), size);
          for (const f of furniture) if (overlaps(square, f.value.position)) add('check-door-swing-furniture', [d.id, f.id], room.id, { a: d.value.name || 'door', b: f.value.name || 'furniture' });
        }
      }
      const light = items.find((i) => i.kind === 'light');
      const elec = items.find((i) => i.kind === 'electrical');
      if (light && elec && Array.isArray(light.value.fixtures) && light.value.fixtures.length > 0 && Array.isArray(elec.value.switches) && elec.value.switches.length === 0) {
        add('check-light-without-switch', [light.id, elec.id], room.id, {});
      }
      const type = roomTypeOf(room.name, k.rooms);
      if (windowCheck.when.roomTypes.includes(type)
        && !items.some((i) => i.kind === 'window' && i.value && i.value.position && !i.value.placeholder)
        && items.some((i) => i.kind === 'wall' && i.value && Array.isArray(i.value.segments) && i.value.segments.length > 0)) {
        add('check-no-window-light', [], room.id, {});
      }
    }

    // ---- the reports: stale, kept as is, Locked items that need a look
    const { stale } = findStale(view, registry);
    const reportedStale = stale.filter((s) => !s.locked && s.owner !== REVIEWER);
    for (const s of reportedStale) add('report-stale', [s.itemId], (view.items.find((i) => i.id === s.itemId) || {}).room, { a: nameOf(s.itemId) });
    const kept = [...new Set(view.runLog.filter((e) => e.event === 'kept-as-is').map((e) => e.item))];
    for (const id of kept) add('report-kept-as-is', [id], (view.items.find((i) => i.id === id) || {}).room, { a: nameOf(id) });
    const needsLook = [...new Set([...stale.filter((s) => s.locked).map((s) => s.itemId), ...view.runLog.filter((e) => e.event === 'needs-look').map((e) => e.item)])];
    for (const id of needsLook) add('report-needs-look', [id], (view.items.find((i) => i.id === id) || {}).room, { a: nameOf(id) });

    const numbered = lines.map((l, index) => ({ number: index + 1, ...l }));
    const checksUsed = k.checks.filter((c) => !c.when.report || c.when.report !== 'summary').map((c) => c.then.name);
    const labels = first.labels; // the first Reviewer adds the sample label (when asked) and the draft statement
    const summary = numbered.length === 0
      ? `${NO_CLASHES_PREFIX} ${checksUsed.join(', ')}.`
      : `${numbered.length} ${numbered.length === 1 ? 'finding' : 'findings'} found, using these checks: ${checksUsed.join(', ')}.`;
    const newValue = { summary, clashes: numbered, checks: checksUsed, tag: sourceTag('rule'), labels };
    if (sameValue(newValue, reportItem.value)) return [];
    return [buildProposal({
      id: proposalId('reviewer', reportItem.id, 'report-summary', mode), agent: REVIEWER, itemId: reportItem.id,
      why: numbered.length === 0 ? 'The Reviewer found no clashes with these checks.' : `The Reviewer's report has ${numbered.length} ${numbered.length === 1 ? 'line' : 'lines'}.`,
      source: 'rule', ruleId: 'report-summary', confidence: 'high', options: [{ id: 'save-report', label: 'Save the Reviewer\'s report', newValue }],
    }, { items: view.items })];
  }

  // A custom answer for the report must keep a summary and a list of lines.
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object' || typeof value.summary !== 'string' || !Array.isArray(value.clashes)) return 'A custom report needs a summary and a list called "clashes".';
    return true;
  };
  return agent;
}
