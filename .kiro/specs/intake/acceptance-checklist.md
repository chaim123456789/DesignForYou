# Acceptance checklist: Intake

Written on 2026-11-20 (Task 13), branch `build-intake-6`. `node --test` result at that point: 459 tests, 459 passed, 0 failed. At the start of the intake work it was 235.

Tally of the 86 criteria: 63 Passed by named tests only; 17 Passed by test with a part that is also "Unverified: pending owner check"; 4 with a **Not passed** part (12.4, 12.5, 12.6, 12.9); 2 only "Unverified: pending owner check" (11.7, 13.3).

Key (strict):
- **Passed**: a named automated test proves it. The test names are written in backticks and are the exact names in `test/`. `node test-helpers/check-checklist.js .kiro/specs/intake/acceptance-checklist.md` matches every quoted name against the test files.
- **Not passed**: a check was done and the page does not meet the criterion. It is written down on purpose and needs an owner decision.
- **Unverified: pending owner check**: only a person looking at the real published page, on a real device, can judge it. It is never counted as Passed.
- A row can have both: "Passed" for the part a test proves and "Unverified: pending owner check" for the part only a person can see.

What the tests cannot see: they run the real page scripts on a stand-in page (`test-helpers/fake-page.js`) with a renderer that draws nothing. They cannot show how anything looks, colours as drawn, sizes on a real screen, a 320 px or phone layout, zoom to 200%, a real keyboard, the real focus ring, a screen reader, WebGL, the real file picker and real image previews, the browser's own "leave this page?" box, the browser's own enforcement of the content security rule, or the network tab of a real browser.

Test names that start with "Task 12:" or "Task 11:" come from the earlier build sessions, where the owner's batch numbering differed from `tasks.md`. They are the exact names in `test/`. The Task 12 tests of `tasks.md` (accessibility and privacy) are in `test/intake-accessibility-privacy.test.js` and start with "Task 12 accessibility:" or "Task 12 privacy:".

## R1. Start screen
| # | Status | Proof |
|---|---|---|
| 1.1 | Passed | `Task 6: the start screen has exactly two choices, with the exact words` |
| 1.2 | Passed by test; how the sample looks: Unverified: pending owner check | `Task 6: "Try the sample" shows the existing viewer; "Back to start" returns; the viewer markup is hidden until then`; `Task 11: the viewer offers one function "show this run data", and the sample goes through it with the same drawing as before`; `Task 12: "Try the sample" works as before (labels, heading, same drawing, no new fetch), also after an own project`; `Task 4b: the sample run output is unchanged (matches docs/sample-run.json exactly)`; `Task 4: SAMPLE PROJECT and the draft statement on the page equal src/label.js, top and bottom, outside the 3D area`. One approved addition: the sample result now also shows the fixed "not AI" sentence as one line, proved by `Task 12 accessibility: the sample result shows the fixed sentence once, as one line outside the viewer's own parts, and the sample is otherwise unchanged`. |
| 1.3 | Passed | `Task 6: "Start my own project" opens the setup screen`; `Task 12: the run button is disabled with a plain reason until there is a name, a floor and a room` (the project starts empty) |
| 1.4 | Passed | `Task 6: the start screen says what the app does, that it needs no login, that nothing leaves the browser, and the rule-based sentence` |
| 1.5 | Passed | `Task 6: the start screen says what the app does, that it needs no login, that nothing leaves the browser, and the rule-based sentence` |

## R2. Project setup
| # | Status | Proof |
|---|---|---|
| 2.1 | Passed | `Task 2: project name - empty is refused, 60 characters are accepted, 61 are refused`; `Task 7: the project name is checked, and the "still needed" line follows the project` |
| 2.2 | Passed | `Task 2: floors - 4 are accepted, the 5th is refused, an empty name is refused`; `Task 7: the limits hold: a 5th floor and a 21st room are refused with a message`; `Task 12: the run button is disabled with a plain reason until there is a name, a floor and a room` (at least one floor) |
| 2.3 | Passed | `Task 2: rooms - 20 in total are accepted, the 21st is refused, across floors`; `Task 2: room names must differ, ignoring upper and lower case (also on another floor)`; `Task 7: bad input shows a message tied to its field with aria-describedby, and adds nothing` |
| 2.4 | Passed | `Task 2: width and depth are optional and default to 4 by 4 metres`; `Task 2: width and depth at the edges (1 and 30 metres) are accepted, just outside or not a number are refused`; `Task 7: the size boxes say they are only for the 3D drawing, and the project name box says its limit` |
| 2.5 | Passed | `Task 7: a floor and a room can be renamed, and a bad new name shows a message in the row and changes nothing`; `Task 7: a room is removed at once, and the status line says so`; `Task 7: removing a floor asks first; "No" keeps it, "Yes" removes the floor and its rooms`; `Task 2: removing a floor removes its rooms, their items, their overrides and their images (and returns the images)` |
| 2.6 | Passed | `Task 7: bad input shows a message tied to its field with aria-describedby, and adds nothing`; `Task 2: every refusal message is plain text with no ids or field names` |

