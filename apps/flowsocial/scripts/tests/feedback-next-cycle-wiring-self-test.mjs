import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { previewMetricImport } from "../../content-agent/platform-feedback-import.mjs";
import { buildNextCycleContentPortfolio } from "../../content-agent/next-cycle-content-portfolio.mjs";
import { confirmAtomicBusinessOutcome, validateAtomicBusinessOutcomeSnapshot } from "../../content-agent/atomic-business-outcome-store.mjs";
import { bindFeedbackActionsToCycle } from "../../content-agent/feedback-review-engine.mjs";

const atomicPublication = {
  id: "atomic-publication-1",
  accountId: "acc_xhs",
  platform: "xiaohongshu",
  canonicalPlatformContentId: "64b123456789abcdef012345",
  canonicalPlatformUrl: "https://www.xiaohongshu.com/explore/64b123456789abcdef012345",
  contentProjectRef: { id: "project-1", hash: "1".repeat(64) },
  commitRef: { id: "commit-1", hash: "2".repeat(64) }
};
const previewStore = {
  unifiedAtomicManualPublications: [atomicPublication],
  unifiedAtomicContentCommits: [{
    id: "commit-1",
    commitHash: "2".repeat(64),
    candidate: { title: "全新周期选题" }
  }],
  contentPublications: [],
  contentTasks: [],
  metricImportBatches: []
};
const preview = previewMetricImport(previewStore, {
  accountId: "acc_xhs",
  platform: "xiaohongshu",
  rows: [{
    publicationId: atomicPublication.id,
    platformContentId: atomicPublication.canonicalPlatformContentId,
    cutoffAt: "2026-08-31T00:00:00.000Z",
    measurementWindow: "72h",
    views: "1200",
    saves: "80"
  }]
}, { featureFlags: { atomicExactFeedbackV1: true } });
assert.equal(preview.exactMatchCount, 1);
assert.equal(preview.rows[0].match.authority, "unified_atomic");
assert.equal(preview.rows[0].match.projectId, "project-1");
assert.ok(!preview.rows[0].qualityIssues.includes("ATOMIC_EXACT_FEEDBACK_DISABLED"));

const businessStore = {
  unifiedAtomicManualPublications: [{
    ...atomicPublication,
    workspaceId: "workspace-1",
    companyId: "company-1",
    factHash: "3".repeat(64)
  }],
  unifiedAtomicPublicationMetricSnapshots: [{
    id: "metric-1",
    snapshotHash: "4".repeat(64),
    publicationRef: { id: atomicPublication.id, hash: "3".repeat(64) },
    contentProjectRef: atomicPublication.contentProjectRef,
    measurementWindow: { label: "7d" }
  }],
  unifiedAtomicBusinessOutcomeSnapshots: []
};
const businessResult = confirmAtomicBusinessOutcome(businessStore, {
  workspaceId: "workspace-1",
  companyId: "company-1",
  accountId: "acc_xhs",
  platform: "xiaohongshu",
  contentProjectRef: atomicPublication.contentProjectRef,
  publicationRef: { id: atomicPublication.id, hash: "3".repeat(64) },
  metricSnapshotRef: { id: "metric-1", hash: "4".repeat(64) },
  outcomes: { qualifiedLeads: 2, wonDeals: 1, revenue: 8800 },
  source: { kind: "csv_import", batchId: "batch-1", rowNumber: 2 },
  actorType: "user",
  actorId: "workspace_user",
  idempotencyKey: "business-outcome-test-1"
}, { featureFlags: { atomicExactFeedbackV1: true }, now: "2026-09-01T00:00:00.000Z" });
assert.equal(businessResult.created, true);
assert.equal(businessResult.snapshot.outcomes.qualifiedLeads, 2);
assert.equal(validateAtomicBusinessOutcomeSnapshot(businessResult.snapshot), true);

