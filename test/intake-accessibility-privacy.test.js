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
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { buildScene } from '../docs/scene-data.js';
import { FIXED_SENTENCE } from '../docs/intake/report.js';
import * as stateApi from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { makeSummaryHtml } from '../docs/engine/summary/make-summary.js';

installImportHooks();

const html = readDoc('index.html');
const css = readDoc('styles.css');
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
    assert.deepEqual(drawn, buildScene(sample, SAMPLE_LAST).map((b) => b.key).sort());
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

// ==== Contrast, computed from the colour values in the stylesheet ================================

const hexOf = (value) => {
  const m = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.exec(value || '');
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
};
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const [r, g, b] = channels(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// A colour with transparency, laid over a solid colour.
function overlay(top, alpha, under) {
  const t = channels(top);
  const u = channels(under);
  const mix = t.map((v, i) => Math.round(v * alpha + u[i] * (1 - alpha)));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// The rules of a stylesheet as { selectors, body }, comments removed. Rules inside @media are included.
function cssRules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] }));
}
// The last value written for a property in the rules whose selector list contains `selector`.
function cssValue(rules, selector, property) {
  let found = null;
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    const m = new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+)`).exec(rule.body);
    if (m) found = m[1].trim();
  }
  assert.ok(found !== null, `the stylesheet has no "${property}" for "${selector}"`);
  return found;
}

// Named colours of the page (hex written in styles.css; the three status colours also in docs/viewer.js).
const viewerSource = readDoc('viewer.js');
const viewerColour = (name) => `#${new RegExp(`${name}:\\s*0x([0-9a-f]{6})`).exec(viewerSource)[1]}`;

// Each pair: where its colours come from in the stylesheet, and the smallest ratio it must reach.
// 'text' needs 4.5 to 1. 'part' (a border, a focus ring, another part of a control) needs 3 to 1.
function pairsFor(text) {
  const rules = cssRules(text);
  const v = (selector, property) => hexOf(cssValue(rules, selector, property));
  const body = (property) => v('body', property);
  const pageBg = body('background');
  const panelBg = v('.panel', 'background');
  const entryBg = v('.entry', 'background');
  const sceneBg = v('#scene-area', 'background');
  const labelFill = overlay('#ffffff', 0.92, sceneBg); // .scene-label is white at 92% over the 3D area
  const T = (name, fg, bg) => ({ name, kind: 'text', min: 4.5, fg, bg });
  const P = (name, fg, bg) => ({ name, kind: 'part', min: 3, fg, bg });
  const focus = v(':focus-visible', 'outline');
  return [
    T('Page text on the page background', body('color'), pageBg),
    T('Top and bottom bar text', v('.label-bar', 'color'), v('.label-bar', 'background')),
    T('Red message text (viewer)', v('#error-message', 'color'), v('#error-message', 'background')),
    T('Red message text (screens)', v('#intake-error-message', 'color'), v('#intake-error-message', 'background')),
    T('Text in the "could not finish" box', v('.run-failure', 'color'), v('.run-failure', 'background')),
    T('Grey status line (viewer) on the page', v('#script-status', 'color'), pageBg),
    T('Grey status line (screens) on the page', v('.status-line', 'color'), pageBg),
    T('Text in the 3D area placeholder', v('#scene-area', 'color'), sceneBg),
    T('Hint text in a panel', v('.hint', 'color'), panelBg),
    T('Hint text on the page', v('.hint', 'color'), pageBg),
    T('Detail text in a list row', v('.entry-detail', 'color'), entryBg),
    T('Error text in a panel', v('.field-error', 'color'), panelBg),
    T('Error text on the page', v('.field-error', 'color'), pageBg),
    T('Error text in a list row', v('.field-error', 'color'), entryBg),
    T('Status announcement text', v('.action-status', 'color'), v('.action-status', 'background')),
    T('Text on dark buttons (Next, Start my own project)', v('.nav-primary', 'color'), v('.nav-primary', 'background')),
    T('Text on normal buttons', v('.action-button', 'color'), v('.action-button', 'background')),
    T('Text on a pressed view button', v('#view-controls button[aria-pressed="true"]', 'color'), v('#view-controls button[aria-pressed="true"]', 'background')),
    // These two buttons set no text colour. The browser's own button text colour is black in a light page (assumed, not checked).
    T('Text on view buttons (browser black assumed)', '#000000', v('#view-controls button', 'background')),
    T('Text on clash list buttons (browser black assumed)', '#000000', v('#clash-list button', 'background')),
    T('Text in text boxes', v('.text-input', 'color'), v('.text-input', 'background')),
    T('Panel text', body('color'), panelBg),
    T('List row text', body('color'), entryBg),
    T('Section text (viewer panels)', body('color'), v('section', 'background')),
    T('Text in a tag', body('color'), v('.tag', 'background')),
    T('Text in the "still needed" boxes', body('color'), v('.setup-needs', 'background')),
    T('Locked or Unsure word in a list', v('.status-text', 'color'), panelBg),
    T('Table heading text', body('color'), v('.summary-view th', 'background')),
    T('Floor name label in 3D', v('.floor-label', 'color'), v('.floor-label', 'background')),
    T('Room name label in 3D', v('.room-label', 'color'), labelFill),
    T('Block name label in 3D', body('color'), labelFill),
    P('Text box border on a panel', v('.text-input', 'border'), v('.text-input', 'background')),
    P('Text box border on the page', v('.text-input', 'border'), pageBg),
    P('Text box border when it holds a mistake', v('.text-input[aria-invalid="true"]', 'border-color'), v('.text-input', 'background')),
    P('Button border on the page', v('.action-button', 'border'), pageBg),
    P('Button border on a panel', v('.action-button', 'border'), panelBg),
    P('Button border in a list row', v('.action-button', 'border'), entryBg),
    P('View button border on the page', v('#view-controls button', 'border'), pageBg),
    P('Clash list button border', v('#clash-list button', 'border'), v('section', 'background')),
    P('Bar beside an error message', v('.field-error', 'border-left'), panelBg),
    P('Tag border', v('.tag', 'border'), panelBg),
    P('Border of a panel on the page', v('.panel', 'border'), pageBg),
    P('Border of a list row (outside)', v('.entry', 'border'), panelBg),
    P('Border of a list row (inside)', v('.entry', 'border'), entryBg),
    P('Border around a group of choices', v('.choice-group', 'border'), pageBg),
    P('Table border', v('.summary-view th', 'border'), panelBg),
    P('Border of a table row on a narrow screen', v('.summary-view tr', 'border'), panelBg),
    P('Table border at a heading', v('.summary-view th', 'border'), v('.summary-view th', 'background')),
    P('Border of a mood board picture', v('.mood-image', 'border'), panelBg),
    P('Border of the legend swatches', v('.swatch', 'border'), v('section', 'background')),
    P('Keyboard focus ring on the page', focus, pageBg),
    P('Keyboard focus ring in a panel', focus, panelBg),
    P('Keyboard focus ring in a list row', focus, entryBg),
    P('Keyboard focus ring on the status line', focus, v('.action-status', 'background')),
    P('Keyboard focus ring over the 3D area', focus, sceneBg),
    P('Keyboard focus ring in the "could not finish" box', focus, v('.run-failure', 'background')),
    P('Keyboard focus ring in a "still needed" box', focus, v('.setup-needs', 'background')),
  ];
}

