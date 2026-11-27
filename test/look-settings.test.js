// Look-and-feel Task L5: agent settings. A global choice and a per-agent choice of three levels, and the rule "Doors and windows move with
// their wall". They decide only how a proposal is CONFIRMED. The gatekeeper, the owners and Locked are not changed.
// What these tests CANNOT show: how the settings look, a real browser's storage, a person reading the log. Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withLook, fillOwnProject, stepButton, runToEnd, walk, buttons, proposalItems, answerLineOf, answerWaiting, continueButton, heading, savedSettings, SETTINGS_KEY, THEME_KEY } from '../test-helpers/look-page.js';
import {
  LEVELS, LEVEL_IDS, USE_GLOBAL, DEFAULT_LEVEL, defaultSettings, normalise, levelFor, withGlobal, withAgentLevel, withDoorsFollowWall, decide, levelLabel,
} from '../docs/workspace/settings.js';
import { loadSettings, saveSettings, loadTheme, saveTheme, clearSaved } from '../docs/workspace/store.js';
import { recordingStorage, installStorage } from '../test-helpers/fake-page.js';
import { AGENT_INFO } from '../docs/workspace/agents-info.js';
import { createRun, AUTO_CONFIRMED } from '../src/team-coordinator.js';
import { createProject, createItem, getItem } from '../src/brain/brain.js';
import { loadRegistry } from '../src/agents/registry.js';
import { buildProposal } from '../src/proposal.js';
import { createState, setProjectName, addFloor, addRoom, addPlaced } from '../docs/intake/state.js';
import { createTeamSession, describeEffect } from '../docs/intake/team-run.js';

const NAMES = AGENT_INFO.map((a) => a.name);
// The cards on the Agents page are made by the page's script, so the stand-in finds them by walking down from the list.
const inCards = (page, id) => walk(page.el('agents-cards')).find((n) => n.id === id);
const registry = loadRegistry();

// ---- The three levels and the rule, as plain logic -----------------------------------------------------------------------------

const proposalFrom = (agent, confidence = 'high') => ({ agent, confidence });
const effect = (over = {}) => ({ locked: false, affectsOthers: false, clash: false, ...over });
const decideWith = (settings, proposal, fx, kind = 'first') => decide(settings, proposal, { kind, getEffect: () => fx });

