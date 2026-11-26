// The agent settings (look-and-feel R4): how a proposal is confirmed. Pure logic: no page code.
//
// Three levels, one global choice, an optional choice per agent, and one rule ("Doors and windows move with their wall").
// The settings only decide WHO confirms a proposal. They never change who owns an item, never change a Locked item and never skip the
// gatekeeper: an automatic confirmation goes through the same run.answer and the same gatekeeper as one the visitor presses.
import { AGENTS } from '../agent-info.js';

export const LEVELS = Object.freeze([
  { id: 'ask', label: 'Always ask me', help: 'Every proposal waits for your answer.' },
  {
    id: 'recommended',
    label: 'Recommended',
    help: 'You are asked when a change affects another agent\'s work, causes a clash, or touches a Locked item. Otherwise the agent\'s recommended option is applied, and you are told.',
  },
  { id: 'auto', label: 'Do it and tell me', help: 'The agent\'s recommended option is applied at once and you are told. Locked items are still never changed, and you are asked about them.' },
]);
export const LEVEL_IDS = LEVELS.map((l) => l.id);
export const INHERIT = 'inherit';
export const levelLabel = (id) => (LEVELS.find((l) => l.id === id) || { label: id }).label;

export const DEFAULT_SETTINGS = Object.freeze({ global: 'recommended', agents: Object.freeze({}), doorsFollowWall: true });

export function defaultSettings() {
  return { global: DEFAULT_SETTINGS.global, agents: {}, doorsFollowWall: DEFAULT_SETTINGS.doorsFollowWall };
}

// Make any stored value safe. Unknown levels, unknown agents and wrong types fall back to the defaults, so a damaged or
// hand-edited value can never switch on something the visitor did not choose.
export function cleanSettings(raw) {
  const out = defaultSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (LEVEL_IDS.includes(raw.global)) out.global = raw.global;
  if (typeof raw.doorsFollowWall === 'boolean') out.doorsFollowWall = raw.doorsFollowWall;
  if (raw.agents && typeof raw.agents === 'object' && !Array.isArray(raw.agents)) {
    for (const agent of AGENTS) {
      const level = Object.hasOwn(raw.agents, agent.name) ? raw.agents[agent.name] : undefined;
      if (LEVEL_IDS.includes(level)) out.agents[agent.name] = level;
    }
  }
  return out;
}

// The level that applies to one agent: its own choice, else the global one.
export function levelFor(settings, agentName) {
  const own = settings.agents && Object.hasOwn(settings.agents, agentName) ? settings.agents[agentName] : undefined;
  return LEVEL_IDS.includes(own) ? own : settings.global;
}

// A store for the settings. `storage` has read(key) and write(key, value) (see browser-store.js). A value that cannot be read or
// written never throws: the settings then last for this visit, and `saved` says so (the page shows it in words).
export function createSettings(storage, key) {
  let current = defaultSettings();
  let saved = true;
  const listeners = [];
  if (storage) {
    try {
      const text = storage.read(key);
      if (text !== null && text !== undefined) current = cleanSettings(JSON.parse(text));
    } catch {
      current = defaultSettings();
    }
    saved = storage.available !== false;
  } else {
    saved = false;
  }

  function changed() {
    if (storage) {
      try {
        saved = storage.write(key, JSON.stringify(current)) === true;
      } catch {
        saved = false;
      }
    }
    for (const fn of listeners) fn(api.get());
  }

  const api = {
    get: () => ({ global: current.global, agents: { ...current.agents }, doorsFollowWall: current.doorsFollowWall }),
    levelFor: (agentName) => levelFor(current, agentName),
    get saved() { return saved; },
    setGlobal(level) {
      if (!LEVEL_IDS.includes(level)) throw new Error(`"${level}" is not one of the three levels.`);
      current.global = level;
      changed();
    },
    // level is one of the three, or INHERIT to use the global choice again.
    setAgent(agentName, level) {
      if (!AGENTS.some((a) => a.name === agentName)) throw new Error(`"${agentName}" is not an agent.`);
      if (level === INHERIT) delete current.agents[agentName];
      else if (LEVEL_IDS.includes(level)) current.agents[agentName] = level;
      else throw new Error(`"${level}" is not one of the three levels.`);
      changed();
    },
    setDoorsFollowWall(on) {
      current.doorsFollowWall = on === true;
      changed();
    },
    onChange(fn) { listeners.push(fn); },
  };
  return api;
}
