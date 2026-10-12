import { createHash, randomUUID } from "node:crypto";
import { attachTaskExecutionToRun, ensureRunLedger, recordRunDecision, updateRunNode } from "./run-ledger.mjs";
import { buildSkillExecutionPlan } from "./skill-execution-plan.mjs";
import { buildContentSourceTrace } from "./source-planner.mjs";
import { hashUnifiedContent, validateContentMechanismDecision } from "./unified-content-contracts.mjs";

export const CONTENT_WORKFLOW_STATES = Object.freeze({
  DIRECTION_SELECTED: "direction_selected",
  OUTLINE_DRAFTING: "outline_drafting",
  OUTLINE_READY: "outline_ready",
  OUTLINE_CONFIRMED: "outline_confirmed",
  GENERATING: "generating",
  CONTENT_READY: "content_ready",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked"
});

function now() {
  return new Date().toISOString();
}

function event(workflow, type, detail = {}) {
  workflow.events ||= [];
  workflow.events.push({ id: `event_${randomUUID().slice(0, 8)}`, type, at: now(), ...detail });
  workflow.updatedAt = now();
  workflow.version = Number(workflow.version || 0) + 1;
}

function requireState(workflow, allowed, operation) {
  if (!allowed.includes(workflow.state)) {
    const error = new Error(`${operation} is not allowed while workflow is ${workflow.state}`);
    error.statusCode = 409;
    error.code = "INVALID_CONTENT_WORKFLOW_TRANSITION";
    throw error;
  }
}

function freezePatternSnapshot(generationPayload, sourcePlan, createdAt) {
  const supplied = generationPayload.contentPatternSnapshot;
  if (supplied?.kind === "ContentPatternSnapshot"
    && supplied.id
    && Array.isArray(supplied.blueprintVersions)
    && supplied.policy?.structureOnly === true
    && supplied.policy?.maySupplyFacts !== true
    && supplied.policy?.sourceTextIncluded !== true) {
    return structuredClone(supplied);
  }
  const approvedAssets = (sourcePlan?.sources || [])
    .filter((source) => source.type === "viral_blueprint")
    .flatMap((source) => source.assets || [])
    .filter((item) => item.productionReady === true && ["approved", "testing", "validated"].includes(item.lifecycle) && item.approvedBy && item.approvedAt);
  if (!approvedAssets.length) return null;
  return {
    kind: "ContentPatternSnapshot",
    schemaVersion: "1.0",
    id: `content_pattern_snapshot_${randomUUID().slice(0, 8)}`,
    createdAt,
    policy: { structureOnly: true, businessFactsAllowed: false, sourceTextOrImagesAllowed: false, humanReviewRequired: true },
    blueprintVersions: approvedAssets.map((item) => ({
      id: item.id,
      familyId: item.familyId || null,
      version: item.version || null,
      platform: item.platform || "unknown",
      contentArchetype: item.contentArchetype || null,
      creativeMechanism: item.creativeMechanism || null,
      applicableFunctions: structuredClone(item.applicableFunctions || []),
      titleMechanisms: structuredClone(item.titleMechanisms || []),
      openingMechanism: item.openingMechanism || "",
      structureRules: structuredClone(item.structureRules || []),
      evidenceRequirements: structuredClone(item.evidenceRequirements || []),
      visualRoles: structuredClone(item.visualRoles || []),
      platformMechanics: structuredClone(item.platformMechanics || {}),
      interactionMechanism: item.interactionMechanism || "",
      prohibitedUses: structuredClone(item.prohibitedUses || []),
      sourceReferenceIds: structuredClone(item.sourceReferenceIds || [])
    }))
  };
}

