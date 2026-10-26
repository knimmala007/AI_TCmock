# 048: Waive a form or override a refusal button
Status: todo | Depends on: 043 | Owner: agent | Size: M

## What solving this does

The broker can waive a required form or override a refusal with a button, and the reason is recorded.

Files: create `api/waive.js`, `backend/tests/waive.test.js` | modify `index.html`

## Scope

In: The button and endpoint.
Out: Any model tool.

## Acceptance criteria

1. Broker-only.
2. A reason is required and stored.
3. A waived form no longer blocks progress.
4. It is audited.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals.

## Notes

Overriding a refusal weakens a guard on purpose; keep it narrow.
