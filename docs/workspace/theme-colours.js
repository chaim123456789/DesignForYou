// Reads the 3D view's colours from the theme (docs/theme.css), so no colour is written in any script. When the page cannot say
// (a test page with no stylesheet), the neutral grey below is used for every colour.
const NEUTRAL = '#888888';

// One colour as a CSS string such as "#e69f00", from a theme variable name such as "--agent-walls".
export function readColour(name) {
  try {
    if (typeof getComputedStyle !== 'function' || typeof document === 'undefined' || !document.documentElement) return NEUTRAL;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : NEUTRAL;
  } catch {
    return NEUTRAL;
  }
}

// The names the 3D view uses. The values live in theme.css.
export const THREE_NAMES = Object.freeze({
  background: '--three-background',
  slab: '--three-slab',
  slabEdge: '--three-slab-edge',
  room: '--three-room',
  clash: '--three-clash',
  doorEdge: '--three-door-edge',
  windowEdge: '--three-window-edge',
  lockedEdge: '--three-locked-edge',
  sky: '--three-sky',
  ground: '--three-ground',
  neutral: '--three-neutral',
});

export function readThreeColours() {
  return Object.fromEntries(Object.entries(THREE_NAMES).map(([key, name]) => [key, readColour(name)]));
}
