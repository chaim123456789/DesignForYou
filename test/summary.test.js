import test from 'node:test';
import assert from 'node:assert/strict';
import { runSample } from '../src/sample/run-sample.js';
import { makeSummaryHtml, SECTION_HEADINGS } from '../src/summary/make-summary.js';
import { createProject, createItem } from '../src/brain/brain.js';
import { SAMPLE_LABEL, DRAFT_STATEMENT } from '../src/label.js';

const html = () => makeSummaryHtml(runSample().project);

test('R7.5/R10.1: the summary contains the SAMPLE PROJECT label and the draft statement', () => {
  const page = html();
  assert.ok(page.includes(SAMPLE_LABEL));
  assert.ok(page.includes(DRAFT_STATEMENT));
});

test('R10.1: the summary has every section heading', () => {
  const page = html();
  for (const heading of Object.values(SECTION_HEADINGS)) {
    assert.ok(page.includes(`<h2>${heading}</h2>`), `missing heading: ${heading}`);
  }
});

test('R10.1: the summary shows structure, items with status and owner, run log, clash report and versions', () => {
  const page = html();
  for (const text of ['Ground Floor', 'Upper Floor', 'Kitchen', 'Living Room', 'Bedroom', 'Bathroom']) assert.ok(page.includes(text), text);
  assert.ok(page.includes('Oak floor in the kitchen') && page.includes('Locked') && page.includes('Unsure'));
  assert.ok(page.includes('<td>Reviewer</td>'));
  assert.ok(page.includes('Refused'));
  assert.ok(page.includes('2 clashes found'));
  assert.ok(page.includes('Door or window on furniture') && page.includes('Room override against Locked item'));
  assert.ok(page.includes('<th>Version</th>'));
});

test('R10.2: the summary has no raw internal field names or ids', () => {
  // Ignore the style block: its curly brackets are page styling, not text.
  const page = html().replace(/<style>[\s\S]*?<\/style>/, '');
  const banned = [
    'isSample', 'runLog', 'itemId', 'itemStarts', 'createdAtVersion', 'oldValue', 'newValue',
    'styleConflicts', 'reportItemId', 'undefined', 'null', '[object', 'NaN', '{', '}',
  ];
  for (const word of banned) assert.ok(!page.includes(word), `found raw text: ${word}`);
  assert.doesNotMatch(page, /item-\d+/);
  assert.doesNotMatch(page, /floor-\d+/);
  assert.doesNotMatch(page, /room-\d+/);
});

test('the summary does not change the Brain', () => {
  const { project } = runSample();
  const before = structuredClone(project);
  makeSummaryHtml(project);
  assert.deepEqual(project, before);
});

test('a project that is not a sample has no SAMPLE PROJECT label but keeps the draft statement', () => {
  const p = createProject({ name: 'Real Home', floors: [{ name: 'G', rooms: [{ name: 'A' }] }] });
  createItem(p, { kind: 'clash', owner: 'Reviewer', value: { summary: 'No clashes found', clashes: [] } });
  const page = makeSummaryHtml(p);
  assert.ok(!page.includes(SAMPLE_LABEL));
  assert.ok(page.includes(DRAFT_STATEMENT));
  assert.ok(page.includes('No clashes found'));
});

test('text from the project is escaped in the page', () => {
  const p = createProject({ name: '<b>Home</b> & co', floors: [{ name: 'G', rooms: [{ name: 'A' }] }] });
  const page = makeSummaryHtml(p);
  assert.ok(!page.includes('<b>Home</b>'));
  assert.ok(page.includes('&lt;b&gt;Home&lt;/b&gt; &amp; co'));
});
