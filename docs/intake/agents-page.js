// The Agents page and the agent strip (look-and-feel R3, R4).
//
// One card per agent: its badge (colour, letter, shape), its name, what it owns, its status, its proposals and its own setting.
// The strip on the right of the workspace shows only each agent's badge and what it is doing now; a click opens this page.
// The same small status object feeds the cards and the strip, so they can never disagree.
//
// Three situations:
//   idle      no run yet: every agent says it has not started.
//   live      the visitor is stepping through the eight agents. The proposals being asked sit INSIDE the card of the agent now asked (the
//             list made by team-screen.js is moved into that card). Answered proposals stay on the card, marked "you" or "automatic".
//   finished  a run is done (the sample, or the visitor's own project): each card lists its proposals and answers, read only.
//
// This file imports only agent-info.js and agent-settings.js (levels). Everything shown goes on the page with textContent.
// Every part is its own protected step (attempt and guarded come from screens.js).
import { AGENTS, makeBadge, fillLegend } from '../agent-info.js';
import { LEVELS, INHERIT, levelLabel } from './agent-settings.js';

export function setUpAgentsPage(tools) {
  const { el, attempt, guarded, announce, settings, openAgents, storageSaved } = tools;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---- The one status object -----------------------------------------------------------------------------------------------
  // state: 'idle' | 'live' | 'finished'. For 'live': current (agent name), kind ('first' or 'recheck'), pending (how many are waiting),
  // order (the agents' run order), answered (agent name -> how many answers). For 'finished': team (the team data of a run).
  const status = { state: 'idle', kind: null, current: null, stepKind: 'first', pending: 0, order: AGENTS.map((a) => a.name), answered: new Map(), team: null };
  let log = []; // { agent, text, auto }
  let liveHistory = new Map(); // agent name -> list of { text, auto }
  const cards = new Map(); // agent name -> { card, status, slot, list }

  function stateOf(agent) {
    const idx = status.order.indexOf(agent.name);
    if (status.state === 'live') {
      const cur = status.order.indexOf(status.current);
      const answered = status.answered.get(agent.name) || 0;
      if (agent.name === status.current) {
        return status.pending > 0
          ? { long: `${status.stepKind === 'recheck' ? 'Looking again. ' : ''}Asking you now: ${plural(status.pending, 'proposal is', 'proposals are')} waiting.`, short: 'Asking', now: true }
          : { long: `Finished this step. ${plural(answered, 'proposal', 'proposals')} answered so far.`, short: 'Done', now: true };
      }
      if (idx < cur) return { long: `Done. ${plural(answered, 'proposal', 'proposals')} answered.`, short: 'Done', now: false };
      return { long: 'Waiting for its turn.', short: 'Waiting', now: false };
    }
    if (status.state === 'finished' && status.team) {
      const t = status.team.agents.find((a) => a.name === agent.name);
      if (!t) return { long: 'Not part of this run.', short: 'None', now: false };
      return { long: `${t.status}. ${t.summary}`, short: t.status === 'Switched off' ? 'Off' : t.proposalCount > 0 ? 'Done' : 'Idle', now: false };
    }
    return { long: 'Not started yet.', short: 'Idle', now: false };
  }

  // ---- The legend ---------------------------------------------------------------------------------------------------------------
  function drawLegends() {
    attempt('Agents page: legend', () => fillLegend(el('agent-legend'), make));
    attempt('3D legend: agents', () => fillLegend(el('agent-legend-3d'), make));
  }

  // ---- The strip ------------------------------------------------------------------------------------------------------------------
  function drawStrip() {
    const list = el('strip-list');
    list.replaceChildren(...AGENTS.map((agent) => {
      const s = stateOf(agent);
      const li = make('li');
      const button = make('button', 'strip-button');
      button.type = 'button';
      button.id = `strip-${agent.key}`;
      button.setAttribute('aria-label', `${agent.name}: ${s.long} Open the Agents page.`);
      button.title = `${agent.name}: ${s.long}`;
      if (s.now) button.setAttribute('aria-current', 'true');
      button.append(makeBadge(make, agent), make('span', 'strip-text'));
      const text = button.children[1];
      text.append(make('span', 'strip-name', agent.name), make('span', 'strip-state', s.short));
      button.addEventListener('click', guarded(`Agent strip: ${agent.name}`, () => openAgents(agent.key)));
      li.append(button);
      return li;
    }));
  }

  // ---- The cards ------------------------------------------------------------------------------------------------------------------
  function buildCards() {
    const list = el('agent-cards');
    list.replaceChildren(...AGENTS.map((agent) => {
      const li = make('li', 'agent-card');
      li.id = `agent-card-${agent.key}`;
      li.setAttribute('data-agent', agent.key);
      const head = make('div', 'agent-card-head');
      const title = make('h3', '', agent.name);
      head.append(makeBadge(make, agent), title);
      const owns = make('p', 'agent-owns', `Owns: ${agent.owns}`);
      const statusLine = make('p', 'agent-status');
      const slot = make('div', 'agent-proposal-slot');
      const done = make('ul', 'agent-proposals');
      done.setAttribute('aria-label', `${agent.name}: proposals and answers`);

      const setting = make('div', 'agent-setting');
      const selectId = `agent-level-${agent.key}`;
      const label = make('label', '', `How ${agent.name} proposals are confirmed`);
      label.setAttribute('for', selectId);
      const select = make('select', 'text-input level-select');
      select.id = selectId;
      select.append(...[{ id: INHERIT, label: 'Same as for all agents' }, ...LEVELS].map((l) => {
        const option = make('option', '', l.label);
        option.value = l.id;
        return option;
      }));
      select.addEventListener('change', guarded(`Setting for ${agent.name}`, () => {
        settings.setAgent(agent.name, select.value);
        const now = settings.levelFor(agent.name);
        announce(`${agent.name}: ${levelLabel(now)}. ${settings.saved ? 'Saved in this browser.' : 'Not saved: this browser blocks storage.'}`);
        drawStorageNote();
      }));
      setting.append(label, select);

      li.append(head, owns, statusLine, slot, done, setting);
      cards.set(agent.name, { card: li, status: statusLine, slot, list: done, select });
      return li;
    }));
  }

  function drawCards() {
    for (const agent of AGENTS) {
      const c = cards.get(agent.name);
      if (!c) continue;
      const s = stateOf(agent);
      c.status.textContent = `Status: ${s.long}`;
      c.card.setAttribute('data-active', String(s.now));
      c.select.value = settings.get().agents[agent.name] || INHERIT;
    }
  }

  // The read-only list of a card: what the agent proposed and how each was answered.
  function drawProposalLists() {
    for (const agent of AGENTS) {
      const c = cards.get(agent.name);
      if (!c) continue;
      const rows = [];
      if (status.state === 'finished' && status.team) {
        const t = status.team.agents.find((a) => a.name === agent.name);
        for (const pass of (t && t.passes) || []) {
          for (const p of pass.proposals) {
            const by = p.answeredBy ? ` Confirmed by: ${p.answeredBy}.` : '';
            rows.push({ text: `${p.item} (${pass.kind}). ${p.tag}, rule ${p.rule}. ${p.why} Answer: ${p.answer}.${by}`, auto: p.answeredBy === 'automatic' });
          }
        }
      } else if (status.state === 'live') {
        for (const entry of liveHistory.get(agent.name) || []) rows.push(entry);
      }
      c.list.replaceChildren(...rows.map((r) => {
        const li = make('li', 'agent-proposal-done', r.text);
        if (r.auto) li.setAttribute('data-auto', 'true');
        return li;
      }));
    }
  }

  function drawLog() {
    el('agent-log').replaceChildren(...log.map((entry) => {
      const li = make('li', '', `${entry.agent}: ${entry.text}`);
      if (entry.auto) li.setAttribute('data-auto', 'true');
      return li;
    }));
    el('log-empty').hidden = log.length > 0;
  }

  function drawMode() {
    const text = {
      idle: 'No run yet. Press "Try the sample" on the home page, or fill in your project and step through the eight agents. Until then every agent is idle.',
      live: 'A run is in progress. The agent that is asking you has its proposals inside its card. Confirm, Skip or write your own value.',
      finished: status.kind === 'sample'
        ? 'This is the sample run. A fixed script, not a person, chose each answer. The cards below show what each agent proposed.'
        : 'This is the run of your own project. The cards below show what each agent proposed and who confirmed it.',
    }[status.state];
    el('agents-mode').textContent = text;
  }

  function drawSettings() {
    const s = settings.get();
    el('setting-global').value = s.global;
    el('setting-doors-follow').checked = s.doorsFollowWall;
    drawStorageNote();
  }

  function drawStorageNote() {
    el('settings-storage-note').textContent = settings.saved
      ? 'Your settings are saved in this browser only. Nothing is sent anywhere.'
      : 'This browser blocks saving, so your settings last only until you close this page. Nothing is sent anywhere.';
  }

  function redraw() {
    attempt('Agents page: cards', drawCards);
    attempt('Agents page: proposals', drawProposalLists);
    attempt('Agents page: log', drawLog);
    attempt('Agents page: mode', drawMode);
    attempt('Agent strip', drawStrip);
  }

  // ---- The settings controls ----------------------------------------------------------------------------------------------------
  function setUpSettingsControls() {
    const global = el('setting-global');
    global.replaceChildren(...LEVELS.map((l) => {
      const option = make('option', '', l.label);
      option.value = l.id;
      return option;
    }));
    el('level-help').replaceChildren(...LEVELS.map((l) => make('li', 'entry', `${l.label}: ${l.help}`)));
    global.addEventListener('change', guarded('Setting for all agents', () => {
      settings.setGlobal(global.value);
      announce(`All agents: ${levelLabel(global.value)}. ${settings.saved ? 'Saved in this browser.' : 'Not saved: this browser blocks storage.'}`);
      drawStorageNote();
      drawCards();
    }));
    const follow = el('setting-doors-follow');
    follow.addEventListener('change', guarded('Doors and windows follow their wall', () => {
      settings.setDoorsFollowWall(follow.checked);
      announce(`Doors and windows move with their wall: ${follow.checked ? 'on' : 'off'}. ${settings.saved ? 'Saved in this browser.' : 'Not saved: this browser blocks storage.'}`);
      drawStorageNote();
    }));
  }

  // ---- What the rest of the page tells this one ------------------------------------------------------------------------------------
  const hooks = {
    // A new agent is being asked. The live list moves into that agent's card.
    stepShown(step, session) {
      status.state = 'live';
      status.kind = 'own';
      status.order = session.registry.order.slice();
      status.current = step.agent;
      status.stepKind = step.kind;
      status.pending = session.run.pending.length;
      attempt('Agents page: moving the live proposals', () => {
        const c = cards.get(step.agent);
        if (c) c.slot.append(el('team-proposals'));
      });
      redraw();
    },
    answered(info) {
      status.answered.set(info.agent, (status.answered.get(info.agent) || 0) + 1);
      const outcome = info.result.keptAsIs ? 'kept as it is' : info.result.applied ? `applied, version ${info.result.version}` : `not applied (${info.result.reason || 'refused'})`;
      const who = info.automatic ? 'automatic' : 'you';
      const text = `${info.itemName}: ${info.label}, ${outcome}. Confirmed by: ${who}.${info.automatic ? ` ${info.automatic}` : ''}`;
      const entry = { text, auto: Boolean(info.automatic) };
      if (!liveHistory.has(info.agent)) liveHistory.set(info.agent, []);
      liveHistory.get(info.agent).push(entry);
      log.push({ agent: info.agent, text, auto: entry.auto });
      status.pending = Math.max(0, status.pending - 1);
      redraw();
    },
    // The run ended (finished, failed, or the visitor went back). The live list goes back to its own panel.
    stopped() {
      attempt('Agents page: putting the live proposals back', () => el('team-run').append(el('team-proposals')));
      if (status.state === 'live') {
        status.state = 'idle';
        status.current = null;
        status.pending = 0;
        redraw();
      }
    },
  };

  // The run of a finished project. team is the "team" part of the run data (see make-team-data.js). kind: 'sample' or 'own'.
  function showFinished(team, kind) {
    if (!team || !Array.isArray(team.agents)) { showIdle(); return; }
    status.state = 'finished';
    status.kind = kind === 'own' ? 'own' : 'sample';
    status.team = team;
    status.current = null;
    // The log of a finished run: every answered proposal in order, "automatic" marked.
    log = [];
    for (const agent of team.agents) {
      for (const pass of agent.passes || []) {
        for (const p of pass.proposals) {
          log.push({ agent: agent.name, text: `${p.item}: ${p.answer}. Confirmed by: ${p.answeredBy || 'nobody yet'}.`, auto: p.answeredBy === 'automatic' });
        }
      }
    }
    liveHistory = new Map();
    redraw();
  }

  function showIdle() {
    status.state = 'idle';
    status.kind = null;
    status.team = null;
    status.current = null;
    status.pending = 0;
    status.answered = new Map();
    liveHistory = new Map();
    log = [];
    redraw();
  }

  // A new live run starts from nothing.
  function resetLive() {
    status.answered = new Map();
    liveHistory = new Map();
    log = [];
    status.team = null;
  }

  attempt('Agents page: legends', drawLegends);
  attempt('Agents page: cards', buildCards);
  attempt('Agents page: settings controls', setUpSettingsControls);
  attempt('Agents page: settings', drawSettings);
  attempt('Agents page: first drawing', redraw);
  attempt('Agents page: settings changed', () => settings.onChange(() => { attempt('Agents page: settings drawn', () => { drawSettings(); drawCards(); }); }));

  return { hooks, showFinished, showIdle, resetLive, redraw, status: () => ({ ...status }), refreshSettings: drawSettings, storageSaved };
}
