// The Group C checkpoint run (design-team C5 and C6): a made-up two-room project goes through all eight agents with the step
// Coordinator, every proposal is answered by a scripted answer (the first option, except one skipped), and then a wall is moved
// by a second scripted run so the ripple can be seen. renderGroupCDemo() returns the whole run as plain text.
// Nothing here is the sample and nothing is saved by this file.
import { createProject, createItem } from './brain/brain.js';
import { setProjectInspiration } from './brain/inspiration.js';
import { createRun, SCRIPTED } from './team-coordinator.js';
import { createTeamSlots } from './team-slots.js';
import { createLaterSlots } from './team-slots-later.js';
import { loadRegistry } from './agents/registry.js';
import { findStale } from './ripple.js';
import { buildProposal } from './proposal.js';
import { DRAFT_STATEMENT, sourceTag } from './label.js';
import { loadKnowledge } from './knowledge/load.js';
import { listKnowledgeFiles } from './viewer/engine-files.js';
import { makeWallsAgent } from './agents/walls/agent.js';
import { makeDoorsWindowsAgent } from './agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from './agents/floors-ceilings/agent.js';
import { makeLightingElectricalAgent } from './agents/lighting-electrical/agent.js';
import { makeFurnitureAgent } from './agents/furniture/agent.js';
import { makeDecorAgent } from './agents/decor/agent.js';
import { makeTeamStyleAgent } from './agents/team-style/agent.js';
import { makeTeamReviewerAgent } from './agents/team-reviewer/agent.js';

export const FIXED_TIME = '2026-11-25T12:00:00.000Z';
export const LIVING = 'floor-1-room-1';
export const BEDROOM = 'floor-2-room-1';
const TITLE = 'DESIGN TEAM: GROUP C CHECKPOINT RUN (a made-up project, not the sample)';

const piece = (room, type, name, x, y, width, depth, extra = {}) => ({ room, type, name, position: { x, y, width, depth }, ...extra });

// Two rooms on two floors, so a change to one room's wall must not touch the other room.
export function buildGroupCProject() {
  const project = createProject({
    name: 'Made-up two-room home',
    floors: [{ name: 'Ground', rooms: [{ name: 'Living Room', width: 5, depth: 4 }] }, { name: 'Upper', rooms: [{ name: 'Bedroom', width: 2.4, depth: 3 }] }],
  });
  setProjectInspiration(project, ['warm oak', 'quiet mornings']);
  const slots = createTeamSlots(project, {
    openings: [
      { kind: 'door', room: LIVING, name: 'Living room door', position: { x: 3.5, y: 0, width: 0.9, depth: 0.1 } },
      { kind: 'window', room: LIVING, name: 'Living room window', position: { x: 1.5, y: 3.9, width: 1.2, depth: 0.1 } },
      { kind: 'door', room: BEDROOM, name: 'Bedroom door', position: { x: 1.4, y: 0, width: 0.9, depth: 0.1 } },
      { kind: 'window', room: BEDROOM, name: 'Bedroom window', position: { x: 0.6, y: 2.9, width: 1.2, depth: 0.1 } },
    ],
  });
  const later = createLaterSlots(project, slots, {
    furniture: [
      piece(LIVING, 'sofa', 'Sofa', 1.2, 0, 2, 0.9),
      piece(LIVING, 'table', 'Coffee table', 1.4, 1.5, 1.2, 0.6),
      piece(LIVING, 'table', 'Side table', 1.6, 0.5, 1.2, 0.6), // overlaps the sofa: its suggestion is the one that is skipped
      piece(LIVING, 'desk', 'Locked desk', 4.6, 3, 1.2, 0.6, { status: 'Locked' }), // sticks out of the room, but is Locked
      piece(BEDROOM, 'sofa', 'Long sofa', 0, 2.1, 2.8, 0.9), // longer than the room: a request to Walls
      piece(BEDROOM, 'desk', 'Desk', 0.1, 0.2, 1, 0.6),
    ],
  });
  return { project, slots, later, skipId: later.furniture[2], lockedId: later.furniture[3] };
}

export function groupCAgents(registry = loadRegistry()) {
  return {
    Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent(), 'Floors and ceilings': makeFloorsCeilingsAgent(),
    'Lighting and electrical': makeLightingElectricalAgent(), Furniture: makeFurnitureAgent(), Decor: makeDecorAgent(),
    Style: makeTeamStyleAgent(), Reviewer: makeTeamReviewerAgent({ registry }),
  };
}

