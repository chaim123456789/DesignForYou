// Proposals: what an agent returns instead of changing anything (design-team R4, design section 4.1).
// A proposal is plain data. It changes nothing until the user answers it.
//
//   { id, agent, itemId, why, source, ruleId, confidence, options, request? }
//   source     : 'rule' or 'ai'
//   ruleId     : the rule that produced it (or the AI task name)
//   confidence : 'high' or 'low'
//   options    : [{ id, label, newValue }, ..., { id: 'custom', label: 'Custom' }]
//                High confidence: a recommended first option, optionally more, then Custom.
//                Low confidence: exactly two real options, then Custom.
//                At most 4 options in total, and Custom is always last.
//   ai         : only when source is 'ai': { task, costUsd, label } (the task name, what it cost, and the stand-in label)
//   aiNote     : optional text on a rule-based proposal that says why AI was not used (design-team D2)
//   request    : only when the proposal asks for an EARLIER agent's item to change: { itemId, owner }
import { SOURCES } from './brain/brain.js';

export const CUSTOM_OPTION_ID = 'custom';
export const MAX_OPTIONS = 4;
export const CONFIDENCES = Object.freeze(['high', 'low']);
export const MAX_WHY_LENGTH = 200;

const isText = (v) => typeof v === 'string' && v.trim() !== '';

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// Check a proposal. Throws a plain message, or returns the proposal.
// context (optional): { items, order } where items is the Brain's item list (a read-only view will do)
// and order is the agents' run order. With a context the item, its owner and the request are checked too.
export function checkProposal(p, context) {
  const fail = (msg) => { throw new Error(`Bad proposal${p && p.id ? ` "${p.id}"` : ''}: ${msg}`); };
  if (p === null || typeof p !== 'object' || Array.isArray(p)) fail('a proposal must be an object.');
  for (const f of ['id', 'agent', 'itemId', 'why', 'ruleId']) if (!isText(p[f])) fail(`it needs "${f}" as text.`);
  if (p.why.length > MAX_WHY_LENGTH) fail(`"why" is ${p.why.length} characters. The limit is ${MAX_WHY_LENGTH}.`);
  if (!SOURCES.includes(p.source)) fail(`source "${p.source}" is not allowed. Use rule or ai.`);
  if (!CONFIDENCES.includes(p.confidence)) fail(`confidence "${p.confidence}" is not allowed. Use high or low.`);

  const options = p.options;
  if (!Array.isArray(options)) fail('"options" must be a list.');
  if (options.length < 2) fail('it needs at least one real option and then Custom.');
  if (options.length > MAX_OPTIONS) fail(`it has ${options.length} options. The most allowed is ${MAX_OPTIONS}, with Custom counted.`);
  const last = options[options.length - 1];
  if (!last || last.id !== CUSTOM_OPTION_ID || last.label !== 'Custom') fail('the last option must be Custom.');
  if ('newValue' in last) fail('Custom has no value of its own. The user types one.');
  const real = options.slice(0, -1);
  const seen = new Set();
  for (const o of real) {
    if (o === null || typeof o !== 'object' || !isText(o.id) || !isText(o.label) || !('newValue' in o) || o.newValue === undefined) {
      fail('each real option needs an id, a label and a newValue.');
    }
    if (o.id === CUSTOM_OPTION_ID) fail('only the last option may be Custom.');
    if (seen.has(o.id)) fail(`option id "${o.id}" is used twice.`);
    seen.add(o.id);
  }
  if (p.confidence === 'low' && real.length !== 2) {
    fail(`with low confidence it must show exactly two real options plus Custom. It shows ${real.length}.`);
  }

  if (p.source === 'ai') {
    const a = p.ai;
    if (a === null || typeof a !== 'object' || !isText(a.task) || typeof a.costUsd !== 'number' || !(a.costUsd >= 0)) fail('an AI proposal needs "ai" with the task name and the cost in dollars.');
  } else if (p.ai !== undefined) {
    fail('only an AI proposal may carry "ai".');
  }
  if (p.aiNote !== undefined && (!isText(p.aiNote) || p.aiNote.length > MAX_WHY_LENGTH || p.source !== 'rule')) fail('"aiNote" must be short text on a rule-based proposal.');

  if (p.request !== undefined) {
    const r = p.request;
    if (r === null || typeof r !== 'object' || !isText(r.itemId) || !isText(r.owner)) fail('a request needs "itemId" and "owner".');
    if (r.itemId !== p.itemId) fail('a request must name the same item as the proposal.');
    if (r.owner === p.agent) fail('a request must be for an earlier agent, not the asking agent.');
  }

  if (context) {
    const item = (context.items || []).find((i) => i.id === p.itemId);
    if (!item) fail(`item "${p.itemId}" does not exist.`);
    if (p.request === undefined) {
      if (item.owner !== p.agent) fail(`${p.agent} does not own item "${p.itemId}". Its owner is ${item.owner}. Use a request to ask for a change.`);
    } else {
      if (p.request.owner !== item.owner) fail(`the request says the owner is ${p.request.owner}, but item "${p.itemId}" is owned by ${item.owner}.`);
      if (Array.isArray(context.order)) {
        const from = context.order.indexOf(p.agent);
        const to = context.order.indexOf(item.owner);
        if (from === -1) fail(`${p.agent} is not an agent in the run order.`);
        if (to === -1 || to >= from) fail(`a request must name an earlier agent's item. ${item.owner} does not run before ${p.agent}.`);
      }
    }
  }
  return p;
}

// Build a checked, frozen proposal. fields: { id, agent, itemId, why, source, ruleId, confidence,
// options (the real options only: [{ id, label, newValue }]), request? }.
// "Custom" is added last by this function, so no agent can forget it or put it elsewhere.
// context is passed to checkProposal.
export function buildProposal(fields, context) {
  const f = fields || {};
  if (!Array.isArray(f.options)) throw new Error(`Bad proposal${f.id ? ` "${f.id}"` : ''}: "options" must be a list.`);
  const real = f.options.map((o, i) => (i === 0 && f.confidence === 'high' && o && typeof o === 'object' ? { ...o, recommended: true } : o));
  const proposal = {
    id: f.id, agent: f.agent, itemId: f.itemId, why: f.why, source: f.source, ruleId: f.ruleId, confidence: f.confidence,
    options: [...real, { id: CUSTOM_OPTION_ID, label: 'Custom' }],
  };
  if (f.request !== undefined) proposal.request = f.request;
  if (f.ai !== undefined) proposal.ai = f.ai;
  if (f.aiNote !== undefined) proposal.aiNote = f.aiNote;
  checkProposal(proposal, context);
  return deepFreeze(structuredClone(proposal));
}

// The real options of a proposal (everything except Custom).
export function realOptions(proposal) {
  return proposal.options.slice(0, -1);
}
