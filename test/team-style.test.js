// design-team Group C, Task C3: the Style agent for the design team and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { createItem } from '../src/brain/brain.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';
import { setProjectInspiration, setRoomOverride } from '../src/brain/inspiration.js';
import { createRun } from '../src/team-coordinator.js';
import { findStale } from '../src/ripple.js';
import { makeTeamStyleAgent, loadStyleKnowledge, conflictsFor, conflictPairs, STYLE } from '../src/agents/team-style/agent.js';
import { styleAgent } from '../src/agents/style/agent.js';
import { buildLater, view, off, registry, settle, NOW } from '../test-helpers/team-project.js';

const agent = makeTeamStyleAgent();
const k = loadStyleKnowledge();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';
const home = () => buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }, { name: 'Bedroom', width: 3, depth: 3 }], openings: [] });
const styleNote = (t, roomId, which = 'styleFloor') => t.project.items.find((i) => i.id === t.later[which][roomId]);

test('design-team C3: a floor\'s style note is a style item that points at the floor, and the floor item is untouched', () => {
  const t = home();
  setProjectInspiration(t.project, ['warm oak', 'quiet mornings']);
  const note = styleNote(t, R1);
  const floor = t.project.items.find((i) => i.kind === 'floor' && i.room === R1);
  assert.equal(note.kind, 'style');
  assert.equal(note.owner, STYLE);
  assert.equal(note.value.target, floor.id, 'the note points at the floor');
  assert.equal(note.value.position, undefined, 'a style note has no geometry');

  const floorBefore = structuredClone(floor);
  const versionsBefore = t.project.versions.length;
  const out = agent(view(t.project), ctx);
  const p = out.find((x) => x.itemId === note.id);
  assert.ok(p, 'a proposal for the note');
  assert.equal(p.agent, 'Style');
  assert.equal(p.options[0].newValue.target, floor.id);
  assert.equal(p.options[0].newValue.tag, 'warm oak');
  assert.equal(p.options[0].newValue.family, 'warm natural');
  assert.deepEqual(p.options[0].newValue.palette, ['oak brown', 'cream', 'olive green']);
  assert.equal(out.some((x) => x.itemId === floor.id), false, 'nothing is proposed for the floor');

  // answered through the Coordinator: only the style note changes
  const run = createRun(t.project, { registry, now: NOW, scripted: true, agents: { Style: agent }, configs: off(['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor']) });
  for (let s = run.next(); !s.done; s = run.next()) for (const x of s.proposals) run.answer(x.id, x.options[0].id);
  assert.deepEqual(floor, floorBefore);
  const added = t.project.versions.slice(versionsBefore);
  assert.ok(added.length >= 1);
  assert.ok(added.every((v) => v.who === 'Style' && t.project.items.find((i) => i.id === v.item).kind === 'style'));
});

test('design-team C3: a cold-steel note in a warm-oak room is a conflict pair, shown with two options', () => {
  const t = home();
  setProjectInspiration(t.project, ['warm oak']);
  const steel = createItem(t.project, { kind: 'style', owner: 'Style', room: R1, value: { name: 'Wall finish', tag: 'cold steel', detail: 'Brushed steel panels' } });
  const p = agent(view(t.project), ctx).find((x) => x.itemId === steel.id);
  assert.ok(p);
  assert.equal(p.confidence, 'low');
  assert.equal(p.options.length, 3);
  assert.equal(p.options[2].label, 'Custom');
  const keep = p.options[0].newValue;
  assert.equal(keep.tag, 'cold steel', 'the first option keeps the user\'s own tag');
  assert.deepEqual(keep.conflicts.map((c) => c.pair), [['warm oak', 'cold steel']]);
  assert.equal(keep.conflicts[0].ruleId, 'conflict-oak-steel');
  assert.match(p.why, /warm oak against cold steel is a conflict pair/);
  const follow = p.options[1].newValue;
  assert.equal(follow.tag, 'warm oak');
  assert.deepEqual(follow.conflicts, []);
});

test('design-team C3: conflictsFor finds a pair in either order and nothing else', () => {
  assert.equal(conflictsFor('cold steel', ['warm oak'], k).length, 1);
  assert.equal(conflictsFor('warm oak', ['cold steel'], k).length, 1);
  assert.deepEqual(conflictsFor('linen', ['warm oak'], k), []);
  assert.deepEqual(conflictsFor(null, ['warm oak'], k), []);
  assert.ok(conflictPairs(k).some((p) => p[0] === 'linen' && p[1] === 'glossy chrome'), 'the two old sample pairs are in the knowledge file');
});

