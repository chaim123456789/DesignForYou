# Tasks: Room Viewer

Rules for every task:
- Plain JavaScript, no framework, no build tool. Three.js is the one library, delivered as approved in `design.md` section 3.
- **No installs and no downloads until Task 5.** Tasks 1 to 4 need no network.
- Do one task at a time, then verify it and report exactly how, before starting the next.
- Tests are run with `node --test`. A task is not finished until its check passes. Anything only a human can judge by looking is written down as "pending owner check", never as Passed.
- If a task fails twice, stop and explain.
- Do not touch `LICENSE`, the agents, the Brain, or `sample-project.json`. Keep `.kiro` out of `.gitignore`.
- Add no tests for things not listed here. One pull request at the end.

"Req" shows which requirements the task covers.

Before Task 1: the owner approves this spec and answers the two questions in `design.md` (section 3: Three.js copy and GitHub Pages; section 4: fixed room sizes).

---

### Task 1. Viewer layout and sample run data
Create `src/viewer/viewer-layout.json` (the fixed sizes in `design.md` section 4) and `src/viewer/make-sample-run.js` with `makeSampleRun(project)`. The snapshots must come from `getBrainAtVersion`. Version sentences are plain words.
- **Req:** R1.4, R1.5, R1.7, R10.1
- **Verify:** Tests pass for: the sample run data has 2 floors, 4 rooms, 7 versions and 8 snapshots (0 to 7); every snapshot equals `getBrainAtVersion` for that version; making the data does not change the Brain (deep compare before and after); each version has a sentence and none contains an id such as `item-` or `floor-`.

### Task 2. Export script
Create `src/viewer/export-sample-run.js` that runs `runSample()`, stops with a clear message if the run failed, and writes `docs/sample-run.json`. Add the script `export-viewer` to `package.json` (no dependencies). Run it once and commit the generated file.
- **Req:** R1.1, R1.3, R1.7, R8.3
- **Verify:** Tests pass for: two exports give identical text; the exported file parses and matches `makeSampleRun(runSample().project)`; the file has no email, phone number, street word or web address (same pattern check as R7.8); `sample-project.json` is unchanged (`git diff` empty). The existing "R7.6" tests still pass with the new `src/viewer/` files.

### Task 3. Scene data (no 3D library yet)
Create `docs/scene-data.js` with `buildScene(sampleRun, version)` and `describeItem(sampleRun, version, itemId)`. No Three.js and no browser code in this file.
- **Req:** R2.1, R2.2, R2.4 to R2.7, R2.9, R3.1, R3.5, R3.6, R4.2 to R4.4, R4.6, R4.8, R5.1 to R5.3, R5.5 to R5.7, R6.2, R6.7, R10.1
- **Verify:** Tests pass for: two floors at different heights; 4 rooms; every door, window and furniture box lies inside its room; style items get markers; the clash report gets no box; Locked and Unsure boxes get different colour names; clash boxes are marked for the Garden door, the Sofa and the oak bed frame marker at the latest version and for none at version 0; an item created after version N is absent at version N; `describeItem` gives name, status in words, owner, kind and room name, and the clash sentence for clash items; no text contains an id; names with `<` or `&` come back as plain text unchanged.

### Task 4. Page shell: text, labels, legend, slider, panel (no 3D yet)
Create `docs/index.html` and `docs/styles.css`: the top and bottom label bars, the "How to use this" line, legend, clash list area, details panel area, version slider (0 to latest, set from the data file), caption, and the content security rule. No Three.js yet, no inline script, no form, no upload control. Also create `docs/viewer.js` with only the non-3D parts: load `sample-run.json`, fill the clash list, the caption and the panel text, and show the plain error message if the file cannot be read.
- **Req:** R1.2, R1.6, R3.2, R3.3, R5.3, R5.6, R6.1, R6.3, R6.5, R7.1 to R7.6, R8.1, R8.2, R8.4, R8.5, R10.1, R10.2
- **Verify:** Tests pass for: the page text for `SAMPLE PROJECT` and the draft statement equals `src/label.js`, top and bottom, and both sit outside the 3D area element; the content security rule is present; no `http://` or `https://`, `localStorage`, `<form`, `type="file"`, `eval(` or `innerHTML` in `docs/index.html`, `docs/viewer.js` or `docs/scene-data.js`; the slider range matches the version count. **How it looks and whether the labels stay visible on a small screen: pending owner check** (the owner can only see it once the page is published, so this is checked at the end).

