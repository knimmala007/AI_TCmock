# CONTEXT.md — AI Real Estate Agent: Role-Based Chat Agent

Read this before doing anything else in this repo. It's the shared context for
building the agentic chatbot feature on top of the existing AI Real Estate
Agent (transaction-coordination) product.

**Source of truth note:** every requirement below is sourced from the design
deck ("Role-based AI agent: designs and user journey," Oct 21 2026) and a
follow-up Grill Q&A pass that resolved several open questions. Two earlier
PRDs existed during planning but are now superseded wherever they differed —
treat them as historical only, not as an active requirements source.

## What this project is

An existing product ("AI Real Estate Agent") already runs a working intake →
document-generation pipeline for real transactions (Test Lab, Agent/intake
tab, Broker/Seller/Buyer views, Files tab, Evaluation tab). We are adding a
ChatGPT-style, role-based chat agent on top of it — one AI agent per role
(Broker, Seller, Buyer, Lender), each grounded in real transaction data via
tool calling, not general LLM knowledge.

**Hard constraint, stated explicitly by the team:** the agent is built from
scratch, coded with AI assistance — it is NOT a thin wrapper that forwards
messages to an LLM. We own the agent loop, the tools, the role rules, the
shared workspace, and the tests, so the agent does the transaction work
itself.

## Why this approach (the evidence behind it)

The product's own Evaluation tab already audited a hand-built, researched
rules engine against a real, closed transaction (118 Cottage Grove Ave, San
Jose, Santa Clara County): it found only 11 of 38 required documents, and it
applied the wrong jurisdiction's rules (SF/LA/Berkeley/Oakland logic to a San
Jose/Santa Clara deal). This is the direct justification for:
1. The agent reading real backend state through tools, not reasoning about
   requirements from its own training knowledge.
2. The agent explicitly declining and flagging jurisdiction-specific
   questions outside a known, tested rule set, rather than guessing.

## Roles

Four roles, each with its own AI agent, same shared layout, different data
scope and permissions:
- **Broker** — sees every document, both sides of the deal. The customer;
  everything routes through broker approval before it reaches other parties.
- **Seller** — sees only the seller's disclosures and documents.
- **Buyer** — sees only the buyer's documents.
- **Lender** — sees only the loan file.

Role-based filtering is enforced in code, at the tool-calling layer, from the
authenticated session's role — never inferred from chat text, never
something the model can override. **For the Oct 22 demo, there is no real
auth yet:** the role comes from the UI's role switcher, which calls a
server endpoint that validates it and sets a signed, HttpOnly session cookie.
The chat endpoint's (`api/agent.js`) request body never carries a trusted role directly. See "Demo
mode" below.

### Demo mode: no sign-in (decided)

- **No sign-in for now.** The agent must work on Vercel in demo mode; real
  sign-in comes later. The earlier rule that refused the stub session on Vercel
  is removed.
- **UI role switching is allowed**, between exactly four roles (broker, seller,
  buyer, lender). The switcher POSTs to `/api/demo-session`, which validates the
  role and sets the cookie. The agent reads the role **only** from that cookie,
  never from the body, chat, tool arguments or model output. **It is a stand-in**
  (reminders R6). The app has no Lender view yet.
- **Separate from `DEV_FAKE_AUTH`**, which stays impossible on Vercel for the real
  app. The demo session shares no switch, name or code path with it.
- **It needs an owner-set `AGENT_SESSION_SECRET` on Vercel** and refuses to run
  without it: a built-in default would let anyone forge a broker cookie. Agents
  cannot set Vercel settings, so this is the owner's step.
- **Attestation limit.** Anyone can pick the seller role in the switcher, so the
  seller-only rule for `waterHeater`, `smokeAlarm` and `coDetector` (ADR 0010) is only
  as strong as the switcher: it stops the other roles' assistants, but it cannot prove a
  real seller said it. It becomes real with real sign-in (reminders R6).
- **No leaks through the agent.** Role filtering stays fully server-side. The chat
  history and the seen-field-names set are keyed by session **and** role, and every
  role switch starts a new session, so a switch begins with a clean thread (even
  when switching back).
