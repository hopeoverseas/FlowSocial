import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mapStrategySnapshotRow } from "../../strategy-agent/strategy-snapshot-domain.mjs";
import { resolveActiveStrategySnapshotFromSqlite } from "../sqlite-store-envelope.mjs";

const row = {
  id: "strategy:domain", account_id: "company:domain", version: 3, status: "active",
  payload_json: JSON.stringify({ positioning: "canonical" }), source_session_id: "session:domain",
  created_at: "2026-08-10T04:00:00.000Z", confirmed_at: "2026-08-10T04:01:00.000Z"
};
const metadata = {
  strategy_snapshot_id: row.id, source_draft_revision_id: "draft:domain", document_hash: "a".repeat(64),
  context_hash: "b".repeat(64), activation_reason: "user_confirmed", supersedes_snapshot_id: "strategy:previous"
};
const canonical = mapStrategySnapshotRow(row, metadata);
assert.deepEqual(canonical, {
  id: row.id, accountId: row.account_id, version: row.version, status: row.status,
  sourceSessionId: row.source_session_id, payload: { positioning: "canonical" },
  createdAt: row.created_at, confirmedAt: row.confirmed_at,
  schemaVersion: "2.0", document: { positioning: "canonical" }, sourceDraftRevisionId: "draft:domain",
  documentHash: "a".repeat(64), contextHash: "b".repeat(64), activationReason: "user_confirmed",
  supersedesSnapshotId: "strategy:previous", activatedAt: row.confirmed_at
});
assert.deepEqual(mapStrategySnapshotRow({ ...row, payload_json: "{" }), {
  id: row.id, accountId: row.account_id, version: row.version, status: row.status,
  sourceSessionId: row.source_session_id, payload: {}, createdAt: row.created_at, confirmedAt: row.confirmed_at
});
assert.equal(mapStrategySnapshotRow(null), null);

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE strategy_snapshots (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL,
    payload_json TEXT NOT NULL, source_session_id TEXT, created_at TEXT NOT NULL, confirmed_at TEXT
  );
  CREATE TABLE strategy_snapshot_meta (
    strategy_snapshot_id TEXT PRIMARY KEY, source_draft_revision_id TEXT, document_hash TEXT,
    context_hash TEXT, activation_reason TEXT, supersedes_snapshot_id TEXT, created_at TEXT
  );
`);
database.prepare("INSERT INTO strategy_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(...Object.values(row));
database.prepare("INSERT INTO strategy_snapshot_meta VALUES (?, ?, ?, ?, ?, ?, ?)")
  .run(...Object.values({ ...metadata, created_at: row.created_at }));
assert.deepEqual(resolveActiveStrategySnapshotFromSqlite(database, row.account_id), canonical,
  "transaction-bound resolver and production mapper must share one canonical mapping");
assert.throws(() => resolveActiveStrategySnapshotFromSqlite(database, "missing"), /RECONCILIATION_SQLITE_ACTIVE_STRATEGY_REQUIRED/);
database.prepare("INSERT INTO strategy_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
  .run("strategy:ambiguous", row.account_id, 4, "active", row.payload_json, null, row.created_at, row.confirmed_at);
assert.throws(() => resolveActiveStrategySnapshotFromSqlite(database, row.account_id), /RECONCILIATION_SQLITE_ACTIVE_STRATEGY_AMBIGUOUS/);
database.close();

console.log(JSON.stringify({
  status: "strategy-snapshot-domain-resolver-self-test passed",
  defaultDatabaseOpens: 0,
  schemaWritesByResolver: 0,
  walWritesByResolver: 0,
  realProviderCalls: 0,
  networkCalls: 0,
  activeDatabaseWrites: 0
}, null, 2));
