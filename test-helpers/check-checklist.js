// Matches every test name quoted in an acceptance checklist against the test files.
// Run with: node test-helpers/check-checklist.js [checklist path]   (it exits with an error if a name is not found)
// With no path it checks the room-viewer checklist, as before. For intake: node test-helpers/check-checklist.js .kiro/specs/intake/acceptance-checklist.md
// Design team (D6, additive): names that start with "design-team " or "D1" to "D6" are read too.
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const names = new Set();
for (const file of readdirSync(new URL('test/', root)).filter((f) => f.endsWith('.test.js'))) {
  const text = readFileSync(new URL(`test/${file}`, root), 'utf8');
  for (const m of text.matchAll(/^\s*test\((['"`])((?:\\.|(?!\1)[^\\])*)\1/gm)) names.add(m[2].replace(/\\(.)/g, '$1'));
}
const checklistPath = process.argv[2] || '.kiro/specs/room-viewer/acceptance-checklist.md';
const checklist = readFileSync(new URL(checklistPath, root), 'utf8');
const quoted = [...checklist.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\\(.)/g, '$1'))
  .filter((q) => /^(Task \d|Step \d|fix-viewer-1:|build-viewer-3 |R\d+\.\d+[: ]|place-items Task \d|Place Task \d|design-team |D\d[: /])/.test(q));
const missing = [...new Set(quoted)].filter((q) => !names.has(q));
console.log(`${checklistPath}: ${new Set(quoted).size} quoted test names checked against ${names.size} tests in test/.`);
if (missing.length) {
  console.error('NOT FOUND:\n' + missing.map((q) => `  ${q}`).join('\n'));
  process.exit(1);
}
console.log('All quoted names match a test.');