test('design-team C3: the old rule is kept: the room\'s effective inspiration (its override, else the overall set) is added to the detail', () => {
  const t = home();
  setProjectInspiration(t.project, ['warm oak', 'linen']);
  setRoomOverride(t.project, 'floor-1-room-2', ['white', 'calm light']);
  const out = agent(view(t.project), ctx);
  const living = out.find((p) => p.itemId === styleNote(t, R1).id);
  const bed = out.find((p) => p.itemId === styleNote(t, 'floor-1-room-2').id);
  assert.match(living.options[0].newValue.detail, /\(kept in line with: warm oak, linen\)$/);
  assert.match(bed.options[0].newValue.detail, /\(kept in line with: white, calm light\)$/);
  assert.doesNotMatch(bed.options[0].newValue.detail, /warm oak/);
});

test('design-team C3: when the floor and the inspiration point to two families, there are two options (low confidence)', () => {
  const t = home();
  setProjectInspiration(t.project, ['industrial concrete']);
  const p = agent(view(t.project), ctx).find((x) => x.itemId === styleNote(t, R1).id);
  assert.equal(p.confidence, 'low');
  assert.equal(p.options.length, 3);
  assert.deepEqual(p.options.slice(0, 2).map((o) => o.newValue.family), ['warm natural', 'cool modern']);
});

test('design-team C3: the same input twice gives identical proposals', () => {
  const make = () => { const t = home(); setProjectInspiration(t.project, ['warm oak', 'industrial concrete']); return t; };
  const a = agent(view(make().project), ctx);
  const b = agent(view(make().project), ctx);
  assert.ok(a.length >= 2);
  assert.deepEqual(a, b);
});

test('design-team C3: a Locked style note is never proposed for a change, and the gatekeeper refuses it', () => {
  const t = home();
  setProjectInspiration(t.project, ['warm oak']);
  const locked = createItem(t.project, { kind: 'style', owner: 'Style', status: 'Locked', room: R1, value: { name: 'Oak floor', tag: 'warm oak', detail: 'Oak, as it is' } });
  assert.equal(agent(view(t.project), ctx).some((p) => p.itemId === locked.id), false);
  const gate = createGatekeeper(t.project, { now: NOW });
  assert.equal(gate.changeItem('Style', locked.id, { ...locked.value, tag: 'pale ash' }).accepted, false);
  assert.equal(locked.value.tag, 'warm oak');
});

test('design-team C3: a style note never carries geometry; a custom answer with a position or an unknown tag is refused', () => {
  const t = home();
  setProjectInspiration(t.project, ['warm oak']);
  const p = agent(view(t.project), ctx)[0];
  for (const o of p.options.slice(0, -1)) assert.equal(o.newValue.position, undefined);
  assert.equal(agent.checkCustom(p, { tag: 'warm oak', detail: 'x' }), true);
  assert.match(agent.checkCustom(p, { position: { x: 0 } }), /no geometry/);
  assert.match(agent.checkCustom(p, { tag: 'neon' }), /not in the style families/);
});

test('design-team C3: after a wall changes, the style notes of that room are stale (through the floor and the decor)', () => {
  const t = home();
  settle(t.project);
  assert.deepEqual(findStale(t.project, registry).stale, [], 'everything is up to date before the change');
  const wall = t.project.items.find((i) => i.kind === 'wall' && i.room === R1);
  const gate = createGatekeeper(t.project, { now: NOW });
  assert.equal(gate.changeItem('Walls', wall.id, { ...wall.value, note: 'moved' }, { approvedBy: 'scripted answer' }).accepted, true);
  const stale = findStale(t.project, registry).stale.filter((s) => s.owner === 'Style').map((s) => s.itemId);
  assert.deepEqual(stale.sort(), [t.later.styleFloor[R1], t.later.styleDecor[R1]].sort());
});

test('design-team C3: the old Style agent and its exports are still there for the existing sample', () => {
  assert.equal(typeof styleAgent, 'function');
});

test('design-team C3: every proposal names a rule from the style knowledge files, and the files pass the provenance check', () => {
  const t = home();
  setProjectInspiration(t.project, ['warm oak', 'industrial concrete']);
  const ids = new Set([...k.families, ...k.palettes, ...k.conflicts].map((r) => r.id));
  const out = agent(view(t.project), ctx);
  assert.ok(out.length >= 2);
  for (const p of out) assert.ok(ids.has(p.ruleId) || p.ruleId === 'style-inspiration-detail', p.ruleId);
  const dir = fileURLToPath(new URL('../src/knowledge/style/', import.meta.url));
  const files = readdirSync(dir).sort();
  assert.deepEqual(files, ['conflict-pairs.json', 'palettes.json', 'style-families.json']);
  for (const f of files) assert.ok(loadKnowledge(`style/${f}`).provenance.sources.length > 0);
});
