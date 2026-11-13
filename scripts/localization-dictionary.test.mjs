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
    assert.deepEqual(screenCoverage(lang).map((c) => c.translated === c.total), [true, true], lang);
    assert.equal(DICTIONARY_REVIEW[lang], 'machine-draft-unreviewed');
    for (const key of screenKeys) assert.notEqual(MESSAGES[lang][key], MESSAGES.en[key], `${lang} ${key} left in English`);
  }
  assert.equal(DICTIONARY_REVIEW.en, 'source');
  assert.deepEqual(screenCoverage('fr').map((c) => c.translated), [0, 0]);
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
