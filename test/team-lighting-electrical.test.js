// design-team Group B, Task B4: the Lighting and electrical agent and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { runWithScript } from '../src/team-coordinator.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeWallsAgent } from '../src/agents/walls/agent.js';
import { makeDoorsWindowsAgent } from '../src/agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from '../src/agents/floors-ceilings/agent.js';
import {
  makeLightingElectricalAgent, loadLightingElectricalKnowledge, socketsInWetZones, wetZonesFor, ELECTRICAL_NOTICE,
} from '../src/agents/lighting-electrical/agent.js';
import { buildTeam, view, viewWithPoison, door, windowAt, NOW } from '../test-helpers/team-project.js';

const registry = loadRegistry();
const agent = makeLightingElectricalAgent();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';
const R2 = 'floor-1-room-2';
const LATER = ['layout', 'decor', 'style', 'clash'];
const off = (names) => names.map((name) => ({ name, enabled: false }));

// Run the three earlier agents so the lighting agent sees decided walls, doors and windows, and ceilings.
function earlier(spec) {
  const t = buildTeam(spec);
  const agents = { Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent(), 'Floors and ceilings': makeFloorsCeilingsAgent() };
  const r = runWithScript(t.project, { registry, now: NOW, agents, configs: off(['Lighting and electrical', 'Furniture', 'Decor', 'Style']) });
  assert.equal(r.ok, true);
  return t;
}
const forItem = (out, id) => out.find((p) => p.itemId === id);
const living = { rooms: [{ name: 'Living Room', width: 5, depth: 4 }, { name: 'Bathroom', width: 2.5, depth: 3 }], openings: [
  door(R1, 2, 0, { name: 'Front door' }), windowAt(R1, 1.5, 3.9), door(R2, 0.8, 0, { name: 'Bath door' }), windowAt(R2, 0.6, 2.9, 0.6)] };

test('design-team B4: every room with a door gets a switch near its door, with the draft notice', () => {
  const t = earlier(living);
  const out = agent(view(t.project), ctx);
  for (const [room, doorId] of [[R1, t.slots.openings[0]], [R2, t.slots.openings[2]]]) {
    const e = forItem(out, t.slots.electrical[room]).options[0].newValue;
    assert.equal(e.switches.length, 1, room);
    const sw = e.switches[0];
    assert.equal(sw.door, doorId);
    assert.equal(sw.side, 'north');
    const d = t.project.items.find((i) => i.id === doorId).value.position;
    // beside the door: on the same wall, a short way from the frame
    const gap = Math.min(Math.abs(sw.along - (d.x + d.width)), Math.abs(sw.along - d.x));
    assert.ok(gap > 0 && gap <= 0.25, `switch ${gap} m from the frame`);
    assert.equal(sw.height, 1.2);
    assert.equal(sw.rule, 'switch-by-door');
  }
});

test('design-team B4: the output says it is a draft for professional review and not an electrical design', () => {
  const t = earlier(living);
  const out = agent(view(t.project), ctx);
  assert.match(ELECTRICAL_NOTICE, /draft/i);
  assert.match(ELECTRICAL_NOTICE, /professional review/);
  assert.match(ELECTRICAL_NOTICE, /not an electrical design/);
  assert.ok(out.length >= 4);
  for (const p of out) assert.equal(p.options[0].newValue.notice, ELECTRICAL_NOTICE);
});

test('design-team B4: the number of sockets follows the wall length rule (one per stretch of free wall up to the spacing)', () => {
  // A 8 m by 3 m hall with no door or window on the long walls: each long wall holds one stretch of 7.4 m (0.3 m clear at both corners).
  const t = earlier({ rooms: [{ name: 'Hall', width: 8, depth: 3 }], openings: [door(R1, 0, 1, { width: 0.1, depth: 0.9, name: 'End door' }), windowAt(R1, 3, 2.9)] });
  // The door is a west-wall door; swap to a simple east/west check by building the item as the user would.
  const e = forItem(agent(view(t.project), ctx), t.slots.electrical[R1]).options[0].newValue;
  const per = (side) => e.sockets.filter((s) => s.side === side);
  // north: free 0.3..7.7 = 7.4 m -> ceil(7.4/3.6) = 3 sockets, evenly spaced
  assert.equal(per('north').length, 3);
  assert.deepEqual(per('north').map((s) => s.along), [1.533, 4, 6.467]);
  // south: a window 3..4.2 blocks 2.7..4.5, leaving 0.3..2.7 (2.4 m, 1 socket) and 4.5..7.7 (3.2 m, 1 socket)
  assert.deepEqual(per('south').map((s) => s.along), [1.5, 6.1]);
  // every socket is at the set height and keeps clear of the opening gaps
  assert.ok(e.sockets.every((s) => s.height === 0.45 && s.rule === 'sockets-spacing'));
  const total = e.sockets.length;
  // A wall twice as long would hold at least as many: the rule scales with length.
  const t2 = earlier({ rooms: [{ name: 'Hall', width: 16, depth: 3 }], openings: [door(R1, 0, 1, { width: 0.1, depth: 0.9 }), windowAt(R1, 3, 2.9)] });
  const e2 = forItem(agent(view(t2.project), ctx), t2.slots.electrical[R1]).options[0].newValue;
  assert.ok(e2.sockets.length > total);
});

