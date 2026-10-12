import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { projectAtomicWechatPromotionUploadDelivery, resolveAtomicWechatManualPublicationContext } from "./wechat-illustrated-delivery.mjs";

const HASH = /^[a-f0-9]{64}$/;
const XHS_CONTENT_ID = /^[a-f0-9]{24}$/;
const XHS_HOSTS = new Set(["xiaohongshu.com", "www.xiaohongshu.com"]);
const WECHAT_CONTENT_ID = /^[A-Za-z0-9_-]{6,256}$/;
const clone = (value) => structuredClone(value);

function fail(code, message = code, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code, 400);
  return value.trim();
}

function ref(value, code) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "hash,id"
    || typeof value.id !== "string" || !value.id.trim() || !HASH.test(value.hash || "")) fail(code, code, 400);
  return value;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function assertRef(actual, expected, code) {
  ref(actual, code);
  if (!sameRef(actual, expected)) fail(code, code, 409, { expected, actual });
}

function validSelfHash(value, field) {
  if (!value || !HASH.test(value[field] || "")) return false;
  const copy = clone(value); delete copy[field];
  return hashUnifiedContent(copy) === value[field];
}

function validManifest(manifest, manifestRef, promotedVersionRef) {
  if (manifest?.schemaVersion !== "1.0" || manifest.contract !== "PlatformDeliveryBundleManifest@1.0"
    || manifest.platform !== "xiaohongshu" || !sameRef(manifest.platformVersionRef, promotedVersionRef)
    || manifest.states?.publication?.status !== "not_published" || manifest.claims?.platformPublicationPerformed !== false
    || manifest.claims?.deliveryReady !== true || manifest.manifestHash !== manifestRef?.hash) return false;
  const copy = clone(manifest); delete copy.manifestHash;
  return stableHash(copy) === manifest.manifestHash;
}

