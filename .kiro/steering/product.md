# DesignForYou: Product

For the longer picture, see `vision.md`. This file must not contradict it.

## What it is
A browser web app for people with good taste who cannot use CAD software. Two groups of users:
- Homeowners, who have taste but no CAD skills.
- Designers, who link or upload a portfolio.

## How a user works with it
1. Give inspiration images and notes, first for the whole project, then per room.
2. Give real measurements or a floor plan, or start from rough templates.
3. Choose items from a categorised list (construction, exterior, interior, furniture, lighting, decor). Every list includes a "custom" choice.
4. Confirm or change what the design team suggests.

Locked and Unsure are only a minor, optional tag on an item. They are not a core feature.

## The design team
Specialist agents work in dependency order on one shared **Project Brain** (the single shared record of the project):
1. Walls
2. Doors and windows
3. Floors and ceilings
4. Lighting and electrical
5. Furniture
6. Decor
7. Style
8. Reviewer

A **Coordinator** runs them in that order. A change to earlier work (for example moving a wall) triggers a re-check of everything that depends on it. Agents always ask the user to confirm. They suggest options, and they show two options when they are unsure.

## Rules
- One owner per item. Each agent owns separate files and items, so agents never edit the same thing.
- Items marked Locked are never overwritten by any agent.
- Fixed rules and knowledge files come first. A paid AI model is used only for understanding photos and for taste judgement, always with a spending cap.
- The screen says clearly what is rule-based and what is AI.
- Version history is kept for every change.

## Output
- A floor plan
- A 3D view
- A door and window list
- A clash report

## Safety statement
Plans are drafts for professional review. They are never claimed as verified engineering. Every output must say so.

## HACKATHON MODE
- Event: Kiroween, Frankenstein category.
- The browser viewer is what judges use.
- Demo plan: one pre-run sample project, clearly labelled as a sample, shown end to end through the eight-agent design team in the browser, with scripted answers that are labelled as such.
- SketchUp and Revit connections come through MCP in the Kiro desktop app. They are shown in a short video clip and are not part of the browser app.
- Judging rules and deadlines: record them here once known.
