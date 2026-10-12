import assert from "node:assert/strict";
import { createXhsKieProviderTransport, createXhsFileAssetReader, createXhsFileAssetWriter, createXhsFileByteSink } from "../../content-agent/xhs-kie-production-adapter.mjs";
import { createUnifiedContentXhsKieLiveDependencies } from "../live/unified-content-xhs-provider-execution-live.mjs";
import { compactXhsFallbackBase } from "../../content-agent/xhs-asset-paths.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

assert.throws(() => createXhsKieProviderTransport(), /BASE_URL_INVALID/);
let calls = [];
const transport = createXhsKieProviderTransport({
  baseUrl: "https://kie.example.test", apiKey: "fixture-key", pollIntervalMs: 0,
  fetchImpl: async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/api/v1/jobs/createTask")) return { ok: true, status: 200, async json() { return { code: 200, data: { taskId: "task-1" } }; } };
    if (String(url).includes("recordInfo")) return { ok: true, status: 200, async json() { return { code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://assets.example.test/task-1.png"] }) } }; } };
    return { ok: true, status: 200, async arrayBuffer() { return Buffer.from("png-fixture"); } };
  }
});
const result = await transport({ endpoint: "/api/v1/jobs/createTask", method: "POST", body: { model: "fixture-model", input: { prompt: "fixture" } } });
assert.equal(result.status, "succeeded");
assert.equal(result.paidTaskCreated, true);
assert.equal(result.costStatus, "unknown");
assert.equal(result.taskId, "task-1");
assert.equal(Buffer.isBuffer(result.bytes), true);
assert.equal(calls.length, 3);
let splitStateReads = 0;
const splitTransport = createXhsKieProviderTransport({
  baseUrl: "https://kie.example.test", apiKey: "fixture-key", pollIntervalMs: 0,
  fetchImpl: async (url) => {
    if (String(url).endsWith("/api/v1/jobs/createTask")) return { ok: true, status: 200, async json() { return { code: 200, data: { taskId: "split-task" } }; } };
    if (String(url).includes("recordInfo")) { splitStateReads += 1; return { ok: true, status: 200, async json() { return { code: 200, data: splitStateReads === 1 ? { taskId: "split-task", model: "seedream/4.5-edit", state: "generating" } : { taskId: "split-task", model: "seedream/4.5-edit", state: "success", creditsConsumed: 6.5, resultJson: JSON.stringify({ resultUrls: ["https://assets.example.test/split-task.jpg"] }) } }; } }; }
    return { ok: true, status: 200, headers: { get: () => "image/jpeg" }, async arrayBuffer() { return Buffer.from("jpeg-fixture"); } };
  }
});
const splitSubmission = await splitTransport.submit({ endpoint: "/api/v1/jobs/createTask", method: "POST", body: { model: "seedream/4.5-edit", input: { prompt: "fixture" } } });
assert.equal(splitSubmission.status, "provider_task_created");
assert.equal(splitSubmission.taskId, "split-task");
assert.equal((await splitTransport.readResult(splitSubmission)).status, "processing");
const splitResult = await splitTransport.readResult(splitSubmission);
assert.equal(splitResult.status, "succeeded");
assert.equal(splitResult.cost, 6.5);
assert.equal(splitResult.costStatus, "provider_reported");
assert.equal(splitResult.mediaType, "image/jpeg");
const postCreateFailureTransport = createXhsKieProviderTransport({
  baseUrl: "https://kie.example.test", apiKey: "fixture-key", pollIntervalMs: 0,
  fetchImpl: async (url) => {
    if (String(url).endsWith("/api/v1/jobs/createTask")) return { ok: true, status: 200, async json() { return { code: 200, data: { taskId: "paid-task-needs-reconciliation" } }; } };
    return { ok: false, status: 503, async json() { return { code: 503, msg: "temporary failure" }; } };
  }
});
await assert.rejects(() => postCreateFailureTransport({ endpoint: "/api/v1/jobs/createTask", method: "POST", body: { model: "fixture-model", input: { prompt: "fixture" } } }), (error) => {
  assert.equal(error.taskId, "paid-task-needs-reconciliation");
  assert.equal(error.paidTaskCreated, true);
  return true;
});
const live = createUnifiedContentXhsKieLiveDependencies({
  baseUrl: "https://kie.example.test", apiKey: "fixture-key", isolatedDataDir: "C:/isolated", executionId: "EXE", maxProviderCalls: 1, maxCredits: 1,
  checkpointStore: async () => {}, fetchImpl: async () => ({ ok: true, status: 200, async json() { return { code: 200, data: { taskId: "task-1", state: "success", resultJson: JSON.stringify({ resultUrls: ["https://assets.example.test/task-1.png"] }) } }; }, async arrayBuffer() { return Buffer.from("png-fixture"); } })
});
assert.equal(live.transportContext.networked, true);
assert.equal(live.transportContext.executionId, "EXE");
assert.throws(() => createXhsKieProviderTransport({ baseUrl: "http://localhost", apiKey: "x" }), /BASE_URL_INVALID/);
const root = await mkdtemp(join(tmpdir(), "flowsocial-xhs-adapter-"));
try {
  const sink = createXhsFileByteSink({ isolatedDataDir: root });
  const receipt = await sink([{ attemptRef: { id: "attempt-1", hash: "h" }, rawBytes: Buffer.from("raw"), normalizedBytes: Buffer.from("normalized") }]);
  assert.equal(receipt.status, "staged_and_hash_verified");
  const reader = createXhsFileAssetReader({ isolatedDataDir: root });
  const read = await reader({ relativePath: `${compactXhsFallbackBase({ id: "attempt-1", hash: "h" })}/raw.png` });
  assert.deepEqual(read.bytes, Buffer.from("raw"));
  const writer = createXhsFileAssetWriter({ isolatedDataDir: root });
  await writer({ relativePath: "xhs/candidate:with:colons/P1/a1.png", bytes: Buffer.from("windows-safe") });
  assert.deepEqual((await reader({ relativePath: "xhs/candidate:with:colons/P1/a1.png" })).bytes, Buffer.from("windows-safe"));
  await assert.rejects(() => reader({ relativePath: "../outside.png" }), /OUTSIDE_ISOLATED_DIR/);
} finally { await rm(root, { recursive: true, force: true }); }
console.log(JSON.stringify({ status: "xhs-kie-production-adapter-self-test passed", networkCalls: 0, paidCalls: 0 }, null, 2));
