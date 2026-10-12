import { planNextContent } from "./index.mjs";
import { normalizeViralBlueprint } from "./library-contracts.mjs";
import { listEligiblePatternBlueprints, snapshotPatternsForPlan } from "./pattern-library-store.mjs";
import { patternVisibleToScope } from "./pattern-contracts.mjs";
import { buildTacticalLearningPack } from "./feedback-review-engine.mjs";
import { buildFeedbackWorkspace } from "./feedback-engine.mjs";
import { buildContentHistoryIndex } from "./history-index.mjs";
import { buildNextCycleContentPortfolio } from "./next-cycle-content-portfolio.mjs";
import { buildStrategyAdjustmentWorkspace } from "./strategy-feedback-cycle.mjs";

function blueprintsFromStore(store) {
  if ((store.viralBlueprintLibrary || []).length) return store.viralBlueprintLibrary;
  return (store.referenceAnalyses || [])
    .map((analysis) => {
      const blueprint = analysis.blueprint || analysis.styleBlueprint || analysis.analysis?.blueprint;
      if (!blueprint) return null;
      return normalizeViralBlueprint({
        id: blueprint.id || `blueprint_${analysis.id}`,
        ...blueprint,
        sourceReferenceIds: [analysis.referencePostId || analysis.id]
      });
    })
    .filter(Boolean);
}

export function planContentFromWorkspace({
  payload,
  store,
  activeStrategySnapshot,
  currentFacts,
  factSnapshot = null,
  knowledgeItems = [],
  ownershipContext = null,
  viralLearningEnabled = false
}) {
  const strategySnapshot = payload.inputMode === "mock"
    ? payload.strategySnapshot
    : activeStrategySnapshot;
  if (!strategySnapshot) {
    const error = new Error("Active strategy snapshot not found; use inputMode=mock while the strategy agent is still being developed");
    error.statusCode = 409;
    throw error;
  }
  const strategyDocument = strategySnapshot.document || strategySnapshot.payload || strategySnapshot;
  if (payload.inputMode !== "mock" && strategyDocument?.schemaVersion !== "2.0") {
    const error = new Error("当前公司仍在使用旧版只读策略，请先回到策略 Agent 重新生成并激活新版策略，再进行内容规划");
    error.statusCode = 409;
    error.code = "LEGACY_STRATEGY_REQUIRES_UPGRADE";
    throw error;
  }
  const companyId = ownershipContext?.companyId || strategySnapshot.companyId || strategySnapshot.accountId || strategySnapshot.payload?.companyId || strategySnapshot.payload?.accountId;
  const socialAccountId = ownershipContext?.socialAccountId || strategySnapshot.socialAccountId || payload.socialAccountId || null;
  const runtimeFlags = payload.featureFlags || {};
  const historyIndex = buildContentHistoryIndex(store, { accountId: socialAccountId, companyId, socialAccountId, featureFlags: runtimeFlags });
  const history = historyIndex.items;
  const feedbackWorkspace = buildFeedbackWorkspace(store, { accountId: socialAccountId, companyId, socialAccountId, featureFlags: runtimeFlags });
  const strategyAdjustmentWorkspace = buildStrategyAdjustmentWorkspace(store, feedbackWorkspace, { companyId, socialAccountId });
  const tacticalLearningPack = buildTacticalLearningPack(store, { accountId: socialAccountId, platform: payload.platform || "xiaohongshu" });
  const nextCycleContentPortfolio = runtimeFlags.dataDrivenNextCycleV1 === true
    ? buildNextCycleContentPortfolio({ feedbackWorkspace, historyIndex, strategyAdjustmentWorkspace, tacticalLearningPack, companyId, socialAccountId, platform: payload.platform || "xiaohongshu", activeStrategySnapshotId: strategySnapshot.id || null, itemCount: payload.limit || 3, publishingCyclePlans: store.publishingCyclePlans || [] })
    : null;
  const hotspots = (store.hotspotLibrary || []).filter((item) =>
    (!companyId || !item.companyId || item.companyId === companyId)
    && (!strategySnapshot.id || !item.strategySnapshotId || item.strategySnapshotId === strategySnapshot.id)
  );

  const viralBlueprints = viralLearningEnabled
    ? listEligiblePatternBlueprints(store, { scope: ownershipContext, platform: payload.platform || "xiaohongshu" })
    : blueprintsFromStore(store);
  const skillPatternPacks = viralLearningEnabled
    ? (store.contentSkillPatternPacks || []).filter((item) => item.status === "active" && patternVisibleToScope(item, ownershipContext) && (!item.rules?.platform || item.rules.platform === payload.platform))
    : [];
  const result = planNextContent({
    strategySnapshot,
    currentFacts: payload.inputMode === "mock" ? payload.currentFacts || [] : currentFacts,
    factSnapshot: payload.inputMode === "mock" ? payload.factSnapshot || null : factSnapshot,
    platform: payload.platform || "xiaohongshu",
    history,
    hotspots,
    knowledgeItems,
    viralBlueprints,
    requireProductionReadyBlueprints: viralLearningEnabled,
    userMaterials: payload.userMaterials || payload.userRequest?.userMaterials || [],
    userRequest: payload.userRequest || null,
    tacticalLearningPack,
    nextCycleContentPortfolio,
    limit: payload.limit || 3
  });
  if (viralLearningEnabled) {
    result.recommendations = result.recommendations.map((recommendation) => {
      const blueprintIds = (recommendation.sourcePlan?.sources || [])
        .filter((source) => source.type === "viral_blueprint")
        .flatMap((source) => source.candidateIds || []);
      if (!blueprintIds.length) return skillPatternPacks.length ? { ...recommendation, generationPayload: { ...recommendation.generationPayload, contentSkillPatternPacks: skillPatternPacks } } : recommendation;
      const snapshot = snapshotPatternsForPlan(store, { scope: ownershipContext, blueprintIds });
      const contentExecutionContext = { ...recommendation.contentExecutionContext, contentPatternSnapshotId: snapshot.id };
      return {
        ...recommendation,
        contentPatternSnapshot: snapshot,
        contentExecutionContext,
        generationPayload: {
          ...recommendation.generationPayload,
          contentPatternSnapshotId: snapshot.id,
          contentPatternSnapshot: snapshot,
          contentSkillPatternPacks: skillPatternPacks,
          contentExecutionContext
        }
      };
    });
  }
  return {
    inputMode: payload.inputMode === "mock" ? "mock" : "active_strategy",
    strategySnapshotId: strategySnapshot.id || strategySnapshot.strategySnapshotId || null,
    strategySnapshotVersion: strategySnapshot.version || null,
    effectiveStrategyId: strategySnapshot.effectiveStrategyId || null,
    strategyResolution: strategySnapshot.resolution || null,
    viralLearning: { enabled: viralLearningEnabled, eligibleBlueprintCount: viralBlueprints.length, activeSkillPatternPackCount: skillPatternPacks.length },
    nextCycleContentPortfolio,
    ...result
  };
}
