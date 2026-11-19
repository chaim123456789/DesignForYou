import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSample, loadSampleProject } from '../src/sample/run-sample.js';
import { runPipeline } from '../src/coordinator.js';
import { sampleStyleAgent } from '../src/agents/style/agent.js';
import { layoutAgent } from '../src/agents/layout/agent.js';
import { builderAgent } from '../src/agents/builder/agent.js';
import { createReviewerAgent } from '../src/agents/reviewer/agent.js';
import { getBrainAtVersion, listVersions } from '../src/brain/brain.js';
import { SAMPLE_LABEL, DRAFT_STATEMENT } from '../src/label.js';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const sampleData = JSON.parse(readFileSync(new URL('../src/sample/sample-project.json', import.meta.url), 'utf8'));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

const snapshot = (p) => p.items.map((i) => ({ id: i.id, status: i.status, value: structuredClone(i.value) }));

test('R6.1/R6.4: the sample run log shows Style, Layout, Builder, Reviewer in order', () => {
  const { project, result } = runSample();
  assert.equal(result.ok, true);
  const started = project.runLog.filter((e) => e.event === 'started').map((e) => e.agent);
  assert.deepEqual(started, ['Style', 'Layout', 'Builder', 'Reviewer']);
  const finished = project.runLog.filter((e) => e.event === 'finished').map((e) => e.agent);
  assert.deepEqual(finished, ['Style', 'Layout', 'Builder', 'Reviewer']);
});

test('R5.3: the sample run log has a Style "refused" line for the Locked item', () => {
  const { project } = runSample();
  const refused = project.runLog.filter((e) => e.event === 'refused');
  assert.ok(refused.length >= 1);
  const line = refused.find((e) => e.agent === 'Style');
  assert.ok(line, 'expected a Style refusal');
  const item = project.items.find((i) => i.id === line.item);
  assert.equal(item.status, 'Locked');
  assert.equal(item.kind, 'style');
  assert.match(line.reason, /Locked/);
});

test('R5.5: every item Locked at the start has the same value and is still Locked at the end', () => {
  const start = loadSampleProject();
  const lockedAtStart = snapshot(start).filter((i) => i.status === 'Locked');
  assert.ok(lockedAtStart.length >= 2);
  const { project } = runSample();
  for (const before of lockedAtStart) {
    const after = project.items.find((i) => i.id === before.id);
    assert.equal(after.status, 'Locked');
    assert.deepEqual(after.value, before.value);
  }
  // No accepted change touched a Locked item.
  const lockedIds = new Set(lockedAtStart.map((i) => i.id));
  assert.equal(project.versions.filter((v) => lockedIds.has(v.item)).length, 0);
});

test('R7.7: running the sample twice gives an identical Brain, versions, run log and report', () => {
  const a = runSample().project;
  const b = runSample().project;
  assert.deepEqual(a, b);
  assert.deepEqual(listVersions(a), listVersions(b));
  assert.deepEqual(a.items.find((i) => i.kind === 'clash').value, b.items.find((i) => i.kind === 'clash').value);
  assert.ok(a.versions.length > 0);
});

test('R7.4: the sample gives the same result as a plain Coordinator run with the same agents', () => {
  const viaSample = runSample().project;
  const plain = loadSampleProject();
  let tick = 0;
  runPipeline(plain, {
    agents: {
      Style: sampleStyleAgent,
      Layout: layoutAgent,
      Builder: builderAgent,
      Reviewer: createReviewerAgent({ styleConflicts: sampleData.styleConflicts, isSample: true }),
    },
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  });
  assert.deepEqual(viaSample, plain);
});

test('R7.4: no shortcut around the Coordinator (code search)', () => {
  const files = sourceFiles(srcDir);
  const read = (f) => readFileSync(f, 'utf8');
  const rel = (f) => path.relative(srcDir, f).split(path.sep).join('/');

  // The sample runner goes through runPipeline from the Coordinator.
  const runner = read(path.join(srcDir, 'sample', 'run-sample.js'));
  assert.match(runner, /import \{ runPipeline \} from '\.\.\/coordinator\.js'/);
  assert.match(runner, /runPipeline\(project/);

  // The runner and the Coordinator never write changes themselves: only the
  // gatekeeper accepts changes, and only the Coordinator calls it.
  const changeCallers = files.filter((f) => /\.changeItem\(|\.changeStatus\(/.test(read(f))).map(rel);
  assert.deepEqual(changeCallers, ['coordinator.js']);
  const versionWriters = files.filter((f) => /appendVersion\(/.test(read(f))).map(rel).sort();
  assert.deepEqual(versionWriters, ['brain/brain.js', 'brain/gatekeeper.js']);

  // The Coordinator has no sample-specific branch at all.
  assert.doesNotMatch(read(path.join(srcDir, 'coordinator.js')), /sample/i);

  // Only the label code and the Reviewer's label option look at the sample flag.
  const flagReaders = files.filter((f) => /isSample/.test(read(f)) && !f.includes(`${path.sep}sample${path.sep}`)).map(rel).sort();
  assert.deepEqual(flagReaders, ['agents/reviewer/agent.js', 'label.js']);

  // No file other than the runner runs agents in sample mode.
  const runners = files.filter((f) => /runPipeline\(/.test(read(f))).map(rel).sort();
  assert.deepEqual(runners, ['coordinator.js', 'sample/run-sample.js']);
});

test('R7.5/R9.7: the sample report carries the label and the draft statement', () => {
  const { project } = runSample();
  const { labels } = project.items.find((i) => i.kind === 'clash').value;
  assert.ok(labels.includes(SAMPLE_LABEL));
  assert.ok(labels.includes(DRAFT_STATEMENT));
  assert.equal(project.isSample, true);
});

test('R8.5/R8.6: past versions of the sample can be viewed without changing the Brain', () => {
  const { project } = runSample();
  const before = structuredClone(project);
  const past = getBrainAtVersion(project, 1);
  assert.equal(past.version, 1);
  assert.deepEqual(project, before);
});
