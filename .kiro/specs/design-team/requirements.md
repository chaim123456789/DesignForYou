# Requirements: Design team

Status: approved by the owner on 2026-11-25, with the two decisions listed under "Owner decisions" below. Group A is built first.

## Problem in plain words
Today four agents (Style, Layout, Builder, Reviewer) run in a fixed order. Layout and Builder only check and mark; they choose and move nothing. The product vision (`.kiro/steering/vision.md`) asks for a real design team: eight specialists that work in dependency order, ask the user to confirm, suggest options, and re-check each other's work when something earlier changes. This spec defines that team.

## Scope
The agents, how they depend on each other, how a change ripples, how they ask the user, where their knowledge files live, how AI is gated, and how the screen tells rule-based from AI. Browser only, no login, nothing stored. Plain JavaScript, no framework, no installs, as in the earlier specs.

## Out of scope (separate specs later)
- Home page, portfolio and project pages, dark and light mode, the high-end look.
- Floor plan upload and the "start from zero" templates.
- The categorised item picker, the 3D model made from a chosen option, and the library.
- Calling a real paid AI model. This spec builds only the gate (cap, allowed tasks, off by default) and a stand-in.
- The SketchUp and Revit connections (MCP, Kiro desktop app).

## Words used
- **Agent**: one specialist with its own folder, its own items and its own knowledge files.
- **Item**: one record in the Project Brain, as in the earlier specs.
- **Owner**: the one agent allowed to change an item.
- **Depends on**: agent B depends on agent A when B reads A's items to do its work. A is "earlier", B is "later".
- **Basis**: the list of earlier items, each with the version number, that an item was worked out from.
- **Stale**: an item whose basis contains an earlier item that has since changed.
- **Re-check**: a later agent looks again at its stale items and either confirms them or proposes a change.
- **Proposal**: a suggested change from an agent. It changes nothing until the user answers.
- **Option**: one choice inside a proposal. "Custom" is always one of them.
- **Knowledge file**: a data file of fixed rules and facts that an agent reads.
- **Rule-based / AI**: where a result came from. Rule-based means fixed rules and knowledge files. AI means a paid model.

## Requirements

### R1. Eight agents in a fixed dependency order
**As a user, I want specialists that work in the order a real build goes, so later work fits earlier work.**

Acceptance criteria:
1. The agents are, in this order: Walls, Doors and windows, Floors and ceilings, Lighting and electrical, Furniture, Decor, Style, Reviewer.
2. The Coordinator runs them in that order, each at most once per pass, and an agent never starts before the previous one has finished and its proposals have been answered (R4).
3. An agent reads items of earlier agents and its own. It never reads a later agent's items to do its work. (The Reviewer is the one exception: it reads everything and changes nothing.)
4. Each agent has a small config file with an on/off setting. An agent that is off is skipped, the run log says so, and its dependents say which earlier agent is missing. The Reviewer cannot be turned off.
5. If an agent fails, the Coordinator stops, reports which agent and why, and keeps the earlier accepted changes (as today).
6. The order and the "depends on" list are written in one data file, not spread through the code.

### R2. One owner per item
**As a user, I want every item to have one owner, so agents never edit the same thing.**

Acceptance criteria:
1. Every item has exactly one owner among the eight agents. Creating an item with no owner, two owners or an unknown owner is rejected.
2. Ownership is by kind: wall (Walls); door, window (Doors and windows); floor, ceiling (Floors and ceilings); light, electrical (Lighting and electrical); layout (Furniture; the old kind name is kept so existing projects still work); decor (Decor); style (Style); clash (Reviewer).
3. An agent that tries to change an item it does not own is refused, and the refusal is written in the run log, as today.
4. Each agent has its own folder, its own config and its own knowledge folder. No two agents edit the same file.
5. A later agent that wants an earlier agent's item to change (for example Furniture wants a wall moved) cannot do it. It raises a request to the user instead (R3.6).

