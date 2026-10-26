# 004: Four roles with their tools and data filters
Status: done | Depends on: 003 | Owner: agent | Size: S

## What solving this does

Exactly four roles exist (broker, seller, buyer, lender), each with its own tool list and document filter. Anything else is rejected.

Files: create `backend/roles.js`, `backend/tests/roles.test.js` | reference `backend/fixtures.js`

## Scope

In: Role registry, tool lists, document filter, rejection of unknown roles.
Out: Building the tools.

## Acceptance criteria

1. Tool lists match the spec for all four roles.
2. Names such as `constructor`, `__proto__` and `ai_agent` are not roles.
3. Seller and buyer see their own side plus shared documents; the lender sees only `APPR`.

## Tests

shared rules/registry unit tests (`roles.test.js`).

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; `.claude/CONTEXT.MD` "Tools".

## Notes

The broker's visibility was widened later (ticket 016).
