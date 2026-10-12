import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { fork } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashUnifiedContent, validateContentMechanismDecision, validateUnifiedContentOpportunity } from "../../content-agent/unified-content-contracts.mjs";

const flowsocialRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tmpRoot = resolve(flowsocialRoot, ".tmp");
const internalApiArg = "--internal-isolated-prerequisite-api";

function fail(code, message = code) { throw Object.assign(new Error(message), { code }); }
function contained(parent, child) { const rel = relative(parent, child); return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)); }

function validateIsolatedDataDir(value) {
  const dataDir = resolve(String(value || ""));
  if (!existsSync(dataDir) || !lstatSync(dataDir).isDirectory()) fail("UNIFIED_PREREQUISITE_ISOLATED_DATA_DIR_REQUIRED");
  if (!existsSync(tmpRoot) || dataDir === tmpRoot || !contained(realpathSync(tmpRoot), realpathSync(dataDir))) fail("UNIFIED_PREREQUISITE_DATA_DIR_OUTSIDE_TMP");
  let cursor = dataDir;
  while (contained(tmpRoot, cursor)) {
    if (lstatSync(cursor).isSymbolicLink()) fail("UNIFIED_PREREQUISITE_DATA_DIR_LINK_FORBIDDEN");
    if (cursor === tmpRoot) break;
    cursor = dirname(cursor);
  }
  const databasePath = resolve(dataDir, "flowsocial.db");
  if (!existsSync(databasePath) || !lstatSync(databasePath).isFile() || lstatSync(databasePath).isSymbolicLink()) fail("UNIFIED_PREREQUISITE_ISOLATED_DATABASE_REQUIRED");
  return { dataDir, databasePath };
}

