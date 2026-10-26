# 0009. Each role sees its own side's stage

Status: accepted (Oct 25 2026), from ticket 025 (stages). Options: `.scratch/options/025-stages.md`. The ticket stays `todo` until the spec and CONTEXT are updated.

## Context
The app has two stage lists: `SELLER_STAGES` (six) and `BUYER_STAGES` (seven). Each deal holds both indices. The spec, CONTEXT and R4 say `get deal` returns "one of the six seller stages", which cannot cover the buyer or lender. The role filter has no stage logic.

## Decision
- Broker sees both stages.
- Seller sees the seller stage only. Buyer sees the buyer stage only.
- Lender sees no stage until the buyer stage is "Loan & Appraisal" (index 4). From then it follows the buyer's stage through to Closed. It does this only when the buyer is financing (the `buyerFinancing` answer "Yes, with a lender loan"). On an all-cash deal, or with the answer missing, the lender sees no stage.
- The lender's stage is derived from the buyer list in code; the lender gets no stage list of its own.
- The spec, CONTEXT and R4 wording becomes "the stage for the caller's side".

## Reasoning
This matches the app's existing views, never leaks one side's stage to the other, and reuses existing data. It differs from the memo's recommendation on one point: the memo showed the lender a "not yet at loan stage" note, and this decision shows nothing, which is a smaller disclosure.

## Consequences
- A per-role stage projection is added to the data filter (`roles.js`); that is new work for 031 and 051.
- The workflow panel (041) shows each role its own bar and needs a lender case.
- **`APPR` visibility is separate from the stage.** The lender sees `APPR` according to role scope and the buyer financing (the `buyerFinancing` answer adds `APPR`; an all-cash deal has none). The stage only drives the status line. R8 and the CONTEXT line "Lender sees only `APPR`" are reworded by ticket 025. Tests should check both rules independently.
