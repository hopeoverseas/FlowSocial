import assert from "node:assert/strict";
import {
  adaptLegacyWechatImagePlanReadOnly,
  adaptWechatImagePlanOutput,
  hashWechatArtifactValue
} from "../../content-agent/wechat-image-plan-adapter.mjs";
import {
  adaptLegacyWechatArtifactReadOnly,
  appendWechatDraftArtifactFact,
  appendWechatFormatArtifactFact,
  appendWechatImagePlanArtifactFact,
  appendWechatPostUploadArtifactFact,
  appendWechatPublicationArtifactFact,
  appendWechatQualityGateFact,
  appendWechatResourceResolutionAttempts,
  createWechatArtifactFactStore,
  evaluateWechatPreUploadArtifactState
} from "../../content-agent/wechat-artifact-facts.mjs";
import { validateWechatImagePlan } from "../../content-agent/wechat-illustrated-delivery.mjs";
import { syncContentImageTasks } from "../../artifact-engine.mjs";

const hash = (label) => hashWechatArtifactValue({ label });
const ref = (id) => ({ id, hash: hash(id) });
const at = "2026-08-05T12:00:00.000Z";
const bindings = {
  contentProjectRef: ref("project_1"),
  platformRunRef: ref("wechat_run_1"),
  candidateRef: ref("wechat_candidate_1"),
  articleRef: ref("wechat_article_1"),
  imagePlanOutputFactRef: ref("skill_output_plan_1")
};

const skillOutput = {
  status: "success",
  data: {
    plan_id: "WIP-1",
    cover: { purpose: "mood", strategy: "no_image", asset_id: null },
    slots: [
      { slot_id: "WS01", after_section_id: "W1", purpose: "prove", strategy: "authorized_asset", claim_ids: ["F1"], asset_id: "authorized-1" },
      { slot_id: "WS02", after_section_id: "W2", purpose: "explain", strategy: "html_chart", claim_ids: ["F2"], asset_id: "chart-1" },
      { slot_id: "WS03", after_section_id: "W3", purpose: "mood", strategy: "generated_raster", claim_ids: [], image_spec: { asset_id: "generated-1", prompt: "抽象绿色纹理，无文字", size: "1536x1024" } },
      { slot_id: "WS04", after_section_id: "W4", purpose: "pace", strategy: "no_image", claim_ids: [] }
    ]
  },
  warnings: [],
  blocked_reasons: []
};

const plan = adaptWechatImagePlanOutput(skillOutput, { bindings });
assert.equal(plan.cover.slotId, "cover");
assert.equal(plan.cover.role, "cover");
assert.equal(plan.cover.strategy, "no_image");
assert.equal(plan.resourceRequirements.length, 3, "no_image declarations must not invent resources");
assert.equal(plan.slots[2].assetId, "generated-1");
assert.equal(plan.slots[2].imageSpec.prompt, "抽象绿色纹理，无文字");
assert.throws(() => adaptWechatImagePlanOutput({ ...skillOutput, data: { ...skillOutput.data, slots: [{ ...skillOutput.data.slots[2], asset_id: "conflict" }] } }, { bindings }), (error) => error.code === "WECHAT_IMAGE_PLAN_ASSET_ID_CONFLICT");

const store = createWechatArtifactFactStore();
const planFact = appendWechatImagePlanArtifactFact(store, { canonicalPlan: plan, idempotencyKey: "plan-1", recordedAt: at });
assert.equal(store.planFacts.length, 1);
assert.deepEqual(appendWechatImagePlanArtifactFact(store, { canonicalPlan: plan, idempotencyKey: "plan-1", recordedAt: at }), planFact);
assert.equal(store.planFacts.length, 1, "same request must be idempotent");

const blocked = appendWechatResourceResolutionAttempts(store, {
  planFact,
  evidenceByAssetId: {},
  attempt: 1,
  idempotencyKeyPrefix: "resolve-1",
  recordedAt: at
});
assert.equal(blocked.length, 3);
assert.ok(blocked.every((item) => item.status === "blocked"));

