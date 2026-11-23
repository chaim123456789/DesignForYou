// Place-items Task 3: the geometry helpers (pure, no page).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cmToMetres, toBrainPosition, roomSizeCm, planViewBox, clickToPosition, isInsideRoom, overlaps, describePlaced,
  PLAN_MARGIN_CM,
} from '../docs/intake/place-geometry.js';

const kitchen = { width: 5, depth: 4 }; // metres, as in the setup form
const obj = (extra = {}) => ({
  id: 'placed-7', kind: 'layout', type: 'sofa', name: 'Sofa', room: 'room-3', status: 'Locked',
  x: 100, y: 300, width: 200, depth: 90, turn: 0, ...extra,
});

test('place-items Task 3: centimetres become metres without drift', () => {
  assert.equal(cmToMetres(90), 0.9);
  assert.equal(cmToMetres(120), 1.2);
  assert.equal(cmToMetres(10), 0.1);
  assert.equal(cmToMetres(-50), -0.5);
  assert.deepEqual(toBrainPosition(obj({ x: 120, y: 0, width: 90, depth: 10 })), { x: 1.2, y: 0, width: 0.9, depth: 0.1 });
});

test('place-items Task 3: a room size becomes whole centimetres', () => {
  assert.deepEqual(roomSizeCm({ width: 5, depth: 4 }), { width: 500, depth: 400 });
  assert.deepEqual(roomSizeCm({ width: 3.3, depth: 2.9 }), { width: 330, depth: 290 });
  assert.deepEqual(roomSizeCm({ width: 4.1, depth: 1.15 }), { width: 410, depth: 115 });
});

test('place-items Task 3: the plan view box is the room plus a margin on every side', () => {
  assert.deepEqual(planViewBox(kitchen), { x: -PLAN_MARGIN_CM, y: -PLAN_MARGIN_CM, width: 560, height: 460 });
});

// A plan drawn 320 px wide, placed 20 px from the left and 100 px from the top of the screen.
function phoneRect(room) {
  const vb = planViewBox(room);
  return { left: 20, top: 100, width: 320, height: (320 * vb.height) / vb.width };
}
// Screen point of a room position in centimetres.
function screenPoint(room, cmX, cmY) {
  const vb = planViewBox(room);
  const rect = phoneRect(room);
  return {
    clientX: rect.left + ((cmX - vb.x) / vb.width) * rect.width,
    clientY: rect.top + ((cmY - vb.y) / vb.height) * rect.height,
  };
}

test('place-items Task 3: a click at the corners and the middle of a room gives the right position (room drawn 320 px wide)', () => {
  const vb = planViewBox(kitchen);
  const rect = phoneRect(kitchen);
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 0, 0), rect, vb), { x: 0, y: 0 });
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 500, 0), rect, vb), { x: 500, y: 0 });
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 0, 400), rect, vb), { x: 0, y: 400 });
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 500, 400), rect, vb), { x: 500, y: 400 });
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 250, 200), rect, vb), { x: 250, y: 200 });
});

test('place-items Task 3: a click is rounded to the nearest 10 cm', () => {
  const vb = planViewBox(kitchen);
  const rect = phoneRect(kitchen);
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 134, 266), rect, vb), { x: 130, y: 270 });
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 136, 264), rect, vb), { x: 140, y: 260 });
  assert.deepEqual(clickToPosition(screenPoint(kitchen, 250, 200), rect, vb), { x: 250, y: 200 });
});

test('place-items Task 3: a click on the margin gives a position outside the room, and a click near 0 never gives minus zero', () => {
  const vb = planViewBox(kitchen);
  const rect = phoneRect(kitchen);
  assert.deepEqual(clickToPosition({ clientX: rect.left, clientY: rect.top }, rect, vb), { x: -30, y: -30 });
  const near = clickToPosition(screenPoint(kitchen, -4, -4), rect, vb);
  assert.ok(Object.is(near.x, 0) && Object.is(near.y, 0), 'minus zero would print as -0');
});

test('place-items Task 3: a click works at a different drawn size too', () => {
  const vb = planViewBox(kitchen);
  const rect = { left: 0, top: 0, width: 800, height: (800 * vb.height) / vb.width };
  const point = { clientX: ((250 + 30) / 560) * 800, clientY: ((200 + 30) / 460) * rect.height };
  assert.deepEqual(clickToPosition(point, rect, vb), { x: 250, y: 200 });
});

