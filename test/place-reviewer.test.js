// Place-items Task 5: the Reviewer's two new checks (furniture overlapping furniture, object outside its room).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem } from '../src/brain/brain.js';
import { createReviewerAgent } from '../src/agents/reviewer/agent.js';
import { STYLE_CONFLICTS } from '../docs/intake/limits.js';
import {
  createState, setProjectName, addFloor, addRoom, addNote, addItem, addPlaced,
} from '../docs/intake/state.js';
import { buildBrain, runDesignTeam } from '../docs/intake/build-brain.js';

const NEW_KINDS = ['Furniture overlaps furniture', 'Object outside its room'];

// One floor, one room "Kitchen" (5 x 4 m) and the objects given, in centimetres.
function oneRoom(objects, size = { width: 5, depth: 4 }) {
  const s = createState();
  setProjectName(s, 'Review test');
  const floor = addFloor(s, 'Ground').id;
  const room = addRoom(s, floor, 'Kitchen', size.width, size.depth).id;
  for (const o of objects) {
    const added = addPlaced(s, { room, status: 'Unsure', ...o });
    assert.equal(added.ok, true, JSON.stringify(o));
  }
  return s;
}

// The clash report the Reviewer writes for a state, found by running the real pipeline.
function report(state) {
  const result = runDesignTeam(state);
  assert.equal(result.ok, true);
  return result.project.items.find((i) => i.kind === 'clash').value;
}

const sofa = (name, x, y, extra = {}) => ({ type: 'sofa', name, x, y, width: 200, depth: 90, ...extra });

test('place-items Task 5: two overlapping sofas give one "Furniture overlaps furniture" clash, reported once', () => {
  const r = report(oneRoom([sofa('Sofa', 100, 100), sofa('Second sofa', 200, 150)]));
  assert.equal(r.clashes.length, 1);
  assert.equal(r.summary, '1 clash found');
  const [clash] = r.clashes;
  assert.equal(clash.number, 1);
  assert.equal(clash.type, 'Furniture overlaps furniture');
  assert.equal(clash.severity, 'Medium');
  assert.equal(clash.description, 'In the Kitchen, the Sofa overlaps the Second sofa.');
  assert.equal(clash.items.length, 2);
});

test('place-items Task 5: three pieces that all overlap give three pairs, each once', () => {
  const r = report(oneRoom([sofa('A', 0, 0), sofa('B', 50, 10), sofa('C', 100, 20)]));
  const pairs = r.clashes.map((c) => [...c.items].sort().join('+'));
  assert.equal(r.clashes.length, 3);
  assert.equal(new Set(pairs).size, 3);
  assert.deepEqual(r.clashes.map((c) => c.number), [1, 2, 3]);
});

test('place-items Task 5: pieces exactly edge to edge give no clash, in both directions', () => {
  const side = report(oneRoom([sofa('A', 0, 0), sofa('B', 200, 0)]));
  assert.equal(side.clashes.length, 0);
  assert.equal(side.summary, 'No clashes found');
  const below = report(oneRoom([sofa('A', 0, 0), sofa('B', 0, 90)]));
  assert.equal(below.clashes.length, 0);
  // Centimetres that turn into inexact metres (20 + 160 = 180 but 0.2 + 1.6 is 1.8000000000000003).
  const rounding = report(oneRoom([
    { type: 'bed', name: 'Bed', x: 20, y: 0, width: 160, depth: 200 },
    { type: 'bed', name: 'Bed 2', x: 180, y: 0, width: 160, depth: 200 },
  ]));
  assert.equal(rounding.clashes.length, 0);
});

test('place-items Task 5: pieces in different rooms never overlap each other', () => {
  const s = oneRoom([sofa('A', 0, 0)]);
  const floor = s.floors[0].id;
  const other = addRoom(s, floor, 'Bedroom', 5, 4).id;
  assert.equal(addPlaced(s, { type: 'sofa', name: 'B', room: other, status: 'Unsure', x: 0, y: 0 }).ok, true);
  assert.equal(report(s).clashes.length, 0);
});

test('place-items Task 5: the 1 mm tolerance: a 0.5 mm overlap is ignored, a 2 mm overlap is reported', () => {
  const project = createProject({ name: 'T', floors: [{ name: 'F', rooms: [{ name: 'Kitchen', width: 5, depth: 4 }] }] });
  const room = project.floors[0].rooms[0].id;
  const piece = (name, x) => createItem(project, {
    kind: 'layout', owner: 'Layout', status: 'Unsure', room,
    value: { name, position: { x, y: 0, width: 1, depth: 1 } },
  });
  piece('A', 0);
  piece('B', 0.9995);
  const reviewer = createReviewerAgent();
  let [{ newValue }] = (() => {
    createItem(project, { kind: 'clash', owner: 'Reviewer', status: 'Unsure', value: { summary: 'x', clashes: [] } });
    return reviewer(project);
  })();
  assert.equal(newValue.clashes.length, 0);
  project.items.find((i) => i.value.name === 'B').value.position.x = 0.998;
  [{ newValue }] = reviewer(project);
  assert.equal(newValue.clashes.length, 1);
});

