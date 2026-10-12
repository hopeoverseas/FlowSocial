import assert from "node:assert/strict";
import { reviseContentPackage, runContentPipeline } from "../../content-engine.mjs";

const intent = (platform) => ({
  profile_id: `intent_${platform}`, topic_id: "topic_1", platform,
  purpose: { id: "knowledge_howto", label: "知识干货分享", description: "提供方法、步骤、清单、工具或避坑建议" },
  promotion: { mode: "none", knowledge_enabled: false, knowledge_asset_ids: [], knowledge_snapshot_id: null, insertion_rule: "do_not_mention" },
  engagement_policy: { mode: "auto", optimize_for: ["save", "share"], selection_rule: "select_one_primary_action_naturally" }
});

const selection = (platform) => ({
  platform, topicId: "topic_1",
  platformTopic: { platform_topic: "企业如何避免 AI 检测误判" },
  evidence: [{ evidence_id: "T1", title: "行业讨论", summary: "多家机构开始讨论 AI 检测工具的误判风险", url: "https://example.com/evidence" }]
});

const master = (platform) => ({ status: "ready", data: {
  target_audience: "企业内容负责人", central_question: "如何识别并降低误判风险？", central_thesis: "AI 检测结果只能作为风险信号，不能替代人工判断", reader_value: "获得一套核查方法", content_emphasis: ["方法"],
  confirmed_facts: [{ fact_id: "F1", fact: "多家机构开始讨论 AI 检测工具的误判风险", source_ids: ["T1"] }],
  supported_interpretations: [], author_opinions: [], unknowns: [], examples: [], claims_to_avoid: ["绝对准确"], publish_time_checks: ["复核来源日期"], platform
} });

const xhsPackage = {
  data: {
    content_promise: "给出一套四步核查清单",
    engagement_strategy: { reason: "清单内容适合收藏" },
    post_copy: { title_candidates: ["AI检测别只看一个数字", "四步排查AI误判", "企业内容被误判怎么办"], recommended_title: "AI检测别只看一个数字", opening: "先别急着删稿。", body_sections: [{ heading: "第一步", content: "确认工具和阈值。" }], ending: "把结果当信号。", pinned_comment: "你遇到过吗？", hashtags: ["AI工具", "内容风控", "企业AI"], cta: "先收藏这份清单" },
    deck: { pages: Array.from({ length: 6 }, (_, index) => ({ page_id: `P${index + 1}`, page_role: index ? "step" : "cover", headline: index ? `核查步骤 ${index}` : "AI检测别只看一个数字", supporting_text: "可执行说明", text_layers: [], render_strategy: index === 2 ? "generated_raster" : "html_css", visual_direction: "克制的信息卡", fact_ids: index === 1 ? ["F1"] : [], interpretation_ids: [] })) },
    image_specs: [{ page_id: "P3", prompt: "editorial office scene, subject reviewing a report, documentary photography, balanced composition, soft daylight, neutral green palette, safe area at top, restrained brand style, no text, no logo, no watermark", prohibitions: ["no text", "no logo", "no watermark"] }],
    skipped_image_pages: ["P1", "P2", "P4", "P5", "P6"], traceability: {}
  }
};

const wechatPackage = {
  data: {
    article_promise: "解释误判机制并给出企业核查流程", core_argument: "检测分数不应成为单一决策依据", information_gain: "把工具局限、组织流程与责任边界放进同一套判断框架",
    title_candidates: ["AI检测率困境", "当AI检测工具误判内容", "企业该如何使用AI检测结果"], recommended_title: "当AI检测工具误判内容，企业该如何判断？", abstract: "一套可执行的核查框架。", opening: "检测结果看似精确，却不等于事实。",
    outline: [{ heading: "工具局限" }, { heading: "组织风险" }, { heading: "核查流程" }],
    article_markdown: `## 一、数字为什么不等于结论\n${"检测模型输出的是概率信号，企业仍需核查来源、上下文与工具差异。".repeat(12)}\n\n## 二、误判如何进入组织流程\n${"当团队把单一分数当成最终标准，沟通成本和错误处置会被放大。".repeat(12)}\n\n## 三、建立四步核查机制\n${"先记录工具与版本，再交叉验证，然后人工复核，最后保留决策记录。".repeat(12)}\n\n## 四、边界与行动\n${"把检测结果当作线索，而不是替代人的裁决。".repeat(10)}`,
    pull_quotes: ["分数是信号，不是裁决。"], key_takeaways: ["交叉验证", "人工复核"], share_summary: "企业AI内容治理清单", share_reason: "帮助团队建立流程", engagement_strategy: { reason: "适合团队转发" }, cta: "转给负责内容风控的同事", claim_map: [{ claim: "存在误判讨论", source_ids: ["T1"] }], used_knowledge_asset_ids: [],
    image_plan: { cover: { purpose: "传达审慎判断", strategy: "generated_raster", prompt: "editorial desk, report review, no text, no logo, no watermark" }, slots: [{ slot_purpose: "呈现核查流程", strategy: "html_chart" }] }
  }
};

