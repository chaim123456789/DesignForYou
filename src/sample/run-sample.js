// Sample mode: loads the pre-run sample project and runs it through the normal
// Coordinator and the four real agents. There is no sample-only shortcut: this
// file only builds the Brain from the sample data and calls runPipeline.
// The only sample-specific parts are the data, the sample Style agent (which
// also tries a Locked item so the refusal shows), and the Reviewer's settings
// (the style conflict list and the sample flag) taken from sample-project.json.
import { readFileSync } from 'node:fs';
import { createProject, createItem } from '../brain/brain.js';
import { setProjectInspiration, setRoomOverride } from '../brain/inspiration.js';
import { runPipeline } from '../coordinator.js';
import { sampleStyleAgent } from '../agents/style/agent.js';
import { layoutAgent } from '../agents/layout/agent.js';
import { builderAgent } from '../agents/builder/agent.js';
import { createReviewerAgent } from '../agents/reviewer/agent.js';

export function readSampleData() {
  return JSON.parse(readFileSync(new URL('./sample-project.json', import.meta.url), 'utf8'));
}

// Build a normal Project Brain from the sample data. Items name their room;
// this turns the name into the room's id.
export function loadSampleProject(data = readSampleData()) {
  const project = createProject(data);
  project.isSample = data.isSample === true;
  setProjectInspiration(project, data.inspiration);
  const rooms = project.floors.flatMap((f) => f.rooms);
  const roomByName = (name) => {
    const room = rooms.find((r) => r.name === name);
    if (!room) throw new Error(`The sample refers to a room that does not exist: "${name}".`);
    return room;
  };
  for (const floor of data.floors) {
    for (const room of floor.rooms) {
      if (room.override) setRoomOverride(project, roomByName(room.name).id, room.override);
    }
  }
  for (const item of data.items) {
    const fields = { kind: item.kind, owner: item.owner, status: item.status, value: item.value };
    if (item.room) fields.room = roomByName(item.room).id;
    createItem(project, fields);
  }
  return project;
}

// A fixed clock, so two runs give identical versions (R7.7).
function fixedClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
}

// Load the sample and run it through the Coordinator.
// Returns { project, result }.
export function runSample() {
  const data = readSampleData();
  const project = loadSampleProject(data);
  const agents = {
    Style: sampleStyleAgent,
    Layout: layoutAgent,
    Builder: builderAgent,
    Reviewer: createReviewerAgent({ styleConflicts: data.styleConflicts, isSample: data.isSample === true }),
  };
  const result = runPipeline(project, { agents, now: fixedClock() });
  return { project, result };
}
