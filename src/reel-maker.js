// T-197: free Reel Maker. Turns a business's own photos and video clips into a professional social reel on Oprun's
// own server (FFmpeg on CPU): blurred-fill framing for any photo shape, slow zoom on photos, a hook in the first
// seconds, a title, feature lines, smooth cross-fades, the business's own voice or music, and a branded end card.
// No AI service and no per-video charge: the words come from templates filled with the business's own details, and
// nothing is invented (no prices, offers, reviews or claims the business did not type itself).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { probe, runMediaTool, writePrivateFile, copyPrivateFile, ffmpegPath } from './media-tools.js';
import { verifyStudioMedia } from './studio-media-safety.js';

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'fonts');
const F = { hook: path.join(FONTS, 'Anton-Regular.ttf'), bold: path.join(FONTS, 'Poppins-ExtraBold.ttf'), semi: path.join(FONTS, 'Poppins-SemiBold.ttf') };
const SIZES = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };
const XF = 0.35; // cross-fade seconds
const STAFF = ['owner', 'admin', 'manager', 'super_admin', 'director'];

export const TEMPLATES = {
  before_after: { label: 'Before and after', hint: 'First the “before” photos, then the “after”.', tags: ['beforeandafter', 'transformation'] },
  showcase: { label: 'Show our work', hint: 'Your best photos and clips of a job or product.', tags: ['showcase', 'craftsmanship'] },
  how_we_do_it: { label: 'How we do it', hint: 'Steps of the job in order.', tags: ['process', 'behindthescenes'] },
  offer: { label: 'Special offer', hint: 'Only the offer you type is shown. Nothing is made up.', tags: ['specialoffer'] },
  meet_us: { label: 'Meet the business', hint: 'You, your team, your place.', tags: ['smallbusiness', 'meettheteam'] },
  tips: { label: 'Quick tips', hint: 'Each tip you type becomes one scene.', tags: ['tips', 'howto'] },
  review: { label: 'Customer review', hint: 'Paste a real review with the customer’s permission.', tags: ['customerreview', 'happycustomer'] },
};

const clean = (v, n = 120) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const tag = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').slice(0, 30);

/** Free copywriting from templates and the business's own details. Returns options the person edits before rendering. */
export function planCopy(profile = {}, input = {}) {
  const business = clean(profile.display_name || profile.name || 'our business', 60);
  let list = profile.services; try { if (typeof list === 'string' && list.trim().startsWith('[')) list = JSON.parse(list); } catch { /* plain text */ }
  const services = (Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x : x?.name || '')) : String(list || '').split(/[,;\n]+/)).map((x) => clean(x, 50)).filter(Boolean);
  const mid = (x) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x); // “Deck restoration” reads “deck restoration” mid-sentence; “HVAC” stays
  const service = mid(clean(input.service, 50) || services[0] || clean(profile.business_type, 50) || 'our work');
  const area = clean(profile.service_area || profile.city || '', 40);
  const offer = clean(input.offer, 90), quote = clean(input.quote, 220), idea = clean(input.idea, 160);
  const t = TEMPLATES[input.template] ? input.template : 'showcase';
  const where = area ? ` in ${area}` : '';
  const hooks = {
    before_after: [`Before vs after: ${service}`, `Watch this ${service} transformation`, 'From this… to this'],
    showcase: [`${cap(service)}, done properly`, `This is what we do at ${business}`, `Our latest ${service} job${where}`],
    how_we_do_it: [`How we do ${service}`, `Behind the scenes: ${service}`, `Step by step: ${service}`],
    offer: offer ? [offer, `Now on: ${offer}`, `${cap(service)}: ${offer}`] : [`${cap(service)} at ${business}`, `Book ${service}${where}`, `${cap(service)} you can count on`],
    meet_us: [`Meet ${business}`, `Your local ${clean(profile.business_type, 40) || service} team${where}`, `Who we are at ${business}`],
    tips: [`${input.features?.length || 3} quick tips about ${service}`, `Know this before you book ${service}`, `${cap(service)} tips from ${business}`],
    review: quote ? ['What our customer said', `Real words from a ${business} customer`, 'Our customer’s review'] : ['What our customers say', `Why people choose ${business}`, `Thank you to our customers`],
  }[t].map((h) => clean(h, 70));
  const typed = (Array.isArray(input.features) ? input.features : []).map((f) => clean(f, 70)).filter(Boolean).slice(0, 5);
  const features = typed.length ? typed : t === 'review' && quote ? [`“${quote}”`] : services.slice(0, 3).map(cap);
  const title = clean(input.title, 70) || (t === 'before_after' ? `${cap(service)} by ${business}` : `${business}${where ? ' ·' + where.replace(' in', '') : ''}`);
  const cta = clean(input.cta, 60) || (t === 'offer' && offer ? 'Message us to claim it' : `Book your ${service} today`);
  const hashtags = [...new Set([tag(business), tag(service), area && tag(area), ...TEMPLATES[t].tags, 'smallbusiness'].filter((x) => x && x.length > 2))].slice(0, 8).map((x) => '#' + x);
  const caption = [hooks[0], idea || (features.length ? features.join(' · ') : ''), `${cta}.${profile.phone ? ' Call ' + clean(profile.phone, 30) + '.' : ''}${profile.website ? ' ' + clean(profile.website, 80) : ''}`, hashtags.join(' ')].filter(Boolean).join('\n\n');
  return { template: t, hooks, hook: hooks[0], title, features, cta, phone: clean(profile.phone, 30), website: clean(profile.website, 80), business, caption, hashtags };
}

