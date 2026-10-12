import {
  UNIFIED_CONTENT_CONTRACTS,
  createUnifiedWriterContext,
  hashUnifiedContent,
  validateContentMechanismDecision,
  validateContentMechanismDecisionV2,
  validateContentProject,
  validateLegacyUnifiedContentProjection,
  validateSharedContentMasterRef,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";
import { buildSkillExecutionPlan, buildUnifiedPlatformSkillExecutionPlan, resolveSkillExecutionPlanGraphMode } from "./skill-execution-plan.mjs";
import {
  createContentOutlineStrictSequenceContract,
  sanitizeUnifiedOrchestrationCauseCode,
  sanitizeUnifiedSkillValidationFieldPaths
} from "./unified-skill-output-contracts.mjs";
import { resolveFrozenContentSourcePlanRefs } from "./source-planner.mjs";
import {
  assembleXhsPostPackageV4,
  compileXhsContentPreflightV2,
  compileXhsTraceabilityV2,
  createXhsFinalTitleBinding
} from "./xhs-content-components.mjs";
import {
  createExecutionAuthorityBinding,
  createSkillActivityInvocation,
  DEFAULT_ATOMIC_ATTEMPT_POLICY
} from "./unified-execution-contracts.mjs";
import {
  createUnifiedAtomicWechatContentCommit,
  createUnifiedAtomicWechatSkillFactFromControlled
} from "./unified-atomic-wechat-commit.mjs";
import { projectWechatImageRuntimeCapability } from "./wechat-image-plan-adapter.mjs";
import { compileWechatRuntimeOutput } from "./wechat-creative-draft-compiler.mjs";

const PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);
const COMPATIBILITY_TOKEN = Symbol("legacy-unified-orchestration-adapter");
const XHS_ATOMIC_GRAPH_MODE = "atomic_v4";

function fail(code, message, detail = null) {
  throw Object.assign(new Error(message), { code, statusCode: 409, detail });
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function captureTrustedFeatureFlags(dependencies) {
  return Object.freeze({
    unifiedContentXhsAtomicGraphV1: dependencies?.serverFeatureFlags?.unifiedContentXhsAtomicGraphV1 === true
  });
}

function ref(id, value) {
  return { id, hash: hashUnifiedContent(value) };
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function assertText(value, code, label) {
  if (typeof value !== "string" || !value.trim()) fail(code, `${label} is required`);
}

function assertProjectInput(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) fail("UNIFIED_ORCHESTRATOR_PROJECT_REQUIRED", "project is required");
  for (const key of ["id", "companyId"]) assertText(project[key], "UNIFIED_ORCHESTRATOR_PROJECT_INVALID", `project.${key}`);
  for (const key of ["contentOpportunityRef", "activeStrategySnapshotRef"]) {
    if (!project[key]?.id || !project[key]?.hash) fail("UNIFIED_ORCHESTRATOR_PROJECT_INVALID", `project.${key} is required`);
  }
  const accounts = project.accounts || {};
  for (const platform of PLATFORMS) assertText(accounts[platform], "UNIFIED_ORCHESTRATOR_ACCOUNT_REQUIRED", `project.accounts.${platform}`);
  if (!project.designDnaSnapshotRef?.id || !project.designDnaSnapshotRef?.hash) fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED");
  if (!project.designDnaAuthority?.snapshot || !sameRef(project.designDnaAuthority.ref, project.designDnaSnapshotRef)) fail("UNIFIED_XHS_DESIGN_DNA_AUTHORITY_REQUIRED");
}

function assertMechanismBinding(project, decision) {
  validateContentMechanismDecision(decision);
  if (decision.companyId !== project.companyId) fail("CONTENT_MECHANISM_COMPANY_MISMATCH", "mechanism decision company does not match project");
  if (!sameRef(decision.activeStrategySnapshotRef, project.activeStrategySnapshotRef)) {
    fail("CONTENT_MECHANISM_STRATEGY_MISMATCH", "mechanism decision strategy does not match project");
  }
  if (decision.deviation.status === "blocked" || ["pending", "rejected"].includes(decision.deviation.userConfirmationStatus)) {
    fail("CONTENT_MECHANISM_USER_CONFIRMATION_REQUIRED", "strategy deviation requires explicit user confirmation", {
      stage: "master",
      recoverableFrom: "mechanism_confirmation"
    });
  }
}

function sortedRefKeys(refs) {
  return refs.map((item) => `${item.id}:${item.hash}`).sort();
}

function assertAtomicMechanismBinding(project, decision, sourcePlan) {
  try {
    validateContentMechanismDecisionV2(decision);
  } catch (error) {
    throw Object.assign(new Error("atomic_v4 requires a native ContentMechanismDecision@2.0"), {
      code: "CONTENT_MECHANISM_V2_NATIVE_REQUIRED",
      statusCode: 409,
      causeCode: error?.code || "CONTENT_MECHANISM_V2_INVALID"
    });
  }
  if (decision.companyId !== project.companyId) fail("CONTENT_MECHANISM_COMPANY_MISMATCH", "mechanism decision company does not match project");
  if (!sameRef(decision.activeStrategySnapshotRef, project.activeStrategySnapshotRef)) {
    fail("CONTENT_MECHANISM_STRATEGY_MISMATCH", "mechanism decision strategy does not match project");
  }
  if (decision.deviation.status === "blocked") {
    fail("CONTENT_MECHANISM_USER_CONFIRMATION_REQUIRED", "strategy deviation requires an immutable user confirmation", {
      stage: "master",
      recoverableFrom: "mechanism_confirmation"
    });
  }
  const decisionRef = { id: decision.id, hash: decision.decisionHash };
  if (!sameRef(project.writerContexts?.xiaohongshu?.authority_refs?.mechanismDecisionRef, decisionRef)) {
    fail("CONTENT_MECHANISM_V2_WRITER_CONTEXT_REF_MISMATCH", "XHS WriterContext must bind the native v2 mechanism decision");
  }
  const plannedRefs = resolveFrozenContentSourcePlanRefs(sourcePlan);
  if (JSON.stringify(sortedRefKeys(decision.selectedSourceRefs)) !== JSON.stringify(sortedRefKeys(plannedRefs))) {
    fail("CONTENT_MECHANISM_V2_SOURCE_PLAN_REF_MISMATCH", "mechanism decision selected sources do not match the frozen SourcePlan");
  }
  return { decisionRef };
}

function sharedMasterRef(master) {
  if (!master || typeof master !== "object" || Array.isArray(master)) fail("SHARED_CONTENT_MASTER_INVALID", "shared content master must be an object");
  assertText(master.id, "SHARED_CONTENT_MASTER_INVALID", "shared content master id");
  assertText(master.contract, "SHARED_CONTENT_MASTER_INVALID", "shared content master contract");
  if (!/^(?:Shared)?ContentMaster@/.test(master.contract)
    || /xiaohongshu|wechat|platform|package/i.test(master.contract)
    || Object.hasOwn(master, "authorityPlatform")
    || ["xiaohongshu", "wechat"].includes(master.platform)) {
    fail("CROSS_PLATFORM_AUTHORITY_FORBIDDEN", "platform output cannot be used as shared content master authority");
  }
  const value = {
    schemaVersion: "1.0",
    contract: UNIFIED_CONTENT_CONTRACTS.sharedContentMasterRef,
    id: master.id,
    hash: hashUnifiedContent(master),
    authorityContract: master.contract,
    authorityType: "shared_content_master"
  };
  validateSharedContentMasterRef(value);
  return value;
}

function assertPlatformBrief(brief, platform, masterRef, designDnaAuthority = null) {
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) fail("PLATFORM_BRIEF_INVALID", `${platform} platform brief is required`);
  assertText(brief.id, "PLATFORM_BRIEF_INVALID", `${platform} platform brief id`);
  if (brief.platform !== platform) fail("PLATFORM_BRIEF_PLATFORM_MISMATCH", `${platform} platform brief has wrong platform`);
  if (!sameRef(brief.sharedContentMasterRef, masterRef)) fail("PLATFORM_BRIEF_MASTER_MISMATCH", `${platform} platform brief must bind the shared master`);
  if (brief.authorityType && brief.authorityType !== "shared_content_master") fail("CROSS_PLATFORM_AUTHORITY_FORBIDDEN", `${platform} brief declares platform authority`);
  if (brief.sourcePlatformOutputRef || brief.authorityPlatform) fail("CROSS_PLATFORM_AUTHORITY_FORBIDDEN", `${platform} brief references platform output authority`);
  if (platform === "xiaohongshu") {
    const designDna = brief?.brief?.designDna;
    const designDnaRef = brief?.brief?.designDnaRef;
    if (!designDna || designDna.status !== "confirmed") fail("UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED");
    if (!sameRef(designDnaRef, designDnaAuthority?.ref) || designDna.id !== designDnaRef.id || hashUnifiedContent(designDna) !== designDnaRef.hash) {
      fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_MISMATCH");
    }
  }
}

