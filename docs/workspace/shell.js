// The workspace around the project (look-and-feel L1 to L3): the home page and workspace switch, the top bar (project name,
// Show/Hide ribbon, Full screen, theme toggle), the left rail (Project, Agents, Materials, Settings), the phone tabs, the result tabs,
// and the slim agent strip on the right. The page itself does not scroll: each page scrolls inside its own area.
//
// It changes nothing about a project. Every part is its own protected step (attempt and guarded come from screens.js).
import { AGENT_INFO, makeBadge } from './agents-info.js?v=build-look-1';
import { statusOf } from './agent-status.js?v=build-look-1';
import { DEFAULT_THEME, THEMES, loadTheme, saveTheme } from './store.js?v=build-look-1';

const PAGES = Object.freeze(['project', 'agents', 'materials', 'settings']);
const PAGE_HEADINGS = Object.freeze({ project: null, agents: 'heading-agents', materials: 'heading-materials', settings: 'heading-settings' });
const PAGE_TITLES = Object.freeze({ project: 'Project', agents: 'Agents', materials: 'Materials', settings: 'Settings' });

const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// tools: { el, attempt, guarded, getProjectName, getScreenTitle, getViewer, showStart, getLiveAndTeam, focusAgent }
export function setUpShell(tools) {
  const { el, attempt, guarded } = tools;
  let page = 'project';
  let theme = DEFAULT_THEME;
  let ribbonShown = true;
  let fullscreen = false;
  let onPage = () => {};

  // ---- Theme ---------------------------------------------------------------------------------------------------------------------

  function applyTheme(next, { save = true } = {}) {
    if (!THEMES.includes(next)) return;
    theme = next;
    attempt('Theme: page', () => { document.documentElement.setAttribute('data-theme', theme); });
    attempt('Theme: buttons', () => {
      const toggle = el('theme-toggle');
      toggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      toggle.setAttribute('aria-pressed', String(theme === 'light'));
      el('settings-theme-dark').setAttribute('aria-pressed', String(theme === 'dark'));
      el('settings-theme-light').setAttribute('aria-pressed', String(theme === 'light'));
    });
    if (save) saveTheme(theme);
    // The 3D view takes its colours from the theme, so it draws again.
    const viewer = tools.getViewer();
    if (viewer && typeof viewer.refreshTheme === 'function') attempt('Theme: 3D view', () => viewer.refreshTheme());
  }

  // ---- Pages ---------------------------------------------------------------------------------------------------------------------

  function showPage(next, { moveFocus = false } = {}) {
    if (!PAGES.includes(next)) throw new Error(`There is no page called ${next}.`);
    page = next;
    attempt('Pages', () => {
      for (const name of PAGES) {
        el(`page-${name}`).hidden = name !== next;
        const current = name === next ? 'page' : null;
        for (const id of [`rail-${name}`, `tab-${name}`]) {
          if (current) el(id).setAttribute('aria-current', current);
          else el(id).removeAttribute('aria-current');
        }
      }
      document.body.dataset.page = next;
    });
    attempt('Pages: title', () => { document.title = `${next === 'project' ? tools.getScreenTitle() : PAGE_TITLES[next]} - DesignForYou`; });
    onPage(next);
    if (moveFocus && PAGE_HEADINGS[next]) attempt('Pages: focus', () => el(PAGE_HEADINGS[next]).focus());
  }

  // ---- Home or workspace ---------------------------------------------------------------------------------------------------------

  // Called by screens.js each time a screen is shown. The start screen is the home page; every other screen is in the workspace.
  function onScreen(id) {
    attempt('Workspace: home or workspace', () => { el('workspace').hidden = id === 'start'; });
    attempt('Workspace: project name', updateProjectName);
    if (id !== 'start') showPage('project');
    attempt('Workspace: result tabs', () => updateResultTabs(id));
    attempt('Workspace: strip', refreshStrip);
  }

  function updateProjectName() {
    el('workspace-project-name').textContent = tools.getProjectName();
  }

  // ---- Result tabs: 3D view, Details (phone), Report (your own project) ----------------------------------------------------------

  let resultTab = '3d';
  function setResultTab(tab) {
    resultTab = tab;
    el('screen-result').setAttribute('data-result-tab', tab);
    for (const button of [el('tab-3d'), el('tab-details'), el('tab-report')]) {
      button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
    }
  }
  function updateResultTabs(id) {
    const own = document.body.dataset.run === 'own';
    el('tab-report').hidden = !own;
    if (!own && resultTab === 'report') setResultTab('3d');
    if (id === 'result' && own && resultTab !== 'report' && resultTab !== '3d') setResultTab('3d');
  }

  // ---- Ribbon and full screen ----------------------------------------------------------------------------------------------------

  function setRibbon(shown) {
    ribbonShown = shown;
    el('ribbon').hidden = !shown;
    const button = el('ribbon-toggle');
    button.textContent = shown ? 'Hide ribbon' : 'Show ribbon';
    button.setAttribute('aria-pressed', String(shown));
  }

  function setFullscreen(on) {
    fullscreen = on;
    const stage = el('stage');
    stage.className = on ? 'stage is-fullscreen' : 'stage';
    const button = el('fullscreen-button');
    button.textContent = on ? 'Exit full screen' : 'Full screen';
    button.setAttribute('aria-pressed', String(on));
  }

  // The browser's full screen is tried first. If it is not there or is refused, the 3D view fills the workspace instead.
  async function toggleFullscreen() {
    const stage = el('stage');
    const real = typeof document.fullscreenElement !== 'undefined' && typeof stage.requestFullscreen === 'function';
    if (fullscreen) {
      if (real && document.fullscreenElement && typeof document.exitFullscreen === 'function') await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    if (page !== 'project') showPage('project');
    setFullscreen(true);
    if (real) {
      try {
        await stage.requestFullscreen();
      } catch {
        // refused: the in-page full view stays
      }
    }
  }

  // ---- The agent strip -----------------------------------------------------------------------------------------------------------

  const stripParts = new Map();
  function drawStrip() {
    const list = el('agent-strip-list');
    list.replaceChildren(...AGENT_INFO.map((info) => {
      const li = make('li', 'strip-item');
      const button = make('button', 'strip-button');
      button.type = 'button';
      button.id = `strip-${info.key}`;
      button.append(makeBadge(document, info.name));
      const text = make('span', 'strip-text');
      const name = make('span', 'strip-name', info.name);
      const status = make('span', 'strip-status');
      text.append(name, status);
      button.append(text);
      button.addEventListener('click', guarded(`Agent strip: ${info.name}`, () => {
        showPage('agents', { moveFocus: false });
        if (typeof tools.focusAgent === 'function') tools.focusAgent(info.name);
      }));
      li.append(button);
      stripParts.set(info.name, { button, status });
      return li;
    }));
  }

  function refreshStrip() {
    const { live, team } = tools.getLiveAndTeam();
    AGENT_INFO.forEach((info, index) => {
      const parts = stripParts.get(info.name);
      if (!parts) return;
      const s = statusOf(info.name, index, { live, team, hasRun: Boolean(team) || Boolean(live) });
      parts.status.textContent = s.short;
      parts.button.setAttribute('aria-label', `${info.name}. ${s.short}. Open the Agents page.`);
      parts.button.setAttribute('data-state', s.state);
    });
  }

  // ---- Set up --------------------------------------------------------------------------------------------------------------------

  attempt('Workspace: theme', () => applyTheme(loadTheme(), { save: false }));
  attempt('Workspace: agent strip', drawStrip);
  attempt('Workspace: rail and phone tabs', () => {
    for (const name of PAGES) {
      for (const id of [`rail-${name}`, `tab-${name}`]) {
        el(id).addEventListener('click', guarded(`Page button ${id}`, () => showPage(name, { moveFocus: true })));
      }
    }
  });
  attempt('Workspace: home button', () => el('home-button').addEventListener('click', guarded('Home button', () => tools.showStart())));
  attempt('Workspace: ribbon button', () => el('ribbon-toggle').addEventListener('click', guarded('Show or hide the ribbon', () => setRibbon(!ribbonShown))));
  attempt('Workspace: full screen button', () => el('fullscreen-button').addEventListener('click', guarded('Full screen button', toggleFullscreen)));
  attempt('Workspace: theme buttons', () => {
    el('theme-toggle').addEventListener('click', guarded('Theme button', () => applyTheme(theme === 'dark' ? 'light' : 'dark')));
    el('settings-theme-dark').addEventListener('click', guarded('Theme: dark', () => applyTheme('dark')));
    el('settings-theme-light').addEventListener('click', guarded('Theme: light', () => applyTheme('light')));
  });
  attempt('Workspace: result tabs', () => {
    for (const id of ['tab-3d', 'tab-details', 'tab-report']) {
      el(id).addEventListener('click', guarded(`Result tab ${id}`, () => setResultTab(el(id).dataset.tab)));
    }
  });
  attempt('Workspace: leaving full screen', () => {
    // Escape leaves the in-page full view too. The browser's own full screen reports itself through fullscreenchange.
    document.addEventListener('keydown', guarded('Full screen: Escape', (event) => {
      if (event && event.key === 'Escape' && fullscreen && !document.fullscreenElement) setFullscreen(false);
    }));
    document.addEventListener('fullscreenchange', guarded('Full screen: change', () => {
      if (fullscreen && !document.fullscreenElement) setFullscreen(false);
    }));
  });
  attempt('Workspace: ribbon', () => setRibbon(true));
  attempt('Workspace: first page', () => showPage('project'));

  return {
    showPage,
    onScreen,
    applyTheme,
    refreshStrip,
    updateProjectName,
    setResultTab,
    onPage: (fn) => { onPage = fn; },
    getPage: () => page,
    getTheme: () => theme,
    isRibbonShown: () => ribbonShown,
    isFullscreen: () => fullscreen,
  };
}
