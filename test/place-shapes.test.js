// Place-items Task 7: the 3D shapes as pure data (no Three.js, no drawing).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { shapeParts, shapeHeight, buildScene } from '../docs/scene-data.js';
import { makeRunData } from '../src/viewer/make-run-data.js';
import { readViewerLayout } from '../src/viewer/make-sample-run.js';
import { createState, setProjectName, addFloor, addRoom, addPlaced } from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { buildOwnRunData } from '../docs/intake/run-data.js';

const EPS = 1e-6;
const furnitureBox = (type, extra = {}) => ({
  key: 'item:item-9', itemId: 'item-9', status: 'Unsure', colour: 'unsure', clash: false,
  type: 'furniture', furnitureType: type, x: 10, y: 3, z: 20, width: 2, height: 0.8, depth: 1, turn: 0, ...extra,
});
const roles = (parts) => parts.map((p) => p.role);
const count = (parts, role) => parts.filter((p) => p.role === role).length;

function insideFootprint(box, parts) {
  for (const p of parts) {
    assert.ok(p.x >= box.x - EPS && p.x + p.width <= box.x + box.width + EPS, `${p.key} inside in x`);
    assert.ok(p.z >= box.z - EPS && p.z + p.depth <= box.z + box.depth + EPS, `${p.key} inside in z`);
    assert.ok(p.y >= box.y - EPS, `${p.key} not below the floor`);
    assert.ok(p.width > 0 && p.height > 0 && p.depth > 0, `${p.key} has a size`);
  }
}

test('place-items Task 7: sofa has a seat, a back and two arms', () => {
  const parts = shapeParts(furnitureBox('sofa'));
  assert.deepEqual(roles(parts).sort(), ['arm', 'arm', 'back', 'seat']);
  insideFootprint(furnitureBox('sofa'), parts);
});

test('place-items Task 7: bed has a mattress and a headboard taller than the mattress', () => {
  const parts = shapeParts(furnitureBox('bed'));
  assert.deepEqual(roles(parts).sort(), ['headboard', 'mattress']);
  const head = parts.find((p) => p.role === 'headboard');
  const mat = parts.find((p) => p.role === 'mattress');
  assert.ok(head.height > mat.height);
  assert.ok(head.z <= mat.z, 'the headboard is at the back edge');
  insideFootprint(furnitureBox('bed'), parts);
});

test('place-items Task 7: table has a top and four legs', () => {
  const parts = shapeParts(furnitureBox('table'));
  assert.equal(count(parts, 'top'), 1);
  assert.equal(count(parts, 'leg'), 4);
  assert.equal(parts.length, 5);
  const top = parts.find((p) => p.role === 'top');
  assert.ok(Math.abs(top.y + top.height - (3 + 0.75)) < EPS, 'the top is at 0.75 m');
  insideFootprint(furnitureBox('table'), parts);
});

test('place-items Task 7: wardrobe is one tall box with a thin door line', () => {
  const parts = shapeParts(furnitureBox('wardrobe'));
  assert.deepEqual(roles(parts).sort(), ['body', 'doorline']);
  assert.ok(Math.abs(parts.find((p) => p.role === 'body').height - 2.0) < EPS);
  assert.ok(parts.find((p) => p.role === 'doorline').width <= 0.04 + EPS, 'the line is thin');
  insideFootprint(furnitureBox('wardrobe'), parts);
});

test('place-items Task 7: desk has a thin top and a panel at each end', () => {
  const parts = shapeParts(furnitureBox('desk'));
  assert.equal(count(parts, 'top'), 1);
  assert.equal(count(parts, 'leg'), 2);
  assert.ok(parts.find((p) => p.role === 'top').height <= 0.05);
  const legs = parts.filter((p) => p.role === 'leg').sort((a, b) => a.x - b.x);
  assert.ok(legs[0].x < legs[1].x, 'one panel at each end');
  insideFootprint(furnitureBox('desk'), parts);
});

test('place-items Task 7: bath is a low tub with a lower inner part marked lighter', () => {
  const parts = shapeParts(furnitureBox('bath'));
  assert.equal(count(parts, 'outer'), 4);
  assert.equal(count(parts, 'inner'), 1);
  const inner = parts.find((p) => p.role === 'inner');
  const outerTop = Math.max(...parts.filter((p) => p.role === 'outer').map((p) => p.y + p.height));
  assert.ok(inner.y + inner.height < outerTop, 'the inner part is lower than the rim');
  assert.equal(inner.lighter, true);
  assert.equal(parts.filter((p) => p.lighter).length, 1);
  insideFootprint(furnitureBox('bath'), parts);
});

test('place-items Task 7: kitchen unit has a base cabinet with a thin worktop on top', () => {
  const parts = shapeParts(furnitureBox('kitchen unit'));
  assert.deepEqual(roles(parts).sort(), ['base', 'worktop']);
  const base = parts.find((p) => p.role === 'base');
  const top = parts.find((p) => p.role === 'worktop');
  assert.ok(Math.abs(top.y - (base.y + base.height)) < EPS, 'the worktop sits on the base');
  assert.ok(top.height <= 0.05);
  insideFootprint(furnitureBox('kitchen unit'), parts);
});

