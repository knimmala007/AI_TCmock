# 0002. Guardrails are enforced in code, not only in the prompt

Status: accepted (Oct 21 2026)

## Context
The Evaluation tab showed a hand-built rules approach applying the wrong jurisdiction's rules. In testing, the model invented a field name (`school_district_disclosure`) and queried it as if it existed.

## Decision
These are enforced in the tool layer or orchestrator, so the model cannot skip them:
- **Role scoping.** The role comes from the server-side session and filters tools and data before the model sees anything.
- **Transaction binding.** The orchestrator overwrites any `transaction_id` the model passes.
- **Jurisdiction.** "Check state/county rules" computes `tested | untested` from a config list and returns a decline payload for untested jurisdictions.
- **Field names.** Lookups reject a `field_name` outside the set seen in earlier tool results, with an error listing valid names.
- **Next question.** Chosen in code by unblock count. The model only phrases what the tool returns.
- **No legal advice.** Two layers: a prompt rule, plus a code-level guard (fixed refusal template and a reply post-check). This is best-effort, not a guarantee.
- **Turn limits** (revised Oct 24): 8 model calls and 20 tool calls per turn, up to 15 facts per `save_answers` batch, and a repeated identical call stops after 2. All in `backend/config.js`.
- **Merged tool.** `save_answers` saves and validates in one call (it absorbed fill form and check state/county rules), so the jurisdiction check and field-name guard run inside it.
- **Missing facts.** Flagged, never guessed.

## Consequences
- Each guardrail needs a test that tries to break it.
- Prompts may describe the rules, but correctness never depends on the model obeying them (except the best-effort legal-advice layer, tracked in `backend/reminders.md`).
- **Status codes** (locked Oct 24, ten; the full table with next steps is in CONTEXT.MD and the spec): MISSING_FACT, INVALID_VALUE, FACT_CONFLICT, ROLE_FORBIDDEN, FORM_NOT_REQUIRED, LEGAL_JUDGMENT, POST_APPROVAL_CHANGE, FORM_LOCKED, HUMAN_ATTESTATION_REQUIRED, APPROVAL_REQUIRED.
- **Delegation** (Oct 25): ROLE_FORBIDDEN = the role may not touch it at all; FORM_NOT_REQUIRED = not part of this deal; POST_APPROVAL_CHANGE = an approved snapshot exists and the write would change it (broker reopens); FORM_LOCKED = locked for any other reason (wait); APPROVAL_REQUIRED = the action is gated and approval is missing (actions only, never form writes). The write check order is role, required, approved snapshot, lock (confirmed Oct 25). Implemented in `backend/status.js`.
- **Approval gate.** hand_off, releasing forms to a buyer or lender, freezing the final snapshot, messaging a seller/buyer/lender, waiving a form or overriding a refusal, and any change after approval need the broker's Approve click. Only hand_off is a tool (it returns APPROVAL_REQUIRED until then); the others have no tool and are broker UI buttons whose endpoints re-check the broker role. The model can perform none of them.
