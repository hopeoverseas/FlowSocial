import { resolve } from "node:path";
import { createXhsOpenAiCompatibleMultimodalTransport } from "../../content-agent/xhs-multimodal-production-adapter.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }

// Fail-closed wiring only. Importing this module performs no I/O and no calls.
export function createUnifiedContentXhsVisualReviewLiveDependencies({ isolatedDataDir, executionId, maxCredits, multimodalTransport, assetReader, checkpointStore } = {}) {
  if (typeof isolatedDataDir !== "string" || !isolatedDataDir.trim()) fail("LIVE_XHS_VISUAL_REVIEW_ISOLATED_DATA_DIR_REQUIRED");
  if (typeof executionId !== "string" || !executionId.trim()) fail("LIVE_XHS_VISUAL_REVIEW_EXECUTION_ID_REQUIRED");
  if (!Number.isFinite(maxCredits) || maxCredits <= 0) fail("LIVE_XHS_VISUAL_REVIEW_CREDITS_REQUIRED");
  if (typeof multimodalTransport !== "function" || typeof assetReader !== "function" || typeof checkpointStore !== "function") fail("LIVE_XHS_VISUAL_REVIEW_DEPENDENCIES_REQUIRED");
  const directory = resolve(isolatedDataDir); let calls = 0; let credits = 0;
  return {
    xhsVisualReviewTransportContext: { mode: "registered_live_multimodal_execution", networked: true, executionId, isolatedDataDir: directory },
    xhsVisualReviewAssetReader: (asset, context) => assetReader(asset, { ...context, executionId, isolatedDataDir: directory }),
    async xhsVisualReviewMultimodalTransport(request, context) {
      if (calls >= 1) fail("LIVE_XHS_VISUAL_REVIEW_CALL_LIMIT_REACHED");
      if (credits >= maxCredits) fail("LIVE_XHS_VISUAL_REVIEW_CREDIT_LIMIT_REACHED");
      calls += 1;
      const result = await multimodalTransport(request, { ...context, executionId, isolatedDataDir: directory });
      if (result?.paidTaskCreated === true && (!Number.isFinite(Number(result.cost)) || result.providerState === "unknown" || result.usageStatus === "unknown")) {
        await checkpointStore({ executionId, isolatedDataDir: directory, status: "unknown_paid_or_provider_state", checkpoint: result.checkpoint || null, providerCalls: calls, credits });
        return result;
      }
      credits += Number(result?.cost || 0);
      await checkpointStore({ executionId, isolatedDataDir: directory, status: "visual_review_call_recorded", checkpoint: result?.checkpoint || null, providerCalls: calls, credits });
      return result;
    },
    counters: () => ({ providerCalls: calls, credits, maxProviderCalls: 1, maxCredits })
  };
}

export function createUnifiedContentXhsOpenAiCompatibleVisualReviewLiveDependencies({ baseUrl, apiKey, model, isolatedDataDir, executionId, maxCredits, cost, fetchImpl, assetReader, checkpointStore } = {}) {
  const multimodalTransport = createXhsOpenAiCompatibleMultimodalTransport({ baseUrl, apiKey, model, cost, fetchImpl });
  return createUnifiedContentXhsVisualReviewLiveDependencies({ isolatedDataDir, executionId, maxCredits, multimodalTransport, assetReader, checkpointStore });
}
