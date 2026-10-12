import assert from "node:assert/strict";
import { gateTopics, runTopicPipeline } from "../../topic-engine.mjs";

const store = {
  contentDirections: [{ id: "direction_ai", name: "AI", keywords: ["AI智能体"], strategySnapshotId: "strategy_test_v1", directionSource: "strategy_managed" }],
  accounts: [{ id: "acc_xhs", name: "企业AI号", audience: "企业管理者", contentPillars: ["AI落地"], strategySnapshotId: "strategy_test_v1" }],
  opportunities: [
    { id: "opp_keyword", poolType: "keyword", directionId: "direction_ai", title: "企业智能体进入工作流", summary: "企业开始关注流程落地", score: 85, keywords: ["AI智能体"], sourceEvidence: [{ source: "小红书", label: "企业智能体落地", signal: "近30天高互动", url: "https://example.com/k", mode: "live" }] },
    { id: "opp_global", poolType: "global", directionId: null, title: "世界杯内容科技", summary: "赛事内容生产引发关注", score: 90, keywords: ["世界杯"], sourceEvidence: [{ source: "百度热搜", label: "世界杯内容科技", signal: "榜单第3位", url: "https://example.com/g", mode: "live" }] }
  ]
};

const generateText = async (request) => {
  if (request.task === "generate_keyword_topic_candidates") return { mode: "test", data: { status: "success", data: { topics: [{ topic_id: "KT001", topic_category: "keyword", status: "recommended", mother_title: "企业智能体落地前，先回答哪三个流程问题？", core_question: "企业应如何判断智能体是否适合进入业务流程？", core_angle: "决策清单", core_claim: "用流程问题建立落地判断框架", why_now: "相关平台讨论正在增加", reader_value: "获得一份可执行的判断清单", target_audience: ["企业管理者"], content_type: "checklist", evidence_boundary: "仅说明讨论信号，不推断行业普及率", cluster_ids: ["opp_keyword"], evidence_ids: ["opp_keyword_EV01"], scores: { topic_relevance: 92, evidence_strength: 78, content_value: 90, timeliness: 84, differentiation: 82, overall: 86 }, risks: [], additional_research: { needed: false, queries: [], facts_to_verify: [] } }] } } };
  if (request.task === "rank_and_gate_topic_candidates") return { mode: "test", data: { status: "success", data: { approved: [{ topic_id: "KT001", final_priority: 1, status: "recommended", editor_reason: "证据和读者价值清晰", required_changes: [], facts_to_verify: [] }], rejected: [] } } };
  return { mode: "test", data: { items: [{ topic_id: "KT001", mother_topic_invariants: { core_question: "企业应如何判断智能体是否适合进入业务流程？", fact_ids: ["opp_keyword_EV01"], forbidden_claims: [] }, xiaohongshu: { fit_score: 91, fit_reason: "适合清单图文", platform_topic: "企业上AI智能体前，先检查这3个流程信号", single_promise: "给出三个判断信号", reader_scenario: "老板准备采购AI工具", practical_value: "可保存自查", save_trigger: "三项清单", carousel_logic: ["cover", "problem", "checklist", "summary"], title_directions: [], evidence_focus: ["opp_keyword_EV01"], platform_risks: [] }, wechat_official_account: { fit_score: 88, fit_reason: "可形成决策论证", platform_topic: "企业智能体进入业务流程前，需要回答的三个问题", core_argument: "先定义流程再选择智能体", information_gain: "建立机制与边界", argument_chain: ["background", "mechanism", "boundary", "conclusion"], share_reason: "适合转给决策团队", title_directions: [], evidence_focus: ["opp_keyword_EV01"], platform_risks: [] } }] } };
};

const result = await runTopicPipeline({ directionId: "direction_ai", category: "keyword", topicCount: 1, keywordHotspotIds: ["opp_keyword"] }, store, { generateText });
assert.equal(result.run.status, "succeeded");
assert.equal(result.topics.length, 1);
assert.equal(result.topics[0].topicCategory, "keyword");
assert.equal(result.topics[0].strategySnapshotId, "strategy_test_v1");
assert.equal(result.topics[0].platformTopics.xiaohongshu.fit_score, 91);
assert.equal(result.topics[0].evidence[0].evidence_id, "opp_keyword_EV01");
assert.deepEqual(result.run.skillTraces.map((item) => item.skillName), ["generate-keyword-topics", "rank-and-gate-topics", "adapt-topic-to-platforms"]);

const reviewable = gateTopics([{ candidateId: "KT_REVIEW", category: "keyword", motherTitle: "待完善", coreQuestion: "问题", readerValue: "价值", clusterIds: ["a"], evidenceIds: ["e"], scores: { overall: 65, evidence_strength: 55 }, additionalResearch: { needed: false, queries: [], factsToVerify: [] } }]);
assert.equal(reviewable.approved[0].proposedStatus, "needs_research");

const gate = gateTopics([{ ...result.topics[0], candidateId: "FT_BAD", category: "cross_trend", motherTitle: "硬蹭", coreQuestion: "问题", readerValue: "价值", clusterIds: ["a", "b"], generalClusterIds: ["a"], keywordClusterIds: ["b"], evidenceIds: ["e"], realIntersection: "只有标题相关", scores: { overall: 90, evidence_strength: 90, forced_connection_risk: 80 }, additionalResearch: { needed: false, queries: [], factsToVerify: [] } }]);
assert.equal(gate.approved.length, 0);
assert.equal(gate.rejected[0].riskType, "forced_connection");

console.log(JSON.stringify({ status: "passed", topics: result.topics.length, platformFit: result.topics[0].platformTopics.xiaohongshu.fit_score, forcedConnectionRejected: true }));

