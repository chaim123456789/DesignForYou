# Design: Design team

Status: approved by the owner on 2026-11-25 (the real paid AI call stays a later decision; the home page, portfolio, item picker and library are separate later specs). Covers R1 to R12 in `requirements.md`. No app code is written in this step, and nothing is installed. Plain JavaScript, no framework, no new dependencies, as in the four earlier specs (project-brain, room-viewer, intake, place-items).

## 1. What gets built, in one picture

```
 user input (rooms, sizes, notes, placed objects)       knowledge files (src/knowledge/<agent>/)
            |                                                     |
            v                                                     v
 Project Brain  <---- gatekeeper (the one door) <---- Coordinator (steps through the agents)
            ^                                                     |
            |  accepted change + basis + "user approved"          v
            |                                   Walls -> Doors and windows -> Floors and ceilings
            |                                   -> Lighting and electrical -> Furniture -> Decor
            |                                   -> Style -> Reviewer
            |                                      each agent returns PROPOSALS (never writes)
            |                                      the user answers them before the next agent runs
            |
            +-- ripple: an accepted change marks later items stale -> only their agents re-check

 AI gate (cap, two allowed tasks, off by default) is used only by Style (taste) and photo reading.
```

## 2. The agents

Order, owner and needs. "Reads" means items of earlier agents. An agent also needs the user's input (rooms, sizes, notes), which is not an agent.

| # | Agent | Folder | Owns (item kinds) | Needs from earlier agents |
|---|---|---|---|---|
| 1 | Walls | `src/agents/walls/` | `wall`: each wall segment of a room: which room, which side, length, thickness, height. Proposes wall position and length from the room size. | Nothing. Works from the user's room sizes or plan. |
| 2 | Doors and windows | `src/agents/doors-windows/` | `door`, `window`: position along a wall, width, height, swing side. | Walls: wall id, length, thickness, which side faces which room. |
| 3 | Floors and ceilings | `src/agents/floors-ceilings/` | `floor`, `ceiling`: surface type per room, level changes, ceiling height and type. | Walls: room outline and height. Doors: where thresholds are, so floor changes land at a door. |
| 4 | Lighting and electrical | `src/agents/lighting-electrical/` | `light`, `electrical`: fixtures, switches, sockets and their positions. | Walls: free wall length. Doors and windows: switch beside the door, daylight from windows. Ceilings: height and mount type. |
| 5 | Furniture | `src/agents/furniture/` | `layout` (existing kind name kept): position, size and turn of each piece. | Walls and doors/windows: free wall length, door swing space, window sills. Floors: wet rooms. Lighting: sockets and switches that must stay reachable. |
| 6 | Decor | `src/agents/decor/` | `decor`: rugs, art, curtains, plants, small objects, with positions or wall heights. | Walls: art space. Windows: curtains. Lighting: where light falls. Furniture: surfaces and the space left. |
| 7 | Style | `src/agents/style/` | `style`: materials, colours, finishes and mood, as notes attached to other items. It never owns geometry. | Everything above, read only: it needs to know what exists in a room to pick a palette that fits. |
| 8 | Reviewer | `src/agents/reviewer/` | `clash`: the report. | Everything. Reads all, changes only its report. |

Rules that keep ownership clean:
- A style choice for a floor is a `style` item that points at the floor item. The floor's geometry stays with Floors and ceilings. So Style and Floors never write the same item.
- An item id starts with its agent's prefix (`wall-`, `door-`, and so on), so any log line shows the owner at a glance.

### 2.1 What each agent does by rule (examples, not the full list)

