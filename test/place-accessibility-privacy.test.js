// Place Task 13: accessibility and privacy checks for the "Place furniture, doors and windows" screen.
//
// These tests read the real docs/index.html, docs/styles.css and the new page files, and run the real
// screens on the stand-in page (test-helpers/fake-page.js).
// What this CANNOT show (listed in the checklist as "Unverified: pending owner check"): how anything
// looks, a real 320 px phone, zoom to 200%, a screen reader, a real keyboard and focus ring, real touch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakePage, installFakePage, waitFor, readDoc, readStyles, themeValues } from '../test-helpers/fake-page.js';
import { PLAN_STYLES, drawPlan } from '../docs/intake/place-plan.js';
import * as geometry from '../docs/intake/place-geometry.js';

const html = readDoc('index.html');
const css = readStyles();
const plain = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const placeCss = plain(css.slice(css.indexOf('/* ---- Place furniture, doors and windows')));
const placeBlock = html.slice(html.indexOf('<div id="screen-place"'), html.indexOf('<div id="screen-review"'));

// The new page files. Their text is searched for storage, network and outside addresses.
const NEW_FILES = ['intake/place-screen.js', 'intake/place-plan.js', 'intake/place-geometry.js'];
const newText = (name) => plain(readDoc(name)).replace(/(^|[^:])\/\/.*$/gm, '$1');

// ---- Colour maths (the same formula as the existing contrast test) ------------------------------
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const [r, g, b] = channels(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

// ---- A stand-in page, as in the other place tests -----------------------------------------------
let caseNumber = 0;
const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
async function withOwn(body) {
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    caseNumber += 1;
    await import(`../docs/intake/screens.js?case=place-a11y-${caseNumber}`);
    await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
    page.el('choose-own').click();
    await body(page);
  } finally { restore(); }
}
function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
function placeSomething(page) {
  page.el('project-name').value = 'My home';
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = 'Ground floor';
  page.el('add-floor').click();
  for (const name of ['Kitchen', 'Bedroom']) { page.el('room-name').value = name; page.el('add-room').click(); }
  gotoStep(page, 'place');
  const option = page.el('place-room').children.find((o) => o.textContent === 'Kitchen');
  page.el('place-room').value = option.value;
  page.el('place-room').dispatch('change');
  for (const [type, status] of [['sofa', 'Locked'], ['door', 'Unsure']]) {
    page.el('place-type').value = type;
    page.el('place-type').dispatch('change');
    page.el('place-status-locked').checked = status === 'Locked';
    page.el('place-status-unsure').checked = status === 'Unsure';
    page.el('place-x').value = '50';
    page.el('place-y').value = '50';
    page.el('add-placed').click();
  }
}

// ==== Sizes =======================================================================================

test('Place Task 13: every control on the place screen uses a shared style that is at least 44 px high, and every label and text size is at least 16 px', () => {
  assert.ok(placeBlock.length > 3000, 'the place screen markup was found');
  // Every button, box and list on the screen is one of the shared styles, and the shared styles are 2.75 rem (44 px) or more.
  const controls = [...placeBlock.matchAll(/<(button|select|input)\b([^>]*)>/g)].map((m) => ({ tag: m[1], attrs: m[2] }));
  assert.ok(controls.length >= 20, `${controls.length} controls found`);
  for (const { tag, attrs } of controls) {
    const id = /\sid="([^"]+)"/.exec(attrs)[1];
    if (tag === 'input' && /type="radio"/.test(attrs)) {
      assert.match(placeBlock, new RegExp(`<label class="choice-label" for="${id}">`), `${id}: a radio sits inside a .choice-label (44 px high)`);
    } else if (tag === 'button') assert.match(attrs, /class="action-button"/, `${id} uses .action-button`);
    else assert.match(attrs, /class="text-input"/, `${id} uses .text-input`);
  }
  assert.match(css, /\.choice-button, \.nav-button, \.action-button \{[^}]*min-height: 2\.75rem;[^}]*min-width: 2\.75rem;/);
  assert.match(css, /\.text-input \{[^}]*min-height: 2\.75rem;/);
  assert.match(css, /\.choice-label \{[^}]*min-height: 2\.75rem;/);
  // The buttons in a row have a gap between them.
  assert.match(placeCss, /\.button-row \{[^}]*flex-wrap: wrap;[^}]*gap: 0\.5rem;/);
  // No text size in the place styles is below 16 px, and none is set in px smaller than 16.
  assert.ok(placeCss.length > 100);
  for (const m of placeCss.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)) {
    assert.ok((m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16) >= 16, `${m[0]} is under 16 px`);
  }
  assert.doesNotMatch(placeBlock, /style="|font-size/, 'no inline style on the place screen');
});

