# Requirements: Intake (screens where a person enters their own project)

## Purpose
Let a visitor either try the existing sample, or enter their own project through simple screens: project setup, inspiration, a brief, taste questions and items. A button then builds a Project Brain from those inputs, runs the existing Coordinator and four agents in the browser, and shows the result in the existing 3D viewer and summary. Everything stays in the visitor's browser.

## Out of scope (separate specs later, or never)
Pinterest or Instagram import, designer portfolio links, live AI mode, login, saving to a server, a custom-agent editor. Also out: reading or analysing the content of images, editing a project after the run (start again instead), saving a project to come back to later.

## Words used in this document
- **Intake**: the screens described here.
- **Visitor**: the person using the page.
- **Project Brain, item, Locked, Unsure, owner agent, clash, version, Coordinator**: as defined in `.kiro/specs/project-brain/requirements.md`.
- **Viewer**: the 3D page from `.kiro/specs/room-viewer/`.
- **Inspiration images**: pictures the visitor adds from their own device.
- **Notes**: short text the visitor writes about colours, materials or keywords.
- **Layer**: overall inspiration (whole project) or a room override (one room).
- **Brief**: the free text describing what the visitor wants.
- **Taste questions**: 5 to 6 multiple-choice questions. Their answers become the **style profile**.
- **Style profile**: a few plain-language sentences and tags built from the taste answers by fixed rules, shown back to the visitor.
- **Rule-based helpers**: how the four agents work today. They follow fixed rules. They are not AI.

## Requirements

### R1. Start screen
**As a visitor, I want to choose between the sample and my own project.**

Acceptance criteria:
1. The first screen has exactly two choices, with these words: "Try the sample" and "Start my own project".
2. "Try the sample" shows the existing sample result in the Viewer and the summary, labelled SAMPLE PROJECT as today. It uses the same pipeline output as today (`docs/sample-run.json`) and changes nothing in the sample.
3. "Start my own project" opens the project setup screen with an empty project.
4. The start screen says in one or two plain sentences what the app does, that it needs no login, and that nothing leaves the visitor's browser.
5. The start screen says the helpers are rule-based, not AI (see R10).

### R2. Project setup
**As a visitor, I want to name my project and add floors and rooms with a simple form.**

Acceptance criteria:
1. The visitor enters a project name (required, 1 to 60 characters).
2. The visitor adds floors one at a time by name (for example "Ground floor"). At least 1 and at most 4 floors.
3. The visitor adds rooms to a floor by name (for example "Kitchen"). At least 1 room in total and at most 20 rooms in total. Room names must be different from each other within the project, ignoring upper and lower case.
4. Each room has two optional fields, "Width (metres)" and "Depth (metres)", with the default of 4 and 4. Next to them the page says these are only used to draw the 3D view and are not the real size of the home.
5. The visitor can rename and remove a floor or a room before running. Removing a floor removes its rooms, and the page asks for confirmation first.
6. Bad input gets a plain message next to the field (for example "Give this room a name") and nothing is added.

### R3. Inspiration (images and notes, in layers)
**As a visitor, I want to add inspiration for the whole project first, and then optionally for single rooms.**

Acceptance criteria:
1. The visitor can add up to 50 images in total (overall plus all room overrides together). Allowed types: JPEG, PNG, WebP. At most 10 MB each. Anything else gets a plain message saying why, and is not added.
2. Images stay in the visitor's browser only. They are never uploaded, never sent anywhere, and not saved anywhere (not in browser storage either). The page says this in plain words next to the add-images control, and again on the run screen.
3. Each image shows a small preview, and its name. The visitor can remove any image. Every preview has a text description taken from the visitor's own caption, or "Inspiration image" followed by its number when there is no caption.
4. The visitor can write notes (colours, materials, keywords), as short separate entries, for example "warm oak", "linen". At most 30 entries per layer, each at most 40 characters.
5. The first step is **Overall inspiration**: images and notes that apply to the whole project. A second, optional step lets the visitor pick a room and add a **room override** (its own images and notes). A room override replaces the overall notes for that room, as in the Project Brain (R2 of that spec). The page explains this in one sentence.
6. The visitor can remove a room override, and the room goes back to the overall inspiration.
7. The visitor can continue with zero images and zero notes. The page then says plainly that the helpers will have less to work with.
8. If the visitor closes or reloads the page, everything is lost. The page warns about this before leaving once something has been entered, and says so on the start of the intake.

