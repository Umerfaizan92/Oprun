# Dependency and provider version register

Registry check: 12 November 2026. Exact candidate versions are in package-lock.json; the generated CycloneDX SBOM is supplied separately. Runtime tested: Node 22.23.5, consistent with the existing 22.x engine. Do not infer API permission from SDK version.

| Package | Initial installed | Candidate lock | Registry latest observed | Decision |
|---|---|---|---|---|
| @aws-sdk/client-s3 | 3.1156.0 | 3.1167.0 | 3.1167.0 | Upgraded and pinned; full regression required |
| @aws-sdk/s3-request-presigner | 3.1156.0 | 3.1167.0 | 3.1167.0 | Upgraded and pinned; full regression required |
| better-sqlite3 | 12.4.1 | 12.4.1 | 13.1.1 | Retained; separate compatibility migration before upgrade |
| dotenv | 16.6.1 | 16.6.1 | 18.0.10 | Retained; separate compatibility migration before upgrade |
| esbuild | 0.25.12 | 0.25.12 | 0.28.2 | Retained; separate compatibility migration before upgrade |
| express | 4.22.3 | 4.22.3 | 5.3.0 | Retained; separate compatibility migration before upgrade |
| express-rate-limit | 7.5.1 | 7.5.1 | 8.7.4 | Retained; separate compatibility migration before upgrade |
| jsdom | 26.1.0 | 26.1.0 | 31.0.0 | Retained; separate compatibility migration before upgrade |
| nodemailer | 10.2.1 | 10.5.0 | 10.5.0 | Upgraded and pinned; full regression required |
| pixelmatch | 7.2.0 | 7.2.0 | 8.0.0 | Retained; separate compatibility migration before upgrade |
| playwright | 1.62.1 | 1.62.1 | 1.65.0 | Retained; separate compatibility migration before upgrade |
| resend | 6.28.0 | 6.38.0 | 6.38.0 | Upgraded and pinned; full regression required |
| three | 0.186.1 | 0.186.1 | 0.187.0 | Retained; separate compatibility migration before upgrade |
| web-push | 3.6.7 | 3.6.7 | 4.0.0 | Retained; separate compatibility migration before upgrade |

Major-version upgrades to Express, better-sqlite3, web-push and other libraries are not silently applied. Their compatibility, engine/runtime, deployment, persistence and regression impacts need a separate tested change. No new runtime dependency was added for localization.

## Provider API versions

- Google Ads: source default v26. Official release notes retrieved 12 November list latest minor v26.2 (11 November 2026). Retain major endpoint v26; minor release notes are not a command to invent a v26.2 REST path. Verify fields/scopes and run contract/sandbox tests before expanded Ads actions. Source: https://developers.google.com/google-ads/api/docs/release-notes
- Meta Graph: source default v23.0. Current changelog lookup was rate-limited (429); newest permitted production version and sunset date were not verified. Record as an activation blocker, not a guessed upgrade.
- Telnyx: existing v2 paths; verify each current endpoint, webhook signature contract and account capability before implementing managed orders.
- Registrar: OpenSRS overview retrieved; reseller API, test/live credentials and IP allowlisting must be confirmed for the selected contract.
- AI providers/models: existing configuration preserved. No new live AI API call or key setup. Confirm model availability, current SDK/API contracts and data terms at activation.

## Licence/SBOM review

The application remains proprietary (package metadata UNLICENSED). The SBOM inventories dependency licences where metadata supplies them; it does not grant commercial rights or prove legal compliance. Review notices, transitive licences, fonts/icons/assets, templates and bundled native software before distribution. Separate supplier agreements and regulatory determinations remain in the provider/approval register.
