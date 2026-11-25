// design-team Group B, Task B3: the Floors and ceilings agent and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { runWithScript } from '../src/team-coordinator.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeWallsAgent } from '../src/agents/walls/agent.js';
import { makeDoorsWindowsAgent } from '../src/agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent, loadFloorsCeilingsKnowledge } from '../src/agents/floors-ceilings/agent.js';
import { buildTeam, view, viewWithPoison, door, windowAt, NOW } from '../test-helpers/team-project.js';

const registry = loadRegistry();
const agent = makeFloorsCeilingsAgent();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';
const R2 = 'floor-1-room-2';
const LATER = ['light', 'electrical', 'layout', 'decor', 'style', 'clash'];

// Run the earlier agents (Walls, then Doors and windows) so the floors agent sees their decisions.
function earlier(spec) {
  const t = buildTeam(spec);
  const agents = { Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent() };
  const r = runWithScript(t.project, { registry, now: NOW, agents, configs: registry.order.slice(2).map((name) => ({ name, enabled: false })) });
  assert.equal(r.ok, true);
  return t;
}
const forItem = (out, id) => out.find((p) => p.itemId === id);

test('design-team B3: a bathroom is offered wet-safe surfaces only, and says why', () => {
  const t = earlier({ rooms: [{ name: 'Bathroom', width: 2.5, depth: 2.5 }] });
  const p = forItem(agent(view(t.project), ctx), t.slots.floors[R1]);
  assert.equal(p.ruleId, 'floors-wet-safe-surface');
  assert.match(p.why, /wet room/);
  const real = p.options.slice(0, -1);
  assert.ok(real.length >= 1);
  assert.ok(real.every((o) => o.newValue.wetSafe === true));
  assert.equal(p.options.at(-1).id, 'custom');
});

test('design-team B3: all wet rooms (kitchen, toilet, utility) get only wet-safe options; a bedroom may get a dry one', () => {
  const t = earlier({ rooms: [{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Toilet', width: 1.5, depth: 1.5 }, { name: 'Utility', width: 2, depth: 2 }, { name: 'Bedroom', width: 4, depth: 3 }] });
  const out = agent(view(t.project), ctx);
  for (const room of ['floor-1-room-1', 'floor-1-room-2', 'floor-1-room-3']) {
    const p = forItem(out, t.slots.floors[room]);
    assert.ok(p.options.slice(0, -1).every((o) => o.newValue.wetSafe), room);
  }
  const bed = forItem(out, t.slots.floors['floor-1-room-4']);
  assert.equal(bed.options[0].newValue.surface, 'carpet');
  assert.equal(bed.options[0].newValue.wetSafe, false);
});

test('design-team B3: a threshold sits under a door between two rooms with different surfaces', () => {
  // A bedroom (west) and a bathroom (east). The door is on the bedroom's east wall.
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }, { name: 'Bathroom', width: 2.5, depth: 3 }], openings: [
    { kind: 'door', room: R1, name: 'Bathroom door', position: { x: 3.9, y: 1, width: 0.1, depth: 0.9 } }, windowAt(R1, 1.4, 2.9), windowAt(R2, 0.8, 2.9)] });
  const first = runWithScript(t.project, { registry, now: NOW, agents: { 'Floors and ceilings': agent }, configs: [{ name: 'Lighting and electrical', enabled: false }, { name: 'Furniture', enabled: false }, { name: 'Decor', enabled: false }, { name: 'Style', enabled: false }] });
  assert.equal(first.ok, true);
  const bath = t.project.items.find((i) => i.id === t.slots.floors[R2]);
  assert.equal(bath.value.surface, 'ceramic tile');
  assert.equal(bath.value.thresholds.length, 1, 'one threshold, kept on the floor of the later room');
  const th = bath.value.thresholds[0];
  assert.equal(th.door, t.slots.openings[0]);
  assert.deepEqual(th.between, ['carpet', 'ceramic tile']);
  assert.equal(th.type, 'water bar', 'a dry floor meets a wet-safe one');
  assert.equal(th.maxHeight, 0.015);
  assert.match(th.rule, /^thresholds-/);
  // The bedroom's floor holds no threshold: the door's threshold has one owner.
  const bed = t.project.items.find((i) => i.id === t.slots.floors[R1]);
  assert.deepEqual(bed.value.thresholds, []);
});

