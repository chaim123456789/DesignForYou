import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addFloor, addRoom } from '../src/brain/brain.js';

const validData = () => ({
  name: 'Test Home',
  floors: [
    { name: 'Ground', rooms: [{ name: 'Kitchen' }, { name: 'Living room' }] },
    { name: 'Upper', rooms: [{ name: 'Bedroom' }, { name: 'Bathroom' }] },
  ],
});

test('R1.1-R1.3: a valid project loads with floors and rooms', () => {
  const p = createProject(validData());
  assert.equal(p.name, 'Test Home');
  assert.equal(p.floors.length, 2);
  assert.equal(p.floors[0].rooms.length, 2);
  assert.equal(p.floors[1].rooms[0].name, 'Bedroom');
});

test('R1.1: a project with no floors is rejected', () => {
  assert.throws(() => createProject({ name: 'Empty', floors: [] }), /at least one floor/);
  assert.throws(() => createProject({ name: 'Empty' }), /at least one floor/);
});

test('R1.1: a project with no name is rejected', () => {
  assert.throws(() => createProject({ floors: validData().floors }), /needs a name/);
});

test('R1.2: a floor with no rooms or no name is rejected', () => {
  assert.throws(() => createProject({ name: 'X', floors: [{ name: 'Ground', rooms: [] }] }), /at least one room/);
  assert.throws(() => createProject({ name: 'X', floors: [{ rooms: [{ name: 'A' }] }] }), /A floor needs a name/);
});

test('R1.3: a room with no name is rejected', () => {
  assert.throws(() => createProject({ name: 'X', floors: [{ name: 'G', rooms: [{}] }] }), /A room needs a name/);
});

test('R1.4: a room with no floor is rejected with a clear message', () => {
  const p = createProject(validData());
  assert.throws(() => addRoom(p, undefined, { name: 'Hall' }), /needs a floor. No floor was given/);
  assert.throws(() => addRoom(p, 'floor-99', { name: 'Hall' }), /Floor "floor-99" does not exist/);
  assert.equal(p.floors[0].rooms.length, 2); // nothing was added
});

test('R1.4: a floor with no project is rejected with a clear message', () => {
  assert.throws(() => addFloor(undefined, { name: 'Attic', rooms: [{ name: 'Loft' }] }), /needs a project/);
  assert.throws(() => addFloor(null, { name: 'Attic', rooms: [{ name: 'Loft' }] }), /needs a project/);
});

test('R1.3: each room belongs to exactly one floor', () => {
  const p = createProject(validData());
  const ids = p.floors.flatMap((f) => f.rooms.map((r) => r.id));
  assert.equal(new Set(ids).size, ids.length);
  const room = addRoom(p, 'floor-2', { name: 'Study' });
  const owners = p.floors.filter((f) => f.rooms.some((r) => r.id === room.id));
  assert.equal(owners.length, 1);
  assert.equal(owners[0].id, 'floor-2');
});

test('R1.5: order is the same on every load', () => {
  const names = (p) => p.floors.map((f) => [f.name, f.order, f.rooms.map((r) => [r.name, r.order])]);
  const a = createProject(validData());
  const b = createProject(validData());
  assert.deepEqual(names(a), names(b));
  assert.deepEqual(a.floors.map((f) => f.order), [1, 2]);
  assert.deepEqual(a.floors[0].rooms.map((r) => r.order), [1, 2]);
});
