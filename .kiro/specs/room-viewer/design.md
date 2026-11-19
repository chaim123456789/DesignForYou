# Design: Room Viewer

Status: draft, waiting for owner approval. Nothing in this design has been built or installed.

## 1. What gets built, in one picture

```
 npm run export-viewer            (runs on a computer, uses no network)
        |
        v
 runSample()  ->  makeSampleRun()  ->  docs/sample-run.json
 (existing)       (new, in src/)         (generated file, committed)

 docs/index.html + docs/viewer.js + docs/scene-data.js + Three.js copy
        |
        v   a judge opens the page link in a browser
 reads docs/sample-run.json  ->  draws the home in 3D
```

The pipeline runs first and writes one file. The page only reads that file. The page never runs agents and never writes anything.

## 2. Files and who owns them

```
src/viewer/
  viewer-layout.json     room sizes and item heights (fixed numbers, section 4)
  make-sample-run.js     turns a finished sample Project Brain into the sample run data
  export-sample-run.js   runs the sample and writes docs/sample-run.json
docs/                    the web page (folder name chosen so GitHub Pages can publish it)
  index.html             page text, labels, legend, slider, panel, content security rule
  styles.css             look of the page
  scene-data.js          plain JavaScript, no Three.js: sample run data + version -> list of boxes
  viewer.js              the only file that uses Three.js: draws boxes, mouse, clicks, slider
  sample-run.json        generated. Never edited by hand.
  vendor/                the pinned copy of Three.js (section 3). Added only after approval.
test/
  viewer-export.test.js  tests for make-sample-run.js and the exported file
  viewer-scene.test.js   tests for scene-data.js
  viewer-page.test.js    tests for index.html (labels, no outside addresses)
```

- `src/viewer/` follows the existing rule for `src/`: no network calls, no web addresses, no environment variables. The existing R7.6 tests already scan `src/`, so they cover the new files with no change.
- The existing agents, brain, coordinator and sample data are not changed.
- `docs/` is outside `src/` because it is the browser part. Its own rules are in section 7.

## 3. Recommendation: how to load Three.js, and how judges open the page

### The problem in plain words
A web page that draws 3D needs the Three.js library. Judges should be able to open the page with one click and install nothing. There are two separate questions: where does Three.js come from, and where does the page live.

### Where the page lives: a hosted static page (recommended)
Publish the `docs/` folder with **GitHub Pages**. GitHub then gives the project a normal web link. A judge clicks the link and the page opens in their browser. Nothing is installed by the judge or on any server. It costs nothing for a public repository and it is turned on by the owner with a few clicks (section 8). The expected address is `https://chaim123456789.github.io/DesignForYou/` (to be confirmed when Pages is switched on).

Why not just send the file? Browsers block pages opened by double-clicking from a folder (the address starts with `file://`) from reading other files and from loading script modules. The page would open empty. A hosted page does not have this problem. Judges can still use the link, so this is not a limit for them.

Other ways, and why they are not first choice:
| Way | Verdict |
|---|---|
| Judge double-clicks a downloaded file | Does not work for this page (browser security). |
| Run a small local web server | Needs Node.js or Python on the judge's computer. Not "nothing to install". |
| Bundle everything into one single HTML file | Works from a folder, but needs a build tool (an install) and makes a very large, unreadable file. Not recommended. |
| Netlify, Vercel and similar | Also works, but needs a new account. GitHub Pages uses the account that already holds the repository. |

### Where Three.js comes from: a pinned copy inside the project (recommended)
Three.js is a free, MIT-licensed library. There are two simple ways to use it without a build tool:

1. **Load from a public library address (a CDN)** when the page opens. One line in the page. Nothing is added to the repository. But the page then depends on a third party being online during judging, and it makes a call to another address, which conflicts with R8.2 and R8.5.
2. **Keep one pinned copy of the library files in the project, in `docs/vendor/`.** The files are copied once from the official package and never change. The page loads them from its own address. This keeps the page working even if the CDN is down, lets the content security rule forbid every other address, and keeps the exact version visible in the repository.

**Recommendation: option 2.** The files needed are the Three.js main file (plus the second file it depends on, if the chosen version has one) and one add-on file for mouse turning and zooming (`OrbitControls`). An "import map" (a short block of text in `index.html`) tells the browser where they are. It is plain text and needs no build step. Three.js's own installation guide describes this way of using it from static hosting ([Three.js installation guide](https://threejs.org/docs/#manual/en/introduction/Installation)).

The exact version is chosen at install time (the latest stable release then), written down in `docs/vendor/VERSION.txt`, and the library's MIT licence text is copied next to the files. The AGPL-3.0 licence of this project is not affected.

