// Place-items Task 2: the placed-object limits, types and state (pure, no page).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, PLACE_TYPES, PLACE_WALLS } from '../docs/intake/limits.js';
import {
  createState, addFloor, addRoom, removeRoom, removeFloor, hasEntries,
  addPlaced, editPlaced, movePlacedTo, nudgePlaced, turnPlaced, setPlacedWall, setPlacedStatus, removePlaced,
  placedInRoom,
} from '../docs/intake/state.js';

// A state with one floor and two rooms: Kitchen 5 x 4 m and Bedroom 3 x 3 m.
function withRooms() {
  const s = createState();
  const floor = addFloor(s, 'Ground floor').id;
  const kitchen = addRoom(s, floor, 'Kitchen', 5, 4).id;
  const bedroom = addRoom(s, floor, 'Bedroom', 3, 3).id;
  return { s, floor, kitchen, bedroom };
}

// A call that must be refused: a plain sentence, and the state exactly as before.
function refused(state, call, pattern) {
  const before = structuredClone(state);
  const result = call();
  assert.equal(result.ok, false);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length > 0);
  if (pattern) assert.match(result.message, pattern);
  assert.deepEqual(state, before, 'a refused call changed the state');
}

const sofa = (room, extra = {}) => ({ type: 'sofa', room, status: 'Unsure', ...extra });

test('place-items Task 2: the nine types give the right kind, start name and start size', () => {
  assert.deepEqual(Object.keys(PLACE_TYPES), ['sofa', 'bed', 'table', 'wardrobe', 'desk', 'bath', 'kitchen unit', 'door', 'window']);
  const expected = {
    sofa: ['layout', 'Sofa', 200, 90], bed: ['layout', 'Bed', 160, 200], table: ['layout', 'Table', 140, 80],
    wardrobe: ['layout', 'Wardrobe', 120, 60], desk: ['layout', 'Desk', 120, 60], bath: ['layout', 'Bath', 170, 75],
    'kitchen unit': ['layout', 'Kitchen unit', 240, 60], door: ['door', 'Door', 90, 10], window: ['window', 'Window', 120, 10],
  };
  const { s, kitchen } = withRooms();
  for (const [type, [kind, name, width, depth]] of Object.entries(expected)) {
    const r = addPlaced(s, { type, room: kitchen, status: 'Locked' });
    assert.equal(r.ok, true, type);
    const o = s.placed.find((p) => p.id === r.id);
    assert.deepEqual([o.kind, o.type, o.name, o.width, o.depth, o.turn], [kind, type, name, width, depth, 0], type);
  }
});

test('place-items Task 2: limits are in the limits file', () => {
  assert.equal(LIMITS.placedNameMax, 40);
  assert.equal(LIMITS.placedPerRoomMax, 30);
  assert.equal(LIMITS.placedMax, 150);
  assert.equal(LIMITS.placedSizeMin, 10);
  assert.equal(LIMITS.placedSizeMax, 1000);
  assert.equal(LIMITS.placedPosMin, -1000);
  assert.equal(LIMITS.placedPosMax, 3000);
  assert.equal(LIMITS.nudgeStep, 10);
});

test('place-items Task 2: a type that is not on the list is refused', () => {
  const { s, kitchen } = withRooms();
  for (const type of ['piano', '', undefined, 'constructor', 'toString', 7]) {
    refused(s, () => addPlaced(s, sofa(kitchen, { type })), /type/i);
  }
});

test('place-items Task 2: a blank or too-long name is refused with a sentence naming the box', () => {
  const { s, kitchen } = withRooms();
  refused(s, () => addPlaced(s, sofa(kitchen, { name: '   ' })), /name/i);
  refused(s, () => addPlaced(s, sofa(kitchen, { name: 'x'.repeat(41) })), /name.*40/i);
  assert.equal(addPlaced(s, sofa(kitchen, { name: 'x'.repeat(40) })).ok, true);
  const id = s.placed[0].id;
  refused(s, () => editPlaced(s, id, { name: '' }), /name/i);
  refused(s, () => editPlaced(s, id, { name: 'y'.repeat(41) }), /name/i);
});

