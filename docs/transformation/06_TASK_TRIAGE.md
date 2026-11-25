# Open task triage (26 Nov 2026, after the TR-81 release)

The task register (`.claude/project-memory/PENDING_TASKS.md`) held 85 open tasks after the release, many from October
and early November. Each was checked against the code now live (`main` at `9074580`, released 25 Nov) and the test
suites that passed for that release (npm test 73/73, 24 browser suites, 348 visual screens). Tasks are only closed
here when their acceptance is met by evidence; tasks that look replaced by later work need the owner's agreement
before they are closed (as the TR-01 audit proposed).

## A. Closed now: acceptance met by tests and the live release

| Task | Evidence |
|---|---|
| T-069 Connections safe base | `scripts/connections-safe-base.test.mjs` in npm test (passed 25 Nov); deployed in the 25 Nov release; production start-up diagnostics checked |
| T-074 Built-in meetings and direct calling | `test:meetings-ui` (staff and guest media, waiting room) and the meeting server tests passed 25 Nov; released |
| T-078 Operator sign-in on Business sign-in | `#signin-operator-link` present in `saas/sign-in.html`; guarded by the UI and navigation suites (passed 25 Nov); standing rule in CLAUDE.md; released |
| T-082 No B01–B09 numbering | The live navigation table (`saas/workspace-nav.js`, final `DOMAINS`) has no B0x labels; the older table's "B0x" kicker text is replaced and never displayed; navigation suite (633 checks) passed |
| T-083 Secondary navigation and Today density | Navigation and mobile suites cover "More" closed by default and compact layouts (passed 25 Nov); released |
| T-084 Branding and auto-hiding navigation | Drawer open/close, Escape and focus return covered by the navigation and mobile suites (passed 25 Nov); released |
| T-085 Command Centre hierarchy and mobile AI density | Greeting-before-AI and mobile density checks in the UI suites (passed 25 Nov); released |
| T-086 Failed Render build from a flaky approval test | Three live builds since (22 Nov, 25 Nov 15:38 and 17:04 UTC) ran the full npm test and passed, as did about ten local full runs |
| T-089 One mobile bottom row | Mobile workspace suite (310 checks) passed; released |
| T-090 Compact mobile bar, notification settings, push alerts | Mobile suite checks no horizontal scroll in the dock; push subscribe/send tests in npm test; released |
| T-094 Global language preferences | Localization unit tests (26/26) and the browser suite (Urdu right-to-left, save, reload, English fallback) passed 25 Nov; released |
| T-148 W-02 Website data migration | `seo_sites` gained all six contract columns and `website_generation_runs` exists (TR-63, D-069); the other contract tables belong to later website phases (W-10, W-15, W-16), which create them when built, as the plan says ("lazy and additive") |

## B. Looks replaced by later work: close only with the owner's agreement

| Task | Why it looks replaced |
|---|---|
| T-062 Consolidation on `consolidated-improvements-2026` | All work now lives on `main` (released 25 Nov) |
| T-063 Recover the eleven-prompt release | `main` holds the reconciled code; production data preserved (restore drill 25 Nov) |
| T-065 Publish the reviewed navigation branch | Navigation work merged and released |
| T-066 Navigation audit and release prep | Replaced by TR-60 and the navigation suite |
| T-081 Final redesign and security audit prompts | Replaced by the TR-50–52 redesign the owner approved |
| T-087 Rebuild ChatGPT f039490 changes | Footer brand, bottom bar and sidebar are in the released design |
| T-088 Restore the saved ChatGPT design over PR 82 | Replaced by the approved TR-50–52 design |
| T-091, T-092 Command Centre prompts 01 and 02 | Their changes are merged and released; the acceptance asked for an unmerged PR |

## C. Waiting for the owner or an outside account

| Task | What is needed |
|---|---|
| T-037 Accessible names matching visible text | Owner approval to change labels (tests change with them) |
| T-048 Automation scheduler in a separate worker | Owner approval (changes the Render set-up) |
| T-053 Google evidence after deploy | Search Console access |
| T-055 Live Telnyx and Resend check | Real accounts and a test number/address |
| T-057 Live Stripe test-mode check | Stripe test keys |
| T-060 Live reliability check | Can be done from the live logs; partly done 25 Nov (it found the AI credit problem, E-059) |
| T-067, T-068, T-079, T-080 Social connections | Provider app IDs and live accounts (owner blockers B1–B3) |
| T-072 Provider-dependent Connections phases | Same blockers |
| T-073 Meta App ID | Owner sets the real App ID and registers redirect addresses |
| T-076 Mobile app release | Store signing, device tests and store approvals |
| T-141, T-142 Receptionist intake and own Telnyx account | A live test call to a real number |
| T-236 TR-72 speed target | Owner decides whether 75–83 is accepted |
| T-240 TR-81 release | Owner's short live check |

## D. Open work that can be done without outside accounts

| Task | Note |
|---|---|
| T-040 Enquiries from inbox messages and calls | Calls already create enquiries (T-141); inbox has a "Create enquiry" action in the comms panel: check what is missing |
| T-041 Quote and invoice documents for customers | Not built |
| T-042 Attachments on enquiries, quotes, invoices | Not built |
| T-043 Notifications for pipeline events | Not built |
| T-044 Pipeline summary on the Command Centre | Not built |
| T-045 Restore-drill results in Storage & backups | Partly: health reporting exists; drill results are not stored |
| T-047 Inbox messages as automation triggers | The event is emitted (`src/comms/service.js`); no automation listens yet; test missing |
| T-050–T-052 Public-site SEO findings, image re-encoding, custom domains | T-052 needs DNS access for real domains |
| T-059 Monthly long-term backup copies | Not built |
| T-077 Channel operations hub | In progress since early November |
| T-169 Tax labels per country | Not built |
| T-121–T-140 AI Receptionist plan R-01–R-20 | Large programme; real calls need Telnyx, Deepgram and ElevenLabs accounts |
| T-151–T-163, T-200, T-201 AI Website plan W-05–W-20 | Large programme; DNS, registrar and email steps need the business's own accounts |

The tasks in section D marked "Owner approval of scope" in the register (T-040–T-045) were logged with that step;
their scope is short and is proposed in the reply to the owner before building.
