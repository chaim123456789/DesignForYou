// Design-team D4 (pure part): the visitor's project goes through the eight agents as steps, using the page's own code (docs/intake/team-run.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, setProjectName, addFloor, addRoom, addPlaced, addItem, addNote } from '../docs/intake/state.js';
import { buildTeamBrain, createTeamSession, finishTeamSession } from '../docs/intake/team-run.js';
import { registryData } from '../docs/team/data.js';
import { readFileSync } from 'node:fs';

const OBJECTS = [
  { type: 'sofa', name: 'Sofa', room: 'Living', status: 'Locked', x: 0, y: 100, width: 200, depth: 90 },
  { type: 'bed', name: 'Bed', room: 'Living', status: 'Unsure', x: 100, y: 150, width: 160, depth: 200 },
  { type: 'door', name: 'Door', room: 'Living', status: 'Unsure', x: 150, y: 0, width: 90, depth: 10 },
  { type: 'window', name: 'Window', room: 'Living', status: 'Unsure', x: 250, y: 0, width: 100, depth: 10 },
];
function makeState({ unsized = false } = {}) {
  const s = createState();
  setProjectName(s, 'My home');
  const floor = addFloor(s, 'Ground').id;
  const living = addRoom(s, floor, 'Living', 4, 4).id;
  if (unsized) { s.floors[0].rooms[0].width = undefined; s.floors[0].rooms[0].depth = undefined; }
  const bedroom = addRoom(s, floor, 'Bedroom', 3, 3).id;
  addNote(s, 'overall', 'warm oak');
  for (const o of OBJECTS) assert.equal(addPlaced(s, { ...o, room: o.room === 'Living' ? living : bedroom }).ok, true);
  return s;
}
const scripted = (session) => {
  const seen = [];
  for (let step = session.run.next(); !step.done; step = session.run.next()) {
    seen.push(step);
    for (const p of step.proposals) session.run.answer(p.id, p.options[0].id);
  }
  return seen;
};

test('D4: the page registry data is the same as src/agents/registry.json (one list of the eight agents)', () => {
  assert.deepEqual(registryData, JSON.parse(readFileSync(new URL('../src/agents/registry.json', import.meta.url), 'utf8')));
});

