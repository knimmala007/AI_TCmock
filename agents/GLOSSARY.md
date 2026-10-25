# Glossary

Shared terms, binding on every agent. If a term is used differently in a report, this file wins.

| Term | Meaning |
|---|---|
| **AI Real Estate Agent** | The product. Never call it "Transaction Coordinator" in anything a user sees. |
| **Kialae.AI** | The company / brand shown on the landing page. |
| **Landing page** | `index.html` on the `Kialae` branch: the marketing home page. |
| **App** | `app.html` + `app.js` + `boot.js` + `chat.js`: the signed-in product. |
| **Role** | What a person is on a transaction: **Broker**, **Seller**, **Buyer** or **Lender**. Set when they are invited (Clerk public metadata). The Kialae code still has a legacy **AI Agent** role, which is being retired. |
| **AI Agent (legacy role)** | A full-access app role that still exists in the Kialae code and is being retired: sees the seller, buyer and broker views, plus the audit trail and team invites. Nothing new may use it. The chat assistant never uses a separate role: it acts with the signed-in person's role. |
| **Seller view / Buyer view / Broker view** | The three slices of a transaction. Which a role sees is defined in `api/_lib/scope.js` (`ROLE_VIEWS`). |
| **Scoped payload** | What `/api/deal` returns to a role. Only data inside that role's views, filtered on the server. |
| **Document agent / chat agent** | The scripted assistant in the chat panel (`api/_lib/agent.js`). Not an AI model. |
| **Development agents** | The six agents in this folder (Orchestrator, Designer, Product Manager, Developer, Testing, Evaluation). Not part of the product. |
| **Checklist** | The documents on a transaction that have an executed PDF (`CHECKLIST` in `scope.js`). |
| **Doc status** | `signed`, `needs_info`, `ready_to_send`, `awaiting_signature` (`docStatus` in `scope.js`). |
| **Hand-off / request** | When the chat agent passes a question to a person; shows in the broker's Requests panel. |
| **Audit trail** | Append-only log of every action (who, role, what, when), stored in Upstash Redis. The audit trail page is broker-only (the legacy AI Agent role also sees it until that role is retired). |
| **Redacted documents** | The 42 PDFs in `private/docs/` with names, signatures and dates blacked out. Served only through `/api/doc`. |
| **Run** | One pass of the development pipeline for one request: `agents/runs/<date>-<name>/`. |
| **Round** | One attempt inside a run. A loop back starts a new round (`.r2.md`, `.r3.md`). |
| **Brief** | The written input the Orchestrator gives an agent. An agent does not start without a complete brief. |
| **Hand-off report** | The written output an agent leaves in the run folder. No verbal hand-offs. |

> TODO (fill later): add product terms as they appear (e.g. new form codes, new roles, new statuses).
