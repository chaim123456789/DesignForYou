# Design: Place furniture, doors and windows

Status: draft, waiting for the owner's approval. Covers R1 to R10 in `requirements.md`. No app code is written in this step. Plain JavaScript, no framework, no installs, as before.

## 1. What gets built, in one picture

```
 Intake: Your items  ->  NEW: Place furniture, doors and windows  ->  Review and run
                              |
                              |  placed objects live in the page's state (memory only)
                              v
 buildBrain(state): rooms (now with size) + style items + NEW layout / door / window items
                              |
                              v
 Coordinator: Style -> Layout -> Builder -> Reviewer (unchanged order, unchanged rules)
                              |
                              v
 makeRunData -> 3D viewer (shapes per type) + summary + result report
```

No new agent, no new item kind, no new owner. A placed sofa is an ordinary `layout` item. A placed door is an ordinary `door` item. The gatekeeper, the Locked rule and the Coordinator do not change.

## 2. Which existing code must change, and how small each edit is

Each edit is listed with what stays the same. Files under `src/` marked "engine" are copied to `docs/engine/` by `npm run export-engine`, so the copy changes too, byte for byte. Nobody edits the copy by hand.

| # | File | Edit | Size | What stays the same |
|---|---|---|---|---|
| 1 | `src/brain/brain.js` (engine) | **Project Brain field.** `buildRoom` keeps an optional `width` and `depth` (metres, numbers above 0) when given. Added only when given. | about 8 lines | A room made with a name only is exactly as before. The sample's rooms have no size, so the sample Brain is identical. |
| 2 | `src/agents/reviewer/agent.js` (engine) | **Reviewer.** Two new check functions (furniture overlapping furniture, object outside its room) and two appended entries in the list of clashes. Section 6. | about 50 lines | The two existing check functions are not touched. Their clashes come first, so their numbers do not change. `overlaps` is not changed. |
| 3 | `src/viewer/make-run-data.js` (engine) | **Run data.** `snapshotItem` also copies `type` and `turn` when the item value has them. | 2 lines | Without them (the sample) the output is identical, so `docs/sample-run.json` does not change. |
| 4 | `src/summary/make-summary.js` (engine) | **Summary.** `valueWords` adds the type and turn to the words for furniture when present, for example "Sofa, sofa, turned 90 degrees (...)". | about 4 lines | Items without a type read as before. |
| 5 | `docs/scene-data.js` | **Viewer data.** `buildScene` puts `furnitureType` and `turn` on a furniture box. A new pure function `shapeParts(box)` returns the sub-boxes for a type (section 7). | about 90 lines | A box with no type has no parts and is drawn as today. |
| 6 | `docs/viewer.js` | **Viewer drawing.** `addBox` loops over `shapeParts(box)` when there are any, using the same material, colour and click data for every part. | about 25 lines | Floor slabs, rooms, style markers, the clash outline, picking, the slider and the sample draw as today. |
| 7 | `docs/intake/state.js`, `limits.js` | **Intake state.** A `placed` list in the state, add / edit / move / nudge / turn / status / remove functions, `hasEntries` counts placed objects, removing a room or floor drops its placed objects. Limits added to the existing `LIMITS` table. | about 120 lines | Existing functions keep their results. A state with no placed objects behaves as today. |
| 8 | `docs/intake/build-brain.js` | Pass each room's width and depth to `createProject`. Create one item per placed object, after the style items and before the clash item. | about 25 lines | Style items, the clash item and the run are unchanged. |
| 9 | `docs/intake/report.js` | Add the placed-object lines and the "did not do" line (R8). | about 30 lines | The existing lines and the fixed sentence stay. |
| 10 | `docs/intake/screens.js`, `docs/index.html`, `docs/styles.css` | New screen entry, new section, new styles, cache tag bump (section 9). | small, mostly new text | Other screens untouched. |
| 11 | `README.md` | One sentence in "How to use the app" for the new step. | 2 lines | |

