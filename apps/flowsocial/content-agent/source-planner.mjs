import { assertContract, validateContentSourcePlanContract } from "./contracts.mjs";
import { contentFunctionForRole, resolvePurposePolicy } from "./content-policy.mjs";
import {
  UNIFIED_CONTENT_CONTRACTS,
  hashUnifiedContent,
  validateContentMechanismDecision,
  validateContentMechanismDecisionV2,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";

function activeHotspots(hotspots = []) {
  return hotspots.filter((item) =>
    !["ignored", "expired", "archived"].includes(item.status)
    && item.lifecycle !== "expired"
  );
}

function contentFunctionForBrief(brief) {
  return brief.contentFunction || contentFunctionForRole(brief.contentRole, brief.format);
}

function reviewedBlueprint(item = {}) {
  const humanApproved = Boolean(item.approvedBy && item.approvedAt)
    || item.review?.decision === "approved"
    || item.review?.status === "approved";
  return item.productionReady === true
    && ["approved", "testing", "validated"].includes(item.lifecycle)
    && humanApproved;
}

function matchingBlueprints(blueprints = [], brief) {
  const platform = brief.platform;
  const topic = brief.topic || "";
  const contentFunction = contentFunctionForBrief(brief);
  return blueprints.filter((item) => {
    const platforms = item.bestFor || item.suitablePlatforms || item.blueprint?.bestFor || [];
    const topics = item.suitableTopics || item.blueprint?.suitableTopics || [];
    const functions = item.applicableFunctions || [];
    const itemPlatform = item.platform || null;
    const platformMatch = (!platforms.length || platforms.includes(platform)) && (!itemPlatform || itemPlatform === "unknown" || itemPlatform === platform);
    const topicMatch = !topics.length || topics.some((value) => topic.includes(value) || value.includes(topic));
    const functionMatch = !functions.length || functions.includes(contentFunction);
    return reviewedBlueprint(item) && platformMatch && topicMatch && functionMatch;
  });
}

function sourceId(item = {}) {
  return item.id || item.fileId || null;
}

function contentRef(id, value) {
  return { id, hash: hashUnifiedContent(value) };
}

const AUTHORITY_HASH = /^[a-f0-9]{64}$/;

function mechanismV2AuthorityFail(code) {
  throw Object.assign(new Error(code), { code });
}

function exactAuthorityRef(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === ["hash", "id"].join(",")
    && typeof value.id === "string" && Boolean(value.id.trim())
    && AUTHORITY_HASH.test(value.hash || ""));
}

function sameAuthorityRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

export function buildCanonicalUnifiedProjectInputRef(projectInput) {
  const expectedKeys = ["accounts", "activeStrategySnapshotRef", "companyId", "contentOpportunityRef", "contract", "schemaVersion"].sort();
  if (!projectInput || typeof projectInput !== "object" || Array.isArray(projectInput)
    || JSON.stringify(Object.keys(projectInput).sort()) !== JSON.stringify(expectedKeys)
    || projectInput.schemaVersion !== "1.0"
    || projectInput.contract !== "UnifiedContentProjectInput@1.0"
    || typeof projectInput.companyId !== "string" || !projectInput.companyId.trim()
    || !projectInput.accounts || typeof projectInput.accounts !== "object" || Array.isArray(projectInput.accounts)
    || JSON.stringify(Object.keys(projectInput.accounts).sort()) !== JSON.stringify(["wechat", "xiaohongshu"])
    || ![projectInput.accounts.xiaohongshu, projectInput.accounts.wechat].every((item) => typeof item === "string" && Boolean(item.trim()))
    || !exactAuthorityRef(projectInput.activeStrategySnapshotRef)
    || !exactAuthorityRef(projectInput.contentOpportunityRef)) {
    mechanismV2AuthorityFail("ContentMechanismDecisionV2:PROJECT_INPUT_PREIMAGE");
  }
  const hash = hashUnifiedContent(projectInput);
  return { id: `unified_project_input:${hash.slice(0, 24)}`, hash };
}