### How the copy would be fetched (needs your approval first)
The copy is made by downloading the official Three.js package once and copying only the needed files into `docs/vendor/`. Nothing is added to `package.json`, there is no `node_modules` folder in the repository, and no build tool. This is the only step that needs internet access. The exact steps and file list are shown to you before anything happens.

### Network setting (when to change it)
The sandbox's **Network** setting must be changed to **Common Dependencies** for this one download, and not before. The order is:
1. You approve this spec.
2. Tasks 1 to 4 are done first. They need no network.
3. Before Task 5 (the Three.js copy), I stop and tell you: "Change Network to Common Dependencies now, then reply 'network changed'." I will not start Task 5 until you reply, and I will not download anything before you approve the exact file list.
4. When Task 5 is done, I tell you, and you can change Network back.

### Question for you (nothing is installed until you answer)
**Do you approve option 2 (a pinned copy in `docs/vendor/`) and GitHub Pages as the way to publish?** If you prefer the CDN option, say so and R8.2, R8.5 and R9.4 will be reworded.

## 4. The sample run file and the Viewer layout

### Why a layout is needed
The sample data gives each item a flat position inside its room (corner, width, depth, in metres), but it gives no room size, no heights, and no wall for doors and windows. A 3D box needs all of these. The sample data is not changed. Instead a small fixed table supplies the missing numbers:

| Thing | Fixed value |
|---|---|
| Room size | 5.0 m wide by 4.0 m deep (every room) |
| Gap between rooms on a floor | 0.2 m |
| Floor to floor height | 3.0 m |
| Wall height | 2.6 m |
| Door height | 2.0 m (drawn from the floor up) |
| Window height | 1.2 m, bottom edge 0.9 m above the floor |
| Furniture height | 0.8 m |
| Style marker | 0.6 m by 0.6 m, 0.05 m high, in a row along the room's front edge |

These are placeholders for a made-up example. Rooms of a floor sit side by side in their stored order; floors are stacked in their stored order. The sizes fit the sample (the sofa and Garden door sit inside 5 m by 4 m). The numbers are in `viewer-layout.json` so they can be changed without touching code.

**Question for you:** is it fine to use fixed room sizes like this? The other option is to add real sizes to `sample-project.json`, which changes the Project Brain sample and its tests.

### What `make-sample-run.js` writes
For a finished sample project, `makeSampleRun(project)` returns plain data:
- `name`, `isSample`
- `floors`: each with id, name, order, and its rooms (id, name, order, and size and position from the layout)
- `versions`: number, time, who, item, field, and a ready-made plain sentence such as "Version 3: Layout checked the Sofa" (so the page does not have to explain internal fields)
- `snapshots`: one entry per version from 0 to the latest. Each holds the items at that version, **taken from `getBrainAtVersion(project, n)`**, and nothing else. For each item: id, kind, name, status, owner, room id, position (if any), and for the clash item, the clash list.

With 7 versions and 9 items the file stays small (a few tens of kilobytes). It carries no timestamps from the real clock; the sample uses a fixed clock, so two exports are identical (R1.3).

`export-sample-run.js` runs `runSample()`, checks the run succeeded, calls `makeSampleRun`, and writes `docs/sample-run.json`. It is run with `npm run export-viewer` (a new script, no packages). It uses only file writing, like `write-sample-summary.js`.

## 5. How the page draws things

Everything the page needs for one slider position is worked out by `scene-data.js`, which has no Three.js and no browser code. That makes it testable with `node --test`.

`buildScene(sampleRun, version)` returns a list of boxes. Each box has: a key, what it is (room, door, window, furniture, style marker), position and size in metres, its item id if it has one, its status, and whether it is in a clash. `viewer.js` turns each box into a Three.js box and does nothing else clever.

| What | How it is drawn |
|---|---|
| Room | Light grey floor slab, thin see-through walls, no ceiling, room name as page text next to it. Upper floor slab is see-through too. |
| Door | Tall thin box, brown tint |
| Window | Thin pale box raised off the floor |
| Furniture | Block |
| Style marker | Flat tile |
| Status colour | Locked = blue. Unsure = orange. (A pair that stays apart for most colour-blindness.) Doors and windows keep their own shape, so colour is only the status. |
| Clash | Thick red outline on every box in the clash, over the status colour |

The colours are fixed in one place at the top of `viewer.js` and in `scene-data.js` as names ("locked", "unsure", "clash") so tests can check names without judging colours.

### Clicking
`viewer.js` uses Three.js's raycaster to find the nearest item box under the pointer, then asks `scene-data.js` for the panel text: `describeItem(sampleRun, version, itemId)`. That function returns plain sentences (name, status, owner, kind, room name, clash text). The panel is filled using `textContent`, never `innerHTML`, so a strange name cannot become page code (R4.8).

