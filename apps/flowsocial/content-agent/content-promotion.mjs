import { createHash, randomUUID } from "node:crypto";
import { validateEditorialSetReview, validateUserSelectionGate } from "./content-set-review.mjs";
import { buildAtomicXhsPostPromotionDeliveryBundle, validatePlatformDeliveryBundle } from "./platform-delivery-bundle.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { getUnifiedContentArtifactReview } from "./unified-content-artifact-store.mjs";
import {
  hashUnifiedContent,
  validateContentProject,
  validatePlatformRunRef,
  validatePromotionRecord,
  withUnifiedContentHash
} from "./unified-content-contracts.mjs";

const HASH = /^[a-f0-9]{64}$/;
const PROVENANCE = new Set(["native_shared_master", "legacy_isolated", "legacy_single_platform"]);

function fail(code, message, statusCode = 400, details = null) {
  throw Object.assign(new Error(message || code), { code, statusCode, details });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code);
  return value.trim();
}

function ref(value, code) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "hash,id") fail(code, code);
  text(value.id, code);
  if (!HASH.test(value.hash || "")) fail(code, code);
  return value;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function clone(value) {
  return structuredClone(value);
}

function projectRef(project) {
  return { id: project.id, hash: project.projectHash };
}

function runRef(run) {
  return { id: run.id, hash: run.hash };
}

function reviewRef(review) {
  return { id: review.id, hash: review.reviewHash };
}

function selectionRef(gate) {
  return { id: gate.userSelection.id, hash: gate.userSelection.selectionHash };
}

function deliveryArtifactRef(bundle) {
  return { id: `delivery-bundle:${bundle.platformVersionRef.id}`, hash: bundle.bundleHash };
}

function immutableRequest(input) {
  const request = clone(input);
  if (request.deliveryBundle?.files) request.deliveryBundle.files = request.deliveryBundle.files.map(({ content: _content, ...file }) => file);
  return request;
}

function assertOwnership(store, request) {
  const company = (store.accounts || []).find((item) => item.id === request.companyId && (item.accountType === "company" || item.companyId === item.id));
  if (!company) fail("CONTENT_PROMOTION_COMPANY_NOT_FOUND", "Company not found", 404);
  const account = (store.accounts || []).find((item) => (item.socialAccountId || item.id) === request.accountId && item.companyId === request.companyId && item.accountType !== "company");
  if (!account) fail("CONTENT_PROMOTION_OWNERSHIP_MISMATCH", "Account does not belong to company", 403);
  if (account.platform !== request.platformRun.platform) fail("CONTENT_PROMOTION_PLATFORM_MISMATCH", "Account platform does not match platform run", 403);
  const task = (store.contentTasks || []).find((item) => item.id === request.contentTaskId);
  if (!task) fail("CONTENT_PROMOTION_CONTENT_TASK_NOT_FOUND", "Content task not found", 404);
  const taskAccountId = task.socialAccountId || task.accountId;
  if ((task.companyId && task.companyId !== request.companyId) || taskAccountId !== request.accountId || task.platform !== request.platformRun.platform) {
    fail("CONTENT_PROMOTION_TASK_OWNERSHIP_MISMATCH", "Content task ownership does not match promotion", 403);
  }
  return task;
}

export function ensureContentPromotionStore(store) {
  store.contentPromotions ||= [];
  store.contentVersions ||= [];
  return { contentPromotions: store.contentPromotions, contentVersions: store.contentVersions };
}

function validStoredFact(value, contract) {
  if (value?.contract !== contract || !ref({ id: value?.id, hash: value?.factHash }, "ATOMIC_PROMOTION_FACT_INVALID")) return false;
  const copy = clone(value); delete copy.factHash;
  return hashUnifiedContent(copy) === value.factHash;
}

function atomicFactRef(value) {
  return { id: value.id, hash: value.factHash };
}

function validSelfHash(value, field) {
  if (!value || !HASH.test(value[field] || "")) return false;
  const copy = clone(value); delete copy[field];
  return hashUnifiedContent(copy) === value[field];
}

function sameRefList(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((item, index) => sameRef(item, right[index]));
}

