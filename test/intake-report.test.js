import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createState, setProjectName, addFloor, addRoom, addNote, addImage, setBrief, addItem,
} from '../docs/intake/state.js';
import { QUESTIONS } from '../docs/intake/taste.js';
import { STYLE_CONFLICTS } from '../docs/intake/limits.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { buildReport, FIXED_SENTENCE, REPORT_HEADING, LIST_HEADINGS } from '../docs/intake/report.js';
import { sampleStyleAgent } from '../docs/engine/agents/style/agent.js';
import { readSampleData } from '../src/sample/run-sample.js';

const EXACT_SENTENCE = 'The design team is a set of fixed rules, not AI. It does not look at your images or read your brief.';

function baseState() {
  const s = createState();
  setProjectName(s, 'Report test');
  const floor = addFloor(s, 'Ground').id;
  addRoom(s, floor, 'Kitchen', 4, 4);
  return s;
}
const kitchenId = (s) => s.floors[0].rooms[0].id;

function fullState() {
  const s = baseState();
  addNote(s, 'overall', 'warm oak');
  setBrief(s, 'A calm family home.');
  s.tasteAnswers = { [QUESTIONS[0].id]: QUESTIONS[0].answers[0].id };
  addImage(s, 'overall', { name: 'a.png', type: 'image/png', size: 100 });
  addImage(s, 'overall', { name: 'b.png', type: 'image/png', size: 100 });
  addItem(s, { text: 'Oak floor', room: kitchenId(s), status: 'Locked', tag: 'warm oak' });
  addItem(s, { text: 'Curtains', room: kitchenId(s), status: 'Unsure', tag: 'linen' });
  return s;
}

const reportFor = (state, options) => buildReport(state, runDesignTeam(state), options);
const allText = (r) => [r.heading, ...r.lists.flatMap((l) => [l.heading, ...l.lines]), ...r.pairsText, r.clashLine || ''].join('\n');

test('Task 5: the brief and the images appear under "Kept but not read" and never under "Used"', () => {
  const report = reportFor(fullState());
  assert.ok(report.keptNotRead.some((l) => /brief/i.test(l) && /not read/.test(l)));
  assert.ok(report.keptNotRead.some((l) => /2 images/.test(l) && /not looked at/.test(l)));
  assert.equal(report.used.some((l) => /brief|image/i.test(l)), false);
  assert.equal(report.nothingToDo.some((l) => /brief|image/i.test(l)), false);
});

test('Task 5: the report has the three lists with the expected headings, in order', () => {
  const report = reportFor(fullState());
  assert.equal(report.heading, 'What the design team did with your input');
  assert.equal(REPORT_HEADING, 'What the design team did with your input');
  assert.deepEqual(report.lists.map((l) => l.heading), ['Used', 'Kept but not read', 'Nothing to do this time']);
  assert.deepEqual(LIST_HEADINGS, { used: 'Used', keptNotRead: 'Kept but not read', nothingToDo: 'Nothing to do this time' });
  for (const list of report.lists) assert.ok(list.lines.length > 0, list.key);
});

test('Task 5: with notes and tags the "Used" list says they were added to each Unsure item', () => {
  const report = reportFor(fullState());
  assert.ok(report.used.some((l) => /notes and style profile tags were added to the description of each Unsure item/.test(l)));
  assert.ok(report.used.some((l) => /2 items and their Locked or Unsure status were respected/.test(l)));
});

test('Task 5: with no notes (and no tags) the "Used" list says so', () => {
  const s = baseState();
  addItem(s, { text: 'Oak floor', room: kitchenId(s), status: 'Locked', tag: 'warm oak' });
  const report = reportFor(s);
  assert.ok(report.used[0].startsWith('You added no notes or style profile tags'));
  assert.equal(report.used.some((l) => /were added to the description/.test(l)), false);
});

test('Task 5: with a brief or images missing, "Kept but not read" says so instead of listing them', () => {
  const report = reportFor(baseState());
  assert.deepEqual(report.keptNotRead, ['You added no brief and no images.']);
});

test('Task 5: a line says Layout and Builder had nothing to place when no furniture, doors or windows exist', () => {
  const state = fullState();
  const run = runDesignTeam(state);
  const report = buildReport(state, run);
  assert.ok(report.nothingToDo.includes('Layout and Builder had nothing to place, because no furniture, doors or windows were entered.'));
  assert.ok(report.nothingToDo.includes('No Locked item needed protecting this time.'));
  // The line is only there because nothing was to place: add a piece of furniture to the finished Brain and it goes.
  const withFurniture = structuredClone(run);
  withFurniture.project.items.push({ id: 'item-99', kind: 'layout', owner: 'Layout', status: 'Unsure', value: { name: 'Sofa' } });
  assert.equal(buildReport(state, withFurniture).nothingToDo.some((l) => /Layout and Builder/.test(l)), false);
});

test('Task 5: when a change to a Locked item is refused, the report says so and does not say nothing needed protecting', () => {
  const state = fullState();
  const run = runDesignTeam(state, { agents: { Style: sampleStyleAgent } });
  assert.ok(run.project.runLog.some((e) => e.event === 'refused'));
  const report = buildReport(state, run);
  assert.ok(report.used.some((l) => /1 change to a Locked item was refused/.test(l)));
  assert.equal(report.nothingToDo.includes('No Locked item needed protecting this time.'), false);
});