test('design-team B4: sockets keep clear of doors, windows and corners', () => {
  const t = earlier(living);
  const e = forItem(agent(view(t.project), ctx), t.slots.electrical[R1]).options[0].newValue;
  const door = t.project.items.find((i) => i.id === t.slots.openings[0]).value.position;
  for (const s of e.sockets.filter((x) => x.side === 'north')) {
    assert.ok(s.along < door.x - 0.3 || s.along > door.x + door.width + 0.3, `socket at ${s.along}`);
  }
  assert.ok(e.sockets.every((s) => s.along >= 0.3));
});

test('design-team B4: no socket is proposed in a wet zone (a bathroom gets none), and it says why', () => {
  const t = earlier(living);
  const p = forItem(agent(view(t.project), ctx), t.slots.electrical[R2]);
  assert.equal(p.ruleId, 'electrical-wet-zone');
  const e = p.options[0].newValue;
  assert.deepEqual(e.sockets, []);
  assert.equal(e.switches.length, 1, 'the bathroom still gets its switch');
  assert.ok(e.notes.some((n) => /wet zone/.test(n)));
  assert.equal(e.wetZones.length, 1);
});

test('design-team B4: the agent\'s own check rejects a socket inside a wet zone, and a custom answer with one is refused', () => {
  const zones = wetZonesFor({ then: { zone: 'whole-room' } }, { width: 2.5, depth: 3 });
  const inside = { side: 'north', along: 1, position: { x: 1, y: 0, width: 0.08, depth: 0.05 } };
  assert.equal(socketsInWetZones([inside], zones).length, 1);
  assert.match(socketsInWetZones([inside], zones)[0], /inside a wet zone/);
  assert.deepEqual(socketsInWetZones([inside], []), []);
  // Through the Coordinator: a custom answer for the bathroom with a socket in the zone is refused.
  const t = earlier(living);
  const p = forItem(agent(view(t.project), ctx), t.slots.electrical[R2]);
  assert.match(agent.checkCustom(p, { sockets: [inside] }), /inside a wet zone/);
  assert.equal(agent.checkCustom(p, { sockets: [] }), true);
  assert.match(agent.checkCustom(p, { sockets: [{ side: 'north' }] }), /needs a position/);
  // The Coordinator refuses the answer (it throws, so the person can answer again) and writes nothing for that item.
  const before = JSON.stringify(t.project.items.find((i) => i.id === t.slots.electrical[R2]).value);
  assert.throws(() => runWithScript(t.project, { registry, now: NOW, agents: { 'Lighting and electrical': agent }, configs: off(['Furniture', 'Decor', 'Style']),
    policy: (pr) => (pr.itemId === t.slots.electrical[R2] ? { custom: { sockets: [inside] } } : 'first') }), /inside a wet zone/);
  assert.equal(JSON.stringify(t.project.items.find((i) => i.id === t.slots.electrical[R2]).value), before);
});

