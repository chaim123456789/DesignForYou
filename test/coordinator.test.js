import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { runPipeline } from '../src/coordinator.js';

const ON = [
  { name: 'Style', enabled: true },
  { name: 'Layout', enabled: true },
  { name: 'Builder', enabled: true },
  { name: 'Reviewer', enabled: true },
];

function setup() {
  const p = createProject({ name: 'Test Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
  createItem(p, { kind: 'style', value: 'warm oak', owner: 'Style' }); // item-1
  createItem(p, { kind: 'layout', value: 'sofa north', owner: 'Layout' }); // item-2
  createItem(p, { kind: 'door', value: 'east wall', owner: 'Builder' }); // item-3
  createItem(p, { kind: 'style', value: 'white walls', owner: 'Style', status: 'Locked' }); // item-4
  return p;
}

const summary = (p) => p.runLog.map((e) => `${e.agent}:${e.event}`);

test('R6.1/R6.4: the run log shows Style, Layout, Builder, Reviewer in that order, each started then finished', () => {
  const p = setup();
  const result = runPipeline(p, { configs: ON });
  assert.equal(result.ok, true);
  assert.deepEqual(summary(p), [
    'Style:started', 'Style:finished',
    'Layout:started', 'Layout:finished',
    'Builder:started', 'Builder:finished',
    'Reviewer:started', 'Reviewer:finished',
  ]);
});

test('R6.1: the order is fixed even if the config list is in a different order', () => {
  const p = setup();
  runPipeline(p, { configs: [...ON].reverse() });
  assert.deepEqual(p.runLog.filter((e) => e.event === 'started').map((e) => e.agent), ['Style', 'Layout', 'Builder', 'Reviewer']);
});

test('R6.2: each agent runs once, and never starts before the previous one finishes', () => {
  const p = setup();
  const calls = [];
  const spy = (name) => () => { calls.push(`${name}:${summary(p).at(-1)}`); return []; };
  runPipeline(p, { configs: ON, agents: { Style: spy('Style'), Layout: spy('Layout'), Builder: spy('Builder'), Reviewer: spy('Reviewer') } });
  assert.deepEqual(calls, [
    'Style:Style:started',
    'Layout:Layout:started',
    'Builder:Builder:started',
    'Reviewer:Reviewer:started',
  ]);
  // Before each later agent started, the one before it had finished.
  const log = summary(p);
  assert.ok(log.indexOf('Style:finished') < log.indexOf('Layout:started'));
  assert.ok(log.indexOf('Layout:finished') < log.indexOf('Builder:started'));
  assert.ok(log.indexOf('Builder:finished') < log.indexOf('Reviewer:started'));
});

test('R6.6: an agent set to off shows "skipped" and does not run', () => {
  const p = setup();
  let layoutRan = false;
  const configs = ON.map((c) => (c.name === 'Layout' ? { ...c, enabled: false } : c));
  const result = runPipeline(p, { configs, agents: { Layout: () => { layoutRan = true; return []; } } });
  assert.equal(result.ok, true);
  assert.equal(layoutRan, false);
  assert.ok(summary(p).includes('Layout:skipped'));
  assert.ok(!summary(p).includes('Layout:started'));
  assert.deepEqual(p.runLog.filter((e) => e.event === 'started').map((e) => e.agent), ['Style', 'Builder', 'Reviewer']);
});

test('R6.7: the Reviewer still runs, last, even if its config says off', () => {
  const p = setup();
  const configs = ON.map((c) => (c.name === 'Reviewer' ? { ...c, enabled: false } : c));
  runPipeline(p, { configs });
  assert.deepEqual(summary(p).slice(-2), ['Reviewer:started', 'Reviewer:finished']);
});

test('R6.5: a stand-in that throws stops the run, and later agents do not run', () => {
  const p = setup();
  const ran = [];
  const result = runPipeline(p, {
    configs: ON,
    agents: {
      Style: () => { ran.push('Style'); return []; },
      Layout: () => { ran.push('Layout'); throw new Error('Layout broke'); },
      Builder: () => { ran.push('Builder'); return []; },
      Reviewer: () => { ran.push('Reviewer'); return []; },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.failedAgent, 'Layout');
  assert.equal(result.reason, 'Layout broke');
  assert.deepEqual(ran, ['Style', 'Layout']);
  const failed = p.runLog.find((e) => e.event === 'failed');
  assert.deepEqual({ agent: failed.agent, reason: failed.reason }, { agent: 'Layout', reason: 'Layout broke' });
  assert.ok(!summary(p).includes('Builder:started'));
  assert.ok(!summary(p).includes('Reviewer:started'));
});

test('R6.5: changes accepted before the failure remain in the Brain and in history', () => {
  const p = setup();
  runPipeline(p, {
    configs: ON,
    agents: {
      Style: () => [{ itemId: 'item-1', newValue: 'pale ash' }],
      Layout: () => { throw new Error('Layout broke'); },
    },
  });
  assert.equal(getItem(p, 'item-1').value, 'pale ash');
  const versions = listVersions(p);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].who, 'Style');
  assert.equal(versions[0].newValue, 'pale ash');
});

test('R6.3: an agent cannot write to the Brain directly (the view is read-only)', () => {
  const p = setup();
  const before = structuredClone(p);
  const attempts = [
    (view) => { view.items[0].value = 'hacked'; },
    (view) => { view.items.push({ id: 'item-99' }); },
    (view) => { view.versions.push({ number: 1 }); },
    (view) => { view.runLog.length = 0; },
    (view) => { delete view.items[1].value; },
    (view) => { view.name = 'hacked'; },
  ];
  for (const attempt of attempts) {
    const result = runPipeline(p, { configs: ON, agents: { Style: (view) => { attempt(view); return []; } } });
    assert.equal(result.ok, false, 'a direct write must fail the run');
    assert.equal(result.failedAgent, 'Style');
    p.runLog.length = 0; // keep the log comparable; the Brain itself is checked below
  }
  assert.deepEqual(p, before);
});

test('R6.3: the view is a copy, not the real Brain, and has no gatekeeper to call', () => {
  const p = setup();
  let seen;
  runPipeline(p, { configs: ON, agents: { Style: (view) => { seen = view; return []; } } });
  assert.notEqual(seen, p);
  assert.notEqual(seen.items, p.items);
  assert.ok(Object.isFrozen(seen) && Object.isFrozen(seen.items) && Object.isFrozen(seen.items[0]));
  assert.equal(typeof seen.changeItem, 'undefined');
  assert.equal(typeof seen.createGatekeeper, 'undefined');
});

test('R6.3: an agent can read all items, including ones it does not own', () => {
  const p = setup();
  let ids;
  runPipeline(p, { configs: ON, agents: { Style: (view) => { ids = view.items.map((i) => i.id); return []; } } });
  assert.deepEqual(ids, ['item-1', 'item-2', 'item-3', 'item-4']);
});

test('proposals go through the gatekeeper: an accepted one writes a version by that agent', () => {
  const p = setup();
  runPipeline(p, { configs: ON, agents: { Builder: () => [{ itemId: 'item-3', newValue: 'west wall' }] } });
  const v = listVersions(p);
  assert.equal(v.length, 1);
  assert.equal(v[0].who, 'Builder');
  assert.equal(getItem(p, 'item-3').value, 'west wall');
});

test('R4.4: a proposal for an item the agent does not own is refused and logged, with no version', () => {
  const p = setup();
  const result = runPipeline(p, { configs: ON, agents: { Style: () => [{ itemId: 'item-2', newValue: 'moved' }] } });
  assert.equal(result.ok, true);
  assert.equal(getItem(p, 'item-2').value, 'sofa north');
  assert.equal(listVersions(p).length, 0);
  const refused = p.runLog.find((e) => e.event === 'refused');
  assert.equal(refused.agent, 'Style');
  assert.equal(refused.item, 'item-2');
});

test('R5.1: a proposal for a Locked item is refused even for its owner', () => {
  const p = setup();
  runPipeline(p, { configs: ON, agents: { Style: () => [{ itemId: 'item-4', newValue: 'black walls' }] } });
  assert.equal(getItem(p, 'item-4').value, 'white walls');
  assert.equal(listVersions(p).length, 0);
  assert.equal(p.runLog.find((e) => e.event === 'refused').item, 'item-4');
});

test('an agent cannot pretend to be another agent: a "who" in a proposal is ignored', () => {
  const p = setup();
  runPipeline(p, { configs: ON, agents: { Style: () => [{ who: 'Layout', itemId: 'item-2', newValue: 'moved' }] } });
  assert.equal(getItem(p, 'item-2').value, 'sofa north');
  assert.equal(p.runLog.find((e) => e.event === 'refused').agent, 'Style');
});

test('a badly formed answer from an agent stops the run', () => {
  const p = setup();
  const result = runPipeline(p, { configs: ON, agents: { Style: () => 'oops' } });
  assert.equal(result.ok, false);
  assert.equal(result.failedAgent, 'Style');
  assert.ok(!summary(p).includes('Layout:started'));
});

test('the real agent.json files work as the default configs', () => {
  const p = setup();
  assert.equal(runPipeline(p).ok, true);
  assert.equal(summary(p).length, 8);
});
