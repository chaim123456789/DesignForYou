# lock-guard review, design-team Group C (2026-11-25)

Run by the `general-task-execution` sub-agent using the read-only brief from `.kiro/agents/lock-guard.json`, because a custom agent cannot be launched from Kiro Web. The sub-agent read code and tests and did not run them. I ran `npm test` separately.

Scope: `src/team-coordinator.js` (changed in Group C), the four new agents (`furniture`, `decor`, `team-style`, `team-reviewer`), `src/agents/common.js`, `src/team-slots-later.js`. `src/brain/gatekeeper.js` and `src/brain/brain.js` were not changed in Group C.

**Verdict as returned: "Problems found" (one small gap, plus test gaps). No way around the Locked or owner rules was found.**

Confirmed by the reviewer:
- Order of checks unchanged: Locked first (even for the owner), then non-owner, then accept and write one version. Same order in `refreshBasis`. Only the user can call `changeStatus`.
- Item values, status, basis and versions are written only in `gatekeeper.js` (and `createItem` / `appendVersion` in `brain.js`). The four new agents and `common.js` import no gatekeeper function and write nothing. `team-slots-later.js` uses `createItem` only.
- A request from Furniture is applied under the owner's name (Walls) through `changeItem`, so a Locked wall is refused, logged, and flagged "needs your look".
- A Locked item is flagged and reported before it is ever treated as "unfixable", so it is not hidden.

Findings and what was done:
1. **Real gap (medium confidence):** the "unfixable" rule started from every skipped item and counted any item stale because of it as unfixable, even when the reason was "that item changed" (which its owner can still fix). **Fixed:** a new function `findUnfixable` in `src/team-coordinator.js` counts an item as unfixable only when every reason is "that item is itself stale" and that item is unfixable. A "changed in version N" reason is always fixable. New test: "findUnfixable follows 'is itself stale' step by step, but never counts a plain 'changed' reason".
2. Test gap: no test of a request aimed at a Locked wall. **Added:** "a request aimed at a Locked wall is refused by the gatekeeper, flagged 'needs your look', and the wall stays as it was".
3. Test gap: no static test that the new agents cannot write. **Added:** "the four new agents import nothing that can write to the Brain and never call the gatekeeper".
4. Test gap: the transitive part of the unfixable rule. **Added** (same test as finding 1) plus "a Locked item, or one the user skipped, does not make the Coordinator re-check again and again" (checks the exact list of steps of the end-to-end run).

Could not check (reviewer): did not run the tests; did not read `docs/intake/` or `docs/engine/` for item writes (the existing test "no shortcut around the Coordinator" and the byte-for-byte engine test cover those); read only the Locked and request tests of the four new per-agent test files.