test('design-team B4: fixtures follow the light level and the room size, and the mount follows the ceiling height', () => {
  const t = earlier(living);
  const out = agent(view(t.project), ctx);
  const l = forItem(out, t.slots.lights[R1]);
  assert.equal(l.ruleId, 'lights-by-level');
  const v = l.options[0].newValue;
  assert.equal(v.lux, 150);
  assert.equal(v.area, 20);
  assert.equal(v.fixtures.length, Math.ceil((150 * 20) / (800 * 0.5)));
  assert.ok(v.fixtures.every((f) => f.position.x > 0 && f.position.x < 5 && f.position.y > 0 && f.position.y < 4));
  assert.ok(v.fixtures.every((f) => f.mount === 'flush or hanging'));
  // The kitchen aims higher than the living room, a bedroom lower.
  const k = earlier({ rooms: [{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Bedroom', width: 4, depth: 3 }], openings: [windowAt(R1, 1, 2.9), windowAt(R2, 1, 2.9)] });
  const ko = agent(view(k.project), ctx);
  assert.ok(forItem(ko, k.slots.lights[R1]).options[0].newValue.fixtures.length > forItem(ko, k.slots.lights[R2]).options[0].newValue.fixtures.length);
  // A low ceiling means flush lights only.
  const c = k.project.items.find((i) => i.id === k.slots.ceilings[R1]);
  c.value = { ...c.value, height: 2.3 };
  assert.ok(forItem(agent(view(k.project), ctx), k.slots.lights[R1]).options[0].newValue.fixtures.every((f) => f.mount === 'flush'));
});

test('design-team B4: with no ceiling decided yet there is no light proposal (it does not guess a height), but switches and sockets still get one', () => {
  const t = buildTeam({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 1, 0)] });
  const out = agent(view(t.project), ctx);
  assert.equal(forItem(out, t.slots.lights[R1]), undefined);
  assert.ok(forItem(out, t.slots.electrical[R1]));
});

test('design-team B4: a room with no door gets sockets and a note, not a switch', () => {
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [windowAt(R1, 1, 2.9)] });
  const e = forItem(agent(view(t.project), ctx), t.slots.electrical[R1]).options[0].newValue;
  assert.deepEqual(e.switches, []);
  assert.ok(e.notes.some((n) => /No door in this room yet/.test(n)));
  assert.ok(e.sockets.length > 0);
});

test('design-team B4: same input, same result; each result names its rule; Locked items are skipped; re-check looks at stale items only', () => {
  const t = earlier(living);
  const a = agent(view(t.project), ctx);
  assert.equal(JSON.stringify(a), JSON.stringify(makeLightingElectricalAgent(loadLightingElectricalKnowledge())(view(t.project), ctx)));
  assert.ok(a.every((p) => p.source === 'rule' && /^(lights|electrical)-/.test(p.ruleId) && p.agent === 'Lighting and electrical'));
  assert.deepEqual(agent(view(t.project), { mode: 'recheck', staleItemIds: [] }), []);
  assert.equal(agent(view(t.project), { mode: 'recheck', staleItemIds: [t.slots.lights[R1]] }).length, 1);
  t.project.items.find((i) => i.id === t.slots.lights[R1]).status = 'Locked';
  assert.equal(forItem(agent(view(t.project), ctx), t.slots.lights[R1]), undefined);
});

test('design-team B4: it never reads a later agent\'s item', () => {
  const t = earlier(living);
  const plain = agent(view(t.project), ctx);
  assert.ok(plain.length > 0);
  assert.equal(JSON.stringify(agent(viewWithPoison(t.project, LATER), ctx)), JSON.stringify(plain));
});

test('design-team B4: answered through the Coordinator, the values are written and a second pass proposes nothing', () => {
  const t = earlier(living);
  const r = runWithScript(t.project, { registry, now: NOW, agents: { 'Lighting and electrical': agent }, configs: off(['Furniture', 'Decor', 'Style']) });
  assert.equal(r.ok, true);
  assert.equal(t.project.items.find((i) => i.id === t.slots.electrical[R1]).value.switches.length, 1);
  assert.deepEqual(agent(view(t.project), ctx), []);
});

test('design-team B4: the lighting and electrical knowledge files pass the provenance test, say not checked, and the agent holds no rule number', () => {
  const dir = fileURLToPath(new URL('../src/knowledge/lighting-electrical/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, ['light-levels.json', 'socket-spacing.json', 'switch-placement.json', 'wet-zones.json']);
  for (const f of files) {
    const k = loadKnowledge(`lighting-electrical/${f}`);
    for (const s of k.provenance.sources) assert.equal(s.checked, 'not checked');
    for (const r of k.rules) assert.match(r.id, /^(lights|sockets|switch|wetzone)-/);
  }
  const text = readFileSync(new URL('../src/agents/lighting-electrical/agent.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(text, /\b(0\.05|0\.08|0\.15|0\.3|0\.45|3\.6|1\.2|800|2\.4)\b/);
  assert.doesNotMatch(text, /'(layout|decor|style|clash)'/);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../src/agents/lighting-electrical/agent.json', import.meta.url), 'utf8')), { name: 'Lighting and electrical', enabled: true });
});
