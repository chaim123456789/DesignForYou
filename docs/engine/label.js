// The one shared source of the sample label and the safety statement (R7.5, R9.7).
// Every view and output uses these, so none is missed.
export const SAMPLE_LABEL = 'SAMPLE PROJECT';
export const DRAFT_STATEMENT =
  'Plans are drafts for professional review. They are not verified engineering.';

// Returns the lines to show on an output. The sample label appears only for samples.
export function getLabels(project) {
  const labels = [];
  if (project && project.isSample) labels.push(SAMPLE_LABEL);
  labels.push(DRAFT_STATEMENT);
  return labels;
}
