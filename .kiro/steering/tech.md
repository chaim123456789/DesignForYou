# DesignForYou: Tech

## Principles
- Beginner-friendly browser app. Prefer simple, readable code and few moving parts.
- Ask the owner before choosing any framework. Do not pick one on your own.
- No installs or dependencies without asking first.

## 3D
- The 3D room viewer uses Three.js.

## Agents
- Each agent (Style, Layout, Builder, Reviewer) is defined in a simple config file.
- Config files let an agent be switched on or off later.
- Each agent has its own files. No two agents edit the same file or item.

## AI keys and secrets
- Live AI mode comes later.
- Any key stays server-side and is never in the repo, logs, or any file.

## Repo hygiene
- `.kiro` must never be listed in `.gitignore`.
- No personal data in any file.

## HACKATHON MODE
- The demo starts in **Sample mode**: a pre-run example project goes through the same pipeline as a real one, and is clearly labelled as a sample.
- Live AI mode is out of scope for the demo.
- SketchUp is only a short video clip. It is not part of the app.