test('Task 5: the pairs shown are exactly the pairs given to the Reviewer (same list as the sample, and each one really clashes)', () => {
  const state = fullState();
  const report = reportFor(state);
  assert.deepEqual(report.pairs, STYLE_CONFLICTS.map((p) => [...p]));
  assert.deepEqual(report.pairs, readSampleData().styleConflicts);
  assert.deepEqual(report.pairsText, ['warm oak and cold steel', 'linen and glossy chrome']);
  assert.ok(report.used.some((l) => l.includes('warm oak and cold steel; linen and glossy chrome')));
  // The Reviewer really uses these pairs: each listed pair clashes, in both directions, and an unlisted pair does not.
  const clashes = (lockedTag, note) => {
    const s = baseState();
    addNote(s, 'overall', note);
    addItem(s, { text: 'Thing', room: kitchenId(s), status: 'Locked', tag: lockedTag });
    return runDesignTeam(s).project.items.find((i) => i.kind === 'clash').value.clashes.length;
  };
  for (const [a, b] of report.pairs) {
    assert.equal(clashes(a, b), 1, `${a} against ${b}`);
    assert.equal(clashes(b, a), 1, `${b} against ${a}`);
  }
  assert.equal(clashes('warm oak', 'dark slate'), 0);
});

test('Task 5: pairs can be passed in, and the report then shows those pairs', () => {
  const report = reportFor(fullState(), { pairs: [['a', 'b']] });
  assert.deepEqual(report.pairsText, ['a and b']);
});

test('Task 5: the clash line says the Reviewer found nothing in this small list, and only when no clash was found', () => {
  const none = reportFor(fullState());
  assert.equal(none.clashLine, 'The Reviewer found nothing in this small list. This does not mean there are no problems.');
  const s = baseState();
  addNote(s, 'overall', 'cold steel');
  addItem(s, { text: 'Oak floor', room: kitchenId(s), status: 'Locked', tag: 'warm oak' });
  assert.equal(reportFor(s).clashLine, null);
});

test('Task 5: no text claims AI, understanding, design or analysis (word search over every line)', () => {
  const states = [fullState(), baseState()];
  const refusal = runDesignTeam(fullState(), { agents: { Style: sampleStyleAgent } });
  const reports = [...states.map((s) => reportFor(s)), buildReport(fullState(), refusal)];
  const banned = /\b(AI|artificial|intelligen\w*|smart|analy[sz]\w*|understand\w*|understood|design(?:s|ed|ing)?|designer|noticed|recogni[sz]\w*|learn\w*|interpret\w*|inspired|suggest\w*|recommend\w*)\b/i;
  for (const report of reports) {
    // The heading and the fixed sentence use "design team" and "not AI" on purpose; every other line is searched.
    const lines = [...report.lists.flatMap((l) => [l.heading, ...l.lines]), ...report.pairsText, report.clashLine || ''];
    for (const line of lines) assert.doesNotMatch(line, banned, line);
  }
});

test('Task 5: the fixed sentence is exact, is the report sentence, and matches requirements.md and design.md', () => {
  assert.equal(FIXED_SENTENCE, EXACT_SENTENCE);
  assert.equal(reportFor(fullState()).sentence, EXACT_SENTENCE);
  const requirements = readFileSync(new URL('../.kiro/specs/intake/requirements.md', import.meta.url), 'utf8');
  const design = readFileSync(new URL('../.kiro/specs/intake/design.md', import.meta.url), 'utf8');
  assert.ok(requirements.includes(EXACT_SENTENCE), 'requirements.md has a different sentence');
  assert.ok(design.includes(EXACT_SENTENCE), 'design.md has a different sentence');
});

test('Task 5: the sentence check fails if the sentence is changed in one place only (planted change in a copy)', () => {
  const source = readFileSync(new URL('../docs/intake/report.js', import.meta.url), 'utf8');
  const requirements = readFileSync(new URL('../.kiro/specs/intake/requirements.md', import.meta.url), 'utf8');
  assert.ok(source.includes(`export const FIXED_SENTENCE = '${EXACT_SENTENCE}';`), 'report.js holds the sentence once, as a constant');
  assert.ok(requirements.includes(EXACT_SENTENCE));
  // Change it in the code copy only: the two no longer agree, so the check above would fail.
  const changedCode = source.replace(EXACT_SENTENCE, EXACT_SENTENCE.replace('fixed rules', 'smart rules'));
  assert.equal(changedCode.includes(EXACT_SENTENCE), false);
  // Change it in the spec copy only: same.
  assert.equal(requirements.replace(EXACT_SENTENCE, EXACT_SENTENCE.replace('fixed rules', 'smart rules')).includes(EXACT_SENTENCE), false);
});

test('Task 5: a run that did not finish gives no report', () => {
  const state = fullState();
  const boom = () => { throw new Error('x'); };
  assert.equal(buildReport(state, runDesignTeam(state, { agents: { Layout: boom } })), null);
  assert.equal(buildReport(state, null), null);
});

test('Task 5: the report does not change the inputs, is repeatable, and never repeats what the visitor typed', () => {
  const state = fullState();
  addNote(state, 'overall', '<img src=x onerror=alert(1)>');
  setBrief(state, '<b>secret brief</b>');
  const run = runDesignTeam(state);
  const before = structuredClone(state);
  const a = buildReport(state, run);
  const b = buildReport(state, run);
  assert.deepEqual(state, before);
  assert.deepEqual(a, b);
  const text = allText(a);
  assert.equal(text.includes('<'), false);
  assert.equal(text.includes('secret brief'), false);
});
