// Phone and desktop alerts for the business workspace.
// - After sign-in, asks once (on this device) to allow notifications; "Not now" asks again after 3 days.
// - Subscribes this device to Web Push so alerts arrive even when Oprun is closed.
// - When Oprun is open, new alerts are also read aloud (can be switched off per device).
(() => {
  if (window.OprunPush) return;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const api = async (url, opt = {}) => { const r = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opt }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Phone alerts could not be updated.'); return d; };
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  const sameKey = (sub, key) => { try { const a = new Uint8Array(sub.options.applicationServerKey), b = b64(key); return a.length === b.length && a.every((v, i) => v === b[i]); } catch { return false; } };
  let config = null;
  const listeners = new Set(), emit = () => listeners.forEach(fn => { try { fn(); } catch {} });

  async function registration() { await navigator.serviceWorker.register('/saas/sw.js?v=20261112.1', { scope: '/saas/', updateViaCache: 'none' }).catch(() => {}); return navigator.serviceWorker.ready; }
  async function loadConfig(force) { if (!config || force) config = await api('/api/saas/push/config'); return config; }
  async function currentSubscription() { if (!supported) return null; const reg = await registration(); return reg.pushManager.getSubscription(); }
  async function subscribe() {
    const cfg = await loadConfig(true); if (!cfg.available || !cfg.public_key) throw new Error('Phone alerts are not available on this server yet.');
    const reg = await registration(); let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, cfg.public_key)) { await sub.unsubscribe().catch(() => {}); sub = null; }
    sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.public_key) });
    const json = sub.toJSON();
    await api('/api/saas/push/subscribe', { method: 'POST', body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, device: (navigator.userAgentData?.platform || (ios ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'Desktop')) + ' browser' }) });
    return sub;
  }
  async function status() {
    if (!supported) return { state: ios && !standalone ? 'ios-install' : 'unsupported' };
    if (Notification.permission === 'denied') return { state: 'blocked' };
    if (Notification.permission !== 'granted') return { state: 'off' };
    const sub = await currentSubscription().catch(() => null);
    return { state: sub ? 'on' : 'off' };
  }
  async function enable() {
    if (!supported) throw new Error(ios && !standalone ? 'On iPhone and iPad, first add Oprun to your Home Screen (Share › Add to Home Screen), then open it from there.' : 'This browser does not support phone alerts.');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') { emit(); throw new Error(permission === 'denied' ? 'Notifications are blocked. Allow them for oprun.ai in your browser or phone settings.' : 'Notifications were not allowed.'); }
    await subscribe(); emit(); return true;
  }
  async function disable() {
    const sub = await currentSubscription().catch(() => null);
    if (sub) { await api('/api/saas/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    emit();
  }
  const test = () => api('/api/saas/push/test', { method: 'POST', body: '{}' });

  // Spoken alerts while Oprun is open (system notifications handle the closed-app case).
  const voiceOn = () => store.get('oprun-voice-alerts') !== '0';
  const setVoice = on => store.set('oprun-voice-alerts', on ? '1' : '0');
  let lastSpoken = '', lastAt = 0;
  function speak(text) {
    if (!voiceOn() || !('speechSynthesis' in window) || !text) return;
    if (text === lastSpoken && Date.now() - lastAt < 15000) return; lastSpoken = text; lastAt = Date.now();
    try { const u = new SpeechSynthesisUtterance('Oprun alert. ' + String(text).slice(0, 160)); u.rate = 1; u.lang = document.documentElement.lang || 'en-AU'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
  }
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.type === 'oprun-push') { window.SuperProPlatformNotices?.load?.(true); }
    if (e.data?.type === 'oprun-open' && typeof e.data.hash === 'string' && e.data.hash.startsWith('#')) location.hash = e.data.hash;
  });

  // Ask once after sign-in on each device; keep an existing permission linked to the signed-in person.
  function prompt() {
    if (document.getElementById('oprun-push-prompt')) return;
    const d = document.createElement('dialog'); d.id = 'oprun-push-prompt'; d.className = 'oprun-push-prompt'; d.setAttribute('aria-labelledby', 'oprun-push-title');
    d.innerHTML = '<div class="opp-card"><span class="opp-icon" aria-hidden="true">🔔</span><h2 id="oprun-push-title">Get alerts on this device</h2><p>New job enquiries, approvals, messages and job updates will reach you straight away, even when Oprun is closed. You can change this any time in Notification settings.</p>' + (ios && !standalone ? '<p class="opp-note">On iPhone and iPad, first add Oprun to your Home Screen (Share › Add to Home Screen) and open it from there.</p>' : '') + '<p class="opp-status" role="status"></p><div class="opp-actions"><button type="button" class="secondary-button" data-opp-later>Not now</button><button type="button" class="primary-button" data-opp-allow>Allow notifications</button></div></div>';
    document.body.append(d);
    const statusLine = d.querySelector('.opp-status');
    d.querySelector('[data-opp-later]').onclick = () => { store.set('oprun-push-snooze', String(Date.now())); d.close(); d.remove(); };
    d.querySelector('[data-opp-allow]').onclick = async () => {
      statusLine.textContent = 'Waiting for your browser…';
      try { await enable(); statusLine.textContent = 'Alerts are on for this device.'; await test().catch(() => {}); setTimeout(() => { d.close(); d.remove(); }, 900); }
      catch (err) { statusLine.textContent = err.message; }
    };
    d.addEventListener('cancel', () => store.set('oprun-push-snooze', String(Date.now())));
    d.showModal();
  }
  let asked = '';
  async function onSignedIn() {
    const s = window.GDS_SESSION, who = s?.user?.id ? s.user.id + ':' + s.organisation?.id : ''; if (!who || asked === who) return; asked = who;
    if (!supported) return;
    if (Notification.permission === 'granted') { subscribe().then(emit).catch(() => {}); return; }
    if (Notification.permission === 'denied') return;
    if (navigator.webdriver && !window.__oprunPushPromptTest) return; // automated test browsers: no surprise modal
    const snoozed = Number(store.get('oprun-push-snooze') || 0); if (Date.now() - snoozed < 3 * 864e5) return;
    const cfg = await loadConfig(true).catch(() => null); if (!cfg?.available) return;
    setTimeout(() => { if (!document.querySelector('dialog[open]')) prompt(); else setTimeout(prompt, 4000); }, 1500);
  }
  window.addEventListener('superpro:workspace-ready', onSignedIn);
  if (window.GDS_SESSION) onSignedIn();

  window.OprunPush = { supported, ios, standalone, status, enable, disable, test, speak, voiceOn, setVoice, onChange: fn => listeners.add(fn), prompt };
})();
