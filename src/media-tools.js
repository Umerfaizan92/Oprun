// T-190: small FFmpeg helpers for the AI video creator: pick a frame, measure, join clips, add a voice track, convert.
// FFmpeg runs as a separate process (ffmpeg-static binary, or FFMPEG_PATH, or the system ffmpeg), with a time limit,
// never through a shell, and only on files Oprun wrote itself.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let bundled = null;
try { bundled = require('ffmpeg-static'); } catch { bundled = null; }

export function ffmpegPath(env = process.env) {
  if (env.FFMPEG_PATH && fs.existsSync(env.FFMPEG_PATH)) return env.FFMPEG_PATH;
  if (bundled && fs.existsSync(bundled)) return bundled;
  return null;
}

function run(args, { env = process.env, timeoutMs = 10 * 60_000 } = {}) {
  const bin = ffmpegPath(env);
  if (!bin) return Promise.reject(Object.assign(new Error('Video processing is not available on this server.'), { status: 503 }));
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-20000); });
    const t = setTimeout(() => { p.kill('SIGKILL'); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (code, signal) => {
      clearTimeout(t);
      if (code === 0) resolve(err);
      else reject(Object.assign(new Error(signal ? 'Video processing took too long.' : `Video processing failed: ${err.split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300)}`), { stderr: err }));
    });
  });
}

/** Duration in seconds and whether the file has audio/video, read from FFmpeg's own report. */
export async function probe(file, env) {
  let out = '';
  try { await run(['-i', file], { env, timeoutMs: 30_000 }); } catch (e) { out = e.stderr || ''; }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const size = out.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  return { seconds: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0, audio: /Stream #.*Audio:/.test(out), video: /Stream #.*Video:/.test(out), width: size ? Number(size[1]) : 0, height: size ? Number(size[2]) : 0 };
}

/** A still frame as JPEG: `at` seconds in, or the last frame when at === 'end'. */
export async function frame(file, out, at = 1, env) {
  if (at === 'end') await run(['-y', '-sseof', '-0.25', '-i', file, '-frames:v', '1', '-q:v', '2', '-update', '1', out], { env, timeoutMs: 60_000 });
  else await run(['-y', '-ss', String(Math.max(0, at)), '-i', file, '-frames:v', '1', '-q:v', '2', out], { env, timeoutMs: 60_000 });
  if (!fs.existsSync(out) || !fs.statSync(out).size) {
    await run(['-y', '-i', file, '-frames:v', '1', '-q:v', '2', out], { env, timeoutMs: 60_000 }); // very short clips
  }
  return out;
}

/** Joins clips into one H.264/AAC MP4 at the first clip's size; clips without sound get silence. */
export async function concat(files, out, env) {
  if (!files.length) throw new Error('No clips to join.');
  const info = await Promise.all(files.map((f) => probe(f, env)));
  const w = (info[0].width || 720) & ~1, h = (info[0].height || 1280) & ~1;
  const args = ['-y'];
  files.forEach((f) => args.push('-i', f));
  const parts = [];
  info.forEach((x, i) => {
    parts.push(`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`);
    parts.push(x.audio ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]` : `anullsrc=r=48000:cl=stereo,atrim=0:${Math.max(0.1, x.seconds || 1).toFixed(3)}[a${i}]`);
  });
  parts.push(`${info.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${files.length}:v=1:a=1[v][a]`);
  args.push('-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out);
  await run(args, { env, timeoutMs: 30 * 60_000 });
  return out;
}

/** Puts a voice track on a video. The picture holds its last frame if the voice is longer; the voice is padded with
 *  silence if the picture is longer. keep = mix the video's own sound quietly under the voice. */
export async function addVoice(video, voice, out, { keep = false } = {}, env) {
  const [v, a] = await Promise.all([probe(video, env), probe(voice, env)]);
  const extra = Math.max(0, (a.seconds || 0) - (v.seconds || 0));
  const vf = extra > 0.05 ? `[0:v]tpad=stop_mode=clone:stop_duration=${extra.toFixed(3)}[v]` : '[0:v]null[v]';
  const af = keep && v.audio ? '[0:a]volume=0.18[bg];[1:a]aresample=48000[vo];[bg][vo]amix=inputs=2:duration=longest:dropout_transition=0[a]' : '[1:a]aresample=48000,apad[a]';
  await run(['-y', '-i', video, '-i', voice, '-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]', '-t', String(Math.max(v.seconds, a.seconds).toFixed(3)), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { env, timeoutMs: 30 * 60_000 });
  return out;
}

/** Any audio or video file to MP3 (voice samples for cloning). */
export async function toMp3(file, out, env) { await run(['-y', '-i', file, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', out], { env, timeoutMs: 5 * 60_000 }); return out; }

/** A camera recording (WebM) to a phone-friendly MP4. */
export async function toMp4(file, out, env) { await run(['-y', '-i', file, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { env, timeoutMs: 20 * 60_000 }); return out; }
