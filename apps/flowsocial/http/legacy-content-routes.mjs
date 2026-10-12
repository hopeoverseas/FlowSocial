import { ensureContentPublications, recordPublication, recordPublicationMetrics, updatePublication } from "../content-agent/publishing-feedback.mjs";
import { confirmContentPromotion, getContentPromotion, listContentPromotions, previewContentPromotion, projectPublicationPromotionReadOnly } from "../content-agent/content-promotion.mjs";
import { getVisualCandidates, projectVisualDirectionCompatibility, visualCandidateSummary } from "../content-agent/xhs-visual-director.mjs";

const DEFAULT_OPERATIONS = Object.freeze({
  ensureContentPublications,
  recordPublication,
  recordPublicationMetrics,
  updatePublication,
  confirmContentPromotion,
  getContentPromotion,
  listContentPromotions,
  previewContentPromotion,
  projectPublicationPromotionReadOnly,
  getVisualCandidates,
  projectVisualDirectionCompatibility,
  visualCandidateSummary
});

function respond(sendJson, res, status, body) {
  sendJson(res, status, body);
  return true;
}

export async function handleLegacyContentRoute({
  req,
  res,
  url,
  path,
  store,
  bodyJson,
  sendJson,
  persistStore,
  resolveFeatureFlags,
  operations = DEFAULT_OPERATIONS
}) {
  const contentTaskMatch = path.match(/^\/content-tasks\/([^/]+)$/);
  if (req.method === "GET" && contentTaskMatch) {
    const task = store.contentTasks.find((item) => item.id === contentTaskMatch[1]);
    if (!task) return respond(sendJson, res, 404, { error: "Content task not found" });
    const view = task.visualDirectionSet || task.visualCandidates
      ? { ...task, visualDirectionSet: task.visualDirectionSet ? { ...task.visualDirectionSet, compatibilityProjection: operations.projectVisualDirectionCompatibility(task) } : null, visualCandidates: operations.getVisualCandidates(task), visualCandidateSummary: task.visualDirectionSet ? operations.visualCandidateSummary(task) : null }
      : task;
    return respond(sendJson, res, 200, view);
  }

  const contentVersionsMatch = path.match(/^\/content-tasks\/([^/]+)\/versions$/);
  if (req.method === "GET" && contentVersionsMatch) {
    const task = store.contentTasks.find((item) => item.id === contentVersionsMatch[1]);
    if (!task) return respond(sendJson, res, 404, { error: "Content task not found" });
    const items = (store.contentVersions || []).filter((item) => item.contentTaskId === task.id).sort((a, b) => b.version - a.version);
    return respond(sendJson, res, 200, { contentTaskId: task.id, currentVersion: task.version, items });
  }

  if (req.method === "POST" && path === "/content-promotions/preview") {
    if (!resolveFeatureFlags().contentPromotionV1) return respond(sendJson, res, 404, { error: "Content promotion is disabled", code: "CONTENT_PROMOTION_DISABLED" });
    try {
      return respond(sendJson, res, 200, operations.previewContentPromotion(store, await bodyJson(req)));
    } catch (error) {
      return respond(sendJson, res, error.statusCode || 400, { error: error.message, code: error.code || "CONTENT_PROMOTION_PREVIEW_REJECTED", details: error.details || null });
    }
  }

  if (req.method === "POST" && path === "/content-promotions/confirm") {
    if (!resolveFeatureFlags().contentPromotionV1) return respond(sendJson, res, 404, { error: "Content promotion is disabled", code: "CONTENT_PROMOTION_DISABLED" });
    try {
      const result = operations.confirmContentPromotion(store, await bodyJson(req));
      if (result.created) await persistStore(store);
      return respond(sendJson, res, result.created ? 201 : 200, result);
    } catch (error) {
      return respond(sendJson, res, error.statusCode || 400, { error: error.message, code: error.code || "CONTENT_PROMOTION_CONFIRM_REJECTED", details: error.details || null });
    }
  }

  if (req.method === "GET" && path === "/content-promotions") {
    return respond(sendJson, res, 200, { items: operations.listContentPromotions(store, { companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId"), contentTaskId: url.searchParams.get("contentTaskId") }) });
  }

  const contentPromotionMatch = path.match(/^\/content-promotions\/([^/]+)$/);
  if (req.method === "GET" && contentPromotionMatch) {
    const promotion = operations.getContentPromotion(store, contentPromotionMatch[1]);
    return promotion
      ? respond(sendJson, res, 200, promotion)
      : respond(sendJson, res, 404, { error: "Content promotion not found", code: "CONTENT_PROMOTION_NOT_FOUND" });
  }

  const contentPublicationsMatch = path.match(/^\/content-tasks\/([^/]+)\/publications$/);
  if (contentPublicationsMatch && req.method === "GET") {
    return respond(sendJson, res, 200, { items: operations.ensureContentPublications(store).filter((item) => item.contentTaskId === contentPublicationsMatch[1]).map(operations.projectPublicationPromotionReadOnly) });
  }
  if (contentPublicationsMatch && req.method === "POST") {
    if (resolveFeatureFlags().atomicPublicationFeedbackUiCutoverV1) return respond(sendJson, res, 409, { error: "Legacy publication writes are disabled by the Atomic UI cutover", code: "ATOMIC_PUBLICATION_UI_CUTOVER_REQUIRED" });
    const task = store.contentTasks.find((item) => item.id === contentPublicationsMatch[1]);
    if (!task) return respond(sendJson, res, 404, { error: "Content task not found" });
    try {
      const publication = operations.recordPublication(store, task, await bodyJson(req));
      await persistStore(store);
      return respond(sendJson, res, 201, publication);
    } catch (error) {
      return respond(sendJson, res, error.statusCode || 400, { error: error.message, code: error.code || "PUBLICATION_REJECTED" });
    }
  }

  const publicationMetricsMatch = path.match(/^\/content-publications\/([^/]+)\/metrics$/);
  if (req.method === "POST" && publicationMetricsMatch) {
    if (resolveFeatureFlags().atomicPublicationFeedbackUiCutoverV1) return respond(sendJson, res, 409, { error: "Legacy publication metrics are disabled by the Atomic UI cutover", code: "ATOMIC_PUBLICATION_UI_CUTOVER_REQUIRED" });
    const publication = operations.ensureContentPublications(store).find((item) => item.id === publicationMetricsMatch[1]);
    if (!publication) return respond(sendJson, res, 404, { error: "Content publication not found" });
    try {
      const snapshot = operations.recordPublicationMetrics(publication, await bodyJson(req));
      await persistStore(store);
      return respond(sendJson, res, 201, { publication, snapshot });
    } catch (error) {
      return respond(sendJson, res, error.statusCode || 400, { error: error.message, code: error.code || "PERFORMANCE_SNAPSHOT_REJECTED", field: error.field || null });
    }
  }

  const publicationMatch = path.match(/^\/content-publications\/([^/]+)$/);
  if (req.method === "PATCH" && publicationMatch) {
    if (resolveFeatureFlags().atomicPublicationFeedbackUiCutoverV1) return respond(sendJson, res, 409, { error: "Legacy publication updates are disabled by the Atomic UI cutover", code: "ATOMIC_PUBLICATION_UI_CUTOVER_REQUIRED" });
    const publication = operations.ensureContentPublications(store).find((item) => item.id === publicationMatch[1]);
    if (!publication) return respond(sendJson, res, 404, { error: "Content publication not found" });
    try {
      const updated = operations.updatePublication(publication, await bodyJson(req));
      await persistStore(store);
      return respond(sendJson, res, 200, updated);
    } catch (error) {
      return respond(sendJson, res, error.statusCode || 400, { error: error.message, code: error.code || "PUBLICATION_UPDATE_REJECTED" });
    }
  }

  return false;
}
