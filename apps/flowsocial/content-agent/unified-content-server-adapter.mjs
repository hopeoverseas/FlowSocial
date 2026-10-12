import { runUnifiedContentOrchestration, runUnifiedStagedContentPlanning, runUnifiedStagedXhsMaterialization } from "./unified-content-orchestrator.mjs";
import {
  createUnifiedWriterContext,
  hashUnifiedContent,
  validateContentMechanismDecision,
  validateContentMechanismDecisionV2,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";
import {
  deriveUnifiedPlatformCandidate,
  materializeUnifiedSkillRuntimeOutput,
  validateContentMasterSemanticSpine,
  validateContentStructureIntent
} from "./unified-skill-output-contracts.mjs";
import { createUnifiedAtomicSkillActivityExecutionPort, createUnifiedSkillActivityExecutor } from "./unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "./unified-skill-evidence-compiler.mjs";
import { appendUnifiedContentArtifact, getUnifiedContentArtifactState, projectUnifiedContentArtifacts } from "./unified-content-artifact-store.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { runWechatPreuploadArtifactRuntime } from "./wechat-preupload-artifact-runtime.mjs";
import { hashWechatArtifactValue, projectWechatImageRuntimeCapability } from "./wechat-image-plan-adapter.mjs";
import { projectUnifiedWechatCurrentProduct } from "./unified-wechat-production-control.mjs";
import { resolveConfirmedDesignDnaAuthority } from "./unified-content-prerequisite-store.mjs";
import { resolveFrozenContentSourcePlanRefs } from "./source-planner.mjs";
import { compileUnifiedAtomicFactGraph } from "./unified-atomic-fact-graph-compiler.mjs";
import { compileUnifiedAtomicCandidateUsage } from "./unified-atomic-candidate-compiler.mjs";
import {
  createUnifiedAtomicContentCommitStore,
  createUnifiedAtomicContentCommitV2
} from "./unified-atomic-content-commit-store.mjs";
import {
  assertUnifiedAtomicProductProjectionAppendable,
  getUnifiedAtomicContentProductProjection,
  listUnifiedAtomicContentProductProjections,
  projectUnifiedAtomicContentCommit
} from "./unified-atomic-product-projection.mjs";
import {
  appendUnifiedAtomicWechatMaterialization,
  getUnifiedAtomicMultiplatformProduct,
  listUnifiedAtomicMultiplatformProducts,
  projectUnifiedAtomicWechatPreuploadArtifact,
  validateUnifiedAtomicMultiplatformArtifactProjection
} from "./unified-atomic-multiplatform-product.mjs";
import {
  appendUnifiedWechatStageCheckpoint,
  resolveUnifiedWechatStageCheckpoint
} from "./unified-wechat-stage-checkpoint.mjs";

const PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);
const trustedPersistedPlanningMaterializers = new WeakMap();

function fail(code, message, statusCode = 409, details = null) {
  throw Object.assign(new Error(message || code), { code, statusCode, details });
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code, 400);
  return value.trim();
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function collectKeyValues(value, key, results = []) {
  if (!value || typeof value !== "object") return results;
  if (Object.hasOwn(value, key)) results.push(value[key]);
  for (const child of Object.values(value)) collectKeyValues(child, key, results);
  return results;
}

function uniqueNonemptyValue(value, key, code) {
  const values = [...new Set(collectKeyValues(value, key).filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
  if (values.length !== 1) fail(code, code);
  return values[0];
}

function projectedCreativeMechanism(platform, selectedMechanism) {
  const mappings = {
    hotspot: { xiaohongshu: "trend_bridge", wechat: "trend_bridge" },
    knowledge: { xiaohongshu: "search_answer", wechat: "framework" },
    blueprint: { xiaohongshu: "checklist", wechat: "framework" },
    strategy_only: { xiaohongshu: "checklist", wechat: "framework" },
    user_material: { xiaohongshu: "case_reconstruction", wechat: "case_reconstruction" }
  };
  return mappings[selectedMechanism]?.[platform] || null;
}

function resolveWriterSourceMechanism(mechanismDecision) {
  if (mechanismDecision?.contract === "ContentMechanismDecision@1.0") {
    validateContentMechanismDecision(mechanismDecision);
    return mechanismDecision.selectedMechanism;
  }
  if (mechanismDecision?.contract === "ContentMechanismDecision@2.0") {
    validateContentMechanismDecisionV2(mechanismDecision);
    const primary = mechanismDecision.mechanisms.filter((item) => item.role === "primary" && item.evaluationStatus === "evaluated");
    if (primary.length !== 1) fail("UNIFIED_WRITER_CONTEXT_PRIMARY_SOURCE_MECHANISM_REQUIRED");
    return primary[0].mechanism;
  }
  fail("UNIFIED_WRITER_CONTEXT_MECHANISM_DECISION_VERSION_UNSUPPORTED");
}

export function resolveUnifiedWriterCreativeMechanism(platform, mechanismDecision, explicitCreativeMechanism = null) {
  const sourceMechanism = resolveWriterSourceMechanism(mechanismDecision);
  const projected = projectedCreativeMechanism(platform, sourceMechanism);
  if (!projected) fail("UNIFIED_WRITER_CONTEXT_PRIMARY_SOURCE_MECHANISM_UNSUPPORTED");
  return typeof explicitCreativeMechanism === "string" && explicitCreativeMechanism.trim()
    ? explicitCreativeMechanism.trim()
    : projected;
}

export function projectedJourneyStage(matrixRole) {
  const role = String(matrixRole || "").toLowerCase();
  if (role === "primary" || role.includes("discovery") || role.includes("触达") || role.includes("发现") || role.includes("主运营")) return "discover";
  if (role.includes("conversion") || role.includes("action") || role.includes("转化") || role.includes("承接")) return "convert";
  if (role.includes("authority") || role.includes("trust") || role.includes("validation") || role.includes("权威") || role.includes("信任") || role.includes("验证")) return "trust";
  if (role.includes("solution") || role.includes("product") || role.includes("方案") || role.includes("产品") || role.includes("协同") || role.includes("supporting")) return "understand";
  return null;
}

export function materializeUnifiedWriterContexts(store, project, mechanismDecision, prerequisiteBinding) {
  const opportunities = (store.unifiedContentOpportunities || []).filter((item) => item?.id === project?.contentOpportunityRef?.id
    && item?.opportunityHash === project?.contentOpportunityRef?.hash && item?.companyId === project?.companyId);
  if (opportunities.length !== 1) fail("UNIFIED_WRITER_CONTEXT_OPPORTUNITY_AUTHORITY_REQUIRED");
  const opportunity = opportunities[0];
  if (typeof opportunity.topic !== "string" || !opportunity.topic.trim() || typeof opportunity.contentObjective !== "string" || !opportunity.contentObjective.trim()) {
    fail("UNIFIED_WRITER_CONTEXT_OPPORTUNITY_SEMANTICS_REQUIRED");
  }
  const intentProfileId = prerequisiteBinding?.projectInputRef?.id;
  if (typeof intentProfileId !== "string" || !intentProfileId.trim()) fail("UNIFIED_WRITER_CONTEXT_PROJECT_INPUT_AUTHORITY_REQUIRED");
  const contexts = {};
  for (const [platform, outputPlatform] of [["xiaohongshu", "xiaohongshu"], ["wechat", "wechat_official_account"]]) {
    const accountId = project?.accounts?.[platform];
    const accountAuthority = Array.isArray(store.accounts) ? store.accounts : store.socialAccounts;
    const accounts = (accountAuthority || []).filter((item) => item?.id === accountId && item?.companyId === project.companyId && item?.platform === platform);
    if (accounts.length !== 1) fail("UNIFIED_WRITER_CONTEXT_ACCOUNT_AUTHORITY_REQUIRED");
    const account = accounts[0];
    const strategies = (store.accountStrategySnapshots || []).filter((item) => item?.status === "active"
      && (item?.socialAccountId === accountId || item?.accountId === accountId)
      && (!item?.companyId || item.companyId === project.companyId));
    if (strategies.length !== 1) fail("UNIFIED_WRITER_CONTEXT_ACCOUNT_STRATEGY_REQUIRED");
    const strategy = strategies[0];
    const matrixRole = uniqueNonemptyValue(strategy.payload || strategy, "matrixRole", "UNIFIED_WRITER_CONTEXT_MATRIX_ROLE_REQUIRED");
    const identityType = account.accountIdentity?.subjectType || account.subjectType;
    let subjectType;
    let accountMode;
    let trustSource;
    if (identityType === "company_official") {
      subjectType = "company"; accountMode = "official"; trustSource = "institution";
    } else if (identityType === "founder_ip") {
      const trustSignals = [...(account.accountIdentity?.trustSources || []), ...collectKeyValues(strategy.payload || strategy, "trustSources").flat()];
      if (!trustSignals.includes("founder_experience")) fail("UNIFIED_WRITER_CONTEXT_FOUNDER_TRUST_REQUIRED");
      subjectType = "founder"; accountMode = "founder_ip"; trustSource = "experience";
    } else fail("UNIFIED_WRITER_CONTEXT_IDENTITY_UNSUPPORTED");
    const strategyPayload = strategy.payload || strategy;
    const explicitDifferentiation = strategyPayload.differentiationAngle || strategyPayload.matrixStrategy?.differentiationAngle;
    const platformRole = strategyPayload.platformPlaybook?.role || strategyPayload.roleLabel || strategyPayload.matrixStrategy?.platformRole;
    const differentiationAuthority = typeof explicitDifferentiation === "string" && explicitDifferentiation.trim()
      ? explicitDifferentiation.trim()
      : typeof platformRole === "string" && platformRole.trim()
        ? `${matrixRole}:${platformRole.trim()}`
        : null;
    if (!differentiationAuthority) fail("UNIFIED_WRITER_CONTEXT_DIFFERENTIATION_AUTHORITY_REQUIRED");
    const creativeMechanism = resolveUnifiedWriterCreativeMechanism(platform, mechanismDecision, strategyPayload.creativeMechanism);
    const journeyStage = strategyPayload.journeyStage || projectedJourneyStage(matrixRole);
    if (!creativeMechanism) fail("UNIFIED_WRITER_CONTEXT_CREATIVE_MECHANISM_REQUIRED");
    if (!journeyStage) fail("UNIFIED_WRITER_CONTEXT_JOURNEY_STAGE_REQUIRED");
    const prohibitedOverlap = strategyPayload.prohibitedOverlap || strategyPayload.matrixStrategy?.prohibitedOverlap || [];
    contexts[platform] = createUnifiedWriterContext({
      schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: outputPlatform, account_id: accountId,
      topic_id: opportunity.id, intent_profile_id: intentProfileId, content_purpose_id: opportunity.contentObjective,
      account_context: { subject_type: subjectType, account_mode: accountMode, matrix_role: matrixRole, trust_source: trustSource },
      creative_mechanism: creativeMechanism, journey_stage: journeyStage, coordination_mode: "coordinated",
      matrix_coordination: {
        shared_campaign_topic_id: project.contentOpportunityRef.id,
        differentiation_angle: differentiationAuthority,
        prohibited_overlap: structuredClone(prohibitedOverlap)
      },
      authority_refs: {
        activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef), contentOpportunityRef: clone(project.contentOpportunityRef),
        mechanismDecisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash },
        accountRef: { id: account.id, hash: hashUnifiedContent(account) }, accountStrategyRef: { id: strategy.id, hash: hashUnifiedContent(strategy) }
      }
    });
  }
  return contexts;
}

