import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { createUnifiedStagedAtomicDualBootstrap } from "../../content-agent/unified-atomic-multiplatform-product.mjs";
import { runReconciliationCli } from "../reconcile-isolated-planning-successor.mjs";
import { sqlitePayloadHash } from "../sqlite-store-envelope.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent({ id }) });
const input = {
  requestId: "request:sqlite", idempotencyKey: "key:sqlite", companyId: "company:sqlite", projectId: "project:sqlite",
  topicIntent: { topic: "sqlite reconciliation" }, activeStrategySnapshotRef: ref("strategy:sqlite"), prerequisiteRef: ref("prerequisite:sqlite"),
  accounts: { xiaohongshu: ref("account:xhs"), wechat: ref("account:wechat") }, authorizationSourceRefs: [ref("auth:sqlite")]
};
const specs = [
  ["shared", "build-content-master", { id: "master:sqlite", contract: "ContentMaster@3.0" }],
  ["xiaohongshu", "generate-content-outline", { id: "outline:xhs", platform: "xiaohongshu", sections: [] }],
  ["wechat", "generate-content-outline", { id: "outline:wechat", platform: "wechat", sections: [] }]
];
const invocations = specs.map(([platform, capability], index) => {
  const executionRecord = { index };
  const base = { id: `inv:sqlite:${index}`, platform, capability, executionRecord };
  return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) };
});
const facts = specs.map(([platform, capability, data], index) => {
  const runtimeOutput = { data };
  const base = {
    schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `fact:sqlite:${index}`,
    invocationRef: { id: invocations[index].id, hash: invocations[index].invocationHash }, platform, capability,
    runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput)
  };
  return { ...base, factHash: hashUnifiedContent(base) };
});
const planningBase = {
  schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", sharedContentMaster: specs[0][2],
  sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(specs[0][2]) }],
  platformRuns: specs.slice(1).map(([platform,, outline]) => ({ platform, outline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(outline) }] }))
};
const authority = {
  bindingRefs: {
    activeStrategySnapshotRef: input.activeStrategySnapshotRef, prerequisiteRef: input.prerequisiteRef,
    accountRefs: input.accounts, authorizationSourceRefs: input.authorizationSourceRefs
  },
  prerequisite: { id: "prerequisite" }, authoritySources: [{ id: "auth" }]
};
const sourceStore = {};
await createUnifiedStagedAtomicDualBootstrap(sourceStore, input, {
  featureFlags: { unifiedContentStagedAtomicDualBootstrapV1: true },
  now: () => "2026-08-10T03:00:00.000Z",
  planBootstrap: async () => ({ authority, actualInvocations: invocations, outputFacts: facts, planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) } })
});
const bootstrapId = sourceStore.unifiedStagedAtomicDualBootstraps[0].id;
const targetStore = { preserved: { exact: ["bytes", "semantic"] } };

function createDatabase(path, payload, revision, { rows = 1 } = {}) {
  const database = new DatabaseSync(path);
  database.exec("CREATE TABLE app_state (id INTEGER, payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)");
  const insert = database.prepare("INSERT INTO app_state (id, payload, revision, updated_at) VALUES (?, ?, ?, ?)");
  if (rows >= 1) insert.run(1, payload, revision, "2026-08-10T03:00:00.000Z");
  if (rows >= 2) insert.run(2, payload, revision, "2026-08-10T03:00:00.000Z");
  database.close();
}

