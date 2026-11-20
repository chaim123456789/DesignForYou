// The "Review and run" screen: a plain list of everything the visitor entered, the "Run the design team"
// button (disabled, with a reason next to it, until there is a project name, a floor and a room), and the
// message shown when a run fails. A failed run names the agent that failed and keeps everything entered,
// so the visitor can press Back, fix it and try again.
//
// This file imports nothing. screens.js loads state.js, taste.js and build-brain.js (with the page's cache
// tag) and hands them in. Pressing the button sends nothing anywhere: the design team runs in this page.
// Everything the visitor typed goes on the page with textContent, never as page code.
//
// Every part is its own protected step (attempt and guarded come from screens.js).

export function setUpReviewScreen(tools) {
  const { el, attempt, guarded, announce, getState, api, taste, onShow, onReset, runDesignTeam, showResult } = tools;

  const refs = {};
  for (const id of ['review-list', 'run-design-team', 'run-reason', 'run-failure', 'run-failure-text']) refs[id] = el(id);

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---- What is still needed ---------------------------------------------------------------------

  // The things the run cannot start without, as plain words. A floor needs at least one room (the Project Brain refuses an empty floor).
  function missingParts(state) {
    const missing = [];
    if (state.name.trim() === '') missing.push('a project name');
    if (state.floors.length === 0) missing.push('a floor');
    if (api.allRooms(state).length === 0) missing.push('a room');
    else for (const floor of state.floors) if (floor.rooms.length === 0) missing.push(`a room on the floor ${floor.name}`);
    return missing;
  }
  const joinWords = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

  // ---- The list of what was entered --------------------------------------------------------------

  function reviewLines(state) {
    const lines = [];
    lines.push(`Project name: ${state.name.trim() === '' ? 'not given yet' : state.name}`);
    if (state.floors.length === 0) {
      lines.push('Floors and rooms: none yet');
    } else {
      for (const floor of state.floors) {
        const rooms = floor.rooms.map((r) => `${r.name} (${r.width} m by ${r.depth} m)`);
        lines.push(`Floor ${floor.name}: ${rooms.length > 0 ? rooms.join(', ') : 'no rooms yet'}`);
      }
    }
    const imageCount = api.allImages(state).length;
    lines.push(imageCount > 0
      ? `Images: ${imageCount}. They stay in this browser and are not uploaded.`
      : 'Images: none');
    const noteCount = state.overall.notes.length + Object.values(state.overrides).reduce((sum, layer) => sum + layer.notes.length, 0);
    lines.push(`Notes: ${noteCount}`);
    lines.push(state.brief.trim() !== ''
      ? `Brief: written, ${plural(state.brief.length, 'character', 'characters')}. It is kept with your project. The design team does not read it.`
      : 'Brief: none written');
    const profile = taste.buildProfile(state.tasteAnswers, state.removedTags);
    lines.push(profile.hasProfile ? `Style profile: ${profile.sentences.join(' ')}` : `Style profile: ${profile.message}`);
    if (state.items.length === 0) {
      lines.push('Items: none. The design team will have nothing to work on except the clash check.');
    } else {
      lines.push(`Items: ${state.items.length}`);
      for (const item of state.items) {
        const room = api.findRoom(state, item.room);
        lines.push(`Item: ${item.text}, ${room ? room.name : 'a room that was removed'}, ${item.status}${item.tag ? `, ${item.tag}` : ''}`);
      }
    }
    return lines;
  }

  // ---- The run button -------------------------------------------------------------------------------

  function hideFailure() {
    refs['run-failure'].hidden = true;
    refs['run-failure-text'].textContent = '';
  }

  function updateButton() {
    const missing = missingParts(getState());
    refs['run-design-team'].disabled = missing.length > 0;
    refs['run-reason'].textContent = missing.length > 0
      ? `Still needed before you can run the design team: ${joinWords(missing)}. Use Back to add it.`
      : 'You can run the design team now. Nothing is sent anywhere. It runs in this page.';
  }

  function refresh() {
    attempt('Review list', () => refs['review-list'].replaceChildren(...reviewLines(getState()).map((line) => make('li', 'entry', line))));
    attempt('Run button', updateButton);
    attempt('Clearing an old failure message', hideFailure);
  }

  // The failure message names the agent that failed. Everything entered is kept, because nothing here changes the state.
  function showFailure(failedAgent, reason) {
    refs['run-failure-text'].textContent = failedAgent
      ? `The design team stopped at the ${failedAgent} agent. Reason: ${reason}`
      : `The design team could not start. Reason: ${reason}`;
    refs['run-failure'].hidden = false;
    refs['run-failure'].focus();
    announce('The design team could not finish. Everything you entered is still here.');
  }

  let running = false;
  async function run() {
    if (running) return;
    const state = getState();
    if (missingParts(state).length > 0) { updateButton(); return; }
    running = true;
    refs['run-design-team'].disabled = true;
    hideFailure();
    try {
      const result = runDesignTeam(state);
      if (!result.ok) {
        showFailure(result.failedAgent, result.reason);
        return;
      }
      await showResult(result);
    } catch (error) {
      showFailure(null, error && error.message ? error.message : String(error));
      throw error; // also shown in the red message at the top of the page
    } finally {
      running = false;
      attempt('Run button', updateButton);
    }
  }

  attempt('Run button handler', () => {
    refs['run-design-team'].addEventListener('click', guarded('Run the design team button', run));
  });
  attempt('Review screen', () => onShow('review', refresh));
  attempt('Clearing the review screen on Start again', () => { if (onReset) onReset(refresh); });
  attempt('First drawing of the review screen', refresh);
}