function defaultPlatformBrief({ platform, accountId, activeStrategySnapshotRef, sharedContentMasterRef, designDnaAuthority, input }) {
  if (platform === "xiaohongshu" && !designDnaAuthority?.snapshot) fail("UNIFIED_XHS_DESIGN_DNA_AUTHORITY_REQUIRED");
  return {
    schemaVersion: "1.0",
    contract: "UnifiedPlatformBrief@1.0",
    id: `platform_brief:${sharedContentMasterRef.id}:${platform}`,
    platform,
    accountId,
    authorityType: "shared_content_master",
    activeStrategySnapshotRef,
    sharedContentMasterRef,
    brief: platform === "xiaohongshu"
      ? { ...clone(input || {}), designDnaRef: clone(designDnaAuthority.ref), designDna: clone(designDnaAuthority.snapshot) }
      : clone(input || {})
  };
}

function defaultServiceExecutor({ platform, step, context }) {
  const outputs = context.outputs || {};
  if (step.service === "TitleContentConsistencyGate") {
    if (!outputs.title || !(outputs.platform_writer || outputs.xhs_post_copy)) fail("UNIFIED_CONTENT_TITLE_GATE_INPUT_MISSING", `${platform} title gate inputs are missing`);
    const balancedId = outputs.title.recommendations?.balanced;
    const matches = outputs.title.candidates?.filter((item) => item.title_id === balancedId) || [];
    if (matches.length !== 1 || typeof matches[0].title !== "string" || !matches[0].title.trim()) {
      fail("UNIFIED_CONTENT_TITLE_CONSISTENCY_FAILED", `${platform} balanced title recommendation is inconsistent`);
    }
    return {
      status: "passed",
      recommendation: "balanced",
      titleId: balancedId,
      title: matches[0].title,
      titleCandidateHash: hashUnifiedContent(matches[0]),
      titleOutputHash: hashUnifiedContent(outputs.title),
      completedContentHash: hashUnifiedContent(outputs.platform_writer || outputs.xhs_post_copy)
    };
  }
  if (step.service === "SchemaAndReferenceGate") {
    return { status: "passed", checkedOutputHash: hashUnifiedContent(outputs) };
  }
  if (step.service === "XhsHtmlRenderer") {
    return { status: "preview_ready", previewRef: { id: `xhs_preview:${hashUnifiedContent(outputs).slice(0, 16)}`, hash: hashUnifiedContent({ platform, outputs }) } };
  }
  if (step.service === "WechatHtmlFormatter") {
    return { status: "preview_ready", previewRef: { id: `wechat_preview:${hashUnifiedContent(outputs).slice(0, 16)}`, hash: hashUnifiedContent({ platform, outputs }) } };
  }
  if (step.service === "WechatHtmlValidator") {
    if (!outputs.format) fail("UNIFIED_CONTENT_WECHAT_FORMAT_REQUIRED", "Wechat format validation requires formatter output");
    return { status: "passed", formatHash: hashUnifiedContent(outputs.format) };
  }
  fail("UNIFIED_CONTENT_SERVICE_NOT_WIRED", `Service ${step.service} is not wired`, 501);
}

function candidateProjection(candidate) {
  return {
    ...clone(candidate),
    status: candidate.artifactState === "visual_artifacts_required"
      ? "visual_artifacts_required"
      : candidate.artifactState === "pre_upload_resource_required"
        ? "pre_upload_resource_required"
        : "candidate_ready",
    machineReview: "not_run",
    editorialReview: "not_reviewed",
    userSelection: "not_selected",
    promoted: false,
    deliveryReady: false,
    published: false,
    blockers: [...new Set([
      ...(candidate.blockers || []),
      "machine_review_not_passed",
      "editorial_review_not_passed",
      "user_not_selected",
      "version_not_promoted"
    ])]
  };
}

function reviewInputProjection(run, candidateRef, candidateSet) {
  return {
    platform: run.platform,
    platformRunRef: clone(run.platformRunRef),
    candidateRefs: [clone(candidateRef)],
    input: { candidateSet: clone(candidateSet) },
    inputHash: hashUnifiedContent(candidateSet),
    source: "verified_skill_output_facts",
    callerReviewInputsPolicy: "ignored",
    status: candidateSet.artifactState === "visual_artifacts_required"
      ? "awaiting_visual_artifacts"
      : "awaiting_machine_and_editorial_review"
  };
}

function deliveryPreview(run, candidates) {
  return {
    platform: run.platform,
    platformRunRef: clone(run.platformRunRef),
    candidateRefs: candidates.map((item) => clone(item.candidateRef)),
    status: "not_selected",
    deliveryReady: false,
    published: false,
    blockers: ["user_not_selected", "version_not_promoted"],
    binaryStored: false
  };
}

function canonicalTimestamp(value, code = "UNIFIED_STAGED_ATOMIC_TIME_INVALID") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) fail(code);
  return value;
}

function storedObjectMatchesRef(value, expectedRef) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !expectedRef?.id || !expectedRef?.hash) return false;
  const ids = [value.id, value.idempotencyKey, value.requestId, value.content_master_id].filter(Boolean);
  const hashes = [value.hash, value.decisionHash, value.opportunityHash, value.semanticHash, value.snapshotHash, value.planHash, hashUnifiedContent(value)].filter(Boolean);
  return ids.includes(expectedRef.id) && hashes.includes(expectedRef.hash);
}

