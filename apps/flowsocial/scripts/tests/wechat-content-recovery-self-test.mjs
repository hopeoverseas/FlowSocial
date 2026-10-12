import { readFrontendSource, readFrontendSourceSync } from "./helpers/frontend-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWechatArticleRecoveryPrompt, runContentPipeline, validateWechatArticleForProduction } from "../../content-engine.mjs";
import { recoverWechatContentTask, getWechatContentRecoveryEligibility } from "../../content-agent/wechat-content-recovery.mjs";
import { recordWechatContentRecovery } from "../../content-agent/workflow-engine.mjs";
import { validateContract } from "../../llm/contracts.mjs";
import { resolveLlmTaskBudget } from "../../llm/task-registry.mjs";

const intentProfile = {
  profile_id: "intent_wechat_recovery",
  topic_id: "topic_wechat_recovery",
  platform: "wechat",
  purpose: { id: "knowledge_howto", label: "知识方法", description: "提供可执行方法" },
  promotion: { mode: "none", knowledge_enabled: false, knowledge_asset_ids: [], knowledge_snapshot_id: null },
  engagement_policy: { mode: "auto", selected_primary_action: "share" }
};
const contentMaster = {
  topic_id: "topic_wechat_recovery",
  intent_profile_id: intentProfile.profile_id,
  central_thesis: "空正文必须停止下游并进行有限恢复",
  reader_value: "理解公众号正文恢复流程",
  confirmed_facts: [{ fact_id: "F1", fact: "空正文不能进入交付", source_ids: ["T1"] }],
  source_list: [{ source_id: "T1", source_type: "user_temporary_material", title: "固定测试事实", excerpt: "空正文不能进入交付" }],
  engagement_policy: { selected_primary_action: "share" },
  publish_time_checks: []
};
const confirmedOutline = {
  outline_id: "outline_wechat_recovery",
  content_promise: "公众号正文恢复流程",
  sections: [
    { section_id: "S1", heading: "确认失败信号", objective: "确认失败信号", key_points: ["空正文"] },
    { section_id: "S2", heading: "执行有限恢复", objective: "执行有限恢复", key_points: ["有限重试"] },
    { section_id: "S3", heading: "重新运行质量门", objective: "重新运行质量门", key_points: ["来源门禁"] }
  ]
};

const section = (heading, sentence) => `## ${heading}\n${sentence.repeat(32)}`;
const validArticle = {
  status: "success",
  data: {
    article_promise: "公众号正文恢复流程",
    core_argument: "空正文必须停止下游并进行有限恢复",
    information_gain: "区分 Provider 成功、正文合同和下游质量门，并给出有界恢复顺序",
    title_candidates: ["公众号正文恢复流程：三步关闭空输出", "空正文为什么不能继续生成交付包", "从超时到恢复：公众号内容链如何守门"],
    recommended_title: "公众号正文恢复流程：三步关闭空输出",
    abstract: "说明如何识别空正文、有限恢复并重新执行质量门。",
    opening: "公众号正文为空不是可用降级结果。",
    outline: confirmedOutline.sections.map((item) => ({ heading: item.heading })),
    article_markdown: [section("确认失败信号", "公众号正文恢复流程首先确认空正文和错误码，保留失败轨迹后停止下游。"), section("执行有限恢复", "公众号正文恢复流程只允许有限且可追踪的定向重试，不把空对象当作成功。"), section("重新运行质量门", "公众号正文恢复流程成功后重新执行正文审阅、标题、图片计划和来源门禁。")].join("\n\n"),
    pull_quotes: [],
    key_takeaways: ["空输出硬阻断", "恢复有上限", "下游完整重跑"],
    share_summary: "公众号正文恢复流程",
    share_reason: "供内容团队复核异常恢复",
    engagement_strategy: { primary_action: "share", reason: "适合团队同步" },
    cta: "转发给负责内容质量的同事",
    claim_map: [{ claim: "空正文不能进入交付", source_ids: ["T1"] }],
    used_knowledge_asset_ids: [],
    image_plan: { cover: { purpose: "恢复流程", strategy: "generated_raster", prompt: "editorial workflow, no text, no logo, no watermark" }, slots: [{ slot_purpose: "三步流程", strategy: "html_chart", prompt: "" }] }
  }
};

