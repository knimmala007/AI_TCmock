# 016: Broker sees every document on both sides
Status: done | Depends on: 004, 013 | Owner: agent | Size: S

## What solving this does

The broker's document filter now matches what CONTEXT says: every document, seller side, buyer side and shared. The page and the agent registry follow one rule.

Files: modify `backend/roles.js`, `backend/tests/roles.test.js`, `index.html` (`canAccess`, one line), the spec | create `backend/tests/permission.test.js`

## Scope

In: Broker visibility; a parity test between the page and the registry; audit and eval viewers unchanged.
Out: The seller view banner (left as is).

## Acceptance criteria

1. The broker sees all 44 documents, including the appraisal.
2. Seller and buyer visibility is unchanged.
3. The audit and eval viewers still see nothing.
4. The page and `roles.js` give broker, seller and buyer identical documents.
5. Only the Broker view and the Permission isolation audit table render differently; Test Lab, Agent, Files, Seller, Buyer, Audit and Eval render the same.

## Tests

handler/shared rules: `permission.test.js` runs the app's real script against a stub DOM.

## Sources

`.claude/CONTEXT.MD` "Roles"; `.scratch/role-based-chat-agent/spec.md` Tools.

## Notes

Ask Ethan to confirm nobody else is changing `canAccess` before this is committed or merged (ticket 019).
