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
  wall: 'Walls',
  floor: 'Floor',
  ceiling: 'Ceiling',
  light: 'Lights',
  electrical: 'Switches and sockets',
  decor: 'Decor',
};

// The design team's small things (design-team D5), drawn as simple shapes: a light is a small flat marker under the ceiling,
// a switch or a socket is a small block on its wall at its height, a rug is a thin mat on the floor. Sizes in metres.
const MARK = Object.freeze({ lightSize: 0.3, lightThickness: 0.05, pointSize: 0.08, rugThickness: 0.02, defaultHeight: 0.45 });

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

// ---- The 3D shapes (place-items Task 7). Pure: boxes only, no Three.js. ----

const MIN_PART = 0.04; // metres. No part is thinner than 4 cm, so a small object still shows its parts.
const FRAME = 0.06; // metres. Door and window frames are this thick.
const round = (n) => Math.round(n * 1e6) / 1e6;

// Viewer-only heights in metres, one fixed table. The run data does not change.
export const SHAPE_HEIGHTS = Object.freeze({
  sofa: { seat: 0.45, back: 0.85, arm: 0.6 },
  bed: { mattress: 0.5, headboard: 1.0 },
  table: { top: 0.75, topThickness: 0.05 },
  wardrobe: { body: 2.0 },
  desk: { top: 0.75, topThickness: 0.04 },
  bath: { outer: 0.55, inner: 0.3 },
  'kitchen unit': { base: 0.86, worktop: 0.9 },
});

// The full height of a typed piece of furniture (used for its overall box and clash outline).
export function shapeHeight(type) {
  const h = typeof type === 'string' && Object.hasOwn(SHAPE_HEIGHTS, type) ? SHAPE_HEIGHTS[type] : undefined;
  return h ? Math.max(...Object.values(h).filter((v) => v > 0.1)) : undefined;
}

// Turn a rectangle made for "turn 0" (back at the low-z edge) into the box's real
// turn. Turns are clockwise as seen on the plan. Width and depth of the box are
// already swapped by the turn button, so the rectangle is turned inside that footprint.
function turnRect(turn, box, r) {
  const wb = box.width;
  const db = box.depth;
  if (turn === 90) return { x: wb - r.z - r.d, z: r.x, w: r.d, d: r.w };
  if (turn === 180) return { x: wb - r.x - r.w, z: db - r.z - r.d, w: r.w, d: r.d };
  if (turn === 270) return { x: r.z, z: db - r.x - r.w, w: r.d, d: r.w };
  return { x: r.x, z: r.z, w: r.w, d: r.d };
}

function furnitureLocalParts(type, W, D) {
  const H = SHAPE_HEIGHTS[type];
  const small = Math.min(W, D);
  // [role, left, back, width, depth, bottom, top, extra]
  switch (type) {
    case 'sofa': {
      const arm = Math.max(MIN_PART, 0.1 * W);
      const back = Math.max(MIN_PART, 0.2 * D);
      return [
        ['seat', arm, back, W - 2 * arm, D - back, 0, H.seat],
        ['back', 0, 0, W, back, 0, H.back],
        ['arm', 0, back, arm, D - back, 0, H.arm],
        ['arm', W - arm, back, arm, D - back, 0, H.arm],
      ];
    }
    case 'bed': {
      const head = Math.max(MIN_PART, 0.06 * D);
      return [
        ['mattress', 0, head, W, D - head, 0, H.mattress],
        ['headboard', 0, 0, W, head, 0, H.headboard],
      ];
    }
    case 'table': {
      const leg = Math.max(MIN_PART, 0.06 * small);
      const under = H.top - H.topThickness;
      return [
        ['top', 0, 0, W, D, under, H.top],
        ['leg', 0, 0, leg, leg, 0, under],
        ['leg', W - leg, 0, leg, leg, 0, under],
        ['leg', 0, D - leg, leg, leg, 0, under],
        ['leg', W - leg, D - leg, leg, leg, 0, under],
      ];
    }
    case 'wardrobe':
      // The thin line sticks out 2 cm from the front face to show where the doors meet.
      return [
        ['body', 0, 0, W, D - 0.02, 0, H.body],
        ['doorline', W / 2 - 0.02, D - 0.04, MIN_PART, MIN_PART, 0, H.body],
      ];
    case 'desk': {
      const under = H.top - H.topThickness;
      const side = Math.max(MIN_PART, 0.05 * W);
      return [
        ['top', 0, 0, W, D, under, H.top],
        ['leg', 0, 0, side, D, 0, under],
        ['leg', W - side, 0, side, D, 0, under],
      ];
    }
    case 'bath': {
      // Four walls (the outer box, open on top) and a lower, lighter floor inside, so it looks hollow.
      const t = Math.max(MIN_PART, 0.1 * small);
      return [
        ['outer', 0, 0, W, t, 0, H.outer],
        ['outer', 0, D - t, W, t, 0, H.outer],
        ['outer', 0, t, t, D - 2 * t, 0, H.outer],
        ['outer', W - t, t, t, D - 2 * t, 0, H.outer],
        ['inner', t, t, W - 2 * t, D - 2 * t, 0, H.inner],
      ];
    }
    case 'kitchen unit':
      return [
        ['base', 0, 0, W, D, 0, H.base],
        ['worktop', 0, 0, W, D, H.base, H.worktop],
      ];
    default:
      return [];
  }
}

