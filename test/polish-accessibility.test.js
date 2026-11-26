// Polish batch 1: four approved changes to how the sample looks, each with its own test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStyles, themeValues } from '../test-helpers/fake-page.js';

const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
const css = readStyles();
const viewer = read('viewer.js');
const html = read('index.html');

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
// look-and-feel: Locked is no longer blue and Unsure is no longer orange in the 3D view. Locked is a dark outline, Unsure has no outline,
// and the colour of an object is its agent's colour. So this check now covers the two marks that are left (the Locked outline and the
// clash red), which come from docs/theme.css in both modes, and the legend swatches that must show the same marks.
const sceneColour = (mode, name) => themeValues(mode)[`--scene-${name}`].toLowerCase();
const swatchBorder = (text, cls) => new RegExp(`\\.${cls}\\s*\\{[^}]*border:\\s*\\d+px solid (#[0-9a-fA-F]{6})`).exec(text)[1].toLowerCase();

function checkMarks(mode, cssText) {
  const locked = sceneColour(mode, 'locked-edge');
  const clash = sceneColour(mode, 'clash');
  const slab = sceneColour(mode, 'slab');
  const white = themeValues(mode)['--surface'];
  const problems = [];
  for (const [name, hex] of [['Locked outline', locked], ['Clash red', clash]]) {
    if (ratio(hex, white) < 3) problems.push(`${name} on the legend background is ${ratio(hex, white).toFixed(2)} to 1`);
    if (ratio(hex, slab) < 3) problems.push(`${name} on the floor slab is ${ratio(hex, slab).toFixed(2)} to 1`);
  }
  if (swatchBorder(cssText, 'swatch-locked') !== locked) problems.push('the Locked legend swatch is not the 3D colour');
  if (swatchBorder(cssText, 'swatch-clash') !== clash) problems.push('the clash legend swatch is not the 3D colour');
  return problems;
}

for (const mode of ['light', 'dark']) {
  test(`Polish 1 (${mode} mode): the Locked outline and the clash red have at least 3 to 1 against the legend background and the 3D floor slab, and the legend swatches match`, () => {
    assert.deepEqual(checkMarks(mode, readStyles(mode)), []);
    // Locked and Unsure are told apart without colour: the legend says "dark outline" and "no outline", and a Locked label says "(Locked)".
    assert.match(html, /<span class="swatch swatch-locked"[^>]*><\/span>\s*Locked/);
    assert.match(html, /<span class="swatch swatch-unsure"[^>]*><\/span>\s*Unsure/);
    assert.match(html, /Locked: must stay as it is \(dark outline, and the word Locked on its name\)/);
  });
}

test('Polish 1: the colour check fails on a swatch that does not match and on a mark that is too light (planted changes in copies)', () => {
  const css0 = readStyles('light');
  const mismatch = css0.replace(/(\.swatch-locked\s*\{[^}]*border:\s*\d+px solid )#[0-9a-fA-F]{6}/, '$1#e69f00');
  assert.ok(checkMarks('light', mismatch).some((p) => /swatch/.test(p)));
  const real = sceneColour('light', 'locked-edge');
  const lightened = css0.replace(new RegExp(`(\\.swatch-locked\\s*\\{[^}]*border:\\s*\\d+px solid )${real}`), '$1#dddddd');
  assert.notEqual(lightened, css0);
  assert.ok(checkMarks('light', lightened).length >= 1);
});

// ---- Step 2: block names in the 3D view -------------------------------------------------------

const rootPx = 16; // the browser default; the page sets no smaller root size (checked below)
function sizeInPx(value) {
  const m = /^([\d.]+)(rem|px|em)$/.exec(value.trim());
  assert.ok(m, `a size in rem, em or px, not "${value}"`);
  return m[2] === 'px' ? Number(m[1]) : Number(m[1]) * rootPx;
}
function ruleBody(text, selector) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(stripped);
  return m ? m[1] : null;
}
function labelSizes(cssText, viewerSrc) {
  const sizes = {};
  for (const sel of ['.scene-label', '.room-label', '.clash-label', '.floor-label']) {
    const body = ruleBody(cssText, sel);
    const m = body && /font-size:\s*([^;]+);/.exec(body);
    if (m) sizes[sel] = sizeInPx(m[1]);
    else if (sel === '.scene-label') sizes[sel] = 0; // the base rule must say its size
  }
  const problems = Object.entries(sizes).filter(([, px]) => px < 16).map(([sel, px]) => `${sel} is ${px} px`);
  if (/style\.fontSize|font-size/.test(viewerSrc)) problems.push('viewer.js sets a font size of its own');
  return problems;
}

