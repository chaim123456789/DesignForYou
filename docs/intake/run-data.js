// The run data for the 3D viewer, made from a visitor's finished project.
// Pure logic: no page code, no file reading, no network. It uses the same pure function as the
// sample (makeRunData, copied to docs/engine/ from src/viewer/make-run-data.js), so there is no second way.
//
// The sample's room sizes and heights live in src/viewer/viewer-layout.json, which the page cannot read.
// The fixed numbers are repeated here once (a test checks they equal that file). The room sizes come
// from the optional width and depth the visitor gave in the setup step (default 4 by 4 metres).
// They only draw the 3D view. They are not the real size of the home.
import { makeRunData } from '../engine/viewer/make-run-data.js';
import { allRooms } from './state.js';

export const VIEWER_NUMBERS = Object.freeze({
  gapBetweenRooms: 0.2,
  floorToFloorHeight: 3.0,
  wallHeight: 2.6,
  doorHeight: 2.0,
  windowHeight: 1.2,
  windowBottom: 0.9,
  furnitureHeight: 0.8,
  styleMarker: Object.freeze({ width: 0.6, depth: 0.6, height: 0.05 }),
});

// Rooms are looked up by name. A table without a prototype, so a room called "constructor" is just a name.
export function buildRunLayout(state) {
  const rooms = Object.create(null);
  for (const room of allRooms(state)) rooms[room.name] = { width: room.width, depth: room.depth };
  return { ...VIEWER_NUMBERS, styleMarker: { ...VIEWER_NUMBERS.styleMarker }, rooms };
}

export function buildOwnRunData(project, state) {
  return makeRunData(project, buildRunLayout(state));
}
