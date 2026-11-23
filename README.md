# DesignForYou

A browser web app idea for people with good taste who cannot use CAD software. Four agents (Style, Layout, Builder, Reviewer) work on one shared record of a home design, called the Project Brain.

**The sample is labelled SAMPLE PROJECT. A project you enter yourself is labelled YOUR PROJECT. Plans are drafts for professional review. They are not verified engineering.**

## How to use the app

Open the published page (the link is under "Publish the page" below). Nothing is saved and nothing leaves your browser. If you close or reload the page, everything you entered is lost.

**Start screen.** There are two buttons.
- "Try the sample" shows a made-up two-storey home in 3D, already run through the four helpers. It is labelled SAMPLE PROJECT.
- "Start my own project" takes you to your own project.

**Your own project.** You go through eight steps. "Back" and "Next" are at the bottom of each step, and "Start again" clears everything.
1. Project setup: name the project, add floors and rooms. Width and depth are optional and only draw the 3D view.
2. Overall inspiration: add pictures from your device and short notes (for example "warm oak") that fit the whole project.
3. Room overrides (optional): give one room its own notes. That room then uses only its own notes.
4. Your brief (optional): write in your own words what you want.
5. Taste questions (optional): answer up to six simple questions to see a short style profile. You can remove a tag from it.
6. Your items (optional): list the things you care about, and say for each one whether it is Locked (must stay as it is) or Unsure (open to change).
7. Place furniture, doors and windows (optional): this step is a placeholder for now. A later update will let you place furniture, doors and windows here.
8. Review and run: check what you entered, then press "Run the design team". The button stays off, with a reason, until the project has a name, a floor and a room.

**Result.** You see your home in 3D (turn, zoom, click a block, and use the slider for the history), a summary, your style profile with a mood board of your own pictures, and a section called "What the design team did with your input". The result is labelled YOUR PROJECT and is a draft for professional review. The design team is a set of fixed rules, not AI. It does not look at your images or read your brief. Press "Start again" to clear everything and go back to the start.

## Requirements

- **The website needs no Node.** The published page runs in an ordinary browser.
- **Running the tests, the sample and the export scripts on your own computer needs Node 22.15.0 or newer** (on the 22 line, or 23.5.0 and newer). Some tests use a Node feature (`registerHooks`) that older versions do not have. On an older Node those tests stop with the message "These tests need Node X or newer. You have Y." Check your version with `node --version`.
- Nothing needs to be installed with npm. The project has no dependencies.

## How to run the sample

The sample is a made-up two-storey home with a kitchen, living room, bedroom and bathroom. It goes through all four agents, in order, and produces a readable summary page.

### Just read the result (no setup)
1. On the GitHub page for this project, click the file `sample-summary.html`.
2. Click the download icon (it says "Download raw file" when you hover over it).
3. Open your Downloads folder and double-click `sample-summary.html`. It opens in your web browser.

The page shows the project structure, every item with its status (Locked or Unsure) and owner, the run log, the clash report and the version history.

### Run it yourself
You need Node.js 22 or newer on your computer. Nothing else is needed, because the project has no add-ons to install.

1. Open a terminal in this project's folder.
2. Type `npm run sample` and press Enter. This runs the sample and rewrites `sample-summary.html`.
3. Double-click `sample-summary.html` to read it.
4. To check that everything works, type `npm test` and press Enter. It should say that all tests passed and none failed.

### What you should see
- The red label "SAMPLE PROJECT" at the top and bottom.
- In the run log, Style is "Refused" once. It tried to change a Locked item (the oak kitchen floor) and was stopped.
- The clash report lists 2 clashes: the garden door sits where the sofa is, and the bedroom's cold steel style conflicts with the Locked oak bed frame.
- Running the sample again gives the same result every time.

### What is not done yet
- The 3D viewer and the intake screens (where you enter your own project and inspiration images) are done. Live AI mode is separate, later work.
- Someone still needs to open the summary page in a browser and confirm it reads clearly. The checklist in `.kiro/specs/project-brain/acceptance-checklist.md` lists this and the other unverified points.

## 3D room viewer

The viewer is a web page in the `docs/` folder. It shows the finished sample home in 3D, with two floors you can turn and zoom. Blocks are coloured by status (blue for Locked, orange for Unsure) and blocks in a clash have a red outline. Click a block to see its details. Block names show when you point at or select a block, and always for clashes; tick "Show all labels" to see every name. A slider steps back through the version history, from "Before any change" (version 0, no clashes) to the latest version (both clashes). The page only displays what a run produced (the sample run, or the run of your own project). It never changes anything.

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
