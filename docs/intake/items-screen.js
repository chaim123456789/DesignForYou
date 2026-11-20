// The items screen: a form to add an item (description, room, Locked or Unsure, optional tag), and a
// list where each item can be edited, changed between Locked and Unsure, or removed.
//
// This file imports nothing. screens.js loads state.js and limits.js (with the page's cache tag) and
// hands them in. Every item is a style item. The status has no default: the visitor must choose.
// The rooms in the list always come from the setup screen. Everything the visitor typed is put on
// the page with textContent or as the value of a box, never as page code. Nothing is stored or sent.
//
// Every part is set up in its own protected step (attempt and guarded come from screens.js).

export function setUpItemsScreen(tools) {
  const { el, attempt, guarded, announce, getState, api, limits, onShow, onReset } = tools;

  const ui = {
    editing: null,  // an item id while its edit form is open
    focusKey: null, // the control to give the keyboard focus after the list is redrawn
  };
  const keyed = new Map(); // focus key -> control, rebuilt on every redraw
  const describedBase = new Map(); // control -> its fixed aria-describedby text

  const refs = {};
  for (const id of ['item-text', 'item-text-error', 'item-room', 'item-room-error', 'item-status-group',
    'item-status-locked', 'item-status-unsure', 'item-status-error', 'item-tag', 'item-tag-error',
    'add-item', 'add-item-error', 'item-list', 'items-empty', 'item-list-heading', 'items-no-rooms', 'items-none']) {
    refs[id] = el(id);
  }
  const STATUS_RADIOS = [refs['item-status-locked'], refs['item-status-unsure']];

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // ---- Messages next to fields -------------------------------------------------------------

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

  // The form fields, each with the box its message goes into.
  const FIELDS = {
    text: [refs['item-text'], refs['item-text-error']],
    room: [refs['item-room'], refs['item-room-error']],
    status: [refs['item-status-group'], refs['item-status-error']],
    tag: [refs['item-tag'], refs['item-tag-error']],
    add: [refs['add-item'], refs['add-item-error']],
  };
  function clearAllErrors() {
    for (const [input, box] of Object.values(FIELDS)) clearFieldError(input, box);
  }

  // Which field a message from state.js belongs to, so it is shown next to that field.
  function fieldOfMessage(message) {
    if (/^Describe the item|^Keep the item description/.test(message)) return 'text';
    if (/^Choose a room/.test(message)) return 'room';
    if (/^Choose Locked or Unsure/.test(message)) return 'status';
    if (/^Keep the material/.test(message)) return 'tag';
    return 'add'; // for example "You can add at most 100 items."
  }

  // ---- The form -----------------------------------------------------------------------------

  function chosenStatus() {
    const radio = STATUS_RADIOS.find((r) => r.checked);
    return radio ? radio.value : '';
  }

  function fillRoomChoice(select, chosen) {
    const rooms = api.allRooms(getState());
    select.replaceChildren(...[{ id: '', name: 'Choose a room' }, ...rooms].map((room) => {
      const option = make('option', '', room.name);
      option.value = room.id;
      return option;
    }));
    select.value = rooms.some((r) => r.id === chosen) ? chosen : '';
  }

  function addItem() {
    const state = getState();
    clearAllErrors();
    const result = api.addItem(state, {
      text: refs['item-text'].value,
      room: refs['item-room'].value,
      status: chosenStatus(),
      tag: refs['item-tag'].value,
    });
    if (!result.ok) {
      const [input, box] = FIELDS[fieldOfMessage(result.message)];
      showFieldError(input, box, result.message);
      if (input !== refs['item-status-group']) input.focus(); else STATUS_RADIOS[0].focus();
      return;
    }
    const added = state.items.find((i) => i.id === result.id);
    refs['item-text'].value = '';
    refs['item-tag'].value = '';
    for (const radio of STATUS_RADIOS) radio.checked = false; // the next item must be chosen again
    render();
    announce(`Item added: ${added.text}, ${added.status}. You now have ${state.items.length} of ${limits.itemsMax} items.`);
    refs['item-text'].focus();
  }

  // ---- Edit, change status, remove ----------------------------------------------------------

  const itemKey = (kind, id) => `${kind}-${id}`;
  const findItem = (id) => getState().items.find((i) => i.id === id);

  function startEdit(id) {
    ui.editing = id;
    ui.focusKey = `edit-text-${id}`;
    render();
  }

  function cancelEdit(id) {
    ui.editing = null;
    ui.focusKey = itemKey('edit', id);
    render();
  }

  function saveEdit(id, fields, errorBox) {
    const result = api.editItem(getState(), id, {
      text: fields.text.value,
      room: fields.room.value,
      tag: fields.tag.value,
    });
    if (!result.ok) {
      showFieldError(fields.text, errorBox, result.message);
      fields.text.focus();
      return;
    }
    ui.editing = null;
    ui.focusKey = itemKey('edit', id);
    render();
    announce(`Item changed: ${findItem(id).text}.`);
  }

  function changeStatus(id) {
    const item = findItem(id);
    if (!item) return;
    const next = item.status === 'Locked' ? 'Unsure' : 'Locked';
    const result = api.editItem(getState(), id, { status: next });
    ui.focusKey = itemKey('status', id);
    render();
    announce(result.ok ? `${item.text} is now ${next}.` : result.message);
  }

  function removeItem(id) {
    const item = findItem(id);
    if (!item) return;
    const result = api.removeItem(getState(), id);
    if (ui.editing === id) ui.editing = null;
    ui.focusKey = 'list-heading';
    render();
    announce(result.ok ? `Item removed: ${item.text}.` : result.message);
  }

  // ---- Drawing the list ---------------------------------------------------------------------

  function button(text, key, handler) {
    const b = make('button', 'action-button', text);
    b.setAttribute('type', 'button');
    b.addEventListener('click', guarded(`Button "${text}"`, handler));
    if (key) keyed.set(key, b);
    return b;
  }

  function roomName(roomId) {
    const room = api.findRoom(getState(), roomId);
    return room ? room.name : 'a room that was removed';
  }

  function editRow(item) {
    const form = make('div', 'edit-form');
    const field = (labelText, id, control) => {
      const label = make('label', '', labelText);
      label.setAttribute('for', id);
      control.id = id;
      form.append(label, control);
      return control;
    };
    const text = make('input', 'text-input');
    text.setAttribute('type', 'text');
    text.setAttribute('autocomplete', 'off');
    text.value = item.text;
    field(`Description of item ${item.text}`, `edit-text-${item.id}`, text);
    const room = make('select', 'text-input');
    fillRoomChoice(room, item.room);
    field('Room', `edit-room-${item.id}`, room);
    const tag = make('input', 'text-input');
    tag.setAttribute('type', 'text');
    tag.setAttribute('autocomplete', 'off');
    tag.value = item.tag;
    field('Material, colour or style (optional)', `edit-tag-${item.id}`, tag);
    form.append(make('p', 'hint', `Status: ${item.status}. Use the change-status button in the list to switch between Locked and Unsure.`));
    const errorBox = make('p', 'field-error');
    errorBox.id = `edit-error-${item.id}`;
    errorBox.hidden = true;
    const fields = { text, room, tag };
    const save = () => saveEdit(item.id, fields, errorBox);
    text.addEventListener('keydown', guarded('Editing an item with the keyboard', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); save(); }
      if (event.key === 'Escape') { event.preventDefault(); cancelEdit(item.id); }
    }));
    keyed.set(`edit-text-${item.id}`, text);
    form.append(button('Save item', null, save), button('Cancel', null, () => cancelEdit(item.id)), errorBox);
    return form;
  }

  function itemEntry(item) {
    const li = make('li', 'entry item-entry');
    if (ui.editing === item.id) {
      li.append(editRow(item));
      return li;
    }
    const row = make('div', 'entry-row');
    row.append(make('span', 'entry-name', item.text));
    // The status is always written out, never shown by colour alone.
    row.append(make('span', `entry-detail status-text status-${item.status.toLowerCase()}`, `Status: ${item.status}`));
    row.append(make('span', 'entry-detail', `Room: ${roomName(item.room)}`));
    if (item.tag) row.append(make('span', 'entry-detail', `Material, colour or style: ${item.tag}`));
    const actions = make('span', 'entry-actions');
    const other = item.status === 'Locked' ? 'Unsure' : 'Locked';
    actions.append(
      button(`Edit item ${item.text}`, itemKey('edit', item.id), () => startEdit(item.id)),
      button(`Change ${item.text} to ${other}`, itemKey('status', item.id), () => changeStatus(item.id)),
      button(`Remove item ${item.text}`, itemKey('remove', item.id), () => removeItem(item.id)),
    );
    row.append(actions);
    li.append(row);
    return li;
  }

  function render() {
    const state = getState();
    keyed.clear();
    const rooms = api.allRooms(state);
    refs['item-list'].replaceChildren(...state.items.map(itemEntry));
    refs['items-empty'].hidden = state.items.length > 0;
    refs['items-none'].hidden = state.items.length > 0;
    refs['items-no-rooms'].hidden = rooms.length > 0;
    const chosen = refs['item-room'].value;
    fillRoomChoice(refs['item-room'], chosen);
    const target = ui.focusKey === 'list-heading' ? refs['item-list-heading'] : keyed.get(ui.focusKey);
    ui.focusKey = null;
    if (target) target.focus();
  }

  // ---- Wiring -------------------------------------------------------------------------------

  const onEnter = (step, handler) => guarded(step, (event) => {
    if (event.key === 'Enter') { event.preventDefault(); handler(); }
  });

  attempt('Add item', () => {
    refs['add-item'].addEventListener('click', guarded('Add item button', addItem));
    refs['item-text'].addEventListener('keydown', onEnter('Item description box', addItem));
    refs['item-tag'].addEventListener('keydown', onEnter('Item tag box', addItem));
  });
  attempt('List of items', render);
  // Redrawn each time the screen is shown, so the rooms match the setup and removed rooms' items are gone.
  attempt('Items screen', () => onShow('items', () => { ui.editing = null; render(); }));
  attempt('Clearing the items screen on Start again', () => {
    if (!onReset) return;
    onReset(() => {
      ui.editing = null;
      ui.focusKey = null;
      refs['item-text'].value = '';
      refs['item-tag'].value = '';
      for (const radio of STATUS_RADIOS) radio.checked = false;
      clearAllErrors();
      render();
    });
  });
}
