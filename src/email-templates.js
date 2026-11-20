// One email layout for everything Oprun sends. Platform emails carry the Oprun name and icon; emails sent on a
// business's behalf (receipts, invoices, payment reminders) carry only that business's name, colour and logo.
import fs from 'node:fs';
import path from 'node:path';

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : fallback);
const safeUrl = (v) => (/^https?:\/\//i.test(String(v || '')) ? v : '');

function publicBase(value) {
  return (safeUrl(value) || 'https://www.oprun.ai').replace(/\/$/, '');
}
const communicationLinks = (base) => [
  ['Help', '/saas/complaints.html'],
  ['Terms', '/saas/terms.html'],
  ['Privacy', '/saas/privacy.html']
].map(([label, route]) => [label, publicBase(base) + route]);
export const PLATFORM_NAME = 'Oprun';
export const platformBrand = (env) => ({
  name: PLATFORM_NAME,
  color: '#e2bd72',
  logoSrc: publicBase(env.PUBLIC_BASE_URL) + '/saas/oprun-icon-192.png',
  links: communicationLinks(env.PUBLIC_BASE_URL),
  platform: true
});

// The business logo is attached inline (it is private, so it cannot be linked). Returns null when the business has no logo.
export function tenantBrandFor(db, uploadRoot, organisationId) {
  const o = db.prepare(`SELECT COALESCE(display_name,name) name, brand_primary_color color, brand_logo_url logo, abn,(SELECT phone FROM onboarding_profiles WHERE organisation_id=organisations.id) phone,(SELECT website FROM onboarding_profiles WHERE organisation_id=organisations.id) website FROM organisations WHERE id=?`).get(organisationId) || {};
  let attachment = null;
  const file = path.basename(String(o.logo || ''));
  if (/^[a-f0-9-]{36}\.(png|jpg|webp)$/i.test(file)) {
    const p = path.join(uploadRoot, 'branding', organisationId, file);
    if (fs.existsSync(p) && fs.statSync(p).size < 1_000_000) attachment = { filename: file, content: fs.readFileSync(p).toString('base64'), contentId: 'brandlogo' };
  }
  const name = o.name || 'Your business';
  return { name, color: safeColor(o.color, '#b8892f'), logoSrc: attachment ? 'cid:brandlogo' : '', attachments: attachment ? [attachment] : [], links:communicationLinks(),footer: [name + (o.abn ? ` · ABN ${o.abn}` : ''), ...[o.phone,o.website].filter(Boolean),'Please keep this email for your records.'] };
}

// frame: { heading, preheader, paragraphs[], verification:{label,code,expires}, facts:[[label,value]], button:{label,url}, notes[] }
export function renderEmail(brand, frame) {
  const color = safeColor(brand.color, '#b8892f');
  const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const buttonInk = rgb.reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0) > .179 ? '#17130b' : '#ffffff';
  const paragraphs = (frame.paragraphs || []).filter(Boolean);
  const facts = (frame.facts || []).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const notes = (frame.notes || []).filter(Boolean);
  const button = frame.button && safeUrl(frame.button.url) ? frame.button : null;
  const verification = frame.verification;
  const footer = brand.footer || [];
  const links = (brand.links || communicationLinks()).filter(([, url]) => safeUrl(url));
  const logo = safeUrl(brand.logoSrc) || (brand.logoSrc === 'cid:brandlogo' ? brand.logoSrc : '');
  const paragraph = (value) => escapeHtml(value).replace(/\n/g, '<br>');
  // T-179: campaign photos (and a link for each video), shown one under the other at full message width.
  const images = (frame.images || []).filter((m) => safeUrl(m.src) || safeUrl(m.href)).slice(0, 10);
  const gallery = images.map((m) => m.src && safeUrl(m.src)
    ? `<p style="margin:12px 0"><a href="${escapeHtml(safeUrl(m.href) || m.src)}"><img src="${escapeHtml(m.src)}" alt="${escapeHtml(m.alt || '')}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;border:0"></a></p>`
    : `<p style="margin:12px 0"><a href="${escapeHtml(m.href)}" style="color:#594218;font-weight:700;text-decoration:underline">${escapeHtml(m.alt || 'Watch the video')}</a></p>`).join('');

  const codePanel = verification ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #d9c294;border-radius:12px"><tr><td bgcolor="#faf3e5" style="background:#faf3e5;padding:16px 18px;border-radius:12px">
    <p style="margin:0 0 5px;color:#5e451c;font-size:13px;font-weight:700">${escapeHtml(verification.label)}</p>
    <p style="margin:0 0 6px;color:#141923;font:700 34px/1.2 Consolas,Monaco,monospace;letter-spacing:3px">${escapeHtml(verification.code)}</p>
    <p style="margin:0;color:#414957;font-size:13px">${escapeHtml(verification.expires)}</p>
  </td></tr></table>` : '';
  const details = facts.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-top:1px solid #dde1e8">${facts.map(([label, value]) =>
    `<tr><th scope="row" align="left" style="width:40%;padding:9px 8px 9px 0;color:#414957;font-size:13px;border-bottom:1px solid #dde1e8">${escapeHtml(label)}</th><td style="padding:9px 0;color:#17202d;font-size:14px;border-bottom:1px solid #dde1e8;word-break:break-word">${escapeHtml(value)}</td></tr>`
  ).join('')}</table>` : '';
  const action = button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td bgcolor="${color}" style="border-radius:8px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:${color};color:${buttonInk};text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:8px">${escapeHtml(button.label)}</a></td></tr></table>` : '';
  const legal = links.map(([label, url]) => `<a href="${escapeHtml(url)}" style="color:#594218;text-decoration:underline">${escapeHtml(label)}</a>`).join(' &nbsp;·&nbsp; ');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(frame.heading)}</title></head>
<body style="margin:0;background:#eef0f4;color:#17202d;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all" aria-hidden="true">${escapeHtml(frame.preheader || frame.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef0f4"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #d7dce4;border-radius:14px">
<tr><td bgcolor="#090b10" style="background:#090b10;padding:15px 20px;border-radius:13px 13px 0 0;border-bottom:3px solid ${color}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo ? `<td style="padding-right:10px"><img src="${escapeHtml(logo)}" alt="" width="34" height="34" style="display:block;width:34px;height:34px;object-fit:contain;border-radius:7px"></td>` : ''}
<td style="color:#ffffff;font-size:20px;font-weight:700;line-height:1.2;word-break:break-word">${escapeHtml(brand.name)}</td></tr></table></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:22px 20px;color:#17202d">
<h1 style="margin:0 0 10px;color:#17202d;font-size:24px;line-height:1.2">${escapeHtml(frame.heading)}</h1>
${paragraphs.map(t => `<p style="margin:0 0 10px;color:#313a49;font-size:15px;line-height:1.55">${paragraph(t)}</p>`).join('')}
${gallery}${codePanel}${details}${action}
${notes.map(t => `<p style="margin:10px 0 0;color:#4b5565;font-size:13px;line-height:1.5">${paragraph(t)}</p>`).join('')}
</td></tr>
<tr><td bgcolor="#f7f8fa" style="background:#f7f8fa;border-top:1px solid #dde1e8;border-radius:0 0 13px 13px;padding:13px 20px;color:#4b5565;font-size:12px;line-height:1.55">
${footer.length ? footer.map(escapeHtml).join('<br>') + '<br>' : ''}${brand.platform ? '© Oprun' : 'Powered by Oprun'}${legal ? `<br>${legal}` : ''}
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    brand.name, '', frame.heading, '', ...paragraphs.flatMap(t => [t, '']),
    ...(verification ? [`${verification.label}: ${verification.code}`, verification.expires, ''] : []),
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(facts.length ? [''] : []), ...(button ? [`${button.label}: ${button.url}`, ''] : []),
    ...notes.flatMap(t => [t, '']), ...footer, brand.platform ? '© Oprun' : 'Powered by Oprun',
    ...links.map(([label, url]) => `${label}: ${url}`)
  ].join('\n');
  return { html, text };
}
