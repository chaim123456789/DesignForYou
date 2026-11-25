// The design team, one agent at a time, on the Review and run screen (design-team D4).
// For each agent it shows the agent's proposals. Each proposal shows where it came from (the Rule-based or AI tag), the rule that
// made it, why, and the choices: "Confirm: <option>" for each option (two options when the agent is unsure), "Custom" (type your own
// value) and "Skip" (keep the item as it is). Nothing changes until the visitor answers. The next agent starts only after the answers.
//
// This file imports nothing. screens.js loads team-run.js and hands it in. Everything shown goes on the page with textContent,
// never as page code. Every choice is a real button with words on it, in reading order, with no tabindex above 0.
// Focus moves to the new agent's heading, and one short sentence is announced. Nothing is stored or sent anywhere.
//
// Every part is its own protected step (attempt and guarded come from screens.js).

export function setUpTeamScreen(tools) {
  const { el, attempt, guarded, announce, team, onFinished, onFailed } = tools;

  const refs = {};
  for (const id of ['team-run', 'team-progress', 'heading-team-agent', 'team-agents', 'team-agent-note', 'team-ai-note', 'team-proposals', 'team-nothing',
    'team-rechecked']) refs[id] = el(id);
  // The button that moves on to the next agent is made here, at the end of the panel.
  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.id = 'team-continue';
  continueButton.className = 'action-button run-button';
  continueButton.textContent = 'Continue to the next agent';
  continueButton.hidden = true;
  refs['team-run'].append(continueButton);
  refs['team-continue'] = continueButton;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  let session = null;
  let step = null; // the agent now being asked: { agent, kind, proposals, staleItemIds }
  let proposalViews = new Map(); // proposal id -> { item, group, answerLine }
  let busy = false;

  const itemName = (itemId) => {
    const item = session.project.items.find((i) => i.id === itemId);
    return item && item.value && typeof item.value.name === 'string' ? item.value.name : 'an item';
  };

  // ---- The row of eight agents -------------------------------------------------------------------

  function drawAgents(currentName) {
    const order = session.registry.order;
    const at = order.indexOf(currentName);
    refs['team-agents'].replaceChildren(...order.map((name, index) => {
      const li = make('li', '', `${index + 1}. ${name}${index < at ? ': done' : index === at ? ': now' : ': waiting'}`);
      if (index === at) li.setAttribute('aria-current', 'step');
      return li;
    }));
  }

  // ---- One proposal -----------------------------------------------------------------------------

  function finishedLine(proposal, outcome) {
    return outcome.keptAsIs
      ? 'Your answer: Skip. The item is kept as it is.'
      : `Your answer: ${outcome.label}. ${outcome.applied ? `It was applied (version ${outcome.version}).` : `It was not applied: ${outcome.reason || 'the change was refused'}.`}`;
  }

  function answer(proposal, choice, value, label, view) {
    if (busy) return;
    view.error.textContent = '';
    view.error.hidden = true;
    let result;
    try {
      result = session.run.answer(proposal.id, choice, value);
    } catch (error) {
      // A custom value the agent's own checker refuses: say why, keep the proposal waiting.
      view.error.textContent = error && error.message ? error.message : String(error);
      view.error.hidden = false;
      return;
    }
    view.group.hidden = true;
    view.answerLine.textContent = finishedLine(proposal, { keptAsIs: result.keptAsIs === true, applied: result.applied, version: result.version, reason: result.reason, label });
    view.answerLine.hidden = false;
    const waiting = session.run.pending;
    if (waiting.length > 0) {
      announce(`Answer saved. ${plural(waiting.length, 'proposal is', 'proposals are')} still waiting.`);
      const next = proposalViews.get(waiting[0].id);
      if (next) attempt('Moving the keyboard focus', () => next.firstButton.focus());
      return;
    }
    stepFinished();
  }

  function drawProposal(proposal) {
    const li = make('li', 'team-proposal');
    const name = itemName(proposal.itemId);
    const headingId = `team-proposal-heading-${proposalViews.size + 1}`;
    const heading = make('h3', '', name);
    heading.id = headingId;
    li.append(heading);

    const facts = make('p', '');
    const tag = make('span', proposal.source === 'ai' ? 'source-tag source-tag-ai' : 'source-tag', proposal.source === 'ai' ? 'AI' : 'Rule-based');
    facts.append(tag, make('span', 'team-rule', ` Rule: ${proposal.ruleId}. ${proposal.confidence === 'low' ? 'The agent is unsure, so it shows two options.' : 'The agent is fairly sure.'}`));
    li.append(facts);
    li.append(make('p', '', proposal.why));
    if (proposal.request) li.append(make('p', '', `This asks ${proposal.request.owner}, an earlier agent, to change this item. It changes only if you agree.`));
    if (proposal.source === 'ai' && proposal.ai) li.append(make('p', '', `AI task ${proposal.ai.task}, cost $${proposal.ai.costUsd} (${proposal.ai.label}).`));
    if (proposal.aiNote) li.append(make('p', 'hint', proposal.aiNote));

    const view = { item: li, error: make('p', 'field-error'), answerLine: make('p', 'team-answer'), group: make('div', ''), firstButton: null };
    view.error.hidden = true;
    view.error.setAttribute('role', 'alert');
    view.answerLine.hidden = true;
    view.group.setAttribute('role', 'group');
    view.group.setAttribute('aria-labelledby', headingId);

    const real = proposal.options.filter((o) => o.id !== 'custom');
    const buttons = [];
    for (const option of real) {
      const b = make('button', 'action-button team-option-button', `Confirm: ${option.label}`);
      b.type = 'button';
      b.addEventListener('click', guarded(`Confirm for ${name}`, () => answer(proposal, option.id, undefined, `Confirm: ${option.label}`, view)));
      buttons.push(b);
    }

    // Custom: the visitor edits a copy of the first suggestion as text. The agent's own checker decides if it is allowed.
    const customBox = make('div', '');
    customBox.hidden = true;
    const customId = `team-custom-${proposalViews.size + 1}`;
    const customLabel = make('label', '', `Custom value for ${name}. Start from the first suggestion and change what you need. The agent checks it before it is used.`);
    customLabel.setAttribute('for', customId);
    const customInput = make('textarea', 'custom-input');
    customInput.id = customId;
    customInput.value = JSON.stringify(real[0].newValue, null, 2);
    const customUse = make('button', 'action-button', `Use this custom value for ${name}`);
    customUse.type = 'button';
    customUse.addEventListener('click', guarded(`Custom for ${name}`, () => {
      let value;
      try {
        value = JSON.parse(customInput.value);
      } catch {
        view.error.textContent = 'That custom value is not written correctly. Check the brackets, quotes and commas, or use Confirm or Skip instead.';
        view.error.hidden = false;
        return;
      }
      answer(proposal, 'custom', value, 'Custom value', view);
    }));
    customBox.append(customLabel, customInput, customUse);

    const customButton = make('button', 'action-button team-option-button', 'Custom: write my own value');
    customButton.type = 'button';
    customButton.setAttribute('aria-expanded', 'false');
    customButton.addEventListener('click', guarded(`Custom for ${name}`, () => {
      customBox.hidden = !customBox.hidden;
      customButton.setAttribute('aria-expanded', String(!customBox.hidden));
      if (!customBox.hidden) customInput.focus();
    }));
    buttons.push(customButton);

    const skip = make('button', 'action-button team-option-button', 'Skip: keep it as it is');
    skip.type = 'button';
    skip.addEventListener('click', guarded(`Skip for ${name}`, () => answer(proposal, 'skip', undefined, 'Skip', view)));
    buttons.push(skip);

    view.group.append(...buttons, customBox);
    view.firstButton = buttons[0];
    li.append(view.group, view.error, view.answerLine);
    proposalViews.set(proposal.id, view);
    return li;
  }

  // ---- One agent -----------------------------------------------------------------------------------

  function showStep(next) {
    step = next;
    logStart = session.project.runLog.length;
    proposalViews = new Map();
    const order = session.registry.order;
    const number = order.indexOf(step.agent) + 1;
    refs['team-run'].hidden = false;
    refs['team-progress'].textContent = `Agent ${number} of ${order.length}`;
    refs['heading-team-agent'].textContent = `${step.agent}${step.kind === 'recheck' ? ' (looking again at its out-of-date items)' : ''}`;
    drawAgents(step.agent);
    refs['team-agent-note'].textContent = step.kind === 'recheck'
      ? `Something earlier changed, so ${step.agent} looks again at ${plural(step.staleItemIds.length, 'item', 'items')}. Nothing changes unless you agree.`
      : `${step.agent} suggests changes. Nothing changes until you answer each one.`;
    const ai = session.project.runLog.filter((e) => e.agent === step.agent && e.event === 'note' && /^AI was not used/.test(e.reason));
    refs['team-ai-note'].textContent = ai.length > 0 ? 'AI was not used here. The suggestions are Rule-based.' : '';
    refs['team-ai-note'].hidden = ai.length === 0;
    refs['team-proposals'].replaceChildren(...step.proposals.map(drawProposal));
    refs['team-nothing'].hidden = step.proposals.length > 0;
    refs['team-rechecked'].hidden = true;
    refs['team-continue'].hidden = true;
    if (step.proposals.length === 0) {
      stepFinished();
    } else {
      announce(`${step.agent}, agent ${number} of ${order.length}. ${plural(step.proposals.length, 'proposal', 'proposals')} to answer.`);
    }
    attempt('Moving the keyboard focus', () => refs['heading-team-agent'].focus());
  }

  // What was re-checked after the answers, in plain words, from the run log.
  // Only the lines written since this agent started, and with item names instead of ids.
  let logStart = 0;
  const named = (text) => String(text).replace(/"?\b(item-\d+)\b"?/g, (_, id) => `"${itemName(id)}"`);
  function recheckLine() {
    const log = session.project.runLog.slice(logStart);
    const lines = log.filter((e) => e.event === 're-check').map((e) => `${e.agent}: ${named(e.reason)}`);
    const fine = log.filter((e) => e.event === 'still-fine').length;
    return lines.length > 0 ? `To be re-checked after your answers: ${lines.join(' ')}` : fine > 0 ? 'Some earlier work was looked at again and is still fine.' : '';
  }

  function stepFinished() {
    const order = session.registry.order;
    const last = order.indexOf(step.agent) === order.length - 1 && step.kind === 'first';
    const text = recheckLine();
    refs['team-rechecked'].textContent = text;
    refs['team-rechecked'].hidden = text === '';
    refs['team-continue'].textContent = last ? 'Show the result' : 'Continue to the next agent';
    refs['team-continue'].hidden = false;
    announce(`${step.agent} is finished. ${last ? 'Press Show the result.' : 'Press Continue to the next agent.'}`);
    attempt('Moving the keyboard focus', () => refs['team-continue'].focus());
  }

  function advance() {
    if (!session) return;
    const next = session.run.next(); // throws if answers are still waiting
    if (next.done) {
      const finished = session;
      if (next.ok === false) {
        const failure = team.failedTeamSession(finished);
        stop();
        onFailed(failure.failedAgent, failure.reason);
        return;
      }
      const result = team.finishTeamSession(finished);
      stop();
      onFinished(result);
      return;
    }
    showStep(next);
  }

  // ---- Start and stop ---------------------------------------------------------------------------

  function stop() {
    session = null;
    step = null;
    proposalViews = new Map();
    refs['team-run'].hidden = true;
    refs['team-proposals'].replaceChildren();
    refs['team-agents'].replaceChildren();
    refs['team-continue'].hidden = true;
  }

  // Start a run for the visitor's inputs. Throws if the inputs cannot make a project (the review screen shows that message).
  function start(state) {
    session = team.createTeamSession(state);
    try {
      advance();
    } catch (error) {
      stop();
      throw error;
    }
  }

  attempt('Design team: continue button', () => {
    refs['team-continue'].addEventListener('click', guarded('Continue to the next agent', () => {
      try {
        advance();
      } catch (error) {
        announce('Answer every proposal first.');
        throw error;
      }
    }));
  });

  return { start, stop, isRunning: () => session !== null };
}
