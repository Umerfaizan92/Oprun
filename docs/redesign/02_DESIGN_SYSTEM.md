# Prompt 2 — Dense SaaS component system

Implemented in `saas/workspace-redesign.css`, `portal-shell.js`, `workspace-nav.js` and the shared navigation shell. Existing stack remains plain HTML/CSS/JS. No external font download, framework or decorative animation is required. Existing light/dark semantic palette remains authoritative.

| Token / rule | Value | Use |
|---|---|---|
| Font | Inter when available, system UI fallback | Body, forms, command button |
| Body | 16px / 1.5 | Desktop and mobile; avoids mobile form zoom |
| H1 | 24–28px / 1.25 | Page purpose |
| H2 | 18–20px / 1.35 | Section purpose |
| Secondary copy | 14px | Supporting explanations |
| `--work-space-1/2/3/4/6` | 4/8/12/16/24px | Consistent spacing |
| `--work-radius` | 12px | Cards and command bar |
| `--work-content` | 1200px | Reading width; wide tables scroll inside their existing containers |
| Panel padding | 24px desktop / 16px mobile | Dense forms with readable grouping |
| Touch target | At least 44px | Workflow links, command action, More summary and existing navigation |
| Focus | 3px semantic accent, 3px offset on new controls | Keyboard visibility |
| Status | Existing success / warning / danger tokens + visible text | Never communicate approval or failure using colour alone |

CSS tokens are scoped to `body.portal-workspace`; public sign-in and marketing stay independent. Responsive guidance collapses below 760px; the existing compact drawer works below 1024px. Reduced-motion behaviour is inherited; new components do not animate.

## Component patterns

```html
<article class="panel" aria-labelledby="attention-title">
  <h2 id="attention-title">What needs your attention</h2>
  <p>Review saved workspace risks and open the affected record.</p>
  <span class="status-pill warning">Needs review</span>
</article>

<!-- Empty state: one primary action, accurate scope, no invented metrics. -->
<section class="panel" aria-labelledby="empty-title">
  <h2 id="empty-title">No enquiries yet</h2>
  <p>Add a customer request to start your first quote.</p>
  <a class="primary-button" href="#b02/enquiries">Capture an enquiry</a>
</section>

<!-- Actual page navigation uses links, not ARIA tabs. -->
<nav class="workflow-links" aria-label="Work pipeline">
  <a href="#b02/enquiries" aria-current="page">Enquiries</a>
  <a href="#b02/quotes">Quotes</a>
</nav>

<details class="navigation-more">
  <summary>More communications tools</summary>
  <a class="navigation-page" href="#b04/email">Email Centre</a>
</details>
```

Tables retain their real semantic header/body and current data source. Keep row actions beside their record, totals adjacent to filters, and a scroll container for narrow screens; never reduce body copy to fit a desktop table. Approval badges must show Draft / Pending / Approved / Sending / Confirmed / Check delivery as distinct states. Saved, approved and delivered are different outcomes.

The command bar opens the existing Ask/search dialog. It does not silently issue a task or bypass approvals. Its scope and permission-aware destinations are provided by the existing search engine. Multi-step AI execution and a unified conversational history are separately specified in the roadmap.

## Before and after

| Surface | Before | This release | Next validation |
|---|---|---|---|
| Command Centre | Five equal metric cards, generic readiness 7/10, multiple competing entry points | Four metric cards with expiry detail retained, accurate Setup checklist label, permission-filtered next steps, shared sticky Ask/find entry | Compare task completion with 3–5 consenting subscribers; avoid promising a numerical readiness score without measured inputs |
| Unified Inbox | Original Inbox, Unified Inbox and Email Centre equally prominent | Unified Inbox first; related Inbox workflow links; original Inbox and Email Centre retained under More; folders and send controls remain attached to their original pages | Reconcile separate stores before replacing them with one real folder/filter model |
| Work | Seven independent Work links with weak sense of stage | Contextual enquiry → customer → quote → booking → job → invoice → archive sequence filtered to permitted pages | Consolidated customer timeline and per-stage history remain roadmap work |
| Growth / SEO | Two primary groups and many independent tools | One Growth group; SEO & website and Campaigns context; advanced tools under More | Measure discoverability before deleting any legacy tool |

## Progressive disclosure and accessibility

- Keep the current task and mandatory fields visible. Put optional settings under named sections; do not hide errors or the approval payload.
- Collapse retained secondary navigation under native `details`. Selecting a deep link expands its parent. Main drawer retains Escape, focus trapping and focus restoration.
- Related page links use `aria-current=page`; existing in-page tabs keep tablist, arrow keys, Home/End and history. Do not use tabs for links to independent pages.
- New guidance and context links are built with text nodes; no provider/user HTML interpolation.
- Honour current role grants when showing actions. Hidden controls provide no security guarantee.
- Check 390/768/1440 widths, both themes, contrast, visible keyboard focus, page overflow and screen reader labels. CI runs complete navigation coverage and axe on shared navigation; new components also have explicit responsive tests.
- Keep original form nodes and unsaved state. Context navigation invokes the same leave guard; changing a filter must not clear another form.
- Loading states must name the work, errors must offer retry or setup, and empty states must distinguish no data, not connected, no permission and temporary failure.
- Existing SEO/media views already load their data when selected. Splitting all frontend scripts into lazy bundles needs an explicit dependency inventory and remains tracked work; this release does not claim that conversion.