test('place-items Task 2: a size of 0, a letter in a number box or a decimal is refused and the state is unchanged', () => {
  const { s, kitchen } = withRooms();
  refused(s, () => addPlaced(s, sofa(kitchen, { width: 0 })), /Width/);
  refused(s, () => addPlaced(s, sofa(kitchen, { depth: 0 })), /Depth/);
  refused(s, () => addPlaced(s, sofa(kitchen, { width: 9 })), /Width/);
  refused(s, () => addPlaced(s, sofa(kitchen, { width: 1001 })), /Width/);
  refused(s, () => addPlaced(s, sofa(kitchen, { width: 'abc' })), /Width/);
  refused(s, () => addPlaced(s, sofa(kitchen, { depth: '12a' })), /Depth/);
  refused(s, () => addPlaced(s, sofa(kitchen, { x: 'left' })), /Left/);
  refused(s, () => addPlaced(s, sofa(kitchen, { y: 'x' })), /Top/);
  refused(s, () => addPlaced(s, sofa(kitchen, { x: 12.5 })), /Left/);
  refused(s, () => addPlaced(s, sofa(kitchen, { x: '' })), /Left/);
  refused(s, () => addPlaced(s, sofa(kitchen, { x: 3001 })), /Left/);
  refused(s, () => addPlaced(s, sofa(kitchen, { y: -1001 })), /Top/);
  assert.equal(addPlaced(s, sofa(kitchen, { x: '120', y: ' -50 ', width: '210' })).ok, true);
  const id = s.placed[0].id;
  refused(s, () => editPlaced(s, id, { width: 0 }), /Width/);
  refused(s, () => editPlaced(s, id, { depth: 'abc' }), /Depth/);
  refused(s, () => movePlacedTo(s, id, 'a', 10), /Left/);
  refused(s, () => movePlacedTo(s, id, 10, 'b'), /Top/);
});

test('place-items Task 2: status has no default and must be Locked or Unsure', () => {
  const { s, kitchen } = withRooms();
  refused(s, () => addPlaced(s, { type: 'sofa', room: kitchen }), /Locked or Unsure/);
  refused(s, () => addPlaced(s, sofa(kitchen, { status: 'Maybe' })), /Locked or Unsure/);
  const id = addPlaced(s, sofa(kitchen)).id;
  refused(s, () => setPlacedStatus(s, id, 'locked'), /Locked or Unsure/);
  assert.equal(setPlacedStatus(s, id, 'Locked').ok, true);
  assert.equal(s.placed[0].status, 'Locked');
});

test('place-items Task 2: a room that is not in the list is refused', () => {
  const { s } = withRooms();
  refused(s, () => addPlaced(s, sofa('room-999')), /room/i);
  refused(s, () => addPlaced(s, { type: 'sofa', status: 'Unsure' }), /room/i);
});

test('place-items Task 2: too many objects are refused (30 per room, 150 in total) and the state is unchanged', () => {
  const { s, kitchen, bedroom } = withRooms();
  for (let i = 0; i < 30; i += 1) assert.equal(addPlaced(s, sofa(kitchen)).ok, true);
  refused(s, () => addPlaced(s, sofa(kitchen)), /30 objects in one room/);
  assert.equal(addPlaced(s, sofa(bedroom)).ok, true);
  // Moving an object into the full room is refused too.
  const inBedroom = s.placed.find((o) => o.room === bedroom).id;
  refused(s, () => editPlaced(s, inBedroom, { room: kitchen }), /30 objects in one room/);

  const total = withRooms();
  const floor = total.floor;
  const rooms = [total.kitchen, total.bedroom];
  for (let i = 2; i < 5; i += 1) rooms.push(addRoom(total.s, floor, `Room ${i}`, 4, 4).id);
  let added = 0;
  for (const room of rooms) {
    for (let i = 0; i < 30 && added < 150; i += 1) { assert.equal(addPlaced(total.s, sofa(room)).ok, true); added += 1; }
  }
  assert.equal(total.s.placed.length, 150);
  refused(total.s, () => addPlaced(total.s, sofa(rooms[4])), /150 objects in total/);
});

