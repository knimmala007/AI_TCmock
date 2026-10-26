# 026: Find the platform audit log's shape
Status: todo | Depends on: 018 | Owner: human | Size: S

## What solving this does

The owner tells us how the existing audit trail stores entries and how this repo may write to it, so events can go to the real sink later.

Files: modify `backend/reminders.md` (Q-a, R7), `docs/adr/0004-agent-events-table-for-logging.md` | reference the other branch's `audit()` in `api/_lib/store.js`

## Scope

In: The entry shape and access route.
Out: Writing to it (ticket 059).

## Acceptance criteria

1. The fields of an entry (who, role, what, when) are written down.
2. Where entries live and how this repo would reach them is written down.
3. It says whether the Approve and button endpoints should write there.

## Tests

None (information).

## Sources

`backend/reminders.md` Q-a, R7; `agents/00-orchestrator/BACKLOG.md`.

## Notes

Unblocks 059.

## Left to do (Oct 26)

Nothing in this ticket is stale text. It stays `todo` until the owner answers the seven questions in ADR 0012 (the platform `audit()` shape and access route).
