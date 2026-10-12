import assert from "node:assert/strict";
import { featureFlags } from "../../feature-flags.mjs";
import { adaptWechatTwoStageRecovery, buildPreparedSharedContentMaster, buildWechatBodyFirstRecoveryPrompts, createWechatRecoveryContentCallBudget, evaluateWechatFrozenH2Headings, runContentPipeline } from "../../content-engine.mjs";
import { recoverWechatContentTask } from "../../content-agent/wechat-content-recovery.mjs";
import { validateContract } from "../../llm/contracts.mjs";
import { resolveLlmTaskBudget } from "../../llm/task-registry.mjs";

const intentProfile = {
  profile_id: "intent_two_stage", topic_id: "topic_two_stage", platform: "wechat",
  purpose: { id: "knowledge_howto", label: "知识方法" }, promotion: { mode: "none" },
  engagement_policy: { selected_primary_action: "share" }
};
const master = {
  content_master_id: "master_two_stage",
  topic_id: "topic_two_stage", intent_profile_id: "intent_two_stage", central_thesis: "两阶段恢复必须保持冻结绑定",
  reader_value: "理解正文优先恢复", confirmed_facts: [{ fact_id: "F1", fact: "失败阶段不能进入下游", source_ids: ["T1"] }],
  source_list: [{ source_id: "T1", source_type: "user_temporary_material", excerpt: "失败阶段不能进入下游" }],
  engagement_policy: { selected_primary_action: "share" }, publish_time_checks: []
};
const outline = { outline_id: "outline_two_stage", sections: [
  { heading: "先冻结输入" }, { heading: "再生成正文" }, { heading: "最后合并元数据" }
] };
const context = { strategySnapshotId: "strategy_two_stage" };
const writerPrompt = { topicTitle: "正文优先恢复", intentProfile, master, confirmed_outline: outline, content_execution_context: context };
const prompts = buildWechatBodyFirstRecoveryPrompts(writerPrompt, { contentRunId: "run_two_stage" });
assert.equal(featureFlags().wechatBodyFirstRecoveryV1, false, "feature flag must default off");
assert.equal(prompts.valid, true);
assert.deepEqual(prompts.bodyPrompt.required_h2_headings, outline.sections.map(({ heading }) => heading));
assert.equal(prompts.bodyPrompt.markdown_h2_skeleton, "## 先冻结输入\n\n## 再生成正文\n\n## 最后合并元数据\n");
assert.match(prompts.bodyPrompt.instruction, /不得少写、多写、重复、重排或改写 H2/);
assert.deepEqual(prompts.bodyPrompt.hard_requirements.required_h2_headings, prompts.bodyPrompt.required_h2_headings);
assert.equal(buildWechatBodyFirstRecoveryPrompts({ ...writerPrompt, confirmed_outline: { ...outline, sections: [{ heading: "完整标题" }, { heading: "" }, {}] } }, { contentRunId: "run_two_stage" }).blocker, "wechat_frozen_outline_headings_incomplete");
assert.equal(buildWechatBodyFirstRecoveryPrompts({ ...writerPrompt, confirmed_outline: { ...outline, sections: [{ heading: "重复标题" }, { heading: "重复标题" }, { heading: "第三标题" }] } }, { contentRunId: "run_two_stage" }).blocker, "wechat_frozen_outline_headings_incomplete");
assert.equal(resolveLlmTaskBudget("write_wechat_article_body_recovery_v1").maxAttempts, 1);
assert.equal(resolveLlmTaskBudget("write_wechat_article_metadata_recovery_v1").maxAttempts, 1);

