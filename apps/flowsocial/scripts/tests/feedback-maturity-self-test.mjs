import assert from "node:assert/strict";
import { buildFeedbackWorkspace } from "../../content-agent/feedback-engine.mjs";
import { buildContentHistoryIndex, publicationQueueStage } from "../../content-agent/history-index.mjs";
import { confirmMetricImport, previewMetricImport } from "../../content-agent/platform-feedback-import.mjs";
import { buildPublicationTimeline, recordPublication, recordPublicationMetrics, updatePublication } from "../../content-agent/publishing-feedback.mjs";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const publishedAt = "2026-01-01T00:00:00.000Z";
const at = (offset) => new Date(new Date(publishedAt).getTime() + offset).toISOString();
const store = { accounts: [], contentTasks: [], contentRuns: [], contentPublications: [], metricImportBatches: [] };

function addTask(id, { cycle = true, completeAttribution = true } = {}) {
  const task = {
    id,
    contentRunId: `run_${id}`,
    accountId: "account_xhs",
    socialAccountId: "account_xhs",
    companyId: "company_1",
    workspaceId: "workspace_1",
    platform: "xiaohongshu",
    status: "succeeded",
    currentContent: { post_copy: { recommended_title: id } },
    contentExecutionContext: {
      strategySnapshotId: completeAttribution ? "strategy_1" : null,
      effectiveStrategyId: completeAttribution ? "effective_1" : null,
      growthPlaybookId: completeAttribution ? "playbook_1" : null,
      directionCard: { contentFunction: "authority", pillarId: "pillar_1" }
    }
  };
  const run = {
    id: task.contentRunId,
    socialAccountId: task.socialAccountId,
    companyId: task.companyId,
    effectiveStrategyId: completeAttribution ? "effective_1" : null,
    growthPlaybookId: completeAttribution ? "playbook_1" : null,
    sourcePublishingCycleId: cycle ? "cycle_1" : null,
    sourcePublishingSlotId: cycle ? `slot_${id}` : null
  };
  store.contentTasks.push(task);
  store.contentRuns.push(run);
  return task;
}

const task = addTask("task_maturity");
const publication = recordPublication(store, task, {
  status: "published",
  platformContentId: "note_1",
  publishedAt,
  url: "https://xhs.example/note-1"
});
assert.equal(publication.cycleId, "cycle_1");
assert.equal(publication.slotId, "slot_task_maturity");
assert.equal(publicationQueueStage(task, publication, { now: at(71 * HOUR) }), "awaiting_72h");
assert.equal(publicationQueueStage(task, publication, { now: at(72 * HOUR) }), "ready_for_72h");

const snapshot72 = recordPublicationMetrics(publication, {
  impressions: 1000,
  views: 300,
  measurementWindow: "72h",
  cutoffAt: at(72 * HOUR),
  source: "manual"
}, { now: at(72 * HOUR) });
assert.equal(snapshot72.dataQuality.status, "accepted");
assert.equal(publicationQueueStage(task, publication, { now: at(6 * DAY) }), "awaiting_7d");

const premature7d = recordPublicationMetrics(publication, {
  impressions: 1400,
  views: 420,
  measurementWindow: "7d",
  cutoffAt: at(6 * DAY),
  source: "api"
}, { now: at(6 * DAY) });
assert.equal(premature7d.dataQuality.status, "data_quality_issue");
assert.ok(premature7d.dataQuality.issues.some((item) => item.code === "MEASUREMENT_WINDOW_NOT_MATURE"));
assert.equal(publicationQueueStage(task, publication, { now: at(7 * DAY) }), "data_quality_issue");
const earlyHistoryLength = publication.metricHistory.length;
const replay = recordPublicationMetrics(publication, {
  impressions: 1400,
  views: 420,
  measurementWindow: "7d",
  cutoffAt: at(6 * DAY),
  source: "manual"
}, { now: at(8 * DAY) });
assert.equal(replay.id, premature7d.id);
assert.equal(publication.metricHistory.length, earlyHistoryLength, "same normalized payload must deduplicate across ingestion sources");

const mature7d = recordPublicationMetrics(publication, {
  impressions: 1800,
  views: 540,
  measurementWindow: "7d",
  cutoffAt: at(8 * DAY),
  source: "manual"
}, { now: at(8 * DAY) });
assert.equal(mature7d.revision, 2);
assert.equal(mature7d.supersedesSnapshotId, premature7d.id);
assert.equal(mature7d.dataQuality.timing, "late");
assert.equal(mature7d.dataQuality.eligibleForCycleEvidence, true);
assert.equal(publicationQueueStage(task, publication, { now: at(8 * DAY) }), "mature");
const timeline = buildPublicationTimeline(publication, { now: at(8 * DAY) });
assert.equal(timeline.windows["7d"].revisions.length, 2);
assert.equal(timeline.windows["7d"].latestAccepted.id, mature7d.id);
assert.equal(timeline.comparisons["7d"].known.impressions.delta, 800);
assert.equal(timeline.maturity.windows.final.dueAt, at(30 * DAY));

