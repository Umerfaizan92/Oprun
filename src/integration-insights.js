import { createGoogleClient } from './seo/google.js';

const number = value => value!==undefined && value!==null && value!=='' && Number.isFinite(Number(value)) ? Number(value) : null;
const metric = (key,label,value,note='') => ({key,label,value:number(value),status:number(value)===null?'unavailable':'measured',note});
const recent = days => new Date(Date.now()-days*86400000).toISOString().slice(0,10);

// Every remote resource comes from a saved, server-validated workspace selection.
// Counts are never fabricated and different providers' definitions are not combined.
export function createIntegrationInsights({runtime,env,db,fetchImpl=globalThis.fetch}) {
  const google=createGoogleClient({fetchImpl,env});
  const get=(url,bundle,opt={})=>runtime.requestJson(url,{...opt,headers:{authorization:'Bearer '+bundle.access_token,...opt.headers}});
  async function resource(provider,bundle,r) {
    const base={resource_id:r.id,label:r.label,type:r.type,source:provider,period:'Current provider counters',metrics:[]};
    const graph='https://graph.facebook.com/'+String(env.META_GRAPH_VERSION||'v23.0')+'/';
    if(provider==='youtube' && r.type==='youtube_channel') {
      const d=await get('https://www.googleapis.com/youtube/v3/channels?part=statistics&id='+encodeURIComponent(r.id),bundle),c=d.items?.find(x=>x.id===r.id)?.statistics;
      if(!c)throw new Error('The selected YouTube channel is no longer available. Test the connection and select it again.');
      base.metrics=[metric('subscribers','Subscribers',c.hiddenSubscriberCount?null:c.subscriberCount,'YouTube may round or hide this counter.'),metric('views','Channel views',c.viewCount),metric('videos','Public videos',c.videoCount)];
    } else if(provider==='x' && r.type==='x_account') {
      const d=await get('https://api.x.com/2/users/me?user.fields=public_metrics',bundle);
      if(d.data?.id!==r.id)throw new Error('The selected X account no longer matches the authorised account.');
      const c=d.data.public_metrics||{};
      base.metrics=[metric('followers','Followers',c.followers_count),metric('following','Following',c.following_count),metric('posts','Posts and reposts',c.tweet_count),metric('likes','Likes',null,'Account-wide likes are not supplied by this endpoint.')];
    } else if(provider==='tiktok' && r.type==='tiktok_account') {
      const scopes=String(bundle.scope||'').split(/[ ,]+/),stats=scopes.includes('user.info.stats');
      const fields='open_id,display_name'+(stats?',follower_count,following_count,likes_count,video_count':'');
      const d=await get('https://open.tiktokapis.com/v2/user/info/?fields='+fields,bundle),c=d.data?.user;
      if(!c || String(c.open_id)!==r.id)throw new Error('The selected TikTok account no longer matches the authorised account.');
      const note=stats?'':'Reconnect after the platform app has approval for user.info.stats, then grant that scope.';
      base.metrics=[metric('followers','Followers',c.follower_count,note),metric('following','Following',c.following_count,note),metric('likes','Lifetime video likes',c.likes_count,note),metric('videos','Public videos',c.video_count,note)];
      if(scopes.includes('video.list')) {
        const videos=await get('https://open.tiktokapis.com/v2/video/list/?fields=id,title,view_count,like_count,comment_count,share_count',bundle,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({max_count:20})});
        base.recent_content=(videos.data?.videos||[]).map(v=>({id:v.id,title:v.title||v.id,views:number(v.view_count),likes:number(v.like_count),comments:number(v.comment_count),shares:number(v.share_count)}));
        base.content_note='Up to 20 recent public videos; this list is not a lifetime total.';
      }
    } else if(provider==='meta' && r.type==='facebook_page') {
      // A Page token is derived only from the selected Page's authorising user.
      const pages=await get(graph+'me/accounts?fields=id,access_token',bundle),page=pages.data?.find(p=>String(p.id)===r.id);
      if(!page?.access_token)throw Object.assign(new Error('The selected Facebook Page is no longer authorised.'),{status:403});
      const d=await get(graph+encodeURIComponent(r.id)+'?fields=id,name,fan_count,followers_count',{access_token:page.access_token});
      base.source='Meta / Facebook Page';base.metrics=[metric('followers','Followers',d.followers_count),metric('likes','Page likes',d.fan_count),metric('views','Views',null,'Page insights require the provider-approved insights permissions and supported metrics.')];
    } else if(provider==='meta' && r.type==='instagram_account') {
      const pages=await get(graph+'me/accounts?fields=id,access_token,instagram_business_account{id}',bundle),page=pages.data?.find(p=>String(p.instagram_business_account?.id)===r.id);
      if(!page?.access_token)throw Object.assign(new Error('The selected Instagram professional account is no longer authorised.'),{status:403});
      const d=await get(graph+encodeURIComponent(r.id)+'?fields=id,username,followers_count,follows_count,media_count',{access_token:page.access_token});
      base.source='Meta / Instagram professional account';base.metrics=[metric('followers','Followers',d.followers_count),metric('following','Following',d.follows_count),metric('posts','Posts',d.media_count),metric('views','Views',null,'Instagram insights depend on approved permissions and the media type.')];
    } else if(provider==='google_seo' && r.type==='search_console_property') {
      const start=recent(31),end=recent(3),rows=await google.gscQuery(bundle.access_token,r.id,{startDate:start,endDate:end,dimensions:[]});
      const c=rows[0]||{};base.period=start+' to '+end;base.source='Google Search Console';
      base.metrics=[metric('clicks','Search clicks',rows.length?c.clicks:0),metric('impressions','Search impressions',rows.length?c.impressions:0),metric('ctr','Click-through rate',rows.length?c.ctr:0,'Ratio; Google search reporting is delayed.'),metric('position','Average position',c.position)];
    } else if(provider==='google_seo' && r.type==='analytics_property') {
      if(!/^properties\/\d+$/.test(r.id))throw new Error('Invalid Analytics property selection.');
      const d=await get('https://analyticsdata.googleapis.com/v1beta/'+r.id+':runReport',bundle,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:recent(28),endDate:recent(1)}],metrics:[{name:'sessions'},{name:'totalUsers'},{name:'screenPageViews'}]})});
      const values=Object.fromEntries((d.metricHeaders||[]).map((m,i)=>[m.name,d.rows?.[0]?.metricValues?.[i]?.value ?? (d.rows?.length===0?'0':null)]));
      base.period=recent(28)+' to '+recent(1);base.source='Google Analytics 4';
      base.metrics=[metric('sessions','Sessions',values.sessions),metric('users','Users',values.totalUsers),metric('views','Page/screen views',values.screenPageViews)];
    } else if(provider==='google_seo' && r.type==='tag_manager_container') {
      const found=(await google.gtmContainers(bundle.access_token)).some(c=>c.path===r.id);
      base.source='Google Tag Manager';base.period='Configuration check';base.metrics=[metric('container','Authorised container',found?1:null,'Tag Manager is configuration, not a source of views or likes.')];
    } else if(provider==='google_business' && r.type==='google_business_location') {
      if(!/^locations\/[^/]+$/.test(r.id)||!/^accounts\/[^/]+$/.test(r.parent_id||''))throw new Error('Invalid Business Profile location selection.');
      const d=await google.gbpReviews(bundle.access_token,r.parent_id,r.id);base.source='Google Business Profile';
      base.metrics=[metric('reviews','Reviews',d.total),metric('rating','Average rating',d.average)];
      try {
        const c=await google.gbpPerformance(bundle.access_token,r.id,{startDate:recent(28),endDate:recent(1)});
        const impressionKeys=['BUSINESS_IMPRESSIONS_MOBILE_SEARCH','BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_MAPS','BUSINESS_IMPRESSIONS_DESKTOP_MAPS'];
        const views=impressionKeys.every(k=>c[k]!==undefined)?impressionKeys.reduce((sum,k)=>sum+c[k],0):null;
        base.metrics.push(metric('views','Search / Maps impressions',views,'Last 28 complete days; provider impression counts are not unique people.'),metric('calls','Call clicks',c.CALL_CLICKS),metric('website_clicks','Website clicks',c.WEBSITE_CLICKS),metric('directions','Direction requests',c.BUSINESS_DIRECTION_REQUESTS));
      } catch {
        base.metrics.push(metric('views','Search / Maps impressions',null,'Performance reporting could not be read. Check Business Profile API approval and location access.'));
      }
      try {
        // Previous three complete calendar months. Low counts are reported by Google only as "fewer than N".
        const now=new Date(),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-3,1));
        base.search_keywords=await google.gbpSearchKeywords(bundle.access_token,r.id,{startMonth:{y:start.getUTCFullYear(),m:start.getUTCMonth()+1},endMonth:{y:end.getUTCFullYear(),m:end.getUTCMonth()+1}});
        base.search_keywords_period=start.toISOString().slice(0,7)+' to '+end.toISOString().slice(0,7);
      } catch { base.search_keywords=null; }
    } else {
      base.period='Not available';base.metrics=[metric('insights','Provider insights',null,provider==='snapchat'?'Snapchat Public Profile insights require separate approved Public Profile API access; a Marketing API identity is not a profile metrics connection.':'No social audience metrics apply to this resource. Select a Page, professional account, channel, property or location.')];
    }
    return base;
  }
  async function fetch(provider,bundle,selected) {
    const resources=selected.slice(0,25),results=new Array(resources.length),deadline=Date.now()+45000;let cursor=0;
    await Promise.all(Array.from({length:Math.min(4,resources.length)},async()=>{
      while(cursor<resources.length){const index=cursor++,r=resources[index];
        try{
          if(Date.now()>deadline)throw new Error('Refresh time limit reached. Retry the remaining resources.');
          results[index]={...await resource(provider,bundle,r),status:'available',fetched_at:new Date().toISOString()};
        }catch(error){results[index]={resource_id:r.id,label:r.label,type:r.type,source:provider,status:'unavailable',metrics:[],error};}
      }
    }));
    return results;
  }
  function local(org,provider) {
    if(provider==='email_sms') return ['email','sms'].map(channel=>{
      const c=db.prepare("SELECT COUNT(*) total,SUM(status IN ('delivered','opened')) delivered,SUM(status='opened') opened,SUM(status='failed') failed FROM communication_deliveries WHERE organisation_id=? AND channel=? AND created_at>=?").get(org,channel,new Date(Date.now()-28*86400000).toISOString());
      return {label:channel==='email'?'Email delivery activity':'SMS delivery activity',source:'Oprun workspace delivery records',period:'Last 28 days',status:'available',fetched_at:new Date().toISOString(),metrics:[metric('recorded','Recorded messages',c.total),metric('delivered','Delivery receipts',c.delivered??0),metric('failed','Failed',c.failed??0),...(channel==='email'?[metric('opens','Open signals',c.opened??0,'Tracking signals are not proof a person read the email.')]:[])]};
    });
    const channel=provider==='whatsapp'?'whatsapp':provider==='website'?'website':null;
    if(!channel)return [];
    const c=db.prepare("SELECT COUNT(*) total,SUM(m.direction='inbound') inbound,SUM(m.direction='outbound') outbound FROM comms_messages m JOIN comms_threads t ON t.id=m.thread_id AND t.organisation_id=m.organisation_id WHERE m.organisation_id=? AND t.channel=? AND m.occurred_at>=?").get(org,channel,new Date(Date.now()-28*86400000).toISOString());
    return [{label:provider==='website'?'Website enquiries':'WhatsApp activity',source:'Oprun workspace records',period:'Last 28 days',status:'available',fetched_at:new Date().toISOString(),metrics:[metric('inbound','Recorded incoming messages',c.inbound??0),metric('outbound','Recorded outgoing messages',c.outbound??0)]}];
  }
  return {fetch,local};
}
