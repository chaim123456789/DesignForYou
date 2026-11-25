// The design team's run for the visitor's own project (design-team D4). Pure logic: no page code, no file reading, no network.
// It builds a Project Brain from what the visitor entered, makes the empty "slots" the agents fill with proposals, and returns a
// session that the Review and run screen steps through, one agent at a time. Nothing changes until the visitor answers.
//
// Everything the page needs comes from docs/team/ (a copy of src/, made by npm run export-engine), so this file uses the very same
// agents, Coordinator and gatekeeper as the tests. The page has no file tools, so the knowledge files and the registry come from
// docs/team/data.js, a data module made from the files in src/knowledge/ and src/agents/registry.json.
// AI is off on this page (the cap is zero), so every result is Rule-based and the Style agent says "AI was not used".
import { createProject, createItem } from '../team/brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../team/brain/inspiration.js';
import { createRun } from '../team/team-coordinator.js';
import { createTeamSlots } from '../team/team-slots.js';
import { createLaterSlots } from '../team/team-slots-later.js';
import { validateRegistry } from '../team/agents/registry.js';
import { usePreloadedKnowledge } from '../team/knowledge/load.js';
import { createGate, OFF_BUDGET } from '../team/ai/gate.js';
import { standInProvider } from '../team/ai/stand-in.js';
import { makeWallsAgent } from '../team/agents/walls/agent.js';
import { makeDoorsWindowsAgent } from '../team/agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from '../team/agents/floors-ceilings/agent.js';
import { makeLightingElectricalAgent } from '../team/agents/lighting-electrical/agent.js';
import { makeFurnitureAgent } from '../team/agents/furniture/agent.js';
import { makeDecorAgent } from '../team/agents/decor/agent.js';
import { makeTeamStyleAgent, loadStyleKnowledge } from '../team/agents/team-style/agent.js';
import { makeTeamReviewerAgent } from '../team/agents/team-reviewer/agent.js';
import { makeTeamData } from '../team/viewer/make-team-data.js';
import { knowledge, registryData } from '../team/data.js';
import { buildProfile } from './taste.js';
import { allImages } from './state.js';
import { toBrainPosition } from './place-geometry.js';

// A fixed clock, so the same inputs always give the same versions. Same dates as the earlier runs.
function fixedClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
}

const unique = (list) => list.filter((entry, index) => list.indexOf(entry) === index);

// Build a Project Brain for the design team from the visitor's state. Does not change the state.
// Throws a plain error if the inputs cannot make a project (for example no floor).
export function buildTeamBrain(state) {
  const profile = buildProfile(state.tasteAnswers, state.removedTags);
  const project = createProject({
    name: state.name,
    floors: state.floors.map((f) => ({ name: f.name, rooms: f.rooms.map((r) => ({ name: r.name, width: r.width, depth: r.depth })) })),
    brief: state.brief,
    styleProfile: profile.sentences,
    imageCount: allImages(state).length,
  });
  project.isSample = false;

  const roomId = {};
  state.floors.forEach((floor, fi) => floor.rooms.forEach((room, ri) => { roomId[room.id] = project.floors[fi].rooms[ri].id; }));

  const overall = unique([...state.overall.notes, ...profile.tags]);
  if (overall.length > 0) setProjectInspiration(project, overall);
  for (const [stateRoomId, layer] of Object.entries(state.overrides)) {
    if (layer.notes.length > 0 && roomId[stateRoomId]) setRoomOverride(project, roomId[stateRoomId], unique(layer.notes));
  }

  // The visitor's own items are style items, with their Locked or Unsure tag, as before.
  for (const item of state.items) {
    const value = { name: item.text, detail: item.text };
    if (item.tag) value.tag = item.tag;
    createItem(project, { kind: 'style', owner: 'Style', status: item.status, room: roomId[item.room], value });
  }

  // Placed objects are the starting positions. Doors and windows go to Doors and windows, furniture to Furniture.
  const placed = state.placed || [];
  const openings = placed.filter((o) => o.kind === 'door' || o.kind === 'window')
    .map((o) => ({ kind: o.kind, room: roomId[o.room], name: o.name, status: o.status, position: toBrainPosition(o) }));
  const furniture = placed.filter((o) => o.kind === 'layout')
    .map((o) => ({ room: roomId[o.room], name: o.name, type: o.type, turn: o.turn, status: o.status, position: toBrainPosition(o) }));
  const slots = createTeamSlots(project, { openings });
  createLaterSlots(project, slots, { furniture });
  return project;
}

// The eight agents. AI is off: the gate has a cap of zero, so the Style agent keeps its rules and says "AI was not used".
export function makeTeamAgents(registry) {
  const style = loadStyleKnowledge();
  const gate = createGate({ budget: OFF_BUDGET, provider: standInProvider, vocabulary: style.families.flatMap((f) => f.then.tags) });
  return {
    gate,
    agents: {
      Walls: makeWallsAgent(),
      'Doors and windows': makeDoorsWindowsAgent(),
      'Floors and ceilings': makeFloorsCeilingsAgent(),
      'Lighting and electrical': makeLightingElectricalAgent(),
      Furniture: makeFurnitureAgent(),
      Decor: makeDecorAgent(),
      Style: makeTeamStyleAgent(style, { gate }),
      Reviewer: makeTeamReviewerAgent({ registry, styleKnowledge: style }),
    },
  };
}

// Start a run for the visitor. Returns { project, run, registry, gate, inputs }. Nothing has run yet: call run.next().
// options.scripted: answers come from a script (used by tests), not from the visitor.
export function createTeamSession(state, options = {}) {
  usePreloadedKnowledge(knowledge);
  const registry = validateRegistry(registryData);
  const project = buildTeamBrain(state);
  const { agents, gate } = makeTeamAgents(registry);
  const run = createRun(project, { registry, agents, now: fixedClock(), scripted: options.scripted === true });
  return { project, run, registry, gate, inputs: state };
}

// The result the result screen shows once the last agent has been answered. The team data holds the eight agents, their proposals and answers.
export function finishTeamSession(session) {
  return { ok: true, project: session.project, inputs: session.inputs, team: makeTeamData(session.project, session.run.steps, session.registry) };
}

// The failure the review screen shows: it names the agent that stopped. Everything entered is kept.
export function failedTeamSession(session) {
  const failure = session.run.failure;
  return { ok: false, failedAgent: failure.failedAgent, reason: failure.reason, project: session.project, inputs: session.inputs };
}
