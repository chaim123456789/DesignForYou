// Intake Task 8: the inspiration screens (overall step and room override step).
//
// These tests run the REAL docs/intake/screens.js and docs/intake/inspiration-screen.js, with the real
// state.js and limits.js, on the stand-in page built from the REAL docs/index.html (test-helpers/).
// The stand-in records every call to URL.createObjectURL and URL.revokeObjectURL.
// What this CANNOT show: how the screens look, a real file picker, real image previews, 320 px layout,
// real keyboard or screen-reader behaviour, the browser's own "leave this page?" box. Those are
// "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createFakePage, installFakePage, waitFor, readDoc, readStyles } from '../test-helpers/fake-page.js';
import { LIMITS } from '../docs/intake/limits.js';
import * as stateApi from '../docs/intake/state.js';
import { buildBrain } from '../docs/intake/build-brain.js';
import { getEffectiveInspiration } from '../src/brain/inspiration.js';
import { setUpInspirationScreens } from '../docs/intake/inspiration-screen.js';

const html = readDoc('index.html');

let caseNumber = 0;

// A stand-in for the browser's preview addresses. It records what was made and what was released.
function stubPreviewAddresses() {
  const created = [];
  const revoked = [];
  const real = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let n = 0;
  URL.createObjectURL = (file) => { n += 1; const url = `blob:test/${n}`; created.push({ url, file }); return url; };
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  return { created, revoked, restore() { URL.createObjectURL = real.create; URL.revokeObjectURL = real.revoke; } };
}