// Text is placed with FFmpeg's drawtext from files (no shell, no escaping problems). Lines are wrapped here.
function wrap(text, maxChars, maxLines = 3) {
  const words = clean(text, 400).split(' '), lines = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '') + '…'; return keep; }
  return lines;
}
const hex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : '#c9a24d';
const lum = (c) => { const [r, g, b] = hex(c).slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ffc = (c) => '0x' + hex(c).slice(1);

/** JPEG EXIF orientation (1-8), so phone photos are never sideways. */
export function jpegOrientation(file) {
  try {
    const b = fs.readFileSync(file); if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
    let i = 2;
    while (i + 4 < b.length && b[i] === 0xff) {
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker === 0xe1 && b.toString('ascii', i + 4, i + 8) === 'Exif') {
        const t = i + 10, le = b.toString('ascii', t, t + 2) === 'II', u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o)), u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
        const ifd = t + u32(t + 4), n = u16(ifd);
        for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (u16(e) === 0x0112) return u16(e + 8) || 1; }
        return 1;
      }
      if (marker === 0xda) break; i += 2 + len;
    }
  } catch { /* not a readable JPEG */ }
  return 1;
}
const ORIENT = { 2: 'hflip', 3: 'hflip,vflip', 4: 'vflip', 5: 'transpose=0', 6: 'transpose=1', 7: 'transpose=3', 8: 'transpose=2' };

function textFilters(dir, id, W, H, blocks) {
  const out = []; let n = 0;
  for (const b of blocks) {
    const lines = b.lines.filter(Boolean); const lh = Math.round(b.size * (b.lineGap || 1.18));
    lines.forEach((line, i) => {
      const f = path.join(dir, `${id}-t${n++}.txt`); writePrivateFile(f, line);
      const y0 = Math.round(b.y + i * lh), a = b.at || 0.15;
      const alpha = `if(lt(t,${a}),0,if(lt(t,${a + 0.45}),(t-${a})/0.45,1))`;
      const y = b.slide ? `${y0}+${Math.round(b.size * 0.4)}*(1-min(1,max(0,(t-${a})/0.45)))` : String(y0);
      out.push(`drawtext=fontfile=${b.font}:textfile=${f}:expansion=none:fontsize=${b.size}:fontcolor=${b.color || 'white'}:alpha='${alpha}':x=(w-tw)/2:y='${y}'` +
        (b.box ? `:box=1:boxcolor=${b.box}:boxborderw=${Math.round(b.size * 0.32)}` : '') + (b.border ? `:borderw=${b.border}:bordercolor=black@0.85` : '') + (b.shadow ? `:shadowx=0:shadowy=${Math.round(b.size * 0.06)}:shadowcolor=black@0.6` : ''));
    });
  }
  return out;
}

