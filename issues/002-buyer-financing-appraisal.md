# 002: Buyer-financing question gives the Lender the appraisal
Status: done | Depends on: 001 | Owner: agent | Size: S

## What solving this does

The intake now asks whether the buyer is financing. A financed purchase requires the appraisal (`APPR`), so the Lender has a form to see.

Files: modify `rules.js`, `index.html` (CASES), `backend/tests/rules.test.js` | create (regenerated) `backend/fixtures.js` | reference `backend/reminders.md` R8

## Scope

In: The `buyerFinancing` question; each of the five CASES answers it; assertions both ways.
Out: Any other rule.

## Acceptance criteria

1. "Yes, with a lender loan" adds `APPR`; "No, all cash" adds nothing.
2. All five CASES answer the question. Longford and Latenant gain `APPR` (31 to 32 and 34 to 35 forms). The other three and the Cottage Grove prefill (32 forms) are unchanged.
3. All five CASES still reach 100%.
4. Breaking the rule makes the Longford CASE fail.

## Tests

shared rules: five CASES plus a walk of the Cottage Grove prefill.

## Sources

`backend/reminders.md` R8; `.claude/CONTEXT.MD` "Lender and the appraisal".

## Notes

Before and after form sets were compared and recorded in the session.