function resolveExactXhsPublicationContext(store, input, featureFlags, requireCurrent = true) {
  if (featureFlags.unifiedContentAtomicProductV1 !== true) fail("ATOMIC_MANUAL_PUBLICATION_AUTHORITY_DISABLED", "Atomic product authority is required", 409);
  const authority = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu" }, { atomicProductEnabled: true });
  if (authority.authorityKind !== "atomic_v2") fail("ATOMIC_MANUAL_PUBLICATION_AUTHORITY_REQUIRED");
  assertRef(input.contentProjectRef, authority.executionProjectRef, "ATOMIC_MANUAL_PUBLICATION_PROJECT_MISMATCH");
  assertRef(input.materializedContentProjectRef, authority.materializedProjectRef, "ATOMIC_MANUAL_PUBLICATION_MATERIALIZED_PROJECT_MISMATCH");
  assertRef(input.commitRef, authority.payload.commitRef, "ATOMIC_MANUAL_PUBLICATION_COMMIT_MISMATCH");
  assertRef(input.platformRunRef, authority.platformRunRef, "ATOMIC_MANUAL_PUBLICATION_RUN_MISMATCH");
  assertRef(input.candidateRef, authority.candidateRef, "ATOMIC_MANUAL_PUBLICATION_CANDIDATE_MISMATCH");
  if (requireCurrent && authority.payload.projection.deliveryReady !== true) fail("ATOMIC_MANUAL_PUBLICATION_DELIVERY_NOT_READY");

  const promotionRef = ref(input.promotionRef, "ATOMIC_MANUAL_PUBLICATION_PROMOTION_REF_REQUIRED");
  const promotions = (store.contentPromotions || []).filter((item) => item?.contract === "AtomicXhsPromotionRecord@1.0"
    && sameRef({ id: item.id, hash: item.promotionHash }, promotionRef));
  if (promotions.length !== 1 || !validSelfHash(promotions[0], "promotionHash")) fail("ATOMIC_MANUAL_PUBLICATION_PROMOTION_MISMATCH");
  const promotion = promotions[0];
  if (promotion.workspaceId !== authority.workspaceId || promotion.companyId !== authority.companyId || promotion.accountId !== authority.accountId
    || promotion.platform !== "xiaohongshu" || promotion.platformPublicationPerformed !== false
    || !sameRef(promotion.contentProjectRef, authority.executionProjectRef) || !sameRef(promotion.materializedContentProjectRef, authority.materializedProjectRef)
    || !sameRef(promotion.commitRef, authority.payload.commitRef) || !sameRef(promotion.platformRunRef, authority.platformRunRef)
    || !sameRef(promotion.candidateRef, authority.candidateRef)) fail("ATOMIC_MANUAL_PUBLICATION_PROMOTION_SCOPE_MISMATCH");
  assertRef(input.promotedVersionRef, promotion.promotedVersionRef, "ATOMIC_MANUAL_PUBLICATION_VERSION_MISMATCH");
  const versions = (store.contentVersions || []).filter((item) => item?.contract === "AtomicXhsImmutableContentVersion@1.0"
    && sameRef({ id: item.id, hash: item.versionHash }, promotion.promotedVersionRef));
  if (versions.length !== 1 || !validSelfHash(versions[0], "versionHash")) fail("ATOMIC_MANUAL_PUBLICATION_VERSION_INVALID");
  const version = versions[0];
  if (version.workspaceId !== authority.workspaceId || version.companyId !== authority.companyId || version.accountId !== authority.accountId
    || version.platform !== "xiaohongshu" || !sameRef(version.contentProjectRef, authority.executionProjectRef)
    || !sameRef(version.materializedContentProjectRef, authority.materializedProjectRef) || !sameRef(version.commitRef, authority.payload.commitRef)
    || !sameRef(version.platformRunRef, authority.platformRunRef) || !sameRef(version.candidateRef, authority.candidateRef)) {
    fail("ATOMIC_MANUAL_PUBLICATION_VERSION_SCOPE_MISMATCH");
  }

  const deliveryRef = ref(input.deliveryRef, "ATOMIC_MANUAL_PUBLICATION_DELIVERY_REF_REQUIRED");
  const deliveries = (store.unifiedAtomicXhsDeliveries || []).filter((item) => item?.contract === "AtomicXhsFinalDeliveryRecord@1.0"
    && sameRef({ id: item.id, hash: item.deliveryHash }, deliveryRef));
  if (deliveries.length !== 1 || !validSelfHash(deliveries[0], "deliveryHash")) fail("ATOMIC_MANUAL_PUBLICATION_DELIVERY_MISMATCH");
  const delivery = deliveries[0];
  if (delivery.workspaceId !== authority.workspaceId || delivery.companyId !== authority.companyId || delivery.accountId !== authority.accountId
    || delivery.deliveryReady !== true || delivery.platformPublicationPerformed !== false
    || !sameRef(delivery.contentProjectRef, authority.executionProjectRef) || !sameRef(delivery.materializedContentProjectRef, authority.materializedProjectRef)
    || !sameRef(delivery.platformRunRef, authority.platformRunRef) || !sameRef(delivery.candidateRef, authority.candidateRef)
    || !sameRef(delivery.promotionRef, promotionRef) || !sameRef(delivery.promotedVersionRef, promotion.promotedVersionRef)) {
    fail("ATOMIC_MANUAL_PUBLICATION_DELIVERY_SCOPE_MISMATCH");
  }
  assertRef(input.manifestRef, delivery.manifestRef, "ATOMIC_MANUAL_PUBLICATION_MANIFEST_MISMATCH");
  if (!validManifest(delivery.manifest, delivery.manifestRef, promotion.promotedVersionRef)) fail("ATOMIC_MANUAL_PUBLICATION_MANIFEST_INVALID");
  return { authority, promotion, version, delivery };
}

