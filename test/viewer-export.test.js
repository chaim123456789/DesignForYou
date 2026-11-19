import test from 'node:test';
import assert from 'node:assert/strict';
import { runSample } from '../src/sample/run-sample.js';
import { makeSampleRun } from '../src/viewer/make-sample-run.js';
import { getBrainAtVersion } from '../src/brain/brain.js';

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { buildScene, describeItem } from '../docs/scene-data.js';
import { runPipeline } from '../src/coordinator.js';
import { readSampleData, loadSampleProject } from '../src/sample/run-sample.js';
import { sampleStyleAgent } from '../src/agents/style/agent.js';
import { layoutAgent } from '../src/agents/layout/agent.js';
import { builderAgent } from '../src/agents/builder/agent.js';
import { createReviewerAgent } from '../src/agents/reviewer/agent.js';

test('Task 1: the sample run data has 2 floors, 4 rooms, 7 versions and 8 snapshots (0 to 7)', () => {
  const { project } = runSample();
  const run = makeSampleRun(project);
  assert.equal(run.floors.length, 2);
  assert.equal(run.floors.flatMap((f) => f.rooms).length, 4);
  assert.equal(run.versions.length, 7);
  assert.equal(run.snapshots.length, 8);
  assert.deepEqual(run.snapshots.map((s) => s.version), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('Task 1: every snapshot equals getBrainAtVersion for that version', () => {
  const { project } = runSample();
  const run = makeSampleRun(project);
  for (const snap of run.snapshots) {
    const brain = getBrainAtVersion(project, snap.version);
    assert.equal(snap.items.length, brain.items.length);
    snap.items.forEach((s, i) => {
      const b = brain.items[i];
      assert.equal(s.id, b.id);
      assert.equal(s.kind, b.kind);
      assert.equal(s.status, b.status);
      assert.equal(s.owner, b.owner);
      assert.equal(s.room, b.room);
      assert.deepEqual(s.position, b.value.position);
      if (b.kind === 'clash') assert.deepEqual(s.clashes, b.value.clashes);
      if (b.kind === 'style') assert.equal(s.name, b.value.detail);
      if (b.kind === 'door' || b.kind === 'window' || b.kind === 'layout') assert.equal(s.name, b.value.name);
    });
  }
});

test('Task 1: making the sample run data does not change the Brain', () => {
  const { project } = runSample();
  const before = structuredClone(project);
  makeSampleRun(project);
  assert.deepEqual(project, before);
});

test('Task 1: each version has a plain sentence and none contains an id', () => {
  const { project } = runSample();
  const run = makeSampleRun(project);
  for (const v of run.versions) {
    assert.equal(typeof v.sentence, 'string');
    assert.ok(v.sentence.length > 0);
    assert.ok(!/item-|floor-/.test(v.sentence), `id found in: ${v.sentence}`);
  }
});

// ---- Task 2: the exported file ----
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const exportedPath = fileURLToPath(new URL('../docs/sample-run.json', import.meta.url));
const runExport = () => {
  execFileSync(process.execPath, ['src/viewer/export-sample-run.js'], { cwd: root, stdio: 'pipe' });
  return readFileSync(exportedPath, 'utf8');
};

test('Task 2: two exports give identical text', () => {
  assert.equal(runExport(), runExport());
});

test('Task 2: the exported file parses and matches makeSampleRun(runSample().project)', () => {
  const text = readFileSync(exportedPath, 'utf8');
  assert.deepEqual(JSON.parse(text), makeSampleRun(runSample().project));
});

test('Task 2: the exported file has no email, phone number, street word or web address', () => {
  const text = readFileSync(exportedPath, 'utf8');
  assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.]+/, 'email address');
  assert.doesNotMatch(text, /\+?\d[\d\s().-]{8,}\d/, 'phone number');
  assert.doesNotMatch(text, /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Court|Way)\b/, 'street address');
  assert.doesNotMatch(text, /https?:\/\/|www\./i, 'web link');
});

test('Task 2: sample-project.json is unchanged (git diff is empty)', () => {
  const diff = execFileSync('git', ['diff', '--', 'src/sample/sample-project.json'], { cwd: root, encoding: 'utf8' });
  assert.equal(diff, '');
});

// ---- Step 0 (build-viewer-2): the exported "sample" field is only a label flag ----

test('Step 0: the exported "sample" field is written once and never read, so no code branches on it', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === 'vendor' || name === 'node_modules' || name === '.git') continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(name)) files.push(full);
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'docs'));
  assert.ok(files.length > 10);

  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  // Any way of reading a property or key called "sample": x.sample, x["sample"], or { sample } = x.
  const readPattern = /\.sample\b|\[\s*['"]sample['"]\s*\]|\{[^{}]*\bsample\b[^{}]*\}\s*=[^=]/;
  const readers = files.filter((f) => readPattern.test(strip(readFileSync(f, 'utf8')))).map((f) => path.relative(root, f));
  assert.deepEqual(readers, [], `these files read a "sample" field: ${readers.join(', ')}`);

  // The only place the field is written is make-sample-run.js, and it goes through the label code.
  const writers = files.filter((f) => /\bsample\s*:/.test(strip(readFileSync(f, 'utf8')))).map((f) => path.relative(root, f));
  assert.deepEqual(writers, [path.join('src', 'viewer', 'make-sample-run.js')]);

  // The page's SAMPLE PROJECT label is fixed text in index.html, not drawn from the field.
  assert.doesNotMatch(readFileSync(path.join(root, 'docs', 'viewer.js'), 'utf8'), /SAMPLE PROJECT/);
});

test('Step 0: switching the "sample" field changes nothing in the scene, the details or the versions', () => {
  const { project } = runSample();
  const run = makeSampleRun(project);
  assert.equal(run.sample, true);
  const flipped = { ...run, sample: false };
  const latest = run.versions.length;
  for (let v = 0; v <= latest; v++) {
    assert.deepEqual(buildScene(flipped, v), buildScene(run, v));
    for (const item of run.snapshots[v].items) {
      assert.deepEqual(describeItem(flipped, v, item.id), describeItem(run, v, item.id));
    }
  }
  // The pipeline itself: a run with the flag off makes the same versions and the same run log.
  const data = readSampleData();
  const off = loadSampleProject({ ...data, isSample: false });
  let t = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, t++)).toISOString();
  const offResult = runPipeline(off, {
    agents: { Style: sampleStyleAgent, Layout: layoutAgent, Builder: builderAgent,
      Reviewer: createReviewerAgent({ styleConflicts: data.styleConflicts, isSample: false }) },
    now,
  });
  assert.equal(off.isSample, false);
  const on = runSample();
  assert.deepEqual(off.versions.map(({ number, who, item, field }) => ({ number, who, item, field })),
    on.project.versions.map(({ number, who, item, field }) => ({ number, who, item, field })));
  assert.equal(offResult.ok, on.result.ok);
  assert.deepEqual(off.runLog, on.project.runLog);
});