function writerPreliminaryTitles(platform, writer) {
  const values = platform === "xiaohongshu" ? writer?.post_copy?.title_candidates : writer?.title_candidates;
  if (!Array.isArray(values) || !values.length || values.some((item) => typeof item?.title !== "string" || !item.title.trim())) {
    fail("TITLE_INPUT_PRELIMINARY_TITLES_REQUIRED", `${platform} writer did not provide preliminary titles`);
  }
  return clone(values);
}

function authorizedSameAccountTitleSignals(brief) {
  const input = brief?.brief;
  const signals = input?.sameAccountTitleSignals;
  const authorization = input?.sameAccountTitleSignalsAuthorization;
  if (!Array.isArray(signals) || authorization?.status !== "authorized" || authorization?.accountId !== brief?.accountId) return [];
  const allowedIds = new Set(Array.isArray(authorization.signalIds) ? authorization.signalIds : []);
  return clone(signals.filter((item) => {
    const id = item?.signal_id || item?.id;
    return typeof id === "string" && id && allowedIds.has(id) && (!item.accountId || item.accountId === brief.accountId);
  }));
}

function skillInputForStep({ step, platform, context, outputs, master, brief }) {
  const contentMaster = master?.contentMaster || master;
  if (step.id === "outline") {
    if (!contentMaster || typeof contentMaster !== "object" || Array.isArray(contentMaster)) fail("OUTLINE_INPUT_CONTENT_MASTER_REQUIRED", "full ContentMaster is required");
    if (!brief || typeof brief !== "object" || Array.isArray(brief)) fail("OUTLINE_INPUT_PLATFORM_BRIEF_REQUIRED", `full ${platform} Platform Brief is required`);
    const strictSequenceContract = createContentOutlineStrictSequenceContract(contentMaster);
    const input = {
      platform: platform === "wechat" ? "wechat_official_account" : platform,
      content_master: clone(contentMaster),
      platform_brief: clone(brief),
      ...(strictSequenceContract ? { strict_sequence_contract: clone(strictSequenceContract) } : {})
    };
    if (platform === "xiaohongshu" && strictSequenceContract?.slots?.length === 4) {
      input.presentation_section_plan = [
        { kind: "core", slotIds: ["core-slot:1"] },
        { kind: "core", slotIds: ["core-slot:2"] },
        { kind: "core", slotIds: ["core-slot:2"] },
        { kind: "core", slotIds: ["core-slot:3"] },
        { kind: "core", slotIds: ["core-slot:4"] },
        { kind: "supplemental", anchorId: "supplemental-anchor:4" }
      ];
    }
    return input;
  }
  if (platform === "xiaohongshu" && step.id === "platform_writer") {
    if (!contentMaster || typeof contentMaster !== "object" || Array.isArray(contentMaster)) fail("XHS_INPUT_CONTENT_MASTER_REQUIRED", "full ContentMaster is required");
    if (!brief || typeof brief !== "object" || Array.isArray(brief)) fail("XHS_INPUT_PLATFORM_BRIEF_REQUIRED", "full Xiaohongshu Platform Brief is required");
    const confirmedOutline = outputs.outline;
    if (!confirmedOutline || typeof confirmedOutline !== "object" || Array.isArray(confirmedOutline)) fail("XHS_INPUT_CONFIRMED_OUTLINE_REQUIRED", "confirmed Xiaohongshu outline is required");
    const designDna = brief?.brief?.designDna;
    const designDnaRef = brief?.brief?.designDnaRef;
    if (!designDna || typeof designDna !== "object" || Array.isArray(designDna) || designDna.status !== "confirmed") fail("UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED");
    if (!sameRef(designDnaRef, context.designDnaSnapshotRef) || designDna.id !== designDnaRef.id || hashUnifiedContent(designDna) !== designDnaRef.hash) fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_MISMATCH");
    return {
      platform: "xiaohongshu",
      content_master: clone(contentMaster),
      platform_brief: clone(brief),
      confirmed_outline: clone(confirmedOutline),
      writer_context: clone(context.writerContext),
      design_dna: clone(designDna),
      design_dna_ref: clone(designDnaRef)
    };
  }
  if (platform === "wechat" && ["platform_writer", "wechat_content_review", "image_plan"].includes(step.id)) {
    if (!contentMaster || typeof contentMaster !== "object" || Array.isArray(contentMaster)) fail("WECHAT_INPUT_CONTENT_MASTER_REQUIRED", "full ContentMaster is required");
    if (!brief || typeof brief !== "object" || Array.isArray(brief)) fail("WECHAT_INPUT_PLATFORM_BRIEF_REQUIRED", "full WeChat Platform Brief is required");
    const confirmedOutline = outputs.outline;
    if (!confirmedOutline || typeof confirmedOutline !== "object" || Array.isArray(confirmedOutline)) fail("WECHAT_INPUT_CONFIRMED_OUTLINE_REQUIRED", "confirmed WeChat outline is required");
    const common = {
      platform: "wechat_official_account",
      content_master: clone(contentMaster),
      platform_brief: clone(brief),
      confirmed_outline: clone(confirmedOutline),
      writer_context: clone(context.writerContext)
    };
    if (step.id === "platform_writer") return common;
    const article = outputs.platform_writer;
    if (!article || typeof article !== "object" || Array.isArray(article)) fail("WECHAT_INPUT_EXACT_ARTICLE_REQUIRED", "exact verified WeChat article is required");
    if (step.id === "wechat_content_review") return { ...common, mode: "report_only", article: clone(article) };
    const articleReview = outputs.wechat_content_review;
    if (!articleReview || typeof articleReview !== "object" || Array.isArray(articleReview)) fail("WECHAT_INPUT_PASS_REVIEW_REQUIRED", "passing WeChat article review is required");
    if (articleReview.decision !== "pass" || articleReview.fact_recheck_required !== false
      || articleReview.findings?.some((item) => item?.severity === "blocker")) fail("WECHAT_INPUT_PASS_REVIEW_REQUIRED", "exact passing WeChat article review is required");
    return {
      ...common,
      article: clone(article),
      article_review: clone(articleReview),
      authorized_assets: clone(brief?.brief?.authorized_assets || brief?.authorized_assets || [])
    };
  }
  if (step.id !== "title") return { ...context, priorOutputs: clone(outputs) };
  const completedContent = outputs.platform_writer;
  if (!completedContent) fail("TITLE_INPUT_COMPLETED_CONTENT_REQUIRED", `${platform} completed writer output is required`);
  if (!contentMaster || typeof contentMaster !== "object" || Array.isArray(contentMaster)) fail("TITLE_INPUT_CONTENT_MASTER_REQUIRED", "full ContentMaster is required");
  const contentTaskBrief = brief?.brief?.contentTaskBrief || brief?.brief || brief;
  if (!contentTaskBrief || typeof contentTaskBrief !== "object" || Array.isArray(contentTaskBrief)) fail("TITLE_INPUT_CONTENT_TASK_BRIEF_REQUIRED", `${platform} content task brief is required`);
  return {
    stage: "final_after_body",
    platform: platform === "wechat" ? "wechat_official_account" : platform,
    content_master: clone(contentMaster),
    completed_content: clone(completedContent),
    preliminary_titles: writerPreliminaryTitles(platform, completedContent),
    content_task_brief: clone(contentTaskBrief),
    same_account_title_signals: authorizedSameAccountTitleSignals(brief),
    editorial_autonomy: {
      choose_low_risk_titles: true,
      empty_claim_ids_when_no_exact_authorized_id: true,
      do_not_invent_claim_ids: true
    }
  };
}