// A stand-in Walls agent for the second run: it makes the Living Room 0.3 m wider. Nothing else changes.
export function makeWallMoveAgent(slots, roomId = LIVING, extra = 0.3) {
  return (view) => {
    const item = view.items.find((i) => i.id === slots.walls[roomId]);
    const v = structuredClone(item.value);
    v.size = { ...v.size, width: Math.round((v.size.width + extra) * 1000) / 1000, from: 'moved wall' };
    for (const s of v.segments) if (s.side === 'north' || s.side === 'south') s.length = v.size.width;
    return [buildProposal({
      id: `move:${item.id}`, agent: 'Walls', itemId: item.id, why: `The wall of the Living Room is moved ${extra} m.`, source: 'rule', ruleId: 'walls-segments-from-size',
      confidence: 'high', options: [{ id: 'moved', label: `Move the wall ${extra} m`, newValue: v }],
    }, { items: view.items.filter((i) => i.kind === 'wall') })];
  };
}

// Run to the end with scripted answers. skipItemId: its proposal is skipped. record: called for every step and proposal (for the printout).
export function runScripted(project, { agents, registry, skipItemId, onStep, onProposal }) {
  const run = createRun(project, { registry, now: () => FIXED_TIME, scripted: true, agents });
  for (let step = run.next(); !step.done; step = run.next()) {
    if (onStep) onStep(step);
    for (const p of step.proposals) {
      const choice = p.itemId === skipItemId && p.agent === 'Furniture' ? 'skip' : p.options[0].id;
      const result = run.answer(p.id, choice);
      if (onProposal) onProposal(p, choice, result, step);
    }
  }
  return run;
}

const nameOf = (project, itemId) => {
  const item = project.items.find((i) => i.id === itemId);
  return item && item.value && item.value.name ? `${item.value.name} (${itemId})` : itemId;
};

const GROUP_B_FOLDERS = ['shared/', 'walls/', 'doors-windows/', 'floors-ceilings/', 'lighting-electrical/'];
export function groupCKnowledgeFiles() {
  return listKnowledgeFiles().filter((f) => f !== 'allowed-licences.json' && !GROUP_B_FOLDERS.some((d) => f.startsWith(d)));
}

function sourceLines() {
  const lines = ['KNOWLEDGE FILES OF GROUP C AND THEIR SOURCES (pending owner check: none of these sources was opened)'];
  for (const file of groupCKnowledgeFiles()) {
    const k = loadKnowledge(file);
    lines.push(`- ${file}: ${k.provenance.title}`);
    lines.push(`    ${k.provenance.covers}`);
    for (const s of k.provenance.sources) lines.push(`    source: ${s.name} | ${s.url} | ${s.licence} | ${s.checked}`);
  }
  return lines;
}

