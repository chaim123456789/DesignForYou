// Who confirms a proposal (look-and-feel R4). Pure logic: no page code, no storage, no network.
//
//   decide(session, step, proposal, settings)  ->  { auto, level, optionId?, reason, concerns }
//
// It only DECIDES. It never changes the real Project Brain. To find out what a change would do, it tries the change on a COPY of the
// Brain, through the very same gatekeeper, and looks at the copy. If it says "auto", the page then answers the proposal with
// run.answer(id, optionId, undefined, { automatic: reason }). That is the same door a button press uses: the same gatekeeper, the same
// owner check, the same Locked check. Nothing here weakens them. A Locked item is never confirmed automatically at any level.
//
// The levels (agent-settings.js):
//   ask          "Always ask me": never automatic.
//   auto         "Do it and tell me": automatic (the agent's first, recommended option), except for a Locked item.
//   recommended  "Recommended": automatic unless the change
//                  (a) affects another agent's work: it asks an earlier agent to change an item, or it would make items that belong
//                      to another agent out of date;
//                  (b) causes a clash: the Reviewer's checks find a clash on the copy that they did not find before;
//                  (c) touches a Locked item: the item, or an item that would become out of date, is Locked.
//   The rule "Doors and windows move with their wall": a Doors and windows re-check proposal that only follows a wall change is
//   not counted under (a), because the visitor already confirmed the wall change. It does not change level "Always ask me", and
//   it does not change (b) or (c).
import { createGatekeeper } from '../team/brain/gatekeeper.js';
import { makeReadOnlyView } from '../team/coordinator.js';
import { findStale } from '../team/ripple.js';
import { levelFor, levelLabel } from './agent-settings.js';

const DOORS_WINDOWS = 'Doors and windows';
const REVIEWER = 'Reviewer';

const nameOf = (project, id) => {
  const item = project.items.find((i) => i.id === id);
  return item && item.value && typeof item.value.name === 'string' ? item.value.name : 'an item';
};

const staleIds = (project, registry) => new Set(findStale(project, registry).stale.map((s) => s.itemId));

// The Reviewer's clash lines for a Brain (as keys), not counting its own reports (stale, kept as is, needs your look).
// Returns null when the Reviewer cannot be asked (then the caller cannot rule a clash out and asks the visitor).
function clashKeys(project, reviewer) {
  try {
    const view = makeReadOnlyView(project);
    const proposals = reviewer(view, { mode: 'first' });
    const reportItem = view.items.find((i) => i.kind === 'clash' && i.owner === REVIEWER);
    const lines = proposals.length > 0 ? proposals[0].options[0].newValue.clashes : ((reportItem && reportItem.value && reportItem.value.clashes) || []);
    return new Set(lines.filter((l) => !String(l.checkId || '').startsWith('report-')).map((l) => `${l.checkId || l.type}|${(l.items || []).join(',')}|${l.description}`));
  } catch {
    return null;
  }
}

// Does this proposal only make a door or window follow a wall that changed? (The rule "Doors and windows move with their wall".)
function followsItsWall(project, registry, step, proposal) {
  if (proposal.agent !== DOORS_WINDOWS || !step || step.kind !== 'recheck') return false;
  const item = project.items.find((i) => i.id === proposal.itemId);
  if (!item || (item.kind !== 'door' && item.kind !== 'window')) return false;
  const stale = findStale(project, registry).stale.find((s) => s.itemId === item.id);
  if (!stale || stale.because.length === 0) return false;
  return stale.because.every((b) => {
    const cause = project.items.find((i) => i.id === b.itemId);
    return cause && cause.kind === 'wall';
  });
}

// session: { project, registry, agents } (the team session). step: the step being asked ({ agent, kind }). proposal: one of its proposals.
export function decide(session, step, proposal, settings) {
  const { project, registry } = session;
  const level = levelFor(settings, proposal.agent);
  const who = levelLabel(level);
  const real = proposal.options.filter((o) => o.id !== 'custom');
  const option = real[0];
  const base = { level, optionId: option.id, concerns: [] };

  if (level === 'ask') return { ...base, auto: false, reason: `Your setting for ${proposal.agent} is "${who}".` };

  const item = project.items.find((i) => i.id === proposal.itemId);
  if (!item) return { ...base, auto: false, reason: 'The item could not be found, so you are asked.' };
  if (item.status === 'Locked') {
    return { ...base, auto: false, concerns: ['touches a Locked item'], reason: `${nameOf(project, item.id)} is Locked. A Locked item is never confirmed automatically.` };
  }
  if (level === 'auto') {
    return { ...base, auto: true, reason: `Confirmed automatically because your setting for ${proposal.agent} is "${who}".` };
  }

  // ---- Recommended: look at what the change would do, on a copy.
  const concerns = [];
  const trial = structuredClone(project);
  const owner = proposal.request ? proposal.request.owner : proposal.agent;
  if (proposal.request) concerns.push(`affects another agent's work: it asks ${proposal.request.owner}, an earlier agent, to change ${nameOf(project, item.id)}`);

  let applied;
  try {
    applied = createGatekeeper(trial).changeItem(owner, item.id, structuredClone(option.newValue));
  } catch (error) {
    applied = { accepted: false, reason: error && error.message ? error.message : String(error) };
  }
  if (!applied.accepted) {
    concerns.push(`the gatekeeper would refuse this change (${applied.reason})`);
  } else {
    const before = staleIds(project, registry);
    const after = findStale(trial, registry).stale.filter((s) => !before.has(s.itemId));
    const followsWall = settings.doorsFollowWall === true && followsItsWall(project, registry, step, proposal);
    // Items of other agents that were worked out from this item (their basis names it) are affected by the change, whether or not they
    // are already out of date. Newly out-of-date items are affected too.
    const dependents = project.items.filter((i) => i.owner !== owner && (i.basis || []).some((b) => b.itemId === item.id));
    const others = [...new Map([...after.filter((s) => s.owner !== owner).map((s) => [s.itemId, s.owner]), ...dependents.map((i) => [i.id, i.owner])])];
    if (others.length > 0 && !followsWall) {
      const names = [...new Set(others.map(([, who]) => who))];
      concerns.push(`affects another agent's work: it would change what ${names.join(', ')} worked out from this item`);
    }
    const lockedIds = new Set([...after.filter((s) => s.locked).map((s) => s.itemId), ...dependents.filter((i) => i.status === 'Locked').map((i) => i.id)]);
    if (lockedIds.size > 0) concerns.push(`touches a Locked item: ${nameOf(project, [...lockedIds][0])} depends on this one`);

    if (proposal.agent !== REVIEWER && session.agents && typeof session.agents[REVIEWER] === 'function') {
      const was = clashKeys(project, session.agents[REVIEWER]);
      const now = clashKeys(trial, session.agents[REVIEWER]);
      if (was === null || now === null) concerns.push('causes a clash: the Reviewer\'s checks could not be run to rule it out');
      else if ([...now].some((key) => !was.has(key))) concerns.push('causes a clash that the Reviewer\'s checks did not find before');
    }
  }

  if (concerns.length > 0) {
    return { ...base, auto: false, concerns, reason: `You are asked because: ${concerns.join('; ')}.` };
  }
  return { ...base, auto: true, reason: `Confirmed automatically because your setting for ${proposal.agent} is "${who}" and this change affects no other agent's work, causes no clash and touches no Locked item.` };
}
