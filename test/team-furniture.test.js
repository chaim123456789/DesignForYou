// design-team Group C, Task C1: the Furniture agent and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { createRun, runWithScript } from '../src/team-coordinator.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';
import { findStale } from '../src/ripple.js';
import { makeFurnitureAgent, loadFurnitureKnowledge, FURNITURE } from '../src/agents/furniture/agent.js';
import { buildLater, piece, view, viewWithPoison, firstFour, off, registry, NOW } from '../test-helpers/team-project.js';

const agent = makeFurnitureAgent();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';
const R2 = 'floor-1-room-2';
const door = (room, x, y) => ({ kind: 'door', room, name: 'Door', position: { x, y, width: 0.9, depth: 0.1 } });
const win = (room, x, y, width = 1.2) => ({ kind: 'window', room, name: 'Window', position: { x, y, width, depth: 0.1 } });
const wallOf = (t, room) => t.project.items.find((i) => i.kind === 'wall' && i.room === room);
const forItem = (out, id) => out.find((p) => p.itemId === id);

function living(furniture, extra = {}) {
  return buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }, { name: 'Study', width: 2, depth: 2.5 }], openings: [door(R1, 1, 0), win(R1, 2.5, 2.9)], furniture, ...extra });
}

test('design-team C1: a sofa that does not fit raises a request to Walls with two options plus Custom', () => {
  const t = living([piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9)]);
  const out = agent(view(t.project), ctx);
  assert.equal(out.length, 1);
  const p = out[0];
  const wall = wallOf(t, R2);
  assert.equal(p.itemId, wall.id, 'a request names the wall item, not the sofa');
  assert.deepEqual(p.request, { itemId: wall.id, owner: 'Walls' });
  assert.equal(p.agent, FURNITURE);
  assert.equal(p.confidence, 'low');
  assert.equal(p.options.length, 3);
  assert.equal(p.options[2].label, 'Custom');
  assert.equal(p.ruleId, 'clear-crowded');
  assert.equal(p.source, 'rule');
  // both options make the room wide enough; the second leaves walking space as well
  const widths = p.options.slice(0, 2).map((o) => o.newValue.size.width);
  assert.ok(widths[0] >= 2.2 && widths[1] > widths[0]);
  assert.ok(p.options[0].newValue.segments.filter((s) => s.side === 'north' || s.side === 'south').every((s) => s.length === widths[0]));
});

test('design-team C1: Furniture never writes a wall item: the gatekeeper refuses it and logs the refusal', () => {
  const t = living([piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9)]);
  const wall = wallOf(t, R2);
  const before = structuredClone(wall.value);
  const versions = t.project.versions.length;
  const gate = createGatekeeper(t.project, { now: NOW });
  const r = gate.changeItem(FURNITURE, wall.id, { ...wall.value, size: { width: 9, depth: 9 } });
  assert.equal(r.accepted, false);
  assert.match(r.reason, /Furniture does not own item/);
  assert.deepEqual(wall.value, before);
  assert.equal(t.project.versions.length, versions);
  assert.ok(t.project.runLog.some((e) => e.event === 'refused' && e.agent === FURNITURE && e.item === wall.id));
});

test('design-team C1: an accepted request is applied by Walls (not Furniture), approved by the script, and Furniture then re-checks', () => {
  const t = living([piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9)]);
  const run = createRun(t.project, { registry, now: NOW, scripted: true, agents: { Furniture: agent }, configs: off(['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Decor', 'Style']) });
  const step = run.next();
  assert.equal(step.agent, FURNITURE);
  assert.equal(step.proposals.length, 1);
  const result = run.answer(step.proposals[0].id, 'just-fits');
  assert.equal(result.applied, true);
  const version = t.project.versions[t.project.versions.length - 1];
  assert.equal(version.who, 'Walls');
  assert.equal(version.item, wallOf(t, R2).id);
  assert.equal(version.approvedBy, 'scripted answer');
  assert.ok(wallOf(t, R2).value.size.width >= 2.2);
  // the ripple starts at Walls: Furniture is asked to look again, and then the sofa fits
  const next = run.next();
  assert.equal(next.agent, FURNITURE);
  assert.equal(next.kind, 'recheck');
  assert.deepEqual(next.proposals, []);
});

