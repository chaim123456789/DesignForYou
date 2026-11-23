# Requirements: Place furniture, doors and windows

Status: draft, waiting for the owner's approval. No app code is written in this step.

## Problem in plain words
In a visitor's own project, the rooms are empty. The visitor can add style items only, so the Layout and Builder agents have nothing to work on, and the 3D view shows empty boxes with flat markers. The goal: a visitor places real furniture, doors and windows, and the 3D view shows recognisable shapes.

## Scope
Browser only. No login. Nothing is sent anywhere and nothing is stored. Plain JavaScript, no framework, no installs (as before).

## Out of scope
- Dragging furniture with the mouse as the only way to move it.
- Turning objects by any angle. Only 90-degree turns.
- A furniture catalogue (the list is short and fixed).
- Importing floor plans.
- Live AI mode.
- Login or accounts.
- Changing what the Layout and Builder agents do. They stay fixed rules that check and mark. They do not choose or move anything.

## Words used
- **Object:** one placed piece of furniture, door or window.
- **Footprint:** the rectangle an object covers on the floor, seen from above. It has a left edge, a top edge, a width and a depth, all measured from the top-left corner of its room.
- **Plan:** the simple top-down drawing of one room that the page draws.
- **Object list:** the text list of everything placed.

## R1. The new screen
1. A new numbered screen "Place furniture, doors and windows" comes straight after "Your items" and before "Review and run".
2. The screen starts by asking the visitor to pick a room, from the rooms entered in setup. If there are no rooms, it says so in plain words and offers no form.
3. Every object has: a type, a name, a status (Locked or Unsure) and a footprint.
4. The status has no default. The visitor must choose it, as on the Items screen.
5. The fixed type list is: sofa, bed, table, wardrobe, desk, bath, kitchen unit, door, window. Nothing else can be added.
6. Each type has a sensible starting size, filled in when the type is chosen (see design.md section 3). The visitor can change it.
7. The visitor can edit, turn, move, change the status of, and remove each object. Nothing is final until the visitor runs the design team.
8. Bad input (a blank name, a name that is too long, a size or position that is not a number, a size of zero or less) is refused with a plain sentence that names the box. The existing objects stay unchanged when a change is refused.
9. The limits are written down in one place (the existing limits file): name length, objects per room, objects in total.

## R2. Placing without a mouse
1. Each object has number boxes for position (from the left, from the top) and size (width, depth), in centimetres, each with a visible label.
2. Each object has four buttons that nudge it by 10 cm: left, right, up, down. A nudge that would push the object out of the room still works, and the object list says it sticks out (R4.3). It is not silently blocked, so the visitor sees what happened.
3. A "Turn 90 degrees" button turns the object a quarter turn and swaps its width and depth, keeping its top-left corner. The turn is remembered, so the 3D shape faces the right way.
4. The page draws a simple top-down plan of the selected room. It shows the room outline, every object as a labelled rectangle, and marks Locked and Unsure so the difference does not depend on colour alone.
5. A mouse or finger click or tap on the plan puts the selected object's top-left corner at that point, rounded to the nearest 10 cm. Clicking is an extra way. Every action possible by clicking is also possible with the number boxes and buttons.
6. The plan has a text alternative. The object list is always shown next to it and is the accessible version. It lists, for every object in the selected room: name, type, status, position, size and turn, in plain words.
7. When something changes, a short plain sentence is announced to screen readers (for example "Sofa moved 10 cm to the right").
8. Keyboard focus stays on the control the visitor was using after a nudge, a turn or a redraw.
9. A door or window also has a labelled "Wall" drop-down (Top, Bottom, Left, Right) that puts it flush against that wall, keeping its distance along the wall.

## R3. Objects become items the existing agents already handle
1. Furniture becomes an item of kind `layout`, owner Layout. A door becomes kind `door` and a window kind `window`, owner Builder. No new kind and no new owner are added.
2. Each item is made with the existing item-creation function, with the visitor's status and room.
3. The Locked rule and the gatekeeper apply unchanged. A Locked object is never changed by any agent. A test shows a Locked placed object is identical after a run.
4. The item value holds the name, the position rectangle in metres (same shape as the sample: `x`, `y`, `width`, `depth`), and, for furniture, the `type` and the `turn`.
5. The sample project and the sample result are unchanged (R6).

