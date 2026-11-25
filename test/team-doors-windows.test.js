// design-team Group B, Task B2: the Doors and windows agent and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { runWithScript } from '../src/team-coordinator.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeWallsAgent } from '../src/agents/walls/agent.js';
import { makeDoorsWindowsAgent, loadDoorsWindowsKnowledge } from '../src/agents/doors-windows/agent.js';
import { buildTeam, view, viewWithPoison, door, windowAt, NOW } from '../test-helpers/team-project.js';

const registry = loadRegistry();
const walls = makeWallsAgent();
const agent = makeDoorsWindowsAgent();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';

// Run only the Walls agent so the wall items hold their segments, as they would when the Doors agent runs.
function withWalls(spec) {
  const t = buildTeam(spec);
  runWithScript(t.project, { registry, now: NOW, agents: { Walls: walls } });
  return t;
}
const doorItem = (t, id) => t.project.items.find((i) => i.id === id);

test('design-team B2: a door that fits on its wall, clear of corners, gets no proposal', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 1.5, 0), windowAt(R1, 1.4, 2.9)] });
  assert.deepEqual(agent(view(t.project), ctx), []);
});

test('design-team B2: a door too near a corner gets a proposal that moves it clear and names its rule', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 0.02, 0), windowAt(R1, 1.4, 2.9)] });
  const [p] = agent(view(t.project), ctx);
  assert.equal(p.ruleId, 'doors-corner-distance');
  assert.equal(p.source, 'rule');
  assert.equal(p.agent, 'Doors and windows');
  assert.equal(p.itemId, t.slots.openings[0]);
  assert.equal(p.confidence, 'high');
  const best = p.options[0].newValue.position;
  assert.deepEqual(best, { x: 0.1, y: 0, width: 0.9, depth: 0.1 });
  assert.equal(p.options[0].newValue.wall, 'north');
  assert.equal(p.options[1].id, 'centre');
  assert.equal(p.options[1].newValue.position.x, 1.55);
  assert.equal(p.options.at(-1).id, 'custom');
});

test('design-team B2: a door at the far end is moved clear of that corner (east/west walls use y)', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [{ kind: 'door', room: R1, name: 'Side door', position: { x: 3.9, y: 2.05, width: 0.1, depth: 0.9 } }, windowAt(R1, 1.4, 2.9)] });
  const [p] = agent(view(t.project), ctx);
  assert.equal(p.ruleId, 'doors-corner-distance');
  assert.deepEqual(p.options[0].newValue.position, { x: 3.9, y: 2, width: 0.1, depth: 0.9 });
  assert.equal(p.options[0].newValue.wall, 'east');
});

test('design-team B2: a door that runs past the end of its wall is a "fit the wall" proposal', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 3.5, 0)] });
  const [p] = agent(view(t.project), ctx);
  assert.equal(p.ruleId, 'doors-fit-wall');
  assert.deepEqual(p.options[0].newValue.position, { x: 3, y: 0, width: 0.9, depth: 0.1 });
});

test('design-team B2: a door wider than its wall can hold is narrowed and centred', () => {
  const t = withWalls({ rooms: [{ name: 'Toilet', width: 1.0, depth: 1.2 }], openings: [door(R1, 0, 0, { width: 0.95 })] });
  // The Walls agent proposes a bigger toilet (smallest typical size); keep the entered size for this test.
  const [p] = agent(view(t.project), ctx);
  assert.equal(p.ruleId, 'doors-fit-wall');
  assert.equal(p.options[0].id, 'narrower');
  assert.equal(p.options[0].newValue.position.width, 0.8);
  assert.equal(p.options[0].newValue.position.x, 0.1);
});

test('design-team B2: a door that is not on any wall is moved to the nearest wall; two options when two walls are about equally near', () => {
  const far = withWalls({ rooms: [{ name: 'Bedroom', width: 6, depth: 6 }], openings: [door(R1, 2, 0.5), windowAt(R1, 3.0, 5.9)] });
  const [a] = agent(view(far.project), ctx);
  assert.equal(a.ruleId, 'doors-not-on-wall');
  assert.equal(a.confidence, 'high');
  assert.deepEqual(a.options.map((o) => o.id), ['to-north', 'custom']);
  assert.equal(a.options[0].newValue.position.y, 0);
  const near = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 0.2, 0.2), windowAt(R1, 1.4, 2.9)] });
  const [b] = agent(view(near.project), ctx);
  assert.equal(b.confidence, 'low');
  assert.equal(b.options.length, 3);
  assert.deepEqual(b.options.slice(0, 2).map((o) => o.id), ['to-north', 'to-west']);
});

