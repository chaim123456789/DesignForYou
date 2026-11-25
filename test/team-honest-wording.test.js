// Design-team D3: honest wording everywhere (R8.1 to R8.5, R4.8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from '../src/brain/brain.js';
import { setProjectInspiration } from '../src/brain/inspiration.js';
import { createRun, runWithScript } from '../src/team-coordinator.js';
import { createGate, loadBudget } from '../src/ai/gate.js';
import { standInProvider } from '../src/ai/stand-in.js';
import { makeTeamStyleAgent, loadStyleKnowledge } from '../src/agents/team-style/agent.js';
import { buildGroupCProject, groupCAgents, runScripted } from '../src/team-demo-c.js';
import { loadRegistry } from '../src/agents/registry.js';
import { makeSummaryHtml } from '../src/summary/make-summary.js';
import {
  DRAFT_STATEMENT, SAMPLE_LABEL, TEAM_SENTENCE_AI_OFF, TEAM_SENTENCE_AI_ON, SCRIPTED_SENTENCE, taggedLine, describeTeamRun,
} from '../src/label.js';
import { FIXED_SENTENCE, buildTeamReport, buildReport } from '../docs/intake/report.js';
import { buildLater, off, registry as reg, NOW } from '../test-helpers/team-project.js';

const registry = loadRegistry();
const emptyState = (extra = {}) => ({ overall: { notes: [], images: [] }, overrides: {}, items: [], tasteAnswers: {}, removedTags: [], ...extra });
const teamRun = () => { const { project, skipId } = buildGroupCProject(); runScripted(project, { agents: groupCAgents(registry), registry, skipItemId: skipId }); return project; };
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// A run where the stand-in AI judged taste for one close call.
function aiRun(capUsd) {
  const k = loadStyleKnowledge();
  const t = buildLater({ rooms: [{ name: 'Living Room', width: 4, depth: 3 }], openings: [] });
  setProjectInspiration(t.project, ['warm oak']);
  createItem(t.project, { kind: 'style', owner: 'Style', room: 'floor-1-room-1', value: { name: 'Wall finish', tag: 'cold steel', detail: 'Brushed steel panels' } });
  const gate = createGate({ budget: { ...loadBudget(), capUsd }, provider: standInProvider, vocabulary: k.families.flatMap((f) => f.then.tags) });
  const r = runWithScript(t.project, { registry: reg, now: NOW, agents: { Style: makeTeamStyleAgent(k, { gate }) }, configs: off(['Walls', 'Doors and windows', 'Floors and ceilings', 'Lighting and electrical', 'Furniture', 'Decor']) });
  assert.equal(r.ok, true);
  return t.project;
}

test('D3 / R8.1: every proposal line in the team summary carries a Rule-based or AI tag', () => {
  const project = teamRun();
  const team = describeTeamRun(project);
  const proposed = team.rows.filter((r) => r.event === 'proposed');
  assert.ok(proposed.length > 10);
  for (const r of team.rows) assert.match(r.tag, /^(Rule-based|AI)$/, `row ${r.number} has a tag`);
  const html = makeSummaryHtml(project);
  const logTable = html.slice(html.indexOf('<h2>Run log</h2>'), html.indexOf('<h2>Clash report</h2>'));
  assert.match(logTable, /<th>Where it came from<\/th>/);
  const rows = logTable.split('<tr>').slice(2); // after the table start and the header row
  assert.equal(rows.length, project.runLog.length);
  for (const row of rows) assert.match(row, /<td>(Rule-based|AI)<\/td>/);
  const versions = html.slice(html.indexOf('<h2>Version history</h2>'));
  assert.match(versions, /<th>Where it came from<\/th><th>Approved by<\/th>/);
  assert.equal((versions.match(/<td>scripted answer<\/td>/g) || []).length, project.versions.length, 'each version says who approved it');
});

test('D3 / R8.1: every line of the team report carries a tag', () => {
  const report = buildTeamReport(emptyState(), { ok: true, project: teamRun() });
  const lines = [...report.lists.flatMap((l) => l.lines), report.clashLine];
  assert.ok(lines.length > 5);
  for (const line of lines) assert.match(line, /^(Rule-based|AI): /, line);
});

test('D3 / R8.2: the fixed sentence of R8.2 is shown, and the old sentence stays while AI is off', () => {
  const project = teamRun();
  const report = buildTeamReport(emptyState(), { ok: true, project });
  assert.equal(report.sentence, FIXED_SENTENCE, 'the old sentence stays while the cap is zero');
  assert.equal(report.teamSentences[0], TEAM_SENTENCE_AI_OFF);
  assert.match(TEAM_SENTENCE_AI_OFF, /fixed rules and knowledge files \(Rule-based\)/);
  assert.match(TEAM_SENTENCE_AI_OFF, /reading a photo and judging taste/);
  assert.match(TEAM_SENTENCE_AI_OFF, /AI is off/);
  assert.match(TEAM_SENTENCE_AI_ON, /marked AI came through the AI gate/);
  assert.doesNotMatch(TEAM_SENTENCE_AI_ON, /AI is off/);
  assert.ok(textOf(makeSummaryHtml(project)).includes(TEAM_SENTENCE_AI_OFF));
});