function stageForStep(step) {
  if (step.id === "outline") return "outline";
  if (["platform_writer", "xhs_post_copy"].includes(step.id)) return "writer";
  return "review_render";
}

function recoverableError(error, stage, platform = null, step = null) {
  const result = new Error(`${stage} stage failed${platform ? ` for ${platform}` : ""}`);
  result.name = "UnifiedOrchestrationStageError";
  result.code = "UNIFIED_ORCHESTRATION_STAGE_FAILED";
  result.stage = stage;
  result.platform = platform;
  result.stepId = step?.id || null;
  result.capability = step?.capability || null;
  result.recoverable = true;
  result.recoverableFrom = step?.id || stage;
  result.causeCode = sanitizeUnifiedOrchestrationCauseCode(error?.causeCode || error?.code);
  const rawFieldPaths = error?.fieldPaths || error?.details?.fieldPaths;
  const fieldPaths = sanitizeUnifiedSkillValidationFieldPaths(rawFieldPaths);
  // Component validators run after the Skill runner and therefore may use
  // input.* / system.* ownership paths that are not part of the domain-output
  // whitelist. Preserve only path-shaped, secret-free diagnostics so Live
  // failures remain actionable without exposing payloads or prompts.
  if (!fieldPaths.length && (error?.code === "XHS_CONTENT_COMPONENT_INVALID" || error?.code === "XHS_ATOMIC_SKILL_OUTPUT_INVALID") && Array.isArray(rawFieldPaths)) {
    const safeComponentPaths = rawFieldPaths.filter((path) => typeof path === "string"
      && path.length <= 160
      && /^[A-Za-z0-9_$.[\]:-]+$/.test(path)
      && !/PRIVATE|PROMPT|SECRET|TOKEN|KEY/i.test(path));
    if (safeComponentPaths.length) result.fieldPaths = [...new Set(safeComponentPaths)].slice(0, 30);
  }
  if (fieldPaths.length) result.fieldPaths = fieldPaths;
  if (error?.gatewayContractDiagnostics && typeof error.gatewayContractDiagnostics === "object") {
    result.contractDiagnostics = structuredClone(error.gatewayContractDiagnostics);
  }
  return result;
}

function assertDependencies(dependencies) {
  for (const name of ["buildSharedContentMaster", "buildPlatformBrief", "executeSkillStep", "executeServiceStep"]) {
    if (typeof dependencies?.[name] !== "function") fail("UNIFIED_ORCHESTRATOR_DEPENDENCY_REQUIRED", `dependencies.${name} is required`);
  }
}

function assertStepAuthorization(plan, step, authorizationMode) {
  if (authorizationMode === "strict" && !plan.steps.some((candidate) => candidate.id === step.id && candidate.kind === "skill" && candidate.capability === step.capability)) {
    fail("SKILL_STEP_NOT_PLANNED", `execution plan does not authorize ${step.capability}`);
  }
  if (!step.inputContract || !step.outputContract) fail("SKILL_STEP_CONTRACT_REQUIRED", `planned Skill ${step.id} requires input/output contracts`);
  if (!Array.isArray(step.dependsOn) || typeof step.required !== "boolean") fail("SKILL_STEP_SEMANTICS_REQUIRED", `planned Skill ${step.id} requires dependencies and required semantics`);
}

function assertPlanCompleteness(plan, canonicalPlan) {
  if (!plan || !Array.isArray(plan.steps)) fail("EXECUTION_PLAN_INVALID", "platform execution plan with steps is required");
  const actual = new Map(plan.steps.filter((step) => step.kind === "skill").map((step) => [step.id, step]));
  for (const expected of canonicalPlan.steps.filter((step) => step.kind === "skill" && step.enabled && step.required)) {
    const step = actual.get(expected.id);
    if (!step || step.capability !== expected.capability) fail("SKILL_STEP_NOT_PLANNED", `required Skill step ${expected.id} is missing from execution plan`);
  }
}

async function executePlannedStep({ step, plan, platform, input, dependencies, authorizationMode, records }) {
  assertStepAuthorization(plan, step, authorizationMode);
  let output;
  try {
    output = await dependencies.executeSkillStep({
      platform,
      step: clone(step),
      input: clone(input),
      executionPlan: clone(plan),
      planAuthorization: authorizationMode
    });
  } catch (error) {
    throw recoverableError(error, stageForStep(step), platform, step);
  }
  if (output == null && step.required) throw recoverableError({ code: "REQUIRED_SKILL_OUTPUT_MISSING" }, stageForStep(step), platform, step);
  if (output === undefined) output = null;
  const outputHash = hashUnifiedContent(output);
  records.push({
    schemaVersion: "1.0",
    platform,
    stepId: step.id,
    capability: step.capability,
    stage: stageForStep(step),
    required: step.required,
    status: output == null ? "skipped" : "completed",
    planAuthorization: authorizationMode,
    inputContract: step.inputContract,
    outputContract: step.outputContract,
    dependsOn: clone(step.dependsOn),
    executionPlanHash: hashUnifiedContent(plan),
    inputHash: hashUnifiedContent(input),
    outputHash
  });
  return output;
}

async function executeServiceStep({ step, platform, context, dependencies }) {
  if (step.humanConfirmation) {
    const confirmation = context.confirmations?.[step.id];
    if (confirmation !== "confirmed") throw recoverableError({ code: "HUMAN_CONFIRMATION_REQUIRED" }, stageForStep(step), platform, step);
    return { status: "confirmed" };
  }
  try {
    return await dependencies.executeServiceStep({ platform, step: clone(step), context: clone(context) });
  } catch (error) {
    throw recoverableError(error, stageForStep(step), platform, step);
  }
}

function contentMasterValue(master) {
  return master?.contentMaster || master;
}

function outlineSections(outline) {
  const sections = Array.isArray(outline?.sections) ? outline.sections : [];
  return sections.map((section) => ({
    sectionId: section.section_id || section.id,
    outlineRole: section.role || section.outlineRole
  }));
}

function masterAuthorityIds(master) {
  return {
    factIds: (master?.confirmed_facts || []).map((item) => item?.fact_id).filter(Boolean),
    interpretationIds: (master?.supported_interpretations || []).map((item) => item?.interpretation_id).filter(Boolean),
    opinionIds: (master?.author_opinions || []).map((item) => item?.opinion_id).filter(Boolean),
    knowledgeAssetIds: (master?.knowledge_contract?.allowed_assets || []).map((item) => item?.asset_id || item?.id).filter(Boolean)
  };
}

function promotionPolicy(master) {
  const promotion = master?.promotion || {};
  const allowedItemIds = (promotion.allowed_items || []).map((item) => item?.id || item?.item_id || item).filter(Boolean);
  const requestedMode = promotion.mode || "none";
  return {
    mode: requestedMode === "none" || allowedItemIds.length ? requestedMode : "none",
    allowedItemIds,
    disclosure: promotion.disclosure || ""
  };
}

function authorizedReferenceAssets(brief) {
  return clone(brief?.brief?.authorizedReferenceAssets || brief?.brief?.authorized_assets || brief?.authorizedReferenceAssets || brief?.authorized_assets || []);
}

function authorizedReferenceRefs(assets) {
  return assets.map((item) => ({ id: item?.id, hash: item?.hash }));
}

