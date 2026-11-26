# Design: Look and feel

## 1. Theme file
`docs/theme.css` holds CSS custom properties: colours (light on `:root`, dark on `:root[data-theme="dark"]` and on `prefers-color-scheme: dark` when no choice is stored), fonts (system fonts only), spacing steps (`--space-1` to `--space-6`), radii, the eight agent colours, and the colours of the 3D scene. `docs/styles.css` only uses `var(--...)`. A test fails if `styles.css`, `index.html` or any page script holds a colour literal outside the theme file.

The 3D view reads its colours from the theme file with `getComputedStyle`, so a theme change redraws it with the new colours.

## 2. Shell
`index.html` has: the label bars (unchanged ids), `#workspace-bar` (top bar), `#rail` (left), `#page` (centre, holds the screens), `#agent-strip` (right). `body[data-view]` is `home` or `workspace`. On `home` the bar, rail and strip are hidden by CSS. The body is `height: 100dvh; overflow: hidden`, and `#page` and each pane scroll inside.

`docs/intake/workspace.js` runs the shell: rail buttons, ribbon toggle, full screen, theme toggle, result tabs, project name. Each part is its own protected step. `screens.js` gains the screens `agents`, `materials` and `settings` (no step number) and tells `workspace.js` which screen is shown.

Phone: below 48rem the rail moves to the bottom as a row of tabs and the strip is hidden. The result screen gets tabs "3D view", "Details" and (own project) "Summary".

## 3. Agents
`docs/intake/agent-info.js` is the one list of the eight agents' look: letter badge, icon (plain text symbol), what it owns, and the name of its colour variable. No colour value is in it.

Colours (Okabe-Ito set, colour-blind-safe): orange, sky blue, bluish green, yellow, blue, vermillion, reddish purple, and a neutral grey-blue in place of black. Letters: W, D, F, L, M (furniture), C (decor), S, R. Each badge shows letter plus colour; the card also shows the name.

`docs/intake/agents-page.js` draws eight cards and the strip from one shared status object. The live proposal list (`#team-proposals`, made by `team-screen.js`) is moved into the card of the agent now being asked. Finished runs (sample or own) show each agent's proposals and answers read-only.

## 4. Settings and automatic confirmation
`docs/intake/agent-settings.js`: levels, defaults (global `recommended`, every agent `inherit`, rule on), load and save through an injected storage (the page passes `localStorage` in a protected step; a missing or blocked storage means the settings last for the visit only, and the page says so).

`docs/intake/auto-confirm.js`: `decide(session, proposal, step, settings)` returns `{ auto: true, reason }` or `{ auto: false, reason }`.
- Always ask me: never automatic.
- Do it and tell me: always automatic (the first, recommended option).
- Recommended: automatic unless the change (tried on a copy of the Brain, through the same gatekeeper) (a) makes items of another agent stale, or the proposal asks an earlier agent to change an item, (b) adds a clash line the Reviewer's check did not have before, or (c) touches a Locked item (the item itself, or an item that would become stale).
- Rule "Doors and windows move with their wall": a Doors and windows re-check proposal caused by a changed wall is not counted under (a). Levels still win: Always ask me still asks.

The decision runs on a copy. The real change is made only by `run.answer(id, option, undefined, { automatic: reason })`, which calls the same gatekeeper. `src/team-coordinator.js` writes `approvedBy: 'automatic'` and a run log line with the reason. `src/brain/brain.js` allows `automatic` as an approver. Nothing in `gatekeeper.js` changes.

## 5. 3D view
`scene-data.js` gains `layerOf(box)` and `filterByLayers(boxes, layers)`, the box `owner`, and `shape` on parts (`round` or `cylinder`). `viewer.js` draws parts as rounded boxes (extruded rounded rectangle with a bevel) or cylinders, colours meshes by the owner's agent colour, draws a dark outline on Locked items, and uses a hemisphere light plus a soft directional light. Lights, switches, sockets and rugs are in the Lighting and Decor layers, which are off by default.

## 6. Tests
New files: `look-theme.test.js`, `look-workspace.test.js`, `look-agents.test.js`, `look-settings.test.js`, `look-3d.test.js`. Test names start with `look-and-feel T<number>` so the checklist checker can find them.
