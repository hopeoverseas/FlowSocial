import { createHash, randomUUID } from "node:crypto";

export const CONTENT_FUNCTIONS = Object.freeze(["discovery", "authority", "proof", "solution", "action"]);
export const BLUEPRINT_LIFECYCLES = Object.freeze(["candidate", "approved", "testing", "validated", "paused", "retired"]);

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const clone = (value) => structuredClone(value);

function shortHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function canonical(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").slice(0, 120);
}

export function createPatternFingerprint(input = {}) {
  const seed = {
    platform: input.platform || "unknown",
    contentArchetype: input.contentArchetype || "other",
    applicableFunctions: list(input.applicableFunctions).sort(),
    titleMechanisms: list(input.titleMechanisms || (input.titleFormula ? [input.titleFormula] : [])).map(canonical).sort(),
    openingMechanism: canonical(input.openingMechanism || input.openingFormula),
    structureRules: list(input.structureRules || input.bodyStructure || input.structure).map(canonical)
  };
  return `pattern_fp_${shortHash(seed)}`;
}

export function normalizePatternScope(scope = {}) {
  return {
    workspaceId: scope.workspaceId || "workspace_default",
    companyId: scope.companyId || null,
    socialAccountId: scope.socialAccountId || null,
    level: scope.socialAccountId ? "social_account" : scope.companyId ? "company" : "workspace"
  };
}

