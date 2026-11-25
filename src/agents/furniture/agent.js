// The Furniture agent (design-team C1). Fifth in the team. It owns the `layout` items (the old kind name for furniture).
// A fixed, rule-based step: no AI, no randomness, no clock. Its numbers come from src/knowledge/furniture/.
//
// It reads the walls, the doors and windows, the floors and the lighting and electrical items (earlier agents) and its own items.
// It never reads a later agent's items. The pieces the user placed (place-items) are its starting positions. It reads them as they
// are, checks them, and only proposes a different position when a rule is broken. It never changes a Locked piece.
//
// What it checks for each piece it owns:
//   a piece that sticks out of its room, overlaps another piece, stands in a door's swing, has a bed head under a window,
//   has no free space in front (wardrobe doors, kitchen units), covers a socket (tall pieces), or leaves too little room to walk.
// A piece with a problem gets a proposal with one or two new places, found by a fixed search.
// When the piece cannot fit in the room at all, it never edits the wall. It raises a REQUEST to Walls (design section 4.3): a proposal
// on the wall item with two options (make the room a little bigger, or bigger with walking space) plus Custom.
import { loadKnowledge } from '../../knowledge/load.js';
import {
  roomsOf, roomTypeOf, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, mm,
  SIDES, openingSide, alongWall, overlaps, swingSquareOf, inflate, insideRoom,
} from '../common.js';
import { buildProposal } from '../../proposal.js';

export const FURNITURE = 'Furniture';
const WALLS = 'Walls';
const TOLERANCE = 0.001; // a millimetre

export function loadFurnitureKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    sizes: loadKnowledge('furniture/furniture-sizes.json').rules,
    clear: loadKnowledge('furniture/clearances.json').rules,
    patterns: loadKnowledge('furniture/layout-patterns.json').rules,
    openings: loadKnowledge('doors-windows/door-sizes.json').rules,
  };
}

const text = (s) => String(s).slice(0, 200);
const metres = (n) => `${mm(n)} m`;

// How far two rectangles overlap across (x) and down (y), and how far apart they are in each direction (0 when they overlap).
function relation(a, b) {
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y);
  return { ox, oy, sx: Math.max(-ox, 0), sy: Math.max(-oy, 0) };
}

