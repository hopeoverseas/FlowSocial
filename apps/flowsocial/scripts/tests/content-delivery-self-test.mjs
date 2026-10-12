import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeliveryZip, generateContentAssets, renderContentDelivery, syncContentImageTasks } from "../../artifact-engine.mjs";
import { confirmXhsVisualStoryboard, createXhsVisualStoryboard } from "../../content-agent/xhs-visual-storyboard.mjs";

const root = await mkdtemp(join(tmpdir(), "flowsocial-content-delivery-"));
const task = {
  id: "content_delivery_test",
  platform: "xiaohongshu",
  version: 1,
  ideaTitle: "内容系统",
  accountStyleSnapshot: { name: "测试账号" },
  currentContent: {
    post_copy: {
      recommended_title: "起号先搭内容系统",
      opening: "不要每天临时想题。",
      body_sections: [{ heading: "方法", content: "先整理读者问题，再安排内容支柱。" }],
      ending: "从一张表开始。",
      cta: "收藏后执行。",
      hashtags: ["内容运营"]
    },
    deck: {
      pages: Array.from({ length: 6 }, (_, index) => ({
        page_id: `P${index + 1}`,
        page_role: index === 0 ? "封面" : "内容页",
        headline: index === 0 ? "起号先搭内容系统" : `步骤 ${index}`,
        supporting_text: "先整理问题，再稳定发布。",
        visual_direction: "品牌化信息卡片",
        render_strategy: index === 0 ? "generated_raster" : "html_css"
      }))
    },
    image_specs: [{ asset_id: "bg_P1", page_id: "P1", prompt: "editorial content planning desk, clear Chinese typography safe area, no text, no logo, no watermark" }]
  }
};
task.visualStoryboard = createXhsVisualStoryboard(task);
confirmXhsVisualStoryboard(task, { confirmedBy: "content_delivery_self_test" });

const initial = syncContentImageTasks(task);
assert.equal(initial.length, 6);
assert.equal(initial[0].generationStatus, "pending");
assert.equal(initial[1].generationStatus, "not_required");

const generation = await generateContentAssets(task, {
  root,
  generateImage: async () => ({ status: "failed", error: "provider unavailable" })
});
assert.equal(generation.summary.failed, 1);
assert.equal(task.imageTasks[0].generationStatus, "failed");
assert.equal(task.imageTasks[0].generationRetryable, true);
assert.match(task.imageTasks[0].generationError, /provider unavailable/);
assert.equal(task.currentContent.post_copy.opening, "不要每天临时想题。");

const delivery = await renderContentDelivery(task, { root });
assert.equal(delivery.version, 1);
assert.equal(delivery.status, "visual_review");
assert.equal(delivery.validation.status, "waiting_human_confirmation");
assert.equal(delivery.rendered.length, 6);
assert.ok(delivery.rendered.every((item) => item.status === "succeeded" && item.pngPath));
assert.ok(task.imageTasks.every((item) => item.renderStatus === "succeeded" && item.downloadPath));

task.visualQualityConfirmation = { version: 1, decision: "approved", confirmedBy: "content_delivery_self_test", confirmedAt: new Date().toISOString(), pixelAndSemanticReviewed: true };
task.delivery = null;
const zip = await createDeliveryZip(task, { root });
const info = await stat(zip.path);
const bytes = await readFile(zip.path);
assert.equal(info.size, zip.bytes);
assert.equal(bytes.readUInt32LE(0), 0x04034b50);
assert.equal(task.delivery.zipVersion, 1);
for (const requiredName of ["post-copy.json", "deck-spec.json", "audit.json", "manifest.json", "output/01_P1.png"]) {
  assert.ok(bytes.includes(Buffer.from(requiredName)), `ZIP should contain ${requiredName}`);
}

console.log("content delivery self-test passed", {
  version: zip.version,
  bytes: zip.bytes,
  renderedPages: delivery.rendered.length,
  failedGeneratedBackgrounds: generation.summary.failed
});