function atomicScopeMatches(value, authority) {
  return value?.workspaceId === authority.workspaceId && value.companyId === authority.companyId
    && value.accountId === authority.accountId && value.platform === "xiaohongshu"
    && sameRef(value.contentProjectRef, authority.executionProjectRef)
    && sameRef(value.materializedContentProjectRef, authority.materializedProjectRef)
    && sameRef(value.platformRunRef, authority.platformRunRef) && sameRef(value.candidateRef, authority.candidateRef);
}

function atomicRevisionScopeMatches(value, authority) {
  return sameRef(value?.contentProjectRef, authority.executionProjectRef)
    && sameRef(value?.materializedContentProjectRef, authority.materializedProjectRef)
    && sameRef(value?.platformRunRef, authority.platformRunRef) && sameRef(value?.candidateRef, authority.candidateRef);
}

function resolveAtomicPromotionContext(store, input, featureFlags = {}) {
  const authority = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu" }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true
  });
  if (authority.authorityKind !== "atomic_v2") fail("ATOMIC_XHS_PROMOTION_AUTHORITY_REQUIRED", "Atomic v2 authority is required", 409);
  if (input?.candidateId && input.candidateId !== authority.candidateRef.id) fail("ATOMIC_XHS_PROMOTION_CANDIDATE_MISMATCH", "Candidate is not current", 409);
  if (input?.candidateRef && !sameRef(input.candidateRef, authority.candidateRef)) fail("ATOMIC_XHS_PROMOTION_CANDIDATE_MISMATCH", "Candidate is not current", 409);
  if (input?.platformRunRef && !sameRef(input.platformRunRef, authority.platformRunRef)) fail("ATOMIC_XHS_PROMOTION_RUN_MISMATCH", "Platform run is not current", 409);
  const artifact = getUnifiedContentArtifactReview(store, {
    ...input, platform: "xiaohongshu", candidateId: authority.candidateRef.id
  }, { featureFlags });
  const pageRevisionRefs = artifact.artifactState?.pageRevisionRefs || [];
  if (artifact.artifactState?.selectable !== true || !pageRevisionRefs.length) fail("ATOMIC_XHS_PROMOTION_ARTIFACT_NOT_APPROVED", "Exact current artifact is not human approved", 409);
  const reviews = (store.unifiedContentReviews || []).filter((item) => validStoredFact(item, "UnifiedAtomicXhsContentReviewFact@1.0") && atomicScopeMatches(item, authority));
  const review = reviews.at(-1);
  if (!review || review.state !== "editorial_review_passed" || !sameRefList(review.pageRevisionRefs, pageRevisionRefs)
    || review.artifactStateHash !== artifact.artifactState.artifactStateHash) {
    fail("ATOMIC_XHS_PROMOTION_EDITORIAL_REVIEW_STALE", "Exact current editorial review is required", 409);
  }
  const selections = (store.unifiedContentSelections || []).filter((item) => validStoredFact(item, "UnifiedAtomicXhsSelectionFact@1.0") && atomicScopeMatches(item, authority));
  const selection = selections.at(-1);
  if (!selection || selection.status !== "selected" || selection.actorType !== "user"
    || !sameRef(selection.reviewFactRef, atomicFactRef(review)) || !sameRefList(selection.pageRevisionRefs, pageRevisionRefs)
    || selection.artifactStateHash !== review.artifactStateHash || selection.artifactActionSetHash !== review.artifactActionSetHash) {
    fail("ATOMIC_XHS_PROMOTION_SELECTION_STALE", "Exact current user selection is required", 409);
  }
  const revisions = pageRevisionRefs.map((revisionRef, order) => {
    const matches = (store.unifiedContentXhsPageRevisionFacts || []).filter((item) => sameRef({ id: item.id, hash: item.revisionHash }, revisionRef)
      && atomicRevisionScopeMatches(item, authority));
    if (matches.length !== 1) fail("ATOMIC_XHS_PROMOTION_PAGE_REVISION_MISSING", "Selected Page Revision is missing or ambiguous", 409);
    const revision = matches[0];
    return {
      pageId: revision.pageId, order: order + 1, revisionRef: clone(revisionRef), pageRef: clone(revision.pageRef),
      normalizedAsset: clone(revision.normalizedAsset)
    };
  });
  const postCopy = authority.payload.components.postCopy;
  const copy = {
    title: postCopy.recommendedTitle,
    body: [postCopy.opening, ...postCopy.bodySections.map((item) => item.text), postCopy.ending, postCopy.cta].filter((item) => typeof item === "string" && item.trim()).join("\n\n"),
    tags: clone(postCopy.hashtags), pinnedComment: postCopy.pinnedComment
  };
  return { authority, artifact, review, selection, revisions, copy };
}

