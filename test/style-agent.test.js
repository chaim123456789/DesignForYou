import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../src/brain/inspiration.js';
import { runPipeline, makeReadOnlyView } from '../src/coordinator.js';
import { styleAgent, sampleStyleAgent } from '../src/agents/style/agent.js';

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

test('Style proposes changes only for Unsure style items it owns', () => {
  const p = loadSample();
  const proposals = styleAgent(makeReadOnlyView(p));
  const ids = proposals.map((x) => x.itemId);
  const expected = p.items.filter((i) => i.kind === 'style' && i.status === 'Unsure').map((i) => i.id);
  assert.deepEqual(ids, expected);
  assert.ok(ids.length >= 1);
  for (const id of ids) {
    const item = getItem(p, id);
    assert.equal(item.kind, 'style');
    assert.equal(item.owner, 'Style');
    assert.equal(item.status, 'Unsure');
  }
});

test('Style never proposes changes to layout, door, window or clash items', () => {
  const p = loadSample();
  for (const agent of [styleAgent, sampleStyleAgent]) {
    for (const { itemId } of agent(makeReadOnlyView(p))) {
      assert.equal(getItem(p, itemId).kind, 'style');
    }
  }
});

test('in a full run, Style changes only Unsure style items', () => {
  const p = loadSample();
  const before = snapshot(p);
  const result = runPipeline(p, { agents: { Style: sampleStyleAgent } });
  assert.equal(result.ok, true);
  const versions = listVersions(p);
  assert.ok(versions.length >= 1);
  for (const v of versions) {
    assert.equal(v.who, 'Style');
    const item = getItem(p, v.item);
    assert.equal(item.kind, 'style');
    assert.equal(item.status, 'Unsure');
  }
  // Every item that is not an Unsure style item is identical to before.
  const after = snapshot(p);
  before.forEach((b, i) => {
    if (!(b.kind === 'style' && b.status === 'Unsure')) assert.deepEqual(after[i], b);
  });
});

test('the Locked-item proposal is refused and logged, and the Locked value is unchanged', () => {
  const p = loadSample();
  const locked = p.items.filter((i) => i.kind === 'style' && i.status === 'Locked');
  const before = locked.map((i) => structuredClone(i));
  const proposals = sampleStyleAgent(makeReadOnlyView(p));
  const lockedProposals = proposals.filter((x) => locked.some((l) => l.id === x.itemId));
  assert.equal(lockedProposals.length, 1, 'exactly one proposal targets a Locked item');

  runPipeline(p, { agents: { Style: sampleStyleAgent } });
  const refused = p.runLog.filter((e) => e.event === 'refused');
  assert.equal(refused.length, 1);
  assert.equal(refused[0].agent, 'Style');
  assert.equal(refused[0].item, lockedProposals[0].itemId);
  assert.match(refused[0].reason, /Locked/);
  assert.deepEqual(locked.map((i) => getItem(p, i.id)), before);
  assert.ok(!listVersions(p).some((v) => v.item === lockedProposals[0].itemId));
});

test('the normal Style agent does not try any Locked item', () => {
  const p = loadSample();
  runPipeline(p, { agents: { Style: styleAgent } });
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 0);
});

test('a room override is used for items in that room, the overall set elsewhere', () => {
  const p = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'A' }, { name: 'B' }] }] });
  setProjectInspiration(p, ['warm oak']);
  setRoomOverride(p, 'floor-1-room-2', ['slate']);
  createItem(p, { kind: 'style', owner: 'Style', room: 'floor-1-room-1', value: { tag: 'x', detail: 'Walls' } });
  createItem(p, { kind: 'style', owner: 'Style', room: 'floor-1-room-2', value: { tag: 'y', detail: 'Walls' } });
  const [a, b] = styleAgent(makeReadOnlyView(p));
  assert.match(a.newValue.detail, /warm oak/);
  assert.match(b.newValue.detail, /slate/);
  assert.doesNotMatch(b.newValue.detail, /warm oak/);
});

test('Style does not change the view it reads, and gives the same answer twice', () => {
  const p = loadSample();
  const view = makeReadOnlyView(p);
  const first = styleAgent(view);
  assert.deepEqual(styleAgent(view), first);
  assert.deepEqual(view.items, makeReadOnlyView(p).items);
});

test('Style writes nothing outside its own folder or items: its code only reads', () => {
  const folder = new URL('../src/agents/style/', import.meta.url);
  assert.deepEqual(readdirSync(folder).filter((f) => f !== '.gitkeep').sort(), ['agent.js', 'agent.json']);
  const code = readFileSync(new URL('agent.js', folder), 'utf8');
  const imports = [...code.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../../brain/inspiration.js']); // no gatekeeper, no brain.js, no fs
  assert.doesNotMatch(code, /writeFile|appendFile|createGatekeeper|changeItem|changeStatus|appendVersion|runLog|\.items\.push|\.versions\.push/);
});
