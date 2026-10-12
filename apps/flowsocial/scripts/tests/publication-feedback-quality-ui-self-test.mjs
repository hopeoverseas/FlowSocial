import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildContentHistoryIndex, publicationQueueStage } from "../../content-agent/history-index.mjs";
import { buildPublicationTimeline, extractPlatformContentId, recordPublication, recordPublicationMetrics, updatePublication } from "../../content-agent/publishing-feedback.mjs";

const DAY = 24 * 60 * 60 * 1000;
const publishedAt = "2026-07-01T08:00:00.000Z";
const at = (offset) => new Date(Date.parse(publishedAt) + offset).toISOString();

assert.equal(extractPlatformContentId("xiaohongshu", "https://www.xiaohongshu.com/discovery/item/691bdec00000000004013cbd?source=webshare"), "691bdec00000000004013cbd");
assert.equal(extractPlatformContentId("xiaohongshu", "https://www.xiaohongshu.com/explore/691bdec00000000004013cbd"), "691bdec00000000004013cbd");
assert.equal(extractPlatformContentId("xiaohongshu", "https://www.xiaohongshu.com/search_result?keyword=691bdec00000000004013cbd"), null);
assert.equal(extractPlatformContentId("xiaohongshu", "https://xhslink.com/a/random-short-link"), null);
assert.equal(extractPlatformContentId("wechat", "https://mp.weixin.qq.com/s/c-OsROAIUpjz1RHxQoHcEw"), "c-OsROAIUpjz1RHxQoHcEw");
assert.equal(extractPlatformContentId("wechat", "https://mp.weixin.qq.com/s?__biz=MzA1&mid=123456&idx=2&sn=public"), "wechat:MzA1:123456:2");
assert.equal(extractPlatformContentId("wechat", "https://example.com/s/c-OsROAIUpjz1RHxQoHcEw"), null);

const store = { contentTasks: [], contentRuns: [], contentPublications: [] };
const task = {
  id: "task_quality",
  contentRunId: "run_quality",
  accountId: "account_xhs",
  socialAccountId: "account_xhs",
  companyId: "company_1",
  platform: "xiaohongshu",
  status: "succeeded",
  currentContent: { post_copy: { recommended_title: "质量修复" } },
  contentExecutionContext: { effectiveStrategyId: "effective_1", strategySnapshotId: "strategy_1", growthPlaybookId: "playbook_1" }
};
store.contentTasks.push(task);
store.contentRuns.push({ id: task.contentRunId, socialAccountId: task.socialAccountId, companyId: task.companyId, effectiveStrategyId: "effective_1", strategySnapshotId: "strategy_1", growthPlaybookId: "playbook_1" });

const publication = recordPublication(store, task, { status: "published", url: "https://xhslink.com/a/not-verifiable" });
assert.equal(publication.platformContentId, null, "unsupported URLs must not create a guessed platform ID");
assert.equal(publication.publishedAt, null, "published status must not fabricate the current time");
assert.equal(publication.cycleId, null);
assert.equal(publication.slotId, null);

const rejected = recordPublicationMetrics(publication, { views: 120, measurementWindow: "7d", cutoffAt: at(7 * DAY) }, { now: at(8 * DAY) });
assert.equal(rejected.dataQuality.status, "data_quality_issue");
assert.deepEqual(rejected.dataQuality.missingFields.sort(), ["platformContentId", "publishedAt"].sort());
assert.equal(publicationQueueStage(task, publication, { now: at(8 * DAY) }), "data_quality_issue");
const beforeRepair = buildContentHistoryIndex(store, { accountId: "account_xhs", now: at(8 * DAY) }).items[0];
assert.ok(beforeRepair.publication.missingFields.includes("platformContentId"));
assert.ok(beforeRepair.publication.missingFields.includes("publishedAt"));
assert.equal(beforeRepair.publication.nextAllowedAction, "repair_required_fields_or_record_a_new_revision_after_due_at");

updatePublication(publication, { platformContentId: "manual-note-id", publishedAt });
const repairedTimeline = buildPublicationTimeline(publication, { now: at(8 * DAY) });
assert.equal(repairedTimeline.maturity.queueStage, "mature", "repair must immediately re-evaluate existing evidence");
assert.equal(repairedTimeline.windows["7d"].revisions.length, 1, "repair must preserve the old revision");
assert.equal(repairedTimeline.windows["7d"].latestAccepted.id, rejected.id);
assert.equal(repairedTimeline.windows["7d"].latestAccepted.revision, 1);
assert.equal(repairedTimeline.windows["7d"].latestAccepted.dataQuality?.cycleBinding, "legacy_unbound");
assert.equal(rejected.dataQuality.cycleBinding, "legacy_unbound");

