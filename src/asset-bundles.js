// TR-72: first-load speed for the Business Workspace and the Operator Console. The pages list ~50 stylesheets and
// ~80 small scripts; on a phone every file costs a round trip and every stylesheet blocks the first paint. When a page
// is served, its files are joined into a few bundles (same order, same content) and minified when esbuild is
// available. Source files and the HTML in the repository are unchanged; ASSET_BUNDLES=0 serves the page as written.
//   - stylesheets: all <link rel="stylesheet"> without a media attribute become one file at the place of the first
//     (cascade order kept; relative url() paths rewritten to absolute ones);
//   - scripts: consecutive deferred scripts that are self-contained (an IIFE, or plain window.* assignments) become
//     one deferred file at the place of the first; each file runs inside its own try/catch so one failing file does
//     not stop the others (as with separate tags). Scripts with top-level declarations, modules and blocking scripts
//     stay as they are, and they split the groups so the execution order is unchanged.
// Bundles are kept in memory, addressed by a content hash and cached by browsers for a year.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ATTR = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')); return m ? (m[2] ?? m[3]) : null; };
const HAS = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag);
const stripComments = (code) => code.replace(/^﻿/, '').replace(/^(\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*/, '').trimStart();
/** Self-contained: an IIFE, or only window.X = … assignments (no top-level let/const/class/function shared with others). */
export function selfContained(code) {
  const c = stripComments(code);
  if (/^[;!]?\s*\(\s*(\(\s*[\w\s,]*\)\s*=>|function\b|async\b)/.test(c)) return true;
  if (/^window\.[\w$]+\s*=/.test(c) && !/^(const|let|var|class|function)\s/m.test(c)) return true;
  return false;
}

export function createAssetBundler({ root, enabled = process.env.ASSET_BUNDLES !== '0', production = process.env.NODE_ENV === 'production', log = console }) {
  const bundles = new Map(); // name -> { body, type }
  const pages = new Map();   // page file -> { stamp, html }
  let esbuildLoad = null;
  const minifier = () => (process.env.ASSET_MINIFY === '0' ? Promise.resolve(null) : (esbuildLoad ||= import('esbuild').catch(() => null))); // only in installs that include esbuild
  const localFile = (pageFile, ref) => {
    const clean = String(ref).split(/[?#]/)[0];
    if (/^[a-z]+:|^\/\//i.test(clean)) return null; // other sites are never bundled
    const abs = clean.startsWith('/') ? path.join(root, clean) : path.join(root, path.dirname(pageFile), clean);
    const rel = path.relative(root, abs);
    return rel.startsWith('..') || !fs.existsSync(abs) ? null : rel.split(path.sep).join('/');
  };
  const rewriteUrls = (css, rel) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => (/^(data:|https?:|\/|#)/i.test(u) ? all : `url(${q}/${path.posix.normalize(path.posix.join(path.posix.dirname(rel), u))}${q})`));
  async function build(files, type) {
    const em = await minifier();
    let out = '';
    for (const f of files) {
      let code = fs.readFileSync(path.join(root, f), 'utf8');
      if (type === 'css') { code = rewriteUrls(code, f); if (em) try { code = (await em.transform(code, { loader: 'css', minify: true, legalComments: 'none' })).code; } catch (e) { log.warn?.('[bundles] css kept as written:', f, String(e.message).slice(0, 120)); } out += `/* ${f} */\n${code}\n`; }
      else { if (em) try { code = (await em.transform(code, { loader: 'js', minify: true, legalComments: 'none', target: 'es2020' })).code; } catch { /* keep as written */ } out += `/* ${f} */\ntry{\n${code}\n}catch(e){console.error('[bundle] ${f}',e)}\n`; }
    }
    const name = crypto.createHash('sha256').update(out).digest('hex').slice(0, 16) + '.' + type;
    bundles.set(name, { body: out, type });
    return '/saas/__b/' + name;
  }
  async function transform(pageFile) {
    const html = fs.readFileSync(path.join(root, pageFile), 'utf8');
    const tags = [...html.matchAll(/<link\b[^>]*>|<script\b[^>]*>\s*<\/script>/gi)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
    // Stylesheets (no media attribute): one bundle at the first one's place.
    const css = tags.filter((t) => /^<link/i.test(t.text) && /stylesheet/i.test(ATTR(t.text, 'rel') || '') && !HAS(t.text, 'media') && localFile(pageFile, ATTR(t.text, 'href') || ''));
    // Deferred self-contained scripts, grouped between any script that must stay on its own.
    const groups = []; let cur = [];
    for (const t of tags.filter((x) => /^<script/i.test(x.text))) {
      const src = ATTR(t.text, 'src'), file = src && localFile(pageFile, src);
      const deferred = HAS(t.text, 'defer') && !/module/i.test(ATTR(t.text, 'type') || '') && !HAS(t.text, 'async');
      if (!deferred && !/module/i.test(ATTR(t.text, 'type') || '')) continue; // blocking scripts are not in the deferred queue
      if (deferred && file && selfContained(fs.readFileSync(path.join(root, file), 'utf8'))) cur.push({ ...t, file });
      else { if (cur.length) groups.push(cur); cur = []; }
    }
    if (cur.length) groups.push(cur);
    const edits = [];
    if (css.length > 1) { const href = await build(css.map((t) => localFile(pageFile, ATTR(t.text, 'href'))), 'css'); edits.push({ at: css[0], text: `<link rel="stylesheet" href="${href}" data-bundle="${css.length} stylesheets">` }, ...css.slice(1).map((t) => ({ at: t, text: '' }))); }
    for (const g of groups.filter((x) => x.length > 1)) { const src = await build(g.map((t) => t.file), 'js'); edits.push({ at: g[0], text: `<script defer src="${src}" data-bundle="${g.length} scripts"></script>` }, ...g.slice(1).map((t) => ({ at: t, text: '' }))); }
    let outHtml = html;
    for (const e of edits.sort((a, b) => b.at.start - a.at.start)) outHtml = outHtml.slice(0, e.at.start) + e.text + outHtml.slice(e.at.end);
    return outHtml;
  }
  // A stamp of every file the page uses, so edits are picked up without a restart outside production.
  const stamp = (pageFile) => { const html = fs.readFileSync(path.join(root, pageFile), 'utf8'); let s = fs.statSync(path.join(root, pageFile)).mtimeMs; for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) { const f = localFile(pageFile, m[1]); if (f) s += fs.statSync(path.join(root, f)).mtimeMs; } return s; };

  function page(pageFile) {
    return async (req, res, next) => {
      if (!enabled) return next();
      try {
        const cached = pages.get(pageFile), st = production && cached ? cached.stamp : stamp(pageFile);
        if (!cached || cached.stamp !== st) pages.set(pageFile, { stamp: st, html: await transform(pageFile) });
        res.set('Cache-Control', 'no-cache').type('html').send(pages.get(pageFile).html);
      } catch (e) { log.warn?.('[bundles] serving the page unbundled:', String(e.message || e).slice(0, 160)); next(); }
    };
  }
  function asset(req, res) {
    const b = bundles.get(String(req.params.file || ''));
    if (!b) return res.status(404).type('text').send('Not found');
    res.set('Cache-Control', 'public, max-age=31536000, immutable').type(b.type === 'css' ? 'text/css' : 'application/javascript').send(b.body);
  }
  return { page, asset, transform, bundles };
}
