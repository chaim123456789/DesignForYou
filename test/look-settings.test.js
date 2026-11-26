// look-and-feel Task 4: agent settings and automatic confirmation. They change only WHO confirms. The gatekeeper, owners and Locked rule are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installImportHooks } from '../test-helpers/hooks.js';
import { readDoc } from '../test-helpers/fake-page.js';
import { createSettings, cleanSettings, levelFor, defaultSettings, LEVELS, INHERIT } from '../docs/intake/agent-settings.js';
import { openStore, KEYS } from '../docs/intake/browser-store.js';
import { createRun, AUTOMATIC } from '../src/team-coordinator.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';
import { createProject, createItem } from '../src/brain/brain.js';
import { loadRegistry } from '../src/agents/registry.js';
import { buildProposal } from '../src/proposal.js';
import { decide } from '../docs/intake/auto-confirm.js';
import { withLookPage, memoryStorage, fillProject, stepButton, currentAgent, liveItems, answerAll, continueButton, textOf, walk, buttons } from '../test-helpers/look-page.js';

installImportHooks();
const KEY = KEYS.settings;

test('look-and-feel T4: three levels with the exact names, "Recommended" is the default, the wall rule starts on', () => {
  assert.deepEqual(LEVELS.map((l) => l.label), ['Always ask me', 'Recommended', 'Do it and tell me']);
  assert.match(LEVELS[1].help, /affects another agent's work, causes a clash, or touches a Locked item/);
  assert.deepEqual(defaultSettings(), { global: 'recommended', agents: {}, doorsFollowWall: true });
});

test('look-and-feel T4: a per-agent choice beats the global one, and "inherit" gives it back', () => {
  const s = createSettings(openStore({ localStorage: memoryStorage() }), KEY);
  s.setGlobal('ask');
  s.setAgent('Style', 'auto');
  assert.equal(s.levelFor('Style'), 'auto');
  assert.equal(s.levelFor('Walls'), 'ask');
  s.setAgent('Style', INHERIT);
  assert.equal(s.levelFor('Style'), 'ask');
  assert.throws(() => s.setGlobal('maybe'), /not one of the three/);
  assert.throws(() => s.setAgent('Cook', 'ask'), /not an agent/);
});

test('look-and-feel T4: settings are kept in the browser only, under one key, and damaged values fall back to the defaults', () => {
  const storage = memoryStorage();
  const s = createSettings(openStore({ localStorage: storage }), KEY);
  s.setGlobal('auto');
  s.setDoorsFollowWall(false);
  assert.deepEqual([...storage.map.keys()], [KEY]);
  const again = createSettings(openStore({ localStorage: storage }), KEY);
  assert.equal(again.get().global, 'auto');
  assert.equal(again.get().doorsFollowWall, false);
  assert.deepEqual(cleanSettings({ global: 'evil', agents: { Walls: 'x', Cook: 'ask' }, doorsFollowWall: 'yes' }), defaultSettings());
  assert.deepEqual(createSettings({ read: () => '{broken', write: () => true }, KEY).get(), defaultSettings());
  assert.equal(levelFor({ global: 'ask', agents: { Walls: 'auto' } }, 'Walls'), 'auto');
});

test('look-and-feel T4: if the browser blocks storage the settings still work and the page says they last only this visit', async () => {
  const blocked = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  const store = openStore({ localStorage: blocked });
  const s = createSettings(store, KEY);
  s.setGlobal('ask');
  assert.equal(s.get().global, 'ask');
  assert.equal(s.saved, false);
  assert.equal(openStore({}).available, false);
  assert.throws(() => store.write('other.key', 'x'), /not one of the two/);
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.match(page.el('settings-storage-note').textContent, /blocks saving/);
  }, { storage: blocked });
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.match(page.el('settings-storage-note').textContent, /saved in this browser only/);
    page.el('setting-global').value = 'ask';
    page.el('setting-global').dispatch('change');
  });
});

// ---- the coordinator and the gatekeeper ------------------------------------------------------------------------------------------

function tinyRun(status = 'Unsure') {
  const registry = loadRegistry();
  const project = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'Living' }] }] });
  const room = project.floors[0].rooms[0].id;
  const wall = createItem(project, { kind: 'wall', owner: 'Walls', status, room, value: { name: 'Wall', len: 1 } });
  const propose = (agent) => () => (agent === 'Walls'
    ? [buildProposal({ id: 'w1', agent: 'Walls', itemId: wall.id, why: 'test', source: 'rule', ruleId: 'r', confidence: 'high', options: [{ id: 'a', label: 'Longer', newValue: { name: 'Wall', len: 2 } }] }, { items: project.items })]
    : []);
  const run = createRun(project, { registry, agents: { Walls: propose('Walls') } });
  return { project, run, wall };
}

