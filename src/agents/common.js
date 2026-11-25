// Small helpers shared by the design team's agents (Group B). Plain functions: no file reading, no clock, no randomness.
// An agent reads a frozen view of the Brain and returns proposals. It never writes.
//
// Plan coordinates, as in the place-items spec: metres, x across (0 at the west wall), y down (0 at the north wall).
// A room is as wide as `width` (west to east) and as deep as `depth` (north to south).

export const SIDES = Object.freeze(['north', 'south', 'west', 'east']);

// Round to a millimetre, so the same input always writes the same numbers.
export const mm = (n) => Math.round(n * 1000) / 1000;

// Rooms of the view in a flat list. neighbours: on one floor, rooms sit side by side in the order entered,
// so each room shares its east wall with the next room's west wall. This is an assumption made for the
// design team until floor plans can be uploaded (a later spec).
export function roomsOf(view) {
  const rooms = [];
  for (const floor of view.floors) {
    floor.rooms.forEach((r, index) => {
      rooms.push({ id: r.id, name: r.name, width: r.width, depth: r.depth, floorId: floor.id, floorName: floor.name, index, count: floor.rooms.length });
    });
  }
  return rooms;
}

export function neighboursOf(rooms, room) {
  const onFloor = rooms.filter((r) => r.floorId === room.floorId);
  return { west: onFloor.find((r) => r.index === room.index - 1) || null, east: onFloor.find((r) => r.index === room.index + 1) || null };
}

// The room's type from its name: the first known type whose name appears in the room's name ("Master Bedroom" is a bedroom).
// No match gives "other". knownTypes: the rules of shared/room-types.json.
export function roomTypeOf(roomName, knownTypes) {
  const lower = String(roomName).toLowerCase();
  const hit = knownTypes.map((r) => r.when.roomType).find((t) => lower.includes(t));
  return hit === undefined ? 'other' : hit;
}

export function isWetType(roomType, knownTypes) {
  const rule = knownTypes.find((r) => r.when.roomType === roomType);
  return rule ? rule.then.wet === true : false;
}

// The rule for a room type, or the "other" rule when the type has none. Returns undefined if neither exists.
export function ruleForType(rules, roomType) {
  return rules.find((r) => r.when.roomType === roomType) || rules.find((r) => r.when.roomType === 'other');
}

export const ruleById = (rules, id) => {
  const r = rules.find((x) => x.id === id);
  if (!r) throw new Error(`The knowledge file has no rule "${id}".`);
  return r;
};

// Items of one kind and owner that an agent may propose a change to: not Locked.
export const editable = (item) => item.status !== 'Locked';
export const itemsOf = (view, kind, owner) => view.items.filter((i) => i.kind === kind && i.owner === owner);

// In a re-check pass an agent looks only at its stale items. In the first pass it looks at all of them.
export const inScope = (item, context) => !context || context.mode !== 'recheck' || (context.staleItemIds || []).includes(item.id);

export const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const proposalId = (prefix, itemId, ruleId, mode) => `${prefix}:${itemId}:${ruleId}:${mode || 'first'}`;

// A room's size. The size the Walls agent decided (kept on the room's wall item) comes first, because every later agent works from
// the confirmed walls. Without a decision, the size the user entered. Without either, nothing: an agent does not guess a size.
export function sizeOf(room, wallItem) {
  const decided = wallItem && wallItem.value && wallItem.value.size;
  if (decided && decided.width > 0 && decided.depth > 0) return { width: decided.width, depth: decided.depth, from: decided.from };
  if (room.width > 0 && room.depth > 0) return { width: room.width, depth: room.depth, from: 'entered' };
  return null;
}

// The wall item of a room: one per room, kind wall, owner Walls.
export const wallItemOf = (view, roomId) => view.items.find((i) => i.kind === 'wall' && i.owner === 'Walls' && i.room === roomId);

// Which wall an opening (door or window) sits on, from its rectangle and the room size.
// An opening is "on" a wall when its edge is within `tolerance` metres of that wall. Returns the side or null,
// and the distance to every wall, so a caller can name the nearest one.
export function distancesToWalls(pos, size) {
  return {
    north: pos.y,
    south: size.depth - (pos.y + pos.depth),
    west: pos.x,
    east: size.width - (pos.x + pos.width),
  };
}
export function openingSide(pos, size, tolerance) {
  const d = distancesToWalls(pos, size);
  const hit = SIDES.filter((s) => Math.abs(d[s]) <= tolerance).sort((a, b) => Math.abs(d[a]) - Math.abs(d[b]) || SIDES.indexOf(a) - SIDES.indexOf(b));
  return hit.length > 0 ? hit[0] : null;
}

// For an opening on a wall: where it starts along the wall, how wide it is along the wall, how long the wall is.
export function alongWall(pos, size, side) {
  return side === 'north' || side === 'south'
    ? { start: pos.x, width: pos.width, wallLength: size.width }
    : { start: pos.y, width: pos.depth, wallLength: size.depth };
}

// Put an opening on a wall at a start along it. thickness: how deep the opening is across the wall.
export function placeOnWall(size, side, start, along, thickness) {
  const s = mm(start);
  const w = mm(along);
  const t = mm(thickness);
  if (side === 'north') return { x: s, y: 0, width: w, depth: t };
  if (side === 'south') return { x: s, y: mm(size.depth - t), width: w, depth: t };
  if (side === 'west') return { x: 0, y: s, width: t, depth: w };
  return { x: mm(size.width - t), y: s, width: t, depth: w };
}

export function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}
