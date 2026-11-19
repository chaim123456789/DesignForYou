# Requirements: Room Viewer (3D view of the sample home)

## Purpose
Show the pre-run sample home in 3D in a web browser, so a judge can look around it, see which items are Locked or Unsure, see the clashes, and step back through the version history. The page only displays what the existing pipeline already produced. It never changes anything.

## Out of scope (separate specs later, or never)
Inspiration upload screens, live AI mode, login, editing items in the viewer, saving anything, floor plan drawing, door and window list page, any other project than the sample.

## Words used in this document
- **Viewer**: the web page described here.
- **Sample run file**: the file `sample-run.json`, written by the existing pipeline run (Sample mode). The Viewer reads only this file.
- **Project Brain, item, Locked, Unsure, owner agent, clash, version**: as defined in `.kiro/specs/project-brain/requirements.md`.
- **Viewer layout**: a small fixed table of room sizes (different for each room) and item heights. The sample data only has flat positions inside each room, so the Viewer needs sizes and heights to draw boxes. The layout is data, not an agent decision.
- **Box**: the plain 3D block used to draw a room, door, window, furniture piece or style marker.
- **Style marker**: a small flat tile on the floor of a room. Style items (such as "Oak floor in the kitchen") have no position, so a marker stands for them.
- **Past view**: the Project Brain as it was at an earlier version, shown by the Viewer. It is read only.

## Requirements

### R1. The page reads one generated file
**As a judge, I want the page to show exactly what the pipeline produced, so I can trust that nothing was drawn by hand.**

Acceptance criteria:
1. The sample run file is written by a script that runs the sample through the normal pipeline (`runSample`). It is never written by hand.
2. The Viewer reads only the sample run file. It reads no other data file and calls no other address.
3. Running the script twice gives an identical sample run file (same as R7.7 of the Project Brain spec).
4. The sample run file holds, for the whole project: the floors and rooms, the version list, and the items as they were at every version from 0 to the latest.
5. Every past version in the file comes from the existing read-only function `getBrainAtVersion`. The script does not replay versions in a second, separate way.
6. If the sample run file is missing or cannot be read, the Viewer shows a plain message saying so and draws nothing. It does not show a half-empty home.
7. The script and the Viewer never change the Project Brain, its versions, or `sample-project.json`.

### R2. The sample home in 3D
**As a judge, I want to see the home as simple 3D blocks, so I understand the layout at a glance.**

Acceptance criteria:
1. Each floor is shown at its own height. The sample's two floors appear one above the other.
2. Each room is shown as a simple box, with its name visible when the room is in view.
3. Floors, walls and ceilings do not hide what is inside: the inside of every room can be seen from the starting camera position.
4. Each door and window is drawn as a simple box at its position inside its room. Doors and windows look different from each other and from furniture.
5. Each furniture item (a Layout item with a position) is drawn as a simple block at its position inside its room.
6. Each style item is drawn as a Style marker in its room.
7. Items with no room (the clash report) are not drawn as a box. They appear in the clash list (R5).
8. The visitor can turn, zoom and move the view with the mouse or touch. The starting view shows the whole home.
9. All boxes come from the sample run file and the Viewer layout. The Viewer draws nothing that is not in them.

### R3. Colour by status
**As a judge, I want to tell Locked and Unsure items apart quickly.**

Acceptance criteria:
1. A Locked item and an Unsure item are drawn in two clearly different colours.
2. A legend is always visible. It names each colour in words ("Locked", "Unsure", "Clash").
3. Colour is never the only signal: the status is also written in words wherever an item is described (R4).
4. The colours are chosen so people with common colour-blindness can still tell Locked from Unsure (the legend and the written status back this up).
5. Rooms, floors and walls are neutral and are not coloured by status.
6. In a past view, colours show the status the item had at that version.

### R4. Click an item to see its details
**As a judge, I want to click a block and see what it is.**

Acceptance criteria:
1. Clicking (or tapping) an item box opens a details panel.
2. The panel shows the item's name, its status (Locked or Unsure, in words), and its owner agent (Style, Layout, Builder or Reviewer).
3. The panel also shows the item's kind in plain words (for example "Door") and its room name.
4. If the item is part of a clash, the panel says so and shows the clash description in plain words.
5. Clicking empty space, or a room, closes the panel.
6. In a past view, the panel shows the details as they were at that version.
7. The panel has no editing controls. Nothing the visitor does changes any item.
8. Item names come from the data and are shown as plain text, never as page code.

