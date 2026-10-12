import assert from "node:assert/strict";
import { invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import {
  AnthropicAdapter,
  DeepSeekAdapter,
  OpenAICompatibleAdapter,
  planProviderProfile,
  resolveProviderCapabilities
} from "../../llm/provider-adapters.mjs";
import { resolveLlmProfile } from "../../llm/task-registry.mjs";

const valid = { assistantMessage: "profile routing works" };
const fallback = { assistantMessage: "safe fallback" };
const contract = "ConsultativeReply@2.0";
const baseConfig = {
  FLOW_MODEL_BASE_URL: "https://model.invalid",
  FLOW_MODEL_API_KEY: "test-only-key",
  FLOW_MODEL_PROTOCOL: "openai"
};

const fast = resolveLlmProfile("fast_structured");
const conversation = resolveLlmProfile("conversation");
const reasoning = resolveLlmProfile("reasoning");
assert.notEqual(fast.temperature, conversation.temperature);
assert.notEqual(fast.maxOutputTokens, conversation.maxOutputTokens);
assert.notEqual(conversation.maxOutputTokens, reasoning.maxOutputTokens);
assert.equal(reasoning.reasoning.enabled, true);
assert.equal(fast.reasoning.enabled, false);

function captureTransport(providerResponse) {
  const requests = [];
  return {
    requests,
    transport: async (url, options) => {
      requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return providerResponse;
    }
  };
}

const openAiCapture = captureTransport({
  id: "openai_response",
  choices: [{ message: { content: JSON.stringify(valid) } }]
});
const openAi = new OpenAICompatibleAdapter({
  ...baseConfig,
  FLOW_MODEL_PROVIDER: "OpenAI-compatible",
  FLOW_MODEL_NAME: "generic-chat",
  FLOW_MODEL_REASONING_CAPABILITY: "unsupported"
}, "OpenAI-compatible", openAiCapture.transport);
const openAiResult = await openAi.invoke({ payload: { requestId: "openai-profile" }, contract, profile: reasoning });
const openAiBody = openAiCapture.requests[0].body;
assert.equal(openAiBody.max_tokens, reasoning.maxOutputTokens);
assert.equal(openAiBody.temperature, reasoning.temperature);
assert.deepEqual(openAiBody.response_format, { type: "json_object" });
assert.equal("thinking" in openAiBody, false, "unsupported OpenAI-compatible fields must not be sent");
assert.equal("reasoning_effort" in openAiBody, false, "unsupported reasoning_effort must not be sent");
assert.equal(openAiResult.profileApplication.degraded, true);
assert.equal(openAiResult.profileApplication.profileDegradation[0].capability, "reasoning");

const deepSeekCapture = captureTransport({
  id: "deepseek_response",
  choices: [{ message: { content: JSON.stringify(valid) } }]
});
const deepSeek = new DeepSeekAdapter({
  ...baseConfig,
  FLOW_MODEL_PROVIDER: "DeepSeek",
  FLOW_MODEL_NAME: "deepseek-chat",
  FLOW_MODEL_REASONING_CAPABILITY: "auto"
}, deepSeekCapture.transport);
const deepSeekReasoning = await deepSeek.invoke({ payload: {}, contract, profile: reasoning });
const deepSeekConversation = await deepSeek.invoke({ payload: {}, contract, profile: conversation });
const deepSeekLongJson = await deepSeek.invoke({ payload: {}, contract, profile: reasoning, taskBudget: { maxOutputTokens: 12000, responseMode: "non_streaming_json", reasoningMode: "disable_when_toggleable" } });
assert.deepEqual(deepSeekCapture.requests[0].body.thinking, { type: "enabled" });
assert.deepEqual(deepSeekCapture.requests[1].body.thinking, { type: "disabled" });
assert.equal(deepSeekReasoning.profileApplication.request.reasoning.applied, "enabled");
assert.equal(deepSeekConversation.profileApplication.request.reasoning.applied, "disabled");
assert.deepEqual(deepSeekCapture.requests[2].body.thinking, { type: "disabled" });
assert.equal(deepSeekCapture.requests[2].body.max_tokens, 12000);
assert.equal(deepSeekLongJson.profileApplication.profileDegradation.some((item) => item.reason === "task_latency_policy_for_non_streaming_json"), true);

const reasonerCapture = captureTransport({
  id: "deepseek_reasoner_response",
  choices: [{ message: { content: JSON.stringify(valid) } }]
});
const reasoner = new DeepSeekAdapter({
  ...baseConfig,
  FLOW_MODEL_PROVIDER: "DeepSeek",
  FLOW_MODEL_NAME: "deepseek-reasoner",
  FLOW_MODEL_REASONING_CAPABILITY: "auto"
}, reasonerCapture.transport);
const reasonerResult = await reasoner.invoke({ payload: {}, contract, profile: reasoning });
assert.equal("thinking" in reasonerCapture.requests[0].body, false, "always-on reasoning models must not receive an unknown toggle");
assert.equal(reasonerResult.profileApplication.request.reasoning.applied, "always_on");

const anthropicCapture = captureTransport({
  id: "anthropic_response",
  content: [{ type: "text", text: JSON.stringify(valid) }]
});
const anthropic = new AnthropicAdapter({
  ...baseConfig,
  FLOW_MODEL_PROVIDER: "Anthropic",
  FLOW_MODEL_PROTOCOL: "anthropic",
  FLOW_MODEL_NAME: "claude-3-7-sonnet-latest",
  FLOW_MODEL_REASONING_CAPABILITY: "auto"
}, anthropicCapture.transport);
const anthropicReasoning = await anthropic.invoke({ payload: {}, contract, profile: reasoning });
await anthropic.invoke({ payload: {}, contract, profile: fast });
assert.deepEqual(anthropicCapture.requests[0].body.thinking, { type: "enabled", budget_tokens: reasoning.reasoning.budgetTokens });
assert.equal("temperature" in anthropicCapture.requests[0].body, false, "extended thinking must not send temperature");
assert.equal("thinking" in anthropicCapture.requests[1].body, false);
assert.equal(anthropicCapture.requests[1].body.temperature, fast.temperature);
assert.equal(anthropicReasoning.profileApplication.request.structuredOutput, "prompt_only");
assert.equal(anthropicReasoning.profileApplication.profileDegradation.some((item) => item.capability === "structured_output"), true);

const explicitCapabilities = resolveProviderCapabilities({
  FLOW_MODEL_PROVIDER: "custom",
  FLOW_MODEL_PROTOCOL: "openai",
  FLOW_MODEL_NAME: "custom-reasoner",
  FLOW_MODEL_REASONING_CAPABILITY: "reasoning_effort"
});
const explicitPlan = planProviderProfile(reasoning, explicitCapabilities);
assert.equal(explicitPlan.request.reasoning.providerParameter, "reasoning_effort");
assert.equal(explicitPlan.request.reasoning.effort, "high");

const observedProfiles = [];
const unsupportedCapabilities = resolveProviderCapabilities({
  FLOW_MODEL_PROVIDER: "test",
  FLOW_MODEL_PROTOCOL: "openai",
  FLOW_MODEL_NAME: "test-model",
  FLOW_MODEL_REASONING_CAPABILITY: "unsupported"
});
const gatewayAdapterFactory = () => ({
  planProfile(profile) {
    observedProfiles.push(profile);
    return planProviderProfile(profile, unsupportedCapabilities);
  },
  async invoke({ profileApplication }) {
    return { data: valid, responseId: "gateway_profile_response", profileApplication };
  }
});
const identity = {
  configured: true,
  provider: "test-provider",
  model: "test-model",
  baseUrl: "https://model.invalid",
  profileMode: "profiled",
  capabilities: unsupportedCapabilities
};

resetLlmRuntimeForTests();
const routed = [];
for (const task of ["analyze_diagnostic_turn", "compose_consultative_diagnostic_reply", "select_growth_playbook"]) {
  routed.push(await invokeLlm({
    task,
    payload: { contract },
    fallback,
    contract,
    adapterFactory: gatewayAdapterFactory,
    modelIdentity: identity
  }));
}
assert.deepEqual(observedProfiles.map((profile) => profile.appliedName), ["fast_structured", "conversation", "reasoning"]);
assert.deepEqual(routed.map((result) => result.mode), ["live", "live", "live"]);
assert.deepEqual(routed.map((result) => result.telemetry.appliedProfile), ["fast_structured", "conversation", "reasoning"]);
assert.equal(routed[2].telemetry.profileDegraded, true);
assert.equal(routed[2].telemetry.profileDegradation[0].reason, "provider_or_model_does_not_support_reasoning_control");

const legacyProfiles = [];
const legacyResult = await invokeLlm({
  task: "select_growth_playbook",
  payload: { contract },
  fallback,
  contract,
  adapterFactory: () => ({
    planProfile(profile) {
      legacyProfiles.push(profile);
      return planProviderProfile(profile, unsupportedCapabilities);
    },
    async invoke({ profileApplication }) {
      return { data: valid, profileApplication };
    }
  }),
  modelIdentity: { ...identity, profileMode: "legacy_structured" }
});
assert.equal(legacyProfiles[0].requestedName, "reasoning");
assert.equal(legacyProfiles[0].appliedName, "default");
assert.equal(legacyResult.telemetry.profileMode, "legacy_structured");
assert.equal(legacyResult.telemetry.appliedProfile, "default");

const serializedTelemetry = JSON.stringify(routed.map((result) => result.telemetry));
assert.equal(serializedTelemetry.includes("test-only-key"), false);
assert.equal(serializedTelemetry.includes("Authorization"), false);

console.log(JSON.stringify({
  status: "model-profile-routing-self-test passed",
  profiles: observedProfiles.map((profile) => profile.appliedName),
  providers: ["openai-compatible", "deepseek-chat", "deepseek-reasoner", "anthropic"],
  legacyRollback: true
}, null, 2));