function findStoredObjectByRef(store, expectedRef, collectionNames = null) {
  const names = collectionNames || Object.keys(store || {}).filter((key) => Array.isArray(store[key]));
  const matches = names.flatMap((name) => (Array.isArray(store?.[name]) ? store[name] : []))
    .filter((item) => storedObjectMatchesRef(item, expectedRef));
  if (matches.length !== 1) fail("UNIFIED_STAGED_ATOMIC_EXACT_AUTHORITY_REQUIRED", null, 409, { ref: clone(expectedRef), matches: matches.length });
  return clone(matches[0]);
}

function normalizedAtomicSourcePlan(orchestrationInput) {
  const sourcePlan = clone(orchestrationInput.sourcePlan);
  const frozenSourceRefs = resolveFrozenContentSourcePlanRefs(sourcePlan);
  sourcePlan.schemaVersion = "1.0";
  sourcePlan.contract = "SourcePlan@1.0";
  sourcePlan.id = `source_plan:${orchestrationInput.project.id}`;
  sourcePlan.frozenSourceRefs = clone(frozenSourceRefs);
  sourcePlan.sources = sourcePlan.sources.map((source) => ({
    ...source,
    sourceRef: clone(frozenSourceRefs.find((item) => source.candidateIds?.includes(item.id)) || source.sourceRef || null)
  }));
  return sourcePlan;
}

function resolveUnifiedStagedBootstrapAuthorityWithStrategy(store, input, activeStrategy) {
  const activeStrategyPayload = activeStrategy?.document || activeStrategy?.payload;
  if (!activeStrategyPayload || activeStrategy?.accountId !== input.companyId || activeStrategy?.status !== "active") {
    fail("UNIFIED_CONTENT_ACTIVE_STRATEGY_REQUIRED");
  }
  if ((activeStrategy.id || activeStrategy.snapshotId) !== input.activeStrategySnapshotRef.id
    || hashUnifiedContent(activeStrategyPayload) !== input.activeStrategySnapshotRef.hash) {
    fail("UNIFIED_CONTENT_ACTIVE_STRATEGY_MISMATCH");
  }
  const prerequisite = findStoredObjectByRef(store, input.prerequisiteRef, ["unifiedContentPrerequisiteRequests"]);
  const xhsAccount = findStoredObjectByRef(store, input.accounts.xiaohongshu, ["accounts", "socialAccounts"]);
  const wechatAccount = findStoredObjectByRef(store, input.accounts.wechat, ["accounts", "socialAccounts"]);
  if (xhsAccount.companyId !== input.companyId || xhsAccount.platform !== "xiaohongshu"
    || wechatAccount.companyId !== input.companyId || wechatAccount.platform !== "wechat") fail("UNIFIED_STAGED_ATOMIC_ACCOUNT_AUTHORITY_MISMATCH");
  const authoritySources = input.authorizationSourceRefs.map((item) => findStoredObjectByRef(store, item));
  const mechanismCandidates = [prerequisite.mechanismDecision, ...authoritySources]
    .filter((item) => item?.contract === "ContentMechanismDecision@2.0" || item?.contract === "ContentMechanismDecision@1.0");
  if (mechanismCandidates.length !== 1) fail("UNIFIED_STAGED_ATOMIC_MECHANISM_AUTHORITY_REQUIRED");
  const mechanismDecision = clone(mechanismCandidates[0]);
  const mechanismDecisionRef = { id: mechanismDecision.id, hash: mechanismDecision.decisionHash };
  if (prerequisite.mechanismDecisionRef && !sameRef(prerequisite.mechanismDecisionRef, mechanismDecisionRef)) fail("UNIFIED_STAGED_ATOMIC_MECHANISM_AUTHORITY_MISMATCH");
  const opportunity = findStoredObjectByRef(store, prerequisite.contentOpportunityRef, ["unifiedContentOpportunities"]);
  const designDnaAuthority = resolveConfirmedDesignDnaAuthority(store, {
    accountId: xhsAccount.id,
    requestedRef: prerequisite.designDnaSnapshotRef
  });
  const sourcePlanAuthority = authoritySources.find((item) => item?.contract === "SourcePlan@1.0");
  const selectedSourceRefs = clone(mechanismDecision.selectedSourceRefs || []);
  const sourcePlan = sourcePlanAuthority || {
    mode: mechanismDecision.selectedMechanism || mechanismDecision.mechanisms?.find((item) => item.role === "primary")?.mechanism || "strategy_only",
    sources: selectedSourceRefs.map((sourceRef) => ({ type: "authority_ref", candidateIds: [sourceRef.id], sourceRef }))
  };
  const structureIntent = input.structureIntent ? validateContentStructureIntent(input.structureIntent) : null;
  const project = {
    id: input.projectId, companyId: input.companyId, contentOpportunityRef: clone(prerequisite.contentOpportunityRef),
    activeStrategySnapshotRef: clone(input.activeStrategySnapshotRef), designDnaSnapshotRef: clone(designDnaAuthority.ref),
    ...(structureIntent ? { structureIntent: clone(structureIntent) } : {}),
    accounts: { xiaohongshu: xhsAccount.id, wechat: wechatAccount.id },
    platformInputs: {
      xiaohongshu: { topicIntent: clone(input.topicIntent) },
      wechat: { topicIntent: clone(input.topicIntent) }
    },
    confirmations: { xiaohongshu: {}, wechat: {} }
  };
  const bindingRefs = {
    activeStrategySnapshotRef: clone(input.activeStrategySnapshotRef), prerequisiteRef: clone(input.prerequisiteRef),
    accountRefs: clone(input.accounts), authorizationSourceRefs: clone(input.authorizationSourceRefs),
    ...(structureIntent ? { structureIntentRef: { id: structureIntent.id, hash: structureIntent.intentHash } } : {})
  };
  return {
    schemaVersion: "1.0", contract: "UnifiedStagedBootstrapServerAuthority@1.0", bindingRefs,
    prerequisite, opportunity, designDnaAuthority, authoritySources,
    orchestrationInput: { project, mechanismDecision, sourcePlan }
  };
}

export async function resolveUnifiedStagedBootstrapAuthority(store, input, dependencies = {}) {
  if (typeof dependencies.resolveActiveStrategySnapshot !== "function") fail("UNIFIED_CONTENT_ACTIVE_STRATEGY_RESOLVER_REQUIRED", null, 500);
  const activeStrategy = await dependencies.resolveActiveStrategySnapshot(input.companyId);
  return resolveUnifiedStagedBootstrapAuthorityWithStrategy(store, input, activeStrategy);
}

export function resolveUnifiedReconciliationDomainAuthority(store, record, dependencies = {}) {
  if (typeof dependencies.resolveActiveStrategySnapshot !== "function") {
    fail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_ACTIVE_STRATEGY_RESOLVER_REQUIRED", null, 500);
  }
  const input = {
    companyId: record?.companyId,
    projectId: record?.projectId,
    topicIntent: clone(record?.topicIntent),
    activeStrategySnapshotRef: clone(record?.authorityRefs?.activeStrategySnapshotRef),
    prerequisiteRef: clone(record?.authorityRefs?.prerequisiteRef),
    accounts: clone(record?.authorityRefs?.accountRefs),
    authorizationSourceRefs: clone(record?.authorityRefs?.authorizationSourceRefs),
    ...(record?.targetPlatform ? { targetPlatform: record.targetPlatform } : {}),
    ...(record?.structureIntent ? { structureIntent: clone(record.structureIntent) } : {})
  };
  const activeStrategy = dependencies.resolveActiveStrategySnapshot(input.companyId);
  if (activeStrategy && typeof activeStrategy.then === "function") {
    fail("UNIFIED_STAGED_ATOMIC_RECONCILIATION_ACTIVE_STRATEGY_RESOLVER_ASYNC_FORBIDDEN", null, 500);
  }
  return resolveUnifiedStagedBootstrapAuthorityWithStrategy(store, input, activeStrategy);
}

