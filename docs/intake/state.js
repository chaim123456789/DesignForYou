// The visitor's inputs, kept in the page's memory only (never stored, never sent).
// Pure functions, no page code. Every function that changes the state:
//  - checks the input first,
//  - returns { ok: true, ... } and changes the state, or
//  - returns { ok: false, message } with a plain sentence and changes nothing.
import { LIMITS, ITEM_STATUSES, PLACE_TYPES, PLACE_WALLS } from './limits.js';

export function createState() {
  return {
    name: '',
    floors: [], // { id, name, rooms: [{ id, name, width, depth }] }
    overall: { notes: [], images: [] },
    overrides: {}, // roomId -> { notes: [], images: [] }
    brief: '',
    tasteAnswers: {},
    removedTags: [],
    items: [], // { id, text, room (room id), status, tag }
    placed: [], // { id, kind, type, name, room (room id), status, x, y, width, depth, turn } in whole centimetres
    nextId: 1,
  };
}

const bad = (message) => ({ ok: false, message });
const clean = (text) => (typeof text === 'string' ? text.trim() : '');
const newId = (state, prefix) => `${prefix}${state.nextId++}`;

// ---- Lookups (read only) ----

export function allRooms(state) {
  return state.floors.flatMap((f) => f.rooms);
}
export function findRoom(state, roomId) {
  return allRooms(state).find((r) => r.id === roomId);
}
function findFloor(state, floorId) {
  return state.floors.find((f) => f.id === floorId);
}
export function allImages(state) {
  return [...state.overall.images, ...Object.values(state.overrides).flatMap((o) => o.images)];
}

// True once the visitor has entered anything. The page warns before leaving only then.
export function hasEntries(state) {
  return state.name !== ''
    || state.floors.length > 0
    || state.overall.notes.length > 0
    || state.overall.images.length > 0
    || Object.keys(state.overrides).length > 0
    || state.brief !== ''
    || Object.keys(state.tasteAnswers).length > 0
    || state.removedTags.length > 0
    || state.items.length > 0
    || state.placed.length > 0;
}

// A layer is 'overall' or a room id. Returns the layer object, or undefined.
function readLayer(state, layer) {
  if (layer === 'overall') return state.overall;
  return state.overrides[layer];
}
function layerError(state, layer) {
  if (layer !== 'overall' && !findRoom(state, layer)) return 'Choose a room from your list first.';
  return null;
}
// Used only after all checks pass, so a failed call never leaves an empty override behind.
function writeLayer(state, layer) {
  if (layer === 'overall') return state.overall;
  if (!state.overrides[layer]) state.overrides[layer] = { notes: [], images: [] };
  return state.overrides[layer];
}

// ---- Project name ----

export function setProjectName(state, name) {
  const text = clean(name);
  if (text.length === 0) return bad('Give your project a name.');
  if (text.length > LIMITS.projectNameMax) return bad(`Keep the project name to ${LIMITS.projectNameMax} characters or fewer.`);
  state.name = text;
  return { ok: true };
}

// ---- Floors ----

function floorNameError(name) {
  if (name.length === 0) return 'Give this floor a name.';
  if (name.length > LIMITS.floorNameMax) return `Keep the floor name to ${LIMITS.floorNameMax} characters or fewer.`;
  return null;
}

export function addFloor(state, name) {
  const text = clean(name);
  const error = floorNameError(text);
  if (error) return bad(error);
  if (state.floors.length >= LIMITS.floorsMax) return bad(`A project can have at most ${LIMITS.floorsMax} floors.`);
  const floor = { id: newId(state, 'floor-'), name: text, rooms: [] };
  state.floors.push(floor);
  return { ok: true, id: floor.id };
}

export function renameFloor(state, floorId, name) {
  const floor = findFloor(state, floorId);
  if (!floor) return bad('That floor is not in the list.');
  const text = clean(name);
  const error = floorNameError(text);
  if (error) return bad(error);
  floor.name = text;
  return { ok: true };
}

