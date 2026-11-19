// The Reviewer agent. It owns the clash report item only.
// It is a fixed, rule-based step: no AI and no randomness (R7.7).
//
// It only reads the Brain view it is given. It reports clashes and never fixes
// them. It returns one proposal: the new clash report for the Reviewer-owned
// clash item. The Coordinator sends that proposal to the gatekeeper, so the
// report is saved through the gatekeeper and appears in version history.
//
// Two checks (R9.3):
//  1. A door or window whose position overlaps furniture in the same room.
//  2. A room's style notes that conflict with a Locked style item in that room.
//     "Conflicts" uses the pairs in options.styleConflicts, for example
//     [["warm oak", "cold steel"]]. Only Locked items that have a tag are compared.
//     (a) A room with an override: the override notes are compared.
//     (b) A room without an override: the overall notes and style profile tags
//         (the project's overall set) are compared. An override replaces the
//         overall set for its room, so the overall set is not used there.
import { getEffectiveInspiration } from '../../brain/inspiration.js';
import { getLabels } from '../../label.js';

const OWNER = 'Reviewer';
export const NO_CLASHES = 'No clashes found';
// Added to the report only when nothing is found, so "No clashes found" is never read as "no problems".
export const NO_CLASHES_NOTE = 'The Reviewer found nothing in this small list of opposite pairs. This does not mean there are no problems.';

// True if two rectangles share any area. Touching edges do not count.
function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}

function roomName(view, roomId) {
  for (const floor of view.floors) {
    const room = floor.rooms.find((r) => r.id === roomId);
    if (room) return room.name;
  }
  return roomId;
}

function openingOnFurnitureClashes(view) {
  const clashes = [];
  const openings = view.items.filter((i) => i.kind === 'door' || i.kind === 'window');
  const furniture = view.items.filter((i) => i.kind === 'layout');
  for (const opening of openings) {
    for (const piece of furniture) {
      if (!opening.room || opening.room !== piece.room) continue;
      const a = opening.value && opening.value.position;
      const b = piece.value && piece.value.position;
      if (!a || !b || !overlaps(a, b)) continue;
      const room = roomName(view, opening.room);
      clashes.push({
        type: 'Door or window on furniture',
        items: [opening.id, piece.id],
        room: opening.room,
        description: `In the ${room}, the ${opening.value.name} sits where the ${piece.value.name} is placed.`,
        severity: opening.kind === 'door' ? 'High' : 'Medium',
      });
    }
  }
  return clashes;
}

function overrideAgainstLockedClashes(view, conflicts) {
  const clashes = [];
  const rooms = view.floors.flatMap((f) => f.rooms);
  const lockedStyle = view.items.filter((i) => i.kind === 'style' && i.status === 'Locked' && i.room);
  for (const room of rooms) {
    const hasOverride = Boolean(room.override && room.override.length > 0);
    // The room's own notes if it has an override, otherwise the overall set.
    const refs = getEffectiveInspiration(view, room.id);
    for (const item of lockedStyle.filter((i) => i.room === room.id)) {
      const tag = item.value && item.value.tag;
      if (!tag) continue;
      const opposite = refs.find((ref) =>
        conflicts.some(([x, y]) => (x === tag && y === ref) || (y === tag && x === ref)));
      if (opposite === undefined) continue;
      clashes.push({
        type: hasOverride ? 'Room override against Locked item' : 'Overall style against Locked item',
        items: [item.id],
        room: room.id,
        description: hasOverride
          ? `In the ${room.name}, the room style "${opposite}" conflicts with the Locked item "${item.value.detail}" (${tag}).`
          : `In the ${room.name}, the overall style "${opposite}" conflicts with the Locked item "${item.value.detail}" (${tag}).`,
        severity: 'Medium',
      });
    }
  }
  return clashes;
}

// options.styleConflicts : list of [tagA, tagB] pairs that conflict.
// options.isSample       : add the SAMPLE PROJECT label (also used if the Brain says isSample).
// options.reportItemId   : which clash item to save the report in (default: the first clash item).
export function createReviewerAgent(options = {}) {
  const conflicts = options.styleConflicts || [];
  return function reviewerAgent(view) {
    const reportItem = options.reportItemId
      ? view.items.find((i) => i.id === options.reportItemId)
      : view.items.find((i) => i.kind === 'clash' && i.owner === OWNER);
    if (!reportItem) {
      throw new Error('The Reviewer needs a clash report item to save its report in. None was found.');
    }

    const clashes = [...openingOnFurnitureClashes(view), ...overrideAgainstLockedClashes(view, conflicts)];
    // Each clash gets a number so the report is easy to refer to.
    const numbered = clashes.map((c, index) => ({ number: index + 1, ...c }));
    const labels = getLabels({ isSample: Boolean(options.isSample || view.isSample) });
    const summary = numbered.length === 0 ? NO_CLASHES : `${numbered.length} ${numbered.length === 1 ? "clash" : "clashes"} found`;
    const newValue = { summary, clashes: numbered, labels };
    if (numbered.length === 0) newValue.note = NO_CLASHES_NOTE;
    return [{ itemId: reportItem.id, newValue }];
  };
}

export const reviewerAgent = createReviewerAgent();
