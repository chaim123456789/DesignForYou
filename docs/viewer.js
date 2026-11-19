// The page script. It loads the sample run file, fills the clash list, the
// caption and the details panel, draws the home in 3D, and shows a plain
// message if the file cannot be read or the browser cannot do 3D. All text
// goes in with textContent, so a strange name can never become page code.
// This is the only file that uses Three.js. It draws what buildScene returns
// and nothing else.
import { buildScene, describeItem, separateLabels, floorLabels, filterByFloor } from './scene-data.js';

// The colours, in one place. They match the legend swatches in styles.css.
const COLOURS = {
  locked: 0x0072b2,   // blue
  unsure: 0xe69f00,   // orange
  clash: 0xcc0000,    // red outline
  room: 0x7d8790,     // neutral grey for the wall outlines
  slab: 0xf4f1e8,     // pale floor slab
  slabEdge: 0xb9b4a6,
  doorEdge: 0x5a3a1a, // dark brown edge so doors look different from furniture
  windowEdge: 0xffffff,
  background: 0xdde3e9,
};
const CLASH_OUTLINE = 0.1; // metres the red outline sticks out from a clashing box

const SAMPLE_RUN_FILE = 'sample-run.json';

const el = (id) => document.getElementById(id);
let sampleRun = null;
let currentVersion = 0;
let openItemId = null;
let shownFloor = 'all'; // 'all', or a floor's order number

function showError(message) {
  const box = el('error-message');
  box.textContent = message;
  box.hidden = false;
  el('caption').textContent = 'The sample home is not shown.';
  el('clash-summary').textContent = '';
  el('clash-list').replaceChildren();
  el('version-slider').disabled = true;
}

function checkShape(data) {
  const ok = data && Array.isArray(data.floors) && Array.isArray(data.versions) && Array.isArray(data.snapshots)
    && data.snapshots.length === data.versions.length + 1;
  if (!ok) throw new Error('The sample file is not in the expected shape.');
}

function clashReport(version) {
  const snap = sampleRun.snapshots.find((s) => s.version === version);
  return snap.items.find((i) => i.kind === 'clash');
}

function firstDrawnItem(clash, version) {
  const snap = sampleRun.snapshots.find((s) => s.version === version);
  return clash.items.find((id) => snap.items.some((i) => i.id === id && i.room !== undefined));
}

function closePanel() {
  openItemId = null;
  const p = document.createElement('p');
  p.textContent = 'Click a block to see its details.';
  el('details-text').replaceChildren(p);
}

function showDetails(itemId) {
  const d = describeItem(sampleRun, currentVersion, itemId);
  if (!d) { closePanel(); return; }
  openItemId = itemId;
  const lines = [`Name: ${d.name}`, `Status: ${d.status}`, `Owner: ${d.owner}`, `Kind: ${d.kind}`];
  if (d.room) lines.push(`Room: ${d.room}`);
  for (const sentence of d.clashes) lines.push(sentence);
  el('details-text').replaceChildren(...lines.map((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
}

function fillClashList(version) {
  const report = clashReport(version);
  const list = el('clash-list');
  list.replaceChildren();
  if (!report || !report.clashes.length) {
    el('clash-summary').textContent = report ? report.summary : 'No clashes found';
    return;
  }
  el('clash-summary').textContent = report.summary;
  for (const clash of report.clashes) {
    const li = document.createElement('li');
    const text = `${clash.severity}: ${clash.description}`;
    const target = firstDrawnItem(clash, version);
    if (target) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', () => focusItem(target));
      li.appendChild(button);
    } else {
      li.textContent = text;
    }
    list.appendChild(li);
  }
}

// ---- 3D drawing -----------------------------------------------------------

const view = { THREE: null, renderer: null, scene: null, camera: null, controls: null, group: null, labels: [], boxes: [] };
const CLICK_MOVE_LIMIT = 5; // pixels. A press that moves further than this is a drag, not a click.
const CLOSE_UP_DISTANCE = 9; // metres from the item when the camera turns to it

function showSceneMessage(text) {
  const p = document.createElement('p');
  p.className = 'scene-message';
  p.textContent = text;
  el('scene-area').replaceChildren(p);
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  group.clear();
}

function addBox(THREE, group, b) {
  const centre = [b.x + b.width / 2, b.y + b.height / 2, b.z + b.depth / 2];
  const geometry = new THREE.BoxGeometry(b.width, b.height, b.depth);

  if (b.type === 'floor-slab') {
    // A solid pale slab, so furniture and panels stand out against it.
    const slab = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: COLOURS.slab }));
    slab.position.set(...centre);
    slab.userData = { boxKey: b.key, type: b.type };
    group.add(slab);
    const rim = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: COLOURS.slabEdge }));
    rim.position.set(...centre);
    group.add(rim);
    return;
  }

  if (b.type === 'room') {
    // Walls are thin outlines only: no filled faces, so nothing inside is hidden.
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: COLOURS.room }));
    edges.position.set(...centre);
    edges.userData = { boxKey: b.key, type: b.type };
    group.add(edges);
    return;
  }

  const isWindow = b.type === 'window';
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
    color: COLOURS[b.colour],
    transparent: isWindow,
    opacity: isWindow ? 0.6 : 1,
  }));
  mesh.position.set(...centre);
  mesh.userData = { boxKey: b.key, type: b.type, itemId: b.itemId };
  group.add(mesh);

  // Doors get a dark edge, windows a white edge, furniture and style tiles none.
  if (b.type === 'door' || isWindow) {
    const edgeColour = isWindow ? COLOURS.windowEdge : COLOURS.doorEdge;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: edgeColour }));
    edges.position.set(...centre);
    group.add(edges);
  }

  if (b.clash) {
    // A slightly larger red box seen from the inside: a thick outline over the status colour.
    const g = CLASH_OUTLINE * 2;
    const outline = new THREE.Mesh(
      new THREE.BoxGeometry(b.width + g, b.height + g, b.depth + g),
      new THREE.MeshBasicMaterial({ color: COLOURS.clash, side: THREE.BackSide }),
    );
    outline.position.set(...centre);
    group.add(outline);
  }
}