function freezeTemporaryMaterials(generationPayload, createdAt) {
  const candidates = [
    ...(Array.isArray(generationPayload.temporaryMaterials) ? generationPayload.temporaryMaterials : []),
    ...(Array.isArray(generationPayload.contentSourceEvidence?.userMaterials) ? generationPayload.contentSourceEvidence.userMaterials : [])
  ];
  const unique = new Map();
  for (const [index, item] of candidates.entries()) {
    const content = String(item?.text || item?.content || item?.description || "").trim();
    const id = item?.id || `user_material_${index + 1}`;
    if (!content && !item?.contentHash) continue;
    const visibility = item.visibility || (item.usage === "usable" || item.userConfirmed === true ? "publishable" : "run_only");
    unique.set(id, {
      id,
      type: item.type || "text",
      name: item.name || "用户临时素材",
      contentHash: item.contentHash || createHash("sha256").update(content).digest("hex"),
      visibility,
      sourceType: item.sourceType || "user_temporary_material",
      usage: item.usage || (["public", "publishable", "anonymized"].includes(visibility) ? "usable" : "needs_review"),
      text: content,
      frozenAt: createdAt
    });
  }
  return [...unique.values()];
}

export function ensureContentWorkflows(store) {
  store.contentRuns ||= store.contentWorkflows || [];
  store.contentWorkflows = store.contentRuns;
  return store.contentWorkflows;
}

