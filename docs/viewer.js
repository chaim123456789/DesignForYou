// The page script. It loads the sample run file, fills the clash list, the
// caption and the details panel, draws the home in 3D, and shows a plain
// message if the file cannot be read or the browser cannot do 3D. All text
// goes in with textContent, so a strange name can never become page code.
// This is the only file that uses Three.js. It draws what buildScene returns
// and nothing else.
//
// Every feature (slider, floor buttons, Reset view, turning, clicking, labels)
// is set up in its own protected step (see attempt below). If one step fails, a
// red message with the error text appears at the top of the page and the other
// steps still run.
const PAGE_VERSION = 'build-place-1';
// The files this page loads carry the version in their address, so a browser
// cannot mix an old copy of one file with a new copy of another.
const SCENE_DATA_FILE = `./scene-data.js?v=${PAGE_VERSION}`;

// Filled in by start(). These come from scene-data.js.
let buildScene;
let describeItem;
let separateLabels;
let floorLabels;
let filterByFloor;
let viewBounds;
let fitCamera;
let floorLabelText;
let shapeParts;

const COLOURS = {
  locked: 0x0072b2,   // blue
  unsure: 0xc55a00,   // darker orange (at least 3 to 1 on white and on the floor slab)
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
let userMovedCamera = false; // true once the visitor turns or zooms; the view then stops refitting itself
let shownFloor = 'all'; // 'all', or a floor's order number
let hoveredItemId = null; // the block under the mouse, if any
let showAllLabels = false; // the "Show all labels" checkbox

// ---- Problems and protected steps -----------------------------------------

const FAILED = Symbol('failed');
const shownProblems = [];

// Put one line of text in the red box at the top of the page. The same line is never shown twice.
function showProblem(text) {
  try {
    if (shownProblems.includes(text)) return;
    shownProblems.push(text);
    const box = el('error-message');
    const lines = ['Something went wrong on this page. Please take a screenshot of this red message.', ...shownProblems];
    box.replaceChildren(...lines.map((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      return p;
    }));
    box.hidden = false;
  } catch (secondError) {
    // The red box itself is broken. The browser's own error list is the last place left.
    console.error(text, secondError);
  }
}

function reportProblem(step, error) {
  const detail = error && error.message ? error.message : String(error);
  showProblem(`Step "${step}" failed: ${detail}`);
  console.error(step, error);
}

// Run one step. If it throws (or its promise fails), show the red message and carry on.
// Returns FAILED when the step failed, otherwise whatever the step returned.
function attempt(step, work) {
  try {
    const result = work();
    if (result && typeof result.then === 'function') {
      return result.then((value) => value, (error) => { reportProblem(step, error); return FAILED; });
    }
    return result;
  } catch (error) {
    reportProblem(step, error);
    return FAILED;
  }
}

// An event handler that can never throw out of the browser's event: its failure is shown on the page.
function guarded(step, handler) {
  return (...args) => attempt(step, () => handler(...args));
}

// A small line at the bottom of the page. It tells the owner which copy of the script is running.
function setScriptStatus(text) {
  attempt('Script status line', () => { el('script-status').textContent = `Page script ${PAGE_VERSION}: ${text}`; });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', (event) => reportProblem('Unexpected error', event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportProblem('Unexpected error', event.reason));
}

function showError(message) {
  showProblem(message);
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
  refreshLabels();
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
  refreshLabels();
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
      button.addEventListener('click', guarded('Clash list button', () => focusItem(target)));
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
// Camera limits. The polar angle is measured from straight up (0) to straight sideways (90 degrees = pi / 2).
// Staying between these two means the view can never flip over the top or go under the floor.
const MIN_POLAR_ANGLE = 0.2; // radians, about 11 degrees from straight above
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.05; // just above sideways-on
const MIN_ZOOM_DISTANCE = 3; // metres from the point looked at
const MAX_ZOOM_OUT = 2.5; // times the distance that fits the whole home

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

  // A piece with a known type is drawn as a few boxes (its parts). If that fails, or there are no
  // parts (the sample's furniture, doors and windows), the plain block below is drawn as before.
  const parts = attempt(`3D shape of ${b.label || 'an object'}`, () => shapeParts(b));
  if (Array.isArray(parts) && parts.length > 0) {
    addShapeParts(THREE, group, b, parts);
    addClashOutline(THREE, group, b, centre);
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

  addClashOutline(THREE, group, b, centre);
}

// A slightly larger red box seen from the inside: a thick outline over the status colour.
// Drawn once per object, around its overall box, whether it is a plain block or a shape.
function addClashOutline(THREE, group, b, centre) {
  if (!b.clash) return;
  const g = CLASH_OUTLINE * 2;
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(b.width + g, b.height + g, b.depth + g),
    new THREE.MeshBasicMaterial({ color: COLOURS.clash, side: THREE.BackSide }),
  );
  outline.position.set(...centre);
  group.add(outline);
}

// One mesh per part, all with the object's colour (Locked blue, Unsure orange), its key and its item id,
// so clicking any part opens that object's panel. The bath's inner part is a lighter shade of the same
// colour, and a window's glass is see-through. Doors and windows keep their dark and white edges.
function addShapeParts(THREE, group, b, parts) {
  for (const part of parts) {
    const geometry = new THREE.BoxGeometry(part.width, part.height, part.depth);
    const colour = new THREE.Color(COLOURS[part.colour]);
    if (part.lighter) colour.lerp(new THREE.Color(0xffffff), 0.55);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
      color: colour,
      transparent: Boolean(part.seeThrough),
      opacity: part.seeThrough ? 0.4 : 1,
    }));
    const partCentre = [part.x + part.width / 2, part.y + part.height / 2, part.z + part.depth / 2];
    mesh.position.set(...partCentre);
    mesh.userData = { boxKey: b.key, type: b.type, itemId: b.itemId, part: part.role };
    group.add(mesh);
    if ((b.type === 'door' || b.type === 'window') && !part.seeThrough) {
      const edgeColour = b.type === 'window' ? COLOURS.windowEdge : COLOURS.doorEdge;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: edgeColour }));
      edges.position.set(...partCentre);
      group.add(edges);
    }
  }
}

