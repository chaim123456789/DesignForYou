// The project setup screen: the project name, the floor and room form, and the list of floors and
// rooms with rename and remove (a floor asks for confirmation first).
//
// This file imports nothing. screens.js loads state.js and limits.js (with the page's cache tag) and
// hands them in, so an old cached copy of one file can never be mixed with a new copy of another.
// It never stores or sends anything. Everything the visitor typed is put on the page with textContent.
//
// Every part is set up in its own protected step, using the attempt and guarded helpers from screens.js.
// A failing part shows the red message at the top of the page and never stops the others.

export function setUpSetupScreen(tools) {
  const { el, attempt, guarded, announce, getState, api, limits, releaseImages, onReset } = tools;

  // What the screen itself remembers (not the visitor's project, which is in the state).
  const ui = {
    renaming: null,    // { kind: 'floor' | 'room', id } while a name is being changed
    confirming: null,  // a floor id while the page asks "remove this floor?"
    confirmingRoom: null, // a room id while the page asks "remove this room and its items?"
    floorChoice: '',   // the floor chosen for the next room
    focusKey: null,    // the control to give the keyboard focus after the list is redrawn
  };
  const keyed = new Map(); // focus key -> control, rebuilt on every redraw
  const describedBase = new Map(); // control -> its fixed aria-describedby text

  const refs = {};
  for (const id of ['project-name', 'project-name-error', 'floor-name', 'floor-name-error', 'add-floor',
    'room-floor', 'room-floor-error', 'room-name', 'room-name-error', 'room-width', 'room-width-error',
    'room-depth', 'room-depth-error', 'add-room', 'floor-list', 'list-empty', 'list-heading', 'setup-needs']) {
    refs[id] = el(id);
  }

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // ---- Messages next to fields -------------------------------------------------------------

  // Show a plain message next to a field, and tie it to the field with aria-describedby.
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

  // ---- Project name ------------------------------------------------------------------------

  // The project always matches the box: a name that fails the checks leaves the project with no name.
  function commitName(showMessage) {
    const state = getState();
    const result = api.setProjectName(state, refs['project-name'].value);
    if (result.ok) {
      clearFieldError(refs['project-name'], refs['project-name-error']);
    } else {
      state.name = '';
      if (showMessage) showFieldError(refs['project-name'], refs['project-name-error'], result.message);
    }
    updateNeeds();
  }

  function updateNeeds() {
    const state = getState();
    const missing = [];
    if (state.name === '') missing.push('a project name');
    if (state.floors.length === 0) missing.push('a floor');
    if (!state.floors.some((f) => f.rooms.length > 0)) missing.push('a room');
    refs['setup-needs'].textContent = missing.length === 0
      ? 'Your project has a name, a floor and a room. You can go on to the next step.'
      : `Still needed before you can run the design team: ${missing.join(', ')}.`;
  }

  // ---- Adding a floor and a room -----------------------------------------------------------

  function addFloor() {
    const state = getState();
    const result = api.addFloor(state, refs['floor-name'].value);
    if (!result.ok) {
      showFieldError(refs['floor-name'], refs['floor-name-error'], result.message);
      refs['floor-name'].focus();
      return;
    }
    clearFieldError(refs['floor-name'], refs['floor-name-error']);
    const floor = state.floors.find((f) => f.id === result.id);
    refs['floor-name'].value = '';
    ui.floorChoice = floor.id;
    render();
    announce(`Floor added: ${floor.name}. You now have ${state.floors.length} of ${limits.floorsMax} floors.`);
    refs['floor-name'].focus();
  }

  const ROOM_FIELDS = [
    ['room-floor', 'room-floor-error'], ['room-name', 'room-name-error'],
    ['room-width', 'room-width-error'], ['room-depth', 'room-depth-error'],
  ];

  // The state gives one plain message. This picks the field it belongs to.
  function roomErrorField(message) {
    if (/^Width/.test(message)) return 'room-width';
    if (/^Depth/.test(message)) return 'room-depth';
    if (/floor/i.test(message)) return 'room-floor';
    return 'room-name';
  }

  function addRoom() {
    const state = getState();
    const result = api.addRoom(state, refs['room-floor'].value, refs['room-name'].value, refs['room-width'].value, refs['room-depth'].value);
    for (const [input, error] of ROOM_FIELDS) clearFieldError(refs[input], refs[error]);
    if (!result.ok) {
      const field = roomErrorField(result.message);
      showFieldError(refs[field], refs[`${field}-error`], result.message);
      refs[field].focus();
      return;
    }
    const room = state.floors.flatMap((f) => f.rooms).find((r) => r.id === result.id);
    const floor = state.floors.find((f) => f.rooms.includes(room));
    refs['room-name'].value = '';
    refs['room-width'].value = String(limits.roomSizeDefault);
    refs['room-depth'].value = String(limits.roomSizeDefault);
    render();
    announce(`Room added: ${room.name}, on ${floor.name}. You now have ${state.floors.reduce((n, f) => n + f.rooms.length, 0)} of ${limits.roomsMax} rooms.`);
    refs['room-name'].focus();
  }

  // ---- Rename and remove -------------------------------------------------------------------

  const entryKey = (kind, id) => `${kind}-${id}`;

  function startRename(kind, id) {
    ui.renaming = { kind, id };
    ui.confirming = null;
    ui.confirmingRoom = null;
    ui.focusKey = `rename-input-${entryKey(kind, id)}`;
    render();
  }

  function cancelRename(kind, id) {
    ui.renaming = null;
    ui.focusKey = `rename-${entryKey(kind, id)}`;
    render();
  }

  function saveRename(kind, id, input, errorBox) {
    const state = getState();
    const result = kind === 'floor' ? api.renameFloor(state, id, input.value) : api.renameRoom(state, id, input.value);
    if (!result.ok) {
      showFieldError(input, errorBox, result.message);
      input.focus();
      return;
    }
    ui.renaming = null;
    ui.focusKey = `rename-${entryKey(kind, id)}`;
    render();
    announce(`${kind === 'floor' ? 'Floor' : 'Room'} renamed to ${input.value.trim()}.`);
  }

  // How many of the visitor's items sit in these rooms. They are removed together with the rooms.
  const itemsInRooms = (rooms) => getState().items.filter((i) => rooms.some((r) => r.id === i.room)).length;
  const itemWords = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;

  function askRemoveFloor(floorId) {
    ui.confirming = floorId;
    ui.confirmingRoom = null;
    ui.renaming = null;
    ui.focusKey = `keep-${entryKey('floor', floorId)}`;
    render();
  }

  function cancelRemoveFloor(floorId) {
    ui.confirming = null;
    ui.focusKey = `remove-${entryKey('floor', floorId)}`;
    render();
    announce('The floor was kept.');
  }

  function removeFloor(floorId) {
    const state = getState();
    const floor = state.floors.find((f) => f.id === floorId);
    if (!floor) return;
    const roomCount = floor.rooms.length;
    const itemCount = itemsInRooms(floor.rooms);
    const result = api.removeFloor(state, floorId);
    if (result.ok && releaseImages) releaseImages(result.removedImages); // free the previews of the floor's rooms
    ui.confirming = null;
    ui.focusKey = 'list-heading';
    render();
    announce(result.ok
      ? `Floor removed: ${floor.name}, with ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}${itemCount > 0 ? ` and ${itemWords(itemCount)}` : ''}.`
      : result.message);
  }

  // A room with items asks first, and says how many items go with it. A room without items is removed at once.
  function removeRoom(roomId) {
    const state = getState();
    const room = state.floors.flatMap((f) => f.rooms).find((r) => r.id === roomId);
    if (!room) return;
    const itemCount = itemsInRooms([room]);
    if (itemCount > 0 && ui.confirmingRoom !== roomId) {
      ui.confirmingRoom = roomId;
      ui.confirming = null;
      ui.renaming = null;
      ui.focusKey = `keep-${entryKey('room', roomId)}`;
      render();
      return;
    }
    const result = api.removeRoom(state, roomId);
    if (result.ok && releaseImages) releaseImages(result.removedImages); // free the previews of the room's override
    ui.confirmingRoom = null;
    ui.focusKey = 'list-heading';
    render();
    announce(result.ok ? `Room removed: ${room.name}${itemCount > 0 ? `, with ${itemWords(itemCount)}` : ''}.` : result.message);
  }

  function cancelRemoveRoom(roomId) {
    ui.confirmingRoom = null;
    ui.focusKey = `remove-${entryKey('room', roomId)}`;
    render();
    announce('The room was kept.');
  }

  // ---- Drawing the lists -------------------------------------------------------------------

  function button(text, key, handler) {
    const b = make('button', 'action-button', text);
    b.setAttribute('type', 'button');
    b.addEventListener('click', guarded(`Button "${text}"`, handler));
    if (key) keyed.set(key, b);
    return b;
  }

  // The row shown while a name is being changed: a labelled box, Save name and Cancel.
  function renameRow(kind, id, currentName) {
    const row = make('div', 'rename-row');
    const inputId = `rename-input-${entryKey(kind, id)}`;
    const errorId = `rename-error-${entryKey(kind, id)}`;
    const label = make('label', '', `New name for ${kind} ${currentName}`);
    label.setAttribute('for', inputId);
    const input = make('input', 'text-input');
    input.id = inputId;
    input.setAttribute('type', 'text');
    input.setAttribute('autocomplete', 'off');
    input.value = currentName;
    const errorBox = make('p', 'field-error');
    errorBox.id = errorId;
    errorBox.hidden = true;
    const save = () => saveRename(kind, id, input, errorBox);
    input.addEventListener('keydown', guarded('Renaming a name with the keyboard', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); save(); }
      if (event.key === 'Escape') { event.preventDefault(); cancelRename(kind, id); }
    }));
    keyed.set(inputId, input);
    row.append(label, input, button('Save name', null, save), button('Cancel', null, () => cancelRename(kind, id)), errorBox);
    return row;
  }

  function floorConfirmRow(floor) {
    const row = make('div', 'confirm-row');
    const count = floor.rooms.length;
    const itemCount = itemsInRooms(floor.rooms);
    const itemPart = itemCount > 0 ? ` and ${itemWords(itemCount)}` : '';
    const question = make('p', '', `Remove the floor ${floor.name} and its ${count} ${count === 1 ? 'room' : 'rooms'}${itemPart}? This cannot be undone.`);
    question.id = `confirm-text-${floor.id}`;
    const keep = button('No, keep the floor', `keep-${entryKey('floor', floor.id)}`, () => cancelRemoveFloor(floor.id));
    keep.setAttribute('aria-describedby', question.id);
    row.append(question, button(`Yes, remove floor ${floor.name}`, null, () => removeFloor(floor.id)), keep);
    return row;
  }

  function roomConfirmRow(room) {
    const row = make('div', 'confirm-row');
    const count = itemsInRooms([room]);
    const question = make('p', '', `Remove the room ${room.name}? Its ${itemWords(count)} will be removed too. This cannot be undone.`);
    question.id = `confirm-text-${room.id}`;
    const keep = button('No, keep the room', `keep-${entryKey('room', room.id)}`, () => cancelRemoveRoom(room.id));
    keep.setAttribute('aria-describedby', question.id);
    row.append(question, button(`Yes, remove room ${room.name}`, null, () => removeRoom(room.id)), keep);
    return row;
  }

  function entryRow(kind, entry, detail, onRemove) {
    const row = make('div', 'entry-row');
    row.append(make('span', 'entry-name', entry.name), make('span', 'entry-detail', detail));
    const actions = make('span', 'entry-actions');
    actions.append(
      button(`Rename ${kind} ${entry.name}`, `rename-${entryKey(kind, entry.id)}`, () => startRename(kind, entry.id)),
      button(`Remove ${kind} ${entry.name}`, `remove-${entryKey(kind, entry.id)}`, onRemove),
    );
    row.append(actions);
    return row;
  }

  function roomItem(room) {
    const li = make('li', 'entry room-entry');
    if (ui.confirmingRoom === room.id) {
      li.append(roomConfirmRow(room));
    } else if (ui.renaming && ui.renaming.kind === 'room' && ui.renaming.id === room.id) {
      li.append(renameRow('room', room.id, room.name));
    } else {
      li.append(entryRow('room', room, `${room.width} m wide, ${room.depth} m deep`, () => removeRoom(room.id)));
    }
    return li;
  }

  function floorItem(floor) {
    const li = make('li', 'entry floor-entry');
    const count = floor.rooms.length;
    if (ui.confirming === floor.id) {
      li.append(floorConfirmRow(floor));
    } else if (ui.renaming && ui.renaming.kind === 'floor' && ui.renaming.id === floor.id) {
      li.append(renameRow('floor', floor.id, floor.name));
    } else {
      li.append(entryRow('floor', floor, `${count} ${count === 1 ? 'room' : 'rooms'}`, () => askRemoveFloor(floor.id)));
    }
    if (count > 0) {
      const rooms = make('ul', 'entry-list room-list');
      rooms.append(...floor.rooms.map(roomItem));
      li.append(rooms);
    }
    return li;
  }

  function fillFloorChoice(state) {
    const select = refs['room-floor'];
    const options = state.floors.length === 0
      ? [{ id: '', name: 'No floors yet' }]
      : state.floors;
    if (!state.floors.some((f) => f.id === ui.floorChoice)) ui.floorChoice = state.floors.length ? state.floors[0].id : '';
    select.replaceChildren(...options.map((f) => {
      const option = make('option', '', f.name);
      option.value = f.id;
      return option;
    }));
    select.value = ui.floorChoice; // after the options exist
  }

  function render() {
    const state = getState();
    keyed.clear();
    refs['floor-list'].replaceChildren(...state.floors.map(floorItem));
    refs['list-empty'].hidden = state.floors.length > 0;
    fillFloorChoice(state);
    updateNeeds();
    const target = ui.focusKey === 'list-heading' ? refs['list-heading'] : keyed.get(ui.focusKey);
    ui.focusKey = null;
    if (target) target.focus();
  }

  // ---- Wiring ------------------------------------------------------------------------------

  const onEnter = (step, handler) => guarded(step, (event) => {
    if (event.key === 'Enter') { event.preventDefault(); handler(); }
  });

  attempt('Project name box', () => {
    refs['project-name'].addEventListener('input', guarded('Project name box', () => commitName(false)));
    refs['project-name'].addEventListener('change', guarded('Project name box', () => commitName(true)));
    refs['project-name'].addEventListener('keydown', onEnter('Project name box', () => commitName(true)));
  });
  attempt('Add floor', () => {
    refs['add-floor'].addEventListener('click', guarded('Add floor button', addFloor));
    refs['floor-name'].addEventListener('keydown', onEnter('Floor name box', addFloor));
  });
  attempt('Add room', () => {
    refs['add-room'].addEventListener('click', guarded('Add room button', addRoom));
    for (const id of ['room-name', 'room-width', 'room-depth']) {
      refs[id].addEventListener('keydown', onEnter('Room form', addRoom));
    }
    refs['room-floor'].addEventListener('change', guarded('Floor choice for the room', () => { ui.floorChoice = refs['room-floor'].value; }));
  });
  attempt('List of floors and rooms', render);

  // "Start again" gives the screen a new, empty project: the boxes and messages are cleared too.
  attempt('Clearing the setup screen on Start again', () => {
    if (!onReset) return;
    onReset(() => {
      ui.renaming = null;
      ui.confirming = null;
      ui.confirmingRoom = null;
      ui.floorChoice = '';
      ui.focusKey = null;
      refs['project-name'].value = '';
      refs['floor-name'].value = '';
      refs['room-name'].value = '';
      refs['room-width'].value = String(limits.roomSizeDefault);
      refs['room-depth'].value = String(limits.roomSizeDefault);
      clearFieldError(refs['project-name'], refs['project-name-error']);
      clearFieldError(refs['floor-name'], refs['floor-name-error']);
      for (const [input, error] of ROOM_FIELDS) clearFieldError(refs[input], refs[error]);
      render();
    });
  });
}
