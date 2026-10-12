import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { planNextContent } from "../../content-agent/index.mjs";
import { normalizeHotspotRecord, normalizeReferencePost, normalizeViralBlueprint } from "../../content-agent/library-contracts.mjs";
import { runContentPipeline } from "../../content-engine.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const strategySnapshot = JSON.parse(await readFile(`${root}/tests/fixtures/demo-data/expected-strategy-snapshot.json`, "utf8"));
strategySnapshot.id = "strategy_test_001";

const currentFacts = [
  {
    id: "fact_public_case",
    factKey: "case.delivery_cycle",
    value: "一次知识库试点通常先从单一岗位和有限资料范围开始",
    confidence: 0.95,
    visibility: "public",
    contentUsage: "approved",
    status: "confirmed"
  },
  {
    id: "fact_private_price",
    factKey: "offer.internal_price",
    value: "内部报价",
    confidence: 1,
    visibility: "private",
    contentUsage: "do_not_use",
    status: "confirmed"
  }
];

const hotspots = [
  normalizeHotspotRecord({
    id: "hot_ai_agent",
    title: "企业开始重新评估 AI Agent 的落地价值",
    summary: "关注岗位任务与知识资产",
    status: "recommended",
    relevanceScore: 92,
    relatedPillars: ["岗位AI应用场景"]
  })
];

const blueprints = [
  normalizeViralBlueprint({
    id: "blueprint_checklist",
    name: "问题自查清单",
    bestFor: ["xiaohongshu", "wechat"],
    goals: ["traffic", "trust"],
    suitableTopics: [],
    structure: ["点名角色", "描述症状", "给出清单", "说明边界"],
    doNotCopy: ["原文句子", "原案例"]
  })
];

const result = planNextContent({
  strategySnapshot,
  currentFacts,
  platform: "xiaohongshu",
  hotspots,
  knowledgeItems: [{ id: "kb_service", title: "服务说明" }],
  viralBlueprints: blueprints,
  history: [],
  limit: 3
});

assert.equal(result.schemaVersion, "0.1");
assert.equal(result.strategyContext.strategySnapshotId, "strategy_test_001");
assert.equal(result.strategyContext.factSnapshot.usableFacts.length, 1);
assert.equal(result.strategyContext.factSnapshot.forbiddenFacts.length, 1);
assert.equal(result.recommendations.length, 3);
assert.equal(new Set(result.recommendations.map((item) => item.topic)).size, 3, "同一批计划必须给出不同标题");
assert.ok(result.recommendations.every((item) => item.contentTaskBrief.platform === "xiaohongshu"));
assert.ok(result.recommendations.every((item) => item.sourcePlan.sources.length > 0));
assert.ok(result.recommendations.every((item) => item.sourcePlan.mechanismDecision?.contract === "ContentMechanismDecision@1.0"));
assert.ok(result.recommendations.every((item) => item.sourcePlan.mechanismDecision?.evaluated.length === 5));
assert.ok(result.recommendations.some((item) => item.sourcePlan.sources.some((source) => source.type === "knowledge_base")));

const first = result.recommendations[0];
const repeated = planNextContent({
  strategySnapshot,
  currentFacts,
  platform: "xiaohongshu",
  hotspots,
  knowledgeItems: [{ id: "kb_service" }],
  viralBlueprints: blueprints,
  history: [{
    id: "old_content_001",
    topic: first.topic,
    contentIdentity: first.contentIdentity
  }],
  limit: 3
});
assert.notEqual(repeated.recommendations.find((item) => item.topic === first.topic)?.duplication.decision, "allow");

const directed = planNextContent({
  strategySnapshot,
  currentFacts,
  platform: "wechat",
  hotspots,
  knowledgeItems: [{ id: "kb_service" }],
  viralBlueprints: blueprints,
  history: [],
  userRequest: {
    topic: "企业第一次做知识库，应该先整理多少资料",
    contentRole: "trust",
    preferredSourceMode: "knowledge",
    userInstruction: "不要写成产品广告"
  }
});
assert.equal(directed.recommendations.length, 1);
assert.equal(directed.recommendations[0].contentTaskBrief.generationMode, "user_directed");
assert.ok(directed.recommendations[0].sourcePlan.sources.some((source) => source.type === "knowledge_base"));

const reference = normalizeReferencePost({
  id: "reference_001",
  platform: "xiaohongshu",
  title: "参考内容",
  text: "只用于结构分析"
});
assert.equal(reference.usageBoundary, "structure_only");
assert.ok(blueprints[0].doNotCopy.includes("原文句子"));

const capturedSkillRequests = [];
const generationPayload = first.generationPayload;
await runContentPipeline({
  payload: generationPayload,
  selection: null,
  intentProfile: {
    profile_id: "intent_test_001",
    topic_id: null,
    platform: generationPayload.platform,
    purpose: {
      id: generationPayload.contentPurposeId,
      label: "测试目的",
      description: "验证内容规划上下文进入生成链路"
    },
    promotion: {
      mode: generationPayload.promotionMode,
      knowledge_enabled: false,
      knowledge_asset_ids: [],
      knowledge_snapshot_id: null,
      insertion_rule: "do_not_mention"
    },
    engagement_policy: { mode: "auto", optimize_for: ["save"] },
    source: { type: "content_agent", selected_at: new Date().toISOString() }
  },
  citations: [],
  account: null,
  knowledgeAssets: [],
  contentTaskBrief: generationPayload.contentTaskBrief,
  contentSourcePlan: generationPayload.contentSourcePlan,
  factSnapshot: generationPayload.factSnapshot
}, {
  generateText: async (request, fallback) => {
    capturedSkillRequests.push(request);
    return { mode: "self_test", data: fallback || {} };
  }
});
const masterRequest = capturedSkillRequests.find((request) => request.task === "build_content_master_v2");
assert.equal(masterRequest.input.content_task_brief.topic, first.topic);
assert.ok(masterRequest.input.supplied_evidence.some((item) => item.source_type === "strategy_fact"));

console.log(JSON.stringify({
  status: "content-agent-planning-self-test ok",
  recommendations: result.recommendations.map((item) => ({
    role: item.contentRole,
    pillar: item.contentPillar,
    sourceMode: item.sourcePlan.mode,
    duplication: item.duplication.decision
  })),
  factProjection: {
    usable: result.strategyContext.factSnapshot.usableFacts.length,
    forbidden: result.strategyContext.factSnapshot.forbiddenFacts.length
  },
  generationContextPassed: true
}, null, 2));