test('look-and-feel T4: an automatic confirmation is marked "automatic" in the version record and in the run log, with its reason', () => {
  const { project, run, wall } = tinyRun();
  const step = run.next();
  const r = run.answer(step.proposals[0].id, 'a', undefined, { automatic: 'Confirmed automatically because of your setting.' });
  assert.equal(r.applied, true);
  assert.equal(project.versions[0].approvedBy, AUTOMATIC);
  assert.equal(project.versions[0].approvedBy, 'automatic');
  const line = project.runLog.find((e) => e.event === 'answered');
  assert.equal(line.by, 'automatic');
  assert.match(line.reason, /Confirmed automatically/);
  assert.equal(project.items.find((i) => i.id === wall.id).value.len, 2);
});

test('look-and-feel T4: a button answer is still "user", and a skip can never be automatic', () => {
  const a = tinyRun();
  const s = a.run.next();
  a.run.answer(s.proposals[0].id, 'a');
  assert.equal(a.project.versions[0].approvedBy, 'user');
  const b = tinyRun();
  const t = b.run.next();
  assert.throws(() => b.run.answer(t.proposals[0].id, 'skip', undefined, { automatic: 'x' }), /cannot be confirmed automatically/);
});

test('look-and-feel T4: an automatic confirmation of a Locked item is refused by the gatekeeper exactly like a manual one', () => {
  const { project, run, wall } = tinyRun('Locked');
  // The agent in this test proposes on a Locked item on purpose, to show that the answer path itself holds.
  const step = run.next();
  const r = run.answer(step.proposals[0].id, 'a', undefined, { automatic: 'x' });
  assert.equal(r.applied, false);
  assert.match(r.reason, /Locked/);
  assert.equal(project.versions.length, 0);
  assert.equal(project.items.find((i) => i.id === wall.id).value.len, 1);
  assert.ok(project.runLog.some((e) => e.event === 'refused'));
});

test('look-and-feel T4: a scripted run is always labelled "scripted answer", never "automatic"', () => {
  const registry = loadRegistry();
  const { project, wall } = tinyRun();
  const run = createRun(project, { registry, scripted: true, agents: { Walls: () => [buildProposal({ id: 'w1', agent: 'Walls', itemId: wall.id, why: 't', source: 'rule', ruleId: 'r', confidence: 'high', options: [{ id: 'a', label: 'L', newValue: { name: 'Wall', len: 3 } }] }, { items: project.items })] } });
  const step = run.next();
  run.answer(step.proposals[0].id, 'a', undefined, { automatic: 'x' });
  assert.equal(project.versions[0].approvedBy, 'scripted answer');
});

test('look-and-feel T4: the gatekeeper file is byte for byte the one from before (only the list of approvers in brain.js grew)', () => {
  const gate = readFileSync(new URL('../src/brain/gatekeeper.js', import.meta.url));
  // sha256 of src/brain/gatekeeper.js at the end of Group D (build-team-4). It must not change in this spec.
  assert.equal(createHash('sha256').update(gate).digest('hex'), GATEKEEPER_HASH);
  assert.match(readFileSync(new URL('../src/brain/brain.js', import.meta.url), 'utf8'), /APPROVERS = Object\.freeze\(\['user', 'scripted answer', 'automatic'\]\)/);
  assert.deepEqual(Object.keys(createGatekeeper(tinyRun().project)).sort(), ['changeItem', 'changeStatus', 'refreshBasis']);
});
const GATEKEEPER_HASH = '5384a5707761c8a8ff549dc15cb3d285d89390b264750140d05a5c495ac648b7';

// ---- the page ------------------------------------------------------------------------------------------------------------------------

const answerLines = (page) => page.el('agent-log').children.map((c) => c.textContent);
async function driveToEnd(page) {
  for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
    answerAll(page);
    continueButton(page).click();
    await new Promise((r) => setTimeout(r, 5));
  }
}

