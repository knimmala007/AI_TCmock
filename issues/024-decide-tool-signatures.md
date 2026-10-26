# 024: Decide the tool signatures
Status: todo | Depends on: 018 | Owner: human | Size: M

## What solving this does

The owner confirms what each tool takes and returns, so the tools can be built without guessing.

Files: modify the spec (Tools), `.claude/CONTEXT.MD` (Still open item 1) | reference `backend/roles.js`

## Scope

In: Inputs, outputs and errors for every tool in the registry.
Out: Building them.

## Acceptance criteria

1. Every tool for all four roles has inputs, outputs and error cases written.
2. The meaning of `request_approval` and `hand_off` is stated (what changes, for whom).
3. The output of `flag_missing` and `ask_broker` is stated, including where `ask_broker` delivers.
4. The source of `explain_form` text is stated.
5. How forms with no template are reported is stated.
6. `ask_next_question`: the app picks the first pending question in order, but the spec says to pick by how many forms it unblocks. One is chosen and recorded.

## Tests

None (decision).

## Sources

`.claude/CONTEXT.MD` Still open; `.scratch/role-based-chat-agent/spec.md` Tools, Further Notes.

## Notes

Blocks 031 and 040.
