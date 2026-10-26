# Options memo 025 (decision 1): what each role sees for the deal stage

Saved Oct 25 2026 from a read-only subagent memo. Decision: ADR 0009.

## Facts
- `SELLER_STAGES` has six entries (Listing Signed, Disclosures, Offer Accepted, Inspection, Escrow, Closed). `BUYER_STAGES` has seven (Pre-Approval, Offer, Accepted, Inspection, Loan & Appraisal, Escrow, Closed). `backend/fixtures.js:3-18`, `index.html:1225-1226`.
- Each deal holds both indices. Cottage Grove: `seller_stage` 5, `buyer_stage` 6 (`fixtures.js:966-967`). Austin: 1 and 0 (`fixtures.js:1075-1076`).
- The app shows the seller bar in the seller and broker views (`index.html:1285,1309`) and the buyer bar in the buyer view (`:1318`). No lender view exists.
- `roles.js:11-16`: broker gets `get_deal`; the others get `get_deal_status`. The role filter (`roles.js:22-47`) covers documents only; the lender is a special case (`:26-28`, `APPR`).

## Docs and code disagree
Spec line 149, `CONTEXT.MD:390` and R4 say `get deal` returns "one of the six real seller stages". The buyer list has seven, and buyer and lender use `get_deal_status`. Not resolvable by that wording.

## Options
1. Side-matched lists: broker both, seller seller-list, buyer buyer-list, lender a loan-step view. Matches the UI; forces a decision on the lender's content and a two-stage broker response.
2. One shared six-stage list: matches the spec text, keeps `get_deal` single-valued, but drops the buyer's Pre-Approval and Loan & Appraisal; the buyer then disagrees with their own UI.
3. Option 1 with the lender derived from the buyer list (read-only slice from Loan & Appraisal to Closed). Reuses data; the boundary is invented until the owner confirms it.

Recommendation: option 3.

## If wrong
- `roles.js` has no stage logic; options 1 and 3 need a per-role stage projection.
- Leaving "one of six seller stages" gives the buyer the wrong list; a seller index read against the buyer list is off by one from index 3 on.
- With no lender rule, `get_deal_status` for the lender returns nothing or data it must not see.
- 031, 039 and 041 depend on this decision.
