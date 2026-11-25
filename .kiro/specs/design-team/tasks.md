# Tasks: Design team

Status: draft, waiting for the owner's approval. Nothing here is built yet.

Four groups of six tasks. Build one group at a time. Each group ends in a working, tested state, and I stop at the end of each group for the owner to check and merge.

Rules for every task:
- Plain JavaScript, no framework, no build tool. **No installs, no downloads, no new dependencies.** `package.json` changes only to add a script, and only with the owner's yes.
- Do the tasks of a group in order. After each task, run the tests and report exactly how it was verified. A task is not finished until its check passes. Anything only a person can judge on a real device or in a real browser is written down as "pending owner check", never as Passed.
- All existing tests (648 today) must pass after every task. None is deleted or weakened. Expected values change only in Task D6, and only as listed there.
- After every task before D6: `git diff docs/sample-run.json src/sample/sample-project.json sample-summary.html` is empty.
- After any task that edits a file under `src/`: run `npm run export-engine` and confirm the byte-for-byte engine test passes.
- Do not touch `LICENSE`. Keep `.kiro` out of `.gitignore`. No secrets and no personal data in any file.
- Knowledge files: own words, open sources only (R6). Never paste from a paid or copyrighted source. Each knowledge task ends with the list of sources shown to the owner.
- If a task fails twice, stop and explain. Add one `KIRO_LOG.md` entry per session, with `Credits used:` left blank. Open one pull request per group, at the end of the group.

"Req" shows which requirements the task covers.

---

## Group A. Foundation (Tasks A1 to A6)

### Task A1. The agent registry
Add `src/agents/registry.json` (order and direct dependencies, design section 4.4) and a small reader `src/agents/registry.js` that validates it: eight names, nobody depends on a later agent, the Reviewer is last. The old `AGENT_ORDER` and the old pipeline are not touched.
- **Req:** R1.1, R1.3, R1.6
- **Verify:** New tests: the order is the eight names in the vision order; a registry with a backwards dependency is rejected with a message; a scan shows no other list of the eight names in `src/` outside the registry and its tests. The old 648 tests still pass.

### Task A2. Brain and gatekeeper additions
Add the new kinds and the eight owner names to `brain.js` (`KIND_OWNER`, `OWNERS`), keep `layout` as the Furniture kind, and allow optional `basis`, `source` and `approvedBy` on items and versions. Edit `gatekeeper.js` additively so `changeItem` accepts and records `basis` and `approvedBy`. The Locked-first, owner-second order is not changed.
- **Req:** R2.1, R2.2, R2.3, R9.1, R9.2, R11.1
- **Verify:** New tests: each new kind has the right owner; an item with no owner, two owners or an unknown owner is rejected; Locked is still refused before owner for a new kind; a wrong-owner write is refused and logged; the version record holds `basis` and `approvedBy`; old projects load unchanged. Run the `lock-guard` custom agent and show its report.

### Task A3. Knowledge file format and loader
Add `src/knowledge/README.md` (the "own words, open sources only" rule), `allowed-licences.json`, a loader `src/knowledge/load.js` that reads a file and returns its rules, and the provenance test (design section 5.4). Add one small example file under `src/knowledge/shared/` (room types) to prove the loader. Extend `engine-files.js` so knowledge files are copied to `docs/engine/knowledge/`.
- **Req:** R5.3, R6.1, R6.2, R6.3, R6.4, R6.5
- **Verify:** New tests: a file with no provenance, no source, a licence outside the list, or a text field over the limit is rejected, each with its own message; the example file loads; `npm run export-engine` copies it and the byte-for-byte test passes. Show the owner the source list of the example file (pending owner check).

### Task A4. Proposals, options and tags
Add `src/proposal.js`: build and check a proposal (design section 4.1). Rules: 1 to 4 options, "Custom" last, low confidence gives exactly two real options plus Custom, a request names an earlier item. Add the Rule-based / AI tag helper to `src/label.js`.
- **Req:** R4.2, R4.3, R4.4, R8.1
- **Verify:** New tests for each rule above, and for a malformed proposal being rejected with a clear message. The existing label tests pass unchanged.

