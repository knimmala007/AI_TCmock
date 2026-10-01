# Development decisions

Append-only. Architectural choices that close off a future direction.

```
## YYYY-MM-DD — <one-line summary>

Context: <run / feature>
Choice: <what was decided>
Reason: <why; what alternative was rejected>
```

---

## 2026-10-01 — Baseline architecture recorded

Context: Development agents set up; architecture already built on `Kialae`.
Choice:
- Static front end with no framework.
- Vercel Node functions with the Web Request/Response API.
- Clerk for sign-in, with the role in public metadata.
- Upstash Redis for state.
- A scripted chat agent, run on the server.
- PDFs private, served via `/api/doc`.

Reason: Role scoping enforced in one place (`scope.js`), and the browser never receives another role's data.
