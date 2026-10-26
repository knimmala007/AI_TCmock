# 003: Shared fixtures from the real deal
Status: done | Depends on: 001 | Owner: agent | Size: M

## What solving this does

One generated file holds the real Cottage Grove deal, the real form codes and the intake questions, shared by the agent and the evals. No document code is invented.

Files: create `backend/fixtures.js` (generated), `backend/scripts/extract_fixtures.js`, `backend/tests/fixtures.test.js` | reference `index.html`, `rules.js`

## Scope

In: The real deal `TX-CG118`, the 44 form codes (42 with an executed PDF), the never-received fields, the synthetic Austin deal, the six real seller stages.
Out: Real backend data.

## Acceptance criteria

1. 44 form codes; 42 have an executed PDF; `POOL` and `SOLAR` have none.
2. `TX-CG118` is real and closed; `permitHistory` and `tenancyStatus` were never received.
3. `tx_unknown_city` is marked synthetic.
4. A test fails when `index.html` DOCS drift from the fixture.

## Tests

shared rules: `fixtures.test.js`.

## Sources

`.claude/CONTEXT.MD` "Fixtures"; `backend/reminders.md` R2; ADR 0003.

## Notes

Regenerate with `node backend/scripts/extract_fixtures.js` whenever `index.html` DOCS or the questions change.
