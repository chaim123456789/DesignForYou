// Place-items Task 4: optional room size in the Project Brain, and placed objects becoming items.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, findRoom } from '../src/brain/brain.js';
import { loadSampleProject, readSampleData } from '../src/sample/run-sample.js';
import {
  createState, setProjectName, addFloor, addRoom, addItem, addPlaced,
} from '../docs/intake/state.js';
import { buildBrain, runDesignTeam } from '../docs/intake/build-brain.js';

const base = (room = { name: 'Kitchen' }) => ({ name: 'Test', floors: [{ name: 'Ground', rooms: [room] }] });

// ---- Edit 1: the room size in the Brain ----

test('place-items Task 4: a room made with a name only is exactly as before', () => {
  const project = createProject(base());
  assert.deepEqual(project.floors[0].rooms[0], { id: 'floor-1-room-1', name: 'Kitchen', order: 1 });
  assert.deepEqual(Object.keys(project.floors[0].rooms[0]), ['id', 'name', 'order']);
});

test('place-items Task 4: the sample project\'s rooms have no size, so the sample Brain is unchanged', () => {
  const project = loadSampleProject(readSampleData());
  for (const room of project.floors.flatMap((f) => f.rooms)) {
    assert.equal('width' in room, false);
    assert.equal('depth' in room, false);
  }
});

test('place-items Task 4: a room keeps its width and depth when both are given', () => {
  const project = createProject(base({ name: 'Kitchen', width: 5, depth: 4.5 }));
  assert.deepEqual(project.floors[0].rooms[0], { id: 'floor-1-room-1', name: 'Kitchen', order: 1, width: 5, depth: 4.5 });
});

test('place-items Task 4: bad room sizes (zero, negative, text, not a number, only one of the two) are refused', () => {
  const bad = [
    { width: 0, depth: 4 }, { width: 4, depth: 0 }, { width: -1, depth: 4 }, { width: '4', depth: 4 },
    { width: 'wide', depth: 4 }, { width: NaN, depth: 4 }, { width: Infinity, depth: 4 }, { width: null, depth: 4 },
    { width: 4 }, { depth: 4 },
  ];
  for (const size of bad) {
    assert.throws(() => createProject(base({ name: 'Kitchen', ...size })), /size of room "Kitchen"/, JSON.stringify(size));
  }
});

// ---- Edit 8: building the items ----

// Two rooms, one Locked style item, then placed objects of every kind.
function placedState() {
  const s = createState();
  setProjectName(s, 'Place test');
  const floor = addFloor(s, 'Ground').id;
  const living = addRoom(s, floor, 'Living Room', 6, 4).id;
  const bedroom = addRoom(s, floor, 'Bedroom', 4, 3).id;
  addItem(s, { text: 'Oak floor', room: living, status: 'Locked', tag: 'warm oak' });
  const ids = {
    lockedSofa: addPlaced(s, { type: 'sofa', name: 'Locked sofa', room: living, status: 'Locked', x: 100, y: 300, width: 200, depth: 90 }).id,
    unsureBed: addPlaced(s, { type: 'bed', name: 'Guest bed', room: bedroom, status: 'Unsure', x: 20, y: 30, width: 160, depth: 200 }).id,
    unsureDoor: addPlaced(s, { type: 'door', name: 'Front door', room: living, status: 'Unsure', x: 120, y: 0, width: 90, depth: 10 }).id,
    lockedWindow: addPlaced(s, { type: 'window', name: 'Big window', room: bedroom, status: 'Locked', x: 50, y: 0, width: 120, depth: 10 }).id,
  };
  return { s, ids, living, bedroom };
}

test('place-items Task 4: the rooms in the Brain carry the size from setup, in metres', () => {
  const { s } = placedState();
  const project = buildBrain(s);
  const rooms = project.floors.flatMap((f) => f.rooms);
  assert.deepEqual(rooms.map((r) => [r.name, r.width, r.depth]), [['Living Room', 6, 4], ['Bedroom', 4, 3]]);
});

test('place-items Task 4: furniture becomes a layout item owned by Layout; doors and windows are door and window items owned by Builder', () => {
  const { s } = placedState();
  const project = buildBrain(s);
  const byName = (name) => project.items.find((i) => i.value.name === name);
  assert.deepEqual(
    ['Locked sofa', 'Guest bed', 'Front door', 'Big window'].map((n) => [byName(n).kind, byName(n).owner]),
    [['layout', 'Layout'], ['layout', 'Layout'], ['door', 'Builder'], ['window', 'Builder']]
  );
  // No new kind and no new owner: every item has one of the five existing kinds.
  for (const item of project.items) assert.ok(['style', 'layout', 'door', 'window', 'clash'].includes(item.kind));
});

