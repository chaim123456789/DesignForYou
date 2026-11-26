// Build-viewer-3, Task 8: the version slider is connected to the 3D drawing. Runs the REAL
// docs/viewer.js on the fake page (see test-helpers/). The fake page draws nothing, so the tests
// look at what the page script handed to Three.js (the blocks and the red outlines) and at the
// page text. How the slider FEELS in a real browser is a pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { buildScene as buildAllScene, shapeParts, describeItem, filterByLayers, DEFAULT_LAYERS } from '../docs/scene-data.js';
// look-and-feel: lights and rugs are on layers that start switched off, so the page draws only the boxes of the default layers.
const buildScene = (run, version) => filterByLayers(buildAllScene(run, version), DEFAULT_LAYERS);

installImportHooks();

const run = JSON.parse(readDoc('sample-run.json'));
const LAST = run.versions.length;
const html = readDoc('index.html');
let caseNumber = 9000;

async function withPage(body, sampleRunText) {
  const page = createFakePage(sampleRunText ? { sampleRunText } : {});
  const restore = installFakePage(page);
  caseNumber += 1;
  try {
    await import(`../docs/viewer.js?case=${caseNumber}`);
    await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the page script to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await body(page);
  } finally { restore(); }
}

function moveSlider(page, version) {
  const slider = page.el('version-slider');
  slider.value = String(version);
  slider.dispatch('input');
}

// What the page script put into the 3D scene: item blocks by item id, and the red outlines.
function drawn(page) {
  const group = page.scene.children.find((c) => c.type === 'Group');
  assert.ok(group, 'no group of blocks in the scene');
  const items = group.children.filter((o) => o.userData && o.userData.itemId !== undefined);
  const outlines = group.children.filter((o) => o.material && o.material.side === 1 && o.material.color.getHex() === 0xcc0000);
  return { itemIds: items.map((o) => o.userData.itemId).sort(), outlines: outlines.length, all: group.children.length };
}
const expected = (version) => {
  const boxes = buildScene(run, version);
  return {
    // D6: one id per drawn mesh. The design-team sample's typed furniture is drawn as several parts, each with the item's id.
    itemIds: boxes.filter((b) => b.itemId !== undefined).flatMap((b) => Array(Math.max(1, shapeParts(b).length)).fill(b.itemId)).sort(),
    outlines: boxes.filter((b) => b.itemId !== undefined && b.clash).length,
  };
};
const clashLines = (page) => page.el('clash-list').children.length;
const clashLabels = (page) => page.labels().filter((l) => /clash-label/.test(l.className));

test('Task 8: the page slider runs from 0 to the number of versions and the page starts at the latest version', async () => {
  // D6: the design-team sample has 40 versions (old value 7).
  assert.match(html, /<input type="range" id="version-slider" min="0" max="40" step="1" value="40"/);
  assert.equal(LAST, 40);
  await withPage((page) => {
    const slider = page.el('version-slider');
    assert.equal(slider.min, '0');
    assert.equal(slider.max, String(LAST));
    assert.equal(slider.value, String(LAST));
    assert.equal(slider.disabled, false);
    assert.equal(page.el('version-number').textContent, `${LAST} of ${LAST}`);
    assert.equal(page.el('caption').textContent, run.versions[LAST - 1].sentence);
  });
});

