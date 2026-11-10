// T-074 Video and voice meetings. Rooms, sign-in checks, the guest waiting room and call signalling run on this server;
// sound and picture travel directly between the participants' browsers (WebRTC), so no recording or media passes
// through or is stored by Super Pro. Every room belongs to one workspace. A guest needs the room's private link and
// must be let in by a signed-in member of that workspace.
//
// Live call state is held in memory on the single application instance. A restart ends calls in progress; people
// rejoin from the same link. Meeting records and attendance are stored in the database.
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

export const MAX_PARTICIPANTS = 6;      // browser-to-browser calls stay reliable up to about this size
const MAX_WAITING = 10, MAX_QUEUE = 400, MAX_SIGNAL_BYTES = 48 * 1024;
const POLL_HOLD_MS = 25000, PEER_TIMEOUT_MS = 45000, WAITING_TIMEOUT_MS = 60000, OPEN_MEETING_LIMIT = 25;
const HOST_ROLES = ['owner', 'admin', 'manager', 'super_admin', 'director'];

export function installMeetings(app, { db, env = {}, requireSaasUser, saasAudit, notifications = null, now = () => Date.now() }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, title TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'video', starts_at TEXT,
      status TEXT NOT NULL DEFAULT 'open', guests_allowed INTEGER NOT NULL DEFAULT 1, guest_nonce TEXT NOT NULL,
      created_by TEXT, created_at TEXT NOT NULL, ended_at TEXT, ended_by TEXT);
    CREATE INDEX IF NOT EXISTS meetings_org ON meetings(organisation_id, status, created_at);
    CREATE TABLE IF NOT EXISTS meeting_attendance (
      id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, organisation_id TEXT NOT NULL, kind TEXT NOT NULL, user_id TEXT, display_name TEXT NOT NULL,
      joined_at TEXT NOT NULL, left_at TEXT);
    CREATE INDEX IF NOT EXISTS meeting_attendance_meeting ON meeting_attendance(meeting_id);`);

  const iso = () => new Date(now()).toISOString();
  const fail = (res, status, error, code) => res.status(status).json({ ok: false, error, ...(code ? { code } : {}) });
  const cleanName = (v, fallback) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || fallback;
  const secretKey = String(env.SAAS_SESSION_SECRET || env.SESSION_SECRET || env.INTEGRATION_ENCRYPTION_KEY || '').trim();
  const guestToken = (m) => (secretKey ? crypto.createHmac('sha256', secretKey).update(`meeting-guest:${m.id}:${m.guest_nonce}`).digest('base64url').slice(0, 32) : null);
  const sameToken = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
  const base = (req) => (String(env.PUBLIC_BASE_URL || '').trim() || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

  // Connection helpers the browsers use to find each other. STUN only reveals a public address; TURN relays media
  // when a direct path is impossible and needs its own account, so it is optional.
  const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  function iceServers() {
    const stun = env.MEETING_STUN_URLS === undefined ? ['stun:stun.l.google.com:19302'] : list(env.MEETING_STUN_URLS);
    const turn = list(env.MEETING_TURN_URLS), out = [];
    if (stun.length) out.push({ urls: stun });
    if (turn.length && env.MEETING_TURN_USERNAME && env.MEETING_TURN_CREDENTIAL) out.push({ urls: turn, username: String(env.MEETING_TURN_USERNAME), credential: String(env.MEETING_TURN_CREDENTIAL) });
    return out;
  }
  const relayConfigured = () => Boolean(list(env.MEETING_TURN_URLS).length && env.MEETING_TURN_USERNAME && env.MEETING_TURN_CREDENTIAL);

  // ---- live state -------------------------------------------------------------------------------------------
  /** meetingId -> { org, peers: Map(peerId -> peer), waiting: Map(waitingId -> guest) } */
  const rooms = new Map();
  /** sha256(secret) -> { meetingId, peerId } and the same for people in the waiting room */
  const peerBySecret = new Map(), waitingBySecret = new Map();
  const room = (m) => { let r = rooms.get(m.id); if (!r) { r = { org: m.organisation_id, peers: new Map(), waiting: new Map() }; rooms.set(m.id, r); } return r; };
  const publicPeer = (p) => ({ id: p.id, name: p.name, kind: p.kind, host: p.host, audio: p.audio, video: p.video, sharing: p.sharing });
  function push(p, message) {
    if (p.queue.length >= MAX_QUEUE) p.queue.shift();
    p.queue.push(message);
    if (p.waiter) { const w = p.waiter; p.waiter = null; w(); }
  }
  const broadcast = (r, message, exceptId = null) => { for (const p of r.peers.values()) if (p.id !== exceptId) push(p, message); };
  const hosts = (r) => [...r.peers.values()].filter((p) => p.host);
  const waitingList = (r) => [...r.waiting.values()].filter((g) => g.status === 'waiting').map((g) => ({ id: g.id, name: g.name }));
  function removePeer(meetingId, peerId, reason = 'left') {
    const r = rooms.get(meetingId), p = r?.peers.get(peerId); if (!p) return;
    r.peers.delete(peerId); peerBySecret.delete(p.secretHash);
    if (p.waiter) { const w = p.waiter; p.waiter = null; w(); }
    db.prepare('UPDATE meeting_attendance SET left_at=? WHERE id=? AND left_at IS NULL').run(iso(), p.attendanceId);
    broadcast(r, { type: 'peer-left', id: peerId, reason });
    if (!r.peers.size && !r.waiting.size) rooms.delete(meetingId);
  }
  function closeRoom(meetingId, reason) {
    const r = rooms.get(meetingId); if (!r) return;
    for (const p of [...r.peers.values()]) { push(p, { type: 'ended', reason }); db.prepare('UPDATE meeting_attendance SET left_at=? WHERE id=? AND left_at IS NULL').run(iso(), p.attendanceId); peerBySecret.delete(p.secretHash); }
    for (const g of r.waiting.values()) { g.status = 'ended'; if (g.waiter) { const w = g.waiter; g.waiter = null; w(); } }
    // People still holding a request receive the final message; the room is dropped shortly after.
    setTimeout(() => { for (const g of r.waiting.values()) waitingBySecret.delete(g.secretHash); rooms.delete(meetingId); }, 3000).unref?.();
  }
  function sweep() {
    const t = now();
    for (const [meetingId, r] of rooms) {
      for (const p of [...r.peers.values()]) if (t - p.seen > PEER_TIMEOUT_MS) removePeer(meetingId, p.id, 'timeout');
      for (const g of [...r.waiting.values()]) if (t - g.seen > WAITING_TIMEOUT_MS) { r.waiting.delete(g.id); waitingBySecret.delete(g.secretHash); for (const h of hosts(r)) push(h, { type: 'waiting', waiting: waitingList(r) }); }
      if (!r.peers.size && !r.waiting.size) rooms.delete(meetingId);
    }
  }
  const sweeper = setInterval(sweep, 10000); sweeper.unref?.();

  function addPeer(m, { kind, name, userId = null, host = false }) {
    const r = room(m), id = crypto.randomUUID(), secret = crypto.randomBytes(24).toString('base64url'), attendanceId = crypto.randomUUID();
    const p = { id, kind, name, userId, host, audio: true, video: m.mode !== 'voice', sharing: false, queue: [], waiter: null, seen: now(), secretHash: hash(secret), attendanceId };
    const others = [...r.peers.values()].map(publicPeer);
    r.peers.set(id, p); peerBySecret.set(p.secretHash, { meetingId: m.id, peerId: id });
    db.prepare('INSERT INTO meeting_attendance (id,meeting_id,organisation_id,kind,user_id,display_name,joined_at) VALUES (?,?,?,?,?,?,?)').run(attendanceId, m.id, m.organisation_id, kind, userId, name, iso());
    broadcast(r, { type: 'peer-joined', peer: publicPeer(p) }, id);
    return { peer_id: id, peer_secret: secret, peers: others, self: publicPeer(p), ice_servers: iceServers(), relay_configured: relayConfigured(), max_participants: MAX_PARTICIPANTS, meeting: { id: m.id, title: m.title, mode: m.mode } };
  }

  // ---- workspace (signed-in) --------------------------------------------------------------------------------
  const meetingFor = (req, id) => db.prepare('SELECT * FROM meetings WHERE id=? AND organisation_id=?').get(String(id), req.saas.organisation_id);
  const isHost = (req, m) => HOST_ROLES.includes(req.saas.role) || m.created_by === req.saas.user_id;
  const view = (req, m) => {
    const r = rooms.get(m.id), token = m.guests_allowed ? guestToken(m) : null;
    return { id: m.id, title: m.title, mode: m.mode, starts_at: m.starts_at, status: m.status, guests_allowed: Boolean(m.guests_allowed), created_at: m.created_at, ended_at: m.ended_at,
      live: m.status === 'open' ? [...(r?.peers.values() || [])].map((p) => ({ name: p.name, kind: p.kind })) : [], waiting: m.status === 'open' ? (r ? waitingList(r).length : 0) : 0,
      can_manage: isHost(req, m), guest_link: m.status === 'open' && token && isHost(req, m) ? `${base(req)}/saas/meet.html?m=${m.id}#t=${token}` : null };
  };
  const displayName = (req) => cleanName(db.prepare('SELECT full_name FROM users WHERE id=?').get(req.saas.user_id)?.full_name, 'Team member');

  app.get('/api/saas/meetings', requireSaasUser, (req, res) => {
    const org = req.saas.organisation_id;
    const open = db.prepare("SELECT * FROM meetings WHERE organisation_id=? AND status='open' ORDER BY COALESCE(starts_at,created_at) ASC LIMIT 50").all(org);
    const past = db.prepare("SELECT * FROM meetings WHERE organisation_id=? AND status='ended' ORDER BY ended_at DESC LIMIT 20").all(org);
    const attended = new Map(db.prepare("SELECT meeting_id,COUNT(*) n FROM meeting_attendance WHERE organisation_id=? GROUP BY meeting_id").all(org).map((x) => [x.meeting_id, x.n]));
    res.json({ ok: true, meetings: open.map((m) => view(req, m)), past: past.map((m) => ({ ...view(req, m), joins: attended.get(m.id) || 0 })),
      can_create: true, max_participants: MAX_PARTICIPANTS, relay_configured: relayConfigured(), guest_links_available: Boolean(secretKey) });
  });

  const createSchema = z.object({ title: z.string().trim().min(2).max(120), mode: z.enum(['video', 'voice']).default('video'), starts_at: z.string().datetime({ offset: true }).optional().or(z.literal('')), guests_allowed: z.boolean().default(true), notify_team: z.boolean().default(false) }).strict();
  app.post('/api/saas/meetings', requireSaasUser, async (req, res) => {
    const p = createSchema.safeParse(req.body);
    if (!p.success) return fail(res, 400, 'Give the meeting a name of at least two characters.');
    const org = req.saas.organisation_id, d = p.data;
    if (db.prepare("SELECT COUNT(*) n FROM meetings WHERE organisation_id=? AND status='open'").get(org).n >= OPEN_MEETING_LIMIT) return fail(res, 409, `This workspace has ${OPEN_MEETING_LIMIT} open meetings. End the ones that are finished first.`);
    const id = crypto.randomUUID(), title = cleanName(d.title, 'Meeting').slice(0, 120);
    db.prepare('INSERT INTO meetings (id,organisation_id,title,mode,starts_at,guests_allowed,guest_nonce,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, org, title, d.mode, d.starts_at || null, d.guests_allowed ? 1 : 0, crypto.randomBytes(12).toString('hex'), req.saas.user_id, iso());
    saasAudit(req, 'meeting.created', 'meeting', id, { mode: d.mode, scheduled: Boolean(d.starts_at), guests_allowed: d.guests_allowed });
    if (d.notify_team && notifications) {
      void notifications.notifyRoles(org, [...HOST_ROLES, 'employee', 'contractor'], { kind: 'meeting_started', title: `${displayName(req)} started a ${d.mode === 'voice' ? 'voice' : 'video'} call`, body: `${title}. Open Video Meetings to join.`, link: '#b04/meetings', dedupe: `meeting:${id}`, excludeUserId: req.saas.user_id }).catch(() => {});
    }
    res.status(201).json({ ok: true, meeting: view(req, db.prepare('SELECT * FROM meetings WHERE id=?').get(id)) });
  });

  app.post('/api/saas/meetings/:id/join', requireSaasUser, (req, res) => {
    const m = meetingFor(req, req.params.id);
    if (!m) return fail(res, 404, 'Meeting not found.');
    if (m.status !== 'open') return fail(res, 409, 'This meeting has ended.', 'ended');
    const r = room(m);
    // The same person joining again (a refresh, a second tab) replaces their earlier place in the room.
    for (const p of [...r.peers.values()]) if (p.userId === req.saas.user_id) removePeer(m.id, p.id, 'rejoined');
    if (r.peers.size >= MAX_PARTICIPANTS) return fail(res, 409, `This call is full (${MAX_PARTICIPANTS} people).`, 'full');
    const joined = addPeer(m, { kind: 'staff', name: displayName(req), userId: req.saas.user_id, host: isHost(req, m) });
    res.json({ ok: true, ...joined, waiting: isHost(req, m) ? waitingList(r) : [] });
  });

  app.post('/api/saas/meetings/:id/admit', requireSaasUser, (req, res) => {
    const p = z.object({ waiting_id: z.string().uuid(), allow: z.boolean() }).strict().safeParse(req.body);
    const m = meetingFor(req, req.params.id);
    if (!m || !p.success) return fail(res, 404, 'Meeting not found.');
    if (!isHost(req, m)) return fail(res, 403, 'Only the meeting organiser or a manager can let guests in.');
    const r = rooms.get(m.id), g = r?.waiting.get(p.data.waiting_id);
    if (!g || g.status !== 'waiting') return fail(res, 404, 'That guest is no longer waiting.');
    if (p.data.allow && r.peers.size >= MAX_PARTICIPANTS) return fail(res, 409, `This call is full (${MAX_PARTICIPANTS} people).`, 'full');
    if (p.data.allow) { g.status = 'admitted'; g.join = addPeer(m, { kind: 'guest', name: g.name }); } else g.status = 'declined';
    if (g.waiter) { const w = g.waiter; g.waiter = null; w(); }
    saasAudit(req, p.data.allow ? 'meeting.guest_admitted' : 'meeting.guest_declined', 'meeting', m.id, {});
    for (const h of hosts(r)) push(h, { type: 'waiting', waiting: waitingList(r) });
    res.json({ ok: true, waiting: waitingList(r) });
  });

  app.post('/api/saas/meetings/:id/guest-link', requireSaasUser, (req, res) => {
    const m = meetingFor(req, req.params.id);
    if (!m) return fail(res, 404, 'Meeting not found.');
    if (!isHost(req, m)) return fail(res, 403, 'Only the meeting organiser or a manager can change the guest link.');
    const allow = z.object({ guests_allowed: z.boolean() }).strict().safeParse(req.body);
    if (!allow.success) return fail(res, 400, 'Choose whether guests may join.');
    // A new link always replaces the old one, so a link that was shared by mistake stops working.
    db.prepare('UPDATE meetings SET guests_allowed=?,guest_nonce=? WHERE id=?').run(allow.data.guests_allowed ? 1 : 0, crypto.randomBytes(12).toString('hex'), m.id);
    const r = rooms.get(m.id);
    if (r) { for (const g of r.waiting.values()) if (g.status === 'waiting') { g.status = 'declined'; if (g.waiter) { const w = g.waiter; g.waiter = null; w(); } } for (const h of hosts(r)) push(h, { type: 'waiting', waiting: [] }); }
    saasAudit(req, 'meeting.guest_link_changed', 'meeting', m.id, { guests_allowed: allow.data.guests_allowed });
    res.json({ ok: true, meeting: view(req, db.prepare('SELECT * FROM meetings WHERE id=?').get(m.id)) });
  });

  app.post('/api/saas/meetings/:id/end', requireSaasUser, (req, res) => {
    const m = meetingFor(req, req.params.id);
    if (!m) return fail(res, 404, 'Meeting not found.');
    if (!isHost(req, m)) return fail(res, 403, 'Only the meeting organiser or a manager can end the meeting for everyone.');
    if (m.status === 'open') {
      db.prepare("UPDATE meetings SET status='ended',ended_at=?,ended_by=? WHERE id=?").run(iso(), req.saas.user_id, m.id);
      closeRoom(m.id, 'ended_by_host');
      saasAudit(req, 'meeting.ended', 'meeting', m.id, {});
    }
    res.json({ ok: true });
  });

  // ---- in-call (peer secret; works the same for staff and admitted guests) ----------------------------------
  function peerOf(req) {
    const found = peerBySecret.get(hash(req.get('x-meeting-peer') || '')); if (!found) return null;
    const r = rooms.get(found.meetingId), p = r?.peers.get(found.peerId); if (!p) return null;
    p.seen = now(); return { r, p, meetingId: found.meetingId };
  }
  const gone = (res) => res.status(410).json({ ok: false, code: 'gone', error: 'You are no longer in this call.' });
  const callLimiter = rateLimit({ windowMs: 60000, limit: 900, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => hash(req.get('x-meeting-peer') || req.get('x-meeting-waiting') || req.ip).slice(0, 32), message: { ok: false, error: 'Too many requests. Wait a moment.' } });

  app.get('/api/meetings/call/poll', callLimiter, (req, res) => {
    const ctx = peerOf(req); if (!ctx) return gone(res);
    const { p } = ctx; res.set('Cache-Control', 'no-store');
    let timer = null;
    const flush = () => { clearTimeout(timer); const messages = p.queue.splice(0, p.queue.length); p.seen = now(); if (!res.headersSent) res.json({ ok: true, messages }); };
    // One waiting request per participant: a newer request releases the older one.
    if (p.waiter) { const w = p.waiter; p.waiter = null; w(); }
    if (p.queue.length) return flush();
    timer = setTimeout(() => { if (p.waiter === flush) p.waiter = null; flush(); }, POLL_HOLD_MS);
    p.waiter = flush;
    req.on('close', () => { clearTimeout(timer); if (p.waiter === flush) p.waiter = null; });
  });

  app.post('/api/meetings/call/signal', callLimiter, (req, res) => {
    const ctx = peerOf(req); if (!ctx) return gone(res);
    const p = z.object({ to: z.string().uuid(), data: z.object({ kind: z.enum(['offer', 'answer', 'candidate']), sdp: z.string().max(MAX_SIGNAL_BYTES).optional(), candidate: z.any().optional() }).strict() }).strict().safeParse(req.body);
    if (!p.success || JSON.stringify(req.body).length > MAX_SIGNAL_BYTES) return fail(res, 400, 'Call message not accepted.');
    const target = ctx.r.peers.get(p.data.to);
    if (!target) return fail(res, 404, 'That participant has left.', 'peer_left');
    push(target, { type: 'signal', from: ctx.p.id, data: p.data.data });
    res.json({ ok: true });
  });

  app.post('/api/meetings/call/state', callLimiter, (req, res) => {
    const ctx = peerOf(req); if (!ctx) return gone(res);
    const p = z.object({ audio: z.boolean(), video: z.boolean(), sharing: z.boolean() }).strict().safeParse(req.body);
    if (!p.success) return fail(res, 400, 'Call state not accepted.');
    Object.assign(ctx.p, p.data);
    broadcast(ctx.r, { type: 'peer-state', peer: publicPeer(ctx.p) }, ctx.p.id);
    res.json({ ok: true });
  });

  app.post('/api/meetings/call/leave', callLimiter, (req, res) => {
    const ctx = peerOf(req); if (!ctx) return gone(res);
    removePeer(ctx.meetingId, ctx.p.id, 'left');
    res.json({ ok: true });
  });

  // ---- guests (no account) ----------------------------------------------------------------------------------
  const guestLimiter = rateLimit({ windowMs: 10 * 60000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many attempts. Try again in a few minutes.' } });
  // The same answer is given for a wrong link, a closed link and an unknown meeting, so a link cannot be guessed at.
  const guestMeeting = (id, token) => { const m = /^[0-9a-f-]{36}$/.test(String(id)) ? db.prepare('SELECT * FROM meetings WHERE id=?').get(String(id)) : null; return m && m.guests_allowed && secretKey && sameToken(token, guestToken(m)) ? m : null; };
  const noLink = (res) => fail(res, 404, 'This meeting link is not valid. Ask the business for a new link.', 'invalid_link');

  app.post('/api/public/meetings/:id/lookup', guestLimiter, (req, res) => {
    const m = guestMeeting(req.params.id, req.body?.token); if (!m) return noLink(res);
    const business = db.prepare('SELECT name FROM organisations WHERE id=?').get(m.organisation_id)?.name || 'This business';
    res.set('Cache-Control', 'no-store').json({ ok: true, meeting: { title: m.title, mode: m.mode, status: m.status, starts_at: m.starts_at, business } });
  });

  app.post('/api/public/meetings/:id/knock', guestLimiter, (req, res) => {
    const m = guestMeeting(req.params.id, req.body?.token); if (!m) return noLink(res);
    if (m.status !== 'open') return fail(res, 409, 'This meeting has ended.', 'ended');
    const r = room(m);
    if ([...r.waiting.values()].filter((g) => g.status === 'waiting').length >= MAX_WAITING) return fail(res, 409, 'Too many people are waiting. Try again in a minute.', 'busy');
    const id = crypto.randomUUID(), secret = crypto.randomBytes(24).toString('base64url');
    const g = { id, name: cleanName(req.body?.name, 'Guest'), status: 'waiting', seen: now(), waiter: null, join: null, secretHash: hash(secret) };
    r.waiting.set(id, g); waitingBySecret.set(g.secretHash, { meetingId: m.id, waitingId: id });
    for (const h of hosts(r)) push(h, { type: 'waiting', waiting: waitingList(r) });
    res.status(201).json({ ok: true, waiting_secret: secret, host_present: hosts(r).length > 0 });
  });

  app.get('/api/public/meetings/waiting', callLimiter, (req, res) => {
    const found = waitingBySecret.get(hash(req.get('x-meeting-waiting') || '')), r = found && rooms.get(found.meetingId), g = r?.waiting.get(found.waitingId);
    if (!g) return gone(res);
    g.seen = now(); res.set('Cache-Control', 'no-store');
    let timer = null;
    const answer = () => {
      clearTimeout(timer);
      if (res.headersSent) return;
      if (g.status === 'admitted') { const join = g.join; r.waiting.delete(g.id); waitingBySecret.delete(g.secretHash); return res.json({ ok: true, status: 'admitted', join }); }
      if (g.status !== 'waiting') { r.waiting.delete(g.id); waitingBySecret.delete(g.secretHash); return res.json({ ok: true, status: g.status }); }
      res.json({ ok: true, status: 'waiting', host_present: hosts(r).length > 0 });
    };
    if (g.waiter) { const w = g.waiter; g.waiter = null; w(); }
    if (g.status !== 'waiting') return answer();
    timer = setTimeout(() => { if (g.waiter === answer) g.waiter = null; answer(); }, POLL_HOLD_MS);
    g.waiter = answer;
    req.on('close', () => { clearTimeout(timer); if (g.waiter === answer) g.waiter = null; });
  });

  return { stop: () => clearInterval(sweeper), sweep, liveCount: () => [...rooms.values()].reduce((n, r) => n + r.peers.size, 0) };
}
