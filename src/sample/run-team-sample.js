// Sample mode for the eight-agent design team (design-team D6). It builds the sample home from team-sample-project.json and runs it
// through the step Coordinator and the eight real agents, with scripted answers: the first option of every proposal, except one
// suggestion that is skipped on purpose (named in the data file). There is no sample-only shortcut: the agents, the gatekeeper and the
// Coordinator are the same as for a visitor's project. AI is off (the cap is zero), so every result is Rule-based.
//
// The old four-agent sample (run-sample.js, runPipeline, Layout and Builder) is not deleted. It is no longer used for the sample files.
import { readFileSync } from 'node:fs';
import { createProject, createItem } from '../brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../brain/inspiration.js';
import { createRun } from '../team-coordinator.js';
import { createTeamSlots } from '../team-slots.js';
import { createLaterSlots } from '../team-slots-later.js';
import { loadRegistry } from '../agents/registry.js';
import { createGate, loadBudget } from '../ai/gate.js';
import { standInProvider } from '../ai/stand-in.js';
import { makeWallsAgent } from '../agents/walls/agent.js';
import { makeDoorsWindowsAgent } from '../agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from '../agents/floors-ceilings/agent.js';
import { makeLightingElectricalAgent } from '../agents/lighting-electrical/agent.js';
import { makeFurnitureAgent } from '../agents/furniture/agent.js';
import { makeDecorAgent } from '../agents/decor/agent.js';
import { makeTeamStyleAgent, loadStyleKnowledge } from '../agents/team-style/agent.js';
import { makeTeamReviewerAgent } from '../agents/team-reviewer/agent.js';
import { makeTeamData } from '../viewer/make-team-data.js';
import { makeSampleRun, readViewerLayout } from '../viewer/make-sample-run.js';

export function readTeamSampleData() {
  return JSON.parse(readFileSync(new URL('./team-sample-project.json', import.meta.url), 'utf8'));
}

// A fixed clock, so two runs give identical versions. The same dates as the old sample.
function fixedClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
}

// Build the sample's Project Brain, with the slots the agents fill. Items name their room; this turns the name into the room's id.
export function loadTeamSampleProject(data = readTeamSampleData()) {
  const project = createProject({ name: data.name, floors: data.floors.map((f) => ({ name: f.name, rooms: f.rooms.map((r) => ({ name: r.name, width: r.width, depth: r.depth })) })) });
  project.isSample = data.isSample === true;
  setProjectInspiration(project, data.inspiration);
  const rooms = project.floors.flatMap((f) => f.rooms);
  const roomId = (name) => {
    const room = rooms.find((r) => r.name === name);
    if (!room) throw new Error(`The sample refers to a room that does not exist: "${name}".`);
    return room.id;
  };
  for (const floor of data.floors) for (const room of floor.rooms) if (room.override) setRoomOverride(project, roomId(room.name), room.override);
  for (const s of data.styleItems) createItem(project, { kind: 'style', owner: 'Style', status: s.status, room: roomId(s.room), value: structuredClone(s.value) });
  const slots = createTeamSlots(project, { openings: data.openings.map((o) => ({ ...structuredClone(o), room: roomId(o.room) })) });
  createLaterSlots(project, slots, { furniture: data.furniture.map((f) => ({ ...structuredClone(f), room: roomId(f.room) })) });
  return project;
}

export function teamSampleAgents(registry) {
  const style = loadStyleKnowledge();
  // AI is off: the budget file's cap is zero, so the Style agent keeps its rules and says "AI was not used".
  const gate = createGate({ budget: loadBudget(), provider: standInProvider, vocabulary: style.families.flatMap((f) => f.then.tags) });
  return {
    Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent(), 'Floors and ceilings': makeFloorsCeilingsAgent(),
    'Lighting and electrical': makeLightingElectricalAgent(), Furniture: makeFurnitureAgent(), Decor: makeDecorAgent(),
    Style: makeTeamStyleAgent(style, { gate }), Reviewer: makeTeamReviewerAgent({ registry, styleKnowledge: style, reviewerOptions: { isSample: true } }),
  };
}

// Run the sample. Returns { project, result: { ok, failedAgent?, reason? }, run, team }.
export function runTeamSample() {
  const data = readTeamSampleData();
  const registry = loadRegistry();
  const project = loadTeamSampleProject(data);
  const run = createRun(project, { registry, agents: teamSampleAgents(registry), now: fixedClock(), scripted: true });
  const skip = data.script && data.script.skip;
  const nameOf = (id) => { const i = project.items.find((x) => x.id === id); return i && i.value ? i.value.name : undefined; };
  for (let step = run.next(); !step.done; step = run.next()) {
    for (const p of step.proposals) {
      const skipIt = skip && p.agent === skip.agent && nameOf(p.itemId) === skip.itemName;
      run.answer(p.id, skipIt ? 'skip' : p.options[0].id);
    }
  }
  const result = run.failure ? { ok: false, failedAgent: run.failure.failedAgent, reason: run.failure.reason } : { ok: true };
  return { project, result, run, team: makeTeamData(project, run.steps, registry) };
}

// The viewer's fixed numbers (viewer-layout.json), with each room drawn at the size the Walls agent decided. A wall the user agreed
// to move (for example the kitchen made wider for the kitchen units) is drawn where it now is. A room with no decided size keeps
// the fixed size. layout: the parsed viewer-layout.json.
export function teamSampleLayout(project, layout) {
  const rooms = { ...layout.rooms };
  for (const floor of project.floors) {
    for (const room of floor.rooms) {
      const wall = project.items.find((i) => i.kind === 'wall' && i.room === room.id);
      const size = wall && wall.value && wall.value.size;
      if (size && size.width > 0 && size.depth > 0) rooms[room.name] = { width: size.width, depth: size.depth };
    }
  }
  return { ...layout, rooms };
}

// The data the viewer reads (docs/sample-run.json): the finished sample, its team part, at the decided room sizes.
export function makeTeamSampleRun(sample = runTeamSample()) {
  return makeSampleRun(sample.project, teamSampleLayout(sample.project, readViewerLayout()), { team: sample.team });
}