// Removes the floor, its rooms, the room overrides and the items in those rooms.
// Returns the image records that were removed, so the page can release their previews.
export function removeFloor(state, floorId) {
  const floor = findFloor(state, floorId);
  if (!floor) return bad('That floor is not in the list.');
  const removedImages = [];
  for (const room of floor.rooms) removedImages.push(...dropRoomData(state, room.id));
  state.floors = state.floors.filter((f) => f.id !== floorId);
  return { ok: true, removedImages };
}

// ---- Rooms ----

function roomNameError(state, name, exceptRoomId) {
  if (name.length === 0) return 'Give this room a name.';
  if (name.length > LIMITS.roomNameMax) return `Keep the room name to ${LIMITS.roomNameMax} characters or fewer.`;
  const lower = name.toLowerCase();
  if (allRooms(state).some((r) => r.id !== exceptRoomId && r.name.toLowerCase() === lower)) {
    return 'Another room already has this name. Room names must be different.';
  }
  return null;
}

// A size is optional. Empty, undefined or null means the default.
function sizeValue(value, label) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { value: LIMITS.roomSizeDefault };
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < LIMITS.roomSizeMin || n > LIMITS.roomSizeMax) {
    return { error: `${label} must be a number from ${LIMITS.roomSizeMin} to ${LIMITS.roomSizeMax} metres.` };
  }
  return { value: n };
}

export function addRoom(state, floorId, name, width, depth) {
  const floor = findFloor(state, floorId);
  if (!floor) return bad('Add a floor first, then add rooms to it.');
  const text = clean(name);
  const nameError = roomNameError(state, text);
  if (nameError) return bad(nameError);
  if (allRooms(state).length >= LIMITS.roomsMax) return bad(`A project can have at most ${LIMITS.roomsMax} rooms in total.`);
  const w = sizeValue(width, 'Width');
  if (w.error) return bad(w.error);
  const d = sizeValue(depth, 'Depth');
  if (d.error) return bad(d.error);
  const room = { id: newId(state, 'room-'), name: text, width: w.value, depth: d.value };
  floor.rooms.push(room);
  return { ok: true, id: room.id };
}

export function renameRoom(state, roomId, name) {
  const room = findRoom(state, roomId);
  if (!room) return bad('That room is not in the list.');
  const text = clean(name);
  const error = roomNameError(state, text, roomId);
  if (error) return bad(error);
  room.name = text;
  return { ok: true };
}

// Removes the room's override, the items and the placed objects in the room. Returns the removed image records.
function dropRoomData(state, roomId) {
  const removedImages = state.overrides[roomId] ? [...state.overrides[roomId].images] : [];
  delete state.overrides[roomId];
  state.items = state.items.filter((i) => i.room !== roomId);
  state.placed = state.placed.filter((o) => o.room !== roomId);
  return removedImages;
}

export function removeRoom(state, roomId) {
  const room = findRoom(state, roomId);
  if (!room) return bad('That room is not in the list.');
  const removedImages = dropRoomData(state, roomId);
  for (const floor of state.floors) floor.rooms = floor.rooms.filter((r) => r.id !== roomId);
  return { ok: true, removedImages };
}

// ---- Images (records only: the page makes and releases the preview address) ----

// file: { name, type, size, caption? }, previewUrl: set by the page, optional here.
export function addImage(state, layer, file, previewUrl) {
  const where = layerError(state, layer);
  if (where) return bad(where);
  const name = file && typeof file.name === 'string' ? file.name : '';
  if (!file || !LIMITS.imageTypes.includes(file.type)) {
    return bad(`${name ? `"${name}" is not` : 'This file is not'} a JPEG, PNG or WebP image, so it was not added.`);
  }
  if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size <= 0) {
    return bad(`${name ? `"${name}" is` : 'This file is'} empty, so it was not added.`);
  }
  if (file.size > LIMITS.imageBytesMax) {
    return bad(`${name ? `"${name}" is` : 'This image is'} larger than ${LIMITS.imageBytesMax / (1024 * 1024)} MB, so it was not added.`);
  }
  const caption = clean(file.caption);
  if (caption.length > LIMITS.captionMax) return bad(`Keep the caption to ${LIMITS.captionMax} characters or fewer.`);
  if (allImages(state).length >= LIMITS.imagesMax) {
    return bad(`You can add at most ${LIMITS.imagesMax} images in total, overall and room overrides together.`);
  }
  const image = { id: newId(state, 'image-'), name, caption, type: file.type, size: file.size, previewUrl: previewUrl || null };
  writeLayer(state, layer).images.push(image);
  return { ok: true, id: image.id };
}

