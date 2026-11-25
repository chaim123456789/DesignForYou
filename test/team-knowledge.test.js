// design-team Group A, Task A3: knowledge file format, loader, provenance checks, copy to the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKnowledge, loadAllowedLicences, validateKnowledge, MAX_TEXT_LENGTH } from '../src/knowledge/load.js';
import { listKnowledgeFiles, copyKnowledge, copyEngine, listEngineFiles, KNOWLEDGE_DIR } from '../src/viewer/engine-files.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = path.join(root, 'src');
const knowledgeSrc = path.join(srcDir, 'knowledge');
const licences = loadAllowedLicences();
const good = () => JSON.parse(readFileSync(path.join(knowledgeSrc, 'shared', 'room-types.json'), 'utf8'));
const check = (data) => validateKnowledge(data, licences, 'test-file.json');

test('design-team A3: the example file (room types) loads and returns its rules', () => {
  const k = loadKnowledge('shared/room-types.json');
  assert.equal(k.provenance.title, 'Room types');
  assert.equal(k.provenance.writtenBy, 'own words');
  assert.ok(k.rules.length >= 5);
  const bathroom = k.rules.find((r) => r.id === 'room-bathroom');
  assert.deepEqual(bathroom.then, { wet: true });
  assert.equal(k.rules.find((r) => r.id === 'room-bedroom').then.wet, false);
  assert.throws(() => { 'use strict'; k.rules.push({}); });
});

test('design-team A3: loading a file that is missing, or one with no provenance block, gives a clear message', () => {
  assert.throws(() => loadKnowledge('shared/nope.json'), /knowledge file is missing/);
  assert.throws(() => loadKnowledge('allowed-licences.json'), /allowed-licences\.json: it has no provenance block/);
});

test('design-team A3: a file with no provenance block is rejected with its own message', () => {
  const d = good(); delete d.provenance;
  assert.throws(() => check(d), /test-file\.json: it has no provenance block/);
});

test('design-team A3: a file that lists no source is rejected with its own message', () => {
  const d = good(); d.provenance.sources = [];
  assert.throws(() => check(d), /it lists no source/);
  const e = good(); delete e.provenance.sources;
  assert.throws(() => check(e), /it lists no source/);
});

test('design-team A3: a licence outside the allowed list is rejected with its own message', () => {
  for (const bad of ['CC BY-SA 4.0', 'CC BY-NC 4.0', 'All rights reserved', undefined]) {
    const d = good(); d.provenance.sources[0].licence = bad;
    assert.throws(() => check(d), /which is not allowed\. Allowed: Public domain/, String(bad));
  }
});

test('design-team A3: a text field over the limit is rejected with its own message, wherever it is', () => {
  const long = 'x'.repeat(MAX_TEXT_LENGTH + 1);
  const a = good(); a.rules[0].note = `Typical guideline, check local rules. ${long}`;
  assert.throws(() => check(a), /file\.rules\[0\]\.note is \d+ characters long\. The limit is 200/);
  const b = good(); b.provenance.covers = long;
  assert.throws(() => check(b), /file\.provenance\.covers is 201 characters long/);
  const c = good(); c.rules[1].then = { text: long };
  assert.throws(() => check(c), /rules\[1\]\.then\.text/);
  const ok = good(); ok.provenance.covers = 'y'.repeat(MAX_TEXT_LENGTH);
  assert.doesNotThrow(() => check(ok));
});

test('design-team A3: other provenance faults are each named (not own words, no date, bad address, rule without the note)', () => {
  const a = good(); a.provenance.writtenBy = 'copied from a book';
  assert.throws(() => check(a), /writtenBy is "own words"/);
  const b = good(); b.provenance.date = 'yesterday';
  assert.throws(() => check(b), /needs a date written like/);
  const c = good(); c.provenance.sources[0].url = 'not an address';
  assert.throws(() => check(c), /web address written without the http start/);
  const c2 = good(); c2.provenance.sources[0].url = 'gov.uk/page';
  assert.doesNotThrow(() => check(c2));
  const d = good(); d.rules[0].note = 'Always true.';
  assert.throws(() => check(d), /needs a note that starts with "Typical guideline, check local rules\."/);
  const e = good(); e.rules[1].id = e.rules[0].id;
  assert.throws(() => check(e), /is used twice/);
  const f = good(); f.rules = [];
  assert.throws(() => check(f), /needs a list of rules/);
  assert.throws(() => check([]), /must be an object/);
});

test('design-team A3: every knowledge file in src/knowledge/ passes the provenance check (the real scan)', () => {
  const files = listKnowledgeFiles().filter((f) => f !== 'allowed-licences.json');
  assert.ok(files.includes('shared/room-types.json'));
  for (const f of files) assert.doesNotThrow(() => loadKnowledge(f), f);
});

test('design-team A3: the knowledge README states the "own words, open sources only" rule', () => {
  const text = readFileSync(path.join(knowledgeSrc, 'README.md'), 'utf8');
  assert.match(text, /own words/i);
  assert.match(text, /open sources/i);
  assert.match(text, /pending owner check/);
});

test('design-team A3: the allowed licences hold no share-alike or non-commercial licence', () => {
  assert.ok(licences.length >= 3);
  for (const l of licences) assert.doesNotMatch(l, /\bSA\b|\bNC\b|share|non-?commercial/i, l);
});

test('design-team A3: no file under src/knowledge/ contains a full web address', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : [path.join(dir, n)]));
  for (const f of walk(knowledgeSrc)) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /\b[a-z][a-z0-9+.-]*:\/\/|\bwww\./i, `${f} has a full web address`);
  }
});

test('design-team A3: npm run export-engine copies every knowledge file to docs/knowledge/ byte for byte', () => {
  const list = listKnowledgeFiles();
  assert.ok(list.includes('shared/room-types.json') && list.includes('allowed-licences.json'));
  for (const rel of list) {
    const a = readFileSync(path.join(knowledgeSrc, rel));
    const b = readFileSync(path.join(KNOWLEDGE_DIR, rel));
    assert.ok(a.equals(b), `docs/knowledge/${rel} differs from src/knowledge/${rel}. Run: npm run export-engine`);
  }
});

test('design-team A3: docs/knowledge/ holds only the listed knowledge files', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : [path.join(dir, n)]));
  const found = walk(KNOWLEDGE_DIR).map((f) => path.relative(KNOWLEDGE_DIR, f).split(path.sep).join('/')).sort();
  assert.deepEqual(found, [...listKnowledgeFiles()].sort());
});

test('design-team A3: the copy function writes byte-identical files into a fresh folder', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'knowledge-'));
  try {
    for (const rel of copyKnowledge(srcDir, out)) {
      assert.ok(readFileSync(path.join(knowledgeSrc, rel)).equals(readFileSync(path.join(out, rel))));
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('design-team A3: the engine code file list is unchanged (12 files, no knowledge file in it)', () => {
  const files = listEngineFiles();
  assert.equal(files.length, 12);
  assert.ok(!files.some((f) => f.includes('knowledge')));
  assert.equal(typeof copyEngine, 'function');
});
