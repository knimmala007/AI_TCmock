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
When finished: set the ticket to done, update issues/README.md and the matching
row in backend/reminders.md, and report the test result.
If docs and code disagree, stop and report; do not choose silently.