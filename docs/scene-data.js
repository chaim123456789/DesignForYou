// Scene data for the 3D room viewer. Plain JavaScript: no Three.js, no browser code.
// Works from the sample run file (docs/sample-run.json) and nothing else.
//
// Box coordinates are in metres. x runs left to right, y runs up, z runs front
// to back. x, y and z are the box's lowest corner. width is along x, height
// along y and depth along z.

const KIND_WORDS = {
  style: 'Style note',
  layout: 'Furniture',
  door: 'Door',
  window: 'Window',
  clash: 'Review report',
};

const MARKER_GAP = 0.1;

function snapshotAt(sampleRun, version) {
  const snap = sampleRun.snapshots.find((s) => s.version === version);
  if (!snap) {
    const last = sampleRun.snapshots.length - 1;
    throw new Error(`Version ${version} does not exist. Versions go from 0 to ${last}.`);
  }
  return snap;
}

function colourFor(status) {
  return status === 'Locked' ? 'locked' : 'unsure';
}

// Every id named in a clash of the review report at this version.
function clashedIds(snap) {
  const ids = new Set();
  for (const item of snap.items) {
    if (item.kind !== 'clash') continue;
    for (const clash of item.clashes || []) {
      for (const id of clash.items || []) ids.add(id);
    }
  }
  return ids;
}

function findRoom(sampleRun, roomId) {
  for (const floor of sampleRun.floors) {
    const room = floor.rooms.find((r) => r.id === roomId);
    if (room) return { floor, room };
  }
  return undefined;
}

// The list of boxes to draw for one version.
export function buildScene(sampleRun, version) {
  const snap = snapshotAt(sampleRun, version);
  const L = sampleRun.layout;
  const clashed = clashedIds(snap);
  const boxes = [];

  for (const floor of sampleRun.floors) {
    for (const room of floor.rooms) {
      boxes.push({
        key: `room:${room.id}`,
        type: 'room',
        label: room.name,
        x: room.x, y: floor.elevation, z: room.z,
        width: room.width, height: L.wallHeight, depth: room.depth,
        colour: 'neutral',
        clash: false,
      });
    }
  }

  const markersInRoom = new Map();
  for (const item of snap.items) {
    if (item.kind === 'clash' || item.room === undefined) continue;
    const found = findRoom(sampleRun, item.room);
    if (!found) continue;
    const { floor, room } = found;
    const base = {
      key: `item:${item.id}`,
      itemId: item.id,
      status: item.status,
      colour: colourFor(item.status),
      clash: clashed.has(item.id),
    };

    if (item.kind === 'style') {
      const n = markersInRoom.get(room.id) || 0;
      markersInRoom.set(room.id, n + 1);
      const m = L.styleMarker;
      boxes.push({
        ...base, type: 'style-marker',
        x: room.x + MARKER_GAP + n * (m.width + MARKER_GAP),
        y: floor.elevation,
        z: room.z + room.depth - m.depth - MARKER_GAP,
        width: m.width, height: m.height, depth: m.depth,
      });
    } else if (item.position) {
      const p = item.position;
      let type = 'furniture';
      let y = floor.elevation;
      let height = L.furnitureHeight;
      if (item.kind === 'door') { type = 'door'; height = L.doorHeight; }
      if (item.kind === 'window') { type = 'window'; y += L.windowBottom; height = L.windowHeight; }
      boxes.push({
        ...base, type,
        x: room.x + p.x, y, z: room.z + p.y,
        width: p.width, height, depth: p.depth,
      });
    }
  }
  return boxes;
}

// Plain-language details for one item at one version. Returns undefined if the
// item does not exist at that version. All values are plain text, never markup.
export function describeItem(sampleRun, version, itemId) {
  const snap = snapshotAt(sampleRun, version);
  const item = snap.items.find((i) => i.id === itemId);
  if (!item) return undefined;
  const found = item.room !== undefined ? findRoom(sampleRun, item.room) : undefined;
  const clashSentences = [];
  if (item.kind === 'clash') {
    for (const clash of item.clashes || []) clashSentences.push(`${clash.severity} clash: ${clash.description}`);
  } else {
    for (const other of snap.items) {
      if (other.kind !== 'clash') continue;
      for (const clash of other.clashes || []) {
        if ((clash.items || []).includes(itemId)) clashSentences.push(`${clash.severity} clash: ${clash.description}`);
      }
    }
  }
  return {
    name: item.name,
    status: item.status,
    owner: item.owner,
    kind: KIND_WORDS[item.kind] || 'Item',
    room: found ? found.room.name : undefined,
    clashes: clashSentences,
  };
}
