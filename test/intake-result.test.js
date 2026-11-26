// Intake Task 12 (this batch): the "Review and run" screen and the result screen for a visitor's own project.
//
// These tests run the REAL docs/viewer.js and docs/intake/screens.js, review-screen.js, result-screen.js,
// summary-view.js and run-data.js, with the real state.js, build-brain.js, report.js, the real engine copies in
// docs/engine/ and the real Three.js maths, on the stand-in page built from the REAL docs/index.html (test-helpers/).
// The stand-in draws nothing, so the tests look at the blocks handed to Three.js and at the page text.
// What this CANNOT show: how anything looks, 320 px layout, real image previews, real keyboard or screen reader
// behaviour, WebGL. Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from '../test-helpers/register-hooks.js';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc, readStyles } from '../test-helpers/fake-page.js';
import { buildScene as buildAllScene, shapeParts, filterByLayers, DEFAULT_LAYERS } from '../docs/scene-data.js';
// look-and-feel: lights and rugs are on layers that start switched off, so the page draws only the boxes of the default layers.
const buildScene = (run, version) => filterByLayers(buildAllScene(run, version), DEFAULT_LAYERS);
import { FIXED_SENTENCE } from '../docs/intake/report.js';
import { summaryNodes, bodyOf } from '../docs/intake/summary-view.js';
import { buildRunLayout, VIEWER_NUMBERS } from '../docs/intake/run-data.js';
import * as stateApi from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { makeSummaryHtml } from '../docs/engine/summary/make-summary.js';

installImportHooks();
// Test-only switches, so a failing agent or a broken summary can be planted without touching the page code.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('./build-brain.js?v=')) return { url: new URL('../test-helpers/build-brain-shim.js', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('../engine/summary/make-summary.js?v=')) return { url: new URL('../test-helpers/make-summary-shim.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const html = readDoc('index.html');
const css = readStyles();
const sample = JSON.parse(readDoc('sample-run.json'));
const SAMPLE_LAST = sample.versions.length;
const HOSTILE = '<img src=x onerror=alert(1)>';
let caseNumber = 30000;

// Stand-in for the browser's preview addresses: records what was made and released.
function stubPreviewAddresses() {
  const created = [];
  const revoked = [];
  const real = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let n = 0;
  URL.createObjectURL = (file) => { n += 1; const url = `blob:test/${n}`; created.push({ url, file }); return url; };
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  return { created, revoked, restore() { URL.createObjectURL = real.create; URL.revokeObjectURL = real.revoke; } };
}

