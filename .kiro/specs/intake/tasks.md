# Tasks: Intake

Rules for every task:
- Plain JavaScript, no framework, no build tool (approved 2026-11-19). **No installs, no downloads, no new dependencies.** `package.json` may only gain script lines (`export-engine` is approved).
- The three edits to existing code (config loading, optional Brain fields, viewer "show this run data") are approved. Each is its own small task. No existing test may be deleted or weakened.
- Do one task at a time, then verify it and report exactly how, before starting the next.
- Tests are run with `node --test`. A task is not finished until its check passes. Anything only a person can judge by looking at a real device is written down as "pending owner check", never as Passed.
- If a task fails twice, stop and explain.
- Do not touch `LICENSE`, `sample-project.json`, `docs/sample-run.json` (except by the existing export script, with an identical result) or the agent files. The one exception is the Reviewer file in Task 5b. Keep `.kiro` out of `.gitignore`.
- All existing tests must still pass after every task (the count at the start is 235).
- Add no tests for things not listed here. One pull request at the end.

"Req" shows which requirements the task covers.

---

### Task 0. Apply the owner's answers (DONE 2026-11-19)
The owner's answers are recorded in `requirements.md` (Decisions from the owner), `design.md` (sections 1, 2, 8.1, 10) and in this file. `.kiro/steering/product.md` now says "up to 50 images".
- **Req:** all
- **Verify:** Re-read the three spec files against the answers. No code changes.

### Task 1. Browser-safe engine (three small steps, each verified before the next)
(a) Change `src/agents/config.js` so `node:fs` is only used when `agent.json` files are actually read. (b) Add a `src/viewer/` pure function that builds the run data from a finished project, with no file reading, and make the existing `make-sample-run.js` use it, so the sample output does not change. (c) Add `npm run export-engine`: copies `src/brain/`, the four `agent.js` files, `src/agents/config.js`, `src/coordinator.js`, `src/label.js`, `src/summary/make-summary.js` and the pure run-data function into `docs/engine/`, byte for byte.
- **Req:** R7.4, R11.6
- **Verify:** All 235 existing tests pass. Running `npm run export-viewer` again gives a `docs/sample-run.json` identical to before (`git diff` empty). A test shows every file in `docs/engine/` is byte-identical to its source. A test imports `docs/engine/coordinator.js` in Node with no `node:fs` available (a stand-in that throws) and runs a tiny project. The "R7.6" tests still pass (the copies are outside `src/`, so also search `docs/engine/` for network calls and web addresses).

### Task 2. Limits and input checks (no page)
Create `docs/intake/limits.js` (all numbers from `design.md` section 5) and `docs/intake/state.js` with pure functions: set project name, add, rename and remove floor and room, add and remove image records, add and remove notes, add, edit and remove items, set brief. Every function returns a plain message when input is bad and changes nothing.
- **Req:** R2, R3.1, R3.4, R3.5, R3.6, R4.1, R4.2, R6.1, R6.5, R6.6
- **Verify:** Tests for each limit at the edge and one over (4 floors, 20 rooms, duplicate room name in a different case, 50 images, 51st image, wrong type, 10 MB and just over, 30 notes, 40 characters, item 80 characters, 100 items, brief 2000, empty name). Bad input leaves the state deep-equal to before. Removing a floor removes its rooms and items in them. No test file needs a page.

### Task 3. Taste questions and style profile
Create `docs/intake/taste.js`: the 6 questions, answers, tags and sentences, and `buildProfile(answers, removedTags)`.
- **Req:** R5
- **Verify:** Tests: exactly 6 questions, each with 2 or 3 answers; same answers give the same profile (run twice, deep-equal); skipped questions are left out; removed tags are absent; no answers gives "No style profile yet" and no tags; a text search shows no word such as "AI" or "analysed" in the sentences.