// A door or window: a frame around the panel the wall code already works out.
// Built along the wall (a) and across it (c), then put back into x and z.
function openingParts(box) {
  const alongX = box.wall === 'front' || box.wall === 'back';
  const L = alongX ? box.width : box.depth;
  const T = alongX ? box.depth : box.width;
  const H = box.height;
  const f = Math.min(FRAME, L / 3, H / 3);
  const inner = Math.max(L - 2 * f, 0);
  const isDoor = box.type === 'door';
  // [role, along, across, length, thickness, bottom, top]
  const leaf = Math.max(MIN_PART, T * 0.6);
  const mid = (T - leaf) / 2;
  const list = isDoor
    ? [
      ['frame', 0, 0, f, T, 0, H],
      ['frame', L - f, 0, f, T, 0, H],
      ['frame', f, 0, inner, T, H - f, H],
      ['leaf', f, mid, inner, leaf, 0, H - f],
    ]
    : [
      ['frame', 0, 0, f, T, 0, H],
      ['frame', L - f, 0, f, T, 0, H],
      ['frame', f, 0, inner, T, H - f, H],
      ['frame', f, 0, inner, T, 0, f],
      ['glass', f, (T - Math.max(MIN_PART, T * 0.3)) / 2, inner, Math.max(MIN_PART, T * 0.3), f, H - f],
    ];
  return list.map(([role, a, c, len, thick, y0, y1]) => (alongX
    ? { role, x: a, z: c, w: len, d: thick, y0, y1 }
    : { role, x: c, z: a, w: thick, d: len, y0, y1 }));
}

// The sub-boxes that make up one furniture, door or window box. [] means "draw the plain block".
// Each part is { key, role, x, y, z, width, height, depth, itemId, colour, clash, status },
// in the same metres as the box, and always inside the box's footprint.
export function shapeParts(box) {
  let rects;
  if (box.type === 'door' || box.type === 'window') {
    if (box.furnitureType !== box.type) return [];
    rects = openingParts(box);
  } else if (box.type === 'furniture' && SHAPE_HEIGHTS[box.furnitureType]
    && Object.hasOwn(SHAPE_HEIGHTS, box.furnitureType)) {
    const turn = [90, 180, 270].includes(box.turn) ? box.turn : 0;
    const swapped = turn === 90 || turn === 270;
    const W = swapped ? box.depth : box.width;
    const D = swapped ? box.width : box.depth;
    rects = furnitureLocalParts(box.furnitureType, W, D).map(([role, lx, lz, w, d, y0, y1]) => {
      const pw = Math.min(Math.max(w, MIN_PART), W);
      const pd = Math.min(Math.max(d, MIN_PART), D);
      const local = {
        x: Math.min(Math.max(lx, 0), W - pw), z: Math.min(Math.max(lz, 0), D - pd), w: pw, d: pd,
      };
      const t = turnRect(turn, box, local);
      return { role, x: t.x, z: t.z, w: t.w, d: t.d, y0, y1 };
    });
  } else {
    return [];
  }
  const counts = {};
  return rects.map((r) => {
    counts[r.role] = (counts[r.role] || 0) + 1;
    const part = {
      key: `${box.key}:${r.role}${counts[r.role]}`,
      role: r.role,
      x: round(box.x + r.x), y: round(box.y + r.y0), z: round(box.z + r.z),
      width: round(r.w), height: round(r.y1 - r.y0), depth: round(r.d),
      colour: box.colour,
      clash: box.clash,
    };
    if (box.itemId !== undefined) part.itemId = box.itemId;
    if (box.status !== undefined) part.status = box.status;
    if (r.role === 'glass') part.seeThrough = true;
    if (r.role === 'inner') part.lighter = true;
    return part;
  });
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

// The box in space (metres) that the camera must keep completely in view: every box,
// every floor label, plus a little room for the text of labels that sit above blocks.
export function viewBounds(boxes, labels = []) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const grow = (x, y, z) => {
    [x, y, z].forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); });
  };
  for (const b of boxes) {
    grow(b.x, b.y, b.z);
    grow(b.x + b.width, b.y + b.height, b.z + b.depth);
  }
  for (const l of labels) grow(l.x - 0.6, l.y, l.z);
  max[1] += 0.5;
  return { min, max };
}

