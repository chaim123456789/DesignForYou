// Pure maths for the "Place furniture, doors and windows" screen. No page code, no Three.js.
// All lengths are whole centimetres unless a name says metres.
// The Reviewer has its own small copy of the overlap and inside tests, because the engine
// must not import from docs/intake/.
import { LIMITS } from './limits.js';

// Centimetres to metres, for the Project Brain (positions there are in metres).
export function cmToMetres(cm) {
  return cm / 100;
}

// A placed object's footprint in metres, in the same shape the sample uses.
export function toBrainPosition(object) {
  return {
    x: cmToMetres(object.x),
    y: cmToMetres(object.y),
    width: cmToMetres(object.width),
    depth: cmToMetres(object.depth),
  };
}

// A room's size in whole centimetres. The setup form keeps metres.
export function roomSizeCm(room) {
  return { width: Math.round(room.width * 100), depth: Math.round(room.depth * 100) };
}

// The plan's drawing area: the room plus a margin on every side, in centimetres.
export const PLAN_MARGIN_CM = 30;
export function planViewBox(room) {
  const size = roomSizeCm(room);
  return {
    x: -PLAN_MARGIN_CM,
    y: -PLAN_MARGIN_CM,
    width: size.width + 2 * PLAN_MARGIN_CM,
    height: size.depth + 2 * PLAN_MARGIN_CM,
  };
}

// A click or tap on the plan. point: { clientX, clientY }. rect: the drawn plan's box on the screen
// { left, top, width, height } (its height keeps the view box's shape). viewBox: from planViewBox.
// Returns the position of the object's top-left corner in centimetres, rounded to the nearest 10 cm
// and kept inside the allowed position range. A box with no size gives null.
export function clickToPosition(point, rect, viewBox) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const cmX = viewBox.x + ((point.clientX - rect.left) / rect.width) * viewBox.width;
  const cmY = viewBox.y + ((point.clientY - rect.top) / rect.height) * viewBox.height;
  const step = LIMITS.nudgeStep;
  const snap = (value) => {
    const rounded = Math.round(value / step) * step;
    return Math.min(LIMITS.placedPosMax, Math.max(LIMITS.placedPosMin, rounded)) + 0; // + 0 turns -0 into 0
  };
  return { x: snap(cmX), y: snap(cmY) };
}

// True when the whole footprint lies inside the room. Touching a wall is inside.
export function isInsideRoom(object, room) {
  const size = roomSizeCm(room);
  return object.x >= 0 && object.y >= 0
    && object.x + object.width <= size.width
    && object.y + object.depth <= size.depth;
}

// True when two footprints share some area. Touching edges do not count.
export function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.depth && b.y < a.y + a.depth;
}

// The plain-words sentence for one object, used in the object list.
// room (optional, in the setup form's shape: metres) lets the sentence say when the object sticks out.
export function describePlaced(object, room) {
  const status = object.status;
  let text = `${object.name} (${object.type}), ${status}. `
    + `${object.x} cm from the left, ${object.y} cm from the top, `
    + `${object.width} cm wide, ${object.depth} cm deep, turned ${object.turn} degrees.`;
  if (room && !isInsideRoom(object, room)) text += ' Sticks out of the room.';
  return text;
}
