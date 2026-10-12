import assert from "node:assert/strict";
import { buildFeedbackWorkspace, normalizePerformanceSnapshot } from "../../content-agent/feedback-engine.mjs";
import { recordPublication, recordPublicationMetrics } from "../../content-agent/publishing-feedback.mjs";

const executionContext = {
  id: "execution_1",
  strategySnapshotId: "strategy_v2_3",
  factSnapshotId: "facts_7",
  knowledgeSnapshotId: "knowledge_4",
  growthMode: "hybrid_bridge",
  growthPlaybookId: "xhs-company-hybrid-cold-start",
  validationHypothesis: "验证相关热点能否带来目标用户并回流到垂直内容",
  directionCard: {
    id: "direction_1",
    objectiveId: "objective_growth",
    contentFunction: "authority",
    pillarId: "pillar_method",
    audienceId: "audience_owner",
    topic: "内容系统"
  },
  sourcePlan: {
    id: "source_plan_1",
    sources: [
      { type: "knowledge_base", candidateIds: ["knowledge_item_1"] },
      { type: "hotspot", candidateIds: ["hotspot_1"] }
    ]
  }
};

const unknownMetricSnapshot = normalizePerformanceSnapshot({
  views: 100,
  metrics: { profileVisits: 12, averageReadSeconds: 38.5 },
  measurementWindow: "72h",
  source: "official_api"
});
assert.equal(unknownMetricSnapshot.platformMetrics.profileVisits, 12);
assert.equal(unknownMetricSnapshot.platformMetrics.averageReadSeconds, 38.5);
assert.deepEqual(unknownMetricSnapshot.reportedMetricKeys, ["views"]);
assert.equal(unknownMetricSnapshot.derivedMetrics.saveRate, null);
assert.equal(unknownMetricSnapshot.derivedMetrics.leadRate, null);

const store = { contentTasks: [], contentRuns: [], contentPublications: [] };
for (let index = 1; index <= 3; index += 1) {
  const task = {
    id: `content_${index}`,
    contentRunId: `run_${index}`,
    accountId: "account_1",
    platform: "xiaohongshu",
    version: index,
    strategySnapshotId: "strategy_v2_3",
    contentExecutionContext: executionContext
  };
  store.contentTasks.push(task);
  const publishedAt = new Date(Date.UTC(2026, 6, index)).toISOString();
  const publication = recordPublication(store, task, {
    status: "published",
    platformContentId: `note_${index}`,
    publishedAt,
    adoptionStatus: index === 1 ? "modified" : "adopted",
    qualitativeResult: "目标用户提出了具体问题"
  });
  recordPublicationMetrics(publication, {
    views: 1000 * index,
    saves: 30 * index,
    follows: 5 * index,
    leads: index,
    measurementWindow: "7d",
    cutoffAt: new Date(Date.parse(publishedAt) + 7 * 24 * 60 * 60 * 1000).toISOString(),
    metrics: { profileVisits: 10 * index }
  });
}

const workspace = buildFeedbackWorkspace(store, { accountId: "account_1", strategySnapshotId: "strategy_v2_3" });
assert.equal(workspace.outcomes.length, 3);
assert.ok(workspace.outcomes.every((item) => item.dataQuality.eligibleForContentDiagnosis));
assert.ok(workspace.outcomes.every((item) => !item.dataQuality.eligibleForCycleEvidence), "legacy unbound evidence must stay out of cycle review");
assert.equal(workspace.outcomes[0].attribution.factSnapshotId, "facts_7");
assert.deepEqual(workspace.outcomes[0].attribution.sourceIdsByType.hotspot, ["hotspot_1"]);
assert.equal(workspace.learningSignals.length, 1);
assert.equal(workspace.learningSignals[0].sampleSize, 3);
assert.equal(workspace.learningSignals[0].eligibleForPatternReview, true);
assert.equal(workspace.learningSignals[0].eligibleForStrategyReview, false);
assert.equal(workspace.strategySignalBundle.signals.length, 0, "three posts must not mutate or propose strategy");
assert.equal(workspace.diagnoses.length, 3);
assert.equal(workspace.strategySignalBundle.policy.autoApply, false);
assert.equal(workspace.strategySignalBundle.policy.mayMutateActiveStrategy, false);
assert.equal(workspace.growthPlaybookSignals.length, 1);
assert.equal(workspace.growthPlaybookSignals[0].growthMode, "hybrid_bridge");
assert.equal(workspace.growthPlaybookSignals[0].publicationCount, 3);

const sparseWorkspace = buildFeedbackWorkspace({
  contentTasks: store.contentTasks.slice(0, 1),
  contentPublications: store.contentPublications.slice(0, 1)
}, { accountId: "account_1" });
assert.equal(sparseWorkspace.strategySignalBundle.signals.length, 0);
assert.equal(sparseWorkspace.strategySignalBundle.withheldSignals[0].scope, "content_only");

console.log(JSON.stringify({
  status: "content-feedback-self-test passed",
  outcomes: workspace.outcomes.length,
  learningSignals: workspace.learningSignals.length,
  strategyCandidates: workspace.strategySignalBundle.signals.length,
  diagnoses: workspace.diagnoses.length,
  growthPlaybookSignals: workspace.growthPlaybookSignals.length,
  unknownMetricKeys: Object.keys(unknownMetricSnapshot.platformMetrics)
}, null, 2));

