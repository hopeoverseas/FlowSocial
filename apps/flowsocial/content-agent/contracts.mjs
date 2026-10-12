import { validateActiveStrategySnapshotV2, validateFactSnapshotV1, validateStrategyDocumentV2 } from "../contracts/strategy-content-contracts.mjs";
import { CONTENT_FUNCTIONS, contentFunctionForRole, purposeForFunction, resolvePurposePolicy } from "./content-policy.mjs";

const SUPPORTED_PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const CONTENT_ROLES = new Set(["traffic", "trust", "product", "conversion"]);
const CONTRACT_VERSION = "0.1";

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function requireValue(errors, condition, path, message = "is required") {
  if (!condition) errors.push({ path, message });
}

function contractResult(name, errors) {
  return { name, version: CONTRACT_VERSION, valid: errors.length === 0, errors };
}

export function assertContract(result) {
  if (result.valid) return result;
  const detail = result.errors.map((item) => `${item.path} ${item.message}`).join("; ");
  const error = new Error(`${result.name}@${result.version} validation failed: ${detail}`);
  error.contract = result;
  throw error;
}

export function validateStrategySnapshotContract(snapshot) {
  const v2Document = snapshot?.document || (snapshot?.payload?.schemaVersion === "2.0" ? snapshot.payload : null) || (snapshot?.schemaVersion === "2.0" && snapshot?.strategy ? snapshot : null);
  if (v2Document) {
    const validation = snapshot?.status === "active" && snapshot?.document
      ? validateActiveStrategySnapshotV2(snapshot)
      : validateStrategyDocumentV2(v2Document);
    return contractResult("StrategySnapshotInput", validation.errors);
  }
  const payload = snapshot?.payload || snapshot;
  const errors = [];
  requireValue(errors, object(payload), "$", "must be an object");
  if (!object(payload)) return contractResult("StrategySnapshotInput", errors);
  requireValue(errors, text(payload.schemaVersion), "schemaVersion");
  requireValue(errors, text(payload.accountId || snapshot?.accountId), "accountId");
  requireValue(errors, object(payload.business), "business", "must be an object");
  requireValue(errors, object(payload.accountStrategy), "accountStrategy", "must be an object");
  requireValue(errors, Array.isArray(payload.audiences) && payload.audiences.length > 0, "audiences", "must contain at least one audience");
  if (object(payload.business)) {
    requireValue(errors, text(payload.business.businessModel), "business.businessModel");
    requireValue(errors, text(payload.business.valueProposition), "business.valueProposition");
    requireValue(errors, text(payload.business.conversionPath), "business.conversionPath");
  }
  if (object(payload.accountStrategy)) {
    requireValue(errors, text(payload.accountStrategy.growthStage), "accountStrategy.growthStage");
    requireValue(errors, text(payload.accountStrategy.primaryGoal), "accountStrategy.primaryGoal");
    requireValue(errors, Array.isArray(payload.accountStrategy.contentPillars) && payload.accountStrategy.contentPillars.length > 0, "accountStrategy.contentPillars", "must contain at least one pillar");
    requireValue(errors, object(payload.accountStrategy.contentPortfolio), "accountStrategy.contentPortfolio", "must be an object");
  }
  return contractResult("StrategySnapshotInput", errors);
}

export function validateFactSnapshotContract(snapshot) {
  if (snapshot?.schemaVersion === "1.0") {
    const validation = validateFactSnapshotV1(snapshot);
    return contractResult("FactSnapshot", validation.errors);
  }
  const errors = [];
  requireValue(errors, object(snapshot), "$", "must be an object");
  if (!object(snapshot)) return contractResult("FactSnapshot", errors);
  requireValue(errors, snapshot.schemaVersion === CONTRACT_VERSION, "schemaVersion", `must equal ${CONTRACT_VERSION}`);
  requireValue(errors, text(snapshot.accountId), "accountId");
  for (const key of ["usableFacts", "contextOnlyFacts", "forbiddenFacts", "missingFacts"]) {
    requireValue(errors, Array.isArray(snapshot[key]), key, "must be an array");
  }
  for (const [index, fact] of list(snapshot.usableFacts).entries()) {
    requireValue(errors, text(fact.id), `usableFacts[${index}].id`);
    requireValue(errors, fact.value !== "" && fact.value != null, `usableFacts[${index}].value`);
  }
  return contractResult("FactSnapshot", errors);
}

