# API contract

Written from `api/*.js` and the handlers in `backend/` they call. Where a file does not say, this page says "not specified". Rate-limit constants live in `backend/config.js`.

## Rules that hold for every endpoint

- **The page never holds a key or token.** The browser sends no API key, no bearer token and no session id in a body. The model key, the signing secret and the storage token exist only on the server.
- **The session is an HttpOnly cookie** named `session`, set by `POST /api/demo-session`: `Path=/; HttpOnly; SameSite=Strict; Max-Age=86400` (`SESSION_MAX_AGE_SECONDS`), plus `Secure` when the `VERCEL` environment variable is set. It is signed (HMAC-SHA256). Role, session id and deal id are read only from it. A body, query or header that names a role or deal is ignored.
- **Roles:** `broker`, `seller`, `buyer`, `lender`. A cookie with any other role is the same as no cookie (401).
- **Rate-limit key:** the first entry of `x-forwarded-for`, or `unknown`. Fixed one-minute window, counted per endpoint.
- **Response type:** JSON with `cache-control: no-store`, except `GET /api/events` (HTML page when allowed) and `GET /api/health` (no `cache-control` set).
- **Error messages are fixed text.** None echoes the request, a stack, an upstream body or a header.
- **`503 DEMO_NOT_CONFIGURED`** is returned by every endpoint except `health` when the runtime cannot start (for example `AGENT_SESSION_SECRET` or the Upstash settings are missing on Vercel). Body `{"error":"DEMO_NOT_CONFIGURED"}`, no message.
- **Provisional codes:** the transport-style HTTP codes below are not among the ten status codes. No source file calls an HTTP code provisional. `NOT_FOUND`, `NO_TEMPLATE` and `UNTESTED_JURISDICTION` are tool-envelope codes, not HTTP errors; `backend/tools.js` comments call them PROVISIONAL, while ADR 0008 (amendment) says they are no longer provisional. Docs and code disagree: not resolved here.

| Constant | Value | Used by |
| --- | --- | --- |
| `DEMO_SESSION_PER_MINUTE` | 10 | `/api/demo-session` |
| `CHAT_PER_MINUTE` | 20 | `/api/agent` |
| `APPROVE_PER_MINUTE` | 30 | `/api/approve` |
| `AUDIT_PAGE_PER_MINUTE` | 30 | `/api/events`, `/api/inbox`, `/api/history` (each its own bucket) |
| `DAILY_MODEL_CALL_CAP` | 500 | `/api/agent`, all callers together |

## POST /api/demo-session

- **Who:** nobody (no sign-in; this call creates the session). Rate limit `DEMO_SESSION_PER_MINUTE`.
- **Body:** `{"role": "broker|seller|buyer|lender", "deal": "<deal id>"}`. `deal` is optional and defaults to `TX-CG118`; it must be a seeded deal.
- **200:** `{"role": "<role>"}` and a `Set-Cookie: session=...`. Every call starts a new session id (a clean chat thread). The body holds no token.
- **Errors:**

| Status | Body | When |
| --- | --- | --- |
| 405 | `{"error":"METHOD_NOT_ALLOWED"}`, `allow: POST` | any method but POST |
| 429 | `{"error":"RATE_LIMITED"}`, `retry-after: 60` | over the limit |
| 400 | `{"error":"BAD_REQUEST"}` | body is not JSON |
| 400 | `{"error":"BAD_ROLE","message":"role must be broker, seller, buyer or lender"}` | role missing or not one of the four |
| 400 | `{"error":"BAD_DEAL"}` | unknown deal |
| 503 | `{"error":"DEMO_NOT_CONFIGURED"}` | no signing secret on Vercel, or runtime failed |

## POST /api/agent

