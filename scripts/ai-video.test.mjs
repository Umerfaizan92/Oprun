// T-185: AI Video Generator. Each business connects its own Google (Gemini API) or Runway key; Oprun starts the
// video, follows it in the background and saves the finished MP4 into the private media library. Real providers
// cannot be reached from the test machine, so a local stand-in answers like them.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(200, 7)]);

async function mock() {
  const calls = []; let googlePolls = 0, runwayPolls = 0;
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
      calls.push({ path: req.url, method: req.method, headers: req.headers, body: body ? JSON.parse(body) : null });
      const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url.startsWith('/g/v1beta/models')) return req.headers['x-goog-api-key'] === 'AIza-good-key-123456789' ? send(200, { models: [] }) : send(400, { error: { message: 'API key not valid.' } });
      if (req.url === '/g/v1beta/interactions' && req.method === 'POST') return send(200, { id: 'int-1', status: 'in_progress' });
      if (req.url === '/g/v1beta/interactions/int-1') { googlePolls += 1; return googlePolls < 2 ? send(200, { id: 'int-1', status: 'in_progress' }) : send(200, { id: 'int-1', status: 'completed', steps: [{ type: 'user_input' }, { type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: MP4.toString('base64') }] }] }); }
      if (req.url === '/r/v1/organization') return req.headers.authorization === 'Bearer key_runway_good_1234567890' ? send(200, { creditBalance: 100 }) : send(401, { error: 'Invalid API key' });
      if (req.url === '/r/v1/text_to_video' || req.url === '/r/v1/image_to_video') return send(200, { id: req.url.includes('image') ? 'task-img' : 'task-1' });
      if (req.url === '/r/v1/tasks/task-1') { runwayPolls += 1; return send(200, runwayPolls < 2 ? { id: 'task-1', status: 'RUNNING' } : { id: 'task-1', status: 'SUCCEEDED', output: [`${base}/files/out.mp4`] }); }
      if (req.url === '/r/v1/tasks/task-img') return send(200, { id: 'task-img', status: 'FAILED', failure: 'Content moderation: the image was not accepted.', failureCode: 'SAFETY.INPUT.IMAGE' });
      if (req.url === '/files/out.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(MP4); }
      send(404, { message: 'unknown' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise((r) => server.close(r)) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('AI video: own keys, AI prompt, generate in the background, save to the library, preview and isolate', async (t) => {
  const m = await mock();
  const s = await startServer({ GEMINI_API_BASE_URL: m.base + '/g', RUNWAY_API_BASE_URL: m.base + '/r', AI_VIDEO_TEST_DOWNLOAD: '1', AI_VIDEO_POLL_MS: '2000' });
  t.after(async () => { await s.stop(); await m.close(); });
  const owner = await seedOwner(s, { business: 'Harbour Plumbing' });
  const O = (meth, u, b) => s.call(meth, u, { cookie: owner.cookie, body: b });

  let r = await O('GET', '/api/saas/ai-video');
  assert.equal(r.status, 200, r.text); assert.equal(r.json.providers.google.connected, false);
  assert.ok(r.json.engines.some((e) => e.id === 'google:gemini-omni-1.2-flash'));
  assert.ok(!r.json.engines.some((e) => /sora/i.test(e.id)), 'Sora is not offered (its API is closing)');

  // Generating before a key is connected is refused clearly.
  r = await O('POST', '/api/saas/ai-video/jobs', { engine: 'google:gemini-omni-1.2-flash', prompt: 'A plumber fixes a kitchen tap in warm morning light.', aspect_ratio: '9:16', resolution: '1080p', duration: 8 });
  assert.equal(r.status, 409); assert.match(r.json.error, /Connect your Google/);

  // A wrong key is refused and nothing is stored; the right one is stored encrypted and never sent back.
  r = await O('POST', '/api/saas/ai-video/providers/google', { api_key: 'AIza-bad-key-1234567890' });
  assert.equal(r.status, 400); assert.match(r.json.error, /did not accept this key/);
  r = await O('POST', '/api/saas/ai-video/providers/google', { api_key: 'AIza-good-key-123456789' });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.providers.google.connected, true); assert.equal(r.json.providers.google.key_hint, '…6789');
  assert.ok(!JSON.stringify(r.json).includes('AIza-good-key-123456789'));
  assert.ok(!new Database(s.dbPath).prepare('SELECT secret_bundle FROM ai_video_providers').get().secret_bundle.includes('AIza-good'), 'stored encrypted');
  r = await O('POST', '/api/saas/ai-video/providers/runway', { api_key: 'key_runway_good_1234567890' });
  assert.equal(r.status, 200, r.text);

  // AI prompt director always returns a usable prompt (falls back to a template when no AI provider is set).
  r = await O('POST', '/api/saas/ai-video/enhance', { idea: 'tap repair before and after', aspect_ratio: '9:16', duration: 8 });
  assert.equal(r.status, 200, r.text); assert.ok(r.json.prompt.length > 60); assert.match(r.json.prompt, /tap repair/);

  // Engine limits are checked before anything is sent.
  r = await O('POST', '/api/saas/ai-video/jobs', { engine: 'runway:veo3.1', prompt: 'A plumber fixes a kitchen tap in warm morning light.', aspect_ratio: '16:9', resolution: '4k', duration: 8 });
  assert.equal(r.status, 400); assert.match(r.json.error, /720p/);
  r = await O('POST', '/api/saas/ai-video/jobs', { engine: 'runway:veo3.1', prompt: 'A plumber fixes a kitchen tap in warm morning light.', aspect_ratio: '16:9', resolution: '720p', duration: 12 });
  assert.equal(r.status, 400); assert.match(r.json.error, /4 to 8 seconds/);

  // Google: starts in the background with the chosen shape, resolution and length.
  r = await O('POST', '/api/saas/ai-video/jobs', { engine: 'google:gemini-omni-1.2-flash', idea: 'tap repair', prompt: 'A plumber fixes a kitchen tap in warm morning light.', aspect_ratio: '9:16', resolution: '1080p', duration: 8 });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.job.status, 'running');
  const gid = r.json.job.id;
  const gStart = m.calls.find((c) => c.path === '/g/v1beta/interactions');
  assert.equal(gStart.headers['x-goog-api-key'], 'AIza-good-key-123456789');
  assert.equal(gStart.body.model, 'gemini-omni-1.2-flash'); assert.equal(gStart.body.background, true);
  assert.deepEqual(gStart.body.response_format, { type: 'video', aspect_ratio: '9:16', resolution: '1080p', duration: '8s' });

  // Runway: text to video with the right ratio and version header.
  r = await O('POST', '/api/saas/ai-video/jobs', { engine: 'runway:veo3.1', prompt: 'Drone shot over a sunny suburb, then a plumber van arrives.', aspect_ratio: '16:9', resolution: '720p', duration: 8 });
  assert.equal(r.status, 201, r.text); const rid = r.json.job.id;
  const rStart = m.calls.find((c) => c.path === '/r/v1/text_to_video');
  assert.equal(rStart.headers.authorization, 'Bearer key_runway_good_1234567890'); assert.equal(rStart.headers['x-runway-version'], '2024-11-06');
  assert.deepEqual(rStart.body, { model: 'veo3.1', promptText: 'Drone shot over a sunny suburb, then a plumber van arrives.', ratio: '1280:720', duration: 8 });

  // The page refreshes the jobs; the background follow-up finishes them and saves real MP4 files.
  let jobs;
  for (let i = 0; i < 20; i++) {
    await wait(1200);
    await O('POST', `/api/saas/ai-video/jobs/${gid}/refresh`); await O('POST', `/api/saas/ai-video/jobs/${rid}/refresh`);
    jobs = (await O('GET', '/api/saas/ai-video')).json.jobs;
    if (jobs.filter((j) => j.status === 'succeeded').length === 2) break;
  }
  for (const id of [gid, rid]) { const j = jobs.find((x) => x.id === id); assert.equal(j.status, 'succeeded', JSON.stringify(j)); assert.ok(j.media_id); }
  const media = (await O('GET', '/api/saas/media')).json.media.filter((x) => x.source === 'ai-video');
  assert.equal(media.length, 2); assert.equal(media[0].kind, 'video'); assert.match(media.find((x) => x.original_name.includes('tap repair')).original_name, /^AI video – tap repair\.mp4$/);
  const file = await fetch(`${s.base}/api/saas/media/${jobs.find((x) => x.id === gid).media_id}/file`, { headers: { cookie: owner.cookie, origin: s.base, range: 'bytes=0-15' } });
  assert.equal(file.status, 206, 'supports seeking in the player'); assert.match(file.headers.get('content-type'), /video\/mp4/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), MP4.subarray(0, 16));

  // A refused starting image fails with the provider's reason, and it can be cleared from the list.
  const db = new Database(s.dbPath);
  db.prepare("INSERT INTO tenant_media (id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,created_at) VALUES ('ph1',?,'van.jpg','missing.jpg','image/jpeg','photo',10,?)").run(owner.org, new Date().toISOString());
  r = await O('POST', '/api/saas/ai-video/jobs', { engine: 'runway:gen4.5', prompt: 'The van drives away down a leafy street.', aspect_ratio: '16:9', resolution: '720p', duration: 5, source_media_id: 'ph1' });
  assert.equal(r.status, 400); assert.match(r.json.error, /missing from storage/);

  // Another business sees none of it and cannot touch it.
  const other = await seedOwner(s, { business: 'Other Co', email: 'other-aivideo@other.example.test' });
  const X = (meth, u, b) => s.call(meth, u, { cookie: other.cookie, body: b });
  r = await X('GET', '/api/saas/ai-video'); assert.equal(r.json.jobs.length, 0); assert.equal(r.json.providers.google.connected, false);
  assert.equal((await X('POST', `/api/saas/ai-video/jobs/${gid}/refresh`)).status, 404);
  assert.equal((await X('DELETE', `/api/saas/ai-video/jobs/${gid}`)).status, 404);

  // Clearing a finished job keeps the video in the library; disconnecting removes the key.
  assert.equal((await O('DELETE', `/api/saas/ai-video/jobs/${gid}`)).status, 200);
  assert.equal((await O('GET', '/api/saas/media')).json.media.filter((x) => x.source === 'ai-video').length, 2);
  r = await O('DELETE', '/api/saas/ai-video/providers/google'); assert.equal(r.json.providers.google.connected, false);
});
