# 0008. One envelope for every tool; next question chosen by unblock count

Status: accepted (Oct 25 2026), from ticket 024. Options: `.scratch/options/024-tool-signatures.md`. The ticket stays `todo` until the spec Tools section and CONTEXT open item 1 are updated.

## Context
No tool exists yet. The registry (`backend/roles.js`) lists names only. The spec and ADR 0002 say `ask_next_question` is chosen by unblock count; the browser's `nextQ()` takes the first pending question.

## Decision
1. Every tool returns one envelope: `{ok, data?, error?: {code, message, next_step}, field_names?}`. `code` is one of the ten status codes, or a transport code (`UNKNOWN_TOOL`, `BAD_ARGS`, `UNKNOWN_FIELD`, `TURN_LIMIT`). Success carries `field_names` for the loop to add to the seen set.
2. `save_answers` takes `{answers: [{field_name, value}]}`, at most 15, and returns a per-fact array in `data`. Role, required, snapshot and lock refusals reject the whole batch. `INVALID_VALUE`, `FACT_CONFLICT`, `MISSING_FACT` and `HUMAN_ATTESTATION_REQUIRED` are reported per fact. An untested jurisdiction returns `ok: true` with a decline payload and no rules.
3. Deal id and role are never inputs; the orchestrator injects them.
4. The next question is chosen in code by unblock count, in a new function in `rules.js`. The browser's `nextQ()` is unchanged. The tie-break is question order.
5. `ask_broker` returns `{ticket_id, status: "queued"}`, writes an audit event and an item in the deal file's broker inbox, and never delivers to the model. `explain_form` text comes from DOCS metadata; a role-filtered code returns `ROLE_FORBIDDEN`; a code with no template returns a flag-only note.
6. `request_approval` only records a request. It never sets an approval.

## Reasoning
One envelope gives the loop one failure path and one place for redaction, logging and the field-name guard. Per-fact results are the honest answer for a batch, while form-level refusals stay whole-batch because they are decided per form. Unblock count is computed from each question's `fills` (already in `rules.js`), so the browser keeps its simple order and the agent gets the better choice from the same module.

## Consequences
- The new `rules.js` function needs a test in `backend/tests/rules.test.js`. Ticket 033 lists `rules.js` only as a reference, so its Files line must change before it is built.
- ADR 0002's `config.py` should read `config.js`, and the spec and CONTEXT should use `get_deal` (the code spelling).
- `NOT_FOUND` (no deal file for the session) is an envelope tool error, not one of the ten status codes. It is provisional until the owner decides (`backend/tools.js`).
- A small adapter turns `guardWrite`'s `{error, message, next_step}` into the envelope.
