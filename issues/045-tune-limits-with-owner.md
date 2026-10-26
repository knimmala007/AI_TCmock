# 045: Tune the limits with the owner
Status: todo | Depends on: 044 | Owner: human | Size: S

## What solving this does

The owner confirms or changes the rate limits, daily cap, thread length and expiry that were chosen as starting points.

Files: modify `backend/config.js`, `backend/reminders.md` (R15)

## Scope

In: The numbers.
Out: New safeguards.

## Acceptance criteria

1. The per-minute limits, the daily cap, the 20-message thread and the one-day expiry are confirmed or changed.
2. The reminders note the final values.

## Tests

Existing limit tests still pass.

## Sources

`backend/reminders.md` R15, R10.

## Notes

Current values: 10, 30 and 20 per minute; 500 per day.
