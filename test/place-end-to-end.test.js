// Place Task 14: one small project goes from setup to result.
//
// Two rooms (Kitchen 4 m by 4 m, Bedroom 3 m by 3 m) and five objects:
//   a Locked sofa, an Unsure bed that overlaps it, an Unsure wardrobe that sticks out of the Bedroom,
//   an Unsure door that sits on the sofa, and an Unsure window that fits.
// The first group runs the real pure code (state, Project Brain, agents, report, run data, shapes).
// The last test runs the real screens on the stand-in page: the same project typed into the boxes and
// buttons, then the result screen is read.
// What this CANNOT show: how anything looks, a real browser, a phone. Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor } from '../test-helpers/fake-page.js';
import {
  createState, setProjectName, addFloor, addRoom, addPlaced,
} from '../docs/intake/state.js';
import { buildBrain, runDesignTeam } from '../docs/intake/build-brain.js';
import { buildReport, RECTANGLES_SENTENCE, DID_NOT_SENTENCE, FIXED_SENTENCE } from '../docs/intake/report.js';
import { buildOwnRunData } from '../docs/intake/run-data.js';
import { buildScene, shapeParts } from '../docs/scene-data.js';

installImportHooks();

// The objects: room is 'Kitchen' or 'Bedroom'; numbers are centimetres.
const OBJECTS = [
  { type: 'sofa', name: 'Sofa', room: 'Kitchen', status: 'Locked', x: 0, y: 100, width: 200, depth: 90 },
  { type: 'bed', name: 'Bed', room: 'Kitchen', status: 'Unsure', x: 100, y: 150, width: 160, depth: 200 },
  { type: 'wardrobe', name: 'Wardrobe', room: 'Bedroom', status: 'Unsure', x: 250, y: 0, width: 100, depth: 60 },
  { type: 'door', name: 'Door', room: 'Kitchen', status: 'Unsure', x: 50, y: 95, width: 90, depth: 10 },
  { type: 'window', name: 'Window', room: 'Kitchen', status: 'Unsure', x: 250, y: 0, width: 100, depth: 10 },
];

function makeState() {
  const s = createState();
  setProjectName(s, 'End to end');
  const floor = addFloor(s, 'Ground floor').id;
  const rooms = { Kitchen: addRoom(s, floor, 'Kitchen', 4, 4).id, Bedroom: addRoom(s, floor, 'Bedroom', 3, 3).id };
  for (const o of OBJECTS) {
    const added = addPlaced(s, { ...o, room: rooms[o.room] });
    assert.equal(added.ok, true, `${o.name}: ${added.message}`);
  }
  return s;
}
const clashItem = (project) => project.items.find((i) => i.kind === 'clash');
const byName = (project, name) => project.items.find((i) => i.value && i.value.name === name);

const EXPECTED_CLASHES = [
  { number: 1, type: 'Door or window on furniture', severity: 'High', description: 'In the Kitchen, the Door sits where the Sofa is placed.' },
  { number: 2, type: 'Furniture overlaps furniture', severity: 'Medium', description: 'In the Kitchen, the Sofa overlaps the Bed.' },
  { number: 3, type: 'Object outside its room', severity: 'Medium', description: 'In the Bedroom, the Wardrobe sticks out of the room.' },
];

test('place-items Task 14: the clash report has the three clash kinds, numbered 1, 2, 3 in that order, with the right words and severities', () => {
  const result = runDesignTeam(makeState());
  assert.equal(result.ok, true);
  const report = clashItem(result.project).value;
  assert.equal(report.summary, '3 clashes found');
  assert.deepEqual(report.clashes.map(({ number, type, severity, description }) => ({ number, type, severity, description })), EXPECTED_CLASHES);
  // Each clash names the objects involved: the door and the sofa; the sofa and the bed; the wardrobe.
  const idOf = (name) => byName(result.project, name).id;
  assert.deepEqual(report.clashes.map((c) => [...c.items].sort()), [
    [idOf('Door'), idOf('Sofa')].sort(), [idOf('Sofa'), idOf('Bed')].sort(), [idOf('Wardrobe')],
  ]);
  assert.ok(report.labels.some((l) => /drafts for professional review/.test(l)), 'the draft statement is in the report');
});

test('place-items Task 14: the Locked sofa is identical after the run and has no version; the Unsure objects only gain a note', () => {
  const state = makeState();
  const before = buildBrain(state);
  const result = runDesignTeam(state);
  assert.equal(result.ok, true);
  assert.deepEqual(byName(result.project, 'Sofa'), byName(before, 'Sofa'), 'the Locked sofa is identical');
  assert.equal(result.project.versions.some((v) => v.item === byName(result.project, 'Sofa').id), false);
  const notes = { Bed: 'Placement checked by Layout', Wardrobe: 'Placement checked by Layout', Door: 'Opening checked by Builder', Window: 'Opening checked by Builder' };
  for (const [name, note] of Object.entries(notes)) {
    assert.deepEqual(byName(result.project, name).value, { ...byName(before, name).value, note }, `${name} gained only its note`);
  }
});

test('place-items Task 14: the report lines are the exact ones for a mix of Locked and Unsure objects', () => {
  const state = makeState();
  const report = buildReport(state, runDesignTeam(state));
  const used = report.used;
  assert.ok(used.includes('You placed 3 pieces of furniture, 1 door and 1 window. Layout checked each Unsure piece of furniture and Builder checked each Unsure door and window, and each wrote a note on it.'));
  assert.ok(used.includes('Locked objects were respected: no agent changed them.'));
  assert.ok(used.includes('The Reviewer checked doors and windows against furniture, furniture against furniture, and each object against the size of its room.'));
  assert.ok(used.includes(RECTANGLES_SENTENCE));
  assert.ok(!report.nothingToDo.some((l) => /had nothing to place/.test(l)), 'the "nothing to place" line is absent');
  assert.deepEqual(report.lists.find((l) => l.key === 'didNot').lines, [DID_NOT_SENTENCE]);
  assert.equal(report.sentence, FIXED_SENTENCE);
});

