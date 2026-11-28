const definitions = `
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
  `.trim().split(/\n(?=\s*CREATE )/).map(sql => sql.trim().replace(/;$/, ''));
const objects = ['workspace_configuration_revisions', 'workspace_configuration_no_update', 'workspace_configuration_no_delete', 'workspace_configuration_no_replace'];
const marker = 'workspace_configuration_schema';
const markerDefinition = 'CREATE TABLE workspace_configuration_schema (version INTEGER PRIMARY KEY CHECK(version=1))';

function canonical(sql) {
  return sql?.replace(/\s+/g, ' ').trim().replace(/^CREATE (TABLE|TRIGGER) IF NOT EXISTS /i, 'CREATE $1 ');
}

export function verifyWorkspaceConfigurationSchema(db) {
  const read = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?');
  const actual = objects.map(name => read.get(name));
  const installed = read.get(marker);
  const evidence = read.get('audit_logs') && db.prepare(`SELECT 1 FROM audit_logs WHERE action IN
    ('workspace.configuration_approved','workspace.configuration_rolled_back') LIMIT 1`).get();
  if (!installed && !actual.some(Boolean) && !evidence) return { state: 'uninitialised', problems: [] };

  const problems = [];
  if (installed && (installed.type !== 'table' || canonical(installed.sql) !== markerDefinition ||
      !db.prepare('SELECT 1 FROM workspace_configuration_schema WHERE version=1').get())) {
    problems.push(marker + ' definition or marker row is invalid');
  }
  for (const [i, name] of objects.entries()) {
    if (!actual[i]) problems.push('missing ' + name);
    else if (canonical(actual[i].sql) !== canonical(definitions[i])) problems.push('altered definition for ' + name);
  }
  if (!problems.length && evidence && db.prepare(`SELECT 1 FROM audit_logs a
    JOIN organisations o ON o.id=a.organisation_id
    WHERE a.action IN ('workspace.configuration_approved','workspace.configuration_rolled_back')
      AND NOT EXISTS (SELECT 1 FROM workspace_configuration_revisions r
        WHERE r.organisation_id=a.organisation_id AND r.revision=CAST(a.entity_id AS INTEGER))
    LIMIT 1`).get()) problems.push('approved revision history is missing');
  return { state: problems.length ? 'invalid' : 'verified', problems };
}

function requirePrerequisites(db) {
  const required = {
    organisations: ['id','country','address_state','state','modules_json'],
    onboarding_profiles: ['organisation_id','industry_code','services','pipeline_stages_json'],
    memberships: ['organisation_id','user_id','status','role'],
    organisation_integrations: ['organisation_id','provider','status'],
    audit_logs: ['action','organisation_id','entity_id'],
  };
  const missing = [];
  for (const [table, columns] of Object.entries(required)) {
    const found = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    for (const column of columns) if (!found.has(column)) missing.push(table + '.' + column);
  }
  if (missing.length) {
    throw new Error('Workspace configuration startup requires database bootstrap, module rules and onboarding proposal setup first. Missing: ' + missing.join(', '));
  }
  if (!db.pragma('foreign_keys', { simple: true })) throw new Error('Workspace configuration requires SQLite foreign keys.');
}

export function initialiseWorkspaceConfigurationSchema(db) {
  requirePrerequisites(db);
  db.transaction(() => {
    const check = verifyWorkspaceConfigurationSchema(db);
    if (check.state === 'invalid') {
      throw new Error('Workspace configuration schema integrity failure. Restore verified schema and history before startup: ' + check.problems.join('; '));
    }
    if (check.state === 'uninitialised') db.exec(definitions.join(';\n'));
    db.exec(markerDefinition.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
    db.prepare('INSERT OR IGNORE INTO workspace_configuration_schema(version) VALUES (1)').run();
  }).immediate();
}
