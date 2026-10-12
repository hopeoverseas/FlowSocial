import { resolve } from "node:path";
import { createXhsFileByteSink, createXhsKieProviderTransport } from "../../content-agent/xhs-kie-production-adapter.mjs";

function fail(code, message = code) {
  throw Object.assign(new Error(message), { code });
}

// This adapter intentionally owns no provider SDK and performs no work at import
// time. A Controller-run Live Execution must inject both paid transport and
// durable staging implementations after registering its isolated directory.
export function createUnifiedContentXhsProviderLiveDependencies({
  isolatedDataDir,
  maxProviderCalls,
  maxCredits,
  providerTransport,
  stageBytes,
  checkpointStore,
  executionId
} = {}) {
  if (typeof isolatedDataDir !== "string" || !isolatedDataDir.trim()) fail("LIVE_XHS_PROVIDER_ISOLATED_DATA_DIR_REQUIRED");
  if (!Number.isInteger(maxProviderCalls) || maxProviderCalls < 1) fail("LIVE_XHS_PROVIDER_CALL_LIMIT_REQUIRED");
  if (!Number.isFinite(maxCredits) || maxCredits <= 0) fail("LIVE_XHS_PROVIDER_CREDIT_LIMIT_REQUIRED");
  if (typeof providerTransport !== "function" || typeof stageBytes !== "function" || typeof checkpointStore !== "function") fail("LIVE_XHS_PROVIDER_DEPENDENCIES_REQUIRED");
  if (typeof executionId !== "string" || !executionId.trim()) fail("LIVE_XHS_PROVIDER_EXECUTION_ID_REQUIRED");
  const dataDir = resolve(isolatedDataDir);
  let calls = 0;
  let credits = 0;
  return {
    transportContext: { mode: "registered_live_execution", networked: true, executionId, isolatedDataDir: dataDir },
    async xhsProviderTransport(request, context) {
      if (calls >= maxProviderCalls) fail("LIVE_XHS_PROVIDER_CALL_LIMIT_REACHED");
      if (credits >= maxCredits) fail("LIVE_XHS_PROVIDER_CREDIT_LIMIT_REACHED");
      const response = await providerTransport(request, { ...context, executionId, isolatedDataDir: dataDir });
      calls += 1;
      if (response?.paidTaskCreated === true && !Number.isFinite(Number(response.cost))) {
        await checkpointStore({ executionId, isolatedDataDir: dataDir, status: "unknown_paid_task_cost", checkpoint: response.checkpoint || null, calls, credits });
        fail("LIVE_XHS_PROVIDER_UNKNOWN_PAID_TASK_COST");
      }
      credits += Number(response?.cost || 0);
      await checkpointStore({ executionId, isolatedDataDir: dataDir, status: "provider_call_recorded", checkpoint: response?.checkpoint || null, calls, credits });
      return response;
    },
    async xhsProviderByteSink(payloads, context) {
      return stageBytes(payloads, { ...context, executionId, isolatedDataDir: dataDir });
    },
    counters() { return { providerCalls: calls, credits, maxProviderCalls, maxCredits }; }
  };
}

export function createUnifiedContentXhsKieLiveDependencies({ baseUrl, apiKey, isolatedDataDir, maxProviderCalls, maxCredits, checkpointStore, executionId, fetchImpl, maxPolls, pollIntervalMs } = {}) {
  const providerTransport = createXhsKieProviderTransport({ baseUrl, apiKey, fetchImpl, maxPolls, pollIntervalMs });
  const stageBytes = createXhsFileByteSink({ isolatedDataDir });
  return createUnifiedContentXhsProviderLiveDependencies({ isolatedDataDir, maxProviderCalls, maxCredits, providerTransport, stageBytes, checkpointStore, executionId });
}
