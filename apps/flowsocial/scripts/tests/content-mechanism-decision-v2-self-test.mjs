import assert from "node:assert/strict";
import {
  hashUnifiedContent,
  createContentMechanismDecisionV1CompatibilityView,
  validateContentMechanismDecision,
  validateContentMechanismDecisionV1CompatibilityView,
  validateContentMechanismDecisionV2
} from "../../content-agent/unified-content-contracts.mjs";
import { buildContentMechanismDecisionV2, planContentSources, resolveFrozenContentSourcePlanRefs } from "../../content-agent/source-planner.mjs";

const brief = {
  schemaVersion: "0.1", strategySnapshotId: "strategy-1", factSnapshotId: "facts-1", accountId: "account-1",
  platform: "xiaohongshu", contentPillar: "AI", contentRole: "traffic", contentFunction: "discovery",
  contentPurposeId: "trend_interpretation", targetAudience: "manager", audienceProblem: "unclear",
  coreClaim: "use verified sources", topic: "AI source planning", angle: "checklist", format: "checklist",
  riskBoundaries: [], generationMode: "recommended"
};
function context(strategyHotspotPolicy = "optional") {
  return {
    accountId: "account-1", companyId: "company-1", strategySnapshotId: "strategy-1", strategyDecisionHash: "strategy-hash",
    strategyHotspotPolicy, knowledgeFolderIds: [],
    factSnapshot: { usableFacts: [{ id: "fact-1", value: "verified strategy fact" }], contextOnlyFacts: [], forbiddenFacts: [], missingFacts: [] }
  };
}
const hotspots = [1, 2, 3, 4].map((index) => ({ id: `hotspot-${index}`, title: `hotspot ${index}`, summary: `summary ${index}`, status: "recommended", relevanceTier: "direct" }));
const knowledgeItems = [{ id: "knowledge-1", title: "knowledge one" }, { id: "knowledge-2", title: "knowledge two" }];
const userMaterials = [{ id: "material-1", type: "user_material", title: "material" }];
const blueprints = [{
  id: "blueprint-1", productionReady: true, lifecycle: "approved", approvedBy: "reviewer", approvedAt: "2026-08-06T00:00:00.000Z",
  bestFor: ["xiaohongshu"], suitableTopics: [], structure: ["hook", "method"], doNotCopy: ["source words"]
}];

function selectedCandidates(plan, sourceTypes) {
  return plan.sources.filter((source) => sourceTypes.includes(source.type)).flatMap((source) => {
    const assets = Array.isArray(source.assets) ? source.assets : [];
    return source.candidateIds.map((id) => ({
      sourceType: source.type,
      source: structuredClone(assets.find((asset) => asset.id === id) || { id }),
      status: "selected",
      reason: "selected_and_frozen_after_limit"
    }));
  });
}

const mixedPlan = planContentSources({
  brief, strategyContext: context("preferred"), hotspots, knowledgeItems, viralBlueprints: blueprints,
  userMaterials, preferredMode: "mixed"
});
assert.equal(mixedPlan.mechanismDecision.contract, "ContentMechanismDecision@1.0", "default SourcePlan must remain v1");
assert.equal(mixedPlan.sources.find((source) => source.type === "hotspot").candidateIds.length, 3, "v1 SourcePlan limit must remain unchanged");

