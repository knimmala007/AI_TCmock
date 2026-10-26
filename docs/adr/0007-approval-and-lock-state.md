# 0007. Approvals, locks and the snapshot carry who and when

Status: accepted (Oct 25 2026), from ticket 023. Options: `.scratch/options/023-approval-and-lock-state-shapes.md`. The ticket stays `todo` until the spec and CONTEXT are updated.

## Context
`backend/status.js` reads `deal.approval.snapshot.forms`, `deal.locks[form].reason` and `deal.approvals[action] === true`, and nothing writes them. The shapes record neither the approver nor the time, and a `true` grant never expires.

## Decision
Option B: richer records at the same paths.
- `deal.approval.snapshot = {forms, approved_by, approved_at}`
- `deal.locks[FORM] = {reason, set_by, set_at}`; `reason` is `awaiting_signature` or `pending_approval`
- `deal.approvals[action] = {granted_by, granted_at, consumed?}`

Only server endpoints write these, through the repository, after re-checking that the signed session is the broker. No model-callable tool writes any of them.

`reopen_form` needs no prior grant. The broker's Reopen click is the approval for that action, as the spec says. Reopen removes the reopened forms from `snapshot.forms`, keeps the old snapshot in a `snapshot_reopened` event in `agent_events`, and clears the matching `freeze_snapshot` grant so the next freeze needs a new click.

## Reasoning
`guardWrite` reads only `.forms` and `.reason`, so it does not change. `guardAction` changes one line, from `=== true` to `Boolean(a && a.granted_at && !a.consumed)`. A grant that is consumed once used stops one approval from covering every later action. Who and when feed the audit page and the hand-off record (ADR 0011). Option C (one `workflow` object with history) moves every path `status.js` reads and is too large before ticket 037.

## Consequences
- `status.js` `guardAction` and the three `guardAction` assertions in `status.test.js` (about lines 63, 81, 82) change; fixtures using `true` change. This is the "only if ticket 023 requires" change in ticket 037.
- Approve (043) and Freeze/Reopen (046) must write the new shape.
- `reopen_form` stays in `APPROVAL_GATED_ACTIONS` as an action the endpoint checks, but needs no grant before the click. Review the list in `status.js:18` when 046 is built.
