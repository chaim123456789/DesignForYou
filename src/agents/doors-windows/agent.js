// The Doors and windows agent (design-team B2). Second in the team. It owns the `door` and `window` items.
// A fixed, rule-based step: no AI, no randomness, no clock. Its numbers come from src/knowledge/doors-windows/.
//
// It reads the walls (the room size and which walls face outside) and its own items. It never reads a later agent's items.
// The doors and windows the user placed are the starting positions. For each one it checks, in this order, and proposes
// a fix for the first problem it finds (so one item never has two proposals at once):
//   1. The opening is on a wall.            (not-on-wall)
//   2. It fits the wall and keeps a gap to the corners.   (fit-wall, corner-distance)
//   3. A door's swing square fits in the room and does not hit another door's swing.   (swing-room, swing-clash)
// A room that needs daylight (living room, bedroom, kitchen, ...) and has no window gets a daylight proposal for its window slot.
// An opening whose room has no known size is skipped: the agent does not guess a size.
import { loadKnowledge } from '../../knowledge/load.js';
import {
  roomsOf, roomTypeOf, ruleForType, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, mm,
  SIDES, distancesToWalls, openingSide, alongWall, placeOnWall, overlaps,
} from '../common.js';
import { buildProposal } from '../../proposal.js';

export const DOORS_WINDOWS = 'Doors and windows';

export function loadDoorsWindowsKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    doors: loadKnowledge('doors-windows/door-sizes.json').rules,
    swing: loadKnowledge('doors-windows/swing-clearance.json').rules,
    daylight: loadKnowledge('doors-windows/window-daylight.json').rules,
  };
}

const kindWord = (kind) => (kind === 'door' ? 'door' : 'window');
const prefix = (kind) => (kind === 'door' ? 'doors' : 'windows');

// The free square a door needs inside the room when it swings in.
function swingSquare(side, along, size) {
  const w = along.width;
  if (side === 'north') return { x: along.start, y: 0, width: w, depth: w };
  if (side === 'south') return { x: along.start, y: size.depth - w, width: w, depth: w };
  if (side === 'west') return { x: 0, y: along.start, width: w, depth: w };
  return { x: size.width - w, y: along.start, width: w, depth: w };
}

