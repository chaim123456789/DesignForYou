// The AI gate (design-team D1, requirements R7, design section 9). The one door a paid AI model may be reached through.
//
// What it does, in plain words:
//   - It allows exactly two kinds of task: "read-photo" (understand a photo) and "judge-taste" (judge a matter of taste).
//     Anything else is refused with a message.
//   - It has a spending cap (capUsd). The cap defaults to zero, which means AI is off. Before a call it checks the estimated
//     cost against what is left and refuses the call if it would go over. It tracks what was spent and what is left.
//   - The thing that really makes the call (the "provider") is handed in. In this spec it is the stand-in, which returns a
//     fixed answer and says so. The gate itself has no network code and no key. A real model is a later, separate decision.
//   - A reply is treated as data. Tags are kept only when they are in the style vocabulary, and text is cut to a length.
//   - If a call is refused or fails, the gate returns { ok: false, reason } and never throws, so the caller can fall back to its rules.
//
// Honest limit: the cap in this page is a guard for the demo; a cap that cannot be bypassed needs a server.
// Nothing here reads a file. The budget comes from budget.json, passed in (loadBudget reads it in Node only).

export const TASK_READ_PHOTO = 'read-photo';
export const TASK_JUDGE_TASTE = 'judge-taste';
export const ALLOWED_TASKS = Object.freeze([TASK_READ_PHOTO, TASK_JUDGE_TASTE]);
export const MAX_ANSWER_TEXT = 200;
export const CAP_NOTE = 'The cap in this page is a guard for the demo; a cap that cannot be bypassed needs a server.';

const round = (n) => Math.round(n * 1e6) / 1e6;

// Reads src/ai/budget.json (Node only). In a browser, pass the budget data directly.
export function loadBudget(file) {
  if (typeof process === 'undefined' || typeof process.getBuiltinModule !== 'function') {
    throw new Error('Reading budget.json needs Node.js. In a browser, pass the budget data directly.');
  }
  const fs = process.getBuiltinModule('node:fs');
  const url = process.getBuiltinModule('node:url');
  const path = file === undefined ? url.fileURLToPath(new URL('./budget.json', import.meta.url)) : file;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

// The budget of a page where AI is off: a cap of zero. No estimate is needed because nothing can pass a cap of zero.
export const OFF_BUDGET = Object.freeze({ capUsd: 0, spentUsd: 0, estimateUsd: Object.freeze({}) });

function checkBudget(budget) {
  if (budget === null || typeof budget !== 'object') throw new Error('The AI gate needs a budget.');
  for (const f of ['capUsd', 'spentUsd']) {
    if (typeof budget[f] !== 'number' || !Number.isFinite(budget[f]) || budget[f] < 0) throw new Error(`The budget needs "${f}" as a number that is not negative.`);
  }
  if (budget.estimateUsd === null || typeof budget.estimateUsd !== 'object') throw new Error('The budget needs "estimateUsd", a number for each task.');
  for (const [task, cost] of Object.entries(budget.estimateUsd)) {
    if (!ALLOWED_TASKS.includes(task)) throw new Error(`The budget has an estimate for "${task}", which is not an allowed task.`);
    if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) throw new Error(`The estimate for ${task} must be a number that is not negative.`);
  }
}

// Keep only what is safe to show: tags from the vocabulary, text cut to a length. The reply is never run and never trusted as an instruction.
export function cleanAnswer(answer, vocabulary) {
  const out = {};
  const raw = answer !== null && typeof answer === 'object' ? answer : {};
  const cut = [];
  if (Array.isArray(raw.tags)) {
    out.tags = raw.tags.filter((t) => typeof t === 'string' && vocabulary.includes(t));
    for (const t of raw.tags) if (!out.tags.includes(t)) cut.push(String(t).slice(0, 40));
  } else {
    out.tags = [];
  }
  out.text = typeof raw.text === 'string' ? raw.text.slice(0, MAX_ANSWER_TEXT) : '';
  if (typeof raw.choice === 'string') out.choice = raw.choice.slice(0, 80);
  if (typeof raw.label === 'string') out.label = raw.label.slice(0, 80);
  if (cut.length > 0) out.cutTags = cut;
  return out;
}

// options.budget   : { capUsd, spentUsd, estimateUsd } (copied; the gate keeps its own running total)
// options.provider : (request) => answer. The only thing that makes the call. Missing means nothing can be called.
// options.vocabulary: the tags an answer may carry.
export function createGate(options = {}) {
  const source = options.budget === undefined ? OFF_BUDGET : options.budget;
  checkBudget(source);
  const budget = { capUsd: source.capUsd, spentUsd: source.spentUsd, estimateUsd: { ...source.estimateUsd } };
  const provider = options.provider;
  const vocabulary = Array.isArray(options.vocabulary) ? options.vocabulary.slice() : [];

  const money = () => ({ capUsd: budget.capUsd, spentUsd: round(budget.spentUsd), remainingUsd: round(Math.max(0, budget.capUsd - budget.spentUsd)) });
  const refuse = (reason) => ({ ok: false, reason, ...money() });

  function status() {
    return { on: budget.capUsd > 0, ...money(), allowedTasks: ALLOWED_TASKS.slice(), note: CAP_NOTE };
  }

  // Ask for one task. Returns { ok: true, task, source: 'ai', answer, costUsd, label, ...money } or { ok: false, reason, ...money }.
  function ask(task, input) {
    if (!ALLOWED_TASKS.includes(task)) return refuse(`The task "${task}" is not allowed. The gate only allows ${ALLOWED_TASKS.join(' and ')}.`);
    if (!(budget.capUsd > 0)) return refuse('AI is off: the spending cap is zero. The rules were used.');
    if (typeof provider !== 'function') return refuse('No AI provider is connected. The rules were used.');
    const estimate = budget.estimateUsd[task];
    if (typeof estimate !== 'number') return refuse(`The budget has no estimate for ${task}, so the call was not made.`);
    if (budget.spentUsd + estimate > budget.capUsd + 1e-9) {
      return refuse(`The call would cost about $${estimate} and only $${money().remainingUsd} is left under the cap of $${budget.capUsd}, so it was not made.`);
    }
    let reply;
    try {
      reply = provider({ task, input: structuredClone(input) });
    } catch (error) {
      return refuse(`The AI call failed: ${error && error.message ? error.message : String(error)}. The rules were used.`);
    }
    if (reply === null || typeof reply !== 'object' || reply.answer === null || typeof reply.answer !== 'object') {
      return refuse('The AI call gave no usable answer. The rules were used.');
    }
    budget.spentUsd = round(budget.spentUsd + estimate);
    return {
      ok: true, task, source: 'ai', costUsd: estimate, label: typeof reply.label === 'string' ? reply.label.slice(0, 80) : '',
      answer: cleanAnswer(reply.answer, vocabulary), ...money(),
    };
  }

  return { ask, status };
}
