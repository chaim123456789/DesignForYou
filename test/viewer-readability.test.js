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
