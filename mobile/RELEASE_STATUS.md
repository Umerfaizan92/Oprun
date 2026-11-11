# Oprun candidate status — 11 November 2026

Branch: `codex/oprun-mobile-readiness-20261111`, based on production commit
`e772495739f2b52e3bd5b7a26a671c218e9e7213`.

## Implemented

- Signup plan preselection and compact registration layout.
- Specific public-guide answers for missed calls, approvals and worker pricing.
- Public installation instructions and sign-in installation entry point.
- Removed public operator sign-in entry; existing owner access is preserved.
- Generic offline recovery without caching private workspace/API responses.
- Exposed existing owner account-deletion controls, with public instructions.
- Fail-closed Android/iOS domain association endpoints.
- Android TWA and iOS SwiftUI/WebKit projects, icons, listing draft and build CI.
- Regression checks for these changes.

## Verification

- `npm test`: **73/73 passed**, including 52 contract test files and synthetic
  authentication, permissions, tenant isolation and business-pipeline checks.
- Focused mobile-readiness/public-site unit tests: **14/14 passed**.
- Release validation, UI static audit, secret scan and generated manifest passed.
- Native XML and Apple property lists parse successfully.
- Browser regression scripts are prepared but **not executed successfully**:
  local Chromium is blocked by the execution environment; the cloud browser
  cannot reach the local preview. These are environment limitations, not passing
  browser results.
- Android and iOS compilation, signed-device installation, provider OAuth,
  camera/microphone, notifications and store submission remain **unverified**.

## Publication boundary

The owner explicitly approved publication and Render deployment on 11 November
2026. The matching source tree was published through the connected GitHub
account as commit `4079a2e98bb58fea2549a03ffaedcfbb16a2cfbf`; PR #69 runs the
web and native CI checks. Earlier automatic publication denials are superseded
by that explicit approval. Production data and credentials were not changed.

Next: resolve web/browser/native CI failures, merge passing changes and deploy
to the existing Oprun Render service.
Its persistent disk can cause a brief deployment interruption. Verify the live
site after deployment. Then complete signing, domain proof, device tests,
privacy/billing/reviewer preparation and store gates in `README.md`.

This is a tested source candidate, **not a certified or upload-ready store
release**. The task remains blocked until publication and release gates finish.