// Text labels are page elements laid over the drawing, so they are always readable.
// Room names, then item names. Item labels sit above the top of their block.
// Which labels are shown: room and floor names always; a block's label only when it is under
// the mouse, selected, part of a clash, or when "Show all labels" is ticked.
function labelIsWanted(label) {
  if (label.always || showAllLabels || label.clash) return true;
  return label.itemId !== undefined && (label.itemId === hoveredItemId || label.itemId === openItemId);
}

// Show or hide labels after the hover, selection or checkbox changed.
function refreshLabels() {
  if (view.renderer && view.scene && view.camera) attempt('Updating the text labels', drawFrame);
}

function addLabels(boxes) {
  const area = el('scene-area');
  for (const old of view.labels) old.element.remove();
  view.labels = [];
  const add = (b, text, className, y, extra) => {
    const element = document.createElement('span');
    element.className = `scene-label ${className}`;
    element.textContent = text;
    area.appendChild(element);
    view.labels.push({ element, point: [b.x + b.width / 2, y, b.z + b.depth / 2], ...extra });
  };
  for (const b of boxes) {
    if (b.itemId === undefined) continue;
    add(b, b.label, `${b.type}-label${b.clash ? ' clash-label' : ''}`, b.y + b.height, { itemId: b.itemId, clash: Boolean(b.clash) });
  }
  for (const b of boxes) {
    if (b.type === 'room') add(b, b.label, 'room-label', b.y + b.height, { always: true });
  }
  for (const f of filterByFloor(floorLabels(sampleRun), shownFloor)) {
    add({ x: f.x, z: f.z, width: 0, depth: 0 }, f.text, 'floor-label', f.y, { always: true });
  }
}

function drawFrame() {
  const { renderer, scene, camera } = view;
  renderer.render(scene, camera);
  camera.updateMatrixWorld();
  // The drawing is already on screen. If the labels fail, only the labels are lost.
  attempt('Placing the text labels', placeLabels);
}

