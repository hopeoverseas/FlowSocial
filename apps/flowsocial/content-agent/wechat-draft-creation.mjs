import { createHash } from "node:crypto";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { projectAtomicWechatPromotionUploadDelivery, resolveAtomicWechatManualPublicationContext } from "./wechat-illustrated-delivery.mjs";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => structuredClone(value);

function fail(code, message = code, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code, 400);
  return value.trim();
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function factRef(value) {
  return { id: value.id, hash: value.factHash };
}

function timestamp(value, code) {
  const raw = text(value, code);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) fail(code, code, 400);
  return parsed.toISOString();
}

function currentClosure(store, input, featureFlags) {
  if (featureFlags.atomicWechatDraftCreationV1 !== true) fail("ATOMIC_WECHAT_DRAFT_CREATION_DISABLED", "Atomic WeChat draft creation is disabled", 404);
  const state = projectAtomicWechatPromotionUploadDelivery(store, input, { featureFlags });
  if (!state.deliveryReady || !state.deliveryRef) fail("ATOMIC_WECHAT_DRAFT_DELIVERY_REQUIRED", "Exact uploaded final delivery is required", 409);
  const delivery = (store.unifiedAtomicWechatDeliveries || []).find((item) => sameRef(factRef(item), state.deliveryRef));
  if (!delivery) fail("ATOMIC_WECHAT_DRAFT_DELIVERY_REQUIRED", "Exact uploaded final delivery is required", 409);
  return resolveAtomicWechatManualPublicationContext(store, {
    ...input,
    contentProjectRef: delivery.contentProjectRef,
    materializedContentProjectRef: delivery.materializedContentProjectRef,
    commitRef: delivery.commitRef,
    platformRunRef: delivery.platformRunRef,
    articleRef: delivery.articleRef,
    promotionRef: delivery.promotionRef,
    promotedVersionRef: delivery.promotedVersionRef,
    deliveryRef: factRef(delivery),
    manifestRef: delivery.manifestRef,
    uploadEvidenceRef: delivery.uploadEvidenceRef,
    postUploadRef: delivery.postUploadRef
  }, { featureFlags });
}

function draftPayload(context) {
  const { version, execution, postUpload } = context;
  const cover = execution.attempts.find((item) => item.role === "cover" && item.status === "succeeded");
  const title = text(version.article?.recommended_title || version.article?.title, "ATOMIC_WECHAT_DRAFT_TITLE_REQUIRED");
  const content = text(postUpload.html, "ATOMIC_WECHAT_DRAFT_CONTENT_REQUIRED");
  const thumbMediaId = text(cover?.response?.mediaId, "ATOMIC_WECHAT_DRAFT_THUMB_MEDIA_ID_REQUIRED");
  const digest = String(version.article?.abstract || version.article?.share_summary || "").trim().slice(0, 120);
  if (title.length > 64) fail("ATOMIC_WECHAT_DRAFT_TITLE_TOO_LONG", "WeChat draft title exceeds 64 characters", 409);
  if (content.length > 20_000 || Buffer.byteLength(content) >= 1_000_000) fail("ATOMIC_WECHAT_DRAFT_CONTENT_TOO_LARGE", "WeChat draft content exceeds platform limits", 409);
  return {
    title,
    author: "",
    digest,
    content,
    contentSourceUrl: "",
    thumbMediaId,
    needOpenComment: 0,
    onlyFansCanComment: 0
  };
}

function draftRequest(context) {
  const { authority, promotion, version, delivery, evidence, postUpload } = context;
  const draft = draftPayload(context);
  return {
    schemaVersion: "1.0",
    contract: "AtomicWechatDraftCreationRequest@1.0",
    workspaceId: authority.workspaceId,
    companyId: authority.companyId,
    accountId: authority.accountId,
    platform: "wechat",
    contentProjectRef: clone(authority.executionProjectRef),
    materializedContentProjectRef: clone(authority.materializedProjectRef),
    commitRef: clone(authority.payload.commitRef),
    platformRunRef: clone(authority.platformRunRef),
    articleRef: clone(authority.candidateRef),
    promotionRef: { id: promotion.id, hash: promotion.promotionHash },
    promotedVersionRef: clone(promotion.promotedVersionRef),
    deliveryRef: factRef(delivery),
    manifestRef: clone(delivery.manifestRef),
    uploadEvidenceRef: factRef(evidence),
    postUploadRef: factRef(postUpload),
    draft,
    contentSha256: createHash("sha256").update(draft.content).digest("hex"),
    claims: { resourceUploadPerformed: true, draftCreationPerformed: false, platformPublicationPerformed: false }
  };
}

