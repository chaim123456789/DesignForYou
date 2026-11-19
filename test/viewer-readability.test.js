// Task 7b: viewer readability. Tests for the parts that can be checked without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScene, shortLabel, separateLabels } from '../docs/scene-data.js';

const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
const run = JSON.parse(read('sample-run.json'));
const LATEST = run.versions.length;
const boxes = buildScene(run, LATEST);
const byLabel = (text) => boxes.find((b) => b.label === text);

test('Task 7b step 1: every item block has a short label with the item name; style markers end in "(style)"', () => {
  const blocks = boxes.filter((b) => b.itemId !== undefined);
  assert.ok(blocks.length >= 8);
  for (const b of blocks) {
    assert.ok(typeof b.label === 'string' && b.label.length > 0 && b.label.length <= 40, `no good label on ${b.type}`);
  }
  assert.ok(byLabel('Sofa'));
  assert.ok(byLabel('Garden door'));
  assert.ok(byLabel('Kitchen window'));
  assert.ok(byLabel('Oak floor (style)'));
  for (const b of blocks.filter((x) => x.type === 'style-marker')) assert.match(b.label, / \(style\)$/);
  assert.equal(shortLabel({ kind: 'style', name: 'Oak floor in the kitchen' }), 'Oak floor (style)');
  assert.doesNotMatch(blocks.map((b) => b.label).join('|'), /item-|floor-\d/);
});

test('Task 7b step 1: labels that would collide are offset, and labels that do not collide stay put', () => {
  const same = separateLabels([{ x: 100, y: 100, width: 60, height: 16 }, { x: 105, y: 100, width: 60, height: 16 }]);
  assert.equal(same[0], 100);
  assert.ok(same[1] <= 100 - 16, 'second label must sit above the first');
  const apart = separateLabels([{ x: 100, y: 100, width: 60, height: 16 }, { x: 300, y: 100, width: 60, height: 16 }]);
  assert.deepEqual(apart, [100, 100]);
  const many = separateLabels(Array.from({ length: 5 }, () => ({ x: 50, y: 200, width: 80, height: 16 })));
  assert.equal(new Set(many).size, 5);
});

