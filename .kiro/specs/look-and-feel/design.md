# Design: Look and feel

## 1. Files

New:
- `docs/theme.css`: every colour, font, size, spacing, radius and time, for the dark theme (the default, with no attribute at all) and the light theme (`data-theme="light"` on `<html>`).
- `docs/workspace/shell.js`: the home or workspace switch, the pages, the top bar, the ribbon, full screen, the theme toggle, the result tabs, the agent strip.
- `docs/workspace/agents-page.js`: the cards, the legends, the settings controls, the log.
- `docs/workspace/agents-info.js`: the letter, shape, key and "what it owns" sentence of each agent. The names and order come from the registry (`docs/team/data.js`); this file only adds how an agent looks.
- `docs/workspace/agent-status.js`: status words and log lines (pure).
- `docs/workspace/settings.js`: the three levels, the rule, and `decide` (pure).
- `docs/workspace/store.js`: the one file that keeps anything in the browser: the settings and the theme.
- `docs/workspace/theme-colours.js`: reads the 3D colours from the theme.

Changed:
- `docs/index.html` (new structure; every old id is kept), `docs/styles.css` (layout only; uses the theme), `docs/viewer.js` (colours from the theme, layers, soft light, rounded shapes, owner colours), `docs/scene-data.js` (layers, owners, soft shapes: pure), `docs/intake/screens.js` (loads the workspace), `docs/intake/team-screen.js` and `team-run.js` (settings hook, proposals in the agent's card), `docs/intake/place-plan.js` (plan colours moved to the theme).
- `src/brain/brain.js` (one more approver label), `src/team-coordinator.js` (the answer can carry `auto`), `src/label.js` (one more honest sentence). The copies in `docs/engine/` and `docs/team/` are made by `npm run export-engine`.

## 2. Theme
- Dark: `#0b0c0e` background, `#14171b` surfaces, hairline `#2a2f36` lines, `#eceef1` text, one calm accent `#8ab4f8`. Light: warm off-white, white surfaces.
- Type: system fonts only. Headings use weight 300 and a tight tracking; the home headline is `clamp(2.75rem, 7.5vw, 6.25rem)`.
- Spacing is a scale `--space-1` to `--space-8`; radii `--radius-sm`, `--radius`, `--radius-lg`.
- The eight agent colours are the Okabe-Ito set (orange, sky blue, bluish green, yellow, reddish purple), plus a periwinkle, a grey and an off-white for Furniture, Style and Reviewer. The light theme uses darker shades with the same hue so the badge letter and the colour on the page both reach their limits.
- The 3D colours are `--three-*` hex values. `viewer.js` reads them with `getComputedStyle` and again when the theme changes.
- `styles.css` may name one thing of its own, `--badge-fill`, which only points at an agent colour.
- A test (`L1: the theme file holds every colour, font and spacing value; the stylesheet holds none of its own`) reads the stylesheet declaration by declaration and fails on any colour, font, spacing, radius, type size or time written outside the theme.

## 3. Layout
- `body` is as high as the screen and does not scroll. Order, top to bottom: label bar, red messages, `<main id="page">`, label bar (with the two grey script status lines).
- `<main>` holds the home page and the workspace. Only one is shown. `screens.js` shows the workspace for every screen except Start.
- Workspace: top bar, then a row of the left rail, the main area and the agent strip, then (phone only) the tabs. The DOM order is the order on the screen (no `order:`, no reversed rows, no `position: fixed`), so the tab order is the reading order. The phone tabs are a second `<nav>` after the main area, shown only on a phone; the rail is hidden there.
- Main area pages: `page-project` (the steps, with Back / Next fixed at the bottom of the area), `page-agents`, `page-materials`, `page-settings`. Only one is shown (`hidden` attribute, `aria-current` on the rail button). A page that the rail opens moves the focus to its heading.
- The result screen is a column: heading, ribbon, tabs (phone, or your own result), then the body. The body is a row: the stage (the 3D view, grows) and a side column of panels (fixed width, scrolls). On a phone it is one column and the tab chooses 3D, Details or Report (`data-result-tab`).
- Full screen: the browser's Fullscreen API on the stage. If it is missing or refused, the stage covers the area under the top bar (`.stage.is-fullscreen`), so the Exit button stays in reach. Escape leaves it.

## 4. The Agents page and the run
- The cards are made once. The panel of the step-by-step run (`#team-run`, with the progress, the eight steps, the notes and the Continue button) moved from the Review step to the top of the Agents page. The Review step still has the two run buttons.
- When a step starts, `team-screen.js` calls `mountProposals(agent)`. The page moves the list of proposals (`#team-proposals`) into that agent's card. The buttons, the answers and the focus are the code that was already there.
- Pressing "Step through the eight agents" opens the Agents page first. If the run cannot start, the page goes back to the Project page and the old message shows. When the run ends, the result screen is shown and the page goes back to Project.
- Status words come from `agent-status.js`: from the live run while it runs, otherwise from the run's team data (the sample's scripted run, or the visitor's finished run). The sample's data is shown only on the result screen, never while the visitor is still entering a project.

## 5. Agent settings
Stored as `{ version, global, perAgent: { <agent>: level }, doorsFollowWall }` under `designforyou.agent-settings`. The theme is stored under `designforyou.theme`. Nothing else is stored. `store.js` never throws: with no storage, or a refusing one, the defaults are used and the choice lasts until the page closes.

`decide(settings, proposal, { kind, getEffect })`:

| Level for the proposal's agent | Result |
|---|---|
| Always ask me | ask |
| any level, `confidence: low` (two options) | ask |
| Do it and tell me | auto |
| Recommended | ask if Locked, or a new clash, or it affects another agent's work; else auto |

The rule "Doors and windows move with their wall": at Recommended, for the re-check pass of Doors and windows, "affects another agent's work" does not count. A clash or a Locked item still asks. An agent set to "Always ask me" is never overridden.

The three facts come from `describeEffect(session, proposal)` in `team-run.js`. It reads a copy of the Brain, so the real Brain, the run and the gatekeeper are not touched:
- **locked**: the item is Locked.
- **affectsOthers**: the proposal asks an earlier agent to change its item, or an item of another agent (not the Reviewer) that is already decided (filled in by an answered proposal, or placed by the user) lists this item in its basis. An empty slot ("not decided yet") is not work to be affected.
- **clash**: on a copy, the first option is applied through the gatekeeper and the Reviewer's real conflicts are compared before and after (things that overlap, a door that opens into furniture, an object outside its room, a style against a Locked item). A room with no window yet is unfinished work, not a clash. If the check itself fails, the user is asked.

Confirming for the user is `run.answer(proposalId, firstOptionId, undefined, { auto: true })`. The only difference from a user's answer is the approver label written in the version (`approvedBy: 'auto-confirmed'`) and the run log (`by: 'auto-confirmed'`). `changeItem` still checks Locked first and then the owner, and writes the version. The Locked case: the gatekeeper refuses, no version is written, the item is flagged "needs your look".

Where it shows: the proposal's answer line ("Auto-confirmed (Recommended): ..."), the announcement when a step finishes, the Agents page log and history, the summary's version table (the "approved by" column), the viewer's team panel, and the report sentence ("Answers marked "auto-confirmed" were confirmed for you by your agent settings. ...").

## 6. 3D view
- `scene-data.js` gives `layerOf(box)`, `LAYERS` (id, label, on), `ownersAt(run, version)` and `softShapes(box, parts)`. All are pure and tested. The old boxes and parts do not change, so the old data tests still hold.
- Drawing: only boxes of layers that are on. A body is the owner's colour. A Locked item gets a bright edge on every part. A clash gets the red outline (it was already there).
- Soft light: a `HemisphereLight` (sky and ground colours from the theme) and one `DirectionalLight` of intensity 0.8 with no shadow.
- Rounded shapes: a rounded block is a rounded-rectangle shape extruded upward (`ExtrudeGeometry`); a round top is a `CylinderGeometry` squashed to the part's depth. Sofa: seat, back, arms. Table: round top on one pedestal. Bed: mattress and headboard. Other furniture keeps a small rounding. Doors and windows stay plain frames.
- Labels carry `data-agent`, `data-letter`, `data-locked`, `data-clash`; the stylesheet writes the letter before the name and the words Locked and Clash after it. The text of a label is still only its name.

## 7. Honest limits
- Nothing here can show how the page looks. The tests run the real scripts on a stand-in page and read the real stylesheet. The first look in a real browser is a pending owner check (see the acceptance checklist).
- The two default choices that the owner may want to change: the default level ("Always ask me", because `product.md` says agents always ask) and the 3D colours (agent colours replace the old blue and orange status colours, so status is shown by an edge and by words).
