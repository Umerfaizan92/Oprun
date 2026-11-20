// T-179: signed, unguessable links to a business's own photos and videos, so a campaign email or a social platform can
// load them without signing in. A link names one file of one business and cannot be changed to reach another.
import crypto from 'node:crypto';

const secretOf = (env) => String(env.MEDIA_LINK_SECRET || env.SESSION_SECRET || env.SAAS_SESSION_SECRET || 'dev-unsubscribe-secret');
const sign = (env, org, id) => crypto.createHmac('sha256', secretOf(env)).update(`media:${org}:${id}`).digest('base64url').slice(0, 32);

export function mediaToken(env, org, id) {
  return `${Buffer.from(`${org}:${id}`).toString('base64url')}.${sign(env, org, id)}`;
}

export function readMediaToken(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  let org, id;
  try { [org, id] = Buffer.from(body, 'base64url').toString('utf8').split(':'); } catch { return null; }
  if (!org || !id) return null;
  const want = Buffer.from(sign(env, org, id)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  return { org, id };
}
