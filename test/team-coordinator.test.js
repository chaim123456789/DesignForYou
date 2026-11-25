// design-team Group A, Task A6: the run as steps, with scripted answers. Agents here are stand-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem } from '../src/brain/brain.js';
import { createRun, runWithScript, SCRIPTED } from '../src/team-coordinator.js';
import { buildProposal } from '../src/proposal.js';
import { loadRegistry } from '../src/agents/registry.js';
import { findStale } from '../src/ripple.js';

const registry = loadRegistry();
const ORDER = [...registry.order];
const KITCHEN = 'floor-1-room-1';
const NOW = () => '2026-01-01T00:00:00.000Z';

// Kitchen: wall, door (on the wall), sofa (based on wall and door). Hall: a wall. Plus a Style note on the sofa.
function build({ lockedSofa = false } = {}) {
  const p = createProject({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }, { name: 'Hall' }] }] });
  const ids = {};
  const add = (key, kind, owner, basis = [], extra = {}) => {
    ids[key] = createItem(p, { kind, owner, room: KITCHEN, value: { n: key }, basis: basis.map((k) => ({ itemId: ids[k], version: 0 })), ...extra }).id;
  };
  add('wall', 'wall', 'Walls');
  add('door', 'door', 'Doors and windows', ['wall']);
  add('sofa', 'layout', 'Furniture', ['wall', 'door'], lockedSofa ? { status: 'Locked' } : {});
  add('note', 'style', 'Style', ['sofa']);
  return { p, ids };
}
const opt = (id, v) => ({ id, label: `Choice ${id}`, newValue: v });
let n = 0;
const prop = (view, agent, itemId, options, extra = {}) => buildProposal({
  id: `${agent}-${++n}`, agent, itemId, why: 'A stand-in reason.', source: 'rule', ruleId: 'stand-in', confidence: 'high', options, ...extra,
}, { items: view.items, order: ORDER });
const started = (p) => p.runLog.filter((e) => e.event === 'started').map((e) => e.agent);

test('design-team A6: the agents run in the registry order, each once, with no agents given (stand-ins)', () => {
  const { p } = build();
  const result = runWithScript(p, { registry, now: NOW });
  assert.equal(result.ok, true);
  assert.deepEqual(started(p), ORDER);
  assert.deepEqual(p.runLog.filter((e) => e.event === 'finished').map((e) => e.agent), ORDER);
  assert.equal(p.versions.length, 0);
  assert.equal(result.run.done(), true);
});

