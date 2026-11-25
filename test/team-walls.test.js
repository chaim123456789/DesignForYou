// design-team Group B, Task B1: the Walls agent and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject, createItem } from '../src/brain/brain.js';
import { makeReadOnlyView } from '../src/coordinator.js';
import { loadKnowledge } from '../src/knowledge/load.js';
import { createTeamSlots } from '../src/team-slots.js';
import { runWithScript, createRun } from '../src/team-coordinator.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeWallsAgent, loadWallsKnowledge, SHARED_WALL_RULE } from '../src/agents/walls/agent.js';

const registry = loadRegistry();
const NOW = () => '2026-01-01T00:00:00.000Z';
const agent = makeWallsAgent();

function home(rooms, { floors } = {}) {
  const p = createProject({ name: 'Home', floors: floors || [{ name: 'Ground', rooms }] });
  const slots = createTeamSlots(p);
  return { p, slots };
}
const propose = (p, ctx = { mode: 'first', staleItemIds: [] }) => agent(makeReadOnlyView(p), ctx);
const R1 = 'floor-1-room-1';
const R2 = 'floor-1-room-2';

test('design-team B1: the same input twice gives the same proposals', () => {
  const { p } = home([{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Living Room', width: 5, depth: 4 }, { name: 'Study' }]);
  const a = propose(p);
  const b = propose(p);
  assert.ok(a.length === 3);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // And a separate agent made from the same files gives the same too.
  assert.equal(JSON.stringify(makeWallsAgent()(makeReadOnlyView(p), { mode: 'first' })), JSON.stringify(a));
});

test('design-team B1: each result names its rule (the proposal and every wall segment)', () => {
  const { p } = home([{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Bedroom', width: 3.5, depth: 3 }, { name: 'Study' }]);
  const out = propose(p);
  for (const prop of out) {
    assert.match(prop.ruleId, /^walls-/);
    assert.equal(prop.source, 'rule');
    assert.equal(prop.agent, 'Walls');
    for (const o of prop.options.slice(0, -1)) for (const s of o.newValue.segments) assert.match(s.rule, /^walls-/);
  }
  const first = out[0];
  assert.equal(first.ruleId, 'walls-segments-from-size');
  assert.equal(first.confidence, 'high');
  assert.equal(first.options.length, 2); // one recommended option plus Custom
  const segs = first.options[0].newValue.segments;
  assert.deepEqual(segs.map((s) => s.side), ['north', 'south', 'west', 'east']);
  assert.deepEqual(segs.map((s) => s.length), [4, 4, 3, 3]);
  assert.equal(segs.find((s) => s.side === 'north').thickness, 0.3);
});

test('design-team B1: a room with no entered size gets two options plus Custom (default size, or wait)', () => {
  const { p, slots } = home([{ name: 'Study' }]);
  const [prop] = propose(p);
  assert.equal(prop.itemId, slots.walls[R1]);
  assert.equal(prop.ruleId, 'walls-default-size');
  assert.equal(prop.confidence, 'low');
  assert.deepEqual(prop.options.map((o) => o.id), ['use-default', 'wait-for-size', 'custom']);
  assert.equal(prop.options[0].newValue.size.from, 'default');
  assert.deepEqual([prop.options[0].newValue.size.width, prop.options[0].newValue.size.depth], [4, 4]);
  assert.equal(prop.options[1].newValue.waitingForSize, true);
  assert.deepEqual(prop.options[1].newValue.segments, []);
});

test('design-team B1: after "wait for the size" the agent does not ask again until a size is entered', () => {
  const { p } = home([{ name: 'Study' }]);
  const result = runWithScript(p, { registry, now: NOW, agents: { Walls: agent }, policy: (pr) => 'wait-for-size' });
  assert.equal(result.ok, true);
  assert.equal(p.items[0].value.waitingForSize, true);
  assert.deepEqual(propose(p), []);
});

test('design-team B1: rooms next to each other share one wall, with the same id and length in both', () => {
  const { p } = home([{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Living Room', width: 5, depth: 4 }, { name: 'Hall', width: 2, depth: 4 }]);
  const [a, b, c] = propose(p).map((x) => x.options[0].newValue.segments);
  const east = a.find((s) => s.side === 'east');
  const west = b.find((s) => s.side === 'west');
  assert.equal(east.id, west.id);
  assert.equal(east.length, 3); // the shorter of the two depths
  assert.equal(west.length, 3);
  assert.equal(east.sharedWith, R2);
  assert.equal(west.sharedWith, R1);
  assert.equal(east.rule, SHARED_WALL_RULE);
  assert.equal(east.thickness, 0.1); // an inside wall is thinner than an outside wall
  // The middle room has two shared walls, and the last room's east wall is an outside wall.
  assert.equal(b.filter((s) => s.sharedWith).length, 2);
  assert.equal(c.find((s) => s.side === 'east').sharedWith, null);
  assert.equal(c.find((s) => s.side === 'east').thickness, 0.3);
  // One wall, not two: across all rooms every shared id appears exactly twice (once per room), and no id is used by 3.
  const ids = [...a, ...b, ...c].map((s) => s.id);
  assert.equal(ids.filter((id) => id === east.id).length, 2);
});

test('design-team B1: rooms on different floors share no wall', () => {
  const { p } = home(null, { floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen', width: 4, depth: 3 }] }, { name: 'Upper', rooms: [{ name: 'Bedroom', width: 4, depth: 3 }] }] });
  for (const prop of propose(p)) assert.ok(prop.options[0].newValue.segments.every((s) => s.sharedWith === null));
});

test('design-team B1: a room below the smallest typical size gets two options (keep it, or the smallest size)', () => {
  const { p } = home([{ name: 'Bathroom', width: 1.0, depth: 1.2 }]);
  const [prop] = propose(p);
  assert.equal(prop.ruleId, 'walls-below-minimum');
  assert.equal(prop.confidence, 'low');
  assert.deepEqual(prop.options.map((o) => o.id), ['keep-size', 'use-minimum', 'custom']);
  const keep = prop.options[0].newValue;
  const bigger = prop.options[1].newValue;
  assert.deepEqual([keep.size.width, keep.size.depth], [1, 1.2]);
  assert.match(keep.warning, /Smaller than the typical minimum for a bathroom/);
  assert.ok(bigger.size.width >= 1.5 && bigger.size.depth >= 1.5 && bigger.size.width * bigger.size.depth >= 3.0);
  assert.equal(bigger.size.from, 'minimum');
});

test('design-team B1: a Locked wall item is never proposed to, and a re-check looks only at stale items', () => {
  const { p, slots } = home([{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Bedroom', width: 4, depth: 3 }]);
  p.items.find((i) => i.id === slots.walls[R1]).status = 'Locked';
  assert.deepEqual(propose(p).map((x) => x.itemId), [slots.walls[R2]]);
  assert.deepEqual(propose(p, { mode: 'recheck', staleItemIds: [] }), []);
  assert.deepEqual(propose(p, { mode: 'recheck', staleItemIds: [slots.walls[R2]] }).map((x) => x.itemId), [slots.walls[R2]]);
});

test('design-team B1: it reads no other agent: a view with only the room list and wall items is enough', () => {
  const { p } = home([{ name: 'Kitchen', width: 4, depth: 3 }]);
  const view = makeReadOnlyView(p);
  const bare = { ...view, items: view.items.filter((i) => i.kind === 'wall') };
  assert.equal(agent(bare, { mode: 'first' }).length, 1);
});

test('design-team B1: answering through the Coordinator writes the walls once and a second run proposes nothing new', () => {
  const { p } = home([{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Living Room', width: 5, depth: 4 }]);
  const run1 = runWithScript(p, { registry, now: NOW, agents: { Walls: agent } });
  assert.equal(run1.ok, true);
  assert.equal(p.versions.filter((v) => v.who === 'Walls').length, 2);
  assert.ok(p.versions.every((v) => v.approvedBy === 'scripted answer' && Array.isArray(v.basis) === false));
  assert.deepEqual(propose(p), []);
  const run2 = createRun(p, { registry, now: NOW, agents: { Walls: agent } });
  assert.deepEqual(run2.next().proposals, []);
});

test('design-team B1: a custom answer must be a list of wall segments', () => {
  assert.equal(agent.checkCustom({}, { segments: [{ side: 'north', length: 3, thickness: 0.2 }] }), true);
  assert.match(agent.checkCustom({}, { segments: 'x' }), /needs a list called "segments"/);
  assert.match(agent.checkCustom({}, { segments: [{ side: 'up', length: 3, thickness: 0.2 }] }), /needs a side/);
  assert.match(agent.checkCustom({}, { segments: [{ side: 'north', length: 0, thickness: 0.2 }] }), /length and a thickness above 0/);
});

test('design-team B1: the walls knowledge files pass the provenance test and say their sources were not checked', () => {
  const dir = fileURLToPath(new URL('../src/knowledge/walls/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.deepEqual(files.sort(), ['room-minimum-sizes.json', 'wall-thickness.json']);
  for (const f of files) {
    const k = loadKnowledge(`walls/${f}`);
    assert.ok(k.provenance.sources.length >= 1);
    for (const s of k.provenance.sources) assert.equal(s.checked, 'not checked');
    for (const r of k.rules) assert.match(r.id, /^walls-/);
  }
  assert.ok(loadWallsKnowledge().sizes.some((r) => r.id === 'walls-default-size'));
});

test('design-team B1: the agent file holds no rule number of its own (sizes, thickness and height come from the knowledge files)', () => {
  const text = readFileSync(new URL('../src/agents/walls/agent.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(text, /\b(0\.3|0\.1|2\.4|4\.0)\b/);
});

test('design-team B1: agent.json switches the agent on or off and names it', () => {
  const cfg = JSON.parse(readFileSync(new URL('../src/agents/walls/agent.json', import.meta.url), 'utf8'));
  assert.deepEqual(cfg, { name: 'Walls', enabled: true });
});
