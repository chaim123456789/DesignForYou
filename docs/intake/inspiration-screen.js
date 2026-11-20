// The two inspiration screens: "Overall inspiration" (images and notes for the whole project) and
// "Room overrides" (notes for one room, and removing that room's override).
//
// This file imports nothing. screens.js loads state.js and limits.js (with the page's cache tag) and
// hands them in. It never stores or sends anything.
//
// Images: the browser's file picker gives a file. Its name, type and size are checked, and only a file
// that passes gets a temporary preview address (URL.createObjectURL). The address is released when the
// image is removed, when its room or floor is removed, and on "Start again" (see releaseImages in
// screens.js). The contents of a file are never read, never put in the Brain and never sent anywhere.
// Everything the visitor typed is put on the page with textContent.
//
// Every part is set up in its own protected step (attempt and guarded come from screens.js).

export function setUpInspirationScreens(tools) {
  const { el, attempt, guarded, announce, getState, api, limits, releaseImages, onShow } = tools;

  const OVERALL = 'overall';
  const refs = {};
  for (const id of ['inspiration-less', 'image-target', 'image-file', 'image-error', 'image-list-heading', 'image-empty', 'image-list',
    'note-text', 'add-note', 'note-error', 'note-list-heading', 'note-empty', 'note-list',
    'override-no-rooms', 'override-room', 'override-state', 'override-note-text', 'add-override-note',
    'override-note-error', 'override-list-heading', 'override-note-empty', 'override-note-list', 'remove-override']) {
    refs[id] = el(id);
  }

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const unique = (list) => list.filter((entry, index) => list.indexOf(entry) === index);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---- Messages next to fields (same pattern as the setup screen) ---------------------------

  const describedBase = new Map();
  function showFieldError(input, errorBox, message) {
    if (!describedBase.has(input)) describedBase.set(input, input.getAttribute('aria-describedby') || '');
    errorBox.textContent = message;
    errorBox.hidden = false;
    input.setAttribute('aria-describedby', [describedBase.get(input), errorBox.id].filter(Boolean).join(' '));
    input.setAttribute('aria-invalid', 'true');
  }
  function clearFieldError(input, errorBox) {
    errorBox.textContent = '';
    errorBox.hidden = true;
    if (describedBase.has(input)) {
      if (describedBase.get(input)) input.setAttribute('aria-describedby', describedBase.get(input));
      else input.removeAttribute('aria-describedby');
    }
    input.removeAttribute('aria-invalid');
  }

  // ---- Names for layers and images ----------------------------------------------------------

  function roomName(state, roomId) {
    const room = api.findRoom(state, roomId);
    return room ? room.name : 'a room that was removed';
  }
  const layerLabel = (state, layer) => (layer === OVERALL ? 'Whole project' : `Room: ${roomName(state, layer)}`);

  // Every image in the order of api.allImages, with its layer and its number on screen.
  function numberedImages(state) {
    const layers = [[OVERALL, state.overall], ...Object.entries(state.overrides)];
    let n = 0;
    return layers.flatMap(([layer, data]) => data.images.map((image) => ({ layer, image, number: (n += 1) })));
  }
  const imageDescription = (image, number) => image.caption || `Inspiration image ${number}`;

  // ---- Images -------------------------------------------------------------------------------

  // Check one file. Only a file that passes gets a preview address.
  function addOneImage(state, layer, file) {
    const record = { name: file && file.name, type: file && file.type, size: file && file.size };
    const result = api.addImage(state, layer, record, null);
    if (!result.ok) return result;
    const image = api.allImages(state).find((i) => i.id === result.id);
    try {
      image.previewUrl = URL.createObjectURL(file);
    } catch (error) {
      api.removeImage(state, result.id);
      return { ok: false, message: `"${record.name}" could not be shown, so it was not added.` };
    }
    return result;
  }

  function addFiles() {
    const state = getState();
    const files = Array.from(refs['image-file'].files || []);
    if (files.length === 0) return;
    const layer = refs['image-target'].value || OVERALL;
    let added = 0;
    const refused = [];
    for (const file of files) {
      const result = addOneImage(state, layer, file);
      if (result.ok) added += 1; else refused.push(result.message);
    }
    refs['image-file'].value = ''; // so the same file can be chosen again
    const refusedText = unique(refused).join(' ');
    if (refused.length > 0) showFieldError(refs['image-file'], refs['image-error'], refusedText);
    else clearFieldError(refs['image-file'], refs['image-error']);
    renderAll();
    const addedText = added > 0 ? `${plural(added, 'image', 'images')} added to ${layerLabel(state, layer).toLowerCase()}. You now have ${api.allImages(state).length} of ${limits.imagesMax} images.` : '';
    announce([addedText, refusedText].filter(Boolean).join(' '));
    if (refused.length > 0) refs['image-file'].focus();
  }

  function removeImage(imageId) {
    const state = getState();
    const result = api.removeImage(state, imageId);
    if (result.ok) releaseImages([result.image]);
    clearFieldError(refs['image-file'], refs['image-error']);
    renderAll();
    refs['image-list-heading'].focus();
    announce(result.ok ? `Image removed: ${result.image.name}.` : result.message);
  }

  function imageRow({ layer, image, number }, state) {
    const li = make('li', 'entry image-entry');
    const picture = make('img', 'image-preview');
    picture.src = image.previewUrl || '';
    picture.alt = imageDescription(image, number);
    const info = make('div', 'image-info');
    info.append(make('span', 'entry-name', `Image ${number}: ${image.name}`), make('span', 'entry-detail', layerLabel(state, layer)));

    const captionId = `caption-${image.id}`;
    const errorId = `caption-error-${image.id}`;
    const label = make('label', '', `Caption for image ${number} (optional)`);
    label.setAttribute('for', captionId);
    const input = make('input', 'text-input');
    input.id = captionId;
    input.setAttribute('type', 'text');
    input.setAttribute('autocomplete', 'off');
    input.value = image.caption;
    const errorBox = make('p', 'field-error');
    errorBox.id = errorId;
    errorBox.hidden = true;
    const saveCaption = () => {
      const result = api.setImageCaption(getState(), image.id, input.value);
      if (!result.ok) { showFieldError(input, errorBox, result.message); return; }
      clearFieldError(input, errorBox);
      picture.alt = imageDescription(image, number);
      announce(result.caption ? `Caption saved for image ${number}.` : `Caption removed for image ${number}.`);
    };
    input.addEventListener('change', guarded('Image caption box', saveCaption));
    input.addEventListener('keydown', guarded('Image caption box', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); saveCaption(); }
    }));

    const remove = make('button', 'action-button', `Remove image ${number}: ${image.name}`);
    remove.setAttribute('type', 'button');
    remove.addEventListener('click', guarded('Remove image button', () => removeImage(image.id)));
    li.append(picture, info, label, input, errorBox, remove);
    return li;
  }

  function renderImages(state) {
    const images = numberedImages(state);
    refs['image-list'].replaceChildren(...images.map((entry) => imageRow(entry, state)));
    refs['image-empty'].hidden = images.length > 0;
  }

  // ---- Notes (the same code for the overall layer and for one room) --------------------------

  // `where` says which layer the controls belong to and where their parts are.
  function notesPart(where) {
    const { input, addButton, errorBox, list, empty, heading, layer } = where;

    const notesNow = () => {
      const state = getState();
      const data = layer() === OVERALL ? state.overall : state.overrides[layer()];
      return data ? data.notes : [];
    };

    function add() {
      const state = getState();
      const result = api.addNote(state, layer(), input.value);
      if (!result.ok) {
        showFieldError(input, errorBox, result.message);
        input.focus();
        return;
      }
      const text = input.value.trim();
      clearFieldError(input, errorBox);
      input.value = '';
      renderAll();
      announce(`Note added: ${text}. You now have ${notesNow().length} of ${limits.notesMaxPerLayer} notes here.`);
      input.focus();
    }

    function remove(index) {
      const state = getState();
      const text = notesNow()[index];
      const result = api.removeNote(state, layer(), index);
      renderAll();
      heading.focus();
      announce(result.ok ? `Note removed: ${text}.` : result.message);
    }

    function render() {
      const notes = notesNow();
      list.replaceChildren(...notes.map((text, index) => {
        const li = make('li', 'entry');
        const row = make('div', 'entry-row');
        const button = make('button', 'action-button', `Remove note ${text}`);
        button.setAttribute('type', 'button');
        button.addEventListener('click', guarded('Remove note button', () => remove(index)));
        const actions = make('span', 'entry-actions');
        actions.append(button);
        row.append(make('span', 'entry-name', text), actions);
        li.append(row);
        return li;
      }));
      empty.hidden = notes.length > 0;
    }

    addButton.addEventListener('click', guarded('Add note button', add));
    input.addEventListener('keydown', guarded('Note box', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); add(); }
    }));
    return render;
  }

  // ---- Room overrides -----------------------------------------------------------------------

  const selectedRoom = () => refs['override-room'].value;

  function overrideSentence(state) {
    const roomId = selectedRoom();
    if (!api.findRoom(state, roomId)) return '';
    const name = roomName(state, roomId);
    const data = state.overrides[roomId];
    if (!data) return `${name} uses the overall inspiration.`;
    const notes = plural(data.notes.length, 'note', 'notes');
    const images = plural(data.images.length, 'image', 'images');
    return data.notes.length > 0
      ? `${name} uses its own notes (${notes}), not the overall notes. It has ${images}.`
      : `${name} has ${images} of its own but no notes, so it still uses the overall notes.`;
  }

  function removeOverride() {
    const state = getState();
    const roomId = selectedRoom();
    const name = roomName(state, roomId);
    const result = api.removeOverride(state, roomId);
    if (result.ok) releaseImages(result.removedImages);
    renderAll();
    refs['override-list-heading'].focus();
    announce(result.ok ? `Override removed for ${name}. ${name} uses the overall inspiration again.` : result.message);
  }

  function renderOverrides(state) {
    const hasRooms = api.allRooms(state).length > 0;
    refs['override-no-rooms'].hidden = hasRooms;
    const sentence = overrideSentence(state);
    refs['override-state'].textContent = sentence;
    refs['override-state'].hidden = sentence === '';
    refs['remove-override'].hidden = !state.overrides[selectedRoom()];
  }

  // ---- Choices that depend on the rooms entered in setup -----------------------------------

  function fillSelect(select, options) {
    const before = select.value;
    select.replaceChildren(...options.map(([value, text]) => {
      const option = make('option', '', text);
      option.value = value;
      return option;
    }));
    select.value = options.some(([value]) => value === before) ? before : options[0][0];
  }

  function fillRoomChoices() {
    const state = getState();
    const rooms = api.allRooms(state);
    fillSelect(refs['image-target'], [[OVERALL, 'Whole project'], ...rooms.map((r) => [r.id, `Room: ${r.name}`])]);
    fillSelect(refs['override-room'], rooms.length > 0 ? rooms.map((r) => [r.id, r.name]) : [['', 'No rooms yet']]);
  }

  // ---- Drawing everything -------------------------------------------------------------------

  let renderOverallNotes = () => {};
  let renderRoomNotes = () => {};

  function renderAll() {
    const state = getState();
    attempt('Image list', () => renderImages(state));
    attempt('Overall notes list', renderOverallNotes);
    attempt('Room notes list', renderRoomNotes);
    attempt('Room override text', () => renderOverrides(state));
    attempt('Sentence about having less to work with', () => {
      refs['inspiration-less'].hidden = api.allImages(state).length > 0 || state.overall.notes.length > 0;
    });
  }

  // ---- Wiring -------------------------------------------------------------------------------

  attempt('Image picker', () => {
    refs['image-file'].addEventListener('change', guarded('Image picker', addFiles));
  });
  attempt('Overall notes', () => {
    renderOverallNotes = notesPart({
      input: refs['note-text'], addButton: refs['add-note'], errorBox: refs['note-error'],
      list: refs['note-list'], empty: refs['note-empty'], heading: refs['note-list-heading'], layer: () => OVERALL,
    });
  });
  attempt('Room notes', () => {
    renderRoomNotes = notesPart({
      input: refs['override-note-text'], addButton: refs['add-override-note'], errorBox: refs['override-note-error'],
      list: refs['override-note-list'], empty: refs['override-note-empty'], heading: refs['override-list-heading'],
      layer: selectedRoom,
    });
  });
  attempt('Room choice', () => {
    refs['override-room'].addEventListener('change', guarded('Room choice', () => {
      clearFieldError(refs['override-note-text'], refs['override-note-error']);
      renderAll();
    }));
  });
  attempt('Remove override button', () => {
    refs['remove-override'].addEventListener('click', guarded('Remove override button', removeOverride));
  });

  // The choices and lists are redrawn whenever one of these screens is shown, so they always match
  // the rooms entered in setup (and are empty again after "Start again").
  const refresh = () => { attempt('Room choices', fillRoomChoices); renderAll(); };
  attempt('Overall inspiration screen', () => onShow('inspiration', refresh));
  attempt('Room overrides screen', () => onShow('overrides', refresh));
  attempt('First drawing of the inspiration screens', refresh);
}
