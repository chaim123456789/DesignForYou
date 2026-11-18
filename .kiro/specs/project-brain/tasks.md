# Tasks: Project Brain and Sample-mode Pipeline

Rules for every task:
- Plain JavaScript, no framework, no installed packages (approved in `design.md`).
- Do one task at a time, then verify it and report exactly how, before starting the next.
- Tests are run with `node --test`. A task is not finished until its check passes.
- If a task fails twice, stop and explain.
- Do not touch `LICENSE`, and keep `.kiro` out of `.gitignore`.

"Req" shows which requirements the task covers.

---

### Task 1. Project setup
Create `package.json` with `"type": "module"`, a `test` script that runs `node --test`, and no dependencies. Create the empty folders from `design.md` section 2.
- **Req:** none (setup)
- **Verify:** `package.json` has no `dependencies` or `devDependencies`. `node --test` runs and reports 0 tests with no error. `git status` shows no `node_modules`.

### Task 2. Project, floors and rooms
Build the project structure with validation: a project has floors, a floor has rooms, order is kept. Reject a room with no floor and a floor with no project.
- **Req:** R1
- **Verify:** Tests pass for: a valid project loads; a room with no floor is rejected with a clear message; a floor with no project is rejected; order is the same on every load.

### Task 3. Inspiration layers
Add the overall inspiration set, optional room overrides, and a function that returns the effective inspiration for a room.
- **Req:** R2
- **Verify:** Tests pass for: a room without an override gets the overall set; a room with an override gets its own set; one room's override does not change another room; clearing an override returns the room to the overall set.

### Task 4. Items with status and owner
Add items with kind, room, value, status (default Unsure) and exactly one owner. Reject unknown statuses, missing owners, two owners, and an owner that does not match the kind.
- **Req:** R3.1 to R3.4, R4.1 to R4.3, R4.5
- **Verify:** Tests pass for: a new item defaults to Unsure; status "Maybe" is rejected; no owner is rejected; two owners is rejected; each item kind maps to its owner (style to Style, layout to Layout, door and window to Builder, clash to Reviewer).

### Task 5. Version history
Add an append-only version list. Each entry has number, time, who, item, field (`value` or `status`), old value and new value. Numbers start at 1 and rise by 1. No edit or delete function exists.
- **Req:** R8.1 to R8.3
- **Verify:** Tests pass for: first change is version 1, next is 2; each entry has all seven fields; there is no exported way to edit or remove an entry.

### Task 6. Gatekeeper
Build `createGatekeeper(project)`, which returns two functions: `changeItem(who, itemId, newValue)` and `changeStatus(who, itemId, newStatus)`. Order of checks in `changeItem`: Locked is refused first (even for the owner), then a non-owner is refused, then the change is accepted and a version is written. Refusals go to the run log and write no version. `changeStatus` is for the user only (Locked to Unsure and back); anyone else is refused. Each accepted status change writes a version. Each version has one extra field, `field` (`value` or `status`), so status changes can be replayed. Owners are strict by kind: style is owned by Style, layout by Layout, door and window by Builder, clash by Reviewer, and an item with any other owner is rejected.
- **Req:** R3.5, R4.4, R5.1 to R5.4, R8.4
- **Verify:** Tests pass for: owner changes an Unsure item and a version appears; the owner is refused on a Locked item and the value is identical before and after; a non-owner is refused on an Unsure item; each refusal appears in the run log with agent, item and reason; refusals create no version; a user unlocking an item (via `changeStatus`) makes it changeable and writes a version; an agent calling `changeStatus` is refused.

### Task 7. View the Brain at a past version
Add a read-only function that returns the Brain as it was at version N.
- **Req:** R8.5, R8.6
- **Verify:** Tests pass for: listing versions in order; the Brain at version 2 matches the known state after two changes; calling it does not change the current Brain or add a version.

### Task 8. Agent config files and shared label
Create `agent.json` for Style, Layout, Builder and Reviewer (name, `enabled`). Add one shared function that returns the "SAMPLE PROJECT" label and the draft-for-professional-review statement.
- **Req:** R6.6, R6.7, R7.5 (label source)
- **Verify:** Tests pass for: all four configs load; an invalid config gives a clear message; the Reviewer is treated as on even if its file says off; the label text contains "SAMPLE PROJECT" and the draft statement.

