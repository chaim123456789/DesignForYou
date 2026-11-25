// design-team Group C, Task C2: the Decor agent and its knowledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../src/knowledge/load.js';
import { createRun, runWithScript } from '../src/team-coordinator.js';
import { findStale, agentsToRecheck } from '../src/ripple.js';
import { buildProposal } from '../src/proposal.js';
import { makeDecorAgent, loadDecorKnowledge, DECOR } from '../src/agents/decor/agent.js';
import { makeFurnitureAgent } from '../src/agents/furniture/agent.js';
import { buildLater, piece, view, viewWithPoison, firstFour, off, registry, NOW } from '../test-helpers/team-project.js';

const agent = makeDecorAgent();
const ctx = { mode: 'first', staleItemIds: [] };
const R1 = 'floor-1-room-1';
const door = (room, x, y) => ({ kind: 'door', room, name: 'Door', position: { x, y, width: 0.9, depth: 0.1 } });
const win = (room, x, y, width = 1.2) => ({ kind: 'window', room, name: 'Window', position: { x, y, width, depth: 0.1 } });
const knowledge = loadDecorKnowledge();
const rule = (file, id) => file.find((r) => r.id === id).then;

function room(furniture, openings) {
  return buildLater({ rooms: [{ name: 'Living Room', width: 5, depth: 4 }], openings: openings || [door(R1, 4, 0), win(R1, 1.5, 3.9)], furniture });
}
const decorItem = (t) => t.project.items.find((i) => i.kind === 'decor');
const proposalFor = (t, c = ctx) => agent(view(t.project), c).find((p) => p.itemId === decorItem(t).id);

test('design-team C2: the rug follows the seating group: the group rectangle plus the margin, and a bigger group gives a bigger rug', () => {
  const m = rule(knowledge.rugs, 'rug-seating-group');
  const small = proposalFor(room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9)])).options[0].newValue.rug;
  assert.equal(small.width, 2 + 2 * m.margin);
  assert.equal(small.y, m.wallGap, 'the rug stays off the wall by the wall gap');
  assert.equal(small.depth, 1.2, 'from the wall gap to the sofa front plus the margin');
  const big = proposalFor(room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9), piece(R1, 'table', 'Coffee table', 1.4, 1.4, 1.2, 0.6)])).options[0].newValue.rug;
  assert.ok(big.width >= small.width && big.depth > small.depth, `${JSON.stringify(big)} is bigger than ${JSON.stringify(small)}`);
  assert.equal(big.group.length, 2);
  assert.equal(big.rule, 'rug-seating-group');
});

test('design-team C2: a table far from the sofa is not part of the seating group, and a room with no sofa gets no rug', () => {
  const far = proposalFor(room([piece(R1, 'sofa', 'Sofa', 0.5, 0.1, 2, 0.9), piece(R1, 'table', 'Dining table', 3, 3, 1.4, 0.8)])).options[0].newValue.rug;
  assert.equal(far.group.length, 1);
  const none = proposalFor(room([piece(R1, 'bed', 'Bed', 1, 1, 1.6, 2)])).options[0].newValue;
  assert.equal(none.rug, null);
});

test('design-team C2: the art hangs with its middle at the hanging height from the knowledge file', () => {
  const t = room([piece(R1, 'sofa', 'Sofa', 1, 0, 2, 0.9)]);
  const art = proposalFor(t).options[0].newValue.art;
  assert.equal(art.length, 1);
  assert.equal(art[0].centreHeight, rule(knowledge.hanging, 'art-centre-height').height);
  assert.equal(art[0].rule, 'art-centre-height');
  assert.equal(art[0].wall, 'north', 'on the wall behind the sofa');
  assert.equal(art[0].along, 2, 'centred on the sofa');
  assert.equal(art[0].behind, t.later.furniture[0]);
});

test('design-team C2: with no piece against a wall, two equally good walls give two options plus Custom (low confidence)', () => {
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 4 }], openings: [], furniture: [piece(R1, 'sofa', 'Sofa', 1, 1, 2, 0.9)] });
  const p = proposalFor(t);
  assert.equal(p.confidence, 'low');
  assert.equal(p.options.length, 3);
  assert.equal(p.options[2].label, 'Custom');
  assert.notEqual(p.options[0].newValue.art[0].wall, p.options[1].newValue.art[0].wall);
});

test('design-team C2: curtains are as wide as the window plus the overlap on each side', () => {
  const c = rule(knowledge.curtains, 'curtain-width');
  const t = room([], [door(R1, 4, 0), win(R1, 1.5, 3.9, 1.2), win(R1, 4.2, 3.9, 0.4)]);
  const curtains = proposalFor(t).options[0].newValue.curtains;
  assert.equal(curtains.length, 1, 'the 0.4 m window is under the minimum width');
  assert.equal(curtains[0].railWidth, 1.2 + 2 * c.overlap);
  assert.equal(curtains[0].railHeight, 2.4 - c.railBelowCeiling);
  assert.equal(curtains[0].drop, 2.4 - c.railBelowCeiling - c.floorGap);
  assert.equal(curtains[0].window, t.project.items.find((i) => i.kind === 'window' && i.value.position && i.value.position.x === 1.5).id);
});

