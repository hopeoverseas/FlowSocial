import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleLegacyContentRoute } from "../../http/legacy-content-routes.mjs";
import { handleSystemRoute } from "../../http/system-routes.mjs";

function capture() {
  const calls = [];
  return { res: {}, calls, sendJson(_res, status, body) { calls.push({ status, body }); } };
}

const healthCapture = capture();
const healthHandled = await handleSystemRoute({
  req: { method: "GET" }, res: healthCapture.res, path: "/health",
  store: { accounts: [{ id: "account_1" }], contentDirections: [], contentTasks: [], unifiedContentPlanningAttemptReceipts: [{}] },
  sendJson: healthCapture.sendJson,
  runtime: {
    sourceSignature: async () => "build-1", loadedBuildId: "build-1", processId: 123,
    serverStartedAt: "2026-08-28T00:00:00.000Z", productMode: "test",
    getStorageStatus: () => ({ mode: "memory" }), providerStatus: () => ({ configured: false }),
    getSkillRuntimeStatus: () => ({ ready: true }), resolveFeatureFlags: () => ({ unifiedContentProductionV1: true }),
    buildProductCapabilityPolicyReport: (flags) => ({ flags }), xhsRuntimeReadiness: () => ({ ready: true }),
    unifiedContentReadiness: () => ({ ready: true }), now: () => "2026-08-28T01:00:00.000Z"
  }
});
assert.equal(healthHandled, true);
assert.equal(healthCapture.calls[0].status, 200);
assert.equal(healthCapture.calls[0].body.restartRequired, false);
assert.equal(healthCapture.calls[0].body.workspaceData.status, "ready");
assert.equal(healthCapture.calls[0].body.workspaceData.counts.planningAttempts, 1);
assert.equal(healthCapture.calls[0].body.serverTime, "2026-08-28T01:00:00.000Z");

const notHandledCapture = capture();
assert.equal(await handleSystemRoute({ req: { method: "GET" }, res: {}, path: "/other", store: {}, sendJson: notHandledCapture.sendJson, runtime: {} }), false);
assert.equal(notHandledCapture.calls.length, 0);

const baseStore = { contentTasks: [{ id: "task_1", version: 2 }], contentVersions: [{ contentTaskId: "task_1", version: 1 }, { contentTaskId: "task_1", version: 2 }] };
const taskCapture = capture();
assert.equal(await handleLegacyContentRoute({
  req: { method: "GET" }, res: taskCapture.res, url: new URL("http://localhost/content-tasks/task_1"), path: "/content-tasks/task_1",
  store: baseStore, bodyJson: async () => ({}), sendJson: taskCapture.sendJson, persistStore: async () => {}, resolveFeatureFlags: () => ({})
}), true);
assert.deepEqual(taskCapture.calls[0], { status: 200, body: baseStore.contentTasks[0] });

let persistCount = 0;
const cutoverCapture = capture();
assert.equal(await handleLegacyContentRoute({
  req: { method: "POST" }, res: cutoverCapture.res, url: new URL("http://localhost/content-tasks/task_1/publications"), path: "/content-tasks/task_1/publications",
  store: baseStore, bodyJson: async () => ({ status: "published" }), sendJson: cutoverCapture.sendJson,
  persistStore: async () => { persistCount += 1; }, resolveFeatureFlags: () => ({ atomicPublicationFeedbackUiCutoverV1: true })
}), true);
assert.equal(cutoverCapture.calls[0].status, 409);
assert.equal(cutoverCapture.calls[0].body.code, "ATOMIC_PUBLICATION_UI_CUTOVER_REQUIRED");
assert.equal(persistCount, 0);

const disabledCapture = capture();
assert.equal(await handleLegacyContentRoute({
  req: { method: "POST" }, res: disabledCapture.res, url: new URL("http://localhost/content-promotions/confirm"), path: "/content-promotions/confirm",
  store: baseStore, bodyJson: async () => ({}), sendJson: disabledCapture.sendJson,
  persistStore: async () => { persistCount += 1; }, resolveFeatureFlags: () => ({ contentPromotionV1: false })
}), true);
assert.equal(disabledCapture.calls[0].status, 404);
assert.equal(disabledCapture.calls[0].body.code, "CONTENT_PROMOTION_DISABLED");
assert.equal(persistCount, 0);

const confirmCapture = capture();
assert.equal(await handleLegacyContentRoute({
  req: { method: "POST" }, res: confirmCapture.res, url: new URL("http://localhost/content-promotions/confirm"), path: "/content-promotions/confirm",
  store: baseStore, bodyJson: async () => ({ previewToken: "token" }), sendJson: confirmCapture.sendJson,
  persistStore: async () => { persistCount += 1; }, resolveFeatureFlags: () => ({ contentPromotionV1: true }),
  operations: { confirmContentPromotion: () => ({ created: true, promotion: { id: "promotion_1" } }) }
}), true);
assert.equal(confirmCapture.calls[0].status, 201);
assert.equal(persistCount, 1);

const unknownCapture = capture();
assert.equal(await handleLegacyContentRoute({
  req: { method: "GET" }, res: unknownCapture.res, url: new URL("http://localhost/other"), path: "/other",
  store: baseStore, bodyJson: async () => ({}), sendJson: unknownCapture.sendJson, persistStore: async () => {}, resolveFeatureFlags: () => ({})
}), false);
assert.equal(unknownCapture.calls.length, 0);

const server = await readFile(new URL("../../server.mjs", import.meta.url), "utf8");
assert.match(server, /handleSystemRoute\(/);
assert.match(server, /handleLegacyContentRoute\(/);
assert.doesNotMatch(server, /Legacy publication writes are disabled by the Atomic UI cutover/);

console.log("phase5-server-domain-routes-self-test: ok");
