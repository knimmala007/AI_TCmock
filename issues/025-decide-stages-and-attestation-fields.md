# 025: Decide stages and attestation fields
Status: todo | Depends on: 018 | Owner: human | Size: S

## What solving this does

The owner states what each role sees for the deal stage, and which fields only a person may attest.

Files: modify the spec, `.claude/CONTEXT.MD` | reference `backend/fixtures.js`, `index.html`

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