test('design-team C1: placed objects from the intake are read unchanged, and a piece that breaks no rule gets no proposal', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.2, 2, 2, 0.9, { turn: 90 }), piece(R1, 'table', 'Table', 2.6, 0.5, 1.2, 0.8)]);
  const before = structuredClone(t.project.items);
  const v = view(t.project);
  const out = agent(v, ctx);
  assert.deepEqual(out, []);
  assert.deepEqual(t.project.items, before, 'the Brain is exactly as it was');
  for (const id of t.later.furniture) {
    const item = t.project.items.find((i) => i.id === id);
    assert.equal(item.value.turn !== undefined, true);
  }
  assert.deepEqual(t.project.items.find((i) => i.id === t.later.furniture[0]).value.position, { x: 0.2, y: 2, width: 2, depth: 0.9 });
});

test('design-team C1: a piece that sticks out of its room or overlaps another gets a new place, tagged with its rule', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8), piece(R1, 'desk', 'Desk', 3.5, 0.2, 1.2, 0.6)]);
  const out = agent(view(t.project), ctx);
  const table = forItem(out, t.later.furniture[1]);
  assert.ok(table, 'the table overlaps the sofa');
  assert.equal(table.ruleId, 'clear-walkway');
  assert.match(table.why, /overlaps the Sofa/);
  assert.equal(table.options[0].newValue.position.width, 1.4, 'the size is kept, only the place changes');
  const desk = forItem(out, t.later.furniture[2]);
  assert.ok(desk, 'the desk sticks out of the room on the east side');
  assert.match(desk.why, /sticks out/);
  assert.equal(forItem(out, t.later.furniture[0]), undefined, 'the sofa, the earlier piece, is left alone');
});

test('design-team C1: two possible places show as low confidence with exactly two options plus Custom', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8)]);
  const p = forItem(agent(view(t.project), ctx), t.later.furniture[1]);
  assert.equal(p.confidence, 'low');
  assert.equal(p.options.length, 3);
  const [a, b] = p.options;
  assert.ok(Math.hypot(a.newValue.position.x - b.newValue.position.x, a.newValue.position.y - b.newValue.position.y) >= 0.5);
});

test('design-team C1: a piece standing where a door swings in is moved out of the swing', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.9, 0.2, 1.4, 0.9)]); // the door is at x 1 to 1.9 on the north wall
  const p = forItem(agent(view(t.project), ctx), t.later.furniture[0]);
  assert.equal(p.ruleId, 'clear-door-swing');
  const moved = p.options[0].newValue.position;
  assert.ok(!(moved.x < 1.9 && moved.x + moved.width > 1 && moved.y < 0.9), 'the new place is outside the swing square');
});

test('design-team C1: a bed with its head under a window is moved', () => {
  const t = buildLater({ rooms: [{ name: 'Bedroom', width: 4, depth: 4 }], openings: [door(R1, 0.2, 0), win(R1, 1.2, 3.9, 1.6)], furniture: [piece(R1, 'bed', 'Bed', 1.2, 2.0, 1.6, 2.0)] });
  const p = forItem(agent(view(t.project), ctx), t.later.furniture[0]);
  assert.equal(p.ruleId, 'pattern-bed-head');
  assert.match(p.why, /under a window/);
});

test('design-team C1: a wardrobe needs free space in front of it, and a piece against it is refused', () => {
  const t = buildLater({ rooms: [{ name: 'Bedroom', width: 4, depth: 4 }], openings: [door(R1, 3, 0)], furniture: [piece(R1, 'wardrobe', 'Wardrobe', 0, 0, 1.2, 0.6), piece(R1, 'desk', 'Desk', 0.1, 0.6, 1.0, 0.6)] });
  const out = agent(view(t.project), ctx);
  const ids = out.map((p) => p.itemId);
  assert.ok(ids.includes(t.later.furniture[1]), 'the desk, the later piece, is the one asked to move');
  const p = forItem(out, t.later.furniture[1]);
  assert.ok(['clear-walkway', 'size-desk', 'size-wardrobe'].includes(p.ruleId));
  const after = p.options[0].newValue.position;
  assert.ok(!(after.x < 1.2 && after.x + after.width > 0 && after.y < 1.4 && after.y + after.depth > 0.6), 'the new place leaves the wardrobe its front space');
});

