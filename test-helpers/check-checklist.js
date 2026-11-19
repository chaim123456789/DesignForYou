// Matches every test name quoted in the room-viewer acceptance checklist against the test files.
// Run with: node test-helpers/check-checklist.js   (it exits with an error if a name is not found)
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const names = new Set();
for (const file of readdirSync(new URL('test/', root)).filter((f) => f.endsWith('.test.js'))) {
  const text = readFileSync(new URL(`test/${file}`, root), 'utf8');
  for (const m of text.matchAll(/^\s*test\((['"`])((?:\\.|(?!\1)[^\\])*)\1/gm)) names.add(m[2].replace(/\\(.)/g, '$1'));
}
const checklist = readFileSync(new URL('.kiro/specs/room-viewer/acceptance-checklist.md', root), 'utf8');
const quoted = [...checklist.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\\(.)/g, '$1'))
  .filter((q) => /^(Task \d|Step \d|fix-viewer-1:|build-viewer-3 |R\d+\.\d+:)/.test(q));
const missing = [...new Set(quoted)].filter((q) => !names.has(q));
console.log(`${new Set(quoted).size} quoted test names checked against ${names.size} tests in test/.`);
if (missing.length) {
  console.error('NOT FOUND:\n' + missing.map((q) => `  ${q}`).join('\n'));
  process.exit(1);
}
console.log('All quoted names match a test.');
