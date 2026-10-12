import assert from "node:assert/strict";
import { compactLlmPayload } from "../../llm/context-budget.mjs";
import { invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import { DeepSeekAdapter, OpenAICompatibleAdapter, AnthropicAdapter, readProviderResponseText } from "../../llm/provider-adapters.mjs";
import { resolveLlmTaskBudget } from "../../llm/task-registry.mjs";

const identity = {
  configured: true,
  provider: "offline-provider",
  model: "offline-model",
  baseUrl: "https://model.invalid",
  profileMode: "profiled",
  structuredRecovery: "enabled",
  taskBudgets: "enabled",
  longJsonGuards: "enabled"
};

const diagnosticBudget = resolveLlmTaskBudget("analyze_diagnostic_turn");
const strategyBudget = resolveLlmTaskBudget("synthesize_account_strategy");
const outlineBudget = resolveLlmTaskBudget("generate_confirmable_content_outline");
const contentMasterBudget = resolveLlmTaskBudget("build_content_master_v2");
const bodyBudget = resolveLlmTaskBudget("write_wechat_article_v2");
assert.equal(new Set([diagnosticBudget.name, strategyBudget.name, outlineBudget.name, contentMasterBudget.name, bodyBudget.name]).size, 5);
for (const budget of [diagnosticBudget, strategyBudget, outlineBudget, contentMasterBudget, bodyBudget]) {
  assert.ok(budget.connectionTimeoutMs > 0);
  assert.ok(budget.firstTokenTimeoutMs > 0);
  assert.ok(budget.totalTimeoutMs > budget.connectionTimeoutMs);
  assert.ok(budget.maxOutputTokens > 0);
  assert.ok(budget.maxAttempts > 0);
}
assert.deepEqual({
  name: contentMasterBudget.name,
  maxAttempts: contentMasterBudget.maxAttempts,
  totalTimeoutMs: contentMasterBudget.totalTimeoutMs,
  model: contentMasterBudget.deepSeekModelOverride,
  reasoningMode: contentMasterBudget.reasoningMode
}, {
  name: "content_master",
  maxAttempts: 2,
  totalTimeoutMs: 150000,
  model: "deepseek-v4-flash",
  reasoningMode: "disable_when_toggleable"
});
assert.deepEqual(resolveLlmTaskBudget("generate_confirmable_content_outline"), outlineBudget, "outline budget must remain unchanged");
assert.deepEqual(resolveLlmTaskBudget("write_wechat_article_v2"), bodyBudget, "content body budget must remain unchanged");

const longPayload = {
  contract: "ConsultativeReply@2.0",
  product: { name: "Required Product", delivery: "consulting" },
  business: { name: "Required Co", offers: ["required-offer"], audience: "required-audience" },
  accountStrategy: { positioning: "required-positioning", contentPillars: ["required-pillar"] },
  platformRoles: { xiaohongshu: "lead-generation", wechat: "trust-building" },
  conversionPath: "content-to-consultation",
  riskPolicy: { prohibitedClaims: ["guaranteed outcome"] },
  accountDecision: { mode: "single_account", socialAccountId: "social_required" },
  claims: Array.from({ length: 200 }, (_, index) => ({ id: index % 5, text: `duplicate-${index % 5}` })),
  coverage: Array.from({ length: 100 }, () => ({ repeated: "x".repeat(500) }))
};
const compactedA = compactLlmPayload(longPayload, 5000);
const compactedB = compactLlmPayload(longPayload, 5000);
assert.deepEqual(compactedA, compactedB, "long-context trimming must be deterministic");
assert.ok(compactedA.outputChars <= 5000);
assert.equal(compactedA.payload.business.offers[0], "required-offer");
assert.equal(compactedA.payload.product.name, "Required Product");
assert.equal(compactedA.payload.accountStrategy.positioning, "required-positioning");
assert.equal(compactedA.payload.platformRoles.wechat, "trust-building");
assert.equal(compactedA.payload.conversionPath, "content-to-consultation");
assert.equal(compactedA.payload.riskPolicy.prohibitedClaims[0], "guaranteed outcome");
assert.equal(compactedA.payload.accountDecision.socialAccountId, "social_required");
assert.ok(compactedA.payload.claims.length < longPayload.claims.length, "duplicates and excess claims must be removed");

const capturedPayloads = [];
resetLlmRuntimeForTests();
const repaired = await invokeLlm({
  task: "model_gateway_live_test",
  payload: { ...longPayload, privatePrompt: "full-private-prompt-must-not-be-repeated" },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  maxAttempts: 2,
  modelIdentity: identity,
  retryDelay: async () => {},
  taskBudgetOverride: { contextCharBudget: 5000, repairContextCharBudget: 1800, totalTimeoutMs: 1000 },
  adapterFactory: () => ({
    async invoke({ payload }) {
      capturedPayloads.push(payload);
      return capturedPayloads.length === 1
        ? { data: { wrongField: "candidate-value", hugeCandidate: "z".repeat(5000) } }
        : { data: { assistantMessage: "repaired" } };
    }
  })
});
assert.equal(repaired.mode, "live");
assert.equal(repaired.telemetry.repairInputUsed, true);
assert.equal(capturedPayloads.length, 2);
assert.ok(capturedPayloads[1].repair.errorPaths.includes("assistantMessage"));
assert.ok(capturedPayloads[1].repair.candidateSummary.wrongField);
assert.equal("privatePrompt" in capturedPayloads[1], false);
assert.ok(JSON.stringify(capturedPayloads[1]).length <= 1800);

resetLlmRuntimeForTests();
let timeoutCalls = 0;
const timeoutStarted = Date.now();
const timedOut = await invokeLlm({
  task: "model_gateway_live_test",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "timeout fallback" },
  contract: "ConsultativeReply@2.0",
  maxAttempts: 3,
  modelIdentity: identity,
  taskBudgetOverride: { totalTimeoutMs: 20 },
  retryDelay: async () => {},
  adapterFactory: () => ({
    async invoke() {
      timeoutCalls += 1;
      return new Promise(() => {});
    }
  })
});
assert.equal(timedOut.mode, "validated_fallback");
assert.equal(timedOut.telemetry.terminalFailureClass, "timeout");
assert.equal(timedOut.telemetry.errorCategory, "timeout");
assert.equal(timeoutCalls, 1);
assert.ok(Date.now() - timeoutStarted < 250, "task deadline must be a hard cap");

