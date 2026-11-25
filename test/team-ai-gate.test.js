// Design-team D1: the AI gate, its budget and the stand-in (R7.1 to R7.6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createGate, loadBudget, ALLOWED_TASKS, CAP_NOTE, OFF_BUDGET, cleanAnswer } from '../src/ai/gate.js';
import { standInProvider, STAND_IN_LABEL } from '../src/ai/stand-in.js';
import { findSecrets } from './no-secrets.test.js';

const VOCAB = ['warm oak', 'cold steel', 'linen'];
const withCap = (capUsd, extra = {}) => ({ ...loadBudget(), capUsd, ...extra });
const gateWith = (budget, provider = standInProvider) => createGate({ budget, provider, vocabulary: VOCAB });
const TASTE = { options: [{ id: 'a', tag: 'warm oak' }, { id: 'b', tag: 'cold steel' }] };

test('R7.4: the budget file has a cap of zero, so AI is off by default', () => {
  const b = loadBudget();
  assert.equal(b.capUsd, 0);
  assert.equal(b.spentUsd, 0);
  assert.deepEqual(Object.keys(b.estimateUsd).sort(), ['judge-taste', 'read-photo']);
  assert.equal(createGate({ budget: b, provider: standInProvider }).status().on, false);
  assert.equal(OFF_BUDGET.capUsd, 0);
});

test('R7.2: any task other than read-photo and judge-taste is refused with a message', () => {
  assert.deepEqual([...ALLOWED_TASKS], ['read-photo', 'judge-taste']);
  const gate = gateWith(withCap(1));
  for (const task of ['write-essay', 'chat', '', undefined, 'READ-PHOTO']) {
    const r = gate.ask(task, {});
    assert.equal(r.ok, false);
    assert.match(r.reason, /not allowed/);
  }
  assert.equal(gate.status().spentUsd, 0);
});

test('R7.3 and R7.4: with the cap at zero nothing is called', () => {
  let calls = 0;
  const gate = gateWith(loadBudget(), () => { calls += 1; return { answer: {} }; });
  const r = gate.ask('judge-taste', TASTE);
  assert.equal(r.ok, false);
  assert.match(r.reason, /AI is off/);
  assert.equal(calls, 0);
});

test('R7.3: a call that would pass the cap is refused before it is made, and spent and remaining are shown', () => {
  let calls = 0;
  const counting = (req) => { calls += 1; return standInProvider(req); };
  const gate = gateWith(withCap(0.006), counting);
  const first = gate.ask('judge-taste', TASTE); // costs 0.005
  assert.equal(first.ok, true);
  assert.equal(first.costUsd, 0.005);
  assert.equal(first.spentUsd, 0.005);
  assert.equal(first.remainingUsd, 0.001);
  const second = gate.ask('judge-taste', TASTE); // would pass the cap
  assert.equal(second.ok, false);
  assert.match(second.reason, /would cost about \$0.005/);
  assert.equal(calls, 1);
  assert.equal(gate.status().spentUsd, 0.005);
  assert.equal(gate.status().remainingUsd, 0.001);
  assert.equal(gateWith(withCap(0.01)).ask('read-photo', {}).ok, false); // read-photo estimate 0.02 is over a cap of 0.01
});

test('R7.5: the stand-in answer is labelled "stand-in, not a real model" and needs no key', () => {
  assert.equal(STAND_IN_LABEL, 'stand-in, not a real model');
  const r = gateWith(withCap(1)).ask('judge-taste', TASTE);
  assert.equal(r.ok, true);
  assert.equal(r.label, 'stand-in, not a real model');
  assert.equal(r.source, 'ai');
  assert.equal(r.answer.choice, 'a');
  assert.deepEqual(r.answer.tags, ['warm oak']);
});

test('R7.5: an answer with a tag outside the style vocabulary has that tag cut, and long text is cut', () => {
  const provider = () => ({ label: 'x', answer: { tags: ['warm oak', 'gold leaf', '<script>'], text: 'y'.repeat(900), choice: 'a' } });
  const r = gateWith(withCap(1), provider).ask('judge-taste', TASTE);
  assert.equal(r.ok, true);
  assert.deepEqual(r.answer.tags, ['warm oak']);
  assert.deepEqual(r.answer.cutTags, ['gold leaf', '<script>']);
  assert.equal(r.answer.text.length, 200);
  assert.deepEqual(cleanAnswer('not an object', VOCAB).tags, []);
});

test('R7.7: a provider that throws, or gives nothing usable, gives a refusal, never a throw, and nothing is spent', () => {
  const boom = gateWith(withCap(1), () => { throw new Error('offline'); }).ask('judge-taste', TASTE);
  assert.equal(boom.ok, false);
  assert.match(boom.reason, /AI call failed: offline/);
  assert.equal(boom.spentUsd, 0);
  const empty = gateWith(withCap(1), () => null).ask('judge-taste', TASTE);
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /no usable answer/);
  assert.equal(createGate({ budget: withCap(1) }).ask('judge-taste', TASTE).ok, false); // no provider connected
});

test('R7.6: the status says the cap in the page is only a guard for the demo', () => {
  assert.match(CAP_NOTE, /guard for the demo; a cap that cannot be bypassed needs a server/);
  assert.equal(createGate({ budget: loadBudget() }).status().note, CAP_NOTE);
});

test('R7.3: the gate copies the budget, so the caller\'s object is never changed', () => {
  const budget = withCap(1);
  const gate = gateWith(budget);
  gate.ask('judge-taste', TASTE);
  assert.equal(budget.spentUsd, 0);
  assert.throws(() => createGate({ budget: { capUsd: -1, spentUsd: 0, estimateUsd: {} } }), /capUsd/);
  assert.throws(() => createGate({ budget: { capUsd: 1, spentUsd: 0, estimateUsd: { 'write-essay': 1 } } }), /not an allowed task/);
});

test('R7.1 and R7.5: a scan of src/ai/ finds no network code, no web address and no key-like text', () => {
  const dir = new URL('../src/ai/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.json'));
  assert.deepEqual(files.sort(), ['budget.json', 'gate.js', 'stand-in.js']);
  const NETWORK = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|node:(?:http|https|net|tls|dgram|dns)|\bhttps?:\/\/|\bwww\./i;
  const KEYISH = /\b(?:api[_-]?key|apikey|secret|token|password|bearer)\b\s*[:=]/i;
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(text, NETWORK, `${f} must have no network code or web address`);
    assert.doesNotMatch(text, KEYISH, `${f} must have no key-like text`);
    assert.deepEqual(findSecrets(text), [], `${f} must pass the secret scan`);
  }
});

test('R7.1: no agent file imports the gate or a model directly (only the gate and the stand-in live in src/ai/)', () => {
  const base = new URL('../src/agents/', import.meta.url);
  for (const dir of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const text = readFileSync(new URL(`${dir.name}/agent.js`, base), 'utf8');
    assert.doesNotMatch(text, /ai\/stand-in|provider\s*\(/, `${dir.name} must not call a provider`);
  }
});
