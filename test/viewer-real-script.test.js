// Fix-viewer-1: tests that run the REAL docs/viewer.js against the REAL docs/index.html
// structure, with the real scene-data.js, the real Three.js maths and the real OrbitControls.
//
// What stands in for the browser (see test-helpers/): a small fake page built from index.html
// (ids, classes, attributes, event listeners), a fake canvas, and a renderer that draws nothing.
// What this CANNOT show: how the page looks, whether the CSS puts the panels in a right-hand
// column, whether labels are readable or on screen, real mouse and touch behaviour, WebGL,
// browser caching, or the browser's own content-security rule. Those need a real browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { buildScene, describeItem } from '../docs/scene-data.js';

installImportHooks();

const run = JSON.parse(readDoc('sample-run.json'));
const LAST = run.versions.length;
const html = readDoc('index.html');
const js = readDoc('viewer.js');
const css = readDoc('styles.css');

let caseNumber = 0;

// Start the real page script on a fake page and wait until it says it has finished (or the
// given condition holds). Returns the page and a function that puts the globals back.
async function openPage(configure = () => {}, until) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  caseNumber += 1;
  await import(`../docs/viewer.js?case=${caseNumber}`);
  await waitFor(until ? () => until(page) : () => page.el('script-status').textContent.includes('finished'), 'the page script to finish');
  await new Promise((resolve) => setTimeout(resolve, 20)); // let the first resize report arrive
  return { page, restore };
}

async function withPage(configure, body, until) {
  const { page, restore } = await openPage(configure, until);
  try { await body(page); } finally { restore(); }
}

// Where on the 3D area (900 x 600) a point in the scene appears, using the page's own camera.
function pixelOf(page, point) {
  const camera = page.controls.object;
  camera.updateMatrixWorld();
  const v = point.clone().project(camera);
  return { clientX: (v.x * 0.5 + 0.5) * 900, clientY: (-v.y * 0.5 + 0.5) * 600 };
}

