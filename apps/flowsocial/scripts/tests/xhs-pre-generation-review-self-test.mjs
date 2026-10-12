import assert from "node:assert/strict";
import { projectUnifiedXhsPreGenerationReview } from "../../content-agent/unified-content-xhs-production-state.mjs";

const authority = {
  payload: {
    components: {
      postCopy: {
        contentPromise: "This historical metadata stays immutable but is not publishable copy.",
        recommendedTitle: "先看中文标题，再决定是否生图",
        opening: "这是中文开场。",
        bodySections: [{ text: "这是中文正文。" }],
        ending: "这是中文结尾。",
        hashtags: ["小红书制作"],
        cta: "确认后再生图。"
      },
      carouselPlan: {
        pages: [{ page: 1, role: "cover", text_layers: [{ type: "headline", text: "第一页中文标题" }, { type: "label", text: "HOOK · 老板的共同困境" }] }]
      }
    }
  }
};
const promptSet = {
  visualStyleSelection: { constraints: ["品牌色锚点：#D71018"] },
  pagePromptSpecs: [{
    pageId: "P1",
    promptBlocks: {
      verbatimText: ["第一页中文标题", "HOOK · 老板的共同困境"],
      composition: ["标题居中"],
      style: ["克制的信息卡"],
      negativeConstraints: ["不要英文句子"]
    },
    providerRequest: { secret: "must-not-project" }
  }]
};

const review = projectUnifiedXhsPreGenerationReview(authority, promptSet);
assert.equal(review.copy.title, "先看中文标题，再决定是否生图");
assert.equal(review.copy.bodySections[0].text, "这是中文正文。");
assert.equal(review.pages[0].textLayers[0].text, "第一页中文标题");
assert.equal(review.pages[0].textLayers[1].text, "老板的共同困境");
assert.deepEqual(review.prompts[0].requiredText, ["第一页中文标题", "老板的共同困境"]);
assert.deepEqual(review.prompts[0].creativeConcept, ["克制的信息卡"]);
assert.match(review.brandColorUsage, /#D71018.*少量品牌识别色/);
assert.match(review.creativePrinciple, /不套固定封面、信息卡或视觉识别手册模板/);
assert.ok(!JSON.stringify(review).includes("historical metadata"));
assert.ok(!JSON.stringify(review).includes("must-not-project"));
console.log(JSON.stringify({ status: "xhs-pre-generation-review-self-test passed", providerCalls: 0, networkCalls: 0, databaseWrites: 0 }));
