import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  adaptLegacyDeliveryBundleReadOnly,
  buildPlatformDeliveryBundle,
  buildWechatPlatformDeliveryBundle,
  buildXiaohongshuPlatformDeliveryBundle,
  validatePlatformDeliveryBundle
} from "../../content-agent/platform-delivery-bundle.mjs";

const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const ref = (id) => ({ id, hash: hash(id) });
const platformVersionRef = ref("platform-version:xhs:17");
const selectedRevisionRefs = [ref("revision:P1:4"), ref("revision:P2:7")];
const readyStates = {
  machineReview: { status: "passed", ref: ref("machine-review:17") },
  editorialReview: { status: "passed", ref: ref("editorial-review:17") },
  userSelection: { status: "selected", ref: ref("user-selection:17") },
  promotion: { status: "promoted", ref: ref("promotion:17") },
  publication: { status: "not_published", ref: null }
};

const xhsInput = {
  schemaVersion: "1.0",
  platform: "xiaohongshu",
  platformVersionRef,
  promotedVersionRef: platformVersionRef,
  states: readyStates,
  providerEvidence: { status: "succeeded", mode: "offline_fixture", published: false },
  selection: { pageRevisionRefs: selectedRevisionRefs },
  copy: {
    title: "一套内容，两个平台怎么改",
    body: "这是可直接复制的小红书正文。\n第二段保持原样。",
    tags: ["内容运营", "工作流"],
    pinnedComment: "你最想先改哪个环节？"
  },
  pages: [
    { pageId: "P1", revisionRef: selectedRevisionRefs[0], fileName: "01_cover.png", bytes: Buffer.from("selected-page-one") },
    { pageId: "P2", revisionRef: selectedRevisionRefs[1], fileName: "02_detail.png", bytes: Buffer.from("selected-page-two") }
  ]
};

const xhs = buildXiaohongshuPlatformDeliveryBundle(xhsInput);
validatePlatformDeliveryBundle(xhs);
assert.equal(xhs.manifest.claims.deliveryReady, true);
assert.equal(xhs.manifest.claims.published, false);
assert.equal(xhs.manifest.claims.platformPublicationPerformed, false);
assert.deepEqual(xhs.files.map((item) => item.path), [
  "copy/title.txt",
  "copy/body.txt",
  "copy/tags.txt",
  "copy/pinned-comment.txt",
  "images/01_cover.png",
  "images/02_detail.png",
  "manifest.json"
]);
assert.deepEqual(xhs.manifest.files.filter((item) => item.kind === "selected_page_image").map((item) => item.bindings.revisionRef), selectedRevisionRefs);
assert.equal(buildPlatformDeliveryBundle(xhsInput).bundleHash, xhs.bundleHash, "same input must produce the same final bundle hash");
assert.equal(buildPlatformDeliveryBundle(xhsInput).manifest.manifestHash, xhs.manifest.manifestHash, "same input must produce the same manifest hash");
for (const file of xhs.files) {
  const bytes = typeof file.content === "string" ? Buffer.from(file.content) : Buffer.from(file.content);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `${file.path} must carry a deterministic hash`);
}

assert.throws(() => buildXiaohongshuPlatformDeliveryBundle({
  ...xhsInput,
  pages: [{ ...xhsInput.pages[0], revisionRef: ref("revision:P1:not-selected") }, xhsInput.pages[1]]
}), (error) => error.code === "XHS_DELIVERY_REVISION_SELECTION_MISMATCH");

const unselected = buildXiaohongshuPlatformDeliveryBundle({
  ...xhsInput,
  promotedVersionRef: null,
  states: {
    ...readyStates,
    userSelection: { status: "not_selected", ref: null },
    promotion: { status: "not_promoted", ref: null }
  },
  providerEvidence: { status: "succeeded", mode: "live_provider", published: true }
});
assert.equal(unselected.manifest.claims.deliveryReady, false);
assert.equal(unselected.manifest.claims.published, false);
assert.ok(unselected.manifest.states.blockers.includes("user_not_selected"));
assert.ok(unselected.manifest.states.blockers.includes("version_not_promoted"));

