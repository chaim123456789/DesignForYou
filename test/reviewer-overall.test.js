import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject, createItem } from '../src/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../src/brain/inspiration.js';
import { runPipeline, makeReadOnlyView } from '../src/coordinator.js';
import { createReviewerAgent, NO_CLASHES, NO_CLASHES_NOTE } from '../src/agents/reviewer/agent.js';
import { runSample } from '../src/sample/run-sample.js';
import { makeSampleRun } from '../src/viewer/make-sample-run.js';
import { runTeamSample, makeTeamSampleRun } from '../src/sample/run-team-sample.js';
import { createState, setProjectName, addFloor, addRoom, addNote, addItem } from '../docs/intake/state.js';
import { QUESTIONS } from '../docs/intake/taste.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';

const PAIRS = [['warm oak', 'cold steel'], ['linen', 'glossy chrome']];
const reviewer = createReviewerAgent({ styleConflicts: PAIRS });

// Two rooms, no overrides. Overall notes are given by the test. Items are added by the test.
function twoRooms(overall) {
  const p = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'Kitchen' }, { name: 'Bedroom' }] }] });
  if (overall) setProjectInspiration(p, overall);
  createItem(p, { kind: 'clash', owner: 'Reviewer', value: { summary: 'Not reviewed yet', clashes: [] } });
  return p;
}
const KITCHEN = 'floor-1-room-1';
const BEDROOM = 'floor-1-room-2';
const lockedOak = (p, room, detail = 'Oak floor', tag = 'warm oak', status = 'Locked') =>
  createItem(p, { kind: 'style', owner: 'Style', status, room, value: tag ? { tag, detail } : { detail } });
const reportOf = (p) => runPipeline(p, { agents: { Reviewer: reviewer } }) && p.items.find((i) => i.kind === 'clash').value;

test('Task 5b: an overall note "cold steel" with a Locked "warm oak" item gives a clash', () => {
  const p = twoRooms(['cold steel']);
  lockedOak(p, KITCHEN);
  const report = reportOf(p);
  assert.equal(report.summary, '1 clash found');
  assert.equal(report.clashes.length, 1);
  assert.equal(report.clashes[0].type, 'Overall style against Locked item');
  assert.equal(report.clashes[0].room, KITCHEN);
  assert.equal(report.clashes[0].description, 'In the Kitchen, the overall style "cold steel" conflicts with the Locked item "Oak floor" (warm oak).');
});

test('Task 5b: the opposite pair works in either order (Locked "cold steel", overall note "warm oak")', () => {
  const p = twoRooms(['warm oak']);
  lockedOak(p, KITCHEN, 'Steel worktop', 'cold steel');
  assert.equal(reportOf(p).clashes.length, 1);
});

test('Task 5b: a style profile tag that clashes with a Locked item gives a clash (built from taste answers through the intake)', () => {
  const question = QUESTIONS.find((q) => q.id === QUESTIONS[4].id);
  const tag = question.answers[0].tag;
  const state = createState();
  setProjectName(state, 'Profile test');
  const floor = addFloor(state, 'Ground').id;
  const room = addRoom(state, floor, 'Kitchen', 4, 4).id;
  addNote(state, 'overall', 'linen');
  state.tasteAnswers = { [question.id]: question.answers[0].id };
  addItem(state, { text: 'Oak floor', room, status: 'Locked', tag: 'warm oak' });
  // Same Reviewer, with one pair that uses the real profile tag.
  const agents = { Reviewer: createReviewerAgent({ styleConflicts: [['warm oak', tag]] }) };
  const { ok, project } = runDesignTeam(state, { agents });
  assert.equal(ok, true);
  assert.ok(project.inspiration.includes(tag), 'the profile tag is in the overall set');
  const report = project.items.find((i) => i.kind === 'clash').value;
  assert.equal(report.clashes.length, 1);
  assert.equal(report.clashes[0].type, 'Overall style against Locked item');
  assert.match(report.clashes[0].description, new RegExp(`overall style "${tag}" conflicts with the Locked item "Oak floor" \\(warm oak\\)`));
});

test('Task 5b: a removed profile tag is not compared (no clash)', () => {
  const question = QUESTIONS[4];
  const tag = question.answers[0].tag;
  const state = createState();
  setProjectName(state, 'Removed tag');
  const floor = addFloor(state, 'Ground').id;
  const room = addRoom(state, floor, 'Kitchen', 4, 4).id;
  state.tasteAnswers = { [question.id]: question.answers[0].id };
  state.removedTags = [tag];
  addItem(state, { text: 'Oak floor', room, status: 'Locked', tag: 'warm oak' });
  const agents = { Reviewer: createReviewerAgent({ styleConflicts: [['warm oak', tag]] }) };
  const { project } = runDesignTeam(state, { agents });
  assert.equal(project.items.find((i) => i.kind === 'clash').value.summary, NO_CLASHES);
});

