import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { classifyHotspotFailure, runHotspotPipeline } from "../../hotspot-engine.mjs";
import {
  assertHotspotContentEligibility,
  commitHotspotPreview,
  recordContentSourceUsage
} from "../../content-agent/library-store.mjs";
import {
  createContentOpportunity,
  markOpportunityStarted
} from "../../content-agent/operating-plan.mjs";
import { planNextContent } from "../../content-agent/index.mjs";
import { createContentWorkflow } from "../../content-agent/workflow-engine.mjs";
import { buildRunTrace } from "../../content-agent/run-ledger.mjs";
import { runContentPipeline } from "../../content-engine.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const strategySnapshot = JSON.parse(
  await readFile(`${root}/tests/fixtures/demo-data/expected-strategy-snapshot.json`, "utf8")
);
strategySnapshot.id = "strategy_hotspot_lineage";

const store = {
  hotspotPreviews: [],
  hotspotLibrary: [],
  contentOpportunities: [],
  contentRuns: [],
  contentWorkflows: []
};
const companyId = "company_hotspot_lineage";
const socialAccountId = "social_xhs_hotspot_lineage";
const sourceUrl = "https://example.com/test-fixture/hotspot-001";

await assert.rejects(
  runHotspotPipeline(
    { poolType: "global", requireLive: true },
    {},
    {
      collectGlobalHotspots: async () => ({
        mode: "test_fixture",
        items: [],
        sources: [],
        warnings: []
      })
    }
  ),
  (error) => error.code === "HOTSPOT_PROVIDER_NOT_LIVE"
);
assert.deepEqual(
  classifyHotspotFailure(Object.assign(new Error("provider timeout"), { code: "ETIMEDOUT" }), {
    providerMode: "live_required",
    failureStage: "collection"
  }),
  {
    providerMode: "live_required",
    errorClass: "HOTSPOT_PROVIDER_TIMEOUT",
    failureStage: "collection",
    message: "provider timeout",
    retryAction: {
      action: "retry_collection",
      label: "重试真实热点采集",
      preservesPreview: true
    }
  }
);

const collection = await runHotspotPipeline({
  poolType: "keyword",
  companyId,
  directionId: "direction_hotspot_lineage",
  keywordProfile: {
    coreKeywords: ["AI智能体"],
    scenarioKeywords: ["企业落地"]
  },
  timeWindowDays: 7,
  targetOpportunityCount: 1,
  minimumHotspotScore: 1,
  maxCollectionRounds: 1,
  requireLive: false
}, store, {
  collectSearchSignals: async () => ({
    mode: "test_fixture",
    sources: ["authorized_search_fixture"],
    warnings: [],
    items: [{
      id: "provider_signal_001",
      query: "AI智能体",
      title: "企业开始用任务标准验收AI智能体",
      snippet: "企业落地讨论聚焦任务输入、输出和人工复核",
      source: "授权搜索样本",
      platform: "xiaohongshu",
      publishedAt: new Date().toISOString(),
      capturedAt: new Date().toISOString(),
      url: sourceUrl,
      metrics: { likes: 120, comments: 18, saves: 42 }
    }]
  }),
  generateText: async (request) => {
    if (request.task === "judge_hotspot_relevance") {
      return {
        mode: "test",
        data: {
          items: request.candidates.map((item) => ({
            id: item.id,
            score: 95,
            related: true,
            reason: "直接讨论AI智能体企业落地",
            matchedKeywords: ["AI智能体"]
          }))
        }
      };
    }
    if (request.task === "translate_hotspot_cards_to_simplified_chinese") {
      return {
        mode: "test",
        data: {
          items: request.items.map((item) => ({
            id: item.id,
            titleZhCn: item.title,
            summaryZhCn: item.summary,
            category: "科技互联网"
          }))
        }
      };
    }
    return { mode: "test", data: { items: [] } };
  }
});

assert.equal(collection.run.mode, "test_fixture");
assert.equal(collection.opportunities.length, 1);
assert.equal(collection.opportunities[0].sourceUrl, sourceUrl);
assert.equal(collection.opportunities[0].relevanceTier, "bridge");

