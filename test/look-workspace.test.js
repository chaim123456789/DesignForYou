// look-and-feel Task 2: the home page and the workspace (top bar, rail, centre, agent strip, phone tabs, no page scroll).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { readDoc, readStyles } from '../test-helpers/fake-page.js';
import { withLookPage, memoryStorage, fillProject, stepButton, runToEnd } from '../test-helpers/look-page.js';

installImportHooks();
const html = readDoc('index.html');
const css = readStyles();
const body = (page) => page.document.body.dataset;

test('look-and-feel T2: the home page has a headline, one sentence, the two buttons and the honest line', async () => {
  await withLookPage((page) => {
    assert.equal(body(page).view, 'home');
    assert.match(html, /<h1 id="heading-start" tabindex="-1">[^<]{10,}<\/h1>/);
    const about = /<p id="start-about"[^>]*>([^<]*)<\/p>/.exec(html)[1];
    assert.equal((about.match(/\./g) || []).length, 1, 'one sentence');
    assert.equal(page.el('choose-sample').textContent, 'Try the sample');
    assert.equal(page.el('choose-own').textContent, 'Start my own project');
    assert.match(html, /<p id="start-ai-off"[^>]*>The design team is rule-based, and AI is off\./);
    assert.match(css, /body\[data-view="home"\] #workspace-bar, body\[data-view="home"\] #rail, body\[data-view="home"\] #agent-strip \{ display: none; \}/);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T2: the workspace has a top bar, a rail with four pages, and the strip; the rail opens each page', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    assert.equal(body(page).view, 'workspace');
    assert.equal(page.el('ws-project-name').textContent, 'Sample two-storey home');
    assert.deepEqual(['rail-project', 'rail-agents', 'rail-materials', 'rail-settings'].map((id) => page.el(id).textContent), ['Project', 'Agents', 'Materials', 'Settings']);
    for (const [rail, screen] of [['agents', 'agents'], ['materials', 'materials'], ['settings', 'settings'], ['project', 'result']]) {
      page.el(`rail-${rail}`).click();
      assert.equal(page.el(`screen-${screen}`).hidden, false, `${rail} opens ${screen}`);
      assert.equal(page.el(`rail-${rail}`).getAttribute('aria-current'), 'page');
      assert.equal(['project', 'agents', 'materials', 'settings'].filter((n) => page.el(`rail-${n}`).hasAttribute('aria-current')).length, 1, 'one current page');
    }
    page.el('rail-materials').click();
    assert.match(html, /<p id="materials-note"[^>]*>Coming next\./);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T2: the strip shows one badge per agent with its state, and a click opens the Agents page', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const items = page.el('strip-list').children;
    assert.equal(items.length, 8);
    items[0].children[0].click(); // the first agent's button (Walls)
    assert.equal(page.el('screen-agents').hidden, false);
  });
});

test('look-and-feel T2: the ribbon button hides and shows the ribbon and says which', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const b = page.el('toggle-ribbon');
    assert.equal(b.textContent, 'Hide ribbon');
    b.click();
    assert.equal(body(page).ribbon, 'hidden');
    assert.equal(b.textContent, 'Show ribbon');
    assert.equal(b.getAttribute('aria-expanded'), 'false');
    assert.match(css, /body\[data-ribbon="hidden"\] #ribbon, body\[data-ribbon="hidden"\] #col-side/);
    b.click();
    assert.equal(body(page).ribbon, 'shown');
    assert.equal(b.getAttribute('aria-expanded'), 'true');
  });
});

test('look-and-feel T2: the theme toggle switches dark and light and keeps the choice in this browser only', async () => {
  const storage = memoryStorage();
  await withLookPage((page) => {
    assert.equal(body(page).theme, 'light');
    page.el('theme-toggle').click();
    assert.equal(body(page).theme, 'dark');
    assert.equal(page.el('theme-toggle').textContent, 'Light mode');
    assert.equal(storage.map.get('designforyou.theme'), 'dark');
    assert.deepEqual([...storage.map.keys()], ['designforyou.theme']);
  }, { storage });
  await withLookPage((page) => {
    assert.equal(body(page).theme, 'dark', 'the saved choice is used on the next visit');
    page.el('choose-sample').click();
    page.el('rail-settings').click();
    page.el('theme-select').value = 'light';
    page.el('theme-select').dispatch('change');
    assert.equal(body(page).theme, 'light');
  }, { storage });
});