### Task 4. Build the Project Brain from the inputs (two small steps, each verified before the next)
(a) Allow the optional project fields `brief`, `styleProfile`, `imageCount` in the Brain (additive; the sample is unchanged). (b) Create `docs/intake/build-brain.js` (design section 5) and a function that runs the pipeline with the normal Style agent, Layout, Builder and a Reviewer given the fixed list of opposite pairs, and the fixed clock.
- **Req:** R7.3, R7.4, R7.5, R7.6, R9.1 to R9.5
- **Verify:** Tests: known inputs give the expected floors, rooms, inspiration, overrides and items with the right owner; Locked items are deep-equal before and after the run; two runs are deep-equal; run order in the log is Style, Layout, Builder, Reviewer; a room override "cold steel" with a Locked "warm oak" item in that room gives the expected clash; no override gives "No clashes found". A test shows no agent file mentions `brief`, `styleProfile`, `imageCount` or `images` (a planted read in a copy makes the test fail, then is removed). A Brain with a failing agent returns a failure that names the agent and keeps the inputs. A test shows the sample run output is unchanged.

### Task 5b. Reviewer also checks overall notes and style profile tags (approved 2026-11-19)
Small change to `src/agents/reviewer/agent.js` only: besides room override notes, the Reviewer compares the overall inspiration notes and style profile tags against the tag of each Locked item (in rooms without an override), using the same list of opposite pairs. Same clash report format. Tests in a new file.
- **Req:** R9.3
- **Verify:** All existing tests pass unchanged (including the Reviewer tests and the sample run). New tests: overall note "cold steel" with a Locked "warm oak" item gives a clash; a profile tag does too; no matching pair gives "No clashes found"; a room with an override uses the override and not the overall notes; items without a tag are skipped; the sample run output (`docs/sample-run.json` after `npm run export-viewer`) is identical (`git diff` empty). A planted fault (the check ignoring overall notes) makes a new test fail, then is removed.

### Task 5. "What the design team did with your input" report
Create `docs/intake/report.js`: a pure function from the inputs and the finished run to the three lists (Used, Kept but not read, Nothing to do this time), the comparison list of opposite pairs, and the fixed sentence of R10.1.
- **Req:** R9.3 to R9.7, R10.1, R10.2
- **Verify:** Tests: brief and images appear under "Kept but not read" and never under "Used"; with no notes the "Used" list says so; Layout and Builder line appears when no furniture, doors or windows exist; the pairs shown are exactly the pairs given to the Reviewer; no text claims AI, understanding, design or analysis (word search); a test fails if the fixed sentence is changed in one place only.

### Task 6. Page shell, start screen and navigation
Edit `docs/index.html`, `docs/styles.css` and add `docs/intake/screens.js`: the start screen with the two choices, the screen list, "Back" and "Next", step text, focus moves to the new heading, page title per screen, the draft statement on every screen, the "rule-based, not AI" sentence on the start screen, and the content security rule change (`img-src 'self' blob:`). The existing viewer markup stays in the page, hidden until a result is shown. The viewer is not connected yet.
- **Req:** R1.1, R1.3 to R1.5, R10.4, R11.3, R12.3, R12.5, R12.6
- **Verify:** Tests on `index.html` and the real script with the stand-in page: exactly two choices with the exact words; each screen has one heading; focus moves on change; titles differ; the draft statement is on every screen; the content security rule differs from before only by `blob:` for images and still has no `unsafe-inline` and no outside address; the existing viewer tests still pass. Reading the page on a phone: pending owner check.

### Task 7. Setup screen
Floor and room form, list with rename and remove (with confirmation for a floor), optional width and depth, messages next to fields.
- **Req:** R2, R12.1, R12.2, R12.7
- **Verify:** Page tests with the stand-in page: adding, renaming, removing; bad input shows a message tied to the field (`aria-describedby`) and adds nothing; every input has a label; the status line announces additions and removals.

