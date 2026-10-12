import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createWechatGeneratedRasterExecution, createWechatGeneratedRasterResolver, projectWechatGeneratedImageState } from "../../content-agent/wechat-generated-raster-runtime.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";

const ref = (id) => ({ id, hash: hashUnifiedContent(id) });
const promptBase = {
  schemaVersion: "1.0", contract: "UnifiedWechatPromptPlan@1.0", id: "wechat-prompt-plan:test", projectId: "project-1", platform: "wechat",
  productRef: ref("product"), visualRevisionRef: ref("visual"), imagePlanRef: ref("image-plan"),
  prompts: [
    { slotId: "cover", role: "cover", strategy: "generated_raster", prompt: "用一条逐步清晰的路径表达从试点到规模化", size: "1536x1024" },
    { slotId: "W2", role: "inline", strategy: "generated_raster", prompt: "用真实办公场景表达小步验证", size: "1536x1024" }
  ]
};
const promptPlan = { ...promptBase, planHash: hashUnifiedContent(promptBase) };
const calls = { submit: 0, read: 0, persist: 0, write: 0, readAsset: 0 };
const assets = new Map();
const transport = {
  async submit(request) {
    calls.submit += 1;
    assert.equal(request.body.input.aspect_ratio, "3:2");
    assert.match(request.body.input.prompt, /不要把文章标题/);
    return { taskId: `task-${calls.submit}`, model: request.body.model, status: "provider_task_created" };
  },
  async readResult({ taskId }) {
    calls.read += 1;
    return { status: "succeeded", taskId, bytes: Buffer.from(`png:${taskId}`), cost: 2, costStatus: "provider_reported" };
  }
};
const store = {};
const execute = createWechatGeneratedRasterExecution({
  providerTransport: transport,
  assetWriter: async ({ relativePath, bytes }) => { calls.write += 1; assets.set(relativePath, Buffer.from(bytes)); return { relativePath, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }; },
  persistStore: async () => { calls.persist += 1; },
  model: "seedream/4.5-text-to-image", maxPolls: 1, pollIntervalMs: 0
});

const input = { store, projectId: "project-1", promptPlan, attempt: 1, idempotencyKey: "wechat-images:test:attempt-1", executedBy: "human", executedAt: "2026-08-25T08:00:00.000Z" };
const first = await execute(input);
assert.equal(first.ready, true);
assert.equal(calls.submit, 2);
assert.equal(calls.write, 2);
assert.equal(store.unifiedWechatImageGenerationSubmissions.length, 2);
assert.equal(store.unifiedWechatImageGenerationResults.length, 2);
await execute(input);
assert.equal(calls.submit, 2, "idempotent replay must not create another paid task");

const resolver = createWechatGeneratedRasterResolver({
  store, projectId: "project-1", promptPlan,
  assetReader: async ({ relativePath }) => { calls.readAsset += 1; return { bytes: assets.get(relativePath), relativePath, mediaType: "image/png" }; }
});
const resolved = await resolver({ declaration: { slotId: "cover", role: "cover", strategy: "generated_raster", assetId: "wechat-cover" } });
assert.equal(Buffer.isBuffer(resolved.bytes), true);
assert.equal(resolved.evidence.providerTaskId, "task-1");
assert.equal(projectWechatGeneratedImageState(store, { projectId: "project-1", promptPlan }).slots.length, 2);
assert.equal(calls.readAsset, 1);

console.log(JSON.stringify({ status: "wechat-generated-raster-runtime-self-test passed", providerSubmits: calls.submit, providerReads: calls.read, persistedCheckpoints: calls.persist }));
