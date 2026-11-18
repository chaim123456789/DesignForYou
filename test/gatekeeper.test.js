import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';

function setup() {
  const p = createProject({ name: 'Test Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
  createItem(p, { kind: 'style', value: 'warm oak', owner: 'Style', status: 'Unsure' }); // item-1
  createItem(p, { kind: 'style', value: 'white walls', owner: 'Style', status: 'Locked' }); // item-2
  createItem(p, { kind: 'door', value: { wall: 'north' }, owner: 'Builder', status: 'Unsure' }); // item-3
  return { p, gate: createGatekeeper(p) };
}

test('R8.1: the owner changes an Unsure item and a version appears', () => {
  const { p, gate } = setup();
  const result = gate.changeItem('Style', 'item-1', 'pale ash');
  assert.equal(result.accepted, true);
  assert.equal(getItem(p, 'item-1').value, 'pale ash');
  const versions = listVersions(p);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].number, 1);
  assert.equal(versions[0].who, 'Style');
  assert.equal(versions[0].item, 'item-1');
  assert.equal(versions[0].oldValue, 'warm oak');
  assert.equal(versions[0].newValue, 'pale ash');
});

test('R5.1/R5.2: the owner is refused on a Locked item and the value is identical before and after', () => {
  const { p, gate } = setup();
  const before = structuredClone(getItem(p, 'item-2'));
  const result = gate.changeItem('Style', 'item-2', 'black walls');
  assert.equal(result.accepted, false);
  assert.deepEqual(getItem(p, 'item-2'), before);
  assert.equal(getItem(p, 'item-2').value, 'white walls');
  assert.equal(getItem(p, 'item-2').status, 'Locked');
});

test('check order: Locked is checked before owner, so a non-owner on a Locked item gets the Locked reason', () => {
  const { p, gate } = setup();
  const result = gate.changeItem('Layout', 'item-2', 'x');
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Locked/);
  assert.doesNotMatch(result.reason, /does not own/);
  assert.match(p.runLog[0].reason, /Locked/);
});

test('R4.4: a non-owner is refused on an Unsure item', () => {
  const { p, gate } = setup();
  const result = gate.changeItem('Layout', 'item-1', 'pale ash');
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Layout does not own item "item-1"\. Its owner is Style/);
  assert.equal(getItem(p, 'item-1').value, 'warm oak');
});

test('R5.3/R4.4: each refusal appears in the run log with agent, item and reason', () => {
  const { p, gate } = setup();
  gate.changeItem('Style', 'item-2', 'x'); // Locked, owner
  gate.changeItem('Layout', 'item-1', 'y'); // non-owner
  assert.equal(p.runLog.length, 2);
  for (const entry of p.runLog) {
    assert.equal(entry.event, 'refused');
    assert.ok(entry.agent);
    assert.ok(entry.item);
    assert.ok(entry.reason);
  }
  assert.deepEqual([p.runLog[0].agent, p.runLog[0].item], ['Style', 'item-2']);
  assert.deepEqual([p.runLog[1].agent, p.runLog[1].item], ['Layout', 'item-1']);
});

test('R8.4: refusals create no version', () => {
  const { p, gate } = setup();
  gate.changeItem('Style', 'item-2', 'x');
  gate.changeItem('Layout', 'item-1', 'y');
  gate.changeItem('Builder', 'item-2', 'z');
  assert.equal(listVersions(p).length, 0);
});

test('R8.4: an accepted change writes no run log refusal', () => {
  const { p, gate } = setup();
  gate.changeItem('Style', 'item-1', 'pale ash');
  assert.equal(p.runLog.length, 0);
});

test('R3.5/R5.4: a user unlocking an item makes it changeable and writes a version', () => {
  const { p, gate } = setup();
  assert.equal(gate.changeItem('Style', 'item-2', 'black walls').accepted, false);

  const unlock = gate.changeStatus('user', 'item-2', 'Unsure');
  assert.equal(unlock.accepted, true);
  assert.equal(getItem(p, 'item-2').status, 'Unsure');
  assert.equal(listVersions(p).length, 1);
  assert.deepEqual(
    [listVersions(p)[0].who, listVersions(p)[0].item, listVersions(p)[0].oldValue, listVersions(p)[0].newValue],
    ['user', 'item-2', 'Locked', 'Unsure']
  );

  assert.equal(gate.changeItem('Style', 'item-2', 'black walls').accepted, true);
  assert.equal(getItem(p, 'item-2').value, 'black walls');
  assert.equal(listVersions(p).length, 2);
});

test('R3.5: a user can lock an Unsure item, which writes a version, and then it is protected', () => {
  const { p, gate } = setup();
  assert.equal(gate.changeStatus('user', 'item-1', 'Locked').accepted, true);
  assert.equal(listVersions(p).length, 1);
  assert.equal(gate.changeItem('Style', 'item-1', 'x').accepted, false);
  assert.equal(getItem(p, 'item-1').value, 'warm oak');
});

test('R5.4: an agent cannot unlock an item, even its owner, and this is logged', () => {
  const { p, gate } = setup();
  const result = gate.changeStatus('Style', 'item-2', 'Unsure');
  assert.equal(result.accepted, false);
  assert.equal(getItem(p, 'item-2').status, 'Locked');
  assert.equal(listVersions(p).length, 0);
  assert.deepEqual([p.runLog[0].agent, p.runLog[0].item], ['Style', 'item-2']);
});

test('the user may change status only, not values', () => {
  const { p, gate } = setup();
  const result = gate.changeItem('user', 'item-1', 'pale ash');
  assert.equal(result.accepted, false);
  assert.equal(getItem(p, 'item-1').value, 'warm oak');
  assert.equal(listVersions(p).length, 0);
});

test('R8.1: version numbers rise by 1 across values and status changes', () => {
  const { p, gate } = setup();
  gate.changeItem('Style', 'item-1', 'a');
  gate.changeStatus('user', 'item-2', 'Unsure');
  gate.changeItem('Builder', 'item-3', { wall: 'south' });
  assert.deepEqual(listVersions(p).map((v) => v.number), [1, 2, 3]);
});

test('bad input: unknown item and unknown status are errors, not silent', () => {
  const { gate } = setup();
  assert.throws(() => gate.changeItem('Style', 'item-99', 'x'), /does not exist/);
  assert.throws(() => gate.changeStatus('user', 'item-1', 'Maybe'), /Use Locked or Unsure/);
});

test('the gatekeeper uses the given clock for version times', () => {
  const p = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'K' }] }] });
  createItem(p, { kind: 'style', value: 'a', owner: 'Style' });
  const gate = createGatekeeper(p, { now: () => '2026-01-01T00:00:00.000Z' });
  gate.changeItem('Style', 'item-1', 'b');
  assert.equal(listVersions(p)[0].time, '2026-01-01T00:00:00.000Z');
});
