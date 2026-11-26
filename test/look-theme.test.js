// Look-and-feel Task L1: the theme file, dark and light mode, the page that does not scroll, the cache tag, and keyboard use.
// What these tests CANNOT show: how the page looks (colours on a real screen, spacing, type), whether a real browser applies the rules as written,
// a real keyboard or screen reader. The colour contrast is computed from the theme file (see the accessibility test named in the checklist).
// Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { readDoc, themeVariables, readStyles } from '../test-helpers/fake-page.js';
import { withLook, walk, savedSettings, THEME_KEY } from '../test-helpers/look-page.js';

const plain = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const theme = plain(readDoc('theme.css'));
const styles = plain(readDoc('styles.css'));
const html = readDoc('index.html');

// Every declaration of a stylesheet as [property, value], with the selector, in file order. Rules inside @media are included.
function declarations(text) {
  const out = [];
  for (const rule of text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    for (const d of rule[2].split(';')) {
      const at = d.indexOf(':');
      if (at > 0) out.push({ selector: rule[1].trim(), property: d.slice(0, at).trim(), value: d.slice(at + 1).trim() });
    }
  }
  return out;
}
const decls = declarations(styles);

// ---- One theme file --------------------------------------------------------------------------------------------------------------

test('L1: the theme file holds every colour, font and spacing value; the stylesheet holds none of its own', () => {
  // No colour written in the stylesheet: no hex, no rgb(), no hsl(), and every colour property takes a theme name or a plain keyword.
  assert.doesNotMatch(styles, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, 'a colour is written in styles.css');
  const COLOUR_PROPERTIES = /^(color|background|background-color|border|border-(top|bottom|left|right)|border-color|outline|fill|stroke|accent-color|caret-color|text-decoration-color)$/;
  for (const d of decls.filter((x) => COLOUR_PROPERTIES.test(x.property))) {
    const rest = d.value.replace(/var\(--[\w-]+\)/g, '').replace(/radial-gradient\(closest-side,?/g, '').replace(/\b(none|transparent|currentColor|inherit|solid|dashed|auto|0)\b/g, '').replace(/[()]/g, '').replace(/[\s,]/g, '');
    assert.equal(rest, '', `${d.selector} { ${d.property}: ${d.value} } writes a colour or a size of its own`);
  }
  // No font written in the stylesheet: a font comes from a theme name.
  for (const d of decls.filter((x) => x.property === 'font-family')) assert.match(d.value, /^var\(--font-[a-z]+\)$/, `${d.selector}: ${d.value}`);
  for (const d of decls.filter((x) => x.property === 'font')) assert.equal(d.value, 'inherit', `${d.selector}: only "font: inherit" is allowed`);
  // No spacing, radius, type size, letter spacing or timing written as a number with a unit: each takes a theme name (or is 0, auto or a percentage).
  const THEME_ONLY = /^(padding|padding-[a-z]+|margin|margin-[a-z]+|gap|row-gap|column-gap|border-radius|font-size|letter-spacing|transition|transition-duration|animation|animation-delay|animation-duration)$/;
  for (const d of decls.filter((x) => THEME_ONLY.test(x.property))) {
    const withoutNames = d.value.replace(/var\(--[\w-]+\)/g, '');
    assert.doesNotMatch(withoutNames, /\d*\.?\d+(px|rem|em|ms)\b/, `${d.selector} { ${d.property}: ${d.value} } writes a size or a time of its own`);
    if (d.property === 'animation' || d.property === 'animation-duration') assert.doesNotMatch(withoutNames, /\b\d+(\.\d+)?s\b/, `${d.selector}: ${d.value}`);
  }
  // Everything the stylesheet asks of the theme is in the theme, in both modes where it is a colour.
  const dark = themeVariables('dark');
  const light = themeVariables('light');
  // The stylesheet may name one thing of its own: --badge-fill, which only points at an agent colour of the theme (so a badge, a card edge and a
  // label can share one rule). Any such name must hold nothing but a theme name.
  const local = decls.filter((d) => d.property.startsWith('--'));
  assert.deepEqual([...new Set(local.map((d) => d.property))], ['--badge-fill']);
  for (const d of local) assert.match(d.value, /^var\(--agent-[a-z]+\)$/, `${d.selector}: ${d.value}`);
  const used = new Set([...styles.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]).filter((n) => n !== '--badge-fill'));
  assert.ok(used.size > 60, `the stylesheet uses ${used.size} theme names`);
  for (const name of used) {
    assert.ok(Object.hasOwn(dark, name), `${name} is in the theme`);
    if (/^#/.test(dark[name])) assert.ok(Object.hasOwn(light, name), `the colour ${name} is also in the light theme`);
  }
});

test('L1: the theme file has the fonts, the type sizes, the spacing steps and the motion times as named values', () => {
  const vars = themeVariables('dark');
  for (const name of ['--font-text', '--font-display', '--font-mono', '--weight-display', '--text-base', '--text-hero', '--space-1', '--space-8', '--radius', '--radius-lg', '--dur', '--dur-slow', '--ease', '--control-height']) {
    assert.ok(Object.hasOwn(vars, name), `${name} is in the theme`);
  }
  assert.equal(vars['--weight-display'], '300', 'headings are light');
  assert.match(vars['--font-text'], /^system-ui/);
  // The spacing steps grow, so the page keeps one rhythm.
  const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => Number.parseFloat(vars[`--space-${n}`]));
  assert.deepEqual([...steps].sort((a, b) => a - b), steps);
  assert.ok(new Set(steps).size === 8);
});