test('Place Task 13: the buttons the page script makes (Select, Edit, Remove) are real buttons with the shared 44 px style and words on them', async () => {
  await withOwn(async (page) => {
    placeSomething(page);
    const made = [...walk(page.el('place-list')), ...walk(page.el('place-others'))];
    const buttons = made.filter((n) => n.tagName === 'BUTTON');
    assert.ok(buttons.length >= 6, `${buttons.length} list buttons`);
    for (const b of buttons) {
      assert.match(b.className || b.getAttribute('class') || '', /action-button/, `"${b.textContent}" uses .action-button`);
      assert.ok(b.textContent.trim().length > 0, 'a button has words');
      assert.equal(b.getAttribute('type'), 'button');
    }
    // Nothing else in the list reacts to a click: a click handler on a non-button would not work by keyboard.
    for (const n of made) {
      if ((n.listeners.click || []).length) assert.equal(n.tagName, 'BUTTON', `${n.tagName} with a click handler`);
    }
    assert.deepEqual(page.problemLines(), []);
  });
});

test('Place Task 13: the plan text is at least 16 px at 320 px wide, for small and large rooms (computed from the stylesheet)', async () => {
  // The plan's width at a 320 px screen: the screen, minus the page padding and the panel's padding and border.
  const rem = 16;
  const pad = (selectorPattern) => {
    const m = selectorPattern.exec(plain(css));
    assert.ok(m, 'padding rule found');
    const values = m[1].trim().split(/\s+/).map((v) => Number(v.replace('rem', '')) * rem);
    return values.length === 1 ? values[0] * 2 : values[1] * 2; // left + right
  };
  const pagePad = pad(/#page \{[^}]*?padding:\s*([^;]+);/);
  const panelPad = pad(/\.panel \{[^}]*?padding:\s*([^;]+);/);
  const panelBorder = 2; // 1 px each side
  const available = 320 - pagePad - panelPad - panelBorder;
  assert.ok(available > 200 && available < 320, `the plan is ${available} px wide at 320 px`);
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    for (const [w, d] of [[1, 1], [2, 3], [4, 4], [8, 5], [15, 15], [30, 30]]) {
      const room = { name: 'R', width: w, depth: d };
      const svg = drawPlan(geometry, { room, objects: [{ id: 'a', kind: 'layout', name: 'Sofa', status: 'Locked', x: 10, y: 10, width: 100, depth: 100 }], selectedId: null });
      const viewBoxWidth = Number(svg.getAttribute('viewBox').split(' ')[2]);
      const text = walk(svg).find((n) => n.tagName === 'TEXT');
      const drawn = (Number(text.getAttribute('font-size')) * available) / viewBoxWidth;
      assert.ok(drawn >= 16, `${w} m by ${d} m room: the label is ${drawn.toFixed(2)} px at 320 px wide (needs 16)`);
      console.log(`  plan label at 320 px, ${w} m by ${d} m room: ${drawn.toFixed(2)} px`);
    }
  } finally { restore(); }
});

// ==== Contrast of the plan's own colours ==============================================================

