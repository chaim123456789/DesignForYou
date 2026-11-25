# Acceptance checklist: Design team

Written on 2026-11-25 (Task D6), branch `build-team-4`. `node --test` result at that point: 948 tests, 948 passed, 0 failed (883 at the start of Group D).

Key (the same as the other checklists):
- **Passed**: a named automated test proves it. Test names are in backticks and are the exact names in `test/`. `node test-helpers/check-checklist.js .kiro/specs/design-team/acceptance-checklist.md` matches every quoted name against the test files (the checker was extended, additively, to read names that start with "design-team" and "D1" to "D6").
- **Unverified: pending owner check**: only a person can judge it (a real browser, a real keyboard or screen reader, or reading a source). It is never counted as Passed.
- A row can have both.

What the tests cannot see: they run the real page scripts on a stand-in page (`test-helpers/fake-page.js`) with a renderer that draws nothing. They cannot show how anything looks, the 320 px layout, a real keyboard focus ring, a screen reader, WebGL, or a real click. The browser was not tried in this build.

## R1. Eight agents in a fixed dependency order
| # | Status | Proof |
|---|---|---|
| 1.1 | Passed | `design-team A1: the registry order is the eight names in the vision order`; `design-team C5: the run log shows all eight agents, started in the registry order, and both runs finish`; `D6 / R11.4: the sample runs through the eight agents in order, with scripted answers, and finishes` |
| 1.2 | Passed | `design-team A6: the agents run in the registry order, each once, with no agents given (stand-ins)`; `design-team A6: the next agent does not start until the proposals are answered` |
| 1.3 | Passed | `design-team B2: a door that fits on its wall, clear of corners, gets no proposal` (with the "never reads a later agent" tests of B2, B3, B4, C1, C2) |
| 1.4 | Passed | `design-team A6: an agent that is switched off is skipped, and its dependents say which agent is missing`; `design-team A6: the Reviewer cannot be turned off, and bad configs are rejected` |
| 1.5 | Passed | `design-team A6: a failing agent stops the run, names the agent and why, and earlier accepted changes stay` |
| 1.6 | Passed | `design-team A1: nobody depends on a later agent or on itself (every real dependency is earlier)`; `D4: the page registry data is the same as src/agents/registry.json (one list of the eight agents)` |

## R2. One owner per item
| # | Status | Proof |
|---|---|---|
| 2.1 | Passed | `design-team A2: an item with no owner, two owners, an unknown owner or the wrong owner is rejected` |
| 2.2 | Passed | `design-team A2: each kind has the right owner in the design team` |
| 2.3 | Passed | `design-team A2: a write by the wrong agent is refused and logged, and writes no version` |
| 2.4 | Passed | `design-team A1: the registry order is the eight names in the vision order` (each agent has its own folder); `design-team C5: the four new agents import nothing that can write to the Brain and never call the gatekeeper` |
| 2.5 | Passed | `design-team C1: Furniture never writes a wall item: the gatekeeper refuses it and logs the refusal` |

## R3. A change ripples
| # | Status | Proof |
|---|---|---|
| 3.1, 3.2 | Passed | `design-team C5: moving the Living Room wall ripples to every later agent, but only to what depends on that wall` |
| 3.3 | Passed | `design-team C5: right after the wall move, the plan re-checks the agents that own stale Living Room items and says why`; `D4 / R3.3, R3.6: a request from Furniture to Walls is shown, and after it is confirmed the screen says what is re-checked and shows the re-check pass` |
| 3.4 | Passed | `design-team A6: "still fine" refreshes the basis, adds a run-log line and writes no version` |
| 3.5 | Passed | `design-team A6: a Locked item is never changed, is refused by the gatekeeper, and is flagged "needs your look"`; `D4 / R3.5: the Locked sofa is never changed by the team` |
| 3.6 | Passed | `design-team A6: a request from Furniture is applied by Walls, and a ripple pass re-checks each agent at most once` |
| 3.7 | Passed | `design-team A6: a ripple pass cannot loop, even when every re-check asks for the wall to move again` |
| 3.8 | Passed | `design-team C2: moving a sofa makes the rug stale, and Decor re-checks and proposes a new rug`; `design-team C5: moving the Living Room wall ripples to every later agent, but only to what depends on that wall` |
| 3.9 | Passed | `design-team C5: what is left stale after run 1 is only what a re-check cannot help, and the Reviewer reports the stale ones` |

