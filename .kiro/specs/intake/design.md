# Design: Intake

Covers requirements R1 to R13 in `requirements.md`. No app code is written in this step, and nothing is installed.

## 1. Decision (approved by the owner 2026-11-19)

**Use plain JavaScript, no framework, no installed packages, as in the two earlier specs.**

- The intake is about eight simple screens made of forms. Plain HTML, CSS and ES modules are enough, and native form controls (text box, radio buttons, file picker) are already keyboard friendly and screen-reader friendly. A framework would add something to learn and something that can break.
- The page stays a static page in `docs/`, so GitHub Pages can serve it as it does today.
- Tests keep using Node's built-in `node --test`, with the same stand-in page helpers in `test-helpers/`.

Alternative considered: a framework such as React. It helps with big, changing screens. These screens are small and linear. Not worth it now. `tech.md` says to ask before choosing one, so this is a question for you (section 10).

## 2. What the agents can do with the visitor's input today (honest version)

The four agents are fixed rules. They are not AI. They have never seen an image or a sentence. What each one really does:

| Agent | What it does today | What it does with intake input |
|---|---|---|
| Style | For each **Unsure** style item, adds the room's inspiration notes to the item's detail text (the room override if there is one, otherwise the overall notes). It never edits a Locked item (the gatekeeper stops it). | Uses the visitor's notes, the style profile tags, and the visitor's items. This is the one place where input visibly changes the output. |
| Layout | Marks Unsure furniture items as "placement checked". It moves nothing. | Nothing. Intake collects no furniture positions. |
| Builder | Same for Unsure doors and windows. | Nothing. Intake collects no doors or windows. |
| Reviewer | Looks for two kinds of clash: a door or window on furniture, and a room's override notes that clash with a Locked item's tag in that room, using a small list of opposite pairs. | The second kind only. It runs only for rooms that have an override, and only for Locked items that have a tag. |

What no agent does: read an image, read the brief, understand a sentence, choose a layout, pick furniture, or suggest anything new.

### Recommendation: what the agents should do with the inputs

