// Design-team D4: the Review and run screen steps through the eight agents on the stand-in page.
// These tests run the REAL docs/viewer.js, docs/intake/screens.js, review-screen.js, team-screen.js, team-run.js and the copies of
// the team's code in docs/team/, on the stand-in page built from the REAL docs/index.html (test-helpers/fake-page.js).
// What this CANNOT show: how anything looks, the 320 px layout in a real browser, a real keyboard or screen reader. Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { registerHooks } from '../test-helpers/register-hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';

installImportHooks();
// Test-only switch: when globalThis.__breakTeam is set, the page's team-run.js cannot load (as if the file were missing or broken).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (globalThis.__breakTeam && specifier.startsWith('./team-run.js?v=')) return { url: new URL('../test-helpers/broken-three.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const html = readDoc('index.html');
const css = readDoc('styles.css');
let caseNumber = 50000;
const ORDER = ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer'];

async function openPage() {
  const page = createFakePage();
  const restore = installFakePage(page);
  page.el('heading-result').textContent = 'Sample two-storey home';
  globalThis.confirm = () => true;
  caseNumber += 1;
  await import(`../docs/viewer.js?case=team-${caseNumber}`);
  await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the viewer script to finish');
  await import(`../docs/intake/screens.js?case=team-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { page, restore: () => { delete globalThis.confirm; delete globalThis.designForYouViewer; restore(); } };
}
async function withPage(body) {
  const opened = await openPage();
  try { await body(opened.page); } finally { opened.restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const buttons = (node) => walk(node).filter((n) => n.tagName === 'BUTTON');
function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
const roomId = (select, name) => walk(select).find((n) => n.tagName === 'OPTION' && n.textContent === name).value;

// A small project: two rooms, a warm-oak note, and a cold-steel item, so the Style agent is unsure and shows two options.
function fill(page) {
  page.el('choose-own').click();
  page.el('project-name').value = 'My home';
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = 'Ground floor';
  page.el('add-floor').click();
  for (const room of ['Living', 'Bedroom']) { page.el('room-name').value = room; page.el('add-room').click(); }
  gotoStep(page, 'inspiration');
  page.el('note-text').value = 'warm oak';
  page.el('add-note').click();
  gotoStep(page, 'items');
  page.el('item-text').value = 'Wall panels';
  page.el('item-room').value = roomId(page.el('item-room'), 'Living');
  page.el('item-status-unsure').checked = true;
  page.el('item-tag').value = 'cold steel';
  page.el('add-item').click();
  gotoStep(page, 'review');
}
const panel = (page) => page.el('team-run');
const proposalItems = (page) => page.el('team-proposals').children;
const heading = (page) => page.el('heading-team-agent').textContent;
const continueButton = (page) => page.el('team-run').children.find((c) => c.id === 'team-continue');
const stepButton = (page) => walk(page.el('run-extra')).find((n) => n.id === 'run-team-steps');

// Answer every proposal shown with the given choice ('confirm' = first option, 'skip', or a function (li) => button), then continue.
async function answerAll(page, choose = () => 'confirm') {
  for (const li of [...proposalItems(page)]) {
    if (li.children.find((c) => c.className === 'team-answer').hidden === false) continue; // already answered
    const how = choose(li);
    const all = buttons(li).filter((b) => !b.parent.hidden);
    const b = how === 'skip' ? all.find((x) => x.textContent.startsWith('Skip')) : all.find((x) => x.textContent.startsWith('Confirm'));
    b.click();
  }
}
async function runToEnd(page, choose) {
  const seen = [];
  for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
    seen.push(heading(page));
    await answerAll(page, choose);
    continueButton(page).click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return seen;
}

test('D4: the step-by-step button has a visible label, is tied to the reason and stays off until there is a name, a floor and a room', async () => {
  await withPage(async (page) => {
    page.el('choose-own').click();
    gotoStep(page, 'review');
    const b = stepButton(page);
    assert.ok(b, 'the button is made when the design team code has loaded');
    assert.equal(b.textContent, 'Step through the eight agents, and confirm each suggestion');
    assert.equal(b.type, 'button');
    assert.equal(b.getAttribute('aria-describedby'), 'run-reason');
    assert.equal(b.disabled, true);
    assert.equal(page.el('run-design-team').textContent, 'Run the design team', 'the old one-go button is still there');
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true, 'no red message');
  });
});

test('D4 / R4.1, R4.6: the first agent shows its proposals, focus moves to its heading, and nothing changes until it is answered', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    assert.equal(panel(page).hidden, false);
    assert.equal(heading(page), 'Walls');
    assert.equal(page.document.activeElement, page.el('heading-team-agent'), 'focus on the new heading');
    assert.equal(page.el('heading-team-agent').getAttribute('tabindex'), '-1');
    assert.equal(page.el('team-progress').textContent, 'Agent 1 of 8');
    assert.match(page.el('action-status').textContent, /^Walls, agent 1 of 8\. \d+ proposals? to answer\.$/, 'one short sentence is announced');
    const row = page.el('team-agents').children.map((c) => c.textContent);
    assert.deepEqual(row, ORDER.map((n, i) => `${i + 1}. ${n}${i === 0 ? ': now' : ': waiting'}`), 'the eight agents in order');
    assert.equal(page.el('team-agents').children[0].getAttribute('aria-current'), 'step');
    assert.ok(proposalItems(page).length > 0);
    assert.equal(continueButton(page).hidden, true, 'no way on before the answers');
    assert.equal(stepButton(page).disabled, true, 'the run buttons are off while the team is running');
    assert.equal(page.el('run-design-team').disabled, true);
  });
});

test('D4 / R8.1: each proposal shows its tag, its rule, why, and Confirm / Custom / Skip buttons with words on them', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    for (const li of proposalItems(page)) {
      const text = li.textContent;
      assert.ok(walk(li).some((n) => n.className === 'source-tag' && n.textContent === 'Rule-based'), 'a Rule-based tag');
      assert.match(text, /Rule: walls-/);
      const labels = buttons(li).map((b) => b.textContent);
      assert.ok(labels[0].startsWith('Confirm: '));
      assert.ok(labels.includes('Custom: write my own value'));
      assert.ok(labels.includes('Skip: keep it as it is'));
      for (const b of buttons(li)) { assert.equal(b.type, 'button'); assert.match(b.className, /action-button/); }
      const group = walk(li).find((n) => n.getAttribute && n.getAttribute('role') === 'group');
      assert.ok(group.getAttribute('aria-labelledby'), 'the choices are a group named by the item heading');
      const box = walk(li).find((n) => n.tagName === 'TEXTAREA');
      const label = walk(li).find((n) => n.tagName === 'LABEL');
      assert.equal(label.getAttribute('for'), box.id, 'the custom box has a visible label tied to it');
    }
  });
});

test('D4 / R4.6, R1.1: the next agent starts only after the answers, and the agents come in the registry order', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    const count = proposalItems(page).length;
    // Answer all but the last: still no way on, and pressing Continue (if forced) does not move on.
    const items = [...proposalItems(page)];
    items.slice(0, -1).forEach((li) => buttons(li).find((b) => b.textContent.startsWith('Confirm')).click());
    assert.equal(continueButton(page).hidden, true);
    assert.equal(heading(page), 'Walls');
    if (count > 1) assert.match(page.el('action-status').textContent, /still waiting/);
    buttons(items[items.length - 1]).find((b) => b.textContent.startsWith('Confirm')).click();
    assert.equal(continueButton(page).hidden, false);
    assert.equal(page.document.activeElement, continueButton(page), 'focus moves to Continue');
    assert.match(proposalItems(page)[0].textContent, /Your answer: Confirm: .*It was applied \(version \d+\)/);
    continueButton(page).click();
    assert.equal(heading(page), 'Doors and windows');
    const seen = ['Walls', 'Doors and windows', ...(await runToEnd(page)).slice(1)];
    const firsts = seen.filter((h) => !h.includes('looking again'));
    assert.deepEqual(firsts, ORDER);
    assert.equal(page.el('screen-result').hidden, false, 'the result is shown at the end');
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
  });
});

test('D4 / R4.4: when the Style agent is unsure, its proposal shows exactly two options plus Custom (and Skip)', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    for (let i = 0; i < 12 && heading(page) !== 'Style'; i += 1) { await answerAll(page); continueButton(page).click(); }
    assert.equal(heading(page), 'Style');
    const unsure = [...proposalItems(page)].find((li) => /The agent is unsure, so it shows two options/.test(li.textContent));
    assert.ok(unsure, 'an unsure proposal');
    const labels = buttons(unsure).map((b) => b.textContent);
    assert.equal(labels.filter((l) => l.startsWith('Confirm: ')).length, 2);
    assert.deepEqual(labels.slice(2, 4), ['Custom: write my own value', 'Skip: keep it as it is']);
    assert.equal(page.el('team-ai-note').hidden, false, 'AI was not used is said');
    assert.equal(page.el('team-ai-note').textContent, 'AI was not used here. The suggestions are Rule-based.');
  });
});

test('D4 / R4.5: Skip marks the item "kept as is", and the result says so', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    const li = proposalItems(page)[0];
    buttons(li).find((b) => b.textContent.startsWith('Skip')).click();
    assert.equal(li.children.find((c) => c.className === 'team-answer').textContent, 'Your answer: Skip. The item is kept as it is.');
    await runToEnd(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.match(page.el('own-summary').textContent, /Kept as it is/);
  });
});

test('D4 / R4.3: Custom opens a labelled box; a bad value is refused with the agent\'s reason and the proposal waits', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    const li = proposalItems(page)[0];
    const custom = buttons(li).find((b) => b.textContent === 'Custom: write my own value');
    assert.equal(custom.getAttribute('aria-expanded'), 'false');
    custom.click();
    assert.equal(custom.getAttribute('aria-expanded'), 'true');
    const box = walk(li).find((n) => n.tagName === 'TEXTAREA');
    assert.equal(page.document.activeElement, box);
    box.value = '{ not json';
    buttons(li).find((b) => b.textContent.startsWith('Use this custom value')).click();
    const error = li.children.find((c) => c.className === 'field-error');
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /not written correctly/);
    box.value = '{"nonsense": true}';
    buttons(li).find((b) => b.textContent.startsWith('Use this custom value')).click();
    assert.match(error.textContent, /segments/);
    assert.equal(error.getAttribute('role'), 'alert');
    assert.equal(continueButton(page).hidden, true, 'still waiting');
    // A good custom value (the first suggestion with longer walls) is accepted and applied.
    const start = JSON.parse(JSON.stringify({ segments: [{ side: 'north', length: 4.2, thickness: 0.1 }] }));
    box.value = JSON.stringify(start);
    buttons(li).find((b) => b.textContent.startsWith('Use this custom value')).click();
    assert.match(li.children.find((c) => c.className === 'team-answer').textContent, /^Your answer: Custom value\. It was applied/);
  });
});

// A Bedroom 2.4 m wide with a 2.8 m sofa: Furniture asks Walls to move a wall. Confirming it changes the wall, so the earlier agents
// look again at the Bedroom's items (a re-check pass), and the screen says so in plain words, with names and no item ids.
function fillRipple(page) {
  page.el('choose-own').click();
  page.el('project-name').value = 'Ripple home';
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = 'Ground floor';
  page.el('add-floor').click();
  page.el('room-name').value = 'Bedroom';
  page.el('room-width').value = '2.4';
  page.el('room-depth').value = '3';
  page.el('add-room').click();
  gotoStep(page, 'place');
  const option = page.el('place-room').children.find((c) => c.textContent === 'Bedroom');
  page.el('place-room').value = option.value;
  page.el('place-room').dispatch('change');
  page.el('place-type').value = 'sofa';
  page.el('place-type').dispatch('change');
  page.el('place-name').value = 'Long sofa';
  page.el('place-status-unsure').checked = true;
  for (const [id, v] of [['place-x', '0'], ['place-y', '200'], ['place-width', '280'], ['place-depth', '90']]) page.el(id).value = v;
  page.el('add-placed').click();
  assert.equal(page.el('add-placed-error').hidden, true, `the sofa was accepted: ${page.el('add-placed-error').textContent}`);
  gotoStep(page, 'review');
}

test('D4 / R3.3, R3.6: a request from Furniture to Walls is shown, and after it is confirmed the screen says what is re-checked and shows the re-check pass', async () => {
  await withPage(async (page) => {
    fillRipple(page);
    stepButton(page).click();
    const seen = [];
    const rechecks = [];
    let request = null;
    for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
      seen.push(heading(page));
      if (!request) request = [...proposalItems(page)].find((li) => /asks Walls, an earlier agent, to change this item/.test(li.textContent)) || null;
      await answerAll(page);
      if (!page.el('team-rechecked').hidden) rechecks.push(page.el('team-rechecked').textContent);
      continueButton(page).click();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.ok(request, 'the request to Walls is shown with a plain sentence');
    assert.ok(seen.some((h) => /\(looking again at its out-of-date items\)$/.test(h)), `a re-check pass is shown: ${seen.join(', ')}`);
    assert.ok(rechecks.length > 0, 'the screen said what is re-checked');
    assert.match(rechecks[0], /^To be re-checked after your answers: /);
    assert.doesNotMatch(rechecks.join(' '), /item-\d/, 'no item ids, only names');
    assert.equal(page.el('screen-result').hidden, false);
  });
});

test('D4: the same checks as the place screen: 44 px targets, the 320 px rules, reading order with no positive tabindex, and no storage or network', async () => {
  // Sizes: every button the team screen makes uses the shared .action-button style, which is 2.75 rem (44 px) high and wide.
  assert.match(css, /\.choice-button, \.nav-button, \.action-button \{[^}]*min-height: 2\.75rem;[^}]*min-width: 2\.75rem;/);
  // 320 px: the panel and the proposals may shrink (min-width 0, long words wrap); the option buttons wrap their text.
  assert.match(css, /\.team-proposal \{[^}]*min-width: 0;/);
  assert.match(css, /\.team-option-button \{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /\.custom-input \{[^}]*width: 100%;[^}]*box-sizing: border-box;/);
  const block = html.slice(html.indexOf('<div id="team-run"'), html.indexOf('</div>', html.indexOf('<div id="team-run"')));
  assert.doesNotMatch(block, /tabindex="[^-]/);
  for (const name of ['team-screen.js', 'team-run.js']) {
    const src = readDoc(`intake/${name}`);
    assert.doesNotMatch(src, /\bfetch\b|localStorage|sessionStorage|indexedDB|document\.cookie|XMLHttpRequest|WebSocket|sendBeacon|innerHTML|outerHTML|insertAdjacentHTML|https?:\/\//, name);
    assert.doesNotMatch(src, /tabIndex\s*=\s*[1-9]|tabindex['"]?\s*,\s*['"]?[1-9]/, name);
  }
  await withPage(async (page) => {
    fill(page);
    const fetches = page.log.filter((l) => l.startsWith('fetch:')).length;
    stepButton(page).click();
    // Reading order inside one proposal: Confirm options, Custom, Skip, then the custom box (opened on demand).
    const li = proposalItems(page)[0];
    const order = buttons(li).map((b) => b.textContent.split(':')[0].split(' ')[0]);
    assert.deepEqual(order.slice(-3), ['Custom', 'Skip', 'Use']);
    await runToEnd(page);
    assert.equal(page.log.filter((l) => l.startsWith('fetch:')).length, fetches, 'no network call while stepping through the team');
  });
});

test('D4: Back from the team run ends it, keeps what was entered, and the run can be started again', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    assert.equal(panel(page).hidden, false);
    page.el('back-button').click();
    page.el('next-button').click();
    assert.equal(panel(page).hidden, true, 'the unfinished run is gone');
    assert.equal(stepButton(page).disabled, false, 'and the button is on again');
    assert.match(page.el('review-list').textContent, /Project name: My home/);
    stepButton(page).click();
    assert.equal(heading(page), 'Walls');
  });
});

test('D4: if the design team code cannot load, the red message names the step, the rest of the page works, and the old run button still runs', async () => {
  globalThis.__breakTeam = true;
  try {
    await withPage(async (page) => {
      assert.equal(page.el('intake-error-message').hidden, false, 'the red message is shown');
      assert.match(page.el('intake-error-message').textContent, /Step "Design team code" failed/);
      assert.match(page.el('intake-script-status').textContent, /Page script build-[a-z]+-4 \(screens\): finished setting up\./);
      fill(page);
      assert.equal(stepButton(page), undefined, 'no step-by-step button without its code');
      assert.equal(page.el('run-design-team').disabled, false);
      page.el('run-design-team').click();
      await waitFor(() => page.el('screen-result').hidden === false, 'the old run to finish');
    });
  } finally {
    delete globalThis.__breakTeam;
  }
});

test('D4 / D5: the result of a step-by-step run shows the team panel, the design team sentence and a report where every line has a tag', async () => {
  await withPage(async (page) => {
    fill(page);
    stepButton(page).click();
    await runToEnd(page);
    await waitFor(() => page.el('screen-result').hidden === false, 'the result screen');
    assert.equal(page.el('team-panel').hidden, false, 'the viewer shows the team panel');
    assert.equal(page.el('team-panel-list').children.length, 8);
    assert.equal(page.el('result-team-sentence').hidden, false);
    assert.match(page.el('result-team-sentence').textContent, /Two jobs can use AI: reading a photo and judging taste\. AI is off/);
    assert.doesNotMatch(page.el('result-team-sentence').textContent, /scripted answer/, 'a person answered, so no "scripted answer"');
    const lines = walk(page.el('own-report')).filter((n) => n.className === 'report-line').map((n) => n.textContent);
    assert.ok(lines.length >= 3);
    for (const line of lines) assert.match(line, /^(Rule-based|AI): /, line);
    assert.ok(page.el('result-fixed-rules').textContent.length > 0, 'the old fixed sentence stays while AI is off');
    assert.equal(page.el('heading-result').textContent, 'YOUR PROJECT: My home');
  });
});
