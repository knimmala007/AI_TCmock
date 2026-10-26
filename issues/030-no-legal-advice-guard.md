# 030: No-legal-advice guard
Status: todo | Depends on: 027d | Owner: agent | Size: M

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
