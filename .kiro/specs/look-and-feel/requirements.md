# Requirements: Look and feel

Status: written and built in the same session (branch `build-look-1`), at the owner's request. Group D of `design-team` (branch `build-team-4`) is on `main`.

## Purpose
Replace the long scrolling test screens with a calm, professional workspace. The design team, the gatekeeper, the owners and the Locked rule are not changed. Only how the page looks, how it is laid out, and how proposals are confirmed.

## Words used
- **Home page**: the first screen. It replaces the old Start screen. Same ids for the two buttons.
- **Workspace**: everything after the home page. Top bar, left rail, centre, right strip.
- **Ribbon**: the row of view controls above the 3D view and the side panels next to it (legend, history, clashes, details).
- **Agent strip**: the slim column on the right with one icon per agent and what it is doing now.
- **Theme file**: `docs/theme.css`. The only file that holds colours, fonts and spacing values.
- **Level**: how a proposal is confirmed. "Always ask me", "Recommended" or "Do it and tell me".
- **Automatic confirmation**: a proposal confirmed by a level, not by the visitor. It is marked `automatic` in the version record and in the run log.

## Out of scope
Materials (a placeholder page only), saving anything on a server, any change to a knowledge file, an agent's rules, the gatekeeper, owners, or the Locked rule. No outside images, fonts or scripts.

## Requirements

### R1. Home page
1. Shows a headline, one sentence on what DesignForYou does, the buttons "Try the sample" and "Start my own project", and the honest line that the design team is rule-based and AI is off.
2. The two buttons keep the ids `choose-sample` and `choose-own`.

### R2. Workspace
1. The page itself does not scroll. Only panes inside it scroll.
2. Top bar: project name, Show/Hide ribbon, Full screen (for the 3D view), theme toggle.
3. Left rail: Project, Agents, Materials (placeholder that says "coming next"), Settings.
4. Centre: the 3D view as large as the space allows. Right: a slim agent strip. Clicking an agent opens the Agents page.
5. On a phone-sized screen the rail becomes tabs and the strip is hidden (the Agents tab has the same information).
6. The SAMPLE PROJECT / YOUR PROJECT label and the draft statement stay visible.

### R3. Agents page
1. One card per agent: icon, name, what it owns, status, its proposals with Confirm / Skip / Custom, its setting.
2. Each of the eight agents has its own colour and its own letter badge. Colour is never the only signal. The eight colours are colour-blind-safe.
3. The colours and badges are used in the 3D view, in labels and in a small legend.

### R4. Agent settings (on the Agents page)
1. A global level and a per-agent level, each one of three: "Always ask me"; "Recommended" (ask when a change affects another agent's work, causes a clash, or touches a Locked item, otherwise apply it and tell me); "Do it and tell me".
2. A switch "Doors and windows move with their wall".
3. Stored in the browser only. Nothing is sent anywhere.
4. They change only how proposals are confirmed. An automatic confirmation goes through the same gatekeeper, is marked `automatic` in the version record and shown in the log. The gatekeeper, the owners and the Locked rules do not change.

### R5. Theme
1. Calm colours, good type, spacing, rounded cards, dark and light mode.
2. WCAG AA contrast (4.5 to 1 for text, 3 to 1 for borders and focus rings) in both modes.
3. Everything works from the keyboard. Every control has a visible label. A visible focus ring.
4. All colours, fonts and spacing values are in the theme file. No other style file or script holds a colour literal.

### R6. 3D view
1. Layer toggles: Structure, Openings, Lighting, Furniture, Decor, Style.
2. Lights and small marks (switches, sockets, rugs) are hidden by default.
3. Soft lighting. Rounded placeholder furniture: a sofa with a back and arms, a round table, a bed with a headboard.
4. No outside images or fonts.

### R7. Safety rules that stay
1. Protected setup steps and the red error message stay.
2. The cache tag `build-look-1` is on every page file.
3. Existing tests pass. A test changes only if it asserts an old look detail, and every such change is listed in `KIRO_LOG.md` with its reason.
4. No installs, no network.
