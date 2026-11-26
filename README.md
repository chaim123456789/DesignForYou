# DesignForYou

A browser web app idea for people with good taste who cannot use CAD software. A design team of eight agents works, in this order, on one shared record of a home design, called the Project Brain: Walls, Doors and windows, Floors and ceilings, Lighting and electrical, Furniture, Decor, Style, Reviewer. Each agent suggests changes; nothing changes until you (or, in the sample, a fixed script) answer. The older four-agent pipeline (Style, Layout, Builder, Reviewer) is still in the code and still behind the "Run the design team" button, but the sample no longer uses it.

**The sample is labelled SAMPLE PROJECT. A project you enter yourself is labelled YOUR PROJECT. Plans are drafts for professional review. They are not verified engineering.**

## How to use the app

Open the published page (the link is under "Publish the page" below). Nothing is saved and nothing leaves your browser. If you close or reload the page, everything you entered is lost.

**Start screen.** There are two buttons.
- "Try the sample" shows a made-up two-storey home in 3D, already run through the eight agents with scripted answers (a fixed script, not a person, chose each answer). It is labelled SAMPLE PROJECT.
- "Start my own project" takes you to your own project.

**Your own project.** You go through eight steps. "Back" and "Next" are at the bottom of each step, and "Start again" clears everything.
1. Project setup: name the project, add floors and rooms. Width and depth are optional and only draw the 3D view.
2. Overall inspiration: add pictures from your device and short notes (for example "warm oak") that fit the whole project.
3. Room overrides (optional): give one room its own notes. That room then uses only its own notes.
4. Your brief (optional): write in your own words what you want.
5. Taste questions (optional): answer up to six simple questions to see a short style profile. You can remove a tag from it.
6. Your items (optional): list the things you care about, and say for each one whether it is Locked (must stay as it is) or Unsure (open to change).
7. Place furniture, doors and windows (optional): pick a room, then add a sofa, bed, table, wardrobe, desk, bath, kitchen unit, door or window. Each has a name, a Locked or Unsure status, a position and a size in centimetres. You can type the numbers, nudge an object by 10 cm, turn it by 90 degrees, put a door or window against a wall, or click the top-down plan to move the selected object. The list under the plan says the same thing in words. You can still change a Locked object here before you run the design team.
8. Review and run: check what you entered. Then either press "Step through the eight agents, and confirm each suggestion" (the design team, one agent at a time: each suggestion shows where it came from, Rule-based or AI, the rule that made it, and the buttons Confirm, Custom and Skip; the next agent starts only after you answer), or press "Run the design team" (the older four-agent pipeline, in one go). Both buttons stay off, with a reason, until the project has a name, a floor and a room.

**Result.** You see your home in 3D (turn, zoom, click a block, and use the slider for the history), a summary, your style profile with a mood board of your own pictures, and a section called "What the design team did with your input". It says how many objects you placed, which were Locked, and what Layout and Builder did not do (they only check and mark; they do not choose, move or fix anything). Besides the old clash types, the Reviewer now also reports furniture that overlaps furniture and objects that stick out of their room. It uses only the rectangles you entered. After a step-by-step run, the result also shows a panel called "The design team" with the eight agents in order, what each did, which were re-checked and why, and every suggestion with its tag and your answer, and every report line starts with Rule-based or AI. The result is labelled YOUR PROJECT and is a draft for professional review. The design team is a set of fixed rules, not AI. It does not look at your images or read your brief. Press "Start again" to clear everything and go back to the start.

## The workspace (look-and-feel)

The start screen is a home page. After it the page is a workspace that does not scroll as a whole: a top bar (project name, Show/Hide ribbon, Full screen for the 3D view, a light/dark switch), a left rail (Project, Agents, Materials, Settings), the 3D view in the centre and a slim strip on the right that shows what each agent is doing. On a phone the rail becomes a row of tabs.

- **Agents page.** One card per agent, each with its own colour, letter and shape (colour is never the only signal). The agent that is asking you has its proposals, with Confirm, Skip and Custom, inside its card.
- **Agent settings** (on the Agents page). "Always ask me", "Recommended" or "Do it and tell me", for all agents and for each agent, plus the switch "Doors and windows move with their wall". They only change who confirms a proposal. A proposal confirmed by a setting is marked "automatic" in the version record and in the log, and a Locked item is never confirmed automatically. Your settings and your colour mode are kept in this browser only. Nothing else is stored.
- **3D view.** Layer buttons (Structure, Openings, Lighting, Furniture, Decor, Style). Lights, switches, sockets and rugs are off at the start. Blocks take the colour of the agent that owns them; a Locked item has a dark outline and its label says "(Locked)". Furniture is drawn as rounded placeholders (a sofa with back and arms, a round table, a bed with a headboard).
- **One theme file.** All colours, fonts and spacing are in `docs/theme.css`. Change values there to restyle everything, in light and dark mode.

