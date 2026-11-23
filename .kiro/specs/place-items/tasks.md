# Tasks: Place furniture, doors and windows

Status: approved by the owner on 2026-11-23 (questions 1 and 2 answered yes; see Task 0 and Task 16). Build in progress.

Rules for every task:
- Plain JavaScript, no framework, no build tool. **No installs, no downloads, no new dependencies.** `package.json` is not changed.
- Do one task at a time, then verify it and report exactly how, before starting the next.
- Tests run with `node --test`. A task is not finished until its check passes. Anything only a person can judge on a real device is written down as "pending owner check", never as Passed.
- All existing tests (483 at the start) must still pass after every task. None is deleted or weakened. The only edits to existing tests are the expected-value updates in `design.md` section 10, done in Task 9 (the owner said yes to question 1 on 2026-11-23).
- After every task from 1 to 15: `git diff docs/sample-run.json src/sample/sample-project.json` is empty. Task 16 is the only task allowed to change them.
- After any task that edits a `src/` engine file: run `npm run export-engine` and confirm the byte-for-byte engine test passes.
- Do not touch `LICENSE`, the sample data (except in Task 16), `gatekeeper.js`, `coordinator.js` or the Style, Layout and Builder agent files. Keep `.kiro` out of `.gitignore`.
- Add tests only for the things listed here. If a task fails twice, stop and explain. One pull request for the build, opened at the end.

"Req" shows which requirements the task covers.

---

### Task 0. Apply the owner's answers (done 2026-11-23)
Record the answers to the two questions in `requirements.md` and `design.md` (sections 10, 12 and 13).
- **Req:** R10
- **Verify:** Re-read the three files against the answers. No code changes. Done: answers recorded in `requirements.md` (R6, R10), `design.md` (sections 7, 10, 12, 13) and this file (Task 16 added). The owner also asked for the Session 25 log wording "(4 tests)" to become "(5 tests)" (done).

### Task 1. Safety net for the sample
Before any code change, add one test that saves what must not change: the sample's full clash report (every clash, number, text and severity), its run log, its version list, its labels (the SAMPLE PROJECT label and draft statement) and the Reviewer's rule results, and a check that `docs/sample-run.json` equals a fresh export. Task 16 reuses these saved values.
- **Req:** R6
- **Verify:** The new test passes on the untouched code. It is run again after every later task.

### Task 2. Limits, types and the intake state (pure, no page)
In `limits.js` add the nine types with kind, start name and start size, and the new limits. In `state.js` add `placed`, and the functions: add, edit, move to, nudge, turn, set wall, change status, remove. Each checks first and returns `{ ok: true }` or `{ ok: false, message }` and then changes nothing. `hasEntries` counts placed objects. Removing a room or floor removes its placed objects.
- **Req:** R1.3 to R1.9, R2.2, R2.3, R2.9
- **Verify:** Tests: every type gives the right kind; a blank or too-long name is refused with a sentence naming the box; a size of 0, a letter in a number box, and too many objects are refused and the state is unchanged; status has no default; nudge moves exactly 10 cm each way; four turns return to the start; turn swaps width and depth; wall snap puts a door flush on each wall; removing a room drops its objects.

### Task 3. Geometry helpers (pure, no page)
New `place-geometry.js`: centimetres to metres, click to position (rounded to 10 cm), inside-room test, overlap test, and the plain-words sentence for each object.
- **Req:** R2.5, R2.6, R4.2, R4.3
- **Verify:** Tests: click conversion at the corners and the middle of a room, with a room at 320 px scale; exactly touching pieces do not overlap; a piece 1 cm over a wall is outside; the sentence for each type and turn is exact plain words and contains no ids.

### Task 4. Brain room size and building the items
Edit 1 (`brain.js`: optional room width and depth) and edit 8 (`build-brain.js`: room sizes passed on, one item per placed object). Run the export.
- **Req:** R3.1 to R3.4
- **Verify:** Tests: a room made with a name only is identical to before; bad sizes (zero, text) are refused; furniture becomes `layout` / Layout, door and window become `door`/`window` / Builder; positions are in metres; the full pipeline runs with placed objects; a Locked placed object is identical after the run and an Unsure one gets the Layout or Builder note; all 483 existing tests pass; the sample diff is empty.

