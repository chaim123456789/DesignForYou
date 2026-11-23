// Place Task 12: the result report says what Layout and Builder did and did not do with placed objects,
// and the result screen shows those lines.
//
// The first group runs the REAL docs/intake/report.js on real runs (state.js, build-brain.js, the engine copies).
// The last test runs the REAL page scripts on the stand-in page built from the REAL docs/index.html.
// What this CANNOT show: how the lines look, 320 px layout, a real screen reader. Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from '../test-helpers/register-hooks.js';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor } from '../test-helpers/fake-page.js';
import {
  createState, setProjectName, addFloor, addRoom, addPlaced, addItem,
} from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import {
  buildReport, FIXED_SENTENCE, LIST_HEADINGS, DID_NOT_HEADING, DID_NOT_SENTENCE, RECTANGLES_SENTENCE,
} from '../docs/intake/report.js';

installImportHooks();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('./build-brain.js?v=')) return { url: new URL('../test-helpers/build-brain-shim.js', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('../engine/summary/make-summary.js?v=')) return { url: new URL('../test-helpers/make-summary-shim.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const REVIEWER_LINE = 'The Reviewer checked doors and windows against furniture, furniture against furniture, and each object against the size of its room.';
const UNSURE_LINE_TAIL = 'Layout checked each Unsure piece of furniture and Builder checked each Unsure door and window, and each wrote a note on it.';

function baseState(rooms = ['Kitchen']) {
  const s = createState();
  setProjectName(s, 'Place report test');
  const floor = addFloor(s, 'Ground').id;
  for (const name of rooms) addRoom(s, floor, name, 4, 4);
  return s;
}
const roomId = (s, i = 0) => s.floors[0].rooms[i].id;
function place(s, type, itemStatus, fields = {}, roomIndex = 0) {
  const result = addPlaced(s, { type, status: itemStatus, room: roomId(s, roomIndex), x: 0, y: 0, ...fields });
  assert.equal(result.ok, true, result.message);
  return result.id;
}
const reportFor = (state, options) => buildReport(state, runDesignTeam(state), options);
const allLines = (r) => r.lists.flatMap((l) => l.lines);

// ---- 0 objects: nothing new, nothing missing -------------------------------------------------------

test('Place Task 12: with no objects placed the report is exactly the old report (three lists, the old lines, none of the new ones)', () => {
  const report = reportFor(baseState());
  assert.deepEqual(report.lists.map((l) => l.heading), ['Used', 'Kept but not read', 'Nothing to do this time']);
  assert.deepEqual(report.used, [
    'You added no notes or style profile tags, so nothing was added to the description of your items.',
    'You added no items, so there was nothing to respect.',
    'The clash check compared your notes and style profile tags with the tag of each Locked item, using this short list of opposite pairs: warm oak and cold steel; linen and glossy chrome.',
  ]);
  assert.deepEqual(report.nothingToDo, [
    'Layout and Builder had nothing to place, because no furniture, doors or windows were entered.',
    'No Locked item needed protecting this time.',
  ]);
  const text = allLines(report).join('\n');
  assert.ok(!text.includes(DID_NOT_SENTENCE), 'the "did not" line is absent when nothing was placed');
  assert.ok(!text.includes(RECTANGLES_SENTENCE));
  assert.ok(!text.includes('You placed'));
  assert.ok(!report.lists.some((l) => l.heading === DID_NOT_HEADING));
  assert.equal(report.sentence, FIXED_SENTENCE);
});

test('Place Task 12: the fixed sentences and headings are exactly these words', () => {
  assert.equal(RECTANGLES_SENTENCE, 'The overlap and fit checks use only the rectangles you entered.');
  assert.equal(DID_NOT_HEADING, 'What Layout and Builder did not do');
  assert.equal(DID_NOT_SENTENCE, 'Layout and Builder did not choose where anything goes. They did not move, resize or turn anything, and they did not fix any clash. They checked each Unsure object and marked it.');
  assert.deepEqual(LIST_HEADINGS, { used: 'Used', keptNotRead: 'Kept but not read', nothingToDo: 'Nothing to do this time' }, 'the three usual headings are unchanged');
});

// ---- Only Unsure ---------------------------------------------------------------------------------------

test('Place Task 12: with only Unsure objects the report says each was checked and marked, and has no Locked line', () => {
  const s = baseState();
  place(s, 'sofa', 'Unsure', { x: 0, y: 0 });
  place(s, 'bed', 'Unsure', { x: 200, y: 100 });
  place(s, 'door', 'Unsure', { x: 100, y: 0 });
  const run = runDesignTeam(s);
  const report = buildReport(s, run);
  assert.ok(report.used.includes(`You placed 2 pieces of furniture and 1 door. ${UNSURE_LINE_TAIL}`), report.used.join('\n'));
  assert.ok(!report.used.some((l) => /Locked objects were respected/.test(l)), 'no Locked line when nothing is Locked');
  assert.ok(report.used.includes(REVIEWER_LINE));
  assert.ok(report.used.includes(RECTANGLES_SENTENCE));
  assert.deepEqual(report.lists.at(-1), { key: 'didNot', heading: DID_NOT_HEADING, lines: [DID_NOT_SENTENCE] });
  // The notes really were written, so the line says what happened.
  const notes = run.project.items.filter((i) => ['layout', 'door', 'window'].includes(i.kind)).map((i) => i.value.note);
  assert.deepEqual(notes.sort(), ['Opening checked by Builder', 'Placement checked by Layout', 'Placement checked by Layout']);
  assert.ok(!report.nothingToDo.some((l) => /had nothing to place/.test(l)), 'the "nothing to place" line is gone');
});

// ---- A mix with Locked -----------------------------------------------------------------------------------

test('Place Task 12: with a mix including Locked objects the report says the Locked ones were respected and not changed', () => {
  const s = baseState();
  place(s, 'sofa', 'Locked', { x: 0, y: 0 });
  place(s, 'window', 'Unsure', { x: 100, y: 0 });
  place(s, 'window', 'Unsure', { x: 250, y: 0, name: 'Second window' });
  const run = runDesignTeam(s);
  const report = buildReport(s, run);
  assert.ok(report.used.includes(`You placed 1 piece of furniture and 2 windows. ${UNSURE_LINE_TAIL}`), report.used.join('\n'));
  assert.ok(report.used.includes('Locked objects were respected: no agent changed them.'));
  const lockedSofa = run.project.items.find((i) => i.kind === 'layout');
  assert.equal(lockedSofa.status, 'Locked');
  assert.equal(lockedSofa.value.note, undefined, 'the Locked sofa really has no note');
  assert.ok(report.lists.some((l) => l.key === 'didNot'));
});

test('Place Task 12: with only Locked objects nothing was checked or marked, and the line says so', () => {
  const s = baseState();
  place(s, 'sofa', 'Locked');
  const report = reportFor(s);
  assert.ok(report.used.includes('You placed 1 piece of furniture. None of them was Unsure, so Layout and Builder had nothing to check or mark.'), report.used.join('\n'));
  assert.ok(report.used.includes('Locked objects were respected: no agent changed them.'));
  assert.ok(report.used.includes(RECTANGLES_SENTENCE));
});

test('Place Task 12: the counts come from the objects and use the right singular and plural words', () => {
  const s = baseState();
  for (let i = 0; i < 3; i += 1) place(s, 'table', 'Unsure', { name: `Table ${i}`, x: i * 120, y: 200 });
  place(s, 'door', 'Unsure', { x: 0, y: 0 });
  place(s, 'window', 'Unsure', { x: 100, y: 0 });
  place(s, 'window', 'Unsure', { x: 250, y: 0, name: 'Second window' });
  const report = reportFor(s);
  assert.ok(report.used.includes(`You placed 3 pieces of furniture, 1 door and 2 windows. ${UNSURE_LINE_TAIL}`), report.used.join('\n'));
  const only = baseState();
  place(only, 'door', 'Unsure');
  assert.ok(reportFor(only).used.some((l) => l.startsWith('You placed 1 door. ')));
});

// ---- A skipped room -----------------------------------------------------------------------------------------

test('Place Task 12: a room with objects but no size is named as skipped by the fit check; rooms with a size are not', () => {
  const s = baseState(['Kitchen', 'Bedroom']);
  place(s, 'sofa', 'Unsure', { x: 0, y: 0 }, 0);
  place(s, 'bed', 'Unsure', { x: 0, y: 0 }, 1);
  const normal = reportFor(s);
  assert.ok(!allLines(normal).some((l) => /has no size|have no size/.test(l)), 'no skipped line when every room has a size');
  // Take the size away from the Bedroom, as in a project made without room sizes.
  delete s.floors[0].rooms[1].width;
  delete s.floors[0].rooms[1].depth;
  const run = runDesignTeam(s);
  assert.equal(run.ok, true, run.reason);
  const report = buildReport(s, run);
  assert.ok(report.used.includes('Bedroom has no size, so the fit check was skipped there.'), report.used.join('\n'));
  assert.ok(!report.used.some((l) => l.startsWith('Kitchen has no size')));
  // Two rooms without a size
  delete s.floors[0].rooms[0].width;
  delete s.floors[0].rooms[0].depth;
  const both = buildReport(s, runDesignTeam(s));
  assert.ok(both.used.includes('These rooms have no size, so the fit check was skipped there: Kitchen, Bedroom.'), both.used.join('\n'));
  // A room without a size and without objects is not mentioned.
  const empty = baseState(['Kitchen', 'Bedroom']);
  place(empty, 'sofa', 'Unsure', { x: 0, y: 0 }, 0);
  delete empty.floors[0].rooms[1].width;
  delete empty.floors[0].rooms[1].depth;
  assert.ok(!allLines(reportFor(empty)).some((l) => /Bedroom has no size/.test(l)));
});

// ---- R4.7 -----------------------------------------------------------------------------------------------------

test('Place Task 12 (R4.7): the report says the overlap and fit checks use only the rectangles the visitor entered', () => {
  const s = baseState();
  place(s, 'sofa', 'Unsure', { x: 0, y: 0 });
  place(s, 'table', 'Unsure', { x: 50, y: 20 }); // overlaps the sofa, so the Reviewer finds a clash
  const run = runDesignTeam(s);
  const clashes = run.project.items.find((i) => i.kind === 'clash').value.clashes;
  assert.ok(clashes.some((c) => c.type === 'Furniture overlaps furniture'), 'a real overlap clash exists');
  const report = buildReport(s, run);
  assert.equal(report.used.filter((l) => l === 'The overlap and fit checks use only the rectangles you entered.').length, 1, 'said once, in the report');
  assert.equal(report.clashLine, null, 'the clash line only speaks when the Reviewer found nothing');
});

// ---- Wording and safety -----------------------------------------------------------------------------------------

test('Place Task 12: the old lines and the fixed sentence are unchanged when objects are placed, and no line claims AI or design', () => {
  const plain = reportFor(baseState());
  const s = baseState();
  place(s, 'sofa', 'Unsure');
  place(s, 'door', 'Locked', { x: 100 });
  const withObjects = buildReport(s, runDesignTeam(s));
  for (const line of [...plain.used, ...plain.keptNotRead]) assert.ok(allLines(withObjects).includes(line), `old line kept: ${line}`);
  assert.equal(withObjects.sentence, FIXED_SENTENCE);
  assert.equal(withObjects.sentence, 'The design team is a set of fixed rules, not AI. It does not look at your images or read your brief.');
  const text = allLines(withObjects).join('\n');
  assert.doesNotMatch(text, /\bAI\b/, 'no line mentions AI (only the fixed sentence does)');
  assert.doesNotMatch(text, /\b(designed|optimi[sz]ed|optimi[sz]e|understood|analys\w+|smart|intelligent|learned|chose|chooses)\b/i);
  assert.doesNotMatch(text, /placed-\d|item-\d|room-\d/, 'no internal ids');
});

test('Place Task 12: building the report changes nothing it was given', () => {
  const s = baseState();
  place(s, 'sofa', 'Unsure');
  const run = runDesignTeam(s);
  const before = JSON.stringify({ s, project: run.project });
  buildReport(s, run);
  assert.equal(JSON.stringify({ s, project: run.project }), before);
});

test('Place Task 12: a style item and placed objects together keep the old item line and add the placed lines', () => {
  const s = baseState();
  addItem(s, { text: 'Oak floor', room: roomId(s), status: 'Locked', tag: 'warm oak' });
  place(s, 'sofa', 'Unsure');
  const report = buildReport(s, runDesignTeam(s));
  assert.ok(report.used.includes('Your 1 item and their Locked or Unsure status were respected. Locked items were not changed.'));
  assert.ok(report.used.some((l) => l.startsWith('You placed 1 piece of furniture.')));
});

// ---- The result screen ---------------------------------------------------------------------------------------------

test('Place Task 12: the result screen shows the placed-object lines, the "did not" list and the rectangles sentence', async () => {
  const page = createFakePage();
  const restore = installFakePage(page);
  globalThis.confirm = () => true;
  try {
    await import('../docs/intake/screens.js?case=place-report-1');
    await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    page.el('choose-own').click();
    page.el('project-name').value = 'My home';
    page.el('project-name').dispatch('change');
    page.el('floor-name').value = 'Ground floor';
    page.el('add-floor').click();
    page.el('room-name').value = 'Kitchen';
    page.el('add-room').click();
    const gotoStep = (id) => { for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click(); };
    gotoStep('place');
    const room = page.el('place-room').children.find((o) => o.textContent === 'Kitchen');
    page.el('place-room').value = room.value;
    page.el('place-room').dispatch('change');
    const add = (type, itemStatus, x, y) => {
      page.el('place-type').value = type;
      page.el('place-type').dispatch('change');
      page.el('place-status-locked').checked = itemStatus === 'Locked';
      page.el('place-status-unsure').checked = itemStatus === 'Unsure';
      page.el('place-x').value = x;
      page.el('place-y').value = y;
      page.el('add-placed').click();
    };
    add('sofa', 'Locked', '0', '100');
    add('table', 'Unsure', '50', '120'); // overlaps the sofa
    add('door', 'Unsure', '100', '0');
    add('window', 'Unsure', '250', '0');
    assert.equal(page.el('place-list').children.length, 4);
    gotoStep('review');
    page.el('run-design-team').click();
    await waitFor(() => page.el('screen-result').hidden === false || page.el('run-failure').hidden === false, 'the run to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(page.el('screen-result').hidden, false, 'the result screen opened');
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
    const reportText = page.el('own-report').textContent;
    assert.ok(reportText.includes(`You placed 2 pieces of furniture, 1 door and 1 window. ${UNSURE_LINE_TAIL}`), reportText);
    assert.ok(reportText.includes('Locked objects were respected: no agent changed them.'));
    assert.ok(reportText.includes(REVIEWER_LINE));
    assert.ok(reportText.includes(RECTANGLES_SENTENCE));
    assert.ok(reportText.includes(DID_NOT_HEADING));
    assert.ok(reportText.includes(DID_NOT_SENTENCE));
    assert.ok(!reportText.includes('had nothing to place'));
    const headings = page.el('own-report').children.filter((c) => c.tagName === 'H3').map((c) => c.textContent);
    assert.deepEqual(headings, ['Used', 'Kept but not read', 'Nothing to do this time', 'What Layout and Builder did not do']);
    // The result shows the new kind of clash too (the table overlaps the sofa).
    assert.ok(page.el('own-summary').textContent.includes('Furniture overlaps furniture'), 'the clash list names the new clash type');
  } finally {
    delete globalThis.confirm;
    delete globalThis.designForYouViewer;
    restore();
  }
});
