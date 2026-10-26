Status: ready-for-agent

# Spec: Role-based chat agent

Vocabulary follows `GLOSSARY.md`. Decisions follow ADRs 0001 to 0005 and `.claude/CONTEXT.MD`.

## Problem Statement

Brokers, sellers, buyers and lenders working a real-estate transaction need quick, correct answers about the deal and a way to move it forward, but each may see only their own slice of it. Today they must read the app's tabs and know which form needs what.

Reasoning about requirements from general knowledge fails here. The product's Evaluation tab showed a hand-built rules engine finding 11 of 38 required documents on the closed 118 Cottage Grove Ave deal and applying San Francisco, Los Angeles, Berkeley and Oakland rules to a San Jose deal. A chat assistant that answers from its own knowledge would repeat that failure. Worse, if it ran with broader access than the person chatting, a buyer could be shown broker data.

## Solution

A ChatGPT-style chat for each role that does the transaction work through tools, not from memory. It reads the deal file, saves answers, asks the next question, flags missing facts, asks for approval and hands work to the next person. Every fact it states comes from a tool result.

The assistant always acts with the role of the current session: the person's role once real sign-in exists, and in demo mode the role chosen with the UI's role switcher. It is never a separate, all-access "AI agent". The role comes from the server-side session cookie, filters the tools and data before the model sees anything, and cannot be changed by the request body, the chat text, a tool argument or the model.

It is built from scratch with a hand-written loop (no agent framework, not a message forwarder), so we own the loop, tools, role rules, guards and tests. It uses the same rules code the browser uses, so the agent and the UI cannot disagree about which forms a deal needs.

## User Stories

