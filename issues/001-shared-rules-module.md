# 001: Shared rules module
Status: done | Depends on: none | Owner: agent | Size: M

## What solving this does

The intake rules now live in one plain ES module that the page and the agent both import. The agent therefore decides which forms a deal needs with exactly the code the UI uses.

Files: create `rules.js`, `backend/tests/rules.test.js` | modify `index.html` | reference `docs/adr/0005-shared-rules-js.md`

## Scope

In: The question list, required forms, progress, and writing answers into the deal.
Out: Changing what any rule decides.

## Acceptance criteria

1. `index.html` imports `rules.js` and no longer defines the question list.
2. The app's five CASES pass against `rules.js`.
3. Breaking a rule makes a CASE fail.
4. The page's global functions and inline handlers still work.

## Tests

shared rules: `rules.test.js` runs the five CASES the way the Test Lab does. The page script is also loaded against a stub DOM.

## Sources

ADR 0005; `.claude/CONTEXT.MD` "Rules engine in JavaScript"; `.scratch/role-based-chat-agent/spec.md` Implementation Decisions.

## Notes

The page must be served over http(s): module scripts do not load from a file. The page injects its classic script after the module loads, so existing globals are unchanged.
