# Acceptance checklist: Room Viewer

Written on 2026-11-19 (Task 10), branch `build-viewer-3`. `node --test` result at that point: 235 tests, 235 passed, 0 failed.

Key: **Passed** means a named automated test proves it. **Passed by test, looks pending owner check** means a test proves the data and the code path, but only a person looking at the published page can judge the look or feel. **Unverified** means no test proves it yet. Test names are written in backticks and are the exact names in `test/`. `check-checklist.js` (in `test-helpers/`) matches every quoted name against the test files.

What the tests cannot see: the tests run the real page script on a stand-in page (`test-helpers/fake-page.js`) with a renderer that draws nothing. They cannot show colours, sizes, overlap on a real screen, WebGL, real mouse or touch, browser caching or the browser's own security rule.

## R1. The page reads one generated file
| # | Status | Proof |
|---|---|---|
| 1.1 | Passed | `Task 2: the exported file parses and matches makeSampleRun(runSample().project)` |
| 1.2 | Passed | `Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files`; `fix-viewer-1: handlers are attached in the right order` (the only fetch is `sample-run.json`) |
| 1.3 | Passed | `Task 2: two exports give identical text` |
| 1.4 | Passed | `Task 1: the sample run data has 2 floors, 4 rooms, 7 versions and 8 snapshots (0 to 7)` |
| 1.5 | Passed | `Task 1: every snapshot equals getBrainAtVersion for that version` |
| 1.6 | Passed | `fix-viewer-1: when the sample file cannot be read, the red message says so and nothing crashes` |
| 1.7 | Passed | `Task 1: making the sample run data does not change the Brain`; `Task 2: sample-project.json is unchanged (git diff is empty)`; `Task 8: the slider only reads: it never writes or sends anything` |

## R2. The sample home in 3D
| # | Status | Proof |
|---|---|---|
| 2.1 | Passed by test, looks pending owner check | `Task 3: two floors at different heights` |
| 2.2 | Passed by test, looks pending owner check | `Task 3: 4 rooms`; `Task 7b step 4: each room has a solid floor slab under its floor level, and the room names stay` |
| 2.3 | Passed by test, looks pending owner check | `Task 7b step 4: the page draws walls as outlines only (no filled wall faces)`. Each room now has a solid pale floor slab (Task 7b step 4), so "the inside of every room can be seen from the starting camera" is for the owner to judge. |
| 2.4 | Passed by test, looks pending owner check | `Task 7b step 2: doors are thin tall panels, under 0.2 m thick and about 2.0 m tall, standing on the floor`; `Task 7b step 2: windows are thin panels with the sill above the floor, about 0.9 m up and 1.2 m high` |
| 2.5 | Passed by test, looks pending owner check | `Task 3: every door, window and furniture box lies inside its room`; `Task 7b step 3: the sofa is about 0.8 m high, and style markers are flat patches lying on the floor` |
| 2.6 | Passed by test, looks pending owner check | `Task 3: style items get markers` |
| 2.7 | Passed | `Task 3: the clash report gets no box` |
| 2.8 | Passed by test, mouse and touch pending owner check | `Task 7b step 6: the starting camera keeps both floors completely inside the picture, on wide and narrow screens`; `fix-viewer-1: the camera cannot flip upside down or go below the floor`. Real dragging, scrolling and touch cannot be tested here. |
| 2.9 | Passed | `Task 8: at every version the blocks, red outlines, caption and version number agree with the data` |

## R3. Colour by status
| # | Status | Proof |
|---|---|---|
| 3.1 | Passed by test, looks pending owner check | `Task 3: Locked and Unsure boxes get different colour names`. Whether blue and orange are "clearly different" on screen is for the owner. |
| 3.2 | Unverified | No named test checks that the legend names Locked, Unsure and Clash. The words are in `docs/index.html`; pending owner check. `Task 7b step 8: the legend has the line about thin panels, solid furniture and flat patches` covers only the shapes line. |
| 3.3 | Passed | `Task 3: describeItem gives name, status in words, owner, kind and room name` |
| 3.4 | Unverified | Blue and orange were chosen for colour-blind readers, but no test or person has checked it. Pending owner check. |
| 3.5 | Passed by test, looks pending owner check | `Task 7b step 4: the page draws walls as outlines only (no filled wall faces)`; room slabs and walls use fixed neutral colours in `docs/viewer.js`. |
| 3.6 | Passed | `Task 8: an open details panel is refreshed for the version shown, not left with another version\'s data`; `Task 8: at every version the blocks, red outlines, caption and version number agree with the data` |

