import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUESTIONS, NO_PROFILE_MESSAGE, buildProfile } from '../docs/intake/taste.js';

const everyAnswer = () => Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answers[0].id]));

test('Task 3: there are exactly 6 questions, each with 2 or 3 answers', () => {
  assert.equal(QUESTIONS.length, 6);
  for (const q of QUESTIONS) assert.ok(q.answers.length === 2 || q.answers.length === 3, q.id);
});

test('Task 3: the six questions cover light/dark, soft/high contrast, classic/trend, durable/showpiece, warm/cool, calm/lively', () => {
  const text = QUESTIONS.map((q) => q.label.toLowerCase());
  const expected = [/light.*dark/, /soft.*high contrast/, /classic.*trend/, /durable.*showpiece/, /warm.*cool/, /calm.*lively/];
  expected.forEach((pattern, i) => assert.match(text[i], pattern));
});

test('Task 3: question ids are unique, answer ids are unique within a question, every answer has a label, tag and sentence', () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, 6);
  const tags = [];
  for (const q of QUESTIONS) {
    assert.equal(new Set(q.answers.map((a) => a.id)).size, q.answers.length);
    for (const a of q.answers) {
      for (const field of ['label', 'tag', 'sentence']) assert.ok(typeof a[field] === 'string' && a[field].length > 0, `${q.id}/${a.id}/${field}`);
      tags.push(a.tag);
    }
  }
  assert.equal(new Set(tags).size, tags.length, 'a tag is used by two answers');
});

test('Task 3: the same answers give the same profile (run twice, deep-equal)', () => {
  const answers = { light: 'light', contrast: 'soft', temperature: 'warm' };
  assert.deepEqual(buildProfile(answers), buildProfile(answers));
  assert.deepEqual(buildProfile(everyAnswer(), ['calm']), buildProfile(everyAnswer(), ['calm']));
});

test('Task 3: the order of the keys in the answers does not change the profile', () => {
  const a = buildProfile({ temperature: 'warm', light: 'light' });
  const b = buildProfile({ light: 'light', temperature: 'warm' });
  assert.deepEqual(a, b);
  assert.deepEqual(a.tags, ['light', 'warm']);
});

test('Task 3: skipped questions are left out (missing, empty, null or unknown answers)', () => {
  const p = buildProfile({ light: 'dark', contrast: '', era: null, wear: 'nonsense', nosuchquestion: 'x' });
  assert.deepEqual(p.tags, ['dark']);
  assert.equal(p.sentences.length, 2); // one line for the one answer, one summary line
  assert.equal(p.sentences[0], 'You like dark rooms.');
});

test('Task 3: a profile has a sentence per answer, a summary sentence and a tag per answer', () => {
  const p = buildProfile(everyAnswer());
  assert.equal(p.hasProfile, true);
  assert.equal(p.tags.length, 6);
  assert.equal(p.sentences.length, 7);
  assert.match(p.sentences.at(-1), /^In short: /);
  assert.equal(p.message, '');
});

test('Task 3: removed tags are absent from the tags, the sentences and the summary', () => {
  const p = buildProfile({ light: 'light', contrast: 'soft', temperature: 'warm' }, ['soft contrast']);
  assert.deepEqual(p.tags, ['light', 'warm']);
  assert.ok(!p.sentences.some((s) => /soft contrast/i.test(s)));
  assert.equal(p.sentences.at(-1), 'In short: light, warm.');
  // Removing a tag that is not in the profile changes nothing.
  assert.deepEqual(buildProfile({ light: 'light' }, ['not a tag']), buildProfile({ light: 'light' }));
});

test('Task 3: no answers gives "No style profile yet" and no tags', () => {
  for (const answers of [{}, undefined, null, { light: '' }]) {
    const p = buildProfile(answers);
    assert.equal(p.hasProfile, false);
    assert.equal(p.message, 'No style profile yet');
    assert.deepEqual(p.tags, []);
    assert.deepEqual(p.sentences, []);
  }
  assert.equal(NO_PROFILE_MESSAGE, 'No style profile yet');
});

test('Task 3: removing every tag gives "No style profile yet" again', () => {
  const p = buildProfile({ light: 'light', temperature: 'warm' }, ['light', 'warm']);
  assert.equal(p.hasProfile, false);
  assert.deepEqual(p.tags, []);
});

test('Task 3: buildProfile does not change its inputs', () => {
  const answers = { light: 'light' };
  const removed = ['warm'];
  buildProfile(answers, removed);
  assert.deepEqual(answers, { light: 'light' });
  assert.deepEqual(removed, ['warm']);
});

test('Task 3: no sentence, label or tag says or suggests AI, analysis, understanding or detection', () => {
  const words = /\bAI\b|\bA\.I\.|artificial|analys|analyz|understand|understood|detect|recogni[sz]|learn|intelligen|algorithm|predict|machine/i;
  const all = [];
  for (const q of QUESTIONS) {
    all.push(q.label);
    for (const a of q.answers) all.push(a.label, a.tag, a.sentence);
  }
  all.push(NO_PROFILE_MESSAGE, ...buildProfile(everyAnswer()).sentences);
  const hits = all.filter((t) => words.test(t));
  assert.deepEqual(hits, []);
});

test('Task 3: the file uses no randomness, clock, network or storage (code search)', () => {
  const code = readFileSync(new URL('../docs/intake/taste.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /Math\.random|Date\.|crypto|fetch|localStorage|sessionStorage|indexedDB|document\./);
});