## R3. Inspiration (images and notes, in layers)
| # | Status | Proof |
|---|---|---|
| 3.1 | Passed by test; the real file picker: Unverified: pending owner check | `Task 2: images - 50 in total are accepted (overall and overrides together), the 51st is refused`; `Task 2: images - JPEG, PNG and WebP are accepted, other types are refused with a reason`; `Task 8: a wrong type of file is refused with a message, and no preview address is made`; `Task 8: an image over 10 MB is refused, exactly 10 MB is accepted`; `Task 8: the 51st image is refused with a message and gets no preview address` |
| 3.2 | Passed by test; the real network tab of a browser: Unverified: pending owner check | `Task 8: the privacy sentence is next to the picker, and the picker has a visible label and only accepts the three types`; `Task 12: the review lists name, floors and rooms, images, notes, brief, style profile and items with status, in plain words` (the run screen sentence); `Task 12 privacy: the plain sentences are on the page: nothing leaves the browser, images stay here, nothing is saved, the brief is not read, the draft statement is on every screen`; `Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load`; `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json` |
| 3.3 | Passed by test; how the previews look: Unverified: pending owner check | `Task 8: a good image shows a preview, its name, a text description, and can get a caption`; `Task 8: removing an image releases its preview address (and only that one)`; `Task 12 accessibility: every control made by the page scripts, on every screen, has a label tied to it, words on buttons and a text description on pictures` |
| 3.4 | Passed | `Task 2: notes - 30 per layer are accepted, the 31st is refused; each layer counts on its own`; `Task 2: notes - 40 characters are accepted, 41 are refused, empty is refused`; `Task 8: notes can be added with the button or Enter, are shown as plain text, and can be removed` |
| 3.5 | Passed for the behaviour; the one-sentence explanation: Unverified: pending owner check | `Task 8: a room override is added, shown, and removed, and the room goes back to the overall inspiration`; `Task 8: a room override replaces the overall notes in the built Project Brain, and other rooms keep the overall notes`. The sentence "A room with its own notes uses only those notes." is in `docs/index.html` (`override-intro`), but no named test reads it. |
| 3.6 | Passed | `Task 2: notes can be removed; a room override can be removed so the room goes back to the overall notes`; `Task 8: a room override is added, shown, and removed, and the room goes back to the overall inspiration` |
| 3.7 | Passed | `Task 8: the "less to work with" sentence shows with no images and no notes, and goes away with the first note` |
| 3.8 | Passed by test; the browser's own "leave this page?" box: Unverified: pending owner check | `Task 8: the warning before leaving the page is registered only once something has been entered`; `Task 12 privacy: the plain sentences are on the page: nothing leaves the browser, images stay here, nothing is saved, the brief is not read, the draft statement is on every screen` (the start screen says everything is lost on close or reload) |

## R4. Brief
| # | Status | Proof |
|---|---|---|
| 4.1 | Passed | `Task 9: the brief stops at 2000 characters, says so, and shows the count`; `Task 9: the brief box has a visible label, the plain sentence about what happens to the brief, and is optional`; `Task 2: brief - 2000 characters are accepted, 2001 are refused, empty is allowed` |
| 4.2 | Passed | `Task 9: the brief box has a visible label, the plain sentence about what happens to the brief, and is optional`; `Task 2: brief - 2000 characters are accepted, 2001 are refused, empty is allowed` |
| 4.3 | Passed | `Task 9: the brief box has a visible label, the plain sentence about what happens to the brief, and is optional`; `Task 9: the brief goes into the Project Brain as typed (kept, not read), and typing it registers the warning before leaving` |

