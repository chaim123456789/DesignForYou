import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject, createItem, getItem } from '../src/brain/brain.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';
import { runSample } from '../src/sample/run-sample.js';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(js|json|html)$/.test(full) ? [full] : [];
  });
}

const rel = (f) => path.relative(srcDir, f).split(path.sep).join('/');
const twoRoomData = () => ({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });

// R4.1: exactly one Project Brain per project.
test('R4.1: one project is one Brain that holds all its own items, versions and run log', () => {
  const project = createProject(twoRoomData());
  // The Brain parts all live inside the one project object.
  for (const part of ['items', 'itemStarts', 'versions', 'runLog']) {
    assert.ok(part in project, `the project should hold "${part}"`);
  }
  const item = createItem(project, {
    kind: 'layout', owner: 'Layout', value: { name: 'Sofa' }, room: project.floors[0].rooms[0].id,
  });
  assert.equal(project.items.length, 1);
  assert.equal(getItem(project, item.id), project.items[0]);
});

test('R4.1: two projects have two separate Brains that share nothing', () => {
  const a = createProject(twoRoomData());
  const b = createProject(twoRoomData());
  assert.notEqual(a, b);
  for (const part of ['items', 'itemStarts', 'versions', 'runLog', 'floors', 'inspiration']) {
    assert.notEqual(a[part], b[part], `"${part}" must not be shared between projects`);
  }
  const itemA = createItem(a, { kind: 'layout', owner: 'Layout', value: { name: 'Sofa' } });
  createGatekeeper(a).changeItem('Layout', itemA.id, { name: 'Sofa', note: 'checked' });
  assert.equal(a.items.length, 1);
  assert.equal(a.versions.length, 1);
  assert.equal(b.items.length, 0);
  assert.equal(b.versions.length, 0);
  assert.equal(b.runLog.length, 0);
});

test('R4.1: two sample runs give two separate Brains', () => {
  const first = runSample().project;
  const second = runSample().project;
  assert.notEqual(first, second);
  assert.notEqual(first.items, second.items);
  assert.notEqual(first.versions, second.versions);
});

test('R4.1: no source file keeps a second, shared Brain at the top level of a module (code search)', () => {
  const brainFiles = sourceFiles(srcDir).filter((f) => f.endsWith('.js'));
  // A module-level "let", or a module-level array or object that is not frozen, could act as a hidden second Brain.
  const offenders = brainFiles.filter((f) => /^let\s/m.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(offenders, []);
});

// R7.6: Sample mode is the only mode. No network calls, web addresses or environment variables in src/.
test('R7.6: src/ has no network calls (code search)', () => {
  const patterns = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /\bsendBeacon\b/,
    /from\s+['"](?:node:)?(?:http|https|http2|net|tls|dgram|dns|child_process|worker_threads)['"]/,
    /require\(\s*['"](?:node:)?(?:http|https|http2|net|tls|dgram|dns|child_process)['"]\s*\)/,
    /import\(\s*['"]/,
  ];
  const hits = [];
  for (const f of sourceFiles(srcDir)) {
    const text = readFileSync(f, 'utf8');
    for (const p of patterns) if (p.test(text)) hits.push(`${rel(f)}: ${p}`);
  }
  assert.deepEqual(hits, []);
});

test('R7.6: src/ has no web addresses (code search)', () => {
  const hits = sourceFiles(srcDir).filter((f) => /\b[a-z][a-z0-9+.-]*:\/\/|\bwww\./i.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(hits, []);
});

test('R7.6: src/ reads no environment variables (code search)', () => {
  const patterns = [/process\.env/, /import\.meta\.env/, /Deno\.env/, /\bgetenv\b/, /\bprocess\.argv\b/];
  const hits = [];
  for (const f of sourceFiles(srcDir)) {
    const text = readFileSync(f, 'utf8');
    for (const p of patterns) if (p.test(text)) hits.push(`${rel(f)}: ${p}`);
  }
  assert.deepEqual(hits, []);
});

test('R7.6: there is only one way to run, and it is the sample (no mode switch)', () => {
  // The sample runner and the summary writer are the only entry points that run the pipeline.
  const runners = sourceFiles(srcDir)
    .filter((f) => f.endsWith('.js') && /runPipeline\(/.test(readFileSync(f, 'utf8')))
    .map(rel)
    .sort();
  assert.deepEqual(runners, ['coordinator.js', 'sample/run-sample.js']);
  // No file chooses between modes by name.
  const modeSwitches = sourceFiles(srcDir)
    .filter((f) => /\b(live|production)\s*(mode|ai)\b/i.test(readFileSync(f, 'utf8')))
    .map(rel);
  assert.deepEqual(modeSwitches, []);
});
