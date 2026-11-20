import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  // The one allowed exception is the import map (Task 5), and only if its exact text is named by hash in the rule.
  for (const tag of (html.match(/<script[^>]*>/g) || []).filter((t) => !/type="importmap"/.test(t))) {
    assert.match(tag, /src="[^"]+"/);
  }
});

test('Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files', () => {
  for (const name of ['index.html', 'viewer.js', 'scene-data.js']) {
    const text = read(name);
    for (const banned of ['http://', 'https://', 'localStorage', '<form', 'eval(', 'innerHTML']) {
      assert.ok(!text.includes(banned), `${name} contains ${banned}`);
    }
    // Approved change (intake Task 8): exactly ONE file input is allowed, only in index.html, and it needs a visible label.
    const fileInputs = text.match(/type="file"/g) || [];
    assert.equal(fileInputs.length, name === 'index.html' ? 1 : 0, `${name} has ${fileInputs.length} file inputs`);
    if (name === 'index.html') {
      const id = text.match(/<input type="file" id="([^"]+)"/);
      assert.ok(id, 'the file input has an id');
      assert.match(text, new RegExp(`<label for="${id[1]}">[^<]+</label>`), 'the file input has a visible label');
      assert.ok(text.indexOf('id="screen-inspiration"') < text.indexOf('type="file"') && text.indexOf('type="file"') < text.indexOf('id="screen-overrides"'), 'the file input is on the Inspiration screen');
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

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const vendorDir = new URL('../docs/vendor/', import.meta.url);

test('Task 5: package.json has no dependencies or devDependencies, and there is no node_modules folder', () => {
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(existsSync(new URL('../node_modules', import.meta.url)), false);
});

test('Task 5: docs/vendor holds exactly the approved files', () => {
  assert.deepEqual(readdirSync(vendorDir).sort(), ['LICENSE', 'OrbitControls.js', 'VERSION.txt', 'three.core.js', 'three.module.js']);
});

test('Task 5: VERSION.txt names the version and the MIT licence file is present', () => {
  const version = readFileSync(new URL('VERSION.txt', vendorDir), 'utf8');
  assert.match(version, /0\.186\.1/);
  assert.match(version, /registry\.npmjs\.org/);
  assert.match(readFileSync(new URL('LICENSE', vendorDir), 'utf8'), /^The MIT License/);
});

test('Task 5: the import map points only to files inside docs/vendor/, and the content security rule names its hash', () => {
  const tags = [...html.matchAll(/<script type="importmap">([^<]*)<\/script>/g)];
  assert.equal(tags.length, 1);
  const map = JSON.parse(tags[0][1]);
  const targets = Object.values(map.imports);
  assert.ok(targets.length >= 1);
  for (const target of targets) {
    assert.match(target, /^\.\/vendor\/[A-Za-z.]+\.js$/);
    assert.ok(existsSync(new URL(target.slice(2), new URL('../docs/', import.meta.url))), `${target} is missing`);
  }
  const hash = createHash('sha256').update(tags[0][1]).digest('base64');
  assert.ok(html.includes(`script-src 'self' 'sha256-${hash}'`), 'the content security rule must name the import map hash');
  assert.ok(!html.includes("'unsafe-inline'"));
});

test('Task 7: the details panel code fills the panel with textContent only, and has no editing controls', () => {
  const script = read('viewer.js');
  const functionBody = (name) => {
    const start = script.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `function ${name} not found`);
    const end = script.indexOf('\nfunction ', start + 1);
    return script.slice(start, end === -1 ? undefined : end);
  };
  for (const name of ['showDetails', 'closePanel']) {
    const body = functionBody(name);
    assert.match(body, /textContent/, `${name} should use textContent`);
    assert.doesNotMatch(body, /createElement\('(input|textarea|select|button|form)'\)/, `${name} must not add editing controls`);
  }
  // No way anywhere in the page script to turn text into markup.
  for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'DOMParser', 'createContextualFragment']) {
    assert.ok(!script.includes(banned), `viewer.js uses ${banned}`);
  }
  // The page has no editing controls in the details area either.
  const panel = html.match(/<section id="details-panel"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(panel, /<(input|textarea|select|button|form)\b/);
});
