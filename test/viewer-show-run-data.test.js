// Intake Task 11: the viewer's one function "show this run data".
//
// These tests run the REAL docs/viewer.js on the stand-in page (test-helpers/), with the real
// scene-data.js, the real engine copies in docs/engine/ and the real Three.js maths. The stand-in
// draws nothing, so the tests look at the blocks the page script handed to Three.js and at the page text.
// What this CANNOT show: how the 3D view looks with a visitor's project (pending owner check).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { buildScene } from '../docs/scene-data.js';
import * as stateApi from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { makeRunData } from '../docs/engine/viewer/make-run-data.js';

installImportHooks();

const sample = JSON.parse(readDoc('sample-run.json'));
const SAMPLE_LAST = sample.versions.length;
const layoutFile = JSON.parse(readFileSync(new URL('../src/viewer/viewer-layout.json', import.meta.url), 'utf8'));
let caseNumber = 20000;

// A small project of the visitor's own, built and run with the real code. The Bedroom has a room note
// "cold steel" and a Locked item tagged "warm oak", so the Reviewer finds one clash.
function ownRun({ floors = [['Ground floor', ['Kitchen', 'Hall']], ['First floor', ['Bedroom']]], name = 'Test home' } = {}) {
  const state = stateApi.createState();
  stateApi.setProjectName(state, name);
  const rooms = {};
  for (const [floorName, roomNames] of floors) {
    const floor = stateApi.addFloor(state, floorName);
    for (const roomName of roomNames) rooms[roomName] = stateApi.addRoom(state, floor.id, roomName, 5, 3).id;
  }
  stateApi.addNote(state, 'overall', 'linen');
  const first = Object.keys(rooms)[0];
  stateApi.addItem(state, { text: 'Oak floor', room: rooms[first], status: 'Locked', tag: 'warm oak' });
  stateApi.addItem(state, { text: 'Curtains', room: rooms[first], status: 'Unsure', tag: '' });
  if (rooms.Bedroom) {
    stateApi.addNote(state, rooms.Bedroom, 'cold steel');
    stateApi.addItem(state, { text: 'Oak bed frame', room: rooms.Bedroom, status: 'Locked', tag: 'warm oak' });
  }
  const run = runDesignTeam(state);
  assert.equal(run.ok, true);
  const layout = { ...layoutFile, rooms: {} };
  for (const room of stateApi.allRooms(state)) layout.rooms[room.name] = { width: room.width, depth: room.depth };
  return makeRunData(run.project, layout);
}

async function withPage(body, configure = () => {}) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  caseNumber += 1;
  try {
    await import(`../docs/viewer.js?case=${caseNumber}`);
    await waitFor(() => page.el('script-status').textContent.includes('finished') || page.problemLines().length > 0, 'the page script to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await body(page, globalThis.designForYouViewer);
  } finally { delete globalThis.designForYouViewer; restore(); }
}