function atomicRecord(step, plan, input, output, record = null) {
  return {
    ...(record ? clone(record) : {}),
    schemaVersion: "1.0",
    platform: "xiaohongshu",
    stepId: step.id,
    capability: step.capability || step.service,
    stage: stageForStep(step),
    required: step.required,
    status: "completed",
    planAuthorization: "strict",
    inputContract: step.inputContract || null,
    outputContract: step.outputContract || null,
    dependsOn: clone(step.dependsOn),
    executionPlanHash: hashUnifiedContent(plan),
    inputHash: hashUnifiedContent(input),
    outputHash: hashUnifiedContent(output),
    componentHash: output?.componentHash || output?.bindingHash || output?.traceHash || output?.reportHash || output?.packageHash || null
  };
}

function assertAtomicPlan(plan) {
  const capabilities = plan.steps.filter((step) => step.kind === "skill").map((step) => step.capability);
  const requiredStepIds = [
    "outline", "outline_confirmation", "xhs_post_copy", "title", "title_consistency", "xhs_final_title_binding",
    "xhs_carousel", "xhs_visual_assets", "xhs_traceability", "xhs_preflight", "xhs_package", "schema_and_reference"
  ];
  if (resolveSkillExecutionPlanGraphMode(plan) !== XHS_ATOMIC_GRAPH_MODE
    || capabilities.includes("write-xhs-content")
    || !requiredStepIds.every((stepId) => plan.steps.filter((step) => step.id === stepId).length === 1)
    || !["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"].every((capability) => capabilities.filter((item) => item === capability).length === 1)) {
    fail("XHS_GRAPH_AUTHORITY_FAMILY_MIXED", "XHS atomic execution plan must contain one exclusive atomic authority family");
  }
}