// The starting camera: from the front, a little to the right and above, far enough back
// that all eight corners of the bounds land inside the picture (margin 0.9 means within
// 90% of the way from the middle to the edge). Pure maths, no Three.js.
export const START_DIRECTION = [0.3, 0.38, 1];

export function fitCamera(bounds, { fov = 45, aspect = 1.6, direction = START_DIRECTION, margin = 0.9 } = {}) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
  const centre = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
  const dir = unit(direction);
  const forward = dir.map((v) => -v);
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const tanHalf = Math.tan((fov * Math.PI) / 360);
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push([x, y, z]);
    }
  }
  const positionAt = (d) => centre.map((v, i) => v + dir[i] * d);
  const fits = (d) => {
    const pos = positionAt(d);
    return corners.every((c) => {
      const rel = c.map((v, i) => v - pos[i]);
      const depth = dot(rel, forward);
      if (depth <= 0.1) return false;
      return Math.abs(dot(rel, right)) / (depth * tanHalf * aspect) <= margin
        && Math.abs(dot(rel, up)) / (depth * tanHalf) <= margin;
    });
  };
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  return { position: positionAt(hi), target: centre, distance: hi };
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

    if (Array.isArray(item.marks) && (item.kind === 'light' || item.kind === 'electrical' || item.kind === 'decor')) {
      item.marks.forEach((m, n) => {
        const shared = { ...base, key: `item:${item.id}:${m.role}${n + 1}`, mark: m.role, noLabel: !(base.clash && n === 0) }; // small marks carry no text label (too many), except the first mark of an item in a clash
        if (m.role === 'light') {
          boxes.push({
            ...shared, type: 'light-marker',
            x: room.x + m.x - MARK.lightSize / 2, y: floor.elevation + L.wallHeight - MARK.lightThickness, z: room.z + m.y - MARK.lightSize / 2,
            width: MARK.lightSize, height: MARK.lightThickness, depth: MARK.lightSize,
          });
        } else if (m.role === 'rug') {
          boxes.push({
            ...shared, type: 'rug',
            x: room.x + m.x, y: floor.elevation, z: room.z + m.y, width: m.width, height: MARK.rugThickness, depth: m.depth,
          });
        } else {
          boxes.push({
            ...shared, type: m.role,
            x: room.x + m.x, y: floor.elevation + (typeof m.height === 'number' ? m.height : MARK.defaultHeight), z: room.z + m.y,
            width: Math.max(m.width || 0, MARK.pointSize), height: MARK.pointSize, depth: Math.max(m.depth || 0, MARK.pointSize),
          });
        }
      });
      continue;
    }
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
        const box = {
          ...base, type: item.kind, wall: panel.wall,
          x: room.x + panel.x, y: floor.elevation + (isDoor ? 0 : L.windowBottom), z: room.z + panel.z,
          width: panel.width, height: isDoor ? L.doorHeight : L.windowHeight, depth: panel.depth,
        };
        // A visitor's own project (own: true) or an item with a type gets the frame shape.
        // The sample has neither, so its doors and windows stay plain panels.
        if (item.type === item.kind || sampleRun.own === true) box.furnitureType = item.kind;
        boxes.push(box);
      } else {
        const box = {
          ...base, type: 'furniture',
          x: room.x + p.x, y: floor.elevation, z: room.z + p.y,
          width: p.width, height: L.furnitureHeight, depth: p.depth,
        };
        // Only a piece with a known type gets a shape. Its overall box is as tall as the shape.
        if (item.type !== undefined) {
          box.furnitureType = item.type;
          const tall = shapeHeight(item.type);
          if (tall) box.height = tall;
        }
        if (item.turn !== undefined) box.turn = item.turn;
        boxes.push(box);
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