async function openAll({ withViewer = true } = {}) {
  const page = createFakePage();
  const restore = installFakePage(page);
  const urls = stubPreviewAddresses();
  page.el('heading-result').textContent = 'Sample two-storey home'; // the stand-in does not read the heading's text from index.html
  globalThis.confirm = () => true;
  caseNumber += 1;
  if (withViewer) {
    await import(`../docs/viewer.js?case=result-${caseNumber}`);
    await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the viewer script to finish');
  }
  await import(`../docs/intake/screens.js?case=result-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
  return {
    page, urls,
    restore: () => {
      delete globalThis.confirm; delete globalThis.designForYouViewer; delete globalThis.__agentsOverride; delete globalThis.__summaryMode;
      urls.restore(); restore();
    },
  };
}
async function withAll(options, body) {
  const opened = await openAll(options);
  try { await body(opened.page, opened.urls); } finally { opened.restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const textOf = (node) => node.textContent;
const buttonNamed = (node, text) => {
  const found = walk(node).find((b) => b.tagName === 'BUTTON' && b.textContent === text);
  assert.ok(found, `a button called "${text}" exists`);
  return found;
};
function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
const roomId = (select, name) => {
  const option = walk(select).find((n) => n.tagName === 'OPTION' && n.textContent === name);
  assert.ok(option, `the choice "${name}" is offered`);
  return option.value;
};

// Fill the screens the way a visitor does. Returns the page.
function fillBasics(page, { name = 'My home', rooms = ['Kitchen', 'Bedroom'], floor = 'Ground floor' } = {}) {
  page.el('choose-own').click();
  page.el('project-name').value = name;
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = floor;
  page.el('add-floor').click();
  for (const room of rooms) { page.el('room-name').value = room; page.el('add-room').click(); }
}
function fillInputs(page, { note = 'linen', caption = '', brief = 'A calm home.', itemText = 'Oak floor', tag = 'warm oak', overrideNote = 'cold steel', images = 2, otherRoom = 'Kitchen' } = {}) {
  gotoStep(page, 'inspiration');
  page.el('note-text').value = note;
  page.el('add-note').click();
  const files = Array.from({ length: images }, (_, i) => ({ name: `photo-${i + 1}.png`, type: 'image/png', size: 2000 }));
  page.el('image-file').files = files;
  page.el('image-file').dispatch('change');
  if (caption) {
    const box = walk(page.el('image-list')).find((n) => n.tagName === 'INPUT' && n.id.startsWith('caption-image-'));
    box.value = caption;
    box.dispatch('change');
  }
  gotoStep(page, 'overrides');
  page.el('override-room').value = roomId(page.el('override-room'), 'Bedroom');
  page.el('override-room').dispatch('change');
  page.el('override-note-text').value = overrideNote;
  page.el('add-override-note').click();
  gotoStep(page, 'brief');
  page.el('brief-text').value = brief;
  page.el('brief-text').dispatch('input');
  gotoStep(page, 'taste');
  const radio = walk(page.el('taste-questions')).find((n) => n.id === 'taste-light-light');
  radio.checked = true;
  radio.dispatch('change');
  gotoStep(page, 'items');
  page.el('item-text').value = itemText;
  page.el('item-room').value = roomId(page.el('item-room'), 'Bedroom');
  page.el('item-status-locked').checked = true;
  page.el('item-tag').value = tag;
  page.el('add-item').click();
  page.el('item-text').value = 'Curtains';
  page.el('item-room').value = roomId(page.el('item-room'), otherRoom);
  page.el('item-status-unsure').checked = true;
  page.el('add-item').click();
}
function goBackTo(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('back-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `went back to ${id}`);
}
async function runIt(page) {
  gotoStep(page, 'review');
  page.el('run-design-team').click();
  await waitFor(() => page.el('screen-result').hidden === false || page.el('run-failure').hidden === false, 'the run to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
}

const drawnKeys = (page) => page.scene.children.find((c) => c.type === 'Group').children
  .filter((o) => o.userData && o.userData.boxKey).map((o) => o.userData.boxKey).sort();
// D6: one key per drawn mesh. The design-team sample's typed furniture is drawn as several parts, each with the box's key.
const sampleKeys = () => buildScene(sample, SAMPLE_LAST).flatMap((b) => Array(Math.max(1, shapeParts(b).length)).fill(b.key)).sort();
const labelsOf = (page, cls) => page.document.querySelectorAll(cls);

// ---- Review and run screen ---------------------------------------------------------------------

test('Task 12: the run button is disabled with a plain reason until there is a name, a floor and a room', async () => {
  await withAll({}, async (page) => {
    page.el('choose-own').click();
    gotoStep(page, 'review');
    const button = page.el('run-design-team');
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, 'Run the design team', 'a visible text label');
    assert.equal(button.getAttribute('type'), 'button');
    assert.ok(button.getAttribute('aria-describedby').split(' ').includes('run-reason'), 'the reason is tied to the button');
    assert.equal(page.el('run-reason').textContent, 'Still needed before you can run the design team: a project name, a floor and a room. Use Back to add it.');
    button.click(); // a disabled button does nothing
    assert.equal(page.el('screen-result').hidden, true);
    goBackTo(page, 'setup');
    page.el('project-name').value = 'My home';
    page.el('project-name').dispatch('change');
    gotoStep(page, 'review');
    assert.equal(page.el('run-reason').textContent, 'Still needed before you can run the design team: a floor and a room. Use Back to add it.');
    goBackTo(page, 'setup');
    page.el('floor-name').value = 'Ground floor';
    page.el('add-floor').click();
    gotoStep(page, 'review');
    assert.equal(page.el('run-reason').textContent, 'Still needed before you can run the design team: a room. Use Back to add it.');
    assert.equal(page.el('run-design-team').disabled, true);
    goBackTo(page, 'setup');
    page.el('room-name').value = 'Kitchen';
    page.el('add-room').click();
    gotoStep(page, 'review');
    assert.equal(page.el('run-design-team').disabled, false);
    assert.match(page.el('run-reason').textContent, /^You can run the design team now\. Nothing is sent anywhere/);
  });
});

test('Task 12: the review lists name, floors and rooms, images, notes, brief, style profile and items with status, in plain words', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    fillInputs(page);
    gotoStep(page, 'review');
    const lines = page.el('review-list').children.map(textOf);
    assert.ok(lines.includes('Project name: My home'));
    assert.ok(lines.includes('Floor Ground floor: Kitchen (4 m by 4 m), Bedroom (4 m by 4 m)'));
    assert.ok(lines.includes('Images: 2. They stay in this browser and are not uploaded.'));
    assert.ok(lines.includes('Notes: 2'), lines.join(' | '));
    assert.ok(lines.includes('Brief: written, 12 characters. It is kept with your project. The design team does not read it.'));
    assert.ok(lines.some((l) => l.startsWith('Style profile: You like light rooms.')));
    assert.ok(lines.includes('Items: 2'));
    assert.ok(lines.includes('Item: Oak floor, Bedroom, Locked, warm oak'));
    assert.ok(lines.includes('Item: Curtains, Kitchen, Unsure'));
    assert.match(readDoc('index.html'), /id="review-intro">[^<]*Nothing is sent anywhere when you press it\. Your images stay in this browser and are not uploaded\./);
    for (const line of lines) assert.doesNotMatch(line, /\b(item|floor|room)-\d+\b|gatekeeper|\bkind\b/, `no internal words: ${line}`);
  });
});

test('Task 12: a floor with no room keeps the button disabled and the reason names that floor', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    goBackTo(page, 'setup');
    page.el('floor-name').value = 'Attic';
    page.el('add-floor').click();
    gotoStep(page, 'review');
    assert.equal(page.el('run-design-team').disabled, true);
    assert.equal(page.el('run-reason').textContent, 'Still needed before you can run the design team: a room on the floor Attic. Use Back to add it.');
  });
});

// ---- Running, and the result for a visitor's own project ---------------------------------------

test('Task 12: pressing the button runs the design team and shows YOUR PROJECT with the draft statement, never SAMPLE PROJECT, and makes no network call', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    fillInputs(page);
    const fetchesBefore = page.log.filter((l) => l.startsWith('fetch:')).length;
    await runIt(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('screen-review').hidden, true);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
    assert.equal(page.log.filter((l) => l.startsWith('fetch:')).length, fetchesBefore, 'the button made no network call');
    assert.equal(page.document.body.dataset.run, 'own');
    assert.equal(page.document.body.dataset.screen, 'result');
    // Labels: YOUR PROJECT shown, SAMPLE PROJECT hidden, in both bars; the draft statement is in both bars always.
    const own = labelsOf(page, '.label-own');
    const sampleLabels = labelsOf(page, '.label-sample');
    assert.equal(own.length, 2);
    assert.equal(sampleLabels.length, 2);
    assert.ok(own.every((p) => p.hidden === false && p.textContent === 'YOUR PROJECT'));
    assert.ok(sampleLabels.every((p) => p.hidden === true), 'SAMPLE PROJECT is hidden for a visitor\'s own project');
    for (const tag of ['header', 'footer']) {
      assert.ok(html.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`))[0].includes('Plans are drafts for professional review. They are not verified engineering.'));
    }
    assert.match(css, /body\[data-run="own"\] \.label-sample \{ display: none; \}/);
    assert.match(css, /body\[data-screen="result"\]\[data-run="own"\] \.label-own \{ display: block; \}/);
    assert.equal(page.el('heading-result').textContent, 'YOUR PROJECT: My home');
    assert.equal(page.document.activeElement, page.el('heading-result'), 'the keyboard focus moved to the heading');
    assert.equal(page.document.title, 'Result - DesignForYou');
    assert.equal(page.el('own-result').hidden, false);
    // Nothing visible on the result screen says SAMPLE PROJECT or the sample's name.
    const visible = walk(page.el('screen-result')).filter((n) => !n.hidden).map(textOf).join(' ');
    assert.doesNotMatch(visible, /SAMPLE PROJECT|Sample two-storey home/);
  });
});

