const adapters = [
  { capability: "build-content-master", executionClass: "provider_text", phase: "S2A", stage: "content_master", inputContract: "SelectedPlatformTopicIntentEvidenceAndKnowledge", outputContract: "ContentMaster@2.0", failurePolicy: "block", humanConfirmation: false },
  { capability: "generate-content-outline", executionClass: "provider_text", phase: "S2B", stage: "outline", inputContract: "DirectionCardContentTaskBriefContentSourcePlanAndContentMaster", outputContract: "ContentOutline@1.0", failurePolicy: "review", humanConfirmation: true },
  { capability: "write-xhs-content", executionClass: "provider_text", phase: "S2B", stage: "platform_writer", platforms: ["xiaohongshu"], inputContract: "XhsPlatformTopicIntentContentMasterAndConfirmedOutline", outputContract: "XhsPostPackage@2.0", failurePolicy: "block", humanConfirmation: false },
  { capability: "write-xhs-post-copy", executionClass: "provider_text", phase: "S2B", stage: "atomic_post_copy", platforms: ["xiaohongshu"], inputContract: "WriteXhsPostCopyInput@1.0", outputContract: "XhsPostCopyCreativeOutput@1.0", failurePolicy: "block", humanConfirmation: false, maxAttempts: 1, automaticRetries: 0, invocationBoundary: "explicit_atomic_component_only", productionEligibleOutput: false, automaticPromotion: false, defaultEnabled: false },
  { capability: "plan-xhs-carousel", executionClass: "provider_text", phase: "S2B", stage: "atomic_carousel_plan", platforms: ["xiaohongshu"], inputContract: "PlanXhsCarouselInput@1.0", outputContract: "XhsCarouselPlanCreativeOutput@1.0", failurePolicy: "block", humanConfirmation: false, maxAttempts: 1, automaticRetries: 0, invocationBoundary: "explicit_atomic_component_only", productionEligibleOutput: false, automaticPromotion: false, defaultEnabled: false },
  { capability: "plan-xhs-visual-assets", executionClass: "deterministic", phase: "S3", stage: "integrated_page_compatibility_handoff", platforms: ["xiaohongshu"], inputContract: "PlanXhsVisualAssetsInput@1.0", outputContract: "XhsVisualAssetPlanCreativeOutput@1.0", failurePolicy: "block", humanConfirmation: false, maxAttempts: 1, automaticRetries: 0, invocationBoundary: "integrated_page_compatibility_handoff", productionEligibleOutput: false, automaticPromotion: false, defaultEnabled: false },
  { capability: "design-xhs-integrated-pages", executionClass: "deterministic", phase: "S3", stage: "visual_design", platforms: ["xiaohongshu"], inputContract: "DesignXhsIntegratedPagesRuntimeInput@1.0", outputContract: "XhsIntegratedPagePromptSet@1.0|IntegratedPageExecutionPlan@1.0", failurePolicy: "block", humanConfirmation: true, invocationBoundary: "explicit_visual_design_flag", productionEligibleOutput: false, nextGate: "HumanProviderExecutionApproval", defaultEnabled: false },
  { capability: "write-wechat-article", executionClass: "provider_text", phase: "S2B", stage: "platform_writer", platforms: ["wechat"], inputContract: "WechatPlatformTopicIntentContentMasterAndConfirmedOutline", outputContract: "WechatArticle@2.0", failurePolicy: "block", humanConfirmation: false },
  { capability: "generate-platform-titles", executionClass: "provider_text", phase: "S2B", stage: "title", platforms: ["xiaohongshu", "wechat"], inputContract: "CompletedContentContentMasterPreliminaryTitlesAndOptionalSameAccountSignals", outputContract: "PlatformTitleList@1.0", failurePolicy: "review", humanConfirmation: false },
  { capability: "review-xhs-visuals", executionClass: "provider_text", phase: "S4", stage: "post_render_review", platforms: ["xiaohongshu"], inputContract: "RenderedXhsPagesAndContentContracts", outputContract: "XhsVisualReview@1.0", failurePolicy: "review", humanConfirmation: true },
  { capability: "review-wechat-article", executionClass: "provider_text", phase: "S2B", stage: "quality_review", platforms: ["wechat"], inputContract: "CompletedWechatArticleAndContentContracts", outputContract: "WechatArticleReview@1.0", failurePolicy: "review", humanConfirmation: false },
  { capability: "plan-wechat-images", executionClass: "provider_text", phase: "S2B", stage: "image_plan", platforms: ["wechat"], inputContract: "ApprovedWechatArticleAndContentMaster", outputContract: "WechatImagePlan@1.0", failurePolicy: "keep_text_only", humanConfirmation: false },
  { capability: "naturalize-copy", executionClass: "provider_text", phase: "S2B", stage: "optional_revision", platforms: ["xiaohongshu", "wechat"], inputContract: "AuthorizedCopyRangesOrAuditRequest", outputContract: "NaturalizationResult@1.0", failurePolicy: "keep_original", humanConfirmation: true },
  { capability: "revise-content-package", executionClass: "provider_text", phase: "S5", stage: "revision", platforms: ["xiaohongshu", "wechat"], inputContract: "CurrentPackageVersionUserInstructionIntentAndMaster", outputContract: "ContentPackagePatch@1.0", failurePolicy: "keep_current_version", humanConfirmation: true },
  { capability: "analyze-viral-content", executionClass: "provider_text", phase: "S1", stage: "source_analysis", inputContract: "ReferencePostOrComparableReferenceBatch", outputContract: "ViralContentAnalysis@1.0", failurePolicy: "review_fallback", humanConfirmation: true, invocationBoundary: "raw_reference_selected", productionEligibleOutput: false, nextGate: "HumanPatternReview" },
  { capability: "viral-content-remixer", executionClass: "provider_text", phase: "S1", stage: "source_blueprint", platforms: ["xiaohongshu", "wechat"], inputContract: "ReferencePostAndAuthorization", outputContract: "OriginalContentBlueprint", failurePolicy: "remove_source", humanConfirmation: false, invocationBoundary: "compatibility_only_explicit_authorization", productionEligibleOutput: false, defaultEnabled: false }
];

export function listSkillAdapters() {
  return structuredClone(adapters);
}

export function resolveSkillAdapter(capability, platform) {
  const adapter = adapters.find((item) => item.capability === capability);
  if (!adapter) return null;
  if (adapter.platforms && platform && !adapter.platforms.includes(platform)) return null;
  return structuredClone(adapter);
}

export function buildExecutionRecord({ capability, platform, trace = null, status = "completed", inputVersion = null, outputVersion = null }) {
  const adapter = resolveSkillAdapter(capability, platform);
  if (!adapter) throw new Error(`Unknown or unsupported skill capability: ${capability}`);
  return {
    capability,
    executionClass: adapter.executionClass,
    phase: adapter.phase,
    stage: adapter.stage,
    platform: platform || null,
    status,
    inputContract: inputVersion || adapter.inputContract,
    outputContract: outputVersion || adapter.outputContract,
    failurePolicy: adapter.failurePolicy,
    humanConfirmation: adapter.humanConfirmation,
    invocationBoundary: adapter.invocationBoundary || "orchestrator_planned",
    productionEligibleOutput: adapter.productionEligibleOutput !== false,
    nextGate: adapter.nextGate || null,
    maxAttempts: adapter.maxAttempts || null,
    automaticRetries: adapter.automaticRetries ?? null,
    automaticPromotion: adapter.automaticPromotion === true,
    traceId: trace?.id || trace?.traceId || null,
    executedAt: new Date().toISOString()
  };
}