// Change the caption of an image. An empty caption is allowed (the image then gets "Inspiration image N").
export function setImageCaption(state, imageId, caption) {
  const image = allImages(state).find((i) => i.id === imageId);
  if (!image) return bad('That image is not in the list.');
  const text = clean(caption);
  if (text.length > LIMITS.captionMax) return bad(`Keep the caption to ${LIMITS.captionMax} characters or fewer.`);
  image.caption = text;
  return { ok: true, caption: text };
}

// Returns the removed record, so the page can release its preview address.
export function removeImage(state, imageId) {
  const layers = [state.overall, ...Object.values(state.overrides)];
  for (const layer of layers) {
    const index = layer.images.findIndex((i) => i.id === imageId);
    if (index !== -1) {
      const [image] = layer.images.splice(index, 1);
      return { ok: true, image };
    }
  }
  return bad('That image is not in the list.');
}

// ---- Notes ----

export function addNote(state, layer, text) {
  const where = layerError(state, layer);
  if (where) return bad(where);
  const note = clean(text);
  if (note.length === 0) return bad('Write a note first, for example "warm oak".');
  if (note.length > LIMITS.noteMax) return bad(`Keep each note to ${LIMITS.noteMax} characters or fewer.`);
  const existing = readLayer(state, layer);
  if (existing && existing.notes.length >= LIMITS.notesMaxPerLayer) {
    return bad(`You can add at most ${LIMITS.notesMaxPerLayer} notes here.`);
  }
  writeLayer(state, layer).notes.push(note);
  return { ok: true };
}

export function removeNote(state, layer, index) {
  const existing = readLayer(state, layer);
  if (!existing || !Number.isInteger(index) || index < 0 || index >= existing.notes.length) {
    return bad('That note is not in the list.');
  }
  existing.notes.splice(index, 1);
  return { ok: true };
}

// The room goes back to the overall inspiration. Returns the removed image records.
export function removeOverride(state, roomId) {
  if (!state.overrides[roomId]) return bad('This room has no override to remove.');
  const removedImages = [...state.overrides[roomId].images];
  delete state.overrides[roomId];
  return { ok: true, removedImages };
}

// ---- Brief ----

export function setBrief(state, text) {
  const value = typeof text === 'string' ? text : '';
  if (value.length > LIMITS.briefMax) return bad(`Keep the brief to ${LIMITS.briefMax} characters or fewer.`);
  state.brief = value;
  return { ok: true };
}

// ---- Items (style items only in this version) ----

function checkItemFields(state, fields) {
  const text = clean(fields.text);
  if (text.length === 0) return { error: 'Describe the item, for example "Oak floor in the kitchen".' };
  if (text.length > LIMITS.itemTextMax) return { error: `Keep the item description to ${LIMITS.itemTextMax} characters or fewer.` };
  if (!findRoom(state, fields.room)) return { error: 'Choose a room for this item.' };
  if (!ITEM_STATUSES.includes(fields.status)) return { error: 'Choose Locked or Unsure for this item.' };
  const tag = clean(fields.tag);
  if (tag.length > LIMITS.itemTagMax) return { error: `Keep the material, colour or style to ${LIMITS.itemTagMax} characters or fewer.` };
  return { value: { text, room: fields.room, status: fields.status, tag } };
}

export function addItem(state, fields) {
  const checked = checkItemFields(state, fields || {});
  if (checked.error) return bad(checked.error);
  if (state.items.length >= LIMITS.itemsMax) return bad(`You can add at most ${LIMITS.itemsMax} items.`);
  const item = { id: newId(state, 'item-'), ...checked.value };
  state.items.push(item);
  return { ok: true, id: item.id };
}

