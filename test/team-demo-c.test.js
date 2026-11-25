// design-team Group C, Task C6: the checkpoint run, printed as plain text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGroupCDemo, buildGroupCProject, groupCKnowledgeFiles } from '../src/team-demo-c.js';
import { DRAFT_STATEMENT } from '../src/label.js';

const text = renderGroupCDemo();
const saved = readFileSync(new URL('../.kiro/reports/team-group-c-run.txt', import.meta.url), 'utf8');

test('design-team C6: the printed run goes through all eight agents in order and both runs finish', () => {
  const run1 = [...text.matchAll(/^Run 1 STEP \d+: ([^(]+) \(first pass\)/gm)].map((m) => m[1].trim());
  assert.deepEqual(run1, ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer']);
  assert.match(text, /Run 1 finished: \d+ proposals, \d+ versions\./);
  assert.match(text, /Run 2 finished: \d+ new versions\./);
  assert.doesNotMatch(text, /THE RUN STOPPED/);
});

test('design-team C6: every proposal line carries a tag, a rule and a scripted answer; the draft statement and "not the sample" are there', () => {
  const proposals = text.split('\n').filter((l) => /^ {2}Proposal \d+ /.test(l));
  assert.ok(proposals.length >= 25);
  for (const l of proposals) assert.match(l, /\[Rule-based\] rule [a-z-]+, confidence (high|low)(, REQUEST to Walls)?$/);
  assert.equal(text.split('\n').filter((l) => /^ {4}scripted answer: /.test(l)).length, proposals.length);
  assert.ok(text.includes(DRAFT_STATEMENT));
  assert.match(text, /a made-up project, not the sample/);
  assert.match(text, /No AI was used\./);
  assert.doesNotMatch(text, /\bunderstand|\bnotice/i, 'nothing is described as understanding or noticing');
});

test('design-team C6: the printout shows the request to Walls, a skipped suggestion, a low-confidence proposal and the Locked desk left alone', () => {
  assert.match(text, /REQUEST to Walls/);
  assert.match(text, /scripted answer: SKIP \(kept as is\) -> nothing changed/);
  const low = text.slice(text.indexOf('confidence low'));
  assert.match(low, /Option 1: [^\n]+\n {4}Option 2: [^\n]+\n {4}Option 3: Custom/);
  assert.match(text, /The Locked desk was not changed: it is still at x 4\.6, y 3\./);
  assert.match(text, /The Locked desk is Locked and out of date with earlier work\. It was not changed\. Please take a look\./);
  assert.match(text, /No clashes found|findings found, using these checks:/);
});

test('design-team C6: the printout lists every Group C knowledge file with its sources, all marked "not checked", as pending owner check', () => {
  assert.match(text, /pending owner check: none of these sources was opened/);
  const files = [...text.matchAll(/^- ([a-z-]+\/[a-z-]+\.json): /gm)].map((m) => m[1]);
  assert.deepEqual(files, groupCKnowledgeFiles());
  assert.equal(files.length, 11);
  const folders = new Set(files.map((f) => f.split('/')[0]));
  assert.deepEqual([...folders].sort(), ['decor', 'furniture', 'reviewer', 'style']);
  const sources = text.split('\n').filter((l) => /^ {4}source: /.test(l));
  assert.ok(sources.length >= 11);
  for (const l of sources) assert.match(l, / \| not checked$/);
  // every knowledge file of those four folders is listed: none is left out
  const dir = fileURLToPath(new URL('../src/knowledge/', import.meta.url));
  const onDisk = ['decor', 'furniture', 'reviewer', 'style'].flatMap((d) => readdirSync(path.join(dir, d)).filter((n) => n.endsWith('.json') && statSync(path.join(dir, d, n)).isFile()).map((n) => `${d}/${n}`)).sort();
  assert.deepEqual(files.slice().sort(), onDisk);
});

test('design-team C6: the same run twice prints the same text, and the saved printout is up to date', () => {
  assert.equal(renderGroupCDemo(), text);
  assert.equal(saved, text, 'the saved printout is stale. Run: node src/team-demo-c-print.js > .kiro/reports/team-group-c-run.txt');
});

test('design-team C6: the demo project is not the sample', () => {
  const { project } = buildGroupCProject();
  assert.equal(project.isSample, undefined);
  assert.equal(project.name, 'Made-up two-room home');
});
