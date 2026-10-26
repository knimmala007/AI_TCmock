# Options memo 023: approval and lock state shapes

Saved Oct 25 2026 from a read-only subagent memo. Decision: ADR 0007.

## What the code reads today
- `guardWrite` reads `deal.approval.snapshot.forms` (`backend/status.js:34-35`) and `deal.locks[form].reason` (`:40-42`).
- `guardAction` reads `deal.approvals[action] === true` (`:52`).
- `status.test.js:25-82` builds fixtures in exactly these shapes.
- `status.js` defines no writers. The repository is the only writer of deal data.

## Findings
- ADR 0007 did not exist (the ticket creates it).
- `reopen_form` is in `APPROVAL_GATED_ACTIONS` (`status.js:18`), but the Reopen click is itself the approval. Nothing said whether a grant is needed first.
- ADR 0002 line 24 says the check order was "confirmed Oct 26"; the date is a likely typo.

## Option A: keep the current shapes
`approval.snapshot = {forms}`, `locks = {FORM:{reason}}`, `approvals = {action:true}`.
- Pro: no `status.js` change, tests stay green.
- Con: no approver or time, no history; a `true` grant never expires, so one hand_off approval allows every later hand_off.
- If wrong: `guardAction` passes forever after one click; 043 and 046 cannot show who approved or when.

## Option B: richer records at the same paths (recommended)
- `approval.snapshot = {forms, approved_by, approved_at}`.
- `locks.TDS = {reason, set_by, set_at}`; `reason` is `awaiting_signature` or `pending_approval`.
- `approvals.hand_off = {granted_by, granted_at, consumed?}`.
- Pro: `guardWrite` unchanged (reads only `.forms` and `.reason`); `guardAction` changes one line (`=== true` to `Boolean(a && a.granted_at && !a.consumed)`); supports one-shot grants and who/when on the audit page.
- Con: small `status.js` change plus test updates.
- If wrong: the three `guardAction` assertions (`status.test.js:63,81,82`) and any fixture using `true` break; 043 and 046 buttons must write the new shape.

## Option C: one `deal.workflow` object with append-only history
`{snapshot, locks, grants, history[]}`.
- Pro: cleanest audit trail; Reopen modelled as an event.
- Con: moves every path `status.js` reads, rewrites `status.js:34-52` and all of `status.test.js`; too large before 037.
- If wrong: `guardWrite` reading the old paths would silently pass everything.

## Who writes
Only server endpoints, through the repository, after re-checking the signed session is the broker: `api/approve.js` (043) writes `approvals`; `api/snapshot.js` (046) writes the snapshot and clears it on Reopen. The server sets locks on a state change (`request_approval` causes `pending_approval`, but server code writes it). No model-callable tool writes any of the three.

## Reopen
Remove the reopened forms from `snapshot.forms`; keep the old snapshot in a `snapshot_reopened` event in `agent_events`; clear the matching `freeze_snapshot` grant so the next freeze needs a new click.
