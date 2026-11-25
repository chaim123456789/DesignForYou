// The Lighting and electrical agent (design-team B4). Fourth in the team. It owns the `light` and `electrical` items: one of each per room.
// A fixed, rule-based step: no AI, no randomness, no clock. Its numbers come from src/knowledge/lighting-electrical/.
//
// It reads the walls, the doors and windows, and the ceilings (earlier agents) and its own items. It never reads a later agent's items.
//   Light item:      ceiling lights from the light level the room type aims for and the size of the room.
//   Electrical item: a switch beside each door, sockets along the free wall (one for each stretch up to the spacing), and none in a wet zone.
// Every result says it is a draft for professional review and not an electrical design.
import { loadKnowledge } from '../../knowledge/load.js';
import {
  roomsOf, roomTypeOf, typePhrase, ruleForType, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, mm,
  SIDES, openingSide, alongWall, placeOnWall, overlaps,
} from '../common.js';
import { buildProposal } from '../../proposal.js';
import { DRAFT_STATEMENT } from '../../label.js';

export const LIGHTING_ELECTRICAL = 'Lighting and electrical';
export const ELECTRICAL_NOTICE = `${DRAFT_STATEMENT} This is not an electrical design.`;
const SWITCH_RULE = 'switch-by-door';

export function loadLightingElectricalKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    levels: loadKnowledge('lighting-electrical/light-levels.json').rules,
    sockets: loadKnowledge('lighting-electrical/socket-spacing.json').rules,
    switches: loadKnowledge('lighting-electrical/switch-placement.json').rules,
    wet: loadKnowledge('lighting-electrical/wet-zones.json').rules,
  };
}

// The wet zones of a room as rectangles in room coordinates. A "whole-room" zone covers the room. Other zones draw nothing yet.
export function wetZonesFor(wetRule, size) {
  return wetRule.then.zone === 'whole-room' ? [{ x: 0, y: 0, width: size.width, depth: size.depth }] : [];
}

// The agent's own check: which of these sockets sit inside a wet zone. Returns a list of plain sentences (empty when all is fine).
export function socketsInWetZones(sockets, zones) {
  return sockets.filter((s) => zones.some((z) => overlaps(s.position, z))).map((s) => `The socket on the ${s.side} wall (${s.along} m along it) is inside a wet zone. Sockets must stay out of wet zones.`);
}

