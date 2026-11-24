// W-04 (T-150) generation service: no invented facts, one retry for an unusable answer, usage metered and capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { createGenerator, planPages, cleanText, CopySchema } from '../src/website/generate.js';

const A = 'org-a';
function setup({ answers = [], limits } = {}) {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE seo_sites (id TEXT PRIMARY KEY, owner_key TEXT, slug TEXT UNIQUE, name TEXT, brand_json TEXT, created_at TEXT, updated_at TEXT); CREATE TABLE seo_site_pages (id TEXT PRIMARY KEY, site_id TEXT, owner_key TEXT, slug TEXT, title TEXT, template TEXT, content TEXT, version INTEGER, UNIQUE(site_id, slug));");
  db.prepare("INSERT INTO seo_sites (id,owner_key,slug,name,brand_json,created_at) VALUES ('s1',?,'harbour','Harbour','{}',?)").run(A, new Date().toISOString());
  const out = (id) => { const r = db.prepare('SELECT * FROM seo_site_pages WHERE id=?').get(id); return r && { id: r.id, site_id: r.site_id, slug: r.slug, title: r.title, template: r.template, draft: JSON.parse(r.content) }; };
  const seo = {
    createPage: (o, siteId, { title, slug, template, content }) => { const id = crypto.randomUUID(); db.prepare('INSERT INTO seo_site_pages VALUES (?,?,?,?,?,?,?,1)').run(id, siteId, o, slug, title, template, JSON.stringify(content)); return { ok: true, page: out(id) }; },
    saveVersion: (o, id, content) => { db.prepare('UPDATE seo_site_pages SET content=?, version=version+1 WHERE id=? AND owner_key=?').run(JSON.stringify(content), id, o); return { ok: true, page: out(id) }; },
    pageOut: (o, id) => { const p = out(id); return p && db.prepare('SELECT owner_key FROM seo_site_pages WHERE id=?').get(id).owner_key === o ? p : null; }
  };
  const calls = [];
  const ai = async (req) => { calls.push(req); const a = answers.length ? answers.shift() : answers.fallback; return { text: typeof a === 'function' ? a(req) : a }; };
  answers.fallback = answers.fallback ?? '{}';
  const gen = createGenerator({ db, seo, ai, log: { warn() {}, error() {} }, limits });
  return { db, gen, calls, seo };
}
const allText = (db) => db.prepare('SELECT content FROM seo_site_pages').all().map((r) => r.content).join('\n');
const THIN = { business_name: 'Harbour Plumbing', services: ['Blocked drains'], areas: ['Fremantle'] };
const INVENTED = JSON.stringify({ hero_heading: 'Best plumbers in Perth', hero_text: 'Since 1998 we have helped 500+ happy customers. Rated 5 stars. Blocked drains cleared in Fremantle.', intro: 'We guarantee the job is done right, always. Friendly local service for homes in Fremantle.', sections: [{ heading: 'Our promise', text: 'Over 20 years of experience and 1,000 jobs completed.' }], faq: [{ q: 'How much?', a: 'Only $99 call-out.' }], meta_description: 'Award-winning plumbing since 1998.' });

test('no invented facts with empty inputs: unbacked claims are removed and listed, no FAQ without facts', async () => {
  const s = setup({ answers: Object.assign([], { fallback: INVENTED }) });
  const r = await s.gen.generateSite(A, 'u1', { siteId: 's1', facts: THIN, choice: { pages: ['home', 'services', 'about', 'faq', 'contact'], service_pages: true } });
  assert.ok(r.ok, r.error);
  const text = allText(s.db);
  for (const bad of ['1998', '500+', '5 stars', 'Best plumbers', 'guarantee', '20 years', '1,000', '$99', 'Award-winning']) assert.ok(!text.includes(bad), `"${bad}" must not reach a page`);
  assert.ok(text.includes('Blocked drains cleared in Fremantle.'), 'plain factual sentences are kept');
  assert.ok(r.pages.some((p) => p.removed_claims.length), 'removed claims are listed for Review');
  assert.ok(!r.pages.some((p) => p.slug === 'faq'), 'no Questions page without facts that answer questions');
  assert.match(r.notes.join(' '), /No Questions page/);
  assert.ok(!/"type":"faq"/.test(text), 'no FAQ block anywhere');
  assert.ok(r.pages.some((p) => p.slug === 'blocked-drains'), 'one page per service when chosen');
  const home = JSON.parse(s.db.prepare("SELECT content FROM seo_site_pages WHERE slug='home'").get().content);
  assert.equal(home.blocks[0].type, 'hero'); assert.ok(home.blocks[0].heading, 'a plain heading fills the removed one');
});

