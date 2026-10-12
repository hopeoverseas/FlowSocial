import { resolveSkillAdapter } from "./skill-adapter-registry.mjs";
import { buildContentSourceTrace } from "./source-planner.mjs";

const SUPPORTED_PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const XHS_GRAPH_MODES = Object.freeze({ monolithic: "monolithic_v2", atomic: "atomic_v4" });
const XHS_ATOMIC_CAPABILITIES = Object.freeze(["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"]);
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

function skillStep(id, capability, platform, { required = true, enabled = true, reason = null, dependsOn = [], invocationMode = null, state = null, decision = null, result = null, reviewGate = null } = {}) {
  const adapter = resolveSkillAdapter(capability, platform);
  if (!adapter) throw new Error(`No Skill adapter for ${capability} on ${platform}`);
  return {
    id,
    kind: "skill",
    capability,
    executionClass: adapter.executionClass,
    phase: adapter.phase,
    stage: adapter.stage,
    platform,
    required,
    enabled,
    state: state || (enabled ? "planned" : "waiting_condition"),
    decision: decision || (enabled ? "enabled" : "skipped"),
    result,
    reviewGate,
    reason,
    dependsOn,
    invocationMode,
    inputContract: adapter.inputContract,
    outputContract: adapter.outputContract,
    failurePolicy: adapter.failurePolicy,
    humanConfirmation: adapter.humanConfirmation,
    invocationBoundary: adapter.invocationBoundary || "orchestrator_planned",
    productionEligibleOutput: adapter.productionEligibleOutput !== false,
    nextGate: adapter.nextGate || null,
    retry: adapter.maxAttempts == null && adapter.automaticRetries == null
      ? { maxAttempts: adapter.failurePolicy === "block" ? 2 : 1 }
      : { maxAttempts: adapter.maxAttempts || 1, automaticRetries: adapter.automaticRetries || 0 }
  };
}

function serviceStep(id, service, { required = true, enabled = true, reason = null, dependsOn = [], humanConfirmation = false, state = null, decision = null, executionClass = null, phase = "S2B" } = {}) {
  return { id, kind: "service", service, executionClass: executionClass || (humanConfirmation ? "human_gate" : "service"), phase, required, enabled, state: state || (enabled ? "planned" : "waiting_condition"), decision: decision || (enabled ? "enabled" : "skipped"), reason, dependsOn, humanConfirmation };
}

function deterministicStep(id, service, { phase, dependsOn, inputContract, outputContract }) {
  return {
    id, kind: "service", service, executionClass: "deterministic", phase, required: true,
    enabled: true, state: "planned", decision: "enabled", reason: null, dependsOn,
    humanConfirmation: false, inputContract, outputContract,
    retry: { maxAttempts: 1, automaticRetries: 0 }, fallbackPolicy: "forbidden"
  };
}

function atomicSkillStep(id, capability, platform, options) {
  return { ...skillStep(id, capability, platform, options), fallbackPolicy: "forbidden" };
}

function atomicGraphRequested(platform, serverFeatureFlags) {
  return platform === "xiaohongshu" && serverFeatureFlags?.unifiedContentXhsAtomicGraphV1 === true;
}

function assertAtomicNaturalizationMode(options) {
  const requested = Boolean(options.naturalizationMode || options.enableNaturalization);
  const mode = options.naturalizationMode || "audit_only";
  if (requested && mode !== "audit_only") {
    throw Object.assign(new Error("XHS atomic graph only supports audit-only naturalization"), {
      code: "XHS_ATOMIC_NATURALIZATION_REWRITE_FORBIDDEN",
      statusCode: 409,
      details: { fieldPaths: ["options.naturalizationMode"] }
    });
  }
  return { requested, mode: "audit_only" };
}