### Task 5. Get the Three.js copy — NEEDS YOUR APPROVAL AND THE NETWORK CHANGE
**Stop before this task.** I will tell you: "Change Network to Common Dependencies now, then reply 'network changed'." I will also show the exact version and the exact file list and wait for your approval.
Then: download the official Three.js package once into a temporary folder outside the project, copy only the approved files into `docs/vendor/` (main file, the file it depends on if any, `OrbitControls`, and the MIT licence), write `docs/vendor/VERSION.txt`, delete the temporary folder, add the import map to `index.html`. Nothing is added to `package.json`, and no `node_modules` is created in the project.
- **Req:** R9.4, R9.5, R8.2
- **Verify:** `package.json` has no `dependencies` or `devDependencies` (test); `git status` shows no `node_modules`; the copied files are exactly the approved list; `VERSION.txt` names the version and the licence file is present; the page's import map points only to files inside `docs/vendor/`. After this task I tell you to change Network back.

### Task 6. Draw the home in 3D
In `docs/viewer.js`, add drawing: turn the box list from `buildScene` into Three.js boxes, status colours, clash outlines, turning and zooming with `OrbitControls`, a starting camera that shows the whole home, and a plain message if the browser cannot do 3D.
- **Req:** R2.1 to R2.9, R3.1, R3.4, R3.5, R5.1, R5.2, R5.5
- **Verify:** The page script has no syntax errors (`node --check`) and the pure parts still pass their tests. Everything visual is **pending owner check**: the two floors are visible, doors and windows look different from furniture, Locked and Unsure colours are clearly different, and the two clashes show an outline.

### Task 7. Click for details and clash list
Raycasting for clicks and taps; fill the details panel through `describeItem`; clicking empty space or a room closes it; clicking a clash line turns the camera to the first drawn item and opens its panel.
- **Req:** R4.1 to R4.8, R5.4
- **Verify:** Logic tested through `describeItem` and the clash list (already in Task 3 and 4 tests); a test that the panel code only uses `textContent` (code search). **Clicking works in a browser: pending owner check.**

### Task 8. Version slider
Connect the slider to the drawing: on change, rebuild the boxes for that version, refresh or close the panel, update the caption. The page starts at the latest version.
- **Req:** R6.1 to R6.7, R3.6, R5.7
- **Verify:** Tests that `buildScene` at every version agrees with the snapshot (done in Task 3) and that the page's slider has min 0 and max equal to the number of versions. **Slider feels right, items appear and disappear correctly, nothing is stuck: pending owner check.**

### Task 9. README and publishing steps
Add a "3D room viewer" section to `README.md`: what it shows, `npm run export-viewer`, the publishing steps from `design.md` section 8, the expected link, and the plain statement that double-clicking the file does not work and the link must be used. Remove nothing from the existing README.
- **Req:** R9.1 to R9.3
- **Verify:** A test that the README contains the publishing steps and the "does not work from a folder" statement. The link opening for a stranger is **pending owner check after Pages is switched on**.

### Task 10. Final check and acceptance checklist
Create `.kiro/specs/room-viewer/acceptance-checklist.md`, like the Project Brain one: each criterion with its test name, or "pending owner check". Run all tests. Check `LICENSE`, `.gitignore`, and that nothing was installed beyond the approved Three.js copy. Add a `KIRO_LOG.md` entry.
- **Req:** all
- **Verify:** `node --test` all pass. Every test name quoted in the checklist is matched against the test files by a script. The checklist's "unverified, in short" list names every looks-and-feel item for the owner.

---

## Order and approvals at a glance
1. You approve this spec and answer the two questions.
2. Tasks 1 to 4: no network, no installs.
3. Task 5: I stop. You change Network to Common Dependencies and approve the file list. After the task, you change it back.
4. Tasks 6 to 10.
5. You review the pull request, merge, then switch on GitHub Pages (design section 8) and open the link.
