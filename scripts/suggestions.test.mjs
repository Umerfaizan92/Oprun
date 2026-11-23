// TR-25: temporary suggestions. Checks dismissal memory and the critical-warning rule (brief section 11).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../saas/suggestions.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(src, sandbox);
const T = sandbox.module.exports;

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

const info = { id: 'workforce-work-rights@1', kind: 'info', level: 'info' };
const critical = { id: 'billing-card-failed@1', kind: 'billing', level: 'critical' };

// Critical rule.
for (const kind of ['security', 'billing', 'compliance']) {
  const t = { id: `${kind}@1`, kind, level: 'critical' };
  assert.equal(T.isCritical(t), true, `${kind} critical`);
  assert.equal(T.canDismiss(t), false, `unresolved ${kind} warning cannot be dismissed`);
  assert.equal(T.visible(t, { [t.id]: 1 }), true, `unresolved ${kind} warning shows even if a dismissal was stored`);
  assert.equal(T.canDismiss({ ...t, resolved: true }), true, `resolved ${kind} warning may be dismissed`);
  assert.equal(T.visible({ ...t, resolved: true }, {}), false, `resolved ${kind} warning disappears`);
}
assert.equal(T.isCritical({ id: 'x@1', kind: 'info', level: 'critical' }), false, 'only security, billing and compliance are critical');
assert.equal(T.isCritical({ id: 'x@1', kind: 'billing', level: 'info' }), false, 'an informational billing tip is dismissible');

// Visibility.
assert.equal(T.visible(info, {}), true);
assert.equal(T.visible(info, { [info.id]: 1 }), false, 'dismissed tip stays hidden');
assert.equal(T.visible({ ...info, id: 'workforce-work-rights@2' }, { [info.id]: 1 }), true, 'a new version of the tip is shown once');
assert.equal(T.visible({ ...info, resolved: true }, {}), false, 'completed suggestion disappears');
assert.equal(T.visible({}, {}), false);
assert.equal(T.visible(info, Object.create({ [info.id]: 1 })), true, 'inherited keys are not dismissals');

// Store keys are per person and per business.
assert.equal(T.storeKey({ user: { id: 7 }, organisation: { id: 3 } }), 'oprun.tips.v1.3.7');
assert.equal(T.storeKey({ user: { id: 7 } }), 'oprun.tips.v1.none.7');
assert.equal(T.storeKey(null), null, 'no person, nothing stored');

// Dismissal memory survives a reload, and is separate for each person.
const storage = memoryStorage();
const a = T.makeStore(storage, T.storeKey({ user: { id: 1 }, organisation: { id: 9 } }));
assert.equal(a.dismiss(info, 1000), true);
assert.equal(a.dismiss(critical), false, 'critical warning refused');
assert.equal(a.has(critical.id), false);
const reloaded = T.makeStore(storage, T.storeKey({ user: { id: 1 }, organisation: { id: 9 } }));
assert.equal(reloaded.has(info.id), true, 'remembered after reload');
assert.equal(T.visible(info, reloaded.all()), false);
const other = T.makeStore(storage, T.storeKey({ user: { id: 2 }, organisation: { id: 9 } }));
assert.equal(other.has(info.id), false, 'another person still sees the tip');
reloaded.reset();
assert.equal(T.makeStore(storage, T.storeKey({ user: { id: 1 }, organisation: { id: 9 } })).has(info.id), false, 'reset clears');

// Broken or missing storage never throws.
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
const b = T.makeStore(broken, 'k');
assert.equal(b.dismiss(info), true, 'dismiss works for this page view even when storage is blocked');
assert.equal(b.has(info.id), true);
const bad = memoryStorage(); bad.setItem('k', '[1,2]');
assert.deepEqual({ ...T.makeStore(bad, 'k').all() }, {}, 'non-object stored value ignored');
bad.setItem('k', '{not json');
assert.deepEqual({ ...T.makeStore(bad, 'k').all() }, {}, 'corrupt stored value ignored');
assert.equal(T.makeStore(null, null).dismiss(info), true);

// The workspace marks the right elements.
const html = readFileSync(new URL('../saas/workspace.html', import.meta.url), 'utf8');
assert.match(html, /data-tip="workforce-work-rights@1"/);
assert.match(html, /data-tip="money-not-tax-advice@1" data-tip-kind="compliance" data-tip-level="critical"/, 'the tax-advice disclaimer is never dismissible');
assert.match(html, /data-tip="cc-setup-checklist@1"/);
assert.match(html, /src="suggestions\.js\?v=/);

console.log('suggestions: dismissal memory and critical-warning rule pass');
