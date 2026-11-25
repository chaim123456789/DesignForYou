// design-team Group A, Task A4: proposals, options and the Rule-based / AI tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProposal, checkProposal, realOptions, MAX_OPTIONS } from '../src/proposal.js';
import { sourceTag, TAG_RULE, TAG_AI, getLabels, DRAFT_STATEMENT, SAMPLE_LABEL } from '../src/label.js';

const ORDER = ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer'];
const items = [
  { id: 'item-1', kind: 'wall', owner: 'Walls' },
  { id: 'item-2', kind: 'layout', owner: 'Furniture' },
];
const ctx = { items, order: ORDER };
const opt = (id) => ({ id, label: `Option ${id}`, newValue: { v: id } });
const base = (over = {}) => ({
  id: 'p1', agent: 'Walls', itemId: 'item-1', why: 'The room is smaller than the typical minimum.', source: 'rule', ruleId: 'walls-min-bedroom',
  confidence: 'high', options: [opt('a')], ...over,
});

test('design-team A4: a high-confidence proposal has a recommended first option and Custom last', () => {
  const p = buildProposal(base({ options: [opt('a'), opt('b')] }), ctx);
  assert.deepEqual(p.options.map((o) => o.id), ['a', 'b', 'custom']);
  assert.equal(p.options[0].recommended, true);
  assert.equal(p.options[1].recommended, undefined);
  assert.deepEqual(p.options[2], { id: 'custom', label: 'Custom' });
  assert.deepEqual(realOptions(p).map((o) => o.id), ['a', 'b']);
});

test('design-team A4: Custom is always added last, even when the agent passes none', () => {
  const p = buildProposal(base(), ctx);
  assert.equal(p.options.at(-1).id, 'custom');
  assert.equal(p.options.length, 2);
});

test('design-team A4: low confidence gives exactly two real options plus Custom', () => {
  const p = buildProposal(base({ confidence: 'low', options: [opt('a'), opt('b')] }), ctx);
  assert.equal(p.options.length, 3);
  assert.equal(p.options.some((o) => o.recommended), false);
  assert.throws(() => buildProposal(base({ confidence: 'low', options: [opt('a')] }), ctx), /exactly two real options plus Custom. It shows 1/);
  assert.throws(() => buildProposal(base({ confidence: 'low', options: [opt('a'), opt('b'), opt('c')] }), ctx), /It shows 3/);
});

test('design-team A4: no more than 4 options in total, Custom counted; at least one real option', () => {
  assert.equal(MAX_OPTIONS, 4);
  assert.doesNotThrow(() => buildProposal(base({ options: [opt('a'), opt('b'), opt('c')] }), ctx));
  assert.throws(() => buildProposal(base({ options: [opt('a'), opt('b'), opt('c'), opt('d')] }), ctx), /5 options\. The most allowed is 4/);
  assert.throws(() => buildProposal(base({ options: [] }), ctx), /at least one real option and then Custom/);
});

test('design-team A4: a hand-made proposal with Custom missing, not last, or with a value is rejected', () => {
  const good = buildProposal(base(), ctx);
  const raw = structuredClone(good);
  raw.options = raw.options.slice(0, -1);
  assert.throws(() => checkProposal(raw), /at least one real option|the last option must be Custom/);
  const two = structuredClone(good); two.options = [opt('a'), opt('b')];
  assert.throws(() => checkProposal(two), /the last option must be Custom/);
  const swapped = structuredClone(good); swapped.options = [{ id: 'custom', label: 'Custom' }, opt('a')];
  assert.throws(() => checkProposal(swapped), /the last option must be Custom/);
  const valued = structuredClone(good); valued.options[1].newValue = 5;
  assert.throws(() => checkProposal(valued), /Custom has no value of its own/);
  assert.throws(() => buildProposal(base({ options: [opt('custom')] }), ctx), /only the last option may be Custom/);
  assert.throws(() => buildProposal(base({ options: [opt('a'), opt('a')] }), ctx), /used twice/);
  assert.throws(() => buildProposal(base({ options: [{ id: 'a', label: 'A' }] }), ctx), /id, a label and a newValue/);
});