const mixedEvaluations = [
  {
    mechanism: "hotspot", role: "primary", evaluationStatus: "evaluated", reason: "hotspot is the primary discovery source",
    candidates: [
      ...selectedCandidates(mixedPlan, ["hotspot"]),
      { sourceType: "hotspot", source: { id: "hotspot-4", title: "hotspot 4" }, status: "rejected", reason: "excluded_by_source_plan_limit" }
    ]
  },
  { mechanism: "knowledge", role: "supporting", evaluationStatus: "evaluated", reason: "knowledge supports the primary source", candidates: [...selectedCandidates(mixedPlan, ["knowledge_base", "strategy_facts"]), { sourceType: "knowledge_base", source: { id: "knowledge-unavailable", name: "archived knowledge" }, status: "not_available", reason: "asset_was_archived_before_freeze" }] },
  { mechanism: "user_material", role: "supporting", evaluationStatus: "evaluated", reason: "material supports the explanation", candidates: selectedCandidates(mixedPlan, ["user_material"]) },
  { mechanism: "blueprint", role: "supporting", evaluationStatus: "evaluated", reason: "blueprint supplies structure only", candidates: selectedCandidates(mixedPlan, ["viral_blueprint"]) },
  { mechanism: "strategy_only", role: "not_selected", evaluationStatus: "evaluated", reason: "richer sources are available", candidates: [] }
];
const mixedDecision = buildContentMechanismDecisionV2({
  brief, strategyContext: context("preferred"), sourcePlan: mixedPlan, mechanismEvaluations: mixedEvaluations,
  decidedAt: "2026-08-06T01:00:00.000Z"
});
validateContentMechanismDecisionV2(mixedDecision);
const mixedProjectSeed = { companyId: "company-1", strategySnapshotId: "strategy-1", topic: brief.topic, platform: brief.platform };
const mixedStrategySeed = { id: "strategy-1", decisionHash: "strategy-hash" };
assert.deepEqual(mixedDecision.projectInputRef, {
  id: `content_project_input:${hashUnifiedContent(mixedProjectSeed).slice(0, 24)}`,
  hash: hashUnifiedContent(mixedProjectSeed)
}, "v2 builder defaults must retain the historical project ref bytes");
assert.deepEqual(mixedDecision.activeStrategySnapshotRef, { id: "strategy-1", hash: hashUnifiedContent(mixedStrategySeed) },
  "v2 builder defaults must retain the historical strategy ref bytes");
assert.deepEqual(buildContentMechanismDecisionV2({
  brief, strategyContext: context("preferred"), sourcePlan: mixedPlan, mechanismEvaluations: mixedEvaluations,
  decidedAt: "2026-08-06T01:00:00.000Z"
}), mixedDecision, "omitting canonical authority inputs must remain byte-compatible");

const canonicalStrategySnapshot = { schemaVersion: "2.0", strategyHotspotPolicy: "preferred", positioning: "canonical fixture" };
const canonicalActiveStrategySnapshotRef = { id: "strategy-1", hash: hashUnifiedContent(canonicalStrategySnapshot) };
const canonicalProjectInput = {
  schemaVersion: "1.0",
  contract: "UnifiedContentProjectInput@1.0",
  companyId: "company-1",
  accounts: { xiaohongshu: "account-1", wechat: "wechat-account-1" },
  activeStrategySnapshotRef: canonicalActiveStrategySnapshotRef,
  contentOpportunityRef: { id: "opportunity-1", hash: "c".repeat(64) }
};
const canonicalProjectInputHash = hashUnifiedContent(canonicalProjectInput);
const canonicalProjectInputRef = { id: `unified_project_input:${canonicalProjectInputHash.slice(0, 24)}`, hash: canonicalProjectInputHash };
const canonicalInputsBefore = structuredClone({ canonicalStrategySnapshot, canonicalActiveStrategySnapshotRef, canonicalProjectInput, canonicalProjectInputRef });
const canonicalDecision = buildContentMechanismDecisionV2({
  brief,
  strategyContext: { ...context("preferred"), strategySnapshot: canonicalStrategySnapshot },
  sourcePlan: mixedPlan,
  mechanismEvaluations: mixedEvaluations,
  projectInput: canonicalProjectInput,
  projectInputRef: canonicalProjectInputRef,
  activeStrategySnapshotRef: canonicalActiveStrategySnapshotRef,
  decidedAt: "2026-08-06T01:00:00.000Z"
});
assert.deepEqual(canonicalDecision.projectInputRef, canonicalProjectInputRef, "canonical project ref must enter the decision unchanged");
assert.deepEqual(canonicalDecision.activeStrategySnapshotRef, canonicalActiveStrategySnapshotRef, "canonical strategy ref must enter the decision unchanged");
assert.deepEqual({ canonicalStrategySnapshot, canonicalActiveStrategySnapshotRef, canonicalProjectInput, canonicalProjectInputRef }, canonicalInputsBefore,
  "canonical authority validation must not mutate caller preimages or refs");
