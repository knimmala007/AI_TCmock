# Reminders: things that must change or be re-checked

Living file. Every stand-in, mock, or deferred decision in `backend/` gets a row here when it is
introduced. When real repo data or the real backend arrives, work through the **Open** list, then
move each finished row to **Done** with the date and what was verified.

## Open

### When the real backend / repo data arrives

| # | Reminder | What to do | Where |
|---|----------|------------|-------|
| R1 | **The deal store must be replaced** (decided Q8). Deals live behind one repository module: a local file in development, Upstash when hosted. | Replace the repository module with the real backend client, in that one place only. **Then test, check and modify**: re-run the full suite against the real repo; confirm reads, writes (`save_answers`) and error cases behave the same; check that the tool layer, agent loop and prompts needed no changes (if they did, the seam was wrong, so fix it). Delete `reset_demo_data.js` and the seed loading if no longer needed. | `repository.js`, `backend/data/`, `scripts/reset_demo_data.js` |
| R2 | `backend/fixtures.js` is derived from `index.html` and `rules.js`, not from the real backend. Austin (`tx_unknown_city`) is **SYNTHETIC**. | When real data arrives, replace the fixture source and re-run the evals. Regenerate with `node backend/scripts/extract_fixtures.js` whenever `index.html` DOCS or `rules.js` QUESTIONS change (a test fails on drift). Remove the Austin fixture only if a real untested-city deal exists. | `fixtures.js`, `scripts/extract_fixtures.js` |
| R3 | The intake rules live in `rules.js` (shared by `index.html` and Node, ADR 0005). | Keep one copy. When the real backend takes over intake, replace or wrap `rules.js` and re-run `rules.test.js` (the app's own CASES). | `rules.js` |
| R4 | Seller stages are the real six from `SELLER_STAGES` in `index.html` (Listing Signed ... Closed). | Confirm they match what the real backend returns. Confirm with Ethan how the UI maps them to the party-step view. | `get_deal` |
| R5 | The tested-jurisdiction list is San Jose / Santa Clara, San Francisco / San Francisco and Los Angeles / Los Angeles: exactly what the app's own CASES use (a test enforces it). "Tested" means a CASE exercises it, **not that a real deal verified it**. The Evaluation tab's original failure was SF/LA rules misapplied to a San Jose deal. | Replace the list with the real tested rule set. Never add a jurisdiction without a CASE or a real-deal test for it. Berkeley and Oakland are in the rules but in no CASE, so they stay untested. | `config.js` (`isTestedJurisdiction`) |
| R6 | **No sign-in: the role comes from the demo session**, a stand-in. The UI's role switcher POSTs to `/api/demo-session`; the cookie it sets is the only source of the role. It works on Vercel, but only with an owner-set `AGENT_SESSION_SECRET` (it refuses without one). It is separate from `DEV_FAKE_AUTH`, which stays impossible on Vercel for the real app. Anyone can pick any role, so the broker-only audit page is only as strong as the switcher. | When real sign-in lands, derive the role from it and delete `demo_session.js`, `api/demo-session.js` and the switcher's call (`syncDemoRole` in `index.html`). Re-test that no request input can set the role, that the audit page still refuses seller, buyer and lender, and that threads stay isolated. Before then, serve only redacted data. Add a Lender view to the app (none exists). | `session.js`, `demo_session.js`, `index.html` `syncDemoRole` |
| R7 | Events go to a local JSONL file in development and to Upstash lists (one per turn, no expiry) when hosted (ADR 0004). The platform's existing audit log is the intended sink but its shape is unknown here. | Learn the existing audit log's shape and write to it instead. Keep secret redaction. Check that no key or `.env` is ever logged or staged. | `events.js`, `runtime.js` |
| R8 | Decided: the Lender sees only `APPR`, and the shared rules now produce it (the `buyerFinancing` question). The loan checklist has no document code. | Add the real loan-file codes when they exist, and re-test lender isolation. | `roles.js` |
| R9 | Codes the rules produce but `DOCS` doesn't define (17: `BK-RECO`, `BK-RENT`, `BK-SEWER`, `EBMUD`, `HOA`, `HOA-CERT`, `LA-9A`, `LA-GAS`, `LA-RETRO`, `LA-RSO`, `LEASE`, `NEWCON`, `OK-RAP`, `OK-RECO`, `SF-3R`, `SF-EWC`, `SF-RENT`). | **Decided (flag-only):** the agent only flags a required form with no template (the app shows "form not yet templated"); it never fills it. The extractor's report now probes each city, so it also lists the tenant-occupancy codes that depend on city (`SF-RENT`, `LA-RSO`, `BK-RENT`, `OK-RAP`). | `ask_next_question`, `save_answers` |
| R10 | **Upstash is untested against the real service.** `kv.js` talks to Upstash's REST API; tests use a fake `fetch`. Chat threads keep 20 messages for one day (`THREAD_MESSAGES_KEPT`, `THREAD_TTL_SECONDS`); the brief said 10 to 20 and a day or a week. | Once the owner has set Upstash up, run one real round trip (a deal read/write, an event list, a thread append with expiry) and confirm the commands (`RPUSH`, `LTRIM`, `EXPIRE`, `LRANGE`, `GET`, `SET`) behave as the memory implementation does. Confirm the 20 / one-day choice. Deals are one JSON value under one key; revisit if it grows large. | `kv.js`, `threads.js`, `runtime.js` |
| R11 | Fixtures are a generated JavaScript module, so they are bundled with the functions. They hold no executed PDFs and nothing serves documents. | Do not copy `/api/doc` from the other branch: it relies on `vercel.json` listing extra files, which agents may not edit. If the agent ever needs documents, decide that with the owner. | `fixtures.js` |
| R12 | `npm start` serves only an allowlist (the app, `rules.js`, `docs/*.pdf`) on 127.0.0.1 and mounts `api/<name>.js`. `index.html` must be served over http(s); module scripts do not load from a file. | If a new static file is added to the app, add it to the allowlist deliberately. Keep it local-only. | `scripts/serve.js` |
| R13 | **Remaining from the "AI Agent" role clean-up:** the docs under `agents/` were reworded in commit c980d6d (the role is described as legacy and being retired). The real `api/_lib/scope.js` (`ROLE_VIEWS`) is not in this repo (it is on the Kialae branch), so `aiagent` is still in that code and `lender` is not. | Change `scope.js` on the Kialae branch: remove `aiagent`, add `lender`. Re-run the role-isolation tests there. Then delete the "legacy" wording in the `agents/` docs. | Kialae `api/_lib/scope.js` |
| R14 | Five gated actions have no tool and are broker UI buttons (release forms, freeze snapshot, send message, waive/override, reopen). None of the buttons or their endpoints exist yet. | Build them with the spec's rules: each endpoint re-checks the signed session is the broker, records the per-action approval and writes the audit log; test that seller, buyer and lender are refused. | `index.html`, `api/` |
| R15 | **Public-endpoint safeguards are values I chose.** Rate limits: 10 role switches/min, 30 audit loads/min, 20 chat messages/min per client; daily cap 500 model calls across everyone (`config.js`). The limiter is wired into the role switcher and the audit page. The chat limit (20/min per client) and the daily cap (`dailyCap.take`, before every model call, inside `modelGate`) are now wired into `/api/agent` (027a); both answer 429 `{reply, turnId}`. Still not wired: `redactDeal` and the seen-field set (no tools yet); refused turns are not logged (ticket 062); the attack tests for 'act as broker', a tool-argument role, an invented field name and 'use full access' wait for tools. The per-client key is the first `x-forwarded-for` address, which a client can vary off Vercel. | Tune the numbers with the owner. When the chat endpoint is built: take the cap before every model call, apply the chat limit, pass every deal and tool result through `redactDeal`, record seen field names, and add the attack tests (body role, "act as broker", tool-argument role, invented field name, "use full access"). Check the limiter keys on Vercel's real client address. | `limits.js`, `safety.js`, `threads.js`, the chat endpoint |
| R21 | `/api/agent` builds the real model client from `ANTHROPIC_API_KEY` (027b, review pending) and answers 503 `MODEL_NOT_CONFIGURED` only when no key is set; a model failure is a plain 502 and any other error a generic 500. The system prompt is a placeholder until 027d. | Replace the prompt constant (027d). The real API is first called in ticket 044. | `api/agent.js`, `agent_handler.js`, `model_client.js` |
| R22 | In `model_client.js`, `max_tokens` (1024) and the 25 s timeout are constants of mine, not in `config.js`. No `vercel.json` exists in the repo, so the hosted function duration is unverified and may be shorter than 25 s. | Move both to `config.js`. The owner checks the Vercel function duration allows the timeout (do not edit `vercel.json` without asking). | `model_client.js`, `config.js`, Vercel settings |

### Decided Oct 25 2026, not yet built (ADRs 0007-0012; ticket impact in `.scratch/options/README.md`)

| # | Reminder | What to do | Where |
|---|----------|------------|-------|
| R16 | Approvals, locks and the snapshot carry who and when (ADR 0007). `status.js` `guardAction` still reads `=== true`. `reopen_form` needs no prior grant. | Change `guardAction` and its tests when 037/043 are built; 043/046 write the new shapes. Update the spec and CONTEXT open item 2, and close Q-c. | `status.js`, 037, 043, 046 |
| R17 | Tools return one envelope; the next question is chosen by unblock count in a new `rules.js` function (ADR 0008). The code still has only the browser's first-pending `nextQ()`. | Ticket 033's Files line now lists `rules.js` and `rules.test.js`. Add the function with a test. Ticket 024 fixes `config.py` to `config.js` and the dates in ADR 0002, uses `get_deal` in the spec, and closes CONTEXT open item 1. | `rules.js`, 033, 034, 024 |
| R18 | Stage per role; the lender follows the buyer's stage from "Loan & Appraisal" only when the buyer is financing (ADR 0009). `APPR` visibility follows role scope and the buyer financing, not the stage. R4, R8 and the spec still say "one of six seller stages" and "Lender sees only `APPR`". | Ticket 025 rewords R4, R8, the spec and CONTEXT. Add a stage projection to the data filter. Test the stage rule and the `APPR` rule separately. | `roles.js`, 025, 031, 041, 051 |
| R19 | Attestation: only the seller session may save `waterHeater`, `smokeAlarm`, `coDetector`; others get `HUMAN_ATTESTATION_REQUIRED`; `ask_next_question` skips them for non-sellers; signature blocks are never filled (ADR 0010). **Demo-mode limit:** anyone can pick the seller role, so this is not a real attestation until real sign-in (R6). Still proposed: the third form state ("awaiting statement / signature") and `flag_missing` wording. | The constant is created in 033 and enforced in 039. Confirm the third form state before 040 and 041. Revisit when sign-in lands. | 033, 039, 040, 041, 052 |
| R20 | Hand-off record `{from,to,forms,at,approval}` on `deal.handoffs`; the next role sees released forms and a note, no chat history; release (access) and hand-off (assignment) stay separate; a buyer or lender hand-off needs its forms released first (ADR 0011). | Ticket 043 criteria 6 to 8. Ticket 047 decides the shape of the released list. Until 047, hand-off to a buyer or lender is refused. | 043, 047, 051 |

### Open design questions

| # | Question |
|---|----------|
| Q-a | The shape of the platform's existing audit log and how this repo reaches it (R7). **Ask Karthik the seven questions in ADR 0012.** Until answered, `agent_events` is the only sink. |
| Q-b | Real sign-in: no Clerk wrapper exists in this repo (R6). |
| Q-c | Decided in ADR 0007 (who and when at the same paths). Stays listed until the spec and CONTEXT are updated and ticket 023 is closed. |
| Q-d | Approval grants are per action in `deal.approvals`, set only by the broker's Approve click. Decided per action. |

### Best-effort items: know their limits

| # | Reminder | Notes |
|---|----------|-------|
| B1 | "No legal advice" is two layers: a prompt rule plus a code-level guard (fixed refusal and a reply post-check). | Best-effort, not a guarantee. Keep the adversarial-prompt tests current. Add cases whenever a miss is found. |
| B2 | Turn limits: 8 model calls, 20 tool calls, 15 facts per batch, repeated identical call stops after 2 (`config.js`). | Revisit after eval. When hit, the agent says so plainly. |

### Decided and dropped

Source citation is not a requirement (decided Q6). The wave-pattern idea for agent replication was dropped (Q7). Revisit only if the team asks.

## Done

| Date | Item | Verified |
|------|------|----------|
| 2026-10-27 | The broker sees every document on both sides (`roles.js`, `canAccess`); stale R13, R3 and `/chat` wording fixed; forms with no template are flag-only. | `roles.test.js`, `permission.test.js`, `npm test` (143 tests) |
| 2026-10-26 | Demo mode: no sign-in; the Vercel refusal of the stub session removed; UI role switcher calls `/api/demo-session` (four roles only); threads and the seen set keyed by session and role; rate limits, daily cap, redaction. The sweep of "AI Agent" docs committed separately. | `session.test.js`, `demo_session.test.js`, `threads.test.js`, `limits.test.js`, `safety.test.js`, `events_page.test.js`, `audit_button.test.js` |
| 2026-10-26 | Lender gets `APPR` from the shared rules (`buyerFinancing`); all five CASES answer it. Longford and Latenant gain `APPR` (31 to 32 and 34 to 35 forms); the other three and the Cottage Grove prefill (32 forms) are unchanged. | `rules.test.js`, before/after comparison |
| 2026-10-26 | Write check order confirmed; status-code table unified at ten; gated actions without a tool are UI buttons; `rules.js` described as imported, not required. | CONTEXT.MD, spec, ADR 0002 |
| 2026-10-26 | Fixtures became a generated ES module (`fixtures.js`, `export default`); the JSON file and loader are gone. | `fixtures.test.js`, `rules.test.js` |
| 2026-10-26 | Tested-jurisdiction list expanded to the cities and counties the CASES use. | `rules.test.js` (derived from the CASES) |
| 2026-10-26 | Chat threads in Upstash keyed by deal, role and user; storage picked by environment; local static server and `npm start`. | `kv.test.js`, `threads.test.js`, `runtime.test.js`, `serve.test.js` |
| 2026-10-26 | Broker-only Audit log button and endpoint; seller, buyer and lender refused. | `events_page.test.js`, `audit_button.test.js`, `session.test.js` |
| 2026-10-25 | Runtime decided: Node, ES modules, `import` not `require`; Python backend removed. `rules.js` is a plain ES module loaded with `<script type="module">`. | `npm test` (52 tests) |
| 2026-10-25 | Status codes kept at ten; delegation of five refusal codes implemented. | `status.test.js` |
| 2026-10-24 | Placeholder stage names replaced with the real six (was R4). | `fixtures.test.js` |
| 2026-10-24 | Status codes (10), approval-gated actions, single `save_answers`, Lender = `APPR` only locked. | CONTEXT.MD, ADR 0002, `roles.test.js`, `status.test.js` |
| 2026-10-24 | Intake rules moved to shared `rules.js`; app CASES pass against it (was R3 port). | `rules.test.js` |
| 2026-10-24 | Invented mock document codes replaced with the real `DOCS` codes (was R2). | `fixtures.test.js` (44 codes, 42 with PDF, in sync with `index.html`) |