- **Public-endpoint safeguards:** per-client rate limits, a daily model-call cap,
  no keys in responses or logs, redacted deal data only (`backend/limits.js`,
  `backend/safety.js`; limits are in `config.js`). Because anyone can pick any
  role, the broker-only audit page is only as strong as the switcher; accepted
  for the demo.

## Scope: all four agents are designed together

**Revised (supersedes "Broker only for the Oct 22 demo"):** we design all four
agents (Broker, Buyer, Seller, Lender) together. The role-scoped registry
(role → allowed tools → data filter) lives in `backend/roles.js`; each role is
one entry reusing the same agent loop. Broker is still validated first.

## Architecture

```
Chat UI (per-role landing page, ChatGPT-style; index.html, Ethan's side)
   -> HTTP -> api/agent.js (a Vercel Node function; the agent library is backend/)
   -> Agent Orchestrator (Claude Messages API called directly, hand-written
      tool-use loop -- no LangChain, no Agent SDK. Model name in one config
      constant: claude-sonnet-5-5)
   -> Agent loop: plan, call a tool, read the result, repeat.
      Per-turn limits (see Limits below) or stops when the broker must
      approve.
   -> Tool layer (role-scoped; each role's agent only gets its own
      allowed-tools list and data filter, applied before the model sees
      anything)
   -> Repository (the only reader/writer of deal data; Upstash when hosted,
      a local file for development; swappable for the real backend later)
```

**Memory model (resolved — this was previously an open conflict):**
Hybrid. Facts always come from tools that read the deal file — the deal file
in the database is the source of truth, every agent reads and writes it, not
chat history. The session keeps only recent conversational turns so the model
can follow the conversation, but those turns are never treated or cited as a
source of facts (ADR 0001).

**Chat thread storage (decided):** Upstash Redis on the server, keyed by deal,
session and role, holding the last 20 messages with a one-day expiry (both are
constants in `backend/config.js`; the brief said 10 to 20 messages and a day or a
week). The role is part of the key, so one role's thread can never be read by
another. Locally the thread is held in memory.

### Backend structure (decided)
```
backend/
  config.js           <- limits, model, tested jurisdictions, local paths
  fixtures.js         <- the one shared fixture file, a generated ES module (export default)
  kv.js               <- key-value interface: memory (local/tests) and Upstash REST (hosted)
  repository.js       <- the only reader/writer of deal data (ADR 0003), storage injected
  threads.js          <- last 20 chat messages and the seen-field-names set, per deal+session+role, with expiry
  limits.js           <- per-client rate limit and the global daily model-call cap
  model_gate.js       <- modelGate: a gate every model call passes through (daily cap, 8-call limit, logging)
  safety.js           <- scrubs keys, emails, phones, SSN-like numbers from deal data
  runtime.js          <- picks storage: Upstash when hosted, local otherwise
  roles.js            <- role -> tools -> data filter (Lender sees only APPR, and only when the buyer is financing)
  session.js          <- the demo session cookie (role from the cookie only); needs an owner secret on Vercel
  demo_session.js     <- the role switcher's endpoint: validates the role, starts a fresh session
  events.js           <- agent_events log + logEvent (ADR 0004), storage injected
  events_page.js      <- the broker-only audit page (re-checks the session role)
  status.js           <- the 10 status codes + guardWrite/guardAction (delegation)
  scripts/            <- extract_fixtures.js, reset_demo_data.js, serve.js (npm start)
  reminders.md        <- stand-ins and what to re-check when real data lands
  tests/              <- node:test (npm test)
  (not built yet: tools.js and the agent loop)
api/
  events.js           <- GET /api/events?turn=<id>, broker only
  demo-session.js     <- POST /api/demo-session {role}: the role switcher (demo mode)
  (not built yet: agent.js, the chat endpoint)
```
Everything is plain ES modules on Node 22+ with no dependencies (the Messages API
is called with `fetch`). `package.json` was added with `"type": "module"`, because
ES-module imports need it; it holds no dependencies. `rules.js` sits at the repo
root, beside `index.html`. The chat entry point will be a new `api/agent.js`; no
`vercel.json`, Clerk, Vercel or Upstash setting is touched. Upstash is reached
over its REST API with `fetch`, so no dependency was added.

