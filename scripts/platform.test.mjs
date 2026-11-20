// T-172: device and shell detection (saas/ds/platform.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../saas/ds/platform.js', import.meta.url), 'utf8');
function load(win) { const ctx = { window: win, module: undefined }; vm.runInNewContext(src, ctx); return win.OprunPlatform; }
function fakeWindow({ width = 390, ua = 'Mozilla/5.0', search = '', referrer = '', standalone = false, coarse = true, stored = '' } = {}) {
  const attrs = {}, store = { 'oprun-shell': stored }, replaced = [];
  const listeners = [];
  const win = {
    innerWidth: width, navigator: { userAgent: ua, standalone: false },
    location: { search, pathname: '/saas/workspace.html', hash: '#today/home' },
    history: { state: null, replaceState: (s, t, u) => replaced.push(u) },
    sessionStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    matchMedia: (q) => ({ matches: q.includes('standalone') ? standalone : q.includes('coarse') ? coarse : false, addEventListener: (e, f) => listeners.push([q, f]) }),
    document: { referrer, documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k], clientWidth: width } }
  };
  return { win, attrs, store, replaced, listeners };
}

test('device classes follow the three agreed widths', () => {
  const p = load(fakeWindow().win);
  assert.deepEqual([320, 699, 700, 1023, 1024, 1920].map(p.device), ['phone', 'phone', 'tablet', 'tablet', 'desktop', 'desktop']);
});

test('shells: iOS app, Android app, home-screen app, browser', () => {
  const p = load(fakeWindow().win);
  assert.equal(p.shell({ ua: 'Mozilla/5.0 (iPhone) AppleWebKit OprunApp-iOS/1.0.0' }), 'ios-app');
  assert.equal(p.shell({ search: '?shell=android-app' }), 'android-app');
  assert.equal(p.shell({ referrer: 'android-app://ai.oprun.app/' }), 'android-app');
  assert.equal(p.shell({ stored: 'android-app' }), 'android-app', 'remembered for the rest of the visit');
  assert.equal(p.shell({ standalone: true }), 'pwa');
  assert.equal(p.shell({ ua: 'Mozilla/5.0 (Android 15) Chrome/140 Mobile' }), 'browser');
  assert.equal(p.shell({ stored: 'admin' }), 'browser', 'unknown stored values are ignored');
});

test('on load the attributes are set before paint, the Android marker is remembered and removed from the address', () => {
  const f = fakeWindow({ width: 412, search: '?shell=android-app' });
  load(f.win);
  assert.deepEqual([f.attrs['data-device'], f.attrs['data-shell'], f.attrs['data-pointer']], ['phone', 'android-app', 'touch']);
  assert.equal(f.store['oprun-shell'], 'android-app');
  assert.deepEqual(f.replaced, ['/saas/workspace.html#today/home']);
  const d = fakeWindow({ width: 1440, coarse: false });
  load(d.win);
  assert.deepEqual([d.attrs['data-device'], d.attrs['data-shell'], d.attrs['data-pointer']], ['desktop', 'browser', 'fine']);
  const t = fakeWindow({ width: 820, ua: 'Mozilla/5.0 (iPad) OprunApp-iOS/1.0.0' });
  load(t.win);
  assert.deepEqual([t.attrs['data-device'], t.attrs['data-shell']], ['tablet', 'ios-app']);
  // Rotation/resize updates the device class.
  t.win.innerWidth = 1180; for (const [q, fn] of t.listeners) if (q.includes('min-width')) fn();
  assert.equal(t.attrs['data-device'], 'desktop');
});

test('the apps announce themselves to the page', () => {
  assert.match(fs.readFileSync(new URL('../mobile/android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'), /workspace\.html\?shell=android-app/);
  assert.match(fs.readFileSync(new URL('../mobile/ios/Oprun/OprunApp.swift', import.meta.url), 'utf8'), /applicationNameForUserAgent = "OprunApp-iOS\//);
});
