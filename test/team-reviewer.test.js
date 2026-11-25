// design-team Group C, Task C4: the Reviewer extension and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { createRun, runWithScript } from '../src/team-coordinator.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';
import { makeTeamReviewerAgent, loadReviewerKnowledge, NO_CLASHES_PREFIX } from '../src/agents/team-reviewer/agent.js';
import { makeFurnitureAgent } from '../src/agents/furniture/agent.js';
import { createReviewerAgent } from '../src/agents/reviewer/agent.js';
import { SAMPLE_LABEL, DRAFT_STATEMENT } from '../src/label.js';
import { buildLater, piece, view, firstFour, off, registry, settle, NOW } from '../test-helpers/team-project.js';

const agent = makeTeamReviewerAgent({ registry });
const k = loadReviewerKnowledge();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';
const R2 = 'floor-1-room-2';
const door = (room, x, y) => ({ kind: 'door', room, name: 'Door', position: { x, y, width: 0.9, depth: 0.1 } });
const report = (t, extra = {}) => {
  const out = makeTeamReviewerAgent({ registry, ...extra })(view(t.project), ctx);
  return out.length === 0 ? null : out[0].options[0].newValue;
};
const types = (r) => r.clashes.map((c) => c.type);

// A clean home: a door in each room, nothing in anyone's way, every item up to date.
function clean(furniture = [piece(R1, 'sofa', 'Sofa', 1.5, 2, 1.5, 0.8)]) {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }, { name: 'Study', width: 3, depth: 3 }], openings: [door(R1, 0.2, 0), door(R2, 1, 0)], furniture });
  settle(t.project);
  return t;
}

test('design-team C4: with no findings the report says "No clashes found, using these checks:" and lists every check', () => {
  const r = report(clean());
  assert.deepEqual(r.clashes, []);
  assert.ok(r.summary.startsWith(NO_CLASHES_PREFIX), r.summary);
  assert.equal(NO_CLASHES_PREFIX, 'No clashes found, using these checks:');
  const names = k.checks.filter((c) => c.when.report !== 'summary').map((c) => c.then.name);
  assert.ok(names.length >= 10);
  for (const n of names) assert.ok(r.summary.includes(n), `the summary lists "${n}"`);
  assert.deepEqual(r.checks, names);
  assert.ok(r.labels.includes(DRAFT_STATEMENT));
});

test('design-team C4: a door that opens into furniture fires, and stays quiet when the swing is free', () => {
  const bad = clean([piece(R1, 'sofa', 'Sofa', 0.1, 0.2, 1.5, 0.8)]); // the door is at x 0.2 to 1.1, swing square 0.9 by 0.9
  const r = report(bad);
  assert.ok(types(r).includes('Door opens into furniture'));
  const line = r.clashes.find((c) => c.type === 'Door opens into furniture');
  assert.equal(line.severity, 'High');
  assert.equal(line.room, R1);
  assert.match(line.description, /swing of the Door runs into the Sofa/);
  assert.equal(line.checkId, 'check-door-swing-furniture');
  assert.equal(line.items.length, 2);
  assert.ok(!types(report(clean())).includes('Door opens into furniture'));
});

test('design-team C4: a light with no switch fires, and stays quiet when the room has a switch', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }, { name: 'Study', width: 3, depth: 3 }], openings: [door(R1, 0.2, 0)] });
  settle(t.project);
  const r = report(t);
  const lines = r.clashes.filter((c) => c.type === 'Light with no switch');
  assert.deepEqual(lines.map((c) => c.room), [R2], 'only the Study, which has no door and so no switch');
  assert.equal(lines[0].severity, 'Medium');
  assert.ok(!types(report(clean())).includes('Light with no switch'));
});

