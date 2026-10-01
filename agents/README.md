# Development agents

A six-agent process for building changes to the AI Real Estate Agent app. Five agents
work **in series**; the **Orchestrator** runs them, carries questions between them, and
sends work back when testing or evaluation fails.

```
            ┌──────────────────────── Orchestrator (00) ────────────────────────┐
            │  runs the pipeline · routes questions · decides loops · logs      │
            └───────────────────────────────────────────────────────────────────┘
 request ─► 01 Designer ─► [you approve] ─► 02 Product Manager ─► [you approve]
                                                     │
            ┌────────────────────────────────────────┘
            ▼
         03 Developer ─► 04 Testing ──fail──► back to 03 (bug list)      max 3 rounds
                              │ pass
                              ▼
                         05 Evaluation ──fail──► back to 01, 02 or 03     max 2 rounds
                              │ pass                (whichever caused it)
                              ▼
                     done: summary for you to review, push and deploy
```

## How to run it

In Claude Code, from this folder:

```
/orchestrate <what you want built or changed>
```

Example: `/orchestrate add a reminder in the seller view when the lead-paint disclosure is unsigned`

The Orchestrator creates a run folder, `agents/runs/<date>-<short-name>/`, writes a **brief**
for each agent (`brief-<agent>.md`), and every agent writes its hand-off report there. That
folder is the full record of the run.

To work through the feature list, pick an item from
[`00-orchestrator/BACKLOG.md`](00-orchestrator/BACKLOG.md) and run `/orchestrate` on it.

## The agents

| # | Agent | Produces | Folder |
|---|---|---|---|
| 00 | Orchestrator | `00-log.md`: every step, decision, question and loop | [00-orchestrator](00-orchestrator) |
| 01 | Designer | `01-design.md`: screens, layout, states, copy | [01-designer](01-designer) |
| 02 | Product Manager | `02-spec.md`: requirements, acceptance criteria, scope | [02-product-manager](02-product-manager) |
| 03 | Developer | the code change + `03-dev-report.md` | [03-developer](03-developer) |
| 04 | Testing | `04-test-report.md`: PASS or FAIL with a bug list | [04-testing](04-testing) |
| 05 | Evaluation | `05-evaluation.md`: scores, PASS or FAIL, who must redo what | [05-evaluation](05-evaluation) |

Each agent folder has two main files:

- **`CLAUDE.md`**: identity, project context, the agents around it, the loop, its 10 standing rules, and pointers.
- **`SKILL.md`**: role, scope (owns / does not do), its brief, method, report template, Definition of Done, hand-off and rejection protocols, tools, and operating posture.

Supporting files:

| File | Owner | What it is |
|---|---|---|
| `GLOSSARY.md` | all | Shared terms, binding on every agent |
| `00-orchestrator/BACKLOG.md` | Orchestrator | What's being built, in what order |
| `00-orchestrator/decisions.md` | Orchestrator | Overrides, scope cuts and backlog moves, logged |
| `00-orchestrator/contracts.md` | Orchestrator | Surfaces agents must agree on (role scoping, report format, AC IDs, test env, tokens, documents) |
| `01-designer/system/tokens.md` | Designer | Colours, radii and components the UI uses |
| `01-designer/decisions.md` | Designer | Design decisions |
| `03-developer/decisions.md` | Developer | Architecture decisions |
| `04-testing/coverage-gaps.md` | Testing | Known blind spots |
| `05-evaluation/thresholds.md` | Moe | The pass bar (versioned) |
| `05-evaluation/trends.md` | Evaluation | Scores per run, over time |

Sections marked **TODO (fill later)** are deliberate placeholders for things that don't exist
yet (e.g. a Figma link, numeric performance bars, a linter).

`.claude/agents/` holds the five agent definitions Claude Code launches, and
`.claude/skills/orchestrate/` holds the `/orchestrate` command. Both point to the folders above,
so edit the `CLAUDE.md` / `SKILL.md` files to change how an agent behaves.

## How agents talk to each other

Agents never call each other directly. When one is blocked or finds a problem upstream, it
writes a **Questions** section in its report:

```
## Questions
- To: product-manager — The spec says "notify the seller". In-app request, or email too?
```

The Orchestrator sees it, asks the named agent, writes the answer into `00-log.md`, and
re-runs the asking agent with the answer. If an answer changes an approved design or spec,
the Orchestrator asks you first.

## Ground rules for every agent

- The app's role boundaries are the most important rule: a seller never sees buyer data, and a buyer never sees seller data, in the UI, the API or the chat.
- The product is called **AI Real Estate Agent**. Do not use "Transaction Coordinator" in anything a user sees.
- No personal names, signatures or real dates from the deal documents in UI, copy or screenshots.
- Nothing is pushed to GitHub or deployed to Vercel by an agent. You do that after reviewing the run.