test('place-items Task 2: nudge moves exactly 10 cm each way', () => {
  const { s, kitchen } = withRooms();
  const id = addPlaced(s, sofa(kitchen, { x: 100, y: 200 })).id;
  const at = () => [s.placed[0].x, s.placed[0].y];
  assert.equal(nudgePlaced(s, id, 'right').ok, true);
  assert.deepEqual(at(), [110, 200]);
  nudgePlaced(s, id, 'left'); nudgePlaced(s, id, 'left');
  assert.deepEqual(at(), [90, 200]);
  nudgePlaced(s, id, 'up');
  assert.deepEqual(at(), [90, 190]);
  nudgePlaced(s, id, 'down'); nudgePlaced(s, id, 'down');
  assert.deepEqual(at(), [90, 210]);
  assert.equal(s.placed[0].width, 200);
  refused(s, () => nudgePlaced(s, id, 'sideways'), /left, right, up or down/);
});

test('place-items Task 2: a nudge out of the room still works, and a nudge past the position limit is refused', () => {
  const { s, kitchen } = withRooms();
  const id = addPlaced(s, sofa(kitchen, { x: 0, y: 0 })).id;
  assert.equal(nudgePlaced(s, id, 'left').ok, true);
  assert.deepEqual([s.placed[0].x, s.placed[0].y], [-10, 0]);
  movePlacedTo(s, id, LIMITS.placedPosMax, 0);
  refused(s, () => nudgePlaced(s, id, 'right'), /Left/);
});

test('place-items Task 2: move to sets the position', () => {
  const { s, kitchen } = withRooms();
  const id = addPlaced(s, sofa(kitchen)).id;
  assert.equal(movePlacedTo(s, id, '150', 230).ok, true);
  assert.deepEqual([s.placed[0].x, s.placed[0].y], [150, 230]);
});

test('place-items Task 2: four turns return to the start, and each turn swaps width and depth', () => {
  const { s, kitchen } = withRooms();
  const id = addPlaced(s, sofa(kitchen, { x: 40, y: 60 })).id;
  const start = structuredClone(s.placed[0]);
  turnPlaced(s, id);
  assert.deepEqual([s.placed[0].width, s.placed[0].depth, s.placed[0].turn], [90, 200, 90]);
  assert.deepEqual([s.placed[0].x, s.placed[0].y], [40, 60], 'the top-left corner stays');
  turnPlaced(s, id);
  assert.deepEqual([s.placed[0].width, s.placed[0].depth, s.placed[0].turn], [200, 90, 180]);
  turnPlaced(s, id);
  assert.equal(s.placed[0].turn, 270);
  turnPlaced(s, id);
  assert.deepEqual(s.placed[0], start);
});

test('place-items Task 2: wall snap puts a door flush on each wall and keeps its distance along the wall', () => {
  const { s, kitchen } = withRooms(); // 500 x 400 cm
  const id = addPlaced(s, { type: 'door', room: kitchen, status: 'Unsure', x: 120, y: 0 }).id;
  const o = () => s.placed[0];

  assert.equal(setPlacedWall(s, id, 'Bottom').ok, true);
  assert.deepEqual([o().x, o().y, o().width, o().depth], [120, 390, 90, 10]);

  assert.equal(setPlacedWall(s, id, 'Top').ok, true);
  assert.deepEqual([o().x, o().y, o().width, o().depth], [120, 0, 90, 10]);

  // A vertical wall: the long side lies along the wall, so the door is turned a quarter.
  assert.equal(setPlacedWall(s, id, 'Left').ok, true);
  assert.deepEqual([o().x, o().y, o().width, o().depth, o().turn], [0, 0, 10, 90, 90]);

  movePlacedTo(s, id, 0, 150);
  assert.equal(setPlacedWall(s, id, 'Right').ok, true);
  assert.deepEqual([o().x, o().y, o().width, o().depth], [490, 150, 10, 90]);

  assert.equal(setPlacedWall(s, id, 'Top').ok, true);
  assert.deepEqual([o().x, o().y, o().width, o().depth, o().turn], [490, 0, 90, 10, 180]);
});

