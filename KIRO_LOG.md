# Kiro Log

One entry per session.

## 2026-11-18, Session 1
- **Kiro app used:** Web
- **Kiro feature used:** Steering. It gives Kiro the product, tech, and working rules in every session.
- **Result:** Created `.kiro/steering/product.md`, `tech.md`, `working-rules.md`, this log, and a `.gitignore` for standard build folders only.
- **How it was verified:** Listed the files, searched `.gitignore` to confirm `.kiro` is not in it, confirmed each steering file has a "HACKATHON MODE" heading, and confirmed `LICENSE` is unchanged with `git status`.
- **Credits used:** included in the total below (3.09 credits across sessions 1-3)
- **Next step:** Owner reviews and merges the pull request. Then decide the first small build step.

## 2026-11-18, Session 2
- **Kiro app used:** Web
- **Kiro feature used:** Spec. The Project Brain and Sample-mode pipeline has many linked rules (owners, Locked items, fixed agent order, version history), so a spec gave us written requirements, a design and ordered tasks that the owner approved one at a time before any code.
- **Result:** Created `.kiro/specs/project-brain/requirements.md` (10 requirements with testable acceptance criteria), `design.md` (plain JavaScript, no framework, no installs; gatekeeper design), and `tasks.md` (17 small tasks, each with a check). No app code written.
- **How it was verified:** Owner reviewed and approved each file in turn. Requirements changes (R9.3 reduced to two clash types, R9.4 adjusted) were re-read after editing. Checked `.gitignore` does not list `.kiro`, and `git status` shows `LICENSE` unchanged. The specs themselves are documents, so the build checks are defined in `tasks.md` and have not been run yet.
- **Credits used:** included in the total below (3.09 credits across sessions 1-3)
- **Next step:** Owner reviews and merges the pull request. Then start Task 1 of `tasks.md`.

## 2026-11-18, Session 3
- **Kiro app used:** Web
- **Kiro feature used:** Spec (building Tasks 1 to 3 of `.kiro/specs/project-brain/tasks.md` one at a time, so each step had a written check) and Steering (`working-rules.md`, `tech.md`: plain JavaScript, no installs, small steps).
- **Result:** Task 1: `package.json` (no dependencies, `npm test` runs `node --test`) and the folder layout from `design.md`, with a `.gitkeep` in each empty folder. Task 2: `src/brain/brain.js` (project, floors, rooms, validation, stable order). Task 3: `src/brain/inspiration.js` (overall set, room overrides, effective inspiration). Tests in `test/`.
- **How it was verified:** Task 1: `node --test` and `npm test` both exit 0 with 0 tests; `package.json` has no dependency sections; no `node_modules`. Task 2: 9 tests pass. Task 3: 16 tests pass in total (7 new). Also checked `.gitignore` does not list `.kiro` and `LICENSE` is unchanged.
- **Credits used:** 3.09 in total across sessions 1-3
- **Next step:** Owner reviews and merges the pull request. Then do Tasks 4 to 7 (items, versions, gatekeeper, past versions).

## 2026-11-18, Session 4
- **Kiro app used:** Web
- **Kiro feature used:** Spec (building Tasks 4 to 7 of `.kiro/specs/project-brain/tasks.md` one at a time, each with its written check) and Steering (`working-rules.md`: small steps, report how each step was verified, no installs, stop if something fails twice).
- **Result:** Task 4: items with kind, room, value, status (default Unsure) and exactly one owner matching the kind, in `src/brain/brain.js`. Task 5: append-only version history (`appendVersion`, `listVersions`). Task 6: `src/brain/gatekeeper.js`, where a change checks Locked first, then non-owner, then is accepted and writes a version; refusals go to the run log and write no version; only the user can change status. Task 7: `getBrainAtVersion` replays history to show the Brain at a past version without changing the current one. Versions carry one extra field (`field`: value or status) so status changes can be replayed.
- **How it was verified:** `node --test` after each task. New tests: Task 4 has 10, Task 5 has 5, Task 6 has 14 (including a test that Locked is checked before owner), Task 7 has 8. The full suite shows 53 tests passing, 0 failing. One earlier test was updated because Task 7 added a new read-only export. No installs; `package.json` is unchanged; `.gitignore` does not list `.kiro`; `LICENSE` is unchanged.
- **Credits used:** ___
- **Next step:** Owner reviews and merges the pull request. Then do Tasks 8 to 10 (agent configs and label, Coordinator, sample data).

