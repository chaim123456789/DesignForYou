// Place Task 10: the screen "Place furniture, doors and windows": form, list and buttons (no plan yet).
//
// These tests run the REAL docs/intake/screens.js, setup-screen.js and place-screen.js, with the real
// state.js, limits.js and place-geometry.js, on the stand-in page built from the REAL docs/index.html
// (test-helpers/). What this CANNOT show: how the screen looks, 320 px layout, a real keyboard, real
// screen-reader behaviour. Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';

const html = readDoc('index.html');
let caseNumber = 0;

async function openOwn({ failListenerOn = null } = {}) {
  const page = createFakePage();
  page.failListenerOn = failListenerOn;
  const restore = installFakePage(page);
  caseNumber += 1;
  await import(`../docs/intake/screens.js?case=place-screen-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  page.el('choose-own').click();
  return { page, restore };
}
async function withOwn(body, options) {
  const { page, restore } = await openOwn(options);
  try { await body(page); } finally { restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const buttonsIn = (node) => walk(node).filter((n) => n.tagName === 'BUTTON');
const buttonNamed = (node, text) => {
  const found = buttonsIn(node).find((b) => b.textContent === text);
  assert.ok(found, `a button called "${text}" exists; found: ${buttonsIn(node).map((b) => b.textContent).join(' | ')}`);
  return found;
};
const status = (page) => page.el('action-status').textContent;
const listText = (page) => page.el('place-list').textContent;
const describedBy = (control) => (control.getAttribute('aria-describedby') || '').split(' ');

function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
function setUp(page, rooms = ['Kitchen', 'Bedroom']) {
  page.el('project-name').value = 'My home';
  page.el('project-name').dispatch('change');
  page.el('floor-name').value = 'Ground floor';
  page.el('add-floor').click();
  for (const name of rooms) {
    page.el('room-name').value = name;
    page.el('add-room').click();
  }
}
const roomIdByName = (page, name) => {
  const option = page.el('place-room').children.find((o) => o.textContent === name);
  assert.ok(option, `room ${name} is in the list`);
  return option.value;
};
function chooseRoom(page, name) {
  page.el('place-room').value = roomIdByName(page, name);
  page.el('place-room').dispatch('change');
}
// A project with two rooms (each 4 m by 4 m, the setup default), on the place screen with the Kitchen chosen.
async function onPlaceScreen(page) {
  setUp(page);
  gotoStep(page, 'place');
  chooseRoom(page, 'Kitchen');
}
function chooseType(page, type) {
  page.el('place-type').value = type;
  page.el('place-type').dispatch('change');
}
function chooseStatus(page, value) {
  page.el('place-status-locked').checked = value === 'Locked';
  page.el('place-status-unsure').checked = value === 'Unsure';
}
function fillAdd(page, { type = 'sofa', name, itemStatus = 'Locked', x = '100', y = '300', width, depth } = {}) {
  chooseType(page, type);
  if (name !== undefined) page.el('place-name').value = name;
  chooseStatus(page, itemStatus);
  page.el('place-x').value = x;
  page.el('place-y').value = y;
  if (width !== undefined) page.el('place-width').value = width;
  if (depth !== undefined) page.el('place-depth').value = depth;
}
function addObject(page, fields) {
  fillAdd(page, fields);
  page.el('add-placed').click();
}
const SOFA_TEXT = 'Sofa (sofa), Locked. 100 cm from the left, 300 cm from the top, 200 cm wide, 90 cm deep, turned 0 degrees.';

// ---- Markup ---------------------------------------------------------------------------------

test('Place Task 10: every control on the screen has a visible label, nothing uses a placeholder, and no status is chosen at the start', async () => {
  const section = html.slice(html.indexOf('<div id="screen-place"'), html.indexOf('<div id="screen-review"'));
  const controls = [...section.matchAll(/<(input|select)\s[^>]*id="([^"]+)"/g)].map((m) => m[2]);
  assert.ok(controls.length >= 15, `found the screen's controls: ${controls.length}`);
  for (const id of controls) {
    assert.match(section, new RegExp(`<label[^>]*for="${id}"[^>]*>(<input[^>]*>)?(<span>)?[^<\\s][^<]*`), `control ${id} has a visible label`);
  }
  for (const m of section.matchAll(/<button[^>]*id="([^"]+)"[^>]*>([^<]*)<\/button>/g)) {
    assert.ok(m[2].trim().length > 0, `button ${m[1]} has visible text`);
  }
  assert.doesNotMatch(section, /placeholder=/);
  assert.doesNotMatch(section, /name="place-status"[^>]*checked/, 'no default status');
  for (const text of ['Nudge left 10 cm', 'Nudge right 10 cm', 'Nudge up 10 cm', 'Nudge down 10 cm', 'Turn 90 degrees', 'Add object']) {
    assert.ok(section.includes(`>${text}</button>`), `a button reads "${text}"`);
  }
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'place');
    assert.equal(page.el('place-status-locked').checked, false);
    assert.equal(page.el('place-status-unsure').checked, false);
    assert.equal(page.el('place-status-locked').getAttribute('name'), page.el('place-status-unsure').getAttribute('name'), 'one choice only');
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
  });
});