function placeLabels() {
  const { THREE, renderer, camera } = view;
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  const v = new THREE.Vector3();
  const shown = [];
  for (const label of view.labels) {
    v.set(...label.point).project(camera);
    const visible = labelIsWanted(label) && v.z > -1 && v.z < 1;
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

// Place the camera so everything shown is completely inside the drawing, at an angle
// that shows both floors. The maths is in scene-data.js (fitCamera) so it can be tested.
function frameHome(boxes) {
  const { camera, controls } = view;
  const labels = filterByFloor(floorLabels(sampleRun), shownFloor);
  const fit = fitCamera(viewBounds(boxes, labels), { fov: camera.fov, aspect: camera.aspect });
  camera.position.set(...fit.position);
  camera.near = Math.max(0.1, fit.distance / 100);
  camera.far = fit.distance * 6;
  camera.updateProjectionMatrix();
  controls.target.set(...fit.target);
  controls.maxDistance = fit.distance * MAX_ZOOM_OUT;
  controls.update();
}

function resizeScene() {
  const area = el('scene-area');
  const width = Math.max(1, area.clientWidth);
  const height = Math.max(1, area.clientHeight);
  view.renderer.setSize(width, height, false);
  view.camera.aspect = width / height;
  view.camera.updateProjectionMatrix();
  if (!userMovedCamera && view.boxes.length > 0) frameHome(view.boxes);
  drawFrame();
}

// Draw the blocks, then (as a separate protected step) their text labels. A failing label
// step never stops the blocks, the clicking or the buttons.
function drawScene(version) {
  const boxes = filterByFloor(buildScene(sampleRun, version), shownFloor);
  if (view.group) { disposeGroup(view.group); view.scene.remove(view.group); }
  view.group = new view.THREE.Group();
  for (const b of boxes) addBox(view.THREE, view.group, b);
  view.scene.add(view.group);
  view.boxes = boxes;
  attempt('Text labels on the blocks', () => addLabels(boxes));
  return boxes;
}

// A click or tap on the drawing: open the nearest item under the pointer, or close the panel
// when the click lands on empty space or on a room.
function itemUnder(event) {
  const { THREE, renderer, camera, group } = view;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  if (!group) return undefined;
  const items = group.children.filter((obj) => obj.userData && obj.userData.itemId !== undefined);
  const hits = raycaster.intersectObjects(items, false);
  return hits.length > 0 ? hits[0].object.userData.itemId : undefined;
}

function pickAt(event) {
  const itemId = itemUnder(event);
  if (itemId !== undefined) showDetails(itemId);
  else closePanel();
}

// The block under the mouse gets its label shown while the mouse is over it.
function setHovered(itemId) {
  const next = itemId === undefined ? null : itemId;
  if (next === hoveredItemId) return;
  hoveredItemId = next;
  refreshLabels();
}

// Open the details of an item. With the 3D view running, also turn the camera toward it.
function focusItem(itemId) {
  showDetails(itemId);
  const { THREE, camera, controls } = view;
  const box = view.boxes.find((b) => b.itemId === itemId);
  if (!THREE || !camera || !controls || !box) return;
  userMovedCamera = true;
  const centre = new THREE.Vector3(box.x + box.width / 2, box.y + box.height / 2, box.z + box.depth / 2);
  const offset = camera.position.clone().sub(controls.target);
  const distance = Math.min(offset.length(), CLOSE_UP_DISTANCE);
  camera.position.copy(centre).addScaledVector(offset.normalize(), distance);
  controls.target.copy(centre);
  controls.update();
  drawFrame();
}

// Clicks and taps. Pressing and moving is turning the view, so it does not count as a click.
function setUpClicks() {
  const canvas = view.renderer.domElement;
  let pressed = null;
  canvas.addEventListener('pointerdown', (event) => { pressed = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointermove', guarded('Hovering over a block', (event) => {
    if (event.buttons) return; // turning the view, not pointing
    setHovered(itemUnder(event));
  }));
  canvas.addEventListener('pointerleave', guarded('Mouse leaving the drawing', () => setHovered(undefined)));
  canvas.addEventListener('pointerup', guarded('Clicking a block', (event) => {
    if (!pressed) return;
    const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
    pressed = null;
    if (moved <= CLICK_MOVE_LIMIT) pickAt(event);
  }));
}

// Turning and zooming, with limits so the view cannot flip over or go under the floor.
function setUpControls(OrbitControls) {
  const controls = new OrbitControls(view.camera, view.renderer.domElement);
  view.controls = controls;
  controls.minPolarAngle = MIN_POLAR_ANGLE;
  controls.maxPolarAngle = MAX_POLAR_ANGLE;
  controls.minDistance = MIN_ZOOM_DISTANCE;
  controls.addEventListener('change', guarded('Redrawing after turning', () => {
    if (controls.target.y < 0) { // sliding the view sideways must not carry it under the floor
      controls.target.y = 0;
      controls.update();
      return;
    }
    drawFrame();
  }));
  controls.addEventListener('start', () => { userMovedCamera = true; });
}

async function startScene() {
  const area = el('scene-area');
  let THREE;
  let OrbitControls;
  const loaded = await attempt('Loading the 3D library', async () => {
    THREE = await import('three');
    ({ OrbitControls } = await import('./vendor/OrbitControls.js'));
    view.renderer = new THREE.WebGLRenderer({ antialias: true });
  });
  if (loaded === FAILED) {
    showSceneMessage('The 3D view cannot be shown in this browser. The clash list and the details below still work.');
    return;
  }
  const built = attempt('Building the 3D scene', () => {
    view.THREE = THREE;
    view.scene = new THREE.Scene();
    view.scene.background = new THREE.Color(COLOURS.background);
    view.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, 12, 10);
    view.scene.add(sun);
    view.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    area.replaceChildren(view.renderer.domElement);
  });
  if (built === FAILED) {
    showSceneMessage('The 3D view cannot be shown in this browser. The clash list and the details below still work.');
    return;
  }
  // Each of these is its own step. Clicking is attached before anything is drawn.
  attempt('Turning and zooming the view', () => setUpControls(OrbitControls));
  attempt('Clicking on blocks', setUpClicks);
  attempt('Drawing the blocks', () => drawScene(currentVersion));
  attempt('Fitting the camera', () => { resizeScene(); frameHome(view.boxes); drawFrame(); });
  attempt('Watching the window size', () => new ResizeObserver(guarded('Resizing the view', resizeScene)).observe(area));
}