// Text labels are page elements laid over the drawing, so they are always readable.
// Room names, then item names. Item labels sit above the top of their block.
function addLabels(boxes) {
  const area = el('scene-area');
  for (const old of view.labels) old.element.remove();
  view.labels = [];
  const add = (b, text, className, y) => {
    const element = document.createElement('span');
    element.className = `scene-label ${className}`;
    element.textContent = text;
    area.appendChild(element);
    view.labels.push({ element, point: [b.x + b.width / 2, y, b.z + b.depth / 2] });
  };
  for (const b of boxes) {
    if (b.itemId === undefined) continue;
    add(b, b.label, `${b.type}-label${b.clash ? ' clash-label' : ''}`, b.y + b.height);
  }
  for (const b of boxes) {
    if (b.type === 'room') add(b, b.label, 'room-label', b.y + b.height);
  }
  for (const f of filterByFloor(floorLabels(sampleRun), shownFloor)) {
    add({ x: f.x, z: f.z, width: 0, depth: 0 }, f.text, 'floor-label', f.y);
  }
}

function drawFrame() {
  const { THREE, renderer, scene, camera } = view;
  renderer.render(scene, camera);
  camera.updateMatrixWorld();
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  const v = new THREE.Vector3();
  const shown = [];
  for (const label of view.labels) {
    v.set(...label.point).project(camera);
    const visible = v.z > -1 && v.z < 1;
    label.element.style.display = visible ? '' : 'none';
    if (!visible) continue;
    const w = label.element.offsetWidth;
    const h = label.element.offsetHeight;
    // Keep the whole label inside the drawing, then move colliding labels apart.
    const x = Math.min(Math.max((v.x * 0.5 + 0.5) * width, w / 2 + 4), width - w / 2 - 4);
    const y = Math.min(Math.max((-v.y * 0.5 + 0.5) * height - 4, h + 4), height - 4);
    shown.push({ label, rect: { x, y, width: w, height: h } });
  }
  const bottoms = separateLabels(shown.map((s) => s.rect));
  shown.forEach((s, i) => {
    s.label.element.style.left = `${s.rect.x}px`;
    s.label.element.style.top = `${Math.max(bottoms[i], s.rect.height + 2)}px`;
  });
}

// Place the camera so the whole home is in view, looking at its middle.
function frameHome(boxes) {
  const { THREE, camera, controls } = view;
  const bounds = new THREE.Box3();
  for (const b of boxes) {
    bounds.expandByPoint(new THREE.Vector3(b.x, b.y, b.z));
    bounds.expandByPoint(new THREE.Vector3(b.x + b.width, b.y + b.height, b.z + b.depth));
  }
  const centre = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const fitDistance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2);
  const aspectFactor = Math.max(1, 1.4 / camera.aspect);
  // From the front (larger z), a little to the right and above, so x runs left to right.
  const direction = new THREE.Vector3(0.35, 0.55, 1).normalize();
  camera.position.copy(centre).addScaledVector(direction, fitDistance * 0.85 * aspectFactor);
  camera.near = 0.1;
  camera.far = fitDistance * 6;
  camera.updateProjectionMatrix();
  controls.target.copy(centre);
  controls.update();
}

function resizeScene() {
  const area = el('scene-area');
  const width = Math.max(1, area.clientWidth);
  const height = Math.max(1, area.clientHeight);
  view.renderer.setSize(width, height, false);
  view.camera.aspect = width / height;
  view.camera.updateProjectionMatrix();
  drawFrame();
}

