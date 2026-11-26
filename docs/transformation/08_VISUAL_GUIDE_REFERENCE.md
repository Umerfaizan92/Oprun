# 08 · Visual guide reference (owner's Google examples, 26 Nov 2026)

Notes only. No Google video, image, text or branding is copied into Oprun; we copy the pacing and layout ideas and
build our own scenes from Oprun's real screens with synthetic data, in Oprun's gold and black style.

## Owner video (Google Business Profile page, phone, 29 s, 1028×1862, 60 fps)
- Placement: one card directly under the page's main heading and primary button, full content width, about 2:1
  (wide) on phone, rounded corners, soft pale background; heading, one-line description and a second button sit below.
- Plays silently and loops by itself; a round pause button sits in the bottom-right corner of the card.
- About 10 scenes of roughly 3 s each, one idea per scene, with soft slides and fades between them:
  short phrase → a person searching on a phone → search result card on a map → cards sliding → a review and the
  business's reply → photos of the business → the person again → map pin. App screens are simplified mock-ups,
  floating on the pale background, never a full screenshot.
- Text inside the animation is very short (3–6 words); the explanation lives in the page text, not the video.

## Owner screenshots (Google Account, dark theme, phone)
- Each area is one rounded row: coloured round icon on the left, bold title, one grey line listing what is inside.
- Rows are grouped in cards with small gaps; one suggestion card at the top with "Dismiss" and one primary action.
- Footer actions as two outlined pills: "Search …" and "Get help"; a short privacy sentence; Privacy · Terms · Help · About.

## How Oprun uses this (MB-23, MB-24)
- MB-23 page pattern: grouped rows with a gold-tinted round icon, title and one line of contents; one primary gold
  action per page; suggestions dismissible; Search and Help pills at the end of long settings pages.
- MB-24 demo card: same placement and proportions; 3 s scenes built from Oprun screens rendered by Playwright with
  synthetic data, cursor and highlight animated, joined with FFmpeg; muted loop with pause/replay, lazy-loaded,
  paused offscreen, still image for reduced motion; each demo listed in a versioned registry with the pages it shows.
