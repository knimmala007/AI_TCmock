# 030: No-legal-advice guard
Status: review pending | Depends on: 027d | Owner: agent | Size: M

## What solving this does

The assistant refuses to give legal advice. The prompt rule is already in the shared CORE text (027d); this ticket adds the code check on the reply.

Files: create `backend/legal_guard.js`, `backend/tests/legal_guard.test.js` | modify `backend/agent_loop.js` | reference `backend/status.js`

## Scope

In: Fixed refusal, reply post-check, `LEGAL_JUDGMENT` (the code guard only).
Out: The prompt rule, which CORE in `backend/prompts.js` already has.
Out: Guarantees: this is best effort.

## Acceptance criteria

1. A fixed refusal text is used, and it points to a person.
2. A reply that looks like legal advice is replaced by the refusal.
3. At least 15 adversarial prompts are covered.
4. Misses found later are added as tests.

## Tests

handler: scripted model returning advice-like replies; adversarial prompts.

## Sources

`backend/reminders.md` B1; `.scratch/role-based-chat-agent/spec.md` Guardrails; ADR 0002.

## Notes

Best effort, not a guarantee.
- Built in `backend/agent_handler.js`, not `backend/agent_loop.js` as the Files line says: the guard runs on the reply after the loop, so the loop is untouched. The guard itself is `backend/legal_guard.js` (`guardReply`, `legalRefusal`).
- A refusal response gains an additive field: `{reply, turnId, status: "LEGAL_JUDGMENT"}`. Ordinary replies are unchanged.
- The refusal points to a person in words only: "Please ask your broker." for seller, buyer and lender (they have `ask_broker`), a licensed attorney or tax advisor for the broker. The guard does not call a tool.
- The guard firing is not logged. Logging it belongs to ticket 062.
