# 027d: Four per-role system prompts
Status: todo | Depends on: 027c | Owner: human | Size: S

## What solving this does

Each role's assistant gets its own prompt: what it may do, how it sounds, and how it declines. The owner owns the content, because the wording sets how the assistant behaves with real people.

Files: create `backend/prompts.js`, `backend/tests/prompts.test.js` | modify `backend/agent_handler.js` (replace the placeholder `SYSTEM_PROMPT`) | reference `backend/roles.js`

## Scope

In: Broker, seller, buyer and lender prompts; choosing the prompt from the session's role.
Out: The legal-advice rules (030); any enforcement, which stays in code.

## Acceptance criteria

1. There is one prompt each for broker, seller, buyer and lender, and the role is chosen from the session only.
2. Each prompt names that role's allowed tools, as listed in `backend/roles.js`, and no other role's tools.
3. Each prompt sets the role's tone.
4. Each prompt tells the assistant to refuse out-of-scope questions politely and to hand them to a person where a tool exists for it.
5. Each prompt tells the assistant to never guess a missing fact and to flag it instead.
6. Each prompt says plainly that the prompts are guidance and enforcement stays in code (roles, guards, limits), so the assistant does not treat the prompt as a permission.
7. The owner has written or approved the wording.

## Tests

shared rules / handler: every role has a prompt; each prompt names only its own role's tools; an unknown role has no prompt. No model call.

## Sources

`.scratch/role-based-chat-agent/spec.md` Behaviors and Guardrails; ADR 0002; `backend/reminders.md` R16; ticket 027.

## Notes

An agent drafts only if the owner asks; the content is the owner's. Ticket 030 adds the legal-advice rules to these prompts, so it depends on this one.