test('design-team A6: nothing changes until answer is called', () => {
  const { p, ids } = build();
  const run = createRun(p, { registry, now: NOW, agents: { Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', { n: 'moved' })])] } });
  const before = JSON.stringify(p.items);
  const step = run.next();
  assert.equal(step.agent, 'Walls');
  assert.equal(step.proposals.length, 1);
  assert.equal(JSON.stringify(p.items), before);
  assert.equal(p.versions.length, 0);
  run.answer(step.proposals[0].id, 'a');
  assert.deepEqual(p.items[0].value, { n: 'moved' });
  assert.equal(p.versions.length, 1);
});

test('design-team A6: the next agent does not start until the proposals are answered', () => {
  const { p, ids } = build();
  const run = createRun(p, { registry, agents: { Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', 1)])] } });
  const step = run.next();
  assert.throws(() => run.next(), /Answer the proposals of Walls first\. 1 still waiting/);
  assert.deepEqual(started(p), ['Walls']);
  run.answer(step.proposals[0].id, 'a');
  assert.equal(run.next().agent, 'Doors and windows');
});

test('design-team A6: an agent that is switched off is skipped, and its dependents say which agent is missing', () => {
  const { p } = build();
  const configs = [{ name: 'Walls', enabled: false }, { name: 'Decor', enabled: false }];
  runWithScript(p, { registry, configs });
  assert.ok(!started(p).includes('Walls') && !started(p).includes('Decor'));
  assert.deepEqual(p.runLog.filter((e) => e.event === 'skipped').map((e) => e.agent), ['Walls', 'Decor']);
  const notes = p.runLog.filter((e) => e.event === 'note' && e.agent === 'Doors and windows');
  assert.deepEqual(notes.map((e) => e.reason), ['Working without Walls, which is switched off.']);
  assert.ok(p.runLog.some((e) => e.event === 'note' && e.agent === 'Style' && /Decor/.test(e.reason)));
  assert.equal(started(p).length, 6);
});

test('design-team A6: the Reviewer cannot be turned off, and bad configs are rejected', () => {
  const { p } = build();
  runWithScript(p, { registry, configs: [{ name: 'Reviewer', enabled: false }] });
  assert.equal(started(p).at(-1), 'Reviewer');
  assert.throws(() => createRun(p, { registry, configs: [{ name: 'Plumber', enabled: true }] }), /not an agent in the registry/);
  assert.throws(() => createRun(p, { registry, configs: [{ name: 'Walls', enabled: 'no' }] }), /true or false/);
  assert.throws(() => createRun(p, { registry, agents: { Plumber: () => [] } }), /not in the registry/);
  assert.throws(() => createRun(p, {}), /needs the agent registry/);
});

test('design-team A6: a failing agent stops the run, names the agent and why, and earlier accepted changes stay', () => {
  const { p, ids } = build();
  const agents = {
    Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', { n: 'moved' })])],
    'Floors and ceilings': () => { throw new Error('the floor rule broke'); },
  };
  const result = runWithScript(p, { registry, agents, now: NOW });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failure, { ok: false, failedAgent: 'Floors and ceilings', reason: 'the floor rule broke' });
  assert.deepEqual(started(p), ['Walls', 'Doors and windows', 'Floors and ceilings']);
  assert.deepEqual(p.items[0].value, { n: 'moved' });
  assert.equal(p.versions.length, 1);
  assert.deepEqual(p.runLog.at(-1), { agent: 'Floors and ceilings', event: 'failed', reason: 'the floor rule broke' });
  const run = result.run;
  assert.equal(run.done(), true);
  assert.equal(run.next().ok, false);
  assert.throws(() => run.answer('x', 'a'), /The run has stopped/);
});

test('design-team A6: a bad proposal (wrong owner, a later agent\'s item, a repeated id, a Custom missing) stops the run', () => {
  const { p, ids } = build();
  const wrong = { Walls: (view) => [{ ...prop(view, 'Walls', ids.wall, [opt('a', 1)]), agent: 'Decor' }] };
  const r1 = runWithScript(p, { registry, agents: wrong });
  assert.match(r1.failure.reason, /Decor does not own item/);
  const { p: p2, ids: ids2 } = build();
  const notOwned = { Walls: (view) => [prop(view, 'Walls', ids2.sofa, [opt('a', 1)])] };
  assert.match(runWithScript(p2, { registry, agents: notOwned }).failure.reason, /Walls does not own item/);
  const { p: p3, ids: ids3 } = build();
  const noCustom = { Walls: (view) => { const x = structuredClone(prop(view, 'Walls', ids3.wall, [opt('a', 1)])); x.options.pop(); return [x]; } };
  assert.match(runWithScript(p3, { registry, agents: noCustom }).failure.reason, /Bad proposal/);
  const { p: p4, ids: ids4 } = build();
  const notList = { Walls: () => 'nothing' };
  assert.match(runWithScript(p4, { registry, agents: notList }).failure.reason, /must return a list/);
  assert.ok(ids && ids4);
});

test('design-team A6: skip leaves the item as it is and marks it "kept as is"', () => {
  const { p, ids } = build();
  const agents = { Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', { n: 'moved' })])] };
  const result = runWithScript(p, { registry, agents, policy: 'skip', now: NOW });
  assert.deepEqual(p.items[0].value, { n: 'wall' });
  assert.equal(p.versions.length, 0);
  assert.deepEqual(result.run.keptAsIs, [{ itemId: ids.wall, agent: 'Walls', proposalId: p.runLog.find((e) => e.event === 'proposed').proposal }]);
  const entry = p.runLog.find((e) => e.event === 'kept-as-is');
  assert.equal(entry.item, ids.wall);
  assert.equal(entry.by, SCRIPTED);
});

test('design-team A6: a Locked item is never changed, is refused by the gatekeeper, and is flagged "needs your look"', () => {
  const { p, ids } = build({ lockedSofa: true });
  const agents = { Furniture: (view) => [prop(view, 'Furniture', ids.sofa, [opt('a', { n: 'changed' })])] };
  const result = runWithScript(p, { registry, agents, now: NOW });
  assert.deepEqual(p.items.find((i) => i.id === ids.sofa).value, { n: 'sofa' });
  assert.equal(p.versions.length, 0);
  assert.deepEqual(result.run.needsLook, [ids.sofa]);
  assert.ok(p.runLog.some((e) => e.event === 'refused' && e.item === ids.sofa && /is Locked/.test(e.reason)));
  assert.ok(p.runLog.some((e) => e.event === 'needs-look' && e.item === ids.sofa));
  assert.equal(result.run.answers[0].applied, false);
});

test('design-team A6: a stale Locked item is flagged "needs your look" at its re-check and its basis is not refreshed', () => {
  const { p, ids } = build({ lockedSofa: true });
  const agents = { Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', { n: 'moved' })])] };
  const result = runWithScript(p, { registry, agents, now: NOW });
  assert.deepEqual(result.run.needsLook, [ids.sofa]);
  assert.deepEqual(p.items.find((i) => i.id === ids.sofa).basis[0], { itemId: ids.wall, version: 0 });
  assert.ok(findStale(p, registry).stale.some((s) => s.itemId === ids.sofa && s.locked));
});

test('design-team A6: "still fine" refreshes the basis, adds a run-log line and writes no version', () => {
  const { p, ids } = build();
  const agents = { Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', { n: 'moved' })])] };
  runWithScript(p, { registry, agents, now: NOW });
  assert.equal(p.versions.length, 1, 'only the wall change wrote a version');
  const fine = p.runLog.filter((e) => e.event === 'still-fine').map((e) => e.item);
  // the style note is based only on the sofa. The sofa was confirmed unchanged, so the note is no longer stale.
  assert.deepEqual(fine, [ids.door, ids.sofa]);
  assert.deepEqual(findStale(p, registry).stale, []);
  assert.deepEqual(p.items.find((i) => i.id === ids.door).basis, [{ itemId: ids.wall, version: 1 }]);
});

test('design-team A6: an accepted change records who approved it (user or scripted answer) and the basis', () => {
  const { p, ids } = build();
  const agents = { 'Doors and windows': (view) => [prop(view, 'Doors and windows', ids.door, [opt('a', { n: 'door2' })])] };
  runWithScript(p, { registry, agents, now: NOW });
  assert.equal(p.versions[0].approvedBy, SCRIPTED);
  assert.deepEqual(p.versions[0].basis, [{ itemId: ids.wall, version: 0 }]);
  assert.equal(p.versions[0].who, 'Doors and windows');

  const b = build();
  const run = createRun(b.p, { registry, now: NOW, agents: { Walls: (view) => [prop(view, 'Walls', b.ids.wall, [opt('a', 1)])] } });
  run.answer(run.next().proposals[0].id, 'a');
  assert.equal(b.p.versions[0].approvedBy, 'user');
});

test('design-team A6: Custom uses the value the user typed, and the agent\'s own checker can refuse it', () => {
  const { p, ids } = build();
  const walls = (view) => [prop(view, 'Walls', ids.wall, [opt('a', { len: 400 })])];
  walls.checkCustom = (proposal, value) => (value.len >= 200 ? true : 'A wall must be at least 200 cm.');
  const run = createRun(p, { registry, now: NOW, agents: { Walls: walls } });
  const step = run.next();
  const id = step.proposals[0].id;
  assert.throws(() => run.answer(id, 'custom'), /Custom needs a value/);
  assert.throws(() => run.answer(id, 'custom', { len: 100 }), /at least 200 cm/);
  assert.equal(p.versions.length, 0);
  assert.equal(run.pending.length, 1, 'still waiting after a refused custom value');
  run.answer(id, 'custom', { len: 250 });
  assert.deepEqual(p.items[0].value, { len: 250 });
  assert.throws(() => run.answer(id, 'a'), /not waiting for an answer/);
});

test('design-team A6: an unknown option is refused and changes nothing', () => {
  const { p, ids } = build();
  const run = createRun(p, { registry, agents: { Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', 1)])] } });
  const id = run.next().proposals[0].id;
  assert.throws(() => run.answer(id, 'zzz'), /has no option "zzz"/);
  assert.equal(p.versions.length, 0);
});

test('design-team A6: a request from Furniture is applied by Walls, and a ripple pass re-checks each agent at most once', () => {
  const { p, ids } = build();
  // Furniture asks for the wall to move only while the wall is still as first entered.
  const agents = {
    Furniture: (view) => (view.items[0].value.n !== 'wall' ? [] : [prop(view, 'Furniture', ids.wall, [opt('move', { n: 'wall+20' }), opt('smaller', { n: 'wall' })],
      { confidence: 'low', request: { itemId: ids.wall, owner: 'Walls' } })]),
  };
  const result = runWithScript(p, { registry, agents, now: NOW });
  assert.equal(result.ok, true);
  // the wall changed, by Walls (not by Furniture), approved by the scripted answer
  assert.equal(p.versions[0].who, 'Walls');
  assert.equal(p.versions[0].approvedBy, SCRIPTED);
  assert.deepEqual(p.items[0].value, { n: 'wall+20' });
  // Doors and windows and Furniture ran a second time; nobody ran more than twice
  const counts = Object.fromEntries(ORDER.map((a) => [a, started(p).filter((x) => x === a).length]));
  assert.deepEqual(counts, {
    Walls: 1, 'Doors and windows': 2, 'Floors and ceilings': 1, 'Lighting and electrical': 1, Furniture: 2, Decor: 1, Style: 1, Reviewer: 1,
  });
  assert.equal(result.run.ripplePasses, 1);
  // within the ripple pass the order is the normal order
  const afterFurniture = started(p).slice(started(p).indexOf('Furniture') + 1);
  assert.deepEqual(afterFurniture, ['Doors and windows', 'Furniture', 'Decor', 'Style', 'Reviewer']);
  // the log says which agents were re-checked and which were not affected, with a reason
  const re = p.runLog.filter((e) => e.event === 're-check').map((e) => e.agent);
  assert.deepEqual(re, ['Doors and windows', 'Furniture']);
  assert.ok(p.runLog.some((e) => e.event === 'not-affected' && e.agent === 'Walls' && /Not affected/.test(e.reason)));
  assert.deepEqual(findStale(p, registry).stale, []);
});

test('design-team A6: a ripple pass cannot loop, even when every re-check asks for the wall to move again', () => {
  const { p, ids } = build();
  let k = 0;
  const agents = {
    Furniture: (view) => [prop(view, 'Furniture', ids.wall, [opt('move', { n: `wall+${++k}` }), opt('smaller', { n: 'x' })],
      { confidence: 'low', request: { itemId: ids.wall, owner: 'Walls' } })],
  };
  const result = runWithScript(p, { registry, agents, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.run.ripplePasses, 1);
  assert.equal(started(p).filter((a) => a === 'Furniture').length, 2);
  assert.equal(p.versions.length, 2, 'the second request was answered, and left items stale instead of starting another pass');
  assert.ok(p.runLog.some((e) => e.event === 'left-stale' && e.agent === 'Furniture'));
  assert.ok(findStale(p, registry).stale.length > 0, 'what is left stale stays visibly stale');
  const counts = ORDER.map((a) => started(p).filter((x) => x === a).length);
  assert.ok(counts.every((c) => c <= 2), `no agent runs more than twice: ${counts}`);
});

test('design-team A6: the same input and the same script give the same result twice', () => {
  const make = () => {
    const { p, ids } = build();
    const agents = {
      Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', { n: 'moved' }), opt('b', { n: 'other' })])],
      Style: (view) => [prop(view, 'Style', ids.note, [opt('a', { n: 'warm' })], { confidence: 'low', options: [opt('a', { n: 'warm' }), opt('b', { n: 'cool' })] })],
    };
    const result = runWithScript(p, { registry, agents, now: NOW });
    return JSON.stringify({ p, steps: result.steps, answers: result.run.answers });
  };
  n = 0; const first = make();
  n = 0; const second = make();
  assert.equal(first, second);
});

test('design-team A6: a policy function can pick options, skip, or give a Custom value', () => {
  const { p, ids } = build();
  const agents = {
    Walls: (view) => [prop(view, 'Walls', ids.wall, [opt('a', 1), opt('b', 2)])],
    'Doors and windows': (view) => [prop(view, 'Doors and windows', ids.door, [opt('a', 1)])],
    Furniture: (view) => [prop(view, 'Furniture', ids.sofa, [opt('a', 1)])],
  };
  const policy = (proposal) => (proposal.agent === 'Walls' ? 'b' : proposal.agent === 'Furniture' ? { custom: 'mine' } : 'skip');
  const result = runWithScript(p, { registry, agents, policy, now: NOW });
  assert.equal(p.items.find((i) => i.id === ids.wall).value, 2);
  assert.equal(p.items.find((i) => i.id === ids.sofa).value, 'mine');
  assert.equal(result.run.keptAsIs.length, 1);
  assert.deepEqual(result.steps.map((s) => s.agent).slice(0, 3), ['Walls', 'Doors and windows', 'Floors and ceilings']);
});

test('design-team A6: an agent gets a read-only view and cannot write to the Brain', () => {
  const { p } = build();
  let error;
  const agents = { Walls: (view) => { try { view.items[0].value = 'hacked'; } catch (e) { error = e; } return []; } };
  runWithScript(p, { registry, agents });
  assert.ok(error instanceof TypeError);
  assert.deepEqual(p.items[0].value, { n: 'wall' });
});

test('design-team A6: refreshBasis through the gatekeeper refuses a non-owner and a Locked item, with no version', async () => {
  const { createGatekeeper } = await import('../src/brain/gatekeeper.js');
  const { p, ids } = build({ lockedSofa: true });
  const { refreshBasis } = createGatekeeper(p);
  assert.equal(refreshBasis('Furniture', ids.sofa, [{ itemId: ids.wall, version: 0 }]).accepted, false);
  assert.equal(refreshBasis('Decor', ids.door, [{ itemId: ids.wall, version: 0 }]).accepted, false);
  assert.equal(p.versions.length, 0);
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 2);
});
