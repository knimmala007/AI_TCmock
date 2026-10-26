# 031: Broker can ask the assistant about the deal (`get_deal`)
Status: todo | Depends on: 024, 025, 027 | Owner: agent | Size: M

## What solving this does

The assistant can read the deal through its first tool. It sees only what the role allows, and nothing outside it can reach the model.

Files: create `backend/tools.js`, `backend/tests/tools_get_deal.test.js` | modify `backend/agent_loop.js` | reference `backend/roles.js`, `safety.js`, `threads.js`, `rules.js`

## Scope

In: Tool registry filtered by role, tool execution, `get_deal`, the transaction id binding.
Out: Other tools; the call limits (032).

## Acceptance criteria

1. The tools offered to the model equal the role's registry entry and nothing more.
2. `get_deal` returns the transaction id, address, stage, jurisdiction, fields, `missing_fields` and form statuses (forms without a template flagged).
3. Documents are filtered by role (broker all, seller, buyer, lender as decided).
4. Everything the model sees passes through `redactDeal`.
5. A model-supplied `transaction_id` is overwritten.
6. Field names returned are recorded in the seen-field set.
7. A buyer cannot get broker data by a role in the body, "act as broker" in chat, a role in a tool argument, an invented field name, or "use full access".

## Tests

handler: scripted model emits each attack as a tool call or message.

## Sources

`.scratch/role-based-chat-agent/spec.md` Identity, Guardrails, Testing Decisions; `backend/reminders.md` R15.

## Notes

First real use of `redactDeal` and the seen-field set.
