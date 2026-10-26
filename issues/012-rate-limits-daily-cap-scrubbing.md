# 012: Rate limits, daily cap and data scrubbing helpers
Status: done | Depends on: 007 | Owner: agent | Size: S

## What solving this does

Helpers exist to limit requests per client, cap model calls per day across everyone, and scrub personal details from deal data. The role switcher and audit page already use the limiter.

Files: create `backend/limits.js`, `backend/safety.js`, tests | modify `backend/config.js`

## Scope

In: Fixed-window limiter, daily cap, `redactDeal`.
Out: Using the cap, the chat limit and `redactDeal` in the chat flow (tickets 027, 031).

## Acceptance criteria

1. The limiter allows up to the limit then refuses, and resets.
2. The cap stops calls at the cap and resets the next day.
3. Emails, phone numbers and SSN-like numbers are scrubbed; an APN is kept.

## Tests

Unit tests (`limits.test.js`, `safety.test.js`).

## Sources

`backend/reminders.md` R15; `.scratch/role-based-chat-agent/spec.md` Public endpoint safeguards.

## Notes

The numbers are my choice.
