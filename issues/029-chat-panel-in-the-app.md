# 029: Chat panel in the app
Status: todo | Depends on: 027 | Owner: agent | Size: M

## What solving this does

Each role view gets a chat box. A person types, sees the reply, and sees refusals and limits as plain messages. Switching roles starts a clean conversation.

Files: modify `index.html`, `api/agent.js` (add a history read) | create `backend/tests/chat_panel.test.js` | reference `backend/threads.js`

## Scope

In: The panel, send, show reply and recent history.
Out: Tool output formatting; the Lender view (054).

## Acceptance criteria

1. The panel starts a session as the viewer's role before sending (`syncDemoRole`).
2. Sending shows the reply.
3. A 401, 429 or 503 shows a plain message.
4. Switching roles clears the panel and shows no earlier turns.
5. No key or token is in the page.

## Tests

handler: render the panel for each role against the stub DOM; endpoint history read.

## Sources

`.scratch/role-based-chat-agent/spec.md` User stories 31 to 34, 49, 50; `.claude/CONTEXT.MD` Team split.

## Notes

The UI is Ethan's area: coordinate before changing layout.

029a done: the panel (`chatPanel`, `chatSend`, `chatResult` in `index.html`) is appended as a new card at the end of the broker, seller and buyer views; no existing markup changed. AC 1-5 are covered by `backend/tests/chat_panel.test.js`. Still open: the endpoint history read in `api/agent.js` (left out on the owner's instruction not to touch backend code in this session), so the panel shows only this page load's turns.
