# 050: `ask_broker` hands a question to the broker
Status: todo | Depends on: 031 | Owner: agent | Size: M

## What solving this does

Seller, buyer and lender can hand a question to the broker, which is also the polite refusal for legal or out-of-scope questions.

Files: create `backend/inbox.js`, `backend/tests/inbox.test.js` | modify `backend/tools.js`, `index.html`

## Scope

In: The tool, an inbox the broker can read.
Out: Replies by message (049).

## Acceptance criteria

1. The question is stored with the asking role and deal.
2. The broker sees it; other roles do not.
3. The broker cannot call the tool.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; `.claude/CONTEXT.MD` Tools.

## Notes

Destination decided in ticket 024.
