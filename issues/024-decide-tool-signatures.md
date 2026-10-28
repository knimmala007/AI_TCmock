# 024: Decide the tool signatures
Status: done | Depends on: 018 | Owner: human | Size: M

## What solving this does

The owner confirms what each tool takes and returns, so the tools can be built without guessing.

Files: modify the spec (Tools; use `get_deal`, not "get deal"), `.claude/CONTEXT.MD` (Still open item 1), `docs/adr/0002-guardrails-enforced-in-code.md` (`config.py` to `config.js`; the "Oct 25" / "confirmed Oct 26" dates) | reference `backend/roles.js`

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

## Left to do (Oct 26)

Stale text applied: the spec and CONTEXT use `get_deal`; ADR 0002 says `config.js` and its dates are fixed; the envelope, `save_answers`, `ask_broker`, `explain_form`, `request_approval` and the next-question rule are decided (ADR 0008). Not done, so the ticket stays `todo` (acceptance criteria 1, 3, 5): inputs, outputs and errors for `get_deal_status`, `flag_missing`, `acknowledge_disclosure`, `mark_clear_to_close` and `hand_off`, and how forms with no template are reported in each tool. The owner decides these.
