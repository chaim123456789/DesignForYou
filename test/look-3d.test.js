// Look-and-feel Task L6: the 3D view. Six layers, lights and small marks hidden by default, soft lighting, rounded placeholder furniture,
// and the agents' colours, letters and a small legend. No outside images or fonts.
// What these tests CANNOT show: how the picture looks (the stand-in draws nothing; they look at the objects handed to Three.js), whether the
// rounded shapes look good, whether the soft light is soft enough on a real screen. Pending owner check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScene, shapeParts, layerOf, LAYERS, ownersAt, softShapes } from '../docs/scene-data.js';
import { createState, setProjectName, addFloor, addRoom, addPlaced } from '../docs/intake/state.js';
import { runDesignTeam } from '../docs/intake/build-brain.js';
import { buildOwnRunData } from '../docs/intake/run-data.js';
import { readDoc, themeVariables, themeHex, shownByDefault, drawnPartCount, switchOnAllLayers } from '../test-helpers/fake-page.js';
import { withLook, walk } from '../test-helpers/look-page.js';
import { AGENT_INFO } from '../docs/workspace/agents-info.js';

const sample = JSON.parse(readDoc('sample-run.json'));
const LAST = sample.versions.length;
const dark = themeVariables('dark');
const light = themeVariables('light');
const hex = (value) => Number.parseInt(value.slice(1), 16);

const sceneGroup = (page) => page.scene.children.find((c) => c.type === 'Group');
const drawnItems = (page) => sceneGroup(page).children.filter((o) => o.userData && o.userData.itemId !== undefined);
const drawnTypes = (page) => new Set(drawnItems(page).map((o) => o.userData.type));
const layerBox = (page, id) => page.el(`layer-${id}`);
function toggle(page, id, on) {
  const box = layerBox(page, id);
  box.checked = on;
  box.dispatch('change');
}

// ---- Layers ----------------------------------------------------------------------------------------------------------------------

test('L6: there are six layers: Structure, Openings, Lighting, Furniture, Decor and Style, and every kind of block belongs to one', () => {
  assert.deepEqual(LAYERS.map((l) => l.label), ['Structure', 'Openings', 'Lighting', 'Furniture', 'Decor', 'Style']);
  const types = new Set(buildScene(sample, LAST).map((b) => b.type));
  for (const type of ['floor-slab', 'room', 'door', 'window', 'light-marker', 'switch', 'socket', 'furniture', 'rug', 'style-marker']) assert.ok(types.has(type), `the sample has a ${type}`);
  const byLayer = Object.fromEntries(LAYERS.map((l) => [l.id, new Set()]));
  for (const b of buildScene(sample, LAST)) byLayer[layerOf(b)].add(b.type);
  assert.deepEqual([...byLayer.structure].sort(), ['floor-slab', 'room']);
  assert.deepEqual([...byLayer.openings].sort(), ['door', 'window']);
  assert.deepEqual([...byLayer.lighting].sort(), ['light-marker', 'socket', 'switch']);
  assert.deepEqual([...byLayer.furniture], ['furniture']);
  assert.deepEqual([...byLayer.decor], ['rug']);
  assert.deepEqual([...byLayer.style], ['style-marker']);
  assert.equal(layerOf({ type: 'something-new' }), 'structure', 'a block of an unknown type is never lost');
});