test('design-team B2: a window-less living room gets a daylight proposal for its window slot, from the outside walls', () => {
  const t = withWalls({ rooms: [{ name: 'Living Room', width: 5, depth: 4 }, { name: 'Kitchen', width: 4, depth: 3 }], openings: [door('floor-1-room-1', 2, 0)] });
  const out = agent(view(t.project), ctx);
  const living = out.find((p) => p.itemId === t.slots.windowSlots['floor-1-room-1']);
  assert.ok(living, 'the living room has a daylight proposal');
  assert.equal(living.ruleId, 'windows-daylight');
  assert.equal(living.confidence, 'high');
  const first = living.options[0].newValue;
  assert.equal(first.rule, 'windows-daylight-living-room');
  assert.equal(first.wall, 'north'); // the longest outside wall, the north one on a tie
  assert.equal(first.position.y, 0);
  assert.equal(first.position.width, 1.667); // a tenth of 20 m2, over 1.2 m
  assert.equal(first.height, 1.2);
  assert.ok(living.options.length >= 3, 'two real options plus Custom');
  // The shared wall is not offered: only outside walls.
  assert.ok(living.options.slice(0, -1).every((o) => o.newValue.wall !== 'east'));
});

test('design-team B2: a bathroom needs no window, and a room that has a window gets no daylight proposal', () => {
  const t = withWalls({ rooms: [{ name: 'Bathroom', width: 2, depth: 2.5 }, { name: 'Bedroom', width: 4, depth: 3 }], openings: [windowAt('floor-1-room-2', 1.4, 0)] });
  const out = agent(view(t.project), ctx);
  assert.deepEqual(out.filter((p) => p.ruleId === 'windows-daylight'), []);
  assert.ok(!t.slots.windowSlots['floor-1-room-2'], 'no slot is made for a room that has its own window');
});

test('design-team B2: before the walls are decided it proposes no daylight window (it does not guess)', () => {
  const t = buildTeam({ rooms: [{ name: 'Living Room', width: 5, depth: 4 }] });
  assert.deepEqual(agent(view(t.project), ctx), []);
});

test('design-team B2: a door whose swing hits another door gets a slide-or-outward proposal; swing-out doors are left alone', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 4 }], openings: [door(R1, 1.0, 0, { name: 'Door A' }), door(R1, 1.6, 0, { name: 'Door B' }), windowAt(R1, 1.4, 3.9)] });
  const out = agent(view(t.project), ctx);
  assert.equal(out.length, 1);
  const p = out[0];
  assert.equal(p.ruleId, 'doors-swing-clash');
  assert.equal(p.itemId, t.slots.openings[1], 'only the later door of the pair gets the proposal');
  assert.equal(p.confidence, 'low');
  assert.deepEqual(p.options.map((o) => o.id), ['slide', 'swing-out', 'custom']);
  assert.equal(p.options[1].newValue.swing, 'out');
  // The slid door clears the other swing.
  const moved = p.options[0].newValue.position;
  assert.ok(moved.x >= 1.0 + 0.9 || moved.x + moved.width <= 1.0, 'clear of door A swing (x 1.0 to 1.9)');
  // Once one door opens outward, the clash is gone.
  t.project.items.find((i) => i.id === t.slots.openings[1]).value.swing = 'out';
  assert.deepEqual(agent(view(t.project), ctx), []);
});

test('design-team B2: a door that cannot swing inside a small room is told to open outward', () => {
  const t = withWalls({ rooms: [{ name: 'Toilet', width: 1.4, depth: 0.8 }], openings: [door(R1, 0.2, 0), windowAt(R1, 0.1, 0.7, 0.3)] });
  // The Walls agent offered a bigger room, but the answer here was to keep the entered size.
  const out = agent(view(t.project), ctx);
  const p = out.find((x) => x.ruleId === 'doors-swing-room');
  assert.ok(p);
  assert.equal(p.options[0].newValue.swing, 'out');
});