function assertExclusiveXhsAuthorityFamily(plan) {
  if (plan.platform !== "xiaohongshu") return plan;
  const capabilities = plan.steps.filter((step) => step.kind === "skill").map((step) => step.capability);
  const monolithicCount = capabilities.filter((capability) => capability === "write-xhs-content").length;
  const atomicCounts = XHS_ATOMIC_CAPABILITIES.map((capability) => capabilities.filter((candidate) => candidate === capability).length);
  const mode = resolveSkillExecutionPlanGraphMode(plan);
  const valid = mode === XHS_GRAPH_MODES.atomic
    ? monolithicCount === 0 && atomicCounts.every((count) => count === 1)
    : monolithicCount === 1 && atomicCounts.every((count) => count === 0);
  if (!valid) throw Object.assign(new Error("XHS execution plan mixes authority families"), { code: "XHS_GRAPH_AUTHORITY_FAMILY_MIXED", statusCode: 409 });
  return plan;
}

function sourceTypes(sourcePlan) {
  return new Set(list(sourcePlan?.sources).map((source) => source.type));
}

export function buildSkillExecutionPlan({ platform, sourcePlan = null, contentExecutionContext = null, options = {}, serverFeatureFlags = null, createdAt = new Date().toISOString() }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) throw new Error(`Unsupported content platform: ${platform}`);
  const resolvedSourcePlan = sourcePlan || contentExecutionContext?.sourcePlan || { sources: [] };
  const types = sourceTypes(resolvedSourcePlan);
  const sourceTrace = buildContentSourceTrace(resolvedSourcePlan);
  const referenceDecision = sourceTrace.decisions.find((item) => item.type === "reference_post");
  const needsRawReferenceAnalysis = options.requiresReferenceAnalysis === true || referenceDecision?.used === true || types.has("reference_post") || types.has("viral_reference");
  const referenceAnalysis = options.referenceAnalysis || resolvedSourcePlan.referenceAnalysis || {};
  const analysisStatus = needsRawReferenceAnalysis ? (referenceAnalysis.status || "pending") : "skipped";
  const reviewStatus = needsRawReferenceAnalysis ? (referenceAnalysis.reviewStatus || "pending") : "not_required";
  const approvedPatternSnapshotId = referenceAnalysis.contentPatternSnapshotId || options.contentPatternSnapshotId || null;
  const naturalizationRequested = Boolean(options.naturalizationMode || options.enableNaturalization);
  const renderedPageRevisionRefs = list(options.renderedPageRevisionRefs);
  const hasRenderedPageRevisions = renderedPageRevisionRefs.length > 0;
  const visualDesignRequested = platform === "xiaohongshu" && options.enableXhsIntegratedPageDesign === true;
  const visualDesignFlagEnabled = options.featureFlags?.xhsIntegratedPageDesignSkill === true;
  const visualDesignAuthorized = visualDesignRequested && visualDesignFlagEnabled;
  const visualDesignBindingsReady = options.xhsDesignBindingsReady === true;
  const visualDesignEnabled = visualDesignAuthorized && visualDesignBindingsReady;
  const revisionRequested = options.revisionRequested === true;
  const atomicGraph = atomicGraphRequested(platform, serverFeatureFlags);
  const atomicNaturalization = atomicGraph ? assertAtomicNaturalizationMode(options) : null;
  const steps = [];

  steps.push(skillStep("source_analysis", "analyze-viral-content", platform, {
    required: false,
    enabled: needsRawReferenceAnalysis,
    reason: needsRawReferenceAnalysis ? "raw_reference_requires_analysis" : "no_raw_reference",
    invocationMode: "reference_analysis",
    state: needsRawReferenceAnalysis ? (analysisStatus === "completed" ? "completed" : analysisStatus === "failed" ? "needs_review" : "planned") : "skipped",
    decision: needsRawReferenceAnalysis ? "enabled" : "skipped",
    result: { status: analysisStatus, analysisId: referenceAnalysis.analysisId || null, error: referenceAnalysis.error || null },
    reviewGate: { required: needsRawReferenceAnalysis, status: reviewStatus, contentPatternSnapshotId: approvedPatternSnapshotId }
  }));
  steps.push(serviceStep("pattern_review", "HumanPatternReview", {
    required: false,
    enabled: needsRawReferenceAnalysis,
    reason: needsRawReferenceAnalysis ? "analysis_requires_human_review" : "no_reference_analysis",
    dependsOn: ["source_analysis"],
    humanConfirmation: true,
    state: needsRawReferenceAnalysis ? (reviewStatus === "approved" ? "completed" : reviewStatus === "rejected" ? "blocked" : "needs_review") : "skipped",
    decision: needsRawReferenceAnalysis ? "required" : "skipped",
    phase: "S1"
  }));
  steps.push(skillStep("content_master", "build-content-master", platform, {
    dependsOn: needsRawReferenceAnalysis ? ["pattern_review"] : [],
    state: needsRawReferenceAnalysis && reviewStatus !== "approved" ? "waiting_condition" : "planned",
    reason: needsRawReferenceAnalysis && reviewStatus !== "approved" ? "awaiting_approved_pattern_snapshot" : null
  }));
  steps.push(skillStep("outline", "generate-content-outline", platform, { dependsOn: ["content_master"] }));
  steps.push(serviceStep("outline_confirmation", "UserOutlineConfirmation", { dependsOn: ["outline"], humanConfirmation: true }));
  if (atomicGraph) {
    steps.push(atomicSkillStep("xhs_post_copy", "write-xhs-post-copy", platform, { dependsOn: ["outline_confirmation"] }));
    steps.push(skillStep("naturalization", "naturalize-copy", platform, {
      required: false,
      enabled: atomicNaturalization.requested,
      reason: atomicNaturalization.requested ? "audit_requested" : "not_requested",
      state: atomicNaturalization.requested ? "planned" : "skipped",
      decision: atomicNaturalization.requested ? "enabled" : "skipped",
      dependsOn: ["xhs_post_copy"],
      invocationMode: "audit_only"
    }));
    steps.push(skillStep("title", "generate-platform-titles", platform, {
      dependsOn: [atomicNaturalization.requested ? "naturalization" : "xhs_post_copy"]
    }));
    steps.push(serviceStep("title_consistency", "TitleContentConsistencyGate", { dependsOn: ["title"] }));
    steps.push(deterministicStep("xhs_final_title_binding", "XhsFinalTitleBindingService", { phase: "S2B", dependsOn: ["title_consistency"], inputContract: "XhsFinalTitleBindingInput@1.0", outputContract: "XhsFinalTitleBinding@1.0" }));
    steps.push(atomicSkillStep("xhs_carousel", "plan-xhs-carousel", platform, { dependsOn: ["xhs_final_title_binding"] }));
    steps.push(atomicSkillStep("xhs_visual_assets", "plan-xhs-visual-assets", platform, { dependsOn: ["xhs_carousel"] }));
    steps.push(deterministicStep("xhs_traceability", "XhsTraceabilityCompiler", { phase: "S3", dependsOn: ["xhs_visual_assets"], inputContract: "XhsTraceabilityAssemblyInput@2.0", outputContract: "XhsTraceability@2.0" }));
    steps.push(deterministicStep("xhs_preflight", "XhsContentPreflightGate", { phase: "S3", dependsOn: ["xhs_traceability"], inputContract: "XhsContentPreflightAssemblyInput@2.0", outputContract: "XhsContentPreflightReport@2.0" }));
    steps.push(deterministicStep("xhs_package", "XhsPostPackageV4Assembler", { phase: "S3", dependsOn: ["xhs_preflight"], inputContract: "XhsPostPackageAssemblyInput@4.0", outputContract: "XhsPostPackage@4.0" }));
    steps.push(serviceStep("schema_and_reference", "SchemaAndReferenceGate", { dependsOn: ["xhs_package"] }));
  } else {
    steps.push(skillStep("platform_writer", platform === "xiaohongshu" ? "write-xhs-content" : "write-wechat-article", platform, { dependsOn: ["outline_confirmation"] }));

    if (platform === "wechat") {
      steps.push(skillStep("wechat_content_review", "review-wechat-article", platform, { dependsOn: ["platform_writer"], invocationMode: "content_review" }));
    }
    const naturalizeAfter = platform === "wechat" ? "wechat_content_review" : "platform_writer";
    steps.push(skillStep("naturalization", "naturalize-copy", platform, {
      required: false,
      enabled: naturalizationRequested,
      reason: naturalizationRequested ? "requested" : "not_requested",
      state: naturalizationRequested ? "planned" : "skipped",
      decision: naturalizationRequested ? "enabled" : "skipped",
      dependsOn: [naturalizeAfter],
      invocationMode: options.naturalizationMode || "audit_only"
    }));
    steps.push(skillStep("title", "generate-platform-titles", platform, {
      dependsOn: [naturalizationRequested ? "naturalization" : naturalizeAfter]
    }));
    steps.push(serviceStep("title_consistency", "TitleContentConsistencyGate", { dependsOn: ["title"] }));
    steps.push(serviceStep("schema_and_reference", "SchemaAndReferenceGate", { dependsOn: ["title_consistency"] }));
  }

  if (platform === "xiaohongshu") {
    steps.push(skillStep("visual_design", "design-xhs-integrated-pages", platform, {
      required: false,
      enabled: visualDesignEnabled,
      reason: visualDesignEnabled ? "candidate_bindings_ready" : visualDesignAuthorized ? "awaiting_master_run_candidate_and_visual_selection_bindings" : visualDesignRequested ? "feature_flag_disabled" : "visual_design_not_requested",
      state: visualDesignEnabled ? "planned" : visualDesignAuthorized || visualDesignRequested ? "waiting_condition" : "skipped",
      decision: visualDesignEnabled ? "enabled" : visualDesignAuthorized ? "authorized" : "skipped",
      dependsOn: ["schema_and_reference"],
      invocationMode: "deterministic_adapter"
    }));
    steps.push(serviceStep("visual_provider_approval", "HumanProviderExecutionApproval", {
      required: false,
      enabled: false,
      reason: visualDesignAuthorized ? "awaiting_deterministic_design_evidence" : "visual_design_not_requested",
      state: visualDesignAuthorized ? "waiting_condition" : "skipped",
      decision: visualDesignAuthorized ? "waiting" : "skipped",
      dependsOn: ["visual_design"],
      humanConfirmation: true,
      phase: "S3"
    }));
    steps.push(serviceStep("image_provider", "XhsIntegratedPageImageProvider", {
      required: false,
      enabled: false,
      reason: visualDesignAuthorized ? "awaiting_human_provider_execution_approval" : "visual_design_not_requested",
      state: visualDesignAuthorized ? "waiting_condition" : "skipped",
      decision: visualDesignAuthorized ? "waiting" : "skipped",
      dependsOn: ["visual_provider_approval"],
      executionClass: "provider_image",
      phase: "S3"
    }));
    steps.push(serviceStep("render", "XhsHtmlRenderer", {
      enabled: false,
      reason: visualDesignAuthorized ? "awaiting_provider_image_outputs" : "visual_design_not_requested",
      state: visualDesignAuthorized ? "waiting_condition" : "skipped",
      decision: visualDesignAuthorized ? "waiting" : "skipped",
      dependsOn: ["image_provider"],
      phase: "S3"
    }));
    steps.push(skillStep("visual_review", "review-xhs-visuals", platform, {
      required: true,
      enabled: hasRenderedPageRevisions,
      reason: hasRenderedPageRevisions ? "rendered_page_revisions_ready" : "awaiting_rendered_page_revisions",
      state: hasRenderedPageRevisions ? "planned" : "waiting_condition",
      decision: hasRenderedPageRevisions ? "enabled" : "waiting",
      dependsOn: ["render"]
    }));
    steps.push(serviceStep("visual_selection", "UserVisualSelection", {
      enabled: false,
      reason: visualDesignAuthorized ? "awaiting_visual_review_and_page_revisions" : "visual_design_not_requested",
      state: visualDesignAuthorized ? "waiting_condition" : "skipped",
      decision: visualDesignAuthorized ? "waiting" : "skipped",
      dependsOn: ["visual_review"],
      humanConfirmation: true,
      phase: "S4"
    }));
  } else {
    steps.push(skillStep("image_plan", "plan-wechat-images", platform, { required: false, dependsOn: ["schema_and_reference"] }));
    steps.push(serviceStep("format", "WechatHtmlFormatter", { dependsOn: ["image_plan"] }));
    steps.push(serviceStep("format_validation", "WechatHtmlValidator", { dependsOn: ["format"] }));
  }

  steps.push(skillStep("revision", "revise-content-package", platform, {
    required: false,
    enabled: revisionRequested,
    reason: revisionRequested ? "user_revision_requested" : "no_revision_requested",
    state: revisionRequested ? "planned" : "skipped",
    decision: revisionRequested ? "enabled" : "skipped",
    dependsOn: [platform === "xiaohongshu" ? "visual_review" : "format_validation"]
  }));

  const plan = {
    schemaVersion: "1.2",
    kind: "SkillExecutionPlan",
    platform,
    sourceMode: resolvedSourcePlan?.mode || null,
    contextId: contentExecutionContext?.id || null,
    policy: {
      orchestratorOwnsWorkflow: true,
      immutableInputs: true,
      implicitHotspotSearch: false,
      approvedBlueprintOnly: true,
      rawReferencesAreProductionEvidence: false,
      viralLearningV1: false,
      automaticSkillPromotion: false,
      userConfirmationRequiredForOutline: true,
      optionalSkillFailureMayDegrade: true,
      xhsIntegratedPageDesignSkillDefaultEnabled: false,
      automaticProviderExecution: false
    },
    sourceTrace,
    referenceAnalysisTrace: {
      capability: "analyze-viral-content",
      decision: needsRawReferenceAnalysis ? "enabled" : "skipped",
      reason: needsRawReferenceAnalysis ? "raw_reference_selected" : "no_raw_reference_selected",
      result: { status: analysisStatus, analysisId: referenceAnalysis.analysisId || null, error: referenceAnalysis.error || null },
      humanReviewGate: { required: needsRawReferenceAnalysis, status: reviewStatus, contentPatternSnapshotId: approvedPatternSnapshotId }
    },
    steps,
    createdAt
  };
  if (atomicGraph) {
    plan.schemaVersion = "2.0";
    plan.graphMode = XHS_GRAPH_MODES.atomic;
    plan.authorityFamily = "xhs_atomic_components_v4";
    plan.policy.monolithicFallbackAuthorized = false;
    plan.policy.atomicProviderMaxAttempts = 1;
    plan.policy.atomicAutomaticRetries = 0;
  }
  return assertExclusiveXhsAuthorityFamily(plan);
}

