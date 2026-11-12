// Selectable locale catalogue. Selection is distinct from translation certification.
// ISO 639-1 languages plus common script/region variants; no paid translation API.
export const LANGUAGE_CODES = ('aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu').split(' ');
export const SELECTABLE_LOCALES = Object.freeze([...new Set([...LANGUAGE_CODES, 'en-AU', 'en-GB', 'en-US', 'es-MX', 'fr-CA', 'pt-BR', 'pt-PT', 'zh-Hans', 'zh-Hant', 'pa-Arab', 'pa-Guru', 'sr-Cyrl', 'sr-Latn'].map(code => Intl.getCanonicalLocales(code)[0]))]);
const allowed = new Set(SELECTABLE_LOCALES);
export function canonicalLocale(input) {
  if (typeof input !== 'string' || input.length > 40) return null;
  try { const value = Intl.getCanonicalLocales(input)[0]; return allowed.has(value) ? value : null; } catch { return null; }
}
export function localeDirection(locale) {
  const parsed = new Intl.Locale(canonicalLocale(locale) || 'en');
  const script = parsed.maximize().script;
  return ['Arab', 'Hebr', 'Thaa', 'Nkoo', 'Adlm', 'Syrc'].includes(script) ? 'rtl' : 'ltr';
}
export const MESSAGES = Object.freeze({
  en: { language: 'Language', save: 'Save', close: 'Close', signOut: 'Sign out', notifications: 'Notifications', manual: 'User Manual', notice: 'Language preference saved. Untranslated screens use English. Voice and message languages depend on their provider.', error: 'Language preference could not be saved. Try again.', coverage: 'Language selection is available; full workspace translation is in progress.' },
  hi: { language: 'भाषा', save: 'सहेजें', close: 'बंद करें', signOut: 'साइन आउट', notifications: 'सूचनाएँ', manual: 'उपयोगकर्ता निर्देश', notice: 'भाषा सहेज दी गई है। बिना अनुवाद वाली स्क्रीन अंग्रेज़ी में दिखेंगी। आवाज़ और संदेश की भाषाएँ प्रदाता पर निर्भर हैं।', error: 'भाषा सहेजी नहीं जा सकी। फिर कोशिश करें।', coverage: 'भाषा चुन सकते हैं; पूरे कार्यक्षेत्र का अनुवाद अभी जारी है।' },
  ur: { language: 'زبان', save: 'محفوظ کریں', close: 'بند کریں', signOut: 'سائن آؤٹ', notifications: 'اطلاعات', manual: 'صارف کی رہنمائی', notice: 'زبان محفوظ ہو گئی ہے۔ غیر ترجمہ شدہ صفحات انگریزی میں ہوں گے۔ آواز اور پیغامات کی زبان فراہم کنندہ پر منحصر ہے۔', error: 'زبان محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔', coverage: 'زبان منتخب کر سکتے ہیں؛ مکمل ترجمے پر کام جاری ہے۔' },
  ar: { language: 'اللغة', save: 'حفظ', close: 'إغلاق', signOut: 'تسجيل الخروج', notifications: 'الإشعارات', manual: 'دليل المستخدم', notice: 'تم حفظ اللغة. تظهر الشاشات غير المترجمة بالإنجليزية. تعتمد لغات الصوت والرسائل على المزوّد.', error: 'تعذّر حفظ اللغة. حاول مجدداً.', coverage: 'اختيار اللغة متاح؛ ترجمة مساحة العمل الكاملة قيد التنفيذ.' }
});
export function message(locale, key) { return MESSAGES[canonicalLocale(locale)?.split('-')[0]]?.[key] ?? MESSAGES.en[key] ?? key; }
export function localeCatalogue(displayLocale = 'en') {
  const names = new Intl.DisplayNames([canonicalLocale(displayLocale) || 'en', 'en'], { type: 'language' });
  return SELECTABLE_LOCALES.map(code => {
    let nativeName = code;
    try { nativeName = new Intl.DisplayNames([code, 'en'], { type: 'language' }).of(code); } catch {}
    return { code, name: names.of(code), native_name: nativeName, direction: localeDirection(code), translation_status: 'partial', translated_scope: MESSAGES[code.split('-')[0]] ? 'language-panel-and-selected-header-controls' : 'English-fallback', workspace_translation_certified: false };
  });
}
