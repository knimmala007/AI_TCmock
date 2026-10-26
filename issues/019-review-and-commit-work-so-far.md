# 019: Review and commit the work so far
Status: todo | Depends on: 018 | Owner: human | Size: S

## What solving this does

The owner reviews the large uncommitted tree and commits it in sensible groups, so later work has a clean history. A local settings file is kept out of every commit.

Files: create none | modify none (git only) | reference `git status`, `.claude/settings.json`

## Scope

In: Reviewing and committing existing work.
Out: Pushing; changing any file.

## Acceptance criteria

1. The owner has looked at `git status` and the diff.
2. `.claude/settings.json` is not committed; the owner decides separately whether to git-ignore it.
3. No `.env` or key is staged.
4. Ethan has confirmed nobody else is changing `canAccess` in `index.html`.
5. Commits are authored by the configured user, with no AI attribution, and nothing is pushed without the owner.
6. A grouping is agreed, for example: rules and page; backend; api; docs, spec and ADRs; issues.

## Tests

Run `npm test` before the first commit; it should pass.

## Sources

Project git rules in `.claude/CLAUDE.md`.

## Notes

The tree holds untracked `rules.js`, `backend/`, `api/`, `docs/`, `.scratch/`, `GLOSSARY.md`, `package.json`, plus modified `index.html` and `decisions.md`.
