// The tests that use registerHooks need Node 22.15.0 or newer. On an older Node they must stop with a clear
// message instead of a SyntaxError. The version check is a pure function, so it can be tested on any Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nodeProblem, MIN_NODE, registerHooks } from '../test-helpers/register-hooks.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Node requirement: an older Node gets the message "These tests need Node X or newer. You have Y."', () => {
  assert.equal(nodeProblem(false, '20.11.1'), `These tests need Node ${MIN_NODE} or newer. You have 20.11.1.`);
  assert.equal(nodeProblem(false, '22.14.0'), 'These tests need Node 22.15.0 or newer. You have 22.14.0.');
});

test('Node requirement: a Node with registerHooks gets no message', () => {
  assert.equal(nodeProblem(true, '22.15.0'), null);
});

test('Node requirement: on this Node the helper hands over a working registerHooks', () => {
  assert.equal(typeof registerHooks, 'function');
});

test('Node requirement: no test or helper imports registerHooks straight from node:module (that gives a SyntaxError on an older Node)', () => {
  const files = [
    '../test-helpers/hooks.js', '../test/intake-result.test.js', '../test/intake-setup.test.js',
  ];
  for (const f of files) {
    assert.doesNotMatch(read(f), /import\s*\{[^}]*registerHooks[^}]*\}\s*from\s*'node:module'/, f);
  }
  // The engine-export test only uses it inside a child script, so it must load the guard first.
  assert.match(read('../test/engine-export.test.js'), /import '\.\.\/test-helpers\/register-hooks\.js'/);
});

test('Node requirement: package.json "engines" and the README say the same minimum as the helper', () => {
  const pkg = JSON.parse(read('../package.json'));
  assert.ok(pkg.engines && pkg.engines.node.includes(MIN_NODE), 'engines.node names the minimum');
  assert.match(read('../README.md'), new RegExp(`Node ${MIN_NODE.replaceAll('.', '\\.')}`));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
