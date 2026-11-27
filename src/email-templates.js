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
  ['Privacy', '/saas/privacy.html'],
  ['Trust Center', '/saas/trust-center.html']
].map(([label, route]) => [label, publicBase(base) + route]);
import { BRAND } from './brand.js';
export const PLATFORM_NAME = 'Oprun';
export const platformBrand = (env) => ({
  name: PLATFORM_NAME,
  color: BRAND.colors.gold, // MB-12: the token gold, from the one brand source
  // Use the approved platform artwork; the existing text fallback remains available.
  logoSrc: publicBase(env.PUBLIC_BASE_URL) + '/saas/oprun-icon-192.png',
  site: String(publicBase(env.PUBLIC_BASE_URL)).replace(/^https?:\/\/(www\.)?/, ''),
  address: String(env.SUPERPRO_POSTAL_ADDRESS || env.PLATFORM_POSTAL_ADDRESS || '').trim().slice(0, 160),
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

// frame: { heading, preheader, eyebrow, paragraphs[], verification:{label,code,expires}, facts:[[label,value]],
//          callout:{text, tone:'info'|'warning'|'success'}, button:{label,url}, notes[], confidential: true|'text', audience }
// T-189 redesign: a light, quiet layout that reads well with images blocked (the mark is drawn in HTML, not an image),
// in dark-mode mail apps and on phones; one card of details; a clear action; the legal and privacy lines at the foot.
const CONFIDENTIAL = 'Confidential. This email may contain personal information about your customers and is intended only for the person it was sent to. If it reached you by mistake, please delete it and let us know through the Help link below. Use and store this information in line with the Australian Privacy Principles.';
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
  const confidential = frame.confidential ? (typeof frame.confidential === 'string' ? frame.confidential : CONFIDENTIAL) : '';
  const callout = frame.callout?.text ? frame.callout : null;
  const tone = { info: ['#eef4ff', '#c9d8f5', '#1f3a66'], warning: ['#fff6e6', '#f0d39b', '#5e451c'], success: ['#ecfaf3', '#b9e6cf', '#14532d'] }[callout?.tone || 'info'];
  const initial = escapeHtml((String(brand.name || 'O').trim()[0] || 'O').toUpperCase());
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  // T-179: campaign photos (and a link for each video), shown one under the other at full message width.
  const images = (frame.images || []).filter((m) => safeUrl(m.src) || safeUrl(m.href)).slice(0, 10);
  const gallery = images.map((m) => m.src && safeUrl(m.src)
    ? `<p style="margin:12px 0"><a href="${escapeHtml(safeUrl(m.href) || m.src)}"><img src="${escapeHtml(m.src)}" alt="${escapeHtml(m.alt || '')}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;border:0"></a></p>`
    : `<p style="margin:12px 0"><a href="${escapeHtml(m.href)}" style="color:#594218;font-weight:700;text-decoration:underline">${escapeHtml(m.alt || 'Watch the video')}</a></p>`).join('');
  // The mark: the business logo when it has one (attached inline), otherwise its initial drawn in HTML so it shows
  // even when the mail app blocks images.
  const mark = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.name)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:10px;border:0;object-fit:contain">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="40" height="40" align="center" valign="middle" bgcolor="${color}" style="width:40px;height:40px;background:${color};border-radius:10px;color:${buttonInk};font:800 20px/40px ${font};text-align:center">${initial}</td></tr></table>`;
  const codePanel = verification ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid #e6d3a8;border-radius:12px"><tr><td bgcolor="#fbf6ea" align="center" style="background:#fbf6ea;padding:20px 18px;border-radius:12px">
    <p style="margin:0 0 6px;color:#5e451c;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(verification.label)}</p>
    <p style="margin:0 0 8px;color:#0f1420;font:700 34px/1.2 Consolas,Monaco,'Courier New',monospace;letter-spacing:6px">${escapeHtml(verification.code)}</p>
    <p style="margin:0;color:#4b5565;font-size:13px">${escapeHtml(verification.expires)}</p>
  </td></tr></table>` : '';
  const details = facts.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #e3e6ec;border-radius:12px;border-collapse:separate">${facts.map(([label, value], i) =>
    `<tr><th scope="row" align="left" valign="top" bgcolor="${i % 2 ? '#ffffff' : '#f8f9fb'}" style="width:38%;padding:11px 14px;background:${i % 2 ? '#ffffff' : '#f8f9fb'};color:#5b6474;font-size:13px;font-weight:600;${i ? 'border-top:1px solid #eef0f4;' : ''}${i === 0 ? 'border-radius:12px 0 0 0;' : ''}${i === facts.length - 1 ? 'border-radius:0 0 0 12px;' : ''}">${escapeHtml(label)}</th><td valign="top" bgcolor="${i % 2 ? '#ffffff' : '#f8f9fb'}" style="padding:11px 14px;background:${i % 2 ? '#ffffff' : '#f8f9fb'};color:#0f1420;font-size:14px;font-weight:600;word-break:break-word;${i ? 'border-top:1px solid #eef0f4;' : ''}${i === 0 ? 'border-radius:0 12px 0 0;' : ''}${i === facts.length - 1 ? 'border-radius:0 0 12px 0;' : ''}">${paragraph(value)}</td></tr>`
  ).join('')}</table>` : '';
  const calloutBox = callout ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td bgcolor="${tone[0]}" style="background:${tone[0]};border:1px solid ${tone[1]};border-left:4px solid ${tone[1]};border-radius:10px;padding:12px 14px;color:${tone[2]};font-size:14px;line-height:1.5">${paragraph(callout.text)}</td></tr></table>` : '';
  const action = button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 6px"><tr><td bgcolor="${color}" style="border-radius:10px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:${color};color:${buttonInk};text-decoration:none;font-weight:bold;font-size:15px;padding:13px 22px;border-radius:10px">${escapeHtml(button.label)}</a></td></tr></table>` : '';
  const legal = links.map(([label, url]) => `<a href="${escapeHtml(url)}" style="color:#5b6474;text-decoration:underline">${escapeHtml(label)}</a>`).join(' &nbsp;·&nbsp; ');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(frame.heading)}</title></head>
