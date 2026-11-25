# lock-guard review, design-team Group D (2026-11-25)

A custom agent cannot be launched from Kiro Web, so the `general-task-execution` sub-agent ran the read-only brief from `.kiro/agents/lock-guard.json`. The sub-agent read the code and tests and ran nothing. I ran `npm test` separately and got 948 tests, 948 passed.

**Scope.** These files changed in Group D:
- `src/team-coordinator.js` (the steps record and log fields)
- `src/proposal.js` (the `ai` and `aiNote` fields)
- `src/agents/team-style/agent.js` (asks the AI gate when two options are close)
- `src/ai/gate.js`, `src/ai/stand-in.js` and `src/photo-step.js`
- `src/sample/run-team-sample.js`
- `docs/intake/team-run.js` and `docs/intake/team-screen.js`
- `src/knowledge/load.js`

`docs/team/` is a generated copy of `src/`, so it was not reviewed separately.

`src/brain/`, `src/coordinator.js`, `src/agents/config.js` and `src/agents/reviewer/` were not changed on this branch.

**Verdict as returned: "No problems found."**

## What the reviewer confirmed

**Every change still goes through the gatekeeper.**
- The team Coordinator applies answers with `changeItem` and `refreshBasis` from `createGatekeeper`, under the agent's own name.
- The new `history` and `steps` record holds only proposals and answers, and is never written to an item.
- The new log fields go to `project.runLog` only.

**The page and the AI files cannot write to the Brain.**
- The page screen (`team-screen.js`) changes things only through `run.answer`.
- `createItem` is used only to build the starting Brain, in `team-run.js` and `run-team-sample.js`, before a run starts.
- `src/ai/*` and `src/photo-step.js` import nothing from the Brain.

**The rule order and the Style agent are unchanged where it matters.**
- The order of checks is unchanged: Locked is refused first, then a non-owner, then the change is accepted with one version.
- No agent changes a status.
- The Style agent still proposes only for Unsure notes. Its AI step can reorder the two options or add a note, and never writes.

**The tests the reviewer relied on** (read by title, not run):
- `test/gatekeeper.test.js`:
  - `R5.1/R5.2: the owner is refused on a Locked item and the value is identical before and after`
  - `R4.4: a non-owner is refused on an Unsure item`
  - `check order: Locked is checked before owner, so a non-owner on a Locked item gets the Locked reason`
  - `R8.4: refusals create no version`
  - `R5.4: an agent cannot unlock an item, even its owner, and this is logged`
- `test/team-brain.test.js`:
  - `design-team A2: Locked is still refused before the owner check, for a new kind`
  - `design-team A2: a write by the wrong agent is refused and logged, and writes no version`
  - `design-team A2: only the user can change a status, as before`
- `test/team-coordinator.test.js`:
  - `design-team A6: a Locked item is never changed, is refused by the gatekeeper, and is flagged "needs your look"`
  - `design-team A6: an agent gets a read-only view and cannot write to the Brain`
  - `design-team A6: only the two Coordinators call the gatekeeper in src/, and the team Coordinator never calls changeStatus`
- `test/team-style.test.js`: `design-team C3: a Locked style note is never proposed for a change, and the gatekeeper refuses it`
- `test/team-sample.test.js`: `D6: the sample shows a request to Walls, one skipped suggestion ("kept as is"), and the Locked items unchanged`
- `test/team-page-session.test.js`: `D4 / R3.5: the Locked sofa is never changed by the team`

**Existing test files changed on this branch.** The reviewer judged none of them weakened:
- These now count one key per drawn part:
  - `intake-accessibility-privacy`
  - `intake-result`
  - `viewer-show-run-data`
- These now take the sample from `runTeamSample`. `reviewer-overall` still also checks the old four-agent run.
  - `intake-build-brain`
  - `reviewer-overall`
  - `sample-baseline`
  - `viewer-export`
- These have the new cache tag:
  - `intake-screens`
  - `viewer-real-script`
- These have new numbers and ids. They keep or widen their checks.
  - `place-shapes`
  - `place-viewer-shapes`
  - `viewer-labels`
  - `viewer-readability`
  - `viewer-scene`
  - `viewer-slider`

These four test files are unchanged, and no test file was deleted:
- `test/gatekeeper.test.js`
- `test/team-coordinator.test.js`
- `test/team-brain.test.js`
- `test/team-style.test.js`

## Small suggestions (not problems)
- `test/team-review-screen.test.js` has no test whose title names Locked or the gatekeeper. The page only calls `run.answer`, and the tests above cover that path.
- No test checks that the `steps` record returns copies. The reviewer rated the risk as low.

## What the reviewer could not check
- It did not run the tests.
- It did not read every line of `test/team-review-screen.test.js`, `test/team-viewer.test.js` or `docs/intake/team-screen.js`.
- It did not check that `docs/team/` is a true copy. `test/team-page-session.test.js` checks this.
