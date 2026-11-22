import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { runMediaTool, probe } from '../src/media-tools.js';
import { planCopy, jpegOrientation } from '../src/reel-maker.js';

test('free copy uses only the business’s own details and never invents claims', () => {
  const p = planCopy({ display_name: 'Spark Electrical', services: '["Switchboard upgrades","Lighting"]', service_area: 'Perth', phone: '0400 000 000' }, { template: 'offer' });
  assert.equal(p.hooks.length, 3);
  assert.ok(!/\$|\d+%|free/i.test(p.hooks.join(' ')), 'no offer was typed, so none may appear');
  assert.match(p.hook, /Switchboard upgrades/i);
  assert.ok(p.hashtags.includes('#sparkelectrical'));
  const o = planCopy({ display_name: 'Spark' }, { template: 'offer', offer: '10% off this month' });
  assert.equal(o.hook, '10% off this month');
  const r = planCopy({ display_name: 'Spark' }, { template: 'review' });
  assert.deepEqual(r.features, [], 'a review reel shows no quote unless the business pasted a real one');
  assert.equal(jpegOrientation('/nonexistent'), 1);
});

test('reel maker renders a framed, captioned, branded reel from photos and a clip, privately per business', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const a = await seedOwner(s), b = await seedOwner(s, { email: 'reel-b@example.test' }), db = new Database(s.dbPath); t.after(() => db.close());
  const dir = path.join(s.temp, 'uploads', 'studio', a.org); fs.mkdirSync(dir, { recursive: true });
  const add = async (kind, ext, mime, args) => {
    const id = crypto.randomUUID(), file = path.join(dir, `${id}.${ext}`); await runMediaTool(['-y', ...args, file]);
    db.prepare('INSERT INTO tenant_media(id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, a.org, `x.${ext}`, `${id}.${ext}`, mime, kind, fs.statSync(file).size, new Date().toISOString());
    return id;
  };
  const wide = await add('photo', 'jpg', 'image/jpeg', ['-f', 'lavfi', '-i', 'testsrc2=size=640x360', '-frames:v', '1']); // landscape photo in a tall reel
  const tall = await add('photo', 'png', 'image/png', ['-f', 'lavfi', '-i', 'color=c=blue:size=360x640', '-frames:v', '1']);
  const clip = await add('video', 'mp4', 'video/mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=330', '-t', '3', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac']);
  const music = await add('audio', 'm4a', 'audio/mp4', ['-f', 'lavfi', '-i', 'sine=frequency=220', '-t', '20', '-c:a', 'aac']);
  const A = (m, u, body) => s.call(m, u, { body, cookie: a.cookie }), B = (m, u, body) => s.call(m, u, { body, cookie: b.cookie });

  const list = await A('GET', '/api/saas/reels'); assert.equal(list.status, 200); assert.equal(list.json.available, true); assert.ok(list.json.templates.length >= 6);
  const plan = await A('POST', '/api/saas/reels/plan', { template: 'before_after', service: 'deck restoration' }); assert.equal(plan.status, 200); assert.match(plan.json.plan.hook, /deck restoration/i);

  const spec = { template: 'before_after', aspect_ratio: '9:16', quality: '720p', hook: 'Watch this deck come back to life', title: 'Deck restoration', features: ['Sanded back to bare timber', 'Two coats of oil'], cta: 'Book a free quote', phone: '0400 000 000', website: 'example.com.au',
    items: [{ media_id: wide }, { media_id: tall }, { media_id: clip, start: 0.5 }, { media_id: wide }], logo_media_id: tall, audio: { media_id: music, volume: 0.6, keep_original: true }, caption: 'Our latest job', accent: '#c9a24d' };
  const body = { idempotency_key: crypto.randomUUID(), spec };
  assert.equal((await B('POST', '/api/saas/reels', body)).status, 400, 'another business cannot use these photos');
  let r = await A('POST', '/api/saas/reels', body); assert.equal(r.status, 202, JSON.stringify(r.json));
  assert.equal((await A('POST', '/api/saas/reels', body)).json.replayed, true);
  assert.equal((await A('POST', '/api/saas/reels', { ...body, spec: { ...spec, hook: 'Changed' } })).status, 409);
  assert.equal((await A('POST', '/api/saas/reels', { ...body, workspace_id: b.org })).status, 400);
  assert.deepEqual((await B('GET', '/api/saas/reels')).json.reels, []);
  const started = Date.now(); let reel;
  for (let i = 0; i < 600; i++) { reel = (await A('GET', '/api/saas/reels')).json.reels[0]; if (!['queued', 'processing'].includes(reel.status)) break; await new Promise((x) => setTimeout(x, 300)); }
  assert.equal(reel.status, 'succeeded', reel.error + '\n' + s.log().slice(-1500));
  if (process.env.KEEP_REEL) fs.copyFileSync(path.join(dir, db.prepare('SELECT stored_name FROM tenant_media WHERE id=?').get(reel.media_id).stored_name), process.env.KEEP_REEL);
  console.log(`reel rendered in ${((Date.now() - started) / 1000).toFixed(1)}s, ${reel.seconds}s long`);
  const m = db.prepare('SELECT * FROM tenant_media WHERE id=?').get(reel.media_id); assert.equal(m.source, 'reel'); assert.equal(m.kind, 'video');
  const info = await probe(path.join(dir, m.stored_name)); assert.equal(info.width, 720); assert.equal(info.height, 1280); assert.ok(info.audio); assert.ok(Math.abs(info.seconds - reel.seconds) < 0.5, `${info.seconds} vs ${reel.seconds}`);
  assert.equal(reel.caption, 'Our latest job');
  assert.equal((await B('GET', reel.preview_url)).status, 404);
  // Square reel without end card, logo or audio.
  r = await A('POST', '/api/saas/reels', { idempotency_key: crypto.randomUUID(), spec: { ...spec, aspect_ratio: '1:1', items: [{ media_id: tall }], logo_media_id: null, audio: null, end_card: false } }); assert.equal(r.status, 202);
  for (let i = 0; i < 300; i++) { reel = (await A('GET', '/api/saas/reels')).json.reels.find((x) => x.id === r.json.reel.id); if (!['queued', 'processing'].includes(reel.status)) break; await new Promise((x) => setTimeout(x, 300)); }
  assert.equal(reel.status, 'succeeded', reel.error);
  const sq = await probe(path.join(dir, db.prepare('SELECT stored_name FROM tenant_media WHERE id=?').get(reel.media_id).stored_name)); assert.equal(sq.width, sq.height);
  assert.equal((await A('DELETE', `/api/saas/reels/${reel.id}`)).status, 200);
  assert.ok(db.prepare('SELECT 1 FROM tenant_media WHERE id=?').get(reel.media_id), 'clearing a reel keeps the video in the library');
});