resetLlmRuntimeForTests();
let recoveryProviderCalls = 0;
const boundedRecoveryFailure = await invokeLlm({
  task: "write_wechat_article_v2_recovery",
  payload: { contract: "WechatArticle@2.0" },
  fallback: {},
  contract: "WechatArticle@2.0",
  maxAttempts: 2,
  modelIdentity: identity,
  retryDelay: async () => {},
  adapterFactory: () => ({
    async invoke() {
      recoveryProviderCalls += 1;
      throw Object.assign(new Error("offline 503"), { status: 503 });
    }
  })
});
assert.equal(boundedRecoveryFailure.mode, "validated_fallback");
assert.equal(recoveryProviderCalls, 1, "caller retry settings must not exceed the recovery task budget");
assert.equal(boundedRecoveryFailure.telemetry.attempts, 1);

function delayedJsonResponse(delayMs) {
  return new Response(new ReadableStream({
    start(controller) {
      setTimeout(() => {
        controller.enqueue(new TextEncoder().encode("{\"ok\":true}"));
        controller.close();
      }, delayMs);
    }
  }));
}

const nonStreamingText = await readProviderResponseText(delayedJsonResponse(25), new AbortController(), {
  responseMode: "non_streaming_json",
  longJsonGuards: "enabled",
  firstTokenTimeoutMs: 5
});
assert.equal(nonStreamingText, "{\"ok\":true}", "non-streaming JSON must use the task total deadline rather than the short first-token deadline");
await assert.rejects(
  readProviderResponseText(delayedJsonResponse(25), new AbortController(), {
    responseMode: "non_streaming_json",
    longJsonGuards: "disabled",
    firstTokenTimeoutMs: 5
  }),
  (error) => error.code === "MODEL_FIRST_TOKEN_TIMEOUT",
  "the single rollback switch must restore the LLM-04 first-token behavior"
);

const config = {
  FLOW_MODEL_BASE_URL: "https://model.invalid",
  FLOW_MODEL_API_KEY: "offline-key",
  FLOW_MODEL_NAME: "offline-model",
  FLOW_MODEL_REASONING_CAPABILITY: "unsupported"
};
const adapterCases = [
  [new OpenAICompatibleAdapter(config, "OpenAI-compatible", async (url, options, policy) => {
    assert.equal(policy.totalTimeoutMs, 321);
    assert.equal(JSON.parse(options.body).max_tokens, 123);
    return { choices: [{ message: { content: "{\"assistantMessage\":\"openai\"}" } }] };
  }), "openai"],
  [new DeepSeekAdapter(config, async (url, options, policy) => {
    assert.equal(policy.firstTokenTimeoutMs, 45);
    assert.equal(JSON.parse(options.body).max_tokens, 123);
    return { choices: [{ message: { content: "{\"assistantMessage\":\"deepseek\"}" } }] };
  }), "deepseek"],
  [new AnthropicAdapter({ ...config, FLOW_MODEL_PROTOCOL: "anthropic" }, async (url, options, policy) => {
    assert.equal(policy.connectionTimeoutMs, 12);
    assert.equal(JSON.parse(options.body).max_tokens, 123);
    return { content: [{ type: "text", text: "{\"assistantMessage\":\"anthropic\"}" }] };
  }), "anthropic"]
];
for (const [adapter, expected] of adapterCases) {
  const response = await adapter.invoke({
    payload: { contract: "ConsultativeReply@2.0" },
    contract: "ConsultativeReply@2.0",
    taskBudget: { connectionTimeoutMs: 12, firstTokenTimeoutMs: 45, totalTimeoutMs: 321, maxOutputTokens: 123 }
  });
  assert.equal(response.data.assistantMessage, expected);
}

