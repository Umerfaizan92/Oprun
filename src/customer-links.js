// Customer links (T-144): a quote the customer can accept or decline online, and a review/feedback request.
//
// Rules:
//  - A person in the business presses "Send" after seeing the exact text; the message then goes out by text and/or
//    email through the business's own inbox (Unibox) and sender. Texts need the business's own SMS sender.
//  - A link is a random token (only its SHA-256 hash is stored), works once, expires, and is tied to the quote
//    revision that was approved. Editing the quote or sending it again retires the old link.
//  - Accepting records who, when and from where as acceptance evidence. When the quote carries a proposed time the
//    job is booked straight away and appears in the Job Allocator, waiting for the business to offer it to workers.
//  - Reviews are stored for the business. The public review site link (for example Google) is shown to every
//    customer whatever their rating: no review gating.
//  - Public pages need no login or script, show only that one record, and never reveal other customers' data.
import { formatMoney, taxRulesFor, currencyFor } from './country-rules.js';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const DAY = 86400000;
const iso = () => new Date().toISOString();
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// T-170: amounts, dates and the tax word follow the business's country and currency.
const moneyIn = (b) => (c) => formatMoney(c, b.currency || 'AUD', b.locale || 'en-AU');
const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

export function createCustomerLinks({ db, pipeline, outbound, notify = async () => {}, emit = () => {}, smsReady = () => false, publicBase = () => 'https://www.oprun.ai', log = console }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_links (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, organisation_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('quote','review')),
      document_id TEXT NOT NULL, work_order_id TEXT, customer_id TEXT, revision INTEGER, channels TEXT NOT NULL DEFAULT '', sent_by TEXT, sent_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      used_at TEXT, outcome TEXT, outcome_detail TEXT);
    CREATE INDEX IF NOT EXISTS customer_links_doc ON customer_links(organisation_id,document_id,sent_at);
    CREATE TABLE IF NOT EXISTS tenant_customer_reviews (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, customer_id TEXT, work_order_id TEXT, link_id TEXT NOT NULL UNIQUE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS tenant_customer_reviews_org ON tenant_customer_reviews(organisation_id,created_at);
    CREATE TABLE IF NOT EXISTS customer_link_settings (organisation_id TEXT PRIMARY KEY, review_url TEXT, updated_by TEXT, updated_at TEXT NOT NULL);`);

  const business = (org) => {
    const hasCountry = db.prepare('PRAGMA table_info(organisations)').all().some((c) => c.name === 'country');
    const b = db.prepare(`SELECT COALESCE(display_name,name) name, timezone, brand_primary_color color${hasCountry ? ', country' : ", 'AU' country"} FROM organisations WHERE id=?`).get(org) || { name: 'Our business', timezone: 'Australia/Perth', country: 'AU' };
    let cur = null; try { cur = db.prepare('SELECT currency FROM fin_settings WHERE organisation_id=?').get(org)?.currency || null; } catch { /* finance not installed */ }
    const t = taxRulesFor(b.country || 'AU');
    return { ...b, currency: cur || currencyFor(b.country || 'AU') || 'AUD', locale: t.locale, tax_label: t.label };
  };
  const settings = (org) => db.prepare('SELECT review_url FROM customer_link_settings WHERE organisation_id=?').get(org) || { review_url: null };
  const doc = (org, id, kind) => db.prepare('SELECT * FROM tenant_documents WHERE id=? AND organisation_id=? AND kind=?').get(id, org, kind);
  const customer = (org, id) => (id ? db.prepare('SELECT id,name,email,phone,address FROM tenant_customers WHERE id=? AND organisation_id=?').get(id, org) : null);
  const when = (at, tz, locale = 'en-AU') => { try { return new Date(at).toLocaleString(locale, { timeZone: tz || 'Australia/Perth', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch { return new Date(at).toUTCString(); } };
  const reference = (org, d) => pipeline.enquiryReference?.(org, d.id) || null;
  const url = (kind, token) => `${String(publicBase() || 'https://www.oprun.ai').replace(/\/$/, '')}/${kind === 'quote' ? 'q' : 'r'}/${token}`;
  const mobileOk = (p) => /^\+614\d{8}$/.test(String(p || '').replace(/[^\d+]/g, '').replace(/^04/, '+614'));
  const e164 = (p) => String(p || '').replace(/[^\d+]/g, '').replace(/^04/, '+614');

  // ---------- message text (also used for the preview the person sees before sending) ----------
  function quoteText(org, q, c, link, note = '') {
    const b = business(org), money = moneyIn(b), ref = reference(org, q), total = money(q.amount_cents + (q.gst_cents || 0));
    const time = q.start_at ? when(q.start_at, b.timezone, b.locale) : null;
    const hi = first(c?.name) ? `Hi ${first(c.name)}` : 'Hi';
    const lead = note ? `${note.trim()} ` : '';
    const sms = `${hi}, ${lead}your quote${ref ? ` ${ref}` : ''} from ${b.name} is ready: ${total}${q.gst_applies === 0 ? '' : ' incl. GST'}${time ? `, proposed for ${time}` : ''}. View and accept: ${link}`;
    const email = [`${hi},`, note ? note.trim() : '', `Here is your quote${ref ? ` ${ref}` : ''} from ${b.name}.`,
      [`Job: ${q.title}`, q.body ? `Details: ${q.body}` : '', `Price: ${money(q.amount_cents)}`, q.gst_applies === 0 ? `${b.tax_label}: not applicable` : `${b.tax_label}: ${money(q.gst_cents)}`, `Total: ${total}`,
        time ? `Proposed time: ${time}` : '', q.estimated_hours ? `Time required: about ${q.estimated_hours} hour${q.estimated_hours === 1 ? '' : 's'}` : ''].filter(Boolean).join('\n'),
      `View, accept or decline your quote here: ${link}`, time ? 'If the time does not suit, reply to this email and we will find another one.' : 'Once you accept, we will confirm a time with you.', `Kind regards,\n${b.name}`].filter(Boolean).join('\n\n');
    return { sms: sms.slice(0, 600), email, subject: `Your quote${ref ? ` ${ref}` : ''} from ${b.name}` };
  }
  function reviewText(org, j, c, link, note = '') {
    const b = business(org), hi = first(c?.name) ? `Hi ${first(c.name)}` : 'Hi';
    const sms = `${hi}, thanks for choosing ${b.name}. ${note ? note.trim() + ' ' : ''}How did we go? Please rate us (it takes a minute): ${link}`;
    const email = [`${hi},`, `Thank you for choosing ${b.name} for "${j.title}".`, note ? note.trim() : '', 'We would love to know how we went. It takes about a minute:', link, `Kind regards,\n${b.name}`].filter(Boolean).join('\n\n');
    return { sms: sms.slice(0, 600), email, subject: `How did we go? ${b.name}` };
  }

  /** Checks the channels against the customer's details and the business's senders. Returns an error text or null. */
  function channelProblem(org, c, channels) {
    if (!channels.length) return 'Choose text message, email or both.';
    if (channels.includes('sms')) {
      if (!mobileOk(c?.phone)) return 'This customer has no Australian mobile number, so a text cannot be sent. Add it to the customer, or send by email.';
      if (!smsReady(org)) return 'Connect your business SMS sender first (Connections, Email & SMS), or send by email.';
    }
    if (channels.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c?.email || ''))) return 'This customer has no email address. Add it to the customer, or send by text.';
    return null;
  }

  function issue(org, { kind, documentId, workOrderId = null, customerId, revision = null, channels, by, days }) {
    const token = crypto.randomBytes(24).toString('base64url'), id = crypto.randomUUID(), now = iso();
    db.prepare("UPDATE customer_links SET outcome='superseded',used_at=? WHERE organisation_id=? AND document_id=? AND kind=? AND used_at IS NULL").run(now, org, documentId, kind);
    db.prepare('INSERT INTO customer_links (id,token_hash,organisation_id,kind,document_id,work_order_id,customer_id,revision,channels,sent_by,sent_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, hash(token), org, kind, documentId, workOrderId, customerId, revision, channels.join(','), by, now, new Date(Date.now() + days * DAY).toISOString());
    return { id, token, link: url(kind, token) };
  }

  function deliver(org, c, channels, texts, { by, enquiryId = null }) {
    const queued = [];
    for (const ch of channels) {
      const m = outbound.queue(org, { channel: ch, address: ch === 'sms' ? e164(c.phone) : String(c.email).toLowerCase(), name: c.name, subject: texts.subject, text: ch === 'sms' ? texts.sms : texts.email, status: 'approved', customerId: c.id, enquiryId, by });
      queued.push({ channel: ch, message_id: m.id });
    }
    return queued;
  }

  // ---------- 1. send a quote ----------
  const sendQuoteSchema = z.object({ revision: z.number().int().positive(), channels: z.array(z.enum(['sms', 'email'])).max(2), start_at: z.iso.datetime({ offset: true }).nullable().optional(), estimated_hours: z.number().positive().max(1000).nullable().optional(), note: z.string().trim().max(300).optional(), dry_run: z.boolean().optional() }).strict();
  function sendQuote(org, by, quoteId, input) {
    const p = sendQuoteSchema.safeParse(input);
    if (!p.success) return { ok: false, status: 400, error: 'Choose how to send it, and check the time and hours.' };
    const d = p.data, q = doc(org, quoteId, 'quote');
    if (!q) return { ok: false, status: 404, error: 'Quote not found.' };
    if (q.status !== 'approved') return { ok: false, status: 409, error: 'Approve the quote before sending it to the customer.' };
    if (q.revision !== d.revision) return { ok: false, status: 409, error: 'The quote changed. Reload it and check before sending.' };
    const channels = [...new Set(d.channels)];
    const c = customer(org, q.customer_id);
    const problem = channelProblem(org, c, channels);
    if (problem) return { ok: false, status: 409, error: problem };
    if (d.start_at && Date.parse(d.start_at) < Date.now()) return { ok: false, status: 400, error: 'The proposed time is in the past.' };
    const view = { ...q, start_at: d.start_at === undefined ? q.start_at : d.start_at ? new Date(d.start_at).toISOString() : null, estimated_hours: d.estimated_hours === undefined ? q.estimated_hours : d.estimated_hours };
    if (d.dry_run) return { ok: true, preview: quoteText(org, view, c, url('quote', 'xxxxxxxx'), d.note) };
    const r = db.transaction(() => {
      db.prepare('UPDATE tenant_documents SET start_at=?,estimated_hours=?,updated_at=? WHERE id=? AND organisation_id=?').run(view.start_at, view.estimated_hours ?? null, iso(), q.id, org);
      const l = issue(org, { kind: 'quote', documentId: q.id, customerId: c.id, revision: q.revision, channels, by, days: 30 });
      const texts = quoteText(org, view, c, l.link, d.note);
      return { link: l, queued: deliver(org, c, channels, texts, { by, enquiryId: q.source_id || null }) };
    })();
    return { ok: true, link_id: r.link.id, url: r.link.link, queued: r.queued };
  }

  // ---------- 2. ask for a review ----------
  const reviewSchema = z.object({ channels: z.array(z.enum(['sms', 'email'])).max(2), note: z.string().trim().max(300).optional(), dry_run: z.boolean().optional() }).strict();
  function requestReview(org, by, jobId, input) {
    const p = reviewSchema.safeParse(input);
    if (!p.success) return { ok: false, status: 400, error: 'Choose how to send it.' };
    const j = db.prepare('SELECT * FROM work_orders WHERE id=? AND organisation_id=?').get(jobId, org);
    if (!j) return { ok: false, status: 404, error: 'Job not found.' };
    if (!j.completed_at) return { ok: false, status: 409, error: 'Mark the job complete before asking for a review.' };
    if (db.prepare('SELECT 1 FROM tenant_customer_reviews WHERE organisation_id=? AND work_order_id=?').get(org, j.id)) return { ok: false, status: 409, error: 'This customer has already left a review for this job.' };
    const channels = [...new Set(p.data.channels)];
    const c = customer(org, j.customer_id);
    if (!c) return { ok: false, status: 409, error: 'This job has no customer linked.' };
    const problem = channelProblem(org, c, channels);
    if (problem) return { ok: false, status: 409, error: problem };
    if (p.data.dry_run) return { ok: true, preview: reviewText(org, j, c, url('review', 'xxxxxxxx'), p.data.note) };
    const booking = db.prepare("SELECT id FROM tenant_documents WHERE organisation_id=? AND kind='booking' AND work_order_id=?").get(org, j.id);
    const r = db.transaction(() => {
      const l = issue(org, { kind: 'review', documentId: booking?.id || j.id, workOrderId: j.id, customerId: c.id, channels, by, days: 60 });
      return { link: l, queued: deliver(org, c, channels, reviewText(org, j, c, l.link, p.data.note), { by }) };
    })();
    return { ok: true, link_id: r.link.id, url: r.link.link, queued: r.queued };
  }

  // ---------- public side ----------
  /** The live link for a token, or a reason it cannot be used. */
  function lookup(token, kind) {
    if (!TOKEN.test(String(token || ''))) return { error: 'This link is not valid.' };
    const l = db.prepare('SELECT * FROM customer_links WHERE token_hash=? AND kind=?').get(hash(token), kind);
    if (!l) return { error: 'This link is not valid.' };
    return { link: l };
  }
  const closedReason = (l) => (l.outcome === 'superseded' ? 'A newer version was sent to you. Please use the most recent message.' : l.outcome ? null : Date.parse(l.expires_at) < Date.now() ? 'This link has expired. Please contact the business for a new one.' : null);

  function acceptQuote(token, { name, agree, ip, agent }) {
    const { link: l, error } = lookup(token, 'quote');
    if (error) return { ok: false, error };
    const why = closedReason(l); if (why) return { ok: false, error: why, link: l };
    if (l.outcome) return { ok: false, error: l.outcome === 'accepted' ? 'You have already accepted this quote. Thank you.' : 'You have already answered this quote.', link: l };
    const who = String(name || '').replace(/\s+/g, ' ').trim();
    if (who.length < 2 || who.length > 120) return { ok: false, error: 'Type your full name to accept.', retry: true, link: l };
    if (!agree) return { ok: false, error: 'Tick the box to confirm you accept the quote.', retry: true, link: l };
    const org = l.organisation_id, now = iso();
    const result = db.transaction(() => {
      const q = doc(org, l.document_id, 'quote');
      if (!q || q.status !== 'approved' || q.revision !== l.revision) return { ok: false, error: 'This quote has changed or is no longer available. Please contact the business.' };
      const evidence = `Accepted online by "${who}" on ${now} using the quote link sent ${l.sent_at} by ${l.channels.replace(',', ' and ')} (link ${l.id}, IP ${String(ip || '').slice(0, 64)}, browser ${String(agent || '').slice(0, 160)}).`;
      const moved = db.prepare("UPDATE tenant_documents SET status='accepted',acceptance_evidence=?,updated_at=? WHERE id=? AND organisation_id=? AND status='approved' AND revision=?").run(evidence, now, q.id, org, q.revision).changes;
      if (moved !== 1) return { ok: false, error: 'This quote has changed or is no longer available. Please contact the business.' };
      db.prepare("UPDATE customer_links SET used_at=?,outcome='accepted',outcome_detail=? WHERE id=? AND used_at IS NULL").run(now, who, l.id);
      return { ok: true, quote: { ...q, status: 'accepted' } };
    })();
    if (!result.ok) return { ...result, link: l };
    const q = result.quote, b = business(org), ref = reference(org, q), c = customer(org, q.customer_id);
    emit(org, 'quote.accepted', { quote_id: q.id }, { key: q.id });
    let booked = null;
    if (q.start_at && Date.parse(q.start_at) > Date.now()) {
      try { booked = pipeline.bookQuote(org, 'customer_link', q, { start_at: q.start_at, address: c?.address || undefined, estimated_hours: q.estimated_hours || undefined }); }
      catch (e) { log.warn('[customer-links] automatic booking failed:', String(e.message || e).slice(0, 160)); }
    }
    void notify(org, { kind: 'quote_accepted', title: `Quote ${ref || ''} accepted by ${who}`.replace(/\s+/g, ' ').slice(0, 180), body: booked ? `Booked for ${when(q.start_at, b.timezone)}. Offer it to workers in the Job Allocator.` : 'Choose a date and time to book the job.', link: booked ? '#work/bookings' : '#work/quotes', urgent: true, dedupe: `quote-accepted:${q.id}:${q.revision}` }).catch(() => {});
    return { ok: true, booked: Boolean(booked), start_at: booked ? q.start_at : null, business: b, reference: ref };
  }

  function declineQuote(token, { reason }) {
    const { link: l, error } = lookup(token, 'quote');
    if (error) return { ok: false, error };
    const why = closedReason(l); if (why) return { ok: false, error: why, link: l };
    if (l.outcome) return { ok: false, error: 'You have already answered this quote.', link: l };
    const org = l.organisation_id, now = iso(), text = String(reason || '').trim().slice(0, 1000);
    const ok = db.transaction(() => {
      const q = doc(org, l.document_id, 'quote');
      if (!q || q.status !== 'approved' || q.revision !== l.revision) return false;
      db.prepare("UPDATE tenant_documents SET status='declined',acceptance_evidence=?,updated_at=? WHERE id=? AND organisation_id=? AND status='approved'").run(`Declined online on ${now}${text ? `: ${text}` : ''} (link ${l.id}).`, now, q.id, org);
      db.prepare("UPDATE customer_links SET used_at=?,outcome='declined',outcome_detail=? WHERE id=? AND used_at IS NULL").run(now, text || null, l.id);
      return true;
    })();
    if (!ok) return { ok: false, error: 'This quote has changed or is no longer available. Please contact the business.', link: l };
    const q = doc(org, l.document_id, 'quote');
    void notify(org, { kind: 'quote_declined', title: `Quote ${reference(org, q) || ''} declined`.replace(/\s+/g, ' '), body: text || 'No reason given.', link: '#work/quotes', urgent: false, dedupe: `quote-declined:${q.id}:${q.revision}` }).catch(() => {});
    return { ok: true, business: business(org) };
  }

  function submitReview(token, { rating, comment }) {
    const { link: l, error } = lookup(token, 'review');
    if (error) return { ok: false, error };
    const why = closedReason(l); if (why) return { ok: false, error: why, link: l };
    if (l.outcome) return { ok: false, error: 'You have already left your review. Thank you!', link: l, done: true };
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: 'Choose a rating from 1 to 5 stars.', retry: true, link: l };
    const org = l.organisation_id, now = iso(), text = String(comment || '').trim().slice(0, 2000);
    const saved = db.transaction(() => {
      if (db.prepare("UPDATE customer_links SET used_at=?,outcome='reviewed',outcome_detail=? WHERE id=? AND used_at IS NULL").run(now, String(n), l.id).changes !== 1) return false;
      db.prepare('INSERT INTO tenant_customer_reviews (id,organisation_id,customer_id,work_order_id,link_id,rating,comment,created_at) VALUES (?,?,?,?,?,?,?,?)').run(crypto.randomUUID(), org, l.customer_id, l.work_order_id, l.id, n, text || null, now);
      return true;
    })();
    if (!saved) return { ok: false, error: 'You have already left your review. Thank you!', link: l, done: true };
    const c = customer(org, l.customer_id);
    void notify(org, { kind: 'customer_review', title: `${n} star${n === 1 ? '' : 's'} from ${c?.name || 'a customer'}`, body: text || 'No comment.', link: '#work/bookings', urgent: n <= 2, dedupe: `review:${l.id}` }).catch(() => {});
    return { ok: true, rating: n, business: business(org), review_url: settings(org).review_url };
  }

  // ---------- public pages (no script; inline styles only) ----------
  function page(title, b, inner) {
    const color = /^#[0-9a-f]{6}$/i.test(b?.color || '') ? b.color : '#1f3a5f';
    return `<!doctype html><html lang="${esc(b?.locale || 'en-AU')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1f24;background:#f4f6f8}main{max-width:620px;margin:0 auto;padding:20px 16px 40px}header{border-top:6px solid ${color};background:#fff;padding:16px 18px;border-radius:10px 10px 0 0}h1{font-size:1.35rem;margin:0}.card{background:#fff;padding:18px;border-radius:0 0 10px 10px;box-shadow:0 1px 3px #0001}dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:12px 0}dt{color:#5b6573}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}.total{font-weight:700;font-size:1.1rem}label{display:block;margin:12px 0 4px;font-weight:600}input[type=text],textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #b9c1cc;border-radius:8px;font:inherit}button,.btn{display:inline-block;margin-top:14px;padding:12px 18px;border:0;border-radius:8px;background:${color};color:#fff;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}.ghost{background:#e7ebf0;color:#1b1f24}.note{color:#5b6573;font-size:.92rem}.err{background:#fdecea;color:#8a1c12;padding:10px;border-radius:8px}.ok{background:#e8f5ec;color:#14532d;padding:10px;border-radius:8px}.stars{display:flex;flex-direction:row-reverse;justify-content:flex-end;gap:6px}.stars input{position:absolute;opacity:0}.stars label{font-size:2.2rem;margin:0;color:#c3c9d1;cursor:pointer;font-weight:400}.stars input:checked~label,.stars label:hover,.stars label:hover~label{color:#e0a100}.stars input:focus-visible+label{outline:2px solid ${color}}details{margin-top:18px}</style></head>
<body><main><header><h1>${esc(b?.name || 'Your business')}</h1></header><div class="card">${inner}</div><p class="note">Sent through Oprun on behalf of ${esc(b?.name || 'the business')}.</p></main></body></html>`;
  }
  function quotePage(token, message = null) {
    const { link: l, error } = lookup(token, 'quote');
    if (error) return { status: 404, html: page('Quote', null, `<p class="err">${esc(error)}</p>`) };
    const org = l.organisation_id, b = business(org), q = doc(org, l.document_id, 'quote');
    if (!q) return { status: 404, html: page('Quote', b, '<p class="err">This quote is no longer available. Please contact the business.</p>') };
    const ref = reference(org, q), c = customer(org, q.customer_id), money = moneyIn(b);
    const facts = `<dl><dt>Quote for</dt><dd>${esc(c?.name || '')}</dd>${ref ? `<dt>Reference</dt><dd>${esc(ref)}</dd>` : ''}<dt>Job</dt><dd>${esc(q.title)}</dd>${q.body ? `<dt>Details</dt><dd>${esc(q.body)}</dd>` : ''}<dt>Price</dt><dd>${money(q.amount_cents)}</dd><dt>${esc(b.tax_label)}</dt><dd>${q.gst_applies === 0 ? 'Not applicable' : money(q.gst_cents)}</dd><dt>Total</dt><dd class="total">${money(q.amount_cents + (q.gst_cents || 0))}</dd>${q.start_at ? `<dt>Proposed time</dt><dd>${esc(when(q.start_at, b.timezone, b.locale))}</dd>` : ''}${q.estimated_hours ? `<dt>Time required</dt><dd>About ${esc(q.estimated_hours)} hour${q.estimated_hours === 1 ? '' : 's'}</dd>` : ''}</dl>`;
    const why = closedReason(l);
    if (why) return { status: 410, html: page('Quote', b, `<p class="err">${esc(why)}</p>`) };
    if (l.outcome === 'accepted') return { status: 200, html: page('Quote accepted', b, `<p class="ok">You accepted this quote. Thank you!</p>${facts}`) };
    if (l.outcome) return { status: 200, html: page('Quote', b, `<p class="ok">Thank you, your answer was sent to ${esc(b.name)}.</p>`) };
    if (q.status !== 'approved' || q.revision !== l.revision) return { status: 410, html: page('Quote', b, '<p class="err">This quote has changed or is no longer available. Please contact the business.</p>') };
    const form = `<form method="post" action="/q/${esc(token)}"><input type="hidden" name="action" value="accept"><label for="n">Your full name</label><input type="text" id="n" name="name" maxlength="120" autocomplete="name" required value="${esc(c?.name || '')}"><label><input type="checkbox" name="agree" value="1" required> I accept this quote${q.start_at ? ' and the proposed time' : ''}.</label><button type="submit">Accept quote</button></form>
<details><summary>Decline or ask for a change</summary><form method="post" action="/q/${esc(token)}"><input type="hidden" name="action" value="decline"><label for="r">Tell us why (optional)</label><textarea id="r" name="reason" rows="3" maxlength="1000"></textarea><button type="submit" class="ghost">Decline quote</button></form><p class="note">To change the time or the job, you can also reply to our message.</p></details>`;
    return { status: 200, html: page(`Quote ${ref || ''}`.trim(), b, `${message ? `<p class="err">${esc(message)}</p>` : ''}<p>Here is your quote. Please check it and accept below.</p>${facts}${form}` ) };
  }
  function reviewPage(token, message = null) {
    const { link: l, error } = lookup(token, 'review');
    if (error) return { status: 404, html: page('Review', null, `<p class="err">${esc(error)}</p>`) };
    const org = l.organisation_id, b = business(org), why = closedReason(l);
    if (why) return { status: 410, html: page('Review', b, `<p class="err">${esc(why)}</p>`) };
    if (l.outcome) return { status: 200, html: thanksPage(b, settings(org).review_url) };
    const stars = [5, 4, 3, 2, 1].map((n) => `<input type="radio" id="s${n}" name="rating" value="${n}" required><label for="s${n}" title="${n} star${n === 1 ? '' : 's'}" aria-label="${n} star${n === 1 ? '' : 's'}">&#9733;</label>`).join('');
    return { status: 200, html: page('How did we go?', b, `${message ? `<p class="err">${esc(message)}</p>` : ''}<p>Thank you for choosing ${esc(b.name)}. How did we go?</p><form method="post" action="/r/${esc(token)}"><fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:600">Your rating</legend><div class="stars">${stars}</div></fieldset><label for="c">Anything you would like to tell us? (optional)</label><textarea id="c" name="comment" rows="4" maxlength="2000"></textarea><button type="submit">Send feedback</button></form><p class="note">Your feedback goes to ${esc(b.name)}.</p>`) };
  }
  const thanksPage = (b, reviewUrl) => page('Thank you', b, `<p class="ok">Thank you for your feedback!</p>${/^https:\/\//.test(reviewUrl || '') ? `<p>It would help us a lot if you shared your review publicly too.</p><a class="btn" href="${esc(reviewUrl)}" rel="noopener noreferrer">Leave a public review</a>` : ''}`);

  function install(app, { requireSaasUser, staffAccess, saasAudit }) {
    const fail = (res, s, e) => res.status(s).json({ ok: false, error: e });
    const can = (f, a) => (req, res, next) => (staffAccess.can(req, f, a) ? next() : fail(res, 403, 'This action is not authorised for your account.'));
    const postLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
    const viewLimit = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
    const html = (res, r) => { res.set('X-Robots-Tag', 'noindex, nofollow'); res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); res.status(r.status).type('html').send(r.html); };

    app.get('/api/saas/customer-links/settings', requireSaasUser, can('customers', 'read'), (req, res) => res.json({ ok: true, review_url: settings(req.saas.organisation_id).review_url || '', sms_ready: Boolean(smsReady(req.saas.organisation_id)) }));
    app.put('/api/saas/customer-links/settings', requireSaasUser, can('settings', 'edit'), (req, res) => {
      const p = z.object({ review_url: z.string().trim().max(500).refine((v) => !v || /^https:\/\/[^\s<>"']+$/i.test(v), 'https') }).strict().safeParse(req.body);
      if (!p.success) return fail(res, 400, 'Use a link that starts with https://');
      db.prepare('INSERT INTO customer_link_settings(organisation_id,review_url,updated_by,updated_at) VALUES (?,?,?,?) ON CONFLICT(organisation_id) DO UPDATE SET review_url=excluded.review_url,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(req.saas.organisation_id, p.data.review_url || null, req.saas.user_id, iso());
      saasAudit(req, 'customer_links.settings_saved', 'organisation', req.saas.organisation_id, { review_url_set: Boolean(p.data.review_url) });
      res.json({ ok: true });
    });
    app.post('/api/saas/pipeline/quotes/:id/send', requireSaasUser, can('approvals', 'approve'), (req, res) => {
      const r = sendQuote(req.saas.organisation_id, req.saas.user_id, req.params.id, req.body || {});
      if (!r.ok) return fail(res, r.status, r.error);
      if (!r.preview) saasAudit(req, 'quote.sent_to_customer', 'quote', req.params.id, { channels: r.queued.map((x) => x.channel), link_id: r.link_id });
      res.json(r);
    });
    app.post('/api/saas/pipeline/jobs/:id/review-request', requireSaasUser, can('customers', 'edit'), (req, res) => {
      const r = requestReview(req.saas.organisation_id, req.saas.user_id, req.params.id, req.body || {});
      if (!r.ok) return fail(res, r.status, r.error);
      if (!r.preview) saasAudit(req, 'job.review_requested', 'work_order', req.params.id, { channels: r.queued.map((x) => x.channel), link_id: r.link_id });
      res.json(r);
    });
    app.get('/api/saas/customer-links/reviews', requireSaasUser, can('customers', 'read'), (req, res) => {
      const rows = db.prepare('SELECT r.rating,r.comment,r.created_at,c.name customer,w.title job FROM tenant_customer_reviews r LEFT JOIN tenant_customers c ON c.id=r.customer_id AND c.organisation_id=r.organisation_id LEFT JOIN work_orders w ON w.id=r.work_order_id AND w.organisation_id=r.organisation_id WHERE r.organisation_id=? ORDER BY r.created_at DESC LIMIT 200').all(req.saas.organisation_id);
      const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null;
      res.json({ ok: true, reviews: rows, average: avg, count: rows.length });
    });

    // Public pages.
    app.get('/q/:token', viewLimit, (req, res) => html(res, quotePage(req.params.token)));
    app.post('/q/:token', postLimit, (req, res) => {
      const b = req.body || {}, token = req.params.token;
      if (b.action === 'decline') {
        const r = declineQuote(token, { reason: b.reason });
        if (!r.ok) return html(res, quotePage(token, r.error));
        return html(res, { status: 200, html: page('Quote declined', r.business, `<p class="ok">Thank you. ${esc(r.business.name)} has been told you declined this quote.</p>`) });
      }
      const r = acceptQuote(token, { name: b.name, agree: b.agree === '1' || b.agree === 'on', ip: req.ip, agent: req.get('user-agent') });
      if (!r.ok) return html(res, quotePage(token, r.error));
      return html(res, { status: 200, html: page('Quote accepted', r.business, `<p class="ok">Thank you, your quote${r.reference ? ` ${esc(r.reference)}` : ''} is accepted.</p><p>${r.booked ? `You are booked for <b>${esc(when(r.start_at, r.business.timezone))}</b>. ${esc(r.business.name)} will confirm the details with you.` : `${esc(r.business.name)} will contact you to confirm a time.`}</p>`) });
    });
    app.get('/r/:token', viewLimit, (req, res) => html(res, reviewPage(req.params.token)));
    app.post('/r/:token', postLimit, (req, res) => {
      const r = submitReview(req.params.token, { rating: req.body?.rating, comment: req.body?.comment });
      if (!r.ok) return html(res, r.done ? reviewPage(req.params.token) : reviewPage(req.params.token, r.error));
      return html(res, { status: 200, html: thanksPage(r.business, r.review_url) });
    });
  }

  return { sendQuote, requestReview, acceptQuote, declineQuote, submitReview, quotePage, reviewPage, install, settings };
}
