// Place-items Task 8: the viewer draws each part of a shaped object.
//
// These tests run the REAL docs/viewer.js on the stand-in page (test-helpers/), with the real
// scene-data.js and the real Three.js maths. The stand-in draws nothing, so the tests look at the
// meshes the page script handed to Three.js. What this CANNOT show: how the shapes look.
// How it looks: Unverified: pending owner check on a real screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc, themeHex } from '../test-helpers/fake-page.js';
import { buildScene, shapeParts } from '../docs/scene-data.js';
import { createState, setProjectName, addFloor, addRoom, addPlaced } from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { buildOwnRunData } from '../docs/intake/run-data.js';

installImportHooks();

let caseNumber = 40000;
// D6: measured on the viewer with the design-team sample (old value 26 for the four-agent sample): slabs, room outlines, blocks,
// the parts of the typed furniture, the small marks, edges and clash outlines.
// Look-and-feel L6: 65 objects in the group at the start (it was 118). The Lighting and Decor layers are off, so the lights, switches, sockets and
// the rug are not drawn, and a Locked item has an extra edge line. The count with every layer on is checked in look-3d.test.js.
const SAMPLE_MESH_COUNT = 65;

function ownRun(placeThem) {
  const s = createState();
  setProjectName(s, 'Shapes');
  const floor = addFloor(s, 'Ground').id;
  const room = addRoom(s, floor, 'Den', 5, 4).id;
  placeThem(s, room);
  const result = runDesignTeam(s);
  assert.equal(result.ok, true);
  return buildOwnRunData(result.project, s);
}

async function withPage(body) {
  const page = createFakePage();
  const restore = installFakePage(page);
  caseNumber += 1;
  try {
    await import(`../docs/viewer.js?case=${caseNumber}`);
    await waitFor(() => page.el('script-status').textContent.includes('finished') || page.problemLines().length > 0, 'the page script to finish');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await body(page, globalThis.designForYouViewer);
  } finally { delete globalThis.designForYouViewer; restore(); }
}

const group = (page) => {
  const groups = page.scene.children.filter((c) => c.type === 'Group');
  assert.equal(groups.length, 1, 'exactly one group of blocks in the scene');
  return groups[0];
};
const meshesOf = (page, itemId) => group(page).children.filter((o) => o.isMesh && o.userData && o.userData.itemId === itemId);
const outlines = (page) => group(page).children.filter((o) => o.material && o.material.side === 1 && o.material.color.getHex() === themeHex('--three-clash'));

