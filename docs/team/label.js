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

// ---- Honest wording for the design team's output (design-team D3, R8, R4.8) ----

// The fixed sentence of R8.2. It says which parts are fixed rules and which parts can use AI. It never uses the words
// "understand" or "notice": those are kept for a result that really came from AI (R8.5).
export const TEAM_SENTENCE_AI_OFF = 'The design team works from fixed rules and knowledge files (Rule-based). Two jobs can use AI: reading a photo and judging taste. AI is off, so nothing in this result came from AI.';
export const TEAM_SENTENCE_AI_ON = 'The design team works from fixed rules and knowledge files (Rule-based). Two jobs can use AI: reading a photo and judging taste. Every line marked AI came through the AI gate, and it shows the task and the cost.';
export const teamSentence = (aiUsed) => (aiUsed ? TEAM_SENTENCE_AI_ON : TEAM_SENTENCE_AI_OFF);
// Shown when a script, not a person, answered the proposals (R4.8).
export const SCRIPTED_SENTENCE = 'Answers marked "scripted answer" were chosen by a fixed script, not by a person.';
export const SCRIPTED_WORDS = 'scripted answer';
// Shown when the user's agent settings confirmed proposals for them (look-and-feel L5).
export const AUTO_SENTENCE = 'Answers marked "auto-confirmed" were confirmed for you by your agent settings. The gatekeeper checked each one in the same way as an answer you give yourself.';
export const AUTO_WORDS = 'auto-confirmed';

// One line of text with its tag in front: "Rule-based: ..." or "AI: ...".
export const taggedLine = (source, text) => `${sourceTag(source)}: ${text}`;

const TEAM_EVENT_WORDS = {
  proposed: 'Proposed', answered: 'Answered', 'kept-as-is': 'Kept as it is', 're-check': 'Re-checked', 'not-affected': 'Not affected',
  'needs-look': 'Needs your look', note: 'Note', 'still-fine': 'Still fine', 'left-stale': 'Left out of date',
  started: 'Started', finished: 'Finished', skipped: 'Skipped', failed: 'Failed', refused: 'Refused',
};
const OLD_OWNERS = ['Style', 'Layout', 'Builder', 'Reviewer'];

// Reads the run log of a project and says what the design team did, in rows that each carry a tag. Returns null when the
// run log has no design-team step (the old four-agent sample), so the old output is never changed.
// Pure: it reads the project and changes nothing. nameOf(itemId) turns an item id into plain words.
export function describeTeamRun(project, nameOf = (id) => id) {
  const log = project.runLog || [];
  const isTeam = log.some((e) => !OLD_OWNERS.includes(e.agent) || e.event === 'proposed');
  if (!isTeam) return null;
  const proposals = new Map(log.filter((e) => e.event === 'proposed').map((e) => [e.proposal, e]));
  const scripted = log.some((e) => e.event === 'answered' && e.by === SCRIPTED_WORDS);
  const aiUsed = log.some((e) => e.event === 'proposed' && e.source === 'ai');
  const autoConfirmed = log.some((e) => e.event === 'answered' && e.by === AUTO_WORDS);
  const rows = log.map((e, i) => {
    const via = e.proposal ? proposals.get(e.proposal) : undefined;
    const source = e.event === 'proposed' ? e.source : via ? via.source : 'rule';
    const parts = [];
    if (e.item) parts.push(`item: ${nameOf(e.item)}`);
    if (e.event === 'proposed') {
      parts.push(e.source === 'ai' ? `AI task ${e.ruleId}, cost $${e.costUsd}${e.aiLabel ? ` (${e.aiLabel})` : ''}` : `rule ${e.ruleId}`);
    } else if (e.event === 'answered') {
      parts.push(`choice ${e.choice}`, `answered by ${e.by}`, e.accepted ? 'accepted' : 'refused');
    } else if (e.event === 'kept-as-is') {
      parts.push(`answered by ${e.by}`);
    }
    if (e.reason) parts.push(e.reason);
    return { number: i + 1, agent: e.agent, event: e.event, what: e.event === 'answered' && e.by === AUTO_WORDS ? 'Auto-confirmed' : TEAM_EVENT_WORDS[e.event] || e.event, source, tag: sourceTag(source), details: parts.join('. ') };
  });
  // The nth accepted answer made the nth version of the run, so each version gets the tag of the proposal that made it.
  const accepted = log.filter((e) => e.event === 'answered' && e.accepted);
  const versions = project.versions || [];
  const offset = versions.length - accepted.length;
  const versionSources = versions.map((v, i) => {
    const a = i - offset >= 0 ? accepted[i - offset] : undefined;
    const via = a ? proposals.get(a.proposal) : undefined;
    return via ? via.source : 'rule';
  });
  return {
    rows, versionSources, scripted, aiUsed, autoConfirmed,
    sentences: [teamSentence(aiUsed), ...(scripted ? [SCRIPTED_SENTENCE] : []), ...(autoConfirmed ? [AUTO_SENTENCE] : [])],
  };
}
