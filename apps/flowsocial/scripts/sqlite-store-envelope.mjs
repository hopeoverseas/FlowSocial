import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { mapStrategySnapshotRow } from "../strategy-agent/strategy-snapshot-domain.mjs";

const HASH = /^[a-f0-9]{64}$/;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function canonicalDatabasePath(value, code) {
  if (typeof value !== "string" || !isAbsolute(value)) fail(code);
  try {
    return realpathSync.native(value);
  } catch {
    fail(code);
  }
}

function samePath(left, right) {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function readEnvelope(database, role) {
  let rows;
  try {
    rows = database.prepare("SELECT id, payload, revision, updated_at AS updatedAt FROM app_state").all();
  } catch {
    fail(`RECONCILIATION_SQLITE_${role}_APP_STATE_REQUIRED`);
  }
  if (rows.length !== 1 || rows[0].id !== 1) fail(`RECONCILIATION_SQLITE_${role}_APP_STATE_CARDINALITY_INVALID`);
  const row = rows[0];
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.payload !== "string") {
    fail(`RECONCILIATION_SQLITE_${role}_ENVELOPE_INVALID`);
  }
  let store;
  try {
    store = JSON.parse(row.payload);
  } catch {
    fail(`RECONCILIATION_SQLITE_${role}_PAYLOAD_JSON_INVALID`);
  }
  if (!store || typeof store !== "object" || Array.isArray(store)) fail(`RECONCILIATION_SQLITE_${role}_STORE_INVALID`);
  return { store, revision: row.revision, updatedAt: row.updatedAt, payloadHash: sha256(row.payload) };
}

function assertExpected(envelope, expectedRevision, expectedHash, role) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) fail(`RECONCILIATION_SQLITE_${role}_REVISION_INVALID`);
  if (typeof expectedHash !== "string" || !HASH.test(expectedHash)) fail(`RECONCILIATION_SQLITE_${role}_HASH_INVALID`);
  if (envelope.revision !== expectedRevision) fail(`RECONCILIATION_SQLITE_${role}_REVISION_MISMATCH`);
  if (envelope.payloadHash !== expectedHash) fail(`RECONCILIATION_SQLITE_${role}_HASH_MISMATCH`);
}

function openReadOnly(path, role) {
  try {
    return new DatabaseSync(path, { readOnly: true });
  } catch {
    fail(`RECONCILIATION_SQLITE_${role}_OPEN_FAILED`);
  }
}

export function resolveActiveStrategySnapshotFromSqlite(database, accountId) {
  let rows;
  try {
    rows = database.prepare("SELECT * FROM strategy_snapshots WHERE account_id = ? AND status = 'active' ORDER BY version DESC").all(accountId);
  } catch {
    fail("RECONCILIATION_SQLITE_ACTIVE_STRATEGY_TABLE_REQUIRED");
  }
  if (rows.length !== 1) fail(rows.length
    ? "RECONCILIATION_SQLITE_ACTIVE_STRATEGY_AMBIGUOUS"
    : "RECONCILIATION_SQLITE_ACTIVE_STRATEGY_REQUIRED");
  const row = rows[0];
  let metadata = null;
  try { metadata = database.prepare("SELECT * FROM strategy_snapshot_meta WHERE strategy_snapshot_id = ?").get(row.id); } catch {}
  const snapshot = mapStrategySnapshotRow(row, metadata);
  if (!snapshot.payload || typeof snapshot.payload !== "object" || Array.isArray(snapshot.payload)) {
    fail("RECONCILIATION_SQLITE_ACTIVE_STRATEGY_PAYLOAD_INVALID");
  }
  return snapshot;
}