const action = {
  actionId: "feedback_action_1",
  accountId: "acc_xhs",
  platform: "xiaohongshu",
  status: "accepted",
  sourceBottleneck: "distribution_to_click",
  changeVariable: "title_cover_value_proposition",
  targetMetric: "coverClickRate"
};
const portfolio = buildNextCycleContentPortfolio({
  feedbackWorkspace: { outcomes: [], diagnoses: [], cycleReviews: [] },
  historyIndex: { items: [], clusters: [] },
  strategyAdjustmentWorkspace: { decisions: [], bindings: [] },
  tacticalLearningPack: { actions: [action] },
  companyId: "company-1",
  socialAccountId: "acc_xhs",
  platform: "xiaohongshu",
  activeStrategySnapshotId: "strategy-1",
  itemCount: 3
});
assert.equal(portfolio.repairSignal.feedbackActionRef.id, action.actionId);
assert.equal(portfolio.repairSignal.changeVariable, action.changeVariable);
assert.equal(portfolio.allocation.counts.repair, 1, "an explicitly accepted tactical action must receive a repair slot");
assert.ok(portfolio.evidenceRefs.includes(action.actionId));
assert.equal(portfolio.evidenceWindow.confidence, "insufficient", "acceptance must not overstate evidence confidence");

const actionStore = { feedbackActions: [{ ...action, id: action.actionId }] };
const repairSlotId = "slot-repair-1";
const [boundAction] = bindFeedbackActionsToCycle(actionStore, {
  cycleId: "cycle-next-1",
  nextCycleContentPortfolios: [portfolio],
  slots: [{
    slotId: repairSlotId,
    zone: "scheduled",
    contentLearningInstruction: { experiment: { feedbackActionRef: { id: action.actionId } } }
  }]
});
assert.equal(boundAction.status, "injected_into_plan");
assert.equal(boundAction.nextCycleId, "cycle-next-1");
assert.deepEqual(boundAction.nextSlotIds, [repairSlotId]);

const consumedPortfolio = buildNextCycleContentPortfolio({
  feedbackWorkspace: { outcomes: [], diagnoses: [], cycleReviews: [] },
  historyIndex: { items: [], clusters: [] },
  strategyAdjustmentWorkspace: { decisions: [], bindings: [] },
  tacticalLearningPack: { actions: [{ ...action, status: "injected_into_plan" }] },
  companyId: "company-1",
  socialAccountId: "acc_xhs",
  platform: "xiaohongshu",
  activeStrategySnapshotId: "strategy-1",
  itemCount: 3
});
assert.equal(consumedPortfolio.repairSignal, null, "a bound action must not be injected into a later cycle again");

const [appSource, htmlSource, serverSource, feedbackReviewSource] = await Promise.all([
  readFile(new URL("../../app.js", import.meta.url), "utf8"),
  readFile(new URL("../../index.html", import.meta.url), "utf8"),
  readFile(new URL("../../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../content-agent/feedback-review-engine.mjs", import.meta.url), "utf8")
]);
assert.match(htmlSource, /id="v2CycleStart" type="date"/);
assert.match(appSource, /cycleStart,\s*\n\s*cycleDays/);
assert.match(appSource, /getStrategyAdjustments\(\{ companyId: account\.companyId, socialAccountId: account\.id \}\)/);
assert.match(appSource, /data-strategy-feedback-discuss/);
assert.match(serverSource, /bindFeedbackActionsToCycle\(store, saved\.plan\)/);
assert.match(feedbackReviewSource, /status:\s*"injected_into_plan"/);
assert.match(feedbackReviewSource, /nextCycleId:\s*plan\.cycleId/);

console.log(JSON.stringify({
  status: "feedback-next-cycle-wiring-self-test passed",
  atomicImportAuthority: preview.rows[0].match.authority,
  acceptedActionRepairSlots: portfolio.allocation.counts.repair,
  atomicBusinessOutcomes: businessResult.snapshot.outcomes,
  confidence: portfolio.evidenceWindow.confidence
}, null, 2));
