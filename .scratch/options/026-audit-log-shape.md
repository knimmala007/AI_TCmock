# Options memo 026: shape of the platform audit log

Saved Oct 25 2026 from a read-only subagent memo. Decision: ADR 0012.

## Verified facts
- `api/_lib/store.js` is not in this repo. `api/` holds `demo-session.js`, `events.js`, `health.js`. `git branch -a` shows only `feature/backend-agent`, `main`, `origin/main`; a history search for `function audit` found nothing. The platform `audit()` shape is unknown (R7, Q-a).
- Its only description is `agents/00-orchestrator/BACKLOG.md:20`: `audit()` "partly exists", shown to the legacy AI Agent role, target broker-only, gaps marked TODO.
- Our row (`events.js:62-65`): `ts, session_id, turn_id, role, transaction_id, event_type, payload`, keyed by turn (`events.js:51-54`). `event_type` is a closed set of four model/tool types (`events.js:10`).
- The audit page reads only through `eventLog.eventsForTurn` (`events_page.js:33`) and filters by `transaction_id` (`:34`).
- No Approve or button endpoint exists (R14), so nothing writes "who approved what" yet; ticket 026 AC3 cannot be answered from code.

## Options
1. Keep `agent_events` only (Upstash). Cheap, tested, broker-gated; but a second trail, and approvals live in two places.
2. Mirror: keep `agent_events` and also call the platform `audit()` for human-meaningful entries (approvals, button actions, handoffs), not model-call noise. One broker-visible trail plus our debug detail; needs the platform's access route; logs can drift.
3. Adapt `agent_events` to the platform shape: make the platform log the sink behind `store.append/list` (the seam `events.js:5` names). One trail; model/tool payloads may not fit, and per-turn listing may be unsupported.

Recommendation: option 2, with option 1 as the fallback until the owner answers.

## If wrong
- Option 3 and no listing by `turn_id`: `eventsForTurn` and the events page return nothing; `events_page.test.js` breaks.
- Platform requires fields we lack: `logEvent` (`events.js:60`) fails on every model call.
- Option 1 while the platform trail is the real one: R14's button endpoints write only to ours; ticket 059 needs rework.

## Unknowns
1. Entry fields (who, role, what, when; a free-form detail field?).
2. Where entries live and whether Vercel functions can reach them from this repo.
3. Whether this repo may write or only read.
4. Whether Approve and the button endpoints should write there, and whether role names match ours.
5. Retention and size limits; whether it filters by deal.

No disagreement found between docs and code.