export function createContentWorkflow(store, { accountId, recommendation, generationPayload }) {
  if (!generationPayload?.ideaTitle || !generationPayload?.platform || !generationPayload?.contentTaskBrief) {
    const error = new Error("generationPayload with ideaTitle, platform, and contentTaskBrief is required");
    error.statusCode = 400;
    throw error;
  }
  const createdAt = now();
  const executionContext = generationPayload.contentExecutionContext || null;
  const sourcePlan = generationPayload.contentSourcePlan || recommendation?.sourcePlan || null;
  const frozenPatternSnapshot = freezePatternSnapshot(generationPayload, sourcePlan, createdAt);
  const frozenTemporaryMaterials = freezeTemporaryMaterials(generationPayload, createdAt);
  const frozenContentSourceEvidence = { ...(generationPayload.contentSourceEvidence || {}), userMaterials: frozenTemporaryMaterials };
  const mechanismDecision = structuredClone(sourcePlan?.mechanismDecision || generationPayload.contentMechanismDecision || null);
  const mechanismConfirmationEvidence = generationPayload.mechanismDecisionConfirmation || sourcePlan?.mechanismDecisionConfirmation || null;
  if (mechanismDecision) {
    validateContentMechanismDecision(mechanismDecision);
    const expectedStrategySnapshotId = executionContext?.strategySnapshotId
      || generationPayload.strategySnapshotId
      || generationPayload.contentTaskBrief?.strategySnapshotId
      || null;
    if (expectedStrategySnapshotId && mechanismDecision.activeStrategySnapshotRef.id !== expectedStrategySnapshotId) {
      const error = new Error("机制决策与当前策略快照不一致");
      error.statusCode = 409;
      error.code = "CONTENT_MECHANISM_STRATEGY_MISMATCH";
      throw error;
    }
    if (mechanismDecision.deviation.userConfirmationStatus === "confirmed"
      && !(mechanismConfirmationEvidence?.status === "confirmed"
        && mechanismConfirmationEvidence.confirmedByType === "user"
        && mechanismConfirmationEvidence.eventRef)) {
      const error = new Error("策略机制偏差的确认必须包含显式用户事件证据");
      error.statusCode = 409;
      error.code = "CONTENT_MECHANISM_CONFIRMATION_EVIDENCE_REQUIRED";
      throw error;
    }
  }
  const sharedMasterInput = generationPayload.sharedContentMasterInput || {
    contentTaskBrief: generationPayload.contentTaskBrief,
    contentIdentity: generationPayload.contentIdentity || null
  };
  const workflow = {
    kind: "ContentRun",
    schemaVersion: "1.0",
    id: `content_run_${randomUUID().slice(0, 8)}`,
    accountId,
    workspaceId:generationPayload.workspaceId||executionContext?.workspaceId||null,
    companyId:generationPayload.companyId||executionContext?.companyId||null,
    socialAccountId:generationPayload.socialAccountId||executionContext?.socialAccountId||accountId,
    accountStrategySnapshotId:generationPayload.accountStrategySnapshotId||generationPayload.strategyResolution?.accountStrategySnapshotId||null,
    selectionSource:generationPayload.selectionSource||null,
    matrixId:generationPayload.matrixId||null,
    rollingPlanId:generationPayload.rollingPlanId||null,
    rollingPlanItemId:generationPayload.rollingPlanItemId||null,
    contentOpportunityId:generationPayload.contentOpportunityId||null,
    effectiveStrategyId:generationPayload.effectiveStrategyId||executionContext?.effectiveStrategyId||null,
    strategyDecisionRevision:generationPayload.strategyDecisionRevision||executionContext?.strategyDecisionRevision||null,
    strategyDecisionHash:generationPayload.strategyDecisionHash||executionContext?.strategyDecisionHash||null,
    growthMode:generationPayload.growthMode||executionContext?.growthMode||recommendation?.growthMode||null,
    growthPlaybookId:generationPayload.growthPlaybookId||executionContext?.growthPlaybookId||recommendation?.growthPlaybookId||null,
    validationHypothesis:generationPayload.validationHypothesis||executionContext?.validationHypothesis||recommendation?.validationHypothesis||null,
    experimentPlanId:generationPayload.experimentPlanId||executionContext?.experimentPlanId||null,
    strategySnapshotId: executionContext?.strategySnapshotId || generationPayload.strategySnapshotId || generationPayload.contentTaskBrief?.strategySnapshotId || null,
    factSnapshotId: executionContext?.factSnapshotId || generationPayload.contentTaskBrief?.factSnapshotId || null,
    accountContextSnapshot: {
      workspaceId: generationPayload.workspaceId || executionContext?.workspaceId || null,
      companyId: generationPayload.companyId || executionContext?.companyId || null,
      socialAccountId: generationPayload.socialAccountId || executionContext?.socialAccountId || accountId,
      platform: generationPayload.platform,
      selectionSource: generationPayload.selectionSource || null,
      accountStrategySnapshotId: generationPayload.accountStrategySnapshotId || generationPayload.strategyResolution?.accountStrategySnapshotId || null,
      frozenAt: createdAt
    },
    sourceEvidenceSnapshot: {
      schemaVersion: "1.0",
      frozenAt: createdAt,
      factSnapshotId: executionContext?.factSnapshotId || generationPayload.contentTaskBrief?.factSnapshotId || null,
      hotspots: structuredClone(frozenContentSourceEvidence.hotspots || []),
      viralBlueprints: structuredClone(frozenContentSourceEvidence.viralBlueprints || []),
      userMaterials: frozenTemporaryMaterials,
      sourceBoundary: (frozenContentSourceEvidence.hotspots || []).length
        ? "external_event_not_business_fact"
        : null
    },
    contentMechanismDecision: mechanismDecision,
    mechanismDecisionBinding: mechanismDecision ? {
      schemaVersion: "1.0",
      decisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash },
      contentProjectRef: structuredClone(mechanismDecision.contentProjectRef),
      activeStrategySnapshotRef: structuredClone(mechanismDecision.activeStrategySnapshotRef),
      sharedContentMasterInputRef: {
        id: generationPayload.sharedContentMasterInput?.id || `shared_master_input:${mechanismDecision.id}`,
        hash: hashUnifiedContent(sharedMasterInput)
      },
      sourcePlanRef: {
        id: `source_plan:${mechanismDecision.id}`,
        hash: hashUnifiedContent(sourcePlan)
      },
      userConfirmationEvidence: mechanismDecision.deviation.userConfirmationStatus === "confirmed"
        ? structuredClone(mechanismConfirmationEvidence)
        : null
    } : null,
    hotspotAssetIds: (frozenContentSourceEvidence.hotspots || []).map((item) => item.id),
    knowledgeSnapshotId: executionContext?.knowledgeSnapshotId || null,
    contentPatternSnapshotId: frozenPatternSnapshot?.id || generationPayload.contentPatternSnapshotId || executionContext?.contentPatternSnapshotId || null,
    contentExecutionContextId: executionContext?.id || null,
    directionCardId: executionContext?.directionCard?.id || generationPayload.contentDirectionCard?.id || null,
    editorialDecisionSnapshot: structuredClone(executionContext?.editorialDecisionBrief || generationPayload.editorialDecisionBrief || null),
    strategyProjectionSnapshot: structuredClone(executionContext?.strategyProjectionSnapshot || null),
    growthPlaybookSnapshot: structuredClone(executionContext?.growthPlaybookSnapshot || null),
    experimentSnapshot: structuredClone(executionContext?.experimentSnapshot || null),
    entryMode: generationPayload.sourceType || generationPayload.generationMode || "agent",
    state: CONTENT_WORKFLOW_STATES.DIRECTION_SELECTED,
    version: 1,
    directionCard: {
      recommendationId: recommendation?.id || null,
      topic: recommendation?.topic || generationPayload.ideaTitle,
      reason: recommendation?.reason || "",
      contentPillar: recommendation?.contentPillar || generationPayload.contentTaskBrief?.contentPillar || null,
      contentRole: recommendation?.contentRole || generationPayload.contentTaskBrief?.contentRole || null,
      sourcePlan: recommendation?.sourcePlan || generationPayload.contentSourcePlan || null
    },
    generationPayload: structuredClone({
      ...generationPayload,
      accountId,
      temporaryMaterials: frozenTemporaryMaterials,
      contentSourceEvidence: frozenContentSourceEvidence,
      contentPatternSnapshotId: frozenPatternSnapshot?.id || generationPayload.contentPatternSnapshotId || null,
      contentPatternSnapshot: frozenPatternSnapshot,
      featureFlags: { ...(generationPayload.featureFlags || {}), viralLearningV1: false },
      sourcePolicy: { implicitHotspotSearch: false, approvedBlueprintOnly: true, automaticSkillPromotion: false }
    }),
    featureFlags: { viralLearningV1: false },
    outline: null,
    outlineRevision: 0,
    outlineConfirmedAt: null,
    contentTaskId: null,
    events: [{ id: `event_${randomUUID().slice(0, 8)}`, type: "direction_selected", at: createdAt }],
    createdAt,
    updatedAt: createdAt
  };
  workflow.sourceTrace = buildContentSourceTrace(sourcePlan, { contentRunId: workflow.id });
  workflow.skillExecutionPlan = buildSkillExecutionPlan({
    platform: generationPayload.platform,
    sourcePlan: generationPayload.contentSourcePlan || recommendation?.sourcePlan || null,
    contentExecutionContext: executionContext,
    options: {
      ...(generationPayload.skillExecutionOptions || {}),
      referenceAnalysis: generationPayload.referenceAnalysis || generationPayload.skillExecutionOptions?.referenceAnalysis || null,
      contentPatternSnapshotId: frozenPatternSnapshot?.id || null
    }
  });
  workflow.skillExecutionPlan.sourceTrace = structuredClone(workflow.sourceTrace);
  ensureRunLedger(workflow);
  const sourceBlocked = sourcePlan?.sources?.some((source) => source.required && !(source.candidateIds || []).length);
  const mechanismConfirmationBlocked = mechanismDecision?.deviation?.status === "blocked"
    || mechanismDecision?.deviation?.userConfirmationStatus === "pending"
    || mechanismDecision?.deviation?.userConfirmationStatus === "rejected";
  const referenceGate = workflow.skillExecutionPlan.referenceAnalysisTrace?.humanReviewGate;
  const sourceStatus = sourceBlocked || mechanismConfirmationBlocked ? "blocked" : referenceGate?.required && referenceGate.status !== "approved" ? "needs_review" : sourcePlan ? "completed" : "needs_review";
  updateRunNode(workflow, "source_resolution", sourceStatus, {
    reason: sourceBlocked ? "required_source_missing" : mechanismConfirmationBlocked ? "mechanism_strategy_deviation_requires_explicit_user_confirmation" : referenceGate?.required && referenceGate.status !== "approved" ? "reference_analysis_requires_human_review" : sourcePlan ? "source_plan_frozen" : "source_plan_missing",
    sourceTrace: workflow.sourceTrace,
    referenceAnalysisTrace: workflow.skillExecutionPlan.referenceAnalysisTrace,
    mechanismDecisionRef: workflow.mechanismDecisionBinding?.decisionRef || null
  });
  ensureContentWorkflows(store).push(workflow);
  return workflow;
}

