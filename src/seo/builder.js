// Phase 06 Module F: the website builder's page model, renderer and pre-publish checks. Pure functions.
// A page is a list of blocks (hero, text, services, areas, faq, cta, contact, image, gallery, reviews). Rendering escapes
// every value, produces one h1, accessible markup and responsive CSS from the business's brand colours. Reviews blocks
// show only reviews the business imported from a real source, with that source named.
import { gzipSync } from 'node:zlib';
import { checkClaims, draftText } from './content.js';
import { responsiveAttrs } from '../image-variants.js';

export const BLOCK_TYPES = ['hero', 'text', 'services', 'areas', 'faq', 'cta', 'contact', 'image', 'gallery', 'reviews',
  // W-05 (docs/ai-website/00_CONTRACT.md §6). Every value comes from the owner; nothing is invented by the renderer.
  'cinematic_hero', 'stats', 'process', 'projects', 'pricing', 'quote_form', 'emergency_banner', 'map', 'logos', 'faq_ai'];
// W-03..W-06 sections are offered only to businesses listed in WEBSITE_BUILDER_V2_ORGS ("*" for all) until tried live.
export const V2_BLOCK_TYPES = ['cinematic_hero', 'stats', 'process', 'projects', 'pricing', 'quote_form', 'emergency_banner', 'map', 'logos', 'faq_ai'];
export const v2Enabled = (owner, env = process.env) => { const list = String(env.WEBSITE_BUILDER_V2_ORGS || '').split(',').map((x) => x.trim()).filter(Boolean); return list.includes('*') || list.includes(String(owner)); };
export const TEMPLATES = {
  service: { name: 'Service page', blocks: ['hero', 'text', 'services', 'areas', 'faq', 'contact'] },
  home: { name: 'Home page', blocks: ['hero', 'services', 'text', 'areas', 'reviews', 'cta', 'contact'] },
  location: { name: 'Service-area page', blocks: ['hero', 'text', 'services', 'faq', 'contact'] },
  about: { name: 'About page', blocks: ['hero', 'text', 'image', 'contact'] },
  contact: { name: 'Contact page', blocks: ['hero', 'contact'] },
  article: { name: 'Blog article', blocks: ['hero', 'text', 'text', 'cta'] }
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u, { allowHash = true } = {}) => { const s = String(u || '').trim(); if (allowHash && /^#[\w-]*$/.test(s)) return s; if (/^\/(?!\/)[^\s]*$/.test(s)) return s; if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s; if (/^(tel|mailto):[^\s"'<>]+$/i.test(s)) return s; return ''; };

// --------------------------------------------------------------------------------- colour and contrast ---
function lum(hex) { const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i); if (!m) return null; const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrast(a, b) { const x = lum(a), y = lum(b); if (x === null || y === null) return null; const [hi, lo] = x > y ? [x, y] : [y, x]; return +((hi + 0.05) / (lo + 0.05)).toFixed(2); }
export function themeFrom(brand = {}) {
  const primary = /^#[0-9a-f]{6}$/i.test(brand.primary_color || '') ? brand.primary_color : '#1f4e79';
  const onPrimary = (contrast(primary, '#ffffff') || 0) >= 4.5 ? '#ffffff' : '#111827';
  return { primary, on_primary: onPrimary, text: '#1b1f24', muted: '#4b5563', background: '#ffffff', surface: '#f4f6f8', font: brand.font || 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' };
}

// --------------------------------------------------------------------------------- render ---
// A plain HTML form (no scripts) that posts to the business's inbox. Marketing consent is a separate, unticked box.
function contactForm(site, page, status, quote = null) {
  const back = `${site.mounted ? '' : `/sites/${site.slug}`}/${page.slug === 'home' ? '' : page.slug}`;
  return `${status === 'sent' ? '<p class="note" role="status">Thanks. Your message has been sent.</p>' : status === 'error' ? '<p class="note bad" role="alert">Please add your name, a message, and an email or phone number.</p>' : ''}<form class="form" method="post" action="/api/public/contact/${esc(site.slug)}"><input type="hidden" name="return_to" value="${esc(back)}"><label>Name<input name="name" required maxlength="120" autocomplete="name"></label><label>Email<input name="email" type="email" maxlength="254" autocomplete="email"></label><label>Phone<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>${quote ? quoteFields(quote) : ''}<label>${quote ? 'Tell us about the job' : 'How can we help?'}<textarea name="message" required rows="5" maxlength="5000"></textarea></label><label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label><label class="check"><input type="checkbox" name="marketing_consent" value="yes"> Send me news and offers. I can unsubscribe at any time.</label><button class="btn" type="submit">${quote ? 'Ask for a quote' : 'Send message'}</button><p class="small">We use your details only to reply to you${site.name ? ` (${esc(site.name)})` : ''}.</p></form>`;
}
const quoteFields = (q) => { const svc = (q.services || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 40); return `${svc.length ? `<label>Service<select name="service" required><option value="">Choose a service</option>${svc.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>` : `<label>Service<input name="service" maxlength="120"></label>`}<label>Suburb<input name="suburb" maxlength="120" autocomplete="address-level2"${q.suburb_required ? ' required' : ''}></label>`; };
// Map links go to a search for the address. No embedded map, so no tracking script runs on the page.
const mapLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address || '').trim())}`;
// W-06: the only script a business page may load, served from the page's own origin (see siteCsp).
export const CINEMATIC_LOADER = '/_site/cinematic-loader.js?v=1';
const SITE_CSP = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
export const siteCsp = (html) => (String(html || '').includes(`src="${CINEMATIC_LOADER}"`) ? `${SITE_CSP}; script-src 'self'` : SITE_CSP);
const hasDigit = (v) => /\d/.test(String(v ?? ''));
export function renderPage(page, { site = {}, theme = themeFrom(site.brand), canonical = '', nav = [], preview = false, reviews = [], formStatus = null, receptionist247 = false } = {}) {
  const blocks = page.blocks || [];
  let h1Done = false, cinematic = false;
  const H = (text) => { if (!h1Done) { h1Done = true; return `<h1>${esc(text)}</h1>`; } return `<h2>${esc(text)}</h2>`; };
  // T-051: photos from the media library get WebP copies at several widths (srcset); other addresses are used as given.
  const img = (b) => { const src = safeUrl(b.src, { allowHash: false }); if (!src) return ''; const r = responsiveAttrs(src); return `<img src="${esc(r ? r.src : src)}"${r ? ` srcset="${esc(r.srcset)}" sizes="${esc(r.sizes)}"` : ''} alt="${esc(b.alt ?? '')}"${b.width ? ` width="${Number(b.width) | 0}"` : ''}${b.height ? ` height="${Number(b.height) | 0}"` : ''} loading="lazy" decoding="async">`; };
  const body = blocks.map((b) => {
    switch (b.type) {
      case 'hero': return `<section class="hero">${H(b.heading || page.title)}${b.text ? `<p class="lead">${esc(b.text)}</p>` : ''}${safeUrl(b.cta_href) && b.cta_label ? `<p><a class="btn" href="${esc(safeUrl(b.cta_href))}">${esc(b.cta_label)}</a></p>` : ''}</section>`;
      case 'text': return `<section>${b.heading ? H(b.heading) : ''}${String(b.text || '').split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')}</section>`;
      case 'services': case 'areas': return `<section>${b.heading ? H(b.heading) : ''}<ul class="chips">${(b.items || []).map((i) => `<li>${b.links?.[i] && safeUrl(b.links[i]) ? `<a href="${esc(safeUrl(b.links[i]))}">${esc(i)}</a>` : esc(i)}</li>`).join('')}</ul></section>`;
      case 'faq': return `<section class="faq">${b.heading ? H(b.heading) : ''}${(b.items || []).map((i) => `<details><summary>${esc(i.q)}</summary><p>${esc(i.a)}</p></details>`).join('')}</section>`;
      case 'cta': return `<section class="cta">${b.heading ? H(b.heading) : ''}${b.text ? `<p>${esc(b.text)}</p>` : ''}${safeUrl(b.href) ? `<p><a class="btn" href="${esc(safeUrl(b.href))}">${esc(b.label || 'Contact us')}</a></p>` : ''}</section>`;
      case 'contact': return `<section id="contact" class="contact">${H(b.heading || 'Contact')}<ul>${b.phone ? `<li>Phone: <a href="tel:${esc(String(b.phone).replace(/[^\d+]/g, ''))}">${esc(b.phone)}</a></li>` : ''}${b.email ? `<li>Email: <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>` : ''}${b.address ? `<li>${esc(b.address)}</li>` : ''}</ul>${b.form && site.slug ? contactForm(site, page, formStatus) : ''}</section>`;
      case 'image': return `<figure>${img(b)}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
      case 'gallery': return `<section>${b.heading ? H(b.heading) : ''}<div class="gallery">${(b.images || []).map(img).join('')}</div></section>`;
      case 'reviews': { const list = reviews.slice(0, b.limit || 6); if (!list.length) return ''; return `<section>${H(b.heading || 'What customers say')}${list.map((r) => `<blockquote><p>${esc(r.comment)}</p><footer>${esc(r.reviewer)}${r.rating ? ` · ${'★'.repeat(r.rating)}<span class="sr"> ${r.rating} out of 5</span>` : ''} · <cite>${esc(r.source)}</cite></footer></blockquote>`).join('')}</section>`; }
      // W-05 blocks. The cinematic hero renders its poster as a normal hero here; the 3D island (W-06) layers on top.
      case 'cinematic_hero': { const poster = b.poster ? img({ src: b.poster, alt: b.poster_alt ?? '', width: b.width, height: b.height }).replace(' loading="lazy"', ' fetchpriority="high"') : ''; cinematic = true; return `<section class="hero cinematic" data-cinematic="${esc(['blueprint', 'materials', 'skyline', 'tools'].includes(b.preset) ? b.preset : 'blueprint')}" data-color="${esc(theme.primary)}">${H(b.heading || page.title)}${b.text ? `<p class="lead">${esc(b.text)}</p>` : ''}${safeUrl(b.cta_href) && b.cta_label ? `<p><a class="btn" href="${esc(safeUrl(b.cta_href))}">${esc(b.cta_label)}</a></p>` : ''}${poster ? `<div class="poster">${poster}</div>` : ''}</section>`; }
      case 'stats': { const list = (b.items || []).filter((i) => i && hasDigit(i.value) && String(i.label || '').trim()); if (!list.length) return ''; return `<section class="stats">${b.heading ? H(b.heading) : ''}<dl>${list.map((i) => `<div><dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd></div>`).join('')}</dl></section>`; }
      case 'process': { const list = (b.items || []).filter((i) => i && String(i.title || '').trim()); if (!list.length) return ''; return `<section class="process">${b.heading ? H(b.heading) : ''}<ol>${list.map((i) => `<li><strong>${esc(i.title)}</strong>${i.text ? `<p>${esc(i.text)}</p>` : ''}</li>`).join('')}</ol></section>`; }
      // Completed jobs: photo, service and suburb only. Customer names are never rendered, even if present in the data.
      case 'projects': { const list = (b.items || []).filter((i) => i && safeUrl(i.src, { allowHash: false })); if (!list.length) return ''; return `<section class="projects">${b.heading ? H(b.heading) : ''}<ul class="cards">${list.map((i) => { const cap = [i.service, i.suburb].map((x) => String(x || '').trim()).filter(Boolean).join(' · '); return `<li><figure>${img(i)}${cap || i.caption ? `<figcaption>${cap ? `<strong>${esc(cap)}</strong>` : ''}${i.caption ? ` ${esc(i.caption)}` : ''}</figcaption>` : ''}</figure></li>`; }).join('')}</ul></section>`; }
      case 'pricing': { const list = (b.items || []).filter((i) => i && String(i.name || '').trim() && String(i.price || '').trim()); if (!list.length) return ''; const gst = b.gst === 'inc' ? 'Prices include GST.' : b.gst === 'ex' ? 'Prices exclude GST.' : b.gst === 'not_registered' ? 'We are not registered for GST.' : ''; return `<section class="pricing">${b.heading ? H(b.heading) : ''}<table><caption class="sr">${esc(b.heading || 'Prices')}</caption><thead><tr><th scope="col">Service</th><th scope="col">Price</th></tr></thead><tbody>${list.map((i) => `<tr><th scope="row">${esc(i.name)}${i.note ? `<br><span class="small">${esc(i.note)}</span>` : ''}</th><td>${esc(i.price)}${i.unit ? ` <span class="small">${esc(i.unit)}</span>` : ''}</td></tr>`).join('')}</tbody></table>${gst ? `<p class="small">${gst}${b.text ? ` ${esc(b.text)}` : ''}</p>` : b.text ? `<p class="small">${esc(b.text)}</p>` : ''}</section>`; }
      case 'quote_form': return `<section id="contact" class="contact quote">${H(b.heading || 'Ask for a quote')}${b.text ? `<p>${esc(b.text)}</p>` : ''}${site.slug ? contactForm(site, page, formStatus, { services: b.services, suburb_required: b.suburb_required }) : ''}</section>`;
      // Only shown when the AI receptionist really answers around the clock (the caller passes receptionist247).
      case 'emergency_banner': { const tel = String(b.phone || '').replace(/[^\d+]/g, ''); if (!receptionist247 || !tel) return ''; return `<aside class="emergency" aria-label="Urgent help">${esc(b.text || 'Urgent job? We answer 24/7.')} <a href="tel:${esc(tel)}">Call ${esc(b.phone)}</a></aside>`; }
      case 'map': { if (!String(b.address || '').trim()) return ''; const pic = b.image ? img({ src: b.image, alt: b.alt ?? `Map showing ${b.address}`, width: b.width, height: b.height }) : ''; return `<section class="map">${b.heading ? H(b.heading) : ''}${pic}<p>${esc(b.address)} <a href="${esc(mapLink(b.address))}" rel="noopener">Open in Google Maps<span class="sr"> (opens the map website)</span></a></p></section>`; }
      // Licences and associations the owner uploaded. The name doubles as the alt text so every logo is announced.
      case 'logos': { const list = (b.items || []).filter((i) => i && String(i.name || '').trim() && safeUrl(i.src, { allowHash: false })); if (!list.length) return ''; return `<section class="logos">${b.heading ? H(b.heading) : ''}<ul>${list.map((i) => `<li>${img({ ...i, alt: i.name })}${i.number ? `<span class="small">${esc(i.name)} ${esc(i.number)}</span>` : ''}</li>`).join('')}</ul></section>`; }
      // Questions from real enquiries; only those the owner answered and approved are published.
      case 'faq_ai': { const list = (b.items || []).filter((i) => i && i.approved === true && String(i.q || '').trim() && String(i.a || '').trim()); if (!list.length) return ''; return `<section class="faq">${H(b.heading || 'Common questions')}${list.map((i) => `<details><summary>${esc(i.q)}</summary><p>${esc(i.a)}</p></details>`).join('')}</section>`; }
      default: return '';
    }
  }).join('\n');
  const ld = (page.schema || []).map((s) => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, '\\u003c')}</script>`).join('');
  const t = theme;
  const css = `*{box-sizing:border-box}body{margin:0;font:16px/1.6 ${t.font};color:${t.text};background:${t.background}}header,main,footer{max-width:960px;margin:0 auto;padding:16px}header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}main a:not(.btn){color:${t.primary}}header a{color:${t.text}}nav ul{display:flex;flex-wrap:wrap;gap:12px;list-style:none;margin:0;padding:0}h1{font-size:clamp(28px,5vw,44px);line-height:1.15;margin:.2em 0}h2{font-size:clamp(22px,3.5vw,30px);line-height:1.25;margin:1.2em 0 .4em}.lead{font-size:1.15em;color:${t.muted};max-width:65ch}p{max-width:70ch}.hero{padding:32px 0}.btn{display:inline-block;padding:12px 20px;border-radius:8px;background:${t.primary};color:${t.on_primary};text-decoration:none;font-weight:600}.btn:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid ${t.primary};outline-offset:3px}.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0}.chips li{padding:6px 12px;border-radius:999px;background:${t.surface}}details{border-bottom:1px solid #d9dee4;padding:12px 0}summary{cursor:pointer;font-weight:600}img{max-width:100%;height:auto}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}blockquote{margin:0 0 16px;padding:12px 16px;background:${t.surface};border-radius:8px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}footer{color:${t.muted};font-size:14px}.preview{background:#fff3cd;color:#5c4400;padding:8px 16px;text-align:center}.form{display:grid;gap:12px;max-width:520px;margin-top:16px}.form label{display:grid;gap:4px;font-weight:600}.form input,.form textarea{font:inherit;padding:10px;border:1px solid #9aa3ad;border-radius:8px}.form .check{display:flex;gap:8px;align-items:flex-start;font-weight:400}.form .hp{position:absolute;left:-9999px}.note{padding:10px 12px;border-radius:8px;background:#e7f4ea}.note.bad{background:#fdecea}.small{font-size:14px;color:${t.muted}}.form select{font:inherit;padding:10px;border:1px solid #9aa3ad;border-radius:8px}.poster,.cine-stage{position:relative;margin-top:20px}.poster img{border-radius:12px;display:block}.cine-stage{height:clamp(180px,30vw,320px);border-radius:12px;background:${t.surface}}.cine-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.stats dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0}.stats dl div{background:${t.surface};border-radius:8px;padding:12px 16px}.stats dt{color:${t.muted};font-size:14px}.stats dd{margin:0;font-size:28px;font-weight:700}.process ol{padding-left:1.4em}.process li{margin-bottom:12px}.process li p{margin:4px 0 0}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;list-style:none;padding:0}.cards figure{margin:0}.cards figcaption{font-size:14px;margin-top:6px}table{border-collapse:collapse;width:100%;max-width:640px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #d9dee4;vertical-align:top}td{white-space:nowrap}.emergency{background:${t.primary};color:${t.on_primary};padding:12px 16px;border-radius:8px;margin:16px 0;font-weight:600}.emergency a{color:inherit}.logos ul{display:flex;flex-wrap:wrap;gap:16px;align-items:center;list-style:none;padding:0}.logos li{display:grid;gap:4px;justify-items:center}.logos img{max-height:64px;width:auto}`;
  return `<!doctype html><html lang="${esc(site.lang || 'en-AU')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(page.meta_title || page.title)}</title>${page.meta_description ? `<meta name="description" content="${esc(page.meta_description)}">` : ''}${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}${preview ? '<meta name="robots" content="noindex, nofollow">' : ''}<style>${css}</style>${ld}</head><body>${preview ? '<div class="preview" role="note">Preview: not published. Search engines are asked not to index this.</div>' : ''}<header><a href="${esc(nav[0]?.href || './')}"><strong>${esc(site.name || '')}</strong></a>${nav.length > 1 ? `<nav aria-label="Main"><ul>${nav.map((n) => `<li><a href="${esc(n.href)}"${n.current ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('')}</ul></nav>` : ''}</header><main>${body}</main><footer><p>© ${new Date().getFullYear()} ${esc(site.name || '')}${site.abn ? ` · ABN ${esc(site.abn)}` : ''}</p></footer>${cinematic ? `<script type="module" src="${CINEMATIC_LOADER}"></script>` : ''}</body></html>`;
}

// --------------------------------------------------------------------------------- checks before publishing ---
export const SPEED_BUDGET = { html_gz: 60 * 1024, css_gz: 30 * 1024, images: 40 };
export function speedBudget(page, { site = {}, theme } = {}) {
  const html = renderPage(page, { site: { ...site, slug: site.slug || 'preview' }, ...(theme ? { theme } : {}) });
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const gz = (x) => gzipSync(Buffer.from(x)).length, kb = (n) => `${Math.round(n / 1024)} KB`;
  const over = [], h = gz(html), c = gz(css);
  if (h > SPEED_BUDGET.html_gz) over.push(`The page is ${kb(h)} compressed; the limit is ${kb(SPEED_BUDGET.html_gz)}. Split it into more pages or shorten long sections.`);
  if (c > SPEED_BUDGET.css_gz) over.push(`The page styles are ${kb(c)} compressed; the limit is ${kb(SPEED_BUDGET.css_gz)}.`);
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  if (imgs.length > SPEED_BUDGET.images) over.push(`The page has ${imgs.length} images; the limit is ${SPEED_BUDGET.images}. Move some to another page.`);
  const unsized = imgs.filter((t) => !/\bwidth="\d+"/.test(t) || !/\bheight="\d+"/.test(t)).length;
  const scripts = (html.match(/<script\b(?![^>]*application\/ld\+json)[^>]*>/g) || []).filter((t) => !t.includes(CINEMATIC_LOADER));
  if (scripts.length) over.push('The page loads scripts other than the cinematic hero.');
  return over;
}
const unsizedImages = (html) => (html.match(/<img\b[^>]*>/g) || []).filter((t) => !/\bwidth="\d+"/.test(t) || !/\bheight="\d+"/.test(t)).length;
export function prePublishChecks(page, { site = {}, theme = themeFrom(site.brand), sitePages = [], facts = {}, reviews = [] } = {}) {
  const out = [], add = (group, level, text) => out.push({ group, level, text });
  const blocks = page.blocks || [];
  const title = page.meta_title || page.title || '';
  if (!title) add('seo', 'block', 'Add a page title.'); else if (title.length > 60) add('seo', 'warn', `The title is ${title.length} characters; over 60 is often cut off.`);
  if (!page.meta_description) add('seo', 'warn', 'Add a meta description.'); else if (page.meta_description.length > 160) add('seo', 'warn', 'The meta description is longer than 160 characters.');
  if (!blocks.some((b) => b.type === 'hero' || b.type === 'cinematic_hero' || (b.type === 'text' && b.heading))) add('seo', 'block', 'The page needs a main heading (a hero or a section heading).');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(page.slug || '')) add('seo', 'block', 'The page address may only use lowercase letters, numbers and dashes.');
  if (sitePages.some((p) => p.id !== page.id && p.slug === page.slug)) add('seo', 'block', 'Another page already uses this address.');
  const sameTitle = sitePages.find((p) => p.id !== page.id && (p.meta_title || p.title) === title); if (sameTitle) add('seo', 'warn', `Another page has the same title ("${sameTitle.title}").`);
  const words = draftText(page).split(/\s+/).length; if (words < 120) add('seo', 'warn', `Only about ${words} words: thin pages rarely do well in search.`);
  const links = blocks.flatMap((b) => [b.cta_href, b.href, ...Object.values(b.links || {})]).filter(Boolean);
  for (const l of links) { const u = safeUrl(l); if (!u) add('links', 'block', `The link "${l}" is not a safe address (use /page, https://, tel: or mailto:).`); else if (u.startsWith('/') && site.base_path && u.startsWith(site.base_path) && !sitePages.some((p) => p.status !== 'archived' && u === `${site.base_path}/${p.slug}`)) add('links', 'block', `The link ${u} points to a page that does not exist on this site.`); }
  // Accessibility
  const imgs = blocks.flatMap((b) => (b.type === 'image' ? [b] : b.type === 'gallery' ? b.images || [] : []));
  for (const i of imgs) { if (i.alt === undefined || i.alt === null) add('a11y', 'block', `An image has no alt text (${String(i.src).slice(-40)}). Describe it, or leave it empty only if it is decorative.`); if (!i.width || !i.height) add('images', 'warn', `Add width and height for ${String(i.src).slice(-40)} so the page does not jump while loading.`); if (/\.(png|jpe?g|gif|bmp)(\?|$)/i.test(i.src || '')) add('images', 'warn', `${String(i.src).slice(-40)} could be smaller as WebP or AVIF.`); }
  const cr = contrast(theme.primary, theme.on_primary); if (cr !== null && cr < 4.5) add('a11y', 'block', `Button text contrast is ${cr}:1; it must be at least 4.5:1.`);
  const tc = contrast(theme.text, theme.background); if (tc !== null && tc < 4.5) add('a11y', 'block', `Text contrast is ${tc}:1; it must be at least 4.5:1.`);
  for (const b of blocks) if ((b.cta_label || b.label) && /^(click here|here|more|read more)$/i.test(b.cta_label || b.label)) add('a11y', 'warn', 'Use a button label that says what happens, not "click here".');
  for (const b of blocks) {
    if (b.type === 'text' && !String(b.text || '').trim()) add('content', 'block', `The section "${b.heading || 'Text'}" is empty. Write it or remove it.`);
    if (b.type === 'hero' && !String(b.text || '').trim()) add('content', 'warn', 'Add a sentence under the main heading saying what you do and where.');
    if (b.type === 'faq' && !(b.items || []).length) add('content', 'block', 'The questions section has no questions. Add some or remove it.');
    if (['services', 'areas'].includes(b.type) && !(b.items || []).length) add('content', 'block', `The "${b.heading || b.type}" list is empty. Add items or remove it.`);
  }
  // W-05 blocks: say what is missing instead of publishing an empty or misleading section.
  for (const b of blocks) {
    if (b.type === 'pricing' && !['inc', 'ex', 'not_registered'].includes(b.gst)) add('content', 'block', 'Say whether your prices include GST (or that you are not registered for GST).');
    if (b.type === 'stats' && (b.items || []).some((i) => !hasDigit(i?.value) || !String(i?.label || '').trim())) add('content', 'block', 'Every number in the stats section needs a real figure and a label.');
    if (b.type === 'faq_ai' && !(b.items || []).some((i) => i?.approved === true && i?.a)) add('content', 'warn', 'No answered and approved questions yet, so the questions section will not show.');
    if (b.type === 'emergency_banner') add('content', 'warn', 'The urgent-calls banner shows only while the AI receptionist answers 24/7.');
    if (b.type === 'projects' && (b.items || []).some((i) => i?.customer || i?.customer_name)) add('content', 'warn', 'Customer names on project photos are never shown on the website.');
    if (b.type === 'map' && !String(b.address || '').trim()) add('content', 'block', 'Add the address for the map.');
    for (const i of b.type === 'projects' ? b.items || [] : b.type === 'cinematic_hero' && b.poster ? [{ src: b.poster, alt: b.poster_alt }] : []) if (i.alt === undefined || i.alt === null) add('a11y', 'block', `An image has no alt text (${String(i.src).slice(-40)}). Describe it, or leave it empty only if it is decorative.`);
  }
  for (const f of blocks.filter((b) => b.type === 'faq')) if ((f.items || []).some((i) => !i.q || !i.a)) add('content', 'block', 'Every FAQ needs a question and an answer.');
  if (/\[[^\]]{3,}\]/.test(draftText(page))) add('content', 'block', 'Replace the [placeholders] with your own words.');
  if (blocks.some((b) => b.type === 'reviews') && !reviews.length) add('content', 'warn', 'The reviews section is empty, so it will not show. Import real reviews from Google first.');
  // Claims
  const claims = checkClaims(draftText(page), facts);
  for (const c of claims) add('claims', c.level === 'blocked' ? 'block' : c.level === 'review' ? 'approval' : 'ok', `${c.reason} "${c.text}"`);
  // W-08 speed budget (docs/ai-website/02_ARCHITECTURE.md §5). Over budget stops publishing until the owner accepts it
  // for this version (speed_accepted), so a slow page never goes live by accident.
  { const n = unsizedImages(renderPage(page, { site: { ...site, slug: site.slug || 'preview' }, theme })); if (n) add('speed', 'warn', `${n} image(s) have no width and height, so the page can jump while loading. Choosing them from your photos records their size.`); }
  for (const b of speedBudget(page, { site, theme })) add('speed', page.speed_accepted ? 'warn' : 'budget', page.speed_accepted ? `Accepted: ${b}` : b);
  return { checks: out, blocked: out.some((c) => c.level === 'block' || c.level === 'budget'), needs_approval_for_claims: claims.some((c) => c.level === 'review'), claims };
}

// --------------------------------------------------------------------------------- change risk ---
// Decides whether a change may be published under the owner's "low-risk updates" rule or needs approval.
const SENSITIVE = /\b(medical|diagnos|treat(ment)?|cure|legal advice|lawyer|financial advice|invest|refund policy|privacy|terms|complain|asbestos|gas fitting|electrical safety|child|children)\b/i;
export function classifyChange(before, after, { claims = [], firstRelease = false } = {}) {
  const reasons = [];
  if (firstRelease) reasons.push('First time this page goes live.');
  const typesA = (before?.blocks || []).map((b) => b.type).join(','), typesB = (after.blocks || []).map((b) => b.type).join(',');
  if (before && typesA !== typesB) reasons.push('Sections were added, removed or reordered (design change).');
  if (before && JSON.stringify(before.theme || {}) !== JSON.stringify(after.theme || {})) reasons.push('Colours or fonts changed (design change).');
  if (before && before.slug !== after.slug) reasons.push('The page address changed.');
  const ta = before ? draftText(before) : '', tb = draftText(after);
  const changed = before ? diffRatio(ta, tb) : 1;
  if (before && changed > 0.2) reasons.push(`${Math.round(changed * 100)}% of the words changed.`);
  const newClaims = claims.filter((c) => c.level === 'review' && !ta.includes(c.text.replace(/…$/, '')));
  if (newClaims.length) reasons.push(`${newClaims.length} new claim(s) that need checking.`);
  if (SENSITIVE.test(tb) && (!before || !SENSITIVE.test(ta) || changed > 0.05)) reasons.push('Sensitive subject (health, legal, money, safety or policy wording).');
  const imgsA = JSON.stringify((before?.blocks || []).filter((b) => ['image', 'gallery'].includes(b.type))), imgsB = JSON.stringify((after.blocks || []).filter((b) => ['image', 'gallery'].includes(b.type)));
  if (before && imgsA !== imgsB) reasons.push('Images changed.');
  return { low_risk: reasons.length === 0, reasons, changed_ratio: +changed.toFixed(2) };
}
function diffRatio(a, b) { const A = a.split(/\s+/), B = new Set(b.split(/\s+/)); const SA = new Set(A); let same = 0; for (const w of SA) if (B.has(w)) same++; return 1 - same / Math.max(SA.size, B.size, 1); }

// --------------------------------------------------------------------------------- design suggestions ---
export function designSuggestions(page, { theme, facts = {} } = {}) {
  const s = [], blocks = page.blocks || [], types = blocks.map((b) => b.type);
  if (types[0] !== 'hero') s.push('Start with a hero: a clear heading saying what you do and where, and one button.');
  const hero = blocks.find((b) => b.type === 'hero'); if (hero && !hero.cta_label) s.push('Give the hero one clear action, for example "Get a quote".');
  if (!types.includes('contact') && !types.includes('cta')) s.push('End with a way to get in touch.');
  if (!types.includes('faq') && ['service', 'location'].includes(page.template)) s.push('Add three to five common questions; they help people decide and can appear in search.');
  if (facts.areas?.length && !types.includes('areas') && page.template !== 'contact') s.push('List the areas you serve.');
  if (types.filter((t) => t === 'text').length > 5) s.push('Long pages read better with fewer, shorter sections.');
  if (theme && (contrast(theme.primary, theme.on_primary) || 0) < 4.5) s.push('Your brand colour is too light for button text; use a darker shade for buttons.');
  if (!blocks.some((b) => ['image', 'gallery'].includes(b.type)) && page.template !== 'contact') s.push('Add a real photo of your work. Avoid stock photos that could mislead.');
  return s;
}