const revision = recordPublicationMetrics(publication, { views: 160, measurementWindow: "7d", cutoffAt: at(8 * DAY) }, { now: at(8 * DAY) });
assert.equal(revision.revision, 2);
assert.equal(revision.supersedesSnapshotId, rejected.id);
assert.equal(publication.metricHistory.length, 2);
assert.equal(revision.dataQuality.eligibleForCycleEvidence, false, "repair UI must not fabricate cycle attribution");

const beforeMissingCutoff = publication.metricHistory.length;
assert.throws(
  () => recordPublicationMetrics(publication, { views: 180, measurementWindow: "final" }, { now: at(31 * DAY) }),
  (error) => error.code === "CUTOFF_AT_REQUIRED"
);
assert.equal(publication.metricHistory.length, beforeMissingCutoff, "rejected snapshots must not append a revision");

const earlyTask = { ...task, id: "task_early", contentRunId: "run_early" };
store.contentTasks.push(earlyTask);
store.contentRuns.push({ ...store.contentRuns[0], id: earlyTask.contentRunId });
const earlyPublication = recordPublication(store, earlyTask, { status: "published", platformContentId: "early-note", publishedAt });
const early7d = recordPublicationMetrics(earlyPublication, { views: 90, measurementWindow: "7d", cutoffAt: at(5 * DAY) }, { now: at(7 * DAY) });
assert.equal(early7d.dataQuality.status, "data_quality_issue");
assert.ok(early7d.dataQuality.issues.some((issue) => issue.code === "MEASUREMENT_WINDOW_NOT_MATURE"));

const autoTask = { ...task, id: "task_auto", contentRunId: "run_auto" };
store.contentTasks.push(autoTask);
store.contentRuns.push({ ...store.contentRuns[0], id: autoTask.contentRunId });
const autoPublication = recordPublication(store, autoTask, { status: "published", url: "https://www.xiaohongshu.com/discovery/item/691bdec00000000004013cbd", publishedAt });
assert.equal(autoPublication.platformContentId, "691bdec00000000004013cbd");

const scheduledTask = { ...task, id: "task_scheduled", contentRunId: "run_scheduled" };
store.contentTasks.push(scheduledTask);
const scheduled = recordPublication(store, scheduledTask, { status: "scheduled", scheduledAt: "2026-07-01T07:00:00.000Z" });
updatePublication(scheduled, { status: "published" });
assert.equal(scheduled.publishedAt, scheduled.scheduledAt, "legacy scheduled transition may reuse its recorded schedule, never the current clock");

const [html, app, styles, server] = await Promise.all([
  readFile(new URL("../../index.html", import.meta.url), "utf8"),
  readFrontendSource(),
  readFile(new URL("../../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../../server.mjs", import.meta.url), "utf8")
]);
for (const id of ["v2FeedbackPlatformContentId", "v2FeedbackPublishedAt", "v2FeedbackCutoffAt", "v2FeedbackQuality", "v2QueueQuality"]) assert.ok(html.includes(`id="${id}"`), `missing UI control ${id}`);
for (const copy of ["数据需修复", "补齐发布信息", "平台内容 ID", "实际发布时间", "指标数据截止时间", "下一步动作"]) assert.ok(`${html}\n${app}`.includes(copy), `missing Chinese quality copy: ${copy}`);
for (const stage of ["data_quality_issue", "awaiting_72h", "ready_for_72h", "awaiting_7d", "ready_for_7d", "mature"]) assert.ok(app.includes(stage), `missing maturity queue stage ${stage}`);
assert.ok(app.includes("cutoffAt: v2IsoFromDateTimeInput"));
assert.ok(app.includes("publishedAt: v2IsoFromDateTimeInput"));
assert.ok(!app.includes('publishedAt: $("#v2FeedbackStatus").value === "published" ? new Date().toISOString() : null'));
assert.ok(styles.includes(".feedback-quality-panel"));
assert.ok(server.includes("CUTOFF_AT_REQUIRED") || server.includes("PERFORMANCE_SNAPSHOT_REJECTED"));

console.log(JSON.stringify({
  status: "publication-feedback-quality-ui-self-test passed",
  repairedQueueStage: repairedTimeline.maturity.queueStage,
  preservedRevisions: publication.metricHistory.length,
  cycleBinding: revision.dataQuality.cycleBinding,
  extractedPlatforms: ["xiaohongshu", "wechat"]
}, null, 2));
