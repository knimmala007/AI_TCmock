# Glossary

Domain language for the role-based chat agent. Use these terms exactly; avoid the listed synonyms.

**Transaction**
One real-estate deal, identified by a `transaction_id`. A chat session is bound to exactly one transaction, once. The model can never substitute another.
_Avoid_: deal (in code), case, file.

**Deal file**
The persisted record of a transaction's state (fields, forms, stage, answers). The single source of truth. Agents read and write it only through tools.
_Avoid_: chat history, memory.

**Role**
One of Broker, Seller, Buyer, Lender. It comes from the server-side session and is never taken from chat text or the request body. It decides the allowed tools and the data filter.

**Role registry**
Mapping of role → allowed tools → data filter. Applied before the model sees anything.

**Agent loop**
Plan, call a tool, read the result, repeat. Ends when the answer is ready or a turn limit is hit.

**Turn limits**
Per user turn: 8 model calls, 20 tool calls. A `save_answers` batch holds up to 15 facts. A repeated identical call is allowed twice, then the turn stops. When any is hit, the agent says so plainly.

**Tool layer**
The only code path from the model to deal data. Enforces role scoping, the jurisdiction check and the field-name guard.

**Broker tools**
get_deal, save_answers, ask_next_question, flag_missing, request_approval, hand_off. `save_answers` saves and validates in one call (it absorbed fill form and check state/county rules).

**Status code**
What `save_answers` reports about a fill: MISSING_FACT, INVALID_VALUE, FACT_CONFLICT, ROLE_FORBIDDEN, FORM_NOT_REQUIRED, LEGAL_JUDGMENT, POST_APPROVAL_CHANGE, FORM_LOCKED, HUMAN_ATTESTATION_REQUIRED, APPROVAL_REQUIRED.

**Approval-gated action**
An action that reaches another party or changes a locked package: hand_off, releasing forms to a buyer or lender, freezing the final snapshot, messaging a seller/buyer/lender, waiving a form or overriding a refusal, any change after approval. Only hand_off is a tool (it returns APPROVAL_REQUIRED without broker approval); the others are broker UI buttons, with no tool the model can call.

**Rules module**
`rules.js` at the repo root: the intake rules engine shared by `index.html` and Node, so the agent runs the same code as the UI.

**Audit log**
The broker-only page (`/api/events`, opened by the Audit log button in the broker view) listing a turn's agent events. The endpoint re-checks the session role; seller, buyer and lender are refused.

**Demo session**
The signed cookie set by `/api/demo-session` when the UI's role switcher picks one of the four roles. The agent reads the role only from it. Every switch starts a new session. A stand-in for real sign-in; separate from `DEV_FAKE_AUTH`.

**Chat thread**
The last 20 messages for one deal, session and role, kept in Upstash with a one-day expiry. Context for the conversation only, never a source of facts.

**Agent event**
One row in the `agent_events` table, written by `log_event` before and after each model call and around each tool execution.

**Tested jurisdiction**
A city/county on the configured list that one of the app's own CASES exercises (San Jose, San Francisco and Los Angeles, each with its county). "Tested" does not mean a real deal verified it. Anything else is an **untested jurisdiction**: the tool returns a decline payload and the agent flags that a transaction coordinator should confirm.

**Blocking question**
An unanswered intake question that prevents one or more forms from being filled.

**Unblock count**
The number of forms a blocking question would unblock. "Ask next question" returns the one with the highest count, chosen in code; the model only phrases what the tool returns.

**Draft form**
A form filled by the agent and saved as a draft. It reaches other parties only after the broker approves it (`request_approval`).

**Missing field**
A required fact absent from the deal file. It is flagged, never guessed or invented.

**Stage**
One of the six real seller-side stages: Listing Signed, Disclosures, Offer Accepted, Inspection, Escrow, Closed. `get_deal` returns it; the UI decides how to display it.

**Fixture file**
`backend/fixtures.js`: the one shared file, a generated ES module (agent and evals) holding the real Cottage Grove deal (`TX-CG118`), the real form codes, the intake questions and the synthetic Austin deal. Generated from `index.html`; never hand-edited.

**Never received**
A fact the transaction never obtained (for Cottage Grove: `permitHistory` and `tenancyStatus`). Taken from the app's Files-tab logic.

**Seen field names**
The set of field names that appeared in earlier tool results in this session. Any lookup with a `field_name` outside that set is rejected with an error listing the valid names.

**Repository module**
The single module that reads and writes deal data. The mock JSON-backed version is a stand-in, to be replaced by the real backend client (see `backend/reminders.md`).

**Stand-in**
Anything temporary (the JSON deal store, the demo session, local JSONL event log). Every stand-in is listed in `backend/reminders.md`.

**SYNTHETIC**
Label on any mock data not taken from the real closed transaction (118 Cottage Grove Ave).
