import assert from "node:assert/strict";
import { getLlmRuntimeStatus, invokeLlm, resetLlmRuntimeForTests } from "../../llm/gateway.mjs";
import { classifyProviderFailure, parseStructuredContent } from "../../llm/provider-adapters.mjs";

const identity = { configured: true, provider: "test-provider", model: "test-model", baseUrl: "https://model.invalid" };
const fallback = { assistantMessage: "safe fallback" };
const valid = { assistantMessage: "valid response" };
const noWait = async () => {};

const classifiedCases = [
  [Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }), "MODEL_TIMEOUT", "timeout", "timeout", true],
  [Object.assign(new Error("dns"), { code: "ENOTFOUND" }), "MODEL_DNS_ERROR", "dns", "network", false],
  [Object.assign(new Error("connection"), { code: "ECONNREFUSED" }), "MODEL_CONNECTION_ERROR", "connection", "network", false],
  [Object.assign(new Error("auth"), { status: 401 }), "MODEL_HTTP_401", "authentication", "provider", false],
  [Object.assign(new Error("forbidden"), { status: 403 }), "MODEL_HTTP_403", "authorization", "provider", false],
  [Object.assign(new Error("rate"), { status: 429 }), "MODEL_HTTP_429", "rate_limit", "provider", true],
  [Object.assign(new Error("temporary"), { status: 503 }), "MODEL_HTTP_5XX", "provider_5xx", "provider", true],
  [Object.assign(new Error("not implemented"), { status: 501 }), "MODEL_HTTP_5XX", "provider_5xx", "provider", false]
];

for (const [error, code, category, failureClass, retryable] of classifiedCases) {
  const failure = classifyProviderFailure(error);
  assert.equal(failure.code, code);
  assert.equal(failure.category, category);
  assert.equal(failure.failureClass, failureClass);
  assert.equal(failure.retryable, retryable);
}
assert.throws(() => parseStructuredContent(""), (error) => error.code === "MODEL_EMPTY_RESPONSE" && error.category === "empty_response");
assert.throws(() => parseStructuredContent("not-json"), (error) => error.code === "MODEL_INVALID_JSON" && error.category === "invalid_json");
assert.equal(classifyProviderFailure(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })).failureClass, "timeout");
assert.equal(classifyProviderFailure((() => { try { parseStructuredContent("not-json"); } catch (error) { return error; } })()).failureClass, "invalid_json");
assert.equal(classifyProviderFailure(Object.assign(new Error("schema"), { code: "CONTRACT_INVALID" })).failureClass, "schema_validation");

function adapterSequence(sequence) {
  let calls = 0;
  return {
    get calls() { return calls; },
    factory: () => ({
      invoke: async () => {
        const step = sequence[Math.min(calls, sequence.length - 1)];
        calls += 1;
        if (step instanceof Error) throw step;
        return { data: step, usage: { total_tokens: 1 }, responseId: `provider_${calls}` };
      }
    })
  };
}

async function runFailure(error, maxAttempts = 3) {
  resetLlmRuntimeForTests();
  const adapter = adapterSequence([error]);
  const result = await invokeLlm({ task: "model_gateway_live_test", payload: { contract: "ConsultativeReply@2.0" }, fallback, contract: "ConsultativeReply@2.0", maxAttempts, adapterFactory: adapter.factory, modelIdentity: identity, retryDelay: noWait, traceId: "trace_failure_test" });
  return { result, calls: adapter.calls, status: getLlmRuntimeStatus(identity) };
}

for (const error of [
  Object.assign(new Error("dns-private-detail"), { code: "ENOTFOUND" }),
  Object.assign(new Error("secret-auth-detail"), { status: 401 }),
  Object.assign(new Error("forbidden-detail"), { status: 403 }),
  (() => { try { parseStructuredContent(""); } catch (error) { return error; } })()
]) {
  const { result, calls } = await runFailure(error);
  assert.equal(result.mode, "validated_fallback");
  assert.equal(calls, 1, `${error.status || error.code} must not retry`);
  assert.equal(result.telemetry.retryCount, 0);
}

const invalidJsonFailure = (() => { try { parseStructuredContent("not-json"); } catch (error) { return error; } })();
const invalidJsonRun = await runFailure(invalidJsonFailure);
assert.equal(invalidJsonRun.result.mode, "validated_fallback");
assert.equal(invalidJsonRun.calls, 3, "invalid JSON must use the finite structured recovery budget");
assert.equal(invalidJsonRun.result.telemetry.failureClass, "fallback");
assert.equal(invalidJsonRun.result.telemetry.terminalFailureClass, "invalid_json");