export function buildUnifiedPlatformSkillExecutionPlan({ platform, sourcePlan = null, contentExecutionContext = null, sharedContentMasterRef, options = {}, serverFeatureFlags = null, createdAt = new Date().toISOString() }) {
  if (!sharedContentMasterRef?.id || !sharedContentMasterRef?.hash) throw new Error("sharedContentMasterRef with id and hash is required");
  const plan = buildSkillExecutionPlan({ platform, sourcePlan, contentExecutionContext, options, serverFeatureFlags, createdAt });
  const masterIndex = plan.steps.findIndex((step) => step.id === "content_master");
  if (masterIndex < 0) throw new Error(`Content master binding step is missing for ${platform}`);
  const original = plan.steps[masterIndex];
  plan.steps[masterIndex] = {
    id: "shared_content_master",
    kind: "binding",
    executionClass: "binding",
    phase: "S2A",
    service: "SharedContentMasterBinding",
    required: true,
    enabled: true,
    state: "completed",
    decision: "bound",
    reason: "shared_master_built_once_for_all_platform_runs",
    dependsOn: original.dependsOn,
    humanConfirmation: false,
    sharedContentMasterRef: structuredClone(sharedContentMasterRef)
  };
  for (const step of plan.steps) {
    step.dependsOn = list(step.dependsOn).map((dependency) => dependency === "content_master" ? "shared_content_master" : dependency);
  }
  plan.kind = "UnifiedPlatformSkillExecutionPlan";
  plan.schemaVersion = resolveSkillExecutionPlanGraphMode(plan) === XHS_GRAPH_MODES.atomic ? "2.0" : "1.1";
  plan.authorization = { mode: "strict", compatibilityAdapterRequired: true };
  plan.sharedContentMasterRef = structuredClone(sharedContentMasterRef);
  plan.createdAt = createdAt;
  return assertExclusiveXhsAuthorityFamily(plan);
}