### Task A5. Basis and stale
Add `src/ripple.js`: `findStale(project)` follows chains through the basis, and `agentsToRecheck(project)` returns the agents to run, in order, with a reason each. Keep the basis outside the version list.
- **Req:** R3.1, R3.2, R3.3, R3.7
- **Verify:** New tests on a small made-up project: moving a wall makes the door, floor, light, furniture, decor and style items based on it stale, and not items in an unrelated room; changing a decor item makes only Style and Reviewer items stale; an agent with nothing stale is reported "Not affected" with a reason; a backwards basis is reported as an error.

### Task A6. The run as steps, with scripted answers
Add `src/team-coordinator.js` (design section 7): `createRun`, `next`, `answer`, `done`, `runWithScript`. It reuses `makeReadOnlyView` and the run-log format, answers go through the gatekeeper with `approvedBy`, a skipped proposal marks the item "kept as is", and the ripple starts after an accepted change. Agents are stand-ins in this task.
- **Req:** R1.2, R1.4, R1.5, R3.3, R3.4, R3.5, R3.9, R4.1, R4.5, R4.6, R4.7, R4.8
- **Verify:** New tests with stand-in agents: fixed order; an agent that is off is skipped and its dependents say so; a failing agent stops the run and earlier changes stay; nothing changes until `answer` is called; skip marks "kept as is"; a Locked item is never changed and is flagged "needs your look"; a ripple pass runs each agent at most once; the same script twice gives the same result. The old `runPipeline` tests pass unchanged.

**Stop for the owner after Group A.** Open one pull request.

---

## Group B. Walls, doors and windows, floors and ceilings, lighting and electrical (Tasks B1 to B6)

### Task B1. Walls agent and its knowledge
`src/agents/walls/` (`agent.js`, `agent.json`) and `src/knowledge/walls/` (minimum room sizes, wall thickness). Reads the user's room sizes. Proposes wall segments per room, shares walls between neighbours, and shows two options when a room has no entered size.
- **Req:** R1.1, R2.2, R2.4, R4.4, R5.1, R5.2, R5.5, R6.1 to R6.4
- **Verify:** New tests: the same input twice gives the same proposals; each result names its rule; a room with no size gets two options plus Custom; every knowledge file passes the provenance test. Show the owner the source list (pending owner check).

### Task B2. Doors and windows agent and its knowledge
`src/agents/doors-windows/` and `src/knowledge/doors-windows/` (door sizes, swing clearance, daylight). Reads walls. Takes over the `door` and `window` kinds, keeps the user's placed doors and windows as starting positions, checks fit on the wall, corner distance and swing, and proposes fixes.
- **Req:** R1.3, R2.2, R4.4, R5.1, R5.2, R6.1 to R6.4
- **Verify:** New tests: a door too near a corner gets a proposal; a door that fits gets none; a window-less living room gets a daylight proposal; the agent never reads a later agent's item (a test passes a view with only earlier items). Provenance test passes. Sources shown to the owner.

### Task B3. Floors and ceilings agent and its knowledge
`src/agents/floors-ceilings/` and `src/knowledge/floors-ceilings/` (surface by room type, ceiling heights, thresholds). Reads walls and doors. Proposes a surface per room, a threshold under each door where surfaces change, and a ceiling height check.
- **Req:** R1.3, R2.2, R4.4, R5.1, R5.2, R6.1 to R6.4
- **Verify:** New tests: a bathroom gets a wet-safe surface option; a threshold sits under a door between two surfaces; a low ceiling is flagged; same input, same result. Provenance test passes. Sources shown to the owner.

### Task B4. Lighting and electrical agent and its knowledge
`src/agents/lighting-electrical/` and `src/knowledge/lighting-electrical/` (light levels, socket spacing, switch placement, wet zones). Reads walls, doors and windows, ceilings. Proposes fixtures, a switch by each door, sockets by wall length, and keeps sockets out of wet zones.
- **Req:** R1.3, R2.2, R4.4, R5.1, R5.2, R6.1 to R6.4
- **Verify:** New tests: every room gets a switch near its door; a socket proposed inside a wet zone is rejected by the agent's own check; the number of sockets follows the wall length rule; the output says it is a draft for professional review, not an electrical design. Provenance test passes. Sources shown to the owner.

