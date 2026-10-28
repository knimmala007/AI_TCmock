# Issues: role-based chat agent

74 tickets: 35 done, 33 to do, 5 blocked, 1 closed (032). Source of requirements: `.scratch/role-based-chat-agent/spec.md`, `.claude/CONTEXT.MD`, ADRs 0001 to 0006, `backend/reminders.md`. Words follow `GLOSSARY.md`.

| # | Title | Status | Depends on | Owner |
|---|-------|--------|------------|-------|
| 001 | [Shared rules module](001-shared-rules-module.md) | done | none | agent |
| 002 | [Buyer-financing question gives the Lender the appraisal](002-buyer-financing-appraisal.md) | done | 001 | agent |
| 003 | [Shared fixtures from the real deal](003-shared-fixtures.md) | done | 001 | agent |
| 004 | [Four roles with their tools and data filters](004-four-roles-and-filters.md) | done | 003 | agent |
| 005 | [Tested jurisdictions come from the app's cases](005-tested-jurisdictions-from-cases.md) | done | 001 | agent |
| 006 | [Ten status codes and the write guard](006-status-codes-and-write-guard.md) | done | 004 | agent |
| 007 | [Deal storage: memory, file and Upstash behind one repository](007-deal-storage-and-upstash.md) | done | 003 | agent |
| 008 | [Event log with key redaction](008-event-log-with-redaction.md) | done | 007 | agent |
| 009 | [Demo session and role switcher](009-demo-session-and-role-switcher.md) | done | 003, 004 | agent |
| 010 | [Broker-only audit log page and button](010-broker-only-audit-log.md) | done | 008, 009 | agent |
| 011 | [Chat memory and seen-field set per session and role](011-chat-memory-per-session-and-role.md) | done | 004, 007 | agent |
| 012 | [Rate limits, daily cap and data scrubbing helpers](012-rate-limits-daily-cap-scrubbing.md) | done | 007 | agent |
| 013 | [Local server and `npm start`](013-local-server-and-npm-start.md) | done | 009, 010 | agent |
| 014 | [Reword the "AI Agent" role as legacy](014-reword-ai-agent-role-as-legacy.md) | done | none | agent |
| 015 | [Spec, context, glossary and decision records written](015-spec-and-decision-records.md) | done | 014 | agent |
| 016 | [Broker sees every document on both sides](016-broker-sees-every-document.md) | done | 004, 013 | agent |
| 017 | [Stale documentation fixed](017-stale-documentation-fixed.md) | done | 015 | agent |
| 018 | [Forms with no template are flag-only (decision)](018-untemplated-forms-flag-only.md) | done | 003 | agent |
| 019 | [Review and commit the work so far](019-review-and-commit-work-so-far.md) | todo | 018 | human |
| 020 | [Add a health-check function](020-health-check-function.md) | done | 013 | agent |
| 021 | [Deploy the health check to a Vercel preview](021-deploy-health-check-to-vercel-preview.md) | todo | 019, 020 | human |
| 022 | [Extractor lists city-dependent codes; refresh the form-code notes](022-extractor-city-codes-and-context-refresh.md) | done | 002, 003 | agent |
| 023 | [Design the approval and lock state shapes](023-design-approval-and-lock-state-shapes.md) | done | 018 | human |
| 024 | [Decide the tool signatures](024-decide-tool-signatures.md) | todo | 018 | human |
| 025 | [Decide stages and attestation fields](025-decide-stages-and-attestation-fields.md) | done | 018 | human |
| 026 | [Find the platform audit log's shape](026-find-audit-log-shape.md) | todo | 018 | human |
| 027 | [Chat endpoint gives a plain reply (umbrella for 027a to 027d)](027a-chat-endpoint-plain-reply.md) | done (027a to 027d) | 008, 009, 011, 012 | agent |
| 027b | [Real model client](027b-real-model-client.md) | done | 027a | agent |
| 027c | [Loop with one stub tool](027c-loop-with-one-stub-tool.md) | done | 027a | agent |
| 027d | [Four per-role system prompts](027d-per-role-system-prompts.md) | done | 027c | human |
| 028 | [Owner sets environment variables](028-owner-sets-environment-variables.md) | todo | 021, 027b | human |
| 028a | [One manual real model run](028a-one-manual-real-model-run.md) | todo | 027b, 027c, 028 | human |
| 029 | [Chat panel in the app](029-chat-panel-in-the-app.md) | done | 027a | agent |
| 029b | [Chat history read](029b-chat-history-read.md) | done | 029 | agent |
| 029c | [Show chat history in `index_v2.html`](029c-show-chat-history-in-index-v2.md) | todo | 029b, 063 | agent |
| 030 | [No-legal-advice code guard](030-no-legal-advice-guard.md) | done | 027c | agent |
| 030a | [Polite off-topic refusal](030a-polite-off-topic-refusal.md) | done | 027d, 030 | agent |
| 031 | [Broker can ask the assistant about the deal (`get_deal`)](031-get-deal-scoped-to-role.md) | done | 024, 025, 027c | agent |
| 031a | [Buyer-attack handler tests](031a-buyer-attack-handler-tests.md) | done | 031 | agent |
| 032 | [Tool-call limits and repeat stop](032-tool-call-limits-and-repeat-stop.md) | closed by 027c; logging moves to 062 | 027c | agent |
| 033 | [`ask_next_question` picks the question in code](033-ask-next-question-by-unblock-count.md) | done | 024, 031 | agent |
| 034 | [`save_answers` saves a fact](034-save-answers-saves-a-fact.md) | done | 033 | agent |
| 035 | [Forms with no template are flagged, not filled](035-untemplated-forms-flagged-not-filled.md) | done | 034 | agent |
| 036 | [`save_answers` field-name guard and batch cap](036-save-answers-field-guard-and-batch-cap.md) | done | 034 | agent |
| 037 | [`save_answers` write refusals](037-save-answers-write-refusals.md) | todo | 034, 023 | agent |
| 038 | [Untested jurisdictions decline with no rules](038-untested-jurisdiction-declines.md) | done | 034 | agent |
| 039 | [Invalid values, conflicts and attestation](039-invalid-values-conflicts-attestation.md) (note: duplicate names in a batch are already rejected, 036) | todo | 034, 025 | agent |
| 040 | [`flag_missing` lists what is missing](040-flag-missing.md) | todo | 024, 031 | agent |
| 041 | [Workflow status panel shows the stages](041-workflow-status-panel-stages.md) | todo | 025, 029, 031 | agent |
| 042 | [Evaluation against the Cottage Grove deal](042-evaluation-against-cottage-grove.md) | todo | 038, 040 | agent |
| 043 | [Request approval and the broker's Approve click](043-request-approval-and-approve-click.md) | done | 023, 029, 031 | agent |
| 043b | [Approve button in `index_v2.html`](043b-approve-button-in-index-v2.md) | todo | 043, 063 | agent |
| 044 | [Deploy and smoke-test demo mode](044-deploy-and-smoke-test-demo-mode.md) | todo | 028, 030, 042, 043, 064 | human |
| 045 | [Tune the limits with the owner](045-tune-limits-with-owner.md) | todo | 044 | human |
| 046 | [Freeze snapshot and Reopen buttons](046-freeze-snapshot-and-reopen-buttons.md) | todo | 023, 037, 043 | agent |
| 047 | [Release forms button](047-release-forms-button.md) | todo | 043 | agent |
| 048 | [Waive a form or override a refusal button](048-waive-or-override-button.md) | todo | 043 | agent |
| 049 | [Send a message button](049-send-message-button.md) | todo | 043 | agent |
| 050 | [`ask_broker` hands a question to the broker](050-ask-broker-inbox.md) | done | 031 | agent |
| 050b | [Broker inbox view in `index_v2.html`](050b-broker-inbox-view-in-index-v2.md) | todo | 050, 063 | agent |
| 051 | [Status and form explanations for seller, buyer and lender](051-status-and-explanations-for-other-roles.md) | todo | 050 | agent |
| 052 | [Seller answers intake questions](052-seller-answers-intake.md) | todo | 034, 051 | agent |
| 053 | [Buyer acknowledges a disclosure](053-buyer-acknowledges-disclosure.md) | todo | 051 | agent |
| 054 | [Lender view in the app](054-lender-view-in-the-app.md) | todo | 029 | agent |
| 055 | [Lender marks clear to close](055-lender-marks-clear-to-close.md) | todo | 051, 054 | agent |
| 056 | [Berkeley and Oakland cases](056-berkeley-and-oakland-cases.md) | todo | 005 | agent |
| 057 | [Replace the demo session with real sign-in](057-replace-demo-session-with-real-sign-in.md) | blocked | 027 | agent |
| 058 | [Replace the deal store with the real backend](058-replace-deal-store-with-real-backend.md) | blocked | 027 | agent |
| 059 | [Write events to the platform's audit log](059-write-events-to-platform-audit-log.md) | blocked | 026, 027 | agent |
| 060 | [Real loan-checklist code for the Lender](060-real-lender-checklist-code.md) | blocked | 055 | agent |
| 061 | [Remove `aiagent` and add `lender` in the Kialae `scope.js`](061-remove-aiagent-from-kialae-scope.md) | blocked | 014 | human |
| 062 | [Log refused turns (rate limit, daily cap, call limit, tool-call limit, repeat stop) and tool calls in events.js](062-log-refused-turns.md) | done | 027c | agent |
| 063 | [Port the chat panel and role switcher to `index_v2.html`](063-port-chat-and-role-switcher-to-index-v2.md) | done | 029 | agent |
| 064 | [Only the broker can read logged free text (tests and the inbox property)](064-keep-free-text-out-of-event-payloads.md) | done | 062 | agent |

## Why this order

The order follows what unblocks what, and keeps every ticket's dependencies at lower numbers.

1. **001-018 are done**, in the order they were built, so the history is traceable.
2. **019-026 come first among the open work**: a clean commit, an early health-check deploy (020-021) to find hosting problems before anything depends on them, and the human decisions (023-026) that block the tools and guards.
3. **027-030 make the chat work end to end** (a plain reply, the owner's variables, the chat panel, the legal-advice guard) before any tool exists, so the app is demoable early.
4. **031-042 build the broker's tools one slice at a time**: read the deal, limits, ask, save, then the refusals, then evaluation.
5. **043 and 044-045**: approval, then the owner's deployment and tuning, so the demo is checked before the extra buttons.
6. **046-056 add the remaining buttons and the other three roles.**
7. **057-061 are blocked** on things outside this repo.

## How to work these

1. Take the lowest-numbered ticket whose status is `todo` and whose dependencies are all `done`. Do not skip ahead.
2. One ticket per working session. Each one ends with the app working and `npm test` passing.
3. `Owner: human` tickets need the owner. An agent prepares what it can and then stops.
4. When a ticket is finished, set its status to `done`, update this table, and move the matching row in `backend/reminders.md` to Done.
5. Do not commit or push unless the owner asks. Never commit `.claude/settings.json` or any `.env`.
6. Each ticket's `Files:` line says what to create, modify and reference. Touch nothing else.
7. Tests use one of two seams: the request **handler**, or the **shared rules**. Tests never call the real model.

## Not in this backlog

- The Kialae app items in `agents/00-orchestrator/BACKLOG.md` (e-signature, uploads, notifications, deadlines, reporting, MLS data, act on behalf). They belong to that app. Only messaging and broker approval overlap, and they are tickets 043 and 049.
- Whether this work follows the Kialae `/orchestrate` pipeline, `BACKLOG.md` and `decisions.md` is for the owner to decide.

## Conflicts and open items still on the list

Each is a ticket:

- Tool inputs, outputs and meanings, including whether the next question is the first pending one (as the app does) or the one that unblocks most forms (as the spec says): **024**.
- How approvals, locks and the snapshot are stored: **023**.
- Stages each role sees, and which fields need a person to attest: **025**.
- The platform audit log's shape: **026**, then **059**.
- Hosting and the Node version on Vercel: **020**, **021**.
- Values I chose for limits and the thread: **045**.
- The large uncommitted tree and the local settings file: **019**.
- The Lender: no loan-checklist code (**060**) and no Lender view (**054**).
- Real sign-in (**057**), the real backend (**058**), and the Kialae `scope.js` (**061**).
- The form-code notes in CONTEXT that say `APPR` is never produced by the rules: **022**.
