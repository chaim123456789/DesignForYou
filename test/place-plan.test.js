// Place Task 11: the plan (a top-down drawing of the chosen room) and the click handler.
//
// These tests run the REAL docs/intake/screens.js, place-screen.js and place-plan.js on the stand-in
// page built from the REAL docs/index.html. The stand-in has no layout, so a click is a made-up event
// with clientX and clientY, and the drawing's size is set by the test.
// What this CANNOT show: real mouse, real touch, how the plan looks, 320 px layout.
// Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakePage, installFakePage, waitFor } from '../test-helpers/fake-page.js';
import { SVG_NS, PLAN_STYLES, planLabel, planAriaLabel } from '../docs/intake/place-plan.js';

let caseNumber = 0;
async function withOwn(body) {
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    caseNumber += 1;
    await import(`../docs/intake/screens.js?case=place-plan-${caseNumber}`);
    await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
    page.el('choose-own').click();
    await body(page);
  } finally { restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const status = (page) => page.el('action-status').textContent;
const listText = (page) => page.el('place-list').textContent;
const svgOf = (page) => {
  const svg = page.el('place-plan').children[0];
  assert.ok(svg, 'the plan has been drawn');
  assert.equal(svg.tagName, 'SVG');
  return svg;
};
const objectRects = (page) => walk(svgOf(page)).filter((n) => n.tagName === 'RECT' && (n.getAttribute('class') || '').includes('plan-object '));
const labels = (page) => walk(svgOf(page)).filter((n) => n.tagName === 'TEXT').map((n) => n.textContent);

const buttonNamed = (page, text) => {
  const found = walk(page.el('place-list')).find((n) => n.tagName === 'BUTTON' && n.textContent === text);
  assert.ok(found, `a button called "${text}" exists in the list`);
  return found;
};

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
function chooseRoom(page, name) {
  const option = page.el('place-room').children.find((o) => o.textContent === name);
  page.el('place-room').value = option.value;
  page.el('place-room').dispatch('change');
}
function addObject(page, { type = 'sofa', name, itemStatus = 'Locked', x = '100', y = '300' } = {}) {
  page.el('place-type').value = type;
  page.el('place-type').dispatch('change');
  if (name !== undefined) page.el('place-name').value = name;
  page.el('place-status-locked').checked = itemStatus === 'Locked';
  page.el('place-status-unsure').checked = itemStatus === 'Unsure';
  page.el('place-x').value = x;
  page.el('place-y').value = y;
  page.el('add-placed').click();
}
async function onPlaceScreen(page) {
  setUp(page);
  gotoStep(page, 'place');
  chooseRoom(page, 'Kitchen');
}
// Make the stand-in drawing as big as the room's view box (460 by 460 for a 4 m by 4 m room), so one
// pixel is one centimetre and the view box starts 30 cm left of and above the room's corner.
function sizeThePlan(page, { width = 460, height = 460, left = 0, top = 0 } = {}) {
  svgOf(page).getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height });
}
const click = (page, clientX, clientY) => svgOf(page).dispatch('click', { clientX, clientY });

// ---- Drawing ------------------------------------------------------------------------------------

test('Place Task 11: the plan is an inline drawing with a view box, a text alternative, one rectangle per object and a room outline', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    assert.equal(page.el('place-plan-panel').hidden, false);
    const empty = svgOf(page);
    assert.equal(empty.namespace, SVG_NS, 'drawn with the drawing namespace');
    assert.equal(empty.getAttribute('viewBox'), '-30 -30 460 460');
    assert.equal(empty.getAttribute('role'), 'img');
    assert.equal(empty.getAttribute('aria-label'), 'Plan of the Kitchen, 4.0 m by 4.0 m, with 0 objects. The list below has the same information.');
    assert.equal(objectRects(page).length, 0);
    addObject(page);
    addObject(page, { type: 'bed', name: 'Bed', itemStatus: 'Unsure', x: '0', y: '0' });
    addObject(page, { type: 'door', itemStatus: 'Locked', x: '50', y: '0' });
    assert.equal(objectRects(page).length, 3, 'one rectangle per object in the room');
    assert.equal(svgOf(page).getAttribute('aria-label'), 'Plan of the Kitchen, 4.0 m by 4.0 m, with 3 objects. The list below has the same information.');
    const room = walk(svgOf(page)).find((n) => (n.getAttribute('class') || '') === 'plan-room');
    assert.deepEqual([room.getAttribute('x'), room.getAttribute('y'), room.getAttribute('width'), room.getAttribute('height')], ['0', '0', '400', '400']);
    // Only the Kitchen's objects are drawn; the Bedroom's plan is empty.
    chooseRoom(page, 'Bedroom');
    assert.equal(objectRects(page).length, 0);
    assert.match(svgOf(page).getAttribute('aria-label'), /^Plan of the Bedroom, 4\.0 m by 4\.0 m, with 0 objects\./);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
  });
});

