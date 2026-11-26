// Intake Task 12: accessibility and privacy checks.
//
// What these tests do: read the REAL docs/index.html, docs/styles.css and every page script, run the REAL
// page scripts on the stand-in page (test-helpers/fake-page.js), and compute colour contrast from the colour
// values written in the stylesheet.
// What they CANNOT show (written as "pending owner check" in the checklist): how anything looks, a real phone
// or a 320 px wide screen, zoom to 200%, the keyboard focus ring on a real screen, a screen reader, WebGL,
// the browser's own enforcement of the content security rule, and the real tab key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc, readStyles, themeVariables, shownByDefault, drawnPartCount, recordingStorage, installStorage } from '../test-helpers/fake-page.js';
import { buildScene, shapeParts } from '../docs/scene-data.js';
import { FIXED_SENTENCE } from '../docs/intake/report.js';
import * as stateApi from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { makeSummaryHtml } from '../docs/engine/summary/make-summary.js';

installImportHooks();

const html = readDoc('index.html');
const css = readStyles();
const sample = JSON.parse(readDoc('sample-run.json'));
const SAMPLE_LAST = sample.versions.length;
let caseNumber = 40000;

// ---- The page on the stand-in page ---------------------------------------------------------------

function stubPreviewAddresses() {
  const real = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let n = 0;
  URL.createObjectURL = () => { n += 1; return `blob:test/${n}`; };
  URL.revokeObjectURL = () => {};
  return { restore() { URL.createObjectURL = real.create; URL.revokeObjectURL = real.revoke; } };
}

