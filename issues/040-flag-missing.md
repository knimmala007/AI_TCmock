# 040: `flag_missing` lists what is missing
Status: todo | Depends on: 024, 031 | Owner: agent | Size: S

## What solving this does

The assistant can list the facts still missing on the deal and never guesses them.

Files: modify `backend/tools.js` | create `backend/tests/tools_flag_missing.test.js`

## Scope

In: The tool and its output.
Out: Fixing the gaps.

## Acceptance criteria

1. It lists missing facts per form.
2. For Cottage Grove it includes `permitHistory` and `tenancyStatus` as never received.
3. It does not invent values.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Guardrails (missing facts); `.claude/CONTEXT.MD` Fixtures.

## Notes

Output shape comes from ticket 024.