export function makeLightingElectricalAgent(knowledge = loadLightingElectricalKnowledge()) {
  const k = knowledge;
  const fixtureRule = ruleById(k.levels, 'lights-fixture').then;
  const socketRule = ruleById(k.sockets, 'sockets-spacing').then;
  const switchRule = ruleById(k.switches, SWITCH_RULE).then;

  function agent(view, context) {
    const mode = context && context.mode;
    const rooms = roomsOf(view);
    const seen = view.items.filter((i) => ['wall', 'door', 'window', 'ceiling', 'light', 'electrical'].includes(i.kind));
    const mineOf = (kind, roomId) => seen.find((i) => i.kind === kind && i.owner === LIGHTING_ELECTRICAL && i.room === roomId);
    const proposals = [];
    const add = (item, ruleId, why, confidence, options) => {
      if (options.some((o) => sameValue(o.newValue, item.value))) return;
      proposals.push(buildProposal({
        id: proposalId('lighting', item.id, ruleId, mode), agent: LIGHTING_ELECTRICAL, itemId: item.id, why, source: 'rule', ruleId, confidence, options,
      }, { items: seen }));
    };
    const tolerance = socketRule.openingReach; // an opening this close to a wall is on it

    for (const room of rooms) {
      const wall = wallItemOf(view, room.id);
      const size = sizeOf(room, wall);
      if (!size) continue;
      const type = roomTypeOf(room.name, k.rooms);
      const ceiling = seen.find((i) => i.kind === 'ceiling' && i.owner === 'Floors and ceilings' && i.room === room.id);
      const openings = seen.filter((i) => (i.kind === 'door' || i.kind === 'window') && i.owner === 'Doors and windows' && i.room === room.id && i.value && i.value.position && !i.value.placeholder);

      // ---- the lights
      const light = mineOf('light', room.id);
      const height = ceiling && ceiling.value ? ceiling.value.height : null;
      if (light && editable(light) && inScope(light, context) && typeof height === 'number') {
        const lux = ruleForType(k.levels, type).then.lux;
        const area = size.width * size.depth;
        const count = Math.max(1, Math.ceil((lux * area) / (fixtureRule.lumens * fixtureRule.utilisation)));
        const cols = Math.max(1, Math.round(Math.sqrt((count * size.width) / size.depth)));
        const rows = Math.ceil(count / cols);
        const mount = height < fixtureRule.pendantMinCeiling ? 'flush' : 'flush or hanging';
        const fixtures = Array.from({ length: count }, (_, i) => ({
          type: 'ceiling light', mount, lumens: fixtureRule.lumens,
          position: { x: mm(((i % cols) + 0.5) * (size.width / cols)), y: mm((Math.floor(i / cols) + 0.5) * (size.depth / rows)) },
        }));
        const value = { name: `Lights of ${room.name}`, lux, area: mm(area), fixtures, rule: ruleForType(k.levels, type).id, notice: ELECTRICAL_NOTICE };
        add(light, 'lights-by-level', `The ${room.name} (${typePhrase(type)}) aims for about ${lux} lux. That takes about ${count} ceiling light${count === 1 ? '' : 's'} of ${fixtureRule.lumens} lumens.`, 'high', [
          { id: 'use-lights', label: `${count} ceiling light${count === 1 ? '' : 's'}, ${mount}`, newValue: value },
        ]);
      }

      // ---- the switches and sockets
      const elec = mineOf('electrical', room.id);
      if (elec && editable(elec) && inScope(elec, context)) {
        const wetRule = ruleForType(k.wet, type);
        const zones = wetZonesFor(wetRule, size);
        const place = (side, centre, w) => ({ side, along: mm(centre), position: placeOnWall(size, side, centre - w / 2, w, socketRule.faceDepth) });
        const lengthOf = (side) => (side === 'north' || side === 'south' ? size.width : size.depth);

        // Switches: beside each door, on the side with more wall, at the offset from the frame.
        const switches = [];
        for (const d of openings.filter((o) => o.kind === 'door')) {
          const side = openingSide(d.value.position, size, tolerance);
          if (!side) continue;
          const a = alongWall(d.value.position, size, side);
          const after = a.start + a.width + switchRule.offset + switchRule.faceWidth;
          const before = a.start - switchRule.offset - switchRule.faceWidth;
          const useAfter = after <= a.wallLength - socketRule.clearFromCorner || before < socketRule.clearFromCorner;
          const centre = useAfter ? a.start + a.width + switchRule.offset + switchRule.faceWidth / 2 : a.start - switchRule.offset - switchRule.faceWidth / 2;
          switches.push({ door: d.id, ...place(side, centre, switchRule.faceWidth), height: switchRule.height, rule: SWITCH_RULE });
        }

        // Sockets: for each wall, the free stretches (between openings and corners) get one socket per spacing.
        let sockets = [];
        if (wetRule.then.socketsAllowed) {
          for (const side of SIDES) {
            const L = lengthOf(side);
            const blocked = openings.map((o) => {
              const s = openingSide(o.value.position, size, tolerance);
              if (s !== side) return null;
              const a = alongWall(o.value.position, size, side);
              return [a.start - socketRule.clearFromOpening, a.start + a.width + socketRule.clearFromOpening];
            }).filter(Boolean).sort((p, q) => p[0] - q[0]);
            let from = socketRule.clearFromCorner;
            const stretches = [];
            for (const [b0, b1] of blocked) {
              if (b0 > from) stretches.push([from, b0]);
              from = Math.max(from, b1);
            }
            if (L - socketRule.clearFromCorner > from) stretches.push([from, L - socketRule.clearFromCorner]);
            for (const [s0, s1] of stretches) {
              const len = s1 - s0;
              if (len < socketRule.minUsableWall) continue;
              const n = Math.ceil(len / socketRule.maxSpacing);
              for (let j = 0; j < n; j += 1) sockets.push({ ...place(side, s0 + ((j + 0.5) * len) / n, socketRule.faceWidth), height: socketRule.height, rule: 'sockets-spacing' });
            }
          }
          // The agent's own check: nothing it proposes sits in a wet zone.
          sockets = sockets.filter((s) => socketsInWetZones([s], zones).length === 0);
        }
        const notes = [];
        if (!wetRule.then.socketsAllowed) notes.push(`No ordinary sockets: the ${room.name} is a wet zone (${wetRule.id}).`);
        if (wetRule.then.zone === 'water-points-not-known') notes.push('Water points are not placed yet, so no wet zone is drawn. Re-check once they are.');
        if (switches.length === 0) notes.push('No door in this room yet, so there is no switch position.');
        const value = {
          name: `Switches and sockets of ${room.name}`, switches, sockets, notes, wetZones: zones, rule: wetRule.id, notice: ELECTRICAL_NOTICE,
        };
        const ruleId = wetRule.then.socketsAllowed ? 'electrical-switches-sockets' : 'electrical-wet-zone';
        add(elec, ruleId,
          wetRule.then.socketsAllowed
            ? `${switches.length} switch${switches.length === 1 ? '' : 'es'} beside the door${switches.length === 1 ? '' : 's'} and ${sockets.length} socket${sockets.length === 1 ? '' : 's'} along the free wall of the ${room.name}.`
            : `The ${room.name} is a wet zone: a switch by the door and no ordinary sockets.`,
          'high', [{ id: 'use-switches-sockets', label: `${switches.length} switch${switches.length === 1 ? '' : 'es'}, ${sockets.length} socket${sockets.length === 1 ? '' : 's'}`, newValue: value }]);
      }
    }
    return proposals;
  }

  // A custom answer for an electrical item is refused when a socket sits in a wet zone (the zones come from the proposal's own option).
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object') return 'A custom answer must be an object.';
    const zones = (proposal.options[0].newValue && proposal.options[0].newValue.wetZones) || [];
    if (Array.isArray(value.sockets)) {
      for (const s of value.sockets) {
        if (!s || !s.position || ![s.position.x, s.position.y, s.position.width, s.position.depth].every((n) => typeof n === 'number')) return 'Each socket needs a position with x, y, width and depth.';
      }
      const problems = socketsInWetZones(value.sockets, zones);
      if (problems.length > 0) return problems[0];
    }
    return true;
  };
  return agent;
}
