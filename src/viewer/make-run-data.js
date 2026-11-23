// Turns a finished Project Brain into the plain data the 3D viewer reads.
// Pure: no file reading, no network, so it also runs in a browser.
// Read only: it never changes the Brain. Every past version comes from
// getBrainAtVersion, so there is no second way of replaying history.
import { listVersions, getBrainAtVersion } from '../brain/brain.js';

const KIND_WORDS = { style: 'style note', layout: 'furniture', door: 'door', window: 'window', clash: 'review report' };

// The plain name shown for an item (no ids).
function itemName(item) {
  const v = item.value || {};
  if (item.kind === 'style') return v.detail;
  if (item.kind === 'clash') return 'Review report';
  return v.name;
}

function snapshotItem(item) {
  const v = item.value;
  const out = {
    id: item.id,
    kind: item.kind,
    name: itemName(item),
    status: item.status,
    owner: item.owner,
  };
  if (item.room !== undefined) out.room = item.room;
  if (v.position) out.position = structuredClone(v.position);
  // Placed furniture carries a type and a turn. Items without them (the sample) are unchanged.
  if (v.type !== undefined) out.type = v.type;
  if (v.turn !== undefined) out.turn = v.turn;
  if (item.kind === 'clash') {
    out.summary = v.summary;
    out.clashes = structuredClone(v.clashes || []);
  }
  return out;
}

// One plain sentence per version, with no ids.
function versionSentence(v, itemsById, roomNames) {
  const item = itemsById.get(v.item);
  const base = `Version ${v.number}: `;
  if (!item) return `${base}${v.who} made a change`;
  const name = itemName({ kind: item.kind, value: v.oldValue });
  const room = item.room !== undefined ? roomNames.get(item.room) : undefined;
  const where = room ? ` in the ${room}` : '';
  if (v.field === 'status') {
    return `${base}${v.who} changed the status of "${name}"${where} to ${v.newValue}`;
  }
  if (item.kind === 'clash') return `${base}${v.who} wrote the review report: ${v.newValue.summary}`;
  if (item.kind === 'style') return `${base}${v.who} updated the style note "${name}"${where}`;
  if (v.newValue && v.newValue.note) return `${base}${v.who} checked the ${name}${where}`;
  return `${base}${v.who} changed the ${KIND_WORDS[item.kind] || 'item'} "${name}"${where}`;
}

export function makeRunData(project, layout) {
  const roomNames = new Map(project.floors.flatMap((f) => f.rooms.map((r) => [r.id, r.name])));
  const itemsById = new Map(project.items.map((i) => [i.id, i]));

  const floors = project.floors.map((floor) => {
    let x = 0;
    const rooms = floor.rooms.map((room) => {
      const size = layout.rooms[room.name];
      if (!size) throw new Error(`The viewer layout has no size for the room "${room.name}".`);
      const placed = { id: room.id, name: room.name, order: room.order, x, z: 0, width: size.width, depth: size.depth };
      x += size.width + layout.gapBetweenRooms;
      return placed;
    });
    return { id: floor.id, name: floor.name, order: floor.order, elevation: (floor.order - 1) * layout.floorToFloorHeight, rooms };
  });

  const history = listVersions(project);
  // No time is exported: the page does not need it, and a date such as 2026-01-01 looks like a phone number to the personal-data pattern check.
  const versions = history.map((v) => ({
    number: v.number,
    who: v.who,
    item: v.item,
    field: v.field,
    sentence: versionSentence(v, itemsById, roomNames),
  }));

  const snapshots = [];
  for (let n = 0; n <= history.length; n++) {
    snapshots.push({ version: n, items: getBrainAtVersion(project, n).items.map(snapshotItem) });
  }

  return {
    name: project.name,
    layout: {
      wallHeight: layout.wallHeight,
      doorHeight: layout.doorHeight,
      windowHeight: layout.windowHeight,
      windowBottom: layout.windowBottom,
      furnitureHeight: layout.furnitureHeight,
      styleMarker: structuredClone(layout.styleMarker),
    },
    floors,
    versions,
    snapshots,
  };
}
