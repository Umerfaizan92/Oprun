# Single mobile sub-section bar — 12 November 2026

The owner clarified the mobile layout after testing the restored release: keep only one bottom row, containing Menu and the open page's sub-sections. Main pages such as Command Centre, AI Assistant and Approvals stay in the sidebar. The business name/logo in the header must no longer open the mobile drawer.

## Changes

- One fixed horizontal bar: pinned Menu at the left and one horizontally scrollable strip of real sub-section controls. Multiple native sub-section groups share that same strip. Pages with no sub-sections show Menu only.
- Removed all main-page links and AI/chat shortcuts from the bottom bar. Main page navigation remains permission-filtered in the sidebar. Existing AI/chat controls are accessible inside Menu, including unread count and grant checks.
- Mobile business identity is a static logo/name with no dropdown chevron or interactive wrapper. Desktop keeps its existing navigation trigger.
- Closing the mobile drawer returns keyboard focus to the visible bottom Menu. Unread updates preserve focus on sidebar chat controls; permission removal returns focus to the drawer close button.
- More distinctive section icons, consistent icon tiles, a gold Menu/selected indicator and 64px minimum controls. Content/panel offsets use the measured single bar height and existing keyboard/safe-area measurements.
- Native forms and section handlers are retained in place; no data, API, storage or role changes.

## Verification

- 18 targeted DOM/navigation tests passed, including all 60 route/alias/sidebar mappings, absence of bottom main-page links, single scroller structure, static business identity, nested sections, original section handlers, unsaved fields, Menu open/close focus, unread updates and grants.
- Browser regression scripts were updated to enter main pages through Menu and to check that all bottom controls share one row. Authenticated browser/device visual verification remains pending in this environment.
- Full release checks and deployment result are recorded in the project checkpoint and qa/reports/mobile-workspace.json.

Continue from this specification. The two-row page-plus-section bottom navigation is superseded.

A local synthetic mobile preview was attempted without a production session; the browser transport disconnected before visual verification completed. Temporary fixtures were removed and are not part of the release. No authenticated/device visual PASS is claimed.