async function openOwn(configure = () => {}) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  const urls = stubPreviewAddresses();
  caseNumber += 1;
  await import(`../docs/intake/screens.js?case=inspiration-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  page.el('choose-own').click();
  return { page, urls, restore: () => { urls.restore(); restore(); } };
}

async function withOwn(configure, body) {
  const { page, urls, restore } = await openOwn(configure);
  try { await body(page, urls); } finally { restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const status = (page) => page.el('action-status').textContent;
const file = (name, type = 'image/png', size = 1000) => ({ name, type, size });
const imageButtons = (page) => walk(page.el('image-list')).filter((n) => n.tagName === 'BUTTON');
const imageCount = (page) => walk(page.el('image-list')).filter((n) => n.tagName === 'IMG').length;
const noteTexts = (list) => walk(list).filter((n) => n.tagName === 'SPAN' && n.className === 'entry-name').map((n) => n.textContent);

function pick(page, files) {
  page.el('image-file').files = files;
  page.el('image-file').dispatch('change');
}
function addFloorAndRooms(page, floor, rooms) {
  page.el('floor-name').value = floor;
  page.el('add-floor').click();
  for (const room of rooms) {
    page.el('room-name').value = room;
    page.el('add-room').click();
  }
}
function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
function optionValue(select, text) {
  const option = walk(select).find((n) => n.tagName === 'OPTION' && n.textContent === text);
  assert.ok(option, `the choice "${text}" is offered`);
  return option.value;
}

// ---- Images: checks ----

test('Task 8: a wrong type of file is refused with a message, and no preview address is made', async () => {
  await withOwn(() => {}, async (page, urls) => {
    gotoStep(page, 'inspiration');
    pick(page, [file('notes.pdf', 'application/pdf'), file('movie.gif', 'image/gif')]);
    assert.equal(imageCount(page), 0);
    assert.equal(urls.created.length, 0, 'no address for a refused file');
    const error = page.el('image-error');
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /"notes\.pdf" is not a JPEG, PNG or WebP image, so it was not added\./);
    assert.match(error.textContent, /"movie\.gif" is not a JPEG, PNG or WebP/);
    assert.ok(page.el('image-file').getAttribute('aria-describedby').split(' ').includes('image-error'), 'the message is tied to the picker');
    assert.equal(page.el('image-file').getAttribute('aria-invalid'), 'true');
    assert.match(status(page), /notes\.pdf/, 'the status line announces the refusal');
    assert.equal(page.document.activeElement, page.el('image-file'), 'focus returns to the picker');
  });
});

test('Task 8: an image over 10 MB is refused, exactly 10 MB is accepted', async () => {
  await withOwn(() => {}, async (page, urls) => {
    gotoStep(page, 'inspiration');
    pick(page, [file('big.png', 'image/png', LIMITS.imageBytesMax + 1)]);
    assert.equal(imageCount(page), 0);
    assert.match(page.el('image-error').textContent, /"big\.png" is larger than 10 MB, so it was not added\./);
    assert.equal(urls.created.length, 0);
    pick(page, [file('edge.png', 'image/png', LIMITS.imageBytesMax)]);
    assert.equal(imageCount(page), 1);
    assert.equal(page.el('image-error').hidden, true, 'a good file clears the old message');
    assert.equal(page.el('image-file').getAttribute('aria-describedby'), 'image-privacy image-hint');
  });
});

test('Task 8: the 51st image is refused with a message and gets no preview address', async () => {
  await withOwn(() => {}, async (page, urls) => {
    gotoStep(page, 'inspiration');
    pick(page, Array.from({ length: 50 }, (_, i) => file(`p${i}.jpg`, 'image/jpeg')));
    assert.equal(imageCount(page), 50);
    assert.equal(urls.created.length, 50);
    pick(page, [file('one-too-many.jpg', 'image/jpeg')]);
    assert.equal(imageCount(page), 50);
    assert.equal(urls.created.length, 50, 'no address for the refused image');
    assert.match(page.el('image-error').textContent, /at most 50 images in total/);
    assert.match(status(page), /at most 50 images/);
  });
});

test('Task 8: a good image shows a preview, its name, a text description, and can get a caption', async () => {
  await withOwn(() => {}, async (page, urls) => {
    gotoStep(page, 'inspiration');
    pick(page, [file('sunny.png')]);
    const img = walk(page.el('image-list')).find((n) => n.tagName === 'IMG');
    assert.equal(img.src, urls.created[0].url);
    assert.equal(img.alt, 'Inspiration image 1', 'no caption: the description names its number');
    assert.ok(walk(page.el('image-list')).some((n) => n.textContent === 'Image 1: sunny.png'), 'the name is shown');
    assert.match(status(page), /1 image added to whole project\. You now have 1 of 50 images\./);
    const caption = walk(page.el('image-list')).find((n) => n.tagName === 'INPUT');
    caption.value = '  Sunny kitchen ';
    caption.dispatch('change');
    assert.equal(img.alt, 'Sunny kitchen', 'the visitor\'s caption becomes the text description');
    const label = walk(page.el('image-list')).find((n) => n.tagName === 'LABEL');
    assert.equal(label.getAttribute('for'), caption.id, 'the caption box has a label');
    caption.value = 'x'.repeat(LIMITS.captionMax + 1);
    caption.dispatch('change');
    assert.equal(img.alt, 'Sunny kitchen', 'a too-long caption changes nothing');
    const captionError = walk(page.el('image-list')).find((n) => n.id === `caption-error-${caption.id.replace('caption-', '')}`);
    assert.match(captionError.textContent, /Keep the caption to 80 characters/);
    assert.ok(caption.getAttribute('aria-describedby').includes('caption-error-'));
    caption.value = '';
    caption.dispatch('change');
    assert.equal(img.alt, 'Inspiration image 1');
  });
});

// ---- Images: releasing preview addresses ----

test('Task 8: removing an image releases its preview address (and only that one)', async () => {
  await withOwn(() => {}, async (page, urls) => {
    gotoStep(page, 'inspiration');
    pick(page, [file('a.png'), file('b.png')]);
    assert.deepEqual(urls.created.map((c) => c.url), ['blob:test/1', 'blob:test/2']);
    assert.equal(urls.revoked.length, 0);
    imageButtons(page).find((b) => b.textContent === 'Remove image 1: a.png').click();
    assert.deepEqual(urls.revoked, ['blob:test/1']);
    assert.equal(imageCount(page), 1);
    assert.equal(status(page), 'Image removed: a.png.');
    assert.equal(page.document.activeElement, page.el('image-list-heading'), 'focus goes to the list heading');
  });
});

test('Task 8: "Start again" releases every preview address and clears everything entered', async () => {
  await withOwn(() => {}, async (page, urls) => {
    page.el('project-name').value = 'My home';
    page.el('project-name').dispatch('input');
    addFloorAndRooms(page, 'Ground floor', ['Kitchen']);
    gotoStep(page, 'inspiration');
    pick(page, [file('a.png'), file('b.png'), file('c.png')]);
    page.el('note-text').value = 'warm oak';
    page.el('add-note').click();
    // The visitor says no: nothing happens.
    globalThis.confirm = () => false;
    page.el('start-again').click();
    assert.equal(urls.revoked.length, 0);
    assert.equal(imageCount(page), 3);
    // The visitor says yes.
    let asked = '';
    globalThis.confirm = (text) => { asked = text; return true; };
    try { page.el('start-again').click(); } finally { delete globalThis.confirm; }
    assert.match(asked, /Everything you entered, including your images, will be cleared/);
    assert.deepEqual([...urls.revoked].sort(), ['blob:test/1', 'blob:test/2', 'blob:test/3']);
    assert.equal(page.el('screen-start').hidden, false);
    page.el('choose-own').click();
    assert.equal(page.el('project-name').value, '');
    assert.equal(page.el('list-empty').hidden, false, 'the setup list is empty again');
    gotoStep(page, 'inspiration');
    assert.equal(imageCount(page), 0);
    assert.deepEqual(noteTexts(page.el('note-list')), []);
  });
});

test('Task 8: removing a room or a floor releases the previews of its override images', async () => {
  await withOwn(() => {}, async (page, urls) => {
    addFloorAndRooms(page, 'Ground floor', ['Kitchen', 'Hall']);
    gotoStep(page, 'inspiration');
    page.el('image-target').value = optionValue(page.el('image-target'), 'Room: Kitchen');
    pick(page, [file('k1.png'), file('k2.png')]);
    page.el('image-target').value = optionValue(page.el('image-target'), 'Room: Hall');
    pick(page, [file('h1.png')]);
    assert.equal(urls.created.length, 3);
    page.el('back-button').click(); // to the setup screen
    const find = (text) => walk(page.el('floor-list')).find((n) => n.tagName === 'BUTTON' && n.textContent === text);
    find('Remove room Kitchen').click();
    assert.deepEqual([...urls.revoked].sort(), ['blob:test/1', 'blob:test/2']);
    find('Remove floor Ground floor').click();
    walk(page.el('floor-list')).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Yes, remove floor Ground floor').click();
    assert.deepEqual([...urls.revoked].sort(), ['blob:test/1', 'blob:test/2', 'blob:test/3']);
  });
});

// ---- Notes and room overrides ----

test('Task 8: notes can be added with the button or Enter, are shown as plain text, and can be removed', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'inspiration');
    assert.equal(page.el('note-empty').hidden, false);
    page.el('note-text').value = '  warm oak ';
    page.el('add-note').click();
    page.el('note-text').value = '<b>linen</b>';
    page.el('note-text').dispatch('keydown', { key: 'Enter' });
    assert.deepEqual(noteTexts(page.el('note-list')), ['warm oak', '<b>linen</b>']);
    assert.equal(walk(page.el('note-list')).filter((n) => n.tagName === 'B').length, 0);
    assert.equal(status(page), 'Note added: <b>linen</b>. You now have 2 of 30 notes here.');
    assert.equal(page.document.activeElement, page.el('note-text'));
    page.el('note-text').value = 'x'.repeat(LIMITS.noteMax + 1);
    page.el('add-note').click();
    assert.match(page.el('note-error').textContent, /Keep each note to 40 characters/);
    assert.ok(page.el('note-text').getAttribute('aria-describedby').split(' ').includes('note-error'));
    assert.deepEqual(noteTexts(page.el('note-list')), ['warm oak', '<b>linen</b>'], 'a refused note adds nothing');
    walk(page.el('note-list')).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Remove note warm oak').click();
    assert.deepEqual(noteTexts(page.el('note-list')), ['<b>linen</b>']);
    assert.equal(status(page), 'Note removed: warm oak.');
  });
});

test('Task 8: the "less to work with" sentence shows with no images and no notes, and goes away with the first note', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'inspiration');
    assert.equal(page.el('inspiration-less').hidden, false);
    assert.match(html, /id="inspiration-less"[^>]*>[^<]*less to work with/);
    page.el('note-text').value = 'linen';
    page.el('add-note').click();
    assert.equal(page.el('inspiration-less').hidden, true);
  });
});

test('Task 8: a room override is added, shown, and removed, and the room goes back to the overall inspiration', async () => {
  await withOwn(() => {}, async (page, urls) => {
    addFloorAndRooms(page, 'Ground floor', ['Kitchen', 'Hall']);
    gotoStep(page, 'overrides');
    const room = page.el('override-room');
    assert.deepEqual(walk(room).filter((n) => n.tagName === 'OPTION').map((n) => n.textContent), ['Kitchen', 'Hall']);
    assert.equal(page.el('override-no-rooms').hidden, true);
    assert.equal(page.el('override-state').textContent, 'Kitchen uses the overall inspiration.');
    assert.equal(page.el('remove-override').hidden, true);
    page.el('override-note-text').value = 'cold steel';
    page.el('add-override-note').click();
    assert.deepEqual(noteTexts(page.el('override-note-list')), ['cold steel']);
    assert.match(page.el('override-state').textContent, /^Kitchen uses its own notes \(1 note\), not the overall notes\./);
    assert.equal(page.el('remove-override').hidden, false);
    room.value = optionValue(room, 'Hall');
    room.dispatch('change');
    assert.deepEqual(noteTexts(page.el('override-note-list')), [], 'another room is not changed');
    assert.equal(page.el('override-state').textContent, 'Hall uses the overall inspiration.');
    room.value = optionValue(room, 'Kitchen');
    room.dispatch('change');
    // an image for the Kitchen, then remove the whole override
    page.el('back-button').click();
    page.el('image-target').value = optionValue(page.el('image-target'), 'Room: Kitchen');
    pick(page, [file('k.png')]);
    page.el('next-button').click();
    page.el('remove-override').click();
    assert.equal(page.el('override-state').textContent, 'Kitchen uses the overall inspiration.');
    assert.deepEqual(noteTexts(page.el('override-note-list')), []);
    assert.deepEqual(urls.revoked, ['blob:test/1'], 'its image preview was released');
    assert.match(status(page), /Override removed for Kitchen\. Kitchen uses the overall inspiration again\./);
  });
});

test('Task 8: with no rooms the override step says so, and a note is refused with a message', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'overrides');
    assert.equal(page.el('override-no-rooms').hidden, false);
    page.el('override-note-text').value = 'cold steel';
    page.el('add-override-note').click();
    assert.match(page.el('override-note-error').textContent, /Choose a room from your list first\./);
  });
});

test('Task 8: the room list on both steps matches the rooms entered in setup', async () => {
  await withOwn(() => {}, async (page) => {
    addFloorAndRooms(page, 'Ground floor', ['Kitchen']);
    gotoStep(page, 'inspiration');
    const options = () => walk(page.el('image-target')).filter((n) => n.tagName === 'OPTION').map((n) => n.textContent);
    assert.deepEqual(options(), ['Whole project', 'Room: Kitchen']);
    page.el('back-button').click();
    page.el('room-name').value = 'Hall';
    page.el('add-room').click();
    page.el('next-button').click();
    assert.deepEqual(options(), ['Whole project', 'Room: Kitchen', 'Room: Hall']);
  });
});

// ---- The Project Brain: a room override replaces the overall notes (uses Task 4) ----

test('Task 8: a room override replaces the overall notes in the built Project Brain, and other rooms keep the overall notes', async () => {
  const page = createFakePage();
  const restore = installFakePage(page);
  const urls = stubPreviewAddresses();
  try {
    const state = stateApi.createState();
    stateApi.setProjectName(state, 'Home');
    const floor = stateApi.addFloor(state, 'Ground floor').id;
    const kitchen = stateApi.addRoom(state, floor, 'Kitchen').id;
    stateApi.addRoom(state, floor, 'Hall');
    const hooks = [];
    setUpInspirationScreens({
      el: (id) => page.el(id),
      attempt: (_step, work) => work(),
      guarded: (_step, handler) => handler,
      announce() {},
      getState: () => state,
      api: stateApi,
      limits: LIMITS,
      releaseImages() {},
      onShow: (id, fn) => hooks.push([id, fn]),
    });
    page.el('note-text').value = 'warm oak';
    page.el('add-note').click();
    page.el('note-text').value = 'linen';
    page.el('add-note').click();
    page.el('override-room').value = kitchen;
    page.el('override-room').dispatch('change');
    page.el('override-note-text').value = 'cold steel';
    page.el('add-override-note').click();
    const project = buildBrain(state);
    const [kitchenId, hallId] = project.floors[0].rooms.map((r) => r.id);
    assert.deepEqual(getEffectiveInspiration(project, kitchenId), ['cold steel']);
    assert.deepEqual(getEffectiveInspiration(project, hallId), ['warm oak', 'linen']);
  } finally {
    urls.restore();
    restore();
  }
});

// ---- Privacy, leaving the page ----

test('Task 8: the privacy sentence is next to the picker, and the picker has a visible label and only accepts the three types', async () => {
  const sentence = 'Your images stay in this browser. They are not uploaded, not sent anywhere and not saved.';
  assert.ok(html.includes(sentence));
  const input = html.match(/<input type="file"[^>]*>/)[0];
  assert.match(input, /aria-describedby="image-privacy image-hint"/, 'the picker is tied to the sentence');
  assert.match(input, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /<label for="image-file">Choose images from your device<\/label>/);
  assert.ok(html.indexOf('id="image-privacy"') < html.indexOf('id="image-file"'), 'the sentence comes before the picker');
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'inspiration');
    assert.equal(page.el('image-privacy').hidden, false);
    assert.equal(page.el('screen-inspiration').hidden, false, 'the sentence is on a screen that is shown');
  });
});

test('Task 8: the warning before leaving the page is registered only once something has been entered', async () => {
  await withOwn(() => {}, async (page) => {
    const count = () => page.log.filter((l) => l === 'window-listener:beforeunload').length;
    assert.equal(count(), 0, 'nothing entered at the start');
    page.el('choose-own').click();
    gotoStep(page, 'inspiration');
    assert.equal(count(), 0, 'moving between screens is not an entry');
    page.el('note-text').value = '';
    page.el('add-note').click(); // refused: nothing entered
    assert.equal(count(), 0);
    page.el('note-text').value = 'warm oak';
    page.el('add-note').click();
    assert.equal(count(), 1);
    page.el('note-text').value = 'linen';
    page.el('add-note').click();
    assert.equal(count(), 1, 'registered once, not once per entry');
    let prevented = 0;
    const event = { preventDefault() { prevented += 1; }, returnValue: undefined };
    page.window.dispatch('beforeunload', event);
    assert.equal(prevented, 1);
    assert.equal(event.returnValue, '', 'the browser shows its own wording');
    // After "Start again" there is nothing to lose, so the page does not ask.
    globalThis.confirm = () => true;
    try { page.el('start-again').click(); } finally { delete globalThis.confirm; }
    page.window.dispatch('beforeunload', event);
    assert.equal(prevented, 1);
  });
});

// ---- A broken part never stops the others ----

test('Task 8: if the note box cannot be set up, the red message names it and the image picker, room notes and Next still work', async () => {
  await withOwn((p) => { p.failListenerOn = 'add-note'; }, async (page, urls) => {
    const lines = page.el('intake-error-message').children.map((c) => c.textContent);
    assert.equal(lines[0], 'Something went wrong on this page. Please take a screenshot of this red message.');
    assert.match(lines.join('\n'), /Step "Overall notes" failed: cannot attach a listener to add-note/);
    gotoStep(page, 'inspiration');
    pick(page, [file('a.png')]);
    assert.equal(imageCount(page), 1);
    assert.equal(urls.created.length, 1);
    page.el('next-button').click();
    assert.equal(page.el('screen-overrides').hidden, false);
    page.el('back-button').click();
    assert.equal(page.el('screen-inspiration').hidden, false);
  });
});

test('Task 8: if the image picker is missing from the page, the red message names it and the setup screen and Next still work', async () => {
  await withOwn((p) => { p.byId.delete('image-file'); }, async (page) => {
    assert.match(page.el('intake-error-message').children.map((c) => c.textContent).join('\n'), /Step "Image picker" failed/);
    page.el('floor-name').value = 'Ground floor';
    page.el('add-floor').click();
    assert.ok(walk(page.el('floor-list')).some((n) => n._text === 'Ground floor'));
    page.el('next-button').click();
    assert.equal(page.el('screen-inspiration').hidden, false);
  });
});

// ---- No outside calls, no storage, no reading of image contents ----

const NEW_FILES = ['screens.js', 'inspiration-screen.js'];

test('Task 8: no fetch, storage, cookie, web address or page-code insertion in the new files', () => {
  for (const name of NEW_FILES) {
    const code = readDoc(`intake/${name}`);
    for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
      'http://', 'https://', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(']) {
      assert.ok(!code.includes(banned), `${name} uses ${banned}`);
    }
  }
});

test('Task 8: no code reads image contents or sends them anywhere; only a temporary preview address is used, released on remove and on Start again', () => {
  const sources = readdirSync(new URL('../docs/intake/', import.meta.url)).filter((n) => n.endsWith('.js'));
  assert.ok(sources.includes('inspiration-screen.js'));
  for (const name of sources) {
    const code = readDoc(`intake/${name}`);
    for (const banned of ['FileReader', 'readAsDataURL', 'readAsArrayBuffer', 'readAsText', 'readAsBinaryString', '.arrayBuffer(', '.text()', '.stream(',
      '.slice(', 'createImageBitmap', 'new Image(', 'drawImage', 'getImageData', 'toDataURL', 'toBlob', 'FormData', 'new Blob', 'postMessage', 'navigator.']) {
      // .slice( is common for plain lists, so for it only a call on a file or an image is banned.
      if (banned === '.slice(') { assert.doesNotMatch(code, /\b(file|files|image|picture)\.slice\(/, `${name} slices a file`); continue; }
      assert.ok(!code.includes(banned), `${name} uses ${banned}`);
    }
  }
  const inspiration = readDoc('intake/inspiration-screen.js');
  assert.equal((inspiration.match(/URL\.createObjectURL\(/g) || []).length, 1, 'one place makes preview addresses');
  assert.doesNotMatch(inspiration, /URL\.revokeObjectURL/, 'releasing is done in one place, screens.js');
  const screens = readDoc('intake/screens.js');
  assert.equal((screens.match(/URL\.revokeObjectURL\(/g) || []).length, 1, 'one place releases preview addresses');
  // The file object is only handed to createObjectURL. Its name, type and size are the only things copied.
  assert.match(inspiration, /const record = \{ name: file && file\.name, type: file && file\.type, size: file && file\.size \};/);
  assert.match(inspiration, /image\.previewUrl = URL\.createObjectURL\(file\);/);
  // The images are never part of what is given to the Project Brain.
  assert.doesNotMatch(readDoc('intake/build-brain.js'), /previewUrl|\.files\b/);
});

// ---- Labels and keyboard ----

test('Task 8: every control on the inspiration screens has a visible label, and every action is a real button or box', () => {
  for (const id of ['inspiration', 'overrides']) {
    const start = html.indexOf(`<div id="screen-${id}"`);
    const end = html.indexOf('<div id="screen-', start + 10);
    const block = html.slice(start, end);
    const controls = [...block.matchAll(/<(input|select|textarea)\b[^>]*\sid="([^"]+)"/g)].map((m) => m[2]);
    assert.ok(controls.length >= 2, `${id} has controls`);
    for (const control of controls) {
      assert.match(block, new RegExp(`<label for="${control}">[^<]+</label>`), `${control} has a visible label`);
    }
    assert.doesNotMatch(block, /placeholder=|tabindex="[1-9]/);
    for (const button of block.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)) assert.ok(button[1].trim().length > 3, 'buttons have words');
    assert.equal((block.match(/<h1\b/g) || []).length, 1);
  }
});

test('Task 8: the "Start again" button is in the step buttons, labelled, and the stylesheet lets the buttons wrap on a narrow screen', () => {
  assert.match(html, /<button type="button" id="start-again" class="nav-button">Start again<\/button>/);
  assert.match(readStyles(), /\.step-nav \{[^}]*flex-wrap: wrap;/);
});
