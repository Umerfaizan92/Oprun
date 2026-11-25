// T-042: attachments on enquiries, quotes, estimates and invoices (photos, plans, signed acceptance).
// Same safety as job evidence: the real file content is checked (not its name or browser type), a virus scan runs
// when one is configured, files go to private storage when it is switched on, and every read is checked against the
// business and the person's permission for that kind of record. The business never comes from the request body.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { inspectUpload } from './file-safety.js';

export const ATTACHMENT_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif', 'application/pdf': '.pdf' };
export const ATTACHMENT_LABELS = { photo: 'Photo', plan: 'Plan or drawing', signed_acceptance: 'Signed acceptance', other: 'Other' };
const FEATURE = { enquiry: 'customers', quote: 'customers', estimate: 'customers', invoice: 'finance', deposit: 'finance', credit_note: 'finance' };
const MAX_FILES = 10, MAX_PER_DOCUMENT = 30;

export function installDocumentAttachments(app, { db, requireSaasUser, staffAccess, saasAudit, objectStorage, uploadRoot, env = process.env }) {
  db.exec(`CREATE TABLE IF NOT EXISTS document_attachments (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, document_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT 'other',
    original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
    created_by_user_id TEXT, created_at TEXT NOT NULL,
    FOREIGN KEY(organisation_id) REFERENCES organisations(id) ON DELETE CASCADE, FOREIGN KEY(document_id) REFERENCES tenant_documents(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_document_attachments_doc ON document_attachments(organisation_id, document_id, created_at);`);

  const maxBytes = Number(env.DOCUMENT_ATTACHMENT_MAX_MB || 25) * 1024 * 1024;
  const dirFor = (org) => path.join(uploadRoot, 'document-files', String(org).replace(/[^a-zA-Z0-9-]/g, ''));
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) { const dir = dirFor(req.saas.organisation_id); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
      filename(req, file, cb) { cb(null, crypto.randomUUID() + (ATTACHMENT_TYPES[file.mimetype] || '')); }
    }),
    limits: { fileSize: maxBytes, files: MAX_FILES },
    fileFilter(req, file, cb) { ATTACHMENT_TYPES[file.mimetype] ? cb(null, true) : cb(new Error('Use a photo (JPG, PNG, WebP, HEIC) or a PDF.')); }
  });
  // The record must belong to the signed-in business, and the person needs the permission for that kind of record.
  const recordFor = (req, id, action) => {
    const d = db.prepare('SELECT id,kind,title,number,reference FROM tenant_documents WHERE id=? AND organisation_id=?').get(String(id || ''), req.saas.organisation_id);
    if (!d || !FEATURE[d.kind]) return { status: 404, error: 'Record not found.' };
    if (!staffAccess.can(req, FEATURE[d.kind], action)) return { status: 403, error: 'This business action is not authorised for your account.' };
    return { doc: d };
  };
  const list = (org, docId) => db.prepare('SELECT id,label,original_name,mime_type,size_bytes,created_at FROM document_attachments WHERE organisation_id=? AND document_id=? ORDER BY created_at').all(org, docId);

  app.get('/api/saas/documents/:id/attachments', requireSaasUser, (req, res) => {
    const r = recordFor(req, req.params.id, 'read'); if (!r.doc) return res.status(r.status).json({ ok: false, error: r.error });
    res.json({ ok: true, labels: ATTACHMENT_LABELS, attachments: list(req.saas.organisation_id, r.doc.id) });
  });

  app.post('/api/saas/documents/:id/attachments', requireSaasUser, (req, res) => {
    const r = recordFor(req, req.params.id, 'edit'); if (!r.doc) return res.status(r.status).json({ ok: false, error: r.error });
    upload.array('files', MAX_FILES)(req, res, async (err) => {
      const drop = () => { for (const f of req.files || []) fs.rmSync(f.path, { force: true }); };
      if (err) { drop(); return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : err.code === 'LIMIT_FILE_COUNT' ? `Add up to ${MAX_FILES} files at a time.` : err.message }); }
      if (!req.files?.length) return res.status(400).json({ ok: false, error: 'Choose at least one photo or PDF.' });
      const label = Object.hasOwn(ATTACHMENT_LABELS, String(req.body?.label || '')) ? String(req.body.label) : 'other';
      const org = req.saas.organisation_id;
      const have = db.prepare('SELECT COUNT(*) n FROM document_attachments WHERE organisation_id=? AND document_id=?').get(org, r.doc.id).n;
      if (have + req.files.length > MAX_PER_DOCUMENT) { drop(); return res.status(400).json({ ok: false, error: `A record can hold up to ${MAX_PER_DOCUMENT} files. Remove some first.` }); }
      if (objectStorage.config.mode === 's3' && !objectStorage.config.ready) { drop(); return res.status(503).json({ ok: false, error: 'File storage is being set up. Please try again later.' }); }
      try {
        for (const f of req.files) {
          const check = await inspectUpload(fs.readFileSync(f.path), { declaredType: f.mimetype, maxBytes, env, allowed: Object.keys(ATTACHMENT_TYPES) });
          if (!check.ok) { drop(); saasAudit(req, 'document_attachment.blocked', r.doc.kind, r.doc.id, { reason: check.reason, scan: check.scan?.status || null }); return res.status(400).json({ ok: false, error: check.message }); }
          f.scan = check.scan?.status || 'not_scanned';
        }
        if (objectStorage.config.ready) for (const f of req.files) {
          const stored = await objectStorage.put({ organisationId: org, category: 'document-files', body: fs.readFileSync(f.path), contentType: f.mimetype, actorId: req.saas.user_id, scan: { status: f.scan } });
          fs.rmSync(f.path, { force: true }); f.filename = 's3:' + stored.key;
        }
      } catch (e) { drop(); console.error('[storage] document attachment upload failed:', e.message); return res.status(502).json({ ok: false, error: 'The file could not be stored. Please try again.' }); }
      const now = new Date().toISOString(), ids = [];
      const ins = db.prepare('INSERT INTO document_attachments (id,organisation_id,document_id,label,original_name,stored_name,mime_type,size_bytes,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
      db.transaction(() => { for (const f of req.files) { const id = crypto.randomUUID(); ids.push(id); ins.run(id, org, r.doc.id, label, String(f.originalname || 'file').replace(/[\u0000-\u001f/\\]/g, '').slice(0, 200) || 'file', f.filename, f.mimetype, f.size, req.saas.user_id, now); } })();
      saasAudit(req, 'document_attachment.uploaded', r.doc.kind, r.doc.id, { count: ids.length, label });
      res.status(201).json({ ok: true, saved: ids.length, attachments: list(org, r.doc.id) });
    });
  });

  const attachmentFor = (req, action) => {
    const a = db.prepare('SELECT * FROM document_attachments WHERE id=? AND organisation_id=?').get(String(req.params.id || ''), req.saas.organisation_id);
    if (!a) return { status: 404, error: 'File not found.' };
    const r = recordFor(req, a.document_id, action); return r.doc ? { a, doc: r.doc } : r;
  };

  app.get('/api/saas/document-attachments/:id/file', requireSaasUser, (req, res) => {
    const r = attachmentFor(req, 'read'); if (!r.a) return res.status(r.status).json({ ok: false, error: r.error });
    const { a } = r;
    if (String(a.stored_name).startsWith('s3:')) {
      return objectStorage.signedUrl({ organisationId: req.saas.organisation_id, key: String(a.stored_name).slice(3), filename: a.original_name, contentType: a.mime_type, actorId: req.saas.user_id })
        .then(({ url }) => { res.set('cache-control', 'no-store'); res.redirect(302, url); })
        .catch((e) => res.status(e.status === 404 ? 404 : 502).json({ ok: false, error: e.status === 404 ? 'File not found.' : 'The file is temporarily unavailable.' }));
    }
    const file = path.join(dirFor(req.saas.organisation_id), path.basename(a.stored_name));
    if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'The stored file is missing.' });
    res.set({ 'content-type': a.mime_type, 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cache-control': 'private, no-store', 'content-disposition': `inline; filename="${String(a.original_name).replace(/[^\w.\- ]/g, '_')}"` });
    res.sendFile(file);
  });

  app.delete('/api/saas/document-attachments/:id', requireSaasUser, (req, res) => {
    const r = attachmentFor(req, 'edit'); if (!r.a) return res.status(r.status).json({ ok: false, error: r.error });
    db.prepare('DELETE FROM document_attachments WHERE id=? AND organisation_id=?').run(r.a.id, req.saas.organisation_id);
    if (!String(r.a.stored_name).startsWith('s3:')) fs.rmSync(path.join(dirFor(req.saas.organisation_id), path.basename(r.a.stored_name)), { force: true });
    saasAudit(req, 'document_attachment.deleted', r.doc.kind, r.doc.id, { label: r.a.label });
    res.json({ ok: true, attachments: list(req.saas.organisation_id, r.doc.id) });
  });

  return { list };
}
