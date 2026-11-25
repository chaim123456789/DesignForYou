// The Decor agent (design-team C2). Sixth in the team. It owns the `decor` items: one per room (rug, art and curtains).
// A fixed, rule-based step: no AI, no randomness, no clock. Its numbers come from src/knowledge/decor/.
//
// It reads the walls, the windows, the lighting and the furniture (earlier agents) and its own items. It never reads a later agent's items.
//   Rug:      under the seating group (sofas, and tables close to a sofa): the group's rectangle plus a margin, kept off the walls.
//   Art:      one picture, its middle at the hanging height. On the wall behind a sofa or bed when it is free, otherwise on the longest
//             free wall. When two walls are about equally good it shows two options (low confidence).
//   Curtains: for each window, a rail as wide as the window plus the overlap on each side.
// Moving a sofa changes the rug, so the rug is stale and re-checked (the Decor item's basis names the room's furniture).
import { loadKnowledge } from '../../knowledge/load.js';
import {
  roomsOf, roomTypeOf, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, mm,
  SIDES, openingSide, alongWall, gapBetween,
} from '../common.js';
import { buildProposal } from '../../proposal.js';

export const DECOR = 'Decor';

export function loadDecorKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    hanging: loadKnowledge('decor/hanging-heights.json').rules,
    rugs: loadKnowledge('decor/rug-sizes.json').rules,
    curtains: loadKnowledge('decor/curtains.json').rules,
    openings: loadKnowledge('doors-windows/door-sizes.json').rules,
  };
}

const bounds = (rects) => {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.depth));
  return { x: x0, y: y0, width: x1 - x0, depth: y1 - y0 };
};

