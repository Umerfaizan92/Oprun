// W-18 / T-199 (D-W18): llms.txt and AI-crawler rules for every published business website, on the free
// oprun.ai/sites/<slug>/ address and on the business's own domain. Pure functions: the caller supplies the facts.
// llms.txt lists only what the business told Oprun and what it published; nothing is invented.

// Crawlers that fetch pages to answer a person's question right now (they cite and link the site).
export const ANSWER_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'DuckAssistBot'];
// Crawlers that collect pages to train AI models. Normal Google and Bing search are never affected.
export const TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent', 'Bytespider', 'Amazonbot'];
export const AI_MODES = {
  all: 'AI answer engines and AI training crawlers may read the site',
  no_training: 'AI answer engines may read the site; AI training crawlers are blocked',
  none: 'All AI crawlers are blocked (normal Google and Bing search still work)',
};
export const DEFAULT_AI_MODE = 'all';

export function robotsTxt({ allowPath = '/', sitemapUrl, llmsUrl, mode = DEFAULT_AI_MODE }) {
  const m = AI_MODES[mode] ? mode : DEFAULT_AI_MODE;
  const blocked = m === 'none' ? [...ANSWER_BOTS, ...TRAINING_BOTS] : m === 'no_training' ? TRAINING_BOTS : [];
  const lines = ['User-agent: *', `Allow: ${allowPath}`, ''];
  for (const bot of blocked) lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  lines.push(`Sitemap: ${sitemapUrl}`);
  if (llmsUrl && m !== 'none') lines.push(`# AI summary: ${llmsUrl}`);
  return lines.join('\n') + '\n';
}

const one = (v, n = 300) => String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const md = (v, n) => one(v, n).replace(/([\[\]])/g, '\\$1');
const parsed = (v) => { if (typeof v === 'string' && v.trim().startsWith('[')) { try { return JSON.parse(v); } catch { /* plain text */ } } return v; };
const list = (raw) => { const v = parsed(raw); return (Array.isArray(v) ? v : String(v || '').split(/[,;\n]+/)).map((x) => one(typeof x === 'string' ? x : x?.name, 80)).filter(Boolean); };

/** llms.txt (llmstxt.org format): title, one-line summary, then sections of facts and links. */
export function llmsTxt({ name, facts = {}, pages = [] }) {
  const services = list(facts.services).slice(0, 30), areas = list(facts.areas).slice(0, 30);
  const where = areas.length ? ` serving ${areas.slice(0, 4).join(', ')}${areas.length > 4 ? ' and nearby areas' : ''}` : '';
  const what = services.length ? `: ${services.slice(0, 5).join(', ')}` : '';
  const out = [`# ${md(name || facts.business_name || 'Business website', 120)}`, '', `> ${md(name || facts.business_name || 'This business', 120)}${where}${what}.`, ''];
  const contact = [facts.phone && `- Phone: ${one(facts.phone, 40)}`, facts.email && `- Email: ${one(facts.email, 120)}`, facts.address && `- Address: ${one(facts.address, 200)}`, facts.abn && `- ABN: ${one(facts.abn, 20)}`].filter(Boolean);
  if (contact.length) out.push('## Contact', '', ...contact, '');
  if (services.length) out.push('## Services', '', ...services.map((s) => `- ${md(s, 80)}`), '');
  if (areas.length) out.push('## Areas served', '', ...areas.map((a) => `- ${md(a, 80)}`), '');
  if (pages.length) out.push('## Pages', '', ...pages.slice(0, 100).map((p) => `- [${md(p.title, 120)}](${p.url})${p.description ? `: ${md(p.description, 200)}` : ''}`), '');
  return out.join('\n');
}