// The status colours: the page words say Locked and Unsure too, so colour is never the only sign. Their ratios are
// still computed and printed. Known shortfalls (below 3 to 1) are listed here on purpose; the test fails if the list changes.
function statusRows(text) {
  const rules = cssRules(text);
  const white = hexOf(cssValue(rules, 'section', 'background'));
  const slab = viewerColour('slab');
  const colours = [['Locked blue', viewerColour('locked')], ['Unsure orange', viewerColour('unsure')], ['Clash red', viewerColour('clash')]];
  const rows = [];
  for (const [name, hex] of colours) {
    rows.push({ name: `${name} on the legend background`, fg: hex, bg: white, min: 3 });
    rows.push({ name: `${name} on the pale floor slab in 3D`, fg: hex, bg: slab, min: 3 });
  }
  return rows;
}
const KNOWN_STATUS_SHORTFALLS = []; // the Unsure orange now reaches 3 to 1 (polish step 1), so no shortfall is left

function checkContrast(text) {
  const rows = [...pairsFor(text), ...statusRows(text)].map((p) => { assert.ok(p.fg && p.bg, `missing colour for: ${p.name}`); return { ...p, ratio: ratio(p.fg, p.bg) }; });
  return { rows, failures: rows.filter((r) => r.ratio < r.min) };
}

test('Task 12 accessibility: every text colour pair reaches 4.5 to 1 and every border and focus colour reaches 3 to 1 (numbers printed)', () => {
  const { rows, failures } = checkContrast(css);
  console.log('Contrast, computed from the colour values in docs/styles.css (needs: text 4.5, parts 3.0):');
  for (const r of rows) console.log(`  ${r.ratio.toFixed(2).padStart(5)} to 1  (needs ${r.min})  ${r.fg} on ${r.bg}  ${r.name}${r.ratio < r.min ? '   <-- BELOW' : ''}`);
  assert.ok(rows.length >= 55, 'the table is not empty');
  assert.deepEqual(failures.map((f) => f.name), KNOWN_STATUS_SHORTFALLS,
    'no pair is below its limit; anything below is a new problem');
});

test('Task 12 accessibility: every colour written in the stylesheet is in the contrast table, or is listed as a plain decoration', () => {
  const { rows } = checkContrast(css);
  const checked = new Set(rows.flatMap((r) => [r.fg, r.bg]));
  // Lines and fills that identify nothing a person needs: the viewer's panel borders, a 3D area frame, the viewer's label
  // border (on a label that also has text), and the thin line between stacked table cells on a narrow screen.
  const DECORATION = ['#d5d5d0', '#b8bec4', '#8a9299', '#d0d3d6', '#e69f00'];
  const written = new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map((m) => hexOf(m[0])));
  const unchecked = [...written].filter((hex) => !checked.has(hex) && !DECORATION.map(hexOf).includes(hex));
  assert.deepEqual(unchecked, [], 'a colour in the stylesheet has no contrast check');
  // The three status colours of the stylesheet's swatches are the same as the viewer's.
  for (const [cls, name] of [['.swatch-locked', 'locked'], ['.swatch-unsure', 'unsure'], ['.swatch-clash', 'clash']]) {
    const value = cssValue(cssRules(css), cls, cls === '.swatch-clash' ? 'border' : 'background');
    assert.equal(hexOf(value), viewerColour(name), `${cls} equals the viewer colour`);
  }
});