test('Task 12: the 3D viewer shows the visitor\'s data, not the sample', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    fillInputs(page);
    await runIt(page);
    const keys = drawnKeys(page);
    assert.notDeepEqual(keys, sampleKeys());
    const roomLabels = page.labels().map(textOf);
    assert.ok(roomLabels.includes('Kitchen') && roomLabels.includes('Bedroom'), roomLabels.join(' | '));
    assert.ok(!roomLabels.includes('Living Room'));
    assert.equal(page.el('scene-area').getAttribute('aria-label'), '3D view of your project');
    // The Locked "warm oak" item in the Bedroom clashes with the room note "cold steel".
    assert.equal(page.el('clash-list').children.length, 1);
    assert.match(page.el('clash-list').textContent, /cold steel/);
    assert.equal(page.el('col-side').hidden, false);
    assert.equal(page.el('own-viewer-note').hidden, true);
    assert.equal(page.el('floor-upper').hidden, true, 'one floor: no second floor button');
    assert.equal(page.el('floor-ground').textContent, 'Ground floor');
  });
});

test('Task 12: the result has the summary, the style profile with the mood board of the visitor\'s images, the report and the fixed sentence', async () => {
  await withAll({}, async (page, urls) => {
    fillBasics(page);
    fillInputs(page, { caption: 'Sunny window' });
    await runIt(page);
    // Summary.
    const summary = page.el('own-summary');
    const summaryText = textOf(summary);
    assert.ok(summary.children.length > 5);
    for (const heading of ['Project structure', 'Items, with status and owner', 'Run log', 'Clash report', 'Version history']) {
      assert.ok(walk(summary).some((n) => n.tagName === 'H3' && n.textContent === heading), `summary has "${heading}"`);
    }
    assert.ok(!walk(summary).some((n) => n.tagName === 'H1'), 'one h1 per screen');
    assert.ok(summaryText.includes('My home: summary') && summaryText.includes('Oak floor') && summaryText.includes('Locked'));
    assert.ok(!summaryText.includes('SAMPLE PROJECT'));
    assert.ok(summaryText.includes('Plans are drafts for professional review. They are not verified engineering.'));
    const cells = walk(summary).filter((n) => n.tagName === 'TD');
    assert.ok(cells.length > 0 && cells.every((c) => c.getAttribute('data-label')), 'each table cell carries its column heading for narrow screens');
    // Brief and image count.
    assert.equal(page.el('own-brief').textContent, 'A calm home.');
    assert.equal(page.el('own-images-count').textContent, 'You added 2 images. They stay in this page and are not uploaded.');
    // Style profile and mood board.
    assert.deepEqual(page.el('own-profile-sentences').children.map(textOf), ['You like light rooms.', 'In short: light.']);
    assert.deepEqual(page.el('own-profile-tags').children.map(textOf), ['light']);
    assert.equal(page.el('own-profile-message').hidden, true);
    const board = page.el('own-mood-board').children;
    assert.equal(board.length, 2);
    const pictures = board.map((li) => li.children.find((c) => c.tagName === 'IMG'));
    assert.deepEqual(pictures.map((p) => p.src), urls.created.map((c) => c.url), 'previews only: the temporary browser addresses');
    assert.ok(pictures.every((p) => p.src.startsWith('blob:')));
    assert.deepEqual(pictures.map((p) => p.alt), ['Sunny window', 'Inspiration image 2'], 'caption, or "Inspiration image" and its number');
    assert.deepEqual(board.map((li) => li.children.find((c) => c.tagName === 'SPAN').textContent), ['Sunny window', 'Inspiration image 2'], 'each image has its text description');
    assert.equal(page.el('own-mood-empty').hidden, true);
    // The report.
    assert.match(html, /<h2 id="own-report-heading">What the design team did with your input<\/h2>/);
    const headings = page.el('own-report').children.filter((c) => c.tagName === 'H3').map(textOf);
    assert.deepEqual(headings, ['Used', 'Kept but not read', 'Nothing to do this time']);
    const [used, kept, nothing] = page.el('own-report').children.filter((c) => c.tagName === 'UL').map((u) => u.children.map(textOf));
    assert.ok(used.some((l) => l.includes('warm oak and cold steel')));
    assert.ok(kept.includes('Your brief. It is kept with your project and was not read.'));
    assert.ok(kept.includes('Your 2 images. They stay in this page, are never uploaded, and were not looked at.'));
    assert.ok(!used.some((l) => /brief|image/i.test(l)), 'the brief and the images are never listed as used');
    assert.ok(nothing.includes('Layout and Builder had nothing to place, because no furniture, doors or windows were entered.'));
    // The fixed sentence, exactly.
    assert.equal(page.el('result-fixed-rules').textContent, 'The design team is a set of fixed rules, not AI. It does not look at your images or read your brief.');
    assert.equal(page.el('result-fixed-rules').textContent, FIXED_SENTENCE);
    assert.match(html, /id="own-text-alternative"[^>]*>The 3D view has a text alternative: the summary and the clash list on this page hold the same information\./);
    // No word in the report claims AI, understanding, design or analysis.
    const reportText = textOf(page.el('own-report'));
    assert.doesNotMatch(reportText, /\b(analys\w*|understood|understand|AI-powered|designed|smart)\b/i);
  });
});