test('L6: the lights and the small marks (switches, sockets, rugs) are hidden by default; the other four layers are on; the page boxes say the same', async () => {
  assert.deepEqual(LAYERS.filter((l) => !l.on).map((l) => l.id), ['lighting', 'decor']);
  const html = readDoc('index.html');
  for (const layer of LAYERS) {
    assert.match(html, new RegExp(`<input type="checkbox" id="layer-${layer.id}"${layer.on ? ' checked' : ''}> ${layer.label}</label>`), `the ${layer.label} box is ${layer.on ? 'ticked' : 'not ticked'} in the page`);
  }
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    const types = drawnTypes(page);
    for (const hidden of ['light-marker', 'switch', 'socket', 'rug']) assert.ok(!types.has(hidden), `${hidden} is not drawn at first`);
    for (const shown of ['door', 'window', 'furniture', 'style-marker']) assert.ok(types.has(shown), `${shown} is drawn at first`);
    for (const layer of LAYERS) assert.equal(layerBox(page, layer.id).checked, layer.on);
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L6: switching a layer on draws its blocks, switching it off removes them again, and the camera and the details stay as they are', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    const keysOf = () => drawnItems(page).map((o) => o.userData.boxKey);
    const lightingBoxes = buildScene(sample, LAST).filter((b) => layerOf(b) === 'lighting');
    assert.ok(lightingBoxes.length > 10);
    const camera = page.controls.object.position.toArray().join(',');
    toggle(page, 'lighting', true);
    for (const b of lightingBoxes) assert.ok(keysOf().includes(b.key), `${b.key} is drawn`);
    toggle(page, 'decor', true);
    assert.ok(drawnTypes(page).has('rug'));
    switchOnAllLayers(page);
    const all = buildScene(sample, LAST).filter((b) => b.itemId !== undefined).flatMap((b) => Array(drawnPartCount(b)).fill(b.key)).sort();
    assert.deepEqual(keysOf().sort(), all, 'with every layer on, every block of the data is drawn');
    toggle(page, 'lighting', false);
    assert.ok(!drawnTypes(page).has('switch') && !drawnTypes(page).has('light-marker'));
    toggle(page, 'furniture', false);
    assert.ok(!drawnTypes(page).has('furniture'));
    toggle(page, 'structure', false);
    assert.equal(sceneGroup(page).children.filter((o) => o.userData && (o.userData.type === 'room' || o.userData.type === 'floor-slab')).length, 0);
    assert.equal(page.controls.object.position.toArray().join(','), camera, 'the camera did not move');
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L6: the clash list still names every finding when a layer is off, and says how many are about things that are not drawn', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    assert.equal(page.el('clash-list').children.length, 9, 'all nine findings are listed');
    const note = page.el('clash-hidden-note');
    assert.equal(note.hidden, false);
    assert.match(note.textContent, /about things on a layer that is switched off, so (it is|they are) not outlined in red in the 3D view\. Switch the layer on to see (it|them)\./);
    switchOnAllLayers(page);
    assert.equal(note.hidden, true, 'nothing is hidden with every layer on');
    assert.equal(page.el('clash-list').children.length, 9);
    toggle(page, 'furniture', false);
    assert.equal(note.hidden, false);
  });
});

// ---- Soft light ------------------------------------------------------------------------------------------------------------------

test('L6: the light is soft: a sky-and-ground light and one gentle light, no hard ambient flood, no shadows', async () => {
  await withLook({}, async (page) => {
    const lights = page.scene.children.filter((c) => c.isLight);
    assert.deepEqual(lights.map((l) => l.type).sort(), ['DirectionalLight', 'HemisphereLight']);
    const hemisphere = lights.find((l) => l.type === 'HemisphereLight');
    const sun = lights.find((l) => l.type === 'DirectionalLight');
    assert.equal(hemisphere.color.getHex(), hex(dark['--three-sky']));
    assert.equal(hemisphere.groundColor.getHex(), hex(dark['--three-ground']));
    assert.ok(sun.intensity < 1, `the directional light is gentle (${sun.intensity})`);
    assert.equal(sun.castShadow, false);
    assert.equal(hemisphere.castShadow === true, false);
    assert.equal(page.scene.background.getHex(), hex(dark['--three-background']));
  });
});

// ---- Rounded placeholder furniture ------------------------------------------------------------------------------------------------

function ownRun(placeThem) {
  const s = createState();
  setProjectName(s, 'Shapes');
  const floor = addFloor(s, 'Ground').id;
  const room = addRoom(s, floor, 'Den', 5, 4).id;
  placeThem(s, room);
  const result = runDesignTeam(s);
  assert.equal(result.ok, true);
  return buildOwnRunData(result.project, s);
}
const meshesOf = (page, itemId) => sceneGroup(page).children.filter((o) => o.isMesh && o.userData && o.userData.itemId === itemId);