// ---- No rooms, choosing a room ----------------------------------------------------------------

test('Place Task 10: with no rooms the screen says so and shows no form', async () => {
  await withOwn(async (page) => {
    gotoStep(page, 'place');
    assert.equal(page.el('place-no-rooms').hidden, false);
    assert.match(html, /<p id="place-no-rooms"[^>]*>There are no rooms yet\. Add rooms in the project setup step first/);
    assert.equal(page.el('place-room-panel').hidden, true);
    assert.equal(page.el('place-form-panel').hidden, true);
    assert.equal(page.el('place-list-panel').hidden, true);
    assert.equal(page.el('place-selected-panel').hidden, true);
  });
});

test('Place Task 10: the form appears once a room is chosen, with the room size line and the setup rooms in the list', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'place');
    assert.equal(page.el('place-no-rooms').hidden, true);
    assert.deepEqual(page.el('place-room').children.map((o) => o.textContent), ['Choose a room', 'Kitchen', 'Bedroom']);
    assert.equal(page.el('place-form-panel').hidden, true, 'no form until a room is chosen');
    chooseRoom(page, 'Kitchen');
    assert.equal(page.el('place-form-panel').hidden, false);
    assert.equal(page.el('place-list-panel').hidden, false);
    assert.equal(page.el('place-room-size').textContent, 'Room size: 4.0 m by 4.0 m (as entered in setup).');
    assert.match(status(page), /Kitchen chosen/);
    assert.deepEqual(page.el('place-type').children.map((o) => o.value), ['', 'sofa', 'bed', 'table', 'wardrobe', 'desk', 'bath', 'kitchen unit', 'door', 'window']);
  });
});

test('Place Task 10: choosing a type fills in the start name and size', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    chooseType(page, 'bed');
    assert.equal(page.el('place-name').value, 'Bed');
    assert.equal(page.el('place-width').value, '160');
    assert.equal(page.el('place-depth').value, '200');
    chooseType(page, 'window');
    assert.equal(page.el('place-name').value, 'Window');
    assert.equal(page.el('place-width').value, '120');
    assert.equal(page.el('place-depth').value, '10');
  });
});

// ---- Adding ------------------------------------------------------------------------------------

test('Place Task 10: adding an object changes the list text, selects it, empties the form and announces it', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    assert.equal(page.el('place-empty').hidden, false);
    addObject(page);
    assert.equal(page.el('place-list').children.length, 1);
    assert.equal(page.el('place-empty').hidden, true);
    assert.ok(listText(page).includes(SOFA_TEXT), listText(page));
    assert.equal(page.el('place-selected-panel').hidden, false, 'the new object is selected');
    assert.match(status(page), /^Added Sofa, Locked\. It is selected\. You now have 1 object in this room\.$/);
    assert.equal(page.el('place-name').value, '');
    assert.equal(page.el('place-status-locked').checked, false, 'the next object must be chosen again');
    assert.equal(page.document.activeElement, page.el('place-type'));
    assert.deepEqual(page.problemLines(), []);
  });
});