function atomicPromotionRequest(context) {
  const { authority, artifact, review, selection, revisions, copy } = context;
  return {
    schemaVersion: "1.0", contract: "AtomicXhsContentPromotionRequest@1.0",
    workspaceId: authority.workspaceId, companyId: authority.companyId, accountId: authority.accountId,
    contentProjectRef: clone(authority.executionProjectRef), materializedContentProjectRef: clone(authority.materializedProjectRef),
    commitRef: clone(authority.payload.commitRef), platform: "xiaohongshu", platformRunRef: clone(authority.platformRunRef), candidateRef: clone(authority.candidateRef),
    artifactStateHash: artifact.artifactState.artifactStateHash, pageRevisionRefs: revisions.map((item) => clone(item.revisionRef)),
    editorialReviewRef: atomicFactRef(review), selectionRef: atomicFactRef(selection), copy, pages: revisions,
    claims: { finalDeliveryAuthority: false, platformPublicationPerformed: false }
  };
}

export function previewAtomicXhsContentPromotion(store, input, { featureFlags = {} } = {}) {
  const request = atomicPromotionRequest(resolveAtomicPromotionContext(store, input, featureFlags));
  const inputHash = hashUnifiedContent(request);
  return Object.freeze({
    schemaVersion: "1.0", contract: "AtomicXhsContentPromotionPreflight@1.0", status: "validated_read_only",
    inputHash, previewToken: `atomic-xhs-promotion-preview:${inputHash}`,
    bindings: Object.freeze({
      commitRef: clone(request.commitRef), contentProjectRef: clone(request.contentProjectRef), materializedContentProjectRef: clone(request.materializedContentProjectRef),
      platformRunRef: clone(request.platformRunRef), candidateRef: clone(request.candidateRef), artifactStateHash: request.artifactStateHash,
      pageRevisionRefs: clone(request.pageRevisionRefs), editorialReviewRef: clone(request.editorialReviewRef), selectionRef: clone(request.selectionRef)
    }),
    request,
    claims: Object.freeze({ writesPerformed: false, finalDeliveryAuthority: false, platformPublicationPerformed: false })
  });
}

function atomicContentVersion(preflight, idempotencyKey, promotedAt) {
  const request = preflight.request;
  const identity = hashUnifiedContent({ inputHash: preflight.inputHash, idempotencyKey });
  const base = {
    schemaVersion: "1.0", contract: "AtomicXhsImmutableContentVersion@1.0", id: `atomic-xhs-version:${identity.slice(0, 24)}`,
    immutable: true, workspaceId: request.workspaceId, companyId: request.companyId, accountId: request.accountId,
    contentProjectRef: clone(request.contentProjectRef), materializedContentProjectRef: clone(request.materializedContentProjectRef), commitRef: clone(request.commitRef),
    platform: "xiaohongshu", platformRunRef: clone(request.platformRunRef), candidateRef: clone(request.candidateRef),
    artifactStateHash: request.artifactStateHash, editorialReviewRef: clone(request.editorialReviewRef), selectionRef: clone(request.selectionRef),
    pageRevisionRefs: clone(request.pageRevisionRefs), copy: clone(request.copy), pages: clone(request.pages),
    preflightInputHash: preflight.inputHash, idempotencyKey, promotedAt
  };
  return { ...base, versionHash: hashUnifiedContent(base) };
}

