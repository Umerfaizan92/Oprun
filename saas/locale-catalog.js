// Full locale catalogue: every language registered, same exports as before. Used by the server and the tests; the
// workspace imports saas/locale-core.js and loads its one language on demand (TR-72).
import { registerMessages } from './locale-core.js';
import hi from './locale/hi.js';
import ur from './locale/ur.js';
import ar from './locale/ar.js';
registerMessages('hi', hi); registerMessages('ur', ur); registerMessages('ar', ar);
export * from './locale-core.js';
