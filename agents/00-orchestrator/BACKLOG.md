# Backlog

Source of truth for what is being worked on, in what order, and at what stage. Items move
only by an Orchestrator decision logged in `decisions.md`. Start a run for an item with
`/orchestrate <item>`.

---

## Now (in flight)

_(none yet. Pick the first item from **Next** and run `/orchestrate` on it.)_

---

## Next: Must have

| Item | Priority | Notes |
|---|---|---|
| **E-signature** (built in, or via DocuSign) | P0 | Partly exists: in-app sign confirmation per document (`signDocument` in `api/_lib/actions.js`). Decide: build out in-app signing, or integrate DocuSign. |
| **Audit trail**: who did what, and when | P0 | Partly exists: `audit()` in `api/_lib/store.js`, shown to the AI Agent role in Team & activity. Gaps: TODO (fill later) |
| **Document upload and storage per deal** | P0 | Partly exists: chat uploads up to 1 MB stored in Redis. Needs real file storage per deal. TODO (fill later): storage choice |
| **Notifications** (email and in-app) for status changes and signatures | P0 | In-app requests exist for broker / AI Agent. Email: none yet. |
| **Deadline and contingency reminders** | P0 | Deadlines exist (`DEADLINES` in `api/_lib/data.js`); no reminders; no contingency dates on file. |
| **Broker approval before anything is sent** | P0 | Partly exists: only Broker / AI Agent can send for signature, with confirmation. |
| **Messaging between broker, seller and buyer, scoped by role** | P0 | Not started. Must respect role scoping (seller ↔ buyer never see each other's private data). |

## Next: Should have

| Item | Priority | Notes |
|---|---|---|
| **More parties:** lender, escrow/title, inspector | P1 | New roles and views in `scope.js`. |
| **Transaction templates and checklists** (listing and buying) | P1 | |
| **Mobile-friendly app experience** | P1 | Chat is already full-screen on mobile; the rest of the app needs a pass. |
| **Broker reporting dashboard** | P1 | |
| **MLS or property data auto-fill** | P1 | Needs a data provider. TODO (fill later) |
| **Act on behalf**, for a human TC or assistant | P1 | Delegated access with audit of who acted for whom. |

## Later

- TODO (fill later)

## Done

- **Role-based views, sign-in and document agent chat**: committed on `Kialae` (`83c5734`), before this pipeline existed.

## Killed

_(none)_

---

## Conventions

- Priority: `P0` must-have to launch, `P1` important, `P2` nice to have.
- Items in **Now** show their run folder and current stage, e.g. `stage: Testing round 2`.
- Items move (Next → Now → Done / Killed) only with an entry in `decisions.md`.
