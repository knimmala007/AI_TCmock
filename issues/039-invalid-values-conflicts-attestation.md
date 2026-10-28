# 039: Invalid values, conflicts and attestation
Status: review pending | Depends on: 034, 025 | Owner: agent | Size: M

## What solving this does

The assistant rejects a value that does not fit, flags a value that contradicts the deal, and will not fill a field only a person may attest.

Files: modify `backend/tools.js` | create `backend/tests/tools_validation.test.js`

## Scope

In: `INVALID_VALUE`, `FACT_CONFLICT`, `HUMAN_ATTESTATION_REQUIRED`, `MISSING_FACT` guidance.
Out: Legal judgment (030).

## Acceptance criteria

1. A choice question rejects a value not in its options.
2. A value contradicting an existing fact returns `FACT_CONFLICT`.
3. Only the seller session may save `waterHeater`, `smokeAlarm` and `coDetector`; every other role gets `HUMAN_ATTESTATION_REQUIRED`. Signature blocks are never filled by the assistant (ADR 0010).
4. A missing fact points to `ask_next_question`.

## Tests

handler.

## Sources

`.scratch/role-based-chat-agent/spec.md` Status codes; ticket 025.

## Notes

The attestation list is decided in ADR 0010. The constant is created in ticket 033 (it needs it to skip the fields) and enforced here.