export async function planUnifiedStagedAtomicDualBootstrap(store, input, dependencies = {}) {
  const authority = await resolveUnifiedStagedBootstrapAuthority(store, input, dependencies);
  const orchestrationInput = clone(authority.orchestrationInput);
  const requestedProject = orchestrationInput.project;
  const prerequisite = authority.prerequisite;
  const writerContexts = materializeUnifiedWriterContexts(store, requestedProject, orchestrationInput.mechanismDecision, prerequisite);
  orchestrationInput.sourcePlan = normalizedAtomicSourcePlan(orchestrationInput);
  orchestrationInput.project.designDnaAuthority = clone(authority.designDnaAuthority);
  orchestrationInput.project.writerContexts = clone(writerContexts);
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const masterCheckpoint = dependencies.planningCheckpoint?.master || null;
  const executeRuntimeSkill = createUnifiedSkillActivityExecutor({
    generateText: dependencies.generateText, liveExecution: dependencies.liveExecution === true, evidenceCompiler,
    attemptObserver: dependencies.attemptObserver || null,
    runtimeOutputMaterializer: trustedPersistedPlanningMaterializers.get(store) || materializeUnifiedSkillRuntimeOutput
  });
  const executeAtomicSkillActivity = createUnifiedAtomicSkillActivityExecutionPort({
    generateText: dependencies.generateText, liveExecution: dependencies.liveExecution === true, evidenceCompiler
  });
  const serverFeatureFlags = Object.freeze({ unifiedContentXhsAtomicGraphV1: true, unifiedContentAtomicProductV1: true });
  const planning = await runUnifiedStagedContentPlanning(orchestrationInput, {
    now: dependencies.now, serverFeatureFlags,
    buildSharedContentMaster: async (masterInput, authorization) => {
      let master;
      if (masterCheckpoint) {
        const invocation = masterCheckpoint.invocation;
        const outputFact = masterCheckpoint.outputFact;
        const invocationBase = clone(invocation); delete invocationBase.executionRecordHash; delete invocationBase.invocationHash;
        const factBase = clone(outputFact); delete factBase.factHash;
        if (invocation?.platform !== "xiaohongshu" || invocation?.capability !== "build-content-master"
          || invocation.inputHash !== hashUnifiedContent(masterInput)
          || invocation.executionPlanHash !== hashUnifiedContent(authorization.executionPlan)
          || invocation.invocationHash !== hashUnifiedContent(invocationBase)
          || outputFact?.platform !== "shared" || outputFact?.capability !== "build-content-master"
          || outputFact.outputHash !== hashUnifiedContent(outputFact.runtimeOutput)
          || outputFact.factHash !== hashUnifiedContent(factBase)) fail("UNIFIED_PLANNING_MASTER_CHECKPOINT_INVALID");
        evidenceCompiler.restoreCompletedInvocation(masterCheckpoint);
        master = clone(outputFact.verifiedDomainOutput || outputFact.runtimeOutput?.data);
      } else master = await executeRuntimeSkill({ capability: authorization.step.capability, platform: "xiaohongshu", input: masterInput, step: authorization.step, executionPlan: authorization.executionPlan });
      const atomicMaster = clone(master?.contentMaster || master); delete atomicMaster.platform;
      return atomicMaster?.id && atomicMaster?.contract ? atomicMaster : { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: atomicMaster.content_master_id, ...atomicMaster };
    },
    buildPlatformBrief: defaultPlatformBrief,
    executeSkillStep: ({ platform, step, input: skillInput, executionPlan }) => executeRuntimeSkill({ capability: step.capability, platform, input: skillInput, step, executionPlan }),
    executeAtomicSkillActivity,
    executeServiceStep: defaultServiceExecutor
  }, { targetPlatform: input.targetPlatform || null });
  return { authority, planning, actualInvocations: evidenceCompiler.getActualInvocations(), outputFacts: evidenceCompiler.getSkillOutputFacts() };
}

function cachedPlanningGenerateText(planning, fallback) {
  return async (request, control = null) => {
    const capability = request?.skill_runtime?.skill_name;
    if (capability === "build-content-master") {
      return { mode: "real_offline_adapter", data: { status: "success", data: clone(planning.sharedContentMaster), warnings: [], blocked_reasons: [] } };
    }
    if (capability === "generate-content-outline") {
      const serialized = JSON.stringify(request);
      const platform = serialized.includes('"platform":"wechat_official_account"') || serialized.includes(":wechat") ? "wechat" : "xiaohongshu";
      const run = planning.platformRuns.find((item) => item.platform === platform);
      if (!run?.outline) fail("UNIFIED_STAGED_ATOMIC_PERSISTED_OUTLINE_REQUIRED");
      return { mode: "real_offline_adapter", data: { status: "ready", data: clone(run.outline), warnings: [], blocked_reasons: [] } };
    }
    return fallback(request, control);
  };
}

function normalizedPersistedMaster(value) {
  const master = clone(value?.contentMaster || value);
  if (!master || typeof master !== "object" || Array.isArray(master)) return null;
  delete master.platform;
  return master.id && master.contract
    ? master
    : { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: master.content_master_id, ...master };
}

function trustedPersistedPlanningRuntimeOutputMaterializer(store, staged, planning, frozenStructureIntent) {
  if (!frozenStructureIntent) return materializeUnifiedSkillRuntimeOutput;
  const persisted = (store?.unifiedStagedAtomicDualBootstraps || []).filter((item) => item?.id === staged.bootstrapId);
  if (persisted.length !== 1) fail("UNIFIED_STAGED_ATOMIC_PERSISTED_PLANNING_REQUIRED");
  const record = persisted[0];
  const planningClosure = record?.planning;
  const planningClosureBase = {
    serverPlanning: clone(planningClosure?.serverPlanning), outputs: clone(planningClosure?.outputs),
    invocations: clone(planningClosure?.invocations), outputFacts: clone(planningClosure?.outputFacts)
  };
  const masterFacts = (planningClosure?.outputFacts || []).filter((item) => item?.platform === "shared" && item?.capability === "build-content-master");
  const masterFact = masterFacts[0];
  const masterFactBase = clone(masterFact || {});
  delete masterFactBase.factHash;
  if (record?.state !== "confirmed" || !record.confirmation
    || record.bootstrapFact?.planningHash !== hashUnifiedContent(planningClosureBase)
    || hashUnifiedContent(record._serverAuthority) !== record.bootstrapFact?.authorityHash
    || hashUnifiedContent(record._serverAuthority) !== hashUnifiedContent(staged.authority)
    || hashUnifiedContent(planningClosure?.serverPlanning) !== hashUnifiedContent(planning)
    || masterFacts.length !== 1
    || masterFact.outputHash !== hashUnifiedContent(masterFact.runtimeOutput)
    || masterFact.factHash !== hashUnifiedContent(masterFactBase)
    || hashUnifiedContent(normalizedPersistedMaster(masterFact.verifiedDomainOutput || masterFact.runtimeOutput?.data))
      !== hashUnifiedContent(planning.sharedContentMaster)) {
    fail("UNIFIED_STAGED_ATOMIC_PERSISTED_MASTER_CLOSURE_INVALID");
  }
  const intent = validateContentStructureIntent(frozenStructureIntent);
  const planningBase = clone(planning);
  delete planningBase.planningHash;
  if (planning?.contract !== "UnifiedStagedContentPlanningResult@1.0"
    || planning?.planningHash !== hashUnifiedContent(planningBase)) {
    fail("UNIFIED_STAGED_ATOMIC_PERSISTED_PLANNING_HASH_MISMATCH");
  }
  const records = planning.sharedSkillRecords?.filter((item) => item?.capability === "build-content-master") || [];
  const canonicalMaster = validateContentMasterSemanticSpine(planning.sharedContentMaster, intent);
  const canonicalMasterHash = hashUnifiedContent(canonicalMaster);
  if (records.length !== 1 || records[0].outputHash !== canonicalMasterHash) {
    fail("UNIFIED_STAGED_ATOMIC_PERSISTED_MASTER_CLOSURE_INVALID");
  }
  return ({ capability, runtimeOutput, sourceSkillInput = null, sourceContentMaster = null }) => {
    if (capability !== "build-content-master") {
      return materializeUnifiedSkillRuntimeOutput({ capability, runtimeOutput, sourceSkillInput, sourceContentMaster });
    }
    if (sourceSkillInput?.structureIntent == null
      || hashUnifiedContent(validateContentStructureIntent(sourceSkillInput.structureIntent)) !== hashUnifiedContent(intent)
      || hashUnifiedContent(runtimeOutput?.data) !== canonicalMasterHash) {
      fail("UNIFIED_STAGED_ATOMIC_PERSISTED_MASTER_CLOSURE_INVALID");
    }
    const canonicalRuntimeOutput = clone(runtimeOutput);
    canonicalRuntimeOutput.data = validateContentMasterSemanticSpine(canonicalMaster, intent);
    return canonicalRuntimeOutput;
  };
}

