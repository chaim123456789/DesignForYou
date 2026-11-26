# Acceptance checklist: Look and feel

Written on 2026-11-26 (Task L6), branch `build-look-1`. Key (the same as the other checklists):
- **Passed**: a named automated test proves it. Test names are in backticks and are the exact names in `test/`. `node test-helpers/check-checklist.js .kiro/specs/look-and-feel/acceptance-checklist.md` matches every quoted name against the test files.
- **Unverified: pending owner check**: only a person can judge it (a real browser, a real phone, a real keyboard or screen reader, how it looks). It is never counted as Passed.
- A row can have both.

What the tests cannot see: they run the real page scripts on a stand-in page (`test-helpers/fake-page.js`) with a renderer that draws nothing, and they read the real `docs/index.html`, `docs/theme.css` and `docs/styles.css` as text. They cannot show how anything looks, the layout at a real width, a real phone, a real keyboard or screen reader, the browser's own full screen, or whether the 3D picture is pleasant. The theme colours are checked by computing contrast from the values in `docs/theme.css`.

## R1. One theme file, a calm look, dark by default
| # | Status | Proof |
|---|---|---|
| 1.1 | Passed | `L1: the theme file holds every colour, font and spacing value; the stylesheet holds none of its own`; `L1: the theme file has the fonts, the type sizes, the spacing steps and the motion times as named values` |
| 1.2 | Passed | `L1: dark is the default, the light theme defines every colour the dark theme does, and the page starts as dark`; `L1: the theme toggle is a button with a visible label; it switches dark and light, keeps the choice in this browser, and the page starts as chosen` |
| 1.3 | Passed | `Task 12 accessibility: every text colour pair reaches 4.5 to 1 and every border and focus colour reaches 3 to 1, in the dark and the light theme (numbers printed)`; `Task 12 accessibility: the stylesheet and the page scripts write no colour of their own; every colour is in the theme file and in the contrast table`; `Task 12 accessibility: the contrast check fails when a colour is made too light (planted change in a copy)` |
| 1.4 | Passed | `L1: motion respects "reduce motion": the theme sets every time to nothing and the stylesheet switches animation and transition off`; `L1: the theme file holds every colour, font and spacing value; the stylesheet holds none of its own` |
| 1.5 | Passed | `L6: the 3D view and the page use no outside images and no outside fonts, and viewer.js and the plan write no colour of their own` |
| 1.6 | Passed | `L1: every workspace control is a real button or box with visible words, in the order it appears on the screen, and the keyboard focus ring is on`; `L1: there is no visible-label gap: every box, list and check box has a label tied to it, in the workspace as well as the steps` |
| 1.7 | Passed | `L1: the page itself does not scroll: the body is fixed to the screen and only named areas scroll inside themselves` |
| 1.8 | Passed | `L1: every page file carries the cache tag build-look-1: the links, the scripts, every import of a page script, and the status lines` |

## R2. Home page
| # | Status | Proof |
|---|---|---|
| 2.1 | Passed | `L2: the home page has a headline, one sentence about what DesignForYou does, and exactly two buttons: "Try the sample" and "Start my own project"` |
| 2.2, 2.3 | Passed | `L2: the home page says honestly that the design team is rule-based and AI is off, with the exact fixed sentence once` |
| 2.4 | Passed | `L2: the headline is large and light, from the theme: the hero size, the display weight and the display font`; `L2: the calm motion of the home page (a slow glow and a gentle rise) is in the stylesheet, and "reduce motion" switches all of it off`; `L2: the home page needs no outside image or font, and on a short screen it scrolls inside itself, not the page` |
| 2.5 | Passed | `L2: the home page and the workspace are never on screen together; "Try the sample" opens the workspace with the sample; the DesignForYou button comes back` |

## R3. Workspace
| # | Status | Proof |
|---|---|---|
| 3.1 | Passed | `L3: the top bar has the project name, Show/Hide ribbon, Full screen and the theme toggle, in that order, with visible words`; `L3: Show/Hide ribbon hides the ribbon (floors, layers, labels) and brings it back, with the button saying which`; `L3: Full screen asks the browser to show the 3D view full screen, and the button says Exit full screen; Escape and the button leave it`; `L3: without the browser's full screen the 3D view fills the workspace instead, and Escape leaves it`; `L3: the top bar shows the project name: the sample's, the name you typed, and a plain word before you have typed one` |
| 3.2 | Passed | `L3: the left rail has Project, Agents, Materials and Settings in that order; Materials says "Coming next"` |
| 3.3 | Passed | `L3: the 3D view is as large as possible: it takes all the room the project area has, and the ribbon and panels do not push it off`; `L3: going to another page does not lose the project steps: the step you were on is still there when you come back` |
| 3.4 | Passed | `L3: the slim strip on the right lists the eight agents, each with its badge and what it is doing now; nothing else`; `L3: while the agents work, the strip says which one is asking and how many answers it waits for; it follows them to the end`; `L3: clicking an agent in the strip opens the Agents page at that agent's card` |
| 3.5 | Passed | `L3: on a phone the rail becomes four tabs at the bottom, the strip is replaced by the Agents tab, and the result splits into 3D, Details and Report tabs`; `L3: your own result has a Report tab with the summary and the design team's report, and the 3D view is the first tab` |
| 3.6 (protected steps) | Passed | `L3: if a workspace file cannot load (each of shell.js, agents-page.js, settings.js and store.js in turn), the red message names the step and the project steps still work` |

