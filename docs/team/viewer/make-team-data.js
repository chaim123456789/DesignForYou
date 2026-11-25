// The design team's run as plain data for the viewer and the result page (design-team D4, D5, R11.3).
// Pure: no file reading, no network, so it also runs in a browser. Read only: it never changes the Project Brain or the run.
//
// It says, for each of the eight agents in registry order: what it did, which proposals it made (with the source tag, the rule,
// the options and the answer), and whether it was re-checked, skipped or not affected, with the reason from the run log.
// No item ids appear in the text: items are named in plain words.
import { sourceTag, describeTeamRun } from '../label.js';

const plainName = (project, id) => {
  const item = project.items.find((i) => i.id === id);
  if (item && item.kind === 'clash') return 'The review report';
  return item && item.value && typeof item.value.name === 'string' ? item.value.name : 'an item';
};

// project: the Brain after the run. steps: run.steps (proposals with their answers). registry: { order }.
// Returns null when the run log has no design-team step (the old four-agent sample).
export function makeTeamData(project, steps, registry) {
  const team = describeTeamRun(project, (id) => plainName(project, id));
  if (!team || !Array.isArray(steps) || !registry || !Array.isArray(registry.order)) return null;
  const log = project.runLog;
  const agents = registry.order.map((name, index) => {
    const mine = steps.filter((s) => s.agent === name);
    const started = log.filter((e) => e.agent === name && e.event === 'started').length;
    const skipped = log.some((e) => e.agent === name && e.event === 'skipped') && started === 0;
    const passes = mine.map((s) => ({
      kind: s.kind === 'recheck' ? 're-check' : 'first pass',
      staleItems: s.staleItemIds.map((id) => plainName(project, id)),
      proposals: s.proposals.map(({ proposal: p, answer }) => {
        const chosen = answer && answer.choice !== 'skip' && answer.choice !== 'custom' ? p.options.find((o) => o.id === answer.choice) : undefined;
        return {
          item: plainName(project, p.itemId),
          why: p.why,
          tag: sourceTag(p.source),
          rule: p.ruleId,
          confidence: p.confidence,
          ...(p.ai ? { ai: { task: p.ai.task, costUsd: p.ai.costUsd, label: p.ai.label } } : {}),
          ...(p.aiNote ? { aiNote: p.aiNote } : {}),
          ...(p.request ? { request: `Asks ${p.request.owner} to change ${plainName(project, p.request.itemId)}` } : {}),
          options: p.options.map((o) => o.label),
          answer: answer === null ? 'not answered' : answer.choice === 'skip' ? 'Skip: kept as it is' : answer.choice === 'custom' ? 'Custom value' : `Confirm: ${chosen ? chosen.label : answer.choice}`,
          answeredBy: answer ? answer.by : undefined,
          applied: answer ? answer.applied === true : false,
        };
      }),
    }));
    const notes = log.filter((e) => e.agent === name && ['re-check', 'not-affected', 'skipped', 'needs-look', 'left-stale'].includes(e.event) && !(e.event === 'skipped' && started > 0))
      .map((e) => ({ event: e.event, text: String(e.reason || '').replace(/"?\b(item-\d+)\b"?/g, (_, id) => `"${plainName(project, id)}"`) }));
    const proposalCount = passes.reduce((n, p) => n + p.proposals.length, 0);
    const rechecked = passes.some((p) => p.kind === 're-check');
    const status = skipped ? 'Switched off' : started === 0 ? 'Did not run' : rechecked ? 'Re-checked' : 'Ran';
    return {
      number: index + 1, name, status, proposalCount, passes, notes,
      summary: skipped ? 'Switched off in its config, so it did nothing.'
        : started === 0 ? 'Did not run.'
          : proposalCount === 0 ? 'Ran and had nothing to propose.'
            : `Made ${proposalCount} ${proposalCount === 1 ? 'proposal' : 'proposals'}.`,
    };
  });
  return { sentences: team.sentences.slice(), scripted: team.scripted, aiUsed: team.aiUsed, agents };
}
