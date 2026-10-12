export { hashUnifiedContent } from "../contracts/content-hash.mjs";
import { canonicalUnifiedContent, hashUnifiedContent } from "../contracts/content-hash.mjs";

export const UNIFIED_CONTENT_CONTRACTS = Object.freeze({
  contentProject: "ContentProject@1.0",
  contentOpportunity: "UnifiedContentOpportunity@1.0",
  projectInputRef: "UnifiedContentProjectInputRef@1.0",
  sharedContentMasterRef: "SharedContentMasterRef@1.0",
  platformRunRef: "PlatformRunRef@1.0",
  mechanismDecision: "ContentMechanismDecision@1.0",
  mechanismDecisionV2: "ContentMechanismDecision@2.0",
  mechanismDecisionV1CompatibilityView: "ContentMechanismDecisionV1CompatibilityView@1.0",
  mechanismUsageBinding: "ContentMechanismUsageBinding@1.0",
  mechanismExplanation: "MechanismExplanation@1.0",
  userSelection: "UserSelection@1.0",
  promotionRecord: "PromotionRecord@1.0",
  legacyProjection: "LegacyUnifiedContentProjection@1.0"
});

export const UNIFIED_CONTENT_STATES = Object.freeze([
  "planned",
  "generating",
  "candidate_ready",
  "machine_reviewed",
  "editorial_reviewed",
  "user_selected",
  "persisted",
  "delivery_ready",
  "publication_pending",
  "published",
  "feedback_pending"
]);

const PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const MECHANISMS = new Set(["hotspot", "knowledge", "blueprint", "strategy_only", "user_material"]);
const HASH = /^[a-f0-9]{64}$/;

export const UNIFIED_WRITER_CONTEXT_CONTRACT = "UnifiedWriterContext@1.0";

export function createUnifiedWriterContext(value) {
  const base = structuredClone(value || {});
  const requiredKeys = ["schemaVersion", "contract", "platform", "account_id", "topic_id", "intent_profile_id", "content_purpose_id", "account_context", "creative_mechanism", "journey_stage", "coordination_mode", "matrix_coordination", "authority_refs"];
  if (Object.keys(base).sort().join(",") !== requiredKeys.sort().join(",")
    || base.schemaVersion !== "1.0" || base.contract !== UNIFIED_WRITER_CONTEXT_CONTRACT
    || !["xiaohongshu", "wechat_official_account"].includes(base.platform)) throw Object.assign(new Error("Writer context shape is invalid"), { code: "UNIFIED_WRITER_CONTEXT_INVALID" });
  const text = (item) => typeof item === "string" && Boolean(item.trim());
  const string = (item) => typeof item === "string";
  const account = base.account_context;
  const matrix = base.matrix_coordination;
  const mechanisms = base.platform === "xiaohongshu"
    ? new Set(["search_answer", "checklist", "case_reconstruction", "contrast", "experiment", "opinion", "trend_bridge", "story"])
    : new Set(["search_answer", "framework", "case_reconstruction", "industry_analysis", "opinion", "trend_bridge", "story"]);
  const journeyStages = new Set(["discover", "understand", "trust", "consider", "convert", "retain"]);
  if (![base.account_id, base.topic_id, base.intent_profile_id, base.content_purpose_id, base.creative_mechanism, base.journey_stage].every(text)
    || !mechanisms.has(base.creative_mechanism) || !journeyStages.has(base.journey_stage)
    || !account || Object.keys(account).sort().join(",") !== ["account_mode", "matrix_role", "subject_type", "trust_source"].sort().join(",")
    || ![account.subject_type, account.account_mode, account.matrix_role, account.trust_source].every(text)
    || !["coordinated", "standalone"].includes(base.coordination_mode)
    || !matrix || Object.keys(matrix).sort().join(",") !== ["differentiation_angle", "prohibited_overlap", "shared_campaign_topic_id"].sort().join(",")
    || !string(matrix.shared_campaign_topic_id) || !text(matrix.differentiation_angle)
    || !Array.isArray(matrix.prohibited_overlap) || matrix.prohibited_overlap.some((item) => !text(item))
    || (base.coordination_mode === "coordinated" && !text(matrix.shared_campaign_topic_id))
    || (base.coordination_mode === "standalone" && matrix.shared_campaign_topic_id !== "")
    || !base.authority_refs || typeof base.authority_refs !== "object" || Array.isArray(base.authority_refs)) {
    throw Object.assign(new Error("Writer context fields are invalid"), { code: "UNIFIED_WRITER_CONTEXT_INVALID" });
  }
  return deepFreeze({ ...base, writerContextHash: hashUnifiedContent(base) });
}

export function withUnifiedContentHash(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return { ...copy, [field]: hashUnifiedContent(copy) };
}

function fail(code, detail) {
  throw Object.assign(new Error(`${code}${detail ? `: ${detail}` : ""}`), { code });
}

function exact(value, keys, scope) {
  object(value, scope);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalUnifiedContent(actual) !== canonicalUnifiedContent(expected)) fail(`${scope}:FIELDS`, `expected ${expected.join(",")}`);
}

