// AI Receptionist: each business connects its OWN Telnyx account (owner decision D-R12, 2026-11-19).
// The business buys, ports and pays for numbers directly with Telnyx; Oprun never holds a number, card or balance for it.
// What this module does, using the business's own API key:
//   1. checks the number really is in that Telnyx account (ownership);
//   2. creates an AI assistant in that account (the voice that answers);
//   3. creates a Call Control application whose webhook is this business's signed Oprun address;
//   4. assigns the number to that application;
//   5. routes the number to this business only (comms_channels voice row) and stores the keys encrypted.
// Every step is recorded (receptionist_provider.steps_json + audit), and a step that fails leaves clear manual instructions.
// Keys are never returned to the browser, logged, or written anywhere except the encrypted bundle.
const iso = () => new Date().toISOString();
const J = (t, d) => { try { return JSON.parse(t || ''); } catch { return d; } };
const fail = (status, message) => Object.assign(new Error(message), { status });

export const TELNYX_LINKS = {
  signup: 'https://telnyx.com/sign-up',
  buy_number: 'https://portal.telnyx.com/#/numbers/buy-numbers',
  port_number: 'https://portal.telnyx.com/#/numbers/port-numbers',
  my_numbers: 'https://portal.telnyx.com/#/numbers/my-numbers',
  api_keys: 'https://portal.telnyx.com/#/api-keys',
  public_key: 'https://portal.telnyx.com/#/api-keys/public-key',
  billing: 'https://portal.telnyx.com/#/account/billing',
  voice_apps: 'https://portal.telnyx.com/#/call-control/applications',
  ai_assistants: 'https://portal.telnyx.com/#/ai/assistants'
};

const BASE_INSTRUCTIONS = 'You are the phone receptionist for this business. Keep answers to one or two short sentences, ask one question at a time, never invent prices or availability, and take the caller\'s name, number and what they need. If sincerely asked, say you are the business\'s AI assistant.';

