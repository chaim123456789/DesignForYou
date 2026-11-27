// What the page shows about each of the eight agents: a letter, a shape, a colour name and a plain sentence about what it owns.
// The agent names and their order come from the design team's registry (docs/team/data.js). This file only adds how an agent looks.
// The colours themselves are not here: they are the --agent-* names in docs/theme.css. The letter and the shape are the signals that do not
// depend on colour. Pure data and small functions: no page code.

export const AGENT_INFO = Object.freeze([
  { name: 'Walls', key: 'walls', letter: 'W', shape: 'square', owns: 'The walls: how long they are and how big each room is.' },
  { name: 'Doors and windows', key: 'doors', letter: 'D', shape: 'diamond', owns: 'Doors and windows: where they sit on a wall, how they open and how much daylight they give.' },
  { name: 'Floors and ceilings', key: 'floors', letter: 'C', shape: 'hexagon', owns: 'Floor surfaces, ceiling heights and the thresholds between rooms.' },
  { name: 'Lighting and electrical', key: 'lighting', letter: 'L', shape: 'triangle', owns: 'Lights, switches and sockets.' },
  { name: 'Furniture', key: 'furniture', letter: 'F', shape: 'circle', owns: 'Where each piece of furniture stands and how much room it leaves around it.' },
  { name: 'Decor', key: 'decor', letter: 'E', shape: 'pentagon', owns: 'Rugs, curtains and things hung on walls.' },
  { name: 'Style', key: 'style', letter: 'S', shape: 'octagon', owns: 'Colours, materials and the overall look. It also checks that notes do not fight each other.' },
  { name: 'Reviewer', key: 'reviewer', letter: 'R', shape: 'cross', owns: 'Checks everyone\'s work and reports clashes. It never edits another agent\'s items.' },
]);

const BY_NAME = new Map(AGENT_INFO.map((a) => [a.name, a]));

// The look of an agent by its name, or undefined for a name that is not one of the eight (the old four-agent run uses others).
export function infoFor(name) {
  return BY_NAME.get(name);
}

// The CSS colour name (from theme.css) for an agent, or the neutral colour for an unknown owner.
export function colourVar(name) {
  const info = infoFor(name);
  return info ? `var(--agent-${info.key})` : 'var(--agent-neutral)';
}

// The same colour as a theme variable name, for code that reads the real colour value (the 3D view).
export function colourName(name) {
  const info = infoFor(name);
  return info ? `--agent-${info.key}` : '--agent-neutral';
}

// A short word for the letter badge in text: "W Walls".
export function badgeText(name) {
  const info = infoFor(name);
  return info ? `${info.letter} ${info.name}` : name;
}

// A badge element: the letter inside the agent's shape and colour. Hidden from screen readers because the name is always written next to it.
export function makeBadge(document, name, extraClass = '') {
  const info = infoFor(name);
  const badge = document.createElement('span');
  badge.className = `agent-badge ${extraClass}`.trim();
  badge.textContent = info ? info.letter : '?';
  badge.setAttribute('aria-hidden', 'true');
  badge.setAttribute('data-agent', info ? info.key : 'neutral');
  badge.setAttribute('data-shape', info ? info.shape : 'circle');
  return badge;
}
