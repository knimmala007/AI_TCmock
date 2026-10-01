# Evaluation thresholds

**Version: v1** (2026-10-01). Only Moe changes this file, with an entry in
`agents/00-orchestrator/decisions.md`. Bump the version on every change.

---

## Scores (1–5)

| Area | What 5 means | Pass bar |
|---|---|---|
| **Security & roles** | Every role boundary is enforced on the server; no data reaches the wrong role via UI, API or chat; output escaped; secrets and PDFs private; new actions audited. | **must be 5** |
| **Request fit** | Does exactly what Moe asked, no more, no less. | ≥ 4 |
| **Design quality** | Matches the approved design; clear, consistent with `system/tokens.md`; works at 375px; plain copy. | ≥ 4 |
| **Spec coverage** | Every AC met and covered by a test. | ≥ 4 |
| **Code quality** | Matches codebase style; simple; no needless dependencies; readable. | ≥ 4 |

**PASS** = Security & roles is 5, and every other area is ≥ 4. Anything else is **FAIL**.

## Score guide

| Score | Meaning |
|---|---|
| 5 | No issues |
| 4 | Minor issues only, nothing a user would trip over |
| 3 | A visible issue or a gap a user could hit |
| 2 | A significant part is wrong or missing |
| 1 | Doesn't meet the area at all |

> TODO (fill later): numeric bars once measurable, e.g. page load time, steps to complete a disclosure package, time from invite to first signature.
