import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_LABEL, DRAFT_STATEMENT } from '../src/label.js';

const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const sampleRun = JSON.parse(read('sample-run.json'));

// The text of the elements with a given class inside one block of the page.
const block = (tag) => {
  const m = html.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`));
  assert.ok(m, `no <${tag}> block found`);
  return m[0];
};
const textOfClass = (source, cls) =>
  [...source.matchAll(new RegExp(`<p class="${cls}">([^<]*)</p>`, 'g'))].map((m) => m[1]);

test('Task 4: SAMPLE PROJECT and the draft statement on the page equal src/label.js, top and bottom, outside the 3D area', () => {
  for (const [name, part] of [['top', block('header')], ['bottom', block('footer')]]) {
    assert.deepEqual(textOfClass(part, 'label-sample'), [SAMPLE_LABEL], `${name} bar sample label`);
    assert.deepEqual(textOfClass(part, 'label-draft'), [DRAFT_STATEMENT], `${name} bar draft statement`);
  }
  const scene = html.match(/<div id="scene-area"[^>]*>[\s\S]*?<\/div>/);
  assert.ok(scene, 'the 3D area element is missing');
  assert.ok(!scene[0].includes(SAMPLE_LABEL));
  assert.ok(!scene[0].includes(DRAFT_STATEMENT));
  assert.ok(!/<(header|footer)/.test(scene[0]));
  // The two bars are not inside the 3D area: the area comes after the header and before the footer.
  assert.ok(html.indexOf('</header>') < html.indexOf('id="scene-area"'));
  assert.ok(html.indexOf('id="scene-area"') < html.indexOf('<footer'));
});

test('Task 4: the content security rule is present', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  assert.ok(m, 'no content security rule');
  assert.match(m[1], /default-src 'self'/);
  assert.doesNotMatch(m[1], /unsafe-inline|unsafe-eval|https?:/);
  // No inline script: every script tag points to a file.
  for (const tag of html.match(/<script[^>]*>/g) || []) assert.match(tag, /src="[^"]+"/);
});

test('Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files', () => {
  for (const name of ['index.html', 'viewer.js', 'scene-data.js']) {
    const text = read(name);
    for (const banned of ['http://', 'https://', 'localStorage', '<form', 'type="file"', 'eval(', 'innerHTML']) {
      assert.ok(!text.includes(banned), `${name} contains ${banned}`);
    }
  }
});

test('Task 4: the slider range matches the version count', () => {
  const slider = html.match(/<input type="range"[^>]*>/);
  assert.ok(slider, 'no range input');
  assert.match(slider[0], /min="0"/);
  assert.match(slider[0], new RegExp(`max="${sampleRun.versions.length}"`));
  assert.match(slider[0], new RegExp(`value="${sampleRun.versions.length}"`));
  assert.match(read('viewer.js'), /slider\.max = String\(last\)/);
});