function listenLoopback(server) {
  return new Promise((resolveListen, reject) => {
    const onError = (error) => reject(Object.assign(error, { code: error?.code || "UNIFIED_PREREQUISITE_LOCAL_SERVER_LISTEN_FAILED" }));
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string" || address.address !== "127.0.0.1") return reject(Object.assign(new Error("Local server did not bind to IPv4 loopback"), { code: "UNIFIED_PREREQUISITE_LOCAL_SERVER_BINDING_INVALID" }));
      resolveListen(address.port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => {
    if (!server.listening) return resolveClose();
    server.close(() => resolveClose());
  });
}

async function startChildServer() {
  const { server } = await import("../../server.mjs");
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await closeServer(server);
    if (process.connected) process.disconnect();
  };
  try {
    const port = await listenLoopback(server);
    process.send({ type: "ready", port });
    process.once("message", (message) => {
      if (message?.type === "close") shutdown();
    });
    process.once("disconnect", shutdown);
  } catch (error) {
    if (process.connected) process.send({ type: "error", code: error?.code || "UNIFIED_PREREQUISITE_CHILD_FAILED" });
    await shutdown();
  }
}

function openIsolatedApiChild(dataDir) {
  const child = fork(fileURLToPath(import.meta.url), [internalApiArg], {
    env: {
      ...process.env,
      FLOWSOCIAL_DATA_DIR: dataDir,
      FLOWSOCIAL_DISABLE_SERVER_LISTEN: "1",
      UNIFIED_CONTENT_PREREQUISITES_V1: "1"
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  return new Promise((resolveChild, reject) => {
    const cleanupStartup = () => {
      child.off("error", onError);
      child.off("exit", onExit);
      child.off("message", onMessage);
    };
    const onError = (error) => { cleanupStartup(); reject(error); };
    const onExit = (code) => { cleanupStartup(); reject(Object.assign(new Error(`Isolated API child exited before ready: ${code}`), { code: "UNIFIED_PREREQUISITE_CHILD_START_FAILED" })); };
    const onMessage = (message) => {
      if (message?.type === "error") {
        cleanupStartup();
        return reject(Object.assign(new Error(message.code), { code: message.code }));
      }
      if (message?.type !== "ready" || !Number.isInteger(message.port)) return;
      cleanupStartup();
      let closed = false;
      resolveChild({
        port: message.port,
        close: async () => {
          if (closed) return;
          closed = true;
          const exited = new Promise((resolveExit, rejectExit) => {
            child.once("error", rejectExit);
            child.once("exit", (code) => code === 0 ? resolveExit() : rejectExit(Object.assign(new Error(`Isolated API child exited ${code}`), { code: "UNIFIED_PREREQUISITE_CHILD_EXIT_FAILED" })));
          });
          child.send({ type: "close" });
          await exited;
        }
      });
    };
    child.once("error", onError);
    child.once("exit", onExit);
    child.on("message", onMessage);
  });
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function validateDesignDnaBinding(payload, request) {
  const ref = payload.designDnaSnapshotRef;
  if (!ref || typeof ref !== "object" || Array.isArray(ref)
    || JSON.stringify(Object.keys(ref).sort()) !== JSON.stringify(["hash", "id"])
    || typeof ref.id !== "string" || !ref.id.trim() || !/^[a-f0-9]{64}$/.test(ref.hash || "")) {
    fail("UNIFIED_PREREQUISITE_API_DESIGN_DNA_REF_INVALID");
  }
  const opportunity = payload.opportunity;
  const mechanism = payload.mechanismDecision;
  const hotspot = mechanism.evaluated?.find((item) => item?.mechanism === "hotspot");
  const projectInput = {
    schemaVersion: "1.0",
    contract: "UnifiedContentProjectInput@1.0",
    companyId: opportunity.companyId,
    accounts: { xiaohongshu: request.xiaohongshuAccountId, wechat: request.wechatAccountId },
    activeStrategySnapshotRef: opportunity.activeStrategySnapshotRef,
    contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash }
  };
  const expectedProjectInputHash = hashUnifiedContent(projectInput);
  const expectedProjectInputRef = { id: `unified_project_input:${expectedProjectInputHash.slice(0, 24)}`, hash: expectedProjectInputHash };
  if (opportunity.companyId !== request.companyId
    || opportunity.accountRefs?.xiaohongshu?.id !== request.xiaohongshuAccountId
    || opportunity.accountRefs?.wechat?.id !== request.wechatAccountId
    || opportunity.topic !== request.topic.trim()
    || opportunity.contentObjective !== request.contentObjective.trim()
    || !sameRef(mechanism.activeStrategySnapshotRef, opportunity.activeStrategySnapshotRef)
    || !sameRef(mechanism.projectInputRef, expectedProjectInputRef)
    || mechanism.selectedMechanism !== "strategy_only"
    || !hotspot
    || hashUnifiedContent({ status: hotspot.status, candidateRefs: hotspot.candidateRefs, reason: hotspot.reason, factPolicy: hotspot.factPolicy }) !== hashUnifiedContent(request.hotspotEvaluation)) {
    fail("UNIFIED_PREREQUISITE_API_REQUEST_BINDING_MISMATCH");
  }
  const expectedSemanticHash = hashUnifiedContent({
    companyId: opportunity.companyId,
    accounts: opportunity.accountRefs,
    activeStrategySnapshotRef: opportunity.activeStrategySnapshotRef,
    designDnaSnapshotRef: ref,
    topic: opportunity.topic,
    contentObjective: opportunity.contentObjective,
    selectedMechanism: mechanism.selectedMechanism,
    hotspotEvaluation: request.hotspotEvaluation,
    strategyHotspotPolicy: mechanism.strategyHotspotPolicy
  });
  if (opportunity.semanticHash !== expectedSemanticHash) fail("UNIFIED_PREREQUISITE_API_DESIGN_DNA_REF_MISMATCH");
  return ref;
}

function validateApiSuccess(status, payload, request) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("UNIFIED_PREREQUISITE_API_RESPONSE_INVALID");
  const expected = ["created", "designDnaSnapshotRef", "mechanismDecision", "opportunity", "projectInputRef"];
  if (JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(expected)) fail("UNIFIED_PREREQUISITE_API_RESPONSE_FIELDS_INVALID");
  if (typeof payload.created !== "boolean" || status !== (payload.created ? 201 : 200)) fail("UNIFIED_PREREQUISITE_API_STATUS_INVALID");
  try {
    validateUnifiedContentOpportunity(payload.opportunity);
    validateContentMechanismDecision(payload.mechanismDecision);
  } catch {
    fail("UNIFIED_PREREQUISITE_API_CONTRACT_INVALID");
  }
  const ref = payload.projectInputRef;
  if (!ref || JSON.stringify(Object.keys(ref).sort()) !== JSON.stringify(["hash", "id"]) || typeof ref.id !== "string" || !/^[a-f0-9]{64}$/.test(ref.hash || "")) fail("UNIFIED_PREREQUISITE_API_PROJECT_INPUT_REF_INVALID");
  if (payload.mechanismDecision.projectInputRef?.id !== ref.id || payload.mechanismDecision.projectInputRef?.hash !== ref.hash) fail("UNIFIED_PREREQUISITE_API_PROJECT_INPUT_REF_MISMATCH");
  validateDesignDnaBinding(payload, request);
  return payload;
}

export function parseUnifiedPrerequisiteCli(args) {
  if (args.length === 4 && args[0] === "--data-dir" && args[1] && args[2] === "--request-file" && args[3]) return { dataDir: args[1], requestFile: args[3] };
  fail("UNIFIED_PREREQUISITE_CLI_ARGUMENTS_FORBIDDEN");
}

export async function runUnifiedPrerequisitePreparation({ dataDir, requestFile }) {
  const isolated = validateIsolatedDataDir(dataDir);
  const request = JSON.parse(readFileSync(resolve(requestFile), "utf8"));
  const localApi = await openIsolatedApiChild(isolated.dataDir);
  try {
    const response = await fetch(`http://127.0.0.1:${localApi.port}/api/v1/unified-content-prerequisites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
    let payload;
    try { payload = await response.json(); } catch { fail("UNIFIED_PREREQUISITE_API_RESPONSE_INVALID"); }
    if (!response.ok) fail(String(payload?.code || "UNIFIED_PREREQUISITE_API_REJECTED").replace(/[^A-Z0-9_:-]/gi, "").slice(0, 100));
    const result = validateApiSuccess(response.status, payload, request);
    return {
      schemaVersion: "1.0",
      mode: "isolated_prerequisite_preparation",
      created: result.created,
      contentOpportunityRef: { id: result.opportunity.id, hash: result.opportunity.opportunityHash },
      mechanismDecisionRef: { id: result.mechanismDecision.id, hash: result.mechanismDecision.decisionHash },
      projectInputRef: result.projectInputRef,
      designDnaSnapshotRef: result.designDnaSnapshotRef,
      apiTransport: "http_loopback",
      apiRoute: "/api/v1/unified-content-prerequisites",
      apiStatus: response.status,
      providerCalls: 0,
      hotspotCalls: 0,
      imageCalls: 0,
      platformCalls: 0,
      externalCalls: 0,
      activityDatabaseWrites: 0,
      localPreparationOnly: true,
      contentGenerated: false,
      platformPublished: false
    };
  } finally { await localApi.close(); }
}

if (process.argv[2] === internalApiArg && typeof process.send === "function") {
  await startChildServer();
}

if (process.argv[2] !== internalApiArg && process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const cli = parseUnifiedPrerequisiteCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(await runUnifiedPrerequisitePreparation(cli), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${String(error?.code || "UNIFIED_PREREQUISITE_PREPARATION_FAILED").replace(/[^A-Z0-9_:-]/gi, "").slice(0, 100)}\n`);
    process.exitCode = 1;
  }
}
