import assert from "node:assert/strict";
import { runContentPipeline } from "../../content-engine.mjs";
import { generateContentOutline } from "../../content-agent/outline-engine.mjs";
import { rerunRevisionDownstream } from "../../content-agent/revision-rerun-engine.mjs";
import { optimizeFinalTitles } from "../../content-agent/title-atom.mjs";

const intentProfile = {
  profile_id: "intent_audit", topic_id: "topic_audit", platform: "wechat",
  purpose: { id: "knowledge_howto", label: "知识方法", description: "提供方法" },
  promotion: { mode: "none", knowledge_enabled: false, knowledge_asset_ids: [], knowledge_snapshot_id: null },
  engagement_policy: { mode: "auto", selected_primary_action: "share" }
};
const contentMaster = {
  topic_id: "topic_audit", intent_profile_id: "intent_audit", central_question: "失败如何守门", central_thesis: "失败必须停止下游", reader_value: "获得可审计的失败边界",
  confirmed_facts: [{ fact_id: "F1", fact: "失败后不得继续交付", source_ids: ["T1"] }], supported_interpretations: [], author_opinions: [], unknowns: [], examples: [], claims_to_avoid: [],
  source_list: [{ source_id: "T1", source_type: "user_temporary_material", title: "离线事实", excerpt: "失败后不得继续交付" }], engagement_policy: { selected_primary_action: "share" }, publish_time_checks: []
};
const confirmedOutline = {
  outline_id: "outline_audit", content_promise: "解释失败边界",
  sections: [
    { section_id: "S1", heading: "识别失败", objective: "识别失败", key_points: ["失败"] },
    { section_id: "S2", heading: "停止下游", objective: "停止下游", key_points: ["停止"] },
    { section_id: "S3", heading: "保留证据", objective: "保留证据", key_points: ["证据"] }
  ]
};
const section = (heading, sentence) => `## ${heading}\n${sentence.repeat(36)}`;
const validArticle = {
  status: "success",
  data: {
    article_promise: "解释失败边界", core_argument: "失败必须停止下游", information_gain: "区分 Provider、合同和质量状态并保留可审计证据",
    title_candidates: ["失败后为什么必须停止内容下游", "内容链如何避免 fallback 误放行", "从 Provider 失败到质量阻断"], recommended_title: "失败后为什么必须停止内容下游",
    abstract: "解释失败守门。", opening: "失败状态不能被成功 fallback 覆盖。", outline: confirmedOutline.sections.map(({ heading }) => ({ heading })),
    article_markdown: [section("识别失败", "先识别 Provider、解析和合同失败，避免把文件返回误记为质量成功。"), section("停止下游", "关键节点失败后立即停止标题、视觉计划和交付，不执行无意义的后续调用。"), section("保留证据", "只保存白名单化错误码、模型归因和计数，不保存原始正文与提示词。")].join("\n\n"),
    pull_quotes: [], key_takeaways: [], share_summary: "失败守门", share_reason: "团队复核", engagement_strategy: { primary_action: "share", reason: "同步边界" }, cta: "", claim_map: [{ claim: "失败后不得继续交付", source_ids: ["T1"] }], used_knowledge_asset_ids: [],
    image_plan: { cover: { purpose: "失败守门", strategy: "html_chart", prompt: "" }, slots: [{ slot_purpose: "状态图", strategy: "html_chart", prompt: "" }] }
  }
};
const providerFallback = (data, code = "MODEL_HTTP_5XX") => ({
  mode: "validated_fallback", data,
  telemetry: { traceId: `trace_${code.toLowerCase()}`, providerSucceeded: false, fallbackUsed: true, errorCode: code, errorCategory: code === "MODEL_INVALID_JSON" ? "invalid_json" : "provider_5xx", attempts: 1, attemptFailures: [] }
});

const masterTasks = [];
const masterBlocked = await runContentPipeline({
  payload: { platform: "wechat", ideaTitle: "失败守门", contentRunId: "run_master_block" }, selection: null, intentProfile, confirmedOutline, account: {}, knowledgeAssets: [], skillExecutionPlan: null,
  citations: [{ citationId: "T1", fileId: "asset_1", fileName: "离线事实", chunkId: "chunk_1", text: "失败后不得继续交付" }]
}, {
  generateText: async (request, fallback) => { masterTasks.push(request.task); return providerFallback(fallback); }
});
assert.equal(masterBlocked.status, "blocked");
assert.deepEqual(masterTasks, ["build_content_master_v2"], "ContentMaster failure must stop outline/writer/downstream");
assert.ok(masterBlocked.qualityReview.blockers.includes("content_master_provider_fallback"));
assert.equal(masterBlocked.executionRecords[0].productionEligibleOutput, false);

