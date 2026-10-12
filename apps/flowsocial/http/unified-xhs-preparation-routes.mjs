import { executeUnifiedContentXhsDesignStage } from "../content-agent/unified-content-xhs-design-stage.mjs";
import { appendUnifiedContentXhsProviderPlan } from "../content-agent/unified-content-xhs-provider-plan-store.mjs";
import { appendUnifiedContentXhsProviderExecutionApproval } from "../content-agent/unified-content-xhs-provider-execution.mjs";
import { getUnifiedContentXhsProductionState } from "../content-agent/unified-content-xhs-production-state.mjs";

const DEFAULT_OPERATIONS = Object.freeze({
  executeDesignStage: executeUnifiedContentXhsDesignStage,
  appendProviderPlan: appendUnifiedContentXhsProviderPlan,
  appendProviderExecutionApproval: appendUnifiedContentXhsProviderExecutionApproval,
  getProductionState: getUnifiedContentXhsProductionState
});

function respond(sendJson, res, status, body) {
  sendJson(res, status, body);
  return true;
}

function rejected(error, fallbackCode) {
  return {
    status: error?.statusCode || 400,
    body: { error: error?.message, code: error?.code || fallbackCode, details: error?.details || null }
  };
}

export async function handleUnifiedXhsPreparationRoute({
  req,
  res,
  url,
  path,
  store,
  bodyJson,
  sendJson,
  persistStore,
  resolveFeatureFlags,
  runtimeReadiness,
  operations = DEFAULT_OPERATIONS
}) {
  const designMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/design$/);
  const productionStateMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/production-state$/);
  if (productionStateMatch) {
    if (req.method !== "GET") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_PRODUCTION_STATE_METHOD_NOT_ALLOWED" });
    try {
      const flags = resolveFeatureFlags();
      const scoped = {
        projectId: productionStateMatch[1],
        platform: "xiaohongshu",
        workspaceId: url.searchParams.get("workspaceId") || undefined,
        companyId: url.searchParams.get("companyId") || undefined,
        accountId: url.searchParams.get("accountId") || undefined,
        candidateId: url.searchParams.get("candidateId") || undefined,
        productSnapshotHash: url.searchParams.get("productSnapshotHash") || undefined
      };
      const state = operations.getProductionState(store, scoped, { featureFlags: flags });
      state.runtimeReadiness = runtimeReadiness();
      return respond(sendJson, res, 200, state);
    } catch (error) {
      const result = rejected(error, "UNIFIED_XHS_PRODUCTION_STATE_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  if (designMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_DESIGN_METHOD_NOT_ALLOWED" });
    const flags = resolveFeatureFlags();
    if (!flags.unifiedContentProductionV1 || !flags.unifiedContentArtifactsV1) return respond(sendJson, res, 404, { error: "Unified content artifacts are disabled", code: "UNIFIED_CONTENT_ARTIFACTS_DISABLED" });
    try {
      const result = operations.executeDesignStage(store, { ...(await bodyJson(req)), projectId: designMatch[1] }, { featureFlags: flags });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      const result = rejected(error, "UNIFIED_XHS_DESIGN_STAGE_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const providerPlanMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/provider-plan$/);
  if (providerPlanMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_PROVIDER_PLAN_METHOD_NOT_ALLOWED" });
    const flags = resolveFeatureFlags();
    if (!flags.unifiedContentXhsProviderPlanV1) return respond(sendJson, res, 404, { error: "XHS Provider plan is disabled", code: "UNIFIED_XHS_PROVIDER_PLAN_DISABLED" });
    try {
      const result = operations.appendProviderPlan(store, { ...(await bodyJson(req)), projectId: providerPlanMatch[1] }, { featureFlags: flags });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      const result = rejected(error, "UNIFIED_XHS_PROVIDER_PLAN_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const providerApprovalMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/provider-execution-approval$/);
  if (providerApprovalMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_METHOD_NOT_ALLOWED" });
    try {
      const result = operations.appendProviderExecutionApproval(store, { ...(await bodyJson(req)), projectId: providerApprovalMatch[1] }, { featureFlags: resolveFeatureFlags() });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      const result = rejected(error, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  return false;
}
