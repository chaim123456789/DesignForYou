// The Agents page and the agent legend (look-and-feel L4 and L5): one card per agent, the legend, the settings that say how proposals
// are confirmed, and the log. Everything the user or a project entered goes on the page with textContent, never as page code.
//
// The cards are made once. The live proposals of the agent that is working now are put into its card by the design team screen
// (team-screen.js), through mountProposals: they are the same Confirm / Custom / Skip buttons as before, in the agent's card.
// Nothing here changes a project. The settings only change how proposals are confirmed (docs/workspace/settings.js).
import { AGENT_INFO, makeBadge } from './agents-info.js?v=build-look-1';
import { statusOf, proposalRows, noteRows, logFromTeam, logFromRows } from './agent-status.js?v=build-look-1';
import { LEVELS, USE_GLOBAL, levelLabel, levelFor, withGlobal, withAgentLevel, withDoorsFollowWall } from './settings.js?v=build-look-1';

const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const cleanIds = (text) => String(text).replace(/"?\bitem-\d+\b"?/g, 'an item');

// tools: { el, attempt, guarded, store: { loadSettings, saveSettings }, getTeamData, getLive, openPage }
export function setUpAgentsPage(tools) {
  const { el, attempt, guarded, store } = tools;
  const names = AGENT_INFO.map((a) => a.name);
  let settings = store.loadSettings(names);
  const cards = new Map(); // agent name -> { card, status, slot, history, notes, select }

  // ---- The legend (also drawn on the 3D view) --------------------------------------------------------------------------------------

  function legendItems(listId, withOwns) {
    const list = el(listId);
    list.replaceChildren(...AGENT_INFO.map((info) => {
      const li = make('li', 'legend-item');
      li.append(makeBadge(document, info.name));
      const text = make('span', 'legend-text');
      text.append(make('strong', '', info.name));
      if (withOwns) text.append(make('span', 'legend-owns', ` ${info.owns}`));
      li.append(text);
      return li;
    }));
  }

  // ---- The cards -----------------------------------------------------------------------------------------------------------------

  function drawCard(info, index) {
    const li = make('li', 'agent-card');
    li.id = `agent-card-${info.key}`;
    li.setAttribute('data-agent', info.key);
    const head = make('div', 'card-head');
    head.append(makeBadge(document, info.name, 'badge-large'));
    const title = make('h3', 'card-title', `${index + 1}. ${info.name}`);
    title.id = `agent-title-${info.key}`;
    title.tabIndex = -1;
    head.append(title);
    const status = make('p', 'card-status');
    status.id = `agent-status-${info.key}`;
    li.append(head);
    li.append(make('p', 'card-owns', `Owns: ${info.owns}`));
    li.append(status);

    const slot = make('div', 'card-proposals');
    slot.id = `agent-slot-${info.key}`;
    li.append(slot);
    const history = make('ul', 'card-history entry-list');
    history.id = `agent-history-${info.key}`;
    li.append(history);
    const notes = make('ul', 'card-notes');
    notes.id = `agent-notes-${info.key}`;
    li.append(notes);

    const settingsBox = make('div', 'card-settings');
    const label = make('label', '', `How should ${info.name} ask you?`);
    label.setAttribute('for', `agent-level-${info.key}`);
    const select = make('select', 'text-input');
    select.id = `agent-level-${info.key}`;
    settingsBox.append(label, select);
    li.append(settingsBox);
    cards.set(info.name, { card: li, status, slot, history, notes, select, title });
    return li;
  }

  function fillSelects() {
    for (const info of AGENT_INFO) {
      const { select } = cards.get(info.name);
      const options = [
        { value: USE_GLOBAL, text: `Use the choice for all agents (${levelLabel(settings.global)})` },
        ...LEVELS.map((l) => ({ value: l.id, text: l.label })),
      ];
      select.replaceChildren(...options.map((o) => {
        const option = make('option', '', o.text);
        option.value = o.value;
        return option;
      }));
      select.value = Object.hasOwn(settings.perAgent, info.name) ? settings.perAgent[info.name] : USE_GLOBAL;
    }
  }

  function fillControls() {
    for (const level of LEVELS) el(`settings-level-${level.id}`).checked = settings.global === level.id;
    el('settings-doors-follow').checked = settings.doorsFollowWall;
    fillSelects();
  }

  function saved() {
    const ok = store.saveSettings(settings);
    el('settings-saved').textContent = ok ? 'Saved in this browser.' : 'This browser would not save it, so your choice lasts until you close the page.';
  }

  function setUpControls() {
    for (const level of LEVELS) {
      el(`settings-level-${level.id}`).addEventListener('change', guarded('Agent settings: all agents', () => {
        if (!el(`settings-level-${level.id}`).checked) return;
        settings = withGlobal(settings, level.id);
        fillSelects();
        saved();
      }));
    }
    el('settings-doors-follow').addEventListener('change', guarded('Agent settings: doors and windows follow their wall', () => {
      settings = withDoorsFollowWall(settings, el('settings-doors-follow').checked);
      saved();
    }));
    for (const info of AGENT_INFO) {
      const { select } = cards.get(info.name);
      select.addEventListener('change', guarded(`Agent settings: ${info.name}`, () => {
        settings = withAgentLevel(settings, info.name, select.value);
        saved();
      }));
    }
  }

  // ---- Filling the page from the run ---------------------------------------------------------------------------------------------

  function fillStatuses(team, live, hasRun) {
    AGENT_INFO.forEach((info, index) => {
      const parts = cards.get(info.name);
      const s = statusOf(info.name, index, { live, team, hasRun });
      parts.status.textContent = `Status: ${s.long}`;
      parts.status.setAttribute('data-state', s.state);
      parts.card.setAttribute('data-state', s.state);
      const agent = team && Array.isArray(team.agents) ? team.agents.find((a) => a.name === info.name) : undefined;
      // The proposals the agent has already had answered. The one it is asking about now sits above, with its buttons.
      const rows = live && live.current === info.name ? proposalRows(agent).filter((r) => r.answer !== 'not answered') : proposalRows(agent);
      parts.history.replaceChildren(...rows.map((row) => {
        const item = make('li', `entry history-row${row.auto ? ' history-auto' : ''}`);
        item.append(make('span', row.tag === 'AI' ? 'source-tag source-tag-ai' : 'source-tag', row.tag));
        item.append(make('span', 'history-text', ` ${cleanIds(row.text)}${row.auto ? ' Auto-confirmed.' : ''}`));
        return item;
      }));
      parts.notes.replaceChildren(...noteRows(agent).map((t) => make('li', 'hint', cleanIds(t))));
    });
  }

  function fillLog(team, live) {
    const lines = live && live.rows && live.rows.length > 0 ? logFromRows(live.rows) : logFromTeam(team);
    const list = el('agents-log');
    if (lines.length === 0) {
      list.replaceChildren(make('li', 'hint', 'Nothing yet. The log fills while the agents work.'));
      return;
    }
    list.replaceChildren(...lines.map((line) => {
      const li = make('li', `log-row${line.auto ? ' log-auto' : ''}`);
      li.append(makeBadge(document, line.agent));
      li.append(make('span', 'log-text', ` ${line.agent}. ${cleanIds(line.text)}`));
      return li;
    }));
  }

  function fillHint(team, live, hasRun) {
    const hint = el('agents-run-hint');
    if (live) hint.textContent = `The agents are working on your project. ${live.current} is asking now.`;
    else if (team && team.scripted) hint.textContent = 'This is the sample. A fixed script, not a person, answered every proposal. Your own project asks you instead.';
    else if (hasRun) hint.textContent = 'This is the finished run of your project. Every proposal was answered.';
    else hint.textContent = 'No agent has run yet. On the last step of your project, press "Step through the eight agents".';
  }

  // Redraw everything from the current run.
  function refresh() {
    const live = tools.getLive();
    const team = tools.getTeamData();
    const hasRun = Boolean(team) || Boolean(live);
    attempt('Agents page: statuses', () => fillStatuses(team, live, hasRun));
    attempt('Agents page: log', () => fillLog(team, live));
    attempt('Agents page: hint', () => fillHint(team, live, hasRun));
  }

  // The design team screen calls this to put the list of live proposals into an agent's card (null: take them out again).
  function mountProposals(agentName) {
    const list = el('team-proposals');
    const parts = agentName ? cards.get(agentName) : undefined;
    if (parts) parts.slot.append(list);
    else el('team-run').append(list);
  }

  // Show one agent's card: used by the agent strip.
  function focusAgent(agentName) {
    const parts = cards.get(agentName);
    if (parts && typeof parts.title.focus === 'function') parts.title.focus();
  }

  attempt('Agents page: legend', () => { legendItems('agents-legend-list', true); legendItems('agent-legend-list', false); });
  attempt('Agents page: cards', () => el('agents-cards').replaceChildren(...AGENT_INFO.map(drawCard)));
  attempt('Agents page: settings', () => { fillControls(); setUpControls(); });
  refresh();

  return {
    refresh,
    mountProposals,
    focusAgent,
    getSettings: () => settings,
    // "Reset my settings" on the Settings page.
    resetSettings: (fresh) => { settings = fresh; fillControls(); },
    levelFor: (name) => levelFor(settings, name),
  };
}
