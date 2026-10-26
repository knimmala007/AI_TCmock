# 010: Broker-only audit log page and button
Status: done | Depends on: 008, 009 | Owner: agent | Size: M

## What solving this does

The broker view has an Audit log button that opens a page of a turn's events. Only the broker can open it, and the server checks that on every request.

Files: create `backend/events_page.js`, `api/events.js`, `backend/tests/events_page.test.js`, `backend/tests/audit_button.test.js` | modify `index.html`

## Scope

In: Button, endpoint, per-deal filter, escaping, rate limit.
Out: Showing real turns (needs the chat endpoint, ticket 027).

## Acceptance criteria

1. The button is rendered only in the broker view.
2. Seller, buyer and lender get 403 and no event data; no session gets 401.
3. A role claimed in the query, a header or the body is ignored.
4. Event contents are HTML-escaped; responses are not cached.

## Tests

handler: `events_page.test.js`, plus rendering the real `brokerView` for each role.

## Sources

`.scratch/role-based-chat-agent/spec.md` Logging; ADR 0004.

## Notes

Without a turn id the page shows a form.