test('Polish 2: every block name in the 3D view (item, room, clash and floor labels) is at least 16 px', () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /html\s*\{[^}]*font-size/, 'the page root size is the browser default');
  assert.match(css, /body\s*\{[^}]*font-size:\s*1rem/);
  assert.deepEqual(labelSizes(css, viewer), []);
  assert.equal(sizeInPx(/font-size:\s*([^;]+);/.exec(ruleBody(css, '.scene-label'))[1]), 16);
});

test('Polish 2: the label size check fails on the old 0.9rem size (planted change in a copy)', () => {
  const planted = css.replace(/(\.scene-label\s*\{[^}]*font-size:\s*)1rem/, '$10.9rem');
  assert.notEqual(planted, css);
  assert.ok(labelSizes(planted, viewer).some((p) => /\.scene-label is 14\.4 px/.test(p)));
});

// ---- Step 3: the viewer's own buttons ---------------------------------------------------------

function tapProblems(cssText) {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const problems = [];
  const need = (selector, props) => {
    const body = ruleBody(stripped, selector);
    if (body === null) { problems.push(`${selector}: no rule`); return; }
    for (const prop of props) {
      const m = new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`).exec(body);
      if (!m) problems.push(`${selector}: no ${prop}`);
      else if (sizeInPx(m[1]) < 44) problems.push(`${selector}: ${prop} is ${sizeInPx(m[1])} px`);
    }
  };
  need('#view-controls button', ['min-height', 'min-width']); // the three floor buttons and "Reset view"
  need('#show-all-labels-label', ['min-height', 'min-width']); // the "Show all labels" tap area
  need('#clash-list button', ['min-height']); // full width, so wide enough already
  const clash = ruleBody(stripped, '#clash-list button') || '';
  if (!/width:\s*100%/.test(clash)) problems.push('#clash-list button is not full width');
  return problems;
}

test('Polish 3: the floor buttons, "Reset view", the "Show all labels" box and the clash list buttons are at least 44 px high and wide', () => {
  assert.deepEqual(tapProblems(css), []);
  // The buttons the rules apply to are really in the page, inside #view-controls.
  const controls = html.slice(html.indexOf('<div id="view-controls"'), html.indexOf('<div id="scene-area"'));
  for (const id of ['floor-all', 'floor-ground', 'floor-upper', 'reset-view']) assert.match(controls, new RegExp(`<button[^>]*id="${id}"`));
  assert.match(controls, /<label id="show-all-labels-label"[^>]*>\s*<input type="checkbox" id="show-all-labels">/);
  // The clash list buttons are made by viewer.js as buttons inside #clash-list.
  assert.match(html, /<ul id="clash-list"/);
  assert.match(viewer, /createElement\('button'\)/);
  // The checkbox itself is bigger than the browser default.
  assert.ok(sizeInPx(/width:\s*([^;]+);/.exec(ruleBody(css, '#show-all-labels'))[1]) >= 24);
  // No later rule shrinks them again.
  assert.doesNotMatch(css, /@media[^{]*\{[^@]*(?:#view-controls button|#clash-list button)[^{]*\{[^}]*(?:min-height|height)\s*:\s*[0-3]/);
});

test('Polish 3: the tap-size check fails when a minimum is removed or too small (planted changes in copies)', () => {
  const noMin = css.replace(/(#view-controls button\s*\{[^}]*?)\s*min-height:\s*2\.75rem;/, '$1');
  assert.notEqual(noMin, css);
  assert.ok(tapProblems(noMin).some((p) => /#view-controls button: no min-height/.test(p)));
  const small = css.replace(/(#clash-list button\s*\{[^}]*min-height:\s*)2\.75rem/, '$12.5rem');
  assert.notEqual(small, css);
  assert.ok(tapProblems(small).some((p) => /#clash-list button: min-height is 40 px/.test(p)));
  const label = css.replace(/(#show-all-labels-label\s*\{[^}]*?)min-width:\s*2\.75rem;/, '$1');
  assert.ok(tapProblems(label).some((p) => /show-all-labels-label: no min-width/.test(p)));
});