test('design-team B2: it never reads a later agent\'s item (a view with later items that throw when read)', () => {
  const t = withWalls({ rooms: [{ name: 'Living Room', width: 5, depth: 4 }, { name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 0.02, 0)] });
  const later = ['floor', 'ceiling', 'light', 'electrical', 'layout', 'decor', 'style', 'clash'];
  const plain = agent(view(t.project), ctx);
  const poisoned = agent(viewWithPoison(t.project, later), ctx);
  assert.ok(plain.length > 0);
  assert.equal(JSON.stringify(poisoned), JSON.stringify(plain));
});

test('design-team B2: the same input twice gives the same proposals', () => {
  const t = withWalls({ rooms: [{ name: 'Living Room', width: 5, depth: 4 }, { name: 'Kitchen', width: 4, depth: 3 }], openings: [door(R1, 0.02, 0), door('floor-1-room-2', 3, 0)] });
  assert.equal(JSON.stringify(agent(view(t.project), ctx)), JSON.stringify(makeDoorsWindowsAgent()(view(t.project), ctx)));
});

test('design-team B2: a Locked opening is not proposed to, and a re-check looks only at stale items', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 0.02, 0, { status: 'Locked' }), windowAt(R1, 1.4, 2.9)] });
  assert.deepEqual(agent(view(t.project), ctx), []);
  const u = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 0.02, 0), windowAt(R1, 1.4, 2.9)] });
  assert.deepEqual(agent(view(u.project), { mode: 'recheck', staleItemIds: [] }), []);
  assert.equal(agent(view(u.project), { mode: 'recheck', staleItemIds: [u.slots.openings[0]] }).length, 1);
});

test('design-team B2: the user\'s placed position is the starting point: an accepted fix keeps the name and other fields', () => {
  const t = withWalls({ rooms: [{ name: 'Bedroom', width: 4, depth: 3 }], openings: [door(R1, 0.02, 0, { name: 'Garden door' })] });
  const result = runWithScript(t.project, { registry, now: NOW, agents: { 'Doors and windows': agent } });
  assert.equal(result.ok, true);
  const item = doorItem(t, t.slots.openings[0]);
  assert.equal(item.value.name, 'Garden door');
  assert.equal(item.value.position.x, 0.1);
  assert.deepEqual(agent(view(t.project), ctx).filter((p) => p.itemId === item.id), []);
});

test('design-team B2: a custom answer must hold a position', () => {
  assert.equal(agent.checkCustom({}, { position: { x: 1, y: 0, width: 0.9, depth: 0.1 } }), true);
  assert.match(agent.checkCustom({}, { name: 'x' }), /needs a "position"/);
  assert.match(agent.checkCustom({}, { position: { x: 1, y: 0, width: 0, depth: 0.1 } }), /above 0/);
});

test('design-team B2: the doors and windows knowledge files pass the provenance test and say their sources were not checked', () => {
  const dir = fileURLToPath(new URL('../src/knowledge/doors-windows/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, ['door-sizes.json', 'swing-clearance.json', 'window-daylight.json']);
  for (const f of files) {
    const k = loadKnowledge(`doors-windows/${f}`);
    for (const s of k.provenance.sources) assert.equal(s.checked, 'not checked');
    for (const r of k.rules) assert.match(r.id, /^(doors|windows)-/);
  }
  assert.ok(loadDoorsWindowsKnowledge().daylight.length > 5);
});

test('design-team B2: the agent file holds no rule number of its own and reads no later kind', () => {
  const text = readFileSync(new URL('../src/agents/doors-windows/agent.js', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(text, /\b(0\.05|0\.1|0\.2|0\.3|0\.8|0\.9|1\.2|2\.4)\b/);
  assert.doesNotMatch(text, /'(floor|ceiling|light|electrical|layout|decor|style|clash)'/);
  const cfg = JSON.parse(readFileSync(new URL('../src/agents/doors-windows/agent.json', import.meta.url), 'utf8'));
  assert.deepEqual(cfg, { name: 'Doors and windows', enabled: true });
});
