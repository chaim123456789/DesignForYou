// The page script for the intake screens: the start screen, the list of screens, Back and Next,
// the step text, the page title and the keyboard focus on each screen change.
//
// It is separate from viewer.js, so a failure here never stops the 3D viewer, and the other way round.
// Like viewer.js, every feature is set up in its own protected step (see attempt below). If one step
// fails, a red message with the error text appears at the top of the page and the other steps still
// run. Unexpected page errors are already shown by viewer.js, so this file does not add a second handler.
//
// Visitor text is only ever put on the page with textContent. Nothing here reads files, stores or sends anything.
const PAGE_VERSION = 'build-place-3';

// The screens in the order Back and Next move through them. `step` is the number shown in the step text.
// Start and Result are outside the numbered steps.
const SCREENS = [
  { id: 'start', name: 'Start', step: null },
  { id: 'setup', name: 'Project setup', step: 1 },
  { id: 'inspiration', name: 'Overall inspiration', step: 2 },
  { id: 'overrides', name: 'Room overrides', step: 3 },
  { id: 'brief', name: 'Your brief', step: 4 },
  { id: 'taste', name: 'Taste questions', step: 5 },
  { id: 'items', name: 'Your items', step: 6 },
  { id: 'place', name: 'Place furniture, doors and windows', step: 7 },
  { id: 'review', name: 'Review and run', step: 8 },
  { id: 'result', name: 'Result', step: null },
];
const STEPS = SCREENS.filter((s) => s.step !== null);

const el = (id) => document.getElementById(id);
let currentScreen = 'start';

// Screens ask to be redrawn each time they are shown (so they match the rooms entered in setup),
// and the setup screen asks to be cleared on "Start again".
const showHandlers = {};
const resetHandlers = [];
function onShow(id, handler) { (showHandlers[id] ||= []).push(handler); }
function onReset(handler) { resetHandlers.push(handler); }

// The visitor's project, in the page's memory only. It is created when the state code has loaded.
let appState = null;
let appStateCode = null; // the loaded state.js

// The code of each screen is loaded on its own, with the cache tag in its address, in a protected
// step. A screen whose file cannot be loaded shows the red message and the others still work.
const STATE_FILE = `./state.js?v=${PAGE_VERSION}`;
const LIMITS_FILE = `./limits.js?v=${PAGE_VERSION}`;
const SETUP_SCREEN_FILE = `./setup-screen.js?v=${PAGE_VERSION}`;
const INSPIRATION_SCREEN_FILE = `./inspiration-screen.js?v=${PAGE_VERSION}`;
const ITEMS_SCREEN_FILE = `./items-screen.js?v=${PAGE_VERSION}`;
const PLACE_SCREEN_FILE = `./place-screen.js?v=${PAGE_VERSION}`;
const PLACE_GEOMETRY_FILE = `./place-geometry.js?v=${PAGE_VERSION}`;
const BRIEF_SCREEN_FILE = `./brief-screen.js?v=${PAGE_VERSION}`;
const TASTE_SCREEN_FILE = `./taste-screen.js?v=${PAGE_VERSION}`;
const TASTE_FILE = `./taste.js?v=${PAGE_VERSION}`;
const REVIEW_SCREEN_FILE = `./review-screen.js?v=${PAGE_VERSION}`;
const RESULT_SCREEN_FILE = `./result-screen.js?v=${PAGE_VERSION}`;
const BUILD_BRAIN_FILE = `./build-brain.js?v=${PAGE_VERSION}`;
const REPORT_FILE = `./report.js?v=${PAGE_VERSION}`;
const RUN_DATA_FILE = `./run-data.js?v=${PAGE_VERSION}`;
const SUMMARY_VIEW_FILE = `./summary-view.js?v=${PAGE_VERSION}`;
const MAKE_SUMMARY_FILE = `../engine/summary/make-summary.js?v=${PAGE_VERSION}`;

// ---- Problems and protected steps (same pattern as viewer.js, own red box) -------------------

const FAILED = Symbol('failed');
const shownProblems = [];

