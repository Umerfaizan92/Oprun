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
  en: { language: 'Language', save: 'Save', close: 'Close', signOut: 'Sign out', notifications: 'Notifications', manual: 'User Manual', notice: 'Language preference saved. Untranslated screens use English. Voice and message languages depend on their provider.', error: 'Language preference could not be saved. Try again.', coverage: 'Language selection is available; full workspace translation is in progress.', 'today.kicker': "COMMAND CENTRE", 'today.openJobPool': "Open job pool", 'today.askAi': "Ask AI Operations", 'today.featuresKicker': "YOUR WORKSPACE", 'today.featuresTitle': "Everything your business runs on", 'today.priorities': "Priorities", 'today.briefKicker': "AI OPERATIONS BRIEF", 'today.briefTitle': "What needs your attention", 'today.openAi': "Open AI Operations", 'today.approvalNote': "AI actions remain approval-controlled.", 'today.guidanceKicker': "WORKFLOW GUIDANCE", 'today.guidanceTitle': "From enquiry to paid job", 'today.readinessKicker': "WORKSPACE READINESS", 'today.readinessTitle': "Setup checklist" },
  hi: { language: 'भाषा', save: 'सहेजें', close: 'बंद करें', signOut: 'साइन आउट', notifications: 'सूचनाएँ', manual: 'उपयोगकर्ता निर्देश', notice: 'भाषा सहेज दी गई है। बिना अनुवाद वाली स्क्रीन अंग्रेज़ी में दिखेंगी। आवाज़ और संदेश की भाषाएँ प्रदाता पर निर्भर हैं।', error: 'भाषा सहेजी नहीं जा सकी। फिर कोशिश करें।', coverage: 'भाषा चुन सकते हैं; पूरे कार्यक्षेत्र का अनुवाद अभी जारी है।', 'today.kicker': "कमांड सेंटर", 'today.openJobPool': "जॉब पूल खोलें", 'today.askAi': "AI ऑपरेशंस से पूछें", 'today.featuresKicker': "आपका वर्कस्पेस", 'today.featuresTitle': "आपके व्यवसाय की हर ज़रूरत", 'today.priorities': "प्राथमिकताएँ", 'today.briefKicker': "AI ऑपरेशंस सारांश", 'today.briefTitle': "किन बातों पर आपका ध्यान चाहिए", 'today.openAi': "AI ऑपरेशंस खोलें", 'today.approvalNote': "AI की हर कार्रवाई आपकी मंज़ूरी से ही होती है।", 'today.guidanceKicker': "कार्य-प्रवाह मार्गदर्शन", 'today.guidanceTitle': "पूछताछ से भुगतान तक", 'today.readinessKicker': "वर्कस्पेस की तैयारी", 'today.readinessTitle': "सेटअप चेकलिस्ट" },
  ur: { language: 'زبان', save: 'محفوظ کریں', close: 'بند کریں', signOut: 'سائن آؤٹ', notifications: 'اطلاعات', manual: 'صارف کی رہنمائی', notice: 'زبان محفوظ ہو گئی ہے۔ غیر ترجمہ شدہ صفحات انگریزی میں ہوں گے۔ آواز اور پیغامات کی زبان فراہم کنندہ پر منحصر ہے۔', error: 'زبان محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔', coverage: 'زبان منتخب کر سکتے ہیں؛ مکمل ترجمے پر کام جاری ہے۔', 'today.kicker': "کمانڈ سینٹر", 'today.openJobPool': "جاب پول کھولیں", 'today.askAi': "AI آپریشنز سے پوچھیں", 'today.featuresKicker': "آپ کا ورک اسپیس", 'today.featuresTitle': "آپ کے کاروبار کی ہر ضرورت", 'today.priorities': "ترجیحات", 'today.briefKicker': "AI آپریشنز خلاصہ", 'today.briefTitle': "کن باتوں پر آپ کی توجہ درکار ہے", 'today.openAi': "AI آپریشنز کھولیں", 'today.approvalNote': "AI کا ہر عمل آپ کی منظوری سے ہی ہوتا ہے۔", 'today.guidanceKicker': "ورک فلو رہنمائی", 'today.guidanceTitle': "استفسار سے ادائیگی تک", 'today.readinessKicker': "ورک اسپیس کی تیاری", 'today.readinessTitle': "سیٹ اپ چیک لسٹ" },
  ar: { language: 'اللغة', save: 'حفظ', close: 'إغلاق', signOut: 'تسجيل الخروج', notifications: 'الإشعارات', manual: 'دليل المستخدم', notice: 'تم حفظ اللغة. تظهر الشاشات غير المترجمة بالإنجليزية. تعتمد لغات الصوت والرسائل على المزوّد.', error: 'تعذّر حفظ اللغة. حاول مجدداً.', coverage: 'اختيار اللغة متاح؛ ترجمة مساحة العمل الكاملة قيد التنفيذ.', 'today.kicker': "مركز القيادة", 'today.openJobPool': "فتح مجموعة الأعمال", 'today.askAi': "اسأل عمليات الذكاء الاصطناعي", 'today.featuresKicker': "مساحة عملك", 'today.featuresTitle': "كل ما يحتاجه عملك", 'today.priorities': "الأولويات", 'today.briefKicker': "ملخص عمليات الذكاء الاصطناعي", 'today.briefTitle': "ما يحتاج إلى انتباهك", 'today.openAi': "فتح عمليات الذكاء الاصطناعي", 'today.approvalNote': "لا يُنفَّذ أي إجراء للذكاء الاصطناعي إلا بموافقتك.", 'today.guidanceKicker': "إرشادات سير العمل", 'today.guidanceTitle': "من الاستفسار إلى الدفع", 'today.readinessKicker': "جاهزية مساحة العمل", 'today.readinessTitle': "قائمة الإعداد" }
});
// Dictionary versions and review state. English is the source text shown in the HTML. Other languages are machine
// drafts until a native speaker reviews them: never describe them as certified translations.
export const DICTIONARY_VERSION = '2026-11-13.1';
export const DICTIONARY_REVIEW = Object.freeze({ en: 'source', hi: 'machine-draft-unreviewed', ur: 'machine-draft-unreviewed', ar: 'machine-draft-unreviewed' });
// Which keys belong to which screen, so coverage is reported per screen rather than as one misleading total.
export const SCREENS = Object.freeze({
  shell: ['language', 'save', 'close', 'signOut', 'notifications', 'manual', 'notice', 'coverage', 'error'],
  today: ["today.kicker", "today.openJobPool", "today.askAi", "today.featuresKicker", "today.featuresTitle", "today.priorities", "today.briefKicker", "today.briefTitle", "today.openAi", "today.approvalNote", "today.guidanceKicker", "today.guidanceTitle", "today.readinessKicker", "today.readinessTitle"]
});
export function screenCoverage(locale) {
  const dict = MESSAGES[baseLanguage(locale)] || {};
  return Object.entries(SCREENS).map(([screen, list]) => ({ screen, translated: list.filter(k => typeof dict[k] === 'string').length, total: list.length }));
}
// Placeholders {name} and plurals {count, plural, one {# item} other {# items}} (also =0 {...}), using Intl.PluralRules.
// Values are inserted as plain text; callers set textContent, never innerHTML.
export function formatMessage(locale, pattern, values = {}) {
  const lang = canonicalLocale(locale) || 'en';
  const rules = new Intl.PluralRules(lang), numbers = new Intl.NumberFormat(lang);
  let out = '', i = 0;
  while (i < pattern.length) {
    const open = pattern.indexOf('{', i);
    if (open < 0) { out += pattern.slice(i); break; }
    out += pattern.slice(i, open);
    let depth = 0, end = open;
    for (; end < pattern.length; end++) { if (pattern[end] === '{') depth++; else if (pattern[end] === '}' && --depth === 0) break; }
    const body = pattern.slice(open + 1, end), comma = body.indexOf(',');
    const name = (comma < 0 ? body : body.slice(0, comma)).trim();
    if (comma < 0) out += values[name] ?? '';
    else {
      const rest = body.slice(comma + 1), kind = rest.slice(0, rest.indexOf(',')).trim();
      const count = Number(values[name]), options = {};
      for (const m of rest.slice(rest.indexOf(',') + 1).matchAll(/(=\d+|zero|one|two|few|many|other)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) options[m[1]] = m[2];
      if (kind !== 'plural') out += values[name] ?? '';
      else out += formatMessage(lang, options['=' + count] ?? options[rules.select(count)] ?? options.other ?? '', values).replace(/#/g, numbers.format(count));
    }
    i = end + 1;
  }
  return out;
}
// Lookup uses the base language, so a regional or unlisted variant (ur-PK, hi-IN) still finds its language's text.
const baseLanguage = locale => { try { return new Intl.Locale(canonicalLocale(locale) || Intl.getCanonicalLocales(String(locale || ''))[0] || 'en').language; } catch { return 'en'; } };
export function message(locale, key) { return MESSAGES[baseLanguage(locale)]?.[key] ?? MESSAGES.en[key] ?? key; }
export function localeCatalogue(displayLocale = 'en') {
  const names = new Intl.DisplayNames([canonicalLocale(displayLocale) || 'en', 'en'], { type: 'language' });
  return SELECTABLE_LOCALES.map(code => {
    let nativeName = code;
    try { nativeName = new Intl.DisplayNames([code, 'en'], { type: 'language' }).of(code); } catch {}
    return { code, name: names.of(code), native_name: nativeName, direction: localeDirection(code), translation_status: 'partial', translated_scope: MESSAGES[code.split('-')[0]] ? screenCoverage(code).filter(c => c.translated === c.total).map(c => c.screen).join(', ') + ' (machine draft, unreviewed)' : 'English-fallback', workspace_translation_certified: false };
  });
}
