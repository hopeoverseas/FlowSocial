import assert from "node:assert/strict";
import { buildFeedbackWorkspace, normalizePerformanceSnapshot } from "../../content-agent/feedback-engine.mjs";
import { acceptFeedbackAction, createFeedbackFollowupRun } from "../../content-agent/feedback-review-engine.mjs";
import { buildContentHistoryIndex, publicationQueueStage } from "../../content-agent/history-index.mjs";
import { previewMetricImport, confirmMetricImport } from "../../content-agent/platform-feedback-import.mjs";
import { buildPublicationTimeline, recordPublication, recordPublicationMetrics, updatePublication } from "../../content-agent/publishing-feedback.mjs";

const store = {
  accounts: [
    { id: "wx_feedback", platform: "wechat", accountType: "social", workspaceId: "workspace_feedback", companyId: "company_feedback" },
    { id: "xhs_feedback", platform: "xiaohongshu", accountType: "social", workspaceId: "workspace_feedback", companyId: "company_feedback" }
  ],
  contentTasks: [], contentRuns: [], contentPublications: [], metricImportBatches: []
};
assert.equal(publicationQueueStage({ status: "needs_review" }), "needs_completion");
assert.equal(publicationQueueStage({ status: "succeeded", currentContent: { recommended_title: "ready" } }), "ready_to_publish");
const scheduledPublication = recordPublication(store, { id: "task_scheduled", accountId: "xhs_feedback", platform: "xiaohongshu" }, { status: "scheduled", scheduledAt: "2026-08-01T08:00:00.000Z" });
updatePublication(scheduledPublication, { status: "published", url: "https://xhs.example/scheduled" });
assert.equal(scheduledPublication.status, "published");
assert.ok(scheduledPublication.publishedAt);

