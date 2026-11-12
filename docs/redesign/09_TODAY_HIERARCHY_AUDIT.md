# Today hierarchy and workspace density — T-085

## Step 1: baseline audit (main10c79e5)

Inspected actual HTML, command-bar construction, runtime gadget/section installation, navigation metadata/renderer, shared and additive styles, and authenticated baseline screenshots from the preceding verified release (390/768/1440px). Live subscriber authentication is unavailable here; personal production account content is not asserted or modified. Isolated authenticated CI verifies the current implementation using synthetic users.

- `workspace-voicebar.js` explicitly inserts `#sp-askbar` before the first dashboard child, so it precedes the greeting regardless of the static heading order.
- On 390px baseline screenshots, header ends around164px; AI panel occupies approximately450px and pushes greeting below630px. It is not literally a fullscreen overlay: stacked input/buttons, four wrapped chips, 18–30px padding and display typography create the viewport-dominating effect.
- Greeting contains original `#first-name`, `#user-line`, jobs and AI actions. Identity content is safely populated by existing authenticated code. Long names/email need wrapping, not truncation or removal.
- Live gadgets are inserted after the greeting; managed section tabs follow it. Original fallback workforce/compliance/allocation metrics, attention brief, readiness and workflow remain in their existing tab panels. Gadgets include five current data cards and eight workspace shortcuts. Next-step cards are permission-filtered and currently use a large stacked mobile treatment.
- Mixed display fonts (AI heading and some panels) compete with the workspace sans-serif type; generous heading gaps, 132px gadget minimums and 76px next-step minimums amplify mobile scrolling. Small supporting text and single-row overflow need bounded, readable treatment.
- All22 contextualOnly legacy/SEO items are already secondary. `Navigation.setGroups` creates native details with `open=false`; paint preserves manual state. No flag/route gap. Existing44px More summary/link targets and13px secondary text are sufficient; retain them.

Chosen design: secondary in-flow AI section after operational content, with one compact mobile form row and horizontally scrollable suggestion buttons. No fixed overlay, timer, clipping/max-height or nested vertical scroll. Greeting and section navigation first; original metrics, readiness/attention tabs and next steps before AI. Preserve every original node/ID/listener and all existing forms, routes, data and policies.

Steps2–6 results are appended after implementation and verification.

## Steps 2–4: implementation

`workspace-voicebar.js` now appends the original AI section after operational content. Only placement changes; recognition/capture, cancellation, speech feedback, submit and quick-request listeners are unchanged. Compact scoped CSS uses one mobile input/microphone/Send row,44px targets and horizontal suggestions with no height clipping, vertical scroll container or overlay. Long greeting/identity text wraps. Cards, next steps, headings, empty-state and tab spacing use a consistent sans-serif hierarchy. Normal-text mobile panel height is explicitly tested below320px, rather than forcing a height that could clip larger text.

Step3 confirmed all22 secondary flags/default closed behaviour; added explicit regression coverage. Existing quiet navigation CSS retained without redundant overrides.

## Step 5: verification

Local semantic check preserves every original dashboard node and confirms typed request, all four suggestion payloads, input clearing and idempotent installation. Preservation audit retains645 routes,45 HTML pages,60 business views,34 Founder sections and780 static IDs. No backend/security/data files or navigation metadata modified. Focused contracts5/5, secret/manifest/memory checks passed. Full npm test and hosted browser checks pending. Browser tests cover320/390/768/1440px, greeting/next-step ordering, in-flow AI, mobile geometry,44px controls, long identity wrapping, all suggestion dispatches, dark/light accessibility and overflow. Existing voice tests remain in main UI suite. Local Chromium is blocked by environment as previously recorded (E031); hosted CI provides actual layout verification.

Step6 publishes the exact requested main commit only after verification. This task requests a main commit; no new Render deployment is part of this change.