test('Task 12: a style profile that is empty says so, and no images shows no mood board', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    gotoStep(page, 'review');
    page.el('run-design-team').click();
    await waitFor(() => page.el('screen-result').hidden === false, 'the result');
    assert.equal(page.el('own-profile-message').textContent, 'No style profile yet');
    assert.equal(page.el('own-profile-message').hidden, false);
    assert.equal(page.el('own-mood-empty').hidden, false);
    assert.equal(page.el('own-mood-board').children.length, 0);
    assert.equal(page.el('own-brief').textContent, 'You wrote no brief.');
    assert.equal(page.el('own-images-count').textContent, 'You added no images.');
    assert.equal(page.el('clash-summary').textContent, 'No clashes found');
    assert.match(textOf(page.el('own-report-clash')), /This does not mean there are no problems/);
  });
});

test('Task 12: text a visitor typed, such as an image tag with an onerror, is shown as plain text everywhere, summary included', async () => {
  await withAll({}, async (page) => {
    fillBasics(page, { name: HOSTILE, rooms: [HOSTILE.replace('x', 'y'), 'Bedroom'], floor: HOSTILE.replace('x', 'f') });
    fillInputs(page, { note: HOSTILE, caption: HOSTILE, brief: HOSTILE, itemText: HOSTILE, tag: HOSTILE.slice(0, 40), overrideNote: HOSTILE.replace('x', 'n'), otherRoom: HOSTILE.replace('x', 'y') });
    await runIt(page);
    assert.equal(page.el('run-failure-text').textContent, '');
    assert.equal(page.el('screen-result').hidden, false);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
    const everything = [...walk(page.el('screen-result')), ...walk(page.el('screen-review'))];
    const allowed = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'UL', 'LI', 'STRONG', 'TABLE', 'TR', 'TH', 'TD', 'SPAN', 'BUTTON', 'IMG', 'LABEL', 'INPUT', 'SELECT', 'SECTION', 'OUTPUT', '#TEXT', 'CANVAS']);
    for (const node of everything) {
      assert.ok(allowed.has(node.tagName), `unexpected element <${node.tagName}>`);
      assert.ok(!Object.keys(node.attributes).some((a) => a.toLowerCase().startsWith('on')), 'no event-handler attribute');
      if (node.tagName === 'IMG') assert.ok(String(node.src).startsWith('blob:'), 'the only pictures are the visitor\'s previews');
      assert.ok(node.tagName !== 'SCRIPT' && node.tagName !== 'IFRAME');
    }
    // The hostile text is there, as text, in the summary, the heading, the profile area, the brief, the report and the viewer.
    assert.ok(textOf(page.el('own-summary')).includes(HOSTILE), 'summary: the project name as typed');
    assert.ok(textOf(page.el('own-summary')).includes(HOSTILE.replace('x', 'f')), 'summary: the floor name as typed');
    assert.ok(textOf(page.el('own-summary')).includes(HOSTILE.replace('x', 'n')), 'summary: the room note as typed');
    assert.equal(page.el('own-brief').textContent, HOSTILE);
    assert.equal(page.el('heading-result').textContent, `YOUR PROJECT: ${HOSTILE}`);
    const [first, second] = page.el('own-mood-board').children;
    assert.ok(first.children.some((c) => c.textContent === HOSTILE), 'the caption is shown as typed');
    assert.equal(first.children.find((c) => c.tagName === 'IMG').alt, HOSTILE);
    assert.equal(second.children.find((c) => c.tagName === 'IMG').alt, 'Inspiration image 2');
    assert.ok(page.labels().map(textOf).some((t) => t.includes('<img')), 'the viewer shows room names as text');
  });
});