test('design-team B3: a surface change at a door gets a plain strip; with no door between two rooms there is no threshold', () => {
  const same = earlier({ rooms: [{ name: 'Hall', width: 2, depth: 3 }, { name: 'Study', width: 3, depth: 3 }], openings: [
    { kind: 'door', room: R1, name: 'Study door', position: { x: 1.9, y: 1, width: 0.1, depth: 0.9 } }, windowAt(R1, 0.5, 2.9), windowAt(R2, 1, 2.9)] });
  const out = agent(view(same.project), ctx);
  // Hall: ceramic tile first. Study (type "other"): oak floorboards first. They differ, so there IS a threshold here.
  assert.equal(forItem(out, same.slots.floors[R2]).options[0].newValue.thresholds.length, 1);
  assert.equal(forItem(out, same.slots.floors[R2]).options[0].newValue.thresholds[0].type, 'threshold strip');
  // Two rooms with no door between them: no threshold.
  const none = earlier({ rooms: [{ name: 'Hall', width: 2, depth: 3 }, { name: 'Study', width: 3, depth: 3 }], openings: [windowAt(R1, 0.5, 2.9), windowAt(R2, 1, 2.9)] });
  assert.deepEqual(forItem(agent(view(none.project), ctx), none.slots.floors[R2]).options[0].newValue.thresholds, []);
});

test('design-team B3: a low ceiling is flagged with two options, and a normal one is not', () => {
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }, { name: 'Hall', width: 2, depth: 3 }] });
  t.project.items.find((i) => i.id === t.slots.ceilings[R1]).value = { name: 'Ceiling of Bedroom', height: 2.0, type: 'flat' };
  const out = agent(view(t.project), ctx);
  const low = forItem(out, t.slots.ceilings[R1]);
  assert.equal(low.ruleId, 'ceilings-below-minimum');
  assert.equal(low.confidence, 'low');
  assert.deepEqual(low.options.map((o) => o.id), ['raise-to-minimum', 'keep-flagged', 'custom']);
  assert.equal(low.options[0].newValue.height, 2.3);
  assert.match(low.options[1].newValue.flag, /Lower than the usual 2\.3 m for a bedroom/);
  // The hall's ceiling follows its wall height (2.4 m), which is above the hall minimum: no flag.
  const hall = forItem(out, t.slots.ceilings[R2]);
  assert.equal(hall.ruleId, 'ceilings-height-from-walls');
  assert.equal(hall.options[0].newValue.height, 2.4);
  assert.equal(hall.options[0].newValue.flag, undefined);
});

test('design-team B3: walls lower than the usual ceiling minimum make the proposed ceiling a flagged choice', () => {
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }] });
  const wall = t.project.items.find((i) => i.id === t.slots.walls[R1]);
  wall.value = { ...wall.value, segments: wall.value.segments.map((s) => ({ ...s, height: 2.0 })) };
  const p = forItem(agent(view(t.project), ctx), t.slots.ceilings[R1]);
  assert.equal(p.ruleId, 'ceilings-below-minimum');
  assert.equal(p.options.length, 3);
});

test('design-team B3: before the walls are decided there is no ceiling proposal (it does not guess a height)', () => {
  const t = buildTeam({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }] });
  const out = agent(view(t.project), ctx);
  assert.equal(forItem(out, t.slots.ceilings[R1]), undefined);
  assert.ok(forItem(out, t.slots.floors[R1]), 'the floor surface can still be proposed from the room type');
});

test('design-team B3: same input, same result', () => {
  const spec = { rooms: [{ name: 'Bedroom', width: 4, depth: 3 }, { name: 'Bathroom', width: 2.5, depth: 3 }], openings: [{ kind: 'door', room: R1, name: 'D', position: { x: 3.9, y: 1, width: 0.1, depth: 0.9 } }] };
  const a = agent(view(earlier(spec).project), ctx);
  const b = makeFloorsCeilingsAgent(loadFloorsCeilingsKnowledge())(view(earlier(spec).project), ctx);
  assert.ok(a.length >= 4);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.every((p) => p.source === 'rule' && /^(floors|ceilings)-/.test(p.ruleId) && p.agent === 'Floors and ceilings'));
});

test('design-team B3: it never reads a later agent\'s item', () => {
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }, { name: 'Bathroom', width: 2.5, depth: 3 }], openings: [{ kind: 'door', room: R1, name: 'D', position: { x: 3.9, y: 1, width: 0.1, depth: 0.9 } }] });
  const plain = agent(view(t.project), ctx);
  assert.ok(plain.length > 0);
  assert.equal(JSON.stringify(agent(viewWithPoison(t.project, LATER), ctx)), JSON.stringify(plain));
});

