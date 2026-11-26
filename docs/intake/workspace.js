// The workspace around the screens (look-and-feel R1, R2, R5): the top bar (project name, Show/Hide ribbon, Full screen, theme toggle),
// the left rail (Project, Agents, Materials, Settings), the tabs of the result screen, and the colour mode.
//
// screens.js owns which screen is shown. This file only draws the frame around it and reports clicks back through `tools`.
// It stores nothing itself: the colour mode is kept through the store handed in (browser-store.js, the only file that may use
// the browser's storage). Everything shown goes on the page with textContent.
// Every part is its own protected step (attempt and guarded come from screens.js).

// The screens that belong to each section of the rail. Every other screen (the home page aside) belongs to Project.
const SECTION_OF = { agents: 'agents', materials: 'materials', settings: 'settings' };
export const SECTIONS = Object.freeze(['project', 'agents', 'materials', 'settings']);
export const sectionOf = (screenId) => SECTION_OF[screenId] || 'project';

export const THEMES = Object.freeze(['light', 'dark']);
const RIBBON_SHOWN = 'Hide ribbon';
const RIBBON_HIDDEN = 'Show ribbon';

export function setUpWorkspace(tools) {
  const { el, attempt, guarded, announce, openSection, store, themeKey, getViewer, prefersDark } = tools;

  const body = () => document.body;
  let theme = 'light';
  let screen = 'start';

  // ---- Which part of the page is shown --------------------------------------------------------------------------------------

  // Called by screens.js every time a screen is shown.
  function screenChanged(id) {
    screen = id;
    attempt('Workspace: home or workspace', () => { body().dataset.view = id === 'start' ? 'home' : 'workspace'; });
    attempt('Workspace: rail', () => {
      const section = sectionOf(id);
      for (const name of SECTIONS) {
        const button = el(`rail-${name}`);
        if (name === section && id !== 'start') button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    });
  }

  function setProjectName(text) {
    attempt('Workspace: project name', () => { el('ws-project-name').textContent = text; });
  }

  // ---- The ribbon -------------------------------------------------------------------------------------------------------------------
  let ribbonHidden = false;
  function setRibbon(hidden) {
    ribbonHidden = hidden;
    body().dataset.ribbon = hidden ? 'hidden' : 'shown';
    const button = el('toggle-ribbon');
    button.textContent = hidden ? RIBBON_HIDDEN : RIBBON_SHOWN;
    button.setAttribute('aria-expanded', String(!hidden));
    announce(hidden ? 'Ribbon hidden. The 3D view has more room.' : 'Ribbon shown.');
    redrawViewer();
  }

  // The 3D drawing resizes itself when its area changes (the viewer watches the size), so nothing more is needed here;
  // the viewer's own refresh is only called for the colours.
  function redrawViewer() {}

  // ---- Full screen for the 3D view ------------------------------------------------------------------------------------------------
  function fullScreenSupported() {
    const area = el('scene-area');
    return area && typeof area.requestFullscreen === 'function';
  }
  function isFullScreen() {
    return Boolean(document.fullscreenElement) && document.fullscreenElement === el('scene-area');
  }
  function toggleFullScreen() {
    if (isFullScreen()) {
      if (typeof document.exitFullscreen === 'function') document.exitFullscreen();
      return;
    }
    // The 3D view must be on screen first: a hidden element cannot go full screen.
    if (screen !== 'result') {
      openSection('project');
      if (el('screen-result').hidden) {
        announce('There is no 3D view to show yet. Try the sample, or run your project first.');
        return;
      }
    }
    if (!fullScreenSupported()) {
      announce('Full screen is not available in this browser. Use the browser\'s own full screen instead.');
      return;
    }
    const result = el('scene-area').requestFullscreen();
    if (result && typeof result.catch === 'function') {
      result.catch(() => announce('The browser did not allow full screen.'));
    }
  }
  function fullScreenChanged() {
    el('fullscreen-button').textContent = isFullScreen() ? 'Exit full screen' : 'Full screen';
  }

  // ---- Colour mode ----------------------------------------------------------------------------------------------------------------------
  function applyTheme(next, { save = true } = {}) {
    theme = THEMES.includes(next) ? next : 'light';
    body().dataset.theme = theme;
    el('theme-toggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    attempt('Workspace: theme select', () => { el('theme-select').value = theme; });
    if (save && store) attempt('Workspace: saving the colour mode', () => store.write(themeKey, theme));
    // The 3D view takes its colours from theme.css, so it is told to read them again.
    attempt('Workspace: 3D colours', () => {
      const viewer = getViewer();
      if (viewer && typeof viewer.refreshTheme === 'function') viewer.refreshTheme();
    });
  }
  function initialTheme() {
    let saved = null;
    if (store) attempt('Workspace: reading the colour mode', () => { saved = store.read(themeKey); });
    if (THEMES.includes(saved)) return saved;
    return typeof prefersDark === 'function' && prefersDark() ? 'dark' : 'light';
  }

  // ---- The tabs of the result screen -----------------------------------------------------------------------------------------------------
  const PANES = ['view', 'details', 'summary'];
  function setPane(name) {
    const pane = PANES.includes(name) ? name : 'view';
    body().dataset.resultPane = pane;
    for (const p of PANES) el(`tab-${p}`).setAttribute('aria-selected', String(p === pane));
  }
  // Own projects have a summary tab. The sample has none.
  function setSummaryTab(visible) {
    el('tab-summary').hidden = !visible;
    if (!visible && body().dataset.resultPane === 'summary') setPane('view');
  }

  // ---- Set up ------------------------------------------------------------------------------------------------------------------------------
  attempt('Workspace: rail buttons', () => {
    for (const name of SECTIONS) el(`rail-${name}`).addEventListener('click', guarded(`Rail: ${name}`, () => openSection(name)));
  });
  attempt('Workspace: ribbon button', () => { el('toggle-ribbon').addEventListener('click', guarded('Show or hide the ribbon', () => setRibbon(!ribbonHidden))); });
  attempt('Workspace: full screen button', () => {
    el('fullscreen-button').addEventListener('click', guarded('Full screen', toggleFullScreen));
    if (typeof document.addEventListener === 'function') document.addEventListener('fullscreenchange', guarded('Full screen changed', fullScreenChanged));
  });
  attempt('Workspace: theme button', () => {
    el('theme-toggle').addEventListener('click', guarded('Theme toggle', () => {
      applyTheme(theme === 'dark' ? 'light' : 'dark');
      announce(`${theme === 'dark' ? 'Dark' : 'Light'} mode.`);
    }));
    el('theme-select').addEventListener('change', guarded('Theme select', () => {
      applyTheme(el('theme-select').value);
      announce(`${theme === 'dark' ? 'Dark' : 'Light'} mode.`);
    }));
  });
  attempt('Workspace: result tabs', () => {
    for (const p of PANES) el(`tab-${p}`).addEventListener('click', guarded(`Result tab: ${p}`, () => setPane(p)));
  });
  attempt('Workspace: first drawing', () => {
    body().dataset.ribbon = 'shown';
    setPane('view');
    applyTheme(initialTheme(), { save: false });
  });

  return { screenChanged, setProjectName, setPane, setSummaryTab, applyTheme, theme: () => theme, ribbonHidden: () => ribbonHidden };
}