function publicationRequest(context, platform) {
  const { authority, promotion, delivery } = context;
  const common = {
    schemaVersion: "1.0", contract: "ControlledManualPublicationRequest@1.0",
    workspaceId: authority.workspaceId, companyId: authority.companyId, accountId: authority.accountId, platform,
    contentProjectRef: clone(authority.executionProjectRef), materializedContentProjectRef: clone(authority.materializedProjectRef),
    commitRef: clone(authority.payload.commitRef), platformRunRef: clone(authority.platformRunRef),
    promotionRef: { id: promotion.id, hash: promotion.promotionHash }, promotedVersionRef: clone(promotion.promotedVersionRef),
    deliveryRef: platform === "wechat" ? { id: delivery.id, hash: delivery.factHash } : { id: delivery.id, hash: delivery.deliveryHash },
    manifestRef: clone(delivery.manifestRef)
  };
  return platform === "wechat"
    ? { ...common, articleRef: clone(authority.candidateRef), uploadEvidenceRef: { id: context.evidence.id, hash: context.evidence.factHash }, postUploadRef: { id: context.postUpload.id, hash: context.postUpload.factHash } }
    : { ...common, candidateRef: clone(authority.candidateRef) };
}

export function previewAtomicManualPublication(store, input, { featureFlags = {}, requireCurrent = true } = {}) {
  const platform = input?.platform;
  if (!["xiaohongshu", "wechat"].includes(platform)) fail("ATOMIC_MANUAL_PUBLICATION_PLATFORM_INVALID", undefined, 400);
  const context = platform === "wechat"
    ? resolveAtomicWechatManualPublicationContext(store, input, { featureFlags, requireCurrent })
    : resolveExactXhsPublicationContext(store, input, featureFlags, requireCurrent);
  const request = publicationRequest(context, platform);
  const inputHash = hashUnifiedContent(request);
  return Object.freeze({
    schemaVersion: "1.0", contract: "ControlledManualPublicationPreflight@1.0", status: "validated_read_only",
    inputHash, previewToken: `atomic-manual-publication-preview:${inputHash}`, request,
    claims: Object.freeze({ writesPerformed: false, platformApiPublicationPerformed: false, humanConfirmationRequired: true })
  });
}

function timestamp(value, code, now) {
  const raw = text(value, code);
  const time = Date.parse(raw);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== raw || time > Date.parse(now)) fail(code, code, 400);
  return raw;
}

function normalizeXhsEvidence(input) {
  const explicit = input.platformContentId == null ? null : text(input.platformContentId, "ATOMIC_MANUAL_PUBLICATION_CONTENT_ID_INVALID").toLowerCase();
  if (explicit && !XHS_CONTENT_ID.test(explicit)) fail("ATOMIC_MANUAL_PUBLICATION_CONTENT_ID_INVALID", undefined, 400);
  let canonicalUrl = null;
  let fromUrl = null;
  if (input.platformUrl != null) {
    let parsed;
    try { parsed = new URL(text(input.platformUrl, "ATOMIC_MANUAL_PUBLICATION_URL_INVALID")); }
    catch { fail("ATOMIC_MANUAL_PUBLICATION_URL_INVALID", undefined, 400); }
    if (parsed.protocol !== "https:" || !XHS_HOSTS.has(parsed.hostname.toLowerCase()) || parsed.username || parsed.password || parsed.port) {
      fail("ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID", undefined, 400);
    }
    const match = parsed.pathname.match(/^\/(?:explore|discovery\/item)\/([a-fA-F0-9]{24})\/?$/);
    if (!match) fail("ATOMIC_MANUAL_PUBLICATION_URL_CONTENT_ID_INVALID", undefined, 400);
    fromUrl = match[1].toLowerCase();
    parsed.hash = ""; parsed.search = ""; parsed.hostname = "www.xiaohongshu.com"; parsed.pathname = `/explore/${fromUrl}`;
    canonicalUrl = parsed.toString();
  }
  if (!explicit && !fromUrl) fail("ATOMIC_MANUAL_PUBLICATION_EVIDENCE_REQUIRED", undefined, 400);
  if (explicit && fromUrl && explicit !== fromUrl) fail("ATOMIC_MANUAL_PUBLICATION_URL_ID_MISMATCH", undefined, 409);
  return { canonicalPlatformContentId: explicit || fromUrl, canonicalPlatformUrl: canonicalUrl };
}

