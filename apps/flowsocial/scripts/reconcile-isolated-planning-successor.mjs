import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileIsolatedPlanningSuccessor } from "../content-agent/unified-atomic-multiplatform-product.mjs";
import { resolveUnifiedReconciliationDomainAuthority } from "../content-agent/unified-content-server-adapter.mjs";
import { reconcileSqliteStorePair, resolveActiveStrategySnapshotFromSqlite } from "./sqlite-store-envelope.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function parseReconciliationArgs(argv) {
  const values = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") { values.apply = true; continue; }
    if (!token.startsWith("--") || !argv[index + 1]) throw new Error("RECONCILIATION_CLI_ARGUMENT_INVALID");
    values[token.slice(2)] = argv[++index];
  }
  const sqliteMode = Boolean(values["source-db"] || values["target-db"]);
  const required = sqliteMode
    ? ["source-db", "target-db", "bootstrap-id", "expected-source-revision", "expected-source-hash", "expected-target-revision", "expected-target-hash", "operator-id"]
    : ["source", "target", "bootstrap-id", "expected-source-revision", "expected-source-hash", "operator-id"];
  for (const key of required) {
    if (!values[key]) throw new Error(`RECONCILIATION_CLI_${key.toUpperCase().replaceAll("-", "_")}_REQUIRED`);
  }
  if (!/^[a-f0-9]{64}$/.test(values["expected-source-hash"])) throw new Error("RECONCILIATION_CLI_SOURCE_HASH_INVALID");
  if (sqliteMode && !/^[a-f0-9]{64}$/.test(values["expected-target-hash"])) throw new Error("RECONCILIATION_CLI_TARGET_HASH_INVALID");
  values.mode = sqliteMode ? "sqlite" : "json-envelope";
  return values;
}

export async function runReconciliationCli(argv, dependencies = {}) {
  const options = parseReconciliationArgs(argv);
  if (options.mode === "sqlite") {
    const request = {
      bootstrapId: options["bootstrap-id"],
      sourceRevision: Number(options["expected-source-revision"]),
      sourceStoreHash: options["expected-source-hash"],
      operator: { type: "operator", id: options["operator-id"] },
      apply: options.apply
    };
    return reconcileSqliteStorePair({
      sourceDb: options["source-db"], targetDb: options["target-db"],
      expectedSourceRevision: Number(options["expected-source-revision"]), expectedSourceHash: options["expected-source-hash"],
      expectedTargetRevision: Number(options["expected-target-revision"]), expectedTargetHash: options["expected-target-hash"],
      request, apply: options.apply
    }, {
      reconcile: reconcileIsolatedPlanningSuccessor,
      now: dependencies.now,
      reconciliationDependencies: dependencies.reconciliationDependencies,
      targetAuthorityResolver: (database, store, record) => resolveUnifiedReconciliationDomainAuthority(store, record, {
        resolveActiveStrategySnapshot: (accountId) => resolveActiveStrategySnapshotFromSqlite(database, accountId)
      }),
      beforeCasUpdate: dependencies.beforeCasUpdate
    });
  }
  const sourcePath = resolve(options.source);
  const targetPath = resolve(options.target);
  if (sourcePath === targetPath) throw new Error("RECONCILIATION_CLI_DISTINCT_PATHS_REQUIRED");
  const read = dependencies.readFile || readFile;
  const sourceBytes = await read(sourcePath);
  if (sha256(sourceBytes) !== options["expected-source-hash"]) throw new Error("RECONCILIATION_CLI_SOURCE_HASH_MISMATCH");
  const sourceEnvelope = JSON.parse(sourceBytes.toString("utf8"));
  if (String(sourceEnvelope.revision) !== options["expected-source-revision"] || !sourceEnvelope.store) throw new Error("RECONCILIATION_CLI_SOURCE_REVISION_MISMATCH");
  const targetBytes = await read(targetPath);
  const targetEnvelope = JSON.parse(targetBytes.toString("utf8"));
  if (!targetEnvelope.store) throw new Error("RECONCILIATION_CLI_TARGET_STORE_INVALID");
  const result = reconcileIsolatedPlanningSuccessor(targetEnvelope.store, sourceEnvelope.store, {
    bootstrapId: options["bootstrap-id"], sourceRevision: options["expected-source-revision"],
    sourceStoreHash: options["expected-source-hash"], operator: { type: "operator", id: options["operator-id"] }, apply: options.apply
  }, { ...dependencies.reconciliationDependencies, now: dependencies.now });
  if (options.apply && result.applied) {
    const output = `${JSON.stringify({ ...targetEnvelope, store: targetEnvelope.store }, null, 2)}\n`;
    const temporaryPath = join(dirname(targetPath), `.${basename(targetPath)}.${process.pid}.reconciliation`);
    await (dependencies.writeFile || writeFile)(temporaryPath, output, { flag: "wx" });
    await (dependencies.rename || rename)(temporaryPath, targetPath);
  }
  return { mode: options.apply ? "apply" : "dry-run", ...result };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReconciliationCli(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code || error.message })}\n`);
    process.exitCode = 1;
  });
}
