// design-team Group A, Task A2: new kinds, eight owners, basis / source / approvedBy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject, createItem, getItem, getBrainAtVersion, listVersions,
  TEAM_KIND_OWNER, KIND_OWNER, OWNERS, teamOwnerForKind, ownerForKind,
} from '../src/brain/brain.js';
import { createGatekeeper, USER } from '../src/brain/gatekeeper.js';
import { loadRegistry } from '../src/agents/registry.js';

const makeProject = () => createProject({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }, { name: 'Hall' }] }] });
const ROOM = 'floor-1-room-1';
const NEW_KINDS = {
  wall: 'Walls', door: 'Doors and windows', window: 'Doors and windows', floor: 'Floors and ceilings', ceiling: 'Floors and ceilings',
  light: 'Lighting and electrical', electrical: 'Lighting and electrical', layout: 'Furniture', decor: 'Decor', style: 'Style', clash: 'Reviewer',
};

test('design-team A2: each kind has the right owner in the design team', () => {
  for (const [kind, owner] of Object.entries(NEW_KINDS)) {
    assert.equal(teamOwnerForKind(kind), owner, kind);
    const item = createItem(makeProject(), { kind, owner, value: { n: 1 }, room: ROOM });
    assert.equal(item.owner, owner);
  }
  assert.deepEqual(TEAM_KIND_OWNER, NEW_KINDS);
  assert.throws(() => teamOwnerForKind('sofa'), /Unknown kind/);
});

test('design-team A2: every owner in the registry can own something, and OWNERS holds all eight plus the old names', () => {
  const reg = loadRegistry();
  for (const name of reg.order) assert.ok(OWNERS.includes(name), `${name} should be an allowed owner`);
  for (const old of ['Layout', 'Builder']) assert.ok(OWNERS.includes(old));
  const used = new Set(Object.values(TEAM_KIND_OWNER));
  assert.deepEqual([...used].sort(), [...reg.order].sort(), 'the eight agents own the kinds between them');
});

test('design-team A2: the old kinds and owners are unchanged (old projects load)', () => {
  assert.equal(Object.keys(KIND_OWNER).length, 5);
  assert.equal(ownerForKind('layout'), 'Layout');
  assert.equal(ownerForKind('door'), 'Builder');
  assert.throws(() => ownerForKind('wall'), /Unknown kind/);
  const p = makeProject();
  assert.equal(createItem(p, { kind: 'layout', owner: 'Layout', value: 'Sofa', room: ROOM }).owner, 'Layout');
  assert.equal(createItem(p, { kind: 'door', owner: 'Builder', value: 'Door', room: ROOM }).owner, 'Builder');
  const old = p.items[0];
  assert.deepEqual(Object.keys(old).sort(), ['id', 'kind', 'owner', 'room', 'status', 'value']);
});

test('design-team A2: an item with no owner, two owners, an unknown owner or the wrong owner is rejected', () => {
  const p = makeProject();
  assert.throws(() => createItem(p, { kind: 'wall', value: 'x' }), /needs an owner/);
  assert.throws(() => createItem(p, { kind: 'wall', value: 'x', owner: ['Walls', 'Decor'] }), /exactly one owner/);
  assert.throws(() => createItem(p, { kind: 'wall', value: 'x', owner: 'Plumber' }), /is not an agent/);
  assert.throws(() => createItem(p, { kind: 'wall', value: 'x', owner: 'Decor' }), /owned by Walls, not Decor/);
  assert.throws(() => createItem(p, { kind: 'decor', value: 'x', owner: 'Walls' }), /owned by Decor, not Walls/);
  assert.throws(() => createItem(p, { kind: 'pipe', value: 'x', owner: 'Walls' }), /Unknown kind/);
  assert.equal(p.items.length, 0);
});

test('design-team A2: status is optional and defaults to Unsure', () => {
  const p = makeProject();
  assert.equal(createItem(p, { kind: 'wall', owner: 'Walls', value: 'w' }).status, 'Unsure');
  assert.equal(createItem(p, { kind: 'wall', owner: 'Walls', value: 'w', status: 'Locked' }).status, 'Locked');
});

test('design-team A2: Locked is still refused before the owner check, for a new kind', () => {
  const p = makeProject();
  const wall = createItem(p, { kind: 'wall', owner: 'Walls', value: { x: 1 }, status: 'Locked' });
  const gate = createGatekeeper(p);
  const byOwner = gate.changeItem('Walls', wall.id, { x: 2 });
  assert.equal(byOwner.accepted, false);
  assert.match(byOwner.reason, /is Locked/);
  const byOther = gate.changeItem('Decor', wall.id, { x: 3 });
  assert.match(byOther.reason, /is Locked/, 'a non-owner gets the Locked reason first');
  assert.deepEqual(getItem(p, wall.id).value, { x: 1 });
  assert.equal(p.versions.length, 0);
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 2);
});

test('design-team A2: a write by the wrong agent is refused and logged, and writes no version', () => {
  const p = makeProject();
  const wall = createItem(p, { kind: 'wall', owner: 'Walls', value: { x: 1 } });
  const gate = createGatekeeper(p);
  const r = gate.changeItem('Furniture', wall.id, { x: 9 }, { approvedBy: 'user' });
  assert.equal(r.accepted, false);
  assert.match(r.reason, /Furniture does not own item "item-1". Its owner is Walls/);
  assert.deepEqual(p.runLog[0], { agent: 'Furniture', event: 'refused', item: wall.id, reason: r.reason });
  assert.equal(p.versions.length, 0);
  assert.deepEqual(wall.value, { x: 1 });
});

