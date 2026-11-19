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
});

export const ITEM_STATUSES = Object.freeze(['Locked', 'Unsure']);

// The fixed list of opposite pairs the Reviewer compares. The same two pairs as the sample.
// The result screen shows exactly this list, and the Reviewer gets exactly this list.
export const STYLE_CONFLICTS = Object.freeze([
  Object.freeze(['warm oak', 'cold steel']),
  Object.freeze(['linen', 'glossy chrome']),
]);