async function openAll(configure = () => {}) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  const urls = stubPreviewAddresses();
  page.el('heading-result').textContent = 'Sample two-storey home'; // the stand-in does not read the heading's text from index.html
  globalThis.confirm = () => true;
  caseNumber += 1;
  await import(`../docs/viewer.js?case=a11y-${caseNumber}`);
  await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the viewer script to finish');
  await import(`../docs/intake/screens.js?case=a11y-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { page, restore: () => { delete globalThis.confirm; delete globalThis.designForYouViewer; urls.restore(); restore(); } };
}
async function withAll(configure, body) {
  const opened = await openAll(configure);
  try { await body(opened.page); } finally { opened.restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const textOf = (node) => node.textContent;
function allNodes(page) {
  const seen = new Set();
  for (const root of page.elements) for (const n of walk(root)) seen.add(n);
  return [...seen];
}
function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
function goBackTo(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('back-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `went back to ${id}`);
}
const roomId = (select, name) => {
  const option = walk(select).find((n) => n.tagName === 'OPTION' && n.textContent === name);
  assert.ok(option, `the choice "${name}" is offered`);
  return option.value;
};

// A whole visit: every screen filled in, including images, notes, an override, a brief, an answer and items.
function fillEverything(page, { imageName = 'photo-1.png' } = {}) {
  page.el('choose-own').click();
  page.el('project-name').value = 'My home';
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = 'Ground floor';
  page.el('add-floor').click();
  for (const room of ['Kitchen', 'Bedroom']) { page.el('room-name').value = room; page.el('add-room').click(); }
  gotoStep(page, 'inspiration');
  page.el('note-text').value = 'linen';
  page.el('add-note').click();
  page.el('image-file').files = [{ name: imageName, type: 'image/png', size: 2000 }, { name: 'photo-2.png', type: 'image/png', size: 2000 }];
  page.el('image-file').dispatch('change');
  gotoStep(page, 'overrides');
  page.el('override-room').value = roomId(page.el('override-room'), 'Bedroom');
  page.el('override-room').dispatch('change');
  page.el('override-note-text').value = 'cold steel';
  page.el('add-override-note').click();
  gotoStep(page, 'brief');
  page.el('brief-text').value = 'A calm home.';
  page.el('brief-text').dispatch('input');
  gotoStep(page, 'taste');
  const radio = walk(page.el('taste-questions')).find((n) => n.id === 'taste-light-light');
  radio.checked = true;
  radio.dispatch('change');
  gotoStep(page, 'items');
  page.el('item-text').value = 'Oak floor';
  page.el('item-room').value = roomId(page.el('item-room'), 'Bedroom');
  page.el('item-status-locked').checked = true;
  page.el('item-tag').value = 'warm oak';
  page.el('add-item').click();
}
async function runIt(page) {
  gotoStep(page, 'review');
  page.el('run-design-team').click();
  await waitFor(() => page.el('screen-result').hidden === false || page.el('run-failure').hidden === false, 'the run to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
}

// ==== The fixed sentence on the sample result screen (approved addition) ========================

test('Task 12 accessibility: the sample result shows the fixed sentence once, as one line outside the viewer\'s own parts, and the sample is otherwise unchanged', async () => {
  // In the page: inside the result screen, after "Back to start" and before the viewer's own block.
  const start = html.indexOf('<div id="screen-result"');
  const line = html.indexOf('id="sample-fixed-rules"');
  const viewerBlock = html.indexOf('<div id="page-inner">');
  assert.ok(start < line && line < viewerBlock, 'the line sits in the result screen, before the viewer\'s block (so outside col-main, the 3D area and col-side)');
  assert.match(html, /<p id="sample-fixed-rules" class="setup-needs"><\/p>/, 'one plain paragraph, filled in from report.js (one source for the sentence)');
  await withAll(() => {}, async (page) => {
    page.el('choose-sample').click();
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('sample-fixed-rules').textContent, FIXED_SENTENCE);
    assert.equal(page.el('sample-fixed-rules').textContent, 'The design team is a set of fixed rules, not AI. It does not look at your images or read your brief.');
    assert.equal(page.el('sample-fixed-rules').hidden, false);
    // Everything else on the sample is as before: labels, heading, the drawing, no new network call.
    assert.equal(page.document.body.dataset.screen, 'result');
    assert.ok(page.document.querySelectorAll('.label-sample').every((p) => p.hidden === false), 'SAMPLE PROJECT is shown');
    assert.ok(page.document.querySelectorAll('.label-own').every((p) => p.hidden === true));
    assert.equal(page.el('heading-result').textContent, 'Sample two-storey home');
    const drawn = page.scene.children.find((c) => c.type === 'Group').children.filter((o) => o.userData && o.userData.boxKey).map((o) => o.userData.boxKey).sort();
    // D6: the design-team sample has furniture with a type, which is drawn as several parts, each with the box's key.
    // Look-and-feel L6: only the layers on by default are drawn, and a round table has a top and one pedestal.
    assert.deepEqual(drawn, buildScene(sample, SAMPLE_LAST).filter(shownByDefault).flatMap((b) => Array(drawnPartCount(b)).fill(b.key)).sort());
    assert.deepEqual(page.log.filter((l) => l.startsWith('fetch:')), ['fetch:sample-run.json']);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
    assert.equal(page.el('own-result').hidden, true);
    // The viewer's own parts do not contain the line.
    for (const id of ['how-to-use', 'view-controls', 'scene-area', 'col-side']) assert.ok(!walk(page.el(id)).some((n) => n.id === 'sample-fixed-rules'));
    // A visitor's own result does not show it twice (it has its own, at the end), and Start again brings it back.
    page.el('result-back').click();
    fillEverything(page);
    await runIt(page);
    assert.equal(page.el('sample-fixed-rules').hidden, true);
    assert.equal(page.el('result-fixed-rules').textContent, FIXED_SENTENCE);
    page.el('result-start-again').click();
    page.el('choose-sample').click();
    assert.equal(page.el('sample-fixed-rules').hidden, false);
    assert.equal(page.el('sample-fixed-rules').textContent, FIXED_SENTENCE);
  });
});

// ==== Contrast, computed from the colour values in the theme ====================================
// Look-and-feel L1: every colour is written once, in docs/theme.css, for the dark and the light theme. The pairs below are the colours the
// stylesheet puts on top of each other (a text colour on its background, a border on its surface). Both themes are checked.

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const [r, g, b] = channels(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const AGENT_KEYS = ['walls', 'doors', 'floors', 'lighting', 'furniture', 'decor', 'style', 'reviewer'];
// Each pair is [name, foreground variable, background variable, smallest ratio]. 'text' pairs need 4.5 to 1, 'part' pairs (a border, a focus ring) need 3.
function themePairs() {
  const T = (name, fg, bg) => [name, fg, bg, 4.5];
  const P = (name, fg, bg) => [name, fg, bg, 3];
  return [
    T('Page text on the page background', '--text', '--bg'),
    T('Page text on a panel', '--text', '--surface'),
    T('Page text on a list row', '--text', '--surface-2'),
    T('Page text on a hovered control', '--text', '--surface-3'),
    T('Muted text on the page background', '--text-muted', '--bg'),
    T('Muted text on a panel', '--text-muted', '--surface'),
    T('Muted text on a list row', '--text-muted', '--surface-2'),
    T('Muted text on a hovered control', '--text-muted', '--surface-3'),
    T('Fainter text on the page background', '--text-faint', '--bg'),
    T('Top and bottom bar text', '--bar-text', '--bar-bg'),
    T('Muted text on the bars', '--text-muted', '--bar-bg'),
    T('Red message and error text on their background', '--danger', '--danger-bg'),
    T('Error text in a panel', '--danger', '--surface'),
    T('Error text on the page', '--danger', '--bg'),
    T('Error text in a list row', '--danger', '--surface-2'),
    T('Status announcement text', '--note-text', '--note-bg'),
    T('Text on a main button (Next, Start my own project)', '--accent-ink', '--accent'),
    T('Text on a selected rail page', '--text', '--accent-soft'),
    T('Accent text on the page', '--accent', '--bg'),
    T('Text in text boxes', '--text', '--surface-2'),
    T('Block name label in 3D', '--text', '--surface'),
    T('Muted label text in 3D', '--text-muted', '--surface'),
    T('Muted text on the 3D background', '--text-muted', '--three-background'),
    ...AGENT_KEYS.map((k) => T(`Letter on the ${k} badge`, '--agent-ink', `--agent-${k}`)),
    ...AGENT_KEYS.map((k) => P(`The ${k} colour on a panel`, `--agent-${k}`, '--surface')),
    ...AGENT_KEYS.map((k) => P(`The ${k} colour on the page`, `--agent-${k}`, '--bg')),
    P('Text box and button border on a panel', '--line-control', '--surface'),
    P('Text box border on a list row', '--line-control', '--surface-2'),
    P('Button border on the page', '--line-control', '--bg'),
    P('Keyboard focus ring on the page', '--focus', '--bg'),
    P('Keyboard focus ring in a panel', '--focus', '--surface'),
    P('Keyboard focus ring in a list row', '--focus', '--surface-2'),
    P('Keyboard focus ring on the status line', '--focus', '--note-bg'),
    P('Keyboard focus ring over the 3D area', '--focus', '--three-background'),
    P('Keyboard focus ring in the "could not finish" box', '--focus', '--danger-bg'),
    P('Bar beside an error message', '--danger-line', '--surface'),
    P('Clash red on the legend background', '--three-clash', '--surface'),
    P('Clash red on the pale floor slab in 3D', '--three-clash', '--three-slab'),
    P('Locked edge on the floor slab in 3D', '--three-locked-edge', '--three-slab'),
    P('Locked edge on the 3D background', '--three-locked-edge', '--three-background'),
    P('Room outline in 3D on the 3D background', '--three-room', '--three-background'),
  ];
}

function checkContrast(theme, variables = themeVariables(theme)) {
  const rows = themePairs().map(([name, fg, bg, min]) => {
    assert.ok(variables[fg] && variables[bg], `missing colour for: ${name} (${fg} on ${bg})`);
    return { name, fg: variables[fg], bg: variables[bg], min, ratio: ratio(variables[fg], variables[bg]) };
  });
  return { rows, failures: rows.filter((r) => r.ratio < r.min) };
}

test('Task 12 accessibility: every text colour pair reaches 4.5 to 1 and every border and focus colour reaches 3 to 1, in the dark and the light theme (numbers printed)', () => {
  for (const theme of ['dark', 'light']) {
    const { rows, failures } = checkContrast(theme);
    console.log(`Contrast in the ${theme} theme, computed from the colour values in docs/theme.css (needs: text 4.5, parts 3.0):`);
    for (const r of rows) console.log(`  ${r.ratio.toFixed(2).padStart(5)} to 1  (needs ${r.min})  ${r.fg} on ${r.bg}  ${r.name}${r.ratio < r.min ? '   <-- BELOW' : ''}`);
    assert.ok(rows.length >= 55, 'the table is not empty');
    assert.deepEqual(failures.map((f) => f.name), [], `${theme}: no pair is below its limit; anything below is a new problem`);
  }
});

test('Task 12 accessibility: the stylesheet and the page scripts write no colour of their own; every colour is in the theme file and in the contrast table', () => {
  const plain = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(plain(readDoc('styles.css')), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, 'styles.css has a colour of its own');
  assert.doesNotMatch(plain(html), /#[0-9a-fA-F]{6}\b/, 'index.html has a colour of its own');
  // Every colour variable of the theme is in the table (a decoration-only colour is listed on purpose), in both themes.
  const used = new Set(themePairs().flatMap(([, fg, bg]) => [fg, bg]));
  const DECORATION = ['--bg-glow', '--line', '--three-slab-edge', '--three-door-edge', '--three-window-edge', '--three-sky', '--three-ground', '--three-neutral',
    '--agent-neutral', '--accent-soft', '--note-line', '--plan-room-fill', '--plan-room-line', '--plan-locked-fill', '--plan-locked-line', '--plan-unsure-fill',
    '--plan-unsure-line', '--plan-ink', '--three-locked-edge'];
  for (const theme of ['dark', 'light']) {
    const colours = Object.entries(themeVariables(theme)).filter(([, value]) => /^#[0-9a-fA-F]{6}$/.test(value)).map(([name]) => name);
    const unchecked = colours.filter((name) => !used.has(name) && !DECORATION.includes(name));
    assert.deepEqual(unchecked, [], `${theme}: a colour in the theme has no contrast check`);
  }
  // The legend swatch for Clash has the clash colour of the 3D view (one colour, one place).
  assert.match(plain(readDoc('styles.css')), /\.swatch-clash \{[^}]*var\(--three-clash\)/);
});

test('Task 12 accessibility: the contrast check fails when a colour is made too light (planted change in a copy)', () => {
  for (const theme of ['dark', 'light']) assert.equal(checkContrast(theme).failures.length, 0);
  const light = themeVariables('light');
  const planted = { ...light, '--text-muted': '#aaaaaa' };
  assert.ok(checkContrast('light', planted).failures.some((f) => f.name === 'Muted text on a panel'));
  const plantedFocus = { ...themeVariables('dark'), '--focus': '#16181c' };
  assert.ok(checkContrast('dark', plantedFocus).failures.some((f) => f.name.startsWith('Keyboard focus ring')));
});

// ==== Structure: language, zoom, headings, labels, status region, tab order =====================

const screenIds = [...html.matchAll(/<div id="screen-(\w+)"/g)].map((m) => m[1]);
const blockOf = (id) => {
  const from = html.indexOf(`<div id="screen-${id}"`);
  const next = screenIds[screenIds.indexOf(id) + 1];
  // Look-and-feel L2: the start screen is the home page and ends where the workspace begins.
  const to = id === 'start' ? html.indexOf('<div id="workspace"') : next ? html.indexOf(`<div id="screen-${next}"`) : html.indexOf('<div id="step-nav"');
  return html.slice(from, to);
};

test('Task 12 accessibility: the page has a language, a zoomable viewport tag, a title, one main area, and every screen but Start starts hidden', () => {
  assert.match(html, /^<!DOCTYPE html>\s*<html lang="en" data-theme="dark">/);
  const viewport = /<meta name="viewport" content="([^"]*)">/.exec(html);
  assert.ok(viewport, 'a viewport tag');
  assert.equal(viewport[1], 'width=device-width, initial-scale=1');
  assert.doesNotMatch(viewport[1], /user-scalable|maximum-scale|minimum-scale/, 'zooming is not blocked');
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.deepEqual(screenIds, ['start', 'setup', 'inspiration', 'overrides', 'brief', 'taste', 'items', 'place', 'review', 'result']);
  for (const id of screenIds) {
    // Look-and-feel: the home page and the result screen have a second class, and the result screen starts on its 3D tab.
    const open = new RegExp(`<div id="screen-${id}" class="screen(?: home| screen-result)?"(?: data-result-tab="3d")?( hidden)?>`).exec(html);
    assert.ok(open, `screen ${id} is a plain block`);
    assert.equal(Boolean(open[1]), id !== 'start', `screen ${id} ${id === 'start' ? 'shows' : 'starts hidden'}`);
  }
  assert.match(css, /\[hidden\] \{ display: none !important; \}/, 'a hidden screen is never shown by a display rule, so its controls are not reachable');
});

test('Task 12 accessibility: each screen has exactly one h1, the heading can take focus, and every id on the page is used once', () => {
  for (const id of screenIds) {
    const block = blockOf(id);
    const headings = [...block.matchAll(/<h1\b([^>]*)>/g)];
    assert.equal(headings.length, 1, `${id}: one h1`);
    assert.match(headings[0][1], new RegExp(`id="heading-${id}"`), `${id}: the h1 is heading-${id}`);
    assert.match(headings[0][1], /tabindex="-1"/, `${id}: the h1 can take focus from code but is not in the tab order`);
    const firstOther = block.search(/<h[2-6]\b/);
    assert.ok(firstOther === -1 || block.indexOf('<h1') < firstOther, `${id}: no smaller heading before the h1`);
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], 'no id is used twice');
});

test('Task 12 accessibility: every text box, list, choice, picker and checkbox in the page has a visible label tied to it, and every button has words', () => {
  const controls = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].map((m) => ({ tag: m[1], attrs: m[2] }))
    .filter((c) => !/type="hidden"/.test(c.attrs));
  assert.ok(controls.length >= 19, `there are controls to check (${controls.length})`);
  for (const c of controls) {
    const id = /\sid="([^"]+)"/.exec(c.attrs);
    assert.ok(id, `a control without an id: ${c.attrs}`);
    const label = new RegExp(`<label\\b[^>]*\\bfor="${id[1]}"[^>]*>([\\s\\S]*?)</label>`).exec(html);
    assert.ok(label, `${id[1]} has a label tied to it`);
    assert.ok(label[1].replace(/<[^>]*>/g, '').trim().length >= 3, `${id[1]}: the label has visible words`);
    assert.doesNotMatch(c.attrs, /placeholder=/, `${id[1]}: a placeholder is not a label`);
  }
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    assert.match(m[1].replace(/<[^>]*>/g, ''), /[A-Za-z]{3}/, `a button with words: ${m[0]}`);
  }
  // The group of Locked or Unsure choices is a fieldset with a legend.
  assert.match(html, /<fieldset id="item-status-group"[^>]*>\s*<legend>Locked or Unsure<\/legend>/);
  // Nothing relies on an icon alone.
  assert.doesNotMatch(html, /<button[^>]*>\s*(?:<svg|<img|&#|[^\w\s<]{1,3}\s*<\/button>)/);
});

test('Task 12 accessibility: there is a polite status region for announcements and alert boxes for problems, and the announcements happen', async () => {
  assert.match(html, /<p id="action-status" class="action-status" role="status" aria-live="polite"><\/p>/);
  assert.match(html, /<div id="error-message" role="alert" hidden><\/div>/);
  assert.match(html, /<div id="intake-error-message" role="alert" hidden><\/div>/);
  assert.match(html, /<div id="run-failure" class="run-failure" role="alert" tabindex="-1" hidden>/);
  assert.match(html, /<section id="details-panel" aria-label="Item details" aria-live="polite">/);
  await withAll(() => {}, async (page) => {
    const said = [];
    const note = () => { const t = page.el('action-status').textContent; if (t && said[said.length - 1] !== t) said.push(t); };
    page.el('choose-own').click();
    page.el('floor-name').value = 'Ground floor'; page.el('add-floor').click(); note();
    page.el('room-name').value = 'Kitchen'; page.el('add-room').click(); note();
    gotoStep(page, 'inspiration');
    page.el('note-text').value = 'linen'; page.el('add-note').click(); note();
    page.el('image-file').files = [{ name: 'a.png', type: 'image/png', size: 100 }]; page.el('image-file').dispatch('change'); note();
    const removeImage = walk(page.el('image-list')).find((n) => n.tagName === 'BUTTON');
    removeImage.click(); note();
    gotoStep(page, 'items');
    page.el('item-text').value = 'Oak floor'; page.el('item-room').value = roomId(page.el('item-room'), 'Kitchen');
    page.el('item-status-unsure').checked = true; page.el('add-item').click(); note();
    walk(page.el('item-list')).find((n) => n.tagName === 'BUTTON' && n.textContent.startsWith('Remove item')).click(); note();
    assert.equal(said.length, 7, said.join(' | '));
    assert.ok(said.every((s) => s.length > 10 && /[a-z]/.test(s)), 'each announcement is a plain sentence');
    assert.match(said[0], /^Floor added/);
    assert.match(said[3], /image/i);
    assert.match(said[4], /^Image removed/);
    assert.match(said[5], /^Item added/);
    assert.match(said[6], /^Item removed/);
  });
});

test('Task 12 accessibility: a message next to a field is tied to it with aria-describedby, and the keyboard focus goes to that field', async () => {
  await withAll(() => {}, async (page) => {
    page.el('choose-own').click();
    const tied = (inputId, errorId) => {
      const error = page.el(errorId);
      assert.equal(error.hidden, false, `${errorId} is shown`);
      assert.ok(error.textContent.length > 8 && !/undefined|\[object/.test(error.textContent), `${errorId}: plain words`);
      assert.ok(page.el(inputId).getAttribute('aria-describedby').split(' ').includes(errorId), `${inputId} is tied to ${errorId}`);
      assert.equal(page.el(inputId).getAttribute('aria-invalid'), 'true');
      assert.equal(page.document.activeElement, page.el(inputId), `${inputId} has the keyboard focus`);
    };
    page.el('floor-name').value = ' '; page.el('add-floor').click(); tied('floor-name', 'floor-name-error');
    page.el('room-name').value = 'Kitchen'; page.el('add-room').click(); tied('room-floor', 'room-floor-error');
    page.el('floor-name').value = 'Ground floor'; page.el('add-floor').click();
    page.el('room-name').value = ' '; page.el('add-room').click(); tied('room-name', 'room-name-error');
    page.el('room-name').value = 'Kitchen'; page.el('room-width').value = 'abc'; page.el('add-room').click(); tied('room-width', 'room-width-error');
    gotoStep(page, 'inspiration');
    page.el('note-text').value = ' '; page.el('add-note').click(); tied('note-text', 'note-error');
    page.el('image-file').files = [{ name: 'a.gif', type: 'image/gif', size: 100 }]; page.el('image-file').dispatch('change');
    assert.equal(page.el('image-error').hidden, false);
    assert.ok(page.el('image-file').getAttribute('aria-describedby').split(' ').includes('image-error'));
    gotoStep(page, 'items');
    page.el('add-item').click();
    tied('item-text', 'item-text-error');
  });
});

test('Task 12 accessibility: every control made by the page scripts, on every screen, has a label tied to it, words on buttons and a text description on pictures', async () => {
  await withAll(() => {}, async (page) => {
    fillEverything(page);
    // Open the rename and remove-with-question rows too.
    goBackTo(page, 'setup');
    walk(page.el('floor-list')).find((n) => n.tagName === 'BUTTON' && n.textContent.startsWith('Rename room')).click();
    walk(page.el('floor-list')).find((n) => n.tagName === 'BUTTON' && n.textContent.startsWith('Remove floor')).click();
    gotoStep(page, 'items');
    walk(page.el('item-list')).find((n) => n.tagName === 'BUTTON' && n.textContent.startsWith('Edit item')).click();
    await runIt(page);
    const nodes = allNodes(page);
    const labels = nodes.filter((n) => n.tagName === 'LABEL');
    const made = nodes.filter((n) => n.parent !== null);
    const controls = made.filter((n) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(n.tagName));
    assert.ok(controls.length >= 8, `controls made by the scripts were found (${controls.length})`);
    for (const c of controls) {
      const inside = (() => { for (let p = c.parent; p; p = p.parent) if (p.tagName === 'LABEL') return true; return false; })();
      const tiedLabel = labels.some((l) => c.id && l.getAttribute('for') === c.id && l.textContent.trim().length >= 3);
      assert.ok(inside || tiedLabel || c.getAttribute('aria-label') || c.getAttribute('aria-labelledby'), `a ${c.tagName} (${c.id || 'no id'}) has a label`);
      assert.equal(c.getAttribute('placeholder'), null, 'no placeholder');
    }
    const buttons = made.filter((n) => n.tagName === 'BUTTON');
    assert.ok(buttons.length >= 8, `buttons made by the scripts were found (${buttons.length})`);
    for (const b of buttons) assert.match(b.textContent, /[A-Za-z]{3}/, `a button with words: "${b.textContent}"`);
    const pictures = made.filter((n) => n.tagName === 'IMG');
    assert.ok(pictures.length >= 2, 'previews and mood board pictures were found');
    for (const img of pictures) assert.match(img.alt || img.getAttribute('alt') || '', /\S{3}/, 'a picture with a text description');
    // Question groups: a fieldset with a legend, radio choices with labels.
    const fieldsets = made.filter((n) => n.tagName === 'FIELDSET');
    assert.ok(fieldsets.length >= 6, 'the six taste questions are fieldsets');
    for (const f of fieldsets) assert.ok(f.children.some((c) => c.tagName === 'LEGEND' && c.textContent.length >= 3), 'each fieldset has a legend');
  });
});

test('Task 12 accessibility: the tab order follows the order on screen (controls in page order, no positive tabindex, no reordering styles)', () => {
  const controlsIn = (block) => [...block.matchAll(/<(?:input|select|textarea|button)\b[^>]*?\sid="([^"]+)"/g)].map((m) => m[1]);
  // The expected order is the order a person reads each screen, top to bottom.
  const expected = {
    start: ['choose-sample', 'choose-own'],
    setup: ['project-name', 'floor-name', 'add-floor', 'room-floor', 'room-name', 'room-width', 'room-depth', 'add-room'],
    inspiration: ['image-target', 'image-file', 'note-text', 'add-note'],
    overrides: ['override-room', 'override-note-text', 'add-override-note', 'remove-override'],
    brief: ['brief-text'],
    taste: ['restore-tags'],
    items: ['item-text', 'item-room', 'item-status-locked', 'item-status-unsure', 'item-tag', 'add-item'],
    place: ['place-room', 'place-type', 'place-name', 'place-status-locked', 'place-status-unsure', 'place-x', 'place-y', 'place-width', 'place-depth', 'add-placed', 'sel-name', 'sel-x', 'sel-y', 'sel-width', 'sel-depth', 'sel-save', 'sel-status', 'nudge-left', 'nudge-right', 'nudge-up', 'nudge-down', 'sel-turn', 'sel-wall'],
    review: ['run-design-team'],
    // Look-and-feel L3 and L6: the ribbon (floors, reset, labels, the six layers) and the result tabs come before the 3D view and the panels.
    result: ['result-back', 'floor-all', 'floor-ground', 'floor-upper', 'reset-view', 'show-all-labels', 'layer-structure', 'layer-openings', 'layer-lighting', 'layer-furniture',
      'layer-decor', 'layer-style', 'tab-3d', 'tab-details', 'tab-report', 'version-slider', 'result-start-again'],
  };
  for (const id of screenIds) assert.deepEqual(controlsIn(blockOf(id)), expected[id], `order on the ${id} screen`);
  const nav = html.indexOf('<div id="step-nav"');
  assert.deepEqual(controlsIn(html.slice(nav, html.indexOf('</div>', nav))), ['back-button', 'start-again', 'next-button'], 'Back, Start again, Next come after the screens, as on screen');
  // The label of a control comes before the control, in the page order, on every screen.
  for (const m of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    const control = html.search(new RegExp(`<(?:input|select|textarea)\\b[^>]*\\sid="${m[1]}"`));
    assert.ok(control >= 0, `${m[1]} exists`);
  }
  // Nothing takes the tab key out of order.
  const sources = [html, ...scannedFiles().filter((f) => f.name.endsWith('.js')).map((f) => f.text)];
  for (const text of sources) assert.doesNotMatch(text, /tabindex\s*=\s*["']?[1-9]|tabIndex\s*=\s*[1-9]|\.tabIndex\s*=\s*[1-9]/, 'no positive tabindex');
  assert.deepEqual([...new Set([...html.matchAll(/tabindex="(-?\d+)"/g)].map((m) => m[1]))], ['-1']);
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(plain, /(?:^|[;{\s])order\s*:|row-reverse|column-reverse|grid-auto-flow\s*:\s*[^;]*dense|grid-row\s*:|grid-column\s*:|position\s*:\s*fixed/, 'no style puts controls in a different order from the page');
  // A control that is hidden is not in the tab order: the stylesheet hides with display:none.
  assert.match(plain, /\[hidden\] \{ display: none !important; \}/);
});

// ==== Privacy: searches over every page file, a planted fault, and the page running ===============

function listFiles(dir, out = []) {
  for (const name of readdirSync(new URL(dir, import.meta.url))) {
    const rel = `${dir}${name}`;
    if (statSync(new URL(rel, import.meta.url)).isDirectory()) { if (name !== 'vendor') listFiles(`${rel}/`, out); } else out.push(rel);
  }
  return out;
}
// Every file the page loads that is ours: docs/ without docs/vendor (the approved Three.js copy).
function scannedFiles() {
  return listFiles('../docs/').filter((f) => /\.(js|html|css)$/.test(f)).map((f) => ({ name: f.replace('../docs/', ''), text: readDoc(f.replace('../docs/', '')) }));
}

const plainJs = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const PRIVACY_RULES = [
  ['browser storage', /\b(localStorage|sessionStorage|indexedDB|openDatabase|caches\.(open|match)|cookieStore)\b/],
  ['cookies', /\.cookie\b/],
  ['other ways to send data', /\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|serviceWorker)\b|new\s+(Worker|SharedWorker)\b/],
  ['web addresses', /https?:\/\/|\bwww\.|(?:src|href|action)\s*=\s*["']\/\/|url\(\s*["']?(?:https?:)?\/\//],
  ['reading what is inside an image file', /\bFileReader\b|\.arrayBuffer\(|createImageBitmap|new\s+Image\s*\(/],
  ['visitor text as page code', /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\b/],
];
// Look-and-feel L5: browser storage is allowed in ONE file, docs/workspace/store.js, for the agent settings and the theme and nothing else.
// A web request is allowed in one place only: docs/viewer.js asks for sample-run.json.
const STORAGE_FILE = 'workspace/store.js';
function privacyProblems(files) {
  const problems = [];
  for (const { name, text } of files) {
    const noComments = name.endsWith('.js') ? text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1') : text;
    for (const [what, pattern] of PRIVACY_RULES) {
      // In the storage file only the word localStorage is allowed; sessionStorage, indexedDB, cookies and the rest are still searched for.
      const searched = what === 'browser storage' && name === STORAGE_FILE ? noComments.replace(/\blocalStorage\b/g, '') : noComments;
      if (pattern.test(searched)) problems.push(`${name}: ${what}`);
    }
    if (name.endsWith('.js')) {
      const calls = noComments.match(/\bfetch\s*\(/g) || [];
      if (name === 'viewer.js') {
        if (calls.length !== 1 || !/const SAMPLE_RUN_FILE = 'sample-run\.json'/.test(noComments) || !/fetch\(SAMPLE_RUN_FILE\)/.test(noComments)) problems.push('viewer.js: a web request other than sample-run.json');
      } else if (calls.length > 0) problems.push(`${name}: a web request`);
      for (const m of noComments.matchAll(/\bimport\s*\(\s*([^)]*)\)/g)) {
        if (/["'`]\s*(?:https?:|\/\/)/.test(m[1])) problems.push(`${name}: a script loaded from another address`);
      }
    }
  }
  return problems;
}

