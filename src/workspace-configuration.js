import { createHash } from 'node:crypto';
import { z } from 'zod';
import { appendAuditLog } from './db.js';
import { currencyFor, RULES_REVIEWED_AT } from './country-rules.js';
import { INDUSTRY_REGISTRY, industrySources } from './industry-registry.js';

const path = '/api/saas/workspace-configuration';
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const expectation = {
  expected_revision: revision,
  expected_context: z.string().regex(/^[a-f0-9]{64}$/),
};
const providerReference = z.object({ provider: key, capability: key }).strict();
const pack = z.object({
  key,
  label: z.string().trim().min(1).max(120),
  industry: key,
  provider_references: z.array(providerReference).max(16).default([]),
}).strict();
const activity = z.object({
  key,
  label: z.string().trim().min(1).max(120),
  pack_key: key,
}).strict();
const config = z.object({
  packs: z.array(pack).max(24),
  activities: z.array(activity).max(48),
}).strict();
const approval = z.object({ ...expectation, configuration: config }).strict();
const rollback = z.object({ ...expectation, target_revision: revision }).strict();
const australianStates = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
const industries = new Map(INDUSTRY_REGISTRY.map(item => [item.code, item]));

function jurisdiction(country, region) {
  const code = String(country || '').trim().toUpperCase() || null;
  const subdivision = String(region || '').trim().toUpperCase() || null;
  const state = code === 'AU' && australianStates.has(subdivision) ? subdivision : null;
  const currency = code ? currencyFor(code) : null;
  return {
    country: code,
    region: subdivision,
    metadata_status: !code ? 'unknown' : code === 'AU' ? 'reference_available' : 'unsupported',
    subdivision_status: !subdivision ? 'unknown' : state ? 'reference_available' : 'unsupported',
    currency,
    country_rules_reviewed_at: currency ? RULES_REVIEWED_AT : null,
  };
}

function describe(configuration, location) {
  return {
    jurisdiction: location,
    packs: configuration.packs.map(({ key, industry }) => {
      const entry = industries.get(industry);
      const sources = entry && location.country === 'AU'
        ? industrySources(entry, location.region).filter(source => source.jurisdiction === 'AU' ||
          location.subdivision_status === 'reference_available' && source.jurisdiction === location.region)
        : [];
      return {
        key,
        industry_status: !entry || industry === 'custom' ? 'unknown' : 'catalogued',
        sources: sources.map(({ id, authority, jurisdiction, url }) => ({ id, authority, jurisdiction, url })),
        regulated_capability: 'unsupported',
      };
    }),
  };
}

function validReferences({ packs, activities }) {
  const packKeys = new Set(packs.map(pack => pack.key));
  return packKeys.size === packs.length &&
    new Set(activities.map(activity => activity.key)).size === activities.length &&
    activities.every(activity => packKeys.has(activity.pack_key));
}

