import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../src/brain/inspiration.js';
import { runPipeline, makeReadOnlyView } from '../src/coordinator.js';
import { builderAgent } from '../src/agents/builder/agent.js';
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
const isOpening = (i) => i.kind === 'door' || i.kind === 'window';

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}

function openingsOnFurniture(p) {
  const found = [];
  for (const o of p.items.filter(isOpening)) {
    for (const f of p.items.filter((i) => i.kind === 'layout' && i.room === o.room)) {
      if (overlaps(o.value.position, f.value.position)) found.push([o.id, f.id]);
    }
  }
  return found;
}

test('Builder proposes changes only for Unsure door and window items it owns', () => {
  const p = loadSample();
  const ids = builderAgent(makeReadOnlyView(p)).map((x) => x.itemId);
  const expected = p.items.filter((i) => isOpening(i) && i.status === 'Unsure').map((i) => i.id);
  assert.deepEqual(ids, expected);
  assert.ok(ids.length >= 1);
  assert.ok(p.items.some((i) => i.kind === 'door') && p.items.some((i) => i.kind === 'window'));
});

test('Builder never proposes changes to style, layout or clash items', () => {
  const p = loadSample();
  for (const { itemId } of builderAgent(makeReadOnlyView(p))) {
    assert.ok(isOpening(getItem(p, itemId)));
  }
});

test('in a full run, Builder changes only Unsure door and window items', () => {
  const p = loadSample();
  const before = snapshot(p);
  const result = runPipeline(p, { agents: { Builder: builderAgent } });
  assert.equal(result.ok, true);
  const versions = listVersions(p);
  assert.ok(versions.length >= 1);
  for (const v of versions) {
    assert.equal(v.who, 'Builder');
    const item = getItem(p, v.item);
    assert.ok(isOpening(item));
    assert.equal(item.status, 'Unsure');
  }
  const after = snapshot(p);
  before.forEach((b, i) => {
    if (!(isOpening(b) && b.status === 'Unsure')) assert.deepEqual(after[i], b);
  });
});

test('a Locked door or window is unchanged, even if it is proposed', () => {
  const p = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'A' }] }] });
  const pos = { x: 0, y: 0, width: 1, depth: 0.1 };
  createItem(p, { kind: 'door', owner: 'Builder', status: 'Unsure', room: 'floor-1-room-1', value: { name: 'Door', position: pos } });
  createItem(p, { kind: 'window', owner: 'Builder', status: 'Locked', room: 'floor-1-room-1', value: { name: 'Window', position: pos } });
  const locked = structuredClone(p.items[1]);

  runPipeline(p, { agents: { Builder: builderAgent } });
  assert.deepEqual(p.items[1], locked);
  assert.ok(!listVersions(p).some((v) => v.item === locked.id));
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 0);

  runPipeline(p, { agents: { Builder: () => [{ itemId: locked.id, newValue: { name: 'Moved' } }] } });
  assert.deepEqual(p.items[1], locked);
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 1);
});

test('the sample still has the door-on-furniture case before and after Style, Layout and Builder run', () => {
  const p = loadSample();
  assert.equal(openingsOnFurniture(p).length, 1);
  const result = runPipeline(p, { agents: { Style: sampleStyleAgent, Layout: layoutAgent, Builder: builderAgent } });
  assert.equal(result.ok, true);
  const found = openingsOnFurniture(p);
  assert.equal(found.length, 1);
  assert.equal(getItem(p, found[0][0]).value.name, 'Garden door');
  assert.equal(getItem(p, found[0][1]).value.name, 'Sofa');
});

test('Builder does not change items owned by other agents', () => {
  const p = loadSample();
  const before = snapshot(p);
  runPipeline(p, { agents: { Style: sampleStyleAgent, Layout: layoutAgent, Builder: builderAgent } });
  const after = snapshot(p);
  before.forEach((b, i) => {
    if (b.kind === 'clash') assert.deepEqual(after[i], b);
  });
  for (const v of listVersions(p).filter((x) => x.who === 'Builder')) {
    assert.equal(getItem(p, v.item).owner, 'Builder');
  }
});

test('Builder does not change the view it reads, and gives the same answer twice', () => {
  const p = loadSample();
  const view = makeReadOnlyView(p);
  const first = builderAgent(view);
  assert.deepEqual(builderAgent(view), first);
  assert.deepEqual(view.items, makeReadOnlyView(p).items);
});

test('Builder writes nothing outside its own folder or items: its code only reads', () => {
  const folder = new URL('../src/agents/builder/', import.meta.url);
  assert.deepEqual(readdirSync(folder).filter((f) => f !== '.gitkeep').sort(), ['agent.js', 'agent.json']);
  const code = readFileSync(new URL('agent.js', folder), 'utf8');
  assert.deepEqual([...code.matchAll(/^import .* from '(.+)';$/gm)], []);
  assert.doesNotMatch(code, /writeFile|appendFile|createGatekeeper|changeItem|changeStatus|appendVersion|runLog|\.items\.push|\.versions\.push/);
});
