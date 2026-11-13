// Safe download of a public image or video that a business asked Oprun to post (V2, 2026-11-14).
// Used only where a provider cannot fetch the link itself (YouTube and X uploads).
// Protections: https only; no credentials or ports in the link; every address the name resolves to must be
// public, and the connection is pinned to the checked address (no DNS rebinding); at most 3 redirects, each
// checked again; content type must match; size and time are capped; nothing is written to disk.
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';

const PRIVATE_V4 = [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]];
const v4 = (ip) => ip.split('.').reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;
export function isPublicAddress(ip) {
  if (net.isIPv4(ip)) return !PRIVATE_V4.some(([base, bits]) => (v4(ip) >>> (32 - bits)) === (v4(base) >>> (32 - bits)));
  if (net.isIPv6(ip)) {
    const a = ip.toLowerCase();
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); if (mapped) return isPublicAddress(mapped[1]);
    return !(a === '::' || a === '::1' || /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(a) || a.startsWith('2001:db8') || a.startsWith('64:ff9b') || a.startsWith('::'));
  }
  return false;
}
function checkLink(value) {
  let u; try { u = new URL(String(value || '').trim()); } catch { return null; }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !h.includes('.') || net.isIP(h) || /(^|\.)(localhost|local|internal|onion|test|invalid|example)$/.test(h)) return null;
  return u;
}
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function createMediaFetcher({ lookup = (h) => dns.lookup(h, { all: true }), request = https.request, timeoutMs = 60000 } = {}) {
  async function once(u, accept, maxBytes) {
    const addresses = await lookup(u.hostname).catch(() => []);
    if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) throw fail('The media link must point to a public website.');
    const pinned = addresses[0];
    return new Promise((resolve, reject) => {
      const req = request({ hostname: u.hostname, servername: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { 'user-agent': 'Oprun-media-fetch/1.0', accept },
        lookup: (_h, _o, cb) => cb(null, pinned.address, pinned.family), timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, u).href }); }
        if (res.statusCode !== 200) { res.resume(); return reject(fail('The media link answered ' + res.statusCode + '. Check that it is public.')); }
        const type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const declared = Number(res.headers['content-length'] || 0);
        if (declared > maxBytes) { res.destroy(); return reject(fail('The file is larger than ' + Math.round(maxBytes / 1048576) + ' MB.')); }
        const chunks = []; let size = 0;
        res.on('data', (c) => { size += c.length; if (size > maxBytes) { res.destroy(); reject(fail('The file is larger than ' + Math.round(maxBytes / 1048576) + ' MB.')); } else chunks.push(c); });
        res.on('end', () => resolve({ body: Buffer.concat(chunks), type }));
        res.on('error', () => reject(fail('The media download was interrupted.')));
      });
      req.on('timeout', () => req.destroy(fail('The media download took too long.')));
      req.on('error', (e) => reject(e.status ? e : fail('The media link could not be reached.')));
      req.end();
    });
  }
  // kind: 'image' or 'video'. Returns { body: Buffer, type, size }.
  return async function fetchMedia(link, { kind = 'video', maxBytes = 100 * 1048576 } = {}) {
    let u = checkLink(link); if (!u) throw fail('Use a public https link without a username, password or port.');
    const accept = kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/quicktime';
    for (let hop = 0; hop <= 3; hop++) {
      const r = await once(u, accept, maxBytes);
      if (r.redirect) { u = checkLink(r.redirect); if (!u) throw fail('The media link redirects somewhere that is not allowed.'); continue; }
      const ok = kind === 'image' ? /^image\/(jpeg|png|webp)$/.test(r.type) : /^video\/(mp4|quicktime)$/.test(r.type);
      if (!ok) throw fail(kind === 'image' ? 'The link is not a JPEG, PNG or WebP image.' : 'The link is not an MP4 or MOV video.');
      if (!r.body.length) throw fail('The media file is empty.');
      return { body: r.body, type: r.type, size: r.body.length };
    }
    throw fail('The media link redirects too many times.');
  };
}
