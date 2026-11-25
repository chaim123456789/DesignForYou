// Slot items for the later agents of the design team (Group C): furniture pieces, one decor item per room, style notes and the
// Reviewer's report. Like team-slots.js (Group B), this is shared set-up code. It is not an agent and it decides nothing.
// Each item lists, in its basis, the earlier items it will be worked out from (design section 4.2), so a change to an earlier item
// makes exactly the items that used it stale.
//
// Call it AFTER createTeamSlots, with what that returned: createLaterSlots(project, made, { furniture, decor, style, reviewer }).
import { createItem } from './brain/brain.js';

const FURNITURE = 'Furniture';
const DECOR = 'Decor';
const STYLE = 'Style';
const REVIEWER = 'Reviewer';
const at = (id) => ({ itemId: id, version: 0 });
const rooms = (project) => project.floors.flatMap((f) => f.rooms);

// furniture: [{ room, name, type, position: { x, y, width, depth }, turn?, status? }] the user placed. A piece is based on its room's
//   wall, doors and windows, floor and electrical item.
// decor (default true): one decor item per room, based on the wall, windows, light and the room's furniture.
// style (default true): two style notes per room: one pointing at the floor, one pointing at the decor item.
// reviewer (default true): one report item, based on every other item.
// Returns { furniture: [ids], decor: { roomId: id }, styleFloor: { roomId: id }, styleDecor: { roomId: id }, clash: id | null }.
export function createLaterSlots(project, made, options = {}) {
  const { furniture = [], decor = true, style = true, reviewer = true } = options;
  const out = { furniture: [], decor: {}, styleFloor: {}, styleDecor: {}, clash: null };
  const list = rooms(project);
  const openingsIn = (roomId) => project.items.filter((i) => (i.kind === 'door' || i.kind === 'window') && i.room === roomId).map((i) => i.id);
  const windowsIn = (roomId) => project.items.filter((i) => i.kind === 'window' && i.room === roomId).map((i) => i.id);

  for (const f of furniture) {
    if (!made.walls[f.room]) throw new Error(`The ${f.type || 'piece'} "${f.name}" is in room "${f.room}", which does not exist.`);
    const basis = [made.walls[f.room], ...openingsIn(f.room), made.floors[f.room], made.electrical[f.room]];
    const value = { name: f.name, type: f.type, turn: f.turn === undefined ? 0 : f.turn, position: structuredClone(f.position) };
    out.furniture.push(createItem(project, { kind: 'layout', owner: FURNITURE, room: f.room, status: f.status, value, basis: basis.map(at) }).id);
  }
  const furnitureIn = (roomId) => project.items.filter((i) => i.kind === 'layout' && i.owner === FURNITURE && i.room === roomId).map((i) => i.id);

  if (decor) {
    for (const r of list) {
      const basis = [made.walls[r.id], ...windowsIn(r.id), made.lights[r.id], ...furnitureIn(r.id)];
      out.decor[r.id] = createItem(project, {
        kind: 'decor', owner: DECOR, room: r.id, value: { name: `Decor of ${r.name}`, state: 'not decided yet', rug: null, art: [], curtains: [] }, basis: basis.map(at),
      }).id;
    }
  }
  if (style) {
    for (const r of list) {
      out.styleFloor[r.id] = createItem(project, {
        kind: 'style', owner: STYLE, room: r.id, value: { name: `Style of the floor in ${r.name}`, state: 'not decided yet', target: made.floors[r.id], tag: null, detail: '' }, basis: [at(made.floors[r.id])],
      }).id;
      if (decor) {
        out.styleDecor[r.id] = createItem(project, {
          kind: 'style', owner: STYLE, room: r.id, value: { name: `Style of the decor in ${r.name}`, state: 'not decided yet', target: out.decor[r.id], tag: null, detail: '' }, basis: [at(out.decor[r.id])],
        }).id;
      }
    }
  }
  if (reviewer) {
    const everything = project.items.map((i) => i.id);
    out.clash = createItem(project, { kind: 'clash', owner: REVIEWER, value: { summary: 'Not reviewed yet', clashes: [] }, basis: everything.map(at) }).id;
  }
  return out;
}
