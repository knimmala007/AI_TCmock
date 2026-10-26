# 030: No-legal-advice guard
Status: todo | Depends on: 027d | Owner: agent | Size: M

## What solving this does

The assistant refuses to give legal advice. A prompt rule and a code check on the reply both enforce it.

Files: create `backend/legal_guard.js`, `backend/tests/legal_guard.test.js` | modify `backend/agent_loop.js` | reference `backend/status.js`

## Scope

In: Prompt rule, fixed refusal, reply post-check, `LEGAL_JUDGMENT`.
Out: Guarantees: this is best effort.

## Acceptance criteria

1. The system prompt forbids legal advice and names the refusal.
2. A fixed refusal text is used, and it points to a person.
3. A reply that looks like legal advice is replaced by the refusal.
4. At least 15 adversarial prompts are covered.
5. Misses found later are added as tests.

## Tests

handler: scripted model returning advice-like replies; adversarial prompts.

## Sources

`backend/reminders.md` B1; `.scratch/role-based-chat-agent/spec.md` Guardrails; ADR 0002.

## Notes

Best effort, not a guarantee.