assert.equal(validateContract("WechatArticle@2.0", {}).valid, false);
assert.equal(validateContract("WechatArticle@2.0", { status: "needs_review", data: { article_markdown: "", outline: [], title_candidates: [], image_plan: {} } }).valid, false);
assert.equal(validateContract("WechatArticle@2.0", validArticle).valid, true);
assert.equal(validateWechatArticleForProduction({}).valid, false);
assert.equal(validateWechatArticleForProduction(validArticle).valid, true);
const recoveryBudget = resolveLlmTaskBudget("write_wechat_article_v2_recovery");
assert.deepEqual({ maxAttempts: recoveryBudget.maxAttempts, contextCharBudget: recoveryBudget.contextCharBudget, maxOutputTokens: recoveryBudget.maxOutputTokens, reasoningMode: recoveryBudget.reasoningMode, deepSeekModelOverride: recoveryBudget.deepSeekModelOverride }, { maxAttempts: 1, contextCharBudget: 24000, maxOutputTokens: 8192, reasoningMode: "disable_when_toggleable", deepSeekModelOverride: "deepseek-v4-flash" });
const compactRecoveryPrompt = buildWechatArticleRecoveryPrompt({
  topicTitle: "公众号正文恢复流程",
  intentProfile,
  master: contentMaster,
  confirmed_outline: confirmedOutline,
  outline_lock_rule: "不得更改已确认大纲",
  output_shape: { status: "success", data: { article_markdown: "", title_candidates: [], image_plan: {} } },
  hard_requirements: { article_markdown_min_chars: 1200 },
  content_execution_context: { irrelevant: "x".repeat(80000) },
  temporary_materials: [{ body: "y".repeat(80000) }],
  creative_blueprints: [{ body: "z".repeat(80000) }]
}, { attempt: 1, failedTraceId: "failed_writer_trace", previousBlockers: ["wechat_article_markdown_empty"] });
assert.ok(JSON.stringify(compactRecoveryPrompt).length < 24000);
assert.equal("content_execution_context" in compactRecoveryPrompt, false);
assert.equal("temporary_materials" in compactRecoveryPrompt, false);
assert.equal("creative_blueprints" in compactRecoveryPrompt, false);

function providerFailure(code, category, traceId, attemptFailures = []) {
  return { mode: "validated_fallback", data: {}, telemetry: { traceId, fallbackUsed: true, errorCode: code, errorCategory: category, attempts: attemptFailures.length || 1, attemptFailures } };
}

function downstreamResult(task) {
  if (task === "review_wechat_article_content") return { mode: "live", data: { status: "success", data: { decision: "pass", findings: [], patches: [] } } };
  if (task === "generate_final_platform_titles") return { mode: "live", data: { status: "success", data: { stage: "final_after_body", candidates: validArticle.data.title_candidates.map((title, index) => ({ title_id: `T${index + 1}`, title, claim_ids: ["F1"], risk: "low", scores: { overall: 4 } })), recommendations: { balanced: "T1", safe: "T2" }, ab_tests: [] } } };
  if (task === "plan_wechat_images") return { mode: "live", data: { status: "success", data: validArticle.data.image_plan } };
  return null;
}

async function pipelineWith(generateText, extraPayload = {}) {
  return runContentPipeline({
    payload: { platform: "wechat", ideaTitle: "公众号正文恢复流程", contentRunId: "content_run_offline_recovery", ...extraPayload },
    selection: null,
    intentProfile,
    account: { visualStyle: { name: "克制编辑风" } },
    knowledgeAssets: [],
    preparedContentMaster: { status: "ready", data: contentMaster },
    confirmedOutline,
    skillExecutionPlan: null
  }, { generateText });
}

const successfulTasks = [];
let firstWriter = true;
const recoveredPipeline = await pipelineWith(async (request) => {
  successfulTasks.push(request.task);
  if (request.task === "write_wechat_article_v2" && firstWriter) {
    firstWriter = false;
    return providerFailure("MODEL_TASK_TIMEOUT", "timeout", "llm_timeout_1", [{ errorCode: "MODEL_TASK_TIMEOUT", attempt: 1 }]);
  }
  if (request.task === "write_wechat_article_v2_recovery") return { mode: "live", data: validArticle, telemetry: { traceId: "llm_recovered_1", attempts: 1, fallbackUsed: false } };
  return downstreamResult(request.task);
});
assert.equal(recoveredPipeline.status, "succeeded");
assert.equal(recoveredPipeline.qualityReview.status, "passed");
assert.equal(recoveredPipeline.writerRecovery.status, "recovered");
assert.deepEqual(recoveredPipeline.writerRecovery.attempts.map((item) => item.outcome), ["failed", "recovered"]);
assert.equal(recoveredPipeline.skillTraces[0].errorCode, "MODEL_TASK_TIMEOUT");
for (const task of ["review_wechat_article_content", "generate_final_platform_titles", "plan_wechat_images"]) assert.ok(successfulTasks.includes(task), `${task} must rerun after body recovery`);
assert.equal(recoveredPipeline.qualityReview.checks.find((item) => item.check === "SourceReadinessGate")?.result, "pass");