### R3. A change ripples to everything that depends on it
**As a user, I want a change to earlier work to make the later work re-checked, so nothing stays out of date.**

Acceptance criteria:
1. Every item records its basis: which earlier items (with version numbers) it was worked out from.
2. When an accepted change touches an item, every later item whose basis contains it, directly or through other items, becomes stale.
3. The Coordinator then re-runs only the agents that own stale items, in the normal order, and says in the run log which agents were re-checked and which were not affected, with the reason.
4. A re-check has two outcomes for each stale item: "still fine" (the basis is refreshed and the item is unchanged) or a proposal for a change (R4).
5. A re-check never changes anything by itself, and never changes a Locked item. A stale Locked item is flagged "needs your look" and reported by the Reviewer.
6. A later agent can ask for a change to an earlier item only as a request shown to the user, such as "A sofa does not fit. Move the north wall 20 cm?". If the user agrees, the request is applied through the owner agent, and the ripple (R3.2) starts from there.
7. A ripple pass runs each agent at most once, in order, so it can never loop.
8. Example that must work: moving a wall makes the doors and windows on that wall, the floor and ceiling of both rooms, the lights, the furniture, the decor and the style notes in those rooms stale, and the Reviewer re-checks them. Changing one piece of decor makes only Style and the Reviewer re-check.
9. A stale item that the user leaves unanswered stays visibly stale. The Reviewer reports it.

### R4. Agents ask, suggest and show two options when unsure
**As a user, I want to confirm every change and see my choices, so the agents never surprise me.**

Acceptance criteria:
1. An agent changes nothing by itself. It returns proposals, and a proposal applies only after the user answers it.
2. Each proposal has: the agent, the item, a plain sentence of why, between 1 and 4 options, a confidence (high or low), and where it came from (rule-based or AI).
3. The last option of every proposal is "Custom", where the user types their own value.
4. When confidence is low, the proposal shows exactly two real options plus "Custom". When confidence is high, it shows one recommended option plus "Custom", and may show more.
5. The user can accept an option, choose Custom, or skip. Skip leaves the item as it is and marks it "kept as is".
6. The run stops after each agent until its proposals are answered. The next agent works from the confirmed state.
7. An accepted proposal is applied through the same single door as today (the gatekeeper), under the agent's own name, and the version record says the user approved it.
8. In the sample and in tests, a fixed scripted answer stands in for the user, and the screen says so ("scripted answer").

### R5. Rules first, with knowledge files
**As a user, I want results from fixed rules wherever possible, so they are repeatable and explainable.**

Acceptance criteria:
1. Every agent works from fixed rules and its own knowledge files. Running the same project twice gives the same result.
2. A rule's result names the rule that produced it, so the user can see why.
3. Knowledge files live in one folder per agent (see `design.md` section 5), are plain data files, and are copied to the browser page by the existing export step.
4. Agents have no randomness and no clock of their own. The Coordinator supplies the time, as today.
5. An agent that has no rule for a case says so and offers options. It does not guess.

### R6. Knowledge files are our own words from open sources
**As the owner, I want the repo to be safe to publish, so no copied or paid material is in it.**

Acceptance criteria:
1. Every knowledge file starts with a provenance block: a title, what it covers, the open sources it was written from (name and web address), the licence of each source, who wrote it ("own words"), and a date.
2. Only open sources are allowed: public-domain works, government publications, and sources under CC0, CC BY or an open government licence. Share-alike and non-commercial licences, paid courses, books, videos and member-only material are not used.
3. Rules are short statements in our own words, with a number and a unit, and a note "typical guideline, check local rules".
4. A test fails if a knowledge file has no provenance block, lists no source, lists a licence outside the allowed list, or contains a single text field longer than a set limit (to stop pasted passages).
5. The knowledge folder has a short plain-language README that states the "own words, open sources only" rule.
6. The owner reads the list of sources of each new knowledge file before it is merged. A test cannot tell whether text was copied, so this is a person's check and is marked "pending owner check" until done.