New files, all in `docs/intake/` (browser side, no network, no storage):
- `place-geometry.js`: pure maths with no page code. Default sizes, centimetre to metre conversion, nudge, turn, snap to a wall, click to position, inside-room test, overlap test, and the plain-words sentence for each object. The Reviewer has its own small copy of the two tests (section 6) because the engine must not import from `docs/intake/`.
- `place-screen.js`: the screen's behaviour (form, list, buttons, plan). Imports nothing; `screens.js` hands it its tools, like `items-screen.js`.
- `place-plan.js`: draws the top-down plan with the page's own elements (section 5).

Agent files other than the Reviewer, `gatekeeper.js`, `coordinator.js`, `sample-project.json`, `sample-run.json` and `LICENSE` are not touched.

## 3. Data shapes (plain language)

**Placed object, in the page's state** (`state.placed`, a list):
`{ id, kind, type, name, room (room id), status, x, y, width, depth, turn }`, with all lengths in whole centimetres. `kind` is `layout`, `door` or `window`. `type` is one of the nine. `turn` is 0, 90, 180 or 270 (clockwise).

**Item in the Brain** (made by `buildBrain` with the existing `createItem`):
- Furniture: `kind: 'layout'`, `owner: 'Layout'`, `value: { name, type, turn, position: { x, y, width, depth } }`.
- Door, window: `kind: 'door'` or `'window'`, `owner: 'Builder'`, `value: { name, position: { x, y, width, depth } }`.
- `position` is in metres, the same shape the sample uses, so every existing agent, the summary and the viewer read it unchanged. Centimetres are divided by 100 once, in `buildBrain`.
- A nudge, a turn and a click all change whole centimetres, so no floating-point drift builds up in the state.

**Fixed type table** (one place, `limits.js`; sizes in centimetres, width by depth, with the back at the top of the plan when `turn` is 0):

| Type | Kind | Start size | Start name |
|---|---|---|---|
| sofa | layout | 200 x 90 | Sofa |
| bed | layout | 160 x 200 | Bed |
| table | layout | 140 x 80 | Table |
| wardrobe | layout | 120 x 60 | Wardrobe |
| desk | layout | 120 x 60 | Desk |
| bath | layout | 170 x 75 | Bath |
| kitchen unit | layout | 240 x 60 | Kitchen unit |
| door | door | 90 x 10 | Door |
| window | window | 120 x 10 | Window |

The sizes are made-up placeholders, like the sample's. The visitor can change every one. Doors and windows start flush to the top wall.

**Limits** (added to `LIMITS`): object name 40 characters, 30 objects per room, 150 objects in total, size 10 to 1000 cm, position within -1000 to 3000 cm (so an object can be placed outside the room on purpose, to see the clash).

## 4. The screen

Heading "Place furniture, doors and windows", step 7 of 8. Order on the screen, top to bottom, so the keyboard order is also the reading order:

1. **Room** (a labelled drop-down) with a line "Room size: 5.0 m by 4.0 m (as entered in setup)".
2. **Add an object** form: Type (drop-down), Name (text), Status (two radio buttons, Locked or Unsure, no default), then the number boxes Left (cm), Top (cm), Width (cm), Depth (cm), then the button "Add object". Choosing a type fills the name and size boxes with the start values (the visitor can overwrite them).
3. **Selected object** controls: shown for the object chosen in the list. Buttons "Nudge left 10 cm", "Nudge right 10 cm", "Nudge up 10 cm", "Nudge down 10 cm", "Turn 90 degrees", and for doors and windows a labelled drop-down "Wall" (Top, Bottom, Left, Right) that places the object flush to that wall.
4. **Plan** (section 5), with the line "Click or tap the plan to put the selected object's top-left corner there. You can also use the number boxes and buttons."
5. **Object list** (always shown, never hidden behind a toggle). One list item per object in the selected room: "Sofa (sofa), Locked. 100 cm from the left, 300 cm from the top, 200 cm wide, 90 cm deep, turned 0 degrees." followed by the buttons "Select", "Edit", "Remove". An object that sticks out also says "Sticks out of the room." This is the accessible version.
6. A line for each other room: "Kitchen: 3 objects placed", so the visitor can see the whole home.