const wechatVersionRef = ref("platform-version:wechat:9");
const wechatInput = {
  schemaVersion: "1.0",
  platform: "wechat",
  platformVersionRef: wechatVersionRef,
  promotedVersionRef: wechatVersionRef,
  states: {
    ...readyStates,
    machineReview: { status: "passed", ref: ref("machine-review:wechat:9") },
    editorialReview: { status: "passed", ref: ref("editorial-review:wechat:9") },
    userSelection: { status: "selected", ref: ref("user-selection:wechat:9") },
    promotion: { status: "promoted", ref: ref("promotion:wechat:9") }
  },
  providerEvidence: null,
  title: "公众号交付模板",
  articleMarkdown: "# 公众号交付模板\n\n正文不依赖包外文件。",
  uploadTemplateHtml: '<section><h1>公众号交付模板</h1><img src="assets/cover.png"><img src="assets/chart.png"></section>',
  resources: [
    { assetId: "cover", role: "cover", path: "assets/cover.png", bytes: Buffer.from("wechat-cover-image") },
    { assetId: "chart", role: "inline", path: "assets/chart.png", bytes: Buffer.from("wechat-inline-image") }
  ],
  uploadPlan: {
    steps: [
      { assetId: "cover", role: "cover", localPath: "assets/cover.png" },
      { assetId: "chart", role: "inline", localPath: "assets/chart.png", replaceHtmlSrc: "assets/chart.png" }
    ]
  }
};

const wechat = buildWechatPlatformDeliveryBundle(wechatInput);
validatePlatformDeliveryBundle(wechat);
assert.equal(wechat.manifest.deliverySemantics, "wechat_pre_upload_template_requires_resource_upload");
assert.equal(wechat.manifest.claims.platformUploadPerformed, false);
assert.equal(wechat.manifest.resourceRequirements.length, 2);
assert.ok(wechat.files.find((item) => item.path === "RESOURCE_UPLOAD_CHECKLIST.md").content.includes("上传前模板，不是可直接发布成品"));
assert.equal(wechat.files.find((item) => item.path === "wechat-upload-template.html").bindings.publishableAsIs, false);

assert.throws(() => buildWechatPlatformDeliveryBundle({
  ...wechatInput,
  resources: wechatInput.resources.slice(0, 1),
  uploadPlan: { steps: wechatInput.uploadPlan.steps.slice(0, 1) }
}), (error) => error.code === "WECHAT_DELIVERY_SILENT_EXTERNAL_RESOURCE");

const uploaded = buildWechatPlatformDeliveryBundle({
  ...wechatInput,
  uploadedFinalHtml: '<section><h1>公众号交付模板</h1><img src="https://mmbiz.qpic.cn/uploaded/chart.png"></section>',
  uploadEvidenceRef: ref("wechat-upload-evidence:9")
});
assert.equal(uploaded.manifest.deliverySemantics, "wechat_post_upload_content_not_platform_publication");
assert.equal(uploaded.manifest.claims.published, false);
assert.equal(uploaded.files.find((item) => item.path === "wechat-uploaded-final.html").bindings.platformPublished, false);

const legacyInput = { id: "legacy-package-1", platform: "xiaohongshu", packageStatus: "prepared" };
const before = JSON.stringify(legacyInput);
const legacy = adaptLegacyDeliveryBundleReadOnly(legacyInput);
assert.equal(legacy.deliverySemantics, "legacy_delivery_semantics");
assert.equal(legacy.deliveryReady, false);
assert.equal(legacy.published, false);
assert.equal(JSON.stringify(legacyInput), before);
assert.ok(Object.isFrozen(legacy));
assert.ok(Object.isFrozen(legacy.blockers));

console.log(JSON.stringify({
  status: "platform delivery bundle self-test passed",
  xiaohongshu: { files: xhs.files.length, manifestHash: xhs.manifest.manifestHash, bundleHash: xhs.bundleHash },
  wechat: { files: wechat.files.length, requirements: wechat.manifest.resourceRequirements.length, bundleHash: wechat.bundleHash },
  safeguards: ["provider_success_is_not_publication", "not_selected_is_not_delivery_ready", "wechat_template_resources_are_explicit"]
}, null, 2));
