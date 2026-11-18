# Design: Project Brain and Sample-mode Pipeline

Covers requirements R1 to R10 in `requirements.md`. No app code is written in this step.

## 1. Recommendation (needs owner approval)

**Use plain JavaScript with no framework and no installed packages.**

Reasons:
- Nothing to install. Node.js 22 is already in the workspace, and it can run the code and the tests by itself (its built-in test runner).
- This spec has no screens beyond one readable summary page, so a framework adds work and no benefit.
- Fewer moving parts means fewer things that can break for a non-coder.
- It does not block later choices. The 3D viewer spec can add a browser build tool and Three.js when it needs them.

What this means in practice:
- Code in plain `.js` files using ES modules.
- Data and agent settings in `.json` files.
- Tests with Node's built-in `node --test`.
- The summary (R10) is one generated HTML file, opened in the browser. It needs no server.

Alternatives considered:
- **TypeScript:** catches mistakes earlier but needs a compiler install and more setup. Not worth it for a first step.
- **A web framework such as React:** useful once there are real screens. Premature here.

**Nothing is installed or added as a dependency without your explicit yes.** With this recommendation, nothing needs installing at all.

## 2. Folder layout

```
src/
  brain/
    brain.js          the Project Brain: holds project, items, versions
    gatekeeper.js     the only way to change an item (enforces R4, R5)
    inspiration.js    effective inspiration for a room (R2)
  agents/
    style/   agent.json  agent.js
    layout/  agent.json  agent.js
    builder/ agent.json  agent.js
    reviewer/agent.json  agent.js
  coordinator.js      runs the agents in fixed order (R6)
  sample/
    sample-project.json   the pre-run example (R7)
  summary/
    make-summary.js   builds the readable HTML page (R10)
test/                 one test file per area
```

Each agent has its own folder. No two agents share a file (matches the working rules).

## 3. Data shapes (plain language)

- **Project:** name, floors, overall inspiration set, `isSample` flag.
- **Floor:** name, order, rooms.
- **Room:** name, order, optional override inspiration set.
- **Inspiration set:** a list of named references, such as "warm oak".
- **Item:** id, kind (style, layout, door, window, clash), room (optional), value, status (`Locked` or `Unsure`, default `Unsure`), owner (`Style`, `Layout`, `Builder` or `Reviewer`).
- **Version:** number, time, who (agent name or `user`), item id, old value, new value.
- **Run log entry:** agent, event (started, finished, skipped, failed, refused), item (if any), reason.
- **Agent config (`agent.json`):** name, `enabled` true or false. The Reviewer's setting is ignored and it always runs (R6.7).

Validation happens when data is loaded and when items are created. Bad input gets a clear message (R1.4, R3.4, R4.3).

## 4. How the rules are enforced

**One door for all changes.** Every change goes through `gatekeeper.changeItem(who, itemId, newValue)`. Agents get no direct write access to the Brain. The gatekeeper checks, in this order:
1. Is the item Locked? If so, refuse (R5.1). This applies even to the owner.
2. Is `who` the item's owner? If not, refuse (R4.4). Users are the exception, for status changes only (R3.5).
3. Otherwise accept, write a new version (R8.1, R8.2).

Refusals go to the run log and create no version (R8.4).

**Versions are append-only.** The list can only grow. Reading "the Brain at version N" replays versions 1 to N over the starting state, and does not touch the current Brain (R8.5, R8.6).

**Effective inspiration.** `inspiration.js` returns the room's override if present, else the project's set (R2.3). Removing an override is just clearing that field (R2.5).

## 5. Coordinator

1. Read each agent's `agent.json`.
2. Run Style, Layout, Builder, Reviewer in that order, one at a time (R6.1, R6.2).
3. Each agent receives a read-only view of the Brain and returns proposed changes. The Coordinator sends each proposal to the gatekeeper. This keeps agents from writing anywhere else (R6.3).
4. Write start, finish, skipped and refused lines to the run log (R6.4, R6.6).
5. If an agent throws an error, stop, log which agent and why, and run no later agent. Earlier accepted changes stay (R6.5).

## 6. Sample mode

- `sample-project.json` describes: 2 floors, 4 rooms (kitchen, living room, bedroom, bathroom), overall inspiration, a bedroom override, at least 2 Locked and 3 Unsure items (R7.1 to R7.3).
- The sample is loaded into a normal Project Brain and passed to the same Coordinator. There is no sample-only shortcut (R7.4).
- Agents in Sample mode are fixed, rule-based steps with no AI and no randomness. The start state is fixed and the clock is set by the Coordinator, so two runs give the same result (R7.7).
- Sample data is written so that at least one door-on-furniture clash and one override-versus-Locked-item clash exist (R9.4). At least one agent proposal also targets a Locked item, so the refusal can be seen in the run log.
- Every output carries "SAMPLE PROJECT" and the draft-for-professional-review statement. One shared label function is used everywhere, so none is missed (R7.5, R9.7).

## 7. Reviewer

Runs last and only reads. Two checks (R9.3):
- **Door or window on furniture:** a Builder item whose position overlaps a Layout furniture item in the same room.
- **Override against Locked item:** a room's override inspiration that conflicts with a Locked style item in that room. "Conflicts" in the sample means the override names a style tag listed as the opposite of the Locked item's tag, using a small conflict list in the sample data.

Each clash records the two items, room, plain description and severity (R9.2). The report is saved as a Reviewer-owned item, so it goes through the gatekeeper and into version history (R9.8). With no clashes it says "No clashes found" (R9.5).

## 8. Summary page

`make-summary.js` writes one HTML file showing: structure, items with status and owner, run log, clash report, version list, and the labels (R10.1). Field names are turned into plain words (R10.2). Nothing is sent over a network.

## 9. Safety and repo rules

- Every output says plans are drafts for professional review, not verified engineering.
- No secrets, keys or personal data anywhere. There are no AI keys in this spec.
- `.kiro` is not in `.gitignore`, and `LICENSE` is unchanged.

## 10. How the design will be checked

| Requirement | Check |
|---|---|
| R1, R2, R3 | Tests on structure, inspiration lookup, status defaults and bad input |
| R4, R5 | Tests that wrong-owner and Locked changes are refused and the value is unchanged; a full sample run leaves all Locked items identical |
| R6 | Test the run log shows the fixed order; test a failing agent stops the run; test an agent set to off is skipped |
| R7 | Test the labels are present; test two runs give identical results |
| R8 | Test version numbers rise by 1; test viewing an old version leaves the current Brain unchanged |
| R9 | Test the sample report has both clash types; test the "No clashes found" case |
| R10 | Open the generated page and read it |

## Open question for the owner

Approve the plain JavaScript, no-framework, no-install recommendation in section 1, or tell me what to change.
