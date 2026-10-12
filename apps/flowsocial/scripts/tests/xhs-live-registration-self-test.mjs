import assert from "node:assert/strict";

process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
const { registerUnifiedContentServerDependenciesForLive } = await import("../../server.mjs");

assert.throws(() => registerUnifiedContentServerDependenciesForLive(), /live dependency registration is disabled/i);
process.env.FLOWSOCIAL_LIVE_EXECUTION = "1";
assert.throws(() => registerUnifiedContentServerDependenciesForLive({}, { executionId: "EXE", isolatedDataDir: "C:/isolated" }), /LIVE_XHS_DEPENDENCIES_REQUIRED/);

const readiness = registerUnifiedContentServerDependenciesForLive({
  xhsProviderTransport: async () => ({ status: "succeeded", provider: "fixture", model: "fixture", taskId: "task", cost: 0, bytes: Buffer.from([]) }),
  xhsProviderByteSink: async () => ({ status: "staged_and_hash_verified", receipts: [] }),
  xhsVisualReviewProviderAuthority: { provider: "fixture", model: "fixture", capability: "multimodal" },
  xhsVisualReviewAssetReader: async () => Buffer.alloc(0),
  xhsVisualReviewMultimodalTransport: async () => ({ status: "succeeded", provider: "fixture", model: "fixture", cost: 0, output: {} }),
  xhsProviderTransportContext: { mode: "fixture", networked: true, executionId: "EXE" },
  xhsVisualReviewTransportContext: { mode: "fixture", networked: true, executionId: "EXE" }
}, { executionId: "EXE", isolatedDataDir: "C:/isolated" });

assert.equal(readiness.providerExecution.ready, true);
assert.equal(readiness.visualReview.ready, true);
assert.equal(readiness.finalDelivery.ready, true);
console.log(JSON.stringify({ status: "xhs-live-registration-self-test passed", externalCalls: 0, platformCalls: 0 }, null, 2));