- **Who:** any of the four roles (cookie). Rate limit `CHAT_PER_MINUTE`; also the `DAILY_MODEL_CALL_CAP`.
- **Body:** `{"message": "<non-empty string>"}`. Nothing else is read.
- **200:** `{"reply": "<text>", "turnId": "<uuid>"}`. When the legal-advice guard replaces the reply, also `"status": "LEGAL_JUDGMENT"`.
- **200 with a plain stop reply** (nothing saved to the thread, same shape): model-call limit ("I have reached the limit of steps I can take for one message. Please send a new message to continue."), tool-call limit ("I have reached the limit of tool calls I can make for one message. Please send a new message to continue."), repeated call ("I was repeating the same step without getting anywhere, so I stopped. Please rephrase your message or ask something else."). Per-turn limit values (`MODEL_CALLS_PER_TURN` 8, `TOOL_CALLS_PER_TURN` 20, `REPEATED_CALL_LIMIT` 2) are in `config.js`.
- **200 with a fallback reply:** "My answer was cut off before it was finished. Please ask again, or ask for a shorter answer." (max tokens) or "I could not put together an answer. Please try asking again." (empty).
- **Errors:**

| Status | Body | When |
| --- | --- | --- |
| 405 | `{"error":"METHOD_NOT_ALLOWED"}`, `allow: POST` | any method but POST (GET is wired to the same handler) |
| 503 | `{"error":"MODEL_NOT_CONFIGURED","message":"The assistant is not set up yet."}` | no model key configured |
| 503 | `{"error":"DEMO_NOT_CONFIGURED"}` | runtime failed to start |
| 429 | `{"reply":"You are sending messages too quickly. Please wait a minute and try again.","turnId":"..."}`, `retry-after: 60` | over `CHAT_PER_MINUTE` (no `error` field) |
| 429 | `{"reply":"The assistant has reached its daily limit of model calls. Please try again tomorrow.","turnId":"..."}` | daily cap hit (no `error` field, no `retry-after`) |
| 401 | `{"error":"UNAUTHENTICATED","message":"Pick a role first."}` | no valid session |
| 400 | `{"error":"BAD_REQUEST","message":"Send a message."}` | body not JSON, or `message` missing, not a string or blank |
| 502 | `{"error":"MODEL_FAILED","message":"The assistant could not answer just now. Please try again in a moment."}` | the model call failed |
| 500 | `{"error":"INTERNAL_ERROR","message":"Something went wrong. Please try again."}` | any other error |

Order of checks: method, model configured, rate limit, session, message. The rate limit runs before the session check.

## GET /api/history

- **Who:** any of the four roles (cookie). Rate limit `AUDIT_PAGE_PER_MINUTE` (its own bucket; "Ticket 045 decides whether history gets its own constant").
- **Body:** none. The query and body are never read.
- **200:** `{"messages": [{"role": "user|assistant", "content": "<text>"}]}`: the caller's own recent thread (last `THREAD_MESSAGES_KEPT` 20 messages, kept `THREAD_TTL_SECONDS` 86400).
- **Errors:**

| Status | Body | When |
| --- | --- | --- |
| 405 | `{"error":"METHOD_NOT_ALLOWED"}`, `allow: GET` | any method but GET (only GET is exported) |
| 429 | `{"error":"RATE_LIMITED","message":"Too many requests. Please wait a minute."}`, `retry-after: 60` | over the limit |
| 401 | `{"error":"UNAUTHENTICATED","message":"Pick a role first."}` | no valid session |
| 500 | `{"error":"INTERNAL_ERROR","message":"Something went wrong. Please try again."}` | any other error |
| 503 | `{"error":"DEMO_NOT_CONFIGURED"}` | runtime failed to start |

## GET /api/inbox

- **Who:** broker only. Rate limit `AUDIT_PAGE_PER_MINUTE`.
- **Body:** none. The query and body are never read.
- **200:** `{"items": [{"ticket_id", "role", "deal_id", "question", "created_at"}]}` for the session's deal. Each item is the stored record.
- **Errors:**

| Status | Body | When |
| --- | --- | --- |
| 405 | `{"error":"METHOD_NOT_ALLOWED"}`, `allow: GET` | any method but GET (only GET is exported) |
| 429 | `{"error":"RATE_LIMITED","message":"Too many requests. Please wait a minute."}`, `retry-after: 60` | over the limit |
| 401 | `{"error":"UNAUTHENTICATED","message":"Pick a role first."}` | no valid session |
| 403 | `{"error":"ROLE_FORBIDDEN","message":"Only the broker can read the inbox."}` | any other role |
| 503 | `{"error":"DEMO_NOT_CONFIGURED"}` | runtime failed to start |