function object(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${scope}:OBJECT`);
}

function text(value, scope) {
  if (typeof value !== "string" || !value.trim()) fail(`${scope}:TEXT`);
}

function iso(value, scope) {
  text(value, scope);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) fail(`${scope}:ISO_UTC`);
}

function hash(value, scope) {
  if (typeof value !== "string" || !HASH.test(value)) fail(`${scope}:HASH`);
}

function ref(value, scope) {
  exact(value, ["id", "hash"], scope);
  text(value.id, `${scope}.id`);
  hash(value.hash, `${scope}.hash`);
}

function nullableRef(value, scope) {
  if (value !== null) ref(value, scope);
}

function hashed(value, field, scope) {
  hash(value[field], `${scope}.${field}`);
  const copy = structuredClone(value);
  delete copy[field];
  if (hashUnifiedContent(copy) !== value[field]) fail(`${scope}:HASH_MISMATCH`);
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function uniqueRefs(values, scope) {
  const keys = new Set();
  for (const item of values) {
    ref(item, scope);
    const key = `${item.id}:${item.hash}`;
    if (keys.has(key)) fail(`${scope}:DUPLICATE`);
    keys.add(key);
  }
}

export function validateUnifiedContentOpportunity(value) {
  exact(value, ["schemaVersion", "contract", "id", "companyId", "accountRefs", "activeStrategySnapshotRef", "topic", "contentObjective", "status", "idempotencyKey", "semanticHash", "createdAt", "opportunityHash"], "UnifiedContentOpportunity");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.contentOpportunity) fail("UnifiedContentOpportunity:VERSION");
  for (const key of ["id", "companyId", "topic", "contentObjective", "idempotencyKey"]) text(value[key], `UnifiedContentOpportunity.${key}`);
  exact(value.accountRefs, ["xiaohongshu", "wechat"], "UnifiedContentOpportunity.accountRefs");
  ref(value.accountRefs.xiaohongshu, "UnifiedContentOpportunity.accountRefs.xiaohongshu");
  ref(value.accountRefs.wechat, "UnifiedContentOpportunity.accountRefs.wechat");
  ref(value.activeStrategySnapshotRef, "UnifiedContentOpportunity.activeStrategySnapshotRef");
  if (value.status !== "ready") fail("UnifiedContentOpportunity:STATUS");
  hash(value.semanticHash, "UnifiedContentOpportunity.semanticHash");
  iso(value.createdAt, "UnifiedContentOpportunity.createdAt");
  hashed(value, "opportunityHash", "UnifiedContentOpportunity");
  return value;
}

export function validateSharedContentMasterRef(value) {
  exact(value, ["schemaVersion", "contract", "id", "hash", "authorityContract", "authorityType"], "SharedContentMasterRef");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.sharedContentMasterRef) fail("SharedContentMasterRef:VERSION");
  text(value.id, "SharedContentMasterRef.id");
  hash(value.hash, "SharedContentMasterRef.hash");
  text(value.authorityContract, "SharedContentMasterRef.authorityContract");
  if (value.authorityType !== "shared_content_master") fail("SharedContentMasterRef:AUTHORITY_TYPE");
  if (!/^ContentMaster@/.test(value.authorityContract) && !/^SharedContentMaster@/.test(value.authorityContract)) fail("SharedContentMasterRef:PLATFORM_AUTHORITY_FORBIDDEN");
  if (/xiaohongshu|wechat|platform|package/i.test(value.authorityContract)) fail("SharedContentMasterRef:PLATFORM_AUTHORITY_FORBIDDEN");
  return value;
}

export function validatePlatformRunRef(value) {
  exact(value, ["schemaVersion", "contract", "id", "hash", "platform", "accountId", "sharedContentMasterRef", "platformBriefRef", "outlineRef", "writerInvocationRef", "candidateRefs", "finalVersionRef"], "PlatformRunRef");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.platformRunRef) fail("PlatformRunRef:VERSION");
  text(value.id, "PlatformRunRef.id");
  hash(value.hash, "PlatformRunRef.hash");
  if (!PLATFORMS.has(value.platform)) fail("PlatformRunRef:PLATFORM");
  text(value.accountId, "PlatformRunRef.accountId");
  validateSharedContentMasterRef(value.sharedContentMasterRef);
  ref(value.platformBriefRef, "PlatformRunRef.platformBriefRef");
  ref(value.outlineRef, "PlatformRunRef.outlineRef");
  ref(value.writerInvocationRef, "PlatformRunRef.writerInvocationRef");
  if (!Array.isArray(value.candidateRefs)) fail("PlatformRunRef.candidateRefs:ARRAY");
  uniqueRefs(value.candidateRefs, "PlatformRunRef.candidateRef");
  nullableRef(value.finalVersionRef, "PlatformRunRef.finalVersionRef");
  return value;
}

export function validateContentProject(value) {
  exact(value, ["schemaVersion", "contract", "id", "companyId", "contentOpportunityRef", "activeStrategySnapshotRef", "sharedContentMasterRef", "platformRuns", "state", "createdAt", "projectHash"], "ContentProject");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.contentProject) fail("ContentProject:VERSION");
  text(value.id, "ContentProject.id");
  text(value.companyId, "ContentProject.companyId");
  ref(value.contentOpportunityRef, "ContentProject.contentOpportunityRef");
  ref(value.activeStrategySnapshotRef, "ContentProject.activeStrategySnapshotRef");
  validateSharedContentMasterRef(value.sharedContentMasterRef);
  if (!Array.isArray(value.platformRuns) || value.platformRuns.length > 2) fail("ContentProject:PLATFORM_RUN_COUNT");
  const platforms = new Set();
  for (const run of value.platformRuns) {
    validatePlatformRunRef(run);
    if (platforms.has(run.platform)) fail("ContentProject:DUPLICATE_PLATFORM_RUN");
    platforms.add(run.platform);
    if (!sameRef(run.sharedContentMasterRef, value.sharedContentMasterRef)) fail("ContentProject:MASTER_REF_MISMATCH");
  }
  if (!UNIFIED_CONTENT_STATES.includes(value.state)) fail("ContentProject:STATE");
  iso(value.createdAt, "ContentProject.createdAt");
  hashed(value, "projectHash", "ContentProject");
  return value;
}

export function validateContentMechanismDecision(value) {
  const projectRefField = Object.hasOwn(value || {}, "projectInputRef") ? "projectInputRef" : "contentProjectRef";
  exact(value, ["schemaVersion", "contract", "id", "companyId", projectRefField, "activeStrategySnapshotRef", "evaluated", "selectedMechanism", "selectedSourceRefs", "strategyHotspotPolicy", "deviation", "decidedAt", "decisionHash"], "ContentMechanismDecision");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.mechanismDecision) fail("ContentMechanismDecision:VERSION");
  text(value.id, "ContentMechanismDecision.id");
  text(value.companyId, "ContentMechanismDecision.companyId");
  ref(value[projectRefField], `ContentMechanismDecision.${projectRefField}`);
  ref(value.activeStrategySnapshotRef, "ContentMechanismDecision.activeStrategySnapshotRef");
  if (!Array.isArray(value.evaluated) || !value.evaluated.length) fail("ContentMechanismDecision:EVALUATED_REQUIRED");
  const mechanisms = new Set();
  for (const item of value.evaluated) {
    exact(item, ["mechanism", "status", "candidateRefs", "reason", "factPolicy"], "ContentMechanismDecision.evaluated");
    if (!MECHANISMS.has(item.mechanism) || mechanisms.has(item.mechanism)) fail("ContentMechanismDecision:EVALUATED_MECHANISM");
    mechanisms.add(item.mechanism);
    if (!["selected", "rejected", "not_available"].includes(item.status)) fail("ContentMechanismDecision:EVALUATED_STATUS");
    if (!Array.isArray(item.candidateRefs)) fail("ContentMechanismDecision.candidateRefs:ARRAY");
    uniqueRefs(item.candidateRefs, "ContentMechanismDecision.candidateRef");
    if (item.status !== "selected") text(item.reason, "ContentMechanismDecision.reason");
    if (item.status === "selected" && item.reason !== null) text(item.reason, "ContentMechanismDecision.reason");
    if (item.mechanism === "hotspot" && item.factPolicy !== "external_event_not_business_fact") fail("ContentMechanismDecision:HOTSPOT_FACT_POLICY");
    if (item.mechanism !== "hotspot" && item.factPolicy !== null) fail("ContentMechanismDecision:NON_HOTSPOT_FACT_POLICY");
  }
  if (!MECHANISMS.has(value.selectedMechanism) || !mechanisms.has(value.selectedMechanism)) fail("ContentMechanismDecision:SELECTED_MECHANISM");
  const selected = value.evaluated.filter((item) => item.status === "selected");
  if (selected.length !== 1 || selected[0].mechanism !== value.selectedMechanism) fail("ContentMechanismDecision:SELECTION_INCONSISTENT");
  if (!Array.isArray(value.selectedSourceRefs)) fail("ContentMechanismDecision.selectedSourceRefs:ARRAY");
  uniqueRefs(value.selectedSourceRefs, "ContentMechanismDecision.selectedSourceRef");
  const candidateKeys = new Set(selected[0].candidateRefs.map((item) => `${item.id}:${item.hash}`));
  if (value.selectedSourceRefs.some((item) => !candidateKeys.has(`${item.id}:${item.hash}`))) fail("ContentMechanismDecision:SELECTED_SOURCE_NOT_EVALUATED");
  if (value.selectedMechanism !== "strategy_only" && !value.selectedSourceRefs.length) fail("ContentMechanismDecision:SELECTED_SOURCE_REQUIRED");
  if (!["required", "preferred", "optional", "disabled"].includes(value.strategyHotspotPolicy)) fail("ContentMechanismDecision:HOTSPOT_POLICY");
  exact(value.deviation, ["status", "reason", "userConfirmationStatus"], "ContentMechanismDecision.deviation");
  if (!["none", "degraded", "blocked"].includes(value.deviation.status)) fail("ContentMechanismDecision:DEVIATION_STATUS");
  if (!["not_required", "pending", "confirmed", "rejected"].includes(value.deviation.userConfirmationStatus)) fail("ContentMechanismDecision:CONFIRMATION_STATUS");
  const hotspotDeviation = ["required", "preferred"].includes(value.strategyHotspotPolicy) && value.selectedMechanism !== "hotspot";
  if (hotspotDeviation && value.deviation.status === "none") fail("ContentMechanismDecision:HOTSPOT_DEVIATION_UNRECORDED");
  if (hotspotDeviation && value.deviation.status === "degraded" && value.deviation.userConfirmationStatus !== "confirmed") fail("ContentMechanismDecision:HOTSPOT_DEGRADATION_CONFIRMATION_REQUIRED");
  if (value.deviation.status !== "none") text(value.deviation.reason, "ContentMechanismDecision.deviation.reason");
  if (value.deviation.status === "none" && (value.deviation.reason !== null || value.deviation.userConfirmationStatus !== "not_required")) fail("ContentMechanismDecision:DEVIATION_INCONSISTENT");
  iso(value.decidedAt, "ContentMechanismDecision.decidedAt");
  hashed(value, "decisionHash", "ContentMechanismDecision");
  return value;
}

const MECHANISM_V2_ROLES = new Set(["primary", "supporting", "not_selected"]);
const CANDIDATE_STATUSES = new Set(["selected", "rejected", "not_available"]);

export function validateContentMechanismDecisionV2(value) {
  exact(value, ["schemaVersion", "contract", "id", "companyId", "projectInputRef", "activeStrategySnapshotRef", "taxonomy", "mechanisms", "selectedSourceRefs", "strategyHotspotPolicy", "deviation", "decidedAt", "decisionHash"], "ContentMechanismDecisionV2");
  if (value.schemaVersion !== "2.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.mechanismDecisionV2) fail("ContentMechanismDecisionV2:VERSION");
  text(value.id, "ContentMechanismDecisionV2.id");
  text(value.companyId, "ContentMechanismDecisionV2.companyId");
  ref(value.projectInputRef, "ContentMechanismDecisionV2.projectInputRef");
  ref(value.activeStrategySnapshotRef, "ContentMechanismDecisionV2.activeStrategySnapshotRef");
  exact(value.taxonomy, ["sourceMechanismType", "creativeMechanismAuthority"], "ContentMechanismDecisionV2.taxonomy");
  if (value.taxonomy.sourceMechanismType !== "content_source_mechanism") fail("ContentMechanismDecisionV2:SOURCE_TAXONOMY");
  if (value.taxonomy.creativeMechanismAuthority !== "platform_writer_context") fail("ContentMechanismDecisionV2:CREATIVE_TAXONOMY");
  if (!Array.isArray(value.mechanisms) || !value.mechanisms.length) fail("ContentMechanismDecisionV2:MECHANISMS_REQUIRED");
  const mechanismNames = new Set();
  const candidateRefIds = new Set();
  const selectedRefs = [];
  let primaryCount = 0;
  for (const mechanism of value.mechanisms) {
    exact(mechanism, ["mechanism", "role", "evaluationStatus", "candidates", "reason", "factPolicy"], "ContentMechanismDecisionV2.mechanisms[]");
    if (!MECHANISMS.has(mechanism.mechanism) || mechanismNames.has(mechanism.mechanism)) fail("ContentMechanismDecisionV2:MECHANISM_UNIQUE");
    mechanismNames.add(mechanism.mechanism);
    if (!MECHANISM_V2_ROLES.has(mechanism.role)) fail("ContentMechanismDecisionV2:ROLE");
    if (mechanism.role === "primary") primaryCount += 1;
    if (!["evaluated", "not_evaluated"].includes(mechanism.evaluationStatus)) fail("ContentMechanismDecisionV2:EVALUATION_STATUS");
    text(mechanism.reason, "ContentMechanismDecisionV2.mechanisms[].reason");
    if (!Array.isArray(mechanism.candidates)) fail("ContentMechanismDecisionV2.mechanisms[].candidates:ARRAY");
    if (mechanism.evaluationStatus === "not_evaluated" && (mechanism.candidates.length || mechanism.role !== "not_selected")) fail("ContentMechanismDecisionV2:NOT_EVALUATED_INCONSISTENT");
    if (mechanism.role !== "not_selected" && mechanism.evaluationStatus !== "evaluated") fail("ContentMechanismDecisionV2:SELECTED_NOT_EVALUATED");
    const mechanismRefKeys = new Set();
    let selectedCount = 0;
    for (const candidate of mechanism.candidates) {
      exact(candidate, ["sourceRef", "status", "reason"], "ContentMechanismDecisionV2.mechanisms[].candidates[]");
      ref(candidate.sourceRef, "ContentMechanismDecisionV2.mechanisms[].candidates[].sourceRef");
      const key = `${candidate.sourceRef.id}:${candidate.sourceRef.hash}`;
      if (mechanismRefKeys.has(key)) fail("ContentMechanismDecisionV2:CANDIDATE_REF_DUPLICATE");
      mechanismRefKeys.add(key);
      if (candidateRefIds.has(candidate.sourceRef.id)) fail("ContentMechanismDecisionV2:CANDIDATE_REF_ID_DUPLICATE");
      candidateRefIds.add(candidate.sourceRef.id);
      if (!CANDIDATE_STATUSES.has(candidate.status)) fail("ContentMechanismDecisionV2:CANDIDATE_STATUS");
      text(candidate.reason, "ContentMechanismDecisionV2.mechanisms[].candidates[].reason");
      if (candidate.status === "selected") { selectedCount += 1; selectedRefs.push(candidate.sourceRef); }
    }
    if (mechanism.role === "not_selected" && selectedCount) fail("ContentMechanismDecisionV2:UNOWNED_SELECTED_CANDIDATE");
    if (["primary", "supporting"].includes(mechanism.role) && mechanism.mechanism !== "strategy_only" && selectedCount === 0) fail("ContentMechanismDecisionV2:SELECTED_CANDIDATE_REQUIRED");
    if (mechanism.mechanism === "strategy_only" && mechanism.candidates.length) fail("ContentMechanismDecisionV2:STRATEGY_ONLY_CANDIDATE_FORBIDDEN");
    if (mechanism.mechanism === "hotspot" && mechanism.factPolicy !== "external_event_not_business_fact") fail("ContentMechanismDecisionV2:HOTSPOT_FACT_POLICY");
    if (mechanism.mechanism !== "hotspot" && mechanism.factPolicy !== null) fail("ContentMechanismDecisionV2:NON_HOTSPOT_FACT_POLICY");
  }
  if (primaryCount !== 1) fail("ContentMechanismDecisionV2:PRIMARY_COUNT");
  if (!Array.isArray(value.selectedSourceRefs)) fail("ContentMechanismDecisionV2.selectedSourceRefs:ARRAY");
  uniqueRefs(value.selectedSourceRefs, "ContentMechanismDecisionV2.selectedSourceRefs[]");
  if (new Set(value.selectedSourceRefs.map((item) => item.id)).size !== value.selectedSourceRefs.length) fail("ContentMechanismDecisionV2:SELECTED_SOURCE_ID_DUPLICATE");
  const selectedKeys = [...new Set(selectedRefs.map((item) => `${item.id}:${item.hash}`))].sort();
  const declaredKeys = value.selectedSourceRefs.map((item) => `${item.id}:${item.hash}`).sort();
  if (canonicalUnifiedContent(selectedKeys) !== canonicalUnifiedContent(declaredKeys)) fail("ContentMechanismDecisionV2:SELECTED_SOURCE_SET_MISMATCH");
  if (!["required", "preferred", "optional", "disabled"].includes(value.strategyHotspotPolicy)) fail("ContentMechanismDecisionV2:HOTSPOT_POLICY");
  const hotspotSelected = value.mechanisms.some((item) => item.mechanism === "hotspot" && ["primary", "supporting"].includes(item.role) && item.candidates.some((candidate) => candidate.status === "selected"));
  if (value.strategyHotspotPolicy === "disabled" && hotspotSelected) fail("ContentMechanismDecisionV2:HOTSPOT_DISABLED");
  exact(value.deviation, ["status", "reason", "confirmationEventRef"], "ContentMechanismDecisionV2.deviation");
  if (!["none", "degraded", "blocked"].includes(value.deviation.status)) fail("ContentMechanismDecisionV2:DEVIATION_STATUS");
  const hotspotDeviation = ["required", "preferred"].includes(value.strategyHotspotPolicy) && !hotspotSelected;
  if (hotspotDeviation && !["degraded", "blocked"].includes(value.deviation.status)) fail("ContentMechanismDecisionV2:HOTSPOT_DEVIATION_UNRECORDED");
  if (hotspotDeviation && value.deviation.status === "degraded") ref(value.deviation.confirmationEventRef, "ContentMechanismDecisionV2.deviation.confirmationEventRef");
  if (hotspotDeviation && value.deviation.status === "blocked" && value.deviation.confirmationEventRef !== null) fail("ContentMechanismDecisionV2:BLOCKED_CONFIRMATION_FORBIDDEN");
  if (value.deviation.status !== "none") text(value.deviation.reason, "ContentMechanismDecisionV2.deviation.reason");
  if (!hotspotDeviation && (value.deviation.status !== "none" || value.deviation.reason !== null || value.deviation.confirmationEventRef !== null)) fail("ContentMechanismDecisionV2:DEVIATION_INCONSISTENT");
  iso(value.decidedAt, "ContentMechanismDecisionV2.decidedAt");
  hashed(value, "decisionHash", "ContentMechanismDecisionV2");
  return value;
}

export function validateContentMechanismDecisionV1CompatibilityView(value) {
  exact(value, ["schemaVersion", "contract", "sourceDecisionRef", "provenance", "view", "viewHash"], "ContentMechanismDecisionV1CompatibilityView");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.mechanismDecisionV1CompatibilityView) fail("ContentMechanismDecisionV1CompatibilityView:VERSION");
  ref(value.sourceDecisionRef, "ContentMechanismDecisionV1CompatibilityView.sourceDecisionRef");
  exact(value.provenance, ["kind", "readOnly", "promotionEligible", "nativeV2"], "ContentMechanismDecisionV1CompatibilityView.provenance");
  if (value.provenance.kind !== "derived_from_content_mechanism_decision_v1"
    || value.provenance.readOnly !== true
    || value.provenance.promotionEligible !== false
    || value.provenance.nativeV2 !== false) fail("ContentMechanismDecisionV1CompatibilityView:PROVENANCE");
  exact(value.view, ["sourceContract", "primaryMechanism", "selectedSourceRefs", "secondaryMechanisms", "candidateLevelDecisions", "actualUse"], "ContentMechanismDecisionV1CompatibilityView.view");
  if (value.view.sourceContract !== UNIFIED_CONTENT_CONTRACTS.mechanismDecision) fail("ContentMechanismDecisionV1CompatibilityView:SOURCE_CONTRACT");
  if (!MECHANISMS.has(value.view.primaryMechanism)) fail("ContentMechanismDecisionV1CompatibilityView:PRIMARY");
  uniqueRefs(value.view.selectedSourceRefs, "ContentMechanismDecisionV1CompatibilityView.view.selectedSourceRefs[]");
  if ([value.view.secondaryMechanisms, value.view.candidateLevelDecisions, value.view.actualUse].some((item) => item !== "unknown")) fail("ContentMechanismDecisionV1CompatibilityView:UNKNOWN_REQUIRED");
  hashed(value, "viewHash", "ContentMechanismDecisionV1CompatibilityView");
  return value;
}

export function createContentMechanismDecisionV1CompatibilityView(value) {
  validateContentMechanismDecision(value);
  const before = hashUnifiedContent(value);
  const compatibilityView = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: UNIFIED_CONTENT_CONTRACTS.mechanismDecisionV1CompatibilityView,
    sourceDecisionRef: { id: value.id, hash: value.decisionHash },
    provenance: { kind: "derived_from_content_mechanism_decision_v1", readOnly: true, promotionEligible: false, nativeV2: false },
    view: {
      sourceContract: UNIFIED_CONTENT_CONTRACTS.mechanismDecision,
      primaryMechanism: value.selectedMechanism,
      selectedSourceRefs: structuredClone(value.selectedSourceRefs),
      secondaryMechanisms: "unknown",
      candidateLevelDecisions: "unknown",
      actualUse: "unknown"
    },
    viewHash: ""
  }, "viewHash");
  validateContentMechanismDecisionV1CompatibilityView(compatibilityView);
  if (hashUnifiedContent(value) !== before) fail("ContentMechanismDecisionV1CompatibilityView:INPUT_MUTATED");
  return deepFreeze(compatibilityView);
}

const USAGE_BINDING_KEYS = ["schemaVersion", "contract", "id", "companyId", "accountId", "decisionRef", "sourcePlanRef", "sharedContentMasterRef", "platformRunRef", "evidenceRefs", "plannedSourceRefs", "writerReceivedSourceRefs", "provenUsedSourceRefs", "sourceUsage", "creativeMechanism", "boundAt", "bindingHash"];

function refKey(value) {
  return `${value.id}:${value.hash}`;
}

function refSetEqual(left, right) {
  return canonicalUnifiedContent([...new Set(left.map(refKey))].sort()) === canonicalUnifiedContent([...new Set(right.map(refKey))].sort());
}

function refsSubset(values, allowed) {
  const allowedKeys = new Set(allowed.map(refKey));
  return values.every((item) => allowedKeys.has(refKey(item)));
}

export function validateContentMechanismUsageBinding(value) {
  exact(value, USAGE_BINDING_KEYS, "ContentMechanismUsageBinding");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.mechanismUsageBinding) fail("ContentMechanismUsageBinding:VERSION");
  text(value.id, "ContentMechanismUsageBinding.id");
  text(value.companyId, "ContentMechanismUsageBinding.companyId");
  text(value.accountId, "ContentMechanismUsageBinding.accountId");
  for (const [name, valueRef] of [["decisionRef", value.decisionRef], ["sourcePlanRef", value.sourcePlanRef], ["sharedContentMasterRef", value.sharedContentMasterRef], ["platformRunRef", value.platformRunRef]]) ref(valueRef, `ContentMechanismUsageBinding.${name}`);
  exact(value.evidenceRefs, ["writer", "traces"], "ContentMechanismUsageBinding.evidenceRefs");
  ref(value.evidenceRefs.writer, "ContentMechanismUsageBinding.evidenceRefs.writer");
  if (!Array.isArray(value.evidenceRefs.traces)) fail("ContentMechanismUsageBinding.evidenceRefs.traces:ARRAY");
  uniqueRefs(value.evidenceRefs.traces, "ContentMechanismUsageBinding.evidenceRefs.traces[]");
  for (const [name, values] of [["plannedSourceRefs", value.plannedSourceRefs], ["writerReceivedSourceRefs", value.writerReceivedSourceRefs], ["provenUsedSourceRefs", value.provenUsedSourceRefs]]) {
    if (!Array.isArray(values)) fail(`ContentMechanismUsageBinding.${name}:ARRAY`);
    uniqueRefs(values, `ContentMechanismUsageBinding.${name}[]`);
    if (new Set(values.map((item) => item.id)).size !== values.length) fail(`ContentMechanismUsageBinding:${name.toUpperCase()}_ID_DUPLICATE`);
  }
  if (!refsSubset(value.writerReceivedSourceRefs, value.plannedSourceRefs)) fail("ContentMechanismUsageBinding:WRITER_RECEIVED_NOT_PLANNED");
  if (!refsSubset(value.provenUsedSourceRefs, value.writerReceivedSourceRefs)) fail("ContentMechanismUsageBinding:PROVEN_USED_NOT_RECEIVED");
  if (!Array.isArray(value.sourceUsage) || value.sourceUsage.length !== value.plannedSourceRefs.length) fail("ContentMechanismUsageBinding:SOURCE_USAGE_COUNT");
  const usageRefs = [];
  for (const usage of value.sourceUsage) {
    exact(usage, ["sourceRef", "status", "reason", "evidenceRefs"], "ContentMechanismUsageBinding.sourceUsage[]");
    ref(usage.sourceRef, "ContentMechanismUsageBinding.sourceUsage[].sourceRef");
    usageRefs.push(usage.sourceRef);
    if (!["used", "unused", "unknown_not_proven"].includes(usage.status)) fail("ContentMechanismUsageBinding:SOURCE_USAGE_STATUS");
    text(usage.reason, "ContentMechanismUsageBinding.sourceUsage[].reason");
    if (!Array.isArray(usage.evidenceRefs)) fail("ContentMechanismUsageBinding.sourceUsage[].evidenceRefs:ARRAY");
    uniqueRefs(usage.evidenceRefs, "ContentMechanismUsageBinding.sourceUsage[].evidenceRefs[]");
    const isProvenUsed = value.provenUsedSourceRefs.some((item) => refKey(item) === refKey(usage.sourceRef));
    const wasReceived = value.writerReceivedSourceRefs.some((item) => refKey(item) === refKey(usage.sourceRef));
    if (usage.status === "used" && (!isProvenUsed || !usage.evidenceRefs.length || !refsSubset(usage.evidenceRefs, value.evidenceRefs.traces))) fail("ContentMechanismUsageBinding:USED_EVIDENCE_REQUIRED");
    if (usage.status === "unused" && (isProvenUsed || !usage.evidenceRefs.length
      || (wasReceived ? !refsSubset(usage.evidenceRefs, value.evidenceRefs.traces) : !refSetEqual(usage.evidenceRefs, [value.evidenceRefs.writer])))) fail("ContentMechanismUsageBinding:UNUSED_EVIDENCE_REQUIRED");
    if (usage.status === "unknown_not_proven" && (isProvenUsed || !wasReceived || usage.evidenceRefs.length)) fail("ContentMechanismUsageBinding:UNKNOWN_EVIDENCE_FORBIDDEN");
  }
  if (!refSetEqual(usageRefs, value.plannedSourceRefs)) fail("ContentMechanismUsageBinding:SOURCE_USAGE_SET_MISMATCH");
  if (!refSetEqual(value.sourceUsage.filter((item) => item.status === "used").map((item) => item.sourceRef), value.provenUsedSourceRefs)) fail("ContentMechanismUsageBinding:USED_SET_MISMATCH");
  exact(value.creativeMechanism, ["strategyRequested", "strategyRequestRef", "writerContextValue", "writerContextRef", "alignment", "reason", "confirmationEventRef"], "ContentMechanismUsageBinding.creativeMechanism");
  text(value.creativeMechanism.strategyRequested, "ContentMechanismUsageBinding.creativeMechanism.strategyRequested");
  ref(value.creativeMechanism.strategyRequestRef, "ContentMechanismUsageBinding.creativeMechanism.strategyRequestRef");
  text(value.creativeMechanism.writerContextValue, "ContentMechanismUsageBinding.creativeMechanism.writerContextValue");
  ref(value.creativeMechanism.writerContextRef, "ContentMechanismUsageBinding.creativeMechanism.writerContextRef");
  if (!["aligned", "deviated"].includes(value.creativeMechanism.alignment)) fail("ContentMechanismUsageBinding:CREATIVE_ALIGNMENT");
  const actuallyAligned = value.creativeMechanism.strategyRequested === value.creativeMechanism.writerContextValue;
  if ((value.creativeMechanism.alignment === "aligned") !== actuallyAligned) fail("ContentMechanismUsageBinding:CREATIVE_ALIGNMENT_INCONSISTENT");
  if (actuallyAligned && (value.creativeMechanism.reason !== null || value.creativeMechanism.confirmationEventRef !== null)) fail("ContentMechanismUsageBinding:CREATIVE_ALIGNED_EXTRAS");
  if (!actuallyAligned) {
    text(value.creativeMechanism.reason, "ContentMechanismUsageBinding.creativeMechanism.reason");
    ref(value.creativeMechanism.confirmationEventRef, "ContentMechanismUsageBinding.creativeMechanism.confirmationEventRef");
  }
  iso(value.boundAt, "ContentMechanismUsageBinding.boundAt");
  hashed(value, "bindingHash", "ContentMechanismUsageBinding");
  return value;
}

function verifyHashedEvidence(evidence, evidenceRef, contract, scope) {
  exact(evidenceRef, ["id", "hash"], `${scope}Ref`);
  ref(evidenceRef, `${scope}Ref`);
  object(evidence, scope);
  if (evidence.contract !== contract || evidence.id !== evidenceRef.id || hashUnifiedContent(evidence) !== evidenceRef.hash) fail(`${scope}:REF_HASH_MISMATCH`);
}

function verifyUsageConfirmationEvent(event, eventRef) {
  verifyHashedEvidence(event, eventRef, "ContentMechanismConfirmationEvent@1.0", "ContentMechanismUsageBinding.confirmationEvent");
  exact(event, ["contract", "id", "status", "confirmedByType", "confirmedAt"], "ContentMechanismUsageBinding.confirmationEvent");
  if (event.status !== "confirmed" || event.confirmedByType !== "user") fail("ContentMechanismUsageBinding:CONFIRMATION_USER_REQUIRED");
  iso(event.confirmedAt, "ContentMechanismUsageBinding.confirmationEvent.confirmedAt");
}

export function createContentMechanismUsageBinding({
  id, accountId, decision, decisionRef, sourcePlan, sourcePlanRef, sharedContentMasterRef, platformRunRef,
  writerEvidence, writerEvidenceRef, traceEvidence = [], strategyCreativeMechanismRequest, strategyRequestRef,
  writerContext, writerContextRef, creativeDeviationReason = null, confirmationEvent = null,
  confirmationEventRef = null, boundAt = new Date().toISOString()
}) {
  validateContentMechanismDecisionV2(decision);
  if (decisionRef?.id !== decision.id || decisionRef?.hash !== decision.decisionHash) fail("ContentMechanismUsageBinding:DECISION_REF_MISMATCH");
  ref(sourcePlanRef, "ContentMechanismUsageBinding.sourcePlanRef");
  if (sourcePlanRef.hash !== hashUnifiedContent(sourcePlan)) fail("ContentMechanismUsageBinding:SOURCE_PLAN_REF_MISMATCH");
  ref(sharedContentMasterRef, "ContentMechanismUsageBinding.sharedContentMasterRef");
  ref(platformRunRef, "ContentMechanismUsageBinding.platformRunRef");
  verifyHashedEvidence(writerEvidence, writerEvidenceRef, "WriterMechanismEvidence@1.0", "ContentMechanismUsageBinding.writerEvidence");
  exact(writerEvidence, ["contract", "id", "decisionRef", "sourcePlanRef", "sharedContentMasterRef", "platformRunRef", "writerContextRef", "receivedSourceRefs", "creativeMechanism"], "ContentMechanismUsageBinding.writerEvidence");
  if (![writerEvidence.decisionRef, writerEvidence.sourcePlanRef, writerEvidence.sharedContentMasterRef, writerEvidence.platformRunRef].every((item, index) => sameRef(item, [decisionRef, sourcePlanRef, sharedContentMasterRef, platformRunRef][index]))) fail("ContentMechanismUsageBinding:WRITER_AUTHORITY_MISMATCH");
  if (!Array.isArray(writerEvidence.receivedSourceRefs)) fail("ContentMechanismUsageBinding.writerEvidence.receivedSourceRefs:ARRAY");
  uniqueRefs(writerEvidence.receivedSourceRefs, "ContentMechanismUsageBinding.writerEvidence.receivedSourceRefs[]");
  const traceRefs = [];
  const usedEvidence = new Map();
  const unusedEvidence = new Map();
  if (!Array.isArray(traceEvidence)) fail("ContentMechanismUsageBinding.traceEvidence:ARRAY");
  for (const item of traceEvidence) {
    exact(item, ["evidence", "ref"], "ContentMechanismUsageBinding.traceEvidence[]");
    verifyHashedEvidence(item.evidence, item.ref, "MechanismTraceEvidence@1.0", "ContentMechanismUsageBinding.traceEvidence[].evidence");
    exact(item.evidence, ["contract", "id", "writerEvidenceRef", "usedSourceRefs", "unusedSourceRefs"], "ContentMechanismUsageBinding.traceEvidence[].evidence");
    if (!sameRef(item.evidence.writerEvidenceRef, writerEvidenceRef)) fail("ContentMechanismUsageBinding:TRACE_WRITER_REF_MISMATCH");
    for (const key of ["usedSourceRefs", "unusedSourceRefs"]) {
      if (!Array.isArray(item.evidence[key])) fail(`ContentMechanismUsageBinding.traceEvidence[].evidence.${key}:ARRAY`);
      uniqueRefs(item.evidence[key], `ContentMechanismUsageBinding.traceEvidence[].evidence.${key}[]`);
    }
    if (item.evidence.usedSourceRefs.some((sourceRef) => item.evidence.unusedSourceRefs.some((unusedRef) => refKey(sourceRef) === refKey(unusedRef)))) fail("ContentMechanismUsageBinding:TRACE_STATUS_CONFLICT");
    traceRefs.push(item.ref);
    for (const sourceRef of item.evidence.usedSourceRefs) usedEvidence.set(refKey(sourceRef), [...(usedEvidence.get(refKey(sourceRef)) || []), item.ref]);
    for (const sourceRef of item.evidence.unusedSourceRefs) unusedEvidence.set(refKey(sourceRef), [...(unusedEvidence.get(refKey(sourceRef)) || []), item.ref]);
  }
  uniqueRefs(traceRefs, "ContentMechanismUsageBinding.traceEvidence[].ref");
  const plannedSourceRefs = structuredClone(decision.selectedSourceRefs);
  if (!refsSubset(writerEvidence.receivedSourceRefs, plannedSourceRefs)) fail("ContentMechanismUsageBinding:WRITER_RECEIVED_NOT_PLANNED");
  const traceSourceRefs = [...usedEvidence.keys(), ...unusedEvidence.keys()];
  const plannedKeys = new Set(plannedSourceRefs.map(refKey));
  if (traceSourceRefs.some((key) => !plannedKeys.has(key))) fail("ContentMechanismUsageBinding:TRACE_SOURCE_NOT_PLANNED");
  if ([...usedEvidence.keys()].some((key) => unusedEvidence.has(key))) fail("ContentMechanismUsageBinding:TRACE_STATUS_CONFLICT");
  const receivedKeys = new Set(writerEvidence.receivedSourceRefs.map(refKey));
  if ([...usedEvidence.keys()].some((key) => !receivedKeys.has(key))) fail("ContentMechanismUsageBinding:PROVEN_USED_NOT_RECEIVED");
  const provenUsedSourceRefs = plannedSourceRefs.filter((sourceRef) => usedEvidence.has(refKey(sourceRef)));
  const sourceUsage = plannedSourceRefs.map((sourceRef) => {
    const key = refKey(sourceRef);
    if (usedEvidence.has(key)) return { sourceRef: structuredClone(sourceRef), status: "used", reason: "proven_by_deterministic_trace", evidenceRefs: structuredClone(usedEvidence.get(key)) };
    if (unusedEvidence.has(key)) return { sourceRef: structuredClone(sourceRef), status: "unused", reason: "proven_unused_by_deterministic_trace", evidenceRefs: structuredClone(unusedEvidence.get(key)) };
    if (!receivedKeys.has(key)) return { sourceRef: structuredClone(sourceRef), status: "unused", reason: "not_received_by_writer", evidenceRefs: [structuredClone(writerEvidenceRef)] };
    return { sourceRef: structuredClone(sourceRef), status: "unknown_not_proven", reason: "no_deterministic_usage_evidence", evidenceRefs: [] };
  });
  verifyHashedEvidence(strategyCreativeMechanismRequest, strategyRequestRef, "StrategyCreativeMechanismRequest@1.0", "ContentMechanismUsageBinding.strategyCreativeMechanismRequest");
  exact(strategyCreativeMechanismRequest, ["contract", "id", "mechanism"], "ContentMechanismUsageBinding.strategyCreativeMechanismRequest");
  text(strategyCreativeMechanismRequest.mechanism, "ContentMechanismUsageBinding.strategyCreativeMechanismRequest.mechanism");
  ref(writerContextRef, "ContentMechanismUsageBinding.writerContextRef");
  object(writerContext, "ContentMechanismUsageBinding.writerContext");
  if (writerContext.contract !== UNIFIED_WRITER_CONTEXT_CONTRACT || writerContext.writerContextHash !== writerContextRef.hash) fail("ContentMechanismUsageBinding.writerContext:REF_HASH_MISMATCH");
  const writerContextCopy = structuredClone(writerContext);
  delete writerContextCopy.writerContextHash;
  if (hashUnifiedContent(writerContextCopy) !== writerContext.writerContextHash) fail("ContentMechanismUsageBinding.writerContext:REF_HASH_MISMATCH");
  if (!sameRef(writerEvidence.writerContextRef, writerContextRef) || writerEvidence.creativeMechanism !== writerContext.creative_mechanism) fail("ContentMechanismUsageBinding:WRITER_CONTEXT_MISMATCH");
  const creativeAligned = strategyCreativeMechanismRequest.mechanism === writerContext.creative_mechanism;
  if (!creativeAligned) {
    text(creativeDeviationReason, "ContentMechanismUsageBinding.creativeDeviationReason");
    verifyUsageConfirmationEvent(confirmationEvent, confirmationEventRef);
  } else if (creativeDeviationReason !== null || confirmationEvent !== null || confirmationEventRef !== null) fail("ContentMechanismUsageBinding:CREATIVE_ALIGNED_EXTRAS");
  const draft = {
    schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.mechanismUsageBinding, id, companyId: decision.companyId, accountId,
    decisionRef: structuredClone(decisionRef), sourcePlanRef: structuredClone(sourcePlanRef), sharedContentMasterRef: structuredClone(sharedContentMasterRef), platformRunRef: structuredClone(platformRunRef),
    evidenceRefs: { writer: structuredClone(writerEvidenceRef), traces: structuredClone(traceRefs) },
    plannedSourceRefs, writerReceivedSourceRefs: structuredClone(writerEvidence.receivedSourceRefs), provenUsedSourceRefs, sourceUsage,
    creativeMechanism: {
      strategyRequested: strategyCreativeMechanismRequest.mechanism, strategyRequestRef: structuredClone(strategyRequestRef),
      writerContextValue: writerContext.creative_mechanism, writerContextRef: structuredClone(writerContextRef),
      alignment: creativeAligned ? "aligned" : "deviated", reason: creativeAligned ? null : creativeDeviationReason,
      confirmationEventRef: creativeAligned ? null : structuredClone(confirmationEventRef)
    },
    boundAt, bindingHash: ""
  };
  const value = withUnifiedContentHash(draft, "bindingHash");
  validateContentMechanismUsageBinding(value);
  return deepFreeze(value);
}

export function validateMechanismExplanation(value) {
  exact(value, ["schemaVersion", "contract", "sourceBindingRef", "provenance", "planning", "actualUse", "creativeMechanism", "explanationHash"], "MechanismExplanation");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.mechanismExplanation) fail("MechanismExplanation:VERSION");
  ref(value.sourceBindingRef, "MechanismExplanation.sourceBindingRef");
  exact(value.provenance, ["kind", "readOnly", "promotionEligible", "nativeUsageBinding"], "MechanismExplanation.provenance");
  if (value.provenance.kind !== "derived_from_content_mechanism_usage_binding" || value.provenance.readOnly !== true || value.provenance.promotionEligible !== false || value.provenance.nativeUsageBinding !== false) fail("MechanismExplanation:PROVENANCE");
  exact(value.planning, ["decisionRef", "sourcePlanRef", "plannedSourceRefs"], "MechanismExplanation.planning");
  ref(value.planning.decisionRef, "MechanismExplanation.planning.decisionRef");
  ref(value.planning.sourcePlanRef, "MechanismExplanation.planning.sourcePlanRef");
  if (!Array.isArray(value.planning.plannedSourceRefs)) fail("MechanismExplanation.planning.plannedSourceRefs:ARRAY");
  uniqueRefs(value.planning.plannedSourceRefs, "MechanismExplanation.planning.plannedSourceRefs[]");
  exact(value.actualUse, ["writerEvidenceRef", "traceEvidenceRefs", "writerReceivedSourceRefs", "provenUsedSourceRefs", "sourceUsage", "evidenceBoundary"], "MechanismExplanation.actualUse");
  ref(value.actualUse.writerEvidenceRef, "MechanismExplanation.actualUse.writerEvidenceRef");
  for (const key of ["traceEvidenceRefs", "writerReceivedSourceRefs", "provenUsedSourceRefs"]) if (!Array.isArray(value.actualUse[key])) fail(`MechanismExplanation.actualUse.${key}:ARRAY`);
  uniqueRefs(value.actualUse.traceEvidenceRefs, "MechanismExplanation.actualUse.traceEvidenceRefs[]");
  uniqueRefs(value.actualUse.writerReceivedSourceRefs, "MechanismExplanation.actualUse.writerReceivedSourceRefs[]");
  uniqueRefs(value.actualUse.provenUsedSourceRefs, "MechanismExplanation.actualUse.provenUsedSourceRefs[]");
  if (!Array.isArray(value.actualUse.sourceUsage)) fail("MechanismExplanation.actualUse.sourceUsage:ARRAY");
  if (value.actualUse.evidenceBoundary !== "deterministic_refs_only_no_natural_language_inference") fail("MechanismExplanation:EVIDENCE_BOUNDARY");
  if (!refsSubset(value.actualUse.writerReceivedSourceRefs, value.planning.plannedSourceRefs)) fail("MechanismExplanation:WRITER_RECEIVED_NOT_PLANNED");
  if (!refsSubset(value.actualUse.provenUsedSourceRefs, value.actualUse.writerReceivedSourceRefs)) fail("MechanismExplanation:PROVEN_USED_NOT_RECEIVED");
  const explanationUsageRefs = [];
  for (const usage of value.actualUse.sourceUsage) {
    exact(usage, ["sourceRef", "status", "reason", "evidenceRefs"], "MechanismExplanation.actualUse.sourceUsage[]");
    ref(usage.sourceRef, "MechanismExplanation.actualUse.sourceUsage[].sourceRef");
    explanationUsageRefs.push(usage.sourceRef);
    if (!["used", "unused", "unknown_not_proven"].includes(usage.status)) fail("MechanismExplanation:SOURCE_USAGE_STATUS");
    text(usage.reason, "MechanismExplanation.actualUse.sourceUsage[].reason");
    if (!Array.isArray(usage.evidenceRefs)) fail("MechanismExplanation.actualUse.sourceUsage[].evidenceRefs:ARRAY");
    uniqueRefs(usage.evidenceRefs, "MechanismExplanation.actualUse.sourceUsage[].evidenceRefs[]");
  }
  if (!refSetEqual(explanationUsageRefs, value.planning.plannedSourceRefs)) fail("MechanismExplanation:SOURCE_USAGE_SET_MISMATCH");
  if (!refSetEqual(value.actualUse.sourceUsage.filter((item) => item.status === "used").map((item) => item.sourceRef), value.actualUse.provenUsedSourceRefs)) fail("MechanismExplanation:USED_SET_MISMATCH");
  exact(value.creativeMechanism, ["strategyRequested", "writerContextValue", "alignment", "reason", "confirmationEventRef"], "MechanismExplanation.creativeMechanism");
  text(value.creativeMechanism.strategyRequested, "MechanismExplanation.creativeMechanism.strategyRequested");
  text(value.creativeMechanism.writerContextValue, "MechanismExplanation.creativeMechanism.writerContextValue");
  if (!["aligned", "deviated"].includes(value.creativeMechanism.alignment)) fail("MechanismExplanation:CREATIVE_ALIGNMENT");
  const explanationActuallyAligned = value.creativeMechanism.strategyRequested === value.creativeMechanism.writerContextValue;
  if ((value.creativeMechanism.alignment === "aligned") !== explanationActuallyAligned) fail("MechanismExplanation:CREATIVE_ALIGNMENT_INCONSISTENT");
  if (value.creativeMechanism.alignment === "aligned" && (value.creativeMechanism.reason !== null || value.creativeMechanism.confirmationEventRef !== null)) fail("MechanismExplanation:CREATIVE_ALIGNED_EXTRAS");
  if (value.creativeMechanism.alignment === "deviated") { text(value.creativeMechanism.reason, "MechanismExplanation.creativeMechanism.reason"); ref(value.creativeMechanism.confirmationEventRef, "MechanismExplanation.creativeMechanism.confirmationEventRef"); }
  hashed(value, "explanationHash", "MechanismExplanation");
  return value;
}

export function createMechanismExplanation(value) {
  validateContentMechanismUsageBinding(value);
  const explanation = withUnifiedContentHash({
    schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.mechanismExplanation,
    sourceBindingRef: { id: value.id, hash: value.bindingHash },
    provenance: { kind: "derived_from_content_mechanism_usage_binding", readOnly: true, promotionEligible: false, nativeUsageBinding: false },
    planning: { decisionRef: structuredClone(value.decisionRef), sourcePlanRef: structuredClone(value.sourcePlanRef), plannedSourceRefs: structuredClone(value.plannedSourceRefs) },
    actualUse: {
      writerEvidenceRef: structuredClone(value.evidenceRefs.writer), traceEvidenceRefs: structuredClone(value.evidenceRefs.traces),
      writerReceivedSourceRefs: structuredClone(value.writerReceivedSourceRefs), provenUsedSourceRefs: structuredClone(value.provenUsedSourceRefs),
      sourceUsage: structuredClone(value.sourceUsage), evidenceBoundary: "deterministic_refs_only_no_natural_language_inference"
    },
    creativeMechanism: {
      strategyRequested: value.creativeMechanism.strategyRequested, writerContextValue: value.creativeMechanism.writerContextValue,
      alignment: value.creativeMechanism.alignment, reason: value.creativeMechanism.reason,
      confirmationEventRef: structuredClone(value.creativeMechanism.confirmationEventRef)
    },
    explanationHash: ""
  }, "explanationHash");
  validateMechanismExplanation(explanation);
  return deepFreeze(explanation);
}

export function validateUserSelection(value) {
  exact(value, ["schemaVersion", "contract", "id", "platform", "platformRunRef", "selectedBy", "selectedByType", "finalTitleRef", "finalBodyVersionRef", "pageRevisionRefs", "selectionEventRefs", "confirmation", "confirmedAt", "selectionHash"], "UserSelection");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.userSelection) fail("UserSelection:VERSION");
  text(value.id, "UserSelection.id");
  if (!PLATFORMS.has(value.platform)) fail("UserSelection:PLATFORM");
  ref(value.platformRunRef, "UserSelection.platformRunRef");
  text(value.selectedBy, "UserSelection.selectedBy");
  if (value.selectedByType !== "user") fail("UserSelection:EXPLICIT_USER_REQUIRED");
  ref(value.finalTitleRef, "UserSelection.finalTitleRef");
  ref(value.finalBodyVersionRef, "UserSelection.finalBodyVersionRef");
  if (!Array.isArray(value.pageRevisionRefs)) fail("UserSelection.pageRevisionRefs:ARRAY");
  uniqueRefs(value.pageRevisionRefs, "UserSelection.pageRevisionRef");
  if (value.platform === "xiaohongshu" && !value.pageRevisionRefs.length) fail("UserSelection:XHS_PAGE_SELECTION_REQUIRED");
  if (!Array.isArray(value.selectionEventRefs) || !value.selectionEventRefs.length) fail("UserSelection:EVENT_REQUIRED");
  uniqueRefs(value.selectionEventRefs, "UserSelection.selectionEventRef");
  if (value.confirmation !== "explicit_user_confirmed") fail("UserSelection:CONFIRMATION_REQUIRED");
  iso(value.confirmedAt, "UserSelection.confirmedAt");
  hashed(value, "selectionHash", "UserSelection");
  return value;
}

export function validatePromotionRecord(value, bindings = {}) {
  exact(value, ["schemaVersion", "contract", "id", "companyId", "accountId", "contentProjectRef", "platformRunRef", "sharedContentMasterRef", "activeStrategySnapshotRef", "editorialReview", "userSelection", "sourceManifestRef", "deliveryArtifactRef", "promotedVersionRef", "idempotencyKey", "provenance", "promotedAt", "promotionHash"], "PromotionRecord");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.promotionRecord) fail("PromotionRecord:VERSION");
  for (const key of ["id", "companyId", "accountId", "idempotencyKey"]) text(value[key], `PromotionRecord.${key}`);
  ref(value.contentProjectRef, "PromotionRecord.contentProjectRef");
  ref(value.platformRunRef, "PromotionRecord.platformRunRef");
  validateSharedContentMasterRef(value.sharedContentMasterRef);
  ref(value.activeStrategySnapshotRef, "PromotionRecord.activeStrategySnapshotRef");
  exact(value.editorialReview, ["ref", "status"], "PromotionRecord.editorialReview");
  ref(value.editorialReview.ref, "PromotionRecord.editorialReview.ref");
  if (value.editorialReview.status !== "passed") fail("PromotionRecord:EDITORIAL_REVIEW_REQUIRED");
  exact(value.userSelection, ["ref", "status"], "PromotionRecord.userSelection");
  ref(value.userSelection.ref, "PromotionRecord.userSelection.ref");
  if (value.userSelection.status !== "confirmed") fail("PromotionRecord:USER_SELECTION_REQUIRED");
  ref(value.sourceManifestRef, "PromotionRecord.sourceManifestRef");
  ref(value.deliveryArtifactRef, "PromotionRecord.deliveryArtifactRef");
  ref(value.promotedVersionRef, "PromotionRecord.promotedVersionRef");
  if (!["native_shared_master", "legacy_isolated", "legacy_single_platform"].includes(value.provenance)) fail("PromotionRecord:PROVENANCE");
  iso(value.promotedAt, "PromotionRecord.promotedAt");
  if (bindings.project) {
    validateContentProject(bindings.project);
    if (!sameRef(value.contentProjectRef, { id: bindings.project.id, hash: bindings.project.projectHash })) fail("PromotionRecord:PROJECT_MISMATCH");
    if (value.companyId !== bindings.project.companyId) fail("PromotionRecord:COMPANY_MISMATCH");
    if (!sameRef(value.sharedContentMasterRef, bindings.project.sharedContentMasterRef)) fail("PromotionRecord:MASTER_MISMATCH");
    if (!sameRef(value.activeStrategySnapshotRef, bindings.project.activeStrategySnapshotRef)) fail("PromotionRecord:STRATEGY_MISMATCH");
  }
  if (bindings.platformRun) {
    validatePlatformRunRef(bindings.platformRun);
    if (!sameRef(value.platformRunRef, { id: bindings.platformRun.id, hash: bindings.platformRun.hash })) fail("PromotionRecord:PLATFORM_RUN_MISMATCH");
    if (value.accountId !== bindings.platformRun.accountId) fail("PromotionRecord:ACCOUNT_MISMATCH");
    if (!sameRef(value.sharedContentMasterRef, bindings.platformRun.sharedContentMasterRef)) fail("PromotionRecord:MASTER_MISMATCH");
  }
  if (bindings.selection) {
    validateUserSelection(bindings.selection);
    if (!sameRef(value.userSelection.ref, { id: bindings.selection.id, hash: bindings.selection.selectionHash })) fail("PromotionRecord:SELECTION_MISMATCH");
    if (!sameRef(bindings.selection.platformRunRef, value.platformRunRef)) fail("PromotionRecord:SELECTION_RUN_MISMATCH");
  }
  hashed(value, "promotionHash", "PromotionRecord");
  return value;
}

export function validatePromotionRecordSet(records) {
  if (!Array.isArray(records)) fail("PromotionRecordSet:ARRAY");
  const keys = new Map();
  for (const record of records) {
    validatePromotionRecord(record);
    const existing = keys.get(record.idempotencyKey);
    if (existing && existing !== record.promotionHash) fail("PromotionRecordSet:IDEMPOTENCY_CONFLICT");
    keys.set(record.idempotencyKey, record.promotionHash);
  }
  return records;
}

export function validateUnifiedContentStateTransition(from, to) {
  const fromIndex = UNIFIED_CONTENT_STATES.indexOf(from);
  const toIndex = UNIFIED_CONTENT_STATES.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) fail("UnifiedContentState:UNKNOWN");
  if (toIndex !== fromIndex + 1) fail(toIndex <= fromIndex ? "UnifiedContentState:NON_FORWARD" : "UnifiedContentState:SKIP_FORBIDDEN");
  return { from, to, status: "allowed" };
}

export function validateUnifiedContentStateHistory(history) {
  if (!Array.isArray(history) || !history.length) fail("UnifiedContentStateHistory:REQUIRED");
  history.forEach((entry, index) => {
    exact(entry, ["state", "at", "eventRef"], "UnifiedContentStateHistory.entry");
    if (!UNIFIED_CONTENT_STATES.includes(entry.state)) fail("UnifiedContentStateHistory:STATE");
    iso(entry.at, "UnifiedContentStateHistory.at");
    ref(entry.eventRef, "UnifiedContentStateHistory.eventRef");
    if (index === 0 && entry.state !== "planned") fail("UnifiedContentStateHistory:MUST_START_PLANNED");
    if (index > 0) validateUnifiedContentStateTransition(history[index - 1].state, entry.state);
  });
  return history;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function adaptLegacyReadOnly(input, provenance) {
  object(input, "LegacyInput");
  const before = hashUnifiedContent(input);
  const legacy = structuredClone(input);
  const legacyHash = hashUnifiedContent(legacy);
  const platform = PLATFORMS.has(legacy.platform) ? legacy.platform : null;
  const base = {
    schemaVersion: "1.0",
    contract: UNIFIED_CONTENT_CONTRACTS.legacyProjection,
    id: `legacy-projection:${legacyHash.slice(0, 24)}`,
    provenance,
    legacyRef: { id: legacy.id || legacy.contentTaskId || `legacy:${legacyHash.slice(0, 16)}`, hash: legacyHash },
    platform,
    sharedContentMasterRef: null,
    platformRunRef: platform ? { id: legacy.runId || legacy.contentRunId || legacy.id || `run:${legacyHash.slice(0, 16)}`, hash: legacyHash } : null,
    promotionEligible: false,
    blockers: ["LEGACY_SHARED_MASTER_AUTHORITY_UNPROVEN", "LEGACY_USER_SELECTION_UNPROVEN", "LEGACY_PROMOTION_REQUIRES_EXPLICIT_REVIEW"],
    projectionHash: ""
  };
  const projection = withUnifiedContentHash(base, "projectionHash");
  validateLegacyUnifiedContentProjection(projection);
  if (hashUnifiedContent(input) !== before) fail("LegacyAdapter:INPUT_MUTATED");
  return deepFreeze(projection);
}

export function validateLegacyUnifiedContentProjection(value) {
  exact(value, ["schemaVersion", "contract", "id", "provenance", "legacyRef", "platform", "sharedContentMasterRef", "platformRunRef", "promotionEligible", "blockers", "projectionHash"], "LegacyUnifiedContentProjection");
  if (value.schemaVersion !== "1.0" || value.contract !== UNIFIED_CONTENT_CONTRACTS.legacyProjection) fail("LegacyUnifiedContentProjection:VERSION");
  text(value.id, "LegacyUnifiedContentProjection.id");
  if (!["legacy_isolated", "legacy_single_platform"].includes(value.provenance)) fail("LegacyUnifiedContentProjection:PROVENANCE");
  ref(value.legacyRef, "LegacyUnifiedContentProjection.legacyRef");
  if (value.platform !== null && !PLATFORMS.has(value.platform)) fail("LegacyUnifiedContentProjection:PLATFORM");
  if (value.sharedContentMasterRef !== null) fail("LegacyUnifiedContentProjection:MASTER_AUTHORITY_FORBIDDEN");
  nullableRef(value.platformRunRef, "LegacyUnifiedContentProjection.platformRunRef");
  if (value.promotionEligible !== false) fail("LegacyUnifiedContentProjection:PROMOTION_FORBIDDEN");
  if (!Array.isArray(value.blockers) || !value.blockers.length || value.blockers.some((item) => typeof item !== "string" || !item)) fail("LegacyUnifiedContentProjection:BLOCKERS_REQUIRED");
  hashed(value, "projectionHash", "LegacyUnifiedContentProjection");
  return value;
}

export function adaptLegacySinglePlatformRunReadOnly(input) {
  return adaptLegacyReadOnly(input, "legacy_single_platform");
}

export function adaptLegacyIsolatedPackageReadOnly(input) {
  return adaptLegacyReadOnly(input, "legacy_isolated");
}