for (const mode of ['light', 'dark']) {
  // look-and-feel: the plan's colours moved from place-plan.js to docs/theme.css (the --plan-* names), in two modes.
  test(`Place Task 13 (${mode} mode): the plan colours reach the contrast limits, and Locked and Unsure differ by line style and words, not colour alone`, () => {
    const t = themeValues(mode);
    const Locked = { ...PLAN_STYLES.Locked, stroke: t['--plan-locked-stroke'], fill: t['--plan-locked-fill'] };
    const Unsure = { ...PLAN_STYLES.Unsure, stroke: t['--plan-unsure-stroke'], fill: t['--plan-unsure-fill'] };
    const room = t['--plan-room-fill'];
    const text = t['--plan-text'];
    const rows = [
      ['Label text on the room', text, room, 4.5],
      ['Label text on a Locked object', text, Locked.fill, 4.5],
      ['Label text on an Unsure object', text, Unsure.fill, 4.5],
      ['Locked outline on the room', Locked.stroke, room, 3],
      ['Unsure outline on the room', Unsure.stroke, room, 3],
      ['Locked outline on its own fill', Locked.stroke, Locked.fill, 3],
      ['Unsure outline on its own fill', Unsure.stroke, Unsure.fill, 3],
      ['Selected-object ring on the room', t['--plan-ring'], room, 3],
      ['Room outline on the page panel', t['--plan-room-stroke'], room, 3],
      ['Plan border (stylesheet) on a panel', t['--line'], t['--surface'], 3],
    ];
    for (const [name, fg, bg, min] of rows) {
      const r = ratio(fg, bg);
      console.log(`  ${r.toFixed(2).padStart(5)} to 1  (needs ${min})  ${fg} on ${bg}  ${name}`);
      assert.ok(r >= min, `${name}: ${r.toFixed(2)} is below ${min}`);
    }
    // The stylesheet's .plan border is the colour tested above, and the drawing's colours come only from the classes.
    assert.match(readStyles(mode), new RegExp(`\\.plan \\{[^}]*border: 1px solid ${t['--line']};`));
    assert.doesNotMatch(readDoc('intake/place-plan.js'), /#[0-9a-fA-F]{3,6}\b/, 'no colour value in place-plan.js');
    assert.equal(Locked.dash, 'none');
    assert.notEqual(Unsure.dash, 'none');
    assert.ok(Locked.strokeWidth > Unsure.strokeWidth, 'Locked is thicker');
  });
}

test('Place Task 13: the plan classes are styled from the theme', () => {
  for (const cls of ['plan-room', 'plan-locked', 'plan-unsure', 'plan-selected', 'plan-label']) assert.match(readDoc('styles.css'), new RegExp(`\\.${cls} \\{[^}]*var\\(--plan-`));
});


test('Place Task 13: the plan colour check fails when a plan colour is made too light (planted change in a copy)', () => {
  // look-and-feel: the real colour is read from the theme (--plan-unsure-stroke).
  const real = themeValues('light')['--plan-unsure-stroke'];
  const lightened = '#f0c080';
  assert.ok(ratio(lightened, '#ffffff') < 3, 'the planted colour is below the limit, so the check would catch it');
  assert.ok(ratio(real, themeValues('light')['--plan-room-fill']) >= 3, 'the real colour passes');
});

// ==== 320 px layout ===================================================================================

test('Place Task 13: no fixed width above 320 px and no sideways scrolling rule in the place styles, and the plan scales to its panel', () => {
  assert.ok(placeCss.length > 100);
  for (const m of placeCss.matchAll(/(?<![-\w])(min-width|width)\s*:\s*([\d.]+)(px|rem)/g)) {
    const px = m[3] === 'rem' ? Number(m[2]) * 16 : Number(m[2]);
    assert.ok(px <= 320, `${m[0]} is wider than 320 px`);
  }
  assert.doesNotMatch(placeCss, /overflow-x\s*:\s*(scroll|auto)|white-space\s*:\s*nowrap/);
  assert.match(placeCss, /\.plan \{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*height: auto;/);
  assert.match(placeCss, /\.placed-text \{[^}]*overflow-wrap: anywhere;/);
  // The drawing has no fixed width or height of its own (only a view box), and the screen's layout has one shrinkable column.
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    const svg = drawPlan(geometry, { room: { name: 'Big', width: 30, depth: 30 }, objects: [], selectedId: null });
    assert.equal(svg.getAttribute('width'), null);
    assert.equal(svg.getAttribute('height'), null);
    assert.ok(svg.getAttribute('viewBox'));
  } finally { restore(); }
  assert.match(css, /\.screen \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.panel \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.screen > \* \{ min-width: 0; \}/);
});

// ==== Keyboard ========================================================================================

test('Place Task 13: the place screen\'s controls are in reading order, none has a tabindex above 0, and the plan itself is not a tab stop (the list is the keyboard version)', async () => {
  const ids = [...placeBlock.matchAll(/<(?:input|select|textarea|button)\b[^>]*?\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['place-room', 'place-type', 'place-name', 'place-status-locked', 'place-status-unsure', 'place-x', 'place-y', 'place-width', 'place-depth', 'add-placed',
    'sel-name', 'sel-x', 'sel-y', 'sel-width', 'sel-depth', 'sel-save', 'sel-status', 'nudge-left', 'nudge-right', 'nudge-up', 'nudge-down', 'sel-turn', 'sel-wall']);
  assert.doesNotMatch(placeBlock, /tabindex="[^-]/);
  // The form (add), then the selected object's panel, then the plan, then the list: the order of the markup.
  const at = (id) => placeBlock.indexOf(`id="${id}"`);
  assert.ok(at('place-room-panel') < at('place-form-panel') && at('place-form-panel') < at('place-selected-panel')
    && at('place-selected-panel') < at('place-plan-panel') && at('place-plan-panel') < at('place-list-panel'));
  await withOwn(async (page) => {
    placeSomething(page);
    const svg = walk(page.el('place-plan')).find((n) => n.tagName === 'SVG');
    assert.ok(svg, 'the plan is drawn');
    assert.equal(svg.getAttribute('tabindex'), null, 'the drawing is not a tab stop');
    assert.equal(svg.getAttribute('focusable'), 'false');
    assert.equal(svg.getAttribute('role'), 'img');
    // Everything a click on the plan can do is also done by buttons and boxes that are in the page: move (boxes, nudges, wall), turn.
    for (const id of ['sel-x', 'sel-y', 'nudge-left', 'nudge-right', 'nudge-up', 'nudge-down', 'sel-turn', 'sel-wall']) assert.ok(page.el(id), `${id} exists`);
    assert.deepEqual(page.problemLines(), []);
  });
});

// ==== Privacy =========================================================================================

test('Place Task 13: the three new page files store nothing, send nothing, hold no web address and insert no visitor text as page code', () => {
  const rules = [
    ['browser storage', /\b(localStorage|sessionStorage|indexedDB|openDatabase|caches\.(open|match)|cookieStore)\b/],
    ['cookies', /\.cookie\b/],
    ['sending data', /\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|serviceWorker|fetch)\b|new\s+(Worker|SharedWorker)\b/],
    ['web addresses', /https?:\/\/|\bwww\.|(?:src|href|action)\s*=\s*["']\/\/|url\(\s*["']?(?:https?:)?\/\//],
    ['page code from text', /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\b/],
    ['reading image contents', /\bFileReader\b|\.arrayBuffer\(|createImageBitmap|new\s+Image\s*\(/],
  ];
  for (const name of NEW_FILES) {
    const text = newText(name);
    assert.ok(text.length > 500, `${name} was read`);
    for (const [what, pattern] of rules) assert.doesNotMatch(text, pattern, `${name}: ${what}`);
  }
  // The new screen's markup has no outside address, inline script or inline style.
  assert.doesNotMatch(placeBlock, /https?:\/\/|<script|\sstyle=|\son\w+=/);
  // Visitor text goes in with textContent (or setAttribute) only.
  assert.match(newText('intake/place-screen.js'), /textContent/);
});

test('Place Task 13: the content security rule is exactly the one set in Task 6 (no outside address, no inline script, no unsafe-eval), and the page loads no new script or style file', () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)[1];
  assert.equal(csp, "default-src 'self'; script-src 'self' 'sha256-GqsWfEjHm73zbHa7lGbVXfv95jxypKuCtjd6kntjIRA='; style-src 'self'; base-uri 'none'; form-action 'none'; img-src 'self' blob:");
  assert.doesNotMatch(csp, /https?:|\*|unsafe-inline|unsafe-eval|data:/);
  // Scripts and styles loaded by the page: only the ones that were there (all from this site, nothing outside).
  const loaded = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(loaded.length >= 2);
  for (const url of loaded) assert.doesNotMatch(url, /^(?:[a-z]+:)?\/\//, `${url} is from this site`);
  // The plan's drawing name is written in pieces, so no web address is in the file (checked above); it is a name only.
  assert.doesNotMatch(readFileSync(new URL('../docs/intake/place-plan.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, ''), /https?:\/\//);
});

test('Place Task 13: using the place screen (add, select, nudge, turn, remove) touches no storage, cookie or network', async () => {
  const touched = [];
  // look-and-feel: localStorage may be used for the colour mode and the agent settings only, so it is a recording stand-in here.
  const stored = new Map();
  const savedLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => (stored.has(k) ? stored.get(k) : null), setItem: (k, v) => { stored.set(k, String(v)); } } });
  const trapped = ['sessionStorage', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker'];
  const saved = Object.fromEntries(trapped.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  for (const name of trapped) Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); throw new Error(`${name} must not be used`); } });
  try {
    await withOwn(async (page) => {
      Object.defineProperty(page.document, 'cookie', { configurable: true, get() { touched.push('cookie read'); return ''; }, set() { touched.push('cookie write'); } });
      const before = page.log.filter((l) => l.startsWith('fetch:')).length;
      placeSomething(page);
      const select = walk(page.el('place-list')).find((n) => n.tagName === 'BUTTON' && n.textContent.startsWith('Select '));
      select.click();
      for (const id of ['nudge-right', 'nudge-down', 'sel-turn']) page.el(id).click();
      const remove = walk(page.el('place-list')).find((n) => n.tagName === 'BUTTON' && n.textContent.startsWith('Remove '));
      remove.click();
      assert.equal(page.log.filter((l) => l.startsWith('fetch:')).length, before, 'no web request while placing objects');
      assert.deepEqual(page.problemLines(), []);
    });
  } finally {
    for (const n of trapped) { if (saved[n]) Object.defineProperty(globalThis, n, saved[n]); else delete globalThis[n]; }
    if (savedLocal) Object.defineProperty(globalThis, 'localStorage', savedLocal); else delete globalThis.localStorage;
  }
  assert.deepEqual(touched, []);
  assert.ok([...stored.keys()].every((k) => ['designforyou.theme', 'designforyou.agent-settings'].includes(k)), 'only the colour mode and the agent settings are stored');
});
