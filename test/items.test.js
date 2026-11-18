import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem, ownerForKind, KIND_OWNER } from '../src/brain/brain.js';

function makeProject() {
  return createProject({ name: 'Test Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
}

test('R3.3: a new item with no status defaults to Unsure', () => {
  const item = createItem(makeProject(), { kind: 'style', value: 'warm oak', owner: 'Style' });
  assert.equal(item.status, 'Unsure');
});

test('R3.1: a given status of Locked is kept', () => {
  const item = createItem(makeProject(), { kind: 'style', value: 'oak', owner: 'Style', status: 'Locked' });
  assert.equal(item.status, 'Locked');
});

test('R3.4: status "Maybe" is rejected', () => {
  const p = makeProject();
  assert.throws(() => createItem(p, { kind: 'style', value: 'x', owner: 'Style', status: 'Maybe' }), /Use Locked or Unsure/);
  assert.equal(p.items.length, 0);
});

test('R4.3: an item with no owner is rejected', () => {
  const p = makeProject();
  assert.throws(() => createItem(p, { kind: 'style', value: 'x' }), /needs an owner/);
  assert.equal(p.items.length, 0);
});

test('R4.3: an item with two owners is rejected', () => {
  const p = makeProject();
  assert.throws(() => createItem(p, { kind: 'style', value: 'x', owner: ['Style', 'Layout'] }), /exactly one owner/);
  assert.equal(p.items.length, 0);
});

test('R4.2: an owner that is not one of the four agents is rejected', () => {
  assert.throws(() => createItem(makeProject(), { kind: 'style', value: 'x', owner: 'Bob' }), /is not an agent/);
});

test('R4.5: each item kind maps to its owner', () => {
  assert.equal(ownerForKind('style'), 'Style');
  assert.equal(ownerForKind('layout'), 'Layout');
  assert.equal(ownerForKind('door'), 'Builder');
  assert.equal(ownerForKind('window'), 'Builder');
  assert.equal(ownerForKind('clash'), 'Reviewer');
  assert.equal(Object.keys(KIND_OWNER).length, 5);
  assert.throws(() => ownerForKind('sofa'), /Unknown kind/);
});

test('R4.5: an item whose owner does not match its kind is rejected', () => {
  assert.throws(() => createItem(makeProject(), { kind: 'door', value: 'x', owner: 'Style' }), /owned by Builder, not Style/);
});

test('R3.2: an item can belong to a room, and the room must exist', () => {
  const p = makeProject();
  const item = createItem(p, { kind: 'style', value: 'oak floor', owner: 'Style', room: 'floor-1-room-1' });
  assert.equal(item.room, 'floor-1-room-1');
  assert.throws(() => createItem(p, { kind: 'style', value: 'x', owner: 'Style', room: 'nope' }), /does not exist/);
});

test('items get stable ids in creation order', () => {
  const p = makeProject();
  const a = createItem(p, { kind: 'style', value: 'a', owner: 'Style' });
  const b = createItem(p, { kind: 'layout', value: 'b', owner: 'Layout' });
  assert.deepEqual([a.id, b.id], ['item-1', 'item-2']);
});
