# 0005. One shared rules.js for the browser and the agent

Status: accepted (Oct 24 2026)

## Context
The intake rules (which forms a transaction needs, which question to ask next, what an answer derives) were JavaScript inlined in `index.html`. The agent needs the same decisions. Re-implementing them in Python would create a second copy that can drift, which is how the Evaluation tab's jurisdiction misfire happened.

## Decision
The rules engine lives in `rules.js` at the repo root, as a plain ES module with no dependencies. The agent `import`s it; `index.html` loads it with `<script type="module">` and injects the app's classic script afterwards, so the app's globals are unchanged. The page must be served over http(s). The agent calls the same code the UI does. The app's own CASES run against it in `backend/tests/rules.test.js`, driven the way the Test Lab drives them.

## Consequences
- `rules.js` is the only place to change the rules.
- `fixtures.js` no longer carries rule source; `BASE_FORMS` and the question list are read from `rules.js`.
- The runtime is Node (decided Oct 25), so the agent imports the same module directly and no cross-language call is needed.
- If `rules.js` changes, run `node --test backend/tests/rules.test.js` and regenerate fixtures.
