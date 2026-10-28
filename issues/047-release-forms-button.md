# 047: Release forms button
Status: todo | Depends on: 043 | Owner: agent | Size: M

## What solving this does

The broker can release forms to the buyer or lender with a button. Nobody else can.

Files: create `api/release.js`, `backend/tests/release.test.js` | modify `index.html`

## Scope

In: The button and endpoint.
Out: Messages (049).

## Acceptance criteria

1. Release is refused for non-brokers.
2. Released forms become visible to the target role only.
3. It is audited.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes and approvals.

## Notes

No model tool exists for this.

Open design questions (decided in this ticket's plan, from ADR 0011 and 0013):
- The release click also writes `deal.delivered[role]`, the only way a seller-side form becomes readable by the buyer. It is a human action on the server, never a model-callable tool, never done by `hand_off`.
- Delivery grants read access only. Write access (`save_answers`) stays gated by `canAccessForm`.
- Which seller-side forms qualify for delivery to the buyer is open.
- Whether the buyer sees the full content or only a receipt (that the form was delivered) is open.
- The shape of `deal.released` (read by `releasedForms` in `approvals.js`) is open.
- Ticket 053 depends on this one.
