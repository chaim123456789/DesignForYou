# DesignForYou: Tech

## Principles
- Beginner-friendly browser app. Prefer simple, readable code and few moving parts.
- Ask the owner before choosing any framework. Do not pick one on your own.
- No installs or dependencies without asking first.

## 3D
- The 3D room viewer uses Three.js.

## Agents
- The design team has eight agents, in this order: Walls, Doors and windows, Floors and ceilings, Lighting and electrical, Furniture, Decor, Style, Reviewer. This is the same list as in `vision.md` and in `.kiro/specs/design-team/`.
- The order and each agent's "depends on" list are written in one file only: `src/agents/registry.json`. No other file keeps its own copy of the order.
- Each agent has its own folder under `src/agents/` with an `agent.js` and a small `agent.json` config file that switches it on or off. The Reviewer cannot be switched off.
- Each agent has its own knowledge folder under `src/knowledge/`. Knowledge files are plain data, written in our own words from open sources only, with a provenance block (see `src/knowledge/README.md`).
- Agents only return proposals. Every change goes through the gatekeeper, and only after the user answers. No two agents edit the same file or item.

## AI keys and secrets
- Live AI mode comes later. A paid AI model is reachable only through one gate with a spending cap that defaults to zero (off), and only for understanding photos and for taste judgement.
- Any key stays server-side and is never in the repo, logs, or any file.

## Repo hygiene
- `.kiro` must never be listed in `.gitignore`.
- No personal data in any file.

## HACKATHON MODE
- The owner approved the swap on 2026-11-25 (design-team D6): the sample now runs through the eight-agent team with scripted answers. The old four-agent pipeline (Style, Layout, Builder, Reviewer) is kept in the code, unused by the sample, and still runs behind the one-go "Run the design team" button. Deleting it needs the owner's yes.
- The demo starts in **Sample mode**: a pre-run example project goes through the same pipeline as a real one, and is clearly labelled as a sample.
- Live AI mode is out of scope for the demo.
- SketchUp is only a short video clip. It is not part of the app.
