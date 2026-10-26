# 014: Reword the "AI Agent" role as legacy
Status: done | Depends on: none | Owner: agent | Size: S

## What solving this does

The agent docs now say the old all-access "AI Agent" role is a legacy role being retired and that the chat assistant never uses a separate role.

Files: modify ten files under `agents/` | reference `.scratch/role-based-chat-agent/spec.md`

## Scope

In: Docs only, plus Lender rows and a decision-log entry.
Out: The Kialae code (ticket 061).

## Acceptance criteria

1. No unqualified "AI Agent" mention remains.
2. The decision is logged in `agents/00-orchestrator/decisions.md`.
3. Committed as a docs-only commit (c980d6d).

## Tests

None (docs).

## Sources

`backend/reminders.md` R13; `agents/00-orchestrator/decisions.md`.

## Notes

The real `scope.js` is not in this repo.
