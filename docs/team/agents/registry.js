// Reads and checks src/agents/registry.json: the design team's run order and dependencies (R1.6).
// The names and the order are written only in registry.json. This file holds no copy of them.
// The Node file tools are fetched only when the file is really read, so a browser can pass the data in directly.

const TEAM_SIZE = 8;
const LAST_AGENT = 'Reviewer';

function nodeTools() {
  if (typeof process === 'undefined' || typeof process.getBuiltinModule !== 'function') {
    throw new Error('Reading registry.json needs Node.js. In a browser, pass the registry data directly.');
  }
  return {
    fs: process.getBuiltinModule('node:fs'),
    url: process.getBuiltinModule('node:url'),
  };
}

// Check a registry object. Returns a frozen { agents, order } or throws a plain message.
// agents: [{ name, folder, dependsOn }] in run order. order: the names only.
export function validateRegistry(data) {
  if (data === null || typeof data !== 'object' || !Array.isArray(data.agents)) {
    throw new Error('The agent registry must be an object with a list called "agents".');
  }
  const list = data.agents;
  if (list.length !== TEAM_SIZE) {
    throw new Error(`The agent registry must list exactly ${TEAM_SIZE} agents. It lists ${list.length}.`);
  }
  const position = new Map();
  list.forEach((a, i) => {
    if (a === null || typeof a !== 'object') throw new Error(`Registry entry ${i + 1} must be an object.`);
    if (typeof a.name !== 'string' || a.name.trim() === '') throw new Error(`Registry entry ${i + 1} needs a name.`);
    if (typeof a.folder !== 'string' || a.folder.trim() === '') throw new Error(`Agent "${a.name}" needs a folder name.`);
    if (!Array.isArray(a.dependsOn) || a.dependsOn.some((d) => typeof d !== 'string')) {
      throw new Error(`Agent "${a.name}" needs "dependsOn" to be a list of agent names.`);
    }
    if (position.has(a.name)) throw new Error(`Agent "${a.name}" is listed twice.`);
    position.set(a.name, i);
  });
  const folders = list.map((a) => a.folder);
  if (new Set(folders).size !== folders.length) throw new Error('Two agents share one folder. Each agent needs its own folder.');
  if (list[list.length - 1].name !== LAST_AGENT) {
    throw new Error(`The ${LAST_AGENT} must be last in the registry. The last agent is "${list[list.length - 1].name}".`);
  }
  list.forEach((a, i) => {
    for (const d of a.dependsOn) {
      if (!position.has(d)) throw new Error(`Agent "${a.name}" depends on "${d}", which is not in the registry.`);
      if (position.get(d) >= i) {
        throw new Error(`Agent "${a.name}" depends on "${d}", which runs later or is itself. An agent may depend only on earlier agents.`);
      }
    }
  });
  const agents = list.map((a) => Object.freeze({ name: a.name, folder: a.folder, dependsOn: Object.freeze([...a.dependsOn]) }));
  return Object.freeze({ agents: Object.freeze(agents), order: Object.freeze(agents.map((a) => a.name)) });
}

// Read and check registry.json (Node only).
export function loadRegistry(file) {
  const { fs, url } = nodeTools();
  const target = file === undefined ? url.fileURLToPath(new URL('./registry.json', import.meta.url)) : file;
  let text;
  try {
    text = fs.readFileSync(target, 'utf8');
  } catch {
    throw new Error(`The agent registry file is missing: ${target}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`The agent registry file is not valid JSON: ${target}`);
  }
  return validateRegistry(parsed);
}

// The agents an agent depends on, directly and through others, in run order.
export function allDependencies(registry, name) {
  const byName = new Map(registry.agents.map((a) => [a.name, a]));
  if (!byName.has(name)) throw new Error(`"${name}" is not an agent in the registry.`);
  const seen = new Set();
  const visit = (n) => {
    for (const d of byName.get(n).dependsOn) {
      if (!seen.has(d)) { seen.add(d); visit(d); }
    }
  };
  visit(name);
  return registry.order.filter((n) => seen.has(n));
}
