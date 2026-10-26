# 038: Untested jurisdictions decline with no rules
Status: todo | Depends on: 034 | Owner: agent | Size: M

## What solving this does

For a city or county outside the tested list, the assistant gives no rules and says a transaction coordinator should confirm.

Files: modify `backend/tools.js` | create `backend/tests/tools_jurisdiction.test.js` | reference `backend/config.js` (`isTestedJurisdiction`)

## Scope

In: A decline payload with no rule content, and the reply.
Out: Adding jurisdictions.

## Acceptance criteria

1. Cottage Grove (San Jose) proceeds.
2. Austin returns the decline payload with no rules in it.
3. The reply tells the user a transaction coordinator should confirm.
4. Accent differences do not matter.

## Tests

handler: both deals.

## Sources

`.scratch/role-based-chat-agent/spec.md` Guardrails; `backend/reminders.md` R5; ADR 0002.

## Notes

Fixes the original SF/LA/Berkeley/Oakland misfire.
