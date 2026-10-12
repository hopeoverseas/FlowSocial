import { executeUnifiedContentXhsProviderExecution } from "../content-agent/unified-content-xhs-provider-execution.mjs";
import {
  approveUnifiedContentXhsLightRevision,
  classifyXhsLightEditMode,
  continueUnifiedContentXhsLightRevision,
  createUnifiedContentXhsLightRevisionPlan,
  getUnifiedContentXhsLightRevisionState,
  submitUnifiedContentXhsLightRevision
} from "../content-agent/unified-content-xhs-light-revision.mjs";

const DEFAULT_OPERATIONS = Object.freeze({
  executeProvider: executeUnifiedContentXhsProviderExecution,
  getLightState: getUnifiedContentXhsLightRevisionState,
  createLightPlan: createUnifiedContentXhsLightRevisionPlan,
  approveLightPlan: approveUnifiedContentXhsLightRevision,
  continueLightExecution: continueUnifiedContentXhsLightRevision,
  submitLightExecution: submitUnifiedContentXhsLightRevision,
  classifyLightEditMode: classifyXhsLightEditMode
});

function respond(sendJson, res, status, body) { sendJson(res, status, body); return true; }
function failure(error, fallbackCode) {
  return { status: error?.statusCode || 400, body: { error: error?.message, code: error?.code || fallbackCode, details: error?.details || null } };
}
function transportContext(dependencies) { return dependencies.xhsProviderTransportContext || { mode: "unconfigured", networked: false }; }

export async function handleUnifiedXhsExecutionRoute({
  req, res, url, path, store, bodyJson, sendJson, persistStore,
  resolveFeatureFlags, runtimeReadiness, serverDependencies,
  generateAssistantText, unwrapAssistantData, operations = DEFAULT_OPERATIONS
}) {
  const providerExecutionMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/provider-executions$/);
  if (providerExecutionMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_PROVIDER_EXECUTION_METHOD_NOT_ALLOWED" });
    const flags = resolveFeatureFlags();
    if (!flags.unifiedContentXhsProviderExecutionV1) return respond(sendJson, res, 404, { error: "XHS provider execution is disabled", code: "UNIFIED_XHS_PROVIDER_EXECUTION_DISABLED" });
    try {
      const result = await operations.executeProvider(store, { ...(await bodyJson(req)), projectId: providerExecutionMatch[1] }, {
        featureFlags: flags,
        transport: serverDependencies.xhsProviderTransport,
        byteSink: serverDependencies.xhsProviderByteSink,
        transportContext: transportContext(serverDependencies)
      });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      const result = failure(error, "UNIFIED_XHS_PROVIDER_EXECUTION_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const lightStateMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/light-revision-state$/);
  if (lightStateMatch) {
    if (req.method !== "GET") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_LIGHT_STATE_METHOD_NOT_ALLOWED" });
    try {
      const scoped = {
        projectId: lightStateMatch[1], platform: "xiaohongshu",
        workspaceId: url.searchParams.get("workspaceId") || undefined,
        companyId: url.searchParams.get("companyId") || undefined,
        accountId: url.searchParams.get("accountId") || undefined,
        candidateId: url.searchParams.get("candidateId") || undefined,
        productSnapshotHash: url.searchParams.get("productSnapshotHash") || undefined,
        providerPlanFactRef: { id: url.searchParams.get("providerPlanFactId"), hash: url.searchParams.get("providerPlanFactHash") }
      };
      const state = operations.getLightState(store, scoped, { featureFlags: resolveFeatureFlags() });
      state.runtimeReadiness = runtimeReadiness().lightRevision;
      return respond(sendJson, res, 200, state);
    } catch (error) {
      const result = failure(error, "UNIFIED_XHS_LIGHT_STATE_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const lightPlanMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/light-revision-plans$/);
  if (lightPlanMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_LIGHT_PLAN_METHOD_NOT_ALLOWED" });
    try {
      const payload = await bodyJson(req);
      const fallback = { editMode: operations.classifyLightEditMode(payload.instruction), summary: "按人工指令生成单页后继版本", compiledPrompt: null };
      const generated = await generateAssistantText({
        task: "compile_xhs_light_revision", contract: "XhsLightRevisionAssistantResult@1.0",
        targetPageId: payload.targetPageId, instruction: payload.instruction,
        rules: ["只允许 image_edit 或 regenerate", "文字、标题、排版或位置变化必须使用 regenerate", "纯视觉变化可使用 image_edit", "不得增加多模态视觉审阅", "compiledPrompt 必须保持用户未要求变更的文字和结构"],
        outputSchema: { editMode: "image_edit", summary: "", compiledPrompt: "" }
      }, fallback);
      const result = operations.createLightPlan(store, { ...payload, projectId: lightPlanMatch[1] }, { featureFlags: resolveFeatureFlags(), assistant: unwrapAssistantData(generated) });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      const result = failure(error, "UNIFIED_XHS_LIGHT_PLAN_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const lightApprovalMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/light-revision-approvals$/);
  if (lightApprovalMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_LIGHT_APPROVAL_METHOD_NOT_ALLOWED" });
    try {
      const result = operations.approveLightPlan(store, { ...(await bodyJson(req)), projectId: lightApprovalMatch[1] }, { featureFlags: resolveFeatureFlags() });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      const result = failure(error, "UNIFIED_XHS_LIGHT_APPROVAL_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const lightContinueMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/light-revision-executions\/([^/]+)\/continue$/);
  if (lightContinueMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_LIGHT_CONTINUE_METHOD_NOT_ALLOWED" });
    const readiness = runtimeReadiness().lightRevision;
    if (!readiness.ready) return respond(sendJson, res, 503, { error: "XHS light revision runtime is not configured", code: "UNIFIED_XHS_LIGHT_RUNTIME_NOT_READY", readiness });
    try {
      const result = await operations.continueLightExecution(store, { ...(await bodyJson(req)), projectId: lightContinueMatch[1], executionId: decodeURIComponent(lightContinueMatch[2]) }, {
        featureFlags: resolveFeatureFlags(), transport: serverDependencies.xhsProviderTransport, assetWriter: serverDependencies.xhsAssetWriter,
        transportContext: transportContext(serverDependencies)
      });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.status === "processing" ? 202 : result.created ? 201 : 200, result);
    } catch (error) {
      const result = failure(error, "UNIFIED_XHS_LIGHT_CONTINUE_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  const lightExecutionMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/light-revision-executions$/);
  if (lightExecutionMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_LIGHT_EXECUTION_METHOD_NOT_ALLOWED" });
    const readiness = runtimeReadiness().lightRevision;
    if (!readiness.ready) return respond(sendJson, res, 503, { error: "XHS light revision runtime is not configured", code: "UNIFIED_XHS_LIGHT_RUNTIME_NOT_READY", readiness });
    try {
      const result = await operations.submitLightExecution(store, { ...(await bodyJson(req)), projectId: lightExecutionMatch[1] }, {
        featureFlags: resolveFeatureFlags(), transport: serverDependencies.xhsProviderTransport,
        referenceUploader: serverDependencies.xhsReferenceUploadTransport, assetReader: serverDependencies.xhsAssetReader,
        transportContext: transportContext(serverDependencies)
      });
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.status === "processing" ? 202 : result.created ? 201 : 200, result);
    } catch (error) {
      const result = failure(error, "UNIFIED_XHS_LIGHT_EXECUTION_REJECTED");
      return respond(sendJson, res, result.status, result.body);
    }
  }

  return false;
}
