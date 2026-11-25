// design-team Group B, Task B6: the checkpoint run, printed as plain text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderTeamDemo, buildDemoProject } from '../src/team-demo.js';
import { loadRegistry } from '../src/agents/registry.js';
import { findStale } from '../src/ripple.js';
import { DRAFT_STATEMENT } from '../src/label.js';

const text = renderTeamDemo();
const saved = readFileSync(new URL('../.kiro/reports/team-group-b-run.txt', import.meta.url), 'utf8');

test('design-team B6: the printed run goes through the four agents in order, then the Reviewer, and finishes', () => {
  const steps = [...text.matchAll(/^STEP \d+: ([^(]+) \(/gm)].map((m) => m[1].trim());
  assert.deepEqual(steps, ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Reviewer']);
  assert.match(text, /The run finished\. 28 proposals, 28 versions, every one approved by "scripted answer"\./);
  assert.match(text, /Stale items left at the end: 0/);
  assert.doesNotMatch(text, /THE RUN STOPPED/);
});

test('design-team B6: every proposal line carries a tag, a rule and a scripted answer; the label and draft statement are there', () => {
  const proposals = text.split('\n').filter((l) => /^ {2}Proposal \d+ /.test(l));
  assert.equal(proposals.length, 28);
  for (const l of proposals) assert.match(l, /\[Rule-based\] rule [a-z-]+, confidence (high|low)$/);
  assert.equal(text.split('\n').filter((l) => /scripted answer: option 1/.test(l)).length, 28);
  assert.ok(text.includes(DRAFT_STATEMENT));
  assert.match(text, /a made-up project, not the sample/);
  assert.match(text, /No AI was used\./);
  assert.doesNotMatch(text, /\bunderstand|\bnotice/i, 'nothing is described as understanding or noticing');
});

test('design-team B6: the printout shows a low-confidence proposal with two real options plus Custom', () => {
  const block = text.slice(text.indexOf('rule walls-default-size'));
  const options = block.split('\n').slice(0, 7).filter((l) => /^ {4}Option \d/.test(l));
  assert.deepEqual(options.map((l) => l.replace(/^ +Option \d: /, '')), ['Use the default size (4 by 4 m)', 'Wait until I enter the size', 'Custom']);
});

test('design-team B6: the printout names a threshold under the door between the Kitchen and the Living Room', () => {
  assert.match(text, /Threshold in option 1: water bar under Living room door, between ceramic tile and oak floorboards \(rule thresholds-wet-dry\)/);
});

test('design-team B6: the printout lists every knowledge file with its sources, all marked "not checked", as pending owner check', () => {
  assert.match(text, /pending owner check: none of these sources was opened/);
  const files = [...text.matchAll(/^- ([a-z-]+\/[a-z-]+\.json): /gm)].map((m) => m[1]);
  assert.equal(files.length, 13);
  const sources = text.split('\n').filter((l) => /^ {4}source: /.test(l));
  assert.ok(sources.length >= 13);
  for (const l of sources) assert.match(l, / \| not checked$/);
});

test('design-team B6: the same run twice prints the same text, and the saved printout is up to date', () => {
  assert.equal(renderTeamDemo(), text);
  assert.equal(saved, text + '\n', 'the saved printout is stale. Run: node src/team-demo-print.js > .kiro/reports/team-group-b-run.txt');
});

test('design-team B6: the demo project is not the sample and leaves the sample files alone', () => {
  const { project } = buildDemoProject();
  assert.equal(project.isSample, undefined);
  assert.equal(project.name, 'Made-up test home');
  assert.deepEqual(findStale(project, loadRegistry()).stale, []);
});
