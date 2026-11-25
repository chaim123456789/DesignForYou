// The Floors and ceilings agent (design-team B3). Third in the team. It owns the `floor` and `ceiling` items: one of each per room.
// A fixed, rule-based step: no AI, no randomness, no clock. Its numbers come from src/knowledge/floors-ceilings/.
//
// It reads the walls and the doors and windows (earlier agents) and its own items. It never reads a later agent's items.
//   Floor surface: a surface per room type. A wet room (kitchen, bathroom, toilet, utility) is offered wet-safe surfaces only.
//   Threshold: where a door joins two rooms whose surfaces differ, a threshold goes under the door. A threshold is kept on the
//     floor of the later room of the pair, so each threshold has exactly one owner item.
//   Ceiling: its height comes from the wall height; a ceiling below the smallest usual height for the room type is flagged.
import { loadKnowledge } from '../../knowledge/load.js';
import {
  roomsOf, neighboursOf, roomTypeOf, typePhrase, isWetType, ruleForType, ruleById, editable, inScope, sameValue, proposalId, sizeOf, wallItemOf, mm,
} from '../common.js';
import { buildProposal } from '../../proposal.js';

export const FLOORS_CEILINGS = 'Floors and ceilings';

export function loadFloorsCeilingsKnowledge() {
  return {
    rooms: loadKnowledge('shared/room-types.json').rules,
    surfaces: loadKnowledge('floors-ceilings/floor-surfaces-by-room.json').rules,
    ceilings: loadKnowledge('floors-ceilings/ceiling-heights.json').rules,
    thresholds: loadKnowledge('floors-ceilings/thresholds.json').rules,
  };
}

