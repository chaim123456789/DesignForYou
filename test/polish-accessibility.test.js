// Polish batch 1: four approved changes to how the sample looks, each with its own test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStyles } from '../test-helpers/fake-page.js';

const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
// Look-and-feel L1: the sizes and colours live in docs/theme.css, so the stylesheet is read with every var(--name) replaced by its theme value.
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

// ---- Step 1: Locked and Unsure (look-and-feel L6: colour now says which agent owns an item, so status is shown by an edge line and by words) ----

test('Polish 1: Locked and Unsure are told apart by an outline and by words, not by colour, and the legend swatches say so', () => {
  assert.match(html, /<span class="swatch swatch-locked"[^>]*><\/span>\s*Locked: must stay as it is \(drawn with a bright outline, and its label says Locked\)/);
  assert.match(html, /<span class="swatch swatch-unsure"[^>]*><\/span>\s*Unsure: open to change \(no outline\)/);
  assert.match(html, /<span class="swatch swatch-clash"[^>]*><\/span>\s*Clash: a problem the Reviewer found \(red outline, and its label says Clash\)/);
  // The Locked swatch has a thick outline and the Unsure swatch does not: the two differ in shape, not only in colour.
  assert.match(css, /\.swatch-locked \{[^}]*border: 3px solid/);
  assert.doesNotMatch(/\.swatch-unsure \{[^}]*\}/.exec(css)[0], /border:/);
  // The viewer draws a bright edge on every Locked item and writes no colour of its own.
  assert.match(viewer, /b\.status === 'Locked' \? COLOURS\.lockedEdge/);
  assert.doesNotMatch(viewer.replace(/\/\/.*$/gm, ''), /0x[0-9a-fA-F]{6}|#[0-9a-fA-F]{6}\b/, 'no colour is written in viewer.js');
  // The label says Locked or Clash in words (the stylesheet writes the word after the name).
  assert.match(css, /\.scene-label\[data-locked\]::after \{ content: "Locked"/);
  assert.match(css, /\.scene-label\[data-clash\]::after \{ content: "Clash"/);
});

// ---- Step 2: block names in the 3D view ---------------------------------------------------------

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
// The inside of every @media block, found by counting braces.
function mediaBlocks(text) {
  const blocks = [];
  for (let at = text.indexOf('@media'); at !== -1; at = text.indexOf('@media', at + 1)) {
    const open = text.indexOf('{', at);
    let depth = 0;
    let end = open;
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      if (text[end] === '}') { depth -= 1; if (depth === 0) break; }
    }
    blocks.push(text.slice(open + 1, end));
  }
  return blocks;
}
// The body of the first rule whose selector list contains this selector.
function ruleHaving(text, selector) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/(?<=^|\})\s*([^{}@]+)\{([^}]*)\}/g)) {
    if (m[1].split(',').map((x) => x.trim()).includes(selector)) return m[2];
  }
  return null;
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
    const body = ruleHaving(stripped, selector);
    if (body === null) { problems.push(`${selector}: no rule`); return; }
    for (const prop of props) {
      const m = new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`).exec(body);
      if (!m) problems.push(`${selector}: no ${prop}`);
      else if (sizeInPx(m[1]) < 44) problems.push(`${selector}: ${prop} is ${sizeInPx(m[1])} px`);
    }
  };
  need('.floor-button', ['min-height', 'min-width']); // the three floor buttons
  need('.ribbon-button', ['min-height', 'min-width']); // "Reset view"
  need('#show-all-labels-label', ['min-height', 'min-width']); // the "Show all labels" tap area
  need('.layer-label', ['min-height', 'min-width']); // the six layer check boxes
  need('#clash-list button', ['min-height']); // full width, so wide enough already
  const clash = ruleHaving(stripped, '#clash-list button') || '';
  if (!/width:\s*100%/.test(clash)) problems.push('#clash-list button is not full width');
  return problems;
}

test('Polish 3: the floor buttons, "Reset view", the layer boxes, the "Show all labels" box and the clash list buttons are at least 44 px high and wide', () => {
  assert.deepEqual(tapProblems(css), []);
  // The buttons the rules apply to are really in the page, inside #view-controls (in the ribbon).
  const controls = html.slice(html.indexOf('<div id="view-controls"'), html.indexOf('<fieldset id="layer-controls"'));
  for (const id of ['floor-all', 'floor-ground', 'floor-upper', 'reset-view']) assert.match(controls, new RegExp(`<button[^>]*id="${id}"`));
  assert.match(controls, /<label id="show-all-labels-label"[^>]*>\s*<input type="checkbox" id="show-all-labels">/);
  const layers = html.slice(html.indexOf('<fieldset id="layer-controls"'), html.indexOf('</fieldset>', html.indexOf('<fieldset id="layer-controls"')));
  assert.equal((layers.match(/class="layer-label"/g) || []).length, 6, 'six layer check boxes');
  // The clash list buttons are made by viewer.js as buttons inside #clash-list.
  assert.match(html, /<ul id="clash-list"/);
  assert.match(viewer, /createElement\('button'\)/);
  // The checkboxes themselves are bigger than the browser default.
  assert.ok(sizeInPx(/width:\s*([^;]+);/.exec(ruleHaving(css, '#show-all-labels'))[1]) >= 24);
  assert.ok(sizeInPx(/width:\s*([^;]+);/.exec(ruleHaving(css, '.layer-label input'))[1]) >= 24);
  // No later rule shrinks them again.
  for (const block of mediaBlocks(css)) {
    for (const selector of ['.floor-button', '#clash-list button', '.layer-label']) {
      const body = ruleHaving(block, selector);
      const m = body && /(?:^|[;\s])min-height:\s*([^;]+);/.exec(body);
      if (m) assert.ok(sizeInPx(m[1]) >= 44, `${selector} is made smaller in a media rule`);
    }
  }
});

test('Polish 3: the tap-size check fails when a minimum is removed or too small (planted changes in copies)', () => {
  const noMin = css.replace(/(\.choice-button, \.nav-button, \.action-button, \.bar-button, \.ribbon-button, \.tab-button, \.floor-button, \.phone-tab \{\s*)min-height:\s*2\.75rem;/, '$1');
  assert.notEqual(noMin, css);
  assert.ok(tapProblems(noMin).some((p) => /\.floor-button: no min-height/.test(p)));
  const small = css.replace(/(#clash-list button \{[^}]*min-height:\s*)2\.75rem/, '$12.5rem');
  assert.notEqual(small, css);
  assert.ok(tapProblems(small).some((p) => /#clash-list button: min-height is 40 px/.test(p)));
  const label = css.replace(/(\.layer-label, #show-all-labels-label \{[^}]*?)min-width:\s*2\.75rem;/, '$1');
  assert.ok(tapProblems(label).some((p) => /min-width/.test(p)));
});
