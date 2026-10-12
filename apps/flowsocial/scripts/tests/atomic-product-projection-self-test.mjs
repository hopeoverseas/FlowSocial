import assert from "node:assert/strict";
import { featureFlags } from "../../feature-flags.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  assertUnifiedAtomicProductProjectionAppendable,
  getUnifiedAtomicContentProductProjection,
  listUnifiedAtomicContentProductProjections,
  validateUnifiedAtomicContentProductProjection
} from "../../content-agent/unified-atomic-product-projection.mjs";

const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });

function projection() {
  const projectRef = ref("project", "2");
  const platformRunRef = ref("platform-run", "3");
  const candidateRef = ref("candidate", "4");
  const hashed = (draft, field) => ({ ...draft, [field]: hashUnifiedContent(draft) });
  const postCopy = hashed({ id: "post-copy", contract: "XhsPostCopy@1.0", opening: "opening" }, "componentHash");
  const finalTitleBinding = hashed({ id: "final-title", contract: "XhsFinalTitleBinding@1.0", title: "verified title" }, "bindingHash");
  const carouselPlan = hashed({ id: "carousel", contract: "XhsCarouselPlan@2.0", pages: [] }, "componentHash");
  const visualAssetPlan = hashed({ id: "visual", contract: "XhsVisualAssetPlan@1.0", pageVisuals: [] }, "componentHash");
  const draft = {
    schemaVersion: "1.0", contract: "UnifiedAtomicContentProductProjection@1.0", id: "project",
    companyId: "company", accountId: "account", commitRef: ref("commit", "1"),
    refs: {
      contentProjectIdentityRef: ref("project", "5"), materializedContentProjectRef: projectRef,
      platformRunRef, candidateRef, assemblyFactRef: ref("assembly", "6"),
      assemblyOutputRef: ref("package", "7"), usageBindingRef: ref("usage", "8"),
      postCopyRef: { id: postCopy.id, hash: postCopy.componentHash }, finalTitleBindingRef: { id: finalTitleBinding.id, hash: finalTitleBinding.bindingHash },
      carouselPlanRef: { id: carouselPlan.id, hash: carouselPlan.componentHash }, visualAssetPlanRef: { id: visualAssetPlan.id, hash: visualAssetPlan.componentHash }
    },
    materializedContentProject: { id: projectRef.id, projectHash: projectRef.hash },
    xiaohongshu: {
      state: "materialized", platform: "xiaohongshu", accountId: "account", platformRunRef, candidateRef,
      title: "verified title", postCopy, finalTitleBinding, carouselPlan, visualAssetPlan,
      artifactState: "visual_artifacts_required", selected: false, promoted: false, deliveryReady: false, published: false,
      blockers: ["visual_artifacts_required", "user_selection_required", "promotion_required"]
    },
    wechatState: "not_materialized", wechat: { state: "not_materialized", blocker: "wechat_not_materialized" },
    artifactState: "visual_artifacts_required", selected: false, promoted: false, deliveryReady: false, published: false,
    blockers: ["visual_artifacts_required", "wechat_not_materialized", "user_selection_required", "promotion_required"],
    reviewState: { artifactApproved: false, editorialReviewPassed: false, selected: false, stale: false, artifactReviewFactRef: null, editorialReviewFactRef: null, selectionFactRef: null }
  };
  const authorityDraft = structuredClone(draft);
  delete authorityDraft.reviewState;
  return { ...draft, projectionHash: hashUnifiedContent(authorityDraft) };
}

const previous = process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1;
try {
  delete process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1;
  assert.equal(featureFlags().unifiedContentAtomicProductV1, false, "atomic product flag must be default-off");
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "1";
  assert.equal(featureFlags().unifiedContentAtomicProductV1, true);
} finally {
  if (previous === undefined) delete process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1;
  else process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = previous;
}