test('Task 12: a summary that would insert raw text is refused: nothing is shown as page code, and the red message names the step', async () => {
  await withAll({}, async (page) => {
    globalThis.__summaryMode = 'unescaped';
    fillBasics(page, { name: HOSTILE });
    fillInputs(page);
    await runIt(page);
    assert.equal(page.el('screen-result').hidden, false, 'the other parts of the result still appear');
    assert.ok(!walk(page.el('screen-result')).some((n) => n.tagName === 'IMG' && !String(n.src).startsWith('blob:')), 'no picture made from the typed text');
    assert.match(textOf(page.el('own-summary')), /The summary could not be shown\./);
    assert.equal(page.el('intake-error-message').hidden, false);
    assert.match(textOf(page.el('intake-error-message')), /Step "Result: summary" failed/);
    // A broken summary never stops the others.
    assert.equal(page.el('own-mood-board').children.length, 2);
    assert.equal(page.el('own-report').children.length, 6);
    assert.equal(page.el('result-fixed-rules').textContent, FIXED_SENTENCE);
    assert.equal(page.el('clash-list').children.length, 1, 'the viewer still shows the project');
  });
});

// ---- A failed run -------------------------------------------------------------------------------

test('Task 12: if an agent fails, the screen names it, keeps the inputs and offers Back; fixing it and running again works', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    fillInputs(page);
    globalThis.__agentsOverride = { Layout: () => { throw new Error('the layout broke'); } };
    await runIt(page);
    assert.equal(page.el('screen-result').hidden, true, 'no result is shown');
    assert.equal(page.el('screen-review').hidden, false, 'the visitor stays on the review screen');
    assert.equal(page.el('run-failure').hidden, false);
    assert.equal(page.el('run-failure-text').textContent, 'The design team stopped at the Layout agent. Reason: the layout broke');
    assert.equal(page.document.activeElement, page.el('run-failure'), 'focus moves to the message');
    assert.equal(page.el('run-failure').getAttribute('role'), 'alert');
    assert.match(readDoc('index.html'), /id="run-failure-kept">Everything you entered is still here\. Use Back to change it, then run the design team again\./);
    assert.equal(page.el('run-design-team').disabled, false, 'it can be tried again');
    // Inputs are kept.
    const lines = page.el('review-list').children.map(textOf);
    assert.ok(lines.includes('Project name: My home'));
    assert.ok(lines.includes('Item: Oak floor, Bedroom, Locked, warm oak'));
    assert.ok(lines.includes('Images: 2. They stay in this browser and are not uploaded.'));
    assert.equal(page.el('project-name').value, 'My home');
    assert.equal(page.el('brief-text').value, 'A calm home.');
    assert.equal(page.el('image-list').children.length, 2);
    // The Back button is there and works.
    const back = page.el('back-button');
    assert.equal(page.el('step-nav').hidden, false);
    assert.equal(back.hidden, false);
    assert.equal(back.textContent, 'Back');
    back.click();
    assert.equal(page.el('screen-place').hidden, false, 'Back from the review goes to the new step first');
    back.click();
    assert.equal(page.el('screen-items').hidden, false);
    assert.equal(page.el('item-list').children.length, 2, 'the items are still there');
    // Fix (the broken agent is gone) and run again.
    delete globalThis.__agentsOverride;
    await runIt(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('run-failure').hidden, true);
  });
});

