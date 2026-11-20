// Intake Task 6: page shell, start screen and navigation.
//
// These tests run the REAL docs/intake/screens.js against the REAL docs/index.html structure, using
// the small stand-in page in test-helpers/. What this CANNOT show: how the page looks, whether the CSS
// hides and shows the right parts, real keyboard and touch behaviour, or the browser's own content
// security enforcement. Those are "pending owner check" until someone looks at a real browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { DRAFT_STATEMENT } from '../src/label.js';
import { FIXED_SENTENCE } from '../docs/intake/report.js';

const html = readDoc('index.html');
const css = readDoc('styles.css');

// The screens in the order Next moves through them, with the words used in the step text and the title.
const STEPS = [
  ['setup', 'Project setup'],
  ['inspiration', 'Overall inspiration'],
  ['overrides', 'Room overrides'],
  ['brief', 'Your brief'],
  ['taste', 'Taste questions'],
  ['items', 'Your items'],
  ['review', 'Review and run'],
];
const ALL_SCREEN_IDS = ['start', ...STEPS.map(([id]) => id), 'result'];

let caseNumber = 0;

async function openScreens(configure = () => {}) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  caseNumber += 1;
  await import(`../docs/intake/screens.js?case=${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  return { page, restore };
}

async function withScreens(configure, body) {
  const { page, restore } = await openScreens(configure);
  try { await body(page); } finally { restore(); }
}

const shown = (page) => ALL_SCREEN_IDS.filter((id) => !page.el(`screen-${id}`).hidden);

// The part of index.html for one screen: from its opening tag to the next screen (or the step buttons).
function screenBlock(id) {
  const start = html.indexOf(`<div id="screen-${id}"`);
  assert.ok(start >= 0, `screen-${id} is not in the page`);
  const rest = html.slice(start + 1);
  const next = rest.search(/<div id="(screen-|step-nav)/);
  return html.slice(start, next === -1 ? undefined : start + 1 + next);
}

// ---- The start screen ----------------------------------------------------------------------

test('Task 6: the start screen has exactly two choices, with the exact words', async () => {
  const block = screenBlock('start');
  const buttons = [...block.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['Try the sample', 'Start my own project']);
  assert.equal((block.match(/<(a|input|select|textarea)\b/g) || []).length, 0, 'no other control on the start screen');
  await withScreens(() => {}, async (page) => {
    assert.equal(page.el('choose-sample').textContent, 'Try the sample');
    assert.equal(page.el('choose-own').textContent, 'Start my own project');
  });
});

test('Task 6: the start screen says what the app does, that it needs no login, that nothing leaves the browser, and the rule-based sentence', () => {
  const block = screenBlock('start');
  assert.ok(block.includes(FIXED_SENTENCE), 'the exact "fixed rules, not AI" sentence is on the start screen');
  assert.match(block, /needs no login/);
  assert.match(block, /nothing you enter leaves your browser/);
  assert.match(block, /Nothing is saved\. If you close or reload this page, everything you entered is lost\./);
  assert.match(block, /helps you describe a home project/);
});

test('Task 6: "Try the sample" shows the existing viewer; "Back to start" returns; the viewer markup is hidden until then', async () => {
  const result = screenBlock('result');
  assert.match(html, /<div id="screen-result" class="screen" hidden>/);
  for (const id of ['scene-area', 'version-slider', 'clash-list', 'details-text', 'legend', 'history', 'script-status', 'floor-all', 'reset-view']) {
    assert.ok(result.includes(`id="${id}"`), `the viewer's ${id} is still inside the result screen`);
  }
  await withScreens(() => {}, async (page) => {
    assert.deepEqual(shown(page), ['start']);
    page.el('choose-sample').click();
    assert.deepEqual(shown(page), ['result']);
    assert.equal(page.document.body.dataset.screen, 'result');
    page.el('result-back').click();
    assert.deepEqual(shown(page), ['start']);
  });
});

test('Task 6: "Start my own project" opens the setup screen', async () => {
  await withScreens(() => {}, async (page) => {
    page.el('choose-own').click();
    assert.deepEqual(shown(page), ['setup']);
  });
});

// ---- Screens, headings, focus, titles ------------------------------------------------------