for (let index = 0; index < 6; index += 1) {
  const task = {
    id: `task_feedback_${index}`,
    contentRunId: `run_feedback_${index}`,
    accountId: "wx_feedback",
    socialAccountId: "wx_feedback",
    companyId: "company_feedback",
    workspaceId: "workspace_feedback",
    platform: "wechat",
    version: 1,
    ideaTitle: `反馈文章 ${index + 1}`,
    currentContent: { recommended_title: `反馈文章 ${index + 1}` },
    contentExecutionContext: {
      id: `execution_feedback_${index}`,
      strategySnapshotId: "strategy_feedback_v1",
      factSnapshotId: "facts_feedback_v1",
      effectiveStrategyId: "effective_feedback_v1",
      growthPlaybookId: "wechat_authority",
      validationHypothesis: "验证标题打开与业务承接",
      directionCard: { id: `direction_feedback_${index}`, objectiveId: "objective_lead", contentFunction: "authority", pillarId: "pillar_method", audienceId: "audience_owner", topic: `反馈文章 ${index + 1}`, format: "article" },
      sourcePlan: { id: `source_feedback_${index}`, sources: [{ type: "knowledge_base", candidateIds: ["knowledge_1"] }] }
    }
  };
  const run = {
    id: task.contentRunId,
    workspaceId: "workspace_feedback",
    companyId: "company_feedback",
    matrixId: "matrix_feedback",
    socialAccountId: "wx_feedback",
    effectiveStrategyId: "effective_feedback_v1",
    growthPlaybookId: "wechat_authority",
    validationHypothesis: "验证标题打开与业务承接",
    rollingPlanId: "rolling_feedback",
    rollingPlanItemId: `plan_item_${index}`,
    sourcePublishingCycleId: index < 3 ? "cycle_feedback_1" : "cycle_feedback_2",
    sourcePublishingSlotId: `slot_feedback_${index}`,
    contentOpportunityId: `opportunity_${index}`,
    generationPayload: { ideaTitle: task.ideaTitle, platform: "wechat", contentTaskBrief: { contentPillar: "pillar_method", contentRole: "authority" }, contentExecutionContext: task.contentExecutionContext }
  };
  store.contentTasks.push(task);
  store.contentRuns.push(run);
  const publishedAt = new Date(Date.UTC(2026, index < 3 ? 5 : 6, 1 + index)).toISOString();
  const publication = recordPublication(store, task, { platform: "wechat", platformContentId: `wechat_article_${index}`, status: "published", publishedAt });
  recordPublicationMetrics(publication, {
    views: index < 3 ? 70 : 280,
    platformMetrics: { delivered: 850 },
    leads: index < 3 ? 0 : 3,
    measurementWindow: "72h",
    cutoffAt: new Date(new Date(publishedAt).getTime() + 72 * 60 * 60 * 1000).toISOString(),
    source: "manual"
  });
  recordPublicationMetrics(publication, {
    views: index < 3 ? 100 : 400,
    platformMetrics: { delivered: 1000 },
    leads: index < 3 ? 1 : 6,
    businessOutcome: index < 2 ? { qualifiedLeads: 1 } : {},
    measurementWindow: "7d",
    cutoffAt: new Date(new Date(publishedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    source: "manual"
  });
}

const workspace = buildFeedbackWorkspace(store, { accountId: "wx_feedback" });
assert.equal(workspace.outcomes.length, 6);
assert.equal(workspace.outcomes[0].attribution.matrixId, "matrix_feedback");
assert.equal(workspace.outcomes[0].attribution.rollingPlanId, "rolling_feedback");
assert.equal(workspace.outcomes[0].attribution.contentOpportunityId, "opportunity_0");
assert.ok(workspace.diagnoses.filter((item) => item.funnelStage === "delivery_to_open").length >= 3);
assert.equal(workspace.cycleReviews.length, 1);
assert.equal(workspace.cycleReviews[0].eligibleForStrategyReview, true);
assert.deepEqual(workspace.cycleReviews[0].cycleIds.sort(), ["cycle_feedback_1", "cycle_feedback_2"]);
assert.equal(workspace.strategyReviewCandidates.length, 1);
assert.equal(workspace.strategyReviewCandidates[0].autoApply, false);

const xhsTask = { id: "task_xhs_import", accountId: "xhs_feedback", socialAccountId: "xhs_feedback", companyId: "company_feedback", workspaceId: "workspace_feedback", platform: "xiaohongshu", version: 1, ideaTitle: "导入测试", currentContent: { post_copy: { recommended_title: "导入测试" } } };
store.contentTasks.push(xhsTask);
xhsTask.contentExecutionContext = { strategySnapshotId: "strategy_xhs_v1", effectiveStrategyId: "effective_xhs_v1", growthPlaybookId: "xhs_playbook" };
const xhsPublication = recordPublication(store, xhsTask, { status: "published", platform: "xiaohongshu", platformContentId: "xhs_note_1", url: "https://xhs.example/note-1", publishedAt: "2026-07-01T08:00:00.000Z" });
assert.equal(buildContentHistoryIndex(store, { accountId: "xhs_feedback" }).items[0].queueStage, "ready_for_72h");
const batch = previewMetricImport(store, {
  accountId: "xhs_feedback",
  platform: "xiaohongshu",
  csvText: "笔记链接,笔记标题,曝光数,观看数,收藏数,评论数,主页访客,观察窗口,统计截止时间,cycleId,slotId\nhttps://xhs.example/note-1,导入测试,1000,300,20,5,18,72h,2026-07-04T08:00:00.000Z,fabricated_cycle,fabricated_slot"
});
assert.equal(batch.exactMatchCount, 1);
assert.equal(batch.rows[0].metrics.impressions, "1000");
const confirmed = confirmMetricImport(store, batch.id, {});
assert.equal(confirmed.status, "confirmed");
assert.equal(xhsPublication.latestMetrics.impressions, 1000);
assert.equal(xhsPublication.latestMetrics.platformMetrics.profileVisits, 18);
assert.equal(xhsPublication.latestMetrics.likes, null, "missing core metrics must remain null");
assert.equal(xhsPublication.latestMetrics.schemaVersion, "2.0");
assert.equal(xhsPublication.latestMetrics.snapshotIdentity, "72h");
assert.equal(xhsPublication.cycleId, null, "CSV evidence must not fabricate cycle attribution");
assert.equal(xhsPublication.slotId, null, "CSV evidence must not fabricate slot attribution");
assert.equal(buildContentHistoryIndex(store, { accountId: "xhs_feedback" }).items[0].queueStage, "ready_for_7d");

const publicationCountBeforeRejectedHistory = store.contentPublications.length;
const taskCountBeforeRejectedHistory = store.contentTasks.length;
const historicalWithoutTime = previewMetricImport(store, {
  accountId: "xhs_feedback",
  platform: "xiaohongshu",
  csvText: "笔记链接,笔记标题,观看数,观察窗口,统计截止时间\nhttps://xhs.example/unmatched,无发布时间历史内容,50,72h,2026-07-04T08:00:00.000Z"
});
const rejectedHistory = confirmMetricImport(store, historicalWithoutTime.id, { allowHistoricalImport: true });
assert.equal(rejectedHistory.results[0].reason, "HISTORICAL_PUBLISHED_AT_REQUIRED");
assert.equal(store.contentPublications.length, publicationCountBeforeRejectedHistory, "rejected history must not create a simulated publication");
assert.equal(store.contentTasks.length, taskCountBeforeRejectedHistory, "rejected history must not create a succeeded empty content task");

const validHistorical = previewMetricImport(store, {
  accountId: "xhs_feedback",
  platform: "xiaohongshu",
  csvText: "笔记ID,笔记标题,发布时间,观看数,观察窗口,统计截止时间,cycleId,slotId\nhistorical_note,真实历史内容,2026-06-01T08:00:00.000Z,60,7d,2026-06-08T08:00:00.000Z,fabricated_cycle,fabricated_slot"
});
const importedHistorical = confirmMetricImport(store, validHistorical.id, { allowHistoricalImport: true });
assert.equal(importedHistorical.results[0].status, "imported");
const historicalPublication = store.contentPublications.find((item) => item.id === importedHistorical.results[0].publicationId);
const historicalTask = store.contentTasks.find((item) => item.id === historicalPublication.contentTaskId);
assert.equal(historicalTask.status, "historical_import", "history metadata must not claim content generation succeeded");
assert.equal(historicalPublication.publishedAt, "2026-06-01T08:00:00.000Z");
assert.equal(historicalPublication.cycleId, null);
assert.equal(historicalPublication.slotId, null);

const historyBeforeMissingCutoff = xhsPublication.metricHistory.length;
const missingCutoffBatch = previewMetricImport(store, {
  accountId: "xhs_feedback",
  platform: "xiaohongshu",
  csvText: "笔记链接,观看数,观察窗口\nhttps://xhs.example/note-1,999,final"
});
const missingCutoff = confirmMetricImport(store, missingCutoffBatch.id);
assert.equal(missingCutoff.results[0].reason, "CUTOFF_AT_REQUIRED");
assert.equal(xhsPublication.metricHistory.length, historyBeforeMissingCutoff, "missing cutoff must not append a snapshot revision");
const publicationCountBeforeIncompleteHistory = store.contentPublications.length;
const taskCountBeforeIncompleteHistory = store.contentTasks.length;
const incompleteHistoricalBatch = previewMetricImport(store, {
  accountId: "xhs_feedback",
  platform: "xiaohongshu",
  csvText: "笔记ID,笔记标题,发布时间,观看数,观察窗口\nincomplete_history,缺少截止时间,2026-06-02T08:00:00.000Z,20,72h"
});
const incompleteHistorical = confirmMetricImport(store, incompleteHistoricalBatch.id, { allowHistoricalImport: true });
assert.equal(incompleteHistorical.results[0].reason, "CUTOFF_AT_REQUIRED");
assert.equal(store.contentPublications.length, publicationCountBeforeIncompleteHistory, "invalid metric row must not partially create a historical publication");
assert.equal(store.contentTasks.length, taskCountBeforeIncompleteHistory, "invalid metric row must not partially create a historical content task");

const foreignPublication = store.contentPublications.find((item) => item.accountId === "wx_feedback");
const foreignMetricCount = foreignPublication.metricHistory.length;
const mismatchedResolutionBatch = previewMetricImport(store, {
  accountId: "xhs_feedback",
  platform: "xiaohongshu",
  csvText: "笔记标题,观看数,观察窗口,统计截止时间\n无法匹配的内容,80,72h,2026-07-04T08:00:00.000Z"
});
const mismatchedResolution = confirmMetricImport(store, mismatchedResolutionBatch.id, { resolutions: { [mismatchedResolutionBatch.rows[0].id]: { publicationId: foreignPublication.id } } });
assert.equal(mismatchedResolution.results[0].reason, "RESOLUTION_SCOPE_MISMATCH");
assert.equal(foreignPublication.metricHistory.length, foreignMetricCount, "cross-account resolution must not write feedback to another platform publication");

const firstSnapshot = xhsPublication.latestMetrics;
const firstManual = recordPublicationMetrics(xhsPublication, {
  impressions: 1000, views: 300, measurementWindow: "72h", cutoffAt: "2026-07-04T08:00:00.000Z", source: "manual", sourceMetadata: { syncKey: "xhs:note-1:72h" }
});
assert.equal(firstManual.revision, 2, "CSV and manual input must share one window revision chain");
assert.equal(firstManual.supersedesSnapshotId, firstSnapshot.id);
const historyAfterFirstManual = xhsPublication.metricHistory.length;
recordPublicationMetrics(xhsPublication, {
  impressions: 1000, views: 300, measurementWindow: "72h", cutoffAt: "2026-07-04T08:00:00.000Z", source: "manual", sourceMetadata: { syncKey: "xhs:note-1:72h" }
});
assert.equal(xhsPublication.metricHistory.length, historyAfterFirstManual, "exact replay must be idempotent");
const revised = recordPublicationMetrics(xhsPublication, {
  impressions: 1100, views: 330, measurementWindow: "72h", cutoffAt: "2026-07-04T08:00:00.000Z", source: "manual", sourceMetadata: { syncKey: "xhs:note-1:72h" }
});
assert.equal(revised.revision, 3);
assert.ok(revised.supersedesSnapshotId);
assert.notEqual(firstSnapshot.id, revised.id);

const sevenDay = recordPublicationMetrics(xhsPublication, {
  impressions: 1800, views: 540, saves: 35, comments: null, measurementWindow: "7d", cutoffAt: "2026-07-08T08:00:00.000Z", source: "manual"
});
assert.equal(sevenDay.revision, 1, "a new window must start its own revision chain");
assert.equal(sevenDay.comments, null);
assert.equal(xhsPublication.metricHistory.length, historyAfterFirstManual + 2, "72h history must remain after 7d is saved");
const timeline = buildPublicationTimeline(xhsPublication);
assert.equal(timeline.windows["72h"].revisions.length, 3);
assert.equal(timeline.windows["7d"].latest.id, sevenDay.id);
assert.equal(timeline.comparisons["7d"].known.impressions.previous, 1100);
assert.equal(timeline.comparisons["7d"].known.impressions.current, 1800);
assert.equal(timeline.comparisons["7d"].known.impressions.delta, 700);
assert.equal(buildContentHistoryIndex(store, { accountId: "xhs_feedback" }).items[0].queueStage, "mature");

const wechatOnly = normalizePerformanceSnapshot({ platform: "wechat", views: 10, platformMetrics: { delivered: 20, coverClicks: 9 } });
assert.equal(wechatOnly.platformMetrics.delivered, 20);
assert.equal(Object.hasOwn(wechatOnly.platformMetrics, "coverClicks"), false, "wechat snapshots must exclude xiaohongshu-only metrics");
assert.equal(wechatOnly.impressions, null);

const actionable = workspace.diagnoses.find((item) => item.nextAction);
assert.ok(actionable, "feedback workspace must expose an actionable diagnosis");
const action = acceptFeedbackAction(store, actionable, { acceptedBy: "test" });
const sourceRun = store.contentRuns.find((item) => item.id === actionable.contentRunId);
const sourcePublication = store.contentPublications.find((item) => item.id === actionable.publicationId);
const sourceTimeline = buildPublicationTimeline(sourcePublication);
assert.ok(sourceTimeline.windows["72h"].latest && sourceTimeline.windows["7d"].latest, "diagnosis source must preserve both 72h and 7d snapshots");
assert.throws(() => createFeedbackFollowupRun(store, action, sourceRun), (error) => error.code === "FEEDBACK_FOLLOWUP_CLONE_RETIRED" && error.statusCode === 410);
assert.equal(action.status, "accepted");
assert.equal(action.nextContentRunId, null);

console.log(JSON.stringify({
  status: "feedback-v2-self-test passed",
  diagnoses: workspace.diagnoses.length,
  strategyCandidates: workspace.strategyReviewCandidates.length,
  importRows: batch.rowCount,
  immutableRevisions: revised.revision,
  timelineDelta: timeline.comparisons["7d"].known.impressions.delta,
  legacyTopicCloneRetired: true
}, null, 2));

