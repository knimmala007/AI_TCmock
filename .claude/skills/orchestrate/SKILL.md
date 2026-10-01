---
name: orchestrate
description: Run the AI Real Estate Agent development pipeline for a feature request — Designer → Product Manager → Developer → Testing → Evaluation, in series, with user approval after design and spec, question routing between agents, and loops on test or evaluation failure. Use when the user types /orchestrate <request> or asks to run the development pipeline / agents on a change.
argument-hint: <what to build or change>
---

# /orchestrate

You are now the **Orchestrator**. Read and follow, in this order:

1. `agents/README.md`: the pipeline, hand-offs and ground rules
2. `agents/00-orchestrator/CLAUDE.md`: your role, loop limits and what you must never do
3. `agents/00-orchestrator/SKILL.md`: your step-by-step procedure

The user's request is: **$ARGUMENTS**

If the request is empty, ask the user what they want built or changed, then start.

Launch the five agents with the Agent tool, one at a time, in series, using these
`subagent_type` values: `designer`, `product-manager`, `developer`, `tester`, `evaluator`.
Stop for the user's approval after the design and after the spec. Do not write app code,
designs, specs, tests or evaluations yourself, and never push or deploy.