## R4. Click an item to see its details
| # | Status | Proof |
|---|---|---|
| 4.1 | Passed by test, real clicking pending owner check | `fix-viewer-1: normal run: no problem message, no missing ids, labels, details, buttons, slider, reset all work` (a click on a block opens the panel) |
| 4.2 | Passed | `Task 3: describeItem gives name, status in words, owner, kind and room name` |
| 4.3 | Passed | `Task 3: describeItem gives name, status in words, owner, kind and room name` |
| 4.4 | Passed | `Task 3: describeItem gives the clash sentence for clash items` |
| 4.5 | Passed by test, rooms pending owner check | `fix-viewer-1: normal run: no problem message, no missing ids, labels, details, buttons, slider, reset all work` (a click on empty space closes the panel). Rooms are not clickable shapes in the code (only item blocks are), but no test clicks a room. |
| 4.6 | Passed | `Task 8: an open details panel is refreshed for the version shown, not left with another version\'s data` |
| 4.7 | Passed | `Task 7: the details panel code fills the panel with textContent only, and has no editing controls` |
| 4.8 | Passed | `Task 3: names with < or & come back as plain text unchanged`; `Task 7: the details panel code fills the panel with textContent only, and has no editing controls` |

## R5. Clashes are highlighted
| # | Status | Proof |
|---|---|---|
| 5.1 | Passed by test, outline looks pending owner check | `Task 3: clash boxes are marked for the Garden door, the Sofa and the oak bed frame marker at the latest version`; `Task 8: slider at version 0 shows no clashes in the 3D drawing, the labels and the clash list; at the last version it shows both` (red outlines are handed to the 3D scene) |
| 5.2 | Passed by test, outline looks pending owner check | `Task 3: clash boxes are marked for the Garden door, the Sofa and the oak bed frame marker at the latest version`; `Task 7b step 2: the Garden door panel still touches or overlaps the Sofa, and both are outlined as a clash` |
| 5.3 | Passed by test, wording pending owner check | `Task 8: slider at version 0 shows no clashes in the 3D drawing, the labels and the clash list; at the last version it shows both` (the list has 2 lines at the latest version). No named test reads the severity and description text on a line. |
| 5.4 | Passed by test, camera turn pending owner check | `Task 8: an item that does not exist yet at a version is not drawn, and its open panel closes` (clicking a clash line opens the first drawn item's panel). No test checks that the camera turns. |
| 5.5 | Passed | `Task 3: clash boxes are marked for the Garden door, the Sofa and the oak bed frame marker at the latest version` |
| 5.6 | Unverified | No test uses a report that says "No clashes found". Version 0 (no report) is tested, see 5.7. |
| 5.7 | Passed | `Task 3: no box is marked as a clash at version 0`; `Task 8: slider at version 0 shows no clashes in the 3D drawing, the labels and the clash list; at the last version it shows both` |

## R6. Version slider
| # | Status | Proof |
|---|---|---|
| 6.1 | Passed | `Task 4: the slider range matches the version count`; `Task 8: the page slider runs from 0 to the number of versions and the page starts at the latest version` |
| 6.2 | Passed by test, feel pending owner check | `Task 8: at every version the blocks, red outlines, caption and version number agree with the data`; `Task 8: moving the slider replaces the blocks instead of stacking them (nothing stuck)` |
| 6.3 | Passed | `Task 1: each version has a plain sentence and none contains an id`; `Task 8: slider at version 0 shows no clashes in the 3D drawing, the labels and the clash list; at the last version it shows both` (caption "Before any change" at version 0) |
| 6.4 | Passed | `Task 8: the slider only reads: it never writes or sends anything` |
| 6.5 | Unverified | The slider is a normal range input, which browsers move with the arrow keys, but no test presses a key. Pending owner check. |
| 6.6 | Passed | `Task 8: an open details panel is refreshed for the version shown, not left with another version\'s data`; `Task 8: an item that does not exist yet at a version is not drawn, and its open panel closes` |
| 6.7 | Passed | `Task 3: an item created after version N is absent at version N`; `Task 8: an item that does not exist yet at a version is not drawn, and its open panel closes` |

## R7. Labels and safety statement always visible
| # | Status | Proof |
|---|---|---|
| 7.1 | Passed by test, staying visible pending owner check | `Task 4: SAMPLE PROJECT and the draft statement on the page equal src/label.js, top and bottom, outside the 3D area` |
| 7.2 | Passed | `Task 4: SAMPLE PROJECT and the draft statement on the page equal src/label.js, top and bottom, outside the 3D area` |
| 7.3 | Passed by test, covering pending owner check | `Task 7b step 7: the page has margins, a 1400 px maximum width and readable fonts, and the two label bars stay outside the scrolling area` |
| 7.4 | Passed | `Task 4: SAMPLE PROJECT and the draft statement on the page equal src/label.js, top and bottom, outside the 3D area` (plain page text in `index.html`) |
| 7.5 | Passed | `fix-viewer-1: when the sample file cannot be read, the red message says so and nothing crashes` (the bars are fixed page text) |
| 7.6 | Passed | `Task 4: SAMPLE PROJECT and the draft statement on the page equal src/label.js, top and bottom, outside the 3D area` |

## R8. No live AI, no login, no uploads, nothing sent anywhere
| # | Status | Proof |
|---|---|---|
| 8.1 | Passed | `Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files`. The "Show all labels" tick box is the only input besides the slider; it sends nothing. |
| 8.2 | Passed | `Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files`; `Task 5: the import map points only to files inside docs/vendor/, and the content security rule names its hash` |
| 8.3 | Passed | `Task 2: the exported file has no email, phone number, street word or web address` |
| 8.4 | Passed | `Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files` (no `localStorage`) |
| 8.5 | Passed by test, browser behaviour pending owner check | `Task 4: the content security rule is present`; `fix-viewer-1: the page script still writes text only with textContent, and the security rule is unchanged`. The browser's own enforcement is not tested. |
| 8.6 | Passed | `R7.6: src/ has no network calls (code search)`; `R7.6: src/ has no web addresses (code search)`; `R7.6: src/ reads no environment variables (code search)` |

## R9. Easy for judges to open
| # | Status | Proof |
|---|---|---|
| 9.1 | Unverified, pending owner check after Pages is switched on | Needs the published link opened in a normal browser by someone who is not the owner. |
| 9.2 | Passed | `Task 9: README has the five publishing steps from the design (Settings, Pages, branch, main, /docs)` |
| 9.3 | Passed | `Task 9: README gives the expected link and says double-clicking the file does not work` |
| 9.4 | Passed | `Task 5: docs/vendor holds exactly the approved files`; `Task 5: the import map points only to files inside docs/vendor/, and the content security rule names its hash` |
| 9.5 | Passed | `Task 5: package.json has no dependencies or devDependencies, and there is no node_modules folder` |
| 9.6 | Unverified, pending owner check | Phone-sized layout, and the labels, legend and slider staying visible, can only be judged on a real screen. `Task 7b step 6: the starting camera keeps both floors completely inside the picture, on wide and narrow screens` covers only the camera. |

## R10. Plain-language visibility
| # | Status | Proof |
|---|---|---|
| 10.1 | Passed by test, read-through pending owner check | `Task 3: no text contains an id`; `Task 1: each version has a plain sentence and none contains an id` |
| 10.2 | Unverified, pending owner check | No test checks the "How to use this" line. It is in `docs/index.html`. |
| 10.3 | Passed | This file. Every look-and-feel item is listed below. |

## Other checks from Task 10
- `LICENSE`: `git diff main --stat -- LICENSE` shows no change.
- `.gitignore`: contains only `node_modules/`, `dist/`, `build/`, and is unchanged. `.kiro` is not listed.
- Installs: none. `package.json` has no `dependencies` or `devDependencies`. The only third-party code is the approved Three.js r186 copy in `docs/vendor/` (`three.module.js`, `three.core.js`, `OrbitControls.js`, `LICENSE`, `VERSION.txt`).
- Not changed: the agents, the Brain, `src/`, `sample-project.json`.
- Task 9 left the README sentence "The 3D view ... are separate, later pieces of work" in place, because the task says to remove nothing. It is now out of date.

## Unverified, in short (for the owner, on the published page)
1. Looks: the two floors are visible and stacked (R2.1); room names and floor names are readable (R2.2); doors, windows, furniture and style patches look different from each other (R2.4 to R2.6); Locked (blue) and Unsure (orange) are clearly different and still tell apart if you have colour-blindness (R3.1, R3.4); the two clashes have a red outline (R5.1, R5.2).
2. The starting view shows the inside of every room even with the floor slabs (R2.3), and the "Reset view" button returns to it.
3. Mouse and touch: dragging turns, scrolling zooms, clicking a block opens the details, clicking empty space or a room closes them (R2.8, R4.1, R4.5).
4. Labels: by default only clash blocks have a name; pointing at a block or clicking it shows its name; "Show all labels" shows every name and unticking hides them again; names do not sit on top of each other on a real screen.
5. The slider: moving it feels right, blocks appear and disappear correctly, nothing is stuck, version 0 shows no red outline and the last version shows both, the arrow keys work (R6.2, R6.5, R5.7).
6. Clicking a clash line turns the camera to the item and opens its details (R5.4). The clash lines read clearly (R5.3). The legend names Locked, Unsure and Clash (R3.2). The "How to use this" line reads clearly (R10.2).
7. The SAMPLE PROJECT bars stay visible at the top and bottom, and nothing covers them (R7.1, R7.3).
8. A phone-sized screen: the labels, legend and slider stay visible (R9.6).
9. The published link opens for someone who is not you, with nothing installed (R9.1).
10. The grey status line at the bottom of the page says `Page script build-viewer-3: finished setting up.` and there is no red message at the top. If you see an old name such as `fix-viewer-1`, your browser has an old copy: reload with Ctrl+Shift+R.
11. No tests for: the legend wording (R3.2), the "How to use this" line (R10.2), a report that says "No clashes found" (R5.6), arrow keys on the slider (R6.5).
