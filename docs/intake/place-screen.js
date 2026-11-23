// The "Place furniture, doors and windows" screen: choose a room, add an object, select an object to
// change it (number boxes, nudge buttons, turn, wall, Locked or Unsure), see the text list and remove.
//
// This file imports nothing. screens.js loads state.js, limits.js and place-geometry.js (with the page's
// cache tag) and hands them in, like items-screen.js. The object list is the real, accessible version
// of the room; the plan (place-plan.js) is an extra way to look at it and to move an object.
// Everything the visitor typed is put on the page with textContent or as the value of a box, never as
// page code. Nothing is stored or sent. Every part is set up in its own protected step
// (attempt and guarded come from screens.js), so a broken part never stops the other screens.

export function setUpPlaceScreen(tools) {
  const { el, attempt, guarded, announce, getState, api, onShow, onReset, geometry, plan, placeTypes, placeWalls } = tools;

  const ui = {
    room: '',       // the chosen room id
    selected: null, // the selected object's id
    focusKey: null, // the control to give the keyboard focus after a redraw
  };
  const keyed = new Map();          // focus key -> control, rebuilt on every list redraw
  const describedBase = new Map();  // control -> its fixed aria-describedby text

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const refs = {};
  for (const id of ['place-no-rooms', 'place-room-panel', 'place-room', 'place-room-size',
    'place-form-panel', 'place-type', 'place-type-error', 'place-name', 'place-name-error',
    'place-status-group', 'place-status-locked', 'place-status-unsure', 'place-status-error',
    'place-x', 'place-x-error', 'place-y', 'place-y-error', 'place-width', 'place-width-error',
    'place-depth', 'place-depth-error', 'add-placed', 'add-placed-error',
    'place-selected-panel', 'place-selected-heading', 'place-selected-name',
    'sel-name', 'sel-name-error', 'sel-x', 'sel-x-error', 'sel-y', 'sel-y-error',
    'sel-width', 'sel-width-error', 'sel-depth', 'sel-depth-error', 'sel-save', 'sel-status', 'sel-save-error',
    'nudge-left', 'nudge-right', 'nudge-up', 'nudge-down', 'sel-turn', 'sel-move-error',
    'sel-wall-group', 'sel-wall', 'sel-wall-error',
    'place-plan-panel', 'place-plan', 'place-plan-message',
    'place-list-panel', 'place-list-heading', 'place-empty', 'place-list',
    'place-others-panel', 'place-others']) {
    refs[id] = el(id);
  }
  const STATUS_RADIOS = [refs['place-status-locked'], refs['place-status-unsure']];
  const MOVE_BUTTONS = [refs['nudge-left'], refs['nudge-right'], refs['nudge-up'], refs['nudge-down'], refs['sel-turn']];

  // ---- Messages next to boxes ---------------------------------------------------------------

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

  // The "Add an object" boxes and the "Selected object" boxes, each with the box its message goes into.
  const ADD = {
    type: [refs['place-type'], refs['place-type-error']],
    name: [refs['place-name'], refs['place-name-error']],
    status: [refs['place-status-group'], refs['place-status-error']],
    x: [refs['place-x'], refs['place-x-error']],
    y: [refs['place-y'], refs['place-y-error']],
    width: [refs['place-width'], refs['place-width-error']],
    depth: [refs['place-depth'], refs['place-depth-error']],
    general: [refs['add-placed'], refs['add-placed-error']],
  };
  const SEL = {
    name: [refs['sel-name'], refs['sel-name-error']],
    x: [refs['sel-x'], refs['sel-x-error']],
    y: [refs['sel-y'], refs['sel-y-error']],
    width: [refs['sel-width'], refs['sel-width-error']],
    depth: [refs['sel-depth'], refs['sel-depth-error']],
    general: [refs['sel-save'], refs['sel-save-error']],
  };
  const clearAdd = () => { for (const [input, box] of Object.values(ADD)) clearFieldError(input, box); };
  const clearSelected = () => {
    for (const [input, box] of Object.values(SEL)) clearFieldError(input, box);
    for (const b of MOVE_BUTTONS) clearFieldError(b, refs['sel-move-error']);
    clearFieldError(refs['sel-wall'], refs['sel-wall-error']);
  };

  // Which box a sentence from state.js belongs to, so it is shown next to that box.
  function fieldOfMessage(message) {
    if (/^Choose a type/.test(message)) return 'type';
    if (/^Give this object a name|^Keep the object name/.test(message)) return 'name';
    if (/^Choose Locked or Unsure/.test(message)) return 'status';
    if (/^Width /.test(message)) return 'width';
    if (/^Depth /.test(message)) return 'depth';
    if (/^Left /.test(message)) return 'x';
    if (/^Top /.test(message)) return 'y';
    return 'general'; // for example "You can place at most 30 objects in one room."
  }

  // ---- Small helpers --------------------------------------------------------------------------

  const typeLabel = (key) => key.charAt(0).toUpperCase() + key.slice(1);
  const findObject = (id) => getState().placed.find((o) => o.id === id);
  const selectedObject = () => {
    const object = ui.selected ? findObject(ui.selected) : null;
    return object && object.room === ui.room ? object : null;
  };
  const currentRoom = () => (ui.room ? api.findRoom(getState(), ui.room) : undefined);
  const countText = (n) => `${n} ${n === 1 ? 'object' : 'objects'}`;
  const stickOut = (object) => {
    const room = currentRoom();
    return room && !geometry.isInsideRoom(object, room) ? ' It sticks out of the room.' : '';
  };
  const chosenStatus = () => {
    const radio = STATUS_RADIOS.find((r) => r.checked);
    return radio ? radio.value : '';
  };

  function fillRoomChoice() {
    const rooms = api.allRooms(getState());
    refs['place-room'].replaceChildren(...[{ id: '', name: 'Choose a room' }, ...rooms].map((room) => {
      const option = make('option', '', room.name);
      option.value = room.id;
      return option;
    }));
    if (!rooms.some((r) => r.id === ui.room)) ui.room = '';
    refs['place-room'].value = ui.room;
  }

  function fillTypeChoice() {
    refs['place-type'].replaceChildren(...[['', 'Choose a type'], ...Object.keys(placeTypes).map((k) => [k, typeLabel(k)])].map(([value, text]) => {
      const option = make('option', '', text);
      option.value = value;
      return option;
    }));
    refs['place-type'].value = '';
  }

  function fillWallChoice() {
    refs['sel-wall'].replaceChildren(...[['', 'Choose a wall'], ...placeWalls.map((w) => [w, w])].map(([value, text]) => {
      const option = make('option', '', text);
      option.value = value;
      return option;
    }));
    refs['sel-wall'].value = '';
  }

  // ---- Choosing a room and a type -----------------------------------------------------------

  function chooseRoom() {
    ui.room = refs['place-room'].value;
    ui.selected = null;
    clearAdd();
    clearSelected();
    render();
    const room = currentRoom();
    if (room) announce(`${room.name} chosen. ${countText(api.placedInRoom(getState(), room.id).length)} placed in this room.`);
  }

  // Choosing a type fills in the start name and size. The visitor can overwrite them.
  function chooseType() {
    const key = refs['place-type'].value;
    if (!Object.hasOwn(placeTypes, key)) return;
    const start = placeTypes[key];
    refs['place-name'].value = start.name;
    refs['place-width'].value = String(start.width);
    refs['place-depth'].value = String(start.depth);
    if (refs['place-x'].value.trim() === '') refs['place-x'].value = '0';
    if (refs['place-y'].value.trim() === '') refs['place-y'].value = '0';
  }

  // ---- Adding ---------------------------------------------------------------------------------

  function addObject() {
    const state = getState();
    clearAdd();
    const result = api.addPlaced(state, {
      type: refs['place-type'].value,
      name: refs['place-name'].value,
      status: chosenStatus(),
      room: ui.room,
      x: refs['place-x'].value,
      y: refs['place-y'].value,
      width: refs['place-width'].value,
      depth: refs['place-depth'].value,
    });
    if (!result.ok) {
      const [input, box] = ADD[fieldOfMessage(result.message)];
      showFieldError(input, box, result.message);
      if (input === refs['place-status-group']) STATUS_RADIOS[0].focus(); else input.focus();
      return;
    }
    const added = findObject(result.id);
    ui.selected = added.id;
    refs['place-type'].value = '';
    for (const key of ['place-name', 'place-x', 'place-y', 'place-width', 'place-depth']) refs[key].value = '';
    for (const radio of STATUS_RADIOS) radio.checked = false; // the next object must be chosen again
    render();
    announce(`Added ${added.name}, ${added.status}. It is selected. You now have ${countText(api.placedInRoom(state, ui.room).length)} in this room.${stickOut(added)}`);
    refs['place-type'].focus();
  }

  // ---- Changing the selected object -----------------------------------------------------------

  function select(id, focusKey) {
    ui.selected = id;
    ui.focusKey = focusKey;
    clearSelected();
    render();
    const object = selectedObject();
    if (object) announce(`${object.name} selected.`);
  }

  // Runs one change on the selected object. A refused change keeps the old values and shows its
  // sentence next to the control that was used. The focus stays on that control.
  function change(control, run, sayDone) {
    const object = selectedObject();
    if (!object) {
      showFieldError(control, refs['sel-move-error'], 'Select an object first.');
      return;
    }
    clearSelected();
    const result = run(object);
    if (!result.ok) {
      showFieldError(control, refs['sel-move-error'], result.message);
      render({ keepBoxes: true });
      announce(result.message);
      control.focus();
      return;
    }
    render();
    announce(sayDone(object));
    control.focus();
  }

  const DIRECTION_WORDS = { left: 'to the left', right: 'to the right', up: 'up', down: 'down' };
  function nudge(control, direction) {
    change(control, (o) => api.nudgePlaced(getState(), o.id, direction),
      (o) => `${o.name} moved 10 cm ${DIRECTION_WORDS[direction]}.${stickOut(o)}`);
  }

  function turn() {
    change(refs['sel-turn'], (o) => api.turnPlaced(getState(), o.id),
      (o) => `${o.name} turned a quarter turn. It is now turned ${o.turn} degrees, ${o.width} cm wide and ${o.depth} cm deep.${stickOut(o)}`);
  }

  function chooseWall() {
    const wall = refs['sel-wall'].value;
    if (!wall) return;
    change(refs['sel-wall'], (o) => api.setPlacedWall(getState(), o.id, wall),
      (o) => `${o.name} is now against the ${wall} wall.${stickOut(o)}`);
    refs['sel-wall'].value = '';
  }

  function changeStatus() {
    change(refs['sel-status'], (o) => api.setPlacedStatus(getState(), o.id, o.status === 'Locked' ? 'Unsure' : 'Locked'),
      (o) => `${o.name} is now ${o.status}.`);
  }

  function saveChanges() {
    const object = selectedObject();
    if (!object) {
      showFieldError(refs['sel-save'], refs['sel-save-error'], 'Select an object first.');
      return;
    }
    clearSelected();
    const result = api.editPlaced(getState(), object.id, {
      name: refs['sel-name'].value,
      x: refs['sel-x'].value,
      y: refs['sel-y'].value,
      width: refs['sel-width'].value,
      depth: refs['sel-depth'].value,
    });
    if (!result.ok) {
      const [input, box] = SEL[fieldOfMessage(result.message)];
      showFieldError(input, box, result.message);
      render({ keepBoxes: true });
      announce(result.message);
      input.focus();
      return;
    }
    render();
    announce(`${object.name} changed.${stickOut(object)}`);
    refs['sel-save'].focus();
  }

  function removeObject(id) {
    const object = findObject(id);
    if (!object) return;
    const result = api.removePlaced(getState(), id);
    if (ui.selected === id) ui.selected = null;
    ui.focusKey = 'list-heading';
    render();
    announce(result.ok
      ? `${object.name} removed. ${countText(api.placedInRoom(getState(), ui.room).length)} left in this room.`
      : result.message);
  }

  // ---- Drawing --------------------------------------------------------------------------------

  function button(text, key, handler) {
    const b = make('button', 'action-button', text);
    b.setAttribute('type', 'button');
    b.addEventListener('click', guarded(`Button "${text}"`, handler));
    if (key) keyed.set(key, b);
    return b;
  }

  function objectEntry(object) {
    const li = make('li', 'entry placed-entry');
    const room = currentRoom();
    const picked = object.id === ui.selected;
    li.append(make('span', 'placed-text', `${picked ? 'Selected. ' : ''}${geometry.describePlaced(object, room)}`));
    const actions = make('span', 'entry-actions');
    actions.append(
      button(`Select ${object.name}`, `select-${object.id}`, () => select(object.id, `select-${object.id}`)),
      button(`Edit ${object.name}`, `edit-${object.id}`, () => {
        select(object.id, 'edit-box');
        announce(`Editing ${object.name}. Change the boxes, then press Save changes.`);
      }),
      button(`Remove ${object.name}`, `remove-${object.id}`, () => removeObject(object.id)),
    );
    li.append(actions);
    return li;
  }

  function renderSelectedPanel(keepBoxes) {
    const object = selectedObject();
    refs['place-selected-panel'].hidden = !object;
    if (!object) return;
    refs['place-selected-name'].textContent = `Selected: ${geometry.describePlaced(object, currentRoom())}`;
    if (!keepBoxes) {
      refs['sel-name'].value = object.name;
      refs['sel-x'].value = String(object.x);
      refs['sel-y'].value = String(object.y);
      refs['sel-width'].value = String(object.width);
      refs['sel-depth'].value = String(object.depth);
    }
    refs['sel-status'].textContent = `Change ${object.name} to ${object.status === 'Locked' ? 'Unsure' : 'Locked'}`;
    refs['sel-wall-group'].hidden = !(object.kind === 'door' || object.kind === 'window');
  }

  // ---- The plan ---------------------------------------------------------------------------------

  // Said next to the plan and announced. The plan itself is not a tab stop, so the message is linked
  // to the drawing with aria-describedby for screen readers that read it.
  function planMessage(svg, text) {
    refs['place-plan-message'].textContent = text;
    refs['place-plan-message'].hidden = false;
    if (svg) svg.setAttribute('aria-describedby', 'place-plan-message');
    announce(text);
  }

  // A click or tap on the plan puts the selected object's top-left corner there (rounded to 10 cm).
  // It uses the same "move to" function as the number boxes.
  function pickOnPlan(svg, event) {
    const object = selectedObject();
    if (!object) {
      planMessage(svg, 'Select an object first.');
      return;
    }
    const position = geometry.clickToPosition(
      { clientX: event.clientX, clientY: event.clientY }, svg.getBoundingClientRect(), geometry.planViewBox(currentRoom()),
    );
    if (!position) return;
    const result = api.movePlacedTo(getState(), object.id, position.x, position.y);
    if (!result.ok) {
      planMessage(svg, result.message);
      return;
    }
    render();
    announce(`${object.name} moved to ${position.x} cm from the left and ${position.y} cm from the top.${stickOut(object)}`);
  }

  // The plan is built again from the state every time. It keeps nothing of its own.
  function renderPlan(room, inRoom) {
    refs['place-plan-panel'].hidden = !room;
    refs['place-plan-message'].textContent = '';
    refs['place-plan-message'].hidden = true;
    if (!room) { refs['place-plan'].replaceChildren(); return; }
    const svg = plan.drawPlan(geometry, { room, objects: inRoom, selectedId: ui.selected });
    svg.addEventListener('click', guarded('Click on the plan', (event) => pickOnPlan(svg, event)));
    refs['place-plan'].replaceChildren(svg);
  }

  function render({ keepBoxes = false } = {}) {
    const state = getState();
    keyed.clear();
    const rooms = api.allRooms(state);
    refs['place-no-rooms'].hidden = rooms.length > 0;
    refs['place-room-panel'].hidden = rooms.length === 0;
    fillRoomChoice();
    const room = currentRoom();
    refs['place-room-size'].textContent = room
      ? `Room size: ${Number(room.width).toFixed(1)} m by ${Number(room.depth).toFixed(1)} m (as entered in setup).`
      : 'Choose a room to start.';
    refs['place-form-panel'].hidden = !room;
    refs['place-list-panel'].hidden = !room;
    const inRoom = room ? api.placedInRoom(state, room.id) : [];
    refs['place-list'].replaceChildren(...inRoom.map(objectEntry));
    refs['place-empty'].hidden = inRoom.length > 0;
    renderSelectedPanel(keepBoxes);
    attempt('Drawing the plan', () => renderPlan(room, inRoom));
    const others = rooms.filter((r) => r.id !== ui.room);
    refs['place-others-panel'].hidden = !room || others.length === 0;
    refs['place-others'].replaceChildren(...others.map((r) => make('li', 'entry', `${r.name}: ${countText(api.placedInRoom(state, r.id).length)} placed`)));
    const target = ui.focusKey === 'list-heading' ? refs['place-list-heading']
      : ui.focusKey === 'edit-box' ? refs['sel-name'] : keyed.get(ui.focusKey);
    ui.focusKey = null;
    if (target) target.focus();
  }

  // ---- Wiring ---------------------------------------------------------------------------------

  const onEnter = (step, handler) => guarded(step, (event) => {
    if (event.key === 'Enter') { event.preventDefault(); handler(); }
  });

  attempt('Place screen: lists of types and walls', () => { fillTypeChoice(); fillWallChoice(); });
  attempt('Place screen: choosing a room', () => refs['place-room'].addEventListener('change', guarded('Place room list', chooseRoom)));
  attempt('Place screen: choosing a type', () => refs['place-type'].addEventListener('change', guarded('Place type list', chooseType)));
  attempt('Place screen: add object', () => {
    refs['add-placed'].addEventListener('click', guarded('Add object button', addObject));
    for (const key of ['place-name', 'place-x', 'place-y', 'place-width', 'place-depth']) {
      refs[key].addEventListener('keydown', onEnter('Add object box', addObject));
    }
  });
  attempt('Place screen: save changes', () => {
    refs['sel-save'].addEventListener('click', guarded('Save changes button', saveChanges));
    for (const key of ['sel-name', 'sel-x', 'sel-y', 'sel-width', 'sel-depth']) {
      refs[key].addEventListener('keydown', onEnter('Selected object box', saveChanges));
    }
  });
  attempt('Place screen: nudge buttons', () => {
    refs['nudge-left'].addEventListener('click', guarded('Nudge left button', () => nudge(refs['nudge-left'], 'left')));
    refs['nudge-right'].addEventListener('click', guarded('Nudge right button', () => nudge(refs['nudge-right'], 'right')));
    refs['nudge-up'].addEventListener('click', guarded('Nudge up button', () => nudge(refs['nudge-up'], 'up')));
    refs['nudge-down'].addEventListener('click', guarded('Nudge down button', () => nudge(refs['nudge-down'], 'down')));
  });
  attempt('Place screen: turn button', () => refs['sel-turn'].addEventListener('click', guarded('Turn button', turn)));
  attempt('Place screen: wall list', () => refs['sel-wall'].addEventListener('change', guarded('Wall list', chooseWall)));
  attempt('Place screen: status button', () => refs['sel-status'].addEventListener('click', guarded('Change status button', changeStatus)));
  attempt('Place screen: first drawing', render);
  // Redrawn each time the screen is shown, so the rooms match the setup and removed rooms' objects are gone.
  attempt('Place screen: redraw when shown', () => onShow('place', () => render()));
  attempt('Place screen: clearing on Start again', () => {
    if (!onReset) return;
    onReset(() => {
      ui.room = '';
      ui.selected = null;
      ui.focusKey = null;
      refs['place-type'].value = '';
      for (const key of ['place-name', 'place-x', 'place-y', 'place-width', 'place-depth']) refs[key].value = '';
      for (const radio of STATUS_RADIOS) radio.checked = false;
      clearAdd();
      clearSelected();
      render();
    });
  });

  return { ui, render, selectedObject, currentRoom, select };
}
