// Flaky-test fix (2026-11-25). Several tests run export-sample-run.js while other test files read
// docs/sample-run.json at the same time. Writing a file in place empties it first, so a reader could see half a
// file. The script now leaves the file alone when nothing changed, and swaps in a finished copy when it did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const file = new URL('../docs/sample-run.json', import.meta.url);

test('flaky fix: running the sample export when nothing changed does not touch docs/sample-run.json', () => {
  const before = statSync(file);
  const text = readFileSync(file, 'utf8');
  execFileSync(process.execPath, ['src/viewer/export-sample-run.js'], { cwd: root, stdio: 'pipe' });
  const after = statSync(file);
  assert.equal(after.ino, before.ino, 'same file, not replaced');
  assert.equal(after.mtimeMs, before.mtimeMs, 'not rewritten');
  assert.equal(readFileSync(file, 'utf8'), text);
});

test('flaky fix: the export script writes through a finished copy that is renamed, never in place', () => {
  const code = readFileSync(new URL('../src/viewer/export-sample-run.js', import.meta.url), 'utf8');
  assert.match(code, /renameSync\(copy, SAMPLE_RUN_FILE\)/);
  assert.doesNotMatch(code, /writeFileSync\(SAMPLE_RUN_FILE/);
});

test('flaky fix: no leftover copy is left in docs/', () => {
  assert.deepEqual(readdirSync(new URL('../docs/', import.meta.url)).filter((n) => n.endsWith('.tmp')), []);
});