test('Task 12: a failure of the first agent is named too, and the failure message is gone when the screen is shown again', async () => {
  await withAll({}, async (page) => {
    fillBasics(page);
    globalThis.__agentsOverride = { Style: () => { throw new Error('style broke'); } };
    await runIt(page);
    assert.equal(page.el('run-failure-text').textContent, 'The design team stopped at the Style agent. Reason: style broke');
    page.el('back-button').click();
    page.el('next-button').click();
    assert.equal(page.el('run-failure').hidden, true);
  });
});

// ---- Start again, the sample, and a missing viewer -----------------------------------------------

test('Task 12: "Start again" clears the result, the mood board and the previews, and the viewer shows the sample again', async () => {
  await withAll({}, async (page, urls) => {
    const sampleClashText = textOf(page.el('clash-list'));
    fillBasics(page);
    fillInputs(page);
    await runIt(page);
    assert.notEqual(textOf(page.el('clash-list')), sampleClashText);
    assert.equal(urls.revoked.length, 0);
    page.el('result-start-again').click();
    assert.equal(page.el('screen-start').hidden, false);
    assert.equal(page.el('own-result').hidden, true);
    assert.equal(page.el('own-mood-board').children.length, 0);
    assert.equal(page.el('own-summary').children.length, 0);
    assert.equal(page.el('own-brief').textContent, '');
    assert.equal(page.el('own-report').children.length, 0);
    assert.equal(urls.revoked.length, 2, 'both previews were released');
    assert.deepEqual([...urls.revoked].sort(), urls.created.map((c) => c.url).sort());
    assert.equal(page.document.body.dataset.run, 'sample');
    assert.ok(labelsOf(page, '.label-sample').every((p) => p.hidden === false));
    assert.ok(labelsOf(page, '.label-own').every((p) => p.hidden === true));
    assert.equal(page.el('heading-result').textContent, 'Sample two-storey home');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(drawnKeys(page), sampleKeys(), 'the visitor\'s project is gone from the viewer');
    assert.equal(textOf(page.el('clash-list')), sampleClashText, 'the clash list is the sample\'s again');
    assert.ok(!textOf(page.el('caption')).includes('My home'));
    // The inputs are gone.
    page.el('choose-own').click();
    assert.equal(page.el('project-name').value, '');
  });
});