The aim is a result that is meaningful (the visitor's inputs visibly matter) and not misleading (nothing is claimed that did not happen).

1. **Notes, style profile tags and items: used.** They flow through the existing Style agent and Reviewer, with no change to any agent. This is true to how the agents work.
2. **Brief: kept, not read.** It is saved with the project and printed in the summary, so the visitor sees it is there. No keyword matching. Fake understanding (for example "we noticed you said 'cosy'") would be misleading.
3. **Images: kept in the page, not read.** They are never put into the Brain. The summary lists only how many were added. The result screen says they were not analysed. (Reading images is only possible with AI, which is a later, separate step, section 8.)
4. **Items are all style items** (a material, colour or finish, such as "Oak floor in the kitchen"). Furniture, doors and windows need a position in the room. Asking a non-expert to type rectangle coordinates is poor, and inventing positions would make clashes look real when they are not. So Layout and Builder honestly do nothing in this version, and the screen says so. A later spec can add a simple "place on a room plan" screen.
5. **The Reviewer's comparison list is shown.** The fixed opposite pairs (the sample has two: warm oak against cold steel, linen against glossy chrome) are displayed on the result screen under the clash report. The report is worded as "found nothing in this small list" and never as "no problems".
6. **Approved 2026-11-19, its own small task (Task 5b):** the Reviewer also compares the *overall* notes and style profile tags against Locked items, not only room overrides. Before this, a Locked oak floor with a profile tag "cold steel" was not caught. It touches the Reviewer file, so it has its own tests and the sample result must stay unchanged (the sample has no such conflict in overall notes; the test proves it).

### How the screens label this

- One fixed sentence on the start screen and on the result screen: "The design team is a set of fixed rules, not AI. It does not look at your images or read your brief."
- A result section "What the design team did with your input", with three lists:
  - **Used:** "Your notes (and style profile tags) were added to the description of each Unsure item." "Your items and their Locked or Unsure status were respected." "The clash check compared room notes with Locked items using this short list: ..."
  - **Kept but not read:** "Your brief" (shown in the summary). "Your N images" (shown only in this page, never uploaded).
  - **Nothing to do this time:** "Layout and Builder had nothing to place, because no furniture, doors or windows were entered."
- Run log lines already say "Refused" when a Locked item is protected. The summary explains the word.
- Text at the point of entry (images, brief) says what will happen, so the visitor is never surprised later.
- The page is labelled "YOUR PROJECT" plus the draft statement. It never shows SAMPLE PROJECT for the visitor's own project, and it never shows only a bare "Result", so the two cannot be mixed up.

## 3. How the browser runs the existing code

Facts found in the code:
- `runPipeline(project, options)` already accepts `options.configs`, `options.agents` and `options.now`, so the browser can supply them. The Coordinator itself is not Node-only.
- Two things are Node-only: `src/agents/config.js` imports `node:fs` (it reads each `agent.json`), and `src/viewer/make-sample-run.js` and `src/sample/run-sample.js` read files with `node:fs`.
- GitHub Pages serves only `docs/`. The `src/` folder is not served.
- Existing tests forbid network calls, web addresses and environment variables in `src/`.

Recommendation:
1. **Browser-safe config file.** Make a small change to `src/agents/config.js` so that `node:fs` is only used when files are actually read (the browser passes its configs directly, so it never reads files). All existing tests must still pass. This is an edit to existing code, so it needs approval (section 10, question 3).
2. **One pipeline, published by copy.** A script `npm run export-engine` (no dependencies) copies the needed files from `src/` (`brain/`, `agents/*/agent.js`, `agents/config.js`, `coordinator.js`, `label.js`) into `docs/engine/`, byte for byte. A test fails if the copies differ from `src/`. This gives the page the same code as the tests, without a second, rewritten pipeline (R7.4). The copies are generated, never edited by hand.
3. **The four `agent.json` settings** are imported as plain objects by the page: all four on.
4. **The run data for the viewer** (what `make-sample-run.js` does for the sample) is split in two: a pure function that builds the run data from a finished project (no file reading), and the existing file reading kept for the sample script. The pure function lives in `src/viewer/` and is copied to `docs/engine/` like the rest.
5. **Room sizes for the viewer.** The sample has a fixed size table. For a visitor's project the sizes come from the optional width and depth in the setup form (default 4 by 4 metres). The page says plainly these only draw the 3D view. Rooms are placed on their floor in a simple row, in the order entered.

## 4. One page, several screens

**Recommendation: keep one page, `docs/index.html`, and show one screen at a time.** The existing viewer becomes the last screen (the "Result" screen) of the same page, and the visitor's data is handed to it in memory. Reasons: a second page cannot receive data without browser storage, and R11.2 forbids storage.

- Screens: Start, Setup, Inspiration (overall), Room overrides (optional), Brief, Taste, Items, Review and run, Result.
- Each screen is a section with a heading. Only one is shown. Moving between them uses real buttons ("Back", "Next"), so the keyboard works. On change, focus moves to the new heading and the page title is updated (R12.3).
- The step list at the top is plain text ("Step 3 of 8: Inspiration"), and links to earlier steps work.
- **Viewer change:** `docs/viewer.js` today fetches `sample-run.json` itself. It will get a small function "show this run data", used both by "Try the sample" (which fetches the same file as today) and by "Run the design team". The viewer's tests (`viewer-real-script`, `viewer-slider`, `viewer-labels`, `viewer-readability`, and the others) must still pass. This is the riskiest edit, so it is a separate task with its own check (Task 11).
- **Content security rule.** One change only: allow `img-src 'self' blob:` for the image previews. Everything else stays, and inline script stays forbidden. The page's import map hash is unchanged unless the import map changes.
- **Files.** New plain scripts (no framework), one per area, so no two files do the same job: `docs/intake/state.js` (the visitor's inputs, in memory), `docs/intake/limits.js`, `docs/intake/taste.js`, `docs/intake/build-brain.js`, `docs/intake/report.js`, `docs/intake/screens.js`. Pure logic (limits, taste rules, building the Brain, the report) has no page code, so Node tests can check it directly.

## 5. Data and rules

**In-memory state (never stored, R11.2):** project name; floors (name, rooms: name, width, depth); overall notes; room overrides (room, notes, images); images (name, caption, type, size, a temporary preview address); brief; taste answers; removed profile tags; items (text, room, status, tag).

**Limits** live in one file, `limits.js`, so screens, checks and tests use the same numbers: 1 to 60 characters for the name; 1 to 4 floors; 1 to 20 rooms in total; unique room names (ignoring case); 50 images in total, 10 MB each, JPEG, PNG or WebP; 30 notes per layer, 40 characters each; brief 2000; item text 80; 100 items. Added in Task 2 because the form needs a bound (owner may change them): floor and room names 40 characters; room width and depth 1 to 30 metres; image caption 80 characters; item tag 40 characters.

**Images.** Added through the browser's file picker (an `input type="file"`, with a visible label, also usable by keyboard). Each file is checked by type and size, then shown through a temporary browser address (`URL.createObjectURL`). The address is released on remove and on "Start again". The file is never read into the Brain, never sent, never put in storage. An image's text description is the visitor's caption or "Inspiration image N".

**Taste questions and profile.** A table in `taste.js`: 6 questions, each answer maps to one tag and one sentence. A function `buildProfile(answers)` returns the sentences and tags. Pure and repeatable. Example questions and answers:
1. Light or dark: "light" / "dark" / "a mix".
2. Soft or high contrast.
3. Classic or trend.
4. Durable or showpiece.
5. Warm or cool.
6. Calm or lively.
The sentence is built as one line per answered question, such as "You like light rooms." and then one summary sentence. The visitor can remove a tag before running.

**Building the Brain** (`build-brain.js`), using only existing functions (`createProject`, `addFloor`, `addRoom`, `setProjectInspiration`, `setRoomOverride`, `createItem`):
- Project: name, `isSample` false.
- Overall inspiration: notes plus remaining profile tags (duplicates removed, order kept).
- Room overrides: from the room override notes (images are not in the Brain).
- Items: kind `style`, owner `Style`, status as chosen, room as chosen, value `{ tag, detail }` where detail is the visitor's text.
- One Reviewer-owned `clash` item, "Not reviewed yet", as in the sample.
- The brief, the profile sentences and the image count are added to the project as new optional fields (`brief`, `styleProfile`, `imageCount`). This is a small, additive change to the Project Brain code (`createProject` must keep or accept them) and is a separate approved task (Task 4). They are read only by the summary. No agent reads them, and a test proves it.
- Agents: `styleAgent` (the normal one, not the sample one that deliberately tries a Locked item), `layoutAgent`, `builderAgent`, `createReviewerAgent({ styleConflicts: <fixed list>, isSample: false })`. The fixed list is the same two pairs as the sample, in `docs/intake/limits.js`. The sample data file is not changed.
- Clock: the fixed clock the sample uses, so the same inputs give the same result.
- Because the normal Style agent does not try a Locked item, a visitor's run log will usually show no "Refused". The report says "No Locked item needed protecting this time." It is not staged.

**Summary.** `make-summary.js` is already a function from a finished project to HTML. It runs in the browser from `docs/engine/`. It is shown inside the Result screen (below or beside the viewer). It gets a small addition for the brief, the profile and the "What the design team did" section. Texts the visitor typed are always inserted as plain text (never as HTML), so a note such as `<b>` is shown as typed. Today the summary builds an HTML string; the task must check how it escapes text and test it with hostile input before it is used with visitor text.

## 6. Accessibility plan (R12)

- Native controls only: `label` tied to each input, `fieldset` and `legend` around each question's choices, buttons for actions. No custom widgets, no drag and drop.
- Visible focus ring (at least 3 to 1 against its background, 2 px). No removal of the browser's outline without a replacement.
- Colours chosen once as named values in the CSS, and a test computes the contrast ratio of every text and background pair and every border and focus colour from those values (4.5 to 1 and 3 to 1). The existing status colours (blue Locked, orange Unsure) are checked the same way, and the words "Locked" and "Unsure" always accompany them.
- Layout: one column, 16 px or larger text, 44 px minimum controls, a media query for narrow screens, no fixed widths that force sideways scrolling at 320 px. The 3D view may scroll or zoom its own area.
- A status line (`role="status"`, polite) announces "Item added", "Image removed", "Image too large: ...". Errors sit next to the field and are linked to it (`aria-describedby`), and focus goes to the first error when a step cannot continue.
- Page title and focus move on each screen change.
- The 3D view has a text alternative: the clash list and the summary hold the same facts, and a sentence on the Result screen says so.
- What tests can check: labels exist and are tied to controls, headings per screen, contrast numbers, the presence of `lang`, the viewport tag, the status region, tab order follows the order of the HTML (no positive `tabindex`). What only a person can check (pending owner check): reading on a real phone, using only a keyboard in a real browser, a screen reader pass, zoom to 200%.

## 7. Safety and privacy

- No `fetch` except for the page's own `sample-run.json` (when "Try the sample" is chosen) and no other address, enforced by a test that searches the new files and by the content security rule.
- No storage calls (`localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`) in any new file. A test searches for them.
- The page warns on leaving (`beforeunload`) once something has been entered, and says that reloading loses everything.
- Visitor text is only ever shown with `textContent` (or escaped), never as HTML.
- File names of images can hold personal data. They are shown on the visitor's own screen only and are not put into the Brain, the summary or the exported data.
- Every screen shows the draft statement. The result is not a verified plan.
- No secrets or keys exist in this spec. `LICENSE` is unchanged. `.kiro` is not in `.gitignore`.

## 8. Later live AI mode: options (NOT built here)

The page is static on GitHub Pages, so it has no private place to keep a key. Anything in the page's files or code can be read by any visitor. `tech.md` says a key stays server-side and never appears in the repo, logs or any file. Costs depend on the provider and model, and I have not looked up current prices; check before choosing.

**Option A: the visitor types their own key (bring your own key).**
- Where the key lives: in the visitor's page memory only, typed in each time. The page calls the AI provider straight from the browser.
- Cost: paid by each visitor, nothing for you.
- Risk: visitors are asked to paste a secret into a web page, which many will not do and which is a bad habit to teach. Anything else running in the page could read it. Some providers do not allow calls straight from a browser. It also breaks the "nothing is sent anywhere" promise, which must then be replaced by a clear, separate opt-in screen. Images and text would go to the provider.

**Option B: a small server function that holds your key (recommended later).**
- Where the key lives: in the hosting service's secret settings (for example a serverless function), never in the repo and never in the page. The page sends its request to your function, and the function calls the AI provider.
- Cost: you pay for every request, plus (usually small) hosting. Needs a spending limit set at the provider, and limits per visitor.
- Risk: someone could use your function to spend your money, so it needs rate limits, a daily cap, and a way to switch off. Visitors' text and images would pass through a server you run, so a privacy text, a clear opt-in screen, and no logging of content are required. It adds a server to maintain, which is a first for this project.

**Option C: local mode only.**
- Where the key lives: in an environment variable on the owner's or the user's own computer. A small local program runs the AI calls and the page talks to it on the same machine.
- Cost: paid by whoever runs it.
- Risk: not usable by judges or ordinary visitors (needs Node.js and a terminal). Safe for the key, but not a product.

**Recommendation:** keep the hosted page rule-based and AI-free (as now). When live AI is wanted, choose **Option B**, built in its own spec, with: a hard daily spending cap set at the provider, a per-visitor rate limit, AI off by default and switched on by a clear opt-in, images sent only if the visitor ticks a box, and the rule-based result always available as the fallback. Use Option C only as a private way for the owner to try AI ideas without exposing anything. Avoid Option A for the public page. No AI work starts without your approval, and nothing is installed or signed up for without your yes.

### 8.1 Keeping the design ready for one AI step (NOT built now)

Approved direction: later, after intake works, one real AI step for the Style agent. The key stays on a server function (Option B). The rules-based Style agent stays as the fallback. To keep that easy, and without building anything now:
- The run function in `build-brain.js` takes the agent list as a parameter (the Coordinator already accepts `options.agents`). A later step swaps the Style agent without touching the Coordinator or the other agents.
- The AI step would be a separate file with the same shape as the rules-based Style agent: it only proposes changes, and the gatekeeper still refuses any change to a Locked item.
- If the AI step is off, fails or times out, the rules-based Style agent runs. The result screen would say which one ran.
- No key, no address of a server and no AI code is added now. The tests that forbid network calls stay as they are.

## 9. How the design will be checked

| Requirement | Check |
|---|---|
| R1 | Test the start screen has exactly the two choices; "Try the sample" loads the unchanged `sample-run.json` and shows SAMPLE PROJECT |
| R2, R3, R4, R6 | Pure tests for limits and messages (too many floors, duplicate room, 51st image, wrong type, too big, empty name); page tests with the stand-in page for adding and removing |
| R5 | Same answers give the same profile; removed tags are not used; no answers gives "No style profile yet" |
| R7 | Build a Brain from known inputs; run the real Coordinator and agents; check order, owners, repeatable result, Locked items unchanged, failure message keeps the inputs |
| R8 | Result data goes to the viewer, no SAMPLE PROJECT label, draft statement present, sample result unchanged; the existing viewer tests still pass |
| R9, R10 | A test proves no agent reads `brief`, `styleProfile` or images (a planted read makes it fail); the "What the design team did" text and the fixed sentence are present |
| R11 | Search new files for `fetch` (only the sample file), storage, cookies and web addresses; check the content security rule; check preview addresses are released |
| R12 | Structure tests (labels, headings, status region, tab order), contrast computed from the CSS values; real device checks listed as pending owner check |
| R13 | Checklist script matches every quoted test name against the test files, like the earlier two specs |

## 10. Owner decisions (all answered 2026-11-19)

1. Approved: plain JavaScript, no framework, no installs; one page with the viewer as its last screen.
2. Approved: the three small edits to existing code. All existing tests must keep passing, none deleted or weakened, each edit its own small task, verified after each.
3. `package.json` may gain a script `export-engine` that only copies files. No dependencies.
4. `product.md` now says "up to 50 images".
5. The Reviewer also checks overall notes and style profile tags against Locked items (Task 5b).
6. The result screen shows the visitor's images as a mood board next to the style profile, keeps the "fixed rules, not AI" sentence and "What the design team did with your input".
7. Items stay style-only. Room width and depth stay optional, default 4 by 4 metres.
8. Later, not now: one real AI step for the Style agent (section 8.1).
9. The six taste questions in R5.1 stay as written unless the owner rewords them.