test('place-items Task 5: a wardrobe 1 cm outside gives one "Object outside its room" clash', () => {
  const wardrobe = { type: 'wardrobe', name: 'Wardrobe', width: 120, depth: 60 };
  const r = report(oneRoom([{ ...wardrobe, x: 381, y: 0 }]));
  assert.equal(r.clashes.length, 1);
  assert.equal(r.clashes[0].type, 'Object outside its room');
  assert.equal(r.clashes[0].severity, 'Medium');
  assert.equal(r.clashes[0].description, 'In the Kitchen, the Wardrobe sticks out of the room.');
  assert.equal(r.clashes[0].items.length, 1);
});

test('place-items Task 5: touching every wall is inside, and 1 cm over any wall is outside', () => {
  const w = { type: 'wardrobe', name: 'Wardrobe', width: 120, depth: 60 };
  assert.equal(report(oneRoom([{ ...w, x: 380, y: 340 }])).clashes.length, 0, 'touches right and bottom walls');
  assert.equal(report(oneRoom([{ ...w, x: 0, y: 0 }])).clashes.length, 0, 'touches left and top walls');
  assert.equal(report(oneRoom([{ ...w, x: -1, y: 0 }])).clashes.length, 1, '1 cm over the left wall');
  assert.equal(report(oneRoom([{ ...w, x: 0, y: -1 }])).clashes.length, 1, '1 cm over the top wall');
  assert.equal(report(oneRoom([{ ...w, x: 381, y: 0 }])).clashes.length, 1, '1 cm over the right wall');
  assert.equal(report(oneRoom([{ ...w, x: 0, y: 341 }])).clashes.length, 1, '1 cm over the bottom wall');
});

test('place-items Task 5: a door outside is High, a window outside is Medium', () => {
  const r = report(oneRoom([
    { type: 'door', name: 'Front door', x: 460, y: 0 },
    { type: 'window', name: 'Big window', x: 0, y: -20 },
  ]));
  const byType = (name) => r.clashes.find((c) => c.description.includes(name));
  assert.equal(r.clashes.length, 2);
  assert.equal(byType('Front door').type, 'Object outside its room');
  assert.equal(byType('Front door').severity, 'High');
  assert.equal(byType('Big window').severity, 'Medium');
});

test('place-items Task 5: a door flush to a wall is inside', () => {
  const r = report(oneRoom([
    { type: 'door', name: 'Front door', x: 100, y: 0 },
    { type: 'window', name: 'Window', x: 0, y: 100, width: 10, depth: 120 },
  ]));
  assert.equal(r.clashes.length, 0);
});

test('place-items Task 5: a room with no size is skipped by the fit check', () => {
  const project = createProject({ name: 'T', floors: [{ name: 'F', rooms: [{ name: 'Kitchen' }] }] });
  const room = project.floors[0].rooms[0].id;
  createItem(project, {
    kind: 'layout', owner: 'Layout', status: 'Unsure', room,
    value: { name: 'Far away sofa', position: { x: 50, y: 50, width: 2, depth: 1 } },
  });
  createItem(project, { kind: 'clash', owner: 'Reviewer', status: 'Unsure', value: { summary: 'x', clashes: [] } });
  const [{ newValue }] = createReviewerAgent()(project);
  assert.equal(newValue.clashes.length, 0);
  assert.equal(newValue.summary, 'No clashes found');
});

test('place-items Task 5: an item with no position is ignored by both new checks', () => {
  const project = createProject({ name: 'T', floors: [{ name: 'F', rooms: [{ name: 'Kitchen', width: 5, depth: 4 }] }] });
  const room = project.floors[0].rooms[0].id;
  createItem(project, { kind: 'layout', owner: 'Layout', status: 'Unsure', room, value: { name: 'Sofa' } });
  createItem(project, { kind: 'layout', owner: 'Layout', status: 'Unsure', room, value: { name: 'Table', position: { x: 0, y: 0, width: 1, depth: 1 } } });
  createItem(project, { kind: 'clash', owner: 'Reviewer', status: 'Unsure', value: { summary: 'x', clashes: [] } });
  assert.equal(createReviewerAgent()(project)[0].newValue.clashes.length, 0);
});

