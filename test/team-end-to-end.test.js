// design-team Group C, Task C5: eight agents end to end.
// A made-up two-room project (Living Room on the ground floor, Bedroom upstairs) goes through all eight agents with scripted answers.
// Then a second scripted run moves the Living Room's wall, so the ripple can be checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/team-coordinator.js';
import { buildProposal } from '../src/proposal.js';
import { buildTeam } from '../test-helpers/team-project.js';
import { findStale, agentsToRecheck } from '../src/ripple.js';
import { loadRegistry } from '../src/agents/registry.js';
import { sourceTag, DRAFT_STATEMENT } from '../src/label.js';
import {
  buildGroupCProject, groupCAgents, makeWallMoveAgent, runScripted, renderGroupCDemo, LIVING, BEDROOM, FIXED_TIME,
} from '../src/team-demo-c.js';

const registry = loadRegistry();
const ORDER = registry.order;

// Run 1 once, recording every step and proposal. Run 2 (the wall move) is built on the same project, recording what each agent was told.
function runBoth() {
  const t = buildGroupCProject();
  const proposals1 = [];
  const steps1 = [];
  const run1 = runScripted(t.project, { agents: groupCAgents(registry), registry, skipItemId: t.skipId, onStep: (s) => steps1.push(s), onProposal: (p, choice, result) => proposals1.push({ p, choice, result }) });
  const afterRun1 = { versions: t.project.versions.length, log: t.project.runLog.length, items: structuredClone(t.project.items), stale: findStale(t.project, registry).stale.map((x) => x.itemId) };
  const told = {};
  const wrap = (name, fn) => { const w = (view, context) => { told[name] = context.staleItemIds.slice(); return fn(view, context); }; if (fn.checkCustom) w.checkCustom = fn.checkCustom; return w; };
  const agents2 = Object.fromEntries(Object.entries({ ...groupCAgents(registry), Walls: makeWallMoveAgent(t.slots) }).map(([n, f]) => [n, wrap(n, f)]));
  const proposals2 = [];
  const run2 = runScripted(t.project, { agents: agents2, registry, onProposal: (p, choice, result) => proposals2.push({ p, choice, result }) });
  return { t, run1, run2, proposals1, proposals2, steps1, afterRun1, told };
}
const idsIn = (project, room) => project.items.filter((i) => i.room === room).map((i) => i.id);

test('design-team C5: the run log shows all eight agents, started in the registry order, and both runs finish', () => {
  const { t, run1, run2 } = runBoth();
  assert.equal(run1.failure, null);
  assert.equal(run2.failure, null);
  const firstStarts = [];
  for (const e of t.project.runLog) if (e.event === 'started' && !firstStarts.includes(e.agent)) firstStarts.push(e.agent);
  assert.deepEqual(firstStarts, ORDER);
  assert.equal(ORDER.length, 8);
  // the first pass walks the agents in order; a re-check never starts before the agent before it in that pass has finished
  const firstPass = [];
  for (const e of t.project.runLog.slice(0, t.project.runLog.findIndex((x) => x.agent === 'Reviewer' && x.event === 'started') + 1)) if (e.event === 'started') firstPass.push(e.agent);
  const firstPassOnly = firstPass.filter((a, i) => firstPass.indexOf(a) === i);
  assert.deepEqual(firstPassOnly, ORDER);
  // an agent never starts before the previous one has finished
  const open = new Set();
  for (const e of t.project.runLog) {
    if (e.event === 'started') { assert.equal(open.size, 0, `${e.agent} started while ${[...open]} was still open`); open.add(e.agent); }
    if (e.event === 'finished') open.delete(e.agent);
  }
});

test('design-team C5: a low-confidence case shows exactly two real options plus Custom, from three different agents', () => {
  const { proposals1 } = runBoth();
  const low = proposals1.filter(({ p }) => p.confidence === 'low');
  assert.ok(low.length >= 3);
  for (const { p } of low) {
    assert.equal(p.options.length, 3, p.id);
    assert.equal(p.options[2].label, 'Custom');
  }
  const agents = new Set(low.map(({ p }) => p.agent));
  for (const name of ['Walls', 'Decor', 'Style', 'Furniture']) assert.ok(agents.has(name), `${name} has a low-confidence proposal`);
  // the high-confidence ones show a recommended option and Custom last
  for (const { p } of proposals1.filter(({ p: x }) => x.confidence === 'high')) {
    assert.equal(p.options[0].recommended, true);
    assert.equal(p.options[p.options.length - 1].id, 'custom');
  }
});