const outlineTasks = [];
const outlineResult = await generateContentOutline({
  payload: { platform: "wechat", ideaTitle: "失败守门", temporaryMaterials: [{ id: "T1", usage: "usable", visibility: "publishable", text: "失败后不得继续交付" }] },
  selection: null, intentProfile, citations: [], knowledgeAssets: [], confirmedOutline: null, skillExecutionPlan: null
}, {
  generateText: async (request, fallback) => {
    outlineTasks.push(request.task);
    return request.task === "generate_confirmable_content_outline" ? providerFallback(fallback, "MODEL_INVALID_JSON") : { mode: "offline_fixture", data: fallback };
  }
});
assert.equal(outlineResult.status, "needs_review", "outline fallback must not be reported as outline_ready");
assert.deepEqual(outlineTasks, ["build_content_master_v2", "generate_confirmable_content_outline"]);
assert.equal(outlineResult.skillTraces.at(-1).fallbackUsed, true);

const reviewTasks = [];
const reviewBlocked = await runContentPipeline({
  payload: { platform: "wechat", ideaTitle: "失败守门", contentRunId: "run_review_block", wechatBodyRecovery: true }, selection: null, intentProfile,
  account: {}, knowledgeAssets: [], preparedContentMaster: { status: "ready", data: contentMaster }, confirmedOutline, skillExecutionPlan: null
}, {
  generateText: async (request, fallback) => {
    reviewTasks.push(request.task);
    if (request.task === "write_wechat_article_v2_recovery") return { mode: "offline_fixture", data: validArticle, telemetry: { traceId: "writer_ok", providerSucceeded: true, attempts: 1, fallbackUsed: false } };
    if (request.task === "review_wechat_article_content") return providerFallback(fallback);
    throw new Error(`downstream executed after review failure: ${request.task}`);
  }
});
assert.equal(reviewBlocked.status, "blocked");
assert.deepEqual(reviewTasks, ["write_wechat_article_v2_recovery", "review_wechat_article_content"]);
assert.deepEqual(reviewBlocked.pipeline.slice(-1), ["blocked_before_title_and_image_plan"]);
assert.equal(reviewBlocked.executionRecords.at(-1).productionEligibleOutput, false);

const xhsTasks = [];
const xhsBlocked = await runContentPipeline({
  payload: { platform: "xiaohongshu", ideaTitle: "失败守门", contentRunId: "run_xhs_block" }, selection: null,
  intentProfile: { ...intentProfile, platform: "xiaohongshu" }, account: {}, knowledgeAssets: [], preparedContentMaster: { status: "ready", data: contentMaster }, confirmedOutline, skillExecutionPlan: null
}, {
  generateText: async (request) => { xhsTasks.push(request.task); return providerFallback({}); }
});
assert.equal(xhsBlocked.status, "blocked");
assert.deepEqual(xhsTasks, ["write_xhs_content_v2"], "XHS writer failure must stop title/render downstream");
assert.ok(xhsBlocked.qualityReview.blockers.includes("xhs_writer_provider_fallback"));

const revisionTasks = [];
const revisionInput = structuredClone(validArticle.data);
const revisionBlocked = await rerunRevisionDownstream({
  task: { id: "task_revision", platform: "wechat", version: 2, contentRunId: "run_revision", contentMaster, contentIntentProfile: intentProfile, confirmedOutline, skillExecutionPlan: null },
  contentPackage: revisionInput,
  revisionImpact: { changedPaths: ["/article_markdown"], affectedSteps: ["wechat_content_review", "title", "image_plan", "format"] }, instruction: "精简正文"
}, {
  generateText: async (request, fallback) => { revisionTasks.push(request.task); return providerFallback(fallback); }
});
assert.equal(revisionBlocked.qualityReview.decision, "block");
assert.deepEqual(revisionTasks, ["review_revised_wechat_article"]);
assert.deepEqual(revisionBlocked.contentPackage, revisionInput, "failed review must preserve the immutable current revision content");

const titleResult = await optimizeFinalTitles({ platform: "wechat", contentMaster, contentPackage: validArticle.data }, {
  generateText: async (_request, fallback) => providerFallback(fallback)
});
assert.equal(titleResult.skillTrace.fallbackUsed, true);
assert.equal(titleResult.executionRecord.productionEligibleOutput, false);
assert.ok(titleResult.titleStrategy.candidates.length >= 3);
assert.ok(titleResult.titleStrategy.candidates.every((candidate) => candidate.claim_ids.length === 0), "fallback must not fabricate claim attribution");

console.log(JSON.stringify({
  status: "content-system-audit-regression-self-test passed",
  issuesCovered: 5,
  providerCalls: 0,
  networkCalls: 0,
  productionWrites: 0
}, null, 2));
