// The design team's Coordinator: runs the eight agents as steps (design-team R1 to R4, design section 7).
//
// The run is a small state machine that stays synchronous and testable:
//   const run = createRun(project, { registry, agents, configs, now, scripted });
//   run.next()                    runs the next enabled agent and returns its proposals
//   run.answer(id, choice, value) answers one proposal: an option id, 'custom' (with a value) or 'skip'
//   run.done()                    true when every step has finished (or the run failed)
//   runWithScript(project, opts)  answers every proposal from a fixed policy, labelled "scripted answer"
//
// An agent is a function (view, context) => [proposal, ...]. It gets a frozen read-only copy of the Brain,
// so it cannot change anything. It returns proposals only (built with buildProposal). Nothing changes until
// answer() is called, and every change goes through the gatekeeper, the one door.
// The old runPipeline in coordinator.js is not touched. Only makeReadOnlyView is reused.
import { createGatekeeper } from './brain/gatekeeper.js';
import { makeReadOnlyView } from './coordinator.js';
import { checkProposal, CUSTOM_OPTION_ID } from './proposal.js';
import { findStale, agentsToRecheck, ITSELF_STALE } from './ripple.js';

const REVIEWER = 'Reviewer';
export const SCRIPTED = 'scripted answer';
const USER_APPROVER = 'user';

// Items a re-check cannot help. `seeds` are items nobody can fix by looking again (a Locked item flagged "needs your look", an item
// the user skipped). An item is also unfixable when EVERY reason it is stale is "that item is itself stale" and that item is
// unfixable (found step by step). A reason like "that item changed in version N" is always fixable: the owner can look again.
// stale: the list from findStale. Returns a Set of item ids.
export function findUnfixable(stale, seeds) {
  const unfixable = new Set(seeds);
  for (let grew = true; grew;) {
    grew = false;
    for (const st of stale) {
      if (!unfixable.has(st.itemId) && st.because.every((b) => b.why.endsWith(ITSELF_STALE) && unfixable.has(b.itemId))) { unfixable.add(st.itemId); grew = true; }
    }
  }
  return unfixable;
}

// An empty stand-in agent: proposes nothing.
export const standInTeamAgent = () => [];

function checkConfigs(registry, configs) {
  const byName = new Map(registry.order.map((n) => [n, true]));
  if (configs !== undefined) {
    if (!Array.isArray(configs)) throw new Error('configs must be a list of { name, enabled }.');
    for (const c of configs) {
      if (!c || !registry.order.includes(c.name)) throw new Error(`The config names "${c && c.name}", which is not an agent in the registry.`);
      if (typeof c.enabled !== 'boolean') throw new Error(`The ${c.name} config needs "enabled" to be true or false.`);
      byName.set(c.name, c.name === REVIEWER ? true : c.enabled); // the Reviewer cannot be turned off
    }
  }
  return byName;
}