test('L6: a sofa has a seat, a back and two arms, all rounded, standing inside its footprint', async () => {
  const run = ownRun((s, room) => addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Unsure', x: 100, y: 100, width: 200, depth: 90 }));
  const sofa = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Couch');
  await withLook({}, async (page) => {
    assert.equal(await globalThis.designForYouViewer.showRunData(run, { kind: 'own' }), true);
    const meshes = meshesOf(page, sofa.itemId);
    assert.deepEqual(meshes.map((m) => m.userData.part).sort(), ['arm', 'arm', 'back', 'seat']);
    for (const m of meshes) {
      assert.equal(m.geometry.type, 'ExtrudeGeometry', `${m.userData.part} has rounded corners`);
      m.geometry.computeBoundingBox();
      const box = m.geometry.boundingBox;
      const centre = m.position;
      assert.ok(centre.x - (box.max.x - box.min.x) / 2 >= sofa.x - 1e-6 && centre.x + (box.max.x - box.min.x) / 2 <= sofa.x + sofa.width + 1e-6, 'inside the footprint along x');
      assert.ok(centre.z - (box.max.z - box.min.z) / 2 >= sofa.z - 1e-6 && centre.z + (box.max.z - box.min.z) / 2 <= sofa.z + sofa.depth + 1e-6, 'inside the footprint along z');
    }
    const heights = Object.fromEntries(meshes.map((m) => { m.geometry.computeBoundingBox(); return [m.userData.part, m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y]; }));
    assert.ok(heights.back > heights.arm && heights.arm > heights.seat, 'the back is the tallest, then the arms, then the seat');
  });
});

test('L6: a table is round: a round top on one pedestal, and the pedestal is under the top', async () => {
  const run = ownRun((s, room) => addPlaced(s, { type: 'table', name: 'Dining', room, status: 'Unsure', x: 100, y: 100, width: 140, depth: 80 }));
  const table = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Dining');
  await withLook({}, async (page) => {
    await globalThis.designForYouViewer.showRunData(run, { kind: 'own' });
    const meshes = meshesOf(page, table.itemId);
    const top = meshes.find((m) => m.userData.part === 'top');
    const post = meshes.find((m) => m.userData.part === 'pedestal');
    assert.equal(meshes.length, 2);
    assert.equal(top.geometry.type, 'CylinderGeometry');
    assert.equal(post.geometry.type, 'CylinderGeometry');
    assert.ok(Math.abs(top.scale.z - 80 / 140) < 1e-6, 'an oval table is squashed to its depth');
    assert.ok(Math.abs(post.position.x - top.position.x) < 1e-6 && Math.abs(post.position.z - top.position.z) < 1e-6, 'the pedestal is in the middle');
    assert.ok(post.position.y < top.position.y);
  });
});

test('L6: a bed has a rounded mattress and a rounded headboard that is taller than the mattress', async () => {
  const run = ownRun((s, room) => addPlaced(s, { type: 'bed', name: 'Bed', room, status: 'Unsure', x: 100, y: 100, width: 160, depth: 200 }));
  const bed = buildScene(run, run.snapshots.length - 1).find((b) => b.label === 'Bed');
  await withLook({}, async (page) => {
    await globalThis.designForYouViewer.showRunData(run, { kind: 'own' });
    const meshes = meshesOf(page, bed.itemId);
    assert.deepEqual(meshes.map((m) => m.userData.part).sort(), ['headboard', 'mattress']);
    const height = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y; };
    for (const m of meshes) assert.equal(m.geometry.type, 'ExtrudeGeometry');
    assert.ok(height(meshes.find((m) => m.userData.part === 'headboard')) > height(meshes.find((m) => m.userData.part === 'mattress')));
  });
});

test('L6: the shape rules (softShapes): the radius never exceeds half of a part, a table gets one pedestal, doors and windows stay plain frames', () => {
  const run = ownRun((s, room) => {
    addPlaced(s, { type: 'sofa', name: 'Couch', room, status: 'Unsure', x: 100, y: 100, width: 200, depth: 90 });
    addPlaced(s, { type: 'table', name: 'Dining', room, status: 'Unsure', x: 100, y: 250, width: 100, depth: 100 });
    addPlaced(s, { type: 'bed', name: 'Bed', room, status: 'Unsure', x: 300, y: 100, width: 160, depth: 200 });
    addPlaced(s, { type: 'wardrobe', name: 'Wardrobe', room, status: 'Unsure', x: 300, y: 320, width: 100, depth: 60 });
    addPlaced(s, { type: 'door', name: 'Door', room, status: 'Unsure', x: 0, y: 0, width: 90, depth: 10 });
  });
  for (const b of buildScene(run, run.snapshots.length - 1)) {
    const parts = shapeParts(b);
    if (parts.length === 0) continue;
    const shapes = softShapes(b, parts);
    for (const { part, form, radius } of shapes) {
      assert.ok(['box', 'rounded', 'cylinder'].includes(form));
      if (form === 'rounded') assert.ok(radius > 0 && radius <= Math.min(part.width, part.depth) / 2, `${b.label} ${part.role}: radius ${radius}`);
      if (b.type === 'door') assert.equal(form, 'box');
    }
    if (b.label === 'Dining') assert.deepEqual(shapes.map((s) => `${s.part.role}:${s.form}`).sort(), ['pedestal:cylinder', 'top:cylinder']);
    if (b.label === 'Wardrobe') assert.ok(shapes.some((s) => s.part.role === 'body' && s.form === 'rounded'));
  }
  assert.deepEqual(softShapes({ type: 'furniture' }, []), []);
});