export function resolveSkillExecutionPlanGraphMode(plan) {
  if (plan?.platform !== "xiaohongshu") return null;
  return plan.graphMode === XHS_GRAPH_MODES.atomic ? XHS_GRAPH_MODES.atomic : XHS_GRAPH_MODES.monolithic;
}

export function refreshSkillExecutionPlan(plan, conditions = {}) {
  const next = structuredClone(plan);
  if (resolveSkillExecutionPlanGraphMode(next) === XHS_GRAPH_MODES.atomic && conditions.naturalizationMode != null && conditions.naturalizationMode !== "audit_only") {
    throw Object.assign(new Error("XHS atomic graph only supports audit-only naturalization"), { code: "XHS_ATOMIC_NATURALIZATION_REWRITE_FORBIDDEN", statusCode: 409, details: { fieldPaths: ["conditions.naturalizationMode"] } });
  }
  const toggles = {
    naturalization: Object.hasOwn(conditions, "naturalizationMode") || Object.hasOwn(conditions, "enableNaturalization") ? Boolean(conditions.naturalizationMode || conditions.enableNaturalization) : undefined,
    visual_review: Object.hasOwn(conditions, "renderedPageRevisionRefs") ? list(conditions.renderedPageRevisionRefs).length > 0 : undefined,
    revision: Object.hasOwn(conditions, "revisionRequested") ? conditions.revisionRequested === true : undefined,
    visual_design: Object.hasOwn(conditions, "enableXhsIntegratedPageDesign") || Object.hasOwn(conditions, "featureFlags")
      ? conditions.enableXhsIntegratedPageDesign === true && conditions.featureFlags?.xhsIntegratedPageDesignSkill === true && conditions.xhsDesignBindingsReady === true
      : undefined
  };
  for (const step of next.steps) {
    if (!(step.id in toggles) || toggles[step.id] === undefined) continue;
    step.enabled = toggles[step.id];
    step.state = step.enabled ? "planned" : ["naturalization", "revision"].includes(step.id) ? "skipped" : "waiting_condition";
    step.decision = step.enabled ? "enabled" : ["naturalization", "revision"].includes(step.id) ? "skipped" : "waiting";
    if (step.id === "naturalization" && conditions.naturalizationMode) step.invocationMode = resolveSkillExecutionPlanGraphMode(next) === XHS_GRAPH_MODES.atomic ? "audit_only" : conditions.naturalizationMode;
    if (step.id === "visual_design") {
      const authorized = conditions.enableXhsIntegratedPageDesign === true && conditions.featureFlags?.xhsIntegratedPageDesignSkill === true;
      step.decision = step.enabled ? "enabled" : authorized ? "authorized" : "skipped";
      step.reason = step.enabled ? "candidate_bindings_ready" : authorized ? "awaiting_master_run_candidate_and_visual_selection_bindings" : conditions.enableXhsIntegratedPageDesign === true ? "feature_flag_disabled" : "visual_design_not_requested";
      if (!step.enabled && conditions.enableXhsIntegratedPageDesign !== true) step.state = "skipped";
    }
  }
  if (resolveSkillExecutionPlanGraphMode(next) === XHS_GRAPH_MODES.atomic && toggles.naturalization !== undefined) {
    const title = next.steps.find((step) => step.id === "title");
    if (title) title.dependsOn = [toggles.naturalization ? "naturalization" : "xhs_post_copy"];
  }
  if (conditions.referenceAnalysis) {
    const status = conditions.referenceAnalysis.status || "pending";
    const reviewStatus = conditions.referenceAnalysis.reviewStatus || next.referenceAnalysisTrace?.humanReviewGate?.status || "pending";
    const snapshotId = conditions.referenceAnalysis.contentPatternSnapshotId || null;
    next.referenceAnalysisTrace = {
      ...(next.referenceAnalysisTrace || {}),
      decision: "enabled",
      result: { status, analysisId: conditions.referenceAnalysis.analysisId || null, error: conditions.referenceAnalysis.error || null },
      humanReviewGate: { required: true, status: reviewStatus, contentPatternSnapshotId: snapshotId }
    };
    const analysisStep = next.steps.find((step) => step.id === "source_analysis");
    if (analysisStep) {
      analysisStep.enabled = true;
      analysisStep.decision = "enabled";
      analysisStep.state = status === "completed" ? "completed" : status === "failed" ? "needs_review" : "planned";
      analysisStep.result = next.referenceAnalysisTrace.result;
      analysisStep.reviewGate = next.referenceAnalysisTrace.humanReviewGate;
    }
    const reviewStep = next.steps.find((step) => step.id === "pattern_review");
    if (reviewStep) {
      reviewStep.enabled = true;
      reviewStep.state = reviewStatus === "approved" ? "completed" : reviewStatus === "rejected" ? "blocked" : "needs_review";
    }
    const masterStep = next.steps.find((step) => step.id === "content_master");
    if (masterStep) {
      masterStep.state = reviewStatus === "approved" ? "planned" : "waiting_condition";
      masterStep.reason = reviewStatus === "approved" ? null : "awaiting_approved_pattern_snapshot";
    }
  }
  next.updatedAt = new Date().toISOString();
  return assertExclusiveXhsAuthorityFamily(next);
}