export function validateContentTaskBriefContract(brief) {
  const errors = [];
  requireValue(errors, object(brief), "$", "must be an object");
  if (!object(brief)) return contractResult("ContentTaskBrief", errors);
  requireValue(errors, brief.schemaVersion === CONTRACT_VERSION, "schemaVersion", `must equal ${CONTRACT_VERSION}`);
  for (const key of ["accountId", "platform", "contentPillar", "contentRole", "targetAudience", "audienceProblem", "coreClaim", "topic", "angle", "format"]) {
    requireValue(errors, text(brief[key]), key);
  }
  requireValue(errors, SUPPORTED_PLATFORMS.has(brief.platform), "platform", "must be xiaohongshu or wechat");
  requireValue(errors, CONTENT_ROLES.has(brief.contentRole), "contentRole", "must be traffic, trust, product, or conversion");
  requireValue(errors, CONTENT_FUNCTIONS.includes(brief.contentFunction), "contentFunction", "must be discovery, authority, proof, solution, or action");
  requireValue(errors, typeof brief.contentPurposeId === "string" && Boolean(brief.contentPurposeId), "contentPurposeId");
  requireValue(errors, Array.isArray(brief.riskBoundaries), "riskBoundaries", "must be an array");
  return contractResult("ContentTaskBrief", errors);
}

export function validateContentSourcePlanContract(plan) {
  const errors = [];
  requireValue(errors, object(plan), "$", "must be an object");
  if (!object(plan)) return contractResult("ContentSourcePlan", errors);
  requireValue(errors, plan.schemaVersion === CONTRACT_VERSION, "schemaVersion", `must equal ${CONTRACT_VERSION}`);
  requireValue(errors, Array.isArray(plan.sources) && plan.sources.length > 0, "sources", "must contain at least one source");
  for (const [index, source] of list(plan.sources).entries()) {
    requireValue(errors, text(source.type), `sources[${index}].type`);
    requireValue(errors, text(source.role), `sources[${index}].role`);
    requireValue(errors, typeof source.required === "boolean", `sources[${index}].required`, "must be boolean");
    requireValue(errors, Array.isArray(source.candidateIds), `sources[${index}].candidateIds`, "must be an array");
  }
  return contractResult("ContentSourcePlan", errors);
}

export function validateContentIdentityContract(identity) {
  const errors = [];
  requireValue(errors, object(identity), "$", "must be an object");
  if (!object(identity)) return contractResult("ContentIdentity", errors);
  requireValue(errors, identity.schemaVersion === CONTRACT_VERSION, "schemaVersion", `must equal ${CONTRACT_VERSION}`);
  for (const key of ["contentPillar", "audienceProblem", "coreClaim", "contentRole", "angle", "format", "platform"]) {
    requireValue(errors, text(identity[key]), key);
  }
  requireValue(errors, Array.isArray(identity.sourceIds), "sourceIds", "must be an array");
  return contractResult("ContentIdentity", errors);
}

export function assertContentAgentInput(input) {
  if (!input || typeof input !== "object") throw new Error("content agent input is required");
  if (!input.strategySnapshot || typeof input.strategySnapshot !== "object") {
    throw new Error("strategySnapshot is required");
  }
  assertContract(validateStrategySnapshotContract(input.strategySnapshot));
  const platform = input.platform || "xiaohongshu";
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`unsupported platform: ${platform}`);
  }
  return input;
}

export function normalizeFactSnapshot({ accountId, facts = [], capturedAt = new Date().toISOString() }) {
  const usableFacts = [];
  const contextOnlyFacts = [];
  const forbiddenFacts = [];

  for (const fact of list(facts)) {
    const normalized = {
      id: fact.id || fact.factKey || fact.fact_key || null,
      key: fact.factKey || fact.fact_key || fact.predicate || "",
      value: fact.value ?? fact.valueJson ?? fact.value_json ?? "",
      confidence: Number(fact.confidence ?? 0.5),
      visibility: fact.visibility || "unknown",
      contentUsage: fact.contentUsage || fact.content_usage || "needs_review",
      status: fact.status || "unknown",
      updatedAt: fact.updatedAt || fact.updated_at || capturedAt
    };
    const usage = normalized.contentUsage;
    const publicEnough = ["public", "publishable", "anonymized"].includes(normalized.visibility);
    if (["forbidden", "private", "do_not_use"].includes(usage) || normalized.visibility === "private") {
      forbiddenFacts.push(normalized);
    } else if (["usable", "allowed", "approved", "publishable"].includes(usage) && publicEnough) {
      usableFacts.push(normalized);
    } else {
      contextOnlyFacts.push(normalized);
    }
  }

  const snapshot = {
    schemaVersion: "0.1",
    accountId,
    capturedAt,
    usableFacts,
    contextOnlyFacts,
    forbiddenFacts,
    missingFacts: []
  };
  assertContract(validateFactSnapshotContract(snapshot));
  return snapshot;
}

