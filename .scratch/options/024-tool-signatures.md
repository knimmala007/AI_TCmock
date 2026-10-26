# Options memo 024: tool signatures

Saved Oct 25 2026 from a read-only subagent memo. Decision: ADR 0008.

## Docs and code disagreements found
1. Ticket AC6 and the code take the first pending question (`nextQ(){ return pending()[0] }`, `rules.js:171`). Spec lines 109 and 183, ADR 0002 and CONTEXT say unblock count with a fixed tie-break. No code computes unblock count; `fills` per question (`rules.js:32`) is the data it needs.
2. ADR 0002 says limits live in `backend/config.py`; the file is `config.js` (`config.js:10-13`).
3. ADR 0002 dates the check order "Oct 25" and "confirmed Oct 26". Cosmetic.
4. The spec says "get deal"; `roles.js:10-13` says `get_deal`. Use the code spelling.
5. CONTEXT open items 2 and 5 still bound the tool outputs.

## Registry (`roles.js:9-14`)
- Broker: `get_deal`, `save_answers`, `ask_next_question`, `flag_missing`, `request_approval`, `hand_off`.
- Seller: `get_deal_status`, `explain_form`, `ask_next_question`, `save_answers`, `ask_broker`.
- Buyer: `get_deal_status`, `explain_form`, `acknowledge_disclosure`, `ask_broker`.
- Lender: `get_deal_status`, `explain_form`, `mark_clear_to_close`, `ask_broker`.

## Fixed whatever is chosen
- Deal id and role are never inputs; the orchestrator injects them (ADR 0002).
- `save_answers` takes `{answers: [{field_name, value}]}`, at most 15.
- Writes run `guardWrite` (`status.js:25`); gated actions run `guardAction` (`status.js:50`).
- `hand_off` returns `APPROVAL_REQUIRED` until `deal.approvals.hand_off` is set by the click.
- `request_approval` only records a pending request and tells the broker; the click grants.
- Forms with no template are flagged, never filled (R9).

## Option A: loose per-tool shapes
Refusals reuse `{error, message, next_step}` (`status.js:21`).
- Pro: least code now. Con: the loop special-cases every tool; role filtering easy to forget.
- If wrong: per-tool branching in the (unbuilt) loop; the seen-field set is fed inconsistently so the field-name guard has no data; role-filter tests pass on one tool and miss another.

## Option B: one uniform envelope
`{ok, data?, error?: {code, message, next_step}, field_names?}`. `code` is one of the 10 STATUS values plus transport errors (`UNKNOWN_TOOL`, `BAD_ARGS`, `UNKNOWN_FIELD`, `TURN_LIMIT`). Success carries `field_names`, fed to `seen.add` (`threads.js:39`).
- Pro: one loop path; one place for `redactDeal` and logging; guards attach to the envelope. Con: a small adapter around `guardWrite`'s output.

## Option C: strict per-fact results
`save_answers` returns an array of `{field_name, ok, code?}`.
- Pro: honest for batches. Con: partial saves complicate the repeated-call stop and approval locks; models misread mixed results.

## Recommendation: B, with C's per-fact array inside `save_answers`' `data`
- Role, required, snapshot or lock refusals reject the whole batch (per-form).
- `INVALID_VALUE`, `FACT_CONFLICT`, `MISSING_FACT`, `HUMAN_ATTESTATION_REQUIRED` are reported per fact.
- Untested jurisdiction returns an `ok: true` decline payload with no rules.
- `ask_broker` returns `{ticket_id, status: "queued"}`, writes an audit event and a broker-visible item in the deal file's inbox, never to the model.
- `explain_form` text comes from DOCS fixture metadata, no model-written law; a role-filtered code returns `ROLE_FORBIDDEN`; a code with no template returns a flag-only note.

## If wrong
- "First pending" for `ask_next_question` contradicts ADR 0002; tests would assert the wrong order and the model may be told to choose.
- `request_approval` setting the approval flag lets the model self-approve and bypasses `guardAction`.
