// Runs the sample through the normal pipeline and writes docs/sample-run.json,
// the one file the 3D viewer page reads. Run it with: npm run export-viewer
// Uses no network. Never edits the Brain or sample-project.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSample } from '../sample/run-sample.js';
import { makeSampleRun } from './make-sample-run.js';

export const SAMPLE_RUN_FILE = fileURLToPath(new URL('../../docs/sample-run.json', import.meta.url));

const { project, result } = runSample();
if (!result.ok) {
  console.error(`The sample run stopped, so nothing was written. The ${result.failedAgent} agent failed: ${result.reason}`);
  process.exit(1);
}
mkdirSync(dirname(SAMPLE_RUN_FILE), { recursive: true });
writeFileSync(SAMPLE_RUN_FILE, JSON.stringify(makeSampleRun(project), null, 2) + '\n', 'utf8');
console.log(`Sample run file written to ${SAMPLE_RUN_FILE}`);
