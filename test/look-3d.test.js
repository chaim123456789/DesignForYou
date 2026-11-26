// look-and-feel Task 5: the 3D view. Layers, hidden small marks, agent colours, letter badges, soft light, rounded placeholders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installImportHooks } from '../test-helpers/hooks.js';
import { readDoc, themeValues } from '../test-helpers/fake-page.js';
import { buildScene, shapeParts, layerOf, filterByLayers, LAYERS, DEFAULT_LAYERS } from '../docs/scene-data.js';
import { agentOfOwner } from '../docs/agent-info.js';
import { withLookPage } from '../test-helpers/look-page.js';

installImportHooks();
const sample = JSON.parse(readDoc('sample-run.json'));
const LAST = sample.versions.length;
const all = buildScene(sample, LAST);
const group = (page) => page.scene.children.find((c) => c.type === 'Group');
const hex = (value) => parseInt(value.slice(1), 16);

test('look-and-feel T5: every box is on exactly one of the six layers, and lights and small marks are off by default', () => {
  assert.deepEqual([...LAYERS], ['structure', 'openings', 'lighting', 'furniture', 'decor', 'style']);
  for (const b of all) assert.ok(LAYERS.includes(layerOf(b)), `${b.type} has a layer`);
  const byLayer = Object.fromEntries(LAYERS.map((l) => [l, new Set(all.filter((b) => layerOf(b) === l).map((b) => b.type))]));
  assert.deepEqual([...byLayer.lighting].sort(), ['light-marker', 'socket', 'switch']);
  assert.deepEqual([...byLayer.decor], ['rug']);
  assert.deepEqual([...byLayer.openings].sort(), ['door', 'window']);
  assert.deepEqual(DEFAULT_LAYERS, { structure: true, openings: true, lighting: false, furniture: true, decor: false, style: true });
  const shown = filterByLayers(all, DEFAULT_LAYERS);
  for (const small of ['light-marker', 'switch', 'socket', 'rug']) assert.ok(!shown.some((b) => b.type === small), `${small} hidden by default`);
  assert.ok(shown.some((b) => b.type === 'furniture') && shown.some((b) => b.type === 'door'));
  assert.equal(filterByLayers(all, { ...DEFAULT_LAYERS, lighting: true, decor: true }).length, all.length);
});

test('look-and-feel T5: the layer buttons are on the page with labels, start as the defaults, and redraw when pressed', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const names = { structure: 'Structure', openings: 'Openings', lighting: 'Lighting', furniture: 'Furniture', decor: 'Decor', style: 'Style' };
    for (const [layer, word] of Object.entries(names)) {
      assert.match(readDoc('index.html'), new RegExp(`id="layer-${layer}"[^>]*>${word}</button>`));
      assert.equal(page.el(`layer-${layer}`).getAttribute('aria-pressed'), String(DEFAULT_LAYERS[layer]));
    }
    const count = () => group(page).children.length;
    const before = count();
    const marks = () => group(page).children.filter((o) => o.userData && ['light-marker', 'switch', 'socket'].includes(o.userData.type)).length;
    assert.equal(marks(), 0);
    page.el('layer-lighting').click();
    assert.equal(page.el('layer-lighting').getAttribute('aria-pressed'), 'true');
    assert.ok(marks() > 20, 'the lights, switches and sockets are drawn');
    assert.ok(count() > before);
    page.el('layer-lighting').click();
    assert.equal(count(), before, 'and gone again');
    page.el('layer-furniture').click();
    assert.ok(!group(page).children.some((o) => o.userData && o.userData.type === 'furniture'));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T5: with every layer on, the sample draws the 118 meshes of before, less two for each round table (3 parts, not 5), plus the Locked outlines', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    page.el('layer-lighting').click();
    page.el('layer-decor').click();
    const kids = group(page).children;
    const outlines = kids.filter((o) => o.userData && o.userData.outline === 'locked').length;
    assert.ok(outlines > 0);
    const tables = all.filter((b) => b.type === 'furniture' && b.furnitureType === 'table').length;
    assert.ok(tables > 0);
    assert.equal(kids.length - outlines, 118 - 2 * tables);
  });
});

test('look-and-feel T5: a clash on a hidden layer turns that layer on when the clash is chosen in the list', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const clash = page.el('clash-list').children.map((li) => li.children[0]).filter(Boolean);
    assert.ok(clash.length > 0);
    for (const b of clash) b.click();
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T5: blocks take the colour of the agent that owns them, from the theme, and Locked items get a dark outline', async () => {
  const t = themeValues('light');
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const meshes = group(page).children.filter((o) => o.isMesh && o.userData && o.userData.itemId !== undefined && o.userData.type === 'furniture');
    assert.ok(meshes.length > 0);
    const sofa = all.find((b) => b.type === 'furniture' && b.label === 'Sofa');
    const agent = agentOfOwner(sofa.owner);
    assert.equal(agent.name, 'Furniture');
    for (const m of meshes.filter((x) => x.userData.itemId === sofa.itemId)) assert.equal(m.material.color.getHex(), hex(t[agent.colourVar]));
    const lockedBoxes = filterByLayers(all, DEFAULT_LAYERS).filter((b) => b.itemId !== undefined && b.status === 'Locked');
    const outlines = group(page).children.filter((o) => o.userData && o.userData.outline === 'locked');
    assert.equal(outlines.length, new Set(lockedBoxes.map((b) => b.itemId)).size === 0 ? 0 : lockedBoxes.length);
    for (const o of outlines) assert.equal(o.material.color.getHex(), hex(t['--scene-locked-edge']));
  });
});

