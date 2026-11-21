// T-190: long AI videos made from several clips, guided by the business's own photos and videos, with the
// person's own voice. Providers are local stand-ins; FFmpeg is real (it joins the clips and adds the voice).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { ffmpegPath, probe } from '../src/media-tools.js';

const bin = ffmpegPath();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aivp-'));
const make = (name, args) => { const f = path.join(tmp, name); execFileSync(bin, ['-y', '-loglevel', 'error', ...args, f]); return f; };
const clips=new Map();
const clipFor=seconds=>{
  if(!clips.has(seconds))clips.set(seconds,fs.readFileSync(make(`clip-${seconds}.mp4`, ['-f','lavfi','-i','testsrc2=size=360x640:rate=24','-f','lavfi','-i','sine=f=330','-t',String(seconds),'-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast','-crf','38','-c:a','aac'])));
  return clips.get(seconds);
};
const PHOTO = fs.readFileSync(make('face.jpg', ['-f', 'lavfi', '-i', 'testsrc=size=320x320', '-frames:v', '1']));
const CAM = fs.readFileSync(make('cam.webm', ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15', '-t', '2', '-c:v', 'libvpx', '-b:v', '200k']));
const VOICE = fs.readFileSync(make('voice.webm', ['-f', 'lavfi', '-i', 'sine=f=200', '-t', '20', '-c:a', 'libopus', '-live', '1']));
const TTS = fs.readFileSync(make('tts.mp3', ['-f', 'lavfi', '-i', 'sine=f=500', '-t', '7']));

async function mock() {
  const calls = [], tasks=new Map(); let n = 0, failNext = false;
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
      const raw = Buffer.concat(chunks); let body = null; try { body = JSON.parse(raw.toString()); } catch { body = raw.length ? { raw: raw.length } : null; }
      calls.push({ method: req.method, path: req.url, body, headers: req.headers });
      const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url.startsWith('/g/v1beta/models')) return send(200, { models: [] });
      if (req.url === '/g/v1beta/interactions') { n += 1; if(failNext){failNext=false;return send(400,{error:{message:'Quota exceeded'}})}tasks.set(`int-${n}`,clipFor(parseInt(body.response_format.duration,10)));return send(200,{id:`int-${n}`,status:'in_progress'}); }
      if (/^\/g\/v1beta\/interactions\/int-\d+$/.test(req.url)) return send(200, { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: tasks.get(req.url.split('/').at(-1)).toString('base64') }] }] });
      if (req.url === '/e/v1/user') return req.headers['xi-api-key'] === 'el_key_1234567890abcdef' ? send(200, { user_id: 'u' }) : send(401, { detail: { message: 'Invalid API key' } });
      if (req.url === '/e/v1/voices/add') return send(200, { voice_id: 'voice-abc' });
      if (req.url.startsWith('/e/v1/text-to-speech/voice-abc')) { res.writeHead(200, { 'content-type': 'audio/mpeg' }); return res.end(TTS); }
      send(404, {});
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, calls, failOnce: () => { failNext = true; }, close: () => new Promise((r) => server.close(r)) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('long AI video: clips planned, continued from the last frame, joined; own photos, camera video and own voice', async (t) => {
  const m = await mock();
  const s = await startServer({ GEMINI_API_BASE_URL: m.base + '/g', ELEVENLABS_API_BASE_URL: m.base + '/e', AI_VIDEO_POLL_MS: '2000', AI_VIDEO_RATE_LIMIT: '200' });
  t.after(async () => { await s.stop(); await m.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const owner = await seedOwner(s, { business: 'Fleet Parlour' });
  const O = (meth, u, b) => s.call(meth, u, { cookie: owner.cookie, body: b });
  const upload = async (buf, type, name) => { const fd = new FormData(); fd.append('files', new Blob([buf], { type }), name); const r = await fetch(`${s.base}/api/saas/media`, { method: 'POST', headers: { cookie: owner.cookie, origin: s.base }, body: fd }); assert.equal(r.status, 201); return (await r.json()).ids[0]; };
  const until = async (id, want, tries = 40) => { let p; for (let i = 0; i < tries; i++) { p = (await O('POST', `/api/saas/ai-video/projects/${id}/refresh`)).json.project; if (want.includes(p.status)) return p; await wait(700); } return p; };

  assert.equal((await O('POST', '/api/saas/ai-video/providers/google', { api_key: 'AIza-key-1234567890abcdef' })).status, 200);
  let r = await O('GET', '/api/saas/ai-video');
  assert.equal(r.json.joining_available, true); assert.equal(r.json.max_seconds, 86400); assert.equal(r.json.providers.elevenlabs.kind, 'voice');

  // Own photo, and a camera recording (WebM) turned into an MP4 in place.
  const face = await upload(PHOTO, 'image/jpeg', 'me.jpg');
  const cam = await upload(CAM, 'video/webm', 'Camera recording.webm');
  r = await O('POST', `/api/saas/ai-video/media/${cam}/mp4`); assert.equal(r.status, 201, r.text); assert.equal(r.json.media_id, cam);
  const camRow = (await O('GET', '/api/saas/media')).json.media.find((x) => x.id === cam);
  assert.equal(camRow.mime_type, 'video/mp4'); assert.equal(camRow.original_name, 'Camera recording.mp4');

  // 40 seconds with 15-second clips = 3 clips, each later clip continues from the previous one's last frame.
  r = await O('POST', '/api/saas/ai-video/projects', { engine: 'google:gemini-omni-1.2-flash', idea: 'Me explaining our bull bar polishing, then the finished shine', aspect_ratio: '9:16', resolution: '1080p', total_seconds: 40, reference_media_ids: [face, cam] });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.project.clips_total, 3); assert.equal(r.json.project.clip_seconds, 15);
  const first = m.calls.find((c) => c.path === '/g/v1beta/interactions');
  assert.equal(first.body.input.filter((x) => x.type === 'image').length, 2, 'the photo and a frame from the camera video guide the first clip');
  assert.equal(first.body.response_format.duration, '15s');
  let p = await until(r.json.project.id, ['succeeded', 'failed']);
  assert.equal(p.status, 'succeeded', JSON.stringify(p));
  const starts = m.calls.filter((c) => c.path === '/g/v1beta/interactions');
  assert.equal(starts.length, 3);
  assert.equal(starts[1].body.input.filter((x) => x.type === 'image').length, 3, 'later clips add the last frame of the clip before');
  assert.match(starts[2].body.input.at(-1).text, /Part 3 of 3/);
  const lib = (await O('GET', '/api/saas/media')).json.media;
  const final = lib.find((x) => x.id === p.media_id);
  assert.equal(final.kind, 'video'); assert.match(final.original_name, /^AI video – Me explaining/);
  const dl = await fetch(`${s.base}/api/saas/media/${p.media_id}/file`, { headers: { cookie: owner.cookie, origin: s.base } });
  const out = path.join(tmp, 'final.mp4'); fs.writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
  const info = await probe(out); assert.ok(Math.abs(info.seconds-40)<0.2, 'one full video matches the requested 40 seconds: ' + info.seconds); assert.equal(info.width, 360);
  assert.equal(lib.filter((x) => x.source === 'ai-video').length, 1, 'clips are not added to the library one by one');

  // Own voice: an ElevenLabs clone needs a key and consent; the script becomes a voice-over and sets the length.
  assert.equal((await O('POST', '/api/saas/ai-video/providers/elevenlabs', { api_key: 'el_bad_1234567890abcdef' })).status, 400);
  assert.equal((await O('POST', '/api/saas/ai-video/providers/elevenlabs', { api_key: 'el_key_1234567890abcdef' })).status, 200);
  const sample = await upload(VOICE, 'audio/webm', 'my voice.weba');
  // Browser recordings have no duration header: Generate must still start and
  // finish the requested two-shot video with the uploaded voice attached.
  r = await O('POST', '/api/saas/ai-video/projects', { engine: 'google:gemini-omni-1.2-flash', idea: 'Show our polishing process with my recorded explanation', aspect_ratio: '9:16', total_seconds: 30, clip_seconds: 15, narration_media_id: sample, reference_media_ids: [cam] });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.project.clips_total, 2);
  assert.equal(r.json.project.narration_media_id, sample);
  p = await until(r.json.project.id, ['succeeded', 'failed']);
  assert.equal(p.status, 'succeeded', JSON.stringify(p));
  assert.equal((await O('POST', '/api/saas/ai-video/voices', { media_id: sample, name: 'Faizan', consent: false })).status, 400);
  r = await O('POST', '/api/saas/ai-video/voices', { media_id: sample, name: 'Faizan', consent: true });
  assert.equal(r.status, 201, r.text); const voice = r.json.voice.id;
  assert.ok(m.calls.find((c) => c.path === '/e/v1/voices/add').body.raw > 1000, 'the sample is sent to ElevenLabs');
  r = await O('POST', '/api/saas/ai-video/projects', { engine: 'google:gemini-omni-1.2-flash', idea: 'Welcome to Fleet Parlour, shot in our workshop', aspect_ratio: '9:16', resolution: '720p', clip_seconds: 5, voice_id: voice, script: 'Welcome to Fleet Parlour. We polish bull bars until they shine.', reference_media_ids: [face] });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.project.clips_total, 2, 'a 7-second voice-over with 5-second clips needs 2 clips');
  const tts = m.calls.find((c) => c.path.startsWith('/e/v1/text-to-speech/voice-abc'));
  assert.equal(tts.body.model_id, 'eleven_multilingual_v2'); assert.equal(tts.headers['xi-api-key'], 'el_key_1234567890abcdef');
  p = await until(r.json.project.id, ['succeeded', 'failed']); assert.equal(p.status, 'succeeded', JSON.stringify(p));
  const v = await fetch(`${s.base}/api/saas/media/${p.media_id}/file`, { headers: { cookie: owner.cookie, origin: s.base } });
  const vo = path.join(tmp, 'voiced.mp4'); fs.writeFileSync(vo, Buffer.from(await v.arrayBuffer()));
  const vi = await probe(vo); assert.ok(vi.audio && vi.seconds >= 6.9, 'the picture runs as long as the voice: ' + vi.seconds);
  assert.ok((await O('GET', '/api/saas/media')).json.media.some((x) => x.source === 'ai-voice'), 'the voice-over is kept in the library');

  // A clip that fails stops the video; Continue makes only the missing clips.
  m.failOnce();
  r = await O('POST', '/api/saas/ai-video/projects', { engine: 'google:gemini-omni-1.2-flash', idea: 'A short product reveal of our polish kit', aspect_ratio: '16:9', resolution: '720p', total_seconds: 6, clip_seconds: 3 });
  assert.equal(r.status, 502); assert.match(r.json.error, /Quota exceeded/);
  const stopped = (await O('GET', '/api/saas/ai-video')).json.projects.find((x) => x.status === 'failed');
  assert.ok(stopped);
  r = await O('POST', `/api/saas/ai-video/projects/${stopped.id}/continue`); assert.equal(r.status, 200, r.text);
  p = await until(stopped.id, ['succeeded', 'failed']); assert.equal(p.status, 'succeeded', JSON.stringify(p));

  // Custom full lengths are accepted without the former 40-part ceiling.
  for(const seconds of [60,300,600,1800]){
    const before=m.calls.filter(c=>c.path==='/g/v1beta/interactions').length;
    r=await O('POST','/api/saas/ai-video/projects',{engine:'google:gemini-omni-1.2-flash',idea:'A continuous tour of the completed work',aspect_ratio:'9:16',total_seconds:seconds,clip_seconds:3});
    assert.equal(r.status,201,r.text);assert.equal(r.json.project.requested_seconds,seconds);assert.equal(r.json.project.clips_total,Math.ceil(seconds/3));
    const id=r.json.project.id;
    assert.equal((await O('POST',`/api/saas/ai-video/projects/${id}/finish`)).status,200);
    assert.equal((await O('POST',`/api/saas/ai-video/projects/${id}/finish`)).status,200);
    const ended=await until(id,['succeeded','failed']);assert.equal(ended.status,'succeeded',JSON.stringify(ended));
    assert.ok(ended.total_seconds>=2.9&&ended.total_seconds<3.2,'explicit early finish keeps one playable video');
    assert.equal(m.calls.filter(c=>c.path==='/g/v1beta/interactions').length,before+1,'no paid continuation after Finish');
  }
  const unlimited={engine:'google:gemini-omni-1.2-flash',idea:'Keep showing our work in one continuous video',aspect_ratio:'9:16',duration_mode:'continuous'};
  assert.equal((await O('POST','/api/saas/ai-video/projects',unlimited)).status,400,'ongoing billing needs explicit consent');
  r=await O('POST','/api/saas/ai-video/projects',{...unlimited,continuous_consent:true});assert.equal(r.status,201,r.text);const ongoing=r.json.project.id;
  for(let i=0;i<30;i++){const q=(await O('POST',`/api/saas/ai-video/projects/${ongoing}/refresh`)).json.project;if(q.produced_seconds>=14.9)break;await wait(400)}
  const beforeFinish=m.calls.filter(c=>c.path==='/g/v1beta/interactions').length;
  assert.equal((await O('POST',`/api/saas/ai-video/projects/${ongoing}/finish`)).status,200);
  const ended=await until(ongoing,['succeeded','failed']);assert.equal(ended.status,'succeeded',JSON.stringify(ended));assert.equal(ended.stop_requested,true);
  assert.ok(ended.total_seconds>=29.9&&ended.total_seconds<30.2,'current generation finishes into one full video');
  assert.equal(m.calls.filter(c=>c.path==='/g/v1beta/interactions').length,beforeFinish,'Finish does not create another billable request');
  const roleDb=new Database(s.dbPath);
  roleDb.prepare("UPDATE memberships SET role='manager' WHERE organisation_id=? AND user_id=?").run(owner.org,owner.uid);
  assert.equal((await O('POST','/api/saas/ai-video/projects',{...unlimited,continuous_consent:true})).status,403,'unlimited spending is owner/admin only');
  roleDb.prepare("UPDATE memberships SET role='owner' WHERE organisation_id=? AND user_id=?").run(owner.org,owner.uid);
  // A process interruption must never silently retry a request that may have
  // been paid for. The owner is told to inspect the provider account first.
  r=await O('POST','/api/saas/ai-video/projects',{...unlimited,continuous_consent:true});const interrupted=r.json.project.id;
  roleDb.prepare("UPDATE ai_video_jobs SET status='queued',provider_task_id=NULL,created_at=? WHERE project_id=?").run(new Date(Date.now()-10*60_000).toISOString(),interrupted);
  const paidBefore=m.calls.filter(c=>c.path==='/g/v1beta/interactions').length;
  const interruptedState=(await O('POST',`/api/saas/ai-video/projects/${interrupted}/refresh`)).json.project;
  assert.equal(interruptedState.status,'failed');assert.match(interruptedState.error,/Check your provider account/);
  assert.equal(m.calls.filter(c=>c.path==='/g/v1beta/interactions').length,paidBefore);
  roleDb.prepare("UPDATE memberships SET role='manager' WHERE organisation_id=? AND user_id=?").run(owner.org,owner.uid);
  assert.equal((await O('POST',`/api/saas/ai-video/projects/${interrupted}/continue`)).status,403,'a manager cannot resume unlimited billing through Continue');
  roleDb.prepare("UPDATE memberships SET role='owner' WHERE organisation_id=? AND user_id=?").run(owner.org,owner.uid);roleDb.close();
  assert.equal((await O('POST','/api/saas/ai-video/projects',{...unlimited,duration_mode:'fixed',total_seconds:86401})).status,400);
  const other = await seedOwner(s, { business: 'Other Co', email: 'other-aivp@other.example.test' });
  const X = (meth, u, b) => s.call(meth, u, { cookie: other.cookie, body: b });
  assert.equal((await X('GET', '/api/saas/ai-video')).json.projects.length, 0);
  assert.equal((await X('POST', `/api/saas/ai-video/projects/${stopped.id}/refresh`)).status, 404);
  assert.equal((await X('POST', `/api/saas/ai-video/projects/${ongoing}/finish`)).status, 404);
  assert.equal((await X('POST', `/api/saas/ai-video/voices/${voice}/speak`, { text: 'hello there' })).status, 404);
  assert.equal((await X('POST', `/api/saas/ai-video/media/${cam}/mp4`)).status, 400);
  // Clearing a finished video keeps it in the library.
  assert.equal((await O('DELETE', `/api/saas/ai-video/projects/${stopped.id}`)).status, 200);
  assert.ok((await O('GET', '/api/saas/media')).json.media.some((x) => x.id === p.media_id));
  const bounded=await startServer({GEMINI_API_BASE_URL:m.base+'/g',AI_VIDEO_POLL_MS:'2000',AI_VIDEO_PROJECT_MAX_BYTES:'1'});
  try{
    const bo=await seedOwner(bounded);const B=(method,url,body)=>bounded.call(method,url,{cookie:bo.cookie,body});
    await B('POST','/api/saas/ai-video/providers/google',{api_key:'AIza-key-1234567890abcdef'});
    const before=m.calls.filter(c=>c.path==='/g/v1beta/interactions').length;
    const made=await B('POST','/api/saas/ai-video/projects',{...unlimited,continuous_consent:true});let ended;
    for(let i=0;i<40;i++){ended=(await B('POST',`/api/saas/ai-video/projects/${made.json.project.id}/refresh`)).json.project;if(['succeeded','failed'].includes(ended.status))break;await wait(400)}
    assert.equal(ended.status,'succeeded',JSON.stringify(ended));assert.equal(ended.completion_reason,'storage_limit');
    assert.equal(m.calls.filter(c=>c.path==='/g/v1beta/interactions').length,before+1,'storage budget stops paid continuations and finalizes available footage');
  }finally{await bounded.stop()}
});