async function runAtomicXhsGraph({ project, master, masterRef, mechanismDecision, mechanismDecisionRef, sourcePlan, sourcePlanRef, brief, briefRef, plan, dependencies, context, records, outputs, planningOnly = false }) {
  if (typeof dependencies.executeAtomicSkillActivity !== "function") {
    fail("UNIFIED_XHS_ATOMIC_EXECUTION_PORT_REQUIRED", "dependencies.executeAtomicSkillActivity is required for XHS atomic graph");
  }
  assertAtomicPlan(plan);
  const frozenPlan = deepFreeze(clone(plan));
  const planHash = hashUnifiedContent(frozenPlan);
  const stepById = new Map(frozenPlan.steps.map((step) => [step.id, step]));
  const masterValue = contentMasterValue(master);
  const atomicMasterRef = { id: masterRef.id, hash: masterRef.hash };

  const planningStepIds = planningOnly ? ["source_analysis", "pattern_review", "outline"] : ["source_analysis", "pattern_review", "outline", "outline_confirmation"];
  for (const stepId of planningStepIds) {
    const step = stepById.get(stepId);
    if (!step?.enabled || ["skipped", "waiting_condition", "completed"].includes(step.state)) continue;
    if (step.kind === "skill") {
      const input = skillInputForStep({ step, platform: "xiaohongshu", context, outputs, master, brief });
      outputs[step.id] = await executePlannedStep({ step, plan: frozenPlan, platform: "xiaohongshu", input, dependencies, authorizationMode: "strict", records });
    } else {
      outputs[step.id] = await executeServiceStep({ step, platform: "xiaohongshu", context: { ...context, outputs }, dependencies });
    }
  }
  const outline = outputs.outline;
  if (!outline) throw recoverableError({ code: "OUTLINE_OUTPUT_MISSING" }, "outline", "xiaohongshu", { id: "outline" });
  const confirmedOutlineRef = ref(outline.outline_id || outline.id, outline);
  const writerContext = clone(project.writerContexts?.xiaohongshu);
  if (!writerContext) fail("UNIFIED_WRITER_CONTEXT_REQUIRED", "Writer context is required for xiaohongshu");
  const writerContextAuthority = clone(writerContext);
  delete writerContextAuthority.writerContextHash;
  if (writerContext.writerContextHash !== hashUnifiedContent(writerContextAuthority)) {
    fail("UNIFIED_WRITER_CONTEXT_HASH_INVALID", "Writer context authority hash is invalid");
  }
  const writerContextRef = {
    id: writerContext.id || `writer_context:${project.id}:xiaohongshu`,
    hash: writerContext.writerContextHash
  };
  const contentProjectRef = ref(project.id, {
    id: project.id,
    companyId: project.companyId,
    contentOpportunityRef: project.contentOpportunityRef,
    activeStrategySnapshotRef: project.activeStrategySnapshotRef
  });
  const platformRunRef = ref(`platform_run:${project.id}:xiaohongshu`, {
    projectId: project.id,
    platform: "xiaohongshu",
    masterRef,
    briefRef,
    confirmedOutlineRef,
    planHash
  });
  if (planningOnly) return { outline, writer: null, platformRunRef, plan: frozenPlan, planHash };
  const authorityBinding = Object.freeze({
    companyId: project.companyId,
    accountId: project.accounts.xiaohongshu,
    activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef),
    contentOpportunityRef: clone(project.contentOpportunityRef),
    mechanismDecisionRef,
    contentProjectRef,
    platformRunRef,
    sharedContentMasterRef: atomicMasterRef,
    platformBriefRef: clone(briefRef),
    confirmedOutlineRef,
    writerContextRef,
    designDnaRef: clone(project.designDnaSnapshotRef)
  });
  const sections = outlineSections(outline);
  if (!sections.length || sections.some((item) => !item.sectionId || !item.outlineRole)) {
    throw recoverableError({ code: "XHS_ATOMIC_CONFIRMED_OUTLINE_INVALID" }, "writer", "xiaohongshu", stepById.get("xhs_post_copy"));
  }
  const ids = masterAuthorityIds(masterValue);
  const referenceAssets = authorizedReferenceAssets(brief);
  const references = authorizedReferenceRefs(referenceAssets);
  const systemBase = {
    authorityBinding,
    confirmedOutlineRef,
    confirmedOutlineSections: sections,
    // The Provider may paraphrase this sentence while writing the body. The
    // confirmed outline remains the authority, so bind the materialized copy
    // back to its exact promise instead of failing only at package assembly.
    confirmedContentPromise: outline.content_promise
  };

  async function atomicSkill(stepId, input, systemContext) {
    const step = stepById.get(stepId);
    try {
      const result = await dependencies.executeAtomicSkillActivity({
        capability: step.capability,
        input: clone(input),
        systemContext: clone(systemContext),
        step: clone(step),
        executionPlan: frozenPlan
      });
      records.push(atomicRecord(step, frozenPlan, input, result.verifiedComponent, result.executionEvidence?.executionRecord));
      return result.verifiedComponent;
    } catch (error) {
      throw recoverableError(error, stageForStep(step), "xiaohongshu", step);
    }
  }

  const postInput = {
    content_master: clone(masterValue), platform_brief: clone(brief), confirmed_outline: clone(outline),
    writer_context: writerContext, mechanism_decision: clone(mechanismDecision), mechanism_decision_ref: clone(mechanismDecisionRef),
    source_plan: clone(sourcePlan), source_plan_ref: clone(sourcePlanRef), promotion_policy: promotionPolicy(masterValue),
    // Editorial choices are intentionally model-owned within the confirmed
    // topic and authority boundary. This prevents ordinary ordering/CTA
    // decisions from being mistaken for missing factual authority.
    editorial_autonomy: {
      use_outline_array_order: true,
      allow_generic_methodology: true,
      no_case_or_metric_invention: true,
      choose_one_low_risk_cta: true,
      normalize_opening_and_method_sequence: true
    },
    authorized_references: {
      claim_ids: [...ids.factIds, ...ids.interpretationIds],
      non_claim_opinion_ids: [...ids.opinionIds],
      knowledge_asset_ids: [...ids.knowledgeAssetIds]
    }
  };
  outputs.xhs_post_copy = await atomicSkill("xhs_post_copy", postInput, {
    ...systemBase, componentId: `xhs-post-copy:${project.id}`, contentMasterRef: atomicMasterRef, platformBriefRef: briefRef,
    writerContextRef, mechanismDecisionRef, authorizedClaimIds: [...ids.factIds, ...ids.interpretationIds],
    authorizedNonClaimOpinionIds: [...ids.opinionIds],
    authorizedKnowledgeAssetIds: ids.knowledgeAssetIds, promotionPolicy: promotionPolicy(masterValue)
  });
  const postCopyHash = outputs.xhs_post_copy.componentHash;

  const naturalization = stepById.get("naturalization");
  if (naturalization?.enabled && !["skipped", "waiting_condition", "completed"].includes(naturalization.state)) {
    const auditInput = { mode: "audit_only", immutable_component: clone(outputs.xhs_post_copy), content_master: clone(masterValue), platform_brief: clone(brief) };
    outputs.naturalization = await executePlannedStep({ step: naturalization, plan: frozenPlan, platform: "xiaohongshu", input: auditInput, dependencies, authorizationMode: "strict", records });
    if (outputs.xhs_post_copy.componentHash !== postCopyHash) fail("XHS_ATOMIC_POST_COPY_MUTATED", "audit-only naturalization must not mutate XhsPostCopy");
  }

  const titleStep = stepById.get("title");
  const titleInput = {
    stage: "final_after_body", platform: "xiaohongshu", content_master: clone(masterValue),
    completed_content: clone(outputs.xhs_post_copy),
    preliminary_titles: outputs.xhs_post_copy.titleCandidates.map((item) => ({ title: item.title })),
    content_task_brief: clone(brief?.brief?.contentTaskBrief || brief?.brief || brief),
    same_account_title_signals: authorizedSameAccountTitleSignals(brief),
    editorial_autonomy: {
      choose_low_risk_titles: true,
      empty_claim_ids_when_no_exact_authorized_id: true,
      do_not_invent_claim_ids: true
    }
  };
  outputs.title = await executePlannedStep({ step: titleStep, plan: frozenPlan, platform: "xiaohongshu", input: titleInput, dependencies, authorizationMode: "strict", records });
  const titleConsistency = stepById.get("title_consistency");
  outputs.title_consistency = await executeServiceStep({ step: titleConsistency, platform: "xiaohongshu", context: { ...context, outputs, finalTitleCandidate: clone(outputs.title) }, dependencies });

  const bindingStep = stepById.get("xhs_final_title_binding");
  try {
    outputs.xhs_final_title_binding = createXhsFinalTitleBinding({
      id: `xhs-final-title:${project.id}`,
      postCopy: outputs.xhs_post_copy,
      titleOutput: outputs.title,
      titleOutputRef: ref(outputs.title.id || `title:${project.id}:xiaohongshu`, outputs.title),
      contentMaster: masterValue
    });
  } catch (error) {
    throw recoverableError(error, "review_render", "xiaohongshu", bindingStep);
  }
  records.push(atomicRecord(bindingStep, frozenPlan, { postCopyHash, titleOutputHash: hashUnifiedContent(outputs.title) }, outputs.xhs_final_title_binding));

  const designDna = brief.brief.designDna;
  const designDnaVersion = String(designDna.version || designDna.id);
  const carouselInput = {
    post_copy: clone(outputs.xhs_post_copy), final_title_binding: clone(outputs.xhs_final_title_binding),
    confirmed_outline: clone(outline), content_master: clone(masterValue), platform_brief: clone(brief), design_dna: clone(designDna)
  };
  outputs.xhs_carousel = await atomicSkill("xhs_carousel", carouselInput, {
    ...systemBase, componentId: `xhs-carousel:${project.id}`, postCopy: outputs.xhs_post_copy,
    finalTitleContext: { binding: outputs.xhs_final_title_binding }, designDnaRef: project.designDnaSnapshotRef,
    designDnaVersion, authorizedFactIds: ids.factIds, authorizedInterpretationIds: ids.interpretationIds,
    authorizedNonClaimOpinionIds: ids.opinionIds,
    authorizedKnowledgeAssetIds: ids.knowledgeAssetIds, pageMustAvoid: sections.map(() => [])
  });

  const visualInput = {
    carousel_plan: clone(outputs.xhs_carousel), final_title_binding: clone(outputs.xhs_final_title_binding),
    platform_brief: clone(brief), design_dna: clone(designDna), authorized_reference_assets: referenceAssets
  };
  outputs.xhs_visual_assets = await atomicSkill("xhs_visual_assets", visualInput, {
    ...systemBase, componentId: `xhs-visual-assets:${project.id}`, carouselPlan: outputs.xhs_carousel,
    designDnaRef: project.designDnaSnapshotRef, designDnaVersion,
    pageTextTruth: outputs.xhs_carousel.pages.map((page) => ({ page: page.page, textLayers: clone(page.textLayers) })),
    authorizedReferenceAssets: references
  });

  const deterministic = [
    ["xhs_traceability", () => compileXhsTraceabilityV2({ postCopy: outputs.xhs_post_copy, finalTitleBinding: outputs.xhs_final_title_binding, carouselPlan: outputs.xhs_carousel, visualAssetPlan: outputs.xhs_visual_assets, contentMaster: masterValue, authorizedReferenceAssets: references })],
    ["xhs_preflight", () => compileXhsContentPreflightV2({ postCopy: outputs.xhs_post_copy, finalTitleBinding: outputs.xhs_final_title_binding, carouselPlan: outputs.xhs_carousel, visualAssetPlan: outputs.xhs_visual_assets, traceability: outputs.xhs_traceability, contentMaster: masterValue, confirmedOutline: outline, authorizedReferenceAssets: references })],
    ["xhs_package", () => assembleXhsPostPackageV4({ id: `xhs-package:${project.id}`, postCopy: outputs.xhs_post_copy, finalTitleBinding: outputs.xhs_final_title_binding, carouselPlan: outputs.xhs_carousel, visualAssetPlan: outputs.xhs_visual_assets, traceability: outputs.xhs_traceability, preflightReport: outputs.xhs_preflight })]
  ];
  for (const [stepId, compile] of deterministic) {
    const step = stepById.get(stepId);
    try { outputs[stepId] = compile(); }
    catch (error) { throw recoverableError(error, "review_render", "xiaohongshu", step); }
    records.push(atomicRecord(step, frozenPlan, { dependsOn: clone(step.dependsOn) }, outputs[stepId]));
  }
  const schemaStep = stepById.get("schema_and_reference");
  outputs.schema_and_reference = await executeServiceStep({ step: schemaStep, platform: "xiaohongshu", context: { ...context, outputs }, dependencies });
  return { outline, writer: outputs.xhs_package, platformRunRef, plan: frozenPlan, planHash };
}

