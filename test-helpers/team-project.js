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

// ---- Group C helpers: a made-up project with furniture, decor, style and a report slot, run through the first four agents.
import { createLaterSlots } from '../src/team-slots-later.js';
import { runWithScript } from '../src/team-coordinator.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeWallsAgent } from '../src/agents/walls/agent.js';
import { makeDoorsWindowsAgent } from '../src/agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from '../src/agents/floors-ceilings/agent.js';
import { makeLightingElectricalAgent } from '../src/agents/lighting-electrical/agent.js';

export const registry = loadRegistry();
export const off = (names) => names.map((name) => ({ name, enabled: false }));
export const firstFour = () => ({
  Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent(), 'Floors and ceilings': makeFloorsCeilingsAgent(), 'Lighting and electrical': makeLightingElectricalAgent(),
});
export const piece = (room, type, name, x, y, width, depth, extra = {}) => ({ room, type, name, position: { x, y, width, depth }, ...extra });

// spec: { rooms | floors, openings, furniture, later: { decor, style, reviewer } }. The first four agents have run (scripted) when this returns.
export function buildLater(spec) {
  const t = buildTeam({ rooms: spec.rooms, floors: spec.floors, openings: spec.openings || [] });
  t.later = createLaterSlots(t.project, t.slots, { furniture: spec.furniture || [], ...(spec.later || {}) });
  const r = runWithScript(t.project, { registry, now: NOW, agents: firstFour(), configs: off(['Furniture', 'Decor', 'Style']) });
  if (!r.ok) throw new Error(`The first four agents failed: ${r.failure && r.failure.reason}`);
  return t;
}

// Say "still fine" for every item of the later agents, as a re-check would, so the next change shows only what it makes stale.
import { createGatekeeper } from '../src/brain/gatekeeper.js';
export function settle(project) {
  const gate = createGatekeeper(project, { now: NOW });
  for (const item of project.items) {
    if (item.basis && ['Furniture', 'Decor', 'Style', 'Reviewer'].includes(item.owner)) {
      gate.refreshBasis(item.owner, item.id, item.basis.map((b) => ({ itemId: b.itemId, version: project.versions.length })));
    }
  }
}
