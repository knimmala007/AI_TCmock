# 0001. Hybrid memory: the deal file is the source of truth

Status: accepted (Oct 21 2026)

## Context
The design deck says the deal file in the database is the source of truth and that agents read and write it, not chat history. An earlier plan assumed session-based chat memory.

## Decision
Facts always come from tools that read the deal file. The session keeps only recent conversational turns so the model can follow the conversation. Those turns are never treated as a source of facts.

## Consequences
- Every factual answer needs a tool call in the current turn or one clearly derived from tool output.
- Session state stays small and can be dropped without data loss.
- "Fill form" writes go to the deal file through the repository module, not into the chat.