const preview = {
  id: "preview_hotspot_lineage",
  companyId,
  status: "preview_ready",
  run: collection.run,
  opportunities: collection.opportunities,
  createdAt: new Date().toISOString()
};
store.hotspotPreviews.push(preview);
assert.equal(store.hotspotLibrary.length, 0, "采集预览不得自动写入热点库");
assert.throws(
  () => commitHotspotPreview(store, preview),
  (error) => error.code === "HOTSPOT_SELECTION_REQUIRED"
);

const previewItemId = collection.opportunities[0].id;
const committed = commitHotspotPreview(store, preview, {
  selectedIds: [previewItemId],
  companyId,
  committedBy: "test_user"
});
assert.equal(committed.items.length, 1);
const hotspotAsset = committed.items[0];
assert.notEqual(hotspotAsset.id, previewItemId);
assert.equal(hotspotAsset.sourceUrl, sourceUrl);
assert.equal(hotspotAsset.providerMode, "test_fixture");

const replay = commitHotspotPreview(store, preview, {
  selectedIds: [previewItemId],
  companyId,
  committedBy: "test_user"
});
assert.equal(replay.items[0].id, hotspotAsset.id);
assert.equal(store.hotspotLibrary.length, 1, "重复提交同一预览必须幂等");
assert.equal(store.hotspotLibrary[0].seenCount, 1, "幂等重放不得虚增发现次数");
const firstDiscoveredAt = hotspotAsset.firstDiscoveredAt;
const secondPreview = {
  id: "preview_hotspot_lineage_second",
  companyId,
  status: "preview_ready",
  run: collection.run,
  opportunities: [{
    ...collection.opportunities[0],
    id: "preview_item_second",
    eventId: "provider_event_second",
    title: `${collection.opportunities[0].title}最新进展`,
    originalTitle: `${collection.opportunities[0].originalTitle}最新进展`,
    sourceUrl: "https://example.com/test-fixture/hotspot-001-followup",
    sourceEvidence: [{
      source: "授权搜索样本二",
      sourcePlatform: "xiaohongshu",
      title: "后续来源",
      url: "https://example.com/test-fixture/hotspot-001-followup",
      capturedAt: new Date().toISOString(),
      mode: "test_fixture"
    }]
  }],
  createdAt: new Date().toISOString()
};
const merged = commitHotspotPreview(store, secondPreview, {
  selectedIds: ["preview_item_second"],
  companyId,
  committedBy: "test_user"
});
assert.equal(merged.items[0].id, hotspotAsset.id, "再次采集同一事件必须合并到原热点资产");
assert.equal(store.hotspotLibrary.length, 1);
assert.equal(store.hotspotLibrary[0].firstDiscoveredAt, firstDiscoveredAt);
assert.equal(store.hotspotLibrary[0].sourceEvidence.length, 2);
assert.throws(
  () => commitHotspotPreview(store, preview, { selectedIds: [previewItemId], companyId: "other_company" }),
  (error) => error.code === "HOTSPOT_PREVIEW_SCOPE_MISMATCH"
);

assertHotspotContentEligibility(hotspotAsset);
assert.throws(
  () => assertHotspotContentEligibility({ ...hotspotAsset, relevanceTier: "unrelated" }),
  (error) => error.code === "HOTSPOT_UNRELATED"
);
assert.throws(
  () => assertHotspotContentEligibility({ ...hotspotAsset, relevanceTier: "weak_experiment" }),
  (error) => error.code === "HOTSPOT_WEAK_CONFIRMATION_REQUIRED"
);
assert.doesNotThrow(() =>
  assertHotspotContentEligibility(
    { ...hotspotAsset, relevanceTier: "weak_experiment" },
    { weakExperimentConfirmed: true }
  )
);

const ownership = {
  workspaceId: "workspace_hotspot_lineage",
  companyId,
  socialAccountId,
  socialAccount: { id: socialAccountId, platform: "xiaohongshu" }
};
const opportunity = createContentOpportunity(store, {
  ownership,
  platform: "xiaohongshu",
  sourceType: "hotspot",
  sourceId: hotspotAsset.id,
  topic: hotspotAsset.title,
  angle: hotspotAsset.relevanceReason,
  contentPurposeId: "hotspot_industry_explainer",
  preferredSourceMode: "hotspot",
  metadata: {
    hotspotAssetId: hotspotAsset.id,
    hotspotSnapshot: structuredClone(hotspotAsset)
  }
});