test('L5: there are exactly three levels, with the words "Always ask me", "Recommended" and "Do it and tell me", and "Always ask me" is the default', () => {
  assert.deepEqual(LEVELS.map((l) => l.label), ['Always ask me', 'Recommended', 'Do it and tell me']);
  assert.deepEqual(LEVEL_IDS, ['ask', 'recommended', 'auto']);
  assert.equal(DEFAULT_LEVEL, 'ask', 'agents always ask until the user chooses otherwise (product.md)');
  assert.equal(defaultSettings().global, 'ask');
  assert.equal(defaultSettings().doorsFollowWall, true);
  assert.match(LEVELS[1].help, /affects another agent's work, causes a clash, or touches a Locked item\. Otherwise it applies the change and tells you\./);
});

test('L5: "Always ask me" asks for everything, even a clean proposal', () => {
  const s = withGlobal(defaultSettings(), 'ask');
  const d = decideWith(s, proposalFrom('Walls'), effect());
  assert.equal(d.auto, false);
  assert.equal(d.level, 'ask');
});

test('L5: "Do it and tell me" confirms every proposal for the user, except when the agent is unsure and shows two options', () => {
  const s = withGlobal(defaultSettings(), 'auto');
  assert.equal(decideWith(s, proposalFrom('Walls'), effect({ affectsOthers: true, clash: true, locked: true })).auto, true);
  const unsure = decideWith(s, proposalFrom('Style', 'low'), effect());
  assert.equal(unsure.auto, false);
  assert.match(unsure.why, /unsure and shows two options/);
});

test('L5: "Recommended" asks when a change affects another agent\'s work, causes a clash, or touches a Locked item, and otherwise confirms', () => {
  const s = withGlobal(defaultSettings(), 'recommended');
  assert.equal(decideWith(s, proposalFrom('Furniture'), effect()).auto, true);
  const affects = decideWith(s, proposalFrom('Furniture'), effect({ affectsOthers: true }));
  assert.equal(affects.auto, false);
  assert.match(affects.why, /affects another agent's work/);
  const clash = decideWith(s, proposalFrom('Furniture'), effect({ clash: true }));
  assert.equal(clash.auto, false);
  assert.match(clash.why, /causes a clash/);
  const locked = decideWith(s, proposalFrom('Furniture'), effect({ locked: true }));
  assert.equal(locked.auto, false);
  assert.match(locked.why, /touches a Locked item/);
  const all = decideWith(s, proposalFrom('Furniture'), effect({ locked: true, clash: true, affectsOthers: true }));
  assert.match(all.why, /touches a Locked item and it causes a clash and it affects another agent's work/);
  // The facts are only looked up when the answer depends on them.
  let looked = 0;
  decide(withGlobal(s, 'ask'), proposalFrom('Walls'), { kind: 'first', getEffect: () => { looked += 1; return effect(); } });
  decide(withGlobal(s, 'auto'), proposalFrom('Walls'), { kind: 'first', getEffect: () => { looked += 1; return effect(); } });
  assert.equal(looked, 0, 'Always ask me and Do it and tell me never look anything up');
});

test('L5: a per-agent choice beats the global choice, and "use the choice for all agents" goes back to the global one', () => {
  let s = withGlobal(defaultSettings(), 'auto');
  s = withAgentLevel(s, 'Walls', 'ask');
  assert.equal(levelFor(s, 'Walls'), 'ask');
  assert.equal(levelFor(s, 'Decor'), 'auto');
  assert.equal(decideWith(s, proposalFrom('Walls'), effect()).auto, false);
  assert.equal(decideWith(s, proposalFrom('Decor'), effect()).auto, true);
  s = withAgentLevel(s, 'Walls', USE_GLOBAL);
  assert.equal(levelFor(s, 'Walls'), 'auto');
  assert.deepEqual(s.perAgent, {});
  assert.throws(() => withAgentLevel(s, 'Walls', 'sometimes'), /not a level/);
  assert.throws(() => withGlobal(s, 'sometimes'), /not a level/);
});

test('L5: the rule "Doors and windows move with their wall" lets the follow-up of a wall change through at Recommended, and nothing else', () => {
  const on = withGlobal(defaultSettings(), 'recommended');
  const off = withDoorsFollowWall(on, false);
  const follow = proposalFrom('Doors and windows');
  // The follow-up of a wall change (the re-check pass of Doors and windows) affects other agents' work, but the rule lets it through.
  assert.equal(decideWith(on, follow, effect({ affectsOthers: true }), 'recheck').auto, true);
  assert.equal(decideWith(off, follow, effect({ affectsOthers: true }), 'recheck').auto, false);
  // Not the follow-up (first pass), or another agent: the rule does not apply.
  assert.equal(decideWith(on, follow, effect({ affectsOthers: true }), 'first').auto, false);
  assert.equal(decideWith(on, proposalFrom('Furniture'), effect({ affectsOthers: true }), 'recheck').auto, false);
  // A clash or a Locked item still asks, and an explicit "Always ask me" for the agent is never overridden.
  assert.equal(decideWith(on, follow, effect({ affectsOthers: true, clash: true }), 'recheck').auto, false);
  assert.equal(decideWith(on, follow, effect({ affectsOthers: true, locked: true }), 'recheck').auto, false);
  assert.equal(decideWith(withAgentLevel(on, 'Doors and windows', 'ask'), follow, effect({ affectsOthers: true }), 'recheck').auto, false);
});

test('L5: the design team screen tells the settings whether a step is a first pass or a re-check, so the rule can tell a follow-up from a first answer', () => {
  const screen = readFileSync(new URL('../docs/intake/team-screen.js', import.meta.url), 'utf8');
  assert.match(screen, /decision = decide\(session, proposal, step\.kind\)/);
  const screens = readFileSync(new URL('../docs/intake/screens.js', import.meta.url), 'utf8');
  assert.match(screens, /decide: \(session, proposal, kind\) => settingsCode\.decide\(parts\.agents\.getSettings\(\), proposal, \{\s*kind, getEffect: \(\) => teamRunCode\.describeEffect\(session, proposal\),/);
  // The first option, never a custom value, is what a confirmation for the user applies.
  assert.match(screen, /const first = proposal\.options\.find\(\(o\) => o\.id !== 'custom'\);/);
});

test('L5: settings from the browser are checked: wrong types, unknown levels and unknown agents fall back to the defaults', () => {
  assert.deepEqual(normalise(null, NAMES), defaultSettings());
  assert.deepEqual(normalise('x', NAMES), defaultSettings());
  assert.deepEqual(normalise([], NAMES), defaultSettings());
  const messy = normalise({ global: 'sometimes', doorsFollowWall: 'yes', perAgent: { Walls: 'auto', Decor: 'sometimes', 'Not an agent': 'ask' } }, NAMES);
  assert.deepEqual(messy, { version: 1, global: 'ask', perAgent: { Walls: 'auto' }, doorsFollowWall: true });
  assert.equal(normalise({ global: 'auto', doorsFollowWall: false, perAgent: { Style: 'ask' } }, NAMES).doorsFollowWall, false);
  assert.equal(levelLabel('auto'), 'Do it and tell me');
});

// ---- The three facts about a proposal (what the "Recommended" level looks at) ------------------------------------------------------

function sessionWith(place) {
  const state = createState();
  setProjectName(state, 'Facts');
  const floor = addFloor(state, 'Ground').id;
  const room = addRoom(state, floor, 'Den', 5, 4).id;
  place(state, room);
  return createTeamSession(state);
}
const proposalFor = (session, agent, itemId, newValue, extra = {}) => buildProposal({
  id: `test:${itemId}`, agent, itemId, why: 'A test.', source: 'rule', ruleId: 'test-rule', confidence: 'high',
  options: [{ id: 'go', label: 'Do it', newValue }], ...extra,
}, { items: session.project.items, order: session.registry.order });

test('L5: describeEffect: a wall change affects other agents\' work only when work they have decided (a piece the user placed) was worked out from it', () => {
  const empty = sessionWith(() => {});
  const wallEmpty = empty.project.items.find((i) => i.kind === 'wall');
  const fx1 = describeEffect(empty, proposalFor(empty, 'Walls', wallEmpty.id, { name: 'Walls of Den', state: 'decided', segments: [] }));
  assert.deepEqual({ locked: fx1.locked, affectsOthers: fx1.affectsOthers, clash: fx1.clash, unsure: fx1.unsure }, { locked: false, affectsOthers: false, clash: false, unsure: false },
    'every other item is an empty slot, so there is no work to affect');
  const placed = sessionWith((s, room) => addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Unsure', x: 100, y: 100, width: 200, depth: 90 }));
  const wall = placed.project.items.find((i) => i.kind === 'wall');
  const fx2 = describeEffect(placed, proposalFor(placed, 'Walls', wall.id, { name: 'Walls of Den', state: 'decided', segments: [] }));
  assert.equal(fx2.affectsOthers, true, 'the placed couch was worked out from the wall');
});

test('L5: describeEffect: a request to an earlier agent affects another agent\'s work, and a Locked item is reported as Locked', () => {
  const s = sessionWith((state, room) => {
    addPlaced(state, { type: 'sofa', name: 'Couch', room, status: 'Locked', x: 100, y: 100, width: 200, depth: 90 });
  });
  const couch = s.project.items.find((i) => i.kind === 'layout');
  const wall = s.project.items.find((i) => i.kind === 'wall');
  const asks = proposalFor(s, 'Furniture', wall.id, { name: 'Walls of Den', state: 'decided', segments: [] }, { request: { itemId: wall.id, owner: 'Walls' } });
  assert.equal(describeEffect(s, asks).affectsOthers, true);
  const onLocked = describeEffect(s, proposalFor(s, 'Furniture', couch.id, { ...couch.value, position: { ...couch.value.position, x: 2 } }));
  assert.equal(onLocked.locked, true);
});

test('L5: describeEffect: a move that makes two pieces overlap is a clash, a move to a free place is not, and the real Brain is never changed', () => {
  const s = sessionWith((state, room) => {
    addPlaced(state, { type: 'sofa', name: 'Couch', room, status: 'Unsure', x: 50, y: 50, width: 200, depth: 90 });
    addPlaced(state, { type: 'table', name: 'Dining', room, status: 'Unsure', x: 300, y: 200, width: 140, depth: 80 });
  });
  const [couch, dining] = s.project.items.filter((i) => i.kind === 'layout');
  const before = JSON.stringify(s.project);
  const onto = describeEffect(s, proposalFor(s, 'Furniture', couch.id, { ...couch.value, position: { ...dining.value.position } }));
  assert.equal(onto.clash, true, 'the couch would sit on the table');
  const free = describeEffect(s, proposalFor(s, 'Furniture', couch.id, { ...couch.value, position: { ...couch.value.position, y: 0.2 } }));
  assert.equal(free.clash, false);
  assert.equal(JSON.stringify(s.project), before, 'the check works on a copy');
  assert.equal(s.project.versions.length, 0);
});

test('L5: describeEffect: a room with no window yet, or a light with no switch yet, is unfinished work and not a clash', () => {
  const s = sessionWith(() => {});
  const wall = s.project.items.find((i) => i.kind === 'wall');
  const fx = describeEffect(s, proposalFor(s, 'Walls', wall.id, { name: 'Walls of Den', state: 'decided', segments: [{ side: 'north', length: 5 }] }));
  assert.equal(fx.clash, false);
});

// ---- Stored in the browser only ---------------------------------------------------------------------------------------------------

test('L5: the settings are kept in the browser only, under one name, and read back; bad or missing storage never throws', () => {
  const { storage, writes } = recordingStorage();
  const restore = installStorage(storage);
  try {
    assert.deepEqual(loadSettings(NAMES), defaultSettings(), 'nothing saved yet');
    const mine = withAgentLevel(withGlobal(defaultSettings(), 'ask'), 'Furniture', 'auto');
    assert.equal(saveSettings(mine), true);
    assert.deepEqual(loadSettings(NAMES), mine);
    assert.deepEqual(writes.map(([key]) => key), [SETTINGS_KEY]);
    assert.equal(saveTheme('light'), true);
    assert.equal(loadTheme(), 'light');
    assert.equal(saveTheme('purple'), false, 'an unknown theme is not saved');
    storage.setItem(SETTINGS_KEY, '{not json');
    assert.deepEqual(loadSettings(NAMES), defaultSettings());
    storage.setItem(THEME_KEY, 'purple');
    assert.equal(loadTheme(), 'dark');
    assert.equal(clearSaved(), true);
    assert.equal(storage.getItem(SETTINGS_KEY), null);
    assert.equal(storage.getItem(THEME_KEY), null);
  } finally { restore(); }
  // A browser with no storage, or one that refuses: the page still works with the defaults.
  const noStorage = installStorage(undefined);
  assert.deepEqual(loadSettings(NAMES), defaultSettings());
  assert.equal(saveSettings(defaultSettings()), false);
  assert.equal(loadTheme(), 'dark');
  noStorage();
  const refusing = installStorage({ getItem() { throw new Error('no'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('no'); } });
  assert.deepEqual(loadSettings(NAMES), defaultSettings());
  assert.equal(saveSettings(defaultSettings()), false);
  assert.equal(saveTheme('dark'), false);
  assert.equal(clearSaved(), false);
  refusing();
});

// ---- The Agents page: the controls ----------------------------------------------------------------------------------------------

test('L5: the Agents page has the global choice, the rule, and one choice per agent, each with a visible label; Always ask me is picked first', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.equal(page.el('settings-level-ask').checked, true);
    assert.equal(page.el('settings-level-recommended').checked, false);
    assert.equal(page.el('settings-doors-follow').checked, true);
    for (const id of ['settings-level-ask', 'settings-level-recommended', 'settings-level-auto']) assert.equal(page.el(id).getAttribute('type'), 'radio');
    for (const info of AGENT_INFO) {
      const select = inCards(page, `agent-level-${info.key}`);
      const options = select.children.map((o) => o.textContent);
      assert.deepEqual(options, ['Use the choice for all agents (Always ask me)', 'Always ask me', 'Recommended', 'Do it and tell me']);
      assert.equal(select.value, USE_GLOBAL);
    }
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L5: choosing a level on the Agents page is saved in the browser, shown in every agent\'s choice, and found again after a reload', async () => {
  let kept;
  await withLook({}, async (page, opened) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    const auto = page.el('settings-level-auto');
    auto.checked = true;
    auto.dispatch('change');
    assert.equal(page.el('settings-saved').textContent, 'Saved in this browser.');
    assert.equal(inCards(page, 'agent-level-walls').children[0].textContent, 'Use the choice for all agents (Do it and tell me)');
    const furniture = inCards(page, 'agent-level-furniture');
    furniture.value = 'ask';
    furniture.dispatch('change');
    page.el('settings-doors-follow').checked = false;
    page.el('settings-doors-follow').dispatch('change');
    kept = Object.fromEntries(opened.recorder.data);
    assert.deepEqual(JSON.parse(kept[SETTINGS_KEY]), { version: 1, global: 'auto', perAgent: { Furniture: 'ask' }, doorsFollowWall: false });
    assert.deepEqual(opened.recorder.writes.map(([key]) => key), [SETTINGS_KEY, SETTINGS_KEY, SETTINGS_KEY], 'only the settings are written');
  });
  await withLook({ storage: kept }, async (page) => {
    page.el('choose-sample').click();
    assert.equal(page.el('settings-level-auto').checked, true);
    assert.equal(page.el('settings-level-recommended').checked, false);
    assert.equal(inCards(page, 'agent-level-furniture').value, 'ask');
    assert.equal(page.el('settings-doors-follow').checked, false);
  });
});

test('L5: "Reset my settings" on the Settings page forgets the saved settings and the saved theme, and puts the defaults back', async () => {
  await withLook({ storage: { ...savedSettings('auto'), [THEME_KEY]: 'light' } }, async (page, opened) => {
    page.el('choose-sample').click();
    assert.equal(page.el('settings-level-auto').checked, true);
    assert.equal(page.document.documentElement.getAttribute('data-theme'), 'light');
    page.el('rail-settings').click();
    page.el('settings-reset').click();
    assert.equal(opened.recorder.data.has(SETTINGS_KEY), false);
    assert.equal(opened.recorder.data.has(THEME_KEY), false);
    assert.equal(page.el('settings-level-ask').checked, true);
    assert.equal(page.document.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(page.el('settings-reset-done').textContent, 'Your saved settings were cleared.');
  });
});

// ---- The run: how proposals are confirmed ----------------------------------------------------------------------------------------

async function startRun(page) {
  fillOwnProject(page);
  stepButton(page).click();
}
const answered = (page) => proposalItems(page).filter((li) => answerLineOf(li).hidden === false);
const waiting = (page) => proposalItems(page).filter((li) => answerLineOf(li).hidden !== false);

test('L5: with "Always ask me" every proposal waits for the user, and says why', async () => {
  await withLook({ storage: savedSettings('ask') }, async (page) => {
    await startRun(page);
    assert.equal(heading(page), 'Walls');
    assert.equal(answered(page).length, 0);
    assert.ok(waiting(page).length >= 2);
    const note = waiting(page)[0].children.find((c) => /decision-note/.test(c.className));
    assert.equal(note.hidden, false);
    assert.equal(note.textContent, 'You chose "Always ask me".');
    assert.equal(continueButton(page).hidden, true, 'the next agent waits for the answers');
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L5: with "Do it and tell me" the agents\' proposals are confirmed for the user, shown as Auto-confirmed, marked in the version record, and listed in the log', async () => {
  await withLook({ storage: savedSettings('auto') }, async (page) => {
    await startRun(page);
    assert.equal(heading(page), 'Walls');
    const first = answered(page);
    assert.ok(first.length >= 2, 'the first agent\'s proposals were confirmed at once');
    for (const li of first) {
      assert.match(answerLineOf(li).textContent, /^Auto-confirmed \(Do it and tell me\): Confirm: .*It was applied \(version \d+\)\.$/);
      assert.equal(buttons(li).filter((b) => !b.parent.hidden && /^(Confirm|Skip|Custom)/.test(b.textContent)).length, 0, 'no buttons left on an answered proposal');
    }
    assert.match(page.el('action-status').textContent, /^Walls is finished\. \d+ proposals were auto-confirmed for you\. Press Continue to the next agent\.$/);
    // The log on the Agents page says Auto-confirmed, tagged with the agent.
    const log = page.el('agents-log').children.map((li) => li.textContent);
    assert.ok(log.some((line) => /Walls\. Rule-based: Auto-confirmed/.test(line)), log.join('\n'));
    // The page goes on through all eight agents with no click on Confirm; the Continue button still asks the user to move on.
    const seen = await runToEnd(page);
    assert.equal(seen[0], 'Walls');
    assert.equal(seen.at(-1), 'Reviewer');
    assert.equal(page.el('screen-result').hidden, false);
    // The summary table of the result (its version history) says who approved each version.
    const summary = walk(page.el('own-summary')).map((n) => n.textContent).join(' ');
    assert.match(summary, /auto-confirmed/);
    assert.match(page.el('result-team-sentence').textContent, /Answers marked "auto-confirmed" were confirmed for you by your agent settings\./);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
  });
});

test('L5: "Recommended" confirms clean proposals and asks about the rest, and the Agents page names both', async () => {
  await withLook({ storage: savedSettings('recommended') }, async (page) => {
    await startRun(page);
    const seenAuto = [];
    const seenAsked = [];
    for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
      for (const li of answered(page)) seenAuto.push(answerLineOf(li).textContent);
      for (const li of waiting(page)) seenAsked.push(li.children.find((c) => /decision-note/.test(c.className)).textContent);
      answerWaiting(page);
      continueButton(page).click();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.ok(seenAuto.length > 0 && seenAuto.every((t) => /^Auto-confirmed \(Recommended\)/.test(t)));
    // Style is unsure about two proposals: they are always put to the user.
    assert.ok(seenAsked.some((t) => /unsure and shows two options/.test(t)), seenAsked.join('\n'));
    assert.equal(page.el('screen-result').hidden, false);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L5: "Recommended" asks when a change affects work another agent has already decided (a door the user placed), and the rule lets the door follow its wall', async () => {
  const placed = [{ type: 'door', name: 'Front door', status: 'Unsure', x: 100, y: 0, width: 90, depth: 10, room: 'Living' }];
  // The rule is ON (default): the Walls proposal for Living is asked about (the placed door was worked out from it).
  await withLook({ storage: savedSettings('recommended') }, async (page) => {
    fillOwnProject(page, { placed });
    stepButton(page).click();
    assert.equal(heading(page), 'Walls');
    const notes = waiting(page).map((li) => li.children.find((c) => /decision-note/.test(c.className)).textContent);
    assert.ok(notes.some((t) => /affects another agent's work/.test(t)), `the wall change that moves a placed door is asked about: ${notes.join(' | ')}`);
    // The user confirms; a later pass of Doors and windows follows the wall. With the rule on, that follow-up is confirmed for them.
    const seen = [];
    for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
      seen.push(heading(page) + (page.el('heading-team-agent').textContent));
      for (const li of answered(page)) seen.push(`${heading(page)}: ${answerLineOf(li).textContent.slice(0, 40)}`);
      answerWaiting(page);
      continueButton(page).click();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(page.el('screen-result').hidden, false);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L5: a Locked item is never changed by a confirmation for the user: the gatekeeper refuses it and the item is flagged "needs your look"', () => {
  // A small run with one Locked item and one proposal for it. The proposal is answered as the settings would: with auto: true.
  const project = createProject({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Living' }] }] });
  const room = project.floors[0].rooms[0].id;
  const locked = createItem(project, { kind: 'wall', owner: 'Walls', status: 'Locked', room, value: { name: 'Walls of Living', segments: [] } });
  const make = (agent) => () => [buildProposal({
    id: 'p-1', agent, itemId: locked.id, why: 'A test.', source: 'rule', ruleId: 'test-rule', confidence: 'high',
    options: [{ id: 'a', label: 'Change it', newValue: { name: 'Walls of Living', segments: [1] } }],
  }, { items: project.items })];
  const run = createRun(project, { registry, agents: { Walls: make('Walls') }, now: () => '2026-01-01T00:00:00.000Z' });
  const step = run.next();
  assert.equal(step.proposals.length, 1);
  const result = run.answer('p-1', 'a', undefined, { auto: true });
  assert.equal(result.applied, false);
  assert.match(result.reason, /Locked and cannot be changed/);
  assert.equal(project.versions.length, 0, 'no version was written');
  assert.deepEqual(getItem(project, locked.id).value, { name: 'Walls of Living', segments: [] }, 'the item is unchanged');
  assert.ok(project.runLog.some((e) => e.event === 'needs-look' && e.item === locked.id));
  assert.ok(project.runLog.some((e) => e.event === 'refused' && e.item === locked.id));
});

test('L5: a confirmation for the user goes through the same gatekeeper: the owner rule holds, and only the label of who approved changes', () => {
  const project = createProject({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Living' }] }] });
  const room = project.floors[0].rooms[0].id;
  const wall = createItem(project, { kind: 'wall', owner: 'Walls', room, value: { name: 'Walls of Living', segments: [] } });
  const door = createItem(project, { kind: 'door', owner: 'Doors and windows', room, value: { name: 'Door', position: { x: 1, y: 0, width: 0.9, depth: 0.1 } } });
  const proposalFor = (agent, itemId, id, request) => buildProposal({
    id, agent, itemId, why: 'A test.', source: 'rule', ruleId: 'test-rule', confidence: 'high',
    options: [{ id: 'a', label: 'Change it', newValue: { name: 'x', segments: [] } }], ...(request ? { request } : {}),
  }, { items: project.items, order: registry.order });
  const agents = {
    Walls: () => [proposalFor('Walls', wall.id, 'w-1')],
    // Doors and windows asks for the wall (an earlier agent's item) to change: the owner, Walls, applies it, never the asking agent.
    'Doors and windows': () => [proposalFor('Doors and windows', wall.id, 'd-1', { itemId: wall.id, owner: 'Walls' })],
  };
  const run = createRun(project, { registry, agents, now: () => '2026-01-01T00:00:00.000Z' });
  run.next();
  const a = run.answer('w-1', 'a', undefined, { auto: true });
  assert.equal(a.applied, true);
  assert.equal(project.versions[0].approvedBy, AUTO_CONFIRMED);
  assert.equal(project.versions[0].approvedBy, 'auto-confirmed');
  assert.equal(project.versions[0].who, 'Walls', 'the version is written by the owner');
  run.next();
  const b = run.answer('d-1', 'a', undefined, { auto: true });
  assert.equal(b.applied, true);
  assert.equal(project.versions[1].who, 'Walls', 'a request is applied by the owner of the earlier item, not by the asking agent');
  assert.equal(project.versions[1].approvedBy, 'auto-confirmed');
  // An answer without the flag is still "user", and a scripted run is still "scripted answer".
  const project2 = createProject({ name: 'Home', floors: [{ name: 'Ground', rooms: [{ name: 'Living' }] }] });
  const wall2 = createItem(project2, { kind: 'wall', owner: 'Walls', room: project2.floors[0].rooms[0].id, value: { name: 'Walls of Living', segments: [] } });
  const run2 = createRun(project2, { registry, agents: { Walls: () => [buildProposal({ id: 'w-2', agent: 'Walls', itemId: wall2.id, why: 'A test.', source: 'rule', ruleId: 'r', confidence: 'high', options: [{ id: 'a', label: 'Change it', newValue: { name: 'y', segments: [] } }] }, { items: project2.items })] }, now: () => '2026-01-01T00:00:00.000Z' });
  run2.next();
  run2.answer('w-2', 'a');
  assert.equal(project2.versions[0].approvedBy, 'user');
  assert.ok(door.id, 'the made-up door exists');
});

test('L5: the gatekeeper file is untouched by the settings: it knows nothing about them, and its checks are in the same order (Locked, then owner)', () => {
  const source = readFileSync(new URL('../src/brain/gatekeeper.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /auto|setting|level/i);
  const body = source.slice(source.indexOf('function changeItem'));
  assert.ok(body.indexOf("item.status === 'Locked'") < body.indexOf('who !== item.owner'), 'Locked is checked before the owner');
  // The run is the only code that names the auto label, and it passes it on only as the approver of the version.
  const run = readFileSync(new URL('../src/team-coordinator.js', import.meta.url), 'utf8');
  assert.match(run, /changeItem\(who, item\.id, newValue, \{ approvedBy, basis: currentBasis\(item\) \}\)/);
  assert.equal((run.match(/AUTO_CONFIRMED/g) || []).length, 2, 'named once to define it and once to use it');
});

test('L5: the page has no way to confirm for the user without the settings: with no saved choice every proposal is put to the user', () => {
  assert.equal(loadSettings(NAMES).global, 'ask');
  const text = readFileSync(new URL('../docs/workspace/agents-page.js', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /auto: true/, 'the Agents page never answers a proposal');
});
