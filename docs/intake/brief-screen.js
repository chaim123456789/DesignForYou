// The brief screen: one labelled text box, up to 2000 characters, with a counter.
//
// This file imports nothing. screens.js loads state.js and limits.js (with the page's cache tag) and
// hands them in. The brief is kept in the page's memory only. It is never stored or sent, and no
// agent reads it. It is put on the page with textContent or as the value of the box, never as page code.
//
// Every part is set up in its own protected step (attempt and guarded come from screens.js).

export function setUpBriefScreen(tools) {
  const { el, attempt, guarded, getState, api, limits, entriesChanged, onShow } = tools;

  const box = el('brief-text');
  const count = el('brief-count');
  const notice = el('brief-notice');
  const describedBase = box.getAttribute('aria-describedby') || '';

  function showCount(text) {
    const length = text.length;
    count.textContent = length >= limits.briefMax
      ? `${length} of ${limits.briefMax} characters. That is the most you can write.`
      : `${length} of ${limits.briefMax} characters.`;
  }

  function showNotice(message) {
    notice.textContent = message;
    notice.hidden = false;
    box.setAttribute('aria-describedby', [describedBase, notice.id].filter(Boolean).join(' '));
  }
  function clearNotice() {
    notice.textContent = '';
    notice.hidden = true;
    box.setAttribute('aria-describedby', describedBase);
  }

  // The brief always matches the box. Text past the limit is cut off, and the page says so.
  function onInput() {
    let text = box.value;
    if (text.length > limits.briefMax) {
      text = text.slice(0, limits.briefMax);
      box.value = text;
      showNotice(`Your brief stops at ${limits.briefMax} characters. The extra text was cut off.`);
    } else {
      clearNotice();
    }
    api.setBrief(getState(), text);
    showCount(text);
    entriesChanged();
  }

  attempt('Brief box', () => {
    box.setAttribute('maxlength', String(limits.briefMax));
    box.addEventListener('input', guarded('Brief box', onInput));
  });

  // Redrawn whenever the screen is shown, so it is empty again after "Start again".
  const refresh = () => {
    box.value = getState().brief;
    clearNotice();
    showCount(box.value);
  };
  attempt('Brief screen', () => onShow('brief', refresh));
  attempt('First drawing of the brief screen', refresh);
}
