import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeUnifiedLive, hashFile, inspectUnifiedLiveReadiness, loadApproval } from "./unified-content-live-server.mjs";
import { DatabaseSync } from "node:sqlite";

function fail(code) { throw Object.assign(new Error(code), { code }); }

export function parseUnifiedLiveCli(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--dry-run")) return { mode: "dry-run", approvalFile: null, approvalSha256: null };
  if (args.length === 3 && args[0] === "--dry-run" && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--")) return { mode: "dry-run", approvalFile: args[2], approvalSha256: null };
  if (args.length === 5 && args[0] === "--live" && args[1] === "--approval-file" && args[2] && args[3] === "--approval-sha256" && /^[a-f0-9]{64}$/.test(args[4])) return { mode: "live", approvalFile: args[2], approvalSha256: args[4] };
  fail("UNIFIED_LIVE_CLI_ARGUMENTS_FORBIDDEN");
}

function sourceStore(path) {
  const db = new DatabaseSync(resolve(path), { readOnly: true });
  try { return JSON.parse(db.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload); }
  finally { db.close(); }
}

export async function runUnifiedLiveCli(args, operations = {}) {
  const cli = parseUnifiedLiveCli(args);
  if (!cli.approvalFile) return { schemaVersion: "1.0", mode: "dry-run", status: "approval_required", providerCalls: 0, externalCalls: 0, productionDatabaseWrites: 0 };
  const approval = loadApproval(cli.approvalFile);
  if (cli.mode === "dry-run") {
    const providerConfig = operations.providerConfig || await (operations.resolveProviderConfig || (async () => (await import("../../provider-config.mjs")).getPublicProviderConfig()))();
    const readiness = inspectUnifiedLiveReadiness({ approval, store: sourceStore(approval.sourceDatabasePath), providerConfig, currentFlags: operations.currentFlags });
    if (readiness.status !== "ready") return { schemaVersion: "1.0", mode: "dry-run", ...readiness };
    const { preflight } = readiness;
    return { schemaVersion: "1.0", mode: "dry-run", status: "preflight_materialized", plan: preflight.plan, planHash: preflight.planHash, providerCalls: 0, externalCalls: 0, productionDatabaseWrites: 0 };
  }
  const actualApprovalHash = hashFile(resolve(cli.approvalFile));
  if (actualApprovalHash !== cli.approvalSha256) fail("LIVE_APPROVAL_HASH_MISMATCH");
  return executeUnifiedLive({ approval, approvalFileHash: cli.approvalSha256, operations });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { process.stdout.write(`${JSON.stringify(await runUnifiedLiveCli(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${String(error?.code || "UNIFIED_LIVE_FAILED").replace(/[^A-Z0-9_:-]/gi, "").slice(0, 100)}\n`); process.exitCode = 1; }
}
