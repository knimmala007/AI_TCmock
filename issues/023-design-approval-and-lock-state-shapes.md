# 023: Design the approval and lock state shapes
Status: todo | Depends on: 018 | Owner: human | Size: M

## What solving this does

The owner decides exactly how approvals, locks and the approved snapshot are stored on a deal and who writes them. Every guard and every approval button depends on it.

Files: modify the spec, `.claude/CONTEXT.MD`, `backend/reminders.md` (Q-c) | create `docs/adr/0007-approval-and-lock-state.md` | reference `backend/status.js`

## Scope

In: A written design and sign-off.
Out: Building it (tickets 037, 043, 046).

## Acceptance criteria

1. The shape of `deal.approval.snapshot` (forms, who approved, when) is written with an example.
2. The shape of `deal.locks` (the reason values, such as awaiting signature and pending approval) is written with an example.
3. The shape of `deal.approvals` (per action) is written with an example.
4. It says which endpoint writes each, and that no tool the model can call writes any of them.
5. It says what Reopen does to the snapshot and to the audit trail.
6. Any change `status.js` needs is listed.
7. The owner has signed off.

## Tests

None (design).

## Sources

`backend/reminders.md` Q-c, Q-d; `.scratch/role-based-chat-agent/spec.md` Status codes and approvals; ADR 0002.

## Notes

The agent drafts a proposal for the owner to approve. Blocks 037, 043 and 046.