test('Place Task 10: a refused add shows its sentence next to the box, linked with aria-describedby, and adds nothing', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    // Blank name
    addObject(page, { name: '   ' });
    assert.equal(page.el('place-name-error').textContent, 'Give this object a name.');
    assert.equal(page.el('place-name-error').hidden, false);
    assert.ok(describedBy(page.el('place-name')).includes('place-name-error'));
    assert.equal(page.el('place-name').getAttribute('aria-invalid'), 'true');
    assert.equal(page.document.activeElement, page.el('place-name'));
    assert.equal(page.el('place-list').children.length, 0, 'nothing was added');
    // Name too long; the earlier message is cleared
    addObject(page, { name: 'x'.repeat(41) });
    assert.match(page.el('place-name-error').textContent, /40 characters or fewer/);
    // A letter in a number box
    addObject(page, { x: 'abc' });
    assert.equal(page.el('place-name-error').hidden, true, 'the old message is cleared');
    assert.match(page.el('place-x-error').textContent, /^Left must be a whole number of centimetres from -1000 to 3000\.$/);
    assert.ok(describedBy(page.el('place-x')).includes('place-x-error'));
    assert.equal(page.el('place-x').value, 'abc', 'what was typed is kept');
    // A size of 0
    addObject(page, { width: '0' });
    assert.match(page.el('place-width-error').textContent, /^Width must be a whole number/);
    addObject(page, { depth: '0' });
    assert.match(page.el('place-depth-error').textContent, /^Depth must be a whole number/);
    // No Locked or Unsure chosen
    addObject(page, { itemStatus: '' });
    assert.equal(page.el('place-status-error').textContent, 'Choose Locked or Unsure for this object.');
    assert.ok(describedBy(page.el('place-status-group')).includes('place-status-error'));
    assert.equal(page.document.activeElement, page.el('place-status-locked'));
    // No type
    page.el('place-type').value = '';
    chooseStatus(page, 'Locked');
    page.el('add-placed').click();
    assert.equal(page.el('place-type-error').textContent, 'Choose a type from the list.');
    assert.equal(page.el('place-list').children.length, 0, 'nothing was ever added');
    // A good add clears the messages and the links
    addObject(page);
    assert.equal(page.el('place-list').children.length, 1);
    assert.equal(page.el('place-type-error').hidden, true);
    assert.equal(page.el('place-status-error').hidden, true);
    assert.ok(!describedBy(page.el('place-x')).includes('place-x-error'));
  });
});

test('Place Task 10: the limit on objects in one room is refused with its sentence next to the Add button', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    for (let i = 0; i < 30; i += 1) addObject(page, { name: `Chair ${i}`, x: '0', y: '0' });
    assert.equal(page.el('place-list').children.length, 30);
    addObject(page, { name: 'One too many' });
    assert.equal(page.el('add-placed-error').textContent, 'You can place at most 30 objects in one room.');
    assert.ok(describedBy(page.el('add-placed')).includes('add-placed-error'));
    assert.equal(page.el('place-list').children.length, 30);
  });
});

// ---- Select, nudge, turn, wall, status, edit, remove ----------------------------------------------

