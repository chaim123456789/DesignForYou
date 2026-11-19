// The page script. This step has only the parts that are not 3D: it loads the
// sample run file, fills the clash list, the caption and the details panel,
// and shows a plain message if the file cannot be read. All text goes in with
// textContent, so a strange name can never become page code.
import { describeItem } from './scene-data.js';

const SAMPLE_RUN_FILE = 'sample-run.json';

const el = (id) => document.getElementById(id);
let sampleRun = null;
let currentVersion = 0;
let openItemId = null;

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
      button.addEventListener('click', () => showDetails(target));
      li.appendChild(button);
    } else {
      li.textContent = text;
    }
    list.appendChild(li);
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
  render(last);
}

start();
