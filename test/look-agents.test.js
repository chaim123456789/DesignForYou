// Look-and-feel Task L4: the Agents page and the agents' identities. One card per agent (icon, name, what it owns, status, its proposals with
// Confirm / Skip / Custom, its settings). Each of the eight agents has its own colour AND a letter badge (and a shape): colour is never the only
// signal. The colours are colour-blind-safe, and are used in the 3D view, the labels and a small legend.
// What these tests CANNOT show: how the colours look to a person with colour blindness on a real screen, the cards' layout. The colour choice is
// the Okabe-Ito set (a published colour-blind-safe set) with three shades added; the tests compute distances, they do not replace a person looking.
// Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readDoc, themeVariables } from '../test-helpers/fake-page.js';
import {
  withLook, walk, buttons, fillOwnProject, stepButton, heading, proposalItems, answerLineOf, answerWaiting, continueButton, runToEnd, savedSettings,
} from '../test-helpers/look-page.js';
import { AGENT_INFO, infoFor, colourVar, colourName, badgeText, makeBadge } from '../docs/workspace/agents-info.js';
import { statusOf, proposalRows, noteRows, logFromTeam, logFromRows } from '../docs/workspace/agent-status.js';
import { registryData } from '../docs/team/data.js';

const html = readDoc('index.html');
const ORDER = registryData.agents.map((a) => a.name);
const cards = (page) => page.el('agents-cards').children;
const inCard = (card, id) => walk(card).find((n) => n.id === id);
const cardFor = (page, key) => cards(page).find((c) => c.id === `agent-card-${key}`);
const hex = (value) => Number.parseInt(value.slice(1), 16);