// ---- The agents' colours, letters and legend ---------------------------------------------------------------------------------------

test('L6: every block is drawn in the colour of the agent that owns it, from the theme', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    switchOnAllLayers(page);
    const owners = ownersAt(sample, LAST);
    const bodies = drawnItems(page).filter((o) => o.isMesh && !(o.material.transparent));
    assert.ok(bodies.length > 30);
    const seenOwners = new Set();
    for (const m of bodies) {
      const owner = owners.get(m.userData.itemId);
      const info = AGENT_INFO.find((a) => a.name === owner);
      assert.ok(info, `${owner} is one of the eight agents`);
      seenOwners.add(owner);
      if (m.userData.part === 'inner') continue; // the bath's inner part is a lighter shade
      assert.equal(m.material.color.getHex(), hex(dark[`--agent-${info.key}`]), `${m.userData.boxKey} (${owner})`);
    }
    for (const name of ['Doors and windows', 'Lighting and electrical', 'Furniture', 'Decor', 'Style']) assert.ok(seenOwners.has(name), `${name} has blocks in the sample`);
  });
});

test('L6: an item owned by something that is not one of the eight agents (an older run) is drawn in the neutral colour, not left out', async () => {
  const run = structuredClone(sample);
  for (const snap of run.snapshots) for (const item of snap.items) if (item.kind === 'layout') item.owner = 'Layout';
  await withLook({}, async (page) => {
    await globalThis.designForYouViewer.showRunData(run, { kind: 'sample' });
    const furniture = drawnItems(page).filter((o) => o.userData.type === 'furniture');
    assert.ok(furniture.length > 0);
    for (const m of furniture) {
      if (m.userData.part === 'inner') continue; // the bath's inner part is a lighter shade
      assert.equal(m.material.color.getHex(), hex(dark['--three-neutral']));
    }
  });
});

test('L6: a Locked item has a bright edge on every part and its label says Locked; a clash label says Clash; the label has the owner\'s letter and colour', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    const locked = buildScene(sample, LAST).filter((b) => b.status === 'Locked' && b.itemId !== undefined && shownByDefault(b));
    assert.ok(locked.length > 0, 'the sample has a Locked item that is drawn');
    const edges = sceneGroup(page).children.filter((o) => o.isLineSegments && o.material.color.getHex() === hex(dark['--three-locked-edge']));
    assert.ok(edges.length >= locked.length);
    const labels = page.labels().filter((l) => l.getAttribute('data-letter') !== null);
    assert.ok(labels.length > 10);
    const owners = ownersAt(sample, LAST);
    // Two blocks can have the same text (two style notes are both cut to "Style of the decor in…"), so a label matches if ANY block with its text agrees.
    const boxes = buildScene(sample, LAST).filter((b) => b.itemId !== undefined && !b.noLabel);
    let lockedLabels = 0;
    let clashLabels = 0;
    for (const label of labels) {
      const candidates = boxes.filter((b) => b.label === label.textContent);
      assert.ok(candidates.length > 0, `${label.textContent} is a block of the data`);
      const agrees = candidates.some((box) => {
        const info = AGENT_INFO.find((a) => a.name === owners.get(box.itemId));
        return label.getAttribute('data-letter') === (info ? info.letter : '?')
          && label.getAttribute('data-agent') === (info ? info.key : 'neutral')
          && (label.getAttribute('data-locked') !== null) === (box.status === 'Locked')
          && (label.getAttribute('data-clash') !== null) === Boolean(box.clash);
      });
      assert.ok(agrees, `the label "${label.textContent}" has its owner's letter, colour name and its Locked and Clash words`);
      if (label.getAttribute('data-locked') !== null) lockedLabels += 1;
      if (label.getAttribute('data-clash') !== null) clashLabels += 1;
    }
    assert.ok(lockedLabels > 0 && clashLabels > 0, 'the sample shows both a Locked label and a Clash label');
    // The words are written by the stylesheet, so they are there even though the label's own text is only the name.
    const css = readDoc('styles.css');
    assert.match(css, /\.scene-label\[data-letter\]::before \{ content: attr\(data-letter\)/);
    assert.match(css, /\.scene-label\[data-locked\]::after \{ content: "Locked"/);
    assert.match(css, /\.scene-label\[data-clash\]::after \{ content: "Clash"/);
  });
});