## R4. Agents page and the agents' identities
| # | Status | Proof |
|---|---|---|
| 4.1 | Passed | `L4: the Agents page has one card per agent, in order, each with a badge, its name, what it owns, its status, its proposals and its own setting`; `L4: while an agent asks, its proposals are in its own card with Confirm, Custom and Skip, and no other card has them`; `L4: the panel at the top of the Agents page (progress, the eight steps, the Continue button) is the same panel as before, and the proposals come back to it when the run ends` |
| 4.2 | Passed | `L4: the eight agents, in the registry order, each have their own letter and their own shape; the page adds nothing to the names`; `L4: each agent has its own colour in the dark and in the light theme, the colours are far enough apart, and the main five are the Okabe-Ito colours`; `L4: colour is never the only signal: where two colours look alike to a person with colour blindness, the letters and the shapes still differ`; `L4: a badge is the agent's letter in its shape and colour, hidden from a screen reader because the name is always written next to it` |
| 4.3 | Passed | `L6: a small legend on the 3D view lists the eight agents with their letter, shape and name, and does not catch clicks meant for the drawing`; `L4: the legend on the Agents page lists each agent with its badge, name and what it owns, and says colour is never the only signal`; `L6: every block is drawn in the colour of the agent that owns it, from the theme`; `L6: a Locked item has a bright edge on every part and its label says Locked; a clash label says Clash; the label has the owner's letter and colour` |
| 4.4 | Passed | `L4: the sample's cards show what the fixed script did: each agent's proposals with the answer and who answered`; `L4: after the run the cards show your own run: what each agent proposed, how it was answered, and what was re-checked`; `L4: proposal rows, notes and log lines say things in words and carry the tag, the answer and who answered` |
| 4.5 | Passed | `L4: the status words are true: waiting, asking, done, looked again, switched off, not started, and no record` |

## R5. Agent settings
| # | Status | Proof |
|---|---|---|
| 5.1 | Passed | `L5: there are exactly three levels, with the words "Always ask me", "Recommended" and "Do it and tell me", and "Always ask me" is the default`; `L5: "Always ask me" asks for everything, even a clean proposal`; `L5: "Do it and tell me" confirms every proposal for the user, except when the agent is unsure and shows two options`; `L5: "Recommended" asks when a change affects another agent's work, causes a clash, or touches a Locked item, and otherwise confirms`; `L5: a per-agent choice beats the global choice, and "use the choice for all agents" goes back to the global one`; `L5: the Agents page has the global choice, the rule, and one choice per agent, each with a visible label; Always ask me is picked first`; `L5: describeEffect: a wall change affects other agents' work only when work they have decided (a piece the user placed) was worked out from it`; `L5: describeEffect: a request to an earlier agent affects another agent's work, and a Locked item is reported as Locked`; `L5: describeEffect: a move that makes two pieces overlap is a clash, a move to a free place is not, and the real Brain is never changed`; `L5: describeEffect: a room with no window yet, or a light with no switch yet, is unfinished work and not a clash` |
| 5.2 | Passed | `L5: the rule "Doors and windows move with their wall" lets the follow-up of a wall change through at Recommended, and nothing else`; `L5: the design team screen tells the settings whether a step is a first pass or a re-check, so the rule can tell a follow-up from a first answer`; `L5: "Recommended" asks when a change affects work another agent has already decided (a door the user placed), and the rule lets the door follow its wall` |
| 5.3 | Passed | `L5: the settings are kept in the browser only, under one name, and read back; bad or missing storage never throws`; `L5: settings from the browser are checked: wrong types, unknown levels and unknown agents fall back to the defaults`; `L5: choosing a level on the Agents page is saved in the browser, shown in every agent's choice, and found again after a reload`; `L5: "Reset my settings" on the Settings page forgets the saved settings and the saved theme, and puts the defaults back` |
| 5.4 | Passed | `L5: a Locked item is never changed by a confirmation for the user: the gatekeeper refuses it and the item is flagged "needs your look"`; `L5: a confirmation for the user goes through the same gatekeeper: the owner rule holds, and only the label of who approved changes`; `L5: the gatekeeper file is untouched by the settings: it knows nothing about them, and its checks are in the same order (Locked, then owner)` |
| 5.5 | Passed | `L5: with "Do it and tell me" the agents' proposals are confirmed for the user, shown as Auto-confirmed, marked in the version record, and listed in the log`; `L5: "Recommended" confirms clean proposals and asks about the rest, and the Agents page names both` |
| 5.6 | Passed | `L5: "Do it and tell me" confirms every proposal for the user, except when the agent is unsure and shows two options` |
| 5.7 | Passed | `L5: with "Always ask me" every proposal waits for the user, and says why`; `L5: the page has no way to confirm for the user without the settings: with no saved choice every proposal is put to the user` |