test('place-items Task 3: a plan with no size gives no position', () => {
  const vb = planViewBox(kitchen);
  assert.equal(clickToPosition({ clientX: 5, clientY: 5 }, { left: 0, top: 0, width: 0, height: 0 }, vb), null);
  assert.equal(clickToPosition({ clientX: 5, clientY: 5 }, null, vb), null);
});

test('place-items Task 3: pieces that touch exactly do not overlap, pieces that share area do', () => {
  const a = obj({ x: 0, y: 0, width: 100, depth: 100 });
  assert.equal(overlaps(a, obj({ x: 100, y: 0, width: 100, depth: 100 })), false, 'side by side');
  assert.equal(overlaps(a, obj({ x: 0, y: 100, width: 100, depth: 100 })), false, 'one above the other');
  assert.equal(overlaps(a, obj({ x: 100, y: 100, width: 50, depth: 50 })), false, 'corner to corner');
  assert.equal(overlaps(a, obj({ x: 99, y: 0, width: 100, depth: 100 })), true, '1 cm over');
  assert.equal(overlaps(a, obj({ x: 20, y: 20, width: 10, depth: 10 })), true, 'one inside the other');
  assert.equal(overlaps(obj({ x: 20, y: 20, width: 10, depth: 10 }), a), true, 'the other way round');
});

test('place-items Task 3: touching a wall is inside, 1 cm over a wall is outside', () => {
  const inside = (extra) => isInsideRoom(obj(extra), kitchen);
  assert.equal(inside({ x: 0, y: 0, width: 500, depth: 400 }), true, 'fills the room exactly');
  assert.equal(inside({ x: 300, y: 310, width: 200, depth: 90 }), true, 'touches right and bottom walls');
  assert.equal(inside({ x: 301, y: 310, width: 200, depth: 90 }), false, '1 cm over the right wall');
  assert.equal(inside({ x: 300, y: 311, width: 200, depth: 90 }), false, '1 cm over the bottom wall');
  assert.equal(inside({ x: -1, y: 0 }), false, '1 cm over the left wall');
  assert.equal(inside({ x: 0, y: -1 }), false, '1 cm over the top wall');
});

test('place-items Task 3: the sentence for an object is exact plain words', () => {
  assert.equal(
    describePlaced(obj(), kitchen),
    'Sofa (sofa), Locked. 100 cm from the left, 300 cm from the top, 200 cm wide, 90 cm deep, turned 0 degrees.'
  );
  assert.equal(
    describePlaced(obj({ type: 'bed', name: 'Guest bed', status: 'Unsure', x: 20, y: 30, width: 200, depth: 160, turn: 90 }), kitchen),
    'Guest bed (bed), Unsure. 20 cm from the left, 30 cm from the top, 200 cm wide, 160 cm deep, turned 90 degrees.'
  );
});

test('place-items Task 3: the sentence is right for every type and every turn', () => {
  for (const type of ['sofa', 'bed', 'table', 'wardrobe', 'desk', 'bath', 'kitchen unit', 'door', 'window']) {
    for (const turn of [0, 90, 180, 270]) {
      const text = describePlaced(obj({ type, name: 'Thing', status: 'Unsure', x: 1, y: 2, width: 30, depth: 40, turn }), kitchen);
      assert.equal(text, `Thing (${type}), Unsure. 1 cm from the left, 2 cm from the top, 30 cm wide, 40 cm deep, turned ${turn} degrees.`);
    }
  }
});

test('place-items Task 3: the sentence says when an object sticks out of its room, and only then', () => {
  const out = describePlaced(obj({ x: 301 }), kitchen);
  assert.ok(out.endsWith(' Sticks out of the room.'));
  assert.ok(!describePlaced(obj({ x: 300, y: 310 }), kitchen).includes('Sticks out'));
  assert.ok(!describePlaced(obj({ x: 9999 })).includes('Sticks out'), 'with no room given the sentence says nothing about it');
});

test('place-items Task 3: the sentence contains no ids', () => {
  const text = describePlaced(obj(), kitchen);
  assert.ok(!text.includes('placed-7'));
  assert.ok(!text.includes('room-3'));
  assert.ok(!/\b(?:placed|room|item|floor)-\d+/.test(text));
});

test('place-items Task 3: the geometry file has no page code, storage or network calls', () => {
  const source = readFileSync(new URL('../docs/intake/place-geometry.js', import.meta.url), 'utf8');
  for (const word of ['document', 'window.', 'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'innerHTML', 'cookie', 'http://', 'https://']) {
    assert.ok(!source.includes(word), `place-geometry.js must not contain ${word}`);
  }
});
