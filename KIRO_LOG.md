# Kiro Log

One entry per session.

## 2026-11-18, Session 1
- **Kiro app used:** Web
- **Kiro feature used:** Steering. It gives Kiro the product, tech, and working rules in every session.
- **Result:** Created `.kiro/steering/product.md`, `tech.md`, `working-rules.md`, this log, and a `.gitignore` for standard build folders only.
- **How it was verified:** Listed the files, searched `.gitignore` to confirm `.kiro` is not in it, confirmed each steering file has a "HACKATHON MODE" heading, and confirmed `LICENSE` is unchanged with `git status`.
- **Credits used:** ___
- **Next step:** Owner reviews and merges the pull request. Then decide the first small build step.

## 2026-11-18, Session 2
- **Kiro app used:** Web
- **Kiro feature used:** Spec. The Project Brain and Sample-mode pipeline has many linked rules (owners, Locked items, fixed agent order, version history), so a spec gave us written requirements, a design and ordered tasks that the owner approved one at a time before any code.
- **Result:** Created `.kiro/specs/project-brain/requirements.md` (10 requirements with testable acceptance criteria), `design.md` (plain JavaScript, no framework, no installs; gatekeeper design), and `tasks.md` (17 small tasks, each with a check). No app code written.
- **How it was verified:** Owner reviewed and approved each file in turn. Requirements changes (R9.3 reduced to two clash types, R9.4 adjusted) were re-read after editing. Checked `.gitignore` does not list `.kiro`, and `git status` shows `LICENSE` unchanged. The specs themselves are documents, so the build checks are defined in `tasks.md` and have not been run yet.
- **Credits used:** ___
- **Next step:** Owner reviews and merges the pull request. Then start Task 1 of `tasks.md`.
