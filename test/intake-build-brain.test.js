import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createState, setProjectName, addFloor, addRoom, addNote, addImage, setBrief, addItem,
} from '../docs/intake/state.js';
import { QUESTIONS } from '../docs/intake/taste.js';
import { STYLE_CONFLICTS } from '../docs/intake/limits.js';
import { buildBrain, runProject, runDesignTeam } from '../docs/intake/build-brain.js';
import { runSample, readSampleData } from '../src/sample/run-sample.js';
import { makeSampleRun } from '../src/viewer/make-sample-run.js';

const root = fileURLToPath(new URL('..', import.meta.url));

// Known inputs: 2 floors, 3 rooms, overall notes, an override on the Bedroom, 4 items.
function knownState() {
  const s = createState();
  setProjectName(s, 'My Home');
  const f1 = addFloor(s, 'Ground').id;
  const f2 = addFloor(s, 'Upper').id;
  const kitchen = addRoom(s, f1, 'Kitchen', 4, 4).id;
  const living = addRoom(s, f1, 'Living Room', 5, 4).id;
  const bedroom = addRoom(s, f2, 'Bedroom', 4, 4).id;
  addNote(s, 'overall', 'warm oak');
  addNote(s, 'overall', 'linen');
  addNote(s, bedroom, 'cold steel');
  addNote(s, bedroom, 'dark slate');
  setBrief(s, 'A calm family home.');
  s.tasteAnswers = { [QUESTIONS[0].id]: QUESTIONS[0].answers[0].id };
  addImage(s, 'overall', { name: 'a.png', type: 'image/png', size: 1000, caption: 'Sunny room' });
  addImage(s, bedroom, { name: 'b.jpg', type: 'image/jpeg', size: 2000 });
  addItem(s, { text: 'Oak floor in the kitchen', room: kitchen, status: 'Locked', tag: 'warm oak' });
  addItem(s, { text: 'Oak bed frame stays', room: bedroom, status: 'Locked', tag: 'warm oak' });
  addItem(s, { text: 'Curtains', room: living, status: 'Unsure', tag: 'linen' });
  addItem(s, { text: 'Paint colour', room: living, status: 'Unsure', tag: '' });
  return s;
}

test('Task 4b: known inputs give the expected floors, rooms, inspiration, overrides and items with the right owner', () => {
  const state = knownState();
  const project = buildBrain(state);
  assert.equal(project.name, 'My Home');
  assert.equal(project.isSample, false);
  assert.deepEqual(project.floors.map((f) => [f.name, f.rooms.map((r) => r.name)]), [
    ['Ground', ['Kitchen', 'Living Room']],
    ['Upper', ['Bedroom']],
  ]);
  const profileTag = QUESTIONS[0].answers[0].tag;
  assert.deepEqual(project.inspiration, ['warm oak', 'linen', profileTag]);
  const bedroom = project.floors[1].rooms[0];
  assert.deepEqual(bedroom.override, ['cold steel', 'dark slate']);
  assert.equal('override' in project.floors[0].rooms[0], false);
  assert.equal(project.items.length, 5);
  const [kitchenOak, bedOak, curtains, paint, clash] = project.items;
  assert.deepEqual(
    [kitchenOak.kind, kitchenOak.owner, kitchenOak.status, kitchenOak.room, kitchenOak.value],
    ['style', 'Style', 'Locked', 'floor-1-room-1', { detail: 'Oak floor in the kitchen', tag: 'warm oak' }],
  );
  assert.deepEqual([bedOak.owner, bedOak.status, bedOak.room], ['Style', 'Locked', bedroom.id]);
  assert.deepEqual([curtains.owner, curtains.status, curtains.room], ['Style', 'Unsure', 'floor-1-room-2']);
  assert.deepEqual(paint.value, { detail: 'Paint colour' });
  assert.deepEqual([clash.kind, clash.owner, clash.value.summary], ['clash', 'Reviewer', 'Not reviewed yet']);
});

test('Task 4b: the brief, the profile sentences and the image count are kept as optional project fields; images are not in the Brain', () => {
  const project = buildBrain(knownState());
  assert.equal(project.brief, 'A calm family home.');
  assert.equal(project.imageCount, 2);
  assert.ok(project.styleProfile.length > 0);
  const text = JSON.stringify(project);
  assert.equal(text.includes('a.png'), false);
  assert.equal(text.includes('Sunny room'), false);
});

test('Task 4b: building the Brain does not change the inputs', () => {
  const state = knownState();
  const before = structuredClone(state);
  buildBrain(state);
  runDesignTeam(state);
  assert.deepEqual(state, before);
});

test('Task 4b: Locked items are deep-equal before and after the run', () => {
  const project = buildBrain(knownState());
  const lockedBefore = structuredClone(project.items.filter((i) => i.status === 'Locked'));
  assert.equal(lockedBefore.length, 2);
  const result = runProject(project);
  assert.equal(result.ok, true);
  const lockedAfter = project.items.filter((i) => i.status === 'Locked');
  assert.deepEqual(lockedAfter, lockedBefore);
});

test('Task 4b: Unsure style items get the room notes added by the normal Style agent', () => {
  const { project } = runDesignTeam(knownState());
  const curtains = project.items.find((i) => i.value.detail.startsWith('Curtains'));
  assert.match(curtains.value.detail, /kept in line with: warm oak, linen,/);
});

test('Task 4b: two runs of the same inputs are deep-equal', () => {
  const a = runDesignTeam(knownState());
  const b = runDesignTeam(knownState());
  assert.equal(a.ok, true);
  assert.deepEqual(a.project, b.project);
});