export const ensureContentRuns = ensureContentWorkflows;
export const createContentRun = createContentWorkflow;

export function beginOutline(workflow) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.DIRECTION_SELECTED, CONTENT_WORKFLOW_STATES.OUTLINE_READY, CONTENT_WORKFLOW_STATES.NEEDS_REVIEW], "generate outline");
  if (workflow.contentMechanismDecision?.deviation?.status === "blocked"
    || ["pending", "rejected"].includes(workflow.contentMechanismDecision?.deviation?.userConfirmationStatus)) {
    const error = new Error("策略机制偏差必须由用户显式确认后才能进入大纲生成");
    error.statusCode = 409;
    error.code = "CONTENT_MECHANISM_USER_CONFIRMATION_REQUIRED";
    throw error;
  }
  const blueprintDecision = workflow.sourceTrace?.decisions?.find((item) => item.type === "viral_blueprint");
  if ((blueprintDecision?.blockedIds?.length || blueprintDecision?.used) && !workflow.generationPayload?.contentPatternSnapshot) {
    const error = new Error("审核蓝图必须冻结为 ContentPatternSnapshot 后才能进入正文来源");
    error.statusCode = 409;
    error.code = "CONTENT_PATTERN_SNAPSHOT_REQUIRED";
    throw error;
  }
  const referenceGate = workflow.skillExecutionPlan?.referenceAnalysisTrace?.humanReviewGate;
  if (referenceGate?.required && (referenceGate.status !== "approved" || !referenceGate.contentPatternSnapshotId)) {
    const error = new Error("原始参考帖必须先完成爆款拆解和人工审核，并冻结审核蓝图后才能进入正文来源");
    error.statusCode = 409;
    error.code = "CONTENT_PATTERN_REVIEW_REQUIRED";
    throw error;
  }
  workflow.state = CONTENT_WORKFLOW_STATES.OUTLINE_DRAFTING;
  workflow.outlineConfirmedAt = null;
  updateRunNode(workflow, "content_master", "running");
  updateRunNode(workflow, "outline", "running");
  event(workflow, "outline_generation_started");
  return workflow;
}

