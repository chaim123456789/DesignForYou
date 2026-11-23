// Every limit of the intake screens, in one place. Screens, checks and tests all read these numbers.
// Plain data only: no page code, so Node tests can import it directly.
export const LIMITS = Object.freeze({
  projectNameMax: 60,
  floorsMin: 1,
  floorsMax: 4,
  roomsMin: 1,
  roomsMax: 20,
  floorNameMax: 40,
  roomNameMax: 40,
  roomSizeDefault: 4, // metres, for both width and depth
  roomSizeMin: 1,
  roomSizeMax: 30,
  imagesMax: 50, // overall plus all room overrides together
  imageBytesMax: 10 * 1024 * 1024, // 10 MB
  imageTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  captionMax: 80,
  notesMaxPerLayer: 30,
  noteMax: 40,
  briefMax: 2000,
  itemTextMax: 80,
  itemTagMax: 40,
  itemsMax: 100,
  // Placed furniture, doors and windows. All lengths are whole centimetres.
  placedNameMax: 40,
  placedPerRoomMax: 30,
  placedMax: 150, // in total, all rooms together
  placedSizeMin: 10,
  placedSizeMax: 1000,
  placedPosMin: -1000, // so an object can be put outside the room on purpose, to see the clash
  placedPosMax: 3000,
  nudgeStep: 10, // centimetres
});

export const ITEM_STATUSES = Object.freeze(['Locked', 'Unsure']);

// The fixed list of opposite pairs the Reviewer compares. The same two pairs as the sample.
// The result screen shows exactly this list, and the Reviewer gets exactly this list.
export const STYLE_CONFLICTS = Object.freeze([
  Object.freeze(['warm oak', 'cold steel']),
  Object.freeze(['linen', 'glossy chrome']),
]);

// The nine fixed types of placed object (cm, width by depth, with the back at the top of the plan when turn is 0).
// The sizes are made-up placeholders. The visitor can change every one.
export const PLACE_TYPES = Object.freeze({
  sofa: Object.freeze({ kind: 'layout', name: 'Sofa', width: 200, depth: 90 }),
  bed: Object.freeze({ kind: 'layout', name: 'Bed', width: 160, depth: 200 }),
  table: Object.freeze({ kind: 'layout', name: 'Table', width: 140, depth: 80 }),
  wardrobe: Object.freeze({ kind: 'layout', name: 'Wardrobe', width: 120, depth: 60 }),
  desk: Object.freeze({ kind: 'layout', name: 'Desk', width: 120, depth: 60 }),
  bath: Object.freeze({ kind: 'layout', name: 'Bath', width: 170, depth: 75 }),
  'kitchen unit': Object.freeze({ kind: 'layout', name: 'Kitchen unit', width: 240, depth: 60 }),
  door: Object.freeze({ kind: 'door', name: 'Door', width: 90, depth: 10 }),
  window: Object.freeze({ kind: 'window', name: 'Window', width: 120, depth: 10 }),
});

export const PLACE_WALLS = Object.freeze(['Top', 'Bottom', 'Left', 'Right']);
export const PLACE_TURNS = Object.freeze([0, 90, 180, 270]);
