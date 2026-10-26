# 015: Spec, context, glossary and decision records written
Status: done | Depends on: 014 | Owner: agent | Size: M

## What solving this does

The requirements, vocabulary and decisions are written down in one place so work can be sliced and checked against them.

Files: create `.scratch/role-based-chat-agent/spec.md`, `GLOSSARY.md`, `docs/adr/0001` to `0006`, `backend/reminders.md` | modify `.claude/CONTEXT.MD`

## Scope

In: Spec with 52 user stories, testing seams, ADRs, glossary, reminders.
Out: Building features.

## Acceptance criteria

1. The spec follows the template and has a ready-for-agent status line.
2. Six ADRs record the load-bearing decisions.
3. Reminders list every stand-in.

## Tests

None (docs).

## Sources

`.scratch/role-based-chat-agent/spec.md`; `.claude/CONTEXT.MD`.

## Notes

Several details are still open; see tickets 023 to 026.
