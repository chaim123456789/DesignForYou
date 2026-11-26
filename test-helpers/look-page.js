// Helpers for the look-and-feel tests: open the REAL page (docs/index.html with docs/viewer.js and docs/intake/screens.js) on the
// stand-in page, fill in a small project, and answer the design team's proposals. Not part of the app.
import { createFakePage, installFakePage, waitFor, readDoc } from './fake-page.js';

let caseNumber = 70000;

// options.storage: a stand-in for the browser's localStorage ({ getItem, setItem }), or null for "no storage" (the default is a Map-based one).
// options.configure(page): run before the scripts start (for example to break something).
export async function openLookPage(options = {}) {
  const page = createFakePage();
  if (options.configure) options.configure(page);
  const restore = installFakePage(page);
  page.el('heading-result').textContent = 'Sample two-storey home'; // the stand-in does not read the heading's text from index.html
  globalThis.confirm = () => true;
  const store = options.storage === undefined ? memoryStorage() : options.storage;
  const savedLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (store === null) delete globalThis.localStorage;
  else Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: store });
  if (options.matchMedia) Object.defineProperty(globalThis, 'matchMedia', { configurable: true, writable: true, value: options.matchMedia });
  caseNumber += 1;
  await import(`../docs/viewer.js?case=look-${caseNumber}`);
  await waitFor(() => page.el('script-status').textContent.includes('finished'), 'the viewer script to finish');
  await import(`../docs/intake/screens.js?case=look-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  await new Promise((resolve) => setTimeout(resolve, 20));
  return {
    page,
    store,
    restore: () => {
      delete globalThis.confirm;
      delete globalThis.designForYouViewer;
      delete globalThis.matchMedia;
      if (savedLocal) Object.defineProperty(globalThis, 'localStorage', savedLocal); else delete globalThis.localStorage;
      restore();
    },
  };
}

export async function withLookPage(body, options) {
  const opened = await openLookPage(options);
  try { await body(opened.page, opened); } finally { opened.restore(); }
}

export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); } };
}

export const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
export const buttons = (node) => walk(node).filter((n) => n.tagName === 'BUTTON');
export const textOf = (node) => walk(node).map((n) => n._text).join(' ');

export function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  if (page.el(`screen-${id}`).hidden) throw new Error(`could not reach ${id}`);
}
export const roomId = (select, name) => walk(select).find((n) => n.tagName === 'OPTION' && n.textContent === name).value;

// A small project: two rooms, a warm-oak note and a cold-steel item (so the Style agent is unsure). Ends on the Review screen.
export function fillProject(page, { locked = false } = {}) {
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
  page.el(locked ? 'item-status-locked' : 'item-status-unsure').checked = true;
  page.el('item-tag').value = 'cold steel';
  page.el('add-item').click();
  gotoStep(page, 'review');
}

export const stepButton = (page) => walk(page.el('run-extra')).find((n) => n.id === 'run-team-steps');
export const continueButton = (page) => page.el('team-run').children.find((c) => c.id === 'team-continue');
export const liveItems = (page) => page.el('team-proposals').children;
export const currentAgent = (page) => page.el('heading-team-agent').textContent;

// Press a button of one live proposal: 'Confirm', 'Skip' or 'Custom'. Returns false when the proposal was already answered.
export function answerOne(page, li, how = 'Confirm') {
  const answer = li.children.find((c) => c.className === 'team-answer');
  if (answer && answer.hidden === false) return false;
  const all = buttons(li).filter((b) => !b.parent.hidden);
  const b = all.find((x) => x.textContent.startsWith(how));
  if (!b) throw new Error(`no ${how} button`);
  b.click();
  return true;
}
// Answer every proposal still waiting for the current agent.
export function answerAll(page, how = 'Confirm') {
  for (const li of [...liveItems(page)]) answerOne(page, li, how);
}
// Go through the whole run, answering every proposal with `how`. Returns the names of the agents that were asked (in order).
export async function runToEnd(page, how = 'Confirm') {
  const seen = [];
  for (let i = 0; i < 40 && page.el('screen-result').hidden; i += 1) {
    seen.push(currentAgent(page));
    answerAll(page, how);
    continueButton(page).click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return seen;
}

export const homeText = () => readDoc('index.html');
