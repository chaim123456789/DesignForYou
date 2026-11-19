import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS } from '../docs/intake/limits.js';
import {
  createState, setProjectName, addFloor, renameFloor, removeFloor, addRoom, renameRoom, removeRoom,
  addImage, removeImage, addNote, removeNote, removeOverride, setBrief, addItem, editItem, removeItem,
  allRooms, allImages,
} from '../docs/intake/state.js';

const jpg = (n = 1, extra = {}) => ({ name: `photo-${n}.jpg`, type: 'image/jpeg', size: 1000, ...extra });

// Runs a call that must be refused: it needs a plain message and must leave the state deep-equal to before.
function refused(state, call, messagePattern) {
  const before = structuredClone(state);
  const result = call();
  assert.equal(result.ok, false);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length > 0);
  if (messagePattern) assert.match(result.message, messagePattern);
  assert.deepEqual(state, before, 'a refused call changed the state');
  return result;
}

function withRooms(roomNames = ['Kitchen', 'Living room']) {
  const s = createState();
  const f = addFloor(s, 'Ground floor').id;
  const ids = roomNames.map((n) => addRoom(s, f, n).id);
  return { s, f, ids };
}

// ---- Project name ----

test('Task 2: project name - empty is refused, 60 characters are accepted, 61 are refused', () => {
  const s = createState();
  refused(s, () => setProjectName(s, ''), /name/i);
  refused(s, () => setProjectName(s, '    '), /name/i);
  assert.equal(setProjectName(s, 'x'.repeat(60)).ok, true);
  assert.equal(s.name.length, 60);
  refused(s, () => setProjectName(s, 'x'.repeat(61)), /60/);
  refused(s, () => setProjectName(s, 42), /name/i);
});

// ---- Floors ----

test('Task 2: floors - 4 are accepted, the 5th is refused, an empty name is refused', () => {
  const s = createState();
  refused(s, () => addFloor(s, ''), /name/i);
  for (let i = 1; i <= 4; i++) assert.equal(addFloor(s, `Floor ${i}`).ok, true);
  assert.equal(s.floors.length, 4);
  refused(s, () => addFloor(s, 'Floor 5'), /at most 4/);
  refused(s, () => addFloor(createState(), 'x'.repeat(LIMITS.floorNameMax + 1)), /characters/);
});

test('Task 2: floors can be renamed, bad renames change nothing', () => {
  const s = createState();
  const id = addFloor(s, 'Ground floor').id;
  assert.equal(renameFloor(s, id, '  Basement ').ok, true);
  assert.equal(s.floors[0].name, 'Basement');
  refused(s, () => renameFloor(s, id, ''), /name/i);
  refused(s, () => renameFloor(s, 'floor-999', 'x'), /not in the list/);
});

// ---- Rooms ----

test('Task 2: rooms - 20 in total are accepted, the 21st is refused, across floors', () => {
  const s = createState();
  const a = addFloor(s, 'A').id;
  const b = addFloor(s, 'B').id;
  for (let i = 1; i <= 20; i++) assert.equal(addRoom(s, i <= 10 ? a : b, `Room ${i}`).ok, true);
  assert.equal(allRooms(s).length, 20);
  refused(s, () => addRoom(s, a, 'Room 21'), /at most 20/);
});

test('Task 2: room names must differ, ignoring upper and lower case (also on another floor)', () => {
  const s = createState();
  const a = addFloor(s, 'A').id;
  const b = addFloor(s, 'B').id;
  assert.equal(addRoom(s, a, 'Kitchen').ok, true);
  refused(s, () => addRoom(s, a, 'kitchen'), /different/);
  refused(s, () => addRoom(s, b, 'KITCHEN '), /different/);
  const other = addRoom(s, a, 'Hall').id;
  refused(s, () => renameRoom(s, other, 'kItChEn'), /different/);
  // Renaming a room to its own name in different case is allowed.
  assert.equal(renameRoom(s, other, 'HALL').ok, true);
  assert.equal(allRooms(s).find((r) => r.id === other).name, 'HALL');
});

test('Task 2: a room needs a name and a floor that exists', () => {
  const s = createState();
  refused(s, () => addRoom(s, 'floor-1', 'Kitchen'), /floor/i);
  const f = addFloor(s, 'A').id;
  refused(s, () => addRoom(s, f, ''), /Give this room a name/);
  refused(s, () => addRoom(s, f, 'x'.repeat(LIMITS.roomNameMax + 1)), /characters/);
});

test('Task 2: width and depth are optional and default to 4 by 4 metres', () => {
  const { s, ids } = withRooms(['Kitchen']);
  const room = allRooms(s).find((r) => r.id === ids[0]);
  assert.equal(room.width, 4);
  assert.equal(room.depth, 4);
  const f = s.floors[0].id;
  const id = addRoom(s, f, 'Hall', '3.5', '').id;
  const hall = allRooms(s).find((r) => r.id === id);
  assert.equal(hall.width, 3.5);
  assert.equal(hall.depth, 4);
  assert.equal(addRoom(s, f, 'Study', 6, 2).ok, true);
});

