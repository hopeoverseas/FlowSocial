import assert from "node:assert/strict";
import { runContentSkill } from "../../content-agent/skill-runner.mjs";

const PRIVATE_TEXT = "PRIVATE_PROMPT sk-live-do-not-project raw-provider-response";

async function captureGatewayFailure({ errorCode, errorCategory, validationFieldPaths = [] }) {
  let rejection = null;
  try {
    await runContentSkill({
      capability: "generate-content-outline",
      platform: "xiaohongshu",
      input: { fixture: "gateway-failure-projection" },
      fallback: null,
      maxAttempts: 1,
      generateText: async () => ({
        mode: "validated_fallback",
        data: null,
        warning: PRIVATE_TEXT,
        telemetry: {
          providerSucceeded: false,
          errorCode,
          errorCategory,
          contractDiagnostics: {
            validationFieldPaths,
            rawResponse: PRIVATE_TEXT,
            prompt: PRIVATE_TEXT
          },
          rawResponse: PRIVATE_TEXT,
          prompt: PRIVATE_TEXT
        }
      })
    });
  } catch (error) {
    rejection = error;
  }
  assert(rejection, `${errorCode} must reject empty validated fallback data`);
  return rejection;
}

for (const [errorCode, errorCategory] of [
  ["MODEL_TASK_TIMEOUT", "timeout"],
  ["MODEL_HTTP_5XX", "provider_5xx"],
  ["MODEL_CONTRACT_INVALID", "contract_validation"],
  ["MODEL_EMPTY_RESPONSE", "empty_response"]
]) {
  const error = await captureGatewayFailure({ errorCode, errorCategory });
  assert.equal(error.code, errorCode);
  assert.equal(error.errorCategory, errorCategory);
  assert.equal(error.message, "generate-content-outline execution failed");
  assert.equal(JSON.stringify(error).includes(PRIVATE_TEXT), false);
}

const sourcePaths = [
  ".data.sections0.title",
  "data.sections.masterUnitRefs",
  "input.prompt[PRIVATE_PROMPT]",
  "x".repeat(101),
  ...Array.from({ length: 35 }, (_, index) => `data.sections.${index}.title`)
];
const contractError = await captureGatewayFailure({
  errorCode: "MODEL_CONTRACT_INVALID",
  errorCategory: "contract_validation",
  validationFieldPaths: sourcePaths
});
assert.equal(contractError.fieldPaths.length, 30);
assert.deepEqual(contractError.fieldPaths.slice(0, 2), [".data.sections0.title", "data.sections.masterUnitRefs"]);
assert.notStrictEqual(contractError.fieldPaths, sourcePaths);
sourcePaths[0] = PRIVATE_TEXT;
assert.equal(contractError.fieldPaths[0], ".data.sections0.title");
assert.equal(JSON.stringify(contractError).includes("PRIVATE_PROMPT"), false);

const unsafeTelemetry = await captureGatewayFailure({
  errorCode: "PRIVATE_PROMPT",
  errorCategory: "raw-provider-response",
  validationFieldPaths: ["data.title[PRIVATE_PROMPT]"]
});
assert.equal(unsafeTelemetry.code, "SKILL_EXECUTION_FAILED");
assert.equal(unsafeTelemetry.errorCategory, "skill_execution");
assert.equal(Object.hasOwn(unsafeTelemetry, "fieldPaths"), false);
assert.equal(JSON.stringify(unsafeTelemetry).includes("PRIVATE_PROMPT"), false);

await assert.rejects(() => runContentSkill({
  capability: "generate-content-outline",
  platform: "xiaohongshu",
  input: { fixture: "ordinary-error" },
  maxAttempts: 1,
  generateText: async () => { throw new Error(PRIVATE_TEXT); }
}), (error) => error.code === "SKILL_EXECUTION_FAILED"
  && error.errorCategory === "skill_execution"
  && !error.message.includes(PRIVATE_TEXT));

const successData = { status: "success", data: { sections: [] } };
const success = await runContentSkill({
  capability: "generate-content-outline",
  platform: "xiaohongshu",
  input: { fixture: "success-unchanged" },
  maxAttempts: 1,
  generateText: async () => ({
    mode: "live",
    data: successData,
    telemetry: { providerSucceeded: true, errorCode: null, errorCategory: null }
  })
});
assert.strictEqual(success.data, successData);
assert.equal(success.executionRecord.status, "completed");
assert.equal(success.skillTrace.providerSucceeded, true);

console.log("Skill Gateway failure projection self-test passed");
