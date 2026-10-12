import assert from "node:assert/strict";
import { handleUnifiedXhsPreparationRoute } from "../../http/unified-xhs-preparation-routes.mjs";

const enabledFlags = Object.freeze({
  unifiedContentProductionV1: true,
  unifiedContentArtifactsV1: true,
  unifiedContentXhsProviderPlanV1: true
});

function harness({ method = "GET", pathname, search = "", flags = enabledFlags, payload = {}, operations = {} }) {
  const responses = [];
  const persisted = [];
  const calls = [];
  const defaults = {
    getProductionState: (_store, scope, options) => { calls.push({ operation: "state", scope, options }); return { id: "state:1" }; },
    executeDesignStage: (_store, input, options) => { calls.push({ operation: "design", input, options }); return { created: true, id: "design:1" }; },
    appendProviderPlan: (_store, input, options) => { calls.push({ operation: "plan", input, options }); return { created: true, id: "plan:1" }; },
    appendProviderExecutionApproval: (_store, input, options) => { calls.push({ operation: "approval", input, options }); return { created: true, id: "approval:1" }; }
  };
  const url = new URL(`http://localhost${pathname}${search}`);
  const args = {
    req: { method }, res: {}, url, path: pathname, store: { id: "store:1" },
    bodyJson: async () => structuredClone(payload),
    sendJson: (_res, status, body) => responses.push({ status, body }),
    persistStore: async (store) => persisted.push(store),
    resolveFeatureFlags: () => flags,
    runtimeReadiness: () => ({ providerExecution: { ready: true } }),
    operations: { ...defaults, ...operations }
  };
  return { args, responses, persisted, calls };
}

{
  const test = harness({ pathname: "/not-an-xhs-route" });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), false);
  assert.deepEqual(test.responses, []);
}

{
  const test = harness({ pathname: "/unified-content-projects/project%201/platforms/xiaohongshu/production-state", search: "?workspaceId=w1&candidateId=c1" });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), true);
  assert.equal(test.responses[0].status, 200);
  assert.deepEqual(test.calls[0].scope, { projectId: "project%201", platform: "xiaohongshu", workspaceId: "w1", companyId: undefined, accountId: undefined, candidateId: "c1", productSnapshotHash: undefined });
  assert.deepEqual(test.responses[0].body.runtimeReadiness, { providerExecution: { ready: true } });
}

{
  const test = harness({ method: "POST", pathname: "/unified-content-projects/p1/platforms/xiaohongshu/design", payload: { candidateId: "c1" } });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), true);
  assert.deepEqual(test.calls[0].input, { candidateId: "c1", projectId: "p1" });
  assert.equal(test.responses[0].status, 201);
  assert.equal(test.persisted.length, 1);
}

{
  let called = false;
  const test = harness({ method: "POST", pathname: "/unified-content-projects/p1/platforms/xiaohongshu/design", flags: { ...enabledFlags, unifiedContentArtifactsV1: false }, operations: { executeDesignStage: () => { called = true; } } });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), true);
  assert.equal(called, false);
  assert.deepEqual(test.responses[0], { status: 404, body: { error: "Unified content artifacts are disabled", code: "UNIFIED_CONTENT_ARTIFACTS_DISABLED" } });
}

{
  const test = harness({ method: "POST", pathname: "/unified-content-projects/p2/platforms/xiaohongshu/provider-plan", payload: { designId: "d1" } });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), true);
  assert.equal(test.calls[0].operation, "plan");
  assert.equal(test.responses[0].status, 201);
  assert.equal(test.persisted.length, 1);
}

{
  const failure = Object.assign(new Error("approval rejected"), { code: "APPROVAL_REJECTED", statusCode: 409, details: ["approval"] });
  const test = harness({ method: "POST", pathname: "/unified-content-projects/p3/platforms/xiaohongshu/provider-execution-approval", operations: { appendProviderExecutionApproval: () => { throw failure; } } });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), true);
  assert.deepEqual(test.responses[0], { status: 409, body: { error: "approval rejected", code: "APPROVAL_REJECTED", details: ["approval"] } });
  assert.equal(test.persisted.length, 0);
}

for (const [pathname, code] of [
  ["/unified-content-projects/p1/platforms/xiaohongshu/production-state", "UNIFIED_XHS_PRODUCTION_STATE_METHOD_NOT_ALLOWED"],
  ["/unified-content-projects/p1/platforms/xiaohongshu/design", "UNIFIED_XHS_DESIGN_METHOD_NOT_ALLOWED"],
  ["/unified-content-projects/p1/platforms/xiaohongshu/provider-plan", "UNIFIED_XHS_PROVIDER_PLAN_METHOD_NOT_ALLOWED"],
  ["/unified-content-projects/p1/platforms/xiaohongshu/provider-execution-approval", "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_METHOD_NOT_ALLOWED"]
]) {
  const expectedMethod = pathname.endsWith("production-state") ? "POST" : "GET";
  const test = harness({ method: expectedMethod, pathname });
  assert.equal(await handleUnifiedXhsPreparationRoute(test.args), true);
  assert.equal(test.responses[0].status, 405);
  assert.equal(test.responses[0].body.code, code);
}

console.log("unified-xhs-preparation-routes-self-test: ok");
