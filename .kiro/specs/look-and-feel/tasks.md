# Tasks: Look and feel

Status: approved by the owner in the build request. Six tasks, all built on branch `build-look-1`, one pull request. Test names start with `look-and-feel T<number>` (files `test/look-theme`, `look-workspace`, `look-agents`, `look-settings`, `look-3d`). Pending owner check: how it looks on a real phone and with a screen reader.

Rules for every task:
- No installs, no network, no new dependency. Plain JavaScript and CSS.
- Do not weaken the gatekeeper or Locked tests. `src/brain/gatekeeper.js` is not edited.
- After a change under `src/`, run `npm run export-engine`.
- A task stops the run only if it fails twice.
- Anything only a person can judge in a real browser is "pending owner check".

### Task 1. Theme file
`docs/theme.css` with all colours (light and dark), fonts, spacing, radii, agent colours and 3D colours. Rewrite `docs/styles.css` to use only `var(--...)`. Dark and light mode, AA contrast, visible focus.
- **Req:** R5
- **Verify:** `look-and-feel T1` tests: no colour, font-family or spacing literal outside the theme file; contrast of every text pair and border pair in both modes is at least AA; focus ring defined; the page loads `theme.css` with the cache tag.

### Task 2. Home page and workspace
New `index.html` layout, `workspace.js`, new screens `agents`, `materials`, `settings`. Home page, top bar, rail, centre, agent strip, ribbon toggle, full screen, theme toggle, phone tabs.
- **Req:** R1, R2
- **Verify:** `look-and-feel T2` tests on the stand-in page: home content and ids, rail opens each page, ribbon toggle, theme toggle sets `data-theme`, full screen with and without the browser feature, the page does not scroll (CSS), phone rule.

### Task 3. Agents page
`agent-info.js`, `agents-page.js`. Eight cards, strip, legend, proposals with Confirm / Skip / Custom in the live card.
- **Req:** R3
- **Verify:** `look-and-feel T3` tests: eight distinct colours and letters, colour-blind-safe pairs, one card per agent, status text, live proposals appear inside the active card and Confirm / Skip / Custom still work, strip opens the Agents page, sample shows read-only history.

### Task 4. Agent settings
`agent-settings.js`, `auto-confirm.js`, the coordinator and brain additions, the settings panel.
- **Req:** R4
- **Verify:** `look-and-feel T4` tests: defaults, the three levels, per-agent over global, storage failure, automatic confirmations marked in the version record and the log, Locked item is never changed and is asked, a clash or another agent's work makes Recommended ask, the wall rule, gatekeeper file unchanged.

### Task 5. 3D view
Layer toggles, hidden small marks, agent colours, letter badges on labels, legend, soft light, rounded placeholders.
- **Req:** R6
- **Verify:** `look-and-feel T5` tests: layer function, defaults, toggles redraw, sofa has back and arms, table is round, bed has a headboard, rounded geometry used, no outside address.

### Task 6. Wrap-up
Cache tag `build-look-1` on every page file, README, `KIRO_LOG.md`, changed tests listed, full test run.
- **Req:** R7
- **Verify:** `npm test` all pass. The tag test passes. `git diff docs/sample-run.json src/sample/sample-project.json sample-summary.html` is empty.
