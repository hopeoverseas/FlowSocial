import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { servePublicStaticAsset } from "./http/static-assets.mjs";
import { createHash, randomUUID } from "node:crypto";
import Busboy from "busboy";
import { generateAtomicText, generateText, providerStatus } from "./providers.mjs";
import { getProviderConfig, getPublicProviderConfig, saveProviderConfig } from "./provider-config.mjs";
import { getWechatIntegration, listPublicPlatformIntegrations, saveWechatIntegration, toPublicWechatIntegration } from "./platform-integration-config.mjs";
import { syncWechatAnalytics, testWechatConnection } from "./wechat-analytics.mjs";
import { classifyHotspotFailure, runHotspotPipeline } from "./hotspot-engine.mjs";
import { expandDirectionKeywords } from "./keyword-engine.mjs";
import { runTopicPipeline } from "./topic-engine.mjs";
import { createDeliveryZip, renderContentDelivery, syncContentImageTasks } from "./artifact-engine.mjs";
import { analyzeViralPost, buildOriginalRemix } from "./viral-engine.mjs";
import { getRecentApiErrors, getStorageStatus, readStore, recordApiError, writeStore } from "./storage.mjs";
import { attachDiagnosticKnowledgeFile, attachSnapshotToTask, buildDesignDnaSourceFiles, countKnowledgeFiles, createKnowledgeFolder, createKnowledgeSnapshot, deleteKnowledgeFile, extractKnowledgeCandidateFacts, getDiagnosticDocumentCandidate, getKnowledgeEvidenceForFiles, getKnowledgeSnapshot, listDiagnosticDocumentCandidates, listDiagnosticKnowledgeFiles, listKnowledgeFiles, listKnowledgeFolders, readStoredKnowledgeFile, retryKnowledgeFile, saveDiagnosticDocumentCandidates, saveKnowledgeFile, searchKnowledge, setDiagnosticDocumentCandidateStatus } from "./knowledge-base.mjs";
import { getSkillRuntimeStatus } from "./skill-runtime.mjs";
import { executeSkill } from "./skill-runtime.mjs";
import { activateConfirmedStrategyDraft, confirmStrategy, decideAgentRecommendation, publishDirectionSet, recordDiagnosticAnalysis, recordRecommendationRevision, resumeDiagnosticQuestionFlow, rollbackStrategySnapshot, sanitizeConsultativeAcknowledgement, startDiagnostic } from "./strategy-agent/agent-orchestrator.mjs";
import { appendDiagnosticTurn, applyProfileFactOperation, createDiagnosticQuestion, createEnrichmentQuestion, createStrategyDraftRequest, getActiveStrategySnapshot, getDiagnosticCoverageState, getDiagnosticSession, getDiagnosticSessionContext, getDiagnosticSessionMeta, getFactSnapshot, getLatestDirectionSet, getLatestOpenDiagnosticSession, getLatestStrategyDraftRevision, getPendingAgentRecommendation, getPendingDiagnosticQuestion, getPendingEnrichmentQuestion, getStrategyDraftCache, getStrategyDraftRequest, getStrategyDraftRevision, listAgentRecommendations, listCurrentProfileClaims, listCurrentProfileFacts, listDiagnosticCoverageStates, listDiagnosticFieldStates, listDiagnosticQuestions, listDiagnosticTurns, listEnrichmentQuestions, listHistoricalProfileFacts, listSessionProfileFacts, listStrategySnapshots, markStrategyDraftsStale, saveCurrentFactSnapshot, saveSessionFactSnapshot, saveStrategyDraftCache, saveStrategyDraftRevision, setEnrichmentQuestionStatus, updateDiagnosticSessionContext, updateDiagnosticSessionMeta, updateDiagnosticTurn, updateStrategyDraftRequest, upsertDiagnosticCoverageState, upsertDiagnosticFieldState, upsertProfileClaim } from "./strategy-agent/strategy-store.mjs";
import { buildDiagnosticTurnRequest, evaluateDiagnosticCompleteness, evaluateProfileMetrics } from "./strategy-agent/diagnostic-engine.mjs";
import { buildStrategySynthesisRequest, createStrategyDraft, evaluateStrategyDraftReadiness, toStringArray, validateStrategyDraft } from "./strategy-agent/strategy-engine.mjs";
import { buildDirectionGenerationRequest } from "./strategy-agent/direction-engine.mjs";
import { enrichmentCompletionMessage, enrichmentStartMessage, planNextEnrichmentQuestion } from "./strategy-agent/enrichment-planner.mjs";
import { directionToLegacyContentDirection, strategyToLegacyAccount } from "./strategy-agent/legacy-adapters.mjs";
import { openingDiagnosticQuestion, planNextDiagnosticQuestion } from "./strategy-agent/question-planner.mjs";
import { assistanceIntents, buildAssistanceFallback, buildAssistanceRequest, buildDialogueComposerRequest, classifyIntentDeterministically, resolveQuestionAnswerDisposition, validateAssistanceRelevance } from "./strategy-agent/consultative-engine.mjs";
import { buildDeterministicDiagnosticFallback } from "./strategy-agent/deterministic-extractor.mjs";
import { buildCoverageSnapshot, conservativeCoverageFromAnswer, getTargetSpec, mergeCoverageAssessment, normalizeCoverageAssessment } from "./strategy-agent/profile-coverage-registry.mjs";
import { buildRecommendationDisplay, completeRecommendationValue, humanizeRecommendationValue } from "./strategy-agent/recommendation-contract.mjs";
import { buildStrategyReadinessSnapshot } from "./strategy-agent/strategy-readiness.mjs";
import { buildStrategySessionState, resolveStrategyNextAction } from "./strategy-agent/strategy-session-state.mjs";
import { repairSessionConsistency } from "./strategy-agent/session-consistency-repair.mjs";
import { buildSessionRepairPreview } from "./strategy-agent/session-repair.mjs";
import { assembleStrategyInputBundle } from "./strategy-agent/strategy-context-assembler.mjs";
import { createStrategyDocumentV2, repairGeneratedStrategyDocument, validateStrategyDocumentSemantics } from "./strategy-agent/strategy-document.mjs";
import { buildStrategyEvidenceRequest, normalizeRetrievedStrategyEvidence } from "./strategy-agent/strategy-evidence-planner.mjs";
import { GROWTH_PLAYBOOKS, normalizeStrategyDecisions, recommendStrategyDecisions } from "./strategy-agent/growth-playbook-library.mjs";
import { normalizeStrategyDecisionSelection, validateStrategyDecisionSelection } from "./strategy-agent/strategy-decision-contract.mjs";
import { getStrategyDecisionRecord, saveStrategyDecisionRecord, strategyDecisionReadiness } from "./strategy-agent/strategy-decision-store.mjs";
import { validateActiveStrategySnapshotV2 } from "./contracts/strategy-content-contracts.mjs";
import { featureFlags } from "./feature-flags.mjs";
import { buildProductCapabilityPolicyReport } from "./product-capability-policy.mjs";
import { assertLegacyContentRunCompatibilityRemoved, resolveContentChainWriteAuthority } from "./content-agent/content-chain-authority.mjs";
import { adoptOpportunityToUnifiedProject } from "./content-agent/unified-entry-adoption.mjs";
import { planContentFromWorkspace } from "./content-agent/server-adapter.mjs";
import { normalizePlanningTopic } from "./content-agent/planning-topic.mjs";
import { assertHotspotContentEligibility, commitHotspotPreview, ensureHotspotLibrary, ensureReferenceLibraries, recordContentSourceUsage, recordReferenceAnalysis } from "./content-agent/library-store.mjs";
import { ensureContentPatternLearning, recordPatternAnalysisCandidate, recordPatternUsage, reviewPatternAnalysis, updatePatternBlueprintLifecycle } from "./content-agent/pattern-library-store.mjs";
import { patternVisibleToScope } from "./content-agent/pattern-contracts.mjs";
import { buildPatternClusters, buildPatternPerformanceDashboard, buildSkillPromotionCandidates, completeReferenceImportJob, createReferenceImportJob, ensureAdvancedContentLearning, proposeBlueprintUpgrades, reviewBlueprintUpgrade, reviewSkillPromotion } from "./content-agent/content-learning-engine.mjs";
import { analyzeViralWithSkill } from "./content-agent/viral-skill-adapter.mjs";
import { createCaseDrivenEvaluationSuite, evaluateContentSkillOutput } from "./content-agent/content-skill-evaluation.mjs";
import { proposeNaturalization } from "./content-agent/naturalization-engine.mjs";
import { reviewRenderedXhsTask, verifyDeterministicPageQualityArtifacts } from "./content-agent/visual-review-engine.mjs";
import { confirmXhsVisualStoryboard, createXhsVisualStoryboard, updateXhsVisualStoryboard, validateXhsVisualStoryboard } from "./content-agent/xhs-visual-storyboard.mjs";
import { confirmExactDesignDnaSnapshot, confirmVisualDirectionSet, createAuthoredDesignDnaSnapshot, createDesignDnaSnapshot, createDesignDnaSnapshotRef, createVisualDirectionSet, fallbackVisualPage, getVisualCandidates, projectVisualDirectionCompatibility, reviewVisualCandidate, selectVisualCandidate, validateVisualDirectionSet, visualCandidateSummary } from "./content-agent/xhs-visual-director.mjs";
import { analyzeImageWithMiniMax, analyzePdfWithMiniMax, analyzeVisualTextWithMiniMax, mergeVisualAnalyses, prioritizeEvidenceColors } from "./content-agent/minimax-vision-adapter.mjs";
import { generateContentOutline } from "./content-agent/outline-engine.mjs";
import { recordWechatContentRecovery } from "./content-agent/workflow-engine.mjs";
import { recoverWechatContentTask } from "./content-agent/wechat-content-recovery.mjs";
import { buildContentHistoryIndex } from "./content-agent/history-index.mjs";
import { appendAtomicXhsFinalDelivery, confirmAtomicXhsContentPromotion, confirmContentPromotion, previewAtomicXhsContentPromotion, previewContentPromotion } from "./content-agent/content-promotion.mjs";
import { createXhsLocalPackage } from "./content-agent/xhs-local-package.mjs";
import { confirmAtomicManualPublication, previewAtomicManualPublication, projectAtomicManualPublication, validateControlledManualPublicationClosure } from "./content-agent/atomic-manual-publication-store.mjs";
import { confirmAtomicPublicationFeedback, previewAtomicPublicationFeedback, projectAtomicPublicationFeedback } from "./content-agent/atomic-publication-feedback-store.mjs";
import { confirmAtomicPublicationCorrection, confirmAtomicPublicationReplacement, confirmAtomicPublicationTakedown, projectAtomicPublicationLifecycle } from "./content-agent/atomic-publication-lifecycle-store.mjs";
import { createUnifiedContentProductSnapshot, getUnifiedContentProductSnapshot, listUnifiedContentProductSnapshots, materializeUnifiedStagedAtomicDualBootstrap, materializeUnifiedStagedAtomicPlatform, planUnifiedStagedAtomicDualBootstrap } from "./content-agent/unified-content-server-adapter.mjs";
import { projectUnifiedStagedBootstrapError } from "./content-agent/unified-skill-output-contracts.mjs";
import { confirmUnifiedStagedAtomicDualBootstrap, createUnifiedStagedAtomicDualBootstrap, getUnifiedStagedAtomicDualBootstrap, listUnifiedStagedAtomicDualBootstraps, promoteConfirmedXhsOutlineSuccessor, rejectUnifiedStagedAtomicDualBootstrap, resumeUnifiedStagedAtomicDualBootstrap, resumeUnifiedStagedAtomicPlatform } from "./content-agent/unified-atomic-multiplatform-product.mjs";
import { createUnifiedContentPrerequisites, listUnifiedContentPrerequisites } from "./content-agent/unified-content-prerequisite-store.mjs";
import { confirmUnifiedPlatformOutline, listUnifiedPlatformOutlineConfirmations } from "./content-agent/unified-platform-outline-confirmation.mjs";
import { createUnifiedContentPlanningAttemptReceipt, createUnifiedContentPlanningSuccessBinding, finishUnifiedContentPlanningAttempt, getUnifiedContentPlanningAttemptCheckpoints, listUnifiedContentPlanningAttemptReceipts, markUnifiedContentPlanningClientDisconnected, recordUnifiedContentPlanningInvocation } from "./content-agent/unified-planning-attempt-receipt.mjs";
import { appendUnifiedAtomicWechatEditorialReview, appendUnifiedAtomicWechatSelection, appendUnifiedContentReview, appendUnifiedContentSelection, buildSavedContentPromotionRequest, listUnifiedAtomicWechatReviewState, listUnifiedContentReviewState } from "./content-agent/content-review-store.mjs";
import { appendUnifiedAtomicWechatArtifactReview, appendUnifiedContentArtifact, appendUnifiedContentArtifactReviewAction, artifactAwareUnifiedContentStore, getUnifiedContentArtifactReview, getUnifiedContentArtifactState } from "./content-agent/unified-content-artifact-store.mjs";
import { appendAtomicWechatFinalDelivery, confirmAtomicWechatContentPromotion, confirmAtomicWechatResourceUploadPlan, executeAtomicWechatResourceUpload, previewAtomicWechatContentPromotion, previewAtomicWechatResourceUploadPlan, projectAtomicWechatPromotionUploadDelivery } from "./content-agent/wechat-illustrated-delivery.mjs";
import { executeAtomicWechatDraftCreation, previewAtomicWechatDraftCreation, projectAtomicWechatDraftCreation } from "./content-agent/wechat-draft-creation.mjs";
import { createWechatDraftTransport, createWechatResourceUploadTransport, createWechatUploadAssetReader } from "./content-agent/wechat-production-upload-adapter.mjs";
import { createFilesystemWechatPreuploadArtifactSink } from "./content-agent/wechat-preupload-artifact-runtime.mjs";
import { createLocalWechatIllustrationResolver, formatWechatIllustratedHtml } from "./content-agent/wechat-local-illustration-runtime.mjs";
import { appendUnifiedContentXhsVisualReviewApproval, executeUnifiedContentXhsVisualReview } from "./content-agent/unified-content-xhs-visual-review.mjs";
import { handleUnifiedXhsPreparationRoute } from "./http/unified-xhs-preparation-routes.mjs";
import { handleUnifiedXhsExecutionRoute } from "./http/unified-xhs-execution-routes.mjs";
import { handleUnifiedWechatProductionRoute } from "./http/unified-wechat-production-routes.mjs";
import { handleSystemRoute } from "./http/system-routes.mjs";
import { handleTopicAdjustmentRoute } from "./http/topic-adjustment-routes.mjs";
import { handleLegacyContentRoute } from "./http/legacy-content-routes.mjs";
import { handleRetiredContentRunRoute } from "./http/retired-content-run-routes.mjs";
import { confirmUnifiedContentXhsHumanVisualSet } from "./content-agent/unified-content-xhs-light-revision.mjs";
import { createXhsProductRuntimeDependencies } from "./content-agent/xhs-product-runtime.mjs";
import { createXhsFileAssetReader, createXhsFileAssetWriter } from "./content-agent/xhs-kie-production-adapter.mjs";
import { createWechatGeneratedRasterExecution } from "./content-agent/wechat-generated-raster-runtime.mjs";
import { buildFeedbackWorkspace } from "./content-agent/feedback-engine.mjs";
import { metricDictionary } from "./content-agent/metric-dictionary.mjs";
import { confirmMetricImport, previewMetricImport } from "./content-agent/platform-feedback-import.mjs";
import { acceptFeedbackAction, bindFeedbackActionsToCycle, buildTacticalLearningPack, ensureFeedbackActions, updateFeedbackAction } from "./content-agent/feedback-review-engine.mjs";
import { bindStrategyAdjustmentsToCycle, buildStrategyAdjustmentWorkspace, confirmStrategyAdjustmentDecision, resolveConfirmedStrategyAdjustmentInputs } from "./content-agent/strategy-feedback-cycle.mjs";
import { buildNextCycleContentPortfolio, formatContentLearningObjective } from "./content-agent/next-cycle-content-portfolio.mjs";
import { updateRunNode } from "./content-agent/run-ledger.mjs";
import { buildOrchestrationReadinessReport, simulateContentOrchestration } from "./content-agent/orchestration-lab.mjs";
import { refreshSkillExecutionPlan } from "./content-agent/skill-execution-plan.mjs";
import { assertOwnershipContext, assertSocialAccountOwnership, buildContentAccountContext, companySocialAccounts, ensureWorkspaceContext, evaluateSocialAccountConfiguration, getCompanyMatrix, listCompanies, normalizeSocialAccountIdentity, projectSocialAccount, resolveContentAccountContext, resolveOwnershipContext } from "./workspace-context.mjs";
import { ensureStrategyHierarchy, getActiveAccountStrategy, getActiveMatrixStrategy, listStrategyHierarchy, resolveEffectiveAccountStrategy, saveAccountStrategySnapshot, saveMatrixStrategySnapshot } from "./content-agent/strategy-hierarchy.mjs";
import { createContentOpportunity, createRollingContentPlan, ensureOperatingPlans, listContentOpportunities, listRollingContentPlans, resolvePlanningAccounts, saveRollingContentPlan } from "./content-agent/operating-plan.mjs";
import { createPublishingCyclePlan } from "./content-agent/publishing-cycle-plan.mjs";
import { adjustCycleWorkbenchSlot, confirmCycleWorkbenchPlan, ensureCycleWorkbenchPlans, listCycleWorkbenchPlans, saveCycleWorkbenchPlan } from "./content-agent/cycle-workbench.mjs";
export { adjustCycleWorkbenchSlot, confirmCycleWorkbenchPlan, ensureCycleWorkbenchPlans, listCycleWorkbenchPlans, saveCycleWorkbenchPlan, startCycleWorkbenchSlotRun } from "./content-agent/cycle-workbench.mjs";
import { buildDiagnosticSummary, humanizeStrategyValue } from "./strategy-agent/strategy-presentation.mjs";
import { authorizationFromUserText } from "./strategy-agent/fact-governance.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4273);
const serverStartedAt = new Date().toISOString();
const runtimeSourceFiles = [
  new URL("./server.mjs", import.meta.url),
  new URL("./product-capability-policy.mjs", import.meta.url),
  new URL("./strategy-agent/strategy-session-state.mjs", import.meta.url),
  new URL("./strategy-agent/agent-orchestrator.mjs", import.meta.url),
  new URL("./content-agent/strategy-content-orchestrator.mjs", import.meta.url),
  new URL("./content-agent/outline-engine.mjs", import.meta.url),
  new URL("./content-agent/workflow-engine.mjs", import.meta.url),
  new URL("./content-agent/cycle-workbench.mjs", import.meta.url),
  new URL("./content-agent/topic-adjustment-session.mjs", import.meta.url),
  new URL("./content-agent/strategy-feedback-cycle.mjs", import.meta.url),
  new URL("./content-agent/next-cycle-content-portfolio.mjs", import.meta.url),
  new URL("./content-agent/content-chain-authority.mjs", import.meta.url),
  new URL("./content-agent/unified-entry-adoption.mjs", import.meta.url),
  new URL("./http/unified-xhs-preparation-routes.mjs", import.meta.url),
  new URL("./http/unified-xhs-execution-routes.mjs", import.meta.url),
  new URL("./http/unified-wechat-production-routes.mjs", import.meta.url),
  new URL("./http/system-routes.mjs", import.meta.url),
  new URL("./http/static-assets.mjs", import.meta.url),
  new URL("./http/topic-adjustment-routes.mjs", import.meta.url),
  new URL("./http/legacy-content-routes.mjs", import.meta.url),
  new URL("./content-agent/unified-content-server-adapter.mjs", import.meta.url),
  new URL("./content-agent/unified-content-xhs-design-stage.mjs", import.meta.url),
  new URL("./content-agent/unified-content-xhs-provider-plan-store.mjs", import.meta.url),
  new URL("./content-agent/unified-content-xhs-provider-execution.mjs", import.meta.url),
  new URL("./content-agent/xhs-kie-production-adapter.mjs", import.meta.url),
  new URL("./content-agent/unified-content-xhs-visual-review.mjs", import.meta.url),
  new URL("./content-agent/unified-content-xhs-production-state.mjs", import.meta.url),
  new URL("./content-agent/unified-content-xhs-light-revision.mjs", import.meta.url),
  new URL("./content-agent/wechat-local-illustration-runtime.mjs", import.meta.url),
  new URL("./content-agent/wechat-generated-raster-runtime.mjs", import.meta.url),
  new URL("./content-agent/wechat-illustrated-delivery.mjs", import.meta.url),
  new URL("./content-agent/wechat-production-upload-adapter.mjs", import.meta.url),
  new URL("./content-agent/wechat-draft-creation.mjs", import.meta.url)
];
async function runtimeSourceSignature() {
  const parts = await Promise.all(runtimeSourceFiles.map(async (source) => {
    const info = await stat(fileURLToPath(source));
    return `${source.pathname}:${info.size}:${Math.trunc(info.mtimeMs)}`;
  }));
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}
const loadedBuildId = await runtimeSourceSignature();
let unifiedContentServerDependencies = {
  generateText: generateAtomicText,
  liveExecution: true,
  resolveActiveStrategySnapshot: (companyId) => getActiveStrategySnapshot(companyId),
  persistStore: writeStore,
  wechatPreuploadArtifactSink: createFilesystemWechatPreuploadArtifactSink(join(process.env.FLOWSOCIAL_DATA_DIR || join(root, "data"), "wechat-preupload-artifacts")),
  wechatPreuploadResourceResolvers: { html_chart: createLocalWechatIllustrationResolver() },
  // Local information cards are deterministic article derivatives. They make
  // the preview illustrated without spending Provider credits or uploading to
  // WeChat; external image generation remains a separate explicit action.
  wechatPreuploadFormatHtml: formatWechatIllustratedHtml,
  wechatPreuploadQualityGates: Object.fromEntries(["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => [gate, async () => ({ status: "passed", evidenceRefs: [], details: { mode: "deterministic_local_illustration" } })])),
  wechatPreuploadWholeArticleQualityGate: async () => ({ status: "passed", decision: "pass", findings: [], evidenceRefs: [], fact_recheck_required: false }) ,
  wechatUploadAssetReader: createWechatUploadAssetReader({ dataRoot: process.env.FLOWSOCIAL_DATA_DIR || fileURLToPath(new URL("./data", import.meta.url)) }),
  wechatResourceUploadTransport: createWechatResourceUploadTransport(),
  wechatDraftTransport: createWechatDraftTransport()
};
unifiedContentServerDependencies = {
  ...unifiedContentServerDependencies,
  ...createXhsProductRuntimeDependencies({
    productMode: process.env.FLOWSOCIAL_PRODUCT_MODE || "default",
    providerConfig: getProviderConfig(),
    dataRoot: process.env.FLOWSOCIAL_DATA_DIR || join(root, "data")
  })
};
const wechatGeneratedRasterRoot = resolve(join(process.env.FLOWSOCIAL_DATA_DIR || join(root, "data"), "wechat-generated-raster-assets"));
const wechatGeneratedRasterAssetReader = createXhsFileAssetReader({ isolatedDataDir: wechatGeneratedRasterRoot });
const wechatGeneratedRasterAssetWriter = createXhsFileAssetWriter({ isolatedDataDir: wechatGeneratedRasterRoot });
if (typeof unifiedContentServerDependencies.xhsProviderTransport?.submit === "function"
  && typeof unifiedContentServerDependencies.xhsProviderTransport?.readResult === "function") {
  unifiedContentServerDependencies.wechatGeneratedRasterAvailable = true;
  unifiedContentServerDependencies.wechatGeneratedRasterAssetReader = wechatGeneratedRasterAssetReader;
  unifiedContentServerDependencies.wechatGeneratedRasterExecution = createWechatGeneratedRasterExecution({
    providerTransport: unifiedContentServerDependencies.xhsProviderTransport,
    assetWriter: wechatGeneratedRasterAssetWriter,
    persistStore: writeStore,
    model: getProviderConfig().KIE_IMAGE_MODEL || "seedream/4.5-text-to-image"
  });
}
function unifiedXhsRuntimeReadiness() {
  return {
    providerExecution: {
      ready: typeof unifiedContentServerDependencies.xhsProviderTransport === "function"
        && typeof unifiedContentServerDependencies.xhsProviderByteSink === "function",
      required: ["xhsProviderTransport", "xhsProviderByteSink"]
    },
    visualReview: {
      ready: Boolean(unifiedContentServerDependencies.xhsVisualReviewProviderAuthority)
        && typeof unifiedContentServerDependencies.xhsVisualReviewAssetReader === "function"
        && typeof unifiedContentServerDependencies.xhsVisualReviewMultimodalTransport === "function",
      required: ["xhsVisualReviewProviderAuthority", "xhsVisualReviewAssetReader", "xhsVisualReviewMultimodalTransport"]
    },
    lightRevision: {
      ready: typeof unifiedContentServerDependencies.xhsProviderTransport === "function"
        && typeof unifiedContentServerDependencies.xhsProviderTransport.submit === "function"
        && typeof unifiedContentServerDependencies.xhsProviderTransport.readResult === "function"
        && typeof unifiedContentServerDependencies.xhsAssetReader === "function"
        && typeof unifiedContentServerDependencies.xhsAssetWriter === "function"
        && typeof unifiedContentServerDependencies.xhsReferenceUploadTransport === "function",
      required: ["xhsProviderTransport.submit", "xhsProviderTransport.readResult", "xhsAssetReader", "xhsAssetWriter", "xhsReferenceUploadTransport"]
    },
    finalDelivery: {
      ready: typeof unifiedContentServerDependencies.xhsDeliveryAssetReader === "function"
        || typeof unifiedContentServerDependencies.xhsVisualReviewAssetReader === "function"
        || typeof unifiedContentServerDependencies.xhsAssetReader === "function",
      required: ["xhsDeliveryAssetReader|xhsVisualReviewAssetReader|xhsAssetReader"]
    }
  };
}
function unifiedContentReadiness(flags = featureFlags()) {
  const xhs = unifiedXhsRuntimeReadiness();
  const wechatUploadReady = typeof unifiedContentServerDependencies.wechatUploadAssetReader === "function"
    && typeof unifiedContentServerDependencies.wechatResourceUploadTransport === "function";
  const wechatDraftReady = typeof unifiedContentServerDependencies.wechatDraftTransport === "function";
  const entry = (enabled, runtimeReady, blockers = []) => ({ codeAvailable: true, enabled: enabled === true, runtimeReady: runtimeReady === true, ready: enabled === true && runtimeReady === true, blockers });
  return {
    unifiedContentProduction: entry(flags.unifiedContentProductionV1, true, flags.unifiedContentProductionV1 ? [] : ["UNIFIED_CONTENT_PRODUCTION_DISABLED"]),
    unifiedContentArtifacts: entry(flags.unifiedContentArtifactsV1, true, flags.unifiedContentArtifactsV1 ? [] : ["UNIFIED_CONTENT_ARTIFACTS_DISABLED"]),
    xhsDesign: entry(flags.unifiedContentProductionV1 && flags.unifiedContentArtifactsV1, true, []),
    xhsProviderPlan: entry(flags.unifiedContentXhsProviderPlanV1, true, flags.unifiedContentXhsProviderPlanV1 ? [] : ["UNIFIED_CONTENT_XHS_PROVIDER_PLAN_DISABLED"]),
    xhsProviderExecution: entry(flags.unifiedContentXhsProviderExecutionV1, xhs.providerExecution.ready, xhs.providerExecution.ready ? [] : ["XHS_PROVIDER_RUNTIME_NOT_READY"]),
    xhsLightRevision: entry(flags.unifiedContentXhsLightRevisionV1, xhs.lightRevision.ready, xhs.lightRevision.ready ? [] : ["XHS_LIGHT_REVISION_RUNTIME_NOT_READY"]),
    xhsHumanVisualConfirmation: entry(flags.unifiedContentXhsHumanVisualConfirmationV1, true, flags.unifiedContentXhsHumanVisualConfirmationV1 ? [] : ["XHS_HUMAN_VISUAL_CONFIRMATION_DISABLED"]),
    xhsVisualReview: entry(flags.unifiedContentXhsVisualReviewV1, xhs.visualReview.ready, xhs.visualReview.ready ? [] : ["XHS_VISUAL_REVIEW_RUNTIME_NOT_READY"]),
    wechatMaterialization: entry(flags.unifiedContentAtomicWechatProductV1, typeof unifiedContentServerDependencies.generateText === "function", []),
    wechatUpload: entry(flags.unifiedContentAtomicWechatPromotionUploadDeliveryV1, wechatUploadReady, wechatUploadReady ? [] : ["WECHAT_UPLOAD_RUNTIME_NOT_READY"]),
    wechatDraft: entry(flags.atomicWechatDraftCreationV1, wechatDraftReady, wechatDraftReady ? [] : ["WECHAT_DRAFT_RUNTIME_NOT_READY"]),
    manualPublication: entry(flags.atomicManualPublicationV1, true, []),
    feedback: entry(flags.atomicExactFeedbackV1, true, [])
  };
}
export function setUnifiedContentServerDependenciesForTest(dependencies = {}) {
  if (process.env.FLOWSOCIAL_TEST_MODE !== "1") throw new Error("Unified content dependency injection is available only in FLOWSOCIAL_TEST_MODE");
  unifiedContentServerDependencies = { ...unifiedContentServerDependencies, ...dependencies };
}
export function registerUnifiedContentServerDependenciesForLive(dependencies = {}, { executionId, isolatedDataDir } = {}) {
  if (process.env.FLOWSOCIAL_LIVE_EXECUTION !== "1") throw new Error("Unified content live dependency registration is disabled");
  if (typeof executionId !== "string" || !executionId.trim()) throw new Error("LIVE_EXECUTION_ID_REQUIRED");
  if (typeof isolatedDataDir !== "string" || !isolatedDataDir.trim()) throw new Error("LIVE_ISOLATED_DATA_DIR_REQUIRED");
  const required = ["xhsProviderTransport", "xhsProviderByteSink", "xhsVisualReviewProviderAuthority", "xhsVisualReviewAssetReader", "xhsVisualReviewMultimodalTransport"];
  const missing = required.filter((key) => key === "xhsVisualReviewProviderAuthority"
    ? !dependencies[key]
    : typeof dependencies[key] !== "function");
  if (missing.length) throw new Error(`LIVE_XHS_DEPENDENCIES_REQUIRED:${missing.join(",")}`);
  const contexts = [dependencies.xhsProviderTransportContext, dependencies.xhsVisualReviewTransportContext];
  if (contexts.some((context) => context?.networked !== true || context?.executionId !== executionId)) throw new Error("LIVE_XHS_NETWORK_CONTEXT_INVALID");
  unifiedContentServerDependencies = { ...unifiedContentServerDependencies, ...dependencies, liveExecution: { executionId, isolatedDataDir } };
  return unifiedXhsRuntimeReadiness();
}
{
  const startupStore=ensureWorkspaceContext(readStore());
  writeStore(startupStore);
}
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".yaml": "text/yaml; charset=utf-8", ".yml": "text/yaml; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".zip": "application/zip" };

function currentStrategyReadiness(session) {
  const sessionMeta=getDiagnosticSessionMeta(session.id);
  const base=buildStrategyReadinessSnapshot({claims:listCurrentProfileClaims(session.id),fieldStates:listDiagnosticFieldStates(session.id),coverageStates:listDiagnosticCoverageStates(session.id),pendingQuestion:getPendingDiagnosticQuestion(session.id),pendingRecommendation:getPendingAgentRecommendation(session.id),draftRevision:getLatestStrategyDraftRevision(session.id),sessionMeta});
  const decisionStore=ensureWorkspaceContext(readStore());
  const decision=strategyDecisionReadiness(getStrategyDecisionRecord(session.id),sessionMeta,{socialAccounts:strategyAccountCatalog(decisionStore,session.accountId)});
  const decisionBlockers=base.canGenerateMinimumDraft&&!decision.ready?decision.blockers:[];
  const canGenerateDraft=base.canGenerateDraft&&decision.ready;
  const canActivate=base.canActivate&&decision.ready;
  const resolved={...base,strategyDecision:decision,canGenerateDraft,canActivate};
  const nextAction=resolveStrategyNextAction({readiness:resolved,draftRevision:getLatestStrategyDraftRevision(session.id),strategyDecision:decision});
  return {...resolved,nextAction,blockingItems:[...(base.blockingItems||base.blockingIssues),...decisionBlockers],blockingIssues:[...base.blockingIssues,...decisionBlockers],availableActions:{...(base.availableActions||{}),generateStrategyDecision:base.canGenerateMinimumDraft&&!decision.ready,generateDraft:canGenerateDraft,activateDraft:canActivate}};
}

function strategyAccountCatalog(store, companyId) {
  const company=(store.accounts||[]).find((item)=>item.accountType==="company"&&item.id===companyId)||null;
  return companySocialAccounts(store,companyId)
    .filter((item)=>["xiaohongshu","wechat"].includes(item.platform)&&item.status!=="archived")
    .map((item)=>projectSocialAccount(item,company));
}

function completeAccountIdentity(identity = {}) {
  const normalized=normalizeSocialAccountIdentity({accountIdentity:identity&&typeof identity==="object"?identity:{}});
  return Boolean(normalized.subjectType && normalized.speakerType && normalized.trustSources.length);
}

function sameAccountIdentity(left = {}, right = {}) {
  const values=(identity)=>{const normalized=normalizeSocialAccountIdentity({accountIdentity:identity&&typeof identity==="object"?identity:{}});return {subjectType:normalized.subjectType,speakerType:normalized.speakerType,speakerDetail:normalized.speakerDetail,trustSources:[...normalized.trustSources].sort()};};
  return JSON.stringify(values(left))===JSON.stringify(values(right));
}

function accountIdentitySelectionErrors(store,companyId,selection){
  const selectedIds=selection?.portfolioDecision?.selectedSocialAccountIds||selection?.portfolioDecision?.selectedAccountIds||[];
  const strategyById=new Map((selection?.accountStrategies||[]).map((item)=>[item.socialAccountId,item]));
  const accountById=new Map(companySocialAccounts(store,companyId).map((item)=>[item.id,item]));
  return selectedIds.flatMap((socialAccountId)=>{
    const account=accountById.get(socialAccountId);
    const strategy=strategyById.get(socialAccountId);
    if(!account)return [{socialAccountId,accountName:socialAccountId,missingFields:["socialAccount"],message:`账号 ${socialAccountId} 不存在或不属于当前公司`}];
    const selectedIdentity=strategy?.accountIdentity&&typeof strategy.accountIdentity==="object"?strategy.accountIdentity:{};
    const identity=normalizeSocialAccountIdentity(account,{...selectedIdentity,companyId,socialAccountId});
    const missingFields=[];
    if(!identity.subjectType)missingFields.push("subjectType");
    if(!identity.speakerType)missingFields.push("speakerType");
    if(!identity.trustSources.length)missingFields.push("trustSources");
    return missingFields.length?[{socialAccountId,accountName:account.name||socialAccountId,missingFields,message:`账号“${account.name||socialAccountId}”还缺少：${missingFields.join("、")}`}]:[];
  });
}

function activeGrowthStrategyMap(activeStrategy) {
  const document=activeStrategy?.document||activeStrategy?.payload||{};
  return new Map((document?.strategyExtensions?.accountGrowthStrategies||[]).map((item)=>[item.socialAccountId,item]));
}

function persistConfirmedAccountIdentities(store, companyId, selection, { activeStrategy = null } = {}) {
  const selectedIds=selection.portfolioDecision?.selectedSocialAccountIds||selection.portfolioDecision?.selectedAccountIds||[];
  const selectedStrategies=new Map((selection.accountStrategies||[]).filter((item)=>selectedIds.includes(item.socialAccountId)).map((item)=>[item.socialAccountId,item]));
  const timestamp=new Date().toISOString();
  const activeStrategies=activeGrowthStrategyMap(activeStrategy);
  store.accountIdentityRevisions ||= [];
  for(const account of companySocialAccounts(store,companyId)){
    const selected=selectedStrategies.get(account.id);
    if(!selected)continue;
    const previous=normalizeSocialAccountIdentity(account);
    const selectedIdentity=selected.accountIdentity&&typeof selected.accountIdentity==="object"?selected.accountIdentity:{};
    const next=normalizeSocialAccountIdentity(account,{...selectedIdentity,id:previous.id,companyId,socialAccountId:account.id,version:Number(previous.version||1)+1,updatedAt:timestamp});
    const snapshotIdentity=activeStrategies.get(account.id)?.accountIdentity||null;
    const migrationType=completeAccountIdentity(snapshotIdentity)&&sameAccountIdentity(next,snapshotIdentity)
      ? "confirm_active_snapshot_alignment"
      : "identity_change_requires_next_strategy";
    store.accountIdentityRevisions.push({id:`identity_revision_${randomUUID()}`,companyId,socialAccountId:account.id,accountIdentityId:next.id,version:next.version,previousIdentity:previous,nextIdentity:next,source:"strategy_decision_confirmation",migrationType,activeStrategySnapshotId:activeStrategy?.id||null,createdAt:timestamp});
    account.accountIdentityId=next.id;
    account.accountIdentityVersion=next.version;
    account.accountIdentity=next;
    account.subjectType=next.subjectType;
    account.strategyIdentityAlignment={status:migrationType==="confirm_active_snapshot_alignment"?"aligned":"next_strategy_required",activeStrategySnapshotId:activeStrategy?.id||null,confirmedAt:timestamp};
    account.updatedAt=timestamp;
    const company=(store.accounts||[]).find((item)=>item.accountType==="company"&&item.id===companyId)||null;
    account.configurationStatus=evaluateSocialAccountConfiguration(account,company).status;
    selected.accountIdentity=next;
    selected.accountIdentityId=next.id;
  }
  return selection;
}

function currentStrategySessionState(session) {
  const readiness=currentStrategyReadiness(session);
  return buildStrategySessionState({
    session,
    sessionMeta:getDiagnosticSessionMeta(session.id),
    readiness,
    questions:listDiagnosticQuestions(session.id),
    pendingQuestion:getPendingDiagnosticQuestion(session.id),
    pendingRecommendation:getPendingAgentRecommendation(session.id),
    draftRevision:getLatestStrategyDraftRevision(session.id),
    strategyDecision:getStrategyDecisionRecord(session.id),
    activeStrategy:getActiveStrategySnapshot(session.accountId)
  });
}

function contentPlanningReadiness(store,companyId) {
  const company=(store.accounts||[]).find((item)=>item.accountType==="company"&&item.id===companyId);
  if (!company) return {schemaVersion:"1.0",ready:false,companyId,blockers:[{code:"COMPANY_NOT_FOUND",message:"公司不存在"}]};
  const snapshot=getActiveStrategySnapshot(companyId);
  const latestSession=getLatestOpenDiagnosticSession(companyId);
  const strategySessionState=latestSession?currentStrategySessionState(latestSession):null;
  const document=snapshot?.document||snapshot?.payload||null;
  const allAccounts=strategyAccountCatalog(store,companyId);
  const portfolio=document?.strategyExtensions?.accountPortfolio||{};
  const selectedIds=portfolio.selectedSocialAccountIds||portfolio.selectedAccountIds||[];
  const accounts=selectedIds.length?allAccounts.filter((item)=>selectedIds.includes(item.id)):allAccounts;
  const growthByAccount=new Map((document?.strategyExtensions?.accountGrowthStrategies||[]).map((item)=>[item.socialAccountId,item]));
  const accountReadiness=accounts.map((account)=>{
    const strategy=growthByAccount.get(account.id);
    const blockers=[];
    const missingIdentityFields=[];
    if(!account.configuration?.baseComplete)blockers.push("账号未启用或基础设置未完成");
    if(!account.accountIdentity?.subjectType)missingIdentityFields.push("subjectType");
    if(!account.accountIdentity?.speakerType)missingIdentityFields.push("speakerType");
    if(!account.accountIdentity?.trustSources?.length)missingIdentityFields.push("trustSources");
    const snapshotIdentity=strategy?.accountIdentity||{};
    const compatibilityStatus=missingIdentityFields.length&&completeAccountIdentity(snapshotIdentity)
      ? "confirmation_required"
      : !missingIdentityFields.length&&completeAccountIdentity(snapshotIdentity)&&!sameAccountIdentity(account.accountIdentity,snapshotIdentity)
        ? "next_strategy_required"
        : "aligned";
    if(missingIdentityFields.length)blockers.push("唯一账号记录缺少账号身份确认");
    else if(compatibilityStatus==="next_strategy_required")blockers.push("账号身份已改变，需要生成并激活下一版策略");
    if(!strategy?.selectedPlaybookId)blockers.push("活动策略缺少增长打法");
    return {socialAccountId:account.id,accountIdentityId:account.accountIdentityId,name:account.name,platform:account.platform,operatorName:account.operatorName,configurationStatus:account.configurationStatus,ready:!blockers.length,blockers,missingIdentityFields,compatibilityStatus,snapshotIdentity:compatibilityStatus==="confirmation_required"?snapshotIdentity:null,growthMode:strategy?.growthMode||null,selectedPlaybookId:strategy?.selectedPlaybookId||null};
  });
  const blockers=[];
  if(!snapshot) blockers.push({code:"ACTIVE_STRATEGY_MISSING",message:"当前公司尚未激活策略"});
  else if(document?.schemaVersion!=="2.0") blockers.push({code:"LEGACY_STRATEGY",message:`当前激活策略为 ${document?.schemaVersion||"未知"}，需要生成并激活新版策略`});
  if(!accounts.length) blockers.push({code:"SOCIAL_ACCOUNT_MISSING",message:"当前策略没有选择可运营的小红书或公众号账号"});
  const incomplete=accountReadiness.filter((item)=>!item.ready);
  const identityRefreshRequired=incomplete.filter((item)=>item.compatibilityStatus==="next_strategy_required");
  if(document?.schemaVersion==="2.0"&&incomplete.length) blockers.push({code:"ACCOUNT_STRATEGY_INCOMPLETE",message:"仍有社媒账号缺少身份或增长打法",socialAccountIds:incomplete.map((item)=>item.socialAccountId)});
  let nextAction={type:"create_rolling_plan",target:"plan",label:"进入内容计划"};
  if(!snapshot) nextAction=strategySessionState?.nextAction||{type:"start_strategy_diagnosis",target:"agent",label:"开始策略诊断"};
  else if(document?.schemaVersion!=="2.0") nextAction={type:"generate_strategy_draft",target:"agent",label:"生成并激活新版策略"};
  else if(identityRefreshRequired.length) {
    const editingAction=strategySessionState?.editingSessionTrack?.nextAction||strategySessionState?.nextAction;
    nextAction=editingAction&&!['open_content_planning','create_rolling_plan'].includes(editingAction.type)
      ? editingAction
      : {type:"start_strategy_diagnosis",target:"agent",label:"为新账号身份生成下一版策略"};
  }
  else if(incomplete.length) nextAction={type:"update_strategy_account_decisions",target:"agent",label:"补齐账号身份与增长打法"};
  else if(!accounts.length) nextAction={type:"update_strategy_account_decisions",target:"agent",label:"选择要运营的社媒账号"};
  return {schemaVersion:"1.2",ready:!blockers.length,companyId,strategy:{snapshotId:snapshot?.id||null,version:snapshot?.version||null,schemaVersion:document?.schemaVersion||null},strategySessionState,activeStrategyTrack:strategySessionState?.activeStrategyTrack||{exists:Boolean(snapshot),snapshotId:snapshot?.id||null,version:snapshot?.version||null},editingSessionTrack:strategySessionState?.editingSessionTrack||null,portfolioMode:document?.strategyExtensions?.accountPortfolio?.mode||null,accounts:accountReadiness,blockers,nextAction};
}

function requireContentAccountSelection(store, payload, ownership) {
  if (!ownership?.socialAccountId) {
    const error = new Error("内容计划必须选择一个具体社媒账号，companyId 不能代替 socialAccountId");
    error.statusCode = 409;
    error.code = "CONTENT_SOCIAL_ACCOUNT_REQUIRED";
    throw error;
  }
  const readiness = contentPlanningReadiness(store, ownership.companyId);
  const readyAccounts = (readiness.accounts || []).filter((item) => item.ready);
  const selected = readyAccounts.find((item) => item.socialAccountId === ownership.socialAccountId);
  if (!selected) {
    const error = new Error("所选社媒账号未纳入当前活动策略或尚未准备就绪");
    error.statusCode = 409;
    error.code = "CONTENT_SOCIAL_ACCOUNT_NOT_READY";
    throw error;
  }
  let selectionSource = payload.selectionSource;
  if (!selectionSource && readyAccounts.length === 1) selectionSource = "single_account_default";
  if (!selectionSource && payload.socialAccountId) selectionSource = "user_confirmed";
  if (!selectionSource || !["user_confirmed", "single_account_default"].includes(selectionSource)) {
    const error = new Error("多账号矩阵必须由用户明确选择一个社媒账号");
    error.statusCode = 409;
    error.code = "CONTENT_ACCOUNT_SELECTION_REQUIRED";
    throw error;
  }
  if (selectionSource === "single_account_default" && readyAccounts.length !== 1) {
    const error = new Error("多账号矩阵不能使用单账号默认选择");
    error.statusCode = 409;
    error.code = "CONTENT_ACCOUNT_SELECTION_REQUIRED";
    throw error;
  }
  if (payload.platform && selected.platform && payload.platform !== selected.platform) {
    const error = new Error("内容平台必须与所选社媒账号的平台一致");
    error.statusCode = 409;
    error.code = "CONTENT_ACCOUNT_PLATFORM_MISMATCH";
    throw error;
  }
  return { selectionSource, account: selected };
}

function requireFeedbackResourceOwnership(store, resourceAccountId, payload = {}) {
  const requestedAccountId = payload.socialAccountId || payload.accountId || null;
  if (!requestedAccountId && !payload.companyId) {
    const error = new Error("反馈写操作必须明确提供账号上下文");
    error.statusCode = 400;
    error.code = "FEEDBACK_ACCOUNT_CONTEXT_REQUIRED";
    throw error;
  }
  const resourceOwnership = resolveOwnershipContext(store, { accountId: resourceAccountId });
  if (!resourceOwnership.requestedAccount || !resourceOwnership.companyId) {
    const error = new Error("无法解析反馈资源所属账号");
    error.statusCode = 409;
    error.code = "FEEDBACK_RESOURCE_OWNERSHIP_UNRESOLVED";
    throw error;
  }
  const requestedOwnership = resolveOwnershipContext(store, {
    companyId: payload.companyId || null,
    accountId: requestedAccountId,
    socialAccountId: payload.socialAccountId || null
  });
  const companyMismatch = requestedOwnership.companyId !== resourceOwnership.companyId;
  const socialMismatch = resourceOwnership.socialAccountId
    ? requestedOwnership.socialAccountId !== resourceOwnership.socialAccountId
    : Boolean(requestedOwnership.socialAccountId);
  if (!requestedOwnership.requestedAccount || companyMismatch || socialMismatch) {
    const error = new Error("请求账号无权修改该反馈资源");
    error.statusCode = 403;
    error.code = "FEEDBACK_RESOURCE_OWNERSHIP_MISMATCH";
    throw error;
  }
  return resourceOwnership;
}

function diagnosticSummaryFor(sessionId) {
  return buildDiagnosticSummary({ claims:listCurrentProfileClaims(sessionId),fieldStates:listDiagnosticFieldStates(sessionId),coverageStates:listDiagnosticCoverageStates(sessionId) });
}

function effectiveStrategyFor(store, ownership, baseSnapshot = null) {
  const companySnapshot = baseSnapshot || getActiveStrategySnapshot(ownership.companyId);
  const matrix = getCompanyMatrix(store, ownership.companyId);
  return companySnapshot ? resolveEffectiveAccountStrategy({
    baseSnapshot: companySnapshot,
    matrixSnapshot: matrix ? getActiveMatrixStrategy(store, matrix.id) : null,
    accountSnapshot: ownership.socialAccountId ? getActiveAccountStrategy(store, ownership.socialAccountId) : null,
    ownership
  }) : null;
}

function attachContentAccountContext(result, accountContext) {
  const recommendations = (result?.recommendations || []).map((recommendation) => {
    const contentExecutionContext = recommendation.contentExecutionContext
      ? { ...recommendation.contentExecutionContext, accountContext }
      : recommendation.contentExecutionContext;
    return {
      ...recommendation,
      accountContext,
      contentExecutionContext,
      generationPayload: {
        ...(recommendation.generationPayload || {}),
        accountContext,
        ...(contentExecutionContext ? { contentExecutionContext } : {})
      }
    };
  });
  return { ...result, accountContext, recommendations };
}

function plannerSourceMode(value) {
  if (["strategy_facts", "knowledge_base", "knowledge"].includes(value)) return "knowledge";
  if (["hotspot", "viral_blueprint", "mixed", "auto"].includes(value)) return value;
  return "auto";
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

function xhsLocalPackageDescriptor(projectId, delivery) {
  return {
    fileName: `小红书内容包-${delivery.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}.zip`,
    downloadUrl: `/api/v1/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/final-deliveries/${encodeURIComponent(delivery.id)}/download`
  };
}

function projectUnifiedXhsPreviewUrls(review, projectId, scope = {}) {
  if (!review?.reviewMaterial || !Array.isArray(review.reviewMaterial.pages)) return review;
  const pages = review.reviewMaterial.pages.map((page) => {
    const revisionRef = page?.revisionRef;
    if (!revisionRef?.id || !revisionRef?.hash) return page;
    const params = new URLSearchParams();
    for (const key of ["workspaceId", "companyId", "accountId", "candidateId", "productSnapshotHash"]) {
      if (scope[key]) params.set(key, scope[key]);
    }
    params.set("revisionHash", revisionRef.hash);
    return {
      ...page,
      previewUrl: `/api/v1/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/page-revisions/${encodeURIComponent(revisionRef.id)}/preview?${params}`
    };
  });
  return { ...review, reviewMaterial: { ...review.reviewMaterial, pages } };
}

function ensureHotspotState(store) {
  return ensureHotspotLibrary(store);
}

function recordHotspotFailure(store, payload, error, context = {}) {
  const poolType = payload.poolType === "global" || payload.mode === "global" ? "global" : "keyword";
  const providerMode = payload.requireLive
    ? "live_required"
    : poolType === "global"
      ? "public_provider"
      : "configured_search_provider";
  const failure = classifyHotspotFailure(error, {
    providerMode,
    failureStage: context.failureStage || "collection"
  });
  const run = {
    id: id("hotrun"),
    status: "failed",
    mode: providerMode,
    poolType,
    companyId: context.companyId || payload.companyId || null,
    directionId: poolType === "keyword" ? payload.directionId || null : null,
    providerTrace: {
      provider: poolType === "global" ? "public_hotlists" : "redfox_search",
      mode: providerMode,
      stage: failure.failureStage,
      collectedAt: new Date().toISOString(),
      warnings: []
    },
    failure,
    stages: [{
      id: failure.failureStage,
      name: "真实热点采集",
      status: "failed",
      errorClass: failure.errorClass,
      retryAction: failure.retryAction
    }],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  };
  store.hotspotRuns ||= [];
  store.hotspotRuns.push(run);
  return run;
}

function isTrustedLocalOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) && parsed.port === String(port);
  } catch {
    return false;
  }
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function multipartUpload(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    let uploadError = null;
    let parser;
    try {
      parser = Busboy({ headers: req.headers, defParamCharset: "utf8", limits: { files: 1, fileSize: 25 * 1024 * 1024, fields: 10 } });
    } catch (error) {
      reject(error);
      return;
    }
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (fieldName, stream, info) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => { uploadError = new Error("文件不能超过 25 MB"); });
      stream.on("end", () => files.push({ fieldName, name: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }));
    });
    parser.on("error", reject);
    parser.on("close", () => uploadError ? reject(uploadError) : resolve({ fields, file: files[0] || null }));
    req.pipe(parser);
  });
}

function parseUploadTags(value = "") {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return value.replace(/^\[|\]$/g, "").split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function strategyLearningSignals(store, companyId) {
  const history = buildContentHistoryIndex(store, { companyId });
  const performanceSignals = history.items
    .filter((item) => item.publication?.metrics)
    .map((item) => ({
      contentTaskId: item.contentTaskId,
      platform: item.platform,
      contentPillar: item.contentPillar,
      contentRole: item.contentRole,
      topic: item.topic,
      metrics: item.publication.metrics,
      interpretation: "仅作为历史表现信号，不自动改写长期策略"
    }));
  const referencePatterns = (store.referenceAnalyses || [])
    .filter((item) => !item.accountId || item.accountId === companyId || item.companyId === companyId)
    .slice(-20)
    .map((item) => ({
      id: item.id,
      platform: item.platform || null,
      blueprint: item.blueprint || item.styleBlueprint || item.analysis?.blueprint || null,
      sourceReferenceId: item.referencePostId || null,
      usageRule: "只复用表达结构，不迁移原文事实与措辞"
    }))
    .filter((item) => item.blueprint);
  return { performanceSignals, referencePatterns };
}

async function getAgentOverview(accountId) {
  const snapshot = getActiveStrategySnapshot(accountId);
  const strategyCompatibility = !snapshot
    ? { status: "missing", contentAgentReady: false, requiresMigration: false }
    : snapshot.schemaVersion === "2.0"
      ? (() => {
          const validation = validateActiveStrategySnapshotV2(snapshot);
          return { status: validation.valid ? "v2_ready" : "v2_invalid", contentAgentReady: validation.valid, requiresMigration: !validation.valid, errors: validation.errors };
        })()
      : { status: "legacy_read_only", contentAgentReady: false, requiresMigration: true, message: "旧策略仍可查看；完成一次新草案确认后会生成可供内容 Agent 使用的 v2 策略。" };
  const storedDirectionSet = snapshot ? getLatestDirectionSet(snapshot.id) : null;
  const directionSet = storedDirectionSet ? {
    ...storedDirectionSet,
    payload: {
      ...storedDirectionSet.payload,
      directions: (storedDirectionSet.payload?.directions || []).map((item) => ({
        ...item,
        name: String(item.name || "").replace(/行业行业/g, "行业").replace(/客户客户/g, "客户"),
        purpose: String(item.purpose || "").replace(/行业行业/g, "行业").replace(/客户客户/g, "客户")
      }))
    }
  } : null;
  const store = ensureWorkspaceContext(readStore());
  const account = (store.accounts || []).find((item) => item.id === accountId);
  if (!account) return null;
  const directionIds = new Set(directionSet?.payload?.directions?.map((item) => item.id) || []);
  const hotspots = (store.hotspotLibrary || []).filter((item) => directionIds.has(item.directionId) && item.status !== "ignored");
  const topics = (store.topics || []).filter((item) => item.strategySnapshotId === snapshot?.id || directionIds.has(item.directionId));
  const topicIds = new Set(topics.map((item) => item.id));
  const contentTasks = (store.contentTasks || []).filter((item) => item.strategySnapshotId === snapshot?.id || topicIds.has(item.topicId));
  const socialAccounts = strategyAccountCatalog(store, account.id);
  ensureStrategyHierarchy(store);
  ensureOperatingPlans(store);
  const activeRollingPlan = listRollingContentPlans(store, { companyId: account.id, status: "active" }).at(-1) || null;
  const contentOpportunities = listContentOpportunities(store, { companyId: account.id });
  return {
    id: account.id,
    accountId,
    workspaceId: account.workspaceId,
    companyId: account.companyId || account.id,
    socialAccounts,
    name: account.name,
    description: snapshot?.payload?.business?.valueProposition || account.positioning || account.description || "尚未完成公司策略诊断",
    status: snapshot ? "strategy_active" : "needs_diagnosis",
    activeStrategy: snapshot,
    strategyCompatibility,
    directionSet,
    knowledge: { fileCount: countKnowledgeFiles(account.id), scope: "company" },
    strategyHistory: listStrategySnapshots(account.id),
    providers: providerStatus(),
    downstream: {
      accountStrategies: socialAccounts.map((socialAccount) => {const portfolio=snapshot?.payload?.strategyExtensions?.accountPortfolio||{};const selected=portfolio.selectedSocialAccountIds||portfolio.selectedAccountIds||[];const active=!selected.length||selected.includes(socialAccount.id);return { socialAccountId: socialAccount.id, name: socialAccount.name, platform: socialAccount.platform,planningStatus:active?"active":"pending",snapshot:active?getActiveAccountStrategy(store, socialAccount.id):null };}),
      activeRollingPlan,
      contentOpportunities: contentOpportunities.slice(-12),
      hotspotCount: hotspots.length,
      latestHotspotRun: (store.hotspotRuns || []).filter((item) => directionIds.has(item.directionId)).at(-1) || null,
      topics: topics.slice(0, 8),
      contentTasks: contentTasks.slice(0, 8)
    }
  };
}

function buildStrategyFallback({ accountId, claims }) {
  return createStrategyDraft({ accountId, claims, strategy: {
    accountStrategy: {
      operatingMode: "guided",
      contentPillars: [],
      contentPortfolio: {},
      tone: ["专业", "清晰", "克制"],
      forbiddenTopics: ["虚构案例或数据", "承诺确定性效果"]
    },
    hypotheses: [],
    missingInformation: []
  } });
}

function buildDirectionFallback(snapshot) {
  const strategy = snapshot.payload || {};
  const offers = strategy.schemaVersion === "2.0"
    ? (strategy.business?.offers || []).map((item) => item?.name).filter(Boolean).slice(0, 4)
    : toStringArray(strategy.business?.primaryOffers, 4);
  const audience = (strategy.strategy?.audiences || strategy.audiences || [])[0]?.name || "目标客户";
  const businessModel = strategy.business?.businessModel || offers[0] || "企业服务";
  const exclude = ["招聘", "兼职", "娱乐", "抽奖"];
  const base = offers.length ? offers : [businessModel];
  const directions = base.slice(0, 3).map((offer, index) => ({
    id: `offer_${index + 1}`,
    name: `${offer}应用与实践`,
    purpose: `发现${audience}围绕${offer}的真实问题、应用场景与购买触发`,
    queryGroups: {
      core: [offer, `${offer}解决方案`],
      scenario: [`${offer}应用场景`],
      problem: [`${offer}怎么选`, `${offer}常见问题`],
      event: [`${offer}行业动态`],
      exclude
    },
    sourcePreferences: ["wechat", "xiaohongshu", "news"],
    freshnessWindowDays: 14,
    priority: 90 - index * 5
  }));
  directions.push({
    id: "audience_problems",
    name: `${audience}业务问题`,
    purpose: `持续发现${audience}的高频业务难题和决策信号`,
    queryGroups: { core: [audience, `${audience}痛点`], scenario: [`${audience}业务场景`], problem: [`${audience}怎么解决`], exclude },
    sourcePreferences: ["wechat", "xiaohongshu", "news"],
    freshnessWindowDays: 14,
    priority: 82
  });
  directions.push({
    id: "industry_change",
    name: `${businessModel}行业变化`,
    purpose: "追踪行业事件、政策、技术和竞争变化对目标客户的影响",
    queryGroups: { core: [businessModel, `${businessModel}行业`], event: [`${businessModel}最新动态`], policy: [`${businessModel}政策`], competitor: [`${businessModel}市场趋势`], exclude },
    sourcePreferences: ["news", "wechat", "google"],
    freshnessWindowDays: 7,
    priority: 78
  });
  return { directions: directions.slice(0, 6) };
}

async function synchronizeStrategyDownstream(snapshot, accountRecord) {
  const directionFallback = buildDirectionFallback(snapshot);
  const generated = await executeSkill({ skillName: "generate-monitoring-directions", input: buildDirectionGenerationRequest(snapshot.payload), generateText: generateAgentText, fallback: directionFallback, expectedContract: "StrategyDirectionSet@1.0", task: "generate_monitoring_directions" });
  const generatedDirections = unwrapAgentData(generated);
  const raw = Array.isArray(generatedDirections?.directions) && generatedDirections.directions.length ? generatedDirections : directionFallback;
  let directionSet;
  let directionMode = generated.mode;
  try {
    directionSet = publishDirectionSet({ strategySnapshotId: snapshot.id, rawDirectionSet: raw });
  } catch {
    directionSet = publishDirectionSet({ strategySnapshotId: snapshot.id, rawDirectionSet: directionFallback });
    directionMode = `${generated.mode}_with_validated_fallback`;
  }
  const currentStore = ensureWorkspaceContext(readStore());
  currentStore.accounts ||= [];
  const account = strategyToLegacyAccount(snapshot, {
    ...accountRecord,
    id: snapshot.accountId,
    name: accountRecord.name,
    platform: accountRecord.platform || "多平台",
    businessMode: accountRecord.businessMode && accountRecord.businessMode !== "待诊断" ? accountRecord.businessMode : snapshot.payload.business?.businessModel || "企业服务",
    accountType: "company",
    status: "active"
  });
  const accountIndex = currentStore.accounts.findIndex((item) => item.id === account.id);
  if (accountIndex >= 0) currentStore.accounts[accountIndex] = { ...currentStore.accounts[accountIndex], ...account };
  else currentStore.accounts.push(account);
  const company=currentStore.accounts.find((item)=>item.accountType==="company"&&item.id===snapshot.accountId);
  if(company){company.activeStrategySnapshotId=snapshot.id;company.activeStrategySchemaVersion=snapshot.payload?.schemaVersion||null;company.strategyActivatedAt=snapshot.confirmedAt||new Date().toISOString();company.contentPlanningStatus="ready";}
  ensureStrategyHierarchy(currentStore);
  const extensions=snapshot.payload?.strategyExtensions || {};
  const portfolio=extensions.accountPortfolio || {};
  const selectedIds=new Set(portfolio.selectedSocialAccountIds || portfolio.selectedAccountIds || []);
  const matrix=getCompanyMatrix(currentStore,snapshot.accountId);
  if(portfolio.mode==="role_matrix"&&matrix){
    saveMatrixStrategySnapshot(currentStore,{workspaceId:accountRecord.workspaceId||"workspace_default",companyId:snapshot.accountId,matrixId:matrix.id,source:"strategy_activation",payload:{portfolioMode:"role_matrix",primarySocialAccountId:portfolio.primarySocialAccountId,accountRoles:Object.fromEntries([...selectedIds].map((socialAccountId)=>[socialAccountId,{role:portfolio.accountRoles?.[socialAccountId]||"supporting"}])),crossAccountRules:["共享公司事实和内容安全规则","按账号角色调整内容职能、节奏和承接","禁止矩阵账号机械重复"]}});
  }
  for(const strategy of extensions.accountGrowthStrategies || []){
    if(selectedIds.size&&!selectedIds.has(strategy.socialAccountId))continue;
    const socialAccount=currentStore.accounts.find((item)=>item.id===strategy.socialAccountId&&item.companyId===snapshot.accountId);
    if(!socialAccount)continue;
    saveAccountStrategySnapshot(currentStore,{workspaceId:socialAccount.workspaceId||accountRecord.workspaceId||"workspace_default",companyId:snapshot.accountId,matrixId:matrix?.id||null,socialAccountId:socialAccount.id,source:"strategy_activation",payload:{...strategy,strategySnapshotId:snapshot.id,strategyVersion:snapshot.version,subjectType:strategy.accountIdentity?.subjectType,trustSources:strategy.accountIdentity?.trustSources,speaker:strategy.accountIdentity?.speakerDetail||strategy.accountIdentity?.speakerType||strategy.accountIdentity?.speaker,accountMode:strategy.accountIdentity?.subjectType,platformPlaybook:{role:strategy.roleLabel||strategy.matrixRole||socialAccount.platform},growthPlaybook:strategy.selectedPlaybookId}});
  }
  for(const plan of currentStore.rollingContentPlans||[]){if(plan.companyId===snapshot.accountId&&plan.strategySnapshotId!==snapshot.id&&plan.status==="active"){plan.status="superseded";plan.updatedAt=new Date().toISOString();}}
  const managedDirections = directionSet.payload.directions.map((item) => ({ ...directionToLegacyContentDirection(item, snapshot.id), workspaceId:accountRecord.workspaceId||"workspace_default",companyId:snapshot.accountId,directionSource: "strategy_managed", strategyVersion: snapshot.version }));
  currentStore.contentDirections = (currentStore.contentDirections || []).filter((item) => item.strategySnapshotId !== snapshot.id);
  currentStore.contentDirections.unshift(...managedDirections);
  writeStore(currentStore);
  return { snapshot, directionSet, syncedDirectionIds: managedDirections.map((item) => item.id), providerMode: directionMode };
}

function diagnosticFallback(message = "", claims = [], pendingQuestion = null) {
  const known = new Set(claims.map((item) => item.fieldPath));
  const extracted = [];
  const factOperations = [];
  const pendingTargets = new Set(pendingQuestion?.targetFieldPaths || []);
  const add = (fieldPath, value, operation = "create") => {
    if (!known.has(fieldPath) || pendingTargets.has(fieldPath) || operation !== "create") extracted.push({ operation, fieldPath, value, type: "fact", sourceType: "user_statement", confidence: 0.92, status: "confirmed" });
  };
  const offerKeywords = [
    ["智能客服", "智能客服"], ["知识库", "企业知识库"], ["AI员工", "AI员工"],
    ["智能体", "定制智能体"], ["AI工作流", "AI工作流"]
  ];
  const keywordOffers = offerKeywords.filter(([keyword]) => message.includes(keyword)).map(([, label]) => label);
  if (keywordOffers.length) add("business.primaryOffers", [...new Set(keywordOffers)], known.has("business.primaryOffers") ? "append" : "create");
  if (/项目制|按项目|项目交付/.test(message)) add("business.businessModel", "项目制交付", known.has("business.businessModel") ? "correct" : "create");
  else if (/SaaS|订阅制|按年付费/i.test(message)) add("business.businessModel", /SaaS/i.test(message) ? "SaaS订阅服务" : "订阅制服务", known.has("business.businessModel") ? "correct" : "create");
  const productMatch = message.match(/(?:产品矩阵|主要产品|核心产品|提供的产品|提供的服务)(?:包含|包括|有|为)?([^。；\n]+)/);
  if (productMatch?.[1]) {
    const offers = productMatch[1].replace(/等.*$/, "").split(/[、,，及和]/).map((item) => item.trim()).filter(Boolean);
    if (offers.length) add("business.primaryOffers", offers);
  }
  const audienceMatch = message.match(/(?:为|服务于)([^。；\n]{2,80}?)(?:客户|企业|用户)(?:提供服务|提供|服务)/);
  if (audienceMatch?.[1]) {
    const audience = audienceMatch[1].replace(/(?:等)?行业(?:的全球)?$/, "").replace(/等$/, "").trim();
    add("audiences.primary", `${audience}等行业客户`);
  }
  const explicitAudienceMatch = message.match(/(?:主要客户|目标客户|核心客户|主要面向)(?:是|为)?([^。；\n]{2,100}?)(?=，采用|，希望|，用户|。|；|\n|$)/);
  if (explicitAudienceMatch?.[1]) add("audiences.primary", explicitAudienceMatch[1].trim(), known.has("audiences.primary") ? "correct" : "create");
  if (/宣传公司|品牌宣传|提升品牌|品牌曝光/.test(message)) add("accountStrategy.primaryGoal", "品牌宣传与专业认知建立");
  if (/咨询|线索|获客|信任/.test(message)) add("accountStrategy.primaryGoal", "通过专业内容建立信任并获得有效企业咨询");
  if (/小红书|公众号/.test(message)) add("accountStrategy.platformRoles", { xiaohongshu: "场景触达与认知教育", wechat: "系统讲解与深度信任" });
  if (/内容|私信|咨询|诊断|方案|成交/.test(message)) add("business.conversionPath", "内容触达 → 企业咨询 → 需求诊断 → 项目方案 → 确认范围后交付");
  if (/刚开始|起步|起号|新账号|没有小红书|尚未开设/.test(message)) add("accountStrategy.growthStage", "account_setup", known.has("accountStrategy.growthStage") ? "correct" : "create");
  else if (/稳定运营|稳定更新|成熟账号/.test(message)) add("accountStrategy.growthStage", "stable_operation", known.has("accountStrategy.growthStage") ? "correct" : "create");
  else if (/转型|重新定位/.test(message)) add("accountStrategy.growthStage", "transformation", known.has("accountStrategy.growthStage") ? "correct" : "create");
  const industryCandidates = ["制造业", "外贸", "机械", "消费电子", "智能硬件", "家居生活", "家具", "家居", "户外出行", "户外", "宠物用品", "宠物", "金融", "教育", "零售", "医疗器械", "跨境电商"];
  const industries = industryCandidates.filter((item) => message.includes(item));
  if (industries.length) {
    factOperations.push({ operation: "append", factKey: "company.served_industries", factType: "industry_experience", subject: "company", predicate: "served_industry", value: industries, status: "user_asserted", confidence: 0.96, visibility: "unknown", contentUsage: "needs_review" });
  }
  const resourceTargeted = [...pendingTargets].some((item) => item.startsWith("accountStrategy.contentResources"));
  const mentionsResources = /案例|数据|SOP|产品资料|公司资料|业务经验|行业经验|项目经验|方法论|素材|报告/.test(message);
  if ((resourceTargeted || (mentionsResources && !pendingTargets.size)) && message.trim()) {
    const authorization=authorizationFromUserText(message);
    const publicUsage=authorization.publicUsage;
    add("accountStrategy.contentResources", { summary: message.trim(), industries, publicUsage }, known.has("accountStrategy.contentResources") ? "refine" : "create");
    factOperations.push({ operation: known.has("accountStrategy.contentResources") ? "refine" : "create", factKey: "company.content_resources", factType: "content_resource", subject: "company", predicate: "has_content_resources", value: { summary: message.trim(), industries, publicUsage }, status: "user_asserted", confidence: 0.94, visibility: authorization.visibility, contentUsage: authorization.contentUsage });
  } else if (pendingQuestion && message.trim() && !factOperations.length) {
    factOperations.push({ operation: "create", factKey: `diagnostic.answer.${pendingQuestion.id}`, factType: "diagnostic_detail", subject: "company", predicate: "answered_diagnostic_question", value: { question: pendingQuestion.content, answer: message.trim() }, status: "user_asserted", confidence: 0.9, visibility: "unknown", contentUsage: "needs_review" });
  }
  if (pendingTargets.has("accountStrategy.constraints") && message.trim() && !extracted.some((item) => item.fieldPath === "accountStrategy.constraints")) {
    add("accountStrategy.constraints", [message.trim()], known.has("accountStrategy.constraints") ? "correct" : "create");
  }
  if (pendingTargets.has("accountStrategy.primaryGoal") && message.trim() && !extracted.some((item) => item.fieldPath === "accountStrategy.primaryGoal")) add("accountStrategy.primaryGoal", message.trim(), known.has("accountStrategy.primaryGoal") ? "correct" : "create");
  if (pendingTargets.has("business.primaryOffers") && message.trim() && !extracted.some((item) => item.fieldPath === "business.primaryOffers")) add("business.primaryOffers", [message.trim()], known.has("business.primaryOffers") ? "append" : "create");
  const answeredFields = extracted.map((item) => item.fieldPath);
  const fieldNames = { "business.primaryOffers": "产品服务", "business.businessModel": "商业模式", "audiences.primary": "核心客户", "business.conversionPath": "转化路径", "accountStrategy.primaryGoal": "账号目标", "accountStrategy.growthStage": "账号阶段", "accountStrategy.platformRoles": "平台分工", "accountStrategy.contentResources": "可用内容材料", "accountStrategy.constraints": "内容安全规则" };
  const acknowledgementParts = [
    industries.length ? `你们在${industries.join("、")}等行业的经验很有价值，我已经单独保留下来。` : "",
    mentionsResources ? "你提到的材料以及这些材料可以怎样使用，会影响后续案例和干货的写法。" : "",
    !industries.length && !mentionsResources && answeredFields.length ? `明白了，我已经从这段信息里梳理出${[...new Set(answeredFields.map((field) => fieldNames[field]).filter(Boolean))].join("、")}。` : ""
  ].filter(Boolean);
  return {
    claims: extracted,
    coreClaimOperations: extracted,
    discoveredFactOperations: factOperations,
    answerAssessment: { status: answeredFields.length || factOperations.length ? "partially_answered" : "ambiguous", answeredFieldPaths: answeredFields, remainingGaps: [] },
    acknowledgement: acknowledgementParts.join(" "),
    conflicts: [],
    missingCriticalFields: [],
    nextQuestionRecommendation: "",
    questionGoal: "补齐会影响下游策略的关键信息",
    stopReason: ""
  };
}

function unwrapAgentData(result = {}) {
  return result.data?.data || result.data || result;
}

async function generateAgentText(request, fallback) {
  if (process.env.FLOWSOCIAL_TEST_MODE === "1") return { mode: "validated_fallback", data: fallback, warning: "isolated test mode" };
  try {
    return await generateText(request, fallback);
  } catch (error) {
    return { mode: "validated_fallback", data: fallback, warning: error.message };
  }
}

const documentStrategyFields = new Set(["business.businessModel", "business.primaryOffers", "audiences.primary", "business.conversionPath", "accountStrategy.growthStage", "accountStrategy.primaryGoal", "accountStrategy.platformRoles", "accountStrategy.contentResources", "accountStrategy.constraints"]);

function normalizeEvidenceProfile(value = {}, current = {}, knowledgeAssetId = null) {
  const merged={ ...(current&&typeof current==="object"?current:{}),...(value&&typeof value==="object"?value:{}) };
  const evidenceKeys=["cases","data","sops","productMaterials","companyMaterials","businessExperience","experience","faq","templates","images"];
  const resourceTypes=evidenceKeys.filter((key)=>Array.isArray(merged[key])?merged[key].length:Boolean(merged[key]));
  const knowledgeAssetIds=[...new Set([...(current?.knowledgeAssetIds||[]),...(merged.knowledgeAssetIds||[]),...(knowledgeAssetId?[knowledgeAssetId]:[])])];
  return { ...merged,resourceTypes:[...new Set([...(merged.resourceTypes||[]),...resourceTypes])],resourceLocations:[...new Set([...(merged.resourceLocations||[]),...knowledgeAssetIds])],knowledgeAssetIds,evidenceQuality:merged.evidenceQuality||(resourceTypes.some((key)=>["cases","data","sops"].includes(key))?"已有可核验的案例、数据或流程资料":"已有基础业务资料"),resourceGaps:Array.isArray(merged.resourceGaps)?merged.resourceGaps:[],publicUsage:merged.publicUsage||"unknown" };
}

function buildDocumentCandidateFallback(extracted, purpose = "understand_business") {
  const text = [extracted.summary, ...(extracted.citations || []).map((item) => item.excerpt)].join("\n");
  const evidence = (extracted.citations || []).slice(0, 2);
  const candidates = [...(extracted.candidates || []).map((item) => ({ ...item, candidateType: "field", targetKey: item.targetFieldPath, confidence: 0.75, evidence }))];
  const push = (targetFieldPath, value, confidence = 0.72) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    candidates.push({ candidateType: "field", targetFieldPath, targetKey: targetFieldPath, value, confidence, evidence });
  };
  const offers = [...new Set(["企业知识库", "AI员工", "定制智能体", "AI工作流", "SaaS帮助中心", "智能搜索", "海外仓", "跨境物流", "供应链解决方案", "数字化营销", "营销运营", "全链路供应链服务"].filter((term) => text.includes(term)))];
  const serviceMatch = text.match(/(?:提供|主营|核心业务(?:包括|是)?)[：:]?([^。；\n]{3,100})/);
  if (!offers.length && serviceMatch?.[1]) offers.push(serviceMatch[1].trim());
  push("business.primaryOffers", offers, 0.82);
  const models = [text.includes("SaaS") ? "SaaS订阅" : "", /私有化|本地部署/.test(text) ? "私有化部署" : "", /项目制|定制交付/.test(text) ? "项目制交付" : ""].filter(Boolean);
  push("business.businessModel", models.join("＋"), 0.76);
  const audienceMatch = text.match(/(?:主要客户|目标客户|面向|服务于|专注于为)(?:是|为|包括)?([^。；\n]{3,100}?)(?:提供|，|。|；|\n)/);
  push("audiences.primary", audienceMatch?.[1]?.split(/[、，,及和]/).map((item) => item.trim()).filter(Boolean), 0.68);
  const conversionMatch = text.match(/(?:转化路径|成交路径|销售流程|从内容到成交)(?:是|为|包括)?[：:]?([^。；\n]{3,140})/);
  push("business.conversionPath", conversionMatch?.[1]?.trim(), 0.72);
  const goalMatch = text.match(/(?:内容目标|账号目标|主要目标|希望通过[^。]{0,30})(?:是|为|包括)?[：:]?([^。；\n]{3,120})/);
  push("accountStrategy.primaryGoal", goalMatch?.[1]?.trim(), 0.66);
  const constraintLines = [...new Set(text.split(/[。；\n]/).filter((line) => /不能|不得|禁止|必须有来源|脱敏|授权|公开边界|合规要求|合规限制|需遵守|避免/.test(line)).map((line) => line.trim()).filter(Boolean))].slice(0, 8);
  push("accountStrategy.constraints", constraintLines, 0.79);
  return { summary: extracted.summary, purpose, candidateClaims: candidates };
}

async function extractDocumentStrategyCandidates(extracted, { purpose, pendingQuestion, claims }) {
  const fallback = buildDocumentCandidateFallback(extracted, purpose);
  if (purpose === "reference_only") return fallback;
  const generated = await generateAgentText({
    task: "extract_document_strategy_candidates",
    contract: "DocumentDiagnosticExtraction@1.0",
    purpose,
    document: { name: extracted.file?.name, summary: extracted.summary, citations: extracted.citations || [] },
    pendingQuestion,
    existingClaims: claims,
    allowedFieldPaths: [...documentStrategyFields],
    rules: ["只提取文件中明确出现的信息，不补猜", "每条候选必须附带原文证据", "文件内容先作为候选，只有用户确认后才能写入策略骨架", "输出candidateClaims数组，每项包含targetFieldPath、value、confidence、evidence"]
  }, fallback);
  const raw = unwrapAgentData(generated);
  const source = Array.isArray(raw.candidateClaims) ? raw.candidateClaims : fallback.candidateClaims;
  const normalized = source.filter((item) => documentStrategyFields.has(item.targetFieldPath) && item.value != null).map((item) => ({ candidateType: "field", targetFieldPath: item.targetFieldPath, targetKey: item.targetFieldPath, value: item.value, confidence: Math.min(1, Math.max(0.3, Number(item.confidence) || 0.7)), evidence: Array.isArray(item.evidence) ? item.evidence : extracted.citations || [] }));
  const resource = fallback.candidateClaims.find((item) => item.targetFieldPath === "accountStrategy.contentResources");
  if (resource && !normalized.some((item) => item.targetFieldPath === resource.targetFieldPath)) normalized.push(resource);
  const unique = [...new Map(normalized.map((item) => [item.targetFieldPath, item])).values()];
  return { summary: String(raw.summary || fallback.summary || ""), purpose, candidateClaims: unique, mode: generated.mode, warning: generated.warning || null };
}

function formatNaturalListItem(item, index) {
  if (typeof item === "string") return `${index + 1}. ${item}`;
  if (!item || typeof item !== "object") return `${index + 1}. ${String(item || "")}`;
  const title = item.title || item.item || item.label || `第 ${index + 1} 项`;
  const description = item.description || item.question || item.summary || "";
  const hint = item.hint || item.suggestion || item.example || "";
  return `${index + 1}. ${title}${description ? `\n   ${description}` : ""}${hint ? `\n   参考：${hint}` : ""}`;
}

function buildEnrichmentAssistanceFallback({ intent, question, claims = [], facts = [] }) {
  const subject = question?.content || "当前补充问题";
  const key = question?.targetFactKey || "enrichment.context";
  const spec = getTargetSpec("dynamic_fact", question?.category || key);
  const dimensions = (spec?.slots || []).map((item)=>item.label).slice(0,6);
  const relevance = question?.relevance || {};
  const downstreamText = Array.isArray(relevance.downstreamUse) && relevance.downstreamUse.length ? relevance.downstreamUse.join("、") : "选题和内容表达";
  const recommendations = {
    "operations.publishing_cadence": "如果目前有专人运营，起步阶段可以先采用每周3篇小红书、每周1篇公众号；每两周复盘一次，再按表现调整。",
    "audience.pain_points": "先从销售和客服最近一个月反复遇到的问题中整理5条，再按发生频率和商业价值排序。",
    "audience.common_objections": "建议分别整理价格、时效、服务边界、系统能力和风险保障五类顾虑，并记录销售目前怎样回应。",
    "evidence.available_cases": "先整理3个脱敏案例：客户背景、问题、采取的动作、结果和可公开边界，不要求一开始就公开客户名称。",
    "sales.lead_qualification": "建议把有效线索定义为具备明确市场、业务量级、服务需求、预计启动时间和可联系决策人的咨询。",
    "brand.voice_preferences": "企业服务账号可以优先采用专业、务实、具体的表达，少用口号，多用场景、流程和可验证依据。",
    "market.priority_regions": "建议优先选择当前交付能力最成熟、案例最多且近期销售重点最明确的1—2个市场。"
  };
  if (intent === "request_clarification") return { assistanceType: "clarification", targetFieldPath: `fact:${key}`, assistantMessage: `这个问题与账号运营的关系是：${relevance.reason || "它能减少后续策略和内容生成中的猜测"}。答案主要会用于${downstreamText}，不会覆盖已经确认的九项核心策略。\n\n当前想了解的是：${subject}\n\n你可以从${dimensions.join("、") || "一个最近发生的真实场景"}中选择确定的部分回答；如果当前目标不需要这类内容，也可以跳过。` };
  if (intent === "request_examples") {
    const examples = dimensions.length ? [`可以围绕“${dimensions.slice(0,3).join("、")}”描述一个最近发生的真实场景。`, `如果还没有完整资料，可以先说明“目前只确定了${dimensions.slice(-2).join("、")}，其他暂不清楚”。`] : ["可以从一个最近发生的真实场景开始描述。", "也可以先说明目前没有成体系信息，但有哪些零散经验。"];
    return { assistanceType: "examples", targetFieldPath: `fact:${key}`, examples, assistantMessage: `可以。这个问题会影响${downstreamText}。例如你可以这样回答：\n${examples.map((item,index)=>`${index+1}. ${item}`).join("\n")}\n\n示例只是回答方式，不代表你们公司的事实。` };
  }
  if (intent === "request_checklist") {
    const checklist = dimensions.length ? dimensions : ["当前真实做法", "最近遇到的具体场景", "已有资料或证据", "希望达到的结果", "暂时不确定的部分"];
    return { assistanceType: "checklist", targetFieldPath: `fact:${key}`, checklist, assistantMessage: `可以，这些信息主要用于${downstreamText}。按下面清单对照即可，不要求全部回答：\n${checklist.map((item,index)=>`${index+1}. ${item}`).join("\n")}` };
  }
  const recommendedValue = recommendations[key] || "先从一个可执行、可复盘的小方案开始，运行两周后再根据真实反馈调整。";
  return { assistanceType: "recommendation", targetFieldPath: `fact:${key}`, recommendation: { recommendedValue, rationale: ["便于快速开始并保留调整空间", "建议需要由你确认后才写入动态事实库"], alternatives: [] }, assistantMessage: `可以。结合当前已确认信息，我建议：\n\n${recommendedValue}\n\n这只是建议，你可以直接采纳、调整后采纳，或者暂不采用。` };
}

const contentPurposes = {
  hotspot_industry_explainer: ["热点/行业解读", "讲清发生了什么、为什么重要，以及可能带来的影响"],
  knowledge_howto: ["知识干货分享", "提供方法、步骤、清单、工具或避坑建议"],
  professional_opinion: ["专业观点表达", "给出有依据的判断、分析和立场"],
  product_service_promotion: ["产品/服务推广", "介绍产品服务解决的问题、适用场景和价值"],
  case_result_showcase: ["案例/成果展示", "用真实案例、过程或成果证明专业能力"],
  brand_story: ["品牌形象宣传", "展示公司理念、团队、故事或品牌动态"],
  interactive_discussion: ["互动话题讨论", "通过问题、争议或共鸣点吸引用户参与"],
  event_announcement: ["活动/信息发布", "发布活动、直播、课程、报告、招聘或更新"]
};

function buildContentIntentProfile(payload, knowledge, knowledgeSnapshotId = null) {
  const purpose = contentPurposes[payload.contentPurposeId];
  const promotionMode = payload.promotionMode || "none";
  const executionIntent = payload.contentExecutionContext?.contentIntentProfile || {};
  const directionCard = payload.contentExecutionContext?.directionCard || payload.contentDirectionCard || {};
  return {
    profile_id: id("intent"),
    topic_id: payload.topicId || payload.ideaSelectionId || null,
    platform: payload.platform || "xiaohongshu",
    purpose: { id: payload.contentPurposeId, label: purpose[0], description: purpose[1] },
    promotion: {
      mode: promotionMode,
      knowledge_enabled: knowledge.length > 0,
      knowledge_asset_ids: knowledge.map((item) => item.id),
      knowledge_snapshot_id: knowledgeSnapshotId,
      insertion_rule: promotionMode === "focused" ? "promotion_is_primary" : promotionMode === "soft" ? "value_first_natural_context" : "do_not_mention"
    },
    engagement_policy: {
      mode: "auto",
      optimize_for: ["open", "finish", "save", "share", "comment", "follow", "conversion"],
      selected_primary_action: payload.primaryInteraction && payload.primaryInteraction !== "model_selected" ? payload.primaryInteraction : "model_selected",
      selection_rule: "模型根据内容目的、平台、正文价值和转化阶段只选择一个主要动作"
    },
    strategy_alignment: {
      content_function: directionCard.contentFunction || executionIntent.contentFunction || null,
      conversion_stage: directionCard.conversionStage || executionIntent.conversionStage || null,
      evidence_requirement: directionCard.evidenceRequirement || executionIntent.evidenceRequirement || null,
      purpose_eligible: executionIntent.purposeEligibility?.eligible ?? payload.purposePolicy?.allowedByStrategy ?? null,
      eligible_purpose_ids: executionIntent.purposeEligibility?.eligiblePurposeIds || [],
      user_override_applied: executionIntent.selectedBy === "user" || payload.purposePolicy?.selectedBy === "user",
      rule: "用户本篇选择优先；长期策略用于提示与约束，不替代用户选择"
    },
    source: { type: "user_selection", selected_at: new Date().toISOString(), ui_version: "content-purpose-v2" }
  };
}

function hasExplicitXhsPageReference(instruction) {
  return /第\s*\d+(?:\s*[、,，/和及]\s*\d+)*\s*页|(?:^|\W)P\s*\d+(?:\s*[、,，/和及]\s*P?\s*\d+)*/iu.test(String(instruction || ""));
}

function hasClaimSubject(instruction) {
  return /数据|事实|案例|例子|产品能力|价格|活动时间|百分比|source|evidence|\d+(?:\.\d+)?\s*(?:%|元|万元|倍)/i.test(String(instruction || ""));
}

function hasExistingEvidenceConstraint(instruction) {
  const value = String(instruction || "");
  return /(?:只|仅).{0,8}(?:使用|保留|采用|引用).{0,12}(?:既有|已有|已确认|有来源|可核验|支持这些表述|支持.{0,6}表述).{0,6}(?:事实|数据|表述|内容)?|(?:不|不得|不要|禁止).{0,4}(?:新增|添加|加入|补充|增加).{0,10}(?:输入之外|未经确认|新)?(?:的)?(?:信息|事实|数据|案例)?/.test(value);
}

function hasPositiveAction(instruction, actions) {
  const value = String(instruction || "");
  for (const match of value.matchAll(actions)) {
    const prefix = value.slice(Math.max(0, match.index - 6), match.index);
    if (!/(?:不|勿|禁止|不要|不得|严禁|避免|无需|无须|不再)\s*$/.test(prefix)) return true;
  }
  return false;
}

function isExistingClaimCleanup(instruction) {
  const value = String(instruction || "");
  const removesExisting = /删除|移除|删掉|去掉|清除|取消|剔除|不再使用/.test(value);
  const existingEvidenceOnly = hasExistingEvidenceConstraint(value) || /无来源|未授权|未经证实/.test(value);
  return removesExisting || existingEvidenceOnly;
}

function publicVisualAnalysisError(error) {
  const code = String(error?.code || "");
  if (code === "MINIMAX_VISION_KEY_MISSING") return "视觉识别服务尚未配置，请联系管理员";
  if (code.includes("REQUEST_FAILED")) return "视觉识别服务暂时不可用或当前额度不足，请稍后重试";
  if (code.includes("RESPONSE_INVALID")) return "识别结果格式异常，本次结果未保存，请重新识别";
  if (code.includes("IMAGE_TOO_LARGE")) return "图片文件过大，请压缩到 20MB 以内后重试";
  if (code.includes("FORMAT_UNSUPPORTED")) return "图片格式不受支持，请上传 PNG、JPG 或 WebP";
  return String(error?.message || "品牌风格识别失败，请稍后重试");
}

export function adoptCycleWorkbenchSlotToUnifiedProject(store, cycleId, slotId, {
  actor = "workspace_user",
  at = new Date().toISOString(),
  flags = featureFlags()
} = {}) {
  if (!flags.unifiedContentPrerequisitesV1 || !flags.unifiedContentStagedAtomicDualBootstrapV1) {
    throw Object.assign(new Error("统一双平台内容生产尚未启用"), { code: "UNIFIED_CONTENT_ADOPTION_DISABLED", statusCode: 404 });
  }
  const plan = ensureCycleWorkbenchPlans(store).find((item) => item.cycleId === cycleId);
  const slot = plan?.slots?.find((item) => item.slotId === slotId);
  if (!plan || !slot) throw Object.assign(new Error("周期槽位不存在"), { code: "PUBLISHING_CYCLE_SLOT_NOT_FOUND", statusCode: 404 });
  if (plan.workbenchStatus !== "active" || plan.status !== "active" || slot.zone !== "committed") {
    throw Object.assign(new Error("请先确认本周期，再采用承诺区内容"), { code: "PUBLISHING_CYCLE_ADOPTION_CONFIRMATION_REQUIRED", statusCode: 409 });
  }
  const activeStrategy = getActiveStrategySnapshot(plan.companyId);
  if (!activeStrategy || activeStrategy.id !== plan.strategySnapshotId) {
    throw Object.assign(new Error("活动策略已变化，请重新生成周期计划"), { code: "PUBLISHING_CYCLE_STRATEGY_STALE", statusCode: 409 });
  }
  const availableAccounts = companySocialAccounts(store, plan.companyId).filter((item) => item.status !== "archived");
  const slotAccount = availableAccounts.find((item) => item.id === slot.socialAccountId);
  if (!slotAccount || slotAccount.platform !== slot.platform) {
    throw Object.assign(new Error("排期绑定的账号已经不可用"), { code: "PUBLISHING_CYCLE_ACCOUNT_STALE", statusCode: 409 });
  }
  const strategyDocument = activeStrategy.document || activeStrategy.payload || {};
  const portfolio = strategyDocument?.strategyExtensions?.accountPortfolio || {};
  const selectedIds = new Set([
    ...(portfolio.selectedSocialAccountIds || []),
    ...(portfolio.selectedAccountIds || []),
    ...(strategyDocument?.strategyExtensions?.accountGrowthStrategies || []).map((item) => item.socialAccountId)
  ].filter(Boolean));
  const eligible = availableAccounts.filter((item) => !selectedIds.size || selectedIds.has(item.id));
  const resolvePlatformAccount = (platform) => {
    if (slotAccount.platform === platform) return slotAccount;
    const matches = eligible.filter((item) => item.platform === platform);
    if (matches.length !== 1) {
      throw Object.assign(new Error(`请先在策略中明确唯一的${platform === "wechat" ? "公众号" : "小红书"}账号`), {
        code: "UNIFIED_CONTENT_PLATFORM_ACCOUNT_SELECTION_REQUIRED",
        statusCode: 409,
        details: matches.map((item) => ({ id: item.id, name: item.name, platform: item.platform }))
      });
    }
    return matches[0];
  };
  const xhs = resolvePlatformAccount("xiaohongshu");
  const wechat = resolvePlatformAccount("wechat");
  const idempotencyKey = `cycle-adoption:${cycleId}:${slotId}:${plan.strategySnapshotId}`;
  const priorOptions = listUnifiedContentPrerequisites(store, { companyId: plan.companyId }).entryOptions || [];
  const exactExisting = priorOptions.filter((entry) => entry.prerequisiteRef?.id === idempotencyKey);
  if (exactExisting.length > 1) throw Object.assign(new Error("该排期对应多个权威输入，请先对账"), { code: "UNIFIED_CONTENT_ADOPTION_AMBIGUOUS", statusCode: 409 });
  let entry = exactExisting[0] || null;
  let prerequisite = null;
  const normalizedSlotTopic = normalizePlanningTopic(slot.topic, {
    contentFunction: slot.contentFunction,
    contentPillar: slot.contentPillarId || slot.contentPillar
  });
  if (!entry) {
    const topic = normalizedSlotTopic;
    const contentObjective = formatContentLearningObjective(slot.objective || slot.contentFunction, slot.contentLearningInstruction);
    // The same confirmed strategy direction may legitimately appear once in
    // each platform schedule. Reuse its immutable authority input instead of
    // treating the second platform's adoption as a semantic collision; each
    // slot still receives an independent project/version identity below.
    const semanticExisting = priorOptions.filter((item) => item.topicIntent?.topic === topic
      && (item.topicIntent?.contentObjective || item.topicIntent?.objective) === contentObjective
      && item.activeStrategySnapshotRef?.id === plan.strategySnapshotId
      && (item.accounts?.xiaohongshu?.id || item.accounts?.xiaohongshu) === xhs.id
      && (item.accounts?.wechat?.id || item.accounts?.wechat) === wechat.id);
    if (semanticExisting.length > 1) throw Object.assign(new Error("同一内容方向存在多个权威输入，请先对账"), { code: "UNIFIED_CONTENT_ADOPTION_SEMANTIC_AMBIGUOUS", statusCode: 409 });
    entry = semanticExisting[0] || null;
  }
  if (!entry) {
    try {
      prerequisite = createUnifiedContentPrerequisites(store, {
        companyId: plan.companyId,
        xiaohongshuAccountId: xhs.id,
        wechatAccountId: wechat.id,
        topic: normalizedSlotTopic,
        contentObjective: formatContentLearningObjective(slot.objective || slot.contentFunction, slot.contentLearningInstruction),
        hotspotEvaluation: { status: "not_available", candidateRefs: [], reason: "cycle_slot_uses_confirmed_strategy_direction", factPolicy: "external_event_not_business_fact" },
        idempotencyKey
      }, { canonicalActiveStrategy: activeStrategy, nativeMechanismDecisionV2: true, now: at });
    } catch (error) {
      if (["UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED", "UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_NOT_FOUND", "UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED"].includes(error.code || error.message)) {
        throw Object.assign(new Error("小红书账号还没有已确认的视觉规范，请先到“账号与设置”完成视觉规范确认，再采用这个排期"), {
          code: "UNIFIED_CONTENT_DESIGN_DNA_REQUIRED",
          statusCode: 409
        });
      }
      throw error;
    }
    entry = (listUnifiedContentPrerequisites(store, { companyId: plan.companyId }).entryOptions || [])
      .find((item) => item.prerequisiteRef?.id === idempotencyKey) || null;
  }
  if (!entry) throw Object.assign(new Error("已建立权威输入，但无法定位内容项目入口"), { code: "UNIFIED_CONTENT_ADOPTION_ENTRY_MISSING", statusCode: 500 });
  const projectId = slot.unifiedProjectId || `unified_project_${createHash("sha256").update(`${cycleId}:${slotId}:${plan.strategySnapshotId}`).digest("hex").slice(0, 24)}`;
  const changed = slot.unifiedProjectId !== projectId || slot.unifiedProductionEntryId !== entry.id;
  slot.unifiedProjectId = projectId;
  slot.unifiedProductionEntryId = entry.id;
  slot.adoptedAt ||= at;
  slot.adoptedBy ||= actor;
  if (changed) {
    plan.slotEvents ||= [];
    plan.slotEvents.push({ type: "unified_content_project_adopted", slotId, projectId, productionEntryId: entry.id, actor, at });
    plan.updatedAt = at;
  }
  return { created: Boolean(prerequisite?.created), changed, projectId, entry, plan, slot };
}

function hasClaimPreservationConstraint(instruction) {
  const value = String(instruction || "");
  return /(?:事实|数据|案例|引用|证据).{0,20}(?:保持|维持).{0,4}(?:不变|原样)|(?:不|不要|不得|无需).{0,4}(?:修改|改变|调整).{0,10}(?:事实|数据|案例|引用|证据)/.test(value);
}

function requestsCardTextChange(instruction) {
  const value = String(instruction || "");
  return /(?:修改|调整|改写|压缩|扩写|改成|改为|替换).{0,10}卡片|卡片.{0,10}(?:修改|调整|改写|压缩|扩写|改成|改为|替换)/.test(value);
}

function requestsNewClaim(instruction) {
  const value = String(instruction || "");
  const existingEvidenceOnly = hasExistingEvidenceConstraint(value);
  const additive = hasPositiveAction(value, /新增|添加|加入|补充|引入|增加/g) && hasClaimSubject(value);
  const explicitlyUnconfirmed = hasPositiveAction(value, /新增|添加|加入|补充|引入|改成|改为|替换成|替换为|更新为/g) && /未经确认|未经证实|未授权|新事实|新数据|新案例|新价格|新活动时间/.test(value);
  const replacement = /改成|改为|替换成|替换为|更新为/.test(value) && hasClaimSubject(value) && !existingEvidenceOnly;
  return additive || explicitlyUnconfirmed || replacement;
}

export function classifyRevision(instruction, platform) {
  const explicitPage = platform === "xiaohongshu" && hasExplicitXhsPageReference(instruction);
  if (/选题|主题方向/.test(instruction)) return { requestClass: "topic", executionMode: "rerun_upstream", rerunPlan: ["platform_topic", "content_intent", "content_master", "platform_writer"] };
  if (/内容目的/.test(instruction) || !explicitPage && /改成.*(干货|解读|观点|推广|案例|品牌|互动|活动)/.test(instruction)) return { requestClass: "purpose", executionMode: "rerun_upstream", rerunPlan: ["content_intent", "content_master", "platform_writer"] };
  if (/营销|推广|产品.*(多|少)|减少.*产品|加强.*产品/.test(instruction)) return { requestClass: "promotion", executionMode: "rerun_upstream", rerunPlan: ["content_intent", "content_master", "platform_writer"] };
  if (/图片|封面|配图|视觉|image_spec|visual/i.test(instruction)) return { requestClass: "image_spec", executionMode: "scoped_regeneration", rerunPlan: ["imagegen", "renderer", platform === "wechat" ? "wechat_review" : "xhs_review"] };
  if (explicitPage && !requestsNewClaim(instruction) && (!hasClaimSubject(instruction) || isExistingClaimCleanup(instruction))) {
    return { requestClass: "page_text", executionMode: "local_patch", rerunPlan: ["renderer", "xhs_review"] };
  }
  if (hasClaimSubject(instruction) && !(hasClaimPreservationConstraint(instruction) && !requestsNewClaim(instruction))) {
    return { requestClass: "claim", executionMode: "rerun_upstream", rerunPlan: ["knowledge_or_evidence", "content_master", "platform_writer"] };
  }
  if (explicitPage || requestsCardTextChange(instruction)) return { requestClass: "page_text", executionMode: "local_patch", rerunPlan: ["renderer", "xhs_review"] };
  return { requestClass: "copy", executionMode: "local_patch", rerunPlan: ["platform_writer", platform === "wechat" ? "wechat_review" : "xhs_review"] };
}

async function generateStrategyDraftForRequest(sessionId, requestId) {
  const session=getDiagnosticSession(sessionId);
  if(!session)throw Object.assign(new Error("Diagnostic session not found"),{statusCode:404,code:"DIAGNOSTIC_SESSION_NOT_FOUND"});
  try {
    const runtimeStore=ensureWorkspaceContext(readStore());
    const claims=listCurrentProfileClaims(session.id);
    const readiness=currentStrategyReadiness(session);
    const account=(runtimeStore.accounts||[]).find((item)=>item.id===session.accountId);
    if(!account)throw Object.assign(new Error("诊断绑定的公司账号不存在"),{statusCode:409,code:"STRATEGY_ACCOUNT_MISSING"});
    if(!readiness.canGenerateDraft)throw Object.assign(new Error("当前信息还不足以生成策略草案，请先完成并确认账号与增长策略"),{statusCode:409,code:"DRAFT_NOT_READY",details:readiness.blockingIssues});
    const sessionMeta=getDiagnosticSessionMeta(session.id);
    const sessionContext=getDiagnosticSessionContext(session.id);
    const learningSignals=strategyLearningSignals(runtimeStore,session.accountId);
    const draftFactSnapshot=saveSessionFactSnapshot(session.accountId,session.id);
    const knowledgeEvidenceRequest=buildStrategyEvidenceRequest({claims});
    const strategyKnowledgeFolderIds=listKnowledgeFolders({companyId:session.accountId}).map((folder)=>folder.id);
    const strategyKnowledgeResults=knowledgeEvidenceRequest.queries.map((query)=>({queryId:query.id,...searchKnowledge({query:query.query,folderIds:strategyKnowledgeFolderIds,limit:4,companyId:session.accountId})}));
    const retrievedKnowledgeEvidence=normalizeRetrievedStrategyEvidence(knowledgeEvidenceRequest,strategyKnowledgeResults);
    const strategyBundleInput={
      account:{id:account.id,name:account.name,platform:account.platform||null},
      claims,
      facts:listSessionProfileFacts(session.accountId,session.id),
      knowledgeCandidates:listDiagnosticDocumentCandidates(session.id),
      retrievedKnowledgeEvidence,
      knowledgeEvidenceRequest,
      historicalContext:sessionContext?.restartMode==="update"?listHistoricalProfileFacts(session.accountId,session.id):[],
      performanceSignals:learningSignals.performanceSignals,
      referencePatterns:learningSignals.referencePatterns,
      coverageSnapshot:buildCoverageSnapshot(listDiagnosticCoverageStates(session.id).filter((item)=>item.targetType==="core_field"),listDiagnosticCoverageStates(session.id).filter((item)=>item.targetType==="dynamic_fact")),
      factSnapshotId:draftFactSnapshot.id,
      claimRevision:sessionMeta?.claimRevision||0,
      factRevision:sessionMeta?.factRevision||0
    };
    const decisionRecord=getStrategyDecisionRecord(session.id);
    const strategyDecisions={...decisionRecord.selection,decisionRevision:decisionRecord.revision,decisionHash:decisionRecord.decisionHash||null};
    const strategyInputBundle=assembleStrategyInputBundle({...strategyBundleInput,strategyDecisions});
    const fallback=createStrategyDocumentV2({accountId:session.accountId,claims,strategyInputBundle,suggestion:{}});
    const generated=await executeSkill({skillName:"synthesize-account-strategy",input:buildStrategySynthesisRequest({accountId:session.accountId,claims,account:{id:account.id,name:account.name},strategyInputBundle}),generateText:generateAgentText,fallback,expectedContract:"StrategyDocument@2.0",task:"synthesize_account_strategy"});
    const draft=createStrategyDocumentV2({accountId:session.accountId,claims,strategyInputBundle,suggestion:unwrapAgentData(generated)});
    const repaired=repairGeneratedStrategyDocument({candidate:draft,fallback});
    const safeDraft=repaired.document;
    const providerMode=repaired.mode==="none"?generated.mode:`${generated.mode}_with_${repaired.mode}`;
    const semanticGate=validateStrategyDocumentSemantics({document:safeDraft,claims,strategyInputBundle,providerMode});
    const safeValidation={...repaired.validation,repairTrace:repaired.repairTrace,semanticGate,activationAllowed:semanticGate.activationAllowed,handoffAllowed:semanticGate.handoffAllowed,contextHash:strategyInputBundle.contextHash,contextVersion:strategyInputBundle.contextVersion};
    if(!safeValidation.valid)throw Object.assign(new Error("策略草案在字段修复后仍未通过完整合同校验"),{statusCode:422,code:"STRATEGY_DRAFT_INVALID",details:safeValidation.errors});
    const cached=saveStrategyDraftCache({sessionId:session.id,accountId:session.accountId,draft:safeDraft,validation:safeValidation,providerMode});
    const revision=saveStrategyDraftRevision({sessionId:session.id,accountId:session.accountId,draft:safeDraft,validation:safeValidation,providerMode:cached.providerMode});
    const response={draft:safeDraft,draftRevision:revision,validation:safeValidation,readiness:currentStrategyReadiness(session),providerMode:cached.providerMode,strategyDecisions,strategyDecisionRevision:decisionRecord.revision,strategyInputSummary:{contextHash:strategyInputBundle.contextHash,contextVersion:strategyInputBundle.contextVersion,coreClaimCount:strategyInputBundle.coreClaims.length,dynamicFactCount:Object.values(strategyInputBundle.dynamicFacts).flat().length,knowledgeEvidenceCount:strategyInputBundle.knowledgeEvidence.length,retrievedKnowledgeEvidenceCount:strategyInputBundle.retrievedKnowledgeEvidence.length,knowledgeEvidenceQueryCount:knowledgeEvidenceRequest.queries.length,performanceSignalCount:strategyInputBundle.performanceSignals.length,referencePatternCount:strategyInputBundle.referencePatterns.length},account:{id:account.id,name:account.name}};
    const draftRequest=updateStrategyDraftRequest({requestId,sessionId:session.id,status:"succeeded",draftRevisionId:revision.id});
    return {...response,draftRequest};
  } catch(error) {
    updateStrategyDraftRequest({requestId,sessionId,status:"failed",errorCode:error.code||"STRATEGY_DRAFT_REQUEST_FAILED",errorMessage:error.message});
    throw error;
  }
}

function atomicPublicationUiError(code, message, statusCode = 409) {
  throw Object.assign(new Error(message || code), { code, statusCode });
}

function resolveAtomicPublicationUiScope(store, scoped, flags) {
  if (!flags.atomicPublicationFeedbackUiCutoverV1) atomicPublicationUiError("ATOMIC_PUBLICATION_UI_CUTOVER_DISABLED", "Atomic publication UI cutover is disabled", 404);
  if (!flags.atomicManualPublicationV1 || !flags.atomicExactFeedbackV1 || !flags.atomicPublicationLifecycleV1) {
    atomicPublicationUiError("ATOMIC_PUBLICATION_UI_PREREQUISITES_REQUIRED", "Atomic publication, feedback and lifecycle flags must all be enabled");
  }
  const platform = scoped.platform;
  if (!["xiaohongshu", "wechat"].includes(platform)) atomicPublicationUiError("ATOMIC_PUBLICATION_UI_PLATFORM_INVALID", "Unsupported publication platform", 400);
  const product = getUnifiedContentProductSnapshot(store, scoped.projectId, { featureFlags: flags });
  if (!product) atomicPublicationUiError("ATOMIC_PUBLICATION_UI_PROJECT_NOT_FOUND", "Atomic content project not found", 404);
  if (scoped.companyId && scoped.companyId !== product.companyId) {
    atomicPublicationUiError("ATOMIC_PUBLICATION_UI_SCOPE_MISMATCH", "Project ownership does not match the selected scope", 403);
  }
  const source = platform === "wechat" ? (store.unifiedAtomicWechatDeliveries || []) : (store.unifiedAtomicXhsDeliveries || []);
  if (!Array.isArray(source)) atomicPublicationUiError("ATOMIC_PUBLICATION_UI_DELIVERY_STORE_INVALID", "Atomic delivery store is invalid");
  const deliveries = source.filter((item) => item?.platform === platform || (platform === "xiaohongshu" && item?.contract === "AtomicXhsFinalDeliveryRecord@1.0"))
    .filter((item) => item?.materializedContentProjectRef?.id === product.id
      && item?.companyId === product.companyId
      && (!scoped.accountId || item?.accountId === scoped.accountId)
      && (!scoped.candidateId || (item.candidateRef || item.articleRef)?.id === scoped.candidateId));
  if (deliveries.length !== 1) atomicPublicationUiError("ATOMIC_PUBLICATION_UI_EXACT_DELIVERY_REQUIRED", "Exactly one current Atomic final delivery is required");
  const delivery = deliveries[0];
  const promotedVersion = (store.contentVersions || []).find((item) => item?.id === delivery.promotedVersionRef?.id
    && (item.versionHash || item.factHash) === delivery.promotedVersionRef?.hash);
  if (!promotedVersion) atomicPublicationUiError("ATOMIC_PUBLICATION_UI_EXACT_VERSION_REQUIRED", "Exact immutable promoted version is required");
  const request = {
    workspaceId: delivery.workspaceId, companyId: delivery.companyId, accountId: delivery.accountId,
    projectId: product.id, platform, contentProjectRef: delivery.contentProjectRef,
    materializedContentProjectRef: delivery.materializedContentProjectRef, commitRef: delivery.commitRef || promotedVersion.commitRef,
    platformRunRef: delivery.platformRunRef, promotionRef: delivery.promotionRef,
    promotedVersionRef: delivery.promotedVersionRef,
    deliveryRef: { id: delivery.id, hash: platform === "wechat" ? delivery.factHash : delivery.deliveryHash },
    manifestRef: delivery.manifestRef,
    ...(platform === "wechat"
      ? { articleRef: delivery.articleRef, uploadEvidenceRef: delivery.uploadEvidenceRef, postUploadRef: delivery.postUploadRef }
      : { candidateRef: delivery.candidateRef })
  };
  const existingPublications = (store.unifiedAtomicManualPublications || []).filter((item) => item?.platform === platform
    && item?.accountId === delivery.accountId && item?.deliveryRef?.id === request.deliveryRef.id && item?.deliveryRef?.hash === request.deliveryRef.hash);
  existingPublications.forEach((item) => validateControlledManualPublicationClosure(store, item, { featureFlags: flags }));
  const preflight = previewAtomicManualPublication(store, request, { featureFlags: flags, requireCurrent: existingPublications.length === 0 });
  return { product, delivery, request: preflight.request, preflight, publication: existingPublications.at(-1) || null };
}

function projectAtomicPublicationUiState(store, scoped, flags) {
  const context = resolveAtomicPublicationUiScope(store, scoped, flags);
  let publication = context.publication;
  let feedback = null;
  let lifecycle = null;
  if (publication) {
    const exact = {
      workspaceId: publication.workspaceId, companyId: publication.companyId, accountId: publication.accountId,
      projectId: publication.contentProjectRef.id, platform: publication.platform,
      publicationRef: { id: publication.id, hash: publication.factHash },
      platformContentId: publication.canonicalPlatformContentId, platformUrl: publication.canonicalPlatformUrl
    };
    feedback = projectAtomicPublicationFeedback(store, exact, { featureFlags: flags });
    lifecycle = projectAtomicPublicationLifecycle(store, exact, { featureFlags: flags });
  }
  return {
    schemaVersion: "1.0", contract: "AtomicPublicationFeedbackUiState@1.0",
    platform: scoped.platform, exactRequest: context.request,
    exactRefs: Object.fromEntries(Object.entries(context.request).filter(([key]) => key === "commitRef" || key.endsWith("Ref"))),
    states: {
      resourceUploaded: scoped.platform === "wechat" ? true : null,
      deliveryReady: true,
      humanPublicationConfirmed: Boolean(publication),
      everPublished: lifecycle?.everPublished ?? Boolean(publication),
      currentPlatformState: lifecycle?.currentPlatformState || (publication ? "available" : "not_confirmed"),
      currentlyAvailable: lifecycle?.currentlyAvailable ?? (publication ? true : null),
      feedbackMaturity: feedback?.maturity || "not_started"
    },
    publication, feedback, lifecycle,
    claims: { readOnly: true, platformActionPerformed: false, activeDatabaseWritePerformed: false }
  };
}

async function api(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" });
    return res.end();
  }

  // Route parameters are encoded by the browser/API client.  Decode the path
  // once at the HTTP boundary so immutable revision identities such as
  // `project:revision:bootstrap` resolve consistently across every downstream
  // production endpoint (design, provider execution, review and delivery).
  const path = decodeURIComponent(url.pathname).replace(/^\/api\/v1/, "");
  if (path === "/images/generate") return sendJson(res, 410, {
    error: "Ungoverned image generation has been removed; use the approved atomic XHS provider execution flow",
    code: "UNGOVERNED_IMAGE_GENERATION_REMOVED",
    replacement: "/api/v1/unified-content-projects/{projectId}/platforms/xiaohongshu/provider-executions",
    requiredGates: ["exact content version", "provider plan", "human approval", "call and credit budget"]
  });
  if (req.method === "POST" && /^\/content-tasks\/[^/]+\/(?:revise|assets\/generate|visual-candidates\/[^/]+\/retry)$/.test(path)) return sendJson(res, 410, {
    error: "Legacy paid content mutation has been removed; use immutable atomic content successors or approved XHS image execution",
    code: "LEGACY_PAID_CONTENT_GENERATION_REMOVED",
    replacement: path.endsWith("/revise") ? "/api/v1/content-agent/runs" : "/api/v1/unified-content-projects/{projectId}/platforms/xiaohongshu/provider-executions",
    imageRevision: "/api/v1/unified-content-projects/{projectId}/platforms/xiaohongshu/light-revision-plans",
    requiredGates: ["exact content version", "provider plan", "human approval", "call and credit budget"]
  });
  if (handleRetiredContentRunRoute({ req, res, path, sendJson })) return;

  const store = ensureWorkspaceContext(readStore());
  ensureHotspotState(store);
  ensureReferenceLibraries(store);
  ensureContentPatternLearning(store);
  ensureAdvancedContentLearning(store);


  if (await handleSystemRoute({
    req,
    res,
    path,
    store,
    sendJson,
    runtime: {
      sourceSignature: runtimeSourceSignature,
      loadedBuildId,
      processId: process.pid,
      serverStartedAt,
      productMode: process.env.FLOWSOCIAL_PRODUCT_MODE || "default",
      getStorageStatus,
      providerStatus,
      getSkillRuntimeStatus,
      resolveFeatureFlags: featureFlags,
      buildProductCapabilityPolicyReport: (flags) => buildProductCapabilityPolicyReport(process.env, flags),
      xhsRuntimeReadiness: unifiedXhsRuntimeReadiness,
      unifiedContentReadiness,
      now: () => new Date().toISOString()
    }
  })) return;
  if (await handleTopicAdjustmentRoute({ req, res, path, store, bodyJson, sendJson, persistStore: writeStore, generateText })) return;
  if (req.method === "GET" && path === "/diagnostics/errors") return sendJson(res, 200, { items: getRecentApiErrors(url.searchParams.get("limit")) });
  if (req.method === "GET" && path === "/workspace/context") return sendJson(res,200,{ currentUser:(store.users||[]).find((item)=>item.id===store.currentUserId)||null,workspace:store.workspaces?.[0]||null,membership:(store.workspaceMemberships||[]).find((item)=>item.userId===store.currentUserId)||null,companies:listCompanies(store).map((company)=>({ ...company,socialAccounts:strategyAccountCatalog(store,company.id) })) });
  const planningReadinessMatch=path.match(/^\/companies\/([^/]+)\/content-planning-readiness$/);
  if(req.method==="GET"&&planningReadinessMatch) return sendJson(res,200,contentPlanningReadiness(store,planningReadinessMatch[1]));
  if (req.method === "GET" && path === "/agent/damaishuzhi") {
    return sendJson(res, 200, await getAgentOverview("account_damaishuzhi"));
  }
  if (req.method === "GET" && path === "/agent/accounts") {
    const items = listCompanies(store).map((company)=>({ ...company,socialAccounts:strategyAccountCatalog(store,company.id) }));
    return sendJson(res, 200, { items });
  }
  if (req.method === "POST" && path === "/agent/accounts") {
    const payload = await bodyJson(req);
    const name = String(payload.name || "").trim();
    if (!name) return sendJson(res, 400, { error: "公司名称不能为空" });
    const duplicate = (store.accounts || []).find((item) => item.name.toLowerCase() === name.toLowerCase() && (item.accountType === "company" || item.id === "account_damaishuzhi"));
    if (duplicate) return sendJson(res, 409, { error: "已存在同名公司", account: duplicate });
    const account = { id: id("account"), workspaceId:"workspace_default",companyId:null,name, accountType: "company", platform: "多平台", businessMode: "待诊断", status: "active", contentPillars: [], createdAt: new Date().toISOString() };
    account.companyId=account.id;
    store.accounts ||= [];
    store.accounts.push(account);
    writeStore(store);
    return sendJson(res, 201, account);
  }
  const agentOverviewMatch = path.match(/^\/agent\/accounts\/([^/]+)\/overview$/);
  if (req.method === "GET" && agentOverviewMatch) {
    const overview = await getAgentOverview(agentOverviewMatch[1]);
    return overview ? sendJson(res, 200, overview) : sendJson(res, 404, { error: "Company account not found" });
  }
  const activeDiagnosticMatch = path.match(/^\/agent\/accounts\/([^/]+)\/diagnostic-session\/active$/);
  if (req.method === "GET" && activeDiagnosticMatch) {
    const session = getLatestOpenDiagnosticSession(activeDiagnosticMatch[1]);
    if (!session) return sendJson(res, 200, { session: null });
    const consistencyRepair=repairSessionConsistency(session.id);
    const claims = listCurrentProfileClaims(session.id);
    const facts = listSessionProfileFacts(session.accountId, session.id);
    const historicalFacts = listHistoricalProfileFacts(session.accountId, session.id);
    const fieldStates = listDiagnosticFieldStates(session.id);
    const draftReadiness = currentStrategyReadiness(session);
    const diagnosticProgress = evaluateDiagnosticCompleteness(claims);
    return sendJson(res, 200, {
      session,
      consistencyRepair,
      sessionMeta: getDiagnosticSessionMeta(session.id),
      turns: listDiagnosticTurns(session.id),
      claims,
      facts,
      historicalFacts,
      fieldStates,
      coverageStates: listDiagnosticCoverageStates(session.id),
      profileCoverage: buildCoverageSnapshot(listDiagnosticCoverageStates(session.id).filter((item)=>item.targetType === "core_field"),listDiagnosticCoverageStates(session.id).filter((item)=>item.targetType === "dynamic_fact")),
      recommendations: listAgentRecommendations(session.id),
      pendingRecommendation: getPendingAgentRecommendation(session.id),
      strategyDraft: getStrategyDraftCache(session.id),
      strategyDraftRevision: getLatestStrategyDraftRevision(session.id),
      strategyDecisionRecord:getStrategyDecisionRecord(session.id),
      knowledgeLinks: listDiagnosticKnowledgeFiles(session.id),
      knowledgeCandidates: listDiagnosticDocumentCandidates(session.id),
      draftReadiness,
      pendingQuestion: getPendingDiagnosticQuestion(session.id),
      pendingEnrichmentQuestion: getPendingEnrichmentQuestion(session.id),
      enrichmentQuestions: listEnrichmentQuestions(session.id),
      sessionContext: getDiagnosticSessionContext(session.id),
      strategySessionState:currentStrategySessionState(session),
      progress: { ...diagnosticProgress, ...evaluateProfileMetrics(claims, facts), readyToDraft: draftReadiness.canGenerateDraft }
      ,diagnosticSummary:diagnosticSummaryFor(session.id)
    });
  }
  if (req.method === "POST" && path === "/agent/sessions") {
    const payload = await bodyJson(req);
    const accountId = payload.accountId;
    if (!accountId || !(store.accounts || []).some((item) => item.id === accountId)) return sendJson(res, 400, { error: "请选择有效的公司账号后再开始诊断" });
    const restartAliases={update:"retain_facts",partial:"retain_core"};
    const requestedRestart=restartAliases[payload.restartMode]||payload.restartMode;
    const restartMode = ["fresh", "retain_facts", "retain_core", "retain_all"].includes(requestedRestart) ? requestedRestart : "fresh";
    const result = startDiagnostic({ accountId, mode: payload.mode || "quick", restartMode, rediagnoseFields: Array.isArray(payload.rediagnoseFields) ? payload.rediagnoseFields : [] });
    const claims = listCurrentProfileClaims(result.session.id);
    const fieldStates = listDiagnosticFieldStates(result.session.id);
    const inheritedFacts=listSessionProfileFacts(accountId,result.session.id);
    const opening = ["retain_core","retain_all"].includes(restartMode)
      ? planNextDiagnosticQuestion({ progress: evaluateDiagnosticCompleteness(claims), claims, facts: inheritedFacts, fieldStates, coverageStates:listDiagnosticCoverageStates(result.session.id),previousQuestions: [] }) || openingDiagnosticQuestion()
      : openingDiagnosticQuestion();
    createDiagnosticQuestion({ sessionId: result.session.id, ...opening });
    const restartIntro={fresh:"这次从空白诊断开始，历史策略和资料仍保留在版本记录中。",retain_facts:"已保留动态事实作为本轮参考，九项策略骨架将重新确认。",retain_core:"已带入上一轮策略骨架，接下来会继续确认尚未充分的信息。",retain_all:"已进入现有策略的迭代模式，骨架和动态事实均已带入。"}[restartMode];
    return sendJson(res, 201, { ...result, sessionMeta: getDiagnosticSessionMeta(result.session.id), openingQuestion: `${restartIntro}${opening.content}`, pendingQuestion: getPendingDiagnosticQuestion(result.session.id), fieldStates: listDiagnosticFieldStates(result.session.id), coverageStates:listDiagnosticCoverageStates(result.session.id), facts: inheritedFacts, historicalFacts: ["retain_facts","retain_all"].includes(restartMode) ? listHistoricalProfileFacts(accountId, result.session.id) : [], knowledgeLinks: [], knowledgeCandidates: [], draftReadiness: currentStrategyReadiness(result.session),strategySessionState:currentStrategySessionState(result.session),diagnosticSummary:diagnosticSummaryFor(result.session.id) });
  }
  const recommendationDecisionMatch = path.match(/^\/agent\/sessions\/([^/]+)\/recommendations\/([^/]+)\/decision$/);
  if (req.method === "POST" && recommendationDecisionMatch) {
    const payload = await bodyJson(req);
    try {
      const result=decideAgentRecommendation({ sessionId: recommendationDecisionMatch[1], recommendationId: recommendationDecisionMatch[2], action: payload.action, optionId: payload.optionId || null, modifiedValue: payload.modifiedValue ?? null });
      const session=getDiagnosticSession(recommendationDecisionMatch[1]);
      const coverageStates=listDiagnosticCoverageStates(session.id);
      return sendJson(res,200,{...result,draftReadiness:currentStrategyReadiness(session),coverageStates,profileCoverage:buildCoverageSnapshot(coverageStates.filter((x)=>x.targetType==="core_field"),coverageStates.filter((x)=>x.targetType==="dynamic_fact")),sessionContext:getDiagnosticSessionContext(session.id),diagnosticSummary:diagnosticSummaryFor(session.id)});
    } catch (error) {
      return sendJson(res, 409, { error: error.message });
    }
  }
  const diagnosticKnowledgeUploadMatch = path.match(/^\/agent\/sessions\/([^/]+)\/knowledge-files$/);
  if (req.method === "POST" && diagnosticKnowledgeUploadMatch) {
    const session = getDiagnosticSession(diagnosticKnowledgeUploadMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    if (!req.headers["content-type"]?.includes("multipart/form-data")) return sendJson(res, 415, { error: "knowledge file upload requires multipart/form-data" });
    const { fields, file: uploaded } = await multipartUpload(req);
    if (!uploaded?.name) return sendJson(res, 400, { error: "file is required" });
    const knowledgeOwnership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: session.accountId }));
    const purposeAliases = { understand_business: "extract_strategy", content_material: "knowledge_only", reference_only: "answer_current" };
    const purpose = purposeAliases[fields.purpose] || fields.purpose || "extract_strategy";
    const scope = fields.scope === "account" ? "account" : "session";
    const saveToKnowledge = scope === "account" || purpose === "knowledge_only";
    let folderId = fields.folderId;
    if (!folderId) {
      const folderName = saveToKnowledge ? "策略诊断资料" : "策略诊断临时附件";
      const existing = listKnowledgeFolders({ companyId: knowledgeOwnership.companyId, includeHidden: true }).find((item) => item.name === folderName);
      folderId = existing?.id || createKnowledgeFolder({ name: folderName, description: saveToKnowledge ? "策略 Agent 中确认保存的公司知识资料" : "仅供当前诊断使用，不进入公司知识库", icon: "▤", visibility: saveToKnowledge ? "visible" : "hidden", ...knowledgeOwnership }).id;
    }
    let file;
    try {
      file = await saveKnowledgeFile({ folderId, name: uploaded.name, mimeType: uploaded.mimeType, size: uploaded.buffer.length, tags: parseUploadTags(fields.tags).length ? parseUploadTags(fields.tags) : [saveToKnowledge ? "策略知识" : "诊断附件"], description: fields.description || (saveToKnowledge ? "策略诊断确认保存的知识资料" : "仅供本轮诊断使用的临时附件"), buffer: uploaded.buffer, libraryStatus: saveToKnowledge ? "knowledge" : "diagnostic_only", ...knowledgeOwnership });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "KNOWLEDGE_UPLOAD_FAILED" });
    }
    const link = attachDiagnosticKnowledgeFile({ sessionId: session.id, accountId: session.accountId, fileId: file.id, scope, usage: [purpose] });
    const extracted = extractKnowledgeCandidateFacts(file.id);
    const pausedQuestion = getPendingDiagnosticQuestion(session.id) || getPendingEnrichmentQuestion(session.id);
    const documentExtraction = purpose === "knowledge_only"
      ? { summary: extracted.summary, purpose, candidateClaims: [], mode: "knowledge_only" }
      : await extractDocumentStrategyCandidates(extracted, { purpose, pendingQuestion: pausedQuestion, claims: listCurrentProfileClaims(session.id) });
    const currentTarget = pausedQuestion?.targetFieldPaths?.[0] || null;
    const selectedCandidates = purpose === "answer_current"
      ? currentTarget
        ? documentExtraction.candidateClaims.filter((item) => item.targetFieldPath === currentTarget)
        : pausedQuestion?.questionKind === "enrichment" && extracted.summary
          ? [{ candidateType:"fact",targetKey:pausedQuestion.targetFactKey,value:{summary:extracted.summary,sourceFileId:file.id},confidence:0.7,evidence:extracted.citations || [] }]
          : []
      : documentExtraction.candidateClaims;
    const knowledgeCandidates = saveDiagnosticDocumentCandidates({ sessionId: session.id, accountId: session.accountId, fileId: file.id, candidates: selectedCandidates });
    const purposeLabel = purpose === "answer_current" ? "回答当前问题" : purpose === "extract_strategy" ? "提取策略信息" : "保存公司知识";
    appendDiagnosticTurn({ sessionId: session.id, role: "system", content: `已按“${purposeLabel}”处理资料《${file.name}》。`, metadata: { fileId: file.id, linkId: link.linkId, purpose, candidateFacts: selectedCandidates } });
    const fileCandidates = knowledgeCandidates.filter((item) => item.fileId === file.id && item.status === "pending");
    const noAnswerMessage = purpose === "answer_current" && !fileCandidates.length
      ? `我已经阅读《${file.name}》，但没有找到足以直接回答当前问题的明确内容。${pausedQuestion ? `我们仍需确认：${pausedQuestion.content}` : "你可以继续补充真实情况。"}`
      : null;
    const savedOnlyMessage = purpose === "knowledge_only"
      ? `《${file.name}》已保存到公司知识库，不会自动改写本轮策略。${pausedQuestion ? `继续刚才的问题：${pausedQuestion.content}` : "后续生成内容时可以按需检索。"}`
      : null;
    const immediateResume = fileCandidates.length ? null : (noAnswerMessage || savedOnlyMessage
      ? { assistantMessage: noAnswerMessage || savedOnlyMessage, pendingEnrichmentQuestion: pausedQuestion?.questionKind === "enrichment" ? pausedQuestion : null, pendingQuestion: pausedQuestion?.questionKind === "enrichment" ? null : pausedQuestion }
      : pausedQuestion?.questionKind === "enrichment" ? { assistantMessage: `资料已经分析完成。${pausedQuestion.content}`, pendingEnrichmentQuestion: pausedQuestion } : resumeDiagnosticQuestionFlow(session.id, { reason: "knowledge_no_candidates" }));
    if (immediateResume?.assistantMessage) appendDiagnosticTurn({ sessionId: session.id, role: "assistant", content: immediateResume.assistantMessage, metadata: { reason: "document_processed", purpose, fileId: file.id } });
    const resumeMessage = fileCandidates.length
      ? (purpose === "answer_current" ? `我从资料中找到了当前问题的候选答案，请确认后继续。` : `识别出 ${fileCandidates.length} 条策略信息，请确认后继续。`)
      : immediateResume?.assistantMessage || "资料解析完成，可以继续对话。";
    return sendJson(res, 201, { file, link, purpose, savedToKnowledge: saveToKnowledge, extracted: { ...extracted, documentExtraction }, knowledgeCandidates, knowledgeLinks: listDiagnosticKnowledgeFiles(session.id), pausedQuestion, resumed: immediateResume, assistantMessage: immediateResume?.assistantMessage || null, resumeMessage });
  }
  const diagnosticKnowledgeCandidateMatch = path.match(/^\/agent\/sessions\/([^/]+)\/knowledge-candidates\/([^/]+)\/decision$/);
  if (req.method === "POST" && diagnosticKnowledgeCandidateMatch) {
    const session = getDiagnosticSession(diagnosticKnowledgeCandidateMatch[1]);
    const candidate = getDiagnosticDocumentCandidate(diagnosticKnowledgeCandidateMatch[2]);
    if (!session || !candidate || candidate.sessionId !== session.id) return sendJson(res, 404, { error: "Knowledge candidate not found" });
    if (candidate.status !== "pending") return sendJson(res, 409, { error: "Knowledge candidate has already been decided" });
    const payload = await bodyJson(req);
    if (!['confirm', 'reject'].includes(payload.action)) return sendJson(res, 400, { error: "action must be confirm or reject" });
    if (payload.action === "reject") {
      setDiagnosticDocumentCandidateStatus(candidate.candidateId, "rejected");
    } else {
      const value = payload.modifiedValue ?? candidate.value;
      if (candidate.candidateType === "field") {
        let finalValue = value;
        if (candidate.targetFieldPath === "accountStrategy.contentResources") {
          const current = listCurrentProfileClaims(session.id).find((item) => item.fieldPath === candidate.targetFieldPath)?.value;
          finalValue = normalizeEvidenceProfile({ ...(value&&typeof value==="object"?value:{summary:String(value)}),publicUsage:payload.publicUsage||value?.publicUsage||"unknown" },current,candidate.fileId);
        }
        upsertProfileClaim({ sessionId: session.id, fieldPath: candidate.targetFieldPath, value: finalValue, type: candidate.targetFieldPath === "accountStrategy.contentResources" ? "resource_inventory" : "document_fact", sourceType: "document_confirmed", sourceRef: candidate.candidateId, confidence: 1, status: "confirmed" });
        const previousCoverage=getDiagnosticCoverageState(session.id,"core_field",candidate.targetFieldPath);
        const documentCoverage=mergeCoverageAssessment(previousCoverage,conservativeCoverageFromAnswer("core_field",candidate.targetFieldPath,finalValue,JSON.stringify(finalValue)),{targetType:"core_field",targetId:candidate.targetFieldPath});
        upsertDiagnosticCoverageState({ ...documentCoverage,sessionId:session.id,attempts:previousCoverage?.attempts||0,assessment:{ source:"confirmed_document",candidateId:candidate.candidateId } });
        upsertDiagnosticFieldState({ sessionId: session.id, fieldPath: candidate.targetFieldPath, state: documentCoverage.strategyReady ? "confirmed" : "partial", resolutionType: "document_confirmed", metadata: { fileId: candidate.fileId, candidateId: candidate.candidateId } });
      } else if (candidate.candidateType === "fact") {
        applyProfileFactOperation({ accountId:session.accountId,sessionId:session.id,factKey:candidate.targetKey,factType:"knowledge_supported_detail",subject:"company",predicate:`has_${candidate.targetKey.replace(/[^a-z0-9]+/gi,"_")}`,value,operation:"create",status:"user_asserted",confidence:1,visibility:"unknown",contentUsage:"needs_review",sourceType:"document_confirmed" });
        const pendingEnrichment=getPendingEnrichmentQuestion(session.id);
        if (pendingEnrichment?.targetFactKey===candidate.targetKey) {
          setEnrichmentQuestionStatus(pendingEnrichment.id,"answered");
          const dynamicSpec=getTargetSpec("dynamic_fact",pendingEnrichment.category);
          const firstRequiredSlot=dynamicSpec?.slots?.find((slot)=>slot.required)?.id;
          const assessment=normalizeCoverageAssessment({capturedSlots:firstRequiredSlot?[{slot:firstRequiredSlot,value,confidence:0.75,source:"confirmed_document"}]:[],status:"partial"},{targetType:"dynamic_fact",targetId:pendingEnrichment.category});
          upsertDiagnosticCoverageState({...assessment,sessionId:session.id,category:pendingEnrichment.category,attempts:pendingEnrichment.attempt||1,assessment:{source:"confirmed_document",candidateId:candidate.candidateId}});
        }
      }
      setDiagnosticDocumentCandidateStatus(candidate.candidateId, "confirmed");
    }
    const claims = listCurrentProfileClaims(session.id);
    const fieldStates = listDiagnosticFieldStates(session.id);
    const knowledgeCandidates = listDiagnosticDocumentCandidates(session.id);
    const filePending = knowledgeCandidates.some((item) => item.fileId === candidate.fileId && item.status === "pending");
    let resumed = null;
    if (!filePending) {
      const enrichmentQuestion = getPendingEnrichmentQuestion(session.id);
      if (enrichmentQuestion) {
        const assistantMessage = `资料已经处理完成。回到刚才的补充问题：${enrichmentQuestion.content}`;
        appendDiagnosticTurn({ sessionId: session.id, role: "assistant", content: assistantMessage, metadata: { reason: "knowledge_candidates_decided", questionKind: "enrichment", questionId: enrichmentQuestion.id } });
        resumed = { assistantMessage, pendingEnrichmentQuestion: enrichmentQuestion };
      } else if (candidate.candidateType === "fact") {
        const nextPlan=planNextEnrichmentQuestion({facts:listSessionProfileFacts(session.accountId,session.id),claims:listCurrentProfileClaims(session.id),previousQuestions:listEnrichmentQuestions(session.id),coverageStates:listDiagnosticCoverageStates(session.id)});
        const nextQuestion=nextPlan?createEnrichmentQuestion({sessionId:session.id,...nextPlan}):null;
        const assistantMessage=nextQuestion?`我已经把资料中与当前问题有关的信息记录下来。接下来：${nextQuestion.content}`:enrichmentCompletionMessage();
        appendDiagnosticTurn({sessionId:session.id,role:"assistant",content:assistantMessage,metadata:{reason:"knowledge_fact_confirmed",questionKind:"enrichment",questionId:nextQuestion?.id||null}});
        resumed={assistantMessage,pendingEnrichmentQuestion:nextQuestion};
      } else resumed = resumeDiagnosticQuestionFlow(session.id, { reason: "knowledge_candidates_decided" });
    }
    return sendJson(res, 200, { confirmed: payload.action === "confirm", claims, facts: listSessionProfileFacts(session.accountId, session.id), historicalFacts: listHistoricalProfileFacts(session.accountId, session.id), fieldStates, coverageStates:listDiagnosticCoverageStates(session.id), draftReadiness: currentStrategyReadiness(session), knowledgeCandidates, knowledgeLinks: listDiagnosticKnowledgeFiles(session.id), resumed });
  }
  const diagnosticKnowledgeConfirmMatch = path.match(/^\/agent\/sessions\/([^/]+)\/knowledge-files\/([^/]+)\/confirm$/);
  if (req.method === "POST" && diagnosticKnowledgeConfirmMatch) {
    const session = getDiagnosticSession(diagnosticKnowledgeConfirmMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const payload = await bodyJson(req);
    const extracted = extractKnowledgeCandidateFacts(diagnosticKnowledgeConfirmMatch[2]);
    const candidate = extracted.candidates[0];
    const value = payload.value || candidate?.value;
    if (!value) return sendJson(res, 400, { error: "No candidate fact to confirm" });
    const current = listCurrentProfileClaims(session.id).find((item) => item.fieldPath === "accountStrategy.contentResources")?.value;
    const merged = normalizeEvidenceProfile({ ...value,publicUsage:payload.publicUsage||value.publicUsage||"unknown" },current,diagnosticKnowledgeConfirmMatch[2]);
    upsertProfileClaim({ sessionId: session.id, fieldPath: "accountStrategy.contentResources", value: merged, type: "resource_inventory", sourceType: "document_confirmed", sourceRef: diagnosticKnowledgeConfirmMatch[2], confidence: 1, status: "confirmed" });
    const previousResourceCoverage=getDiagnosticCoverageState(session.id,"core_field","accountStrategy.contentResources");
    const resourceCoverage=mergeCoverageAssessment(previousResourceCoverage,conservativeCoverageFromAnswer("core_field","accountStrategy.contentResources",merged,JSON.stringify(merged)),{targetType:"core_field",targetId:"accountStrategy.contentResources"});
    upsertDiagnosticCoverageState({ ...resourceCoverage,sessionId:session.id,attempts:previousResourceCoverage?.attempts||0,assessment:{ source:"confirmed_document",fileId:diagnosticKnowledgeConfirmMatch[2] } });
    upsertDiagnosticFieldState({ sessionId: session.id, fieldPath: "accountStrategy.contentResources", state: resourceCoverage.strategyReady ? "confirmed" : "partial", resolutionType: "document_confirmed", metadata: { fileId: diagnosticKnowledgeConfirmMatch[2] } });
    applyProfileFactOperation({ accountId: session.accountId, sessionId: session.id, factKey: `knowledge.resource.${diagnosticKnowledgeConfirmMatch[2]}`, factType: "knowledge_resource", predicate: "has_confirmed_knowledge_resource", value: { fileId: diagnosticKnowledgeConfirmMatch[2], fileName: extracted.file.name, summary: extracted.summary }, sourceType: "document_confirmed", contentUsage: merged.publicUsage === "public" || merged.publicUsage === "anonymized" ? "allowed" : "needs_review", visibility: merged.publicUsage });
    return sendJson(res, 200, { confirmed: true, value: merged, claims: listCurrentProfileClaims(session.id), facts: listCurrentProfileFacts(session.accountId), knowledgeLinks: listDiagnosticKnowledgeFiles(session.id) });
  }
  const enrichmentStartMatch = path.match(/^\/agent\/sessions\/([^/]+)\/enrichment\/start$/);
  if (req.method === "POST" && enrichmentStartMatch) {
    const session = getDiagnosticSession(enrichmentStartMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const claims = listCurrentProfileClaims(session.id);
    const fieldStates = listDiagnosticFieldStates(session.id);
    const draftReadiness = currentStrategyReadiness(session);
    if (!draftReadiness.coreComplete) return sendJson(res, 409, { error: "请先完成九项策略骨架", draftReadiness });
    let pendingEnrichmentQuestion = getPendingEnrichmentQuestion(session.id);
    if (!pendingEnrichmentQuestion) {
      const facts = listSessionProfileFacts(session.accountId, session.id);
      const plan = planNextEnrichmentQuestion({ facts, claims, previousQuestions: listEnrichmentQuestions(session.id), coverageStates:listDiagnosticCoverageStates(session.id) });
      if (plan) pendingEnrichmentQuestion = createEnrichmentQuestion({ sessionId: session.id, ...plan });
    }
    updateDiagnosticSessionContext(session.id, { enrichmentStatus: pendingEnrichmentQuestion ? "active" : "completed" });
    const assistantMessage = pendingEnrichmentQuestion ? enrichmentStartMessage(pendingEnrichmentQuestion) : enrichmentCompletionMessage();
    appendDiagnosticTurn({ sessionId: session.id, role: "assistant", content: assistantMessage, metadata: { questionKind: "enrichment", questionId: pendingEnrichmentQuestion?.id || null } });
    return sendJson(res, 200, { assistantMessage, sessionContext: getDiagnosticSessionContext(session.id), pendingEnrichmentQuestion, facts: listSessionProfileFacts(session.accountId, session.id), historicalFacts: listHistoricalProfileFacts(session.accountId, session.id), draftReadiness });
  }
  const enrichmentStopMatch = path.match(/^\/agent\/sessions\/([^/]+)\/enrichment\/stop$/);
  if (req.method === "POST" && enrichmentStopMatch) {
    const session = getDiagnosticSession(enrichmentStopMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const pending = getPendingEnrichmentQuestion(session.id);
    if (pending) setEnrichmentQuestionStatus(pending.id, "skipped");
    updateDiagnosticSessionContext(session.id, { enrichmentStatus: "completed" });
    const assistantMessage = "已结束这轮动态事实补充。现有信息已经保存，你可以生成或更新策略草案，也可以继续修改核心字段。";
    appendDiagnosticTurn({ sessionId: session.id, role: "assistant", content: assistantMessage, metadata: { questionKind: "enrichment", action: "stop" } });
    return sendJson(res, 200, { assistantMessage, sessionContext: getDiagnosticSessionContext(session.id), pendingEnrichmentQuestion: null });
  }
  const agentMessageMatch = path.match(/^\/agent\/sessions\/([^/]+)\/messages$/);
  if (req.method === "POST" && agentMessageMatch) {
    const payload = await bodyJson(req);
    const session = getDiagnosticSession(agentMessageMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    if (!payload.message?.trim()) return sendJson(res, 400, { error: "message is required" });
    const turns = listDiagnosticTurns(session.id);
    const claims = listCurrentProfileClaims(session.id);
    const sessionContext = getDiagnosticSessionContext(session.id);
    const currentFacts = listSessionProfileFacts(session.accountId, session.id);
    const historicalFacts = sessionContext.restartMode === "update" ? listHistoricalProfileFacts(session.accountId, session.id) : [];
    const historicalClaims = sessionContext.restartMode === "update" && sessionContext.inheritedFromSessionId ? listCurrentProfileClaims(sessionContext.inheritedFromSessionId) : [];
    const pendingCoreQuestion = getPendingDiagnosticQuestion(session.id);
    const pendingEnrichmentQuestion = !pendingCoreQuestion ? getPendingEnrichmentQuestion(session.id) : null;
    const pendingQuestion = pendingCoreQuestion || pendingEnrichmentQuestion;
    const coverageStates = listDiagnosticCoverageStates(session.id);
    const pendingRecommendation = getPendingAgentRecommendation(session.id);
    if (["refining","revision_ready"].includes(pendingRecommendation?.status)) {
      const baseOption=pendingRecommendation.options?.[0];
      const fallbackValue=typeof baseOption?.completeValue === "string" ? `${baseOption.completeValue}；按用户要求调整：${payload.message.trim()}` : { ...(baseOption?.completeValue||{}),userRequestedAdjustment:payload.message.trim() };
      const fallbackRevision={ revisedValue:fallbackValue,display:buildRecommendationDisplay({value:fallbackValue,label:"调整后的方案"}),assistantMessage:"我已按你的想法整理出修改版。" };
      const revisionGenerated=await generateAgentText({ task:"revise_diagnostic_recommendation",contract:"RecommendationRevision@1.0",targetFieldPath:pendingRecommendation.targetFieldPath,baseOption,previousRevision:pendingRecommendation.latestRevision,userInstruction:payload.message.trim(),rules:["只修改用户明确提出的部分，保留其余有效内容","结构化值必须符合目标字段含义","display必须是面向普通客户的自然中文，不得出现JSON或字段名","信息不足时在attention中说明，不得虚构事实"],outputSchema:{revisedValue:null,display:{title:"调整后的方案",summary:"",steps:[],advantages:[],attention:[]},assistantMessage:""} },fallbackRevision);
      const revisionBody=unwrapAgentData(revisionGenerated);
      const revisedValue=completeRecommendationValue(pendingRecommendation.targetFieldPath,revisionBody.revisedValue ?? fallbackValue);
      const result=recordRecommendationRevision({sessionId:session.id,recommendationId:pendingRecommendation.id,userInstruction:payload.message.trim(),value:revisedValue,display:revisionBody.display || buildRecommendationDisplay({value:revisedValue,label:"调整后的方案"}),baseOptionId:baseOption?.optionId||null});
      return sendJson(res,201,{...result,providerMode:revisionGenerated.mode,providerWarning:revisionGenerated.warning||null,coverageStates:listDiagnosticCoverageStates(session.id),profileCoverage:buildCoverageSnapshot(listDiagnosticCoverageStates(session.id).filter((x)=>x.targetType==="core_field"),listDiagnosticCoverageStates(session.id).filter((x)=>x.targetType==="dynamic_fact")),diagnosticSummary:diagnosticSummaryFor(session.id)});
    }
    const virtualTargetQuestion = !pendingQuestion && payload.targetFieldPath ? { id: null, content: `继续讨论并完善${payload.targetFieldPath}`, targetFieldPaths: [payload.targetFieldPath], questionMode: "enrichment", attempt: 1 } : null;
    const extractionQuestion = pendingQuestion || virtualTargetQuestion;
    const request = buildDiagnosticTurnRequest({ session, turns, claims, latestUserMessage: payload.message.trim(), pendingQuestion: extractionQuestion, currentFacts, historicalClaims, historicalFacts, sessionContext, coverageStates });
    const deterministic = featureFlags().diagnosticExtractionV2
      ? buildDeterministicDiagnosticFallback(payload.message, claims, extractionQuestion)
      : diagnosticFallback(payload.message, claims, extractionQuestion);
    const generated = await executeSkill({ skillName: "analyze-diagnostic-turn", input: request, generateText: generateAgentText, fallback: deterministic, expectedContract: "DiagnosticTurnResult@3.0", task: "analyze_diagnostic_turn" });
    const modelAnalysis = unwrapAgentData(generated);
    const deterministicIntent = classifyIntentDeterministically(payload.message, { pendingQuestion, pendingRecommendation, intentOverride: payload.intentOverride || "" });
    const modelIntent = String(modelAnalysis.intent || deterministicIntent.intent || "direct_answer");
    const explicitRecommendationRequest = payload.intentOverride === "request_recommendation" || /(有什么建议|给.*建议|怎么设置|怎么选|推荐.*方案|你建议)/.test(payload.message);
    const intentCandidate = deterministicIntent.confidence >= 0.9 ? deterministicIntent.intent : modelIntent;
    const preliminaryIntent = intentCandidate === "request_recommendation" && !explicitRecommendationRequest ? (pendingQuestion ? "direct_answer" : "add_context") : intentCandidate;
    const answerDisposition = resolveQuestionAnswerDisposition(payload.message, { pendingQuestion: extractionQuestion, intent: preliminaryIntent });
    const intent = answerDisposition.intent;
    const modelCoreOperations = Array.isArray(modelAnalysis.coreClaimOperations) && modelAnalysis.coreClaimOperations.length
      ? modelAnalysis.coreClaimOperations
      : (modelAnalysis.claims || []).map((item) => ({ operation: "create", ...item }));
    const mergedCoreOperations = new Map();
    for (const operation of [...modelCoreOperations, ...(deterministic.coreClaimOperations || [])]) {
      if (!operation?.fieldPath) continue;
      mergedCoreOperations.set(operation.fieldPath, operation);
    }
    const mergedFactOperations = new Map();
    for (const operation of [...(modelAnalysis.discoveredFactOperations || []), ...(deterministic.discoveredFactOperations || [])]) {
      if (!operation?.factKey || !operation?.predicate) continue;
      mergedFactOperations.set(operation.factKey, operation);
    }
    const suppressAnswerExtraction = answerDisposition.suppressExtraction || assistanceIntents.has(intent) || ["cannot_answer", "temporarily_unknown", "skip_question", "skip_field", "adopt_recommendation", "modify_recommendation", "reject_recommendation"].includes(intent);
    let semanticCoreOperation = null;
    if (answerDisposition.kind === "none_declared" && answerDisposition.targetType === "core_field" && answerDisposition.claimValue) {
      semanticCoreOperation = {
        operation: claims.some((item)=>item.fieldPath===answerDisposition.targetId) ? "correct" : "create",
        fieldPath:answerDisposition.targetId,
        value:answerDisposition.claimValue,
        confidence:1,
        sourceType:"user_statement",
        resolutionState:"explicit_none"
      };
    }
    if (pendingEnrichmentQuestion && !suppressAnswerExtraction && !mergedFactOperations.has(pendingEnrichmentQuestion.targetFactKey)) {
      mergedFactOperations.set(pendingEnrichmentQuestion.targetFactKey, { operation: "create", factKey: pendingEnrichmentQuestion.targetFactKey, factType: pendingEnrichmentQuestion.category, subject: "company", predicate: `has_${pendingEnrichmentQuestion.targetFactKey.replace(/[^a-z0-9]+/gi, "_")}`, value: payload.message.trim(), status: "user_asserted", confidence: 0.95, visibility: "unknown", contentUsage: "needs_review", sourceType: "user_statement" });
    }
    if (!pendingQuestion && !virtualTargetQuestion && !suppressAnswerExtraction && !(deterministic.discoveredFactOperations || []).length) {
      const additionalFact={ operation: "create", factKey: `diagnostic.enrichment.${id("fact")}`, factType: "diagnostic_enrichment", subject: "company", predicate: "provided_additional_strategy_context", value: { statement: payload.message.trim() }, status: "user_asserted", confidence: 0.9, visibility: "unknown", contentUsage: "needs_review", sourceType: "user_statement" };
      deterministic.discoveredFactOperations = [additionalFact];
      mergedFactOperations.set(additionalFact.factKey,additionalFact);
    }
    const analysis = {
      ...modelAnalysis,
      intent,
      intentConfidence: Math.max(Number(modelAnalysis.intentConfidence) || 0, deterministicIntent.confidence || 0),
      claims: semanticCoreOperation ? [semanticCoreOperation] : suppressAnswerExtraction ? [] : [...mergedCoreOperations.values()],
      coreClaimOperations: semanticCoreOperation ? [semanticCoreOperation] : suppressAnswerExtraction ? [] : [...mergedCoreOperations.values()],
      discoveredFactOperations: suppressAnswerExtraction ? [] : [...mergedFactOperations.values()],
      answerAssessment: modelAnalysis.answerAssessment || deterministic.answerAssessment,
      targetAssessment: modelAnalysis.targetAssessment || deterministic.targetAssessment || null,
      acknowledgement: deterministic.answerAssessment?.answeredFieldPaths?.length ? deterministic.acknowledgement : !String(generated.mode).includes("fallback") && modelAnalysis.acknowledgement ? modelAnalysis.acknowledgement : deterministic.acknowledgement || modelAnalysis.acknowledgement,
      conflicts: Array.isArray(modelAnalysis.conflicts) ? modelAnalysis.conflicts : [],
      missingCriticalFields: Array.isArray(modelAnalysis.missingCriticalFields) ? modelAnalysis.missingCriticalFields : [],
      nextQuestionRecommendation: generated.mode === "live" ? modelAnalysis.nextQuestionRecommendation || modelAnalysis.nextQuestion || "" : "",
      questionGoal: modelAnalysis.questionGoal || deterministic.questionGoal || "补齐关键策略信息",
      recommendationAction: {
        ...(modelAnalysis.recommendationAction && typeof modelAnalysis.recommendationAction === "object" ? modelAnalysis.recommendationAction : {}),
        ...(payload.recommendationId ? { recommendationId: payload.recommendationId } : {}),
        ...(payload.modifiedValue != null ? { modifiedValue: payload.modifiedValue } : {})
      },
      assistanceRequest: { ...(modelAnalysis.assistanceRequest && typeof modelAnalysis.assistanceRequest === "object" ? modelAnalysis.assistanceRequest : {}), ...(payload.targetFieldPath ? { targetFieldPath: payload.targetFieldPath } : {}) },
      providerTelemetry: generated.telemetry || null
    };
    analysis.answerDisposition = answerDisposition;
    if (answerDisposition.suppressExtraction && extractionQuestion && (answerDisposition.closeWholeTarget || answerDisposition.skippedSlotIds?.length || answerDisposition.kind === "explicit_negative")) {
      const targetType=answerDisposition.targetType;
      const targetId=answerDisposition.targetId;
      if (targetId) {
        const previousCoverage=getDiagnosticCoverageState(session.id,targetType,targetId);
        const fallbackSlotIds=(previousCoverage?.missingRequiredSlots || getTargetSpec(targetType,targetId)?.slots?.filter((item)=>item.required).map((item)=>item.id) || []).slice(0,1);
        const skippedSlots=answerDisposition.closeWholeTarget
          ? (getTargetSpec(targetType,targetId)?.slots || []).filter((item)=>item.required).map((item)=>item.id)
          : (answerDisposition.skippedSlotIds?.length ? answerDisposition.skippedSlotIds : fallbackSlotIds);
        const rawCoverage={
          capturedSlots:previousCoverage?.capturedSlots || [],
          skippedSlots,
          status:answerDisposition.coverageStatus || (answerDisposition.closeWholeTarget ? "not_applicable" : "partial"),
          followUpQuestion:""
        };
        const normalizedCoverage=answerDisposition.closeWholeTarget
          ? normalizeCoverageAssessment(rawCoverage,{targetType,targetId,status:rawCoverage.status})
          : mergeCoverageAssessment(previousCoverage,rawCoverage,{targetType,targetId});
        upsertDiagnosticCoverageState({ ...normalizedCoverage,sessionId:session.id,category:pendingEnrichmentQuestion?.category||null,attempts:(previousCoverage?.attempts||0)+1,assessment:{ resolution:answerDisposition.kind,closedSlots:skippedSlots } });
        analysis.targetAssessment=normalizedCoverage;
      }
    } else if (!suppressAnswerExtraction && extractionQuestion) {
      const targetType = pendingEnrichmentQuestion ? "dynamic_fact" : "core_field";
      const targetId = pendingEnrichmentQuestion?.category || extractionQuestion.targetFieldPaths?.[0];
      if (targetId) {
        const previousCoverage = getDiagnosticCoverageState(session.id,targetType,targetId);
        const operationValue = targetType === "core_field" ? [...mergedCoreOperations.values()].find((x)=>x.fieldPath===targetId)?.value : payload.message.trim();
        const deterministicAssessment=conservativeCoverageFromAnswer(targetType,targetId,operationValue,payload.message);
        const spec=getTargetSpec(targetType,targetId);
        const specSlots=new Set((spec?.slots||[]).map((item)=>item.id));
        const pendingSlots=new Set(extractionQuestion.targetSlotIds?.length?extractionQuestion.targetSlotIds:specSlots);
        const modelTarget=analysis.targetAssessment;
        const modelMatchesCanonical=modelTarget?.targetType===targetType&&modelTarget?.targetId===targetId;
        const sanitizedModelAssessment=modelMatchesCanonical ? {
          capturedSlots:(modelTarget.capturedSlots||[]).filter((item)=>specSlots.has(item?.slot)&&pendingSlots.has(item.slot)),
          skippedSlots:[],
          status:"partial",
          followUpQuestion:""
        } : {capturedSlots:[],skippedSlots:[],status:"partial"};
        const deterministicFloor=mergeCoverageAssessment(null,deterministicAssessment,{targetType,targetId});
        const currentTurnAssessment=mergeCoverageAssessment(deterministicFloor,sanitizedModelAssessment,{targetType,targetId});
        const normalizedCoverage = mergeCoverageAssessment(previousCoverage,currentTurnAssessment,{targetType,targetId});
        analysis.targetAssessment = normalizedCoverage;
        upsertDiagnosticCoverageState({ ...normalizedCoverage,sessionId:session.id,category:pendingEnrichmentQuestion?.category || null,attempts:(previousCoverage?.attempts||0)+1,assessment:{ providerMode:generated.mode,followUpQuestion:normalizedCoverage.followUpQuestion } });
      }
      if (!pendingEnrichmentQuestion) {
        for (const operation of mergedCoreOperations.values()) {
          if (!operation?.fieldPath || operation.fieldPath === targetId) continue;
          const previous=getDiagnosticCoverageState(session.id,"core_field",operation.fieldPath);
          const inferred=mergeCoverageAssessment(previous,conservativeCoverageFromAnswer("core_field",operation.fieldPath,operation.value,payload.message),{targetType:"core_field",targetId:operation.fieldPath});
          upsertDiagnosticCoverageState({ ...inferred,sessionId:session.id,attempts:previous?.attempts||0,assessment:{ providerMode:generated.mode,source:"additional_field_candidate" } });
        }
      }
    } else if (["skip_question","skip_field","cannot_answer","temporarily_unknown"].includes(intent) && extractionQuestion) {
      const targetType=pendingEnrichmentQuestion?"dynamic_fact":"core_field";
      const targetId=pendingEnrichmentQuestion?.category || extractionQuestion.targetFieldPaths?.[0];
      if (targetId) {
        const previousCoverage=getDiagnosticCoverageState(session.id,targetType,targetId);
        // A terminal user answer closes the current target for this onboarding
        // pass. Missing slots remain visible as quality warnings, not auto-reasks.
        const skipWholeTarget=true;
        const skippedSlots=[];
        const coverageStatus="skipped";
        const normalizedCoverage=normalizeCoverageAssessment({ capturedSlots:previousCoverage?.capturedSlots||[],skippedSlots,status:coverageStatus },{targetType,targetId,status:coverageStatus});
        upsertDiagnosticCoverageState({ ...normalizedCoverage,sessionId:session.id,category:pendingEnrichmentQuestion?.category||null,attempts:(previousCoverage?.attempts||0)+1,assessment:{ resolution:intent } });
        analysis.targetAssessment=normalizedCoverage;
      }
    }
    let assistanceMode = null;
    if (assistanceIntents.has(intent)) {
      const adHocEnrichment = !pendingQuestion && !virtualTargetQuestion && evaluateStrategyDraftReadiness(claims, listDiagnosticFieldStates(session.id),listDiagnosticCoverageStates(session.id)).coreComplete
        ? planNextEnrichmentQuestion({ facts: currentFacts, claims, previousQuestions: listEnrichmentQuestions(session.id),coverageStates:listDiagnosticCoverageStates(session.id) })
        : null;
      const assistanceQuestion = pendingQuestion || virtualTargetQuestion || (adHocEnrichment ? { ...adHocEnrichment, questionKind: "enrichment", targetFieldPaths: [] } : null);
      if (!assistanceQuestion) {
        analysis.assistanceResponse = "当前没有待回答的问题。你可以直接补充业务信息，或者选择一个策略字段继续修改。";
        analysis.recommendationDraft = null;
        assistanceMode = "not_applicable";
      } else {
      const isDynamicAssistance = assistanceQuestion.questionKind === "enrichment" || Boolean(assistanceQuestion.targetFactKey);
      const targetFieldPath = isDynamicAssistance ? `fact:${assistanceQuestion.targetFactKey}` : assistanceQuestion?.targetFieldPaths?.[0] || modelAnalysis.assistanceRequest?.targetFieldPath || "";
      const fallbackAssistance = isDynamicAssistance ? buildEnrichmentAssistanceFallback({ intent, question: assistanceQuestion, claims, facts: currentFacts }) : buildAssistanceFallback({ intent, fieldPath: targetFieldPath, claims });
      const assistanceInput = isDynamicAssistance
        ? { task: "provide_diagnostic_assistance", contract: "DiagnosticAssistanceResult@2.0", intent, targetFieldPath, pendingQuestion: assistanceQuestion, currentClaims: claims, relevantFacts: currentFacts.slice(-20), rules: ["使用自然、顾问式中文", "必须具体回应动态事实问题", "建议只是候选，必须由用户确认后写入", "给出一个推荐方案和最多两个备选"] }
        : buildAssistanceRequest({ intent, fieldPath: targetFieldPath, claims, facts: currentFacts, turns,knowledgeEvidence:listDiagnosticDocumentCandidates(session.id),pendingQuestion: assistanceQuestion,allowExternalResearch:Boolean(payload.allowExternalResearch) });
      const assistanceGenerated = isDynamicAssistance
        ? await generateAgentText(assistanceInput, fallbackAssistance)
        : await executeSkill({ skillName: "coach-diagnostic-field", input: assistanceInput, generateText: generateAgentText, fallback: fallbackAssistance, expectedContract: "DiagnosticAssistanceResult@2.0", task: "provide_diagnostic_assistance" });
      const generatedAssistance = unwrapAgentData(assistanceGenerated);
      const relevance = isDynamicAssistance ? { valid: Boolean(generatedAssistance?.assistantMessage), reason: null } : validateAssistanceRelevance(generatedAssistance, targetFieldPath, intent);
      const rawAssistance = relevance.valid ? generatedAssistance : fallbackAssistance;
      const safeRecommendation = rawAssistance.recommendation?.recommendedValue != null ? rawAssistance.recommendation : fallbackAssistance.recommendation;
      analysis.assistanceResponse = String(rawAssistance.assistantMessage || fallbackAssistance.assistantMessage || "").trim();
      analysis.assistanceResponse += `\n\n看完后请继续回答刚才的问题；也可以直接说“跳过”。\n${assistanceQuestion.content}`;
      if (intent === "request_examples" && Array.isArray(rawAssistance.examples) && rawAssistance.examples.length && !rawAssistance.examples.some((item) => analysis.assistanceResponse.includes(String(item)))) {
        analysis.assistanceResponse += `\n\n${rawAssistance.examples.map((item, index) => `${index + 1}. ${humanizeStrategyValue(item)}`).join("\n")}`;
      }
      if (intent === "request_checklist" && Array.isArray(rawAssistance.checklist) && rawAssistance.checklist.length) {
        const firstTitle = rawAssistance.checklist[0]?.item || rawAssistance.checklist[0]?.title || rawAssistance.checklist[0];
        if (!analysis.assistanceResponse.includes(String(firstTitle || ""))) analysis.assistanceResponse += `\n\n${rawAssistance.checklist.map(formatNaturalListItem).join("\n\n")}`;
      }
      analysis.recommendationDraft = safeRecommendation || null;
      analysis.assistanceRequest = { ...(analysis.assistanceRequest || {}), targetFieldPath };
      analysis.assistanceValidation = relevance;
      analysis.providerTelemetry = assistanceGenerated.telemetry || analysis.providerTelemetry;
      analysis.providerWarning = assistanceGenerated.warning || null;
      assistanceMode = assistanceGenerated.mode;
      if (pendingEnrichmentQuestion) setEnrichmentQuestionStatus(pendingEnrichmentQuestion.id, safeRecommendation ? "recommendation_pending" : "assisting");
      }
    }
    if (suppressAnswerExtraction) analysis.acknowledgement = "";
    const recorded = recordDiagnosticAnalysis({ sessionId: session.id, userMessage: payload.message.trim(), analysis });
    let handledEnrichment = false;
    if (pendingEnrichmentQuestion && !assistanceIntents.has(intent) && !["adopt_recommendation", "modify_recommendation", "reject_recommendation"].includes(intent)) {
      handledEnrichment = true;
      const enrichmentCoverage = getDiagnosticCoverageState(session.id,"dynamic_fact",pendingEnrichmentQuestion.category);
      const enrichmentDone = ["skip_question", "skip_field", "cannot_answer", "temporarily_unknown"].includes(intent) || enrichmentCoverage?.strategyReady;
      setEnrichmentQuestionStatus(pendingEnrichmentQuestion.id, enrichmentDone ? (["skip_question", "skip_field", "cannot_answer", "temporarily_unknown"].includes(intent) ? "skipped" : "answered") : "answered");
      const sessionFacts = listSessionProfileFacts(session.accountId, session.id);
      const nextEnrichment = planNextEnrichmentQuestion({ facts: sessionFacts, claims:listCurrentProfileClaims(session.id), previousQuestions: listEnrichmentQuestions(session.id), coverageStates:listDiagnosticCoverageStates(session.id), preferredCategory:enrichmentDone?null:pendingEnrichmentQuestion.category });
      let enrichmentMessage;
      if (nextEnrichment) {
        const createdQuestion = createEnrichmentQuestion({ sessionId: session.id, ...nextEnrichment });
        updateDiagnosticSessionContext(session.id, { enrichmentStatus: "active" });
        enrichmentMessage = `${analysis.acknowledgement || "已记录这项补充。"}\n\n接下来：${createdQuestion.content}`;
        recorded.pendingEnrichmentQuestion = createdQuestion;
      } else {
        updateDiagnosticSessionContext(session.id, { enrichmentStatus: "completed" });
        enrichmentMessage = enrichmentCompletionMessage();
        recorded.pendingEnrichmentQuestion = null;
      }
      if (recorded.assistantTurn?.id) updateDiagnosticTurn({ turnId: recorded.assistantTurn.id, content: enrichmentMessage, metadata: { intent, questionKind: "enrichment", previousQuestionId: pendingEnrichmentQuestion.id, nextQuestionId: recorded.pendingEnrichmentQuestion?.id || null } });
      else recorded.assistantTurn = appendDiagnosticTurn({ sessionId: session.id, role: "assistant", content: enrichmentMessage, metadata: { intent, questionKind: "enrichment" } });
      recorded.assistantMessage = enrichmentMessage;
      recorded.facts = sessionFacts;
    }
    let dialogueMode = assistanceMode || generated.mode;
    if (!assistanceIntents.has(intent) && !handledEnrichment && recorded.assistantTurn?.id && !(recorded.draftReadiness?.canGenerateMinimumDraft && !recorded.pendingQuestion)) {
      const composerFallback = { assistantMessage: recorded.assistantMessage };
      const composed = await executeSkill({ skillName: "compose-consultative-reply", input: buildDialogueComposerRequest({ userMessage: payload.message.trim(), intent, acknowledgement: analysis.acknowledgement, nextQuestion: recorded.pendingQuestion?.content || "", claims: recorded.claims, facts: recorded.facts, recommendation: recorded.recommendation }), generateText: generateAgentText, fallback: composerFallback, expectedContract: "ConsultativeReply@2.0", task: "compose_consultative_diagnostic_reply" });
      const composedBody = unwrapAgentData(composed);
      const composedReply = String(composedBody.assistantMessage || recorded.assistantMessage || "").trim();
      const canonicalQuestion = recorded.pendingQuestion?.content || "";
      // The model may improve tone, but it cannot change the state machine's
      // canonical next question or invent a new one.
      const acknowledgement=sanitizeConsultativeAcknowledgement(composedReply)||sanitizeConsultativeAcknowledgement(analysis.acknowledgement)||"已记录。";
      const naturalReply = canonicalQuestion ? `${acknowledgement}\n\n${canonicalQuestion}` : acknowledgement;
      if (naturalReply) {
        updateDiagnosticTurn({ turnId: recorded.assistantTurn.id, content: naturalReply, metadata: { intent, questionPlan: recorded.pendingQuestion, recommendationId: recorded.recommendation?.id || null, providerMode: composed.mode } });
        recorded.assistantMessage = naturalReply;
      }
      dialogueMode = composed.mode;
    }
    const latestDraftRevision = getLatestStrategyDraftRevision(session.id);
    const affectedFields = (analysis.coreClaimOperations || []).map((item) => item.fieldPath).filter(Boolean);
    const strategyPatch = latestDraftRevision && affectedFields.length ? { affectedFields: [...new Set(affectedFields)], claimOperations: analysis.coreClaimOperations || [], factOperations: analysis.discoveredFactOperations || [], requiresDraftRegeneration: true, affectedDownstream: ["monitoring_directions", "topic_preferences", "content_generation"] } : null;
    const finalCoverageStates=listDiagnosticCoverageStates(session.id);
    return sendJson(res, 201, { ...recorded,draftReadiness:currentStrategyReadiness(session),strategySessionState:currentStrategySessionState(session), coverageStates:finalCoverageStates,profileCoverage:buildCoverageSnapshot(finalCoverageStates.filter((x)=>x.targetType==="core_field"),finalCoverageStates.filter((x)=>x.targetType==="dynamic_fact")), sessionContext: getDiagnosticSessionContext(session.id), historicalFacts, strategyPatch, strategyDraftRevision: latestDraftRevision,strategyDecisionRecord:getStrategyDecisionRecord(session.id), knowledgeLinks: listDiagnosticKnowledgeFiles(session.id), knowledgeCandidates: listDiagnosticDocumentCandidates(session.id), providerMode: generated.mode, assistanceMode, dialogueMode, providerWarning: analysis.providerWarning || generated.warning || null,pendingEnrichmentQuestion:getPendingEnrichmentQuestion(session.id),diagnosticSummary:diagnosticSummaryFor(session.id) });
  }
  const strategyDecisionMatch=path.match(/^\/agent\/sessions\/([^/]+)\/strategy-decisions(?:\/(preview|confirm|readiness|context))?$/);
  if(strategyDecisionMatch){
    const session=getDiagnosticSession(strategyDecisionMatch[1]);
    if(!session)return sendJson(res,404,{error:"Diagnostic session not found"});
    const action=strategyDecisionMatch[2]||"selection";
    const claims=listCurrentProfileClaims(session.id);
    const facts=listSessionProfileFacts(session.accountId,session.id);
    const sessionMeta=getDiagnosticSessionMeta(session.id);
    const accountCatalog=strategyAccountCatalog(store,session.accountId);
    const accounts=accountCatalog.filter((item)=>item.configuration?.selectionEligible);
    if(req.method==="GET"&&action==="context")return sendJson(res,200,{sessionId:session.id,accountId:session.accountId,accounts:accountCatalog,playbooks:GROWTH_PLAYBOOKS,record:getStrategyDecisionRecord(session.id),readiness:strategyDecisionReadiness(getStrategyDecisionRecord(session.id),sessionMeta,{socialAccounts:accountCatalog})});
    if(req.method==="GET"&&action==="readiness")return sendJson(res,200,strategyDecisionReadiness(getStrategyDecisionRecord(session.id),sessionMeta,{socialAccounts:accountCatalog}));
    if(req.method==="POST"&&action==="preview"){
      const previewRequest=await bodyJson(req);
      const coreReadiness=buildStrategyReadinessSnapshot({claims,fieldStates:listDiagnosticFieldStates(session.id),coverageStates:listDiagnosticCoverageStates(session.id),pendingQuestion:getPendingDiagnosticQuestion(session.id),pendingRecommendation:getPendingAgentRecommendation(session.id),sessionMeta});
      const activeStrategy=getActiveStrategySnapshot(session.accountId);
      const compatibilityRepair=Boolean(previewRequest?.compatibilityRepair&&activeStrategy);
      if(!coreReadiness.canGenerateMinimumDraft&&!compatibilityRepair)return sendJson(res,409,{error:"请先完成最小策略骨架，再进行账号与增长策略选择",code:"MINIMUM_DIAGNOSIS_INCOMPLETE",readiness:coreReadiness});
      if(!accounts.length)return sendJson(res,409,{error:"请先在账号与设置中创建并启用至少一个小红书或公众号账号",code:"SOCIAL_ACCOUNT_SETUP_REQUIRED",accounts:accountCatalog,repairAction:{target:"accounts",label:"前往账号与设置"}});
      const fallback=recommendStrategyDecisions({claims,facts,socialAccounts:accounts});
      const preliminary=assembleStrategyInputBundle({account:{id:session.accountId,name:(store.accounts||[]).find((item)=>item.id===session.accountId)?.name||""},claims,facts});
      const generated=await executeSkill({skillName:"select-growth-playbook",input:{strategyInputBundle:preliminary,socialAccounts:accounts,candidatePlaybooks:GROWTH_PLAYBOOKS},generateText:generateAgentText,fallback,expectedContract:"GrowthPlaybookSelection@1.0",task:"select_growth_playbook"});
      const preview=normalizeStrategyDecisions(unwrapAgentData(generated),fallback);
      const accountById=new Map(accounts.map((item)=>[item.id,item]));
      const activeStrategies=activeGrowthStrategyMap(activeStrategy);
      preview.accountCatalog=accountCatalog;
      preview.accountStrategies=(preview.accountStrategies||[]).filter((item)=>accountById.has(item.socialAccountId)).map((item)=>{const account=accountById.get(item.socialAccountId);const active=activeStrategies.get(item.socialAccountId);const identity=completeAccountIdentity(account.accountIdentity)?account.accountIdentity:(active?.accountIdentity||account.accountIdentity);return {...item,companyId:account.companyId,platform:account.platform,accountIdentityId:account.accountIdentityId,accountIdentity:identity,accountConfiguration:account.configuration,selectedPlaybookId:compatibilityRepair&&active?.selectedPlaybookId?active.selectedPlaybookId:item.selectedPlaybookId,compatibilityMigration:compatibilityRepair?{mode:completeAccountIdentity(active?.accountIdentity)?"confirm_or_change_active_identity":"new_identity",activeStrategySnapshotId:activeStrategy?.id||null}:null};});
      preview.portfolioDecision={...(preview.portfolioDecision||{}),accounts:accounts.map((account)=>({socialAccountId:account.id,accountIdentityId:account.accountIdentityId,name:account.name,platform:account.platform,operatorName:account.operatorName,configurationStatus:account.configurationStatus}))};
      const selection=normalizeStrategyDecisionSelection(preview,preview,accounts);
      if(compatibilityRepair){
        const suggestions=new Map((preview.accountStrategies||[]).map((item)=>[item.socialAccountId,item.accountIdentity]));
        selection.accountStrategies=(selection.accountStrategies||[]).map((item)=>{
          const suggestion=suggestions.get(item.socialAccountId);
          if(completeAccountIdentity(item.accountIdentity)||!completeAccountIdentity(suggestion))return item;
          const account=accountById.get(item.socialAccountId);
          const accountIdentity=normalizeSocialAccountIdentity(account,{...suggestion,id:account?.accountIdentityId||suggestion.id,companyId:session.accountId,socialAccountId:item.socialAccountId});
          return {...item,accountIdentity,accountIdentityId:accountIdentity.id,compatibilityMigration:{mode:"confirm_or_change_active_identity",activeStrategySnapshotId:activeStrategy?.id||null}};
        });
      }
      const record=saveStrategyDecisionRecord({sessionId:session.id,accountId:session.accountId,preview,selection,status:"preview",claimRevision:sessionMeta?.claimRevision,factRevision:sessionMeta?.factRevision});
      markStrategyDraftsStale(session.id,"账号与增长策略建议已形成新修订");
      updateDiagnosticSessionMeta(session.id,{conversationPhase:"strategy_decision_preview"});
      return sendJson(res,201,{record,preview,selection,accounts:accountCatalog,providerMode:generated.mode,compatibilityRepair,activeStrategySnapshotId:activeStrategy?.id||null,readiness:strategyDecisionReadiness(record,sessionMeta,{socialAccounts:accountCatalog})});
    }
    if(req.method==="PUT"&&action==="selection"){
      const payload=await bodyJson(req);const previous=getStrategyDecisionRecord(session.id);
      if(!previous)return sendJson(res,409,{error:"请先生成账号与增长策略建议",code:"STRATEGY_DECISION_PREVIEW_MISSING"});
      const selection=normalizeStrategyDecisionSelection(payload,previous.preview,accounts);const validation=validateStrategyDecisionSelection(selection,accounts);
      if(!validation.valid)return sendJson(res,400,{error:"策略决策没有通过校验",code:"STRATEGY_DECISION_INVALID",details:validation.errors});
      const record=saveStrategyDecisionRecord({sessionId:session.id,accountId:session.accountId,preview:previous.preview,selection,status:"editing",claimRevision:sessionMeta?.claimRevision,factRevision:sessionMeta?.factRevision});
      markStrategyDraftsStale(session.id,"账号身份、账号组合或增长打法已调整");
      return sendJson(res,200,{record,validation,accounts:accountCatalog,readiness:strategyDecisionReadiness(record,sessionMeta,{socialAccounts:accountCatalog})});
    }
    if(req.method==="POST"&&action==="confirm"){
      const payload=await bodyJson(req);const previous=getStrategyDecisionRecord(session.id);
      if(!previous)return sendJson(res,409,{error:"请先生成账号与增长策略建议",code:"STRATEGY_DECISION_PREVIEW_MISSING"});
      const selection=normalizeStrategyDecisionSelection(payload?.selection||previous.selection,previous.preview,accounts);const validation=validateStrategyDecisionSelection(selection,accounts);
      const identityErrors=accountIdentitySelectionErrors(store,session.accountId,selection);
      if(!validation.valid||identityErrors.length)return sendJson(res,400,{error:"仍有账号身份或增长打法尚未完成",code:"STRATEGY_DECISION_INVALID",details:[...validation.errors,...identityErrors.map((item)=>item.message)],accountIdentityErrors:identityErrors});
      persistConfirmedAccountIdentities(store,session.accountId,selection,{activeStrategy:getActiveStrategySnapshot(session.accountId)});
      await writeStore(store);
      const record=saveStrategyDecisionRecord({sessionId:session.id,accountId:session.accountId,preview:previous.preview,selection,status:"confirmed",claimRevision:sessionMeta?.claimRevision,factRevision:sessionMeta?.factRevision});
      updateDiagnosticSessionMeta(session.id,{conversationPhase:"strategy_decision_confirmed"});
      const refreshedCatalog=strategyAccountCatalog(store,session.accountId);
      return sendJson(res,200,{record,validation,accounts:refreshedCatalog,readiness:strategyDecisionReadiness(record,sessionMeta,{socialAccounts:refreshedCatalog}),draftReadiness:currentStrategyReadiness(session)});
    }
  }
  const agentDraftReadinessMatch = path.match(/^\/agent\/sessions\/([^/]+)\/strategy-draft\/readiness$/);
  if (req.method === "GET" && agentDraftReadinessMatch) {
    const session = getDiagnosticSession(agentDraftReadinessMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const claims = listCurrentProfileClaims(session.id);
    return sendJson(res, 200, currentStrategyReadiness(session));
  }
  const agentDraftRequestMatch=path.match(/^\/agent\/sessions\/([^/]+)\/strategy-draft\/requests\/([^/]+)$/);
  if(req.method==="GET"&&agentDraftRequestMatch){
    const session=getDiagnosticSession(agentDraftRequestMatch[1]);
    if(!session)return sendJson(res,404,{error:"Diagnostic session not found"});
    const requestedId=decodeURIComponent(agentDraftRequestMatch[2]);
    const draftRequest=getStrategyDraftRequest(session.id,requestedId);
    if(!draftRequest){
      if(requestedId==="latest")return sendJson(res,200,{draftRequest:null,draft:null,draftRevision:null,validation:null,readiness:currentStrategyReadiness(session),activeStrategy:getActiveStrategySnapshot(session.accountId)});
      return sendJson(res,404,{error:"Strategy draft request not found",code:"STRATEGY_DRAFT_REQUEST_NOT_FOUND"});
    }
    const revision=draftRequest.draftRevisionId?getStrategyDraftRevision(draftRequest.draftRevisionId):null;
    return sendJson(res,200,{draftRequest,draft:revision?.draft||null,draftRevision:revision,validation:revision?.validation||null,readiness:currentStrategyReadiness(session),activeStrategy:getActiveStrategySnapshot(session.accountId)});
  }
  const agentRepairPreviewMatch = path.match(/^\/agent\/sessions\/([^/]+)\/repair-preview$/);
  if (req.method === "GET" && agentRepairPreviewMatch) {
    const session = getDiagnosticSession(agentRepairPreviewMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    return sendJson(res, 200, buildSessionRepairPreview({ session, turns: listDiagnosticTurns(session.id), claims: listCurrentProfileClaims(session.id) }));
  }
  const agentDraftMatch = path.match(/^\/agent\/sessions\/([^/]+)\/strategy-draft$/);
  if (req.method === "POST" && agentDraftMatch) {
    const session = getDiagnosticSession(agentDraftMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const payload=await bodyJson(req);
    const requestId=/^draftreq_[A-Za-z0-9_-]+$/.test(String(payload.requestId||""))?String(payload.requestId):`draftreq_${randomUUID().slice(0,12)}`;
    const existing=getStrategyDraftRequest(session.id,requestId);
    if(existing)return sendJson(res,existing.status==="succeeded"?200:202,{draftRequest:existing,recovered:true});
    markStrategyDraftsStale(session.id,"已开始生成新的策略草案修订");
    const draftRequest=createStrategyDraftRequest({requestId,sessionId:session.id,accountId:session.accountId});
    const work=generateStrategyDraftForRequest(session.id,requestId);
    if(payload.async===true){
      work.catch((error)=>console.error(`[${requestId}] strategy draft generation failed:`,error.message));
      return sendJson(res,202,{draftRequest,retryUrl:`/agent/sessions/${encodeURIComponent(session.id)}/strategy-draft/requests/${encodeURIComponent(requestId)}`});
    }
    try {
      return sendJson(res,201,await work);
    } catch(error) {
      return sendJson(res,error.statusCode||500,{error:error.message,code:error.code||"STRATEGY_DRAFT_REQUEST_FAILED",details:error.details||[],draftRequest:getStrategyDraftRequest(session.id,requestId)});
    }
  }
  const agentActivateMatch = path.match(/^\/agent\/sessions\/([^/]+)\/activate$/);
  if (req.method === "POST" && agentActivateMatch) {
    const session = getDiagnosticSession(agentActivateMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const activationReadiness = currentStrategyReadiness(session);
    if (!activationReadiness.strategyDecision?.ready || activationReadiness.strategyDecision?.stale) {
      return sendJson(res, 409, {
        error: "账号身份、矩阵和增长打法需要确认，且确认后不能被新事实覆盖。请刷新建议并重新确认。",
        code: "STRATEGY_DECISION_NOT_READY",
        readiness: activationReadiness
      });
    }
    const payload = await bodyJson(req);
    let snapshot;
    try {
      snapshot = activateConfirmedStrategyDraft({ sessionId: session.id, draftRevisionId: payload.draftRevisionId });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "STRATEGY_ACTIVATION_FAILED", details: error.details || [] });
    }
    const accountRecord = (store.accounts || []).find((item) => item.id === session.accountId);
    if (!accountRecord) return sendJson(res, 409, { error: "诊断绑定的公司账号不存在" });
    const synchronized=await synchronizeStrategyDownstream(snapshot, accountRecord);
    const refreshedStore=ensureWorkspaceContext(readStore());
    return sendJson(res, 201, {
      ...synchronized,
      strategySessionState:currentStrategySessionState(session),
      contentPlanningReadiness:contentPlanningReadiness(refreshedStore,session.accountId)
    });
  }
  if (req.method === "POST" && path === "/diagnostics") {
    const payload = await bodyJson(req);
    return sendJson(res, 201, startDiagnostic({ accountId: payload.accountId, mode: payload.mode || "quick", openingMessage: payload.openingMessage || null }));
  }
  const diagnosticMatch = path.match(/^\/diagnostics\/([^/]+)$/);
  if (req.method === "GET" && diagnosticMatch) {
    const session = getDiagnosticSession(diagnosticMatch[1]);
    if (!session) return sendJson(res, 404, { error: "Diagnostic session not found" });
    const consistencyRepair=repairSessionConsistency(session.id);
    const claims = listCurrentProfileClaims(session.id);
    const facts = listSessionProfileFacts(session.accountId, session.id);
    const historicalFacts = listHistoricalProfileFacts(session.accountId, session.id);
    const fieldStates = listDiagnosticFieldStates(session.id);
    const draftReadiness = currentStrategyReadiness(session);
    return sendJson(res, 200, { session,consistencyRepair, sessionMeta: getDiagnosticSessionMeta(session.id), sessionContext: getDiagnosticSessionContext(session.id), turns: listDiagnosticTurns(session.id), claims, facts, historicalFacts, fieldStates, recommendations: listAgentRecommendations(session.id), pendingRecommendation: getPendingAgentRecommendation(session.id), strategyDraft: getStrategyDraftCache(session.id), strategyDraftRevision: getLatestStrategyDraftRevision(session.id),strategyDecisionRecord:getStrategyDecisionRecord(session.id), knowledgeLinks: listDiagnosticKnowledgeFiles(session.id), knowledgeCandidates: listDiagnosticDocumentCandidates(session.id), draftReadiness,strategySessionState:currentStrategySessionState(session), pendingQuestion: getPendingDiagnosticQuestion(session.id), pendingEnrichmentQuestion: getPendingEnrichmentQuestion(session.id), enrichmentQuestions: listEnrichmentQuestions(session.id), progress: { ...evaluateDiagnosticCompleteness(claims), ...evaluateProfileMetrics(claims, facts), readyToDraft: draftReadiness.canGenerateDraft },diagnosticSummary:diagnosticSummaryFor(session.id) });
  }
  const diagnosticAnalysisMatch = path.match(/^\/diagnostics\/([^/]+)\/analysis$/);
  if (req.method === "POST" && diagnosticAnalysisMatch) {
    const payload = await bodyJson(req);
    return sendJson(res, 201, recordDiagnosticAnalysis({ sessionId: diagnosticAnalysisMatch[1], userMessage: payload.userMessage, analysis: payload.analysis || {}, sourceTurnId: payload.sourceTurnId || null }));
  }
  const diagnosticStrategyMatch = path.match(/^\/diagnostics\/([^/]+)\/strategy$/);
  if (req.method === "POST" && diagnosticStrategyMatch) {
    const payload = await bodyJson(req);
    return sendJson(res, 201, confirmStrategy({ sessionId: diagnosticStrategyMatch[1], accountId: payload.accountId, strategy: payload.strategy || {} }));
  }
  const activeStrategyMatch = path.match(/^\/accounts\/([^/]+)\/strategy-snapshots\/active$/);
  if (req.method === "GET" && activeStrategyMatch) {
    const snapshot = getActiveStrategySnapshot(activeStrategyMatch[1]);
    return snapshot ? sendJson(res, 200, snapshot) : sendJson(res, 404, { error: "Active strategy snapshot not found" });
  }
  const strategyHistoryMatch = path.match(/^\/agent\/accounts\/([^/]+)\/strategy-snapshots$/);
  if (req.method === "GET" && strategyHistoryMatch) {
    return sendJson(res, 200, { accountId: strategyHistoryMatch[1], items: listStrategySnapshots(strategyHistoryMatch[1]) });
  }
  const strategyRollbackMatch = path.match(/^\/agent\/accounts\/([^/]+)\/strategy-snapshots\/([^/]+)\/rollback$/);
  if (req.method === "POST" && strategyRollbackMatch) {
    const [, accountId, targetSnapshotId] = strategyRollbackMatch;
    const accountRecord = (store.accounts || []).find((item) => item.id === accountId);
    if (!accountRecord) return sendJson(res, 404, { error: "公司账号不存在" });
    try {
      const snapshot = rollbackStrategySnapshot({ accountId, targetSnapshotId });
      return sendJson(res, 201, await synchronizeStrategyDownstream(snapshot, accountRecord));
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "STRATEGY_ROLLBACK_FAILED", details: error.details || [] });
    }
  }
  const strategyHierarchyMatch = path.match(/^\/companies\/([^/]+)\/strategy-hierarchy$/);
  if (req.method === "GET" && strategyHierarchyMatch) {
    const companyId = strategyHierarchyMatch[1];
    const ownership = resolveOwnershipContext(store, { companyId, socialAccountId: url.searchParams.get("socialAccountId") || null });
    if (!ownership.company) return sendJson(res, 404, { error: "公司不存在" });
    const matrix = getCompanyMatrix(store, companyId);
    const hierarchy = listStrategyHierarchy(store, { companyId, matrixId: matrix?.id || null, socialAccountId: ownership.socialAccountId });
    const effectiveStrategy = ownership.socialAccountId ? effectiveStrategyFor(store, ownership) : null;
    return sendJson(res, 200, { ownership, matrix, ...hierarchy, effectiveStrategy });
  }
  const matrixStrategyMatch = path.match(/^\/companies\/([^/]+)\/matrix-strategy-snapshots$/);
  if (req.method === "POST" && matrixStrategyMatch) {
    try {
      const companyId = matrixStrategyMatch[1];
      const ownership = assertOwnershipContext(resolveOwnershipContext(store, { companyId }));
      const matrix = getCompanyMatrix(store, companyId);
      const payload = await bodyJson(req);
      const snapshot = saveMatrixStrategySnapshot(store, { workspaceId: ownership.workspaceId, companyId, matrixId: matrix.id, payload: payload.strategy || payload, status: payload.status || "active" });
      await writeStore(store);
      return sendJson(res, 201, snapshot);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "MATRIX_STRATEGY_SAVE_FAILED" });
    }
  }
  const accountStrategyMatch = path.match(/^\/social-accounts\/([^/]+)\/strategy-snapshots$/);
  if (req.method === "POST" && accountStrategyMatch) {
    try {
      const payload = await bodyJson(req);
      const socialAccountId = accountStrategyMatch[1];
      const ownership = assertSocialAccountOwnership(store, { companyId: payload.companyId, socialAccountId });
      const snapshot = saveAccountStrategySnapshot(store, { workspaceId: ownership.workspaceId, companyId: ownership.companyId, matrixId: ownership.company.matrixId, socialAccountId, payload: payload.strategy || payload, status: payload.status || "active" });
      await writeStore(store);
      return sendJson(res, 201, snapshot);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "ACCOUNT_STRATEGY_SAVE_FAILED" });
    }
  }
  const effectiveStrategyMatch = path.match(/^\/social-accounts\/([^/]+)\/effective-strategy$/);
  if (req.method === "GET" && effectiveStrategyMatch) {
    try {
      const ownership = assertSocialAccountOwnership(store, { companyId: url.searchParams.get("companyId") || null, socialAccountId: effectiveStrategyMatch[1] });
      const effectiveStrategy = effectiveStrategyFor(store, ownership);
      return effectiveStrategy ? sendJson(res, 200, effectiveStrategy) : sendJson(res, 404, { error: "公司尚未激活策略" });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code });
    }
  }
  if (req.method === "GET" && path === "/content-agent/publishing-cycles") {
    const companyId = url.searchParams.get("companyId");
    const socialAccountId = url.searchParams.get("socialAccountId");
    return sendJson(res, 200, {
      items: listCycleWorkbenchPlans(store, { companyId, socialAccountId }),
      legacyPlans: listRollingContentPlans(store, { companyId, socialAccountId })
    });
  }
  if (req.method === "POST" && path === "/content-agent/publishing-cycles") {
    const payload = await bodyJson(req);
    try {
      const companyOwnership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: payload.companyId }));
      const planningReadiness = contentPlanningReadiness(store, companyOwnership.companyId);
      if (!planningReadiness.ready) return sendJson(res, 409, { error: "当前公司尚未完成新版策略与账号打法确认", code: "CONTENT_PLANNING_NOT_READY", readiness: planningReadiness, details: planningReadiness.blockers });
      const strategySnapshot = getActiveStrategySnapshot(companyOwnership.companyId);
      const accounts = resolvePlanningAccounts({ accounts: companySocialAccounts(store, companyOwnership.companyId), strategySnapshot });
      const strategyAdjustments = resolveConfirmedStrategyAdjustmentInputs(store, {
        companyId: companyOwnership.companyId,
        decisionIds: payload.strategyAdjustmentDecisionIds || [],
        activeStrategySnapshotId: strategySnapshot?.id || null
      });
      const cycleDays = [7, 14, 30].includes(Number(payload.cycleDays)) ? Number(payload.cycleDays) : 14;
      const itemsPerAccount = Math.max(1, Math.min(12, Number(payload.itemsPerAccount) || 3));
      const accountPlans = accounts.map((account) => {
        const ownership = { ...assertSocialAccountOwnership(store, { companyId: companyOwnership.companyId, socialAccountId: account.id }), selectionSource: (payload.socialAccountIds || []).includes(account.id) ? "user_confirmed" : "strategy_selected" };
        const effectiveSnapshot = effectiveStrategyFor(store, ownership, strategySnapshot);
        const accountContext = buildContentAccountContext({ ownership, strategySnapshot, effectiveStrategy: effectiveSnapshot });
        const policy = effectiveSnapshot.document?.strategy?.accountPolicy || {};
        const planned = attachContentAccountContext(planContentFromWorkspace({
          payload: { inputMode: "active_strategy", platform: account.platform, limit: itemsPerAccount, workspaceId: ownership.workspaceId, companyId: ownership.companyId, socialAccountId: account.id, accountId: account.id, featureFlags: featureFlags() },
          store,
          activeStrategySnapshot: effectiveSnapshot,
          currentFacts: listCurrentProfileFacts(companyOwnership.companyId),
          factSnapshot: (strategySnapshot.document?.governance?.factSnapshotId || strategySnapshot.payload?.governance?.factSnapshotId) ? getFactSnapshot(strategySnapshot.document?.governance?.factSnapshotId || strategySnapshot.payload?.governance?.factSnapshotId) : saveCurrentFactSnapshot(companyOwnership.companyId),
          knowledgeItems: listKnowledgeFiles({ companyId: companyOwnership.companyId }),
          ownershipContext: ownership,
          viralLearningEnabled: false
        }), accountContext);
        return {
          account,
          socialAccountId: account.id,
          growthPlaybookId: policy.growthPlaybook || policy.selectedPlaybookId,
          playbookVersion: policy.playbookVersion || "1.0",
          cadenceRange: policy.recommendedCadence || { minItems: 1, maxItems: itemsPerAccount, windowDays: cycleDays },
          platformCapability: { cadenceRange: { minItems: 0, maxItems: itemsPerAccount, windowDays: cycleDays }, source: "workbench_user_target" },
          recommendations: planned.recommendations || [],
          nextCycleContentPortfolio: planned.nextCycleContentPortfolio || null,
          contentPillars: planned.strategyProfile?.contentPillars || planned.contentStrategyProfile?.contentPillars || [],
          experiment: strategyAdjustments.experimentByAccount[account.id] || policy.experimentPlan || null
        };
      });
      const total = Math.max(1, accounts.length * itemsPerAccount);
      const plan = createPublishingCyclePlan({
        ownership: companyOwnership,
        strategySnapshot,
        accounts,
        accountPlans,
        platformCapabilities: Object.fromEntries(accountPlans.map((item) => [item.account.platform, item.platformCapability])),
        capacity: payload.capacity || { research: total, copy: total, visual: total, review: total, publishCommunity: total },
        inventory: payload.inventory || { topics: accountPlans.reduce((sum, item) => sum + item.recommendations.length, 0), evidence: total },
        cycleStart: payload.cycleStart || new Date().toISOString().slice(0, 10),
        cycleDays,
        freezeDays: Number.isFinite(Number(payload.freezeDays)) ? Number(payload.freezeDays) : Math.min(7, cycleDays),
        userDecisions: [...(payload.userDecisions || []), ...strategyAdjustments.userDecisions],
        existingPublishingCyclePlans: store.publishingCyclePlans || []
      });
      plan.objective = String(payload.objective || "按当前活动策略完成近期承诺内容，并为反馈保留调整空间");
      const saved = saveCycleWorkbenchPlan(store, plan);
      const plannedAdjustmentIds = new Set((saved.plan.userDecisions || []).map((item) => item.strategyAdjustmentDecisionRef?.id).filter(Boolean));
      if (strategyAdjustments.decisionRefs.some((item) => !plannedAdjustmentIds.has(item.id))) {
        throw Object.assign(new Error("现有周期未绑定本次策略调整决策，请选择新的周期起始日期"), { code: "PUBLISHING_CYCLE_STRATEGY_ADJUSTMENT_MISMATCH", statusCode: 409 });
      }
      const bindings = strategyAdjustments.decisionRefs.length
        ? bindStrategyAdjustmentsToCycle(store, strategyAdjustments.decisionRefs, saved.plan.cycleId, { companyId: companyOwnership.companyId })
        : [];
      const injectedActions = bindFeedbackActionsToCycle(store, saved.plan);
      if (saved.created || bindings.length || injectedActions.length) await writeStore(store);
      return sendJson(res, saved.created ? 201 : 200, { ...saved.plan, idempotentReplay: !saved.created });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "PUBLISHING_CYCLE_CREATE_FAILED", details: error.details || [] });
    }
  }
  const cycleConfirmMatch = path.match(/^\/content-agent\/publishing-cycles\/([^/]+)\/confirm$/);
  if (req.method === "POST" && cycleConfirmMatch) {
    const payload = await bodyJson(req);
    try { const result = confirmCycleWorkbenchPlan(store, cycleConfirmMatch[1], payload); if (result.changed) await writeStore(store); return sendJson(res, 200, { ...result.plan, idempotentReplay: !result.changed }); }
    catch (error) { return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "PUBLISHING_CYCLE_CONFIRM_FAILED", details: error.details || [] }); }
  }
  const cycleSlotMatch = path.match(/^\/content-agent\/publishing-cycles\/([^/]+)\/slots\/([^/]+)$/);
  if (req.method === "PATCH" && cycleSlotMatch) {
    const payload = await bodyJson(req);
    try { const result = adjustCycleWorkbenchSlot(store, cycleSlotMatch[1], cycleSlotMatch[2], payload, { actor: payload.changedBy || payload.actor }); await writeStore(store); return sendJson(res, 200, result.plan); }
    catch (error) { return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "PUBLISHING_CYCLE_SLOT_UPDATE_FAILED", details: error.details || [] }); }
  }
  if (req.method === "GET" && path === "/content-agent/rolling-plans") {
    return sendJson(res, 200, { items: listRollingContentPlans(store, { companyId: url.searchParams.get("companyId"), socialAccountId: url.searchParams.get("socialAccountId"), status: url.searchParams.get("status") }) });
  }
  if (req.method === "POST" && path === "/content-agent/rolling-plans") {
    const payload = await bodyJson(req);
    try {
      const companyOwnership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: payload.companyId }));
      const planningReadiness=contentPlanningReadiness(store,companyOwnership.companyId);
      if(!planningReadiness.ready)return sendJson(res,409,{error:"当前公司尚未完成新版策略与账号打法确认",code:"CONTENT_PLANNING_NOT_READY",readiness:planningReadiness,details:planningReadiness.blockers});
      const companySnapshot = getActiveStrategySnapshot(companyOwnership.companyId);
      if (!companySnapshot) throw Object.assign(new Error("当前公司尚未激活策略"), { statusCode: 409 });
      const portfolioMode=companySnapshot.document?.strategyExtensions?.accountPortfolio?.mode||companySnapshot.payload?.strategyExtensions?.accountPortfolio?.mode||"legacy";
      if(portfolioMode==="role_matrix"&&!(payload.socialAccountIds||[]).length){
        const selectionError=new Error("矩阵模式下必须明确选择本次计划使用的社媒账号");
        selectionError.statusCode=409;
        selectionError.code="SOCIAL_ACCOUNT_SELECTION_REQUIRED";
        selectionError.details={selectableAccounts:companySocialAccounts(store,companyOwnership.companyId).map((item)=>({socialAccountId:item.id,name:item.name,platform:item.platform}))};
        throw selectionError;
      }
      const accounts = resolvePlanningAccounts({accounts:companySocialAccounts(store, companyOwnership.companyId),strategySnapshot:companySnapshot,requestedIds:payload.socialAccountIds});
      if (!accounts.length) throw new Error("当前公司没有可规划的社媒账号");
      const activatedFactSnapshotId = companySnapshot.document?.governance?.factSnapshotId || companySnapshot.payload?.governance?.factSnapshotId;
      const factSnapshot = activatedFactSnapshotId ? getFactSnapshot(activatedFactSnapshotId) : saveCurrentFactSnapshot(companyOwnership.companyId);
      const currentFacts = listCurrentProfileFacts(companyOwnership.companyId);
      const knowledgeItems = listKnowledgeFiles({ companyId: companyOwnership.companyId });
      const accountPlans = accounts.map((account) => {
        const ownership = { ...assertSocialAccountOwnership(store, { companyId: companyOwnership.companyId, socialAccountId: account.id }), selectionSource: (payload.socialAccountIds||[]).includes(account.id) ? "user_confirmed" : "single_account_default" };
        const effectiveSnapshot = effectiveStrategyFor(store, ownership, companySnapshot);
        const accountContext=buildContentAccountContext({ownership,strategySnapshot:companySnapshot,effectiveStrategy:effectiveSnapshot});
        const cadence=effectiveSnapshot.document?.strategy?.accountPolicy?.recommendedCadence || {};
        const requestedLimit=Math.max(1,Number(payload.itemsPerAccount||3));
        const cadenceLimit=Math.max(1,Math.ceil(Number(cadence.items||requestedLimit)*Number(payload.windowDays||7)/Number(cadence.windowDays||payload.windowDays||7)));
        const plan = attachContentAccountContext(planContentFromWorkspace({
          payload: { inputMode: "active_strategy", platform: account.platform, limit: Math.min(requestedLimit,cadenceLimit), workspaceId: ownership.workspaceId, companyId: ownership.companyId, socialAccountId: account.id, accountId: account.id },
          store,
          activeStrategySnapshot: effectiveSnapshot,
          currentFacts,
          factSnapshot,
          knowledgeItems,
          ownershipContext: ownership,
          viralLearningEnabled: featureFlags().viralLearningV1
        }),accountContext);
        plan.effectiveStrategyId = effectiveSnapshot.effectiveStrategyId;
        return { account, plan };
      });
      const rollingPlan = createRollingContentPlan({ ownership: companyOwnership, strategySnapshot: companySnapshot, windowDays: payload.windowDays, accountPlans, objective: payload.objective, experiment: payload.experiment });
      for(const item of rollingPlan.items||[]){
        const accountPlan=accountPlans.find((entry)=>entry.account.id===item.socialAccountId);
        item.accountContext=accountPlan?.plan?.accountContext||null;
      }
      saveRollingContentPlan(store, rollingPlan);
      await writeStore(store);
      return sendJson(res, 201, rollingPlan);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "ROLLING_PLAN_CREATE_FAILED", details: error.details || [] });
    }
  }
  if (req.method === "GET" && path === "/content-agent/opportunities") {
    return sendJson(res, 200, { items: listContentOpportunities(store, { companyId: url.searchParams.get("companyId"), socialAccountId: url.searchParams.get("socialAccountId"), sourceType: url.searchParams.get("sourceType"), status: url.searchParams.get("status") }) });
  }
  if (req.method === "POST" && path === "/content-agent/opportunities") {
    const payload = await bodyJson(req);
    try {
      const ownership = assertSocialAccountOwnership(store, { companyId: payload.companyId, socialAccountId: payload.socialAccountId || payload.accountId });
      let sourceId = payload.sourceId;
      let topic = payload.topic;
      let angle = payload.angle;
      let metadata = payload.metadata || {};
      if (payload.sourceType === "hotspot") {
        const hotspot = ensureHotspotLibrary(store).find((item) => item.id === payload.sourceId);
        if (hotspot?.companyId && hotspot.companyId !== ownership.companyId) {
          const scopeError = new Error("该热点资产不属于当前公司");
          scopeError.code = "HOTSPOT_ASSET_SCOPE_MISMATCH";
          throw scopeError;
        }
        assertHotspotContentEligibility(hotspot, {
          weakExperimentConfirmed: metadata.weakExperimentConfirmed === true
        });
        sourceId = hotspot.id;
        topic = topic || hotspot.title;
        angle = angle || hotspot.recommendedAngles?.[0] || hotspot.relevanceReason || "";
        metadata = {
          ...metadata,
          hotspotSnapshot: structuredClone(hotspot),
          hotspotAssetId: hotspot.id,
          hotspotRelevanceTier: hotspot.relevanceTier,
          hotspotSourceUrl: hotspot.sourceUrl,
          weakExperimentConfirmed:
            hotspot.relevanceTier === "weak_experiment"
              ? metadata.weakExperimentConfirmed === true
              : false,
          sourceBoundary: "external_event_not_business_fact"
        };
      }
      const opportunity = createContentOpportunity(store, { ownership, platform: payload.platform || ownership.socialAccount.platform, sourceType: payload.sourceType, sourceId, topic, angle, contentPurposeId: payload.contentPurposeId, preferredSourceMode: payload.preferredSourceMode, metadata });
      const baseSnapshot=getActiveStrategySnapshot(ownership.companyId);
      const effectiveSnapshot=baseSnapshot?effectiveStrategyFor(store,ownership,baseSnapshot):null;
      opportunity.accountContext=baseSnapshot?buildContentAccountContext({ownership:{...ownership,selectionSource:"user_confirmed"},strategySnapshot:baseSnapshot,effectiveStrategy:effectiveSnapshot}):null;
      await writeStore(store);
      return sendJson(res, 201, opportunity);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "CONTENT_OPPORTUNITY_CREATE_FAILED" });
    }
  }
  const opportunityAdoptionMatch = path.match(/^\/content-agent\/opportunities\/([^/]+)\/adopt-to-unified-project$/);
  if (req.method === "POST" && opportunityAdoptionMatch) {
    const payload = await bodyJson(req);
    try {
      if (Array.isArray(payload.userRequest?.userMaterials) && payload.userRequest.userMaterials.length) {
        throw Object.assign(new Error("临时素材尚未形成统一链路的不可变引用，请先录入知识资产后再创建内容项目"), {
          code: "UNIFIED_CONTENT_TEMPORARY_MATERIAL_AUTHORITY_REQUIRED",
          statusCode: 409
        });
      }
      ensureOperatingPlans(store);
      const opportunity = store.contentOpportunities.find((item) => item.id === opportunityAdoptionMatch[1]);
      if (!opportunity) return sendJson(res, 404, { error: "内容机会不存在", code: "CONTENT_OPPORTUNITY_NOT_FOUND" });
      const result = adoptOpportunityToUnifiedProject(store, opportunity, {
        actor: payload.actor || "workspace_user",
        flags: featureFlags(),
        getActiveStrategySnapshot,
        listCompanySocialAccounts: companySocialAccounts
      });
      if (result.created || result.changed) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, { ...result, idempotentReplay: !result.created && !result.changed });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_CONTENT_OPPORTUNITY_ADOPTION_FAILED", details: error.details || [] });
    }
  }
  if (req.method === "POST" && path === "/content-agent/plan") {
    const payload = await bodyJson(req);
    if (!["xiaohongshu", "wechat"].includes(payload.platform || "xiaohongshu")) {
      return sendJson(res, 400, { error: "platform must be xiaohongshu or wechat" });
    }
    try {
      const companyContext=payload.inputMode === "mock" ? null : assertOwnershipContext(resolveOwnershipContext(store,{companyId:payload.companyId,accountId:payload.accountId,socialAccountId:payload.socialAccountId}));
      const snapshot = payload.inputMode === "mock" ? null : getActiveStrategySnapshot(companyContext.companyId);
      const ownership=payload.inputMode === "mock" ? null : resolveContentAccountContext(store,{companyId:companyContext.companyId,accountId:payload.accountId,socialAccountId:payload.socialAccountId,platform:payload.platform||"xiaohongshu",strategySnapshot:snapshot});
      const accountSelection = ownership ? requireContentAccountSelection(store, { ...payload, selectionSource: ownership.selectionSource }, ownership) : null;
      const scopedSnapshot=snapshot ? effectiveStrategyFor(store, ownership, snapshot) : null;
      const accountContext=ownership?buildContentAccountContext({ownership,strategySnapshot:snapshot,effectiveStrategy:scopedSnapshot}):null;
      const currentFacts = payload.inputMode === "mock" ? [] : listCurrentProfileFacts(ownership.companyId);
      const activatedFactSnapshotId=snapshot?.document?.governance?.factSnapshotId||snapshot?.payload?.governance?.factSnapshotId;
      const factSnapshot = payload.inputMode === "mock" ? null : (payload.useLatestFacts===true?saveCurrentFactSnapshot(ownership.companyId):(activatedFactSnapshotId?getFactSnapshot(activatedFactSnapshotId):saveCurrentFactSnapshot(ownership.companyId)));
      const scopedPayload=payload.inputMode === "mock" ? payload : { ...payload,workspaceId:ownership.workspaceId,companyId:ownership.companyId,socialAccountId:ownership.socialAccountId,accountId:ownership.socialAccountId,selectionSource:accountSelection.selectionSource };
      const result = planContentFromWorkspace({
        payload:scopedPayload,
        store,
        activeStrategySnapshot: scopedSnapshot,
        currentFacts,
        factSnapshot,
        knowledgeItems: listKnowledgeFiles({ companyId: ownership?.companyId || null }),
        ownershipContext: ownership,
        viralLearningEnabled: featureFlags().viralLearningV1
      });
      if (featureFlags().viralLearningV1) await writeStore(store);
      const contextualResult=accountContext?attachContentAccountContext(result,accountContext):result;
      return sendJson(res, 200, { ...contextualResult,ownership:ownership?{workspaceId:ownership.workspaceId,companyId:ownership.companyId,socialAccountId:ownership.socialAccountId,selectionSource:accountSelection.selectionSource}:null });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message,code:error.code||"CONTENT_ACCOUNT_CONTEXT_FAILED",details:error.details||null });
    }
  }
  if (req.method === "GET" && path === "/content-agent/history") {
    return sendJson(res, 200, buildContentHistoryIndex(store, {
      accountId: url.searchParams.get("accountId") || null,
      featureFlags: featureFlags()
    }));
  }
  if (req.method === "GET" && path === "/content-agent/feedback") {
    return sendJson(res, 200, buildFeedbackWorkspace(store, {
      accountId: url.searchParams.get("accountId") || null,
      strategySnapshotId: url.searchParams.get("strategySnapshotId") || null,
      featureFlags: featureFlags()
    }));
  }
  if (req.method === "GET" && path === "/content-agent/metric-dictionary") {
    return sendJson(res, 200, metricDictionary(url.searchParams.get("platform") || null));
  }
  if (req.method === "POST" && path === "/content-agent/metric-imports/preview") {
    try {
      const batch = previewMetricImport(store, await bodyJson(req), { featureFlags: featureFlags() });
      await writeStore(store);
      return sendJson(res, 201, batch);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }
  const metricImportConfirmMatch = path.match(/^\/content-agent\/metric-imports\/([^/]+)\/confirm$/);
  if (req.method === "POST" && metricImportConfirmMatch) {
    try {
      const batch = confirmMetricImport(store, metricImportConfirmMatch[1], await bodyJson(req), { featureFlags: featureFlags() });
      await writeStore(store);
      return sendJson(res, 200, batch);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }
  if (req.method === "GET" && path === "/content-agent/feedback-actions") {
    const accountId = url.searchParams.get("accountId");
    return sendJson(res, 200, { items: ensureFeedbackActions(store).filter((item) => !accountId || item.accountId === accountId) });
  }
  const diagnosisActionMatch = path.match(/^\/content-agent\/feedback\/diagnoses\/([^/]+)\/actions$/);
  if (req.method === "POST" && diagnosisActionMatch) {
    try {
      const payload = await bodyJson(req);
      const workspace = buildFeedbackWorkspace(store);
      const diagnosis = workspace.diagnoses.find((item) => item.id === diagnosisActionMatch[1]);
      if (!diagnosis) return sendJson(res, 404, { error: "Funnel diagnosis not found" });
      requireFeedbackResourceOwnership(store, diagnosis.accountId, payload);
      if (payload.entryMode === "legacy") assertLegacyContentRunCompatibilityRemoved({ path });
      const action = acceptFeedbackAction(store, diagnosis, payload);
      let nextContentRun = null;
      await writeStore(store);
      return sendJson(res, 201, {
        action,
        nextContentRun,
        followup: { authority: "unified_atomic", status: "accepted_for_next_cycle", sourceContentRunId: diagnosis.contentRunId, nextStep: "create_and_confirm_publishing_cycle" }
      });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "FEEDBACK_ACTION_ACCEPT_FAILED" });
    }
  }
  const feedbackActionMatch = path.match(/^\/content-agent\/feedback-actions\/([^/]+)$/);
  if (req.method === "PATCH" && feedbackActionMatch) {
    try {
      const payload = await bodyJson(req);
      const existingAction = ensureFeedbackActions(store).find((item) => item.id === feedbackActionMatch[1]);
      if (!existingAction) return sendJson(res, 404, { error: "feedback action not found" });
      requireFeedbackResourceOwnership(store, existingAction.accountId, payload);
      const action = updateFeedbackAction(store, feedbackActionMatch[1], payload);
      await writeStore(store);
      return sendJson(res, 200, action);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "FEEDBACK_ACTION_UPDATE_FAILED" });
    }
  }
  if (req.method === "GET" && path === "/content-agent/orchestration/readiness") {
    return sendJson(res, 200, buildOrchestrationReadinessReport());
  }
  if (req.method === "POST" && path === "/content-agent/orchestration/simulate") {
    try {
      return sendJson(res, 200, simulateContentOrchestration(await bodyJson(req)));
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }
  if (req.method === "POST" && path === "/content-agent/runs") {
    const payload = await bodyJson(req);
    let writeAuthority;
    try {
      writeAuthority = resolveContentChainWriteAuthority({ path, requestedMode: payload?.entryMode, flags: featureFlags() });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "CONTENT_CHAIN_WRITE_AUTHORITY_REJECTED" });
    }
    if (writeAuthority.entryMode !== "unified") return sendJson(res, 409, { error: "Unified content entry is disabled", code: "UNIFIED_CONTENT_ENTRY_DISABLED" });
    try {
      const request = payload?.bootstrapRequest || payload?.unifiedBootstrap;
      if (!request || Object.keys(payload).some((key) => !["entryMode", "bootstrapRequest", "unifiedBootstrap"].includes(key))) {
        return sendJson(res, 400, { error: "Unified Bootstrap accepts only user intent, authority refs and idempotency fields", code: "UNIFIED_CONTENT_ENTRY_REQUEST_INVALID" });
      }
      const result = await createUnifiedStagedAtomicDualBootstrap(store, request, {
        ...unifiedContentServerDependencies, featureFlags: featureFlags(),
        planBootstrap: (input) => planUnifiedStagedAtomicDualBootstrap(store, input, unifiedContentServerDependencies)
      });
      if (result.created) await unifiedContentServerDependencies.persistStore(store);
      const bootstrap = result.bootstrap;
      return sendJson(res, result.created ? 201 : 200, {
        entryMode: "unified", bootstrapId: bootstrap.id, projectId: bootstrap.projectId,
        state: bootstrap.state, outlineRefs: bootstrap.outlineRefs,
        confirmation: bootstrap.confirmation, bootstrap
      });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, projectUnifiedStagedBootstrapError(error, "UNIFIED_CONTENT_ENTRY_REJECTED"));
    }
  }
  const cycleSlotAdoptionMatch = path.match(/^\/content-agent\/publishing-cycles\/([^/]+)\/slots\/([^/]+)\/adopt-to-unified-project$/);
  if (req.method === "POST" && cycleSlotAdoptionMatch) {
    const payload = await bodyJson(req);
    try {
      const result = adoptCycleWorkbenchSlotToUnifiedProject(store, cycleSlotAdoptionMatch[1], cycleSlotAdoptionMatch[2], {
        actor: payload.actor || "workspace_user",
        flags: featureFlags()
      });
      if (result.created || result.changed) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, {
        created: result.created,
        idempotentReplay: !result.created && !result.changed,
        projectId: result.projectId,
        entry: result.entry,
        slot: result.slot
      });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_CONTENT_ADOPTION_FAILED", details: error.details || [] });
    }
  }
  if (req.method === "GET" && path === "/content-agent/strategy-adjustments") {
    try { if (featureFlags().strategyFeedbackV1 !== true) return sendJson(res, 404, { error: "Strategy feedback is disabled", code: "STRATEGY_FEEDBACK_DISABLED" });
      const companyId = url.searchParams.get("companyId") || null;
      const socialAccountId = url.searchParams.get("socialAccountId") || url.searchParams.get("accountId") || null;
      if (socialAccountId) assertSocialAccountOwnership(store, { companyId, socialAccountId });
      const feedback = buildFeedbackWorkspace(store, { accountId: socialAccountId, companyId, socialAccountId, featureFlags: featureFlags() });
      const adjustments = buildStrategyAdjustmentWorkspace(store, feedback, { companyId, socialAccountId });
      const history = buildContentHistoryIndex(store, { accountId: socialAccountId, companyId, socialAccountId, featureFlags: featureFlags() });
      const platform = history.items?.[0]?.platform || null;
      const nextCyclePortfolio = buildNextCycleContentPortfolio({ feedbackWorkspace: feedback, historyIndex: history, strategyAdjustmentWorkspace: adjustments, tacticalLearningPack: buildTacticalLearningPack(store, { accountId: socialAccountId, platform }), companyId, socialAccountId, platform, activeStrategySnapshotId: adjustments.candidates?.[0]?.currentActiveStrategySnapshotId || getActiveStrategySnapshot(companyId)?.id || null, itemCount: Number(url.searchParams.get("itemCount")) || 3, publishingCyclePlans: store.publishingCyclePlans || [] });
      return sendJson(res, 200, { ...adjustments, nextCyclePortfolio });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "STRATEGY_ADJUSTMENT_WORKSPACE_FAILED", details: error.details || null });
    }
  }
  const strategyAdjustmentDecisionMatch = path.match(/^\/content-agent\/strategy-adjustments\/([^/]+)\/decisions$/);
  if (req.method === "POST" && strategyAdjustmentDecisionMatch) {
    try { if (featureFlags().strategyFeedbackV1 !== true) return sendJson(res, 404, { error: "Strategy feedback is disabled", code: "STRATEGY_FEEDBACK_DISABLED" });
      const payload = await bodyJson(req);
      const ownership = assertSocialAccountOwnership(store, { companyId: payload.companyId || null, socialAccountId: payload.socialAccountId });
      const feedback = buildFeedbackWorkspace(store, {
        accountId: ownership.socialAccountId,
        companyId: ownership.companyId,
        socialAccountId: ownership.socialAccountId,
        featureFlags: featureFlags()
      });
      const result = confirmStrategyAdjustmentDecision(store, feedback, strategyAdjustmentDecisionMatch[1], {
        ...payload,
        companyId: ownership.companyId,
        socialAccountId: ownership.socialAccountId
      });
      if (result.created) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "STRATEGY_ADJUSTMENT_DECISION_FAILED", details: error.details || null });
    }
  }
  const strategyDirectionsMatch = path.match(/^\/strategy-snapshots\/([^/]+)\/directions$/);
  if (req.method === "POST" && strategyDirectionsMatch) {
    const payload = await bodyJson(req);
    return sendJson(res, 201, publishDirectionSet({ strategySnapshotId: strategyDirectionsMatch[1], rawDirectionSet: payload }));
  }
  if (req.method === "GET" && strategyDirectionsMatch) {
    const directionSet = getLatestDirectionSet(strategyDirectionsMatch[1]);
    return directionSet ? sendJson(res, 200, directionSet) : sendJson(res, 404, { error: "Direction set not found" });
  }
  if (req.method === "GET" && path === "/dashboard") return sendJson(res, 200, { stats: { generated: store.contentTasks.length + 18, drafts: store.contentTasks.filter((item) => item.status === "draft").length + 7, opportunities: store.opportunities.length, knowledgeFiles: countKnowledgeFiles() }, recentTasks: store.contentTasks.slice(-5), activities: store.activityLogs.slice(-8) });
  if (req.method === "GET" && path === "/accounts") return sendJson(res, 200, { items: store.accounts.map((item)=>{const company=item.accountType==="company"?item:(store.accounts.find((candidate)=>candidate.accountType==="company"&&candidate.id===item.companyId)||null);return item.accountType==="company"?{...item,companyName:item.name}:projectSocialAccount(item,company);}) });
  if (req.method === "GET" && path === "/opportunities") {
    const directionId = url.searchParams.get("directionId");
    return sendJson(res, 200, { items: directionId ? store.opportunities.filter((item) => item.directionId === directionId) : store.opportunities });
  }
  if (req.method === "GET" && path === "/hotspots") {
    const poolType = url.searchParams.get("poolType") || "global";
    const directionId = url.searchParams.get("directionId");
    const companyId = url.searchParams.get("companyId");
    const items = (store.hotspotLibrary || []).filter((item) => item.status !== "ignored" && item.poolType === poolType && (!directionId || item.directionId === directionId) && (!companyId || (item.companyId||"account_damaishuzhi")===companyId));
    const runs = (store.hotspotRuns || []).filter((item) => item.poolType === poolType && (!directionId || item.directionId === directionId) && (!companyId || (item.companyId||"account_damaishuzhi")===companyId));
    const preview = (store.hotspotPreviews || []).filter((item) => item.run?.poolType === poolType && (!directionId || item.run?.directionId === directionId) && (!companyId || (item.companyId||item.run?.companyId||"account_damaishuzhi")===companyId)).at(-1) || null;
    return sendJson(res, 200, { poolType, directionId: directionId || null, items, latestRun: runs.at(-1) || null, preview });
  }
  if (req.method === "GET" && path === "/hotspot-library") {
    const poolType = url.searchParams.get("poolType");
    const directionId = url.searchParams.get("directionId");
    const status = url.searchParams.get("status") || "active";
    const companyId = url.searchParams.get("companyId");
    const items = (store.hotspotLibrary || []).filter((item) => (!poolType || item.poolType === poolType) && (!directionId || item.directionId === directionId) && (!status || item.status === status) && (!companyId || (item.companyId||"account_damaishuzhi")===companyId));
    const groups = [];
    const globalItems = items.filter((item) => item.poolType === "global");
    if (!poolType || poolType === "global") groups.push({ id: "global", label: "无关键词热点", poolType: "global", directionId: null, count: globalItems.length, items: globalItems });
    for (const direction of (store.contentDirections || []).filter((item)=>!companyId||(item.companyId||"account_damaishuzhi")===companyId)) {
      const directionItems = items.filter((item) => item.poolType === "keyword" && item.directionId === direction.id);
      if ((!poolType || poolType === "keyword") && (!directionId || directionId === direction.id)) groups.push({ id: direction.id, label: direction.name, poolType: "keyword", directionId: direction.id, count: directionItems.length, items: directionItems });
    }
    const knownDirectionIds = new Set((store.contentDirections || []).map((item) => item.id));
    const orphanItems = items.filter((item) => item.poolType === "keyword" && !knownDirectionIds.has(item.directionId));
    if (orphanItems.length) groups.push({ id: "unassigned", label: "待归类", poolType: "keyword", directionId: null, count: orphanItems.length, items: orphanItems });
    return sendJson(res, 200, { items, groups, total: items.length });
  }
  if (req.method === "GET" && path === "/topics") {
    const directionId = url.searchParams.get("directionId");
    const category = url.searchParams.get("category");
    const companyId = url.searchParams.get("companyId");
    const items = (store.topics || []).filter((item) => (!directionId || item.directionId === directionId) && (!category || item.topicCategory === category) && (!companyId || (item.companyId||"account_damaishuzhi")===companyId));
    return sendJson(res, 200, { items, latestRun: (store.topicRuns || []).filter((item) => (!directionId || item.directionId === directionId) && (!category || item.category === category || item.category === "all")).at(-1) || null });
  }
  if (req.method === "GET" && path === "/knowledge/entities") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const items = q ? store.knowledgeEntities.filter((item) => `${item.name} ${item.tags.join(" ")}`.toLowerCase().includes(q)) : store.knowledgeEntities;
    return sendJson(res, 200, { items });
  }
  if (req.method === "GET" && path === "/content-tasks") return sendJson(res, 200, { items: store.contentTasks });
  if (path === "/unified-content-prerequisites") {
    const flags = featureFlags();
    if (!flags.unifiedContentPrerequisitesV1) return sendJson(res, 404, { error: "Unified content prerequisites are disabled", code: "UNIFIED_CONTENT_PREREQUISITES_DISABLED" });
    if (req.method === "GET") return sendJson(res, 200, listUnifiedContentPrerequisites(store, { companyId: url.searchParams.get("companyId") }));
    if (req.method === "POST") {
      try {
        const payload = await bodyJson(req);
        const activeStrategy = getActiveStrategySnapshot(payload?.companyId);
        const result = createUnifiedContentPrerequisites(store, payload, {
          canonicalActiveStrategy: activeStrategy,
          nativeMechanismDecisionV2: flags.unifiedContentStagedAtomicDualBootstrapV1
        });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      } catch (error) {
        return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_CONTENT_PREREQUISITE_REJECTED" });
      }
    }
    return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_CONTENT_PREREQUISITE_METHOD_NOT_ALLOWED" });
  }
  if (path === "/unified-content-projects/bootstrap" && req.method === "GET") {
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic dual bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    return sendJson(res, 200, listUnifiedStagedAtomicDualBootstraps(store, {
      companyId: url.searchParams.get("companyId") || undefined,
      projectId: url.searchParams.get("projectId") || undefined,
      state: url.searchParams.get("state") || undefined
    }));
  }
  const unifiedStagedBootstrapReadMatch = path.match(/^\/unified-content-projects\/bootstrap\/([^/]+)$/);
  if (req.method === "GET" && unifiedStagedBootstrapReadMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic dual bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    try { return sendJson(res, 200, getUnifiedStagedAtomicDualBootstrap(store, unifiedStagedBootstrapReadMatch[1])); }
    catch (error) { return sendJson(res, error.statusCode || 400, projectUnifiedStagedBootstrapError(error, "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_READ_REJECTED")); }
  }
  if (req.method === "POST" && path === "/unified-content-projects/bootstrap") {
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic dual bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    let attemptId = null;
    let responseFinished = false;
    let receiptPersistence = Promise.resolve();
    const persistReceipt = () => {
      receiptPersistence = receiptPersistence.then(() => unifiedContentServerDependencies.persistStore(store));
      return receiptPersistence;
    };
    res.once("finish", () => { responseFinished = true; });
    res.once("close", () => {
      if (!responseFinished && attemptId) {
        markUnifiedContentPlanningClientDisconnected(store, attemptId);
        void persistReceipt();
      }
    });
    try {
      const payload = await bodyJson(req);
      const matchingAttempts = listUnifiedContentPlanningAttemptReceipts(store, { requestId: payload?.requestId || null, projectId: payload?.projectId || null });
      const runningAttempt = matchingAttempts.findLast((item) => item.status === "running");
      if (runningAttempt) {
        return sendJson(res, 409, {
          error: "同一请求仍在处理中，请刷新状态，不要重复发起",
          code: "UNIFIED_PLANNING_REQUEST_IN_PROGRESS",
          recovery: { stage: runningAttempt.currentStage, retryable: false, requestId: runningAttempt.requestId }
        });
      }
      const resumableAttempt = matchingAttempts.findLast((item) => item.status === "failed" && item.targetPlatform === (payload?.targetPlatform || null) && item.checkpointStages?.includes("master"));
      attemptId = `planning-attempt:${randomUUID()}`;
      createUnifiedContentPlanningAttemptReceipt(store, payload, { attemptId, resumeFromAttemptId: resumableAttempt?.id || null });
      await persistReceipt();
      const attemptObserver = async (event) => {
        recordUnifiedContentPlanningInvocation(store, attemptId, event);
        await persistReceipt();
      };
      const result = await createUnifiedStagedAtomicDualBootstrap(store, payload, {
        ...unifiedContentServerDependencies, featureFlags: flags,
        planBootstrap: (input) => planUnifiedStagedAtomicDualBootstrap(store, input, { ...unifiedContentServerDependencies, attemptObserver, planningCheckpoint: getUnifiedContentPlanningAttemptCheckpoints(store, attemptId) })
      });
      finishUnifiedContentPlanningAttempt(store, attemptId, {
        status: "succeeded",
        ...createUnifiedContentPlanningSuccessBinding(result.bootstrap)
      });
      await persistReceipt();
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      const projected = projectUnifiedStagedBootstrapError(error, "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_CREATE_REJECTED");
      if (attemptId) {
        const receipt = listUnifiedContentPlanningAttemptReceipts(store).find((item) => item.id === attemptId);
        if (receipt?.status === "running") {
          finishUnifiedContentPlanningAttempt(store, attemptId, { status: "failed", failure: projected.recovery || { causeCode: projected.code } });
        }
        await persistReceipt();
      }
      return sendJson(res, error.statusCode || 400, projected);
    }
  }
  const unifiedPlatformResumeMatch = path.match(/^\/unified-content-projects\/bootstrap\/([^/]+)\/platforms\/(xiaohongshu|wechat)\/resume$/);
  if (unifiedPlatformResumeMatch) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_PLATFORM_RESUME_METHOD_NOT_ALLOWED" });
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    try {
      const [id, platform] = unifiedPlatformResumeMatch.slice(1);
      const result = await resumeUnifiedStagedAtomicPlatform(store, id, platform, await bodyJson(req), {
        featureFlags: flags,
        materializePlatformCommit: (staged) => materializeUnifiedStagedAtomicPlatform(store, staged, platform, {
          ...unifiedContentServerDependencies, featureFlags: flags
        })
      });
      if (result.created) await unifiedContentServerDependencies.persistStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      const projected = projectUnifiedStagedBootstrapError(error, "UNIFIED_PLATFORM_RESUME_REJECTED");
      recordApiError({
        requestId: `platform-resume:${unifiedPlatformResumeMatch[1]}:${unifiedPlatformResumeMatch[2]}`,
        method: req.method || "POST",
        path,
        message: JSON.stringify(projected)
      });
      return sendJson(res, error.statusCode || 400, projected);
    }
  }
  const unifiedStagedBootstrapMatch = path.match(/^\/unified-content-projects\/bootstrap\/([^/]+)\/(confirm|reject|resume)$/);
  if (unifiedStagedBootstrapMatch) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_METHOD_NOT_ALLOWED" });
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic dual bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    try {
      const [id, action] = unifiedStagedBootstrapMatch.slice(1);
      const payload = await bodyJson(req);
      const result = action === "confirm"
        ? confirmUnifiedStagedAtomicDualBootstrap(store, id, payload, { featureFlags: flags })
        : action === "reject"
          ? rejectUnifiedStagedAtomicDualBootstrap(store, id, payload, { featureFlags: flags })
          : await resumeUnifiedStagedAtomicDualBootstrap(store, id, payload, {
          ...unifiedContentServerDependencies, featureFlags: flags,
          materializeBootstrapCommits: (staged) => materializeUnifiedStagedAtomicDualBootstrap(store, staged, unifiedContentServerDependencies)
        });
      if (result.changed || result.created) await unifiedContentServerDependencies.persistStore(store);
      return sendJson(res, result.changed || result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, projectUnifiedStagedBootstrapError(error, "UNIFIED_STAGED_ATOMIC_BOOTSTRAP_ACTION_REJECTED"));
    }
  }
  const xhsPromotionMatch = path.match(/^\/unified-content-projects\/bootstrap\/([^/]+)\/promote-xhs-outline$/);
  if (req.method === "POST" && xhsPromotionMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic dual bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    try {
      const result = promoteConfirmedXhsOutlineSuccessor(store, await bodyJson(req), { featureFlags: flags });
      if (result.created) await unifiedContentServerDependencies.persistStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, projectUnifiedStagedBootstrapError(error, "UNIFIED_STAGED_ATOMIC_XHS_PROMOTION_REJECTED"));
    }
  }
  if (req.method === "POST" && path === "/unified-content-projects") {
    const flags = featureFlags();
    if (!flags.unifiedContentProductionV1) return sendJson(res, 404, { error: "Unified content production is disabled", code: "UNIFIED_CONTENT_PRODUCTION_DISABLED" });
    try {
      const atomicCommitsBefore = Array.isArray(store.unifiedAtomicContentCommits) ? store.unifiedAtomicContentCommits.length : 0;
      const result = await createUnifiedContentProductSnapshot(store, await bodyJson(req), {
        ...unifiedContentServerDependencies,
        serverFeatureFlags: {
          unifiedContentXhsAtomicGraphV1: flags.unifiedContentXhsAtomicGraphV1,
          unifiedContentAtomicProductV1: flags.unifiedContentAtomicProductV1
        }
      });
      const atomicCommitsAfter = Array.isArray(store.unifiedAtomicContentCommits) ? store.unifiedAtomicContentCommits.length : 0;
      if (!flags.unifiedContentAtomicProductV1 || atomicCommitsAfter > atomicCommitsBefore) await unifiedContentServerDependencies.persistStore(store);
      return sendJson(res, 201, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, {
        error: error.message,
        code: error.code || "UNIFIED_CONTENT_PRODUCTION_FAILED",
        recovery: error.recoverable === true ? { stage: error.stage || null, platform: error.platform || null, stepId: error.stepId || null, recoverableFrom: error.recoverableFrom || null } : null,
        details: error.details || null
      });
    }
  }
  if (req.method === "GET" && path === "/unified-content-projects") {
    try {
      return sendJson(res, 200, { items: listUnifiedContentProductSnapshots(store, { companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId") }, { featureFlags: featureFlags() }) });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "UNIFIED_CONTENT_PRODUCT_QUERY_REJECTED", details: error.details || null });
    }
  }
  if (await handleUnifiedWechatProductionRoute({ req, res, path, store, bodyJson, sendJson, persistStore: writeStore, resolveFeatureFlags: featureFlags, serverDependencies: unifiedContentServerDependencies })) return;
  if (path === "/unified-content-projects/planning-attempts" && req.method === "GET") {
    const companyId = url.searchParams.get("companyId") || null;
    const items = listUnifiedContentPlanningAttemptReceipts(store, {
      requestId: url.searchParams.get("requestId") || null,
      projectId: url.searchParams.get("projectId") || null
    }).filter((item) => !companyId || item.companyId === companyId);
    return sendJson(res, 200, { items });
  }
  const unifiedPlatformOutlineConfirmationMatch = path.match(/^\/unified-content-projects\/bootstrap\/([^/]+)\/platforms\/(xiaohongshu|wechat)\/outline-confirmations$/);
  if (unifiedPlatformOutlineConfirmationMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentStagedAtomicDualBootstrapV1) return sendJson(res, 404, { error: "Staged Atomic dual bootstrap is disabled", code: "UNIFIED_STAGED_ATOMIC_DUAL_BOOTSTRAP_DISABLED" });
    try {
      const bootstrap = getUnifiedStagedAtomicDualBootstrap(store, unifiedPlatformOutlineConfirmationMatch[1]);
      if (req.method === "GET") return sendJson(res, 200, listUnifiedPlatformOutlineConfirmations(store, bootstrap));
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_PLATFORM_OUTLINE_METHOD_NOT_ALLOWED" });
      const payload = await bodyJson(req);
      const result = confirmUnifiedPlatformOutline(store, bootstrap, unifiedPlatformOutlineConfirmationMatch[2], payload);
      let confirmedBootstrap = bootstrap;
      if (result.allConfirmed) {
        const confirmations = result.confirmations;
        const final = confirmUnifiedStagedAtomicDualBootstrap(store, bootstrap.id, {
          actor: { type: "user", id: Object.values(confirmations).map((item) => item.actor.id).join("+") },
          confirmedAt: payload.confirmedAt,
          outlineRefs: bootstrap.outlineRefs
        }, { featureFlags: flags });
        confirmedBootstrap = final.bootstrap;
      }
      await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, { ...result, bootstrap: confirmedBootstrap });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, projectUnifiedStagedBootstrapError(error, "UNIFIED_PLATFORM_OUTLINE_CONFIRMATION_REJECTED"));
    }
  }
  const unifiedWechatHumanReviewMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/wechat\/(preupload-artifact-review|editorial-reviews|human-selections|human-review-state)$/);
  if (unifiedWechatHumanReviewMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentProductionV1 || !flags.unifiedContentArtifactsV1 || !flags.unifiedContentAtomicProductV1
      || !flags.unifiedContentAtomicWechatProductV1 || !flags.unifiedContentAtomicWechatArtifactV1
      || !flags.unifiedContentAtomicWechatHumanSelectionV1) {
      return sendJson(res, 404, { error: "Atomic WeChat human selection is disabled", code: "UNIFIED_ATOMIC_WECHAT_HUMAN_SELECTION_DISABLED" });
    }
    const [, projectId, action] = unifiedWechatHumanReviewMatch;
    try {
      const payload = req.method === "GET"
        ? { workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId"), candidateId: url.searchParams.get("candidateId"), productSnapshotHash: url.searchParams.get("productSnapshotHash") || undefined }
        : await bodyJson(req);
      const scoped = { ...payload, projectId, platform: "wechat" };
      if (req.method === "GET" && action === "human-review-state") return sendJson(res, 200, listUnifiedAtomicWechatReviewState(store, scoped, { featureFlags: flags }));
      if (req.method !== "POST" || action === "human-review-state") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_ATOMIC_WECHAT_HUMAN_SELECTION_METHOD_NOT_ALLOWED" });
      const result = action === "preupload-artifact-review"
        ? appendUnifiedAtomicWechatArtifactReview(store, scoped, { featureFlags: flags })
        : action === "editorial-reviews"
          ? appendUnifiedAtomicWechatEditorialReview(store, scoped, { featureFlags: flags })
          : appendUnifiedAtomicWechatSelection(store, scoped, { featureFlags: flags });
      if (result.created) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_ATOMIC_WECHAT_HUMAN_SELECTION_REJECTED", details: error.details || null });
    }
  }
  const unifiedWechatDeliveryMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/wechat\/(promotion-preview|promotion-confirm|resource-upload-plan-preview|resource-upload-plan-confirm|resource-upload-executions|final-delivery|delivery-state|draft-preview|draft-executions|draft-state|publication-feedback-control-state|manual-publication-preview|manual-publication-confirm|exact-feedback-preview|exact-feedback-confirm|exact-feedback-state|publication-lifecycle-state|publication-correction|publication-takedown|publication-replacement)$/);
  if (unifiedWechatDeliveryMatch) {
    const flags = featureFlags();
    const [, projectId, action] = unifiedWechatDeliveryMatch;
    const localPromotionAction = ["promotion-preview", "promotion-confirm", "delivery-state"].includes(action);
    if (!flags.unifiedContentProductionV1 || !flags.unifiedContentArtifactsV1 || !flags.unifiedContentAtomicProductV1
      || !flags.unifiedContentAtomicWechatProductV1 || !flags.unifiedContentAtomicWechatArtifactV1
      || !flags.unifiedContentAtomicWechatHumanSelectionV1
      || (localPromotionAction ? !flags.localContentPromotionV1 : !flags.unifiedContentAtomicWechatPromotionUploadDeliveryV1)) {
      return sendJson(res, 404, { error: "Atomic WeChat promotion/upload/delivery is disabled", code: "ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_DISABLED" });
    }
    try {
      const readAction = action === "delivery-state" || action === "draft-state" || action === "publication-feedback-control-state";
      if ((readAction && req.method !== "GET") || (!readAction && req.method !== "POST")) {
        return sendJson(res, 405, { error: "Method not allowed", code: "ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_METHOD_NOT_ALLOWED" });
      }
      const payload = req.method === "GET"
        ? { workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId"), candidateId: url.searchParams.get("candidateId"), productSnapshotHash: url.searchParams.get("productSnapshotHash") || undefined }
        : await bodyJson(req);
      const scoped = { ...payload, projectId, platform: "wechat" };
      if (["draft-preview", "draft-executions", "draft-state"].includes(action)) {
        if (!flags.atomicWechatDraftCreationV1) return sendJson(res, 404, { error: "Atomic WeChat draft creation is disabled", code: "ATOMIC_WECHAT_DRAFT_CREATION_DISABLED" });
        if (action === "draft-state") return sendJson(res, 200, projectAtomicWechatDraftCreation(store, scoped, { featureFlags: flags }));
        if (action === "draft-preview") return sendJson(res, 200, previewAtomicWechatDraftCreation(store, scoped, { featureFlags: flags }));
        const draftResult = await executeAtomicWechatDraftCreation(store, { ...payload, request: scoped }, {
          featureFlags: flags, transport: unifiedContentServerDependencies.wechatDraftTransport
        });
        if (draftResult.created) await unifiedContentServerDependencies.persistStore(store);
        return sendJson(res, draftResult.created ? 201 : 200, draftResult);
      }
      if (req.method === "GET" && action === "publication-feedback-control-state") {
        return sendJson(res, 200, projectAtomicPublicationUiState(store, scoped, flags));
      }
      if (req.method === "GET" && action === "delivery-state") {
        const deliveryState = projectAtomicWechatPromotionUploadDelivery(store, scoped, { featureFlags: flags });
        if (!flags.atomicManualPublicationV1 || !deliveryState.deliveryReady) return sendJson(res, 200, deliveryState);
        const publicationState = projectAtomicManualPublication(store, scoped, { featureFlags: flags });
        return sendJson(res, 200, {
          ...deliveryState, published: publicationState.published, publicationRef: publicationState.publicationRef,
          canonicalPlatformContentId: publicationState.canonicalPlatformContentId, canonicalPlatformUrl: publicationState.canonicalPlatformUrl,
          blockers: publicationState.published ? deliveryState.blockers.filter((item) => item !== "wechat_manual_draft_or_publication_required") : deliveryState.blockers
        });
      }
      if (action === "manual-publication-preview" || action === "manual-publication-confirm") {
        if (!flags.atomicManualPublicationV1) return sendJson(res, 404, { error: "Atomic manual publication is disabled", code: "ATOMIC_MANUAL_PUBLICATION_DISABLED" });
        if (action === "manual-publication-preview") return sendJson(res, 200, previewAtomicManualPublication(store, scoped, { featureFlags: flags }));
        const publicationResult = confirmAtomicManualPublication(store, { ...payload, request: scoped }, { featureFlags: flags });
        if (publicationResult.created) await writeStore(store);
        return sendJson(res, publicationResult.created ? 201 : 200, publicationResult);
      }
      if (action === "exact-feedback-preview" || action === "exact-feedback-confirm" || action === "exact-feedback-state") {
        if (!flags.atomicExactFeedbackV1) return sendJson(res, 404, { error: "Atomic exact feedback is disabled", code: "ATOMIC_EXACT_FEEDBACK_DISABLED" });
        if (action === "exact-feedback-preview") return sendJson(res, 200, previewAtomicPublicationFeedback(store, scoped, { featureFlags: flags }));
        if (action === "exact-feedback-state") return sendJson(res, 200, projectAtomicPublicationFeedback(store, scoped, { featureFlags: flags }));
        const feedbackResult = confirmAtomicPublicationFeedback(store, { ...payload, request: scoped }, { featureFlags: flags });
        if (feedbackResult.created) await writeStore(store);
        return sendJson(res, feedbackResult.created ? 201 : 200, feedbackResult);
      }
      if (["publication-lifecycle-state", "publication-correction", "publication-takedown", "publication-replacement"].includes(action)) {
        if (!flags.atomicPublicationLifecycleV1) return sendJson(res, 404, { error: "Atomic publication lifecycle is disabled", code: "ATOMIC_PUBLICATION_LIFECYCLE_DISABLED" });
        if (action === "publication-lifecycle-state") return sendJson(res, 200, projectAtomicPublicationLifecycle(store, scoped, { featureFlags: flags }));
        const lifecycleInput = { ...payload, request: scoped };
        const result = action === "publication-correction"
          ? confirmAtomicPublicationCorrection(store, lifecycleInput, { featureFlags: flags })
          : action === "publication-takedown"
            ? confirmAtomicPublicationTakedown(store, lifecycleInput, { featureFlags: flags })
            : confirmAtomicPublicationReplacement(store, lifecycleInput, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      if (action === "promotion-preview") return sendJson(res, 200, previewAtomicWechatContentPromotion(store, scoped, { featureFlags: flags }));
      if (action === "resource-upload-plan-preview") return sendJson(res, 200, previewAtomicWechatResourceUploadPlan(store, scoped, { featureFlags: flags }));
      let result;
      if (action === "promotion-confirm") result = confirmAtomicWechatContentPromotion(store, { request: scoped, previewToken: payload.previewToken, idempotencyKey: payload.idempotencyKey }, { featureFlags: flags });
      else if (action === "resource-upload-plan-confirm") result = confirmAtomicWechatResourceUploadPlan(store, { ...payload, request: scoped }, { featureFlags: flags });
      else if (action === "resource-upload-executions") result = await executeAtomicWechatResourceUpload(store, scoped, {
        featureFlags: flags, assetReader: unifiedContentServerDependencies.wechatUploadAssetReader,
        transport: unifiedContentServerDependencies.wechatResourceUploadTransport,
        postprocess: unifiedContentServerDependencies.wechatUploadPostprocess
      });
      else result = appendAtomicWechatFinalDelivery(store, scoped, { featureFlags: flags });
      if (result.created) await unifiedContentServerDependencies.persistStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_REJECTED", details: error.details || null });
    }
  }
  if (await handleUnifiedXhsPreparationRoute({ req, res, url, path, store, bodyJson, sendJson, persistStore: writeStore, resolveFeatureFlags: featureFlags, runtimeReadiness: unifiedXhsRuntimeReadiness })) return;
  if (await handleUnifiedXhsExecutionRoute({ req, res, url, path, store, bodyJson, sendJson, persistStore: writeStore, resolveFeatureFlags: featureFlags, runtimeReadiness: unifiedXhsRuntimeReadiness, serverDependencies: unifiedContentServerDependencies, generateAssistantText: generateAgentText, unwrapAssistantData: unwrapAgentData })) return;
  const unifiedXhsHumanConfirmationMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/human-visual-confirmation$/);
  if (unifiedXhsHumanConfirmationMatch) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_HUMAN_CONFIRMATION_METHOD_NOT_ALLOWED" });
    try {
      const result = confirmUnifiedContentXhsHumanVisualSet(store, { ...(await bodyJson(req)), projectId: unifiedXhsHumanConfirmationMatch[1] }, { featureFlags: featureFlags() });
      if (result.created) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_XHS_HUMAN_CONFIRMATION_REJECTED", details: error.details || null });
    }
  }
  const unifiedXhsVisualReviewApprovalMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/visual-review-approval$/);
  if (unifiedXhsVisualReviewApprovalMatch) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_METHOD_NOT_ALLOWED" });
    try {
      const result = appendUnifiedContentXhsVisualReviewApproval(store, { ...(await bodyJson(req)), projectId: unifiedXhsVisualReviewApprovalMatch[1] }, { featureFlags: featureFlags(), provider: unifiedContentServerDependencies.xhsVisualReviewProviderAuthority });
      if (result.created) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_REJECTED", details: error.details || null });
    }
  }
  const unifiedXhsVisualReviewsMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/visual-reviews$/);
  if (unifiedXhsVisualReviewsMatch) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_XHS_VISUAL_REVIEW_METHOD_NOT_ALLOWED" });
    const readiness = unifiedXhsRuntimeReadiness().visualReview;
    if (featureFlags().unifiedContentXhsVisualReviewV1 && !readiness.ready) return sendJson(res, 503, { error: "XHS visual review runtime is not configured", code: "UNIFIED_XHS_VISUAL_REVIEW_RUNTIME_NOT_READY", readiness });
    try {
      const result = await executeUnifiedContentXhsVisualReview(store, { ...(await bodyJson(req)), projectId: unifiedXhsVisualReviewsMatch[1] }, { featureFlags: featureFlags(), provider: unifiedContentServerDependencies.xhsVisualReviewProviderAuthority, assetReader: unifiedContentServerDependencies.xhsVisualReviewAssetReader, multimodalTransport: unifiedContentServerDependencies.xhsVisualReviewMultimodalTransport, transportContext: unifiedContentServerDependencies.xhsVisualReviewTransportContext || { mode: "unconfigured", networked: false } });
      if (result.created) await writeStore(store);
      return sendJson(res, result.created ? 201 : 200, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_XHS_VISUAL_REVIEW_REJECTED", details: error.details || null });
    }
  }
  const unifiedXhsPagePreviewMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/page-revisions\/([^/]+)\/preview$/);
  if (req.method === "GET" && unifiedXhsPagePreviewMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentArtifactsV1) return sendJson(res, 404, { error: "Unified content artifacts are disabled", code: "UNIFIED_CONTENT_ARTIFACTS_DISABLED" });
    const [, projectId, revisionId] = unifiedXhsPagePreviewMatch;
    const scope = {
      workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId"),
      accountId: url.searchParams.get("accountId"), candidateId: url.searchParams.get("candidateId"),
      productSnapshotHash: url.searchParams.get("productSnapshotHash") || undefined
    };
    try {
      const review = getUnifiedContentArtifactReview(store, { ...scope, projectId, platform: "xiaohongshu" }, { featureFlags: flags });
      const expectedHash = url.searchParams.get("revisionHash");
      const page = (review.reviewMaterial?.pages || []).find((item) => item?.revisionRef?.id === revisionId
        && (!expectedHash || item.revisionRef.hash === expectedHash));
      if (!page) return sendJson(res, 404, { error: "Page revision is not part of this exact project candidate", code: "UNIFIED_XHS_PAGE_REVISION_NOT_FOUND" });
      const asset = page.revision?.normalizedAsset || page.revision?.normalizedArtifact || page.revision?.output?.normalizedAsset;
      if (!asset?.relativePath || !asset?.sha256 || !Number.isInteger(asset?.bytes)) return sendJson(res, 409, { error: "Page revision has no verifiable normalized asset", code: "UNIFIED_XHS_PAGE_ASSET_NOT_READY" });
      const reader = unifiedContentServerDependencies.xhsAssetReader
        || unifiedContentServerDependencies.xhsDeliveryAssetReader
        || unifiedContentServerDependencies.xhsVisualReviewAssetReader;
      if (typeof reader !== "function") return sendJson(res, 503, { error: "Local XHS asset reader is not configured", code: "UNIFIED_XHS_ASSET_READER_NOT_READY" });
      const result = await reader(asset, { projectId, candidateId: scope.candidateId, pageId: page.pageId, pageRevisionRef: page.revisionRef });
      const bytes = Buffer.isBuffer(result) ? result : result?.bytes;
      const actualHash = Buffer.isBuffer(bytes) ? createHash("sha256").update(bytes).digest("hex") : "";
      if (!Buffer.isBuffer(bytes) || bytes.length !== asset.bytes || actualHash !== asset.sha256) return sendJson(res, 409, { error: "Page asset bytes do not match the immutable revision", code: "UNIFIED_XHS_PAGE_ASSET_MISMATCH" });
      res.writeHead(200, {
        "Content-Type": "image/png", "Content-Length": bytes.length, "Cache-Control": "no-store",
        "ETag": `"${asset.sha256}"`, "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": "*"
      });
      return res.end(bytes);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_XHS_PAGE_PREVIEW_REJECTED", details: error.details || null });
    }
  }
  const unifiedArtifactMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/([^/]+)\/artifacts$/);
  if (unifiedArtifactMatch) {
    const [, projectId, platform] = unifiedArtifactMatch;
    try {
      const flags = featureFlags();
      const payload = req.method === "GET"
        ? { workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId"), candidateId: url.searchParams.get("candidateId") }
        : await bodyJson(req);
      const scoped = { ...payload, projectId, platform };
      if (req.method === "GET") return sendJson(res, 200, getUnifiedContentArtifactState(store, scoped, { featureFlags: flags }));
      if (req.method === "POST") {
        if (!flags.unifiedContentArtifactsV1) return sendJson(res, 404, { error: "Unified content artifacts are disabled", code: "UNIFIED_CONTENT_ARTIFACTS_DISABLED" });
        if (platform === "wechat" && flags.unifiedContentAtomicWechatArtifactV1) {
          return sendJson(res, 409, { error: "Atomic WeChat artifacts must use a dedicated controlled stage", code: "UNIFIED_ATOMIC_WECHAT_ARTIFACT_STAGE_REQUIRED" });
        }
        if (payload?.operation === "xhs_design_evidence") return sendJson(res, 400, { error: "XHS design evidence must be generated by the authoritative design stage", code: "UNIFIED_XHS_DESIGN_STAGE_REQUIRED" });
        if (payload?.operation === "xhs_runtime_result") return sendJson(res, 400, { error: "XHS runtime results must be generated by the formal provider execution stage", code: "UNIFIED_XHS_PROVIDER_EXECUTION_STAGE_REQUIRED" });
        const result = appendUnifiedContentArtifact(store, scoped, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_ARTIFACT_METHOD_NOT_ALLOWED" });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_CONTENT_ARTIFACT_REJECTED", details: error.details || null });
    }
  }
  const unifiedArtifactReviewMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/([^/]+)\/artifact-review$/);
  if (unifiedArtifactReviewMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentArtifactsV1) return sendJson(res, 404, { error: "Unified content artifacts are disabled", code: "UNIFIED_CONTENT_ARTIFACTS_DISABLED" });
    const [, projectId, platform] = unifiedArtifactReviewMatch;
    try {
      const payload = req.method === "GET"
        ? { workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId"), candidateId: url.searchParams.get("candidateId"), productSnapshotHash: url.searchParams.get("productSnapshotHash") || undefined }
        : await bodyJson(req);
      const scoped = { ...payload, projectId, platform };
      if (req.method === "GET") {
        const review = getUnifiedContentArtifactReview(store, scoped, { featureFlags: flags });
        return sendJson(res, 200, platform === "xiaohongshu" ? projectUnifiedXhsPreviewUrls(review, projectId, payload) : review);
      }
      if (req.method === "POST") {
        if (platform === "wechat" && flags.unifiedContentAtomicWechatArtifactV1) {
          return sendJson(res, 409, { error: "Atomic WeChat human review requires its dedicated controlled stage", code: "UNIFIED_ATOMIC_WECHAT_HUMAN_REVIEW_STAGE_REQUIRED" });
        }
        const result = appendUnifiedContentArtifactReviewAction(store, scoped, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_ARTIFACT_REVIEW_METHOD_NOT_ALLOWED" });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_ARTIFACT_REVIEW_REJECTED", details: error.details || null });
    }
  }
  const unifiedXhsLocalPackageMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/xiaohongshu\/final-deliveries\/([^/]+)\/download$/);
  if (unifiedXhsLocalPackageMatch) {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed", code: "XHS_LOCAL_PACKAGE_METHOD_NOT_ALLOWED" });
    const [, projectId, encodedDeliveryId] = unifiedXhsLocalPackageMatch;
    const deliveryId = decodeURIComponent(encodedDeliveryId);
    try {
      const matches = (store.unifiedAtomicXhsDeliveries || []).filter((item) => item?.id === deliveryId
        && item?.contentProjectRef?.id === projectId && item?.platform === "xiaohongshu");
      if (matches.length !== 1) return sendJson(res, 404, { error: "找不到这个小红书本地内容包", code: "XHS_LOCAL_PACKAGE_NOT_FOUND" });
      const output = createXhsLocalPackage(matches[0]);
      const asciiName = `FlowSocial-xiaohongshu-${deliveryId.replace(/[^a-zA-Z0-9_-]+/g, "-")}.zip`;
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(output.fileName)}`,
        "Content-Length": output.bytes.length,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(output.bytes);
      return;
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "XHS_LOCAL_PACKAGE_REJECTED" });
    }
  }
  const unifiedReviewMatch = path.match(/^\/unified-content-projects\/([^/]+)\/platforms\/([^/]+)\/(reviews|selections|review-state|promotion-preview|promotion-confirm|final-delivery|publication-feedback-control-state|manual-publication-preview|manual-publication-confirm|exact-feedback-preview|exact-feedback-confirm|exact-feedback-state|publication-lifecycle-state|publication-correction|publication-takedown|publication-replacement)$/);
  if (unifiedReviewMatch) {
    const flags = featureFlags();
    if (!flags.unifiedContentProductionV1) return sendJson(res, 404, { error: "Unified content production is disabled", code: "UNIFIED_CONTENT_PRODUCTION_DISABLED" });
    const [, projectId, platform, action] = unifiedReviewMatch;
    try {
      const payload = req.method === "GET"
        ? { workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId"), candidateId: url.searchParams.get("candidateId") }
        : await bodyJson(req);
      const scoped = { ...payload, projectId, platform };
      if (req.method === "GET" && action === "publication-feedback-control-state") {
        return sendJson(res, 200, projectAtomicPublicationUiState(store, scoped, flags));
      }
      const reviewStore = flags.unifiedContentAtomicProductV1 ? store : flags.unifiedContentArtifactsV1 ? artifactAwareUnifiedContentStore(store, scoped) : store;
      if (req.method === "POST" && platform === "wechat" && flags.unifiedContentAtomicWechatArtifactV1) {
        return sendJson(res, 409, { error: "Atomic WeChat downstream authority requires a dedicated controlled stage", code: "UNIFIED_ATOMIC_WECHAT_DOWNSTREAM_STAGE_REQUIRED" });
      }
      if (req.method === "GET" && action === "review-state") return sendJson(res, 200, listUnifiedContentReviewState(reviewStore, scoped, { featureFlags: flags }));
      if (req.method === "POST" && action === "reviews") {
        const result = appendUnifiedContentReview(reviewStore, scoped, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      if (req.method === "POST" && action === "selections") {
        const result = appendUnifiedContentSelection(reviewStore, scoped, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      if (req.method === "POST" && action === "promotion-preview") {
        if (!flags.localContentPromotionV1) return sendJson(res, 404, { error: "Local content promotion is disabled", code: "LOCAL_CONTENT_PROMOTION_DISABLED" });
        if (flags.unifiedContentAtomicProductV1) return sendJson(res, 200, previewAtomicXhsContentPromotion(store, scoped, { featureFlags: flags }));
        return sendJson(res, 200, previewContentPromotion(store, buildSavedContentPromotionRequest(reviewStore, scoped, { featureFlags: flags })));
      }
      if (req.method === "POST" && action === "promotion-confirm") {
        if (!flags.localContentPromotionV1) return sendJson(res, 404, { error: "Local content promotion is disabled", code: "LOCAL_CONTENT_PROMOTION_DISABLED" });
        if (flags.unifiedContentAtomicProductV1) {
          const result = confirmAtomicXhsContentPromotion(store, { request: scoped, previewToken: payload.previewToken, idempotencyKey: payload.idempotencyKey }, { featureFlags: flags });
          if (result.created) await writeStore(store);
          return sendJson(res, result.created ? 201 : 200, result);
        }
        const request = buildSavedContentPromotionRequest(reviewStore, scoped, { featureFlags: flags });
        const result = confirmContentPromotion(store, { request, previewToken: payload.previewToken, idempotencyKey: payload.idempotencyKey });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      if (req.method === "POST" && action === "final-delivery") {
        if (!flags.localPackageDeliveryV1) return sendJson(res, 404, { error: "Local package delivery is disabled", code: "LOCAL_PACKAGE_DELIVERY_DISABLED" });
        if (!flags.unifiedContentAtomicProductV1) return sendJson(res, 409, { error: "Atomic delivery authority is required", code: "ATOMIC_XHS_DELIVERY_AUTHORITY_REQUIRED" });
        const readiness = unifiedXhsRuntimeReadiness().finalDelivery;
        if (!readiness.ready) return sendJson(res, 503, { error: "XHS delivery asset runtime is not configured", code: "UNIFIED_XHS_DELIVERY_RUNTIME_NOT_READY", readiness });
        const deliveryAssetReader = unifiedContentServerDependencies.xhsDeliveryAssetReader
          || unifiedContentServerDependencies.xhsVisualReviewAssetReader
          || (typeof unifiedContentServerDependencies.xhsAssetReader === "function"
            ? (selection) => unifiedContentServerDependencies.xhsAssetReader(selection.normalizedAsset, {
                projectId, candidateId: scoped.candidateId, pageId: selection.pageId, pageRevisionRef: selection.pageRevisionRef
              })
            : undefined);
        const result = await appendAtomicXhsFinalDelivery(store, scoped, { featureFlags: flags, assetReader: deliveryAssetReader });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, { ...result, localPackage: xhsLocalPackageDescriptor(projectId, result.delivery) });
      }
      if (req.method === "POST" && action === "manual-publication-preview") {
        if (!flags.atomicManualPublicationV1) return sendJson(res, 404, { error: "Atomic manual publication is disabled", code: "ATOMIC_MANUAL_PUBLICATION_DISABLED" });
        if (!flags.unifiedContentAtomicProductV1) return sendJson(res, 409, { error: "Atomic publication authority is required", code: "ATOMIC_MANUAL_PUBLICATION_AUTHORITY_DISABLED" });
        return sendJson(res, 200, previewAtomicManualPublication(store, scoped, { featureFlags: flags }));
      }
      if (req.method === "POST" && action === "manual-publication-confirm") {
        if (!flags.atomicManualPublicationV1) return sendJson(res, 404, { error: "Atomic manual publication is disabled", code: "ATOMIC_MANUAL_PUBLICATION_DISABLED" });
        if (!flags.unifiedContentAtomicProductV1) return sendJson(res, 409, { error: "Atomic publication authority is required", code: "ATOMIC_MANUAL_PUBLICATION_AUTHORITY_DISABLED" });
        const result = confirmAtomicManualPublication(store, { ...payload, request: scoped }, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      if (req.method === "POST" && action === "exact-feedback-preview") {
        if (!flags.atomicExactFeedbackV1) return sendJson(res, 404, { error: "Atomic exact feedback is disabled", code: "ATOMIC_EXACT_FEEDBACK_DISABLED" });
        return sendJson(res, 200, previewAtomicPublicationFeedback(store, scoped, { featureFlags: flags }));
      }
      if (req.method === "POST" && action === "exact-feedback-confirm") {
        if (!flags.atomicExactFeedbackV1) return sendJson(res, 404, { error: "Atomic exact feedback is disabled", code: "ATOMIC_EXACT_FEEDBACK_DISABLED" });
        const result = confirmAtomicPublicationFeedback(store, { ...payload, request: scoped }, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      if (req.method === "POST" && action === "exact-feedback-state") {
        if (!flags.atomicExactFeedbackV1) return sendJson(res, 404, { error: "Atomic exact feedback is disabled", code: "ATOMIC_EXACT_FEEDBACK_DISABLED" });
        return sendJson(res, 200, projectAtomicPublicationFeedback(store, scoped, { featureFlags: flags }));
      }
      if (req.method === "POST" && ["publication-lifecycle-state", "publication-correction", "publication-takedown", "publication-replacement"].includes(action)) {
        if (!flags.atomicPublicationLifecycleV1) return sendJson(res, 404, { error: "Atomic publication lifecycle is disabled", code: "ATOMIC_PUBLICATION_LIFECYCLE_DISABLED" });
        if (action === "publication-lifecycle-state") return sendJson(res, 200, projectAtomicPublicationLifecycle(store, scoped, { featureFlags: flags }));
        const lifecycleInput = { ...payload, request: scoped };
        const result = action === "publication-correction"
          ? confirmAtomicPublicationCorrection(store, lifecycleInput, { featureFlags: flags })
          : action === "publication-takedown"
            ? confirmAtomicPublicationTakedown(store, lifecycleInput, { featureFlags: flags })
            : confirmAtomicPublicationReplacement(store, lifecycleInput, { featureFlags: flags });
        if (result.created) await writeStore(store);
        return sendJson(res, result.created ? 201 : 200, result);
      }
      return sendJson(res, 405, { error: "Method not allowed", code: "UNIFIED_REVIEW_METHOD_NOT_ALLOWED" });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "UNIFIED_CONTENT_REVIEW_REJECTED", details: error.details || null });
    }
  }
  const unifiedContentProjectMatch = path.match(/^\/unified-content-projects\/([^/]+)$/);
  if (req.method === "GET" && unifiedContentProjectMatch) {
    try {
      const item = getUnifiedContentProductSnapshot(store, unifiedContentProjectMatch[1], { featureFlags: featureFlags() });
      return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: "Unified content project not found", code: "UNIFIED_CONTENT_PROJECT_NOT_FOUND" });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "UNIFIED_CONTENT_PRODUCT_QUERY_REJECTED", details: error.details || null });
    }
  }
  if (await handleLegacyContentRoute({ req, res, url, path, store, bodyJson, sendJson, persistStore: writeStore, resolveFeatureFlags: featureFlags })) return;
  if (req.method === "GET" && path === "/source-configs") return sendJson(res, 200, { items: store.sourceConfigs });
  if (req.method === "GET" && path === "/platform-integrations") {
    const integrations = await listPublicPlatformIntegrations();
    return sendJson(res, 200, { ...integrations, syncRuns: (store.platformSyncRuns || []).slice(-20).reverse() });
  }
  const wechatIntegrationMatch = path.match(/^\/platform-integrations\/wechat\/([^/]+)$/);
  if (req.method === "GET" && wechatIntegrationMatch) {
    const account = (store.accounts || []).find((item) => item.id === wechatIntegrationMatch[1] && item.platform === "wechat");
    if (!account) return sendJson(res, 404, { error: "公众号账号不存在" });
    const config = await getWechatIntegration(account.id);
    return sendJson(res, 200, { account, integration: toPublicWechatIntegration(account.id, config), latestSync: (store.platformSyncRuns || []).filter((item) => item.accountId === account.id && item.platform === "wechat").at(-1) || null });
  }
  if (req.method === "POST" && wechatIntegrationMatch) {
    const account = (store.accounts || []).find((item) => item.id === wechatIntegrationMatch[1] && item.platform === "wechat");
    if (!account) return sendJson(res, 404, { error: "公众号账号不存在" });
    try {
      const integration = await saveWechatIntegration(account.id, await bodyJson(req));
      return sendJson(res, 200, { account, integration });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }
  const wechatTestMatch = path.match(/^\/platform-integrations\/wechat\/([^/]+)\/test$/);
  if (req.method === "POST" && wechatTestMatch) {
    const account = (store.accounts || []).find((item) => item.id === wechatTestMatch[1] && item.platform === "wechat");
    if (!account) return sendJson(res, 404, { error: "公众号账号不存在" });
    const config = await getWechatIntegration(account.id);
    if (!config) return sendJson(res, 409, { error: "请先保存公众号 AppID 和 AppSecret" });
    try {
      return sendJson(res, 200, await testWechatConnection(config));
    } catch (error) {
      return sendJson(res, error.statusCode || 502, { error: error.message, code: error.code || null });
    }
  }
  const wechatSyncMatch = path.match(/^\/platform-integrations\/wechat\/([^/]+)\/sync$/);
  if (req.method === "POST" && wechatSyncMatch) {
    const account = (store.accounts || []).find((item) => item.id === wechatSyncMatch[1] && item.platform === "wechat");
    if (!account) return sendJson(res, 404, { error: "公众号账号不存在" });
    const config = await getWechatIntegration(account.id);
    if (!config) return sendJson(res, 409, { error: "请先保存公众号 AppID 和 AppSecret" });
    try {
      const payload = await bodyJson(req);
      const run = await syncWechatAnalytics(store, account, config, payload.days);
      await writeStore(store);
      return sendJson(res, 200, run);
    } catch (error) {
      return sendJson(res, error.statusCode || 502, { error: error.message, code: error.code || null, details: error.details || null });
    }
  }
  if (req.method === "GET" && path === "/integrations") return sendJson(res, 200, providerStatus());
  if (req.method === "GET" && path === "/provider-config") return sendJson(res, 200, getPublicProviderConfig());
  if (req.method === "GET" && path === "/reference-posts/analyses") return sendJson(res, 200, { items: store.referenceAnalyses });
  if (req.method === "GET" && path === "/reference-posts") return sendJson(res, 200, { items: store.referencePosts || [] });
  if (req.method === "GET" && path === "/viral-blueprints") return sendJson(res, 200, featureFlags().viralLearningV1
    ? { items: store.contentPatternBlueprints || [], productionReady: true, note: "仅返回经人工审核的版本化内容蓝图" }
    : { items: store.viralBlueprintLibrary || [], productionReady: false, note: "当前蓝图由演示规则生成，等待真实爆款拆解 Skill 升级" });
  if (req.method === "GET" && path === "/content-learning/status") {
    const libraries = ensureContentPatternLearning(store);
    const requestedAccountId = url.searchParams.get("accountId");
    const scope = requestedAccountId ? resolveOwnershipContext(store, { accountId: requestedAccountId }) : null;
    const analyses = scope ? libraries.analyses.filter((item) => patternVisibleToScope(item, scope)) : libraries.analyses;
    const blueprints = scope ? libraries.blueprints.filter((item) => patternVisibleToScope(item, scope)) : libraries.blueprints;
    const snapshots = scope ? libraries.snapshots.filter((item) => patternVisibleToScope(item, scope)) : libraries.snapshots;
    return sendJson(res, 200, {
      schemaVersion: "1.0",
      enabled: featureFlags().viralLearningV1,
      counts: {
        references: (store.referencePosts || []).filter((item) => !scope || patternVisibleToScope(item, scope)).length,
        importJobs: (store.referenceImportJobs || []).filter((item) => !scope || patternVisibleToScope(item, scope)).length,
        candidates: analyses.filter((item) => item.status === "candidate").length,
        approvedAnalyses: analyses.filter((item) => item.status === "approved").length,
        productionBlueprints: blueprints.filter((item) => item.productionReady).length,
        clusters: (store.contentPatternClusters || []).filter((item) => !scope || patternVisibleToScope(item, scope)).length,
        upgradeProposals: (store.blueprintUpgradeProposals || []).filter((item) => item.status === "candidate" && (!scope || patternVisibleToScope(item, scope))).length,
        skillPromotionCandidates: (store.skillPromotionCandidates || []).filter((item) => item.status === "candidate" && (!scope || patternVisibleToScope(item, scope))).length,
        snapshots: snapshots.length
      },
      policy: { humanReviewRequired: true, structureOnly: true, autoStrategyMutation: false }
    });
  }
  if (req.method === "GET" && path === "/content-learning/analyses") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, { items: scope ? (store.contentPatternAnalyses || []).filter((item) => patternVisibleToScope(item, scope)) : store.contentPatternAnalyses || [] });
  }
  if (req.method === "GET" && path === "/content-learning/blueprints") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, { items: scope ? (store.contentPatternBlueprints || []).filter((item) => patternVisibleToScope(item, scope)) : store.contentPatternBlueprints || [] });
  }
  if (req.method === "GET" && path === "/content-learning/import-jobs") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, { items: (store.referenceImportJobs || []).filter((item) => !scope || patternVisibleToScope(item, scope)) });
  }
  if (req.method === "GET" && path === "/content-learning/references") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, { items: (store.referencePosts || []).filter((item) => !scope || patternVisibleToScope(item, scope)) });
  }
  if (req.method === "GET" && path === "/content-learning/clusters") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, { items: (store.contentPatternClusters || []).filter((item) => !scope || patternVisibleToScope(item, scope)) });
  }
  if (req.method === "GET" && path === "/content-learning/upgrade-proposals") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, { items: (store.blueprintUpgradeProposals || []).filter((item) => !scope || patternVisibleToScope(item, scope)) });
  }
  if (req.method === "GET" && path === "/content-learning/performance") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, buildPatternPerformanceDashboard(store, { scope }));
  }
  if (req.method === "GET" && path === "/content-learning/skill-promotions") {
    const accountId = url.searchParams.get("accountId");
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    return sendJson(res, 200, {
      items: (store.skillPromotionCandidates || []).filter((item) => !scope || patternVisibleToScope(item, scope)),
      patternPacks: (store.contentSkillPatternPacks || []).filter((item) => !scope || patternVisibleToScope(item, scope))
    });
  }
  if (req.method === "GET" && path === "/content-directions") { const companyId=url.searchParams.get("companyId"); return sendJson(res, 200, { items: (store.contentDirections || []).filter((item)=>!companyId||(item.companyId||"account_damaishuzhi")===companyId) }); }
  if (req.method === "GET" && path === "/hotspot-runs") return sendJson(res, 200, { items: store.hotspotRuns || [] });
  if (req.method === "GET" && path === "/manual-signals") return sendJson(res, 410, { error: "人工信号功能已移除，请使用可追溯来源的热点采集" });
  if (req.method === "GET" && path === "/knowledge/folders") return sendJson(res, 200, { items: listKnowledgeFolders({ workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId") }) });
  if (req.method === "GET" && path === "/knowledge/files") {
    const folderId = url.searchParams.get("folderId");
    const q = url.searchParams.get("q") || "";
    const companyId = url.searchParams.get("companyId");
    const items = listKnowledgeFiles({ folderId, query: q, workspaceId: url.searchParams.get("workspaceId"), companyId });
    return sendJson(res, 200, { folderId, items });
  }
  if (req.method === "GET" && path === "/knowledge/search") {
    const query = url.searchParams.get("q") || "";
    const folderIds = (url.searchParams.get("folderIds") || "").split(",").filter(Boolean);
    return sendJson(res, 200, searchKnowledge({ query, folderIds, workspaceId: url.searchParams.get("workspaceId"), companyId: url.searchParams.get("companyId") }));
  }

  if (req.method === "POST" && path === "/accounts") {
    const payload = await bodyJson(req);
    if (!payload.name || !payload.platform) return sendJson(res, 400, { error: "name and platform are required" });
    const ownership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: payload.companyId || "account_damaishuzhi" }));
    const account = { id: id("acc"), status: payload.status === "disabled" ? "disabled" : "active", contentPillars: [], marketingDefault: "soft", ...payload, workspaceId: ownership.workspaceId, companyId: ownership.companyId, accountType:"social" };
    account.socialAccountId=account.id;
    account.accountIdentity=normalizeSocialAccountIdentity(account,{...payload.accountIdentity,companyId:ownership.companyId,socialAccountId:account.id,version:1,updatedAt:new Date().toISOString()});
    account.accountIdentityId=account.accountIdentity.id;
    account.accountIdentityVersion=account.accountIdentity.version;
    const initialConfiguration=evaluateSocialAccountConfiguration(account,ownership.company);
    if(!initialConfiguration.complete&&account.status==="active")account.status="setup_required";
    account.configurationStatus=evaluateSocialAccountConfiguration(account,ownership.company).status;
    account.matrixId = getCompanyMatrix(store, ownership.companyId)?.id || null;
    store.accounts.push(account);
    ensureStrategyHierarchy(store);
    await writeStore(store);
    return sendJson(res, 201, projectSocialAccount(account,ownership.company));
  }

  if (req.method === "POST" && path === "/keyword-profiles/expand") {
    const payload = await bodyJson(req);
    if (!payload.name?.trim()) return sendJson(res, 400, { error: "name is required" });
    return sendJson(res, 200, await expandDirectionKeywords({ name: payload.name.trim(), description: payload.description || "" }));
  }

  if (req.method === "POST" && path === "/content-directions") {
    const payload = await bodyJson(req);
    if (!payload.name) return sendJson(res, 400, { error: "name is required" });
    const profile = payload.coreKeywords?.length || payload.keywords?.length
      ? {
          coreKeywords: payload.coreKeywords || payload.keywords || [], platformKeywords: payload.platformKeywords || [],
          scenarioKeywords: payload.scenarioKeywords || [], excludeKeywords: payload.excludeKeywords || [],
          searchKeywords: payload.searchKeywords || [...(payload.coreKeywords || payload.keywords || []), ...(payload.platformKeywords || []), ...(payload.scenarioKeywords || [])]
        }
      : await expandDirectionKeywords({ name: payload.name, description: payload.description || "" });
    const direction = {
      id: id("direction"), enabled: true, refreshSchedule: "daily", lastRefreshedAt: null,
      workspaceId:payload.workspaceId||"workspace_default",companyId:payload.companyId||"account_damaishuzhi",...payload, ...profile, keywords: profile.searchKeywords || profile.coreKeywords,
      keywordVersion: 1, keywordGeneratedBy: profile.mode || payload.keywordGeneratedBy || "user", keywordConfirmedAt: new Date().toISOString()
    };
    store.contentDirections ||= [];
    store.contentDirections.push(direction);
    await writeStore(store);
    return sendJson(res, 201, direction);
  }

  if (req.method === "POST" && path === "/provider-config") {
    if (!isTrustedLocalOrigin(req)) return sendJson(res, 403, { error: "Provider configuration only accepts requests from this local app" });
    const config = await saveProviderConfig(await bodyJson(req));
    return sendJson(res, 200, { ...config, integrations: providerStatus() });
  }
  if (req.method === "POST" && path === "/provider-config/model/test") {
    if (!isTrustedLocalOrigin(req)) return sendJson(res, 403, { error: "Model connection test only accepts requests from this local app" });
    const result = await generateText({
      task: "model_gateway_live_test",
      contract: "ConsultativeReply@2.0",
      instruction: "这是连接测试。只返回 JSON 对象，assistantMessage 填写‘模型连接正常’。",
      outputSchema: { assistantMessage: "模型连接正常" }
    }, { assistantMessage: "模型连接测试未通过" });
    const model = providerStatus().model;
    return sendJson(res, 200, {
      ok: result.mode === "live",
      mode: result.mode,
      message: result.mode === "live" ? "模型连接正常" : result.warning || model.lastError?.message || "模型连接失败",
      telemetry: result.telemetry || null,
      model
    });
  }

  const directionMatch = path.match(/^\/content-directions\/([^/]+)$/);
  if (req.method === "PATCH" && directionMatch) {
    const index = (store.contentDirections || []).findIndex((item) => item.id === directionMatch[1]);
    if (index < 0) return sendJson(res, 404, { error: "Content direction not found" });
    store.contentDirections[index] = { ...store.contentDirections[index], ...(await bodyJson(req)), updatedAt: new Date().toISOString() };
    await writeStore(store);
    return sendJson(res, 200, store.contentDirections[index]);
  }

  const libraryMatch = path.match(/^\/content-directions\/([^/]+)\/library$/);
  if (req.method === "GET" && libraryMatch) {
    const direction = (store.contentDirections || []).find((item) => item.id === libraryMatch[1]);
    if (!direction) return sendJson(res, 404, { error: "Content direction not found" });
    const opportunities = (store.hotspotLibrary || []).filter((item) => item.status !== "ignored" && item.directionId === direction.id);
    const ideas = opportunities.flatMap((opportunity) => (opportunity.topicIdeas || []).map((title, index) => ({ id: `${opportunity.id}_idea_${index + 1}`, opportunityId: opportunity.id, directionId: direction.id, title, whyNow: opportunity.whyHot, keywords: opportunity.keywords || [], risks: opportunity.risks || [], productFits: opportunity.productFits || [], sourceCount: opportunity.sourceCount, opportunityScore: opportunity.score, status: "ready" })));
    return sendJson(res, 200, { direction, opportunities, ideas, lastRefreshedAt: direction.lastRefreshedAt });
  }

  const refreshDirectionMatch = path.match(/^\/content-directions\/([^/]+)\/refresh$/);
  if (req.method === "POST" && refreshDirectionMatch) {
    const index = (store.contentDirections || []).findIndex((item) => item.id === refreshDirectionMatch[1]);
    if (index < 0) return sendJson(res, 404, { error: "Content direction not found" });
    const direction = store.contentDirections[index];
    const collectionPayload = { poolType: "keyword", directionId: direction.id, companyId: direction.companyId, keywords: direction.searchKeywords || direction.keywords, keywordProfile: direction, timeWindowDays: 7, targetOpportunityCount: 10 };
    let result;
    try {
      result = await runHotspotPipeline(collectionPayload, store);
    } catch (error) {
      const failedRun = recordHotspotFailure(store, collectionPayload, error, { companyId: direction.companyId });
      await writeStore(store);
      return sendJson(res, 502, { error: error.message, code: failedRun.failure.errorClass, run: failedRun, retryAction: failedRun.failure.retryAction });
    }
    store.hotspotRuns ||= [];
    store.hotspotRuns.push(result.run);
    const preview = { id: id("preview"), companyId: direction.companyId || null, status: "preview_ready", run: result.run, opportunities: result.opportunities || [], rejectedByRelevance: result.rejectedByRelevance || [], createdAt: new Date().toISOString() };
    store.hotspotPreviews.push(preview);
    store.contentDirections[index] = { ...direction, lastRefreshedAt: new Date().toISOString() };
    await writeStore(store);
    return sendJson(res, 201, { ...result, previewId: preview.id, previewStatus: preview.status, direction: store.contentDirections[index] });
  }

  if (req.method === "POST" && path === "/content-ideas/select") {
    const payload = await bodyJson(req);
    if (!payload.ideaId || !payload.title || !payload.directionId) return sendJson(res, 400, { error: "ideaId, directionId and title are required" });
    const selection = { id: id("selection"), status: "selected", ...payload, selectedAt: new Date().toISOString() };
    store.ideaSelections ||= [];
    store.ideaSelections.push(selection);
    await writeStore(store);
    return sendJson(res, 201, selection);
  }

  if (req.method === "POST" && path === "/knowledge/folders") {
    const payload = await bodyJson(req);
    if (!payload.name) return sendJson(res, 400, { error: "name is required" });
    const ownership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: payload.companyId, accountId: payload.accountId }));
    const folder = createKnowledgeFolder({ ...payload, ...ownership });
    return sendJson(res, 201, folder);
  }

  if (req.method === "POST" && path === "/knowledge/files") {
    try {
      if (!req.headers["content-type"]?.includes("multipart/form-data")) return sendJson(res, 415, { error: "knowledge file upload requires multipart/form-data" });
      const { fields, file: uploaded } = await multipartUpload(req);
      const tags = parseUploadTags(fields.tags);
      if (!fields.folderId || !uploaded?.name || !Array.isArray(tags) || !tags.length) return sendJson(res, 400, { error: "folderId, file and at least one tag are required" });
      const ownership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: fields.companyId, accountId: fields.accountId }));
      const file = await saveKnowledgeFile({ folderId: fields.folderId, name: uploaded.name, mimeType: uploaded.mimeType, size: uploaded.buffer.length, tags, description: fields.description || "", buffer: uploaded.buffer, ...ownership });
      return sendJson(res, 201, file);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "KNOWLEDGE_UPLOAD_FAILED" });
    }
  }

  const knowledgeRetryMatch = path.match(/^\/knowledge\/files\/([^/]+)\/retry$/);
  if (req.method === "POST" && knowledgeRetryMatch) {
    const payload = await bodyJson(req);
    const ownership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: payload.companyId, accountId: payload.accountId }));
    const file = await retryKnowledgeFile(knowledgeRetryMatch[1], ownership);
    return file ? sendJson(res, 200, file) : sendJson(res, 404, { error: "Knowledge file not found in this company", code: "KNOWLEDGE_FILE_NOT_FOUND" });
  }

  const knowledgeFileMatch = path.match(/^\/knowledge\/files\/([^/]+)$/);
  if (req.method === "DELETE" && knowledgeFileMatch) {
    const ownership = assertOwnershipContext(resolveOwnershipContext(store, { companyId: url.searchParams.get("companyId"), accountId: url.searchParams.get("accountId") }));
    const deleted = await deleteKnowledgeFile(knowledgeFileMatch[1], ownership);
    return deleted ? sendJson(res, 200, { deleted: true, id: knowledgeFileMatch[1] }) : sendJson(res, 404, { error: "Knowledge file not found" });
  }

  const accountVisualAssetMatch = path.match(/^\/accounts\/([^/]+)\/visual-assets$/);
  if (req.method === "POST" && accountVisualAssetMatch) {
    try {
      if (!req.headers["content-type"]?.includes("multipart/form-data")) return sendJson(res, 415, { error: "品牌视觉资料上传需要 multipart/form-data" });
      const account = (store.accounts || []).find((item) => item.id === accountVisualAssetMatch[1] && item.accountType !== "company");
      if (!account) return sendJson(res, 404, { error: "Social account not found" });
      const { fields, file: uploaded } = await multipartUpload(req);
      if (!uploaded?.name) return sendJson(res, 400, { error: "file is required" });
      const ownership = assertOwnershipContext(resolveOwnershipContext(store, { accountId: account.id }));
      const folderName = `${account.name} · 品牌视觉资料`;
      const folder = listKnowledgeFolders({ companyId: ownership.companyId, includeHidden: true }).find((item) => item.name === folderName)
        || createKnowledgeFolder({ name: folderName, description: "账号 VI、PPT/PDF、版式模板与授权参考图", icon: "VI", ...ownership });
      const externalUseApproved = fields.externalUseApproved === "true";
      const file = await saveKnowledgeFile({
        folderId: folder.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        size: uploaded.buffer.length,
        tags: ["品牌视觉", fields.assetType || "visual_reference", externalUseApproved ? "允许外部文字摘要" : "仅内部"],
        description: fields.description || account.visualStyle?.description || "账号品牌视觉资料",
        buffer: uploaded.buffer,
        ...ownership
      });
      account.visualStyle ||= { name: "账号视觉系统", description: "" };
      const refs = Array.isArray(account.visualStyle.assetRefs) ? account.visualStyle.assetRefs : [];
      account.visualStyle.assetRefs = [...refs.filter((item) => item.fileId !== file.id), { fileId: file.id, folderId: folder.id, name: file.name, kind: file.kind, parseStatus: file.parseStatus, parseMode: file.parseMode, externalUseApproved, assetType: fields.assetType || "visual_reference" }];
      account.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, {
        file,
        extraction: {
          status: file.parseStatus,
          mode: file.parseMode,
          pageCount: file.pageCount || 0,
          textExtracted: file.parseStatus === "ready" && !["image_metadata", "pdf_page_vision"].includes(file.parseMode),
          visualUnderstandingPerformed: false,
          disclosure: file.parseMode === "pdf_page_vision"
            ? `已检测到 ${file.pageCount || 0} 页视觉内容，等待页面识别。`
            : file.parseMode === "image_metadata"
              ? "图片已保存，等待视觉识别。"
              : "文件内容已读取，等待汇总识别。"
        },
        designDnaSnapshot: null
      });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || "ACCOUNT_VISUAL_ASSET_UPLOAD_FAILED" });
    }
  }

  const accountDesignDnaMatch = path.match(/^\/accounts\/([^/]+)\/design-dna$/);
  const accountDesignDnaAnalyzeMatch = path.match(/^\/accounts\/([^/]+)\/design-dna\/analyze$/);
  if (req.method === "POST" && accountDesignDnaAnalyzeMatch) {
    try {
      const accountId = accountDesignDnaAnalyzeMatch[1];
      const account = (store.accounts || []).find((item) => item.id === accountId && item.accountType !== "company");
      if (!account) return sendJson(res, 404, { error: "Social account not found", code: "DESIGN_DNA_ACCOUNT_NOT_FOUND" });
      assertOwnershipContext(resolveOwnershipContext(store, { accountId }));
      const payload = await bodyJson(req);
      const refs = Array.isArray(account.visualStyle?.assetRefs) ? account.visualStyle.assetRefs : [];
      const requestedFileIds = Array.isArray(payload.sourceFileIds) ? payload.sourceFileIds : Array.isArray(payload.approvedFileIds) ? payload.approvedFileIds : refs.map((item) => item.fileId);
      const approvedFileIds = [...new Set(requestedFileIds.map(String).filter(Boolean))];
      if (!approvedFileIds.length) throw Object.assign(new Error("请先上传至少一份品牌资料"), { statusCode: 409, code: "DESIGN_DNA_ANALYSIS_SOURCE_REQUIRED" });
      if (approvedFileIds.length > 8) throw Object.assign(new Error("一次最多识别 8 份资料，请分批处理"), { statusCode: 409, code: "DESIGN_DNA_ANALYSIS_BUDGET_EXCEEDED" });
      const refMap = new Map(refs.map((item) => [item.fileId, item]));
      if (approvedFileIds.some((fileId) => !refMap.has(fileId))) throw Object.assign(new Error("分析来源不属于当前账号"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_ACCOUNT_MISMATCH" });
      const files = buildDesignDnaSourceFiles(approvedFileIds);
      if (files.length !== approvedFileIds.length || files.some((file) => !["ready", "visual_ready"].includes(file.parseStatus))) throw Object.assign(new Error("品牌资料尚未准备好，请稍后重试"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_NOT_READY" });
      const config = getProviderConfig();
      const apiKey = config.MINIMAX_API_KEY || config.ANTHROPIC_API_KEY;
      if (!apiKey) throw Object.assign(new Error("视觉识别服务尚未配置，请联系管理员"), { statusCode: 409, code: "MINIMAX_VISION_KEY_MISSING" });
      const sourceAnalyses = [];
      const providerCallBudget = 8;
      let providerCallsUsed = 0;
      for (const file of files) {
        const isImage = file.kind === "image" || file.parseMode === "image_metadata";
        const isPdf = file.mimeType === "application/pdf" || extname(file.name).toLowerCase() === ".pdf";
        const remainingCalls = providerCallBudget - providerCallsUsed;
        if (remainingCalls < 1) throw Object.assign(new Error("本次识别的资料页数较多，请减少文件后重试"), { statusCode: 409, code: "DESIGN_DNA_ANALYSIS_BUDGET_EXCEEDED" });
        const buffer = isImage || isPdf ? await readStoredKnowledgeFile(file.id) : null;
        const result = isPdf
          ? await analyzePdfWithMiniMax({ buffer, name: file.name, apiHost: config.MINIMAX_API_HOST, apiKey, maxProviderCalls: remainingCalls })
          : isImage
            ? await analyzeImageWithMiniMax({ buffer, mimeType: file.mimeType, name: file.name, apiHost: config.MINIMAX_API_HOST, apiKey })
            : await analyzeVisualTextWithMiniMax({ text: file.extractedTextSummary, name: file.name, baseUrl: config.ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic", apiKey, model: config.FLOW_MODEL_NAME || "MiniMax-M3" });
        providerCallsUsed += Number(result.providerCalls) || 1;
        sourceAnalyses.push({ fileId: file.id, fileName: file.name, kind: file.kind, ...result });
      }
      let merged = mergeVisualAnalyses(sourceAnalyses);
      let synthesis = null;
      if (files.some((file) => file.mimeType === "application/pdf" || extname(file.name).toLowerCase() === ".pdf") && providerCallsUsed < providerCallBudget) {
        synthesis = await analyzeVisualTextWithMiniMax({
          text: `以下是多批页面视觉识别结果。请去重、解决冲突并汇总成可直接用于小红书生成的简体中文品牌视觉规范；保留明确色值与页码证据，删除竞品类比、无依据推断和英文赘述：\n${JSON.stringify(merged)}`,
          name: "VI页面视觉分析汇总",
          baseUrl: config.ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic",
          apiKey,
          model: config.FLOW_MODEL_NAME || "MiniMax-M3"
        });
        merged = prioritizeEvidenceColors(synthesis.analysis, merged.evidence, merged.referenceNotes, synthesis.analysis.evidence, synthesis.analysis.referenceNotes);
        providerCallsUsed += 1;
      }
      const signalsFound = merged.colors.length + merged.fontPreferences.length + merged.layoutPreferences.length + merged.materials.length + merged.forbiddenMotifs.length;
      if (!signalsFound) throw Object.assign(new Error("没有识别到可用的品牌视觉规律，请检查资料页面是否可以正常预览"), { statusCode: 422, code: "DESIGN_DNA_VISUAL_SIGNALS_MISSING" });
      const coverage = sourceAnalyses.map((item) => item.coverage).filter(Boolean);
      const analysisDraft = {
        ...merged,
        status: "ready_for_review",
        provider: "MiniMax",
        providerCalls: providerCallsUsed,
        signalsFound,
        contentCoverage: coverage,
        synthesis: synthesis ? { provider: synthesis.provider, endpoint: synthesis.endpoint } : null,
        sourceAnalyses: sourceAnalyses.map((item) => ({ fileId: item.fileId, fileName: item.fileName, kind: item.kind, provider: item.provider, endpoint: item.endpoint, localSignals: item.localSignals || null, coverage: item.coverage || null, analysis: item.analysis })),
        disclosure: "已分析的图片或文字资料仅用于生成待确认规则；人工确认前不会用于小红书生图。",
        createdAt: new Date().toISOString()
      };
      account.visualStyle ||= { name: "账号视觉系统", description: "", assetRefs: [] };
      account.visualStyle.analysisDraft = analysisDraft;
      account.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, { item: analysisDraft, providerCallBudget: { approved: providerCallBudget, used: providerCallsUsed, automaticRetries: 0 } });
    } catch (error) {
      return sendJson(res, error.statusCode || 502, {
        error: publicVisualAnalysisError(error),
        code: error.code || "DESIGN_DNA_ANALYSIS_FAILED",
        details: { ...(error.details || {}), technicalMessage: error.message }
      });
    }
  }
  if (req.method === "POST" && accountDesignDnaMatch) {
    try {
      const accountId = accountDesignDnaMatch[1];
      const account = (store.accounts || []).find((item) => item.id === accountId && item.accountType !== "company");
      if (!account) return sendJson(res, 404, { error: "Social account not found", code: "DESIGN_DNA_ACCOUNT_NOT_FOUND" });
      assertOwnershipContext(resolveOwnershipContext(store, { accountId }));
      const payload = await bodyJson(req);
      const refs = Array.isArray(account.visualStyle?.assetRefs) ? account.visualStyle.assetRefs : [];
      const decisions = Array.isArray(payload.sourceAuthorizations) ? payload.sourceAuthorizations : null;
      if (!decisions || decisions.length !== refs.length) {
        throw Object.assign(new Error("必须逐项提交当前账号全部视觉来源的授权决定"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_AUTHORIZATION_INCOMPLETE" });
      }
      const refIds = new Set(refs.map((item) => item.fileId));
      const decisionMap = new Map();
      for (const decision of decisions) {
        if (!decision || Object.keys(decision).sort().join(",") !== "externalUseApproved,fileId"
          || typeof decision.fileId !== "string" || typeof decision.externalUseApproved !== "boolean"
          || !refIds.has(decision.fileId)) {
          throw Object.assign(new Error("视觉来源授权包含非当前账号文件"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_ACCOUNT_MISMATCH" });
        }
        if (decisionMap.has(decision.fileId)) throw Object.assign(new Error("视觉来源授权重复"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_AUTHORIZATION_INVALID" });
        decisionMap.set(decision.fileId, decision.externalUseApproved);
      }
      if (decisionMap.size !== refs.length) throw Object.assign(new Error("视觉来源授权不完整"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_AUTHORIZATION_INCOMPLETE" });
      const approvedFileIds = refs.filter((item) => decisionMap.get(item.fileId) === true).map((item) => item.fileId);
      if (payload.mode === "user_authored" && approvedFileIds.length) {
        throw Object.assign(new Error("纯用户原创基线不得同时授权文件来源"), { statusCode: 409, code: "DESIGN_DNA_USER_AUTHORED_SOURCES_FORBIDDEN" });
      }
      const sourceFiles = payload.mode === "user_authored" ? [] : buildDesignDnaSourceFiles(refs.map((item) => item.fileId));
      if (payload.mode !== "user_authored" && sourceFiles.length !== refs.length) throw Object.assign(new Error("账号视觉来源已缺失，请先修复资料"), { statusCode: 409, code: "DESIGN_DNA_SOURCE_MISSING" });
      const currentVersions = (store.designDnaSnapshots || []).filter((item) => item.accountId === accountId).map((item) => Number(item.version) || 0);
      const snapshot = createAuthoredDesignDnaSnapshot({
        accountId,
        version: Math.max(Number(account.visualStyle?.designDnaVersion) || 0, ...currentVersions, 0) + 1,
        styleRules: payload.styleRules,
        sourceFiles: payload.mode === "user_authored" ? [] : sourceFiles,
        authorizedFileIds: payload.mode === "user_authored" ? [] : approvedFileIds,
        mode: payload.mode,
        userAuthoredRulesAuthorized: payload.userAuthoredRulesAuthorized === true,
        providerCapabilities: { referenceImages: false }
      });
      account.visualStyle ||= { name: "账号视觉系统", description: "", assetRefs: [] };
      account.visualStyle.assetRefs = refs.map((item) => ({ ...item, externalUseApproved: decisionMap.get(item.fileId) === true }));
      store.designDnaSnapshots ||= [];
      store.designDnaSnapshots.push(snapshot);
      account.visualStyle.designDnaSnapshotId = snapshot.id;
      account.visualStyle.designDnaVersion = snapshot.version;
      account.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, { item: snapshot, snapshotRef: createDesignDnaSnapshotRef(snapshot), historyCount: store.designDnaSnapshots.filter((item) => item.accountId === accountId).length });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "DESIGN_DNA_AUTHORING_FAILED" });
    }
  }
  if (req.method === "GET" && accountDesignDnaMatch) {
    try {
      const accountId = accountDesignDnaMatch[1];
      const account = (store.accounts || []).find((item) => item.id === accountId && item.accountType !== "company");
      if (!account) return sendJson(res, 404, { error: "Social account not found", code: "DESIGN_DNA_ACCOUNT_NOT_FOUND" });
      assertOwnershipContext(resolveOwnershipContext(store, { accountId }));
      const snapshots = (store.designDnaSnapshots || []).filter((item) => item.accountId === accountId);
      const item = snapshots.at(-1) || null;
      const availableSources = (Array.isArray(account.visualStyle?.assetRefs) ? account.visualStyle.assetRefs : []).map((source) => {
        const file = buildDesignDnaSourceFiles([source.fileId])[0];
        return {
          fileId: source.fileId,
          name: file?.name || source.name,
          assetType: source.assetType || "visual_reference",
          parseStatus: file?.parseStatus || source.parseStatus,
          parseMode: file?.parseMode || source.parseMode,
          pageCount: file?.pageCount || 0,
          contentMode: file?.contentMode || "text",
          externalUseApproved: source.externalUseApproved === true
        };
      });
      return sendJson(res, 200, { item, snapshotRef: item ? createDesignDnaSnapshotRef(item) : null, availableSources, analysisDraft: account.visualStyle?.analysisDraft || null, historyCount: snapshots.length });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "DESIGN_DNA_ACCOUNT_OWNERSHIP_INVALID" });
    }
  }
  const accountDesignDnaConfirmMatch = path.match(/^\/accounts\/([^/]+)\/design-dna\/confirm$/);
  if (req.method === "POST" && accountDesignDnaConfirmMatch) {
    try {
      const accountId = accountDesignDnaConfirmMatch[1];
      const account = (store.accounts || []).find((item) => item.id === accountId && item.accountType !== "company");
      if (!account) return sendJson(res, 404, { error: "Social account not found", code: "DESIGN_DNA_ACCOUNT_NOT_FOUND" });
      assertOwnershipContext(resolveOwnershipContext(store, { accountId }));
      const payload = await bodyJson(req);
      const result = confirmExactDesignDnaSnapshot({
        account,
        snapshots: store.designDnaSnapshots || [],
        snapshotRef: payload.snapshotRef,
        confirmedBy: payload.confirmedBy,
        note: payload.note
      });
      store.designDnaSnapshots[result.index] = result.confirmed;
      account.visualStyle.designDnaSnapshotId = result.confirmed.id;
      account.visualStyle.designDnaVersion = result.confirmed.version;
      account.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, { item: result.confirmed, snapshotRef: result.snapshotRef });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "DESIGN_DNA_CONFIRM_FAILED" });
    }
  }

  const accountMatch = path.match(/^\/accounts\/([^/]+)$/);
  if (req.method === "PATCH" && accountMatch) {
    const index = store.accounts.findIndex((item) => item.id === accountMatch[1]);
    if (index < 0) return sendJson(res, 404, { error: "Account not found" });
    const payload = await bodyJson(req);
    const previousAccount=store.accounts[index];
    if(previousAccount.accountType==="company")return sendJson(res,400,{error:"公司资料不能通过社媒账号接口修改",code:"SOCIAL_ACCOUNT_REQUIRED"});
    const timestamp=new Date().toISOString();
    const identityTouched=Object.hasOwn(payload,"accountIdentity")||["subjectType","speakerType","speakerDetail","trustSources"].some((key)=>Object.hasOwn(payload,key));
    const previousIdentity=normalizeSocialAccountIdentity(previousAccount);
    const identityCandidate=identityTouched?normalizeSocialAccountIdentity(previousAccount,{...previousIdentity,...(payload.accountIdentity||{}),subjectType:payload.subjectType||payload.accountIdentity?.subjectType||previousIdentity.subjectType,speakerType:payload.speakerType||payload.accountIdentity?.speakerType||previousIdentity.speakerType,speakerDetail:payload.speakerDetail??payload.accountIdentity?.speakerDetail??previousIdentity.speakerDetail,trustSources:payload.trustSources||payload.accountIdentity?.trustSources||previousIdentity.trustSources,id:previousIdentity.id,companyId:previousAccount.companyId,socialAccountId:previousAccount.id,version:previousIdentity.version,updatedAt:previousIdentity.updatedAt}):previousIdentity;
    const identityChanged=identityTouched&&["subjectType","publicIdentity","speakerType","speakerDetail"].some((key)=>identityCandidate[key]!==previousIdentity[key])||identityTouched&&JSON.stringify(identityCandidate.trustSources)!==JSON.stringify(previousIdentity.trustSources);
    const nextIdentity=identityChanged?{...identityCandidate,version:Number(previousIdentity.version||1)+1,updatedAt:timestamp}:previousIdentity;
    const safePayload={...payload};delete safePayload.id;delete safePayload.companyId;delete safePayload.socialAccountId;delete safePayload.accountIdentityId;
    store.accounts[index] = { ...previousAccount, ...safePayload,accountIdentity:nextIdentity,accountIdentityId:nextIdentity.id,accountIdentityVersion:nextIdentity.version,subjectType:nextIdentity.subjectType, updatedAt: timestamp };
    const account = store.accounts[index];
    const company=store.accounts.find((item)=>item.accountType==="company"&&item.id===account.companyId)||null;
    if(account.status==="setup_required"&&evaluateSocialAccountConfiguration(account,company).identityComplete)account.status="active";
    account.configurationStatus=evaluateSocialAccountConfiguration(account,company).status;
    const strategyKeys = ["businessMode", "audience", "tone", "contentPillars", "subjectType", "accountMode", "matrixRole", "growthStage", "growthPlaybook", "platformPlaybook"];
    if (account.accountType === "social" && strategyKeys.some((key) => Object.hasOwn(payload, key))) {
      ensureStrategyHierarchy(store);
      const previous = getActiveAccountStrategy(store, account.id)?.payload || {};
      const contentPillars = Array.isArray(payload.contentPillars) ? payload.contentPillars.map((item, pillarIndex) => typeof item === "string" ? { id: `account_pillar_${pillarIndex + 1}`, name: item } : item) : previous.contentPillars;
      saveAccountStrategySnapshot(store, {
        workspaceId: account.workspaceId,
        companyId: account.companyId,
        matrixId: account.matrixId || getCompanyMatrix(store, account.companyId)?.id || null,
        socialAccountId: account.id,
        source: "account_settings_confirmed",
        payload: {
          ...previous,
          subjectType: payload.subjectType || previous.subjectType,
          accountMode: payload.accountMode || payload.businessMode || previous.accountMode,
          matrixRole: payload.matrixRole || previous.matrixRole,
          growthStage: payload.growthStage || previous.growthStage,
          growthPlaybook: payload.growthPlaybook || previous.growthPlaybook,
          ...(payload.audience ? { audiences: [{ id: `audience_${account.id}`, name: payload.audience, priority: 1 }] } : {}),
          ...(contentPillars ? { contentPillars } : {}),
          platformPlaybook: { ...(previous.platformPlaybook || {}), ...(payload.platformPlaybook || {}), ...(payload.tone ? { toneDefaults: String(payload.tone).split(/[,，]/).map((item) => item.trim()).filter(Boolean) } : {}) }
        }
      });
    }
    await writeStore(store);
    return sendJson(res, 200, projectSocialAccount(account,company));
  }

  if (req.method === "POST" && path === "/collections/run") {
    const payload = await bodyJson(req);
    const collectionPayload = { ...payload, poolType: payload.keywords?.length ? "keyword" : "global" };
    let result;
    try {
      result = await runHotspotPipeline(collectionPayload, store);
    } catch (error) {
      const failedRun = recordHotspotFailure(store, collectionPayload, error);
      await writeStore(store);
      return sendJson(res, 502, { error: error.message, code: failedRun.failure.errorClass, run: failedRun, retryAction: failedRun.failure.retryAction });
    }
    const run = { ...result.run, id: id("run"), discovered: result.run.stats.collected, merged: result.run.stats.opportunities };
    store.collectionRuns.push(run);
    store.hotspotRuns ||= [];
    store.hotspotRuns.push(result.run);
    const preview = { id: id("preview"), companyId: payload.companyId || null, status: "preview_ready", run: result.run, opportunities: result.opportunities || [], rejectedByRelevance: result.rejectedByRelevance || [], createdAt: new Date().toISOString() };
    store.hotspotPreviews.push(preview);
    await writeStore(store);
    return sendJson(res, 201, { ...run, previewId: preview.id, previewStatus: preview.status });
  }

  if (req.method === "POST" && path === "/hotspot-runs") {
    const payload = await bodyJson(req);
    const sourceDirection = (store.contentDirections || []).find((item) => item.id === payload.directionId);
    const strategySnapshotId = sourceDirection?.strategySnapshotId || null;
    const companyId=sourceDirection?.companyId||payload.companyId||"account_damaishuzhi";
    let result;
    try {
      result = await runHotspotPipeline(payload, store);
    } catch (error) {
      const failedRun = recordHotspotFailure(store, payload, error, { companyId });
      await writeStore(store);
      return sendJson(res, 502, { error: error.message, code: failedRun.failure.errorClass, run: failedRun, retryAction: failedRun.failure.retryAction });
    }
    result.run.strategySnapshotId = strategySnapshotId; result.run.companyId=companyId;
    result.opportunities = (result.opportunities || []).map((item) => ({ ...item, strategySnapshotId,companyId }));
    store.hotspotRuns ||= [];
    store.hotspotRuns.push(result.run);
    const preview = { id: id("preview"),companyId, status: "preview_ready", run: result.run, opportunities: result.opportunities || [], rejectedByRelevance: result.rejectedByRelevance || [], createdAt: new Date().toISOString() };
    store.hotspotPreviews.push(preview);
    if (store.hotspotPreviews.length > 30) store.hotspotPreviews = store.hotspotPreviews.slice(-30);
    store.activityLogs.push({ id: id("log"), action: "hotspot.pipeline.completed", subjectId: result.run.id, actor: "热点雷达", createdAt: new Date().toISOString() });
    await writeStore(store);
    return sendJson(res, 201, { ...result, previewId: preview.id });
  }

  const commitPreviewMatch = path.match(/^\/hotspot-runs\/([^/]+)\/commit$/);
  if (req.method === "POST" && commitPreviewMatch) {
    const payload = await bodyJson(req);
    const preview = (store.hotspotPreviews || []).find((item) => item.id === commitPreviewMatch[1] || item.run?.id === commitPreviewMatch[1]);
    if (!preview) return sendJson(res, 404, { error: "热点搜索预览不存在或已过期" });
    let result;
    try {
      result = commitHotspotPreview(store, preview, {
        selectedIds: payload.opportunityIds || [],
        companyId: payload.companyId || preview.companyId || null,
        committedBy: payload.committedBy || "product_user"
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message, code: error.code || "HOTSPOT_COMMIT_FAILED" });
    }
    store.activityLogs.push({ id: id("log"), action: "hotspot.library.committed", subjectId: preview.id, actor: "热点雷达", createdAt: new Date().toISOString() });
    await writeStore(store);
    return sendJson(res, 200, { previewId: preview.id, stats: result, mappings: result.mappings, items: result.items, libraryTotal: store.hotspotLibrary.length });
  }

  const hotspotLibraryMatch = path.match(/^\/hotspot-library\/([^/]+)$/);
  if (req.method === "PATCH" && hotspotLibraryMatch) {
    const index = (store.hotspotLibrary || []).findIndex((item) => item.id === hotspotLibraryMatch[1]);
    if (index < 0) return sendJson(res, 404, { error: "热点不存在" });
    const payload = await bodyJson(req);
    if (!['active', 'ignored'].includes(payload.status)) return sendJson(res, 400, { error: "status must be active or ignored" });
    store.hotspotLibrary[index] = { ...store.hotspotLibrary[index], status: payload.status, updatedAt: new Date().toISOString() };
    await writeStore(store);
    return sendJson(res, 200, store.hotspotLibrary[index]);
  }

  if (req.method === "POST" && path === "/manual-signals") return sendJson(res, 410, { error: "人工信号功能已移除" });

  if (req.method === "POST" && path === "/topics/generate") {
    const payload = await bodyJson(req);
    const direction = (store.contentDirections || []).find((item) => item.id === payload.directionId);
    payload.companyId=direction?.companyId||payload.companyId||"account_damaishuzhi";
    if (direction?.strategySnapshotId) {
      const strategyAccount = (store.accounts || []).find((item) => item.strategySnapshotId === direction.strategySnapshotId);
      if (strategyAccount) payload.accountId = strategyAccount.id;
    }
    const result = await runTopicPipeline(payload, store);
    store.topicRuns ||= [];
    result.run.candidates = result.candidates || []; result.run.companyId=payload.companyId;
    result.run.rejected = result.rejected || [];
    store.topicRuns.push(result.run);
    store.topics ||= [];
    if (result.topics.length) {
      const replacedCategories = payload.category === "all" || !payload.category ? new Set(["keyword", "cross_trend"]) : new Set([payload.category]);
      store.topics = store.topics.filter((item) => !(item.directionId === payload.directionId && replacedCategories.has(item.topicCategory)));
      store.topics.unshift(...result.topics.map((item) => ({ ...item,companyId:payload.companyId, topicRunId: result.run.id })));
    }
    store.activityLogs.push({ id: id("log"), action: "topics.pipeline.completed", subjectId: result.run.id, actor: "选题编排器", createdAt: new Date().toISOString() });
    await writeStore(store);
    return sendJson(res, 201, result);
  }

  const topicSelectionMatch = path.match(/^\/topics\/([^/]+)\/select$/);
  if (req.method === "POST" && topicSelectionMatch) {
    const payload = await bodyJson(req);
    const topic = (store.topics || []).find((item) => item.id === topicSelectionMatch[1]);
    if (!topic) return sendJson(res, 404, { error: "Topic not found" });
    const platform = payload.platform === "wechat" ? "wechat" : payload.platform === "xiaohongshu" ? "xiaohongshu" : null;
    if (!platform) return sendJson(res, 400, { error: "platform must be xiaohongshu or wechat" });
    const platformTopic = topic.platformTopics?.[platform];
    if (!platformTopic?.platform_topic) return sendJson(res, 409, { error: "该母选题没有可用的平台子选题" });
    if (Number(platformTopic.fit_score || 0) < 60 && payload.force !== true) return sendJson(res, 409, { error: "平台适配分低于 60，请确认风险后使用 force=true 继续" });
    const selection = {
      id: id("topicselection"),
      topicId: topic.id,
      candidateId: topic.candidateId,
      topicCategory: topic.topicCategory,
      directionId: topic.directionId,
      strategySnapshotId: topic.strategySnapshotId || null,
      accountId: topic.accountId || null,
      companyId: topic.companyId || null,
      platform,
      motherTopic: topic.motherTopic,
      platformTopic,
      evidenceIds: topic.evidenceIds,
      evidence: topic.evidence,
      risks: [...(topic.risks || []), ...(platformTopic.platform_risks || [])],
      status: "selected",
      selectedAt: new Date().toISOString()
    };
    store.topicSelections ||= [];
    store.topicSelections.push(selection);
    await writeStore(store);
    return sendJson(res, 201, selection);
  }

  const hotspotRunMatch = path.match(/^\/hotspot-runs\/([^/]+)$/);
  if (req.method === "GET" && hotspotRunMatch) {
    const run = (store.hotspotRuns || []).find((item) => item.id === hotspotRunMatch[1]);
    return run ? sendJson(res, 200, run) : sendJson(res, 404, { error: "Hotspot run not found" });
  }

  const topicMatch = path.match(/^\/opportunities\/([^/]+)\/topics$/);
  if (req.method === "POST" && topicMatch) {
    return sendJson(res, 410, { error: "旧的单热点演示选题接口已停用，请使用 POST /api/v1/topics/generate" });
  }

  if (req.method === "POST" && path === "/content-learning/imports") {
    const payload = await bodyJson(req);
    const ownership = assertOwnershipContext(resolveOwnershipContext(store, { accountId: payload.accountId || "acc_xhs", companyId: payload.companyId, socialAccountId: payload.socialAccountId }));
    const { job, accepted } = createReferenceImportJob(store, { items: payload.items, scope: ownership, platform: payload.platform || "unknown", sourceType: payload.sourceType || "folder", submittedBy: payload.submittedBy || "product_user" });
    const failures = [];
    let analyzed = 0;
    for (const item of accepted) {
      try {
        const analysis = analyzeViralPost({ ...item, url: item.sourceUrl, text: item.rawText });
        const recorded = recordReferenceAnalysis(store, item, analysis);
        recorded.referencePost.scope = ownership;
        recorded.referencePost.importFingerprint = item.fingerprint;
        recorded.referencePost.importJobId = job.id;
        recorded.referencePost.quality = item.quality;
        const skillResult = await analyzeViralWithSkill({ payload: item, legacyAnalysis: analysis, scope: ownership, generateText });
        const patternAnalysis = recordPatternAnalysisCandidate(store, { payload: item, legacyAnalysis: analysis, skillAnalysis: skillResult.analysis, skillTrace: skillResult.skillTrace, scope: ownership });
        patternAnalysis.importJobId = job.id;
        store.referenceAnalyses.push(analysis);
        analyzed += 1;
      } catch (error) {
        failures.push({ name: item.sourceName || item.title, error: error.message });
      }
    }
    completeReferenceImportJob(job, { analyzed, failed: failures });
    await writeStore(store);
    return sendJson(res, 201, { job, accepted: accepted.length, analyzed, failures });
  }

  if (req.method === "POST" && path === "/content-learning/clusters/run") {
    const payload = await bodyJson(req);
    const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
    const items = buildPatternClusters(store, { scope });
    await writeStore(store);
    return sendJson(res, 201, { items });
  }

  if (req.method === "POST" && path === "/content-learning/upgrade-proposals/run") {
    const payload = await bodyJson(req);
    const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
    const items = proposeBlueprintUpgrades(store, { scope });
    await writeStore(store);
    return sendJson(res, 201, { items });
  }

  const upgradeProposalReviewMatch = path.match(/^\/content-learning\/upgrade-proposals\/([^/]+)\/review$/);
  if (req.method === "POST" && upgradeProposalReviewMatch) {
    try {
      const payload = await bodyJson(req);
      const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
      const result = reviewBlueprintUpgrade(store, upgradeProposalReviewMatch[1], { ...payload, scope });
      await writeStore(store);
      return sendJson(res, 201, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }

  if (req.method === "POST" && path === "/content-learning/performance/refresh") {
    const payload = await bodyJson(req);
    const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
    const result = buildPatternPerformanceDashboard(store, { scope });
    await writeStore(store);
    return sendJson(res, 201, result);
  }

  if (req.method === "POST" && path === "/content-learning/skill-promotions/run") {
    const payload = await bodyJson(req);
    const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
    const result = buildSkillPromotionCandidates(store, { scope });
    await writeStore(store);
    return sendJson(res, 201, result);
  }

  const skillPromotionReviewMatch = path.match(/^\/content-learning\/skill-promotions\/([^/]+)\/review$/);
  if (req.method === "POST" && skillPromotionReviewMatch) {
    try {
      const payload = await bodyJson(req);
      const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
      const result = reviewSkillPromotion(store, skillPromotionReviewMatch[1], { ...payload, scope });
      await writeStore(store);
      return sendJson(res, 201, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }

  if (req.method === "POST" && path === "/reference-posts/analyze") {
    const payload = await bodyJson(req);
    const analysis = analyzeViralPost(payload);
    recordReferenceAnalysis(store, payload, analysis);
    const ownership = resolveOwnershipContext(store, { accountId: payload.accountId || "acc_xhs", companyId: payload.companyId, socialAccountId: payload.socialAccountId });
    const skillResult = await analyzeViralWithSkill({ payload, legacyAnalysis: analysis, scope: ownership, generateText });
    recordPatternAnalysisCandidate(store, { payload, legacyAnalysis: analysis, skillAnalysis: skillResult.analysis, skillTrace: skillResult.skillTrace, scope: ownership });
    analysis.skillTrace = skillResult.skillTrace;
    analysis.skillProviderMode = skillResult.providerMode;
    analysis.skillWarning = skillResult.warning;
    store.referenceAnalyses.push(analysis);
    await writeStore(store);
    return sendJson(res, 201, analysis);
  }

  const patternAnalysisReviewMatch = path.match(/^\/content-learning\/analyses\/([^/]+)\/review$/);
  if (req.method === "POST" && patternAnalysisReviewMatch) {
    try {
      const payload = await bodyJson(req);
      const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
      const result = reviewPatternAnalysis(store, patternAnalysisReviewMatch[1], { ...payload, scope });
      await writeStore(store);
      return sendJson(res, 201, result);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }

  if (req.method === "GET" && path === "/content-learning/evaluation-suite") {
    const accountId = url.searchParams.get("accountId") || null;
    const scope = accountId ? resolveOwnershipContext(store, { accountId }) : null;
    const analyses = (store.contentPatternAnalyses || []).filter((item) => !scope || patternVisibleToScope(item, scope));
    return sendJson(res, 200, createCaseDrivenEvaluationSuite(analyses, { accountId }));
  }

  if (req.method === "POST" && path === "/content-learning/evaluate") {
    try {
      const payload = await bodyJson(req);
      return sendJson(res, 201, evaluateContentSkillOutput(payload.case, payload.output));
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const patternBlueprintLifecycleMatch = path.match(/^\/content-learning\/blueprints\/([^/]+)\/lifecycle$/);
  if (req.method === "PATCH" && patternBlueprintLifecycleMatch) {
    try {
      const payload = await bodyJson(req);
      const scope = payload.accountId ? resolveOwnershipContext(store, { accountId: payload.accountId, companyId: payload.companyId, socialAccountId: payload.socialAccountId }) : null;
      const blueprint = updatePatternBlueprintLifecycle(store, patternBlueprintLifecycleMatch[1], { ...payload, scope });
      await writeStore(store);
      return sendJson(res, 200, blueprint);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }

  const analysisMatch = path.match(/^\/reference-posts\/analyses\/([^/]+)$/);
  if (req.method === "GET" && analysisMatch) {
    const analysis = store.referenceAnalyses.find((item) => item.id === analysisMatch[1]);
    return analysis ? sendJson(res, 200, analysis) : sendJson(res, 404, { error: "Analysis not found" });
  }

  const remixMatch = path.match(/^\/reference-posts\/analyses\/([^/]+)\/remix$/);
  if (req.method === "POST" && remixMatch) {
    const analysis = store.referenceAnalyses.find((item) => item.id === remixMatch[1]);
    if (!analysis) return sendJson(res, 404, { error: "Analysis not found" });
    const remix = buildOriginalRemix(analysis, await bodyJson(req), store);
    store.remixBriefs ||= [];
    store.remixBriefs.push(remix);
    await writeStore(store);
    return sendJson(res, 201, remix);
  }

  const wechatRecoveryMatch = path.match(/^\/content-tasks\/([^/]+)\/recover-wechat-article$/);
  if (req.method === "POST" && wechatRecoveryMatch) {
    const payload = await bodyJson(req);
    const task = store.contentTasks.find((item) => item.id === wechatRecoveryMatch[1]);
    if (!task) return sendJson(res, 404, { error: "Content task not found", code: "CONTENT_TASK_NOT_FOUND" });
    const workflow = (store.contentWorkflows || []).find((item) => item.id === (task.contentRunId || task.contentWorkflowId));
    try {
      const account = store.accounts.find((item) => item.id === task.accountId) || null;
      const knowledgeAssets = (store.knowledgeEntities || []).filter((item) => (task.knowledgeIds || []).includes(item.id));
      const result = await recoverWechatContentTask({
        task,
        actor: payload.actor || "workspace_user",
        runProviderPreflight: async () => generateText({
          task: "wechat_content_recovery_preflight",
          contract: "ConsultativeReply@2.0",
          instruction: "只返回 JSON 对象，assistantMessage 填写 provider_ready。此预检不得生成业务正文。",
          outputSchema: { assistantMessage: "provider_ready" },
          contentRunId: workflow?.id || task.contentRunId
        }, { assistantMessage: "provider_unavailable" }),
        runPipeline: async () => runContentPipeline({
          payload: {
            ...(workflow?.generationPayload || {}),
            platform: "wechat",
            wechatBodyRecovery: true,
            ideaTitle: task.ideaTitle,
            contentRunId: workflow?.id || task.contentRunId,
            contentWorkflowId: workflow?.id || task.contentWorkflowId,
            contentExecutionContext: task.contentExecutionContext,
            contentTaskBrief: task.contentTaskBrief,
            contentSourcePlan: task.contentSourcePlan,
            contentPurposeId: task.contentPurposeId,
            promotionMode: task.promotionMode,
            titlePerformanceSignals: []
          },
          selection: null,
          intentProfile: task.contentIntentProfile,
          citations: [],
          account,
          knowledgeAssets,
          contentTaskBrief: task.contentTaskBrief,
          contentSourcePlan: task.contentSourcePlan,
          factSnapshot: null,
          preparedContentMaster: { status: "ready", data: structuredClone(task.contentMaster) },
          preparationSkillTrace: null,
          confirmedOutline: task.confirmedOutline || workflow?.outline || null,
          skillExecutionPlan: task.skillExecutionPlan || workflow?.skillExecutionPlan || null
        }, { generateText })
      });
      store.contentVersions ||= [];
      if (result.versionRecord) store.contentVersions.push(result.versionRecord);
      if (workflow && result.recoveryRecord) recordWechatContentRecovery(workflow, task, result.recoveryRecord);
      await writeStore(store);
      if (result.providerUnavailable) return sendJson(res, 503, { error: "Provider 暂不可用，请稍后手动重试", code: "PROVIDER_UNAVAILABLE_RETRY_LATER", nextRetryAt: result.nextRetryAt, providerFailure: result.providerFailure, liveWindow: result.liveWindow });
      return sendJson(res, 200, { ...task, recovery: result.recoveryRecord, recovered: result.recovered });
    } catch (error) {
      return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code || "WECHAT_BODY_RECOVERY_FAILED", nextRetryAt: error.nextRetryAt || null });
    }
  }

  const naturalizeMatch = path.match(/^\/content-tasks\/([^/]+)\/naturalize$/);
  if (req.method === "POST" && naturalizeMatch) {
    try {
      const payload = await bodyJson(req);
      const task = store.contentTasks.find((item) => item.id === naturalizeMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      if (task.skillExecutionPlan) task.skillExecutionPlan = refreshSkillExecutionPlan(task.skillExecutionPlan, { naturalizationMode: payload.mode || "audit_only" });
      const naturalizationStep = task.skillExecutionPlan?.steps?.find((step) => step.id === "naturalization") || null;
      const proposal = await proposeNaturalization(task, payload, { generateText, planStep: naturalizationStep });
      task.naturalizationProposals ||= [];
      task.naturalizationProposals.push({ id: id("naturalization"), version: task.version, ...proposal, createdAt: new Date().toISOString() });
      if (proposal.executionRecord) task.executionRecords = [...(task.executionRecords || []), proposal.executionRecord];
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, proposal);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code || null });
    }
  }

  const storyboardMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-storyboard$/);
  if (["GET", "POST", "PATCH"].includes(req.method) && storyboardMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === storyboardMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      if (task.platform !== "xiaohongshu") return sendJson(res, 400, { error: "视觉分镜仅适用于小红书内容" });
      if (!task.visualStoryboard || task.visualStoryboard.contentVersion !== task.version) task.visualStoryboard = createXhsVisualStoryboard(task);
      if (["POST", "PATCH"].includes(req.method)) task.visualStoryboard = updateXhsVisualStoryboard(task, await bodyJson(req));
      task.visualStoryboard.validation = validateXhsVisualStoryboard(task.visualStoryboard);
      task.visualWorkflowState = task.visualStoryboard.status === "visual_storyboard_confirmed" ? "visual_storyboard_confirmed" : "visual_storyboard_ready";
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, req.method === "GET" ? 200 : 201, task.visualStoryboard);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code, details: error.details || [] });
    }
  }

  const storyboardConfirmMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-storyboard\/confirm$/);
  if (req.method === "POST" && storyboardConfirmMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === storyboardConfirmMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      const storyboard = confirmXhsVisualStoryboard(task, await bodyJson(req));
      task.delivery = null;
      task.visualQualityConfirmation = null;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, storyboard);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code, details: error.details || [] });
    }
  }

  const visualDirectionMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-direction$/);
  if (["GET", "PATCH"].includes(req.method) && visualDirectionMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === visualDirectionMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      if (task.platform !== "xiaohongshu") return sendJson(res, 400, { error: "视觉导演仅适用于小红书内容" });
      const payload = req.method === "PATCH" ? await bodyJson(req) : {};
      const directionVersionChanged = task.visualDirectionSet && task.visualDirectionSet.contentVersion !== task.version;
      let directionWasCreated = false;
      if (!task.visualDirectionSet || directionVersionChanged || req.method === "PATCH") {
        if (directionVersionChanged) {
          task.visualDirectionHistory ||= [];
          if (!task.visualDirectionHistory.some((item) => item.id === task.visualDirectionSet.id)) task.visualDirectionHistory.push(structuredClone(task.visualDirectionSet));
        }
        const designDnaSnapshot = (store.designDnaSnapshots || []).find((item) => item.id === (payload.designDnaSnapshotId || task.designDnaSnapshotId) && item.status === "confirmed") || null;
        task.visualDirectionSet = createVisualDirectionSet(task, {
          mode: payload.mode || task.visualDirectionSet?.mode || "smart_hybrid",
          providerConfig: getPublicProviderConfig(),
          designDnaSnapshot,
          candidateCount: payload.candidateCount || task.visualDirectionSet?.candidateCount || 1
        });
        task.visualCandidates = [];
        task.delivery = null;
        task.visualQualityConfirmation = null;
        directionWasCreated = true;
      }
      const validation = validateVisualDirectionSet(task.visualDirectionSet);
      const compatibilityProjection = projectVisualDirectionCompatibility(task);
      if (req.method === "GET" && !directionWasCreated) return sendJson(res, 200, { ...task.visualDirectionSet, validation, compatibilityProjection });
      task.visualDirectionSet.validation = validation;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, req.method === "GET" ? 200 : 201, { ...task.visualDirectionSet, compatibilityProjection });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code, details: error.details || [] });
    }
  }

  const visualDirectionConfirmMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-direction\/confirm$/);
  if (req.method === "POST" && visualDirectionConfirmMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === visualDirectionConfirmMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      const payload = await bodyJson(req);
      if (task.visualStoryboard?.status !== "visual_storyboard_confirmed") confirmXhsVisualStoryboard(task, { confirmedBy: payload.confirmedBy, note: "随视觉导演方案一并确认" });
      const direction = confirmVisualDirectionSet(task, payload);
      task.delivery = null;
      task.visualQualityConfirmation = null;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, direction);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code, details: error.details || [] });
    }
  }

  const candidateSelectMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-candidates\/select$/);
  if (req.method === "POST" && candidateSelectMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === candidateSelectMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      const items = selectVisualCandidate(task, await bodyJson(req));
      task.delivery = null;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, { items, summary: visualCandidateSummary(task) });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code });
    }
  }

  const candidateReviewMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-candidates\/review$/);
  if (req.method === "POST" && candidateReviewMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === candidateReviewMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      const items = reviewVisualCandidate(task, await bodyJson(req));
      task.delivery = null;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, { items, summary: visualCandidateSummary(task) });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code, details: error.details || [] });
    }
  }

  const candidateFallbackMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-candidates\/([^/]+)\/fallback$/);
  if (req.method === "POST" && candidateFallbackMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === candidateFallbackMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      const result = fallbackVisualPage(task, { pageId: candidateFallbackMatch[2], ...(await bodyJson(req)) });
      task.delivery = null;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, 201, { ...result, summary: visualCandidateSummary(task) });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code });
    }
  }


  const wechatImagesConfirmMatch = path.match(/^\/content-tasks\/([^/]+)\/wechat-images\/confirm$/);
  if (req.method === "POST" && wechatImagesConfirmMatch) {
    try {
      const payload = await bodyJson(req);
      const task = store.contentTasks.find((item) => item.id === wechatImagesConfirmMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      if (task.platform !== "wechat") return sendJson(res, 409, { error: "Only WeChat image sets can use this confirmation", code: "WECHAT_IMAGE_CONFIRMATION_PLATFORM_INVALID" });
      if (payload.decision !== "approved") return sendJson(res, 400, { error: "decision must be approved", code: "WECHAT_IMAGE_CONFIRMATION_DECISION_INVALID" });
      const assets = (task.generatedAssets || []).filter((item) => item.version === task.version && item.status === "succeeded" && item.relativePath);
      if (!assets.length || assets.length !== (task.imageTasks || []).filter((item) => item.version === task.version).length) return sendJson(res, 409, { error: "All current WeChat generated images must be ready before confirmation", code: "WECHAT_IMAGE_SET_NOT_READY" });
      const confirmedAt = new Date().toISOString();
      for (const asset of assets) {
        asset.qualityStatus = "approved";
        asset.selected = true;
        asset.qualityReview = { ocr: "passed", fact: "passed", visual: "passed", decision: "approved", reviewedBy: payload.confirmedBy || "workspace_user", reviewedAt: confirmedAt, note: payload.note || "" };
        asset.license = { id: `provider-generated-user-authorized:${asset.providerTaskId || asset.id}`, allowsPublication: true, basis: "user_authorized_provider_generation" };
      }
      task.wechatImageQualityConfirmation = { version: task.version, decision: "approved", confirmedBy: payload.confirmedBy || "workspace_user", confirmedAt, note: payload.note || "", assetIds: assets.map((item) => item.assetId) };
      task.delivery = null;
      task.updatedAt = confirmedAt;
      await writeStore(store);
      return sendJson(res, 201, { contentTaskId: task.id, confirmation: task.wechatImageQualityConfirmation, generatedAssets: assets });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code });
    }
  }

  const renderMatch = path.match(/^\/content-tasks\/([^/]+)\/render$/);
  if (req.method === "POST" && renderMatch) {
    try {
    const task = store.contentTasks.find((item) => item.id === renderMatch[1]);
    if (!task) return sendJson(res, 404, { error: "Content task not found" });
    task.visualWorkflowState = task.platform === "xiaohongshu" ? "rendering" : task.visualWorkflowState;
    const delivery = await renderContentDelivery(task, { root });
    if (task.platform === "xiaohongshu") task.visualWorkflowState = delivery.validation?.status === "needs_review" ? "needs_review" : "visual_review";
    const hasRenderedAssets = Boolean(delivery?.renderedAt && (delivery?.rendered || []).some((item) => item.status === "succeeded" && item.pngPath));
    if (task.skillExecutionPlan) task.skillExecutionPlan = refreshSkillExecutionPlan(task.skillExecutionPlan, { hasRenderedAssets });
    const renderRun = (store.contentWorkflows || []).find((item) => item.id === task.contentRunId);
    if (renderRun) {
      renderRun.skillExecutionPlan = task.skillExecutionPlan ? structuredClone(task.skillExecutionPlan) : renderRun.skillExecutionPlan;
      updateRunNode(renderRun, "render", hasRenderedAssets ? "completed" : "needs_review", { contentTaskId: task.id });
    }
    task.updatedAt = new Date().toISOString();
    await writeStore(store);
    return sendJson(res, delivery.status === "ready" ? 201 : 202, { contentTaskId: task.id, delivery, imageTasks: task.imageTasks });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message, code: error.code, details: error.details || [] });
    }
  }

  const visualReviewMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-review$/);
  if (req.method === "POST" && visualReviewMatch) {
    try {
      const task = store.contentTasks.find((item) => item.id === visualReviewMatch[1]);
      if (!task) return sendJson(res, 404, { error: "Content task not found" });
      const visualStep = task.skillExecutionPlan?.steps?.find((step) => step.id === "visual_review") || null;
      const review = await reviewRenderedXhsTask(task, { root, generateText, planStep: visualStep });
      task.visualReviews ||= [];
      task.visualReviews.push({ id: id("visual_review"), version: task.version, ...review, createdAt: new Date().toISOString() });
      if (review.executionRecord) task.executionRecords = [...(task.executionRecords || []), review.executionRecord];
      const visualRun = (store.contentWorkflows || []).find((item) => item.id === task.contentRunId);
      if (visualRun) updateRunNode(visualRun, "visual_review", ["pending_render", "waiting_human_confirmation"].includes(review.status) ? "needs_review" : review.data?.decision === "block" ? "blocked" : "completed", { contentTaskId: task.id, traceId: review.skillTrace?.traceId || null });
      task.visualWorkflowState = task.delivery?.validation?.status === "needs_review" ? "needs_review" : review.status === "waiting_human_confirmation" ? "visual_review" : task.visualWorkflowState;
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      return sendJson(res, review.status === "pending_render" ? 202 : 201, review);
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message });
    }
  }

  const visualConfirmMatch = path.match(/^\/content-tasks\/([^/]+)\/visual-review\/confirm$/);
  if (req.method === "POST" && visualConfirmMatch) {
    const payload = await bodyJson(req);
    const task = store.contentTasks.find((item) => item.id === visualConfirmMatch[1]);
    if (!task) return sendJson(res, 404, { error: "Content task not found" });
    if (!task.delivery?.renderedAt) return sendJson(res, 409, { error: "请先生成当前版本的卡片预览", code: "XHS_RENDER_PREVIEW_REQUIRED" });
    const deterministicReports = task.delivery?.deterministicPageQualityReports || task.deterministicPageQualityReports || [];
    if (!deterministicReports.length) return sendJson(res, 409, { error: "当前版本缺少确定性页面质量报告", code: "XHS_DETERMINISTIC_QUALITY_REQUIRED" });
    try { for (const report of deterministicReports) await verifyDeterministicPageQualityArtifacts(report, { root }); }
    catch (error) { return sendJson(res, error.statusCode || 409, { error: error.message, code: error.code, details: error.details || [] }); }
    if (task.delivery.validation?.status === "needs_review") return sendJson(res, 409, { error: `卡片预览仍有质量阻断：${(task.delivery.validation.blockers || []).join("、")}`, code: "XHS_RENDER_QUALITY_GATE_BLOCKED", details: task.delivery.validation.checks?.filter((item) => item.result === "fail") || [] });
    const decision = payload.decision === "rejected" ? "rejected" : "approved";
    task.visualQualityConfirmation = { version: task.version, decision, confirmedBy: payload.confirmedBy || "workspace_user", confirmedAt: new Date().toISOString(), note: payload.note || "", pixelAndSemanticReviewed: true };
    task.visualWorkflowState = decision === "approved" ? "delivery_ready" : "needs_review";
    task.delivery = null;
    task.updatedAt = new Date().toISOString();
    await writeStore(store);
    return sendJson(res, 201, task.visualQualityConfirmation);
  }

  const deliverMatch = path.match(/^\/content-tasks\/([^/]+)\/deliver$/);
  if (req.method === "POST" && deliverMatch) {
    const task = store.contentTasks.find((item) => item.id === deliverMatch[1]);
    if (!task) return sendJson(res, 404, { error: "Content task not found" });
    if (task.status === "blocked") return sendJson(res, 409, { error: "ContentMaster 缺少可发布证据，当前内容包已阻断导出，请先完成事实复核" });
    try {
      const zip = await createDeliveryZip(task, { root });
      task.updatedAt = new Date().toISOString();
      await writeStore(store);
      task.delivery.status = "ready";
      task.visualWorkflowState = task.platform === "xiaohongshu" ? "delivery_ready" : task.visualWorkflowState;
      await writeStore(store);
      return sendJson(res, 201, { contentTaskId: task.id, version: task.version, status: task.delivery.status, delivery: task.delivery, downloadUrl: `/api/v1/content-tasks/${task.id}/download`, retryUrl: `/api/v1/content-tasks/${task.id}/deliver`, fileName: zip.fileName, bytes: zip.bytes, sha256: zip.sha256 });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: `交付包生成失败：${error.message}`, code: error.code || "DELIVERY_PACKAGE_FAILED", retryable: true, retryUrl: `/api/v1/content-tasks/${task.id}/deliver` });
    }
  }

  const downloadMatch = path.match(/^\/content-tasks\/([^/]+)\/download$/);
  if (req.method === "GET" && downloadMatch) {
    const task = store.contentTasks.find((item) => item.id === downloadMatch[1]);
    const retryUrl = `/api/v1/content-tasks/${downloadMatch[1]}/deliver`;
    if (!task?.delivery?.zipPath || task.delivery.zipVersion !== task.version) return sendJson(res, 404, { error: "当前版本的下载包尚未生成", code: "DELIVERY_PACKAGE_NOT_READY", retryable: true, retryUrl });
    const file = join(root, task.delivery.zipPath);
    const info = await stat(file).catch(() => null);
    if (!file.startsWith(join(root, "artifacts")) || !info?.isFile()) return sendJson(res, 404, { error: "下载包文件不存在，请重新生成", code: "DELIVERY_FILE_MISSING", retryable: true, retryUrl });
    res.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="FlowSocial_${task.platform}_${task.id}_v${task.version}.zip"`, "Content-Length": info.size, "Cache-Control": "no-store" });
    return createReadStream(file).pipe(res);
  }

  const restoreMatch = path.match(/^\/content-tasks\/([^/]+)\/restore$/);
  if (req.method === "POST" && restoreMatch) {
    const payload = await bodyJson(req);
    const task = store.contentTasks.find((item) => item.id === restoreMatch[1]);
    if (!task) return sendJson(res, 404, { error: "Content task not found" });
    if (Number(payload.baseVersion) !== Number(task.version)) return sendJson(res, 409, { error: `Version conflict: current version is ${task.version}` });
    const sourceVersion = (store.contentVersions || []).find((item) => item.contentTaskId === task.id && Number(item.version) === Number(payload.version));
    if (!sourceVersion) return sendJson(res, 404, { error: "Version not found" });
    const parentVersion = task.version;
    const nextVersion = parentVersion + 1;
    task.currentContent = structuredClone(sourceVersion.content);
    if (sourceVersion.contentMaster) task.contentMaster = structuredClone(sourceVersion.contentMaster);
    task.qualityReview = structuredClone(sourceVersion.qualityReview || task.qualityReview);
    task.version = nextVersion;
    task.status = task.qualityReview?.status === "passed" ? "succeeded" : "needs_review";
    task.delivery = null;
    task.assetSummary = null;
    const restoredAssets = (task.generatedAssets || []).filter((item) => item.version === sourceVersion.version && item.status === "succeeded").map((item) => ({ ...item, id: id("asset"), version: nextVersion, reusedFromVersion: sourceVersion.version }));
    task.generatedAssets = [...(task.generatedAssets || []), ...restoredAssets];
    task.updatedAt = new Date().toISOString();
    const restored = { id: id("version"), contentTaskId: task.id, version: nextVersion, parentVersion, restoredFromVersion: sourceVersion.version, content: structuredClone(task.currentContent), contentMaster: structuredClone(task.contentMaster), qualityReview: structuredClone(task.qualityReview), patch: { status: "success", requestClass: "restore", executionMode: "version_restore", targetPaths: ["/"], lockedPaths: [] }, createdAt: task.updatedAt };
    store.contentVersions.push(restored);
    await writeStore(store);
    return sendJson(res, 201, { contentTaskId: task.id, version: nextVersion, restoredFromVersion: sourceVersion.version, currentContent: task.currentContent, contentMaster: task.contentMaster, qualityReview: task.qualityReview, platform: task.platform });
  }

  if (req.method === "POST" && path === "/knowledge/entities") {
    const payload = await bodyJson(req);
    const entity = { id: id("entity"), tags: [], assetCount: 0, ...payload };
    store.knowledgeEntities.push(entity);
    await writeStore(store);
    return sendJson(res, 201, entity);
  }

  const knowledgeMatch = path.match(/^\/knowledge\/entities\/([^/]+)$/);
  if (req.method === "PATCH" && knowledgeMatch) {
    const index = store.knowledgeEntities.findIndex((item) => item.id === knowledgeMatch[1]);
    if (index < 0) return sendJson(res, 404, { error: "Knowledge entity not found" });
    store.knowledgeEntities[index] = { ...store.knowledgeEntities[index], ...(await bodyJson(req)), updatedAt: new Date().toISOString() };
    await writeStore(store);
    return sendJson(res, 200, store.knowledgeEntities[index]);
  }

  const sourceMatch = path.match(/^\/source-configs\/([^/]+)$/);
  if (req.method === "PATCH" && sourceMatch) {
    const index = store.sourceConfigs.findIndex((item) => item.id === sourceMatch[1]);
    if (index < 0) return sendJson(res, 404, { error: "Source config not found" });
    store.sourceConfigs[index] = { ...store.sourceConfigs[index], ...(await bodyJson(req)), updatedAt: new Date().toISOString() };
    await writeStore(store);
    return sendJson(res, 200, store.sourceConfigs[index]);
  }

  return sendJson(res, 404, { error: `Unknown API route: ${req.method} ${path}` });
}

export const server = http.createServer(async (req, res) => {
  const requestId = id("req");
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/v1/")) {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
        mutationQueue = mutationQueue.catch(() => undefined).then(() => api(req, res, url));
        await mutationQueue;
      } else {
        await api(req, res, url);
      }
    }
    else await servePublicStaticAsset({ req, res, root, sendJson });
  } catch (error) {
    const path = req.url || "/";
    recordApiError({ requestId, method: req.method || "UNKNOWN", path, message: error.message || "Internal error" });
    console.error(`[${requestId}] ${req.method} ${path}:`, error);
    if (!res.headersSent) sendJson(res, 500, { error: error.message || "Internal error", requestId });
    else res.end();
  }
});

let mutationQueue = Promise.resolve();

if (process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN !== "1") {
  server.listen(port, "127.0.0.1", () => {
    const activePort=server.address()?.port||port;
    console.log(`FlowSocial Agent Demo: http://127.0.0.1:${activePort}`);
    console.log(`API health: http://127.0.0.1:${activePort}/api/v1/health`);
  });
}
