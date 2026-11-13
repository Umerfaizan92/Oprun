// Prompt 03 foundation: versioned dictionaries, per-screen coverage, plurals and placeholders, and the rule that the
// English dictionary is exactly the text already in the page (so English users see no change when it is applied).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { MESSAGES, SCREENS, DICTIONARY_REVIEW, DICTIONARY_VERSION, screenCoverage, formatMessage, message, localeCatalogue } from '../saas/locale-catalog.js';

const html = fs.readFileSync(new URL('../saas/workspace.html', import.meta.url), 'utf8');
const doc = new JSDOM(html).window.document;
const tagged = [...doc.querySelectorAll('[data-i18n]')];
const screenKeys = new Set(Object.values(SCREENS).flat());
// Labels made only of brand names stay the same in every language.
const BRAND_ONLY = new Set(['nav.page.seogoogle']);

test('every tagged element shows exactly the English dictionary text and has no child elements to lose', () => {
  assert.ok(tagged.length >= 19);
  for (const el of tagged) {
    const key = el.dataset.i18n;
    assert.ok(MESSAGES.en[key], `${key} missing from English dictionary`);
    assert.ok(screenKeys.has(key), `${key} is not assigned to a screen`);
    assert.equal(el.children.length, 0, `${key}: translated text would replace child elements`);
    assert.equal(el.textContent.trim(), MESSAGES.en[key], `${key}: English HTML and dictionary differ`);
  }
});

test('every Today key is tagged once in the page and every screen key exists in English', () => {
  for (const key of SCREENS.today) assert.equal(tagged.filter((el) => el.dataset.i18n === key).length, 1, key);
  for (const key of screenKeys) assert.equal(typeof MESSAGES.en[key], 'string', key);
});

