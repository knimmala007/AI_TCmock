# 0010. Three seller certifications: only the seller session may state them

Status: accepted (Oct 25 2026), from ticket 025 (the attestation half). Options: `.scratch/options/025-attestation-fields.md`. The ticket stays `todo`.

## Context
`HUMAN_ATTESTATION_REQUIRED` is a status code, but nothing said which fields it covers. `QUESTIONS` has no flag for signing or attesting, and no question is a signature; signatures are drawn on the forms from other facts. Three questions carry a "written seller certification" in their `why` text: `waterHeater`, `smokeAlarm`, `coDetector`.

A field the assistant may never fill would stay unanswered. `rules.js` `pending()` is every askable, unanswered question, and a form is ready only when each askable question feeding it is answered, so `ask_next_question` would offer the field forever and WHSD and TDS would stay "Needs input".

## Decision
1. **Only the seller session may save `waterHeater`, `smokeAlarm` and `coDetector`.** The seller's chat answer is the statement; it is saved by `save_answers` with its source recorded as the seller's chat answer. Every other role (broker, buyer, lender) gets `HUMAN_ATTESTATION_REQUIRED`, since no one may state it on the seller's behalf.
2. **`ask_next_question` skips them for every role except the seller** and never counts them as candidates. For the seller they are normal questions. The browser's `nextQ()` and `pending()` are unchanged.
3. **Signature blocks on forms are never filled by the assistant.** The signature or certification itself is left to a person.
4. The list is a hand-picked constant in `backend/tools.js`, not a change to `rules.js`, `fixtures.js` or the extractor. Ticket 033 creates it (it needs it to skip the fields); ticket 039 enforces it. Move to an `attest` flag in `rules.js` only if the list grows.
5. `signer`, `treeStatus`, `seller` and everything else stay fillable.

## Proposed, not yet decided: form status and `flag_missing`
So forms do not stay "Needs input" forever, the agent's form status needs a third state: a form whose only missing items are these fields is "awaiting statement" (the seller has not answered) or "awaiting signature" (answered; a person has not signed), using the `awaiting_signature` lock reason from ADR 0007. It becomes "Ready" only when a person signs, which no tool does. `flag_missing` lists unanswered attestation fields as "awaiting seller". Tickets 040 and 041 carry this once confirmed.

## Amended Oct 28 2026 (ADR 0013, ticket 024): the lender's statement
`mark_clear_to_close` follows the same rule as the seller's certifications. The lender session's own statement counts as the attestation; it is recorded as `deal.loan.clear_to_close = {by: "lender", at}`. No button is needed and the tool does not return `HUMAN_ATTESTATION_REQUIRED` to the lender. The demo-mode limit below applies to it too.

## Demo-mode limit
In demo mode anyone can pick any role in the switcher, including seller (ADR 0006). The seller-only rule is therefore only as strong as the switcher: it stops the broker's, buyer's and lender's assistants from stating the certification, but it cannot prove that a real seller said it. A seller session's answer in the demo is not a real attestation. The rule becomes meaningful with real sign-in (R6, ticket 057). Code also cannot check that the model reported the seller's words faithfully; that is best effort, like the legal-advice guard.

## Consequences
- Tickets 033 (skip, constant), 034 (seller save with source), 039 (refusal), 040, 041, 052 change; 053's buyer acknowledgement is a normal tool write and is not on this list.
- Ticket 039 criterion 3 is reworded to match.
- The memo recommended refusing these fields for every role; that option is rejected because the seller could then never complete the forms in chat.
