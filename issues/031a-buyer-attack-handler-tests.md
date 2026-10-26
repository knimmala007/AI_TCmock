# 031a: Buyer-attack handler tests
Status: review pending | Depends on: 031 | Owner: agent | Size: S

## What solving this does

Proves through the handler that a Buyer session cannot reach broker or seller data, and that the role comes only from the cookie.

Files: create `backend/tests/` (new test file) only

## Scope

In: Tests only, through the handler seam, with a Buyer session.
Out: Any code change. If a test exposes a real leak, report it; do not fix it in this ticket.

## Acceptance criteria

With the scripted fake model, every case returns no broker or seller data, and the role comes only from the cookie:

1. The model calls `get_deal` (not in the Buyer registry).
2. The model puts `role: "broker"` or another deal id inside tool arguments.
3. The model asks for broker-only and seller-only forms.
4. The request body carries a role.

## Tests

handler: Buyer session, scripted fake model emits each attack as a tool call. Mutation check: break `canAccessForm`, then `redactDeal`, and show a test fails each time.

## Sources

Ticket 031 criterion 7; `.scratch/role-based-chat-agent/spec.md` Identity, Guardrails, Testing Decisions.

## Notes

If the mutation check shows a case no test catches, add the test. If a test exposes a real leak, stop and report it.
