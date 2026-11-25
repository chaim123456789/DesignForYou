# lock-guard review, design-team Task A2 (2026-11-25)

Run by the `general-task-execution` sub-agent using the read-only brief from `.kiro/agents/lock-guard.json`, because a custom agent cannot be launched from Kiro Web. The sub-agent read code and tests and did not run them. I ran `npm test` separately.

**Verdict: No problems found.**

- Every change to an item's value or status still goes through `changeItem` / `changeStatus` in `src/brain/gatekeeper.js`. The new `basis` write is inside `changeItem`; the other new writes are inside `createItem`.
- Order of checks is unchanged: Locked first (even for the owner), then non-owner, then the new-value check, then the new optional `details` (basis, approvedBy) checks, then one version. A refusal writes no version and goes to the run log. Only the user can call `changeStatus`.
- `src/coordinator.js` is unchanged. It never passes `details`, so an agent cannot supply `basis` or `approvedBy` through the old pipeline.
- Tests relied on: `test/gatekeeper.test.js` (Locked refused for owner; Locked before owner; non-owner refused; refusals logged; refusals create no version; agent cannot unlock), `test/coordinator.test.js`, the per-agent tests, `test/lock-guard-gaps.test.js`, and the new `test/team-brain.test.js`.

Suggestion taken: a test that bad `details` on a Locked item or a wrong owner still gives a refusal, not an error ("bad details on a Locked item or a wrong owner give a refusal, not an error (refusals come first)").
Suggestion not taken: `changeItem(..., null)` throws a TypeError after the refusals. Harmless; left as is.

Could not check: the reviewer did not run the tests, did not read the spec, and did not review the registry files.

---

## Second run, Task A6 (same method, same read-only brief)

**Verdict: sound, no real defects.** Every change still goes through the gatekeeper (`changeItem`, `refreshBasis`). The team Coordinator never writes to the Brain directly and never calls `changeStatus`. Agents get a frozen read-only view. A request is applied under the earlier item's owner, never the asking agent. Locked is refused first, then the owner, in both `changeItem` and the new `refreshBasis`; refusals write no version.

Findings and what was done:
1. `test/sample-run.test.js` only looks for `.changeItem(` with a dot, so `src/team-coordinator.js`, which uses the destructured function name, is not covered. Not edited (existing test). Added a new test, "only the two Coordinators call the gatekeeper in src/, and the team Coordinator never calls changeStatus", that matches the bare names and fixes the allowed callers.
2. The team Coordinator checked "Locked" itself and never called `refreshBasis` for a Locked item, so the refusal was not logged. Changed: it now always calls `refreshBasis`, the gatekeeper refuses and logs, then the Coordinator flags "needs your look". New test: "a stale Locked item's refused refresh is written to the run log".
3. No test for the order of checks in `refreshBasis`. Added: "refreshBasis checks Locked before the owner, keeps the basis on a refusal, and an owner is accepted".

Could not check (reviewer): it did not run the tests, did not check `docs/engine` byte equality (the engine-export test does), did not review `checkBasis`/`appendVersion` or the real agents.
