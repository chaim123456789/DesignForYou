// Place-items Task 1: the safety net for the sample.
// It saves what must not change while furniture, doors and windows are added:
// the sample's clash report, run log, versions, labels and final items, and a
// check that docs/sample-run.json equals a fresh export.
// The saved values were taken from the code before any place-items change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runSample } from '../src/sample/run-sample.js';
import { makeSampleRun } from '../src/viewer/make-sample-run.js';
import { getLabels } from '../src/label.js';

const SAVED_CLASH_REPORT = {
  summary: '2 clashes found',
  clashes: [
    {
      number: 1,
      type: 'Door or window on furniture',
      items: ['item-6', 'item-5'],
      room: 'floor-1-room-2',
      description: 'In the Living Room, the Garden door sits where the Sofa is placed.',
      severity: 'High',
    },
    {
      number: 2,
      type: 'Room override against Locked item',
      items: ['item-2'],
      room: 'floor-2-room-1',
      description:
        'In the Bedroom, the room style "cold steel" conflicts with the Locked item "Oak bed frame stays as it is" (warm oak).',
      severity: 'Medium',
    },
  ],
  labels: ['SAMPLE PROJECT', 'Plans are drafts for professional review. They are not verified engineering.'],
};

const SAVED_RUN_LOG = [
  { agent: 'Style', event: 'started' },
  { agent: 'Style', event: 'refused', item: 'item-1', reason: 'Item "item-1" is Locked and cannot be changed.' },
  { agent: 'Style', event: 'finished' },
  { agent: 'Layout', event: 'started' },
  { agent: 'Layout', event: 'finished' },
  { agent: 'Builder', event: 'started' },
  { agent: 'Builder', event: 'finished' },
  { agent: 'Reviewer', event: 'started' },
  { agent: 'Reviewer', event: 'finished' },
];

// Who changed which item, in order. The full old and new values are covered by the digest below.
const SAVED_VERSION_SHAPE = [
  [1, 'Style', 'item-3', 'value'],
  [2, 'Style', 'item-4', 'value'],
  [3, 'Layout', 'item-5', 'value'],
  [4, 'Builder', 'item-6', 'value'],
  [5, 'Builder', 'item-7', 'value'],
  [6, 'Builder', 'item-8', 'value'],
  [7, 'Reviewer', 'item-9', 'value'],
];

// SHA-256 of the JSON text of the versions (without their times) and of the final items.
const SAVED_VERSIONS_DIGEST = 'a6db8e3965ea93d641880b4b3941ae6fb66ebcfc9d94c2eba5bc529169230591';
const SAVED_ITEMS_DIGEST = '56333a5a5f8180d25af069cbd17146949bbf2a8d6835aa623324ed9b7502c111';

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function withoutTimes(versions) {
  return versions.map(({ time, ...rest }) => rest);
}

test('place-items Task 1: the sample clash report is exactly the saved one', () => {
  const { project } = runSample();
  const clashItem = project.items.find((i) => i.kind === 'clash');
  assert.deepEqual(clashItem.value, SAVED_CLASH_REPORT);
});

test('place-items Task 1: the sample run log is exactly the saved one', () => {
  const { project } = runSample();
  assert.deepEqual(project.runLog, SAVED_RUN_LOG);
});

test('place-items Task 1: the sample versions and final items are exactly the saved ones', () => {
  const { project } = runSample();
  assert.deepEqual(
    project.versions.map((v) => [v.number, v.who, v.item, v.field]),
    SAVED_VERSION_SHAPE
  );
  assert.equal(digest(withoutTimes(project.versions)), SAVED_VERSIONS_DIGEST);
  assert.equal(digest(project.items), SAVED_ITEMS_DIGEST);
});

test('place-items Task 1: the sample labels are exactly the saved ones', () => {
  const { project } = runSample();
  assert.deepEqual(getLabels(project), SAVED_CLASH_REPORT.labels);
});

test('place-items Task 1: docs/sample-run.json equals a fresh export', () => {
  const { project } = runSample();
  const fresh = JSON.stringify(makeSampleRun(project), null, 2) + '\n';
  const onDisk = readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8');
  assert.equal(onDisk, fresh);
});
