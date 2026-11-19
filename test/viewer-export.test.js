import test from 'node:test';
import assert from 'node:assert/strict';
import { runSample } from '../src/sample/run-sample.js';
import { makeSampleRun } from '../src/viewer/make-sample-run.js';
import { getBrainAtVersion } from '../src/brain/brain.js';

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