export function confirmAtomicXhsContentPromotion(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_XHS_PROMOTION_IDEMPOTENCY_KEY_REQUIRED");
  const preflight = previewAtomicXhsContentPromotion(store, input?.request, { featureFlags });
  if (input.previewToken !== preflight.previewToken) fail("ATOMIC_XHS_PROMOTION_PREVIEW_TOKEN_MISMATCH", "Preview token does not match current exact selection", 409);
  const { contentPromotions, contentVersions } = ensureContentPromotionStore(store);
  const existing = contentPromotions.find((item) => item.contract === "AtomicXhsPromotionRecord@1.0" && item.idempotencyKey === idempotencyKey);
  if (existing) {
    const version = contentVersions.find((item) => sameRef({ id: item.id, hash: item.versionHash }, existing.promotedVersionRef));
    if (!validSelfHash(existing, "promotionHash") || !validSelfHash(version, "versionHash")) fail("ATOMIC_XHS_PROMOTION_STORED_RECORD_INVALID", "Stored promotion is invalid", 409);
    if (version.preflightInputHash !== preflight.inputHash) fail("ATOMIC_XHS_PROMOTION_IDEMPOTENCY_CONFLICT", "Idempotency key semantics changed", 409);
    return { promotion: clone(existing), contentVersion: clone(version), created: false };
  }
  const promotedAt = new Date(now).toISOString();
  const contentVersion = atomicContentVersion(preflight, idempotencyKey, promotedAt);
  const promotedVersionRef = { id: contentVersion.id, hash: contentVersion.versionHash };
  const identity = hashUnifiedContent({ preflightInputHash: preflight.inputHash, idempotencyKey });
  const base = {
    schemaVersion: "1.0", contract: "AtomicXhsPromotionRecord@1.0", id: `atomic-xhs-promotion:${identity.slice(0, 24)}`,
    workspaceId: preflight.request.workspaceId, companyId: preflight.request.companyId, accountId: preflight.request.accountId,
    contentProjectRef: clone(preflight.request.contentProjectRef), materializedContentProjectRef: clone(preflight.request.materializedContentProjectRef),
    commitRef: clone(preflight.request.commitRef), platform: "xiaohongshu", platformRunRef: clone(preflight.request.platformRunRef), candidateRef: clone(preflight.request.candidateRef),
    artifactStateHash: preflight.request.artifactStateHash, pageRevisionRefs: clone(preflight.request.pageRevisionRefs),
    editorialReviewRef: clone(preflight.request.editorialReviewRef), selectionRef: clone(preflight.request.selectionRef), promotedVersionRef,
    preflightInputHash: preflight.inputHash, idempotencyKey, promotedAt, finalDeliveryRef: null, platformPublicationPerformed: false
  };
  const promotion = { ...base, promotionHash: hashUnifiedContent(base) };
  contentVersions.push(contentVersion);
  contentPromotions.push(promotion);
  return { promotion: clone(promotion), contentVersion: clone(contentVersion), created: true };
}