const titleFallbackPipeline = await pipelineWith(async (request, fallback) => {
  if (request.task === "write_wechat_article_v2") return { mode: "live", data: validArticle, telemetry: { traceId: "llm_writer_ok", attempts: 1, fallbackUsed: false } };
  if (request.task === "generate_final_platform_titles") {
    return providerFailure("MODEL_HTTP_5XX", "provider_5xx", "llm_title_5xx", [{ errorCode: "MODEL_HTTP_5XX", attempt: 1 }]);
  }
  return downstreamResult(request.task) || { mode: "validated_fallback", data: fallback, telemetry: { traceId: "llm_fallback", attempts: 1, fallbackUsed: true } };
});
assert.equal(titleFallbackPipeline.status, "succeeded", "valid preliminary titles may remain usable after final-title provider failure");
assert.ok(titleFallbackPipeline.skillTraces.some((item) => item.errorCode === "MODEL_HTTP_5XX" && item.fallbackUsed === true), "final-title 5xx evidence must remain in the trace");
assert.ok(titleFallbackPipeline.executionRecords.some((item) => item.errorCode === "MODEL_HTTP_5XX" && item.providerFallbackUsed === true), "final-title 5xx evidence must remain in the execution ledger");

const recoveryOnlyTasks = [];
const recoveryOnlyPipeline = await pipelineWith(async (request) => {
  recoveryOnlyTasks.push(request.task);
  if (request.task === "write_wechat_article_v2_recovery") {
    assert.ok(JSON.stringify(request).length < 24000);
    return { mode: "live", data: validArticle, telemetry: { traceId: "llm_manual_recovery", attempts: 1, fallbackUsed: false } };
  }
  return downstreamResult(request.task);
}, { wechatBodyRecovery: true });
assert.equal(recoveryOnlyPipeline.status, "succeeded");
assert.equal(recoveryOnlyPipeline.writerRecovery.status, "recovered");
assert.equal(recoveryOnlyTasks.filter((taskName) => taskName.startsWith("write_wechat_article_v2")).length, 1, "manual recovery must issue exactly one compact writer request");
assert.equal(recoveryOnlyTasks[0], "write_wechat_article_v2_recovery");

for (const [code, category] of [["MODEL_CONNECTION_ERROR", "connection"], ["MODEL_INVALID_JSON", "invalid_json"], ["MODEL_CONTRACT_INVALID", "contract_validation"]]) {
  const tasks = [];
  const result = await pipelineWith(async (request) => {
    tasks.push(request.task);
    if (request.task === "write_wechat_article_v2") return providerFailure(code, category, `trace_${code.toLowerCase()}`);
    if (request.task === "write_wechat_article_v2_recovery") return { mode: "live", data: validArticle, telemetry: { traceId: `recovered_${code.toLowerCase()}`, attempts: 1, fallbackUsed: false } };
    return downstreamResult(request.task);
  });
  assert.equal(result.status, "succeeded", `${code} should support one bounded body recovery`);
  assert.equal(result.skillTraces[0].errorCode, code);
  assert.deepEqual(tasks.slice(0, 2), ["write_wechat_article_v2", "write_wechat_article_v2_recovery"]);
}