1. As a broker, I want to ask the assistant where my deal stands, so that I know the stage and what is outstanding without opening every tab.
2. As a broker, I want the assistant to tell me the single most useful unanswered question, so that each answer unblocks as many forms as possible.
3. As a broker, I want to answer in plain language and have it saved to the deal, so that the forms fill without retyping.
4. As a broker, I want to give several facts in one message and have them saved together, so that intake is fast.
5. As a broker, I want to be told when a fact is missing instead of having it guessed, so that I never sign a form built on an invented value.
6. As a broker, I want the assistant to flag everything still missing on a form, so that I can chase the right documents.
7. As a broker, I want the assistant to refuse to guess rules for a city it has not been tested on, so that I do not repeat the wrong-jurisdiction failure.
8. As a broker, I want to be told to have a transaction coordinator confirm an untested jurisdiction, so that I know the next step.
9. As a broker, I want to ask the assistant to request approval, so that a package can be frozen and released.
10. As a broker, I want to be the only one who can approve gated actions, so that nothing reaches another party without me.
11. As a broker, I want a hand-off to refuse until I have approved it, so that work cannot leave my control by accident.
12. As a broker, I want a Reopen button for an approved form, so that late changes are controlled and visible. (No tool exists for this; the assistant can only ask me to press it.)
13. As a broker, I want to be told when a form is locked and what to do, so that I am not left guessing.
14. As a broker, I want a record of every prompt, tool call and result for a turn, so that I can audit what the assistant did.
15. As a broker, I want to see a turn's events on a page only I can open, so that debugging does not expose other roles' data.
16. As a broker, I want the assistant to decline legal questions politely, so that I do not mistake it for legal advice.
17. As a broker, I want the assistant to stop and say so when it has used up its allowance for a turn, so that it never loops silently.
18. As a broker, I want the assistant to stop repeating the same failing call, so that a stuck turn ends quickly.
19. As a seller, I want to ask what is still needed from me, so that I can supply it.
20. As a seller, I want to see only my disclosures and documents, so that nothing from the buyer or lender side is shown to me.
21. As a seller, I want to answer intake questions in the chat, so that my disclosures fill without a separate form.
22. As a seller, I want an explanation of what a form is for, so that I understand what I am signing.
23. As a seller, I want to hand a question to the broker when the assistant cannot or should not answer, so that I still get an answer from a person.
24. As a buyer, I want to see only the buyer's documents and shared ones, so that seller and broker data stay private.
25. As a buyer, I want to acknowledge that I opened a disclosure, so that the record shows I received it.
26. As a buyer, I want an explanation of a disclosure in plain language, so that I understand it.
27. As a buyer, I want to ask the broker a question through the assistant, so that legal or out-of-scope questions reach a person.
28. As a lender, I want to see only the loan file, so that I never see disclosures or other parties' documents.
29. As a lender, I want to mark the deal clear to close, so that the loan step is updated.
30. As a lender, I want an explanation of the appraisal, so that I can read it quickly.
31. As any user, I want the assistant to use my role for everything it does, so that it can never show me more than I am allowed.
32. As any user, I want nothing I type, including "act as the broker", to change my role, so that I cannot leak or be leaked broader data.
33. As any user, I want facts stated by the assistant to come from the deal file, so that I can trust them.
34. As any user, I want a clear refusal with a next step when I attempt something not allowed, so that I know what to do.
35. As a product owner, I want the assistant to use the same rules code as the browser, so that the UI and the agent cannot disagree.
36. As a product owner, I want the app's own test cases to keep passing against that shared rules code, so that moving it caused no regression.
37. As a product owner, I want no role other than the four to exist, so that there is no privileged principal to abuse.
38. As a developer, I want the model client, storage and event log to be swappable, so that tests run without the real API and the real backend can replace the stand-ins in one place.
39. As a developer, I want every stand-in listed in one reminders file, so that nothing temporary is forgotten when real data arrives.
40. As a developer, I want each of the ten status codes to fire in exactly one situation, and the write-refusal codes to be checked in a fixed order, so that behavior is predictable and a role learns nothing about a form it may not touch.
41. As a developer, I want approval granted per action and only by the broker's Approve click, so that the model can never approve for itself.
42. As an evaluator, I want to run the finished agents against the real closed transaction, so that I can measure them against ground truth after every change.
43. As an evaluator, I want an explicitly synthetic untested-city deal, so that the decline path is exercised without pretending it is real.
44. As a security reviewer, I want API keys redacted from every stored event, so that logs cannot leak secrets.
45. As a security reviewer, I want the demo session kept clearly separate from the real app's fake-sign-in switch (which stays impossible on the hosted platform), so that the demo stand-in cannot weaken the real app.
46. As a broker, I want buttons to release forms, freeze the snapshot, send a message, waive a form or override a refusal, so that these actions happen only when I decide, not when the assistant does.
47. As a lender, I want the appraisal to appear only when the buyer is financing, so that I am involved only in financed purchases.
48. As a broker, I want the intake to ask whether the buyer is financing, so that the lender and appraisal are brought in when they should be.
49. As a demo visitor, I want to switch between broker, seller, buyer and lender in the UI, so that I can see each role's view of the deal without signing in.
50. As a demo visitor, I want a role switch to start a clean conversation, so that nothing the previous role saw or said carries over.
51. As the owner, I want per-client rate limits and a daily cap on model calls, so that a public demo cannot run up cost or be flooded.
52. As the owner, I want no keys or personal details in any response or log, and only redacted deal data served, so that a public demo leaks nothing.

## Implementation Decisions

**Identity**
- A session has exactly one role of broker, seller, buyer or lender. There is no fifth role and no principal named after an AI agent anywhere in code, config, prompts or data.
- The role is derived on the server from the session cookie. It is never read from the request body, chat text, tool arguments or model output.
- **Demo mode (no sign-in yet; a stand-in for real sign-in).** The UI may switch between exactly four roles: broker, seller, buyer, lender. The switcher calls a server endpoint that validates the role against those four and sets a signed, HttpOnly session cookie; the assistant reads the role only from that cookie. Every switch starts a new session, so it begins with an empty thread and an empty set of seen field names. Demo mode works on the hosted platform, but needs an owner-set signing secret there and refuses to start without it, because a built-in default would let anyone forge a broker cookie.
- The demo session is separate from the real app's fake-sign-in switch (DEV_FAKE_AUTH), which stays impossible on the hosted platform. They share no switch, name or code path.
- Because demo mode lets any visitor choose any role, role filtering is enforced fully on the server, and only redacted deal data is served. The broker-only audit page is exactly as strong as the switcher; that is accepted for the demo.
- One role is used for the whole turn: the model call, every tool call and every data read. No step escalates, including helper or system steps.
- The tool list offered to the model and the data each tool returns are filtered by the role before the model sees anything, so out-of-scope data never enters its context.
- Documentation and UI copy describe the assistant as acting on behalf of the person using it (the "acting role"), not as a role.
- The audit log page is broker-only. The Audit log button is rendered only in the broker view, and the endpoint re-checks the signed session's role on every request and refuses seller, buyer and lender (and anyone with no session). The endpoint is the control; hiding the button is a convenience.