### R4. Brief
**As a visitor, I want a free-text box to say what I want.**

Acceptance criteria:
1. One text box with a visible label ("Your brief"), up to 2000 characters, with a character counter the visitor can read.
2. The brief is optional.
3. The page says plainly what happens to the brief (see R10.3): it is kept with the project and shown in the summary. The rule-based helpers do not read it.

### R5. Taste questions and style profile
**As a visitor, I want to answer a few simple questions and see my style described back to me.**

Acceptance criteria:
1. There are exactly 6 multiple-choice questions, each with 2 or 3 answers, one answer per question. The questions are: light or dark; soft or high contrast; classic or trend; durable or showpiece; warm or cool; calm or lively. (The owner can change the wording and the list before approving this spec.)
2. Every question has a visible label and one answer can be chosen with the keyboard. No answer is selected at the start.
3. The visitor may skip a question. A skipped question is left out of the profile.
4. After at least 1 answer, the page shows the **style profile** as plain sentences (for example "You like light rooms with soft contrast.") and as short tags (for example "light", "soft contrast"). The profile updates when an answer changes.
5. The profile is built by fixed rules from the answers only. The same answers always give the same profile. It uses no AI and no random choice.
6. The visitor can remove a tag from the profile before running. Removed tags are not used.
7. The tags in the profile are added to the overall inspiration for the run (the helpers can use them). The page says this.
8. With no answers, the page shows "No style profile yet" and nothing is added.

### R6. Items
**As a visitor, I want to list the things I care about and say which ones are fixed.**

Acceptance criteria:
1. The visitor adds an item by writing a short description (for example "Oak floor in the kitchen", 1 to 80 characters), choosing a room from the rooms entered in setup, and choosing **Locked** or **Unsure**.
2. Locked and Unsure are explained in one sentence each ("Locked: must stay exactly as it is." / "Unsure: open to change."). The choice has no default selected, so the visitor must choose.
3. An item may be given a short "Material, colour or style" tag (for example "warm oak"). This tag is what the Reviewer compares (see R9). It is optional.
4. Every item the visitor adds is a style item, owned by the Style agent. The page does not offer furniture, door or window items in this first version (see `design.md` section 4 for why).
5. The visitor can edit, change the status of, and remove an item before running.
6. At most 100 items.
7. The list of items is shown with text for the status ("Locked" or "Unsure"), not only a colour.
8. The visitor can continue with no items. The page then says the helpers will have nothing to work on except the clash check.

### R7. Run the design team
**As a visitor, I want one button that builds my Project Brain and runs the agents.**

Acceptance criteria:
1. A button labelled "Run the design team" is on a final screen. Before it, the page shows a short plain-language review of everything entered (name, floors and rooms, number of images, number of notes, whether a brief was written, the style profile, items with status).
2. The button is disabled, with a plain reason next to it, until the project has a name, at least 1 floor and at least 1 room.
3. Pressing it builds a normal Project Brain from the inputs, with the owner of every item set by the existing rules, and runs it through the existing Coordinator and the existing agents in the fixed order Style, Layout, Builder, Reviewer.
4. There is no second pipeline. The browser uses the same Coordinator, gatekeeper and agent files as `src/`, not rewritten copies (see `design.md` section 3).
5. The run is repeatable: the same inputs give the same result (fixed clock, no randomness).
6. Locked items are never changed by any agent (same guarantee as the Project Brain spec, R5). If an agent proposes a change to a Locked item, the refusal is shown in the run log.
7. If the run fails, the page shows which agent failed and why, in plain words, and keeps everything entered so the visitor can fix it and try again.
8. Pressing the button sends nothing anywhere.