const blockedTasks = [];
const blockedPipeline = await pipelineWith(async (request) => {
  blockedTasks.push(request.task);
  if (request.task === "write_wechat_article_v2") return providerFailure("MODEL_TASK_TIMEOUT", "timeout", "llm_timeout_2", [{ errorCode: "MODEL_TASK_TIMEOUT", attempt: 1 }]);
  if (request.task === "write_wechat_article_v2_recovery") return providerFailure("MODEL_HTTP_5XX", "provider_5xx", "llm_5xx_1", [{ errorCode: "MODEL_HTTP_5XX", attempt: 1 }]);
  throw new Error(`downstream task must not run after empty writer: ${request.task}`);
});
assert.equal(blockedPipeline.status, "blocked");
assert.equal(blockedPipeline.writerRecovery.status, "exhausted");
assert.ok(blockedPipeline.qualityReview.blockers.includes("wechat_writer_recovery_exhausted"));
assert.ok(blockedPipeline.qualityReview.blockers.includes("wechat_article_markdown_empty"));
assert.deepEqual(blockedTasks, ["write_wechat_article_v2", "write_wechat_article_v2_recovery"]);
assert.deepEqual(blockedPipeline.skillTraces.map((item) => item.errorCode), ["MODEL_TASK_TIMEOUT", "MODEL_HTTP_5XX"]);
assert.ok(blockedPipeline.skillTraces.every((item) => item.productionEligibleOutput === false));
assert.ok(blockedPipeline.executionRecords.every((item) => item.productionEligibleOutput === false));

const task = {
  id: "content_offline_recovery",
  platform: "wechat",
  status: "blocked",
  version: 1,
  currentContent: blockedPipeline.contentPackage,
  contentMaster,
  contentIntentProfile: intentProfile,
  skillTraces: blockedPipeline.skillTraces,
  executionRecords: blockedPipeline.executionRecords,
  qualityReview: blockedPipeline.qualityReview,
  writerRecovery: blockedPipeline.writerRecovery,
  delivery: null
};
const originalBlockedContent = structuredClone(task.currentContent);
let approvedRecoveryBudget = null;
const manual = await recoverWechatContentTask({ task, actor: "offline_tester", now: (() => { const times = ["2026-08-04T01:00:00.000Z", "2026-08-04T01:01:00.000Z"]; return () => times.shift(); })(), runPipeline: async ({ providerCallApproval }) => { approvedRecoveryBudget = providerCallApproval; return recoveredPipeline; } });
assert.equal(manual.recovered, true);
assert.deepEqual(approvedRecoveryBudget, { maxPreflightCalls: 1, maxContentProviderCalls: 4, maxTotalProviderCalls: 5, automaticRetries: 0, contentProviderCallStages: ["body", "metadata", "review", "image_plan"] });
assert.equal(manual.liveWindow.writerProviderCalls, 2);
assert.equal(manual.liveWindow.contentProviderCalls, 4);
assert.equal(manual.liveWindow.totalProviderCalls, 4);
assert.equal(manual.liveWindow.maxProviderCalls, 5);
assert.deepEqual(manual.recoveryRecord.providerCallUsage, { preflightCalls: 0, writerProviderCalls: 2, writerProviderCallStages: ["body", "body"], contentProviderCalls: 4, contentProviderCallStages: ["body", "body", "review", "image_plan"], totalProviderCalls: 4, automaticRetries: 0 });
assert.equal(task.status, "succeeded");
assert.equal(task.version, 2);
assert.equal(task.wechatRecoveryHistory.length, 1);
assert.equal(task.wechatRecoveryHistory[0].outcome, "recovered");
assert.equal(task.wechatRecoveryHistory[0].contentRecoveryAttemptConsumed, false);
assert.deepEqual(task.wechatRecoveryHistory[0].triggerErrorCodes, ["MODEL_TASK_TIMEOUT", "MODEL_HTTP_5XX"]);
assert.equal(task.wechatRecoveryHistory[0].triggerTraceIds.length, 2);
assert.equal(manual.versionRecord.parentVersion, 1);
assert.notDeepEqual(task.currentContent, originalBlockedContent);
assert.equal(task.currentContent.article_markdown, validArticle.data.article_markdown);

const workflow = { id: "content_run_offline_recovery", state: "needs_review", version: 1, events: [] };
recordWechatContentRecovery(workflow, task, manual.recoveryRecord);
assert.equal(workflow.state, "content_ready");
assert.equal(workflow.events.at(-1).type, "wechat_content_recovery_completed");

