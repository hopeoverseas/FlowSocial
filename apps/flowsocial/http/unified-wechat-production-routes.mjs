import { appendUnifiedAtomicWechatMaterialization } from "../content-agent/unified-atomic-multiplatform-product.mjs";
import { executeUnifiedAtomicWechatPreuploadArtifact } from "../content-agent/unified-content-server-adapter.mjs";
import { appendUnifiedWechatRevisionRequest, approveUnifiedWechatPromptCost, executeUnifiedWechatGeneratedImages, executeUnifiedWechatRevision, getUnifiedWechatProductionControlState, initializeUnifiedWechatProductionControl, previewUnifiedWechatPromptCost } from "../content-agent/unified-wechat-production-control.mjs";
import { createWechatGeneratedRasterResolver } from "../content-agent/wechat-generated-raster-runtime.mjs";

const DEFAULT_OPERATIONS = Object.freeze({ materialize: appendUnifiedAtomicWechatMaterialization, executePreuploadArtifact: executeUnifiedAtomicWechatPreuploadArtifact, getProductionControl: getUnifiedWechatProductionControlState, initializeProductionControl: initializeUnifiedWechatProductionControl, appendRevisionRequest: appendUnifiedWechatRevisionRequest, executeRevision: executeUnifiedWechatRevision, executeGeneratedImages: executeUnifiedWechatGeneratedImages, previewPromptCost: previewUnifiedWechatPromptCost, approvePromptCost: approveUnifiedWechatPromptCost, createGeneratedRasterResolver: createWechatGeneratedRasterResolver });
const respond = (sendJson, res, status, body) => { sendJson(res, status, body); return true; };
const failure = (error, code) => ({ status: error?.statusCode || 400, body: { error: error?.message, code: error?.code || code, details: error?.details || null } });

export async function handleUnifiedWechatProductionRoute({ req, res, path, store, bodyJson, sendJson, persistStore, resolveFeatureFlags, serverDependencies, operations = DEFAULT_OPERATIONS }) {
  const materializeMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/wechat\/materialize$/);
  if (materializeMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_ATOMIC_WECHAT_MATERIALIZE_METHOD_NOT_ALLOWED" });
    const flags = resolveFeatureFlags();
    if (!flags.unifiedContentProductionV1 || !flags.unifiedContentAtomicProductV1 || !flags.unifiedContentAtomicWechatProductV1) return respond(sendJson, res, 404, { error: "Atomic WeChat product is disabled", code: "UNIFIED_ATOMIC_WECHAT_PRODUCT_DISABLED" });
    try {
      const input = await bodyJson(req);
      if (input?.project?.id !== materializeMatch[1]) return respond(sendJson, res, 409, { error: "Project identity mismatch", code: "UNIFIED_ATOMIC_WECHAT_PROJECT_IDENTITY_MISMATCH" });
      const result = await operations.materialize(store, input, { generateText: serverDependencies.generateText, liveExecution: serverDependencies.liveExecution === true, featureFlags: flags });
      if (result.created) await serverDependencies.persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) { const result = failure(error, "UNIFIED_ATOMIC_WECHAT_MATERIALIZATION_REJECTED"); return respond(sendJson, res, result.status, result.body); }
  }

  const artifactMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/wechat\/preupload-artifacts$/);
  if (artifactMatch) {
    if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_ATOMIC_WECHAT_ARTIFACT_METHOD_NOT_ALLOWED" });
    const flags = resolveFeatureFlags();
    if (!flags.unifiedContentProductionV1 || !flags.unifiedContentArtifactsV1 || !flags.unifiedContentAtomicProductV1 || !flags.unifiedContentAtomicWechatProductV1 || !flags.unifiedContentAtomicWechatArtifactV1) return respond(sendJson, res, 404, { error: "Atomic WeChat Artifact is disabled", code: "UNIFIED_ATOMIC_WECHAT_ARTIFACT_DISABLED" });
    try {
      const payload = await bodyJson(req);
      const productionControl = operations.getProductionControl(store, { projectId: artifactMatch[1] });
      if (productionControl.initialized && productionControl.preuploadAllowed !== true) return respond(sendJson, res, 409, { error: "Current Prompt/cost approval and completed revisions are required", code: "UNIFIED_PRODUCTION_CONTROL_PREUPLOAD_BLOCKED", blockers: productionControl.lifecycle.blockers, pendingRevisionRequests: productionControl.pendingRevisionRequests });
      const resourceResolvers = { ...serverDependencies.wechatPreuploadResourceResolvers };
      if (productionControl.promptPlan?.prompts?.length && serverDependencies.wechatGeneratedRasterAssetReader) resourceResolvers.generated_raster = operations.createGeneratedRasterResolver({ store, assetReader: serverDependencies.wechatGeneratedRasterAssetReader, projectId: artifactMatch[1], promptPlan: productionControl.promptPlan });
      const result = await operations.executePreuploadArtifact(store, { ...payload, projectId: artifactMatch[1] }, { featureFlags: flags, artifactSink: serverDependencies.wechatPreuploadArtifactSink, resourceResolvers, formatHtml: serverDependencies.wechatPreuploadFormatHtml, qualityGates: serverDependencies.wechatPreuploadQualityGates, wholeArticleQualityGate: serverDependencies.wechatPreuploadWholeArticleQualityGate });
      if (result.created) await serverDependencies.persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) { const result = failure(error, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REJECTED"); return respond(sendJson, res, result.status, result.body); }
  }

  const controlMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/wechat\/production-control\/(state|initialize|revisions|revision-executions|image-executions|prompt-cost-preview|prompt-cost-approval)$/);
  if (controlMatch) {
    const [, projectId, action] = controlMatch;
    try {
      if (action === "state") {
        if (req.method !== "GET") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_PRODUCTION_CONTROL_METHOD_NOT_ALLOWED" });
        return respond(sendJson, res, 200, operations.getProductionControl(store, { projectId }));
      }
      if (req.method !== "POST") return respond(sendJson, res, 405, { error: "Method not allowed", code: "UNIFIED_PRODUCTION_CONTROL_METHOD_NOT_ALLOWED" });
      const payload = { ...(await bodyJson(req)), projectId };
      if (action === "prompt-cost-preview") return respond(sendJson, res, 200, operations.previewPromptCost(store, payload));
      if (action === "image-executions") {
        const result = await operations.executeGeneratedImages(store, payload, { executeGeneratedImages: serverDependencies.wechatGeneratedRasterExecution, persistStore: serverDependencies.persistStore, maxCreditsPerImage: 20 });
        await persistStore(store);
        return respond(sendJson, res, 201, result);
      }
      const result = action === "initialize" ? operations.initializeProductionControl(store, payload) : action === "revisions" ? operations.appendRevisionRequest(store, payload) : action === "revision-executions" ? operations.executeRevision(store, payload) : operations.approvePromptCost(store, payload);
      if (result.created || result.changed) await persistStore(store);
      return respond(sendJson, res, result.created || result.changed ? 201 : 200, result);
    } catch (error) { const result = failure(error, "UNIFIED_PRODUCTION_CONTROL_REJECTED"); return respond(sendJson, res, result.status, result.body); }
  }
  return false;
}