const section = (heading, text) => `## ${heading}\n${text.repeat(35)}`;
const markdown = [section("先冻结输入", "两阶段恢复首先冻结运行、策略、大纲和来源，任何绑定变化都必须停止。"), section("再生成正文", "正文阶段只生成连续文章并接受原有质量门检查，不能填充或静态扩写。"), section("最后合并元数据", "元数据阶段不能改写正文，确定性适配器只合并已验证字段后再跑全量门禁。")] .join("\n\n");
const body = { schemaVersion: "1.0", binding: prompts.binding, confirmed_outline_id: "outline_two_stage", article_markdown: markdown, claim_map: [{ claim: "失败阶段不能进入下游", source_ids: ["T1"] }], used_source_ids: ["T1"] };
assert.equal(evaluateWechatFrozenH2Headings(markdown, outline).valid, true);
const metadata = {
  schemaVersion: "1.0", binding: prompts.binding, article_promise: "正文优先恢复", core_argument: "两阶段保持冻结绑定",
  information_gain: "将正文长度预算与元数据输出预算拆开，同时保留不可绕过的生产质量门",
  title_candidates: ["公众号正文为什么要分两阶段恢复", "正文优先恢复如何守住合同", "从冻结绑定到确定性合并"], recommended_title: "公众号正文为什么要分两阶段恢复",
  abstract: "说明两阶段恢复的边界。", opening: "复杂合同会挤压正文预算。", outline: outline.sections.map(({ heading }) => ({ heading })),
  pull_quotes: [], key_takeaways: ["冻结绑定", "正文先过门", "元数据不改正文"], share_summary: "正文优先恢复", share_reason: "供内容团队复核",
  engagement_strategy: { primary_action: "share", reason: "团队协作" }, cta: "转发给内容质量负责人", used_knowledge_asset_ids: [],
  image_plan: { cover: { purpose: "两阶段流程", strategy: "generated_raster", prompt: "workflow, no text" }, slots: [{ slot_purpose: "合并门禁", strategy: "html_chart", prompt: "" }] }
};
const formalImagePlan = {
  plan_id: "formal_plan_two_stage",
  cover: { asset_id: "cover_two_stage", purpose: "mood", strategy: "generated_raster", prompt: "workflow, no text" },
  slots: [{ slot_id: "slot_two_stage", after_section_id: "W1", asset_id: "chart_two_stage", purpose: "explain", strategy: "html_chart", prompt: "" }]
};
assert.equal(validateContract("WechatArticleBodyRecovery@1.0", body).valid, true);
assert.equal(validateContract("WechatArticleBodyRecovery@1.0", { ...body, article_markdown: markdown.slice(0, 1199) }).valid, false);
assert.equal(validateContract("WechatArticleMetadataRecovery@1.0", metadata).valid, true);
assert.equal(validateContract("WechatArticleMetadataRecovery@1.0", { ...metadata, article_markdown: "tamper" }).valid, false);
const adapted = adaptWechatTwoStageRecovery({ body, metadata, expectedBinding: prompts.binding, confirmedOutline: outline, allowedSourceIds: ["T1"] });
assert.equal(adapted.valid, true);
assert.equal(adapted.value.data.article_markdown, body.article_markdown);
assert.equal(adaptWechatTwoStageRecovery({ body, metadata: { ...metadata, binding: { ...prompts.binding, contentRunId: "other_run" } }, expectedBinding: prompts.binding, confirmedOutline: outline, allowedSourceIds: ["T1"] }).valid, false);
assert.equal(adaptWechatTwoStageRecovery({ body: { ...body, used_source_ids: ["UNAPPROVED"] }, metadata, expectedBinding: prompts.binding, confirmedOutline: outline, allowedSourceIds: ["T1"] }).valid, false);

function downstream(task) {
  if (task === "review_wechat_article_content") return { mode: "live", data: { status: "success", data: { decision: "pass", findings: [], patches: [] } } };
  if (task === "generate_final_platform_titles") return {
    mode: "live",
    data: {
      status: "success",
      data: { stage: "final_after_body", candidates: metadata.title_candidates.map((title, index) => ({ title_id: `T${index + 1}`, title, claim_ids: ["F1"], risk: "low", scores: { overall: 4 } })), recommendations: { balanced: "T1", safe: "T2" }, ab_tests: [] }
    }
  };
  if (task === "plan_wechat_images") return { mode: "live", data: { status: "success", data: formalImagePlan }, telemetry: { attempts: 1, providerSucceeded: true } };
  return null;
}
async function pipeline(generateText, { confirmedOutline = outline } = {}) {
  return runContentPipeline({
    payload: { platform: "wechat", ideaTitle: "正文优先恢复", contentRunId: "run_two_stage", wechatBodyRecovery: true, wechatStrictSkillChain: true, contentExecutionContext: { ...context, directionCard: { matrixRole: "authority", contentFunction: "trust", creativeMechanism: "framework", journeyStage: "trust" } } },
    selection: null, intentProfile, account: { visualStyle: { name: "编辑风" }, effectiveStrategy: { voice: "editorial" }, accountContext: { subjectType: "company" }, platformInfrastructure: { columns: [] } }, preparedContentMaster: buildPreparedSharedContentMaster(master), confirmedOutline
  }, { generateText });
}

