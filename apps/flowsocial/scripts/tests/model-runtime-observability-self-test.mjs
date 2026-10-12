import assert from "node:assert/strict";
import { getLlmRuntimeStatus, invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import { planProviderProfile } from "../../llm/provider-adapters.mjs";

const identity = {
  configured: true,
  provider: "offline-provider",
  model: "offline-model",
  baseUrl: "https://model.invalid",
  profileMode: "profiled",
  capabilities: {
    jsonObject: true,
    jsonSchema: false,
    structuredOutput: "json_object",
    reasoningControl: "unsupported",
    thinkingToggle: false,
    reasoningBudget: false,
    reasoningEffort: false,
    toolCalling: false,
    maxContextTokens: null
  }
};
const result = { assistantMessage: "observable response" };

resetLlmRuntimeForTests();
const invocation = await invokeLlm({
  task: "select_growth_playbook",
  payload: {
    contract: "ConsultativeReply@2.0",
    requestId: "request_observability",
    privatePrompt: "sensitive prompt must not appear",
    apiKey: "sensitive key must not appear"
  },
  fallback: { assistantMessage: "fallback" },
  contract: "ConsultativeReply@2.0",
  modelIdentity: identity,
  adapterFactory: () => ({
    planProfile(profile) {
      return planProviderProfile(profile, identity.capabilities);
    },
    async invoke({ profileApplication }) {
      return {
        data: result,
        responseId: "provider_safe_id",
        usage: { input_tokens: 3, output_tokens: 2 },
        profileApplication
      };
    }
  }),
  traceId: "trace_profile_observability"
});

assert.equal(invocation.mode, "live");
assert.equal(invocation.telemetry.requestedProfile, "reasoning");
assert.equal(invocation.telemetry.appliedProfile, "reasoning");
assert.equal(invocation.telemetry.profileDegraded, true);
assert.deepEqual(invocation.telemetry.profileDegradation, [{
  capability: "reasoning",
  requested: "enabled",
  applied: "unsupported",
  reason: "provider_or_model_does_not_support_reasoning_control"
}]);
assert.equal(invocation.telemetry.appliedProfileParameters.requestedMaxOutputTokens, 16384);
assert.equal(invocation.telemetry.appliedProfileParameters.taskMaxOutputTokens, 6144);
assert.equal(invocation.telemetry.appliedProfileParameters.effectiveMaxOutputTokens, 6144);
assert.equal(invocation.telemetry.appliedProfileParameters.maxOutputTokens, 6144);
assert.equal(invocation.telemetry.appliedProfileParameters.reasoning.requested, true);
assert.equal(invocation.telemetry.appliedProfileParameters.reasoning.applied, "disabled");

const status = getLlmRuntimeStatus(identity);
assert.equal(status.connectionState, "connected", "profile degradation is not a connection failure");
assert.equal(status.recentCalls[0].traceId, "trace_profile_observability");
assert.equal(status.recentCalls[0].profileDegraded, true);
assert.equal(status.registeredTasks.some((task) => task.profile === "fast_structured" && task.runtimeProfile.maxOutputTokens === 4096), true);
assert.equal(status.registeredTasks.some((task) => task.profile === "conversation" && task.runtimeProfile.temperature === 0.45), true);
assert.equal(status.registeredTasks.some((task) => task.profile === "reasoning" && task.runtimeProfile.reasoning.enabled === true), true);

const serialized = JSON.stringify(status);
assert.equal(serialized.includes("sensitive prompt must not appear"), false);
assert.equal(serialized.includes("sensitive key must not appear"), false);
assert.equal(serialized.includes("Authorization"), false);

console.log(JSON.stringify({
  status: "model-runtime-observability-self-test passed",
  connectionState: status.connectionState,
  profile: invocation.telemetry.appliedProfile,
  degradationCount: invocation.telemetry.profileDegradation.length
}, null, 2));
