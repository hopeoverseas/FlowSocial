import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { buildXiaohongshuPlatformDeliveryBundle } from "../../content-agent/platform-delivery-bundle.mjs";
import { createEditorialSetReview, createUserSelectionGate } from "../../content-agent/content-set-review.mjs";
import { hashUnifiedContent, withUnifiedContentHash } from "../../content-agent/unified-content-contracts.mjs";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), "flowsocial-content-promotion-"));
copyFileSync(join(appRoot, "data", "store.json"), join(dataDir, "store.json"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
delete process.env.CONTENT_PROMOTION_V1;
process.env.PORT = "0";

const H = (value) => hashUnifiedContent(value);
const ref = (id) => ({ id, hash: H(id) });
const at = "2026-08-05T08:00:00.000Z";
const companyId = "company_promotion_api";
const accountId = "social_promotion_api";
const candidateRef = ref("api_candidate_v1");
const sharedContentMasterRef = { schemaVersion: "1.0", contract: "SharedContentMasterRef@1.0", id: "api_master", hash: H("api_master"), authorityContract: "ContentMaster@2.0", authorityType: "shared_content_master" };
const platformRun = { schemaVersion: "1.0", contract: "PlatformRunRef@1.0", id: "api_run", hash: H("api_run"), platform: "xiaohongshu", accountId, sharedContentMasterRef, platformBriefRef: ref("api_brief"), outlineRef: ref("api_outline"), writerInvocationRef: ref("api_writer"), candidateRefs: [candidateRef], finalVersionRef: candidateRef };
const contentProject = withUnifiedContentHash({ schemaVersion: "1.0", contract: "ContentProject@1.0", id: "api_project", companyId, contentOpportunityRef: ref("api_opportunity"), activeStrategySnapshotRef: ref("api_strategy"), sharedContentMasterRef, platformRuns: [platformRun], state: "user_selected", createdAt: at, projectHash: "" }, "projectHash");
const candidateSet = { platform: "xiaohongshu", candidateRef, titleRef: ref("api_title"), bodyVersionRef: ref("api_body"), pageRevisionRefs: [ref("api_page_v1")], items: [{ id: "page_1", order: 1, purpose: "hook", necessary: true, continuityFromPrevious: true, visualStyleHash: H("api_style"), copyVisualRelationship: "complementary", informationDensity: 0.5, clickValue: 1, conversionValue: 1 }] };
const editorialReview = createEditorialSetReview({ id: "api_review", contentProject, platformRun, candidateSet, machineGate: { status: "passed", ref: ref("api_machine"), candidateRef }, reviewedAt: at });
const selectionGate = createUserSelectionGate({ id: "api_selection_gate", contentProject, platformRun, candidateSet, editorialReview, event: { id: "api_selection_event", actorId: "api_user", actorType: "user", action: "selected", occurredAt: at } });
const builtBundle = buildXiaohongshuPlatformDeliveryBundle({
  schemaVersion: "1.0", platform: "xiaohongshu", platformVersionRef: candidateRef, promotedVersionRef: null,
  states: { machineReview: { status: "passed", ref: ref("api_machine") }, editorialReview: { status: "passed", ref: { id: editorialReview.id, hash: editorialReview.reviewHash } }, userSelection: { status: "selected", ref: { id: selectionGate.userSelection.id, hash: selectionGate.userSelection.selectionHash } }, promotion: { status: "not_promoted", ref: null }, publication: { status: "not_published", ref: null } },
  copy: { title: "API 晋升标题", body: "API 晋升正文", tags: ["晋升"], pinnedComment: "已确认" }, selection: { pageRevisionRefs: candidateSet.pageRevisionRefs }, pages: [{ pageId: "page_1", fileName: "page-1.png", bytes: Buffer.from("api-isolated-image"), revisionRef: candidateSet.pageRevisionRefs[0] }]
});
const deliveryBundle = { ...builtBundle, files: builtBundle.files.map(({ content: _content, ...file }) => file) };
const request = { schemaVersion: "1.0", contract: "ContentPromotionRequest@1.0", contentTaskId: "api_task", companyId, accountId, provenance: "native_shared_master", contentProject, platformRun, candidateSet, editorialReview, selectionGate, deliveryBundle, sourceManifestRef: deliveryBundle.manifestRef, deliveryArtifactRef: { id: `delivery-bundle:${candidateRef.id}`, hash: deliveryBundle.bundleHash } };

const { database, readStore, writeStore } = await import("../../storage.mjs");
const seeded = readStore();
seeded.accounts = [
  { id: companyId, companyId, workspaceId: "workspace_promotion", accountType: "company", name: "晋升 API 公司", status: "active" },
  { id: accountId, socialAccountId: accountId, companyId, workspaceId: "workspace_promotion", accountType: "social", platform: "xiaohongshu", name: "晋升 API 账号", status: "active" }
];
seeded.contentTasks = [{ id: "api_task", contentRunId: platformRun.id, companyId, accountId, socialAccountId: accountId, workspaceId: "workspace_promotion", platform: "xiaohongshu", version: 1, currentContent: { recommended_title: "API 晋升标题" } }];
seeded.contentRuns = [{ id: platformRun.id, companyId, accountId, socialAccountId: accountId, workspaceId: "workspace_promotion", platform: "xiaohongshu" }];
seeded.contentWorkflows = [];
seeded.contentVersions = [];
seeded.contentPromotions = [];
seeded.contentPublications = [];
writeStore(seeded);

let server;
try {
  ({ server } = await import("../../server.mjs"));
  if (!server.listening) await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const call = async (path, method = "GET", payload) => {
    const response = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  };
  const counts = () => { const store = readStore(); return { promotions: store.contentPromotions?.length || 0, versions: store.contentVersions?.length || 0, publications: store.contentPublications?.length || 0 }; };
  const initial = counts();

  const disabled = await call("/content-promotions/preview", "POST", request);
  assert.equal(disabled.status, 404);
  assert.equal(disabled.body.code, "CONTENT_PROMOTION_DISABLED");
  assert.deepEqual(counts(), initial, "disabled flag must not write");

  process.env.CONTENT_PROMOTION_V1 = "1";
  const preview = await call("/content-promotions/preview", "POST", request);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.claims.writesPerformed, false);
  assert.deepEqual(counts(), initial, "preview must not write");

  const wrongOwnership = structuredClone(request); wrongOwnership.companyId = "company_other";
  const rejectedOwnership = await call("/content-promotions/preview", "POST", wrongOwnership);
  assert.equal(rejectedOwnership.status, 403);
  assert.deepEqual(counts(), initial, "ownership rejection must not write");

  const badToken = await call("/content-promotions/confirm", "POST", { previewToken: "content-promotion-preview:bad", idempotencyKey: "api-promotion-1", request });
  assert.equal(badToken.status, 409);
  assert.deepEqual(counts(), initial, "invalid token must not write");

  const confirmed = await call("/content-promotions/confirm", "POST", { previewToken: preview.body.previewToken, idempotencyKey: "api-promotion-1", request });
  assert.equal(confirmed.status, 201);
  assert.deepEqual(counts(), { promotions: 1, versions: 1, publications: 0 });
  const replay = await call("/content-promotions/confirm", "POST", { previewToken: preview.body.previewToken, idempotencyKey: "api-promotion-1", request });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.promotion.id, confirmed.body.promotion.id);
  assert.deepEqual(counts(), { promotions: 1, versions: 1, publications: 0 });

  const queried = await call(`/content-promotions?contentTaskId=${encodeURIComponent(request.contentTaskId)}`);
  assert.equal(queried.status, 200);
  assert.equal(queried.body.items.length, 1);
  const exact = await call(`/content-promotions/${encodeURIComponent(confirmed.body.promotion.id)}`);
  assert.equal(exact.status, 200);
  assert.equal(exact.body.promotionHash, confirmed.body.promotion.promotionHash);

  const blockedPublication = await call("/content-tasks/api_task/publications", "POST", { status: "published", platform: "xiaohongshu", platformContentId: "api-note-1", publishedAt: at });
  assert.equal(blockedPublication.status, 409);
  assert.equal(blockedPublication.body.code, "PUBLICATION_PROMOTION_REQUIRED");
  assert.equal(counts().publications, 0);
  const publication = await call("/content-tasks/api_task/publications", "POST", { status: "published", platform: "xiaohongshu", platformContentId: "api-note-1", publishedAt: at, promotionId: confirmed.body.promotion.id, promotedVersionRef: confirmed.body.promotion.promotedVersionRef });
  assert.equal(publication.status, 201);
  assert.equal(publication.body.promotionStatus, "promoted_exact_version");
  assert.deepEqual(publication.body.promotedVersionRef, confirmed.body.promotion.promotedVersionRef);

  process.env.CONTENT_PROMOTION_V1 = "0";
  const rollbackDisabled = await call("/content-promotions/confirm", "POST", { previewToken: preview.body.previewToken, idempotencyKey: "api-promotion-2", request });
  assert.equal(rollbackDisabled.status, 404);
  assert.deepEqual(counts(), { promotions: 1, versions: 1, publications: 1 });

  console.log(JSON.stringify({ status: "content-promotion-api-self-test passed", isolatedDataDir: dataDir, testMode: true, featureFlagDefaultOff: true, previewReadOnly: true, ownershipRejectedWithoutWrite: true, idempotentConfirm: true, exactPublicationBinding: true, rollbackByFlag: true, externalCalls: false, providerCalls: false, platformCalls: false }, null, 2));
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  database.close();
  rmSync(dataDir, { recursive: true, force: true });
}
