// Intake 13.3: the README has a "How to use the app" section and says nothing out of date.
// This test proves the section exists and covers the app; whether it reads clearly to a person is for the owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

const sectionOf = (text) => {
  const start = text.search(/^## How to use the app\s*$/m);
  if (start === -1) return null;
  const rest = text.slice(start + 1);
  const next = rest.search(/^## /m);
  return rest.slice(0, next === -1 ? undefined : next);
};

const OUT_OF_DATE = [
  [/intake[^.\n]{0,40}in progress/i, 'says the intake is in progress'],
  [/in progress/i, 'says something is in progress'],
  [/only the sample/i, 'says "only the sample"'],
  [/only displays what the sample run produced/i, 'says the page only shows the sample run'],
  [/intake screens? (?:are |is )?(?:not|still) (?:built|done|ready)/i, 'says the intake screens are not built'],
];
const outOfDate = (text) => OUT_OF_DATE.filter(([re]) => re.test(text)).map(([, why]) => why);

test('Intake 13.3: the README has a "How to use the app" section with the start screen, the seven steps and the result', () => {
  const section = sectionOf(readme);
  assert.ok(section, 'the heading "## How to use the app" exists');
  assert.ok(section.length > 800, 'the section has real content');
  assert.match(section, /"Try the sample"/);
  assert.match(section, /"Start my own project"/);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) assert.match(section, new RegExp(`^${n}\\. `, 'm'), `step ${n} is listed`);
  for (const word of ['Project setup', 'Overall inspiration', 'Room overrides', 'Your brief', 'Taste questions', 'Your items', 'Place furniture, doors and windows', 'Review and run']) {
    assert.ok(section.includes(word), `the step "${word}" is named`);
  }
  assert.match(section, /"Run the design team"/);
  assert.match(section, /"Start again"/);
  assert.match(section, /SAMPLE PROJECT/);
  assert.match(section, /YOUR PROJECT/);
  assert.match(section, /Nothing is saved and nothing leaves your browser/);
  assert.match(section, /fixed rules, not AI/);
  assert.match(readme, /draft/i);
});

test('Intake 13.3: the README no longer says anything out of date (no "in progress", no "only the sample")', () => {
  assert.deepEqual(outOfDate(readme), []);
});

test('Intake 13.3: the README checks fail when the section is missing or an old sentence comes back (planted changes in copies)', () => {
  assert.equal(sectionOf(readme.replace('## How to use the app', '## Using it')), null);
  assert.deepEqual(outOfDate(readme + '\nThe intake screens are in progress.\n'), ['says the intake is in progress', 'says something is in progress']);
  assert.deepEqual(outOfDate(readme + '\nThe page shows only the sample.\n'), ['says "only the sample"']);
  assert.deepEqual(outOfDate(readme + '\nThe page only displays what the sample run produced.\n'), ['says the page only shows the sample run']);
});
