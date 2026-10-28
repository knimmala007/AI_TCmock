# 064: Only the broker can read logged free text (tests and the inbox property)
Status: todo | Depends on: 062 | Owner: agent | Size: S

## What solving this does

Model-call events still hold what users typed and what the model wrote (ticket 062 keeps free text out of tool and refusal events only). That is accepted for the demo, because the events endpoint is already broker-only (`backend/events_page.js` lines 26 and 27) and escapes everything it prints. This ticket proves that property with tests instead of changing what is logged: a question handed to `ask_broker` cannot be read by any role other than the broker.

Files: create `backend/tests/events_access.test.js` | modify `backend/tests/inbox.test.js` | reference `backend/events_page.js`, `backend/inbox.js`, `backend/tools.js`

## Scope

In: Tests only. Existing tests already cover a 403 for seller, buyer and lender on `GET /api/events` (`events_page.test.js`) and on `GET /api/inbox` (`inbox.test.js`); this ticket adds only what they do not cover, namely that the refusal bodies hold no question text.
Out: Redacting or removing message content from events; any change to what is logged; any change to `backend/`, `api/` or the page.

## Acceptance criteria

1. A test that seller, buyer and lender each get 403 `ROLE_FORBIDDEN` with no question text in the response on `GET /api/events` and on `GET /api/inbox`, adding only what the existing tests do not cover.
2. The `todo` test "the question text appears in no stored event" (marker `ZEBRA-7731`) in `backend/tests/inbox.test.js` is replaced by a normal test of the real property: after a buyer's `ask_broker`, the question text is not readable by any non-broker role through an endpoint or a tool result.
3. No change to what is logged. The suite has no `todo`, and the events written for a turn are the same as before.

## Tests

handler: scripted fake model, memory storage. A distinctive marker string is sent as the buyer's question; for each of seller, buyer and lender, search the `GET /api/events` and `GET /api/inbox` responses and every tool result that role can receive (`get_deal_status`, `ask_broker`) for the marker. Mutation check: let a non-broker role through the events endpoint or the inbox endpoint, and see the tests fail.

## Sources

Ticket 062 (what it logs); ticket 050 (the known gap); `backend/events_page.js`; ADR 0004; ADR 0012; `backend/reminders.md` R25, R26.

## Notes

Free text stays in model-call events for the demo; only the broker can read it. Whether to redact or remove message content from events (content-free logging) is out of scope here: decide before real sign-in (ticket 057).

Ticket 044 still waits on this, because its checks include that nothing reaches a role that must not see it.