### Task 9. Coordinator with stand-in agents
Build the Coordinator to run the four agents in fixed order using empty stand-in agents. Agents get a read-only view and return proposed changes, which the Coordinator sends to the gatekeeper. Log start and finish for each. Skip disabled agents and log the skip. If an agent fails, stop, log the agent and reason, and run no later agent.
- **Req:** R6.1 to R6.7
- **Verify:** Tests pass for: the run log shows Style, Layout, Builder, Reviewer in that order; an agent set to off shows "skipped"; a stand-in that throws stops the run and later agents do not run; changes accepted before the failure remain in the Brain and history; an agent trying to write directly is not possible.

### Task 10. Sample data file
Create `sample-project.json`: 2 floors, 4 rooms (kitchen, living room, bedroom, bathroom), overall inspiration, a bedroom override, at least 2 Locked and 3 Unsure items, and a small style conflict list. Build in a door placed on furniture, and an override that conflicts with a Locked style item. No personal data.
- **Req:** R7.1 to R7.3, R7.8, R9.4 (data part)
- **Verify:** A test loads it and counts: 2 floors, 4 rooms, at least 2 Locked, at least 3 Unsure, at least 1 override. Search the file for names, emails and addresses and find none.

### Task 11. Style agent
Implement the Style agent. It reads the Brain and proposes changes to style items it owns only. In the sample, one proposal targets a Locked style item so the refusal shows.
- **Req:** R4.5, R5.5, R6.3
- **Verify:** Tests pass for: Style changes only Unsure style items; the Locked-item proposal is refused and logged; Style writes nothing outside its own folder or items.

### Task 12. Layout agent
Implement the Layout agent for layout items (room positions, sizes, furniture placement) it owns.
- **Req:** R4.5, R6.3
- **Verify:** Tests pass for: Layout changes only Unsure layout items; Locked layout items are unchanged; no change to items owned by other agents.

### Task 13. Builder agent
Implement the Builder agent for door and window items it owns.
- **Req:** R4.5, R6.3
- **Verify:** Tests pass for: Builder changes only Unsure door and window items; Locked ones are unchanged; the sample ends with the door-on-furniture case present.

### Task 14. Reviewer agent and clash report
Implement the Reviewer. It reads only, and checks two clash types: door or window on furniture, and a room override that conflicts with a Locked style item. Each clash lists the two items, room, plain description and severity. It saves the report as a Reviewer-owned item through the gatekeeper. With no clashes it says "No clashes found". The report carries the sample label and the draft statement.
- **Req:** R9.1 to R9.8
- **Verify:** Tests pass for: the sample report has at least 2 clashes, one of each type, each with all fields; a clean project gives "No clashes found"; the Reviewer changes no item owned by another agent; the report appears in version history; the label and statement are present.

### Task 15. Full sample run
Wire the sample through the real Coordinator and the four real agents. No sample-only shortcut.
- **Req:** R5.5, R6, R7.4, R7.6, R7.7
- **Verify:** Tests pass for: the run log order is correct; every item Locked at the start has the same value and is still Locked at the end; running twice from the same start gives identical Brain, versions and report; a search of the code finds no branch that skips the Coordinator for the sample.

### Task 16. Summary page
Write `make-summary.js` to produce one HTML file with structure, items with status and owner, run log, clash report, version list, the "SAMPLE PROJECT" label and the draft statement, all in plain words.
- **Req:** R7.5, R10.1, R10.2
- **Verify:** A test checks the HTML contains the label, the statement, each section heading, and no raw internal field names. Then the owner opens the generated file in the browser and reads it. I will tell you the exact file path and steps.

### Task 17. Final check and log
Run all tests. Walk through every acceptance criterion in `requirements.md` and mark each as passed, with the test or step that proves it. Add the `KIRO_LOG.md` entry for the build session. Update `README.md` with a plain-language "how to run the sample" section.
- **Req:** all
- **Verify:** `node --test` shows all tests passing. The checklist has no unmarked item; any unverified criterion is listed as unverified. `git diff` shows `LICENSE` unchanged and `.gitignore` does not list `.kiro`.

---

## Order and dependencies
Tasks 1 to 7 build the Brain and its rules. Tasks 8 and 9 build the pipeline shell. Task 10 adds the sample data. Tasks 11 to 14 add the agents in run order. Tasks 15 to 17 join everything, show it, and check it.

## Asking before large steps
Ask the owner before starting any task that grows beyond what is written here, or that needs an install.
