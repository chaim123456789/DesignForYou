// Inspiration layers: one overall set for the project, plus an optional
// override set per room. An inspiration set is a list of named references
// (for example "warm oak"). Image handling is out of scope.
import { findRoom } from './brain.js';

function cleanSet(set, what) {
  if (!Array.isArray(set) || set.length === 0) {
    throw new Error(`${what} needs a list with at least one named reference.`);
  }
  return set.map((ref) => {
    if (typeof ref !== 'string' || ref.trim() === '') {
      throw new Error(`${what} can only contain non-empty names.`);
    }
    return ref.trim();
  });
}

function requireRoom(project, roomId) {
  const room = project && findRoom(project, roomId);
  if (!room) throw new Error(`Room "${roomId}" does not exist.`);
  return room;
}

export function setProjectInspiration(project, set) {
  project.inspiration = cleanSet(set, 'The overall inspiration');
}

export function setRoomOverride(project, roomId, set) {
  requireRoom(project, roomId).override = cleanSet(set, 'A room override');
}

// Removing an override returns the room to the overall set.
export function clearRoomOverride(project, roomId) {
  delete requireRoom(project, roomId).override;
}

// The room's override if it has one, otherwise the overall set.
export function getEffectiveInspiration(project, roomId) {
  const room = requireRoom(project, roomId);
  return [...(room.override || project.inspiration)];
}
