# Candidate validation

All application/provider tests use throwaway databases, synthetic users and mocked provider replies. No production message, provider consent or deployment was performed.

| Check | Result |
|---|---|
| `npm test` | Final `npm test -- --manifest` passed 74/74 checks, including all 47 contract-test files, after receipt queue and owned-sender fixes. Earlier full runs passed 73/73 without the optional manifest check. |
| `node --test scripts/integration-security.test.mjs scripts/integration-tenant.test.mjs` | Passed 11/11 focused cases. Covers browser/session/provider binding, callback replay, legacy TikTok, token expiry, provider error envelopes, redaction, Google partial discovery, encrypted tenant transports, DNS proof, selected-account metrics, shared Google choices, signed SMS isolation and signed email/queued receipt isolation. |
| Same focused tests plus `scripts/communication-notifications.test.mjs` | Passed 15/15 after queued receipt handling. |
| `npm run integration:test` | Passed encryption, legacy key decryption, refresh, discovery and revoke library contracts. Workspace disconnect itself intentionally uses local removal. |
| `npm run test:connections-ui` | Passed: ten cards, page-two persistence, 390/768/1440px layouts, resource selection/save, unavailable versus zero metrics, masked write-only key inputs, clearing after save, workspace webhook instructions, diagnostics; no page errors; no serious/critical WCAG 2 A/AA or 2.1 AA axe violations in the Connections view in settled dark/light themes. |
| `npm run test:navigation-ui` | Passed 576 route/section checks: 60 business and 34 founder pages at phone and desktop widths, restricted roles and navigation state. |
| `npm run quality:check` | Passed; quality score and ratchet satisfy the repository gate. |
| `npm run memory:validate` | Passed; task deliberately remains TESTING for live acceptance. |
| Manifest, staged secret scan and bundle/patch import | Staged secret scan passed (494 tracked files); manifest passed (492 release files). Final release checkpoint records fresh-base bundle import and patch/tree verification. |

## Browser limitation retained

The configured Playwright Chromium 151 download returned invalid/truncated ZIP archives. Browser checks used a temporary external Chromium 153 fallback via `UI_CHROMIUM_PATH`, without changing project dependency versions.

The broad `npm run test:ui` stops before Connections at `scripts/test-ui.mjs:57`, the sign-in tall-desktop footer position assertion. The same failure was reproduced on an untouched detached checkout of base `83b3066331fd7ba8e14913c1f64661fc50a79d3b` using the same browser. This pre-existing public sign-in layout is excluded from the requested source changes. No assertion was weakened. A second font-configuration experiment caused a fallback-browser crash and was discarded; it is not counted as passing evidence.

The dedicated Connections browser suite and full navigation suite were then run independently and passed. This does not constitute a passing full visual-regression or production OAuth/metrics acceptance run.

## Review screenshots

Synthetic local data only:

- [Phone, 390px](screenshots/connections-mobile.png)
- [Desktop, 1440px](screenshots/connections-desktop.png)

## Deployment boundaries

Live deployment remains `dep-dbj02f8ae00c73crpa4g` / `d19a2574e918990e7f4d4836d4c42f53dea34666` at the last Render verification. No push, merge, deploy, secret rotation, production database reset or provider action was performed for this candidate. Actual provider app approvals, consent and comparison with provider dashboards remain owner-led deployment acceptance tasks.