## R4. Ask, suggest, two options when unsure
| # | Status | Proof |
|---|---|---|
| 4.1 | Passed | `design-team A6: nothing changes until answer is called`; `D4 / R4.1, R4.6: the first agent shows its proposals, focus moves to its heading, and nothing changes until it is answered` |
| 4.2, 4.3 | Passed | `design-team A4: a high-confidence proposal has a recommended first option and Custom last`; `D4 / R8.1: each proposal shows its tag, its rule, why, and Confirm / Custom / Skip buttons with words on them` |
| 4.4 | Passed | `design-team A4: low confidence gives exactly two real options plus Custom`; `D4 / R4.4: when the Style agent is unsure, its proposal shows exactly two options plus Custom (and Skip)` |
| 4.5 | Passed | `design-team A6: skip leaves the item as it is and marks it "kept as is"`; `D4 / R4.5: Skip marks the item "kept as is", and the result says so` |
| 4.6 | Passed | `D4 / R4.6, R1.1: the next agent starts only after the answers, and the agents come in the registry order` |
| 4.7 | Passed | `design-team A6: an accepted change records who approved it (user or scripted answer) and the basis` |
| 4.8 | Passed | `D3 / R4.8: "scripted answer" is shown for scripted runs, and not for runs answered by a person` |

## R5, R6. Rules first, knowledge files
| # | Status | Proof |
|---|---|---|
| 5.1 | Passed | `design-team A6: the same input and the same script give the same result twice`; `D6 / R11.2: running the sample twice gives the same sample file` |
| 5.2 | Passed | `design-team C1: every proposal names a rule that exists in the knowledge files` |
| 5.3 | Passed | `design-team A3: npm run export-engine copies every knowledge file to docs/knowledge/ byte for byte`; `D4: docs/team/ holds a byte-identical copy of every listed file, the list holds every file the team imports, and data.js matches the knowledge files` |
| 5.4, 5.5 | Passed | `design-team B3: before the walls are decided there is no ceiling proposal (it does not guess a height)` |
| 6.1 to 6.5 | Passed | `design-team A3: every knowledge file in src/knowledge/ passes the provenance check (the real scan)`; `design-team A3: the knowledge README states the "own words, open sources only" rule` |
| 6.6 | Unverified: pending owner check | The owner reads the source lists in `.kiro/reports/team-group-b-run.txt` and `.kiro/reports/team-group-c-run.txt`. Every source is marked "not checked". |

## R7. AI gate
| # | Status | Proof |
|---|---|---|
| 7.1 | Passed | `R7.1 and R7.5: a scan of src/ai/ finds no network code, no web address and no key-like text`; `R7.1: no agent file imports the gate or a model directly (only the gate and the stand-in live in src/ai/)` |
| 7.2 | Passed | `R7.2: any task other than read-photo and judge-taste is refused with a message` |
| 7.3 | Passed | `R7.3: a call that would pass the cap is refused before it is made, and spent and remaining are shown` |
| 7.4 | Passed | `R7.4: the budget file has a cap of zero, so AI is off by default`; `R7.3 and R7.4: with the cap at zero nothing is called`; `D2 / R7.4 and R7.7: with the cap at zero the result equals the rule-only result and says "AI was not used"` |
| 7.5 | Passed | `R7.5: the stand-in answer is labelled "stand-in, not a real model" and needs no key`; `R7.5: an answer with a tag outside the style vocabulary has that tag cut, and long text is cut` |
| 7.6 | Passed | `R7.6: the status says the cap in the page is only a guard for the demo` |
| 7.7 | Passed | `D2 / R7.7: a refused call or a failed call falls back to the rules and says so` |

