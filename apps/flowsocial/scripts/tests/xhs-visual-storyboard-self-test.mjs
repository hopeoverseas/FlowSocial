import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeliveryZip, generateContentAssets, renderContentDelivery } from "../../artifact-engine.mjs";
import { adaptTextLayers, confirmXhsVisualStoryboard, createXhsVisualStoryboard, updateXhsVisualStoryboard, validateXhsVisualStoryboard, XHS_PAGE_TEMPLATES } from "../../content-agent/xhs-visual-storyboard.mjs";
import { reviewRenderedXhsTask } from "../../content-agent/visual-review-engine.mjs";

const root = await mkdtemp(join(tmpdir(), "flowsocial-xhs-visual-"));
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const paddedPng = Buffer.concat([Buffer.from(tinyPng, "base64"), Buffer.alloc(900)]).toString("base64");

const replayPages = [
  { page_id: "P1", page_number: 1, page_role: "cover", text_layers: [{ type: "headline", text: "企业社媒为什么需要 ContentRun" }], supporting_text: "贯通策略、内容、发布与复盘", render_strategy: "generated_raster" },
  { page_id: "P2", page_number: 2, page_role: "pain", textLayers: [{ type: "headline", text: "三大断点让运营无法积累" }, { type: "list", items: ["内容零散", "执行脱节", "复盘失效"] }], visual_direction: "三张等权痛点卡" },
  { page_id: "P3", page_number: 3, page_role: "definition", headline: "ContentRun 串联什么", body_items: ["策略快照", "来源证据", "内容版本", "发布结果"] },
  { page_id: "P4", page_number: 4, page_role: "process", headline: "从策略走到双窗口复盘", body_items: ["策略", "内容", "发布", "72 小时", "7 天复盘"] },
  { page_id: "P5", page_number: 5, page_role: "permission", headline: "资料权限必须先分级", body_items: ["可公开", "仅可脱敏", "禁止使用", "待确认"] },
  { page_id: "P6", page_number: 6, page_role: "gate", headline: "三道门禁拦住错误交付", body_items: ["来源门禁", "质量检查", "人工确认"] },
  { page_id: "P7", page_number: 7, page_role: "summary", headline: "四步建立 ContentRun", body_items: ["冻结策略", "组织证据", "生成与审阅", "回流复盘"] },
  { page_id: "P8", page_number: 8, page_role: "cta", headline: "从一次 30 分钟诊断开始", body_items: ["企业微信", "官网表单"], render_strategy: "html_css" }
];

const task = {
  id: "content_xhs_visual_replay",
  version: 2,
  platform: "xiaohongshu",
  ideaTitle: "企业社媒为什么需要一个贯通策略到复盘的 ContentRun",
  accountStyleSnapshot: { name: "深绿企业编辑风" },
  currentContent: {
    post_copy: { recommended_title: "企业社媒为什么需要 ContentRun", hashtags: ["企业社媒", "内容运营"] },
    deck: { pages: replayPages },
    image_specs: [{ page_id: "P1", asset_id: "P1_background", prompt: "Enterprise social content operations desk, a strategist reviewing a connected workflow, editorial illustration, centered subject with large clear Chinese typography safe area, soft daylight, dark green and warm ivory material palette, sober enterprise brand style, no text, no logo, no watermark", negative_prompt: "no text, no logo, no watermark" }]
  },
  qualityReview: { status: "passed", blockers: [] }
};

