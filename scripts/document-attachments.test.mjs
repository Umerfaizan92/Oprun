// T-042: attachments on enquiries, quotes and invoices.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

test('files on enquiries, quotes and invoices: real content checked, business-scoped, listed, served safely, removable (T-042)', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Harbour Plumbing Pty Ltd' });
  const other = await seedOwner(s, { business: 'Other Trades', email: 'other-files@other.example.test' });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  const now = new Date().toISOString(), enq = crypto.randomUUID(), inv = crypto.randomUUID();
  sql("INSERT INTO tenant_documents (id,organisation_id,kind,title,body,status,channel,created_by,created_at,updated_at) VALUES (?,?,'enquiry','Leaking roof','', 'open','phone','test',?,?)", enq, owner.org, now, now);
  sql("INSERT INTO tenant_documents (id,organisation_id,kind,title,body,amount_cents,status,created_by,created_at,updated_at) VALUES (?,?,'invoice','Roof repair','',10000,'draft','test',?,?)", inv, owner.org, now, now);
  const send = (method, url, who = owner, body) => fetch(s.base + url, { method, redirect: 'manual', headers: { origin: s.base, ...(who ? { cookie: who.cookie } : {}) }, body });
  const form = (files, label) => { const fd = new FormData(); if (label) fd.append('label', label); for (const [buf, type, name] of files) fd.append('files', new Blob([buf], { type }), name); return fd; };
  const json = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

  let r = await json(await send('GET', `/api/saas/documents/${enq}/attachments`));
  assert.equal(r.status, 200); assert.deepEqual(r.body.attachments, []); assert.ok(r.body.labels.signed_acceptance);
  // A script pretending to be a photo is refused by its real content.
  r = await json(await send('POST', `/api/saas/documents/${enq}/attachments`, owner, form([[Buffer.from('<script>alert(1)</script>'), 'image/png', 'photo.png']])));
  assert.equal(r.status, 400, JSON.stringify(r.body));
  // A Word file is not accepted at all.
  r = await json(await send('POST', `/api/saas/documents/${enq}/attachments`, owner, form([[Buffer.from('PK'), 'application/msword', 'notes.doc']])));
  assert.equal(r.status, 400);
  // A photo and a signed acceptance PDF.
  r = await json(await send('POST', `/api/saas/documents/${enq}/attachments`, owner, form([[PNG, 'image/png', 'roof.png']], 'photo')));
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.attachments.length, 1);
  r = await json(await send('POST', `/api/saas/documents/${inv}/attachments`, owner, form([[PDF, 'application/pdf', 'signed.pdf']], 'signed_acceptance')));
  assert.equal(r.status, 201, JSON.stringify(r.body)); const pdf = r.body.attachments[0];
  assert.equal(pdf.label, 'signed_acceptance'); assert.equal(pdf.mime_type, 'application/pdf');
  // Served with safe headers, same bytes.
  let f = await send('GET', `/api/saas/document-attachments/${pdf.id}/file`);
  assert.equal(f.status, 200); assert.equal(f.headers.get('x-content-type-options'), 'nosniff'); assert.match(f.headers.get('content-security-policy'), /sandbox/);
  assert.equal(Buffer.compare(Buffer.from(await f.arrayBuffer()), PDF), 0);
  // Signed out: refused. Another business: cannot list, add, read or remove.
  assert.equal((await send('GET', `/api/saas/document-attachments/${pdf.id}/file`, null)).status, 401);
  assert.equal((await send('GET', `/api/saas/documents/${inv}/attachments`, other)).status, 404);
  assert.equal((await send('POST', `/api/saas/documents/${inv}/attachments`, other, form([[PNG, 'image/png', 'x.png']]))).status, 404);
  assert.equal((await send('GET', `/api/saas/document-attachments/${pdf.id}/file`, other)).status, 404);
  assert.equal((await send('DELETE', `/api/saas/document-attachments/${pdf.id}`, other)).status, 404);
  assert.equal(sql('SELECT COUNT(*) n FROM document_attachments WHERE organisation_id=?', other.org)[0].n, 0);
  // Removing works for the owner.
  r = await json(await send('DELETE', `/api/saas/document-attachments/${pdf.id}`));
  assert.equal(r.status, 200); assert.equal(r.body.attachments.length, 0);
  assert.equal((await send('GET', `/api/saas/document-attachments/${pdf.id}/file`)).status, 404);
  // Every change is in the audit log.
  assert.ok(sql("SELECT COUNT(*) n FROM audit_logs WHERE organisation_id=? AND action LIKE 'document_attachment.%'", owner.org)[0].n >= 3);
});
