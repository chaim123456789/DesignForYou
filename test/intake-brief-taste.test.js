// Intake Task 9: the brief screen and the taste screen (six questions and the live style profile).
//
// These tests run the REAL docs/intake/screens.js, brief-screen.js and taste-screen.js, with the real
// state.js, limits.js and taste.js, on the stand-in page built from the REAL docs/index.html (test-helpers/).
// What this CANNOT show: how the screens look, 320 px layout, a real keyboard (arrow keys inside a group
// of choices), real screen-reader behaviour. Those are "pending owner check".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakePage, installFakePage, waitFor, readDoc } from '../test-helpers/fake-page.js';
import { LIMITS } from '../docs/intake/limits.js';
import * as stateApi from '../docs/intake/state.js';
import * as taste from '../docs/intake/taste.js';
import { buildBrain } from '../docs/intake/build-brain.js';
import { getEffectiveInspiration } from '../src/brain/inspiration.js';
import { setUpTasteScreen } from '../docs/intake/taste-screen.js';
import { setUpBriefScreen } from '../docs/intake/brief-screen.js';

const html = readDoc('index.html');
const { QUESTIONS } = taste;

let caseNumber = 0;

async function openOwn(configure = () => {}) {
  const page = createFakePage();
  configure(page);
  const restore = installFakePage(page);
  caseNumber += 1;
  await import(`../docs/intake/screens.js?case=brief-taste-${caseNumber}`);
  await waitFor(() => page.el('intake-script-status').textContent.includes('finished'), 'the screens script to finish');
  page.el('choose-own').click();
  return { page, restore };
}
async function withOwn(configure, body) {
  const { page, restore } = await openOwn(configure);
  try { await body(page); } finally { restore(); }
}

const walk = (node, out = []) => { out.push(node); node.children.forEach((c) => walk(c, out)); return out; };
const status = (page) => page.el('action-status').textContent;
function gotoStep(page, id) {
  for (let i = 0; i < 10 && page.el(`screen-${id}`).hidden; i += 1) page.el('next-button').click();
  assert.equal(page.el(`screen-${id}`).hidden, false, `reached ${id}`);
}
const radio = (page, questionId, answerId) => {
  const found = walk(page.el('taste-questions')).find((n) => n.id === `taste-${questionId}-${answerId}`);
  assert.ok(found, `radio ${questionId}/${answerId} exists`);
  return found;
};
function answer(page, questionId, answerId) {
  const r = radio(page, questionId, answerId);
  r.checked = true;
  r.dispatch('change');
}
const tagButtons = (page) => walk(page.el('profile-tags')).filter((n) => n.tagName === 'BUTTON');
const sentences = (page) => page.el('profile-sentences').children.map((c) => c.textContent);
const tagNames = (page) => walk(page.el('profile-tags')).filter((n) => n.className === 'entry-name').map((n) => n.textContent);

// ---- The brief ----

test('Task 9: the brief stops at 2000 characters, says so, and shows the count', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'brief');
    const box = page.el('brief-text');
    assert.equal(page.el('brief-count').textContent, '0 of 2000 characters.');
    assert.equal(box.getAttribute('maxlength'), '2000', 'a real browser stops typing at the limit');
    box.value = 'A calm home.';
    box.dispatch('input');
    assert.equal(page.el('brief-count').textContent, '12 of 2000 characters.');
    assert.equal(page.el('brief-notice').hidden, true);
    box.value = 'x'.repeat(2500); // for example a long paste
    box.dispatch('input');
    assert.equal(box.value.length, LIMITS.briefMax, 'the extra text is cut off');
    assert.equal(page.el('brief-count').textContent, '2000 of 2000 characters. That is the most you can write.');
    assert.equal(page.el('brief-notice').hidden, false);
    assert.match(page.el('brief-notice').textContent, /stops at 2000 characters\. The extra text was cut off\./);
    assert.ok(box.getAttribute('aria-describedby').split(' ').includes('brief-notice'), 'the message is tied to the box');
    box.value = 'x'.repeat(1999);
    box.dispatch('input');
    assert.equal(page.el('brief-notice').hidden, true, 'the message goes away when the brief is short again');
    assert.equal(box.getAttribute('aria-describedby'), 'brief-what brief-count');
  });
});