test('design-team A4: a malformed proposal is rejected with a clear message naming it', () => {
  assert.throws(() => buildProposal(base({ why: '' }), ctx), /Bad proposal "p1": it needs "why" as text/);
  assert.throws(() => buildProposal(base({ ruleId: undefined }), ctx), /"ruleId"/);
  assert.throws(() => buildProposal(base({ source: 'guess' }), ctx), /source "guess" is not allowed/);
  assert.throws(() => buildProposal(base({ confidence: 'medium' }), ctx), /confidence "medium" is not allowed/);
  assert.throws(() => buildProposal(base({ why: 'x'.repeat(201) }), ctx), /limit is 200/);
  assert.throws(() => buildProposal(base({ options: 'a' }), ctx), /"options" must be a list/);
  assert.throws(() => checkProposal(null), /must be an object/);
});

test('design-team A4: with a context, the item must exist and the agent must own it', () => {
  assert.throws(() => buildProposal(base({ itemId: 'item-99' }), ctx), /item "item-99" does not exist/);
  assert.throws(() => buildProposal(base({ agent: 'Decor' }), ctx), /Decor does not own item "item-1"\. Its owner is Walls\. Use a request/);
  assert.doesNotThrow(() => buildProposal(base()), 'without a context only the shape is checked');
});

test('design-team A4: a request names an earlier agent\'s item and its owner', () => {
  const req = base({ id: 'r1', agent: 'Furniture', itemId: 'item-1', why: 'The sofa does not fit.', confidence: 'low',
    options: [opt('move'), opt('smaller')], request: { itemId: 'item-1', owner: 'Walls' } });
  const p = buildProposal(req, ctx);
  assert.deepEqual(p.request, { itemId: 'item-1', owner: 'Walls' });
  assert.equal(p.options.length, 3);
  assert.throws(() => buildProposal({ ...req, request: { itemId: 'item-1', owner: 'Decor' } }, ctx), /owner is Decor, but item "item-1" is owned by Walls/);
  assert.throws(() => buildProposal({ ...req, request: { itemId: 'item-2', owner: 'Furniture' } }, ctx), /same item as the proposal/);
  assert.throws(() => buildProposal({ ...req, request: { itemId: 'item-1' } }, ctx), /needs "itemId" and "owner"/);
});

test('design-team A4: a request for a LATER agent\'s item, or for your own, is rejected', () => {
  const later = base({ id: 'r2', agent: 'Walls', itemId: 'item-2', request: { itemId: 'item-2', owner: 'Furniture' } });
  assert.throws(() => buildProposal(later, ctx), /an earlier agent's item\. Furniture does not run before Walls/);
  const own = base({ id: 'r3', agent: 'Furniture', itemId: 'item-2', request: { itemId: 'item-2', owner: 'Furniture' } });
  assert.throws(() => buildProposal(own, ctx), /for an earlier agent, not the asking agent/);
});

test('design-team A4: a built proposal is frozen and cannot be changed by the agent that made it', () => {
  const src = base({ options: [opt('a')] });
  const p = buildProposal(src, ctx);
  assert.throws(() => { 'use strict'; p.options.push({}); });
  assert.throws(() => { 'use strict'; p.options[0].newValue.v = 'z'; });
  src.options[0].newValue.v = 'changed later';
  assert.equal(p.options[0].newValue.v, 'a');
});

test('design-team A4: the tag helper gives Rule-based or AI and nothing else', () => {
  assert.equal(sourceTag('rule'), 'Rule-based');
  assert.equal(sourceTag('ai'), 'AI');
  assert.equal(TAG_RULE, 'Rule-based');
  assert.equal(TAG_AI, 'AI');
  assert.throws(() => sourceTag('guess'), /has no tag/);
  assert.throws(() => sourceTag(undefined), /has no tag/);
});

test('design-team A4: the existing label function is unchanged (sample label and draft statement)', () => {
  assert.deepEqual(getLabels({ isSample: true }), [SAMPLE_LABEL, DRAFT_STATEMENT]);
  assert.deepEqual(getLabels({}), [DRAFT_STATEMENT]);
});