test('the AI gets facts as data with the fixed rules, and FAQ is written only from facts', async () => {
  const s = setup({ answers: Object.assign([], { fallback: JSON.stringify({ faq: [{ q: 'When are you open?', a: 'Monday to Friday, 7am to 5pm.' }, { q: 'Do you offer discounts?', a: 'Yes, 20% off for seniors.' }] }) }) });
  const f = { ...THIN, hours: 'Monday to Friday, 7am to 5pm', phone: '08 9000 0000' };
  const r = await s.gen.generateSite(A, 'u1', { siteId: 's1', facts: f, choice: { pages: ['home', 'faq'] } });
  assert.ok(r.ok); assert.ok(r.pages.some((p) => p.slug === 'faq'));
  assert.match(s.calls[0].system, /Use ONLY the facts provided/); assert.match(s.calls[0].system, /never invent prices/);
  const user = JSON.parse(s.calls[0].messages[0].content); assert.equal(user.business.name, 'Harbour Plumbing'); assert.equal(user.faq_facts[0].a_owner, f.hours);
  assert.match(allText(s.db), /Monday to Friday, 7am to 5pm/);
  assert.ok(!/discount|20%/i.test(allText(s.db)), 'a question the owner did not answer is never added');
});

test('an answer that is not valid JSON is asked for once more; two bad answers leave plain wording', async () => {
  const good = JSON.stringify({ hero_text: 'Blocked drains cleared across Fremantle.' });
  const s = setup({ answers: ['Sure! Here is your copy.', good, 'not json', '{"sections": "wrong type"}'] });
  const r = await s.gen.generateSite(A, 'u1', { siteId: 's1', facts: THIN, choice: { pages: ['home', 'contact'] } });
  assert.equal(s.calls.length, 4, 'two calls per page at most');
  assert.deepEqual(r.pages.map((p) => [p.slug, p.wording, p.attempts]), [['home', 'ai', 2], ['contact', 'plain', 2]]);
  assert.ok(r.pages[1].error); assert.match(allText(s.db), /Blocked drains cleared across Fremantle/);
  assert.equal(CopySchema.safeParse({ sections: 'x' }).success, false);
});

test('usage is counted and capped per month; section rewrites are metered separately', async () => {
  const s = setup({ limits: { site: 1, section: 1 }, answers: Object.assign([], { fallback: JSON.stringify({ hero_heading: 'Blocked drains in Fremantle', hero_text: 'Fast help for homes in Fremantle.' }) }) });
  const r = await s.gen.generateSite(A, 'u1', { siteId: 's1', facts: THIN, choice: { pages: ['home'] } });
  assert.ok(r.ok);
  const n = (kind) => s.db.prepare('SELECT COUNT(*) n FROM usage_events WHERE organisation_id=? AND kind=?').get(A, kind).n;
  assert.equal(n('website_generation'), 1);
  assert.equal(s.db.prepare("SELECT status FROM website_generation_runs WHERE kind='site'").get().status, 'done');
  assert.equal(s.db.prepare('SELECT build_status FROM seo_sites WHERE id=?').get('s1').build_status, 'review');
  const again = await s.gen.generateSite(A, 'u1', { siteId: 's1', facts: THIN, choice: { pages: ['home'] } });
  assert.equal(again.status, 429); assert.equal(n('website_generation'), 1, 'a refused run is not counted');
  const page = r.pages[0].page_id;
  const sec = await s.gen.regenerateSection(A, 'u1', { pageId: page, index: 0, facts: THIN });
  assert.ok(sec.ok, sec.error); assert.equal(n('website_generation_section'), 1);
  assert.equal((await s.gen.regenerateSection(A, 'u1', { pageId: page, index: 0, facts: THIN })).status, 429);
  assert.equal((await s.gen.regenerateSection('org-b', 'u2', { pageId: page, index: 0, facts: THIN })).status, 404, 'another business cannot touch the page');
  assert.deepEqual(s.gen.allowance(A).website_generation, { used: 1, limit: 1 });
});

test('page plan: area pages need a unique fact; claim cleaning keeps figures the owner gave', () => {
  const { pages, notes } = planPages({ ...THIN, services: ['Blocked drains', 'Hot water'] }, { pages: ['home', 'areas', 'contact'], service_pages: true, areas: [{ name: 'Fremantle', fact: 'Our workshop is on South Terrace.' }, { name: 'Cockburn', fact: '' }] });
  assert.deepEqual(pages.map((p) => p.slug), ['home', 'blocked-drains', 'hot-water', 'areas', 'area-fremantle', 'contact']);
  assert.match(notes[0], /No page for Cockburn/);
  assert.equal(cleanText('Open 7 days a week.', { hours: '7 days, 7am to 7pm' }).removed.length, 0);
  assert.equal(cleanText('Over 15 years in business.', {}).removed.length, 1);
});
