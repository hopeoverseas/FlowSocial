import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { featureFlags } from "../../feature-flags.mjs";
import { buildSkillExecutionPlan, buildUnifiedPlatformSkillExecutionPlan } from "../../content-agent/skill-execution-plan.mjs";
import { buildUnifiedProjectInputRef } from "../../content-agent/unified-content-prerequisite-store.mjs";
import { validateContentMechanismDecision, validateUnifiedContentOpportunity } from "../../content-agent/unified-content-contracts.mjs";
import { sanitizeUnifiedSkillValidationFieldPaths } from "../../content-agent/unified-skill-output-contracts.mjs";

const flowsocialRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const allowedTmpRoot = resolve(flowsocialRoot, ".tmp");
const PLATFORMS = Object.freeze(["xiaohongshu", "wechat"]);
const FLAG_KEYS = Object.freeze(["unifiedContentProductionV1", "xhsIntegratedPageDesignSkill"]);
const MAX_TEXT_CALLS = 9;
const SKILL_STATES = new Set(["completed", "planned", "waiting_condition", "skipped"]);
const CONDITIONAL_SKILLS = new Set(["design-xhs-integrated-pages", "viral-content-remixer"]);

function fail(code, message = code) {
  throw Object.assign(new Error(message), { code });
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashFile(path) {
  return sha256(readFileSync(path));
}

function exactObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("LIVE_APPROVAL_INVALID", `${label} must be an object`);
  return value;
}

function exactText(value, label) {
  if (typeof value !== "string" || !value.trim()) fail("LIVE_APPROVAL_INVALID", `${label} is required`);
  return value.trim();
}

function exactHash(value, label) {
  const text = exactText(value, label);
  if (!/^[a-f0-9]{64}$/.test(text)) fail("LIVE_APPROVAL_INVALID", `${label} must be sha256`);
  return text;
}

