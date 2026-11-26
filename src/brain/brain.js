// The Project Brain: project structure (floors and rooms), items, versions.
// Changes to items after they are created go through gatekeeper.js.

function requireName(value, what) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${what} needs a name.`);
  }
  return value.trim();
}

// A room's size is optional. Width and depth (metres, numbers above 0) are kept only when given,
// so a room made with a name only is exactly as before.
function optionalRoomSize(roomData) {
  if (roomData.width === undefined && roomData.depth === undefined) return {};
  const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!ok(roomData.width) || !ok(roomData.depth)) {
    throw new Error(`The size of room "${roomData.name}" needs a width and a depth, both numbers above 0.`);
  }
  return { width: roomData.width, depth: roomData.depth };
}

function buildRoom(floorId, roomData, index) {
  return {
    id: `${floorId}-room-${index + 1}`,
    name: requireName(roomData && roomData.name, 'A room'),
    order: index + 1,
    ...optionalRoomSize(roomData),
  };
}

function buildFloor(floorData, index) {
  const name = requireName(floorData && floorData.name, 'A floor');
  const id = `floor-${index + 1}`;
  const roomsData = floorData.rooms;
  if (!Array.isArray(roomsData) || roomsData.length === 0) {
    throw new Error(`Floor "${name}" needs at least one room.`);
  }
  return {
    id,
    name,
    order: index + 1,
    rooms: roomsData.map((r, i) => buildRoom(id, r, i)),
  };
}

// Optional project fields, kept with the project for the visitor's own view.
// No agent reads them (a test checks this). They are only added when given,
// so a project made without them is exactly as before.
//   brief        : text
//   styleProfile : list of sentences
//   imageCount   : whole number, 0 or more
function optionalFields(data) {
  const extra = {};
  if (data.brief !== undefined) {
    if (typeof data.brief !== 'string') throw new Error('The brief must be text.');
    extra.brief = data.brief;
  }
  if (data.styleProfile !== undefined) {
    if (!Array.isArray(data.styleProfile) || data.styleProfile.some((s) => typeof s !== 'string')) {
      throw new Error('The style profile must be a list of sentences.');
    }
    extra.styleProfile = [...data.styleProfile];
  }
  if (data.imageCount !== undefined) {
    if (!Number.isInteger(data.imageCount) || data.imageCount < 0) {
      throw new Error('The image count must be a whole number, 0 or more.');
    }
    extra.imageCount = data.imageCount;
  }
  return extra;
}

// Create a project from plain data: { name, floors: [{ name, rooms: [{ name }] }] }.
// Order is the order given, so the same data always gives the same order.
// Optional: brief, styleProfile, imageCount (see optionalFields).
export function createProject(data) {
  const name = requireName(data && data.name, 'A project');
  if (!Array.isArray(data.floors) || data.floors.length === 0) {
    throw new Error(`Project "${name}" needs at least one floor.`);
  }
  // inspiration is the overall set for the whole project (see inspiration.js).
  // items, itemStarts, versions and runLog are the rest of the Brain (see below).
  return {
    name,
    inspiration: [],
    floors: data.floors.map(buildFloor),
    items: [],
    itemStarts: {},
    versions: [],
    runLog: [],
    ...optionalFields(data),
  };
}

// Add a floor (with at least one room) to an existing project.
export function addFloor(project, floorData) {
  if (!project || !Array.isArray(project.floors)) {
    throw new Error('A floor needs a project. No project was given.');
  }
  const floor = buildFloor(floorData, project.floors.length);
  project.floors.push(floor);
  return floor;
}

// Add a room to an existing floor of a project.
export function addRoom(project, floorId, roomData) {
  if (!project || !Array.isArray(project.floors)) {
    throw new Error('A room needs a project. No project was given.');
  }
  const floor = project.floors.find((f) => f.id === floorId);
  if (!floor) {
    throw new Error(
      floorId ? `A room needs a floor. Floor "${floorId}" does not exist.` : 'A room needs a floor. No floor was given.'
    );
  }
  const room = buildRoom(floor.id, roomData, floor.rooms.length);
  floor.rooms.push(room);
  return room;
}

// Find a room by id anywhere in the project. Returns undefined if not found.
export function findRoom(project, roomId) {
  for (const floor of project.floors) {
    const room = floor.rooms.find((r) => r.id === roomId);
    if (room) return room;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Items: kind, room, value, status and exactly one owner.
// ---------------------------------------------------------------------------

export const STATUSES = Object.freeze(['Locked', 'Unsure']);
// The old four-agent path (kept for the existing sample and its tests).
export const KIND_OWNER = Object.freeze({
  style: 'Style',
  layout: 'Layout',
  door: 'Builder',
  window: 'Builder',
  clash: 'Reviewer',
});

// The design team path (design-team spec, R2.2): which agent owns which kind of item.
// "layout" stays the kind name for furniture, so old projects still load.
export const TEAM_KIND_OWNER = Object.freeze({
  wall: 'Walls',
  door: 'Doors and windows',
  window: 'Doors and windows',
  floor: 'Floors and ceilings',
  ceiling: 'Floors and ceilings',
  light: 'Lighting and electrical',
  electrical: 'Lighting and electrical',
  layout: 'Furniture',
  decor: 'Decor',
  style: 'Style',
  clash: 'Reviewer',
});

// Every agent name that may own an item: the old four and the design team's eight (derived, not typed again here).
export const OWNERS = Object.freeze([...new Set([...Object.values(KIND_OWNER), ...Object.values(TEAM_KIND_OWNER)])]);

// Who may own a kind: the old owner (existing projects) or the design team's owner. An item still has exactly one owner.
function ownersForKind(kind) {
  const owners = [KIND_OWNER[kind], TEAM_KIND_OWNER[kind]].filter((o, i, all) => o !== undefined && all.indexOf(o) === i);
  if (owners.length === 0) {
    const kinds = [...new Set([...Object.keys(KIND_OWNER), ...Object.keys(TEAM_KIND_OWNER)])];
    throw new Error(`Unknown kind "${kind}". Kinds are: ${kinds.join(', ')}.`);
  }
  return owners;
}

// The old path's owner of a kind (unchanged).
export function ownerForKind(kind) {
  const owner = KIND_OWNER[kind];
  if (!owner) {
    throw new Error(`Unknown kind "${kind}". Kinds are: ${Object.keys(KIND_OWNER).join(', ')}.`);
  }
  return owner;
}

// The design team's owner of a kind (R2.2).
export function teamOwnerForKind(kind) {
  const owner = TEAM_KIND_OWNER[kind];
  if (!owner) {
    throw new Error(`Unknown kind "${kind}". Kinds are: ${Object.keys(TEAM_KIND_OWNER).join(', ')}.`);
  }
  return owner;
}

// ---------------------------------------------------------------------------
// Optional fields for the design team: basis, source, approvedBy.
//   basis      : [{ itemId, version }] the earlier items this one was worked out from
//   source     : 'rule' or 'ai' (where the value came from)
//   approvedBy : 'user', 'scripted answer' or 'auto-confirmed' (who said yes to the change). 'auto-confirmed' means the user chose, in the
//                agent settings, that this kind of proposal is confirmed for them. It is only a label: the gatekeeper's checks do not change.
// They are only stored when given, so old items and versions look exactly as before.
// ---------------------------------------------------------------------------
export const SOURCES = Object.freeze(['rule', 'ai']);
export const APPROVERS = Object.freeze(['user', 'scripted answer', 'auto-confirmed']);

export function checkBasis(project, basis, ownItemId) {
  if (!Array.isArray(basis)) throw new Error('A basis must be a list of { itemId, version }.');
  for (const b of basis) {
    if (!b || typeof b !== 'object' || typeof b.itemId !== 'string' || !Number.isInteger(b.version) || b.version < 0) {
      throw new Error('Each basis entry needs an itemId and a version (a whole number, 0 or more).');
    }
    if (b.itemId === ownItemId) throw new Error(`An item cannot be based on itself ("${b.itemId}").`);
    if (!project.items.some((i) => i.id === b.itemId)) throw new Error(`The basis names item "${b.itemId}", which does not exist.`);
    if (b.version > project.versions.length) throw new Error(`The basis names version ${b.version}, which does not exist yet.`);
  }
  return basis.map((b) => ({ itemId: b.itemId, version: b.version }));
}

export function checkApprovedBy(approvedBy) {
  if (!APPROVERS.includes(approvedBy)) {
    throw new Error(`approvedBy "${approvedBy}" is not allowed. Use: ${APPROVERS.join(' or ')}.`);
  }
  return approvedBy;
}

function requireProject(project, what) {
  if (!project || !Array.isArray(project.items) || !Array.isArray(project.versions)) {
    throw new Error(`${what} needs a project. No project was given.`);
  }
}

// Create an item. data: { kind, value, owner, status?, room? }.
// Status defaults to Unsure. The owner must be given, must be exactly one
// agent, and must be the agent that owns this kind of item.
export function createItem(project, data) {
  requireProject(project, 'An item');
  const d = data || {};
  const allowedOwners = ownersForKind(d.kind);

  if (d.owner === undefined || d.owner === null || d.owner === '') {
    throw new Error('An item needs an owner. No owner was given.');
  }
  if (Array.isArray(d.owner)) {
    throw new Error('An item needs exactly one owner. More than one owner was given.');
  }
  if (!OWNERS.includes(d.owner)) {
    throw new Error(`Owner "${d.owner}" is not an agent. Owners are: ${OWNERS.join(', ')}.`);
  }
  if (!allowedOwners.includes(d.owner)) {
    const more = allowedOwners.length > 1 ? ` (in the design team it is ${allowedOwners.slice(1).join(' or ')})` : '';
    throw new Error(`A ${d.kind} item is owned by ${allowedOwners[0]}, not ${d.owner}${more}.`);
  }

  const status = d.status === undefined ? 'Unsure' : d.status;
  if (!STATUSES.includes(status)) {
    throw new Error(`Status "${status}" is not allowed. Use Locked or Unsure.`);
  }
  if (d.value === undefined) {
    throw new Error('An item needs a value.');
  }
  if (d.room !== undefined && !findRoom(project, d.room)) {
    throw new Error(`Room "${d.room}" does not exist.`);
  }
  const id = `item-${project.items.length + 1}`;
  const basis = d.basis === undefined ? undefined : checkBasis(project, d.basis, id);
  if (d.source !== undefined && !SOURCES.includes(d.source)) {
    throw new Error(`Source "${d.source}" is not allowed. Use rule or ai.`);
  }

  const item = {
    id,
    kind: d.kind,
    value: structuredClone(d.value),
    status,
    owner: d.owner,
  };
  if (d.room !== undefined) item.room = d.room;
  if (basis !== undefined) item.basis = basis;
  if (d.source !== undefined) item.source = d.source;

  project.items.push(item);
  // Remember the starting state so past versions can be replayed (Task 7).
  project.itemStarts[item.id] = {
    value: structuredClone(item.value),
    status,
    createdAtVersion: project.versions.length,
    ...(basis !== undefined ? { basis: structuredClone(basis) } : {}),
  };
  return item;
}

export function getItem(project, itemId) {
  requireProject(project, 'Reading an item');
  return project.items.find((i) => i.id === itemId);
}

// ---------------------------------------------------------------------------
// Version history: append-only. There is no function to edit or remove an entry.
// ---------------------------------------------------------------------------

// Add the next version. Only the gatekeeper should call this.
// entry: { who, itemId, field ('value' or 'status'), oldValue, newValue, time?, approvedBy?, basis? }
export function appendVersion(project, entry) {
  requireProject(project, 'A version');
  const version = Object.freeze({
    number: project.versions.length + 1,
    time: entry.time || new Date().toISOString(),
    who: entry.who,
    item: entry.itemId,
    field: entry.field || 'value',
    oldValue: structuredClone(entry.oldValue),
    newValue: structuredClone(entry.newValue),
    ...(entry.approvedBy !== undefined ? { approvedBy: entry.approvedBy } : {}),
    ...(entry.basis !== undefined ? { basis: structuredClone(entry.basis) } : {}),
  });
  project.versions.push(version);
  return version;
}

// All versions in order. Returns copies, so the history cannot be changed through them.
export function listVersions(project) {
  requireProject(project, 'Listing versions');
  return project.versions.map((v) => Object.freeze(structuredClone(v)));
}

// ---------------------------------------------------------------------------
// Viewing the Brain as it was at a past version (read only).
// ---------------------------------------------------------------------------

// Replays versions 1 to N over each item's starting state. Works on copies,
// so the current Brain and its history are not touched.
// Returns { name, version, items }. Version 0 is the state before any change.
export function getBrainAtVersion(project, number) {
  requireProject(project, 'Viewing a past version');
  if (!Number.isInteger(number) || number < 0 || number > project.versions.length) {
    throw new Error(`Version ${number} does not exist. Versions go from 0 to ${project.versions.length}.`);
  }

  const items = project.items
    .filter((item) => project.itemStarts[item.id].createdAtVersion <= number)
    .map((item) => {
      const start = project.itemStarts[item.id];
      const past = { ...structuredClone(item), value: structuredClone(start.value), status: start.status };
      // The basis, like the value, is shown as it was at the start; versions below put later bases back.
      if (start.basis !== undefined) past.basis = structuredClone(start.basis);
      else delete past.basis;
      return past;
    });
  const byId = new Map(items.map((i) => [i.id, i]));

  for (const v of project.versions.slice(0, number)) {
    const item = byId.get(v.item);
    if (item) {
      item[v.field] = structuredClone(v.newValue);
      if (v.basis !== undefined) item.basis = structuredClone(v.basis);
    }
  }
  return { name: project.name, version: number, items };
}