const openingBox = (type, wall, extra = {}) => ({
  key: 'item:item-5', itemId: 'item-5', status: 'Locked', colour: 'locked', clash: true,
  type, furnitureType: type, wall, x: 4, y: 0, z: 6, width: 0.9, height: 2.0, depth: 0.1, ...extra,
});

test('place-items Task 7: door has a frame of two sides and a top, and a leaf thinner than the frame', () => {
  const box = openingBox('door', 'front');
  const parts = shapeParts(box);
  assert.equal(count(parts, 'frame'), 3);
  assert.equal(count(parts, 'leaf'), 1);
  assert.equal(parts.length, 4);
  const leaf = parts.find((p) => p.role === 'leaf');
  assert.ok(leaf.depth < 0.1, 'the leaf is thinner than the frame');
  insideFootprint(box, parts);
});

test('place-items Task 7: a door on a side wall is built along z', () => {
  const box = openingBox('door', 'left', { width: 0.1, depth: 0.9 });
  const parts = shapeParts(box);
  assert.equal(parts.length, 4);
  assert.ok(parts.filter((p) => p.role === 'frame').some((p) => p.depth > p.width), 'frame sides run along z');
  assert.ok(parts.find((p) => p.role === 'leaf').width < 0.1);
  insideFootprint(box, parts);
});

test('place-items Task 7: window has a frame and a see-through glass pane thinner than the frame', () => {
  const box = openingBox('window', 'back', { y: 0.9, height: 1.2, width: 1.2 });
  const parts = shapeParts(box);
  assert.ok(count(parts, 'frame') >= 3);
  assert.equal(count(parts, 'glass'), 1);
  const glass = parts.find((p) => p.role === 'glass');
  assert.equal(glass.seeThrough, true);
  assert.ok(glass.depth < 0.1);
  assert.equal(parts.filter((p) => p.seeThrough).length, 1);
  insideFootprint(box, parts);
});

test('place-items Task 7: a turn of 90 moves the back to the right edge, and the other turns follow', () => {
  const backOf = (turn, w, d) => {
    const box = furnitureBox('sofa', { turn, width: w, depth: d });
    const back = shapeParts(box).find((p) => p.role === 'back');
    return { box, back };
  };
  let { box, back } = backOf(0, 2, 1);
  assert.ok(Math.abs(back.z - box.z) < EPS && Math.abs(back.width - 2) < EPS, 'turn 0: back at the top edge');
  ({ box, back } = backOf(90, 1, 2));
  assert.ok(Math.abs(back.x + back.width - (box.x + box.width)) < EPS, 'turn 90: back at the right edge');
  assert.ok(Math.abs(back.depth - 2) < EPS, 'and runs the full length of that edge');
  ({ box, back } = backOf(180, 2, 1));
  assert.ok(Math.abs(back.z + back.depth - (box.z + box.depth)) < EPS, 'turn 180: back at the bottom edge');
  ({ box, back } = backOf(270, 1, 2));
  assert.ok(Math.abs(back.x - box.x) < EPS, 'turn 270: back at the left edge');
});

test('place-items Task 7: every type and turn keeps all parts inside the footprint', () => {
  for (const type of ['sofa', 'bed', 'table', 'wardrobe', 'desk', 'bath', 'kitchen unit']) {
    for (const turn of [0, 90, 180, 270]) {
      const swap = turn === 90 || turn === 270;
      const box = furnitureBox(type, { turn, width: swap ? 0.9 : 2, depth: swap ? 2 : 0.9 });
      const parts = shapeParts(box);
      assert.ok(parts.length >= 2, `${type} ${turn}`);
      insideFootprint(box, parts);
    }
  }
});

test('place-items Task 7: a small object keeps the minimum thickness of 4 cm and stays inside', () => {
  for (const type of ['sofa', 'bed', 'table', 'wardrobe', 'desk', 'bath', 'kitchen unit']) {
    const box = furnitureBox(type, { width: 0.3, depth: 0.2 });
    const parts = shapeParts(box);
    insideFootprint(box, parts);
    for (const p of parts) {
      assert.ok(p.width >= 0.04 - EPS && p.depth >= 0.04 - EPS, `${type} ${p.role} is at least 4 cm`);
    }
  }
});

test('place-items Task 7: every part carries the item id, colour, status and clash flag', () => {
  const boxes = [
    furnitureBox('table', { clash: true, colour: 'locked', status: 'Locked' }),
    openingBox('door', 'front'),
    openingBox('window', 'front', { height: 1.2 }),
  ];
  for (const box of boxes) {
    for (const part of shapeParts(box)) {
      assert.equal(part.itemId, box.itemId);
      assert.equal(part.colour, box.colour);
      assert.equal(part.clash, box.clash);
      assert.equal(part.status, box.status);
    }
  }
  const keys = shapeParts(boxes[0]).map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length, 'part keys are unique');
});