try {
  const adapted = adaptTextLayers(replayPages[1]);
  assert.equal(adapted.headline, "三大断点让运营无法积累");
  assert.deepEqual(adapted.bodyItems, ["内容零散", "执行脱节", "复盘失效"]);

  const repeatedArticleTitle = "企业社媒为什么需要一个贯通策略到复盘的 ContentRun";
  const realFailureReplay = replayPages.map((page, index) => ({
    ...page,
    page_role: index === 3 ? "cover" : index === 5 ? "process" : page.page_role,
    headline: repeatedArticleTitle,
    text_layers: [{ type: "headline", text: `逐页标题 ${index + 1}` }, { type: "body", text: `逐页正文 ${index + 1}` }],
    textLayers: undefined
  }));
  const repairedReplay = createXhsVisualStoryboard({
    ...task,
    id: "content_xhs_repeated_headline_replay",
    currentContent: { ...task.currentContent, deck: { pages: realFailureReplay } }
  });
  assert.deepEqual(repairedReplay.pages.map((page) => page.headline), Array.from({ length: 8 }, (_, index) => `逐页标题 ${index + 1}`));
  assert.deepEqual(repairedReplay.pages.map((page) => page.pageRole), ["cover", "pain_list", "concept_definition", "process_flow", "permission_matrix", "gate_mechanism", "value_summary", "action_cta"]);
  assert.equal(validateXhsVisualStoryboard(repairedReplay).checks.find((item) => item.check === "no_duplicate_headlines").result, "pass");
  assert.equal(repairedReplay.pages.every((page, index) => page.bodyItems.includes(`逐页正文 ${index + 1}`)), true);
  const mirroredSupportingText = structuredClone(repairedReplay);
  mirroredSupportingText.pages[0].headline = "12345678901234567890";
  mirroredSupportingText.pages[0].bodyItems = ["12345678901234567890"];
  mirroredSupportingText.pages[0].supportingText = "12345678901234567890";
  assert.equal(validateXhsVisualStoryboard(mirroredSupportingText).checks.find((item) => item.check === "template_capacity").detail.capacityOverflow.includes("P1"), false);

  task.visualStoryboard = createXhsVisualStoryboard(task);
  assert.deepEqual(task.visualStoryboard.pages.map((page) => page.pageRole), ["cover", "pain_list", "concept_definition", "process_flow", "permission_matrix", "gate_mechanism", "value_summary", "action_cta"]);
  assert.equal(new Set(task.visualStoryboard.pages.map((page) => page.layoutType)).size, 8);
  assert.deepEqual(new Set(task.visualStoryboard.pages.map((page) => page.layoutType)), new Set(Object.values(XHS_PAGE_TEMPLATES).map((item) => item.layoutType)));
  assert.equal(task.visualStoryboard.pages[1].headline, "三大断点让运营无法积累");
  assert.deepEqual(task.visualStoryboard.pages[1].bodyItems, ["内容零散", "执行脱节", "复盘失效"]);

  const duplicate = structuredClone(task.visualStoryboard);
  duplicate.pages[2].headline = duplicate.pages[1].headline;
  const duplicateGate = validateXhsVisualStoryboard(duplicate);
  assert.equal(duplicateGate.checks.find((item) => item.check === "no_duplicate_headlines").result, "fail");

  let providerCalls = 0;
  await assert.rejects(() => generateContentAssets(task, { root, generateImage: async () => { providerCalls += 1; return { status: "failed" }; } }), (error) => error.code === "XHS_STORYBOARD_CONFIRMATION_REQUIRED");
  await assert.rejects(() => renderContentDelivery(task, { root }), (error) => error.code === "XHS_STORYBOARD_CONFIRMATION_REQUIRED");
  assert.equal(providerCalls, 0);

  confirmXhsVisualStoryboard(task, { confirmedBy: "xhs_visual_self_test", note: "固定八页回放确认" });
  const generation = await generateContentAssets(task, { root, generateImage: async ({ prompt }) => {
    providerCalls += 1;
    assert.match(prompt, /no text/i);
    assert.match(prompt, /no logo/i);
    assert.match(prompt, /no watermark/i);
    return { status: "succeeded", imageUrl: `data:image/png;base64,${paddedPng}`, provider: "fixture", taskId: "fixture_1", model: "fixture" };
  } });
  assert.equal(providerCalls, 1);
  assert.equal(generation.summary.succeeded, 1);

  const delivery = await renderContentDelivery(task, { root });
  assert.equal(delivery.status, "visual_review");
  assert.equal(delivery.validation.status, "waiting_human_confirmation");
  assert.deepEqual(delivery.validation.pending, ["post_render_pixel_semantics"]);
  assert.equal(delivery.rendered.length, 8);
  assert.equal(new Set(delivery.rendered.map((item) => item.layoutType)).size, 8);
  for (const [index, rendered] of delivery.rendered.entries()) {
    const html = await readFile(join(root, rendered.htmlPath), "utf8");
    assert.ok(html.includes(task.visualStoryboard.pages[index].headline), `P${index + 1} should render its own headline`);
    if (index > 0) assert.ok(html.includes(task.visualStoryboard.pages[index].bodyItems[0]), `P${index + 1} should render its own body`);
  }
  const manifestBeforeConfirmation = JSON.parse(await readFile(join(root, delivery.manifestPath), "utf8"));
  assert.equal(manifestBeforeConfirmation.schema, "FlowSocialDeliveryManifest@2.0");
  assert.equal(manifestBeforeConfirmation.storyboard.pages.length, 8);
  assert.equal(manifestBeforeConfirmation.renderInputs.length, 8);
  assert.equal(manifestBeforeConfirmation.postRenderVisualConfirmation, null);
  assert.equal(manifestBeforeConfirmation.validation.status, "waiting_human_confirmation");
  const automatedReview = await reviewRenderedXhsTask(task, { root, generateText: async () => { throw new Error("offline visual provider"); } });
  assert.equal(automatedReview.status, "waiting_human_confirmation");
  assert.equal(automatedReview.data.decision, "pending_human_confirmation");
  assert.equal(automatedReview.humanConfirmationRequired, true);
  await assert.rejects(() => createDeliveryZip(task, { root }), (error) => error.code === "XHS_POST_RENDER_CONFIRMATION_REQUIRED");

  task.visualQualityConfirmation = { version: 2, decision: "approved", confirmedBy: "xhs_visual_self_test", confirmedAt: new Date().toISOString(), pixelAndSemanticReviewed: true };
  task.delivery = null;
  const zip = await createDeliveryZip(task, { root });
  assert.ok((await stat(zip.path)).size > 0);
  const finalManifest = JSON.parse(await readFile(join(root, task.delivery.manifestPath), "utf8"));
  assert.equal(finalManifest.postRenderVisualConfirmation.decision, "approved");
  assert.equal(finalManifest.storyboard.confirmation.decision, "confirmed");
  assert.equal(finalManifest.validation.status, "passed");
  assert.deepEqual(finalManifest.validation.pending, []);

  const legacyTask = structuredClone(task);
  legacyTask.id = "legacy_content_package";
  legacyTask.version = 1;
  legacyTask.visualStoryboard = null;
  legacyTask.currentContent.deck.pages[1] = { page_id: "P2", page_number: 2, page_role: "pain", supporting_text: "只有正文，没有独立标题", text_layers: [{ type: "body", text: "旧包正文" }] };
  const legacyStoryboard = createXhsVisualStoryboard(legacyTask);
  assert.equal(legacyStoryboard.pages[1].headline, "");
  assert.notEqual(legacyStoryboard.pages[1].headline, legacyTask.currentContent.post_copy.recommended_title);
  assert.equal(validateXhsVisualStoryboard(legacyStoryboard).checks.find((item) => item.check === "non_cover_headline_and_body").result, "fail");

  const htmlOnlyTask = structuredClone(task);
  htmlOnlyTask.id = "content_xhs_html_only_recovery";
  htmlOnlyTask.delivery = null;
  htmlOnlyTask.visualQualityConfirmation = null;
  htmlOnlyTask.visualStoryboard.pages = htmlOnlyTask.visualStoryboard.pages.map((page) => ({ ...page, renderStrategy: "html_css" }));
  htmlOnlyTask.visualStoryboard.pages[3].bodyItems = ["1. 策略", "2. 内容", "3. 发布"];
  htmlOnlyTask.visualStoryboard.pages[7].bodyItems = ["• 企业微信", "• 官网表单", "• 30 分钟诊断"];
  const htmlOnlyDelivery = await renderContentDelivery(htmlOnlyTask, { root });
  const htmlOnlyCover = await readFile(join(root, htmlOnlyDelivery.rendered[0].htmlPath), "utf8");
  const normalizedFlow = await readFile(join(root, htmlOnlyDelivery.rendered[3].htmlPath), "utf8");
  const normalizedCta = await readFile(join(root, htmlOnlyDelivery.rendered[7].htmlPath), "utf8");
  assert.doesNotMatch(htmlOnlyCover, /url\('file:/, "HTML/CSS recovery must not reuse a rejected generated asset");
  assert.match(normalizedFlow, /<i>1<\/i><span>策略<\/span>/, "flow template must not repeat source numbering");
  assert.doesNotMatch(normalizedFlow, /<span>1\.\s*策略<\/span>/);
  assert.match(normalizedCta, /<div>企业微信<\/div><div>官网表单<\/div><div>30 分钟诊断<\/div>/, "CTA items must render as separate rows");

  const preserved = updateXhsVisualStoryboard(task, { pages: [{ pageId: "P2", headline: "修改后的痛点标题" }] });
  assert.equal(preserved.pages[1].visualDescription.length > 0, true);
  assert.equal(preserved.pages[1].headline, "修改后的痛点标题");

  console.log(JSON.stringify({ status: "passed", pages: 8, layouts: 8, generatedRasterAssets: generation.summary.succeeded, manifestSchema: finalManifest.schema }));
} finally {
  await rm(root, { recursive: true, force: true });
}