const sourceSha = hash("authorized-source-bytes");
const chartSha = hash("chart-png-bytes");
const generatedSha = hash("generated-png-bytes");
const chartDefinition = { kind: "comparison", title: "确定性图表", items: [{ label: "A", value: 1 }] };
const succeeded = appendWechatResourceResolutionAttempts(store, {
  planFact,
  evidenceByAssetId: {
    "authorized-1": { assetId: "authorized-1", registryRecordRef: ref("registry-authorized-1"), status: "approved", license: { id: "license-1", allowsPublication: true }, source: { ref: "asset-registry://authorized-1", sha256: sourceSha }, actualSha256: sourceSha, bytes: 2048, relativePath: "assets/authorized-1.png", artifactRef: ref("artifact-authorized-1") },
    "chart-1": { assetId: "chart-1", status: "succeeded", deterministic: true, definition: chartDefinition, definitionHash: hashWechatArtifactValue(chartDefinition), articleRef: bindings.articleRef, actualSha256: chartSha, bytes: 4096, relativePath: "assets/chart-1.png", artifactRef: ref("artifact-chart-1") },
    "generated-1": { assetId: "generated-1", providerAttemptRef: ref("provider-attempt-generated-1-2"), status: "succeeded", attempt: 2, candidateRef: bindings.candidateRef, articleRef: bindings.articleRef, actualSha256: generatedSha, bytes: 8192, relativePath: "assets/generated-1.png", artifactRef: ref("artifact-generated-1") }
  },
  attempt: 2,
  idempotencyKeyPrefix: "resolve-2",
  recordedAt: at
});
assert.ok(succeeded.every((item) => item.status === "succeeded"));
assert.equal(store.resourceAttempts.length, 6, "successful retry must append rather than overwrite failures");

const badGenerated = appendWechatResourceResolutionAttempts(store, {
  planFact,
  evidenceByAssetId: {
    "generated-1": { assetId: "generated-1", providerAttemptRef: ref("provider-attempt-bad"), status: "succeeded", attempt: 1, candidateRef: ref("other-candidate"), articleRef: bindings.articleRef, actualSha256: generatedSha, bytes: 20, relativePath: "assets/generated-1.png", artifactRef: ref("bad-generated") }
  },
  attempt: 3,
  idempotencyKeyPrefix: "resolve-3",
  recordedAt: at
});
assert.ok(badGenerated.find((item) => item.assetId === "generated-1").blockers.includes("generated_raster_candidate_mismatch"));

const html = `<section><h1>文章</h1><img src="assets/authorized-1.png"><img src="assets/chart-1.png"><img src="assets/generated-1.png"></section>`;
const format = appendWechatFormatArtifactFact(store, { planFact, html, idempotencyKey: "format-1", recordedAt: at });
assert.equal(format.status, "succeeded");
assert.equal(format.semantics, "pre_upload_template_not_wechat_final");
assert.equal(format.platformUploadPerformed, false);
assert.equal(format.resourceAttemptRefs.length, 3);
const tamperedAttempts = structuredClone(succeeded);
tamperedAttempts[0].candidateRef = ref("tampered-candidate");
assert.throws(() => appendWechatFormatArtifactFact(store, { planFact, resourceAttempts: tamperedAttempts, html, idempotencyKey: "format-tampered", recordedAt: at }), (error) => error.code === "WECHAT_ARTIFACT_FACT_HASH_MISMATCH", "mutated resource facts must fail full-hash validation");

const qualityFacts = [];
for (const gate of ["format", "mobile", "ocr", "fact", "license", "visual"]) {
  qualityFacts.push(appendWechatQualityGateFact(store, { planFact, formatFact: format, gate, status: "passed", evidenceRefs: [ref(`evidence-${gate}`)], idempotencyKey: `gate-${gate}`, recordedAt: at }));
}
const waiting = evaluateWechatPreUploadArtifactState({ planFact, formatFact: format, qualityFacts });
assert.equal(waiting.status, "pre_upload_review_required");
assert.ok(waiting.blockers.includes("human_review_not_approved"));
const preUploadReady = evaluateWechatPreUploadArtifactState({ planFact, formatFact: format, qualityFacts, humanReviewStatus: "approved" });
assert.equal(preUploadReady.status, "pre_upload_ready");
assert.equal(preUploadReady.finalBundleAuthority, false, "pre-upload facts never grant final bundle authority");
assert.equal(preUploadReady.uploadPerformed, false);