### R7. Paid AI only for photos and taste, with a spending cap
**As the owner, I want AI cost to be limited and visible, so there are no surprises.**

Acceptance criteria:
1. AI is reachable through one gate only. No agent calls a model directly.
2. The gate allows exactly two kinds of task: understanding a photo, and judging taste. Any other request is refused with a message.
3. The gate has a spending cap. Before a call it checks the estimated cost against what is left, and refuses the call if it would go over. The spent and remaining amounts are shown.
4. The cap defaults to zero, so AI is off until the owner sets it. With AI off, every agent still works from rules only, and the screen says AI was not used.
5. This spec builds the gate and a stand-in that returns a fixed answer. No real model is called, no key is needed, and no key is in the repo.
6. The gate says "the cap in this page is a guard for the demo; a cap that cannot be bypassed needs a server". The real model call and the server are a later, separate decision (see `design.md` section 9).
7. If a call is refused or fails, the agent falls back to its rule-based result and the screen says so.

### R8. Honesty on screen
**As a user, I want to see what is rule-based and what is AI.**

Acceptance criteria:
1. Every proposal, every result line and every report line shows one of two tags: "Rule-based" or "AI".
2. The result page has one fixed sentence that says which parts of the design team are fixed rules and which parts can use AI, and says AI is off when it is off.
3. A result that came from AI says which task it was (photo or taste) and shows the cost used.
4. The existing "SAMPLE PROJECT" / "YOUR PROJECT" label and the draft-for-professional-review statement stay on every output.
5. Nothing is described as "understanding" or "noticing" unless a real AI call was made.

### R9. Locked and Unsure are a minor optional tag
**As the owner, I want status to stay out of the way.**

Acceptance criteria:
1. An item may carry a status tag, Locked or Unsure. If none is given it defaults to Unsure, as today.
2. A Locked item is still never changed by any agent. The gatekeeper rule is not weakened.
3. No agent's behaviour depends on Unsure. No screen in this spec asks for a status.
4. The tag appears in lists as a small label and nowhere as a main feature.

### R10. The Reviewer
**As a user, I want a last check across everything.**

Acceptance criteria:
1. The Reviewer runs last, reads every item, and changes only its own report item.
2. It keeps the existing clash checks: door or window on furniture, override against a Locked item, furniture overlapping furniture, object outside its room.
3. It adds checks from its knowledge files, such as a door that opens into furniture, a light with no switch, and a room with no window light.
4. It reports stale items (R3.9), items kept as is (R4.5), and Locked items flagged "needs your look" (R3.5).
5. Each report line has the two items, the room, a plain sentence, a severity, and a Rule-based or AI tag.
6. With no findings it says "No clashes found, using these checks: ..." and lists the checks.

### R11. Repeatable, recorded and shown in the browser
**As a judge, I want to open the page and see the team work.**

Acceptance criteria:
1. Every accepted change creates a numbered version, as today, and the version records the agent, the user's approval and the basis.
2. Running the same input with the same scripted answers twice gives the same result.
3. The browser viewer shows, for the run: the eight agents in order, what each did, which were re-checked and why, the proposals and the answers, and the Rule-based or AI tags.
4. The existing sample, its saved run file and all existing tests keep passing until the owner approves the swap to a new sample (see `design.md` section 10).

### R12. Safe to publish
Acceptance criteria:
1. No secrets, keys or personal data in any file, log or test.
2. `.kiro` is not in `.gitignore`. `LICENSE` is unchanged.
3. No installs and no new dependencies. `package.json` changes only to add scripts, and only with the owner's yes.
4. Every output says plans are drafts for professional review and are not verified engineering.

## Owner decisions (2026-11-25)
1. The paid AI call is decided later. This spec builds only the gate, the cap (default zero) and the stand-in. No real model, no server and no key are chosen or built here.
2. The home page, portfolio, item picker and library are separate later specs. This spec builds only the team.