### R8. Result: 3D viewer and summary
**As a visitor, I want to see my result in the viewer and read a summary.**

Acceptance criteria:
1. The result screen shows the existing 3D viewer (floors, rooms, markers coloured by status, red outline on clashes, version slider, details on click) with the visitor's own project.
2. The result screen shows a summary in plain language: structure, items with status and owner, run log, clash report, version list. It uses the same content rules as `src/summary/make-summary.js`.
3. The result is labelled as the visitor's own project and a draft. It is NOT labelled SAMPLE PROJECT. The draft-for-professional-review statement is always visible (same as Viewer R7).
4. The result screen has a section "What the design team did with your input" (see R10).
5. The visitor can go back to the start screen ("Start again"). This clears everything entered, including the image previews.
6. The existing sample result and the existing viewer behaviour do not change. The existing viewer tests still pass.
7. The result screen shows the visitor's own images as a mood board next to the style profile (sentences and tags). Each image has its text description (R3.3). The images stay in the page only (R11). The mood board is only shown, not read by any helper (R9.5).

### R9. What the helpers do with the visitor's input
**As a visitor, I want the result to be meaningful and not to claim more than it did.**

Acceptance criteria:
1. The helpers use only these inputs: the notes (overall and per room), the style profile tags, the items (name, room, status, tag), and the structure (floors, rooms).
2. The Style agent, for each Unsure style item, adds the room's effective inspiration (room override if there is one, otherwise the overall notes and profile tags) to the item's detail. This is the existing behaviour.
3. The Reviewer checks one thing: whether notes conflict with the tag of a Locked item, using a small fixed list of opposite pairs (for example "warm oak" and "cold steel"). Two cases: (a) a room's override notes against Locked items in that same room (the existing check, only for rooms that have an override); (b) the overall inspiration notes and the style profile tags against Locked items, in rooms without an override (new, approved 2026-11-19, own task and tests). It only looks at items that have a tag. The list of pairs is shown to the visitor on the result screen so the visitor sees exactly what was compared.
4. The Layout and Builder agents have nothing to do with the visitor's input in this version, because the visitor adds no positions, doors or windows. The result screen says so ("Layout and Builder had nothing to place").
5. The images and the brief are not read by any helper. They are kept for the visitor's own view (images stay in the page, not in the Brain) and, for the brief, in the summary.
6. No text on any screen says or suggests that the helpers understood the images or the brief, designed the home, or used AI.
7. With no clash found the report says "No clashes found" and the page adds that this only means the small fixed list found nothing.

### R10. Clear labelling of what is rule-based
**As a visitor, I want the page to be honest about what it can and cannot do.**

Acceptance criteria:
1. Every result screen has the sentence: "The design team is a set of fixed rules, not AI. It does not look at your images or read your brief." (wording may be improved without changing the meaning).
2. The section "What the design team did with your input" has three plain lists: **Used** (notes, style profile tags, items), **Kept but not read** (brief, images), **Not used yet** (nothing else). Each entry says in one sentence what was done.
3. The screens that take images and the brief say, at the point of entry, what will happen to them (R3.2, R4.3).
4. The draft statement "Plans are drafts for professional review. They are not verified engineering." is on every intake screen and every result screen.
5. A test fails if one of these sentences is missing from the page.

### R11. Nothing leaves the browser
**As the owner, I want the page to be safe to share publicly.**

