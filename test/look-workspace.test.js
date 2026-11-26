// Look-and-feel Task L3: the workspace. A top bar (project name, Show/Hide ribbon, Full screen, theme toggle), a left rail (Project, Agents,
// Materials, Settings), the 3D view as large as possible, a slim strip with the agent icons and what each is doing, and tabs on a phone.
// What these tests CANNOT show: the real layout (sizes, wrapping, the phone's width), the browser's own full screen, touch. Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readDoc, readStyles } from '../test-helpers/fake-page.js';
import { registerHooks } from '../test-helpers/register-hooks.js';
import { withLook, walk, fillOwnProject, stepButton, runToEnd, heading, answerWaiting, continueButton, gotoStep } from '../test-helpers/look-page.js';
import { AGENT_INFO } from '../docs/workspace/agents-info.js';

// Test-only switch: when globalThis.__breakWorkspace is set, the page's workspace files cannot load (as if a file were missing or broken).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (globalThis.__breakWorkspace && specifier.startsWith('../workspace/') && specifier.includes(globalThis.__breakWorkspace)) {
      return { url: new URL('../test-helpers/broken-three.js', import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const html = readDoc('index.html');
const css = readStyles();
const PAGES = ['project', 'agents', 'materials', 'settings'];
// The strip's buttons are made by the page's script, so the stand-in finds them by walking down from the list.
const stripButton = (page, key) => walk(page.el('agent-strip-list')).find((n) => n.id === `strip-${key}`);
const shownPages = (page) => PAGES.filter((p) => !page.el(`page-${p}`).hidden);

test('L3: the top bar has the project name, Show/Hide ribbon, Full screen and the theme toggle, in that order, with visible words', () => {
  const bar = html.slice(html.indexOf('<header id="workspace-bar"'), html.indexOf('</header>', html.indexOf('<header id="workspace-bar"')));
  assert.deepEqual([...bar.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]), ['workspace-bar', 'home-button', 'workspace-project-name', 'bar-actions', 'ribbon-toggle', 'fullscreen-button', 'theme-toggle']);
  assert.match(bar, /<button type="button" id="ribbon-toggle" class="bar-button" aria-pressed="true" aria-controls="ribbon">Hide ribbon<\/button>/);
  assert.match(bar, /<button type="button" id="fullscreen-button" class="bar-button" aria-pressed="false">Full screen<\/button>/);
  assert.match(bar, /<button type="button" id="theme-toggle" class="bar-button" aria-pressed="false">Light mode<\/button>/);
});

test('L3: the left rail has Project, Agents, Materials and Settings in that order; Materials says "Coming next"', async () => {
  const rail = html.slice(html.indexOf('<nav id="rail"'), html.indexOf('</nav>', html.indexOf('<nav id="rail"')));
  assert.deepEqual([...rail.matchAll(/class="rail-text">([^<]+)</g)].map((m) => m[1]), ['Project', 'Agents', 'Materials', 'Settings']);
  assert.match(rail, /<nav id="rail" class="rail" aria-label="Workspace pages">/);
  await withLook({}, async (page) => {
    page.el('choose-own').click();
    assert.deepEqual(shownPages(page), ['project'], 'the Project page is first');
    page.el('rail-materials').click();
    assert.deepEqual(shownPages(page), ['materials']);
    assert.match(html, /<p id="materials-soon" class="lead">Coming next\. /);
    assert.match(html, /<h1 id="heading-materials" tabindex="-1">Materials<\/h1>/);
    assert.equal(walk(page.el('page-materials')).filter((n) => n.tagName === 'BUTTON' || n.tagName === 'INPUT').length, 0, 'a placeholder has no working controls');
    for (const page2 of ['agents', 'settings', 'project']) {
      page.el(`rail-${page2}`).click();
      assert.deepEqual(shownPages(page), [page2]);
      for (const name of PAGES) assert.equal(page.el(`rail-${name}`).getAttribute('aria-current'), name === page2 ? 'page' : null);
      assert.equal(page.document.body.dataset.page, page2);
    }
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L3: going to another page does not lose the project steps: the step you were on is still there when you come back', async () => {
  await withLook({}, async (page) => {
    page.el('choose-own').click();
    page.el('project-name').value = 'Keep me';
    page.el('project-name').dispatch('change');
    page.el('next-button').click();
    assert.equal(page.el('screen-inspiration').hidden, false);
    page.el('rail-settings').click();
    page.el('rail-project').click();
    assert.equal(page.el('screen-inspiration').hidden, false);
    assert.equal(page.el('workspace-project-name').textContent, 'Keep me');
    page.el('back-button').click();
    assert.equal(page.el('project-name').value, 'Keep me');
  });
});

test('L3: the top bar shows the project name: the sample\'s, the name you typed, and a plain word before you have typed one', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    assert.equal(page.el('workspace-project-name').textContent, 'Sample two-storey home');
    page.el('home-button').click();
    page.el('choose-own').click();
    assert.equal(page.el('workspace-project-name').textContent, 'Your project');
    page.el('project-name').value = 'Seaside flat';
    page.el('project-name').dispatch('change');
    page.el('next-button').click();
    assert.equal(page.el('workspace-project-name').textContent, 'Seaside flat');
  });
});

