// look-and-feel Task 1: the theme file. Colours, fonts and spacing live in docs/theme.css and nowhere else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { readDoc, readStyles, themeValues } from '../test-helpers/fake-page.js';
import { AGENTS } from '../docs/agent-info.js';

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex) => { const [r, g, b] = rgb(hex).map(channel); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function pageFiles(dir = new URL('../docs/', import.meta.url), out = []) {
  for (const name of readdirSync(dir)) {
    const url = new URL(name + (statSync(new URL(name, dir)).isDirectory() ? '/' : ''), dir);
    if (statSync(url).isDirectory()) { if (!['vendor', 'knowledge'].includes(name)) pageFiles(url, out); } else if (/\.(js|css|html)$/.test(name)) out.push(url);
  }
  return out;
}
const rel = (url) => url.pathname.split('/docs/')[1];
// The standalone summary page (make-summary.js) is a separate downloadable document with its own inline style. It is not part of the page's look.
const EXEMPT = ['theme.css', 'engine/summary/make-summary.js', 'team/summary/make-summary.js'];

test('look-and-feel T1: the theme file holds the colours, fonts and spacing, in light and dark', () => {
  const light = themeValues('light');
  const dark = themeValues('dark');
  for (const name of ['--bg', '--surface', '--text', '--text-muted', '--line', '--accent', '--on-accent', '--focus', '--danger', '--font-body', '--font-mono', '--space-1', '--space-4', '--radius', '--scene-background', '--scene-clash', '--agent-walls', '--agent-reviewer']) {
    assert.ok(light[name], `${name} in light`);
    assert.ok(dark[name], `${name} in dark`);
  }
  for (const name of ['--bg', '--surface', '--text', '--accent', '--scene-background', '--plan-room-fill']) assert.notEqual(light[name], dark[name], `${name} differs in dark mode`);
});

test('look-and-feel T1: no colour, font-family or hex value outside the theme file (css, html and page scripts)', () => {
  const problems = [];
  for (const url of pageFiles()) {
    const name = rel(url);
    if (EXEMPT.includes(name)) continue;
    const text = readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/.test(text.replace(/href="#[\w-]+"/g, '').replace(/&#\d+;/g, '')) && /\.(css|js)$/.test(name)) problems.push(`${name}: a hex colour`);
    if (/\brgba?\(|\bhsla?\(/.test(text)) problems.push(`${name}: rgb or hsl`);
    if (/font-family\s*:(?!\s*var\()|fontFamily|'font-family'/.test(text)) problems.push(`${name}: a font family`);
    if (/0x[0-9a-fA-F]{6}\b/.test(text)) problems.push(`${name}: a 0x colour`);
    if (name === 'index.html' && /\sstyle=/.test(text)) problems.push('index.html: an inline style');
  }
  assert.deepEqual(problems, []);
});

test('look-and-feel T1: styles.css uses no spacing literal (padding, margin, gap) other than 0 and auto, and no named colour', () => {
  const raw = readDoc('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = [];
  for (const m of raw.matchAll(/(?<![-\w])(padding(?:-\w+)?|margin(?:-\w+)?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g)) {
    const value = m[2].replace(/var\([^)]*\)/g, '').replace(/\/ 2/g, '').replace(/100%/g, '').replace(/\b(auto|0|calc|max|min)\b/g, '').replace(/[\s(),+*/-]/g, '');
    if (/\d/.test(value)) bad.push(`${m[1]}: ${m[2].trim()}`);
  }
  assert.deepEqual(bad, []);
  assert.doesNotMatch(raw, /(?:color|background|border[\w-]*)\s*:[^;]*\b(?:white|black|red|blue|green|orange|gray|grey)\b/);
});

test('look-and-feel T1: no outside fonts, images or scripts (no @import, @font-face or url())', () => {
  for (const name of ['theme.css', 'styles.css']) assert.doesNotMatch(readDoc(name), /@import|@font-face|url\(/, name);
  assert.doesNotMatch(readDoc('index.html'), /https?:\/\//);
});

function checkMode(mode) {
  const t = themeValues(mode);
  const rows = [];
  const T = (a, b) => rows.push({ min: 4.5, a, b });
  const P = (a, b) => rows.push({ min: 3, a, b });
  for (const bg of ['--bg', '--surface', '--surface-2', '--surface-3']) { T('--text', bg); T('--text-muted', bg); P('--line', bg); P('--focus', bg); P('--accent', bg); }
  T('--on-accent', '--accent'); T('--on-bar', '--bar'); T('--danger-text', '--danger-bg'); P('--danger', '--danger-bg'); T('--info-text', '--info-bg');
  T('--text', '--accent-soft'); T('--label-text', '--label-bg'); P('--label-line', '--label-bg'); T('--floor-label-text', '--floor-label-bg');
  P('--scene-clash', '--scene-slab'); P('--scene-locked-edge', '--scene-slab'); P('--scene-clash', '--surface'); P('--scene-locked-edge', '--surface');
  for (const a of AGENTS) { T(a.inkVar, a.colourVar); P('--agent-edge', a.colourVar); }
  return rows.map((r) => ({ ...r, value: ratio(t[r.a], t[r.b]) })).filter((r) => r.value < r.min).map((r) => `${r.a} on ${r.b}: ${r.value.toFixed(2)} (needs ${r.min})`);
}
for (const mode of ['light', 'dark']) {
  test(`look-and-feel T1: ${mode} mode reaches WCAG AA (4.5 to 1 for text, 3 to 1 for borders, focus ring and marks)`, () => {
    assert.deepEqual(checkMode(mode), []);
  });
}

test('look-and-feel T1: keyboard focus ring is defined, and the page loads theme.css before styles.css with the cache tag', () => {
  assert.match(readStyles(), /:focus-visible \{ outline: 3px solid #[0-9a-f]{6}; outline-offset: 2px; \}/);
  const html = readDoc('index.html');
  const theme = html.indexOf('theme.css?v=build-look-1');
  assert.ok(theme > 0 && theme < html.indexOf('styles.css?v=build-look-1'));
  assert.match(html, /<a class="skip-link" href="#page">/);
});

test('look-and-feel T1: the page script keeps dark mode on the body, and every control keeps a visible label', () => {
  const html = readDoc('index.html');
  assert.match(html, /<body data-view="home" data-theme="light"/);
  // Every button, select, textarea and input in the static page has text, a label or an aria-label.
  for (const m of html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)) assert.ok(m[1].trim().length > 0 || /aria-label/.test(m[0]), `button without a label: ${m[0]}`);
  for (const m of html.matchAll(/<(select|textarea)\b[^>]*\sid="([^"]+)"/g)) assert.match(html, new RegExp(`<label[^>]*for="${m[2]}"`), `label for ${m[2]}`);
});