for (const error of [
  Object.assign(new Error("timeout-private-detail"), { code: "ETIMEDOUT" }),
  Object.assign(new Error("rate-private-detail"), { status: 429 }),
  Object.assign(new Error("server-private-detail"), { status: 503 })
]) {
  const { result, calls } = await runFailure(error);
  assert.equal(result.mode, "validated_fallback");
  assert.equal(calls, 3, `${error.status || error.code} should use the finite retry budget`);
  assert.equal(result.telemetry.retryCount, 2);
  assert.deepEqual(result.telemetry.retryDelaysMs, [250, 500]);
}

const timeoutRun = await runFailure(Object.assign(new Error("timeout-private-detail"), { code: "ETIMEDOUT" }));
assert.equal(timeoutRun.result.telemetry.failureClass, "fallback");
assert.equal(timeoutRun.result.telemetry.terminalFailureClass, "timeout");
assert.equal(timeoutRun.result.telemetry.providerSucceeded, false);

resetLlmRuntimeForTests();
assert.equal(getLlmRuntimeStatus(identity).connectionState, "unknown", "a restarted backend with no calls must be unknown");

const recoveringAdapter = adapterSequence([Object.assign(new Error("temporary failure"), { status: 503 }), valid]);
const recovered = await invokeLlm({ task: "model_gateway_live_test", payload: { contract: "ConsultativeReply@2.0", strategyTurnId: "turn_42", privatePrompt: "must-not-be-recorded" }, fallback, contract: "ConsultativeReply@2.0", maxAttempts: 2, adapterFactory: recoveringAdapter.factory, modelIdentity: identity, retryDelay: noWait, traceId: "trace_recovered" });
assert.equal(recovered.mode, "live");
assert.equal(recovered.telemetry.retryCount, 1);
assert.equal(recovered.telemetry.correlation.strategyTurnId, "turn_42");
let status = getLlmRuntimeStatus(identity);
assert.equal(status.connectionState, "connected");
assert.equal(status.lastFailure.errorCategory, "provider_5xx", "the recent failure must survive a later success");
assert.equal(status.recentFailures[0].traceId, "trace_recovered");
assert.equal(JSON.stringify(status).includes("must-not-be-recorded"), false, "telemetry must not contain prompts");
assert.equal(JSON.stringify(status).includes("temporary failure"), false, "telemetry must not contain raw provider errors");

resetLlmRuntimeForTests();
const failedCallAdapter = adapterSequence([Object.assign(new Error("credential-secret"), { status: 401 })]);
await invokeLlm({ task: "analyze_diagnostic_turn", payload: { contract: "ConsultativeReply@2.0" }, fallback, contract: "ConsultativeReply@2.0", maxAttempts: 2, adapterFactory: failedCallAdapter.factory, modelIdentity: identity, retryDelay: noWait, traceId: "trace_prior_failure" });
const laterSuccessAdapter = adapterSequence([valid]);
await invokeLlm({ task: "compose_consultative_diagnostic_reply", payload: { contract: "ConsultativeReply@2.0" }, fallback, contract: "ConsultativeReply@2.0", adapterFactory: laterSuccessAdapter.factory, modelIdentity: identity, retryDelay: noWait, traceId: "trace_later_success" });
status = getLlmRuntimeStatus(identity);
assert.equal(status.connectionState, "connected", "a later successful call must restore the current connection state");
assert.equal(status.lastFailure.traceId, "trace_prior_failure", "the last sanitized failure must remain after a later call succeeds");
assert.equal(status.recentCalls.some((call) => call.traceId === "trace_prior_failure" && call.errorCode === "MODEL_HTTP_401"), true);

resetLlmRuntimeForTests();
const contractAdapter = adapterSequence([{ wrong: true }]);
const contractResult = await invokeLlm({ task: "model_gateway_live_test", payload: { contract: "ConsultativeReply@2.0" }, fallback, contract: "ConsultativeReply@2.0", maxAttempts: 3, adapterFactory: contractAdapter.factory, modelIdentity: identity, retryDelay: noWait, traceId: "trace_contract" });
assert.equal(contractResult.mode, "validated_fallback");
assert.equal(contractAdapter.calls, 3, "schema validation failures must use the finite structured recovery budget");
assert.equal(contractResult.telemetry.errorCode, "MODEL_CONTRACT_INVALID");
assert.equal(contractResult.telemetry.failureClass, "fallback");
assert.equal(contractResult.telemetry.terminalFailureClass, "schema_validation");
assert.equal(getLlmRuntimeStatus(identity).connectionState, "connected", "a contract failure must not mark the provider unreachable");

console.log(JSON.stringify({
  status: "model-gateway-failure-self-test passed",
  classified: classifiedCases.length + 5,
  retryableAttempts: 3,
  retainedFailureAfterRecovery: true,
  restartState: "unknown"
}, null, 2));
