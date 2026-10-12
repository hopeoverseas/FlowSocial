import assert from "node:assert/strict";
import { createXhsOpenAiCompatibleMultimodalTransport } from "../../content-agent/xhs-multimodal-production-adapter.mjs";
import { createUnifiedContentXhsOpenAiCompatibleVisualReviewLiveDependencies } from "../live/unified-content-xhs-visual-review-live.mjs";

let received = null;
const transport = createXhsOpenAiCompatibleMultimodalTransport({
  baseUrl: "https://vision.example.test", apiKey: "fixture-key", model: "fixture-vision", cost: 1,
  fetchImpl: async (_url, options) => {
    received = JSON.parse(options.body);
    return { ok: true, status: 200, async json() { return { choices: [{ message: { content: JSON.stringify({ status: "success", data: { decision: "pass", page_findings: [], deck_findings: [], passed_checks: ["pixels"], rerun_stages: [] }, warnings: [], blocked_reasons: [] }) } }] }; } };
  }
});
const result = await transport({ contract: "UnifiedXhsVisualReviewMultimodalRequest@1.0", expectedContract: "XhsVisualReview@1.0", input: { current_version: "fixture" }, attachments: [{ pageId: "P1", mediaType: "image/png", bytes: Buffer.from("png"), sha256: "a", dimensions: { width: 1080, height: 1440 } }] });
assert.equal(result.pixelInputConsumed, true);
assert.equal(result.output.data.decision, "pass");
assert.equal(received.messages[0].content[1].type, "image_url");
assert.match(received.messages[0].content[1].image_url.url, /^data:image\/png;base64,/);
const live = createUnifiedContentXhsOpenAiCompatibleVisualReviewLiveDependencies({ baseUrl: "https://vision.example.test", apiKey: "fixture-key", model: "fixture-vision", isolatedDataDir: "C:/isolated", executionId: "EXE", maxCredits: 1, cost: 1, fetchImpl: async () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { content: "{}" } }] }; } }), assetReader: async () => Buffer.from("png"), checkpointStore: async () => {} });
assert.equal(live.xhsVisualReviewTransportContext.networked, true);
console.log(JSON.stringify({ status: "xhs-multimodal-adapter-self-test passed", networkCalls: 0, platformCalls: 0 }, null, 2));
