import assert from "node:assert/strict";
import {
  UNIFIED_CONTENT_CONTRACTS,
  adaptLegacyIsolatedPackageReadOnly,
  adaptLegacySinglePlatformRunReadOnly,
  hashUnifiedContent,
  validateContentMechanismDecision,
  validateContentProject,
  validatePromotionRecord,
  validatePromotionRecordSet,
  validateUnifiedContentStateHistory,
  validateUnifiedContentStateTransition,
  validateUserSelection,
  withUnifiedContentHash
} from "../../content-agent/index.mjs";

const h = (label) => hashUnifiedContent({ label });
const ref = (id) => ({ id, hash: h(id) });
const master = { schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.sharedContentMasterRef, id: "master_1", hash: h("master_1"), authorityContract: "ContentMaster@2.0", authorityType: "shared_content_master" };
const run = (platform) => ({ schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.platformRunRef, id: `run_${platform}`, hash: h(`run_${platform}`), platform, accountId: `account_${platform}`, sharedContentMasterRef: structuredClone(master), platformBriefRef: ref(`brief_${platform}`), outlineRef: ref(`outline_${platform}`), writerInvocationRef: ref(`writer_${platform}`), candidateRefs: [ref(`candidate_${platform}`)], finalVersionRef: ref(`version_${platform}`) });
const projectBase = { schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.contentProject, id: "project_1", companyId: "company_1", contentOpportunityRef: ref("opportunity_1"), activeStrategySnapshotRef: ref("strategy_1"), sharedContentMasterRef: master, platformRuns: [run("xiaohongshu"), run("wechat")], state: "editorial_reviewed", createdAt: "2026-08-05T10:00:00.000Z" };
const project = withUnifiedContentHash(projectBase, "projectHash");
assert.equal(validateContentProject(project), project);

const platformMaster = structuredClone(master);
platformMaster.authorityContract = "WechatArticlePackage@2.0";
assert.throws(() => validateContentProject(withUnifiedContentHash({ ...projectBase, sharedContentMasterRef: platformMaster, platformRuns: [] }, "projectHash")), /PLATFORM_AUTHORITY_FORBIDDEN/);
const duplicate = withUnifiedContentHash({ ...projectBase, platformRuns: [run("wechat"), run("wechat")] }, "projectHash");
assert.throws(() => validateContentProject(duplicate), /DUPLICATE_PLATFORM_RUN/);
const mismatchedRun = run("wechat");
mismatchedRun.sharedContentMasterRef.hash = h("another-master");
assert.throws(() => validateContentProject(withUnifiedContentHash({ ...projectBase, platformRuns: [mismatchedRun] }, "projectHash")), /MASTER_REF_MISMATCH/);

const decision = withUnifiedContentHash({ schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.mechanismDecision, id: "decision_1", companyId: "company_1", contentProjectRef: { id: project.id, hash: project.projectHash }, activeStrategySnapshotRef: project.activeStrategySnapshotRef, evaluated: [{ mechanism: "hotspot", status: "rejected", candidateRefs: [ref("hotspot_1")], reason: "relevance below threshold", factPolicy: "external_event_not_business_fact" }, { mechanism: "knowledge", status: "selected", candidateRefs: [ref("knowledge_1")], reason: "authoritative source", factPolicy: null }], selectedMechanism: "knowledge", selectedSourceRefs: [ref("knowledge_1")], strategyHotspotPolicy: "preferred", deviation: { status: "degraded", reason: "no relevant current hotspot", userConfirmationStatus: "confirmed" }, decidedAt: "2026-08-05T10:01:00.000Z" }, "decisionHash");
assert.equal(validateContentMechanismDecision(decision), decision);
const unconfirmed = withUnifiedContentHash({ ...decision, deviation: { ...decision.deviation, userConfirmationStatus: "pending" } }, "decisionHash");
assert.throws(() => validateContentMechanismDecision(unconfirmed), /HOTSPOT_DEGRADATION_CONFIRMATION_REQUIRED/);
const hotspotAsFact = structuredClone(decision);
hotspotAsFact.evaluated[0].factPolicy = "business_fact";
assert.throws(() => validateContentMechanismDecision(withUnifiedContentHash(hotspotAsFact, "decisionHash")), /HOTSPOT_FACT_POLICY/);