test('design-team C4: a living room, bedroom or kitchen with no window light fires; the others and rooms with a window do not', () => {
  const t = clean();
  assert.ok(!types(report(t)).includes('Room with no window light'), 'the Doors agent gave each room a window');
  for (const w of t.project.items.filter((i) => i.kind === 'window')) w.value = { name: w.value.name, placeholder: true };
  const r = report(t);
  const lines = r.clashes.filter((c) => c.type === 'Room with no window light');
  assert.deepEqual(lines.map((c) => c.room), [R1], 'the Living Room fires; the Study is not a type that needs a window');
  assert.equal(lines[0].checkId, 'check-no-window-light');
});

test('design-team C4: a stale item is reported; once everything is re-checked it is not', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }], openings: [door(R1, 0.2, 0)], furniture: [piece(R1, 'sofa', 'Sofa', 1.5, 2, 1.5, 0.8)] });
  const r = report(t);
  const stale = r.clashes.filter((c) => c.type === 'Item out of date');
  assert.ok(stale.length > 0);
  assert.ok(stale.some((c) => c.items[0] === t.later.furniture[0]));
  assert.ok(stale.every((c) => c.checkId === 'report-stale' && c.tag === 'Rule-based'));
  assert.ok(!stale.some((c) => c.items[0] === t.later.clash), 'the report item is not reported as stale');
  settle(t.project);
  assert.equal(report(t).clashes.filter((c) => c.type === 'Item out of date').length, 0);
});

test('design-team C4: a skipped proposal is reported as kept as is', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }], openings: [door(R1, 0.2, 0)], furniture: [piece(R1, 'sofa', 'Sofa', 0.1, 0.2, 1.5, 0.8)] });
  const r = runWithScript(t.project, {
    registry, now: NOW, agents: { ...firstFour(), Furniture: makeFurnitureAgent(), Reviewer: agent }, configs: off(['Decor', 'Style']),
    policy: (p) => (p.agent === 'Furniture' ? 'skip' : 'first'),
  });
  assert.equal(r.ok, true);
  const sofa = t.later.furniture[0];
  assert.deepEqual(r.run.keptAsIs.map((x) => x.itemId), [sofa]);
  const saved = t.project.items.find((i) => i.kind === 'clash').value;
  const line = saved.clashes.find((c) => c.type === 'Item kept as is');
  assert.ok(line, 'the saved report has a kept-as-is line');
  assert.deepEqual(line.items, [sofa]);
  assert.match(line.description, /You chose to keep the Sofa as it is/);
  assert.equal(line.severity, 'Low');
  assert.deepEqual(t.project.items.find((i) => i.id === sofa).value.position, { x: 0.1, y: 0.2, width: 1.5, depth: 0.8 }, 'the sofa was left alone');
});

test('design-team C4: a Locked item that is out of date is reported as needing a look, and is not changed', () => {
  const t = clean([piece(R1, 'sofa', 'Locked sofa', 1.5, 2, 1.5, 0.8, { status: 'Locked' })]);
  const wall = t.project.items.find((i) => i.kind === 'wall' && i.room === R1);
  const gate = createGatekeeper(t.project, { now: NOW });
  assert.equal(gate.changeItem('Walls', wall.id, { ...wall.value, note: 'moved' }, { approvedBy: 'scripted answer' }).accepted, true);
  const before = structuredClone(t.project.items.find((i) => i.id === t.later.furniture[0]).value);
  const r = report(t);
  const line = r.clashes.find((c) => c.type === 'Locked item needs your look');
  assert.ok(line);
  assert.deepEqual(line.items, [t.later.furniture[0]]);
  assert.equal(line.severity, 'High');
  assert.equal(r.clashes.some((c) => c.type === 'Item out of date' && c.items[0] === t.later.furniture[0]), false, 'a Locked item is listed once, as needing a look');
  assert.deepEqual(t.project.items.find((i) => i.id === t.later.furniture[0]).value, before);
});