// changes: any of text, room, status, tag. Missing fields keep their old value.
export function editItem(state, itemId, changes) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return bad('That item is not in the list.');
  const checked = checkItemFields(state, { ...item, ...(changes || {}) });
  if (checked.error) return bad(checked.error);
  Object.assign(item, checked.value);
  return { ok: true };
}

export function removeItem(state, itemId) {
  const index = state.items.findIndex((i) => i.id === itemId);
  if (index === -1) return bad('That item is not in the list.');
  state.items.splice(index, 1);
  return { ok: true };
}

// ---- Placed furniture, doors and windows (whole centimetres, kept in memory only) ----

export function placedInRoom(state, roomId) {
  return state.placed.filter((o) => o.room === roomId);
}

const WHOLE_NUMBER = /^-?\d+$/;

// Returns { value } or { error }. Only whole numbers are accepted, as a number or as text.
function wholeCm(raw, label, min, max) {
  const error = { error: `${label} must be a whole number of centimetres from ${min} to ${max}.` };
  let n;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string' && WHOLE_NUMBER.test(raw.trim())) n = Number(raw.trim());
  else return error;
  if (!Number.isInteger(n) || n < min || n > max) return error;
  return { value: n };
}

const sizeCm = (raw, label) => wholeCm(raw, label, LIMITS.placedSizeMin, LIMITS.placedSizeMax);
const posCm = (raw, label) => wholeCm(raw, label, LIMITS.placedPosMin, LIMITS.placedPosMax);

// Checks a complete set of fields. Returns { value } or { error }. Never changes the state.
// exceptId: the object being edited, so it is not counted twice against the limits.
function checkPlacedFields(state, fields, exceptId) {
  const name = clean(fields.name);
  if (name.length === 0) return { error: 'Give this object a name.' };
  if (name.length > LIMITS.placedNameMax) return { error: `Keep the object name to ${LIMITS.placedNameMax} characters or fewer.` };
  if (!ITEM_STATUSES.includes(fields.status)) return { error: 'Choose Locked or Unsure for this object.' };
  if (!findRoom(state, fields.room)) return { error: 'Choose a room for this object.' };
  const width = sizeCm(fields.width, 'Width');
  if (width.error) return width;
  const depth = sizeCm(fields.depth, 'Depth');
  if (depth.error) return depth;
  const x = posCm(fields.x, 'Left');
  if (x.error) return x;
  const y = posCm(fields.y, 'Top');
  if (y.error) return y;
  const others = state.placed.filter((o) => o.id !== exceptId);
  if (others.length >= LIMITS.placedMax) return { error: `You can place at most ${LIMITS.placedMax} objects in total.` };
  if (others.filter((o) => o.room === fields.room).length >= LIMITS.placedPerRoomMax) {
    return { error: `You can place at most ${LIMITS.placedPerRoomMax} objects in one room.` };
  }
  return { value: { name, status: fields.status, room: fields.room, x: x.value, y: y.value, width: width.value, depth: depth.value } };
}

const findPlaced = (state, id) => state.placed.find((o) => o.id === id);
const MISSING_PLACED = 'That object is not in the list.';

// fields: type, name, room, status (required, no default) and optionally x, y, width, depth.
// A field that is left out (undefined) takes the type's start value; a field that is given must be valid.
export function addPlaced(state, fields) {
  const f = fields || {};
  const type = PLACE_TYPES[f.type] && Object.hasOwn(PLACE_TYPES, f.type) ? PLACE_TYPES[f.type] : null;
  if (!type) return bad('Choose a type from the list.');
  const withStart = {
    name: f.name === undefined ? type.name : f.name,
    status: f.status,
    room: f.room,
    x: f.x === undefined ? 0 : f.x,
    y: f.y === undefined ? 0 : f.y,
    width: f.width === undefined ? type.width : f.width,
    depth: f.depth === undefined ? type.depth : f.depth,
  };
  const checked = checkPlacedFields(state, withStart);
  if (checked.error) return bad(checked.error);
  const object = { id: newId(state, 'placed-'), kind: type.kind, type: f.type, turn: 0, ...checked.value };
  state.placed.push(object);
  return { ok: true, id: object.id };
}

