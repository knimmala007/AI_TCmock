# 055: Lender marks clear to close
Status: todo | Depends on: 051, 054 | Owner: agent | Size: M

## What solving this does

The lender can mark the deal clear to close, which updates the loan step.

Files: modify `backend/tools.js`, `backend/repository.js` (if a field is needed) | create `backend/tests/tools_lender.test.js`

## Scope

In: `mark_clear_to_close`.
Out: A loan checklist (060).

## Acceptance criteria

1. Only the lender can call it.
2. It records who and when.
3. It cannot touch any form other than the appraisal.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Tools; `.claude/CONTEXT.MD` Tools.

## Notes

Decided in ticket 024 (ADR 0013): records `deal.loan.clear_to_close = {by: "lender", at}`; no stage change and no stage gate; `FORM_NOT_REQUIRED` only when `APPR` is not required; a repeat is idempotent (`ok: true`, `already: true`, original time, no write). The lender session's own statement counts as the attestation (ADR 0010), with the demo-mode caveat (ticket 057).
