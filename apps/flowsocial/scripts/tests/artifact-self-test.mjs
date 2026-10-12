import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDeliveryZip, generateContentAssets, renderContentDelivery } from "../../artifact-engine.mjs";
import { confirmXhsVisualStoryboard, createXhsVisualStoryboard } from "../../content-agent/xhs-visual-storyboard.mjs";

const root = await mkdtemp(join(tmpdir(), "flowsocial-artifact-test-"));
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const paddedPng = Buffer.concat([Buffer.from(tinyPng, "base64"), Buffer.alloc(900)]).toString("base64");

try {
  const task = {
    id: "content_artifact_test", version: 1, platform: "xiaohongshu", ideaTitle: "企业AI内容治理清单", topicId: "topic_1", topicSelectionId: "selection_1",
    accountStyleSnapshot: { name: "深绿专业信息卡" }, contentIntentProfile: { profile_id: "intent_1" }, contentMaster: { content_master_id: "master_1" },
    currentContent: {
      post_copy: { recommended_title: "企业AI内容治理清单" },
      deck: { pages: Array.from({ length: 6 }, (_, index) => ({ page_id: `P${index + 1}`, page_number: index + 1, page_role: index ? "方法" : "封面", headline: index ? `第 ${index} 步治理方法` : "企业AI内容治理清单", supporting_text: "明确证据、人工审核和责任边界", render_strategy: index === 2 ? "generated_raster" : "html_css" })) },
      image_specs: [{ page_id: "P3", prompt: "editorial office scene, no text, no logo, no watermark" }]
    },
    qualityReview: { status: "passed", blockers: [] }
  };
  task.visualStoryboard = createXhsVisualStoryboard(task);
  confirmXhsVisualStoryboard(task, { confirmedBy: "artifact_self_test" });
  const generated = await generateContentAssets(task, { root, generateImage: async () => ({ status: "succeeded", imageUrl: `data:image/png;base64,${paddedPng}`, provider: "test", taskId: "image_1", model: "fixture" }) }, {});
  assert.equal(generated.summary.succeeded, 1);
  const delivery = await renderContentDelivery(task, { root });
  if (delivery.status !== "visual_review") console.error(JSON.stringify(delivery, null, 2));
  assert.equal(delivery.status, "visual_review");
  assert.equal(delivery.validation.status, "waiting_human_confirmation");
  assert.equal(delivery.rendered.length, 6);
  assert.ok(delivery.rendered.every((item) => item.width === 1080 && item.height === 1440));
  task.visualQualityConfirmation = { version: 1, decision: "approved", confirmedBy: "artifact_self_test", confirmedAt: new Date().toISOString(), pixelAndSemanticReviewed: true };
  task.delivery = null;
  const zip = await createDeliveryZip(task, { root });
  const zipBytes = await readFile(zip.path);
  assert.equal(zipBytes.subarray(0, 2).toString(), "PK");

  const wechat = {
    id: "content_wechat_test", version: 1, platform: "wechat", ideaTitle: "企业如何审慎使用AI检测", topicId: "topic_1", contentIntentProfile: { profile_id: "intent_2" }, contentMaster: { content_master_id: "master_2" },
    currentContent: { recommended_title: "企业如何审慎使用AI检测", abstract: "一套可执行的判断框架", article_markdown: `## 为什么值得讨论\n${"检测分数只是风险信号，不能替代人工判断。".repeat(35)}\n\n## 如何建立流程\n${"记录工具版本、交叉验证、人工复核并保存决策记录。".repeat(35)}\n\n## 边界是什么\n${"避免把概率判断写成确定结论。".repeat(30)}`, cta: "转给负责内容治理的同事", image_plan: { cover: { strategy: "html_chart" }, slots: [] } },
    qualityReview: { status: "passed", blockers: [] }
  };
  const wechatDelivery = await renderContentDelivery(wechat, { root });
  assert.equal(wechatDelivery.status, "ready");
  assert.equal(wechatDelivery.validation.blockers.length, 0);
  const emptyWechat = {
    id: "content_wechat_empty", version: 1, platform: "wechat", ideaTitle: "空交付不应放行",
    currentContent: { recommended_title: "空交付不应放行", article_markdown: "", abstract: "", cta: "" }
  };
  const emptyDelivery = await renderContentDelivery(emptyWechat, { root });
  assert.equal(emptyDelivery.validation.status, "needs_review");
  await assert.rejects(() => createDeliveryZip(emptyWechat, { root }), (error) => error.code === "DELIVERY_QUALITY_GATE_BLOCKED");
  assert.equal(emptyWechat.delivery.zipPath, null, "failed quality gate must not create a downloadable package");
  console.log(JSON.stringify({ status: "passed", xhsPngs: delivery.rendered.length, zipBytes: zip.bytes, wechatHtml: "valid" }));
} finally {
  await rm(root, { recursive: true, force: true });
}