export function renderGroupCDemo() {
  const registry = loadRegistry();
  const { project, slots, later, skipId } = buildGroupCProject();
  const out = [TITLE, DRAFT_STATEMENT, 'Every answer below is a scripted answer: the first option, chosen by the test script and not by a person. One suggestion is skipped on purpose.', ''];
  out.push(`Project: ${project.name}`);
  for (const f of project.floors) out.push(`  Floor ${f.name}: ${f.rooms.map((r) => `${r.name} ${r.width} x ${r.depth} m`).join('; ')}`);
  out.push(`  Inspiration for the whole project: ${project.inspiration.join(', ')}`);
  out.push('The Living Room and the Bedroom are on different floors, so a change to one room\'s wall must not touch the other.', '');

  let count = 0;
  let stepNo = 0;
  const printStep = (title) => (step) => {
    stepNo += 1;
    out.push(`${title} STEP ${stepNo}: ${step.agent} (${step.kind === 'first' ? 'first pass' : 're-check'})${step.staleItemIds.length ? `, stale items: ${step.staleItemIds.map((i) => nameOf(project, i)).join(', ')}` : ''}`);
    if (step.proposals.length === 0) out.push('  No proposals. Nothing needed to change.');
  };
  const printProposal = (p, choice, result) => {
    count += 1;
    out.push(`  Proposal ${count} [${sourceTag(p.source)}] rule ${p.ruleId}, confidence ${p.confidence}${p.request ? `, REQUEST to ${p.request.owner}` : ''}`);
    out.push(`    Item: ${nameOf(project, p.itemId)}`);
    out.push(`    Why: ${p.why}`);
    p.options.forEach((o, i) => out.push(`    Option ${i + 1}: ${o.label}${o.recommended ? ' (recommended)' : ''}`));
    out.push(`    ${SCRIPTED}: ${choice === 'skip' ? 'SKIP (kept as is)' : `option ${p.options.findIndex((o) => o.id === choice) + 1} (${choice})`} -> ${result.applied ? `accepted, version ${result.version}` : choice === 'skip' ? 'nothing changed' : 'not applied'}`);
  };

  out.push('PART 1: THE FIRST RUN THROUGH ALL EIGHT AGENTS');
  const first = runScripted(project, { agents: groupCAgents(registry), registry, skipItemId: skipId, onStep: printStep('Run 1'), onProposal: printProposal });
  out.push('', first.failure ? `THE RUN STOPPED: ${first.failure.failedAgent}: ${first.failure.reason}` : `Run 1 finished: ${count} proposals, ${project.versions.length} versions.`);
  const locked = project.items.find((i) => i.id === later.furniture[3]);
  out.push(`The Locked desk was not changed: it is still at x ${locked.value.position.x}, y ${locked.value.position.y}.`);
  out.push(`Left stale after run 1: ${findStale(project, registry).stale.map((s) => nameOf(project, s.itemId)).join(', ') || 'nothing'}`);
  const saved = project.items.find((i) => i.kind === 'clash').value;
  out.push('', 'THE REVIEWER\'S SAVED REPORT', `  ${saved.summary}`);
  for (const c of saved.clashes) out.push(`  ${c.number}. [${c.tag}] ${c.severity}: ${c.description}`);

  out.push('', 'PART 2: A WALL IS MOVED, AND THE RIPPLE RE-CHECKS WHAT DEPENDS ON IT');
  const logBefore = project.runLog.length;
  const versionsBefore = project.versions.length;
  const told = {};
  const wrap = (name, fn) => { const w = (view, context) => { told[name] = context.staleItemIds.slice(); return fn(view, context); }; if (fn.checkCustom) w.checkCustom = fn.checkCustom; return w; };
  const agents2 = Object.fromEntries(Object.entries({ ...groupCAgents(registry), Walls: makeWallMoveAgent(slots) }).map(([n, f]) => [n, wrap(n, f)]));
  const second = runScripted(project, { agents: agents2, registry, onStep: printStep('Run 2'), onProposal: printProposal });
  out.push('', second.failure ? `THE RUN STOPPED: ${second.failure.failedAgent}: ${second.failure.reason}` : `Run 2 finished: ${project.versions.length - versionsBefore} new versions.`);
  out.push('What each agent was told to re-check in run 2 (only the Living Room\'s items; the Bedroom\'s are never in a list):');
  for (const name of registry.order) out.push(`  ${name}: ${(told[name] || []).length === 0 ? 'nothing stale' : told[name].map((i) => nameOf(project, i)).join(', ')}`);
  out.push('Run log of run 2 (ripple lines):');
  for (const e of project.runLog.slice(logBefore).filter((x) => ['re-check', 'not-affected', 'still-fine'].includes(x.event))) {
    out.push(`  ${e.agent}: ${e.event}${e.item ? ` ${nameOf(project, e.item)}` : ''}${e.reason ? ` - ${e.reason}` : ''}`);
  }
  out.push(`Left stale after run 2: ${findStale(project, registry).stale.map((s) => nameOf(project, s.itemId)).join(', ') || 'nothing'}`);

  out.push('', 'RUN LOG (both runs)');
  for (const e of project.runLog) {
    const bits = [`${e.agent}: ${e.event}`];
    if (e.item) bits.push(nameOf(project, e.item));
    if (e.by) bits.push(`by ${e.by}`);
    if (e.reason) bits.push(`- ${e.reason}`);
    out.push(`  ${bits.join(' ')}`);
  }
  out.push('', 'VERSIONS');
  for (const v of project.versions) out.push(`  Version ${v.number}: ${v.who} changed ${nameOf(project, v.item)}, approved by ${v.approvedBy}, based on ${v.basis ? v.basis.map((b) => `${b.itemId}@${b.version}`).join(', ') : 'nothing recorded'}`);
  out.push('', ...sourceLines(), '', 'All results above are Rule-based. No AI was used.', DRAFT_STATEMENT, '');
  return out.join('\n');
}