## R5. Taste questions and style profile
| # | Status | Proof |
|---|---|---|
| 5.1 | Passed | `Task 3: there are exactly 6 questions, each with 2 or 3 answers`; `Task 3: the six questions cover light/dark, soft/high contrast, classic/trend, durable/showpiece, warm/cool, calm/lively` |
| 5.2 | Passed for labels and no answer chosen; using the choices with a real keyboard: Unverified: pending owner check | `Task 9: every question is a fieldset with a legend and 2 or 3 radio choices, each with a label, and none is selected at the start` |
| 5.3 | Passed | `Task 3: skipped questions are left out (missing, empty, null or unknown answers)` |
| 5.4 | Passed | `Task 3: a profile has a sentence per answer, a summary sentence and a tag per answer`; `Task 9: the profile text and tags update after each answer, and when an answer changes` |
| 5.5 | Passed | `Task 3: the same answers give the same profile (run twice, deep-equal)`; `Task 3: the file uses no randomness, clock, network or storage (code search)`; `Task 3: no sentence, label or tag says or suggests AI, analysis, understanding or detection` |
| 5.6 | Passed | `Task 3: removed tags are absent from the tags, the sentences and the summary`; `Task 9: a removed tag disappears from the profile, can be put back, and comes back when its question is answered again`; `Task 9: a removed tag is not in the Project Brain, and the tags that stay are added to the overall inspiration` |
| 5.7 | Passed | `Task 9: a removed tag is not in the Project Brain, and the tags that stay are added to the overall inspiration`; `Task 9: the profile text and tags update after each answer, and when an answer changes` (it reads the sentence on the page that says the tags are added to the overall inspiration) |
| 5.8 | Passed | `Task 3: no answers gives "No style profile yet" and no tags`; `Task 9: with no answers the page says "No style profile yet" and shows no sentences or tags` |

## R6. Items
| # | Status | Proof |
|---|---|---|
| 6.1 | Passed | `Task 2: items - text 80 characters accepted, 81 refused, empty refused`; `Task 2: items - Locked or Unsure must be chosen (no default), the room must exist`; `Task 10: the room list matches the rooms entered in setup, and follows renames and removals` |
| 6.2 | Passed | `Task 10: the item form has a label for every control, the two explanation sentences, and no status chosen at the start`; `Task 10: an item cannot be added without choosing Locked or Unsure, and the message is tied to the choice` |
| 6.3 | Passed | `Task 2: items - the tag is optional, up to 40 characters`; `Task 10: the list shows the status as text, with room and tag, and the list actions change, edit and remove` |
| 6.4 | Passed | `Task 10: the Brain gets the items as style items owned by Style, and "Start again" clears the form and the list`; `Task 10: the item form has a label for every control, the two explanation sentences, and no status chosen at the start` (the form has no furniture, door or window choice) |
| 6.5 | Passed | `Task 2: items can be edited, their status changed and removed; bad edits change nothing`; `Task 10: the list shows the status as text, with room and tag, and the list actions change, edit and remove` |
| 6.6 | Passed | `Task 2: items - 100 are accepted, the 101st is refused`; `Task 10: item number 101 is refused with a message next to the Add button` |
| 6.7 | Passed | `Task 10: the list shows the status as text, with room and tag, and the list actions change, edit and remove` |
| 6.8 | Passed | `Task 10: the list shows the status as text, with room and tag, and the list actions change, edit and remove` (it reads the "You can go on without items" sentence) |

