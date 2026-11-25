# submission-checker, design-team Group D (2026-11-25)

A custom agent cannot be launched from Kiro Web, so the `general-task-execution` sub-agent ran the read-only brief from `.kiro/agents/submission-checker.json`. It used only the commands that brief allows. It ran on branch `build-team-4` with all work committed, and found `git status` empty before and after.

**Ready to submit.**

- [Passed] 1. `.kiro` is in the repo and not ignored. 37 files are tracked. `git check-ignore -v .kiro` printed nothing, and no line in `.gitignore` names kiro.
- [Passed] 2. KIRO_LOG.md has an entry for every session. Sessions 1 to 35 are there, with no gap or repeat, and each entry has the six lines. Blank "Credits used" lines are expected. Limit: a session that left no trace cannot be seen.
- [Passed] 3. No secrets. `test/no-secrets.test.js` ran 3 tests and all 3 passed. No environment, key or certificate file is tracked.
- [Passed] 4. README has "How to use the app" at line 7, with real steps. `test/readme-how-to-use.test.js` ran 3 tests and all 3 passed.
- [Passed] 5. LICENSE is the AGPL v3 text. It has one commit, "Initial commit", and was never changed.
- [Passed] 6. Every live cache tag is `build-team-4`. That covers the three `?v=` addresses in `docs/index.html` and the `PAGE_VERSION` constants in `docs/viewer.js` and `docs/intake/screens.js`.
- [Passed] 7. All tests pass: `npm test` ran 948 tests and all 948 passed.

Notes:
- `node test-helpers/check-checklist.js .kiro/specs/design-team/acceptance-checklist.md` checked 76 quoted test names, and all of them match a test.
- The checker tool counts 945 unique test names and `npm test` counts 948 tests. Some test names are used twice in different files, so the two counts differ.

Files changed by the checker: none.