function drawScene(version) {
  const boxes = filterByFloor(buildScene(sampleRun, version), shownFloor);
  if (view.group) { disposeGroup(view.group); view.scene.remove(view.group); }
  view.group = new view.THREE.Group();
  for (const b of boxes) addBox(view.THREE, view.group, b);
  view.scene.add(view.group);
  addLabels(boxes);
  view.boxes = boxes;
  return boxes;
}

// A click or tap on the drawing: open the nearest item under the pointer, or close the panel
// when the click lands on empty space or on a room.
function pickAt(event) {
  const { THREE, renderer, camera, group } = view;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const items = group.children.filter((obj) => obj.userData && obj.userData.itemId !== undefined);
  const hits = raycaster.intersectObjects(items, false);
  if (hits.length > 0) showDetails(hits[0].object.userData.itemId);
  else closePanel();
}

// Open the details of an item. With the 3D view running, also turn the camera toward it.
function focusItem(itemId) {
  showDetails(itemId);
  const { THREE, camera, controls } = view;
  const box = view.boxes.find((b) => b.itemId === itemId);
  if (!THREE || !camera || !box) return;
  const centre = new THREE.Vector3(box.x + box.width / 2, box.y + box.height / 2, box.z + box.depth / 2);
  const offset = camera.position.clone().sub(controls.target);
  const distance = Math.min(offset.length(), CLOSE_UP_DISTANCE);
  camera.position.copy(centre).addScaledVector(offset.normalize(), distance);
  controls.target.copy(centre);
  controls.update();
  drawFrame();
}

async function startScene() {
  const area = el('scene-area');
  let THREE;
  let OrbitControls;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('./vendor/OrbitControls.js'));
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    view.renderer = renderer;
  } catch (error) {
    showSceneMessage('The 3D view cannot be shown in this browser. The clash list and the details below still work.');
    return;
  }
  try {
    view.THREE = THREE;
    view.scene = new THREE.Scene();
    view.scene.background = new THREE.Color(COLOURS.background);
    view.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, 12, 10);
    view.scene.add(sun);

    view.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    area.replaceChildren(view.renderer.domElement);
    view.controls = new OrbitControls(view.camera, view.renderer.domElement);
    view.controls.addEventListener('change', drawFrame);

    // Clicks and taps. Pressing and moving is turning the view, so it does not count as a click.
    const canvas = view.renderer.domElement;
    let pressed = null;
    canvas.addEventListener('pointerdown', (event) => { pressed = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener('pointerup', (event) => {
      if (!pressed) return;
      const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      pressed = null;
      if (moved <= CLICK_MOVE_LIMIT) pickAt(event);
    });

    const boxes = drawScene(currentVersion);
    resizeScene();
    frameHome(boxes);
    drawFrame();
    new ResizeObserver(resizeScene).observe(area);
  } catch (error) {
    showSceneMessage('The 3D view cannot be shown in this browser. The clash list and the details below still work.');
  }
}

// The three floor buttons: Both, Ground floor, Upper floor.
function chooseFloor(which) {
  shownFloor = which;
  for (const button of document.querySelectorAll('.floor-button')) {
    button.setAttribute('aria-pressed', String(button.dataset.floor === String(which)));
  }
  if (!view.THREE) return;
  const boxes = drawScene(currentVersion);
  if (openItemId !== null && !boxes.some((b) => b.itemId === openItemId)) closePanel();
  frameHome(boxes);
  drawFrame();
}

function setUpFloorButtons() {
  for (const button of document.querySelectorAll('.floor-button')) {
    const which = button.dataset.floor === 'all' ? 'all' : Number(button.dataset.floor);
    button.addEventListener('click', () => chooseFloor(which));
  }
}

function render(version) {
  currentVersion = version;
  const last = sampleRun.versions.length;
  el('version-number').textContent = `${version} of ${last}`;
  el('caption').textContent = version === 0 ? 'Before any change' : sampleRun.versions[version - 1].sentence;
  fillClashList(version);
  if (openItemId !== null) showDetails(openItemId);
}

async function start() {
  try {
    const response = await fetch(SAMPLE_RUN_FILE);
    if (!response.ok) throw new Error('The sample file could not be read.');
    sampleRun = await response.json();
    checkShape(sampleRun);
  } catch (error) {
    showError('The sample home could not be loaded, so nothing is shown. If you opened this page by double-clicking the file on your computer, use the web link instead (see the README).');
    return;
  }
  const last = sampleRun.versions.length;
  const slider = el('version-slider');
  slider.min = '0';
  slider.max = String(last);
  slider.value = String(last);
  slider.disabled = false;
  slider.addEventListener('input', () => render(Number(slider.value)));
  setUpFloorButtons();
  render(last);
  await startScene();
}

start();