export function createContentTaskBrief({
  strategyContext,
  platform,
  recommendation,
  userInstruction = "",
  generationMode = "recommended"
}) {
  const contentRole = CONTENT_ROLES.has(recommendation.contentRole) ? recommendation.contentRole : "trust";
  const contentFunction = CONTENT_FUNCTIONS.includes(recommendation.contentFunction)
    ? recommendation.contentFunction
    : contentFunctionForRole(contentRole, recommendation.format);
  const contentPurposeId = recommendation.suggestedPurposeId || purposeForFunction(contentFunction, { format: recommendation.format });
  const brief = {
    schemaVersion: "0.1",
    strategySnapshotId: strategyContext.strategySnapshotId,
    factSnapshotId: strategyContext.factSnapshot.factSnapshotId || null,
    accountId: strategyContext.accountId,
    platform,
    accountStage: strategyContext.accountStage,
    contentPillar: recommendation.contentPillar,
    contentRole,
    contentFunction,
    contentPurposeId,
    targetAudience: recommendation.targetAudience,
    audienceProblem: recommendation.audienceProblem,
    coreClaim: recommendation.coreClaim,
    businessGoal: strategyContext.primaryGoal,
    conversionGoal: recommendation.conversionGoal || strategyContext.conversionPath,
    topic: recommendation.topic,
    angle: recommendation.angle,
    format: recommendation.format,
    tone: list(strategyContext.tone),
    riskBoundaries: list(strategyContext.riskBoundaries),
    editorialDecisionBrief: recommendation.editorialDecisionBrief ? structuredClone(recommendation.editorialDecisionBrief) : null,
    writingBrief: recommendation.editorialDecisionBrief?.writingBrief ? structuredClone(recommendation.editorialDecisionBrief.writingBrief) : null,
    requestedPromotionMode: recommendation.requestedPromotionMode || null,
    requestedPrimaryInteraction: recommendation.requestedPrimaryInteraction || null,
    requestedConversionStageId: recommendation.requestedConversionStageId || null,
    userInstruction: text(userInstruction),
    generationMode
  };
  assertContract(validateContentTaskBriefContract(brief));
  return brief;
}

export function createContentIdentity(brief, sourceIds = []) {
  const identity = {
    schemaVersion: "0.1",
    contentPillar: brief.contentPillar,
    audienceProblem: brief.audienceProblem,
    coreClaim: brief.coreClaim,
    contentRole: brief.contentRole,
    contentFunction: brief.contentFunction,
    contentPurposeId: brief.contentPurposeId,
    angle: brief.angle,
    format: brief.format,
    platform: brief.platform,
    sourceIds: list(sourceIds)
  };
  assertContract(validateContentIdentityContract(identity));
  return identity;
}

