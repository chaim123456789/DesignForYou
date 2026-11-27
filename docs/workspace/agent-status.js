// What each agent is doing, in plain words, for the Agents page and the agent strip (look-and-feel L3 and L4).
// Pure: it only turns data into text. Page code is elsewhere.
//
// Where the data comes from:
//   live   : the run in progress ({ order, current, kind, waiting }) or null
//   team   : the design team's run as plain data (docs/team/viewer/make-team-data.js): the live run so far, a finished run of the visitor's
//            own project, or the sample's scripted run. null when no run exists yet.
// No item ids are shown. Every text says what is true: an agent that has not run does not look finished.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Who answered, in words: "user", "scripted answer" or "Auto-confirmed" (the user's agent settings confirmed it for them).
const byWords = (by) => (by === 'auto-confirmed' ? 'Auto-confirmed' : by);

function passesOf(agent) {
  return agent && Array.isArray(agent.passes) ? agent.passes : [];
}

// The state words: 'waiting', 'now', 'done', 'rechecked', 'off'.
export function statusOf(name, index, { live, team, hasRun }) {
  if (live) {
    const at = live.order.indexOf(live.current);
    if (index < at) return { state: 'done', short: 'Done', long: 'Done. Its proposals are answered.' };
    if (index === at) {
      const looking = live.kind === 'recheck';
      if (live.waiting > 0) {
        return { state: 'now', short: `Asking: ${live.waiting} to answer`, long: `${looking ? 'Looking again at out-of-date items. ' : ''}${plural(live.waiting, 'proposal waits', 'proposals wait')} for your answer.` };
      }
      return { state: 'now', short: 'Finished, press Continue', long: 'All its proposals are answered. Press Continue to the next agent.' };
    }
    return { state: 'waiting', short: 'Waiting', long: 'Waiting for the agents before it.' };
  }
  const agent = team && Array.isArray(team.agents) ? team.agents.find((a) => a.name === name) : undefined;
  if (!agent) {
    return hasRun ? { state: 'waiting', short: 'No record', long: 'This run has no record of this agent.' }
      : { state: 'waiting', short: 'Not started', long: 'It starts when you step through the agents from the last step of your project.' };
  }
  if (agent.status === 'Switched off') return { state: 'off', short: 'Switched off', long: 'Switched off in its config, so it did nothing.' };
  if (agent.status === 'Did not run') return { state: 'waiting', short: 'Did not run', long: 'It did not run.' };
  const count = agent.proposalCount;
  const again = agent.status === 'Re-checked';
  return {
    state: again ? 'rechecked' : 'done',
    short: again ? 'Done, looked again' : count === 0 ? 'Done, nothing to propose' : `Done: ${plural(count, 'proposal', 'proposals')}`,
    long: `${agent.summary}${again ? ' It looked again after an earlier change.' : ''}`,
  };
}

// One row of the read-only list of an agent's proposals: what it was about, where it came from, and the answer.
export function proposalRows(agent) {
  const rows = [];
  for (const pass of passesOf(agent)) {
    for (const p of pass.proposals) {
      const auto = p.answeredBy === 'auto-confirmed';
      rows.push({
        item: p.item,
        pass: pass.kind,
        tag: p.tag,
        rule: p.rule,
        why: p.why,
        answer: p.answer,
        answeredBy: p.answeredBy,
        auto,
        applied: p.applied,
        text: `${p.item}. ${p.why} ${p.answer}${p.answeredBy ? ` (${byWords(p.answeredBy)})` : ''}.`,
      });
    }
  }
  return rows;
}

// Notes an agent kept: re-checks, "needs your look" and so on, in words.
const NOTE_WORDS = { 're-check': 'Re-checked', 'not-affected': 'Not affected', skipped: 'Switched off', 'needs-look': 'Needs your look', 'left-stale': 'Left out of date' };
export function noteRows(agent) {
  return (agent && Array.isArray(agent.notes) ? agent.notes : []).map((n) => `${NOTE_WORDS[n.event] || n.event}: ${n.text}`);
}

// The log: one line per answered or noted thing, in the agents' order. Each line says who it is about.
// Used when no live run is going. (A live run has its own, finer log from the run log.)
export function logFromTeam(team) {
  const lines = [];
  if (!team || !Array.isArray(team.agents)) return lines;
  for (const agent of team.agents) {
    for (const row of proposalRows(agent)) {
      lines.push({ agent: agent.name, text: `${row.tag}: ${row.item}. ${row.answer}${row.answeredBy ? ` (${byWords(row.answeredBy)})` : ''}.`, auto: row.auto });
    }
    for (const note of noteRows(agent)) lines.push({ agent: agent.name, text: note, auto: false });
  }
  return lines;
}

// The same for a live run, from the run log rows (docs/intake/team-run.js liveLog).
export function logFromRows(rows) {
  return rows.map((r) => ({
    agent: r.agent,
    text: `${r.tag}: ${r.what}${r.details ? `. ${r.details}` : ''}`,
    auto: r.what === 'Auto-confirmed',
  }));
}
