import { message, formatMessage } from './locale-catalog.js?v=20261113.l9';
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
// Tagged elements: data-i18n="key" sets the text; data-i18n-attr="aria-label=key;placeholder=key;data-tip=key" sets
// attributes. lang marks text that really is in the reader's language (English fallback stays lang="en").
function translateOne(element, locale) {
  const inLanguage = key => message(locale, key) !== message('en', key) || /^en\b/.test(locale);
  const key = element.dataset.i18n;
  if (key && message('en', key) !== key) { const text = message(locale, key); if (element.textContent !== text) element.textContent = text; element.lang = inLanguage(key) ? locale : 'en'; }
  for (const pair of (element.dataset.i18nAttr || '').split(';')) {
    const [attr, attrKey] = pair.split('=').map(x => x?.trim());
    if (attr && attrKey && message('en', attrKey) !== attrKey && /^(aria-label|placeholder|title|data-tip)$/.test(attr)) element.setAttribute(attr, message(locale, attrKey));
  }
}
function translateTree(root, locale) {
  if (root.matches?.('[data-i18n],[data-i18n-attr]')) translateOne(root, locale);
  for (const element of root.querySelectorAll('[data-i18n],[data-i18n-attr]')) translateOne(element, locale);
  if (root.matches?.('[data-i18n-phrases]')) watchPhrases(root);
  for (const element of root.querySelectorAll('[data-i18n-phrases]')) watchPhrases(element);
  if (root === document) for (const phraseRoot of phraseRoots) translatePhrases(phraseRoot, locale); // language change only
}
// Phrase translation for older screens built from HTML strings: an element with data-i18n-phrases="name" uses the
// map window.OprunPhraseMaps[name] = { 'Exact English text': 'dictionary.key', 'Prefix ': 'key' (trailing space =
// prefix) }. Text and aria-label/placeholder/title that exactly match are swapped; the English is remembered so a
// later language switch (including back to English) works. Data that is not in the map is never touched.
const englishText = new WeakMap(), englishAttr = new WeakMap(), phraseRoots = new Set();
function translatePhrases(root, locale) {
  const map = window.OprunPhraseMaps?.[root.dataset.i18nPhrases]; if (!map) return;
  const swap = english => {
    const trimmed = english.trim(); if (!trimmed) return english;
    if (map[trimmed]) return english.replace(trimmed, message(locale, map[trimmed]));
    for (const [prefix, key] of Object.entries(map)) if (prefix.endsWith(' ') && trimmed.startsWith(prefix)) return english.replace(prefix.trim(), message(locale, key));
    return english;
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('script,style,textarea,input,[contenteditable]')) continue;
    const english = englishText.get(node) ?? node.nodeValue, next = swap(english);
    if (next !== english || englishText.has(node)) { englishText.set(node, english); if (node.nodeValue !== next) node.nodeValue = next; }
  }
  for (const element of root.querySelectorAll('[aria-label],[placeholder],[title]')) {
    const saved = englishAttr.get(element) || {};
    for (const attr of ['aria-label', 'placeholder', 'title']) {
      if (!element.hasAttribute(attr)) continue;
      const english = saved[attr] ?? element.getAttribute(attr), next = swap(english);
      if (next !== english || saved[attr] !== undefined) { saved[attr] = english; if (element.getAttribute(attr) !== next) element.setAttribute(attr, next); }
    }
    englishAttr.set(element, saved);
  }
}
function watchPhrases(root) {
  if (phraseRoots.has(root)) return; phraseRoots.add(root);
  let queued = false;
  new MutationObserver(() => { if (queued || !preference) return; queued = true; queueMicrotask(() => { queued = false; translatePhrases(root, preference.locale); }); })
    .observe(root, { childList: true, subtree: true, characterData: true });
  if (preference) translatePhrases(root, preference.locale);
}
// Elements that scripts add later (top-bar buttons, floating buttons, footer) are translated as they appear.
new MutationObserver(records => {
  if (!preference) return;
  for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) translateTree(node, preference.locale);
}).observe(document.documentElement, { childList: true, subtree: true });
function apply(data) {
  preference = data;
  // No account preferences in shared-device localStorage; the session is authoritative.
  // Most legacy screens are English until their dictionary migration is certified.
  document.documentElement.lang = 'en';
  document.documentElement.dataset.preferredLocale = data.locale;
  document.documentElement.dir = data.direction;
  translateTree(document, data.locale);
  const bell = document.querySelector('.app-topbar button[aria-label="Notifications"],.app-topbar [data-i18n-aria="notifications"]');
  if (bell) { bell.dataset.i18nAria = 'notifications'; bell.setAttribute('aria-label', message(data.locale, 'notifications')); }
  const localeName = data.locales.find(x => x.code === data.locale)?.native_name || data.locale;
  trigger.textContent = localeName; trigger.dataset.short = String(data.locale || 'en').split('-')[0].toUpperCase(); trigger.lang = data.locale; trigger.setAttribute('aria-label', `${message(data.locale, 'language')}: ${localeName}`);
  form.elements.locale.replaceChildren(...data.locales.map(locale => {
    const option = document.createElement('option'); option.value = locale.code;
    option.textContent = locale.label || locale.native_name; option.lang = locale.code; option.selected = locale.code === data.locale;
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
