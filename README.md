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