for (const [name, overrides, code] of [
  ["missing project preimage", { projectInput: null }, "ContentMechanismDecisionV2:PROJECT_INPUT_AUTHORITY_PAIR_REQUIRED"],
  ["stale project hash", { projectInputRef: { ...canonicalProjectInputRef, hash: "0".repeat(64) } }, "ContentMechanismDecisionV2:PROJECT_INPUT_REF_MISMATCH"],
  ["wrong project id", { projectInputRef: { ...canonicalProjectInputRef, id: "unified_project_input:wrong" } }, "ContentMechanismDecisionV2:PROJECT_INPUT_REF_MISMATCH"],
  ["stale strategy hash", { activeStrategySnapshotRef: { ...canonicalActiveStrategySnapshotRef, hash: "0".repeat(64) } }, "ContentMechanismDecisionV2:ACTIVE_STRATEGY_REF_MISMATCH"]
]) {
  assert.throws(() => buildContentMechanismDecisionV2({
    brief,
    strategyContext: { ...context("preferred"), strategySnapshot: canonicalStrategySnapshot },
    sourcePlan: mixedPlan,
    mechanismEvaluations: mixedEvaluations,
    projectInput: canonicalProjectInput,
    projectInputRef: canonicalProjectInputRef,
    activeStrategySnapshotRef: canonicalActiveStrategySnapshotRef,
    decidedAt: "2026-08-06T01:00:00.000Z",
    ...overrides
  }), (error) => error.code === code, `${name} must fail closed`);
}
assert.throws(() => buildContentMechanismDecisionV2({
  brief,
  strategyContext: context("preferred"),
  sourcePlan: mixedPlan,
  mechanismEvaluations: mixedEvaluations,
  projectInput: canonicalProjectInput,
  projectInputRef: canonicalProjectInputRef,
  activeStrategySnapshotRef: canonicalActiveStrategySnapshotRef
}), (error) => error.code === "ContentMechanismDecisionV2:ACTIVE_STRATEGY_PREIMAGE",
"an explicit strategy ref without its authoritative payload must fail closed");
const mixedPlanHashBeforeResolve = hashUnifiedContent(mixedPlan);
const resolvedFrozenRefs = resolveFrozenContentSourcePlanRefs(mixedPlan);
assert.deepEqual(resolvedFrozenRefs, mixedDecision.selectedSourceRefs, "v2 builder and shared frozen SourcePlan resolver must use one authority rule");
assert.equal(hashUnifiedContent(mixedPlan), mixedPlanHashBeforeResolve, "shared resolver must not mutate SourcePlan input");
assert(Object.isFrozen(resolvedFrozenRefs) && resolvedFrozenRefs.every(Object.isFrozen), "shared resolver output must be recursively frozen");
const duplicateSourcePlan = structuredClone(mixedPlan);
duplicateSourcePlan.sources.find((source) => source.type === "hotspot").candidateIds.push(duplicateSourcePlan.sources.find((source) => source.type === "hotspot").candidateIds[0]);
assert.throws(() => resolveFrozenContentSourcePlanRefs(duplicateSourcePlan), (error) => error.code === "ContentMechanismDecisionV2:SOURCE_PLAN_REF_ID_DUPLICATE");
assert.throws(
  () => buildContentMechanismDecisionV2({ brief, strategyContext: context("preferred"), sourcePlan: duplicateSourcePlan, mechanismEvaluations: mixedEvaluations }),
  (error) => error.code === "ContentMechanismDecisionV2:SOURCE_PLAN_REF_ID_DUPLICATE",
  "v2 builder must delegate duplicate authority rejection to the shared resolver"
);
const invalidSourcePlan = structuredClone(mixedPlan);
invalidSourcePlan.sources.find((source) => source.type === "knowledge_base").candidateIds = null;
assert.throws(() => resolveFrozenContentSourcePlanRefs(invalidSourcePlan), (error) => error.code === "ContentMechanismDecisionV2:SOURCE_PLAN_CANDIDATES");
assert.equal(mixedDecision.contract, "ContentMechanismDecision@2.0");
assert.equal(mixedDecision.mechanisms.filter((item) => item.role === "primary").length, 1);
assert.deepEqual(mixedDecision.mechanisms.filter((item) => item.role === "supporting").map((item) => item.mechanism), ["knowledge", "user_material", "blueprint"]);
assert.equal(mixedDecision.mechanisms.find((item) => item.mechanism === "hotspot").factPolicy, "external_event_not_business_fact");
assert.deepEqual(
  mixedDecision.selectedSourceRefs.map((item) => item.id).sort(),
  mixedPlan.sources.filter((source) => ["hotspot", "knowledge_base", "strategy_facts", "user_material", "viral_blueprint"].includes(source.type)).flatMap((source) => source.candidateIds).sort(),
  "selected refs must equal the SourcePlan sources frozen after limits"
);
assert.equal(mixedDecision.taxonomy.sourceMechanismType, "content_source_mechanism");
assert.equal(mixedDecision.taxonomy.creativeMechanismAuthority, "platform_writer_context");
assert.equal(Object.isFrozen(mixedDecision.mechanisms[0].candidates[0].sourceRef), true);

