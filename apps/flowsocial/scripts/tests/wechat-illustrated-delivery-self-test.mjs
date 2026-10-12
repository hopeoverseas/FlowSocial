import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeliveryZip, renderContentDelivery, verifyDeliveryZipContents } from "../../artifact-engine.mjs";
import { applyWechatUploadResults, evaluateWechatIllustratedQualityGates, validateWechatIllustratedOutput, validateWechatImagePlan, wechatIllustratedDeliveryEnabled } from "../../content-agent/wechat-illustrated-delivery.mjs";
import { adaptWechatImagePlanOutput } from "../../content-agent/wechat-image-plan-adapter.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = join(root, "scripts", "fixtures", "wechat-illustrated-delivery");
const source = JSON.parse(await readFile(join(fixtureRoot, "source-task.json"), "utf8"));
const historicalArticle = (await readFile(join(fixtureRoot, "source-article.md"), "utf8")).replace(/\r\n/g, "\n").replace(/\n$/, "");
const historicalSha256 = createHash("sha256").update(historicalArticle).digest("hex");
const expectedHistoricalSha256 = "5814dda04f4b8e11957780f7288f79fef5e151777c136a68ca4e71c6c516d1c6";
assert.equal(historicalSha256, expectedHistoricalSha256, "frozen historical article must remain byte-identical after fixture newline normalization");
assert.equal(historicalArticle.length, 1879);
assert.equal((historicalArticle.match(/^##\s+/gm) || []).length, 6);

const task = () => {
  const value = structuredClone(source.task);
  value.currentContent.article_markdown = historicalArticle;
  value.status = "succeeded";
  value.qualityReview = { status: "passed", blockers: [] };
  return value;
};

delete process.env.WECHAT_ILLUSTRATED_DELIVERY_V1;
assert.equal(wechatIllustratedDeliveryEnabled(), false, "illustrated delivery Feature Flag must default off");

const valid = task();
const planValidation = validateWechatImagePlan(valid);
assert.equal(planValidation.status, "passed");
assert.equal(valid.currentContent.image_plan.slots.length, 4);

const legacyProviderBindings = task();
legacyProviderBindings.currentContent.claim_map = [];
legacyProviderBindings.confirmedOutline.sections.forEach((section) => { section.claim_ids = []; });
legacyProviderBindings.currentContent.image_plan.slots.forEach((slot, index) => {
  slot.after_section_id = `W${index + 1}`;
  slot.claim_ids = [`O00${index + 1}`];
});
const legacyBindingValidation = validateWechatImagePlan(legacyProviderBindings);
assert.equal(legacyBindingValidation.status, "passed");
assert.equal(legacyBindingValidation.canonicalPlan.slots[0].afterSectionId, legacyProviderBindings.confirmedOutline.sections[0].section_id);
assert.deepEqual(legacyBindingValidation.canonicalPlan.slots[0].claimIds, []);

const unknownAnchor = task();
unknownAnchor.currentContent.image_plan.slots[0].after_section_id = "UNKNOWN";
assert.ok(validateWechatImagePlan(unknownAnchor).blockers.includes("slot_section_anchor"));

const changedHeading = task();
changedHeading.currentContent.article_markdown = changedHeading.currentContent.article_markdown.replace("## 问题：资料堆积如山，但AI仍未进入业务流程", "## 被改写的历史标题");
assert.ok(validateWechatImagePlan(changedHeading).blockers.includes("section_heading_to_id_mapping"));

const duplicateSlot = task();
duplicateSlot.currentContent.image_plan.slots[1].slot_id = duplicateSlot.currentContent.image_plan.slots[0].slot_id;
assert.ok(validateWechatImagePlan(duplicateSlot).blockers.includes("unique_slot_id"));

const noPurpose = task();
noPurpose.currentContent.image_plan.slots[0].purpose = "";
assert.ok(validateWechatImagePlan(noPurpose).blockers.includes("slot_purpose"));

const pathTraversal = task();
pathTraversal.currentContent.image_plan.slots[0].asset_id = "../../outside";
assert.equal(validateWechatImagePlan(pathTraversal).status, "passed");
const canonicalTraversal = adaptWechatImagePlanOutput(pathTraversal.currentContent.image_plan);
assert.match(canonicalTraversal.slots[0].assetId, /^wechat_/);
assert.doesNotMatch(canonicalTraversal.slots[0].assetId, /\.\.|[\\/]/);

const forgedClaim = task();
forgedClaim.currentContent.image_plan.slots[0].claim_ids = ["F999"];
assert.ok(validateWechatImagePlan(forgedClaim).blockers.includes("slot_claim_binding"));

const crossSectionClaim = task();
crossSectionClaim.currentContent.image_plan.slots[0].claim_ids = ["F001"];
assert.ok(validateWechatImagePlan(crossSectionClaim).blockers.includes("slot_claim_binding"));

const privateSource = task();
privateSource.currentContent.source_list.find((item) => item.source_id === "T3").visibility = "private";
assert.ok(validateWechatImagePlan(privateSource).blockers.includes("slot_claim_binding"));

const runRoot = join(root, ".tmp", "fs-v1-wechat-content-12", `self-test-${Date.now()}`);
await mkdir(runRoot, { recursive: true });
process.env.WECHAT_ILLUSTRATED_DELIVERY_V1 = "1";
const delivery = await renderContentDelivery(valid, { root: runRoot });
assert.equal(delivery.status, "ready");
assert.equal(delivery.validation.status, "passed");
assert.equal(delivery.rendered[0].imageAssets.length, 5);
assert.equal(valid.wechatIllustratedQualityReport.gates.ocr, "passed");
assert.equal(valid.wechatIllustratedQualityReport.gates.fact, "passed");
assert.equal(valid.wechatIllustratedQualityReport.gates.license, "passed");
assert.equal(valid.wechatIllustratedQualityReport.gates.visual, "passed");
assert.equal(valid.wechatIllustratedQualityReport.gates.mobile, "passed");
assert.equal(valid.wechatIllustratedQualityReport.gates.upload, "not_executed_offline_adapter_only");
assert.equal(valid.wechatDraftUploadPlan.steps.filter((item) => item.role === "cover")[0].requiredResultField, "media_id");
assert.ok(valid.wechatDraftUploadPlan.steps.filter((item) => item.role === "inline").every((item) => item.requiredResultField === "url" && item.endpointRole === "uploadimg"));

const versionRoot = join(runRoot, "artifacts", valid.id, `v${valid.version}`);
const renderedArticle = await readFile(join(versionRoot, "article.md"), "utf8");
assert.equal(renderedArticle, historicalArticle, "illustrated delivery must not rewrite the historical article");
const paste = await readFile(join(versionRoot, "wechat-paste.html"), "utf8");
assert.equal((paste.match(/<figure\b/g) || []).length, 5);
assert.equal((paste.match(/<img\b/g) || []).length, 5);
assert.equal((paste.match(/<figcaption\b/g) || []).length, 5);
assert.equal(/(?:src|href)=["']https?:/i.test(paste), false);
assert.equal(/<script\b/i.test(paste), false);
for (const asset of valid.wechatIllustratedAssets) {
  const info = await stat(join(versionRoot, asset.path));
  assert.ok(info.isFile() && info.size === asset.bytes && info.size > 1024);
}
assert.ok((await stat(join(versionRoot, "wechat-mobile-preview-390.png"))).size > 1024);

const manifest = JSON.parse(await readFile(join(versionRoot, "manifest.json"), "utf8"));
assert.equal(manifest.wechatIllustratedDelivery.assets.length, 5);
assert.equal(manifest.assetCoverage.completed, 5);
assert.equal(manifest.humanConfirmationRequired, true);
assert.equal(manifest.wechatIllustratedDelivery.draftUploadPlan.autoPublish, false);
assert.equal(manifest.wechatIllustratedDelivery.draftUploadPlan.productionWrite, false);

const packaged = await createDeliveryZip(valid, { root: runRoot });
const zipBytes = await readFile(packaged.path);
assert.equal(zipBytes.subarray(0, 4).toString("hex"), "504b0304");
assert.equal(createHash("sha256").update(zipBytes).digest("hex"), packaged.sha256);
assert.ok(packaged.bytes > valid.wechatIllustratedAssets.reduce((sum, item) => sum + item.bytes, 0) / 4);
assert.equal(packaged.verification.status, "passed");
assert.equal(packaged.verification.memberCount, manifest.files.length + 1);
assert.equal(verifyDeliveryZipContents(zipBytes, manifest).status, "passed");
const tamperedManifest = structuredClone(manifest);
tamperedManifest.files[0].sha256 = "0".repeat(64);
assert.throws(() => verifyDeliveryZipContents(zipBytes, tamperedManifest), (error) => ["DELIVERY_ZIP_MANIFEST_MISMATCH", "DELIVERY_ZIP_MEMBER_SHA_MISMATCH"].includes(error.code));

const uploadResults = valid.wechatDraftUploadPlan.steps.map((step) => step.role === "cover"
  ? { assetId: step.assetId, role: "cover", kind: "permanent_material_image", media_id: "offline_cover_media_id" }
  : { assetId: step.assetId, role: "inline", kind: "uploadimg", url: `https://mmbiz.qpic.cn/offline-fixture/${step.assetId}.png` });
const uploadProjection = applyWechatUploadResults(paste, valid.wechatDraftUploadPlan, uploadResults);
assert.equal(uploadProjection.status, "ready_for_draft_create");
assert.equal(uploadProjection.thumb_media_id, "offline_cover_media_id");
assert.equal(uploadProjection.replacedInlineImages, 4);
assert.equal(/src=["']assets\//.test(uploadProjection.html), false);
assert.equal(uploadProjection.html.includes("offline_cover_media_id"), false, "cover media_id must not enter article HTML");
assert.equal((uploadProjection.html.match(/<figure\b/g) || []).length, 4, "cover is a draft thumb, not an inline image");
assert.throws(() => applyWechatUploadResults(paste, valid.wechatDraftUploadPlan, uploadResults.map((item, index) => index === 0 ? { ...item, role: "inline", kind: "uploadimg", url: "https://mmbiz.qpic.cn/wrong.png" } : item)), (error) => error.code === "WECHAT_UPLOAD_ADAPTER_INVALID");
assert.throws(() => applyWechatUploadResults(paste, valid.wechatDraftUploadPlan, uploadResults.map((item, index) => index === 1 ? { assetId: item.assetId, role: "inline", kind: "uploadimg", media_id: "wrong_inline_media" } : item)), (error) => error.code === "WECHAT_UPLOAD_ADAPTER_INVALID");
assert.throws(() => applyWechatUploadResults(paste, valid.wechatDraftUploadPlan, uploadResults.map((item, index) => index === 1 ? { ...item, url: "https://example.com/not-uploadimg.png" } : item)), (error) => error.code === "WECHAT_UPLOAD_ADAPTER_INVALID");

for (const gate of ["ocr", "fact", "license", "visual", "mobile"]) {
  const records = structuredClone(valid.wechatIllustratedAssets);
  records[0].quality[gate] = "needs_review";
  const evaluated = evaluateWechatIllustratedQualityGates(records);
  assert.equal(evaluated.status, "blocked", `${gate} must hard-block illustrated delivery`);
  assert.ok(evaluated.blockers.includes(gate));
}

const authorizedSource = valid.wechatIllustratedAssets.find((item) => item.slotId === "WS01");
const authorizedRelativePath = relative(runRoot, join(versionRoot, authorizedSource.path)).replace(/\\/g, "/");
const authorized = task();
authorized.id = "content_68a13675_authorized_asset";
authorized.currentContent.image_plan.slots[0].strategy = "authorized_asset";
authorized.currentContent.image_plan.slots[0].asset_id = "authorized-symptom-map";
authorized.wechatAssetRegistry = { assets: [{ assetId: "authorized-symptom-map", status: "approved", relativePath: authorizedRelativePath, license: { id: "owner-license-01", allowsPublication: true }, source: { ref: "fixture://approved-symptom-map", sha256: authorizedSource.sha256 }, qualityReview: { ocr: "passed", fact: "passed", visual: "passed" } }] };
const authorizedDelivery = await renderContentDelivery(authorized, { root: runRoot });
assert.equal(authorizedDelivery.status, "ready");
const authorizedRecord = authorized.wechatIllustratedAssets.find((item) => item.assetId === "authorized-symptom-map");
assert.equal(authorizedRecord.quality.license, "passed_registry_license_and_source");
assert.equal(authorizedRecord.registryEvidence.sourceRef, "fixture://approved-symptom-map");

const unapproved = task();
unapproved.id = "content_68a13675_unapproved_asset";
unapproved.currentContent.image_plan.slots[0].strategy = "authorized_asset";
unapproved.currentContent.image_plan.slots[0].asset_id = "unapproved-asset";
unapproved.wechatAssetRegistry = { assets: [{ assetId: "unapproved-asset", status: "experimental", relativePath: authorizedRelativePath, license: { id: "owner-license-01", allowsPublication: true }, source: { ref: "fixture://unapproved", sha256: authorizedSource.sha256 } }] };
await assert.rejects(() => renderContentDelivery(unapproved, { root: runRoot }), (error) => error.code === "WECHAT_AUTHORIZED_ASSET_INELIGIBLE");

const badSourceHash = structuredClone(authorized);
badSourceHash.id = "content_68a13675_bad_asset_hash";
badSourceHash.wechatAssetRegistry.assets[0].source.sha256 = "0".repeat(64);
await assert.rejects(() => renderContentDelivery(badSourceHash, { root: runRoot }), (error) => error.code === "WECHAT_AUTHORIZED_ASSET_SOURCE_MISMATCH");

const qualityBlocked = structuredClone(authorized);
qualityBlocked.id = "content_68a13675_visual_pending";
qualityBlocked.wechatAssetRegistry.assets[0].qualityReview.visual = "needs_review";
const blockedDelivery = await renderContentDelivery(qualityBlocked, { root: runRoot });
assert.equal(blockedDelivery.status, "needs_review");
assert.ok(blockedDelivery.validation.blockers.includes("wechat_visual_gate"));
await assert.rejects(() => stat(join(runRoot, blockedDelivery.rootPath, "manifest.json")));
await assert.rejects(() => createDeliveryZip(qualityBlocked, { root: runRoot }), (error) => error.code === "DELIVERY_QUALITY_GATE_BLOCKED");

const brokenPreviewPath = join(versionRoot, "wechat-preview-broken-test.html");
const validPreview = await readFile(join(versionRoot, "wechat-preview.html"), "utf8");
await writeFile(brokenPreviewPath, validPreview.replace("assets/wechat-symptom-map.png", "assets/missing.png"), "utf8");
const brokenResult = await validateWechatIllustratedOutput({ html: paste, task: valid, assetRecords: structuredClone(valid.wechatIllustratedAssets), versionRoot, previewPath: brokenPreviewPath });
assert.equal(brokenResult.status, "needs_review");
assert.ok(brokenResult.blockers.includes("mobile_no_broken_images"));

delete process.env.WECHAT_ILLUSTRATED_DELIVERY_V1;
const legacy = task();
legacy.id = "content_68a13675_flag_off";
const legacyDelivery = await renderContentDelivery(legacy, { root: runRoot });
const legacyPaste = await readFile(join(runRoot, legacyDelivery.rootPath, "wechat-paste.html"), "utf8");
assert.equal((legacyPaste.match(/<figure\b/g) || []).length, 0, "flag-off must preserve text-only behavior");
assert.equal(legacyDelivery.validation.status, "passed");

console.log(JSON.stringify({
  status: "wechat-illustrated-delivery-self-test passed",
  historicalArticle: { chars: historicalArticle.length, h2Count: 6, sha256: historicalSha256 },
  imagePlan: { cover: 1, inline: 4 },
  quality: valid.wechatIllustratedQualityReport.gates,
  package: { path: packaged.path, bytes: packaged.bytes, sha256: packaged.sha256 }
}, null, 2));
