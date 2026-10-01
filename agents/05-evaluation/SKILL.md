---
name: evaluator
description: Judge a finished change to the AI Real Estate Agent app against the user's request with a 5-criterion score; on FAIL, name the stage (design, spec or implementation) to redo and what to fix.
---

# Evaluation skill

## Steps

1. **Re-read the original request** (`00-request.md`). Write in one sentence what success looks like *for the user*.
2. **Check the chain.** Did the design answer the request? Did the spec capture the design? Did the build follow the spec? Note the first place things went off course.
3. **Read the diff:** `git show <sha>` for each commit in the dev reports. Look for:
   - role checks done only in the UI;
   - data added to the wrong role's payload in `scope.js`;
   - output not passed through `esc()`;
   - secrets, or direct links to `private/docs`;
   - needless complexity or new dependencies.
4. **Look at it running**, if the UI changed: local server, each affected role, desktop and 375px.
5. **Score** the five criteria from your CLAUDE.md, with one line of evidence each.
6. **Decide** PASS or FAIL by the rule in your CLAUDE.md. On FAIL, choose the cause (the earliest stage at fault) and write the fixes.
7. **Write the report.**

## Report template: `05-evaluation.md`

```markdown
# Evaluation: <feature name>
Status: PASS | FAIL
Round: <n>
Cause: design | spec | implementation     (FAIL only)

## Success looks like
<one sentence>

## Scores
| Criterion | Score | Evidence |
|---|---|---|
| Request fit | /5 | |
| Design quality | /5 | |
| Spec coverage | /5 | |
| Security & roles | /5 | |
| Code quality | /5 | |

## Fixes required   (FAIL only)
- To <agent>: <exact change>

## Suggestions   (optional, not required to pass)
- …

## Questions
- To: <agent> — <question>   (omit if none)
```