async function run(platform, packageFixture) {
  const preliminaryTitles = platform === "wechat" ? packageFixture.data.title_candidates : packageFixture.data.post_copy.title_candidates;
  const result = await runContentPipeline({ payload: { platform, ideaTitle: "企业如何避免 AI 检测误判" }, selection: selection(platform), intentProfile: intent(platform), citations: [], account: { visualStyle: { name: "克制编辑风", description: "白底、深绿强调" } }, knowledgeAssets: [] }, { generateText: async (request) => {
    if (request.task === "build_content_master_v2") return { mode: "test", data: master(platform) };
    if (["write_xhs_content_v2", "write_wechat_article_v2"].includes(request.task)) return { mode: "test", data: packageFixture };
    if (request.task === "review_wechat_article_content") return { mode: "test", data: { status: "success", data: { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] } } };
    if (request.task === "generate_final_platform_titles") return { mode: "test", data: { status: "success", data: { stage: "final_after_body", candidates: preliminaryTitles.map((title, index) => ({ title_id: `T${index + 1}`, title, claim_ids: ["F1"], risk: "low", scores: { overall: 4 } })), recommendations: { balanced: "T1", safe: "T2" }, ab_tests: [] } } };
    if (request.task === "plan_wechat_images") return { mode: "test", data: { status: "success", data: packageFixture.data.image_plan } };
    throw new Error(`unexpected content-self-test task: ${request.task}`);
  } });
  assert.equal(result.status, "succeeded");
  assert.equal(result.qualityReview.status, "passed");
  return result;
}

const xhs = await run("xiaohongshu", xhsPackage);
assert.equal(xhs.contentPackage.deck.pages.length, 6);
assert.equal(xhs.contentPackage.image_specs.length, 1);

const wechat = await run("wechat", wechatPackage);
assert.ok(wechat.contentPackage.article_markdown.length >= 1200);
assert.equal(wechat.contentPackage.image_plan.slots.length, 1);

const revisedFixture = { status: "success", data: {
  content_task_id: "content_test", base_version: 1, user_instruction: "标题更克制", request_class: "copy", execution_mode: "local_patch",
  target_paths: ["/post_copy/recommended_title"], locked_paths: ["/source_list", "/traceability"],
  operations: [{ op: "replace", path: "/post_copy/recommended_title", value: "AI检测结果，企业该怎么审慎使用", reason: "降低夸张感" }],
  evidence_impact: "none", rerun_plan: [], quality_checks: [], version: { parent: 1, proposed: 2, change_summary: "标题更克制" }, clarifying_question: ""
} };
const revised = await reviseContentPackage({ task: { platform: "xiaohongshu", ideaTitle: "企业如何避免 AI 检测误判", contentIntentProfile: intent("xiaohongshu"), contentMaster: xhs.contentMaster, currentContent: xhs.contentPackage }, instruction: "标题更克制", routing: { requestClass: "copy", executionMode: "local_patch" } }, { generateText: async () => ({ mode: "test", data: revisedFixture }) });
assert.equal(revised.qualityReview.status, "passed");
assert.equal(revised.contentPackage.post_copy.recommended_title, "AI检测结果，企业该怎么审慎使用");

console.log("content-self-test: ok");