- **Walls:** checks each room is at least a minimum size for its type, wall thickness from a default table, shared walls between neighbouring rooms are one wall, not two. Low confidence when a room has no entered size (it uses the 4 by 4 m default as today): shows two options, "use the default size" or "enter the size".
- **Doors and windows:** a door must fit on its wall with space either side, not hit a corner, and open into the room, not into another door's swing. Windows aim for daylight in living rooms and bedrooms, bathrooms may be small or frosted.
- **Floors and ceilings:** wet rooms get a wet-safe surface, a threshold sits under a door, ceiling height is checked against a minimum and against lights that hang.
- **Lighting and electrical:** each room type has a target light level by use and a rule for sockets per wall length; every room has a switch by its door; sockets stay clear of a bath or sink zone.
- **Furniture:** clear walking space around beds, tables and sofas, a door's swing area kept free, a bed head on a solid wall rather than under a window, wardrobe doors able to open.
- **Decor:** hanging height for art, rug size related to the seating group, curtains related to the window width.
- **Style:** colours and materials from named style families, the conflict pairs (cold steel against warm oak), and the room's effective inspiration as today. Taste judgement between two close options may use the AI gate (section 9).
- **Reviewer:** the four existing checks plus checks read from `src/knowledge/reviewer/` (section 5).

## 3. How agents coordinate without clashes

1. **One owner per item.** Unchanged from the Project Brain spec. The gatekeeper refuses a write from anyone but the owner.
2. **One door for writes.** Agents get a frozen, read-only view of the Brain. They return proposals. Only the Coordinator talks to the gatekeeper, and only after the user answers.
3. **A fixed order and one pass.** Each agent runs once per pass. An agent reads only earlier agents' items (section 2), so there is no way for two agents to wait on each other. There is no loop.
4. **No sideways edits.** A later agent that needs an earlier item changed makes a *request* (section 4.3). The request is shown to the user. If accepted, it is applied by the owner agent, not by the requester.
5. **Locked still wins.** The gatekeeper checks Locked first, then owner, as today.
6. **Separate files.** Each agent has its own `agent.js`, `agent.json` and knowledge folder. Shared reference files (room types, units) are read-only for every agent and change only by a reviewed edit.
7. **Frozen proposals.** A proposal is plain data (below). It is checked when it arrives (item exists, owner matches, 1 to 4 options, "Custom" last) and rejected with a clear message if malformed.

## 4. Data shapes (plain language)

### 4.1 Proposal
`{ id, agent, itemId, why, source, ruleId, confidence, options, request? }`
- `source`: `rule` or `ai`. `ruleId`: the rule that produced it, or the AI task name.
- `confidence`: `high` or `low`.
- `options`: a list of `{ id, label, newValue }`. High confidence: a recommended option, optionally more, then "Custom". Low confidence: exactly two options, then "Custom". Never more than 4 in total. "Custom" has no `newValue`; the user types one and the agent's own checker validates it.
- `request`: present only when the proposal asks for an earlier agent's item to change. It names that item and its owner.

### 4.2 Basis and stale
- Each item gets an optional `basis`: a list of `{ itemId, version }`, the earlier items it was worked out from and the version of each at that time.
- The Brain keeps a `basis` record per item, outside the version list, so past versions are never edited (R8 of the Project Brain spec). Refreshing a basis when a re-check says "still fine" adds a run-log line, not a version.
- `findStale(project)` returns items whose basis names an item with a later version. It follows chains: if a wall changes, the door is stale, so what was based on the door is stale too.

### 4.3 Requests
A request is a proposal with `request` set and the `itemId` of the *earlier* item. Example: Furniture sees that a 2.2 m sofa does not fit on the 2.0 m wall. It raises "Move the north wall 20 cm?" with two options (move the wall, or pick a 1.8 m sofa) plus "Custom". If the user picks the wall, the Walls agent applies it. The ripple (section 6) then starts from Walls.

### 4.4 Agent registry
One file, `src/agents/registry.json`, holds the order and the direct dependencies:

```
Walls: []
Doors and windows: [Walls]
Floors and ceilings: [Walls, Doors and windows]
Lighting and electrical: [Walls, Doors and windows, Floors and ceilings]
Furniture: [Walls, Doors and windows, Floors and ceilings, Lighting and electrical]
Decor: [Walls, Doors and windows, Lighting and electrical, Furniture]
Style: [every agent above]
Reviewer: [every agent above, plus Style]
```

A test checks the registry is in dependency order (nobody depends on a later agent), and that the code has no other copy of the order. The existing `AGENT_ORDER` constant is replaced by a read of this file.

## 5. Knowledge files