test('design-team C1: a tall piece may not cover a socket', () => {
  const t0 = buildLater({ rooms: [{ name: 'Bedroom', width: 4, depth: 4 }], openings: [door(R1, 3, 0)], furniture: [] });
  const elec = t0.project.items.find((i) => i.kind === 'electrical');
  assert.ok(elec.value.sockets.length > 0, 'the Lighting agent proposed sockets');
  const s = elec.value.sockets.find((x) => x.side === 'west') || elec.value.sockets[0];
  const sock = s.position;
  const t = buildLater({ rooms: [{ name: 'Bedroom', width: 4, depth: 4 }], openings: [door(R1, 3, 0)], furniture: [piece(R1, 'wardrobe', 'Wardrobe', Math.max(0, sock.x - 0.2), Math.max(0, sock.y - 0.2), 1.2, 0.6)] });
  const p = forItem(agent(view(t.project), ctx), t.later.furniture[0]);
  assert.ok(p, 'the wardrobe covers a socket');
  assert.ok(['clear-socket-reach', 'size-wardrobe', 'clear-walkway', 'clear-door-swing', 'clear-search'].includes(p.ruleId));
});

test('design-team C1: a Locked piece is never proposed for a change, and the gatekeeper would refuse it anyway', () => {
  const t = living([piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9, { status: 'Locked' }), piece(R1, 'table', 'Table', 3.8, 0.2, 1.4, 0.8, { status: 'Locked' })]);
  assert.deepEqual(agent(view(t.project), ctx), []);
  const gate = createGatekeeper(t.project, { now: NOW });
  assert.equal(gate.changeItem(FURNITURE, t.later.furniture[1], { x: 0 }).accepted, false);
});

test('design-team C1: the same input twice gives identical proposals', () => {
  const make = () => living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8), piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9)]);
  const a = agent(view(make().project), ctx);
  const b = agent(view(make().project), ctx);
  assert.ok(a.length >= 2);
  assert.deepEqual(a, b);
});

test('design-team C1: the agent never reads a later agent\'s item (Decor, Style, Reviewer)', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8)]);
  const poisoned = viewWithPoison(t.project, ['decor', 'style', 'clash']);
  assert.equal(agent(poisoned, ctx).length, 1);
});

test('design-team C1: every proposal names a rule that exists in the knowledge files', () => {
  const k = loadFurnitureKnowledge();
  const ids = new Set([...k.sizes, ...k.clear, ...k.patterns].map((r) => r.id));
  const t = living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8), piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9), piece(R1, 'desk', 'Desk', 3.5, 0.2, 1.2, 0.6)]);
  const out = agent(view(t.project), ctx);
  assert.ok(out.length >= 3);
  for (const p of out) assert.ok(ids.has(p.ruleId), `${p.ruleId} is in a furniture knowledge file`);
});

test('design-team C1: a custom answer must be a position, or a size for a request', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8), piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9)]);
  const out = agent(view(t.project), ctx);
  const move = out.find((p) => !p.request);
  const req = out.find((p) => p.request);
  assert.equal(agent.checkCustom(move, { position: { x: 1, y: 1, width: 1, depth: 1 } }), true);
  assert.match(agent.checkCustom(move, { position: { x: 'a' } }), /needs a position/);
  assert.match(agent.checkCustom(req, { size: { width: 0, depth: 2 } }), /size with a width and a depth above 0/);
  assert.equal(agent.checkCustom(req, { size: { width: 3, depth: 2 } }), true);
});

test('design-team C1: a full scripted run of five agents leaves nothing stale and the furniture inside its rooms', () => {
  const t = living([piece(R1, 'sofa', 'Sofa', 0.5, 2, 2, 0.9), piece(R1, 'table', 'Table', 1.5, 1.8, 1.4, 0.8), piece(R2, 'sofa', 'Big sofa', 0, 0, 2.2, 0.9)]);
  const r = runWithScript(t.project, { registry, now: NOW, agents: { ...firstFour(), Furniture: agent }, configs: off(['Decor', 'Style']) });
  assert.equal(r.ok, true);
  assert.deepEqual(findStale(t.project, registry).stale.filter((s) => ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture'].includes(s.owner)), []);
  assert.ok(wallOf(t, R2).value.size.width >= 2.2);
  assert.equal(t.project.versions.some((v) => v.who === FURNITURE && v.item === wallOf(t, R2).id), false);
  assert.ok(t.project.versions.every((v) => v.approvedBy === 'scripted answer'));
});

test('design-team C1: the furniture knowledge files exist, load and pass the provenance check', () => {
  const dir = fileURLToPath(new URL('../src/knowledge/furniture/', import.meta.url));
  const files = readdirSync(dir).sort();
  assert.deepEqual(files, ['clearances.json', 'furniture-sizes.json', 'layout-patterns.json']);
  for (const f of files) {
    const k = loadKnowledge(`furniture/${f}`);
    assert.ok(k.rules.length > 0);
    assert.ok(k.provenance.sources.length > 0);
  }
});