**Architecture**
- A thin HTTP handler takes a request, derives the session and role, and runs one agent turn. Only this handler is a public entry point.
- The agent loop is hand-written: plan, call a tool, read the result, repeat. It calls the Claude Messages API directly through the platform's fetch, with the model name in a single configuration constant. No agent framework or SDK.
- The tool layer is role-scoped and is the only path from the model to deal data. Guards live here.
- A repository module is the only reader and writer of deal data. Its storage is injected (memory for tests, a file for local development, the platform store later) and its interface is asynchronous. It is a stand-in, to be replaced by the real backend client in that one place.
- The intake rules (question list, which forms are required, what an answer derives, progress, writing answers into the deal) live in one shared rules module. The agent imports it; the page loads it as a module and then runs the app's classic script, so the app's globals are unchanged. There is exactly one copy of the rules. The page must be served over http(s).
- Plain modules on Node 22 or later, with no runtime dependencies.

**Memory**
- Hybrid. The deal file is the source of truth and every agent reads and writes it through tools. The session keeps only recent turns so the model can follow the conversation; those turns are never a source of facts.
- Recent turns are held in Upstash Redis on the server, keyed by deal, session and role, holding the last 20 messages with a one-day expiry (both are configuration constants). The set of field names the model has seen is keyed the same way. The role is part of the key, so one role's thread can never be read by another, a role switch (which starts a new session) begins empty, and a role outside the four is refused.

**Tools**
- Broker: get deal, save answers, ask next question, flag missing, request approval, hand off.
- Seller: get deal status, explain form, ask next question, save answers, ask broker.
- Buyer: get deal status, explain form, acknowledge disclosure, ask broker.
- Lender: get deal status, explain form, mark clear to close, ask broker.
- What each role may see: the broker sees every document, both sides of the deal; the seller sees seller-side and shared documents; the buyer sees buyer-side and shared documents; the lender sees only the loan file (today, the appraisal). The same rule is used by the app's page and by the agent's role registry.
- The shared rules require the appraisal when the buyer is financing. The intake asks "Is the buyer financing the purchase with a lender loan?"; "Yes, with a lender loan" adds the appraisal and "No, all cash" adds nothing. This is what gives the Lender a form to see.
- There is one save tool, named save answers, for every role that saves. It saves and validates in one call (it absorbs fill form and check state/county rules), accepts up to 15 facts, and runs the jurisdiction check and field-name guard inside.
- Ask next question chooses the question in code by how many forms it unblocks, with a fixed tie-break. The model only phrases what the tool returns.
- Full tool signatures are not yet decided (see Further Notes).

**Guardrails (enforced in code, not only in the prompt)**
- Transaction binding: one transaction per session; the orchestrator overwrites any transaction id the model supplies.
- Jurisdiction: tested or untested comes from a configured list: exactly the cities and counties the app's own five cases use (San Jose, San Francisco and Los Angeles, each with its county). Berkeley and Oakland are in the app's rules but in no case, so they are untested. "Tested" means a case exercises it, not that a real deal has verified it. Untested returns a decline payload containing no rules, and the reply tells the user a transaction coordinator should confirm.
- Field names: a lookup rejects any field name not seen in an earlier tool result in the session, with an error listing valid names.
- Missing facts are flagged, never guessed.
- No legal advice, in two layers and best effort: a prompt rule, and a code guard (fixed refusal template plus a reply post-check).
- Turn limits: 8 model calls, 20 tool calls, up to 15 facts per batch, and a repeated identical call stops after 2. Hitting any ends the turn with a plain message.
- Source citation is not a requirement.

**Status codes and approvals**
- There are ten status codes, in one table, identical in the spec, the context file, the glossary and the code:

