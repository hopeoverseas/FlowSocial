import assert from "node:assert/strict";
import { createAtomicProviderTextGenerator, createProviderTextGenerator } from "../../providers.mjs";
import { invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";

const identity = {
  configured: true,
  provider: "single-attempt-test-provider",
  model: "single-attempt-test-model",
  baseUrl: "https://model.invalid"
};
const valid = { assistantMessage: "valid response" };
const ordinaryFallback = { assistantMessage: "ordinary fallback" };
const noWait = async () => {};
const liveInvocation = Object.freeze({
  ordinal: 1,
  capability: "build-content-master",
  platform: "xiaohongshu",
  stepId: "content_master"
});
const payload = Object.freeze({
  task: "model_gateway_live_test",
  contract: "ConsultativeReply@2.0",
  skill_runtime: { skill_name: liveInvocation.capability }
});

function adapterSequence(sequence) {
  let calls = 0;
  return {
    get calls() { return calls; },
    factory: () => ({
      invoke: async () => {
        const step = sequence[Math.min(calls, sequence.length - 1)];
        calls += 1;
        if (step instanceof Error) throw step;
        return { data: structuredClone(step), usage: { total_tokens: 1 }, responseId: `provider_${calls}` };
      }
    })
  };
}

function gatewayFor(adapter, traceId) {
  return (options) => invokeLlm({
    ...options,
    adapterFactory: adapter.factory,
    modelIdentity: identity,
    retryDelay: noWait,
    traceId
  });
}

const failures = [
  ["retryable transport", Object.assign(new Error("private transport failure"), { status: 503 })],
  ["timeout", Object.assign(new Error("private timeout failure"), { code: "ETIMEDOUT" })],
  ["rate limit", Object.assign(new Error("private rate failure"), { status: 429 })],
  ["invalid JSON", Object.assign(new Error("private invalid JSON failure"), { code: "MODEL_INVALID_JSON", category: "invalid_json" })],
  ["schema", { wrong: true }]
];

for (const [label, failure] of failures) {
  resetLlmRuntimeForTests();
  const adapter = adapterSequence([failure]);
  const atomicGenerateText = createAtomicProviderTextGenerator({ invoke: gatewayFor(adapter, `trace_atomic_${label.replaceAll(" ", "_")}`) });
  const result = await atomicGenerateText(payload, { liveInvocation });
  assert.equal(result.mode, "validated_fallback", `${label}: failure must remain non-authoritative`);
  assert.equal(result.data, null, `${label}: control envelope must never become a business fallback`);
  assert.equal(adapter.calls, 1, `${label}: bottom Provider adapter must be invoked exactly once`);
  assert.equal(result.telemetry.retryCount, 0, `${label}: automatic retry count must remain zero`);
  assert.equal(result.telemetry.maxAttempts, 1);
  assert.equal(result.telemetry.automaticRetries, 0);
  assert.deepEqual(result.telemetry.liveInvocation, liveInvocation);
}

const ordinaryAdapter = adapterSequence([
  Object.assign(new Error("ordinary transient failure"), { status: 503 }),
  valid
]);
const ordinaryGenerateText = createProviderTextGenerator({ invoke: gatewayFor(ordinaryAdapter, "trace_ordinary_two_attempts") });
const ordinaryResult = await ordinaryGenerateText(payload, ordinaryFallback);
assert.equal(ordinaryResult.mode, "live");
assert.equal(ordinaryAdapter.calls, 2, "ordinary non-Atomic generateText must retain the existing two-attempt recovery semantics");
assert.equal(ordinaryResult.telemetry.retryCount, 1);

let strictGatewayCalls = 0;
const strictGenerator = createAtomicProviderTextGenerator({
  invoke: async (options) => {
    strictGatewayCalls += 1;
    assert.equal(options.maxAttempts, 1);
    assert.equal(options.fallback, null);
    return { mode: "live", data: valid, telemetry: { retryCount: 0 } };
  }
});
for (const [label, control, expectedCode] of [
  ["missing", null, "ATOMIC_PROVIDER_LIVE_INVOCATION_REQUIRED"],
  ["business fallback collision", { liveInvocation, fallback: ordinaryFallback }, "ATOMIC_PROVIDER_LIVE_INVOCATION_REQUIRED"],
  ["incomplete", { liveInvocation: { ordinal: 1, capability: liveInvocation.capability, platform: liveInvocation.platform } }, "ATOMIC_PROVIDER_LIVE_INVOCATION_INVALID"],
  ["capability mismatch", { liveInvocation: { ...liveInvocation, capability: "generate-content-outline" } }, "ATOMIC_PROVIDER_LIVE_INVOCATION_MISMATCH"]
]) {
  await assert.rejects(() => strictGenerator(payload, control), (error) => error?.code === expectedCode, label);
}
assert.equal(strictGatewayCalls, 0, "invalid or mismatched control must fail before the Gateway");
const strictResult = await strictGenerator(payload, { liveInvocation });
assert.equal(strictGatewayCalls, 1);
assert.deepEqual(strictResult.telemetry.liveInvocation, liveInvocation);
assert.equal(strictResult.telemetry.maxAttempts, 1);
assert.equal(strictResult.telemetry.automaticRetries, 0);

const violatingGenerator = createAtomicProviderTextGenerator({
  invoke: async () => ({ mode: "live", data: valid, telemetry: { attempts: 2, retryCount: 1 } })
});
await assert.rejects(
  () => violatingGenerator(payload, { liveInvocation }),
  (error) => error?.code === "ATOMIC_PROVIDER_RETRY_BUDGET_VIOLATION",
  "reported inner retries must fail closed even if an alternate Gateway violates maxAttempts=1"
);

console.log(JSON.stringify({
  status: "provider-single-attempt-self-test passed",
  atomicFailureCases: failures.length,
  atomicAdapterCallsPerFailure: 1,
  atomicAutomaticRetries: 0,
  ordinaryRecoveryAttempts: ordinaryAdapter.calls,
  externalApiCalls: 0,
  activeDatabaseWrites: 0,
  commitsCreated: 0
}, null, 2));