test('L6: a small legend on the 3D view lists the eight agents with their letter, shape and name, and does not catch clicks meant for the drawing', async () => {
  await withLook({}, async (page) => {
    const items = page.el('agent-legend-list').children;
    assert.equal(items.length, 8);
    AGENT_INFO.forEach((info, i) => {
      const [badge, text] = items[i].children;
      assert.equal(badge.textContent, info.letter);
      assert.equal(badge.getAttribute('data-shape'), info.shape);
      assert.equal(badge.getAttribute('data-agent'), info.key);
      assert.equal(badge.getAttribute('aria-hidden'), 'true', 'the name next to it is what a screen reader reads');
      assert.ok(walk(text).some((n) => n.textContent === info.name));
    });
    const html = readDoc('index.html');
    const stage = html.slice(html.indexOf('<div id="stage"'), html.indexOf('<p id="sample-text-alternative"'));
    assert.ok(stage.indexOf('id="scene-area"') < stage.indexOf('id="agent-legend"'), 'the legend sits inside the stage with the drawing');
    assert.match(readDoc('styles.css'), /\.agent-legend \{ pointer-events: none;/);
  });
});

// ---- The theme reaches the 3D view ----------------------------------------------------------------------------------------------

test('L6: switching to the light theme draws the 3D view again with the light theme\'s colours', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    const furniture = () => drawnItems(page).find((o) => o.userData.type === 'furniture');
    assert.equal(furniture().material.color.getHex(), hex(dark['--agent-furniture']));
    page.el('theme-toggle').click();
    assert.equal(page.document.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(page.scene.background.getHex(), hex(light['--three-background']));
    assert.equal(furniture().material.color.getHex(), hex(light['--agent-furniture']));
    const hemisphere = page.scene.children.find((c) => c.type === 'HemisphereLight');
    assert.equal(hemisphere.color.getHex(), hex(light['--three-sky']));
    page.el('theme-toggle').click();
    assert.equal(furniture().material.color.getHex(), hex(dark['--agent-furniture']));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('L6: the clash outline takes its colour from the theme in both themes', async () => {
  await withLook({}, async (page) => {
    page.el('choose-sample').click();
    const outlines = () => sceneGroup(page).children.filter((o) => o.material && o.material.side === 1);
    assert.ok(outlines().length > 0);
    assert.ok(outlines().every((o) => o.material.color.getHex() === themeHex('--three-clash')));
    page.el('theme-toggle').click();
    assert.ok(outlines().every((o) => o.material.color.getHex() === themeHex('--three-clash', 'light')));
  });
});

// ---- Nothing from outside ---------------------------------------------------------------------------------------------------------------

test('L6: the 3D view and the page use no outside images and no outside fonts, and viewer.js and the plan write no colour of their own', () => {
  const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
  const plain = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const name of ['index.html', 'styles.css', 'theme.css', 'viewer.js', 'scene-data.js', 'workspace/theme-colours.js', 'workspace/shell.js', 'workspace/agents-page.js']) {
    const text = plain(read(name));
    assert.doesNotMatch(text, /@font-face|@import|url\(|https?:\/\/|\/\/fonts\.|<img\b|<link[^>]*(icon|preload|preconnect)/i, `${name} loads nothing from outside`);
    assert.doesNotMatch(text, /\bnew Image\b|TextureLoader|FontLoader|TTFLoader|\.load\(/, `${name} loads no texture or font`);
  }
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(read('index.html'))[1];
  assert.match(csp, /img-src 'self' blob:/);
  assert.doesNotMatch(csp, /https?:|font-src|data:/);
  // No colour written in the viewer or the plan: they come from the theme.
  for (const name of ['viewer.js', 'intake/place-plan.js', 'workspace/shell.js', 'workspace/agents-page.js', 'workspace/agents-info.js']) {
    assert.doesNotMatch(plain(read(name)), /0x[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, `${name} writes no colour`);
  }
  // The font names are in the theme only, and they are fonts already on the device (no @font-face, no outside file).
  assert.match(read('theme.css'), /--font-text: system-ui/);
  for (const m of plain(read('styles.css')).matchAll(/font-family:\s*([^;]+);/g)) assert.match(m[1].trim(), /^var\(--font-[a-z]+\)$/, 'a font comes from the theme');
  assert.equal(LAYERS.length, 6);
});