test('Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json', () => {
  const files = scannedFiles();
  const names = files.map((f) => f.name);
  for (const expected of ['index.html', 'styles.css', 'viewer.js', 'scene-data.js', 'intake/screens.js', 'intake/state.js', 'intake/inspiration-screen.js', 'intake/result-screen.js',
    'engine/coordinator.js', 'engine/brain/brain.js', 'engine/summary/make-summary.js']) assert.ok(names.includes(expected), `${expected} is searched`);
  assert.ok(!names.some((n) => n.startsWith('vendor/')), 'the approved Three.js copy is not part of the search');
  assert.ok(files.length >= 30, `${files.length} files searched`);
  assert.deepEqual(privacyProblems(files), []);
  assert.ok(names.includes(STORAGE_FILE), 'the one file that may use browser storage is searched too');
  // That file keeps only the two named things, under names that start with "designforyou.", and nothing else.
  const store = plainJs(readDoc(STORAGE_FILE));
  assert.deepEqual([...store.matchAll(/export const (\w+_KEY) = '([^']+)'/g)].map((m) => m[2]), ['designforyou.agent-settings', 'designforyou.theme']);
  assert.equal((store.match(/\.setItem\(/g) || []).length, 2, 'two places write: the settings and the theme');
  assert.doesNotMatch(store, /getState|appState|\.items\b|\.floors\b|\.brief\b|\.images\b/, 'nothing of the project is read in the storage file');
  const viewer = files.find((f) => f.name === 'viewer.js').text;
  assert.match(viewer, /const SAMPLE_RUN_FILE = 'sample-run\.json'/);
  assert.equal((viewer.match(/\bfetch\(/g) || []).length, 1);
  // The page's content security rule names no other address and allows no inline script, eval or outside images.
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)[1];
  assert.doesNotMatch(csp, /https?:|\*|unsafe-inline|unsafe-eval|data:/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /img-src 'self' blob:/);
});

test('Task 12 privacy: a planted localStorage call, cookie, web request or web address in a copy makes the search fail', () => {
  const files = scannedFiles();
  assert.deepEqual(privacyProblems(files), []);
  const plant = (name, add) => files.map((f) => (f.name === name ? { ...f, text: f.text + `\n${add}\n` } : f));
  const cases = [
    ['intake/state.js', "localStorage.setItem('x', 'y');", 'intake/state.js: browser storage'],
    ['intake/brief-screen.js', "sessionStorage.getItem('x');", 'intake/brief-screen.js: browser storage'],
    ['intake/items-screen.js', "document.cookie = 'a=b';", 'intake/items-screen.js: cookies'],
    ['intake/report.js', "fetch('/save');", 'intake/report.js: a web request'],
    ['engine/coordinator.js', "navigator.sendBeacon('/x');", 'engine/coordinator.js: other ways to send data'],
    ['index.html', '<img src="https://example.test/x.png" alt="x">', 'index.html: web addresses'],
    ['intake/result-screen.js', 'node.innerHTML = text;', 'intake/result-screen.js: visitor text as page code'],
    ['intake/inspiration-screen.js', 'new FileReader();', 'intake/inspiration-screen.js: reading what is inside an image file'],
    ['viewer.js', "fetch('other.json');", 'viewer.js: a web request other than sample-run.json'],
    ['workspace/shell.js', "localStorage.setItem('project', 'x');", 'workspace/shell.js: browser storage'],
    ['workspace/agents-page.js', "sessionStorage.getItem('x');", 'workspace/agents-page.js: browser storage'],
    ['workspace/store.js', "indexedDB.open('x');", 'workspace/store.js: browser storage'],
  ];
  for (const [name, add, expected] of cases) {
    assert.ok(privacyProblems(plant(name, add)).includes(expected), `a planted fault in ${name} is found: ${add}`);
  }
});

// Trap every way a page could keep or send things, then use the whole app, run it, start again and open the sample.
test('Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load', async () => {
  const touched = [];
  const trap = (name) => Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); throw new Error(`${name} must not be used`); } });
  // Look-and-feel L5: localStorage is allowed for the agent settings and the theme (see store.js). A recording stand-in shows that using the
  // whole app writes nothing to it: only a settings or theme change would, and this visit changes neither.
  const trapped = ['sessionStorage', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker'];
  const savedDescriptors = Object.fromEntries(trapped.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  trapped.forEach(trap);
  const recorder = recordingStorage();
  const restoreStorage = installStorage(recorder.storage);
  try {
    await withAll(() => {}, async (page) => {
      Object.defineProperty(page.document, 'cookie', { configurable: true, get() { touched.push('cookie read'); return ''; }, set() { touched.push('cookie write'); } });
      const loadFetches = page.log.filter((l) => l.startsWith('fetch:'));
      assert.deepEqual(loadFetches, ['fetch:sample-run.json'], 'at load the page reads only its own sample file');
      fillEverything(page);
      await runIt(page);
      assert.equal(page.el('screen-result').hidden, false);
      page.el('result-start-again').click();
      page.el('choose-own').click();
      page.el('back-button').click();
      page.el('choose-sample').click();
      const fetches = page.log.filter((l) => l.startsWith('fetch:'));
      assert.deepEqual(fetches, loadFetches, 'no new web request while entering, running, starting again or opening the sample');
      assert.deepEqual(page.problemLines(), []);
    });
  } finally {
    restoreStorage();
    for (const n of trapped) { if (savedDescriptors[n]) Object.defineProperty(globalThis, n, savedDescriptors[n]); else delete globalThis[n]; }
  }
  assert.deepEqual(touched, []);
  assert.deepEqual(recorder.writes, [], 'using the app keeps nothing in the browser');
});

