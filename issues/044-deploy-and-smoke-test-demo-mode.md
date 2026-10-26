# 044: Deploy and smoke-test demo mode
Status: todo | Depends on: 028, 030, 042, 043 | Owner: human | Size: M

## What solving this does

The owner deploys the demo and checks it end to end with the real model and the real store.

Files: modify `backend/reminders.md` (R10, R15) | reference all

## Scope

In: One deployment and a written result.
Out: Tuning (045).

## Acceptance criteria

1. A real Upstash round trip works (deal read and write, an event list, a thread with expiry).
2. The real model answers as the chosen role.
3. A buyer cannot reach broker data or the audit page.
4. Rate limits key on the real client address on Vercel.
5. The daily cap stops calls at the cap.
6. No key appears in any response or log.

## Tests

Manual end-to-end run.

## Sources

`backend/reminders.md` R10, R15, R6.

## Notes

Do this before showing the demo to anyone else.