const rejected = mixedDecision.mechanisms.find((item) => item.mechanism === "hotspot").candidates.find((item) => item.status === "rejected");
assert.equal(rejected.sourceRef.id, "hotspot-4");
assert.match(rejected.reason, /limit/);
assert.equal(mixedDecision.selectedSourceRefs.some((item) => item.id === "hotspot-4"), false);
const unavailable = mixedDecision.mechanisms.find((item) => item.mechanism === "knowledge").candidates.find((item) => item.status === "not_available");
assert.equal(unavailable.sourceRef.id, "knowledge-unavailable");
assert.match(unavailable.reason, /archived/);

const mismatchedEvaluations = structuredClone(mixedEvaluations);
mismatchedEvaluations[0].candidates.find((item) => item.source.id === "hotspot-3").status = "rejected";
assert.throws(
  () => buildContentMechanismDecisionV2({ brief, strategyContext: context("preferred"), sourcePlan: mixedPlan, mechanismEvaluations: mismatchedEvaluations }),
  (error) => error.code === "ContentMechanismDecisionV2:FROZEN_SOURCE_REF_MISMATCH"
);

const invalidNotEvaluated = structuredClone(mixedDecision);
const blueprint = invalidNotEvaluated.mechanisms.find((item) => item.mechanism === "blueprint");
blueprint.role = "not_selected";
blueprint.evaluationStatus = "not_evaluated";
blueprint.candidates[0].status = "not_available";
delete invalidNotEvaluated.decisionHash;
invalidNotEvaluated.decisionHash = hashUnifiedContent(invalidNotEvaluated);
assert.throws(() => validateContentMechanismDecisionV2(invalidNotEvaluated), (error) => error.code === "ContentMechanismDecisionV2:NOT_EVALUATED_INCONSISTENT");