const selection = withUnifiedContentHash({ schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.userSelection, id: "selection_1", platform: "xiaohongshu", platformRunRef: { id: run("xiaohongshu").id, hash: run("xiaohongshu").hash }, selectedBy: "user_1", selectedByType: "user", finalTitleRef: ref("title_1"), finalBodyVersionRef: ref("body_1"), pageRevisionRefs: [ref("page_1")], selectionEventRefs: [ref("selection_event_1")], confirmation: "explicit_user_confirmed", confirmedAt: "2026-08-05T10:02:00.000Z" }, "selectionHash");
assert.equal(validateUserSelection(selection), selection);
assert.throws(() => validateUserSelection(withUnifiedContentHash({ ...selection, selectedByType: "machine_gate" }, "selectionHash")), /EXPLICIT_USER_REQUIRED/);

const promotionBase = { schemaVersion: "1.0", contract: UNIFIED_CONTENT_CONTRACTS.promotionRecord, id: "promotion_1", companyId: "company_1", accountId: "account_xiaohongshu", contentProjectRef: { id: project.id, hash: project.projectHash }, platformRunRef: selection.platformRunRef, sharedContentMasterRef: master, activeStrategySnapshotRef: project.activeStrategySnapshotRef, editorialReview: { ref: ref("editorial_review_1"), status: "passed" }, userSelection: { ref: { id: selection.id, hash: selection.selectionHash }, status: "confirmed" }, sourceManifestRef: ref("manifest_1"), deliveryArtifactRef: ref("artifact_1"), promotedVersionRef: ref("immutable_version_1"), idempotencyKey: "promote:project_1:xhs:v1", provenance: "native_shared_master", promotedAt: "2026-08-05T10:03:00.000Z" };
const promotion = withUnifiedContentHash(promotionBase, "promotionHash");
assert.equal(validatePromotionRecord(promotion, { project, platformRun: project.platformRuns[0], selection }), promotion);
assert.throws(() => validatePromotionRecord(withUnifiedContentHash({ ...promotionBase, editorialReview: { ...promotionBase.editorialReview, status: "pending" } }, "promotionHash")), /EDITORIAL_REVIEW_REQUIRED/);
assert.throws(() => validatePromotionRecord(withUnifiedContentHash({ ...promotionBase, companyId: "wrong_company" }, "promotionHash"), { project }), /COMPANY_MISMATCH/);
assert.throws(() => validatePromotionRecord(withUnifiedContentHash({ ...promotionBase, activeStrategySnapshotRef: ref("wrong_strategy") }, "promotionHash"), { project }), /STRATEGY_MISMATCH/);
assert.throws(() => validatePromotionRecord(withUnifiedContentHash({ ...promotionBase, accountId: "wrong_account" }, "promotionHash"), { platformRun: project.platformRuns[0] }), /ACCOUNT_MISMATCH/);
assert.equal(validatePromotionRecordSet([promotion]).length, 1);
const idempotencyConflict = withUnifiedContentHash({ ...promotionBase, id: "promotion_2", promotedVersionRef: ref("immutable_version_2") }, "promotionHash");
assert.throws(() => validatePromotionRecordSet([promotion, idempotencyConflict]), /IDEMPOTENCY_CONFLICT/);

assert.deepEqual(validateUnifiedContentStateTransition("planned", "generating"), { from: "planned", to: "generating", status: "allowed" });
assert.throws(() => validateUnifiedContentStateTransition("generating", "planned"), /NON_FORWARD/);
assert.throws(() => validateUnifiedContentStateTransition("planned", "candidate_ready"), /SKIP_FORBIDDEN/);
const history = ["planned", "generating", "candidate_ready"].map((state, index) => ({ state, at: `2026-08-05T10:0${index}:00.000Z`, eventRef: ref(`state_event_${index}`) }));
assert.equal(validateUnifiedContentStateHistory(history), history);

for (const [adapter, provenance] of [[adaptLegacySinglePlatformRunReadOnly, "legacy_single_platform"], [adaptLegacyIsolatedPackageReadOnly, "legacy_isolated"]]) {
  const legacy = { id: "legacy_05o", platform: "xiaohongshu", nested: { version: 9 }, userSelection: "not_selected" };
  const before = structuredClone(legacy);
  const projection = adapter(legacy);
  assert.deepEqual(legacy, before);
  assert.equal(projection.provenance, provenance);
  assert.equal(projection.sharedContentMasterRef, null);
  assert.equal(projection.promotionEligible, false);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.blockers), true);
  assert.throws(() => { projection.blockers.push("mutation"); }, TypeError);
}

console.log(JSON.stringify({ status: "unified-content-contracts-self-test passed", platformRuns: project.platformRuns.length, mechanismDecision: "validated", promotionBinding: "validated", legacyAdapters: 2 }, null, 2));
