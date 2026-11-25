// Reads one knowledge file, checks its provenance block (R6.1 to R6.4) and returns its rules.
// Pure checks work in a browser too: validateKnowledge takes the data and the allowed licences directly.
// The Node file tools are fetched only when a file is really read from disk.

export const MAX_TEXT_LENGTH = 200;
export const RULE_NOTE_START = 'typical guideline, check local rules';
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
// A web address written without the http start, for example gov.uk/some/page.
const ADDRESS_FORMAT = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
// Every source says whether anyone read it: "not checked", or "read" with the date, like "read 2026-11-25".
export const NOT_CHECKED = 'not checked';
const CHECKED_FORMAT = /^read \d{4}-\d{2}-\d{2}$/;

// In a browser there are no file tools. The page hands in every knowledge file as data (see docs/team/data.js), once, and the
// loaders below read from that table. The same checks run on it, so a bad file is rejected the same way (design-team D4).
const preload = { files: null };
export function usePreloadedKnowledge(files) {
  if (files === null || typeof files !== 'object' || Array.isArray(files)) throw new Error('Preloaded knowledge must be an object of files, by path.');
  preload.files = files;
}
export function clearPreloadedKnowledge() { preload.files = null; }

function nodeTools() {
  if (typeof process === 'undefined' || typeof process.getBuiltinModule !== 'function') {
    throw new Error('Reading knowledge files needs Node.js. In a browser, pass the data directly.');
  }
  return {
    fs: process.getBuiltinModule('node:fs'),
    path: process.getBuiltinModule('node:path'),
    url: process.getBuiltinModule('node:url'),
  };
}

function readJson(file, what) {
  const { fs } = nodeTools();
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`The ${what} file is missing: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The ${what} file is not valid JSON: ${file}`);
  }
}

function knowledgeDir() {
  const { path, url } = nodeTools();
  return path.dirname(url.fileURLToPath(import.meta.url));
}

// The licences a source may use.
export function loadAllowedLicences(file) {
  if (preload.files !== null && file === undefined && preload.files['allowed-licences.json']) {
    const data = preload.files['allowed-licences.json'];
    if (!data || !Array.isArray(data.licences) || data.licences.length === 0 || data.licences.some((l) => typeof l !== 'string')) {
      throw new Error('The allowed licences file needs a list called "licences".');
    }
    return Object.freeze([...data.licences]);
  }
  const { path } = nodeTools();
  const data = readJson(file === undefined ? path.join(knowledgeDir(), 'allowed-licences.json') : file, 'allowed licences');
  if (!data || !Array.isArray(data.licences) || data.licences.length === 0 || data.licences.some((l) => typeof l !== 'string')) {
    throw new Error('The allowed licences file needs a list called "licences".');
  }
  return Object.freeze([...data.licences]);
}

// Every text value anywhere in the data, with where it is, so a long pasted passage can be found.
function* allText(value, where) {
  if (typeof value === 'string') yield [where, value];
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* allText(value[i], `${where}[${i}]`);
  else if (value !== null && typeof value === 'object') for (const k of Object.keys(value)) yield* allText(value[k], `${where}.${k}`);
}

// Check one knowledge file's data. Returns { provenance, rules } or throws a plain message that names the file.
export function validateKnowledge(data, allowedLicences, fileName = 'A knowledge file') {
  const fail = (msg) => { throw new Error(`${fileName}: ${msg}`); };
  if (data === null || typeof data !== 'object' || Array.isArray(data)) fail('it must be an object with "provenance" and "rules".');

  const p = data.provenance;
  if (p === undefined || p === null || typeof p !== 'object' || Array.isArray(p)) fail('it has no provenance block.');
  for (const field of ['title', 'covers']) {
    if (typeof p[field] !== 'string' || p[field].trim() === '') fail(`the provenance block has no ${field}.`);
  }
  if (p.writtenBy !== 'own words') fail('the provenance block must say writtenBy is "own words".');
  if (typeof p.date !== 'string' || !DATE_FORMAT.test(p.date)) fail('the provenance block needs a date written like 2026-11-25.');
  if (!Array.isArray(p.sources) || p.sources.length === 0) fail('it lists no source. Every knowledge file needs at least one open source.');
  p.sources.forEach((s, i) => {
    if (s === null || typeof s !== 'object') fail(`source ${i + 1} must be an object with name, url and licence.`);
    if (typeof s.name !== 'string' || s.name.trim() === '') fail(`source ${i + 1} has no name.`);
    if (typeof s.url !== 'string' || !ADDRESS_FORMAT.test(s.url)) fail(`source ${i + 1} ("${s.name}") needs a web address written without the http start, like gov.uk/page.`);
    if (s.checked !== NOT_CHECKED && !(typeof s.checked === 'string' && CHECKED_FORMAT.test(s.checked))) {
      fail(`source ${i + 1} ("${s.name}") needs "checked" to say "${NOT_CHECKED}" or "read" with a date, like "read 2026-11-25".`);
    }
    if (!allowedLicences.includes(s.licence)) {
      fail(`source ${i + 1} ("${s.name}") has the licence "${s.licence}", which is not allowed. Allowed: ${allowedLicences.join(', ')}.`);
    }
  });

  if (!Array.isArray(data.rules) || data.rules.length === 0) fail('it needs a list of rules called "rules".');
  const ids = new Set();
  data.rules.forEach((r, i) => {
    if (r === null || typeof r !== 'object') fail(`rule ${i + 1} must be an object.`);
    if (typeof r.id !== 'string' || r.id.trim() === '') fail(`rule ${i + 1} has no id.`);
    if (ids.has(r.id)) fail(`rule id "${r.id}" is used twice.`);
    ids.add(r.id);
    if (r.when === null || typeof r.when !== 'object' || r.then === null || typeof r.then !== 'object') {
      fail(`rule "${r.id}" needs "when" and "then" as objects.`);
    }
    if (typeof r.note !== 'string' || !r.note.toLowerCase().startsWith(RULE_NOTE_START)) {
      fail(`rule "${r.id}" needs a note that starts with "Typical guideline, check local rules."`);
    }
  });

  for (const [where, text] of allText(data, 'file')) {
    if (text.length > MAX_TEXT_LENGTH) {
      fail(`the text at ${where} is ${text.length} characters long. The limit is ${MAX_TEXT_LENGTH}. Write short rules in your own words.`);
    }
  }
  return Object.freeze({ provenance: p, rules: Object.freeze([...data.rules]) });
}

// Read and check one knowledge file by its path under src/knowledge/, for example "shared/room-types.json" (Node only).
export function loadKnowledge(relativePath, options = {}) {
  if (preload.files !== null && options.baseDir === undefined) {
    if (!(relativePath in preload.files)) throw new Error(`The knowledge file is missing: ${relativePath}`);
    const licences = options.allowedLicences === undefined ? loadAllowedLicences() : options.allowedLicences;
    return validateKnowledge(structuredClone(preload.files[relativePath]), licences, relativePath);
  }
  const { path } = nodeTools();
  const base = options.baseDir === undefined ? knowledgeDir() : options.baseDir;
  const licences = options.allowedLicences === undefined ? loadAllowedLicences(path.join(base, 'allowed-licences.json')) : options.allowedLicences;
  const file = path.join(base, relativePath);
  return validateKnowledge(readJson(file, 'knowledge'), licences, relativePath);
}
