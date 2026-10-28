# 0004. Logging goes to one agent_events table

Status: accepted (Oct 24 2026). Supersedes the JSONL-per-session plan.

## Context
Every prompt, tool call and result must be logged for the audit trail and debugging.

## Decision
One `agent_events` log (`backend/events.js`) and one `logEvent` helper. Storage is injected: memory for tests, a JSONL file for local dev, Upstash lists (one per turn) when hosted; the platform's existing audit log is the intended sink once its shape is known. SQLite was dropped because the Vercel filesystem is not writable. It is called from three places: before and after each model call, and around each tool execution. Payloads are redacted (API keys) before writing. A broker-only page (the Audit log button in the broker view, `/api/events`) lists a turn's events via `eventsForTurn`; the endpoint re-checks the session role and refuses every other role.

## Consequences
- One place to read when debugging a turn.
- Event types are a closed set; an unknown type is rejected. The set is `model_call_start`, `model_call_end`, `tool_start`, `tool_end`, `turn_refused` (ticket 062) and `approval_granted` (ticket 043, written by the Approve endpoint with `{action, granted_by, granted_at, to, forms}` and its own turn id).
- The events page is built. The real audit-log sink is tracked as R7 in `backend/reminders.md`.
