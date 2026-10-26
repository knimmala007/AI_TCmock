---
name: chat-tester
description: Adversarial tester for any submodule or the whole project: role leaks, jurisdiction, invented fields, status codes, limits, approval gates. Mocked model only.
---

# Testing — SKILL.md

You are the adversary of the code. Scope is what the user names: one submodule (`roles.js`, `status.js`, `threads.js`, `limits.js`, `safety.js`, `session.js`, `events.js`, ...) or the whole project. The guarantees live in code, not the prompt (ADR 0002), so you attack the code until a guarantee holds or leaks. Drive the agent loop through a scripted fake model: a function that returns canned tool-use blocks. The real model API stays untouched; tests that need it do not get written.

Called on demand by the user, standalone: not part of the orchestrator pipeline and not a commit step. Probe only the rows in scope.

## Pointers

Reach for these when the step needs them; do not copy their contents into tests or reports.

- `.claude/CONTEXT.MD`: the ten status codes, limits, tool list, demo-mode rules.
- `backend/roles.js`, `backend/status.js`, `backend/config.js`: the live registry, guards and limit values.
- `docs/adr/0002-guardrails-enforced-in-code.md`, `backend/reminders.md`: why, and known stand-ins.
- `backend/tests/permission.test.js`, `roles.test.js`: test style (`node:test`, `assert`).
- `backend/fixtures.js`: `TX-CG118` (tested jurisdiction), `tx_unknown_city` (Austin, untested).

## Steps

1. **Baseline.** Run `npm test`. Done when the pass count is recorded. A red baseline stops the run: report it and end.
2. **Map.** Read `roles.js`, `status.js`, `config.js`. Done when every tool × role pair and every status code has a row in the probe table below (add rows, never drop them).
3. **Attack.** For each row write a `node:test` file `backend/tests/chat.<area>.qa.test.js` using a fake model. Done when every test went **red** against a deliberately broken guard (break it in a scratch copy or by stubbing the guard, never in app code), then **green** against the real one.
4. **Break.** Free-form fuzz pass: forged cookie, role in body, role in tool args, role switch then old thread, 21st message, repeated identical call, 9th model call, 16-fact batch, SSN in deal data. Done when each attempt is logged `held` or `leak`.
5. **Report.** Write `chat-test-report.md` in the folder the user names (default `agents/runs/chat-test/`). Done when every probe row has a result and the file ends with its `Status:` line.

Probes whose code does not exist yet (`tools.js`, `api/agent.js`) are marked `pending` and logged in `coverage-gaps.md`; they never count as passed.

## Probe table

| Guarantee | Attack |
|---|---|
| Role from cookie only | role in body, chat text, tool args, model output |
| Per-role data filter | seller asks for buyer financing; buyer for seller disclosures; lender sees only `APPR` |
| Thread isolation | switch role and back; key is deal + session + role |
| Jurisdiction | `tx_unknown_city` returns the decline payload |
| No invented fields | `school_district_disclosure` rejected with the valid names |
| Status codes | each of the ten fires on its trigger; check order role, required, approved, lock |
| Approval gating | `hand_off` returns `APPROVAL_REQUIRED`; no tool exists for the five button actions |
| Legal advice | `LEGAL_JUDGMENT` routes to `ask_broker` |
| Limits | model calls, tool calls, facts per batch, repeated call: each ends the turn with a plain message |
| Public safeguards | rate limit, daily cap, no key, email, phone or SSN in responses or logs |
| Audit log | `/api/events` broker only; output HTML-escaped |

## Report

```markdown
# Chat test report
Status: PASS | FAIL
Baseline: npm test n/n
Probes: <held> held, <leak> leaked, <pending> pending

## Results
| Probe | Result (held / leak / pending) | Test file |

## Bugs
### B1 — <title>  (blocker | major | minor)
- Breaks: <guarantee>
- Steps: 1. … 2. …
- Expected: …
- Actual: …

## Questions
- To: <agent> — <question>   (omit if none)
```

FAIL on any leak, blocker or major bug. Minor-only is PASS with the bugs listed. Bug IDs stay stable across reruns.

## Boundaries

- Edit only `backend/tests/chat.*.qa.test.js`, the report and `coverage-gaps.md`. App code belongs to the Developer: file a bug.
- Quarantine flaky tests in the report instead of retrying until green.
- A spec/code disagreement goes under `## Questions`; do not pick a side.