export function makeDecorAgent(knowledge = loadDecorKnowledge()) {
  const k = knowledge;
  const tolerance = ruleById(k.openings, 'doors-on-wall-tolerance').then.tolerance;
  const sizeRule = ruleById(k.hanging, 'art-size').then;
  const art = { centre: ruleById(k.hanging, 'art-centre-height').then.height, width: sizeRule.width, pictureHeight: sizeRule.height, ...ruleById(k.hanging, 'art-free-wall').then };
  const rug = ruleById(k.rugs, 'rug-seating-group').then;
  const curtain = ruleById(k.curtains, 'curtain-width').then;

  function agent(view, context) {
    const mode = context && context.mode;
    const rooms = roomsOf(view);
    const seen = view.items.filter((i) => ['wall', 'door', 'window', 'light', 'layout', 'decor'].includes(i.kind));
    const proposals = [];

    for (const room of rooms) {
      const item = seen.find((i) => i.kind === 'decor' && i.owner === DECOR && i.room === room.id);
      if (!item || !editable(item) || !inScope(item, context)) continue;
      const wall = wallItemOf(view, room.id);
      const size = sizeOf(room, wall);
      if (!size) continue;
      const wallHeight = wall && wall.value && Array.isArray(wall.value.segments) && wall.value.segments.length > 0 ? wall.value.segments[0].height : null;
      const pieces = seen.filter((i) => i.kind === 'layout' && i.room === room.id && i.value && i.value.position);
      const openings = seen.filter((i) => (i.kind === 'door' || i.kind === 'window') && i.room === room.id && i.value && i.value.position && !i.value.placeholder);
      const light = seen.find((i) => i.kind === 'light' && i.room === room.id);
      const rules = [];

      // ---- the rug: under the seating group
      let rugValue = null;
      const sofas = pieces.filter((p) => p.value.type === 'sofa');
      if (sofas.length > 0) {
        const tables = pieces.filter((p) => p.value.type === 'table' && sofas.some((s) => gapBetween(s.value.position, p.value.position) <= rug.groupReach));
        const group = [...sofas, ...tables];
        const b = bounds(group.map((g) => g.value.position));
        const x0 = Math.max(rug.wallGap, b.x - rug.margin);
        const y0 = Math.max(rug.wallGap, b.y - rug.margin);
        const x1 = Math.min(size.width - rug.wallGap, b.x + b.width + rug.margin);
        const y1 = Math.min(size.depth - rug.wallGap, b.y + b.depth + rug.margin);
        const up = (n) => Math.ceil(n / rug.round - 0.001) * rug.round;
        rugValue = { x: mm(x0), y: mm(y0), width: mm(Math.min(up(x1 - x0), size.width - 2 * rug.wallGap)), depth: mm(Math.min(up(y1 - y0), size.depth - 2 * rug.wallGap)), group: group.map((g) => g.id), rule: 'rug-seating-group' };
        rules.push('rug-seating-group');
      }

      // ---- the art: one picture, on a free wall, at the hanging height
      const lengthOf = (side) => (side === 'north' || side === 'south' ? size.width : size.depth);
      const blockedOn = (side) => openings.map((o) => {
        if (openingSide(o.value.position, size, tolerance) !== side) return null;
        const a = alongWall(o.value.position, size, side);
        return [a.start - art.clearFromOpening, a.start + a.width + art.clearFromOpening];
      }).filter(Boolean).sort((p, q) => p[0] - q[0]);
      const stretchesOn = (side) => {
        const out = [];
        let from = art.clearFromCorner;
        for (const [b0, b1] of blockedOn(side)) { if (b0 > from) out.push([from, b0]); from = Math.max(from, b1); }
        if (lengthOf(side) - art.clearFromCorner > from) out.push([from, lengthOf(side) - art.clearFromCorner]);
        return out.filter(([a, b]) => b - a >= art.width);
      };
      const longest = (side) => stretchesOn(side).reduce((best, s) => (s[1] - s[0] > (best ? best[1] - best[0] : 0) ? s : best), null);
      // The wall behind a sofa or bed, when the piece stands against it and its stretch of wall is free.
      let artChoices = [];
      for (const p of pieces.filter((x) => x.value.type === 'sofa' || x.value.type === 'bed')) {
        const r = p.value.position;
        const d = { north: r.y, south: size.depth - (r.y + r.depth), west: r.x, east: size.width - (r.x + r.width) };
        const side = SIDES.find((s) => d[s] <= art.touch);
        if (!side) continue;
        const centre = side === 'north' || side === 'south' ? r.x + r.width / 2 : r.y + r.depth / 2;
        if (stretchesOn(side).some(([a, b]) => centre - art.width / 2 >= a - 0.001 && centre + art.width / 2 <= b + 0.001)) { artChoices = [{ side, along: centre, behind: p.id }]; break; }
      }
      let artConfident = artChoices.length > 0;
      if (artChoices.length === 0) {
        const scored = SIDES.map((side) => ({ side, stretch: longest(side) })).filter((s) => s.stretch)
          .map((s) => ({ side: s.side, along: (s.stretch[0] + s.stretch[1]) / 2, length: s.stretch[1] - s.stretch[0] }))
          .sort((a, b) => b.length - a.length || SIDES.indexOf(a.side) - SIDES.indexOf(b.side));
        if (scored.length > 0) {
          const close = scored.filter((s) => scored[0].length - s.length <= art.closeWithin);
          artChoices = close.slice(0, 2);
          artConfident = close.length === 1;
        }
      }
      if (artChoices.length > 0) rules.push('art-centre-height');

      // ---- the curtains: one for each window, as wide as the window plus the overlap
      const curtains = [];
      for (const w of openings.filter((o) => o.kind === 'window' && o.value.position)) {
        const a = openingSide(w.value.position, size, tolerance);
        if (!a) continue;
        const along = alongWall(w.value.position, size, a);
        if (along.width < curtain.minWindowWidth || typeof wallHeight !== 'number') continue;
        const railHeight = mm(wallHeight - curtain.railBelowCeiling);
        curtains.push({ window: w.id, wall: a, railWidth: mm(along.width + 2 * curtain.overlap), railHeight, drop: mm(railHeight - curtain.floorGap), rule: 'curtain-width' });
      }
      if (curtains.length > 0) rules.push('curtain-width');
      if (rules.length === 0) continue;

      const litBy = light && light.value && Array.isArray(light.value.fixtures) ? light.value.fixtures.length : 0;
      const make = (choice) => ({
        name: `Decor of ${room.name}`, rug: rugValue,
        art: choice ? [{ wall: choice.side, along: mm(choice.along), centreHeight: art.centre, width: art.width, height: art.pictureHeight, ...(choice.behind ? { behind: choice.behind } : {}), rule: 'art-centre-height' }] : [],
        curtains, litBy, rules,
      });
      const roomName = room.name;
      const parts = [];
      if (rugValue) parts.push(`a ${rugValue.width} by ${rugValue.depth} m rug under the seating group`);
      if (artChoices.length > 0) parts.push(`a picture with its middle ${art.centre} m up`);
      if (curtains.length > 0) parts.push(`${curtains.length} curtain${curtains.length === 1 ? '' : 's'}`);
      const options = artConfident || artChoices.length < 2
        ? [{ id: 'use-decor', label: `Use this decor for the ${roomName}`, newValue: make(artChoices[0]) }]
        : artChoices.map((c, i) => ({ id: `art-${c.side}`, label: `Hang the picture on the ${c.side} wall`, newValue: make(artChoices[i]) }));
      if (options.some((o) => sameValue(o.newValue, item.value))) continue;
      proposals.push(buildProposal({
        id: proposalId('decor', item.id, rules[0], mode), agent: DECOR, itemId: item.id,
        why: `For the ${roomName}: ${parts.join(', ')}.${artConfident || artChoices.length < 2 ? '' : ' Two walls suit the picture about equally.'}`.slice(0, 200),
        source: 'rule', ruleId: rules[0], confidence: options.length === 2 ? 'low' : 'high', options,
      }, { items: seen }));
    }
    return proposals;
  }

  // A custom answer: lists for the art and the curtains, and a rug with four numbers (or none).
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object') return 'A custom answer must be an object.';
    if (value.art !== undefined && !Array.isArray(value.art)) return 'The art must be a list.';
    if (value.curtains !== undefined && !Array.isArray(value.curtains)) return 'The curtains must be a list.';
    const r = value.rug;
    if (r !== null && r !== undefined && ![r.x, r.y, r.width, r.depth].every((n) => typeof n === 'number' && Number.isFinite(n))) return 'A rug needs x, y, width and depth as numbers.';
    return true;
  };
  return agent;
}
