import assert from "node:assert/strict";
import { applyValidatedOperations, validateRevisionChange } from "../../content-agent/patch-engine.mjs";

const v1 = {
  post_copy: {
    recommended_title: "先把内容系统搭起来",
    opening: "起号不是每天临时想题。",
    body_sections: [{ heading: "第一步", content: "先明确读者问题。" }],
    ending: "今天先完成第一步。",
    cta: "收藏后照着做。",
    hashtags: ["内容运营"]
  },
  deck: { pages: Array.from({ length: 6 }, (_, index) => ({ page_id: `P${index + 1}`, headline: `第${index + 1}页` })) }
};

const unchanged = validateRevisionChange("xiaohongshu", "内容太少，请扩写", v1, structuredClone(v1));
assert.equal(unchanged.accepted, false);
assert.equal(unchanged.code, "REVISION_NO_CONTENT_CHANGE");

const metadataOnly = structuredClone(v1);
metadataOnly.generated_note = "模型声称已经扩写";
const fakeVersion = validateRevisionChange("xiaohongshu", "调整一下", v1, metadataOnly);
assert.equal(fakeVersion.accepted, false);
assert.equal(fakeVersion.code, "REVISION_NO_CONTENT_CHANGE");

const shorter = structuredClone(v1);
shorter.post_copy.body_sections[0].content = "明确问题。";
const invalidExpansion = validateRevisionChange("xiaohongshu", "内容太少，请扩写", v1, shorter);
assert.equal(invalidExpansion.accepted, false);
assert.equal(invalidExpansion.code, "REVISION_EXPANSION_NOT_APPLIED");

const operations = [{
  op: "replace",
  path: "/post_copy/body_sections/0/content",
  value: "先明确读者正在经历的具体问题，再把你的经验拆成能立即执行的三个步骤。每一步都说明适用条件、操作方式和常见误区，让读者不需要猜测下一步。"
}];
const patched = applyValidatedOperations(v1, operations, { allowedPrefixes: ["/post_copy"], lockedPrefixes: [] });
const validExpansion = validateRevisionChange("xiaohongshu", "内容太少，请扩写", v1, patched.content);
assert.equal(validExpansion.accepted, true);
assert.equal(validExpansion.change.bodyChanged, true);
assert.ok(validExpansion.change.bodyLengthDelta > 0);
assert.notEqual(validExpansion.change.beforeFingerprint, validExpansion.change.afterFingerprint);
assert.ok(validExpansion.change.changedPaths.includes("/post_copy/body_sections/0/content"));

const persistedVersions = [{ version: 1, content: v1 }];
if (validExpansion.accepted) persistedVersions.push({ version: 2, parentVersion: 1, content: patched.content, change: validExpansion.change });
assert.equal(persistedVersions.length, 2);
assert.notDeepEqual(persistedVersions[0].content, persistedVersions[1].content);
assert.equal(persistedVersions[1].change.bodyLengthDelta, validExpansion.change.bodyLengthDelta);

const wechatBefore = { recommended_title: "标题", article_markdown: "## 第一节\n正文", image_plan: { cover: { prompt: "旧封面" }, slots: [] } };
const wechatAfter = structuredClone(wechatBefore);
wechatAfter.image_plan.cover.prompt = "新封面";
const validVisualChange = validateRevisionChange("wechat", "调整封面视觉", wechatBefore, wechatAfter);
assert.equal(validVisualChange.accepted, true, "image-only revisions must create a version when the scoped image plan changed");
assert.equal(validVisualChange.change.bodyChanged, false, "image-only revisions must not claim article text changed");

console.log("content revision self-test passed", {
  version: persistedVersions[1].version,
  bodyLengthDelta: validExpansion.change.bodyLengthDelta,
  changedPaths: validExpansion.change.changedPaths
});