### 5.1 Where they live
```
src/knowledge/
  README.md                      the "own words, open sources only" rule, in plain language
  allowed-licences.json          the licences that may be listed (R6.2)
  shared/                        read-only for every agent: room types, units, wet-room list
  walls/             room-minimum-sizes.json, wall-thickness.json
  doors-windows/     door-sizes.json, swing-clearance.json, window-daylight.json
  floors-ceilings/   floor-surfaces-by-room.json, ceiling-heights.json, thresholds.json
  lighting-electrical/ light-levels.json, socket-spacing.json, switch-placement.json, wet-zones.json
  furniture/         furniture-sizes.json, clearances.json, layout-patterns.json
  decor/             hanging-heights.json, rug-sizes.json, curtains.json
  style/              style-families.json, palettes.json, conflict-pairs.json
  reviewer/          checks.json, severities.json
```
The file names above are the plan. Each is written in its own task, and the owner sees its sources first.

### 5.2 Shape of one file
```
{
  "provenance": {
    "title": "...", "covers": "...", "writtenBy": "own words", "date": "...",
    "sources": [ { "name": "...", "url": "...", "licence": "CC0" } ]
  },
  "rules": [
    { "id": "walls-min-bedroom", "when": { ... }, "then": { ... },
      "note": "Typical guideline, check local rules." }
  ]
}
```
Rules are data (conditions and results), not code, and the agent code is a small loop that reads them. That keeps the rules readable by a non-coder and keeps agents small. A text field has a maximum length (R6.4).

### 5.3 How the browser gets them
`npm run export-engine` already copies engine files from `src/` to `docs/engine/` byte for byte. Knowledge data files are copied the same way, byte for byte, but to `docs/knowledge/` (changed in Task A3: an existing test says `docs/engine/` holds only the 12 listed code files, and that test may not be edited). Its file list (`src/viewer/engine-files.js`) is extended to include the new agents and `src/knowledge/`. The existing byte-for-byte test then covers them. The page loads the knowledge files from its own address, as it does `sample-run.json`, so the content security rule needs no new address.

### 5.4 Checks
- A test reads every file and enforces R6.4 (provenance, sources, allowed licence, length limit).
- A test fails if an agent file contains a number that looks like a rule value and is not read from a knowledge file. This is a simple scan for numeric literals in a short allowed list. If it proves too noisy it is dropped and replaced by review, and the task says so.
- The owner reads each file's source list before merge. Marked "pending owner check" until done (R6.6).

## 6. How a change ripples

1. The user (or an accepted proposal) changes item X owned by agent K. The gatekeeper writes version N and records which items X was based on.
2. `findStale` marks every item whose basis includes X, then items based on those, and so on. Only agents later than K can own stale items.
3. The Coordinator starts a **re-check pass** at the earliest agent that owns a stale item and walks forward in order. For each agent it asks only about its stale items. Agents with nothing stale are logged "Not affected: nothing it depends on changed."
4. For each stale item the agent says "still fine" (basis refreshed, run-log line) or returns a proposal. Proposals go to the user as in section 3.
5. If the user answers a re-check proposal with a change, that is a new accepted change, and the pass continues from there. Because each agent runs once per pass and only forward, the pass ends. If a later accepted change makes an *earlier* agent's item stale (which cannot happen by rule, since no one reads later agents), it is a bug and the Coordinator stops with a message.

What re-checks after each kind of change (follows from the registry):

| Changed | Re-checked, in order |
|---|---|
| A wall (move, length, height) | Doors and windows on it, Floors and ceilings, Lighting and electrical, Furniture, Decor, Style, Reviewer |
| A door or window | Floors and ceilings (threshold), Lighting and electrical (switch, daylight), Furniture (swing), Decor (curtains), Style, Reviewer |
| A floor or ceiling | Lighting and electrical (mount), Style, Reviewer. Furniture only if a wet-room rule applies. |
| A light or socket | Furniture (reach), Decor, Style, Reviewer |
| A piece of furniture | Decor (rug, art), Style, Reviewer |
| A piece of decor | Style, Reviewer |
| A style note | Reviewer |

