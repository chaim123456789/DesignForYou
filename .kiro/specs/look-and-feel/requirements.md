# Requirements: Look and feel (a professional workspace)

## Purpose
Replace the long scrolling test screens with a calm, professional workspace: a home page that feels like a showcase, a workspace where the 3D view is as large as possible, an Agents page that shows what each of the eight agents is doing, and settings that say how much the user wants to be asked. The look lives in one theme file, so it can be restyled later in one place.

## Out of scope
A framework or any new add-on (the owner decides that), live AI mode, a Materials page that works (it is a placeholder), saving a project (nothing the user enters is saved), a login, any outside font or image. The agents' rules, the Project Brain, the gatekeeper and the owner rules are not changed.

## Words used in this document
- **Home page**: the first screen (the old "Start" screen).
- **Workspace**: everything after the home page: a top bar, a left rail, a main area, a slim strip of agents on the right, and (on a phone) tabs at the bottom.
- **Theme file**: `docs/theme.css`. The only file that holds a colour, a font name or a spacing value.
- **Ribbon**: the row of view controls above the 3D view: floors, Reset view, Show all labels and the six layer boxes.
- **Layer**: a group of things in the 3D view that can be switched on and off: Structure, Openings, Lighting, Furniture, Decor, Style.
- **Level**: how much an agent asks the user. Three levels: "Always ask me", "Recommended", "Do it and tell me".
- **Auto-confirmed**: a proposal that the user's agent settings confirmed for them, with its first (recommended) option.
- **Project Brain, item, Locked, Unsure, owner, gatekeeper, proposal, clash**: as in the earlier specs (`project-brain`, `design-team`).

## Requirements

### R1. One theme file, a calm look, dark by default
**As the owner, I want every colour, font and spacing in one place, so I can restyle the page later without touching anything else.**

Acceptance criteria:
1. Every colour, font name and spacing, radius, type size and time is written in `docs/theme.css` and nowhere else. `docs/styles.css` uses them by name. No page script writes a colour (the 3D view reads its colours from the theme).
2. The default theme is dark and elevated: a near-black background, thin fine lines, generous spacing, large light headings, restrained colour. A light theme is a toggle. Both themes define every colour.
3. Text reaches at least 4.5 to 1 against its background, and borders, focus rings and the other parts of a control reach at least 3 to 1 (WCAG AA), in both themes.
4. Cards and controls are rounded, and changes (hover, theme, page) are smooth. With the device setting "Reduce motion", no animation or transition runs.
5. The page uses no outside font and no outside image.
6. Everything works by keyboard, in the order it appears on the screen. The focus ring is always visible. Every control has visible words and every box has a visible label.
7. The page itself does not scroll. Each area scrolls inside itself when it must.
8. Every page file carries the cache tag `build-look-1`.

### R2. Home page
**As a visitor, I want to understand what DesignForYou does in a few seconds, and to start.**

Acceptance criteria:
1. A large headline, one sentence about what DesignForYou does, and the buttons "Try the sample" and "Start my own project".
2. An honest line that the design team is rule-based and that AI is off. The exact fixed sentence of the intake spec stays, once.
3. The home page says that nothing the visitor enters is saved, and that only the light or dark choice and the agent settings are kept in the browser.
4. The home page feels like a showcase, with calm motion (a slow glow, a gentle rise) that stops for "Reduce motion".
5. The home page and the workspace are never on screen together.

### R3. Workspace
**As a user, I want a workspace where the 3D view is as large as possible and I can always see what the agents are doing.**

Acceptance criteria:
1. A top bar with the project name, Show/Hide ribbon, Full screen (for the 3D view) and the theme toggle.
2. A left rail with Project, Agents, Materials and Settings. Materials is a placeholder that says "Coming next". Settings holds the look and a way to reset what is saved in the browser.
3. The Project page holds the project steps and the result. The 3D view takes all the room the area has.
4. A slim strip on the right shows only the agent icons and what each is doing now. Clicking one opens the Agents page.
5. On a phone, the rail becomes tabs at the bottom, the strip is replaced by the Agents tab, and the result is split into tabs (3D view, Details, and Report for the user's own project).
6. The protected steps, the red error message and the "Back" / "Next" / "Start again" flow of the intake spec keep working.

### R4. Agents page and the agents' identities
**As a user, I want to see each agent, what it owns, what it is doing, and answer its proposals where it asks.**

Acceptance criteria:
1. One card per agent, in the registry order: icon, name, what it owns, status, its proposals with Confirm / Skip / Custom, and its settings.
2. Each of the eight agents has its own colour, a letter badge and a shape. Colour is never the only signal. The colours are colour-blind-safe (the Okabe-Ito set, with three added shades).
3. The colours, letters and shapes are used in the 3D view (the body colour of every item and a letter in front of every label), in the labels and in a small legend. A legend is on the 3D view and on the Agents page.
4. A log lists what the agents did, in words, with no internal item names.
5. The statuses are true: an agent that has not run does not look finished.

### R5. Agent settings
**As a user, I want to choose how much I am asked, without changing who may change what.**

Acceptance criteria:
1. A global choice, and a choice for each agent, of three levels: "Always ask me"; "Recommended" (ask when a change affects another agent's work, causes a clash, or touches a Locked item, otherwise apply it and tell me); "Do it and tell me".
2. The rule "Doors and windows move with their wall" (on by default).
3. The choices are kept in the browser only. A "Reset my settings" button forgets them.
4. The settings change only how a proposal is confirmed. The gatekeeper, the owners and the Locked rules do not change. A Locked item is never changed.
5. An automatically confirmed proposal is marked "auto-confirmed" in the version record, and is shown as such in the proposal, the log, the summary and the report.
6. When an agent is unsure and shows two options, the user is always asked.
7. The default is "Always ask me", so nothing is confirmed for the user until the user chooses it.

### R6. 3D view
**As a user, I want a calm, readable 3D view.**

Acceptance criteria:
1. Layer boxes for Structure, Openings, Lighting, Furniture, Decor and Style.
2. The lights and the small marks (switches, sockets, rugs) are hidden by default. A clash about a hidden thing is still in the clash list, with a note.
3. Soft lighting (a sky-and-ground light and one gentle light, no hard shadows).
4. Rounded placeholder furniture: a sofa with a back and arms, a round table, a bed with a headboard.
5. Items are drawn in their owner's colour. A Locked item has a bright edge and its label says Locked. A clash has a red outline and its label says Clash.
6. No outside image, font or file is loaded.

### R7. What does not change
Acceptance criteria:
1. The gatekeeper and the Locked tests are not weakened. All earlier tests keep passing. A test that only asserted an old look detail (a count, an id, the cache tag, the old layout) may change, and each such change is listed with its reason in `KIRO_LOG.md`.
2. Nothing is installed and nothing is fetched. The page needs no network except its own files.
3. Plans are still drafts for professional review, and the two labels (SAMPLE PROJECT or YOUR PROJECT, and the draft statement) are always shown.