export function buildRevisionImpactPlan({ platform, requestClass = "copy", changedPaths = [], sourceChanged = false, outlineChanged = false }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) throw new Error(`Unsupported content platform: ${platform}`);
  let rerunFrom = "revision";
  if (sourceChanged || outlineChanged || requestClass === "claim" || requestClass === "purpose_or_promotion") rerunFrom = "content_master";
  else if (list(changedPaths).some((path) => /title|recommended_title/.test(path))) rerunFrom = "title";
  else if (requestClass === "copy") rerunFrom = platform === "wechat" ? "wechat_content_review" : "title";
  else if (requestClass === "image_spec") rerunFrom = platform === "xiaohongshu" ? "visual_design" : "image_plan";
  else if (requestClass === "page_text") rerunFrom = "schema_and_reference";

  const downstream = platform === "xiaohongshu"
    ? ["content_master", "outline", "outline_confirmation", "platform_writer", "naturalization", "title", "title_consistency", "schema_and_reference", "visual_design", "render", "visual_review"]
    : ["content_master", "outline", "outline_confirmation", "platform_writer", "wechat_content_review", "naturalization", "title", "title_consistency", "schema_and_reference", "image_plan", "format", "format_validation"];
  const index = Math.max(0, downstream.indexOf(rerunFrom));
  return { schemaVersion: "1.0", service: "RevisionImpactPlanner", platform, rerunFrom, affectedSteps: downstream.slice(index), changedPaths: list(changedPaths) };
}
