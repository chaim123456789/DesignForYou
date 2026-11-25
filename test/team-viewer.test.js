// Design-team D5: the viewer shows the team (R11.3). Scene data for the new kinds, and the team panel's page text.
// What this CANNOT show: how the panel and the new shapes look in a real browser. Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { buildScene, describeItem } from '../docs/scene-data.js';
import { makeRunData } from '../src/viewer/make-run-data.js';
import { makeTeamData } from '../src/viewer/make-team-data.js';
import { buildGroupCProject, groupCAgents, runScripted } from '../src/team-demo-c.js';
import { loadRegistry } from '../src/agents/registry.js';
import { createTeamSession, finishTeamSession } from '../docs/intake/team-run.js';
import { buildOwnRunData } from '../docs/intake/run-data.js';
import { createState, setProjectName, addFloor, addRoom } from '../docs/intake/state.js';

installImportHooks();
const registry = loadRegistry();
const ORDER = ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer'];
const LAYOUT = {
  gapBetweenRooms: 0.2, floorToFloorHeight: 3, wallHeight: 2.6, doorHeight: 2, windowHeight: 1.2, windowBottom: 0.9, furnitureHeight: 0.8,
  styleMarker: { width: 0.6, depth: 0.6, height: 0.05 }, rooms: { 'Living Room': { width: 5, depth: 4 }, Bedroom: { width: 2.8, depth: 3 } },
};

function teamRunData() {
  const { project, skipId } = buildGroupCProject();
  const run = runScripted(project, { agents: groupCAgents(registry), registry, skipItemId: skipId });
  const team = makeTeamData(project, run.steps, registry);
  return { project, team, data: makeRunData(project, LAYOUT, { team }) };
}

test('D5 / R11.3: the team data lists the eight agents in registry order, with what each did, re-checks with reasons, and tags', () => {
  const { team } = teamRunData();
  assert.deepEqual(team.agents.map((a) => a.name), ORDER);
  assert.deepEqual(team.agents.map((a) => a.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const a of team.agents) assert.match(a.summary, /^(Made \d+ proposals?\.|Ran and had nothing to propose\.|Switched off|Did not run)/);
  const rechecked = team.agents.filter((a) => a.status === 'Re-checked').map((a) => a.name);
  assert.deepEqual(rechecked, ['Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture'], 'the agents the wall request rippled to');
  const reasons = team.agents.flatMap((a) => a.notes.filter((n) => n.event === 're-check'));
  assert.ok(reasons.length >= 4 && reasons.every((n) => /^Re-check \d+ items?:/.test(n.text)), 'each re-check says why');
  assert.ok(team.agents.some((a) => a.notes.some((n) => n.event === 'not-affected')), 'agents not affected are named with a reason');
  const proposals = team.agents.flatMap((a) => a.passes.flatMap((p) => p.proposals));
  assert.ok(proposals.length > 15);
  for (const p of proposals) {
    assert.match(p.tag, /^(Rule-based|AI)$/);
    assert.ok(p.rule);
    assert.equal(p.options[p.options.length - 1], 'Custom');
    assert.match(p.answer, /^(Confirm: .+|Skip: kept as it is|Custom value)$/);
  }
  assert.ok(proposals.some((p) => p.request && /^Asks Walls to change /.test(p.request)), 'the request to Walls is shown');
  assert.ok(proposals.some((p) => p.answer === 'Skip: kept as it is'));
  for (const p of proposals) assert.doesNotMatch(p.item, /^item-\d/, 'items are named, not numbered');
});

test('D5: the new kinds are drawn as simple shapes: lights under the ceiling, switches and sockets on the wall, a rug on the floor', () => {
  const { data } = teamRunData();
  const last = data.versions.length;
  const boxes = buildScene(data, last);
  const of = (type) => boxes.filter((b) => b.type === type);
  assert.ok(of('light-marker').length >= 3);
  assert.ok(of('switch').length >= 2);
  assert.ok(of('socket').length >= 2);
  assert.equal(of('rug').length, 2, 'one rug per room');
  for (const b of of('light-marker')) { assert.equal(b.height, 0.05); assert.ok(Math.abs(b.y + b.height - (b.floorOrder - 1) * 3 - 2.6) < 1e-9, 'just under the ceiling'); }
  for (const b of of('rug')) assert.equal(b.height, 0.02);
  for (const b of of('switch')) assert.ok(Math.abs(b.y - (b.floorOrder - 1) * 3 - 1.2) < 1e-9, 'a switch at 1.2 m');
  // One label per item: only the first mark of an item carries a label.
  const lightsOfLiving = boxes.filter((b) => b.type === 'light-marker' && b.floorOrder === 1);
  assert.equal(lightsOfLiving.filter((b) => !b.noLabel).length, 1);
  const ids = new Set(boxes.map((b) => b.key));
  assert.equal(ids.size, boxes.length, 'every box has its own key');
  const lightItem = data.snapshots[last].items.find((i) => i.kind === 'light');
  assert.equal(describeItem(data, last, lightItem.id).kind, 'Lights');
});

test('D5: the old sample still draws exactly as before (same fingerprint of all versions), and its run file has no team part', () => {
  const run = JSON.parse(readFileSync(new URL('../docs/sample-run.json', import.meta.url), 'utf8'));
  const all = run.snapshots.map((s) => buildScene(run, s.version));
  // The same fingerprint the place-items Task 7 test checks: the sample's boxes did not change.
  assert.equal(createHash('sha256').update(JSON.stringify(all)).digest('hex'), 'd04a5af0a926b294531b3619f7f105050f8f32e5d4402d0e1e27527842e58f42');
  assert.equal('team' in run, false);
  for (const s of run.snapshots) for (const i of s.items) assert.equal('marks' in i, false);
});

// ---- The panel on the stand-in page -----------------------------------------------------------------

let caseNumber = 70000;
async function withViewer(body) {
  const page = createFakePage();
  const restore = installFakePage(page);
  caseNumber += 1;
  try {
    await import(`../docs/viewer.js?case=teamviewer-${caseNumber}`);
    await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the viewer script to finish');
    await body(page);
  } finally {
    delete globalThis.designForYouViewer;
    restore();
  }
}
const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };

