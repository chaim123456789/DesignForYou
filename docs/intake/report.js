// "What the design team did with your input": a pure function from the visitor's inputs and the
// finished run to three plain lists, the list of opposite pairs, and the fixed sentence.
// No page code, no network. Every line says only what really happened. It never claims
// that anything was understood, analysed or designed, and never claims AI.
import { STYLE_CONFLICTS } from './limits.js';
import { buildProfile } from './taste.js';
import { describeTeamRun, taggedLine, SCRIPTED_WORDS } from '../engine/label.js';

// The one fixed sentence (R10.1). The start screen and the result screen must use this exact text.
export const FIXED_SENTENCE = 'The design team is a set of fixed rules, not AI. It does not look at your images or read your brief.';

// The two fixed sentences about placed objects. Tests and the page use these exact words.
// R4.7: the overlap and fit checks look only at the rectangles the visitor entered.
export const RECTANGLES_SENTENCE = 'The overlap and fit checks use only the rectangles you entered.';
// R8.3: what Layout and Builder did not do. Shown whenever objects were placed.
export const DID_NOT_SENTENCE = 'Layout and Builder did not choose where anything goes. They did not move, resize or turn anything, and they did not fix any clash. They checked each Unsure object and marked it.';

export const REPORT_HEADING = 'What the design team did with your input';
export const LIST_HEADINGS = Object.freeze({
  used: 'Used',
  keptNotRead: 'Kept but not read',
  nothingToDo: 'Nothing to do this time',
});
// A fourth list, shown only when objects were placed. Kept apart from LIST_HEADINGS (the three
// lists every report has).
export const DID_NOT_HEADING = 'What Layout and Builder did not do';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "warm oak and cold steel"
export const describePair = (pair) => `${pair[0]} and ${pair[1]}`;

function countNotes(state) {
  const overrideNotes = Object.values(state.overrides).reduce((sum, layer) => sum + layer.notes.length, 0);
  return state.overall.notes.length + overrideNotes;
}

function countImages(state) {
  return state.overall.images.length + Object.values(state.overrides).reduce((sum, layer) => sum + layer.images.length, 0);
}

const LAYOUT_NOTE = 'Placement checked by Layout';
const BUILDER_NOTE = 'Opening checked by Builder';
const PLACED_KINDS = ['layout', 'door', 'window'];