function normalizeWechatEvidence(input) {
  let parsed;
  try { parsed = new URL(text(input.platformUrl, "ATOMIC_MANUAL_PUBLICATION_URL_INVALID")); }
  catch { fail("ATOMIC_MANUAL_PUBLICATION_URL_INVALID", undefined, 400); }
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "mp.weixin.qq.com" || parsed.username || parsed.password
    || parsed.port || parsed.hash || parsed.search) fail("ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID", undefined, 400);
  const match = parsed.pathname.match(/^\/s\/([A-Za-z0-9_-]{6,256})\/?$/);
  if (!match) fail("ATOMIC_MANUAL_PUBLICATION_URL_CONTENT_ID_INVALID", undefined, 400);
  const fromUrl = match[1];
  const explicit = input.platformContentId == null ? null : text(input.platformContentId, "ATOMIC_MANUAL_PUBLICATION_CONTENT_ID_INVALID");
  if (explicit && (!WECHAT_CONTENT_ID.test(explicit) || explicit !== fromUrl)) fail("ATOMIC_MANUAL_PUBLICATION_URL_ID_MISMATCH", undefined, 409);
  return { canonicalPlatformContentId: fromUrl, canonicalPlatformUrl: `https://mp.weixin.qq.com/s/${fromUrl}` };
}

function storedPublicationSemanticRequest(preflight, publication) {
  return {
    ...clone(preflight.request), actorType: publication.actorType, actorId: publication.actorId, method: publication.method,
    confirmedAt: publication.confirmedAt, publishedAt: publication.publishedAt,
    canonicalPlatformContentId: publication.canonicalPlatformContentId, canonicalPlatformUrl: publication.canonicalPlatformUrl
  };
}

