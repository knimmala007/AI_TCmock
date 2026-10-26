# Orchestrator decision log

Append-only. Every non-trivial decision, override, scope cut, threshold change and backlog
move goes here.

Format:

```
## YYYY-MM-DD — <one-line summary>

Context: <what was happening: run, agent, verdict>
Decision: <what was decided>
Reason: <why>
Expiration: <when it is revisited, or "Permanent">
```

---

## 2026-10-01 — Development agent system established

Context: Moe asked for a development process with five agents in series (Designer, Product Manager, Developer, Testing, Evaluation) and an Orchestrator that routes questions and loops work back on failure. Structure adapted from the Agentspector agent system, with Agentspector-specific content replaced by this app's.
Decision: Agents live in `agents/` on both branches (`Kialae`, `masters-project-moe`), started with `/orchestrate`. Moe approves after design and after spec; Testing may loop 3 times and Evaluation 2 times.
Reason: A repeatable, written process with gates, so bugs and weak results go back to the right stage instead of shipping.
Expiration: Permanent (revisable by Moe).

## 2026-10-01 — Feature list added to the backlog

Context: Moe provided the Must have / Should have feature list.
Decision: Added to `BACKLOG.md` under Next, Must have as P0 and Should have as P1. Order within each group: TODO (Moe to set).
Reason: The backlog is the source of truth for what the pipeline works on.
Expiration: Permanent.

## 2026-10-26 — "AI Agent" is a legacy role being retired; the chat assistant never uses a separate role

Context: The chat-agent spec (`.scratch/role-based-chat-agent/spec.md`) requires the assistant to act with the signed-in person's role, with exactly four roles (Broker, Seller, Buyer, Lender). Several agent docs still described an all-access "AI Agent" role, and the audit trail as visible to it only. Moe asked for those docs to be swept.
Decision: Reworded (not deleted) every mention to say the AI Agent role is a legacy app role being retired (the Kialae code, including `ROLE_VIEWS` in `api/_lib/scope.js`, still has it), nothing new may use it, the chat assistant never uses a separate role, and the audit trail page is broker-only. Added Lender where a table listed roles. Files changed: `agents/GLOSSARY.md`, `agents/00-orchestrator/CLAUDE.md`, `agents/00-orchestrator/contracts.md`, `agents/00-orchestrator/BACKLOG.md`, `agents/00-orchestrator/SKILL.md`, `agents/01-designer/CLAUDE.md`, `agents/02-product-manager/CLAUDE.md`, `agents/02-product-manager/SKILL.md`, `agents/04-testing/CLAUDE.md`, and this file. The real `scope.js` is not in this repo and was not changed.
Reason: A separate all-access role for the assistant would let a buyer's chat return broker data, which is the leak the role rules exist to prevent.
Expiration: Until the Kialae code removes `aiagent` and adds `lender`; then the "legacy" wording is deleted.

## 2026-10-26 — Demo mode: no sign-in, a role-switcher session on Vercel

Context: The chat-agent demo must run on Vercel before real sign-in exists. The spec had refused the stub session on Vercel, following the rule that fake sign-in must never work there (`DEV_FAKE_AUTH`, `agents/03-developer/CLAUDE.md` and `contracts.md`).
Decision: Removed the Vercel refusal for the chat-agent demo session only. The UI's role switcher calls a server endpoint that validates one of exactly four roles (broker, seller, buyer, lender) and sets a signed, HttpOnly session cookie; the agent reads the role only from that cookie. This is a stand-in, kept separate from `DEV_FAKE_AUTH`, which stays impossible on Vercel for the real app (that rule is unchanged). The session needs an owner-set `AGENT_SESSION_SECRET` on Vercel and refuses without it. Chat history and the seen-field-names set are keyed by session and role; every role switch starts a new session. Public endpoints get per-client rate limits, a daily model-call cap, no keys in responses or logs, and redacted deal data only. See `docs/adr/0006-demo-session-without-sign-in.md`.
Reason: Moe wants a working public demo now; real sign-in comes later. The trade-off is accepted: anyone can pick any role, so the broker-only audit page is as strong as the switcher, and only redacted data may be served.
Expiration: Until real sign-in replaces the demo session (`backend/reminders.md` R6).

