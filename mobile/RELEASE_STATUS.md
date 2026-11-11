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

No branch push, pull request, merge, deployment or store upload was completed.
Automatic approval review rejected source publication twice, including after
verification of the public `Umerfaizan92/Oprun` repository. Do not retry through
another tool without explicit owner authorization to publish this branch.
Production remains on the original commit. Production data and credentials
were not changed.

After approval: publish the branch, run web/browser/native CI, resolve any
failures, merge passing changes and deploy to the existing Oprun Render service.
Its persistent disk can cause a brief deployment interruption. Verify the live
site after deployment. Then complete signing, domain proof, device tests,
privacy/billing/reviewer preparation and store gates in `README.md`.

This is a tested source candidate, **not a certified or upload-ready store
release**. The task remains blocked until publication and release gates finish.