async function runPlatform({ platform, project, master, masterRef, mechanismDecision, mechanismDecisionRef, sourcePlan, sourcePlanRef, dependencies, authorizationMode, createdAt, serverFeatureFlags, planningOnly = false }) {
  let brief;
  try {
    brief = await dependencies.buildPlatformBrief({
      platform,
      accountId: project.accounts[platform],
      activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef),
      sharedContentMaster: clone(master),
      sharedContentMasterRef: clone(masterRef),
      ...(platform === "xiaohongshu" && sourcePlanRef ? {
        contentMechanismDecisionRef: clone(mechanismDecisionRef),
        sourcePlanRef: clone(sourcePlanRef)
      } : {}),
      designDnaAuthority: platform === "xiaohongshu" ? clone(project.designDnaAuthority) : null,
      input: clone(project.platformInputs?.[platform] || {})
    });
    if (platform === "xiaohongshu" && sourcePlanRef) {
      brief = {
        ...brief,
        contentMechanismDecisionRef: clone(mechanismDecisionRef),
        sourcePlanRef: clone(sourcePlanRef)
      };
    }
    assertPlatformBrief(brief, platform, masterRef, platform === "xiaohongshu" ? project.designDnaAuthority : null);
  } catch (error) {
    if (error?.code === "CROSS_PLATFORM_AUTHORITY_FORBIDDEN") throw error;
    throw recoverableError(error, "outline", platform, { id: "platform_brief" });
  }
  const briefRef = ref(brief.id, brief);
  const planInput = {
    platform,
    sourcePlan,
    sharedContentMasterRef: masterRef,
    options: project.skillExecutionOptions?.[platform] || {},
    serverFeatureFlags,
    createdAt
  };
  const canonicalPlan = buildUnifiedPlatformSkillExecutionPlan(planInput);
  const plan = typeof dependencies.buildPlatformExecutionPlan === "function"
    ? await dependencies.buildPlatformExecutionPlan(clone(canonicalPlan), clone(planInput))
    : canonicalPlan;
  assertPlanCompleteness(plan, canonicalPlan);
  const records = [];
  const outputs = {};
  const context = {
    activeStrategySnapshotRef: project.activeStrategySnapshotRef,
    designDnaSnapshotRef: project.designDnaSnapshotRef,
    sharedContentMasterRef: masterRef,
    platformBriefRef: briefRef,
    writerContext: clone(project.writerContexts?.[platform]),
    confirmations: project.confirmations?.[platform] || {}
  };
  if (platform === "xiaohongshu" && resolveSkillExecutionPlanGraphMode(plan) === XHS_ATOMIC_GRAPH_MODE) {
    const atomic = await runAtomicXhsGraph({ project, master, masterRef, mechanismDecision, mechanismDecisionRef, sourcePlan, sourcePlanRef, brief, briefRef, plan, dependencies, context, records, outputs, planningOnly });
    if (planningOnly) return {
      platform, accountId: project.accounts[platform], brief, briefRef, plan: atomic.plan, planHash: atomic.planHash,
      outputs, skillRecords: records, outline: clone(atomic.outline)
    };
    return {
      platform,
      accountId: project.accounts[platform],
      brief,
      briefRef,
      plan: atomic.plan,
      planHash: atomic.planHash,
      outputs,
      skillRecords: records,
      xhsAtomicArtifacts: {
        contentMechanismDecisionRef: clone(mechanismDecisionRef),
        sourcePlanRef: clone(sourcePlanRef),
        postCopy: clone(outputs.xhs_post_copy),
        finalTitleBinding: clone(outputs.xhs_final_title_binding),
        carouselPlan: clone(outputs.xhs_carousel),
        visualAssetPlan: clone(outputs.xhs_visual_assets),
        traceability: clone(outputs.xhs_traceability),
        preflightReport: clone(outputs.xhs_preflight),
        package: clone(outputs.xhs_package)
      },
      platformRunRef: {
        schemaVersion: "1.0",
        contract: UNIFIED_CONTENT_CONTRACTS.platformRunRef,
        id: atomic.platformRunRef.id,
        hash: atomic.platformRunRef.hash,
        platform,
        accountId: project.accounts[platform],
        sharedContentMasterRef: clone(masterRef),
        platformBriefRef: briefRef,
        outlineRef: ref(atomic.outline.outline_id || atomic.outline.id || `outline:${project.id}:${platform}`, atomic.outline),
        writerInvocationRef: ref(atomic.writer.id || `xhs-package:${project.id}`, atomic.writer),
        candidateRefs: [],
        finalVersionRef: null
      }
    };
  }
  for (const step of plan.steps) {
    if (!step.enabled || ["skipped", "waiting_condition", "completed"].includes(step.state)) continue;
    if (step.kind === "binding") continue;
    if (step.kind === "service") {
      outputs[step.id] = await executeServiceStep({ step, platform, context: { ...context, outputs }, dependencies });
      continue;
    }
    if (["write-xhs-content", "write-wechat-article"].includes(step.capability)) {
      const writerContextBase = clone(project.writerContexts?.[platform]);
      if (!writerContextBase) fail("UNIFIED_WRITER_CONTEXT_REQUIRED", `Writer context is required for ${platform}`);
      delete writerContextBase.writerContextHash;
      writerContextBase.authority_refs = {
        ...writerContextBase.authority_refs,
        sharedContentMasterRef: clone(masterRef),
        platformBriefRef: clone(briefRef),
        confirmedOutlineRef: ref(outputs.outline?.outline_id || outputs.outline?.id, outputs.outline)
      };
      context.writerContext = createUnifiedWriterContext(writerContextBase);
    }
    let stepInput;
    try {
      stepInput = skillInputForStep({ step, platform, context, outputs, master, brief });
    } catch (error) {
      throw recoverableError(error, stageForStep(step), platform, step);
    }
    outputs[step.id] = await executePlannedStep({
      step,
      plan,
      platform,
      dependencies,
      authorizationMode,
      records,
      input: stepInput
    });
    if (planningOnly && step.id === "outline") break;
  }
  const outline = outputs.outline;
  if (planningOnly) {
    if (!outline) throw recoverableError({ code: "OUTLINE_OUTPUT_MISSING" }, "outline", platform, { id: "outline" });
    return { platform, accountId: project.accounts[platform], brief, briefRef, plan, planHash: hashUnifiedContent(plan), outputs, skillRecords: records, outline: clone(outline) };
  }
  const writer = outputs.platform_writer;
  if (!outline) throw recoverableError({ code: "OUTLINE_OUTPUT_MISSING" }, "outline", platform, { id: "outline" });
  if (!writer) throw recoverableError({ code: "WRITER_OUTPUT_MISSING" }, "writer", platform, { id: "platform_writer" });
  return {
    platform,
    accountId: project.accounts[platform],
    brief,
    briefRef,
    plan,
    planHash: hashUnifiedContent(plan),
    outputs,
    skillRecords: records,
    platformRunRef: {
      schemaVersion: "1.0",
      contract: UNIFIED_CONTENT_CONTRACTS.platformRunRef,
      id: `platform_run:${project.id}:${platform}`,
      hash: hashUnifiedContent({ projectId: project.id, platform, briefRef, masterRef, records }),
      platform,
      accountId: project.accounts[platform],
      sharedContentMasterRef: clone(masterRef),
      platformBriefRef: briefRef,
      outlineRef: ref(outline.id || `outline:${project.id}:${platform}`, outline),
      writerInvocationRef: ref(writer.invocationId || writer.id || `writer:${project.id}:${platform}`, writer),
      candidateRefs: Array.isArray(writer.candidates) ? writer.candidates.map((item, index) => ref(item.id || `candidate:${index + 1}`, item)) : [],
      finalVersionRef: null
    }
  };
}