test('Task 9: the brief box has a visible label, the plain sentence about what happens to the brief, and is optional', () => {
  assert.match(html, /<label for="brief-text">Your brief<\/label>/);
  assert.match(html, /<textarea id="brief-text"[^>]*aria-describedby="brief-what brief-count"/);
  assert.match(html, /id="brief-what"[^>]*>Your brief is kept with your project and shown in the summary\. The design team does not read it\.</);
  assert.match(html, /id="brief-intro">[^<]*This step is optional\./);
  assert.doesNotMatch(html, /placeholder=/);
});

test('Task 9: the brief goes into the Project Brain as typed (kept, not read), and typing it registers the warning before leaving', async () => {
  await withOwn(() => {}, async (page) => {
    const count = () => page.log.filter((l) => l === 'window-listener:beforeunload').length;
    gotoStep(page, 'brief');
    assert.equal(count(), 0);
    page.el('brief-text').value = '<b>Calm</b> and bright';
    page.el('brief-text').dispatch('input');
    assert.equal(count(), 1);
  });
  // The same code against a state we can look at.
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    const state = stateApi.createState();
    stateApi.setProjectName(state, 'Home');
    stateApi.addRoom(state, stateApi.addFloor(state, 'Ground').id, 'Kitchen');
    setUpBriefScreen({ el: (id) => page.el(id), attempt: (_s, work) => work(), guarded: (_s, h) => h, getState: () => state, api: stateApi, limits: LIMITS, entriesChanged() {}, onShow() {} });
    page.el('brief-text').value = '<b>Calm</b> and bright';
    page.el('brief-text').dispatch('input');
    assert.equal(state.brief, '<b>Calm</b> and bright');
    assert.equal(buildBrain(state).brief, '<b>Calm</b> and bright');
  } finally { restore(); }
});

// ---- The six questions ----

test('Task 9: every question is a fieldset with a legend and 2 or 3 radio choices, each with a label, and none is selected at the start', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'taste');
    const groups = page.el('taste-questions').children;
    assert.equal(groups.length, 6);
    assert.equal(QUESTIONS.length, 6);
    groups.forEach((group, i) => {
      assert.equal(group.tagName, 'FIELDSET');
      const legends = group.children.filter((c) => c.tagName === 'LEGEND');
      assert.equal(legends.length, 1);
      assert.equal(legends[0].textContent, QUESTIONS[i].label);
      assert.equal(group.children[0], legends[0], 'the legend comes first');
      const rows = walk(group);
      const radios = rows.filter((n) => n.tagName === 'INPUT');
      assert.ok(radios.length === 2 || radios.length === 3, `question ${i + 1} has 2 or 3 choices`);
      assert.equal(radios.length, QUESTIONS[i].answers.length);
      for (const r of radios) {
        assert.equal(r.getAttribute('type'), 'radio');
        assert.equal(r.getAttribute('name'), `taste-${QUESTIONS[i].id}`, 'the choices of one question share a name, so one answer per question');
        assert.equal(r.checked, false, 'none selected at the start');
        const label = rows.find((n) => n.tagName === 'LABEL' && n.getAttribute('for') === r.id);
        assert.ok(label, 'the choice has a label');
        assert.ok(label.textContent.length > 0, 'the label has words');
      }
    });
    assert.equal(walk(page.el('taste-questions')).filter((n) => n.tagName === 'INPUT' && n.checked).length, 0);
  });
});

test('Task 9: with no answers the page says "No style profile yet" and shows no sentences or tags', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'taste');
    assert.equal(page.el('profile-message').textContent, 'No style profile yet');
    assert.equal(page.el('profile-message').hidden, false);
    assert.deepEqual(sentences(page), []);
    assert.deepEqual(tagNames(page), []);
    assert.equal(page.el('restore-tags').hidden, true);
  });
});