export function makeFloorsCeilingsAgent(knowledge = loadFloorsCeilingsKnowledge()) {
  const k = knowledge;
  const reach = ruleById(k.thresholds, 'thresholds-door-reach').then.reach;

  function agent(view, context) {
    const mode = context && context.mode;
    const rooms = roomsOf(view);
    const seen = view.items.filter((i) => i.kind === 'wall' || i.kind === 'door' || i.kind === 'window' || i.kind === 'floor' || i.kind === 'ceiling');
    const floorOf = (roomId) => seen.find((i) => i.kind === 'floor' && i.owner === FLOORS_CEILINGS && i.room === roomId);
    const ceilingOf = (roomId) => seen.find((i) => i.kind === 'ceiling' && i.owner === FLOORS_CEILINGS && i.room === roomId);
    const doors = seen.filter((i) => i.kind === 'door' && i.owner === 'Doors and windows' && i.value && i.value.position);
    const proposals = [];

    const typeOf = (room) => roomTypeOf(room.name, k.rooms);
    // The surfaces offered for a room, wet-safe only in a wet room.
    const offered = (room) => {
      const type = typeOf(room);
      const wet = isWetType(type, k.rooms);
      const rule = ruleForType(k.surfaces, type);
      const list = rule.then.surfaces.filter((s) => !wet || s.wetSafe);
      return { type, wet, rule, list };
    };
    // The surface a room is taken to have when a threshold is worked out: the decided one, or the first one offered.
    const surfaceOfRoom = (room) => {
      const f = floorOf(room.id);
      const o = offered(room);
      const name = f && f.value && f.value.surface ? f.value.surface : o.list[0].name;
      const known = o.rule.then.surfaces.find((s) => s.name === name);
      return { name, wetSafe: known ? known.wetSafe : false };
    };
    const sizeInRoom = (room) => sizeOf(room, wallItemOf(view, room.id));

    // Thresholds kept on the floor of `room`: one for each door that joins it to the room before it on its floor, where surfaces differ.
    const thresholdsFor = (room, mySurface) => {
      const before = neighboursOf(rooms, room).west;
      if (!before) return [];
      const beforeSize = sizeInRoom(before);
      const mySize = sizeInRoom(room);
      const joins = doors.filter((d) => {
        const p = d.value.position;
        if (d.room === before.id) return !!beforeSize && p.x + p.width >= beforeSize.width - reach;
        if (d.room === room.id) return !!mySize && p.x <= reach;
        return false;
      });
      const other = surfaceOfRoom(before);
      const out = [];
      for (const d of joins) {
        if (other.name === mySurface.name) continue;
        const wetDry = other.wetSafe !== mySurface.wetSafe && (isWetType(typeOf(before), k.rooms) || isWetType(typeOf(room), k.rooms));
        const rule = ruleById(k.thresholds, wetDry ? 'thresholds-wet-dry' : 'thresholds-surface-change');
        out.push({ door: d.id, name: d.value.name || 'Door', between: [other.name, mySurface.name], type: rule.then.type, maxHeight: rule.then.maxHeight, rule: rule.id });
      }
      return out.sort((a, b) => (a.door < b.door ? -1 : 1));
    };

    const add = (item, ruleId, why, confidence, options) => {
      if (options.some((o) => sameValue(o.newValue, item.value))) return;
      proposals.push(buildProposal({
        id: proposalId('floors', item.id, ruleId, mode), agent: FLOORS_CEILINGS, itemId: item.id, why, source: 'rule', ruleId, confidence, options,
      }, { items: seen }));
    };

    for (const room of rooms) {
      // ---- the floor
      const floor = floorOf(room.id);
      if (floor && editable(floor) && inScope(floor, context)) {
        const o = offered(room);
        const cur = floor.value && floor.value.surface;
        const make = (s) => ({ name: `Floor of ${room.name}`, surface: s.name, wetSafe: s.wetSafe, thresholds: thresholdsFor(room, s), rule: o.rule.id });
        if (!cur) {
          const options = o.list.slice(0, 2).map((s, i) => ({ id: `surface-${s.name.replace(/\s+/g, '-')}`, label: s.name, newValue: make(s) }));
          add(floor, o.wet ? 'floors-wet-safe-surface' : 'floors-surface-by-room',
            o.wet
              ? `The ${room.name} is a wet room (${o.type}), so only wet-safe floor surfaces are offered.`
              : `${typePhrase(o.type)[0].toUpperCase()}${typePhrase(o.type).slice(1)} usually has ${o.list[0].name}. Other usual choices are shown too.`,
            'high', options);
        } else {
          const known = o.rule.then.surfaces.find((s) => s.name === cur);
          const wetSafe = known ? known.wetSafe : floor.value.wetSafe === true;
          if (o.wet && !wetSafe) {
            add(floor, 'floors-wet-safe-surface', `${cur} is not wet-safe, and the ${room.name} is a wet room. Pick a wet-safe surface.`, 'high',
              o.list.slice(0, 2).map((s, i) => ({ id: `surface-${s.name.replace(/\s+/g, '-')}`, label: s.name, newValue: make(s) })));
          } else {
            const mine = { name: cur, wetSafe };
            const next = { ...floor.value, wetSafe, thresholds: thresholdsFor(room, mine) };
            if (!sameValue(next.thresholds, floor.value.thresholds || [])) {
              add(floor, 'floors-threshold', `A door joins the ${room.name} to the room before it, and the two floors differ. Put a threshold under the door.`, 'high', [
                { id: 'update-thresholds', label: next.thresholds.length ? `Thresholds: ${next.thresholds.map((t) => `${t.type} under ${t.name}`).join(', ')}` : 'No threshold needed now', newValue: next },
              ]);
            }
          }
        }
      }

      // ---- the ceiling
      const ceiling = ceilingOf(room.id);
      if (ceiling && editable(ceiling) && inScope(ceiling, context)) {
        const type = typeOf(room);
        const min = ruleForType(k.ceilings, type);
        const wall = wallItemOf(view, room.id);
        const segs = wall && wall.value && Array.isArray(wall.value.segments) ? wall.value.segments : [];
        const wallHeight = segs.length ? Math.min(...segs.map((s) => s.height)) : null;
        const cur = ceiling.value && ceiling.value.height;
        if (typeof cur === 'number') {
          if (cur < min.then.minHeight) {
            const raised = { name: `Ceiling of ${room.name}`, height: min.then.minHeight, type: 'flat', rule: min.id };
            const kept = { name: `Ceiling of ${room.name}`, height: cur, type: 'flat', rule: min.id, flag: `Lower than the usual ${min.then.minHeight} m for ${typePhrase(type)}. Check with a professional.` };
            add(ceiling, 'ceilings-below-minimum', `The ceiling of the ${room.name} is ${mm(cur)} m, lower than the usual ${min.then.minHeight} m for ${typePhrase(type)}.`, 'low', [
              { id: 'raise-to-minimum', label: `Raise it to ${min.then.minHeight} m`, newValue: raised },
              { id: 'keep-flagged', label: `Keep ${mm(cur)} m and flag it`, newValue: kept },
            ]);
          }
        } else {
          // No wall height yet (the walls are not decided): nothing to propose, the agent does not guess a height.
          const height = wallHeight;
          if (height !== null) {
            const value = { name: `Ceiling of ${room.name}`, height, type: 'flat', rule: min.id };
            if (height < min.then.minHeight) {
              add(ceiling, 'ceilings-below-minimum', `The walls of the ${room.name} are ${mm(height)} m high, lower than the usual ${min.then.minHeight} m for ${typePhrase(type)}.`, 'low', [
                { id: 'raise-to-minimum', label: `Raise it to ${min.then.minHeight} m`, newValue: { ...value, height: min.then.minHeight } },
                { id: 'keep-flagged', label: `Keep ${mm(height)} m and flag it`, newValue: { ...value, flag: `Lower than the usual ${min.then.minHeight} m for ${typePhrase(type)}. Check with a professional.` } },
              ]);
            } else {
              add(ceiling, 'ceilings-height-from-walls', `The ceiling of the ${room.name} follows the wall height, ${mm(height)} m.`, 'high', [
                { id: 'use-wall-height', label: `Ceiling height ${mm(height)} m`, newValue: value },
              ]);
            }
          }
        }
      }
    }
    return proposals;
  }

  // A custom answer for a floor is a surface name; for a ceiling a height above 0. Anything else is refused.
  agent.checkCustom = (proposal, value) => {
    if (!value || typeof value !== 'object') return 'A custom answer must be an object.';
    if ('height' in value) return typeof value.height === 'number' && value.height > 0 ? true : 'A ceiling height must be a number above 0.';
    if ('surface' in value) return typeof value.surface === 'string' && value.surface.trim() !== '' ? true : 'A floor surface needs a name.';
    return 'A custom answer needs a "surface" (floor) or a "height" (ceiling).';
  };
  return agent;
}
