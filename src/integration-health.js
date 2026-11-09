// Connection health, honest capability ticks and the before-you-connect checklist for the workspace Connections page
// (T-070). Pure functions: no database, no network. A connection is described the same way everywhere it is shown.

const DAY = 86400000;

// What a subscriber needs before pressing Connect. Most failed connections are role problems at the provider.
export const CONNECT_CHECKLIST = {
  meta: ['A Facebook Page for the business', 'Full control (admin) of that Page', 'For Instagram: a professional account linked to the Page'],
  whatsapp: ['A WhatsApp Business account in your own Meta business portfolio', 'A phone number registered to it', 'Admin access to that Meta business'],
  tiktok: ['The TikTok account you want to connect, signed in on this device'],
  youtube: ['The Google account that owns the YouTube channel (owner, not manager)'],
  google_business: ['A verified Google Business Profile', 'Owner or manager access to it'],
  google_seo: ['Access to the Search Console property and Analytics property for your website'],
  x: ['The X account you want to connect, signed in on this device'],
  snapchat: ['A Snapchat business account'],
  website: ['Access to your domain settings (DNS)'],
  email_sms: ['A Resend or Telnyx account in your own name', 'An API key from that provider (never your password)']
};

// What works in this build today, per provider. working = built; partial = built with the stated limit; not_yet = the
// provider offers it but this build does not; not_offered = the provider does not offer it to outside applications.
const W = 'working', N = 'not_yet', X = 'not_offered', P = (note) => ({ state: 'partial', note });
export const PROVIDER_ACTIONS = {
  meta: { post: P('Facebook Page text posts only'), video: N, messages: N, comments: N, reviews: X, insights: P('Followers and likes only') },
  whatsapp: { post: X, video: X, messages: P('Outgoing messages only; Meta charges per message'), comments: X, reviews: X, insights: N },
  tiktok: { post: N, video: N, messages: X, comments: N, reviews: X, insights: P('Profile counters and recent videos, where TikTok grants the permission') },
  youtube: { post: X, video: N, messages: X, comments: N, reviews: X, insights: P('Subscribers, views and video count') },
  google_business: { post: N, video: X, messages: X, comments: X, reviews: P('Reviews are read; replies go through approval'), insights: P('Search and Maps counters') },
  x: { post: P('Text posts only'), video: N, messages: N, comments: N, reviews: X, insights: P('Followers and post count') },
  snapchat: { post: N, video: N, messages: X, comments: X, reviews: X, insights: N }
};
export const ACTION_LABELS = { post: 'Posts', video: 'Video upload', messages: 'Messages', comments: 'Comments', reviews: 'Reviews', insights: 'Figures' };
export function providerActions(provider) {
  const set = PROVIDER_ACTIONS[provider];
  return set ? Object.entries(set).map(([key, v]) => ({ key, label: ACTION_LABELS[key], state: typeof v === 'string' ? v : v.state, note: typeof v === 'string' ? '' : v.note })) : [];
}

// Providers whose access can be renewed in the background with a refresh token. Meta and WhatsApp cannot.
const REFRESHABLE = new Set(['youtube', 'google_business', 'google_seo', 'tiktok', 'x', 'snapchat']);

/**
 * One light per connection: green (working), amber (action soon), red (reconnect), off (not connected).
 * `fix` is the single action that resolves it, as a button key the page understands.
 */
export function connectionHealth({ provider, status, settings = {}, now = Date.now() }) {
  const out = (level, title, detail, fix) => ({ level, title, detail, fix, checked_at: settings.health_checked_at || settings.last_tested_at || null });
  if (status !== 'connected') return out('off', 'Not connected', '', status === 'authorisation_pending' ? 'connect' : null);
  const oauth = !['website', 'email_sms'].includes(provider);
  const code = settings.diagnostic?.code;
  const time = (v) => (v ? new Date(v).getTime() : NaN);
  const expires = time(settings.expires_at), refreshExpires = time(settings.refresh_expires_at);
  const canRefresh = REFRESHABLE.has(provider) && !(Number.isFinite(refreshExpires) && refreshExpires <= now);

  if (oauth && settings.account_confirmed === false) return out('amber', 'Confirm the account', 'Check this is the right account for this business before it is used.', 'confirm');
  if (settings.last_test_status === 'fail' && ['reconnect_required', 'permission_required'].includes(code)) {
    return out('red', code === 'permission_required' ? 'Permission needed' : 'Reconnect needed', settings.diagnostic?.action || 'Sign in again on the provider screen.', 'connect');
  }
  if (oauth && Number.isFinite(refreshExpires) && refreshExpires <= now && REFRESHABLE.has(provider)) return out('red', 'Reconnect needed', 'The provider sign-in has expired.', 'connect');
  if (oauth && !canRefresh && Number.isFinite(expires) && expires <= now) return out('red', 'Reconnect needed', 'The provider sign-in has expired.', 'connect');
  if (settings.last_test_status === 'fail') return out('amber', 'Last check failed', settings.diagnostic?.action || 'Test the connection again.', 'test');
  if (oauth && !canRefresh && Number.isFinite(expires) && expires - now <= 7 * DAY) {
    return out('amber', 'Sign-in expires soon', 'Reconnect before ' + new Date(expires).toISOString().slice(0, 10) + ' to avoid an interruption.', 'connect');
  }
  if (oauth && Number.isFinite(refreshExpires) && refreshExpires - now <= 7 * DAY) {
    return out('amber', 'Sign-in expires soon', 'Reconnect before ' + new Date(refreshExpires).toISOString().slice(0, 10) + ' to avoid an interruption.', 'connect');
  }
  if (!settings.last_tested_at) return out('amber', 'Not checked yet', 'Run a test so this connection can be used.', 'test');
  if (oauth && Array.isArray(settings.resources) && settings.resources.length && !(settings.selected_resources || []).length) {
    return out('amber', 'Choose an account', 'Pick which Page, channel or number this business uses, then save.', 'select');
  }
  if (oauth && Array.isArray(settings.resources) && !settings.resources.length) return out('amber', 'Nothing to use yet', 'The provider returned no Page, channel or number for this sign-in.', 'test');
  if (settings.last_test_status === 'partial') return out('amber', 'Partly working', 'One or more services need attention.', 'test');
  return out('green', 'Working', '', null);
}

/** True when a connected OAuth row is due for its background check. */
export function healthCheckDue({ provider, status, settings = {}, now = Date.now(), everyMs = DAY }) {
  if (status !== 'connected' || ['website', 'email_sms'].includes(provider) || !settings.token_bundle) return false;
  const last = new Date(settings.health_checked_at || settings.last_tested_at || 0).getTime();
  return !Number.isFinite(last) || now - last >= everyMs;
}
