// Helpers for the look-and-feel tests (look-theme, look-home, look-workspace, look-agents, look-settings, look-3d).
// They open the REAL docs/index.html, docs/viewer.js and docs/intake/screens.js on the stand-in page (test-helpers/fake-page.js).
// What this CANNOT show: how anything looks (colours on screen, spacing, the 3D picture), real keyboard and touch use, a real phone, the
// browser's own full screen. Those are written down as "pending owner check".
import { installImportHooks } from './hooks.js';
import { createFakePage, installFakePage, waitFor, recordingStorage, installStorage } from './fake-page.js';

installImportHooks();

let caseNumber = 700000;

// options.storage: an object of keys already kept in the browser (see recordingStorage). options.configure(page): change the page before it starts.
export async function openLook({ storage = {}, configure = () => {}, fullscreen = false } = {}) {
  const recorder = recordingStorage(storage);
  const restoreStorage = installStorage(recorder.storage);
  const page = createFakePage();
  configure(page);
  const restorePage = installFakePage(page);
  page.recorder = recorder;
  page.el('heading-result').textContent = 'Sample two-storey home'; // the stand-in does not read the heading's text from index.html
  globalThis.confirm = () => true;
  let fullscreenCalls = 0;
  if (fullscreen) {
    // A browser that has the Fullscreen API: requestFullscreen on the 3D stage, and document.fullscreenElement.
    page.document.fullscreenElement = null;
    page.el('stage').requestFullscreen = async () => { fullscreenCalls += 1; page.document.fullscreenElement = page.el('stage'); };
    page.document.exitFullscreen = async () => { page.document.fullscreenElement = null; };
  }
  caseNumber += 1;
  await import(`../docs/viewer.js?case=look-${caseNumber}`);
  await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the viewer script to finish');
  await import(`../docs/intake/screens.js?case=look-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
  return {
    page,
    recorder,
    get fullscreenCalls() { return fullscreenCalls; },
    close() {
      restoreStorage();
      delete globalThis.confirm;
      delete globalThis.designForYouViewer;
      restorePage();
    },
  };
}

export async function withLook(options, body) {
  const opened = await openLook(options);
  try { await body(opened.page, opened); } finally { opened.close(); }
}

export const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
export const buttons = (node) => walk(node).filter((n) => n.tagName === 'BUTTON');
export const roomId = (select, name) => walk(select).find((n) => n.tagName === 'OPTION' && n.textContent === name).value;
export function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  if (page.el(`screen-${id}`).hidden) throw new Error(`could not reach the ${id} step`);
}

// A small own project: two rooms, a warm-oak note, an Unsure "cold steel" item (so Style is unsure), and optionally placed objects.
// placed: [{ type, name, status, x, y, width, depth, room: 'Living' | 'Bedroom' }] (centimetres)
export function fillOwnProject(page, { placed = [] } = {}) {
  page.el('choose-own').click();
  page.el('project-name').value = 'My home';
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = 'Ground floor';
  page.el('add-floor').click();
  for (const room of ['Living', 'Bedroom']) { page.el('room-name').value = room; page.el('add-room').click(); }
  gotoStep(page, 'inspiration');
  page.el('note-text').value = 'warm oak';
  page.el('add-note').click();
  gotoStep(page, 'items');
  page.el('item-text').value = 'Wall panels';
  page.el('item-room').value = roomId(page.el('item-room'), 'Living');
  page.el('item-status-unsure').checked = true;
  page.el('item-tag').value = 'cold steel';
  page.el('add-item').click();
  if (placed.length > 0) {
    gotoStep(page, 'place');
    for (const o of placed) {
      page.el('place-room').value = roomId(page.el('place-room'), o.room || 'Living');
      page.el('place-room').dispatch('change');
      page.el('place-type').value = o.type;
      page.el('place-type').dispatch('change');
      page.el('place-name').value = o.name;
      page.el(`place-status-${o.status.toLowerCase()}`).checked = true;
      page.el('place-x').value = String(o.x);
      page.el('place-y').value = String(o.y);
      page.el('place-width').value = String(o.width);
      page.el('place-depth').value = String(o.depth);
      page.el('add-placed').click();
    }
  }
  gotoStep(page, 'review');
}

export const stepButton = (page) => walk(page.el('run-extra')).find((n) => n.id === 'run-team-steps');
export const continueButton = (page) => page.el('team-run').children.find((c) => c.id === 'team-continue');
export const proposalItems = (page) => page.el('team-proposals').children;
export const answerLineOf = (li) => li.children.find((c) => c.className === 'team-answer');
export const heading = (page) => page.el('heading-team-agent').textContent;

// Answer the proposals still waiting for the current agent. how: 'confirm' (first option) or 'skip'.
export function answerWaiting(page, how = 'confirm') {
  for (const li of [...proposalItems(page)]) {
    if (answerLineOf(li).hidden === false) continue;
    const all = buttons(li).filter((b) => !b.parent.hidden);
    all.find((b) => b.textContent.startsWith(how === 'skip' ? 'Skip' : 'Confirm')).click();
  }
}

// Step through every agent, answering what is waiting, until the result is shown. Returns the headings seen, in order.
export async function runToEnd(page, how = 'confirm') {
  const seen = [];
  for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
    seen.push(heading(page));
    answerWaiting(page, how);
    continueButton(page).click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return seen;
}

export const SETTINGS_KEY = 'designforyou.agent-settings';
export const THEME_KEY = 'designforyou.theme';
export const savedSettings = (level, extra = {}) => ({ [SETTINGS_KEY]: JSON.stringify({ version: 1, global: level, perAgent: {}, doorsFollowWall: true, ...extra }) });
