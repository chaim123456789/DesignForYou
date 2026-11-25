import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScene, describeItem } from '../docs/scene-data.js';

const run = JSON.parse(readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8'));
const LATEST = run.versions.length;
const rooms = run.floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floor: f })));
const roomOf = (box) => {
  const id = box.key.startsWith('room:') ? box.key.slice(5) : run.snapshots[LATEST].items.find((i) => i.id === box.itemId).room;
  return rooms.find((r) => r.id === id);
};
const itemName = (box) => run.snapshots[LATEST].items.find((i) => i.id === box.itemId).name;
const clashedNames = (version) => buildScene(run, version).filter((b) => b.clash).map(itemName).sort();

test('Task 3: two floors at different heights', () => {
  assert.equal(run.floors.length, 2);
  const roomBoxes = buildScene(run, LATEST).filter((b) => b.type === 'room');
  const heights = new Set(roomBoxes.map((b) => b.y));
  assert.equal(heights.size, 2);
});

test('Task 3: 4 rooms', () => {
  assert.equal(buildScene(run, LATEST).filter((b) => b.type === 'room').length, 4);
});

test('Task 3: every door, window and furniture box lies inside its room', () => {
  const boxes = buildScene(run, LATEST).filter((b) => ['door', 'window', 'furniture'].includes(b.type));
  assert.equal(boxes.length, 13); // D6: the design-team sample has 4 doors, 3 windows and 6 pieces of furniture (old value 4)
  for (const b of boxes) {
    const room = roomOf(b);
    const floorY = room.floor.elevation;
    const eps = 1e-9;
    assert.ok(b.x >= room.x - eps && b.x + b.width <= room.x + room.width + eps, `${itemName(b)} across`);
    assert.ok(b.z >= room.z - eps && b.z + b.depth <= room.z + room.depth + eps, `${itemName(b)} depth`);
    assert.ok(b.y >= floorY - eps && b.y + b.height <= floorY + run.layout.wallHeight + eps, `${itemName(b)} height`);
  }
});

test('Task 3: style items get markers', () => {
  const styleItems = run.snapshots[LATEST].items.filter((i) => i.kind === 'style');
  const markers = buildScene(run, LATEST).filter((b) => b.type === 'style-marker');
  assert.equal(markers.length, styleItems.length);
  assert.deepEqual(markers.map((m) => m.itemId).sort(), styleItems.map((i) => i.id).sort());
});

test('Task 3: the clash report gets no box', () => {
  const clashItem = run.snapshots[LATEST].items.find((i) => i.kind === 'clash');
  assert.ok(clashItem);
  assert.ok(!buildScene(run, LATEST).some((b) => b.itemId === clashItem.id));
});

test('Task 3: Locked and Unsure boxes get different colour names', () => {
  const items = buildScene(run, LATEST).filter((b) => b.itemId);
  const locked = items.filter((b) => b.status === 'Locked');
  const unsure = items.filter((b) => b.status === 'Unsure');
  assert.ok(locked.length > 0 && unsure.length > 0);
  assert.ok(locked.every((b) => b.colour === 'locked'));
  assert.ok(unsure.every((b) => b.colour === 'unsure'));
});

test('Task 3: clash boxes are marked for the Garden door, the Sofa and the oak bed frame marker at the latest version', () => {
  // D6: the design-team sample's Reviewer also reports items out of date and the Locked bed that needs a look (old value: the first three only... see the log).
  assert.deepEqual(clashedNames(LATEST), ['Decor of Living Room', 'Garden door', 'Oak bed', 'Oak bed frame stays as it is', 'Sofa', 'Style of the decor in Bedroom', 'Style of the decor in Living Room']);
});

test('Task 3: no box is marked as a clash at version 0', () => {
  assert.deepEqual(clashedNames(0), []);
});

test('Task 3: an item created after version N is absent at version N', () => {
  // Every item in the real sample exists from version 0, so a made-up late item checks the rule.
  const copy = structuredClone(run);
  copy.snapshots[LATEST].items.push({
    id: 'late', kind: 'layout', name: 'Late chair', status: 'Unsure', owner: 'Layout',
    room: rooms[0].id, position: { x: 0, y: 0, width: 1, depth: 1 },
  });
  assert.ok(buildScene(copy, LATEST).some((b) => b.itemId === 'late'));
  assert.ok(!buildScene(copy, LATEST - 1).some((b) => b.itemId === 'late'));
  assert.equal(describeItem(copy, LATEST - 1, 'late'), undefined);
});

test('Task 3: describeItem gives name, status in words, owner, kind and room name', () => {
  // D6: in the design-team sample the Garden door is item-13 (old item-6) and its owner is Doors and windows (old Builder).
  const d = describeItem(run, LATEST, 'item-13');
  assert.equal(d.name, 'Garden door');
  assert.equal(d.status, 'Unsure');
  assert.equal(d.owner, 'Doors and windows');
  assert.equal(d.kind, 'Door');
  assert.equal(d.room, 'Living Room');
  const locked = describeItem(run, LATEST, 'item-1');
  assert.equal(locked.status, 'Locked');
  assert.equal(locked.owner, 'Style');
  assert.equal(locked.room, 'Kitchen');
});

test('Task 3: describeItem gives the clash sentence for clash items', () => {
  // D6: design-team sample ids and sentences (old: item-6 "sits where the Sofa is placed", item-7 none, item-9 the report with 2).
  const door = describeItem(run, LATEST, 'item-13');
  assert.equal(door.clashes.length, 1);
  assert.match(door.clashes[0], /the swing of the Garden door runs into the Sofa/);
  assert.equal(describeItem(run, LATEST, 'item-14').clashes.length, 0);
  assert.equal(describeItem(run, 0, 'item-13').clashes.length, 0);
  assert.equal(describeItem(run, LATEST, 'item-51').clashes.length, 9);
});

test('Task 3: no text contains an id', () => {
  const texts = [];
  for (let n = 0; n <= LATEST; n++) {
    for (const b of buildScene(run, n)) if (b.label) texts.push(b.label);
    for (const item of run.snapshots[n].items) {
      const d = describeItem(run, n, item.id);
      texts.push(d.name, d.status, d.owner, d.kind, d.room || '', ...d.clashes);
    }
  }
  for (const t of texts) assert.doesNotMatch(t, /item-|floor-/, `id found in: ${t}`);
});

test('Task 3: names with < or & come back as plain text unchanged', () => {
  const copy = structuredClone(run);
  const odd = '<b>Tom & "Jerry"</b> &amp;';
  for (const snap of copy.snapshots) {
    const it = snap.items.find((i) => i.id === 'item-5');
    if (it) it.name = odd;
  }
  assert.equal(describeItem(copy, LATEST, 'item-5').name, odd);
});
