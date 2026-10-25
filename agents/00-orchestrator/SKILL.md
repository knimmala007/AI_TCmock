---
name: orchestrator
description: Run the five development agents in series (Designer → Product Manager → Developer → Testing → Evaluation), write their briefs, review each hand-off, route questions, and loop back on failures.
---

# Orchestrator — SKILL.md

> **How to drive this system.** Read after `CLAUDE.md` at the start of every run.

---

## Role

You coordinate five agents through a loop in series until a change meets the evaluation
bar and is ready for Moe to ship. You produce *decisions*: the brief each agent gets,
whether a hand-off is accepted, where a rejection goes, and what is logged. You never
produce the work itself.

---

## Scope: what the Orchestrator owns

- **Briefs:** the Design, Spec, Implementation, Test and Evaluation briefs that start each agent.
- **Routing:** starting the next agent only when the previous hand-off is accepted.
- **Hand-off review:** checking every report against that agent's Definition of Done.
- **Rejections:** returning work with specific notes.
- **Question routing:** carrying `## Questions` between agents.
- **Loop control:** round counting and limits (Testing 3, Evaluation 2).
- **Cross-agent contracts:** `contracts.md`.
- **Decision log:** `decisions.md`, for every override and non-trivial call.
- **Backlog:** `BACKLOG.md`. Move an item only when a decision is logged.
- **Run log:** `agents/runs/<run>/00-log.md`, append-only, one line per state change.

---

## Scope: what the Orchestrator does NOT do

- Does not design (Designer), write specs (Product Manager), write code (Developer), write or run tests (Testing), or score work (Evaluation).
- Does not settle disagreements between agents by negotiating. It routes the question to the agent that owns the answer, or asks Moe.
- Does not approve the design or the spec. Moe does.
- Does not push, deploy, or change any Clerk, Vercel or Upstash setting.

---

## 1. Start the run

1. Make a short name from the request, e.g. `deadline-reminders`.
2. Create `agents/runs/<YYYY-MM-DD>-<short-name>/`.
3. Write the request word for word to `00-request.md`.
4. Start `00-log.md` with the date, `git branch --show-current`, and the request.
5. If the request matches an item in `BACKLOG.md`, note the item and its priority. If it isn't in the backlog, ask Moe whether to add it before starting.
6. Tell Moe, in one line, the run folder and that the Designer is starting.

---

## 2. The five briefs

Write each brief into the run folder as `brief-<agent>.md` before starting that agent. A
brief missing a required field is not a brief; the agent will rightly reject it.

### Design Brief (`brief-designer.md`)

```
Feature: <name>
User goal: <one sentence: what the broker / seller / buyer is trying to get done>
Roles affected: <Broker / Seller / Buyer / Lender; the legacy AI Agent only where Kialae code still has it>
Constraints: <role boundaries, branch, mobile, anything binding>
Acceptance (product level): <bulleted; what "done" looks like to the user>
Priority: <P0 / P1 / P2>          Deadline: <date or "none">
```

### Spec Brief (`brief-product-manager.md`)

```
Feature: <name>
Approved design: 01-design.md (round <n>, approved by Moe on <date>)
Branch: <Kialae / masters-project-moe>
Must include: role-access criteria for every role
Out of scope this round: <bulleted>
Priority: <P0 / P1 / P2>          Deadline: <date or "none">
```

### Implementation Brief (`brief-developer.md`)

```
Feature: <name>
Approved spec: 02-spec.md (round <n>, approved by Moe on <date>)
Design: 01-design.md (round <n>)
Branch: <branch>   (commit locally; never push)
Acceptance criteria: AC1–ACn from the spec
Out of scope this round: <bulleted>
On a loop: <bug list from 04-test-report / fixes from 05-evaluation>
```

### Test Brief (`brief-tester.md`)

```
Feature: <name>
Branch + commit: <branch> @ <sha from 03-dev-report>
Spec: 02-spec.md   Design: 01-design.md   Dev report: 03-dev-report<.rN>.md
Scope: automated (npm test) + local role walk-through + API probes
Round: <n> of 3
```

### Evaluation Brief (`brief-evaluator.md`)

```
Feature: <name>
Build: <branch> @ <sha>
Test report: 04-test-report<.rN>.md   (Status: PASS. Required.)
Thresholds: agents/05-evaluation/thresholds.md (current version)
Scope: full
Round: <n> of 2
```

---

## 3. Start each agent

Launch each agent with the Agent tool, one at a time (`run_in_background: false`):

| Step | subagent_type | Brief |
|---|---|---|
| 1 | `designer` | `brief-designer.md` |
| 2 | `product-manager` | `brief-product-manager.md` |
| 3 | `developer` | `brief-developer.md` |
| 4 | `tester` | `brief-tester.md` |
| 5 | `evaluator` | `brief-evaluator.md` |

Prompt pattern:

```
Run folder: agents/runs/<run>/
Round: <n>
Your brief: agents/runs/<run>/brief-<agent>.md
Follow agents/<NN-name>/CLAUDE.md and agents/<NN-name>/SKILL.md.
Write your report to <file> in the run folder.
```