test('Task 4b: the run order in the log is Style, Layout, Builder, Reviewer', () => {
  const { project } = runDesignTeam(knownState());
  const started = project.runLog.filter((e) => e.event === 'started').map((e) => e.agent);
  assert.deepEqual(started, ['Style', 'Layout', 'Builder', 'Reviewer']);
  assert.equal(project.runLog.some((e) => e.event === 'refused'), false);
});

test('Task 4b: a room override "cold steel" with a Locked "warm oak" item in that room gives the expected clash', () => {
  const { project } = runDesignTeam(knownState());
  const report = project.items.find((i) => i.kind === 'clash').value;
  assert.equal(report.summary, '1 clash found');
  assert.equal(report.clashes.length, 1);
  assert.equal(report.clashes[0].type, 'Room override against Locked item');
  assert.equal(report.clashes[0].room, 'floor-2-room-1');
  assert.match(report.clashes[0].description, /Bedroom.*"cold steel".*"Oak bed frame stays".*\(warm oak\)/);
});

test('Task 4b: with no override the report says "No clashes found"', () => {
  const state = knownState();
  for (const key of Object.keys(state.overrides)) delete state.overrides[key];
  const { project } = runDesignTeam(state);
  const report = project.items.find((i) => i.kind === 'clash').value;
  assert.equal(report.summary, 'No clashes found');
  assert.deepEqual(report.clashes, []);
});

test('Task 4b: the Reviewer gets exactly the fixed list of opposite pairs, the same two pairs as the sample', () => {
  assert.deepEqual(STYLE_CONFLICTS.map((p) => [...p]), readSampleData().styleConflicts);
});

// ---- No agent reads the optional fields ----

const OPTIONAL_FIELD_WORDS = /\b(brief|styleProfile|imageCount|images)\b/;

function agentFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return agentFiles(full);
    return full.endsWith('.js') ? [full] : [];
  });
}
// The four agent files, in src/ and in the copies in docs/engine/.
function allAgentFiles() {
  return ['src/agents', 'docs/engine/agents']
    .flatMap((d) => agentFiles(path.join(root, d)))
    .filter((f) => f.endsWith(`${path.sep}agent.js`));
}
const mentions = (text) => OPTIONAL_FIELD_WORDS.test(text);

test('Task 4b: no agent file mentions brief, styleProfile, imageCount or images', () => {
  const files = allAgentFiles();
  // The four old agents in src/ and in docs/engine/ (8 files), plus every design-team agent that has its own folder in
  // src/agents/ (build-team-2: the count grows by one per new agent, and each new agent file is scanned too).
  const oldFolders = ['style', 'layout', 'builder', 'reviewer'];
  const teamFolders = readdirSync(path.join(root, 'src/agents')).filter((n) => !oldFolders.includes(n)
    && statSync(path.join(root, 'src/agents', n)).isDirectory() && readdirSync(path.join(root, 'src/agents', n)).includes('agent.js'));
  assert.equal(files.length, 8 + teamFolders.length);
  const hits = files.filter((f) => mentions(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  assert.deepEqual(hits, []);
});

test('Task 4b: planted read: the same check fails on a copy of an agent file that reads the brief, and on one that reads images', () => {
  const original = readFileSync(path.join(root, 'src/agents/style/agent.js'), 'utf8');
  assert.equal(mentions(original), false);
  assert.equal(mentions(`${original}\nconst x = view.brief;\n`), true);
  assert.equal(mentions(`${original}\nconst x = view.styleProfile;\n`), true);
  assert.equal(mentions(`${original}\nconst x = view.imageCount;\n`), true);
  assert.equal(mentions(`${original}\nconst x = view.images;\n`), true);
});

test('Task 4b: changing the brief, the profile sentences and the image count changes nothing the agents produce', () => {
  const a = buildBrain(knownState());
  const b = buildBrain(knownState());
  b.brief = 'A completely different brief, loud and bright.';
  b.styleProfile = ['Something else entirely.'];
  b.imageCount = 50;
  runProject(a);
  runProject(b);
  assert.deepEqual(a.items, b.items);
  assert.deepEqual(a.versions, b.versions);
  assert.deepEqual(a.runLog, b.runLog);
});

// ---- Failure ----

test('Task 4b: a failing agent returns a failure that names the agent and keeps the inputs', () => {
  const state = knownState();
  const before = structuredClone(state);
  const boom = () => { throw new Error('Something went wrong inside.'); };
  const result = runDesignTeam(state, { agents: { Layout: boom } });
  assert.equal(result.ok, false);
  assert.equal(result.failedAgent, 'Layout');
  assert.match(result.reason, /Something went wrong inside/);
  assert.equal(result.inputs, state);
  assert.deepEqual(result.inputs, before);
  assert.equal(result.project.runLog.at(-1).event, 'failed');
});

test('Task 4b: inputs that cannot make a Brain (no floor) give a plain failure and keep the inputs', () => {
  const state = createState();
  setProjectName(state, 'Empty');
  const result = runDesignTeam(state);
  assert.equal(result.ok, false);
  assert.equal(result.failedAgent, null);
  assert.match(result.reason, /needs at least one floor/);
  assert.equal(result.inputs, state);
});

test('Task 4b: the sample run output is unchanged (matches docs/sample-run.json exactly)', () => {
  const { project } = runSample();
  const expected = readFileSync(path.join(root, 'docs/sample-run.json'), 'utf8');
  assert.equal(JSON.stringify(makeSampleRun(project), null, 2) + '\n', expected);
});