export async function appendAtomicXhsFinalDelivery(store, input, { featureFlags = {}, assetReader, now = new Date().toISOString() } = {}) {
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_XHS_DELIVERY_IDEMPOTENCY_KEY_REQUIRED");
  const context = resolveAtomicPromotionContext(store, input, featureFlags);
  const promotion = (store.contentPromotions || []).find((item) => item.contract === "AtomicXhsPromotionRecord@1.0" && item.id === input.promotionId);
  if (!promotion || !sameRef({ id: promotion.id, hash: promotion.promotionHash }, input.promotionRef)
    || !validSelfHash(promotion, "promotionHash") || !atomicScopeMatches(promotion, context.authority)) fail("ATOMIC_XHS_DELIVERY_PROMOTION_MISMATCH", "Exact promotion is required", 409);
  const version = (store.contentVersions || []).find((item) => sameRef({ id: item.id, hash: item.versionHash }, promotion.promotedVersionRef));
  if (!version || version.contract !== "AtomicXhsImmutableContentVersion@1.0" || !validSelfHash(version, "versionHash") || !sameRefList(version.pageRevisionRefs, context.revisions.map((item) => item.revisionRef))
    || !sameRef(version.editorialReviewRef, promotion.editorialReviewRef) || !sameRef(version.selectionRef, promotion.selectionRef)) {
    fail("ATOMIC_XHS_DELIVERY_VERSION_STALE", "Promoted version is not the exact current selected version", 409);
  }
  if (input.promotedVersionRef && !sameRef(input.promotedVersionRef, promotion.promotedVersionRef)) fail("ATOMIC_XHS_DELIVERY_VERSION_MISMATCH", "Promoted version mismatch", 409);
  const deliveries = store.unifiedAtomicXhsDeliveries || [];
  if (!Array.isArray(deliveries)) fail("ATOMIC_XHS_DELIVERY_STORE_INVALID", "Atomic delivery store is invalid", 409);
  const requestHash = hashUnifiedContent({ promotionRef: input.promotionRef, promotedVersionRef: promotion.promotedVersionRef, pageRevisionRefs: version.pageRevisionRefs });
  const existing = deliveries.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) fail("ATOMIC_XHS_DELIVERY_IDEMPOTENCY_CONFLICT", "Idempotency key semantics changed", 409);
    return { delivery: clone(existing), created: false };
  }
  if (typeof assetReader !== "function") fail("ATOMIC_XHS_DELIVERY_ASSET_READER_REQUIRED", "Selected image bytes are unavailable", 409);
  const pages = [];
  for (const page of version.pages) {
    const asset = await assetReader({ pageRevisionRef: clone(page.revisionRef), normalizedAsset: clone(page.normalizedAsset), pageId: page.pageId });
    const bytes = Buffer.isBuffer(asset?.bytes) ? asset.bytes : asset?.bytes instanceof Uint8Array ? Buffer.from(asset.bytes) : null;
    if (!bytes || bytes.length !== page.normalizedAsset.bytes || createHash("sha256").update(bytes).digest("hex") !== page.normalizedAsset.sha256) {
      fail("ATOMIC_XHS_DELIVERY_ASSET_MISMATCH", "Selected image bytes do not match the promoted descriptor", 409);
    }
    pages.push({ pageId: page.pageId, fileName: `${String(page.order).padStart(2, "0")}_${page.pageId}.png`, revisionRef: clone(page.revisionRef), bytes });
  }
  const bundle = buildAtomicXhsPostPromotionDeliveryBundle({
    schemaVersion: "1.0", platform: "xiaohongshu", platformVersionRef: clone(promotion.promotedVersionRef), promotedVersionRef: clone(promotion.promotedVersionRef),
    copy: clone(version.copy), selection: { pageRevisionRefs: clone(version.pageRevisionRefs) }, pages,
    states: {
      machineReview: { status: "passed", ref: clone(version.editorialReviewRef) }, editorialReview: { status: "passed", ref: clone(version.editorialReviewRef) },
      userSelection: { status: "selected", ref: clone(version.selectionRef) }, promotion: { status: "promoted", ref: { id: promotion.id, hash: promotion.promotionHash } },
      publication: { status: "not_published", ref: null }
    },
    lifecycleRefs: { editorialReviewRef: clone(version.editorialReviewRef), selectionRef: clone(version.selectionRef), promotionRef: { id: promotion.id, hash: promotion.promotionHash } }
  });
  const serializedFiles = bundle.files.map((file) => ({
    ...file, content: Buffer.isBuffer(file.content) ? file.content.toString("base64") : file.content,
    encoding: Buffer.isBuffer(file.content) ? "base64" : "utf8"
  }));
  const base = {
    schemaVersion: "1.0", contract: "AtomicXhsFinalDeliveryRecord@1.0", id: `atomic-xhs-delivery:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    workspaceId: version.workspaceId, companyId: version.companyId, accountId: version.accountId, platform: "xiaohongshu",
    contentProjectRef: clone(version.contentProjectRef), materializedContentProjectRef: clone(version.materializedContentProjectRef), platformRunRef: clone(version.platformRunRef), candidateRef: clone(version.candidateRef),
    promotionRef: { id: promotion.id, hash: promotion.promotionHash }, promotedVersionRef: clone(promotion.promotedVersionRef),
    editorialReviewRef: clone(version.editorialReviewRef), selectionRef: clone(version.selectionRef), pageRevisionRefs: clone(version.pageRevisionRefs),
    manifest: clone(bundle.manifest), manifestRef: clone(bundle.manifestRef), bundleHash: bundle.bundleHash, files: serializedFiles,
    requestHash, idempotencyKey, createdAt: new Date(now).toISOString(), deliveryReady: true, platformPublicationPerformed: false
  };
  const delivery = { ...base, deliveryHash: hashUnifiedContent(base) };
  store.unifiedAtomicXhsDeliveries = [...deliveries, delivery];
  return { delivery: clone(delivery), created: true };
}

export function validateContentPromotionRequest(store, input) {
  if (!input || input.schemaVersion !== "1.0" || input.contract !== "ContentPromotionRequest@1.0") fail("CONTENT_PROMOTION_REQUEST_VERSION", "Invalid content promotion request contract");
  for (const field of ["contentTaskId", "companyId", "accountId"]) text(input[field], `CONTENT_PROMOTION_${field.toUpperCase()}_REQUIRED`);
  if (!PROVENANCE.has(input.provenance)) fail("CONTENT_PROMOTION_PROVENANCE_REQUIRED", "Explicit promotion provenance is required");
  validateContentProject(input.contentProject);
  validatePlatformRunRef(input.platformRun);
  if (input.contentProject.companyId !== input.companyId) fail("CONTENT_PROMOTION_COMPANY_MISMATCH", "Project company does not match request", 403);
  if (input.platformRun.accountId !== input.accountId) fail("CONTENT_PROMOTION_ACCOUNT_MISMATCH", "Platform run account does not match request", 403);
  if (!input.contentProject.platformRuns.some((item) => sameRef(runRef(item), runRef(input.platformRun)))) fail("CONTENT_PROMOTION_RUN_NOT_IN_PROJECT", "Platform run is not bound to project");
  if (!sameRef(input.contentProject.sharedContentMasterRef, input.platformRun.sharedContentMasterRef)) fail("CONTENT_PROMOTION_MASTER_MISMATCH", "Shared master mismatch");
  validateEditorialSetReview(input.editorialReview, { contentProject: input.contentProject, platformRun: input.platformRun, candidateSet: input.candidateSet });
  if (input.editorialReview.status !== "passed") fail("CONTENT_PROMOTION_EDITORIAL_REVIEW_REQUIRED", "Editorial review must pass", 409);
  validateUserSelectionGate(input.selectionGate, { contentProject: input.contentProject, platformRun: input.platformRun, candidateSet: input.candidateSet, editorialReview: input.editorialReview });
  if (input.selectionGate.status !== "selected" || !input.selectionGate.userSelection) fail("CONTENT_PROMOTION_USER_SELECTION_REQUIRED", "Explicit selected user selection is required", 409);
  validatePlatformDeliveryBundle(input.deliveryBundle);
  if (input.deliveryBundle.platform !== input.platformRun.platform) fail("CONTENT_PROMOTION_DELIVERY_PLATFORM_MISMATCH", "Delivery platform mismatch");
  if (!sameRef(input.deliveryBundle.platformVersionRef, input.candidateSet.candidateRef)) fail("CONTENT_PROMOTION_CANDIDATE_VERSION_MISMATCH", "Delivery bundle is not the selected candidate version", 409);
  ref(input.sourceManifestRef, "CONTENT_PROMOTION_SOURCE_MANIFEST_REF_INVALID");
  ref(input.deliveryArtifactRef, "CONTENT_PROMOTION_DELIVERY_ARTIFACT_REF_INVALID");
  if (!sameRef(input.sourceManifestRef, input.deliveryBundle.manifestRef)) fail("CONTENT_PROMOTION_MANIFEST_HASH_MISMATCH", "Source manifest does not match delivery bundle", 409);
  if (!sameRef(input.deliveryArtifactRef, deliveryArtifactRef(input.deliveryBundle))) fail("CONTENT_PROMOTION_DELIVERY_HASH_MISMATCH", "Delivery artifact does not match delivery bundle", 409);
  assertOwnership(store, input);
  return input;
}

export function previewContentPromotion(store, input) {
  validateContentPromotionRequest(store, input);
  const request = immutableRequest(input);
  const inputHash = hashUnifiedContent(request);
  return Object.freeze({
    schemaVersion: "1.0",
    contract: "ContentPromotionPreview@1.0",
    status: "validated_read_only",
    inputHash,
    previewToken: `content-promotion-preview:${inputHash}`,
    bindings: Object.freeze({
      contentTaskId: request.contentTaskId,
      contentProjectRef: projectRef(request.contentProject),
      platformRunRef: runRef(request.platformRun),
      candidateVersionRef: clone(request.candidateSet.candidateRef),
      sourceManifestRef: clone(request.sourceManifestRef),
      deliveryArtifactRef: clone(request.deliveryArtifactRef),
      editorialReviewRef: reviewRef(request.editorialReview),
      userSelectionRef: selectionRef(request.selectionGate)
    }),
    claims: Object.freeze({ writesPerformed: false, candidateCopied: false, platformPublicationPerformed: false })
  });
}

function contentVersionFor(request, version, promotedAt, previewInputHash) {
  const base = {
    schemaVersion: "1.0",
    contract: "ImmutableContentVersion@1.0",
    id: `content_version_${randomUUID().slice(0, 12)}`,
    immutable: true,
    contentTaskId: request.contentTaskId,
    version,
    companyId: request.companyId,
    accountId: request.accountId,
    platform: request.platformRun.platform,
    contentProjectRef: projectRef(request.contentProject),
    platformRunRef: runRef(request.platformRun),
    sharedContentMasterRef: clone(request.contentProject.sharedContentMasterRef),
    activeStrategySnapshotRef: clone(request.contentProject.activeStrategySnapshotRef),
    candidateVersionRef: clone(request.candidateSet.candidateRef),
    editorialReviewRef: reviewRef(request.editorialReview),
    userSelectionRef: selectionRef(request.selectionGate),
    sourceManifestRef: clone(request.sourceManifestRef),
    deliveryArtifactRef: clone(request.deliveryArtifactRef),
    provenance: request.provenance,
    previewInputHash,
    promotedAt
  };
  return { ...base, versionHash: hashUnifiedContent(base) };
}

export function confirmContentPromotion(store, input, { now = new Date().toISOString() } = {}) {
  text(input?.idempotencyKey, "CONTENT_PROMOTION_IDEMPOTENCY_KEY_REQUIRED");
  const preview = previewContentPromotion(store, input?.request);
  if (input.previewToken !== preview.previewToken) fail("CONTENT_PROMOTION_PREVIEW_TOKEN_MISMATCH", "Preview token does not match exact promotion input", 409);
  const { contentPromotions, contentVersions } = ensureContentPromotionStore(store);
  const existing = contentPromotions.find((item) => item.idempotencyKey === input.idempotencyKey);
  if (existing) {
    const version = contentVersions.find((item) => sameRef({ id: item.id, hash: item.versionHash }, existing.promotedVersionRef));
    if (!version) fail("CONTENT_PROMOTION_VERSION_REFERENCE_MISSING", "Promoted immutable version is missing", 409);
    if (version.previewInputHash !== preview.inputHash) fail("CONTENT_PROMOTION_IDEMPOTENCY_CONFLICT", "Idempotency key was used for another promotion", 409);
    return { promotion: existing, contentVersion: version, created: false };
  }
  const promotedAt = new Date(now).toISOString();
  const request = immutableRequest(input.request);
  const previousVersions = contentVersions.filter((item) => item.contentTaskId === request.contentTaskId).map((item) => Number(item.version) || 0);
  const contentVersion = contentVersionFor(request, Math.max(0, ...previousVersions) + 1, promotedAt, preview.inputHash);
  const promotedVersionRef = { id: contentVersion.id, hash: contentVersion.versionHash };
  if (contentVersions.some((item) => item.id === contentVersion.id || sameRef({ id: item.id, hash: item.versionHash }, promotedVersionRef))) fail("CONTENT_PROMOTION_VERSION_IMMUTABLE_CONFLICT", "Immutable content version already exists", 409);
  const promotion = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: "PromotionRecord@1.0",
    id: `promotion_${randomUUID().slice(0, 12)}`,
    companyId: request.companyId,
    accountId: request.accountId,
    contentProjectRef: projectRef(request.contentProject),
    platformRunRef: runRef(request.platformRun),
    sharedContentMasterRef: clone(request.contentProject.sharedContentMasterRef),
    activeStrategySnapshotRef: clone(request.contentProject.activeStrategySnapshotRef),
    editorialReview: { ref: reviewRef(request.editorialReview), status: "passed" },
    userSelection: { ref: selectionRef(request.selectionGate), status: "confirmed" },
    sourceManifestRef: clone(request.sourceManifestRef),
    deliveryArtifactRef: clone(request.deliveryArtifactRef),
    promotedVersionRef,
    idempotencyKey: input.idempotencyKey,
    provenance: request.provenance,
    promotedAt,
    promotionHash: ""
  }, "promotionHash");
  validatePromotionRecord(promotion, { project: request.contentProject, platformRun: request.platformRun, selection: request.selectionGate.userSelection });
  contentVersions.push(contentVersion);
  contentPromotions.push(promotion);
  return { promotion, contentVersion, created: true };
}

export function listContentPromotions(store, filters = {}) {
  const { contentPromotions, contentVersions } = ensureContentPromotionStore(store);
  return contentPromotions.filter((item) =>
    (!filters.companyId || item.companyId === filters.companyId)
    && (!filters.accountId || item.accountId === filters.accountId)
    && (!filters.contentTaskId || contentVersions.some((version) => version.contentTaskId === filters.contentTaskId && sameRef({ id: version.id, hash: version.versionHash }, item.promotedVersionRef)))
  );
}

export function getContentPromotion(store, id) {
  return ensureContentPromotionStore(store).contentPromotions.find((item) => item.id === id) || null;
}

export function publicationPromotionBinding(store, task, payload = {}) {
  const taskPromotions = listContentPromotions(store, { contentTaskId: task.id });
  if (!taskPromotions.length) {
    if (payload.promotionId || payload.promotedVersionRef) fail("PUBLICATION_PROMOTION_NOT_FOUND", "No promotion exists for this legacy task", 409);
    return { promotionStatus: "legacy_unpromoted", promotionRecordRef: null, promotedVersionRef: null };
  }
  const promotion = taskPromotions.find((item) => item.id === payload.promotionId);
  if (!promotion) fail("PUBLICATION_PROMOTION_REQUIRED", "Publication must identify the task promotion", 409);
  ref(payload.promotedVersionRef, "PUBLICATION_PROMOTED_VERSION_REF_REQUIRED");
  if (!sameRef(payload.promotedVersionRef, promotion.promotedVersionRef)) fail("PUBLICATION_PROMOTED_VERSION_MISMATCH", "Publication version does not match promoted version", 409);
  const version = ensureContentPromotionStore(store).contentVersions.find((item) => sameRef({ id: item.id, hash: item.versionHash }, promotion.promotedVersionRef));
  if (!version) fail("PUBLICATION_PROMOTED_VERSION_MISSING", "Promoted version is missing", 409);
  const taskAccountId = task.socialAccountId || task.accountId;
  if (promotion.companyId !== task.companyId || promotion.accountId !== taskAccountId || version.contentTaskId !== task.id || version.platform !== (payload.platform || task.platform)) fail("PUBLICATION_PROMOTION_OWNERSHIP_MISMATCH", "Promotion ownership or platform does not match publication", 403);
  if (payload.platformRunId && payload.platformRunId !== promotion.platformRunRef.id) fail("PUBLICATION_PROMOTION_RUN_MISMATCH", "Promotion platform run does not match publication", 409);
  return {
    promotionStatus: "promoted_exact_version",
    promotionRecordRef: { id: promotion.id, hash: promotion.promotionHash },
    promotedVersionRef: clone(promotion.promotedVersionRef)
  };
}

export function projectPublicationPromotionReadOnly(publication) {
  if (publication?.promotionStatus) return publication;
  return { ...publication, promotionStatus: "legacy_unpromoted", promotionRecordRef: null, promotedVersionRef: null };
}
