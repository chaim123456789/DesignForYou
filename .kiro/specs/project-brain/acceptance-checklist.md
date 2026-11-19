# Acceptance checklist: Project Brain and Sample-mode Pipeline

Checked on 2026-11-18 (Task 17). `node --test` result at that time: 138 tests, 138 passed, 0 failed.

Key: **Passed** means a named automated test proves it. **Unverified** means no test or step proves it yet. Test names are the exact names in `test/`.

## R1. Project structure
| # | Status | Proof |
|---|---|---|
| 1.1 | Passed | "R1.1-R1.3: a valid project loads with floors and rooms"; "R1.1: a project with no floors is rejected"; "R1.1: a project with no name is rejected" |
| 1.2 | Passed | "R1.2: a floor with no rooms or no name is rejected" |
| 1.3 | Passed | "R1.3: each room belongs to exactly one floor"; "R1.3: a room with no name is rejected" |
| 1.4 | Passed | "R1.4: a room with no floor is rejected with a clear message"; "R1.4: a floor with no project is rejected with a clear message" |
| 1.5 | Passed | "R1.5: order is the same on every load" |

## R2. Inspiration layers
| # | Status | Proof |
|---|---|---|
| 2.1 | Passed | "R2.1: a project has one overall inspiration set" |
| 2.2 | Passed | "R2.2/R2.3: a room with an override gets its own set" |
| 2.3 | Passed | "R2.3: a room without an override gets the overall set"; "R2.2/R2.3: a room with an override gets its own set" |
| 2.4 | Passed | "R2.4: one override does not change any other room" |
| 2.5 | Passed | "R2.5: clearing an override returns the room to the overall set" |

## R3. Items and statuses
| # | Status | Proof |
|---|---|---|
| 3.1 | Passed | "R3.1: a given status of Locked is kept"; "R3.3: a new item with no status defaults to Unsure"; "R3.4: status \"Maybe\" is rejected" (an item can only ever be Locked or Unsure) |
| 3.2 | Passed | "R3.2: an item can belong to a room, and the room must exist" |
| 3.3 | Passed | "R3.3: a new item with no status defaults to Unsure" |
| 3.4 | Passed | "R3.4: status \"Maybe\" is rejected"; "bad input: unknown item and unknown status are errors, not silent" |
| 3.5 | Passed | "R3.5: a user can lock an Unsure item, which writes a version, and then it is protected"; "R3.5/R5.4: a user unlocking an item makes it changeable and writes a version" |

## R4. One Project Brain, one owner per item
| # | Status | Proof |
|---|---|---|
| 4.1 | **Unverified** | No test checks "exactly one Project Brain per project". In the code a project is one object that holds all its items, but nothing tests that. |
| 4.2 | Passed | "R4.2: an owner that is not one of the four agents is rejected"; "R4.5: each item kind maps to its owner" |
| 4.3 | Passed | "R4.3: an item with no owner is rejected"; "R4.3: an item with two owners is rejected" |
| 4.4 | Passed | "R4.4: a non-owner is refused on an Unsure item"; "R4.4: a proposal for an item the agent does not own is refused and logged, with no version" |
| 4.5 | Passed | "R4.5: each item kind maps to its owner"; "R4.5: an item whose owner does not match its kind is rejected" |
| 4.6 | Passed | "R6.3: an agent can read all items, including ones it does not own" |

## R5. Locked items are never overwritten
| # | Status | Proof |
|---|---|---|
| 5.1 | Passed | "R5.1: a proposal for a Locked item is refused even for its owner" |
| 5.2 | Passed | "R5.1/R5.2: the owner is refused on a Locked item and the value is identical before and after" |
| 5.3 | Passed | "R5.3/R4.4: each refusal appears in the run log with agent, item and reason"; "R5.3: the sample run log has a Style \"refused\" line for the Locked item" |
| 5.4 | Passed | "R5.4: an agent cannot unlock an item, even its owner, and this is logged"; "R3.5/R5.4: a user unlocking an item makes it changeable and writes a version" |
| 5.5 | Passed | "R5.5: every item Locked at the start has the same value and is still Locked at the end" |

## R6. Coordinator and fixed agent order
| # | Status | Proof |
|---|---|---|
| 6.1 | Passed | "R6.1/R6.4: the run log shows Style, Layout, Builder, Reviewer in that order, each started then finished"; "R6.1: the order is fixed even if the config list is in a different order" |
| 6.2 | Passed | "R6.2: each agent runs once, and never starts before the previous one finishes" |
| 6.3 | Passed | "R6.3: an agent cannot write to the Brain directly (the view is read-only)"; "R6.3: the view is a copy, not the real Brain, and has no gatekeeper to call"; "an agent cannot pretend to be another agent: a \"who\" in a proposal is ignored" |
| 6.4 | Passed | "R6.1/R6.4: the sample run log shows Style, Layout, Builder, Reviewer in order" |
| 6.5 | Passed | "R6.5: a stand-in that throws stops the run, and later agents do not run"; "R6.5: changes accepted before the failure remain in the Brain and in history" |
| 6.6 | Passed | "R6.6: an agent set to off shows \"skipped\" and does not run"; "an agent can be switched off in its file"; "all four agent configs load, in run order" |
| 6.7 | Passed | "R6.7: the Reviewer is treated as on even if its file says off"; "R6.7: the Reviewer still runs, last, even if its config says off" |

