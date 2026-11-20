// Polish batch 1: four approved changes to how the sample looks, each with its own test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
const css = read('styles.css');
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
const viewerColour = (src, name) => `#${new RegExp(`${name}:\\s*0x([0-9a-f]{6})`).exec(src)[1]}`;
const swatchColour = (text, cls) => new RegExp(`\\.${cls}\\s*\\{\\s*background:\\s*(#[0-9a-fA-F]{6})`).exec(text)[1].toLowerCase();

function checkUnsure(viewerSrc, cssText) {
  const unsure = viewerColour(viewerSrc, 'unsure');
  const locked = viewerColour(viewerSrc, 'locked');
  const slab = viewerColour(viewerSrc, 'slab');
  const problems = [];
  if (ratio(unsure, '#ffffff') < 3) problems.push(`Unsure on white is ${ratio(unsure, '#ffffff').toFixed(2)} to 1`);
  if (ratio(unsure, slab) < 3) problems.push(`Unsure on the floor slab is ${ratio(unsure, slab).toFixed(2)} to 1`);
  const gap = Math.abs(hue(unsure) - hue(locked));
  if (Math.min(gap, 360 - gap) < 90) problems.push('Unsure is too close to the Locked blue in hue');
  if (swatchColour(cssText, 'swatch-unsure') !== unsure) problems.push('the legend swatch is not the viewer colour');
  if (swatchColour(cssText, 'swatch-locked') !== locked) problems.push('the Locked swatch is not the viewer colour');
  return problems;
}

test('Polish 1: the Unsure orange has at least 3 to 1 against white and the 3D floor slab, differs from the Locked blue, and the legend swatch matches', () => {
  const unsure = viewerColour(viewer, 'unsure');
  console.log(`Unsure ${unsure}: ${ratio(unsure, '#ffffff').toFixed(2)} to 1 on white, ${ratio(unsure, viewerColour(viewer, 'slab')).toFixed(2)} to 1 on the floor slab; hue ${hue(unsure).toFixed(0)} against Locked hue ${hue(viewerColour(viewer, 'locked')).toFixed(0)}`);
  assert.deepEqual(checkUnsure(viewer, css), []);
  assert.ok(hue(unsure) > 15 && hue(unsure) < 40, 'it is still an orange');
  assert.match(html, /<span class="swatch swatch-locked"[^>]*><\/span>\s*Locked/);
  assert.match(html, /<span class="swatch swatch-unsure"[^>]*><\/span>\s*Unsure/);
});

test('Polish 1: the colour check fails on the old light orange, on a swatch that does not match, and on a blue-looking Unsure (planted changes in copies)', () => {
  const old = viewer.replace(/unsure:\s*0x[0-9a-f]{6}/, 'unsure: 0xe69f00');
  assert.ok(checkUnsure(old, css).length >= 2);
  const mismatch = css.replace(/(\.swatch-unsure\s*\{\s*background:\s*)#[0-9a-fA-F]{6}/, '$1#e69f00');
  assert.ok(checkUnsure(viewer, mismatch).some((p) => /swatch/.test(p)));
  const blueish = viewer.replace(/unsure:\s*0x[0-9a-f]{6}/, 'unsure: 0x0060a0');
  assert.ok(checkUnsure(blueish, css).some((p) => /Locked blue/.test(p)));
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
