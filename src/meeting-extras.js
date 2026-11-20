// T-180: Video Meetings extras.
// 1. Zoom: each business connects its OWN Zoom account (a Server-to-Server OAuth app it creates in the Zoom App
//    Marketplace: Account ID, Client ID, Client Secret). Oprun creates and lists Zoom meetings in that account; the
//    business pays Zoom directly. The secret is stored encrypted and never shown again.
// 2. Invites: a signed-in member sends the meeting link by email, SMS or WhatsApp from the business's own senders.
//    The person writes or confirms the words and presses Send, so this is their own message (not an AI draft).
// 3. Click to call: dial a number on the keypad; Oprun rings the member's own mobile from the business number and,
//    when they answer, connects them to the number dialled (the customer sees the business number).
import { z } from 'zod';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { normalisePhone } from './country-profile.js';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
// Any valid number (mobile or landline) in the business's country, or a full international number.
const dialable = (raw, country) => { const p = parsePhoneNumberFromString(String(raw || '').trim(), country); return p && p.isValid() ? p.number : null; };

const HOSTS = ['owner', 'admin', 'manager', 'super_admin', 'director'];

export function installMeetingExtras(app, { db, env = {}, requireSaasUser, requireSaasRole, saasAudit, runtime, dispatch, voice, webphone = null, uploadRoot = null, fetchImpl = globalThis.fetch }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS zoom_accounts (organisation_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, client_id TEXT NOT NULL, secret_bundle TEXT NOT NULL,
      user_email TEXT, status TEXT NOT NULL DEFAULT 'connected', last_error TEXT, connected_by TEXT, connected_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS zoom_meetings (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, zoom_id TEXT NOT NULL, topic TEXT NOT NULL, start_time TEXT,
      duration INTEGER, join_url TEXT NOT NULL, start_url TEXT, passcode TEXT, status TEXT NOT NULL DEFAULT 'scheduled', created_by TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS zoom_meetings_org ON zoom_meetings(organisation_id, created_at);`);
  const iso = () => new Date().toISOString();
  const org = (req) => req.saas.organisation_id;
  const host = [requireSaasUser, requireSaasRole(...HOSTS)];
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const fail = (res, status, error) => res.status(status).json({ ok: false, error });
  const parse = (schema, body, res) => { const p = schema.safeParse(body || {}); if (!p.success) { fail(res, 400, p.error.issues[0]?.message || 'Check the details.'); return null; } return p.data; };
  const zoomApi = () => String(env.ZOOM_API_BASE_URL || 'https://api.zoom.us/v2').replace(/\/$/, '');
  const zoomOauth = () => String(env.ZOOM_OAUTH_URL || 'https://zoom.us/oauth/token');
  const countryOf = (o) => { try { return db.prepare('SELECT country FROM organisations WHERE id=?').get(o)?.country || 'AU'; } catch { return 'AU'; } };

  // ---------- Zoom ----------
  const tokens = new Map(); // org -> { token, until }
  async function zoomToken(o, creds = null) {
    const c = creds || (() => { const r = db.prepare('SELECT * FROM zoom_accounts WHERE organisation_id=?').get(o); if (!r) return null; const b = runtime.decryptBundle(JSON.parse(r.secret_bundle)); return { account_id: r.account_id, client_id: r.client_id, client_secret: b.client_secret }; })();
    if (!c) throw Object.assign(new Error('Connect your Zoom account first.'), { status: 409 });
    const cached = !creds && tokens.get(o); if (cached && cached.until > Date.now()) return cached.token;
    const r = await fetchImpl(`${zoomOauth()}?grant_type=account_credentials&account_id=${encodeURIComponent(c.account_id)}`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${c.client_id}:${c.client_secret}`).toString('base64') } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw Object.assign(new Error(`Zoom did not accept these details: ${j.reason || j.error || r.status}. Check the Account ID, Client ID and Client Secret of your Server-to-Server OAuth app, and that it is activated.`), { status: 400 });
    if (!creds) tokens.set(o, { token: j.access_token, until: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000 });
    return j.access_token;
  }
  async function zoom(o, method, path, body, token = null) {
    const t = token || await zoomToken(o);
    const r = await fetchImpl(zoomApi() + path, { method, headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`Zoom answered: ${j.message || r.status}${/scope/i.test(j.message || '') ? ' Add the meeting:write and user:read scopes to your Zoom app.' : ''}`), { status: 502 });
    return j;
  }
  const zoomStatus = (o) => { const r = db.prepare('SELECT status,user_email,client_id,last_error,connected_at FROM zoom_accounts WHERE organisation_id=?').get(o); return r ? { connected: r.status === 'connected', account: r.user_email, client_id: `${r.client_id.slice(0, 4)}…`, problem: r.last_error, connected_at: r.connected_at } : { connected: false }; };
  const zoomOut = (m, canStart) => ({ id: m.id, topic: m.topic, start_time: m.start_time, duration: m.duration, join_url: m.join_url, passcode: m.passcode, status: m.status, created_at: m.created_at, start_url: canStart ? m.start_url : null });

  app.get('/api/saas/zoom', ...host, (req, res) => res.json({ ok: true, ...zoomStatus(org(req)), meetings: db.prepare("SELECT * FROM zoom_meetings WHERE organisation_id=? AND status='scheduled' ORDER BY COALESCE(start_time,created_at) DESC LIMIT 50").all(org(req)).map((m) => zoomOut(m, true)) }));
  app.post('/api/saas/zoom/connect', limiter, requireSaasUser, requireSaasRole('owner', 'admin', 'super_admin'), async (req, res) => {
    const d = parse(z.object({ account_id: z.string().trim().min(6).max(80), client_id: z.string().trim().min(6).max(120), client_secret: z.string().trim().min(8).max(200) }).strict(), req.body, res); if (!d) return;
    try {
      const token = await zoomToken(org(req), d);
      const me = await zoom(org(req), 'GET', '/users/me', null, token).catch(() => ({}));
      const now = iso();
      db.prepare(`INSERT INTO zoom_accounts(organisation_id,account_id,client_id,secret_bundle,user_email,status,last_error,connected_by,connected_at,updated_at) VALUES (?,?,?,?,?,'connected',NULL,?,?,?)
        ON CONFLICT(organisation_id) DO UPDATE SET account_id=excluded.account_id,client_id=excluded.client_id,secret_bundle=excluded.secret_bundle,user_email=excluded.user_email,status='connected',last_error=NULL,connected_by=excluded.connected_by,connected_at=excluded.connected_at,updated_at=excluded.updated_at`)
        .run(org(req), d.account_id, d.client_id, JSON.stringify(runtime.encryptBundle({ client_secret: d.client_secret })), me.email || null, req.saas.user_id, now, now);
      tokens.delete(org(req));
      saasAudit(req, 'zoom.connected', 'zoom_account', org(req), { account: me.email || null });
      res.json({ ok: true, ...zoomStatus(org(req)) });
    } catch (e) { fail(res, e.status || 400, e.message); }
  });
  app.delete('/api/saas/zoom', requireSaasUser, requireSaasRole('owner', 'admin', 'super_admin'), (req, res) => {
    db.prepare('DELETE FROM zoom_accounts WHERE organisation_id=?').run(org(req)); tokens.delete(org(req));
    saasAudit(req, 'zoom.disconnected', 'zoom_account', org(req), {});
    res.json({ ok: true, connected: false });
  });
  app.post('/api/saas/zoom/meetings', limiter, ...host, async (req, res) => {
    const d = parse(z.object({ topic: z.string().trim().min(2).max(200), start_time: z.iso.datetime().optional(), duration: z.number().int().min(15).max(600).optional() }).strict(), req.body, res); if (!d) return;
    try {
      const tz = db.prepare('SELECT timezone FROM organisations WHERE id=?').get(org(req))?.timezone || 'Australia/Perth';
      const m = await zoom(org(req), 'POST', '/users/me/meetings', { topic: d.topic, type: d.start_time ? 2 : 1, ...(d.start_time ? { start_time: d.start_time, timezone: tz } : {}), duration: d.duration || 30, settings: { waiting_room: true, join_before_host: false, host_video: true, participant_video: true, mute_upon_entry: true } });
      if (!m.id || !m.join_url) throw Object.assign(new Error('Zoom did not return a meeting link.'), { status: 502 });
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO zoom_meetings(id,organisation_id,zoom_id,topic,start_time,duration,join_url,start_url,passcode,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, org(req), String(m.id), d.topic, d.start_time || null, d.duration || 30, m.join_url, m.start_url || null, m.password || null, req.saas.user_id, iso());
      saasAudit(req, 'zoom.meeting_created', 'zoom_meeting', id, { scheduled: Boolean(d.start_time) });
      res.status(201).json({ ok: true, meeting: zoomOut(db.prepare('SELECT * FROM zoom_meetings WHERE id=?').get(id), true) });
    } catch (e) { db.prepare('UPDATE zoom_accounts SET last_error=?,updated_at=? WHERE organisation_id=?').run(String(e.message).slice(0, 300), iso(), org(req)); fail(res, e.status || 502, e.message); }
  });
  app.delete('/api/saas/zoom/meetings/:id', ...host, async (req, res) => {
    const m = db.prepare("SELECT * FROM zoom_meetings WHERE id=? AND organisation_id=? AND status='scheduled'").get(req.params.id, org(req)); if (!m) return fail(res, 404, 'Meeting not found.');
    try { await zoom(org(req), 'DELETE', `/meetings/${encodeURIComponent(m.zoom_id)}`); } catch (e) { if (!/3001|not found|404/i.test(e.message)) return fail(res, e.status || 502, e.message); }
    db.prepare("UPDATE zoom_meetings SET status='cancelled' WHERE id=?").run(m.id);
    saasAudit(req, 'zoom.meeting_cancelled', 'zoom_meeting', m.id, {});
    res.json({ ok: true });
  });

  // ---------- Invites ----------
  app.post('/api/saas/meetings/invite', limiter, ...host, async (req, res) => {
    const d = parse(z.object({ meeting_id: z.string().max(80).optional(), zoom_meeting_id: z.string().max(80).optional(), channel: z.enum(['email', 'sms', 'whatsapp']), to: z.string().trim().min(3).max(200), message: z.string().trim().max(1000).optional() }).strict(), req.body, res); if (!d) return;
    let link = null, title = null, when = null;
    if (d.zoom_meeting_id) { const m = db.prepare("SELECT * FROM zoom_meetings WHERE id=? AND organisation_id=? AND status='scheduled'").get(d.zoom_meeting_id, org(req)); if (m) { link = m.join_url; title = m.topic; when = m.start_time; if (m.passcode) link += ` (passcode ${m.passcode})`; } }
    else if (d.meeting_id) {
      const m = db.prepare("SELECT * FROM meetings WHERE id=? AND organisation_id=? AND status='open' AND guests_allowed=1").get(d.meeting_id, org(req));
      if (m) { const key = String(env.SAAS_SESSION_SECRET || env.SESSION_SECRET || env.INTEGRATION_ENCRYPTION_KEY || '').trim(); const t = key ? crypto.createHmac('sha256', key).update(`meeting-guest:${m.id}:${m.guest_nonce}`).digest('base64url').slice(0, 32) : null; if (t) { link = `${String(env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/saas/meet.html?m=${m.id}#t=${t}`; title = m.title; when = m.starts_at; } }
    }
    if (!link) return fail(res, 404, 'This meeting is not open to guests. Allow guests or choose another meeting.');
    let to = d.to;
    if (d.channel === 'email') { if (!z.email().safeParse(to).success) return fail(res, 400, 'Enter a valid email address.'); }
    else { const n = normalisePhone(to, countryOf(org(req))) || (/^\+/.test(to) ? dialable(to, countryOf(org(req))) : null); if (!n) return fail(res, 400, 'Enter a valid mobile number.'); to = n; }
    const bizName = db.prepare('SELECT COALESCE(display_name,name) n FROM organisations WHERE id=?').get(org(req))?.n || 'Our team';
    const whenText = when ? ` on ${new Date(when).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: db.prepare('SELECT timezone FROM organisations WHERE id=?').get(org(req))?.timezone || 'Australia/Perth' })}` : '';
    const body = `${d.message ? d.message + '\n\n' : ''}${bizName} invites you to "${title}"${whenText}.\nJoin here: ${link}`;
    try {
      await dispatch({ id: crypto.randomUUID(), organisation_id: org(req), channel: d.channel, contact_address: to, subject: `Invitation: ${title}`, body });
      saasAudit(req, 'meeting.invite_sent', d.zoom_meeting_id ? 'zoom_meeting' : 'meeting', d.zoom_meeting_id || d.meeting_id, { channel: d.channel });
      res.json({ ok: true, message: `Invitation sent by ${d.channel === 'sms' ? 'SMS' : d.channel === 'whatsapp' ? 'WhatsApp' : 'email'}.` });
    } catch (e) { fail(res, e.code === 'NOT_CONFIGURED' ? 409 : 502, String(e.message).replace('the approved message', 'the invitation')); }
  });

  // ---------- Phone page: contacts and recent calls (T-183) ----------
  const digits = (v) => String(v || '').replace(/\D/g, '').slice(-9);
  app.get('/api/saas/comms/phonebook', ...host, (req, res) => {
    const o = org(req), country = countryOf(o);
    const fmtNum = (v) => { const n = dialable(v, country); return n || null; };
    const customers = db.prepare("SELECT id,name,phone,email,status FROM tenant_customers WHERE organisation_id=? AND phone IS NOT NULL AND trim(phone)<>'' ORDER BY name COLLATE NOCASE LIMIT 2000").all(o)
      .map((c) => ({ id: c.id, name: c.name, number: fmtNum(c.phone) || c.phone, email: c.email || null, kind: c.status === 'lead' ? 'Lead' : 'Customer' }));
    const team = db.prepare("SELECT u.id,u.full_name name,u.phone,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organisation_id=? AND u.phone IS NOT NULL AND trim(u.phone)<>'' ORDER BY u.full_name COLLATE NOCASE").all(o)
      .filter((u) => u.id !== req.saas.user_id).map((u) => ({ id: u.id, name: u.name || 'Team member', number: fmtNum(u.phone) || u.phone, kind: 'Team' }));
    const byDigits = new Map([...customers, ...team].map((c) => [digits(c.number), c.name]));
    const recents = db.prepare("SELECT call_control_id id,from_number,to_number,stage,route,answered_at,voicemail,duration_seconds,started_at,recording_url FROM voice_calls WHERE organisation_id=? ORDER BY started_at DESC LIMIT 60").all(o).map((c) => {
      const outgoing = c.route === 'outgoing', number = c.from_number;
      return { id: c.id, number, name: byDigits.get(digits(number)) || null, direction: outgoing ? 'outgoing' : 'incoming',
        result: c.voicemail ? 'voicemail' : c.answered_at ? 'answered' : (String(c.stage).startsWith('c2c') && c.stage !== 'ended' ? 'calling' : outgoing ? 'not answered' : 'missed'), duration: c.duration_seconds || null, at: c.started_at, recording: String(c.recording_url || '').startsWith('/api/saas/comms/recordings/') ? c.recording_url : null };
    });
    res.json({ ok: true, customers, team, recents });
  });

  // ---------- T-188: web phone (calls straight from the browser, from the business number) ----------
  app.post('/api/saas/comms/webphone/token', limiter, ...host, async (req, res) => {
    if (!webphone) return fail(res, 503, 'The web phone is not available.');
    try {
      const name = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.saas.user_id)?.full_name || 'Team member';
      const t = await webphone.webphoneToken(org(req), req.saas.user_id, name);
      res.set('Cache-Control', 'no-store').json({ ok: true, ...t, country: countryOf(org(req)) });
    } catch (e) { fail(res, e.status && e.status < 600 ? e.status : 502, e.message); }
  });
  app.post('/api/saas/comms/webphone/calls', limiter, ...host, (req, res) => {
    const d = parse(z.object({ to: z.string().trim().min(3).max(40) }).strict(), req.body, res); if (!d) return;
    const n = dialable(d.to, countryOf(org(req))); if (!n) return fail(res, 400, 'Enter a full phone number, including the area code.');
    const from = voice.businessNumber(org(req)); if (!from) return fail(res, 409, 'Connect your business number first.');
    const id = 'web-' + crypto.randomUUID(), now = iso();
    db.prepare("INSERT INTO voice_calls(call_control_id,organisation_id,scope,from_number,to_number,stage,route,account,started_at,updated_at) VALUES (?,?,'business',?,?,'web','outgoing','tenant',?,?)").run(id, org(req), n, from, now, now);
    saasAudit(req, 'call.web_phone', 'voice_call', id, { to_last4: n.slice(-4) });
    res.status(201).json({ ok: true, id, to: n, from });
  });
  app.patch('/api/saas/comms/webphone/calls/:id', ...host, (req, res) => {
    const d = parse(z.object({ state: z.enum(['answered', 'ended']), duration: z.number().int().min(0).max(86400).optional(), cause: z.string().max(80).optional() }).strict(), req.body, res); if (!d) return;
    const c = db.prepare("SELECT * FROM voice_calls WHERE call_control_id=? AND organisation_id=? AND route='outgoing' AND stage IN ('web','web-live')").get(req.params.id, org(req)); if (!c) return fail(res, 404, 'Call not found.');
    if (d.state === 'answered') db.prepare("UPDATE voice_calls SET stage='web-live',answered_at=COALESCE(answered_at,?),updated_at=? WHERE call_control_id=?").run(iso(), iso(), c.call_control_id);
    else db.prepare("UPDATE voice_calls SET stage='ended',ended_at=?,duration_seconds=?,hangup_cause=?,updated_at=? WHERE call_control_id=?").run(iso(), c.answered_at ? (d.duration ?? null) : null, d.cause || null, iso(), c.call_control_id);
    res.json({ ok: true });
  });
  // Recordings: made in the browser only after the caller confirms the other person was told; private to the business.
  const recDir = (o) => path.join(uploadRoot || '/tmp', 'call-recordings', String(o).replace(/[^a-zA-Z0-9-]/g, ''));
  const recUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(env.CALL_RECORDING_MAX_MB || 60) * 1048576, files: 1 }, fileFilter: (q, f, cb) => cb(/^audio\/(webm|ogg|mp4|mpeg)/.test(f.mimetype) ? null : Object.assign(new Error('Recordings must be audio.'), { status: 400 }), true) });
  app.post('/api/saas/comms/webphone/calls/:id/recording', ...host, (req, res) => {
    recUpload.single('audio')(req, res, (err) => {
      if (err) return fail(res, err.status || 400, err.code === 'LIMIT_FILE_SIZE' ? 'The recording is too large.' : err.message);
      const c = db.prepare("SELECT * FROM voice_calls WHERE call_control_id=? AND organisation_id=? AND route='outgoing' AND stage IN ('web','web-live','ended')").get(req.params.id, org(req));
      if (!c || !String(c.call_control_id).startsWith('web-')) return fail(res, 404, 'Call not found.');
      if (!req.file?.buffer?.length) return fail(res, 400, 'The recording is empty.');
      const ext = /mp4/.test(req.file.mimetype) ? '.m4a' : /ogg/.test(req.file.mimetype) ? '.ogg' : /mpeg/.test(req.file.mimetype) ? '.mp3' : '.webm';
      fs.mkdirSync(recDir(org(req)), { recursive: true });
      const file = c.call_control_id + ext; fs.writeFileSync(path.join(recDir(org(req)), file), req.file.buffer);
      db.prepare('UPDATE voice_calls SET recording_url=?,updated_at=? WHERE call_control_id=?').run(`/api/saas/comms/recordings/${c.call_control_id}`, iso(), c.call_control_id);
      saasAudit(req, 'call.recording_saved', 'voice_call', c.call_control_id, { bytes: req.file.size });
      res.status(201).json({ ok: true, recording: `/api/saas/comms/recordings/${c.call_control_id}` });
    });
  });
  app.get('/api/saas/comms/recordings/:id', ...host, (req, res) => {
    const c = db.prepare("SELECT call_control_id FROM voice_calls WHERE call_control_id=? AND organisation_id=? AND recording_url IS NOT NULL").get(req.params.id, org(req));
    if (!c || !/^web-[0-9a-f-]{36}$/.test(c.call_control_id)) return fail(res, 404, 'Recording not found.');
    const dir = recDir(org(req)), f = ['.webm', '.ogg', '.m4a', '.mp3'].map((x) => c.call_control_id + x).find((x) => fs.existsSync(path.join(dir, x)));
    if (!f) return fail(res, 404, 'Recording not found.');
    saasAudit(req, 'call.recording_played', 'voice_call', c.call_control_id, {});
    res.set({ 'content-type': { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' }[path.extname(f)], 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store', 'content-security-policy': "default-src 'none'; sandbox" });
    res.sendFile(path.join(dir, f));
  });

  // ---------- Click to call ----------
  app.get('/api/saas/comms/dial', ...host, (req, res) => {
    const me = db.prepare('SELECT phone FROM users WHERE id=?').get(req.saas.user_id)?.phone || null;
    res.json({ ok: true, business_number: voice.businessNumber(org(req)), your_mobile: me ? `••• ${String(me).slice(-3)}` : null, ready: Boolean(voice.businessNumber(org(req)) && me), web_phone: Boolean(webphone && voice.businessNumber(org(req))) });
  });
  app.post('/api/saas/comms/dial', limiter, ...host, async (req, res) => {
    const d = parse(z.object({ to: z.string().trim().min(3).max(40) }).strict(), req.body, res); if (!d) return;
    const n = dialable(d.to, countryOf(org(req))); if (!n) return fail(res, 400, 'Enter a full phone number, including the area code.');
    const me = db.prepare('SELECT phone FROM users WHERE id=?').get(req.saas.user_id)?.phone;
    const mine = me ? dialable(me, countryOf(org(req))) : null;
    if (!mine) return fail(res, 409, 'Add your mobile number to your profile first. Oprun rings you there, then connects the call.');
    try {
      const r = await voice.clickToCall(org(req), { staff: mine, customer: n });
      saasAudit(req, 'call.click_to_call', 'voice_call', r.call_id, { to_last4: n.slice(-4) });
      res.status(201).json({ ok: true, ...r, message: 'Your phone will ring now. Answer it and Oprun connects you; the other person sees your business number.' });
    } catch (e) { fail(res, e.status || 502, e.message); }
  });
}
