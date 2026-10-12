import assert from "node:assert/strict";
import { runContentPipeline, validateWechatArticleForProduction } from "../../content-engine.mjs";
import { recoverWechatContentTask } from "../../content-agent/wechat-content-recovery.mjs";
import { validateContract, validateContractSchema } from "../../llm/contracts.mjs";
import { invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import { parseStructuredContentResult } from "../../llm/provider-adapters.mjs";

const identity = {
  configured: true,
  provider: "offline-fixture",
  model: "deepseek-chat",
  profileMode: "profiled",
  structuredRecovery: "enabled",
  taskBudgets: "enabled",
  longJsonGuards: "enabled",
  capabilities: { jsonObject: true, structuredOutput: "json_object", reasoningControl: "thinking_toggle", thinkingToggle: true }
};
const section = (heading, sentence) => `## ${heading}\n${sentence.repeat(34)}`;
const article = {
  article_promise: "解释单次恢复诊断链",
  core_argument: "解析、Schema 和生产质量必须独立判断",
  information_gain: "提供不保存原文的三阶段诊断和确定性包装兼容方法",
  title_candidates: ["公众号合同失败如何定位", "三层诊断关闭空正文误放行", "单次恢复怎样保留安全证据"],
  recommended_title: "公众号合同失败如何定位",
  abstract: "说明三阶段诊断。",
  opening: "合同失败不能靠猜测定位。",
  outline: [{ heading: "解析阶段" }, { heading: "Schema 阶段" }, { heading: "质量阶段" }],
  article_markdown: [
    section("解析阶段", "解析阶段只判断结构化响应能否形成完整对象，并记录形状与字符数。"),
    section("Schema 阶段", "Schema 阶段核对必需字段类型，不补造正文、标题、大纲或图片计划。"),
    section("质量阶段", "质量阶段沿用生产门槛，短正文和结构不足继续阻断所有下游。")
  ].join("\n\n"),
  pull_quotes: [], key_takeaways: [], share_summary: "三阶段诊断", share_reason: "用于离线复核",
  engagement_strategy: { primary_action: "share", reason: "团队同步" }, cta: "", claim_map: [], used_knowledge_asset_ids: [],
  image_plan: { cover: { purpose: "诊断流程", strategy: "html_chart", prompt: "" }, slots: [{ slot_purpose: "三阶段", strategy: "html_chart", prompt: "" }] }
};
const canonical = { status: "success", data: article };

function parsedAdapter(value) {
  return () => ({
    async invoke() {
      const parsed = parseStructuredContentResult(JSON.stringify(value));
      return { data: parsed.data, structuredParse: { mode: parsed.parseMode, ...parsed.diagnostics }, usage: null, responseId: "offline_response" };
    }
  });
}

async function gateway(value, traceId) {
  resetLlmRuntimeForTests();
  return invokeLlm({
    task: "write_wechat_article_v2_recovery",
    payload: { contract: "WechatArticle@2.0", fixtureId: traceId },
    fallback: {}, contract: "WechatArticle@2.0", maxAttempts: 1,
    adapterFactory: parsedAdapter(value), modelIdentity: identity, traceId
  });
}

for (const [name, value, wrapperPath] of [
  ["direct", article, "direct"],
  ["data", canonical, "partial_success_envelope"],
  ["extra_envelope", { result: { data: article } }, "result.data"]
]) {
  const result = await gateway(value, `fixture_${name}`);
  assert.equal(result.mode, "live", `${name} must be accepted without field synthesis`);
  assert.equal(result.telemetry.contractDiagnostics.wrapperPath, wrapperPath);
  assert.equal(result.telemetry.contractDiagnostics.stage, "accepted");
  assert.equal(result.telemetry.contractDiagnostics.responseCharacterCount, JSON.stringify(value).length);
  assert.equal(JSON.stringify(result.telemetry).includes(article.article_markdown.slice(0, 40)), false, "telemetry must not persist body content");
  assert.equal(validateWechatArticleForProduction(result.data).valid, true);
}

const camelArticle = {
  ...article,
  articleMarkdown: article.article_markdown,
  titleCandidates: article.title_candidates,
  informationGain: article.information_gain,
  imagePlan: article.image_plan
};
delete camelArticle.article_markdown;
delete camelArticle.title_candidates;
delete camelArticle.information_gain;
delete camelArticle.image_plan;
const camelResult = await gateway({ article: camelArticle }, "fixture_camel_article");
assert.equal(camelResult.mode, "live");
assert.equal(camelResult.data.data.article_markdown, article.article_markdown);

const chineseResult = await gateway({ 文章: {
  正文: article.article_markdown,
  标题候选: article.title_candidates,
  大纲: article.outline,
  信息增益: article.information_gain,
  配图计划: article.image_plan
} }, "fixture_chinese_article");
assert.equal(chineseResult.mode, "live");
assert.equal(chineseResult.data.data.article_markdown, article.article_markdown);

for (const [name, content, expectedMode, expectedCode] of [
  ["invalid_json", "not-json PRIVATE_BODY", "invalid_json", "MODEL_INVALID_JSON"],
  ["truncated", '{"status":"success","data":{"article_markdown":"PRIVATE_BODY"', "truncated_json", "MODEL_INVALID_JSON"]
]) {
  resetLlmRuntimeForTests();
  const result = await invokeLlm({
    task: "write_wechat_article_v2_recovery", payload: { contract: "WechatArticle@2.0" }, fallback: {}, contract: "WechatArticle@2.0", maxAttempts: 1,
    modelIdentity: identity, traceId: `fixture_${name}`,
    adapterFactory: () => ({ async invoke() { return parseStructuredContentResult(content); } })
  });
  assert.equal(result.mode, "validated_fallback");
  assert.equal(result.telemetry.errorCode, expectedCode);
  assert.equal(result.telemetry.contractDiagnostics.stage, "provider_parse");
  assert.equal(result.telemetry.contractDiagnostics.parseMode, expectedMode);
  assert.equal(result.telemetry.contractDiagnostics.responseCharacterCount, content.length);
  assert.equal(JSON.stringify(result.telemetry).includes("PRIVATE_BODY"), false);
}

const missingField = { status: "success", data: { ...article } };
delete missingField.data.image_plan;
const missingResult = await gateway(missingField, "fixture_missing_field");
assert.equal(missingResult.mode, "validated_fallback");
assert.equal(missingResult.telemetry.errorCategory, "contract_validation");
assert.equal(missingResult.telemetry.contractDiagnostics.stage, "contract_schema");
assert.ok(missingResult.telemetry.contractDiagnostics.validationFieldPaths.includes("data.image_plan"));

const shortArticle = { status: "success", data: { ...article, article_markdown: "## 一\n短文", outline: [{ heading: "一" }] } };
assert.equal(validateContractSchema("WechatArticle@2.0", shortArticle).valid, true, "short content is schema-valid");
assert.equal(validateContract("WechatArticle@2.0", shortArticle).valid, false, "existing full contract quality threshold remains enforced");
assert.equal(validateWechatArticleForProduction(shortArticle).valid, false);

const intentProfile = {
  profile_id: "intent_diagnostic", topic_id: "topic_diagnostic", platform: "wechat",
  purpose: { id: "knowledge_howto", label: "知识方法" }, promotion: { mode: "none", knowledge_enabled: false, knowledge_asset_ids: [] },
  engagement_policy: { selected_primary_action: "share" }
};
const contentMaster = {
  topic_id: "topic_diagnostic", intent_profile_id: "intent_diagnostic", central_thesis: "三阶段诊断", reader_value: "识别失败阶段",
  confirmed_facts: [], supported_interpretations: [], author_opinions: [], unknowns: [], examples: [], claims_to_avoid: [],
  source_list: [], engagement_policy: { selected_primary_action: "share" }, publish_time_checks: []
};
let offlineGenerateInvocations = 0;
const qualityBlocked = await runContentPipeline({
  payload: { platform: "wechat", ideaTitle: "三阶段诊断", contentRunId: "offline_run", wechatBodyRecovery: true },
  selection: null, intentProfile, account: {}, knowledgeAssets: [], preparedContentMaster: { status: "ready", data: contentMaster },
  confirmedOutline: { outline_id: "outline_diagnostic", sections: [{ heading: "一" }, { heading: "二" }, { heading: "三" }] }, skillExecutionPlan: null
}, {
  generateText: async (request) => {
    offlineGenerateInvocations += 1;
    assert.equal(request.task, "write_wechat_article_v2_recovery");
    return { mode: "live", data: shortArticle, telemetry: { traceId: "offline_quality_trace", providerSucceeded: true, attempts: 1, fallbackUsed: false, configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", at: "2026-08-04T00:00:00.000Z", costStatus: "not_reported", contractDiagnostics: { stage: "accepted", responseCharacterCount: JSON.stringify(shortArticle).length, parseMode: "direct", wrapperPath: "data", topLevelShape: { type: "object", keys: ["data", "status"], unknownKeyCount: 0 } } } };
  }
});
assert.equal(offlineGenerateInvocations, 1, "manual recovery remains one body invocation");
assert.equal(qualityBlocked.status, "blocked");
assert.equal(qualityBlocked.skillTraces[0].failureStage, "production_quality_gate");
assert.equal(qualityBlocked.skillTraces[0].errorCode, "WECHAT_ARTICLE_QUALITY_GATE_FAILED");
assert.ok(qualityBlocked.skillTraces[0].contractDiagnostics.validationFieldPaths.includes("data.article_markdown"));
assert.deepEqual({
  configuredModel: qualityBlocked.skillTraces[0].configuredModel,
  requestedModel: qualityBlocked.skillTraces[0].requestedModel,
  effectiveModel: qualityBlocked.skillTraces[0].effectiveModel,
  providerCallAt: qualityBlocked.skillTraces[0].providerCallAt,
  costStatus: qualityBlocked.skillTraces[0].costStatus
}, {
  configuredModel: "deepseek-chat",
  requestedModel: "deepseek-v4-flash",
  effectiveModel: "deepseek-v4-flash",
  providerCallAt: "2026-08-04T00:00:00.000Z",
  costStatus: "not_reported"
});

const persistedTask = { id: "offline_diagnostic_task", platform: "wechat", status: "blocked", version: 1, currentContent: {}, skillTraces: [], executionRecords: [], qualityReview: { status: "needs_review", blockers: [] } };
const recoveryTimes = ["2026-08-04T00:01:00.000Z", "2026-08-04T00:01:01.000Z"];
const persisted = await recoverWechatContentTask({ task: persistedTask, now: () => recoveryTimes.shift(), runPipeline: async () => qualityBlocked });
assert.equal(persisted.recovered, false);
assert.equal(persisted.recoveryRecord.contentRecoveryAttemptConsumed, true);
assert.equal(persisted.recoveryRecord.contractDiagnostics[0].failureStage, "production_quality_gate");
assert.equal(JSON.stringify(persistedTask).includes(shortArticle.data.article_markdown), false, "failed diagnostics must not persist candidate body content");

assert.equal(validateContract("WechatArticle@2.0", canonical).valid, true);
assert.equal(globalThis.__wechatDiagnosticNetworkCalls || 0, 0);
console.log(JSON.stringify({
  status: "wechat-article-contract-diagnostics-self-test passed",
  fixtures: 8,
  providerCalls: 0,
  networkCalls: 0,
  productionWrites: 0
}, null, 2));
