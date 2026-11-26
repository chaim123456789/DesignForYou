// The only file of the page that keeps anything in the browser (look-and-feel L5). It stores two small things, in this browser only:
// the agent settings and the chosen theme (dark or light). Nothing about the user's project is stored here, and nothing is sent anywhere.
// If the browser has no storage, or refuses it (a private window, a full disk), the page works as before and the choice lasts until the
// page is closed. Reading and writing can never throw out of this file.
import { normalise, defaultSettings } from './settings.js?v=build-look-1';

export const SETTINGS_KEY = 'designforyou.agent-settings';
export const THEME_KEY = 'designforyou.theme';
export const THEMES = Object.freeze(['dark', 'light']);
export const DEFAULT_THEME = 'dark';

function storageOrNull() {
  try {
    const s = globalThis.localStorage;
    return s && typeof s.getItem === 'function' ? s : null;
  } catch {
    return null; // some browsers throw just for looking at it
  }
}

export function loadSettings(agentNames) {
  const storage = storageOrNull();
  if (!storage) return defaultSettings();
  try {
    const text = storage.getItem(SETTINGS_KEY);
    return text ? normalise(JSON.parse(text), agentNames) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

// Returns true when it was saved.
export function saveSettings(settings) {
  const storage = storageOrNull();
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadTheme() {
  const storage = storageOrNull();
  if (!storage) return DEFAULT_THEME;
  try {
    const value = storage.getItem(THEME_KEY);
    return THEMES.includes(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme) {
  const storage = storageOrNull();
  if (!storage || !THEMES.includes(theme)) return false;
  try {
    storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

// Forget both. Returns true when the browser accepted it.
export function clearSaved() {
  const storage = storageOrNull();
  if (!storage) return false;
  try {
    storage.removeItem(SETTINGS_KEY);
    storage.removeItem(THEME_KEY);
    return true;
  } catch {
    return false;
  }
}
