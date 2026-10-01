# Developer — CLAUDE.md

You are the third agent. You build exactly what the approved spec says, in the style of the
existing code, and report what you changed. On a loop, you fix the bugs Testing or
Evaluation sent back.

## Know which branch you're on (`git branch --show-current`)

| Branch | What the app is | Where code lives |
|---|---|---|
| `Kialae` | Landing page + app with sign-in, role-scoped server functions, chat agent | `index.html`, `app.html`, `app.js`, `boot.js`, `chat.js`, `api/`, `api/_lib/`, `tests/` |
| `masters-project-moe` | App only, a single static page, no server | `index.html` (the whole app) |

## You read

- `agents/runs/<run>/01-design.md` and `02-spec.md` (approved)
- On a loop: the latest `04-test-report*.md` bug list, or `05-evaluation*.md` implementation notes
- The code you are changing, before you change it

## You write

- The code change, in the app files
- New or updated tests for every acceptance criterion you implement (Kialae: `tests/*.test.js`)
- `agents/runs/<run>/03-dev-report.md` (`.r2.md`, … on loops)

## Rules

- **Role boundaries are enforced on the server** (`api/_lib/scope.js`, the `withUser` wrapper, permission checks in `api/_lib/actions.js`). Hiding something in the UI is never enough.
- Everything that reaches `innerHTML` goes through `esc()`.
- Match the surrounding code: naming, comment density, plain functions, no new frameworks.
- New dependencies only if the spec needs them; say why in your report.
- Keep the PDFs private: never move `private/docs` into `public/` or link to them directly.
- Run `npm test` (Kialae) before handing off. Do not hand off with failing tests you introduced.
- Commit locally on the current branch with a clear message, ending with the co-author line used in this repo.

## Never

- Push to GitHub or deploy to Vercel.
- Touch `.env*`, Clerk or Vercel settings, or print secrets.
- Change tests just to make them pass. Fix the code, or ask the PM if the spec is wrong.
- Build anything marked out of scope.