test('design-team A2: a version record holds approvedBy and basis, and the item holds its latest basis', () => {
  const p = makeProject();
  const wall = createItem(p, { kind: 'wall', owner: 'Walls', value: { len: 400 } });
  const door = createItem(p, { kind: 'door', owner: 'Doors and windows', value: { at: 100 }, basis: [{ itemId: wall.id, version: 0 }], source: 'rule' });
  assert.deepEqual(door.basis, [{ itemId: wall.id, version: 0 }]);
  assert.equal(door.source, 'rule');
  const gate = createGatekeeper(p, { now: () => '2026-01-01T00:00:00.000Z' });
  assert.equal(gate.changeItem('Walls', wall.id, { len: 420 }, { approvedBy: 'user' }).accepted, true);
  const r = gate.changeItem('Doors and windows', door.id, { at: 110 }, { approvedBy: 'scripted answer', basis: [{ itemId: wall.id, version: 1 }] });
  assert.equal(r.accepted, true);
  const [v1, v2] = listVersions(p);
  assert.equal(v1.approvedBy, 'user');
  assert.equal('basis' in v1, false);
  assert.equal(v2.approvedBy, 'scripted answer');
  assert.deepEqual(v2.basis, [{ itemId: wall.id, version: 1 }]);
  assert.equal(v2.who, 'Doors and windows');
  assert.deepEqual(getItem(p, door.id).basis, [{ itemId: wall.id, version: 1 }]);
  assert.ok(Object.isFrozen(p.versions[1]));
});

test('design-team A2: a bad basis or approver is rejected and nothing changes', () => {
  const p = makeProject();
  const wall = createItem(p, { kind: 'wall', owner: 'Walls', value: 1 });
  const gate = createGatekeeper(p);
  assert.throws(() => createItem(p, { kind: 'door', owner: 'Doors and windows', value: 1, basis: [{ itemId: 'item-99', version: 0 }] }), /does not exist/);
  assert.throws(() => createItem(p, { kind: 'door', owner: 'Doors and windows', value: 1, basis: [{ itemId: wall.id, version: 5 }] }), /version 5, which does not exist yet/);
  assert.throws(() => createItem(p, { kind: 'door', owner: 'Doors and windows', value: 1, basis: 'x' }), /must be a list/);
  assert.throws(() => createItem(p, { kind: 'door', owner: 'Doors and windows', value: 1, source: 'magic' }), /Source "magic"/);
  assert.throws(() => gate.changeItem('Walls', wall.id, 2, { approvedBy: 'the cat' }), /not allowed/);
  assert.throws(() => gate.changeItem('Walls', wall.id, 2, { basis: [{ itemId: wall.id, version: 0 }] }), /cannot be based on itself/);
  assert.equal(wall.value, 1);
  assert.equal(p.versions.length, 0);
});

test('design-team A2: past versions show the basis as it was then', () => {
  const p = makeProject();
  const wall = createItem(p, { kind: 'wall', owner: 'Walls', value: 1 });
  const door = createItem(p, { kind: 'door', owner: 'Doors and windows', value: 'a', basis: [{ itemId: wall.id, version: 0 }] });
  const gate = createGatekeeper(p);
  gate.changeItem('Walls', wall.id, 2, { approvedBy: 'user' });
  gate.changeItem('Doors and windows', door.id, 'b', { approvedBy: 'user', basis: [{ itemId: wall.id, version: 1 }] });
  assert.deepEqual(getBrainAtVersion(p, 0).items[1].basis, [{ itemId: wall.id, version: 0 }]);
  assert.deepEqual(getBrainAtVersion(p, 1).items[1].basis, [{ itemId: wall.id, version: 0 }]);
  assert.deepEqual(getBrainAtVersion(p, 2).items[1].basis, [{ itemId: wall.id, version: 1 }]);
  assert.equal(getBrainAtVersion(p, 2).items[1].value, 'b');
  assert.equal('basis' in getBrainAtVersion(p, 2).items[0], false);
});

test('design-team A2: only the user can change a status, as before', () => {
  const p = makeProject();
  const wall = createItem(p, { kind: 'wall', owner: 'Walls', value: 1 });
  const gate = createGatekeeper(p);
  assert.equal(gate.changeStatus('Walls', wall.id, 'Locked').accepted, false);
  assert.equal(gate.changeStatus(USER, wall.id, 'Locked').accepted, true);
  assert.equal(gate.changeItem('Walls', wall.id, 5).accepted, false);
});

test('design-team A2: bad details on a Locked item or a wrong owner give a refusal, not an error (refusals come first)', () => {
  const p = makeProject();
  const locked = createItem(p, { kind: 'wall', owner: 'Walls', value: 1, status: 'Locked' });
  const open = createItem(p, { kind: 'wall', owner: 'Walls', value: 1 });
  const gate = createGatekeeper(p);
  const bad = { approvedBy: 'the cat', basis: 'x' };
  assert.equal(gate.changeItem('Walls', locked.id, 2, bad).accepted, false);
  assert.equal(gate.changeItem('Decor', open.id, 2, bad).accepted, false);
  assert.equal(p.versions.length, 0);
});