| Code | Fires when | Next step |
|------|-----------|-----------|
| missing fact | A fact needed to fill is not on the deal. The normal path. | Get the answer via ask next question. |
| invalid value | The value does not fit the field. | Ask again with a valid value. |
| fact conflict | The value conflicts with a fact already on the deal. | Ask the broker which is right. |
| role forbidden | The role isn't allowed to touch this at all. | Ask the broker. |
| form not required | The form isn't part of this deal. | Don't fill it. |
| legal judgment | The request needs a legal judgment, which the assistant never gives. | Hand the question to a person. |
| post-approval change | An approved snapshot exists and this write would change it. | The broker reopens it, using a button. |
| form locked | Locked for any other reason, such as awaiting signature or a pending approval request. | Wait. |
| human attestation required | A person must attest the field (a signature or legal declaration), so the assistant cannot fill it. | A person completes it. |
| approval required | The action itself is gated (hand off, release) and approval hasn't been given. Applies to actions, never to writes to a form. | Ask the broker to approve. |

- A write is checked in the order role, required, approved snapshot, lock (confirmed). A role therefore learns nothing about a form it may not touch.
- Approval-gated actions: handing the package to another role (hand off); releasing forms to a buyer or lender; freezing the final snapshot; sending a message to a seller, buyer or lender; waiving a required form or overriding a refusal; any change after approval (reopening a locked form).
- Only hand off is a tool, and it refuses until the broker has approved. The other five have no tool, so the assistant cannot perform them. They are broker buttons in the UI (release forms, freeze snapshot, send message, waive a form or override a refusal, reopen a form). Each button calls a server endpoint that re-checks the signed session is the broker, records the approval for that action and writes the audit log. Request approval only asks; the click grants.
- Approval is granted per action and only by the broker's Approve click, never by a tool the model can call.

**Logging**
- One event log with one logging helper, called before and after each model call and around each tool execution. Payloads are redacted for API keys before they are written.
- A broker-only audit page lists a turn's events. The broker view has an Audit log button that opens it. It is broker-only twice over: the button is not rendered for any other role, and the endpoint re-checks the session role and returns a refusal otherwise (a forbidden response for seller, buyer and lender; unauthenticated with no session). It shows only events for the session's own deal and escapes everything it prints.
- The platform's existing audit log is the intended real sink; its shape is not yet known here, so events are stored as one list per turn in Upstash. Storage is injected so tests and local development use memory or a file; file storage is for local development only.

**Data and platform**
- One shared fixture file, a generated JavaScript module that is imported like any other (so it is bundled), serves both the agent and the evals. It is generated from the app and the rules module and never hand-edited. The real deal is the Cottage Grove transaction: 44 real form codes, 42 with an executed PDF, with permit history and tenancy status never received. The Austin deal is explicitly synthetic and exercises the untested path.
- `get deal` returns one of the six real seller stages: Listing Signed, Disclosures, Offer Accepted, Inspection, Escrow, Closed.
- On the hosted platform, deals, events and chat threads use Upstash, reached over its REST API with no added dependency. The runtime refuses to start there without it. Setup of Upstash, Vercel and Clerk is done by the owner. No agent changes those settings or reads secrets, and none edits the hosting configuration, so documents are not served the way the other branch's document endpoint does.
- A small static server on Node's built-in modules, started with one package script, serves the app for local use from an allowlist (never the rest of the repo) and mounts the API functions.
- Until the repo has real sign-in, the role comes from the demo session (see Identity). It works on the hosted platform. It must be replaced by real sign-in before anything beyond a redacted demo is served.
- **Public endpoint safeguards.** Per-client rate limits on the role switcher, the audit page and (when built) the chat endpoint; a global daily cap on model calls, counted before each call, which ends the turn with a plain message when reached; no API key, signing secret or session token in any response or log; and only redacted deal data (emails, phone numbers and SSN-like numbers scrubbed) served to a client or the model. Counters live in the same key-value store as the rest.

## Testing Decisions

A good test exercises external behavior only: what a request returns, what is stored, what is logged. It does not assert on internal function calls or prompt wording. Tests never call the real model API; a scripted fake model client drives the loop. Only a manual end-to-end run uses the real API.