export function createGenerationPayload({ brief, sourcePlan, identity, strategyContext }) {
  const hasHotspot = sourcePlan.sources.some((source) => source.type === "hotspot");
  const contentPurposeId = brief.contentPurposeId || purposeForFunction(brief.contentFunction, { hasHotspot, format: brief.format });
  const purposePolicy = resolvePurposePolicy(contentPurposeId);
  const purposeAllowedByStrategy = !strategyContext.purposeEligibilityPolicy?.[brief.contentFunction]?.length
    || strategyContext.purposeEligibilityPolicy[brief.contentFunction].includes(contentPurposeId);
  return {
    sourceType: brief.generationMode === "user_directed" ? "content_agent_user_directed" : "content_agent_recommended",
    accountId: brief.accountId,
    workspaceId: strategyContext.workspaceId || null,
    companyId: strategyContext.companyId || strategyContext.accountId || null,
    socialAccountId: strategyContext.socialAccountId || brief.accountId || null,
    effectiveStrategyId: strategyContext.effectiveStrategyId || null,
    strategyDecisionRevision: strategyContext.strategyDecisionRevision || strategyContext.decisionProvenance?.decisionRevision || null,
    strategyDecisionHash: strategyContext.strategyDecisionHash || strategyContext.decisionProvenance?.decisionHash || null,
    growthMode: strategyContext.growthMode || strategyContext.growthStrategy?.growthMode || null,
    growthPlaybookId: strategyContext.growthStrategy?.selectedPlaybookId || null,
    validationHypothesis: strategyContext.activeExperimentPlan?.hypothesis || null,
    experimentPlanId: strategyContext.activeExperimentPlan?.id || null,
    platform: brief.platform,
    ideaTitle: brief.topic,
    customBrief: brief.userInstruction || null,
    contentPurposeId,
    promotionMode: brief.requestedPromotionMode || (["solution", "action"].includes(brief.contentFunction) ? "soft" : "none"),
    primaryInteraction: brief.requestedPrimaryInteraction || "model_selected",
    purposePolicy: {
      ...purposePolicy,
      selectedBy: brief.generationMode === "user_directed" ? "user" : "planner_suggestion",
      allowedByStrategy: purposeAllowedByStrategy,
      overrideRule: "用户对本篇内容目的的明确选择优先于长期策略默认值"
    },
    knowledgeFolderIds: strategyContext.knowledgeFolderIds,
    strategySnapshotId: brief.strategySnapshotId,
    factSnapshot: strategyContext.factSnapshot,
    contentTaskBrief: brief,
    contentSourcePlan: sourcePlan,
    contentIdentity: identity,
    editorialDecisionBrief: brief.editorialDecisionBrief ? structuredClone(brief.editorialDecisionBrief) : null,
    writingBrief: brief.writingBrief ? structuredClone(brief.writingBrief) : null
  };
}

export function createContentSourceEvidence({ sourcePlan, hotspots = [], viralBlueprints = [], userMaterials = [] }) {
  const selected = new Set(sourcePlan.sources.flatMap((source) => source.candidateIds));
  return {
    schemaVersion: CONTRACT_VERSION,
    hotspots: hotspots.filter((item) => selected.has(item.id)).map((item) => ({
      id: item.id,
      kind: item.kind || "HotspotRecord",
      title: item.title || "",
      summary: item.summary || item.whyHot || "",
      sourceUrl: item.sourceUrl || item.url || null,
      sourcePlatform: item.sourcePlatform || item.platform || "unknown",
      sourceEvidence: list(item.sourceEvidence),
      collectedAt: item.collectedAt || item.discoveredAt || item.createdAt || null,
      publishedAt: item.publishedAt || item.published_at || item.createdAt || null,
      firstDiscoveredAt: item.firstDiscoveredAt || item.discoveredAt || null,
      lastUpdatedAt: item.lastUpdatedAt || item.updatedAt || null,
      status: item.status || "active",
      lifecycle: item.lifecycle || null,
      relevanceTier: item.relevanceTier || "weak_experiment",
      relevanceReason: item.relevanceReason || "",
      providerMode: item.providerMode || item.providerTrace?.mode || "unknown",
      providerTrace: item.providerTrace || null,
      companyId: item.companyId || null,
      directionId: item.directionId || null,
      strategySnapshotId: item.strategySnapshotId || null,
      risks: list(item.risks),
      factPolicy: "external_event_not_business_fact"
    })),
    viralBlueprints: viralBlueprints.filter((item) => selected.has(item.id)).map((item) => ({
      id: item.id,
      familyId: item.familyId || null,
      version: item.version || null,
      lifecycle: item.lifecycle || null,
      name: item.name || item.viralType || "表达蓝图",
      hookType: item.hookType || null,
      titleFormula: item.titleFormula || list(item.titleMechanisms)[0] || "",
      titleMechanisms: list(item.titleMechanisms),
      openingFormula: item.openingFormula || item.openingMechanism || "",
      bodyStructure: list(item.bodyStructure || item.bodyFormula || item.structure || item.structureRules),
      closingFormula: item.closingFormula || item.interactionFormula || item.interactionMechanism || "",
      requiredEvidence: list(item.requiredEvidence || item.evidenceRequirements),
      doNotCopy: list(item.doNotCopy || item.forbiddenReplication || item.prohibitedUses),
      sourceReferenceIds: list(item.sourceReferenceIds),
      factPolicy: "structure_only"
    })),
    userMaterials: userMaterials.filter((item) => selected.has(item.id)).map((item) => ({
      id: item.id,
      type: item.type || "text",
      name: item.name || "用户临时素材",
      text: item.text || item.content || item.description || "",
      visibility: item.visibility || null,
      usage: item.usage || (item.visibility === "public" || item.visibility === "publishable" ? "usable" : "needs_review")
    }))
  };
}