// The three floor buttons: Both, Ground floor, Upper floor.
function markFloorButtons(which) {
  for (const button of document.querySelectorAll('.floor-button')) {
    button.setAttribute('aria-pressed', String(button.dataset.floor === String(which)));
  }
}

function chooseFloor(which) {
  shownFloor = which;
  markFloorButtons(which);
  if (!view.THREE || !view.group) return;
  const boxes = drawScene(currentVersion);
  if (openItemId !== null && !boxes.some((b) => b.itemId === openItemId)) closePanel();
  userMovedCamera = false;
  frameHome(boxes);
  drawFrame();
}

// "Reset view": back to the starting camera for what is shown now.
function resetView() {
  if (!view.THREE || !view.group) return;
  userMovedCamera = false;
  frameHome(view.boxes);
  drawFrame();
}

function setUpFloorButtons() {
  for (const button of document.querySelectorAll('.floor-button')) {
    const which = button.dataset.floor === 'all' ? 'all' : Number(button.dataset.floor);
    button.addEventListener('click', guarded(`Floor button "${button.textContent}"`, () => chooseFloor(which)));
  }
}

// The "Show all labels" checkbox (off by default).
function setUpLabelsCheckbox() {
  const box = el('show-all-labels');
  showAllLabels = Boolean(box.checked);
  box.addEventListener('change', guarded('Show all labels checkbox', () => {
    showAllLabels = Boolean(box.checked);
    refreshLabels();
  }));
}

function setUpResetButton() {
  el('reset-view').addEventListener('click', guarded('Reset view button', resetView));
}

// The slider moved: update the text parts, then redraw the blocks as they were at that
// version. The text step runs first so an open panel is refreshed or closed for the new version.
// The camera is left where the visitor put it. Past views are read only.
function changeVersion(version) {
  hoveredItemId = null;
  render(version);
  if (!view.THREE || !view.group) return; // without 3D only the text parts change
  attempt('Redrawing the blocks for this version', () => {
    const boxes = drawScene(version);
    if (openItemId !== null && !boxes.some((b) => b.itemId === openItemId)) closePanel();
    drawFrame();
  });
}

// The slider's range for the run data being shown. Called for every run.
function configureSlider(last) {
  const slider = el('version-slider');
  slider.min = '0';
  slider.max = String(last);
  slider.value = String(last);
  slider.disabled = false;
}

// The slider's handler is attached once, the first time run data is shown.
function setUpSlider(last) {
  const slider = el('version-slider');
  configureSlider(last);
  slider.addEventListener('input', guarded('Version slider', () => changeVersion(Number(slider.value))));
}

// The text parts of the page for one version. Each part is its own protected step.
function render(version) {
  currentVersion = version;
  const last = sampleRun.versions.length;
  attempt('Version number and caption', () => {
    el('version-number').textContent = `${version} of ${last}`;
    el('caption').textContent = version === 0 ? 'Before any change' : sampleRun.versions[version - 1].sentence;
  });
  attempt('Clash list', () => fillClashList(version));
  attempt('Details panel', () => { if (openItemId !== null) showDetails(openItemId); });
}

