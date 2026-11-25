// design-team Group A, Task A1: the agent registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, validateRegistry, allDependencies } from '../src/agents/registry.js';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const VISION_ORDER = ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer'];
const raw = () => JSON.parse(readFileSync(path.join(srcDir, 'agents', 'registry.json'), 'utf8'));

test('design-team A1: the registry order is the eight names in the vision order', () => {
  assert.deepEqual([...loadRegistry().order], VISION_ORDER);
});

test('design-team A1: the Reviewer is last and depends on every other agent', () => {
  const reg = loadRegistry();
  assert.equal(reg.order[reg.order.length - 1], 'Reviewer');
  assert.deepEqual(allDependencies(reg, 'Reviewer'), VISION_ORDER.slice(0, 7));
  assert.deepEqual(allDependencies(reg, 'Walls'), []);
});

test('design-team A1: nobody depends on a later agent or on itself (every real dependency is earlier)', () => {
  const reg = loadRegistry();
  reg.agents.forEach((a, i) => {
    for (const d of a.dependsOn) assert.ok(reg.order.indexOf(d) < i, `${a.name} depends on ${d}`);
  });
});

test('design-team A1: a registry with a backwards dependency is rejected with a message', () => {
  const bad = raw();
  bad.agents[0].dependsOn = ['Doors and windows'];
  assert.throws(() => validateRegistry(bad), /Agent "Walls" depends on "Doors and windows", which runs later or is itself/);
  const self = raw();
  self.agents[2].dependsOn = ['Floors and ceilings'];
  assert.throws(() => validateRegistry(self), /may depend only on earlier agents/);
});

test('design-team A1: a registry with the wrong size, a missing name, a repeat or the Reviewer not last is rejected', () => {
  const seven = raw(); seven.agents.pop();
  assert.throws(() => validateRegistry(seven), /exactly 8 agents. It lists 7/);
  const unknown = raw(); unknown.agents[3].dependsOn = ['Plumbing'];
  assert.throws(() => validateRegistry(unknown), /"Plumbing", which is not in the registry/);
  const twice = raw(); twice.agents[1].name = 'Walls';
  assert.throws(() => validateRegistry(twice), /"Walls" is listed twice/);
  const swapped = raw(); [swapped.agents[6], swapped.agents[7]] = [swapped.agents[7], swapped.agents[6]];
  assert.throws(() => validateRegistry(swapped), /Reviewer must be last/);
  const sameFolder = raw(); sameFolder.agents[1].folder = 'walls';
  assert.throws(() => validateRegistry(sameFolder), /share one folder/);
  assert.throws(() => validateRegistry(null), /must be an object/);
});

test('design-team A1: the loaded registry cannot be changed', () => {
  const reg = loadRegistry();
  assert.throws(() => { 'use strict'; reg.order.push('X'); });
  assert.throws(() => { 'use strict'; reg.agents[0].dependsOn.push('X'); });
});

test('design-team A1: an unknown agent name is refused when asking for dependencies', () => {
  assert.throws(() => allDependencies(loadRegistry(), 'Plumbing'), /not an agent in the registry/);
});

test('design-team A1: no other list of the eight names exists in src/ outside the registry', () => {
  const files = (dir) => readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? files(full) : [full];
  }).filter((f) => /\.(js|json)$/.test(f));
  const names = VISION_ORDER;
  const hits = [];
  for (const f of files(srcDir)) {
    if (path.relative(srcDir, f).split(path.sep).join('/') === 'agents/registry.json') continue;
    const text = readFileSync(f, 'utf8');
    // Any one bracketed list that holds 4 or more of the eight names is a second copy of the order.
    for (const m of text.matchAll(/\[[^[\]]*\]/g)) {
      const count = names.filter((n) => m[0].includes(`'${n}'`) || m[0].includes(`"${n}"`)).length;
      if (count >= 4) hits.push(`${path.relative(srcDir, f)}: ${m[0].slice(0, 60)}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('design-team A1: the old AGENT_ORDER and the old pipeline are untouched', async () => {
  const { AGENT_ORDER } = await import('../src/agents/config.js');
  assert.deepEqual([...AGENT_ORDER], ['Style', 'Layout', 'Builder', 'Reviewer']);
});
