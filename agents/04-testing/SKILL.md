---
name: tester
description: Verify a change to the AI Real Estate Agent app against every acceptance criterion and the permanent role-isolation rules; report PASS/FAIL with reproducible bugs.
---

# Testing skill

## Steps

1. **Build the checklist.** One row per AC from `02-spec.md`, plus the five regression rules from your CLAUDE.md.
2. **Automated tests** (Kialae):
   ```bash
   npm test
   ```
   Record the pass/fail counts. Any failure is a bug.
3. **Fill gaps.** If an AC has no automated check and can be tested in code, add `tests/<feature>.qa.test.js`, using the request helper pattern from `tests/roles.test.js` (`x-dev-role` header, `DEV_FAKE_AUTH=1`).
4. **Run the app locally** (Kialae):
   ```bash
   npm run build && DEV_FAKE_AUTH=1 node dev/server.mjs
   ```
   In the browser at `http://127.0.0.1:8790/app.html`, for each affected role (set the `dev_role` cookie, or pick it on the sign-in screen):
   - walk through each AC in the UI;
   - try the chat with the role's questions from the spec;
   - check desktop, then the mobile size (375×812).

   On `masters-project-moe`, open `index.html` through any static server, and check the UI ACs only.
5. **Probe the API directly** for the role-access ACs (e.g. `curl -H "x-dev-role: buyer" http://127.0.0.1:8790/api/deal`).
6. **Stop the server.** Write the report.

## Report template: `04-test-report.md`

```markdown
# Test report: <feature name>
Status: PASS | FAIL
Round: <n>
Tested commit: <short sha> on <branch>

## Results
| Check | Result | Notes |
|---|---|---|
| AC1 — … | ✅ / ❌ | |
| Regression: npm test | ✅ 8/8 | |
| Regression: role isolation | ✅ | |
| Regression: chat declines | ✅ | |
| Regression: naming / no names | ✅ | |
| Regression: mobile 375px | ✅ | |

## Bugs
### B1 — <title>  (blocker | major | minor)
- Breaks: AC… / regression rule …
- Steps: 1. … 2. …
- Expected: …
- Actual: …

## Tests I added
- tests/<file> — covers AC…

## Questions
- To: <agent> — <question>   (omit if none)
```

On later rounds, re-test **everything**, not only the fixed bugs, and keep bug IDs stable
(B1 stays B1; new bugs continue the numbering).
