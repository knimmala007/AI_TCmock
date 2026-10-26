# Options memo 025 (decision 2): which fields only a person may attest

Saved Oct 25 2026 from a read-only subagent memo. Decision: ADR 0010. (The subagent called this "025a"; ADR 0011 uses 025a for the hand-off record.)

## What the code shows
- 27 intake questions in `rules.js:27`, copied into `backend/fixtures.js` by `backend/scripts/extract_fixtures.js`. Each has `k, g, q, type, why, fills`, sometimes `options`. No flag for signing or attesting. Types: `text` (13), `choice` (12), `doc` (2).
- No question is a signature. `sigBlock` (`index.html:493`, used at 545 and 575) draws signatures from other facts such as `DEAL.seller`.
- Candidates: `signer` (`rules.js:38`, a fact about who signs); `waterHeater`, `smokeAlarm`, `coDetector` (`rules.js:116-122`; `why` says the law requires a "written seller certification", `fixtures.js:804,819`); `treeStatus` (`rules.js:134`, a compliance statement).
- Signature-type forms in DOCS: `RCSD-S`, `ABA`, `BK-SIG` (`index.html:365,363,382`). Forms, not fields.
- `HUMAN_ATTESTATION_REQUIRED` is defined in CONTEXT:242, spec:134 and `status.js:10`; none say how a field is chosen. `status.js:5` says the tool decides it.
- Tickets 039 (AC3, "a field on the attestation list is never filled") and 053 depend on this list.

## Gap
The ticket says "signature fields" but none exist in `QUESTIONS`. The decision concerns the three certification questions and the signature blocks on forms.

## Options
1. Hand-picked constant (e.g. `ATTESTATION_KEYS`) checked in `save_answers`. Explicit, owner-readable, no generated file changes; a new question can be missed.
2. `attest:true` flag on the question in `rules.js`, carried into `fixtures.js`. Rule sits next to the question; but changes `rules.js` (loaded by the page), requires regenerating fixtures; both outside the ticket's Files line.
3. Rule by wording (e.g. `why` contains "certification"). Nothing to maintain; brittle (would flag `treeStatus`, miss `signer`).

Recommendation: option 1 now (three or four candidates only); move to option 2 if the list grows.

## If wrong
- Too broad: `save_answers` refuses facts the seller should give; `waterHeater`/`smokeAlarm` fill WHSD and TDS (`fixtures.js:808`), so `ask_next_question` keeps offering questions that can never be answered in chat.
- Too narrow: the model records a legal certification as a fact and no status stops it.
- Option 2 only: `rules.js` changes; `fixtures.js` regenerated; `fixtures.test.js` and `rules.test.js` may need updates.
