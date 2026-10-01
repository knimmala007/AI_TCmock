# Design tokens and components

The visual system the app and landing page use today. Mirrors the CSS variables in
`app.html` and `index.html`. Binding on the Designer and Developer (see contract 5 in
`agents/00-orchestrator/contracts.md`).

---

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f6f7f9` | Page background |
| `--panel` | `#ffffff` | Cards, panels, modals |
| `--ink` | `#0f172a` | Main text; header background (navy) |
| `--muted` | `#64748b` | Secondary text |
| `--line` | `#e2e8f0` | Borders, dividers |
| `--brand` | `#4338ca` | Primary buttons, links, "Awaiting signature" |
| `--brand-dark` | `#3730a3` | Primary button hover (landing) |
| `--brand-soft` | `#eef2ff` | Brand tints, chips, agent chat bubbles |
| `--ok` / `--ok-soft` | `#059669` / `#ecfdf5` | Signed, Ready, Received |
| `--warn` / `--warn-soft` | `#b45309` / `#fffbeb` | Needs input, warnings |
| `--bad` / `--bad-soft` | `#be123c` / `#fff1f2` | Errors, blocked |
| `--navy-2` | `#1e293b` | Header sub-surfaces (tabs, badges) |
| `--navy-muted` | `#94a3b8` | Text on navy |

Colour is never the only signal: every pill keeps its text label.

## Type

System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif`.
App body 14px / 1.5. Landing body 16px / 1.6. Monospace for document codes (`ui-monospace, Menlo`).

> TODO (fill later): a full type scale (headings, captions) if the app grows.

## Radius and spacing

| Element | Radius |
|---|---|
| Cards | 12px |
| Chat bubbles, document cards, modals' inner blocks | 10–12px |
| Buttons, inputs | 8px |
| Pills, chips, badges | 99px (full) |

Card padding 18–24px. Section spacing 16px between cards.

> TODO (fill later): a formal spacing scale.

## Components in use

| Component | Class / where | States |
|---|---|---|
| Primary button | `.act` | default, hover, disabled |
| Secondary button | `.ghost` | default, hover |
| Card | `.card` | — |
| Status pill | `.pill` + `.p-ok` / `.p-warn` / `.p-brand` / `.p-idle` / `.p-bad` | one per status |
| Banner | `.banner` + `.b-info` / `.b-warn` / `.b-lock` | info, warning, locked (role-limited) |
| Key–value row | `.kv` | — |
| Metric tile | `.metric` | — |
| Document table | `docTable()` in `app.js` | ready, needs input, signed, awaiting signature, ready to send |
| Document viewer | modal: signed original (PDF) + interactive form tabs | loading, not available for role |
| Role tabs + "Viewing as" badge | header | active tab |
| Chat panel | `#chat` in `chat.js`: messages, quick-action chips (`.chip`), document cards (`.dcard`) | typing, error, desktop side panel, mobile full screen |

## Status pills (doc status → pill)

| Status | Label | Class |
|---|---|---|
| `signed` | Signed | `p-ok` |
| `needs_info` | Needs input | `p-warn` |
| `awaiting_signature` | Awaiting signature | `p-brand` |
| `ready_to_send` | Ready to send | `p-idle` |
