# MB-27: workspace translation coverage

Measured 26 November 2026 with `saas/locale-catalog.js` (`screenCoverage`, 559 workspace text keys: shell, Today
board, Command Centre sections, navigation, onboarding interview, industry vocabulary).

| Language | Before | After | Review state |
|---|---|---|---|
| English (source) | 100% | 100% | source |
| Hindi · हिन्दी | 100% | 100% | machine draft, unreviewed |
| Urdu · اردو (RTL) | 100% | 100% | machine draft, unreviewed |
| Arabic · العربية (RTL) | 100% | 100% | machine draft, unreviewed |
| Chinese (Simplified) · 中文 | 0% (English fallback) | 100% | machine draft, unreviewed |
| Vietnamese · Tiếng Việt | 0% | 100% | machine draft, unreviewed |
| Punjabi · ਪੰਜਾਬੀ | 0% | 100% | machine draft, unreviewed |
| Greek · Ελληνικά | 0% | 100% | machine draft, unreviewed |
| Italian · Italiano | 0% | 100% | machine draft, unreviewed |
| Spanish · Español | 0% | 100% | machine draft, unreviewed |
| Nepali · नेपाली | 0% | 100% | machine draft, unreviewed |
| Filipino | 0% | 100% | machine draft, unreviewed |
| Every other language (185) | English fallback | English fallback | — |

Why these: the ABS 2021 Census top ten home languages other than English are Mandarin, Arabic, Vietnamese,
Cantonese, Punjabi, Greek, Italian, Filipino/Tagalog, Hindi and Spanish. All of them are now covered (Cantonese readers
get Chinese characters through `zh`; a Traditional-script dictionary is a later step). Urdu (translated earlier) and Nepali
are kept as extras.

Checks: every key present, placeholders unchanged, plural patterns valid and formatted without stray braces
(`/home/claude/tools/locale-check.mjs` during the work; `scripts/localization-dictionary.test.mjs` now loops over all
loadable languages). Each language loads only when chosen (one file, about 40–55 KB), so English users download nothing
extra.

Not covered yet: page text that is still written directly in HTML and not in the dictionary (most forms and settings
pages). That needs the strings moved into the dictionary first; it is the next translation step.

Owner note: these are machine drafts. Before calling a language "supported" in marketing, have a native speaker
review it (the catalogue already marks them `machine-draft-unreviewed`).
