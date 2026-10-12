import assert from "node:assert/strict";
import { normalizeViralContentAnalysis } from "../../content-agent/pattern-contracts.mjs";
import { buildPatternClusters, buildPatternPerformanceDashboard, buildSkillPromotionCandidates, completeReferenceImportJob, createReferenceImportJob, ensureAdvancedContentLearning, proposeBlueprintUpgrades, reviewBlueprintUpgrade, reviewSkillPromotion } from "../../content-agent/content-learning-engine.mjs";

const scope = { workspaceId: "workspace_test", companyId: "company_a", socialAccountId: "social_xhs" };
const store = { referencePosts: [], contentPatternAnalyses: [], contentPatternBlueprints: [], contentPatternSnapshots: [], contentPublications: [] };
ensureAdvancedContentLearning(store);

const imported = createReferenceImportJob(store, {
  scope,
  platform: "xiaohongshu",
  items: [
    { title: "案例一", text: "问题 原因 方法 行动", author: "作者甲", metrics: { likes: 1000, saves: 400 } },
    { title: "案例二", text: "问题 原因 方法 行动", author: "作者乙", metrics: { likes: 900, saves: 360 } },
    { title: "案例一", text: "问题 原因 方法 行动", author: "作者甲", metrics: { likes: 1000, saves: 400 } }
  ]
});
assert.equal(imported.accepted.length, 2);
assert.equal(imported.job.counts.duplicates, 1);
completeReferenceImportJob(imported.job, { analyzed: 2 });
assert.equal(imported.job.status, "completed");

const sourceRows = [
  { id: "ref_1", author: "作者甲" },
  { id: "ref_2", author: "作者乙" },
  { id: "ref_3", author: "作者丙" }
];
store.referencePosts.push(...sourceRows.map((item) => ({ ...item, scope, platform: "xiaohongshu" })));
for (const row of sourceRows) {
  store.contentPatternAnalyses.push(normalizeViralContentAnalysis({
    id: `analysis_${row.id}`,
    scope,
    sourceReferenceIds: [row.id],
    blueprintCandidate: {
      platform: "xiaohongshu",
      contentArchetype: "tutorial",
      applicableFunctions: ["authority"],
      titleMechanisms: ["场景 + 痛点 + 明确收益"],
      openingMechanism: "场景共鸣",
      structureRules: ["问题", "原因", "方法", "行动"],
      interactionMechanism: "自然提问",
      evidenceRequirements: ["当前公司的已确认事实"],
      prohibitedUses: ["原句", "原案例", "原图"],
      sourceReferenceIds: [row.id]
    }
  }));
}

const clusters = buildPatternClusters(store, { scope });
assert.equal(clusters.length, 1);
assert.equal(clusters[0].classification, "stable_commonality");
assert.ok(clusters[0].recurringMechanisms.length >= 4);

const firstProposals = proposeBlueprintUpgrades(store, { scope });
assert.equal(firstProposals.length, 1);
const v1 = reviewBlueprintUpgrade(store, firstProposals[0].id, { decision: "approve", reviewerId: "tester", lifecycle: "testing", scope }).blueprint;
assert.equal(v1.version, 1);

store.referencePosts.push({ id: "ref_4", author: "作者丁", scope, platform: "xiaohongshu" });
store.contentPatternAnalyses.push(normalizeViralContentAnalysis({
  id: "analysis_ref_4",
  scope,
  sourceReferenceIds: ["ref_4"],
  blueprintCandidate: { ...v1, id: undefined, lifecycle: "candidate", productionReady: false, sourceReferenceIds: ["ref_4"] }
}));
const secondProposals = proposeBlueprintUpgrades(store, { scope });
const v2Proposal = secondProposals.find((item) => item.familyId === v1.familyId && item.status === "candidate");
assert.ok(v2Proposal);
const v2 = reviewBlueprintUpgrade(store, v2Proposal.id, { decision: "approve", reviewerId: "tester", lifecycle: "validated", scope }).blueprint;
assert.equal(v2.version, 2);
assert.equal(v2.familyId, v1.familyId);
assert.equal(v2.parentBlueprintId, v1.id);

function metrics(rate) {
  return { derivedMetrics: { engagementRate: rate, saveRate: rate, commentRate: rate / 2, followRate: rate / 3, leadRate: rate / 4, conversionRate: rate / 5 } };
}
for (let index = 0; index < 5; index += 1) {
  store.contentPublications.push({ id: `baseline_${index}`, accountId: "social_xhs", platform: "xiaohongshu", latestMetrics: metrics(0.02), attribution: { contentFunction: "authority", contentPatternBlueprintVersions: [] } });
  store.contentPublications.push({ id: `pattern_${index}`, accountId: "social_xhs", platform: "xiaohongshu", latestMetrics: metrics(0.08), attribution: { contentFunction: "authority", contentPatternBlueprintVersions: [{ id: v2.id, familyId: v2.familyId, version: v2.version }] } });
}
const dashboard = buildPatternPerformanceDashboard(store, { scope });
const performance = dashboard.records.find((item) => item.blueprintId === v2.id);
assert.equal(performance.sampleSize, 5);
assert.ok(performance.score >= 62);

const promotions = buildSkillPromotionCandidates(store, { scope });
assert.ok(promotions.created.some((item) => item.targetSkill === "write-xhs-content"));
const promotion = promotions.created[0];
assert.equal(promotion.directSkillFileMutation, false);
const approvedPromotion = reviewSkillPromotion(store, promotion.id, { decision: "approve", reviewerId: "tester", regressionPassed: true, scope });
assert.equal(approvedPromotion.patternPack.status, "active");
assert.equal(approvedPromotion.patternPack.policy.mayMutateSkillFile, false);

console.log(JSON.stringify({
  status: "passed",
  importJobId: imported.job.id,
  clusterId: clusters[0].id,
  blueprintFamilyId: v1.familyId,
  versions: [v1.version, v2.version],
  performanceScore: performance.score,
  patternPackId: approvedPromotion.patternPack.id,
  assertions: 18
}, null, 2));

