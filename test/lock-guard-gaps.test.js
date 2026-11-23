// Test gaps found by the lock-guard review (23 Nov 2026). Tests only; nothing in src/ was changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject, createItem, getItem, listVersions } from '../src/brain/brain.js';
import { createGatekeeper } from '../src/brain/gatekeeper.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return jsFiles(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

// Files that mention appendVersion, as paths relative to the project root.
function filesMentioning(name, dirs) {
  const re = new RegExp(`\\b${name}\\b`);
  return dirs.flatMap((d) => jsFiles(path.join(root, d)))
    .filter((f) => re.test(readFileSync(f, 'utf8')))
    .map((f) => path.relative(root, f).split(path.sep).join('/'))
    .sort();
}

// (a) Only the gatekeeper may call appendVersion.
// brain.js defines it. The gatekeeper is the one allowed caller. docs/engine/ holds byte-for-byte copies of those two.
const DEFINES_APPEND_VERSION = ['src/brain/brain.js', 'docs/engine/brain/brain.js'];
const ALLOWED_CALLERS = ['src/brain/gatekeeper.js', 'docs/engine/brain/gatekeeper.js'];

test('lock-guard gap (a): only the gatekeeper calls appendVersion in src/ (and the engine copy, and the intake screens)', () => {
  const found = filesMentioning('appendVersion', ['src', 'docs/engine', 'docs/intake']);
  const unexpected = found.filter((f) => !DEFINES_APPEND_VERSION.includes(f) && !ALLOWED_CALLERS.includes(f));
  assert.deepEqual(unexpected, [], `These files use appendVersion but are not on the allowed list: ${unexpected.join(', ')}`);
  assert.ok(found.includes('src/brain/gatekeeper.js'), 'the gatekeeper really calls it, so the search works');
});

test('lock-guard gap (a): the search sees a caller that is not on the list', () => {
  // The same pattern the test above uses, on a made-up file, so the test cannot pass by finding nothing.
  const re = /\bappendVersion\b/;
  assert.equal(re.test("import { appendVersion } from '../brain/brain.js';"), true);
  assert.equal(re.test('appendVersions are not a thing'), false);
});

function setup() {
  const p = createProject({ name: 'Test Home', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });
  createItem(p, { kind: 'style', value: 'warm oak', owner: 'Style', status: 'Unsure' }); // item-1
  createItem(p, { kind: 'style', value: 'white walls', owner: 'Style', status: 'Locked' }); // item-2
  return { p, gate: createGatekeeper(p) };
}

test('lock-guard gap (b): an agent trying to LOCK an Unsure item through changeStatus is refused and logged', () => {
  for (const agent of ['Style', 'Layout', 'Builder', 'Reviewer']) {
    const { p, gate } = setup();
    const result = gate.changeStatus(agent, 'item-1', 'Locked');
    assert.equal(result.accepted, false, agent);
    assert.match(result.reason, /Only the user/);
    assert.equal(getItem(p, 'item-1').status, 'Unsure', 'status is unchanged');
    assert.equal(listVersions(p).length, 0, 'no version is written');
    const refusals = p.runLog.filter((e) => e.event === 'refused');
    assert.equal(refusals.length, 1);
    assert.equal(refusals[0].agent, agent);
    assert.equal(refusals[0].item, 'item-1');
  }
});

test('lock-guard gap (c): the user setting an item to the status it already has returns "unchanged" and writes no version', () => {
  const { p, gate } = setup();
  const same1 = gate.changeStatus('user', 'item-1', 'Unsure');
  assert.deepEqual(same1, { accepted: true, unchanged: true });
  const same2 = gate.changeStatus('user', 'item-2', 'Locked');
  assert.deepEqual(same2, { accepted: true, unchanged: true });
  assert.equal(getItem(p, 'item-1').status, 'Unsure');
  assert.equal(getItem(p, 'item-2').status, 'Locked');
  assert.equal(listVersions(p).length, 0, 'no version is written');
  assert.equal(p.runLog.filter((e) => e.event === 'refused').length, 0, 'nothing is logged as refused');
});

test('lock-guard gap (c): a real status change by the user still writes exactly one version', () => {
  const { p, gate } = setup();
  const result = gate.changeStatus('user', 'item-1', 'Locked');
  assert.equal(result.accepted, true);
  assert.equal(result.unchanged, undefined);
  assert.equal(listVersions(p).length, 1);
});
