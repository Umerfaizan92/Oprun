// T-179: a calendar post with photos and a video publishes to a Facebook Page as one multi-photo post plus a video post.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';
import { installGrowth } from '../src/growth.js';

test('Facebook post with two photos and a video: photos uploaded unpublished and attached, video posted, nothing retried', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbmedia-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const db = new Database(':memory:'); t.after(() => db.close());
  db.exec(`CREATE TABLE audit_logs(id TEXT,organisation_id TEXT,user_id TEXT,user_name TEXT,user_role TEXT,action TEXT,module TEXT,entity_type TEXT,entity_id TEXT,ip_address TEXT,user_agent TEXT,metadata_json TEXT,created_at TEXT,retention_until TEXT,prev_hash TEXT,event_hash TEXT);
    CREATE TABLE tenant_media(id TEXT PRIMARY KEY, organisation_id TEXT, original_name TEXT, stored_name TEXT, mime_type TEXT, kind TEXT, size_bytes INTEGER, source TEXT, tags TEXT, created_by_user_id TEXT, created_at TEXT);`);
  const files = { p1: ['photo', 'image/jpeg'], p2: ['photo', 'image/png'], v1: ['video', 'video/mp4'] };
  for (const [id, [kind, mime]] of Object.entries(files)) fs.writeFileSync(path.join(dir, id), 'bytes-' + id);
  const calls = [];
  const app = express(), noop = (req, res, next) => next();
  const api = installGrowth(app, { db, requireSaasUser: noop, requireSaasRole: () => noop, saasAudit: () => {},
    entitlements: { rules: () => ({ growth_auto_publish: true }) }, channelAuthority: () => true,
    connections: { load: () => ({ row: { status: 'connected' }, settings: { account_confirmed: true, selected_resources: [{ id: 'page', type: 'facebook_page' }] } }), fresh: async () => ({ access_token: 'synthetic-only' }) },
    mediaFile: (org, id) => (org === 'A' && files[id] ? { path: path.join(dir, id), kind: files[id][0], mime: files[id][1], name: id } : null),
    fetchImpl: async (url, opt) => {
      if (opt?.method !== 'POST') return { ok: true, json: async () => ({ access_token: 'synthetic-page-only' }) };
      const edge = url.split('/').pop(); calls.push({ edge, body: opt.body });
      return { ok: true, json: async () => ({ id: `${edge}-${calls.length}` }) };
    } });
  db.prepare(`INSERT INTO growth_calendar(id,organisation_id,plan_day,scheduled_at,platform,pillar,post_type,hook,body,status,approved_by,created_at,updated_at,media_json) VALUES('post','A',1,'2026-11-01T00:00:00Z','facebook','campaign','reel','Before and after','Recent job','approved','approver','2026-11-01','2026-11-01',?)`).run(JSON.stringify(['p1', 'p2', 'v1']));
  const r = await api.publishItem('post', { actor: 'approver' });
  assert.equal(r.status, 'published', JSON.stringify(r));
  assert.deepEqual(calls.map((c) => c.edge), ['photos', 'photos', 'feed', 'videos']);
  assert.equal(calls[0].body.get('published'), 'false');
  assert.ok(calls[0].body.get('source') instanceof Blob);
  const feed = calls[2].body;
  assert.equal(feed.get('message'), 'Before and after\n\nRecent job');
  assert.deepEqual([feed.get('attached_media[0]'), feed.get('attached_media[1]')].map((x) => JSON.parse(x).media_fbid), ['photos-1', 'photos-2']);
  assert.equal(r.external_id, 'feed-3,videos-4');
  assert.equal((await api.publishItem('post', { actor: 'approver' })).ok, false, 'a published post is never sent twice');
  assert.equal(calls.length, 4);
});