export function createRun(project, options = {}) {
  const registry = options.registry;
  if (!registry || !Array.isArray(registry.order)) throw new Error('A run needs the agent registry (options.registry).');
  const agents = options.agents || {};
  for (const name of Object.keys(agents)) {
    if (!registry.order.includes(name)) throw new Error(`An agent function was given for "${name}", which is not in the registry.`);
  }
  const enabled = checkConfigs(registry, options.configs);
  const approvedBy = options.scripted ? SCRIPTED : USER_APPROVER;
  const log = (entry) => project.runLog.push(entry);
  // The gatekeeper is the one door. Its functions are used by name so this file holds the run, not the rules.
  const { changeItem, refreshBasis } = createGatekeeper(project, { now: options.now });

  // The agenda is the list of steps still to run. The first pass is every agent in order, once.
  const agenda = registry.order.map((agent) => ({ agent, kind: 'first' }));
  const ranBefore = new Set(); // agents that have started in this run (for ripple scheduling)
  const keptAsIs = [];
  const needsLook = new Set();
  const answers = [];
  const history = []; // every step with its proposals and the answers, for the screen and the viewer (design-team D4, D5)
  const seenProposalIds = new Set();
  let current = null; // { agent, kind, proposals: Map, staleIds, proposedItems, ... }
  let failure = null;
  let finished = false;
  let ripplePasses = 0;

  function fail(agent, reason) {
    log({ agent, event: 'failed', reason });
    failure = { ok: false, failedAgent: agent, reason };
    current = null;
    return failure;
  }

  function currentBasis(item) {
    return item.basis ? item.basis.map((b) => ({ itemId: b.itemId, version: project.versions.length })) : undefined;
  }

  // End the current step: "still fine" for stale items nobody proposed to change, flag Locked ones,
  // then decide whether a ripple pass is needed.
  function finishStep() {
    const step = current;
    const staleNow = findStale(project, registry).stale.filter((s) => s.owner === step.agent && step.staleIds.has(s.itemId));
    for (const s of staleNow) {
      if (step.proposedItems.has(s.itemId)) continue; // answered by a proposal (accepted or kept as is)
      const item = project.items.find((i) => i.id === s.itemId);
      // The gatekeeper decides. A Locked item is refused (and the refusal is logged); then it is flagged for the user.
      const r = refreshBasis(step.agent, item.id, item.basis.map((b) => ({ itemId: b.itemId, version: project.versions.length })));
      if (!r.accepted && item.status === 'Locked') {
        needsLook.add(item.id);
        log({ agent: step.agent, event: 'needs-look', item: item.id, reason: `Locked item "${item.id}" is out of date with earlier work. It was not changed. Please take a look.` });
      }
    }
    log({ agent: step.agent, event: 'finished' });
    if (step.kind === 'recheck' && step.applied > 0) {
      // A change made during a ripple pass never starts another pass. What it made stale stays visibly stale (R3.9).
      log({ agent: step.agent, event: 'left-stale', reason: 'A change made during the re-check pass may have made other items stale. They are left as they are and will be reported.' });
    }
    const wasKind = step.kind;
    current = null;

    // Ripple (R3.3, R3.7): after an accepted change, agents that already ran and now own stale items look again,
    // in order, each once. Only a first-pass step that really changed something schedules a ripple pass, and a ripple
    // step never does, so a run can never loop.
    if (wasKind === 'first' && step.applied > 0) {
      const { agents: plan, errors } = agentsToRecheck(project, registry);
      if (errors.length > 0) { fail(step.agent, errors[0].message); return; }
      // Items a re-check cannot help do not add a ripple step: looking at them again would change nothing (see findUnfixable).
      const unfixable = findUnfixable(findStale(project, registry).stale, [...needsLook, ...keptAsIs.map((k) => k.itemId)]);
      // An item the user skipped ("kept as is") is not asked about again in this run. It stays stale and is reported.
      const skipped = new Set(keptAsIs.map((k) => k.itemId));
      const redo = plan.filter((a) => a.recheck && ranBefore.has(a.agent) && enabled.get(a.agent) && a.itemIds.some((id) => !skipped.has(id) && !unfixable.has(id)));
      if (redo.length > 0) {
        ripplePasses += 1;
        for (const a of plan) {
          log(a.recheck && redo.includes(a)
            ? { agent: a.agent, event: 're-check', reason: a.reason }
            : { agent: a.agent, event: 'not-affected', reason: a.recheck ? 'Re-check comes later in the normal order.' : a.reason });
        }
        agenda.unshift(...redo.map((a) => ({ agent: a.agent, kind: 'recheck' })));
      }
    }
  }

  function start(step) {
    ranBefore.add(step.agent);
    log({ agent: step.agent, event: 'started' });
    const missing = registry.agents.find((a) => a.name === step.agent).dependsOn.filter((d) => !enabled.get(d));
    for (const m of missing) log({ agent: step.agent, event: 'note', reason: `Working without ${m}, which is switched off.` });

    const { stale, errors } = findStale(project, registry);
    if (errors.length > 0) return fail(step.agent, errors[0].message);
    const staleIds = new Set(stale.filter((s) => s.owner === step.agent).map((s) => s.itemId));

    let proposals;
    try {
      const view = makeReadOnlyView(project);
      const agent = agents[step.agent] || standInTeamAgent;
      proposals = agent(view, { mode: step.kind, staleItemIds: [...staleIds] });
      if (!Array.isArray(proposals)) throw new Error('An agent must return a list of proposals.');
      const context = { items: view.items, order: registry.order };
      const inThisStep = new Set();
      proposals = proposals.map((p) => {
        checkProposal(p, context);
        if (p.agent !== step.agent) throw new Error(`Proposal "${p.id}" says it is from ${p.agent}, but ${step.agent} is running.`);
        // Two proposals with one id in the same step is a bug in the agent. The same id in a LATER step is normal: an agent that
        // looks at the same item and rule again after another change. That proposal gets a numbered id, so every answer is unique.
        if (inThisStep.has(p.id)) throw new Error(`Proposal id "${p.id}" was already used in this run.`);
        inThisStep.add(p.id);
        if (!seenProposalIds.has(p.id)) return p;
        let n = 2;
        while (seenProposalIds.has(`${p.id}#${n}`)) n += 1;
        return Object.freeze({ ...p, id: `${p.id}#${n}` });
      });
    } catch (error) {
      return fail(step.agent, error && error.message ? error.message : String(error));
    }
    for (const p of proposals) {
      seenProposalIds.add(p.id);
      log({
        agent: step.agent, event: 'proposed', item: p.itemId, proposal: p.id, source: p.source, ruleId: p.ruleId,
        ...(p.ai ? { costUsd: p.ai.costUsd, aiLabel: p.ai.label } : {}),
      });
      if (p.aiNote) log({ agent: step.agent, event: 'note', item: p.itemId, reason: p.aiNote });
    }
    history.push({ agent: step.agent, kind: step.kind, staleItemIds: [...staleIds], proposals: proposals.map((p) => ({ proposal: p, answer: null })) });
    current = {
      agent: step.agent, kind: step.kind, applied: 0, staleIds, proposedItems: new Set(proposals.map((p) => p.itemId)),
      proposals: new Map(proposals.map((p) => [p.id, p])),
    };
    return { done: false, agent: step.agent, kind: step.kind, staleItemIds: [...staleIds], proposals: proposals.slice() };
  }

  function next() {
    if (failure) return { done: true, ...failure };
    if (current && current.proposals.size > 0) {
      throw new Error(`Answer the proposals of ${current.agent} first. ${current.proposals.size} still waiting.`);
    }
    if (current) finishStep(); // a step with no proposals left
    if (failure) return { done: true, ...failure };
    while (agenda.length > 0) {
      const step = agenda.shift();
      if (!enabled.get(step.agent)) {
        log({ agent: step.agent, event: 'skipped', reason: 'Switched off in its config.' });
        continue;
      }
      const result = start(step);
      if (result.ok === false) return { done: true, ...result };
      if (result.proposals.length === 0) {
        finishStep();
        if (failure) return { done: true, ...failure };
      }
      return result;
    }
    finished = true;
    return { done: true, ok: true };
  }

  // Answer one proposal. choice: an option id, 'custom' (give value) or 'skip'.
  function answer(proposalId, choice, value) {
    if (failure) throw new Error('The run has stopped. Nothing more can be answered.');
    const proposal = current && current.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal "${proposalId}" is not waiting for an answer.`);
    let result;
    if (choice === 'skip') {
      keptAsIs.push({ itemId: proposal.itemId, agent: proposal.agent, proposalId });
      log({ agent: proposal.agent, event: 'kept-as-is', item: proposal.itemId, proposal: proposalId, by: approvedBy, reason: 'Skipped. The item is kept as it is.' });
      result = { applied: false, keptAsIs: true };
    } else {
      let newValue;
      if (choice === CUSTOM_OPTION_ID) {
        if (value === undefined) throw new Error('Custom needs a value.');
        const checker = agents[proposal.agent] && agents[proposal.agent].checkCustom;
        if (typeof checker === 'function') {
          const verdict = checker(proposal, structuredClone(value));
          if (verdict !== true) throw new Error(typeof verdict === 'string' ? verdict : 'That custom value is not allowed.');
        }
        newValue = structuredClone(value);
      } else {
        const option = proposal.options.find((o) => o.id === choice);
        if (!option || option.id === CUSTOM_OPTION_ID) throw new Error(`Proposal "${proposalId}" has no option "${choice}".`);
        newValue = structuredClone(option.newValue);
      }
      // A request is applied by the owner of the earlier item, never by the asking agent.
      const who = proposal.request ? proposal.request.owner : proposal.agent;
      const item = project.items.find((i) => i.id === proposal.itemId);
      const r = changeItem(who, item.id, newValue, { approvedBy, basis: currentBasis(item) });
      log({ agent: proposal.agent, event: 'answered', item: item.id, proposal: proposalId, choice, by: approvedBy, accepted: r.accepted });
      if (!r.accepted) {
        if (item.status === 'Locked') {
          needsLook.add(item.id);
          log({ agent: who, event: 'needs-look', item: item.id, reason: `Locked item "${item.id}" was not changed. Please take a look.` });
        }
        result = { applied: false, reason: r.reason };
      } else {
        current.applied += 1;
        result = { applied: true, version: r.version.number };
      }
    }
    current.proposals.delete(proposalId);
    answers.push({ proposalId, choice, by: approvedBy, ...result });
    const recorded = history[history.length - 1].proposals.find((x) => x.proposal.id === proposalId);
    if (recorded) recorded.answer = { choice, by: approvedBy, ...result };
    if (current.proposals.size === 0) {
      const step = current;
      finishStep();
      result = { ...result, stepFinished: step.agent };
    }
    return result;
  }

  return {
    next,
    answer,
    done: () => finished || failure !== null,
    get failure() { return failure; },
    get pending() { return current ? [...current.proposals.values()] : []; },
    get keptAsIs() { return keptAsIs.slice(); },
    get needsLook() { return [...needsLook]; },
    get answers() { return answers.slice(); },
    get steps() { return history.map((h) => ({ ...h, staleItemIds: h.staleItemIds.slice(), proposals: h.proposals.map((x) => ({ proposal: x.proposal, answer: x.answer ? { ...x.answer } : null })) })); },
    get ripplePasses() { return ripplePasses; },
    approvedBy,
  };
}

// Answer every proposal from a fixed policy and run to the end. Used by the sample and by tests.
// policy: 'first' (the recommended or first real option, the default), 'skip', or a function
// (proposal) => option id, 'skip', or { custom: value }. Every answer is labelled "scripted answer".
export function runWithScript(project, options = {}) {
  const policy = options.policy === undefined ? 'first' : options.policy;
  const run = createRun(project, { ...options, scripted: true });
  const steps = [];
  for (;;) {
    const step = run.next();
    if (step.done) return { ok: step.ok !== false, failure: run.failure, run, steps };
    steps.push({ agent: step.agent, kind: step.kind, proposalIds: step.proposals.map((p) => p.id) });
    for (const p of step.proposals) {
      let choice = typeof policy === 'function' ? policy(p) : policy;
      if (choice === 'first') choice = p.options[0].id;
      if (choice && typeof choice === 'object') run.answer(p.id, CUSTOM_OPTION_ID, choice.custom);
      else run.answer(p.id, choice);
    }
  }
}
