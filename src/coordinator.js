// The Coordinator: runs the four agents in a fixed order (R6).
//
// An agent is a function: (brainView) => [{ itemId, newValue }, ...]
//  - brainView is a frozen copy of the Brain. Writing to it throws an error,
//    and it is not the real Brain, so an agent cannot change the Brain directly.
//  - The returned list is only a set of proposals. The Coordinator sends each
//    one to the gatekeeper, using the agent's own name. An agent cannot
//    choose another name, and cannot skip the gatekeeper's checks.
import { createGatekeeper } from './brain/gatekeeper.js';
import { AGENT_ORDER, loadAllAgentConfigs, validateAgentConfig } from './agents/config.js';

// An empty stand-in agent: proposes nothing.
export const standInAgent = () => [];

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// A read-only copy of the Brain for an agent to read.
export function makeReadOnlyView(project) {
  return deepFreeze(structuredClone(project));
}

function checkProposals(proposals) {
  if (!Array.isArray(proposals)) {
    throw new Error('An agent must return a list of proposed changes.');
  }
  for (const p of proposals) {
    if (!p || typeof p !== 'object' || typeof p.itemId !== 'string' || !('newValue' in p)) {
      throw new Error('Each proposed change needs an itemId and a newValue.');
    }
  }
}

// Run the pipeline once.
// options.agents  : { Style: fn, Layout: fn, Builder: fn, Reviewer: fn } (missing ones are stand-ins)
// options.configs : list of { name, enabled } (default: the agent.json files)
// options.now     : function giving the time for new versions (for repeatable runs)
// Returns { ok: true } or { ok: false, failedAgent, reason }.
export function runPipeline(project, options = {}) {
  const agents = options.agents || {};
  const rawConfigs = options.configs || loadAllAgentConfigs();
  // Validate each config, then look them up by name. The order is always AGENT_ORDER.
  const configByName = new Map(rawConfigs.map((c) => {
    const v = validateAgentConfig(c);
    return [v.name, v];
  }));
  const gate = createGatekeeper(project, { now: options.now });

  for (const name of AGENT_ORDER) {
    const config = configByName.get(name);
    if (!config) throw new Error(`No config was given for the ${name} agent.`);

    if (!config.enabled) {
      project.runLog.push({ agent: name, event: 'skipped', reason: 'Switched off in its config file.' });
      continue;
    }

    project.runLog.push({ agent: name, event: 'started' });
    try {
      const agent = agents[name] || standInAgent;
      const proposals = agent(makeReadOnlyView(project));
      checkProposals(proposals);
      for (const p of proposals) gate.changeItem(name, p.itemId, p.newValue);
    } catch (error) {
      const reason = error && error.message ? error.message : String(error);
      project.runLog.push({ agent: name, event: 'failed', reason });
      return { ok: false, failedAgent: name, reason };
    }
    project.runLog.push({ agent: name, event: 'finished' });
  }
  return { ok: true };
}