process.env.WECHAT_BODY_FIRST_RECOVERY_V1 = "1";
let incompleteOutlineProviderCalls = 0;
const incompleteOutlinePipeline = await pipeline(async () => { incompleteOutlineProviderCalls += 1; }, { confirmedOutline: { ...outline, sections: [{ heading: "只有一节" }] } });
assert.equal(incompleteOutlinePipeline.status, "blocked");
assert.equal(incompleteOutlineProviderCalls, 0, "incomplete frozen outline must block before provider invocation");
assert.equal(incompleteOutlinePipeline.writerRecovery.providerCalls, 0);
assert.deepEqual(incompleteOutlinePipeline.writerRecovery.providerCallStages, []);

const calls = [];
const success = await pipeline(async (request) => {
  calls.push(request.task);
  if (request.task === "write_wechat_article_body_recovery_v1") return { mode: "live", data: body, telemetry: { traceId: "body_trace", attempts: 1, providerSucceeded: true } };
  if (request.task === "write_wechat_article_metadata_recovery_v1") return { mode: "live", data: metadata, telemetry: { traceId: "metadata_trace", attempts: 1, providerSucceeded: true } };
  return downstream(request.task);
});
assert.equal(success.status, "succeeded");
assert.equal(success.writerRecovery.policy, "wechat_body_first_recovery_v1");
assert.equal(success.writerRecovery.automaticRetry, false);
assert.deepEqual(calls, ["write_wechat_article_body_recovery_v1", "write_wechat_article_metadata_recovery_v1", "review_wechat_article_content", "plan_wechat_images"], "two-stage recovery must invoke independent review and image planning");
assert.equal(success.writerRecovery.attempts.length, 2);
assert.equal(success.writerRecovery.providerCalls, 2);
assert.deepEqual(success.writerRecovery.providerCallStages, ["body", "metadata"]);
assert.deepEqual(success.skippedProviderStages, []);
assert.equal(success.skillTraces.length, 4, "body, metadata, review and plan must each record a completed trace");
assert.equal(success.wechatSkillChain.maxProviderCalls, 4);
assert.equal(success.wechatSkillChain.automaticRetries, 0);

