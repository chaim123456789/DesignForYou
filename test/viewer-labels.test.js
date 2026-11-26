// Build-viewer-3, Step 0: block labels are hidden by default. They show only for the block under
// the mouse, the selected block, and blocks in a clash, or for every block when "Show all labels"
// is ticked. Room and floor names always show. Runs the REAL docs/viewer.js on the fake page.
// It cannot show how the labels look or whether they overlap on a real screen (pending owner check).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { buildScene, filterByLayers, DEFAULT_LAYERS } from '../docs/scene-data.js';

installImportHooks();

const run = JSON.parse(readDoc('sample-run.json'));
const LAST = run.versions.length;
const html = readDoc('index.html');
let caseNumber = 5000;

async function withPage(body) {
  const page = createFakePage();
  const restore = installFakePage(page);
  caseNumber += 1;
  try {
    await import(`../docs/viewer.js?case=${caseNumber}`);
    await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the page script to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await body(page);
  } finally { restore(); }
}

const shown = (page) => page.labels().filter((l) => l.style.display !== 'none');
const shownBlockNames = (page) => shown(page).filter((l) => !/room-label|floor-label/.test(l.className)).map((l) => l.textContent).sort();
// D6: the design-team sample's small marks (lights, switches, sockets, rugs) carry no text label (noLabel), so they are not counted.
// look-and-feel: lights and rugs are on layers that start switched off, so the blocks counted are those of the default layers.
const blocks = (version = LAST) => filterByLayers(buildScene(run, version), DEFAULT_LAYERS).filter((b) => b.itemId !== undefined && !b.noLabel);
const clashNames = (version = LAST) => blocks(version).filter((b) => b.clash).map((b) => b.label).sort();

async function pixelOfBlock(page, name) {
  const THREE = await import('three');
  const b = blocks().find((x) => x.label === name);
  const camera = page.controls.object;
  camera.updateMatrixWorld();
  const v = new THREE.Vector3(b.x + b.width / 2, b.y + b.height / 2, b.z + b.depth / 2).project(camera);
  return { clientX: (v.x * 0.5 + 0.5) * 900, clientY: (-v.y * 0.5 + 0.5) * 600 };
}

// A block that is not in a clash and is not hidden behind another one at its centre.
async function aPlainBlock(page) {
  for (const b of blocks().filter((x) => !x.clash && x.type === 'window')) {
    const at = await pixelOfBlock(page, b.label);
    page.canvas.dispatch('pointermove', { ...at, buttons: 0 });
    const hit = shown(page).some((l) => l.textContent === b.label);
    page.canvas.dispatch('pointerleave');
    if (hit) return { name: b.label, at };
  }
  assert.fail('no plain block can be pointed at');
  return undefined;
}

test('build-viewer-3 labels: by default only blocks in a clash have a visible label', async () => {
  await withPage((page) => {
    assert.ok(clashNames().length >= 2, 'the sample must have clash blocks');
    assert.deepEqual(shownBlockNames(page), clashNames());
    assert.ok(page.labels().length > shown(page).length, 'the other labels must exist but be hidden');
    assert.equal(page.el('show-all-labels').checked, false);
  });
});

test('build-viewer-3 labels: room names and floor names stay visible by default', async () => {
  await withPage((page) => {
    const names = shown(page).map((l) => l.textContent);
    for (const room of buildScene(run, LAST).filter((b) => b.type === 'room')) assert.ok(names.includes(room.label), `room ${room.label} hidden`);
    assert.ok(names.includes('Ground floor') && names.includes('Upper floor'));
  });
});

test('build-viewer-3 labels: the block under the mouse shows a label, and loses it when the mouse leaves', async () => {
  await withPage(async (page) => {
    const { name, at } = await aPlainBlock(page);
    assert.ok(!shownBlockNames(page).includes(name));
    page.canvas.dispatch('pointermove', { ...at, buttons: 0 });
    assert.ok(shownBlockNames(page).includes(name), 'hovering must show the label');
    page.canvas.dispatch('pointermove', { clientX: 3, clientY: 3, buttons: 0 });
    assert.ok(!shownBlockNames(page).includes(name), 'moving away must hide it');
    page.canvas.dispatch('pointermove', { ...at, buttons: 0 });
    page.canvas.dispatch('pointerleave');
    assert.ok(!shownBlockNames(page).includes(name), 'leaving the drawing must hide it');
  });
});

test('build-viewer-3 labels: the selected block shows a label until the panel is closed', async () => {
  await withPage(async (page) => {
    const { name, at } = await aPlainBlock(page);
    page.canvas.dispatch('pointerdown', { ...at, button: 0, pointerId: 1 });
    page.canvas.dispatch('pointerup', { ...at, button: 0, pointerId: 1 });
    page.canvas.dispatch('pointerleave'); // the mouse moves away; the selection stays
    assert.ok(shownBlockNames(page).includes(name), 'the selected block must keep its label');
    const away = { clientX: 3, clientY: 3 };
    page.canvas.dispatch('pointerdown', { ...away, button: 0, pointerId: 1 });
    page.canvas.dispatch('pointerup', { ...away, button: 0, pointerId: 1 });
    assert.deepEqual(shownBlockNames(page), clashNames(), 'after deselecting only clash labels remain');
  });
});

test('build-viewer-3 labels: ticking "Show all labels" shows every block label, unticking hides them again', async () => {
  await withPage((page) => {
    const box = page.el('show-all-labels');
    box.checked = true;
    box.dispatch('change');
    assert.deepEqual(shownBlockNames(page), blocks().map((b) => b.label).sort());
    box.checked = false;
    box.dispatch('change');
    assert.deepEqual(shownBlockNames(page), clashNames());
    assert.deepEqual(page.problemLines(), []);
  });
});

test('build-viewer-3 labels: shown labels are still kept apart from each other', async () => {
  await withPage((page) => {
    const box = page.el('show-all-labels');
    box.checked = true;
    box.dispatch('change');
    const rects = shown(page).map((l) => ({ x: parseFloat(l.style.left), bottom: parseFloat(l.style.top), w: l.offsetWidth, h: l.offsetHeight }));
    assert.ok(rects.length > 5);
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]; const b = rects[j];
        const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.bottom - b.bottom) < (a.h + b.h) / 2;
        assert.ok(!overlap, `labels ${i} and ${j} collide`);
      }
    }
  });
});

test('build-viewer-3 labels: the page has the checkbox (unticked) and one short sentence about labels in the legend', () => {
  assert.match(html, /<input type="checkbox" id="show-all-labels">/);
  assert.doesNotMatch(html, /id="show-all-labels"[^>]*checked/);
  const sentence = html.match(/<p id="legend-labels">([^<]+)<\/p>/);
  assert.ok(sentence, 'no label sentence in the legend');
  assert.ok(sentence[1].split(/\s+/).length <= 30, 'the sentence must be short');
  assert.match(sentence[1], /Show all labels/);
});
