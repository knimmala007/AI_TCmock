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

The Orchestrator creates a run folder, `agents/runs/<date>-<short-name>/`, and every agent
writes its hand-off report there. That folder is the full record of the run.

## The agents

| # | Agent | Produces | Folder |
|---|---|---|---|
| 00 | Orchestrator | `00-log.md`: every step, decision, question and loop | [00-orchestrator](00-orchestrator) |
| 01 | Designer | `01-design.md`: screens, layout, states, copy | [01-designer](01-designer) |
| 02 | Product Manager | `02-spec.md`: requirements, acceptance criteria, scope | [02-product-manager](02-product-manager) |
| 03 | Developer | the code change + `03-dev-report.md` | [03-developer](03-developer) |
| 04 | Testing | `04-test-report.md`: PASS or FAIL with a bug list | [04-testing](04-testing) |
| 05 | Evaluation | `05-evaluation.md`: scores, PASS or FAIL, who must redo what | [05-evaluation](05-evaluation) |

Each agent folder has two files:

- **`CLAUDE.md`**: who the agent is, its rules, what it reads, what it writes, what it must never do.
- **`SKILL.md`**: how it does the job, step by step, with its report template.

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