test('design-team C5: one request goes from Furniture to Walls, and Walls (not Furniture) applies it', () => {
  const { t, proposals1 } = runBoth();
  const requests = proposals1.filter(({ p }) => p.request);
  assert.equal(requests.length, 1);
  const { p, result } = requests[0];
  assert.equal(p.agent, 'Furniture');
  assert.equal(p.request.owner, 'Walls');
  assert.equal(p.options.length, 3);
  assert.equal(result.applied, true);
  const wallId = p.itemId;
  const version = t.project.versions[result.version - 1];
  assert.equal(version.who, 'Walls');
  assert.equal(version.item, wallId);
  assert.equal(version.approvedBy, 'scripted answer');
  assert.equal(t.project.versions.some((v) => v.who === 'Furniture' && t.project.items.find((i) => i.id === v.item).kind === 'wall'), false);
  assert.equal(t.project.items.find((i) => i.id === wallId).room, BEDROOM);
});

test('design-team C5: one proposal is skipped, the item is kept as is, and the Reviewer reports it', () => {
  const { t, run1, afterRun1 } = runBoth();
  assert.deepEqual([...new Set(run1.keptAsIs.map((k) => k.itemId))], [t.skipId]);
  assert.deepEqual(afterRun1.items.find((i) => i.id === t.skipId).value.position, { x: 1.6, y: 0.5, width: 1.2, depth: 0.6 }, 'the skipped piece was not moved in run 1');
  assert.ok(t.project.runLog.some((e) => e.event === 'kept-as-is' && e.item === t.skipId && e.by === 'scripted answer'));
  const report = afterRun1.items.find((i) => i.kind === 'clash').value;
  const line = report.clashes.find((c) => c.type === 'Item kept as is');
  assert.deepEqual(line.items, [t.skipId]);
});

test('design-team C5: the Locked item is unchanged, no agent wrote it, and the Reviewer says it needs a look', () => {
  const { t, afterRun1 } = runBoth();
  const start = { x: 4.6, y: 3, width: 1.2, depth: 0.6 };
  assert.deepEqual(t.project.items.find((i) => i.id === t.lockedId).value.position, start);
  assert.equal(t.project.items.find((i) => i.id === t.lockedId).status, 'Locked');
  assert.equal(t.project.versions.some((v) => v.item === t.lockedId), false, 'no version names the Locked item');
  assert.deepEqual(afterRun1.items.find((i) => i.id === t.lockedId).value.position, start);
  const report = t.project.items.find((i) => i.kind === 'clash').value;
  const line = report.clashes.find((c) => c.type === 'Locked item needs your look');
  assert.ok(line);
  assert.deepEqual(line.items, [t.lockedId]);
  assert.ok(report.clashes.some((c) => c.type === 'Object outside its room' && c.items[0] === t.lockedId), 'its problem is still reported');
});

test('design-team C5: moving the Living Room wall ripples to every later agent, but only to what depends on that wall', () => {
  const { t, told, run2, afterRun1 } = runBoth();
  assert.ok(t.project.versions.length > afterRun1.versions);
  assert.deepEqual(told.Walls, [], 'the Walls stand-in had nothing stale');
  const living = idsIn(t.project, LIVING);
  const bedroom = idsIn(t.project, BEDROOM);
  const kind = (k, room) => t.project.items.filter((i) => i.kind === k && i.room === room).map((i) => i.id);
  assert.deepEqual(told['Doors and windows'].slice().sort(), [...kind('door', LIVING), ...kind('window', LIVING)].sort());
  assert.deepEqual(told['Floors and ceilings'].slice().sort(), [...kind('floor', LIVING), ...kind('ceiling', LIVING)].sort());
  assert.deepEqual(told['Lighting and electrical'].slice().sort(), [...kind('light', LIVING), ...kind('electrical', LIVING)].sort());
  assert.ok(told.Furniture.length > 0 && told.Decor.length > 0 && told.Style.length > 0 && told.Reviewer.length > 0, 'the later agents were all asked to look');
  for (const name of ORDER) for (const id of told[name]) assert.ok(!bedroom.includes(id), `${name} was told about a Bedroom item (${id})`);
  for (const id of [...told.Furniture, ...told.Decor, ...told.Style]) assert.ok(living.includes(id), id);
  assert.deepEqual(told.Reviewer, [t.later.clash]);
  assert.equal(run2.failure, null);
});

test('design-team C5: right after the wall move, the plan re-checks the agents that own stale Living Room items and says why', () => {
  const t = buildGroupCProject();
  runScripted(t.project, { agents: groupCAgents(registry), registry, skipItemId: t.skipId });
  const run = createRun(t.project, { registry, now: () => FIXED_TIME, scripted: true, agents: { ...groupCAgents(registry), Walls: makeWallMoveAgent(t.slots) } });
  const step = run.next();
  assert.equal(step.agent, 'Walls');
  for (const p of step.proposals) run.answer(p.id, 'moved');
  const stale = findStale(t.project, registry).stale;
  assert.deepEqual(stale.filter((s) => idsIn(t.project, BEDROOM).includes(s.itemId)), [], 'nothing of the Bedroom is stale');
  const plan = agentsToRecheck(t.project, registry).agents;
  const by = Object.fromEntries(plan.map((a) => [a.agent, a]));
  assert.equal(by.Walls.recheck, false);
  assert.equal(by.Walls.reason, 'Not affected: nothing it depends on changed.');
  for (const name of ORDER.slice(1)) assert.equal(by[name].recheck, true, name);
  assert.match(by['Doors and windows'].reason, /stale because/);
});