// "3 pieces of furniture, 1 door and 2 windows" (only the kinds that were placed).
function describePlacedCounts(placed) {
  const count = (kind) => placed.filter((o) => o.kind === kind).length;
  const parts = [];
  const furniture = count('layout');
  if (furniture > 0) parts.push(`${furniture} ${furniture === 1 ? 'piece' : 'pieces'} of furniture`);
  if (count('door') > 0) parts.push(plural(count('door'), 'door', 'doors'));
  if (count('window') > 0) parts.push(plural(count('window'), 'window', 'windows'));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// The lines about placed furniture, doors and windows. Every number comes from the visitor's objects
// or from the finished run's Brain, so the lines say only what really happened.
function placedLines(placed, project) {
  const used = [];
  const items = project.items.filter((i) => PLACED_KINDS.includes(i.kind));
  const unsure = placed.filter((o) => o.status === 'Unsure');
  const noted = items.filter((i) => i.status === 'Unsure' && i.value && (i.value.note === LAYOUT_NOTE || i.value.note === BUILDER_NOTE));
  let first = `You placed ${describePlacedCounts(placed)}. `;
  if (unsure.length === 0) {
    first += 'None of them was Unsure, so Layout and Builder had nothing to check or mark.';
  } else if (noted.length === unsure.length) {
    first += 'Layout checked each Unsure piece of furniture and Builder checked each Unsure door and window, and each wrote a note on it.';
  } else {
    first += `Layout and Builder wrote a note on ${noted.length} of the ${plural(unsure.length, 'Unsure object', 'Unsure objects')}.`;
  }
  used.push(first);
  if (placed.some((o) => o.status === 'Locked')) {
    const changed = items.some((i) => i.status === 'Locked' && i.value && i.value.note);
    used.push(changed
      ? 'A Locked object was changed by an agent. This should never happen. See the run log.'
      : 'Locked objects were respected: no agent changed them.');
  }
  const reviewerRan = project.runLog.some((e) => e.agent === 'Reviewer' && e.event === 'finished');
  if (reviewerRan) {
    used.push('The Reviewer checked doors and windows against furniture, furniture against furniture, and each object against the size of its room.');
    // Rooms that hold placed objects but have no size in the Brain are skipped by the fit check.
    const roomsWithObjects = new Set(items.map((i) => i.room));
    const skipped = project.floors.flatMap((f) => f.rooms)
      .filter((room) => roomsWithObjects.has(room.id) && !(room.width > 0 && room.depth > 0))
      .map((room) => room.name);
    if (skipped.length === 1) used.push(`${skipped[0]} has no size, so the fit check was skipped there.`);
    else if (skipped.length > 1) used.push(`These rooms have no size, so the fit check was skipped there: ${skipped.join(', ')}.`);
    used.push(RECTANGLES_SENTENCE);
  }
  return used;
}

// state : the visitor's inputs (see state.js).
// run   : the result of runDesignTeam (build-brain.js). Only a finished, successful run has a report.
// options.pairs : the opposite pairs the Reviewer was given (default: the fixed list in limits.js).
// Returns null if the run did not finish. Never changes its inputs.
export function buildReport(state, run, options = {}) {
  if (!run || run.ok !== true || !run.project) return null;
  const project = run.project;
  const pairs = (options.pairs || STYLE_CONFLICTS).map((pair) => [...pair]);
  const tags = buildProfile(state.tasteAnswers, state.removedTags).tags;
  const noteCount = countNotes(state);
  const hasUnsure = state.items.some((item) => item.status === 'Unsure');

  const used = [];
  if (noteCount + tags.length === 0) {
    used.push('You added no notes or style profile tags, so nothing was added to the description of your items.');
  } else if (hasUnsure) {
    used.push('Your notes and style profile tags were added to the description of each Unsure item.');
  } else {
    used.push('You had no Unsure items, so your notes and style profile tags were not added to any item. They were only used for the clash check.');
  }
  if (state.items.length > 0) {
    used.push(`Your ${plural(state.items.length, 'item', 'items')} and their Locked or Unsure status were respected. Locked items were not changed.`);
  } else {
    used.push('You added no items, so there was nothing to respect.');
  }
  const reviewerRan = project.runLog.some((e) => e.agent === 'Reviewer' && e.event === 'finished');
  if (reviewerRan) {
    used.push(`The clash check compared your notes and style profile tags with the tag of each Locked item, using this short list of opposite pairs: ${pairs.map(describePair).join('; ')}.`);
  }
  const placed = state.placed || [];
  if (placed.length > 0) used.push(...placedLines(placed, project));
  const refused = project.runLog.filter((e) => e.event === 'refused');
  if (refused.length > 0) {
    used.push(`${plural(refused.length, 'change to a Locked item was', 'changes to Locked items were')} refused. See the run log.`);
  }

  const keptNotRead = [];
  if (typeof project.brief === 'string' && project.brief.trim() !== '') {
    keptNotRead.push('Your brief. It is kept with your project and was not read.');
  }
  const imageCount = typeof project.imageCount === 'number' ? project.imageCount : countImages(state);
  if (imageCount > 0) {
    keptNotRead.push(`Your ${plural(imageCount, 'image', 'images')}. They stay in this page, are never uploaded, and were not looked at.`);
  }
  if (keptNotRead.length === 0) keptNotRead.push('You added no brief and no images.');

  const nothingToDo = [];
  const placeable = project.items.some((i) => i.kind === 'layout' || i.kind === 'door' || i.kind === 'window');
  if (!placeable) {
    nothingToDo.push('Layout and Builder had nothing to place, because no furniture, doors or windows were entered.');
  }
  if (refused.length === 0) nothingToDo.push('No Locked item needed protecting this time.');
  if (nothingToDo.length === 0) nothingToDo.push('Nothing was left idle.');

  const clashItem = project.items.find((i) => i.kind === 'clash');
  const clashReport = clashItem ? clashItem.value : null;
  const clashLine = clashReport && Array.isArray(clashReport.clashes) && clashReport.clashes.length === 0
    ? 'The Reviewer found nothing in this small list. This does not mean there are no problems.'
    : null;

  const lists = [
    { key: 'used', heading: LIST_HEADINGS.used, lines: used },
    { key: 'keptNotRead', heading: LIST_HEADINGS.keptNotRead, lines: keptNotRead },
    { key: 'nothingToDo', heading: LIST_HEADINGS.nothingToDo, lines: nothingToDo },
  ];
  // Shown whenever objects were placed, and only then (R8.3).
  if (placed.length > 0) lists.push({ key: 'didNot', heading: DID_NOT_HEADING, lines: [DID_NOT_SENTENCE] });

  return {
    heading: REPORT_HEADING,
    sentence: FIXED_SENTENCE,
    lists,
    used,
    keptNotRead,
    nothingToDo,
    pairs,
    pairsText: pairs.map(describePair),
    clashLine,
  };
}

// ---- The report for a run of the eight-agent design team (design-team D3) ----------------------------
// Every line starts with its tag, "Rule-based:" or "AI:". The fixed sentence above stays true while AI is off, so it stays;
// the team sentence (R8.2) is added next to it. "Understood" and "noticed" are never used: nothing here is an AI reading.
// run: { ok, project }. The numbers come only from the project's run log, so the lines say only what really happened.
export function buildTeamReport(state, run) {
  if (!run || run.ok !== true || !run.project) return null;
  const project = run.project;
  const nameOf = (id) => {
    const item = project.items.find((i) => i.id === id);
    return item && item.value && typeof item.value.name === 'string' ? item.value.name : 'an item';
  };
  const team = describeTeamRun(project, nameOf);
  if (!team) return null;

  const agents = [];
  for (const row of team.rows) if (!agents.includes(row.agent)) agents.push(row.agent);
  const count = (agent, event, source) => team.rows.filter((r) => r.agent === agent && r.event === event && (source === undefined || r.source === source)).length;
  const used = [];
  const nothingToDo = [];
  for (const agent of agents) {
    const rule = count(agent, 'proposed', 'rule');
    const ai = count(agent, 'proposed', 'ai');
    const skipped = count(agent, 'started') === 0 ? count(agent, 'skipped') : 0;
    if (skipped > 0) { nothingToDo.push(taggedLine('rule', `${agent} was switched off, so it did nothing.`)); continue; }
    if (rule + ai === 0) { nothingToDo.push(taggedLine('rule', `${agent} had nothing to propose this time.`)); continue; }
    const answered = team.rows.filter((r) => r.agent === agent && r.event === 'answered' && r.details.includes('accepted') && !r.details.includes('refused'));
    const kept = count(agent, 'kept-as-is');
    if (rule > 0) used.push(taggedLine('rule', `${agent} made ${plural(rule, 'proposal', 'proposals')} from fixed rules and knowledge files. ${plural(answered.length, 'change was', 'changes were')} applied and ${plural(kept, 'suggestion was', 'suggestions were')} kept as it is.`));
    if (ai > 0) used.push(taggedLine('ai', `${agent} made ${plural(ai, 'proposal', 'proposals')} with AI help for taste: ${team.rows.filter((r) => r.agent === agent && r.event === 'proposed' && r.source === 'ai').map((r) => r.details).join('; ')}.`));
  }
  const notes = team.rows.filter((r) => r.event === 'note' && /^AI was not used/.test(r.details.replace(/^item: [^.]*\. /, '')));
  if (!team.aiUsed) used.push(taggedLine('rule', notes.length > 0 ? 'AI was not used. The Style agent kept its rule-based result where two options were close.' : 'AI was not used.'));
  const refused = project.runLog.filter((e) => e.event === 'refused');
  const needsLook = project.runLog.filter((e) => e.event === 'needs-look');
  if (needsLook.length > 0) used.push(taggedLine('rule', `${plural(needsLook.length, 'Locked item needs', 'Locked items need')} your look. It was not changed.`));
  else if (refused.length === 0) nothingToDo.push(taggedLine('rule', 'No Locked item needed protecting this time.'));
  if (team.scripted) used.push(taggedLine('rule', `Every answer was a ${SCRIPTED_WORDS}, not yours.`));

  const keptNotRead = [];
  if (typeof project.brief === 'string' && project.brief.trim() !== '') keptNotRead.push(taggedLine('rule', 'Your brief. It is kept with your project and was not read.'));
  const imageCount = typeof project.imageCount === 'number' ? project.imageCount : countImages(state);
  if (imageCount > 0) keptNotRead.push(taggedLine('rule', `Your ${plural(imageCount, 'image', 'images')}. They stay in this page, are never uploaded, and were not looked at, because AI is off.`));
  if (keptNotRead.length === 0) keptNotRead.push(taggedLine('rule', 'You added no brief and no images.'));
  if (used.length === 0) used.push(taggedLine('rule', 'The design team had nothing to change.'));
  if (nothingToDo.length === 0) nothingToDo.push(taggedLine('rule', 'Nothing was left idle.'));

  const clashItem = project.items.find((i) => i.kind === 'clash');
  const lists = [
    { key: 'used', heading: LIST_HEADINGS.used, lines: used },
    { key: 'keptNotRead', heading: LIST_HEADINGS.keptNotRead, lines: keptNotRead },
    { key: 'nothingToDo', heading: LIST_HEADINGS.nothingToDo, lines: nothingToDo },
  ];
  return {
    heading: REPORT_HEADING,
    sentence: FIXED_SENTENCE,
    teamSentences: team.sentences.slice(),
    lists, used, keptNotRead, nothingToDo,
    clashLine: clashItem && clashItem.value && typeof clashItem.value.summary === 'string' ? taggedLine('rule', clashItem.value.summary) : null,
    aiUsed: team.aiUsed,
    scripted: team.scripted,
  };
}