Acceptance criteria:
1. The page makes no network call after it loads, other than reading its own files from the same place (scripts, styles, `sample-run.json`).
2. No image, note, brief, name or item is sent anywhere, stored in a cookie, `localStorage`, `sessionStorage` or `IndexedDB`, or written to a file. They live in the page's memory only.
3. The content security rule of the page allows nothing from other addresses. The only addition for this spec is permission to show images made in the visitor's own browser (`blob:` images). Inline script stays forbidden.
4. No login, account, cookie banner or tracking.
5. Image previews are made with temporary browser addresses that are released when an image is removed and when the visitor starts again.
6. The existing rule stays true: `src/` has no network calls, web addresses or environment variables (tests "R7.6" in `test/acceptance-gaps.test.js`).
7. No API key, secret or personal data in any file. The sample and intake test data are made up.
8. Viewer spec R8.1 and R8.4 (no form or text box, nothing stored) are changed by this spec on purpose: the page now has forms, but R11.1 and R11.2 above still hold. The viewer's "no upload to anywhere" rule stays.

### R12. Accessibility and phones
**As a visitor with any device or ability, I want to use every screen.**

Acceptance criteria:
1. Every control (text box, button, choice, file picker, list action) has a visible text label. A placeholder is not a label. Icons alone are not used for actions.
2. Every action can be done with the keyboard alone: moving between controls, choosing answers, adding and removing images, floors, rooms and items, running, and going back. The order of the controls follows the order on screen. The keyboard focus is always visible.
3. When a new screen opens, the keyboard focus moves to its heading, and the page title names the screen.
4. Text and controls meet WCAG 2.2 level AA contrast: at least 4.5 to 1 for text and 3 to 1 for borders, focus outlines and other parts of controls. Colour is never the only way to tell Locked from Unsure (the text says it too).
5. Body text is at least 16 px. The page works with the browser zoomed to 200% and on a 320 px wide screen without sideways scrolling (except the 3D view).
6. Buttons and choices are at least 44 by 44 px on a phone-sized screen.
7. Errors and confirmations (an item added, an image rejected) are written as text, tied to the control they concern, and announced to screen readers.
8. Images added by the visitor have a text description (R3.3). Pictures that only decorate are hidden from screen readers.
9. The 3D view has a text alternative: the summary and the clash list carry the same information, and the page says so.
10. Anything that only a person looking at a real device can judge is written in the checklist as "pending owner check", never as Passed.

### R13. Plain-language visibility
**As the owner (who does not write code), I want to understand and check everything without reading code.**

Acceptance criteria:
1. All text on the screens is plain language. No field names, ids or internal words (such as `item-1`, "gatekeeper", "kind") are shown.
2. An acceptance checklist, like the earlier two specs, lists each criterion here with the test name that covers it, or "pending owner check".
3. The README says how to open the page and what each screen does, in short steps.

## Decisions from the owner
- 2026-11-19: Inspiration images: up to 50. `.kiro/steering/product.md` now says "up to 50".
- 2026-11-19: Decision 1 approved. Plain JavaScript, no framework, no installs, one page with the viewer as its last screen.
- 2026-11-19: Decision 2 approved. Three small edits to existing code are allowed (browser-safe config loading, optional Project Brain fields `brief`, `styleProfile`, `imageCount`, the viewer's "show this run data" function). All existing tests must keep passing. None may be deleted or weakened. Each edit is its own small task, verified after it.
- 2026-11-19: `package.json` may gain a script `export-engine` that copies files. No dependencies.
- 2026-11-19: The Reviewer also checks the overall inspiration notes and the style profile tags against Locked items (R9.3). One small task with its own tests.
- 2026-11-19: Items stay style-only in this version. Room width and depth stay optional, default 4 by 4 metres.
- 2026-11-19: The result screen shows the visitor's images as a mood board next to the style profile (R8.7).
- 2026-11-19: Later, after intake works: one real AI step for the Style agent, key kept on a server function, the rules-based Style agent kept as fallback. Not built now. The design stays ready for it (`design.md` section 8).