export function saveGeneratedOutline(workflow, result) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.OUTLINE_DRAFTING], "save generated outline");
  workflow.contentMaster = structuredClone(result.contentMaster);
  workflow.outline = structuredClone(result.outline);
  workflow.outlineValidation = structuredClone(result.validation);
  workflow.outlineSkillTraces = structuredClone(result.skillTraces || []);
  workflow.outlineRevision = Number(workflow.outlineRevision || 0) + 1;
  workflow.state = result.status === "blocked"
    ? CONTENT_WORKFLOW_STATES.BLOCKED
    : result.status === "needs_review"
      ? CONTENT_WORKFLOW_STATES.NEEDS_REVIEW
      : result.validation?.valid
        ? CONTENT_WORKFLOW_STATES.OUTLINE_READY
        : CONTENT_WORKFLOW_STATES.NEEDS_REVIEW;
  updateRunNode(workflow, "content_master", result.contentMaster ? "completed" : "blocked", { reason: result.contentMaster ? "content_master_ready" : "content_master_missing" });
  updateRunNode(workflow, "outline", workflow.state === CONTENT_WORKFLOW_STATES.BLOCKED ? "blocked" : result.validation?.valid ? "completed" : "needs_review", { outlineRevision: workflow.outlineRevision, validation: result.validation || null, traceId: result.skillTraces?.[0]?.traceId || result.skillTraces?.[0]?.id || null });
  updateRunNode(workflow, "outline_confirmation", "pending", { outlineRevision: workflow.outlineRevision });
  event(workflow, "outline_generated", { outlineRevision: workflow.outlineRevision, state: workflow.state });
  return workflow;
}

export function failOutlineGeneration(workflow, error) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.OUTLINE_DRAFTING], "fail outline generation");
  workflow.state = CONTENT_WORKFLOW_STATES.DIRECTION_SELECTED;
  updateRunNode(workflow, "content_master", "failed", { error: error.message });
  updateRunNode(workflow, "outline", "failed", { error: error.message });
  event(workflow, "outline_generation_failed", { error: error.message });
  return workflow;
}

