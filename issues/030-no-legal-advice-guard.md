# 030: No-legal-advice code guard
Status: todo | Depends on: 027c | Owner: agent | Size: M

## What solving this does

The assistant refuses to give legal advice. A code check on the reply enforces it. The prompt-side rule belongs to the role prompts (027d), not to this ticket.

Files: create `backend/legal_guard.js`, `backend/tests/legal_guard.test.js` | modify `backend/agent_loop.js` | reference `backend/status.js`

## Scope

In: Fixed refusal, reply post-check, `LEGAL_JUDGMENT`.
Out (moved): The prompt rule, which is written in the role prompts (027d).
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