// Put one line of text in the red box at the top of the page. The same line is never shown twice.
function showProblem(text) {
  try {
    if (shownProblems.includes(text)) return;
    shownProblems.push(text);
    const box = el('intake-error-message');
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

// A small grey line at the bottom of the page. It tells the owner which copy of this script is running.
function setScriptStatus(text) {
  attempt('Screens status line', () => { el('intake-script-status').textContent = `Page script ${PAGE_VERSION} (screens): ${text}`; });
}

// ---- Screens and navigation ----------------------------------------------------------------

function screenIndex(id) {
  return SCREENS.findIndex((s) => s.id === id);
}

// Show one screen and hide the others. Each part is its own protected step.
function show(id, { moveFocus = true } = {}) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`There is no screen called ${id}.`);
  currentScreen = id;
  attempt('Showing the screen', () => {
    for (const s of SCREENS) el(`screen-${s.id}`).hidden = s.id !== id;
    document.body.dataset.screen = id; // the stylesheet shows SAMPLE PROJECT only on the sample result
  });
  attempt('Page title', () => { document.title = `${screen.name} - DesignForYou`; });
  attempt('Step text, Back and Next', () => updateNavigation(screen));
  attempt('Clearing the status line', () => { el('action-status').textContent = ''; });
  attempt('Drawing the screen', () => { for (const redraw of showHandlers[id] || []) attempt('Drawing the screen', redraw); });
  attempt('Warning before leaving the page', updateLeaveWarning);
  // Focus moves to the new heading only when the visitor changes screen, not when the page first loads.
  if (moveFocus) {
    attempt('Moving the keyboard focus', () => {
      const heading = el(`heading-${id}`);
      if (heading) heading.focus();
    });
  }
}

function updateNavigation(screen) {
  const stepText = el('step-text');
  const nav = el('step-nav');
  const numbered = screen.step !== null;
  stepText.hidden = !numbered;
  nav.hidden = !numbered;
  stepText.textContent = numbered ? `Step ${screen.step} of ${STEPS.length}: ${screen.name}` : '';
  // Last step: no Next here. The run button comes with the review screen.
  el('next-button').hidden = !numbered || screen.step === STEPS.length;
}

function goBack() {
  const index = STEPS.findIndex((s) => s.id === currentScreen);
  if (index <= 0) show('start');
  else show(STEPS[index - 1].id);
}

function goNext() {
  const index = STEPS.findIndex((s) => s.id === currentScreen);
  if (index >= 0 && index < STEPS.length - 1) show(STEPS[index + 1].id);
}

// The result screen code (result-screen.js), once it has loaded. Until then, and if it cannot load,
// "Try the sample" works exactly as it always did.
let resultApi = null;

// "Try the sample" shows the existing viewer. viewer.js has already loaded sample-run.json by itself.
function setUpSampleButton() {
  el('choose-sample').addEventListener('click', guarded('Try the sample button', () => {
    if (resultApi) resultApi.showSampleResult();
    else show('result');
  }));
}
function setUpOwnProjectButton() {
  el('choose-own').addEventListener('click', guarded('Start my own project button', () => show('setup')));
}

// Each button is its own protected step, so one that cannot be set up never stops the others.
function setUpBackButton() {
  el('back-button').addEventListener('click', guarded('Back button', goBack));
}
function setUpNextButton() {
  el('next-button').addEventListener('click', guarded('Next button', goNext));
}
function setUpResultBackButton() {
  el('result-back').addEventListener('click', guarded('Back to start button', () => show('start')));
}
function setUpStartAgainButton() {
  el('start-again').addEventListener('click', guarded('Start again button', askStartAgain));
}

// ---- Image previews, the warning before leaving, and starting again -------------------------

// Release the temporary preview addresses of these image records. The addresses live in the browser's
// memory until released. A failure for one image never stops the others.
function releaseImages(images) {
  for (const image of images || []) {
    if (!image || !image.previewUrl) continue;
    attempt('Releasing an image preview', () => URL.revokeObjectURL(image.previewUrl));
    image.previewUrl = null;
  }
}

// The browser asks "leave this page?" only when the visitor has entered something. The handler is
// added the first time something has been entered, never before.
let leaveWarningOn = false;
function updateLeaveWarning() {
  if (leaveWarningOn || !appState || !appStateCode || !appStateCode.hasEntries(appState)) return;
  leaveWarningOn = true;
  window.addEventListener('beforeunload', guarded('Warning before leaving the page', (event) => {
    if (!appStateCode.hasEntries(appState)) return; // after "Start again" there is nothing to lose
    event.preventDefault();
    event.returnValue = ''; // the browser shows its own wording
  }));
}

// The browser's own question box asks first, because this throws away everything entered.
function askStartAgain() {
  if (typeof globalThis.confirm !== 'function') return; // no way to ask, so nothing is thrown away
  if (!globalThis.confirm('Start again? Everything you entered, including your images, will be cleared. This cannot be undone.')) return;
  startAgain();
}

// Clears everything the visitor entered, including the image previews, and goes to the start screen.
function startAgain() {
  if (appState && appStateCode) {
    releaseImages(appStateCode.allImages(appState));
    appState = appStateCode.createState();
    for (const reset of resetHandlers) attempt('Clearing a screen on Start again', reset);
  }
  show('start');
}

// What the screens share: the status line that announces additions and removals (role="status").
function announce(text) {
  attempt('Status line', () => { el('action-status').textContent = text; });
  attempt('Warning before leaving the page', updateLeaveWarning);
}