test('D4 / R1.1, R11.2: the visitor\'s project runs through the eight agents in order, and the same input gives the same result', () => {
  const run = () => { const s = createTeamSession(makeState(), { scripted: true }); const steps = scripted(s); return { s, steps }; };
  const a = run();
  const b = run();
  const order = a.steps.filter((x) => x.kind === 'first').map((x) => x.agent);
  assert.deepEqual(order, ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer']);
  assert.deepEqual(a.s.project.versions, b.s.project.versions);
  assert.deepEqual(a.s.project.runLog, b.s.project.runLog);
  assert.equal(a.s.run.failure, null);
});

test('D4 / R4.1, R4.6: nothing changes until an answer is given, and the next agent waits for the answers', () => {
  const s = createTeamSession(makeState());
  const first = s.run.next();
  assert.equal(first.agent, 'Walls');
  assert.ok(first.proposals.length > 0);
  assert.equal(s.project.versions.length, 0, 'nothing changed yet');
  assert.throws(() => s.run.next(), /Answer the proposals of Walls first/);
  first.proposals.forEach((p, i) => {
    assert.equal(s.run.pending.length, first.proposals.length - i);
    s.run.answer(p.id, p.options[0].id);
  });
  assert.ok(s.project.versions.length > 0);
  assert.equal(s.run.next().agent, 'Doors and windows');
});

test('D4 / R4.4: a room with no size shows two options plus Custom', () => {
  const s = createTeamSession(makeState({ unsized: true }));
  const walls = s.run.next();
  const unsure = walls.proposals.find((p) => p.confidence === 'low');
  assert.ok(unsure, 'a low-confidence proposal');
  assert.equal(unsure.options.length, 3);
  assert.equal(unsure.options[2].label, 'Custom');
});

test('D4 / R4.5: Skip keeps the item as it is and marks it "kept as is"', () => {
  const s = createTeamSession(makeState());
  const step = s.run.next();
  const p = step.proposals[0];
  const before = structuredClone(s.project.items.find((i) => i.id === p.itemId).value);
  s.run.answer(p.id, 'skip');
  assert.deepEqual(s.project.items.find((i) => i.id === p.itemId).value, before);
  assert.equal(s.run.keptAsIs.length, 1);
  assert.ok(s.project.runLog.some((e) => e.event === 'kept-as-is' && e.proposal === p.id));
});

test('D4 / R4.3: a Custom answer is checked by the agent\'s own checker and a bad one is refused without losing the proposal', () => {
  const s = createTeamSession(makeState());
  const step = s.run.next();
  const p = step.proposals[0];
  assert.throws(() => s.run.answer(p.id, 'custom', { nonsense: true }), /needs a list called "segments"/);
  assert.equal(s.run.pending.length, step.proposals.length, 'still waiting for an answer');
  const good = structuredClone(p.options[0].newValue);
  good.segments = good.segments.map((x) => ({ ...x, length: x.length + 0.1 }));
  s.run.answer(p.id, 'custom', good);
  assert.deepEqual(s.project.items.find((i) => i.id === p.itemId).value.segments, good.segments);
});

test('D4 / R3.5: the Locked sofa is never changed by the team', () => {
  const s = createTeamSession(makeState(), { scripted: true });
  const sofa = s.project.items.find((i) => i.value && i.value.name === 'Sofa');
  const before = structuredClone(sofa.value);
  scripted(s);
  assert.equal(sofa.status, 'Locked');
  assert.deepEqual(sofa.value, before);
});

test('D4 / R11.3: the finished result holds the eight agents in order with their proposals, tags, rules and answers', () => {
  const s = createTeamSession(makeState(), { scripted: true });
  scripted(s);
  const result = finishTeamSession(s);
  assert.equal(result.ok, true);
  assert.deepEqual(result.team.agents.map((a) => a.name), ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer']);
  const walls = result.team.agents[0];
  assert.ok(walls.passes[0].proposals.length > 0);
  for (const a of result.team.agents) for (const pass of a.passes) for (const p of pass.proposals) {
    assert.match(p.tag, /^(Rule-based|AI)$/);
    assert.ok(p.rule);
    assert.equal(p.options[p.options.length - 1], 'Custom');
    assert.match(p.answer, /^(Confirm: |Skip: |Custom)/);
    assert.equal(p.answeredBy, 'scripted answer');
  }
  assert.equal(result.team.aiUsed, false);
  assert.equal(result.team.scripted, true);
});

test('D4: the user\'s own items and notes enter the Brain, and the AI is off on the page (the Style agent says so)', () => {
  const s = makeState();
  addItem(s, { text: 'Oak floor', room: s.floors[0].rooms[0].id, status: 'Unsure', tag: 'cold steel' });
  const session = createTeamSession(s, { scripted: true });
  assert.ok(session.project.items.some((i) => i.kind === 'style' && i.value.detail === 'Oak floor'));
  scripted(session);
  assert.ok(session.project.runLog.some((e) => e.event === 'note' && /AI was not used: AI is off/.test(e.reason)), 'the Style agent said AI was not used');
  assert.equal(buildTeamBrain(s).items.length, session.project.items.length);
});

test('D4: docs/team/ holds a byte-identical copy of every listed file, the list holds every file the team imports, and data.js matches the knowledge files', async () => {
  const { listTeamFiles, teamDataSource, SRC_DIR, TEAM_DIR } = await import('../src/viewer/engine-files.js');
  const { readdirSync, statSync } = await import('node:fs');
  const { join, resolve, dirname, relative } = await import('node:path');
  for (const rel of listTeamFiles()) {
    assert.ok(readFileSync(join(SRC_DIR, rel)).equals(readFileSync(join(TEAM_DIR, rel))), `docs/team/${rel} differs from src/${rel}. Run: npm run export-engine`);
  }
  assert.equal(readFileSync(join(TEAM_DIR, 'data.js'), 'utf8'), teamDataSource(), 'docs/team/data.js is up to date');
  // Every relative import of a listed file is listed too, so the page never asks for a file that is not there.
  const listed = new Set(listTeamFiles());
  for (const rel of listed) {
    const text = readFileSync(join(SRC_DIR, rel), 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      const target = relative(SRC_DIR, resolve(dirname(join(SRC_DIR, rel)), m[1])).split('\\').join('/');
      assert.ok(listed.has(target), `${rel} imports ${target}, which is not in the team file list`);
    }
  }
  const walkDir = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walkDir(join(d, n)) : [join(d, n)]));
  const found = walkDir(TEAM_DIR).map((f) => relative(TEAM_DIR, f).split('\\').join('/')).sort();
  assert.deepEqual(found, [...listed, 'data.js'].sort(), 'docs/team/ holds only the listed files');
  // The page's own team code reaches the team only through docs/team/.
  const pageCode = readFileSync(new URL('../docs/intake/team-run.js', import.meta.url), 'utf8');
  for (const m of pageCode.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.match(m[1], /^(\.\.\/team\/|\.\/(taste|state|place-geometry)\.js$)/, m[1]);
});