test('Task 2: width and depth at the edges (1 and 30 metres) are accepted, just outside or not a number are refused', () => {
  const { s, f } = withRooms([]);
  assert.equal(addRoom(s, f, 'Small', 1, 1).ok, true);
  assert.equal(addRoom(s, f, 'Big', 30, 30).ok, true);
  refused(s, () => addRoom(s, f, 'Tiny', 0.9, 4), /Width/);
  refused(s, () => addRoom(s, f, 'Huge', 4, 30.1), /Depth/);
  refused(s, () => addRoom(s, f, 'Odd', 'abc', 4), /Width/);
  refused(s, () => addRoom(s, f, 'Neg', -3, 4), /Width/);
});

test('Task 2: rooms can be renamed and removed', () => {
  const { s, ids } = withRooms();
  assert.equal(renameRoom(s, ids[0], 'Big kitchen').ok, true);
  assert.equal(allRooms(s)[0].name, 'Big kitchen');
  refused(s, () => renameRoom(s, ids[0], ''), /name/i);
  assert.equal(removeRoom(s, ids[1]).ok, true);
  assert.equal(allRooms(s).length, 1);
  refused(s, () => removeRoom(s, ids[1]), /not in the list/);
});

test('Task 2: removing a floor removes its rooms, their items, their overrides and their images (and returns the images)', () => {
  const s = createState();
  const ground = addFloor(s, 'Ground floor').id;
  const upper = addFloor(s, 'Upper floor').id;
  const kitchen = addRoom(s, ground, 'Kitchen').id;
  const bedroom = addRoom(s, upper, 'Bedroom').id;
  addItem(s, { text: 'Oak floor', room: kitchen, status: 'Locked' });
  addItem(s, { text: 'Linen curtains', room: bedroom, status: 'Unsure' });
  addNote(s, bedroom, 'linen');
  const img = addImage(s, bedroom, jpg(1), 'blob:one').id;
  addImage(s, 'overall', jpg(2), 'blob:two');

  const result = removeFloor(s, upper);
  assert.equal(result.ok, true);
  assert.deepEqual(result.removedImages.map((i) => i.id), [img]);
  assert.deepEqual(s.floors.map((f) => f.name), ['Ground floor']);
  assert.deepEqual(allRooms(s).map((r) => r.name), ['Kitchen']);
  assert.deepEqual(s.items.map((i) => i.text), ['Oak floor']);
  assert.deepEqual(Object.keys(s.overrides), []);
  assert.equal(allImages(s).length, 1);
  refused(s, () => removeFloor(s, upper), /not in the list/);
});

test('Task 2: removing a room removes its items and override', () => {
  const { s, ids } = withRooms();
  addItem(s, { text: 'Oak floor', room: ids[0], status: 'Locked' });
  addItem(s, { text: 'Sofa fabric', room: ids[1], status: 'Unsure' });
  addNote(s, ids[0], 'warm oak');
  const result = removeRoom(s, ids[0]);
  assert.equal(result.ok, true);
  assert.deepEqual(s.items.map((i) => i.text), ['Sofa fabric']);
  assert.deepEqual(s.overrides, {});
});

// ---- Images ----

test('Task 2: images - 50 in total are accepted (overall and overrides together), the 51st is refused', () => {
  const { s, ids } = withRooms();
  for (let i = 1; i <= 30; i++) assert.equal(addImage(s, 'overall', jpg(i), `blob:${i}`).ok, true);
  for (let i = 31; i <= 50; i++) assert.equal(addImage(s, ids[0], jpg(i), `blob:${i}`).ok, true);
  assert.equal(allImages(s).length, 50);
  refused(s, () => addImage(s, 'overall', jpg(51)), /at most 50/);
  refused(s, () => addImage(s, ids[1], jpg(52)), /at most 50/);
});

test('Task 2: images - JPEG, PNG and WebP are accepted, other types are refused with a reason', () => {
  const s = createState();
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(addImage(s, 'overall', { name: 'a', type, size: 10 }).ok, true);
  }
  refused(s, () => addImage(s, 'overall', { name: 'doc.pdf', type: 'application/pdf', size: 10 }), /JPEG, PNG or WebP/);
  refused(s, () => addImage(s, 'overall', { name: 'anim.gif', type: 'image/gif', size: 10 }), /JPEG, PNG or WebP/);
  refused(s, () => addImage(s, 'overall', { name: 'x', size: 10 }), /JPEG, PNG or WebP/);
});