test('Task 12 privacy: an image\'s file name is shown only in the visitor\'s own image list, not in the Project Brain, the summary or the result screen', async () => {
  const SECRET = 'my-private-holiday.png';
  // The pure run: names are not in the Brain or the summary.
  const state = stateApi.createState();
  stateApi.setProjectName(state, 'My home');
  stateApi.addRoom(state, stateApi.addFloor(state, 'Ground').id, 'Kitchen');
  const layer = 'overall';
  assert.equal(stateApi.addImage(state, layer, { name: SECRET, type: 'image/png', size: 1000, caption: 'Sunny window' }, 'blob:x').ok, true);
  const run = runDesignTeam(state);
  assert.equal(run.ok, true);
  assert.ok(!JSON.stringify(run.project).includes(SECRET), 'the Brain does not hold the file name');
  assert.ok(!makeSummaryHtml(run.project).includes(SECRET), 'the summary does not hold the file name');
  assert.equal(run.project.imageCount, 1, 'only the number of images is kept');
  // On the page: the result screen does not show it; the list on the inspiration screen does (that is the visitor's own screen).
  await withAll(() => {}, async (page) => {
    fillEverything(page, { imageName: SECRET });
    goBackTo(page, 'inspiration');
    assert.ok(walk(page.el('image-list')).map(textOf).join(' ').includes(SECRET), 'the visitor sees the name in their own list');
    await runIt(page);
    const resultText = walk(page.el('screen-result')).map((n) => n._text).join(' ');
    assert.ok(!resultText.includes(SECRET), 'the result screen does not show the file name');
  });
});

