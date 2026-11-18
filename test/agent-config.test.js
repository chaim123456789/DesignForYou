import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadAllAgentConfigs, loadAgentConfig, validateAgentConfig } from '../src/agents/config.js';
import { SAMPLE_LABEL, DRAFT_STATEMENT, getLabels } from '../src/label.js';

function tempAgents(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'agents-'));
  for (const [folder, content] of Object.entries(files)) {
    mkdirSync(path.join(dir, folder));
    writeFileSync(path.join(dir, folder, 'agent.json'), content);
  }
  return dir;
}

test('all four agent configs load, in run order', () => {
  const configs = loadAllAgentConfigs();
  assert.deepEqual(configs.map((c) => c.name), ['Style', 'Layout', 'Builder', 'Reviewer']);
  assert.ok(configs.every((c) => c.enabled === true));
});

test('an invalid config gives a clear message (bad enabled value)', () => {
  assert.throws(() => validateAgentConfig({ name: 'Style', enabled: 'yes' }, 'Style'), /needs "enabled" to be true or false/);
});

test('an invalid config gives a clear message (unknown name)', () => {
  assert.throws(() => validateAgentConfig({ name: 'Painter', enabled: true }), /unknown name "Painter"/);
});

test('an invalid config gives a clear message (not JSON, and missing file)', () => {
  const bad = tempAgents({ style: '{ not json' });
  assert.throws(() => loadAgentConfig('Style', bad), /not valid JSON/);
  assert.throws(() => loadAgentConfig('Layout', bad), /file is missing/);
});

test('a config whose name does not match its folder is rejected', () => {
  const dir = tempAgents({ style: '{"name":"Layout","enabled":true}' });
  assert.throws(() => loadAgentConfig('Style', dir), /should be "Style"/);
});

test('an agent can be switched off in its file', () => {
  const dir = tempAgents({ layout: '{"name":"Layout","enabled":false}' });
  assert.equal(loadAgentConfig('Layout', dir).enabled, false);
});

test('R6.7: the Reviewer is treated as on even if its file says off', () => {
  const dir = tempAgents({ reviewer: '{"name":"Reviewer","enabled":false}' });
  assert.equal(loadAgentConfig('Reviewer', dir).enabled, true);
});

test('R7.5: the label text contains SAMPLE PROJECT and the draft statement', () => {
  assert.match(SAMPLE_LABEL, /SAMPLE PROJECT/);
  assert.match(DRAFT_STATEMENT, /drafts for professional review/);
  assert.match(DRAFT_STATEMENT, /not verified engineering/);
  const labels = getLabels({ isSample: true });
  assert.deepEqual(labels, [SAMPLE_LABEL, DRAFT_STATEMENT]);
  assert.deepEqual(getLabels({ isSample: false }), [DRAFT_STATEMENT]);
});
