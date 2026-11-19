// "What the design team did with your input": a pure function from the visitor's inputs and the
// finished run to three plain lists, the list of opposite pairs, and the fixed sentence.
// No page code, no network. Every line says only what really happened. It never claims
// that anything was understood, analysed or designed, and never claims AI.
import { STYLE_CONFLICTS } from './limits.js';
import { buildProfile } from './taste.js';

// The one fixed sentence (R10.1). The start screen and the result screen must use this exact text.
export const FIXED_SENTENCE = 'The design team is a set of fixed rules, not AI. It does not look at your images or read your brief.';

export const REPORT_HEADING = 'What the design team did with your input';
export const LIST_HEADINGS = Object.freeze({
  used: 'Used',
  keptNotRead: 'Kept but not read',
  nothingToDo: 'Nothing to do this time',
});

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

  return {
    heading: REPORT_HEADING,
    sentence: FIXED_SENTENCE,
    lists: [
      { key: 'used', heading: LIST_HEADINGS.used, lines: used },
      { key: 'keptNotRead', heading: LIST_HEADINGS.keptNotRead, lines: keptNotRead },
      { key: 'nothingToDo', heading: LIST_HEADINGS.nothingToDo, lines: nothingToDo },
    ],
    used,
    keptNotRead,
    nothingToDo,
    pairs,
    pairsText: pairs.map(describePair),
    clashLine,
  };
}