test('Place Task 11: each rectangle sits at the object\'s position and size', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { x: '100', y: '300' });
    const [rect] = objectRects(page);
    assert.deepEqual(
      ['x', 'y', 'width', 'height'].map((a) => rect.getAttribute(a)),
      ['100', '300', '200', '90'],
    );
    page.el('nudge-right').click();
    assert.equal(objectRects(page)[0].getAttribute('x'), '110', 'the plan is redrawn from the state');
    page.el('sel-turn').click();
    const turned = objectRects(page)[0];
    assert.deepEqual(['width', 'height'].map((a) => turned.getAttribute(a)), ['90', '200']);
  });
});

test('Place Task 11: Locked and Unsure differ by outline style and words, not by colour alone', async () => {
  assert.notEqual(PLAN_STYLES.Locked.dash, PLAN_STYLES.Unsure.dash);
  assert.equal(PLAN_STYLES.Locked.dash, 'none', 'Locked is a solid line');
  assert.match(PLAN_STYLES.Unsure.dash, /^\d+ \d+$/, 'Unsure is dashed');
  assert.ok(PLAN_STYLES.Locked.strokeWidth > PLAN_STYLES.Unsure.strokeWidth, 'Locked is thicker');
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { name: 'Locked sofa', itemStatus: 'Locked', x: '0', y: '100' });
    addObject(page, { type: 'table', name: 'Open table', itemStatus: 'Unsure', x: '200', y: '100' });
    const [locked, unsure] = objectRects(page);
    assert.equal(locked.getAttribute('stroke-dasharray'), 'none');
    assert.equal(unsure.getAttribute('stroke-dasharray'), PLAN_STYLES.Unsure.dash);
    assert.notEqual(locked.getAttribute('stroke-width'), unsure.getAttribute('stroke-width'));
    assert.match(locked.getAttribute('class'), /plan-locked/);
    assert.match(unsure.getAttribute('class'), /plan-unsure/);
    // The words say it too.
    assert.ok(labels(page).includes('Locked sofa, Locked'));
    assert.ok(labels(page).some((t) => t.startsWith('Open table, Unsure')));
  });
});

test('Place Task 11: the label text is the name and the status, and the selected object says so', async () => {
  assert.equal(planLabel({ name: 'Sofa', status: 'Locked' }, false), 'Sofa, Locked');
  assert.equal(planLabel({ name: 'Sofa', status: 'Unsure' }, true), 'Sofa, Unsure, selected');
  assert.equal(planAriaLabel({ name: 'Kitchen', width: 5, depth: 4 }, 1), 'Plan of the Kitchen, 5.0 m by 4.0 m, with 1 object. The list below has the same information.');
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { name: 'Sofa', itemStatus: 'Locked' });
    addObject(page, { type: 'bed', name: 'Bed', itemStatus: 'Unsure', x: '0', y: '0' });
    assert.deepEqual(labels(page), ['Sofa, Locked', 'Bed, Unsure, selected']);
    const selectedOutlines = walk(svgOf(page)).filter((n) => (n.getAttribute('class') || '') === 'plan-selected');
    assert.equal(selectedOutlines.length, 1, 'exactly one outline marks the selected object');
  });
});

test('Place Task 11: a name with page code in it is shown as plain text only', async () => {
  const source = readFileSync(new URL('../docs/intake/place-plan.js', import.meta.url), 'utf8');
  for (const word of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'localStorage', 'fetch(', 'XMLHttpRequest', '.style']) {
    assert.ok(!source.includes(word), `place-plan.js must not contain ${word}`);
  }
  assert.ok(!/^\s*import\s/m.test(source), 'place-plan.js imports nothing');
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    const sneaky = '<script>alert(1)</script>';
    addObject(page, { name: sneaky });
    assert.deepEqual(labels(page), [`${sneaky}, Locked, selected`]);
    assert.equal(walk(svgOf(page)).some((n) => n.tagName === 'SCRIPT'), false);
  });
});

// ---- The click handler ----------------------------------------------------------------------------

test('Place Task 11: a click on the plan moves the selected object\'s top-left corner, rounded to 10 cm, and the list follows', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { x: '0', y: '0' });
    sizeThePlan(page);
    click(page, 30 + 153, 30 + 247); // 153 cm, 247 cm in the room
    assert.ok(listText(page).includes('Sofa (sofa), Locked. 150 cm from the left, 250 cm from the top, 200 cm wide, 90 cm deep'), listText(page));
    assert.equal(status(page), 'Sofa moved to 150 cm from the left and 250 cm from the top.');
    assert.equal(objectRects(page)[0].getAttribute('x'), '150');
    assert.equal(objectRects(page)[0].getAttribute('y'), '250');
    assert.equal(page.el('sel-x').value, '150', 'the number boxes follow');
    assert.equal(page.el('place-plan-message').hidden, true);
    assert.deepEqual(page.problemLines(), []);
    assert.equal(page.el('intake-error-message').hidden, true);
  });
});