function validateStoredPublicationClosure(store, publication, featureFlags) {
  validateControlledManualPublication(publication);
  const validationFlags = publication.platform === "wechat" ? {
    ...featureFlags,
    unifiedContentAtomicProductV1: true,
    unifiedContentAtomicWechatProductV1: true,
    unifiedContentAtomicWechatArtifactV1: true,
    unifiedContentAtomicWechatHumanSelectionV1: true,
    unifiedContentAtomicWechatPromotionUploadDeliveryV1: true
  } : { ...featureFlags, unifiedContentAtomicProductV1: true };
  const preflight = previewAtomicManualPublication(store, { ...publication, projectId: publication.contentProjectRef.id }, { featureFlags: validationFlags, requireCurrent: false });
  if (publication.requestHash !== hashUnifiedContent(storedPublicationSemanticRequest(preflight, publication))) {
    fail("ATOMIC_MANUAL_PUBLICATION_STORED_CLOSURE_INVALID");
  }
  return publication;
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function validateControlledManualPublicationClosure(store, publication, { featureFlags = {} } = {}) {
  return validateStoredPublicationClosure(store, publication, featureFlags);
}

export function confirmAtomicManualPublication(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  if (featureFlags.atomicManualPublicationV1 !== true) fail("ATOMIC_MANUAL_PUBLICATION_DISABLED", "Atomic manual publication is disabled", 404);
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_MANUAL_PUBLICATION_IDEMPOTENCY_KEY_REQUIRED");
  const preflight = previewAtomicManualPublication(store, input?.request, { featureFlags });
  if (input.previewToken !== preflight.previewToken) fail("ATOMIC_MANUAL_PUBLICATION_PREVIEW_TOKEN_MISMATCH");
  if (input.actorType !== "user") fail("ATOMIC_MANUAL_PUBLICATION_USER_REQUIRED", undefined, 400);
  const actorId = text(input.actorId, "ATOMIC_MANUAL_PUBLICATION_ACTOR_REQUIRED");
  if (input.method !== "manual_platform_observation") fail("ATOMIC_MANUAL_PUBLICATION_METHOD_INVALID", undefined, 400);
  const confirmedAt = timestamp(input.confirmedAt, "ATOMIC_MANUAL_PUBLICATION_CONFIRMED_AT_INVALID", now);
  const publishedAt = timestamp(input.publishedAt, "ATOMIC_MANUAL_PUBLICATION_PUBLISHED_AT_INVALID", now);
  if (Date.parse(publishedAt) > Date.parse(confirmedAt)) fail("ATOMIC_MANUAL_PUBLICATION_TIME_ORDER_INVALID", undefined, 400);
  const evidence = preflight.request.platform === "wechat" ? normalizeWechatEvidence(input) : normalizeXhsEvidence(input);
  const semanticRequest = { ...clone(preflight.request), actorType: "user", actorId, method: input.method, confirmedAt, publishedAt, ...evidence };
  const requestHash = hashUnifiedContent(semanticRequest);
  const publications = store.unifiedAtomicManualPublications === undefined ? [] : store.unifiedAtomicManualPublications;
  if (!Array.isArray(publications)) fail("ATOMIC_MANUAL_PUBLICATION_STORE_INVALID");
  publications.filter((item) => item?.platform === preflight.request.platform)
    .forEach((item) => validateStoredPublicationClosure(store, item, featureFlags));
  const existing = publications.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    validateStoredPublicationClosure(store, existing, featureFlags);
    if (existing.platform !== preflight.request.platform) fail("ATOMIC_MANUAL_PUBLICATION_IDEMPOTENCY_SCOPE_CONFLICT");
    if (existing.requestHash !== requestHash) fail("ATOMIC_MANUAL_PUBLICATION_IDEMPOTENCY_CONFLICT");
    return { publication: clone(existing), created: false };
  }
  if (publications.some((item) => item.platform === preflight.request.platform && item.accountId === preflight.request.accountId
    && item.canonicalPlatformContentId === evidence.canonicalPlatformContentId)) fail("ATOMIC_MANUAL_PUBLICATION_CONTENT_DUPLICATE");
  const identity = hashUnifiedContent({ requestHash, idempotencyKey });
  const base = {
    ...semanticRequest, schemaVersion: "1.0", contract: "ControlledManualPublication@1.0", id: `atomic-manual-publication:${identity.slice(0, 24)}`,
    idempotencyKey, requestHash, recordedAt: new Date(now).toISOString(), immutable: true,
    claims: { platformApiPublicationPerformed: false, humanPublicationConfirmed: true }
  };
  const publication = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedAtomicManualPublications = [...publications, publication];
  return { publication: clone(publication), created: true };
}