test('look-and-feel T4: "Always ask me" asks for everything, and nothing is automatic', async () => {
  await withLookPage(async (page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    page.el('setting-global').value = 'ask';
    page.el('setting-global').dispatch('change');
    page.el('rail-project').click();
    page.el('result-back').click();
    fillProject(page);
    stepButton(page).click();
    let asked = 0;
    for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
      asked += liveItems(page).length;
      assert.ok(liveItems(page).every((li) => li.getAttribute('data-auto') === null));
      answerAll(page);
      continueButton(page).click();
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.ok(asked > 10);
    assert.ok(answerLines(page).every((l) => !/automatic/.test(l)), 'every answer says you');
  });
});

test('look-and-feel T4: "Do it and tell me" applies the first option at once, marks it automatic, and tells the visitor', async () => {
  await withLookPage(async (page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    page.el('setting-global').value = 'auto';
    page.el('setting-global').dispatch('change');
    page.el('rail-project').click();
    page.el('result-back').click();
    fillProject(page);
    stepButton(page).click();
    const first = liveItems(page)[0];
    assert.equal(first.getAttribute('data-auto'), 'true');
    assert.match(textOf(first), /Confirmed automatically: Confirm: /);
    assert.match(page.el('action-status').textContent, /confirmed automatically/);
    await driveToEnd(page);
    const lines = answerLines(page);
    assert.ok(lines.length > 10 && lines.every((l) => /Confirmed by: automatic/.test(l)), 'the log shows each one as automatic');
    // The result's version record and summary say "automatic" too.
    assert.match(page.el('result-team-sentence').textContent, /marked "automatic"/);
    page.el('rail-agents').click();
    assert.ok(page.el('agent-log').children.every((c) => c.getAttribute('data-auto') === 'true'));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T4: "Recommended" asks when a change affects another agent\'s work, and says why, and applies the rest and says so', async () => {
  await withLookPage(async (page) => {
    fillProject(page);
    stepButton(page).click();
    assert.equal(currentAgent(page), 'Walls');
    const walls = liveItems(page);
    assert.ok(walls.length > 0 && walls.every((li) => li.getAttribute('data-auto') === null), 'the Walls proposals wait for the visitor');
    assert.match(textOf(walls[0]), /You are asked because: affects another agent's work/);
    answerAll(page);
    continueButton(page).click();
    // Later agents have changes nobody depends on: some are applied and marked, some are asked.
    let auto = 0;
    for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
      auto += liveItems(page).filter((li) => li.getAttribute('data-auto') === 'true').length;
      answerAll(page);
      continueButton(page).click();
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.ok(auto > 0, 'Recommended did apply some changes itself');
    page.el('rail-agents').click();
    const lines = answerLines(page);
    assert.ok(lines.some((l) => /Confirmed by: user/.test(l)) && lines.some((l) => /Confirmed by: automatic/.test(l)));
  });
});

test('look-and-feel T4: a per-agent choice beats the global one on the page', async () => {
  await withLookPage(async (page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    page.el('setting-global').value = 'auto';
    page.el('setting-global').dispatch('change');
    const walls = walk(page.el('agent-cards').children[0]).find((n) => n.tagName === 'SELECT');
    walls.value = 'ask';
    walls.dispatch('change');
    page.el('rail-project').click();
    page.el('result-back').click();
    fillProject(page);
    stepButton(page).click();
    assert.equal(currentAgent(page), 'Walls');
    assert.ok(liveItems(page).every((li) => li.getAttribute('data-auto') === null), 'Walls is asked');
    answerAll(page);
    continueButton(page).click();
    assert.ok(liveItems(page).every((li) => li.getAttribute('data-auto') === 'true'), 'the next agent follows the global choice');
  });
});

test('look-and-feel T4: a Locked item is never confirmed automatically, at any level', async () => {
  await withLookPage(async (page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    page.el('setting-global').value = 'auto';
    page.el('setting-global').dispatch('change');
    page.el('rail-project').click();
    page.el('result-back').click();
    fillProject(page, { locked: true });
    stepButton(page).click();
    let lockedSeen = 0;
    for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
      for (const li of liveItems(page)) if (/Locked/.test(textOf(li)) && /never confirmed automatically/.test(textOf(li))) { lockedSeen += 1; assert.equal(li.getAttribute('data-auto'), null); }
      answerAll(page);
      continueButton(page).click();
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T4: the rule "Doors and windows move with their wall" is a switch with a visible label and is saved', async () => {
  const storage = memoryStorage();
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.equal(page.el('setting-doors-follow').checked, true);
    assert.match(readDoc('index.html'), /<label for="setting-doors-follow">Doors and windows move with their wall<\/label>/);
    page.el('setting-doors-follow').checked = false;
    page.el('setting-doors-follow').dispatch('change');
    assert.equal(JSON.parse(storage.map.get(KEY)).doorsFollowWall, false);
  }, { storage });
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.equal(page.el('setting-doors-follow').checked, false, 'the saved choice is used next time');
  }, { storage });
});

test('look-and-feel T4: decide() never says automatic for a Locked item, and follows each level for an unlocked one nothing depends on', () => {
  const registry = loadRegistry();
  const project = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'Living' }] }] });
  const room = project.floors[0].rooms[0].id;
  const open = createItem(project, { kind: 'style', owner: 'Style', status: 'Unsure', room, value: { name: 'Note' } });
  const locked = createItem(project, { kind: 'style', owner: 'Style', status: 'Locked', room, value: { name: 'Oak' } });
  const proposal = (item) => buildProposal({ id: `p-${item.id}`, agent: 'Style', itemId: item.id, why: 't', source: 'rule', ruleId: 'r', confidence: 'high', options: [{ id: 'a', label: 'Do', newValue: { name: 'New' } }] }, { items: project.items });
  const session = { project, registry, agents: {} };
  const step = { agent: 'Style', kind: 'first' };
  for (const level of ['ask', 'recommended', 'auto']) {
    const settings = { global: level, agents: {}, doorsFollowWall: true };
    assert.equal(decide(session, step, proposal(locked), settings).auto, false, `Locked at ${level}`);
    assert.equal(decide(session, step, proposal(open), settings).auto, level !== 'ask', `Unlocked at ${level}`);
  }
  const before = JSON.stringify(project);
  decide(session, step, proposal(open), { global: 'recommended', agents: {}, doorsFollowWall: true });
  assert.equal(JSON.stringify(project), before, 'deciding changes nothing in the real Brain');
  assert.match(decide(session, step, proposal(locked), { global: 'auto', agents: {} }).reason, /Locked/);
});