The item-level basis narrows this: only the items that really used the changed one are stale, so a moved wall in the kitchen does not re-check the bedroom's sofa.

Locked items are never changed. A stale Locked item gets "needs your look" and shows in the Reviewer's report.

## 7. Asking the user: the run as steps

Today `runPipeline` runs all four agents in one call. The new Coordinator runs as a small state machine that stays synchronous and testable:

- `createRun(project, options)` returns a run.
- `run.next()` runs the next enabled agent and returns its pending proposals (possibly none).
- `run.answer(proposalId, choice)` where choice is an option id, "custom" with a value, or "skip". It applies the change through the gatekeeper and then runs the ripple check.
- `run.done()` is true after the Reviewer has run and its report is accepted.
- `runWithScript(project, policy)` answers every proposal from a fixed policy ("first option" by default). Used by the sample and by tests. Output lines say "scripted answer".

The existing `runPipeline` stays for the existing sample until the swap (section 10).

## 8. The Reviewer

Kept: the four existing checks. Added: checks listed in `src/knowledge/reviewer/checks.json`, each with an id, the kinds it compares, a plain sentence and a severity. Added reports: stale items, items kept as is, Locked items needing a look. Each line carries a Rule-based or AI tag. The report is still one Reviewer-owned item, written through the gatekeeper, so it appears in version history. It still runs last and cannot be switched off.

## 9. The AI gate

Files: `src/ai/gate.js`, `src/ai/budget.json`, `src/ai/stand-in.js`. No network code, no key.

- **Tasks allowed:** `read-photo` and `judge-taste`. Anything else is refused.
- **Cap:** `budget.json` holds `capUsd` (default 0, meaning off), a per-call estimate for each task (placeholders until real prices are checked), and the amount spent so far. The gate refuses a call whose estimate would pass the cap, and shows spent and remaining.
- **Provider is injected.** The gate takes a function that does the real call. In this spec it is the stand-in that returns a fixed answer, labelled "stand-in, not a real model".
- **Output is data.** A model's reply is checked against the style vocabulary in `src/knowledge/style/` (tags only from that list, text cut to a length). It is never run and never trusted as an instruction.
- **Fallback.** Cap reached, AI off or call failed: the agent uses its rules and the proposal's source is `rule`, with a line "AI was not used: ...".
- **Honest limit.** The browser page cannot enforce a cap that a visitor could bypass, and cannot hold a key. `tech.md` says any key stays server-side. A real call therefore needs a small server-side function and its own spec and approval. Nothing here chooses one (owner decision 1 in `requirements.md`: decided later).

## 10. What existing code is kept and what is replaced

Existing numbers: 648 tests pass today on `main`. The sample files (`src/sample/sample-project.json`, `docs/sample-run.json`) are not touched by this spec until the owner approves the swap in the last task. A trial in Session 30 showed that changing the sample breaks about a dozen "sample is unchanged" tests on purpose, so the swap is its own step. Until then the new team is built and tested beside the old four-agent pipeline.

### 10.1 project-brain spec

| Part | Verdict |
|---|---|
| `src/brain/brain.js` (project, floors, rooms, items, versions, `getBrainAtVersion`) | **Kept.** Additive edits: `KIND_OWNER` and `OWNERS` get the new kinds and the eight agent names; optional `basis`, `source`, `approvedBy` fields. Old kinds and old data stay valid. |
| `src/brain/gatekeeper.js` (Locked first, then owner, versions, refusals logged) | **Kept, rules unchanged.** Additive: accepts `basis` and `approvedBy` and writes them to the record. The `lock-guard` agent is run again after this task. |
| `src/brain/inspiration.js` (overall set, room override) | **Kept.** |
| `src/coordinator.js` (`runPipeline`, read-only view, run log) | **Kept** for the existing sample. **New** run-as-steps Coordinator added beside it (section 7), reusing `makeReadOnlyView` and the run-log format. |
| `src/agents/config.js` (`AGENT_ORDER` of 4 names) | **Replaced** in the new path: order and dependencies come from `registry.json`. The old constant stays only for the old pipeline until the swap. |
| `src/agents/style/agent.js` | **Kept in part.** Its rule that adds notes to Unsure style items moves into the new Style agent, which runs 7th. The deliberate Locked-item attempt in the sample version stays for the old sample. |
| `src/agents/layout/agent.js` ("placement checked" only) | **Replaced** by Furniture (real clearance rules). Kept only for the old sample until the swap. |
| `src/agents/builder/agent.js` (door and window marking only) | **Replaced** by Doors and windows. Kept only for the old sample until the swap. |
| `src/agents/reviewer/agent.js` | **Kept and extended** (section 8). The four existing check functions are not edited. |
| `src/label.js` | **Kept.** Adds the Rule-based / AI tag helper. |
| `src/summary/make-summary.js` | **Kept.** Adds the new kinds in plain words and the agent steps. |
| `src/sample/*`, `sample-summary.html` | **Kept as is** until the swap task. |