async function loadProjectData() {
  const stateCode = await import(STATE_FILE);
  const limitsCode = await import(LIMITS_FILE);
  appStateCode = stateCode;
  appState = stateCode.createState();
  return { api: stateCode, limits: limitsCode.LIMITS };
}

async function loadSetupScreen(data) {
  const { setUpSetupScreen } = await import(SETUP_SCREEN_FILE);
  setUpSetupScreen({ el, attempt, guarded, announce, getState: () => appState, releaseImages, onReset, ...data });
}

async function loadInspirationScreens(data) {
  const { setUpInspirationScreens } = await import(INSPIRATION_SCREEN_FILE);
  setUpInspirationScreens({ el, attempt, guarded, announce, getState: () => appState, releaseImages, onShow, ...data });
}

async function loadBriefScreen(data) {
  const { setUpBriefScreen } = await import(BRIEF_SCREEN_FILE);
  setUpBriefScreen({ el, attempt, guarded, announce, getState: () => appState, entriesChanged: updateLeaveWarning, onShow, ...data });
}

async function loadTasteScreen(data) {
  const { setUpTasteScreen } = await import(TASTE_SCREEN_FILE);
  const taste = await import(TASTE_FILE);
  setUpTasteScreen({ el, attempt, guarded, announce, getState: () => appState, onShow, taste, ...data });
}

async function loadItemsScreen(data) {
  const { setUpItemsScreen } = await import(ITEMS_SCREEN_FILE);
  setUpItemsScreen({ el, attempt, guarded, announce, getState: () => appState, onShow, onReset, ...data });
}

async function loadPlaceScreen(data) {
  const { setUpPlaceScreen } = await import(PLACE_SCREEN_FILE);
  const geometry = await import(PLACE_GEOMETRY_FILE);
  const { PLACE_TYPES, PLACE_WALLS } = await import(LIMITS_FILE);
  setUpPlaceScreen({
    el, attempt, guarded, announce, getState: () => appState, onShow, onReset, geometry,
    placeTypes: PLACE_TYPES, placeWalls: PLACE_WALLS, ...data,
  });
}

async function loadResultScreen(data) {
  const { setUpResultScreen } = await import(RESULT_SCREEN_FILE);
  const report = await import(REPORT_FILE);
  const runData = await import(RUN_DATA_FILE);
  const summaryView = await import(SUMMARY_VIEW_FILE);
  const { makeSummaryHtml } = await import(MAKE_SUMMARY_FILE);
  const taste = await import(TASTE_FILE);
  resultApi = setUpResultScreen({
    el, attempt, guarded, announce, getState: () => appState, onReset, show: (id) => show(id),
    getViewer: () => globalThis.designForYouViewer, askStartAgain,
    api: data.api, taste, report, runData, summaryView, makeSummaryHtml,
  });
}

async function loadReviewScreen(data) {
  const { setUpReviewScreen } = await import(REVIEW_SCREEN_FILE);
  const { runDesignTeam } = await import(BUILD_BRAIN_FILE);
  const taste = await import(TASTE_FILE);
  setUpReviewScreen({
    el, attempt, guarded, announce, getState: () => appState, onShow, onReset, taste, runDesignTeam,
    showResult: (run) => {
      if (!resultApi) throw new Error('The result screen could not be loaded. See the red message at the top of the page.');
      return resultApi.showOwnResult(run);
    },
    ...data,
  });
}

// The order matters little, but each step is protected on its own.
async function start() {
  setScriptStatus('started.');
  attempt('Try the sample button', setUpSampleButton);
  attempt('Start my own project button', setUpOwnProjectButton);
  attempt('Back button', setUpBackButton);
  attempt('Next button', setUpNextButton);
  attempt('Start again button', setUpStartAgainButton);
  attempt('Back to start button', setUpResultBackButton);
  attempt('Start screen', () => show('start', { moveFocus: false }));
  const data = await attempt('Loading the project data code', loadProjectData);
  if (data !== FAILED) await attempt('Setup screen', () => loadSetupScreen(data));
  if (data !== FAILED) await attempt('Inspiration screens', () => loadInspirationScreens(data));
  if (data !== FAILED) await attempt('Brief screen', () => loadBriefScreen(data));
  if (data !== FAILED) await attempt('Taste screen', () => loadTasteScreen(data));
  if (data !== FAILED) await attempt('Items screen', () => loadItemsScreen(data));
  if (data !== FAILED) await attempt('Place furniture screen', () => loadPlaceScreen(data));
  if (data !== FAILED) await attempt('Result screen', () => loadResultScreen(data));
  if (data !== FAILED) await attempt('Review and run screen', () => loadReviewScreen(data));
  setScriptStatus('finished setting up.');
}

start();