test('pilot languages cover shell and Today, are marked unreviewed, and others fall back to English', () => {
  assert.match(DICTIONARY_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  for (const lang of ['hi', 'ur', 'ar']) {
    assert.ok(screenCoverage(lang).every((c) => c.translated === c.total), lang);
    assert.equal(DICTIONARY_REVIEW[lang], 'machine-draft-unreviewed');
    for (const key of screenKeys) if (!BRAND_ONLY.has(key) && /\p{L}/u.test(MESSAGES.en[key].replace(/\{[^{}]*\}/g, ''))) assert.notEqual(MESSAGES[lang][key], MESSAGES.en[key], `${lang} ${key} left in English`); // patterns made only of inserted values are language-neutral
  }
  assert.equal(DICTIONARY_REVIEW.en, 'source');
  assert.ok(screenCoverage('fr').every((c) => c.translated === 0));
  assert.equal(message('fr', 'today.briefTitle'), MESSAGES.en['today.briefTitle']);
  assert.equal(message('ur-PK', 'today.briefTitle'), MESSAGES.ur['today.briefTitle'], 'regional variants use the base language');
  const ur = localeCatalogue().find((x) => x.code === 'ur');
  assert.match(ur.translated_scope, /today/); assert.match(ur.translated_scope, /unreviewed/);
  assert.equal(localeCatalogue().find((x) => x.code === 'fr').translated_scope, 'English-fallback');
});

test('plurals and placeholders follow each language\'s rules and stay plain text', () => {
  const jobs = '{count, plural, =0 {No open jobs} one {# open job for {name}} other {# open jobs for {name}}}';
  assert.equal(formatMessage('en', jobs, { count: 0, name: 'Alex' }), 'No open jobs');
  assert.equal(formatMessage('en', jobs, { count: 1, name: 'Alex' }), '1 open job for Alex');
  assert.equal(formatMessage('en', jobs, { count: 1234, name: 'Alex' }), '1,234 open jobs for Alex');
  assert.equal(formatMessage('de', jobs, { count: 1234, name: 'Alex' }), '1.234 open jobs for Alex', 'numbers use the reader\'s format');
  const ar = '{n, plural, zero {z} one {o} two {t} few {f} many {m} other {x}}';
  assert.deepEqual([0, 1, 2, 3, 11, 100].map((n) => formatMessage('ar', ar, { n })), ['z', 'o', 't', 'f', 'm', 'x']);
  assert.equal(formatMessage('en', 'Hello {name}', { name: '<img src=x onerror=alert(1)>' }), 'Hello <img src=x onerror=alert(1)>', 'values are inserted as text for textContent, never parsed');
  assert.equal(formatMessage('en', 'Missing {gone}.', {}), 'Missing .');
});

test('live Today board patterns keep the exact English the board showed before and format in every pilot language', () => {
  const f = (l, k, v) => formatMessage(l, message(l, k), v);
  assert.equal(f('en', 'gx.inboxWeekFrom', { n: 1, channel: 'email' }), '1 message this week, most from email');
  assert.equal(f('en', 'gx.inboxWeek', { n: 3 }), '3 messages this week');
  assert.equal(f('en', 'gx.drafts', { n: 2 }), '2 AI reply drafts ready to review');
  assert.equal(f('en', 'gx.conversations', { n: 1 }), 'conversation');
  assert.equal(f('en', 'gx.jobsSub', { awaiting: 0, team: 'team', allocated: 0 }), '0 awaiting a team, 0 lined up');
  assert.equal(f('en', 'gx.liveAt', { time: '3:47 AM' }), 'Live · 3:47 AM');
  for (const lang of ['hi', 'ur', 'ar']) for (const key of SCREENS.todayLive) {
    const out = formatMessage(lang, MESSAGES[lang][key], { n: 2, channel: 'email', jobs: 'Jobs', team: 'Team', awaiting: 1, allocated: 2, total: 3, attention: 1, expiring: 0, revenue: 'Income', revenueAmount: '$1', costs: 'costs', costAmount: '$0', industry: 'plumbing', time: '9:00' });
    assert.doesNotMatch(out, /[{}]/, `${lang} ${key} left a placeholder unformatted`);
  }
});

test('English industry vocabulary in the dictionary matches the server table for every industry group', async () => {
  const { INDUSTRY_REGISTRY, industryTerms } = await import('../src/industry-registry.js');
  const groups = new Map([['general', industryTerms('custom')]]);
  for (const row of INDUSTRY_REGISTRY) { const t = industryTerms(row.code); groups.set(t.style, t); }
  assert.equal(groups.size, 8, 'all eight vocabulary groups found');
  for (const [style, t] of groups) {
    for (const k of ['job', 'jobs', 'customer', 'customers', 'team', 'revenue', 'costs', 'pitch'])
      assert.equal(MESSAGES.en[`term.${style}.${k}`], t[k], `term.${style}.${k} out of sync with src/industry-registry.js`);
    assert.equal(MESSAGES.en[`term.${style}.member`], t.team.toLowerCase().replace(/s$/, ''), `term.${style}.member`);
  }
});

test('English navigation names in the dictionary match the live menu exactly', () => {
  const dom = new JSDOM('<html><body></body></html>', { runScripts: 'outside-only', url: 'https://oprun.example.test' });
  dom.window.eval(fs.readFileSync(new URL('../saas/workspace-nav.js', import.meta.url), 'utf8'));
  const N = dom.window.SuperProNav;
  for (const d of N.DOMAINS) {
    assert.equal(MESSAGES.en[`nav.group.${d.id}`], d.label, `nav.group.${d.id}`);
    for (const i of d.items) assert.equal(MESSAGES.en[`nav.page.${i.view}`], i.label, `nav.page.${i.view}`);
  }
  const flows = SCREENS.navigation.filter((k) => k.startsWith('nav.flow.'));
  assert.deepEqual(flows.map((k) => MESSAGES.en[k]), Array.from(N.WORKFLOWS, (w) => w.label), 'related-page group names in menu order');
  assert.equal(SCREENS.navigation.length, N.DOMAINS.length + N.DOMAINS.flatMap((d) => d.items).length + flows.length + 1, 'every group and page has a key');
  dom.window.close();
});

test('keys tagged by scripts exist and their English is the exact text those scripts already show', () => {
  const files = ['workspace-pad.js', 'workspace-chat.js', 'app.js', 'workspace-mobile.js', 'support.js', 'workspace-voicebar.js'];
  let found = 0;
  for (const file of files) {
    const source = fs.readFileSync(new URL(`../saas/${file}`, import.meta.url), 'utf8');
    for (const m of source.matchAll(/data-i18n(?:-attr)?['"]?\s*[:=]\s*['"`]([^'"`]+)['"`]|i18n\s*=\s*'([\w.]+)'|((?:chrome|vb)\.\w+)/g)) {
      for (const part of String(m[1] || m[2] || m[3]).split(';')) {
        const key = part.includes('=') ? part.split('=')[1] : part;
        if (!/^[\w.]+$/.test(key) || key.includes('${')) continue;
        found++;
        assert.ok(MESSAGES.en[key], `${file}: ${key} missing from English dictionary`);
        assert.ok(screenKeys.has(key), `${file}: ${key} not assigned to a screen`);
        assert.ok(source.includes(MESSAGES.en[key]), `${file}: English for ${key} differs from the script's own text`);
      }
    }
  }
  assert.ok(found >= 12, `found ${found} tagged keys`);
});

test('language picker labels are short, unique and free of codes', () => {
  const list = localeCatalogue();
  assert.equal(new Set(list.map((x) => x.label)).size, list.length, 'no two languages share a label');
  for (const x of list) {
    assert.ok(x.label.length <= 45, `${x.code}: label too long (${x.label})`);
    assert.doesNotMatch(x.label, new RegExp(`\\(${x.code.replace('-', '\\-')}\\)|—`), `${x.code}: no codes or repeated names`);
    assert.equal(x.label[0], x.label[0].toLocaleUpperCase(x.code), `${x.code}: starts with a capital where the script has one`);
  }
  const by = (code) => list.find((x) => x.code === code).label;
  assert.equal(by('en-AU'), 'English (Australia)');
  assert.equal(by('es-MX'), 'Español (México)');
  assert.equal(by('ur'), 'اردو · Urdu');
});

test('every configured page tab name has a dictionary key derived from its English name', () => {
  const source = fs.readFileSync(new URL('../saas/focused-workspace.js', import.meta.url), 'utf8');
  const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  const labels = [...source.matchAll(/labels:\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  assert.ok(labels.length >= 28);
  for (const label of labels) assert.equal(MESSAGES.en[`tab.${slug(label)}`], label, `tab.${slug(label)}`);
});
