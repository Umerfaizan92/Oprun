# 05 · Adaptive UI/UX system

Builds on `saas/ds/tokens.css` (colours, WCAG AA pairs in both themes). This document replaces the 117
breakpoints and the 44 stacked stylesheets with one system.

## 1. Principles
1. One codebase and one database. The **layout** adapts automatically; data and features are the same everywhere.
2. Decide by **capability** (width, pointer, hover, safe areas, standalone/app shell), not by guessing the brand
   of a device.
3. The user never picks a "mobile mode". Detection is automatic and runs before the first paint (no layout jump).

## 2. Device classes and shells

`saas/ds/platform.js` is a small, render-blocking script (under 1 KB) in `<head>` that sets two attributes on
`<html>`:

| Attribute | Values | Rule |
|---|---|---|
| `data-device` | `phone` (< 700 px) · `tablet` (700–1023 px) · `desktop` (≥ 1024 px) | Width of the layout viewport; updates on resize/rotation (`matchMedia` listeners, no polling) |
| `data-shell` | `browser` · `pwa` · `android-app` · `ios-app` | See below |
| `data-pointer` | `touch` · `fine` | `(pointer: coarse)` |

Shell detection:
- **Android app (TWA)**: the app opens `https://www.oprun.ai/saas/workspace.html?shell=android-app`. Set this in
  `mobile/android/app/src/main/AndroidManifest.xml` (`trusted.DEFAULT_URL`, today `…/saas/workspace.html`). On first load the value is saved in `sessionStorage`, then removed from the
  address with `history.replaceState`. `document.referrer` starting with `android-app://ai.oprun.app` is a
  second signal.
- **iOS app (WKWebView)**: the app adds `OprunApp-iOS/<version>` to the user agent
  (`WKWebViewConfiguration.applicationNameForUserAgent` in `mobile/ios`).
- **PWA**: `display-mode: standalone` and neither app signal.
- **Browser**: everything else.
- A spoofed shell value only changes layout. It never grants permissions; the server never trusts it.

CSS uses the attributes, for example `[data-device=phone] .nav{…}`, `[data-shell=ios-app] .topbar{…}`, and
container queries for components (a card adapts to its own width, not the screen).

## 3. Layout per class

| | Desktop | Tablet | Phone (browser/PWA) | Android app | iOS app |
|---|---|---|---|---|---|
| Navigation | Left sidebar 248 px, groups expanded | Icon rail 72 px, flyouts | Bottom tab bar (5) + More | Bottom navigation (5) + More; the system back gesture goes back through screens (history) | Tab bar (5) + More; the native swipe-back gesture (`allowsBackForwardNavigationGestures`) |
| Content width | Max 1200 px; optional right panel from 1440 px | Full width, 24 px gutters | Full width, 16 px gutters | As phone | As phone, with safe areas (`env(safe-area-inset-*)`) |
| Lists → detail | Side panel | Overlay sheet | Full-screen push | Full-screen push | Full-screen push with large title |
| Forms | 2 columns where fields are short | 2 columns | 1 column, sequential steps | Same | Same |
| Primary action | In the page header | In the page header | Sticky bottom bar above the tab bar | Same | Same, above the home indicator |
| Dialogs | Centred modal | Centred modal | Bottom sheet | Bottom sheet | Bottom sheet |
| Hover effects | Yes (`hover: hover`) | Only with a pointer | None | None | None |
| Pull to refresh | No | No | Browser default | Page handles it | Native (already in the iOS app) |
| Top bar | Breadcrumb + search | Title + search icon | Title + one action | Title + one action | Large title that collapses on scroll |

Android "native style" = Material conventions within the web layout: left-aligned titles, a 56 px top bar,
ripple-free press states, and the system back gesture. iOS "native style" = centred or large titles, 44 pt minimum
touch targets, the system font stack fallback, and sheets with a grabber.

## 4. Typography (fluid, one scale)

| Token | Size | Use |
|---|---|---|
| `--t-display` | `clamp(28px, 2vw + 20px, 40px)` | Page hero (public pages only) |
| `--t-h1` | `clamp(22px, 1vw + 18px, 28px)` | Page title |
| `--t-h2` | `clamp(18px, .5vw + 16px, 22px)` | Section title |
| `--t-body` | 16 px (never smaller in inputs, so iOS does not zoom) | Text, inputs |
| `--t-small` | 14 px | Meta text |
| `--t-micro` | 12 px, only for badges | Badges |

- Fonts: Manrope for UI; Bodoni Moda only for public headings (already in `tokens.css`). Line height 1.5 for body
  and 1.2 for headings. Max 72 characters per line for reading text.
- Arabic and Urdu (already supported in `locale-catalog.js`): `dir="rtl"` mirrors the layout using logical CSS
  properties (`margin-inline-start`, etc.).

## 5. Spacing, sizing and buttons
- Spacing scale (4-pt): 4, 8, 12, 16, 24, 32, 48, 64 (`--s-1` … `--s-8`). Phone gutters 16; tablet 24; desktop 32.
- Touch targets ≥ 44×44 px on touch devices; ≥ 32 px high on desktop with a fine pointer.
- Buttons: **Primary** (gold, one per screen) · **Secondary** (outline) · **Quiet** (text) · **Danger** (red,
  always with a confirm step). Heights: 48 phone/app, 44 tablet, 40 desktop. Full width on phone in sticky bars.
- Inputs: label above, help text below, error text in red with an icon (colour is never the only signal).
- Focus ring: 3 px gold outline, visible on every interactive element (WCAG 2.2 focus appearance).

## 6. Sidebar, footer and dropdown standards
- **Sidebar** (desktop): groups in the doc 03 §1 order; Setup at the bottom; the active page is highlighted; a
  badge shows the approvals count; the business switcher and account menu are at the top.
- **Footer**:
  - Workspace: no footer. Legal links sit in the account menu.
  - Public pages: one footer with Product, Company, Legal (Terms, Privacy, Subprocessors, Trust centre,
    Complaints), the business identity line (ABN for Oprun) and © year.
- **Dropdowns**: native `<select>` for short lists on touch devices; a searchable list for long lists (country,
  customer). A menu opens as a bottom sheet on phone/app. Keyboard support: arrows, Enter, Esc.

## 7. Motion
- Durations 120–240 ms. Easing `cubic-bezier(.2,.8,.2,1)`. No looping animation anywhere, including loaders.
  "Working…" uses a static label plus a progress bar where progress is known.
- Everything respects `prefers-reduced-motion: reduce`.

## 8. CSS consolidation plan
1. Add `saas/ds/platform.js` and `saas/ds/layout.css` (the three device classes and five shells).
2. Move rules from the 44 stylesheets into cascade layers:
   `@layer tokens, base, layout, components, pages, legacy;`. Old files go into `legacy` first, so nothing visibly
   changes. Then they are emptied one page at a time.
3. Allow only three width breakpoints (700, 1024, 1440) plus container queries. A lint check in `npm test` fails
   on new `max-width:`/`min-width:` media values outside that set.
4. Remove each emptied legacy file. The workspace target is ≤ 6 stylesheets and a script bundle per area.

## 9. Acceptance per device class
For each of phone 390×844, tablet 820×1180, desktop 1440×900, the Android app shell and the iOS app shell
(simulated in tests by the shell flag; also real devices before store release):
- No horizontal scroll on any page.
- Every page has one visible primary action, or none.
- axe-core finds no serious or critical issues.
- Lighthouse on mobile: Performance ≥ 85, Accessibility ≥ 95 (public pages).
- Visual snapshots are stable.
