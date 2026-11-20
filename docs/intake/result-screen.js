// The result screen for a visitor's own project: the 3D viewer with their data, the summary, the style
// profile with the mood board of their images, "What the design team did with your input", and the fixed
// "not AI" sentence. It also switches the labels between YOUR PROJECT and SAMPLE PROJECT.
//
// This file imports nothing. screens.js loads state.js, taste.js, report.js, run-data.js, summary-view.js and
// the engine's make-summary.js (with the page's cache tag) and hands them in. Everything the visitor typed
// goes on the page as text (textContent or text nodes), never as page code. The images are shown only
// through their temporary browser addresses (previews): they are never uploaded, read or stored.
//
// Every part is its own protected step (attempt and guarded come from screens.js): a part that fails shows
// the red message at the top of the page and the other parts still appear.

export function setUpResultScreen(tools) {
  const { el, attempt, guarded, announce, getState, onReset, show, getViewer, askStartAgain,
    api, taste, report, runData, summaryView, makeSummaryHtml } = tools;

  const refs = {};
  for (const id of ['heading-result', 'own-result', 'own-viewer-note', 'own-summary', 'own-brief', 'own-images-count',
    'own-profile-message', 'own-profile-sentences', 'own-profile-tags', 'own-mood-empty', 'own-mood-board',
    'own-report', 'own-report-clash', 'result-fixed-rules', 'sample-fixed-rules', 'result-start-again',
    'how-to-use', 'view-controls', 'scene-area', 'col-side']) {
    refs[id] = el(id);
  }
  const sampleHeading = refs['heading-result'].textContent;
  const VIEWER_PARTS = ['how-to-use', 'view-controls', 'scene-area', 'col-side'];

  // What the 3D viewer shows right now: 'sample' or 'own'. The visitor's data must never stay in the viewer
  // after "Start again", and the sample must come back when it is asked for.
  let viewerKind = 'sample';

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // Run one step and say whether it worked (attempt itself returns whatever the step returns).
  const succeeded = (step, work) => {
    let worked = false;
    attempt(step, () => { work(); worked = true; });
    return worked;
  };

  // ---- Labels: YOUR PROJECT or SAMPLE PROJECT -----------------------------------------------------

  // The stylesheet also hides the label that does not apply; this makes it true without depending on the stylesheet.
  function setKind(kind, name) {
    const own = kind === 'own';
    attempt('Result labels', () => {
      document.body.dataset.run = kind;
      for (const label of document.querySelectorAll('.label-sample')) label.hidden = own;
      for (const label of document.querySelectorAll('.label-own')) label.hidden = !own;
    });
    // The sample result has its own copy of the fixed sentence (plain page text). The own result has the one at its end.
    attempt('Result: the fixed sentence of the sample', () => { refs['sample-fixed-rules'].hidden = own; });
    attempt('Result heading', () => {
      refs['heading-result'].textContent = own ? `YOUR PROJECT: ${name}` : sampleHeading;
      refs['own-result'].hidden = !own;
    });
  }

  function setViewerVisible(visible) {
    attempt('Showing or hiding the 3D view', () => { for (const id of VIEWER_PARTS) refs[id].hidden = !visible; });
  }

  // ---- The parts of the own result ------------------------------------------------------------------

  function fillSummary(project) {
    const worked = succeeded('Result: summary', () => {
      const nodes = summaryView.summaryNodes(makeSummaryHtml(project), document);
      refs['own-summary'].replaceChildren(...nodes);
    });
    if (!worked) refs['own-summary'].replaceChildren(make('p', 'field-error', 'The summary could not be shown. See the red message at the top of the page.'));
  }

  function fillBrief(state, project) {
    attempt('Result: brief', () => {
      refs['own-brief'].textContent = project.brief && project.brief.trim() !== '' ? project.brief : 'You wrote no brief.';
      const count = api.allImages(state).length;
      refs['own-images-count'].textContent = count > 0
        ? `You added ${plural(count, 'image', 'images')}. They stay in this page and are not uploaded.`
        : 'You added no images.';
    });
  }

  function fillProfile(state) {
    attempt('Result: style profile', () => {
      const profile = taste.buildProfile(state.tasteAnswers, state.removedTags);
      refs['own-profile-message'].textContent = profile.hasProfile ? '' : profile.message;
      refs['own-profile-message'].hidden = profile.hasProfile;
      refs['own-profile-sentences'].replaceChildren(...profile.sentences.map((sentence) => make('li', 'profile-sentence', sentence)));
      refs['own-profile-tags'].replaceChildren(...profile.tags.map((tag) => make('li', 'tag', tag)));
    });
    attempt('Result: mood board', () => {
      const images = api.allImages(state);
      refs['own-mood-empty'].hidden = images.length > 0;
      refs['own-mood-board'].replaceChildren(...images.map((image, index) => {
        const description = image.caption || `Inspiration image ${index + 1}`;
        const li = make('li', 'mood-item');
        if (image.previewUrl) {
          const picture = make('img', 'mood-image');
          picture.src = image.previewUrl;
          picture.alt = description;
          li.append(picture);
        }
        li.append(make('span', 'mood-caption', description));
        return li;
      }));
    });
  }

  function fillReport(state, run) {
    attempt('Result: what the design team did', () => {
      const built = report.buildReport(state, run);
      if (!built) throw new Error('There is no report because the run did not finish.');
      refs['own-report'].replaceChildren(...built.lists.flatMap((list) => {
        const heading = make('h3', '', list.heading);
        const lines = make('ul', 'entry-list');
        lines.append(...list.lines.map((line) => make('li', 'report-line', line)));
        return [heading, lines];
      }));
      refs['own-report-clash'].textContent = built.clashLine || '';
      refs['own-report-clash'].hidden = !built.clashLine;
    });
  }

  // The one fixed sentence comes from report.js, so the page cannot hold a different copy of it.
  function fillFixedSentence() {
    attempt('Result: the fixed sentence', () => { refs['result-fixed-rules'].textContent = report.FIXED_SENTENCE; });
  }
  // The sample result shows the same sentence as one line under "Back to start", outside the viewer's own parts.
  // It is filled in as soon as this screen's code has loaded, so the sample needs no run first.
  attempt('Result: the fixed sentence of the sample', () => { refs['sample-fixed-rules'].textContent = report.FIXED_SENTENCE; });

  // ---- Showing the result -------------------------------------------------------------------------

  // run: the finished, successful result of runDesignTeam. Returns true when the result screen is shown.
  async function showOwnResult(run) {
    const state = getState();
    const project = run.project;
    let data = null;
    succeeded('Preparing the 3D view', () => { data = runData.buildOwnRunData(project, state); });
    const viewer = getViewer();
    let viewerOk = false;
    if (data && viewer) {
      viewerOk = (await attempt('Showing your project in the 3D view', () => viewer.showRunData(data, { kind: 'own' }))) === true;
    }
    if (viewerOk) viewerKind = 'own';
    setKind('own', state.name);
    // If the viewer did not take the visitor's data, it must not show the sample next to YOUR PROJECT.
    setViewerVisible(viewerOk);
    attempt('Result: 3D view note', () => {
      refs['own-viewer-note'].textContent = 'The 3D view could not be shown. The summary below has the same information.';
      refs['own-viewer-note'].hidden = viewerOk;
    });
    fillSummary(project);
    fillBrief(state, project);
    fillProfile(state);
    fillReport(state, run);
    fillFixedSentence();
    attempt('Showing the result screen', () => show('result'));
    announce('Your result is ready.');
    return true;
  }

  // "Try the sample". The sample is shown again if the viewer was showing the visitor's project.
  function showSampleResult() {
    setKind('sample');
    setViewerVisible(true);
    attempt('Showing the result screen', () => show('result'));
    const viewer = getViewer();
    if (viewer && viewerKind === 'own') {
      viewerKind = 'sample';
      attempt('Showing the sample in the 3D view', async () => {
        if ((await viewer.showSample()) !== true) setViewerVisible(false);
      });
    }
  }

  // ---- Start again --------------------------------------------------------------------------------

  attempt('Result: Start again button', () => {
    refs['result-start-again'].addEventListener('click', guarded('Result: Start again button', askStartAgain));
  });
  attempt('Result: clearing on Start again', () => {
    onReset(() => {
      refs['own-summary'].replaceChildren();
      refs['own-brief'].textContent = '';
      refs['own-images-count'].textContent = '';
      refs['own-profile-sentences'].replaceChildren();
      refs['own-profile-tags'].replaceChildren();
      refs['own-mood-board'].replaceChildren();
      refs['own-report'].replaceChildren();
      refs['own-report-clash'].textContent = '';
      setKind('sample');
      setViewerVisible(true);
      const viewer = getViewer();
      // The visitor's project must not stay in the 3D view's memory or on its page.
      if (viewer && viewerKind === 'own') {
        viewerKind = 'sample';
        attempt('Showing the sample in the 3D view', () => viewer.showSample());
      }
    });
  });

  return { showOwnResult, showSampleResult };
}