test('Task 12 privacy: the plain sentences are on the page: nothing leaves the browser, images stay here, nothing is saved, the brief is not read, the draft statement is on every screen', () => {
  const start = blockOf('start');
  assert.match(start, /needs no login, and nothing you enter leaves your browser/);
  assert.match(start, /Nothing is saved\. If you close or reload this page, everything you entered is lost\./);
  assert.match(start, new RegExp(FIXED_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const inspiration = blockOf('inspiration');
  assert.match(inspiration, /id="image-privacy"[^>]*>Your images stay in this browser\. They are not uploaded, not sent anywhere and not saved\./);
  assert.match(inspiration, /<input type="file" id="image-file"[^>]*aria-describedby="image-privacy image-hint">/, 'the sentence is tied to the picker');
  assert.match(blockOf('review'), /Nothing is sent anywhere when you press it\. Your images stay in this browser and are not uploaded\./);
  assert.match(blockOf('brief'), /Your brief is kept with your project and shown in the summary\. The design team does not read it\./);
  assert.match(blockOf('result'), /The 3D view has a text alternative/);
  // The draft statement sits in the top bar and the bottom bar, outside every screen, so it is on every screen.
  for (const tag of ['header', 'footer']) {
    assert.ok(html.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`))[0].includes('Plans are drafts for professional review. They are not verified engineering.'));
  }
  assert.ok(html.indexOf('<header') < html.indexOf('<main') && html.indexOf('</main>') < html.indexOf('<footer'));
});

// ==== Polish step 4: the text alternative sentence on the sample result ==========================

const TEXT_ALTERNATIVE = 'The 3D view has a text alternative: the summary and the clash list on this page hold the same information.';
function sampleTextAlternativeProblems(pageHtml) {
  const problems = [];
  const m = /<p id="sample-text-alternative"[^>]*>([^<]*)<\/p>/.exec(pageHtml);
  if (!m) return ['the sample result has no text alternative sentence'];
  if (m[1] !== TEXT_ALTERNATIVE) problems.push('the sentence is different');
  const at = pageHtml.indexOf('id="sample-text-alternative"');
  if (!(pageHtml.indexOf('<div id="screen-result"') < at && at < pageHtml.indexOf('<div id="own-result"'))) problems.push('the sentence is not in the sample part of the result screen');
  if (pageHtml.indexOf('id="scene-area"') > at) problems.push('the sentence does not follow the 3D view');
  return problems;
}

test('Polish 4: the sample result shows the 3D view text alternative sentence once, and a visitor\'s own result shows only its own copy', async () => {
  assert.deepEqual(sampleTextAlternativeProblems(html), []);
  assert.equal(html.split(TEXT_ALTERNATIVE).length - 1, 2, 'one copy for the sample and one for a visitor\'s own result');
  await withAll(() => {}, async (page) => {
    page.el('choose-sample').click();
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('sample-text-alternative').hidden, false);
    assert.equal(page.el('own-result').hidden, true, 'the own copy sits in the hidden own part');
    assert.equal(page.el('scene-area').getAttribute('aria-label'), '3D view of the sample home');
    assert.deepEqual(page.problemLines(), []);
    // The clash list and summary the sentence points to are on the sample result.
    assert.ok(page.el('clash-list').children.length > 0, 'the clash list has entries');
    // A visitor's own result shows its own copy and hides the sample one; Start again brings the sample one back.
    page.el('result-back').click();
    fillEverything(page);
    await runIt(page);
    assert.equal(page.el('sample-text-alternative').hidden, true);
    assert.equal(page.el('own-result').hidden, false);
    page.el('result-start-again').click();
    page.el('choose-sample').click();
    assert.equal(page.el('sample-text-alternative').hidden, false);
  });
});

test('Polish 4: the sample sentence check fails when the sentence is missing, changed or in the wrong place (planted changes in copies)', () => {
  const removed = html.replace(/<p id="sample-text-alternative"[^>]*>[^<]*<\/p>\n?/, '');
  assert.notEqual(removed, html);
  assert.deepEqual(sampleTextAlternativeProblems(removed), ['the sample result has no text alternative sentence']);
  const changed = html.replace(/(<p id="sample-text-alternative"[^>]*>)[^<]*/, '$1The 3D view is fine.');
  assert.ok(sampleTextAlternativeProblems(changed).includes('the sentence is different'));
});
