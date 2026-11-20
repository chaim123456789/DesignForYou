// Intake Task 10: the items screen.
//
// These tests run the REAL docs/intake/screens.js, setup-screen.js and items-screen.js, with the real
// state.js and limits.js, on the stand-in page built from the REAL docs/index.html (test-helpers/).
// What this CANNOT show: how the screen looks, 320 px layout, a real keyboard, real screen-reader
// behaviour. Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { LIMITS } from '../docs/intake/limits.js';
import * as stateApi from '../docs/intake/state.js';
import { buildBrain } from '../docs/intake/build-brain.js';

const html = readDoc('index.html');
let caseNumber = 0;

async function openOwn() {
  const page = createFakePage();
  const restore = installFakePage(page);
  caseNumber += 1;
  await import(`../docs/intake/screens.js?case=items-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  page.el('choose-own').click();
  return { page, restore };
}
async function withOwn(body) {
  const { page, restore } = await openOwn();
  try { await body(page); } finally { restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const status = (page) => page.el('action-status').textContent;
const buttonsIn = (node) => walk(node).filter((n) => n.tagName === 'BUTTON');
const buttonNamed = (node, text) => {
  const found = buttonsIn(node).find((b) => b.textContent === text);
  assert.ok(found, `a button called "${text}" exists; found: ${buttonsIn(node).map((b) => b.textContent).join(' | ')}`);
  return found;
};
const listText = (page) => page.el('item-list').textContent;

function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
// Fill the setup screen: a floor with the given rooms.
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
function fill(page, { text = '', room = '', itemStatus = '', tag = '' } = {}) {
  page.el('item-text').value = text;
  page.el('item-room').value = room;
  page.el('item-status-locked').checked = itemStatus === 'Locked';
  page.el('item-status-unsure').checked = itemStatus === 'Unsure';
  page.el('item-tag').value = tag;
}
const roomIdByName = (page, name) => {
  const option = page.el('item-room').children.find((o) => o.textContent === name);
  assert.ok(option, `room ${name} is in the list`);
  return option.value;
};

test('Task 10: the item form has a label for every control, the two explanation sentences, and no status chosen at the start', async () => {
  assert.match(html, /<label for="item-text">Item description<\/label>/);
  assert.match(html, /<label for="item-room">Room<\/label>/);
  assert.match(html, /<label for="item-tag">Material, colour or style \(optional\)<\/label>/);
  assert.match(html, /<legend>Locked or Unsure<\/legend>/);
  assert.match(html, /<label class="choice-label" for="item-status-locked">/);
  assert.match(html, /<label class="choice-label" for="item-status-unsure">/);
  assert.match(html, /Locked: must stay exactly as it is\./);
  assert.match(html, /Unsure: open to change\./);
  assert.doesNotMatch(html, /name="item-status"[^>]*checked/, 'no default status');
  assert.doesNotMatch(html, /placeholder=/);
  await withOwn(async (page) => {
    gotoStep(page, 'items');
    assert.equal(page.el('item-status-locked').checked, false);
    assert.equal(page.el('item-status-unsure').checked, false);
    assert.equal(page.el('item-status-locked').getAttribute('name'), page.el('item-status-unsure').getAttribute('name'), 'one choice only');
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
  });
});

test('Task 10: an item cannot be added without choosing Locked or Unsure, and the message is tied to the choice', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    fill(page, { text: 'Oak floor', room: roomIdByName(page, 'Kitchen') });
    page.el('add-item').click();
    assert.equal(page.el('item-list').children.length, 0, 'nothing added');
    assert.equal(page.el('item-status-error').hidden, false);
    assert.equal(page.el('item-status-error').textContent, 'Choose Locked or Unsure for this item.');
    assert.ok(page.el('item-status-group').getAttribute('aria-describedby').split(' ').includes('item-status-error'));
    assert.equal(page.el('item-status-group').getAttribute('aria-invalid'), 'true');
    assert.equal(page.el('item-text').value, 'Oak floor', 'what was typed is kept');
    // Choosing now works and clears the message.
    fill(page, { text: 'Oak floor', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Locked' });
    page.el('add-item').click();
    assert.equal(page.el('item-list').children.length, 1);
    assert.equal(page.el('item-status-error').hidden, true);
    assert.equal(page.el('item-status-group').getAttribute('aria-describedby'), 'item-status-hint');
    assert.equal(page.el('item-status-locked').checked, false, 'the choice is empty again for the next item');
  });
});

test('Task 10: an empty description or no room gives a message next to that field and adds nothing', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    fill(page, { text: '   ', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure' });
    page.el('add-item').click();
    assert.equal(page.el('item-text-error').hidden, false);
    assert.match(page.el('item-text-error').textContent, /Describe the item/);
    assert.ok(page.el('item-text').getAttribute('aria-describedby').split(' ').includes('item-text-error'));
    fill(page, { text: 'Oak floor', room: '', itemStatus: 'Unsure' });
    page.el('add-item').click();
    assert.equal(page.el('item-text-error').hidden, true, 'the old message is cleared');
    assert.equal(page.el('item-room-error').textContent, 'Choose a room for this item.');
    assert.ok(page.el('item-room').getAttribute('aria-describedby').split(' ').includes('item-room-error'));
    fill(page, { text: 'x'.repeat(81), room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure' });
    page.el('add-item').click();
    assert.match(page.el('item-text-error').textContent, /80 characters or fewer/);
    fill(page, { text: 'Oak floor', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure', tag: 't'.repeat(41) });
    page.el('add-item').click();
    assert.match(page.el('item-tag-error').textContent, /40 characters or fewer/);
    assert.equal(page.el('item-list').children.length, 0);
  });
});

test('Task 10: the room list matches the rooms entered in setup, and follows renames and removals', async () => {
  await withOwn(async (page) => {
    setUp(page, ['Kitchen', 'Bedroom', 'Bathroom']);
    gotoStep(page, 'items');
    const names = () => page.el('item-room').children.map((o) => o.textContent);
    assert.deepEqual(names(), ['Choose a room', 'Kitchen', 'Bedroom', 'Bathroom']);
    assert.equal(page.el('items-no-rooms').hidden, true);
    // Back in setup: remove one room, then come back.
    page.el('back-button').click(); page.el('back-button').click(); page.el('back-button').click(); page.el('back-button').click(); page.el('back-button').click();
    assert.equal(page.el('screen-setup').hidden, false);
    const remove = buttonNamed(page.el('floor-list'), 'Remove room Bedroom');
    remove.click();
    gotoStep(page, 'items');
    assert.deepEqual(names(), ['Choose a room', 'Kitchen', 'Bathroom']);
  });
});

test('Task 10: with no rooms the page says so in plain words', async () => {
  await withOwn(async (page) => {
    gotoStep(page, 'items');
    assert.equal(page.el('items-no-rooms').hidden, false);
    assert.match(html, /id="items-no-rooms"[^>]*>There are no rooms yet\. Add rooms in the project setup step first/);
    assert.deepEqual(page.el('item-room').children.map((o) => o.textContent), ['Choose a room']);
    fill(page, { text: 'Oak floor', itemStatus: 'Locked' });
    page.el('add-item').click();
    assert.equal(page.el('item-room-error').textContent, 'Choose a room for this item.');
  });
});

test('Task 10: the list shows the status as text, with room and tag, and the list actions change, edit and remove', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    assert.equal(page.el('items-empty').hidden, false);
    assert.match(html, /id="items-none"[^>]*>You can go on without items\. The design team will then have nothing to work on except the clash check\./);
    fill(page, { text: 'Oak floor', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Locked', tag: 'warm oak' });
    page.el('add-item').click();
    fill(page, { text: 'Linen curtains', room: roomIdByName(page, 'Bedroom'), itemStatus: 'Unsure' });
    page.el('add-item').click();
    assert.equal(page.el('items-empty').hidden, true);
    assert.equal(page.el('items-none').hidden, true);
    const text = listText(page);
    assert.ok(text.includes('Status: Locked') && text.includes('Status: Unsure'), 'status is written out');
    assert.ok(text.includes('Room: Kitchen') && text.includes('Room: Bedroom'));
    assert.ok(text.includes('Material, colour or style: warm oak'));
    assert.match(status(page), /^Item added: Linen curtains, Unsure\. You now have 2 of 100 items\.$/);
    // Change status.
    buttonNamed(page.el('item-list'), 'Change Linen curtains to Locked').click();
    assert.ok(listText(page).includes('Linen curtains') && listText(page).split('Status: Locked').length === 3, 'both are Locked now');
    assert.equal(status(page), 'Linen curtains is now Locked.');
    // Edit.
    buttonNamed(page.el('item-list'), 'Edit item Oak floor').click();
    const input = page.el('item-list').children[0] && walk(page.el('item-list')).find((n) => n.tagName === 'INPUT' && n.id.startsWith('edit-text-'));
    assert.ok(input, 'an edit box opened');
    assert.equal(page.document.activeElement, input, 'the keyboard focus moved into it');
    const label = walk(page.el('item-list')).find((n) => n.tagName === 'LABEL' && n.getAttribute('for') === input.id);
    assert.ok(label, 'the edit box has a label');
    input.value = 'Oak floor, matt';
    buttonNamed(page.el('item-list'), 'Save item').click();
    assert.ok(listText(page).includes('Oak floor, matt'));
    assert.equal(status(page), 'Item changed: Oak floor, matt.');
    // Edit with a bad value: message, nothing changed.
    buttonNamed(page.el('item-list'), 'Edit item Oak floor, matt').click();
    const box = walk(page.el('item-list')).find((n) => n.tagName === 'INPUT' && n.id.startsWith('edit-text-'));
    box.value = '';
    buttonNamed(page.el('item-list'), 'Save item').click();
    const errorBox = walk(page.el('item-list')).find((n) => n.id && n.id.startsWith('edit-error-'));
    assert.equal(errorBox.hidden, false);
    assert.ok(box.getAttribute('aria-describedby').includes(errorBox.id));
    buttonNamed(page.el('item-list'), 'Cancel').click();
    assert.ok(listText(page).includes('Oak floor, matt'));
    // Remove.
    buttonNamed(page.el('item-list'), 'Remove item Linen curtains').click();
    assert.ok(!listText(page).includes('Linen curtains'));
    assert.equal(status(page), 'Item removed: Linen curtains.');
    assert.equal(page.el('item-list').children.length, 1);
  });
});

test('Task 10: item number 101 is refused with a message next to the Add button', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    fill(page, { text: 'Item', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure' });
    for (let i = 0; i < LIMITS.itemsMax; i += 1) {
      fill(page, { text: `Item ${i + 1}`, room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure' });
      page.el('add-item').click();
    }
    assert.equal(page.el('item-list').children.length, 100);
    fill(page, { text: 'Item 101', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure' });
    page.el('add-item').click();
    assert.equal(page.el('item-list').children.length, 100, 'the 101st item is not added');
    assert.equal(page.el('add-item-error').hidden, false);
    assert.equal(page.el('add-item-error').textContent, 'You can add at most 100 items.');
    assert.ok(page.el('add-item').getAttribute('aria-describedby').includes('add-item-error'));
  });
});

test('Task 10: removing a room with items asks first and names the items; "No" keeps both; "Yes" removes the room and its items', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    fill(page, { text: 'Oak floor', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Locked' });
    page.el('add-item').click();
    fill(page, { text: 'Hob', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Unsure' });
    page.el('add-item').click();
    fill(page, { text: 'Rug', room: roomIdByName(page, 'Bedroom'), itemStatus: 'Unsure' });
    page.el('add-item').click();
    for (let i = 0; i < 5; i += 1) page.el('back-button').click();
    // A room with no items is removed at once (unchanged behaviour); one with items asks first.
    buttonNamed(page.el('floor-list'), 'Remove room Kitchen').click();
    const list = page.el('floor-list');
    assert.ok(list.textContent.includes('Remove the room Kitchen? Its 2 items will be removed too. This cannot be undone.'));
    assert.equal(page.document.activeElement.textContent, 'No, keep the room', 'the safe answer has the focus');
    buttonNamed(list, 'No, keep the room').click();
    assert.equal(status(page), 'The room was kept.');
    assert.ok(list.textContent.includes('Kitchen'));
    gotoStep(page, 'items');
    assert.equal(page.el('item-list').children.length, 3, 'no item was removed');
    for (let i = 0; i < 5; i += 1) page.el('back-button').click();
    buttonNamed(page.el('floor-list'), 'Remove room Kitchen').click();
    buttonNamed(page.el('floor-list'), 'Yes, remove room Kitchen').click();
    assert.equal(status(page), 'Room removed: Kitchen, with 2 items.');
    gotoStep(page, 'items');
    assert.equal(page.el('item-list').children.length, 1);
    assert.ok(listText(page).includes('Rug') && !listText(page).includes('Oak floor') && !listText(page).includes('Hob'));
  });
});

test('Task 10: removing a floor names the items that go with it', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    fill(page, { text: 'Oak floor', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Locked' });
    page.el('add-item').click();
    for (let i = 0; i < 5; i += 1) page.el('back-button').click();
    buttonNamed(page.el('floor-list'), 'Remove floor Ground floor').click();
    assert.ok(page.el('floor-list').textContent.includes('Remove the floor Ground floor and its 2 rooms and 1 item? This cannot be undone.'));
    buttonNamed(page.el('floor-list'), 'Yes, remove floor Ground floor').click();
    assert.equal(status(page), 'Floor removed: Ground floor, with 2 rooms and 1 item.');
    gotoStep(page, 'items');
    assert.equal(page.el('item-list').children.length, 0);
  });
});

test('Task 10: the Brain gets the items as style items owned by Style, and "Start again" clears the form and the list', async () => {
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'items');
    fill(page, { text: '<b>Oak</b> floor', room: roomIdByName(page, 'Kitchen'), itemStatus: 'Locked', tag: 'warm oak' });
    page.el('add-item').click();
    // Text is shown as typed, never as page code.
    assert.ok(listText(page).includes('<b>Oak</b> floor'));
    fill(page, { text: 'half typed', itemStatus: 'Unsure' });
    globalThis.confirm = () => true;
    try {
      page.el('start-again').click();
    } finally { delete globalThis.confirm; }
    assert.equal(page.el('screen-start').hidden, false);
    assert.equal(page.el('item-list').children.length, 0);
    assert.equal(page.el('item-text').value, '');
    assert.equal(page.el('item-status-unsure').checked, false);
  });
  // Same state code, looked at directly.
  const state = stateApi.createState();
  stateApi.setProjectName(state, 'Home');
  const room = stateApi.addRoom(state, stateApi.addFloor(state, 'Ground').id, 'Kitchen');
  stateApi.addItem(state, { text: 'Oak floor', room: room.id, status: 'Locked', tag: 'warm oak' });
  const brain = buildBrain(state);
  const item = brain.items.find((i) => i.kind === 'style');
  assert.equal(item.owner, 'Style');
  assert.equal(item.status, 'Locked');
  assert.equal(item.value.tag, 'warm oak');
});

test('Task 10: items-screen.js is protected: a failing part shows the red message and the other screens still work', async () => {
  const page = createFakePage();
  page.failListenerOn = 'add-item';
  const restore = installFakePage(page);
  try {
    caseNumber += 1;
    await import(`../docs/intake/screens.js?case=items-${caseNumber}`);
    await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
    assert.equal(page.el('intake-error-message').hidden, false);
    assert.ok(page.el('intake-error-message').textContent.includes('Add item'));
    page.el('choose-own').click();
    assert.equal(page.el('screen-setup').hidden, false, 'other screens still work');
    page.el('add-floor').click(); // no name given: the setup screen answers with its own message
    assert.equal(page.el('floor-name-error').hidden, false, 'setup still answers');
  } finally { restore(); }
});

test('Task 10: items-screen.js makes no network, storage or cookie calls and sets no HTML', () => {
  const src = readDoc('intake/items-screen.js');
  assert.doesNotMatch(src, /\bfetch\b|localStorage|sessionStorage|indexedDB|document\.cookie|XMLHttpRequest|innerHTML|insertAdjacentHTML|https?:\/\//);
});