export function inspectSqliteStorePair({
  sourceDb,
  targetDb,
  expectedSourceRevision,
  expectedSourceHash,
  expectedTargetRevision,
  expectedTargetHash
}) {
  const sourcePath = canonicalDatabasePath(sourceDb, "RECONCILIATION_SQLITE_SOURCE_ABSOLUTE_PATH_REQUIRED");
  const targetPath = canonicalDatabasePath(targetDb, "RECONCILIATION_SQLITE_TARGET_ABSOLUTE_PATH_REQUIRED");
  if (samePath(sourcePath, targetPath)) fail("RECONCILIATION_SQLITE_DISTINCT_PATHS_REQUIRED");
  const source = openReadOnly(sourcePath, "SOURCE");
  const target = openReadOnly(targetPath, "TARGET");
  try {
    const sourceEnvelope = readEnvelope(source, "SOURCE");
    const targetEnvelope = readEnvelope(target, "TARGET");
    assertExpected(sourceEnvelope, expectedSourceRevision, expectedSourceHash, "SOURCE");
    assertExpected(targetEnvelope, expectedTargetRevision, expectedTargetHash, "TARGET");
    return { sourcePath, targetPath, sourceEnvelope, targetEnvelope };
  } finally {
    source.close();
    target.close();
  }
}

export function reconcileSqliteStorePair(options, {
  reconcile,
  now = () => new Date().toISOString(),
  reconciliationDependencies = {},
  targetAuthorityResolver = null,
  beforeCasUpdate = null
} = {}) {
  if (typeof reconcile !== "function") fail("RECONCILIATION_SQLITE_RECONCILER_REQUIRED");
  const sourcePath = canonicalDatabasePath(options.sourceDb, "RECONCILIATION_SQLITE_SOURCE_ABSOLUTE_PATH_REQUIRED");
  const targetPath = canonicalDatabasePath(options.targetDb, "RECONCILIATION_SQLITE_TARGET_ABSOLUTE_PATH_REQUIRED");
  if (samePath(sourcePath, targetPath)) fail("RECONCILIATION_SQLITE_DISTINCT_PATHS_REQUIRED");
  const source = openReadOnly(sourcePath, "SOURCE");
  let target = null;
  try {
    const sourceEnvelope = readEnvelope(source, "SOURCE");
    assertExpected(sourceEnvelope, options.expectedSourceRevision, options.expectedSourceHash, "SOURCE");
    if (options.apply !== true) {
      target = openReadOnly(targetPath, "TARGET");
      const targetEnvelope = readEnvelope(target, "TARGET");
      assertExpected(targetEnvelope, options.expectedTargetRevision, options.expectedTargetHash, "TARGET");
      const result = reconcile(targetEnvelope.store, sourceEnvelope.store, options.request, {
        ...reconciliationDependencies,
        ...(typeof reconciliationDependencies.resolveTargetAuthority !== "function" && typeof targetAuthorityResolver === "function"
          ? { resolveTargetAuthority: (store, record) => targetAuthorityResolver(target, store, record) }
          : {}),
        now
      });
      return { mode: "dry-run", source: sourceEnvelope, target: targetEnvelope, ...result };
    }

    target = new DatabaseSync(targetPath);
    target.exec("BEGIN IMMEDIATE");
    try {
      const targetEnvelope = readEnvelope(target, "TARGET");
      assertExpected(targetEnvelope, options.expectedTargetRevision, options.expectedTargetHash, "TARGET");
      const result = reconcile(targetEnvelope.store, sourceEnvelope.store, options.request, {
        ...reconciliationDependencies,
        ...(typeof reconciliationDependencies.resolveTargetAuthority !== "function" && typeof targetAuthorityResolver === "function"
          ? { resolveTargetAuthority: (store, record) => targetAuthorityResolver(target, store, record) }
          : {}),
        now
      });
      if (result.applied) {
        if (typeof beforeCasUpdate === "function") beforeCasUpdate(target);
        const payload = JSON.stringify(targetEnvelope.store);
        JSON.parse(payload);
        const update = target.prepare("UPDATE app_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?")
          .run(payload, now(), options.expectedTargetRevision);
        if (update.changes !== 1) fail("RECONCILIATION_SQLITE_TARGET_CAS_CONFLICT");
      }
      target.exec("COMMIT");
      return {
        mode: "apply",
        source: sourceEnvelope,
        target: { ...targetEnvelope, revision: targetEnvelope.revision + (result.applied ? 1 : 0) },
        ...result
      };
    } catch (error) {
      try { target.exec("ROLLBACK"); } catch {}
      throw error;
    }
  } finally {
    source.close();
    target?.close();
  }
}

export function sqlitePayloadHash(payload) {
  return sha256(typeof payload === "string" ? payload : JSON.stringify(payload));
}