test('D5 / R11.3: the team panel shows the eight agents in order, what each did, re-checks and the tags; the sample hides it', async () => {
  const { data } = teamRunData();
  await withViewer(async (page) => {
    assert.equal(page.el('team-panel').hidden, true, 'the sample has no team panel');
    assert.equal(await globalThis.designForYouViewer.showRunData(data, { kind: 'own' }), true);
    assert.equal(page.el('team-panel').hidden, false);
    const items = page.el('team-panel-list').children;
    assert.deepEqual(items.map((li) => li.children[0].textContent.split(':')[0]), ORDER.map((n, i) => `${i + 1}. ${n}`));
    assert.match(items[1].children[0].textContent, /: Re-checked$/);
    const text = page.el('team-panel-list').textContent;
    assert.match(text, /Re-checked: Re-check \d+ items?:/);
    assert.match(text, /Not affected: /);
    assert.doesNotMatch(text, /item-\d/, 'no item ids on the page');
    const tags = walk(page.el('team-panel-list')).filter((n) => /source-tag/.test(n.className)).map((n) => n.textContent);
    assert.ok(tags.length > 15);
    assert.ok(tags.every((t) => t === 'Rule-based' || t === 'AI'));
    assert.match(text, /Rule: walls-/);
    assert.match(text, /Answer: Confirm: .*\(scripted answer\)/);
    assert.match(text, /Answer: Skip: kept as it is/);
    assert.match(page.el('team-panel-sentence').textContent, /AI is off/);
    assert.match(page.el('team-panel-sentence').textContent, /scripted answer/);
    assert.equal(page.el('team-panel').getAttribute('aria-labelledby'), 'team-panel-heading');
    assert.deepEqual(page.problemLines(), []);
    // Back to the sample: the panel is hidden again and emptied.
    const sample = JSON.parse(readDoc('sample-run.json'));
    await globalThis.designForYouViewer.showRunData(sample);
    assert.equal(page.el('team-panel').hidden, true);
    assert.equal(page.el('team-panel-list').children.length, 0);
  });
});

test('D5: a visitor\'s own step-by-step run carries the team part into the viewer data', () => {
  const s = createState();
  setProjectName(s, 'Mine');
  const f = addFloor(s, 'Ground').id;
  addRoom(s, f, 'Living', 4, 4);
  const session = createTeamSession(s, { scripted: true });
  for (let step = session.run.next(); !step.done; step = session.run.next()) for (const p of step.proposals) session.run.answer(p.id, p.options[0].id);
  const result = finishTeamSession(session);
  const data = buildOwnRunData(result.project, s, result.team);
  assert.deepEqual(data.team.agents.map((a) => a.name), ORDER);
  assert.equal(data.own, true);
  assert.ok(buildScene(data, data.versions.length).some((b) => b.type === 'light-marker'));
});