test('place-items Task 2: wall snap works for a window, and is refused for furniture or an unknown wall', () => {
  const { s, kitchen } = withRooms();
  const win = addPlaced(s, { type: 'window', room: kitchen, status: 'Locked', x: 200 }).id;
  assert.equal(setPlacedWall(s, win, 'Bottom').ok, true);
  assert.deepEqual([s.placed[0].x, s.placed[0].y, s.placed[0].width, s.placed[0].depth], [200, 390, 120, 10]);
  const couch = addPlaced(s, sofa(kitchen)).id;
  refused(s, () => setPlacedWall(s, couch, 'Top'), /door or a window/);
  refused(s, () => setPlacedWall(s, win, 'Middle'), /Top, Bottom, Left or Right/);
  assert.deepEqual([...PLACE_WALLS], ['Top', 'Bottom', 'Left', 'Right']);
});

test('place-items Task 2: edit keeps old values when a field is missing, refuses a type change, and can move the object to another room', () => {
  const { s, kitchen, bedroom } = withRooms();
  const id = addPlaced(s, sofa(kitchen, { name: 'Big sofa', x: 10, y: 20 })).id;
  assert.equal(editPlaced(s, id, { name: 'Small sofa', width: 150 }).ok, true);
  assert.deepEqual(
    [s.placed[0].name, s.placed[0].width, s.placed[0].depth, s.placed[0].x, s.placed[0].y, s.placed[0].room],
    ['Small sofa', 150, 90, 10, 20, kitchen]
  );
  refused(s, () => editPlaced(s, id, { type: 'bed' }), /type cannot be changed/);
  assert.equal(editPlaced(s, id, { type: 'sofa' }).ok, true);
  assert.equal(editPlaced(s, id, { room: bedroom }).ok, true);
  assert.equal(s.placed[0].room, bedroom);
  refused(s, () => editPlaced(s, 'placed-999', { name: 'x' }), /not in the list/);
});

test('place-items Task 2: an unknown object id is refused by every change', () => {
  const { s } = withRooms();
  for (const call of [
    () => movePlacedTo(s, 'nope', 1, 1), () => nudgePlaced(s, 'nope', 'left'), () => turnPlaced(s, 'nope'),
    () => setPlacedWall(s, 'nope', 'Top'), () => setPlacedStatus(s, 'nope', 'Locked'), () => removePlaced(s, 'nope'),
  ]) refused(s, call, /not in the list/);
});

test('place-items Task 2: remove takes the object out of the list', () => {
  const { s, kitchen } = withRooms();
  const a = addPlaced(s, sofa(kitchen)).id;
  const b = addPlaced(s, sofa(kitchen, { name: 'Second' })).id;
  assert.equal(removePlaced(s, a).ok, true);
  assert.deepEqual(s.placed.map((o) => o.id), [b]);
});

test('place-items Task 2: hasEntries counts placed objects', () => {
  const s = createState();
  assert.equal(hasEntries(s), false);
  const floor = addFloor(s, 'F').id;
  const room = addRoom(s, floor, 'R').id;
  const id = addPlaced(s, sofa(room)).id;
  // Only the placed object is left that makes this true.
  s.name = ''; s.floors = []; 
  assert.equal(hasEntries(s), true);
  s.placed = [];
  assert.equal(hasEntries(s), false);
  assert.ok(id);
});

test('place-items Task 2: removing a room or a floor drops its placed objects', () => {
  const { s, floor, kitchen, bedroom } = withRooms();
  addPlaced(s, sofa(kitchen)); addPlaced(s, sofa(kitchen)); addPlaced(s, sofa(bedroom));
  assert.equal(placedInRoom(s, kitchen).length, 2);
  assert.equal(removeRoom(s, kitchen).ok, true);
  assert.equal(s.placed.length, 1);
  assert.equal(s.placed[0].room, bedroom);
  assert.equal(removeFloor(s, floor).ok, true);
  assert.deepEqual(s.placed, []);
});

test('place-items Task 2: a refused add leaves other objects and the id counter alone', () => {
  const { s, kitchen } = withRooms();
  addPlaced(s, sofa(kitchen));
  const before = structuredClone(s);
  assert.equal(addPlaced(s, sofa(kitchen, { width: 0 })).ok, false);
  assert.deepEqual(s, before);
});

test('place-items Task 2: a new state has an empty placed list and the old state functions still work', () => {
  const s = createState();
  assert.deepEqual(s.placed, []);
  assert.equal(hasEntries(s), false);
});