export function installWorkspaceConfiguration(app, { db, requireSaasUser, getProviderCapabilities }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_configuration_revisions (
      organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision > 0),
      schema_version INTEGER NOT NULL CHECK(schema_version = 1),
      configuration_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      context_hash TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      restored_from INTEGER,
      PRIMARY KEY (organisation_id, revision)
    );
    CREATE TRIGGER IF NOT EXISTS workspace_configuration_no_update
      BEFORE UPDATE ON workspace_configuration_revisions
      BEGIN SELECT RAISE(ABORT, 'Approved workspace revisions are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS workspace_configuration_no_delete
      BEFORE DELETE ON workspace_configuration_revisions
      WHEN EXISTS (SELECT 1 FROM organisations WHERE id=OLD.organisation_id)
      BEGIN SELECT RAISE(ABORT, 'Approved workspace revisions are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS workspace_configuration_no_replace
      BEFORE INSERT ON workspace_configuration_revisions
      WHEN EXISTS (SELECT 1 FROM workspace_configuration_revisions
        WHERE organisation_id=NEW.organisation_id AND revision=NEW.revision)
      BEGIN SELECT RAISE(ABORT, 'Approved workspace revisions are immutable'); END;
  `);
  const owner = db.prepare(`SELECT 1 FROM memberships WHERE organisation_id=? AND user_id=?
    AND status='active' AND role='owner'`);
  const existing = db.prepare(`SELECT o.country, o.address_state, o.state, o.modules_json,
      p.industry_code, p.services, p.pipeline_stages_json
    FROM organisations o LEFT JOIN onboarding_profiles p ON p.organisation_id=o.id WHERE o.id=?`);
  const find = db.prepare('SELECT * FROM workspace_configuration_revisions WHERE organisation_id=? AND revision=?');
  const latest = db.prepare('SELECT * FROM workspace_configuration_revisions WHERE organisation_id=? ORDER BY revision DESC LIMIT 1');
  const insert = db.prepare(`INSERT INTO workspace_configuration_revisions
    (organisation_id, revision, schema_version, configuration_json, metadata_json, context_hash, approved_by, approved_at, restored_from)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`);
  const connection = db.prepare('SELECT status FROM organisation_integrations WHERE organisation_id=? AND provider=?');

  function context(org) {
    const profile = existing.get(org);
    return {
      location: jurisdiction(profile.country, profile.address_state || profile.state),
      hash: createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
      industry: profile.industry_code,
    };
  }

  function view(org, row, current) {
    const configuration = row ? JSON.parse(row.configuration_json) : { packs: [], activities: [] };
    const references = new Map(configuration.packs.flatMap(pack => pack.provider_references)
      .map(ref => [ref.provider + ':' + ref.capability, ref]));
    const providers = Array.from(references.values(), ref => {
      const capabilities = getProviderCapabilities(ref.provider);
      const support = !Array.isArray(capabilities) || !capabilities.length ? 'unknown'
        : capabilities.includes(ref.capability) ? 'catalogued' : 'unsupported';
      return {
        ...ref,
        support,
        connection: support === 'catalogued' ? connection.get(org, ref.provider)?.status ?? 'not_connected' : 'unknown',
        approval: support === 'unsupported' ? 'not_applicable' : 'unknown',
      };
    });
    return {
      revision: row?.revision ?? 0,
      schema_version: 1,
      approved_by: row?.approved_by ?? null,
      approved_at: row?.approved_at ?? null,
      restored_from: row?.restored_from ?? null,
      context: current.hash,
      context_changed: Boolean(row && row.context_hash !== current.hash),
      legacy_industry: current.industry,
      configuration,
      metadata: row ? JSON.parse(row.metadata_json) : describe(configuration, current.location),
      providers,
    };
  }

  function isOwner(req) {
    const { organisation_id, user_id, role } = req.saas;
    return role === 'owner' && Boolean(owner.get(organisation_id, user_id));
  }

  function ownerOnly(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!isOwner(req)) return res.status(403).json({ ok: false, error: 'Workspace configuration requires an active owner.' });
    next();
  }

  const apply = db.transaction((req, input) => {
    // Lock before checking the owner and head so two connections cannot approve the same base.
    if (!isOwner(req)) return { status: 403, error: 'Workspace owner authority changed.' };
    const { organisation_id: org, user_id: user, full_name: name } = req.saas;
    const head = latest.get(org);
    const current = context(org);
    if ((head?.revision ?? 0) !== input.expected_revision || current.hash !== input.expected_context) {
      return { status: 409, error: 'Workspace configuration or its context changed. Reload before approving.' };
    }
    const from = input.target_revision ?? null;
    // Revision zero is a live legacy projection. It was never approved and has no historical snapshot.
    const target = from === null ? null : find.get(org, from);
    if (from !== null && !target) return { status: 404, error: 'Approved revision not found.' };
    if (target && target.revision >= head.revision) return { status: 409, error: 'Choose an earlier approved revision.' };
    // Rollback copies only descriptive configuration. Live permission and provider stores are outside this contract.
    const desired = target ? JSON.parse(target.configuration_json) : input.configuration;
    const next = (head?.revision ?? 0) + 1;
    const metadata = describe(desired, current.location);
    insert.run(org, next, JSON.stringify(desired), JSON.stringify(metadata), current.hash, user, new Date().toISOString(), from);
    appendAuditLog(db, {
      organisation_id: org, user_id: user, user_name: name, user_role: 'owner',
      action: target ? 'workspace.configuration_rolled_back' : 'workspace.configuration_approved',
      entity_type: 'workspace_configuration', entity_id: String(next),
      metadata: { revision: next, previous_revision: next - 1, restored_from: from, context_hash: current.hash },
    });
    return { configuration: view(org, find.get(org, next), current) };
  });

  function approve(schema) {
    return (req, res) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success || (parsed.data.configuration && !validReferences(parsed.data.configuration))) {
        return res.status(400).json({ ok: false, error: 'Invalid workspace configuration or references.' });
      }
      const result = apply.immediate(req, parsed.data);
      if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
      return res.status(201).json({ ok: true, ...result.configuration });
    };
  }

  app.get(path, requireSaasUser, ownerOnly, (req, res) => {
    const org = req.saas.organisation_id;
    res.json({ ok: true, ...view(org, latest.get(org), context(org)) });
  });
  app.get(path + '/revisions/:revision', requireSaasUser, ownerOnly, (req, res) => {
    const org = req.saas.organisation_id;
    const number = Number(req.params.revision);
    const row = /^[1-9]\d*$/.test(req.params.revision) && Number.isSafeInteger(number) && find.get(org, number);
    if (!row) return res.status(404).json({ ok: false, error: 'Approved revision not found.' });
    return res.json({ ok: true, ...view(org, row, context(org)) });
  });
  app.post(path + '/approve', requireSaasUser, ownerOnly, approve(approval));
  app.post(path + '/rollback', requireSaasUser, ownerOnly, approve(rollback));
}
