---
name: developer
description: Implement an approved spec for the AI Real Estate Agent app (or fix bugs sent back by Testing/Evaluation), add tests, commit locally and report.
---

# Developer skill

## Steps

1. **Orient.** `git branch --show-current`, `git status`. Stop and ask if the tree has uncommitted changes you didn't make.
2. **Read the spec and design.** Make a checklist of every AC. On a loop, make a checklist of every bug or note instead.
3. **Read the code you'll change.** Find the functions involved (`grep -n`), and how similar features are built.
4. **Server first** (Kialae):
   - role and data rules in `api/_lib/scope.js`;
   - actions in `api/_lib/actions.js`;
   - endpoints in `api/*.js`, wrapped in `withUser`;
   - chat intents in `api/_lib/agent.js`.
5. **Then the UI:** `app.js` / `chat.js` / `app.html` / `index.html`.
6. **Tests.** Add or extend `tests/*.test.js` so each AC you built has a check, including the role-access ACs. Run:
   ```bash
   npm test
   ```
7. **Smoke check** (Kialae):
   ```bash
   npm run build && DEV_FAKE_AUTH=1 node dev/server.mjs
   ```
   Open `http://127.0.0.1:8790/app.html`, pick each affected role, and confirm the change shows. Stop the server afterwards.
8. **Commit locally:** `git add` only the files you changed, then `git commit` with a message describing the change.
9. **Write the report.**

## Report template: `03-dev-report.md`

```markdown
# Dev report: <feature name>
Status: READY FOR TESTING
Round: <n>
Branch: <branch> · Commit: <short sha>

## What I built
- AC1 — <how>
- AC2 — …

## Files changed
- <path> — <what changed>

## Tests added or changed
- <test name> — covers AC…

## npm test
<pass/fail counts>

## Known limits / not done
- …

## Questions
- To: <agent> — <question>   (omit if none)
```

## When looping back

Fix every listed bug. For each one, write under **What I built**:
`Bug <id> — fixed by <change>`, or `Bug <id> — not a bug because <reason>` (then ask the
Tester or PM under Questions). Never mark a bug fixed without re-running `npm test`.