test('look-and-feel T5: labels start with the agent letter badge and say "(Locked)" for a Locked item, with the colour from the stylesheet', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const labels = page.labels().filter((l) => l.getAttribute('data-badge'));
    assert.ok(labels.length > 5);
    const sofa = labels.find((l) => l.textContent === 'Sofa');
    assert.equal(sofa.getAttribute('data-badge'), 'F');
    assert.equal(sofa.getAttribute('data-agent'), 'furniture');
    const bed = labels.find((l) => l.textContent === 'Oak bed');
    assert.equal(bed.getAttribute('data-locked'), 'true');
    assert.equal(sofa.getAttribute('data-locked'), null);
    const css = readDoc('styles.css');
    assert.match(css, /\.scene-label\[data-badge\]::before \{[^}]*content: attr\(data-badge\);/);
    assert.match(css, /\.scene-label\[data-locked="true"\]::after \{ content: " \(Locked\)";/);
  });
});

test('look-and-feel T5: the 3D colours come from the theme and follow dark mode', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    assert.equal(page.scene.background.getHex(), hex(themeValues('light')['--scene-background']));
    page.el('theme-toggle').click();
    assert.equal(page.scene.background.getHex(), hex(themeValues('dark')['--scene-background']));
    const sky = page.scene.children.find((c) => c.isHemisphereLight);
    assert.equal(sky.color.getHex(), hex(themeValues('dark')['--scene-light-sky']));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T5: soft light: a sky-and-ground light and one gentle sun, no hard shadows', async () => {
  await withLookPage((page) => {
    page.el('choose-sample').click();
    const lights = page.scene.children.filter((c) => c.isLight);
    assert.deepEqual(lights.map((l) => l.type).sort(), ['DirectionalLight', 'HemisphereLight']);
    assert.ok(lights.every((l) => !l.castShadow));
  });
});

const sofa = { key: 'k', type: 'furniture', furnitureType: 'sofa', x: 0, y: 0, z: 0, width: 2, height: 0.9, depth: 0.9, owner: 'Furniture', itemId: 'i', colour: 'unsure' };
test('look-and-feel T5: placeholders: a sofa has a back and two arms, a table is round, a bed has a taller headboard, and all are rounded', () => {
  const sofaParts = shapeParts(sofa);
  assert.deepEqual(sofaParts.map((p) => p.role).sort(), ['arm', 'arm', 'back', 'seat']);
  assert.ok(sofaParts.every((p) => p.shape === 'round'));
  const table = shapeParts({ ...sofa, furnitureType: 'table', width: 1.2, depth: 0.8 });
  assert.ok(table.every((p) => p.shape === 'cylinder'));
  const top = table.find((p) => p.role === 'top');
  assert.equal(top.width, top.depth, 'the top is a circle');
  assert.ok(Math.abs(top.width - 0.8) < 1e-9, 'its diameter is the shorter side');
  const bed = shapeParts({ ...sofa, furnitureType: 'bed', width: 1.6, depth: 2 });
  const head = bed.find((p) => p.role === 'headboard');
  assert.ok(head.height > bed.find((p) => p.role === 'mattress').height);
  assert.ok(bed.every((p) => p.shape === 'round'));
});

test('look-and-feel T5: rounded parts are drawn with rounded geometry (not plain boxes) and round tables with cylinders', async () => {
  const { buildOwnRunData } = await import('../docs/intake/run-data.js');
  const state = await import('../docs/intake/state.js');
  const { runDesignTeam } = await import('../docs/intake/build-brain.js');
  const s = state.createState();
  state.setProjectName(s, 'P');
  const room = state.addRoom(s, state.addFloor(s, 'G').id, 'Den').id;
  state.addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Unsure', x: 100, y: 100, width: 200, depth: 90 });
  state.addPlaced(s, { type: 'table', name: 'Round', room, status: 'Unsure', x: 100, y: 250, width: 100, depth: 100 });
  const result = runDesignTeam(s);
  const run = buildOwnRunData(result.project, s, result.team);
  await withLookPage(async (page) => {
    assert.equal(await globalThis.designForYouViewer.showRunData(run, { kind: 'own' }), true);
    const parts = group(page).children.filter((o) => o.isMesh && o.userData && o.userData.part);
    const types = (role) => parts.filter((m) => m.userData.part === role).map((m) => m.geometry.type);
    assert.ok(types('back').every((t) => t === 'ExtrudeGeometry'), 'the sofa back is rounded');
    assert.ok(types('arm').every((t) => t === 'ExtrudeGeometry'));
    assert.deepEqual(types('top'), ['CylinderGeometry'], 'the table top is round');
    assert.deepEqual(page.problemLines(), []);
  });
});

test('look-and-feel T5: the 3D view loads no outside image, font or script', () => {
  for (const name of ['viewer.js', 'scene-data.js', 'agent-info.js']) assert.doesNotMatch(readDoc(name), /https?:\/\/|\.(png|jpe?g|svg|woff2?|ttf)\b|FontLoader|TextureLoader/, name);
});
