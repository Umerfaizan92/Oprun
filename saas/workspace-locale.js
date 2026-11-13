import { message, formatMessage } from './locale-catalog.js?v=20261113.l3';
const trigger = document.getElementById('workspace-language');
const dialog = document.getElementById('workspace-language-dialog');
const form = dialog?.querySelector('form');
// revision: newest GET/PUT wins. context: bumps on business switch or sign-out, so a response that belongs to the
// previous business or session can never repaint the page, set a status, or re-enable the save button (CG-001).
let preference = null, loading = null, revision = 0, context = 0, activeSave = 0;
const api = async (options = {}) => {
  const response = await fetch('/api/saas/preferences/language', { credentials: 'same-origin', ...options });
  if (!response.ok) throw new Error('Language preference unavailable');
  return response.json();
};
function apply(data) {
  preference = data;
  // No account preferences in shared-device localStorage; the session is authoritative.
  // Most legacy screens are English until their dictionary migration is certified.
  document.documentElement.lang = 'en';
  document.documentElement.dataset.preferredLocale = data.locale;
  document.documentElement.dir = data.direction;
  for (const element of document.querySelectorAll('[data-i18n]')) { element.textContent = message(data.locale, element.dataset.i18n); element.lang = ['en','hi','ur','ar'].includes(data.locale.split('-')[0]) ? data.locale : 'en'; }
  const bell = document.querySelector('.app-topbar button[aria-label="Notifications"],.app-topbar [data-i18n-aria="notifications"]');
  if (bell) { bell.dataset.i18nAria = 'notifications'; bell.setAttribute('aria-label', message(data.locale, 'notifications')); }
  const localeName = data.locales.find(x => x.code === data.locale)?.native_name || data.locale;
  trigger.textContent = localeName; trigger.lang = data.locale; trigger.setAttribute('aria-label', `${message(data.locale, 'language')}: ${localeName}`);
  form.elements.locale.replaceChildren(...data.locales.map(locale => {
    const option = document.createElement('option'); option.value = locale.code;
    option.textContent = `${locale.native_name} — ${locale.name} (${locale.code})`; option.selected = locale.code === data.locale;
    return option;
  }));
  window.dispatchEvent(new CustomEvent('oprun:locale-changed', { detail: { locale: data.locale, direction: data.direction } }));
}
async function load() {
  const requestRevision = ++revision;
  try { const data = await api(); if (requestRevision === revision) apply(data); }
  catch { if (requestRevision === revision) trigger.setAttribute('title', 'Language preferences are temporarily unavailable. Try again.'); }
}
if (trigger && dialog && form) {
  trigger.addEventListener('click', async () => {
    loading ||= load().finally(() => { loading = null; }); await loading;
    if (preference && !dialog.open) { dialog.querySelector('[role="status"]').textContent = message(preference.locale, 'coverage'); dialog.showModal(); }
  });
  dialog.querySelector('[data-language-close]').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async event => {
    event.preventDefault(); const save = form.querySelector('[type="submit"]'); save.disabled = true;
    const mine = ++revision, ctx = context; activeSave = mine;
    const current = () => mine === revision && ctx === context;
    try {
      const data = await api({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: form.elements.locale.value }) });
      if (current()) { apply(data); dialog.querySelector('[role="status"]').textContent = message(data.locale, 'notice'); }
    } catch { if (current()) dialog.querySelector('[role="status"]').textContent = message(preference?.locale || 'en', 'error'); }
    finally { if (activeSave === mine) { activeSave = 0; save.disabled = false; } }
  });
  const resetContext = () => {
    context++; activeSave = 0;
    form.querySelector('[type="submit"]').disabled = false; dialog.querySelector('[role="status"]').textContent = '';
  };
  window.addEventListener('superpro:workspace-ready', () => { resetContext(); load(); });
  document.getElementById('logout')?.addEventListener('click', resetContext, true);
  if (window.GDS_SESSION) load();
}
// Domain data is formatted on demand; never rewrite user-entered content or stored money.
window.OprunLocale = Object.freeze({
  get locale() { return preference?.locale || 'en-AU'; },
  // Script-rendered text: dictionary pattern for the reader's language (English when untranslated), formatted with
  // plurals and placeholders. Returns undefined for an unknown key so callers keep their own English.
  t: (key, values = {}) => { const locale = preference?.locale || 'en-AU', pattern = message(locale, key); return pattern === key ? undefined : formatMessage(locale, pattern, values); },
  translated: key => { const locale = preference?.locale || 'en-AU'; return message(locale, key) !== message('en', key); },
  number: (value, options) => new Intl.NumberFormat(preference?.locale || 'en-AU', options).format(value),
  date: (value, options) => new Intl.DateTimeFormat(preference?.locale || 'en-AU', options).format(value),
  currency: (value, currency) => new Intl.NumberFormat(preference?.locale || 'en-AU', { style: 'currency', currency }).format(value)
});