test('look-and-feel T4: "Doors and windows move with their wall": a door that only follows its changed wall is applied under Recommended with the rule on, and asked with it off; "Always ask me" still asks', () => {
  const registry = loadRegistry();
  const project = createProject({ name: 'T', floors: [{ name: 'G', rooms: [{ name: 'Living' }] }] });
  const room = project.floors[0].rooms[0].id;
  const wall = createItem(project, { kind: 'wall', owner: 'Walls', status: 'Unsure', room, value: { name: 'Wall', len: 1 } });
  const door = createItem(project, { kind: 'door', owner: 'Doors and windows', status: 'Unsure', room, value: { name: 'Door', at: 1 }, basis: [{ itemId: wall.id, version: 0 }] });
  createItem(project, { kind: 'light', owner: 'Lighting and electrical', status: 'Unsure', room, value: { name: 'Light' }, basis: [{ itemId: door.id, version: 0 }] });
  // The visitor confirmed a wall change: the door is now out of date because of the wall.
  assert.equal(createGatekeeper(project).changeItem('Walls', wall.id, { name: 'Wall', len: 2 }, { approvedBy: 'user' }).accepted, true);
  const proposal = buildProposal({ id: 'd1', agent: 'Doors and windows', itemId: door.id, why: 't', source: 'rule', ruleId: 'r', confidence: 'high', options: [{ id: 'a', label: 'Move it', newValue: { name: 'Door', at: 2 } }] }, { items: project.items });
  const session = { project, registry, agents: {} };
  const settings = (rule, level = 'recommended') => ({ global: level, agents: {}, doorsFollowWall: rule });
  assert.equal(decide(session, { agent: 'Doors and windows', kind: 'recheck' }, proposal, settings(true)).auto, true);
  const off = decide(session, { agent: 'Doors and windows', kind: 'recheck' }, proposal, settings(false));
  assert.equal(off.auto, false);
  assert.match(off.reason, /affects another agent's work/);
  assert.equal(decide(session, { agent: 'Doors and windows', kind: 'first' }, proposal, settings(true)).auto, false, 'only a re-check that follows a wall counts');
  assert.equal(decide(session, { agent: 'Doors and windows', kind: 'recheck' }, proposal, settings(true, 'ask')).auto, false, 'Always ask me still asks');
});