async function orchestrate(input, dependencies, authorizationMode, compatibilityToken = null, options = {}) {
  assertDependencies(dependencies);
  const serverFeatureFlags = captureTrustedFeatureFlags(dependencies);
  const project = clone(input?.project);
  assertProjectInput(project);
  if (authorizationMode === "compatibility" && compatibilityToken !== COMPATIBILITY_TOKEN) {
    fail("LEGACY_COMPATIBILITY_ADAPTER_REQUIRED", "compatibility mode is available only through the explicit legacy adapter");
  }
  const atomicGraphEnabled = serverFeatureFlags.unifiedContentXhsAtomicGraphV1 === true;
  const sourcePlan = atomicGraphEnabled
    ? deepFreeze(clone(input.sourcePlan || null))
    : input.sourcePlan || null;
  const mechanismDecision = clone(input.mechanismDecision || input.sourcePlan?.mechanismDecision);
  let mechanismDecisionRef;
  let sourcePlanRef = null;
  if (atomicGraphEnabled) {
    const binding = assertAtomicMechanismBinding(project, mechanismDecision, sourcePlan);
    mechanismDecisionRef = binding.decisionRef;
    sourcePlanRef = { id: `source_plan:${project.id}`, hash: hashUnifiedContent(sourcePlan) };
  } else {
    assertMechanismBinding(project, mechanismDecision);
    mechanismDecisionRef = { id: mechanismDecision.id, hash: mechanismDecision.decisionHash };
  }
  const createdAt = dependencies.now?.() || project.createdAt || new Date().toISOString();
  const sharedBasePlan = buildSkillExecutionPlan({
    platform: "xiaohongshu",
    sourcePlan,
    options: project.skillExecutionOptions?.xiaohongshu || {},
    serverFeatureFlags
  });
  const sharedMasterStep = clone(sharedBasePlan.steps.find((step) => step.id === "content_master"));
  if (!sharedMasterStep) fail("SKILL_STEP_NOT_PLANNED", "shared content master Skill is missing from execution plan");
  if (!sharedMasterStep.enabled || ["waiting_condition", "blocked"].includes(sharedMasterStep.state)) {
    throw recoverableError({ code: "SHARED_MASTER_PRECONDITION_PENDING" }, "master", null, sharedMasterStep);
  }
  const sharedExecutionPlan = {
    schemaVersion: "1.0",
    kind: "UnifiedSharedSkillExecutionPlan",
    authorization: { mode: "strict", compatibilityAdapterRequired: true },
    steps: [sharedMasterStep],
    createdAt
  };
  const masterInput = {
    project: clone(project),
    activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef),
    mechanismDecision: clone(mechanismDecision),
    sourcePlan: clone(sourcePlan),
    ...(project.structureIntent ? { structureIntent: clone(project.structureIntent) } : {}),
    ...(sourcePlanRef ? { mechanismDecisionRef: clone(mechanismDecisionRef), sourcePlanRef: clone(sourcePlanRef) } : {}),
    input: clone(input.masterInput || {})
  };
  let master;
  try {
    master = await dependencies.buildSharedContentMaster(masterInput, {
      step: clone(sharedMasterStep),
      executionPlan: clone(sharedExecutionPlan),
      planAuthorization: authorizationMode
    });
  } catch (error) {
    throw recoverableError(error, "master", null, { id: "content_master", capability: "build-content-master" });
  }
  const masterRef = sharedMasterRef(master);
  const sharedSkillRecords = [{
    schemaVersion: "1.0",
    platform: "shared",
    stepId: sharedMasterStep.id,
    capability: sharedMasterStep.capability,
    stage: "master",
    required: true,
    status: "completed",
    planAuthorization: authorizationMode,
    inputContract: sharedMasterStep.inputContract,
    outputContract: sharedMasterStep.outputContract,
    dependsOn: clone(sharedMasterStep.dependsOn),
    executionPlanHash: hashUnifiedContent(sharedExecutionPlan),
    inputHash: hashUnifiedContent(masterInput),
    outputHash: masterRef.hash
  }];
  const platformRuns = [];
  const executionPlatforms = options.materializationPlatforms || PLATFORMS;
  for (const platform of executionPlatforms) {
    platformRuns.push(await runPlatform({
      platform,
      project,
      master,
      masterRef,
      mechanismDecision,
      mechanismDecisionRef,
      sourcePlan,
      sourcePlanRef,
      dependencies,
      authorizationMode,
      createdAt,
      serverFeatureFlags,
      planningOnly: options.planningOnly === true
    }));
  }
  if (options.planningOnly === true) {
    const planningBase = {
      schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", id: `staged-planning:${project.id}`,
      projectId: project.id, companyId: project.companyId, activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef),
      sharedContentMaster: clone(master), sharedContentMasterRef: clone(masterRef),
      sharedSkillRecords: clone(sharedSkillRecords),
      platformRuns: platformRuns.map((item) => ({
        platform: item.platform, accountId: item.accountId, brief: clone(item.brief), briefRef: clone(item.briefRef),
        outline: clone(item.outline), plan: clone(item.plan), planHash: item.planHash, skillRecords: clone(item.skillRecords)
      })),
      createdAt
    };
    return deepFreeze({ ...planningBase, planningHash: hashUnifiedContent(planningBase) });
  }
  const contentProject = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: UNIFIED_CONTENT_CONTRACTS.contentProject,
    id: project.id,
    companyId: project.companyId,
    contentOpportunityRef: clone(project.contentOpportunityRef),
    activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef),
    sharedContentMasterRef: clone(masterRef),
    platformRuns: platformRuns.map((item) => item.platformRunRef),
    state: "candidate_ready",
    createdAt,
    projectHash: ""
  }, "projectHash");
  validateContentProject(contentProject);
  const snapshot = withUnifiedContentHash({
    schemaVersion: "1.0",
    kind: "UnifiedContentOrchestrationSnapshot",
    entryMode: authorizationMode === "strict" ? "native_strict" : "legacy_compatibility",
    authorizationMode,
    contentProject,
    activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef),
    contentMechanismDecisionRef: clone(mechanismDecisionRef),
    ...(sourcePlanRef ? { frozenSourcePlanRef: clone(sourcePlanRef) } : {}),
    sharedContentMaster: clone(master),
    sharedContentMasterRef: clone(masterRef),
    sharedExecutionPlan,
    sharedExecutionPlanHash: hashUnifiedContent(sharedExecutionPlan),
    sharedSkillRecords,
    platformRuns: platformRuns.map((item) => ({
      platform: item.platform,
      accountId: item.accountId,
      platformBrief: clone(item.brief),
      platformBriefRef: clone(item.briefRef),
      executionPlan: clone(item.plan),
      executionPlanHash: item.planHash,
      skillRecords: clone(item.skillRecords),
      platformRunRef: clone(item.platformRunRef),
      ...(item.xhsAtomicArtifacts ? { xhsAtomicArtifacts: clone(item.xhsAtomicArtifacts) } : {})
    })),
    legacyProjection: authorizationMode === "compatibility" ? clone(input.legacyProjection) : null,
    stateBindings: {
      strategyHash: project.activeStrategySnapshotRef.hash,
      mechanismDecisionHash: mechanismDecision.decisionHash,
      sharedContentMasterHash: masterRef.hash,
      platformBriefHashes: Object.fromEntries(platformRuns.map((item) => [item.platform, item.briefRef.hash])),
      executionPlanHashes: Object.fromEntries(platformRuns.map((item) => [item.platform, item.planHash])),
      skillRecordHashes: {
        shared: hashUnifiedContent(sharedSkillRecords),
        ...Object.fromEntries(platformRuns.map((item) => [item.platform, hashUnifiedContent(item.skillRecords)]))
      }
    },
    state: "candidate_ready",
    createdAt,
    snapshotHash: ""
  }, "snapshotHash");
  return snapshot;
}

export function runUnifiedContentOrchestration(input, dependencies) {
  return orchestrate(input, dependencies, "strict");
}

export function runUnifiedStagedXhsMaterialization(input, dependencies) {
  return orchestrate(input, dependencies, "strict", null, { materializationPlatforms: ["xiaohongshu"] });
}

export function runUnifiedStagedContentPlanning(input, dependencies, options = {}) {
  const targetPlatform = options.targetPlatform;
  const materializationPlatforms = targetPlatform === "xiaohongshu" || targetPlatform === "wechat"
    ? [targetPlatform]
    : undefined;
  return orchestrate(input, dependencies, "strict", null, { planningOnly: true, materializationPlatforms });
}

export function runLegacyCompatibleUnifiedContentOrchestration(input, dependencies) {
  validateLegacyUnifiedContentProjection(input?.legacyProjection);
  return orchestrate(input, dependencies, "compatibility", COMPATIBILITY_TOKEN);
}

/**
 * Default-off Atomic WeChat execution boundary. The controlled executor owns the
 * actual Skill call and its first-party Output Fact; this orchestrator creates
 * the formal invocation before that call and bridges only the exact returned
 * evidence into the immutable WeChat commit.
 */