test('Task 2: images - exactly 10 MB is accepted, one byte over is refused, empty is refused', () => {
  const s = createState();
  const tenMb = 10 * 1024 * 1024;
  assert.equal(addImage(s, 'overall', { name: 'big.png', type: 'image/png', size: tenMb }).ok, true);
  refused(s, () => addImage(s, 'overall', { name: 'bigger.png', type: 'image/png', size: tenMb + 1 }), /10 MB/);
  refused(s, () => addImage(s, 'overall', { name: 'empty.png', type: 'image/png', size: 0 }), /empty/);
});

test('Task 2: images - caption up to 80 characters, an image needs an existing room layer', () => {
  const { s } = withRooms();
  assert.equal(addImage(s, 'overall', jpg(1, { caption: 'c'.repeat(80) })).ok, true);
  refused(s, () => addImage(s, 'overall', jpg(2, { caption: 'c'.repeat(81) })), /caption/i);
  refused(s, () => addImage(s, 'room-999', jpg(3)), /room/i);
});

test('Task 2: an image can be removed and its record (with preview address) is returned; unknown image is refused', () => {
  const { s, ids } = withRooms();
  const a = addImage(s, 'overall', jpg(1), 'blob:a').id;
  const b = addImage(s, ids[0], jpg(2), 'blob:b').id;
  const first = removeImage(s, a);
  assert.equal(first.ok, true);
  assert.equal(first.image.previewUrl, 'blob:a');
  assert.equal(removeImage(s, b).image.previewUrl, 'blob:b');
  assert.equal(allImages(s).length, 0);
  refused(s, () => removeImage(s, a), /not in the list/);
});

// ---- Notes ----

test('Task 2: notes - 30 per layer are accepted, the 31st is refused; each layer counts on its own', () => {
  const { s, ids } = withRooms();
  for (let i = 1; i <= 30; i++) assert.equal(addNote(s, 'overall', `note ${i}`).ok, true);
  refused(s, () => addNote(s, 'overall', 'one more'), /at most 30/);
  for (let i = 1; i <= 30; i++) assert.equal(addNote(s, ids[0], `room note ${i}`).ok, true);
  refused(s, () => addNote(s, ids[0], 'one more'), /at most 30/);
  assert.equal(addNote(s, ids[1], 'fine').ok, true);
});

test('Task 2: notes - 40 characters are accepted, 41 are refused, empty is refused', () => {
  const s = createState();
  assert.equal(addNote(s, 'overall', 'n'.repeat(40)).ok, true);
  refused(s, () => addNote(s, 'overall', 'n'.repeat(41)), /40/);
  refused(s, () => addNote(s, 'overall', '   '), /Write a note/);
});

test('Task 2: a note on a room that does not exist is refused and creates no override', () => {
  const s = createState();
  refused(s, () => addNote(s, 'room-999', 'warm oak'), /room/i);
  assert.deepEqual(s.overrides, {});
});

test('Task 2: notes can be removed; a room override can be removed so the room goes back to the overall notes', () => {
  const { s, ids } = withRooms();
  addNote(s, 'overall', 'linen');
  addNote(s, ids[0], 'cold steel');
  addNote(s, ids[0], 'glass');
  assert.equal(removeNote(s, ids[0], 0).ok, true);
  assert.deepEqual(s.overrides[ids[0]].notes, ['glass']);
  refused(s, () => removeNote(s, ids[0], 5), /not in the list/);
  refused(s, () => removeNote(s, ids[1], 0), /not in the list/);
  addImage(s, ids[0], jpg(1), 'blob:k');
  const result = removeOverride(s, ids[0]);
  assert.equal(result.ok, true);
  assert.equal(result.removedImages[0].previewUrl, 'blob:k');
  assert.equal(s.overrides[ids[0]], undefined);
  assert.deepEqual(s.overall.notes, ['linen']);
  refused(s, () => removeOverride(s, ids[0]), /no override/);
});

// ---- Brief ----

test('Task 2: brief - 2000 characters are accepted, 2001 are refused, empty is allowed', () => {
  const s = createState();
  assert.equal(setBrief(s, 'b'.repeat(2000)).ok, true);
  assert.equal(s.brief.length, 2000);
  refused(s, () => setBrief(s, 'b'.repeat(2001)), /2000/);
  assert.equal(setBrief(s, '').ok, true);
  assert.equal(s.brief, '');
});

// ---- Items ----

test('Task 2: items - text 80 characters accepted, 81 refused, empty refused', () => {
  const { s, ids } = withRooms();
  assert.equal(addItem(s, { text: 't'.repeat(80), room: ids[0], status: 'Locked' }).ok, true);
  refused(s, () => addItem(s, { text: 't'.repeat(81), room: ids[0], status: 'Locked' }), /80/);
  refused(s, () => addItem(s, { text: '  ', room: ids[0], status: 'Locked' }), /Describe the item/);
});

