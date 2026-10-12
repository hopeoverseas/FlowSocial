import assert from "node:assert/strict";
import { buildXiaohongshuPlatformDeliveryBundle } from "../../content-agent/platform-delivery-bundle.mjs";
import { createEditorialSetReview, createUserSelectionGate } from "../../content-agent/content-set-review.mjs";
import { confirmContentPromotion, previewContentPromotion } from "../../content-agent/content-promotion.mjs";
import { recordPublication } from "../../content-agent/publishing-feedback.mjs";
import { hashUnifiedContent, withUnifiedContentHash } from "../../content-agent/unified-content-contracts.mjs";

const H = (value) => hashUnifiedContent(value);
const ref = (id) => ({ id, hash: H(id) });
const at = "2026-08-05T08:00:00.000Z";

function fixture() {
  const companyId = "company_promotion";
  const accountId = "social_promotion_xhs";
  const candidateRef = ref("candidate:selected:v3");
  const sharedContentMasterRef = { schemaVersion: "1.0", contract: "SharedContentMasterRef@1.0", id: "master_promotion", hash: H("master"), authorityContract: "ContentMaster@2.0", authorityType: "shared_content_master" };
  const platformRun = {
    schemaVersion: "1.0", contract: "PlatformRunRef@1.0", id: "run_promotion", hash: H("run"), platform: "xiaohongshu", accountId,
    sharedContentMasterRef, platformBriefRef: ref("brief"), outlineRef: ref("outline"), writerInvocationRef: ref("writer"), candidateRefs: [candidateRef], finalVersionRef: candidateRef
  };
  const contentProject = withUnifiedContentHash({
    schemaVersion: "1.0", contract: "ContentProject@1.0", id: "project_promotion", companyId,
    contentOpportunityRef: ref("opportunity"), activeStrategySnapshotRef: ref("strategy"), sharedContentMasterRef,
    platformRuns: [platformRun], state: "user_selected", createdAt: at, projectHash: ""
  }, "projectHash");
  const candidateSet = {
    platform: "xiaohongshu", candidateRef, titleRef: ref("title:v3"), bodyVersionRef: ref("body:v3"), pageRevisionRefs: [ref("page:1:v3")],
    items: [{ id: "page_1", order: 1, purpose: "hook", necessary: true, continuityFromPrevious: true, visualStyleHash: H("style"), copyVisualRelationship: "complementary", informationDensity: 0.6, clickValue: 1, conversionValue: 1 }]
  };
  const editorialReview = createEditorialSetReview({ id: "review_promotion", contentProject, platformRun, candidateSet, machineGate: { status: "passed", ref: ref("machine_gate"), candidateRef }, reviewedAt: at });
  const selectionGate = createUserSelectionGate({ id: "selection_gate_promotion", contentProject, platformRun, candidateSet, editorialReview, event: { id: "selection_event", actorId: "user_promotion", actorType: "user", action: "selected", occurredAt: at } });
  const deliveryBundle = buildXiaohongshuPlatformDeliveryBundle({
    schemaVersion: "1.0", platform: "xiaohongshu", platformVersionRef: candidateRef, promotedVersionRef: null,
    states: {
      machineReview: { status: "passed", ref: ref("machine_gate") }, editorialReview: { status: "passed", ref: { id: editorialReview.id, hash: editorialReview.reviewHash } },
      userSelection: { status: "selected", ref: { id: selectionGate.userSelection.id, hash: selectionGate.userSelection.selectionHash } }, promotion: { status: "not_promoted", ref: null }, publication: { status: "not_published", ref: null }
    },
    copy: { title: "受控晋升标题", body: "受控晋升正文", tags: ["晋升"], pinnedComment: "用户已选中" },
    selection: { pageRevisionRefs: candidateSet.pageRevisionRefs },
    pages: [{ pageId: "page_1", fileName: "page-1.png", bytes: Buffer.from("isolated-image"), revisionRef: candidateSet.pageRevisionRefs[0] }]
  });
  const request = {
    schemaVersion: "1.0", contract: "ContentPromotionRequest@1.0", contentTaskId: "task_promotion", companyId, accountId, provenance: "native_shared_master",
    contentProject, platformRun, candidateSet, editorialReview, selectionGate, deliveryBundle,
    sourceManifestRef: deliveryBundle.manifestRef,
    deliveryArtifactRef: { id: `delivery-bundle:${candidateRef.id}`, hash: deliveryBundle.bundleHash }
  };
  const store = {
    accounts: [
      { id: companyId, companyId, accountType: "company", name: "晋升公司", status: "active" },
      { id: accountId, socialAccountId: accountId, companyId, accountType: "social", platform: "xiaohongshu", name: "晋升账号", status: "active" }
    ],
    contentTasks: [{ id: "task_promotion", contentRunId: platformRun.id, companyId, accountId, socialAccountId: accountId, platform: "xiaohongshu" }],
    contentRuns: [{ id: platformRun.id, companyId, accountId, socialAccountId: accountId, platform: "xiaohongshu" }],
    contentVersions: [{ id: "legacy_content_version", contentTaskId: "task_promotion", version: 7, legacyPayload: { untouched: true } }], contentPromotions: [], contentPublications: []
  };
  return { store, request, contentProject, platformRun, candidateSet, editorialReview };
}

