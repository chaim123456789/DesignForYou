import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem, getItem, listVersions, getBrainAtVersion } from '../src/brain/brain.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';

// Known history:
//   start:     item-1 "warm oak" (Unsure), item-2 "white walls" (Locked)
//   version 1: Style changes item-1 to "pale ash"
//   version 2: user unlocks item-2
//   version 3: Style changes item-2 to "black walls"
function setup() {
  const p = createProject({ name: 'Test Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
  createItem(p, { kind: 'style', value: 'warm oak', owner: 'Style' });
  createItem(p, { kind: 'style', value: 'white walls', owner: 'Style', status: 'Locked' });
  const gate = createGatekeeper(p);
  gate.changeItem('Style', 'item-1', 'pale ash');
  gate.changeStatus('user', 'item-2', 'Unsure');
  gate.changeItem('Style', 'item-2', 'black walls');
  return { p, gate };
}
const summary = (brain) => brain.items.map((i) => [i.id, i.value, i.status]);

test('R8.5: versions are listed in order', () => {
  const { p } = setup();
  const list = listVersions(p);
  assert.deepEqual(list.map((v) => v.number), [1, 2, 3]);
  assert.deepEqual(list.map((v) => v.who), ['Style', 'user', 'Style']);
});

test('R8.5: the Brain at version 2 matches the known state after two changes', () => {
  const { p } = setup();
  assert.deepEqual(summary(getBrainAtVersion(p, 2)), [
    ['item-1', 'pale ash', 'Unsure'],
    ['item-2', 'white walls', 'Unsure'], // unlocked, value not yet changed
  ]);
});

test('R8.5: the Brain at other versions matches the known state', () => {
  const { p } = setup();
  assert.deepEqual(summary(getBrainAtVersion(p, 0)), [['item-1', 'warm oak', 'Unsure'], ['item-2', 'white walls', 'Locked']]);
  assert.deepEqual(summary(getBrainAtVersion(p, 1)), [['item-1', 'pale ash', 'Unsure'], ['item-2', 'white walls', 'Locked']]);
  assert.deepEqual(summary(getBrainAtVersion(p, 3)), [['item-1', 'pale ash', 'Unsure'], ['item-2', 'black walls', 'Unsure']]);
});

test('R8.5: the latest past version equals the current Brain', () => {
  const { p } = setup();
  assert.deepEqual(summary(getBrainAtVersion(p, 3)), p.items.map((i) => [i.id, i.value, i.status]));
});

test('R8.6: viewing a past version does not change the current Brain or add a version', () => {
  const { p } = setup();
  const itemsBefore = structuredClone(p.items);
  const versionsBefore = structuredClone(p.versions);
  const logBefore = structuredClone(p.runLog);

  getBrainAtVersion(p, 1);
  getBrainAtVersion(p, 2);
  getBrainAtVersion(p, 0);

  assert.deepEqual(p.items, itemsBefore);
  assert.deepEqual(p.versions, versionsBefore);
  assert.deepEqual(p.runLog, logBefore);
  assert.equal(listVersions(p).length, 3);
  assert.equal(getItem(p, 'item-1').value, 'pale ash');
});

test('R8.6: changing the returned past Brain does not change the current Brain', () => {
  const { p } = setup();
  const past = getBrainAtVersion(p, 2);
  past.items[0].value = 'neon';
  assert.equal(getItem(p, 'item-1').value, 'pale ash');
});

test('an item created later does not appear in earlier versions', () => {
  const { p } = setup();
  createItem(p, { kind: 'layout', value: 'sofa', owner: 'Layout' }); // created after version 3
  assert.equal(getBrainAtVersion(p, 2).items.length, 2);
  assert.equal(getBrainAtVersion(p, 3).items.length, 3);
});

test('a version number that does not exist is rejected with a clear message', () => {
  const { p } = setup();
  assert.throws(() => getBrainAtVersion(p, 4), /Version 4 does not exist/);
  assert.throws(() => getBrainAtVersion(p, -1), /does not exist/);
  assert.throws(() => getBrainAtVersion(p, 'two'), /does not exist/);
});