function readDatabase(path) {
  const database = new DatabaseSync(path, { readOnly: true });
  const row = database.prepare("SELECT payload, revision, updated_at AS updatedAt FROM app_state WHERE id = 1").get();
  database.close();
  return { ...row, store: JSON.parse(row.payload), payloadHash: sqlitePayloadHash(row.payload) };
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "flowsocial-reconciliation-sqlite-"));
try {
  const sourcePath = join(temporaryRoot, "source.db");
  const targetPath = join(temporaryRoot, "target.db");
  const sourcePayload = JSON.stringify(sourceStore);
  const targetPayload = JSON.stringify(targetStore);
  createDatabase(sourcePath, sourcePayload, 7);
  createDatabase(targetPath, targetPayload, 11);
  const dependencies = {
    now: () => "2026-08-10T03:01:00.000Z",
    reconciliationDependencies: { resolveTargetAuthority: () => structuredClone(authority) }
  };
  const args = [
    "--source-db", sourcePath, "--target-db", targetPath, "--bootstrap-id", bootstrapId,
    "--expected-source-revision", "7", "--expected-source-hash", sqlitePayloadHash(sourcePayload),
    "--expected-target-revision", "11", "--expected-target-hash", sqlitePayloadHash(targetPayload),
    "--operator-id", "controller:sqlite"
  ];
  const sourceBefore = await stat(sourcePath);
  const targetBefore = await stat(targetPath);
  const dry = await runReconciliationCli(args, dependencies);
  assert.equal(dry.mode, "dry-run");
  assert.equal(dry.applied, false);
  assert.deepEqual(readDatabase(sourcePath), { payload: sourcePayload, revision: 7, updatedAt: "2026-08-10T03:00:00.000Z", store: sourceStore, payloadHash: sqlitePayloadHash(sourcePayload) });
  assert.deepEqual(readDatabase(targetPath), { payload: targetPayload, revision: 11, updatedAt: "2026-08-10T03:00:00.000Z", store: targetStore, payloadHash: sqlitePayloadHash(targetPayload) });
  assert.equal((await stat(sourcePath)).mtimeMs, sourceBefore.mtimeMs);
  assert.equal((await stat(targetPath)).mtimeMs, targetBefore.mtimeMs);
  assert.equal(existsSync(`${sourcePath}-wal`), false);
  assert.equal(existsSync(`${targetPath}-wal`), false);

  const applied = await runReconciliationCli([...args, "--apply"], dependencies);
  assert.equal(applied.applied, true);
  const sourceAfter = readDatabase(sourcePath);
  const targetAfter = readDatabase(targetPath);
  assert.equal(sourceAfter.revision, 7);
  assert.equal(sourceAfter.payload, sourcePayload);
  assert.equal((await stat(sourcePath)).mtimeMs, sourceBefore.mtimeMs);
  assert.equal(targetAfter.revision, 12);
  assert.deepEqual(targetAfter.store.preserved, targetStore.preserved);
  assert.equal(targetAfter.store.unifiedStagedAtomicDualBootstraps.length, 1);
  assert.equal(targetAfter.store.planningSuccessorReconciliationReceipts.length, 1);

  const replayArgs = args.map((value, index) => value === "11" && args[index - 1] === "--expected-target-revision" ? "12"
    : value === sqlitePayloadHash(targetPayload) ? targetAfter.payloadHash : value);
  const replay = await runReconciliationCli([...replayArgs, "--apply"], dependencies);
  assert.equal(replay.idempotent, true);
  assert.equal(readDatabase(targetPath).revision, 12, "idempotent replay must not increment target revision");

  const beforeStale = readDatabase(targetPath);
  await assert.rejects(() => runReconciliationCli([...args, "--apply"], dependencies), /RECONCILIATION_SQLITE_TARGET_REVISION_MISMATCH/);
  assert.deepEqual(readDatabase(targetPath), beforeStale);
  await assert.rejects(() => runReconciliationCli(args.map((value) => value === targetPath ? sourcePath : value), dependencies), /RECONCILIATION_SQLITE_DISTINCT_PATHS_REQUIRED/);

  const conflictPath = join(temporaryRoot, "conflict.db");
  createDatabase(conflictPath, targetPayload, 11);
  const conflictArgs = args.map((value) => value === targetPath ? conflictPath : value);
  await assert.rejects(() => runReconciliationCli([...conflictArgs, "--apply"], {
    ...dependencies,
    beforeCasUpdate: (database) => database.exec("UPDATE app_state SET revision = revision + 1 WHERE id = 1")
  }), /RECONCILIATION_SQLITE_TARGET_CAS_CONFLICT/);
  assert.equal(readDatabase(conflictPath).revision, 11, "CAS conflict must rollback the entire target transaction");

  const authorityPath = join(temporaryRoot, "authority.db");
  createDatabase(authorityPath, targetPayload, 11);
  const authorityArgs = args.map((value) => value === targetPath ? authorityPath : value);
  await assert.rejects(() => runReconciliationCli([...authorityArgs, "--apply"], {
    ...dependencies,
    reconciliationDependencies: { resolveTargetAuthority: () => ({ ...authority, changed: true }) }
  }), /UNIFIED_STAGED_ATOMIC_RECONCILIATION_TARGET_AUTHORITY_MISMATCH/);
  assert.equal(readDatabase(authorityPath).revision, 11);

  for (const [name, payload, rows, code] of [
    ["bad-json.db", "{", 1, "RECONCILIATION_SQLITE_TARGET_PAYLOAD_JSON_INVALID"],
    ["missing-row.db", targetPayload, 0, "RECONCILIATION_SQLITE_TARGET_APP_STATE_CARDINALITY_INVALID"],
    ["many-rows.db", targetPayload, 2, "RECONCILIATION_SQLITE_TARGET_APP_STATE_CARDINALITY_INVALID"]
  ]) {
    const path = join(temporaryRoot, name);
    createDatabase(path, payload, 11, { rows });
    const invalidArgs = args.map((value) => value === targetPath ? path : value)
      .map((value) => value === sqlitePayloadHash(targetPayload) ? sqlitePayloadHash(payload) : value);
    await assert.rejects(() => runReconciliationCli(invalidArgs, dependencies), new RegExp(code));
  }

  console.log(JSON.stringify({
    status: "planning-reconciliation-sqlite-adapter-self-test passed",
    dryRunDatabaseWrites: 0,
    applyTargetRevisionDelta: 1,
    sourceDatabaseWrites: 0,
    realProviderCalls: 0,
    retries: 0,
    networkCalls: 0,
    activeDatabaseWrites: 0,
    browserCalls: 0,
    platformWrites: 0,
    publicationWrites: 0,
    feedbackWrites: 0
  }, null, 2));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