test('design-team C5: every proposal has a Rule-based tag and a rule id, every version says who approved it, and no AI was used', () => {
  const { t, proposals1, proposals2 } = runBoth();
  const all = [...proposals1, ...proposals2].map((x) => x.p);
  assert.ok(all.length >= 25);
  for (const p of all) {
    assert.equal(p.source, 'rule', p.id);
    assert.equal(sourceTag(p.source), 'Rule-based');
    assert.ok(typeof p.ruleId === 'string' && p.ruleId.length > 0, p.id);
  }
  for (const list of [proposals1, proposals2]) assert.equal(new Set(list.map((x) => x.p.id)).size, list.length, 'every proposal id is unique within a run, even when an agent looks at an item twice');
  assert.ok(t.project.versions.length > 20);
  assert.ok(t.project.versions.every((v) => v.approvedBy === 'scripted answer'));
  for (const e of t.project.runLog.filter((x) => x.event === 'proposed')) assert.equal(e.source, 'rule');
  const report = t.project.items.find((i) => i.kind === 'clash').value;
  assert.ok(report.clashes.every((c) => c.tag === 'Rule-based'));
  assert.ok(report.labels.includes(DRAFT_STATEMENT));
});

test('design-team C5: two runs of the same project with the same script give identical results', () => {
  const a = runBoth();
  const b = runBoth();
  assert.deepEqual(a.t.project, b.t.project);
  assert.deepEqual(a.proposals1.map((x) => x.p), b.proposals1.map((x) => x.p));
  assert.equal(renderGroupCDemo(), renderGroupCDemo());
});

test('design-team C5: what is left stale after run 1 is only what a re-check cannot help, and the Reviewer reports the stale ones', () => {
  const { t, afterRun1 } = runBoth();
  const staleIds = afterRun1.stale;
  assert.ok(staleIds.includes(t.lockedId) && staleIds.includes(t.skipId), 'the Locked desk and the skipped table stay stale');
  assert.deepEqual(staleIds.filter((id) => idsIn(t.project, BEDROOM).includes(id)), [], 'nothing in the Bedroom is left stale');
  const report = afterRun1.items.find((i) => i.kind === 'clash').value;
  const reported = new Set(report.clashes.filter((c) => c.type === 'Item out of date').map((c) => c.items[0]));
  assert.ok(reported.has(t.skipId));
  assert.ok(!reported.has(t.lockedId), 'a Locked item is listed as needing a look instead');
  assert.deepEqual(findStale(t.project, registry).errors, []);
});

test('design-team C5: a Locked item, or one the user skipped, does not make the Coordinator re-check again and again', () => {
  const { steps1 } = runBoth();
  const count = (name) => steps1.filter((s) => s.agent === name).length;
  assert.equal(count('Walls'), 1);
  assert.equal(count('Furniture'), 2, 'its first pass and one re-check after the wall request');
  assert.equal(count('Decor'), 1);
  assert.equal(count('Style'), 1);
  assert.equal(count('Reviewer'), 1);
  assert.deepEqual(steps1.map((s) => s.agent), [
    'Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture',
    'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer',
  ]);
  assert.deepEqual(steps1.map((s) => s.kind), ['first', 'first', 'first', 'first', 'first', 'recheck', 'recheck', 'recheck', 'recheck', 'first', 'first', 'first']);
});

test('design-team C5: the same proposal id in a later step gets a numbered id, and the same id twice in one step is an error', () => {
  const t = buildTeam({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }] });
  const wall = t.project.items.find((i) => i.kind === 'wall');
  const win = t.project.items.find((i) => i.kind === 'window');
  const make = (agent, item) => (view) => [buildProposal({
    id: 'dup', agent, itemId: item.id, why: 'Same id on purpose.', source: 'rule', ruleId: 'test-rule', confidence: 'high',
    options: [{ id: 'a', label: 'A', newValue: { ...item.value, note: agent } }],
  }, { items: view.items })];
  const run = createRun(t.project, { registry, now: () => FIXED_TIME, scripted: true, agents: { Walls: make('Walls', wall), 'Doors and windows': make('Doors and windows', win) } });
  const one = run.next();
  assert.equal(one.proposals[0].id, 'dup');
  run.answer('dup', 'skip');
  const two = run.next();
  assert.equal(two.agent, 'Doors and windows');
  assert.equal(two.proposals[0].id, 'dup#2');
  run.answer('dup#2', 'skip');
  // the same id twice in ONE step is a bug in the agent: the run stops and says so
  const both = (view) => { const [p] = make('Walls', wall)(view); return [p, p]; };
  const bad = createRun(t.project, { registry, now: () => FIXED_TIME, scripted: true, agents: { Walls: both } });
  const result = bad.next();
  assert.equal(result.done, true);
  assert.match(result.reason, /was already used in this run/);
});