export function createReceptionistTelnyx({ db, runtime, env = {}, fetchImpl = globalThis.fetch, log = console }) {
  db.exec(`CREATE TABLE IF NOT EXISTS receptionist_provider (
    organisation_id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'telnyx', number_e164 TEXT, telnyx_number_id TEXT,
    assistant_id TEXT, application_id TEXT, token_bundle TEXT,
    status TEXT NOT NULL DEFAULT 'not_connected' CHECK(status IN ('not_connected','connecting','needs_attention','connected','disconnected')),
    steps_json TEXT NOT NULL DEFAULT '[]', last_error TEXT, connected_by TEXT, connected_at TEXT, updated_at TEXT NOT NULL)`);
  const base = () => String(env.TELNYX_API_BASE_URL || 'https://api.telnyx.com/v2').replace(/\/$/, '');
  const publicBase = () => String(env.PUBLIC_BASE_URL || 'https://www.oprun.ai').replace(/\/$/, '');
  const webhookUrl = (org) => `${publicBase()}/api/webhooks/communications/telnyx-voice/${encodeURIComponent(org)}`;
  const row = (org) => db.prepare('SELECT * FROM receptionist_provider WHERE organisation_id=?').get(org);

  async function telnyx(apiKey, method, path, body) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetchImpl(base() + path, { method, signal: ctl.signal, headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw fail(r.status === 401 || r.status === 403 ? 400 : 502, r.status === 401 || r.status === 403 ? 'Telnyx did not accept this API key. Create a new key in Telnyx (API Keys) and paste it again.' : `Telnyx answered: ${String(d?.errors?.[0]?.detail || d?.errors?.[0]?.title || 'HTTP ' + r.status).slice(0, 200)}`);
      return d;
    } catch (e) {
      if (e.status) throw e;
      throw fail(502, e.name === 'AbortError' ? 'Telnyx did not answer in time. Try again in a minute.' : 'Could not reach Telnyx. Try again in a minute.');
    } finally { clearTimeout(t); }
  }

  function normaliseNumber(raw) {
    const d = String(raw || '').replace(/[^\d+]/g, '');
    if (/^0\d{9}$/.test(d)) return '+61' + d.slice(1);
    if (/^61\d{9}$/.test(d)) return '+' + d;
    if (/^\+[1-9]\d{7,14}$/.test(d)) return d;
    throw fail(400, 'Enter the number exactly as it appears in your Telnyx account, for example +61862891786.');
  }

  function save(org, fields) {
    const now = iso();
    db.prepare('INSERT INTO receptionist_provider (organisation_id,updated_at) VALUES (?,?) ON CONFLICT(organisation_id) DO NOTHING').run(org, now);
    const keys = Object.keys(fields);
    if (keys.length) db.prepare(`UPDATE receptionist_provider SET ${keys.map((k) => `${k}=@${k}`).join(',')},updated_at=@u WHERE organisation_id=@org`).run({ ...fields, u: now, org });
  }

  /** Connects (or re-connects) the business's own Telnyx account and number. Returns publicStatus(). */
  async function connect(org, { api_key, public_key, number, assistant_id }, actor = null) {
    if (typeof api_key !== 'string' || api_key.trim().length < 20 || api_key.length > 400 || /\s/.test(api_key.trim())) throw fail(400, 'Paste your Telnyx API key (it starts with KEY).');
    let pk;
    try { pk = Buffer.from(String(public_key || '').trim(), 'base64'); } catch { pk = Buffer.alloc(0); }
    if (pk.length !== 32) throw fail(400, 'Paste your Telnyx public key (Account > Keys & Credentials > Public Key). It is used to check that calls really come from Telnyx.');
    if (assistant_id && !/^assistant-[0-9a-f-]{36}$/i.test(assistant_id)) throw fail(400, 'An assistant ID looks like assistant-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');
    const e164 = normaliseNumber(number);
    const taken = db.prepare("SELECT organisation_id FROM comms_channels WHERE channel='voice' AND address=?").get(e164);
    if (taken && taken.organisation_id !== org) throw fail(409, 'This number is already connected to another Oprun business.');
    const key = api_key.trim(), prev = row(org) || {};
    const steps = [];
    const step = (name, ok, detail) => { steps.push({ step: name, ok, detail: String(detail || '').slice(0, 240), at: iso() }); };
    save(org, { status: 'connecting', last_error: null, number_e164: e164 });

    // 1. Ownership: the number must be in this Telnyx account.
    const found = await telnyx(key, 'GET', `/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`);
    const num = (found.data || []).find((n) => n.phone_number === e164);
    if (!num) {
      step('ownership', false, 'Number not found in this Telnyx account');
      save(org, { status: 'needs_attention', steps_json: JSON.stringify(steps), last_error: 'This number is not in the Telnyx account for this API key.' });
      throw fail(400, 'This number is not in the Telnyx account for this API key. Buy or port it in Telnyx first, or use the key from the account that owns it.');
    }
    step('ownership', true, 'Number found in your Telnyx account');

    // Keys are stored now (encrypted), so a later step can be retried without pasting them again.
    save(org, { telnyx_number_id: String(num.id), token_bundle: runtime.encryptBundle({ api_key: key, public_key: pk.toString('base64') }), connected_by: actor });

    let assistantId = assistant_id || prev.assistant_id || null, applicationId = prev.application_id || null, problem = null;
    // 2. AI assistant in the business's own account.
    if (!assistantId) {
      try {
        const business = db.prepare('SELECT COALESCE(display_name,name) n FROM organisations WHERE id=?').get(org)?.n || 'the business';
        const a = await telnyx(key, 'POST', '/ai/assistants', { name: `Oprun receptionist - ${business}`.slice(0, 120), instructions: BASE_INSTRUCTIONS, greeting: `Thanks for calling ${business}. How can I help?` });
        assistantId = a?.data?.id || a?.id || null;
        if (!assistantId) throw fail(502, 'Telnyx did not return an assistant ID.');
        step('assistant', true, 'AI assistant created in your Telnyx account');
      } catch (e) { problem ||= `The AI assistant could not be created automatically (${e.message}). Create one in Telnyx (AI Assistants) and paste its ID.`; step('assistant', false, e.message); }
    } else step('assistant', true, 'Using the AI assistant you chose');

    // 3. Call Control application pointing at this business's signed webhook address.
    try {
      if (applicationId) {
        await telnyx(key, 'PATCH', `/call_control_applications/${encodeURIComponent(applicationId)}`, { webhook_event_url: webhookUrl(org), webhook_api_version: '2' });
        step('application', true, 'Voice application updated');
      } else {
        const app = await telnyx(key, 'POST', '/call_control_applications', { application_name: 'Oprun AI Receptionist', webhook_event_url: webhookUrl(org), webhook_api_version: '2' });
        applicationId = app?.data?.id ? String(app.data.id) : null;
        if (!applicationId) throw fail(502, 'Telnyx did not return an application ID.');
        step('application', true, 'Voice application created');
      }
    } catch (e) { problem ||= `The voice application could not be set up automatically (${e.message}). In Telnyx, set your Voice API application webhook URL to ${webhookUrl(org)} (API v2).`; step('application', false, e.message); }

    // 4. Assign the number to the application.
    if (applicationId) {
      try {
        await telnyx(key, 'PATCH', `/phone_numbers/${encodeURIComponent(num.id)}`, { connection_id: applicationId });
        step('assign_number', true, 'Number assigned to the voice application');
      } catch (e) { problem ||= `The number could not be assigned automatically (${e.message}). In Telnyx, open the number and choose the "Oprun AI Receptionist" application.`; step('assign_number', false, e.message); }
    }

    // 5. Route this number to this business only.
    const now = iso();
    db.transaction(() => {
      const again = db.prepare("SELECT organisation_id FROM comms_channels WHERE channel='voice' AND address=?").get(e164);
      if (again && again.organisation_id !== org) throw fail(409, 'This number was just connected to another Oprun business.');
      db.prepare("INSERT INTO comms_channels(organisation_id,channel,address,status,activated_at,created_at) VALUES (?,?,?,'active',?,?) ON CONFLICT(organisation_id,channel) DO UPDATE SET address=excluded.address,status='active',activated_at=excluded.activated_at").run(org, 'voice', e164, now, now);
      save(org, { assistant_id: assistantId, application_id: applicationId, status: problem ? 'needs_attention' : 'connected', steps_json: JSON.stringify(steps), last_error: problem, connected_at: problem ? prev.connected_at || null : now });
    })();
    log.log?.('[RECEPTIONIST] Telnyx connect', JSON.stringify({ organisation_id: org, status: problem ? 'needs_attention' : 'connected', steps: steps.map((s) => `${s.step}:${s.ok ? 'ok' : 'failed'}`) }));
    return publicStatus(org);
  }

  /** Sets or replaces the assistant ID by hand (when automatic creation is not available). */
  function setAssistant(org, assistantId) {
    if (!/^assistant-[0-9a-f-]{36}$/i.test(String(assistantId || ''))) throw fail(400, 'An assistant ID looks like assistant-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');
    const r = row(org); if (!r?.token_bundle) throw fail(409, 'Connect your Telnyx account first.');
    const steps = J(r.steps_json, []).filter((s) => s.step !== 'assistant'); steps.push({ step: 'assistant', ok: true, detail: 'Assistant ID entered by the business', at: iso() });
    const ok = steps.every((s) => s.ok);
    save(org, { assistant_id: assistantId, steps_json: JSON.stringify(steps), status: ok ? 'connected' : 'needs_attention', last_error: ok ? null : r.last_error, connected_at: ok ? (r.connected_at || iso()) : r.connected_at });
    return publicStatus(org);
  }

  /** Stops routing calls to Oprun. The number and the Telnyx account stay the business's own; nothing is released. */
  function disconnect(org) {
    db.transaction(() => {
      db.prepare("UPDATE comms_channels SET status='disabled' WHERE organisation_id=? AND channel='voice'").run(org);
      save(org, { status: 'disconnected', token_bundle: null, last_error: null });
    })();
    return publicStatus(org);
  }

  /** What the browser may see. Never includes keys. */
  function publicStatus(org) {
    const r = row(org);
    return {
      status: r?.status || 'not_connected', number: r?.number_e164 || null,
      assistant: r?.assistant_id ? `${r.assistant_id.slice(0, 14)}…` : null, application_connected: Boolean(r?.application_id),
      steps: J(r?.steps_json, []), problem: r?.last_error || null, connected_at: r?.connected_at || null, updated_at: r?.updated_at || null,
      webhook_url: webhookUrl(org), links: TELNYX_LINKS
    };
  }

  /** Server-only: decrypted keys and IDs for a connected business, or null. */
  function credentialsFor(org) {
    const r = org ? row(org) : null;
    if (!r?.token_bundle || !['connected', 'needs_attention'].includes(r.status)) return null;
    try { const b = runtime.decryptBundle(r.token_bundle); return { api_key: b.api_key, public_key: b.public_key, assistant_id: r.assistant_id || null, number: r.number_e164 }; }
    catch (e) { log.warn?.('[RECEPTIONIST] could not decrypt Telnyx keys for', org, e.message); return null; }
  }

  return { connect, setAssistant, disconnect, publicStatus, credentialsFor, webhookUrl };
}