export function validateControlledManualPublication(value) {
  const requestHash = value?.requestHash;
  const idempotencyKey = value?.idempotencyKey;
  const expectedId = HASH.test(requestHash || "") && typeof idempotencyKey === "string" && idempotencyKey.trim()
    ? `atomic-manual-publication:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`
    : null;
  if (value?.contract !== "ControlledManualPublication@1.0" || value.schemaVersion !== "1.0" || value.immutable !== true
    || !["xiaohongshu", "wechat"].includes(value.platform) || value.actorType !== "user" || value.method !== "manual_platform_observation"
    || typeof value.actorId !== "string" || !value.actorId.trim() || !expectedId || value.id !== expectedId
    || !canonicalTimestamp(value.publishedAt) || !canonicalTimestamp(value.confirmedAt) || !canonicalTimestamp(value.recordedAt)
    || Date.parse(value.publishedAt) > Date.parse(value.confirmedAt) || Date.parse(value.confirmedAt) > Date.parse(value.recordedAt)
    || value.claims?.platformApiPublicationPerformed !== false || value.claims?.humanPublicationConfirmed !== true
    || (value.platform === "xiaohongshu" && !XHS_CONTENT_ID.test(value.canonicalPlatformContentId || ""))
    || (value.platform === "wechat" && (!WECHAT_CONTENT_ID.test(value.canonicalPlatformContentId || "")
      || value.canonicalPlatformUrl !== `https://mp.weixin.qq.com/s/${value.canonicalPlatformContentId}`
      || !ref(value.articleRef, "ATOMIC_MANUAL_PUBLICATION_ARTICLE_REF_INVALID")
      || !ref(value.uploadEvidenceRef, "ATOMIC_MANUAL_PUBLICATION_WECHAT_UPLOAD_EVIDENCE_INVALID")
      || !ref(value.postUploadRef, "ATOMIC_MANUAL_PUBLICATION_WECHAT_POSTUPLOAD_INVALID")))
    || !validSelfHash(value, "factHash")) {
    fail("ATOMIC_MANUAL_PUBLICATION_FACT_INVALID");
  }
  return true;
}

export function projectAtomicManualPublication(store, input, { featureFlags = {} } = {}) {
  let request = input;
  if (input?.platform === "wechat" && !input?.deliveryRef) {
    const deliveryState = projectAtomicWechatPromotionUploadDelivery(store, input, { featureFlags });
    if (!deliveryState.deliveryReady) return {
      schemaVersion: "1.0", contract: "ControlledManualPublicationProjection@1.0", platform: "wechat",
      published: false, publicationRef: null, canonicalPlatformContentId: null, canonicalPlatformUrl: null
    };
    const delivery = (store.unifiedAtomicWechatDeliveries || []).find((item) => sameRef({ id: item.id, hash: item.factHash }, deliveryState.deliveryRef));
    if (!delivery) fail("ATOMIC_MANUAL_PUBLICATION_DELIVERY_MISMATCH");
    request = {
      ...input, contentProjectRef: clone(delivery.contentProjectRef), materializedContentProjectRef: clone(delivery.materializedContentProjectRef),
      commitRef: clone(delivery.commitRef), platformRunRef: clone(delivery.platformRunRef), articleRef: clone(delivery.articleRef),
      promotionRef: clone(delivery.promotionRef), promotedVersionRef: clone(delivery.promotedVersionRef), uploadEvidenceRef: clone(delivery.uploadEvidenceRef),
      postUploadRef: clone(delivery.postUploadRef), deliveryRef: { id: delivery.id, hash: delivery.factHash }, manifestRef: clone(delivery.manifestRef)
    };
  }
  const preflight = previewAtomicManualPublication(store, request, { featureFlags });
  const publications = store.unifiedAtomicManualPublications === undefined ? [] : store.unifiedAtomicManualPublications;
  if (!Array.isArray(publications)) fail("ATOMIC_MANUAL_PUBLICATION_STORE_INVALID");
  const scoped = publications.filter((item) => item?.platform === preflight.request.platform && item?.accountId === preflight.request.accountId);
  scoped.forEach((item) => validateStoredPublicationClosure(store, item, featureFlags));
  const publication = scoped.filter((item) => item.requestHash === hashUnifiedContent(storedPublicationSemanticRequest(preflight, item))).at(-1) || null;
  return {
    schemaVersion: "1.0", contract: "ControlledManualPublicationProjection@1.0", platform: preflight.request.platform,
    published: Boolean(publication), publicationRef: publication ? { id: publication.id, hash: publication.factHash } : null,
    canonicalPlatformContentId: publication?.canonicalPlatformContentId || null,
    canonicalPlatformUrl: publication?.canonicalPlatformUrl || null
  };
}
