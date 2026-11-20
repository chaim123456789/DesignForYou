// Intake 11.7: a search of every file in the project for API keys, tokens, passwords and secrets.
// The search reads every file except .git (the history is not a working file) and does not follow links.
// It looks for (1) the fixed shapes of well-known keys and (2) a key, token, password or secret NAME followed
// by a long quoted or plain value. Words such as "secret" in plain text are fine; a value after them is not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, lstatSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;

const KNOWN_SHAPES = [
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['OpenAI or similar sk- key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Private key block', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['Web token (JWT)', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/],
];
// A name that says "key", "token", "password" or "secret", then = or :, then a value of 12 or more characters with no spaces.
const NAMED_VALUE = /\b[\w.-]*(?:api[_-]?key|apikey|secret|token|passwd|password|access[_-]?key|private[_-]?key)[\w.-]*["']?\s*[:=]\s*["']?([A-Za-z0-9+/_=.-]{12,})["']?/i;
// Values that are plainly not secrets: code that reads a value, or a placeholder word.
const HARMLESS_VALUE = /^(?:process\.env|import\.meta|[A-Za-z_.]+\(|[A-Za-z_]+(?:\.[A-Za-z_]+)+$|your[_-]|example|placeholder|changeme|xxxx)/i;

export function findSecrets(text) {
  const found = [];
  text.split('\n').forEach((line, i) => {
    for (const [name, re] of KNOWN_SHAPES) if (re.test(line)) found.push({ line: i + 1, kind: name });
    const m = NAMED_VALUE.exec(line);
    // A real secret value holds at least one digit; a plain word or a file name does not.
    if (m && /\d/.test(m[1]) && !HARMLESS_VALUE.test(m[1])) found.push({ line: i + 1, kind: `a name with a value (${m[0].slice(0, 12)}...)` });
  });
  return found;
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = join(dir, name);
    const info = lstatSync(full);
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
const isText = (buf) => !buf.subarray(0, 4000).includes(0);

function scanDirectory(dir) {
  const hits = [];
  let scanned = 0;
  for (const file of listFiles(dir)) {
    const buf = readFileSync(file);
    if (!isText(buf)) continue;
    scanned += 1;
    for (const f of findSecrets(buf.toString('utf8'))) hits.push(`${relative(dir, file)}:${f.line} ${f.kind}`);
  }
  return { hits, scanned };
}

test('Intake 11.7: no file in the project holds an API key, token, password or secret', () => {
  const { hits, scanned } = scanDirectory(ROOT);
  console.log(`Secrets search: ${scanned} text files read (everything except .git), ${hits.length} findings`);
  assert.ok(scanned > 100, 'the search really read the project files');
  assert.deepEqual(hits, []);
});

test('Intake 11.7: the search also reads the .kiro folder and the README, so a key there would be found', () => {
  const files = listFiles(ROOT).map((f) => relative(ROOT, f));
  assert.ok(files.some((f) => f.startsWith('.kiro/')), 'the .kiro folder is searched');
  assert.ok(files.includes('README.md'));
  assert.ok(files.some((f) => f.startsWith('docs/vendor/')), 'the vendor folder is searched');
});

test('Intake 11.7: the search fails on a planted fake key, token, password and secret in a copy (and not on the real files)', () => {
  const copy = mkdtempSync(join(tmpdir(), 'secret-search-'));
  try {
    copyFileSync(join(ROOT, 'README.md'), join(copy, 'README.md'));
    assert.deepEqual(scanDirectory(copy).hits, [], 'the clean copy passes');
    const planted = [
      ['AWS access key', 'const id = "AKIA' + 'ABCDEFGHIJKLMNOP";'],
      ['GitHub token', 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
      ['OpenAI or similar sk- key', 'key is sk-' + 'FAKEFAKEFAKEFAKEFAKE12345'],
      ['a name with a value', 'const api' + 'Key = "FAKE0123456789abcdef";'],
      ['a name with a value', 'PASS' + 'WORD: hunter2hunter2hunter2'],
      ['a name with a value', 'client_sec' + 'ret = "notarealsecretvalue99"'],
      ['Private key block', '-----BEGIN PRIVATE' + ' KEY-----'],
    ];
    for (const [kind, line] of planted) {
      writeFileSync(join(copy, 'planted.js'), `// fake, planted by the test\n${line}\n`);
      const { hits } = scanDirectory(copy);
      assert.equal(hits.length, 1, `the planted line was found: ${kind}`);
      assert.match(hits[0], new RegExp(`planted\\.js:2 ${kind.replace(/[()]/g, '\\$&')}`));
    }
    // Ordinary sentences that use the words are not findings.
    writeFileSync(join(copy, 'planted.js'), 'Any key stays server-side. No secrets, API keys, or personal data in any file.\nconst token = TOKEN.exec(text);\n');
    assert.deepEqual(scanDirectory(copy).hits, []);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
