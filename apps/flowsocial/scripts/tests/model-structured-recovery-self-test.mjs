import assert from "node:assert/strict";
import { getLlmRuntimeStatus, invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import {
  AnthropicAdapter,
  DeepSeekAdapter,
  OpenAICompatibleAdapter,
  parseStructuredContentResult
} from "../../llm/provider-adapters.mjs";
import { adaptCanonicalSkillEnvelope, validateContractSchema } from "../../llm/contracts.mjs";

const contract = "ConsultativeReply@2.0";
const fallback = { assistantMessage: "validated fallback" };
const valid = { assistantMessage: "provider success" };
const noWait = async () => {};
const identity = {
  configured: true,
  provider: "offline-provider",
  model: "offline-model",
  baseUrl: "https://model.invalid",
  profileMode: "profiled",
  structuredRecovery: "enabled"
};

const markdown = parseStructuredContentResult("```json\n{\"assistantMessage\":\"markdown recovered\"}\n```");
assert.equal(markdown.parseMode, "markdown_json");
assert.equal(markdown.data.assistantMessage, "markdown recovered");

const embedded = parseStructuredContentResult("下面是结果（不要记录这段说明）：\n{\"assistantMessage\":\"embedded recovered\"}\n以上。");
assert.equal(embedded.parseMode, "embedded_json");
assert.equal(embedded.data.assistantMessage, "embedded recovered");

const noisyEmbedded = parseStructuredContentResult("说明里的 {not-json} 不是结果。最终：{\"assistantMessage\":\"first valid object\"} 尾注。");
assert.equal(noisyEmbedded.parseMode, "embedded_json");
assert.equal(noisyEmbedded.data.assistantMessage, "first valid object");

const contractSelected = parseStructuredContentResult(`分析摘要：{"主题":"AI落地","用途":"公众号","建议":"四步法"}
正式结果：{"status":"success","data":{"content_master_id":"cm-selected","confirmed_facts":[],"supported_interpretations":[],"author_opinions":[],"source_list":[]},"warnings":[],"blocked_reasons":[]}`, "ContentMaster@2.0");
assert.equal(contractSelected.parseMode, "embedded_contract_json");
assert.equal(contractSelected.data.data.content_master_id, "cm-selected");

const reviewSelected = parseStructuredContentResult(`审阅说明：{"阶段":"完成","风险":"低","结论":"可用"}
{"decision":"pass","findings":[],"patches":[],"changes":[],"fact_recheck_required":false,"publish_time_checks":[],"review_summary":"extra explanation"}`, "WechatArticleReview@1.0");
assert.equal(reviewSelected.parseMode, "embedded_contract_json");
const reviewEnvelope = adaptCanonicalSkillEnvelope("WechatArticleReview@1.0", reviewSelected.data);
assert.equal(validateContractSchema("WechatArticleReview@1.0", reviewEnvelope.value).valid, true);
assert.equal(Object.hasOwn(reviewEnvelope.value.data, "review_summary"), false);

assert.throws(
  () => parseStructuredContentResult("{\"assistantMessage\":\"truncated\""),
  (error) => error.code === "MODEL_INVALID_JSON" && error.category === "invalid_json"
);

function replayAdapter(sequence) {
  let calls = 0;
  return {
    get calls() { return calls; },
    factory: () => ({
      async invoke() {
        const step = sequence[Math.min(calls, sequence.length - 1)];
        calls += 1;
        if (step?.kind === "raw") {
          const parsed = parseStructuredContentResult(step.content);
          return { data: parsed.data, structuredParse: { mode: parsed.parseMode }, responseId: `response_${calls}` };
        }
        return { data: step?.data, responseId: `response_${calls}` };
      }
    })
  };
}

async function invokeReplay(adapter, { maxAttempts = 3, modelIdentity = identity, traceId }) {
  resetLlmRuntimeForTests();
  const result = await invokeLlm({
    task: "model_gateway_live_test",
    payload: {
      contract,
      requestId: `${traceId}_request`,
      privateBusinessInput: "complete sensitive business input must not be logged",
      apiKey: "offline-secret-must-not-be-logged"
    },
    fallback,
    contract,
    maxAttempts,
    adapterFactory: adapter.factory,
    modelIdentity,
    retryDelay: noWait,
    traceId
  });
  return { result, status: getLlmRuntimeStatus(modelIdentity) };
}

const truncatedThenValid = replayAdapter([
  { kind: "raw", content: "{\"assistantMessage\":\"truncated\"" },
  { kind: "raw", content: "```json\n{\"assistantMessage\":\"retry success\"}\n```" }
]);
const recoveredJson = await invokeReplay(truncatedThenValid, { traceId: "trace_invalid_json_recovery" });
assert.equal(recoveredJson.result.mode, "live");
assert.equal(recoveredJson.result.data.assistantMessage, "retry success");
assert.equal(truncatedThenValid.calls, 2);
assert.equal(recoveredJson.result.telemetry.retryCount, 1);
assert.equal(recoveredJson.result.telemetry.attemptFailures[0].failureClass, "invalid_json");
assert.equal(recoveredJson.result.telemetry.attemptFailures[0].recoveryEligible, true);
assert.equal(recoveredJson.result.telemetry.attemptFailures[0].retryScheduled, true);
assert.equal(recoveredJson.result.telemetry.attemptFailures[0].task, "model_gateway_live_test");
assert.equal(recoveredJson.result.telemetry.attemptFailures[0].profile, "fast_structured");
assert.equal(recoveredJson.result.telemetry.attemptFailures[0].traceId, "trace_invalid_json_recovery");
assert.equal(recoveredJson.result.telemetry.attemptsDetail[1].outcome, "provider_success");
assert.equal(recoveredJson.result.telemetry.attemptsDetail[1].profile, "fast_structured");
assert.equal(recoveredJson.result.telemetry.structuredParseMode, "markdown_json");
assert.equal(recoveredJson.result.telemetry.finalProviderMode, "live");
assert.equal(recoveredJson.result.telemetry.providerSucceeded, true);
assert.equal(recoveredJson.result.telemetry.fallbackUsed, false);

const schemaThenValid = replayAdapter([
  { data: { wrongField: true } },
  { data: valid }
]);
const recoveredSchema = await invokeReplay(schemaThenValid, { traceId: "trace_schema_recovery" });
assert.equal(recoveredSchema.result.mode, "live");
assert.equal(schemaThenValid.calls, 2);
assert.equal(recoveredSchema.result.telemetry.attemptFailures[0].failureClass, "schema_validation");
assert.equal(recoveredSchema.result.telemetry.schemaValid, true);

const unrecoverable = replayAdapter([
  { kind: "raw", content: "{\"assistantMessage\":" }
]);
const exhausted = await invokeReplay(unrecoverable, { traceId: "trace_recovery_exhausted" });
assert.equal(exhausted.result.mode, "validated_fallback");
assert.deepEqual(exhausted.result.data, fallback);
assert.equal(unrecoverable.calls, 3, "structured recovery must stop at maxAttempts");
assert.equal(exhausted.result.telemetry.attempts, 3);
assert.equal(exhausted.result.telemetry.retryCount, 2);
assert.equal(exhausted.result.telemetry.failureClass, "fallback");
assert.equal(exhausted.result.telemetry.terminalFailureClass, "invalid_json");
assert.equal(exhausted.result.telemetry.finalProviderMode, "validated_fallback");
assert.equal(exhausted.result.telemetry.providerSucceeded, false);
assert.equal(exhausted.result.telemetry.fallbackUsed, true);
assert.equal(exhausted.status.connectionState, "connected", "invalid JSON is not a connection outage");

const recoveryDisabled = replayAdapter([
  { kind: "raw", content: "{\"assistantMessage\":" },
  { data: valid }
]);
const legacy = await invokeReplay(recoveryDisabled, {
  traceId: "trace_recovery_disabled",
  modelIdentity: { ...identity, structuredRecovery: "disabled" }
});
assert.equal(legacy.result.mode, "validated_fallback");
assert.equal(recoveryDisabled.calls, 1, "the single recovery switch must restore one call plus fallback");
assert.equal(legacy.result.telemetry.structuredRecoveryEnabled, false);
assert.equal(legacy.result.telemetry.retryCount, 0);

const baseConfig = {
  FLOW_MODEL_BASE_URL: "https://model.invalid",
  FLOW_MODEL_API_KEY: "adapter-test-key",
  FLOW_MODEL_PROTOCOL: "openai",
  FLOW_MODEL_REASONING_CAPABILITY: "unsupported"
};
const providerCases = [
  {
    name: "openai-compatible",
    expectedMessage: "openai",
    adapter: (transport) => new OpenAICompatibleAdapter({ ...baseConfig, FLOW_MODEL_PROVIDER: "OpenAI-compatible", FLOW_MODEL_NAME: "generic-chat" }, "OpenAI-compatible", transport),
    response: { choices: [{ message: { content: "```json\n{\"assistantMessage\":\"openai\"}\n```" } }] },
    parseMode: "markdown_json"
  },
  {
    name: "deepseek",
    expectedMessage: "deepseek",
    adapter: (transport) => new DeepSeekAdapter({ ...baseConfig, FLOW_MODEL_PROVIDER: "DeepSeek", FLOW_MODEL_NAME: "deepseek-chat", FLOW_MODEL_REASONING_CAPABILITY: "thinking_toggle" }, transport),
    response: { choices: [{ message: { content: "说明：{\"assistantMessage\":\"deepseek\"} 完成。" } }] },
    parseMode: "embedded_contract_json"
  },
  {
    name: "anthropic",
    expectedMessage: "anthropic",
    adapter: (transport) => new AnthropicAdapter({ ...baseConfig, FLOW_MODEL_PROVIDER: "Anthropic", FLOW_MODEL_PROTOCOL: "anthropic", FLOW_MODEL_NAME: "claude-3-5-sonnet" }, transport),
    response: { content: [{ type: "text", text: "{\"assistantMessage\":\"anthropic\"}" }] },
    parseMode: "direct"
  }
];

for (const providerCase of providerCases) {
  let transportCalls = 0;
  const adapter = providerCase.adapter(async () => {
    transportCalls += 1;
    return providerCase.response;
  });
  const response = await adapter.invoke({ payload: { contract }, contract, attempt: 1 });
  assert.equal(response.data.assistantMessage, providerCase.expectedMessage);
  assert.equal(response.structuredParse.mode, providerCase.parseMode);
  assert.equal(transportCalls, 1);
}

const serialized = JSON.stringify([
  recoveredJson.status,
  recoveredSchema.status,
  exhausted.status,
  legacy.status
]);
assert.equal(serialized.includes("complete sensitive business input must not be logged"), false);
assert.equal(serialized.includes("offline-secret-must-not-be-logged"), false);
assert.equal(serialized.includes("adapter-test-key"), false);
assert.equal(serialized.includes("Authorization"), false);

console.log(JSON.stringify({
  status: "model-structured-recovery-self-test passed",
  localParseModes: ["markdown_json", "embedded_json"],
  recoveredFailures: ["invalid_json", "schema_validation"],
  maxAttempts: exhausted.result.telemetry.attempts,
  fallbackDistinguished: true,
  providers: providerCases.map((item) => item.name)
}, null, 2));