const missingHotspotPlan = planContentSources({
  brief, strategyContext: context("required"), hotspots: [], knowledgeItems, viralBlueprints: [], userMaterials,
  preferredMode: "knowledge"
});
const missingHotspotEvaluations = [
  { mechanism: "hotspot", role: "not_selected", evaluationStatus: "evaluated", reason: "evaluated but no usable hotspot exists", candidates: [] },
  { mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", reason: "knowledge becomes primary", candidates: selectedCandidates(missingHotspotPlan, ["knowledge_base", "strategy_facts"]) },
  { mechanism: "user_material", role: "supporting", evaluationStatus: "evaluated", reason: "material supports knowledge", candidates: selectedCandidates(missingHotspotPlan, ["user_material"]) },
  { mechanism: "blueprint", role: "not_selected", evaluationStatus: "not_evaluated", reason: "blueprint evaluation was not requested", candidates: [] },
  { mechanism: "strategy_only", role: "not_selected", evaluationStatus: "evaluated", reason: "knowledge is available", candidates: [] }
];
const blockedDecision = buildContentMechanismDecisionV2({ brief, strategyContext: context("required"), sourcePlan: missingHotspotPlan, mechanismEvaluations: missingHotspotEvaluations, decidedAt: "2026-08-06T02:00:00.000Z" });
assert.deepEqual(blockedDecision.deviation, { status: "blocked", reason: "strategy_hotspot_policy_not_satisfied_by_frozen_source_plan", confirmationEventRef: null });

const confirmationEvent = {
  contract: "ContentMechanismConfirmationEvent@1.0", id: "confirmation-1", status: "confirmed", confirmedByType: "user", confirmedAt: "2026-08-06T02:01:00.000Z"
};
const confirmationEventRef = { id: confirmationEvent.id, hash: hashUnifiedContent(confirmationEvent) };
const degradedDecision = buildContentMechanismDecisionV2({
  brief, strategyContext: context("required"), sourcePlan: missingHotspotPlan, mechanismEvaluations: missingHotspotEvaluations,
  confirmationEvent, confirmationEventRef, decidedAt: "2026-08-06T02:02:00.000Z"
});
assert.equal(degradedDecision.deviation.status, "degraded");
assert.deepEqual(degradedDecision.deviation.confirmationEventRef, confirmationEventRef);
assert.throws(
  () => buildContentMechanismDecisionV2({ brief, strategyContext: context("required"), sourcePlan: missingHotspotPlan, mechanismEvaluations: missingHotspotEvaluations, confirmationEvent, confirmationEventRef: { ...confirmationEventRef, hash: "0".repeat(64) } }),
  (error) => error.code === "ContentMechanismDecisionV2:CONFIRMATION_EVENT_REF"
);
const statusOnlyEvent = { status: "confirmed" };
assert.throws(
  () => buildContentMechanismDecisionV2({ brief, strategyContext: context("required"), sourcePlan: missingHotspotPlan, mechanismEvaluations: missingHotspotEvaluations, confirmationEvent: statusOnlyEvent, confirmationEventRef: { id: "status-only", hash: hashUnifiedContent(statusOnlyEvent) } }),
  (error) => error.code === "ContentMechanismDecisionV2:CONFIRMATION_EVENT_REF",
  "a status string/object without an immutable user event must not authorize degradation"
);

const stale = structuredClone(mixedDecision);
stale.mechanisms[0].candidates[0].sourceRef = { ...stale.mechanisms[0].candidates[0].sourceRef, hash: "0".repeat(64) };
delete stale.decisionHash;
stale.decisionHash = hashUnifiedContent(stale);
assert.throws(() => validateContentMechanismDecisionV2(stale), (error) => error.code === "ContentMechanismDecisionV2:SELECTED_SOURCE_SET_MISMATCH");
const duplicate = structuredClone(mixedDecision);
duplicate.mechanisms[1].candidates[0].sourceRef = structuredClone(duplicate.mechanisms[0].candidates[0].sourceRef);
delete duplicate.decisionHash;
duplicate.decisionHash = hashUnifiedContent(duplicate);
assert.throws(() => validateContentMechanismDecisionV2(duplicate), (error) => error.code === "ContentMechanismDecisionV2:CANDIDATE_REF_ID_DUPLICATE");

for (const shape of ["missing", "extra", "null", "primitive"]) {
  let value;
  if (shape === "null") value = null;
  else if (shape === "primitive") value = 7;
  else { value = structuredClone(mixedDecision); if (shape === "missing") delete value.taxonomy; else value.privateValue = "do-not-echo"; }
  assert.throws(
    () => validateContentMechanismDecisionV2(value),
    (error) => error instanceof TypeError === false && error.code.startsWith("ContentMechanismDecisionV2:") && !String(error.message).includes("do-not-echo")
  );
}

validateContentMechanismDecision(mixedPlan.mechanismDecision);
const v1Before = hashUnifiedContent(mixedPlan.mechanismDecision);
const projection = createContentMechanismDecisionV1CompatibilityView(mixedPlan.mechanismDecision);
validateContentMechanismDecisionV1CompatibilityView(projection);
assert.equal(hashUnifiedContent(mixedPlan.mechanismDecision), v1Before);
assert.equal(projection.contract, "ContentMechanismDecisionV1CompatibilityView@1.0");
assert.deepEqual(projection.provenance, { kind: "derived_from_content_mechanism_decision_v1", readOnly: true, promotionEligible: false, nativeV2: false });
assert.deepEqual({ secondary: projection.view.secondaryMechanisms, candidates: projection.view.candidateLevelDecisions, actualUse: projection.view.actualUse }, { secondary: "unknown", candidates: "unknown", actualUse: "unknown" });
assert.ok(Object.isFrozen(projection) && Object.isFrozen(projection.provenance) && Object.isFrozen(projection.view) && Object.isFrozen(projection.view.selectedSourceRefs), "compatibility view must be recursively frozen");
const promotionForgery = structuredClone(projection);
promotionForgery.provenance.promotionEligible = true;
delete promotionForgery.viewHash;
promotionForgery.viewHash = hashUnifiedContent(promotionForgery);
assert.throws(() => validateContentMechanismDecisionV1CompatibilityView(promotionForgery), (error) => error.code === "ContentMechanismDecisionV1CompatibilityView:PROVENANCE");
assert.throws(() => validateContentMechanismDecision(projection), "compatibility view must not validate as a v1 decision");
assert.throws(() => validateContentMechanismDecisionV2(projection), "compatibility view must not validate as native v2");
assert.throws(() => validateContentMechanismDecision(projection.view), "inner compatibility view must not masquerade as v1");
assert.throws(() => validateContentMechanismDecisionV2(projection.view), "inner compatibility view must not masquerade as v2");
const repeatedProjection = createContentMechanismDecisionV1CompatibilityView(mixedPlan.mechanismDecision);
assert.equal(repeatedProjection.viewHash, projection.viewHash, "compatibility view hash must be stable");

console.log("content-mechanism-decision-v2-self-test: ok");