test('place-items Task 4: positions are in metres, furniture keeps its type and turn, and status and room are the visitor\'s', () => {
  const { s, living, bedroom } = placedState();
  const project = buildBrain(s);
  const rooms = project.floors.flatMap((f) => f.rooms);
  const byName = (name) => project.items.find((i) => i.value.name === name);

  const sofa = byName('Locked sofa');
  assert.deepEqual(sofa.value, { name: 'Locked sofa', type: 'sofa', turn: 0, position: { x: 1, y: 3, width: 2, depth: 0.9 } });
  assert.equal(sofa.status, 'Locked');
  assert.equal(sofa.room, rooms[0].id);

  const bed = byName('Guest bed');
  assert.deepEqual(bed.value, { name: 'Guest bed', type: 'bed', turn: 0, position: { x: 0.2, y: 0.3, width: 1.6, depth: 2 } });
  assert.equal(bed.status, 'Unsure');
  assert.equal(bed.room, rooms[1].id);

  assert.deepEqual(byName('Front door').value, { name: 'Front door', position: { x: 1.2, y: 0, width: 0.9, depth: 0.1 } });
  assert.deepEqual(byName('Big window').value, { name: 'Big window', position: { x: 0.5, y: 0, width: 1.2, depth: 0.1 } });
  assert.ok(living && bedroom);
});

test('place-items Task 4: a turned piece keeps its turn in the item', () => {
  const s = createState();
  setProjectName(s, 'Turn test');
  const floor = addFloor(s, 'F').id;
  const room = addRoom(s, floor, 'R', 5, 5).id;
  const id = addPlaced(s, { type: 'sofa', room, status: 'Unsure' }).id;
  s.placed.find((o) => o.id === id).turn = 90;
  const sofa = buildBrain(s).items.find((i) => i.kind === 'layout');
  assert.equal(sofa.value.turn, 90);
});

test('place-items Task 4: items come in a fixed order: style items, placed objects as placed, then the clash report', () => {
  const { s } = placedState();
  const project = buildBrain(s);
  assert.deepEqual(project.items.map((i) => i.kind), ['style', 'layout', 'layout', 'door', 'window', 'clash']);
  assert.deepEqual(project.items.slice(1, 5).map((i) => i.value.name), ['Locked sofa', 'Guest bed', 'Front door', 'Big window']);
  assert.deepEqual(buildBrain(s), buildBrain(s), 'the same inputs give the same Brain');
});

test('place-items Task 4: with nothing placed the Brain has only the style items and the clash report, as before', () => {
  const s = createState();
  setProjectName(s, 'Plain');
  const floor = addFloor(s, 'F').id;
  const room = addRoom(s, floor, 'R', 4, 4).id;
  addItem(s, { text: 'Paint', room, status: 'Unsure', tag: '' });
  assert.deepEqual(buildBrain(s).items.map((i) => i.kind), ['style', 'clash']);
});

test('place-items Task 4: building the Brain does not change the visitor\'s state', () => {
  const { s } = placedState();
  const before = structuredClone(s);
  buildBrain(s);
  assert.deepEqual(s, before);
});

test('place-items Task 4: the full pipeline runs with placed objects', () => {
  const { s } = placedState();
  const result = runDesignTeam(s);
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.runLog.map((e) => `${e.agent}:${e.event}`), [
    'Style:started', 'Style:finished', 'Layout:started', 'Layout:finished',
    'Builder:started', 'Builder:finished', 'Reviewer:started', 'Reviewer:finished',
  ]);
});

test('place-items Task 4: a Locked placed object is identical after the run, and an Unsure one gets the Layout or Builder note', () => {
  const { s } = placedState();
  const before = buildBrain(s);
  const result = runDesignTeam(s);
  assert.equal(result.ok, true);
  const after = result.project;
  const find = (project, name) => project.items.find((i) => i.value.name === name);

  for (const name of ['Locked sofa', 'Big window']) {
    assert.deepEqual(find(after, name), find(before, name), `${name} must be unchanged`);
    assert.equal(after.versions.some((v) => v.item === find(after, name).id), false, `${name} must have no version`);
  }
  assert.deepEqual(find(after, 'Guest bed').value, { ...find(before, 'Guest bed').value, note: 'Placement checked by Layout' });
  assert.deepEqual(find(after, 'Front door').value, { ...find(before, 'Front door').value, note: 'Opening checked by Builder' });
  // Only the note was added to the Unsure ones: position, type and turn are untouched.
  assert.deepEqual(find(after, 'Guest bed').value.position, find(before, 'Guest bed').value.position);
});

test('place-items Task 4: the Locked sofa really is protected by the gatekeeper, not by the agent skipping it', () => {
  const { s } = placedState();
  const result = runDesignTeam(s);
  const sofa = result.project.items.find((i) => i.value.name === 'Locked sofa');
  assert.equal(sofa.status, 'Locked');
  assert.equal(findRoom(result.project, sofa.room).name, 'Living Room');
});
