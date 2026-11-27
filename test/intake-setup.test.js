// Intake Task 7: the project setup screen (name, floors, rooms, list with rename and remove).
//
// These tests run the REAL docs/intake/screens.js and docs/intake/setup-screen.js, with the real
// state.js and limits.js, on the stand-in page built from the REAL docs/index.html (test-helpers/).
// What this CANNOT show: how the form looks, 320 px layout, real keyboard or screen-reader behaviour.
// Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from '../test-helpers/register-hooks.js';
import { createFakePage, installFakePage, waitFor, readDoc, readStyles } from '../test-helpers/fake-page.js';
import { LIMITS } from '../docs/intake/limits.js';

const html = readDoc('index.html');
const css = readStyles();

let caseNumber = 0;

async function openSetup(configure = () => {}) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  caseNumber += 1;
  await import(`../docs/intake/screens.js?case=setup-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  page.el('choose-own').click(); // the setup screen
  return { page, restore };
}

async function withSetup(configure, body) {
  const { page, restore } = await openSetup(configure);
  try { await body(page); } finally { restore(); }
}

// ---- Helpers that read the stand-in page ----

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const listNodes = (page) => walk(page.el('floor-list'));
const listText = (page) => listNodes(page).map((n) => n._text).filter(Boolean);
const status = (page) => page.el('action-status').textContent;
const needs = (page) => page.el('setup-needs').textContent;

function button(page, text) {
  const found = listNodes(page).filter((n) => n.tagName === 'BUTTON' && n.textContent === text);
  assert.equal(found.length, 1, `exactly one button "${text}" (found ${found.length}; buttons: ${listNodes(page).filter((n) => n.tagName === 'BUTTON').map((b) => b.textContent).join(' | ')})`);
  return found[0];
}
const hasButton = (page, text) => listNodes(page).some((n) => n.tagName === 'BUTTON' && n.textContent === text);

function addFloor(page, name) {
  page.el('floor-name').value = name;
  page.el('add-floor').click();
}
function addRoom(page, { floor, name, width, depth }) {
  if (floor !== undefined) {
    const option = walk(page.el('room-floor')).find((n) => n.tagName === 'OPTION' && n.textContent === floor);
    assert.ok(option, `the floor list offers ${floor}`);
    page.el('room-floor').value = option.value;
    page.el('room-floor').dispatch('change');
  }
  page.el('room-name').value = name;
  if (width !== undefined) page.el('room-width').value = width;
  if (depth !== undefined) page.el('room-depth').value = depth;
  page.el('add-room').click();
}
const fieldError = (page, field) => page.el(`${field}-error`);
function assertFieldError(page, field, pattern) {
  const error = fieldError(page, field);
  assert.equal(error.hidden, false, `${field} shows a message`);
  assert.match(error.textContent, pattern);
  assert.ok(error.id, 'the message has an id');
  assert.ok(page.el(field).getAttribute('aria-describedby').split(' ').includes(error.id), `${field} is tied to its message with aria-describedby`);
  assert.equal(page.el(field).getAttribute('aria-invalid'), 'true');
}

// ---- Adding ----

test('Task 7: adding a floor lists it, announces it in the status line and empties the box', async () => {
  await withSetup(() => {}, async (page) => {
    assert.equal(page.el('list-empty').hidden, false, 'an empty list says so');
    addFloor(page, '  Ground floor ');
    assert.ok(listText(page).includes('Ground floor'));
    assert.ok(listText(page).includes('0 rooms'));
    assert.equal(page.el('list-empty').hidden, true);
    assert.equal(status(page), 'Floor added: Ground floor. You now have 1 of 4 floors.');
    assert.equal(page.el('floor-name').value, '');
    assert.equal(page.document.activeElement, page.el('floor-name'), 'the box keeps the focus so more floors can be added');
    assert.equal(fieldError(page, 'floor-name').hidden, true);
  });
});

test('Task 7: adding a room puts it under its floor with its size (4 by 4 when left alone), and announces it', async () => {
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    addFloor(page, 'Upper floor');
    addRoom(page, { floor: 'Ground floor', name: 'Kitchen' });
    assert.ok(listText(page).includes('Kitchen'));
    assert.ok(listText(page).includes('4 m wide, 4 m deep'));
    assert.equal(status(page), 'Room added: Kitchen, on Ground floor. You now have 1 of 20 rooms.');
    assert.equal(page.el('room-name').value, '');
    assert.equal(page.el('room-width').value, String(LIMITS.roomSizeDefault));
    assert.equal(page.el('room-depth').value, String(LIMITS.roomSizeDefault));
    addRoom(page, { floor: 'Upper floor', name: 'Bedroom', width: '5,5', depth: '3.2' });
    assert.ok(listText(page).includes('5.5 m wide, 3.2 m deep'));
    assert.ok(listText(page).includes('1 room'), 'one room counts as "1 room"');
    // Leaving the size boxes empty also means 4 by 4.
    addRoom(page, { name: 'Hall', width: '', depth: '' });
    assert.equal(listText(page).filter((t) => t === '4 m wide, 4 m deep').length, 2);
  });
});

test('Task 7: the size boxes say they are only for the 3D drawing, and the project name box says its limit', () => {
  const setup = html.slice(html.indexOf('<div id="screen-setup"'), html.indexOf('<div id="screen-inspiration"'));
  assert.match(setup, /Width and depth are optional\. They are only used to draw the 3D view\. They are not the real size of your home\./);
  assert.match(setup, /<label for="room-width">Width \(metres\)<\/label>/);
  assert.match(setup, /<label for="room-depth">Depth \(metres\)<\/label>/);
  assert.match(setup, new RegExp(`id="room-width"[^>]*value="${LIMITS.roomSizeDefault}"`));
  assert.match(setup, new RegExp(`id="room-depth"[^>]*value="${LIMITS.roomSizeDefault}"`));
  assert.match(setup, new RegExp(`Up to ${LIMITS.projectNameMax} characters`));
  assert.match(setup, /A project has 1 to 4 floors/);
  assert.match(setup, /Up to 20 rooms in total/);
});

// ---- Bad input: a message next to the field, and nothing is added ----

test('Task 7: bad input shows a message tied to its field with aria-describedby, and adds nothing', async () => {
  await withSetup(() => {}, async (page) => {
    const snapshot = () => JSON.stringify([listText(page), status(page), needs(page)]);

    // A room needs a floor first: the message is next to the floor choice.
    const before = snapshot();
    addRoom(page, { name: 'Kitchen' });
    assertFieldError(page, 'room-floor', /Add a floor first/);
    assert.equal(snapshot(), before);
    assert.equal(page.document.activeElement, page.el('room-floor'));

    // An empty floor name.
    addFloor(page, '   ');
    assertFieldError(page, 'floor-name', /Give this floor a name/);
    assert.equal(snapshot(), before);
    assert.equal(page.document.activeElement, page.el('floor-name'));

    // Too long a floor name.
    addFloor(page, 'x'.repeat(LIMITS.floorNameMax + 1));
    assertFieldError(page, 'floor-name', /characters or fewer/);
    assert.equal(snapshot(), before);

    // A good floor clears its message.
    addFloor(page, 'Ground floor');
    assert.equal(fieldError(page, 'floor-name').hidden, true);
    assert.equal(page.el('floor-name').getAttribute('aria-invalid'), null);
    assert.ok(!(page.el('floor-name').getAttribute('aria-describedby') || '').includes('floor-name-error'));
    assert.equal(page.el('floor-name').getAttribute('aria-describedby'), 'floor-name-hint', 'the fixed hint stays');

    // Room: empty name, bad sizes.
    const withFloor = snapshot();
    addRoom(page, { name: '  ' });
    assertFieldError(page, 'room-name', /Give this room a name/);
    assert.equal(snapshot(), withFloor);
    for (const [field, value] of [['width', 'abc'], ['width', '0'], ['width', '31'], ['depth', '-2'], ['depth', '99']]) {
      page.el('room-width').value = '4';
      page.el('room-depth').value = '4';
      addRoom(page, { name: 'Kitchen', [field]: value });
      assertFieldError(page, `room-${field}`, new RegExp(`^${field === 'width' ? 'Width' : 'Depth'} must be a number from 1 to 30 metres`));
      assert.equal(snapshot(), withFloor, `${field} ${value} adds nothing`);
      assert.equal(page.document.activeElement, page.el(`room-${field}`));
    }
    // Only the message that now applies is shown.
    addRoom(page, { name: 'Kitchen', width: '4', depth: '4' });
    for (const field of ['room-floor', 'room-name', 'room-width', 'room-depth']) assert.equal(fieldError(page, field).hidden, true, `${field} message is gone`);

    // A second room with the same name in another case.
    const withKitchen = snapshot();
    addRoom(page, { name: 'KITCHEN' });
    assertFieldError(page, 'room-name', /Another room already has this name/);
    assert.equal(snapshot(), withKitchen);
  });
});

test('Task 7: the limits hold: a 5th floor and a 21st room are refused with a message', async () => {
  await withSetup(() => {}, async (page) => {
    for (let i = 1; i <= LIMITS.floorsMax; i += 1) addFloor(page, `Floor ${i}`);
    const before = listText(page).join('|');
    addFloor(page, 'Floor 5');
    assertFieldError(page, 'floor-name', /at most 4 floors/);
    assert.equal(listText(page).join('|'), before);
    for (let i = 1; i <= LIMITS.roomsMax; i += 1) addRoom(page, { floor: 'Floor 1', name: `Room ${i}` });
    const full = listText(page).join('|');
    addRoom(page, { name: 'One too many' });
    assertFieldError(page, 'room-name', /at most 20 rooms in total/);
    assert.equal(listText(page).join('|'), full);
  });
});

test('Task 7: the project name is checked, and the "still needed" line follows the project', async () => {
  await withSetup(() => {}, async (page) => {
    const name = page.el('project-name');
    assert.match(needs(page), /a project name, a floor, a room/);
    name.value = 'My home';
    name.dispatch('input');
    assert.match(needs(page), /a floor, a room/);
    assert.doesNotMatch(needs(page), /project name/);
    addFloor(page, 'Ground floor');
    assert.match(needs(page), /a room\.$/);
    addRoom(page, { name: 'Kitchen' });
    assert.match(needs(page), /Your project has a name, a floor and a room/);
    // Too long: the message appears when the box is left, and the project has no name until it is fixed.
    name.value = 'x'.repeat(LIMITS.projectNameMax + 1);
    name.dispatch('input');
    assert.equal(fieldError(page, 'project-name').hidden, true, 'no scolding while typing');
    assert.match(needs(page), /a project name/);
    name.dispatch('change');
    assertFieldError(page, 'project-name', /60 characters or fewer/);
    name.value = 'x'.repeat(LIMITS.projectNameMax);
    name.dispatch('input');
    assert.equal(fieldError(page, 'project-name').hidden, true);
    assert.match(needs(page), /Your project has a name/);
    // Emptied: the message and the needs line agree.
    name.value = '   ';
    name.dispatch('change');
    assertFieldError(page, 'project-name', /Give your project a name/);
    assert.match(needs(page), /a project name/);
  });
});

// ---- Rename ----

test('Task 7: a floor and a room can be renamed, and a bad new name shows a message in the row and changes nothing', async () => {
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    addRoom(page, { name: 'Kitchen' });
    addRoom(page, { name: 'Hall' });

    button(page, 'Rename floor Ground floor').click();
    let input = listNodes(page).find((n) => n.tagName === 'INPUT');
    assert.equal(input.value, 'Ground floor');
    assert.equal(page.document.activeElement, input, 'the focus is in the new box');
    const label = listNodes(page).find((n) => n.tagName === 'LABEL');
    assert.equal(label.textContent, 'New name for floor Ground floor');
    assert.equal(label.getAttribute('for'), input.id);
    input.value = '';
    button(page, 'Save name').click();
    const error = listNodes(page).find((n) => n.className === 'field-error');
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /Give this floor a name/);
    assert.ok(input.getAttribute('aria-describedby').split(' ').includes(error.id));
    input.value = 'Main floor';
    button(page, 'Save name').click();
    assert.ok(listText(page).includes('Main floor'));
    assert.equal(status(page), 'Floor renamed to Main floor.');
    assert.equal(page.document.activeElement, button(page, 'Rename floor Main floor'), 'the focus returns to the Rename button');
    assert.ok(!hasButton(page, 'Save name'));

    // Rooms: a duplicate name in another case is refused.
    button(page, 'Rename room Hall').click();
    input = listNodes(page).find((n) => n.tagName === 'INPUT');
    input.value = 'KITCHEN';
    button(page, 'Save name').click();
    assert.match(listNodes(page).find((n) => n.className === 'field-error').textContent, /Another room already has this name/);
    assert.ok(listText(page).includes('Kitchen'));
    // Changing only the letter case of its own name is allowed.
    input.value = 'HALL';
    button(page, 'Save name').click();
    assert.ok(listText(page).includes('HALL'));
    assert.equal(status(page), 'Room renamed to HALL.');
  });
});

test('Task 7: Cancel and the Escape key leave the name as it was and return the focus to Rename', async () => {
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    button(page, 'Rename floor Ground floor').click();
    listNodes(page).find((n) => n.tagName === 'INPUT').value = 'Something else';
    button(page, 'Cancel').click();
    assert.ok(listText(page).includes('Ground floor'));
    assert.equal(page.document.activeElement, button(page, 'Rename floor Ground floor'));
    button(page, 'Rename floor Ground floor').click();
    const input = listNodes(page).find((n) => n.tagName === 'INPUT');
    input.value = 'Other';
    input.dispatch('keydown', { key: 'Escape' });
    assert.ok(listText(page).includes('Ground floor'));
    assert.ok(!hasButton(page, 'Save name'));
    button(page, 'Rename floor Ground floor').click();
    listNodes(page).find((n) => n.tagName === 'INPUT').dispatch('keydown', { key: 'Enter' });
    assert.ok(listText(page).includes('Ground floor'), 'Enter saves the unchanged name');
  });
});

// ---- Remove ----

test('Task 7: a room is removed at once, and the status line says so', async () => {
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    addRoom(page, { name: 'Kitchen' });
    addRoom(page, { name: 'Hall' });
    button(page, 'Remove room Kitchen').click();
    assert.ok(!listText(page).includes('Kitchen'));
    assert.ok(listText(page).includes('Hall'));
    assert.equal(status(page), 'Room removed: Kitchen.');
    assert.equal(page.document.activeElement, page.el('list-heading'), 'the focus moves to the list heading');
    // The room can be added again afterwards.
    addRoom(page, { name: 'Kitchen' });
    assert.ok(listText(page).includes('Kitchen'));
  });
});

test('Task 7: removing a floor asks first; "No" keeps it, "Yes" removes the floor and its rooms', async () => {
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    addFloor(page, 'Upper floor');
    addRoom(page, { floor: 'Ground floor', name: 'Kitchen' });
    addRoom(page, { floor: 'Ground floor', name: 'Hall' });
    addRoom(page, { floor: 'Upper floor', name: 'Bedroom' });

    button(page, 'Remove floor Ground floor').click();
    assert.ok(listText(page).includes('Remove the floor Ground floor and its 2 rooms? This cannot be undone.'));
    assert.ok(listText(page).includes('Kitchen'), 'nothing is removed before the answer');
    assert.equal(page.document.activeElement, button(page, 'No, keep the floor'), 'the safe answer has the focus');
    assert.equal(button(page, 'No, keep the floor').getAttribute('aria-describedby'), 'confirm-text-floor-1');

    button(page, 'No, keep the floor').click();
    assert.ok(listText(page).includes('Kitchen') && listText(page).includes('Hall'));
    assert.equal(status(page), 'The floor was kept.');
    assert.equal(page.document.activeElement, button(page, 'Remove floor Ground floor'));

    button(page, 'Remove floor Ground floor').click();
    button(page, 'Yes, remove floor Ground floor').click();
    assert.ok(!listText(page).includes('Ground floor'));
    assert.ok(!listText(page).includes('Kitchen') && !listText(page).includes('Hall'), 'its rooms are gone');
    assert.ok(listText(page).includes('Upper floor') && listText(page).includes('Bedroom'), 'the other floor is untouched');
    assert.equal(status(page), 'Floor removed: Ground floor, with 2 rooms.');
    assert.equal(page.document.activeElement, page.el('list-heading'));
    // The room choice follows: only the remaining floor is offered.
    const options = walk(page.el('room-floor')).filter((n) => n.tagName === 'OPTION').map((n) => n.textContent);
    assert.deepEqual(options, ['Upper floor']);
    // And the rooms of the removed floor can be named again.
    addRoom(page, { name: 'Kitchen' });
    assert.ok(listText(page).includes('Kitchen'));
  });
});

test('Task 7: removing the last floor leaves "Nothing added yet", and the room form asks for a floor', async () => {
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    button(page, 'Remove floor Ground floor').click();
    button(page, 'Yes, remove floor Ground floor').click();
    assert.equal(page.el('list-empty').hidden, false);
    assert.equal(status(page), 'Floor removed: Ground floor, with 0 rooms.');
    assert.deepEqual(walk(page.el('room-floor')).filter((n) => n.tagName === 'OPTION').map((n) => n.textContent), ['No floors yet']);
    assert.match(needs(page), /a floor, a room/);
  });
});

// ---- Labels, status line, keyboard ----

test('Task 7: every control on the setup screen has a visible label, and no placeholder is used as a label', async () => {
  const setup = html.slice(html.indexOf('<div id="screen-setup"'), html.indexOf('<div id="screen-inspiration"'));
  const controls = [...setup.matchAll(/<(input|select|textarea)\b([^>]*)>/g)];
  assert.ok(controls.length >= 6, 'the screen has its six boxes');
  for (const [, tag, attrs] of controls) {
    const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    assert.ok(id, `a ${tag} has an id`);
    const label = setup.match(new RegExp(`<label for="${id}">([^<]+)</label>`));
    assert.ok(label && label[1].trim().length > 0, `${id} has a label with visible text`);
    assert.doesNotMatch(attrs, /placeholder=|aria-label=|type="hidden"/, `${id} is not labelled by a placeholder`);
  }
  assert.equal((setup.match(/<label\b/g) || []).length, controls.length, 'no label without a control');
  // Buttons have visible text.
  for (const m of setup.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)) assert.ok(m[1].trim().length > 0);
  // The boxes made while renaming are labelled too, and every list button has text.
  await withSetup(() => {}, async (page) => {
    addFloor(page, 'Ground floor');
    addRoom(page, { name: 'Kitchen' });
    for (const text of ['Rename room Kitchen', 'Rename floor Ground floor']) {
      button(page, text).click();
      const input = listNodes(page).find((n) => n.tagName === 'INPUT');
      const label = listNodes(page).find((n) => n.tagName === 'LABEL');
      assert.ok(label.textContent.length > 0);
      assert.equal(label.getAttribute('for'), input.id);
      assert.equal(input.getAttribute('placeholder'), null);
      button(page, 'Cancel').click();
    }
    for (const b of listNodes(page).filter((n) => n.tagName === 'BUTTON')) assert.ok(b.textContent.trim().length > 0);
  });
});

test('Task 7: the status line is a polite status region, announces additions and removals, and is cleared on a new screen', async () => {
  assert.match(html, /<p id="action-status" class="action-status" role="status" aria-live="polite"><\/p>/);
  await withSetup(() => {}, async (page) => {
    const lines = [];
    addFloor(page, 'Ground floor'); lines.push(status(page));
    addRoom(page, { name: 'Kitchen' }); lines.push(status(page));
    button(page, 'Rename room Kitchen').click();
    button(page, 'Save name').click(); lines.push(status(page));
    button(page, 'Remove room Kitchen').click(); lines.push(status(page));
    button(page, 'Remove floor Ground floor').click();
    button(page, 'Yes, remove floor Ground floor').click(); lines.push(status(page));
    assert.deepEqual(lines, [
      'Floor added: Ground floor. You now have 1 of 4 floors.',
      'Room added: Kitchen, on Ground floor. You now have 1 of 20 rooms.',
      'Room renamed to Kitchen.',
      'Room removed: Kitchen.',
      'Floor removed: Ground floor, with 0 rooms.',
    ]);
    page.el('next-button').click();
    assert.equal(status(page), '', 'a message from one screen does not stay on the next');
  });
});

test('Task 7: the Enter key adds a floor and a room, and every action can be done with buttons and keys alone', async () => {
  await withSetup(() => {}, async (page) => {
    page.el('floor-name').value = 'Ground floor';
    page.el('floor-name').dispatch('keydown', { key: 'Enter' });
    assert.ok(listText(page).includes('Ground floor'));
    page.el('room-name').value = 'Kitchen';
    page.el('room-name').dispatch('keydown', { key: 'Enter' });
    assert.ok(listText(page).includes('Kitchen'));
    page.el('room-name').value = 'Hall';
    page.el('room-depth').dispatch('keydown', { key: 'Enter' });
    assert.ok(listText(page).includes('Hall'));
    page.el('floor-name').dispatch('keydown', { key: 'a' }); // other keys do nothing
    assert.equal(listText(page).filter((t) => t === 'Ground floor').length, 1);
    // The page has no mouse-only control: every list action is a real button, in screen order.
    const actions = listNodes(page).filter((n) => n.tagName === 'BUTTON').map((b) => b.textContent);
    assert.deepEqual(actions, ['Rename floor Ground floor', 'Remove floor Ground floor', 'Rename room Kitchen', 'Remove room Kitchen', 'Rename room Hall', 'Remove room Hall']);
    for (const b of listNodes(page).filter((n) => n.tagName === 'BUTTON')) assert.equal(b.getAttribute('type'), 'button');
  });
});

test('Task 7: names are shown as plain text, never as page code', async () => {
  await withSetup(() => {}, async (page) => {
    const hostile = '<img src=x onerror=alert(1)>';
    addFloor(page, hostile);
    addRoom(page, { name: '<b>Kitchen</b>' });
    assert.ok(listText(page).includes(hostile));
    assert.ok(listText(page).includes('<b>Kitchen</b>'));
    assert.equal(listNodes(page).filter((n) => ['IMG', 'B'].includes(n.tagName)).length, 0);
    assert.ok(status(page).includes('<b>Kitchen</b>'));
    for (const file of ['screens.js', 'setup-screen.js']) {
      const code = readDoc(`intake/${file}`);
      for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'localStorage', 'sessionStorage', 'document.cookie', 'fetch(', 'http://', 'https://']) {
        assert.ok(!code.includes(banned), `${file} uses ${banned}`);
      }
    }
  });
});

// ---- A broken part never stops the others ----

test('Task 7: if the room form cannot be set up, the floor form, the project name, the screens and Next still work', async () => {
  await withSetup((p) => { p.failListenerOn = 'add-room'; }, async (page) => {
    const lines = page.el('intake-error-message').children.map((c) => c.textContent);
    assert.equal(lines[0], 'Something went wrong on this page. Please take a screenshot of this red message.');
    assert.match(lines[1], /^Step "Add room" failed: cannot attach a listener to add-room$/);
    assert.equal(lines.length, 2);
    addFloor(page, 'Ground floor');
    assert.ok(listText(page).includes('Ground floor'));
    page.el('project-name').value = 'Home';
    page.el('project-name').dispatch('input');
    assert.match(needs(page), /a room/);
    page.el('next-button').click();
    assert.equal(page.el('screen-inspiration').hidden, false);
    page.el('back-button').click();
    assert.equal(page.el('screen-setup').hidden, false);
  });
});

test('Task 7: if drawing the list fails, the red message names the step and the other controls still work', async () => {
  await withSetup((p) => { p.failCreate = ['li']; }, async (page) => {
    addFloor(page, 'Ground floor');
    const lines = page.el('intake-error-message').children.map((c) => c.textContent);
    assert.match(lines.join('\n'), /Step "Add floor button" failed: cannot create a <li> element/);
    assert.equal(page.el('error-message').hidden, true);
    // Other parts keep working: the project name, the room form's checks, the screens.
    page.el('project-name').value = 'Home';
    page.el('project-name').dispatch('input');
    assert.doesNotMatch(needs(page), /project name/);
    // The list could not be redrawn, so the floor choice was not refilled: the room form's own check still answers.
    addRoom(page, { name: '' });
    assertFieldError(page, 'room-floor', /Add a floor first/);
    page.el('next-button').click();
    assert.equal(page.el('screen-inspiration').hidden, false);
  });
});

test('Task 7: if the code behind the setup screen cannot be loaded, the red message says so and the other screens still work', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('./state.js?v=') && String(context.parentURL).includes('/docs/intake/screens.js')) {
        throw new Error('state.js cannot be loaded (made-up failure)');
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    await withSetup(() => {}, async (page) => {
      const lines = page.el('intake-error-message').children.map((c) => c.textContent).join('\n');
      assert.match(lines, /Step "Loading the project data code" failed: state\.js cannot be loaded/);
      page.el('next-button').click();
      assert.equal(page.el('screen-inspiration').hidden, false);
      page.el('back-button').click();
      page.el('back-button').click();
      assert.equal(page.el('screen-start').hidden, false);
      page.el('choose-sample').click();
      assert.equal(page.el('screen-result').hidden, false);
    });
  } finally {
    hooks.deregister();
  }
});

// ---- Size and layout (what the stylesheet says) ----

test('Task 7: the setup styles keep text at 16 px or more, boxes and buttons at 44 px or more, and let rows wrap on a narrow screen', () => {
  const part = css;
  assert.ok(part.length > 200);
  for (const m of part.matchAll(/font-size: ([\d.]+)(rem|px)/g)) {
    const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
    assert.ok(px >= 16, `font-size ${m[0]} is under 16 px`);
  }
  assert.match(part, /\.text-input \{[^}]*min-height: 2\.75rem;/);
  assert.match(part, /\.field-row \{ display: flex; flex-wrap: wrap;/);
  assert.match(part, /\.entry-row, \.rename-row, \.confirm-row \{ display: flex; flex-wrap: wrap;/);
  assert.doesNotMatch(part.replace(/(max-width|min-height|min-width): [\d.]+(rem|px)/g, ''), /(?<![-\w])width: \d+px/);
  // The controls everywhere share the 44 px minimum.
  assert.match(css, /\.choice-button, \.nav-button, \.action-button, [^{]*\{[^}]*min-height: 2\.75rem;/);
});