test('place-items Task 7: no type, an unknown type or a non-shaped box gives an empty list', () => {
  assert.deepEqual(shapeParts(furnitureBox(undefined)), []);
  assert.deepEqual(shapeParts(furnitureBox('spaceship')), []);
  assert.deepEqual(shapeParts(furnitureBox('constructor')), []);
  assert.deepEqual(shapeParts(furnitureBox('toString')), []);
  assert.deepEqual(shapeParts({ ...openingBox('door', 'front'), furnitureType: undefined }), []);
  assert.deepEqual(shapeParts({ key: 'room:r', type: 'room', x: 0, y: 0, z: 0, width: 3, height: 2.6, depth: 3 }), []);
  assert.equal(shapeHeight('constructor'), undefined);
});

test('place-items Task 7: the sample\'s boxes are identical to before (same fingerprint of all 8 versions)', () => {
  const run = JSON.parse(readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8'));
  const all = run.snapshots.map((s) => buildScene(run, s.version));
  const hash = createHash('sha256').update(JSON.stringify(all)).digest('hex');
  // D6: new value for the design-team sample (old value d04a5af0...e58f42 for the four-agent sample).
  assert.equal(hash, 'f1e6e3906fedd2dcc2fa9e9a15898b77292ee99c8c0ed9a8c3b6aa768a62ebaf');
  // D6: the design-team sample's furniture has a type, so it gets a shape; its doors and windows are still plain panels (not own).
  for (const box of all.flat()) {
    if (box.type === 'furniture') { assert.ok(['sofa', 'table', 'kitchen unit', 'bed', 'wardrobe', 'bath'].includes(box.furnitureType)); continue; }
    assert.equal('furnitureType' in box, false);
    assert.equal('turn' in box, false);
    assert.deepEqual(shapeParts(box), []);
  }
});

function ownScene() {
  const s = createState();
  setProjectName(s, 'Shapes');
  const floor = addFloor(s, 'Ground').id;
  const room = addRoom(s, floor, 'Den', 5, 4).id;
  const sofa = addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Locked', x: 100, y: 200, width: 200, depth: 90 }).id;
  addPlaced(s, { type: 'door', name: 'Den door', room, status: 'Unsure', x: 0, y: 0, width: 90, depth: 10 });
  addPlaced(s, { type: 'window', name: 'Den window', room, status: 'Unsure', x: 150, y: 390, width: 120, depth: 10 });
  s.placed.find((o) => o.id === sofa).turn = 90;
  s.placed.find((o) => o.id === sofa).width = 90;
  s.placed.find((o) => o.id === sofa).depth = 200;
  const result = runDesignTeam(s);
  assert.equal(result.ok, true);
  const data = buildOwnRunData(result.project, s);
  return buildScene(data, data.snapshots.length - 1);
}

test('place-items Task 7: a visitor\'s project gives furnitureType and turn on furniture and shaped doors and windows', () => {
  const boxes = ownScene();
  const sofa = boxes.find((b) => b.label === 'Couch');
  assert.equal(sofa.furnitureType, 'sofa');
  assert.equal(sofa.turn, 90);
  assert.equal(sofa.height, shapeHeight('sofa'));
  assert.equal(shapeParts(sofa).length, 4);
  const door = boxes.find((b) => b.label === 'Den door');
  const win = boxes.find((b) => b.label === 'Den window');
  assert.equal(door.furnitureType, 'door');
  assert.equal(win.furnitureType, 'window');
  assert.equal(shapeParts(door).length, 4);
  assert.ok(shapeParts(win).some((p) => p.role === 'glass'));
  for (const box of [sofa, door, win]) insideFootprint(box, shapeParts(box));
});

test('place-items Task 7: run data from makeRunData alone (no own flag) leaves doors and windows plain', () => {
  const s = createState();
  setProjectName(s, 'Plain doors');
  const floor = addFloor(s, 'Ground').id;
  const room = addRoom(s, floor, 'Den', 5, 4).id;
  addPlaced(s, { type: 'door', name: 'D', room, status: 'Unsure', x: 0, y: 0, width: 90, depth: 10 });
  const result = runDesignTeam(s);
  const data = makeRunData(result.project, { ...readViewerLayout(), rooms: { Den: { width: 5, depth: 4 } } });
  const door = buildScene(data, data.snapshots.length - 1).find((b) => b.label === 'D');
  assert.equal('furnitureType' in door, false);
  assert.deepEqual(shapeParts(door), []);
});

test('place-items Task 7: the shapes file has no Three.js and no page code', () => {
  const src = readFileSync(new URL('../docs/scene-data.js', import.meta.url), 'utf8');
  assert.equal(/\bTHREE\b|from 'three|import\s/.test(src), false);
  assert.equal(/\bdocument\b|\bwindow\./.test(src.replace(/\/\/.*$/gm, '')), false);
});
