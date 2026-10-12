import assert from "node:assert/strict";
import { createContentPatternSnapshot } from "../../content-agent/pattern-contracts.mjs";
import { ensureContentPatternLearning, listEligiblePatternBlueprints, recordPatternAnalysisCandidate, reviewPatternAnalysis, snapshotPatternsForPlan, updatePatternBlueprintLifecycle } from "../../content-agent/pattern-library-store.mjs";
import { planContentSources } from "../../content-agent/source-planner.mjs";

const scope = { workspaceId: "workspace_test", companyId: "company_a", socialAccountId: "social_xhs" };
const store = { contentPatternAnalyses: [], contentPatternBlueprints: [], contentPatternSnapshots: [] };
ensureContentPatternLearning(store);

const legacyAnalysis = {
  id: "analysis_1",
  referencePostId: "reference_1",
  blueprint: {
    titleFormula: "痛点 + 具体结果",
    openingFormula: "场景共鸣",
    bodyStructure: ["问题", "原因", "方法", "行动"],
    closingFormula: "自然提问",
    requiredEvidence: ["公司自有案例"]
  },
  doNotCopy: ["原句", "原案例", "原图"]
};

const candidate = recordPatternAnalysisCandidate(store, {
  payload: { platform: "xiaohongshu", metrics: { likes: 1200, saves: 600 }, applicableFunctions: ["authority"] },
  legacyAnalysis,
  scope
});
assert.equal(candidate.status, "candidate");
assert.equal(candidate.blueprintCandidate.productionReady, false);
assert.equal(candidate.reviewPolicy.autoApplyToStrategy, false);
assert.equal(store.contentPatternBlueprints.length, 0);

const review = reviewPatternAnalysis(store, candidate.id, { decision: "approve", reviewerId: "tester", lifecycle: "approved" });
assert.equal(review.blueprint.productionReady, true);
assert.equal(review.blueprint.version, 1);
assert.equal(review.blueprint.scope.socialAccountId, "social_xhs");

const eligible = listEligiblePatternBlueprints(store, { scope, platform: "xiaohongshu", contentFunction: "authority" });
assert.equal(eligible.length, 1);
const wrongAccount = listEligiblePatternBlueprints(store, { scope: { ...scope, socialAccountId: "other" }, platform: "xiaohongshu" });
assert.equal(wrongAccount.length, 0);

const strictPlan = planContentSources({
  brief: { platform: "xiaohongshu", topic: "企业内容方法", contentRole: "trust", format: "opinion" },
  strategyContext: { knowledgeFolderIds: [], factSnapshot: { usableFacts: [] } },
  viralBlueprints: eligible,
  preferredMode: "viral_blueprint",
  requireProductionReadyBlueprints: true
});
assert.deepEqual(strictPlan.sources[0].candidateIds, [review.blueprint.id]);

const snapshot = snapshotPatternsForPlan(store, { scope, blueprintIds: [review.blueprint.id] });
assert.equal(snapshot.blueprintVersions.length, 1);
assert.equal(snapshot.policy.maySupplyFacts, false);
assert.equal("rawText" in snapshot.blueprintVersions[0], false);
assert.equal("transcript" in snapshot.blueprintVersions[0], false);
assert.equal("metrics" in snapshot.blueprintVersions[0], false);
review.blueprint.structureRules.push("不应进入快照");
assert.equal(snapshot.blueprintVersions[0].structureRules.includes("不应进入快照"), false);

const paused = updatePatternBlueprintLifecycle(store, review.blueprint.id, { lifecycle: "paused", reviewerId: "tester" });
assert.equal(paused.productionReady, false);
assert.equal(listEligiblePatternBlueprints(store, { scope, platform: "xiaohongshu" }).length, 0);

const emptySnapshot = createContentPatternSnapshot({ scope, blueprints: store.contentPatternBlueprints, sourcePlanIds: [review.blueprint.id] });
assert.equal(emptySnapshot.blueprintVersions.length, 0);

console.log(JSON.stringify({
  status: "passed",
  candidateId: candidate.id,
  blueprintId: review.blueprint.id,
  snapshotId: snapshot.id,
  assertions: 16
}, null, 2));

