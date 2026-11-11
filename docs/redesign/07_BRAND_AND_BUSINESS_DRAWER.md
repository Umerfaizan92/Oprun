# Oprun branding and business navigation

User follow-up before deployment (T-084). Builds on T-083; Render remains on hold until combined candidate passes browser CI.

- Larger Oprun wordmark and logo on generated public pages and shared authentication/portal surfaces. Public pages use a small separate stylesheet rather than rebuilding the design system.
- Business sidebar has one existing business identity block, with its original logo/name, designation, role, business selector and restricted operator shortcut. No duplicate Oprun banner or standalone Collapse row. Oprun appears prominently in the workspace header.
- Clicking the business identity opens navigation at every viewport; the compact close control, outside click, Escape or selecting a permitted page dismisses it. Focus returns to the trigger. No hover/timer closes editing work. Drawer makes background content inert and traps keyboard focus as before.
- Shorter presentation titles and a group breadcrumb avoid repeated page wording. All canonical metadata and aliases remain intact.
- Founder navigation uses the shared shell's unchanged default collapse behaviour. Business-only opt-in controls drawer behaviour.

Local validation: JS syntax; semantic drawer click/close/outside/Escape/selection/focus/background-inert checks and Founder desktop collapse; preservation audit retains 645 HTTP routes, 45 HTML pages, 60 business views, 34 Founder sections and 780 static IDs; website generation consistency; secret scan; full npm test (result in handover checkpoint). Browser regression tests updated for the new all-width business drawer. GitHub CI browser results and live acceptance are required before completion.

T-083 main CI: ordinary verify job passed, but navigation traversal had manually opened More before asserting a fresh default without reloading. The assertion now reloads first. Dedicated redesign tests already confirmed fresh defaults at 390, 768 and 1440px; manual state remains intentionally preserved across repaint.

No backend, tenant selection, role filtering, approval gating, store or external provider mutation changes.
