# Oprun AI brand library (MB-12)

One source: [`src/brand.js`](../../src/brand.js). Tests: `scripts/brand-library.test.mjs`.

| What | Value |
|---|---|
| Name | **Oprun AI** (short: Oprun) |
| Site / general email | https://oprun.ai · hello@oprun.ai (security, billing and system senders keep their own addresses) |
| Gold (actions, focus, brand) | `#E6B455` (dark theme token `--sp-gold`; light theme uses `#8A6408` for contrast on white) |
| Deep gold | `#A87829` (`--sp-gold-600`) |
| Midnight (background, browser bar, app splash) | `#070B14` (`--sp-midnight`) |
| Text on gold | `#17120A` (`--sp-on-gold`) |

Assets (all in `saas/`): `oprun-icon.svg` (the O mark, any size), `oprun-logo.svg` (gradient mark for large
placements), `favicon.ico`, `oprun-icon-192.png` / `oprun-icon-512.png` (installed app, Android, Apple touch icon),
`oprun-icon-34/68/102.webp` (small header logo at 1×/2×/3×).

Rules
- Pages, the app manifest and emails take names, colours and icons from the library only; the test fails otherwise.
- Gold & black is the identity (D-056, brief 26 Nov 2026). Purple/cyan/navy proposals are not used.
- Platform emails draw the Oprun mark in HTML (shows with images blocked, T-189); business emails use the
  business's own name, colour and logo.
- Retired names (`superpro-icon*`, `superpro-mark.svg`) redirect permanently to the library; do not add new copies.
