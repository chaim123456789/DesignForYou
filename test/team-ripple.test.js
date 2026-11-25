// design-team Group A, Task A5: basis, stale items and which agents re-check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem } from '../src/brain/brain.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';
import { findStale, agentsToRecheck } from '../src/ripple.js';
import { loadRegistry } from '../src/agents/registry.js';

const reg = loadRegistry();
const KITCHEN = 'floor-1-room-1';
const HALL = 'floor-1-room-2';

// A small made-up project. Kitchen: wall, door, floor, light, sofa, rug, style note. Hall: its own wall, floor and rug.
function build() {
  const p = createProject({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }, { name: 'Hall' }] }] });
  const add = (kind, owner, room, basisIds = [], value = { n: kind }) => createItem(p, {
    kind, owner, room, value, basis: basisIds.map((itemId) => ({ itemId, version: 0 })),
  }).id;
  const ids = {};
  ids.wallK = add('wall', 'Walls', KITCHEN);
  ids.door = add('door', 'Doors and windows', KITCHEN, [ids.wallK]);
  ids.floorK = add('floor', 'Floors and ceilings', KITCHEN, [ids.wallK, ids.door]);
  ids.light = add('light', 'Lighting and electrical', KITCHEN, [ids.wallK, ids.door, ids.floorK]);
  ids.sofa = add('layout', 'Furniture', KITCHEN, [ids.wallK, ids.door, ids.light]);
  ids.rug = add('decor', 'Decor', KITCHEN, [ids.sofa]);
  ids.styleK = add('style', 'Style', KITCHEN, [ids.rug]);
  ids.wallH = add('wall', 'Walls', HALL);
  ids.floorH = add('floor', 'Floors and ceilings', HALL, [ids.wallH]);
  ids.rugH = add('decor', 'Decor', HALL, [ids.wallH]);
  ids.styleH = add('style', 'Style', HALL, [ids.rugH]);
  return { p, ids, gate: createGatekeeper(p) };
}
const staleIds = (p) => findStale(p, reg).stale.map((s) => s.itemId);

test('design-team A5: nothing is stale before anything changes', () => {
  const { p } = build();
  assert.deepEqual(findStale(p, reg), { stale: [], errors: [] });
  assert.ok(agentsToRecheck(p, reg).agents.every((a) => a.recheck === false));
});

test('design-team A5: moving a wall makes the door, floor, light, furniture, decor and style items based on it stale', () => {
  const { p, ids, gate } = build();
  assert.equal(gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' }).accepted, true);
  assert.deepEqual(staleIds(p), [ids.door, ids.floorK, ids.light, ids.sofa, ids.rug, ids.styleK]);
});

test('design-team A5: items in an unrelated room are not stale', () => {
  const { p, ids, gate } = build();
  gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' });
  const stale = staleIds(p);
  for (const other of [ids.wallH, ids.floorH, ids.rugH, ids.styleH]) assert.ok(!stale.includes(other), other);
});

test('design-team A5: stale items follow a chain, so decor based only on furniture is stale after a wall change', () => {
  const { p, ids, gate } = build();
  gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' });
  const rug = findStale(p, reg).stale.find((s) => s.itemId === ids.rug);
  assert.deepEqual(rug.because, [{ itemId: ids.sofa, why: `"${ids.sofa}" is itself stale.` }]);
  const door = findStale(p, reg).stale.find((s) => s.itemId === ids.door);
  assert.match(door.because[0].why, /changed in version 1, after version 0/);
});

test('design-team A5: changing a decor item makes only Style (and the Reviewer\'s) items stale', () => {
  const { p, ids, gate } = build();
  const report = createItem(p, { kind: 'clash', owner: 'Reviewer', value: [], basis: [{ itemId: ids.rug, version: 0 }, { itemId: ids.styleK, version: 0 }] }).id;
  gate.changeItem('Decor', ids.rug, { rug: 'bigger' }, { approvedBy: 'user' });
  assert.deepEqual(staleIds(p), [ids.styleK, report]);
  const owners = agentsToRecheck(p, reg).agents.filter((a) => a.recheck).map((a) => a.agent);
  assert.deepEqual(owners, ['Style', 'Reviewer']);
});

test('design-team A5: agentsToRecheck lists all eight agents in order, each with a reason', () => {
  const { p, ids, gate } = build();
  gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' });
  const { agents, errors } = agentsToRecheck(p, reg);
  assert.deepEqual(errors, []);
  assert.deepEqual(agents.map((a) => a.agent), [...reg.order]);
  const summary = Object.fromEntries(agents.map((a) => [a.agent, a.recheck]));
  assert.deepEqual(summary, {
    Walls: false, 'Doors and windows': true, 'Floors and ceilings': true, 'Lighting and electrical': true,
    Furniture: true, Decor: true, Style: true, Reviewer: false,
  });
  assert.deepEqual(agents[1].itemIds, [ids.door]);
  assert.match(agents[1].reason, /^Re-check 1 item: item-2 is stale because "item-1" changed in version 1/);
});

test('design-team A5: an agent with nothing stale is reported "Not affected" with a reason', () => {
  const { p, ids, gate } = build();
  gate.changeItem('Decor', ids.rug, { rug: 'bigger' }, { approvedBy: 'user' });
  const { agents } = agentsToRecheck(p, reg);
  for (const a of agents.filter((x) => !x.recheck)) {
    assert.equal(a.reason, 'Not affected: nothing it depends on changed.');
    assert.deepEqual(a.itemIds, []);
  }
  assert.equal(agents.find((a) => a.agent === 'Walls').recheck, false);
  assert.equal(agents.find((a) => a.agent === 'Style').recheck, true);
});

test('design-team A5: refreshing a basis (as a "still fine" re-check does) makes the item not stale', () => {
  const { p, ids, gate } = build();
  gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' });
  const door = p.items.find((i) => i.id === ids.door);
  door.basis = [{ itemId: ids.wallK, version: 1 }]; // what the Coordinator will do on "still fine" (Task A6)
  assert.ok(!staleIds(p).includes(ids.door));
});

test('design-team A5: a Locked stale item is flagged locked, and nothing is changed by looking', () => {
  const { p, ids, gate } = build();
  p.items.find((i) => i.id === ids.light).status = 'Locked';
  gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' });
  const before = JSON.stringify(p);
  const light = findStale(p, reg).stale.find((s) => s.itemId === ids.light);
  assert.equal(light.locked, true);
  assert.equal(JSON.stringify(p), before);
});

test('design-team A5: a backwards basis is reported as an error and not followed', () => {
  const { p, ids } = build();
  p.items.find((i) => i.id === ids.wallK).basis = [{ itemId: ids.sofa, version: 0 }]; // a wall based on furniture
  const { errors } = findStale(p, reg);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].itemId, ids.wallK);
  assert.match(errors[0].message, /\(Walls\) is based on "item-5" \(Furniture\), which belongs to a later agent/);
  assert.equal(agentsToRecheck(p, reg).errors.length, 1);
});