const h2MismatchMatrix = [
  { name: "missing", markdown: [section("先冻结输入", "两阶段恢复首先冻结运行、策略、大纲和来源，任何绑定变化都必须停止。"), section("再生成正文", "正文阶段只生成连续文章并接受原有质量门检查，不能填充或静态扩写。")].join("\n\n") },
  { name: "extra", markdown: `${markdown}\n\n${section("额外标题", "这个额外段落用于验证标题数量不能超过冻结大纲。")}` },
  { name: "reordered", markdown: [section("再生成正文", "正文阶段只生成连续文章并接受原有质量门检查，不能填充或静态扩写。"), section("先冻结输入", "两阶段恢复首先冻结运行、策略、大纲和来源，任何绑定变化都必须停止。"), section("最后合并元数据", "元数据阶段不能改写正文，确定性适配器只合并已验证字段后再跑全量门禁。")].join("\n\n") },
  { name: "rewritten", markdown: markdown.replace("## 再生成正文", "## 然后生成正文") },
  { name: "duplicate", markdown: markdown.replace("## 最后合并元数据", "## 再生成正文") }
];
let firstMismatchPipeline = null;
for (const scenario of h2MismatchMatrix) {
  const gate = evaluateWechatFrozenH2Headings(scenario.markdown, outline);
  assert.equal(gate.valid, false, `${scenario.name} H2 must fail exact comparison`);
  assert.equal("articleMarkdown" in gate, false);
  const scenarioCalls = [];
  const scenarioPipeline = await pipeline(async (request) => {
    scenarioCalls.push(request.task);
    if (request.task === "write_wechat_article_body_recovery_v1") return { mode: "live", data: { ...body, article_markdown: scenario.markdown }, telemetry: { traceId: `h2_${scenario.name}`, attempts: 1, providerSucceeded: true } };
    throw new Error(`metadata must not run for ${scenario.name} H2`);
  });
  assert.equal(scenarioPipeline.status, "blocked");
  assert.deepEqual(scenarioCalls, ["write_wechat_article_body_recovery_v1"]);
  assert.equal(scenarioPipeline.writerRecovery.providerCalls, 1);
  assert.deepEqual(scenarioPipeline.writerRecovery.providerCallStages, ["body"]);
  assert.equal(scenarioPipeline.writerRecovery.attempts[0].validationBlockers.includes("wechat_body_h2_headings_mismatch"), true);
  const diagnostics = scenarioPipeline.skillTraces[0].validationMetrics.h2HeadingComparison;
  assert.equal(diagnostics.expected.length, 3);
  assert.equal(diagnostics.expected.every((item) => /^[a-f0-9]{64}$/.test(item.sha256) && Number.isInteger(item.characters)), true);
  assert.equal(JSON.stringify(diagnostics).includes(scenario.markdown), false, "diagnostics must not retain complete body");
  assert.equal(JSON.stringify(diagnostics).includes("先冻结输入"), false, "diagnostics must redact heading text");
  firstMismatchPipeline ||= scenarioPipeline;
}

