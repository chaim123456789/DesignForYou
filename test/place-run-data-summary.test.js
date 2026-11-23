// Place-items Task 6: type and turn reach the run data and the summary; the sample is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { makeRunData } from '../src/viewer/make-run-data.js';
import { readViewerLayout, makeSampleRun } from '../src/viewer/make-sample-run.js';
import { makeSummaryHtml } from '../src/summary/make-summary.js';
import { runSample } from '../src/sample/run-sample.js';
import { createState, setProjectName, addFloor, addRoom, addPlaced } from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';

function placedRun() {
  const s = createState();
  setProjectName(s, 'Place test');
  const floor = addFloor(s, 'Ground').id;
  const room = addRoom(s, floor, 'Den', 5, 4).id;
  const sofa = addPlaced(s, { type: 'sofa', name: 'Big sofa', room, status: 'Locked', x: 100, y: 200, width: 200, depth: 90 }).id;
  addPlaced(s, { type: 'door', name: 'Den door', room, status: 'Unsure', x: 0, y: 0, width: 90, depth: 10 });
  s.placed.find((o) => o.id === sofa).turn = 90;
  const result = runDesignTeam(s);
  assert.equal(result.ok, true);
  const layout = { ...readViewerLayout(), rooms: { Den: { width: 5, depth: 4 } } };
  return { project: result.project, layout };
}

test('place-items Task 6: type and turn reach the run data for placed furniture', () => {
  const { project, layout } = placedRun();
  const data = makeRunData(project, layout);
  const last = data.snapshots[data.snapshots.length - 1].items;
  const sofa = last.find((i) => i.name === 'Big sofa');
  assert.equal(sofa.type, 'sofa');
  assert.equal(sofa.turn, 90);
  assert.deepEqual(sofa.position, { x: 1, y: 2, width: 2, depth: 0.9 });
});

test('place-items Task 6: a placed door has no type and no turn in the run data', () => {
  const { project, layout } = placedRun();
  const data = makeRunData(project, layout);
  const door = data.snapshots[data.snapshots.length - 1].items.find((i) => i.name === 'Den door');
  assert.equal('type' in door, false);
  assert.equal('turn' in door, false);
});

test('place-items Task 6: no sample snapshot item has a type or a turn', () => {
  const data = makeSampleRun(runSample().project);
  for (const snap of data.snapshots) {
    for (const item of snap.items) {
      assert.equal('type' in item, false, `${item.name} has a type`);
      assert.equal('turn' in item, false, `${item.name} has a turn`);
    }
  }
});

test('place-items Task 6: the summary words for a typed, turned piece are exact', () => {
  const { project } = placedRun();
  const html = makeSummaryHtml(project);
  assert.ok(
    html.includes('Big sofa (sofa, turned 90 degrees; 1.0 m from the left, 2.0 m from the top, 2.0 m wide, 0.9 m deep)'),
    'the sofa row says its type and turn in plain words',
  );
  assert.ok(html.includes('Den door (0.0 m from the left, 0.0 m from the top, 0.9 m wide, 0.1 m deep'), 'a door row has no type words');
});

test('place-items Task 6: the item name before the brackets stays the plain name in sentences', () => {
  const { project } = placedRun();
  const html = makeSummaryHtml(project);
  assert.equal(html.includes('sofa, turned 90 degrees, '), false);
  assert.equal(/&quot;item-\d+&quot;/.test(html) || /"item-\d+"/.test(html), false, 'no quoted item ids');
});

test('place-items Task 6: the sample summary has no type or turn words', () => {
  const html = makeSummaryHtml(runSample().project);
  assert.equal(html.includes('turned'), false);
});

test('place-items Task 6: npm run export-viewer leaves docs/sample-run.json identical', () => {
  const before = readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8');
  execFileSync(process.execPath, ['src/viewer/export-sample-run.js'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  const after = readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8');
  assert.equal(after, before);
});