### Task B5. Ripple across the first four agents
A test project run through the four agents, then a wall is moved by a scripted answer. Check that the ripple re-checks exactly the right agents and items, as in design section 6.
- **Req:** R3.2, R3.3, R3.4, R3.8
- **Verify:** New tests: after the wall move, the door on that wall, both rooms' floors and ceilings and the lights are stale and re-checked; an unrelated room is "Not affected"; "still fine" adds a run-log line and no version; a changed answer adds a version with `approvedBy` and the basis.

### Task B6. Group B checkpoint
Run all four agents through the step Coordinator on one made-up project, print the run log and the proposals as plain text, and write the checkpoint into the log.
- **Req:** R1, R3, R4, R5, R6
- **Verify:** `npm test` all pass; `git diff` of the sample files is empty; the byte-for-byte engine test passes. The owner reads the printed run and the source lists (pending owner check).

**Stop for the owner after Group B.** Open one pull request.

---

## Group C. Furniture, decor, style, reviewer (Tasks C1 to C6)

### Task C1. Furniture agent and its knowledge
`src/agents/furniture/` and `src/knowledge/furniture/` (sizes, clearances, layout patterns). Reads walls, doors and windows, floors, lighting. Treats the user's placed objects (place-items) as starting positions. Checks clear walking space, door swing, bed and wardrobe rules, sockets reachable. When a piece cannot fit, raises a request to an earlier agent (design section 4.3) with two options.
- **Req:** R1.3, R2.2, R2.5, R3.6, R4.4, R5.1, R5.2, R6.1 to R6.4
- **Verify:** New tests: a sofa that does not fit raises a request to Walls with two options plus Custom; Furniture never writes a wall item (the gatekeeper refuses it if tried); placed objects from the intake are read unchanged; the old place-items tests pass. Provenance test passes. Sources shown to the owner.

### Task C2. Decor agent and its knowledge
`src/agents/decor/` and `src/knowledge/decor/` (hanging heights, rug sizes, curtains). Reads walls, windows, lighting, furniture. Proposes a rug under the seating group, art at a hanging height, curtains by window width.
- **Req:** R1.3, R2.2, R4.4, R5.1, R5.2, R6.1 to R6.4
- **Verify:** New tests: rug size follows the seating group; art height follows the rule; moving a sofa makes the rug stale and re-checked. Provenance test passes. Sources shown to the owner.

### Task C3. Style agent and its knowledge
Rebuild `src/agents/style/` for the new path (design 10.1) and add `src/knowledge/style/` (style families, palettes, conflict pairs). Style items are notes that point at other items and carry no geometry. The old rule of adding the room's effective inspiration to Unsure style items is kept. Taste judgement is rule-based here; the AI gate comes in Group D.
- **Req:** R1.3, R2.2, R5.1, R5.2, R9.3
- **Verify:** New tests: a floor's style note is a `style` item that points at the floor and the floor item is untouched; a cold-steel note in a warm-oak room is a conflict pair; same input, same result; the old Style tests pass. Provenance test passes. Sources shown to the owner.

### Task C4. Reviewer extension and its knowledge
Extend `src/agents/reviewer/agent.js` (design section 8) with checks read from `src/knowledge/reviewer/checks.json`. Add the reports for stale items, items kept as is and Locked items needing a look. The four existing check functions are not edited.
- **Req:** R10.1 to R10.6, R3.5, R3.9
- **Verify:** New tests: each new check fires on a made-up project and stays quiet on a clean one; a stale item is reported; a skipped proposal is reported "kept as is"; with no findings the report says "No clashes found, using these checks:" and lists them; the Reviewer cannot be turned off; the old Reviewer tests pass unchanged.

### Task C5. Eight agents end to end
Run a made-up two-room project through all eight agents with scripted answers: a wall move ripples to the rest; a low-confidence case shows two options; one request goes from Furniture to Walls; one proposal is skipped.
- **Req:** R1, R3, R4, R5, R10, R11.2
- **Verify:** New end-to-end tests: the run log shows the eight agents in order; the ripple re-checks only what depends on the wall; every proposal has a source tag and a rule id; two runs give identical results; the Locked item is unchanged.

### Task C6. Group C checkpoint
Print the full run as plain text, update `KIRO_LOG.md`, and list every knowledge file with its sources for the owner.
- **Req:** R6.6, R11
- **Verify:** `npm test` all pass; sample files unchanged; engine test passes; `lock-guard` run and its report shown. Source lists and the printed run are marked pending owner check.