## R8. Honesty on screen
| # | Status | Proof |
|---|---|---|
| 8.1 | Passed | `D3 / R8.1: every proposal line in the team summary carries a Rule-based or AI tag`; `D3 / R8.1: every line of the team report carries a tag` |
| 8.2 | Passed | `D3 / R8.2: the fixed sentence of R8.2 is shown, and the old sentence stays while AI is off`; `D4 / D5: the result of a step-by-step run shows the team panel, the design team sentence and a report where every line has a tag` |
| 8.3 | Passed | `D3 / R8.3: an AI result says which task it was and what it cost, with the stand-in label`; `D2 / R8.3: with the stand-in and a cap, the proposal is tagged ai with the task name and the cost` |
| 8.4 | Passed | `D3 / R8.4: the draft statement is on every team output, and the sample label stays on a sample` |
| 8.5 | Passed | `D3 / R8.5: "understand" and "notice" never appear when AI was not used, and only next to an AI result when it was` |

## R9. Locked and Unsure are a minor tag
| # | Status | Proof |
|---|---|---|
| 9.1 | Passed | `design-team A2: status is optional and defaults to Unsure` |
| 9.2 | Passed | `design-team A2: Locked is still refused before the owner check, for a new kind`; `design-team C5: the Locked item is unchanged, no agent wrote it, and the Reviewer says it needs a look` |
| 9.3, 9.4 | Unverified: pending owner check | No screen of this spec asks for a status; the Items and Place screens (earlier specs) still do. How small the tag looks is for the owner to judge. |

## R10. The Reviewer
| # | Status | Proof |
|---|---|---|
| 10.1 to 10.6 | Passed | `design-team C5: one proposal is skipped, the item is kept as is, and the Reviewer reports it`; `D6: the sample shows a request to Walls, one skipped suggestion ("kept as is"), and the Locked items unchanged` (and the C4 tests in `test/team-reviewer.test.js`) |

## R11. Repeatable, recorded, shown in the browser
| # | Status | Proof |
|---|---|---|
| 11.1 | Passed | `design-team A2: a version record holds approvedBy and basis, and the item holds its latest basis` |
| 11.2 | Passed | `design-team C5: two runs of the same project with the same script give identical results` |
| 11.3 | Passed by test; the look: Unverified: pending owner check | `D5 / R11.3: the team data lists the eight agents in registry order, with what each did, re-checks with reasons, and tags`; `D5 / R11.3: the team panel shows the eight agents in order, what each did, re-checks and the tags; data without a team part hides it`; `D5: the new kinds are drawn as simple shapes: lights under the ceiling, switches and sockets on the wall, a rug on the floor` |
| 11.4 | Passed | `D6 / R11.4: the sample runs through the eight agents in order, with scripted answers, and finishes`; `D6: sample-summary.html equals a fresh summary of the design-team sample, with the labels, the team sentence and "scripted answer"` |

## R12. Safe to publish
| # | Status | Proof |
|---|---|---|
| 12.1 | Passed | `R7.1 and R7.5: a scan of src/ai/ finds no network code, no web address and no key-like text` (and the whole-repo secret scan in `test/no-secrets.test.js`) |
| 12.2, 12.3 | Passed | `D6 / R12: .kiro is not in .gitignore, LICENSE is unchanged, package.json is unchanged, and the old sample files are kept` |
| 12.4 | Passed | `D3 / R8.4: the draft statement is on every team output, and the sample label stays on a sample` |

## Pending owner check (the published page)
- The Review and run screen: "Step through the eight agents, and confirm each suggestion", one agent at a time, the Confirm / Custom / Skip buttons, focus on each new heading, at 320 px wide and with a keyboard only.
- The result page: the "The design team" panel in the right-hand column, the new light, switch, socket and rug shapes, and whether the 34 light markers make the sample look crowded.
- A screen reader reading the announcement line and the proposal groups.
- The sources of every knowledge file (R6.6).
