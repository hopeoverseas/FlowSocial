import { assertContentAgentInput } from "./contracts.mjs";
import { planDirectedContent } from "./directed-planner.mjs";
import { recommendContentTasks } from "./planner.mjs";
import { projectStrategyForContent } from "./strategy-adapter.mjs";
import { attachExecutionContracts } from "./execution-context.mjs";

export function planNextContent(input) {
  assertContentAgentInput(input);
  const strategyContext = projectStrategyForContent(input.strategySnapshot, input.currentFacts || [], input.factSnapshot || null);
  strategyContext.tacticalLearningPack = input.tacticalLearningPack || { schemaVersion: "1.0", actions: [], mode: "account_scoped_reversible" };
  strategyContext.nextCycleContentPortfolio = input.nextCycleContentPortfolio || null;
  const common = {
    strategyContext,
    platform: input.platform || "xiaohongshu",
    history: input.history || [],
    hotspots: input.hotspots || [],
    knowledgeItems: input.knowledgeItems || [],
    viralBlueprints: input.viralBlueprints || [],
    userMaterials: input.userMaterials || input.userRequest?.userMaterials || [],
    contentPortfolio: input.nextCycleContentPortfolio || null,
    requireProductionReadyBlueprints: input.requireProductionReadyBlueprints === true
  };
  const plannedRecommendations = input.userRequest?.topic
    ? [planDirectedContent({ ...common, request: input.userRequest })]
    : recommendContentTasks({
      ...common,
      limit: Math.min(Math.max(Number(input.limit) || 3, 1), 5)
    });
  const recommendations = plannedRecommendations.map((recommendation) => attachExecutionContracts({
    strategyContext,
    recommendation,
    platform: common.platform,
    userRequest: input.userRequest || null,
    knowledgeItems: common.knowledgeItems
  }));
  return {
    schemaVersion: "0.1",
    strategyContext,
    recommendations,
    generatedAt: new Date().toISOString()
  };
}

export { assertContract, createContentIdentity, createContentSourceEvidence, createContentTaskBrief, createGenerationPayload, normalizeFactSnapshot, validateContentIdentityContract, validateContentSourcePlanContract, validateContentTaskBriefContract, validateFactSnapshotContract, validateStrategySnapshotContract } from "./contracts.mjs";
export { evaluateDuplication } from "./deduplicator.mjs";
export { runContentGates } from "./gate-engine.mjs";
export { listSkillAdapters, resolveSkillAdapter, buildExecutionRecord } from "./skill-adapter-registry.mjs";
export { buildRevisionImpactPlan, buildSkillExecutionPlan, buildUnifiedPlatformSkillExecutionPlan, refreshSkillExecutionPlan } from "./skill-execution-plan.mjs";
export { runContentSkill } from "./skill-runner.mjs";
export { rerunRevisionDownstream } from "./revision-rerun-engine.mjs";
export { allowedPatchPrefixes, applyValidatedOperations, applyValidatedPatch } from "./patch-engine.mjs";
export { buildContentHistoryIndex } from "./history-index.mjs";
export { ensureContentPublications, recordPublication, recordPublicationMetrics } from "./publishing-feedback.mjs";
export { buildContentOutcomeReport, buildFeedbackWorkspace, extractPublicationAttribution, normalizePerformanceSnapshot } from "./feedback-engine.mjs";
export { planDirectedContent } from "./directed-planner.mjs";
export { recommendContentTasks } from "./planner.mjs";
export { planContentSources } from "./source-planner.mjs";
export { projectStrategyForContent } from "./strategy-adapter.mjs";
export { attachExecutionContracts, createContentDirectionCard, createContentExecutionContext } from "./execution-context.mjs";
export { projectEditorialDecisionBrief, resolveEditorialDecisionBrief } from "./editorial-decision.mjs";
export { CONTENT_FUNCTIONS, PURPOSE_IDS, PURPOSE_POLICY, contentFunctionForRole, legacyRoleForFunction, purposeForFunction, resolvePurposePolicy, selectConversionStage } from "./content-policy.mjs";
export { createBlueprintVersion, createContentPatternSnapshot, createPatternFingerprint, normalizeViralContentAnalysis } from "./pattern-contracts.mjs";
export { ensureContentPatternLearning, listEligiblePatternBlueprints, recordPatternAnalysisCandidate, reviewPatternAnalysis, snapshotPatternsForPlan, updatePatternBlueprintLifecycle } from "./pattern-library-store.mjs";
export { buildPatternClusters, buildPatternPerformanceDashboard, buildSkillPromotionCandidates, completeReferenceImportJob, createReferenceImportJob, ensureAdvancedContentLearning, normalizeReferenceImportItem, proposeBlueprintUpgrades, reviewBlueprintUpgrade, reviewSkillPromotion } from "./content-learning-engine.mjs";
export { createCaseDrivenEvaluationSuite, evaluateContentSkillOutput, EVALUATED_CONTENT_SKILLS } from "./content-skill-evaluation.mjs";
export { proposeNaturalization } from "./naturalization-engine.mjs";
export { reviewRenderedXhsTask } from "./visual-review-engine.mjs";
export { buildRunTrace, ensureRunLedger, recordRunDecision, updateRunNode, RUN_NODE_DEFINITIONS } from "./run-ledger.mjs";
export { buildSkillConformanceReport } from "./skill-conformance.mjs";
export { buildOrchestrationReadinessReport, simulateContentOrchestration } from "./orchestration-lab.mjs";
export {
  UNIFIED_CONTENT_CONTRACTS,
  UNIFIED_CONTENT_STATES,
  adaptLegacyIsolatedPackageReadOnly,
  adaptLegacySinglePlatformRunReadOnly,
  hashUnifiedContent,
  validateContentMechanismDecision,
  validateContentProject,
  validateLegacyUnifiedContentProjection,
  validatePlatformRunRef,
  validatePromotionRecord,
  validatePromotionRecordSet,
  validateSharedContentMasterRef,
  validateUnifiedContentStateHistory,
  validateUnifiedContentStateTransition,
  validateUserSelection,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";
export { runLegacyCompatibleUnifiedContentOrchestration, runUnifiedContentOrchestration } from "./unified-content-orchestrator.mjs";
export { CONTENT_SET_REVIEW_CONTRACTS, CONTENT_SET_REVIEW_DIMENSIONS, createEditorialSetReview, createUserSelectionGate, reviewContentSet, validateEditorialSetReview, validateUserSelectionGate } from "./content-set-review.mjs";