test('design-team A5: a basis on a missing item, on itself, or on an agent outside the team is an error', () => {
  const { p, ids } = build();
  p.items.find((i) => i.id === ids.door).basis = [{ itemId: 'item-99', version: 0 }];
  p.items.find((i) => i.id === ids.floorK).basis = [{ itemId: ids.floorK, version: 0 }];
  const old = createItem(p, { kind: 'layout', owner: 'Layout', value: 'old' });
  p.items.find((i) => i.id === ids.light).basis = [{ itemId: old.id, version: 0 }];
  const msgs = findStale(p, reg).errors.map((e) => e.message);
  assert.ok(msgs.some((m) => /"item-99", which does not exist/.test(m)));
  assert.ok(msgs.some((m) => /is based on itself/.test(m)));
  assert.ok(msgs.some((m) => /owned by Layout, which is not in the design team/.test(m)));
});

test('design-team A5: a loop of bases inside one agent is reported, not followed forever', () => {
  const { p, ids } = build();
  const a = createItem(p, { kind: 'decor', owner: 'Decor', value: 1, room: KITCHEN }).id;
  const b = createItem(p, { kind: 'decor', owner: 'Decor', value: 1, room: KITCHEN }).id;
  p.items.find((i) => i.id === a).basis = [{ itemId: b, version: 0 }];
  p.items.find((i) => i.id === b).basis = [{ itemId: a, version: 0 }];
  const { errors } = findStale(p, reg);
  assert.ok(errors.some((e) => /loop of bases/.test(e.message)));
  assert.ok(ids);
});

test('design-team A5: the basis is kept on the item, outside the version list', () => {
  const { p, ids, gate } = build();
  gate.changeItem('Walls', ids.wallK, { moved: 20 }, { approvedBy: 'user' });
  assert.deepEqual(p.items.find((i) => i.id === ids.door).basis, [{ itemId: ids.wallK, version: 0 }]);
  assert.equal(p.versions.length, 1);
  assert.equal('basis' in p.versions[0], false);
});

test('design-team A5: old projects with no basis anywhere have nothing stale', () => {
  const p = createProject({ name: 'Old', floors: [{ name: 'G', rooms: [{ name: 'K' }] }] });
  const i = createItem(p, { kind: 'layout', owner: 'Layout', value: 'sofa' });
  createGatekeeper(p).changeItem('Layout', i.id, 'sofa2');
  assert.deepEqual(findStale(p, reg), { stale: [], errors: [] });
});
