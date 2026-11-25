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

// The two tags that say where a result came from (design-team R8.1).
export const TAG_RULE = 'Rule-based';
export const TAG_AI = 'AI';

// The tag for a source: 'rule' gives "Rule-based", 'ai' gives "AI". Any other source is an error,
// so a line can never be shown without a true tag.
export function sourceTag(source) {
  if (source === 'rule') return TAG_RULE;
  if (source === 'ai') return TAG_AI;
  throw new Error(`Source "${source}" has no tag. Use rule or ai.`);
}
