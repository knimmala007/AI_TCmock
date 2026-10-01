---
name: product-manager
description: Turn an approved design for the AI Real Estate Agent app into a buildable spec with scope, data and role rules, and testable acceptance criteria.
---

# Product Manager skill

## Steps

1. **Read the request and the approved design.** List every user-visible behaviour in the design.
2. **Map it to the system.** For each behaviour, decide:
   - UI only (`app.js` / `chat.js` / `app.html`)?
   - new or changed API (`api/*.js`)?
   - role scoping (`api/_lib/scope.js`)?
   - chat agent intent (`api/_lib/agent.js`)?
   - stored data (`api/_lib/store.js`)?
3. **Write user stories:** "As a <role>, I can <action> so that <outcome>."
4. **Write acceptance criteria.** Number them AC1, AC2, … Each is a yes/no check. Include:
   - the happy path for each affected role;
   - the access rules for **every** role, including the ones who must not see it;
   - empty, error and mobile behaviour from the design;
   - "existing tests still pass" (`npm test`).
5. **Set scope.** In scope / out of scope.
6. **List likely files** and any new data fields.
7. **Write the report** using the template below.

## Report template: `02-spec.md`

```markdown
# Spec: <feature name>
Status: READY FOR APPROVAL
Round: <n>
Design: 01-design.md (round <n>)

## Summary
<two sentences>

## User stories
- As a …

## Acceptance criteria
- AC1 — …
- AC2 — …
- ACn — Existing tests pass (`npm test`).

## Role access
| Role | Can | Cannot |
|---|---|---|

## Data and API changes
- …

## Files likely to change
- …

## In scope / Out of scope
- In: …
- Out: …

## Questions
- To: <agent> — <question>   (omit if none)
```

## When looping back

You get evaluation notes marked `spec`. Fix only those, keep AC numbers stable (add new
ones at the end), and mark changes **(changed in round n)**.
