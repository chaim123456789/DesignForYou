import test from 'node:test';
import assert from 'node:assert/strict';
import * as brain from '../src/brain/brain.js';
import { createProject, createItem, appendVersion, listVersions } from '../src/brain/brain.js';

function makeProject() {
  const p = createProject({ name: 'Test Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
  createItem(p, { kind: 'style', value: 'oak', owner: 'Style' });
  return p;
}
const change = (n, extra = {}) => ({ who: 'Style', itemId: 'item-1', oldValue: `v${n - 1}`, newValue: `v${n}`, ...extra });

test('R8.1: first change is version 1, the next is version 2', () => {
  const p = makeProject();
  assert.equal(appendVersion(p, change(1)).number, 1);
  assert.equal(appendVersion(p, change(2)).number, 2);
  assert.equal(appendVersion(p, change(3)).number, 3);
  assert.deepEqual(listVersions(p).map((v) => v.number), [1, 2, 3]);
});

test('R8.2: each entry has number, time, who, item, old value and new value', () => {
  const p = makeProject();
  appendVersion(p, change(1, { time: '2026-11-18T10:00:00.000Z' }));
  const [v] = listVersions(p);
  assert.equal(v.number, 1);
  assert.equal(v.time, '2026-11-18T10:00:00.000Z');
  assert.equal(v.who, 'Style');
  assert.equal(v.item, 'item-1');
  assert.equal(v.oldValue, 'v0');
  assert.equal(v.newValue, 'v1');
});

test('R8.2: a version gets a time when none is given', () => {
  const p = makeProject();
  const v = appendVersion(p, change(1));
  assert.ok(!Number.isNaN(Date.parse(v.time)));
});

test('R8.3: there is no exported way to edit or remove a version', () => {
  const names = Object.keys(brain);
  const forbidden = names.filter((n) => /(edit|remove|delete|update|clear|reset|splice|replace)/i.test(n) && /version/i.test(n));
  assert.deepEqual(forbidden, []);
  // the only version functions are add (appendVersion) and the two read-only ones
  assert.deepEqual(names.filter((n) => /version/i.test(n)).sort(), ['appendVersion', 'getBrainAtVersion', 'listVersions']);
});

test('R8.3: changing a listed version does not change the history', () => {
  const p = makeProject();
  appendVersion(p, change(1));
  const [copy] = listVersions(p);
  assert.throws(() => {
    'use strict';
    copy.newValue = 'hacked';
  });
  assert.equal(listVersions(p)[0].newValue, 'v1');
  assert.throws(() => {
    'use strict';
    p.versions[0].newValue = 'hacked';
  });
  assert.equal(p.versions[0].newValue, 'v1');
});