## R6. 3D view
| # | Status | Proof |
|---|---|---|
| 6.1 | Passed | `L6: there are six layers: Structure, Openings, Lighting, Furniture, Decor and Style, and every kind of block belongs to one` |
| 6.2 | Passed | `L6: the lights and the small marks (switches, sockets, rugs) are hidden by default; the other four layers are on; the page boxes say the same`; `L6: switching a layer on draws its blocks, switching it off removes them again, and the camera and the details stay as they are`; `L6: the clash list still names every finding when a layer is off, and says how many are about things that are not drawn` |
| 6.3 | Passed | `L6: the light is soft: a sky-and-ground light and one gentle light, no hard ambient flood, no shadows` |
| 6.4 | Passed | `L6: a sofa has a seat, a back and two arms, all rounded, standing inside its footprint`; `L6: a table is round: a round top on one pedestal, and the pedestal is under the top`; `L6: a bed has a rounded mattress and a rounded headboard that is taller than the mattress`; `L6: the shape rules (softShapes): the radius never exceeds half of a part, a table gets one pedestal, doors and windows stay plain frames` |
| 6.5 | Passed | `L6: every block is drawn in the colour of the agent that owns it, from the theme`; `L6: an item owned by something that is not one of the eight agents (an older run) is drawn in the neutral colour, not left out`; `L6: a Locked item has a bright edge on every part and its label says Locked; a clash label says Clash; the label has the owner's letter and colour`; `L6: the clash outline takes its colour from the theme in both themes`; `L6: switching to the light theme draws the 3D view again with the light theme's colours` |
| 6.6 | Passed | `L6: the 3D view and the page use no outside images and no outside fonts, and viewer.js and the plan write no colour of their own` |

## R7. What does not change
| # | Status | Proof |
|---|---|---|
| 7.1 | Passed | `design-team A2: a write by the wrong agent is refused and logged, and writes no version`; `design-team A6: a Locked item is never changed, is refused by the gatekeeper, and is flagged "needs your look"`; the full suite (`npm test`) passes; the tests that were changed are listed in `KIRO_LOG.md` with their reasons |
| 7.2 | Passed | `Task 12 privacy: no page file stores anything, sends anything, holds a web address, reads image contents or inserts visitor text as page code, and the only web request is sample-run.json`; `Task 12 privacy: using the whole app (images, notes, brief, items, run, start again) touches no storage, cookie or network, other than the sample file at page load` |
| 7.3 | Passed | `Task 12 accessibility: the sample result shows the fixed sentence once, as one line outside the viewer's own parts, and the sample is otherwise unchanged` (labels and heading unchanged) |

## Unverified: pending owner check
| # | What only a person can judge |
|---|---|
| P1 | Open the published page in a real browser. The home page looks like a showcase: near-black, a large light headline, calm motion. With the device setting "Reduce motion" the motion stops. |
| P2 | The workspace fits the window with no page scrollbar at 1280 x 800, at a narrow desktop width and on a real phone, and the rail turns into tabs on the phone. |
| P3 | The 3D view is large, the sofa has a back and arms, the table is round, the bed has a headboard, the light is soft, and the Lighting and Decor layers switch the lights and rugs on and off. |
| P4 | The eight agent colours, letters and shapes can be told apart (ask someone with colour blindness if possible). |
| P5 | Light mode: switch it on, look at every page, and check that the text is easy to read. |
| P6 | Full screen: the browser's own full screen opens and closes with the button and with Escape. |
| P7 | Keyboard only: Tab through the home page, the rail, the Agents page and the project steps; the focus ring is always visible and the order matches the screen. |
| P8 | Run your own project step by step with each of the three levels and read the log on the Agents page. |