### 10.2 room-viewer spec

| Part | Verdict |
|---|---|
| `docs/index.html`, `docs/viewer.js`, `docs/scene-data.js`, `docs/styles.css`, `docs/vendor/` (Three.js r186) | **Kept.** Additive: new item kinds drawn as simple shapes (a light is a small marker, a wall is the room edge as today); a panel listing the eight agents. No new library. |
| `src/viewer/make-run-data.js`, `export-sample-run.js`, `engine-files.js` | **Kept.** `make-run-data` copies the new fields (source, proposals, stale flags). `engine-files.js` lists the new files. |
| `src/viewer/viewer-layout.json` (fixed room sizes and heights for the sample) | **Kept** for the sample. |
| The slider and version history | **Kept.** |

### 10.3 intake spec

| Part | Verdict |
|---|---|
| Screens: Setup, Inspiration, Room overrides, Brief, Taste, Items, Review and run, Result | **Kept.** |
| `docs/intake/build-brain.js` | **Kept and extended:** builds items for the new kinds when the user entered them; builds no agent items itself, the agents propose those. |
| `docs/intake/report.js` and the fixed sentence "The design team is a set of fixed rules, not AI. It does not look at your images or read your brief." | **Replaced** by the honesty text of R8 (it names both rule-based and AI parts, and says AI is off). The old sentence is true only while AI is off, so it stays while the cap is zero. |
| Items screen with Locked / Unsure | **Kept**, status stays optional (R9). Moving the picker to the categorised drop-down list is a later spec. |
| Review and run screen | **Changed:** it steps through agents and shows proposals (Group D). |
| `limits.js` conflict pairs | **Replaced** by `src/knowledge/style/conflict-pairs.json`. |

### 10.4 place-items spec

| Part | Verdict |
|---|---|
| Place screen, plan, geometry, `place-*.js` | **Kept.** Placed objects are the user's input: Furniture treats them as the starting positions, which it checks and may propose to change. |
| Reviewer's furniture-overlap and outside-room checks and room `width`/`depth` | **Kept.** |
| Shapes in the viewer (sofa, bed, door frames) | **Kept.** |
| The `layout` item kind | **Kept** as the Furniture kind. |

### 10.5 Tests
All existing tests stay and must pass after every task. None is deleted or weakened. Tests for the old four-agent pipeline are kept until the swap task, and are changed only there, in a listed way.

## 11. Hooks and custom agents already in the repo

- Hook "keep engine in sync": still right. It runs after a write under `src/`, so new agent and knowledge files are copied and checked.
- Hook "no secrets before you stop": still right. It covers the AI gate files.
- Custom agents `lock-guard` and `submission-checker`: `lock-guard` is re-run after the gatekeeper task and after the last task.

## 12. Risks

- **Size.** Eight agents plus knowledge files is a lot. Mitigation: agents are small loops over data, and the groups in `tasks.md` each end in a working, tested state.
- **Knowledge quality.** Rules are only as good as their sources. Mitigation: every rule is a "typical guideline", every file lists sources, the owner reads the sources, and the Reviewer never says "approved".
- **Scripted answers look like a user.** Mitigation: every scripted answer is labelled.
- **Real browser not tried.** Earlier sessions could not open the page in a real browser. Visual results stay "pending owner check".
