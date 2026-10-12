const enabled = (name, fallback = true) => {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return !["0", "false", "off", "disabled"].includes(String(value).toLowerCase());
};

export function featureFlags() {
  return {
    llmGatewayV2: enabled("LLM_GATEWAY_V2"),
    diagnosticExtractionV2: enabled("DIAGNOSTIC_EXTRACTION_V2"),
    fieldCoachV2: enabled("FIELD_COACH_V2"),
    diagnosticStateV2: enabled("DIAGNOSTIC_STATE_V2"),
    recommendationActionsV2: enabled("RECOMMENDATION_ACTIONS_V2"),
    postCompletionDialogueV2: enabled("POST_COMPLETION_DIALOGUE_V2"),
    diagnosticKnowledgeLinkV1: enabled("DIAGNOSTIC_KNOWLEDGE_LINK_V1"),
    strategyDraftRevisionV1: enabled("STRATEGY_DRAFT_REVISION_V1"),
    strategyDocumentV2: enabled("STRATEGY_DOCUMENT_V2"),
    exactDraftActivationV2: enabled("EXACT_DRAFT_ACTIVATION_V2"),
    contentExecutionContextV1: enabled("CONTENT_EXECUTION_CONTEXT_V1"),
    viralLearningV1: enabled("VIRAL_LEARNING_V1", false),
    matrixCollaborationV1: enabled("MATRIX_COLLABORATION_V1", false),
    strategyFeedbackV1: enabled("STRATEGY_FEEDBACK_V1", false),
    dataDrivenNextCycleV1: enabled("DATA_DRIVEN_NEXT_CYCLE_V1", true),
    platformPublishingV1: enabled("PLATFORM_PUBLISHING_V1", false),
    contentPromotionV1: enabled("CONTENT_PROMOTION_V1", false),
    // Local immutable versions and packages are independent from the retired
    // legacy promotion switch. Opening a legacy external-effect route must not
    // silently broaden the current local product chain.
    localContentPromotionV1: enabled("LOCAL_CONTENT_PROMOTION_V1", false),
    localPackageDeliveryV1: enabled("LOCAL_PACKAGE_DELIVERY_V1", false),
    unifiedContentProductionV1: enabled("UNIFIED_CONTENT_PRODUCTION_V1", false),
    unifiedContentPrerequisitesV1: enabled("UNIFIED_CONTENT_PREREQUISITES_V1", false),
    unifiedContentArtifactsV1: enabled("UNIFIED_CONTENT_ARTIFACTS_V1", false),
    unifiedContentXhsAtomicGraphV1: enabled("UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1", false),
    unifiedContentAtomicProductV1: enabled("UNIFIED_CONTENT_ATOMIC_PRODUCT_V1", false),
    unifiedContentAtomicWechatProductV1: enabled("UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1", false),
    unifiedContentStagedAtomicDualBootstrapV1: enabled("UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1", false),
    unifiedContentAtomicWechatArtifactV1: enabled("UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1", false),
    unifiedContentAtomicWechatHumanSelectionV1: enabled("UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1", false),
    unifiedContentAtomicWechatPromotionUploadDeliveryV1: enabled("UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1", false),
    atomicWechatDraftCreationV1: enabled("ATOMIC_WECHAT_DRAFT_CREATION_V1", false),
    atomicManualPublicationV1: enabled("ATOMIC_MANUAL_PUBLICATION_V1", false),
    atomicExactFeedbackV1: enabled("ATOMIC_EXACT_FEEDBACK_V1", false),
    atomicPublicationLifecycleV1: enabled("ATOMIC_PUBLICATION_LIFECYCLE_V1", false),
    atomicPublicationFeedbackUiCutoverV1: enabled("ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1", false),
    unifiedContentXhsProviderAuthorityV1: enabled("UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1", false),
    unifiedContentXhsProviderPlanV1: enabled("UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1", false),
    unifiedContentXhsProviderExecutionApprovalV1: enabled("UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_APPROVAL_V1", false),
    unifiedContentXhsProviderExecutionV1: enabled("UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1", false),
    unifiedContentXhsVisualReviewApprovalV1: enabled("UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1", false),
    unifiedContentXhsVisualReviewV1: enabled("UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1", false),
    unifiedContentXhsLightRevisionV1: enabled("UNIFIED_CONTENT_XHS_LIGHT_REVISION_V1", false),
    unifiedContentXhsHumanVisualConfirmationV1: enabled("UNIFIED_CONTENT_XHS_HUMAN_VISUAL_CONFIRMATION_V1", false),
    skillAutoPromotionV1: enabled("SKILL_AUTO_PROMOTION_V1", false),
    xhsIntegratedPageDesignSkill: enabled("XHS_INTEGRATED_PAGE_DESIGN_SKILL", false),
    xhsIntegratedPageDirectionReview: enabled("XHS_INTEGRATED_PAGE_DIRECTION_REVIEW", false),
    xhsIntegratedPageProviderCompiler: enabled("XHS_INTEGRATED_PAGE_PROVIDER_COMPILER", false),
    xhsVisualAssetRegistry: enabled("XHS_VISUAL_ASSET_REGISTRY", false),
    xhsDeterministicVisualQualityGate: enabled("XHS_DETERMINISTIC_VISUAL_QUALITY_GATE", false),
    xhsIntegratedPageOfflinePipeline: enabled("XHS_INTEGRATED_PAGE_OFFLINE_PIPELINE", false),
    xhsIntegratedPageOcrGate: enabled("XHS_INTEGRATED_PAGE_OCR_GATE", false),
    xhsIntegratedPageVersioning: enabled("XHS_INTEGRATED_PAGE_VERSIONING", false),
    xhsIntegratedPageOfflineReview: enabled("XHS_INTEGRATED_PAGE_OFFLINE_REVIEW", false),
    xhsIntegratedPageOfflineDelivery: enabled("XHS_INTEGRATED_PAGE_OFFLINE_DELIVERY", false),
    xhsIntegratedPageSkillExecutionPlan: enabled("XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN", false),
    xhsIntegratedPageDirectDelivery: enabled("XHS_INTEGRATED_PAGE_DIRECT_DELIVERY", false),
    wechatBodyFirstRecoveryV1: enabled("WECHAT_BODY_FIRST_RECOVERY_V1", false)
  };
}

// Entry cutover is intentionally fail-closed: unified is the default only when
// every staged prerequisite flag is enabled. The legacy token is still parsed
// so the authority layer can return the stable 410 retirement contract.
export function resolveContentEntryMode(requestedMode, flags = featureFlags()) {
  const mode = requestedMode == null || requestedMode === "" ? "unified" : String(requestedMode).toLowerCase();
  if (mode === "legacy") return "legacy";
  if (mode !== "unified") return null;
  return flags.unifiedContentPrerequisitesV1 === true
    && flags.unifiedContentStagedAtomicDualBootstrapV1 === true
    ? "unified" : null;
}