export function makeFurnitureAgent(knowledge = loadFurnitureKnowledge()) {
  const k = knowledge;
  const tolerance = ruleById(k.openings, 'doors-on-wall-tolerance').then.tolerance;
  const walkway = ruleById(k.clear, 'clear-walkway').then.minGap;
  const search = ruleById(k.clear, 'clear-search').then;
  const crowded = ruleById(k.clear, 'clear-crowded').then;
  const socketReach = ruleById(k.clear, 'clear-socket-reach').then.reach;
  const bedRule = ruleById(k.patterns, 'pattern-bed-head').then;
  const againstWall = ruleById(k.patterns, 'pattern-against-wall').then.types;
  const sizeRuleFor = (type) => k.sizes.find((r) => r.when.type === type) || ruleById(k.sizes, 'size-other');

  function agent(view, context) {
    const mode = context && context.mode;
    const rooms = roomsOf(view);
    const seen = view.items.filter((i) => ['wall', 'door', 'window', 'floor', 'ceiling', 'light', 'electrical', 'layout'].includes(i.kind));
    const proposals = [];

    for (const room of rooms) {
      const wall = wallItemOf(view, room.id);
      const size = sizeOf(room, wall);
      if (!size) continue;
      const roomName = room.name;
      const pieces = seen.filter((i) => i.kind === 'layout' && i.room === room.id && i.value && i.value.position);
      if (pieces.length === 0) continue;
      const openings = seen.filter((i) => (i.kind === 'door' || i.kind === 'window') && i.room === room.id && i.value && i.value.position && !i.value.placeholder);
      const elec = seen.find((i) => i.kind === 'electrical' && i.room === room.id);
      const sockets = ((elec && elec.value && elec.value.sockets) || []).map((s) => s.position).filter(Boolean);
      const swings = openings
        .filter((o) => o.kind === 'door' && o.value.swing !== 'out')
        .map((o) => {
          const side = openingSide(o.value.position, size, tolerance);
          return side ? { id: o.id, side, rect: swingSquareOf(side, alongWall(o.value.position, size, side), size) } : null;
        }).filter(Boolean);
      const windows = openings.filter((o) => o.kind === 'window').map((o) => ({ id: o.id, side: openingSide(o.value.position, size, tolerance), pos: o.value.position }));

      // The place of every piece. A piece this agent has already moved (in this pass) stands at its new place.
      const place = new Map(pieces.map((p) => [p.id, structuredClone(p.value.position)]));
      const mineToMove = (p) => p.owner === FURNITURE && editable(p);
      const typeOf = (p) => (p.value.type || 'other');
      const rule = (p) => sizeRuleFor(typeOf(p)).then;

      // The strip of free space in front of a piece: on the side away from its nearest wall.
      const frontZone = (p, rect) => {
        const front = rule(p).front;
        if (!(front > 0)) return null;
        const d = { north: rect.y, south: size.depth - (rect.y + rect.depth), west: rect.x, east: size.width - (rect.x + rect.width) };
        const nearest = SIDES.slice().sort((a, b) => d[a] - d[b] || SIDES.indexOf(a) - SIDES.indexOf(b))[0];
        if (nearest === 'north') return { x: rect.x, y: mm(rect.y + rect.depth), width: rect.width, depth: front };
        if (nearest === 'south') return { x: rect.x, y: mm(rect.y - front), width: rect.width, depth: front };
        if (nearest === 'west') return { x: mm(rect.x + rect.width), y: rect.y, width: front, depth: rect.depth };
        return { x: mm(rect.x - front), y: rect.y, width: front, depth: rect.depth };
      };
      const againstAWall = (rect) => rect.x <= crowded.touch || rect.y <= crowded.touch
        || size.width - (rect.x + rect.width) <= crowded.touch || size.depth - (rect.y + rect.depth) <= crowded.touch;
      const underWindow = (rect) => windows.some((w) => {
        if (!w.side) return false;
        const a = alongWall(w.pos, size, w.side);
        const near = { north: rect.y, south: size.depth - (rect.y + rect.depth), west: rect.x, east: size.width - (rect.x + rect.width) }[w.side];
        const span = w.side === 'north' || w.side === 'south' ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.depth];
        return near <= crowded.touch && Math.min(span[1], a.start + a.width) - Math.max(span[0], a.start) > TOLERANCE;
      });

      // Every rule a piece at `rect` breaks. others: [{ piece, rect, binding }] where binding says the other piece counts against this one
      // (it is earlier in the list, or it cannot be moved). Each problem names its knowledge rule.
      const problemsOf = (p, rect, others) => {
        const found = [];
        const name = p.value.name || typeOf(p);
        if (!insideRoom(rect, size)) found.push({ rule: 'clear-search', text: `The ${name} sticks out of the ${roomName}.` });
        for (const o of others) {
          if (!o.binding) continue;
          const r = relation(rect, o.rect);
          const other = o.piece.value.name || typeOf(o.piece);
          if (r.ox > TOLERANCE && r.oy > TOLERANCE) found.push({ rule: 'clear-walkway', text: `The ${name} overlaps the ${other} in the ${roomName}.` });
          else if ((r.oy > TOLERANCE && r.sx > TOLERANCE && r.sx < walkway) || (r.ox > TOLERANCE && r.sy > TOLERANCE && r.sy < walkway)) {
            found.push({ rule: 'clear-walkway', text: `Only ${metres(Math.max(r.sx, r.sy))} is left between the ${name} and the ${other}. Leave at least ${metres(walkway)} to walk.` });
          }
        }
        for (const o of others) {
          if (!o.binding) continue;
          const z = frontZone(o.piece, o.rect);
          if (z && overlaps(z, rect)) {
            const other = o.piece.value.name || typeOf(o.piece);
            found.push({ rule: sizeRuleFor(typeOf(o.piece)).id, text: `The ${name} stands in the free space in front of the ${other} in the ${roomName}.` });
          }
        }
        for (const s of swings) if (overlaps(rect, s.rect)) found.push({ rule: 'clear-door-swing', text: `The ${name} stands where a door swings open in the ${roomName}.` });
        if (typeOf(p) === 'bed' && bedRule.avoidUnderWindow && underWindow(rect)) found.push({ rule: 'pattern-bed-head', text: `The head of the ${name} is under a window in the ${roomName}.` });
        const zone = frontZone(p, rect);
        if (zone) {
          const blocked = !insideRoom(zone, size) || others.some((o) => o.binding && overlaps(zone, o.rect));
          if (blocked) found.push({ rule: sizeRuleFor(typeOf(p)).id, text: `The ${name} has less than ${metres(rule(p).front)} of free space in front of it in the ${roomName}.` });
        }
        if (rule(p).tall && sockets.some((s) => overlaps(inflate(rect, socketReach), s))) {
          found.push({ rule: 'clear-socket-reach', text: `The ${name} covers a socket in the ${roomName}.` });
        }
        return found;
      };

      const spotsFor = (p) => {
        const w = p.value.position.width;
        const d = p.value.position.depth;
        const here = place.get(p.id);
        const others = pieces.filter((o) => o.id !== p.id).map((o) => ({ piece: o, rect: place.get(o.id), binding: true }));
        const axis = (length, own) => [...new Set([...Array.from({ length: Math.floor((length - own) / search.step + TOLERANCE) + 1 }, (_, i) => mm(i * search.step)), mm(length - own)])].filter((v) => v >= -TOLERANCE);
        const xs = axis(size.width, w);
        const ys = axis(size.depth, d);
        const wantWall = againstWall.includes(typeOf(p));
        const candidates = [];
        for (const y of ys) for (const x of xs) candidates.push({ x, y, width: w, depth: d, dist: Math.hypot(x - here.x, y - here.y) });
        candidates.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
        const valid = [];
        for (const c of candidates) {
          const rect = { x: c.x, y: c.y, width: c.width, depth: c.depth };
          if (rect.x === here.x && rect.y === here.y) continue; // the same place is not a new place
          if (wantWall && !againstAWall(rect)) continue;
          if (problemsOf(p, rect, others).length > 0) continue;
          valid.push(rect);
          if (valid.length === 1) continue;
          if (Math.hypot(rect.x - valid[0].x, rect.y - valid[0].y) >= search.farApart) break;
          valid.pop();
        }
        return valid;
      };

      // ---- the pieces
      const misfits = []; // pieces that cannot be helped by moving: the room itself is too small
      for (const p of pieces) {
        if (!mineToMove(p) || !inScope(p, context)) continue;
        const rect = place.get(p.id);
        const others = pieces.filter((o) => o.id !== p.id).map((o) => ({
          piece: o, rect: place.get(o.id), binding: !mineToMove(o) || pieces.indexOf(o) < pieces.indexOf(p),
        }));
        const problems = problemsOf(p, rect, others);
        if (problems.length === 0) continue;
        const name = p.value.name || typeOf(p);
        if (rect.width > size.width + TOLERANCE || rect.depth > size.depth + TOLERANCE) {
          misfits.push({ p, name, shortWidth: Math.max(0, rect.width - size.width), shortDepth: Math.max(0, rect.depth - size.depth), text: `The ${name} (${metres(rect.width)} by ${metres(rect.depth)}) is bigger than the ${roomName} (${metres(size.width)} by ${metres(size.depth)}).` });
          continue;
        }
        const spots = spotsFor(p);
        if (spots.length === 0) {
          misfits.push({ p, name, shortWidth: 0, shortDepth: 0, text: `There is no free place for the ${name} in the ${roomName}.` });
          continue;
        }
        place.set(p.id, spots[0]);
        const options = spots.map((s, i) => ({
          id: `move-${i + 1}`, label: `Move the ${name} to x ${metres(s.x)}, y ${metres(s.y)}`, newValue: { ...p.value, position: s },
        }));
        if (options.some((o) => sameValue(o.newValue, p.value))) continue;
        proposals.push(buildProposal({
          id: proposalId('furniture', p.id, problems[0].rule, mode), agent: FURNITURE, itemId: p.id, why: text(problems[0].text),
          source: 'rule', ruleId: problems[0].rule, confidence: options.length === 2 ? 'low' : 'high', options,
        }, { items: seen }));
      }

      // ---- one request to Walls for the room, when a piece cannot fit. Furniture never writes the wall itself.
      if (misfits.length > 0 && wall && editable(wall) && wall.owner === WALLS && inScope(wall, null) && wall.value) {
        const shortWidth = Math.max(0, ...misfits.map((m) => m.shortWidth));
        const shortDepth = Math.max(0, ...misfits.map((m) => m.shortDepth));
        const axisName = shortDepth > shortWidth ? 'depth' : 'width';
        const short = axisName === 'depth' ? shortDepth : shortWidth;
        const round = (n) => Math.ceil(n * 10 - TOLERANCE) / 10;
        const first = round(short > 0 ? short : crowded.step);
        const second = round((short > 0 ? short : crowded.step) + (short > 0 ? walkway : crowded.step));
        const word = axisName === 'depth' ? 'deeper' : 'wider';
        const grown = (extra) => {
          const v = structuredClone(wall.value);
          const next = { width: size.width, depth: size.depth };
          next[axisName] = mm(size[axisName] + extra);
          v.size = { width: next.width, depth: next.depth, from: 'furniture request' };
          for (const s of v.segments || []) {
            if (axisName === 'width' && (s.side === 'north' || s.side === 'south')) s.length = next.width;
            if (axisName === 'depth' && (s.side === 'west' || s.side === 'east')) {
              const other = s.sharedWith ? rooms.find((r) => r.id === s.sharedWith) : null;
              const otherSize = other ? sizeOf(other, wallItemOf(view, other.id)) : null;
              s.length = otherSize ? mm(Math.min(next.depth, otherSize.depth)) : next.depth;
            }
          }
          return v;
        };
        const options = [
          { id: 'just-fits', label: `Make the ${roomName} ${metres(first)} ${word} (the pieces just fit)`, newValue: grown(first) },
          { id: 'with-walking-space', label: `Make the ${roomName} ${metres(second)} ${word} (with space to walk)`, newValue: grown(second) },
        ];
        const names = misfits.map((m) => m.name).join(', ');
        proposals.push(buildProposal({
          id: proposalId('furniture', wall.id, 'clear-crowded', mode), agent: FURNITURE, itemId: wall.id,
          why: text(`${misfits[0].text} Ask Walls to make the room ${word}? (${names})`), source: 'rule', ruleId: 'clear-crowded', confidence: 'low', options,
          request: { itemId: wall.id, owner: WALLS },
        }, { items: seen }));
      }
    }
    return proposals;
  }

  // A custom answer: for a piece, a position with four numbers; for a request to Walls, a size above 0.
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object') return 'A custom answer must be an object.';
    if (proposal.request) {
      const s = value.size;
      if (!s || !(s.width > 0) || !(s.depth > 0)) return 'A custom answer for the room needs a size with a width and a depth above 0.';
      return true;
    }
    const p = value.position;
    if (!p || ![p.x, p.y, p.width, p.depth].every((n) => typeof n === 'number' && Number.isFinite(n))) return 'A custom answer needs a position with x, y, width and depth.';
    if (!(p.width > 0) || !(p.depth > 0)) return 'The width and depth must be above 0.';
    return true;
  };
  return agent;
}