const formatRef = { id: format.id, hash: format.factHash };
assert.throws(() => appendWechatPostUploadArtifactFact(store, { planFact, predecessorRef: formatRef, evidenceRef: ref("upload-1"), html, idempotencyKey: "post-bad", recordedAt: at }), (error) => error.code === "WECHAT_ARTIFACT_POST_UPLOAD_LOCAL_REF_FORBIDDEN");
const uploadedHtml = `<section><h1>文章</h1><img src="https://mmbiz.qpic.cn/a.png"><img src="https://mmbiz.qpic.cn/b.png"><img src="https://mmbiz.qpic.cn/c.png"></section>`;
const post = appendWechatPostUploadArtifactFact(store, { planFact, predecessorRef: formatRef, evidenceRef: ref("upload-1"), html: uploadedHtml, idempotencyKey: "post-1", recordedAt: at });
const draft = appendWechatDraftArtifactFact(store, { planFact, predecessorRef: { id: post.id, hash: post.factHash }, evidenceRef: ref("draft-1"), idempotencyKey: "draft-1", recordedAt: at });
const publication = appendWechatPublicationArtifactFact(store, { planFact, predecessorRef: { id: draft.id, hash: draft.factHash }, evidenceRef: ref("publication-1"), idempotencyKey: "publication-1", recordedAt: at });
assert.deepEqual([post.kind, draft.kind, publication.kind], ["post_upload", "draft", "publication"]);
assert.ok([post, draft, publication].every((item) => item.finalBundleAuthority === false));
assert.throws(() => appendWechatPublicationArtifactFact(store, { planFact, predecessorRef: formatRef, evidenceRef: ref("fake-publication"), idempotencyKey: "publication-invalid", recordedAt: at }), (error) => error.code === "WECHAT_ARTIFACT_PUBLICATION_DRAFT_REQUIRED");

const noImagePlan = adaptWechatImagePlanOutput({ status: "success", data: { plan_id: "WIP-NONE", cover: { strategy: "no_image" }, slots: [{ slot_id: "NONE-1", purpose: "pace", strategy: "no_image" }] } }, { bindings: { ...bindings, imagePlanOutputFactRef: ref("skill-output-none") } });
const noImageLegacyTask = { id: "task-none", version: 1, platform: "wechat", currentContent: { image_plan: { plan_id: "WIP-NONE", cover: { strategy: "no_image" }, slots: [{ slot_id: "NONE-1", purpose: "pace", strategy: "no_image" }] }, article_markdown: "纯文字文章" } };
assert.equal(validateWechatImagePlan(noImageLegacyTask).status, "passed", "no_image must not force cover, section mapping or 3-5 inline images");
assert.deepEqual(syncContentImageTasks(noImageLegacyTask), []);
const generatedTask = { id: "task-generated", version: 1, platform: "wechat", currentContent: { image_plan: skillOutput.data }, generatedAssets: [] };
const generatedImageTasks = syncContentImageTasks(generatedTask);
assert.equal(generatedImageTasks.find((item) => item.assetId === "generated-1").prompt, "抽象绿色纹理，无文字", "Artifact Engine must consume nested image_spec.prompt");
const noImageStore = createWechatArtifactFactStore();
const noImagePlanFact = appendWechatImagePlanArtifactFact(noImageStore, { canonicalPlan: noImagePlan, idempotencyKey: "none-plan", recordedAt: at });
assert.equal(appendWechatResourceResolutionAttempts(noImageStore, { planFact: noImagePlanFact, attempt: 1, idempotencyKeyPrefix: "none-resolve", recordedAt: at }).length, 0);
const noImageFormat = appendWechatFormatArtifactFact(noImageStore, { planFact: noImagePlanFact, html: "<section><h1>纯文字文章</h1></section>", idempotencyKey: "none-format", recordedAt: at });
const noImageQuality = [
  ["format", "passed"], ["mobile", "passed"], ["ocr", "not_applicable"], ["fact", "not_applicable"], ["license", "not_applicable"], ["visual", "passed"]
].map(([gate, status]) => appendWechatQualityGateFact(noImageStore, { planFact: noImagePlanFact, formatFact: noImageFormat, gate, status, idempotencyKey: `none-${gate}`, recordedAt: at }));
assert.equal(evaluateWechatPreUploadArtifactState({ planFact: noImagePlanFact, formatFact: noImageFormat, qualityFacts: noImageQuality, humanReviewStatus: "approved" }).status, "pre_upload_ready");

const legacyInput = { id: "legacy", currentContent: { image_plan: skillOutput.data }, delivery: { status: "ready" } };
const legacyBefore = hashWechatArtifactValue(legacyInput);
assert.equal(adaptLegacyWechatImagePlanReadOnly(skillOutput.data).authority, false);
assert.equal(adaptLegacyWechatArtifactReadOnly(legacyInput).finalBundleAuthority, false);
assert.equal(hashWechatArtifactValue(legacyInput), legacyBefore, "legacy projection must not mutate or backfill authority");

console.log(JSON.stringify({
  status: "unified-wechat-artifact-facts-self-test passed",
  planHash: plan.planHash,
  facts: Object.fromEntries(Object.entries(store).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
  claims: { externalCalls: 0, providerCalls: 0, wechatCalls: 0, productionWrites: 0, finalBundleAuthority: false }
}, null, 2));
