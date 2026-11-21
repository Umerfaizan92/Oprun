// Non-destructive edit compositions, processed by the existing durable queue.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {probe,concat,runMediaTool,writePrivateFile,copyPrivateFile,ffmpegPath} from './media-tools.js';
const clip=z.object({media_id:z.string().uuid(),start:z.number().min(0).max(86400),end:z.number().positive().max(86400),text:z.string().max(300).default(''),volume:z.number().min(0).max(1).default(1)}).strict().refine(c=>c.end>c.start,'Clip end must follow its start.');
const caption=z.object({start:z.number().min(0),end:z.number().positive(),text:z.string().max(300)}).strict().refine(c=>c.end>c.start);
export const compositionSchema=z.object({title:z.string().trim().min(1).max(160),clips:z.array(clip).min(1).max(40),aspect_ratio:z.enum(['9:16','16:9','1:1','4:5']),resolution:z.enum(['720p','1080p']).default('720p'),captions:z.array(caption).max(500).default([]),audio:z.object({media_id:z.string().uuid(),start:z.number().min(0).max(86400).default(0),volume:z.number().min(0).max(1).default(0.6),keep_original:z.boolean().default(true)}).strict().nullable().default(null)}).strict().refine(c=>c.clips.reduce((n,x)=>n+x.end-x.start,0)<=3600,'Edit exports support up to one hour.');
const uuid=()=>crypto.randomUUID(),iso=()=>new Date().toISOString();
const safeStored=(root,o,name)=>{if(path.basename(name)!==name)throw Error('Invalid media path');return path.join(root,'studio',o.replace(/[^a-zA-Z0-9-]/g,''),name)};
export function installStudioEditor(app,{db,env={},uploadRoot,queue,requireSaasUser,requireSaasRole,saasAudit}){
 db.exec(`CREATE TABLE IF NOT EXISTS studio_exports(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,spec_json TEXT NOT NULL,status TEXT NOT NULL,media_id TEXT,error TEXT,created_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organisation_id,idempotency_key));CREATE INDEX IF NOT EXISTS studio_exports_org ON studio_exports(organisation_id,created_at);`);
 const gate=[requireSaasUser,requireSaasRole('owner','admin','manager','super_admin','director')],org=r=>r.saas.organisation_id;
 const get=(o,id)=>db.prepare('SELECT * FROM studio_exports WHERE organisation_id=? AND id=?').get(o,id);
 const media=(o,id)=>db.prepare('SELECT * FROM tenant_media WHERE organisation_id=? AND id=?').get(o,id);
 const fail=(r,s,e)=>r.status(s).json({ok:false,error:e});
 const publicRow=r=>({id:r.id,title:JSON.parse(r.spec_json).title,status:r.status,media_id:r.media_id,preview_url:r.media_id?`/api/saas/media/${r.media_id}/file`:null,error:r.error,created_at:r.created_at});
 const font=['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'].find(f=>fs.existsSync(f));
 app.get('/api/saas/studio-exports',...gate,(req,res)=>{res.set('cache-control','private, no-store');res.json({ok:true,available:!!ffmpegPath(env),text_available:!!font,exports:db.prepare('SELECT * FROM studio_exports WHERE organisation_id=? ORDER BY created_at DESC LIMIT 100').all(org(req)).map(publicRow)})});
 app.post('/api/saas/studio-exports',...gate,(req,res)=>{
  const p=z.object({idempotency_key:z.string().uuid(),composition:compositionSchema}).strict().safeParse(req.body);if(!p.success)return fail(res,400,'Check clip times, captions and output settings. Export supports up to 40 clips and one hour.');
  const o=org(req),d=p.data,prior=db.prepare('SELECT * FROM studio_exports WHERE organisation_id=? AND idempotency_key=?').get(o,d.idempotency_key);
  if(prior){if(prior.spec_json!==JSON.stringify(d.composition))return fail(res,409,'Export request already used for different edits.');return res.json({ok:true,export:publicRow(prior),replayed:true})}
  if(!ffmpegPath(env))return fail(res,503,'Video editing is unavailable on this server. Your source media is preserved.');
  if(!font&&(d.composition.captions.length||d.composition.clips.some(c=>c.text)))return fail(res,503,'Text export is unavailable on this server. Remove overlays or try again later.');
  if(db.prepare("SELECT COUNT(*) n FROM studio_exports WHERE organisation_id=? AND status IN ('queued','processing')").get(o).n>=2)return fail(res,429,'Two exports are already processing in this workspace. Wait for one to finish.');
  for(const c of d.composition.clips){const m=media(o,c.media_id);if(!m||!['video','photo'].includes(m.kind))return fail(res,400,'A clip is unavailable in this workspace.')}
  if(d.composition.audio){const m=media(o,d.composition.audio.media_id);if(!m||!['video','audio'].includes(m.kind))return fail(res,400,'The audio track is unavailable in this workspace.')}
  const id=uuid(),now=iso();db.transaction(()=>{db.prepare("INSERT INTO studio_exports VALUES (?,?,?,?,'queued',NULL,NULL,?,?,?)").run(id,o,d.idempotency_key,JSON.stringify(d.composition),req.saas.user_id,now,now);queue.enqueue('studio.export',{id},{organisationId:o,idempotencyKey:`studio.export:${o}:${id}`,maxAttempts:1})})();saasAudit(req,'studio.export_requested','studio_export',id,{clips:d.composition.clips.length});res.status(202).json({ok:true,export:publicRow(get(o,id))});
 });
 app.post('/api/saas/studio-exports/:id/cancel',...gate,(req,res)=>{const r=get(org(req),req.params.id);if(!r)return fail(res,404,'Export not found.');if(['queued','processing'].includes(r.status))db.prepare("UPDATE studio_exports SET status='cancelled',updated_at=? WHERE id=? AND organisation_id=?").run(iso(),r.id,org(req));res.json({ok:true,export:publicRow(get(org(req),r.id))})});
 queue.register('studio.export',async({id},{organisationId:o})=>{
  const row=get(o,id);if(!row||row.status==='cancelled'||row.status==='succeeded')return {skipped:true};
  const authorised=()=>!!db.prepare("SELECT 1 FROM memberships WHERE organisation_id=? AND user_id=? AND status='active' AND role IN ('owner','admin','manager','super_admin','director')").get(o,row.created_by);
  if(!authorised()){db.prepare("UPDATE studio_exports SET status='failed',error='Workspace access changed before export.',updated_at=? WHERE id=? AND organisation_id=?").run(iso(),id,o);return {failed:true}}
  const spec=compositionSchema.parse(JSON.parse(row.spec_json)),budget=Number(env.STUDIO_MEDIA_MAX_MB||200)*1048576*3,dir=path.join(uploadRoot,'studio',o.replace(/[^a-zA-Z0-9-]/g,''));fs.mkdirSync(dir,{recursive:true,mode:0o700});const temp=fs.mkdtempSync(path.join(dir,'.edit-'));
  const cancelled=()=>get(o,id)?.status==='cancelled';
  try{
   db.prepare("UPDATE studio_exports SET status='processing',error=NULL,updated_at=? WHERE id=? AND organisation_id=?").run(iso(),id,o);
   const pairs={'9:16':[720,1280],'16:9':[1280,720],'1:1':[720,720],'4:5':[720,900]},scale=spec.resolution==='1080p'?1.5:1,[w,h]=pairs[spec.aspect_ratio].map(n=>n*scale),parts=[];
   for(let i=0;i<spec.clips.length;i++){
    if(cancelled())return {cancelled:true};if(!authorised())throw Error('Workspace permission changed.');const c=spec.clips[i],m=media(o,c.media_id);if(!m)throw Error('A source was removed.');const file=safeStored(uploadRoot,o,m.stored_name),info=await probe(file,env),seconds=c.end-c.start;
    if(m.kind==='video'&&(!info.video||c.end>info.seconds+0.15))throw Error('A clip ends beyond its source duration.');
    const out=path.join(temp,`clip-${i}.mp4`),args=['-y'];if(m.kind==='photo')args.push('-loop','1');else args.push('-ss',String(c.start));args.push('-i',file);if(!info.audio||m.kind==='photo')args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
    let vf=`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;
    if(c.text){const text=path.join(temp,`text-${i}.txt`);writePrivateFile(text,c.text);vf+=`,drawtext=fontfile=${font}:textfile=${text}:expansion=none:fontcolor=white:fontsize=${Math.round(w/24)}:box=1:boxcolor=black@0.65:boxborderw=12:x=(w-tw)/2:y=h-th-60`}
    args.push('-map','0:v:0','-map',info.audio?'0:a:0':'1:a:0','-vf',vf,'-af',`volume=${c.volume},apad`,'-t',String(seconds),'-c:v','libx264','-threads','1','-preset','veryfast','-crf','21','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',out);await runMediaTool(args,{env,timeoutMs:20*60000});parts.push(out);if(parts.reduce((n,f)=>n+fs.statSync(f).size,0)>budget)throw Error('Temporary media budget exceeded.');
   }
   if(cancelled())return {cancelled:true};let final=path.join(temp,'joined.mp4');await concat(parts,final,env);
   if(spec.captions.length){const filters=spec.captions.map((c,i)=>{const f=path.join(temp,`caption-${i}.txt`);writePrivateFile(f,c.text);return `drawtext=fontfile=${font}:textfile=${f}:expansion=none:fontcolor=white:fontsize=${Math.round(w/27)}:box=1:boxcolor=black@0.65:boxborderw=8:x=(w-tw)/2:y=h-th-24:enable='between(t,${c.start},${c.end})'`});const out=path.join(temp,'captioned.mp4');await runMediaTool(['-y','-i',final,'-vf',filters.join(','),'-c:v','libx264','-threads','1','-preset','veryfast','-c:a','copy','-movflags','+faststart',out],{env,timeoutMs:30*60000});final=out}
   if(spec.audio){const a=spec.audio,m=media(o,a.media_id);if(!m)throw Error('Audio source removed.');const audio=safeStored(uploadRoot,o,m.stored_name),info=await probe(audio,env);if(!info.audio||a.start>=info.seconds)throw Error('Audio start is beyond its track.');const out=path.join(temp,'mixed.mp4'),mix=a.keep_original?`[1:a]volume=${a.volume},apad[vo];[0:a][vo]amix=inputs=2:duration=first:normalize=0[a]`:`[1:a]volume=${a.volume},apad[a]`;await runMediaTool(['-y','-i',final,'-ss',String(a.start),'-i',audio,'-filter_complex',mix,'-map','0:v:0','-map','[a]','-t',String(spec.clips.reduce((n,c)=>n+c.end-c.start,0)),'-c:v','copy','-c:a','aac','-movflags','+faststart',out],{env,timeoutMs:30*60000});final=out}
   if(cancelled())return {cancelled:true};if(!authorised())throw Error('Workspace permission changed.');const bytes=fs.statSync(final).size;if(bytes>Number(env.STUDIO_MEDIA_MAX_MB||200)*1048576)throw Error('Export exceeds this workspace file limit.');
   const mediaId=uuid(),name=`${mediaId}.mp4`,destination=safeStored(uploadRoot,o,name);copyPrivateFile(final,destination);
   try{db.transaction(()=>{if(cancelled())throw Error('Export cancelled.');db.prepare("INSERT INTO tenant_media (id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,source,created_by_user_id,created_at) VALUES (?,?,?,?,'video/mp4','video',?,'studio_edit',?,?)").run(mediaId,o,`${spec.title}.mp4`,name,bytes,row.created_by,iso());db.prepare("UPDATE studio_exports SET status='succeeded',media_id=?,updated_at=? WHERE id=? AND organisation_id=?").run(mediaId,iso(),id,o)})()}catch(e){fs.rmSync(destination,{force:true});throw e}return {media_id:mediaId};
  }catch{if(!cancelled())db.prepare("UPDATE studio_exports SET status='failed',error=?,updated_at=? WHERE id=? AND organisation_id=?").run('Export failed. Check clip times and source files, then create a new export. Original media is unchanged.',iso(),id,o);return {failed:true}}
  finally{fs.rmSync(temp,{recursive:true,force:true})}
 },{maxAttempts:1,timeoutMs:3*3600000});
}
