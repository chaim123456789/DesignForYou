// Turns a finished sample Project Brain into the plain data the 3D viewer reads.
// The work is done by the pure function makeRunData (make-run-data.js).
// This file only adds the reading of the fixed viewer layout from its file.
import { readFileSync } from 'node:fs';
import { makeRunData } from './make-run-data.js';
import { getLabels, SAMPLE_LABEL } from '../label.js';

export function readViewerLayout() {
  return JSON.parse(readFileSync(new URL('./viewer-layout.json', import.meta.url), 'utf8'));
}

// options.team: the design team's run (design-team D6), shown in the viewer's team panel.
export function makeSampleRun(project, layout = readViewerLayout(), options = {}) {
  const { name, ...rest } = makeRunData(project, layout, options);
  // The sample flag is read through the shared label code, like every other output.
  // It sits right after the name, as before, so the exported file does not change.
  return { name, sample: getLabels(project).includes(SAMPLE_LABEL), ...rest };
}