test('look-and-feel T2: with no storage, or a system that prefers dark, the page still works', async () => {
  await withLookPage((page) => {
    page.el('theme-toggle').click();
    assert.equal(body(page).theme, 'dark');
    assert.deepEqual(page.problemLines(), []);
  }, { storage: null });
  await withLookPage((page) => { assert.equal(body(page).theme, 'dark'); }, { matchMedia: () => ({ matches: true }) });
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  await withLookPage((page) => { page.el('theme-toggle').click(); assert.equal(body(page).theme, 'dark'); assert.deepEqual(page.problemLines(), []); }, { storage: blocked });
});

test('look-and-feel T2: Full screen asks the 3D view to go full screen, and says so when the browser cannot', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('fullscreen-button').click();
    assert.match(page.el('action-status').textContent, /Full screen is not available/);
    let asked = 0;
    page.el('scene-area').requestFullscreen = () => { asked += 1; return Promise.resolve(); };
    page.el('fullscreen-button').click();
    assert.equal(asked, 1);
    // Without a 3D view on screen (the setup page of a new project) it says there is nothing to show.
    page.el('result-back').click();
    page.el('choose-own').click();
    page.el('fullscreen-button').click();
    assert.equal(asked, 1);
    assert.match(page.el('action-status').textContent, /no 3D view/i);
  });
});

test('look-and-feel T2: the page itself does not scroll, and the panes inside it do', () => {
  assert.match(css, /body \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);
  assert.match(css, /#page \{[^}]*overflow-y: auto;/);
  assert.match(css, /body\[data-screen="result"\] #page \{ overflow: hidden;/);
  assert.match(css, /body\[data-screen="result"\] #col-side \{[^}]*overflow-y: auto;/);
  assert.doesNotMatch(css, /position\s*:\s*fixed/);
  assert.match(html, /<main id="page" tabindex="-1">/);
});

test('look-and-feel T2: on a phone the rail is a row of tabs, the strip is hidden and the result has tabs', () => {
  assert.match(css, /#rail \{[^}]*flex-direction: row;/);
  assert.match(css, /#agent-strip \{ display: none; \}/);
  assert.match(css, /@media \(min-width: 48rem\) \{[^@]*#rail \{ flex-direction: column;/);
  assert.match(css, /@media \(max-width: 47\.99rem\) \{[^@]*#tab-details \{ display: inline-block; \}/);
  assert.match(html, /<div id="result-tabs" role="tablist"/);
});

test('look-and-feel T2: the result tabs switch the pane, and an own project gets a summary tab', async () => {
  await withLookPage(async (page) => {
    page.el('choose-sample').click();
    assert.equal(page.el('tab-summary').hidden, true);
    page.el('tab-details').click();
    assert.equal(body(page).resultPane, 'details');
    assert.equal(page.el('tab-details').getAttribute('aria-selected'), 'true');
    assert.equal(page.el('tab-view').getAttribute('aria-selected'), 'false');
    page.el('tab-view').click();
    page.el('result-back').click();
    fillProject(page);
    page.el('run-design-team').click();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('tab-summary').hidden, false);
    page.el('tab-summary').click();
    assert.equal(body(page).resultPane, 'summary');
    assert.equal(page.el('project-name') && page.el('ws-project-name').textContent, 'My home');
  });
});

test('look-and-feel T2: if the workspace code cannot attach a button, the red message names the step and the screens still work', async () => {
  await withLookPage((page) => {
    assert.match(page.problemLines().concat(page.el('intake-error-message').children.map((c) => c.textContent)).join(' '), /Workspace: rail buttons/);
    page.el('choose-own').click();
    assert.equal(page.el('screen-setup').hidden, false);
  }, { configure: (page) => { page.failListenerOn = 'rail-agents'; } });
});

test('look-and-feel T2: the labels stay: SAMPLE PROJECT on the sample, YOUR PROJECT on the own result, the draft statement everywhere', async () => {
  await withLookPage(async (page) => {
    assert.ok(html.includes('Plans are drafts for professional review. They are not verified engineering.'));
    page.el('choose-sample').click();
    assert.ok(page.document.querySelectorAll('.label-sample').every((p) => p.hidden === false));
    page.el('result-back').click();
    fillProject(page);
    page.el('run-design-team').click();
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(page.document.querySelectorAll('.label-own').every((p) => p.hidden === false));
    assert.equal(page.document.body.dataset.run, 'own');
  });
});
