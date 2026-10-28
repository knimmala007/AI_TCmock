# 0011. A hand-off shows the next role only released forms and a note

Status: accepted (Oct 25 2026). It came out of the discussion of ticket 025; it has no ticket of its own and is carried by ticket 043. The memos under `.scratch/options/` do not cover it.

## Context
`hand_off` is the only gated action that is a tool, and it returns `APPROVAL_REQUIRED` until the broker approves. Nothing said what the next role receives, or what is recorded.

## Decision
- The next role sees only the forms released to it, plus a note of who handed off and when. It sees no chat history.
- Each hand-off is recorded on the deal as `{from, to, forms, at, approval}`, appended to `deal.handoffs`. `approval` is the grant that allowed it (`granted_by`, `granted_at`, from ADR 0007). The latest entry for a role is what that role is shown.
- The grant is marked `consumed` when the hand-off is recorded, so one approval covers one hand-off.
- **Release and hand-off stay separate.** Release is access (which forms a role may see; the Release forms button, ticket 047). Hand-off is assignment (whose turn it is). For a buyer or lender recipient, every form in `forms` must already be released to that role; otherwise `hand_off` is refused. The released list never widens a role's access beyond `roles.js`.

## Amended Oct 28 2026 (ADR 0013, ticket 024)
- `hand_off` is assignment only. It appends the record and uses up the grant; it changes no access, form, stage or lock.
- The seller as recipient needs no release (this closes the open question below). A buyer or lender does.
- A release never widens **write** access: `save_answers` stays decided by `canAccessForm`. Read access may be widened only through `deal.delivered[role]`, a list written only by the broker's Release click (a human action on the server, never a model-callable tool, never by `hand_off`). Delivery is read access only.
- **Open, to be decided in ticket 047's plan:** which seller-side forms may be delivered to a buyer, and whether the buyer sees the full content or a receipt (that the form was delivered, not its content). The shape of `deal.released` is also 047's call.

## Reasoning
Chat threads are already keyed by deal, session and role (`threads.js`) and every role switch starts clean, so "no chat history" is the existing rule written down. The record reuses the who-and-when fields of ADR 0007. Keeping access and assignment apart means a hand-off cannot quietly grant access, and a release is not a claim that anyone is working on it.

## Consequences
- Ticket 043 writes the record and checks the release (criteria 6 to 8). Release is built in 047, which depends on 043, so until 047 exists a hand-off to a buyer or lender is refused. That is intended but means the broker-to-buyer hand-off cannot be demonstrated before 047.
- The shape of the released list on the deal is not decided. Ticket 047 decides it (one list per role is the assumption); 043 reads it through one function so the shape stays in one place.
- Whether a seller as recipient needs releases is not decided; the rule above covers buyer and lender only.