export function previewAtomicWechatDraftCreation(store, input, { featureFlags = {}, contextResolver = currentClosure } = {}) {
  const request = draftRequest(contextResolver(store, input, featureFlags));
  const inputHash = hashUnifiedContent(request);
  return Object.freeze({
    schemaVersion: "1.0",
    contract: "AtomicWechatDraftCreationPreflight@1.0",
    status: "validated_read_only",
    inputHash,
    previewToken: `atomic-wechat-draft-preview:${inputHash}`,
    request,
    claims: Object.freeze({ writesPerformed: false, providerCalls: 0, draftCreated: false, platformPublicationPerformed: false, explicitHumanConfirmationRequired: true })
  });
}

function validateExecution(value) {
  if (value?.schemaVersion !== "1.0" || value.contract !== "AtomicWechatDraftCreationExecution@1.0"
    || !HASH.test(value.requestHash || "") || !HASH.test(value.factHash || "") || value.actorType !== "user"
    || !["succeeded", "result_unknown"].includes(value.status) || value.platformPublicationPerformed !== false
    || (value.status === "succeeded" && (value.draftCreated !== true || value.effectUnknown !== false || typeof value.mediaId !== "string" || !value.mediaId.trim()))
    || (value.status === "result_unknown" && (value.draftCreated !== false || value.effectUnknown !== true || value.mediaId !== null))) {
    fail("ATOMIC_WECHAT_DRAFT_EXECUTION_INVALID", "Stored WeChat draft execution is invalid", 409);
  }
  const copy = clone(value); delete copy.factHash;
  if (hashUnifiedContent(copy) !== value.factHash) fail("ATOMIC_WECHAT_DRAFT_EXECUTION_INVALID", "Stored WeChat draft execution is invalid", 409);
  return value;
}

function validateDraftArtifact(value, execution, request) {
  if (value?.schemaVersion !== "1.0" || value.contract !== "WechatDraftArtifactFact@1.0" || value.kind !== "draft"
    || value.semantics !== "wechat_draft_created_not_published" || value.draftCreated !== true
    || value.platformPublicationPerformed !== false || !sameRef(value.predecessorRef, request.postUploadRef)
    || !sameRef(value.evidenceRef, factRef(execution)) || !sameRef(value.deliveryRef, request.deliveryRef)
    || value.mediaId !== execution.mediaId || !HASH.test(value.factHash || "")) {
    fail("ATOMIC_WECHAT_DRAFT_ARTIFACT_INVALID", "Stored WeChat draft artifact is invalid", 409);
  }
  const copy = clone(value); delete copy.factHash;
  if (hashUnifiedContent(copy) !== value.factHash) fail("ATOMIC_WECHAT_DRAFT_ARTIFACT_INVALID", "Stored WeChat draft artifact is invalid", 409);
  return value;
}