test('L1: dark is the default, the light theme defines every colour the dark theme does, and the page starts as dark', () => {
  const dark = themeVariables('dark');
  const light = themeVariables('light');
  const colours = Object.keys(dark).filter((k) => /^#[0-9a-fA-F]{6}$/.test(dark[k]));
  assert.ok(colours.length >= 50, `${colours.length} colours`);
  assert.deepEqual(colours.filter((k) => !Object.hasOwn(light, k)), [], 'the light theme leaves no colour of the dark theme undefined');
  assert.deepEqual(Object.keys(light).filter((k) => !Object.hasOwn(dark, k)), [], 'the light theme adds nothing the dark theme lacks');
  // Dark: a near-black background and light text.
  const lum = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255).reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0);
  assert.ok(lum(dark['--bg']) < 0.06, 'a near-black background');
  assert.ok(lum(dark['--text']) > 0.7);
  assert.ok(lum(light['--bg']) > 0.8);
  // The first colour block of the theme is the dark one and applies with no attribute at all (so a page with no script is dark too).
  assert.match(theme, /:root,\s*:root\[data-theme="dark"\] \{[\s\S]*?--bg: #0b0c0e;/);
  assert.match(theme, /:root\[data-theme="light"\] \{/);
  assert.match(html, /<html lang="en" data-theme="dark">/);
  assert.match(html, /<meta name="color-scheme" content="dark light">/);
});

test('L1: the theme toggle is a button with a visible label; it switches dark and light, keeps the choice in this browser, and the page starts as chosen', async () => {
  let kept;
  await withLook({}, async (page, opened) => {
    const root = page.document.documentElement;
    const toggle = page.el('theme-toggle');
    assert.equal(toggle.tagName, 'BUTTON');
    assert.equal(root.getAttribute('data-theme'), 'dark');
    assert.equal(toggle.textContent, 'Light mode');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    page.el('choose-sample').click();
    toggle.click();
    assert.equal(root.getAttribute('data-theme'), 'light');
    assert.equal(toggle.textContent, 'Dark mode');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(page.el('settings-theme-light').getAttribute('aria-pressed'), 'true');
    assert.equal(page.el('settings-theme-dark').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(opened.recorder.writes, [[THEME_KEY, 'light']]);
    kept = Object.fromEntries(opened.recorder.data);
    page.el('settings-theme-dark').click();
    assert.equal(root.getAttribute('data-theme'), 'dark');
    assert.equal(toggle.textContent, 'Light mode');
    assert.deepEqual(page.problemLines(), []);
  });
  await withLook({ storage: kept }, async (page) => {
    assert.equal(page.document.documentElement.getAttribute('data-theme'), 'light', 'the page starts light because that was chosen');
    assert.equal(page.el('theme-toggle').textContent, 'Dark mode');
  });
  // A saved value that is not a theme is ignored.
  await withLook({ storage: { [THEME_KEY]: 'purple' } }, async (page) => {
    assert.equal(page.document.documentElement.getAttribute('data-theme'), 'dark');
  });
});

// ---- Motion ----------------------------------------------------------------------------------------------------------------------

test('L1: motion respects "reduce motion": the theme sets every time to nothing and the stylesheet switches animation and transition off', () => {
  const block = /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/.exec(theme);
  assert.ok(block, 'the theme has a reduce-motion block');
  for (const name of ['--dur-fast', '--dur', '--dur-slow']) assert.match(block[1], new RegExp(`${name}: 0\\.01ms;`), `${name} is set to nothing`);
  const css = styles;
  const off = /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{([^}]*)\}/.exec(css);
  assert.ok(off, 'the stylesheet has a reduce-motion block');
  assert.match(off[1], /animation: none !important;/);
  assert.match(off[1], /transition: none !important;/);
  assert.match(off[1], /scroll-behavior: auto !important;/);
  // Everything that moves is written once, and every movement is named: rises and drifts, plus the small hover lift.
  assert.deepEqual([...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]).sort(), ['glow-drift', 'rise']);
  assert.match(css, /\.choice-primary:hover, \.nav-primary:hover \{ transform: none; \}/, 'the hover lift is switched off too');
});

// ---- The page does not scroll ----------------------------------------------------------------------------------------------------

test('L1: the page itself does not scroll: the body is fixed to the screen and only named areas scroll inside themselves', () => {
  const body = decls.filter((d) => d.selector === 'body');
  const value = (p) => body.find((d) => d.property === p).value;
  assert.equal(value('overflow'), 'hidden');
  assert.match(value('height'), /100(vh|dvh)/);
  assert.ok(body.some((d) => d.property === 'height' && d.value === '100dvh'), 'the height follows the visible screen on a phone');
  assert.equal(decls.find((d) => d.selector === 'html, body' && d.property === 'height').value, '100%');
  // Only these areas may scroll, each inside its own box: the home page, the project area, the other pages, the agent strip, the side panels, the
  // result body, the red messages, and the long lists of the old screens.
  const ALLOWED = ['.home', '.project-scroll', '.page-scroll', '.agent-strip', '#col-side', '.result-body', '#error-message, #intake-error-message'];
  const scrolling = decls.filter((d) => /^overflow(-y)?$/.test(d.property) && /auto|scroll/.test(d.value)).map((d) => d.selector);
  assert.deepEqual([...new Set(scrolling)].sort(), [...ALLOWED].sort());
  assert.doesNotMatch(styles, /overflow-x\s*:\s*(scroll|auto)/, 'no sideways scrolling');
  // The top bar, the bars with the two labels and the bottom tabs are outside every scrolling area, so they are always visible.
  const html = readDoc('index.html');
  const workspace = html.slice(html.indexOf('<div id="workspace"'), html.indexOf('</main>'));
  assert.ok(workspace.indexOf('id="workspace-bar"') < workspace.indexOf('id="project-scroll"'));
  assert.ok(workspace.indexOf('id="phone-tabs"') > workspace.indexOf('id="page-settings"'));
  assert.ok(html.indexOf('</header>') < html.indexOf('<main') && html.indexOf('</main>') < html.indexOf('<footer'));
  assert.doesNotMatch(styles, /position\s*:\s*fixed/);
});

// ---- Cache tag, nothing from outside ----------------------------------------------------------------------------------------------

function listFiles(dir, out = []) {
  for (const name of readdirSync(new URL(dir, import.meta.url))) {
    const rel = `${dir}${name}`;
    if (statSync(new URL(rel, import.meta.url)).isDirectory()) { if (!['vendor', 'engine', 'team', 'knowledge'].includes(name)) listFiles(`${rel}/`, out); } else out.push(rel);
  }
  return out;
}

test('L1: every page file carries the cache tag build-look-1: the links, the scripts, every import of a page script, and the status lines', async () => {
  assert.match(html, /theme\.css\?v=build-look-1/);
  assert.match(html, /styles\.css\?v=build-look-1/);
  assert.match(html, /viewer\.js\?v=build-look-1/);
  assert.match(html, /intake\/screens\.js\?v=build-look-1/);
  assert.doesNotMatch(html, /v=build-(?!look-1)/, 'no other tag in the page');
  for (const name of ['viewer.js', 'intake/screens.js']) assert.match(readDoc(name), /const PAGE_VERSION = 'build-look-1'/);
  // Every file that the two entry scripts load on their own, and every import inside the new workspace files, has the tag in its address.
  for (const [name, pattern] of [['viewer.js', /await import\((\w+_FILE)\)/g], ['intake/screens.js', /await (?:attempt\([^,]+, \(\) => )?import\((\w+_FILE)\)/g]]) {
    const text = readDoc(name);
    for (const [, constant] of text.matchAll(pattern)) {
      const line = new RegExp(`const ${constant} = \`[^\`]*\\?v=\\$\\{PAGE_VERSION\\}\``);
      assert.match(text, line, `${constant} in ${name} carries the tag`);
    }
  }
  for (const name of readdirSync(new URL('../docs/workspace/', import.meta.url))) {
    for (const [, spec] of readDoc(`workspace/${name}`).matchAll(/^import [^\n]* from '([^']+)';/gm)) {
      assert.match(spec, /\?v=build-look-1$/, `${name} imports ${spec} with the tag`);
    }
  }
  assert.match(readDoc('viewer.js'), /THEME_COLOURS_FILE = `\.\/workspace\/theme-colours\.js\?v=\$\{PAGE_VERSION\}`/);
  await withLook({}, async (page) => {
    assert.equal(page.el('script-status').textContent, 'Page script build-look-1: finished setting up.');
    assert.equal(page.el('intake-script-status').textContent, 'Page script build-look-1 (screens): finished setting up.');
  });
  // The old tags are gone from every page file.
  for (const file of listFiles('../docs/').filter((f) => /\.(js|html|css)$/.test(f))) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /build-(team|place|intake|viewer)-\d/, `${file} has an old tag`);
  }
});

