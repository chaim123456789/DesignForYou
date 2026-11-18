# Requirements: Project Brain and Sample-mode Pipeline

## Purpose
Build the core record of a project (the **Project Brain**) and run it through the four agents in **Sample mode**. Sample mode uses a pre-run example project that is clearly labelled as a sample.

## Out of scope (separate specs later)
3D viewer, image upload screens, live AI mode, login.

## Words used in this document
- **Project**: one home design. It has floors, and floors have rooms.
- **Item**: one thing the design cares about, such as "oak floor in the kitchen" or "door between hall and living room".
- **Locked**: the item must stay exactly as it is.
- **Unsure**: the item is open to change.
- **Project Brain**: the single shared record of the project, holding every item, its status, its owner agent, and its history.
- **Owner agent**: the one agent allowed to change an item.
- **Coordinator**: the part that runs the agents.
- **Sample mode**: the pipeline runs on a pre-run example project, not on user input.
- **Clash**: two items that conflict (for example, a door that opens into a wardrobe).

## Requirements

### R1. Project structure
**As a user, I want a project made of floors and rooms, so the design matches a real home.**

Acceptance criteria:
1. A Project has a name and one or more floors.
2. A floor has a name and one or more rooms.
3. A room has a name and belongs to exactly one floor.
4. Creating a room with no floor, or a floor with no project, is rejected with a clear message.
5. Floors and rooms keep a stable order, so the same project always shows in the same order.

### R2. Inspiration layers
**As a user, I want an overall style for the whole project and optional overrides per room, so each room can differ where I want.**

Acceptance criteria:
1. A Project has one overall inspiration set. In this spec, an inspiration set is a list of named references (for example, the sample's "warm oak and linen"). Image handling is out of scope.
2. A room may have a room-level override set. It is optional.
3. The effective inspiration of a room is its override set if one exists. Otherwise it is the overall set.
4. A room with an override never changes the effective inspiration of any other room.
5. Removing a room's override returns that room to the overall set.

### R3. Items and statuses
**As a user, I want to mark each item Locked or Unsure, so the system knows what it may change.**

Acceptance criteria:
1. Every item has exactly one status: Locked or Unsure.
2. Every item belongs to the project, and to a room when it is room-specific.
3. A new item with no status given defaults to Unsure.
4. Status values other than Locked or Unsure are rejected.
5. A user can change an item from Unsure to Locked, and from Locked to Unsure. Each change is recorded in version history (R8).

### R4. One Project Brain, one owner per item
**As a user, I want one shared record where every item has exactly one owner agent, so agents never edit the same thing.**

Acceptance criteria:
1. There is exactly one Project Brain per project.
2. Every item has exactly one owner agent: Style, Layout, Builder, or Reviewer.
3. Creating an item with no owner, or with two owners, is rejected.
4. When an agent tries to change an item it does not own, the change is refused and the refusal is recorded.
5. Ownership by kind in this spec:
   - Style owns style items (materials, colours, mood).
   - Layout owns layout items (room positions, sizes, furniture placement).
   - Builder owns door and window items.
   - Reviewer owns clash report items.
6. An agent can read all items, including items it does not own.

### R5. Locked items are never overwritten
**As a user, I want Locked items to stay exactly as they are, no matter what runs.**

Acceptance criteria:
1. Any attempt to change, replace, or delete a Locked item by an agent is refused, even by its owner agent.
2. A refused attempt leaves the item's value identical to before. A test compares the value before and after.
3. A refused attempt is recorded in the run log with the agent name, the item, and the reason.
4. Only a user action changing status from Locked to Unsure can make the item changeable (R3.5).
5. After a full pipeline run in Sample mode, every item that was Locked at the start has the same value and is still Locked.

### R6. Coordinator and fixed agent order
**As a user, I want the agents to run in the same order every time, so results are predictable.**

Acceptance criteria:
1. The Coordinator runs agents in this order: Style, Layout, Builder, Reviewer.
2. Each agent runs once per pipeline run, and an agent never starts before the previous one finishes.
3. Each agent reads the Project Brain and writes only the items it owns.
4. The run log lists each agent with start and finish, in order.
5. If an agent fails, the Coordinator stops, does not run later agents, and reports which agent failed and why. Changes made by earlier agents in that run stay in the Project Brain and in history.
6. Each agent has a simple config file with an on/off setting. An agent that is off is skipped, and the run log says it was skipped.
7. The Reviewer is always last and cannot be turned off in this spec.

### R7. Sample mode and labelling
**As a user, I want to see a complete example run that is clearly marked as a sample, so I know it is not real advice.**

Acceptance criteria:
1. A pre-run sample project exists with at least 2 floors and at least 4 rooms.
2. The sample has at least 2 Locked items and at least 3 Unsure items.
3. At least one room in the sample has a room-level override.
4. The sample goes through the same Coordinator and the same four agents as any project would. There is no separate shortcut path.
5. Every view and output of the sample shows the label "SAMPLE PROJECT" and a statement that plans are drafts for professional review and are not verified engineering.
6. Sample mode is the only mode available in this spec. Live AI mode does not exist yet.
7. Running the sample twice from the same start state gives the same result.
8. The sample contains no personal data.

### R8. Version history
**As a user, I want a history of every change to the Project Brain, so I can see what changed, when, and who changed it.**

Acceptance criteria:
1. Every accepted change creates a new numbered version, starting at 1 and rising by 1.
2. Each version records: version number, time, who made the change (a named agent or "user"), the item, the old value, and the new value.
3. Past versions are never edited or deleted.
4. Refused changes (R4.4, R5.1) do not create a new version, but are recorded in the run log.
5. A user can list all versions in order and view the Project Brain as it was at any past version number.
6. Viewing a past version does not change the current Project Brain.

### R9. Reviewer clash report
**As a user, I want a clash report after the run, so I can see problems before anyone builds anything.**

Acceptance criteria:
1. After Builder finishes, the Reviewer checks the Project Brain and produces a clash report.
2. Each clash lists: the two items involved, the room, a plain-language description, and a severity (High, Medium, or Low).
3. The Reviewer checks these two clash types:
   - A door or window placed where furniture sits.
   - A room-level override whose style conflicts with a Locked item in that room.
4. The sample is built so the report contains at least 2 clashes, at least one of each type, and the report is not empty.
5. If no clashes are found, the report says "No clashes found" instead of being blank.
6. The Reviewer reports clashes and does not fix them. It never changes items owned by other agents.
7. The report carries the "SAMPLE PROJECT" label in Sample mode and the draft-for-professional-review statement.
8. The clash report is saved as a Reviewer-owned item, so it appears in version history.

### R10. Plain-language visibility
**As a non-coder, I want to see the results without reading code.**

Acceptance criteria:
1. After a sample run, a readable summary shows: the project structure, each item with its status and owner, the run log, the clash report, and the version list.
2. The summary uses plain words, not internal field names.

## Decisions from the owner
1. Version history is view only. There is no restore.
2. The sample is a two-storey home with a kitchen, living room, bedroom and bathroom, with an override on the bedroom.