Unhandled errors from the store: not specified (no catch in `api/inbox.js`).

## GET /api/approve and POST /api/approve

- **Who:** broker only. Rate limit `APPROVE_PER_MINUTE`, shared by both methods.
- **GET:** no body. **200:** `{"pending": [{"action", "request_id", "requested_at", "to", "forms"}]}` for the session's deal.
- **POST body:** `{"action": "hand_off", "request_id": "<id>"}`. Only `hand_off` is approvable today. The id is compared with the stored request and is never authority; `to` and `forms` are copied from the stored request. **200:** `{"ok": true, "action": "hand_off", "turnId": "<uuid>"}`.
- **Errors:**

| Status | Body | When |
| --- | --- | --- |
| 405 | `{"error":"METHOD_NOT_ALLOWED"}`, `allow: GET, POST` | any other method |
| 429 | `{"error":"RATE_LIMITED","message":"Too many requests. Please wait a minute."}`, `retry-after: 60` | over the limit |
| 401 | `{"error":"UNAUTHENTICATED","message":"Pick a role first."}` | no valid session |
| 403 | `{"error":"ROLE_FORBIDDEN","message":"Only the broker can approve."}` | any other role |
| 400 | `{"error":"BAD_REQUEST","message":"Send the action and the request id to approve."}` | POST: body not JSON, unknown action, or missing/non-string `request_id` |
| 409 | `{"error":"NO_PENDING_REQUEST","message":"There is no pending request to approve."}` | POST: nothing pending, or `request_id` does not match |
| 503 | `{"error":"DEMO_NOT_CONFIGURED"}` | runtime failed to start |

Unhandled errors from the store: not specified (no catch in `api/approve.js`).

## GET /api/events?turn=`<id>`

- **Who:** broker only. Rate limit `AUDIT_PAGE_PER_MINUTE`.
- **Query:** `turn` (turn id). Nothing else is read.
- **200 (HTML, `text/html`):** without `turn`, a form asking for a turn id. With `turn`, a table of that turn's events (time, role, event type, payload), limited to the session's deal; every value is HTML-escaped.
- **Errors (JSON):**

| Status | Body | When |
| --- | --- | --- |
| 429 | `{"error":"RATE_LIMITED"}` | over the limit (no message, no `retry-after`) |
| 401 | `{"error":"UNAUTHENTICATED","message":"Sign in first."}` | no valid session |
| 403 | `{"error":"ROLE_FORBIDDEN","message":"The audit log is for the broker only."}` | any other role |
| 503 | `{"error":"DEMO_NOT_CONFIGURED"}` | runtime failed to start |

Other methods and unhandled errors: not specified (only GET is exported; no method check or catch).

## GET /api/health

- **Who:** nobody (no session, storage or secret). No rate limit.
- **Body:** none.
- **200:** `{"ok": true, "node": "<version>", "hosted": <bool, true when VERCEL is set>, "questions": <n>, "documents": <n>, "baseForms": <n>}`. It never reports an environment variable's value.
- **Errors:** 405 `{"error":"METHOD_NOT_ALLOWED"}`, `allow: GET`, for any other method (every method is wired to the handler).

## Tool-envelope status codes (not HTTP errors)

The chat's tools return `{ok, data?, error?: {code, message, next_step}, field_names?}` to the model. `code` is one of the ten status codes (`MISSING_FACT`, `INVALID_VALUE`, `FACT_CONFLICT`, `ROLE_FORBIDDEN`, `FORM_NOT_REQUIRED`, `LEGAL_JUDGMENT`, `POST_APPROVAL_CHANGE`, `FORM_LOCKED`, `HUMAN_ATTESTATION_REQUIRED`, `APPROVAL_REQUIRED`) or a transport code (`NOT_FOUND`, `NO_TEMPLATE`, `UNTESTED_JURISDICTION`, `QUESTION_TOO_LONG`, `INBOX_FULL`). These reach the client only inside the model's reply text; the one exception is `status` on a `/api/agent` 200 when the legal guard fires.