const legacyAttemptsTask = { id: "content_legacy_attempts", platform: "wechat", currentContent: {}, wechatRecoveryHistory: [{ outcome: "blocked" }, { outcome: "blocked" }] };
assert.equal(getWechatContentRecoveryEligibility(legacyAttemptsTask).eligible, true, "failed legacy recovery policy must not consume the corrected compact-v2 budget");
const exhaustedTask = { id: "content_exhausted", platform: "wechat", currentContent: {}, wechatRecoveryHistory: [{ policyVersion: "compact-v2", contentRecoveryAttemptConsumed: true, outcome: "content_contract_blocked" }, { policyVersion: "compact-v2", contentRecoveryAttemptConsumed: true, outcome: "content_contract_blocked" }] };
assert.equal(getWechatContentRecoveryEligibility(exhaustedTask).blocker, "WECHAT_BODY_RECOVERY_ATTEMPTS_EXHAUSTED");
await assert.rejects(recoverWechatContentTask({ task: exhaustedTask, runPipeline: async () => recoveredPipeline }), (error) => error.code === "WECHAT_BODY_RECOVERY_ATTEMPTS_EXHAUSTED");

const unavailableTask = { id: "content_provider_503", platform: "wechat", status: "blocked", version: 1, currentContent: {}, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
let unavailablePipelineCalls = 0;
const unavailableTimes = ["2026-08-04T02:00:00.000Z", "2026-08-04T02:00:01.000Z"];
const unavailable = await recoverWechatContentTask({
  task: unavailableTask,
  now: () => unavailableTimes.shift(),
  providerRetryDelayMs: 300000,
  runProviderPreflight: async () => ({ mode: "validated_fallback", telemetry: { providerSucceeded: false, traceId: "llm_preflight_503", errorCode: "MODEL_HTTP_5XX", errorCategory: "provider_5xx", httpStatus: 503, configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", at: "2026-08-04T02:00:00.500Z", costStatus: "not_reported" } }),
  runPipeline: async () => { unavailablePipelineCalls += 1; return recoveredPipeline; }
});
assert.equal(unavailable.providerUnavailable, true);
assert.equal(unavailable.code, "PROVIDER_UNAVAILABLE_RETRY_LATER");
assert.equal(unavailable.nextRetryAt, "2026-08-04T02:05:01.000Z");
assert.equal(unavailablePipelineCalls, 0, "503 preflight must stop before body recovery");
assert.equal(unavailableTask.wechatRecoveryHistory?.length || 0, 0, "provider failure must not consume content recovery attempts");
assert.equal(unavailableTask.providerFailureHistory.length, 1);
assert.deepEqual({ traceId: unavailableTask.providerFailureHistory[0].traceId, httpStatus: unavailableTask.providerFailureHistory[0].httpStatus, configuredModel: unavailableTask.providerFailureHistory[0].configuredModel, requestedModel: unavailableTask.providerFailureHistory[0].requestedModel, effectiveModel: unavailableTask.providerFailureHistory[0].effectiveModel, costStatus: unavailableTask.providerFailureHistory[0].costStatus, automaticRetry: unavailableTask.providerFailureHistory[0].automaticRetry }, { traceId: "llm_preflight_503", httpStatus: 503, configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", costStatus: "not_reported", automaticRetry: false });
assert.deepEqual({ preflight: unavailable.liveWindow.preflightCalls, body: unavailable.liveWindow.contentProviderCalls }, { preflight: 1, body: 0 });
assert.equal(unavailable.liveWindow.maxProviderCalls, 5);
assert.equal(getWechatContentRecoveryEligibility(unavailableTask, { now: "2026-08-04T02:03:00.000Z" }).blocker, "PROVIDER_UNAVAILABLE_RETRY_LATER");
assert.equal(getWechatContentRecoveryEligibility(unavailableTask, { now: unavailable.nextRetryAt }).eligible, true, "retry must be manual and available only at nextRetryAt");

const bodyUnavailableTask = { id: "content_body_503", platform: "wechat", status: "blocked", version: 1, currentContent: {}, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const bodyUnavailableTimes = ["2026-08-04T02:06:00.000Z", "2026-08-04T02:06:01.000Z"];
const bodyUnavailable = await recoverWechatContentTask({
  task: bodyUnavailableTask,
  now: () => bodyUnavailableTimes.shift(),
  runProviderPreflight: async () => ({ mode: "live", telemetry: { providerSucceeded: true, traceId: "preflight_ready", configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash" } }),
  runPipeline: async () => ({ status: "blocked", contentPackage: {}, executionRecords: [], writerRecovery: { status: "exhausted" }, qualityReview: { status: "needs_review", decision: "block", blockers: ["wechat_writer_recovery_exhausted"] }, skillTraces: [{ status: "failed", providerTraceId: "llm_body_503", providerSucceeded: false, errorCode: "MODEL_HTTP_5XX", errorCategory: "provider_5xx", httpStatus: 503, configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", providerCallAt: "2026-08-04T02:06:00.500Z", costStatus: "not_reported" }] })
});
assert.equal(bodyUnavailable.providerUnavailable, true);
assert.equal(bodyUnavailableTask.providerFailureHistory[0].phase, "content_recovery");
assert.equal(bodyUnavailableTask.wechatRecoveryHistory?.length || 0, 0);
assert.deepEqual({ preflight: bodyUnavailable.liveWindow.preflightCalls, body: bodyUnavailable.liveWindow.contentProviderCalls }, { preflight: 1, body: 1 });

const overBudgetTask = { id: "content_over_budget", platform: "wechat", status: "blocked", version: 1, currentContent: {}, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const overBudgetRecords = [
  { capability: "write-wechat-article", invocationId: "body", stage: "body" },
  { capability: "write-wechat-article", invocationId: "metadata", stage: "metadata" },
  { capability: "review-wechat-article", invocationId: "review" },
  { capability: "plan-wechat-images", invocationId: "plan" },
  { capability: "plan-wechat-images", invocationId: "forbidden_retry" }
];
await assert.rejects(recoverWechatContentTask({
  task: overBudgetTask,
  runProviderPreflight: async () => ({ telemetry: { providerSucceeded: true } }),
  runPipeline: async ({ providerCallApproval }) => {
    assert.equal(providerCallApproval.maxContentProviderCalls, 4, "approval must be known before content invocation");
    return { status: "blocked", contentPackage: {}, executionRecords: overBudgetRecords, skillTraces: [], writerRecovery: { providerCalls: 2, providerCallStages: ["body", "metadata"] }, qualityReview: { status: "needs_review", blockers: ["fixture"] } };
  }
}), (error) => error.code === "WECHAT_RECOVERY_WINDOW_CALL_LIMIT_EXCEEDED");

const contractTask = { id: "content_contract_failure", platform: "wechat", status: "blocked", version: 1, currentContent: {}, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const invalidContractPipeline = {
  status: "blocked", contentPackage: {}, writerRecovery: { status: "exhausted" }, executionRecords: [],
  skillTraces: [{ status: "failed", providerTraceId: "llm_contract_invalid", providerSucceeded: false, errorCode: "MODEL_CONTRACT_INVALID", errorCategory: "contract_validation", configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", costStatus: "usage_reported" }],
  qualityReview: { status: "needs_review", decision: "block", blockers: ["wechat_article_markdown_empty"] }
};
for (let index = 0; index < 2; index += 1) {
  const baseMinute = 10 + index;
  const times = [`2026-08-04T02:${baseMinute}:00.000Z`, `2026-08-04T02:${baseMinute}:01.000Z`];
  const result = await recoverWechatContentTask({ task: contractTask, now: () => times.shift(), runProviderPreflight: async () => ({ mode: "live", telemetry: { providerSucceeded: true, traceId: `preflight_${index}`, configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash" } }), runPipeline: async () => invalidContractPipeline });
  assert.equal(result.providerUnavailable, false);
  assert.equal(result.recoveryRecord.contentRecoveryAttemptConsumed, true);
  assert.equal(result.recoveryRecord.contentRecoveryAttempt, index + 1);
  assert.deepEqual({ preflight: result.liveWindow.preflightCalls, body: result.liveWindow.contentProviderCalls }, { preflight: 1, body: 1 });
}
assert.equal(contractTask.providerFailureHistory?.length || 0, 0);
assert.equal(getWechatContentRecoveryEligibility(contractTask).blocker, "WECHAT_BODY_RECOVERY_ATTEMPTS_EXHAUSTED");
await assert.rejects(recoverWechatContentTask({ task: contractTask, runPipeline: async () => invalidContractPipeline }), (error) => error.code === "WECHAT_BODY_RECOVERY_ATTEMPTS_EXHAUSTED");

const serverSource = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../../api-client.js", import.meta.url), "utf8");
const appSource = readFrontendSourceSync();
assert.ok(serverSource.includes("recover-wechat-article"));
assert.ok(apiSource.includes("recoverWechatArticle"));
assert.ok(appSource.includes("重试公众号正文节点"));
assert.ok(appSource.includes("deliveryReady"), "blocked empty article must not offer delivery");
assert.ok(appSource.includes("providerRetryWaiting"), "UI must expose the manual nextRetryAt gate without background retry");
console.log("wechat-content-recovery-self-test passed");