## R7. Sample mode and labelling
| # | Status | Proof |
|---|---|---|
| 7.1 | Passed | "R7.1: the sample has 2 floors and 4 rooms (kitchen, living room, bedroom, bathroom)" |
| 7.2 | Passed | "R7.2: the sample has at least 2 Locked and at least 3 Unsure items" |
| 7.3 | Passed | "R7.3: the sample has at least 1 room override, and it is on the bedroom" |
| 7.4 | Passed | "R7.4: no shortcut around the Coordinator (code search)"; "R7.4: the sample gives the same result as a plain Coordinator run with the same agents" |
| 7.5 | Passed for the report and the summary page text. **Browser view unverified** | "R7.5/R9.7: the sample report carries the label and the draft statement"; "R7.5/R10.1: the summary contains the SAMPLE PROJECT label and the draft statement"; "R7.5: the label text contains SAMPLE PROJECT and the draft statement". Nobody has yet looked at the page in a browser (pending owner check). |
| 7.6 | **Unverified** | No test checks that Sample mode is the only mode. A search of `src/` for network calls, web addresses and environment variables found none, but that was a one-off search, not a test. |
| 7.7 | Passed | "R7.7: running the sample twice gives an identical Brain, versions, run log and report" |
| 7.8 | Passed | "R7.8: no personal data (no emails, phone numbers, street addresses, links)". This is a pattern search, so it cannot catch every possible kind of personal data. |

## R8. Version history
| # | Status | Proof |
|---|---|---|
| 8.1 | Passed | "R8.1: first change is version 1, the next is version 2"; "R8.1: version numbers rise by 1 across values and status changes" |
| 8.2 | Passed | "R8.2: each entry has number, time, who, item, old value and new value"; "R8.2: a version gets a time when none is given" |
| 8.3 | Passed | "R8.3: there is no exported way to edit or remove a version"; "R8.3: changing a listed version does not change the history" |
| 8.4 | Passed | "R8.4: refusals create no version" |
| 8.5 | Passed | "R8.5: versions are listed in order"; "R8.5: the Brain at version 2 matches the known state after two changes"; "R8.5: the Brain at other versions matches the known state"; "R8.5/R8.6: past versions of the sample can be viewed without changing the Brain" |
| 8.6 | Passed | "R8.6: viewing a past version does not change the current Brain or add a version"; "R8.6: changing the returned past Brain does not change the current Brain" |

## R9. Reviewer clash report
| # | Status | Proof |
|---|---|---|
| 9.1 | Passed | "R6.1/R6.4: the sample run log shows Style, Layout, Builder, Reviewer in order" (Reviewer runs after Builder); "the sample report has at least 2 clashes, one of each type" |
| 9.2 | Passed | "each clash lists the items, room, plain description and severity" |
| 9.3 | Passed | "the sample report has at least 2 clashes, one of each type"; "the sample run does not report the clean pairs: a door beside a sofa is not a clash" |
| 9.4 | Passed | "the sample report has at least 2 clashes, one of each type"; "the sample clashes are the Garden door on the Sofa, and the Bedroom override against the Locked oak"; "R9.4 (data): a door sits on furniture in the same room"; "R9.4 (data): the bedroom override conflicts with a Locked style item in that room" |
| 9.5 | Passed | "a clean project gives \"No clashes found\"" |
| 9.6 | Passed | "the Reviewer changes no item owned by another agent"; "the Reviewer only reads: its proposals target only Reviewer-owned items, and the view is not changed"; "the Reviewer writes nothing: its code never uses the gatekeeper or the Brain writers" |
| 9.7 | Passed | "the report carries the SAMPLE PROJECT label and the draft statement"; "R7.5/R9.7: the sample report carries the label and the draft statement" |
| 9.8 | Passed | "the report is saved through the gatekeeper and appears in version history"; "a Locked report item is refused by the gatekeeper, not overwritten" |

## R10. Plain-language visibility
| # | Status | Proof |
|---|---|---|
| 10.1 | Passed by test. **Human read-through pending owner check** | "R10.1: the summary has every section heading"; "R10.1: the summary shows structure, items with status and owner, run log, clash report and versions". A test cannot judge whether the page is easy to read, and nobody has opened it in a browser yet. |
| 10.2 | Passed by test. **Human read-through pending owner check** | "R10.2: the summary has no raw internal field names or ids". The test checks a fixed list of internal names and id patterns. Whether the wording reads as plain language is for the owner to judge. |

## Other checks from Task 17
- `LICENSE`: `git diff main --stat -- LICENSE` shows no change.
- `.gitignore`: contains only `node_modules/`, `dist/`, `build/`. `.kiro` is not listed.
- Installs: none. `package.json` has no `dependencies` or `devDependencies`. It gained one script (`sample`) in Task 16.

## Unverified, in short
1. R4.1: one Project Brain per project (no test).
2. R7.6: Sample mode is the only mode (searched once, no test).
3. R7.5, R10.1, R10.2: how the page looks and reads in a browser (pending owner check).