export function saveEditedOutline(workflow, outline) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.OUTLINE_READY, CONTENT_WORKFLOW_STATES.NEEDS_REVIEW, CONTENT_WORKFLOW_STATES.BLOCKED, CONTENT_WORKFLOW_STATES.OUTLINE_CONFIRMED], "edit outline");
  if (!Array.isArray(outline?.sections) || outline.sections.length < 3) {
    const error = new Error("outline requires at least three sections");
    error.statusCode = 400;
    throw error;
  }
  const knownClaims = new Set((workflow.contentMaster?.confirmed_facts || []).map((item) => item.fact_id));
  const invalidClaimIds = outline.sections.flatMap((section) => section.claim_ids || []).filter((claimId) => !knownClaims.has(claimId));
  if (invalidClaimIds.length) {
    const error = new Error(`outline references unknown claims: ${[...new Set(invalidClaimIds)].join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  workflow.outline = structuredClone({ ...outline, confirmation_required: true });
  workflow.outlineRevision = Number(workflow.outlineRevision || 0) + 1;
  workflow.outlineConfirmedAt = null;
  workflow.state = CONTENT_WORKFLOW_STATES.OUTLINE_READY;
  updateRunNode(workflow, "outline", "completed", { outlineRevision: workflow.outlineRevision, editedBy: "user" });
  updateRunNode(workflow, "outline_confirmation", "pending", { reason: "confirmation_invalidated_by_edit", outlineRevision: workflow.outlineRevision });
  event(workflow, "outline_edited", { outlineRevision: workflow.outlineRevision });
  return workflow;
}

export function confirmOutline(workflow) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.OUTLINE_READY], "confirm outline");
  workflow.state = CONTENT_WORKFLOW_STATES.OUTLINE_CONFIRMED;
  workflow.outlineConfirmedAt = now();
  workflow.confirmedOutlineRevision = workflow.outlineRevision;
  updateRunNode(workflow, "outline_confirmation", "completed", { outlineRevision: workflow.outlineRevision });
  recordRunDecision(workflow, { gate: "outline_confirmation", decision: "confirmed", revision: workflow.outlineRevision });
  event(workflow, "outline_confirmed", { outlineRevision: workflow.outlineRevision });
  return workflow;
}

export function beginContentGeneration(workflow) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.OUTLINE_CONFIRMED], "generate content");
  if (workflow.confirmedOutlineRevision !== workflow.outlineRevision) {
    const error = new Error("outline changed after confirmation");
    error.statusCode = 409;
    throw error;
  }
  workflow.state = CONTENT_WORKFLOW_STATES.GENERATING;
  updateRunNode(workflow, "platform_writer", "running");
  event(workflow, "content_generation_started");
  return workflow;
}

export function completeContentGeneration(workflow, task) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.GENERATING], "complete content generation");
  workflow.contentTaskId = task.id;
  workflow.state = task.status === "succeeded" ? CONTENT_WORKFLOW_STATES.CONTENT_READY : CONTENT_WORKFLOW_STATES.NEEDS_REVIEW;
  attachTaskExecutionToRun(workflow, task);
  event(workflow, "content_generation_completed", { contentTaskId: task.id, contentStatus: task.status });
  return workflow;
}

export function failContentGeneration(workflow, error) {
  workflow.state = CONTENT_WORKFLOW_STATES.OUTLINE_CONFIRMED;
  updateRunNode(workflow, "platform_writer", "failed", { error: error.message });
  event(workflow, "content_generation_failed", { error: error.message });
  return workflow;
}

export function recordWechatContentRecovery(workflow, task, recoveryRecord) {
  requireState(workflow, [CONTENT_WORKFLOW_STATES.NEEDS_REVIEW, CONTENT_WORKFLOW_STATES.BLOCKED], "recover WeChat content");
  workflow.contentTaskId = task.id;
  workflow.state = task.status === "succeeded" ? CONTENT_WORKFLOW_STATES.CONTENT_READY : CONTENT_WORKFLOW_STATES.NEEDS_REVIEW;
  attachTaskExecutionToRun(workflow, task);
  event(workflow, task.status === "succeeded" ? "wechat_content_recovery_completed" : "wechat_content_recovery_blocked", {
    contentTaskId: task.id,
    recoveryId: recoveryRecord.id,
    attempt: recoveryRecord.attempt,
    errorCodes: recoveryRecord.errorCodes,
    qualityBlockers: recoveryRecord.qualityBlockers
  });
  return workflow;
}