let deepSeekRequestBody;
const deepSeekConfig = { ...config, FLOW_MODEL_PROVIDER: "DeepSeek", FLOW_MODEL_NAME: "deepseek-chat", FLOW_MODEL_REASONING_CAPABILITY: "auto" };
const deepSeekBudgetAdapter = new DeepSeekAdapter(deepSeekConfig, async (url, options) => {
  deepSeekRequestBody = JSON.parse(options.body);
  return { choices: [{ message: { content: "{\"assistantMessage\":\"bounded strategy\"}" } }] };
});
resetLlmRuntimeForTests();
const boundedStrategy = await invokeLlm({
  task: "synthesize_account_strategy",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  modelIdentity: { ...identity, provider: "DeepSeek", model: "deepseek-chat", capabilities: deepSeekBudgetAdapter.getCapabilities() },
  adapterFactory: () => deepSeekBudgetAdapter
});
assert.equal(boundedStrategy.mode, "live");
assert.equal(deepSeekRequestBody.max_tokens, 12000, "task maxOutputTokens must be the provider request hard limit");
assert.equal(deepSeekRequestBody.stream, false);
assert.deepEqual(deepSeekRequestBody.thinking, { type: "disabled" });
assert.equal(boundedStrategy.telemetry.appliedProfileParameters.requestedMaxOutputTokens, 16384);
assert.equal(boundedStrategy.telemetry.appliedProfileParameters.taskMaxOutputTokens, 12000);
assert.equal(boundedStrategy.telemetry.appliedProfileParameters.effectiveMaxOutputTokens, 12000);
assert.equal(boundedStrategy.telemetry.appliedProfileParameters.reasoning.applied, "disabled");
assert.equal(boundedStrategy.telemetry.profileDegradation.some((item) => item.reason === "task_latency_policy_for_non_streaming_json"), true);

const boundedPlaybook = await invokeLlm({
  task: "select_growth_playbook",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  modelIdentity: { ...identity, provider: "DeepSeek", model: "deepseek-chat", capabilities: deepSeekBudgetAdapter.getCapabilities() },
  adapterFactory: () => deepSeekBudgetAdapter
});
assert.equal(boundedPlaybook.mode, "live");
assert.equal(deepSeekRequestBody.max_tokens, 6144);
assert.deepEqual(deepSeekRequestBody.thinking, { type: "disabled" });
assert.equal(boundedPlaybook.telemetry.appliedProfileParameters.reasoning.applied, "disabled");