There are two seams.
1. **The request handler**, with the model client, storage and event store injected. Request in, response and stored events out. It covers the identity rule, role-scoped tool lists and data, tool behavior, guards, status codes, approvals, turn limits, logging and redaction, end to end.
2. **The shared rules module**, through the existing test that runs the app's own five cases against it, driven the way the Test Lab drives them.

Behaviors the handler seam must prove:
- For each role, the tools offered equal that role's registry entry and nothing more.
- Document visibility: the broker sees all 44 documents, including the buyer-side appraisal; the seller does not see the appraisal; the buyer does not see seller-side forms; the lender sees only the appraisal; the audit and evaluation viewers (role audit) see nothing in the permission layer.
- A buyer session cannot obtain broker-only data by any route: a role in the request body, "act as broker" in chat, a role or transaction id in a tool argument, an invented field name, a form outside buyer scope, or "use full access". Each yields a refusal or nothing, and the model's context holds no out-of-scope data.
- A session with a role outside the four cannot be created, including an AI-agent-style value.
- Every model call, tool call and data read in a turn records the same role.
- Cottage Grove proceeds; Austin returns the decline payload with no rules.
- An invented field name is rejected with the valid names.
- A model-supplied transaction id is overwritten.
- Each of the ten status codes fires only in its situation; the write-refusal codes are checked in the confirmed order; approval required never comes from a form write.
- The actions with no tool (release forms, freeze snapshot, send message, waive or override, reopen) cannot be performed by the assistant: no tool for them is offered to any role, and each button's endpoint refuses any session that is not the broker.
- The app's five cases each answer the buyer-financing question; two assert the appraisal both ways (added when financed, absent when all cash).
- Each gated action is refused until the broker has approved that action, and no model-callable tool can grant approval.
- Each of the four turn limits ends the turn with a plain message.
- A seller, buyer or lender request to the audit page is refused with a forbidden response and leaks no event data, even when the request claims the broker role in its query, a header or its body. A request with no session is unauthenticated. The broker sees the events of a turn, only for the session's own deal. The button is rendered in the broker view and in no other.
- The chat thread keeps the last 20 messages, expires, and is isolated by deal, session and role. Switching roles shows no earlier turns, even when switching back to a role used before, and the seen-field-names set is isolated the same way.
- Roles outside the four are rejected everywhere a role is accepted: the switcher endpoint, the session, the thread store and the role registry.
- The demo session works with the hosted-platform flag set, given the owner's signing secret, and refuses without it. Its responses never contain the token or the secret. The switcher is POST-only and rate limited.
- The rate limit refuses after the limit and resets; the daily model-call cap stops calls at the cap and resets the next day; no refusal or log contains a key; deal data is scrubbed of emails, phone numbers and SSN-like numbers.
- Still to test once the chat endpoint and tools exist (they are not built): that a buyer cannot obtain broker data through a role in the body, "act as broker" in chat, a role in a tool argument, an invented field name, or "use full access".
- Next question is chosen by unblock count in code.
- Adversarial legal questions get the fixed refusal.
- No API key appears in any stored event.
- Facts in replies come from tool results, not chat history.

Prior art: the existing tests for the role registry, fixtures, repository, event log and status guards, and the rules test that evaluates the app's cases. Those lower-level tests stay; no new tests are added below the two seams.

## Out of Scope

- Cross-transaction learning.
- Reasoning about jurisdictions outside the tested list.
- Changing the intake and document-generation engine's behavior (only its rules move into the shared module).
- Agent frameworks, scaffolding tools and background or scheduled agents.
- Any Clerk, Vercel or Upstash configuration, and reading secrets.
- Real sign-in (the demo session stands in until it exists).
- Source citation in answers.
- Lender documents other than the appraisal (the loan checklist has no document code yet).

## Further Notes

Open items, tracked in the reminders file:
- Full signatures for every tool.
- The shapes of approval and lock state. The guards currently read the approved snapshot's form list, each form's lock reason and the per-action approvals; to be settled before the tools are built.
- The shape of the existing audit log and how this repo reaches it.
- How the session carries the role once real sign-in exists.
- The loan checklist's document code for the Lender (today only the appraisal exists, so the Lender sees only that).
- Decided: a required form with no template (13 codes such as the San Francisco and Los Angeles forms and the HOA set) is only flagged by the agent, never filled.