export async function materializeUnifiedStagedAtomicDualBootstrap(store, staged, dependencies = {}) {
  const requestedPlatform = dependencies.platform === "wechat" || dependencies.platform === "xiaohongshu"
    ? dependencies.platform : null;
  const authority = clone(staged.authority);
  const planning = clone(staged.planning);
  const orchestrationInput = clone(authority.orchestrationInput);
  orchestrationInput.project.confirmations = {
    xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" }
  };
  const prospective = clone(store);
  const requestId = `staged-resume:${staged.bootstrapId}`;
  const materializedProjectId = `${staged.projectId}:revision:${staged.bootstrapId}`;
  const materializedOrchestrationInput = clone(orchestrationInput);
  materializedOrchestrationInput.project.id = materializedProjectId;
  const runtimeOutputMaterializer = trustedPersistedPlanningRuntimeOutputMaterializer(
    store,
    staged,
    planning,
    orchestrationInput.project?.structureIntent || null
  );
  trustedPersistedPlanningMaterializers.set(prospective, runtimeOutputMaterializer);
  if (requestedPlatform !== "wechat") {
    // A project can be produced more than once.  The immutable product
    // projection deliberately rejects two different commits with the same
    // content-project identity, so each staged production must materialize as
    // a new revision identity while retaining the original project as its
    // logical parent.  Without this, confirming a new outline after an older
    // package exists incorrectly fails with UNIFIED_ATOMIC_PRODUCT_ID_COLLISION.
    const xhsRevisionInput = clone(materializedOrchestrationInput);
    try {
      await createUnifiedContentProductSnapshot(prospective, { requestId, orchestrationInput: xhsRevisionInput }, {
        ...dependencies, generateText: cachedPlanningGenerateText(planning, dependencies.generateText),
        stagedXhsOnly: true,
        serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true, unifiedContentAtomicProductV1: true }
      });
    } finally {
      trustedPersistedPlanningMaterializers.delete(prospective);
    }
  } else {
    trustedPersistedPlanningMaterializers.delete(prospective);
  }
  const xhsCommit = (prospective.unifiedAtomicContentCommits || []).find((item) => item.contract === "UnifiedAtomicContentCommit@2.0"
    && item.contentProjectIdentity.id === materializedProjectId);
  if (requestedPlatform !== "wechat" && !xhsCommit) fail("UNIFIED_STAGED_ATOMIC_XHS_COMMIT_REQUIRED");
  if (requestedPlatform === "xiaohongshu") return { xiaohongshuCommit: clone(xhsCommit), wechatCommit: null };
  const normalizedSourcePlan = normalizedAtomicSourcePlan(materializedOrchestrationInput);
  const writerContexts = materializeUnifiedWriterContexts(prospective, orchestrationInput.project, orchestrationInput.mechanismDecision, authority.prerequisite);
  const wechatRun = planning.platformRuns.find((item) => item.platform === "wechat");
  const master = clone(planning.sharedContentMaster);
  const masterRef = { id: master.id, hash: hashUnifiedContent(master) };
  const brief = { ...clone(wechatRun.brief), sharedContentMasterRef: clone(masterRef) };
  const outline = clone(wechatRun.outline);
  const writerBase = clone(writerContexts.wechat); delete writerBase.writerContextHash;
  writerBase.authority_refs = {
    ...writerBase.authority_refs, sharedContentMasterRef: masterRef,
    platformBriefRef: { id: brief.id, hash: hashUnifiedContent(brief) },
    confirmedOutlineRef: { id: outline.outline_id || outline.id, hash: hashUnifiedContent(outline) }
  };
  const writerContext = createUnifiedWriterContext(writerBase);
  const platformAuthorityChecks = {
    briefPlatform: brief.platform === "wechat",
    briefMaster: sameRef(brief.sharedContentMasterRef, masterRef),
    briefAccount: brief.accountId === orchestrationInput.project.accounts.wechat,
    outlinePlatform: outline.platform === "wechat",
    writerPlatform: writerContext.platform === "wechat_official_account",
    writerAccount: writerContext.account_id === orchestrationInput.project.accounts.wechat
  };
  if (Object.values(platformAuthorityChecks).some((value) => value !== true)) {
    fail("UNIFIED_STAGED_ATOMIC_WECHAT_PLATFORM_AUTHORITY_INVALID", null, 409, platformAuthorityChecks);
  }
  const plan = {
    schemaVersion: "1.0", contract: "UnifiedAtomicWechatExecutionPlan@1.0", id: `staged-wechat-plan:${staged.bootstrapId}`, platform: "wechat", steps: [
      { id: "platform_writer", kind: "skill", capability: "write-wechat-article", enabled: true, required: true, dependsOn: [], inputContract: "WechatPlatformTopicIntentContentMasterAndConfirmedOutline", outputContract: "WechatArticle@2.0" },
      { id: "wechat_content_review", kind: "skill", capability: "review-wechat-article", enabled: true, required: true, dependsOn: ["platform_writer"], inputContract: "CompletedWechatArticleAndContentContracts", outputContract: "WechatArticleReview@1.0", invocationMode: "content_review" },
      { id: "image_plan", kind: "skill", capability: "plan-wechat-images", enabled: true, required: true, dependsOn: ["wechat_content_review"], inputContract: "CompletedWechatArticlePassedReviewAndAuthorizedAssets", outputContract: "WechatImagePlan@1.0" }
    ]
  };
  const authorizedAssets = clone(brief?.brief?.authorized_assets || brief?.authorized_assets || []);
  const imageRuntimeCapability = projectWechatImageRuntimeCapability(authorizedAssets, {
    generatedRasterAvailable: dependencies.wechatGeneratedRasterAvailable === true
  });
  const wechatResult = await appendUnifiedAtomicWechatMaterialization(prospective, {
    project: { id: materializedProjectId, companyId: staged.companyId, accountId: orchestrationInput.project.accounts.wechat,
      contentOpportunityRef: clone(orchestrationInput.project.contentOpportunityRef), activeStrategySnapshotRef: clone(orchestrationInput.project.activeStrategySnapshotRef) },
    authorityInputs: { sharedContentMaster: master, mechanismDecision: clone(orchestrationInput.mechanismDecision), sourcePlan: normalizedSourcePlan, platformBrief: brief, confirmedOutline: outline, writerContext, imageRuntimeCapability },
    sourcePlanRef: { id: normalizedSourcePlan.id, hash: hashUnifiedContent(normalizedSourcePlan) },
    writerContextRefId: writerContext.id || `writer_context:${staged.projectId}:wechat`, executionPlan: plan,
    commitId: `staged-wechat-commit:${staged.bootstrapId}`, idempotencyKey: hashUnifiedContent({ bootstrapId: staged.bootstrapId, platform: "wechat" }),
    createdAt: canonicalTimestamp(staged.createdAt)
  }, {
    generateText: dependencies.generateText,
    liveExecution: dependencies.liveExecution === true,
    allowStandaloneWechat: requestedPlatform === "wechat",
    featureFlags: { unifiedContentAtomicWechatProductV1: true },
    resolveStepCheckpoint: ({ step, inputHash, planHash, invocation }) => resolveUnifiedWechatStageCheckpoint(store, {
      materializationId: `staged-wechat-commit:${staged.bootstrapId}`,
      stepId: step.id, capability: step.capability, inputHash, planHash,
      invocationHash: invocation.invocationHash
    }),
    persistStepCheckpoint: async ({ step, inputHash, planHash, invocation, outputFact }) => {
      const result = appendUnifiedWechatStageCheckpoint(store, {
        materializationId: `staged-wechat-commit:${staged.bootstrapId}`,
        stepId: step.id, capability: step.capability, inputHash, planHash,
        invocationHash: invocation.invocationHash, outputFact,
        completedAt: new Date().toISOString()
      });
      if (result.created && typeof dependencies.persistStore === "function") await dependencies.persistStore(store);
      return result.checkpoint;
    }
  });
  return { xiaohongshuCommit: clone(xhsCommit), wechatCommit: clone(wechatResult.commit) };
}

export async function materializeUnifiedStagedAtomicPlatform(store, staged, platform, dependencies = {}) {
  if (!["xiaohongshu", "wechat"].includes(platform)) fail("UNIFIED_STAGED_ATOMIC_PLATFORM_INVALID");
  return materializeUnifiedStagedAtomicDualBootstrap(store, staged, { ...dependencies, platform });
}

export function ensureUnifiedContentProductStore(store) {
  store.unifiedContentProjects ||= [];
  return store.unifiedContentProjects;
}