test('Place Task 10: nudge buttons move exactly 10 cm each way, change the list text, announce, and keep the focus on the button', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    const moves = [
      ['nudge-right', 'Sofa (sofa), Locked. 110 cm from the left, 300 cm from the top', 'Sofa moved 10 cm to the right.'],
      ['nudge-left', 'Sofa (sofa), Locked. 100 cm from the left, 300 cm from the top', 'Sofa moved 10 cm to the left.'],
      ['nudge-up', 'Sofa (sofa), Locked. 100 cm from the left, 290 cm from the top', 'Sofa moved 10 cm up.'],
      ['nudge-down', 'Sofa (sofa), Locked. 100 cm from the left, 300 cm from the top', 'Sofa moved 10 cm down.'],
    ];
    for (const [id, expectedList, expectedStatus] of moves) {
      page.el(id).click();
      assert.ok(listText(page).includes(expectedList), `${id}: ${listText(page)}`);
      assert.equal(status(page), expectedStatus);
      assert.equal(page.document.activeElement, page.el(id), `${id} keeps the focus`);
    }
    // The boxes follow the object.
    assert.equal(page.el('sel-x').value, '100');
    assert.equal(page.el('sel-y').value, '300');
  });
});

test('Place Task 10: a nudge out of the room still works and the list says the object sticks out', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { x: '0', y: '0' });
    page.el('nudge-left').click();
    assert.ok(listText(page).includes('-10 cm from the left'));
    assert.ok(listText(page).includes('Sticks out of the room.'));
    assert.equal(status(page), 'Sofa moved 10 cm to the left. It sticks out of the room.');
  });
});

test('Place Task 10: a refused nudge keeps the old values and shows its sentence next to the button', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { x: '-1000', y: '0' });
    const before = listText(page);
    page.el('nudge-left').click();
    assert.equal(listText(page), before, 'nothing changed');
    assert.equal(page.el('sel-move-error').hidden, false);
    assert.match(page.el('sel-move-error').textContent, /^Left must be a whole number of centimetres from -1000 to 3000\.$/);
    assert.ok(describedBy(page.el('nudge-left')).includes('sel-move-error'));
    assert.equal(page.document.activeElement, page.el('nudge-left'));
    page.el('nudge-right').click(); // a good change clears the message
    assert.equal(page.el('sel-move-error').hidden, true);
    assert.ok(!describedBy(page.el('nudge-left')).includes('sel-move-error'));
  });
});

test('Place Task 10: Turn 90 degrees swaps width and depth, keeps the corner, and announces it', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    page.el('sel-turn').click();
    assert.ok(listText(page).includes('Sofa (sofa), Locked. 100 cm from the left, 300 cm from the top, 90 cm wide, 200 cm deep, turned 90 degrees.'), listText(page));
    assert.match(status(page), /^Sofa turned a quarter turn\. It is now turned 90 degrees, 90 cm wide and 200 cm deep\./);
    assert.equal(page.document.activeElement, page.el('sel-turn'));
    for (let i = 0; i < 3; i += 1) page.el('sel-turn').click();
    assert.ok(listText(page).includes(SOFA_TEXT), 'four turns return to the start');
  });
});

test('Place Task 10: the Wall list puts a door flush to a wall; it is shown for doors and windows only', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { type: 'sofa' });
    assert.equal(page.el('sel-wall-group').hidden, true, 'a sofa has no Wall list');
    addObject(page, { type: 'door', itemStatus: 'Unsure', x: '50', y: '0' });
    assert.equal(page.el('sel-wall-group').hidden, false);
    assert.deepEqual(page.el('sel-wall').children.map((o) => o.textContent), ['Choose a wall', 'Top', 'Bottom', 'Left', 'Right']);
    page.el('sel-wall').value = 'Bottom';
    page.el('sel-wall').dispatch('change');
    assert.ok(listText(page).includes('Door (door), Unsure. 50 cm from the left, 390 cm from the top, 90 cm wide, 10 cm deep, turned 0 degrees.'), listText(page));
    assert.equal(status(page), 'Door is now against the Bottom wall.');
    assert.equal(page.document.activeElement, page.el('sel-wall'));
    page.el('sel-wall').value = 'Right';
    page.el('sel-wall').dispatch('change');
    // Against a side wall the long side lies along the wall, so the door turns a quarter.
    assert.ok(listText(page).includes('Door (door), Unsure. 390 cm from the left, 390 cm from the top, 10 cm wide, 90 cm deep, turned 90 degrees.'), listText(page));
  });
});

