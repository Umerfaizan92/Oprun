// All network destinations are fixed provider origins. Resource and reply IDs
// come from server-verified selections, never arbitrary client URLs.
const id = encodeURIComponent;
const cut = (v, n = 5000) => String(v ?? '').slice(0, n);
// Links and previews shown to the user are rebuilt or checked here: https only,
// on the provider's own hosts. Anything else is dropped, never passed through.
export function providerLink(value, hosts) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? cut(u.href, 1500) : undefined;
  } catch { return undefined; }
}
// Images are fetched by the provider, not by Oprun. Only plain public https links are accepted.
export function publicImageUrl(value) {
  try {
    const u = new URL(String(value || '').trim()), h = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|onion)$/.test(h)) return null;
    return u.href.length <= 1500 ? u.href : null;
  } catch { return null; }
}
const when = v => { const d = typeof v === 'number' ? new Date(v * 1000) : new Date(String(v || '')); return Number.isFinite(d.getTime()) ? d.toISOString() : undefined; };
const total = (list, key) => { const values = list.map(v => v?.[key]); return values.length && values.every(v => Number.isFinite(Number(v)) && v !== null && v !== undefined) ? values.reduce((sum, v) => sum + Number(v), 0) : null; };
export const CHANNEL_PROVIDERS = {
  meta: 'Facebook & Instagram', whatsapp: 'WhatsApp Business', youtube: 'YouTube',
  gmail: 'Gmail', tiktok: 'TikTok', x: 'X', google_business: 'Google Business Profile',
  google_seo: 'Google Search & Analytics', snapchat: 'Snapchat', website: 'Website', email_sms: 'Email & SMS'
};
export function channelCapabilities(provider, type) {
  const read = ['meta', 'youtube', 'gmail', 'tiktok', 'x', 'google_business', 'whatsapp', 'email_sms', 'website', 'google_seo'].includes(provider);
  return { sync: read && (provider !== 'google_seo' || type === 'google_ads_customer'), post: provider === 'x' || provider === 'meta' && (type === 'facebook_page' || type === 'instagram_account') || provider === 'google_business' && type === 'google_business_location' || provider === 'tiktok' && type === 'tiktok_account' || provider === 'youtube' && type === 'youtube_channel',
    media: provider === 'meta' && (type === 'facebook_page' || type === 'instagram_account') || provider === 'tiktok' || provider === 'google_business' && type === 'google_business_location' || provider === 'youtube' || provider === 'x', media_required: provider === 'meta' && type === 'instagram_account' || provider === 'tiktok' || provider === 'youtube',
    reply: ['meta', 'youtube', 'gmail', 'google_business', 'x', 'whatsapp', 'email_sms'].includes(provider), video_upload: provider === 'tiktok',
    // Which kinds of media a post may carry. TikTok is video only; Facebook Pages and Instagram take either.
    image: provider === 'meta' && (type === 'facebook_page' || type === 'instagram_account') || provider === 'google_business' && type === 'google_business_location' || provider === 'x',
    video: provider === 'tiktok' || provider === 'youtube' || provider === 'x' || provider === 'meta' && (type === 'facebook_page' || type === 'instagram_account'),
    ads_launch: false, note: provider === 'whatsapp' || provider === 'email_sms' || provider === 'website'
      ? 'Messages and delivery receipts use the existing Unified Inbox. Provider setup and consent are required.'
      : provider === 'meta' ? 'Facebook Page and Instagram posts, comments and follower totals sync; comment replies need approval. Facebook posts (text or one image) need Page permission; Instagram posts need one public image. Instagram direct messages require an additional reviewed adapter.'
      : 'Only granted provider permissions apply. Video upload and paid-ad launch are not enabled by this adapter.' };
}
import {createMediaFetcher} from './media-fetch.js';
export function createChannelProviderClient({runtime, env = {}, fetchMedia = createMediaFetcher(), http = globalThis.fetch}) {
  const maxVideo = Math.min(500, Math.max(5, Number(env.MEDIA_MAX_MB) || 100)) * 1048576;
  const call = (url, token, options = {}) => runtime.requestJson(url, {...options, headers: {authorization: 'Bearer ' + token, ...options.headers}});
  const json = (method, body) => ({method, headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const graph = 'https://graph.facebook.com/' + String(env.META_GRAPH_VERSION || 'v23.0') + '/';
  // Page actions use the Page's own token, issued only for Pages this authorisation manages.
  async function pageToken(token, pageId) {
    const pages = await call(graph + 'me/accounts?fields=id,access_token,instagram_business_account{id}', token), page = pages.data?.find(p => String(p.id) === String(pageId));
    if (!page?.access_token) throw Object.assign(new Error('The selected Facebook Page is not managed by this authorisation. Reconnect Meta.'), {status:403});
    return page;
  }
  async function sync(provider, bundle, resource) {
    const token = bundle.access_token, items = [], metrics = [];
    const add = (remote_id, kind, title, text, extra = {}) => items.push({remote_id: cut(remote_id, 300), kind, title: cut(title, 300), text: cut(text, 12000), ...extra});
    if (provider === 'youtube') {
      const channels = await call('https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&mine=true', token);
      const channel = channels.items?.find(c => c.id === resource.id);
      if (!channel) throw Object.assign(new Error('The selected YouTube channel is not owned by this authorisation.'), {status:403});
      for (const [key, value] of Object.entries(channel.statistics || {})) if (/^(subscriberCount|videoCount|viewCount)$/.test(key)) metrics.push({key, value:Number(value), source:'YouTube'});
      const playlist = channel.contentDetails?.relatedPlaylists?.uploads;
      if (playlist) {
        const videos = await call('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=20&playlistId=' + id(playlist), token);
        for (const v of videos.items || []) {
          const vid = String(v.snippet?.resourceId?.videoId || '');
          if (/^[\w-]{6,20}$/.test(vid)) add(vid, 'video', v.snippet?.title, v.snippet?.description, {url:'https://www.youtube.com/watch?v=' + vid, thumbnail:'https://i.ytimg.com/vi/' + vid + '/mqdefault.jpg', embed:'https://www.youtube.com/embed/' + vid, occurred_at:when(v.snippet?.publishedAt)});
        }
      }
      const comments = await call('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=30&textFormat=plainText&allThreadsRelatedToChannelId=' + id(resource.id), token);
      for (const thread of comments.items || []) {
        const c = thread.snippet?.topLevelComment;
        const vid = String(thread.snippet?.videoId || '');
        if (c?.id) add(c.id, 'comment', c.snippet?.authorDisplayName, c.snippet?.textDisplay, {can_reply:Boolean(thread.snippet?.canReply), parent_id:/^[\w-]{6,20}$/.test(vid) ? vid : undefined, occurred_at:when(c.snippet?.publishedAt), metrics:{likes:c.snippet?.likeCount, replies:thread.snippet?.totalReplyCount}, ...(/^[\w-]{6,20}$/.test(vid) ? {url:'https://www.youtube.com/watch?v=' + vid + '&lc=' + id(c.id)} : {})});
      }
    } else if (provider === 'meta' && resource.type === 'facebook_page') {
      if (!/^\d{3,32}$/.test(resource.id)) throw new Error('Invalid Facebook Page selection.');
      const page = await pageToken(token, resource.id), pt = page.access_token;
      const info = await call(graph + id(resource.id) + '?fields=followers_count,fan_count', pt);
      for (const [key, field] of [['followers','followers_count'],['page_likes','fan_count']]) if (Number.isFinite(Number(info[field])) && info[field] !== null && info[field] !== undefined) metrics.push({key, value:Number(info[field]), source:'Facebook Page'});
      const posts = await call(graph + id(resource.id) + '/posts?limit=20&fields=id,message,created_time,permalink_url,full_picture,comments.limit(15){id,message,created_time,from{name}}', pt);
      for (const p of posts.data || []) {
        add(p.id, 'post', 'Facebook post', p.message, {url:providerLink(p.permalink_url, ['facebook.com']), thumbnail:providerLink(p.full_picture, ['fbcdn.net']), occurred_at:when(p.created_time)});
        for (const c of p.comments?.data || []) if (c?.id) add(c.id, 'comment', c.from?.name || 'Facebook comment', c.message, {can_reply:true, parent_id:cut(p.id, 300), occurred_at:when(c.created_time)});
      }
    } else if (provider === 'meta' && resource.type === 'instagram_account') {
      if (!/^\d{3,32}$/.test(resource.id) || !/^\d{3,32}$/.test(resource.parent_id || '')) throw new Error('Invalid Instagram selection.');
      const page = await pageToken(token, resource.parent_id);
      if (String(page.instagram_business_account?.id || '') !== resource.id) throw Object.assign(new Error('The Instagram account is no longer linked to the selected Facebook Page. Reconnect Meta.'), {status:403});
      const info = await call(graph + id(resource.id) + '?fields=followers_count,media_count', token);
      for (const [key, field] of [['followers','followers_count'],['posts','media_count']]) if (Number.isFinite(Number(info[field])) && info[field] !== null && info[field] !== undefined) metrics.push({key, value:Number(info[field]), source:'Instagram'});
      const media = await call(graph + id(resource.id) + '/media?limit=20&fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,comments.limit(15){id,text,username,timestamp}', token);
      const list = media.data || [], igHosts = ['cdninstagram.com', 'fbcdn.net'];
      for (const m of list) {
        add(m.id, m.media_type === 'VIDEO' || m.media_type === 'REELS' ? 'video' : 'post', 'Instagram post', m.caption, {url:providerLink(m.permalink, ['instagram.com']), thumbnail:providerLink(m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url, igHosts), occurred_at:when(m.timestamp), metrics:{likes:m.like_count, comments:m.comments_count}});
        for (const c of m.comments?.data || []) if (c?.id) add(c.id, 'comment', c.username || 'Instagram comment', c.text, {can_reply:true, parent_id:cut(m.id, 300), occurred_at:when(c.timestamp)});
      }
      const sample = 'Instagram / latest ' + list.length + ' posts';
      for (const [key, field] of [['likes','like_count'],['comments','comments_count']]) metrics.push({key, value:total(list, field), source:sample});
    } else if (provider === 'gmail') {
      const profile = await call('https://gmail.googleapis.com/gmail/v1/users/me/profile', token);
      if (profile.emailAddress?.toLowerCase() !== resource.id.toLowerCase()) throw Object.assign(new Error('Mailbox ownership changed. Reconnect Gmail.'), {status:403});
      metrics.push({key:'mailbox_messages', value:Number(profile.messagesTotal), source:'Gmail'});
      const list = await call('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX', token);
      for (const ref of list.messages || []) {
        const m = await call('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + id(ref.id) + '?format=full', token);
        const headers = Object.fromEntries((m.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
        const address = cut(headers['reply-to'] || headers.from, 300), recipient = address.match(/<([^>]+)>/)?.[1] || address;
        const plain = p => p?.mimeType === 'text/plain' && p.body?.data ? Buffer.from(p.body.data, 'base64url').toString('utf8') : (p?.parts || []).map(plain).filter(Boolean).join('\n');
        add(m.id, 'message', headers.subject, plain(m.payload) || m.snippet, {url:/^[0-9a-f]{6,32}$/i.test(m.threadId || '') ? 'https://mail.google.com/mail/?authuser=' + id(resource.id) + '#all/' + m.threadId : undefined, occurred_at:when(Number(m.internalDate) / 1000), thread_id:m.threadId, recipient, message_id:cut(headers['message-id'], 300), can_reply:/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(recipient)});
      }
    } else if (provider === 'google_business') {
      if (!/^accounts\/[^/]+$/.test(resource.parent_id || '') || !/^locations\/[^/]+$/.test(resource.id)) throw new Error('Invalid Business Profile selection.');
      const parent = resource.parent_id + '/' + resource.id;
      const reviews = await call('https://mybusiness.googleapis.com/v4/' + parent + '/reviews?pageSize=30', token);
      if (reviews.totalReviewCount !== undefined) metrics.push({key:'reviews', value:Number(reviews.totalReviewCount), source:'Google Business Profile'});
      for (const r of reviews.reviews || []) add(r.reviewId, 'review', r.reviewer?.displayName, r.comment, {can_reply:true, rating:r.starRating, reply:cut(r.reviewReply?.comment), occurred_at:when(r.createTime)});
      const posts = await call('https://mybusiness.googleapis.com/v4/' + parent + '/localPosts?pageSize=20', token);
      for (const p of posts.localPosts || []) add(p.name, 'post', p.topicType || 'Local post', p.summary, {url:providerLink(p.searchUrl, ['google.com']), occurred_at:when(p.createTime)});
    } else if (provider === 'google_seo' && resource.type === 'google_ads_customer') {
      if(!/^\d{6,20}$/.test(resource.id) || !env.GOOGLE_ADS_DEVELOPER_TOKEN)throw Object.assign(new Error('Connect an approved Google Ads customer account.'),{status:409});
      const version=/^v\d{1,3}$/.test(env.GOOGLE_ADS_API_VERSION||'')?env.GOOGLE_ADS_API_VERSION:'v26';
      const d=await call('https://googleads.googleapis.com/'+version+'/customers/'+resource.id+'/googleAds:search',token,{...json('POST',{query:'SELECT campaign.id, campaign.name, campaign.status, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS LIMIT 50'}),headers:{'content-type':'application/json','developer-token':env.GOOGLE_ADS_DEVELOPER_TOKEN,...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?{'login-customer-id':String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g,'')}:{})}});
      for(const r of d.results || [])add(String(r.campaign?.id),'ad_campaign',r.campaign?.name,r.campaign?.status,{metrics:r.metrics || {}});
      for(const key of ['clicks','impressions','costMicros','conversions']){
        const values=(d.results || []).map(r=>r.metrics?.[key]);
        metrics.push({key:key==='costMicros'?'cost_micros_account_currency':key,value:values.length&&values.every(v=>v!==undefined)?values.reduce((sum,v)=>sum+Number(v),0):null,source:'Google Ads '+resource.id+' / last 30 days / up to 50 campaigns'});
      }
    } else if (provider === 'tiktok') {
      const d = await call('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count', token, json('POST', {max_count:20}));
      if (d.error?.code && d.error.code !== 'ok') throw new Error('TikTok refused video access. Check the video.list permission.');
      const videos = d.data?.videos || [];
      for (const v of videos) {
        const vid = String(v.id || ''), caption = cut(v.video_description || v.title, 12000);
        add(vid, 'video', v.title || caption, caption === cut(v.title) ? '' : caption, {
          url:providerLink(v.share_url, ['tiktok.com']), thumbnail:providerLink(v.cover_image_url, ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com']),
          embed:/^\d{6,32}$/.test(vid) ? 'https://www.tiktok.com/player/v1/' + vid : undefined, occurred_at:when(Number(v.create_time)), duration_seconds:Number.isFinite(Number(v.duration)) ? Number(v.duration) : undefined,
          metrics:{views:v.view_count, likes:v.like_count, comments:v.comment_count, shares:v.share_count}});
      }
      const sample = 'TikTok / latest ' + videos.length + ' videos';
      metrics.push({key:'videos_in_sample', value:videos.length, source:sample});
      for (const [key, field] of [['views','view_count'],['likes','like_count'],['comments','comment_count'],['shares','share_count']]) metrics.push({key, value:total(videos, field), source:sample});
      if (String(bundle.scope || '').split(/[ ,]+/).includes('user.info.stats')) {
        // Profile totals need a separately granted permission; without it they are simply not shown.
        const profile = await call('https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count', token).catch(() => null), u = profile?.data?.user || {};
        for (const [key, field] of [['followers','follower_count'],['profile_likes','likes_count'],['profile_videos','video_count']]) if (Number.isFinite(Number(u[field])) && u[field] !== null && u[field] !== undefined) metrics.push({key, value:Number(u[field]), source:'TikTok profile'});
      }
    } else if (provider === 'x') {
      const me = await call('https://api.x.com/2/users/me', token);
      if (me.data?.id !== resource.id) throw Object.assign(new Error('The X account no longer matches this workspace selection.'), {status:403});
      const d = await call('https://api.x.com/2/users/' + id(resource.id) + '/tweets?max_results=20&tweet.fields=public_metrics,created_at', token);
      for (const p of d.data || []) add(p.id, 'post', 'X post', p.text, {can_reply:true, metrics:p.public_metrics || {}, url:/^\d{5,32}$/.test(String(p.id)) ? 'https://x.com/i/web/status/' + p.id : undefined, occurred_at:when(p.created_at)});
    } else throw Object.assign(new Error('Use this service’s existing inbox or insights workflow; content sync is not enabled.'), {status:409});
    return {items:items.slice(0,100), metrics, fetched_at:new Date().toISOString(), coverage:'Bounded recent sample, not complete provider history'};
  }
  // Approved WhatsApp utility templates for the selected number's business account.
  async function templates(bundle, resource) {
    if (resource.type !== 'whatsapp_phone' || !/^\d{3,32}$/.test(resource.parent_id || '')) throw Object.assign(new Error('Choose a WhatsApp phone number.'), {status:409});
    const d = await call(graph + id(resource.parent_id) + '/message_templates?fields=name,language,status,category,components&limit=100', bundle.access_token);
    return (d.data || []).filter(t => t.status === 'APPROVED' && t.category === 'UTILITY' && /^[a-z0-9_]{1,512}$/.test(t.name || '') && /^[a-z]{2,3}(_[A-Z]{2})?$/.test(t.language || '')).map(t => {
      const comps = t.components || [], body = cut(comps.find(c => c.type === 'BODY')?.text, 1024);
      const params = Math.max(0, ...[...body.matchAll(/\{\{(\d{1,2})\}\}/g)].map(m => Number(m[1])));
      // Header media, buttons with variables or named parameters need richer input; they are listed as unavailable.
      const simple = comps.every(c => c.type === 'BODY' || c.type === 'FOOTER' || (c.type === 'HEADER' && c.format === 'TEXT' && !/\{\{/.test(c.text || '')) || (c.type === 'BUTTONS' && (c.buttons || []).every(b => !/\{\{/.test(b.url || '')))) && !/\{\{[^\d}]/.test(body);
      return {name:t.name, language:t.language, body, params, available:simple && params <= 10};
    });
  }
  async function execute(provider, bundle, resource, draft, item) {
    const token = bundle.access_token, text = draft.body;
    if (draft.kind === 'reply') {
      if (!item?.can_reply) throw Object.assign(new Error('This item cannot receive a reply.'), {status:409});
      if (provider === 'whatsapp' && draft.template_json) {
        const t = JSON.parse(draft.template_json), current = (await templates(bundle, resource)).find(x => x.name === t.name && x.language === t.language);
        if (!current?.available || current.params !== t.params.length) throw Object.assign(new Error('This template is no longer approved. Create a new draft.'), {status:409});
        if (!/^\+[1-9]\d{7,14}$/.test(item.recipient || '')) throw Object.assign(new Error('Invalid WhatsApp recipient.'), {status:400});
        const template = {name:t.name, language:{code:t.language}, ...(t.params.length ? {components:[{type:'body', parameters:t.params.map(v => ({type:'text', text:cut(v, 1000)}))}]} : {})};
        return call(graph + id(resource.id) + '/messages', token, json('POST', {messaging_product:'whatsapp', to:item.recipient.slice(1), type:'template', template})).then(d => ({id:d.messages?.[0]?.id}));
      }
      if (provider === 'whatsapp') {
        if (!/^\+[1-9]\d{7,14}$/.test(item.recipient || '') || Date.now()-Date.parse(item.occurred_at)>86400000 || Date.parse(item.occurred_at)>Date.now()+60000 || !Number.isFinite(Date.parse(item.occurred_at))) throw Object.assign(new Error('The WhatsApp reply window is closed.'),{status:409});
        return call(graph + id(resource.id) + '/messages', token, json('POST',{messaging_product:'whatsapp',to:item.recipient.slice(1),type:'text',text:{body:text}})).then(d=>({id:d.messages?.[0]?.id}));
      }
      if (provider === 'email_sms' && resource.id === 'email') {
        if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(item.recipient || '')) throw new Error('Invalid email recipient.');
        return call('https://api.resend.com/emails',bundle.email.api_key,json('POST',{from:bundle.email.sender,to:[item.recipient],subject:'Re: '+cut(item.title || 'Your enquiry',180).replace(/[\r\n]/g,' '),text}));
      }
      if (provider === 'email_sms' && resource.id === 'sms') {
        if (!/^\+[1-9]\d{7,14}$/.test(item.recipient || '')) throw new Error('Invalid SMS recipient.');
        return call('https://api.telnyx.com/v2/messages',bundle.sms.api_key,json('POST',{from:bundle.sms.number,to:item.recipient,text})).then(d=>({id:d.data?.id}));
      }
      if (provider === 'meta') {
        if (item.kind !== 'comment' || !/^[\w.-]{3,120}$/.test(String(item.remote_id || ''))) throw Object.assign(new Error('Only synced comments can receive a reply.'), {status:409});
        if (resource.type === 'facebook_page') {
          const page = await pageToken(token, resource.id);
          return call(graph + id(item.remote_id) + '/comments', page.access_token, json('POST', {message:text}));
        }
        if (resource.type === 'instagram_account') {
          if ([...text].length > 2200) throw Object.assign(new Error('Shorten the Instagram reply to 2,200 characters.'), {status:400});
          return call(graph + id(item.remote_id) + '/replies', token, json('POST', {message:text}));
        }
        throw Object.assign(new Error('Replies are not enabled for this Meta resource.'), {status:409});
      }
      if (provider === 'youtube') return call('https://www.googleapis.com/youtube/v3/comments?part=snippet', token, json('POST', {snippet:{parentId:item.remote_id, textOriginal:text}}));
      if (provider === 'google_business') {
        const path = resource.parent_id + '/' + resource.id + '/reviews/' + id(item.remote_id) + '/reply';
        // ReviewReply acknowledges an update with updateTime, rather than an ID.
        return call('https://mybusiness.googleapis.com/v4/' + path, token, json('PUT', {comment:text})).then(d => ({id:d.updateTime ? path : undefined}));
      }
      if (provider === 'gmail') {
        if (/[\r\n]/.test(item.recipient + item.message_id) || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(item.recipient)) throw new Error('Unsafe reply headers.');
        const subject = 'Re: ' + cut(item.title, 180).replace(/[\r\n]/g, ' ');
        const raw = ['To: ' + item.recipient, 'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=', ...(item.message_id ? ['In-Reply-To: ' + item.message_id, 'References: ' + item.message_id] : []), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(text).toString('base64').match(/.{1,76}/g).join('\r\n')].join('\r\n');
        return call('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', token, json('POST', {raw:Buffer.from(raw).toString('base64url'), threadId:item.thread_id}));
      }
      if (provider !== 'x') throw Object.assign(new Error('Replies are not enabled for this provider.'), {status:409});
    }
    if (provider === 'x') {
      if ([...text].length > 280) throw Object.assign(new Error('Shorten the X post to 280 characters.'), {status:400});
      const xMedia = draft.kind === 'post' && draft.media_url ? publicImageUrl(draft.media_url) : null;
      const mediaIds = xMedia ? [await uploadToX(bundle, xMedia, JSON.parse(draft.options_json || '{}').media_kind === 'video')] : [];
      return call('https://api.x.com/2/tweets', token, json('POST', {text, ...(mediaIds.length ? {media:{media_ids:mediaIds}} : {}), ...(draft.kind === 'reply' ? {reply:{in_reply_to_tweet_id:item.remote_id}} : {})}));
    }
    const media = draft.media_url ? publicImageUrl(draft.media_url) : null;
    const opts = JSON.parse(draft.options_json || '{}'), isVideo = provider === 'tiktok' || provider === 'youtube' || opts.media_kind === 'video';
    if (draft.media_url && !media) throw Object.assign(new Error(provider === 'tiktok' ? 'The video link is not a public https link.' : 'The image link is not a public https link.'), {status:400});
    if (provider === 'google_business') {
      if ([...text].length > 1500) throw Object.assign(new Error('Shorten the Business Profile post to 1,500 characters.'), {status:400});
      return call('https://mybusiness.googleapis.com/v4/' + resource.parent_id + '/' + resource.id + '/localPosts', token, json('POST', {languageCode:'en', summary:text, topicType:'STANDARD', ...(media ? {media:[{mediaFormat:'PHOTO', sourceUrl:media}]} : {})}));
    }
    if (provider === 'youtube') {
      if (!media) throw Object.assign(new Error('YouTube posts need a public https video link.'), {status:400});
      const privacy = ['public', 'unlisted', 'private'].includes(opts.video_privacy) ? opts.video_privacy : null;
      if (!privacy) throw Object.assign(new Error('Choose who can see this YouTube video.'), {status:400});
      const mine = await call('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', token);
      if (!mine.items?.some(c => c.id === resource.id)) throw Object.assign(new Error('The selected YouTube channel is not owned by this authorisation.'), {status:403});
      const file = await fetchMedia(media, {kind:'video', maxBytes:maxVideo});
      const lines = text.split(/\r?\n/), title = cut(lines[0].replace(/[<>]/g, '').trim() || 'New video', 100), description = cut(lines.slice(1).join('\n').replace(/[<>]/g, '').trim(), 5000);
      const start = await http('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {method:'POST', headers:{authorization:'Bearer ' + token, 'content-type':'application/json; charset=UTF-8', 'x-upload-content-type':file.type, 'x-upload-content-length':String(file.size)}, body:JSON.stringify({snippet:{title, description}, status:{privacyStatus:privacy, selfDeclaredMadeForKids:false}})});
      const session = start.headers.get('location') || '';
      if (!start.ok || !/^https:\/\/www\.googleapis\.com\/upload\/youtube\/v3\/videos\?/.test(session)) throw Object.assign(new Error('YouTube did not accept the upload (' + start.status + '). Check the channel permissions.'), {status:start.status === 403 ? 403 : 400});
      const up = await http(session, {method:'PUT', headers:{authorization:'Bearer ' + token, 'content-type':file.type}, body:file.body});
      const done = await up.json().catch(() => ({}));
      if (!up.ok || !/^[\w-]{6,20}$/.test(String(done.id || ''))) throw Object.assign(new Error('YouTube did not finish the upload (' + up.status + '). Nothing else was sent.'), {status:400});
      return {id:done.id, url:'https://www.youtube.com/watch?v=' + done.id};
    }
    if (provider === 'tiktok') {
      if (!media) throw Object.assign(new Error('TikTok posts need a public https video link.'), {status:400});
      if (!String(bundle.scope || '').split(/[ ,]+/).includes('video.publish')) throw Object.assign(new Error('TikTok posting permission (video.publish) was not granted. Reconnect TikTok after the app is approved for posting.'), {status:403});
      const privacy = JSON.parse(draft.options_json || '{}').privacy_level, creator = await tiktokCreatorInfo(bundle);
      if (!creator.privacy_levels.includes(privacy)) throw Object.assign(new Error('Choose who can see this video from the options TikTok allows for this account.'), {status:409});
      if ([...text].length > 2200) throw Object.assign(new Error('Shorten the TikTok caption to 2,200 characters.'), {status:400});
      const init = await call('https://open.tiktokapis.com/v2/post/publish/video/init/', token, json('POST', {post_info:{title:text, privacy_level:privacy, disable_comment:creator.comment_disabled, disable_duet:creator.duet_disabled, disable_stitch:creator.stitch_disabled}, source_info:{source:'PULL_FROM_URL', video_url:media}}));
      const publish = String(init.data?.publish_id || '');
      if (init.error?.code && init.error.code !== 'ok' || !/^[\w.~-]{4,200}$/.test(publish)) throw Object.assign(new Error('TikTok did not accept the video. Check the link and that its domain is verified with TikTok.'), {status:400});
      // TikTok has the video now: never start a second post. Report failure only when TikTok says so.
      for (let i = 0; i < 5; i++) {
        const st = await call('https://open.tiktokapis.com/v2/post/publish/status/fetch/', token, json('POST', {publish_id:publish}));
        const state = st.data?.status;
        if (state === 'PUBLISH_COMPLETE') return {id:publish};
        if (state === 'FAILED') throw Object.assign(new Error('TikTok could not publish the video (' + cut(st.data?.fail_reason || 'unknown reason', 100) + ').'), {status:400});
        await new Promise(done => setTimeout(done, Number(env.TIKTOK_PUBLISH_POLL_MS ?? 3000)));
      }
      return {id:publish, processing:true};
    }
    if (provider === 'meta' && resource.type === 'facebook_page') {
      const pages = await call(graph + 'me/accounts?fields=id,access_token', token), page = pages.data?.find(p => String(p.id) === resource.id);
      if (!page?.access_token) throw Object.assign(new Error('Facebook Page posting permission is required.'), {status:403});
      if (media && isVideo) return call(graph.replace('://graph.', '://graph-video.') + id(resource.id) + '/videos', page.access_token, json('POST', {file_url:media, description:text})).then(d => ({id:d.id}));
      if (media) return call(graph + id(resource.id) + '/photos', page.access_token, json('POST', {url:media, caption:text})).then(d => ({id:d.post_id || d.id}));
      return call(graph + id(resource.id) + '/feed', page.access_token, json('POST', {message:text}));
    }
    if (provider === 'meta' && resource.type === 'instagram_account') {
      if (!media) throw Object.assign(new Error('Instagram posts need an image or video link.'), {status:400});
      if ([...text].length > 2200) throw Object.assign(new Error('Shorten the Instagram caption to 2,200 characters.'), {status:400});
      const page = await pageToken(token, resource.parent_id);
      if (String(page.instagram_business_account?.id || '') !== resource.id) throw Object.assign(new Error('The Instagram account is no longer linked to the selected Facebook Page. Reconnect Meta.'), {status:403});
      const container = await call(graph + id(resource.id) + '/media', token, json('POST', isVideo ? {media_type:'REELS', video_url:media, caption:text, share_to_feed:true} : {image_url:media, caption:text}));
      if (!/^\d{3,32}$/.test(String(container.id || ''))) throw Object.assign(new Error(isVideo ? 'Instagram did not accept the video.' : 'Instagram did not accept the image.'), {status:400});
      // Instagram prepares the image before it can be published. Wait briefly; never publish twice.
      for (let i = 0; ; i++) {
        const state = await call(graph + id(container.id) + '?fields=status_code', token);
        if (state.status_code === 'FINISHED') break;
        if (state.status_code === 'ERROR' || state.status_code === 'EXPIRED') throw Object.assign(new Error(isVideo ? 'Instagram could not process the video. Reels need MP4 or MOV, 3 seconds to 15 minutes.' : 'Instagram could not process the image. Check the link and the image size.'), {status:400});
        if (i >= (isVideo ? 20 : 5)) throw Object.assign(new Error('Instagram is still processing the ' + (isVideo ? 'video' : 'image') + '. Nothing was published; try again later.'), {status:409});
        await new Promise(done => setTimeout(done, Number(env.META_MEDIA_POLL_MS ?? 2000)));
      }
      return call(graph + id(resource.id) + '/media_publish', token, json('POST', {creation_id:container.id}));
    }
    throw Object.assign(new Error('Publishing is not enabled for this provider or content type.'), {status:409});
  }
  // X: photo or video through the v2 chunked upload (needs the media.write permission), then one post.
  async function uploadToX(bundle, link, isVideo) {
    if (!String(bundle.scope || '').split(/[ ,]+/).includes('media.write')) throw Object.assign(new Error('Reconnect X to allow photo and video posts (media.write permission).'), {status:403});
    const token = bundle.access_token, file = await fetchMedia(link, {kind:isVideo ? 'video' : 'image', maxBytes:isVideo ? maxVideo : 5 * 1048576});
    const init = await call('https://api.x.com/2/media/upload/initialize', token, json('POST', {media_type:file.type, total_bytes:file.size, media_category:isVideo ? 'tweet_video' : 'tweet_image'}));
    const mid = String(init.data?.id || '');
    if (!/^\d{5,30}$/.test(mid)) throw Object.assign(new Error('X did not accept the media.'), {status:400});
    const step = 4 * 1048576;
    for (let i = 0, at = 0; at < file.size; i++, at += step) {
      const form = new FormData(); form.append('segment_index', String(i)); form.append('media', new Blob([file.body.subarray(at, at + step)], {type:file.type}), 'media');
      const r = await http('https://api.x.com/2/media/upload/' + mid + '/append', {method:'POST', headers:{authorization:'Bearer ' + token}, body:form});
      if (!r.ok) throw Object.assign(new Error('X stopped the upload (' + r.status + '). Nothing was posted.'), {status:400});
    }
    let info = (await call('https://api.x.com/2/media/upload/' + mid + '/finalize', token, json('POST', {}))).data?.processing_info;
    for (let i = 0; info && info.state !== 'succeeded'; i++) {
      if (info.state === 'failed') throw Object.assign(new Error('X could not process the ' + (isVideo ? 'video' : 'image') + '. Nothing was posted.'), {status:400});
      if (i >= 20) throw Object.assign(new Error('X is still processing the video. Nothing was posted; try again later.'), {status:409});
      await new Promise(done => setTimeout(done, env.X_MEDIA_POLL_MS !== undefined ? Number(env.X_MEDIA_POLL_MS) : Math.min(10, Math.max(1, Number(info.check_after_secs) || 2)) * 1000));
      info = (await call('https://api.x.com/2/media/upload?command=STATUS&media_id=' + mid, token)).data?.processing_info;
    }
    return mid;
  }
  // What this TikTok account may post right now. TikTok requires the creator to choose visibility.
  async function tiktokCreatorInfo(bundle) {
    const d = await call('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', bundle.access_token, json('POST', {}));
    if (d.error?.code && d.error.code !== 'ok') throw Object.assign(new Error('TikTok will not accept posts from this account right now (' + cut(d.error.code, 60) + ').'), {status:409});
    const u = d.data || {}, allowed = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
    return {nickname:cut(u.creator_nickname, 100), privacy_levels:(u.privacy_level_options || []).filter(v => allowed.includes(v)), comment_disabled:Boolean(u.comment_disabled), duet_disabled:Boolean(u.duet_disabled), stitch_disabled:Boolean(u.stitch_disabled), max_video_seconds:Number(u.max_video_post_duration_sec) || null};
  }
  return {sync, execute, templates, tiktokCreatorInfo};
}