test('design-team B3: a decided floor is asked about again only when its thresholds change (re-check), and a dry surface in a wet room is flagged', () => {
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }, { name: 'Bathroom', width: 2.5, depth: 3 }], openings: [{ kind: 'door', room: R1, name: 'D', position: { x: 3.9, y: 1, width: 0.1, depth: 0.9 } }] });
  const done = runWithScript(t.project, { registry, now: NOW, agents: { 'Floors and ceilings': agent }, configs: [{ name: 'Lighting and electrical', enabled: false }, { name: 'Furniture', enabled: false }, { name: 'Decor', enabled: false }, { name: 'Style', enabled: false }] });
  assert.equal(done.ok, true);
  assert.deepEqual(agent(view(t.project), ctx), [], 'everything is decided: nothing more to propose');
  // The bedroom's surface is changed: the threshold under the shared door must follow.
  const bed = t.project.items.find((i) => i.id === t.slots.floors[R1]);
  bed.value = { ...bed.value, surface: 'ceramic tile', wetSafe: true };
  const out = agent(view(t.project), ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].itemId, t.slots.floors[R2]);
  assert.equal(out[0].ruleId, 'floors-threshold');
  assert.deepEqual(out[0].options[0].newValue.thresholds, []);
  // A dry surface typed into the bathroom is flagged.
  const bath = t.project.items.find((i) => i.id === t.slots.floors[R2]);
  bath.value = { ...bath.value, surface: 'carpet', wetSafe: false };
  const flagged = agent(view(t.project), ctx).find((p) => p.itemId === bath.id);
  assert.equal(flagged.ruleId, 'floors-wet-safe-surface');
  assert.match(flagged.why, /carpet is not wet-safe/);
});

test('design-team B3: a Locked floor or ceiling is not proposed to', () => {
  const t = earlier({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }] });
  for (const id of [t.slots.floors[R1], t.slots.ceilings[R1]]) t.project.items.find((i) => i.id === id).status = 'Locked';
  assert.deepEqual(agent(view(t.project), ctx), []);
});

test('design-team B3: a custom answer is a surface name or a ceiling height above 0', () => {
  assert.equal(agent.checkCustom({}, { surface: 'cork' }), true);
  assert.equal(agent.checkCustom({}, { height: 2.5 }), true);
  assert.match(agent.checkCustom({}, { height: 0 }), /above 0/);
  assert.match(agent.checkCustom({}, { surface: ' ' }), /needs a name/);
  assert.match(agent.checkCustom({}, { colour: 'red' }), /needs a "surface"/);
});

test('design-team B3: the floors and ceilings knowledge files pass the provenance test, say not checked, and the agent holds no rule number', () => {
  const dir = fileURLToPath(new URL('../src/knowledge/floors-ceilings/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, ['ceiling-heights.json', 'floor-surfaces-by-room.json', 'thresholds.json']);
  for (const f of files) {
    const k = loadKnowledge(`floors-ceilings/${f}`);
    for (const s of k.provenance.sources) assert.equal(s.checked, 'not checked');
    for (const r of k.rules) assert.match(r.id, /^(floors|ceilings|thresholds)-/);
  }
  const text = readFileSync(new URL('../src/agents/floors-ceilings/agent.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(text, /\b(0\.05|0\.015|2\.1|2\.3|2\.4)\b/);
  assert.doesNotMatch(text, /'(light|electrical|layout|decor|style|clash)'/);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../src/agents/floors-ceilings/agent.json', import.meta.url), 'utf8')), { name: 'Floors and ceilings', enabled: true });
});

test('design-team B3: even if the knowledge file listed a dry surface for a wet room, the agent offers wet-safe ones only', () => {
  const k = loadFloorsCeilingsKnowledge();
  const dirty = {
    ...k, surfaces: k.surfaces.map((r) => (r.when.roomType === 'bathroom' ? { ...r, then: { surfaces: [{ name: 'carpet', wetSafe: false }, { name: 'vinyl', wetSafe: true }] } } : r)),
  };
  const t = earlier({ rooms: [{ name: 'Bathroom', width: 2.5, depth: 2.5 }] });
  const p = forItem(makeFloorsCeilingsAgent(dirty)(view(t.project), ctx), t.slots.floors[R1]);
  assert.deepEqual(p.options.slice(0, -1).map((o) => o.newValue.surface), ['vinyl']);
});