const plan = planNextContent({
  strategySnapshot,
  currentFacts: [],
  platform: "xiaohongshu",
  hotspots: [hotspotAsset],
  knowledgeItems: [],
  history: [],
  userRequest: {
    topic: opportunity.topic,
    angle: opportunity.angle,
    contentRole: "traffic",
    format: "opinion",
    preferredSourceMode: "hotspot",
    sourceIds: [hotspotAsset.id]
  }
});
const recommendation = plan.recommendations[0];
assert.deepEqual(
  recommendation.generationPayload.contentSourceEvidence.hotspots.map((item) => item.id),
  [hotspotAsset.id]
);

const workflow = createContentWorkflow(store, {
  accountId: socialAccountId,
  recommendation,
  generationPayload: {
    ...recommendation.generationPayload,
    workspaceId: ownership.workspaceId,
    companyId,
    socialAccountId,
    contentOpportunityId: opportunity.id
  }
});
markOpportunityStarted(store, opportunity.id, workflow.id);
assert.equal(store.contentRuns.length, 1, "热点机会必须进入唯一 ContentRun");
assert.throws(
  () => markOpportunityStarted(store, opportunity.id, "content_run_duplicate"),
  (error) => error.code === "CONTENT_OPPORTUNITY_RUN_EXISTS"
);
assert.deepEqual(workflow.hotspotAssetIds, [hotspotAsset.id]);
assert.deepEqual(
  workflow.sourceTrace.decisions.find((item) => item.type === "hotspot").selectedIds,
  [hotspotAsset.id]
);

const pipeline = await runContentPipeline({
  payload: workflow.generationPayload,
  selection: null,
  intentProfile: {
    profile_id: "intent_hotspot_lineage",
    platform: "xiaohongshu",
    purpose: {
      id: "hotspot_industry_explainer",
      label: "热点解读",
      description: "验证热点来源链路"
    },
    promotion: {
      mode: "none",
      knowledge_enabled: false,
      knowledge_asset_ids: [],
      knowledge_snapshot_id: null,
      insertion_rule: "none"
    },
    engagement_policy: { mode: "auto", optimize_for: ["save"] },
    source: { type: "content_agent" }
  },
  citations: [],
  knowledgeAssets: [],
  contentTaskBrief: recommendation.contentTaskBrief,
  contentSourcePlan: recommendation.sourcePlan,
  factSnapshot: recommendation.generationPayload.factSnapshot
}, {
  generateText: async (_request, fallback) => ({ mode: "test", data: fallback || {} })
});
assert.ok(pipeline.contentPackage, "确认热点后必须能执行一次内容生成");

const task = {
  id: "content_task_hotspot_lineage",
  contentRunId: workflow.id,
  contentOpportunityId: opportunity.id,
  contentSourceEvidence: structuredClone(workflow.generationPayload.contentSourceEvidence),
  contentSourceTrace: structuredClone(workflow.sourceTrace),
  currentContent: pipeline.contentPackage,
  status: pipeline.status,
  createdAt: new Date().toISOString()
};
recordContentSourceUsage(store, task);
const trace = buildRunTrace(workflow, task);
assert.deepEqual(task.contentSourceEvidence.hotspots.map((item) => item.id), [hotspotAsset.id]);
assert.deepEqual(task.contentSourceTrace.decisions.find((item) => item.type === "hotspot").selectedIds, [hotspotAsset.id]);
assert.deepEqual(trace.lineage.hotspotAssetIds, [hotspotAsset.id]);
assert.deepEqual(store.hotspotLibrary[0].usedByContentRunIds, [workflow.id]);
assert.deepEqual(store.hotspotLibrary[0].usedByContentTaskIds, [task.id]);

console.log(JSON.stringify({
  status: "passed",
  providerMode: collection.run.mode,
  previewId: preview.id,
  hotspotAssetId: hotspotAsset.id,
  contentOpportunityId: opportunity.id,
  contentRunId: workflow.id,
  contentTaskId: task.id,
  sourceUrl
}, null, 2));
