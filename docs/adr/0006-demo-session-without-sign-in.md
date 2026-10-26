# 0006. Demo mode: a role-switcher session instead of sign-in

Status: accepted (Oct 26 2026). A stand-in; replace with real sign-in.

## Context
There is no sign-in in this repo yet, and the demo must run on Vercel. The earlier rule refused the stub session on Vercel. The assistant must still act with exactly one of four roles and never leak one role's data to another.

## Decision
- The UI's role switcher POSTs to a server endpoint that validates the role (broker, seller, buyer, lender only) and sets a signed, HttpOnly, SameSite=Strict cookie. The agent reads the role only from that cookie, never from the body, chat, tool arguments or model output.
- The refusal on Vercel is removed. Instead the session needs an owner-set signing secret there and refuses without it, because a built-in default would let anyone forge a broker cookie.
- It is separate from `DEV_FAKE_AUTH`, which stays impossible on Vercel for the real app.
- Every switch starts a new session. Chat history and the seen-field-names set are keyed by deal, session and role, so a switch starts a clean thread.
- Public-endpoint safeguards: per-client rate limits, a daily model-call cap, no keys in responses or logs, and only redacted deal data.

## Consequences
- Any visitor can choose any role, so role filtering is enforced fully on the server and the broker-only audit page is only as strong as the switcher. Accepted for a redacted demo.
- Replace this with real sign-in before anything beyond a redacted demo is served (reminders.md R6).
- The chat endpoint, tools and loop are not built, so the daily cap, the chat rate limit, the seen-field set and `redactDeal` are tested but not yet called (R15).