The 44 px buttons are in a wrapping row, so at 320 px they stack. Number boxes stack one per row at narrow widths.

## 5. The plan

- Drawn by the page with one SVG element built with `createElementNS` (an inline drawing, no image file, no library, no outside address). `place-plan.js` builds it from the object list. The content security rule allows inline SVG elements already, since they are part of the page; this is checked in the tests (section 11).
- The SVG uses a `viewBox` equal to the room's size in centimetres plus a small margin and `width: 100%`, so it scales to 320 px and up.
- Each object is a rectangle with its name as text. Locked has a solid thick outline; Unsure has a dashed outline. Colours match the 3D colours (blue, orange) but the line style carries the meaning too. Doors and windows are drawn as thin bars on the wall.
- The SVG has `role="img"` and an `aria-label` that says "Plan of the Kitchen, 5.0 m by 4.0 m, with 3 objects. The list below has the same information." The object list is the real content for assistive technology.
- A click or tap handler on the SVG converts the pointer position to centimetres with the SVG's own coordinate conversion, rounds to 10 cm, and calls the same "move to" function as the number boxes. It does nothing if no object is selected, and then a plain sentence says "Select an object first." Plain clicks are not the only way, so the plan itself is not a keyboard tab stop; the number boxes and buttons are.
- The plan is redrawn from the state after every change. It holds no state of its own.

## 6. The Reviewer: two new checks

Both new checks read the Brain view the Coordinator gives the Reviewer. They only report.

1. **Furniture overlapping furniture.** For each pair of `layout` items in the same room with positions, report if the footprints share more than 1 mm of area in both directions (a tolerance, so two pieces placed edge to edge are not flagged because of rounding). Type "Furniture overlaps furniture", severity Medium, description "In the Living Room, the Sofa overlaps the Table." Each pair is reported once.
2. **Object outside its room.** For each `layout`, `door` or `window` item with a position, in a room that has a `width` and `depth`: report if any part of the footprint is outside `0..width` and `0..depth` (again with a 1 mm tolerance). Type "Object outside its room". Severity Medium for furniture and windows, High for a door. Description "In the Bedroom, the Wardrobe sticks out of the room." Rooms with no size are skipped.

Order inside the report: existing "Door or window on furniture" clashes, then the existing style clashes, then the two new kinds. Existing clashes therefore keep their numbers.

**Why the sample result stays exactly as it is.** The sample has one piece of furniture, so no furniture pair exists. The sample's rooms have no size in the Brain, so the out-of-room check is skipped. Both are checked by a test that compares the sample's full clash report with the current one (R6), and by `git diff` on `docs/sample-run.json` after `npm run export-viewer`.

**Honest wording.** The Reviewer's own note text does not change, so the sample's report stays identical. The result report (section 8) is where the page says which rooms had no size and were skipped by the fit check.

## 7. The 3D shapes

`shapeParts(box)` in `scene-data.js` is a pure function. Input: a furniture, door or window box (position, size, `furnitureType`, `turn`). Output: a list of sub-boxes `{ x, y, z, width, height, depth, role }`, where `role` is a name like `seat`, `back`, `arm`, `frame`, `glass`, `leaf`, `leg`, `top`. It has no Three.js and no page code.

