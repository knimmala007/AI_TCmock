---
name: orchestrator
description: Run the five development agents in series (Designer → Product Manager → Developer → Testing → Evaluation), route questions between them, and loop back on failures.
---

# Orchestrator skill

## 1. Start the run

1. Make a short name from the request, e.g. `lead-paint-reminder`.
2. Create `agents/runs/<YYYY-MM-DD>-<short-name>/`.
3. Write the request word for word to `00-request.md`.
4. Start `00-log.md` with: date, current git branch (`git branch --show-current`), and the request.
5. Tell the user, in one line, the run folder and that the Designer is starting.

## 2. Run each agent

Launch each agent with the Agent tool, using its `subagent_type`:

| Step | subagent_type | Give it |
|---|---|---|
| 1 | `designer` | the run folder path |
| 2 | `product-manager` | the run folder path |
| 3 | `developer` | the run folder path, plus the bug list or evaluation notes when looping |
| 4 | `tester` | the run folder path and the round number |
| 5 | `evaluator` | the run folder path and the round number |

Prompt pattern for every agent:

```
Run folder: agents/runs/<run>/
Round: <n>
Follow agents/<NN-name>/CLAUDE.md and agents/<NN-name>/SKILL.md.
Read the reports already in the run folder. Write your report to <file>.
<extra: bug list / evaluation notes / answer to your question, when looping>
```

Run them one at a time (`run_in_background: false`), because each one needs the previous report.

After each agent:

1. Read its report. Check it has a `Status:` line.
2. Log one line in `00-log.md`.
3. Handle `## Questions` (section 4) before moving on.

## 3. Approval gates

After **Designer** and after **Product Manager**, stop and show the user:

- a five-line summary of the report,
- the file path,
- the question: approve, or what to change?

If they ask for changes, re-run the same agent with their notes (`01-design.r2.md`, etc.)
and ask again. Do not continue until they approve. Log the approval.

## 4. Questions between agents

For each `- To: <agent> — <question>` line:

1. Launch that agent with: `Answer this question from <asker> for run <run>: <question>.
   Reply in a short note; do not redo your whole report unless the answer requires it.`
2. Log the question and the answer.
3. Re-run the asker with the answer appended to its prompt.
4. If the answer changes an approved design or spec, show it to the user first.

## 5. Loops

**Testing FAIL**: send the developer the bug list from the test report (round n+1). Re-run
Testing. After 3 failed rounds, stop and report to the user.

**Evaluation FAIL**: the evaluation names a cause: `design`, `spec` or `implementation`.
- `design` → Designer, then the user's approval, then PM, Developer, Testing, Evaluation.
- `spec` → PM, then the user's approval, then Developer, Testing, Evaluation.
- `implementation` → Developer, then Testing, Evaluation.
After 2 failed evaluations, stop and report to the user.

New reports in a loop get a round suffix (`03-dev-report.r2.md`); earlier ones stay.

## 6. Finish

When Evaluation passes, write the final summary into `00-log.md` and tell the user:

```
Run <run>: PASS after <n> test round(s) and <m> evaluation round(s).
What changed: <2–4 bullets from the dev report>
Files changed: <list from the dev report>
Tests: <result line from the test report>
Evaluation: <score line>
Next (yours): review the diff, commit/push, deploy.
```

If you stopped at a limit, use the same layout with `STOPPED` and what is still failing.