// ---- Showing run data -----------------------------------------------------------------------

// The floor buttons are named after the floors of the run data being shown. A button for a floor
// that does not exist is hidden. For the sample the names are the ones already on the page.
function nameFloorButtons(run) {
  for (const button of document.querySelectorAll('.floor-button')) {
    if (button.dataset.floor === 'all') continue;
    const floor = run.floors.find((f) => f.order === Number(button.dataset.floor));
    button.hidden = !floor;
    if (floor) button.textContent = floorLabelText(floor);
  }
}

// After a second set of run data arrives: draw its blocks, close any open details, frame the view again.
function redrawForNewRun() {
  if (!view.THREE || !view.group) return; // without 3D only the text parts change
  const boxes = drawScene(currentVersion);
  closePanel();
  userMovedCamera = false;
  frameHome(boxes);
  drawFrame();
}

let controlsReady = false; // the slider, floor, reset and label handlers are attached once
let sceneRequested = false; // the 3D scene is built once and reused for every run

// Show one set of run data: the page's controls, the text parts and the 3D view. This is the one
// function that "Try the sample" and the run of a visitor's own project both go through. It can be
// called again with other run data: it replaces what is shown and starts at the latest version.
// kind is 'own' for a visitor's project; anything else is the sample. It only changes the text alternative of the 3D view.
async function showRunData(run, { kind } = {}) {
  checkShape(run);
  sampleRun = run;
  openItemId = null;
  hoveredItemId = null;
  shownFloor = 'all';
  userMovedCamera = false;
  const last = sampleRun.versions.length;
  attempt('Text alternative of the 3D view', () => {
    el('scene-area').setAttribute('aria-label', kind === 'own' ? '3D view of your project' : '3D view of the sample home');
  });
  attempt('Floor button names', () => nameFloorButtons(run));
  if (!controlsReady) {
    controlsReady = true;
    // The page controls come first and do not depend on 3D, so they work even if 3D fails.
    attempt('Version slider', () => setUpSlider(last));
    attempt('Floor buttons', setUpFloorButtons);
    attempt('Reset view button', setUpResetButton);
    attempt('Show all labels checkbox', setUpLabelsCheckbox);
  } else {
    attempt('Version slider', () => configureSlider(last));
    attempt('Floor buttons', () => markFloorButtons('all'));
  }
  render(last);
  if (!sceneRequested) {
    sceneRequested = true;
    await startScene();
  } else {
    attempt('Drawing the new project', redrawForNewRun);
  }
}

// What the intake screens use (they are a separate script, so the two never share a failure).
// Both return true when the data is shown, false when it could not be (the red message says why).
let loadedSample = null; // the sample run file, read once at the start
let ownRunShown = false;

let helpersLoading = null; // the loading of scene-data.js, so a call that comes too early waits for it

async function showRunDataSafely(run, options = {}) {
  if (helpersLoading && (await helpersLoading) === FAILED) return false;
  const kind = options.kind === 'own' ? 'own' : 'sample';
  if (kind === 'own') ownRunShown = true;
  const result = await attempt('Showing the project in the viewer', () => showRunData(run, { kind }));
  return result !== FAILED;
}

async function showSample() {
  if (!loadedSample) return false;
  return showRunDataSafely(loadedSample, { kind: 'sample' });
}

globalThis.designForYouViewer = { showRunData: showRunDataSafely, showSample };

async function start() {
  setScriptStatus('started.');
  helpersLoading = attempt('Loading scene-data.js', async () => {
    ({ buildScene, describeItem, separateLabels, floorLabels, filterByFloor, viewBounds, fitCamera, floorLabelText, shapeParts } = await import(SCENE_DATA_FILE));
  });
  const helperLoaded = await helpersLoading;
  if (helperLoaded === FAILED) return;
  let fetched;
  try {
    const response = await fetch(SAMPLE_RUN_FILE);
    if (!response.ok) throw new Error('The sample file could not be read.');
    fetched = await response.json();
    checkShape(fetched);
  } catch (error) {
    showError('The sample home could not be loaded, so nothing is shown. If you opened this page by double-clicking the file on your computer, use the web link instead (see the README).');
    return;
  }
  loadedSample = fetched;
  // If a visitor's own project was already shown, the sample must not replace it.
  if (!ownRunShown) await showRunData(fetched);
  setScriptStatus('finished setting up.');
}

start();