test('Task 6: each screen has exactly one heading, and the page has exactly the nine screens', () => {
  const ids = [...html.matchAll(/<div id="screen-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ALL_SCREEN_IDS);
  for (const id of ALL_SCREEN_IDS) {
    const block = screenBlock(id);
    assert.equal((block.match(/<h1[\s>]/g) || []).length, 1, `${id} has one h1`);
    assert.match(block, new RegExp(`<h1 id="heading-${id}" tabindex="-1">[^<]+</h1>`), `${id} heading can take focus`);
  }
});

test('Task 6: moving to another screen moves the keyboard focus to its heading, and not on first load', async () => {
  await withScreens(() => {}, async (page) => {
    assert.equal(page.document.activeElement, null, 'nothing grabs the focus when the page loads');
    page.el('choose-own').click();
    assert.equal(page.document.activeElement, page.el('heading-setup'));
    for (const [id] of STEPS.slice(1)) {
      page.el('next-button').click();
      assert.equal(page.document.activeElement, page.el(`heading-${id}`), `Next moved the focus to the ${id} heading`);
    }
    page.el('back-button').click();
    assert.equal(page.document.activeElement, page.el('heading-items'));
    // Back to the first step, then to the start, then the sample result
    for (let i = 0; i < 5; i += 1) page.el('back-button').click();
    assert.equal(shown(page)[0], 'setup');
    page.el('back-button').click();
    assert.equal(page.document.activeElement, page.el('heading-start'));
    page.el('choose-sample').click();
    assert.equal(page.document.activeElement, page.el('heading-result'));
  });
});

test('Task 6: every screen has its own page title, and the titles differ', async () => {
  await withScreens(() => {}, async (page) => {
    const titles = new Map();
    titles.set('start', page.document.title);
    page.el('choose-own').click();
    titles.set('setup', page.document.title);
    for (const [id] of STEPS.slice(1)) {
      page.el('next-button').click();
      titles.set(id, page.document.title);
    }
    for (let i = 0; i < 7; i += 1) page.el('back-button').click(); // back to the start
    page.el('choose-sample').click();
    titles.set('result', page.document.title);
    assert.equal(titles.size, ALL_SCREEN_IDS.length);
    assert.equal(new Set(titles.values()).size, ALL_SCREEN_IDS.length, `titles differ: ${[...titles.values()].join(' | ')}`);
    for (const [id, name] of STEPS) assert.ok(titles.get(id).startsWith(name), `${id} title names the screen`);
    for (const title of titles.values()) assert.ok(title.endsWith('DesignForYou'));
  });
});

test('Task 6: the step text, Back and Next follow the screens, and Next is gone on the last step', async () => {
  await withScreens(() => {}, async (page) => {
    assert.equal(page.el('step-nav').hidden, true, 'no Back and Next on the start screen');
    assert.equal(page.el('step-text').hidden, true);
    page.el('choose-own').click();
    for (const [index, [id, name]] of STEPS.entries()) {
      if (index > 0) page.el('next-button').click();
      assert.deepEqual(shown(page), [id]);
      assert.equal(page.el('step-text').textContent, `Step ${index + 1} of 7: ${name}`);
      assert.equal(page.el('step-nav').hidden, false);
      assert.equal(page.el('next-button').hidden, index === STEPS.length - 1, `Next on ${id}`);
    }
    page.el('next-button').click(); // does nothing on the last step
    assert.deepEqual(shown(page), ['review']);
    // Back all the way to the start
    for (let i = 0; i < 6; i += 1) page.el('back-button').click();
    assert.deepEqual(shown(page), ['setup']);
    page.el('back-button').click();
    assert.deepEqual(shown(page), ['start']);
    assert.equal(page.el('step-nav').hidden, true);
  });
});

test('Task 6: the draft statement is on every screen (the two bars sit outside the screens and are never hidden)', async () => {
  // The bars carry the exact shared sentence, and sit outside <main>, so no screen can hide them.
  for (const tag of ['header', 'footer']) {
    const bar = html.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`))[0];
    assert.ok(bar.includes(`<p class="label-draft">${DRAFT_STATEMENT}</p>`), `${tag} bar has the draft statement`);
  }
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.ok(!main.includes(DRAFT_STATEMENT), 'the statement is not inside a screen, where a screen could hide it');
  // The stylesheet only hides the SAMPLE label on other screens, never the draft statement.
  assert.match(css, /body:not\(\[data-screen="result"\]\) \.label-sample \{ display: none; \}/);
  assert.doesNotMatch(css, /\.label-draft[^{]*\{[^}]*display: none/);
  await withScreens(() => {}, async (page) => {
    const visit = () => { assert.equal(page.el('top-bar').hidden, false); assert.equal(page.el('bottom-bar').hidden, false); };
    visit();
    page.el('choose-own').click(); visit();
    for (let i = 1; i < STEPS.length; i += 1) { page.el('next-button').click(); visit(); }
    for (let i = 0; i < 7; i += 1) page.el('back-button').click();
    page.el('choose-sample').click(); visit();
    assert.equal(page.document.body.dataset.screen, 'result');
  });
});

// ---- The content security rule -------------------------------------------------------------

const OLD_RULE = "default-src 'self'; script-src 'self' 'sha256-GqsWfEjHm73zbHa7lGbVXfv95jxypKuCtjd6kntjIRA='; style-src 'self'; base-uri 'none'; form-action 'none'";

test('Task 6: the content security rule differs from before only by blob: for images, with no unsafe-inline and no outside address', () => {
  const rule = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.equal(rule, `${OLD_RULE}; img-src 'self' blob:`);
  assert.doesNotMatch(rule, /unsafe-inline|unsafe-eval|https?:|\*/);
  assert.match(rule, /script-src 'self' 'sha256-/);
});

// ---- Protected steps and the red message ---------------------------------------------------

test('Task 6: a button that cannot be set up shows the red message, and every other control still works', async () => {
  await withScreens((p) => { p.failListenerOn = 'next-button'; }, async (page) => {
    const lines = page.el('intake-error-message').children.map((c) => c.textContent);
    assert.equal(page.el('intake-error-message').hidden, false);
    assert.equal(lines[0], 'Something went wrong on this page. Please take a screenshot of this red message.');
    assert.match(lines[1], /^Step "Next button" failed: cannot attach a listener to next-button$/);
    assert.equal(lines.length, 2, 'only the one step failed');
    assert.equal(page.el('error-message').hidden, true, "the viewer's own red box is separate and untouched");
    // Everything else works.
    page.el('choose-own').click();
    assert.deepEqual(shown(page), ['setup']);
    page.el('back-button').click();
    assert.deepEqual(shown(page), ['start']);
    page.el('choose-sample').click();
    assert.deepEqual(shown(page), ['result']);
    page.el('result-back').click();
    assert.match(page.el('intake-script-status').textContent, /finished setting up/);
  });
});

test('Task 6: if the sample button cannot be set up, "Start my own project" and the rest still work', async () => {
  await withScreens((p) => { p.failListenerOn = 'choose-sample'; }, async (page) => {
    assert.match(page.el('intake-error-message').children[1].textContent, /^Step "Try the sample button" failed/);
    page.el('choose-own').click();
    assert.deepEqual(shown(page), ['setup']);
    page.el('next-button').click();
    assert.deepEqual(shown(page), ['inspiration']);
  });
});

test('Task 6: if moving the focus fails, the screen still changes, the title is set and the red message appears', async () => {
  await withScreens(() => {}, async (page) => {
    page.el('heading-setup').focus = () => { throw new Error('a made-up focus failure'); };
    page.el('choose-own').click();
    assert.deepEqual(shown(page), ['setup']);
    assert.ok(page.document.title.startsWith('Project setup'));
    assert.match(page.el('intake-error-message').children.map((c) => c.textContent).join('\n'), /Step "Moving the keyboard focus" failed: a made-up focus failure/);
    page.el('next-button').click();
    assert.deepEqual(shown(page), ['inspiration'], 'the next screen is not affected');
    assert.equal(page.document.activeElement, page.el('heading-inspiration'));
  });
});

test('Task 6: an unusable red box is not fatal (the error goes to the browser console instead)', async () => {
  await withScreens((p) => { p.failListenerOn = 'next-button'; p.failCreate = ['p']; }, async (page) => {
    page.el('choose-own').click();
    assert.deepEqual(shown(page), ['setup']);
    assert.ok(page.consoleErrors.some((line) => line.includes('Next button')), 'the problem reached the console');
  });
});

// ---- The cache tag and the status line -----------------------------------------------------

test('Task 6: the page files carry the cache tag build-intake-1, and the grey status lines name it', async () => {
  assert.match(html, /styles\.css\?v=build-intake-2/);
  assert.match(html, /viewer\.js\?v=build-intake-2/);
  assert.match(html, /intake\/screens\.js\?v=build-intake-2/);
  assert.match(html, /id="script-status">Page script: not started yet/);
  assert.match(html, /id="intake-script-status" class="status-line">Screens script: not started yet/);
  for (const text of [html, readDoc('viewer.js'), readDoc('intake/screens.js')]) assert.doesNotMatch(text, /build-viewer-3/);
  assert.match(readDoc('viewer.js'), /const PAGE_VERSION = 'build-intake-2'/);
  assert.match(readDoc('intake/screens.js'), /const PAGE_VERSION = 'build-intake-2'/);
  await withScreens(() => {}, async (page) => {
    assert.equal(page.el('intake-script-status').textContent, 'Page script build-intake-2 (screens): finished setting up.');
  });
});

// ---- Size and readability (what the stylesheet says) ---------------------------------------

test('Task 6: the new styles use text of at least 16 px, controls of at least 44 px, a visible focus ring, and no fixed pixel widths', () => {
  const part = css.slice(css.indexOf('/* ---- Intake screens'));
  assert.ok(part.length > 200, 'the intake styles are in the stylesheet');
  for (const m of part.matchAll(/font-size: ([\d.]+)(rem|px)/g)) {
    const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
    assert.ok(px >= 16, `font-size ${m[0]} is under 16 px`);
  }
  assert.match(part, /\.choice-button, \.nav-button, \.action-button \{[^}]*min-height: 2\.75rem;[^}]*min-width: 2\.75rem;/);
  assert.match(part, /:focus-visible \{ outline: 3px solid #0b3d91;/);
  assert.doesNotMatch(part.replace(/max-width: [\d.]+(rem|px)/g, ''), /(?<![-\w])width: \d+px/);
  assert.match(part, /\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /#script-status \{[^}]*font-size: 1rem;/);
});
