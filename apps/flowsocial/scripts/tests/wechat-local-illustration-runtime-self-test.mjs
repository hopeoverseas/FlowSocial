import assert from "node:assert/strict";
import { buildLocalWechatImagePlan, createLocalWechatIllustrationResolver, formatWechatIllustratedHtml } from "../../content-agent/wechat-local-illustration-runtime.mjs";

const article = {
  recommended_title: "AI落地四步法",
  core_argument: "AI落地不是一次采购，而是诊断、试点、验证和复制的闭环。",
  article_markdown: "## 第一步：诊断场景\n先找到真正值得解决的问题。\n\n## 第二步：准备数据\n从一个具体场景开始。\n\n## 第三步：小步试点\n用业务指标判断效果。",
  outline: [
    { section_id: "W1", heading: "第一步：诊断场景" },
    { section_id: "W2", heading: "第二步：准备数据" },
    { section_id: "W3", heading: "第三步：小步试点" }
  ]
};

const plan = buildLocalWechatImagePlan(article, { planId: "wechat-plan:test" });
assert.equal(plan.status, "success");
assert.equal(plan.data.cover.strategy, "html_chart");
assert.equal(plan.data.slots.length, 3);
assert.equal(plan.data.slots.every((slot) => slot.strategy === "html_chart"), true);
assert.equal(plan.warnings.length, 0);

const declaration = {
  slotId: "cover", role: "cover", afterSectionId: null, purpose: "mood", strategy: "html_chart", assetId: "wechat_cover_card"
};
const resolved = await createLocalWechatIllustrationResolver()({ declaration, article });
assert.equal(resolved.extension, ".png");
assert.equal(Buffer.isBuffer(resolved.bytes), true);
assert.equal(resolved.bytes.subarray(1, 4).toString("ascii"), "PNG");
assert.equal(resolved.evidence.deterministic, true);
assert.equal(resolved.evidence.definition.externalProviderCalls, 0);
assert.equal(resolved.evidence.definition.visibleTextPolicy, "content_derived_short_labels");
assert.equal(resolved.evidence.definition.visualType, "article_concept_map");
assert.notEqual(resolved.evidence.definition.summary, article.recommended_title);
assert.equal(resolved.evidence.definition.labels.includes("AI落地四步法"), false);

const canonicalPlan = {
  slots: plan.data.slots.map((slot) => ({ slotId: slot.slot_id, afterSectionId: slot.after_section_id }))
};
const resources = [
  { slotId: "cover", relativePath: "assets/wechat_cover_card.png" },
  ...plan.data.slots.map((slot) => ({ slotId: slot.slot_id, relativePath: `assets/${slot.asset_id}.png` }))
];
const formatted = await formatWechatIllustratedHtml({ article, canonicalPlan, resources });
assert.match(formatted, /assets\/wechat_cover_card\.png/);
assert.equal((formatted.match(/<img /g) || []).length, 4);
assert.match(formatted, /第一步：诊断场景/);
assert.doesNotMatch(formatted, /<script|https?:\/\//i);

console.log(JSON.stringify({ status: "wechat-local-illustration-runtime-self-test passed", images: 4, providerCalls: 0 }));