## 2026-11-18, Session 5
- **Kiro app used:** Web
- **Kiro feature used:** Spec (building Tasks 8 to 11 of `.kiro/specs/project-brain/tasks.md` one at a time, each with its written check) and Steering (`working-rules.md`: small steps, report how each step was verified, no installs, stop if something fails twice; `tech.md`: plain JavaScript, no dependencies).
- **Result:** First, `tasks.md` was updated to match the owner's approvals (`createGatekeeper(project)` with `changeItem` and a user-only `changeStatus`, the extra `field` in each version, strict owner-by-kind). Task 8: `agent.json` for the four agents, `src/agents/config.js` (loads and checks them; Reviewer always on) and `src/label.js` (the shared "SAMPLE PROJECT" label and draft statement). Task 9: `src/coordinator.js`, which runs the agents in fixed order with a frozen read-only view, sends each agent's proposals to the gatekeeper under the agent's own name, logs started, finished, skipped and failed, and stops on the first failure. Task 10: `src/sample/sample-project.json` (2 floors, 4 rooms, bedroom override, 2 Locked and 7 Unsure items, a style conflict list, a door on a sofa, and an override that conflicts with a Locked oak item). Task 11: `src/agents/style/agent.js`, a rule-based Style agent that proposes changes to Unsure style items only; the sample version also tries one Locked item so the refusal shows in the run log.
- **How it was verified:** `node --test` after each task. Task 8: 8 new tests (61 in total). Task 9: 16 new tests (77 in total), including tests that a direct write to the Brain fails and that a throwing agent stops the run. Task 10: 8 new tests (85 in total) plus a search of the file for emails, links, phone numbers and street words (none found). Task 11: 8 new tests (93 in total). One Task 11 test was too strict (it flagged the agent's own local list) and was narrowed; no task failed twice. No installs; `package.json` is unchanged; `.gitignore` does not list `.kiro`; `LICENSE` is unchanged.
- **Credits used:** ___
- **Next step:** Owner reviews and merges the pull request. Then do Tasks 12 to 14 (Layout, Builder and Reviewer agents).

## 2026-11-18, Session 6
- **Kiro app used:** Web
- **Kiro feature used:** Spec (building Tasks 12 to 14 of `.kiro/specs/project-brain/tasks.md` one at a time, each with its written check) and Steering (`working-rules.md`: small steps, report how each step was verified, no installs, stop if something fails twice; `tech.md`: plain JavaScript, no dependencies).
- **Result:** Task 12: `src/agents/layout/agent.js`, which proposes a "placement checked" note on Unsure layout items and keeps names and positions. Task 13: `src/agents/builder/agent.js`, the same for Unsure doors and windows, so the door-on-sofa case stays. Task 14: `src/agents/reviewer/agent.js`, which only reads and checks two clash types (door or window on furniture, room override against a Locked style item, using the sample's conflict list). It proposes one change, the report, to the Reviewer-owned clash item, so the report goes through the gatekeeper into version history. The report carries the sample label and the draft statement, or says "No clashes found". The sample gives 2 clashes, one of each type. Also added a note to Task 15 in `tasks.md`: the full run must use `sampleStyleAgent` so the Locked-item refusal shows in the run log.
- **How it was verified:** `node --test` after each task. Task 12: 8 new tests (101 in total). Task 13: 8 new tests (109 in total). Task 14: 14 new tests (123 in total, 0 failing). No task failed. No installs; `package.json` is unchanged; `.gitignore` does not list `.kiro`; `LICENSE` is unchanged.
- **Credits used:** ___
- **Next step:** Owner reviews and merges the pull request. Then do Tasks 15 to 17 (full sample run, summary page, final check).