// ---- Keyboard and labels ----------------------------------------------------------------------------------------------------------

test('L1: every workspace control is a real button or box with visible words, in the order it appears on the screen, and the keyboard focus ring is on', async () => {
  const start = html.indexOf('<div id="workspace"');
  const chrome = html.slice(start, html.indexOf('</main>'));
  // Each control is a button (or an input with a label), never a link or a clickable box.
  assert.doesNotMatch(chrome, /<a\b/);
  const tags = [...chrome.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(tags.length > 25, `${tags.length} buttons in the workspace`);
  for (const [, attrs, inner] of tags) {
    assert.match(attrs, /type="button"/, 'a button never submits');
    const words = inner.replace(/<span class="[^"]*" aria-hidden="true">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, '').trim();
    assert.ok(words.length >= 3 || /aria-label=/.test(attrs), `a button has words: ${attrs}`);
  }
  // Order: top bar, rail, main pages, agent strip, then the phone tabs.
  const at = (id) => chrome.indexOf(`id="${id}"`);
  const order = ['workspace-bar', 'rail', 'workspace-main', 'agent-strip', 'phone-tabs'];
  assert.deepEqual([...order].sort((a, b) => at(a) - at(b)), order);
  // The focus ring is on for every control and uses theme colours; nothing takes it away.
  assert.match(styles, /:focus-visible \{ outline: var\(--focus-width\) solid var\(--focus\); outline-offset: var\(--focus-offset\); \}/);
  assert.doesNotMatch(styles, /outline\s*:\s*(none|0)\b/);
  // A skip link is the first thing in the page and goes to the main area.
  assert.match(html, /<body>\s*<a class="skip-link" href="#page">Skip to the main content<\/a>/);
  assert.match(html, /<main id="page">/);
  // The pages the rail opens each have a heading that takes focus, and the one that is shown is marked.
  await withLook({}, async (page) => {
    page.el('choose-own').click();
    for (const [rail, heading] of [['rail-agents', 'heading-agents'], ['rail-materials', 'heading-materials'], ['rail-settings', 'heading-settings']]) {
      page.el(rail).click();
      assert.equal(page.document.activeElement, page.el(heading), `${rail} moves the focus to its heading`);
      assert.equal(page.el(rail).getAttribute('aria-current'), 'page');
    }
    assert.equal(page.el('rail-project').getAttribute('aria-current'), null);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L1: there is no visible-label gap: every box, list and check box has a label tied to it, in the workspace as well as the steps', () => {
  const controls = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].map((m) => m[2]).filter((attrs) => !/type="hidden"/.test(attrs));
  assert.ok(controls.length >= 40, `${controls.length} controls`);
  for (const attrs of controls) {
    const id = /\sid="([^"]+)"/.exec(attrs);
    assert.ok(id, `a control without an id: ${attrs}`);
    const label = new RegExp(`<label\\b[^>]*\\bfor="${id[1]}"[^>]*>([\\s\\S]*?)</label>`).exec(html);
    assert.ok(label, `${id[1]} has a label`);
    assert.ok(label[1].replace(/<[^>]*>/g, '').trim().length >= 3, `${id[1]}: the label has words`);
  }
  // The boxes made by the Agents page script get a label too: one per agent card.
  const source = readDoc('workspace/agents-page.js');
  assert.match(source, /label\.setAttribute\('for', `agent-level-\$\{info\.key\}`\)/);
});
