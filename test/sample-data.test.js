import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject, createItem } from '../src/brain/brain.js';

const FILE = new URL('../src/sample/sample-project.json', import.meta.url);
const text = readFileSync(FILE, 'utf8');
const sample = JSON.parse(text);
const allRooms = sample.floors.flatMap((f) => f.rooms);

test('R7.1: the sample has 2 floors and 4 rooms (kitchen, living room, bedroom, bathroom)', () => {
  assert.equal(sample.floors.length, 2);
  assert.equal(allRooms.length, 4);
  assert.deepEqual(allRooms.map((r) => r.name).sort(), ['Bathroom', 'Bedroom', 'Kitchen', 'Living Room']);
});

test('R7.2: the sample has at least 2 Locked and at least 3 Unsure items', () => {
  const count = (s) => sample.items.filter((i) => i.status === s).length;
  assert.ok(count('Locked') >= 2, `Locked: ${count('Locked')}`);
  assert.ok(count('Unsure') >= 3, `Unsure: ${count('Unsure')}`);
});

test('R7.3: the sample has at least 1 room override, and it is on the bedroom', () => {
  const overrides = allRooms.filter((r) => r.override);
  assert.ok(overrides.length >= 1);
  assert.equal(overrides[0].name, 'Bedroom');
});

test('the sample is marked as a sample and has an overall inspiration set and a style conflict list', () => {
  assert.equal(sample.isSample, true);
  assert.ok(sample.inspiration.length >= 1);
  assert.ok(sample.styleConflicts.length >= 1);
  assert.ok(sample.styleConflicts.every((pair) => Array.isArray(pair) && pair.length === 2));
});

test('every item is valid in the real Brain (kind, owner, status, room)', () => {
  const project = createProject(sample);
  const roomIdByName = new Map(project.floors.flatMap((f) => f.rooms).map((r) => [r.name, r.id]));
  for (const i of sample.items) {
    const data = { kind: i.kind, owner: i.owner, status: i.status, value: i.value };
    if (i.room) {
      assert.ok(roomIdByName.has(i.room), `unknown room ${i.room}`);
      data.room = roomIdByName.get(i.room);
    }
    createItem(project, data);
  }
  assert.equal(project.items.length, sample.items.length);
});

test('R9.4 (data): a door sits on furniture in the same room', () => {
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
  const furniture = sample.items.filter((i) => i.kind === 'layout');
  const doors = sample.items.filter((i) => i.kind === 'door' || i.kind === 'window');
  const clashing = doors.filter((d) => furniture.some((f) => f.room === d.room && overlap(d.value.position, f.value.position)));
  assert.equal(clashing.length, 1);
  assert.equal(clashing[0].value.name, 'Garden door');
});

test('R9.4 (data): the bedroom override conflicts with a Locked style item in that room', () => {
  const room = allRooms.find((r) => r.override);
  const locked = sample.items.filter((i) => i.kind === 'style' && i.status === 'Locked' && i.room === room.name);
  const conflicts = (a, b) => sample.styleConflicts.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const found = locked.filter((i) => room.override.some((tag) => conflicts(tag, i.value.tag)));
  assert.ok(found.length >= 1);
});

test('R7.8: no personal data (no emails, phone numbers, street addresses, links)', () => {
  assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.]+/, 'email address');
  assert.doesNotMatch(text, /\+?\d[\d\s().-]{8,}\d/, 'phone number');
  assert.doesNotMatch(text, /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Court|Way)\b/, 'street address');
  assert.doesNotMatch(text, /https?:\/\/|www\./i, 'web link');
});
