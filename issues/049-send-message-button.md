# 049: Send a message button
Status: todo | Depends on: 043 | Owner: agent | Size: L

## What solving this does

The broker can send a message to a seller, buyer or lender, and each person sees only messages meant for them.

Files: create `api/messages.js`, `backend/messages.js`, `backend/tests/messages.test.js` | modify `index.html`

## Scope

In: Message store, send, read, per-role scoping.
Out: Email or notifications.

## Acceptance criteria

1. Only the broker can send.
2. A recipient sees only their own messages.
3. Seller and buyer never see each other's messages.
4. It is audited.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals; `agents/00-orchestrator/BACKLOG.md` (messaging).

## Notes

Overlaps the Kialae backlog item; check it is not built twice.
