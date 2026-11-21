// T-190: small FFmpeg helpers for the AI video creator: pick a frame, measure, join clips, add a voice track, convert.
// FFmpeg runs as a separate process (ffmpeg-static binary, or FFMPEG_PATH, or the system ffmpeg), with a time limit,
// never through a shell, and only on files Oprun wrote itself.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let bundled = null;
try { bundled = require('ffmpeg-static'); } catch { bundled = null; }

/** Replace a private media file atomically without following an existing symlink. */
export function writePrivateFile(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const dir = fs.mkdtempSync(path.join(path.dirname(file), '.media-'));
  try {
    const staging = path.join(dir, 'data');
    fs.writeFileSync(staging, body, { flag: 'wx', mode: 0o600 });
    fs.renameSync(staging, file);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Copy a large finished video privately without buffering it in Node memory. */
export function copyPrivateFile(source,file){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const dir=fs.mkdtempSync(path.join(path.dirname(file),'.media-'));
  try{const staging=path.join(dir,'data');fs.copyFileSync(source,staging,fs.constants.COPYFILE_EXCL);fs.chmodSync(staging,0o600);fs.renameSync(staging,file);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}

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
  let m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  // MediaRecorder writes streaming WebM without a Duration header. Decode it to
  // a null output to measure the actual timeline, stopping just beyond our
  // supported custom-duration limit so oversized recordings can be rejected.
  if (!m && /Stream #.*(?:Audio|Video):/.test(out)) {
    try {
      const progress = await run(['-i', file, '-t', '86401', '-progress', 'pipe:2', '-nostats', '-f', 'null', '-'], { env, timeoutMs: 60_000 });
      m = [...progress.matchAll(/out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].at(-1);
    } catch { /* unreadable recordings retain a zero duration and are rejected */ }
  }
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
export async function concat(files, out, env, {seconds=null}={}) {
  if (!files.length) throw new Error('No clips to join.');
  // Normalize sequentially, then join with a demuxer. Opening every source in a
  // giant filter graph exhausted memory for full-length/ongoing projects.
  const dir=fs.mkdtempSync(path.join(path.dirname(out),'.join-'));
  try{
    const first=await probe(files[0],env),w=(first.width||720)&~1,h=(first.height||1280)&~1,list=[];
    for(let i=0;i<files.length;i++){
      const info=i===0?first:await probe(files[i],env),file=path.join(dir,`part-${i}.mp4`),args=['-y','-i',files[i]];
      if(!info.audio)args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
      args.push('-map','0:v:0','-map',info.audio?'0:a:0':'1:a:0','-vf',`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`,'-t',String(info.seconds),'-c:v','libx264','-threads','1','-preset','veryfast','-tune','zerolatency','-crf','20','-video_track_timescale','90000','-c:a','aac','-ar','48000','-ac','2','-b:a','160k',file);
      await run(args,{env,timeoutMs:30*60_000});list.push(`file '${file.replace(/'/g,"'\\''")}'`);
    }
    const manifest=path.join(dir,'inputs.txt');writePrivateFile(manifest,list.join('\n')+'\n');
    const args=['-y','-f','concat','-safe','0','-i',manifest];if(seconds)args.push('-t',String(seconds));
    args.push('-c','copy','-movflags','+faststart',out);await run(args,{env,timeoutMs:30*60_000});return out;
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

/** Trim a finished voiced video to the explicitly requested final duration. */
export async function trim(file,out,seconds,env){await run(['-y','-i',file,'-t',String(seconds),'-c','copy','-movflags','+faststart',out],{env,timeoutMs:30*60_000});return out;}

/** Puts a voice track on a video. The picture holds its last frame if the voice is longer; the voice is padded with
 *  silence if the picture is longer. keep = mix the video's own sound quietly under the voice. */
export async function addVoice(video, voice, out, { keep = false } = {}, env) {
  const [v, a] = await Promise.all([probe(video, env), probe(voice, env)]);
  const extra = Math.max(0, (a.seconds || 0) - (v.seconds || 0));
  const vf = extra > 0.05 ? `[0:v]tpad=stop_mode=clone:stop_duration=${extra.toFixed(3)}[v]` : '[0:v]null[v]';
  const af = keep && v.audio ? '[0:a]volume=0.18[bg];[1:a]aresample=48000[vo];[bg][vo]amix=inputs=2:duration=longest:dropout_transition=0[a]' : '[1:a]aresample=48000,apad[a]';
  await run(['-y', '-i', video, '-i', voice, '-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]', '-t', String(Math.max(v.seconds, a.seconds).toFixed(3)), '-c:v', 'libx264','-threads','1', '-preset', 'veryfast','-tune','zerolatency', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { env, timeoutMs: 30 * 60_000 });
  return out;
}

/** Any audio or video file to MP3 (voice samples for cloning). */
export async function toMp3(file, out, env) { await run(['-y', '-i', file, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', out], { env, timeoutMs: 5 * 60_000 }); return out; }

/** A camera recording (WebM) to a phone-friendly MP4. */
export async function toMp4(file, out, env) { await run(['-y', '-i', file, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { env, timeoutMs: 20 * 60_000 }); return out; }
