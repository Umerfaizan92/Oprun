# PRG-08 integration verification

Tested commit: 22ef8fd95a7772db2a2b688d41b796d7af7a53e8. Main baseline: 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. The five queue paths match the independent acceptance tree at a88d777605480fba58aeff2e07f8981773b6a7bc. The audit branch evidence is preserved at 85f722449774a43d1d16f19ad21e6b9236bf8c05.

Linux x86_64, Node 22.23.5, npm 11.19.1, locked npm ci. Synthetic SQLite fixtures, loopback server and provider stand-ins. Litestream v0.3.13 was checked against the pinned archive hash and used with a local file replica.

| Check | Observed result | Exit |
| --- | --- | --- |
| Locked npm ci | 266 packages installed | 0 |
| Full npm test | 73/73 repository checks, 132 contract test files passed in 651.2 seconds, final validation and both quality gates passed | 0 |
| Focused combined run | 86 passed, 0 failed, 0 skipped, including the synthetic restore | 0 |
| Main UI and Reel Maker UI | 37 main checks passed and Reel Maker walkthrough passed on system Chromium 156 | 0 each |
| Finance UI and module verification | 12 finance checks passed. 66 modules checked, 0 with problems on Playwright Chromium | 0 each |
| Integration runtime and startup smoke | Both passed | 0 each |
| Manifest and tracked secret scan | 937 files verified, 918 tracked files scanned | 0 each |
| Production dependency audit | 0 vulnerabilities reported | 0 |
| Release preservation, project memory and static site | No unexpected removals, memory valid, 23 public pages current | 0 each |

The full runner received an unrecognised manifest flag. The manifest was verified separately before and after tests using the repository's verifier. The initial module-browser invocation exited 1 because the cache path was missing. With the isolated Playwright cache it exited 0. The generated module report was retained as local scratch. This receipt and its manifest update are documentation-only.

Release remains gated by fresh independent review of the refund candidate, reconciliation of ambiguous or historical provider records, current production restore and provider readiness evidence, and owner approval. No merge to main, deployment, migration for T-274, live provider call or recovery upload was performed.
