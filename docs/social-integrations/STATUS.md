# Social integrations status — read-only audit, 9 November 2026

Product: SuperPro AI Office Manager. Repository: `Umerfaizan92/fleet-office-ai`.
Task: **T-068** (audit only). Previous connections work: T-067, `docs/connections/`.

This audit changed no code, configuration, data, provider account or deployment. Nothing was pushed, merged,
deployed, published or sent. No credential value was read or recorded. Line numbers refer to the audited commit.

## 1. What was audited, and what could not be

| Item | Value | How verified |
|---|---|---|
| Audited branch and commit | `main` at `6c548cf705849938cbcbc298ba576c6f2a9af945` (PR #63, 9 Nov 2026) | Fresh clone, `git log` |
| Working tree | Clean before this audit; this audit adds only `docs/social-integrations/` and the T-068 memory entry | `git status` |
| Production service | Render `srv-dan4rdqjnfac73fceor0` (`super-pro-ai-office-manager`), branch `main`, auto-deploy **off** | Render API |
| Production live deploy | `dep-dbos5d67bikc73a4hd90`, commit `6c548cf`, live since 9 Nov 2026 12:58 UTC, trigger `api` | Render API |
| Is production the audited code? | **Yes.** Live commit equals `main` HEAD today. | Render deploy list |
| Other Render services on this repo | `superpro-ai-v2-preview-20261029` (branch `codex/superpro-two-portals-v2`, not suspended); `fleet-office-ai` and `fleet-office-ai-v6-test` (both suspended, auto-deploy on) | Render API |
| Connections code last changed | `9a4226f` (1 Nov 2026, deployed 1 Nov 08:43 UTC). PRs #62 and #63 added and reverted Founder SMS recovery and do not touch connections. | `git log`, deploy list |
| Stale project memory | `.claude/project-memory/SESSION_HANDOVER.md` and `docs/connections/HANDOVER.md` still say the connections branch is unpublished and production is `d19a257`. Both are out of date: it was pushed and deployed on 1 Nov. | Compared notes with Render |

Not reachable in this audit (each is listed again as a blocker in section 6):

- **Render environment values.** The available Render tools cannot read environment variables. Which provider
  variables are set, and what the redirect addresses contain, is unknown.
- **Production HTTP.** The audit workspace cannot open the production site, and the linked computer was offline.
  No live Connect click, generated URL or provider error page was observed.
- **Production logs.** Render returned no request logs. Application logs from 2 to 9 Nov contain no
  `[INTEGRATION OAUTH]` or `[tiktok-oauth]` lines; a query back to 11 Oct failed with HTTP 503. So there is no
  server-side record of a failed connection attempt in the period that could be read.
- **Provider dashboards** (Meta, TikTok, Google Cloud, X, Snap). Not accessed.
- **Production database.** Not queried.

## 2. How Connect works today (traced in code)

There is one Connect path for subscribers. Every card in Setup & Trust → Connections uses it.

| Step | Where | What happens |
|---|---|---|
| 1. Button | `saas/integration-manager.js:47`, `:107`; older renderer `saas/app.js:935-948` | `POST /api/saas/integrations/self-service/:provider/authorise`, then the browser goes to the returned `authorize_url`. The frontend builds no provider URL itself and contains no fixed account link. |
| 2. URL generation | `src/server.js:5581-5592` | Owner or admin only. Builds the provider URL from **platform** variables: `META_APP_ID`, `TIKTOK_CLIENT_KEY`, `GOOGLE_CLIENT_ID`, `X_CLIENT_ID`, `SNAPCHAT_CLIENT_ID`. |
| 3. Redirect address | `src/server.js:5553` | Uses `TIKTOK_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `META_REDIRECT_URI`, `X_REDIRECT_URI` or `SNAPCHAT_REDIRECT_URI` **verbatim if set**; otherwise `PUBLIC_BASE_URL` + `/api/saas/integrations/oauth/<provider>/callback`; otherwise the request host. |
| 4. State | `src/integration-security.js:44-70` | Random single-use state stored hashed with the workspace, user, session, provider and redirect address, plus a browser cookie scoped to the callback path. 15-minute expiry. |
| 5. Callback | `src/server.js:5594-5606`; legacy path `src/server.js:1446-1448` | Validates state, cookie, membership and role; exchanges the code using the platform secret; stores the token for the workspace recorded in the state, not anything the browser sends. |
| 6. Token storage | `src/server.js:5557`; `src/integration-runtime.js:27-45` | AES-256-GCM encrypted bundle in `organisation_integrations.settings_json`, one row per workspace and provider. |
| 7. Resource selection | `src/server.js:5635-5665` (test and discover), `:5697-5714` (save) | Lists Pages, Instagram accounts, WhatsApp numbers, channels, locations from the subscriber's token. Only saved selections that are still in the discovered list are used. |
| 8. Downstream | `src/server.js:5858-5861` (loader), `src/growth.js:283-310` (publish), `src/integration-insights.js` (figures), `src/server.js:5840` (WhatsApp send) | All read the workspace's own row. |

Identifier types, kept separate in the code as follows:

| Kind | Examples | Scope | Where held |
|---|---|---|---|
| Platform app credentials | `META_APP_ID`/`META_APP_SECRET`, `TIKTOK_CLIENT_KEY`/`_SECRET`, `GOOGLE_CLIENT_ID`/`_SECRET`, `X_CLIENT_ID`/`_SECRET`, `SNAPCHAT_CLIENT_ID`/`_SECRET` | One per platform; correct to share across subscribers | Render environment |
| Subscriber access and refresh tokens | OAuth token bundle | One per workspace and provider | Encrypted in `organisation_integrations` |
| Subscriber resources | Page ID, Instagram account ID, WhatsApp phone ID, YouTube channel ID, TikTok open_id, GBP location | Per workspace, chosen by the subscriber | `settings_json.resources` and `selected_resources` |
| Single-business (legacy) account values | `META_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `TIKTOK_ACCESS_TOKEN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`, and the file `tiktok-oauth.json` | **One business for the whole server.** These are account-level values sitting in platform configuration (`render.yaml:184-218`). | Render environment and persistent disk |
| Ad accounts | None | Not implemented anywhere | — |

## 3. Confirmed findings

Severity: **High** = security or cross-tenant exposure; **Medium** = subscribers blocked or misled; **Low** = hygiene.

### F1 (High) The legacy TikTok login is open to anyone and controls a server-wide token

- `GET /api/tiktok/login` has no sign-in check (`src/server.js:1366-1437`). Anyone who opens that address on the
  production site is sent to TikTok with the platform client key.
- Its callback (`src/server.js:1446-1640`) saves the resulting token to one global file,
  `tiktok-oauth.json` (`src/server.js:529-531`, `:579-650`), and copies it into `env.TIKTOK_ACCESS_TOKEN`
  (`src/server.js:571-576`, `:649-652`).
- Consequence: any person who completes that flow with their own TikTok account replaces the single global TikTok
  identity. If that file currently holds Fleet Parlour's authorisation, an outsider can overwrite it.
- The success page reads "the business has authorized TikTok Login Kit" and links to `/api/social-stats`
  (`src/server.js:1604-1617`).
- This path is separate from the subscriber Connect path and no subscriber page links to it. It is reachable only
  by typing the address.

### F2 (High) `/api/social-stats` publishes one business's statistics without sign-in

- `GET /api/social-stats` is public (`src/server.js:1711-1752`; listed as deliberately public in
  `scripts/route-guards.test.mjs:12-16`).
- It reads only the single-business values: YouTube `src/social-stats.js:85-86`, TikTok `:200`, Instagram
  `:272-276`, Facebook `:368-372`.
- `?refresh=1` lets any caller force new provider calls on those tokens.
- `GET /api/tiktok/status` is also public and reports whether the global token exists, its scope and expiry
  (`src/server.js:1652-1702`).
- No file in `saas/` or `office/` calls either endpoint. They are leftovers from the single-business version.
  Whose accounts the values point to is a configuration fact not verified here (blocker B1).

### F3 (Medium) Redirect-address variables are trusted without validation

- `oauthRedirectUri` returns the configured variable as-is (`src/server.js:5553`). There is no check that it is on
  the SuperPro host or that its path is one of the two callback routes that exist
  (`/api/saas/integrations/oauth/:provider/callback`, `src/server.js:5606`; `/api/tiktok/callback`, `:1446`).
- If any of these variables points at another site, the subscriber is sent to that site after consenting, and the
  connection never completes. If it points at an unsupported path on this site, the callback fails with "OAuth
  session is invalid".
- The callback only accepts a path whose provider segment matches the flow or a listed alias: `google`/`youtube`
  for the three Google connectors, `meta` for Meta and WhatsApp (`src/integration-security.js:59-60`). A value
  ending `/oauth/google_business/callback` or `/oauth/whatsapp/callback` would be rejected for sibling connectors.
- The automated tests cover only the TikTok override (`scripts/integration-tenant.test.mjs:55`). Meta, Google, X
  and Snapchat overrides are untested.
- This is the only code path that can send a subscriber to a fixed external address. Whether it is happening
  depends on the Render values (blocker B1).

### F4 (Medium) Nothing asks the provider to show an account chooser

- Meta URL: no `auth_type` (`src/server.js:5588`). TikTok URL: no `disable_auto_auth=1` (`:5586`; TikTok documents
  that `1` "always displays the authorization page"). Google uses `prompt=consent` but not `select_account`
  (`:5587`). X and Snapchat likewise.
- Consequence: whichever provider account is already signed in in that browser is the one that gets connected.
  When the platform owner tests a subscriber workspace in his own browser, the provider silently uses his own
  login and the workspace then lists his Pages and accounts.
- The SuperPro side of the binding is correct: the token goes to the workspace stored in the state at the moment
  Connect was clicked (`src/integration-security.js:47-52`, `src/server.js:5596`). There is no code path that
  copies one workspace's token or the global token into another workspace.
- There is also no warning when the same provider account or Page is connected to two workspaces.

### F5 (Medium) Meta: scope set, login product and token lifetime do not match the goal

- Requested scopes (`src/server.js:5588`): `pages_show_list, pages_read_engagement, pages_manage_posts,
  instagram_basic, instagram_content_publish`; WhatsApp: `business_management, whatsapp_business_management,
  whatsapp_business_messaging`.
- Missing for the stated goal: `business_management` on the Meta card (Meta lists it as a prerequisite for
  `pages_show_list` and messaging), `pages_messaging`, `pages_manage_metadata`, `instagram_manage_messages`,
  `instagram_manage_comments`, `pages_manage_engagement`, `instagram_manage_insights`, `read_insights`.
- No `config_id`. Meta's documentation names Facebook Login for Business as the product for integrations that
  serve other businesses.
- No long-lived exchange (`fb_exchange_token`) and no Meta refresh path: `refreshToken` covers Google, TikTok, X
  and Snapchat only (`src/integration-runtime.js:84-101`). When the stored user token expires, every Meta and
  WhatsApp action fails with "Re-authorise the provider" (`:103-112`). Actual lifetime returned in production is
  unverified.
- The authorise URL and code exchange hard-code Graph `v23.0` (`src/server.js:5588`, `:5599`) while other calls use
  `META_GRAPH_VERSION`. v23.0 remains available until 8 October 2027.
- Instagram accounts are discovered only through a linked Facebook Page
  (`src/integration-runtime.js:119-131`). Instagram-only professional accounts cannot connect.

### F6 (Medium) WhatsApp uses ordinary Facebook Login, not Embedded Signup

- The WhatsApp card runs the same Facebook dialog with three scopes and then walks
  `me/businesses → owned_whatsapp_business_accounts → phone_numbers` (`src/integration-runtime.js:133-148`).
- Meta's documented route for onboarding other businesses is Embedded Signup, which returns the WABA ID, phone
  number ID and an exchangeable code, after which the server registers the number and subscribes the app to
  webhooks. None of that exists in the code (no `subscribed_apps` call anywhere in `src/`).
- Outbound WhatsApp is correctly per workspace (`src/server.js:5840`, `src/saas-platform.js:961-962`); the global
  `WHATSAPP_ACCESS_TOKEN` fallback in that line is unreachable in production because `whatsappConnection` is
  always supplied.

### F7 (Medium) Connecting an account does not connect its inbox

- Inbound Messenger, Instagram and WhatsApp webhooks route by `comms_channels.address`
  (`src/saas-platform.js:110-113`, `:653-700`).
- A row there is created only by the workspace owner typing an address (`:278-295`, status `pending`) and the
  platform operator activating it (`:298-299`), or by the email/SMS setup (`src/integration-transports.js:58`).
- Selecting a Page, Instagram account or WhatsApp number in Connections writes nothing to `comms_channels`, and
  the Page or WABA is never subscribed to the platform app. So a subscriber can be "Connected" and receive no
  messages. Comments are not ingested for any provider.
- `/api/webhooks/social/:channel` (`:636-650`) expects a custom signed relay format, not any provider's native
  webhook. TikTok, X and Snapchat inbound therefore has no working source.

### F8 (Low) Capability labels overstate what the code does

`integrationCapabilities` (`src/server.js:5531-5544`) advertises Meta "publishing, insights", YouTube "publishing,
analytics, comments", X "publishing, profile, analytics", Google Business "reviews, posts, locations". Actual
publishing exists only for Facebook Page text posts and X text posts (`src/growth.js:16`, `:283-310`). See the
matrix in section 5.

### F9 (Low) Other items

- X authorise URL uses `twitter.com` (`src/server.js:5589`); X's current documentation uses
  `https://x.com/i/oauth2/authorize`. Untested live because no X client is configured in the last recorded state.
- Snapchat default scope is `snapchat-marketing-api` (`src/server.js:5590`), which identifies an ads user only.
- Disconnect removes local credentials but never revokes at the provider (`src/server.js:5716-5731`); deliberate,
  documented in the T-067 audit.
- Insights are cached five minutes per workspace in `settings_json.insights`
  (`src/server.js:5673`); the legacy global cache is `data/social-stats-cache.json`
  (`src/social-stats.js:447-451`). Neither crosses workspaces.
- Legacy single-business tables `channel_connections` and `channel_metrics` are Founder-only
  (`src/server.js:4731`, `:4829-4845`).

### Fleet Parlour references found

No Fleet Parlour social link, handle, Page ID or account ID is written in the code. All remaining mentions are
text or names: `office/index.html:53` and `office/legacy.html:53` (console header), `src/mailer.js:250`
(receptionist email subject), `saas/index.html:156` (newsletter wording), `src/server.js:1351` (health name),
`.env.example:8` and `src/diagnostics.js:50` (database file name), `docker-compose.yml:2` (service name).
`src/server.js:4855` actively rejects a Fleet Parlour address for the platform website.

## 4. The three reported symptoms

### "Invalid application"

**Root cause not confirmed.** The exact text does not exist anywhere in the repository, so it is produced by a
provider page, not by SuperPro. No log line, URL or screenshot was available to say which provider. What the
evidence supports:

- The only value that identifies "the application" to a provider is the platform client ID in the authorise URL
  (step 2 above). Subscribers never supply one. So the message concerns the platform app registration or the
  value of that variable, not the subscriber's account.
- Official documentation establishes these provider-side conditions that reject or restrict an app. Each is a
  candidate, none is proven:
  1. **Meta, Standard Access.** "Permissions with Standard Access … can only be requested from app users who have
     a role on the requesting app." Advanced Access needs App Review and Business Verification. An app that has
     not passed review works for the owner and fails for subscribers. This also fits "sometimes".
  2. **TikTok, sandbox or unapproved production app.** A sandbox allows at most 10 target users. TikTok's error
     list includes `invalid_client` ("unknown client") and `unauthorized_client`.
  3. **Wrong or malformed client ID** in Render for one provider (wrong value, stray space, a business or system
     user ID in place of the app ID).
  4. **Google OAuth client deleted or in Testing status** with the tester not on the test-user list.
- "Sometimes" is also consistent with it happening on one provider card only, or only for accounts without an app
  role.

Evidence needed to close this is listed in blocker B2.

### "Subscribers are sent to Fleet Parlour links/accounts"

Three distinct mechanisms can produce this. The first two are confirmed possible in code; which one occurred is
unconfirmed.

1. **Provider consent screen branding.** The consent page shows the *platform app's* name, icon, business and
   privacy links. If the Meta, TikTok or Google app in use was registered for Fleet Parlour (project memory records
   a Meta app named "Website" under the Fleet Parlour portfolio), every subscriber sees Fleet Parlour details
   there. This is registration, not code.
2. **Redirect address variable pointing elsewhere** (F3).
3. **The tester's own browser login** (F4): the provider used the already signed-in Fleet Parlour account.

No code path redirects to a fixed Fleet Parlour address.

### "Fleet Parlour credentials used as shared connection configuration"

- **Not confirmed for the subscriber Connect path.** It uses only app-level credentials, which are meant to be
  shared. It never reads the single-business tokens or IDs.
- **Confirmed as a design fact for the legacy path**: account-level values for one business are held in platform
  configuration and exposed through F1 and F2.
- Whether the app-level credentials belong to an app registered for Fleet Parlour rather than for SuperPro is a
  dashboard fact (blocker B3).

## 5. Provider capability matrix

Verified against official documentation on **9 November 2026**. "Local tests" means synthetic provider replies
(`scripts/integration-*.test.mjs`); **no capability has been tested live with a real subscriber account.**

Legend: ✅ implemented in code · ◐ partial · ✗ not implemented · n/a not offered by the provider API.

| Provider | Connect (OAuth) | Publish posts | Messages | Comments | Analytics | Ads / campaigns | Provider approval needed | Paid access |
|---|---|---|---|---|---|---|---|---|
| Facebook Pages | ✅ local tests | ◐ text posts only (`growth.js:283`) | ✗ send; ◐ inbound webhook exists but is not bound (F7) | ✗ | ◐ followers and likes only | ✗ | App Review + Business Verification for Advanced Access on every permission | No API fee |
| Instagram (professional, Page-linked) | ✅ via Meta card | ✗ (scope requested, no code) | ✗ send; ◐ inbound not bound | ✗ | ◐ followers, following, post count | ✗ | Same as Facebook; `instagram_manage_messages`, `_comments`, `_insights` each reviewed | No API fee |
| Instagram (Instagram-only account) | ✗ unsupported in code | ✗ | ✗ | ✗ | ✗ | ✗ | Instagram API with Instagram Login, separate setup | No API fee |
| WhatsApp Business | ◐ Facebook dialog, not Embedded Signup (F6) | n/a | ◐ outbound free-text per workspace; inbound not bound; no templates | n/a | ◐ local message counts only | ✗ | Advanced Access for both WhatsApp permissions; Tech Provider onboarding; limit 10 new customers per 7 days until verified, then 200 | **Yes, per message.** Templates charged since 1 Jul 2025. **Service (non-template) messages charged from 1 Oct 2026**, including AI-written replies. Each subscriber needs a payment method on their WABA. |
| TikTok | ✅ local tests; existing Fleet Parlour authorisation recorded 1 Nov | ✗ | n/a for third-party apps (only data-export scopes) | n/a (Research API only) | ◐ profile counters need `user.info.stats`; up to 20 recent videos need `video.list` | ✗ | App review for production; sandbox limited to 10 target users; Content Posting audit, otherwise posts are private-only | No API fee |
| YouTube | ✅ local tests | ✗ | n/a | ✗ | ◐ subscribers, views, video count | ✗ | Google OAuth verification for YouTube scopes; compliance audit for more quota | No fee; default 10,000 units/day and 100 uploads/day |
| X / Twitter | ◐ code present; platform client reported missing on 1 Nov | ◐ text posts (`growth.js:299`) | ✗ | ✗ | ◐ followers, following, post count | ✗ | Developer app with OAuth 2.0 | **Yes, pay-per-use credits.** Listed today: US$0.015 per post, US$0.20 per post containing a link, US$0.010 per user read. Charged to the platform's developer account. |
| Snapchat | ◐ code present; platform client reported missing on 1 Nov | ✗ | ✗ | n/a | ✗ (Marketing identity check only) | ✗ | Public Profile API is **allowlist only**: client ID must be sent to a Snap contact | No API fee stated |
| Google Business Profile | ✅ local tests | ✗ | n/a | ◐ reviews read and reply exist in the SEO module (`src/seo/google.js`) | ◐ rating, reviews, Search/Maps counters | n/a | GBP API access form; project quota stays 0 QPM until approved (300 QPM when approved); `business.manage` scope verification | No API fee |

Unknown for every row: current approval status of the platform apps, and live behaviour.

Additional connectors found (inventoried, not audited in depth, not added to scope):
Google Search Console, Analytics and Tag Manager (`google_seo`); Website domain proof and contact form; Email and
SMS (Resend, Telnyx, per workspace); Telnyx voice (`src/server.js:5079`); payment providers Stripe, PayPal, Square
(`src/payments.js`, `src/platform-pay.js`); LinkedIn, Facebook, X and WhatsApp *share links* only (no API).
Google Ads reporting is switched by `GOOGLE_ADS_DEVELOPER_TOKEN` and was not traced.

### Documentation sources (all read 9 November 2026)

- Meta access levels: https://developers.facebook.com/docs/graph-api/overview/access-levels/
- Facebook Login for Business: https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
- Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview/
- Messenger Platform overview: https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview
- WhatsApp Embedded Signup: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- WhatsApp service-message pricing change: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- Meta long-lived tokens: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
- Graph API versions: https://developers.facebook.com/docs/graph-api/changelog/versions/
- TikTok Login Kit for Web: https://developers.tiktok.com/doc/login-kit-web
- TikTok OAuth errors: https://developers.tiktok.com/doc/oauth-error-handling
- TikTok scopes: https://developers.tiktok.com/doc/tiktok-api-scopes
- TikTok sandbox: https://developers.tiktok.com/doc/add-a-sandbox
- TikTok Content Posting: https://developers.tiktok.com/doc/content-posting-api-get-started
- YouTube quota and audits: https://developers.google.com/youtube/data/guides/quota_and_compliance_audits
- X OAuth 2.0 authorisation code: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- X pricing: https://docs.x.com/x-api/getting-started/pricing
- Snapchat authentication: https://developers.snap.com/marketing-api/Ads-API/authentication
- Snapchat Public Profile API: https://developers.snap.com/marketing-api/Public-Profile-API/GetStarted
- Google Business Profile prerequisites: https://developers.google.com/my-business/content/prereqs

Not retrieved: Meta's manual login-flow page (dialog parameters such as `auth_type`), Google OAuth verification
policy pages, and Meta's "AI providers" WhatsApp pricing page. Statements that depend on them are marked unverified.

## 6. Unknowns and exact external blockers

| ID | Needed | Who | How (no secrets leave the dashboard) |
|---|---|---|---|
| B1 | Which provider variables are set, and the redirect addresses in use | Owner | Sign in to the Founder Console and open `/api/admin/integration-readiness` (`src/server.js:4733-4741`). It returns, per provider, `ready`, `missing` and `redirect_uri`, plus `public_base_url_set`. It returns no secret. Also confirm in Render whether `META_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `TIKTOK_REDIRECT_URI`, `X_REDIRECT_URI`, `SNAPCHAT_REDIRECT_URI` are set, and whether the single-business variables in section 2 hold Fleet Parlour values. |
| B2 | The failing request for "Invalid application" | Owner or a test subscriber | Reproduce once. Record: which card; the address-bar host of the page showing the error; a screenshot. In browser developer tools, Network tab, copy the `authorize_url` from the `/authorise` response and mask the middle of `client_id`/`client_key` and the whole `state`. Note the provider account used and whether it has a role on the platform app. |
| B3 | Platform app registration per provider | Owner | Meta: app name, type, mode, whether Facebook Login for Business is added, Business Verification status, access level per permission, Valid OAuth Redirect URIs, app domain and privacy URL. TikTok: sandbox or production, review status, approved scopes, registered redirect URIs, target users. Google: OAuth consent screen name and publishing status, test users, authorised redirect URIs, enabled APIs, GBP quota (0 or 300 QPM). X and Snap: whether an app exists. |
| B4 | Whether the global TikTok token and the workspace TikTok token are the same Fleet Parlour grant | Owner, with a later read-only check | `/api/tiktok/status` shows whether a global token exists. The Fleet Parlour workspace's Connections page shows its own. |
| B5 | Real Meta token lifetime | Live test after B3 | Read `expires_at` on the Meta card after one real connection. |
| B6 | Older production logs | Render | Retry the log query for 11 Oct to 2 Nov when Render log retrieval is available. |

## 7. Prioritised implementation plan

Nothing below has been started. Each step needs the owner's approval before code is written, and separately
before any deploy.

**P0 — close the exposure, change nothing a subscriber uses**

1. Put the legacy `/api/tiktok/login` and its legacy callback branch behind Founder sign-in (F1). Keep the route,
   the token file and `ensureTikTokAccessToken` so Fleet Parlour's existing authorisation keeps working.
2. Put `/api/social-stats` and `/api/tiktok/status` behind Founder sign-in, or confirm with the owner that public
   display of those figures is intended and remove only `?refresh=1` for anonymous callers (F2). First check
   whether the separate Fleet Parlour website reads `/api/social-stats`; if it does, it must keep working.
3. Collect B1, B2, B3. These decide everything in P1.

**P1 — make Connect work for a business that is not Fleet Parlour**

4. Validate redirect variables at start-up and in the readiness endpoint: same host as `PUBLIC_BASE_URL`, path is
   a supported callback, provider segment matches. Refuse to start a flow with an invalid one and say so in the
   Founder Console (F3). Add tests for Meta, Google, X and Snapchat overrides.
5. Ask for an explicit account choice on every provider and show "You are connecting <account name>" with a
   confirm step before saving; warn when that account or Page is already connected to another workspace (F4).
6. Register platform apps in SuperPro's name (app name, icon, privacy and terms links on the SuperPro domain) so
   no consent screen shows Fleet Parlour. Leave the existing Fleet Parlour app untouched for its own use.
7. Meta: move to Facebook Login for Business with a configuration ID; request only the permissions that have
   working features; exchange for a long-lived token and store Page tokens; read the Graph version from one
   setting (F5). Submit App Review with Business Verification. Until approval, add test subscribers as app testers.
8. TikTok: submit the production app for review with the scopes actually used; until then list test accounts as
   sandbox target users.
9. Google: publish the consent screen and complete verification for the YouTube and Business Profile scopes; file
   the GBP API access request.

**P2 — make a connection do what the card says**

10. WhatsApp: replace the Facebook dialog with Embedded Signup; register the number, subscribe the app to the
    WABA, bind the number to the workspace, add template support, and show subscribers that Meta bills them per
    message, including replies inside the 24-hour window since 1 October 2026 (F6).
11. Inbound binding: when a Page, Instagram account or WhatsApp number is selected, subscribe it to the app and
    create the workspace channel row automatically, with a uniqueness rule so one address cannot route to two
    workspaces (F7).
12. Correct the capability labels to match section 5 (F8).

**P3 — retire the single-business layer safely**

13. Confirm the Fleet Parlour workspace holds its own working connection for each provider it uses. Only then
    stop reading the single-business variables and the global TikTok file. Do not delete the variables or the
    file in the same release; keep them for one release as rollback.

**P4 — new capability, each a separate decision**

14. Instagram publishing, comments and insights; Facebook comments and Page insights; TikTok posting; YouTube
    upload and comments; Google Business posts; X at pay-per-use cost; Snapchat only if Snap grants allowlist
    access; ad accounts and campaigns (nothing exists today).

## 8. What stays untouched

Production data, the Render disk and environment, `INTEGRATION_ENCRYPTION_KEY` and session secrets, the global
TikTok token file, Fleet Parlour's existing provider grants, the Fleet Parlour website, and all unrelated features.