// changes: any of name, room, status, x, y, width, depth. Missing fields keep their old value.
// The type cannot be changed (remove the object and add a new one).
export function editPlaced(state, id, changes) {
  const object = findPlaced(state, id);
  if (!object) return bad(MISSING_PLACED);
  const c = changes || {};
  if (c.type !== undefined && c.type !== object.type) return bad('The type cannot be changed. Remove the object and add a new one.');
  const checked = checkPlacedFields(state, { ...object, ...c }, id);
  if (checked.error) return bad(checked.error);
  Object.assign(object, checked.value);
  return { ok: true };
}

export function movePlacedTo(state, id, x, y) {
  const object = findPlaced(state, id);
  if (!object) return bad(MISSING_PLACED);
  const left = posCm(x, 'Left');
  if (left.error) return bad(left.error);
  const top = posCm(y, 'Top');
  if (top.error) return bad(top.error);
  object.x = left.value;
  object.y = top.value;
  return { ok: true };
}

const NUDGES = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

// direction: 'left', 'right', 'up' or 'down'. Moves exactly one step (10 cm). It may leave the room; the list says so.
export function nudgePlaced(state, id, direction) {
  const object = findPlaced(state, id);
  if (!object) return bad(MISSING_PLACED);
  if (!Object.hasOwn(NUDGES, direction)) return bad('Choose left, right, up or down.');
  const [dx, dy] = NUDGES[direction];
  const left = posCm(object.x + dx * LIMITS.nudgeStep, 'Left');
  if (left.error) return bad(left.error);
  const top = posCm(object.y + dy * LIMITS.nudgeStep, 'Top');
  if (top.error) return bad(top.error);
  object.x = left.value;
  object.y = top.value;
  return { ok: true };
}

// A quarter turn clockwise. Width and depth swap and the top-left corner stays where it is.
export function turnPlaced(state, id) {
  const object = findPlaced(state, id);
  if (!object) return bad(MISSING_PLACED);
  [object.width, object.depth] = [object.depth, object.width];
  object.turn = (object.turn + 90) % 360;
  return { ok: true };
}

// Puts a door or window flush against a wall of its room, keeping its distance along the wall.
// The long side lies along the wall: if it does not, the object is turned a quarter first.
export function setPlacedWall(state, id, wall) {
  const object = findPlaced(state, id);
  if (!object) return bad(MISSING_PLACED);
  if (object.kind !== 'door' && object.kind !== 'window') return bad('Only a door or a window can be put against a wall.');
  if (!PLACE_WALLS.includes(wall)) return bad('Choose Top, Bottom, Left or Right.');
  const room = findRoom(state, object.room);
  if (!room) return bad('Choose a room for this object.');
  const roomWidth = Math.round(room.width * 100);
  const roomDepth = Math.round(room.depth * 100);
  const horizontalWall = wall === 'Top' || wall === 'Bottom';
  let { width, depth, turn } = object;
  if (horizontalWall ? depth > width : width > depth) {
    [width, depth] = [depth, width];
    turn = (turn + 90) % 360;
  }
  let { x, y } = object;
  if (wall === 'Top') y = 0;
  else if (wall === 'Bottom') y = roomDepth - depth;
  else if (wall === 'Left') x = 0;
  else x = roomWidth - width;
  const left = posCm(x, 'Left');
  if (left.error) return bad(left.error);
  const top = posCm(y, 'Top');
  if (top.error) return bad(top.error);
  Object.assign(object, { x, y, width, depth, turn });
  return { ok: true };
}

export function setPlacedStatus(state, id, status) {
  const object = findPlaced(state, id);
  if (!object) return bad(MISSING_PLACED);
  if (!ITEM_STATUSES.includes(status)) return bad('Choose Locked or Unsure for this object.');
  object.status = status;
  return { ok: true };
}

export function removePlaced(state, id) {
  const index = state.placed.findIndex((o) => o.id === id);
  if (index === -1) return bad(MISSING_PLACED);
  state.placed.splice(index, 1);
  return { ok: true };
}
