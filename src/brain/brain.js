// The Project Brain: project structure (floors and rooms).
// Items, versions and the gatekeeper are added in later tasks.

function requireName(value, what) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${what} needs a name.`);
  }
  return value.trim();
}

function buildRoom(floorId, roomData, index) {
  return {
    id: `${floorId}-room-${index + 1}`,
    name: requireName(roomData && roomData.name, 'A room'),
    order: index + 1,
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

// Create a project from plain data: { name, floors: [{ name, rooms: [{ name }] }] }.
// Order is the order given, so the same data always gives the same order.
export function createProject(data) {
  const name = requireName(data && data.name, 'A project');
  if (!Array.isArray(data.floors) || data.floors.length === 0) {
    throw new Error(`Project "${name}" needs at least one floor.`);
  }
  // inspiration is the overall set for the whole project (see inspiration.js).
  return { name, inspiration: [], floors: data.floors.map(buildFloor) };
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
