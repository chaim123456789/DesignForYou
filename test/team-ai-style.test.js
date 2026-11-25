// Design-team D2: the Style agent and the photo-reading step use the AI gate, with a fallback to rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from '../src/brain/brain.js';
import { setProjectInspiration } from '../src/brain/inspiration.js';
import { createGate, loadBudget } from '../src/ai/gate.js';
import { standInProvider } from '../src/ai/stand-in.js';
import { makeTeamStyleAgent, loadStyleKnowledge } from '../src/agents/team-style/agent.js';
import { readPhotos, NOT_READ_SENTENCE } from '../src/photo-step.js';
import { buildProposal } from '../src/proposal.js';
import { buildLater, view } from '../test-helpers/team-project.js';

const R1 = 'floor-1-room-1';
const ctx = { mode: 'first', staleItemIds: [] };
const k = loadStyleKnowledge();
const vocabulary = k.families.flatMap((f) => f.then.tags);
const gateWith = (capUsd, provider = standInProvider) => createGate({ budget: { ...loadBudget(), capUsd }, provider, vocabulary });

// A cold-steel note in a warm-oak room: two close families, so a matter of taste.
function closeCall() {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }], openings: [] });
  setProjectInspiration(t.project, ['warm oak']);
  const note = createItem(t.project, { kind: 'style', owner: 'Style', room: R1, value: { name: 'Wall finish', tag: 'cold steel', detail: 'Brushed steel panels' } });
  return { t, note };
}
const forNote = (list, note) => list.find((p) => p.itemId === note.id);
const strip = ({ aiNote, ...rest }) => rest;

test('D2 / R7.4 and R7.7: with the cap at zero the result equals the rule-only result and says "AI was not used"', () => {
  const { t, note } = closeCall();
  const ruleOnly = forNote(makeTeamStyleAgent(k)(view(t.project), ctx), note);
  const zero = forNote(makeTeamStyleAgent(k, { gate: gateWith(0) })(view(t.project), ctx), note);
  assert.equal(ruleOnly.options.length, 3, 'two real options plus Custom');
  assert.equal(zero.source, 'rule');
  assert.deepEqual(strip(zero), strip(ruleOnly));
  assert.match(zero.aiNote, /^AI was not used: AI is off/);
  assert.equal(ruleOnly.aiNote, undefined, 'without a gate nothing is said');
});

test('D2 / R8.3: with the stand-in and a cap, the proposal is tagged ai with the task name and the cost', () => {
  const { t, note } = closeCall();
  const gate = gateWith(1);
  const p = forNote(makeTeamStyleAgent(k, { gate })(view(t.project), ctx), note);
  assert.equal(p.source, 'ai');
  assert.equal(p.ruleId, 'judge-taste');
  assert.deepEqual(p.ai, { task: 'judge-taste', costUsd: 0.005, label: 'stand-in, not a real model' });
  assert.match(p.why, /stand-in, not a real model/);
  assert.match(p.why, /\$0\.005/);
  assert.equal(p.options.length, 3, 'still two real options plus Custom');
  assert.equal(p.confidence, 'low');
  assert.equal(gate.status().spentUsd, 0.005);
});

test('D2: the gate may put the other option first, and the proposal then follows its choice', () => {
  const { t, note } = closeCall();
  const second = (req) => ({ label: 'test provider', answer: { choice: req.input.options[1].id, tags: [], text: 'second' } });
  const rules = forNote(makeTeamStyleAgent(k)(view(t.project), ctx), note);
  const p = forNote(makeTeamStyleAgent(k, { gate: gateWith(1, second) })(view(t.project), ctx), note);
  assert.equal(p.options[0].id, rules.options[1].id);
  assert.equal(p.options[1].id, rules.options[0].id);
  assert.equal(p.source, 'ai');
});

test('D2 / R7.7: a refused call or a failed call falls back to the rules and says so', () => {
  const { t, note } = closeCall();
  const rules = forNote(makeTeamStyleAgent(k)(view(t.project), ctx), note);
  const gate = gateWith(0.004); // cap is under one judge-taste call
  const refused = forNote(makeTeamStyleAgent(k, { gate })(view(t.project), ctx), note);
  assert.equal(refused.source, 'rule');
  assert.match(refused.aiNote, /would cost about/);
  assert.deepEqual(strip(refused), strip(rules));
  const boom = gateWith(1, () => { throw new Error('offline'); });
  const failed = forNote(makeTeamStyleAgent(k, { gate: boom })(view(t.project), ctx), note);
  assert.equal(failed.source, 'rule');
  assert.match(failed.aiNote, /AI call failed: offline/);
  const nonsense = gateWith(1, () => ({ answer: { choice: 'no-such-option' } }));
  const odd = forNote(makeTeamStyleAgent(k, { gate: nonsense })(view(t.project), ctx), note);
  assert.equal(odd.source, 'rule');
  assert.match(odd.aiNote, /did not pick one of the two options/);
});

test('D2: the gate is asked only when two options are close, never for a clear case', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }], openings: [] });
  setProjectInspiration(t.project, ['warm oak']);
  let asked = 0;
  const gate = gateWith(1, (r) => { asked += 1; return standInProvider(r); });
  const out = makeTeamStyleAgent(k, { gate })(view(t.project), ctx);
  assert.ok(out.length > 0);
  assert.equal(asked, 0);
  assert.ok(out.every((p) => p.source === 'rule' && p.aiNote === undefined));
});

test('D2: a proposal rejects an AI source with no task and cost, and an AI note on an AI proposal', () => {
  const base = { id: 'p', agent: 'Style', itemId: 'x', why: 'w', source: 'ai', ruleId: 'judge-taste', confidence: 'high', options: [{ id: 'a', label: 'A', newValue: 1 }] };
  assert.throws(() => buildProposal(base), /needs "ai" with the task name/);
  assert.throws(() => buildProposal({ ...base, source: 'rule', ai: { task: 't', costUsd: 0 } }), /only an AI proposal may carry "ai"/);
  assert.throws(() => buildProposal({ ...base, ai: { task: 'judge-taste', costUsd: 0 }, aiNote: 'x' }), /aiNote/);
  assert.equal(buildProposal({ ...base, ai: { task: 'judge-taste', costUsd: 0.005 } }).ai.costUsd, 0.005);
});

test('D2 / R7.4: the photo-reading step is off by default and says the images were not looked at', () => {
  const images = [{ name: 'sofa.jpg' }, { name: 'room.jpg' }];
  const off = readPhotos(gateWith(0), images);
  assert.equal(off.used, false);
  assert.deepEqual(off.readings, []);
  assert.match(off.notes[0], /AI was not used for sofa.jpg: AI is off/);
  assert.ok(off.notes[0].endsWith(NOT_READ_SENTENCE));
  assert.match(readPhotos(undefined, images).notes[0], /no AI gate is connected/);
  assert.equal(readPhotos(gateWith(0), []).used, false);
});

test('D2 / R8.3: with the stand-in and a cap, photo reading is tagged with its cost and says it is a stand-in', () => {
  const r = readPhotos(gateWith(1), [{ name: 'a.jpg' }, { name: 'b.jpg' }]);
  assert.equal(r.used, true);
  assert.equal(r.readings.length, 2);
  assert.equal(r.costUsd, 0.04);
  assert.equal(r.readings[0].label, 'stand-in, not a real model');
  const partly = readPhotos(gateWith(0.03), [{ name: 'a.jpg' }, { name: 'b.jpg' }]);
  assert.equal(partly.readings.length, 1);
  assert.match(partly.notes[0], /AI was not used for b.jpg/);
});
