# 0012. Keep agent_events; ask Karthik for the platform audit() shape

Status: accepted for the interim (Oct 25 2026), from ticket 026. Options: `.scratch/options/026-audit-log-shape.md`. The ticket stays `todo` until Karthik answers. Builds on ADR 0004.

## Context
The platform's `audit()` (`api/_lib/store.js` on the other branch) is not in this repo or any branch here, so its shape and access route are unknown.

## Decision
Keep `agent_events` (ADR 0004) as the only sink. Do not guess the platform shape. Ask Karthik the questions below. The leaning, once answered, is to mirror only human-meaningful entries (approvals, button actions, hand-offs) to the platform log and keep model/tool detail in `agent_events`. Ticket 059 stays blocked.

## Questions to ask Karthik
1. Please paste the `audit()` signature and one real stored entry. Which fields does it take: who, role, what, when? Is there a free-form detail or payload field, and what size limit?
2. Where do entries live (same Upstash, a different store, a table, a file), under which key or table name, and with whose credentials? Who sets them on Vercel?
3. May this repo call `audit()` or write to that store directly, or must it go through an endpoint? Is it read-only for us?
4. Can it list entries by deal and by turn, or only by deal? (Our page filters by `transaction_id` and lists by `turn_id`.)
5. Which role names does it use, and do they match broker, seller, buyer, lender? Does the legacy `aiagent` role still see the log?
6. Should the Approve and button endpoints (approve, release, snapshot, reopen, message, waive) write there? Which action names and what detail should an entry hold for "who approved what"?
7. What retention applies, and is the log append-only?

## Consequences
- 059 stays blocked. 043 and 046 write approval events to `agent_events` now, and keep the call in one place so a mirror can be added later.
- R7 and Q-a stay open, with these questions attached.
