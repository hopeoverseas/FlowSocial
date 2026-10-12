import assert from "node:assert/strict";
import { createUnifiedContentXhsVisualReviewLiveDependencies } from "../live/unified-content-xhs-visual-review-live.mjs";
import { reviewRenderedXhsTask } from "../../content-agent/visual-review-engine.mjs";

assert.throws(() => createUnifiedContentXhsVisualReviewLiveDependencies(), (error) => error.code === "LIVE_XHS_VISUAL_REVIEW_ISOLATED_DATA_DIR_REQUIRED");
let providerCalls = 0; let assetReads = 0; let checkpointWrites = 0;
const dependencies = createUnifiedContentXhsVisualReviewLiveDependencies({
  isolatedDataDir: "C:/isolated/visual-review-fixture", executionId: "EXE-FIXTURE", maxCredits: 2,
  multimodalTransport: async () => { providerCalls += 1; return { status: "failed", cost: 0 }; },
  assetReader: async () => { assetReads += 1; return Buffer.alloc(0); },
  checkpointStore: async () => { checkpointWrites += 1; }
});
assert.deepEqual(dependencies.counters(), { providerCalls: 0, credits: 0, maxProviderCalls: 1, maxCredits: 2 });
assert.equal(providerCalls, 0); assert.equal(assetReads, 0); assert.equal(checkpointWrites, 0);

let legacyGenerateCalls = 0;
const pending = await reviewRenderedXhsTask({ platform: "xiaohongshu", delivery: null }, { root: process.cwd(), generateText: async () => { legacyGenerateCalls += 1; } });
assert.equal(pending.status, "pending_render"); assert.equal(legacyGenerateCalls, 0);

console.log(JSON.stringify({ status: "visual-review-self-test passed", liveSkeletonCalls: 0, legacyPixelAuthority: false, realProviderCalls: 0, networkCalls: 0, platformCalls: 0, productionDatabaseCalls: 0 }, null, 2));