### Task 5. Reviewer: two new checks
Edit 2 (`reviewer/agent.js`). Run the export.
- **Req:** R4.1 to R4.7, R6.3
- **Verify:** Tests: two overlapping sofas give one "Furniture overlaps furniture" clash, reported once; pieces exactly edge to edge give none; a wardrobe 1 cm outside gives one "Object outside its room" clash; a door outside is High; a room with no size is skipped; clash numbers of the old kinds are unchanged when new ones are added; the Reviewer changes nothing but its own report. The Task 1 test (sample clash report) still passes.

### Task 6. Run data and summary
Edits 3 and 4 (`make-run-data.js`, `make-summary.js`). Run the export.
- **Req:** R5.3, R6.2
- **Verify:** Tests: type and turn reach the run data for placed furniture and are absent for the sample; the summary words for a typed piece are exact; `npm run export-viewer` gives an empty `git diff` on `docs/sample-run.json`.

### Task 7. The 3D shapes (pure part)
Edit 5 (`scene-data.js`): `furnitureType` and `turn` on boxes, and `shapeParts`.
- **Req:** R7.1, R7.3, R7.4
- **Verify:** Tests, one per type: the part roles and count are as listed in the requirements table (for example sofa has a seat, a back and two arms; table has a top and four legs; window has a frame and glass); parts stay inside the object's footprint; a turn of 90 moves the back to the right edge; a small object keeps the minimum thickness; every part carries the item id, colour and clash flag; no type gives an empty list; the sample's boxes are identical to before.

### Task 8. The 3D shapes (drawing)
Edit 6 (`viewer.js`): draw each part with the existing material code.
- **Req:** R7.1, R7.2, R5.1
- **Verify:** Tests with the existing stand-in renderer: a typed sofa makes the expected number of meshes, all with the same item id; clicking a part gives that object's panel; the clash outline is drawn once; the sample draws the same number of meshes as before. How it looks: **Unverified: pending owner check** on a real screen.

### Task 9. Screen list, step numbers, cache tag, README
Edit 10 (`screens.js` entry, `index.html` section skeleton; the cache tag was already changed to `build-place-1` in the first build batch, together with its test expected values, because Tasks 2, 4 and 5 changed files the page loads) and edit 11 (README sentence). Update the expected values in the three test files of `design.md` section 10, and nothing else in them.
- **Req:** R1.1, R10.1
- **Verify:** `git diff` of the three test files shows only the listed expected-value lines. All tests pass. The step text reads "Step N of 8" on every step. The screens test shows the new screen between Items and Review.

### Task 10. The screen: form, list and buttons
`place-screen.js` plus the markup and styles (design section 4, steps 1 to 3, 5 and 6), without the plan.
- **Req:** R1.2 to R1.8, R2.1 to R2.3, R2.6 to R2.9, R9.1, R9.6, R9.7
- **Verify:** Tests on the stand-in page: with no rooms the screen says so and shows no form; adding, editing, nudging, turning, wall, status and removing each change the state and the list text; a refused change keeps the old values and shows its sentence next to the box with `aria-describedby`; each action sets the one-sentence announcement; focus stays on the control used; every control has a visible label; visitor text appears only through `textContent`.

### Task 11. The plan
`place-plan.js` and the click handler (design section 5).
- **Req:** R2.4, R2.5, R2.6, R9.5
- **Verify:** Tests: the SVG has one rectangle per object in the room; Locked and Unsure differ by outline style, not colour alone; the label text is right; a click event on the stand-in SVG moves the selected object; a click with nothing selected shows "Select an object first."; the plan is redrawn from the state; the list and the plan always show the same objects. Real mouse, touch and 320 px behaviour: **Unverified: pending owner check**.

