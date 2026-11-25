# Knowledge files

These files hold the fixed rules and facts the design team's agents read. They are plain data files, not code.

## The rule: own words, open sources only

- Every rule is written in our own words. Nothing is copied or pasted from a book, a course, a video, a paid or member-only site, or any other copyrighted text.
- Only open sources may be listed: public-domain works, government publications, and sources under CC0, CC BY, or an open government licence. Share-alike and non-commercial licences are not used.
- Every file starts with a **provenance** block: a title, what it covers, the sources it was written from (name, web address, licence), who wrote it ("own words"), and a date.
- Web addresses are written without the starting "http" part (for example `gov.uk/government/...`). This keeps the project's "no web addresses in src/" search strict. A web address here is only a note for a person to read. Nothing in the code opens it.
- Every rule carries the note "Typical guideline, check local rules." Plans are drafts for professional review, not verified engineering.
- A single text field may not be longer than 200 characters. This stops whole passages from being pasted in.

## What checks this

A test (`test/team-knowledge.test.js`) reads every file here and fails if a file has no provenance block, lists no source, lists a licence that is not in `allowed-licences.json`, or has a text field over the limit.

A test cannot tell whether text was copied. Before a new knowledge file is merged, the owner reads its list of sources. Until then it is marked **pending owner check**.

## Layout

- `allowed-licences.json`: the licences that may be listed.
- `shared/`: files every agent may read (room types and similar). Read-only for agents.
- One folder per agent will be added as each agent is built.
