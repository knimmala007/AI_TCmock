# 027d: Four per-role system prompts
Status: review pending | Depends on: 027c | Owner: human | Size: S

## What solving this does

Each role's assistant gets its own prompt: what it may do, how it sounds, and how it declines. The owner owns the content, because the wording sets how the assistant behaves with real people.

Files: create `backend/prompts.js`, `backend/tests/prompts.test.js` | modify `backend/agent_handler.js` (replace the placeholder `SYSTEM_PROMPT`) | reference `backend/roles.js`

## Scope

In: Broker, seller, buyer and lender prompts; choosing the prompt from the session's role.
Out: Any enforcement, which stays in code. (The legal-advice prompt rule is in the shared CORE text; ticket 030 adds only the code guard.)

## Acceptance criteria

1. There is one prompt each for broker, seller, buyer and lender, and the role is chosen from the session only.
2. Prompts refer to tools generically; the tools offered to each role come from the registry (`backend/roles.js`). Reason: naming tools that are not yet offered makes the model try to call them.
3. Each prompt sets the role's tone.
4. Each prompt tells the assistant to refuse out-of-scope questions politely and to hand them to a person where a tool exists for it.
5. Each prompt tells the assistant to never guess a missing fact and to flag it instead.
6. Each prompt says plainly that the prompts are guidance and enforcement stays in code (roles, guards, limits), so the assistant does not treat the prompt as a permission.
7. The owner has written or approved the wording.

## Tests

handler: every role has a prompt, chosen from the session only; each prompt holds only its own role section; an unknown role has no prompt; no key or secret in any prompt. Scripted fake model, no real model call.

## Sources

`.scratch/role-based-chat-agent/spec.md` Behaviors and Guardrails; ADR 0002; `backend/reminders.md` R21; ticket 027.

## Notes

An agent drafts only if the owner asks; the content is the owner's. Ticket 030 adds the legal-advice rules to these prompts, so it depends on this one.