test('Task 5b: no matching pair gives "No clashes found" and the report says it found nothing in this small list', () => {
  const p = twoRooms(['warm oak', 'linen', 'soft white walls']);
  lockedOak(p, KITCHEN);
  const report = reportOf(p);
  assert.equal(report.summary, 'No clashes found');
  assert.equal(report.summary, NO_CLASHES);
  assert.deepEqual(report.clashes, []);
  assert.equal(report.note, NO_CLASHES_NOTE);
  assert.match(report.note, /found nothing in this small list/);
  assert.match(report.note, /does not mean there are no problems/);
});

test('Task 5b: the "found nothing in this small list" note is only on a report with no clashes', () => {
  const p = twoRooms(['cold steel']);
  lockedOak(p, KITCHEN);
  const report = reportOf(p);
  assert.equal('note' in report, false);
});

test('Task 5b: a room with an override uses the override and not the overall notes', () => {
  const p = twoRooms(['cold steel']);
  setRoomOverride(p, KITCHEN, ['soft white']);
  lockedOak(p, KITCHEN, 'Oak floor');
  lockedOak(p, BEDROOM, 'Oak bed');
  const report = reportOf(p);
  // The Kitchen has an override with no opposite, so the overall "cold steel" is not used there.
  // The Bedroom has no override, so the overall "cold steel" is compared there.
  assert.equal(report.clashes.length, 1);
  assert.equal(report.clashes[0].room, BEDROOM);
  assert.equal(report.clashes[0].type, 'Overall style against Locked item');
});

test('Task 5b: an override that clashes is still reported as a room override clash, and overall notes are not added on top', () => {
  const p = twoRooms(['cold steel']);
  setRoomOverride(p, KITCHEN, ['cold steel', 'dark slate']);
  lockedOak(p, KITCHEN);
  const report = reportOf(p);
  assert.equal(report.clashes.length, 1);
  assert.equal(report.clashes[0].type, 'Room override against Locked item');
  assert.match(report.clashes[0].description, /the room style "cold steel"/);
});

test('Task 5b: items without a tag are skipped', () => {
  const p = twoRooms(['cold steel']);
  lockedOak(p, KITCHEN, 'Plain floor', '');
  assert.equal(reportOf(p).summary, NO_CLASHES);
});

test('Task 5b: Unsure items and items with no room are not compared', () => {
  const p = twoRooms(['cold steel']);
  lockedOak(p, KITCHEN, 'Maybe oak', 'warm oak', 'Unsure');
  createItem(p, { kind: 'style', owner: 'Style', status: 'Locked', value: { tag: 'warm oak', detail: 'No room' } });
  assert.equal(reportOf(p).summary, NO_CLASHES);
});

test('Task 5b: the clash report keeps the same format (number, type, items, room, description, severity)', () => {
  const p = twoRooms(['cold steel']);
  lockedOak(p, KITCHEN);
  const [clash] = reportOf(p).clashes;
  assert.deepEqual(Object.keys(clash), ['number', 'type', 'items', 'room', 'description', 'severity']);
  assert.equal(clash.number, 1);
  assert.equal(clash.severity, 'Medium');
});

test('Task 5b: the Reviewer still only reads: it returns one proposal for its own clash item and changes nothing else', () => {
  const p = twoRooms(['cold steel']);
  lockedOak(p, KITCHEN);
  const before = structuredClone(p.items.filter((i) => i.kind === 'style'));
  const proposals = reviewer(makeReadOnlyView(p));
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].itemId, p.items.find((i) => i.kind === 'clash').id);
  runPipeline(p, { agents: { Reviewer: reviewer } });
  assert.deepEqual(p.items.filter((i) => i.kind === 'style'), before);
});

test('Task 5b: the sample run output is unchanged (matches docs/sample-run.json exactly, and has no overall-style clash)', () => {
  // D6: the sample file now comes from the design-team sample. The old four-agent run is still checked below.
  const team = runTeamSample();
  const expected = readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8');
  assert.equal(JSON.stringify(makeTeamSampleRun(team), null, 2) + '\n', expected);
  const { project } = runSample();
  const report = project.items.find((i) => i.kind === 'clash').value;
  assert.equal(report.clashes.length, 2);
  assert.equal(report.clashes.some((c) => c.type === 'Overall style against Locked item'), false);
  assert.equal('note' in report, false);
});
