// MB-12: the one brand source for Oprun AI. Names, contact, exact colours (equal to saas/ds/tokens.css, dark theme)
// and the asset library. Server code (emails, manifests, health) reads it; scripts/brand-library.test.mjs fails
// if pages, tokens, the app manifest or emails drift from it. Asset files live in saas/ and are listed here only.
export const BRAND = Object.freeze({
  name: 'Oprun AI',
  shortName: 'Oprun',
  site: 'https://oprun.ai',
  email: 'hello@oprun.ai',
  tagline: 'Run your world.',
  colors: Object.freeze({ gold: '#E6B455', goldDeep: '#A87829', midnight: '#070B14', onGold: '#17120A' }),
  assets: Object.freeze({
    mark: '/saas/oprun-icon.svg',          // the O mark, any size
    wordmark: '/saas/oprun-logo.svg',      // gold O mark with gradient, for large placements
    favicon: '/saas/favicon.ico',
    appIcon192: '/saas/oprun-icon-192.png', // PWA, Android, apple-touch-icon
    appIcon512: '/saas/oprun-icon-512.png', // PWA, Android (maskable)
    inline: Object.freeze(['/saas/oprun-icon-34.webp', '/saas/oprun-icon-68.webp', '/saas/oprun-icon-102.webp']) // 1x/2x/3x small logo in headers
  }),
  // Retired file names that still redirect to the library (old installs and links keep working).
  retired: Object.freeze({ '/saas/superpro-icon.svg': '/saas/oprun-icon.svg', '/saas/superpro-mark.svg': '/saas/oprun-icon.svg', '/saas/superpro-icon-192.png': '/saas/oprun-icon-192.png', '/saas/superpro-icon-512.png': '/saas/oprun-icon-512.png' })
});
