// T-051: smaller copies of a business's photos for its website. A photo from the media library is re-encoded to WebP
// at a few fixed widths, on first request, and kept next to the original. The original is never changed. If the image
// library cannot load or a file cannot be converted, the original is served instead, so a page never breaks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920];
const CONVERTIBLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function createImageVariants({ uploadRoot, log = console, loadSharp = () => import('sharp').then((m) => m.default || m) }) {
  let sharpPromise = null;
  const sharp = () => (sharpPromise ||= loadSharp().catch((e) => { log.warn?.('[images] image library unavailable, originals are served:', e.message); return null; }));
  const dirFor = (org) => path.join(uploadRoot, 'studio-variants', String(org).replace(/[^a-zA-Z0-9-]/g, ''));
  const pending = new Map();

  // Returns the path of a WebP copy at most `width` pixels wide, or null when the original should be served.
  async function variant(media, width) {
    if (!VARIANT_WIDTHS.includes(Number(width)) || media?.kind !== 'photo' || !CONVERTIBLE.has(media.mime_type)) return null;
    const source = path.join(uploadRoot, 'studio', String(media.organisation_id).replace(/[^a-zA-Z0-9-]/g, ''), path.basename(String(media.stored_name)));
    if (!fs.existsSync(source)) return null;
    const target = path.join(dirFor(media.organisation_id), `${String(media.id).replace(/[^a-zA-Z0-9-]/g, '')}-${width}.webp`);
    if (fs.existsSync(target)) return target;
    if (pending.has(target)) return pending.get(target);
    const job = (async () => {
      const lib = await sharp(); if (!lib) return null;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.${crypto.randomUUID()}.tmp`;
      try {
        // rotate() applies the camera orientation; metadata (including location) is not copied into the WebP.
        await lib(source, { limitInputPixels: 80_000_000 }).rotate().resize({ width: Number(width), withoutEnlargement: true }).webp({ quality: 80 }).toFile(tmp);
        fs.renameSync(tmp, target);
        return target;
      } catch (e) { fs.rmSync(tmp, { force: true }); log.warn?.('[images] could not convert a photo, the original is served:', e.message); return null; }
    })().finally(() => pending.delete(target));
    pending.set(target, job);
    return job;
  }
  // Removing a photo from the library removes its copies too.
  function removeAll(media) {
    for (const w of VARIANT_WIDTHS) fs.rmSync(path.join(dirFor(media.organisation_id), `${String(media.id).replace(/[^a-zA-Z0-9-]/g, '')}-${w}.webp`), { force: true });
  }
  return { variant, removeAll };
}

// Website builder: a photo link from the media library gets a responsive srcset of WebP copies.
export function responsiveAttrs(src) {
  const m = String(src || '').match(/^((?:https:\/\/[^/\s"'<>]+)?\/m\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!m) return null;
  return { src: `${m[1]}?w=960`, srcset: VARIANT_WIDTHS.map((w) => `${m[1]}?w=${w} ${w}w`).join(', '), sizes: '(max-width: 960px) 100vw, 960px' };
}