const { store, request, contentProject, platformRun, candidateSet, editorialReview } = fixture();
const legacyVersionHash = H(store.contentVersions[0]);
const before = H(store);
const preview = previewContentPromotion(store, request);
assert.equal(preview.status, "validated_read_only");
assert.equal(preview.claims.writesPerformed, false);
assert.equal(H(store), before, "preview must not mutate store");

const confirmed = confirmContentPromotion(store, { previewToken: preview.previewToken, idempotencyKey: "promotion-idempotency-1", request }, { now: at });
assert.equal(confirmed.created, true);
assert.equal(store.contentPromotions.length, 1);
assert.equal(store.contentVersions.length, 2);
assert.equal(confirmed.contentVersion.version, 8);
assert.equal(H(store.contentVersions[0]), legacyVersionHash, "historical content version must remain unchanged");
assert.equal(confirmed.contentVersion.immutable, true);
assert.deepEqual(confirmed.promotion.promotedVersionRef, { id: confirmed.contentVersion.id, hash: confirmed.contentVersion.versionHash });
assert.deepEqual(confirmed.promotion.sourceManifestRef, request.deliveryBundle.manifestRef);
const replay = confirmContentPromotion(store, { previewToken: preview.previewToken, idempotencyKey: "promotion-idempotency-1", request }, { now: "2026-08-05T09:00:00.000Z" });
assert.equal(replay.created, false);
assert.equal(replay.promotion.id, confirmed.promotion.id);
assert.equal(store.contentVersions.length, 2, "idempotent replay must not append another version");
const conflictingRequest = structuredClone(request); conflictingRequest.provenance = "legacy_isolated";
const conflictingPreview = previewContentPromotion(store, conflictingRequest);
assert.throws(() => confirmContentPromotion(store, { previewToken: conflictingPreview.previewToken, idempotencyKey: "promotion-idempotency-1", request: conflictingRequest }), { code: "CONTENT_PROMOTION_IDEMPOTENCY_CONFLICT" });

assert.throws(() => confirmContentPromotion(store, { previewToken: "content-promotion-preview:bad", idempotencyKey: "bad-token", request }), { code: "CONTENT_PROMOTION_PREVIEW_TOKEN_MISMATCH" });
const hashMismatch = structuredClone(request); hashMismatch.sourceManifestRef = ref("other_manifest");
assert.throws(() => previewContentPromotion(store, hashMismatch), { code: "CONTENT_PROMOTION_MANIFEST_HASH_MISMATCH" });
const noProvenance = structuredClone(request); delete noProvenance.provenance;
assert.throws(() => previewContentPromotion(store, noProvenance), { code: "CONTENT_PROMOTION_PROVENANCE_REQUIRED" });
const wrongAccount = structuredClone(request); wrongAccount.accountId = "social_other";
assert.throws(() => previewContentPromotion(store, wrongAccount), { code: "CONTENT_PROMOTION_ACCOUNT_MISMATCH" });

const notSelectedGate = createUserSelectionGate({ id: "selection_gate_no", contentProject, platformRun, candidateSet, editorialReview, event: { id: "selection_event_no", actorId: "user_promotion", actorType: "user", action: "not_selected", occurredAt: at } });
const notSelected = structuredClone(request); notSelected.selectionGate = notSelectedGate;
assert.throws(() => previewContentPromotion(store, notSelected), { code: "CONTENT_PROMOTION_USER_SELECTION_REQUIRED" });

assert.throws(() => recordPublication(store, store.contentTasks[0], { status: "published", platform: "xiaohongshu", platformContentId: "abc123", publishedAt: at }), { code: "PUBLICATION_PROMOTION_REQUIRED" });
assert.throws(() => recordPublication(store, store.contentTasks[0], { status: "published", platform: "xiaohongshu", platformContentId: "abc123", publishedAt: at, promotionId: confirmed.promotion.id, promotedVersionRef: ref("wrong-version") }), { code: "PUBLICATION_PROMOTED_VERSION_MISMATCH" });
assert.throws(() => recordPublication(store, store.contentTasks[0], { status: "published", platform: "wechat", platformContentId: "abc123", publishedAt: at, promotionId: confirmed.promotion.id, promotedVersionRef: confirmed.promotion.promotedVersionRef }), { code: "PUBLICATION_PROMOTION_OWNERSHIP_MISMATCH" });
const publication = recordPublication(store, store.contentTasks[0], { status: "published", platform: "xiaohongshu", platformContentId: "abc123", publishedAt: at, promotionId: confirmed.promotion.id, promotedVersionRef: confirmed.promotion.promotedVersionRef });
assert.equal(publication.promotionStatus, "promoted_exact_version");
assert.deepEqual(publication.promotedVersionRef, confirmed.promotion.promotedVersionRef);

const legacyTask = { id: "task_legacy", contentRunId: "run_legacy", companyId: request.companyId, accountId: request.accountId, socialAccountId: request.accountId, platform: "xiaohongshu" };
store.contentTasks.push(legacyTask);
const legacyPublication = recordPublication(store, legacyTask, { status: "draft", platform: "xiaohongshu", idempotencyKey: "legacy" });
assert.equal(legacyPublication.promotionStatus, "legacy_unpromoted");
assert.equal(legacyPublication.promotedVersionRef, null);

console.log(JSON.stringify({ status: "content-promotion-self-test passed", previewReadOnly: true, promotionId: confirmed.promotion.id, immutableVersionId: confirmed.contentVersion.id, idempotentReplay: true, publicationExactVersionGate: true, legacyCompatibility: "legacy_unpromoted", externalCalls: false }, null, 2));