## R7. Run the design team
| # | Status | Proof |
|---|---|---|
| 7.1 | Passed | `Task 12: the review lists name, floors and rooms, images, notes, brief, style profile and items with status, in plain words` |
| 7.2 | Passed | `Task 12: the run button is disabled with a plain reason until there is a name, a floor and a room`; `Task 12: a floor with no room keeps the button disabled and the reason names that floor` |
| 7.3 | Passed | `Task 4b: known inputs give the expected floors, rooms, inspiration, overrides and items with the right owner`; `Task 4b: the run order in the log is Style, Layout, Builder, Reviewer`; `Task 12: pressing the button runs the design team and shows YOUR PROJECT with the draft statement, never SAMPLE PROJECT, and makes no network call` |
| 7.4 | Passed | `Task 1c: every file in docs/engine/ is byte-identical to its source in src/`; `Task 1c: docs/engine/ holds only the listed files`; `Task 1c: docs/engine/coordinator.js runs a tiny project when every Node file tool throws` |
| 7.5 | Passed | `Task 4b: two runs of the same inputs are deep-equal` |
| 7.6 | Passed | `Task 4b: Locked items are deep-equal before and after the run`; `Task 5: when a change to a Locked item is refused, the report says so and does not say nothing needed protecting` |
| 7.7 | Passed | `Task 12: if an agent fails, the screen names it, keeps the inputs and offers Back; fixing it and running again works`; `Task 12: a failure of the first agent is named too, and the failure message is gone when the screen is shown again`; `Task 4b: a failing agent returns a failure that names the agent and keeps the inputs` |
| 7.8 | Passed | `Task 12: pressing the button runs the design team and shows YOUR PROJECT with the draft statement, never SAMPLE PROJECT, and makes no network call`; `Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load` |

## R8. Result: 3D viewer and summary
| # | Status | Proof |
|---|---|---|
| 8.1 | Passed by test; how the 3D view looks with a visitor's project: Unverified: pending owner check | `Task 12: the 3D viewer shows the visitor's data, not the sample`; `Task 11: showing a visitor's own run data replaces the drawing, the slider, the caption and the clash list, with no network call`; `Task 11: the floor buttons are named after the visitor's floors, and a button for a missing floor is hidden` |
| 8.2 | Passed | `Task 12: the result has the summary, the style profile with the mood board of the visitor's images, the report and the fixed sentence`; `Task 12: summaryNodes accepts the real summary of a finished visitor project` |
| 8.3 | Passed | `Task 12: pressing the button runs the design team and shows YOUR PROJECT with the draft statement, never SAMPLE PROJECT, and makes no network call` |
| 8.4 | Passed | `Task 12: the result has the summary, the style profile with the mood board of the visitor's images, the report and the fixed sentence` |
| 8.5 | Passed | `Task 12: "Start again" clears the result, the mood board and the previews, and the viewer shows the sample again` |
| 8.6 | Passed | `Task 11: going from the sample to an own project and back gives the sample's drawing again, unchanged`; `Task 11: the viewer offers one function "show this run data", and the sample goes through it with the same drawing as before`. All 235 tests that existed before the intake work still pass; the only edits to old tests are the expected cache tag values and the one approved change to the file-input ban (see the log). The one approved visible change to the sample is the added fixed sentence (see 1.2). |
| 8.7 | Passed by test; how the mood board looks: Unverified: pending owner check | `Task 12: the result has the summary, the style profile with the mood board of the visitor's images, the report and the fixed sentence`; `Task 12: a style profile that is empty says so, and no images shows no mood board` |

## R9. What the helpers do with the visitor's input
| # | Status | Proof |
|---|---|---|
| 9.1 | Passed | `Task 4b: no agent file mentions brief, styleProfile, imageCount or images`; `Task 4b: planted read: the same check fails on a copy of an agent file that reads the brief, and on one that reads images` |
| 9.2 | Passed | `Task 4b: Unsure style items get the room notes added by the normal Style agent` |
| 9.3 | Passed | `Task 4b: a room override "cold steel" with a Locked "warm oak" item in that room gives the expected clash`; `Task 5b: an overall note "cold steel" with a Locked "warm oak" item gives a clash`; `Task 5b: a style profile tag that clashes with a Locked item gives a clash (built from taste answers through the intake)`; `Task 5b: items without a tag are skipped`; `Task 5: the pairs shown are exactly the pairs given to the Reviewer (same list as the sample, and each one really clashes)` |
| 9.4 | Passed | `Task 5: a line says Layout and Builder had nothing to place when no furniture, doors or windows exist` |
| 9.5 | Passed | `Task 4b: changing the brief, the profile sentences and the image count changes nothing the agents produce`; `Task 4b: the brief, the profile sentences and the image count are kept as optional project fields; images are not in the Brain`; `Task 5: the brief and the images appear under "Kept but not read" and never under "Used"` |
| 9.6 | Passed for the report text and the style profile text only; the rest of the page text: Unverified: pending owner check | `Task 5: no text claims AI, understanding, design or analysis (word search over every line)`; `Task 3: no sentence, label or tag says or suggests AI, analysis, understanding or detection`. No test searches the fixed text of every screen in `docs/index.html` for such words. |
| 9.7 | Passed | `Task 5: the clash line says the Reviewer found nothing in this small list, and only when no clash was found`; `Task 4b: with no override the report says "No clashes found"` |

