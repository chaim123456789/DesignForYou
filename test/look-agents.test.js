// look-and-feel Task 3: the Agents page. One card per agent, colour AND letter AND shape, live proposals inside the asking card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installImportHooks } from '../test-helpers/hooks.js';
import { readDoc, themeValues } from '../test-helpers/fake-page.js';
import { AGENTS } from '../docs/agent-info.js';
import { withLookPage, fillProject, stepButton, currentAgent, liveItems, answerOne, answerAll, continueButton, runToEnd, walk, buttons, textOf } from '../test-helpers/look-page.js';

installImportHooks();
const ORDER = ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer'];

test('look-and-feel T3: the eight agents are the registry order, each with its own colour, letter and shape', () => {
  assert.deepEqual(AGENTS.map((a) => a.name), ORDER);
  const registry = JSON.parse(readFileSync(new URL('../src/agents/registry.json', import.meta.url), 'utf8'));
  assert.deepEqual(AGENTS.map((a) => a.name), registry.agents.map((a) => a.name), 'same names and order as the one registry');
  for (const field of ['letter', 'shape', 'key', 'colourVar']) assert.equal(new Set(AGENTS.map((a) => a[field])).size, 8, `${field} is different for every agent`);
  const t = themeValues('light');
  assert.equal(new Set(AGENTS.map((a) => t[a.colourVar].toLowerCase())).size, 8, 'eight different colours');
  for (const a of AGENTS) assert.match(a.letter, /^[A-Z]$/);
});

// Colour-blind safety: the eight colours are the Okabe and Ito set (made for this), and they stay apart in a simulation of the three
// kinds of colour blindness (delta E of at least 6, "clearly different" in a side by side view). The letter and the shape carry the meaning anyway, so colour is never the only signal.
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgbLin = (hex) => [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
const SIM = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const toLab = (c) => {
  const [r, g, b] = c;
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('look-and-feel T3: the agent colours are the colour-blind-safe Okabe and Ito set, and stay apart for the three kinds of colour blindness', () => {
  const t = themeValues('light');
  const OKABE_ITO = ['#999999', '#0072b2', '#009e73', '#f0e442', '#e69f00', '#cc79a7', '#56b4e9', '#d55e00']; // grey stands in for black
  assert.deepEqual(AGENTS.map((a) => t[a.colourVar].toLowerCase()), OKABE_ITO);
  const colours = AGENTS.map((a) => rgbLin(t[a.colourVar]));
  for (const [kind, m] of Object.entries(SIM)) {
    const seen = colours.map((c) => toLab(m.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])))));
    let closest = Infinity;
    for (let i = 0; i < 8; i += 1) for (let j = i + 1; j < 8; j += 1) closest = Math.min(closest, dE(seen[i], seen[j]));
    console.log(`  closest pair of the eight colours under ${kind}: delta E ${closest.toFixed(1)}`);
    assert.ok(closest >= 6, `${kind}: two agent colours are too close (${closest.toFixed(1)})`);
  }
});

test('look-and-feel T3: the Agents page has one card per agent with its name, what it owns, status and its own setting', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    const cards = page.el('agent-cards').children;
    assert.equal(cards.length, 8);
    cards.forEach((card, i) => {
      const text = textOf(card);
      assert.ok(text.includes(ORDER[i]), `card ${i} names ${ORDER[i]}`);
      assert.match(text, /Owns: /);
      assert.match(text, /Status: /);
      const badge = walk(card).find((n) => n.className.split(' ').includes('badge'));
      assert.equal(badge.textContent, AGENTS[i].letter);
      assert.equal(badge.getAttribute('data-agent'), AGENTS[i].key);
      assert.ok(badge.getAttribute('data-shape'));
      assert.ok(walk(card).some((n) => n.tagName === 'SELECT'), 'a setting for this agent');
      assert.ok(walk(card).some((n) => n.tagName === 'LABEL' && /How .* proposals are confirmed/.test(n.textContent)), 'with a visible label');
    });
    assert.equal(page.el('agent-legend').children.length, 8);
    assert.equal(page.el('agent-legend-3d').children.length, 8);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T3: the sample run shows each agent\'s proposals read only, with who answered', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('rail-agents').click();
    assert.match(page.el('agents-mode').textContent, /sample run/);
    const walls = textOf(page.el('agent-cards').children[0]);
    assert.match(walls, /Confirmed by: scripted answer/);
    assert.equal(buttons(page.el('agent-cards').children[0]).length, 0, 'no Confirm buttons on a finished run');
    assert.ok(page.el('agent-log').children.length > 10);
    assert.equal(page.el('log-empty').hidden, true);
  });
});

test('look-and-feel T3: before any run every agent says it has not started', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('result-back').click();
    page.el('start-again').hidden = false;
    page.el('choose-own').click();
    page.el('rail-agents').click();
    assert.match(page.el('agents-mode').textContent, /No run yet/);
    for (const card of page.el('agent-cards').children) assert.match(textOf(card), /Not started yet/);
  });
});

test('look-and-feel T3: a live run puts the proposals inside the card of the asking agent, with Confirm, Skip and Custom that work', async () => {
  await withLookPage(async (page) => {
    fillProject(page);
    stepButton(page).click();
    assert.equal(page.el('screen-agents').hidden, false, 'the visitor is taken to the Agents page');
    const cards = page.el('agent-cards').children;
    assert.equal(cards[0].getAttribute('data-active'), 'true');
    assert.ok(walk(cards[0]).includes(page.el('team-proposals')), 'the live proposals are inside the Walls card');
    assert.match(textOf(cards[0]), /Asking you now/);
    assert.match(textOf(cards[1]), /Waiting for its turn/);
    const li = liveItems(page)[0];
    const words = buttons(li).map((b) => b.textContent.split(':')[0]);
    assert.ok(words.includes('Confirm') && words.includes('Skip') && words.includes('Custom'));
    // Skip keeps the item as it is; Confirm applies.
    answerOne(page, li, 'Skip');
    assert.match(textOf(li), /Skip\. The item is kept as it is/);
    answerAll(page, 'Confirm');
    assert.match(textOf(cards[0]), /Done|Finished this step/);
    continueButton(page).click();
    assert.equal(currentAgent(page), 'Doors and windows');
    assert.ok(walk(cards[1]).includes(page.el('team-proposals')), 'the list moved to the next card');
    assert.match(textOf(cards[0]), /answered/, 'the first card keeps its answers');
    // The strip says what each agent is doing.
    const strip = page.el('strip-list').children.map((li) => textOf(li));
    assert.match(strip[0], /Done/);
    assert.match(strip[1], /Asking|Done/);
    assert.match(strip[7], /Waiting/);
    const end = await runToEnd(page);
    assert.equal(end[end.length - 1], 'Reviewer');
    assert.ok(end.length >= 7, 'every agent after Walls was asked in turn');
    assert.equal(page.el('screen-result').hidden, false);
    page.el('rail-agents').click();
    assert.match(page.el('agents-mode').textContent, /your own project/);
    assert.deepEqual(page.problemLines(), []);
  });
});
