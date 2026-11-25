// Slot items for the design team (Group B). A proposal can only change an item that already exists, so before the
// team runs, each room gets one empty "slot" item per kind of work the agents decide: walls, a ceiling, a floor, a light
// and an electrical item, and a window slot when the room has no window of its own. The agents fill the slots with
// proposals, and the gatekeeper writes the answers. A slot is not a decision: its value says "not decided yet".
//
// The basis of each slot lists the earlier items it will be worked out from (design section 4.2), so a change to a wall
// makes exactly the items that depend on it stale. A user's placed doors and windows are created here too, because
// their basis (the wall of their room) must exist first.
//
// This file is shared set-up code. It is not an agent and it writes no decision.
import { createItem } from './brain/brain.js';

const WALLS = 'Walls';
const DOORS = 'Doors and windows';
const FLOORS = 'Floors and ceilings';
const LIGHTS = 'Lighting and electrical';

const rooms = (project) => project.floors.flatMap((f) => f.rooms.map((r, index) => ({ ...r, floorId: f.id, index })));
const at = (id) => ({ itemId: id, version: 0 });

// openings: [{ kind: 'door' | 'window', room: roomId, name, position: { x, y, width, depth }, status? }] the user placed.
// Returns the ids made, by room: { walls, ceilings, floors, lights, electrical, windows (slots), openings }.
export function createTeamSlots(project, { openings = [] } = {}) {
  const made = { walls: {}, ceilings: {}, floors: {}, lights: {}, electrical: {}, windowSlots: {}, openings: [] };
  const list = rooms(project);
  const slot = (kind, owner, room, name, extra, basis) => createItem(project, {
    kind, owner, room: room.id, value: { name, state: 'not decided yet', ...extra }, basis: basis.length ? basis.map(at) : undefined,
  }).id;

  for (const r of list) made.walls[r.id] = slot('wall', WALLS, r, `Walls of ${r.name}`, { segments: [] }, []);
  for (const r of list) made.ceilings[r.id] = slot('ceiling', FLOORS, r, `Ceiling of ${r.name}`, { height: null }, [made.walls[r.id]]);

  for (const o of openings) {
    if (!made.walls[o.room]) throw new Error(`The ${o.kind} "${o.name}" is in room "${o.room}", which does not exist.`);
    const id = createItem(project, {
      kind: o.kind, owner: DOORS, room: o.room, status: o.status, value: { name: o.name, position: structuredClone(o.position) }, basis: [at(made.walls[o.room])],
    }).id;
    made.openings.push(id);
  }
  const doorsIn = (room) => project.items.filter((i) => i.kind === 'door' && i.room === room.id).map((i) => i.id);
  const windowsIn = (room) => project.items.filter((i) => i.kind === 'window' && i.room === room.id && i.value.position).map((i) => i.id);
  for (const r of list) {
    if (windowsIn(r).length === 0) made.windowSlots[r.id] = slot('window', DOORS, r, `Window for ${r.name}`, { placeholder: true }, [made.walls[r.id]]);
  }
  // A threshold lives on the floor of the later room of a pair, so a floor is based on the floor before it only when a door
  // joins the two rooms (a door on the east edge of the first room or the west edge of the second). Needs entered sizes.
  const TOUCH = 0.05; // metres: how close to an edge an opening must be to count as on that wall
  const doorJoins = (a, b) => project.items.some((i) => {
    if (i.kind !== 'door' || !i.value.position) return false;
    const p = i.value.position;
    return (i.room === a.id && a.width > 0 && p.x + p.width >= a.width - TOUCH) || (i.room === b.id && p.x <= TOUCH);
  });
  for (const r of list) {
    const before = list.find((o) => o.floorId === r.floorId && o.index === r.index - 1);
    const joined = before && doorJoins(before, r) ? [made.floors[before.id]] : [];
    made.floors[r.id] = slot('floor', FLOORS, r, `Floor of ${r.name}`, { surface: null, thresholds: [] }, [made.walls[r.id], ...doorsIn(r), ...joined]);
  }
  for (const r of list) {
    const own = [made.walls[r.id], ...doorsIn(r), ...windowsIn(r), ...(made.windowSlots[r.id] ? [made.windowSlots[r.id]] : []), made.ceilings[r.id]];
    made.lights[r.id] = slot('light', LIGHTS, r, `Lights of ${r.name}`, { fixtures: [] }, own);
    made.electrical[r.id] = slot('electrical', LIGHTS, r, `Switches and sockets of ${r.name}`, { switches: [], sockets: [] }, [...own, made.lights[r.id]]);
  }
  return made;
}