function resolveActiveStrategyAuthorityRef({ suppliedRef, projectSeed, strategySeed, strategyContext }) {
  if (suppliedRef == null) return contentRef(projectSeed.strategySnapshotId || "strategy_snapshot:unknown", strategySeed);
  if (!exactAuthorityRef(suppliedRef)) mechanismV2AuthorityFail("ContentMechanismDecisionV2:ACTIVE_STRATEGY_REF");
  if (!strategyContext?.strategySnapshot || typeof strategyContext.strategySnapshot !== "object" || Array.isArray(strategyContext.strategySnapshot)) {
    mechanismV2AuthorityFail("ContentMechanismDecisionV2:ACTIVE_STRATEGY_PREIMAGE");
  }
  const expected = contentRef(projectSeed.strategySnapshotId || "strategy_snapshot:unknown", strategyContext.strategySnapshot);
  if (!sameAuthorityRef(suppliedRef, expected)) mechanismV2AuthorityFail("ContentMechanismDecisionV2:ACTIVE_STRATEGY_REF_MISMATCH");
  return structuredClone(suppliedRef);
}

function resolveProjectInputAuthorityRef({ suppliedRef, projectInput, projectSeed, activeStrategySnapshotRef }) {
  if (suppliedRef == null && projectInput == null) {
    return contentRef(`content_project_input:${hashUnifiedContent(projectSeed).slice(0, 24)}`, projectSeed);
  }
  if (suppliedRef == null || projectInput == null) mechanismV2AuthorityFail("ContentMechanismDecisionV2:PROJECT_INPUT_AUTHORITY_PAIR_REQUIRED");
  if (!exactAuthorityRef(suppliedRef)) mechanismV2AuthorityFail("ContentMechanismDecisionV2:PROJECT_INPUT_REF");
  const expected = buildCanonicalUnifiedProjectInputRef(projectInput);
  if (projectInput.companyId !== projectSeed.companyId
    || !sameAuthorityRef(projectInput.activeStrategySnapshotRef, activeStrategySnapshotRef)) {
    mechanismV2AuthorityFail("ContentMechanismDecisionV2:PROJECT_INPUT_PREIMAGE");
  }
  if (!sameAuthorityRef(suppliedRef, expected)) mechanismV2AuthorityFail("ContentMechanismDecisionV2:PROJECT_INPUT_REF_MISMATCH");
  return structuredClone(suppliedRef);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function hotspotPolicy(strategyContext = {}) {
  const value = strategyContext.strategyHotspotPolicy
    || strategyContext.hotspotPolicy
    || strategyContext.contentPolicy?.hotspot
    || strategyContext.accountStrategy?.hotspotPolicy;
  return ["required", "preferred", "optional", "disabled"].includes(value) ? value : "optional";
}

function confirmationStatus(confirmation = null) {
  if (confirmation?.status === "rejected" && confirmation.confirmedByType === "user" && confirmation.eventRef) return "rejected";
  if (confirmation?.status === "confirmed" && confirmation.confirmedByType === "user" && confirmation.eventRef) return "confirmed";
  return "pending";
}

function candidateRefs(type, items = []) {
  return items.filter((item) => sourceId(item)).map((item) => contentRef(sourceId(item), {
    type,
    source: sourceAsset(type === "knowledge" ? "knowledge_base" : type, item)
  }));
}

const SOURCE_TYPE_TO_MECHANISM = Object.freeze({
  hotspot: "hotspot",
  knowledge_base: "knowledge",
  strategy_facts: "knowledge",
  viral_blueprint: "blueprint",
  user_material: "user_material"
});

function mechanismSourceRef(mechanism, sourceType, source) {
  const id = sourceId(source);
  return id ? contentRef(id, { mechanism, sourceType, source: structuredClone(source) }) : null;
}

export function resolveFrozenContentSourcePlanRefs(sourcePlan) {
  if (!sourcePlan || typeof sourcePlan !== "object" || Array.isArray(sourcePlan) || !Array.isArray(sourcePlan.sources)) {
    throw Object.assign(new Error("ContentMechanismDecisionV2 source plan is invalid"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN" });
  }
  const inputHash = hashUnifiedContent(sourcePlan);
  const refs = [];
  const sourceIds = new Set();
  for (const source of sourcePlan.sources) {
    const mechanism = SOURCE_TYPE_TO_MECHANISM[source?.type];
    if (!mechanism) continue;
    const ids = Array.isArray(source?.candidateIds) ? source.candidateIds : null;
    if (!ids) throw Object.assign(new Error("ContentMechanismDecisionV2 source plan candidates are invalid"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_CANDIDATES" });
    if (source.assets != null && !Array.isArray(source.assets)) {
      throw Object.assign(new Error("ContentMechanismDecisionV2 source plan assets are invalid"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_ASSETS" });
    }
    const assets = source.assets || [];
    const assetIds = new Set();
    for (const asset of assets) {
      const assetId = sourceId(asset);
      if (!assetId) throw Object.assign(new Error("ContentMechanismDecisionV2 source plan asset is invalid"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_ASSET_REF" });
      if (assetIds.has(assetId)) throw Object.assign(new Error("ContentMechanismDecisionV2 source plan asset ids are duplicated"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_ASSET_ID_DUPLICATE" });
      assetIds.add(assetId);
    }
    for (const id of ids) {
      if (typeof id !== "string" || !id.trim()) throw Object.assign(new Error("ContentMechanismDecisionV2 source plan ref is invalid"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_REF" });
      if (sourceIds.has(id)) throw Object.assign(new Error("ContentMechanismDecisionV2 source plan ref ids are duplicated"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_REF_ID_DUPLICATE" });
      sourceIds.add(id);
      const asset = assets.find((item) => sourceId(item) === id) || { id };
      const sourceRef = mechanismSourceRef(mechanism, source.type, asset);
      if (!sourceRef) throw Object.assign(new Error("ContentMechanismDecisionV2 source ref is invalid"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_REF" });
      refs.push(sourceRef);
    }
  }
  if (hashUnifiedContent(sourcePlan) !== inputHash) throw Object.assign(new Error("ContentMechanismDecisionV2 source plan was mutated"), { code: "ContentMechanismDecisionV2:SOURCE_PLAN_MUTATED" });
  return deepFreeze(refs);
}

export function buildContentMechanismDecisionV2({
  brief,
  strategyContext,
  sourcePlan,
  mechanismEvaluations,
  projectInput = null,
  projectInputRef = null,
  activeStrategySnapshotRef = null,
  confirmationEvent = null,
  confirmationEventRef = null,
  decidedAt = new Date().toISOString()
}) {
  if (!Array.isArray(mechanismEvaluations)) throw Object.assign(new Error("ContentMechanismDecisionV2 evaluations are invalid"), { code: "ContentMechanismDecisionV2:MECHANISM_EVALUATIONS" });
  const mechanisms = mechanismEvaluations.map((evaluation) => ({
    mechanism: evaluation?.mechanism,
    role: evaluation?.role,
    evaluationStatus: evaluation?.evaluationStatus,
    candidates: Array.isArray(evaluation?.candidates) ? evaluation.candidates.map((candidate) => ({
      sourceRef: mechanismSourceRef(evaluation.mechanism, candidate?.sourceType, candidate?.source),
      status: candidate?.status,
      reason: candidate?.reason
    })) : evaluation?.candidates,
    reason: evaluation?.reason,
    factPolicy: evaluation?.mechanism === "hotspot" ? "external_event_not_business_fact" : null
  }));
  const selectedSourceRefs = mechanisms
    .flatMap((mechanism) => Array.isArray(mechanism.candidates) ? mechanism.candidates : [])
    .filter((candidate) => candidate?.status === "selected")
    .map((candidate) => candidate.sourceRef);
  const frozenRefs = resolveFrozenContentSourcePlanRefs(sourcePlan);
  const selectedKeys = selectedSourceRefs.map((item) => item && `${item.id}:${item.hash}`).sort();
  const frozenKeys = frozenRefs.map((item) => `${item.id}:${item.hash}`).sort();
  if (JSON.stringify(selectedKeys) !== JSON.stringify(frozenKeys)) {
    throw Object.assign(new Error("ContentMechanismDecisionV2 selected refs do not match frozen SourcePlan"), { code: "ContentMechanismDecisionV2:FROZEN_SOURCE_REF_MISMATCH" });
  }
  let verifiedConfirmationRef = null;
  if (confirmationEvent !== null || confirmationEventRef !== null) {
    const eventValid = confirmationEvent && typeof confirmationEvent === "object" && !Array.isArray(confirmationEvent)
      && Object.keys(confirmationEvent).sort().join(",") === ["confirmedAt", "confirmedByType", "contract", "id", "status"].sort().join(",")
      && confirmationEvent.contract === "ContentMechanismConfirmationEvent@1.0"
      && confirmationEvent.status === "confirmed"
      && confirmationEvent.confirmedByType === "user"
      && typeof confirmationEvent.id === "string" && Boolean(confirmationEvent.id.trim())
      && typeof confirmationEvent.confirmedAt === "string" && !Number.isNaN(Date.parse(confirmationEvent.confirmedAt));
    const refValid = eventValid && confirmationEventRef
      && typeof confirmationEventRef.id === "string" && confirmationEventRef.id.trim()
      && /^[a-f0-9]{64}$/.test(confirmationEventRef.hash || "")
      && confirmationEventRef.id === confirmationEvent.id
      && confirmationEventRef.hash === hashUnifiedContent(confirmationEvent);
    if (!refValid) throw Object.assign(new Error("ContentMechanismDecisionV2 confirmation ref is invalid"), { code: "ContentMechanismDecisionV2:CONFIRMATION_EVENT_REF" });
    verifiedConfirmationRef = structuredClone(confirmationEventRef);
  }
  const policy = hotspotPolicy(strategyContext);
  const hotspotSelected = mechanisms.some((mechanism) => mechanism.mechanism === "hotspot" && ["primary", "supporting"].includes(mechanism.role) && Array.isArray(mechanism.candidates) && mechanism.candidates.some((candidate) => candidate.status === "selected"));
  const hotspotDeviation = ["required", "preferred"].includes(policy) && !hotspotSelected;
  const projectSeed = {
    companyId: strategyContext.companyId || strategyContext.accountId || brief.accountId,
    strategySnapshotId: strategyContext.strategySnapshotId || brief.strategySnapshotId,
    topic: brief.topic,
    platform: brief.platform
  };
  const strategySeed = strategyContext.strategySnapshot || {
    id: strategyContext.strategySnapshotId || brief.strategySnapshotId,
    decisionHash: strategyContext.strategyDecisionHash || strategyContext.decisionProvenance?.decisionHash || null
  };
  const resolvedActiveStrategySnapshotRef = resolveActiveStrategyAuthorityRef({
    suppliedRef: activeStrategySnapshotRef,
    projectSeed,
    strategySeed,
    strategyContext
  });
  const resolvedProjectInputRef = resolveProjectInputAuthorityRef({
    suppliedRef: projectInputRef,
    projectInput,
    projectSeed,
    activeStrategySnapshotRef: resolvedActiveStrategySnapshotRef
  });
  const decision = withUnifiedContentHash({
    schemaVersion: "2.0",
    contract: UNIFIED_CONTENT_CONTRACTS.mechanismDecisionV2,
    id: `mechanism_decision_v2:${hashUnifiedContent({ projectSeed, mechanisms, selectedSourceRefs }).slice(0, 24)}`,
    companyId: projectSeed.companyId,
    projectInputRef: resolvedProjectInputRef,
    activeStrategySnapshotRef: resolvedActiveStrategySnapshotRef,
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms,
    selectedSourceRefs,
    strategyHotspotPolicy: policy,
    deviation: hotspotDeviation ? {
      status: verifiedConfirmationRef ? "degraded" : "blocked",
      reason: "strategy_hotspot_policy_not_satisfied_by_frozen_source_plan",
      confirmationEventRef: verifiedConfirmationRef
    } : { status: "none", reason: null, confirmationEventRef: null },
    decidedAt,
    decisionHash: ""
  }, "decisionHash");
  validateContentMechanismDecisionV2(decision);
  return deepFreeze(structuredClone(decision));
}

export function buildContentMechanismDecision({
  brief,
  strategyContext,
  usableHotspots = [],
  knowledgeItems = [],
  strategyFacts = [],
  matchedBlueprints = [],
  writingMaterials = [],
  selectedMechanism,
  confirmation = null,
  decidedAt = new Date().toISOString()
}) {
  const policy = hotspotPolicy(strategyContext);
  const candidates = {
    hotspot: candidateRefs("hotspot", usableHotspots),
    knowledge: [
      ...candidateRefs("knowledge", knowledgeItems),
      ...candidateRefs("knowledge", strategyFacts)
    ],
    blueprint: candidateRefs("viral_blueprint", matchedBlueprints),
    user_material: candidateRefs("user_material", writingMaterials),
    strategy_only: []
  };
  const selected = candidates[selectedMechanism]?.length || selectedMechanism === "strategy_only"
    ? selectedMechanism
    : "strategy_only";
  const evaluated = Object.entries(candidates).map(([mechanism, refs]) => {
    const isSelected = mechanism === selected;
    const available = refs.length > 0 || mechanism === "strategy_only";
    return {
      mechanism,
      status: isSelected ? "selected" : available ? "rejected" : "not_available",
      candidateRefs: refs,
      reason: isSelected
        ? `selected_by_source_planner:${mechanism}`
        : available
          ? `not_selected_for_this_content:${selected}`
          : `no_${mechanism}_candidate_available`,
      factPolicy: mechanism === "hotspot" ? "external_event_not_business_fact" : null
    };
  });
  const deviatesFromHotspotPolicy = ["required", "preferred"].includes(policy) && selected !== "hotspot";
  const userConfirmationStatus = deviatesFromHotspotPolicy ? confirmationStatus(confirmation) : "not_required";
  const projectSeed = {
    companyId: strategyContext.companyId || strategyContext.accountId || brief.accountId,
    strategySnapshotId: strategyContext.strategySnapshotId || brief.strategySnapshotId,
    topic: brief.topic,
    platform: brief.platform
  };
  const strategySeed = strategyContext.strategySnapshot || {
    id: strategyContext.strategySnapshotId || brief.strategySnapshotId,
    decisionHash: strategyContext.strategyDecisionHash || strategyContext.decisionProvenance?.decisionHash || null
  };
  const decision = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: UNIFIED_CONTENT_CONTRACTS.mechanismDecision,
    id: `mechanism_decision:${hashUnifiedContent({ projectSeed, evaluated }).slice(0, 24)}`,
    companyId: projectSeed.companyId,
    contentProjectRef: contentRef(`content_project_input:${hashUnifiedContent(projectSeed).slice(0, 24)}`, projectSeed),
    activeStrategySnapshotRef: contentRef(projectSeed.strategySnapshotId || "strategy_snapshot:unknown", strategySeed),
    evaluated,
    selectedMechanism: selected,
    selectedSourceRefs: candidates[selected],
    strategyHotspotPolicy: policy,
    deviation: deviatesFromHotspotPolicy ? {
      status: userConfirmationStatus === "confirmed" ? "degraded" : "blocked",
      reason: candidates.hotspot.length
        ? `strategy_requires_hotspot_but_${selected}_was_selected`
        : "strategy_requires_hotspot_but_no_usable_hotspot_was_available",
      userConfirmationStatus
    } : { status: "none", reason: null, userConfirmationStatus: "not_required" },
    decidedAt,
    decisionHash: ""
  }, "decisionHash");
  validateContentMechanismDecision(decision);
  return decision;
}

function sourceAsset(type, item = {}) {
  const base = { id: sourceId(item) };
  if (type === "hotspot") return {
    ...base,
    title: item.title || "",
    summary: item.summary || item.whyHot || "",
    sourceUrl: item.sourceUrl || item.url || null,
    sourcePlatform: item.sourcePlatform || item.platform || "unknown",
    collectedAt: item.collectedAt || item.fetchedAt || item.createdAt || null,
    freshness: item.freshness || item.lifecycle || item.status || "unknown",
    lifecycle: item.lifecycle || null,
    relevanceTier: item.relevanceTier || "weak_experiment",
    relevanceReason: item.relevanceReason || "",
    providerMode: item.providerMode || item.providerTrace?.mode || "unknown",
    providerTrace: item.providerTrace || null,
    companyId: item.companyId || null,
    directionId: item.directionId || null,
    strategySnapshotId: item.strategySnapshotId || null,
    risks: Array.isArray(item.risks) ? item.risks : [],
    usageBoundary: "external_event_not_business_fact"
  };
  if (type === "knowledge_base") return { ...base, name: item.name || item.title || "知识资产" };
  if (type === "reference_post") return {
    ...base,
    title: item.title || item.name || "原始参考帖",
    sourceUrl: item.sourceUrl || item.url || null,
    analysisStatus: item.analysisStatus || item.analysis?.status || "pending",
    analysisId: item.analysisId || item.analysis?.id || null,
    reviewStatus: item.reviewStatus || item.review?.status || "pending",
    contentPatternSnapshotId: item.contentPatternSnapshotId || item.review?.contentPatternSnapshotId || null
  };
  if (type === "viral_blueprint") return {
    ...base,
    familyId: item.familyId || null,
    version: item.version || null,
    lifecycle: item.lifecycle,
    productionReady: item.productionReady === true,
    approvedBy: item.approvedBy || item.review?.reviewerId || null,
    approvedAt: item.approvedAt || item.review?.reviewedAt || null,
    platform: item.platform || "unknown",
    contentArchetype: item.contentArchetype || null,
    creativeMechanism: item.creativeMechanism || null,
    applicableFunctions: Array.isArray(item.applicableFunctions) ? item.applicableFunctions : [],
    titleMechanisms: Array.isArray(item.titleMechanisms) ? item.titleMechanisms : [],
    openingMechanism: item.openingMechanism || item.openingFormula || "",
    structureRules: Array.isArray(item.structureRules || item.bodyStructure || item.structure) ? (item.structureRules || item.bodyStructure || item.structure) : [],
    evidenceRequirements: Array.isArray(item.evidenceRequirements || item.requiredEvidence) ? (item.evidenceRequirements || item.requiredEvidence) : [],
    visualRoles: Array.isArray(item.visualRoles) ? item.visualRoles : [],
    platformMechanics: item.platformMechanics && typeof item.platformMechanics === "object" ? item.platformMechanics : {},
    interactionMechanism: item.interactionMechanism || item.closingFormula || "",
    prohibitedUses: Array.isArray(item.prohibitedUses || item.doNotCopy || item.forbiddenReplication) ? (item.prohibitedUses || item.doNotCopy || item.forbiddenReplication) : [],
    sourceReferenceIds: Array.isArray(item.sourceReferenceIds) ? item.sourceReferenceIds : []
  };
  return base;
}

const SOURCE_DECISION_DEFINITIONS = [
  { type: "hotspot", label: "热点", aliases: ["hotspot"] },
  { type: "knowledge", label: "知识", aliases: ["knowledge_base", "strategy_facts"] },
  { type: "reference_post", label: "原始参考帖", aliases: ["reference_post", "viral_reference"] },
  { type: "viral_blueprint", label: "审核蓝图", aliases: ["viral_blueprint"] }
];

export function buildContentSourceTrace(sourcePlan = null, { contentRunId = null } = {}) {
  const sources = Array.isArray(sourcePlan?.sources) ? sourcePlan.sources : [];
  const decisions = SOURCE_DECISION_DEFINITIONS.map((definition) => {
    const matching = sources.filter((source) => definition.aliases.includes(source.type));
    const candidateIds = matching.flatMap((source) => definition.type === "reference_post" ? (source.analysisCandidateIds || []) : (source.candidateIds || []));
    const matchingAssets = matching.flatMap((source) => source.assets || []);
    const ids = definition.type === "viral_blueprint" && matchingAssets.length
      ? candidateIds.filter((id) => matchingAssets.some((asset) => asset.id === id && reviewedBlueprint(asset)))
      : candidateIds;
    const blockedIds = candidateIds.filter((id) => !ids.includes(id));
    const assets = matchingAssets.filter((asset) => ids.includes(asset.id)).map((asset) => ({
      ...structuredClone(asset),
      runAttribution: contentRunId ? { contentRunId } : null
    }));
    const used = ids.length > 0;
    let reasonCode = used ? "selected_and_frozen" : `no_${definition.type}_selected`;
    let reason = used ? `已选择 ${ids.length} 项并冻结到本次 ContentRun` : `本次未采用${definition.label}`;
    if (definition.type === "hotspot" && !used) {
      reasonCode = "no_hotspot_selected_no_runtime_search";
      reason = "本次未选择热点；正文生成阶段不会临时联网搜索";
    }
    if (definition.type === "reference_post") {
      reasonCode = used ? "raw_reference_requires_analysis_and_review" : "no_raw_reference_analysis_skipped";
      reason = used ? "原始参考帖仅进入拆解与人工审核，不直接进入正文事实来源" : "未选择原始参考帖，爆款拆解已跳过";
    }
    if (definition.type === "viral_blueprint" && !used && (matching.length || blockedIds.length)) {
      reasonCode = "no_human_approved_blueprint_available";
      reason = "候选蓝图未满足人工审核与生产可用门槛，不能进入正文";
    }
    return { type: definition.type, label: definition.label, used, status: used ? "used" : blockedIds.length ? "blocked" : "skipped", reasonCode, reason, selectedIds: ids, blockedIds, assets };
  });
  return {
    schemaVersion: "1.0",
    kind: "ContentSourceTrace",
    contentRunId,
    policy: {
      implicitHotspotSearch: false,
      rawReferencesAreFacts: false,
      approvedBlueprintOnly: true,
      blueprintFactPolicy: "structure_only"
    },
    decisions
  };
}

export function planContentSources({
  brief,
  strategyContext,
  hotspots = [],
  knowledgeItems = [],
  viralBlueprints = [],
  userMaterials = [],
  preferredMode = "auto",
  selectedSourceIds = [],
  mechanismDecisionConfirmation = null,
  requireProductionReadyBlueprints = false
}) {
  const normalizedMode = preferredMode === "knowledge_base" ? "knowledge" : preferredMode;
  const selectedIds = new Set(Array.isArray(selectedSourceIds) ? selectedSourceIds.filter(Boolean) : []);
  const usableHotspots = activeHotspots(hotspots).filter((item) =>
    item.relevanceTier !== "unrelated"
    && (
      selectedIds.has(sourceId(item))
      || !item.relevanceTier
      || ["direct", "bridge"].includes(item.relevanceTier)
    )
  );
  const matchedBlueprints = matchingBlueprints(viralBlueprints, brief);
  const rawReferences = userMaterials.filter((item) => ["reference_post", "viral_reference"].includes(item.type || item.sourceType));
  const writingMaterials = userMaterials.filter((item) => !rawReferences.includes(item));
  const knowledgeAvailable = knowledgeItems.length > 0 || (strategyContext.knowledgeFolderIds || []).length > 0;
  const strategyFactsAvailable = strategyContext.factSnapshot.usableFacts.length > 0;
  const userMaterialsAvailable = writingMaterials.length > 0;
  const evidenceAvailable = knowledgeAvailable || strategyFactsAvailable || userMaterialsAvailable;
  const contentFunction = contentFunctionForBrief(brief);
  const purposePolicy = resolvePurposePolicy(brief.contentPurposeId || "professional_opinion");
  const wantsTraffic = contentFunction === "discovery";
  const wantsEvidence = ["authority", "proof", "solution", "action"].includes(contentFunction);
  const userForced = normalizedMode !== "auto";
  const selectCandidateItems = (items, limit) => {
    const available = items.filter((item) => sourceId(item));
    return (selectedIds.size ? available.filter((item) => selectedIds.has(sourceId(item))) : available).slice(0, limit);
  };
  const selectCandidates = (items, limit) => {
    return selectCandidateItems(items, limit).map(sourceId);
  };

  const useHotspot = normalizedMode === "hotspot"
    || normalizedMode === "mixed"
    || (!userForced && wantsTraffic && usableHotspots.length > 0);
  const useKnowledge = normalizedMode === "knowledge"
    || normalizedMode === "mixed"
    || (!userForced && (wantsEvidence || evidenceAvailable));
  const useBlueprint = normalizedMode === "viral_blueprint"
    || normalizedMode === "mixed"
    || (!userForced && matchedBlueprints.length > 0 && ["checklist", "case", "opinion"].includes(brief.format));

  const selectedMechanism = useHotspot && usableHotspots.length
    ? "hotspot"
    : useKnowledge && (knowledgeItems.length || strategyFactsAvailable)
      ? "knowledge"
      : userMaterialsAvailable
        ? "user_material"
        : useBlueprint && matchedBlueprints.length
          ? "blueprint"
          : "strategy_only";

  const sources = [];
  if (useHotspot) {
    const selected = selectCandidateItems(usableHotspots, 3);
    sources.push({
      type: "hotspot",
      role: "提供时效背景和传播入口",
      required: normalizedMode === "hotspot",
      candidateIds: selected.map(sourceId),
      assets: selected.map((item) => sourceAsset("hotspot", item))
    });
  }
  if (useKnowledge && knowledgeAvailable) {
    const selected = selectCandidateItems(knowledgeItems, 8);
    sources.push({
      type: "knowledge_base",
      role: "提供用户自己的事实、观点和案例",
      required: wantsEvidence,
      candidateIds: selected.map(sourceId),
      assets: selected.map((item) => sourceAsset("knowledge_base", item))
    });
  }
  if (useKnowledge && strategyFactsAvailable) {
    sources.push({
      type: "strategy_facts",
      role: "提供策略 Agent 已确认并允许公开的动态事实",
      required: wantsEvidence && !knowledgeAvailable,
      candidateIds: selectCandidates(strategyContext.factSnapshot.usableFacts, strategyContext.factSnapshot.usableFacts.length)
    });
  }
  if (userMaterialsAvailable) {
    const selected = selectCandidateItems(writingMaterials, writingMaterials.length);
    sources.push({
      type: "user_material",
      role: "使用用户为本次任务临时提供的文字、图片说明或案例素材",
      required: !knowledgeAvailable && !strategyFactsAvailable,
      candidateIds: selected.map(sourceId)
    });
  }
  if (rawReferences.length) {
    const selected = selectCandidateItems(rawReferences, rawReferences.length);
    sources.push({
      type: "reference_post",
      role: "仅用于调用爆款拆解和人工审核，不直接作为正文事实或措辞来源",
      required: false,
      candidateIds: [],
      analysisCandidateIds: selected.map(sourceId),
      assets: selected.map((item) => sourceAsset("reference_post", item))
    });
  }
  if (useBlueprint) {
    const selected = selectCandidateItems(matchedBlueprints, 3);
    sources.push({
      type: "viral_blueprint",
      role: "只借用表达结构，不迁移原文事实与措辞",
      required: normalizedMode === "viral_blueprint",
      candidateIds: selected.map(sourceId),
      assets: selected.map((item) => sourceAsset("viral_blueprint", item))
    });
  }
  if (!sources.length) {
    sources.push({ type: "user_input_required", role: "等待用户补充可公开事实、观点、案例或有效来源", required: true, candidateIds: [] });
  }

  const missing = [];
  if (useHotspot && !usableHotspots.length) missing.push("没有处于有效生命周期的热点");
  if (useKnowledge && !evidenceAvailable) missing.push("缺少可公开使用的知识或事实");
  if (useBlueprint && !matchedBlueprints.length) missing.push("没有匹配当前平台和主题的爆款蓝图");
  if (sources.some((source) => source.type === "user_input_required")) missing.push("当前没有任何可用于写作的事实或素材");

  const plan = {
    schemaVersion: "0.1",
    mode: sources.length > 1 ? "mixed" : sources[0].type,
    sources,
    rationale: [
      wantsTraffic ? "当前内容承担发现与触达职能，优先评估有效热点" : "当前内容不承担强制追热点任务，来源按证据需求选择",
      `内容目的要求：${purposePolicy.evidence}`,
      useKnowledge ? "调用用户知识与事实以保证差异化和可信度" : null,
      useBlueprint ? "存在可用表达蓝图，可提升结构完成度" : null
    ].filter(Boolean),
    missing,
    fallback: missing.length ? "缺失的是必需材料时先追问或改用其他方向，不编造事实与案例" : null
  };
  plan.mechanismDecision = buildContentMechanismDecision({
    brief,
    strategyContext,
    usableHotspots,
    knowledgeItems,
    strategyFacts: strategyContext.factSnapshot.usableFacts,
    matchedBlueprints,
    writingMaterials,
    selectedMechanism,
    confirmation: mechanismDecisionConfirmation
  });
  if (["confirmed", "rejected"].includes(confirmationStatus(mechanismDecisionConfirmation))) {
    plan.mechanismDecisionConfirmation = structuredClone(mechanismDecisionConfirmation);
  }
  const referenceAsset = sources.find((source) => source.type === "reference_post")?.assets?.[0] || null;
  if (referenceAsset) {
    plan.referenceAnalysis = {
      status: referenceAsset.analysisStatus,
      analysisId: referenceAsset.analysisId,
      reviewStatus: referenceAsset.reviewStatus,
      contentPatternSnapshotId: referenceAsset.contentPatternSnapshotId
    };
  }
  plan.sourceTrace = buildContentSourceTrace(plan);
  plan.policy = {
    implicitHotspotSearch: false,
    approvedBlueprintOnly: true,
    rawReferencesRequireHumanReview: true,
    viralLearningV1: false,
    productionReadyBlueprintsRequested: requireProductionReadyBlueprints === true
  };
  assertContract(validateContentSourcePlanContract(plan));
  return plan;
}
