import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/brain/brain.js';
import { loadSampleProject, readSampleData } from '../src/sample/run-sample.js';

const base = () => ({ name: 'Test', floors: [{ name: 'Ground', rooms: [{ name: 'Kitchen' }] }] });

test('Task 4a: a project made without the optional fields has none of them (nothing added)', () => {
  const project = createProject(base());
  assert.equal('brief' in project, false);
  assert.equal('styleProfile' in project, false);
  assert.equal('imageCount' in project, false);
  assert.deepEqual(Object.keys(project), ['name', 'inspiration', 'floors', 'items', 'itemStarts', 'versions', 'runLog']);
});

test('Task 4a: the sample project has no optional fields, so the sample is unchanged', () => {
  const project = loadSampleProject(readSampleData());
  for (const key of ['brief', 'styleProfile', 'imageCount']) assert.equal(key in project, false, key);
});

test('Task 4a: brief, styleProfile and imageCount are kept when given', () => {
  const project = createProject({ ...base(), brief: 'A calm home.', styleProfile: ['You like light rooms.'], imageCount: 3 });
  assert.equal(project.brief, 'A calm home.');
  assert.deepEqual(project.styleProfile, ['You like light rooms.']);
  assert.equal(project.imageCount, 3);
});

test('Task 4a: an empty brief, an empty profile and zero images are allowed', () => {
  const project = createProject({ ...base(), brief: '', styleProfile: [], imageCount: 0 });
  assert.equal(project.brief, '');
  assert.deepEqual(project.styleProfile, []);
  assert.equal(project.imageCount, 0);
});

test('Task 4a: wrong types for the optional fields are refused with a plain message', () => {
  assert.throws(() => createProject({ ...base(), brief: 5 }), /brief must be text/);
  assert.throws(() => createProject({ ...base(), styleProfile: 'x' }), /list of sentences/);
  assert.throws(() => createProject({ ...base(), styleProfile: [1] }), /list of sentences/);
  assert.throws(() => createProject({ ...base(), imageCount: -1 }), /whole number/);
  assert.throws(() => createProject({ ...base(), imageCount: 1.5 }), /whole number/);
});

test('Task 4a: the styleProfile list is copied, so changing the input later does not change the project', () => {
  const sentences = ['You like light rooms.'];
  const project = createProject({ ...base(), styleProfile: sentences });
  sentences.push('changed');
  assert.deepEqual(project.styleProfile, ['You like light rooms.']);
});
