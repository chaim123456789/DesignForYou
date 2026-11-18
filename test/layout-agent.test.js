import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../src/brain/inspiration.js';
import { runPipeline, makeReadOnlyView } from '../src/coordinator.js';
import { layoutAgent } from '../src/agents/layout/agent.js';
import { sampleStyleAgent } from '../src/agents/style/agent.js';

const sample = JSON.parse(readFileSync(new URL('../src/sample/sample-project.json', import.meta.url), 'utf8'));

// Build a Brain from the sample file (a plain helper for these tests).
function loadSample() {
  const p = createProject(sample);
  setProjectInspiration(p, sample.inspiration);
  const rooms = p.floors.flatMap((f) => f.rooms);
  for (const r of sample.floors.flatMap((f) => f.rooms)) {
    if (r.override) setRoomOverride(p, rooms.find((x) => x.name === r.name).id, r.override);
  }
  for (const i of sample.items) {
    const data = { kind: i.kind, owner: i.owner, status: i.status, value: i.value };
    if (i.room) data.room = rooms.find((x) => x.name === i.room).id;
    createItem(p, data);
  }
  return p;
}

const snapshot = (p) => p.items.map((i) => ({ id: i.id, kind: i.kind, status: i.status, value: structuredClone(i.value) }));

// A small Brain with one Unsure and one Locked layout item.
function twoLayoutBrain() {
  const p = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'A' }] }] });
  const pos = { x: 0, y: 0, width: 1, depth: 1 };
  createItem(p, { kind: 'layout', owner: 'Layout', status: 'Unsure', room: 'floor-1-room-1', value: { name: 'Table', position: pos } });
  createItem(p, { kind: 'layout', owner: 'Layout', status: 'Locked', room: 'floor-1-room-1', value: { name: 'Piano', position: pos } });
  return p;
}

test('Layout proposes changes only for Unsure layout items it owns', () => {
  const p = loadSample();
  const ids = layoutAgent(makeReadOnlyView(p)).map((x) => x.itemId);
  const expected = p.items.filter((i) => i.kind === 'layout' && i.status === 'Unsure').map((i) => i.id);
  assert.deepEqual(ids, expected);
  assert.ok(ids.length >= 1);
});

test('Layout never proposes changes to style, door, window or clash items', () => {
  const p = loadSample();
  for (const { itemId } of layoutAgent(makeReadOnlyView(p))) {
    assert.equal(getItem(p, itemId).kind, 'layout');
  }
});

test('in a full run, Layout changes only Unsure layout items', () => {
  const p = loadSample();
  const before = snapshot(p);
  const result = runPipeline(p, { agents: { Layout: layoutAgent } });
  assert.equal(result.ok, true);
  const versions = listVersions(p);
  assert.ok(versions.length >= 1);
  for (const v of versions) {
    assert.equal(v.who, 'Layout');
    const item = getItem(p, v.item);
    assert.equal(item.kind, 'layout');
    assert.equal(item.status, 'Unsure');
  }
  const after = snapshot(p);
  before.forEach((b, i) => {
    if (!(b.kind === 'layout' && b.status === 'Unsure')) assert.deepEqual(after[i], b);
  });
});

test('a Locked layout item is unchanged, even if it is proposed', () => {
  const p = twoLayoutBrain();
  const locked = structuredClone(p.items[1]);
  runPipeline(p, { agents: { Layout: layoutAgent } });
  assert.deepEqual(p.items[1], locked);
  assert.equal(p.items[1].status, 'Locked');
  assert.ok(!listVersions(p).some((v) => v.item === locked.id));
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 0, 'the agent did not even try the Locked item');
  // The gatekeeper still refuses if a Layout proposal does target it.
  const forced = runPipeline(p, { agents: { Layout: () => [{ itemId: locked.id, newValue: { name: 'Moved' } }] } });
  assert.equal(forced.ok, true);
  assert.deepEqual(p.items[1], locked);
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 1);
});

test('Layout keeps names and positions, so the sample door-on-sofa case stays for the Reviewer', () => {
  const p = loadSample();
  const before = p.items.filter((i) => i.kind === 'layout').map((i) => structuredClone(i.value));
  runPipeline(p, { agents: { Layout: layoutAgent } });
  const after = p.items.filter((i) => i.kind === 'layout').map((i) => i.value);
  after.forEach((v, i) => {
    assert.equal(v.name, before[i].name);
    assert.deepEqual(v.position, before[i].position);
  });
});

test('Layout does not change items owned by other agents (run with Style on too)', () => {
  const p = loadSample();
  const before = snapshot(p);
  runPipeline(p, { agents: { Style: sampleStyleAgent, Layout: layoutAgent } });
  const after = snapshot(p);
  before.forEach((b, i) => {
    if (b.kind !== 'layout' && b.kind !== 'style') assert.deepEqual(after[i], b);
  });
  for (const v of listVersions(p).filter((x) => x.who === 'Layout')) {
    assert.equal(getItem(p, v.item).owner, 'Layout');
  }
});

test('Layout does not change the view it reads, and gives the same answer twice', () => {
  const p = loadSample();
  const view = makeReadOnlyView(p);
  const first = layoutAgent(view);
  assert.deepEqual(layoutAgent(view), first);
  assert.deepEqual(view.items, makeReadOnlyView(p).items);
});

test('Layout writes nothing outside its own folder or items: its code only reads', () => {
  const folder = new URL('../src/agents/layout/', import.meta.url);
  assert.deepEqual(readdirSync(folder).filter((f) => f !== '.gitkeep').sort(), ['agent.js', 'agent.json']);
  const code = readFileSync(new URL('agent.js', folder), 'utf8');
  assert.deepEqual([...code.matchAll(/^import .* from '(.+)';$/gm)], []);
  assert.doesNotMatch(code, /writeFile|appendFile|createGatekeeper|changeItem|changeStatus|appendVersion|runLog|\.items\.push|\.versions\.push/);
});