Rules for all shapes:
- Parts are made in a "turn 0" layout (back at the low-z edge of the footprint, which is the top of the plan). The function then rotates the part rectangles around the footprint's centre by the box's `turn`, so a turn is a re-arrangement of boxes and never a rotated mesh. Width and depth are already swapped in the footprint by the turn button.
- Part sizes are fractions of the footprint, with a minimum thickness of 4 cm so a small object still shows its parts.
- Heights come from one fixed table in `scene-data.js` (metres): sofa seat 0.45 and back 0.85; bed mattress 0.5 and headboard 1.0; table top at 0.75; wardrobe 2.0; desk top at 0.75; bath 0.55; kitchen unit 0.9 plus a 0.04 worktop; door 2.0 (the existing door height); window keeps the existing bottom and height. These are viewer-only numbers, so `viewer-layout.json` and the run data do not change.
- Every part keeps the box's `itemId`, `colour` and `clash` values, so clicking works and the colour is Locked blue or Unsure orange on all parts.

Doors and windows: the existing `wallPanel` still decides the wall and the panel. `shapeParts` then builds a frame (two sides and a top, 6 cm thick) around the panel, a door leaf slightly thinner than the frame, and for a window a thinner see-through glass pane (the viewer already makes windows 60% see-through).

`viewer.js` draws every part as a normal box with the same material code it already has. The clash outline is drawn once, around the object's overall box, as today.

The sample's furniture has no type, so `shapeParts` returns an empty list and the plain block is drawn (R7.3, R6.4). After the optional last task (Task 16, owner-approved) the sample's four objects get a type and the viewer draws the new shapes for them.

## 8. The result report

`buildReport` gains these lines, using real counts from the finished run's Brain and run log:
- **Used:** "You placed 3 pieces of furniture, 1 door and 2 windows. Layout checked each Unsure piece of furniture and Builder checked each Unsure door and window, and each wrote a note on it."
- **Used:** "Locked objects were respected: no agent changed them." (only when at least one placed object is Locked)
- **Nothing to do this time:** the "had nothing to place" line only when nothing was placed.
- **New fixed line, shown whenever objects were placed:** "Layout and Builder did not choose where anything goes. They did not move, resize or turn anything, and they did not fix any clash. They checked each Unsure object and marked it." This line is a constant in `report.js`, so the start screen and tests can use the same words.
- The Reviewer line says it checked: doors and windows against furniture, furniture against furniture, and objects against room size, and names the rooms skipped for having no size (if any).

The lines say only what happened, as the existing report does. They never say "designed", "optimised" or "AI".

## 9. Screen list, step numbers and the page's cache tag

`screens.js` gets one new entry `{ id: 'place', name: 'Place furniture, doors and windows', step: 7 }`, and Review becomes step 8. The step text then reads "Step 7 of 8: ..." everywhere. The new script file is loaded with the cache tag, in its own protected step, like the other screens, so a failure on this screen shows the red message and the other screens still work.

The page's cache tag changes from `build-intake-5` to `build-place-1` in all five places that carry it (the stylesheet link, `viewer.js` link, `screens.js` link, and the two `PAGE_VERSION` constants), so browsers do not mix old and new script files.

## 10. Existing tests that must be updated (listed, never weakened)

Two kinds of existing expectation change because the app really has one more step and a new cache tag. Nothing else is touched. Each updated test keeps checking everything it checked before. The new expected values are listed in the pull request.

| File | Change |
|---|---|
| `test/intake-screens.test.js` | `STEPS` gains `['place', 'Place furniture, doors and windows']` before `review`; "of 7" becomes "of 8"; the Back loops count 7 and 8 steps; the five literal `build-intake-5` become `build-place-1`. |
| `test/viewer-real-script.test.js` | The literal `build-intake-5` (three places) becomes `build-place-1`. |
| `test/readme-how-to-use.test.js` | Its list of step words gains the new step's name. The README gets the matching sentence. |

Owner answered yes on 2026-11-23. These edits are done in Task 9 (not earlier, so the suite stays green while the new step does not exist yet).

## 11. Risks