## R10. Clear labelling of what is rule-based
| # | Status | Proof |
|---|---|---|
| 10.1 | Passed | `Task 5: the fixed sentence is exact, is the report sentence, and matches requirements.md and design.md`; `Task 12: the result has the summary, the style profile with the mood board of the visitor's images, the report and the fixed sentence`; `Task 12 accessibility: the sample result shows the fixed sentence once, as one line outside the viewer's own parts, and the sample is otherwise unchanged` |
| 10.2 | Passed | `Task 5: the report has the three lists with the expected headings, in order`; `Task 5: the brief and the images appear under "Kept but not read" and never under "Used"` (the third list is headed "Nothing to do this time", as in `design.md`) |
| 10.3 | Passed | `Task 8: the privacy sentence is next to the picker, and the picker has a visible label and only accepts the three types`; `Task 9: the brief box has a visible label, the plain sentence about what happens to the brief, and is optional` |
| 10.4 | Passed | `Task 6: the draft statement is on every screen (the two bars sit outside the screens and are never hidden)`; `Task 12 privacy: the plain sentences are on the page: nothing leaves the browser, images stay here, nothing is saved, the brief is not read, the draft statement is on every screen` |
| 10.5 | Passed | `Task 5: the sentence check fails if the sentence is changed in one place only (planted change in a copy)`; `Task 12 privacy: the plain sentences are on the page: nothing leaves the browser, images stay here, nothing is saved, the brief is not read, the draft statement is on every screen` |

## R11. Nothing leaves the browser
| # | Status | Proof |
|---|---|---|
| 11.1 | Passed by test; the network tab of a real browser: Unverified: pending owner check | `Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load`; `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json` |
| 11.2 | Passed | `Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load`; `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json`; `Task 12 privacy: a planted localStorage call, cookie, web request or web address in a copy makes the search fail`; `Task 12 privacy: an image's file name is shown only in the visitor's own image list, not in the Project Brain, the summary or the result screen` |
| 11.3 | Passed by test; the browser's own enforcement of the rule: Unverified: pending owner check | `Task 6: the content security rule differs from before only by blob: for images, with no unsafe-inline and no outside address`; `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json` (it also reads the rule) |
| 11.4 | Passed for cookies, outside addresses and web requests; that no login screen or banner shows: Unverified: pending owner check | `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json`; `Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load` |
| 11.5 | Passed | `Task 8: removing an image releases its preview address (and only that one)`; `Task 8: "Start again" releases every preview address and clears everything entered`; `Task 8: removing a room or a floor releases the previews of its override images` |
| 11.6 | Passed | `R7.6: src/ has no network calls (code search)`; `R7.6: src/ has no web addresses (code search)`; `R7.6: src/ reads no environment variables (code search)`; `Task 1c: docs/engine/ has no static Node imports, no network calls, no web addresses, no environment variables` |
| 11.7 | Unverified: pending owner check | No named test searches for keys or secrets. A one-off search of the repository for key, secret, password, token and email patterns found only words in the spec and steering texts, a regular expression named `TOKEN` in `docs/intake/summary-view.js`, and the made-up phrase "secret brief" in a test. `Task 2: the exported file has no email, phone number, street word or web address` covers the sample data only. |
| 11.8 | Passed | This row records a decision, not a feature. The page now has forms; 11.1 and 11.2 above still hold. `Task 4: no outside addresses, storage, form, file upload, eval or innerHTML in the page files` was changed with the owner's approval in the earlier session to allow exactly one labelled file input. |