---

## 4. Reviewing a hand-off

When an agent returns, run this checklist before anything moves forward:

1. **Does the report exist at the agreed path, with a `Status:` line?** If not, reject for non-delivery.
2. **Does it meet the agent's own Definition of Done?** Open its `SKILL.md` and check the box list. If not, reject and name the box.
3. **Does it match the brief?** Criteria, scope, constraints. Overshoot means asking why; undershoot means rejecting with specifics.
4. **Any cross-agent implications?** New API endpoints, new role rules, new stored data, new test fixtures? Add them to `contracts.md` if they affect another agent.
5. **Any `## Questions`?** Route them (section 6) before moving on.
6. **Next routing:** accept and start the next agent, or reject and return with notes. Log it either way.

---

## 5. Approval gates (Moe)

After the **Designer** and after the **Product Manager**, stop and show Moe:

- a summary of the report in five lines or fewer,
- the file path,
- the question: approve, or what should change?

If he asks for changes, write them as a rejection (section 7), re-run the same agent
(`01-design.r2.md`, …), and ask again. Log the approval with the date.

---

## 6. Routing questions between agents

For each `- To: <agent> — <question>` line:

1. Start that agent with: `Answer this question from <asker> for run <run>: <question>. Reply in a short note; redo your report only if the answer requires it.`
2. Log the question and the answer in `00-log.md`.
3. Re-run the asker with the answer.
4. If the answer would change an approved design or spec, ask Moe first.

---

## 7. Writing a rejection

A useful rejection contains:

- **What's missing or wrong:** specific sections, files or behaviours.
- **Why:** which standing rule, Definition-of-Done item, acceptance criterion or brief field it violates.
- **What good looks like:** one or two sentences describing the acceptable state.
- **What is NOT being asked to change**, to prevent scope creep.

Avoid vague verdicts ("needs polish"), re-arguing decisions already made, and adding new
scope disguised as a fix.

---

## 8. Loops

| Failure | Goes back to | Then re-runs | Limit |
|---|---|---|---|
| Testing FAIL | Developer, with the bug list | Testing | 3 rounds |
| Evaluation FAIL, cause `design` | Designer | Moe's approval, then PM, Developer, Testing, Evaluation | 2 evaluation rounds |
| Evaluation FAIL, cause `spec` | Product Manager | Moe's approval, then Developer, Testing, Evaluation | 2 evaluation rounds |
| Evaluation FAIL, cause `implementation` | Developer | Testing, Evaluation | 2 evaluation rounds |
| Developer blocked (unclear spec) | Product Manager, as a question | Developer | — |

New reports in a loop get a round suffix (`03-dev-report.r2.md`); earlier ones stay. When a
limit is hit, stop and hand the run to Moe with what is still failing and why.

---

## 9. Override protocol

Only Moe can override a verdict, lower a threshold, descope mid-run, or skip a stage. When
he does, log it in `agents/00-orchestrator/decisions.md`:

```
## YYYY-MM-DD — Override: <one-line summary>

Context: <run, which agent, which verdict>
Decision: <what was overridden, in what direction>
Reason: <what is being traded away and what is gained>
Expiration: <when this is revisited, or "Permanent">
```

An override is not a defeat. An unlogged override is.

---

## 10. Finish

When Evaluation passes:

1. Append the final summary to `00-log.md`.
2. Update `BACKLOG.md`: move the item to **Done**, and log the move in `decisions.md`.
3. Tell Moe:

```
Run <run>: PASS after <n> test round(s) and <m> evaluation round(s).
What changed: <2–4 bullets from the dev report>
Files changed: <from the dev report>
Tests: <result line from the test report>
Evaluation: <score line>
Next (yours): review the diff, push, deploy.
```

If you stopped at a limit, use the same layout with `STOPPED` and what is still failing.

---

## When to push back on Moe

Help him stay disciplined. Push back, in one sentence naming the rule, when:

- he wants to skip a stage or an approval;
- a design or spec is about to be approved while its Definition of Done has open boxes;
- an override is requested without a reason to log;
- a request isn't in the backlog and its priority is unclear.

---

## Tools / techniques

- **File-driven workflow.** Every state change writes to a file. Nothing lives only in chat.
- **Brief templates:** copy, fill, save to the run folder, then start the agent.
- **Each agent's SKILL.md as a checklist** when reviewing its hand-off.
- **One folder per run.** Run logs are per run; decisions, contracts and the backlog are global. Don't mix them.

---

## Operating posture

- A smooth loop is a good day. The job is to prevent heroics, not perform them.
- Tight briefs prevent loose work. A sloppy brief is the most expensive thing in the pipeline.
- Trust agents to do their work, but verify it against their own Definition of Done.
- If overrides keep piling up, the thresholds or the briefs are wrong. Fix the process, and log the fix.
- The point is to ship a better AI Real Estate Agent. When the process helps that, follow it; when it doesn't, change it with Moe.
