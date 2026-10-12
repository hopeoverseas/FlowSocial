import assert from "node:assert/strict";
import {
  buildWechatArticleRecoveryPrompt,
  validateWechatArticleForProduction,
  WECHAT_ARTICLE_MIN_CHARS,
  WECHAT_ARTICLE_MIN_H2_SECTIONS,
  WECHAT_ARTICLE_RECOVERY_CHAR_SAFETY_MARGIN,
  WECHAT_ARTICLE_RECOVERY_TARGET_CHARS
} from "../../content-engine.mjs";

function markdownWithExactLength(length, h2Count = WECHAT_ARTICLE_MIN_H2_SECTIONS) {
  const headings = Array.from({ length: h2Count }, (_, index) => `## 第${index + 1}节\n`).join("\n");
  assert.ok(headings.length <= length);
  return `${headings}${"正".repeat(length - headings.length)}`;
}

function articleAtLength(length, h2Count = WECHAT_ARTICLE_MIN_H2_SECTIONS) {
  return {
    status: "success",
    data: {
      article_markdown: markdownWithExactLength(length, h2Count),
      title_candidates: ["标题一", "标题二", "标题三"],
      outline: Array.from({ length: Math.max(h2Count, 3) }, (_, index) => ({ heading: `第${index + 1}节` })),
      information_gain: "提供足够明确且可验证的信息增量说明",
      image_plan: { cover: { purpose: "封面" }, slots: [{ slot_purpose: "正文" }] }
    }
  };
}

assert.equal(WECHAT_ARTICLE_MIN_CHARS, 1200, "the existing production Gate must not be lowered");
assert.equal(WECHAT_ARTICLE_RECOVERY_TARGET_CHARS, WECHAT_ARTICLE_MIN_CHARS + WECHAT_ARTICLE_RECOVERY_CHAR_SAFETY_MARGIN);
assert.equal(WECHAT_ARTICLE_RECOVERY_TARGET_CHARS, 1600);

const prompt = buildWechatArticleRecoveryPrompt({
  topicTitle: "离线长度安全余量",
  intentProfile: {},
  master: {},
  confirmed_outline: { sections: [{ heading: "一" }, { heading: "二" }, { heading: "三" }] },
  output_shape: { status: "success", data: { article_markdown: "" } },
  hard_requirements: { article_markdown_min_chars: WECHAT_ARTICLE_MIN_CHARS }
});
assert.equal(prompt.hard_requirements.article_markdown_min_chars, WECHAT_ARTICLE_RECOVERY_TARGET_CHARS);
assert.equal(prompt.hard_requirements.article_markdown_quality_gate_min_chars, WECHAT_ARTICLE_MIN_CHARS);
assert.equal(prompt.hard_requirements.h2_sections_min, WECHAT_ARTICLE_MIN_H2_SECTIONS);
assert.match(prompt.instruction, /净正文目标不少于 1600 个字符/);
assert.match(prompt.instruction, /生产质量 Gate 仍为 1200 个字符/);

for (const length of [1123, 1199]) {
  const result = validateWechatArticleForProduction(articleAtLength(length));
  assert.equal(result.valid, false, `${length} characters must remain blocked`);
  assert.ok(result.blockers.includes("continuous_article_structure"));
  assert.equal(result.metrics.articleCharacters, length);
}

const minimumPassing = validateWechatArticleForProduction(articleAtLength(WECHAT_ARTICLE_MIN_CHARS));
assert.equal(minimumPassing.valid, true, "the unchanged length and H2 Gate must pass at its boundary");
assert.equal(minimumPassing.metrics.h2Sections, WECHAT_ARTICLE_MIN_H2_SECTIONS);

const insufficientH2 = validateWechatArticleForProduction(articleAtLength(WECHAT_ARTICLE_RECOVERY_TARGET_CHARS, WECHAT_ARTICLE_MIN_H2_SECTIONS - 1));
assert.equal(insufficientH2.valid, false, "length safety margin must not bypass the H2 Gate");
assert.ok(insufficientH2.blockers.includes("continuous_article_structure"));

assert.equal(globalThis.__wechatLengthSafetyNetworkCalls || 0, 0);
console.log(JSON.stringify({
  status: "wechat-article-length-safety-self-test passed",
  productionMinChars: WECHAT_ARTICLE_MIN_CHARS,
  recoveryTargetChars: WECHAT_ARTICLE_RECOVERY_TARGET_CHARS,
  providerCalls: 0,
  networkCalls: 0,
  productionWrites: 0
}, null, 2));