test('place-items Task 14: the run data carries type and turn for the placed furniture, and the shapes have the listed parts inside each footprint', () => {
  const state = makeState();
  const run = runDesignTeam(state);
  const data = buildOwnRunData(run.project, state);
  assert.equal(data.own, true);
  const boxes = buildScene(data, data.versions.length).filter((b) => b.itemId);
  assert.equal(boxes.length, 5);
  const box = (label) => boxes.find((b) => b.label === label);
  assert.deepEqual(['Sofa', 'Bed', 'Wardrobe'].map((n) => [box(n).furnitureType, box(n).turn]), [['sofa', 0], ['bed', 0], ['wardrobe', 0]]);
  assert.deepEqual([box('Door').furnitureType, box('Window').furnitureType], ['door', 'window']);
  const roles = (label) => shapeParts(box(label)).map((p) => p.role);
  assert.deepEqual(roles('Sofa'), ['seat', 'back', 'arm', 'arm']);
  assert.deepEqual(roles('Bed'), ['mattress', 'headboard']);
  assert.deepEqual(roles('Wardrobe'), ['body', 'doorline']);
  assert.deepEqual(roles('Door'), ['frame', 'frame', 'frame', 'leaf']);
  assert.deepEqual(roles('Window'), ['frame', 'frame', 'frame', 'frame', 'glass']);
  // Every part carries its object's id, colour and clash flag, and the clash flags match the clash report.
  for (const b of boxes) {
    for (const part of shapeParts(b)) {
      assert.equal(part.itemId, b.itemId, `${b.label}: part has the object's id`);
      assert.equal(part.colour, b.colour);
      assert.equal(part.clash, b.clash);
      const eps = 1e-9;
      assert.ok(part.x >= b.x - eps && part.x + part.width <= b.x + b.width + eps && part.z >= b.z - eps && part.z + part.depth <= b.z + b.depth + eps,
        `${b.label} ${part.role}: the part is inside the object's footprint`);
    }
  }
  assert.deepEqual(boxes.map((b) => [b.label, b.clash]), [['Sofa', true], ['Bed', true], ['Wardrobe', true], ['Door', true], ['Window', false]]);
  // Locked is blue, Unsure is orange.
  assert.equal(box('Sofa').colour, 'locked');
  assert.equal(box('Bed').colour, 'unsure');
});

// ==== The same project, typed into the real screens ====================================================

test('place-items Task 14: the same project typed into the screens gives the same three clashes, the report lines and a clean result screen', async () => {
  const page = createFakePage();
  const restore = installFakePage(page);
  globalThis.confirm = () => true;
  try {
    await import('../docs/intake/screens.js?case=place-e2e-1');
    await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const gotoStep = (id) => { for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click(); assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`); };
    page.el('choose-own').click();
    page.el('project-name').value = 'End to end';
    page.el('project-name').dispatch('change');
    page.el('floor-name').value = 'Ground floor';
    page.el('add-floor').click();
    for (const [name, size] of [['Kitchen', '4'], ['Bedroom', '3']]) {
      page.el('room-name').value = name;
      page.el('room-width').value = size;
      page.el('room-depth').value = size;
      page.el('add-room').click();
    }
    gotoStep('place');
    let current = null;
    for (const o of OBJECTS) {
      if (o.room !== current) {
        const option = page.el('place-room').children.find((c) => c.textContent === o.room);
        page.el('place-room').value = option.value;
        page.el('place-room').dispatch('change');
        current = o.room;
      }
      page.el('place-type').value = o.type;
      page.el('place-type').dispatch('change');
      page.el('place-name').value = o.name;
      page.el('place-status-locked').checked = o.status === 'Locked';
      page.el('place-status-unsure').checked = o.status === 'Unsure';
      page.el('place-x').value = String(o.x);
      page.el('place-y').value = String(o.y);
      page.el('place-width').value = String(o.width);
      page.el('place-depth').value = String(o.depth);
      page.el('add-placed').click();
      assert.equal(page.el('add-placed-error').hidden, true, `${o.name} was accepted`);
    }
    gotoStep('review');
    page.el('run-design-team').click();
    await waitFor(() => page.el('screen-result').hidden === false || page.el('run-failure').hidden === false, 'the run to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(page.el('screen-result').hidden, false, 'the result screen opened');
    assert.equal(page.el('run-failure').hidden, true);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
    const summary = page.el('own-summary').textContent;
    for (const c of EXPECTED_CLASHES) {
      assert.ok(summary.includes(c.type), `the result lists "${c.type}"`);
      assert.ok(summary.includes(c.description), `the result says: ${c.description}`);
    }
    assert.ok(summary.includes('3 clashes found'));
    const reportText = page.el('own-report').textContent;
    assert.ok(reportText.includes('You placed 3 pieces of furniture, 1 door and 1 window.'));
    assert.ok(reportText.includes('Locked objects were respected: no agent changed them.'));
    assert.ok(reportText.includes(RECTANGLES_SENTENCE));
    assert.ok(reportText.includes(DID_NOT_SENTENCE));
  } finally {
    delete globalThis.confirm;
    delete globalThis.designForYouViewer;
    restore();
  }
});