test('Place Task 10: Change status switches between Locked and Unsure', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    assert.equal(page.el('sel-status').textContent, 'Change Sofa to Unsure');
    page.el('sel-status').click();
    assert.ok(listText(page).includes('Sofa (sofa), Unsure.'));
    assert.equal(status(page), 'Sofa is now Unsure.');
    assert.equal(page.el('sel-status').textContent, 'Change Sofa to Locked');
    assert.equal(page.document.activeElement, page.el('sel-status'));
    page.el('sel-status').click();
    assert.ok(listText(page).includes('Sofa (sofa), Locked.'));
  });
});

test('Place Task 10: Select and Edit pick an object from the list; Save changes edits it', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { name: 'Big sofa' });
    addObject(page, { type: 'table', name: 'Table', itemStatus: 'Unsure', x: '0', y: '0' });
    assert.match(page.el('place-selected-name').textContent, /^Selected: Table \(table\)/, 'the newest object is selected');
    const [first] = page.el('place-list').children;
    const select = buttonNamed(first, 'Select Big sofa');
    select.click();
    assert.match(page.el('place-selected-name').textContent, /^Selected: Big sofa \(sofa\)/);
    assert.equal(status(page), 'Big sofa selected.');
    assert.equal(page.document.activeElement, buttonNamed(page.el('place-list').children[0], 'Select Big sofa'), 'the focus stays on the Select button');
    buttonNamed(page.el('place-list').children[0], 'Edit Big sofa').click();
    assert.equal(page.document.activeElement, page.el('sel-name'), 'Edit moves to the name box');
    page.el('sel-name').value = 'Grey sofa';
    page.el('sel-x').value = '120';
    page.el('sel-width').value = '180';
    page.el('sel-save').click();
    assert.ok(listText(page).includes('Grey sofa (sofa), Locked. 120 cm from the left, 300 cm from the top, 180 cm wide, 90 cm deep, turned 0 degrees.'), listText(page));
    assert.equal(status(page), 'Grey sofa changed.');
    assert.equal(page.document.activeElement, page.el('sel-save'));
  });
});

test('Place Task 10: a refused Save changes keeps the old values, keeps what was typed, and shows its sentence next to the box', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    page.el('sel-x').value = 'abc';
    page.el('sel-save').click();
    assert.ok(listText(page).includes(SOFA_TEXT), 'the object is unchanged');
    assert.match(page.el('sel-x-error').textContent, /^Left must be a whole number/);
    assert.ok(describedBy(page.el('sel-x')).includes('sel-x-error'));
    assert.equal(page.el('sel-x').getAttribute('aria-invalid'), 'true');
    assert.equal(page.el('sel-x').value, 'abc', 'what was typed is kept');
    assert.equal(page.document.activeElement, page.el('sel-x'));
    page.el('sel-x').value = '100';
    page.el('sel-name').value = '';
    page.el('sel-save').click();
    assert.equal(page.el('sel-name-error').textContent, 'Give this object a name.');
    assert.equal(page.el('sel-x-error').hidden, true);
    page.el('sel-name').value = 'Sofa';
    page.el('sel-depth').value = '1001';
    page.el('sel-save').click();
    assert.match(page.el('sel-depth-error').textContent, /^Depth must be a whole number/);
    assert.ok(listText(page).includes(SOFA_TEXT), 'still unchanged');
  });
});