// A project with both older clash kinds and, optionally, both newer kinds.
function mixedState(withNewKinds) {
  const s = createState();
  setProjectName(s, 'Mixed');
  const floor = addFloor(s, 'Ground').id;
  const living = addRoom(s, floor, 'Living Room', 6, 4).id;
  const bedroom = addRoom(s, floor, 'Bedroom', 4, 4).id;
  addNote(s, bedroom, 'cold steel');
  addItem(s, { text: 'Oak bed frame stays', room: bedroom, status: 'Locked', tag: 'warm oak' });
  addPlaced(s, { type: 'sofa', name: 'Sofa', room: living, status: 'Unsure', x: 100, y: 300, width: 200, depth: 90 });
  addPlaced(s, { type: 'door', name: 'Garden door', room: living, status: 'Unsure', x: 150, y: 300, width: 90, depth: 10 });
  if (withNewKinds) {
    addPlaced(s, { type: 'bed', name: 'Bed', room: bedroom, status: 'Unsure', x: 0, y: 0, width: 160, depth: 200 });
    addPlaced(s, { type: 'bed', name: 'Second bed', room: bedroom, status: 'Unsure', x: 100, y: 0, width: 160, depth: 200 });
    addPlaced(s, { type: 'wardrobe', name: 'Wardrobe', room: bedroom, status: 'Unsure', x: 350, y: 300, width: 120, depth: 60 });
  }
  return s;
}

test('place-items Task 5: clash numbers of the old kinds are unchanged when new kinds are added', () => {
  const without = report(mixedState(false));
  const withNew = report(mixedState(true));
  assert.deepEqual(without.clashes.map((c) => c.type), ['Door or window on furniture', 'Room override against Locked item']);
  assert.deepEqual(withNew.clashes.map((c) => c.type), [
    'Door or window on furniture', 'Room override against Locked item',
    'Furniture overlaps furniture', 'Object outside its room',
  ]);
  // The first two clashes are identical, number for number and word for word.
  assert.deepEqual(withNew.clashes.slice(0, 2), without.clashes);
  assert.deepEqual(withNew.clashes.map((c) => c.number), [1, 2, 3, 4]);
  assert.equal(withNew.clashes[2].description, 'In the Bedroom, the Bed overlaps the Second bed.');
  assert.equal(withNew.clashes[3].description, 'In the Bedroom, the Wardrobe sticks out of the room.');
});

test('place-items Task 5: new kinds come after the old kinds, overlap check before the fit check', () => {
  const types = report(mixedState(true)).clashes.map((c) => c.type);
  const firstNew = types.findIndex((t) => NEW_KINDS.includes(t));
  assert.ok(types.slice(0, firstNew).every((t) => !NEW_KINDS.includes(t)));
  assert.ok(types.slice(firstNew).every((t) => NEW_KINDS.includes(t)));
  assert.ok(types.indexOf('Furniture overlaps furniture') < types.indexOf('Object outside its room'));
});

test('place-items Task 5: the Reviewer changes nothing but its own report', () => {
  const state = mixedState(true);
  const withReviewer = runDesignTeam(state);
  const withoutReviewer = runDesignTeam(state, { agents: { Reviewer: () => [] } });
  assert.equal(withReviewer.ok && withoutReviewer.ok, true);

  const notReport = (project) => project.items.filter((i) => i.kind !== 'clash');
  assert.deepEqual(notReport(withReviewer.project), notReport(withoutReviewer.project));

  const reviewerVersions = withReviewer.project.versions.filter((v) => v.who === 'Reviewer');
  assert.equal(reviewerVersions.length, 1);
  const clashItem = withReviewer.project.items.find((i) => i.kind === 'clash');
  assert.equal(reviewerVersions[0].item, clashItem.id);
  assert.deepEqual(withReviewer.project.floors, withoutReviewer.project.floors);
});

test('place-items Task 5: a Locked piece is reported but never moved', () => {
  const s = oneRoom([
    { ...sofa('Locked sofa', 100, 100), status: 'Locked' },
    sofa('Unsure sofa', 150, 120),
  ]);
  const before = buildBrain(s).items.find((i) => i.value.name === 'Locked sofa');
  const result = runDesignTeam(s);
  const after = result.project.items.find((i) => i.value.name === 'Locked sofa');
  assert.deepEqual(after, before);
  assert.equal(result.project.items.find((i) => i.kind === 'clash').value.clashes.length, 1);
});

test('place-items Task 5: the visitor\'s fixed conflict pairs still work next to the new checks', () => {
  assert.ok(STYLE_CONFLICTS.length > 0);
  const r = report(mixedState(false));
  assert.equal(r.clashes[1].type, 'Room override against Locked item');
});
