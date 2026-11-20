// The taste screen: six questions (each a group of radio choices with a legend), and the live style
// profile with tags that can be removed.
//
// This file imports nothing. screens.js loads state.js, limits.js and taste.js (with the page's cache
// tag) and hands them in. The profile is made by fixed rules from the answers only (taste.js): the
// same answers always give the same profile. No AI, no randomness. Nothing is stored or sent.
// Everything is put on the page with textContent.
//
// Every part is set up in its own protected step (attempt and guarded come from screens.js).

export function setUpTasteScreen(tools) {
  const { el, attempt, guarded, announce, getState, taste, onShow } = tools;
  const { QUESTIONS, buildProfile } = taste;

  const refs = {};
  for (const id of ['taste-questions', 'profile-heading', 'profile-message', 'profile-sentences', 'profile-tags', 'restore-tags']) {
    refs[id] = el(id);
  }

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const radios = []; // { question, answer, input }, so the choices can be redrawn from the state

  // ---- The six questions -------------------------------------------------------------------

  function questionGroup(question) {
    const group = make('fieldset', 'choice-group');
    group.append(make('legend', '', question.label));
    for (const answer of question.answers) {
      const id = `taste-${question.id}-${answer.id}`;
      const row = make('div', 'choice-row');
      const label = make('label', 'choice-label');
      label.setAttribute('for', id);
      const input = make('input');
      input.id = id;
      input.setAttribute('type', 'radio');
      input.setAttribute('name', `taste-${question.id}`);
      input.value = answer.id;
      input.checked = false; // nothing is chosen at the start
      input.addEventListener('change', guarded(`Question "${question.label}"`, () => choose(question, answer, input)));
      label.append(input, make('span', '', answer.label));
      row.append(label);
      group.append(row);
      radios.push({ question, answer, input });
    }
    return group;
  }

  function choose(question, answer, input) {
    if (!input.checked) return;
    const state = getState();
    state.tasteAnswers[question.id] = answer.id;
    // A new choice for this question brings back its tags, so a tag removed earlier does not stay hidden.
    const tagsOfQuestion = question.answers.map((a) => a.tag);
    state.removedTags = state.removedTags.filter((tag) => !tagsOfQuestion.includes(tag));
    renderProfile();
    const profile = buildProfile(state.tasteAnswers, state.removedTags);
    announce(profile.hasProfile ? `Style profile updated: ${profile.tags.join(', ')}.` : `${taste.NO_PROFILE_MESSAGE}.`);
  }

  // ---- The style profile -------------------------------------------------------------------

  function removeTag(tag) {
    const state = getState();
    if (!state.removedTags.includes(tag)) state.removedTags.push(tag);
    renderProfile();
    refs['profile-heading'].focus();
    announce(`Tag removed: ${tag}. It will not be used.`);
  }

  function restoreTags() {
    const state = getState();
    state.removedTags = [];
    renderProfile();
    refs['profile-heading'].focus();
    announce('The removed tags are back in your style profile.');
  }

  function renderProfile() {
    const state = getState();
    const profile = buildProfile(state.tasteAnswers, state.removedTags);
    refs['profile-message'].textContent = profile.hasProfile ? '' : profile.message;
    refs['profile-message'].hidden = profile.hasProfile;
    refs['profile-sentences'].replaceChildren(...profile.sentences.map((sentence) => make('li', 'profile-sentence', sentence)));
    refs['profile-tags'].replaceChildren(...profile.tags.map((tag) => {
      const li = make('li', 'entry');
      const row = make('div', 'entry-row');
      const actions = make('span', 'entry-actions');
      const button = make('button', 'action-button', `Remove tag ${tag}`);
      button.setAttribute('type', 'button');
      button.addEventListener('click', guarded('Remove tag button', () => removeTag(tag)));
      actions.append(button);
      row.append(make('span', 'entry-name', tag), actions);
      li.append(row);
      return li;
    }));
    refs['restore-tags'].hidden = state.removedTags.length === 0;
  }

  // The choices match the state each time the screen is shown (all empty again after "Start again").
  function refresh() {
    const state = getState();
    for (const { question, answer, input } of radios) input.checked = state.tasteAnswers[question.id] === answer.id;
    renderProfile();
  }

  attempt('Taste questions', () => {
    refs['taste-questions'].replaceChildren(...QUESTIONS.map(questionGroup));
  });
  attempt('Put back removed tags button', () => {
    refs['restore-tags'].addEventListener('click', guarded('Put back removed tags button', restoreTags));
  });
  attempt('Taste screen', () => onShow('taste', refresh));
  attempt('First drawing of the taste screen', refresh);
}
