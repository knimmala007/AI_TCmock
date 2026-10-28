# 034: `save_answers` saves a fact
Status: done | Depends on: 033 | Owner: agent | Size: M

## What solving this does

The assistant can record an answer on the deal. The shared rules recompute the required forms, and the change is stored.

Files: modify `backend/tools.js` | create `backend/tests/tools_save_answers.test.js` | reference `rules.js`, `backend/repository.js`, `backend/fixtures.js`

## Scope

In: One fact through the rules engine, saved through the repository; forms added, removed and filled are returned.
Out: Guards (035 to 039); batches (036).

## Acceptance criteria

1. A valid answer is saved and survives a reload.
2. Derived values update (for example the county follows the city).
3. The response lists forms added, removed, filled and what is still missing.
4. Answering twice replaces the earlier answer.
5. Role and deal come from the session.

## Tests

handler: answer a case end to end; compare with shared rules.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; `.claude/CONTEXT.MD` Tools.

## Notes

This is the central write path; keep it small.