function contained(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function rejectLinks(path, stopAt) {
  let cursor = resolve(path);
  const stop = resolve(stopAt);
  while (contained(stop, cursor)) {
    try {
      if (lstatSync(cursor).isSymbolicLink()) fail("LIVE_PATH_LINK_FORBIDDEN", `link/reparse path forbidden: ${cursor}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (cursor === stop) break;
    cursor = dirname(cursor);
  }
}

function rejectLinksToFilesystemRoot(path) {
  let cursor = resolve(path);
  while (true) {
    try {
      if (lstatSync(cursor).isSymbolicLink()) fail("LIVE_PATH_LINK_FORBIDDEN", `link/reparse path forbidden: ${cursor}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

export function validateIsolationPaths({ sourceDatabasePath, destinationDataDir }) {
  const source = resolve(exactText(sourceDatabasePath, "sourceDatabasePath"));
  const destination = resolve(exactText(destinationDataDir, "destinationDataDir"));
  if (!existsSync(source) || !lstatSync(source).isFile()) fail("LIVE_SOURCE_DATABASE_INVALID");
  rejectLinksToFilesystemRoot(source);
  const realSource = realpathSync(source);
  mkdirSync(allowedTmpRoot, { recursive: true });
  rejectLinks(allowedTmpRoot, allowedTmpRoot);
  if (!contained(realpathSync(allowedTmpRoot), destination)) fail("LIVE_DESTINATION_OUTSIDE_TMP");
  rejectLinks(destination, allowedTmpRoot);
  const destinationDatabasePath = resolve(destination, "flowsocial.db");
  if (realSource === destinationDatabasePath || resolve(source) === destinationDatabasePath) fail("LIVE_SOURCE_DESTINATION_SAME");
  if (existsSync(destinationDatabasePath)) fail("LIVE_DESTINATION_ALREADY_EXISTS");
  return { sourceDatabasePath: realSource, destinationDataDir: destination, destinationDatabasePath };
}

function readStoreFromDatabase(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get();
    if (!row?.payload) fail("LIVE_SOURCE_STATE_MISSING");
    return JSON.parse(row.payload);
  } finally {
    db.close();
  }
}

function collectById(root, id) {
  const matches = [];
  const seen = new Set();
  const visit = (value, path) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (!Array.isArray(value) && value.id === id) matches.push({ value, path });
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
    else Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`));
  };
  visit(root, "$store");
  return matches;
}

function verifyBinding(store, binding, label) {
  exactObject(binding, label);
  const id = exactText(binding.id, `${label}.id`);
  const objectHash = exactHash(binding.objectHash, `${label}.objectHash`);
  const idMatches = collectById(store, id);
  if (!idMatches.length) fail("LIVE_SOURCE_OBJECT_MISSING", label);
  const matches = idMatches.filter((item) => sha256(stableJson(item.value)) === objectHash);
  if (!matches.length) fail("LIVE_SOURCE_OBJECT_HASH_MISMATCH", label);
  if (matches.length !== 1) fail("LIVE_SOURCE_OBJECT_AMBIGUOUS", label);
  return matches[0].value;
}

function strategyRowMetadata(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    version: row.version,
    status: row.status,
    sourceSessionId: row.source_session_id,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    sourceDraftRevisionId: row.source_draft_revision_id,
    documentHash: row.document_hash,
    contextHash: row.context_hash,
    activationReason: row.activation_reason,
    supersedesSnapshotId: row.supersedes_snapshot_id,
    metadataCreatedAt: row.metadata_created_at
  };
}

export function resolveCanonicalActiveStrategy(sourceDatabasePath, company, binding) {
  exactObject(binding, "targets.activeStrategy");
  const businessStrategyId = exactText(binding.id, "targets.activeStrategy.id");
  const companyActiveStrategyId = company.activeStrategySnapshotId || company.activeStrategyId || null;
  if (!companyActiveStrategyId || companyActiveStrategyId !== businessStrategyId) fail("LIVE_STRATEGY_NOT_ACTIVE");
  const databasePath = resolve(exactText(sourceDatabasePath, "sourceDatabasePath"));
  const db = new DatabaseSync(databasePath, { readOnly: true });
  let exactRows;
  let activeCount;
  try {
    exactRows = db.prepare(`
      SELECT s.*,
        m.source_draft_revision_id,
        m.document_hash,
        m.context_hash,
        m.activation_reason,
        m.supersedes_snapshot_id,
        m.created_at AS metadata_created_at
      FROM strategy_snapshots s
      LEFT JOIN strategy_snapshot_meta m ON m.strategy_snapshot_id = s.id
      WHERE s.account_id = ? AND s.id = ? AND s.status = 'active'
      ORDER BY s.version DESC, s.id
    `).all(company.id, businessStrategyId);
    activeCount = Number(db.prepare("SELECT COUNT(*) AS count FROM strategy_snapshots WHERE account_id = ? AND status = 'active'").get(company.id)?.count || 0);
  } catch (error) {
    if (/no such table/i.test(String(error?.message))) fail("LIVE_STRATEGY_TABLE_MISSING");
    throw error;
  } finally {
    db.close();
  }
  if (!exactRows.length) fail("LIVE_ACTIVE_STRATEGY_ROW_MISSING");
  if (exactRows.length !== 1 || activeCount !== 1) fail("LIVE_ACTIVE_STRATEGY_ROW_AMBIGUOUS");
  const row = exactRows[0];
  let payload;
  try { payload = JSON.parse(row.payload_json); }
  catch { fail("LIVE_ACTIVE_STRATEGY_PAYLOAD_INVALID"); }
  const metadata = strategyRowMetadata(row);
  const metadataHash = exactHash(binding.rowMetadataHash, "targets.activeStrategy.rowMetadataHash");
  const payloadHash = exactHash(binding.payloadHash, "targets.activeStrategy.payloadHash");
  if (sha256(stableJson(metadata)) !== metadataHash) fail("LIVE_ACTIVE_STRATEGY_ROW_METADATA_HASH_MISMATCH");
  if (sha256(stableJson(payload)) !== payloadHash) fail("LIVE_ACTIVE_STRATEGY_PAYLOAD_HASH_MISMATCH");
  return {
    rowMetadata: metadata,
    businessStrategyId,
    canonical: {
      id: row.id,
      accountId: row.account_id,
      version: row.version,
      status: row.status,
      sourceSessionId: row.source_session_id,
      payload,
      document: structuredClone(payload),
      sourceDraftRevisionId: row.source_draft_revision_id,
      documentHash: row.document_hash,
      contextHash: row.context_hash,
      activationReason: row.activation_reason,
      supersedesSnapshotId: row.supersedes_snapshot_id,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      activatedAt: row.confirmed_at
    }
  };
}

function optionalPrerequisite(store, binding, label, blockerCode, objectType, collectionNames) {
  if (!binding?.id) return { value: null, blocker: { code: blockerCode, objectType, reason: "binding_not_supplied" } };
  const matches = collectionNames.flatMap((name) => (Array.isArray(store[name]) ? store[name] : [])).filter((item) => item?.id === binding.id);
  if (!matches.length) return { value: null, blocker: { code: blockerCode, objectType, reason: "source_object_not_found", requestedId: binding.id } };
  const objectHash = exactHash(binding.objectHash, `${label}.objectHash`);
  const exact = matches.filter((item) => sha256(stableJson(item)) === objectHash);
  if (!exact.length) fail("LIVE_SOURCE_OBJECT_HASH_MISMATCH", label);
  if (exact.length !== 1) fail("LIVE_SOURCE_OBJECT_AMBIGUOUS", label);
  return { value: exact[0], blocker: null };
}

function prerequisiteReadiness(blockers, strategyId) {
  const actions = blockers.map((blocker) => ({
    objectType: blocker.objectType,
    action: blocker.objectType === "ContentOpportunity"
      ? "create_content_opportunity_through_official_product_entry"
      : "create_content_mechanism_decision_through_official_product_entry",
    executionScope: "isolated_sqlite_copy",
    activeStrategySnapshotId: strategyId,
    launcherMayCreate: false
  }));
  const readiness = {
    schemaVersion: "1.0",
    contract: "UnifiedContentLivePrerequisiteReadiness@1.0",
    status: "blocked_prerequisites",
    blockers,
    preparationPlan: {
      mode: "official_product_entry_in_isolated_copy",
      actions,
      launcherWrites: false,
      activityDatabaseWrites: 0,
      providerCalls: 0,
      platformCalls: 0,
      externalCalls: 0
    },
    providerCalls: 0,
    platformCalls: 0,
    externalCalls: 0,
    productionDatabaseWrites: 0
  };
  return { ...readiness, readinessHash: sha256(stableJson(readiness)) };
}

function ownerMatches(value, companyId) {
  return value.companyId === companyId || value.company?.id === companyId || value.accountId === companyId || value.id === companyId;
}

function liveNode(step, { platform, scope = platform }) {
  const state = step.state || (step.enabled ? "planned" : "waiting_condition");
  const multimodal = step.capability === "review-xhs-visuals";
  const executionClass = multimodal ? "provider_multimodal" : step.executionClass;
  const category = step.kind === "skill"
    ? executionClass === "deterministic" ? "deterministic_skill" : executionClass === "provider_multimodal" ? "provider_multimodal_skill" : "provider_skill"
    : step.kind === "binding" ? "binding" : step.humanConfirmation ? "human_gate" : executionClass === "provider_image" ? "provider_image" : "service";
  const node = {
    id: `${scope}:${step.id}`,
    scope,
    platform,
    stepId: step.id,
    kind: step.kind,
    capability: step.capability || null,
    service: step.service || null,
    executionClass,
    category,
    lifecycle: step.kind === "skill" ? (CONDITIONAL_SKILLS.has(step.capability) ? "stable_conditional" : "stable") : null,
    phase: step.phase,
    state,
    decision: step.decision,
    reason: step.reason || (state === "planned" ? "authorized_current_stage" : state === "completed" ? "binding_complete" : "condition_not_satisfied"),
    dependsOn: (step.dependsOn || []).map((id) => `${scope}:${id}`),
    inputContract: step.inputContract || null,
    outputContract: step.outputContract || null,
    maxAttempts: ["provider_text", "provider_multimodal", "provider_image"].includes(executionClass) ? 1 : 0,
    automaticRetries: 0,
    activationCondition: state === "waiting_condition" ? step.reason || "upstream_condition_not_satisfied" : null,
    nextStateWhenConditionSatisfied: state === "waiting_condition" ? "planned" : null,
    failureRecovery: { automaticRetry: false, rerunFrom: step.id, preserveCompletedUpstream: true }
  };
  if (step.capability === "design-xhs-integrated-pages") node.contractBoundary = {
    authorizationConditions: ["explicit_visual_design_request", "xhs_design_feature_flag", "exact_master_run_candidate_visual_selection_bindings"],
    conditionSatisfiedState: "planned", executionProduces: ["prompt_set", "provider_execution_plan"],
    doesNotProduce: ["page_revision", "user_selection", "delivery_bundle", "publication"], providerCalls: 0
  };
  if (step.capability === "review-xhs-visuals") node.contractBoundary = {
    authorizationConditions: ["exact_rendered_page_revision_set_present"], conditionSatisfiedState: "planned",
    modality: "text_and_images", reviewScope: "whole_set", mayPassWithoutRenderedPages: false, nextGate: "HumanWholeSetVisualApproval"
  };
  if (["write-wechat-article", "review-wechat-article", "plan-wechat-images"].includes(step.capability)) node.contractBoundary = {
    invocationAuthority: "strict_skill_execution_plan", localServiceSubstituteAllowed: false
  };
  if (step.service === "HumanProviderExecutionApproval") node.contractBoundary = { approvalBinds: ["design_evidence_hash", "provider_execution_plan_hash", "budget_hash"], automaticApproval: false };
  if (step.service === "UserVisualSelection") node.contractBoundary = { requires: ["multimodal_whole_set_review_pass", "exact_page_revision_set"], automaticSelection: false };
  if (["WechatHtmlFormatter", "WechatHtmlValidator", "XhsHtmlRenderer"].includes(step.service)) node.contractBoundary = { classification: "local_service", skillInvocation: false };
  return node;
}

function compatibilitySkillNodes(platform) {
  return [liveNode({
    id: "source_blueprint", kind: "skill", capability: "viral-content-remixer", executionClass: "provider_text", phase: "S1", required: false,
    enabled: false, state: "skipped", decision: "skipped", reason: "compatibility_only_requires_explicit_authorized_reference",
    dependsOn: ["source_analysis", "pattern_review"], inputContract: "ReferencePostAndAuthorization", outputContract: "OriginalContentBlueprint"
  }, { platform })];
}

function validateSkillCoverage(nodes) {
  const skills = nodes.filter((node) => node.kind === "skill");
  for (const node of skills) {
    if (!SKILL_STATES.has(node.state)) fail("LIVE_SKILL_STATE_INVALID", node.id);
    if (!node.reason || !node.lifecycle || !["provider_skill", "provider_multimodal_skill", "deterministic_skill"].includes(node.category)) fail("LIVE_SKILL_COVERAGE_INCOMPLETE", node.id);
  }
  const required = ["build-content-master", "generate-content-outline", "write-xhs-content", "write-wechat-article", "generate-platform-titles", "review-wechat-article", "plan-wechat-images", "design-xhs-integrated-pages", "review-xhs-visuals", "naturalize-copy", "revise-content-package", "analyze-viral-content", "viral-content-remixer"];
  const missing = required.filter((capability) => !skills.some((node) => node.capability === capability));
  if (missing.length) fail("LIVE_STABLE_SKILL_COVERAGE_INCOMPLETE", missing.join(","));
  return {
    applicableCapabilities: required,
    statusCounts: Object.fromEntries([...SKILL_STATES].map((state) => [state, skills.filter((node) => node.state === state).length])),
    skillNodeHashes: Object.fromEntries(skills.map((node) => [node.id, sha256(stableJson(node))]))
  };
}

function stageProjection(phase, nodes) {
  const stageNodes = nodes.filter((node) => node.phase === phase);
  const base = {
    id: phase,
    nodes: stageNodes,
    budget: {
      providerTextCalls: stageNodes.filter((node) => node.executionClass === "provider_text" && node.state === "planned").length,
      deterministicInvocations: stageNodes.filter((node) => node.executionClass === "deterministic" && node.state !== "skipped").length,
      providerMultimodalCalls: stageNodes.filter((node) => node.executionClass === "provider_multimodal" && node.state === "planned").length,
      providerImageCalls: 0,
      automaticRetries: 0
    },
    waitingConditions: stageNodes.filter((node) => node.state === "waiting_condition").map((node) => ({ nodeId: node.id, reason: node.reason, nextState: node.nextStateWhenConditionSatisfied })),
    stopPoint: {
      S1: "stop_if_source_analysis_or_pattern_review_not_approved",
      S2A: "stop_if_shared_content_master_not_completed",
      S2B: "stop_after_text_candidates_before_visual_provider_authority",
      S3: "stop_before_image_provider_without_exact_human_approval",
      S4: "stop_before_human_selection_without_multimodal_whole_set_pass",
      S5: "stop_before_revision_without_explicit_user_request"
    }[phase]
  };
  return { ...base, stageHash: sha256(stableJson(base)) };
}

function buildCallPlan(approval, flagSnapshot) {
  const orchestration = exactObject(approval.orchestrationInput, "orchestrationInput");
  const project = exactObject(orchestration.project, "orchestrationInput.project");
  const sourcePlan = orchestration.sourcePlan || { mode: "strategy_only", sources: [] };
  if (sourcePlan.mode !== "strategy_only" || (sourcePlan.sources || []).some((item) => ["hotspot", "viral_reference"].includes(item?.type))) fail("LIVE_HOTSPOT_DEFAULT_ZERO");
  const requestedXhsOptions = project.skillExecutionOptions?.xiaohongshu || {};
  if (requestedXhsOptions.xhsDesignBindingsReady === true || requestedXhsOptions.hasRenderedAssets === true || (requestedXhsOptions.renderedPageRevisionRefs || []).length) fail("LIVE_POST_CANDIDATE_BINDINGS_FORBIDDEN");
  const nodes = [];
  const shared = buildSkillExecutionPlan({ platform: "xiaohongshu", sourcePlan, options: project.skillExecutionOptions?.xiaohongshu || {} });
  const master = shared.steps.find((step) => step.id === "content_master");
  if (!master?.enabled || master.state !== "planned") fail("LIVE_SHARED_MASTER_PLAN_BLOCKED");
  nodes.push(liveNode(master, { platform: "xiaohongshu", scope: "shared" }));
  const pendingMasterRef = { id: `pending_shared_master:${project.id}`, hash: sha256(stableJson({ projectId: project.id, strategy: project.activeStrategySnapshotRef })) };
  for (const platform of PLATFORMS) {
    const options = { ...(project.skillExecutionOptions?.[platform] || {}), featureFlags: flagSnapshot, xhsDesignBindingsReady: false, renderedPageRevisionRefs: [] };
    const plan = buildUnifiedPlatformSkillExecutionPlan({ platform, sourcePlan, options, sharedContentMasterRef: pendingMasterRef, createdAt: approval.approvedAt || "1970-01-01T00:00:00.000Z" });
    for (const step of plan.steps) {
      nodes.push(liveNode(step, { platform }));
    }
    nodes.push(...compatibilitySkillNodes(platform));
  }
  const calls = nodes.filter((node) => node.kind === "skill" && node.executionClass === "provider_text" && node.state === "planned").map((node, index) => ({
    ordinal: index + 1,
    scope: node.scope,
    platform: node.platform,
    stepId: node.stepId,
    capability: node.capability,
    inputContract: node.inputContract,
    outputContract: node.outputContract,
    executionClass: node.executionClass,
    phase: node.phase,
    maxAttempts: 1
  }));
  if (calls.length > MAX_TEXT_CALLS) fail("LIVE_TEXT_BUDGET_EXCEEDED");
  const duplicate = calls.find((call, index) => calls.findIndex((item) => item.platform === call.platform && item.capability === call.capability) !== index);
  if (duplicate) fail("LIVE_PER_SKILL_LIMIT_EXCEEDED", duplicate.capability);
  const phases = ["S1", "S2A", "S2B", "S3", "S4", "S5"];
  const stages = phases.map((phase) => stageProjection(phase, nodes));
  const skillCoverage = validateSkillCoverage(nodes);
  return {
    calls,
    nodes,
    stages,
    executionBudget: {
      providerTextCalls: calls.length,
      deterministicInvocations: nodes.filter((node) => node.executionClass === "deterministic" && node.state !== "skipped").length,
      providerMultimodalCalls: nodes.filter((node) => node.executionClass === "provider_multimodal" && node.state === "planned").length,
      conditionalProviderMultimodalCalls: nodes.filter((node) => node.executionClass === "provider_multimodal" && node.state === "waiting_condition").length,
      providerImageCalls: 0,
      automaticRetries: 0,
      maxAttemptsPerProviderTextSkill: 1
    },
    skillCoverage,
    currentStopPoint: "candidate_text_and_plan_only_no_provider_image_no_platform_publication"
  };
}

function exactFlagSnapshot(value) {
  const flags = exactObject(value, "featureFlags");
  if (Object.keys(flags).sort().join(",") !== [...FLAG_KEYS].sort().join(",")) fail("LIVE_FEATURE_FLAG_SET_INVALID");
  if (flags.unifiedContentProductionV1 !== true || typeof flags.xhsIntegratedPageDesignSkill !== "boolean") fail("LIVE_FEATURE_FLAG_STATE_INVALID");
  return flags;
}

export function prepareUnifiedLivePreflight({ approval, store, providerConfig, currentFlags = featureFlags(), sourceDatabasePath = approval?.sourceDatabasePath }) {
  exactObject(approval, "approval");
  if (approval.contract !== "UnifiedContentLiveApproval@1.0") fail("LIVE_APPROVAL_CONTRACT_INVALID");
  const flags = exactFlagSnapshot(approval.featureFlags);
  for (const key of FLAG_KEYS) if (currentFlags[key] !== flags[key]) fail("LIVE_FEATURE_FLAG_DRIFT", key);
  const provider = exactObject(approval.resolvedProvider, "resolvedProvider");
  for (const key of ["provider", "model", "protocol"]) exactText(provider[key], `resolvedProvider.${key}`);
  if (sha256(stableJson(providerConfig)) !== exactHash(provider.configHash, "resolvedProvider.configHash")) fail("LIVE_PROVIDER_CONFIG_DRIFT");
  const budget = exactObject(approval.budget, "budget");
  const expectedBudget = { maxTextCalls: 9, maxCallsPerSkill: 1, automaticRetries: 0, hotspotCalls: 0, imageCalls: 0, platformPublicationCalls: 0 };
  if (stableJson(budget) !== stableJson(expectedBudget)) fail("LIVE_BUDGET_INVALID");
  const targets = exactObject(approval.targets, "targets");
  const company = verifyBinding(store, targets.company, "targets.company");
  const strategyResolution = resolveCanonicalActiveStrategy(sourceDatabasePath, company, targets.activeStrategy);
  const strategy = strategyResolution.canonical;
  const accounts = Object.fromEntries(PLATFORMS.map((platform) => [platform, verifyBinding(store, targets.accounts?.[platform], `targets.accounts.${platform}`)]));
  const project = approval.orchestrationInput?.project;
  if (company.id !== project?.companyId || PLATFORMS.some((platform) => accounts[platform].id !== project?.accounts?.[platform])) fail("LIVE_TARGET_PROJECT_MISMATCH");
  if (accounts.xiaohongshu.platform !== "xiaohongshu" || accounts.wechat.platform !== "wechat") fail("LIVE_ACCOUNT_PLATFORM_MISMATCH");
  for (const [label, value] of [["strategy", strategy], ...PLATFORMS.map((platform) => [`account:${platform}`, accounts[platform]])]) {
    if (!ownerMatches(value, company.id)) fail("LIVE_TARGET_OWNERSHIP_MISMATCH", label);
  }
  if (strategy.id !== project.activeStrategySnapshotRef?.id) fail("LIVE_TARGET_REF_MISMATCH");
  if (targets.activeStrategy.payloadHash && project.activeStrategySnapshotRef.hash !== targets.activeStrategy.payloadHash) fail("LIVE_ACTIVE_STRATEGY_REF_HASH_MISMATCH");
  const opportunityResult = optionalPrerequisite(store, targets.contentOpportunity, "targets.contentOpportunity", "LIVE_CONTENT_OPPORTUNITY_MISSING", "ContentOpportunity", ["unifiedContentOpportunities"]);
  const mechanismResult = optionalPrerequisite(store, targets.mechanismDecision, "targets.mechanismDecision", "LIVE_MECHANISM_DECISION_MISSING", "ContentMechanismDecision", ["unifiedContentMechanismDecisions"]);
  const blockers = [opportunityResult.blocker, mechanismResult.blocker].filter(Boolean);
  if (blockers.length) {
    const error = Object.assign(new Error("Unified content prerequisites are missing"), { code: "LIVE_PREREQUISITES_MISSING", readiness: prerequisiteReadiness(blockers, strategy.id) });
    throw error;
  }
  const opportunity = opportunityResult.value;
  const mechanism = mechanismResult.value;
  for (const [label, value] of [["opportunity", opportunity], ["mechanism", mechanism]]) if (!ownerMatches(value, company.id)) fail("LIVE_TARGET_OWNERSHIP_MISMATCH", label);
  if (opportunity.id !== project.contentOpportunityRef?.id || mechanism.id !== approval.orchestrationInput?.mechanismDecision?.id) fail("LIVE_TARGET_REF_MISMATCH");
  try { validateUnifiedContentOpportunity(opportunity); } catch { fail("LIVE_OPPORTUNITY_CONTRACT_INVALID"); }
  if (opportunity.opportunityHash !== project.contentOpportunityRef.hash) fail("LIVE_OPPORTUNITY_HASH_MISMATCH");
  if (opportunity.accountRefs?.xiaohongshu?.id !== accounts.xiaohongshu.id || opportunity.accountRefs?.wechat?.id !== accounts.wechat.id) fail("LIVE_OPPORTUNITY_ACCOUNT_MISMATCH");
  if (opportunity.accountRefs.xiaohongshu.hash !== sha256(stableJson(accounts.xiaohongshu)) || opportunity.accountRefs.wechat.hash !== sha256(stableJson(accounts.wechat))) fail("LIVE_OPPORTUNITY_ACCOUNT_HASH_MISMATCH");
  const opportunityStrategyId = opportunity.activeStrategySnapshotRef?.id || opportunity.strategySnapshotRef?.id || opportunity.strategySnapshotId;
  if (!opportunityStrategyId || opportunityStrategyId !== strategy.id) fail("LIVE_OPPORTUNITY_STRATEGY_MISMATCH");
  if (opportunity.activeStrategySnapshotRef.hash !== project.activeStrategySnapshotRef.hash) fail("LIVE_OPPORTUNITY_STRATEGY_MISMATCH");
  validateContentMechanismDecision(mechanism);
  if (mechanism.activeStrategySnapshotRef?.id !== project.activeStrategySnapshotRef.id || mechanism.activeStrategySnapshotRef?.hash !== project.activeStrategySnapshotRef.hash) fail("LIVE_MECHANISM_STRATEGY_MISMATCH");
  const expectedProjectInputRef = buildUnifiedProjectInputRef({ companyId: company.id, accounts: project.accounts, activeStrategySnapshotRef: project.activeStrategySnapshotRef, contentOpportunityRef: project.contentOpportunityRef });
  if (mechanism.projectInputRef?.id !== expectedProjectInputRef.id || mechanism.projectInputRef?.hash !== expectedProjectInputRef.hash) fail("LIVE_MECHANISM_PROJECT_INPUT_MISMATCH");
  if (mechanism.decisionHash !== approval.orchestrationInput.mechanismDecision.decisionHash) fail("LIVE_MECHANISM_HASH_MISMATCH");
  if (mechanism.selectedMechanism !== "strategy_only" || mechanism.deviation?.status === "blocked") fail("LIVE_MECHANISM_NOT_APPROVED");
  const livePlan = buildCallPlan(approval, flags);
  const plan = {
    schemaVersion: "2.0",
    contract: "UnifiedContentLiveCallPlan@1.0",
    targets: structuredClone(targets),
    sourceDatabaseSha256: approval.sourceDatabaseSha256,
    destinationDatabaseSha256: approval.destinationDatabaseSha256,
    destinationDataDir: resolve(approval.destinationDataDir),
    resolvedProvider: structuredClone(provider),
    featureFlags: structuredClone(flags),
    budget: structuredClone(budget),
    calls: livePlan.calls,
    nodes: livePlan.nodes,
    stages: livePlan.stages,
    executionBudget: livePlan.executionBudget,
    skillCoverage: livePlan.skillCoverage,
    currentStopPoint: livePlan.currentStopPoint,
    externalPolicy: { hotspotCalls: 0, imageCalls: 0, platformPublicationCalls: 0, automaticRetries: 0 }
  };
  return { plan, planHash: sha256(stableJson(plan)), textCallCount: livePlan.calls.length, resolvedActiveStrategy: strategy };
}

export function inspectUnifiedLiveReadiness(input) {
  try {
    const preflight = prepareUnifiedLivePreflight(input);
    return { status: "ready", preflight, providerCalls: 0, externalCalls: 0, productionDatabaseWrites: 0 };
  } catch (error) {
    if (error?.code === "LIVE_PREREQUISITES_MISSING" && error.readiness) return error.readiness;
    throw error;
  }
}

function atomicWriteJson(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  renameSync(temp, path);
}

function safeLiveStop(error) {
  const clean = (value, fallback = null) => {
    if (value == null) return fallback;
    const result = String(value).replace(/[^a-z0-9_:-]/gi, "").slice(0, 80);
    return result || fallback;
  };
  return {
    code: clean(error?.causeCode || error?.code, "EXECUTION_STOPPED"),
    stage: clean(error?.stage),
    platform: clean(error?.platform),
    stepId: clean(error?.stepId),
    capability: clean(error?.capability),
    fieldPaths: sanitizeUnifiedSkillValidationFieldPaths(error?.fieldPaths)
  };
}

export function createAtomicProviderLedger({ path, plan, delegate }) {
  const state = { schemaVersion: "1.0", contract: "UnifiedContentLiveLedger@1.0", planHash: sha256(stableJson(plan)), halted: false, entries: [] };
  atomicWriteJson(path, state);
  return {
    state,
    generateText: async (...args) => {
      if (state.halted) fail("LIVE_LEDGER_HALTED");
      const expected = plan.calls[state.entries.length];
      if (!expected) { state.halted = true; atomicWriteJson(path, state); fail("LIVE_CALL_BUDGET_EXHAUSTED"); }
      const identity = args[1]?.liveInvocation;
      if (!identity || identity.ordinal !== expected.ordinal || identity.capability !== expected.capability || identity.platform !== expected.platform || identity.stepId !== expected.stepId) {
        state.halted = true;
        state.violation = {
          code: identity ? "LIVE_CALL_IDENTITY_MISMATCH" : "LIVE_CALL_IDENTITY_MISSING",
          expected: { ordinal: expected.ordinal, capability: expected.capability, platform: expected.platform, stepId: expected.stepId },
          actual: identity ? { ordinal: identity.ordinal, capability: identity.capability, platform: identity.platform, stepId: identity.stepId } : null,
          consumedEntries: state.entries.length
        };
        atomicWriteJson(path, state);
        fail(state.violation.code);
      }
      if (state.entries.some((item) => item.platform === expected.platform && item.capability === expected.capability)) { state.halted = true; atomicWriteJson(path, state); fail("LIVE_PER_SKILL_LIMIT_EXCEEDED"); }
      const entry = { ordinal: expected.ordinal, platform: expected.platform, stepId: expected.stepId, capability: expected.capability, status: "consumed_before_call" };
      state.entries.push(entry);
      atomicWriteJson(path, state);
      try {
        const result = await delegate(...args);
        const live = result?.mode === "live" && result?.telemetry?.providerSucceeded === true && result?.telemetry?.fallbackUsed !== true;
        if (!live) fail("LIVE_PROVIDER_RESULT_NOT_REAL");
        entry.status = "provider_succeeded";
        entry.evidence = { providerSucceeded: true, fallbackUsed: false, costStatus: result?.telemetry?.costStatus || "unknown" };
        atomicWriteJson(path, state);
        return result;
      } catch (error) {
        entry.status = "provider_failed";
        entry.errorCode = String(error?.code || "PROVIDER_FAILED").replace(/[^A-Z0-9_:-]/gi, "").slice(0, 80);
        state.halted = true;
        atomicWriteJson(path, state);
        throw error;
      }
    }
  };
}

export function copySourceDatabase({ sourceDatabasePath, destinationDataDir, expectedSourceHash, expectedDestinationHash }) {
  const paths = validateIsolationPaths({ sourceDatabasePath, destinationDataDir });
  const before = hashFile(paths.sourceDatabasePath);
  if (before !== exactHash(expectedSourceHash, "sourceDatabaseSha256")) fail("LIVE_SOURCE_HASH_MISMATCH");
  const approvedDestinationStateHash = exactHash(expectedDestinationHash, "destinationDatabaseSha256");
  const sourceStateHash = sha256(stableJson(readStoreFromDatabase(paths.sourceDatabasePath)));
  if (approvedDestinationStateHash !== sourceStateHash) fail("LIVE_DESTINATION_HASH_APPROVAL_MISMATCH");
  mkdirSync(paths.destinationDataDir, { recursive: true });
  rejectLinks(paths.destinationDataDir, allowedTmpRoot);
  const db = new DatabaseSync(paths.sourceDatabasePath, { readOnly: true });
  try { db.prepare("VACUUM INTO ?").run(paths.destinationDatabasePath); }
  finally { db.close(); }
  const after = hashFile(paths.sourceDatabasePath);
  const destinationHash = sha256(stableJson(readStoreFromDatabase(paths.destinationDatabasePath)));
  if (before !== after) fail("LIVE_SOURCE_DATABASE_CHANGED");
  if (destinationHash !== approvedDestinationStateHash) fail("LIVE_DESTINATION_HASH_MISMATCH");
  return { ...paths, sourceHash: before, destinationHash };
}

export async function executeUnifiedLive({ approval, approvalFileHash, operations = {} }) {
  if (approval.approved !== true || approval.mode !== "live" || !approval.approvedBy || !approval.approvedAt) fail("LIVE_EXPLICIT_APPROVAL_REQUIRED");
  exactHash(approvalFileHash, "detachedApprovalSha256");
  const sourceHash = hashFile(resolve(approval.sourceDatabasePath));
  if (sourceHash !== approval.sourceDatabaseSha256) fail("LIVE_SOURCE_HASH_MISMATCH");
  const sourceStore = readStoreFromDatabase(resolve(approval.sourceDatabasePath));
  const providerConfig = operations.providerConfig || await (operations.resolveProviderConfig || (async () => {
    const module = await import("../../provider-config.mjs");
    return module.getPublicProviderConfig();
  }))();
  const preflight = prepareUnifiedLivePreflight({ approval, store: sourceStore, providerConfig, currentFlags: operations.currentFlags || featureFlags(), sourceDatabasePath: approval.sourceDatabasePath });
  if (preflight.planHash !== approval.planHash) fail("LIVE_PLAN_HASH_MISMATCH");
  const copied = copySourceDatabase({ sourceDatabasePath: approval.sourceDatabasePath, destinationDataDir: approval.destinationDataDir, expectedSourceHash: approval.sourceDatabaseSha256, expectedDestinationHash: approval.destinationDatabaseSha256 });
  const ledgerPath = resolve(copied.destinationDataDir, "provider-ledger.json");
  const providerDelegate = operations.generateText || (await import("../../providers.mjs")).generateText;
  const ledger = createAtomicProviderLedger({ path: ledgerPath, plan: preflight.plan, delegate: providerDelegate });
  const runProductEntry = operations.runProductEntry || (async ({ dataDir, generateText }) => {
    process.env.FLOWSOCIAL_DATA_DIR = dataDir;
    const storage = await import(`${pathToFileURL(resolve(flowsocialRoot, "storage.mjs")).href}?live=${Date.now()}`);
    try {
      const adapter = await import("../../content-agent/unified-content-server-adapter.mjs");
      const store = storage.readStore();
      const result = await adapter.createUnifiedContentProductSnapshot(store, { requestId: approval.requestId, orchestrationInput: approval.orchestrationInput }, {
        generateText,
        liveExecution: true,
        resolveActiveStrategySnapshot: async () => structuredClone(preflight.resolvedActiveStrategy)
      });
      storage.writeStore(store);
      return result;
    } finally {
      storage.database.close();
    }
  });
  let product;
  try {
    product = await runProductEntry({ dataDir: copied.destinationDataDir, generateText: ledger.generateText, approval, plan: preflight.plan });
  } catch (error) {
    ledger.state.halted = true;
    ledger.state.stop = safeLiveStop(error);
    atomicWriteJson(ledgerPath, ledger.state);
    throw error;
  }
  if (ledger.state.entries.length !== preflight.plan.calls.length || ledger.state.entries.some((item) => item.status !== "provider_succeeded")) fail("LIVE_INVOCATION_COUNT_MISMATCH");
  if (!Array.isArray(product?.actualInvocations) || product.actualInvocations.length !== preflight.plan.calls.length) fail("LIVE_INVOCATION_EVIDENCE_MISMATCH");
  for (let index = 0; index < preflight.plan.calls.length; index += 1) {
    const expected = preflight.plan.calls[index];
    const actual = product.actualInvocations[index];
    if (actual?.platform !== expected.platform || actual?.stepId !== expected.stepId || actual?.capability !== expected.capability) fail("LIVE_INVOCATION_EVIDENCE_MISMATCH");
    if (actual.executionMode && actual.executionMode !== "real") fail("LIVE_INVOCATION_NOT_REAL");
    if (actual.status && actual.status !== "completed") fail("LIVE_INVOCATION_NOT_COMPLETED");
  }
  return {
    schemaVersion: "1.0",
    contract: "UnifiedContentLiveSummary@1.0",
    mode: "isolated_live",
    planHash: preflight.planHash,
    sourceDatabaseSha256: copied.sourceHash,
    destinationDatabaseSha256: copied.destinationHash,
    providerCalls: ledger.state.entries.length,
    textCalls: ledger.state.entries.length,
    imageCalls: 0,
    hotspotCalls: 0,
    platformPublicationCalls: 0,
    automaticRetries: 0,
    executionBudget: structuredClone(preflight.plan.executionBudget),
    stages: preflight.plan.stages.map((stage) => ({ id: stage.id, stageHash: stage.stageHash, budget: structuredClone(stage.budget), waitingConditions: structuredClone(stage.waitingConditions), stopPoint: stage.stopPoint })),
    skillCoverage: structuredClone(preflight.plan.skillCoverage),
    currentStopPoint: preflight.plan.currentStopPoint,
    productRef: { id: product.id, hash: product.productSnapshotHash },
    localArtifactOnly: true,
    platformPublished: false,
    ledgerPath
  };
}

export function loadApproval(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}
