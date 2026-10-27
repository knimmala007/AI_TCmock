# 050: `ask_broker` hands a question to the broker
Status: review pending | Depends on: 031 | Owner: agent | Size: M

## What solving this does

Seller, buyer and lender can hand a question to the broker, which is also the polite refusal for legal or out-of-scope questions.

Files: create `backend/inbox.js`, `api/inbox.js`, `backend/tests/inbox.test.js` | modify `backend/tools.js`, `backend/config.js`, `api/agent.js`; `backend/runtime.js` and `backend/agent_handler.js` only to inject the inbox store | `index.html` removed (deferred to the broker Inbox view in `index_v2.html`).

## Scope

In: The tool, an inbox the broker can read.
Out: Replies by message (049).

## Acceptance criteria

1. The question is stored with the asking role and deal.
2. The broker sees it; other roles do not.
3. The broker cannot call the tool.
4. A question over `INBOX_QUESTION_MAX_CHARS` (2000) and a question for a deal already holding `INBOX_ITEMS_PER_DEAL_MAX` (50) items are each refused with fixed text that does not echo the question (provisional codes `QUESTION_TOO_LONG`, `INBOX_FULL`: none of the ten status codes fits).

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; `.claude/CONTEXT.MD` Tools.

## Notes

Destination decided in ticket 024.

## Mutation checks (run, then restored)

Test file: `backend/tests/inbox.test.js`. Restored from copies of my own uncommitted files, because `git checkout` would have reverted the ticket's work.

| Mutation | Caught by |
|---|---|
| a. `inbox.js`: remove the inbox write | 5 tests (stored item, broker count, other-deal, endpoint items, query test) |
| b. `inbox.js`: asking role from the tool arguments | stores-with-role-and-deal test |
| c. `inbox.js`: deal id from the tool arguments | stores-with-role-and-deal test |
| d. `inbox.js`: question text in the broker's get_deal summary | never-the-text test, no-model-request test |
| e. `tools.js`: inbox key for every role | no-inbox-key test |
| f. `roles.js`: ask_broker added to the broker's list | broker-cannot-call test |
| g. `inbox.js` handler: remove the broker-only check | 403 test, query/body test |
| h. `inbox.js` handler: role from the query | 401/tamper test, query/body test |
| i. `inbox.js` handler: deal id from the query | query/body test |
| j. `inbox.js`: remove the question length check | over-limit test |
| k. `inbox.js`: remove the full-inbox check | full-inbox test |
| l. `inbox.js` handler: remove the rate-limit check | rate-limit test |

Mutations j to l: the modified files were copied first and restored from the copy, verified with `diff`.

Known gap: the "question in no stored event" test is marked `todo`; model_call events already carry the asker's own tool_use input (ticket 064).