test('Task 12: "Try the sample" works as before (labels, heading, same drawing, no new fetch), also after an own project', async () => {
  await withAll({}, async (page) => {
    const first = drawnKeys(page);
    const fetches = page.log.filter((l) => l.startsWith('fetch:')).length;
    page.el('choose-sample').click();
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('own-result').hidden, true, 'the own-project parts stay hidden on the sample');
    assert.equal(page.el('heading-result').textContent, 'Sample two-storey home');
    assert.ok(labelsOf(page, '.label-sample').every((p) => p.hidden === false && p.textContent === 'SAMPLE PROJECT'));
    assert.ok(labelsOf(page, '.label-own').every((p) => p.hidden === true));
    assert.equal(page.document.body.dataset.screen, 'result');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(drawnKeys(page), first);
    assert.equal(page.log.filter((l) => l.startsWith('fetch:')).length, fetches);
    // Now an own project, then back to the sample.
    page.el('result-back').click();
    fillBasics(page);
    await runIt(page);
    assert.notDeepEqual(drawnKeys(page), sampleKeys());
    page.el('result-back').click();
    page.el('choose-sample').click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(drawnKeys(page), sampleKeys(), 'the sample is drawn again, unchanged');
    assert.equal(page.el('heading-result').textContent, 'Sample two-storey home');
    assert.ok(labelsOf(page, '.label-sample').every((p) => p.hidden === false));
    assert.equal(page.el('col-side').hidden, false);
    assert.equal(page.el('own-result').hidden, true);
    assert.equal(page.log.filter((l) => l.startsWith('fetch:')).length, fetches, 'the sample file is not fetched again');
  });
});

test('Task 12: if the viewer did not load, the result still shows the summary and the rest, and hides the empty 3D parts', async () => {
  await withAll({ withViewer: false }, async (page) => {
    fillBasics(page);
    fillInputs(page);
    await runIt(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('own-viewer-note').hidden, false);
    assert.equal(page.el('own-viewer-note').textContent, 'The 3D view could not be shown. The summary below has the same information.');
    assert.equal(page.el('scene-area').hidden, true);
    assert.equal(page.el('col-side').hidden, true);
    assert.ok(page.el('own-summary').children.length > 5);
    assert.equal(page.el('result-fixed-rules').textContent, FIXED_SENTENCE);
    assert.ok(labelsOf(page, '.label-sample').every((p) => p.hidden === true), 'still no SAMPLE PROJECT');
  });
});

test('Task 12: a summary that fails shows the red message with the step name, and the other parts of the result still appear', async () => {
  await withAll({}, async (page) => {
    globalThis.__summaryMode = 'throws';
    fillBasics(page);
    await runIt(page);
    assert.equal(page.el('screen-result').hidden, false);
    assert.equal(page.el('intake-error-message').hidden, false);
    assert.match(textOf(page.el('intake-error-message')), /Result: summary/);
    assert.equal(page.el('own-report').children.length, 6, 'the other parts still appear');
  });
});

// ---- The pure parts ------------------------------------------------------------------------------

test('Task 12: the 3D layout numbers equal the sample\'s file, room sizes come from the form, and odd room names are only names', () => {
  const file = JSON.parse(readFileSync(new URL('../src/viewer/viewer-layout.json', import.meta.url), 'utf8'));
  const { rooms, notes, ...numbers } = file;
  assert.ok(notes && rooms);
  const state = stateApi.createState();
  const floor = stateApi.addFloor(state, 'Ground');
  stateApi.addRoom(state, floor.id, 'Hall', 3, 2.5);
  stateApi.addRoom(state, floor.id, 'constructor');
  stateApi.addRoom(state, floor.id, 'toString', '', '');
  const layout = buildRunLayout(state);
  const { rooms: ownRooms, ...ownNumbers } = layout;
  assert.deepEqual(JSON.parse(JSON.stringify(ownNumbers)), numbers, 'the same fixed numbers as src/viewer/viewer-layout.json');
  assert.deepEqual(JSON.parse(JSON.stringify(VIEWER_NUMBERS)), numbers);
  assert.deepEqual({ ...ownRooms.Hall }, { width: 3, depth: 2.5 });
  assert.deepEqual({ ...ownRooms.constructor }, { width: 4, depth: 4 }, 'default 4 by 4');
  assert.deepEqual({ ...ownRooms.toString }, { width: 4, depth: 4 });
  assert.equal(Object.getPrototypeOf(ownRooms), null);
});