test('D3 / R4.8: "scripted answer" is shown for scripted runs, and not for runs answered by a person', () => {
  const scripted = teamRun();
  assert.ok(describeTeamRun(scripted).scripted);
  assert.ok(textOf(makeSummaryHtml(scripted)).includes(SCRIPTED_SENTENCE));
  assert.ok(buildTeamReport(emptyState(), { ok: true, project: scripted }).used.some((l) => /scripted answer/.test(l)));

  const { project } = buildGroupCProject();
  const run = createRun(project, { registry, now: NOW, agents: groupCAgents(registry) }); // no scripted flag: a person answers
  for (let s = run.next(); !s.done; s = run.next()) for (const p of s.proposals) run.answer(p.id, p.options[0].id);
  const byPerson = describeTeamRun(project);
  assert.equal(byPerson.scripted, false);
  assert.doesNotMatch(textOf(makeSummaryHtml(project)), /scripted answer/);
  assert.ok(byPerson.rows.some((r) => /answered by user/.test(r.details)));
});

test('D3 / R8.5: "understand" and "notice" never appear when AI was not used, and only next to an AI result when it was', () => {
  const noAi = teamRun();
  const words = /understand|notice/i;
  assert.doesNotMatch(textOf(makeSummaryHtml(noAi)), words);
  const rep = buildTeamReport(emptyState(), { ok: true, project: noAi });
  assert.doesNotMatch(JSON.stringify(rep), words);
  assert.doesNotMatch(TEAM_SENTENCE_AI_OFF + TEAM_SENTENCE_AI_ON + SCRIPTED_SENTENCE, words);
  // With AI on, the same holds: the wording of the team never uses those words, so none can sit next to a rule-based line.
  const ai = aiRun(1);
  assert.doesNotMatch(textOf(makeSummaryHtml(ai)), words);
  assert.doesNotMatch(JSON.stringify(buildTeamReport(emptyState(), { ok: true, project: ai })), words);
});

test('D3 / R8.3: an AI result says which task it was and what it cost, with the stand-in label', () => {
  const project = aiRun(1);
  const team = describeTeamRun(project);
  assert.equal(team.aiUsed, true);
  const row = team.rows.find((r) => r.event === 'proposed' && r.source === 'ai');
  assert.equal(row.tag, 'AI');
  assert.match(row.details, /AI task judge-taste, cost \$0\.005 \(stand-in, not a real model\)/);
  assert.equal(team.sentences[0], TEAM_SENTENCE_AI_ON);
  const rep = buildTeamReport(emptyState(), { ok: true, project });
  assert.ok(rep.used.some((l) => l.startsWith('AI: ') && /judge-taste, cost \$0\.005/.test(l)));
  assert.ok(team.versionSources.includes('ai'), 'the version made by the AI proposal is tagged AI');
  assert.ok(textOf(makeSummaryHtml(project)).includes('judge-taste'));
});

test('D3 / R8.3: with the cap at zero, the summary and report say AI was not used', () => {
  const project = aiRun(0);
  const team = describeTeamRun(project);
  assert.equal(team.aiUsed, false);
  assert.ok(team.rows.some((r) => r.event === 'note' && /AI was not used: AI is off/.test(r.details)));
  const rep = buildTeamReport(emptyState(), { ok: true, project });
  assert.ok(rep.used.some((l) => /^Rule-based: Style made 3 proposals from fixed rules/.test(l)));
  assert.ok(rep.used.some((l) => /^Rule-based: AI was not used\./.test(l)));
});

test('D3 / R8.4: the draft statement is on every team output, and the sample label stays on a sample', () => {
  const project = teamRun();
  const html = makeSummaryHtml(project);
  assert.equal(html.split(DRAFT_STATEMENT).length - 1, 2, 'top and bottom');
  assert.ok(!html.includes(SAMPLE_LABEL));
  project.isSample = true;
  const sample = makeSummaryHtml(project);
  assert.equal(sample.split(SAMPLE_LABEL).length - 1 >= 2, true);
  assert.equal(sample.split(DRAFT_STATEMENT).length - 1, 2);
});

test('D3: images are still said to be not looked at while AI is off, and the old report is unchanged for the old pipeline', () => {
  const project = teamRun();
  project.imageCount = 2;
  project.brief = 'A calm home';
  const rep = buildTeamReport(emptyState(), { ok: true, project });
  assert.ok(rep.keptNotRead.some((l) => /Your 2 images.*were not looked at, because AI is off/.test(l)));
  assert.ok(rep.keptNotRead.some((l) => /Your brief.*was not read/.test(l)));
  assert.equal(taggedLine('ai', 'x'), 'AI: x');
  assert.throws(() => taggedLine('guess', 'x'), /no tag/);
  assert.equal(buildTeamReport(emptyState(), null), null);
  assert.equal(typeof buildReport, 'function');
});

test('D3: a run of the old four-agent pipeline has no design-team wording, so its output is unchanged', async () => {
  const { runSample } = await import('../src/sample/run-sample.js');
  const sample = runSample();
  const project = sample.project || sample;
  assert.equal(describeTeamRun(project), null);
  assert.doesNotMatch(makeSummaryHtml(project), /Where it came from|fixed rules and knowledge files/);
});
