// design-team Group B, Task B5: the ripple across the first four agents.
// A made-up project goes through Walls, Doors and windows, Floors and ceilings and Lighting and electrical. Then the wall between
// the Kitchen and the Living Room is moved by a scripted answer, and the ripple must re-check exactly the right agents and items.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, runWithScript } from '../src/team-coordinator.js';
import { buildProposal } from '../src/proposal.js';
import { findStale, agentsToRecheck } from '../src/ripple.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeWallsAgent } from '../src/agents/walls/agent.js';
import { makeDoorsWindowsAgent } from '../src/agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from '../src/agents/floors-ceilings/agent.js';
import { makeLightingElectricalAgent } from '../src/agents/lighting-electrical/agent.js';
import { buildTeam, windowAt, NOW } from '../test-helpers/team-project.js';

const registry = loadRegistry();
const LATER_OFF = ['Furniture', 'Decor', 'Style'].map((name) => ({ name, enabled: false }));
const KITCHEN = 'floor-1-room-1';
const LIVING = 'floor-1-room-2';
const BEDROOM = 'floor-2-room-1'; // upstairs: nothing to do with the wall between the two rooms below

function project() {
  return buildTeam({
    floors: [
      { name: 'Ground', rooms: [{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Living Room', width: 5, depth: 3 }] },
      { name: 'Upper', rooms: [{ name: 'Bedroom', width: 4, depth: 3 }] },
    ],
    openings: [
      { kind: 'door', room: KITCHEN, name: 'Living room door', position: { x: 3.9, y: 1, width: 0.1, depth: 0.9 } },
      windowAt(KITCHEN, 1.4, 2.9),
      windowAt(LIVING, 1.9, 2.9),
      { kind: 'door', room: BEDROOM, name: 'Bedroom door', position: { x: 1.5, y: 0, width: 0.9, depth: 0.1 } },
      windowAt(BEDROOM, 1.4, 2.9),
    ],
  });
}
const realAgents = () => ({
  Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent(), 'Floors and ceilings': makeFloorsCeilingsAgent(), 'Lighting and electrical': makeLightingElectricalAgent(),
});
const itemsOfRoom = (p, room) => p.items.filter((i) => i.room === room).map((i) => i.id);
const staleIds = (p) => findStale(p, registry).stale.map((s) => s.itemId);
const ids = (...lists) => lists.flat().sort();

// A stand-in Walls agent for the second run: it moves the shared wall 0.3 m toward the Living Room (the Kitchen gets wider).
function wallMove(slots) {
  return (view) => {
    const make = (roomId, newWidth) => {
      const item = view.items.find((i) => i.id === slots.walls[roomId]);
      const v = structuredClone(item.value);
      v.size.width = newWidth;
      for (const s of v.segments) if (s.side === 'north' || s.side === 'south') s.length = newWidth;
      return buildProposal({
        id: `move:${item.id}`, agent: 'Walls', itemId: item.id, why: 'The wall between the two rooms is moved 0.3 m.', source: 'rule', ruleId: 'walls-segments-from-size',
        confidence: 'high', options: [{ id: 'moved', label: 'Moved wall', newValue: v }],
      }, { items: view.items.filter((i) => i.kind === 'wall') });
    };
    return [make(KITCHEN, 4.3), make(LIVING, 4.7)];
  };
}

test('design-team B5: the first run goes through the four agents in order, and nothing is left stale at the end', () => {
  const { project: p } = project();
  const r = runWithScript(p, { registry, now: NOW, agents: realAgents(), configs: LATER_OFF });
  assert.equal(r.ok, true);
  const started = p.runLog.filter((e) => e.event === 'started').map((e) => e.agent);
  assert.deepEqual(started.slice(0, 4), ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical']);
  assert.deepEqual(staleIds(p), []);
  assert.deepEqual(findStale(p, registry).errors, []);
  assert.ok(p.versions.every((v) => v.approvedBy === 'scripted answer'));
  // The threshold under the door between the Kitchen and the Living Room is on the Living Room floor.
  const floorB = p.items.find((i) => i.kind === 'floor' && i.room === LIVING);
  assert.equal(floorB.value.thresholds.length, 1);
});

test('design-team B5: after the wall move the door, both rooms\' floors and ceilings, and the lights are stale; the Bedroom upstairs is not', () => {
  const { project: p, slots } = project();
  runWithScript(p, { registry, now: NOW, agents: realAgents(), configs: LATER_OFF });
  const run = createRun(p, { registry, now: NOW, scripted: true, configs: LATER_OFF, agents: { ...realAgents(), Walls: wallMove(slots) } });
  const step = run.next();
  assert.equal(step.agent, 'Walls');
  assert.equal(step.proposals.length, 2);
  for (const pr of step.proposals) run.answer(pr.id, 'moved');

  const door = p.items.find((i) => i.kind === 'door' && i.room === KITCHEN).id;
  const stale = staleIds(p);
  const kind = (k, room) => p.items.filter((i) => i.kind === k && i.room === room).map((i) => i.id);
  // Stale: the Kitchen's door and window, the Living Room's window, both rooms' floors and ceilings, lights and electrical.
  assert.deepEqual(stale.slice().sort(), ids(
    kind('door', KITCHEN), kind('window', KITCHEN), kind('window', LIVING),
    kind('floor', KITCHEN), kind('floor', LIVING), kind('ceiling', KITCHEN), kind('ceiling', LIVING),
    kind('light', KITCHEN), kind('light', LIVING), kind('electrical', KITCHEN), kind('electrical', LIVING),
  ));
  assert.ok(stale.includes(door));
  // The two walls changed, so they are not stale themselves. Nothing of the Bedroom upstairs is stale.
  assert.ok(!stale.includes(slots.walls[KITCHEN]) && !stale.includes(slots.walls[LIVING]));
  assert.deepEqual(stale.filter((id) => itemsOfRoom(p, BEDROOM).includes(id)), []);

  // The agents to re-check: the middle three. Walls and the later agents (no items) are "Not affected", with the reason.
  const plan = agentsToRecheck(p, registry).agents;
  const by = Object.fromEntries(plan.map((a) => [a.agent, a]));
  assert.deepEqual(plan.filter((a) => a.recheck).map((a) => a.agent), ['Doors and windows', 'Floors and ceilings', 'Lighting and electrical']);
  assert.equal(by.Walls.reason, 'Not affected: nothing it depends on changed.');
  for (const name of ['Furniture', 'Decor', 'Style', 'Reviewer']) assert.equal(by[name].recheck, false, name);
  assert.deepEqual(by['Doors and windows'].itemIds.sort(), ids(kind('door', KITCHEN), kind('window', KITCHEN), kind('window', LIVING)));
  assert.match(by['Floors and ceilings'].reason, /stale because/);
});

test('design-team B5: the second run re-checks exactly those items, "still fine" adds a log line and no version, a changed answer adds a version with approvedBy and the basis', () => {
  const { project: p, slots } = project();
  runWithScript(p, { registry, now: NOW, agents: realAgents(), configs: LATER_OFF });
  const versionsBefore = p.versions.length;
  const logBefore = p.runLog.length;

  // Record what each agent was told to look at.
  const told = {};
  const wrap = (name, fn) => (view, context) => { told[name] = { mode: context.mode, stale: context.staleItemIds.slice().sort() }; return fn(view, context); };
  const agents = Object.fromEntries(Object.entries({ ...realAgents(), Walls: wallMove(slots) }).map(([n, f]) => [n, wrap(n, f)]));
  for (const [n, f] of Object.entries({ ...realAgents() })) if (f.checkCustom) agents[n].checkCustom = f.checkCustom;
  const result = runWithScript(p, { registry, now: NOW, agents, configs: LATER_OFF });
  assert.equal(result.ok, true);

  const kind = (k, room) => p.items.filter((i) => i.kind === k && i.room === room).map((i) => i.id);
  // Walls had nothing stale. The others were told exactly the stale items, in their own step.
  assert.deepEqual(told.Walls.stale, []);
  // (The Walls stand-in ran first, so the Doors agent was told the door and windows of the two rooms; not the Bedroom's.)
  assert.deepEqual(told['Doors and windows'].stale, ids(kind('door', KITCHEN), kind('window', KITCHEN), kind('window', LIVING)));
  assert.deepEqual(told['Floors and ceilings'].stale, ids(kind('floor', KITCHEN), kind('floor', LIVING), kind('ceiling', KITCHEN), kind('ceiling', LIVING)));
  assert.deepEqual(told['Lighting and electrical'].stale, ids(kind('light', KITCHEN), kind('light', LIVING), kind('electrical', KITCHEN), kind('electrical', LIVING)));
  assert.deepEqual(staleIds(p), [], 'nothing is left stale after the re-check');

  const newVersions = p.versions.slice(versionsBefore);
  const newLog = p.runLog.slice(logBefore);
  const changed = new Set(newVersions.map((v) => v.item));
  const stillFine = new Set(newLog.filter((e) => e.event === 'still-fine').map((e) => e.item));

  // Changed answers: the Kitchen door no longer touches the moved wall, and the lights and sockets follow the new room sizes.
  const door = kind('door', KITCHEN)[0];
  assert.ok(changed.has(door));
  const doorVersion = newVersions.find((v) => v.item === door);
  assert.equal(doorVersion.approvedBy, 'scripted answer');
  assert.equal(doorVersion.who, 'Doors and windows');
  assert.equal(doorVersion.newValue.position.x, 4.2, 'moved onto the new wall position');
  assert.deepEqual(doorVersion.basis.map((b) => b.itemId), [slots.walls[KITCHEN]]);
  assert.ok(doorVersion.basis[0].version >= versionsBefore + 2, 'the basis names the version of the moved wall');
  // Exactly these got a new version: the two walls, the door, and the lights and sockets of both rooms (their sizes changed).
  assert.deepEqual([...changed].sort(), ids(slots.walls[KITCHEN], slots.walls[LIVING], door, kind('light', KITCHEN), kind('light', LIVING), kind('electrical', KITCHEN), kind('electrical', LIVING)));
  for (const v of newVersions) { assert.equal(v.approvedBy, 'scripted answer'); assert.ok(Array.isArray(v.basis) || v.who === 'Walls'); }

  // Still fine: the two windows and the ceilings and floors. Each has a log line and no version.
  const expectedFine = ids(kind('window', KITCHEN), kind('window', LIVING), kind('ceiling', KITCHEN), kind('ceiling', LIVING), kind('floor', KITCHEN), kind('floor', LIVING));
  assert.deepEqual([...stillFine].sort(), expectedFine);
  for (const id of expectedFine) assert.ok(!changed.has(id), `${id} got a version although it was still fine`);
  assert.ok(newLog.filter((e) => e.event === 'still-fine').every((e) => /Re-checked after an earlier change/.test(e.reason)));

  // Nothing of the Bedroom upstairs was touched: no version, no still-fine line, no stale.
  for (const id of itemsOfRoom(p, BEDROOM)) {
    assert.ok(!changed.has(id) && !stillFine.has(id), id);
  }
});

test('design-team B5: the same scripted run twice gives the same versions and log', () => {
  const run = () => {
    const { project: p, slots } = project();
    runWithScript(p, { registry, now: NOW, agents: realAgents(), configs: LATER_OFF });
    runWithScript(p, { registry, now: NOW, agents: { ...realAgents(), Walls: wallMove(slots) }, configs: LATER_OFF });
    return JSON.stringify({ items: p.items, versions: p.versions, log: p.runLog });
  };
  assert.equal(run(), run());
});