const valid = projection();
validateUnifiedAtomicContentProductProjection(valid);
assert.equal(projection().projectionHash, valid.projectionHash, "projection hash must be stable");
assert.equal(valid.wechatState, "not_materialized");
assert.equal(valid.xiaohongshu.artifactState, "visual_artifacts_required");
assert.equal(valid.selected, false);
assert.equal(valid.deliveryReady, false);

for (const shape of [null, 7, { ...valid, extra: true }]) {
  assert.throws(
    () => validateUnifiedAtomicContentProductProjection(shape),
    (error) => error instanceof TypeError === false && error.code === "UNIFIED_ATOMIC_PRODUCT_PROJECTION_INVALID"
  );
}

for (const [label, mutate] of [
  ["commit ref", (value) => { value.commitRef.hash = "0".repeat(64); }],
  ["candidate ref", (value) => { value.xiaohongshu.candidateRef.hash = "0".repeat(64); }],
  ["materialized project", (value) => { value.materializedContentProject.projectHash = "0".repeat(64); }],
  ["wechat state", (value) => { value.wechatState = "materialized"; }],
  ["selection", (value) => { value.selected = true; }],
  ["delivery", (value) => { value.deliveryReady = true; }],
  ["display content", (value) => { value.xiaohongshu.title = "tampered"; }]
]) {
  const tampered = structuredClone(valid);
  mutate(tampered);
  assert.throws(() => validateUnifiedAtomicContentProductProjection(tampered), (error) => typeof error.code === "string", label);
}

const semanticForgery = structuredClone(valid);
semanticForgery.selected = true;
delete semanticForgery.projectionHash;
semanticForgery.projectionHash = hashUnifiedContent(semanticForgery);
assert.throws(() => validateUnifiedAtomicContentProductProjection(semanticForgery), (error) => error.code === "UNIFIED_ATOMIC_PRODUCT_PROJECTION_STATE_INVALID");
const rehashedDisplayForgery = structuredClone(valid);
rehashedDisplayForgery.xiaohongshu.postCopy.opening = "forged opening";
delete rehashedDisplayForgery.projectionHash;
rehashedDisplayForgery.projectionHash = hashUnifiedContent(rehashedDisplayForgery);
assert.throws(() => validateUnifiedAtomicContentProductProjection(rehashedDisplayForgery), (error) => error.code === "UNIFIED_ATOMIC_PRODUCT_PROJECTION_XHS_INVALID");
const rehashedTitleForgery = structuredClone(valid);
rehashedTitleForgery.xiaohongshu.title = "forged title";
delete rehashedTitleForgery.projectionHash;
rehashedTitleForgery.projectionHash = hashUnifiedContent(rehashedTitleForgery);
assert.throws(() => validateUnifiedAtomicContentProductProjection(rehashedTitleForgery), (error) => error.code === "UNIFIED_ATOMIC_PRODUCT_PROJECTION_XHS_INVALID");

assert.doesNotThrow(() => assertUnifiedAtomicProductProjectionAppendable({}, valid));
assert.throws(
  () => assertUnifiedAtomicProductProjectionAppendable({ unifiedContentProjects: [{ id: "legacy", contentProject: { id: valid.id } }] }, valid),
  (error) => error.code === "UNIFIED_ATOMIC_PRODUCT_ID_COLLISION",
  "legacy/atomic identity collisions must fail closed before append"
);

assert.deepEqual(listUnifiedAtomicContentProductProjections({}, {}), []);
assert.equal(getUnifiedAtomicContentProductProjection({}, valid.id), null);
const invalidStore = { unifiedAtomicContentCommits: [{ schemaVersion: "2.0", contract: "UnifiedAtomicContentCommit@2.0" }] };
assert.throws(() => listUnifiedAtomicContentProductProjections(invalidStore), (error) => error.code === "UNIFIED_ATOMIC_PRODUCT_COMMIT_STORE_INVALID");

console.log("atomic-product-projection-self-test: ok");
