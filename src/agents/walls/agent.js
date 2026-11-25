// The Walls agent (design-team B1). It is first in the team and owns the `wall` items: one per room.
// It is a fixed, rule-based step: no AI, no randomness, no clock. Its numbers come from src/knowledge/walls/.
//
// It reads the user's room sizes (and nothing from other agents) and returns proposals. It writes nothing.
//   - A room with a size: wall segments for its four sides (one option, high confidence).
//   - A room below the smallest size for its type: two options (keep the size, or the smallest size).
//   - A room with no entered size: two options (use the default size, or wait for the size) plus Custom.
// Rooms next to each other on a floor share one wall: the shared segment has the same id and length in both rooms.
// Neighbours are assumed to sit side by side in the order entered (see roomsOf in ../common.js).
import { loadKnowledge } from '../../knowledge/load.js';
import {
  roomsOf, neighboursOf, roomTypeOf, ruleForType, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, mm,
} from '../common.js';
import { buildProposal } from '../../proposal.js';

export const WALLS = 'Walls';
export const SHARED_WALL_RULE = 'walls-shared-between-neighbours';

export function loadWallsKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    sizes: loadKnowledge('walls/room-minimum-sizes.json').rules,
    walls: loadKnowledge('walls/wall-thickness.json').rules,
  };
}

const sizeText = (s) => `${s.width} by ${s.depth} m`;

// The wall segments of one room for a size. sizeFor(room) gives the size the room (or a neighbour) is taken to have.
export function segmentsFor(room, size, neighbours, sizeFor, k) {
  const external = ruleById(k.walls, 'walls-thickness-external').then.thickness;
  const internal = ruleById(k.walls, 'walls-thickness-internal').then.thickness;
  const height = ruleById(k.walls, 'walls-height-default').then.height;
  const own = (side, length) => ({
    id: `${room.id}:${side}`, side, length: mm(length), thickness: external, height, sharedWith: null, rule: 'walls-thickness-external',
  });
  const shared = (side, other, a, b) => ({
    id: `shared:${a.id}+${b.id}`, side, length: mm(Math.min(size.depth, sizeFor(other).depth)), thickness: internal, height, sharedWith: other.id, rule: SHARED_WALL_RULE,
  });
  return [
    own('north', size.width),
    own('south', size.width),
    neighbours.west ? shared('west', neighbours.west, neighbours.west, room) : own('west', size.depth),
    neighbours.east ? shared('east', neighbours.east, room, neighbours.east) : own('east', size.depth),
  ];
}

export function makeWallsAgent(knowledge = loadWallsKnowledge()) {
  const k = knowledge;
  const defaultSize = () => {
    const d = ruleById(k.sizes, 'walls-default-size').then;
    return { width: d.width, depth: d.depth, from: 'default' };
  };

  function agent(view, context) {
    const rooms = roomsOf(view);
    const wallItems = new Map(rooms.map((r) => [r.id, wallItemOf(view, r.id)]));
    // The size each room is taken to have when its neighbour's shared wall is worked out.
    const sizeFor = (room) => sizeOf(room, wallItems.get(room.id)) || defaultSize();
    const mode = context && context.mode;
    const proposals = [];

    for (const room of rooms) {
      const item = wallItems.get(room.id);
      if (!item || !editable(item) || !inScope(item, context)) continue;
      const type = roomTypeOf(room.name, k.rooms);
      const min = ruleForType(k.sizes, type);
      const neighbours = neighboursOf(rooms, room);
      const make = (size, extra = {}) => ({
        name: `Walls of ${room.name}`,
        size: { width: mm(size.width), depth: mm(size.depth), from: size.from },
        segments: segmentsFor(room, size, neighbours, sizeFor, k),
        ...extra,
      });
      const propose = (ruleId, why, confidence, options) => {
        // Nothing to propose when the item already holds one of the answers (the user decided before).
        if (options.some((o) => sameValue(o.newValue, item.value))) return;
        proposals.push(buildProposal({
          id: proposalId('walls', item.id, ruleId, mode), agent: WALLS, itemId: item.id, why, source: 'rule', ruleId, confidence, options,
        }, { items: view.items }));
      };

      const entered = sizeOf(room, null);
      if (!entered && !(item.value && item.value.size)) {
        const def = defaultSize();
        propose('walls-default-size',
          `${room.name} has no entered size. Use the default ${sizeText(def)}, or wait until you enter the size.`, 'low', [
            { id: 'use-default', label: `Use the default size (${sizeText(def)})`, newValue: make(def) },
            { id: 'wait-for-size', label: 'Wait until I enter the size', newValue: { name: `Walls of ${room.name}`, size: null, segments: [], waitingForSize: true } },
          ]);
        continue;
      }
      const size = entered || sizeOf(room, item);
      if (!size) continue; // waiting for a size: nothing to propose until one is entered

      const small = size.width < min.then.minSide || size.depth < min.then.minSide || size.width * size.depth < min.then.minArea;
      if (small) {
        const w = Math.max(size.width, min.then.minSide);
        let d = Math.max(size.depth, min.then.minSide);
        if (w * d < min.then.minArea) d = Math.ceil((min.then.minArea / w) * 10) / 10;
        const bigger = { width: w, depth: d, from: 'minimum' };
        propose('walls-below-minimum',
          `${room.name} (${sizeText(size)}) is under the smallest typical size for a ${type}. Keep your size, or use ${sizeText(bigger)}.`, 'low', [
            { id: 'keep-size', label: `Keep my size (${sizeText(size)})`, newValue: make(size, { warning: `Smaller than the typical minimum for a ${type}.` }) },
            { id: 'use-minimum', label: `Use the smallest typical size (${sizeText(bigger)})`, newValue: make(bigger) },
          ]);
        continue;
      }
      propose('walls-segments-from-size',
        `Wall segments for ${room.name} from its size (${sizeText(size)}). Walls shared with a neighbouring room are one wall, not two.`, 'high', [
          { id: 'use-segments', label: `Use these walls for ${room.name}`, newValue: make(size) },
        ]);
    }
    return proposals;
  }

  // A custom answer must be walls: a list of segments with a side, a positive length and a thickness.
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.segments)) return 'A custom answer for walls needs a list called "segments".';
    for (const s of value.segments) {
      if (!s || !['north', 'south', 'west', 'east'].includes(s.side)) return 'Each wall segment needs a side: north, south, west or east.';
      if (!(s.length > 0) || !(s.thickness > 0)) return 'Each wall segment needs a length and a thickness above 0.';
    }
    return true;
  };
  return agent;
}
