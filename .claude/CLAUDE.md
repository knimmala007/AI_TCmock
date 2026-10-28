## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Git rules (strict)

- Commit only as the configured git user (my account). Never change user.name or user.email, and never pass --author.
- Do not add "Co-Authored-By", "Generated with Claude Code" or any AI attribution to commit messages or PR text. Commit history must show my username only.
- Never run git push, git push --force, git reset --hard, git rebase, or switch branches without my explicit approval in the same message.
-Before any commit, run git status and confirm no .env file or API key is staged.

## Backend:-
- Run tests with: npm test

Read first: .claude/CONTEXT.MD, then the ticket you were given. Open the spec,
GLOSSARY and ADRs only when the ticket cites them.
Work one ticket per session, lowest todo with all dependencies done.
Run npm test before starting (baseline) and before finishing.
Touch only the files in the ticket's Files line.
Never commit, push, or edit .env*, .claude/settings.json, vercel.json, or Vercel/, or without asking.
Clerk/Upstash settings. Never call the real model API in tests.
When finished: set only your own ticket to "review pending", list what issues/README.md,
backend/reminders.md, the spec, CONTEXT and the ADRs need in your report, and report the test
result. The owner marks the ticket done after the checkpoint (see Ticket rules below, which win
if this section and they ever differ).
If docs and code disagree, stop and report; do not choose silently.
## Checkpoint before every commit
When the user asks for the checkpoint agent on a ticket, run it, show its full report to the user, and wait. Do not stage, commit, merge, delete a worktree or start another ticket. The user commits and merges.

## Ticket rules (every ticket session)
1. First run `pwd` and `git branch --show-current`. Stop unless the branch is ticket/NNN for the ticket you were given.
2. Read issues/NNN-*.md, this file and .claude/CONTEXT.MD. The decision memos are in .scratch/options/ (a dot-folder: list it with `ls -a`); the ADRs in docs/adr are the authority. Stop and tell me if the ticket is missing or its dependencies are not met.
3. Run npm test first for a baseline.
4. Follow the ticket's Files line. Do not edit issues/README.md, backend/reminders.md, the spec, CONTEXT, ADRs or any other ticket: list what needs updating in your report. Set only your own ticket to "review pending".
5. Invariants: role and deal come only from the frozen session turn; every model call goes through modelGate; role-filter before redactDeal; tool errors are fixed text with no data; limits from config.js; no key or process.env outside config; only the ten status codes; no "AI agent" role.
6. Tests go through the handler seam with the scripted fake model; no real network or model call; never assert on prompt wording. Run a mutation check for anything that returns data or enforces a rule.
7. Never read .env files or print environment values. Never stage, commit, merge, push or delete a worktree. When the work is done, say so and wait for me to run the checkpoint agent.
8. Exceptions: an edit outside the Files line, or to the README, reminders, spec, CONTEXT or an ADR, is
   allowed only when the owner asks for it in that session. List every such edit in the report under
   "outside the Files line" so the checkpoint can match it to the owner's request.
