// Runs the sample and writes the summary page to sample-summary.html in the
// project's top folder. Run it with: npm run sample
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runTeamSample } from '../sample/run-team-sample.js';
import { makeSummaryHtml } from './make-summary.js';

export const SUMMARY_FILE = fileURLToPath(new URL('../../sample-summary.html', import.meta.url));

// The sample now runs through the eight-agent design team (design-team D6). The old four-agent run-sample.js is kept, unused here.
const { project, result, team } = runTeamSample();
if (!result.ok) {
  console.error(`The sample run stopped. The ${result.failedAgent} agent failed: ${result.reason}`);
  process.exit(1);
}
writeFileSync(SUMMARY_FILE, makeSummaryHtml(project), 'utf8');
console.log(`Summary written to ${SUMMARY_FILE}`);