function buildExecution(preflight, { idempotencyKey, actorId, confirmedAt, requestHash, now, status, mediaId = null, effectUnknown = false, failure = null }) {
  const base = {
    ...clone(preflight.request),
    schemaVersion: "1.0",
    contract: "AtomicWechatDraftCreationExecution@1.0",
    id: `atomic-wechat-draft-execution:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    actorType: "user",
    actorId,
    confirmedAt,
    requestHash,
    idempotencyKey,
    status,
    mediaId,
    draftCreated: status === "succeeded",
    effectUnknown,
    failure,
    platformPublicationPerformed: false,
    recordedAt: timestamp(now, "ATOMIC_WECHAT_DRAFT_RECORDED_AT_INVALID")
  };
  return validateExecution({ ...base, factHash: hashUnifiedContent(base) });
}

function buildDraftArtifact(execution) {
  const base = {
    schemaVersion: "1.0",
    contract: "WechatDraftArtifactFact@1.0",
    id: `wechat-draft:${execution.id}`,
    workspaceId: execution.workspaceId,
    companyId: execution.companyId,
    accountId: execution.accountId,
    platform: "wechat",
    contentProjectRef: clone(execution.contentProjectRef),
    materializedContentProjectRef: clone(execution.materializedContentProjectRef),
    commitRef: clone(execution.commitRef),
    platformRunRef: clone(execution.platformRunRef),
    articleRef: clone(execution.articleRef),
    promotionRef: clone(execution.promotionRef),
    promotedVersionRef: clone(execution.promotedVersionRef),
    deliveryRef: clone(execution.deliveryRef),
    manifestRef: clone(execution.manifestRef),
    uploadEvidenceRef: clone(execution.uploadEvidenceRef),
    predecessorRef: clone(execution.postUploadRef),
    evidenceRef: factRef(execution),
    kind: "draft",
    semantics: "wechat_draft_created_not_published",
    mediaId: execution.mediaId,
    draftCreated: true,
    platformPublicationPerformed: false,
    finalBundleAuthority: false,
    recordedAt: execution.recordedAt
  };
  return validateDraftArtifact({ ...base, factHash: hashUnifiedContent(base) }, execution, execution);
}

export async function executeAtomicWechatDraftCreation(store, input, { featureFlags = {}, transport, contextResolver = currentClosure, now = new Date().toISOString() } = {}) {
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_WECHAT_DRAFT_IDEMPOTENCY_KEY_REQUIRED");
  const preflight = previewAtomicWechatDraftCreation(store, input?.request || {}, { featureFlags, contextResolver });
  if (input?.previewToken !== preflight.previewToken) fail("ATOMIC_WECHAT_DRAFT_PREVIEW_TOKEN_MISMATCH", "Draft preview is stale", 409);
  if (input?.actorType !== "user") fail("ATOMIC_WECHAT_DRAFT_EXPLICIT_USER_REQUIRED", "Draft creation requires actorType=user", 400);
  const actorId = text(input?.actorId, "ATOMIC_WECHAT_DRAFT_ACTOR_REQUIRED");
  const confirmedAt = timestamp(input?.confirmedAt, "ATOMIC_WECHAT_DRAFT_CONFIRMED_AT_REQUIRED");
  const requestHash = hashUnifiedContent({ inputHash: preflight.inputHash, actorType: "user", actorId, confirmedAt });
  const executions = Array.isArray(store.unifiedAtomicWechatDraftExecutions) ? store.unifiedAtomicWechatDraftExecutions : [];
  const existing = executions.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    if (validateExecution(existing).requestHash !== requestHash) fail("ATOMIC_WECHAT_DRAFT_IDEMPOTENCY_CONFLICT", "Draft creation semantics changed", 409);
    return { execution: clone(existing), created: false, providerCalls: 0 };
  }
  const priorForDelivery = executions.map(validateExecution).find((item) => sameRef(item.deliveryRef, preflight.request.deliveryRef));
  if (priorForDelivery) fail("ATOMIC_WECHAT_DRAFT_ALREADY_ATTEMPTED", "This exact delivery already has a draft attempt; reconcile it instead of calling WeChat again", 409);
  if (typeof transport !== "function") fail("ATOMIC_WECHAT_DRAFT_TRANSPORT_REQUIRED", "Controlled WeChat draft transport is unavailable", 409);
  let response;
  try {
    response = await transport({ accountId: preflight.request.accountId, draft: clone(preflight.request.draft) });
  } catch (error) {
    if (error?.effectUnknown !== true && error?.code !== "WECHAT_DRAFT_RESULT_UNKNOWN") throw error;
    const execution = buildExecution(preflight, {
      idempotencyKey, actorId, confirmedAt, requestHash, now, status: "result_unknown", effectUnknown: true,
      failure: { code: "WECHAT_DRAFT_RESULT_UNKNOWN", message: String(error?.message || "WeChat draft result is unknown") }
    });
    store.unifiedAtomicWechatDraftExecutions = [...executions, execution];
    return { execution: clone(execution), draftArtifact: null, created: true, providerCalls: 1 };
  }
  const mediaId = text(response?.mediaId, "ATOMIC_WECHAT_DRAFT_MEDIA_ID_REQUIRED");
  const execution = buildExecution(preflight, { idempotencyKey, actorId, confirmedAt, requestHash, now, status: "succeeded", mediaId, effectUnknown: false });
  const draftArtifact = buildDraftArtifact(execution);
  store.unifiedAtomicWechatDraftExecutions = [...executions, execution];
  store.unifiedContentWechatLifecycleFacts = [...(store.unifiedContentWechatLifecycleFacts || []), draftArtifact];
  return { execution: clone(execution), draftArtifact: clone(draftArtifact), created: true, providerCalls: 1 };
}

export function projectAtomicWechatDraftCreation(store, input, { featureFlags = {}, contextResolver = currentClosure } = {}) {
  const preflight = previewAtomicWechatDraftCreation(store, input, { featureFlags, contextResolver });
  const executions = (store.unifiedAtomicWechatDraftExecutions || []).map(validateExecution)
    .filter((item) => sameRef(item.deliveryRef, preflight.request.deliveryRef));
  const execution = executions.at(-1) || null;
  const draftArtifact = execution?.status === "succeeded"
    ? (store.unifiedContentWechatLifecycleFacts || []).find((item) => item.contract === "WechatDraftArtifactFact@1.0" && sameRef(item.evidenceRef, factRef(execution)))
    : null;
  if (execution?.status === "succeeded" && !draftArtifact) fail("ATOMIC_WECHAT_DRAFT_ARTIFACT_REQUIRED", "Successful WeChat draft execution is missing lifecycle evidence", 409);
  if (draftArtifact) validateDraftArtifact(draftArtifact, execution, preflight.request);
  return {
    schemaVersion: "1.0",
    contract: "AtomicWechatDraftCreationProjection@1.0",
    ready: true,
    draftCreated: Boolean(draftArtifact),
    effectUnknown: execution?.effectUnknown === true,
    published: false,
    executionRef: execution ? factRef(execution) : null,
    mediaId: execution?.mediaId || null,
    blockers: draftArtifact ? ["wechat_draft_not_published"] : execution?.effectUnknown ? ["wechat_draft_result_unknown_reconciliation_required"] : ["wechat_draft_confirmation_required"]
  };
}