### Task 8. Inspiration screens
Overall step and optional room override step; image file picker (type, size and count checks), preview, caption, remove; notes entries; the privacy sentence next to the picker; warning before leaving the page; release of preview addresses.
- **Req:** R3, R11.2, R11.5, R12.8
- **Verify:** Page tests: wrong type and over-size files are refused with a message; 51st image refused; removing an image releases its address (the stand-in records `URL.revokeObjectURL`); "Start again" releases all; no `fetch`, storage, or cookie calls in the new files (search test); a room override replaces overall notes in the built Brain (uses Task 4); the privacy sentence is present. The `beforeunload` handler is registered only when something has been entered.

### Task 9. Brief and taste screens
Brief box with counter, six questions as groups of choices with a legend, live style profile, removable tags, "No style profile yet".
- **Req:** R4, R5, R12.1, R12.2
- **Verify:** Page tests: the brief stops at 2000 characters and shows the count; every question is a `fieldset` with a `legend` and radio choices; none selected at the start; the profile text updates after an answer; a removed tag disappears and is not in the Brain.

### Task 10. Items screen
Item form (text, room list from setup, Locked or Unsure with no default, optional tag), list with edit, status change and remove; explanation sentences.
- **Req:** R6, R12.1, R12.2, R12.7
- **Verify:** Page tests: cannot add without choosing Locked or Unsure; the room list matches the rooms entered; removing a room moves to a clear message about its items (the items are removed after confirmation); the list shows status as text; item 101 refused.

### Task 11. Connect the viewer and summary, run button, result
(a) Change `docs/viewer.js` so that it has one function "show this run data", used by "Try the sample" (fetching `sample-run.json` as today) and by the run. (b) Review screen and the "Run the design team" button (disabled with a reason until valid). (c) Result screen: viewer, summary, a mood board of the visitor's images next to the style profile (each image with its text description), the "What the design team did" section, the fixed sentence, "Start again". Visitor text goes in as text only.
- **Req:** R1.2, R7, R8, R9, R10
- **Verify:** All existing viewer tests pass unchanged, or only with a path or setup edit that is listed in the report. New tests with the real `viewer.js` and the real engine copies: sample path gives the same drawing data as before and shows SAMPLE PROJECT; own path shows no SAMPLE PROJECT and shows the draft statement; a failing agent shows its name and keeps the inputs; hostile text such as `<img src=x onerror=alert(1)>` in a name, note, brief and item appears as plain text everywhere (summary included); "Start again" clears the state and releases previews; pressing the button makes no network call (stand-in `fetch` records zero calls). A planted fault (the summary inserting raw text) must make a test fail, then is removed. How the 3D view looks with a visitor's project: pending owner check.

### Task 12. Accessibility and privacy checks
Colours as named values; a test that computes contrast for every pair; structure tests for labels, headings, status region, tab order, `lang`, viewport tag.
- **Req:** R11, R12
- **Verify:** Contrast test passes with the numbers printed (4.5 to 1 text, 3 to 1 borders and focus). Searches show no storage calls, no cookies, no web addresses and no `fetch` except the sample file in `docs/intake/` and `docs/`. A planted `localStorage` call makes a test fail, then is removed. Real-device and screen-reader checks: pending owner check.

### Task 13. README, acceptance checklist and final check
Add an "Intake" section to `README.md` (how to open the page, what each screen does; existing text untouched except where the section replaces nothing). Write `.kiro/specs/intake/acceptance-checklist.md` listing every criterion with its test name or "pending owner check". Reuse `test-helpers/check-checklist.js` to match quoted names.
- **Req:** R13, R12.10
- **Verify:** `node --test` all pass; `node test-helpers/check-checklist.js` matches every quoted name; `git status` shows only intended files; `LICENSE`, `sample-project.json` and `.gitignore` unchanged; `package.json` has only new script lines and no dependencies.

### Later (not part of this spec, only if the owner approves)
- One real AI step for the Style agent: key on a server function, rules-based Style agent kept as fallback (`design.md` section 8.1). Not built now.
- Furniture, doors and windows placed on a simple room plan.
- Live AI mode, as its own spec (see `design.md` section 8).
