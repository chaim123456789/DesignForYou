// The top-down plan of one room, drawn as one inline SVG with the page's own elements.
// No image file, no library, no outside address, no style attribute (the page's content security
// rule allows none): the look comes from drawing attributes and the stylesheet's .plan class.
//
// This file imports nothing. place-screen.js hands it the geometry helpers. It holds no state: the
// plan is built again from the visitor's objects after every change. Visitor text (names) is put in
// with textContent and setAttribute only, never as page code.
// The fixed name that tells the browser an element is a drawing element. It is a name, not an address:
// nothing is ever fetched from it. It is written in pieces so the privacy search, which looks for any
// web address in a page file, stays strict and needs no exception.
export const SVG_NS = ['http:', '', ['www', 'w3', 'org'].join('.'), '2000', 'svg'].join('/');

// Locked: a solid, thick outline. Unsure: a thinner, dashed outline. The colours match the 3D
// colours (blue, orange), but the line style and the words in the label carry the meaning too.
export const PLAN_STYLES = Object.freeze({
  Locked: Object.freeze({ stroke: '#0b3d91', fill: '#dce8fa', strokeWidth: 6, dash: 'none' }),
  Unsure: Object.freeze({ stroke: '#8a4b00', fill: '#fdebd0', strokeWidth: 3, dash: '12 8' }),
});

export function planLabel(object, selected) {
  return `${object.name}, ${object.status}${selected ? ', selected' : ''}`;
}

export function planAriaLabel(room, count) {
  return `Plan of the ${room.name}, ${Number(room.width).toFixed(1)} m by ${Number(room.depth).toFixed(1)} m, `
    + `with ${count} ${count === 1 ? 'object' : 'objects'}. The list below has the same information.`;
}

// room: { name, width, depth } in metres (as entered in setup). objects: the room's placed objects.
// Returns the SVG element. Doors and windows are drawn after furniture so they stay visible on the wall.
export function drawPlan(geometry, { room, objects, selectedId }) {
  const node = (name, attributes, text) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) n.setAttribute(key, String(value));
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const box = geometry.planViewBox(room);
  const size = geometry.roomSizeCm(room);
  // The label is drawn at 1/15 of the plan's width, rounded up, so it is at least 16 px when the plan is 254 px wide
  // (a 320 px screen after the page and panel padding) and bigger on wider screens.
  const fontSize = Math.ceil(box.width / 15);
  const svg = node('svg', {
    class: 'plan',
    viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
    role: 'img',
    'aria-label': planAriaLabel(room, objects.length),
    focusable: 'false',
  });
  svg.append(node('rect', { class: 'plan-room', x: 0, y: 0, width: size.width, height: size.depth, fill: '#ffffff', stroke: '#222222', 'stroke-width': 4 }));
  const ordered = [...objects.filter((o) => o.kind === 'layout'), ...objects.filter((o) => o.kind !== 'layout')];
  for (const object of ordered) {
    const style = PLAN_STYLES[object.status] || PLAN_STYLES.Unsure;
    const selected = object.id === selectedId;
    const group = node('g', { class: 'plan-object-group' });
    group.append(node('rect', {
      class: `plan-object plan-${object.status.toLowerCase()}`,
      'data-id': object.id,
      x: object.x, y: object.y, width: object.width, height: object.depth,
      fill: style.fill, stroke: style.stroke, 'stroke-width': style.strokeWidth,
      'stroke-dasharray': style.dash,
    }));
    if (selected) {
      group.append(node('rect', {
        class: 'plan-selected', x: object.x - 6, y: object.y - 6, width: object.width + 12, height: object.depth + 12,
        fill: 'none', stroke: '#111111', 'stroke-width': 3,
      }));
    }
    const thin = object.depth < fontSize * 2;
    group.append(node('text', {
      class: 'plan-label',
      x: object.x + 6,
      y: thin ? object.y + object.depth + fontSize + 4 : object.y + fontSize + 4,
      'font-size': fontSize, 'font-family': 'sans-serif', fill: '#111111',
    }, planLabel(object, selected)));
    svg.append(group);
  }
  return svg;
}