test('Place Task 11: a click that puts the object partly outside the room still works, and says it sticks out', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { x: '0', y: '0' });
    sizeThePlan(page);
    click(page, 30 + 380, 30 + 380);
    assert.ok(listText(page).includes('380 cm from the left, 380 cm from the top'));
    assert.ok(listText(page).includes('Sticks out of the room.'));
    assert.equal(status(page), 'Sofa moved to 380 cm from the left and 380 cm from the top. It sticks out of the room.');
  });
});

test('Place Task 11: with nothing selected a click says "Select an object first." and changes nothing', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page, { x: '100', y: '300' });
    chooseRoom(page, 'Bedroom');
    chooseRoom(page, 'Kitchen'); // changing room clears the selection
    assert.equal(page.el('place-selected-panel').hidden, true);
    const before = listText(page);
    sizeThePlan(page);
    click(page, 200, 200);
    assert.equal(page.el('place-plan-message').hidden, false);
    assert.equal(page.el('place-plan-message').textContent, 'Select an object first.');
    assert.equal(status(page), 'Select an object first.');
    assert.equal(svgOf(page).getAttribute('aria-describedby'), 'place-plan-message');
    assert.equal(listText(page), before, 'nothing moved');
    // Selecting an object and clicking again works, and the message goes away.
    buttonNamed(page, 'Select Sofa').click();
    sizeThePlan(page);
    click(page, 30 + 200, 30 + 200);
    assert.ok(listText(page).includes('200 cm from the left, 200 cm from the top'));
    assert.equal(page.el('place-plan-message').hidden, true);
  });
});

test('Place Task 11: a click with a plan that has no size on screen changes nothing', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    const before = listText(page);
    svgOf(page).getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    click(page, 50, 50);
    assert.equal(listText(page), before);
  });
});

// ---- The list and the plan always agree -----------------------------------------------------------

test('Place Task 11: the list and the plan always show the same objects, after every kind of change', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    const sameObjects = (why) => {
      const entries = page.el('place-list').children.map((li) => li.textContent);
      const rects = objectRects(page);
      assert.equal(rects.length, entries.length, `${why}: same count`);
      const shown = labels(page).map((t) => t.split(', ')[0]);
      for (const name of shown) assert.ok(entries.some((e) => e.includes(name)), `${why}: ${name} is in the list`);
      for (const li of page.el('place-list').children) {
        const name = li.textContent.split(' (')[0].replace(/^Selected\. /, '');
        assert.ok(shown.includes(name), `${why}: ${name} is on the plan`);
      }
    };
    sameObjects('start');
    addObject(page, { name: 'Sofa' });
    sameObjects('after adding a sofa');
    addObject(page, { type: 'door', name: 'Front door', x: '50', y: '0' });
    sameObjects('after adding a door');
    addObject(page, { type: 'window', name: 'Side window', itemStatus: 'Unsure', x: '200', y: '0' });
    sameObjects('after adding a window');
    page.el('sel-wall').value = 'Bottom';
    page.el('sel-wall').dispatch('change');
    sameObjects('after the wall');
    page.el('sel-status').click();
    sameObjects('after the status');
    page.el('sel-name').value = 'Garden window';
    page.el('sel-save').click();
    sameObjects('after renaming');
    assert.ok(labels(page).some((t) => t.startsWith('Garden window, ')));
    buttonNamed(page, 'Remove Sofa').click();
    sameObjects('after removing the sofa');
    assert.equal(objectRects(page).length, 2);
    chooseRoom(page, 'Bedroom');
    sameObjects('in the Bedroom');
    assert.equal(objectRects(page).length, 0);
  });
});

test('Place Task 11: the plan panel is hidden until a room is chosen and has no tab stop of its own', async () => {
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  const panel = html.slice(html.indexOf('<div id="place-plan-panel"'), html.indexOf('<div id="place-list-panel"'));
  assert.doesNotMatch(panel, /<(input|select|button|textarea|a)\b/, 'no control inside the plan panel');
  assert.doesNotMatch(panel, /tabindex="0"|tabindex="[1-9]/);
  assert.match(panel, /Click or tap the plan to put the selected object's top-left corner there\. You can also use the number boxes and buttons\./);
  await withOwn(async (page) => {
    setUp(page);
    gotoStep(page, 'place');
    assert.equal(page.el('place-plan-panel').hidden, true);
    chooseRoom(page, 'Kitchen');
    assert.equal(page.el('place-plan-panel').hidden, false);
  });
});

test('Place Task 11: if the plan cannot be drawn, the red message appears and the list and buttons still work', async () => {
  await withOwn(async (page) => {
    await onPlaceScreen(page);
    addObject(page);
    page.failCreate.push('svg');
    page.el('nudge-down').click();
    assert.equal(page.el('intake-error-message').hidden, false);
    assert.ok(page.el('intake-error-message').textContent.includes('Drawing the plan'));
    assert.ok(listText(page).includes('300 cm from the left') === false);
    assert.ok(listText(page).includes('100 cm from the left, 310 cm from the top'), 'the nudge and the list still work');
    page.el('back-button').click();
    assert.equal(page.el('screen-items').hidden, false, 'the other screens still work');
  });
});
