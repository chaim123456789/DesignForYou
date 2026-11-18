import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../src/brain/inspiration.js';
import { runPipeline, makeReadOnlyView } from '../src/coordinator.js';
import { createReviewerAgent, reviewerAgent, NO_CLASHES } from '../src/agents/reviewer/agent.js';
import { layoutAgent } from '../src/agents/layout/agent.js';
import { builderAgent } from '../src/agents/builder/agent.js';
import { sampleStyleAgent } from '../src/agents/style/agent.js';
import { SAMPLE_LABEL, DRAFT_STATEMENT } from '../src/label.js';

const sample = JSON.parse(readFileSync(new URL('../src/sample/sample-project.json', import.meta.url), 'utf8'));
const sampleReviewer = createReviewerAgent({ styleConflicts: sample.styleConflicts, isSample: true });

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

const allAgents = { Style: sampleStyleAgent, Layout: layoutAgent, Builder: builderAgent, Reviewer: sampleReviewer };
const snapshot = (p) => p.items.map((i) => ({ id: i.id, kind: i.kind, status: i.status, owner: i.owner, value: structuredClone(i.value) }));
const reportOf = (p) => p.items.find((i) => i.kind === 'clash').value;

// A project with a clash item and nothing that clashes.
function cleanProject() {
  const p = createProject({ name: 'Clean', floors: [{ name: 'G', rooms: [{ name: 'A' }] }] });
  setProjectInspiration(p, ['warm oak']);
  createItem(p, { kind: 'layout', owner: 'Layout', room: 'floor-1-room-1', value: { name: 'Sofa', position: { x: 0, y: 0, width: 2, depth: 1 } } });
  createItem(p, { kind: 'door', owner: 'Builder', room: 'floor-1-room-1', value: { name: 'Door', position: { x: 3, y: 0, width: 1, depth: 0.1 } } });
  createItem(p, { kind: 'clash', owner: 'Reviewer', value: { summary: 'Not reviewed yet', clashes: [] } });
  return p;
}

test('the sample report has at least 2 clashes, one of each type', () => {
  const p = loadSample();
  const result = runPipeline(p, { agents: allAgents });
  assert.equal(result.ok, true);
  const { clashes } = reportOf(p);
  assert.ok(clashes.length >= 2);
  const types = new Set(clashes.map((c) => c.type));
  assert.ok(types.has('Door or window on furniture'));
  assert.ok(types.has('Room override against Locked item'));
});

test('each clash lists the items, room, plain description and severity', () => {
  const p = loadSample();
  runPipeline(p, { agents: allAgents });
  for (const c of reportOf(p).clashes) {
    assert.ok(Array.isArray(c.items) && c.items.length >= 1);
    for (const id of c.items) assert.ok(getItem(p, id), `item ${id} exists`);
    assert.ok(p.floors.some((f) => f.rooms.some((r) => r.id === c.room)), 'room exists');
    assert.equal(typeof c.description, 'string');
    assert.ok(c.description.length > 10);
    assert.ok(['High', 'Medium', 'Low'].includes(c.severity));
  }
});

test('the sample clashes are the Garden door on the Sofa, and the Bedroom override against the Locked oak', () => {
  const p = loadSample();
  runPipeline(p, { agents: allAgents });
  const { clashes } = reportOf(p);
  const door = clashes.find((c) => c.type === 'Door or window on furniture');
  assert.deepEqual(door.items.map((id) => getItem(p, id).value.name), ['Garden door', 'Sofa']);
  assert.equal(door.severity, 'High');
  const override = clashes.find((c) => c.type === 'Room override against Locked item');
  assert.equal(getItem(p, override.items[0]).value.detail, 'Oak bed frame stays as it is');
  assert.match(override.description, /Bedroom/);
});

test('a clean project gives "No clashes found"', () => {
  const p = cleanProject();
  runPipeline(p, { agents: { Reviewer: createReviewerAgent() } });
  const report = reportOf(p);
  assert.equal(report.summary, NO_CLASHES);
  assert.equal(report.summary, 'No clashes found');
  assert.deepEqual(report.clashes, []);
});

test('the sample run does not report the clean pairs: a door beside a sofa is not a clash', () => {
  const p = cleanProject();
  const [proposal] = createReviewerAgent()(makeReadOnlyView(p));
  assert.equal(proposal.newValue.clashes.length, 0);
});