const brokenTask = addTask("task_repair", { completeAttribution: false });
const broken = recordPublication(store, brokenTask, { status: "published", publishedAt });
assert.equal(publicationQueueStage(brokenTask, broken, { now: at(72 * HOUR) }), "data_quality_issue");
let brokenHistory = buildContentHistoryIndex(store, { accountId: "account_xhs", now: at(72 * HOUR) }).items.find((item) => item.contentTaskId === brokenTask.id);
assert.ok(brokenHistory.publication.missingFields.includes("platformContentId"));
assert.equal(brokenHistory.publication.nextAllowedAction, "repair_required_fields_or_record_a_new_revision_after_due_at");
assert.equal(brokenHistory.publication.distance.targetWindow, "72h");
updatePublication(broken, {
  platformContentId: "note_repaired",
  attribution: { effectiveStrategyId: "effective_1", strategySnapshotId: "strategy_1", growthPlaybookId: "playbook_1" }
});
recordPublicationMetrics(broken, { views: 20, measurementWindow: "72h", cutoffAt: at(72 * HOUR) }, { now: at(72 * HOUR) });
assert.equal(publicationQueueStage(brokenTask, broken, { now: at(72 * HOUR) }), "awaiting_7d");
assert.equal(publicationQueueStage(brokenTask, broken, { now: at(7 * DAY) }), "ready_for_7d");

const legacyTask = addTask("task_legacy", { cycle: false });
const legacy = recordPublication(store, legacyTask, { status: "published", platformContentId: "note_legacy", publishedAt });
recordPublicationMetrics(legacy, { views: 100, measurementWindow: "7d", cutoffAt: at(7 * DAY) }, { now: at(7 * DAY) });
const legacyWorkspace = buildFeedbackWorkspace(store, { accountId: "account_xhs", now: at(8 * DAY) });
const legacyOutcome = legacyWorkspace.outcomes.find((item) => item.publicationId === legacy.id);
assert.equal(legacyOutcome.maturity.queueStage, "mature");
assert.equal(legacyOutcome.dataQuality.eligibleForContentDiagnosis, true);
assert.equal(legacyOutcome.dataQuality.eligibleForCycleEvidence, false);
assert.equal(legacyOutcome.dataQuality.selectedSnapshotAssessment.cycleBinding, "legacy_unbound");
assert.ok(legacyWorkspace.diagnoses.some((item) => item.publicationId === legacy.id), "legacy evidence remains available to content-level diagnosis");
assert.ok(legacyWorkspace.cycleReviews.every((item) => !item.evidenceRefs.includes(legacy.id)), "legacy evidence must not enter a real cycle review");
const latestOnlyLegacy = { ...legacy, id: "publication_latest_only", metricHistory: undefined, latestMetrics: legacy.latestMetrics };
assert.equal(buildPublicationTimeline(latestOnlyLegacy, { now: at(8 * DAY) }).maturity.queueStage, "mature", "pre-history snapshot shape must remain readable");

const importTask = addTask("task_import");
const importPublication = recordPublication(store, importTask, { status: "published", platformContentId: "note_import", publishedAt, url: "https://xhs.example/import" });
const batch = previewMetricImport(store, {
  accountId: "account_xhs",
  platform: "xiaohongshu",
  csvText: `url,measurementWindow,cutoffAt,impressions,views\nhttps://xhs.example/import,7d,${at(5 * DAY)},500,200`
});
const confirmed = confirmMetricImport(store, batch.id);
assert.equal(confirmed.results[0].dataQualityStatus, "data_quality_issue");
assert.equal(batch.rows[0].rawEvidence.cutoffAt, at(5 * DAY));
assert.equal(importPublication.metricHistory[0].source, "platform_export");
assert.equal(importPublication.metricHistory[0].sourceMetadata.rowId, batch.rows[0].id, "raw import evidence reference must be retained");

const queue = buildContentHistoryIndex(store, { accountId: "account_xhs", now: at(8 * DAY) });
assert.ok(queue.queueCounts.mature >= 2);
assert.ok(queue.queueCounts.data_quality_issue >= 1);
assert.equal(queue.items.find((item) => item.contentTaskId === task.id).publication.distance, null);

console.log(JSON.stringify({
  status: "feedback-maturity-self-test passed",
  queueCounts: queue.queueCounts,
  revisions: publication.metricHistory.length,
  legacyCycleBinding: legacyOutcome.dataQuality.selectedSnapshotAssessment.cycleBinding
}, null, 2));