export function installReelMaker(app, { db, env = {}, uploadRoot, queue, requireSaasUser, requireSaasRole, saasAudit }) {
  db.exec(`CREATE TABLE IF NOT EXISTS reel_jobs (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, spec_json TEXT NOT NULL,
    status TEXT NOT NULL, media_id TEXT, error TEXT, seconds REAL, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organisation_id, idempotency_key));
    CREATE INDEX IF NOT EXISTS reel_jobs_org ON reel_jobs(organisation_id, created_at);`);
  const gate = [requireSaasUser, requireSaasRole(...STAFF)], org = (r) => r.saas.organisation_id, iso = () => new Date().toISOString();
  const fail = (res, s, e) => res.status(s).json({ ok: false, error: e });
  const media = (o, id) => db.prepare('SELECT * FROM tenant_media WHERE organisation_id=? AND id=?').get(o, id);
  const stored = (o, name) => { if (path.basename(name) !== name) throw Error('Invalid media path'); return path.join(uploadRoot, 'studio', o.replace(/[^a-zA-Z0-9-]/g, ''), name); };
  const profile = (o) => db.prepare('SELECT o.name,o.display_name,o.brand_primary_color,o.city,op.business_type,op.phone,op.website,op.service_area,op.services FROM organisations o LEFT JOIN onboarding_profiles op ON op.organisation_id=o.id WHERE o.id=?').get(o) || {};
  const get = (o, id) => db.prepare('SELECT * FROM reel_jobs WHERE organisation_id=? AND id=?').get(o, id);
  const pub = (r) => { const s = JSON.parse(r.spec_json); return { id: r.id, title: s.title || s.hook, template: s.template, aspect_ratio: s.aspect_ratio, status: r.status, media_id: r.media_id, preview_url: r.media_id ? `/api/saas/media/${r.media_id}/file` : null, caption: s.caption, error: r.error, seconds: r.seconds, created_at: r.created_at }; };

  const item = z.object({ media_id: z.string().uuid(), start: z.number().min(0).max(86400).default(0), seconds: z.number().min(1).max(15).optional() }).strict();
  const specSchema = z.object({
    template: z.enum(Object.keys(TEMPLATES)), aspect_ratio: z.enum(['9:16', '1:1', '4:5', '16:9']).default('9:16'), quality: z.enum(['720p', '1080p']).default('1080p'),
    hook: z.string().trim().min(2).max(90), title: z.string().trim().max(90).default(''), features: z.array(z.string().trim().max(240)).max(8).default([]),
    cta: z.string().trim().max(70).default(''), phone: z.string().trim().max(30).default(''), website: z.string().trim().max(80).default(''),
    items: z.array(item).min(1).max(20), logo_media_id: z.string().uuid().nullable().default(null), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    audio: z.object({ media_id: z.string().uuid(), volume: z.number().min(0).max(1).default(0.9), keep_original: z.boolean().default(false) }).strict().nullable().default(null),
    caption: z.string().max(3000).default(''), end_card: z.boolean().default(true),
  }).strict();

  app.get('/api/saas/reels', ...gate, (req, res) => {
    res.set('cache-control', 'private, no-store');
    const p = profile(org(req));
    res.json({ ok: true, available: Boolean(ffmpegPath(env)) && Object.values(F).every((f) => fs.existsSync(f)), templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, ...t })),
      accent: hex(p.brand_primary_color), reels: db.prepare('SELECT * FROM reel_jobs WHERE organisation_id=? ORDER BY created_at DESC LIMIT 30').all(org(req)).map(pub) });
  });
  app.post('/api/saas/reels/plan', ...gate, (req, res) => {
    const p = z.object({ template: z.enum(Object.keys(TEMPLATES)), idea: z.string().max(400).optional(), service: z.string().max(60).optional(), offer: z.string().max(120).optional(), quote: z.string().max(300).optional(), features: z.array(z.string().max(240)).max(8).optional(), title: z.string().max(90).optional(), cta: z.string().max(70).optional() }).strict().safeParse(req.body || {});
    if (!p.success) return fail(res, 400, 'Check the details.');
    res.json({ ok: true, plan: planCopy(profile(org(req)), p.data) });
  });
  app.post('/api/saas/reels', ...gate, (req, res) => {
    const p = z.object({ idempotency_key: z.string().uuid(), spec: specSchema }).strict().safeParse(req.body || {});
    if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the reel details.');
    const o = org(req), d = p.data;
    const prior = db.prepare('SELECT * FROM reel_jobs WHERE organisation_id=? AND idempotency_key=?').get(o, d.idempotency_key);
    if (prior) return prior.spec_json === JSON.stringify(d.spec) ? res.json({ ok: true, reel: pub(prior), replayed: true }) : fail(res, 409, 'This request was already used for a different reel.');
    if (!ffmpegPath(env)) return fail(res, 503, 'Video making is not available on this server right now. Your photos and videos are safe.');
    if (d.spec.template === 'offer' && !d.spec.hook.trim()) return fail(res, 400, 'Type the offer.');
    for (const it of d.spec.items) { const m = media(o, it.media_id); if (!m || !['photo', 'video'].includes(m.kind)) return fail(res, 400, 'A photo or video is not in your library.'); }
    if (d.spec.logo_media_id && media(o, d.spec.logo_media_id)?.kind !== 'photo') return fail(res, 400, 'Choose a logo photo from your library.');
    if (d.spec.audio && !['audio', 'video'].includes(media(o, d.spec.audio.media_id)?.kind)) return fail(res, 400, 'Choose your voice or music from your library.');
    if (db.prepare("SELECT COUNT(*) n FROM reel_jobs WHERE organisation_id=? AND status IN ('queued','processing')").get(o).n >= 2) return fail(res, 429, 'Two reels are already being made. Wait for one to finish.');
    const id = crypto.randomUUID(), now = iso();
    db.transaction(() => {
      db.prepare("INSERT INTO reel_jobs (id,organisation_id,idempotency_key,spec_json,status,created_by,created_at,updated_at) VALUES (?,?,?,?,'queued',?,?,?)").run(id, o, d.idempotency_key, JSON.stringify(d.spec), req.saas.user_id, now, now);
      queue.enqueue('reel.render', { id }, { organisationId: o, idempotencyKey: `reel.render:${o}:${id}`, maxAttempts: 1 });
    })();
    saasAudit(req, 'reel.requested', 'reel_job', id, { template: d.spec.template, items: d.spec.items.length });
    res.status(202).json({ ok: true, reel: pub(get(o, id)) });
  });
  app.post('/api/saas/reels/:id/cancel', ...gate, (req, res) => {
    const r = get(org(req), req.params.id); if (!r) return fail(res, 404, 'Reel not found.');
    if (['queued', 'processing'].includes(r.status)) db.prepare("UPDATE reel_jobs SET status='cancelled',updated_at=? WHERE id=?").run(iso(), r.id);
    res.json({ ok: true, reel: pub(get(org(req), r.id)) });
  });
  app.delete('/api/saas/reels/:id', ...gate, (req, res) => {
    const r = get(org(req), req.params.id); if (!r || ['queued', 'processing'].includes(r.status)) return fail(res, 404, 'Only finished reels can be cleared.');
    db.prepare('DELETE FROM reel_jobs WHERE id=?').run(r.id); res.json({ ok: true }); // the video stays in the library
  });

  async function render(o, row, temp) {
    const s = specSchema.parse(JSON.parse(row.spec_json));
    const [bw, bh] = SIZES[s.aspect_ratio], k = s.quality === '720p' ? 2 / 3 : 1, W = Math.round(bw * k / 2) * 2, H = Math.round(bh * k / 2) * 2;
    const base = Math.min(W, H), vertical = H > W, accent = hex(s.accent || profile(o).brand_primary_color), ink = lum(accent) > 0.4 ? '0x111111' : 'white';
    const hookY = Math.round(H * (vertical ? 0.13 : 0.1)), lowY = Math.round(H * (vertical ? 0.64 : 0.7));
    const scenes = [];
    const feats = s.features.filter(Boolean);
    s.items.forEach((it, i) => {
      const blocks = [];
      if (i === 0) blocks.push({ font: F.hook, size: Math.round(base * 0.105), lines: wrap(s.hook.toUpperCase(), Math.floor(W * 0.88 / (base * 0.105 * 0.47)), 3), y: hookY, border: Math.max(2, Math.round(base * 0.006)), shadow: true, slide: true, at: 0.1 });
      if (i === 1 && s.title) blocks.push({ font: F.bold, size: Math.round(base * 0.058), lines: wrap(s.title, Math.floor(W * 0.84 / (base * 0.058 * 0.6)), 2), y: hookY, box: `${ffc(accent)}@0.94`, color: ink, slide: true });
      const f = feats[i - (s.title ? 2 : 1)];
      if (i >= (s.title ? 2 : 1) && f) blocks.push({ font: F.semi, size: Math.round(base * 0.05), lines: wrap(f, Math.floor(W * 0.84 / (base * 0.05 * 0.58)), 4), y: lowY, box: 'black@0.6', slide: true });
      scenes.push({ ...it, blocks });
    });
    // Tips or reviews longer than the photos chosen are not lost: extra lines go onto the last scene, one by one.
    const used = Math.max(0, s.items.length - (s.title ? 2 : 1)); const extra = feats.slice(used);
    if (extra.length && scenes.length) scenes[scenes.length - 1].blocks.push({ font: F.semi, size: Math.round(base * 0.045), lines: extra.flatMap((x) => wrap(x, Math.floor(W * 0.84 / (base * 0.045 * 0.58)), 2)).slice(0, 6), y: Math.round(lowY - base * 0.08), box: 'black@0.6', at: 0.6 });

    const parts = [], durations = [];
    for (let i = 0; i < scenes.length; i++) {
      if (get(o, row.id)?.status === 'cancelled') return null;
      const sc = scenes[i], m = media(o, sc.media_id); if (!m) throw Error('A photo or video was removed from the library.');
      const file = stored(o, m.stored_name); verifyStudioMedia(file, m.mime_type);
      const info = await probe(file, env), isPhoto = m.kind === 'photo';
      const textSecs = sc.blocks.reduce((n, b) => n + b.lines.join(' ').length, 0) / 14; // reading time
      let secs = sc.seconds || (isPhoto ? Math.min(6, Math.max(i === 0 ? 3.2 : 2.6, 1.2 + textSecs)) : Math.min(6, Math.max(2, (info.seconds || 3) - sc.start)));
      if (!isPhoto) secs = Math.max(1, Math.min(secs, Math.max(0.5, (info.seconds || secs) - sc.start)));
      secs = Math.round(secs * 100) / 100;
      const orient = isPhoto && /jpe?g$/i.test(m.mime_type) ? ORIENT[jpegOrientation(file)] : null; // applied before framing
      const pre = (orient ? orient + ',' : '') + 'setsar=1';
      const frames = Math.round(secs * 30);
      // Keep the photo's own shape: fit it inside the frame, then zoom slowly within that size.
      let pw = info.width || W, ph = info.height || H; const turn = isPhoto && /jpe?g$/i.test(m.mime_type) ? jpegOrientation(file) : 1; if (turn >= 5) [pw, ph] = [ph, pw];
      const fit = Math.min(W / pw, H / ph), fw = Math.max(2, Math.round(pw * fit / 2) * 2), fh = Math.max(2, Math.round(ph * fit / 2) * 2);
      const fg = isPhoto
        ? `[src2]scale=${fw * 2}:${fh * 2},zoompan=z='min(1+0.0012*on,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${fw}x${fh}:fps=30[fg]`
        : `[src2]scale=${W}:${H}:force_original_aspect_ratio=decrease,fps=30[fg]`;
      const graph = [`[0:v]${pre},split=2[src1][src2]`,
        `[src1]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=${Math.round(base / 40)}:2,eq=brightness=-0.12:saturation=1.1[bg]`, fg,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p${sc.blocks.length ? ',' + textFilters(temp, `s${i}`, W, H, sc.blocks).join(',') : ''},trim=duration=${secs},setpts=PTS-STARTPTS[v]`];
      const args = ['-y'];
      if (isPhoto) args.push('-loop', '1', '-framerate', '30', '-t', String(secs), '-i', file); else args.push('-ss', String(sc.start), '-t', String(secs), '-i', file);
      args.push('-f', 'lavfi', '-t', String(secs), '-i', 'anullsrc=r=48000:cl=stereo');
      const out = path.join(temp, `scene-${i}.mp4`);
      const keepOriginal = !isPhoto && info.audio && (!s.audio || s.audio.keep_original);
      args.push('-filter_complex', graph.join(';'), '-map', '[v]', '-map', keepOriginal ? '0:a:0' : '1:a:0', '-t', String(secs), '-frames:v', String(frames),
        '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-af', 'apad', '-shortest', out);
      await runMediaTool(args, { env, timeoutMs: 15 * 60_000 });
      parts.push(out); durations.push(secs);
    }
    if (s.end_card) {
      const p = profile(o), out = path.join(temp, 'end.mp4'), secs = 3.2;
      const lines = [{ font: F.bold, size: Math.round(base * 0.072), lines: wrap(p.display_name || p.name || '', Math.floor(W * 0.84 / (base * 0.072 * 0.6)), 2), y: Math.round(H * (vertical ? 0.42 : 0.36)), color: ink, at: 0.2 }];
      if (s.cta) lines.push({ font: F.hook, size: Math.round(base * 0.07), lines: wrap(s.cta.toUpperCase(), Math.floor(W * 0.86 / (base * 0.07 * 0.47)), 2), y: Math.round(H * (vertical ? 0.53 : 0.52)), color: ink, at: 0.45, slide: true });
      const contact = [s.phone, s.website].filter(Boolean);
      if (contact.length) lines.push({ font: F.semi, size: Math.round(base * 0.042), lines: contact, y: Math.round(H * (vertical ? 0.66 : 0.72)), color: ink, at: 0.7 });
      const args = ['-y', '-f', 'lavfi', '-i', `color=c=${ffc(accent)}:s=${W}x${H}:r=30:d=${secs}`, '-f', 'lavfi', '-t', String(secs), '-i', 'anullsrc=r=48000:cl=stereo'];
      let graph = `[0:v]vignette=PI/4,format=yuv420p,${textFilters(temp, 'end', W, H, lines).join(',')}[v]`;
      if (s.logo_media_id) {
        const lm = media(o, s.logo_media_id); if (!lm) throw Error('The logo was removed from the library.');
        const lf = stored(o, lm.stored_name); verifyStudioMedia(lf, lm.mime_type); args.push('-loop', '1', '-t', String(secs), '-i', lf);
        const box = Math.round(base * 0.26);
        graph = `[0:v]vignette=PI/4[b0];[2:v]scale=${box}:${box}:force_original_aspect_ratio=decrease,format=rgba[lg];[b0][lg]overlay=(W-w)/2:${Math.round(H * (vertical ? 0.42 : 0.36)) - box - Math.round(base * 0.05)}:shortest=1,format=yuv420p,${textFilters(temp, 'end', W, H, lines).join(',')}[v]`;
      }
      args.push('-filter_complex', graph, '-map', '[v]', '-map', '1:a:0', '-t', String(secs), '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-ar', '48000', '-ac', '2', out);
      await runMediaTool(args, { env, timeoutMs: 10 * 60_000 }); parts.push(out); durations.push(secs);
    }
    // Join with smooth cross-fades (picture and sound).
    let final = parts[0], total = durations[0];
    if (parts.length > 1) {
      const args = ['-y']; parts.forEach((f) => args.push('-i', f));
      const g = []; let v = '0:v', a = '0:a', off = 0;
      for (let i = 1; i < parts.length; i++) {
        off += durations[i - 1] - XF;
        g.push(`[${v}][${i}:v]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}[v${i}]`, `[${a}][${i}:a]acrossfade=d=${XF}[a${i}]`);
        v = `v${i}`; a = `a${i}`;
      }
      total = durations.reduce((n, d) => n + d, 0) - XF * (parts.length - 1);
      final = path.join(temp, 'joined.mp4');
      args.push('-filter_complex', g.join(';'), '-map', `[${v}]`, '-map', `[${a}]`, '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final);
      await runMediaTool(args, { env, timeoutMs: 30 * 60_000 });
    }
    // Voice or music on top: fades out at the end; the reel keeps its length.
    if (s.audio) {
      const m = media(o, s.audio.media_id); if (!m) throw Error('The voice or music was removed from the library.');
      const af = stored(o, m.stored_name); verifyStudioMedia(af, m.mime_type);
      const out = path.join(temp, 'mixed.mp4'), fadeAt = Math.max(0, total - 1.2).toFixed(2);
      const mix = s.audio.keep_original ? `[1:a]volume=${s.audio.volume},apad,afade=t=out:st=${fadeAt}:d=1.2[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]` : `[1:a]volume=${s.audio.volume},apad,afade=t=out:st=${fadeAt}:d=1.2[a]`;
      await runMediaTool(['-y', '-i', final, '-i', af, '-filter_complex', mix, '-map', '0:v:0', '-map', '[a]', '-t', total.toFixed(3), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { env, timeoutMs: 20 * 60_000 });
      final = out;
    }
    return { file: final, seconds: Math.round(total * 10) / 10, title: s.title || s.hook };
  }

  queue.register('reel.render', async ({ id }, { organisationId: o }) => {
    const row = get(o, id); if (!row || ['cancelled', 'succeeded'].includes(row.status)) return { skipped: true };
    const allowed = () => Boolean(db.prepare(`SELECT 1 FROM memberships WHERE organisation_id=? AND user_id=? AND status='active' AND role IN (${STAFF.map(() => '?').join(',')})`).get(o, row.created_by, ...STAFF));
    if (!allowed()) { db.prepare("UPDATE reel_jobs SET status='failed',error='Workspace access changed before the reel was made.',updated_at=? WHERE id=?").run(iso(), id); return { failed: true }; }
    const dir = path.join(uploadRoot, 'studio', o.replace(/[^a-zA-Z0-9-]/g, '')); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = fs.mkdtempSync(path.join(dir, '.reel-'));
    try {
      db.prepare("UPDATE reel_jobs SET status='processing',error=NULL,updated_at=? WHERE id=?").run(iso(), id);
      const r = await render(o, row, temp); if (!r) return { cancelled: true };
      if (get(o, id)?.status === 'cancelled') return { cancelled: true };
      const bytes = fs.statSync(r.file).size; if (bytes > Number(env.STUDIO_MEDIA_MAX_MB || 200) * 1048576) throw Error('The reel is larger than your library allows.');
      const mid = crypto.randomUUID(), name = `${mid}.mp4`, dest = path.join(dir, name); copyPrivateFile(r.file, dest);
      db.transaction(() => {
        db.prepare("INSERT INTO tenant_media (id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,source,created_by_user_id,created_at) VALUES (?,?,?,?,'video/mp4','video',?,'reel',?,?)")
          .run(mid, o, `Reel – ${clean(r.title, 60)}.mp4`, name, bytes, row.created_by, iso());
        db.prepare("UPDATE reel_jobs SET status='succeeded',media_id=?,seconds=?,updated_at=? WHERE id=?").run(mid, r.seconds, iso(), id);
      })();
      return { media_id: mid };
    } catch (e) {
      if (get(o, id)?.status !== 'cancelled') db.prepare("UPDATE reel_jobs SET status='failed',error=?,updated_at=? WHERE id=?").run(String(e.message || 'The reel could not be made.').slice(0, 300).replace(/\/[^\s]*\//g, ''), iso(), id);
      return { failed: true };
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }, { maxAttempts: 1, timeoutMs: 2 * 3600_000 });
}