**Running it locally:** `npm start` runs a tiny static server on Node's built-in
`http` module (no dependencies). It serves only an allowlist (the app, the shared
rules module and PDFs under `docs/`), never the rest of the repo, and mounts
`api/<name>.js` at `/api/<name>`. `python3 -m http.server` also serves the page but
not the API. File-backed storage is for local development only; on Vercel,
`runtime.js` requires Upstash and refuses to start without it. The PDF-serving
approach of `/api/doc` in the other branch is not copied: it depends on
`vercel.json` listing extra files, which agents may not edit.


## Limits (decided)

| Limit | Value |
|-------|-------|
| Model calls per turn | 8 |
| Tool calls per turn | 20 |
| Facts per `save_answers` batch | up to 15 |
| Repeated identical call | 2, then stop |

All four live in `backend/config.js`. Hitting any of them ends the turn with a
plain message to the user.

## Tools (revised, supersedes the earlier "demo four")

**Broker:** `get_deal`, `save_answers`, `ask_next_question`, `flag_missing`,
`request_approval`, `hand_off`.

`fill form` and `check state/county rules` are **merged into `save_answers`**:
it saves and validates in one call, which cuts latency. The jurisdiction check
and the field-name guard therefore run inside `save_answers`. (There is one
tool, `save_answers`, for every role that saves. The earlier singular
`save_answer` was a naming error and is gone.)

**Other roles:**

| Tool | Role | Purpose |
|------|------|---------|
| `ask_broker` | Seller, Buyer, Lender | Hands a question to a person. This is the deck's "request" and the polite way to refuse out-of-scope or legal questions. |
| `acknowledge_disclosure` | Buyer | Records that the buyer opened and acknowledged a form. |
| `mark_clear_to_close` | Lender | Updates the loan step. |
| `get_deal_status`, `explain_form`, `ask_next_question`, `save_answers` | Seller (the first two also for Buyer and Lender) | Same tools, with the role filter limiting which keys and forms they touch. |

**Lender and the appraisal (decided):** the shared rules now produce `APPR`. The
Transaction group has a question, `buyerFinancing` ("Is the buyer financing the
purchase with a lender loan?"), whose "Yes, with a lender loan" answer adds `APPR`
and whose "No, all cash" answer adds nothing. Each of the app's five CASES answers
it (Longford and Latenant: yes; the other three: no), and two CASES assert the
result both ways. This gives the Lender a form to see.

**There are four roles and only four:** Broker, Seller, Buyer, Lender. There is no
"AI Agent" role; the assistant acts with the session's role (spec,
section 4). `agents/00-orchestrator/CLAUDE.md` and `contracts.md` (`ROLE_VIEWS`)
were corrected to match.

The registry is `backend/roles.js`. **Log** is cross-cutting, not a model-callable
tool (see Logging). `message` is not a tool; people are reached via `ask_broker`
and `hand_off`.

