"""Read-only source census; writes documentation, never loads credentials/databases.
Run from repository root: python docs/media-studio/master-inventory-generator.py.
Static declarations are not evidence of live handler execution or exhaustive dynamic runtime behavior.
"""
import json,re,hashlib,subprocess
from pathlib import Path
from html.parser import HTMLParser
root=Path.cwd();out=root/'docs/media-studio/master-inventory.json'
records=[]
def add(kind,file,line,name,classification='IMPROVE',**extra):
 records.append(dict(kind=kind,file=file,line=line,name=name,classification=classification,**extra))
class UI(HTMLParser):
 def __init__(self):super().__init__();self.depth=0;self.active=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='section':
   if a.get('id')=='video-view':self.active=True
   if self.active:self.depth+=1
  if self.active and (tag in ['form','button','input','select','textarea','video','audio','a','h1','h2','h3'] or a.get('id')):
   name=a.get('id') or a.get('name') or a.get('aria-label') or a.get('data-source-mode') or tag
   cls='MERGE' if name in ['video-form','renders','generate-ai-spec'] or a.get('class')=='studio-workflow' else 'KEEP' if 'library' in name or tag in ['video','audio'] else 'IMPROVE'
   add('ui:'+tag,'saas/workspace.html',self.getpos()[0],name,cls,attributes=a)
 def handle_endtag(self,tag):
  if self.active and tag=='section':
   self.depth-=1
   if not self.depth:self.active=False
UI().feed(Path('saas/workspace.html').read_text())
frontend=['saas/workspace-ai-video.js','saas/workspace-video-dictation.js','saas/workspace-media.js','saas/media-picker.js','saas/media-viewer.js','saas/workspace-growth.js','saas/workspace-ai-runtime.js']
for f in frontend:
 s=Path(f).read_text()
 add('component',f,1,Path(f).stem,'KEEP' if any(x in f for x in ['viewer','picker','dictation','runtime']) else 'MERGE')
 for m in re.finditer(r"el\(['\"](button|form|input|select|textarea|video|audio)['\"]\s*,",s):
  snippet=s[m.start():m.start()+340].split('\n')[0]
  add('dynamic-ui:'+m[1],f,s.count('\n',0,m.start())+1,snippet,'IMPROVE')
 for m in re.finditer(r"(?:addEventListener\(|onclick\s*:|onsubmit\s*=)",s):
  add('event-binding',f,s.count('\n',0,m.start())+1,s[m.start():m.start()+180].split('\n')[0],'UNVERIFIED',reason='Static binding exists; real-device execution not established by census')
backend=['src/ai-video.js','src/server.js','src/growth.js','src/channel-operations.js','src/saas-platform.js']
for f in backend:
 s=Path(f).read_text()
 for m in re.finditer(r"app\.(get|post|put|patch|delete)\(\s*(['\"])([^'\"]+)\2",s):
  route=m[3]
  if not re.search(r'ai-video|video-renders|content/ai-spec|/media(?:/|$)|/growth|/channels|/campaign|voice/transcribe|^/m/',route):continue
  excerpt=s[m.end():m.end()+350].split('\n')[0]
  add('api',f,s.count('\n',0,m.start())+1,m[1].upper()+' '+route,'MERGE' if 'video-renders' in route or 'content/ai-spec' in route else 'IMPROVE',guard_excerpt=excerpt,guard_status='Manual review required; middleware aliases and global guards not expanded by regex')
for f in ['src/db.js']+backend:
 s=Path(f).read_text()
 for m in re.finditer(r'CREATE TABLE(?: IF NOT EXISTS)?\s+([a-zA-Z_]+)',s,re.I):
  if re.search(r'ai_video|ai_voices|tenant_media|video_render|growth_|campaign|channel_|organisation_integrations|notification',m[1]):
   add('database-table',f,s.count('\n',0,m.start())+1,m[1],'MERGE' if m[1]=='video_render_jobs' else 'KEEP')
for f in Path('scripts').rglob('*.mjs'):
 if re.search(r'ai-video|video-dictation|voice-runtime|media-tools|growth-|channel-|integration-security|integration-tenant|tenant-isolation|tenant-indexes|object-storage|restore-drill|test-(ui|navigation|redesign|mobile|localization|comms|connections)',f.name):
  add('test',str(f),1,f.name,'KEEP',verification='Prior CI may cover this file; not rerun by documentation census')
for f,names in {
 'src/ai-video.js':['sweep/poll persisted jobs','expireQueued uncertain-submission recovery','join assembly heartbeat/restart lease','clipDone next continuation','tellProject tenant notification'],
 'src/growth.js':['publishItem scheduling claim/approval','scheduler tick and delivery uncertainty'],
 'src/media-tools.js':['FFmpeg sequential concat/trim/addVoice','private file copy/write staging'],
 'src/object-storage.js':['tenant object storage and mode selection'],
 'src/s3-files.js':['upload replication/restore'],
 'src/media-link.js':['tenant signed public token (no embedded expiry)'],
 'src/channel-providers.js':['official social API provider adapters'],
 'src/notifications.js':['workspace recipient notifications'],
 'scripts/start.mjs':['Litestream DB restore/replication startup'],
 'scripts/restore-drill.mjs':['separate temporary restore/integrity/audit verification'],
 'saas/sw.js':['public cache; workspace/API excluded; network-first static assets']}.items():
 for n in names:add('pipeline-or-storage',f,1,n,'IMPROVE' if 'no embedded expiry' in n else 'KEEP')
for f in ['saas/app.js','saas/workspace-nav.js','saas/ds/refresh.css']:
 s=Path(f).read_text()
 for term in ['growth/media','video-view','video-form','studio-workflow','content-platform']:
  i=s.find(term)
  if i>=0:add('navigation-or-legacy-binding',f,s.count('\n',0,i)+1,term,'MERGE')
files=sorted(set(r['file'] for r in records))
summary={k:sum(r['kind']==k for r in records) for k in sorted(set(r['kind'] for r in records))}
obj={'scope':'Media Studio declared UI, generation, voice, library, campaign/calendar/channel integration and related tests. Static census plus curated pipeline entries; not an authenticated DOM census or proof all runtime paths work.',
 'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'production_commit':'58fc72b597666c637a7fefb19af5962bb1980a80',
 'source_hashes':{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},'counts':summary,'records':records,
 'limitations':['Dynamic labels/options/role-specific branches need runtime census per tenant and role.','Regex does not expand router factories/global middleware or prove object-level authorization.','No provider credentials, subscriber records or production database were read.','All proposed features in blueprint remain ADD until implementation/acceptance.']}
out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'records':len(records),'source_files':len(files),'counts':summary}))