test('L3: Show/Hide ribbon hides the ribbon (floors, layers, labels) and brings it back, with the button saying which', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    const ribbon = page.el('ribbon');
    const button = page.el('ribbon-toggle');
    assert.equal(ribbon.hidden, false);
    assert.equal(button.textContent, 'Hide ribbon');
    button.click();
    assert.equal(ribbon.hidden, true);
    assert.equal(button.textContent, 'Show ribbon');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    button.click();
    assert.equal(ribbon.hidden, false);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    // The ribbon holds the view controls; the 3D view is not in it.
    const ribbonHtml = html.slice(html.indexOf('<div id="ribbon"'), html.indexOf('<div id="result-tabs"'));
    for (const id of ['floor-all', 'floor-ground', 'floor-upper', 'reset-view', 'show-all-labels', 'layer-structure', 'layer-style']) assert.ok(ribbonHtml.includes(`id="${id}"`), id);
    assert.ok(!ribbonHtml.includes('id="scene-area"'));
  });
});

test('L3: Full screen asks the browser to show the 3D view full screen, and the button says Exit full screen; Escape and the button leave it', async () => {
  await withLook({ fullscreen: true }, async (page, opened) => {
    page.el('choose-sample').click();
    const stage = page.el('stage');
    const button = page.el('fullscreen-button');
    assert.equal(stage.className, 'stage');
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(opened.fullscreenCalls, 1);
    assert.equal(stage.className, 'stage is-fullscreen');
    assert.equal(button.textContent, 'Exit full screen');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    // The legend and the labels are part of the stage, so they go full screen with the drawing.
    assert.ok(html.slice(html.indexOf('<div id="stage"'), html.indexOf('<p id="sample-text-alternative"')).includes('id="agent-legend"'));
    // The browser leaves full screen by itself (Escape): the page follows.
    page.document.fullscreenElement = null;
    page.document.dispatch('fullscreenchange', {});
    assert.equal(stage.className, 'stage');
    assert.equal(button.textContent, 'Full screen');
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(stage.className, 'stage is-fullscreen');
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(stage.className, 'stage');
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L3: without the browser\'s full screen the 3D view fills the workspace instead, and Escape leaves it', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    page.el('fullscreen-button').click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(page.el('stage').className, 'stage is-fullscreen');
    assert.match(css, /\.stage\.is-fullscreen \{ position: absolute; inset: 0; z-index: 10;/);
    assert.match(css, /\.workspace-body \{ position: relative;/, 'it fills the area under the top bar, so the Exit button stays in reach');
    page.document.dispatch('keydown', { key: 'Escape' });
    assert.equal(page.el('stage').className, 'stage');
    // Full screen from another page goes back to the Project page first, where the 3D view is.
    page.el('rail-agents').click();
    page.el('fullscreen-button').click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(shownPages(page), ['project']);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L3: the 3D view is as large as possible: it takes all the room the project area has, and the ribbon and panels do not push it off', () => {
  const rule = (selector) => new RegExp(`(?:^|\\})\\s*${selector.replace(/[.#[\]"=]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(css)[1];
  assert.match(rule('.screen-result'), /height: 100%;/);
  assert.match(rule('.screen-result'), /display: flex;[^}]*flex-direction: column;/);
  assert.match(rule('.result-body'), /flex: 1 1 auto;[^}]*min-height: 0;/);
  assert.match(rule('#col-main'), /flex: 1 1 0;[^}]*display: flex;[^}]*flex-direction: column;/);
  assert.match(rule('.stage'), /flex: 1 1 auto;/);
  assert.match(rule('#scene-area'), /position: absolute; inset: 0;/);
  assert.match(rule('#page-inner'), /flex: 1 1 auto;[^}]*min-height: 0;[^}]*flex-direction: row;/);
  // Only a slim column of panels beside it.
  assert.match(readDoc('theme.css'), /--side-width: 22rem;/);
  assert.match(rule('#col-side'), /flex: 0 0 22rem/, 'the side column is the theme\'s --side-width');
});

// ---- The agent strip -------------------------------------------------------------------------------------------------------------

test('L3: the slim strip on the right lists the eight agents, each with its badge and what it is doing now; nothing else', async () => {
  await withLook({}, async (page) => {
    const items = walk(page.el('agent-strip-list')).filter((n) => n.className === 'strip-button');
    assert.equal(items.length, 8);
    assert.deepEqual(items.map((b) => b.id), AGENT_INFO.map((a) => `strip-${a.key}`));
    for (const [i, button] of items.entries()) {
      const info = AGENT_INFO[i];
      assert.equal(button.tagName, 'BUTTON');
      assert.equal(button.children[0].textContent, info.letter);
      const [name, status] = button.children[1].children;
      assert.equal(name.textContent, info.name);
      assert.equal(status.textContent, 'Not started', 'before any run');
      assert.match(button.getAttribute('aria-label'), new RegExp(`^${info.name}\\. Not started\\. Open the Agents page\\.$`));
    }
    assert.equal(page.el('agent-strip').getAttribute('aria-label'), 'What the agents are doing');
    // The sample shows the scripted run: every agent has run.
    page.el('choose-sample').click();
    const statuses = items.map((b) => b.children[1].children[1].textContent);
    assert.ok(statuses.every((t) => /^Done/.test(t)), statuses.join(' | '));
    assert.ok(statuses.some((t) => /proposals?$/.test(t)));
  });
});

test('L3: while the agents work, the strip says which one is asking and how many answers it waits for; it follows them to the end', async () => {
  await withLook({ storage: { 'designforyou.agent-settings': JSON.stringify({ version: 1, global: 'ask', perAgent: {}, doorsFollowWall: true }) } }, async (page) => {
    fillOwnProject(page);
    stepButton(page).click();
    const status = (key) => walk(stripButton(page, key)).find((n) => n.className === 'strip-status').textContent;
    assert.equal(heading(page), 'Walls');
    assert.match(status('walls'), /^Asking: \d+ to answer$/);
    assert.equal(status('doors'), 'Waiting');
    answerWaiting(page);
    assert.equal(status('walls'), 'Finished, press Continue');
    continueButton(page).click();
    assert.equal(heading(page), 'Doors and windows');
    assert.equal(status('walls'), 'Done');
    assert.match(status('doors'), /^Asking: /);
    assert.equal(stripButton(page, 'doors').getAttribute('data-state'), 'now');
    await runToEnd(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.ok(AGENT_INFO.every((a) => /^Done/.test(status(a.key))), 'every agent is done at the end');
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L3: clicking an agent in the strip opens the Agents page at that agent\'s card', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    assert.deepEqual(shownPages(page), ['project']);
    stripButton(page, 'furniture').click();
    assert.deepEqual(shownPages(page), ['agents']);
    const title = walk(page.el('agents-cards')).find((n) => n.id === 'agent-title-furniture');
    assert.equal(page.document.activeElement, title);
    assert.equal(title.textContent, '5. Furniture');
    assert.deepEqual(page.problemLines(), []);
  });
});

// ---- A phone: tabs ------------------------------------------------------------------------------------------------------------------

test('L3: on a phone the rail becomes four tabs at the bottom, the strip is replaced by the Agents tab, and the result splits into 3D, Details and Report tabs', async () => {
  const phone = /@media \(max-width: 48rem\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.match(phone, /\.rail \{ display: none; \}/);
  assert.match(phone, /\.phone-tabs \{[^}]*display: flex;/);
  assert.match(css, /\.phone-tabs \{ display: none; \}/, 'the tabs are not there on a wide screen');
  assert.match(/@media \(max-width: 60rem\) \{([\s\S]*?)\n\}/.exec(css)[1], /\.agent-strip \{ display: none; \}/);
  assert.match(phone, /\.screen-result\[data-result-tab="3d"\] #col-side \{ display: none; \}/);
  assert.match(phone, /\.screen-result\[data-result-tab="details"\] #col-main \{ display: none; \}/);
  assert.match(phone, /\.tab-phone-only \{ display: inline-flex;/);
  assert.match(css, /\.screen-result\[data-result-tab="report"\] #page-inner \{ display: none; \}/);
  assert.match(css, /\.screen-result:not\(\[data-result-tab="report"\]\) #own-result \{ display: none; \}/);
  // The tabs come after the pages in the page, so their order on screen (at the bottom) is their order in the page.
  assert.ok(html.indexOf('id="phone-tabs"') > html.indexOf('id="page-settings"'));
  const tabs = html.slice(html.indexOf('<nav id="phone-tabs"'), html.indexOf('</nav>', html.indexOf('<nav id="phone-tabs"')));
  assert.deepEqual([...tabs.matchAll(/data-page="(\w+)"[^>]*>([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`), ['project:Project', 'agents:Agents', 'materials:Materials', 'settings:Settings']);
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    // The phone tabs do the same as the rail.
    page.el('tab-agents').click();
    assert.deepEqual(shownPages(page), ['agents']);
    assert.equal(page.el('tab-agents').getAttribute('aria-current'), 'page');
    assert.equal(page.el('rail-agents').getAttribute('aria-current'), 'page');
    page.el('tab-project').click();
    // The result tabs.
    const screen = page.el('screen-result');
    assert.equal(screen.getAttribute('data-result-tab'), '3d');
    assert.equal(page.el('tab-report').hidden, true, 'a sample has no report tab');
    page.el('tab-details').click();
    assert.equal(screen.getAttribute('data-result-tab'), 'details');
    assert.equal(page.el('tab-details').getAttribute('aria-pressed'), 'true');
    assert.equal(page.el('tab-3d').getAttribute('aria-pressed'), 'false');
    page.el('tab-3d').click();
    assert.equal(screen.getAttribute('data-result-tab'), '3d');
  });
});

test('L3: your own result has a Report tab with the summary and the design team\'s report, and the 3D view is the first tab', async () => {
  await withLook({ storage: { 'designforyou.agent-settings': JSON.stringify({ version: 1, global: 'auto', perAgent: {}, doorsFollowWall: true }) } }, async (page) => {
    fillOwnProject(page);
    stepButton(page).click();
    await runToEnd(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.deepEqual(shownPages(page), ['project'], 'the workspace comes back to the Project page for the result');
    assert.equal(page.el('workspace-project-name').textContent, 'My home');
    assert.equal(page.el('tab-report').hidden, false);
    assert.equal(page.el('screen-result').getAttribute('data-result-tab'), '3d');
    page.el('tab-report').click();
    assert.equal(page.el('screen-result').getAttribute('data-result-tab'), 'report');
    assert.ok(walk(page.el('own-summary')).length > 10, 'the summary is in the report');
    page.el('result-start-again').click();
    assert.equal(page.el('workspace').hidden, true, 'Start again goes back to the home page');
    page.el('choose-sample').click();
    assert.equal(page.el('tab-report').hidden, true);
    assert.equal(page.el('screen-result').getAttribute('data-result-tab'), '3d');
    assert.deepEqual(page.problemLines(), []);
  });
});

// ---- Protected steps -------------------------------------------------------------------------------------------------------------

test('L3: if a workspace file cannot load (each of shell.js, agents-page.js, settings.js and store.js in turn), the red message names the step and the project steps still work', async () => {
  for (const broken of ['shell.js', 'agents-page.js', 'settings.js', 'store.js']) {
    globalThis.__breakWorkspace = broken;
    try {
      await withLook({}, async (page) => {
        const lines = page.el('intake-error-message').children.map((c) => c.textContent).join('\n');
        assert.match(lines, /Step "Workspace" failed: /, `${broken}: ${lines}`);
        assert.equal(page.el('intake-error-message').hidden, false);
        // The home page works, the project steps show (the workspace box is not left hidden), and Back / Next / Start again work.
        page.el('choose-own').click();
        assert.equal(page.el('workspace').hidden, false);
        assert.equal(page.el('screen-setup').hidden, false);
        page.el('project-name').value = 'Still works';
        page.el('project-name').dispatch('change');
        page.el('next-button').click();
        assert.equal(page.el('screen-inspiration').hidden, false);
        page.el('back-button').click();
        assert.equal(page.el('project-name').value, 'Still works');
        gotoStep(page, 'review');
        assert.equal(stepButton(page), undefined, 'the agents are shown on the Agents page, so without the workspace only the one-go button is offered');
        assert.equal(page.el('run-design-team').textContent, 'Run the design team');
        page.el('start-again').click();
        assert.equal(page.el('screen-start').hidden, false);
        assert.equal(page.el('workspace').hidden, true);
        page.el('choose-sample').click();
        assert.equal(page.el('screen-result').hidden, false, 'the sample still opens');
        assert.equal(page.el('scene-area').children.length > 0, true, 'the 3D view is still drawn');
        assert.match(page.el('intake-script-status').textContent, /finished setting up/);
      });
    } finally { delete globalThis.__breakWorkspace; }
  }
});