## R12. Accessibility and phones
| # | Status | Proof |
|---|---|---|
| 12.1 | Passed by test; how it reads on a real screen: Unverified: pending owner check | `Task 12 accessibility: every text box, list, choice, picker and checkbox in the page has a visible label tied to it, and every button has words`; `Task 12 accessibility: every control made by the page scripts, on every screen, has a label tied to it, words on buttons and a text description on pictures`; `Task 7: every control on the setup screen has a visible label, and no placeholder is used as a label` |
| 12.2 | Passed for the order of the controls and the focus-ring rule in the stylesheet; using only a real keyboard, and seeing the ring on a real screen: Unverified: pending owner check | `Task 12 accessibility: the tab order follows the order on screen (controls in page order, no positive tabindex, no reordering styles)`; `Task 7: the Enter key adds a floor and a room, and every action can be done with buttons and keys alone`; `Task 6: the new styles use text of at least 16 px, controls of at least 44 px, a visible focus ring, and no fixed pixel widths` |
| 12.3 | Passed | `Task 6: moving to another screen moves the keyboard focus to its heading, and not on first load`; `Task 6: every screen has its own page title, and the titles differ`; `Task 12 accessibility: each screen has exactly one h1, the heading can take focus, and every id on the page is used once` |
| 12.4 | Passed for text, borders, controls and the focus ring; **Not passed** for the orange Unsure colour (see below) | `Task 12 accessibility: every text colour pair reaches 4.5 to 1 and every border and focus colour reaches 3 to 1 (numbers printed)`; `Task 12 accessibility: every colour written in the stylesheet is in the contrast table, or is listed as a plain decoration`; `Task 12 accessibility: the contrast check fails when a colour is made too light (planted change in a copy)`. The words "Locked" and "Unsure" are always in the list of items: `Task 10: the list shows the status as text, with room and tag, and the list actions change, edit and remove`. **Not passed:** the Unsure orange (`#e69f00`, set in `docs/viewer.js` and the legend swatch) is 2.25 to 1 on white and 1.99 to 1 on the pale 3D floor slab. The 3 to 1 limit is missed. The viewer's colours were not changed, because the sample must look as before. The test lists exactly these two numbers as known shortfalls and fails if anything else goes below its limit. |
| 12.5 | Passed for the new screens' text size (16 px or more); **Not passed** for the viewer's block names in 3D; 320 px and 200% zoom: Unverified: pending owner check | `Task 6: the new styles use text of at least 16 px, controls of at least 44 px, a visible focus ring, and no fixed pixel widths`; `Task 7: the setup styles keep text at 16 px or more, boxes and buttons at 44 px or more, and let rows wrap on a narrow screen`; `Task 9: the stylesheet gives the choices and the brief box room: choices at least 44 px high, no fixed pixel widths`. **Not passed:** the names drawn next to blocks in the 3D view (`.scene-label` in `docs/styles.css`) are 0.9 rem, which is 14.4 px. Those labels belong to the viewer and were not changed. |
| 12.6 | Passed for the buttons and choices of the intake screens; **Not passed** for the viewer's own buttons; a real phone: Unverified: pending owner check | `Task 6: the new styles use text of at least 16 px, controls of at least 44 px, a visible focus ring, and no fixed pixel widths`; `Task 9: the stylesheet gives the choices and the brief box room: choices at least 44 px high, no fixed pixel widths`. **Not passed:** the viewer's floor buttons and "Reset view" come to about 41 px high, and the clash list buttons to about 42 px (worked out by hand from `docs/styles.css`: line height 24 px, plus padding and border). No test measures this. |
| 12.7 | Passed by test; screen-reader reading: Unverified: pending owner check | `Task 12 accessibility: a message next to a field is tied to it with aria-describedby, and the keyboard focus goes to that field`; `Task 12 accessibility: there is a polite status region for announcements and alert boxes for problems, and the announcements happen`; `Task 7: bad input shows a message tied to its field with aria-describedby, and adds nothing` |
| 12.8 | Passed | `Task 12 accessibility: every control made by the page scripts, on every screen, has a label tied to it, words on buttons and a text description on pictures`; `Task 8: a good image shows a preview, its name, a text description, and can get a caption`. The page has no decorative pictures. |
| 12.9 | Passed for a visitor's own result; **Not passed** for the sample result | `Task 12: the result has the summary, the style profile with the mood board of the visitor's images, the report and the fixed sentence` (it reads the sentence "The 3D view has a text alternative: the summary and the clash list on this page hold the same information."); `Task 12 privacy: the plain sentences are on the page: nothing leaves the browser, images stay here, nothing is saved, the brief is not read, the draft statement is on every screen`. **Not passed:** that sentence sits in the part of the page that is hidden on the sample result, so the sample does not say it. The sample has the clash list but no summary on the page. Not changed, because the sample must look as before. |
| 12.10 | Passed | This file. Everything a person must judge is marked "Unverified: pending owner check", and none of it is marked Passed. |

## R13. Plain-language visibility
| # | Status | Proof |
|---|---|---|
| 13.1 | Passed for messages and the review list; the rest of the screen text: Unverified: pending owner check | `Task 2: every refusal message is plain text with no ids or field names`; `Task 12: the review lists name, floors and rooms, images, notes, brief, style profile and items with status, in plain words`. No test searches the whole page text for internal words such as ids. |
| 13.2 | Passed | This file, and `node test-helpers/check-checklist.js .kiro/specs/intake/acceptance-checklist.md` matches every quoted test name against `test/`. |
| 13.3 | Unverified: pending owner check | The README has a "How to use the app" section (start screen, own project, result). No test reads it, because the task did not list one. Please read it. |

## Self-review of the numbers and rules (Task 12)
- **Contrast numbers** are computed from the colour values written in `docs/styles.css` (and the three status colours in `docs/viewer.js`). Lowest text ratio: 5.76 to 1 (grey text on the 3D area background). Lowest border or focus ratio: 3.11 to 1 (table border at a heading). To reach 3 to 1, one colour was darkened: the borders of panels, list rows, groups of choices, tables and mood board pictures changed from `#8a9299` to `#7d858c` (it was 2.87 to 1 on the page background). The viewer's own thin borders were left as they were.
- **Colours as named values:** the named list of colour pairs is in the test, not in the stylesheet. The stylesheet still uses plain hex values. A check fails if a new colour appears in the stylesheet without a contrast check.
- **Could not be checked:** the text colour of the viewer's "Both", "Ground floor", "Upper floor", "Reset view" and clash list buttons is chosen by the browser. Black was assumed. The disabled "Run the design team" button uses the browser's grey, which the standard does not require to reach the ratio. Text drawn inside the 3D picture. Dark mode or forced colours of a browser. How the browser draws radio buttons, tick boxes and the slider.
- **Labels:** every control in `docs/index.html` and every control the scripts make (checked on a full run) has a label tied to it or sits in a label. The "Locked or Unsure" and taste questions are fieldsets with legends. No placeholder is used. The page has no decorative pictures.
- **Tab order:** the order of the controls in the page is the order on screen, there is no positive tabindex, and the stylesheet has no style that reorders things. That does not prove what the real tab key does. Hidden screens are hidden with `display: none`, so their controls are out of the tab order in a browser; the stand-in page cannot show that.
- **Privacy rules:** searches cover all 31 files in `docs/` except `docs/vendor/` (the approved Three.js copy, which was not searched). The only web request is `fetch(SAMPLE_RUN_FILE)` in `docs/viewer.js`. A planted `localStorage` call in a real file made the search fail, and was removed.