<body style="margin:0;padding:0;background:#f2f3f6;color:#0f1420;font-family:${font};-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all" aria-hidden="true">${escapeHtml(frame.preheader || frame.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f2f3f6" style="background:#f2f3f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="48" valign="middle">${mark}</td>
<td valign="middle" style="padding-left:12px;color:#0f1420;font-size:18px;font-weight:800;letter-spacing:-.01em;word-break:break-word">${escapeHtml(brand.name)}</td>
${frame.eyebrow ? `<td align="right" valign="middle"><span style="display:inline-block;padding:5px 10px;border:1px solid #e3e6ec;border-radius:999px;background:#ffffff;color:#5b6474;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(frame.eyebrow)}</span></td>` : ''}</tr></table>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e3e6ec;border-top:4px solid ${color};border-radius:16px;padding:30px 28px 26px;color:#0f1420">
<h1 style="margin:0 0 14px;color:#0f1420;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-.01em">${escapeHtml(frame.heading)}</h1>
${paragraphs.map(t => `<p style="margin:0 0 12px;color:#2f3846;font-size:15px;line-height:1.6">${paragraph(t)}</p>`).join('')}
${gallery}${codePanel}${details}${calloutBox}${action}
${notes.map(t => `<p style="margin:12px 0 0;color:#5b6474;font-size:13px;line-height:1.55">${paragraph(t)}</p>`).join('')}
</td></tr>
<tr><td style="padding:18px 8px 0;color:#6b7383;font-size:12px;line-height:1.6">
${confidential ? `<p style="margin:0 0 10px;padding:10px 12px;border:1px solid #e3e6ec;border-radius:10px;background:#ffffff;color:#5b6474;font-size:11.5px;line-height:1.55">${escapeHtml(confidential)}</p>` : ''}
${frame.audience ? `<p style="margin:0 0 8px">${escapeHtml(frame.audience)}</p>` : ''}
<p style="margin:0 0 6px">${footer.length ? footer.map(escapeHtml).join('<br>') + '<br>' : ''}${brand.platform ? `Oprun · ${escapeHtml(String(brand.site || 'oprun.ai'))}` : 'Powered by Oprun'}${brand.address ? `<br>${escapeHtml(brand.address)}` : ''}</p>
${legal ? `<p style="margin:0">${legal}</p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    // MB-25: a code comes first in the plain-text version, so phone previews and screen readers reach it at once.
    ...(verification ? [`${verification.label}: ${verification.code}`, verification.expires, ''] : []),
    brand.name, ...(frame.eyebrow ? [frame.eyebrow.toUpperCase()] : []), '', frame.heading, '', ...paragraphs.flatMap(t => [t, '']),
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(facts.length ? [''] : []), ...(callout ? [callout.text, ''] : []), ...(button ? [`${button.label}: ${button.url}`, ''] : []),
    ...notes.flatMap(t => [t, '']), ...(confidential ? [confidential, ''] : []), ...(frame.audience ? [frame.audience, ''] : []),
    ...footer, brand.platform ? `Oprun · ${brand.site || 'oprun.ai'}` : 'Powered by Oprun', ...(brand.address ? [brand.address] : []),
    ...links.map(([label, url]) => `${label}: ${url}`)
  ].join('\n');
  return { html, text };
}