resetLlmRuntimeForTests();
const attributedRecovery = await invokeLlm({
  task: "write_wechat_article_v2_recovery",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  modelIdentity: { ...identity, provider: "DeepSeek", model: "deepseek-chat", capabilities: deepSeekBudgetAdapter.getCapabilities() },
  adapterFactory: () => deepSeekBudgetAdapter
});
assert.equal(deepSeekRequestBody.model, "deepseek-v4-flash", "recovery must not rely on the deprecated deepseek-chat alias");
assert.equal(deepSeekRequestBody.max_tokens, 8192);
assert.deepEqual(deepSeekRequestBody.thinking, { type: "disabled" });
assert.deepEqual({ configuredModel: attributedRecovery.telemetry.configuredModel, requestedModel: attributedRecovery.telemetry.requestedModel, effectiveModel: attributedRecovery.telemetry.effectiveModel, legacyModel: attributedRecovery.telemetry.model }, { configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", legacyModel: "deepseek-v4-flash" });

resetLlmRuntimeForTests();
const attributedContentMaster = await invokeLlm({
  task: "build_content_master_v2",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  maxAttempts: 3,
  modelIdentity: { ...identity, provider: "DeepSeek", model: "deepseek-chat", capabilities: deepSeekBudgetAdapter.getCapabilities() },
  adapterFactory: () => deepSeekBudgetAdapter
});
assert.equal(deepSeekRequestBody.model, "deepseek-v4-flash");
assert.equal(attributedContentMaster.telemetry.taskBudget.name, "content_master");
assert.equal(attributedContentMaster.telemetry.taskBudget.totalTimeoutMs, 150000);
assert.equal(attributedContentMaster.telemetry.taskBudget.maxAttempts, 2);
assert.deepEqual({ configuredModel: attributedContentMaster.telemetry.configuredModel, requestedModel: attributedContentMaster.telemetry.requestedModel, effectiveModel: attributedContentMaster.telemetry.effectiveModel }, { configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash" });

let nonDeepSeekRequestBody;
const compatibleDeepSeekNamedAdapter = new OpenAICompatibleAdapter({
  ...config,
  FLOW_MODEL_PROVIDER: "OpenAI-compatible",
  FLOW_MODEL_NAME: "deepseek-chat"
}, "OpenAI-compatible", async (url, options) => {
  nonDeepSeekRequestBody = JSON.parse(options.body);
  return { choices: [{ message: { content: "{\"assistantMessage\":\"compatible provider\"}" } }] };
});
const nonDeepSeekContentMaster = await invokeLlm({
  task: "build_content_master_v2",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  modelIdentity: { ...identity, provider: "OpenAI-compatible", model: "deepseek-chat", capabilities: compatibleDeepSeekNamedAdapter.getCapabilities() },
  adapterFactory: () => compatibleDeepSeekNamedAdapter
});
assert.equal(nonDeepSeekRequestBody.model, "deepseek-chat", "non-DeepSeek providers must retain their configured model");
assert.deepEqual({ requestedModel: nonDeepSeekContentMaster.telemetry.requestedModel, effectiveModel: nonDeepSeekContentMaster.telemetry.effectiveModel }, { requestedModel: "deepseek-chat", effectiveModel: "deepseek-chat" });

let contentMasterFailureCalls = 0;
const failedContentMaster = await invokeLlm({
  task: "build_content_master_v2",
  payload: { contract: "ConsultativeReply@2.0" },
  fallback: { assistantMessage: "validated fallback" },
  contract: "ConsultativeReply@2.0",
  maxAttempts: 3,
  retryDelay: async () => {},
  modelIdentity: { ...identity, provider: "DeepSeek", model: "deepseek-chat", capabilities: deepSeekBudgetAdapter.getCapabilities() },
  adapterFactory: () => ({
    planProfile: (...args) => deepSeekBudgetAdapter.planProfile(...args),
    async invoke() {
      contentMasterFailureCalls += 1;
      return contentMasterFailureCalls === 1
        ? { data: { wrongField: "contract failure" } }
        : { data: { assistantMessage: "repaired content master envelope" } };
    }
  })
});
assert.equal(contentMasterFailureCalls, 2, "ContentMaster must perform exactly one bounded structured repair attempt");
assert.equal(failedContentMaster.mode, "live");
assert.equal(failedContentMaster.telemetry.retryCount, 1);
assert.equal(failedContentMaster.telemetry.repairInputUsed, true);
assert.equal(failedContentMaster.telemetry.attemptFailures[0].errorCategory, "contract_validation");

resetLlmRuntimeForTests();
const attributed503 = await invokeLlm({
  task: "write_wechat_article_v2_recovery",
  payload: { contract: "WechatArticle@2.0" },
  fallback: {},
  contract: "WechatArticle@2.0",
  maxAttempts: 2,
  retryDelay: async () => {},
  modelIdentity: { ...identity, provider: "DeepSeek", model: "deepseek-chat", capabilities: deepSeekBudgetAdapter.getCapabilities() },
  adapterFactory: () => ({ planProfile: (...args) => deepSeekBudgetAdapter.planProfile(...args), async invoke() { throw Object.assign(new Error("offline 503"), { status: 503 }); } })
});
assert.equal(attributed503.telemetry.attempts, 1);
assert.equal(attributed503.telemetry.errorCode, "MODEL_HTTP_5XX");
assert.deepEqual({ configuredModel: attributed503.telemetry.configuredModel, requestedModel: attributed503.telemetry.requestedModel, effectiveModel: attributed503.telemetry.effectiveModel, legacyModel: attributed503.telemetry.model }, { configuredModel: "deepseek-chat", requestedModel: "deepseek-v4-flash", effectiveModel: "deepseek-v4-flash", legacyModel: "deepseek-v4-flash" });

assert.equal(JSON.stringify(repaired.telemetry).includes("full-private-prompt-must-not-be-repeated"), false);

console.log(JSON.stringify({
  status: "model-task-budget-self-test passed",
  budgetClasses: [diagnosticBudget.name, strategyBudget.name, outlineBudget.name, contentMasterBudget.name, bodyBudget.name],
  deterministicTrim: true,
  minimalRepair: true,
  timeoutHardCap: true,
  nonStreamingFirstByteGuard: true,
  providerTokenHardLimit: true,
  adapters: ["openai-compatible", "deepseek", "anthropic"]
}, null, 2));