function click(page, at) {
  const canvas = page.canvas;
  canvas.dispatch('pointerdown', { ...at, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
  canvas.dispatch('pointerup', { ...at, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
}

async function centreOf(page, itemName) {
  const THREE = await import('three');
  const b = buildScene(run, LAST).find((box) => box.itemId !== undefined && box.label === itemName);
  assert.ok(b, `no block called ${itemName}`);
  return new THREE.Vector3(b.x + b.width / 2, b.y + b.height / 2, b.z + b.depth / 2);
}

const detailsText = (page) => page.el('details-text').textContent;
// The window is used for click tests: the Garden door and the Sofa overlap by design, so a click there is ambiguous.
const furniture = () => buildScene(run, LAST).find((b) => b.type === 'window');

// ---- 1. Ids, classes and script order, read from the real files -----------------------------

test('fix-viewer-1: every element id and class the page script uses exists in index.html', () => {
  const ids = new Set([...js.matchAll(/\bel\('([^']+)'\)/g)].map((m) => m[1]));
  for (const m of js.matchAll(/getElementById\('([^']+)'\)/g)) ids.add(m[1]);
  assert.ok(ids.size >= 8, 'expected the script to use several ids');
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `index.html has no id="${id}"`);
  const classes = [...js.matchAll(/querySelectorAll\('\.([\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(classes.length >= 1);
  for (const c of classes) assert.match(html, new RegExp(`class="[^"]*\\b${c}\\b`), `index.html has no class "${c}"`);
  // No two elements share an id.
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(all).size, all.length, 'an id is used twice');
});

test('fix-viewer-1: script load order: import map first, then the page script, both after the page elements', () => {
  const importMap = html.indexOf('type="importmap"');
  const pageScript = html.indexOf('type="module" src="viewer.js');
  assert.ok(importMap > 0 && pageScript > importMap, 'the import map must come before the page script');
  for (const id of ['scene-area', 'floor-all', 'reset-view', 'version-slider', 'details-text', 'error-message', 'script-status']) {
    assert.ok(html.indexOf(`id="${id}"`) < pageScript, `${id} must be in the page before the script tag`);
  }
  assert.ok(html.indexOf('<link rel="stylesheet" href="styles.css') < html.indexOf('</head>'));
  // The page script has no import line at the top: a failing helper file is caught and shown, not silent.
  assert.doesNotMatch(js, /^import /m);
  assert.match(js, /await import\(SCENE_DATA_FILE\)/);
});

test('fix-viewer-1: the red message box is above the scrolling page, outside the two columns', () => {
  assert.ok(html.indexOf('</header>') < html.indexOf('id="error-message"'));
  assert.ok(html.indexOf('id="error-message"') < html.indexOf('<main'));
  assert.match(html, /<div id="error-message" role="alert" hidden><\/div>/);
});

// ---- 2. The whole page works when nothing fails ---------------------------------------------

test('fix-viewer-1: normal run: no problem message, no missing ids, labels, details, buttons, slider, reset all work', async () => {
  await withPage(() => {}, async (page) => {
    assert.deepEqual(page.problemLines(), [], 'no red message expected');
    assert.deepEqual(page.missingIds, [], 'the script asked for an id or class that is not on the page');
    assert.deepEqual(page.consoleErrors, []);

    // Labels: one per block, one per room, one per floor, all with real text and a placed position.
    const labels = page.labels();
    const boxes = buildScene(run, LAST);
    const expected = boxes.filter((b) => b.itemId !== undefined).length + boxes.filter((b) => b.type === 'room').length + run.floors.length;
    assert.equal(labels.length, expected);
    for (const l of labels) {
      assert.ok(l.textContent.length > 0);
      assert.match(l.className, /scene-label/);
      if (l.style.display === 'none') continue; // hidden labels (not clash, hovered or selected) are not placed
      assert.match(String(l.style.left), /px$/);
      assert.match(String(l.style.top), /px$/);
    }
    const texts = labels.map((l) => l.textContent);
    for (const b of boxes.filter((x) => x.itemId !== undefined)) assert.ok(texts.includes(b.label), `no label "${b.label}"`);

    // Click a block: the details panel changes to that item.
    assert.match(detailsText(page), /Click a block/);
    const sofa = furniture();
    click(page, pixelOf(page, await centreOf(page, sofa.label)));
    assert.match(detailsText(page), new RegExp(`Name: ${sofa.label}`));
    assert.equal(page.problemLines().length, 0);

    // Click empty space (the top-left corner of the drawing): the panel closes.
    click(page, { clientX: 3, clientY: 3 });
    assert.match(detailsText(page), /Click a block/);

    // A drag is not a click.
    const at = pixelOf(page, await centreOf(page, sofa.label));
    page.canvas.dispatch('pointerdown', { ...at, button: 0, pointerId: 1 });
    page.canvas.dispatch('pointerup', { clientX: at.clientX + 60, clientY: at.clientY, button: 0, pointerId: 1 });
    assert.match(detailsText(page), /Click a block/);

    // Floor buttons.
    page.el('floor-ground').dispatch('click');
    assert.equal(page.el('floor-ground').getAttribute('aria-pressed'), 'true');
    assert.equal(page.el('floor-all').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(page.labels().filter((l) => /floor-label/.test(l.className)).map((l) => l.textContent), ['Ground floor']);
    page.el('floor-upper').dispatch('click');
    assert.deepEqual(page.labels().filter((l) => /floor-label/.test(l.className)).map((l) => l.textContent), ['Upper floor']);
    page.el('floor-all').dispatch('click');
    assert.equal(page.labels().length, expected);

    // Reset view puts the camera back where it started after the visitor moved it.
    const camera = page.controls.object;
    const start = camera.position.clone();
    camera.position.set(start.x + 3, start.y + 1, start.z - 4);
    page.controls.update();
    assert.ok(camera.position.distanceTo(start) > 1, 'the test must really have moved the camera');
    page.el('reset-view').dispatch('click');
    assert.ok(camera.position.distanceTo(start) < 0.01, 'Reset view did not restore the starting camera');

    // Slider.
    const slider = page.el('version-slider');
    assert.equal(slider.disabled, false);
    slider.value = '3';
    slider.dispatch('input');
    assert.equal(page.el('version-number').textContent, `3 of ${LAST}`);
    assert.equal(page.el('caption').textContent, run.versions[2].sentence);
    assert.equal(page.problemLines().length, 0);
  });
});

test('fix-viewer-1: handlers are attached in the right order', async () => {
  await withPage(() => {}, async (page) => {
    const at = (entry) => page.log.indexOf(entry);
    const firstLabel = page.log.indexOf('label-created');
    const order = ['fetch:sample-run.json', 'listener:version-slider:input', 'listener:floor-all:click', 'listener:floor-ground:click',
      'listener:floor-upper:click', 'listener:reset-view:click', 'listener:canvas:pointerup', 'resize-observer'];
    for (const entry of order) assert.ok(at(entry) >= 0, `${entry} never happened`);
    const positions = order.map(at);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `wrong order: ${order.join(' < ')}`);
    assert.equal(firstLabel, -1); // (labels are page elements; they are checked through the page, not this log)
    assert.ok(at('listener:version-slider:input') < at('listener:canvas:pointerup'), 'the page controls must be attached before the 3D parts');
  });
});

// ---- 3. One failing feature never stops the others ------------------------------------------

async function assertClickAndButtonsStillWork(page) {
  const sofa = furniture();
  click(page, pixelOf(page, await centreOf(page, sofa.label)));
  assert.match(detailsText(page), new RegExp(`Name: ${sofa.label}`), 'clicking a block no longer opens the details');
  page.el('floor-upper').dispatch('click');
  assert.equal(page.el('floor-upper').getAttribute('aria-pressed'), 'true', 'a floor button no longer works');
  assert.equal(page.el('floor-all').getAttribute('aria-pressed'), 'false');
  page.el('floor-all').dispatch('click');
  page.el('reset-view').dispatch('click');
  const slider = page.el('version-slider');
  slider.value = '2';
  slider.dispatch('input');
  assert.equal(page.el('version-number').textContent, `2 of ${LAST}`, 'the slider no longer works');
}

test('fix-viewer-1: when the label code throws, click and buttons still work, and a red message shows the error text', async () => {
  await withPage((p) => { p.failCreate = ['span']; }, async (page) => {
    assert.equal(page.labels().length, 0, 'the test must really have broken the labels');
    const box = page.el('error-message');
    assert.equal(box.hidden, false, 'the red message must be shown');
    const text = page.problemLines().join('\n');
    assert.match(text, /Text labels on the blocks/);
    assert.match(text, /cannot create a <span> element/);
    assert.match(text, /screenshot/);
    await assertClickAndButtonsStillWork(page);
  });
});

test('fix-viewer-1: when the label code throws while a floor button is pressed, the other parts still work', async () => {
  await withPage(() => {}, async (page) => {
    page.document.createElement = ((original) => (tag) => {
      if (tag === 'span') throw new Error('labels broke later');
      return original(tag);
    })(page.document.createElement);
    page.el('floor-ground').dispatch('click');
    assert.equal(page.el('floor-ground').getAttribute('aria-pressed'), 'true');
    assert.match(page.problemLines().join('\n'), /labels broke later/);
    await assertClickAndButtonsStillWork(page);
  });
});

test('fix-viewer-1: when the 3D library cannot load, the buttons and slider are set up and the error is shown', async () => {
  await withPage((p) => { p.failThreeImport = true; }, async (page) => {
    const text = page.problemLines().join('\n');
    assert.match(text, /Loading the 3D library/);
    assert.match(text, /three\.module\.js could not be loaded/);
    page.el('floor-ground').dispatch('click');
    assert.equal(page.el('floor-ground').getAttribute('aria-pressed'), 'true');
    page.el('reset-view').dispatch('click'); // does nothing without 3D, but must not throw
    const slider = page.el('version-slider');
    slider.value = '1';
    slider.dispatch('input');
    assert.equal(page.el('version-number').textContent, `1 of ${LAST}`);
    assert.match(page.el('scene-area').textContent, /cannot be shown/);
  });
});

test('fix-viewer-1: when the graphics (WebGL) cannot start, the page controls still work and the error is shown', async () => {
  await withPage((p) => { p.failRenderer = true; }, async (page) => {
    assert.match(page.problemLines().join('\n'), /WebGL is not available/);
    const slider = page.el('version-slider');
    slider.value = '4';
    slider.dispatch('input');
    assert.equal(page.el('version-number').textContent, `4 of ${LAST}`);
  });
});

test('fix-viewer-1: when the slider cannot be set up, the floor buttons, reset, labels and clicking still work', async () => {
  await withPage((p) => { p.failListenerOn = 'version-slider'; }, async (page) => {
    assert.match(page.problemLines().join('\n'), /Version slider/);
    assert.match(page.problemLines().join('\n'), /cannot attach a listener to version-slider/);
    assert.ok(page.labels().length > 0, 'labels must still be drawn');
    const sofa = furniture();
    click(page, pixelOf(page, await centreOf(page, sofa.label)));
    assert.match(detailsText(page), new RegExp(`Name: ${sofa.label}`));
    page.el('floor-ground').dispatch('click');
    assert.equal(page.el('floor-ground').getAttribute('aria-pressed'), 'true');
    page.el('reset-view').dispatch('click');
  });
});

test('fix-viewer-1: when the Reset view button cannot be set up, the floor buttons and clicking still work', async () => {
  await withPage((p) => { p.failListenerOn = 'reset-view'; }, async (page) => {
    assert.match(page.problemLines().join('\n'), /Reset view button/);
    const sofa = furniture();
    click(page, pixelOf(page, await centreOf(page, sofa.label)));
    assert.match(detailsText(page), new RegExp(`Name: ${sofa.label}`));
    page.el('floor-upper').dispatch('click');
    assert.equal(page.el('floor-upper').getAttribute('aria-pressed'), 'true');
  });
});

test('fix-viewer-1: an error thrown inside a click handler is shown in the red message, not lost', async () => {
  await withPage(() => {}, async (page) => {
    page.el('floor-ground').listeners.click.length = 0;
    page.document.querySelectorAll = () => { throw new Error('a made-up failure'); };
    page.el('floor-upper').dispatch('click');
    assert.match(page.problemLines().join('\n'), /a made-up failure/);
    assert.match(page.problemLines().join('\n'), /Floor button/);
  });
});

test('fix-viewer-1: when the sample file cannot be read, the red message says so and nothing crashes', async () => {
  await withPage((p) => { p.fetch = async () => ({ ok: false }); },
    async (page) => {
      assert.match(page.problemLines().join('\n'), /sample home could not be loaded/);
    },
    (page) => !page.el('error-message').hidden);
});

test('fix-viewer-1: the page says which script version ran, so a stale cached copy can be spotted', async () => {
  assert.match(html, /id="script-status">Page script: not started yet/);
  await withPage(() => {}, async (page) => {
    assert.match(page.el('script-status').textContent, /Page script build-intake-1: finished/);
  });
  assert.match(html, /styles\.css\?v=build-intake-1/);
  assert.match(html, /viewer\.js\?v=build-intake-1/);
  assert.match(js, /scene-data\.js\?v=\$\{PAGE_VERSION\}/);
});

// ---- 4. Camera limits, with the real OrbitControls -----------------------------------------

test('fix-viewer-1: the camera cannot flip upside down or go below the floor', async () => {
  await withPage(() => {}, async (page) => {
    const { controls } = page;
    const camera = controls.object;
    assert.ok(controls.maxPolarAngle <= Math.PI / 2, 'the camera must not go below sideways-on');
    assert.ok(controls.minPolarAngle > 0, 'the camera must not reach the straight-up pole');
    // Try to drag the camera far underneath, and far over the top.
    for (const y of [-500, -3, 500]) {
      camera.position.set(controls.target.x + 0.3, y, controls.target.z + 8);
      controls.update();
      assert.ok(camera.position.y >= controls.target.y - 1e-6, `camera went below the middle of the home (y=${camera.position.y})`);
      assert.ok(camera.position.y > 0, 'camera went below the floor');
      const flat = Math.hypot(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      assert.ok(flat > 0.1, 'camera is straight above the target, where the view can flip');
      camera.updateMatrixWorld();
      assert.ok(camera.up.y > 0 && camera.matrixWorld.elements[5] > 0, 'the view is upside down');
    }
    // Sliding the view sideways cannot carry the target under the floor.
    controls.target.set(0, -5, 0);
    controls.update();
    assert.ok(controls.target.y >= 0, 'the target went below the floor');
    // Zoom limits.
    assert.ok(controls.minDistance >= 1 && Number.isFinite(controls.maxDistance));
  });
});

// ---- 5. Layout and overlay rules in the real CSS --------------------------------------------

const rule = (selector) => {
  const m = css.match(new RegExp(`(?:^|\\n|\\s)${selector.replace(/[#.[\]]/g, '\\$&')} \\{([^}]*)\\}`));
  assert.ok(m, `no css rule for ${selector}`);
  return m[1];
};

test('fix-viewer-1: the four panels are in the right-hand column and the canvas in the left column in the HTML', () => {
  const main = html.slice(html.indexOf('<div id="col-main">'), html.indexOf('<div id="col-side">'));
  const side = html.slice(html.indexOf('<div id="col-side">'), html.indexOf('</main>'));
  assert.match(main, /id="scene-area"/);
  assert.match(main, /id="view-controls"/);
  for (const id of ['legend', 'history', 'clash-section', 'details-panel']) {
    assert.match(side, new RegExp(`<section id="${id}"`), `${id} must be in the right-hand column`);
    assert.doesNotMatch(main, new RegExp(`id="${id}"`));
  }
});

test('fix-viewer-1: CSS: one column by default, two columns (canvas left, panels right) on wide screens', () => {
  assert.match(rule('#page-inner'), /flex-direction: column/);
  const wide = css.match(/@media \(min-width: (\d+)px\) \{([\s\S]*?)\n\}/);
  assert.ok(wide, 'no wide-screen rule');
  assert.ok(Number(wide[1]) <= 900, 'the two-column layout must start at 900 px or narrower');
  assert.match(wide[2], /#page-inner \{[^}]*flex-direction: row/);
  assert.match(wide[2], /#col-main \{[^}]*flex: 1 1 0/);
  assert.match(wide[2], /#col-side \{[^}]*flex: 0 0 \d+px/);
  // The wide rule comes after the base rule, so it wins.
  assert.ok(css.indexOf('@media (min-width') > css.indexOf('#page-inner {'));
});

test('fix-viewer-1: CSS: nothing laid over the drawing can catch a click', () => {
  assert.match(rule('.scene-label'), /pointer-events: none/);
  assert.match(rule('.scene-label'), /position: absolute/);
  // Every absolutely placed thing inside the drawing is the canvas or a label. Anything else must ignore clicks.
  const absolute = [...css.matchAll(/([^{}]+)\{([^}]*position: absolute[^}]*)\}/g)].map((m) => m[1].trim());
  for (const selector of absolute) {
    assert.ok(/scene-label|canvas/.test(selector) || /pointer-events: none/.test(css.slice(css.indexOf(selector))), `${selector} is positioned over the page`);
  }
  assert.match(rule('#scene-area canvas'), /position: absolute/);
  // The red message and the script line are not inside the drawing area.
  const scene = html.match(/<div id="scene-area"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(scene, /error-message|script-status/);
});

test('fix-viewer-1: CSS: the red message is visible when shown and hidden when not', () => {
  assert.match(css, /#error-message\[hidden\] \{ display: none; \}/);
  assert.match(rule('#error-message'), /background: #fde8e8/);
});

// ---- 6. Security rule still holds -----------------------------------------------------------

test('fix-viewer-1: the page script still writes text only with textContent, and the security rule is unchanged', () => {
  for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'localStorage', 'http://', 'https://']) {
    assert.ok(!js.includes(banned), `viewer.js uses ${banned}`);
  }
  assert.match(html, /default-src 'self'; script-src 'self' 'sha256-[A-Za-z0-9+/=]+'; style-src 'self'; base-uri 'none'; form-action 'none'/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
});