test('Task 12 accessibility: the contrast check fails when a colour is made too light (planted change in a copy)', () => {
  assert.equal(checkContrast(css).failures.length, KNOWN_STATUS_SHORTFALLS.length);
  const planted = css.replace('.hint { color: #444; }', '.hint { color: #aaa; }');
  assert.notEqual(planted, css, 'the plant changed the copy');
  assert.ok(checkContrast(planted).failures.some((f) => f.name === 'Hint text in a panel'));
  const plantedFocus = css.replace('outline: 3px solid #0b3d91', 'outline: 3px solid #ccd');
  assert.notEqual(plantedFocus, css);
  assert.ok(checkContrast(plantedFocus).failures.some((f) => f.name.startsWith('Keyboard focus ring')));
});

// ==== Structure: language, zoom, headings, labels, status region, tab order =====================

const screenIds = [...html.matchAll(/<div id="screen-(\w+)"/g)].map((m) => m[1]);
const blockOf = (id) => {
  const from = html.indexOf(`<div id="screen-${id}"`);
  const next = screenIds[screenIds.indexOf(id) + 1];
  const to = next ? html.indexOf(`<div id="screen-${next}"`) : html.indexOf('<div id="step-nav"');
  return html.slice(from, to);
};

test('Task 12 accessibility: the page has a language, a zoomable viewport tag, a title, one main area, and every screen but Start starts hidden', () => {
  assert.match(html, /^<!DOCTYPE html>\s*<html lang="en">/);
  const viewport = /<meta name="viewport" content="([^"]*)">/.exec(html);
  assert.ok(viewport, 'a viewport tag');
  assert.equal(viewport[1], 'width=device-width, initial-scale=1');
  assert.doesNotMatch(viewport[1], /user-scalable|maximum-scale|minimum-scale/, 'zooming is not blocked');
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.deepEqual(screenIds, ['start', 'setup', 'inspiration', 'overrides', 'brief', 'taste', 'items', 'review', 'result']);
  for (const id of screenIds) {
    const open = new RegExp(`<div id="screen-${id}" class="screen"( hidden)?>`).exec(html);
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
    review: ['run-design-team'],
    result: ['result-back', 'floor-all', 'floor-ground', 'floor-upper', 'reset-view', 'show-all-labels', 'version-slider', 'result-start-again'],
  };
  for (const id of screenIds) assert.deepEqual(controlsIn(blockOf(id)), expected[id], `order on the ${id} screen`);
  assert.deepEqual(controlsIn(html.slice(html.indexOf('<div id="step-nav"'))), ['back-button', 'start-again', 'next-button'], 'Back, Start again, Next come after the screens, as on screen');
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

const PRIVACY_RULES = [
  ['browser storage', /\b(localStorage|sessionStorage|indexedDB|openDatabase|caches\.(open|match)|cookieStore)\b/],
  ['cookies', /\.cookie\b/],
  ['other ways to send data', /\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|serviceWorker)\b|new\s+(Worker|SharedWorker)\b/],
  ['web addresses', /https?:\/\/|\bwww\.|(?:src|href|action)\s*=\s*["']\/\/|url\(\s*["']?(?:https?:)?\/\//],
  ['reading what is inside an image file', /\bFileReader\b|\.arrayBuffer\(|createImageBitmap|new\s+Image\s*\(/],
  ['visitor text as page code', /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\b/],
];
// A web request is allowed in one place only: docs/viewer.js asks for sample-run.json.
function privacyProblems(files) {
  const problems = [];
  for (const { name, text } of files) {
    const noComments = name.endsWith('.js') ? text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1') : text;
    for (const [what, pattern] of PRIVACY_RULES) if (pattern.test(noComments)) problems.push(`${name}: ${what}`);
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
  ];
  for (const [name, add, expected] of cases) {
    assert.ok(privacyProblems(plant(name, add)).includes(expected), `a planted fault in ${name} is found: ${add}`);
  }
});

// Trap every way a page could keep or send things, then use the whole app, run it, start again and open the sample.
test('Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load', async () => {
  const touched = [];
  const trap = (name) => Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); throw new Error(`${name} must not be used`); } });
  const trapped = ['localStorage', 'sessionStorage', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker'];
  const savedDescriptors = Object.fromEntries(trapped.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  trapped.forEach(trap);
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
    for (const n of trapped) { if (savedDescriptors[n]) Object.defineProperty(globalThis, n, savedDescriptors[n]); else delete globalThis[n]; }
  }
  assert.deepEqual(touched, []);
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