Clicking a line in the clash list does the same as clicking the first drawn item of that clash, and also turns the camera toward it (R5.4).

### Slider
A normal HTML range input (`<input type="range">`), so keyboard, touch and screen readers work with no extra code. On change: close or refresh the panel, call `buildScene` for that version, replace the boxes. The caption comes from `versions[n].sentence`. Version 0 shows "Before any change".

### Past versions and what they can and cannot show
The sample's changes (from the pipeline) are changes to item values and statuses, so past views show different text and statuses. Positions of furniture do not change in the sample, so the boxes stay where they are. At version 0 the clash report is the empty "Not reviewed yet" one, so nothing is highlighted. That is the correct behaviour (R5.7), not a fault.

### Labels
`SAMPLE PROJECT` and the draft statement are written as plain text in `index.html`, in a bar at the top and in a bar at the bottom, outside the 3D area, so they can never be covered by it (R7). A test (`viewer-page.test.js`) imports `SAMPLE_LABEL` and `DRAFT_STATEMENT` from `src/label.js` and fails if the page text differs. This keeps one source of truth for the wording, enforced by a test, while keeping the labels visible even if the data file fails to load (R7.5).

### If something goes wrong
- Sample run file missing or broken: a plain message, labels still visible (R1.6).
- The browser cannot do 3D (WebGL off): a plain message, labels, legend and the clash list as text still show. The clash list and item details are page text, so they work without 3D.

## 6. Rules carried over from the Project Brain spec
- One owner per item, Locked items never overwritten: the Viewer does not write at all, so it cannot break either rule.
- Past versions come only from `getBrainAtVersion` (read only, already tested for R8.6).
- Every output carries the label and the draft statement.

## 7. Safety and repo rules for `docs/`
- No network calls except reading its own files from the same place. In `index.html`, a content security rule (`default-src 'self'`, no inline script) tells the browser to refuse anything else, so even a mistake cannot call out.
- No `fetch` of any address except the relative `sample-run.json`. No cookies, no `localStorage`.
- No secrets, keys or personal data (checked by the same pattern test as `sample-project.json`).
- No `eval`, no `innerHTML` with data.
- `docs/vendor/` is the only place third-party code lives. It is not edited by hand.
- `.kiro` stays out of `.gitignore`. `LICENSE` is unchanged.

## 8. Publishing steps (for the owner, after merge)
1. On the GitHub page for the project, click **Settings**.
2. In the left list, click **Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Set **Branch** to `main` and the folder to `/docs`. Click **Save**.
5. Wait about a minute and refresh. GitHub shows the page address at the top. Open it.

These steps are repeated in `README.md` once the page exists. Pages is turned on only after you review the pull request.

## 9. How the design will be checked

| Requirement | Check |
|---|---|
| R1 | Tests: export is identical on two runs; snapshots equal `getBrainAtVersion` for every version; the export does not change the Brain; the exported file has floors, rooms, versions and 8 snapshots (0 to 7) for the sample |
| R2 | Tests on `buildScene`: 2 floors at different heights; 4 rooms; each door, window and furniture item has a box inside its room; style markers exist; the clash report has no box. **Looks right in a browser: pending owner check** |
| R3 | Tests: Locked and Unsure boxes get different colour names; the legend text is on the page; status in words in `describeItem`. **How it looks: pending owner check** |
| R4 | Tests on `describeItem`: name, status, owner, kind, room; clash text for clash items; no ids in the text. **Clicking works in a browser: pending owner check** |
| R5 | Tests: the two sample clashes mark the right boxes; version 0 marks none; "No clashes found" case. **Outline visible: pending owner check** |
| R6 | Tests: `buildScene` at every version matches the snapshot; an item not yet created is not drawn; page has a range input from 0 to the latest. **Slider feels right: pending owner check** |
| R7 | Test: page text equals `src/label.js` text, top and bottom, outside the 3D area |
| R8 | Tests: no `http(s)://`, `fetch(` of other addresses, `localStorage`, `<form`, `<input type="file"`, `eval(`, `innerHTML` in `docs/` page files (not `vendor/`); content security rule present; pattern check for personal data on `sample-run.json`; `src/` R7.6 tests still pass |
| R9 | Test: `package.json` has no dependencies; README has the publishing steps. **Link opens for a stranger: pending owner check after Pages is on** |
| R10 | Test: no `item-` or `floor-` ids in any panel text or caption. Human read-through: pending owner check |

Tests cannot see the screen. Everything about looks or feel is listed as "pending owner check" and is never marked Passed without a human look. Browser testing tools are not installed. If you want a screenshot check later, that is a separate approval.