test('Task 9: the profile text and tags update after each answer, and when an answer changes', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'taste');
    answer(page, 'light', 'light');
    assert.equal(page.el('profile-message').hidden, true);
    assert.deepEqual(sentences(page), ['You like light rooms.', 'In short: light.']);
    assert.deepEqual(tagNames(page), ['light']);
    assert.equal(status(page), 'Style profile updated: light.');
    answer(page, 'temperature', 'cool');
    assert.deepEqual(tagNames(page), ['light', 'cool']);
    assert.deepEqual(sentences(page), ['You like light rooms.', 'You like a cool feel.', 'In short: light, cool.']);
    answer(page, 'light', 'dark'); // changing an answer replaces it
    assert.deepEqual(tagNames(page), ['dark', 'cool']);
    assert.deepEqual(sentences(page).slice(0, 1), ['You like dark rooms.']);
    // the same answers give the same profile as taste.js (the rules, not the page, decide)
    assert.deepEqual(sentences(page), taste.buildProfile({ light: 'dark', temperature: 'cool' }, []).sentences);
    assert.match(readDoc('index.html'), /id="profile-note"[^>]*>When you run the design team, these tags are added to your overall inspiration\./);
  });
});

test('Task 9: a removed tag disappears from the profile, can be put back, and comes back when its question is answered again', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'taste');
    answer(page, 'light', 'light');
    answer(page, 'temperature', 'warm');
    assert.deepEqual(tagButtons(page).map((b) => b.textContent), ['Remove tag light', 'Remove tag warm']);
    tagButtons(page).find((b) => b.textContent === 'Remove tag light').click();
    assert.deepEqual(tagNames(page), ['warm']);
    assert.deepEqual(sentences(page), ['You like a warm feel.', 'In short: warm.']);
    assert.equal(status(page), 'Tag removed: light. It will not be used.');
    assert.equal(page.document.activeElement, page.el('profile-heading'), 'focus goes to the profile heading');
    assert.equal(page.el('restore-tags').hidden, false);
    page.el('restore-tags').click();
    assert.deepEqual(tagNames(page), ['light', 'warm']);
    assert.equal(page.el('restore-tags').hidden, true);
    // remove both: no profile again
    for (const b of tagButtons(page)) b.click();
    assert.equal(tagNames(page).length, 0, 'removing every tag leaves no profile');
    assert.equal(page.el('profile-message').textContent, 'No style profile yet');
    answer(page, 'light', 'dark');
    assert.deepEqual(tagNames(page), ['dark'], 'a new answer for a question brings its tag back');
  });
});

test('Task 9: a removed tag is not in the Project Brain, and the tags that stay are added to the overall inspiration', async () => {
  const page = createFakePage();
  const restore = installFakePage(page);
  try {
    const state = stateApi.createState();
    stateApi.setProjectName(state, 'Home');
    stateApi.addRoom(state, stateApi.addFloor(state, 'Ground').id, 'Kitchen');
    stateApi.addNote(state, 'overall', 'linen');
    setUpTasteScreen({ el: (id) => page.el(id), attempt: (_s, work) => work(), guarded: (_s, h) => h, announce() {}, getState: () => state, taste, onShow() {} });
    answer(page, 'light', 'light');
    answer(page, 'temperature', 'warm');
    answer(page, 'mood', 'calm');
    const room = (project) => project.floors[0].rooms[0].id;
    let project = buildBrain(state);
    assert.deepEqual(getEffectiveInspiration(project, room(project)), ['linen', 'light', 'warm', 'calm']);
    tagButtons(page).find((b) => b.textContent === 'Remove tag warm').click();
    project = buildBrain(state);
    assert.deepEqual(getEffectiveInspiration(project, room(project)), ['linen', 'light', 'calm'], 'the removed tag is gone');
    assert.ok(!project.styleProfile.join(' ').includes('warm'), 'and not in the profile sentences kept with the project');
    assert.deepEqual(project.styleProfile, taste.buildProfile(state.tasteAnswers, state.removedTags).sentences);
  } finally { restore(); }
});

test('Task 9: "Start again" empties the brief, the answers and the profile', async () => {
  await withOwn(() => {}, async (page) => {
    gotoStep(page, 'brief');
    page.el('brief-text').value = 'My brief';
    page.el('brief-text').dispatch('input');
    gotoStep(page, 'taste');
    answer(page, 'light', 'light');
    globalThis.confirm = () => true;
    try { page.el('start-again').click(); } finally { delete globalThis.confirm; }
    page.el('choose-own').click();
    gotoStep(page, 'brief');
    assert.equal(page.el('brief-text').value, '');
    assert.equal(page.el('brief-count').textContent, '0 of 2000 characters.');
    gotoStep(page, 'taste');
    assert.equal(walk(page.el('taste-questions')).filter((n) => n.tagName === 'INPUT' && n.checked).length, 0);
    assert.equal(page.el('profile-message').textContent, 'No style profile yet');
  });
});

