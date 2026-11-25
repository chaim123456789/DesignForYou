// Design-team D6: the sample now runs through the eight-agent design team with scripted answers (R11.4, R12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTeamSample, makeTeamSampleRun, readTeamSampleData } from '../src/sample/run-team-sample.js';
import { makeSummaryHtml } from '../src/summary/make-summary.js';
import { SAMPLE_LABEL, DRAFT_STATEMENT, TEAM_SENTENCE_AI_OFF, SCRIPTED_SENTENCE } from '../src/label.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const ORDER = ['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor', 'Style', 'Reviewer'];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

test('D6 / R11.4: the sample runs through the eight agents in order, with scripted answers, and finishes', () => {
  const { project, result, run, team } = runTeamSample();
  assert.deepEqual(result, { ok: true });
  const firsts = run.steps.filter((s) => s.kind === 'first').map((s) => s.agent);
  assert.deepEqual(firsts, ORDER);
  assert.ok(run.steps.some((s) => s.kind === 'recheck'), 'a wall request ripples into a re-check pass');
  assert.equal(project.isSample, true);
  assert.ok(project.versions.length > 20);
  assert.ok(project.versions.every((v) => v.approvedBy === 'scripted answer'));
  assert.deepEqual(team.agents.map((a) => a.name), ORDER);
  assert.equal(team.scripted, true);
  assert.equal(team.aiUsed, false);
});

test('D6: the sample shows a request to Walls, one skipped suggestion ("kept as is"), and the Locked items unchanged', () => {
  const data = readTeamSampleData();
  const { project, run } = runTeamSample();
  const proposals = run.steps.flatMap((s) => s.proposals);
  assert.ok(proposals.some(({ proposal }) => proposal.request && proposal.request.owner === 'Walls'), 'Furniture asks Walls');
  const skipped = run.keptAsIs.map((k) => project.items.find((i) => i.id === k.itemId).value.name);
  assert.deepEqual([...new Set(skipped)], [data.script.skip.itemName], "only the sofa is skipped (in the first pass and in its re-check)");
  for (const locked of project.items.filter((i) => i.status === 'Locked')) {
    assert.ok(!project.versions.some((v) => v.item === locked.id), `${locked.value.name} was never changed`);
  }
  const report = project.items.find((i) => i.kind === 'clash').value;
  assert.ok(report.clashes.some((c) => /needs your look|Please take a look/.test(c.description)), 'the Locked bed that is out of date is reported');
  assert.ok(report.clashes.every((c) => c.tag === 'Rule-based'));
});

test('D6 / R11.2: running the sample twice gives the same sample file', () => {
  assert.deepEqual(makeTeamSampleRun(), makeTeamSampleRun());
});

test('D6: sample-summary.html equals a fresh summary of the design-team sample, with the labels, the team sentence and "scripted answer"', () => {
  const onDisk = readFileSync(new URL('../sample-summary.html', import.meta.url), 'utf8');
  const { project } = runTeamSample();
  assert.equal(onDisk, makeSummaryHtml(project));
  assert.ok(onDisk.split(SAMPLE_LABEL).length - 1 >= 2, 'SAMPLE PROJECT at the top and bottom');
  assert.equal(onDisk.split(DRAFT_STATEMENT).length - 1, 2);
  assert.ok(onDisk.includes(TEAM_SENTENCE_AI_OFF));
  assert.ok(onDisk.includes(SCRIPTED_SENTENCE.replace(/"/g, '&quot;')));
  assert.doesNotMatch(onDisk.replace(/<[^>]*>/g, ' '), /understand|notice/i);
});

test('D6 / R12: .kiro is not in .gitignore, LICENSE is unchanged, package.json is unchanged, and the old sample files are kept', () => {
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.doesNotMatch(ignore, /\.kiro/);
  const base = git('merge-base', 'HEAD', 'origin/main').trim();
  assert.equal(git('diff', base, '--', 'LICENSE'), '', 'LICENSE unchanged');
  assert.equal(git('diff', base, '--', 'package.json'), '', 'package.json unchanged');
  assert.equal(git('diff', base, '--', 'src/sample/sample-project.json'), '', 'the old sample data is kept as it was');
  for (const f of ['src/agents/layout/agent.js', 'src/agents/builder/agent.js', 'src/coordinator.js', 'src/sample/run-sample.js']) {
    assert.ok(readFileSync(new URL(`../${f}`, import.meta.url)), `${f} is kept (deleting needs the owner's yes)`);
  }
});

test('D6: the page code uses the cache tag build-team-4 everywhere', () => {
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  for (const f of ['styles.css', 'viewer.js', 'intake/screens.js']) assert.match(html, new RegExp(`${f.replace('.', '\\.')}\\?v=build-team-4`));
  assert.match(readFileSync(new URL('../docs/viewer.js', import.meta.url), 'utf8'), /const PAGE_VERSION = 'build-team-4'/);
  assert.match(readFileSync(new URL('../docs/intake/screens.js', import.meta.url), 'utf8'), /const PAGE_VERSION = 'build-team-4'/);
  assert.doesNotMatch(html, /v=build-(?!team-4)/);
});
