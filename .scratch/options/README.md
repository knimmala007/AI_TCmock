# Options memos and the tickets their decisions change
> The 050 row below is superseded by ADR 0008 as amended on 2026-10-27 (the inbox is its own store, not on the deal file).

Decided Oct 25 2026. No ticket is marked done. Each ticket 023-026 stays `todo` until its spec/CONTEXT edits are made.

| Memo | Decision record |
|---|---|
| 023-approval-and-lock-state-shapes.md | docs/adr/0007-approval-and-lock-state.md |
| 024-tool-signatures.md | docs/adr/0008-tool-envelope-and-next-question.md |
| 025-stages.md | docs/adr/0009-stages-per-role.md |
| 025-attestation-fields.md | docs/adr/0010-attestation-fields.md |
| (hand-off, no memo) | docs/adr/0011-handoff-record.md |
| 026-audit-log-shape.md | docs/adr/0012-audit-log-keep-agent-events.md |

## Tickets that change

| Ticket | What changes | Source |
|---|---|---|
| 023, 024, 025, 026 | Their spec and CONTEXT edits (Files lines) are still to do: spec lines about "one of six stages" (~149), the Tools section, open items 1 and 2, R4, Q-c | all |
| 031 `get_deal` | Returns the envelope; stage depends on role (broker both, others own side); lender stage rule; no inherited stage list | 0008, 0009 |
| 033 `ask_next_question` | New unblock-count function in `rules.js`. Files line fixed Oct 25. Creates the attestation constant. Skips attestation fields for non-sellers | 0008, 0010 |
| 034 `save_answers` | Envelope and per-fact array; whole-batch refusals; seller's attestation answer saved with its source | 0008, 0010 |
| 036 batch cap | Cap of 15 is a whole-batch `BAD_ARGS`-style refusal; confirm the code | 0008 |
| 037 write refusals | Exercises the new `status.js` `guardAction`; the "only if 023 requires" change is now required | 0007 |
| 039 attestation | Owns the constant. AC3 reworded Oct 25: seller-only save; others get `HUMAN_ATTESTATION_REQUIRED` | 0010 |
| 040 `flag_missing` | Lists unanswered attestation fields as "awaiting seller" | 0010 |
| 041 workflow panel | Per-role bar; lender case; "awaiting statement/signature" form states | 0009, 0010 |
| 043 approval + Approve | Writes `{granted_by, granted_at}`; marks grants consumed; records the hand-off `{from,to,forms,at,approval}`; writes approval events to `agent_events`. ACs 6 to 8 added Oct 25 (record, no chat history, release stays separate) | 0007, 0011, 0012 |
| 046 freeze + Reopen | Snapshot with `approved_by/at`; Reopen needs no prior grant; `snapshot_reopened` event; clears freeze grant | 0007 |
| 047 release forms | Stays separate from hand-off (ADR 0011); decides the shape of the released list | 0011 |
| 048, 049 buttons | Write the new grant shape | 0007 |
| 050 `ask_broker` | Returns `{ticket_id, status:"queued"}`; inbox on the deal file | 0008 |
| 051 status/explain (other roles) | Stage per role; `explain_form` from DOCS metadata; `ROLE_FORBIDDEN` for filtered codes; sees hand-off note only | 0008, 0009, 0011 |
| 052 seller intake | Seller states attestation fields; forms show "awaiting signature" | 0010 |
| 053 buyer acknowledges | The buyer's acknowledgement is not on the attestation list; confirm it is a normal tool write | 0010 |
| 054, 055 lender | Lender stage follows the buyer's only when financing; no stage before "Loan & Appraisal" | 0009 |
| 059 platform audit log | Stays blocked until Karthik answers | 0012 |
| 061, 060 | No change | |
