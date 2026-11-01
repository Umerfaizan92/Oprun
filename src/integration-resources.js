// One authorised resource selection is shared with the existing SEO workspace.
export function googleResourceLinks(provider,resources=[]) {
 const map=provider==='google_business'?{google_business_location:'business_profile'}:provider==='google_seo'?{search_console_property:'search_console',analytics_property:'analytics',tag_manager_container:'tag_manager'}:{};
 return resources.filter(r=>map[r.type]&&r.usable!==false).map(r=>({service:map[r.type],resource:r.type==='tag_manager_container'?r.public_id:r.type==='google_business_location'?r.parent_id+'/'+r.id:r.id,label:r.label})).filter(r=>r.resource);
}
export function reconcileGoogleResourceLinks(db,org,provider,resources,actor) {
 if(!['google_business','google_seo'].includes(provider)||!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='seo_google_links'").get())return;
 const services=provider==='google_business'?['business_profile']:['search_console','analytics','tag_manager'],links=googleResourceLinks(provider,resources),now=new Date().toISOString();
 for(const service of services){
  const candidates=links.filter(r=>r.service===service),existing=db.prepare('SELECT resource FROM seo_google_links WHERE owner_key=? AND service=?').get(org,service);
  if(candidates.some(r=>r.resource===existing?.resource))continue;
  db.prepare('DELETE FROM seo_google_links WHERE owner_key=? AND service=?').run(org,service);
  if(candidates[0])db.prepare('INSERT INTO seo_google_links(owner_key,service,resource,label,linked_by,linked_at) VALUES (?,?,?,?,?,?)').run(org,service,candidates[0].resource,candidates[0].label||candidates[0].resource,actor||null,now);
 }
}