// ---- Colour maths: CIE L*a*b* distance, and a simulation of the three common kinds of colour blindness (Machado et al. 2009, severity 1) ----
const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const rgbOf = (h) => [1, 3, 5].map((i) => toLinear(Number.parseInt(h.slice(i, i + 2), 16) / 255));
const MATRICES = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const simulate = (rgb, name) => (name ? MATRICES[name].map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))) : rgb);
function lab(rgb) {
  const [r, g, b] = rgb;
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const distance = (a, b, mode) => Math.hypot(...lab(simulate(rgbOf(a), mode)).map((v, i) => v - lab(simulate(rgbOf(b), mode))[i]));

// ---- The identities --------------------------------------------------------------------------------------------------------------

test('L4: the eight agents, in the registry order, each have their own letter and their own shape; the page adds nothing to the names', () => {
  assert.deepEqual(AGENT_INFO.map((a) => a.name), ORDER, 'same names, same order as the registry');
  assert.equal(AGENT_INFO.length, 8);
  assert.equal(new Set(AGENT_INFO.map((a) => a.letter)).size, 8, 'eight different letters');
  assert.equal(new Set(AGENT_INFO.map((a) => a.shape)).size, 8, 'eight different shapes');
  assert.equal(new Set(AGENT_INFO.map((a) => a.key)).size, 8);
  for (const a of AGENT_INFO) {
    assert.match(a.letter, /^[A-Z]$/);
    assert.ok(a.letter === a.name[0].toUpperCase() || ['C', 'E'].includes(a.letter), `${a.name}: the letter is the first letter of its name (or C for ceilings and E for decor, because F and D are taken)`);
    assert.ok(a.owns.length > 20 && a.owns.endsWith('.'), `${a.name} says what it owns`);
  }
  assert.deepEqual(AGENT_INFO.map((a) => a.letter).join(''), 'WDCLFESR');
  // Helpers, including an owner that is not one of the eight (an older run).
  assert.equal(infoFor('Walls').letter, 'W');
  assert.equal(infoFor('Layout'), undefined);
  assert.equal(colourVar('Walls'), 'var(--agent-walls)');
  assert.equal(colourVar('Layout'), 'var(--agent-neutral)');
  assert.equal(colourName('Reviewer'), '--agent-reviewer');
  assert.equal(badgeText('Furniture'), 'F Furniture');
  assert.equal(badgeText('Layout'), 'Layout');
});

test('L4: each agent has its own colour in the dark and in the light theme, the colours are far enough apart, and the main five are the Okabe-Ito colours', () => {
  const OKABE_ITO = { walls: '#e69f00', doors: '#56b4e9', floors: '#009e73', lighting: '#f0e442', decor: '#cc79a7' };
  for (const theme of ['dark', 'light']) {
    const vars = themeVariables(theme);
    const colours = AGENT_INFO.map((a) => vars[`--agent-${a.key}`]);
    assert.ok(colours.every((c) => /^#[0-9a-f]{6}$/.test(c)), `${theme}: eight colours`);
    assert.equal(new Set(colours).size, 8, `${theme}: eight different colours`);
    let smallest = Infinity;
    for (let i = 0; i < 8; i += 1) for (let j = i + 1; j < 8; j += 1) smallest = Math.min(smallest, distance(colours[i], colours[j]));
    console.log(`  ${theme}: the two closest agent colours differ by ${smallest.toFixed(1)} (CIELAB distance, normal vision)`);
    assert.ok(smallest >= 18, `${theme}: no two agent colours are alike (${smallest.toFixed(1)})`);
    if (theme === 'dark') for (const [key, value] of Object.entries(OKABE_ITO)) assert.equal(vars[`--agent-${key}`], value, `${key} is the Okabe-Ito colour`);
  }
});

test('L4: colour is never the only signal: where two colours look alike to a person with colour blindness, the letters and the shapes still differ', () => {
  for (const theme of ['dark', 'light']) {
    const vars = themeVariables(theme);
    for (const mode of ['protanopia', 'deuteranopia', 'tritanopia']) {
      let close = 0;
      for (let i = 0; i < 8; i += 1) {
        for (let j = i + 1; j < 8; j += 1) {
          const a = AGENT_INFO[i];
          const b = AGENT_INFO[j];
          const d = distance(vars[`--agent-${a.key}`], vars[`--agent-${b.key}`], mode);
          if (d < 12) {
            close += 1;
            assert.notEqual(a.letter, b.letter, `${a.name} and ${b.name} look alike in ${mode} but have different letters`);
            assert.notEqual(a.shape, b.shape, `${a.name} and ${b.name} look alike in ${mode} but have different shapes`);
          }
        }
      }
      console.log(`  ${theme}, ${mode}: ${close} of 28 pairs look alike by colour alone (the letter and the shape tell them apart)`);
    }
  }
  // Every place that shows an agent's colour also shows its letter: the badge, the card, the strip, the legend, the 3D label (letter in front of the name).
  const css = readDoc('styles.css');
  assert.match(css, /\.scene-label\[data-letter\]::before \{ content: attr\(data-letter\)/);
  for (const shape of AGENT_INFO.map((a) => a.shape)) assert.match(css, new RegExp(`\\.agent-badge\\[data-shape="${shape}"\\]`), `${shape} is drawn`);
});

test('L4: a badge is the agent\'s letter in its shape and colour, hidden from a screen reader because the name is always written next to it', async () => {
  await withLook({}, async (page) => {
    const badge = makeBadge(page.document, 'Lighting and electrical', 'badge-large');
    assert.equal(badge.className, 'agent-badge badge-large');
    assert.equal(badge.textContent, 'L');
    assert.equal(badge.getAttribute('data-agent'), 'lighting');
    assert.equal(badge.getAttribute('data-shape'), 'triangle');
    assert.equal(badge.getAttribute('aria-hidden'), 'true');
    const unknown = makeBadge(page.document, 'Layout');
    assert.equal(unknown.textContent, '?');
    assert.equal(unknown.getAttribute('data-agent'), 'neutral');
  });
  const css = readDoc('styles.css');
  for (const a of AGENT_INFO) assert.match(css, new RegExp(`\\[data-agent="${a.key}"\\] \\{ --badge-fill: var\\(--agent-${a.key}\\); \\}`));
  assert.match(css, /\.agent-badge \{[^}]*color: var\(--agent-ink\)/);
});

// ---- The page ----------------------------------------------------------------------------------------------------------------------

test('L4: the Agents page has one card per agent, in order, each with a badge, its name, what it owns, its status, its proposals and its own setting', async () => {
  await withLook({}, async (page) => {
    page.el('choose-own').click();
    page.el('rail-agents').click();
    assert.equal(cards(page).length, 8);
    AGENT_INFO.forEach((info, i) => {
      const card = cards(page)[i];
      assert.equal(card.id, `agent-card-${info.key}`);
      assert.equal(card.getAttribute('data-agent'), info.key);
      assert.equal(card.tagName, 'LI');
      const [head, owns, status, slot] = card.children;
      assert.equal(head.children[0].textContent, info.letter, 'the icon: the agent\'s badge');
      assert.equal(head.children[1].textContent, `${i + 1}. ${info.name}`);
      assert.equal(head.children[1].tagName, 'H3');
      assert.equal(owns.textContent, `Owns: ${info.owns}`);
      assert.equal(status.textContent, 'Status: It starts when you step through the agents from the last step of your project.');
      assert.equal(slot.id, `agent-slot-${info.key}`);
      assert.ok(inCard(card, `agent-history-${info.key}`));
      const select = inCard(card, `agent-level-${info.key}`);
      assert.equal(select.tagName, 'SELECT');
      assert.ok(walk(card).some((n) => n.tagName === 'LABEL' && n.getAttribute('for') === `agent-level-${info.key}` && n.textContent === `How should ${info.name} ask you?`));
    });
    assert.equal(page.el('agents-cards').getAttribute('aria-label'), 'The eight agents, in order');
    assert.match(page.el('agents-run-hint').textContent, /^No agent has run yet\./);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L4: the legend on the Agents page lists each agent with its badge, name and what it owns, and says colour is never the only signal', async () => {
  await withLook({}, async (page) => {
    const items = page.el('agents-legend-list').children;
    assert.equal(items.length, 8);
    AGENT_INFO.forEach((info, i) => {
      assert.equal(items[i].children[0].textContent, info.letter);
      assert.equal(items[i].children[0].getAttribute('data-shape'), info.shape);
      assert.match(items[i].children[1].textContent, new RegExp(`^${info.name} ${info.owns.slice(0, 20)}`));
    });
    assert.match(html, /<p id="agents-legend-note" class="hint">Each agent has its own colour, letter and shape\. The colour is never the only signal\.<\/p>/);
  });
});

test('L4: the sample\'s cards show what the fixed script did: each agent\'s proposals with the answer and who answered', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.match(page.el('agents-run-hint').textContent, /^This is the sample\. A fixed script, not a person, answered every proposal\./);
    for (const info of AGENT_INFO) {
      const status = inCard(cardFor(page, info.key), `agent-status-${info.key}`);
      assert.match(status.textContent, /^Status: (Made \d+ proposals?\.|Ran and had nothing to propose\.)/, `${info.name}: ${status.textContent}`);
    }
    const walls = walk(inCard(cardFor(page, 'walls'), 'agent-history-walls')).map((n) => n.textContent).join(' ');
    assert.match(walls, /Rule-based/);
    assert.match(walls, /\(scripted answer\)/);
    const furniture = inCard(cardFor(page, 'furniture'), 'agent-history-furniture').children.map((li) => li.textContent).join('\n');
    assert.match(furniture, /Skip: kept as it is/, 'the sofa suggestion skipped on purpose is shown as skipped');
    // Re-checks are said in words, with no internal ids.
    const notes = inCard(cardFor(page, 'doors'), 'agent-notes-doors').children.map((li) => li.textContent).join('\n');
    assert.match(notes, /Re-checked/);
    for (const text of [furniture, notes, walls]) assert.doesNotMatch(text, /item-\d/);
    const log = page.el('agents-log').children.map((li) => li.textContent);
    assert.ok(log.length > 20);
    assert.ok(log.every((line) => !/item-\d/.test(line)));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L4: while an agent asks, its proposals are in its own card with Confirm, Custom and Skip, and no other card has them', async () => {
  await withLook({ storage: savedSettings('ask') }, async (page) => {
    fillOwnProject(page);
    stepButton(page).click();
    assert.equal(page.document.body.dataset.page, 'agents', 'the workspace opened the Agents page');
    assert.equal(heading(page), 'Walls');
    const slot = (key) => inCard(cardFor(page, key), `agent-slot-${key}`);
    assert.ok(slot('walls').children.includes(page.el('team-proposals')), 'the proposals sit in the Walls card');
    for (const key of AGENT_INFO.map((a) => a.key).filter((k) => k !== 'walls')) assert.equal(slot(key).children.length, 0, `${key} has none`);
    const first = proposalItems(page)[0];
    const words = buttons(first).map((b) => b.textContent);
    assert.ok(words.some((t) => /^Confirm: /.test(t)));
    assert.ok(words.some((t) => /^Custom: /.test(t)));
    assert.ok(words.some((t) => /^Skip: /.test(t)));
    const status = inCard(cardFor(page, 'walls'), 'agent-status-walls').textContent;
    assert.match(status, /^Status: \d+ proposals wait for your answer\.$/);
    assert.equal(cardFor(page, 'walls').getAttribute('data-state'), 'now');
    assert.equal(cardFor(page, 'doors').getAttribute('data-state'), 'waiting');
    // Answer them, go on: the proposals move to the next agent's card.
    answerWaiting(page);
    assert.match(inCard(cardFor(page, 'walls'), 'agent-status-walls').textContent, /^Status: All its proposals are answered\. Press Continue to the next agent\.$/);
    const done = walk(inCard(cardFor(page, 'walls'), 'agent-history-walls')).map((n) => n.textContent).join(' ');
    assert.match(done, /Confirm: /);
    assert.match(done, /\(user\)/);
    continueButton(page).click();
    assert.equal(heading(page), 'Doors and windows');
    assert.ok(slot('doors').children.includes(page.el('team-proposals')));
    assert.equal(slot('walls').children.length, 0);
    assert.equal(cardFor(page, 'walls').getAttribute('data-state'), 'done');
    // Skip is an answer too: the item is kept as it is.
    answerWaiting(page, 'skip');
    const skipped = proposalItems(page).map((li) => answerLineOf(li).textContent);
    assert.ok(skipped.every((t) => t === 'Your answer: Skip. The item is kept as it is.'));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L4: the panel at the top of the Agents page (progress, the eight steps, the Continue button) is the same panel as before, and the proposals come back to it when the run ends', async () => {
  await withLook({ storage: savedSettings('auto') }, async (page) => {
    fillOwnProject(page);
    assert.equal(page.el('team-run').hidden, true);
    stepButton(page).click();
    assert.equal(page.el('team-run').hidden, false);
    assert.equal(page.el('team-progress').textContent, 'Agent 1 of 8');
    const steps = page.el('team-agents').children.map((li) => li.textContent);
    assert.deepEqual(steps.map((t) => t.replace(/^\d\. /, '').replace(/: (done|now|waiting)$/, '')), ORDER);
    assert.equal(page.el('team-agents').children[0].getAttribute('aria-current'), 'step');
    // The review step says where the agents are shown.
    assert.ok(html.indexOf('id="team-run"') > html.indexOf('id="page-agents"'), 'the panel lives on the Agents page');
    await runToEnd(page);
    assert.equal(page.el('team-run').hidden, true);
    assert.equal(page.el('team-proposals').children.length, 0);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L4: after the run the cards show your own run: what each agent proposed, how it was answered, and what was re-checked', async () => {
  await withLook({ storage: savedSettings('auto') }, async (page) => {
    fillOwnProject(page);
    stepButton(page).click();
    await runToEnd(page);
    page.el('rail-agents').click();
    assert.match(page.el('agents-run-hint').textContent, /^This is the finished run of your project\./);
    const lights = inCard(cardFor(page, 'lighting'), 'agent-history-lighting').children.map((li) => li.textContent).join('\n');
    assert.match(lights, /Rule-based/);
    assert.match(lights, /Auto-confirmed\./);
    assert.match(lights, /\(Auto-confirmed\)/);
    assert.match(inCard(cardFor(page, 'lighting'), 'agent-status-lighting').textContent, /^Status: Made \d+ proposals\./);
    const logs = page.el('agents-log').children.map((li) => li.textContent);
    assert.ok(logs.some((l) => /Auto-confirmed/.test(l)));
    assert.deepEqual(page.problemLines(), []);
  });
});

// ---- The status words, as plain logic ---------------------------------------------------------------------------------------------

test('L4: the status words are true: waiting, asking, done, looked again, switched off, not started, and no record', () => {
  const order = ORDER;
  const team = {
    agents: [
      { name: 'Walls', status: 'Ran', proposalCount: 2, summary: 'Made 2 proposals.', passes: [], notes: [] },
      { name: 'Doors and windows', status: 'Re-checked', proposalCount: 1, summary: 'Made 1 proposal.', passes: [], notes: [] },
      { name: 'Floors and ceilings', status: 'Ran', proposalCount: 0, summary: 'Ran and had nothing to propose.', passes: [], notes: [] },
      { name: 'Lighting and electrical', status: 'Switched off', proposalCount: 0, summary: 'Switched off in its config, so it did nothing.', passes: [], notes: [] },
      { name: 'Furniture', status: 'Did not run', proposalCount: 0, summary: 'Did not run.', passes: [], notes: [] },
    ],
  };
  const at = (name, i, extra) => statusOf(name, i, extra);
  assert.deepEqual(at('Walls', 0, { live: null, team: null, hasRun: false }), { state: 'waiting', short: 'Not started', long: 'It starts when you step through the agents from the last step of your project.' });
  assert.equal(at('Walls', 0, { live: null, team, hasRun: true }).short, 'Done: 2 proposals');
  assert.equal(at('Doors and windows', 1, { live: null, team, hasRun: true }).short, 'Done, looked again');
  assert.equal(at('Doors and windows', 1, { live: null, team, hasRun: true }).state, 'rechecked');
  assert.equal(at('Floors and ceilings', 2, { live: null, team, hasRun: true }).short, 'Done, nothing to propose');
  assert.equal(at('Lighting and electrical', 3, { live: null, team, hasRun: true }).state, 'off');
  assert.equal(at('Furniture', 4, { live: null, team, hasRun: true }).short, 'Did not run');
  assert.equal(at('Decor', 5, { live: null, team, hasRun: true }).short, 'No record');
  const live = { order, current: 'Doors and windows', kind: 'recheck', waiting: 1 };
  assert.equal(at('Walls', 0, { live, team: null, hasRun: true }).short, 'Done');
  assert.equal(at('Doors and windows', 1, { live, team: null, hasRun: true }).short, 'Asking: 1 to answer');
  assert.match(at('Doors and windows', 1, { live, team: null, hasRun: true }).long, /^Looking again at out-of-date items\. 1 proposal waits for your answer\.$/);
  assert.equal(at('Style', 6, { live, team: null, hasRun: true }).short, 'Waiting');
  assert.equal(at('Doors and windows', 1, { live: { ...live, waiting: 0 }, team: null, hasRun: true }).short, 'Finished, press Continue');
});

test('L4: proposal rows, notes and log lines say things in words and carry the tag, the answer and who answered', () => {
  const agent = {
    name: 'Walls',
    passes: [{ kind: 'first pass', proposals: [
      { item: 'Walls of Den', why: 'Use these walls.', tag: 'Rule-based', rule: 'walls-size', answer: 'Confirm: Use these walls for Den', answeredBy: 'auto-confirmed', applied: true },
      { item: 'Walls of Hall', why: 'Use these walls.', tag: 'Rule-based', rule: 'walls-size', answer: 'Skip: kept as it is', answeredBy: 'user', applied: false },
      { item: 'Walls of Loft', why: 'Use these walls.', tag: 'Rule-based', rule: 'walls-size', answer: 'not answered', applied: false },
    ] }],
    notes: [{ event: 'needs-look', text: 'Locked item "Oak bed" is out of date.' }, { event: 're-check', text: 'Looks again.' }],
  };
  const rows = proposalRows(agent);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].auto, true);
  assert.equal(rows[0].text, 'Walls of Den. Use these walls. Confirm: Use these walls for Den (Auto-confirmed).');
  assert.equal(rows[1].auto, false);
  assert.equal(rows[2].answer, 'not answered');
  assert.deepEqual(noteRows(agent), ['Needs your look: Locked item "Oak bed" is out of date.', 'Re-checked: Looks again.']);
  assert.deepEqual(noteRows(undefined), []);
  assert.deepEqual(proposalRows(undefined), []);
  const lines = logFromTeam({ agents: [agent] });
  assert.equal(lines[0].text, 'Rule-based: Walls of Den. Confirm: Use these walls for Den (Auto-confirmed).');
  assert.equal(lines[0].auto, true);
  assert.equal(lines.length, 3 + 2);
  assert.deepEqual(logFromTeam(null), []);
  const live = logFromRows([{ agent: 'Walls', tag: 'Rule-based', what: 'Auto-confirmed', details: 'item: Walls of Den. choice go' }, { agent: 'Walls', tag: 'Rule-based', what: 'Finished', details: '' }]);
  assert.deepEqual(live.map((l) => l.auto), [true, false]);
  assert.equal(live[1].text, 'Rule-based: Finished');
});