test('design-team C2: moving a sofa makes the rug stale, and Decor re-checks and proposes a new rug', () => {
  const t = room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9)]);
  const r1 = runWithScript(t.project, { registry, now: NOW, agents: { ...firstFour(), Furniture: makeFurnitureAgent(), Decor: agent }, configs: off(['Style']) });
  assert.equal(r1.ok, true);
  const rugBefore = decorItem(t).value.rug;
  assert.ok(rugBefore);
  assert.deepEqual(findStale(t.project, registry).stale.filter((s) => ['Decor', 'Furniture'].includes(s.owner)), []);

  // A second run: a stand-in Furniture agent moves the sofa one metre east by a scripted answer.
  const sofa = t.project.items.find((i) => i.id === t.later.furniture[0]);
  const mover = (v) => {
    const s = v.items.find((i) => i.id === sofa.id);
    return [buildProposal({
      id: `move:${s.id}`, agent: 'Furniture', itemId: s.id, why: 'The sofa is moved 1 m east.', source: 'rule', ruleId: 'clear-search', confidence: 'high',
      options: [{ id: 'east', label: 'East', newValue: { ...s.value, position: { ...s.value.position, x: s.value.position.x + 1 } } }],
    }, { items: v.items })];
  };
  const run = createRun(t.project, { registry, now: NOW, scripted: true, agents: { ...firstFour(), Furniture: mover, Decor: agent }, configs: off(['Style']) });
  let step;
  do { step = run.next(); for (const p of step.proposals || []) run.answer(p.id, p.options[0].id); } while (!step.done && step.agent !== 'Furniture');
  // after the Furniture step the sofa has moved: the decor item (and what depends on it) are stale
  const stale = findStale(t.project, registry).stale;
  assert.ok(stale.some((s) => s.itemId === decorItem(t).id), 'the decor item is stale');
  const plan = agentsToRecheck(t.project, registry).agents;
  assert.equal(plan.find((a) => a.agent === 'Decor').recheck, true);
  assert.equal(plan.find((a) => a.agent === 'Walls').recheck, false);
  // and Decor's own re-check proposes a different rug
  const again = agent(view(t.project), { mode: 'recheck', staleItemIds: [decorItem(t).id] });
  assert.equal(again.length, 1);
  assert.notDeepEqual(again[0].options[0].newValue.rug, rugBefore);
  assert.ok(again[0].options[0].newValue.rug.x > rugBefore.x);
});

test('design-team C2: in a re-check Decor looks only at its stale items', () => {
  const t = room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9)]);
  assert.equal(agent(view(t.project), { mode: 'recheck', staleItemIds: [] }).length, 0);
  assert.equal(agent(view(t.project), { mode: 'recheck', staleItemIds: [decorItem(t).id] }).length, 1);
});

test('design-team C2: a Locked decor item is not proposed for a change', () => {
  const t = room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9)]);
  decorItem(t).status = 'Locked';
  assert.deepEqual(agent(view(t.project), ctx), []);
});

test('design-team C2: the same input twice gives identical proposals, and each names a rule from its knowledge files', () => {
  const make = () => room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9), piece(R1, 'table', 'Coffee table', 1.4, 1.4, 1.2, 0.6)]);
  const a = agent(view(make().project), ctx);
  const b = agent(view(make().project), ctx);
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
  const ids = new Set([...knowledge.hanging, ...knowledge.rugs, ...knowledge.curtains].map((r) => r.id));
  for (const p of a) {
    assert.ok(ids.has(p.ruleId));
    assert.equal(p.source, 'rule');
    assert.equal(p.agent, DECOR);
    for (const id of p.options[0].newValue.rules) assert.ok(ids.has(id));
  }
});

test('design-team C2: the agent never reads a later agent\'s item (Style, Reviewer)', () => {
  const t = room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9)]);
  assert.equal(agent(viewWithPoison(t.project, ['style', 'clash']), ctx).length, 1);
});

test('design-team C2: a custom answer must have lists for art and curtains and a rug with numbers', () => {
  const p = proposalFor(room([piece(R1, 'sofa', 'Sofa', 1, 0.1, 2, 0.9)]));
  assert.equal(agent.checkCustom(p, { rug: null, art: [], curtains: [] }), true);
  assert.match(agent.checkCustom(p, { art: 'x' }), /art must be a list/);
  assert.match(agent.checkCustom(p, { rug: { x: 'a' } }), /rug needs/);
});

test('design-team C2: the decor knowledge files exist, load and pass the provenance check', () => {
  const dir = fileURLToPath(new URL('../src/knowledge/decor/', import.meta.url));
  const files = readdirSync(dir).sort();
  assert.deepEqual(files, ['curtains.json', 'hanging-heights.json', 'rug-sizes.json']);
  for (const f of files) assert.ok(loadKnowledge(`decor/${f}`).provenance.sources.length > 0);
});
