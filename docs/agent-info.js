// How each of the eight agents LOOKS (look-and-feel R3): its letter badge, its shape, what it owns, and the name of its colour in
// theme.css. This file holds no colour value: the colours are in docs/theme.css (--agent-walls, ...), so one file restyles them.
//
// Colour is never the only signal. Every agent has its own colour AND its own letter AND its own shape. The colours are the
// colour-blind-safe set of Okabe and Ito (see theme.css).
//
// The agent names and their order are the ones in src/agents/registry.json (the one place the order is written). This file only adds the
// look. A test checks that the names and the order here are the same as in the registry.
// Pure data and two small helpers. Used by the viewer page script and by the intake page scripts.

export const AGENTS = Object.freeze([
  { name: 'Walls', key: 'walls', letter: 'W', shape: 'square', colourVar: '--agent-walls', inkVar: '--agent-walls-ink', owns: 'Wall segments, wall thickness and the size of each room.' },
  { name: 'Doors and windows', key: 'doors', letter: 'D', shape: 'tab', colourVar: '--agent-doors', inkVar: '--agent-doors-ink', owns: 'Doors and windows: where they sit in a wall and which way a door swings.' },
  { name: 'Floors and ceilings', key: 'floors', letter: 'C', shape: 'rounded', colourVar: '--agent-floors', inkVar: '--agent-floors-ink', owns: 'Floor surfaces, thresholds and ceiling heights.' },
  { name: 'Lighting and electrical', key: 'lighting', letter: 'L', shape: 'circle', colourVar: '--agent-lighting', inkVar: '--agent-lighting-ink', owns: 'Lights, switches and sockets.' },
  { name: 'Furniture', key: 'furniture', letter: 'F', shape: 'pill', colourVar: '--agent-furniture', inkVar: '--agent-furniture-ink', owns: 'Furniture and where it stands.' },
  { name: 'Decor', key: 'decor', letter: 'E', shape: 'leaf', colourVar: '--agent-decor', inkVar: '--agent-decor-ink', owns: 'Rugs, curtains and things on the walls.' },
  { name: 'Style', key: 'style', letter: 'S', shape: 'drop', colourVar: '--agent-style', inkVar: '--agent-style-ink', owns: 'Your style notes and whether the other items fit them.' },
  { name: 'Reviewer', key: 'reviewer', letter: 'R', shape: 'notch', colourVar: '--agent-reviewer', inkVar: '--agent-reviewer-ink', owns: 'The review report: clashes, things kept as they are, and Locked items that need your look.' },
]);

export const agentByName = (name) => AGENTS.find((a) => a.name === name);
export const agentByKey = (key) => AGENTS.find((a) => a.key === key);

// The agent for an owner name from the Project Brain. An owner that is not one of the eight (the older four-agent pipeline has
// "Layout" and "Builder") has no agent look: the caller then uses its neutral colour and no badge.
export const agentOfOwner = (owner) => agentByName(owner);

// The badge: a small element that shows the agent's colour (from the stylesheet, by data-agent), its letter and its shape.
// make(tag, className, text) creates an element. The badge is hidden from screen readers because the name always sits next to it.
export function makeBadge(make, agent, { small = false } = {}) {
  const badge = make('span', small ? 'badge badge-small' : 'badge', agent.letter);
  badge.setAttribute('data-agent', agent.key);
  badge.setAttribute('data-shape', agent.shape);
  badge.setAttribute('aria-hidden', 'true');
  return badge;
}

// The small legend: one item per agent, with its badge and its name.
export function fillLegend(list, make) {
  list.replaceChildren(...AGENTS.map((agent) => {
    const li = make('li', 'agent-legend-item');
    li.append(makeBadge(make, agent, { small: true }), make('span', '', `${agent.name} (${agent.letter})`));
    return li;
  }));
}