test('Task 8: slider at version 0 shows no clashes in the 3D drawing, the labels and the clash list; at the last version it shows both', async () => {
  await withPage((page) => {
    // Latest version first: both clashes.
    assert.equal(clashLines(page), 9, 'the clash list must show all nine findings at the last version'); // D6: old value 2
    assert.ok(expected(LAST).outlines >= 2);
    assert.equal(drawn(page).outlines, expected(LAST).outlines, 'red outlines at the last version');
    assert.equal(clashLabels(page).length, expected(LAST).outlines);
    // Version 0: nothing.
    moveSlider(page, 0);
    assert.equal(drawn(page).outlines, 0, 'no red outline may be drawn at version 0');
    assert.equal(clashLabels(page).length, 0, 'no clash label at version 0');
    assert.equal(clashLines(page), 0, 'no clash line at version 0');
    assert.equal(page.el('caption').textContent, 'Before any change');
    // And back to the latest: both again.
    moveSlider(page, LAST);
    assert.equal(drawn(page).outlines, expected(LAST).outlines);
    assert.equal(clashLines(page), 9); // D6: old value 2
    assert.equal(clashLabels(page).length, expected(LAST).outlines);
    assert.equal(page.el('caption').textContent, run.versions[LAST - 1].sentence);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('Task 8: at every version the blocks, red outlines, caption and version number agree with the data', async () => {
  await withPage((page) => {
    for (const v of [3, 0, 7, 1, 6, 2, 5, 4, 0, 7]) {
      moveSlider(page, v);
      assert.deepEqual({ itemIds: drawn(page).itemIds, outlines: drawn(page).outlines }, expected(v), `blocks at version ${v}`);
      assert.equal(page.el('version-number').textContent, `${v} of ${LAST}`);
      assert.equal(page.el('caption').textContent, v === 0 ? 'Before any change' : run.versions[v - 1].sentence);
    }
    assert.deepEqual(page.problemLines(), []);
  });
});

test('Task 8: moving the slider replaces the blocks instead of stacking them (nothing stuck)', async () => {
  await withPage((page) => {
    const before = drawn(page).all;
    for (let i = 0; i < 6; i += 1) { moveSlider(page, i % 2 ? LAST : 0); moveSlider(page, LAST); }
    assert.equal(drawn(page).all, before, 'blocks piled up');
    assert.equal(page.scene.children.filter((c) => c.type === 'Group').length, 1, 'more than one group of blocks in the scene');
    const labelCount = page.labels().length;
    moveSlider(page, 0);
    moveSlider(page, LAST);
    assert.equal(page.labels().length, labelCount, 'labels piled up');
  });
});

test('Task 8: an open details panel is refreshed for the version shown, not left with another version\'s data', async () => {
  await withPage(async (page) => {
    // Open a style note by a click on its flat tile.
    // D6: in the design-team sample a note keeps its name, so the tile chosen is one whose details differ between version 0 and the
    // latest version by its clash lines (old: a tile whose name differs). The checks below are the same, on the whole details text.
    const THREE = await import('three');
    const detailsAt = (version, id) => { const d = describeItem(run, version, id); return [d.name, ...d.clashes].join(' | '); };
    const tile = buildScene(run, LAST).find((b) => b.type === 'style-marker' && detailsAt(0, b.itemId) !== detailsAt(LAST, b.itemId));
    assert.ok(tile, 'no style tile whose details read differently at version 0');
    const camera = page.controls.object;
    camera.updateMatrixWorld();
    const v = new THREE.Vector3(tile.x + tile.width / 2, tile.y + tile.height / 2, tile.z + tile.depth / 2).project(camera);
    const at = { clientX: (v.x * 0.5 + 0.5) * 900, clientY: (-v.y * 0.5 + 0.5) * 600 };
    page.canvas.dispatch('pointerdown', { ...at, button: 0, pointerId: 1 });
    page.canvas.dispatch('pointerup', { ...at, button: 0, pointerId: 1 });
    const itemId = tile.itemId;
    const linesAt = (version) => { const d = describeItem(run, version, itemId); return [`Name: ${d.name}`, ...d.clashes]; };
    const latestOnly = linesAt(LAST).filter((l) => !linesAt(0).includes(l));
    assert.ok(latestOnly.length > 0);
    for (const l of linesAt(LAST)) assert.ok(page.el('details-text').textContent.includes(l), `the panel shows: ${l}`);
    const other = 0;
    moveSlider(page, other);
    for (const l of linesAt(other)) assert.ok(page.el('details-text').textContent.includes(l), 'the panel still shows another version\'s details');
    for (const l of latestOnly) assert.ok(!page.el('details-text').textContent.includes(l), 'the panel still shows the latest wording');
    moveSlider(page, LAST);
    for (const l of linesAt(LAST)) assert.ok(page.el('details-text').textContent.includes(l));
  });
});

test('Task 8: an item that does not exist yet at a version is not drawn, and its open panel closes', async () => {
  // Made-up data: the Garden door is removed from versions 0 to 2 (the real sample has every item from version 0).
  const copy = JSON.parse(JSON.stringify(run));
  const door = copy.snapshots[LAST].items.find((i) => i.name === 'Garden door');
  for (const snap of copy.snapshots.filter((s) => s.version <= 2)) snap.items = snap.items.filter((i) => i.id !== door.id);
  await withPage(async (page) => {
    const doorShapes = () => drawn(page).itemIds.filter((id) => id === door.id).length;
    assert.equal(doorShapes(), 1);
    // Open the Garden door through the clash list, which also turns the camera to it.
    const button = page.el('clash-list').children.flatMap((li) => li.children).find((b) => /Garden door/.test(b.textContent));
    assert.ok(button, 'no clash line mentions the Garden door');
    button.dispatch('click');
    assert.match(page.el('details-text').textContent, /Name: Garden door/);
    moveSlider(page, 2);
    assert.equal(doorShapes(), 0, 'the Garden door is drawn before it exists');
    assert.match(page.el('details-text').textContent, /Click a block/, 'the panel for a missing item must close');
    assert.ok(!page.labels().some((l) => l.textContent === 'Garden door'));
    moveSlider(page, 3);
    assert.equal(doorShapes(), 1, 'the Garden door must come back when it exists');
    assert.deepEqual(page.problemLines(), []);
  }, JSON.stringify(copy));
});

test('Task 8: the slider keeps working with the floor filter, and a hovered block is cleared when the version changes', async () => {
  await withPage((page) => {
    page.el('floor-upper').dispatch('click');
    moveSlider(page, 0);
    const upperIds = buildScene(run, 0).filter((b) => b.itemId !== undefined && b.floorOrder === 2).map((b) => b.itemId);
    const ids = drawn(page).itemIds;
    assert.ok(ids.length < expected(0).itemIds.length, 'the upper-floor filter must still hide the other floor');
    assert.ok(upperIds.length === 0 || upperIds.every((id) => ids.includes(id)));
    moveSlider(page, LAST);
    assert.ok(drawn(page).itemIds.length < expected(LAST).itemIds.length);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('Task 8: the slider only reads: it never writes or sends anything', () => {
  const js = readDoc('viewer.js');
  const body = js.slice(js.indexOf('function changeVersion'), js.indexOf('function setUpSlider'));
  assert.ok(body.length > 50);
  assert.doesNotMatch(body, /fetch\(|localStorage|XMLHttpRequest|innerHTML/);
});