export async function runUnifiedAtomicWechatCommitOrchestration(input, dependencies) {
  const plan = deepFreeze(clone(input?.executionPlan));
  const expected = [
    ["platform_writer", "write-wechat-article"],
    ["wechat_content_review", "review-wechat-article"],
    ["image_plan", "plan-wechat-images"]
  ];
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length !== expected.length
    || expected.some(([stepId, capability], index) => {
      const step = plan.steps[index];
      return step?.id !== stepId || step?.capability !== capability || step.kind !== "skill" || step.enabled !== true
        || step.required !== true || !Array.isArray(step.dependsOn)
        || (index > 0 && !step.dependsOn.includes(expected[index - 1][0]));
    })) fail("UNIFIED_ATOMIC_WECHAT_PLAN_INVALID", "Atomic WeChat plan must authorize exactly the three ordered required Skills");
  if (typeof dependencies?.executeSkillStep !== "function" || typeof dependencies?.getControlledOutputFact !== "function") {
    fail("UNIFIED_ATOMIC_WECHAT_CONTROLLED_EXECUTOR_REQUIRED", "Atomic WeChat requires a controlled Skill executor and its evidence resolver");
  }
  const authorityInputs = deepFreeze(clone(input.authorityInputs));
  const identityDraft = {
    id: input.project.id, companyId: input.project.companyId,
    contentOpportunityRef: clone(input.project.contentOpportunityRef), activeStrategySnapshotRef: clone(input.project.activeStrategySnapshotRef)
  };
  const contentProjectIdentity = deepFreeze({ ...identityDraft, identityHash: hashUnifiedContent(identityDraft) });
  const contentProjectRef = { id: contentProjectIdentity.id, hash: contentProjectIdentity.identityHash };
  const master = authorityInputs.sharedContentMaster;
  const masterRef = { id: master.id, hash: hashUnifiedContent(master) };
  const brief = authorityInputs.platformBrief;
  const outline = authorityInputs.confirmedOutline;
  const writerContext = authorityInputs.writerContext;
  const planHash = hashUnifiedContent(plan);
  const platformRunRef = ref(`platform_run:${input.project.id}:wechat`, {
    projectId: input.project.id, platform: "wechat", masterRef,
    briefRef: { id: brief.id, hash: hashUnifiedContent(brief) },
    outlineRef: { id: outline.outline_id || outline.id, hash: hashUnifiedContent(outline) }, planHash
  });
  const sourcePlanRef = clone(input.sourcePlanRef);
  const refs = {
    contentOpportunityRef: clone(input.project.contentOpportunityRef), activeStrategySnapshotRef: clone(input.project.activeStrategySnapshotRef),
    contentProjectRef, platformRunRef, sharedContentMasterRef: masterRef,
    mechanismDecisionRef: { id: authorityInputs.mechanismDecision.id, hash: authorityInputs.mechanismDecision.decisionHash },
    sourcePlanRef, platformBriefRef: { id: brief.id, hash: hashUnifiedContent(brief) },
    confirmedOutlineRef: { id: outline.outline_id || outline.id, hash: hashUnifiedContent(outline) },
    writerContextRef: { id: input.writerContextRefId, hash: writerContext.writerContextHash }
  };
  const authorityBinding = createExecutionAuthorityBinding({
    family: "atomic_v2", companyId: input.project.companyId, accountId: input.project.accountId,
    refs: Object.entries(refs).map(([role, value]) => ({ role, ref: value }))
  });
  const common = {
    platform: "wechat_official_account", content_master: clone(master.contentMaster || master),
    platform_brief: clone(brief), confirmed_outline: clone(outline), writer_context: clone(writerContext)
  };
  let article = null;
  let review = null;
  const skillFacts = {};
  const roles = ["article", "articleReview", "imagePlan"];
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const authorizedAssets = clone(brief?.brief?.authorized_assets || brief?.authorized_assets || []);
    const stepInput = index === 0 ? common : index === 1
      ? { ...common, mode: "report_only", article: clone(article) }
      : { ...common, article: clone(article), article_review: clone(review), authorized_assets: authorizedAssets,
        image_runtime: clone(authorityInputs.imageRuntimeCapability || projectWechatImageRuntimeCapability(authorizedAssets)) };
    const inputHash = hashUnifiedContent(stepInput);
    const invocation = createSkillActivityInvocation({
      id: `atomic_wechat_invocation:${step.id}:${inputHash.slice(0, 16)}`,
      skill: { name: step.capability, version: step.outputContract },
      inputRef: { id: `atomic_wechat_input:${step.id}`, hash: inputHash }, authorityBinding, planHash,
      attemptPolicy: DEFAULT_ATOMIC_ATTEMPT_POLICY
    });
    const checkpoint = typeof dependencies.resolveStepCheckpoint === "function"
      ? await dependencies.resolveStepCheckpoint({
        platform: "wechat", step: clone(step), input: clone(stepInput), inputHash,
        executionPlan: clone(plan), planHash, invocation: clone(invocation)
      })
      : null;
    let verifiedDomainOutput;
    let controlledOutputFact;
    if (checkpoint) {
      controlledOutputFact = clone(checkpoint.outputFact);
      verifiedDomainOutput = clone(step.capability === "plan-wechat-images"
        ? controlledOutputFact?.verifiedDomainOutput
        : controlledOutputFact?.runtimeOutput?.data);
    } else {
      verifiedDomainOutput = await dependencies.executeSkillStep({
        platform: "wechat", step: clone(step), input: clone(stepInput), executionPlan: clone(plan), atomicInvocation: clone(invocation)
      });
      controlledOutputFact = await dependencies.getControlledOutputFact({
        platform: "wechat", step: clone(step), invocation: clone(invocation)
      });
    }
    const expectedDomainOutput = step.capability === "plan-wechat-images"
      ? controlledOutputFact?.verifiedDomainOutput
      : controlledOutputFact?.runtimeOutput?.data;
    if (hashUnifiedContent(verifiedDomainOutput) !== hashUnifiedContent(expectedDomainOutput)) {
      fail("UNIFIED_ATOMIC_WECHAT_CONTROLLED_OUTPUT_MISMATCH", `Controlled output for ${step.capability} does not match its committed fact`);
    }
    if (!checkpoint && typeof dependencies.persistStepCheckpoint === "function") {
      await dependencies.persistStepCheckpoint({
        platform: "wechat", step: clone(step), inputHash, planHash,
        invocation: clone(invocation), outputFact: clone(controlledOutputFact)
      });
    }
    const fact = createUnifiedAtomicWechatSkillFactFromControlled({ ordinal: index + 1, step, invocation, controlledOutputFact });
    skillFacts[roles[index]] = fact;
    if (index === 0) article = compileWechatRuntimeOutput(controlledOutputFact.runtimeOutput, {
      sourceContentMaster: master.contentMaster || master,
      sourceSkillInput: stepInput
    });
    if (index === 1) review = clone(verifiedDomainOutput);
  }
  const writerInvocation = skillFacts.article.invocation;
  const formalMasterRef = {
    schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.sharedContentMasterRef,
    ...masterRef, authorityContract: master.contract, authorityType: "shared_content_master"
  };
  const platformRun = {
    schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.platformRunRef,
    id: platformRunRef.id, hash: platformRunRef.hash, platform: "wechat", accountId: input.project.accountId,
    sharedContentMasterRef: formalMasterRef, platformBriefRef: refs.platformBriefRef, outlineRef: refs.confirmedOutlineRef,
    writerInvocationRef: { id: writerInvocation.id, hash: writerInvocation.invocationHash }, candidateRefs: [], finalVersionRef: null
  };
  const contentProject = withUnifiedContentHash({
    schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.contentProject,
    id: input.project.id, companyId: input.project.companyId,
    contentOpportunityRef: clone(input.project.contentOpportunityRef), activeStrategySnapshotRef: clone(input.project.activeStrategySnapshotRef),
    sharedContentMasterRef: formalMasterRef, platformRuns: [platformRun], state: "generating",
    createdAt: input.createdAt, projectHash: ""
  }, "projectHash");
  const commit = createUnifiedAtomicWechatContentCommit({
    id: input.commitId, idempotencyKey: input.idempotencyKey, contentProjectIdentity, contentProject,
    authorityBinding, authorityInputs, skillFacts
  });
  return deepFreeze({
    schemaVersion: "1.0", contract: "UnifiedAtomicWechatOrchestrationResult@1.0",
    executionPlan: clone(plan), platformRunRef: clone(platformRun), commit
  });
}