export function normalizeViralContentAnalysis(input = {}, now = new Date().toISOString()) {
  const sourceReferenceIds = list(input.sourceReferenceIds);
  const blueprint = input.blueprintCandidate || input.blueprint || {};
  return {
    schemaVersion: "1.0",
    kind: "ViralContentAnalysis",
    id: input.id || `pattern_analysis_${randomUUID().slice(0, 8)}`,
    mode: input.mode === "batch_compare" ? "batch_compare" : "single_post",
    status: ["candidate", "approved", "rejected"].includes(input.status) ? input.status : "candidate",
    scope: normalizePatternScope(input.scope),
    sourceReferenceIds,
    sampleAssessment: {
      level: input.sampleAssessment?.level || "unknown",
      basis: list(input.sampleAssessment?.basis),
      comparability: input.sampleAssessment?.comparability || "unknown",
      missingEvidence: list(input.sampleAssessment?.missingEvidence)
    },
    observations: {
      audienceNeed: list(input.observations?.audienceNeed),
      titleAndCover: list(input.observations?.titleAndCover),
      opening: list(input.observations?.opening),
      informationPath: list(input.observations?.informationPath),
      evidenceMechanism: list(input.observations?.evidenceMechanism),
      visualRoles: list(input.observations?.visualRoles),
      interactionAndConversion: list(input.observations?.interactionAndConversion)
    },
    successHypotheses: list(input.successHypotheses).map((item) => ({
      hypothesis: item.hypothesis || "",
      evidenceRefs: list(item.evidenceRefs).length ? list(item.evidenceRefs) : sourceReferenceIds,
      confidence: item.confidence === "medium" ? "medium" : "low",
      alternativeExplanations: list(item.alternativeExplanations)
    })),
    reusableElements: list(input.reusableElements),
    nonTransferableElements: list(input.nonTransferableElements),
    factRisks: list(input.factRisks),
    doNotCopy: list(input.doNotCopy),
    accountInfluence: {
      observedAccountAssets: list(input.accountInfluence?.observedAccountAssets),
      possibleConfounders: list(input.accountInfluence?.possibleConfounders),
      targetAccountFit: input.accountInfluence?.targetAccountFit || "unknown",
      fitReason: list(input.accountInfluence?.fitReason)
    },
    platformAnalysis: input.platformAnalysis && typeof input.platformAnalysis === "object" ? clone(input.platformAnalysis) : {},
    blueprintCandidate: normalizeBlueprintCandidate({ ...blueprint, sourceReferenceIds }),
    strategyInsightCandidates: list(input.strategyInsightCandidates).map((item) => ({ ...item, scope: "content_only", status: "candidate" })),
    extractionMode: input.extractionMode || "skill_pending",
    reviewPolicy: {
      requiresHumanApproval: true,
      autoApplyToStrategy: false,
      autoUseForGeneration: false
    },
    review: input.review || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

export function normalizeBlueprintCandidate(input = {}) {
  const candidate = {
    kind: "ContentPatternBlueprint",
    schemaVersion: "1.0",
    lifecycle: "candidate",
    productionReady: false,
    platform: input.platform || "unknown",
    contentArchetype: input.contentArchetype || "other",
    creativeMechanism: input.creativeMechanism || "other",
    applicableFunctions: list(input.applicableFunctions).filter((item) => CONTENT_FUNCTIONS.includes(item)),
    suitableAudiences: list(input.suitableAudiences),
    suitableTopics: list(input.suitableTopics),
    titleMechanisms: list(input.titleMechanisms || (input.titleFormula ? [input.titleFormula] : [])),
    openingMechanism: input.openingMechanism || input.openingFormula || "",
    structureRules: list(input.structureRules || input.bodyStructure || input.structure),
    evidenceRequirements: list(input.evidenceRequirements || input.requiredEvidence),
    visualRoles: list(input.visualRoles),
    platformMechanics: input.platformMechanics && typeof input.platformMechanics === "object" ? clone(input.platformMechanics) : {},
    applicableSubjectTypes: list(input.applicableSubjectTypes),
    applicableAccountModes: list(input.applicableAccountModes),
    applicableMatrixRoles: list(input.applicableMatrixRoles),
    interactionMechanism: input.interactionMechanism || input.closingFormula || "",
    prohibitedUses: list(input.prohibitedUses || input.doNotCopy || input.forbiddenReplication),
    sourceReferenceIds: list(input.sourceReferenceIds),
    sampleCount: Math.max(1, Number(input.sampleCount || list(input.sourceReferenceIds).length || 1)),
    confidence: ["low", "medium", "high"].includes(input.confidence) ? input.confidence : "low",
    confidenceScore: Math.max(0, Math.min(100, Number(input.confidenceScore || 0))),
    clusterId: input.clusterId || null,
    patternFamilyId: input.patternFamilyId || null
  };
  candidate.patternFingerprint = input.patternFingerprint || createPatternFingerprint(candidate);
  return candidate;
}

export function createBlueprintVersion({ analysis, reviewerId = "user", lifecycle = "approved", priorVersions = [], familyId = null, parentBlueprintId = null, changeSet = null, evidenceWindow = null, now = new Date().toISOString() }) {
  if (analysis.status !== "approved") throw new Error("Only an approved analysis can create a blueprint version");
  if (!BLUEPRINT_LIFECYCLES.includes(lifecycle) || lifecycle === "candidate") throw new Error("Blueprint lifecycle must be approved, testing, validated, paused, or retired");
  const candidate = normalizeBlueprintCandidate(analysis.blueprintCandidate);
  const stableFamilyId = familyId || candidate.patternFamilyId || `pattern_family_${shortHash({ scope: analysis.scope, fingerprint: candidate.patternFingerprint })}`;
  const familyVersions = priorVersions.filter((item) => item.familyId === stableFamilyId);
  const version = familyVersions.reduce((max, item) => Math.max(max, Number(item.version || 0)), 0) + 1;
  const parent = parentBlueprintId || familyVersions.sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0]?.id || null;
  return {
    ...candidate,
    id: `pattern_${shortHash({ familyId: stableFamilyId, version, candidate })}`,
    familyId: stableFamilyId,
    version,
    parentBlueprintId: parent,
    changeSet: changeSet || { added: [], removed: [], changed: [] },
    evidenceWindow: evidenceWindow || { sourceReferenceIds: candidate.sourceReferenceIds, sampleCount: candidate.sampleCount },
    performanceScore: null,
    lifecycle,
    productionReady: ["approved", "testing", "validated"].includes(lifecycle),
    scope: normalizePatternScope(analysis.scope),
    analysisId: analysis.id,
    approvedBy: reviewerId,
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
    usedByContentIds: []
  };
}

export function createContentPatternSnapshot({ scope, blueprints = [], sourcePlanIds = [], now = new Date().toISOString() }) {
  const allowedIds = new Set(list(sourcePlanIds));
  const selected = blueprints.filter((item) => (!allowedIds.size || allowedIds.has(item.id)) && item.productionReady && ["approved", "testing", "validated"].includes(item.lifecycle));
  const payload = selected.map((item) => ({
    id: item.id,
    familyId: item.familyId,
    version: item.version,
    platform: item.platform,
    contentArchetype: item.contentArchetype,
    creativeMechanism: item.creativeMechanism || "other",
    applicableFunctions: list(item.applicableFunctions),
    titleMechanisms: list(item.titleMechanisms),
    openingMechanism: item.openingMechanism,
    structureRules: list(item.structureRules),
    evidenceRequirements: list(item.evidenceRequirements),
    visualRoles: list(item.visualRoles),
    platformMechanics: clone(item.platformMechanics || {}),
    applicableSubjectTypes: list(item.applicableSubjectTypes),
    applicableAccountModes: list(item.applicableAccountModes),
    applicableMatrixRoles: list(item.applicableMatrixRoles),
    interactionMechanism: item.interactionMechanism,
    prohibitedUses: list(item.prohibitedUses),
    sourceReferenceIds: list(item.sourceReferenceIds),
    confidence: item.confidence
  }));
  const normalizedScope = normalizePatternScope(scope);
  const seed = { scope: normalizedScope, blueprints: payload.map((item) => `${item.id}@${item.version}`) };
  return clone({
    schemaVersion: "1.0",
    kind: "ContentPatternSnapshot",
    id: `pattern_snapshot_${shortHash(seed)}`,
    scope: normalizedScope,
    blueprintVersions: payload,
    policy: {
      structureOnly: true,
      maySupplyFacts: false,
      mayMutateStrategy: false,
      sourceTextIncluded: false
    },
    createdAt: now
  });
}

export function patternVisibleToScope(pattern, scope) {
  const own = normalizePatternScope(pattern.scope);
  const target = normalizePatternScope(scope);
  if (own.workspaceId !== target.workspaceId) return false;
  if (own.companyId && own.companyId !== target.companyId) return false;
  if (own.socialAccountId && own.socialAccountId !== target.socialAccountId) return false;
  return true;
}