## Requirements

- **The website needs no Node.** The published page runs in an ordinary browser.
- **Running the tests, the sample and the export scripts on your own computer needs Node 22.15.0 or newer** (on the 22 line, or 23.5.0 and newer). Some tests use a Node feature (`registerHooks`) that older versions do not have. On an older Node those tests stop with the message "These tests need Node X or newer. You have Y." Check your version with `node --version`.
- Nothing needs to be installed with npm. The project has no dependencies.

## How to run the sample

The sample is a made-up two-storey home with a kitchen, living room, bedroom and bathroom. It goes through all eight agents, in order, with scripted answers (the first option of every suggestion, except one that is skipped on purpose), and produces a readable summary page. The sample's data is in `src/sample/team-sample-project.json`. AI is off (the spending cap in `src/ai/budget.json` is zero), so every result is Rule-based.

### Just read the result (no setup)
1. On the GitHub page for this project, click the file `sample-summary.html`.
2. Click the download icon (it says "Download raw file" when you hover over it).
3. Open your Downloads folder and double-click `sample-summary.html`. It opens in your web browser.

The page shows the project structure, every item with its status (Locked or Unsure) and owner, the run log (each line tagged Rule-based or AI), the clash report and the version history (each version says who approved it).

### Run it yourself
You need Node.js 22 or newer on your computer. Nothing else is needed, because the project has no add-ons to install.

1. Open a terminal in this project's folder.
2. Type `npm run sample` and press Enter. This runs the sample and rewrites `sample-summary.html`.
3. Double-click `sample-summary.html` to read it.
4. To check that everything works, type `npm test` and press Enter. It should say that all tests passed and none failed.

### What you should see
- The red label "SAMPLE PROJECT" at the top and bottom, and the sentence that says which parts are fixed rules, which can use AI, and that AI is off.
- In the run log, the eight agents start in order. Furniture asks Walls to make the kitchen 0.2 m wider for the 5.2 m kitchen units; that change makes Doors and windows, Floors and ceilings, Lighting and electrical and Furniture look again (a re-check pass).
- The suggestion to move the sofa away from the garden door is skipped on purpose, so the sofa is "kept as is".
- The Reviewer's report lists 9 findings, among them: the garden door swings into the sofa, the bedroom's cold steel style conflicts with the Locked oak bed frame, and the Locked oak bed is out of date and needs your look (it was not changed).
- Running the sample again gives the same result every time.

### What is not done yet
- The 3D viewer, the intake screens (where you enter your own project and inspiration images) and the eight-agent design team are done. Live AI mode is separate, later work: only the AI gate, a spending cap of zero and a stand-in are built, and no real model is called.
- Someone still needs to open the summary page and the published page in a browser and confirm they read clearly. The checklists in `.kiro/specs/project-brain/acceptance-checklist.md` and `.kiro/specs/design-team/acceptance-checklist.md` list this and the other unverified points.

## 3D room viewer

The viewer is a web page in the `docs/` folder. It shows the finished sample home in 3D, with two floors you can turn and zoom. Blocks are coloured by status (blue for Locked, orange for Unsure) and blocks in a clash have a red outline. Click a block to see its details. Block names show when you point at or select a block, and always for clashes; tick "Show all labels" to see every name. A slider steps back through the version history, from "Before any change" (version 0, no clashes) to the latest version (version 40, all nine findings). A panel called "The design team" lists the eight agents in order, what each did, which were re-checked and why, and every suggestion with its tag (Rule-based or AI), its rule and the scripted answer. Lights are drawn as small squares under the ceiling, switches and sockets as small blocks on the walls, and a rug as a thin mat. Objects you placed are drawn as simple shapes (a sofa has a seat, back and arms; a door and a window have frames). The page only displays what a run produced (the sample run, or the run of your own project). It never changes anything.

### Rebuild the viewer's data
You need Node.js 22 or newer. Type `npm run export-viewer` and press Enter. This runs the sample and rewrites `docs/sample-run.json`, the one file the page reads. Running it again gives the same file.

### Publish the page (GitHub Pages)
Do this once, after the pull request is merged.
1. On the GitHub page for the project, click **Settings**.
2. In the left list, click **Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Set **Branch** to `main` and the folder to `/docs`. Click **Save**.
5. Wait about a minute and refresh. GitHub shows the page address at the top. Open it.

The expected link is `https://chaim123456789.github.io/DesignForYou/` (confirm it on the Pages screen).

### Use the link, not the file
Double-clicking `docs/index.html` on your computer does not work. The browser blocks a page opened from a folder from reading the data file, so it would show an error message instead of the home. Always open the web link above.
