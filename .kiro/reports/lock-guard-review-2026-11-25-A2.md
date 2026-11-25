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
