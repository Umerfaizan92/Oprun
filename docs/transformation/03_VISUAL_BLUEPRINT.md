# 03 · Visual transformation blueprint (draft until the reference screenshot is received)

The brief describes a premium dark AI dashboard: deep navy and graphite backgrounds, purple, cyan and subtle blue
accents, compact cards, elegant charts, light motion, both themes. The reference screenshot was not attached, so
values below are a proposal to be matched to it.

## 1. Principles

1. One identity everywhere: public site, sign-in, Business Workspace, Operator Console, emails, apps.
2. Compact: content first, short labels, no long descriptions, no permanent suggestion panels.
3. One tool per page where a page holds several tools (the Media Studio pattern from T-202).
4. Motion is light and purposeful: fades and short slides under 250 ms, no looping animation, reduced-motion respected.
5. Accessibility is part of the design: AA contrast in both themes, visible focus, 44 px touch targets.

## 2. Palette proposal (dark theme first)

| Token | Proposed | Use |
|---|---|---|
| `--bg` | `#0B0F1A` (deep navy) | Page background |
| `--surface` | `#121826` (graphite navy) | Cards |
| `--surface-2` | `#1A2133` | Raised elements, inputs |
| `--line` | `rgba(148,163,184,.14)` | Borders |
| `--text` | `#E8ECF5` | Main text |
| `--muted` | `#98A2B8` | Secondary text (AA on `--surface`) |
| `--accent` | `#8B5CF6` (purple) | Primary actions, selected states |
| `--accent-2` | `#22D3EE` (cyan) | Highlights, charts, AI moments |
| `--info` | `#60A5FA` (soft blue) | Links, info states |
| `--success` / `--warning` / `--danger` | `#34D399` / `#FBBF24` / `#F87171` | Status |
| Gradient | `linear-gradient(135deg,#8B5CF6,#22D3EE)` | Logo mark, AI badges, chart highlights only |

Light theme: same hues, darker accents for AA on white (`#6D28D9` purple, `#0E7490` cyan).
Gold (`#E6B455`) leaves the interface if the owner approves; today it marks actions and the approval gate.

## 3. Typography and icons

- Today: Manrope for UI text and Bodoni Moda (serif) for display headings (`saas/ds/tokens.css`). Proposal for the
  dashboard look: Manrope everywhere (already loaded, no new font), serif headings kept only on the public website
  if the owner likes them; tabular numbers for figures; sizes 12/14/16/20/24/32.
- One icon set (`saas/ds/icons.svg`), 1.75 px stroke, 20 px default; official logos only for third-party brands.

## 4. Components (one library)

Buttons (primary, secondary, ghost, danger), inputs and selects, tabs (the single tab pattern already used by
Media Studio and page sections), cards and stat cards with a trend, tables with sticky header and row actions,
badges, timeline, charts (line, bar, donut; one palette), dialogs and sheets (sheet on phone), toasts, empty
states (one line plus one action), skeleton loading, and the AI suggestion chip (dismissible, remembered).

## 5. Page patterns

| Pattern | Used by |
|---|---|
| **Dashboard**: 4 stat cards, one chart, one "needs you" list; phone shows 3 items first | Command Centre, Operator executive dashboard, Agent Command Center |
| **List + detail**: filterable table, detail in a side panel (sheet on phone) | Enquiries, customers, jobs, invoices, tickets, subscribers |
| **Tabbed tool page**: one tool per tab | Media Studio, Website, Money, Phone & SMS, Settings |
| **Step flow**: one question per screen, progress, save and resume | Onboarding, business setup, AI Receptionist setup, website wizard |
| **Marketing page**: hero with a real product screenshot, feature rows, proof only from real data, one call to action | Public website |

## 6. Devices

Phone: bottom dock (the app standard), sheets instead of side panels, one column. Tablet: collapsible side rail.
Laptop: side navigation and two-column layouts where useful. Android and iOS apps use the same shell markers
already shipped in the first wave (`saas/ds/platform.js`).

## 7. What stays the same

Routes, element IDs, API endpoints, the Oprun name, the approval-first rules, and every working workflow.
