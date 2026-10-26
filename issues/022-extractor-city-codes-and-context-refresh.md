# 022: Extractor lists city-dependent codes; refresh the form-code notes
Status: done | Depends on: 002, 003 | Owner: agent | Size: S

## What solving this does

The fixture report also lists the form codes that only appear for certain cities when a unit is tenant-occupied, and two stale statements about form codes are corrected.

Files: modify `backend/scripts/extract_fixtures.js`, `.claude/CONTEXT.MD` (Fixtures), `backend/reminders.md` (R9) | reference `rules.js`

## Scope

In: The report; two doc corrections.
Out: Changing any rule or the fixture data.

## Acceptance criteria

1. The report includes `SF-RENT`, `LA-RSO`, `BK-RENT` and `OK-RAP`.
2. CONTEXT no longer says `APPR` is never produced by the rules.
3. R9 names `save_answers`, not `save_answer`.
4. The fixture file content is unchanged.

## Tests

shared rules: the existing fixture tests still pass; add a test for the report if practical.

## Sources

`backend/reminders.md` R9; `.claude/CONTEXT.MD` Fixtures.

## Notes

Found while resolving ticket 017.
