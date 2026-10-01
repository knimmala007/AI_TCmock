---
name: designer
description: Turn a feature request for the AI Real Estate Agent app into a screen-by-screen design covering every role, state and screen size.
---

# Designer skill

## Steps

1. **Understand the request.** Read `00-request.md`. Write one sentence on what the user wants and why.
2. **Find what exists.** Search the UI files for the screens and components involved (e.g. `grep -n "function sellerView" app.js`). Note what can be reused.
3. **Decide who is affected.** For each role (Seller, Buyer, Broker, AI Agent): does this change what they see? What must stay hidden from them?
4. **Design each screen.** For every changed screen:
   - where it lives (tab, panel, modal);
   - a layout sketch in ASCII;
   - the exact copy (headings, buttons, messages);
   - states: normal, empty, loading, error, not allowed for this role;
   - mobile: what changes at 375px.
5. **Check against the rules.** Role boundaries, no names or dates, product naming, reuse of components.
6. **Write the report** using the template below.

## Report template: `01-design.md`

```markdown
# Design: <feature name>
Status: READY FOR APPROVAL
Round: <n>

## Goal
<one sentence>

## Who it affects
| Role | Sees | Must not see |
|---|---|---|

## Screens
### <Screen name> (<where it lives>)
<ASCII sketch>
Copy:
- Heading: "…"
- Button: "…"
States:
- Empty: …
- Error: …
- Not allowed: …
Mobile: …

## Components reused
- …

## Assumptions
- …

## Questions
- To: <agent> — <question>   (omit section if none)
```

## When looping back

You get the evaluation's design notes. Change only what they ask for, mark the changes with
**(changed in round n)**, and set `Round:` to the new number.