export function makeDoorsWindowsAgent(knowledge = loadDoorsWindowsKnowledge()) {
  const k = knowledge;
  const tol = ruleById(k.doors, 'doors-on-wall-tolerance').then;
  const corner = { door: ruleById(k.swing, 'doors-corner-distance').then.minCorner, window: ruleById(k.swing, 'windows-corner-distance').then.minCorner };
  const swingRule = ruleById(k.swing, 'doors-swing').then;
  const windowDefault = ruleById(k.daylight, 'windows-default').then;

  function agent(view, context) {
    const mode = context && context.mode;
    const rooms = roomsOf(view);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const wallOf = new Map(rooms.map((r) => [r.id, wallItemOf(view, r.id)]));
    const sizeInRoom = (roomId) => (roomById.has(roomId) ? sizeOf(roomById.get(roomId), wallOf.get(roomId)) : null);
    const mine = view.items.filter((i) => (i.kind === 'door' || i.kind === 'window') && i.owner === DOORS_WINDOWS);
    const openings = mine.filter((i) => i.value && i.value.position && !i.value.placeholder);
    const proposals = [];
    // The only items this agent looks at: walls (earlier) and its own doors and windows.
    const seen = view.items.filter((i) => i.kind === 'wall' || i.kind === 'door' || i.kind === 'window');

    const add = (item, ruleId, why, confidence, options) => {
      if (options.some((o) => sameValue(o.newValue, item.value))) return;
      proposals.push(buildProposal({
        id: proposalId(prefix(item.kind), item.id, ruleId, mode), agent: DOORS_WINDOWS, itemId: item.id, why, source: 'rule', ruleId, confidence, options,
      }, { items: seen }));
    };

    // The doors a door's swing must not hit: earlier doors of the room, and Locked doors (which cannot move), that swing in
    // and sit on a wall. When two doors clash, only the later one gets the proposal, so the two do not both move.
    const swingsIn = (roomId, size, exceptId) => openings
      .filter((o, index) => o.kind === 'door' && o.room === roomId && o.id !== exceptId && o.value.swing !== 'out'
        && (openings.indexOf(openings.find((x) => x.id === exceptId)) > index || o.status === 'Locked'))
      .map((o) => {
        const side = openingSide(o.value.position, size, tol.tolerance);
        return side ? { id: o.id, rect: swingSquare(side, alongWall(o.value.position, size, side), size) } : null;
      }).filter(Boolean);

    for (const item of openings) {
      if (!editable(item) || !inScope(item, context)) continue;
      const size = sizeInRoom(item.room);
      if (!size) continue;
      const word = kindWord(item.kind);
      const name = item.value.name || word;
      const roomName = roomById.get(item.room).name;
      const minCorner = corner[item.kind];
      const pos = item.value.position;
      const side = openingSide(pos, size, tol.tolerance);

      // 1. Not on a wall.
      if (!side) {
        const d = distancesToWalls(pos, size);
        const ranked = SIDES.slice().sort((a, b) => Math.abs(d[a]) - Math.abs(d[b]) || SIDES.indexOf(a) - SIDES.indexOf(b));
        const across = (s) => (s === 'north' || s === 'south' ? pos.depth : pos.width);
        const options = ranked.slice(0, 2).map((s) => {
          const along = s === 'north' || s === 'south' ? { start: pos.x, width: pos.width } : { start: pos.y, width: pos.depth };
          const wallLength = s === 'north' || s === 'south' ? size.width : size.depth;
          const start = Math.min(Math.max(along.start, minCorner), Math.max(minCorner, wallLength - along.width - minCorner));
          return { id: `to-${s}`, label: `Move the ${name} to the ${s} wall`, newValue: { ...item.value, position: placeOnWall(size, s, start, along.width, across(s)), wall: s } };
        });
        const close = Math.abs(d[ranked[0]]) + tol.ambiguousWithin >= Math.abs(d[ranked[1]]);
        add(item, `${prefix(item.kind)}-not-on-wall`, `The ${name} in the ${roomName} is not on a wall. Put it on the ${ranked[0]} wall${close ? ` or the ${ranked[1]} wall` : ''}.`,
          close ? 'low' : 'high', close ? options : options.slice(0, 1));
        continue;
      }

      // 2. Fits the wall, with a gap to the corners.
      const along = alongWall(pos, size, side);
      const lowest = minCorner;
      const highest = along.wallLength - along.width - minCorner;
      const across = side === 'north' || side === 'south' ? pos.depth : pos.width;
      const moveTo = (start, width) => ({ ...item.value, position: placeOnWall(size, side, start, width, across), wall: side });
      if (highest < lowest) {
        const narrow = mm(along.wallLength - 2 * minCorner);
        if (narrow > 0) {
          add(item, `${prefix(item.kind)}-fit-wall`,
            `The ${name} (${along.width} m) is too wide for the ${side} wall of the ${roomName} (${mm(along.wallLength)} m) with a gap to each corner. Make it ${narrow} m wide.`, 'high', [
              { id: 'narrower', label: `Make the ${name} ${narrow} m wide and centre it`, newValue: moveTo(mm((along.wallLength - narrow) / 2), narrow) },
            ]);
        }
        continue;
      }
      if (along.start < lowest - 1e-9 || along.start > highest + 1e-9) {
        const outside = along.start < 0 || along.start + along.width > along.wallLength;
        const nearest = Math.min(Math.max(along.start, lowest), highest);
        const centre = (along.wallLength - along.width) / 2;
        const options = [{ id: 'move-clear', label: `Move the ${name} ${mm(Math.abs(nearest - along.start))} m along the ${side} wall, clear of the corner`, newValue: moveTo(nearest, along.width) }];
        if (mm(centre) !== mm(nearest)) options.push({ id: 'centre', label: `Centre the ${name} on the ${side} wall`, newValue: moveTo(centre, along.width) });
        add(item, `${prefix(item.kind)}-${outside ? 'fit-wall' : 'corner-distance'}`,
          outside
            ? `The ${name} in the ${roomName} runs past the end of the ${side} wall. Move it back onto the wall.`
            : `The ${name} in the ${roomName} is closer to a corner than ${minCorner} m. Move it clear of the corner.`, 'high', options);
        continue;
      }

      // 3. A door's swing.
      if (item.kind === 'door' && item.value.swing !== 'out') {
        const mySwing = swingSquare(side, along, size);
        const outward = { id: 'swing-out', label: `Make the ${name} open outward`, newValue: { ...item.value, swing: 'out', wall: side } };
        const fitsRoom = mySwing.x >= -1e-9 && mySwing.y >= -1e-9 && mySwing.x + mySwing.width <= size.width + 1e-9 && mySwing.y + mySwing.depth <= size.depth + 1e-9;
        if (!fitsRoom) {
          add(item, 'doors-swing-room', `The ${name} needs a free square ${along.width} m wide to open into the ${roomName}, which is too small. Open it outward.`, 'high', [outward]);
          continue;
        }
        const others = swingsIn(item.room, size, item.id);
        const hits = (r) => others.some((o) => overlaps(r, o.rect));
        if (hits(mySwing)) {
          // Try other places along the same wall, nearest first, in steps from the knowledge file.
          let slide = null;
          for (let step = 1; slide === null && step * swingRule.slideStep <= along.wallLength; step += 1) {
            const offsets = [step * swingRule.slideStep, -step * swingRule.slideStep];
            for (const off of offsets) {
              const start = mm(along.start + off);
              if (start < lowest - 1e-9 || start > highest + 1e-9) continue;
              if (!hits(swingSquare(side, { ...along, start }, size))) { slide = start; break; }
            }
          }
          const options = [];
          if (slide !== null) options.push({ id: 'slide', label: `Slide the ${name} ${mm(Math.abs(slide - along.start))} m along the ${side} wall so its swing is clear`, newValue: moveTo(slide, along.width) });
          options.push(outward);
          add(item, 'doors-swing-clash', `The swing of the ${name} in the ${roomName} hits the swing of another door.`, options.length === 2 ? 'low' : 'high', options);
        }
      }
    }

    // Daylight: a room that needs a window and has none gets a proposal for its window slot.
    for (const room of rooms) {
      const slot = mine.find((i) => i.kind === 'window' && i.room === room.id && i.value && i.value.placeholder);
      if (!slot || !editable(slot) || !inScope(slot, context)) continue;
      if (openings.some((o) => o.kind === 'window' && o.room === room.id)) continue;
      const size = sizeInRoom(room.id);
      const wall = wallOf.get(room.id);
      if (!size || !wall || !wall.value || !Array.isArray(wall.value.segments) || wall.value.segments.length === 0) continue; // walls not decided yet
      const type = roomTypeOf(room.name, k.rooms);
      const rule = ruleForType(k.daylight, type);
      const share = rule.then.daylightShare;
      if (!(share > 0)) continue;
      const outside = wall.value.segments.filter((s) => s.sharedWith === null).sort((a, b) => b.length - a.length || SIDES.indexOf(a.side) - SIDES.indexOf(b.side));
      const width = mm(Math.min(windowDefault.maxWidth, Math.max(windowDefault.minWidth, (share * size.width * size.depth) / windowDefault.height)));
      const options = outside.slice(0, 2).filter((s) => s.length >= width + 2 * corner.window).map((s) => ({
        id: `window-${s.side}`,
        label: `A ${width} m window on the ${s.side} wall`,
        newValue: {
          name: `${room.name} window`, position: placeOnWall(size, s.side, (s.length - width) / 2, width, windowDefault.depth),
          height: windowDefault.height, sill: windowDefault.sill, wall: s.side, rule: rule.id,
        },
      }));
      if (options.length === 0) continue;
      add(slot, 'windows-daylight', `The ${room.name} (a ${type}) has no window. A ${type} usually has window area of about ${Math.round(share * 100)} in 100 of its floor area for daylight.`, 'high', options);
    }
    return proposals;
  }

  // A custom answer is an opening with a position: x, y, width and depth, all numbers, width and depth above 0.
  agent.checkCustom = (proposal, value) => {
    const p = value && value.position;
    if (!p || ![p.x, p.y, p.width, p.depth].every((n) => typeof n === 'number' && Number.isFinite(n))) return 'A custom answer needs a "position" with x, y, width and depth as numbers.';
    if (!(p.width > 0) || !(p.depth > 0)) return 'The width and depth of the opening must be above 0.';
    return true;
  };
  return agent;
}
