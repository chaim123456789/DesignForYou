// Runs the sample through the eight-agent design team and writes docs/sample-run.json,
// the one file the 3D viewer page reads. Run it with: npm run export-viewer
// Uses no network. Never edits the Brain or sample-project.json.
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTeamSample, makeTeamSampleRun } from '../sample/run-team-sample.js';

export const SAMPLE_RUN_FILE = fileURLToPath(new URL('../../docs/sample-run.json', import.meta.url));

// The sample now runs through the eight-agent design team (design-team D6). The old four-agent run-sample.js is kept, unused here.
const sample = runTeamSample();
const { result } = sample;
if (!result.ok) {
  console.error(`The sample run stopped, so nothing was written. The ${result.failedAgent} agent failed: ${result.reason}`);
  process.exit(1);
}
mkdirSync(dirname(SAMPLE_RUN_FILE), { recursive: true });
const text = JSON.stringify(makeTeamSampleRun(sample), null, 2) + '\n';
// Tests run in parallel, and several of them read this file while others run this script. Writing a file in place
// empties it first, so a reader can see half a file. So: leave the file alone when nothing changed, and when it did
// change, write a copy next to it and swap it in (a rename is all-or-nothing).
const readCurrent = () => { try { return readFileSync(SAMPLE_RUN_FILE, 'utf8'); } catch { return null; } }; // null: no file yet
if (readCurrent() !== text) {
  const copy = `${SAMPLE_RUN_FILE}.${process.pid}.tmp`;
  writeFileSync(copy, text, 'utf8');
  renameSync(copy, SAMPLE_RUN_FILE);
}
console.log(`Sample run file written to ${SAMPLE_RUN_FILE}`);