const h2MismatchTask = { id: "task_h2_mismatch", platform: "wechat", status: "blocked", version: 1, currentContent: { sentinel: "historical" }, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const h2MismatchRecovery = await recoverWechatContentTask({ task: h2MismatchTask, runPipeline: async () => firstMismatchPipeline });
assert.equal(h2MismatchRecovery.recovered, false);
assert.equal(h2MismatchRecovery.liveWindow.contentProviderCalls, 1);
assert.deepEqual(h2MismatchRecovery.liveWindow.contentProviderCallStages, ["body"]);
assert.deepEqual(h2MismatchTask.currentContent, { sentinel: "historical" }, "H2 mismatch must not persist a successful output");
assert.equal(h2MismatchTask.version, 1);

const hardBudget = createWechatRecoveryContentCallBudget(2);
let budgetedInvocations = 0;
await hardBudget.run("body", async () => { budgetedInvocations += 1; });
await hardBudget.run("metadata", async () => { budgetedInvocations += 1; });
await assert.rejects(hardBudget.run("forbidden_fourth_total_call", async () => { budgetedInvocations += 1; }), (error) => error.code === "WECHAT_RECOVERY_WINDOW_CALL_LIMIT_EXCEEDED");
assert.equal(budgetedInvocations, 2, "over-budget probe must stop before provider invocation");

const stoppedCalls = [];
const stopped = await pipeline(async (request) => {
  stoppedCalls.push(request.task);
  if (request.task === "write_wechat_article_body_recovery_v1") return { mode: "live", data: { ...body, article_markdown: "## 一\n短文" }, telemetry: { traceId: "short_body", attempts: 1, providerSucceeded: true } };
  throw new Error(`must stop before ${request.task}`);
});
assert.equal(stopped.status, "blocked");
assert.deepEqual(stoppedCalls, ["write_wechat_article_body_recovery_v1"]);
assert.equal(stopped.contentPackage.article_markdown, "## 一\n短文");
assert.equal(stopped.writerRecovery.automaticRetry, false);
assert.equal(stopped.writerRecovery.providerCalls, 1);
const bodyFailureTask = { id: "task_body_failure", platform: "wechat", status: "blocked", version: 1, currentContent: { sentinel: "historical" }, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const bodyFailureTimes = ["2026-08-04T07:50:00.000Z", "2026-08-04T07:50:01.000Z"];
const bodyFailureRecovery = await recoverWechatContentTask({
  task: bodyFailureTask,
  now: () => bodyFailureTimes.shift(),
  runProviderPreflight: async () => ({ telemetry: { providerSucceeded: true, traceId: "preflight_body_failure" } }),
  runPipeline: async () => stopped
});
assert.equal(bodyFailureRecovery.recovered, false);
assert.deepEqual({ preflight: bodyFailureRecovery.liveWindow.preflightCalls, content: bodyFailureRecovery.liveWindow.contentProviderCalls, total: bodyFailureRecovery.liveWindow.totalProviderCalls }, { preflight: 1, content: 1, total: 2 });
assert.deepEqual(bodyFailureTask.currentContent, { sentinel: "historical" });
assert.equal(bodyFailureTask.version, 1);

const tamperedCalls = [];
const tamperedPipeline = await pipeline(async (request) => {
  tamperedCalls.push(request.task);
  if (request.task === "write_wechat_article_body_recovery_v1") return { mode: "live", data: body, telemetry: { traceId: "body_before_tamper", attempts: 1, providerSucceeded: true } };
  if (request.task === "write_wechat_article_metadata_recovery_v1") return { mode: "live", data: { ...metadata, binding: { ...metadata.binding, strategySnapshotId: "other_strategy" } }, telemetry: { traceId: "tampered_metadata", attempts: 1, providerSucceeded: true } };
  throw new Error(`downstream must not run after metadata binding failure: ${request.task}`);
});
assert.equal(tamperedPipeline.status, "blocked");
assert.deepEqual(tamperedCalls, ["write_wechat_article_body_recovery_v1", "write_wechat_article_metadata_recovery_v1"]);
assert.equal(tamperedPipeline.contentPackage.article_markdown, "", "validated body must not escape when metadata fails");
const persistedTask = { id: "task_two_stage", platform: "wechat", status: "blocked", version: 1, currentContent: { sentinel: "historical" }, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const recovery = await recoverWechatContentTask({ task: persistedTask, runPipeline: async () => tamperedPipeline });
assert.equal(recovery.recovered, false);
assert.equal(recovery.liveWindow.contentProviderCalls, 2);
assert.equal(recovery.liveWindow.totalProviderCalls, 2);
assert.deepEqual(persistedTask.currentContent, { sentinel: "historical" }, "failed two-stage output must not replace persisted content");
assert.equal(persistedTask.version, 1);

const successfulTask = { id: "task_two_stage_success", platform: "wechat", status: "blocked", version: 1, currentContent: { sentinel: "historical" }, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const successfulTimes = ["2026-08-04T08:00:00.000Z", "2026-08-04T08:00:01.000Z"];
const persistedSuccess = await recoverWechatContentTask({
  task: successfulTask,
  now: () => successfulTimes.shift(),
  runProviderPreflight: async () => ({ telemetry: { providerSucceeded: true, traceId: "preflight_two_stage" } }),
  runPipeline: async () => success
});
assert.equal(persistedSuccess.recovered, true);
assert.equal(successfulTask.version, 2);
assert.equal(successfulTask.currentContent.article_markdown, markdown);
assert.deepEqual({ preflight: persistedSuccess.liveWindow.preflightCalls, writer: persistedSuccess.liveWindow.writerProviderCalls, content: persistedSuccess.liveWindow.contentProviderCalls, total: persistedSuccess.liveWindow.totalProviderCalls }, { preflight: 1, writer: 2, content: 4, total: 5 });
assert.deepEqual(persistedSuccess.liveWindow.writerProviderCallStages, ["body", "metadata"]);
assert.deepEqual(persistedSuccess.liveWindow.contentProviderCallStages, ["body", "metadata", "review", "image_plan"]);
assert.deepEqual(persistedSuccess.recoveryRecord.providerCallUsage, { preflightCalls: 1, writerProviderCalls: 2, writerProviderCallStages: ["body", "metadata"], contentProviderCalls: 4, contentProviderCallStages: ["body", "metadata", "review", "image_plan"], totalProviderCalls: 5, automaticRetries: 0 });
delete process.env.WECHAT_BODY_FIRST_RECOVERY_V1;

console.log("wechat-body-first-recovery-self-test passed");