### Task 12. The result report
Edit 9 (`report.js`) and the matching display in the result screen.
- **Req:** R8.1 to R8.6, R5.2, R4.7
- **Note (from Task 5):** R4.7 (the report says plainly that the overlap and fit checks use only the rectangles the visitor entered) is met here, in the result report, and not in the Reviewer's clash report, as `design.md` section 6 says. Task 12's tests must check that sentence.
- **Verify:** Tests: the exact lines for 0 objects, for only Unsure, for a mix with Locked, and for a skipped room; the "did not" line is present whenever objects were placed and absent when none were; the old lines and the fixed sentence are unchanged; no line contains "AI" claims beyond the fixed sentence.

### Task 13. Accessibility and privacy checks
Add to the existing accessibility and privacy test style: sizes (16 px text, 44 px controls), contrast pairs for the new styles, a 320 px layout rule (no fixed widths above 320 px), keyboard order, no storage or network calls in the new files, the content security rule unchanged, the secrets search still clean.
- **Req:** R9
- **Verify:** Tests pass. Each criterion is marked Passed only where a test proves it. Real device checks (320 px phone, 200% zoom, screen reader, real keyboard) are listed as **Unverified: pending owner check**.
- **Done 2026-11-23** (build-place-4): `test/place-accessibility-privacy.test.js`, 10 tests. It found one real fault (the plan label was 15.9 px at 320 px wide) and `docs/intake/place-plan.js` was fixed. Real device checks are listed in the checklist as pending owner check.

### Task 14. End to end
One test runs the intake from setup to result with a small project: two rooms, a Locked sofa, an Unsure bed overlapping it, a wardrobe sticking out, a door and a window. It checks the clash report, the report lines, the run data and the shapes.
- **Req:** R3, R4, R5, R7, R8
- **Verify:** The test passes. The three clash kinds appear with the right numbers. The Locked sofa is identical after the run.
- **Done 2026-11-23** (build-place-4): `test/place-end-to-end.test.js`, 5 tests.

### Task 15. Checklist, log and README check
Write `acceptance-checklist.md` for this spec in the same strict format as the others (Passed only by named test; the rest pending owner check). Add the `KIRO_LOG.md` entry (credits line blank). Run the whole test suite, the sample diff and `git status`.
- **Req:** all
- **Verify:** The full `node --test` count and result are quoted. `git status` shows only the expected files. The checklist's named tests all exist (the existing checklist checker script passes).
- **Done 2026-11-23** (build-place-4): `acceptance-checklist.md` written; `test-helpers/check-checklist.js` now also reads names that start with `place-items Task` and `Place Task` (before this it would have skipped them).

### Task 16. The sample's four objects get a type (LAST task, optional, only if safe)
Owner-approved on 2026-11-23 (question 2). Give only the sample's Sofa, Garden door, Bedroom door and Kitchen window a `type` in `src/sample/sample-project.json`, so the viewer draws the new shapes for them. Regenerate `docs/sample-run.json` with `npm run export-viewer` (and run `npm run export-engine` if any `src/` engine file changes).
- **Go / no-go first.** Before editing, check that the change is safe: the existing sample tests, the run log, the versions, the labels and the clash report must not depend on the absence of a `type`. If any of them would change, or an existing test would need to be weakened, SKIP this task and tell the owner.
- **Req:** R6.5, R6.6
- **Verify:** A test compares the "before" values saved in Task 1 with the new run: the two clashes (numbers, texts, severities), the run log, the version list, the labels and every rule result are identical; the only differences in `docs/sample-run.json` are the added `type` fields; the sample's four objects draw the new shapes in the stand-in scene. All earlier tests still pass. Looks in a real browser: **pending owner check**.
- **SKIPPED 2026-11-23** (build-place-4): the go / no-go trial was not safe. With a `type` on the four objects, 12 existing tests failed, and making them pass would have meant rewriting tests that say the sample file is unchanged and that the sample has no type and draws plain blocks. The trial was undone. The owner decides whether to do it later, with those tests updated on purpose.

### Final step: pull request
After the last task that is built (Task 16, or Task 15 if Task 16 is skipped), open one pull request and tell the owner what to click.
