// Builds a Project Brain from the visitor's inputs and runs the design team on it.
// Pure logic: no page code, no file reading, no network. The browser and Node tests use the same file.
// It uses only the existing Brain functions and the existing Coordinator and agents (copied to docs/engine/).
//
// What goes into the Brain: the name, floors and rooms, the overall notes plus the style profile tags,
// the room override notes, the style items and the placed furniture, doors and windows. The brief, the profile sentences and the image count are
// kept as optional project fields. No agent reads them. Images themselves never enter the Brain.
import { createProject, createItem } from '../engine/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../engine/brain/inspiration.js';
import { runPipeline } from '../engine/coordinator.js';
import { AGENT_ORDER } from '../engine/agents/config.js';
import { styleAgent } from '../engine/agents/style/agent.js';
import { layoutAgent } from '../engine/agents/layout/agent.js';
import { builderAgent } from '../engine/agents/builder/agent.js';
import { createReviewerAgent } from '../engine/agents/reviewer/agent.js';
import { buildProfile } from './taste.js';
import { allImages } from './state.js';
import { STYLE_CONFLICTS } from './limits.js';
import { toBrainPosition } from './place-geometry.js';

const OWNER_FOR_KIND = { layout: 'Layout', door: 'Builder', window: 'Builder' };

// A fixed clock, so the same inputs always give the same versions. Same dates as the sample's clock.
function fixedClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
}

// All four agents switched on.
export function allOnConfigs() {
  return AGENT_ORDER.map((name) => ({ name, enabled: true }));
}

// The normal agents. The Style agent is the normal one, not the sample one that tries a Locked item.
export function defaultAgents() {
  return {
    Style: styleAgent,
    Layout: layoutAgent,
    Builder: builderAgent,
    Reviewer: createReviewerAgent({ styleConflicts: STYLE_CONFLICTS.map((pair) => [...pair]), isSample: false }),
  };
}

function unique(list) {
  return list.filter((entry, index) => list.indexOf(entry) === index);
}

// Build a Project Brain from the state of state.js. Does not change the state.
// Throws a plain error if the inputs cannot make a project (for example no floor).
export function buildBrain(state) {
  const profile = buildProfile(state.tasteAnswers, state.removedTags);
  const project = createProject({
    name: state.name,
    floors: state.floors.map((f) => ({ name: f.name, rooms: f.rooms.map((r) => ({ name: r.name, width: r.width, depth: r.depth })) })),
    brief: state.brief,
    styleProfile: profile.sentences,
    imageCount: allImages(state).length,
  });
  project.isSample = false;

  // Rooms are numbered in the order entered, so the state's room ids map onto the Brain's room ids by position.
  const roomId = {};
  state.floors.forEach((floor, fi) => {
    floor.rooms.forEach((room, ri) => {
      roomId[room.id] = project.floors[fi].rooms[ri].id;
    });
  });

  const overall = unique([...state.overall.notes, ...profile.tags]);
  if (overall.length > 0) setProjectInspiration(project, overall);

  for (const [stateRoomId, layer] of Object.entries(state.overrides)) {
    if (layer.notes.length > 0 && roomId[stateRoomId]) setRoomOverride(project, roomId[stateRoomId], unique(layer.notes));
  }

  for (const item of state.items) {
    const value = { detail: item.text };
    if (item.tag) value.tag = item.tag;
    createItem(project, { kind: 'style', owner: 'Style', status: item.status, room: roomId[item.room], value });
  }
  // Placed furniture, doors and windows. Lengths go from centimetres to metres here, once.
  // Furniture is a layout item (owner Layout); a door or window is a door or window item (owner Builder).
  for (const object of state.placed || []) {
    const position = toBrainPosition(object);
    const value = object.kind === 'layout'
      ? { name: object.name, type: object.type, turn: object.turn, position }
      : { name: object.name, position };
    createItem(project, {
      kind: object.kind,
      owner: OWNER_FOR_KIND[object.kind],
      status: object.status,
      room: roomId[object.room],
      value,
    });
  }
  createItem(project, {
    kind: 'clash',
    owner: 'Reviewer',
    status: 'Unsure',
    value: { summary: 'Not reviewed yet', clashes: [] },
  });
  return project;
}

// Run the Coordinator on a built Brain. Returns the Coordinator's result:
// { ok: true } or { ok: false, failedAgent, reason }.
// options.agents may replace single agents (for example in tests, or a later AI Style step).
export function runProject(project, options = {}) {
  const agents = { ...defaultAgents(), ...(options.agents || {}) };
  return runPipeline(project, { agents, configs: allOnConfigs(), now: fixedClock() });
}

// Build and run in one step.
// Success: { ok: true, project }.
// Failure: { ok: false, failedAgent, reason, project, inputs }. failedAgent names the agent (or is null
// if the Brain could not be built). inputs is the visitor's state, untouched, so nothing entered is lost.
export function runDesignTeam(state, options = {}) {
  let project;
  try {
    project = buildBrain(state);
  } catch (error) {
    return { ok: false, failedAgent: null, reason: error.message, project: null, inputs: state };
  }
  const result = runProject(project, options);
  if (!result.ok) return { ok: false, failedAgent: result.failedAgent, reason: result.reason, project, inputs: state };
  return { ok: true, project, inputs: state };
}
