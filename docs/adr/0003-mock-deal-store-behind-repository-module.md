# 0003. Deal store behind a single repository module, seeded from the shared fixture

Status: accepted (Oct 21 2026), revised Oct 24. Temporary by design.

## Context
Real backend data isn't wired up. Writes must survive a server restart during a live demo.

## Decision
Deals live in a JSON file under `backend/data/` for local development only; on Vercel they live in Upstash (the owner does the setup). All reads and writes go through one repository module. A "reset demo data" script restores the seed. Tests use a temp copy.

The seed is `backend/fixtures.js`, the one fixture file shared by the agent and the evals. It is generated from `index.html` (`node backend/scripts/extract_fixtures.js`): the Cottage Grove deal `TX-CG118` and all form codes are the real ones. Only `tx_unknown_city` (Austin) is synthetic, labelled `synthetic: true`.

## Consequences
- When the real repo arrives, only the repository module is replaced.
- That replacement must be followed by testing, checking and modifying: see R1 in `backend/reminders.md`. If the tool layer, agent loop or prompts need changes, the seam was wrong and gets fixed.
- If `index.html` changes its documents, regenerate the fixture; a test fails when they drift apart.