### R5. Clashes are highlighted
**As a judge, I want the Reviewer's clashes to stand out.**

Acceptance criteria:
1. Every item named in a clash of the Reviewer's report is highlighted in a way that is different from the Locked and Unsure colours (an outline or glow, not only a colour).
2. The sample's two clashes are visible: the Garden door and the Sofa, and the Bedroom's Locked oak bed frame item.
3. A clash list is always visible. Each line shows the clash's plain description and severity.
4. Clicking a clash line turns the view toward the first item in that clash and opens that item's details. Where the clash has no drawn item, the line only shows its text.
5. A clash with a Locked style item highlights that item's Style marker.
6. When the report says "No clashes found", the list says so and nothing is highlighted.
7. In a past view, the highlights and the list come from the report as it was at that version. At version 0 the report has not been made yet, so nothing is highlighted.

### R6. Version slider
**As a judge, I want to move back through the project's history and see the home as it was.**

Acceptance criteria:
1. A slider runs from version 0 ("Before any change") to the latest version. It starts on the latest version.
2. Moving the slider redraws the home using the items as they were at that version, from the sample run file (R1.5).
3. Next to the slider, the Viewer shows in plain words which version is showing, who made that change, which item changed and what changed. Version 0 says "Before any change".
4. Past views are read only. Nothing the slider does changes the Project Brain or adds a version.
5. The slider works with the keyboard (arrow keys) as well as the mouse or touch.
6. Moving the slider closes an open details panel, or refreshes it so it never shows data from a different version.
7. When an item did not exist yet at a version, it is not drawn at that version.

### R7. Labels and safety statement always visible
**As the owner, I need every output to say it is a sample and a draft.**

Acceptance criteria:
1. The text "SAMPLE PROJECT" is visible on the page at all times, in every view and at every slider position.
2. The statement "Plans are drafts for professional review. They are not verified engineering." is visible at all times. The text is exactly the shared text in `src/label.js`.
3. Neither can be closed, hidden, scrolled out of view, or covered by the details panel or the 3D view.
4. The labels are plain page text, not drawn inside the 3D scene, so they are readable even if the 3D view fails.
5. The labels still show if the sample run file cannot be loaded (R1.6).
6. A test fails if the label text on the page differs from the text in `src/label.js`.

### R8. No live AI, no login, no uploads, nothing sent anywhere
**As the owner, I want the viewer to be safe to share publicly.**

Acceptance criteria:
1. The page has no login, no upload control, no form and no text box that sends anything.
2. The page makes no call to any other address. After the page itself loads, the only thing it reads is the sample run file and its own script files from the same place.
3. The page contains no API key, secret, cookie, or personal data. The sample run file contains none either (same pattern check as R7.8 of the Project Brain spec).
4. The page does not store anything in the visitor's browser.
5. The page tells the browser to refuse any other address (a content security rule), so R8.2 is enforced and not just promised.
6. The existing rule stays true: `src/` has no network calls, web addresses or environment variables (tests "R7.6" in `test/acceptance-gaps.test.js`).

### R9. Easy for judges to open
**As a judge, I want to open the viewer without installing anything.**

Acceptance criteria:
1. The Viewer can be opened by clicking one web link, in a normal current browser (Chrome, Edge, Firefox, Safari), with nothing to install, no account and no command line.
2. The README tells the owner how to publish the page and tells judges where to click.
3. The README says plainly that double-clicking the page file from a computer's folder does not work, and what to do instead.
4. Three.js is delivered as the project's own pinned copy, not loaded from a third-party address when the page opens (see `design.md` section 3).
5. The project gains no installed packages: `package.json` has no `dependencies` or `devDependencies` after this work.
6. The page works on a laptop screen and stays usable on a phone-sized screen (the labels, legend and slider stay visible).

### R10. Plain-language visibility
**As the owner (who does not write code), I want to understand what the page shows without reading code.**

Acceptance criteria:
1. Every piece of text on the page is plain language. No internal field names or ids (such as `item-6` or `floor-1-room-2`) are shown.
2. The page has a short "How to use this" line: drag to turn, scroll to zoom, click a block for details, use the slider for history.
3. Anything the owner needs to judge by eye (does it look right in a browser) is listed in the acceptance checklist as "pending owner check", the same way as the Project Brain checklist. A test cannot judge how the page looks, so nothing about looks is marked Passed without a human look.
