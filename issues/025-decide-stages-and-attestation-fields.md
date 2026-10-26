# 025: Decide stages and attestation fields
Status: done | Depends on: 018 | Owner: human | Size: S

## What solving this does

The owner states what each role sees for the deal stage, and which fields only a person may attest.

Files: modify the spec, `.claude/CONTEXT.MD`, `backend/reminders.md` (R4, R8, R19, R20) | reference `backend/fixtures.js`, `index.html`

## Scope

In: Two short decisions.
Out: Building them.

## Acceptance criteria

1. It says which stages the seller, buyer and lender see (the app has six seller stages and seven buyer stages).
2. It lists the fields that need `HUMAN_ATTESTATION_REQUIRED` (signatures and legal declarations).

## Tests

None (decision).

## Sources

`backend/reminders.md` R4; `.scratch/role-based-chat-agent/spec.md` Status codes.

## Notes

Blocks 031, 039, 041.

Decisions are in ADRs 0009 (stages), 0010 (attestation) and 0011 (hand-off). Stale text this ticket must fix, then mark done:
- spec "one of the six real seller stages" (about line 149), `CONTEXT.MD` line about `get_deal` stages (about line 390) and R4: "the stage for the caller's side".
- `CONTEXT.MD` Still open item 5 and R8 ("the Lender sees only `APPR`"): `APPR` visibility follows role scope and the buyer financing; the stage drives only the status line.
- spec and `CONTEXT.MD`: the attestation list, the seller-only rule, and the hand-off record with release (access) kept separate from hand-off (assignment).
- `CONTEXT.MD` Demo mode: add the limit recorded in ADR 0010.