### Jurisdiction check — enforced in code, not just the prompt
`save_answers` computes `jurisdiction_status: tested | untested` from a config
list (San Jose / Santa Clara, San Francisco / San Francisco and Los Angeles / Los
Angeles, which are exactly the cities and counties the app's own CASES use) and returns a decline
payload for untested jurisdictions, so the model cannot skip the check. This
is the fix for the Evaluation tab's documented SF/LA/Berkeley/Oakland misfire.

### No-invented-field-names — the fix for a real bug already found
A model once invented a field name (`school_district_disclosure`) that
didn't exist and queried it as if it were real. Fix: the orchestrator tracks
the set of field names actually seen in prior tool results this
turn/session; any lookup tool taking a `field_name` rejects a value outside
that set, with an error listing the valid names. Enforced in code.

### Status codes (locked: ten)

`save_answers` and the gated actions report one of these ten codes. The same table
is in the spec; `backend/status.js` holds the codes and the guards for the five
marked `guardWrite` / `guardAction`.

| Code | Fires when | Next step | Decided by |
|------|-----------|-----------|------------|
| `MISSING_FACT` | A fact needed to fill is not on the deal. The normal path. | Get the answer via `ask_next_question`. | the tool |
| `INVALID_VALUE` | The value does not fit the field. | Ask again with a valid value. | the tool |
| `FACT_CONFLICT` | The value conflicts with a fact already on the deal. | Ask the broker which is right. | the tool |
| `ROLE_FORBIDDEN` | The role isn't allowed to touch this at all. | Ask the broker. | `guardWrite` |
| `FORM_NOT_REQUIRED` | The form isn't part of this deal. | Don't fill it. | `guardWrite` |
| `LEGAL_JUDGMENT` | The request needs a legal judgment, which the agent never gives. | Hand the question to a person (`ask_broker`, or the broker's own review). | the tool and the reply guard |
| `POST_APPROVAL_CHANGE` | An approved snapshot exists and this write would change it. | The broker reopens it (a UI button; no tool does this). | `guardWrite` |
| `FORM_LOCKED` | Locked for any other reason, such as awaiting signature or a pending approval request. | Wait. | `guardWrite` |
| `HUMAN_ATTESTATION_REQUIRED` | A person must attest the field (a signature or legal declaration), so the model cannot fill it. | A person completes it. | the tool |
| `APPROVAL_REQUIRED` | The action itself is gated (`hand_off`, release) and approval hasn't been given. Applies to actions, never to writes to a form. | Ask the broker to approve. | `guardAction` |

**Check order for a write (confirmed):** role, then required, then approved
snapshot, then lock. A role therefore learns nothing about a form it may not touch.
Per-action grants live in `deal.approvals`, set only by the broker's Approve click,
never by a model-callable tool. They carry who and when (ADR 0007): `{granted_by,
granted_at, consumed?}`.

### Attestation and hand-off (decided)

- **Attestation (ADR 0010).** Only the seller session may save `waterHeater`,
  `smokeAlarm` and `coDetector`; every other role gets `HUMAN_ATTESTATION_REQUIRED`.
  `ask_next_question` skips them for non-sellers. Signature blocks are never filled by
  the assistant. The list is a constant in `backend/tools.js`, not a `rules.js` change.
- **Hand-off (ADR 0011).** The next role sees only the forms released to it and a note
  of who handed off and when, with no chat history. Each hand-off is recorded on the
  deal as `{from, to, forms, at, approval}`. Release (access) and hand-off (assignment)
  stay separate; for a buyer or lender recipient the forms must already be released.

### Actions that need broker approval (decided)

- Handing the package to another role (`hand_off`)
- Releasing forms to a buyer or lender
- Freezing the final snapshot
- Sending a message to a seller, buyer or lender
- Waiving a required form or overriding a refusal
- Any change after approval (reopening a locked form)

**Only `hand_off` is a tool.** It returns `APPROVAL_REQUIRED` until the broker has
pressed Approve. The other five have **no tool**: the model cannot do them at all.
They are **broker UI buttons** (release forms, freeze snapshot, send message, waive a
form or override a refusal, reopen a form). Each button calls a server endpoint that
re-checks the signed session is the broker, records the per-action approval, and
writes to the audit log. `request_approval` only asks for approval; the click is
what grants it. Reopening an approved form is therefore a button, and
`POST_APPROVAL_CHANGE` tells the assistant to ask the broker to press it.

### Rules engine in JavaScript (decided)

The intake rules (`adds`, `asks`, `derives`, the question list, `requiredForms`,
progress, and writing answers into the deal) live in one shared module,
**`rules.js` at the repo root**. It is a plain ES module: the agent `import`s it and
`index.html` loads it with `<script type="module">`, so **the agent calls exactly the
code the UI does**. `backend/tests/rules.test.js` runs the app's own CASES against it
(`npm test`, or `node --test backend/tests/rules.test.js`).
`rules.js` is the only place to edit the rules now. Do not copy them anywhere.

**Decided: it is a plain ES module** with no browser or Node dependencies. The
agent `import`s it. The page loads it with `<script type="module">`, then injects
the app's classic script once `Rules` is ready, so the app's global functions and
inline handlers are unchanged. Consequence: `index.html` must be served over
http(s) (Vercel or any static server); opening it straight from disk is blocked
by browsers for module scripts.

### Source citation — decided: not a requirement
Answers do not have to cite a source document. Missing facts are still flagged,
never guessed. (Deal facts in the fixture still carry their `src`; it is data,
not a rule.)

## Behaviors & guardrails (from the deck)

- Rules checked in code, not guessed by the model ("check state/county
  rules" tool).
- Missing facts flagged, never guessed ("flag missing" tool) — applies
  broadly, not just to jurisdiction questions.
- Broker approval checkpoints before certain actions reach other parties
  (the list is under "Actions that need broker approval").
- No legal advice — explicit hard rule; enforcement mechanism not yet
  specified.
- Per-turn limits — see Limits above (8 model calls, 20 tool calls, 15 facts
  per batch, a repeated identical call stops after 2).

### Logging (decided)
One `agent_events` log (`backend/events.js`, storage injected) and one `logEvent`
helper, called from three places: before and after each model call, and around
each tool execution. Payloads are redacted (API keys) before they are written.
This replaces the earlier JSONL-per-session plan (ADR 0004).

**Audit page (built):** the broker view has an **Audit log** button that opens
`/api/events?turn=<id>`, which lists a turn's events (`eventsForTurn`). Broker
only, in two places: the button is not rendered for any other role, and the
endpoint re-checks the signed session's role on every request and returns a
refusal (`ROLE_FORBIDDEN`, or 401 with no session). The endpoint is the control;
the button is a convenience. It shows only events for the session's own deal and
HTML-escapes everything. Events live in Upstash when hosted.

## Fixtures (decided)

Everything lives in **one file outside `index.html`**: `backend/fixtures.js`, a
generated ES module (`export default`, plus named exports for each part) that is
bundled like any other import, shared by the agent and the evals. It is generated
from `index.html` and `rules.js` by `node backend/scripts/extract_fixtures.js`;
never hand-edit it, and no document code is invented. (It was a JSON file with a
loader; it is now one module.)

- **`TX-CG118`** (118 Cottage Grove Avenue, San Jose, Santa Clara) is the real
  closed deal, from `DEAL`/`DEAL_REFERENCE`. The name `tx_cottage_grove` does
  not exist in the repo; the real id is `TX-CG118`.
- **Form codes** come from `DOCS`: 44 codes, 42 with an executed PDF (the 38
  with a Drive `file` plus `NHD-RPT`, `NHD-STMT`, `EQ-FORM`, `REPAIRS`). The two
  without a signed original are `POOL` and `SOLAR`. The "42 vs 44" is that gap,
  not a data conflict.
- **Codes the rules produce that have no `DOCS` entry** (17): `BK-RECO`,
  `BK-RENT`, `BK-SEWER`, `EBMUD`, `HOA`, `HOA-CERT`, `LA-9A`, `LA-GAS`,
  `LA-RETRO`, `LA-RSO`, `LEASE`, `NEWCON`, `OK-RAP`, `OK-RECO`, `SF-3R`,
  `SF-EWC`, `SF-RENT` (the app shows them as "form not yet templated"; the
  agent only flags these, it never fills them). `BK-RENT`, `LA-RSO`, `OK-RAP`
  and `SF-RENT` appear only for a tenant-occupied unit in that city.
  **In `DOCS` but never produced by the rules:**
  `EQ-FORM`, `HW`, `NHD-RPT`, `NHD-STMT`, `REPAIRS` (`APPR` is produced: see
  "Lender and the appraisal").
- **Never received:** `permitHistory` and `tenancyStatus`, taken from the
  `UPLOADS` entries still waiting in the Files tab.
- **`tx_unknown_city`** (Austin, Travis) has no real data. It is a clearly
  labelled synthetic fixture (`synthetic: true`, every answer `src: SYNTHETIC`)
  built on the existing `CASES` answer shape, mid-process, to test the
  untested-city path.
- Seller stages are the real six from the app: Listing Signed, Disclosures,
  Offer Accepted, Inspection, Escrow, Closed.

## Build methodology (hybrid Matt Pocock / Leon van Zyl)

1. **Alignment** — grill/resolve open items before building (this file is
   the output of that pass).
2. **Spec** — keep this file and the Master Project Brief current as the
   source of truth.
3. **Breakdown into tickets** — tool layer → agent loop → broker agent →
   guardrails wired in → fresh-context review → replication across roles.
   Commit to git starting from this step.
4. **Architecture decision** — a few competing designs for the agent loop +
   tool interfaces, compared and hybridized, before building.
5. **Implement the broker agent** — test-first (TDD). Then the other three
   roles from the same loop.
6. **Review with fresh eyes** — a fresh-context subagent audits against the
   spec and guardrails; this is the step that would have caught the
   invented-field-name bug.
7. **Refactor only if the review finds a real problem.**
8. **Replicate across roles** — once Broker is validated, Seller/Buyer/
   Lender as the same loop with role-specific prompts/tools/data swapped in.
9. **Checkpoint often** — small commits after each phase, not just at the
   end.
10. **Eval** — run against the real 44-document closed transaction (118
    Cottage Grove Ave) once real data is available; rerun after every
    change.

**Explicitly excluded:** boilerplate scaffolding tools (conflicts with the
from-scratch requirement); background timer-loop agents (not worth the setup
cost against the Oct 22 deadline).

## Team split & timeline

- AI agents and role logic: agent loop, tools, role-based
  permissions, separate prompts/tone per role, handoff through the shared
  workspace after broker approval, status updates, polite refusal for
  out-of-scope questions, logging.

## Still open — do not silently assume an answer

Decided since the last revision: tool list (above), limits (above), citation
(not required), wave pattern (dropped for now), `get_deal` returns the stage for
the caller's side (ADR 0009), "no legal advice" is two layers (prompt rule + code guard, best
effort), logging via `agent_events`.

Decided: runtime is Node (option a). The agent loop and tools are ES modules, and
`api/agent.js` will be the chat entry point. Decided: storage on Vercel is Upstash
(the owner does the setup); the platform's existing audit log is the intended sink
for events, but its shape is not known in this repo.

1. Full function signatures for every tool in the registry. Partly decided: the
   envelope, `save_answers`, `ask_broker`, `explain_form`, `request_approval` and the
   next-question rule are in ADR 0008; the other tools' inputs and outputs are still
   open (ticket 024).
2. Decided (ADR 0007, reminders Q-c): approvals, locks and the snapshot carry who and
   when at the paths `status.js` reads. `status.js` `guardAction` still has to change
   (reminders R16).
3. The shape of the existing audit log, and how this repo reaches it. Until
   known, events are written to Upstash lists keyed by turn.
4. Real sign-in. Until it exists, the demo session is the stand-in (see "Demo
   mode"). Replace it before anything beyond a redacted demo is served.
5. The Lender's loan checklist has no document code. Only the appraisal (`APPR`)
   exists, so the Lender sees only `APPR` for now, and only when the buyer is
   financing. The stage only drives the status line (ADR 0009).
6. The Kialae `api/_lib/scope.js` (`ROLE_VIEWS`) still has the legacy `aiagent`
   role and no `lender`. The agent docs under `agents/` were fixed (commit
   c980d6d); the code is on another branch. See `backend/reminders.md` R13.

## Reference documents
- Master Project Brief — the full version of everything in this file, with
  reasoning and evidence included.
- "Role-based AI agent: designs and user journey" (design deck) — the sole
  authoritative source for requirements, architecture, tools, and team split.
- Chat Agent Tool-Calling PRD / Standalone Chat Agent PRD — superseded,
  historical only.