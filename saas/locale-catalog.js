// Full locale catalogue: every language registered, same exports as before. Used by the server and the tests; the
// workspace imports saas/locale-core.js and loads its one language on demand (TR-72).
import { registerMessages } from './locale-core.js';
import hi from './locale/hi.js';
import ur from './locale/ur.js';
import ar from './locale/ar.js';
import zh from './locale/zh.js';
import vi from './locale/vi.js';
import pa from './locale/pa.js';
import el from './locale/el.js';
import it from './locale/it.js';
import es from './locale/es.js';
import ne from './locale/ne.js';
import fil from './locale/fil.js';
registerMessages('hi', hi); registerMessages('ur', ur); registerMessages('ar', ar);
// MB-27: the next most-used languages among Australian service businesses and their customers.
for (const [code, dict] of Object.entries({ zh, vi, pa, el, it, es, ne, fil })) registerMessages(code, dict);
export * from './locale-core.js';