function materializedAtomicEntries(compiled) {
  return [
    { role: "postCopy", kind: "provider_component", ...compiled.providerFacts.postCopy, componentHashField: "componentHash" },
    { role: "finalTitleBinding", kind: "deterministic_component", ...compiled.deterministicFacts.finalTitle, componentHashField: "bindingHash" },
    { role: "carouselPlan", kind: "provider_component", ...compiled.providerFacts.carouselPlan, componentHashField: "componentHash" },
    { role: "visualAssetPlan", kind: "provider_component", ...compiled.providerFacts.visualAssetPlan, componentHashField: "componentHash" },
    { role: "traceability", kind: "deterministic_component", ...compiled.deterministicFacts.traceability, componentHashField: "traceHash" },
    { role: "preflightReport", kind: "deterministic_component", ...compiled.deterministicFacts.preflight, componentHashField: "reportHash" }
  ];
}

function contentProjectIdentity(project) {
  const draft = {
    id: project.id,
    companyId: project.companyId,
    contentOpportunityRef: clone(project.contentOpportunityRef),
    activeStrategySnapshotRef: clone(project.activeStrategySnapshotRef)
  };
  return { ...draft, identityHash: hashUnifiedContent(draft) };
}

function materializeAtomicProduct(store, { requestId, snapshot, compiled, candidateCompilation }) {
  const identity = contentProjectIdentity(snapshot.contentProject);
  const materializedComponents = materializedAtomicEntries(compiled);
  const componentFacts = materializedComponents.map(({ role, kind, fact }) => ({ role, kind, fact: clone(fact) }));
  const authorityIdentity = {
    requestId,
    authorityHash: compiled.graph.authorityBinding.authorityHash
  };
  const idempotencyKey = hashUnifiedContent(authorityIdentity);
  const commit = createUnifiedAtomicContentCommitV2({
    id: `unified_atomic_content_commit:${idempotencyKey}`,
    idempotencyKey,
    contentProjectIdentity: identity,
    contentProject: snapshot.contentProject,
    platform: "xiaohongshu",
    graph: compiled.graph,
    componentFacts,
    materializedComponents,
    assemblyFact: compiled.assembly.fact,
    assemblyOutput: compiled.assembly.assemblyOutput,
    usageBinding: candidateCompilation.usageBinding,
    mechanismExplanation: candidateCompilation.mechanismExplanation,
    candidate: candidateCompilation.candidate
  });
  const projection = projectUnifiedAtomicContentCommit(commit);
  assertUnifiedAtomicProductProjectionAppendable(store, projection);
  createUnifiedAtomicContentCommitStore(store).append(commit);
  return projection;
}

export async function createUnifiedContentProductSnapshot(store, input, dependencies = {}) {
  const atomicGraphEnabled = dependencies.serverFeatureFlags?.unifiedContentXhsAtomicGraphV1 === true;
  const atomicProductEnabled = dependencies.serverFeatureFlags?.unifiedContentAtomicProductV1 === true;
  if (atomicProductEnabled && !atomicGraphEnabled) fail("UNIFIED_ATOMIC_PRODUCT_REQUIRES_GRAPH", "Atomic product materialization requires the atomic graph flag");
  const projects = atomicGraphEnabled
    ? (Array.isArray(store.unifiedContentProjects) ? store.unifiedContentProjects : [])
    : ensureUnifiedContentProductStore(store);
  const requestId = text(input?.requestId, "UNIFIED_CONTENT_REQUEST_ID_REQUIRED");
  if (projects.some((item) => item.requestId === requestId)) fail("UNIFIED_CONTENT_REQUEST_ALREADY_EXISTS", "Unified content requests are append-only; use the query API for the existing snapshot");
  if (typeof dependencies.resolveActiveStrategySnapshot !== "function") fail("UNIFIED_CONTENT_ACTIVE_STRATEGY_RESOLVER_REQUIRED", "Active strategy resolver is required", 500);
  const requestedProject = input?.orchestrationInput?.project;
  const activeStrategy = await dependencies.resolveActiveStrategySnapshot(requestedProject?.companyId);
  const activeStrategyId = activeStrategy?.id || activeStrategy?.snapshotId;
  if (!activeStrategyId) fail("UNIFIED_CONTENT_ACTIVE_STRATEGY_REQUIRED", "Company has no active strategy snapshot");
  if (activeStrategyId !== requestedProject?.activeStrategySnapshotRef?.id) fail("UNIFIED_CONTENT_ACTIVE_STRATEGY_MISMATCH", "Requested strategy snapshot is not the company's active strategy");
  if (!requestedProject?.designDnaSnapshotRef) fail("UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED");
  const designDnaAuthority = resolveConfirmedDesignDnaAuthority(store, {
    accountId: requestedProject?.accounts?.xiaohongshu,
    requestedRef: requestedProject?.designDnaSnapshotRef
  });
  const requestedDecision = input?.orchestrationInput?.mechanismDecision;
  const decisionRef = requestedDecision?.id && requestedDecision?.decisionHash
    ? { id: requestedDecision.id, hash: requestedDecision.decisionHash }
    : null;
  const prerequisiteBindings = (Array.isArray(store.unifiedContentPrerequisiteRequests) ? store.unifiedContentPrerequisiteRequests : [])
    .filter((item) => sameRef(item?.mechanismDecisionRef, decisionRef));
  if (prerequisiteBindings.length !== 1) fail("UNIFIED_XHS_DESIGN_DNA_PREREQUISITE_REQUIRED");
  if (!sameRef(prerequisiteBindings[0].designDnaSnapshotRef, designDnaAuthority.ref)) fail("UNIFIED_XHS_DESIGN_DNA_PREREQUISITE_MISMATCH");
  const writerContexts = materializeUnifiedWriterContexts(store, requestedProject, requestedDecision, prerequisiteBindings[0]);
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const executeRuntimeSkill = createUnifiedSkillActivityExecutor({
    generateText: dependencies.generateText,
    liveExecution: dependencies.liveExecution === true,
    evidenceCompiler,
    runtimeOutputMaterializer: trustedPersistedPlanningMaterializers.get(store) || materializeUnifiedSkillRuntimeOutput
  });
  const executeAtomicSkillActivity = createUnifiedAtomicSkillActivityExecutionPort({
    generateText: dependencies.generateText,
    liveExecution: dependencies.liveExecution === true,
    evidenceCompiler
  });
  const serverFeatureFlags = Object.freeze({
    unifiedContentXhsAtomicGraphV1: atomicGraphEnabled,
    unifiedContentAtomicProductV1: atomicProductEnabled
  });
  const orchestrationInput = clone(input.orchestrationInput);
  if (atomicGraphEnabled) {
    const sourcePlan = clone(orchestrationInput.sourcePlan);
    const frozenSourceRefs = resolveFrozenContentSourcePlanRefs(sourcePlan);
    sourcePlan.schemaVersion = "1.0";
    sourcePlan.contract = "SourcePlan@1.0";
    sourcePlan.id = `source_plan:${orchestrationInput.project.id}`;
    sourcePlan.frozenSourceRefs = clone(frozenSourceRefs);
    sourcePlan.sources = sourcePlan.sources.map((source) => ({
      ...source,
      sourceRef: clone(frozenSourceRefs.find((item) => source.candidateIds?.includes(item.id)) || null)
    }));
    orchestrationInput.sourcePlan = sourcePlan;
  }
  orchestrationInput.project.designDnaAuthority = clone(designDnaAuthority);
  orchestrationInput.project.writerContexts = clone(writerContexts);
  const orchestrateContent = dependencies.stagedXhsOnly === true
    ? runUnifiedStagedXhsMaterialization
    : runUnifiedContentOrchestration;
  const snapshot = await orchestrateContent(orchestrationInput, {
    now: dependencies.now,
    serverFeatureFlags,
    buildSharedContentMaster: async (masterInput, authorization) => {
      const master = await executeRuntimeSkill({
        capability: authorization.step.capability,
        platform: "xiaohongshu",
        input: masterInput,
        step: authorization.step,
        executionPlan: authorization.executionPlan
      });
      if (serverFeatureFlags.unifiedContentXhsAtomicGraphV1 !== true) return master;
      const atomicMaster = clone(master?.contentMaster || master);
      delete atomicMaster.platform;
      return atomicMaster?.id && atomicMaster?.contract ? atomicMaster : {
        schemaVersion: "3.0", contract: "ContentMaster@3.0", id: atomicMaster.content_master_id, ...atomicMaster
      };
    },
    buildPlatformBrief: dependencies.buildPlatformBrief || defaultPlatformBrief,
    buildPlatformExecutionPlan: dependencies.buildPlatformExecutionPlan,
    executeSkillStep: ({ platform, step, input: skillInput, executionPlan }) => executeRuntimeSkill({ capability: step.capability, platform, input: skillInput, step, executionPlan }),
    executeAtomicSkillActivity,
    executeServiceStep: dependencies.serviceExecutor || defaultServiceExecutor
  });
  if (serverFeatureFlags.unifiedContentXhsAtomicGraphV1 === true) {
    const compilerContexts = evidenceCompiler.getAtomicCompilerContexts();
    const titleFact = evidenceCompiler.resolveUniqueOutputFact({ capability: "generate-platform-titles", platform: "xiaohongshu" });
    const compiled = compileUnifiedAtomicFactGraph({
      activityBundles: evidenceCompiler.getAtomicActivityBundles(),
      compilerContexts,
      titleFact,
      orchestrationSnapshot: snapshot
    });
    // Supersedes the former graph-only gate "UNIFIED_ATOMIC_CANDIDATE_CUTOVER_PENDING" after the new in-memory compilation succeeds.
    const strategyAuthorityRef = writerContexts.xiaohongshu.authority_refs.accountStrategyRef;
    const strategyAuthorities = (store.accountStrategySnapshots || []).filter((item) => item?.id === strategyAuthorityRef.id && hashUnifiedContent(item) === strategyAuthorityRef.hash);
    if (strategyAuthorities.length !== 1) fail("UNIFIED_ATOMIC_USAGE_STRATEGY_AUTHORITY_REQUIRED");
    const existingConfirmationEvents = [
      ...(Array.isArray(store.contentMechanismConfirmationEvents) ? store.contentMechanismConfirmationEvents : []),
      ...(Array.isArray(store.unifiedContentMechanismConfirmationEvents) ? store.unifiedContentMechanismConfirmationEvents : [])
    ];
    const candidateCompilation = compileUnifiedAtomicCandidateUsage({
      factGraphCompilation: compiled,
      compilerContexts,
      orchestrationSnapshot: snapshot,
      strategySnapshot: strategyAuthorities[0],
      existingConfirmationEvents,
      boundAt: snapshot.createdAt
    });
    if (atomicProductEnabled) {
      return materializeAtomicProduct(store, { requestId, snapshot, compiled, candidateCompilation });
    }
    fail(
      "UNIFIED_ATOMIC_PERSISTENCE_CUTOVER_PENDING",
      "Atomic Candidate v3 and Usage Binding were verified in memory; persistence remains intentionally closed",
      409,
      {
        candidate: clone(candidateCompilation.candidate),
        usageBinding: clone(candidateCompilation.usageBinding),
        mechanismExplanation: clone(candidateCompilation.mechanismExplanation),
        persistenceWrites: 0
      }
    );
  }
  const skillOutputFacts = evidenceCompiler.getSkillOutputFacts();
  const platforms = snapshot.platformRuns.map((run) => {
    const derived = deriveUnifiedPlatformCandidate({
      contentProjectId: snapshot.contentProject.id,
      platform: run.platform,
      platformRunRef: run.platformRunRef,
      outputFacts: skillOutputFacts
    });
    const productPlatformRunRef = withUnifiedContentHash({
      ...clone(run.platformRunRef),
      candidateRefs: [clone(derived.candidateRef)],
      hash: ""
    }, "hash");
    derived.candidate.platformRunRef = clone(productPlatformRunRef);
    derived.candidateSet.platformRunRef = clone(productPlatformRunRef);
    const candidates = [candidateProjection(derived.candidate)];
    const productRun = { ...run, platformRunRef: productPlatformRunRef };
    return {
      platform: run.platform,
      accountId: run.accountId,
      platformRunRef: clone(productPlatformRunRef),
      candidateRefs: candidates.map((item) => clone(item.candidateRef)),
      candidates,
      reviewInput: reviewInputProjection(productRun, derived.candidateRef, derived.candidateSet),
      deliveryPreview: deliveryPreview(productRun, candidates)
    };
  });
  if (platforms.length !== PLATFORMS.length || PLATFORMS.some((platform) => !platforms.some((item) => item.platform === platform))) {
    fail("UNIFIED_CONTENT_DUAL_PLATFORM_REQUIRED", "Unified content product snapshots require exactly one run per platform");
  }
  const sharedRefs = platforms.map((item) => item.platformRunRef.sharedContentMasterRef);
  if (!sharedRefs.every((item) => sameRef(item, snapshot.sharedContentMasterRef))) fail("UNIFIED_CONTENT_SHARED_MASTER_MISMATCH", "Both platform runs must bind the same shared master");
  const productContentProject = withUnifiedContentHash({
    ...clone(snapshot.contentProject),
    platformRuns: platforms.map((item) => clone(item.platformRunRef)),
    projectHash: ""
  }, "projectHash");
  const recordBase = {
    schemaVersion: "1.0",
    contract: "UnifiedContentProductSnapshot@1.0",
    id: `unified_content_project:${productContentProject.id}:${requestId}`,
    requestId,
    contentProject: productContentProject,
    orchestrationSnapshotRef: { id: snapshot.contentProject.id, hash: snapshot.snapshotHash },
    orchestrationSnapshot: clone(snapshot),
    sharedContentMasterRef: clone(snapshot.sharedContentMasterRef),
    activeStrategySnapshotRef: clone(snapshot.activeStrategySnapshotRef),
    platforms,
    actualInvocations: evidenceCompiler.getActualInvocations(),
    skillOutputFacts: clone(skillOutputFacts),
    callerReviewInputsPolicy: input?.reviewInputs == null ? "not_supplied" : "ignored",
    state: "candidate_ready",
    promoted: false,
    deliveryReady: false,
    published: false,
    blockers: ["user_selection_required", "promotion_required"],
    createdAt: snapshot.createdAt
  };
  const record = { ...recordBase, productSnapshotHash: hashUnifiedContent(recordBase) };
  projects.push(record);
  return clone(record);
}