test('Task 2: items - Locked or Unsure must be chosen (no default), the room must exist', () => {
  const { s, ids } = withRooms();
  refused(s, () => addItem(s, { text: 'Oak floor', room: ids[0] }), /Locked or Unsure/);
  refused(s, () => addItem(s, { text: 'Oak floor', room: ids[0], status: 'locked' }), /Locked or Unsure/);
  refused(s, () => addItem(s, { text: 'Oak floor', room: 'room-999', status: 'Locked' }), /room/i);
  refused(s, () => addItem(s, { text: 'Oak floor', status: 'Locked' }), /room/i);
  refused(s, () => addItem(s), /Describe the item/);
});

test('Task 2: items - the tag is optional, up to 40 characters', () => {
  const { s, ids } = withRooms();
  assert.equal(addItem(s, { text: 'Oak floor', room: ids[0], status: 'Locked' }).ok, true);
  assert.equal(s.items[0].tag, '');
  assert.equal(addItem(s, { text: 'Oak floor 2', room: ids[0], status: 'Locked', tag: 'warm oak' }).ok, true);
  assert.equal(s.items[1].tag, 'warm oak');
  assert.equal(addItem(s, { text: 'x', room: ids[0], status: 'Unsure', tag: 't'.repeat(40) }).ok, true);
  refused(s, () => addItem(s, { text: 'x', room: ids[0], status: 'Unsure', tag: 't'.repeat(41) }), /40/);
});

test('Task 2: items - 100 are accepted, the 101st is refused', () => {
  const { s, ids } = withRooms();
  for (let i = 1; i <= 100; i++) assert.equal(addItem(s, { text: `Item ${i}`, room: ids[0], status: 'Unsure' }).ok, true);
  assert.equal(s.items.length, 100);
  refused(s, () => addItem(s, { text: 'Item 101', room: ids[0], status: 'Unsure' }), /at most 100/);
});

test('Task 2: items can be edited, their status changed and removed; bad edits change nothing', () => {
  const { s, ids } = withRooms();
  const id = addItem(s, { text: 'Oak floor', room: ids[0], status: 'Unsure', tag: 'warm oak' }).id;
  assert.equal(editItem(s, id, { status: 'Locked' }).ok, true);
  assert.equal(s.items[0].status, 'Locked');
  assert.equal(s.items[0].text, 'Oak floor');
  assert.equal(editItem(s, id, { text: 'Oak floor, wide boards', room: ids[1], tag: '' }).ok, true);
  assert.deepEqual(
    { text: s.items[0].text, room: s.items[0].room, tag: s.items[0].tag, status: s.items[0].status },
    { text: 'Oak floor, wide boards', room: ids[1], tag: '', status: 'Locked' },
  );
  refused(s, () => editItem(s, id, { text: '' }), /Describe the item/);
  refused(s, () => editItem(s, id, { status: 'Maybe' }), /Locked or Unsure/);
  refused(s, () => editItem(s, id, { room: 'room-999' }), /room/i);
  refused(s, () => editItem(s, 'item-999', { text: 'x' }), /not in the list/);
  assert.equal(removeItem(s, id).ok, true);
  assert.equal(s.items.length, 0);
  refused(s, () => removeItem(s, id), /not in the list/);
});

// ---- General ----

test('Task 2: every refusal message is plain text with no ids or field names', () => {
  const { s, ids } = withRooms();
  const messages = [
    setProjectName(s, ''), addFloor(s, ''), addRoom(s, 'x', 'y'), addImage(s, 'overall', { name: 'a', type: 'text/plain', size: 1 }),
    addNote(s, 'overall', ''), addItem(s, { text: 'a', room: ids[0] }), setBrief(s, 'b'.repeat(2001)),
  ].map((r) => r.message);
  for (const m of messages) {
    assert.doesNotMatch(m, /floor-\d|room-\d|item-\d|image-\d|undefined|null|\bkind\b|\bid\b/i, m);
  }
});

test('Task 2: the limits file holds the numbers from the design', () => {
  assert.equal(LIMITS.projectNameMax, 60);
  assert.equal(LIMITS.floorsMax, 4);
  assert.equal(LIMITS.roomsMax, 20);
  assert.equal(LIMITS.imagesMax, 50);
  assert.equal(LIMITS.imageBytesMax, 10 * 1024 * 1024);
  assert.deepEqual([...LIMITS.imageTypes], ['image/jpeg', 'image/png', 'image/webp']);
  assert.equal(LIMITS.notesMaxPerLayer, 30);
  assert.equal(LIMITS.noteMax, 40);
  assert.equal(LIMITS.briefMax, 2000);
  assert.equal(LIMITS.itemTextMax, 80);
  assert.equal(LIMITS.itemsMax, 100);
  assert.equal(LIMITS.roomSizeDefault, 4);
});
