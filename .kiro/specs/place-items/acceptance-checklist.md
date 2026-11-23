# Acceptance checklist: Place furniture, doors and windows

Written on 2026-11-23 (Task 15), branch `build-place-4`. `node --test` result at that point: 648 tests, 648 passed, 0 failed (633 at the start of this build; 15 new: 10 in `test/place-accessibility-privacy.test.js` for Task 13, 5 in `test/place-end-to-end.test.js` for Task 14).

Tally of the 60 criteria: 42 Passed by named tests only; 1 Passed for the part a test proves (3.2); 12 Passed by test with a part that is also "Unverified: pending owner check" (2.4, 2.5, 2.7, 2.8, 5.1, 7.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8); 4 checked by command with no named test, so not counted as Passed (6.6, 10.1, 10.2, 10.3); 1 not applicable (6.5, because Task 16 was skipped); 0 Not passed; 0 only unverified. Task 16 (the sample's four objects get a type) was skipped after the go / no-go trial, so R6.1 to R6.4 apply as written.

Key (strict, the same as the other checklists):
- **Passed**: a named automated test proves it. The test names are written in backticks and are the exact names in `test/`. `node test-helpers/check-checklist.js .kiro/specs/place-items/acceptance-checklist.md` matches every quoted name against the test files. (In this build the checker was extended, additively, to also read names that start with `place-items Task` and `Place Task`.)
- **Not passed**: a check was done and the page does not meet the criterion. None at the time of writing.
- **Unverified: pending owner check**: only a person looking at the real published page, on a real device, can judge it. It is never counted as Passed.
- **Checked by command, no named test**: proven by a command whose output was read (for example `git diff`), not by a test. It is not counted as Passed.
- A row can have both: "Passed" for the part a test proves and "Unverified: pending owner check" for the part only a person can see.

What the tests cannot see: they run the real page scripts on a stand-in page (`test-helpers/fake-page.js`) with a renderer that draws nothing. They cannot show how anything looks, colours as drawn, sizes on a real screen, a 320 px or phone layout, zoom to 200%, a real keyboard, the real focus ring, a screen reader, WebGL, a real mouse click or finger tap on the plan, or the network tab of a real browser. The browser was not tried in this build (Playwright and local servers do not work in this environment).

## R1. The new screen
| # | Status | Proof |
|---|---|---|
| 1.1 | Passed | `Task 6: each screen has exactly one heading, and the page has exactly the nine screens`; `Task 6: the step text, Back and Next follow the screens, and Next is gone on the last step` (the list of screens in that test puts "Place furniture, doors and windows" between Your items and Review and run, "Step N of 8" on every step) |
| 1.2 | Passed | `Place Task 10: with no rooms the screen says so and shows no form`; `Place Task 10: the form appears once a room is chosen, with the room size line and the setup rooms in the list` |
| 1.3 | Passed | `place-items Task 2: the nine types give the right kind, start name and start size`; `Place Task 10: adding an object changes the list text, selects it, empties the form and announces it` |
| 1.4 | Passed | `place-items Task 2: status has no default and must be Locked or Unsure`; `Place Task 10: every control on the screen has a visible label, nothing uses a placeholder, and no status is chosen at the start` |
| 1.5 | Passed | `place-items Task 2: a type that is not on the list is refused`; `place-items Task 2: the nine types give the right kind, start name and start size` |
| 1.6 | Passed | `Place Task 10: choosing a type fills in the start name and size` |
| 1.7 | Passed | `Place Task 10: Select and Edit pick an object from the list; Save changes edits it`; `Place Task 10: Change status switches between Locked and Unsure`; `Place Task 10: Turn 90 degrees swaps width and depth, keeps the corner, and announces it`; `Place Task 10: Remove takes the object out, announces it and moves the focus to the list heading`; `Place Task 10: nudge buttons move exactly 10 cm each way, change the list text, announce, and keep the focus on the button` |
| 1.8 | Passed | `place-items Task 2: a blank or too-long name is refused with a sentence naming the box`; `place-items Task 2: a size of 0, a letter in a number box or a decimal is refused and the state is unchanged`; `Place Task 10: a refused add shows its sentence next to the box, linked with aria-describedby, and adds nothing`; `Place Task 10: a refused Save changes keeps the old values, keeps what was typed, and shows its sentence next to the box` |
| 1.9 | Passed | `place-items Task 2: limits are in the limits file`; `place-items Task 2: too many objects are refused (30 per room, 150 in total) and the state is unchanged` |

## R2. Placing without a mouse
| # | Status | Proof |
|---|---|---|
| 2.1 | Passed | `Place Task 10: every control on the screen has a visible label, nothing uses a placeholder, and no status is chosen at the start`; `place-items Task 2: move to sets the position` |
| 2.2 | Passed | `place-items Task 2: nudge moves exactly 10 cm each way`; `place-items Task 2: a nudge out of the room still works, and a nudge past the position limit is refused`; `Place Task 10: a nudge out of the room still works and the list says the object sticks out` |
| 2.3 | Passed | `place-items Task 2: four turns return to the start, and each turn swaps width and depth`; `Place Task 10: Turn 90 degrees swaps width and depth, keeps the corner, and announces it`; `place-items Task 4: a turned piece keeps its turn in the item`; `place-items Task 8: a sofa turned 90 degrees has its back mesh on the right edge of its footprint` |
| 2.4 | Passed by test; how the plan looks: Unverified: pending owner check | `Place Task 11: the plan is an inline drawing with a view box, a text alternative, one rectangle per object and a room outline`; `Place Task 11: Locked and Unsure differ by outline style and words, not by colour alone` |
| 2.5 | Passed by test; a real mouse click and a real finger tap: Unverified: pending owner check | `place-items Task 3: a click at the corners and the middle of a room gives the right position (room drawn 320 px wide)`; `place-items Task 3: a click is rounded to the nearest 10 cm`; `Place Task 11: a click on the plan moves the selected object's top-left corner, rounded to 10 cm, and the list follows` |
| 2.6 | Passed | `place-items Task 3: the sentence for an object is exact plain words`; `place-items Task 3: the sentence is right for every type and every turn`; `place-items Task 3: the sentence contains no ids`; `Place Task 11: the list and the plan always show the same objects, after every kind of change` |
| 2.7 | Passed by test; what a screen reader says aloud: Unverified: pending owner check | `Place Task 10: adding an object changes the list text, selects it, empties the form and announces it`; `Place Task 10: nudge buttons move exactly 10 cm each way, change the list text, announce, and keep the focus on the button`; `Place Task 10: Turn 90 degrees swaps width and depth, keeps the corner, and announces it` |
| 2.8 | Passed by test; focus on a real keyboard: Unverified: pending owner check | `Place Task 10: nudge buttons move exactly 10 cm each way, change the list text, announce, and keep the focus on the button`; `Place Task 10: Turn 90 degrees swaps width and depth, keeps the corner, and announces it`; `Place Task 10: Change status switches between Locked and Unsure` |
| 2.9 | Passed | `place-items Task 2: wall snap puts a door flush on each wall and keeps its distance along the wall`; `place-items Task 2: wall snap works for a window, and is refused for furniture or an unknown wall`; `Place Task 10: the Wall list puts a door flush to a wall; it is shown for doors and windows only` |

## R3. Objects become items the existing agents already handle
| # | Status | Proof |
|---|---|---|
| 3.1 | Passed | `place-items Task 4: furniture becomes a layout item owned by Layout; doors and windows are door and window items owned by Builder` |
| 3.2 | Passed (status and room only) | `place-items Task 4: positions are in metres, furniture keeps its type and turn, and status and room are the visitor's`. That the existing item-creation function is the one used is a fact of the code (`docs/intake/build-brain.js`), not shown by a named test. |
| 3.3 | Passed | `place-items Task 4: a Locked placed object is identical after the run, and an Unsure one gets the Layout or Builder note`; `place-items Task 4: the Locked sofa really is protected by the gatekeeper, not by the agent skipping it`; `place-items Task 14: the Locked sofa is identical after the run and has no version; the Unsure objects only gain a note` |
| 3.4 | Passed | `place-items Task 4: positions are in metres, furniture keeps its type and turn, and status and room are the visitor's` |
| 3.5 | Passed | `place-items Task 1: the sample clash report is exactly the saved one`; `place-items Task 1: the sample run log is exactly the saved one`; `place-items Task 1: the sample versions and final items are exactly the saved ones`; `place-items Task 1: the sample labels are exactly the saved ones`; `place-items Task 1: docs/sample-run.json equals a fresh export` |

## R4. The Reviewer reports two more clashes
| # | Status | Proof |
|---|---|---|
| 4.1 | Passed | `place-items Task 5: clash numbers of the old kinds are unchanged when new kinds are added`; `place-items Task 5: the visitor's fixed conflict pairs still work next to the new checks`; `place-items Task 1: the sample clash report is exactly the saved one` |
| 4.2 | Passed | `place-items Task 5: two overlapping sofas give one "Furniture overlaps furniture" clash, reported once`; `place-items Task 5: pieces exactly edge to edge give no clash, in both directions`; `place-items Task 5: pieces in different rooms never overlap each other` |
| 4.3 | Passed | `place-items Task 5: a wardrobe 1 cm outside gives one "Object outside its room" clash`; `place-items Task 5: touching every wall is inside, and 1 cm over any wall is outside`; `place-items Task 5: a door outside is High, a window outside is Medium` |
| 4.4 | Passed | `place-items Task 5: a room with no size is skipped by the fit check`; `Place Task 12: a room with objects but no size is named as skipped by the fit check; rooms with a size are not` |
| 4.5 | Passed | `place-items Task 5: the Reviewer changes nothing but its own report`; `place-items Task 5: a Locked piece is reported but never moved` |
| 4.6 | Passed | `place-items Task 5: new kinds come after the old kinds, overlap check before the fit check`; `place-items Task 14: the clash report has the three clash kinds, numbered 1, 2, 3 in that order, with the right words and severities` |
| 4.7 | Passed | `Place Task 12 (R4.7): the report says the overlap and fit checks use only the rectangles the visitor entered`. The sentence is in the result report, not in the Reviewer's clash report, as `design.md` section 6 says. |

## R5. Reading the result
| # | Status | Proof |
|---|---|---|
| 5.1 | Passed by test; how the shapes and outlines look: Unverified: pending owner check | `place-items Task 8: a typed sofa is drawn as 4 meshes, all with the same item id and box key`; `place-items Task 8: the clash outline is drawn once per clashing object, not once per part`; `place-items Task 14: the run data carries type and turn for the placed furniture, and the shapes have the listed parts inside each footprint`; `place-items Task 14: the same project typed into the screens gives the same three clashes, the report lines and a clean result screen` |
| 5.2 | Passed | `Place Task 12: the result screen shows the placed-object lines, the "did not" list and the rectangles sentence`; `place-items Task 14: the report lines are the exact ones for a mix of Locked and Unsure objects` |
| 5.3 | Passed | `place-items Task 6: the summary words for a typed, turned piece are exact`; `place-items Task 6: type and turn reach the run data for placed furniture` |

## R6. The sample stays exactly as it is
| # | Status | Proof |
|---|---|---|
| 6.1 | Passed | `Task 2: sample-project.json is unchanged (git diff is empty)`; `place-items Task 1: the sample versions and final items are exactly the saved ones` |
| 6.2 | Passed | `place-items Task 6: npm run export-viewer leaves docs/sample-run.json identical`; `place-items Task 1: docs/sample-run.json equals a fresh export` |
| 6.3 | Passed | `place-items Task 1: the sample clash report is exactly the saved one`; `place-items Task 1: the sample run log is exactly the saved one`; `place-items Task 1: the sample labels are exactly the saved ones` |
| 6.4 | Passed | `place-items Task 6: no sample snapshot item has a type or a turn`; `place-items Task 7: the sample's boxes are identical to before (same fingerprint of all 8 versions)`; `place-items Task 8: the sample draws exactly the same meshes as before (plain blocks, same count)` |
| 6.5 | Not applicable: Task 16 was skipped | R6.5 only applies after Task 16. Task 16 did not run (see R6.6), so the sample has no `type` fields and R6.1 to R6.4 still apply. |
| 6.6 | Checked by command, no named test (not counted as Passed) | Task 16 was skipped on purpose, and the owner was told. The go / no-go trial (a type added to the four objects in `src/sample/sample-project.json`, `npm run export-viewer`, then `npm test`) made 12 existing tests fail, so the trial was undone with `git checkout` and `git diff main` over `docs/sample-run.json` and `src/` is empty. The failing tests are listed in `KIRO_LOG.md` (Session 30). |

## R7. The 3D shapes
| # | Status | Proof |
|---|---|---|
| 7.1 | Passed by test; that each shape is recognisable and the Locked blue and Unsure orange look right on screen: Unverified: pending owner check | Parts per type: `place-items Task 7: sofa has a seat, a back and two arms`; `place-items Task 7: bed has a mattress and a headboard taller than the mattress`; `place-items Task 7: table has a top and four legs`; `place-items Task 7: wardrobe is one tall box with a thin door line`; `place-items Task 7: desk has a thin top and a panel at each end`; `place-items Task 7: bath is a low tub with a lower inner part marked lighter`; `place-items Task 7: kitchen unit has a base cabinet with a thin worktop on top`; `place-items Task 7: door has a frame of two sides and a top, and a leaf thinner than the frame`; `place-items Task 7: window has a frame and a see-through glass pane thinner than the frame`. Colour on every part: `place-items Task 7: every part carries the item id, colour, status and clash flag`; `place-items Task 8: an Unsure table is orange on all five parts`. Outline around the whole object: `place-items Task 8: the clash outline is drawn once per clashing object, not once per part`. |
| 7.2 | Passed | `place-items Task 8: clicking a part opens that object's panel` |
| 7.3 | Passed | `place-items Task 7: no type, an unknown type or a non-shaped box gives an empty list`; `place-items Task 8: the sample draws exactly the same meshes as before (plain blocks, same count)` |
| 7.4 | Passed | `place-items Task 7: the shapes file has no Three.js and no page code`; `place-items Task 7: every type and turn keeps all parts inside the footprint` |

## R8. The result report says what Layout and Builder did and did not do
| # | Status | Proof |
|---|---|---|
| 8.1 | Passed | `Place Task 12: with only Unsure objects the report says each was checked and marked, and has no Locked line`; `Place Task 12: the counts come from the objects and use the right singular and plural words` |
| 8.2 | Passed | `Place Task 12: with a mix including Locked objects the report says the Locked ones were respected and not changed`; `Place Task 12: with only Locked objects nothing was checked or marked, and the line says so` |
| 8.3 | Passed | `Place Task 12: the fixed sentences and headings are exactly these words`; `Place Task 12: the result screen shows the placed-object lines, the "did not" list and the rectangles sentence` |
| 8.4 | Passed | `Place Task 12: the old lines and the fixed sentence are unchanged when objects are placed, and no line claims AI or design` |
| 8.5 | Passed | `Place Task 12: with no objects placed the report is exactly the old report (three lists, the old lines, none of the new ones)`; `place-items Task 14: the report lines are the exact ones for a mix of Locked and Unsure objects` |
| 8.6 | Passed | `Place Task 12: a room with objects but no size is named as skipped by the fit check; rooms with a size are not`; `Place Task 12: a style item and placed objects together keep the old item line and add the placed lines` |

## R9. Accessibility and privacy
| # | Status | Proof |
|---|---|---|
| 9.1 | Passed | `Place Task 10: every control on the screen has a visible label, nothing uses a placeholder, and no status is chosen at the start`; `Task 12 accessibility: every control made by the page scripts, on every screen, has a label tied to it, words on buttons and a text description on pictures` |
| 9.2 | Passed by test (every action is a real button, box or list; the plan is an extra way); a real keyboard walk-through: Unverified: pending owner check | `Place Task 13: the buttons the page script makes (Select, Edit, Remove) are real buttons with the shared 44 px style and words on them`; `Place Task 13: the place screen's controls are in reading order, none has a tabindex above 0, and the plan itself is not a tab stop (the list is the keyboard version)`; `Task 12 accessibility: the tab order follows the order on screen (controls in page order, no positive tabindex, no reordering styles)` |
| 9.3 | Passed by test (stylesheet and markup); how it measures on a real device: Unverified: pending owner check | `Place Task 13: every control on the place screen uses a shared style that is at least 44 px high, and every label and text size is at least 16 px`; `Place Task 13: the plan text is at least 16 px at 320 px wide, for small and large rooms (computed from the stylesheet)`. This test found a real fault (the plan label was 15.9 px at 320 px wide) and the code was fixed. |
| 9.4 | Passed by test; how the colours look: Unverified: pending owner check | `Place Task 13: the plan colours reach the contrast limits, and Locked and Unsure differ by line style and words, not colour alone`; `Place Task 13: the plan colour check fails when a plan colour is made too light (planted change in a copy)`; `Task 12 accessibility: every text colour pair reaches 4.5 to 1 and every border and focus colour reaches 3 to 1 (numbers printed)`; `Task 12 accessibility: every colour written in the stylesheet is in the contrast table, or is listed as a plain decoration`; `Place Task 11: Locked and Unsure differ by outline style and words, not by colour alone` |
| 9.5 | Passed by test (no fixed width above 320 px, the plan scales, one shrinkable column); a real 320 px phone and 200% zoom: Unverified: pending owner check | `Place Task 13: no fixed width above 320 px and no sideways scrolling rule in the place styles, and the plan scales to its panel` |
| 9.6 | Passed by test; what a screen reader says: Unverified: pending owner check | `Place Task 10: a refused add shows its sentence next to the box, linked with aria-describedby, and adds nothing`; `Place Task 10: a refused nudge keeps the old values and shows its sentence next to the button`; `Place Task 10: a refused Save changes keeps the old values, keeps what was typed, and shows its sentence next to the box`. |
| 9.7 | Passed | `Place Task 10: visitor text is shown as plain text only`; `Place Task 11: a name with page code in it is shown as plain text only`; `Place Task 13: the three new page files store nothing, send nothing, hold no web address and insert no visitor text as page code`; `Place Task 13: the content security rule is exactly the one set in Task 6 (no outside address, no inline script, no unsafe-eval), and the page loads no new script or style file`; `Place Task 13: using the place screen (add, select, nudge, turn, remove) touches no storage, cookie or network`; `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json`; `Intake 11.7: no file in the project holds an API key, token, password or secret` |
| 9.8 | Passed (draft statement); that the plan and 3D view are not claimed as accurate: Unverified: pending owner check (the wording must be read on the page) | `Task 6: the draft statement is on every screen (the two bars sit outside the screens and are never hidden)` |

## R10. Safety for existing work
| # | Status | Proof |
|---|---|---|
| 10.1 | Checked by command, no named test (not counted as Passed) | `npm test` passes in full (see the tally above). `git diff main` over `test/` shows only added test files and expected-value lines: the cache tag lines in `test/intake-screens.test.js` and `test/viewer-real-script.test.js` (this build), and the lines listed in the Session 28 and 29 log entries (earlier builds). No test was deleted or loosened. |
| 10.2 | Checked by command, no named test (not counted as Passed) | `git diff main -- package.json` is empty; no `node_modules` folder. |
| 10.3 | Checked by command, no named test (not counted as Passed); the secrets part is Passed | `git diff main -- LICENSE .gitignore` is empty; `.kiro` is not in `.gitignore`. Secrets: `Intake 11.7: no file in the project holds an API key, token, password or secret`. |

## Owner check: the short list
See the end of the session report and `KIRO_LOG.md` (Session 30). In short: open the published page on a computer and on a phone, start your own project, place objects, and look.
