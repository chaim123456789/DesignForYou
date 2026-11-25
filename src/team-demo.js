// The Group B checkpoint run (design-team B6): a made-up project goes through the first four agents with the step Coordinator,
// every proposal is answered by a scripted answer (the first option), and the whole run is written out as plain text.
// Nothing here is the sample and nothing is saved by this file. renderTeamDemo() returns the text.
import { createProject } from './brain/brain.js';
import { createRun, SCRIPTED } from './team-coordinator.js';
import { createTeamSlots } from './team-slots.js';
import { loadRegistry } from './agents/registry.js';
import { findStale } from './ripple.js';
import { DRAFT_STATEMENT, sourceTag } from './label.js';
import { loadKnowledge } from './knowledge/load.js';
import { listKnowledgeFiles } from './viewer/engine-files.js';
import { makeWallsAgent } from './agents/walls/agent.js';
import { makeDoorsWindowsAgent } from './agents/doors-windows/agent.js';
import { makeFloorsCeilingsAgent } from './agents/floors-ceilings/agent.js';
import { makeLightingElectricalAgent } from './agents/lighting-electrical/agent.js';

const FIXED_TIME = '2026-11-25T12:00:00.000Z';
const DEMO_TITLE = 'DESIGN TEAM: GROUP B CHECKPOINT RUN (a made-up project, not the sample)';

export function buildDemoProject() {
  const project = createProject({
    name: 'Made-up test home',
    floors: [
      { name: 'Ground', rooms: [{ name: 'Kitchen', width: 4, depth: 3 }, { name: 'Living Room', width: 5, depth: 3 }, { name: 'Study' }] },
      { name: 'Upper', rooms: [{ name: 'Bedroom', width: 4, depth: 3 }, { name: 'Bathroom', width: 2.5, depth: 2.5 }] },
    ],
  });
  const room = (floor, n) => `floor-${floor}-room-${n}`;
  const door = (r, name, x, y, width, depth) => ({ kind: 'door', room: r, name, position: { x, y, width, depth } });
  const window = (r, name, x, y, width) => ({ kind: 'window', room: r, name, position: { x, y, width, depth: 0.1 } });
  const slots = createTeamSlots(project, {
    openings: [
      door(room(1, 1), 'Living room door', 3.9, 1, 0.1, 0.9),
      window(room(1, 1), 'Kitchen window', 1.4, 2.9, 1.2),
      door(room(1, 2), 'Garden door', 0.02, 0, 0.9, 0.1), // too near the corner: the Doors and windows agent proposes a fix
      door(room(2, 1), 'Bedroom door', 1.5, 0, 0.9, 0.1),
      window(room(2, 1), 'Bedroom window', 1.4, 2.9, 1.2),
      door(room(2, 2), 'Bathroom door', 1.0, 0, 0.9, 0.1),
    ],
  });
  return { project, slots };
}

const nameOf = (project, itemId) => {
  const item = project.items.find((i) => i.id === itemId);
  return item && item.value && item.value.name ? `${item.value.name} (${itemId})` : itemId;
};

function sourceLines() {
  const lines = ['KNOWLEDGE FILES AND THEIR SOURCES (pending owner check: none of these sources was opened)'];
  for (const file of listKnowledgeFiles().filter((f) => f !== 'allowed-licences.json')) {
    const k = loadKnowledge(file);
    lines.push(`- ${file}: ${k.provenance.title}`);
    for (const s of k.provenance.sources) lines.push(`    source: ${s.name} | ${s.url} | ${s.licence} | ${s.checked}`);
  }
  return lines;
}

export function renderTeamDemo() {
  const registry = loadRegistry();
  const { project } = buildDemoProject();
  const agents = {
    Walls: makeWallsAgent(), 'Doors and windows': makeDoorsWindowsAgent(), 'Floors and ceilings': makeFloorsCeilingsAgent(), 'Lighting and electrical': makeLightingElectricalAgent(),
  };
  const configs = ['Furniture', 'Decor', 'Style'].map((name) => ({ name, enabled: false }));
  const out = [DEMO_TITLE, DRAFT_STATEMENT, 'Every answer below is a scripted answer: the first option, chosen by the test script and not by a person.', ''];
  out.push(`Project: ${project.name}`);
  for (const f of project.floors) out.push(`  Floor ${f.name}: ${f.rooms.map((r) => `${r.name}${r.width ? ` ${r.width} x ${r.depth} m` : ' (no size entered)'}`).join('; ')}`);
  out.push('Rooms on one floor are taken to sit side by side in the order entered (an assumption until floor plans can be uploaded).', '');

  const run = createRun(project, { registry, agents, configs, now: () => FIXED_TIME, scripted: true });
  let proposalCount = 0;
  let stepNo = 0;
  for (;;) {
    const step = run.next();
    if (step.done) break;
    stepNo += 1;
    out.push(`STEP ${stepNo}: ${step.agent} (${step.kind === 'first' ? 'first pass' : 're-check'})${step.staleItemIds.length ? `, stale items: ${step.staleItemIds.map((i) => nameOf(project, i)).join(', ')}` : ''}`);
    if (step.proposals.length === 0) out.push('  No proposals. Nothing needed to change.');
    for (const p of step.proposals) {
      proposalCount += 1;
      out.push(`  Proposal ${proposalCount} [${sourceTag(p.source)}] rule ${p.ruleId}, confidence ${p.confidence}`);
      out.push(`    Item: ${nameOf(project, p.itemId)}`);
      out.push(`    Why: ${p.why}`);
      p.options.forEach((o, i) => out.push(`    Option ${i + 1}: ${o.label}${o.recommended ? ' (recommended)' : ''}`));
      const first = p.options[0].newValue;
      for (const t of (first && first.thresholds) || []) out.push(`    Threshold in option 1: ${t.type} under ${t.name}, between ${t.between.join(' and ')} (rule ${t.rule})`);
      const choice = p.options[0].id;
      const result = run.answer(p.id, choice);
      out.push(`    ${SCRIPTED}: option 1 (${choice}) -> ${result.applied ? `accepted, version ${result.version}` : 'not applied'}`);
    }
  }
  out.push('', run.failure ? `THE RUN STOPPED: ${run.failure.failedAgent}: ${run.failure.reason}` : `The run finished. ${proposalCount} proposals, ${project.versions.length} versions, every one approved by "${SCRIPTED}".`, '');

  out.push('RUN LOG');
  for (const e of project.runLog) {
    const bits = [`${e.agent}: ${e.event}`];
    if (e.item) bits.push(nameOf(project, e.item));
    if (e.by) bits.push(`by ${e.by}`);
    if (e.reason) bits.push(`- ${e.reason}`);
    out.push(`  ${bits.join(' ')}`);
  }
  out.push('', 'VERSIONS');
  for (const v of project.versions) out.push(`  Version ${v.number}: ${v.who} changed ${nameOf(project, v.item)}, approved by ${v.approvedBy}, based on ${v.basis ? v.basis.map((b) => `${b.itemId}@${b.version}`).join(', ') : 'nothing recorded'}`);
  out.push('', `Stale items left at the end: ${findStale(project, registry).stale.length}`, '');
  out.push(...sourceLines(), '', 'All results above are Rule-based. No AI was used.', DRAFT_STATEMENT, '');
  return out.join('\n');
}
