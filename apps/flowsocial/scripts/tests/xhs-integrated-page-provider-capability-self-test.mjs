import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPABILITY_STATUSES,
  MAX_BILLABLE_CALLS,
  assertIsolatedOutput,
  createProbePlan,
  executeProviderTask,
  inspectImageDimensions,
  redactSensitive,
  summarizeCreditEvidence,
  validateCandidateCount,
  validateProbePlan
} from "../live/xhs-integrated-page-provider-capability.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fixture = JSON.parse(await readFile(new URL("../fixtures/xhs-integrated-page-provider/samples.json", import.meta.url), "utf8"));
const plan = createProbePlan(fixture, { provider: "fake-provider", baseUrl: "https://provider.invalid", model: "fake-text", quality: "basic" });

assert.equal(plan.requests.length, 5);
assert.equal(plan.estimatedBillableCalls, 5);
assert.ok(plan.estimatedBillableCalls <= MAX_BILLABLE_CALLS);
assert.equal(plan.automaticRetries, 0);
assert.ok(plan.requests.every((item) => item.candidateCount === 1));
assert.deepEqual(plan.requests.slice(0, 3).map((item) => item.id), ["cover", "checklist", "process"]);
assert.equal(validateProbePlan(plan).valid, true);
assert.deepEqual(CAPABILITY_STATUSES, ["verified_supported", "verified_unsupported", "not_exposed", "not_tested"]);

const secret = "kie-secret-value-must-not-leak";
const redacted = redactSensitive({ apiKey: secret, nested: { Authorization: `Bearer ${secret}`, safe: "visible" } });
assert.equal(JSON.stringify(redacted).includes(secret), false);
assert.equal(redacted.nested.safe, "visible");

assert.throws(() => assertIsolatedOutput(resolve(root, "data"), resolve(root, "../..")), /Output must be isolated/);
assert.equal(validateCandidateCount(1, 1).valid, true);
assert.equal(validateCandidateCount(1, 2).valid, false);
const creditEvidence = summarizeCreditEvidence(100, 67.5, { source: "fixture" });
assert.equal(creditEvidence.consumed, 32.5);
assert.equal("before" in creditEvidence, false);
assert.equal("after" in creditEvidence, false);

const png = Buffer.alloc(32);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
png.writeUInt32BE(1080, 16);
png.writeUInt32BE(1440, 20);
assert.deepEqual(inspectImageDimensions(png), { format: "png", width: 1080, height: 1440 });

const temp = await mkdtemp(join(tmpdir(), "flowsocial-xhs-provider-capability-"));
let createCalls = 0;
let pollCalls = 0;
let downloadCalls = 0;
const fakeFetch = async (url, options = {}) => {
  if (String(url).endsWith("/createTask")) {
    createCalls += 1;
    assert.equal(JSON.parse(options.body).model, "fake-text");
    return new Response(JSON.stringify({ code: 200, msg: "success", data: { taskId: "task_fixture_123456789" } }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (String(url).includes("recordInfo")) {
    pollCalls += 1;
    const state = pollCalls === 1 ? "processing" : "success";
    const resultJson = state === "success" ? JSON.stringify({ resultUrls: ["https://files.invalid/output.png"] }) : "{}";
    return new Response(JSON.stringify({ code: 200, data: { state, resultJson } }), { status: 200, headers: { "content-type": "application/json" } });
  }
  downloadCalls += 1;
  return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
};

try {
  const result = await executeProviderTask({
    fetchImpl: fakeFetch,
    waitImpl: async () => {},
    baseUrl: "https://provider.invalid",
    apiKey: secret,
    request: plan.requests[0],
    outputDir: temp,
    timeoutMs: 1000,
    pollIntervalMs: 0,
    maxPolls: 3
  });
  assert.equal(createCalls, 1, "provider task creation must not auto-retry");
  assert.equal(pollCalls, 2);
  assert.equal(downloadCalls, 1);
  assert.equal(result.terminalState, "success");
  assert.equal(result.returnedCandidateCount, 1);
  assert.equal(result.candidateCheck.valid, true);
  assert.deepEqual(result.files[0].dimensions, { format: "png", width: 1080, height: 1440 });

  let failedCreates = 0;
  await assert.rejects(() => executeProviderTask({
    fetchImpl: async () => { failedCreates += 1; return new Response(JSON.stringify({ msg: "rejected" }), { status: 400, headers: { "content-type": "application/json" } }); },
    waitImpl: async () => {},
    baseUrl: "https://provider.invalid",
    apiKey: secret,
    request: plan.requests[0],
    outputDir: temp,
    timeoutMs: 1000,
    pollIntervalMs: 0,
    maxPolls: 1
  }), /rejected/);
  assert.equal(failedCreates, 1, "failed task creation must not be retried");

  let timeoutPolls = 0;
  await assert.rejects(() => executeProviderTask({
    fetchImpl: async (url) => {
      if (String(url).endsWith("/createTask")) {
        return new Response(JSON.stringify({ code: 200, data: { taskId: "task_timeout_fixture" } }), { status: 200, headers: { "content-type": "application/json" } });
      }
      timeoutPolls += 1;
      return new Response(JSON.stringify({ code: 200, data: { state: "processing" } }), { status: 200, headers: { "content-type": "application/json" } });
    },
    waitImpl: async () => {},
    baseUrl: "https://provider.invalid",
    apiKey: secret,
    request: plan.requests[0],
    outputDir: temp,
    timeoutMs: 1000,
    pollIntervalMs: 0,
    maxPolls: 2
  }), /polling timed out/);
  assert.equal(timeoutPolls, 2, "polling must stop at the configured bound");
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  status: "xhs-integrated-page-provider-capability-self-test passed",
  plannedCalls: plan.estimatedBillableCalls,
  maximumCalls: MAX_BILLABLE_CALLS,
  automaticRetries: plan.automaticRetries,
  isolatedOutput: plan.outputDir,
  capabilityStatuses: CAPABILITY_STATUSES
}, null, 2));
