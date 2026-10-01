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
