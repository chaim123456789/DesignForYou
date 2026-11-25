// Made-up projects for the design-team tests (Group B). Not part of the app.
import { createProject } from '../src/brain/brain.js';
import { createTeamSlots } from '../src/team-slots.js';
import { makeReadOnlyView } from '../src/coordinator.js';

export const NOW = () => '2026-01-01T00:00:00.000Z';

// rooms: [{ name, width?, depth? }] on one floor (or pass floors). openings: see createTeamSlots.
export function buildTeam({ rooms, floors, openings = [] }) {
  const project = createProject({ name: 'Home', floors: floors || [{ name: 'Ground', rooms }] });
  const slots = createTeamSlots(project, { openings });
  return { project, slots };
}

export const view = (project) => makeReadOnlyView(project);

// A view that also holds items of the given LATER kinds. Reading anything but `kind` from such an item throws,
// so a test fails if an agent reads a later agent's item.
export function viewWithPoison(project, kinds) {
  const v = structuredClone(project);
  v.items = v.items.map((i) => (kinds.includes(i.kind) ? poisoned(i.kind) : i));
  for (const kind of kinds) v.items.push(poisoned(kind));
  return v;
}
function poisoned(kind) {
  const boom = (field) => () => { throw new Error(`An agent read "${field}" of a ${kind} item, which belongs to a later agent.`); };
  const item = { kind };
  for (const f of ['id', 'owner', 'status', 'room', 'value', 'basis']) Object.defineProperty(item, f, { get: boom(f), enumerable: true });
  return item;
}

export const door = (room, x, y, extra = {}) => ({ kind: 'door', room, name: extra.name || 'Door', position: { x, y, width: extra.width ?? 0.9, depth: extra.depth ?? 0.1 }, ...(extra.status ? { status: extra.status } : {}) });
export const windowAt = (room, x, y, width = 1.2) => ({ kind: 'window', room, name: 'Window', position: { x, y, width, depth: 0.1 } });