export function listUnifiedContentProductSnapshots(store, filters = {}, options = {}) {
  if (options.featureFlags?.unifiedContentAtomicWechatProductV1 === true) {
    if (options.featureFlags?.unifiedContentAtomicProductV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_PRODUCT_REQUIRES_ATOMIC_PRODUCT");
    return listUnifiedAtomicMultiplatformProducts(store, filters).map((product) => {
      try { return projectUnifiedWechatCurrentProduct(store, product); }
      catch (error) {
        // Platform workspaces are independent. A materialized XHS candidate
        // must remain listable while the WeChat side is still pending.
        if (error?.code === "UNIFIED_PRODUCTION_CONTROL_WECHAT_NOT_MATERIALIZED") return clone(product);
        throw error;
      }
    });
  }
  if (options.featureFlags?.unifiedContentAtomicProductV1 === true) {
    return listUnifiedAtomicContentProductProjections(store, filters);
  }
  return ensureUnifiedContentProductStore(store).filter((item) =>
    (!filters.companyId || item.contentProject.companyId === filters.companyId)
    && (!filters.accountId || item.platforms.some((platform) => platform.accountId === filters.accountId))
  ).map((item) => projectUnifiedContentArtifacts(store, item));
}

function validateAtomicWechatPreuploadExecutionFact(fact) {
  if (fact?.schemaVersion !== "1.0" || fact.contract !== "UnifiedAtomicWechatPreuploadExecutionFact@1.0"
    || typeof fact.factHash !== "string" || !/^[a-f0-9]{64}$/.test(fact.factHash)) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_EXECUTION_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_EXECUTION_FACT_HASH_MISMATCH");
  return fact;
}

export async function executeUnifiedAtomicWechatPreuploadArtifact(store, input, dependencies = {}) {
  const flags = dependencies.featureFlags || {};
  if (flags.unifiedContentAtomicWechatArtifactV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_DISABLED", "Atomic WeChat Artifact is disabled", 404);
  if (flags.unifiedContentAtomicProductV1 !== true || flags.unifiedContentAtomicWechatProductV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_PRODUCT_REQUIRED");
  for (const forbidden of ["planOutput", "candidate", "imagePlanOutputFact", "bindings", "article", "contentMaster", "canonicalPlan", "imagePlanAuthority", "runtimeResult"]) {
    if (Object.hasOwn(input || {}, forbidden)) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_CALLER_AUTHORITY_FORBIDDEN", forbidden, 400);
  }
  const scope = {
    workspaceId: text(input?.workspaceId, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_WORKSPACE_REQUIRED"),
    companyId: text(input?.companyId, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_COMPANY_REQUIRED"),
    accountId: text(input?.accountId, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_ACCOUNT_REQUIRED"),
    projectId: text(input?.projectId, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_PROJECT_REQUIRED"), platform: "wechat",
    productSnapshotHash: text(input?.productSnapshotHash, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_PRODUCT_HASH_REQUIRED")
  };
  const authority = resolveUnifiedContentAuthority(store, scope, { atomicProductEnabled: true, atomicWechatProductEnabled: true });
  if (authority.authorityKind !== "atomic_wechat_v1") fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_AUTHORITY_REQUIRED");
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_IDEMPOTENCY_REQUIRED");
  const idempotencyKeyPrefix = text(input?.idempotencyKeyPrefix, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_RUNTIME_PREFIX_REQUIRED");
  const attempt = input?.attempt;
  if (!Number.isInteger(attempt) || attempt < 1) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_ATTEMPT_INVALID", null, 400);
  const recordedAt = text(input?.recordedAt, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_RECORDED_AT_REQUIRED");
  if (Number.isNaN(Date.parse(recordedAt))) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_RECORDED_AT_INVALID", null, 400);
  const wholeArticleGateEnabled = input?.wholeArticleGateEnabled === true;
  const requestHash = hashUnifiedContent({
    scope, productAuthorityHash: authority.productAuthorityHash, commitRef: authority.payload.commitRef,
    materializedProjectRef: authority.materializedProjectRef, platformRunRef: authority.platformRunRef,
    candidateRef: authority.candidateRef, idempotencyKeyPrefix, attempt, recordedAt, wholeArticleGateEnabled
  });
  const executions = Array.isArray(store.unifiedContentWechatPreuploadExecutionFacts) ? store.unifiedContentWechatPreuploadExecutionFacts : [];
  const priors = executions.map(validateAtomicWechatPreuploadExecutionFact).filter((fact) => fact.idempotencyKey === idempotencyKey);
  if (priors.length > 1) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_EXECUTION_AMBIGUOUS");
  if (priors.length === 1) {
    if (priors[0].requestHash !== requestHash) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_IDEMPOTENCY_CONFLICT");
    const artifactState = getUnifiedContentArtifactState(store, { ...scope, candidateId: authority.candidateRef.id }, { featureFlags: flags });
    const baseProduct = getUnifiedAtomicMultiplatformProduct(store, scope.projectId);
    let productProjection = null;
    if (artifactState.reviewable === true && !authority.payload.revisionExecution) {
      productProjection = projectUnifiedAtomicWechatPreuploadArtifact(baseProduct, artifactState);
      validateUnifiedAtomicMultiplatformArtifactProjection(productProjection);
    }
    return { created: false, executionFact: clone(priors[0]), artifactState, productProjection, counters: { resourceResolverCalls: 0, formatterCalls: 0, qualityGateCalls: 0, wholeArticleGateCalls: 0, platformCalls: 0 } };
  }
  // The runtime store is candidate-scoped. Passing every historical WeChat
  // fact makes a second project look as if it were trying to mutate facts
  // owned by the first project when the append-only validator checks scope.
  // Keep same-project facts for idempotent replay, but never feed unrelated
  // project history into this execution.
  const belongsToCurrentWechatAuthority = (fact) => sameRef(fact?.contentProjectRef, authority.executionProjectRef)
    && sameRef(fact?.materializedContentProjectRef, authority.materializedProjectRef)
    && sameRef(fact?.platformRunRef, authority.platformRunRef)
    && sameRef(fact?.candidateRef, authority.candidateRef);
  const scopedWechatFacts = (values) => clone((Array.isArray(values) ? values : []).filter(belongsToCurrentWechatAuthority));
  const factStore = {
    schemaVersion: "1.0",
    planFacts: scopedWechatFacts(store.unifiedContentWechatPlanFacts),
    resourceAttempts: scopedWechatFacts(store.unifiedContentWechatResourceAttempts),
    formatFacts: scopedWechatFacts(store.unifiedContentWechatFormatFacts),
    qualityFacts: scopedWechatFacts(store.unifiedContentWechatQualityFacts),
    wholeArticleQualityFacts: scopedWechatFacts(store.unifiedContentWechatWholeArticleQualityFacts),
    lifecycleFacts: scopedWechatFacts(store.unifiedContentWechatLifecycleFacts)
  };
  const runtimeResult = await runWechatPreuploadArtifactRuntime({
    authorityResolution: authority, store: factStore, attempt, idempotencyKeyPrefix, recordedAt, wholeArticleGateEnabled
  }, {
    artifactSink: dependencies.artifactSink, resourceResolvers: dependencies.resourceResolvers,
    formatHtml: dependencies.formatHtml, qualityGates: dependencies.qualityGates,
    wholeArticleQualityGate: dependencies.wholeArticleQualityGate
  });
  const prospective = clone(store);
  const appended = appendUnifiedContentArtifact(prospective, {
    ...scope, candidateId: authority.candidateRef.id, operation: "wechat_preupload_runtime_result",
    runtimeResult, idempotencyKey: `atomic-wechat-preupload:${idempotencyKey}`
  }, {
    now: recordedAt, featureFlags: flags,
    authoritativeWechatWholeArticleRuntime: wholeArticleGateEnabled ? { candidateRef: authority.candidateRef, runtimeResultHash: hashWechatArtifactValue(runtimeResult) } : null
  });
  const executionBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicWechatPreuploadExecutionFact@1.0",
    id: `atomic-wechat-preupload-execution:${hashUnifiedContent({ idempotencyKey, requestHash }).slice(0, 24)}`,
    idempotencyKey, requestHash, contentProjectRef: clone(authority.executionProjectRef), materializedContentProjectRef: clone(authority.materializedProjectRef),
    platformRunRef: clone(authority.platformRunRef), candidateRef: clone(authority.candidateRef), commitRef: clone(authority.payload.commitRef),
    runtimeResultHash: hashWechatArtifactValue(runtimeResult), artifactFactRefs: appended.facts.map((fact) => ({ id: fact.id, hash: fact.factHash })),
    semantics: "pre_upload_template_not_wechat_final", platformUploadPerformed: false, draftCreated: false, publicationPerformed: false, recordedAt
  };
  const executionFact = { ...executionBase, factHash: hashUnifiedContent(executionBase) };
  prospective.unifiedContentWechatPreuploadExecutionFacts = [...executions.map(clone), executionFact];
  for (const key of [
    "unifiedContentWechatPlanFacts", "unifiedContentWechatResourceAttempts", "unifiedContentWechatFormatFacts",
    "unifiedContentWechatQualityFacts", "unifiedContentWechatWholeArticleQualityFacts", "unifiedContentWechatPreviewArtifacts",
    "unifiedContentArtifactIdempotencyFacts", "unifiedContentWechatPreuploadExecutionFacts"
  ]) store[key] = clone(prospective[key] || []);
  const artifactState = getUnifiedContentArtifactState(store, { ...scope, candidateId: authority.candidateRef.id }, { featureFlags: flags });
  const baseProduct = getUnifiedAtomicMultiplatformProduct(store, scope.projectId);
  let productProjection = null;
  if (artifactState.reviewable === true && !authority.payload.revisionExecution) {
    productProjection = projectUnifiedAtomicWechatPreuploadArtifact(baseProduct, artifactState);
    validateUnifiedAtomicMultiplatformArtifactProjection(productProjection);
  }
  return {
    created: true, executionFact: clone(executionFact), facts: clone(appended.facts), artifactState, productProjection,
    reviewPayload: clone(runtimeResult.reviewPayload), semantics: "pre_upload_template_not_wechat_final",
    platformUploadPerformed: false, draftCreated: false, publicationPerformed: false,
    counters: { resourceResolverCalls: Object.values(runtimeResult.resolverCalls).reduce((sum, value) => sum + value, 0), platformCalls: 0 }
  };
}

export function getUnifiedContentProductSnapshot(store, id, options = {}) {
  if (options.featureFlags?.unifiedContentAtomicWechatProductV1 === true) {
    if (options.featureFlags?.unifiedContentAtomicProductV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_PRODUCT_REQUIRES_ATOMIC_PRODUCT");
    const product = getUnifiedAtomicMultiplatformProduct(store, id);
    if (!product) return null;
    try { return projectUnifiedWechatCurrentProduct(store, product); }
    catch (error) {
      if (error?.code === "UNIFIED_PRODUCTION_CONTROL_WECHAT_NOT_MATERIALIZED") return clone(product);
      throw error;
    }
  }
  if (options.featureFlags?.unifiedContentAtomicProductV1 === true) {
    return getUnifiedAtomicContentProductProjection(store, id);
  }
  const item = ensureUnifiedContentProductStore(store).find((candidate) => candidate.id === id || candidate.contentProject.id === id);
  return item ? projectUnifiedContentArtifacts(store, item) : null;
}