test('the Reviewer changes no item owned by another agent', () => {
  const p = loadSample();
  runPipeline(p, { agents: { Style: sampleStyleAgent, Layout: layoutAgent, Builder: builderAgent } });
  const before = snapshot(p).filter((i) => i.kind !== 'clash');
  const versionsBefore = listVersions(p).length;
  runPipeline(p, { agents: { Reviewer: sampleReviewer } });
  assert.deepEqual(snapshot(p).filter((i) => i.kind !== 'clash'), before);
  const newVersions = listVersions(p).slice(versionsBefore);
  assert.ok(newVersions.length >= 1);
  for (const v of newVersions) {
    assert.equal(v.who, 'Reviewer');
    assert.equal(getItem(p, v.item).owner, 'Reviewer');
    assert.equal(getItem(p, v.item).kind, 'clash');
  }
});

test('the Reviewer only reads: its proposals target only Reviewer-owned items, and the view is not changed', () => {
  const p = loadSample();
  const view = makeReadOnlyView(p);
  const proposals = sampleReviewer(view);
  assert.equal(proposals.length, 1);
  assert.equal(getItem(p, proposals[0].itemId).owner, 'Reviewer');
  assert.deepEqual(view.items, makeReadOnlyView(p).items);
  assert.deepEqual(sampleReviewer(view), proposals);
});

test('the report is saved through the gatekeeper and appears in version history', () => {
  const p = loadSample();
  runPipeline(p, { agents: allAgents });
  const clashItem = p.items.find((i) => i.kind === 'clash');
  const mine = listVersions(p).filter((v) => v.item === clashItem.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].who, 'Reviewer');
  assert.equal(mine[0].field, 'value');
  assert.equal(mine[0].oldValue.summary, 'Not reviewed yet');
  assert.deepEqual(mine[0].newValue, clashItem.value);
  // The version numbers are still 1, 2, 3, ... with no gaps.
  listVersions(p).forEach((v, i) => assert.equal(v.number, i + 1));
});

test('a Locked report item is refused by the gatekeeper, not overwritten', () => {
  const p = loadSample();
  const clashItem = p.items.find((i) => i.kind === 'clash');
  clashItem.status = 'Locked';
  const before = structuredClone(clashItem.value);
  runPipeline(p, { agents: allAgents });
  assert.deepEqual(clashItem.value, before);
  assert.ok(p.runLog.some((e) => e.agent === 'Reviewer' && e.event === 'refused'));
});

test('the report carries the SAMPLE PROJECT label and the draft statement', () => {
  const p = loadSample();
  runPipeline(p, { agents: allAgents });
  const { labels } = reportOf(p);
  assert.ok(labels.includes(SAMPLE_LABEL));
  assert.ok(labels.includes(DRAFT_STATEMENT));
});

test('a project that is not a sample gets the draft statement but no sample label', () => {
  const p = cleanProject();
  runPipeline(p, { agents: { Reviewer: reviewerAgent } });
  const { labels } = reportOf(p);
  assert.ok(!labels.includes(SAMPLE_LABEL));
  assert.ok(labels.includes(DRAFT_STATEMENT));
});

test('the Reviewer gives the same report when run twice from the same start', () => {
  const a = loadSample();
  const b = loadSample();
  runPipeline(a, { agents: allAgents, now: () => '2026-01-01T00:00:00.000Z' });
  runPipeline(b, { agents: allAgents, now: () => '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(reportOf(a), reportOf(b));
});

test('with no clash item the Reviewer fails with a clear message and the run stops', () => {
  const p = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'A' }] }] });
  const result = runPipeline(p, { agents: { Reviewer: reviewerAgent } });
  assert.equal(result.ok, false);
  assert.equal(result.failedAgent, 'Reviewer');
  assert.match(result.reason, /clash report item/);
});

test('the Reviewer writes nothing: its code never uses the gatekeeper or the Brain writers', () => {
  const folder = new URL('../src/agents/reviewer/', import.meta.url);
  assert.deepEqual(readdirSync(folder).filter((f) => f !== '.gitkeep').sort(), ['agent.js', 'agent.json']);
  const code = readFileSync(new URL('agent.js', folder), 'utf8');
  const imports = [...code.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../../brain/inspiration.js', '../../label.js']);
  assert.doesNotMatch(code, /writeFile|appendFile|createGatekeeper|changeItem|changeStatus|appendVersion|runLog|\.items\.push|\.versions\.push|\.value\s*=[^=]/);
});