test('Place Task 10: Remove takes the object out, announces it and moves the focus to the list heading', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    addObject(page, { type: 'bed', name: 'Bed', x: '0', y: '0' });
    buttonNamed(page.el('place-list').children[0], 'Remove Sofa').click();
    assert.equal(page.el('place-list').children.length, 1);
    assert.ok(!listText(page).includes('Sofa'));
    assert.equal(status(page), 'Sofa removed. 1 object left in this room.');
    assert.equal(page.document.activeElement, page.el('place-list-heading'));
    buttonNamed(page.el('place-list').children[0], 'Remove Bed').click();
    assert.equal(page.el('place-empty').hidden, false);
    assert.equal(page.el('place-selected-panel').hidden, true, 'nothing is selected any more');
    assert.equal(status(page), 'Bed removed. 0 objects left in this room.');
  });
});

test('Place Task 10: each room has its own list, and the other rooms show their counts', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    addObject(page, { type: 'bed', name: 'Bed', x: '0', y: '0' });
    assert.deepEqual(page.el('place-others').children.map((c) => c.textContent), ['Bedroom: 0 objects placed']);
    chooseRoom(page, 'Bedroom');
    assert.equal(page.el('place-list').children.length, 0);
    assert.equal(page.el('place-selected-panel').hidden, true);
    assert.deepEqual(page.el('place-others').children.map((c) => c.textContent), ['Kitchen: 2 objects placed']);
    addObject(page, { type: 'wardrobe', name: 'Wardrobe', x: '0', y: '0' });
    chooseRoom(page, 'Kitchen');
    assert.deepEqual(page.el('place-others').children.map((c) => c.textContent), ['Bedroom: 1 object placed']);
  });
});

// ---- Safety ------------------------------------------------------------------------------------

test('Place Task 10: visitor text is shown as plain text only', async () => {
  const source = readFileSync(new URL('../docs/intake/place-screen.js', import.meta.url), 'utf8');
  for (const word of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket']) {
    assert.ok(!source.includes(word), `place-screen.js must not contain ${word}`);
  }
  assert.ok(!/^\s*import\s/m.test(source), 'place-screen.js imports nothing');
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    const sneaky = '<img src=x onerror=alert(1)>';
    addObject(page, { name: sneaky });
    assert.ok(listText(page).includes(`${sneaky} (sofa), Locked.`), 'shown as plain text');
    assert.equal(page.el('place-selected-name').textContent.includes(sneaky), true);
    assert.equal(page.el('place-list').children[0].children.every((c) => c.tagName !== 'IMG'), true);
  });
});

test('Place Task 10: a part of the screen that cannot be set up shows the red message, and every other control still works', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'place');
    chooseRoom(page, 'Kitchen');
    addObject(page);
    assert.equal(page.el('intake-error-message').hidden, false, 'a refused listener is reported');
    assert.ok(page.el('intake-error-message').textContent.includes('Place screen: nudge buttons'));
    assert.equal(page.el('place-list').children.length, 1, 'adding still works');
    page.el('sel-turn').click();
    assert.ok(listText(page).includes('turned 90 degrees'), 'turning still works');
    page.el('back-button').click();
    assert.equal(page.el('screen-items').hidden, false, 'the other screens still work');
  }, { failListenerOn: 'nudge-left' });
});

test('Place Task 10: if the place screen file itself cannot be set up, the other screens still work', async () => {
  // Make the screen's room list fail at the first drawing by removing a control it needs.
  const page = createFakePage();
  page.byId.delete('place-list');
  const restore = installFakePage(page);
  try {
    caseNumber += 1;
    await import(`../docs/intake/screens.js?case=place-screen-${caseNumber}`);
    await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
    page.el('choose-own').click();
    assert.equal(page.el('intake-error-message').hidden, false);
    assert.match(page.el('intake-error-message').textContent, /Place screen: first drawing/);
    setUp(page);
    gotoStep(page, 'review');
    assert.equal(page.el('screen-review').hidden, false, 'Review and run still opens');
    page.el('back-button').click();
    page.el('back-button').click();
    assert.equal(page.el('screen-items').hidden, false);
    assert.deepEqual(page.el('item-list').children, []);
  } finally { restore(); }
});