## R4. The Reviewer reports two more clashes
1. The existing two clash types keep working: "Door or window on furniture" and the two style clash types. Their text, order and numbers are unchanged.
2. New clash: **furniture overlapping furniture**. Two furniture items in the same room whose footprints share any area. Touching edges do not count. Severity Medium.
3. New clash: **object outside its room**. Any object (furniture, door or window) whose footprint is not fully inside its room. Touching a wall is inside. Severity Medium for furniture, High for a door.
4. The out-of-room check needs the room's size. It runs only for rooms that have a size. Rooms with no size are skipped, and the report does not claim they were checked.
5. The Reviewer only reads and reports. It never moves or changes anything.
6. New clashes are added after the existing ones, so the numbers of existing clashes do not change.
7. The clash report says plainly that overlap and fit checks use only the rectangles the visitor entered.

## R5. Reading the result
1. The 3D view of the visitor's project shows each placed object with the shape for its type (R7). Clash outlines and the clash list work for the new clash types as for the old ones.
2. The result screen's report ("What the design team did with your input") says what Layout and Builder did and did not do, based on what really happened (R8).
3. The summary page lists the type and turn of furniture in plain words.

## R6. The sample stays exactly as it is
1. `src/sample/sample-project.json` is not changed.
2. `docs/sample-run.json` is identical after `npm run export-viewer` (empty `git diff`).
3. The sample's clash report (the clashes, their numbers, texts and severities) is identical.
4. The sample's furniture has no type, so in the 3D view it keeps the plain block it has today.

## R7. The 3D shapes
Each type is drawn as a few simple boxes, so it is recognisable from a normal viewing angle. Sizes are fractions of the object's footprint, so a resized object keeps its shape.

| Type | Shape |
|---|---|
| Sofa | seat, a back along the back edge, two arms at the sides |
| Bed | mattress and a headboard at the back edge, taller than the mattress |
| Table | flat top and four legs |
| Wardrobe | one tall box with a thin line to show the doors |
| Desk | thin top and a leg or side panel at each end |
| Bath | a low tub: an outer box with a lower, lighter inner box, so it looks hollow |
| Kitchen unit | a base cabinet with a thin worktop on top |
| Door | a frame (two sides and a top) and a slightly thinner door leaf inside it |
| Window | a frame and a see-through pane of glass |

1. Locked and Unsure keep the existing colours (Locked blue, Unsure orange) on every part of the object, and the clash outline works around the whole object.
2. Clicking any part of an object shows that object's panel, as today.
3. An item with an unknown or missing type (like the sample's Sofa) is drawn as the plain block it has today.
4. The shapes come from a pure function with no Three.js, so tests can check them without drawing anything.

## R8. The result report says what Layout and Builder did and did not do
1. Under "Used": a line saying how many pieces of furniture, doors and windows were placed, and that each Unsure one was checked and marked "Placement checked by Layout" or "Opening checked by Builder".
2. Under "Used": a line for Locked objects: they were respected and not changed.
3. The report says, in plain words and in the same place, what Layout and Builder did **not** do: they did not choose where anything goes, did not move anything, did not resize anything, and did not fix any clash. They checked and marked only.
4. The existing fixed sentence stays: "The design team is a set of fixed rules, not AI. ..."
5. The existing "Layout and Builder had nothing to place" line appears only when nothing was placed.
6. The Reviewer line says which checks ran and names any room skipped because it has no size (R4.4).

## R9. Accessibility and privacy
1. Every control has a visible label (not a placeholder only).
2. Everything works by keyboard alone: choosing a room, adding, editing, nudging, turning, removing, and reading the plan's text version.
3. Text is at least 16 px. Buttons and other controls are at least 44 px by 44 px with space between them, as in the existing screens.
4. Colour contrast meets the same rules as the existing screens (WCAG AA). Status is never shown by colour alone.
5. The screen works at 320 px wide with no sideways scrolling of the page. The plan scales down to fit.
6. Errors are plain sentences next to the box they belong to, linked to it so a screen reader reads them.
7. Visitor text is put on the page with `textContent` only. Nothing is stored. Nothing is sent. The content security rule is unchanged: no outside address is added.
8. The draft statement ("drafts for professional review, not verified engineering") stays on every screen, and the plan and 3D view are not claimed as accurate.

## R10. Safety for existing work
1. All existing tests keep passing. None is deleted or weakened. Where the new screen changes a number or list an existing test checks (for example "Step 6 of 7"), the expected value is updated in that test and the change is listed in the pull request (decision in design.md, question 1).
2. No installs, no new dependencies, and no `package.json` change.
3. `LICENSE` is unchanged. `.kiro` is not in `.gitignore`. No secrets or personal data in any file.