## What only the owner can check, on the published page
1. Start screen, setup, inspiration, brief, taste, items and review screens read clearly and look tidy, on a laptop and on a phone (R12.1, R12.5, R12.6, 13.1).
2. On a phone: no sideways scrolling on any screen except the 3D view; buttons easy to press; the text is readable (R12.5, R12.6).
3. Zoom the browser to 200%: every screen still works (R12.5).
4. Use only the keyboard (Tab, Shift+Tab, Enter, Space, arrow keys on the choices): every step, every button, and a visible ring around the control you are on (R12.2, R5.2).
5. A real file picker: choose a photo, see the preview, remove it; try a file that is not a JPEG, PNG or WebP (R3.1, R3.3).
6. Reload or close the page after typing something: the browser asks before leaving (R3.8).
7. Run an own project: the 3D view shows your rooms, a red outline on a clash, the YOUR PROJECT label, the mood board and the "What the design team did" section (R8.1, R8.7).
8. Open the browser's network tab (F12) while using the app: nothing is sent except `sample-run.json` at page load (R11.1).
9. Read the sentences once for tone: the room-override sentence (R3.5), the start screen, the report; nothing should sound like AI (R9.6).
10. A screen reader, if you have one: the status line speaks after "Add floor", an error is read with its field (R12.7).
11. Decide on the three shortfalls: the Unsure orange (R12.4), the 14.4 px block names and 41 px viewer buttons (R12.5, R12.6), and the missing text-alternative sentence on the sample (R12.9).
12. Read the README section "How to use the app" (R13.3), and look for secrets (R11.7).
