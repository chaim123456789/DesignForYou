# DesignForYou

A browser web app idea for people with good taste who cannot use CAD software. Four agents (Style, Layout, Builder, Reviewer) work on one shared record of a home design, called the Project Brain.

**Everything shown here is a SAMPLE PROJECT. Plans are drafts for professional review. They are not verified engineering.**

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
- The 3D view, image uploads and live AI mode are separate, later pieces of work.
- Someone still needs to open the summary page in a browser and confirm it reads clearly. The checklist in `.kiro/specs/project-brain/acceptance-checklist.md` lists this and the other unverified points.

## 3D room viewer

The viewer is a web page in the `docs/` folder. It shows the finished sample home in 3D, with two floors you can turn and zoom. Blocks are coloured by status (blue for Locked, orange for Unsure) and blocks in a clash have a red outline. Click a block to see its details. Block names show when you point at or select a block, and always for clashes; tick "Show all labels" to see every name. A slider steps back through the version history, from "Before any change" (version 0, no clashes) to the latest version (both clashes). The page only displays what the sample run produced. It never changes anything.

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