test('Task 12: the summary reader accepts the real summary, decodes plain text, and refuses tags, attributes and stray text that are not allowed', () => {
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    const doc = page.document;
    const wrap = (inner) => `<!DOCTYPE html>\n<html><head><title>t</title></head>\n<body>\n${inner}\n</body>\n</html>\n`;
    const nodes = summaryNodes(wrap('<h1>A &amp; B &lt;b&gt; &quot;q&quot;: summary</h1>\n<p class="statement">Plans</p>'), doc);
    assert.equal(nodes[0].tagName, 'H2', 'the summary title is one level lower');
    assert.equal(nodes[0].textContent, 'A & B <b> "q": summary');
    assert.equal(nodes[1].className, 'summary-statement');
    assert.equal(summaryNodes(wrap('<p>one &amp;lt; two</p>'), doc)[0].textContent, 'one &lt; two', 'decoded once, never twice');
    for (const bad of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '<p onclick="x()">a</p>', '<p class="evil">a</p>', '<p>a</p><p>', '<p>a</b>', 'loose text', '<p>a < b</p>', '<a href="x">y</a>']) {
      assert.throws(() => summaryNodes(wrap(bad), doc), /summary/i, `refused: ${bad}`);
    }
    assert.throws(() => bodyOf('<html>no body</html>'), /expected form/);
  } finally { restore(); }
});

test('Task 12: the new files make no network, storage or cookie calls, read no file contents and set no HTML', () => {
  for (const name of ['intake/review-screen.js', 'intake/result-screen.js', 'intake/summary-view.js', 'intake/run-data.js']) {
    const src = readDoc(name);
    assert.doesNotMatch(src, /\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|FileReader|\.arrayBuffer|\.text\(\)|innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\b|new Function|https?:\/\//, name);
  }
  const viewer = readDoc('viewer.js');
  assert.equal((viewer.match(/\bfetch\(/g) || []).length, 1, 'viewer.js still fetches exactly one thing, the sample file');
  assert.doesNotMatch(viewer, /innerHTML|localStorage|sessionStorage|document\.cookie/);
});

test('Task 12: summaryNodes accepts the real summary of a finished visitor project', () => {
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    const state = stateApi.createState();
    stateApi.setProjectName(state, 'Test home');
    stateApi.addRoom(state, stateApi.addFloor(state, 'Ground').id, 'Kitchen');
    const run = runDesignTeam(state);
    assert.equal(run.ok, true);
    const nodes = summaryNodes(makeSummaryHtml(run.project), page.document);
    const texts = nodes.filter((n) => n.tagName === 'H3').map(textOf);
    assert.deepEqual(texts, ['Project structure', 'Items, with status and owner', 'Run log', 'Clash report', 'Version history']);
  } finally { restore(); }
});

// ---- Sizes and keyboard (what a test can check; how it feels on a phone is a pending owner check) ----

test('Task 12: the new styles keep text at 16 px or more and controls at 44 px, nothing has a positive tab order, and new screens have no placeholder', () => {
  const fresh = css.slice(css.indexOf('/* ---- Items screen (build-intake-3) ---- */'));
  assert.ok(fresh.length > 500);
  for (const m of fresh.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)) {
    const px = m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16;
    assert.ok(px >= 16, `font-size ${m[0]} is under 16 px`);
  }
  // Buttons and choices: the shared rules give at least 2.75rem (44 px).
  assert.match(css, /\.choice-button, \.nav-button, \.action-button \{[^}]*min-height: 2\.75rem;[^}]*min-width: 2\.75rem;/);
  assert.match(css, /\.text-input \{[^}]*min-height: 2\.75rem;/);
  assert.match(css, /\.choice-label \{[^}]*min-height: 2\.75rem;/);
  for (const id of ['run-design-team', 'result-start-again']) {
    assert.match(html, new RegExp(`id="${id}" class="[^"]*(action-button|nav-button)`), `${id} uses a shared button style`);
  }
  assert.doesNotMatch(html, /tabindex="[1-9]/);
  assert.doesNotMatch(html, /placeholder=/);
  // On a narrow screen the summary tables stack instead of scrolling sideways.
  assert.match(css, /@media \(max-width: 40rem\) \{[^@]*\.summary-view table[^@]*display: block/);
  assert.doesNotMatch(fresh, /overflow-x:\s*(scroll|auto)/);
});
