// Task 9: the README explains the 3D room viewer, how to publish it, and that opening the file
// from a folder does not work. Whether the published link opens for a stranger is a pending owner
// check (it needs GitHub Pages switched on).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const section = readme.slice(readme.indexOf('## 3D room viewer'));

test('Task 9: README has a "3D room viewer" section that says what it shows and the export command', () => {
  assert.ok(readme.includes('## 3D room viewer'));
  assert.match(section, /two floors/);
  assert.match(section, /`npm run export-viewer`/);
  assert.match(section, /docs\/sample-run\.json/);
});

test('Task 9: README has the five publishing steps from the design (Settings, Pages, branch, main, /docs)', () => {
  assert.match(section, /1\. On the GitHub page for the project, click \*\*Settings\*\*\./);
  assert.match(section, /2\. In the left list, click \*\*Pages\*\*\./);
  assert.match(section, /3\. Under "Build and deployment", set \*\*Source\*\* to "Deploy from a branch"\./);
  assert.match(section, /4\. Set \*\*Branch\*\* to `main` and the folder to `\/docs`\. Click \*\*Save\*\*\./);
  assert.match(section, /5\. Wait about a minute/);
});

test('Task 9: README gives the expected link and says double-clicking the file does not work', () => {
  assert.match(section, /https:\/\/chaim123456789\.github\.io\/DesignForYou\//);
  assert.match(section, /Double-clicking `docs\/index\.html` on your computer does not work/);
  assert.match(section, /Always open the web link/);
});

test('Task 9: the existing README text is still there', () => {
  for (const kept of ['# DesignForYou', '## How to run the sample', '### Just read the result (no setup)', '### Run it yourself', '### What you should see', '### What is not done yet', 'SAMPLE PROJECT']) {
    assert.ok(readme.includes(kept), `missing: ${kept}`);
  }
});
