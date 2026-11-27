# Tasks: Look and feel

Status: requested and approved by the owner on 2026-11-26 in the session request for branch `build-look-1`. Built straight away, task by task, with no stop between tasks unless one failed twice (none did).

Rules for every task:
- Plain JavaScript and CSS, no framework, no build tool. **No installs, no downloads, no network.** `package.json` is not changed.
- After every task: run `npm test`. All earlier tests keep passing. A test that only asserted an old look detail (a count, an id, the cache tag, the old layout) may be changed; each change is listed with its reason in `KIRO_LOG.md` and the acceptance checklist.
- After any change under `src/`: run `npm run export-engine` (the byte-for-byte engine test checks the copies).
- The gatekeeper, the owners and the Locked tests are not weakened. Keep the protected setup steps and the red error message.
- Every page file carries the cache tag `build-look-1`.
- Do not touch `LICENSE`. Keep `.kiro` out of `.gitignore`. No secrets and no personal data.

---

### Task L1. The theme file and the page
Add `docs/theme.css` (dark by default, light by toggle, WCAG AA) and rewrite `docs/styles.css` to use it only. Restructure `docs/index.html` into a home page and a workspace with the page itself not scrolling (every old id is kept). Add the theme toggle and `docs/workspace/store.js` for the theme. Cache tag `build-look-1` everywhere.
- **Req:** R1, R7
- **Verify:** `L1: the theme file holds every colour, font and spacing value; the stylesheet holds none of its own`; `L1: dark is the default, the light theme defines every colour the dark theme does, and the page starts as dark`; `L1: the theme toggle is a button with a visible label; it switches dark and light, keeps the choice in this browser, and the page starts as chosen`; `L1: motion respects "reduce motion": the theme sets every time to nothing and the stylesheet switches animation and transition off`; `L1: the page itself does not scroll: the body is fixed to the screen and only named areas scroll inside themselves`; `L1: every page file carries the cache tag build-look-1: the links, the scripts, every import of a page script, and the status lines`; `L1: every workspace control is a real button or box with visible words, in the order it appears on the screen, and the keyboard focus ring is on`; and the contrast test `Task 12 accessibility: every text colour pair reaches 4.5 to 1 and every border and focus colour reaches 3 to 1 (numbers printed)` (both themes).

### Task L2. Home page
A large light headline, one sentence about what DesignForYou does, "Try the sample" and "Start my own project", and the honest line (rule-based, AI is off). Calm motion that stops for "Reduce motion".
- **Req:** R2
- **Verify:** the six `L2:` tests in `test/look-home.test.js`.

### Task L3. Workspace
The top bar, the left rail (Project, Agents, Materials as a placeholder, Settings), the ribbon, Full screen, the agent strip, the result tabs, and the phone tabs. The project steps move into the Project page.
- **Req:** R3
- **Verify:** the fourteen `L3:` tests (they include the protected step: if a workspace file cannot load, the red message names the step and the project steps still work) in `test/look-workspace.test.js`.

### Task L4. Agents page and identities
One card per agent with a letter badge, a shape and a colour from the theme; the proposals appear in the card of the agent that is asking; the legend; the log; true statuses.
- **Req:** R4
- **Verify:** the twelve `L4:` tests in `test/look-agents.test.js`.

### Task L5. Agent settings and automatic confirmation
The three levels, the global and per-agent choice, the rule "Doors and windows move with their wall", `describeEffect`, the `auto-confirmed` label in the version record and the log, and storage in the browser only. Edit `src/brain/brain.js`, `src/team-coordinator.js` and `src/label.js` additively, then `npm run export-engine`.
- **Req:** R5, R7
- **Verify:** the twenty-four `L5:` tests in `test/look-settings.test.js`, and every earlier gatekeeper and Locked test unchanged (`test/gatekeeper.test.js`, `test/team-brain.test.js`, `test/team-coordinator.test.js`, `test/lock-guard-gaps.test.js`).

### Task L6. 3D view
Six layers (Lighting and Decor off by default), soft light, rounded sofa, round table and bed with a headboard, owner colours with a letter, a Locked edge and the words Locked and Clash on labels, a small legend, the theme reaching the 3D colours, and no outside images or fonts.
- **Req:** R6
- **Verify:** the sixteen `L6:` tests in `test/look-3d.test.js`.

---

After Task L6: add the `KIRO_LOG.md` entry, update the README and the steering notes, update the old checklists for the tests whose names changed, and open one pull request.