// What the page script put into the 3D scene: every block with its place, as plain numbers.
function drawing(page) {
  const groups = page.scene.children.filter((c) => c.type === 'Group');
  assert.equal(groups.length, 1, 'exactly one group of blocks in the scene');
  const round = (n) => Math.round(n * 1000) / 1000;
  return groups[0].children
    .filter((o) => o.userData && o.userData.boxKey)
    .map((o) => [o.userData.boxKey, o.userData.itemId ?? null, ...o.position.toArray().map(round)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}
const outlines = (page) => page.scene.children.find((c) => c.type === 'Group').children
  .filter((o) => o.material && o.material.side === 1 && o.material.color.getHex() === 0xcc0000).length;
const expectedKeys = (run, version) => buildScene(run, version).map((b) => b.key).sort();
const keysOf = (page) => drawing(page).map((d) => d[0]).sort();
const floorButtons = (page) => ['floor-all', 'floor-ground', 'floor-upper'].map((id) => page.el(id));

test('Task 11: the viewer offers one function "show this run data", and the sample goes through it with the same drawing as before', async () => {
  const js = readDoc('viewer.js');
  assert.match(js, /async function showRunData\(/);
  assert.equal((js.match(/showRunData\(/g) || []).length >= 3, true);
  await withPage((page, viewer) => {
    assert.equal(typeof viewer.showRunData, 'function');
    assert.equal(typeof viewer.showSample, 'function');
    assert.deepEqual(keysOf(page), expectedKeys(sample, SAMPLE_LAST), 'the sample is drawn from the sample run file');
    assert.equal(outlines(page), buildScene(sample, SAMPLE_LAST).filter((b) => b.itemId !== undefined && b.clash).length);
    assert.equal(page.el('version-number').textContent, `${SAMPLE_LAST} of ${SAMPLE_LAST}`);
    assert.equal(page.el('scene-area').getAttribute('aria-label'), '3D view of the sample home');
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.log.filter((l) => l === 'fetch:sample-run.json').length, 1, 'the sample file is fetched once, as before');
  });
});

test('Task 11: showing a visitor\'s own run data replaces the drawing, the slider, the caption and the clash list, with no network call', async () => {
  const own = ownRun();
  const OWN_LAST = own.versions.length;
  await withPage(async (page, viewer) => {
    const before = drawing(page);
    assert.equal(await viewer.showRunData(own, { kind: 'own' }), true);
    assert.deepEqual(page.problemLines(), []);
    assert.deepEqual(keysOf(page), expectedKeys(own, OWN_LAST), 'the blocks are the visitor\'s');
    assert.notDeepEqual(drawing(page), before);
    const slider = page.el('version-slider');
    assert.equal(slider.max, String(OWN_LAST));
    assert.equal(slider.value, String(OWN_LAST), 'starts at the latest version');
    assert.equal(slider.disabled, false);
    assert.equal(page.el('version-number').textContent, `${OWN_LAST} of ${OWN_LAST}`);
    assert.equal(page.el('caption').textContent, own.versions[OWN_LAST - 1].sentence);
    assert.equal(page.el('clash-list').children.length, 1, 'the one clash of the Bedroom');
    assert.match(page.el('clash-list').textContent, /cold steel/);
    assert.equal(outlines(page), 1);
    assert.equal(page.el('scene-area').getAttribute('aria-label'), '3D view of your project');
    assert.equal(page.log.filter((l) => l.startsWith('fetch:')).length, 1, 'no further network call');
    // The slider still works on the new data.
    slider.value = '0';
    slider.dispatch('input');
    assert.equal(page.el('caption').textContent, 'Before any change');
    assert.deepEqual(keysOf(page), expectedKeys(own, 0));
    assert.equal(outlines(page), 0);
  });
});

test('Task 11: the floor buttons are named after the visitor\'s floors, and a button for a missing floor is hidden', async () => {
  const oneFloor = ownRun({ floors: [['Level one', ['Studio']]] });
  const two = ownRun({ floors: [['Ground floor', ['Kitchen']], ['Loft', ['Bedroom']]] });
  await withPage(async (page, viewer) => {
    assert.deepEqual(floorButtons(page).map((b) => b.textContent), ['Both', 'Ground floor', 'Upper floor']);
    await viewer.showRunData(oneFloor, { kind: 'own' });
    assert.equal(page.el('floor-ground').textContent, 'Level one');
    assert.equal(page.el('floor-ground').hidden, false);
    assert.equal(page.el('floor-upper').hidden, true, 'there is no second floor');
    await viewer.showRunData(two, { kind: 'own' });
    assert.equal(page.el('floor-upper').textContent, 'Loft');
    assert.equal(page.el('floor-upper').hidden, false);
    page.el('floor-upper').dispatch('click');
    assert.equal(page.el('floor-upper').getAttribute('aria-pressed'), 'true');
    assert.ok(keysOf(page).every((k) => !k.includes('Kitchen')), 'only the Loft is drawn');
  });
});

test('Task 11: going from the sample to an own project and back gives the sample\'s drawing again, unchanged', async () => {
  const own = ownRun();
  await withPage(async (page, viewer) => {
    const first = drawing(page);
    const firstOutlines = outlines(page);
    await viewer.showRunData(own, { kind: 'own' });
    page.el('floor-ground').dispatch('click'); // the visitor changed the view of their own project
    assert.equal(await viewer.showSample(), true);
    assert.deepEqual(drawing(page), first, 'the same blocks in the same places as the first time');
    assert.equal(outlines(page), firstOutlines);
    assert.deepEqual(floorButtons(page).map((b) => b.textContent), ['Both', 'Ground floor', 'Upper floor']);
    assert.deepEqual(floorButtons(page).map((b) => b.hidden), [false, false, false]);
    assert.deepEqual(floorButtons(page).map((b) => b.getAttribute('aria-pressed')), ['true', 'false', 'false'], 'back to showing both floors');
    assert.equal(page.el('scene-area').getAttribute('aria-label'), '3D view of the sample home');
    assert.equal(page.el('version-slider').max, String(SAMPLE_LAST));
    assert.equal(page.el('caption').textContent, sample.versions[SAMPLE_LAST - 1].sentence);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('Task 11: showing another run closes an open details panel and attaches no handler twice', async () => {
  const own = ownRun();
  await withPage(async (page, viewer) => {
    const listeners = () => [page.el('version-slider'), ...floorButtons(page), page.el('reset-view'), page.el('show-all-labels')]
      .map((e) => Object.values(e.listeners).reduce((n, l) => n + l.length, 0));
    const before = listeners();
    const canvasBefore = Object.values(page.canvas.listeners).reduce((n, l) => n + l.length, 0);
    page.el('clash-list').children[0].children[0].dispatch('click'); // opens the details of a clash item
    assert.match(page.el('details-text').textContent, /Name:/);
    await viewer.showRunData(own, { kind: 'own' });
    assert.equal(page.el('details-text').textContent, 'Click a block to see its details.');
    await viewer.showSample();
    await viewer.showRunData(own, { kind: 'own' });
    assert.deepEqual(listeners(), before, 'the controls have the same number of handlers');
    assert.equal(Object.values(page.canvas.listeners).reduce((n, l) => n + l.length, 0), canvasBefore);
    assert.equal(page.scene.children.filter((c) => c.type === 'Group').length, 1, 'blocks do not pile up');
  });
});

test('Task 11: run data that is not in the expected shape is refused, the red message says so, and what was shown stays', async () => {
  await withPage(async (page, viewer) => {
    const before = drawing(page);
    assert.equal(await viewer.showRunData({ floors: [], versions: [] }, { kind: 'own' }), false);
    assert.ok(page.problemLines().some((l) => l.includes('not in the expected shape')), page.problemLines().join('|'));
    assert.deepEqual(drawing(page), before);
    assert.equal(page.el('version-number').textContent, `${SAMPLE_LAST} of ${SAMPLE_LAST}`);
  });
});

test('Task 11: without the 3D library the text parts still show the visitor\'s run data', async () => {
  const own = ownRun();
  await withPage(async (page, viewer) => {
    assert.equal(await viewer.showRunData(own, { kind: 'own' }), true);
    assert.equal(page.el('clash-list').children.length, 1);
    assert.equal(page.el('version-number').textContent, `${own.versions.length} of ${own.versions.length}`);
  }, (page) => { page.failThreeImport = true; });
});

test('Task 11: a visitor\'s project shown before the sample file arrives is not replaced by the sample', async () => {
  const own = ownRun();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const page = createFakePage();
  const realFetch = page.fetch;
  page.fetch = async (url) => { await gate; return realFetch(url); };
  const restore = installFakePage(page);
  caseNumber += 1;
  try {
    await import(`../docs/viewer.js?case=${caseNumber}`);
    const viewer = globalThis.designForYouViewer;
    assert.equal(await viewer.showSample(), false, 'the sample is not there yet');
    assert.equal(await viewer.showRunData(own, { kind: 'own' }), true);
    release();
    await waitFor(() => page.log.includes('fetch:sample-run.json') && page.el('script-status').textContent.includes('finished'), 'the sample file to arrive');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(keysOf(page), expectedKeys(own, own.versions.length), 'the visitor\'s project is still shown');
    assert.equal(await viewer.showSample(), true, 'the sample can be shown afterwards');
    assert.deepEqual(keysOf(page), expectedKeys(sample, SAMPLE_LAST));
  } finally { delete globalThis.designForYouViewer; restore(); }
});
