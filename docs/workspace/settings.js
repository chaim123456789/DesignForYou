// Agent settings: how much the user wants to be asked (look-and-feel L5). Pure logic: no page code, no storage, no network.
//
// WHAT THE SETTINGS DO: they decide only how a proposal is CONFIRMED. A proposal is either put to the user (Confirm / Custom / Skip),
// or confirmed for them with its first (recommended) option and reported. The answer is still given through the same run.answer() and
// the same gatekeeper, so the owner rule and the Locked rule are exactly as before. Nothing here edits an item.
//
// THREE LEVELS (one global choice, and one per agent that can say "use the global choice"):
//   ask          "Always ask me": every proposal waits for the user.
//   recommended  "Recommended": ask when the change affects another agent's work, causes a clash, or touches a Locked item.
//                Otherwise the change is applied and the user is told.
//   auto         "Do it and tell me": every proposal is applied and the user is told.
// Whatever the level, a proposal where the agent is unsure and shows two options is always put to the user: a choice is not a confirmation.
//
// THE RULE "Doors and windows move with their wall" (on by default): when a wall has changed, the follow-up that Doors and windows makes
// for its own doors and windows (its re-check pass) does not count as "affects another agent's work" at the Recommended level. A clash or a
// Locked item still means the user is asked, and a choice of "Always ask me" is never overridden.

export const LEVELS = Object.freeze([
  { id: 'ask', label: 'Always ask me', help: 'Every proposal waits for your answer.' },
  { id: 'recommended', label: 'Recommended', help: 'Asks you when a change affects another agent\'s work, causes a clash, or touches a Locked item. Otherwise it applies the change and tells you.' },
  { id: 'auto', label: 'Do it and tell me', help: 'Applies each proposal and tells you what it did.' },
]);
export const LEVEL_IDS = Object.freeze(LEVELS.map((l) => l.id));
export const USE_GLOBAL = 'global';
// The default is "Always ask me": the product's rule is that agents always ask the user to confirm (product.md), so nothing is confirmed for the user
// until the user chooses it.
export const DEFAULT_LEVEL = 'ask';
export const SETTINGS_VERSION = 1;
export const DOORS_AGENT = 'Doors and windows';
export const AUTO_WORD = 'Auto-confirmed';

export function levelLabel(id) {
  const level = LEVELS.find((l) => l.id === id);
  return level ? level.label : id;
}

export function defaultSettings() {
  return { version: SETTINGS_VERSION, global: DEFAULT_LEVEL, perAgent: {}, doorsFollowWall: true };
}

// Anything that is not a valid settings object (wrong type, unknown level, an agent that does not exist) falls back to the default for
// that part. agentNames: the eight names, so a saved name that is not an agent is dropped. Never throws.
export function normalise(raw, agentNames = []) {
  const settings = defaultSettings();
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return settings;
  if (LEVEL_IDS.includes(raw.global)) settings.global = raw.global;
  if (typeof raw.doorsFollowWall === 'boolean') settings.doorsFollowWall = raw.doorsFollowWall;
  if (raw.perAgent !== null && typeof raw.perAgent === 'object' && !Array.isArray(raw.perAgent)) {
    for (const name of agentNames) {
      const value = Object.hasOwn(raw.perAgent, name) ? raw.perAgent[name] : undefined;
      if (LEVEL_IDS.includes(value)) settings.perAgent[name] = value;
    }
  }
  return settings;
}

// The level that applies to one agent: its own choice, or the global one.
export function levelFor(settings, agentName) {
  const own = Object.hasOwn(settings.perAgent, agentName) ? settings.perAgent[agentName] : undefined;
  return LEVEL_IDS.includes(own) ? own : settings.global;
}

// A new settings object with one change. Nothing is changed in place.
export function withGlobal(settings, level) {
  if (!LEVEL_IDS.includes(level)) throw new Error(`"${level}" is not a level.`);
  return { ...settings, perAgent: { ...settings.perAgent }, global: level };
}
export function withAgentLevel(settings, agentName, level) {
  const perAgent = { ...settings.perAgent };
  if (level === USE_GLOBAL) delete perAgent[agentName];
  else if (LEVEL_IDS.includes(level)) perAgent[agentName] = level;
  else throw new Error(`"${level}" is not a level.`);
  return { ...settings, perAgent };
}
export function withDoorsFollowWall(settings, on) {
  return { ...settings, perAgent: { ...settings.perAgent }, doorsFollowWall: on === true };
}

// Decide how one proposal is confirmed.
//   proposal : the agent's proposal (needs agent and confidence)
//   context  : { kind: 'first' | 'recheck', getEffect: () => { locked, affectsOthers, clash } }
//              getEffect is called only when the answer depends on it.
// Returns { auto: boolean, level, why }. `why` is one plain sentence for the log: why the user is asked, or why it was confirmed for them.
export function decide(settings, proposal, context) {
  const level = levelFor(settings, proposal.agent);
  if (level === 'ask') return { auto: false, level, why: 'You chose "Always ask me".' };
  if (proposal.confidence === 'low') return { auto: false, level, why: 'The agent is unsure and shows two options, so you pick one.' };
  if (level === 'auto') return { auto: true, level, why: 'You chose "Do it and tell me".' };

  const effect = context.getEffect();
  const reasons = [];
  if (effect.locked) reasons.push('it touches a Locked item');
  if (effect.clash) reasons.push('it causes a clash');
  const followsWall = settings.doorsFollowWall && proposal.agent === DOORS_AGENT && context.kind === 'recheck';
  if (effect.affectsOthers && !followsWall) reasons.push('it affects another agent\'s work');
  if (reasons.length > 0) return { auto: false, level, why: `Recommended asks you because ${reasons.join(' and ')}.` };
  return {
    auto: true,
    level,
    why: followsWall && effect.affectsOthers
      ? 'Recommended: a door or window moves with its wall, and nothing else is affected.'
      : 'Recommended: it affects no other agent, causes no clash and touches no Locked item.',
  };
}