// ---- A broken part never stops the others ----

test('Task 9: if the brief box cannot be set up, the red message names it and the taste questions, the notes and Next still work', async () => {
  await withOwn((p) => { p.failListenerOn = 'brief-text'; }, async (page) => {
    const lines = page.el('intake-error-message').children.map((c) => c.textContent);
    assert.equal(lines[0], 'Something went wrong on this page. Please take a screenshot of this red message.');
    assert.match(lines.join('\n'), /Step "Brief box" failed: cannot attach a listener to brief-text/);
    gotoStep(page, 'taste');
    answer(page, 'light', 'light');
    assert.deepEqual(tagNames(page), ['light']);
    page.el('back-button').click();
    assert.equal(page.el('screen-brief').hidden, false);
  });
});

test('Task 9: if the "Put back removed tags" button cannot be set up, the red message names it and the questions, tags and brief still work', async () => {
  await withOwn((p) => { p.failListenerOn = 'restore-tags'; }, async (page) => {
    assert.match(page.el('intake-error-message').children.map((c) => c.textContent).join('\n'), /Step "Put back removed tags button" failed/);
    gotoStep(page, 'taste');
    answer(page, 'light', 'light');
    tagButtons(page)[0].click();
    assert.deepEqual(tagNames(page), []);
    page.el('next-button').click();
    assert.equal(page.el('screen-items').hidden, false);
    page.el('back-button').click();
    page.el('back-button').click();
    page.el('brief-text').value = 'ok';
    page.el('brief-text').dispatch('input');
    assert.equal(page.el('brief-count').textContent, '2 of 2000 characters.');
  });
});

test('Task 9: if the questions cannot be drawn, the red message names the step and the brief and the other screens still work', async () => {
  await withOwn((p) => { p.failCreate = ['fieldset']; }, async (page) => {
    assert.match(page.el('intake-error-message').children.map((c) => c.textContent).join('\n'), /Step "Taste questions" failed: cannot create a <fieldset> element/);
    gotoStep(page, 'brief');
    page.el('brief-text').value = 'ok';
    page.el('brief-text').dispatch('input');
    assert.equal(page.el('brief-count').textContent, '2 of 2000 characters.');
  });
});

// ---- Labels, keyboard, plain text ----

test('Task 9: the screens are not placeholders any more, have one heading each, and use only native controls with labels', () => {
  for (const id of ['brief', 'taste']) {
    const start = html.indexOf(`<div id="screen-${id}"`);
    const block = html.slice(start, html.indexOf('<div id="screen-', start + 10));
    assert.doesNotMatch(block, /not built yet/);
    assert.equal((block.match(/<h1\b/g) || []).length, 1);
    assert.doesNotMatch(block, /tabindex="[1-9]|placeholder=|<form/);
    for (const m of block.matchAll(/<(input|select|textarea)\b[^>]*\sid="([^"]+)"/g)) {
      assert.match(block, new RegExp(`<label for="${m[2]}">[^<]+</label>`));
    }
  }
  const code = readDoc('intake/taste-screen.js');
  assert.match(code, /label\.setAttribute\('for', id\)/, 'each choice is tied to its label');
});

test('Task 9: no fetch, storage, cookie, web address or page-code insertion in the new files, and the visitor\'s text is only shown as text', () => {
  for (const name of ['brief-screen.js', 'taste-screen.js', 'screens.js']) {
    const code = readDoc(`intake/${name}`);
    for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
      'http://', 'https://', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(']) {
      assert.ok(!code.includes(banned), `${name} uses ${banned}`);
    }
  }
});

test('Task 9: the stylesheet gives the choices and the brief box room: choices at least 44 px high, no fixed pixel widths', () => {
  const css = readDoc('styles.css');
  const part = css.slice(css.indexOf('/* ---- Brief and taste screens'));
  assert.match(part, /\.choice-label \{[^}]*min-height: 2\.75rem;/);
  assert.match(part, /\.brief-input \{[^}]*min-height: 11rem;/);
  assert.doesNotMatch(part, /(?<![-\w])width: \d+px/);
  for (const m of part.matchAll(/font-size: ([\d.]+)(rem|px)/g)) assert.ok((m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])) >= 16);
});
