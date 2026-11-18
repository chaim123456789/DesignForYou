import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/brain/brain.js';
import {
  setProjectInspiration,
  setRoomOverride,
  clearRoomOverride,
  getEffectiveInspiration,
} from '../src/brain/inspiration.js';

function makeProject() {
  const p = createProject({
    name: 'Test Home',
    floors: [
      { name: 'Ground', rooms: [{ name: 'Kitchen' }, { name: 'Living room' }] },
      { name: 'Upper', rooms: [{ name: 'Bedroom' }] },
    ],
  });
  setProjectInspiration(p, ['warm oak', 'linen']);
  return p;
}
const KITCHEN = 'floor-1-room-1';
const LIVING = 'floor-1-room-2';
const BEDROOM = 'floor-2-room-1';

test('R2.1: a project has one overall inspiration set', () => {
  const p = makeProject();
  assert.deepEqual(p.inspiration, ['warm oak', 'linen']);
});

test('R2.3: a room without an override gets the overall set', () => {
  const p = makeProject();
  assert.deepEqual(getEffectiveInspiration(p, KITCHEN), ['warm oak', 'linen']);
});

test('R2.2/R2.3: a room with an override gets its own set', () => {
  const p = makeProject();
  setRoomOverride(p, BEDROOM, ['cool grey', 'concrete']);
  assert.deepEqual(getEffectiveInspiration(p, BEDROOM), ['cool grey', 'concrete']);
});

test('R2.4: one override does not change any other room', () => {
  const p = makeProject();
  setRoomOverride(p, BEDROOM, ['cool grey']);
  assert.deepEqual(getEffectiveInspiration(p, KITCHEN), ['warm oak', 'linen']);
  assert.deepEqual(getEffectiveInspiration(p, LIVING), ['warm oak', 'linen']);
  assert.deepEqual(p.inspiration, ['warm oak', 'linen']);
});

test('R2.5: clearing an override returns the room to the overall set', () => {
  const p = makeProject();
  setRoomOverride(p, BEDROOM, ['cool grey']);
  clearRoomOverride(p, BEDROOM);
  assert.deepEqual(getEffectiveInspiration(p, BEDROOM), ['warm oak', 'linen']);
  assert.equal('override' in p.floors[1].rooms[0], false);
});

test('changing the returned list does not change the project', () => {
  const p = makeProject();
  getEffectiveInspiration(p, KITCHEN).push('neon');
  assert.deepEqual(p.inspiration, ['warm oak', 'linen']);
});

test('bad input is rejected with a clear message', () => {
  const p = makeProject();
  assert.throws(() => setRoomOverride(p, BEDROOM, []), /at least one named reference/);
  assert.throws(() => setRoomOverride(p, BEDROOM, ['ok', '']), /non-empty names/);
  assert.throws(() => setProjectInspiration(p, 'warm oak'), /at least one named reference/);
  assert.throws(() => setRoomOverride(p, 'nope', ['x']), /Room "nope" does not exist/);
  assert.throws(() => getEffectiveInspiration(p, 'nope'), /does not exist/);
});
