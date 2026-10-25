# Cross-agent contracts

Surfaces two or more agents must agree on. Owned by the Orchestrator. Any change goes
through the Orchestrator first, and is logged in `decisions.md`.

---

## 1. Role scoping

**Agents:** Product Manager, Developer, Testing, Evaluation. (Designer indirectly.)

**Shape:** what each role may see is defined once, on the server:

- `ROLE_VIEWS` in `api/_lib/scope.js`:
  - `broker`: seller, buyer and broker views;
  - `seller`: seller view;
  - `buyer`: buyer view;
  - `lender`: lender view (the loan file only: the appraisal, `APPR`);
  - `aiagent`: seller, buyer and broker views. **Legacy, being retired** (the Kialae code still has it). Nothing new may use it.

  The chat assistant never uses a separate role: it runs with the signed-in person's role. The audit trail page is broker-only.
- `scopeFor(role, state)` builds the only payload a role receives.
- Every endpoint is wrapped in `withUser` (`api/_lib/auth.js`); every action re-checks permission (`api/_lib/actions.js`).

**Change protocol:** a new role, view or field visibility is spec'd by the PM (Role access
table), built by the Developer in `scope.js` first, and covered by a role-isolation test.
Testing and Evaluation always check it.

---

## 2. Run folder and report format

**Agents:** all.

**Shape:** `agents/runs/<date>-<name>/` holds `00-request.md`, `00-log.md`, `brief-*.md`,
`01-design.md`, `02-spec.md`, `03-dev-report.md`, `04-test-report.md` and `05-evaluation.md`.
Later rounds get `.r2.md`, `.r3.md`. Every report starts with `Status:` and `Round:` lines,
and may end with `## Questions` (`- To: <agent> — <question>`).

**Change protocol:** template changes are made in the agent's `SKILL.md` and logged here.

---

## 3. Acceptance criteria IDs

**Agents:** Product Manager, Developer, Testing, Evaluation.

**Shape:** the spec numbers criteria `AC1`, `AC2`, …. The Developer reports per AC, Testing
tests per AC, and Evaluation scores spec coverage per AC. IDs stay stable across rounds;
new criteria are added at the end.

---

## 4. Local test environment

**Agents:** Developer, Testing, Evaluation.

**Shape (Kialae):**
- `npm test`: acceptance tests in `tests/*.test.js`, run with `DEV_FAKE_AUTH=1` and in-memory storage.
- `npm run build && DEV_FAKE_AUTH=1 node dev/server.mjs`: local app at `http://127.0.0.1:8790`, with a role picker.
- Requests can set the role with the `x-dev-role` header or the `dev_role` cookie.
- Fake sign-in is refused on Vercel (`DEV_AUTH` in `auth.js`).

**Change protocol:** changes to the dev server, test helpers or fake sign-in are Developer
work, approved through a run, and must keep fake sign-in impossible on Vercel.

---

## 5. Design tokens

**Agents:** Designer, Developer.

**Shape:** `agents/01-designer/system/tokens.md` lists the colours, radii and components in
use. The CSS variables in `app.html` / `index.html` (`--brand`, `--ink`, `--line`, …) mirror them.

**Change protocol:** token changes start with the Designer, are approved by Moe, then
mirrored by the Developer. No new colours in code without a token.

---

## 6. Documents and privacy

**Agents:** all.

**Shape:**
- Deal PDFs are redacted (no names, signatures or dates).
- They live in `private/docs/`, outside git and outside `public/`, and are served only through `/api/doc` after a role check.
- No personal names or real deal dates in UI copy, designs, tests or screenshots.

**Change protocol:** any change to how documents are stored or served needs Moe's approval.

---

> TODO (fill later): add a contract for each new shared surface, e.g. e-signature provider, email provider, file storage, messaging.
