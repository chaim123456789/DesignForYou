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
const PANEL_THICKNESS = 0.1; // metres. Doors and windows are drawn as thin panels this thick.
const SLAB_THICKNESS = 0.1; // metres. Each room's floor slab sits just under its floor level.
const STYLE_LABEL_MAX = 24; // characters of the name kept before "(style)"

// The short text drawn next to a block. Furniture, doors and windows use their name.
// Style items have long sentences for names, so they are cut short and end in "(style)".
export function shortLabel(item) {
  if (item.kind !== 'style') return item.name;
  let base = item.name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+(in the \w+|stays as it is)\s*$/i, '').trim();
  if (base.length > STYLE_LABEL_MAX) {
    const cut = base.slice(0, STYLE_LABEL_MAX + 1).replace(/\s+\S*$/, '').trim();
    base = `${cut}\u2026`;
  }
  return `${base} (style)`;
}

// Labels that would overlap on screen are moved up, one at a time, until they do not.
// Input: one {x, y, width, height} per label in pixels, where x is the middle and y the
// bottom edge. Earlier labels keep their place. Output: the bottom edge (y) to use for each.
export function separateLabels(rects, gap = 2) {
  const placed = [];
  return rects.map((r) => {
    let y = r.y;
    for (let guard = 0; guard < 50; guard += 1) {
      const hit = placed.find((p) => Math.abs(p.x - r.x) < (p.width + r.width) / 2
        && y > p.y - p.height - gap && y - r.height - gap < p.y);
      if (!hit) break;
      y = hit.y - hit.height - gap;
    }
    placed.push({ x: r.x, y, width: r.width, height: r.height });
    return y;
  });
}

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

// A door or window is drawn as a thin panel lying along the wall edge nearest to its
// footprint. The footprint (p) only decides which wall and where along it; the panel
// has the footprint's length along the wall and PANEL_THICKNESS across it.
// Returns the panel's corner and size inside the room, in room coordinates.
export function wallPanel(p, room) {
  const gaps = [
    ['front', p.y],                              // wall at the low end of z
    ['back', room.depth - (p.y + p.depth)],      // wall at the high end of z
    ['left', p.x],
    ['right', room.width - (p.x + p.width)],
  ];
  const [wall] = gaps.reduce((best, g) => (g[1] < best[1] ? g : best));
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  if (wall === 'front' || wall === 'back') {
    const length = Math.min(p.width, room.width);
    return {
      wall, width: length, depth: PANEL_THICKNESS,
      x: clamp(p.x, 0, room.width - length),
      z: wall === 'front' ? 0 : room.depth - PANEL_THICKNESS,
    };
  }
  const length = Math.min(p.depth, room.depth);
  return {
    wall, width: PANEL_THICKNESS, depth: length,
    x: wall === 'left' ? 0 : room.width - PANEL_THICKNESS,
    z: clamp(p.y, 0, room.depth - length),
  };
}

// "Ground Floor" is shown as "Ground floor", "Upper Floor" as "Upper floor".
export function floorLabelText(floor) {
  const name = String(floor.name).trim();
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

const FLOOR_LABEL_SPACE = 1.4; // metres left of the home where a floor's label is placed

// One label per floor, placed to the left of the home at that floor's height.
export function floorLabels(sampleRun) {
  const rooms = sampleRun.floors.flatMap((f) => f.rooms);
  const left = Math.min(...rooms.map((r) => r.x));
  return sampleRun.floors.map((floor) => {
    const front = Math.max(...floor.rooms.map((r) => r.z + r.depth));
    const back = Math.min(...floor.rooms.map((r) => r.z));
    return {
      order: floor.order,
      text: floorLabelText(floor),
      x: left - FLOOR_LABEL_SPACE, y: floor.elevation + 0.8, z: (back + front) / 2,
    };
  });
}

// Keep only the boxes (or labels) of one floor. which is "all" or a floor's order number.
export function filterByFloor(list, which) {
  if (which === 'all') return list;
  return list.filter((b) => b.floorOrder === which || b.order === which);
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
        key: `slab:${room.id}`,
        type: 'floor-slab',
        floorOrder: floor.order,
        x: room.x, y: floor.elevation - SLAB_THICKNESS, z: room.z,
        width: room.width, height: SLAB_THICKNESS, depth: room.depth,
        colour: 'neutral',
        clash: false,
      });
      boxes.push({
        key: `room:${room.id}`,
        type: 'room',
        floorOrder: floor.order,
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
      floorOrder: floor.order,
      label: shortLabel(item),
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
      if (item.kind === 'door' || item.kind === 'window') {
        const panel = wallPanel(p, room);
        const isDoor = item.kind === 'door';
        boxes.push({
          ...base, type: item.kind, wall: panel.wall,
          x: room.x + panel.x, y: floor.elevation + (isDoor ? 0 : L.windowBottom), z: room.z + panel.z,
          width: panel.width, height: isDoor ? L.doorHeight : L.windowHeight, depth: panel.depth,
        });
      } else {
        boxes.push({
          ...base, type: 'furniture',
          x: room.x + p.x, y: floor.elevation, z: room.z + p.y,
          width: p.width, height: L.furnitureHeight, depth: p.depth,
        });
      }
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