1. **Existing tests encode "7 steps" and the cache tag.** Section 10 lists them. If one fails for a reason other than those expected values, it is a real bug, not a test to edit.
2. **Engine copies drift.** Four engine files change. `npm run export-engine` must run after the edits and the byte-for-byte test must pass. Mitigation: each task that edits a `src/` engine file ends with the export and that test.
3. **The sample result changes by accident.** Mitigation: before any Reviewer, run-data or viewer edit, a test saves the sample's clash report and `sample-run.json`; after every task `git diff docs/sample-run.json` must be empty.
4. **Rounding.** Centimetre integers in the page avoid it. The Reviewer uses a 1 mm tolerance for the new checks only. A test places two pieces exactly edge to edge and expects no clash.
5. **A door counted as "sticking out" of a thin room.** A door flush to the left wall has `x = 0`, which is inside. A door the visitor places half outside the wall is reported. This is intended.
6. **The out-of-room check depends on room sizes the visitor may not have entered.** Setup already defaults every room to 4 by 4 m, so a visitor's rooms always have a size. Only the sample is skipped. I recommend no change to the sample's data. Skipped rooms are named in the result report only (section 8).
7. **The 3D shapes are only boxes.** Recognisable, not realistic. Whether they look right can only be judged by a person on a real screen, so each shape gets a test on its parts and a line in the acceptance checklist marked "pending owner check" for the looks.
8. **The plan's click handling cannot be tested for real.** The page tests use a stand-in page. The conversion from pointer to centimetres is a pure function with its own tests. The real-device behaviour (mouse, touch, 320 px) is "pending owner check", never counted as passed.
9. **Inline SVG and the content security rule.** An inline drawing is allowed, but an automated test checks that the rule in `index.html` is unchanged and no outside address appears.
10. **Many objects make the 3D view and list long.** The limits (30 per room, 150 total) keep it small. The list is scrolled by the page, not by an inner scroll box, so keyboard users are not trapped.
11. **Three.js cost.** More boxes per object. At the limits this is a few thousand boxes, well within what the viewer already handles. No new library.
12. **Locked objects can still be moved by the visitor before the run.** This matches the Items screen: Locked protects against the agents, not against the visitor. The screen says so in one sentence.

## 12. Recommended defaults (used unless the owner says otherwise)

- Units: centimetres in the boxes and the list, metres in the Brain.
- Nudge 10 cm; click placement rounds to 10 cm.
- Turn 90 degrees clockwise, swapping width and depth.
- New screen is a real numbered step (step 7 of 8), directly after "Your items".
- Doors and windows start flush to the top wall, with a Wall drop-down to move them to another wall.
- Sizes and limits as in section 3.
- The sample's data and result are untouched until the optional last task (Task 16); then only a `type` is added to its four objects, and nothing else in the result changes.
- One new pull request per task group, as before: this spec first, then the build.

## 13. Questions for the owner (two), answered 2026-11-23

**Answers:** Question 1: yes (only the expected values: the step count and the cache tag `build-place-1`; nothing deleted or loosened; the exact changed lines are listed in the pull request). Question 2: yes, but as the LAST task of the whole spec (Task 16), only if it is safe, giving only the sample's four existing objects a type, with a test proving that the clashes, run log, versions, labels and rule results are identical, and `docs/sample-run.json` regenerated with the export script. If it looks risky it is skipped and the owner is told.

1. **May I update the existing tests that count the steps and the cache tag?** (Section 10: three files, only expected values, nothing deleted or loosened.) I recommend **yes**. Adding a real step cannot be done without it. The fallback if you say no: no new numbered step. The placing screen would become a side page opened from "Your items" by a button, and the step count would stay 7. The cache tag test would still need updating, so a "no" costs a clumsier screen and saves only one test change.
2. **Should the sample's sofa and doors also get types, so the sample shows the new shapes?** I recommend **no**. It would change `sample-project.json` and `docs/sample-run.json`, and you asked for the sample's result to stay exactly as it is. The visitor's own project shows the new shapes.
