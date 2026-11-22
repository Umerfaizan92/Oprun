// Media Studio redesign: an owner permanently deletes this workspace's AI-generated material in one step.
// Uploads, other workspaces and anything still rendering are never touched; staff below admin cannot do it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

function member(s, org, role) {
  const db = new Database(s.dbPath), now = new Date().toISOString(), uid = randomUUID(), token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(uid, `${role}-${uid}@example.test`, role, 'x', 'x', now, now);
  db.prepare('INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(org, uid, role, now);
  db.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), uid, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 3600000).toISOString(), now, now);
  db.close(); return 'fp_session=' + token;
}

test('owner deletes all AI-generated material in their own workspace only', async (t) => {
  const s = await startServer({ AI_VIDEO_POLL_MS: '3600000' }); t.after(() => s.stop());
  const a = await seedOwner(s, { business: 'Studio A' }), b = await seedOwner(s, { email: 'studio-b@example.test', business: 'Studio B' });
  const db = new Database(s.dbPath); t.after(() => db.close());
  const now = new Date().toISOString(), later = new Date(Date.now() + 86400000).toISOString();
  const file = (org, source, name, kind = 'video') => {
    const id = randomUUID(), stored = `${id}.bin`, dir = path.join(s.temp, 'uploads', 'studio', org); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, stored), 'x');
    db.prepare('INSERT INTO tenant_media(id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,source,created_at) VALUES (?,?,?,?,?,?,1,?,?)').run(id, org, name, stored, kind === 'audio' ? 'audio/mpeg' : 'video/mp4', kind, source, now);
    return path.join(dir, stored);
  };
  const job = (org, status) => db.prepare("INSERT INTO ai_video_jobs(id,organisation_id,engine,prompt,aspect_ratio,resolution,duration,status,next_poll_at,created_at,updated_at) VALUES (?,?,'veo','p','9:16','720p',8,?,?,?,?)").run(randomUUID(), org, status, later, now, now);
  const aiA = file(a.org, 'ai-video', 'AI video – one.mp4'), voiceA = file(a.org, 'ai-voice', 'Voice-over.mp3', 'audio'), upA = file(a.org, 'upload', 'my-job.mp4'), aiB = file(b.org, 'ai-video', 'AI video – B.mp4');
  job(a.org, 'succeeded'); job(a.org, 'failed'); job(a.org, 'running'); job(b.org, 'succeeded');
  db.prepare("INSERT INTO video_render_jobs(id,organisation_id,edit_spec,created_at,updated_at) VALUES (?,?,'{}',?,?)").run(randomUUID(), a.org, now, now);
  const A = (m, u, body) => s.call(m, u, { cookie: a.cookie, body });

  let r = await A('GET', '/api/saas/ai-video/generated');
  assert.equal(r.status, 200); const { files, videos, specs, running } = r.json; assert.deepEqual({ files, videos, specs, running }, { files: 2, videos: 2, specs: 1, running: 1 });
  const manager = member(s, a.org, 'manager');
  assert.equal((await s.call('POST', '/api/saas/ai-video/generated/delete', { cookie: manager, body: { confirm: 'DELETE' } })).status, 403);
  assert.equal((await A('POST', '/api/saas/ai-video/generated/delete', {})).status, 400, 'needs explicit confirmation');
  r = await A('POST', '/api/saas/ai-video/generated/delete', { confirm: 'DELETE', organisation_id: b.org });
  assert.equal(r.status, 200, r.text); assert.deepEqual(r.json.deleted, { files: 2, videos: 2, specs: 1, running: 1 });

  assert.ok(!fs.existsSync(aiA) && !fs.existsSync(voiceA), 'AI files are gone from disk');
  assert.ok(fs.existsSync(upA), 'the business’s own uploads stay');
  assert.ok(fs.existsSync(aiB), 'another workspace is never touched');
  const left = (org) => db.prepare("SELECT source FROM tenant_media WHERE organisation_id=? ORDER BY source").all(org).map((x) => x.source);
  assert.deepEqual(left(a.org), ['upload']); assert.deepEqual(left(b.org), ['ai-video']);
  assert.deepEqual(db.prepare('SELECT status FROM ai_video_jobs WHERE organisation_id=?').all(a.org).map((x) => x.status), ['running'], 'still rendering is kept');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_video_jobs WHERE organisation_id=?').get(b.org).n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM video_render_jobs WHERE organisation_id=?').get(a.org).n, 0);
  assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE organisation_id=? AND action='ai_video.generated_deleted'").get(a.org));
  r = await A('GET', '/api/saas/ai-video/generated'); assert.equal(r.json.files + r.json.videos + r.json.specs, 0);
});