**Stop for the owner after Group C.** Open one pull request.

---

## Group D. AI gate, honesty, browser, sample swap (Tasks D1 to D6)

### Task D1. The AI gate, budget and stand-in
`src/ai/gate.js`, `src/ai/budget.json`, `src/ai/stand-in.js` (design section 9). Two tasks allowed, cap defaults to zero, the estimate is checked before the call, spent and remaining are tracked, the provider is injected. Output is checked against the style vocabulary.
- **Req:** R7.1 to R7.6
- **Verify:** New tests: any other task is refused; a call that would pass the cap is refused; with the cap at zero nothing is called; the stand-in answer is labelled "stand-in, not a real model"; an answer with a tag outside the vocabulary is cut; a scan finds no network code, no web address and no key-like text in `src/ai/`. No key, no network.

### Task D2. Style and photo reading use the gate, with fallback
The Style agent asks the gate for taste judgement when two options are close. A photo-reading step is added behind the same gate, off by default. When AI is off, refused or failed, the agent uses its rules and says so.
- **Req:** R7.4, R7.7, R8.3, R8.5
- **Verify:** New tests: with the cap at zero the result equals the rule-only result and says "AI was not used"; with the stand-in and a cap, the proposal is tagged `ai` with the task name and cost; a refused call falls back; the intake still says images are not read while AI is off.

### Task D3. Honest wording everywhere
Update the summary (`make-summary.js`), the intake report (`report.js`) and the result text so every line carries Rule-based or AI, the fixed sentence of R8.2 is shown, and "scripted answer" is shown for scripted runs. Replace the old "fixed rules, not AI" sentence by the new one only while AI can be on; while the cap is zero, both are true and the old sentence stays.
- **Req:** R8.1 to R8.5, R4.8
- **Verify:** New tests on the generated text: every proposal line has a tag; "understand" or "notice" appears only next to an AI result; the label and draft statement are on every output. Expected-value edits to existing tests are listed in the log, line by line, and nothing is loosened.

### Task D4. The Review and run screen steps through the agents
In `docs/intake/`, the Review and run screen runs the step Coordinator: it shows each agent's proposals with their options, tag and reason, takes the user's answer (including Custom and Skip), and shows what was re-checked. Keyboard and screen-reader behaviour follow the earlier screens (focus moves to the new heading, one-sentence announcement, 44 px targets, 320 px wide).
- **Req:** R4.1 to R4.7, R3.3, R8
- **Verify:** New tests on the stand-in page: a proposal shows two options plus Custom when unsure; Skip marks "kept as is"; the next agent starts only after the answers; the same checks as the place screen for sizes, tab order and no storage or network. Real-browser look is pending owner check.

### Task D5. The viewer shows the team
In `docs/`, a panel lists the eight agents in order with what each did, which were re-checked and why, and the tags; new item kinds are drawn as simple shapes. No new library. The sample still draws as before.
- **Req:** R11.3
- **Verify:** New tests on the scene data and page text; the existing viewer tests pass; the sample's boxes keep the same fingerprint as before. Real-browser look is pending owner check.

### Task D6. Sample swap, README and final check (needs the owner's yes first)
Ask the owner before starting. If yes: build a new sample that runs through the eight agents with scripted answers, regenerate `docs/sample-run.json` and `sample-summary.html`, and update only the expected values in the existing "sample is unchanged" tests, each listed in the log with old and new value. Retire the old Layout and Builder agents and `runPipeline` from the sample path (delete only with the owner's yes). Update `README.md`, add `acceptance-checklist.md` for this spec, and update `product.md` so it no longer says there are four agents or that Locked and Unsure are core.
If no: leave the sample as it is and say so.
- **Req:** R11.4, R12
- **Verify:** `npm test` passes in full; the checklist checker matches every named test; no secret and no personal data found; `.kiro` is not in `.gitignore`; `LICENSE` is unchanged; `package.json` changed only as approved; `lock-guard` and `submission-checker` run and their reports shown. Unverified items are listed as "pending owner check", including the real-browser look.

**Stop for the owner after Group D.** Open one pull request.