function pixelOf(page, point) {
  const camera = page.controls.object;
  camera.updateMatrixWorld();
  const v = point.clone().project(camera);
  return { clientX: (v.x * 0.5 + 0.5) * 900, clientY: (-v.y * 0.5 + 0.5) * 600 };
}
function click(page, at) {
  page.canvas.dispatch('pointerdown', { ...at, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
  page.canvas.dispatch('pointerup', { ...at, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
}

test('place-items Task 8: a typed sofa is drawn as 4 meshes, all with the same item id and box key', async () => {
  const run = ownRun((s, room) => addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Locked', x: 100, y: 100, width: 200, depth: 90 }));
  const sofa = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Couch');
  await withPage(async (page, viewer) => {
    assert.equal(await viewer.showRunData(run, { kind: 'own' }), true);
    assert.deepEqual(page.problemLines(), []);
    const meshes = meshesOf(page, sofa.itemId);
    assert.equal(meshes.length, 4);
    assert.deepEqual(meshes.map((m) => m.userData.part).sort(), ['arm', 'arm', 'back', 'seat']);
    assert.deepEqual([...new Set(meshes.map((m) => m.userData.boxKey))], [sofa.key]);
    // Look-and-feel L6: the colour of every part is the colour of the agent that owns the item (the old status colours are gone), and a
    // Locked item has a bright edge line on every part (one line object per part).
    const colours = [...new Set(meshes.map((m) => m.material.color.getHex()))];
    assert.equal(colours.length, 1, 'one colour on every part');
    const edges = group(page).children.filter((o) => o.isLineSegments && o.material.color.getHex() === themeHex('--three-locked-edge'));
    assert.equal(edges.length, 4, 'a bright edge on each of the four parts of a Locked sofa');
    // Rounded: the seat, back and arms are not plain boxes.
    for (const m of meshes) assert.notEqual(m.geometry.type, 'BoxGeometry', `${m.userData.part} is rounded`);
  });
});

// Look-and-feel L6: a table is round (a round top on one pedestal, 2 meshes instead of a box top and 4 legs), and an Unsure item has no edge line.
test('place-items Task 8: an Unsure table is a round top on one pedestal, in one colour, with no Locked edge', async () => {
  const run = ownRun((s, room) => addPlaced(s, { type: 'table', name: 'Dining', room, status: 'Unsure', x: 100, y: 100, width: 140, depth: 80 }));
  const table = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Dining');
  await withPage(async (page, viewer) => {
    await viewer.showRunData(run, { kind: 'own' });
    const meshes = meshesOf(page, table.itemId);
    assert.equal(meshes.length, 2);
    assert.deepEqual(meshes.map((m) => m.userData.part).sort(), ['pedestal', 'top']);
    assert.equal(meshes.find((m) => m.userData.part === 'top').geometry.type, 'CylinderGeometry', 'the top is round');
    assert.equal(new Set(meshes.map((m) => m.material.color.getHex())).size, 1);
    assert.equal(group(page).children.filter((o) => o.isLineSegments && o.material.color.getHex() === themeHex('--three-locked-edge')).length, 0, 'Unsure has no Locked edge');
  });
});

test('place-items Task 8: a door and a window are drawn with their frame parts, the glass see-through', async () => {
  const run = ownRun((s, room) => {
    addPlaced(s, { type: 'door', name: 'Den door', room, status: 'Locked', x: 0, y: 0, width: 90, depth: 10 });
    addPlaced(s, { type: 'window', name: 'Den window', room, status: 'Unsure', x: 150, y: 390, width: 120, depth: 10 });
  });
  const boxes = buildScene(run, run.snapshots.length - 1);
  const door = boxes.find((b) => b.label === 'Den door');
  const win = boxes.find((b) => b.label === 'Den window');
  await withPage(async (page, viewer) => {
    await viewer.showRunData(run, { kind: 'own' });
    assert.deepEqual(page.problemLines(), []);
    assert.equal(meshesOf(page, door.itemId).length, shapeParts(door).length);
    assert.equal(meshesOf(page, win.itemId).length, shapeParts(win).length);
    const glass = meshesOf(page, win.itemId).filter((m) => m.userData.part === 'glass');
    assert.equal(glass.length, 1);
    assert.equal(glass[0].material.transparent, true);
    assert.ok(glass[0].material.opacity < 1);
    assert.equal(meshesOf(page, door.itemId).some((m) => m.material.transparent), false);
  });
});

test('place-items Task 8: the bath\'s inner part is a lighter shade than its walls', async () => {
  const run = ownRun((s, room) => addPlaced(s, { type: 'bath', name: 'Tub', room, status: 'Locked', x: 100, y: 100, width: 170, depth: 75 }));
  const tub = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Tub');
  await withPage(async (page, viewer) => {
    await viewer.showRunData(run, { kind: 'own' });
    const meshes = meshesOf(page, tub.itemId);
    const inner = meshes.find((m) => m.userData.part === 'inner');
    const outer = meshes.find((m) => m.userData.part === 'outer');
    const lum = (c) => c.r + c.g + c.b;
    assert.ok(lum(inner.material.color) > lum(outer.material.color));
  });
});

test('place-items Task 8: clicking a part opens that object\'s panel', async () => {
  const run = ownRun((s, room) => {
    addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Locked', x: 100, y: 100, width: 200, depth: 90 });
    addPlaced(s, { type: 'table', name: 'Dining', room, status: 'Unsure', x: 100, y: 250, width: 140, depth: 80 });
  });
  await withPage(async (page, viewer) => {
    await viewer.showRunData(run, { kind: 'own' });
    const sofa = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Couch');
    const arm = shapeParts(sofa).find((p) => p.role === 'arm');
    const THREE = await import('three');
    const centre = new THREE.Vector3(arm.x + arm.width / 2, arm.y + arm.height / 2, arm.z + arm.depth / 2);
    click(page, pixelOf(page, centre));
    assert.match(page.el('details-text').textContent, /Couch/);
    const top = shapeParts(buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Dining')).find((p) => p.role === 'top');
    click(page, pixelOf(page, new THREE.Vector3(top.x + top.width / 2, top.y + top.height / 2, top.z + top.depth / 2)));
    assert.match(page.el('details-text').textContent, /Dining/);
  });
});

test('place-items Task 8: the clash outline is drawn once per clashing object, not once per part', async () => {
  const run = ownRun((s, room) => {
    addPlaced(s, { type: 'sofa', name: 'Couch A', room, status: 'Unsure', x: 100, y: 100, width: 200, depth: 90 });
    addPlaced(s, { type: 'sofa', name: 'Couch B', room, status: 'Unsure', x: 150, y: 130, width: 200, depth: 90 });
  });
  const boxes = buildScene(run, run.snapshots.length - 1);
  assert.equal(boxes.filter((b) => b.clash).length, 2, 'both sofas are in the clash');
  await withPage(async (page, viewer) => {
    await viewer.showRunData(run, { kind: 'own' });
    assert.equal(outlines(page).length, 2);
    // The outline has the overall size of the object, including its tallest part.
    const a = boxes.find((b) => b.label === 'Couch A');
    const o = outlines(page).find((m) => Math.abs(m.position.x - (a.x + a.width / 2)) < 1e-6);
    assert.ok(o, 'an outline is centred on Couch A');
    assert.ok(o.geometry.parameters.height > shapeParts(a).reduce((h, p) => Math.max(h, p.height), 0));
  });
});

test('place-items Task 8: a sofa turned 90 degrees has its back mesh on the right edge of its footprint', async () => {
  const run = ownRun((s, room) => {
    const id = addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Locked', x: 100, y: 100, width: 90, depth: 200 }).id;
    s.placed.find((o) => o.id === id).turn = 90;
  });
  const sofa = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Couch');
  assert.equal(sofa.turn, 90);
  await withPage(async (page, viewer) => {
    await viewer.showRunData(run, { kind: 'own' });
    assert.deepEqual(page.problemLines(), []);
    const back = meshesOf(page, sofa.itemId).find((m) => m.userData.part === 'back');
    const right = sofa.x + sofa.width;
    back.geometry.computeBoundingBox();
    const width = back.geometry.boundingBox.max.x - back.geometry.boundingBox.min.x;
    assert.ok(Math.abs(back.position.x + width / 2 - right) < 1e-6);
  });
});

test('place-items Task 8: the sample draws the same plain blocks as before, with the default layers (same count every time)', async () => {
  await withPage(async (page) => {
    assert.deepEqual(page.problemLines(), []);
    const children = group(page).children;
    const itemMeshes = children.filter((o) => o.isMesh && o.userData && o.userData.itemId !== undefined);
    assert.equal(children.length, SAMPLE_MESH_COUNT);
    // D6: only the sample's typed furniture is drawn in parts; doors, windows, style patches and the small marks are plain blocks.
    for (const m of itemMeshes) if (m.userData.part !== undefined) assert.equal(m.userData.type, 'furniture', 'only furniture has parts in the sample');
  });
});

test('place-items Task 8: the viewer file loads shapeParts and still has no inline script or outside address', () => {
  const js = readDoc('viewer.js');
  assert.match(js, /shapeParts/);
  assert.equal(/https?:\/\//.test(js), false);
});
