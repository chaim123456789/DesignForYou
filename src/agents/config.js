// Loads the agent.json settings files. Each agent has its own folder and file.
// The Reviewer is always on: its "enabled" setting is ignored (R6.7).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The fixed run order (R6.1).
export const AGENT_ORDER = Object.freeze(['Style', 'Layout', 'Builder', 'Reviewer']);

const here = path.dirname(fileURLToPath(import.meta.url));

// Check one config object. Returns { name, enabled }.
export function validateAgentConfig(config, expectedName) {
  const label = expectedName ? `The ${expectedName} agent config` : 'An agent config';
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${label} must be an object with "name" and "enabled".`);
  }
  if (!AGENT_ORDER.includes(config.name)) {
    throw new Error(`${label} has an unknown name "${config.name}". Names are: ${AGENT_ORDER.join(', ')}.`);
  }
  if (expectedName && config.name !== expectedName) {
    throw new Error(`${label} says its name is "${config.name}". It should be "${expectedName}".`);
  }
  if (typeof config.enabled !== 'boolean') {
    throw new Error(`${label} needs "enabled" to be true or false.`);
  }
  // The Reviewer cannot be turned off.
  return { name: config.name, enabled: config.name === 'Reviewer' ? true : config.enabled };
}

// Load one agent's agent.json from <baseDir>/<lowercase name>/agent.json.
export function loadAgentConfig(name, baseDir = here) {
  const file = path.join(baseDir, name.toLowerCase(), 'agent.json');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`The ${name} agent config file is missing: ${file}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`The ${name} agent config file is not valid JSON: ${file}`);
  }
  return validateAgentConfig(parsed, name);
}

// Load all four configs, in run order.
export function loadAllAgentConfigs(baseDir = here) {
  return AGENT_ORDER.map((name) => loadAgentConfig(name, baseDir));
}