test('design-team C4: the four checks of the first Reviewer still run, with the tag added', () => {
  const t = clean([piece(R1, 'sofa', 'Sofa', 1.5, 2, 1.5, 0.8), piece(R1, 'table', 'Table', 1.8, 2.2, 1.4, 0.7), piece(R1, 'desk', 'Desk', 3.5, 0.2, 1.2, 0.6)]);
  const r = report(t);
  assert.ok(types(r).includes('Furniture overlaps furniture'));
  assert.ok(types(r).includes('Object outside its room'));
  assert.ok(r.clashes.every((c) => typeof c.checkId === 'string' && c.tag === 'Rule-based' && ['High', 'Medium', 'Low'].includes(c.severity)));
  // the old Reviewer, called directly, finds the same two lines
  const old = createReviewerAgent({ reportItemId: t.later.clash })(view(t.project))[0].newValue.clashes.map((c) => c.type);
  assert.deepEqual(old, ['Furniture overlaps furniture', 'Object outside its room']);
});

test('design-team C4: every report line has the two items, the room, a sentence, a severity and a Rule-based tag, numbered in order', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }, { name: 'Study', width: 3, depth: 3 }], openings: [door(R1, 0.2, 0)], furniture: [piece(R1, 'sofa', 'Sofa', 0.1, 0.2, 1.5, 0.8)] });
  const r = report(t);
  assert.ok(r.clashes.length >= 3);
  r.clashes.forEach((c, i) => {
    assert.equal(c.number, i + 1);
    assert.ok(Array.isArray(c.items));
    assert.ok(typeof c.description === 'string' && c.description.length > 0);
    assert.equal(c.tag, 'Rule-based');
    assert.ok(c.severity);
    assert.ok('room' in c);
  });
});

test('design-team C4: the Reviewer cannot be turned off, and changes only its own report item', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }], openings: [door(R1, 0.2, 0)], furniture: [piece(R1, 'sofa', 'Sofa', 1.5, 2, 1.5, 0.8)] });
  const run = createRun(t.project, { registry, now: NOW, scripted: true, agents: { Reviewer: agent }, configs: [{ name: 'Reviewer', enabled: false }, ...['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style'].map((name) => ({ name, enabled: false }))] });
  const before = t.project.versions.length;
  for (let s = run.next(); !s.done; s = run.next()) for (const p of s.proposals) { assert.equal(p.itemId, t.later.clash); run.answer(p.id, p.options[0].id); }
  assert.ok(t.project.runLog.some((e) => e.agent === 'Reviewer' && e.event === 'started'));
  assert.ok(!t.project.runLog.some((e) => e.agent === 'Reviewer' && e.event === 'skipped'));
  const added = t.project.versions.slice(before);
  assert.equal(added.length, 1);
  assert.equal(added[0].who, 'Reviewer');
  assert.equal(added[0].item, t.later.clash);
  assert.equal(JSON.parse(readFileSync(new URL('../src/agents/reviewer/agent.json', import.meta.url), 'utf8')).enabled, true);
});

test('design-team C4: the same input twice gives the same report, and the sample label is added when asked', () => {
  const a = report(clean());
  const b = report(clean());
  assert.deepEqual(a, b);
  const labelled = report(clean(), { reviewerOptions: { isSample: true } });
  assert.ok(labelled.labels.includes(SAMPLE_LABEL));
  assert.ok(labelled.labels.includes(DRAFT_STATEMENT));
  assert.ok(!a.labels.includes(SAMPLE_LABEL));
});

test('design-team C4: every check is in checks.json with a severity that exists in severities.json, and the files pass the provenance check', () => {
  const levels = new Set(k.severities.map((r) => r.when.severity));
  for (const c of k.checks) assert.ok(levels.has(c.then.severity), c.id);
  const dir = fileURLToPath(new URL('../src/knowledge/reviewer/', import.meta.url));
  const files = readdirSync(dir).sort();
  assert.deepEqual(files, ['checks.json', 'severities.json']);
  for (const f of files) assert.ok(loadKnowledge(`reviewer/${f}`).provenance.sources.length > 0);
  assert.throws(() => makeTeamReviewerAgent({ registry, knowledge: { ...k, checks: [{ ...k.checks[0], then: { ...k.checks[0].then, severity: 'Huge' } }] } }), /not in severities.json/);
});
