// The page script for the intake screens: the start screen, the list of screens, Back and Next,
// the step text, the page title and the keyboard focus on each screen change.
//
// It is separate from viewer.js, so a failure here never stops the 3D viewer, and the other way round.
// Like viewer.js, every feature is set up in its own protected step (see attempt below). If one step
// fails, a red message with the error text appears at the top of the page and the other steps still
// run. Unexpected page errors are already shown by viewer.js, so this file does not add a second handler.
//
// Visitor text is only ever put on the page with textContent. Nothing here reads files, stores or sends anything.
const PAGE_VERSION = 'build-intake-1';

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
  { id: 'review', name: 'Review and run', step: 7 },
  { id: 'result', name: 'Result', step: null },
];
const STEPS = SCREENS.filter((s) => s.step !== null);

const el = (id) => document.getElementById(id);
let currentScreen = 'start';

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

// "Try the sample" shows the existing viewer. viewer.js has already loaded sample-run.json by itself.
function setUpSampleButton() {
  el('choose-sample').addEventListener('click', guarded('Try the sample button', () => show('result')));
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

// The order matters little, but each step is protected on its own.
async function start() {
  setScriptStatus('started.');
  attempt('Try the sample button', setUpSampleButton);
  attempt('Start my own project button', setUpOwnProjectButton);
  attempt('Back button', setUpBackButton);
  attempt('Next button', setUpNextButton);
  attempt('Back to start button', setUpResultBackButton);
  attempt('Start screen', () => show('start', { moveFocus: false }));
  setScriptStatus('finished setting up.');
}

start();