test('Task 7b step 1: the page draws the labels itself, with textContent', () => {
  const js = read('viewer.js');
  assert.match(js, /separateLabels/);
  assert.match(js, /add\(b, b\.label/);
  assert.match(js, /element\.textContent = text/);
  assert.doesNotMatch(js, /sprite|CanvasTexture|FontLoader/i);
});

import { wallPanel } from '../docs/scene-data.js';

const overlaps = (a, b) => ['x', 'y', 'z'].every((axis) => {
  const size = axis === 'x' ? 'width' : axis === 'y' ? 'height' : 'depth';
  return a[axis] <= b[axis] + b[size] + 1e-9 && b[axis] <= a[axis] + a[size] + 1e-9;
});

test('Task 7b step 2: doors are thin tall panels, under 0.2 m thick and about 2.0 m tall, standing on the floor', () => {
  const doors = boxes.filter((b) => b.type === 'door');
  assert.equal(doors.length, 2);
  for (const d of doors) {
    assert.ok(Math.min(d.width, d.depth) < 0.2, `${d.label} is ${Math.min(d.width, d.depth)} m thick`);
    assert.ok(d.height >= 1.9 && d.height <= 2.1, `${d.label} is ${d.height} m tall`);
    assert.ok(Math.max(d.width, d.depth) > 0.5, 'a door panel is wider than it is thick');
    assert.ok(boxes.some((r) => r.type === 'room' && r.y === d.y), 'a door stands on its floor');
  }
});

test('Task 7b step 2: windows are thin panels with the sill above the floor, about 0.9 m up and 1.2 m high', () => {
  const windows = boxes.filter((b) => b.type === 'window');
  assert.equal(windows.length, 1);
  const w = windows[0];
  const room = boxes.find((b) => b.type === 'room' && w.x >= b.x && w.x <= b.x + b.width && w.z >= b.z - 1e-9 && w.z <= b.z + b.depth && w.y >= b.y);
  assert.ok(Math.min(w.width, w.depth) < 0.2);
  assert.ok(w.y - room.y >= 0.8 && w.y - room.y <= 1.0, `sill is ${w.y - room.y} m`);
  assert.ok(w.height >= 1.1 && w.height <= 1.3);
});

test('Task 7b step 2: a door or window lies along the wall edge nearest to its position', () => {
  const room = { width: 6, depth: 4 };
  const garden = wallPanel({ x: 1.5, y: 3, width: 0.9, depth: 0.9 }, room);
  assert.equal(garden.wall, 'back');
  assert.equal(garden.z + garden.depth, room.depth, 'touches the wall edge');
  assert.equal(wallPanel({ x: 0.2, y: 0, width: 0.9, depth: 0.9 }, room).wall, 'front');
  assert.equal(wallPanel({ x: 0, y: 1, width: 0.9, depth: 0.9 }, room).wall, 'left');
  const right = wallPanel({ x: 5.1, y: 1, width: 0.9, depth: 0.9 }, room);
  assert.equal(right.wall, 'right');
  assert.equal(right.x + right.width, room.width);
  for (const p of [garden, right]) assert.ok(Math.min(p.width, p.depth) < 0.2);
});

test('Task 7b step 2: the Garden door panel still touches or overlaps the Sofa, and both are outlined as a clash', () => {
  const door = byLabel('Garden door');
  const sofa = byLabel('Sofa');
  assert.ok(overlaps(door, sofa), 'the door panel and the sofa must touch or overlap');
  assert.ok(door.clash && sofa.clash);
  assert.match(read('viewer.js'), /COLOURS\.clash/);
});

test('Task 7b step 3: the sofa is about 0.8 m high, and style markers are flat patches lying on the floor', () => {
  const sofa = byLabel('Sofa');
  assert.ok(sofa.height >= 0.7 && sofa.height <= 0.9, `sofa is ${sofa.height} m high`);
  assert.ok(sofa.height > Math.min(sofa.width, sofa.depth) * 0.3, 'furniture is a solid block, not a sheet');
  const markers = boxes.filter((b) => b.type === 'style-marker');
  assert.equal(markers.length, 4);
  for (const m of markers) {
    assert.ok(m.height <= 0.06, `${m.label} is ${m.height} m high`);
    assert.ok(m.height * 5 < Math.min(m.width, m.depth), 'a marker is much wider than it is high');
    assert.ok(boxes.some((r) => r.type === 'room' && r.y === m.y), 'a marker lies on the floor');
  }
});

test('Task 7b step 4: each room has a solid floor slab under its floor level, and the room names stay', () => {
  const rooms = boxes.filter((b) => b.type === 'room');
  const slabs = boxes.filter((b) => b.type === 'floor-slab');
  assert.equal(rooms.length, 4);
  assert.equal(slabs.length, 4);
  for (const r of rooms) {
    const slab = slabs.find((s) => s.key === `slab:${r.key.slice(5)}`);
    assert.ok(slab, `no slab for ${r.label}`);
    assert.ok(slab.x === r.x && slab.z === r.z && slab.width === r.width && slab.depth === r.depth, 'slab matches the room');
    assert.ok(Math.abs(slab.y + slab.height - r.y) < 1e-9, 'slab top is at the floor level');
    assert.ok(slab.height > 0 && slab.height <= 0.2);
  }
  assert.deepEqual(rooms.map((r) => r.label).sort(), ['Bathroom', 'Bedroom', 'Kitchen', 'Living Room']);
  const labelled = read('viewer.js');
  assert.match(labelled, /b\.type === 'room'\) add\(b, b\.label, 'room-label'/);
});

test('Task 7b step 4: the page draws walls as outlines only (no filled wall faces)', () => {
  const js = read('viewer.js');
  const roomCode = js.slice(js.indexOf("if (b.type === 'room') {"), js.indexOf('const isWindow'));
  assert.match(roomCode, /EdgesGeometry/);
  assert.doesNotMatch(roomCode, /new THREE\.Mesh\(/);
});

import { filterByFloor, floorLabels, floorLabelText } from '../docs/scene-data.js';

const labelsOf = (list) => list.map((b) => b.label);

test('Task 7b step 5: the floors are labelled "Ground floor" and "Upper floor"', () => {
  assert.deepEqual(run.floors.map(floorLabelText), ['Ground floor', 'Upper floor']);
  const labels = floorLabels(run);
  assert.deepEqual(labels.map((l) => l.text), ['Ground floor', 'Upper floor']);
  assert.ok(labels[1].y > labels[0].y, 'the upper label is higher');
});

test('Task 7b step 5: the page has the three floor buttons: Both, Ground floor, Upper floor', () => {
  const html = read('index.html');
  const buttons = [...html.matchAll(/<button type="button" id="(floor-[a-z]+)"[^>]*data-floor="([^"]+)"[^>]*>([^<]*)<\/button>/g)];
  assert.deepEqual(buttons.map((m) => m[3]), ['Both', 'Ground floor', 'Upper floor']);
  assert.deepEqual(buttons.map((m) => m[2]), ['all', '1', '2']);
  assert.match(html.slice(html.indexOf('id="view-controls"'), html.indexOf('id="scene-area"')), /floor-all[\s\S]*floor-ground[\s\S]*floor-upper/);
  assert.ok(html.indexOf('id="view-controls"') > html.indexOf('</header>') && html.indexOf('id="view-controls"') < html.indexOf('<footer'));
});

test('Task 7b step 5: the floor filter hides the right items', () => {
  const both = filterByFloor(boxes, 'all');
  assert.equal(both.length, boxes.length);
  const ground = labelsOf(filterByFloor(boxes, 1).filter((b) => b.itemId !== undefined));
  const upper = labelsOf(filterByFloor(boxes, 2).filter((b) => b.itemId !== undefined));
  for (const name of ['Sofa', 'Garden door', 'Kitchen window', 'Oak floor (style)']) assert.ok(ground.includes(name), `${name} on ground`);
  for (const name of ['Bedroom door', 'Oak bed frame (style)']) assert.ok(upper.includes(name), `${name} on upper`);
  assert.ok(!ground.includes('Bedroom door') && !ground.includes('Oak bed frame (style)'), 'ground hides the upper items');
  assert.ok(!upper.includes('Sofa') && !upper.includes('Garden door') && !upper.includes('Kitchen window'), 'upper hides the ground items');
  assert.deepEqual(labelsOf(filterByFloor(boxes, 1).filter((b) => b.type === 'room')).sort(), ['Kitchen', 'Living Room']);
  assert.deepEqual(labelsOf(filterByFloor(boxes, 2).filter((b) => b.type === 'room')).sort(), ['Bathroom', 'Bedroom']);
  assert.equal(filterByFloor(boxes, 1).length + filterByFloor(boxes, 2).length, boxes.length, 'every box is on exactly one floor');
  assert.deepEqual(filterByFloor(floorLabels(run), 2).map((l) => l.text), ['Upper floor']);
});
