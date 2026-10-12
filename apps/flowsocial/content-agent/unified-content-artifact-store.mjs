import { createHash } from "node:crypto";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { validateIntegratedPageExecutionPlan } from "../image-providers/xhs-integrated-page/execution-plan.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { validateXhsDesignRuntimeEvidence } from "./xhs-design-runtime-adapter.mjs";
import {
  appendWechatDraftArtifactFact,
  appendWechatFormatArtifactFact,
  appendWechatImagePlanArtifactFact,
  appendWechatPostUploadArtifactFact,
  appendWechatPublicationArtifactFact,
  appendWechatQualityGateFact,
  appendWechatResourceResolutionAttempts,
  evaluateWechatPreUploadArtifactState
} from "./wechat-artifact-facts.mjs";
import { adaptWechatImagePlanOutput, hashWechatArtifactValue } from "./wechat-image-plan-adapter.mjs";
import {
  validateXhsArtifactFactAppendOnly,
  validateXhsPageRevisionFact,
  validateXhsProviderAttemptFact
} from "./xhs-page-artifact-facts.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";

const HASH = /^[a-f0-9]{64}$/;
const PLATFORMS = new Set(["xiaohongshu", "wechat"]);
const clone = (value) => value == null ? value : structuredClone(value);

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

function materializedMatches(fact, context) {
  return !context.authorityKind.startsWith("atomic_") || sameRef(fact.materializedContentProjectRef, context.materializedProjectRef);
}

function factRef(fact) {
  return { id: fact.id, hash: factHash(fact) };
}

function projectRef(value) {
  if (value?.executionProjectRef) return clone(value.executionProjectRef);
  return { id: value.contentProject.id, hash: value.contentProject.projectHash };
}

function runRef(value) {
  if (value?.executionProjectRef) return clone(value.platformRunRef);
  return { id: value.platformRunRef.id, hash: value.platformRunRef.hash };
}

export function ensureUnifiedContentArtifactStore(store) {
  store.unifiedContentXhsDesignFacts ||= [];
  store.unifiedContentXhsProviderAttemptFacts ||= [];
  store.unifiedContentXhsPageRevisionFacts ||= [];
  store.unifiedContentXhsProviderPlanFacts ||= [];
  store.unifiedContentXhsVisualReviewApprovalFacts ||= [];
  store.unifiedContentXhsVisualReviewInvocationFacts ||= [];
  store.unifiedContentXhsVisualReviewFacts ||= [];
  store.unifiedContentXhsHumanVisualConfirmationFacts ||= [];
  store.unifiedContentXhsVisualReviewCheckpointFacts ||= [];
  store.unifiedContentXhsProviderExecutionApprovalFacts ||= [];
  store.unifiedContentXhsProviderExecutionApprovalIdempotencyFacts ||= [];
  store.unifiedContentWechatPlanFacts ||= [];
  store.unifiedContentWechatResourceAttempts ||= [];
  store.unifiedContentWechatFormatFacts ||= [];
  store.unifiedContentWechatQualityFacts ||= [];
  store.unifiedContentWechatWholeArticleQualityFacts ||= [];
  store.unifiedContentWechatLifecycleFacts ||= [];
  store.unifiedContentWechatPreviewArtifacts ||= [];
  store.unifiedContentWechatPreuploadExecutionFacts ||= [];
  store.unifiedContentArtifactIdempotencyFacts ||= [];
  store.unifiedContentArtifactReviewActions ||= [];
  store.unifiedContentArtifactReviewIdempotency ||= [];
  store.unifiedAtomicWechatArtifactReviewFacts ||= [];
  return {
    xhsDesignFacts: store.unifiedContentXhsDesignFacts,
    xhsProviderAttempts: store.unifiedContentXhsProviderAttemptFacts,
    xhsPageRevisions: store.unifiedContentXhsPageRevisionFacts,
    xhsProviderPlans: store.unifiedContentXhsProviderPlanFacts,
    xhsVisualReviewApprovals: store.unifiedContentXhsVisualReviewApprovalFacts,
    xhsVisualReviewInvocations: store.unifiedContentXhsVisualReviewInvocationFacts,
    xhsVisualReviews: store.unifiedContentXhsVisualReviewFacts,
    xhsHumanVisualConfirmations: store.unifiedContentXhsHumanVisualConfirmationFacts,
    xhsVisualReviewCheckpoints: store.unifiedContentXhsVisualReviewCheckpointFacts,
    xhsProviderExecutionApprovals: store.unifiedContentXhsProviderExecutionApprovalFacts,
    idempotencyFacts: store.unifiedContentArtifactIdempotencyFacts,
    reviewActions: store.unifiedContentArtifactReviewActions,
    reviewIdempotency: store.unifiedContentArtifactReviewIdempotency,
    wechat: {
      planFacts: store.unifiedContentWechatPlanFacts,
      resourceAttempts: store.unifiedContentWechatResourceAttempts,
      formatFacts: store.unifiedContentWechatFormatFacts,
      qualityFacts: store.unifiedContentWechatQualityFacts,
      wholeArticleQualityFacts: store.unifiedContentWechatWholeArticleQualityFacts,
      lifecycleFacts: store.unifiedContentWechatLifecycleFacts
    },
    wechatPreviewArtifacts: store.unifiedContentWechatPreviewArtifacts,
    wechatPreuploadExecutionFacts: store.unifiedContentWechatPreuploadExecutionFacts
  };
}

function validateAtomicWechatArtifactReviewFact(fact) {
  const required = ["schemaVersion", "contract", "id", "workspaceId", "companyId", "accountId", "contentProjectRef", "materializedContentProjectRef", "platform", "platformRunRef", "candidateRef", "commitRef", "articleRef", "artifactStateHash", "artifactAuthoritySetHash", "action", "actorId", "actorType", "reason", "occurredAt", "idempotencyKey", "requestHash", "recordedAt", "uploadAuthority", "promotionAuthority", "deliveryAuthority", "publicationAuthority", "factHash"];
  if (!fact || Object.keys(fact).length !== required.length || !required.every((key) => Object.hasOwn(fact, key))
    || fact.schemaVersion !== "1.0" || fact.contract !== "UnifiedAtomicWechatArtifactReviewFact@1.0"
    || fact.platform !== "wechat" || !["approve_preupload", "reject_preupload"].includes(fact.action)
    || fact.actorType !== "user" || !HASH.test(fact.artifactStateHash || "") || !HASH.test(fact.artifactAuthoritySetHash || "")
    || !HASH.test(fact.factHash || "") || [fact.contentProjectRef, fact.materializedContentProjectRef, fact.platformRunRef, fact.candidateRef, fact.commitRef, fact.articleRef].some((value) => !value || !value.id || !HASH.test(value.hash || ""))
    || [fact.actorId, fact.reason, fact.occurredAt, fact.idempotencyKey, fact.requestHash, fact.recordedAt].some((value) => typeof value !== "string" || !value.trim())
    || Number.isNaN(Date.parse(fact.occurredAt)) || Number.isNaN(Date.parse(fact.recordedAt))
    || fact.uploadAuthority !== false || fact.promotionAuthority !== false || fact.deliveryAuthority !== false || fact.publicationAuthority !== false) {
    fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_FACT_INVALID");
  }
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_FACT_HASH_MISMATCH");
  const expectedRequestHash = hashUnifiedContent({ workspaceId: fact.workspaceId, companyId: fact.companyId, accountId: fact.accountId,
    contentProjectRef: fact.contentProjectRef, materializedContentProjectRef: fact.materializedContentProjectRef, platformRunRef: fact.platformRunRef,
    candidateRef: fact.candidateRef, commitRef: fact.commitRef, articleRef: fact.articleRef, artifactStateHash: fact.artifactStateHash,
    artifactAuthoritySetHash: fact.artifactAuthoritySetHash, action: fact.action, actorId: fact.actorId, actorType: fact.actorType,
    reason: fact.reason, occurredAt: fact.occurredAt });
  if (fact.requestHash !== expectedRequestHash
    || fact.id !== `atomic-wechat-artifact-review:${hashUnifiedContent({ requestHash: fact.requestHash, idempotencyKey: fact.idempotencyKey }).slice(0, 24)}`) {
    fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_FACT_SEMANTICS_INVALID");
  }
  return fact;
}

function resolveAtomicWechatReviewContext(store, input, featureFlags) {
  if (featureFlags.unifiedContentAtomicWechatHumanSelectionV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_HUMAN_SELECTION_DISABLED", "Atomic WeChat human selection is disabled", 404);
  const context = resolveOwnedContext(store, { ...input, platform: "wechat" }, featureFlags);
  if (context.authorityKind !== "atomic_wechat_v1" || context.platform !== "wechat") fail("UNIFIED_ATOMIC_WECHAT_REVIEW_AUTHORITY_REQUIRED");
  return context;
}

function atomicWechatArtifactAuthoritySet(context, stores, candidateRef) {
  const facts = stores.wechat;
  const scoped = (values, contract) => scopedWechatFacts(context, values, candidateRef).map((fact) => validateWechatFact(fact, contract));
  const refs = {
    planFactRefs: scoped(facts.planFacts, "WechatImagePlanArtifactFact@1.0").map(factRef),
    resourceAttemptRefs: scoped(facts.resourceAttempts, "WechatResourceResolutionAttempt@1.0").map(factRef),
    formatFactRefs: scoped(facts.formatFacts, "WechatPreUploadFormatArtifactFact@1.0").map(factRef),
    qualityFactRefs: scoped(facts.qualityFacts, "WechatArtifactQualityGateFact@1.0").map(factRef),
    wholeArticleQualityFactRefs: scoped(facts.wholeArticleQualityFacts || [], "WechatWholeArticleQualityFact@1.0").map(factRef),
    previewArtifactRefs: stores.wechatPreviewArtifacts.map(validatePreviewArtifact).filter((artifact) => artifact.workspaceId === context.workspaceId
      && artifact.companyId === context.companyId && artifact.accountId === context.accountId && sameRef(artifact.contentProjectRef, projectRef(context))
      && materializedMatches(artifact, context) && sameRef(artifact.platformRunRef, runRef(context)) && sameRef(artifact.candidateRef, candidateRef)).map(factRef)
  };
  return { refs, hash: hashUnifiedContent(refs) };
}

function sameAtomicWechatReviewScope(fact, context) {
  return fact.workspaceId === context.workspaceId && fact.companyId === context.companyId && fact.accountId === context.accountId
    && fact.platform === "wechat" && sameRef(fact.contentProjectRef, context.executionProjectRef)
    && sameRef(fact.materializedContentProjectRef, context.materializedProjectRef) && sameRef(fact.platformRunRef, context.platformRunRef)
    && sameRef(fact.candidateRef, context.candidateRef) && sameRef(fact.commitRef, context.payload.commitRef)
    && sameRef(fact.articleRef, context.candidateRef);
}

function resolveUnifiedAtomicWechatArtifactReviewBinding(store, input, featureFlags) {
  const context = resolveAtomicWechatReviewContext(store, input, featureFlags);
  const candidateRef = resolveCandidate(context, input?.candidateId);
  const artifactState = getUnifiedContentArtifactState(store, { ...input, platform: "wechat" }, { featureFlags });
  const authoritySet = atomicWechatArtifactAuthoritySet(context, readUnifiedContentArtifactStore(store), candidateRef);
  const facts = (store.unifiedAtomicWechatArtifactReviewFacts || []).map(validateAtomicWechatArtifactReviewFact)
    .filter((fact) => sameAtomicWechatReviewScope(fact, context));
  const latest = facts.at(-1) || null;
  const current = Boolean(latest && latest.artifactStateHash === artifactState.artifactStateHash
    && latest.artifactAuthoritySetHash === authoritySet.hash && artifactState.reviewable === true);
  const approved = Boolean(current && latest.action === "approve_preupload" && latest.actorType === "user");
  return {
    context, artifactState: clone(artifactState), artifactAuthoritySetHash: authoritySet.hash,
    artifactAuthorityRefs: clone(authoritySet.refs), reviewFacts: facts.map(clone),
    currentReviewFact: current ? clone(latest) : null, approved,
    stale: Boolean(facts.length && !current),
    currentReviewFactRef: current ? factRef(latest) : null
  };
}

export function getUnifiedAtomicWechatArtifactReviewBinding(store, input, { featureFlags = {} } = {}) {
  const { context: _context, ...binding } = resolveUnifiedAtomicWechatArtifactReviewBinding(store, input, featureFlags);
  return binding;
}

export function appendUnifiedAtomicWechatArtifactReview(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  rejectReviewProjectionAuthorityInjection(input);
  const binding = resolveUnifiedAtomicWechatArtifactReviewBinding(store, input, featureFlags);
  const { context, artifactState } = binding;
  if (artifactState.reviewable !== true) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_NOT_READY", "Technical and whole-article gates only open human review", 409);
  const expectedRefs = {
    commitRef: context.payload.commitRef, materializedContentProjectRef: context.materializedProjectRef,
    articleRef: context.candidateRef
  };
  for (const [key, expected] of Object.entries(expectedRefs)) assertBinding(input?.[key], expected, `UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_${key.toUpperCase()}_STALE`);
  if (input?.artifactStateHash !== artifactState.artifactStateHash || input?.artifactAuthoritySetHash !== binding.artifactAuthoritySetHash) {
    fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_STATE_STALE", "Review must bind the exact current Artifact State and authority set", 409);
  }
  const action = text(input?.action, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_ACTION_REQUIRED");
  if (!["approve_preupload", "reject_preupload"].includes(action)) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_ACTION_INVALID", "Use approve_preupload or reject_preupload", 400);
  if (input?.actorType !== "user") fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_EXPLICIT_USER_REQUIRED", "Human approval requires actorType=user", 400);
  const actorId = text(input?.actorId, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_ACTOR_REQUIRED");
  const reason = text(input?.reason, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_REASON_REQUIRED");
  const occurredAt = text(input?.occurredAt, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_OCCURRED_AT_REQUIRED");
  if (Number.isNaN(Date.parse(occurredAt))) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_OCCURRED_AT_INVALID", "occurredAt must be ISO-8601", 400);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_IDEMPOTENCY_KEY_REQUIRED");
  const requestHash = hashUnifiedContent({ workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: context.executionProjectRef, materializedContentProjectRef: context.materializedProjectRef, platformRunRef: context.platformRunRef,
    candidateRef: context.candidateRef, commitRef: context.payload.commitRef, articleRef: context.candidateRef,
    artifactStateHash: artifactState.artifactStateHash, artifactAuthoritySetHash: binding.artifactAuthoritySetHash,
    action, actorId, actorType: "user", reason, occurredAt: new Date(occurredAt).toISOString() });
  const all = (store.unifiedAtomicWechatArtifactReviewFacts || []).map(validateAtomicWechatArtifactReviewFact);
  const existing = all.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) fail("UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_IDEMPOTENCY_CONFLICT");
    return { reviewFact: clone(existing), created: false, reviewState: getUnifiedAtomicWechatArtifactReviewBinding(store, input, { featureFlags }) };
  }
  const base = { schemaVersion: "1.0", contract: "UnifiedAtomicWechatArtifactReviewFact@1.0",
    id: `atomic-wechat-artifact-review:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: clone(context.executionProjectRef), materializedContentProjectRef: clone(context.materializedProjectRef), platform: "wechat",
    platformRunRef: clone(context.platformRunRef), candidateRef: clone(context.candidateRef), commitRef: clone(context.payload.commitRef), articleRef: clone(context.candidateRef),
    artifactStateHash: artifactState.artifactStateHash, artifactAuthoritySetHash: binding.artifactAuthoritySetHash,
    action, actorId, actorType: "user", reason, occurredAt: new Date(occurredAt).toISOString(), idempotencyKey, requestHash,
    recordedAt: new Date(now).toISOString(), uploadAuthority: false, promotionAuthority: false, deliveryAuthority: false, publicationAuthority: false };
  const reviewFact = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedAtomicWechatArtifactReviewFacts = [...(store.unifiedAtomicWechatArtifactReviewFacts || []), reviewFact];
  return { reviewFact: clone(reviewFact), created: true, reviewState: getUnifiedAtomicWechatArtifactReviewBinding(store, input, { featureFlags }) };
}

function readUnifiedContentArtifactStore(store) {
  return {
    xhsDesignFacts: store.unifiedContentXhsDesignFacts || [],
    xhsProviderAttempts: store.unifiedContentXhsProviderAttemptFacts || [],
    xhsPageRevisions: store.unifiedContentXhsPageRevisionFacts || [],
    xhsProviderPlans: store.unifiedContentXhsProviderPlanFacts || [],
    xhsVisualReviewApprovals: store.unifiedContentXhsVisualReviewApprovalFacts || [],
    xhsVisualReviewInvocations: store.unifiedContentXhsVisualReviewInvocationFacts || [],
    xhsVisualReviews: store.unifiedContentXhsVisualReviewFacts || [],
    xhsHumanVisualConfirmations: store.unifiedContentXhsHumanVisualConfirmationFacts || [],
    xhsVisualReviewCheckpoints: store.unifiedContentXhsVisualReviewCheckpointFacts || [],
    xhsProviderExecutionApprovals: store.unifiedContentXhsProviderExecutionApprovalFacts || [],
    idempotencyFacts: store.unifiedContentArtifactIdempotencyFacts || [],
    reviewActions: store.unifiedContentArtifactReviewActions || [],
    reviewIdempotency: store.unifiedContentArtifactReviewIdempotency || [],
    wechat: {
      planFacts: store.unifiedContentWechatPlanFacts || [], resourceAttempts: store.unifiedContentWechatResourceAttempts || [],
      formatFacts: store.unifiedContentWechatFormatFacts || [], qualityFacts: store.unifiedContentWechatQualityFacts || [], wholeArticleQualityFacts: store.unifiedContentWechatWholeArticleQualityFacts || [], lifecycleFacts: store.unifiedContentWechatLifecycleFacts || []
    },
    wechatPreviewArtifacts: store.unifiedContentWechatPreviewArtifacts || [],
    wechatPreuploadExecutionFacts: store.unifiedContentWechatPreuploadExecutionFacts || []
  };
}

const PREVIEW_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function expectedImageType(path) {
  const extension = path.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  return { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" }[extension] || null;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safePayloadPath(value, code) {
  const path = text(value, code).replaceAll("\\", "/");
  if (/^(?:\/|[a-z]:|[a-z][a-z0-9+.-]*:|\/\/)/i.test(path) || path.split("/").some((part) => !part || part === "." || part === "..")) fail(code, code, 400);
  return path;
}

function validatePreviewArtifact(fact) {
  if (fact?.schemaVersion !== "1.0" || fact.contract !== "UnifiedWechatPreUploadPreviewArtifact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_INVALID");
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_HASH_MISMATCH");
  return fact;
}

function inlineWechatPreviewHtml(rawHtml, resources) {
  if (/<\s*\/?\s*(?:script|iframe|frame|object|embed|form|base|link|meta)\b/i.test(rawHtml)
    || /\son[a-z0-9_-]+\s*=/i.test(rawHtml) || /\bsrcset\s*=/i.test(rawHtml) || /@import\b/i.test(rawHtml)) {
    fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_ACTIVE_CONTENT_FORBIDDEN", "Active HTML content is forbidden", 400);
  }
  const byPath = new Map(resources.map((resource) => [resource.relativePath, `data:${resource.mediaType};base64,${resource.content}`]));
  let html = rawHtml;
  const resolveUrl = (raw) => {
    const value = raw.trim();
    if (!value || value.startsWith("#")) return value;
    const normalized = value.startsWith("./") ? value.slice(2) : value;
    if (/^(?:\/|[a-z][a-z0-9+.-]*:|\/\/)/i.test(normalized) || normalized.split("/").some((part) => part === "..")) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_EXTERNAL_RESOURCE_FORBIDDEN", value, 400);
    const replacement = byPath.get(normalized);
    if (!replacement) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_UNDECLARED", value, 400);
    return replacement;
  };
  html = html.replace(/\b(src|href|action|formaction|poster)\s*=\s*(["'])(.*?)\2/gi, (_match, attribute, quote, value) => `${attribute}=${quote}${resolveUrl(value)}${quote}`);
  html = html.replace(/\b(src|href|action|formaction|poster)\s*=\s*([^\s"'`=<>]+)/gi, (_match, attribute, value) => `${attribute}="${resolveUrl(value)}"`);
  html = html.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_match, quote, value) => `url(${quote}${resolveUrl(value)}${quote})`);
  const csp = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (head) => `${head}${csp}`) : `${csp}${html}`;
}

function validatedWechatPreviewMutation(context, stores, candidateRef, result, shadowWechat) {
  const payload = result.reviewPayload;
  if (payload == null) return { artifact: null, merged: stores.wechatPreviewArtifacts.map(clone) };
  if (payload?.schemaVersion !== "1.0" || payload.contract !== "WechatPreUploadReviewPayload@1.0" || payload.semantics !== "pre_upload_template_not_wechat_final") fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_PAYLOAD_INVALID", "Invalid WeChat preview payload", 400);
  const payloadBase = clone(payload); delete payloadBase.payloadHash;
  if (!HASH.test(payload.payloadHash || "") || hashWechatArtifactValue(payloadBase) !== payload.payloadHash) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_PAYLOAD_HASH_MISMATCH", "Preview payload hash mismatch", 400);
  assertBinding(payload.contentProjectRef, projectRef(context), "UNIFIED_ARTIFACT_WECHAT_PREVIEW_PROJECT_MISMATCH");
  assertBinding(payload.platformRunRef, runRef(context), "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RUN_MISMATCH");
  assertBinding(payload.candidateRef, candidateRef, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_CANDIDATE_MISMATCH");
  const formatFact = shadowWechat.formatFacts.find((fact) => sameRef(factRef(fact), payload.formatFactRef));
  if (!formatFact || formatFact.status !== "succeeded" || !sameRef(factRef(formatFact), result.formatFact ? factRef(result.formatFact) : null)) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_FORMAT_MISMATCH");
  const html = payload.html;
  if (html?.encoding !== "utf8" || safePayloadPath(html.relativePath, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_HTML_PATH_INVALID") !== "wechat-preupload.html" || typeof html.content !== "string") fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_HTML_INVALID", "Invalid preview HTML", 400);
  const htmlBytes = Buffer.from(html.content, "utf8");
  if (!Buffer.from(htmlBytes.toString("utf8"), "utf8").equals(htmlBytes) || htmlBytes.length !== html.bytes || sha256Bytes(htmlBytes) !== html.sha256 || html.bytes !== formatFact.htmlBytes || html.sha256 !== formatFact.htmlSha256) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_HTML_MISMATCH", "Preview HTML does not match format fact", 409);
  const expectedResourceRefs = formatFact.resourceAttemptRefs || formatFact.resourceRefs || [];
  const expectedAttempts = shadowWechat.resourceAttempts.filter((fact) => sameRef(fact.planFactRef, formatFact.planFactRef) && fact.status === "succeeded" && expectedResourceRefs.some((ref) => sameRef(ref, factRef(fact))));
  const supplied = Array.isArray(payload.resources) ? payload.resources : fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCES_REQUIRED", "Preview resources required", 400);
  if (supplied.length !== expectedAttempts.length) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_SET_MISMATCH", "Preview resource set mismatch", 409);
  const resources = supplied.map((resource) => {
    const attempt = expectedAttempts.find((fact) => sameRef(factRef(fact), resource?.attemptRef));
    if (!attempt || resource.assetId !== attempt.assetId || safePayloadPath(resource.relativePath, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_PATH_INVALID") !== attempt.relativePath) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_BINDING_MISMATCH", "Preview resource binding mismatch", 409);
    if (resource.encoding !== "base64" || !SAFE_IMAGE_TYPES.has(resource.mediaType) || resource.mediaType !== expectedImageType(resource.relativePath) || typeof resource.content !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(resource.content)) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_INVALID", "Invalid preview resource", 400);
    const bytes = Buffer.from(resource.content, "base64");
    if (bytes.length !== resource.bytes || sha256Bytes(bytes) !== resource.sha256 || bytes.length !== attempt.bytes || resource.sha256 !== attempt.sha256) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_MISMATCH", "Preview resource bytes mismatch", 409);
    return clone(resource);
  });
  if (new Set(resources.map((item) => item.attemptRef.id)).size !== resources.length) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_DUPLICATE", "Duplicate preview resource", 409);
  const previewHtml = inlineWechatPreviewHtml(html.content, resources);
  const previewBytes = Buffer.from(previewHtml, "utf8");
  const base = {
    schemaVersion: "1.0", contract: "UnifiedWechatPreUploadPreviewArtifact@1.0",
    id: `wechat-preview:${payload.payloadHash.slice(0, 24)}`, workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: projectRef(context), ...(context.authorityKind.startsWith("atomic_") ? { materializedContentProjectRef: clone(context.materializedProjectRef), authorityKind: context.authorityKind } : {}),
    platform: "wechat", platformRunRef: runRef(context), candidateRef: clone(candidateRef),
    semantics: "pre_upload_template_not_wechat_final", formatFactRef: factRef(formatFact), preUploadRef: { id: `wechat-preupload-payload:${payload.payloadHash.slice(0, 24)}`, hash: payload.payloadHash }, sourceHtml: { relativePath: html.relativePath, bytes: html.bytes, sha256: html.sha256 },
    resourceRefs: resources.map((item) => clone(item.attemptRef)), resources: resources.map((item) => ({ attemptRef: clone(item.attemptRef), assetId: item.assetId, relativePath: item.relativePath, mediaType: item.mediaType, bytes: item.bytes, sha256: item.sha256 })),
    previewHtml, previewBytes: previewBytes.length, previewSha256: sha256Bytes(previewBytes), csp: PREVIEW_CSP,
    sandbox: "", platformUploadPerformed: false, draftCreated: false, publicationPerformed: false, recordedAt: formatFact.recordedAt
  };
  const artifact = { ...base, factHash: hashUnifiedContent(base) };
  const existing = stores.wechatPreviewArtifacts.find((item) => item.id === artifact.id);
  if (existing && validatePreviewArtifact(existing).factHash !== artifact.factHash) fail("UNIFIED_ARTIFACT_WECHAT_PREVIEW_ID_CONFLICT");
  return { artifact, merged: existing ? stores.wechatPreviewArtifacts.map(clone) : [...stores.wechatPreviewArtifacts.map(clone), artifact] };
}

const XHS_REVIEW_ACTIONS = new Set(["approve_set", "reject_set", "exclude_page", "restore_page", "reorder_pages", "request_page_redo"]);
const WECHAT_REVIEW_ACTIONS = new Set(["approve_preupload", "reject_preupload"]);

function latestBy(items, key) {
  const values = new Map();
  for (const item of items) values.set(key(item), item);
  return [...values.values()];
}

function currentXhsMaterial(context, stores, candidateRef, reviewPolicy = {}) {
  const expectedProject = projectRef(context);
  const expectedRun = runRef(context);
  const designFacts = stores.xhsDesignFacts.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef)).map(validateXhsFact);
  const designFact = designFacts.at(-1) || null;
  const designEvidenceRef = designFact ? { id: designFact.evidence.id, hash: designFact.evidence.evidenceHash } : null;
  const providerPlanFact = stores.xhsProviderPlans.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef)
    && sameRef(fact.designEvidenceRef, designEvidenceRef)).map(validateXhsProviderPlanFact).at(-1) || null;
  const plan = providerPlanFact?.plan || designFact?.evidence?.outputs?.integratedPageExecutionPlan || null;
  const planRef = plan ? { id: plan.id, hash: plan.planHash } : null;
  const revisions = stores.xhsPageRevisions.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef)
    && sameRef(fact.designEvidenceRef, designEvidenceRef))
    .map((fact) => (validateXhsPageRevisionFact(fact), fact));
  const latestRevisions = latestBy(revisions, (fact) => fact.pageId);
  const planOrder = new Map((plan?.pages || []).map((page, index) => [page.pageId, index + 1]));
  const pages = latestRevisions.map((revision) => ({
    pageId: revision.pageId,
    order: planOrder.get(revision.pageId) || Number.MAX_SAFE_INTEGER,
    revisionRef: { id: revision.id, hash: revision.revisionHash },
    revision: clone(revision)
  })).sort((left, right) => left.order - right.order || left.pageId.localeCompare(right.pageId));
  const expectedPageIds = (plan?.pages || []).map((page) => page.pageId);
  const missingPageIds = expectedPageIds.filter((pageId) => !pages.some((page) => page.pageId === pageId));
  const unexpectedPageIds = pages.filter((page) => !expectedPageIds.includes(page.pageId)).map((page) => page.pageId);
  const technicalEligible = expectedPageIds.length > 0 && missingPageIds.length === 0 && unexpectedPageIds.length === 0;
  const orderedRevisionRefs = expectedPageIds.map((pageId) => pages.find((page) => page.pageId === pageId)?.revisionRef).filter(Boolean);
  const visualReview = xhsVisualReviewProjection(stores, expectedProject, expectedRun, candidateRef, planRef, orderedRevisionRefs, { technicalEligible, materializedProjectRef: context.authorityKind === "atomic_v2" ? context.materializedProjectRef : null, humanOnly: reviewPolicy.humanOnly === true });
  return {
    schemaVersion: "1.0", contract: "UnifiedArtifactReviewMaterial@1.0", platform: "xiaohongshu",
    contentProjectRef: expectedProject, platformRunRef: expectedRun, candidateRef: clone(candidateRef),
    designEvidenceRef, planRef, expectedPageIds, missingPageIds, unexpectedPageIds, pages,
    revisionSetHash: visualReview.revisionSetHash,
    pageRevisionRefs: clone(orderedRevisionRefs),
    humanReviewOpen: visualReview.humanReviewOpen,
    reviewStages: xhsReviewStages({ technicalEligible, missingPageIds, unexpectedPageIds, designEvidenceRef, providerPlanFactRef: providerPlanFact ? factRef(providerPlanFact) : null, planRef, visualReview })
  };
}

function validateXhsProviderPlanFact(fact) {
  if (fact?.contract !== "UnifiedXhsProviderPlanFact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_XHS_PROVIDER_PLAN_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (stableHash(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_XHS_PROVIDER_PLAN_FACT_HASH_MISMATCH");
  validateIntegratedPageExecutionPlan(fact.plan);
  return fact;
}

function validateXhsProviderExecutionApprovalFact(fact) {
  if (fact?.contract !== "UnifiedXhsProviderExecutionApprovalFact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_XHS_PROVIDER_APPROVAL_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (stableHash(base) !== fact.factHash || fact.status !== "approved" || fact.limits?.maxAttemptsPerPage !== 1 || fact.limits?.automaticRetries !== 0) fail("UNIFIED_ARTIFACT_XHS_PROVIDER_APPROVAL_FACT_INVALID");
  return fact;
}

function validateXhsVisualReviewFact(fact, contract) {
  if (fact?.contract !== contract || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_XHS_VISUAL_REVIEW_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (stableHash(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_XHS_VISUAL_REVIEW_FACT_HASH_MISMATCH");
  return fact;
}

function xhsVisualReviewProjection(stores, expectedProject, expectedRun, candidateRef, planRef, orderedRevisionRefs, { technicalEligible = false, materializedProjectRef = null, humanOnly = false } = {}) {
  const sameMaterialized = (fact) => !materializedProjectRef || sameRef(fact.materializedContentProjectRef, materializedProjectRef);
  const revisionSetHash = stableHash(orderedRevisionRefs);
  const humanConfirmations = (stores.xhsHumanVisualConfirmations || []).map((fact) => validateXhsVisualReviewFact(fact, "UnifiedXhsHumanVisualConfirmationFact@1.0")).filter((fact) => sameRef(fact.contentProjectRef, expectedProject) && sameMaterialized(fact) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef) && sameRef(fact.planRef, planRef));
  const humanConfirmation = humanConfirmations.filter((fact) => fact.decision === "approved" && fact.revisionSetHash === revisionSetHash && stableHash(fact.pageRevisionRefs) === stableHash(orderedRevisionRefs)).at(-1) || null;
  if (humanConfirmation) return {
    activated: true, revisionSetHash, pageRevisionRefs: clone(orderedRevisionRefs), status: "human_confirmed", stale: false, authorityValid: true,
    currentReviewFact: humanConfirmation, invocationFact: null, approvalFact: null, checkpointFact: null,
    staleReviewFactRefs: [], pendingRedoPageIds: [], rerunStages: [], redoRequired: false,
    providerKnown: false, costKnown: true, invocationEligible: true, humanReviewOpen: technicalEligible === true, humanConfirmationFact: humanConfirmation
  };
  if (humanOnly) return {
    activated: true, revisionSetHash, pageRevisionRefs: clone(orderedRevisionRefs), status: "human_confirmation_pending", stale: false, authorityValid: true,
    currentReviewFact: null, invocationFact: null, approvalFact: null, checkpointFact: null,
    staleReviewFactRefs: [], pendingRedoPageIds: [], rerunStages: [], redoRequired: false,
    providerKnown: false, costKnown: true, invocationEligible: true, humanReviewOpen: false, humanConfirmationFact: null
  };
  const approvals = stores.xhsVisualReviewApprovals.map((fact) => validateXhsVisualReviewFact(fact, "UnifiedXhsVisualReviewApprovalFact@1.0")).filter((fact) => sameRef(fact.contentProjectRef, expectedProject) && sameMaterialized(fact) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef) && sameRef(fact.planRef, planRef));
  const activated = approvals.length > 0;
  const invocations = stores.xhsVisualReviewInvocations.map((fact) => validateXhsVisualReviewFact(fact, "UnifiedXhsVisualReviewInvocationFact@1.0")).filter((fact) => sameRef(fact.contentProjectRef, expectedProject) && sameMaterialized(fact) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef) && sameRef(fact.planRef, planRef));
  const reviews = stores.xhsVisualReviews.map((fact) => validateXhsVisualReviewFact(fact, "UnifiedXhsVisualReviewFact@1.0")).filter((fact) => sameRef(fact.contentProjectRef, expectedProject) && sameMaterialized(fact) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef) && sameRef(fact.planRef, planRef));
  const current = reviews.filter((fact) => fact.revisionSetHash === revisionSetHash && stableHash(fact.pageRevisionRefs) === stableHash(orderedRevisionRefs)).at(-1) || null;
  const stale = !current && reviews.length > 0;
  const checkpoint = stores.xhsVisualReviewCheckpoints.map((fact) => validateXhsVisualReviewFact(fact, "UnifiedXhsVisualReviewCheckpointFact@1.0")).find((fact) => fact.requiresReconciliation === true && sameRef(fact.contentProjectRef, expectedProject) && sameMaterialized(fact) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef) && sameRef(fact.planRef, planRef) && fact.revisionSetHash === revisionSetHash);
  const currentSetInvocations = invocations.filter((fact) => fact.revisionSetHash === revisionSetHash && stableHash(fact.pageRevisionRefs) === stableHash(orderedRevisionRefs));
  const invocation = current ? invocations.find((fact) => sameRef(factRef(fact), current.invocationFactRef)) || null : currentSetInvocations.at(-1) || null;
  const approval = invocation ? approvals.find((fact) => sameRef(factRef(fact), invocation.approvalFactRef)) || null : null;
  const exactInvocationSet = Boolean(invocation && invocation.revisionSetHash === revisionSetHash && stableHash(invocation.pageRevisionRefs) === stableHash(orderedRevisionRefs));
  const providerKnown = Boolean(invocation && typeof invocation.provider === "string" && invocation.provider.trim()
    && !["unknown", "unconfigured"].includes(invocation.provider.trim().toLowerCase())
    && typeof invocation.model === "string" && invocation.model.trim() && !["unknown", "unconfigured"].includes(invocation.model.trim().toLowerCase()));
  const costKnown = Boolean(invocation && Number.isFinite(invocation.credits) && invocation.credits >= 0);
  const exactApprovalSet = Boolean(approval && approval.status === "approved" && approval.revisionSetHash === revisionSetHash
    && stableHash(approval.pageRevisionRefs) === stableHash(orderedRevisionRefs));
  const authorityValid = Boolean(invocation && exactApprovalSet && exactInvocationSet && providerKnown && costKnown
    && sameRef(current?.approvalFactRef, factRef(approval))
    && invocation.providerCalls === 1 && invocation.attempts === 1 && invocation.automaticRetries === 0);
  const invocationEligible = Boolean(authorityValid && invocation.status === "completed"
    && invocation.pixelInputConsumed === true && invocation.productionEligible === true);
  const pendingRedoPageIds = [...new Set((current?.normalizedPageFindings || [])
    .filter((finding) => finding?.patch?.operation === "redo")
    .map((finding) => finding.pageId)
    .filter(Boolean))];
  const rerunStages = Array.isArray(current?.output?.data?.rerun_stages) ? current.output.data.rerun_stages : [];
  const redoRequired = pendingRedoPageIds.length > 0 || rerunStages.length > 0 || current?.decision === "revise" || current?.status === "redo_required";
  const reviewEligible = Boolean(current && current.status === "skill_passed" && current.productionEligible === true
    && current.decision === "pass" && current.output?.status === "success" && !redoRequired);
  const humanReviewOpen = Boolean(technicalEligible && invocationEligible && reviewEligible && !checkpoint && !stale);
  const status = !technicalEligible ? "technical_gate_blocked" : checkpoint ? "checkpoint_required" : current && !authorityValid
    ? "blocked_invalid_authority" : current?.status || (invocation?.status === "failed" || invocation?.status === "failed_output_contract" ? invocation.status : stale ? "stale" : activated ? "not_reviewed" : "legacy_not_activated");
  return {
    activated, revisionSetHash, pageRevisionRefs: clone(orderedRevisionRefs), status, stale, authorityValid,
    currentReviewFact: current, invocationFact: invocation, approvalFact: approval, checkpointFact: checkpoint || null,
    staleReviewFactRefs: stale ? reviews.map(factRef) : [], pendingRedoPageIds, rerunStages: clone(rerunStages), redoRequired,
    providerKnown, costKnown, invocationEligible, humanReviewOpen
  };
}

function xhsReviewStages({ technicalEligible, missingPageIds = [], unexpectedPageIds = [], designEvidenceRef, providerPlanFactRef = null, planRef, visualReview }) {
  const humanConfirmed = visualReview.status === "human_confirmed" && Boolean(visualReview.humanConfirmationFact);
  const technicalBlockers = [
    ...(missingPageIds.length ? ["page_revisions_missing"] : []),
    ...(unexpectedPageIds.length ? ["page_revisions_outside_plan"] : []),
    ...(!planRef ? ["page_plan_missing"] : [])
  ];
  const skillBlockers = [
    ...(!technicalEligible ? ["technical_gate_blocked"] : []),
    ...(visualReview.status === "legacy_not_activated" ? ["visual_skill_review_not_activated"] : []),
    ...(visualReview.status === "not_reviewed" ? ["visual_skill_review_waiting"] : []),
    ...(visualReview.stale ? ["visual_skill_review_stale"] : []),
    ...(visualReview.checkpointFact ? ["visual_skill_review_cost_checkpoint_pending"] : []),
    ...(visualReview.currentReviewFact && !visualReview.authorityValid ? ["visual_skill_review_authority_invalid"] : []),
    ...(["failed", "failed_output_contract", "blocked_invalid_authority", "blocked"].includes(visualReview.status) ? [`visual_skill_review_${visualReview.status}`] : []),
    ...(visualReview.currentReviewFact && !humanConfirmed && visualReview.currentReviewFact.productionEligible !== true ? ["visual_skill_review_not_production_eligible"] : []),
    ...(visualReview.redoRequired ? ["visual_skill_review_redo_pending"] : [])
  ];
  const review = visualReview.currentReviewFact;
  const invocation = visualReview.invocationFact;
  return {
    technicalGate: {
      status: technicalEligible ? "eligible" : "blocked", blockers: technicalBlockers, stale: false,
      authorityRefs: { designEvidenceRef: clone(designEvidenceRef), providerPlanFactRef: clone(providerPlanFactRef), planRef: clone(planRef), pageRevisionRefs: clone(visualReview.pageRevisionRefs) }
    },
    skillVisualReview: {
      status: visualReview.status, blockers: skillBlockers, stale: visualReview.stale, activated: visualReview.activated,
      reviewFactRef: review ? factRef(review) : null,
      revisionSetHash: visualReview.revisionSetHash, pageRevisionRefs: clone(visualReview.pageRevisionRefs),
      productionEligible: humanConfirmed || Boolean(review?.productionEligible === true && visualReview.invocationEligible),
      wholeSet: review ? {
        decision: review.decision || null,
        findings: clone(review.output?.data?.deck_findings || []),
        passedChecks: clone(review.output?.data?.passed_checks || []),
        rerunStages: clone(visualReview.rerunStages),
        warnings: clone(review.output?.warnings || []),
        blockedReasons: clone(review.output?.blocked_reasons || [])
      } : null,
      pageFindings: clone(review?.normalizedPageFindings || []),
      redo: { required: visualReview.redoRequired, pendingPageIds: clone(visualReview.pendingRedoPageIds), rerunStages: clone(visualReview.rerunStages) },
      provider: invocation ? { name: invocation.provider || null, model: invocation.model || null, status: invocation.status, pixelInputConsumed: invocation.pixelInputConsumed === true } : null,
      usage: invocation ? {
        providerCalls: invocation.providerCalls,
        attempts: invocation.attempts,
        automaticRetries: invocation.automaticRetries,
        cost: { status: visualReview.checkpointFact || !visualReview.costKnown ? "unknown" : "known", value: visualReview.costKnown ? invocation.credits : null, unit: "credits" }
      } : { providerCalls: 0, attempts: 0, automaticRetries: 0, cost: { status: visualReview.checkpointFact ? "unknown" : "not_available", value: null, unit: "credits" } },
      authorityRefs: {
        approvalFactRef: visualReview.approvalFact ? factRef(visualReview.approvalFact) : null,
        invocationFactRef: invocation ? factRef(invocation) : null,
        reviewFactRef: review ? factRef(review) : null,
        checkpointFactRef: visualReview.checkpointFact ? factRef(visualReview.checkpointFact) : null,
        staleReviewFactRefs: clone(visualReview.staleReviewFactRefs)
      }
    },
    humanArtifactReview: {
      status: visualReview.humanReviewOpen ? "available" : "locked",
      blockers: visualReview.humanReviewOpen ? ["human_artifact_review_required"] : [...skillBlockers, "human_review_not_open"],
      stale: false,
      authorityRefs: { decisionFactRef: null, staleDecisionFactRefs: [] }
    }
  };
}

function currentWechatMaterial(context, stores, candidateRef) {
  const facts = stores.wechat;
  const planFacts = scopedWechatFacts(context, facts.planFacts, candidateRef).map((fact) => validateWechatFact(fact, "WechatImagePlanArtifactFact@1.0"));
  const planFact = planFacts.at(-1) || null;
  const formatFacts = scopedWechatFacts(context, facts.formatFacts, candidateRef).map((fact) => validateWechatFact(fact, "WechatPreUploadFormatArtifactFact@1.0"))
    .filter((fact) => planFact && sameRef(fact.planFactRef, factRef(planFact)));
  const formatFact = formatFacts.at(-1) || null;
  const qualityFacts = scopedWechatFacts(context, facts.qualityFacts, candidateRef).map((fact) => validateWechatFact(fact, "WechatArtifactQualityGateFact@1.0"))
    .filter((fact) => formatFact && sameRef(fact.formatFactRef, factRef(formatFact)));
  const previewArtifact = stores.wechatPreviewArtifacts.map(validatePreviewArtifact).filter((artifact) => artifact.workspaceId === context.workspaceId
    && artifact.companyId === context.companyId && artifact.accountId === context.accountId
    && sameRef(artifact.contentProjectRef, projectRef(context)) && materializedMatches(artifact, context) && sameRef(artifact.platformRunRef, runRef(context))
    && sameRef(artifact.candidateRef, candidateRef) && formatFact && sameRef(artifact.formatFactRef, factRef(formatFact))).at(-1) || null;
  const resourceRefs = clone(formatFact?.resourceAttemptRefs || formatFact?.resourceRefs || []);
  const scopedResources = scopedWechatFacts(context, facts.resourceAttempts, candidateRef).map((fact) => validateWechatFact(fact, "WechatResourceResolutionAttempt@1.0"));
  const resources = resourceRefs.map((resourceRef) => scopedResources.find((fact) => sameRef(factRef(fact), resourceRef))).filter(Boolean).map((fact) => ({
    resourceRef: factRef(fact), slotId: fact.slotId, role: fact.role, strategy: fact.strategy, assetId: fact.assetId,
    artifactRef: clone(fact.artifactRef), relativePath: fact.relativePath, bytes: fact.bytes, sha256: fact.sha256
  }));
  return {
    schemaVersion: "1.0", contract: "UnifiedArtifactReviewMaterial@1.0", platform: "wechat",
    contentProjectRef: projectRef(context), platformRunRef: runRef(context), candidateRef: clone(candidateRef),
    semantics: "pre_upload_template_not_wechat_final",
    planFactRef: planFact ? factRef(planFact) : null,
    articleRef: clone(candidateRef),
    imagePlanRef: clone(planFact?.imagePlanRef || null),
    canonicalPlan: clone(planFact?.canonicalPlan || null),
    formatFact: clone(formatFact),
    previewArtifact: clone(previewArtifact),
    resourceRefs,
    resources,
    sixGates: latestBy(qualityFacts, (fact) => fact.gate).map(clone),
    wholeArticleQualityFact: clone(scopedWechatFacts(context, facts.wholeArticleQualityFacts || [], candidateRef).map((fact) => validateWechatFact(fact, "WechatWholeArticleQualityFact@1.0")).filter((fact) => formatFact && sameRef(fact.formatFactRef, factRef(formatFact))).at(-1) || null),
    postUploadArtifactRef: null,
    finalWechatArtifact: false
  };
}

function validateArtifactReviewActionFact(fact) {
  if (fact?.schemaVersion !== "1.0" || fact.contract !== "UnifiedArtifactReviewActionFact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_REVIEW_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_REVIEW_FACT_HASH_MISMATCH");
  return fact;
}

function validateArtifactReviewIdempotencyFact(fact) {
  if (fact?.schemaVersion !== "1.0" || fact.contract !== "UnifiedArtifactReviewIdempotencyFact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_REVIEW_IDEMPOTENCY_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_REVIEW_IDEMPOTENCY_FACT_HASH_MISMATCH");
  return fact;
}

function scopedReviewActions(actions, context, candidateRef) {
  return actions.map(validateArtifactReviewActionFact).filter((fact) => sameRef(fact.contentProjectRef, projectRef(context))
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, runRef(context)) && sameRef(fact.candidateRef, candidateRef));
}

function reviewProjection(material, actions, baseState) {
  const currentPages = material.platform === "xiaohongshu" ? material.pages.map((page) => ({ ...clone(page), excluded: false })) : [];
  let orderedPageIds = currentPages.map((page) => page.pageId);
  const pendingRedoPageIds = [];
  let stateHash = hashUnifiedContent({ material, edits: [] });
  const appliedEdits = [];
  let decision = null;
  const actionStates = [];
  for (const fact of actions) {
    const current = fact.artifactStateHash === stateHash;
    actionStates.push({ id: fact.id, hash: fact.factHash, action: fact.action, boundStateHash: fact.artifactStateHash, applied: current });
    if (!current) continue;
    if (["exclude_page", "restore_page"].includes(fact.action)) {
      const page = currentPages.find((item) => item.pageId === fact.payload.pageId && sameRef(item.revisionRef, fact.payload.pageRevisionRef));
      if (page) {
        page.excluded = fact.action === "exclude_page";
        if (fact.action === "restore_page" && !orderedPageIds.includes(page.pageId)) {
          const originalIndex = currentPages.findIndex((item) => item.pageId === page.pageId);
          const insertionIndex = orderedPageIds.findIndex((id) => currentPages.findIndex((item) => item.pageId === id) > originalIndex);
          if (insertionIndex === -1) orderedPageIds.push(page.pageId); else orderedPageIds.splice(insertionIndex, 0, page.pageId);
        }
      }
      appliedEdits.push({ action: fact.action, payload: fact.payload, factRef: { id: fact.id, hash: fact.factHash } });
      stateHash = hashUnifiedContent({ material, edits: appliedEdits });
    } else if (fact.action === "reorder_pages") {
      orderedPageIds = [...fact.payload.pageIds];
      appliedEdits.push({ action: fact.action, payload: fact.payload, factRef: { id: fact.id, hash: fact.factHash } });
      stateHash = hashUnifiedContent({ material, edits: appliedEdits });
    } else if (fact.action === "request_page_redo") {
      if (!pendingRedoPageIds.includes(fact.payload.pageId)) pendingRedoPageIds.push(fact.payload.pageId);
      appliedEdits.push({ action: fact.action, payload: fact.payload, factRef: { id: fact.id, hash: fact.factHash } });
      stateHash = hashUnifiedContent({ material, edits: appliedEdits });
      decision = null;
    } else if (["approve_set", "approve_preupload", "reject_set", "reject_preupload"].includes(fact.action)) {
      decision = fact;
    }
  }
  const pages = orderedPageIds.map((id) => currentPages.find((page) => page.pageId === id)).filter(Boolean);
  const includedPages = pages.filter((page) => !page.excluded);
  const approved = Boolean(decision && decision.artifactStateHash === stateHash && ["approve_set", "approve_preupload"].includes(decision.action));
  const selectable = baseState.reviewable === true && approved && pendingRedoPageIds.length === 0
    && (material.platform !== "xiaohongshu" || (includedPages.length > 0 && material.missingPageIds.length === 0));
  const projectedActionStates = actionStates.map((item) => ({
    id: item.id, hash: item.hash, action: item.action,
    status: !item.applied ? "stale" : ["approve_set", "approve_preupload", "reject_set", "reject_preupload"].includes(item.action) ? (item.boundStateHash === stateHash ? "current" : "stale") : "applied"
  }));
  return { artifactStateHash: stateHash, pages, includedPages, pendingRedoPageIds, decision: decision ? clone(decision) : null, actionStates: projectedActionStates, selectable };
}

function resolveOwnedContext(store, input, featureFlags = {}) {
  const platformName = text(input?.platform, "UNIFIED_ARTIFACT_PLATFORM_REQUIRED");
  if (!PLATFORMS.has(platformName)) fail("UNIFIED_ARTIFACT_PLATFORM_INVALID", "Unsupported artifact platform", 400);
  const authority = resolveUnifiedContentAuthority(store, { ...input, platform: platformName }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    atomicWechatProductEnabled: featureFlags.unifiedContentAtomicWechatProductV1 === true,
    codes: {
      workspaceRequired: "UNIFIED_ARTIFACT_WORKSPACE_REQUIRED", companyRequired: "UNIFIED_ARTIFACT_COMPANY_REQUIRED",
      accountRequired: "UNIFIED_ARTIFACT_ACCOUNT_REQUIRED", projectRequired: "UNIFIED_ARTIFACT_PROJECT_REQUIRED",
      companyNotFound: "UNIFIED_ARTIFACT_COMPANY_NOT_FOUND", workspaceMismatch: "UNIFIED_ARTIFACT_WORKSPACE_MISMATCH",
      accountOwnershipMismatch: "UNIFIED_ARTIFACT_ACCOUNT_OWNERSHIP_MISMATCH", accountWorkspaceMismatch: "UNIFIED_ARTIFACT_ACCOUNT_WORKSPACE_MISMATCH",
      projectNotFound: "UNIFIED_ARTIFACT_PROJECT_NOT_FOUND", projectOwnershipMismatch: "UNIFIED_ARTIFACT_PROJECT_OWNERSHIP_MISMATCH",
      projectAccountMismatch: "UNIFIED_ARTIFACT_PROJECT_ACCOUNT_MISMATCH", snapshotHashMismatch: "UNIFIED_ARTIFACT_PROJECT_SNAPSHOT_MISMATCH",
      candidateAmbiguous: "UNIFIED_ARTIFACT_CANDIDATE_AMBIGUOUS",
      candidateMismatch: "UNIFIED_ARTIFACT_CANDIDATE_STALE_OR_CROSS_PLATFORM"
    }
  });
  return authority.authorityKind === "legacy_snapshot_v1"
    ? { ...authority, snapshot: authority.payload.snapshot, platformSnapshot: authority.payload.platformSnapshot }
    : authority;
}

function resolveCandidate(context, candidateId) {
  if (candidateId != null && String(candidateId).trim() !== "" && text(candidateId, "UNIFIED_ARTIFACT_CANDIDATE_ID_REQUIRED") !== context.candidateRef.id) {
    fail("UNIFIED_ARTIFACT_CANDIDATE_STALE_OR_CROSS_PLATFORM", "Artifact must bind the exact current candidate", 409);
  }
  return clone(context.candidateRef);
}

function assertBinding(ref, expected, code) {
  if (!sameRef(ref, expected)) fail(code, code, 409, { expected, actual: ref || null });
}

function validateXhsFact(fact) {
  if (fact?.contract !== "UnifiedXhsDesignArtifactFact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_XHS_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (hashUnifiedContent(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_XHS_FACT_HASH_MISMATCH");
  validateXhsDesignRuntimeEvidence(fact.evidence);
  return fact;
}

function validateWechatFact(fact, contract) {
  if (fact?.contract !== contract || !HASH.test(fact.factHash || "")) fail("UNIFIED_ARTIFACT_WECHAT_FACT_INVALID", contract);
  const base = clone(fact); delete base.factHash;
  if (hashWechatArtifactValue(base) !== fact.factHash) fail("UNIFIED_ARTIFACT_WECHAT_FACT_HASH_MISMATCH", contract);
  return fact;
}

function factHash(fact) {
  return fact?.factHash || fact?.attemptHash || fact?.revisionHash || null;
}

function mergeImmutableFacts(existing, incoming, { conflictCode, validate }) {
  const merged = existing.map(clone);
  const appended = [];
  for (const fact of incoming) {
    validate(fact);
    const prior = merged.find((item) => item.id === fact.id);
    if (prior) {
      if (factHash(prior) !== factHash(fact)) fail(conflictCode, conflictCode, 409, { id: fact.id });
      continue;
    }
    merged.push(clone(fact));
    appended.push(clone(fact));
  }
  return { merged, appended };
}

function assertFactScope(fact, context, candidateRef, prefix) {
  assertBinding(fact.contentProjectRef, projectRef(context), `${prefix}_PROJECT_MISMATCH`);
  if (context.authorityKind.startsWith("atomic_")) assertBinding(fact.materializedContentProjectRef, context.materializedProjectRef, `${prefix}_MATERIALIZED_PROJECT_MISMATCH`);
  assertBinding(fact.platformRunRef, runRef(context), `${prefix}_RUN_MISMATCH`);
  assertBinding(fact.candidateRef, candidateRef, `${prefix}_CANDIDATE_MISMATCH`);
}

function validatedXhsRuntimeMutation(context, stores, candidateRef, result, reviewPolicy = {}) {
  if (result?.contract !== "XhsPageArtifactRuntimeResult@1.0" || result.schemaVersion !== "1.0") fail("UNIFIED_ARTIFACT_XHS_RUNTIME_RESULT_INVALID", "Invalid XHS runtime result", 400);
  assertBinding(result.contentProjectRef, projectRef(context), "UNIFIED_ARTIFACT_XHS_RUNTIME_PROJECT_MISMATCH");
  if (context.authorityKind === "atomic_v2") assertBinding(result.materializedContentProjectRef, context.materializedProjectRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_MATERIALIZED_PROJECT_MISMATCH");
  assertBinding(result.platformRunRef, runRef(context), "UNIFIED_ARTIFACT_XHS_RUNTIME_RUN_MISMATCH");
  assertBinding(result.candidateRef, candidateRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_CANDIDATE_MISMATCH");
  if (result.selectable !== false || result.finalBundleAuthority !== false || result.publicationPerformed !== false) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_AUTHORITY_INVALID");
  const attempts = Array.isArray(result.attempts) ? result.attempts : fail("UNIFIED_ARTIFACT_XHS_RUNTIME_ATTEMPTS_REQUIRED", "attempts required", 400);
  const revisions = Array.isArray(result.revisions) ? result.revisions : fail("UNIFIED_ARTIFACT_XHS_RUNTIME_REVISIONS_REQUIRED", "revisions required", 400);
  validateXhsArtifactFactAppendOnly({ attempts, revisions });
  for (const fact of [...attempts, ...revisions]) {
    assertFactScope(fact, context, candidateRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_FACT");
    assertBinding(fact.designEvidenceRef, result.designEvidenceRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_FACT_DESIGN_MISMATCH");
    assertBinding(fact.planRef, result.planRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_FACT_PLAN_MISMATCH");
  }
  const designFact = stores.xhsDesignFacts.find((fact) => sameRef({ id: fact.evidence.id, hash: fact.evidence.evidenceHash }, result.designEvidenceRef)
    && sameRef(fact.contentProjectRef, projectRef(context)) && materializedMatches(fact, context) && sameRef(fact.platformRunRef, runRef(context)) && sameRef(fact.candidateRef, candidateRef));
  if (!designFact) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_DESIGN_FACT_REQUIRED", "The exact design fact must be appended first", 409);
  let plan = designFact.evidence.outputs?.integratedPageExecutionPlan;
  if (result.providerPlanFactRef || result.approvalFactRef) {
    if (!result.providerPlanFactRef || !result.approvalFactRef) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_AUTHORITY_REFS_REQUIRED");
    const providerPlanFact = stores.xhsProviderPlans.map(validateXhsProviderPlanFact).find((fact) => sameRef(factRef(fact), result.providerPlanFactRef));
    if (!providerPlanFact) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_PROVIDER_PLAN_FACT_REQUIRED");
    assertFactScope(providerPlanFact, context, candidateRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_PROVIDER_PLAN");
    assertBinding(providerPlanFact.designEvidenceRef, result.designEvidenceRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_PROVIDER_PLAN_DESIGN_MISMATCH");
    const approvalFact = stores.xhsProviderExecutionApprovals.map(validateXhsProviderExecutionApprovalFact).find((fact) => sameRef(factRef(fact), result.approvalFactRef));
    if (!approvalFact) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_APPROVAL_FACT_REQUIRED");
    assertFactScope(approvalFact, context, candidateRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_APPROVAL");
    assertBinding(approvalFact.providerPlanFactRef, result.providerPlanFactRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_APPROVAL_PLAN_FACT_MISMATCH");
    assertBinding(approvalFact.designEvidenceRef, result.designEvidenceRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_APPROVAL_DESIGN_MISMATCH");
    assertBinding(approvalFact.planRef, result.planRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_APPROVAL_PLAN_MISMATCH");
    const newRefs = new Set([...(result.newAttemptRefs || []), ...(result.newRevisionRefs || [])].map((ref) => `${ref.id}:${ref.hash}`));
    for (const fact of [...attempts, ...revisions]) {
      const hash = fact.attemptHash || fact.revisionHash;
      if (newRefs.has(`${fact.id}:${hash}`)) assertBinding(fact.approvalRef, approvalFact.runtimeApprovalRef, "UNIFIED_ARTIFACT_XHS_RUNTIME_FACT_APPROVAL_MISMATCH");
    }
    plan = providerPlanFact.plan;
  }
  if (!plan || !sameRef({ id: plan.id, hash: plan.planHash }, result.planRef)) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_PLAN_MISMATCH");
  const attemptMerge = mergeImmutableFacts(stores.xhsProviderAttempts, attempts, { conflictCode: "UNIFIED_ARTIFACT_XHS_ATTEMPT_ID_CONFLICT", validate: validateXhsProviderAttemptFact });
  const revisionMerge = mergeImmutableFacts(stores.xhsPageRevisions, revisions, { conflictCode: "UNIFIED_ARTIFACT_XHS_REVISION_ID_CONFLICT", validate: validateXhsPageRevisionFact });
  validateXhsArtifactFactAppendOnly({ attempts: attemptMerge.merged, revisions: revisionMerge.merged });
  if (result.reviewable !== (revisions.length > 0)) fail("UNIFIED_ARTIFACT_XHS_RUNTIME_REVIEWABLE_INVALID");
  const artifactState = xhsState(context, { ...stores, xhsProviderAttempts: attemptMerge.merged, xhsPageRevisions: revisionMerge.merged }, candidateRef, reviewPolicy);
  return { attemptMerge, revisionMerge, facts: [...attempts, ...revisions].map(clone), artifactState };
}

function validatedWechatRuntimeMutation(context, stores, candidateRef, result, authoritativeWholeArticleRuntime) {
  if (result?.contract !== "WechatPreUploadArtifactRuntimeResult@1.0" || result.schemaVersion !== "1.0" || result.semantics !== "pre_upload_template_not_wechat_final") fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_RESULT_INVALID", "Invalid WeChat runtime result", 400);
  if (result.selectable !== false || result.finalBundleAuthority !== false || result.platformUploadPerformed !== false || result.draftCreated !== false || result.publicationPerformed !== false) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_AUTHORITY_INVALID");
  const source = result.store;
  if (source && source.wholeArticleQualityFacts == null) source.wholeArticleQualityFacts = [];
  if (!source || !Array.isArray(source.planFacts) || !Array.isArray(source.resourceAttempts) || !Array.isArray(source.formatFacts) || !Array.isArray(source.qualityFacts) || !Array.isArray(source.wholeArticleQualityFacts) || !Array.isArray(source.lifecycleFacts)) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_FACTS_REQUIRED", "Runtime fact store required", 400);
  if (source.lifecycleFacts.length) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_LIFECYCLE_FORBIDDEN");
  const wholeArticleActivated = result.wholeArticleGateEnabled === true || source.wholeArticleQualityFacts.length > 0;
  if (wholeArticleActivated) {
    if (!authoritativeWholeArticleRuntime) fail("UNIFIED_ARTIFACT_WECHAT_WHOLE_ARTICLE_RUNTIME_AUTHORITY_REQUIRED", "Whole-article runtime evidence is accepted only from the trusted internal runtime", 403);
    assertBinding(authoritativeWholeArticleRuntime.candidateRef, candidateRef, "UNIFIED_ARTIFACT_WECHAT_WHOLE_ARTICLE_AUTHORITY_CANDIDATE_MISMATCH");
    if (authoritativeWholeArticleRuntime.runtimeResultHash !== hashWechatArtifactValue(result)) fail("UNIFIED_ARTIFACT_WECHAT_WHOLE_ARTICLE_AUTHORITY_RESULT_MISMATCH", "Authority must bind the exact runtime result", 409);
  }
  const specs = [
    ["planFacts", "WechatImagePlanArtifactFact@1.0"],
    ["resourceAttempts", "WechatResourceResolutionAttempt@1.0"],
    ["formatFacts", "WechatPreUploadFormatArtifactFact@1.0"],
    ["qualityFacts", "WechatArtifactQualityGateFact@1.0"],
    ["wholeArticleQualityFacts", "WechatWholeArticleQualityFact@1.0"]
  ];
  const merges = {};
  for (const [collection, contract] of specs) {
    for (const fact of source[collection]) assertFactScope(fact, context, candidateRef, "UNIFIED_ARTIFACT_WECHAT_RUNTIME_FACT");
    merges[collection] = mergeImmutableFacts(stores.wechat[collection], source[collection], {
      conflictCode: "UNIFIED_ARTIFACT_WECHAT_FACT_ID_CONFLICT",
      validate: (fact) => validateWechatFact(fact, contract)
    });
  }
  if (!result.planFact || !result.canonicalPlan) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_PLAN_RESULT_MISMATCH");
  if (source.planFacts.filter((fact) => sameRef(factRef(fact), factRef(result.planFact))).length !== 1) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_PLAN_RESULT_MISMATCH");
  if (hashWechatArtifactValue(result.planFact.canonicalPlan) !== hashWechatArtifactValue(result.canonicalPlan)) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_CANONICAL_PLAN_MISMATCH");
  const formatRef = result.formatFact ? factRef(result.formatFact) : null;
  if (formatRef && !source.formatFacts.some((fact) => sameRef(factRef(fact), formatRef))) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_FORMAT_RESULT_MISMATCH");
  // Evaluate this runtime result against its exact candidate only. The merged
  // collections also contain immutable facts from older article revisions;
  // feeding those into resource/format evaluation makes a valid new revision
  // collide with the base article's candidate binding.
  const currentScopeFact = (fact) => sameRef(fact?.contentProjectRef, projectRef(context))
    && materializedMatches(fact, context)
    && sameRef(fact?.platformRunRef, runRef(context))
    && sameRef(fact?.candidateRef, candidateRef);
  const shadowWechat = Object.fromEntries(specs.map(([collection]) => [
    collection,
    merges[collection].merged.filter(currentScopeFact)
  ]));
  shadowWechat.lifecycleFacts = stores.wechat.lifecycleFacts.filter(currentScopeFact).map(clone);
  const planFact = shadowWechat.planFacts.find((fact) => sameRef(factRef(fact), factRef(result.planFact)));
  const formatFact = result.formatFact ? shadowWechat.formatFacts.find((fact) => sameRef(factRef(fact), formatRef)) : null;
  const qualityFacts = shadowWechat.qualityFacts.filter((fact) => formatFact && sameRef(fact.formatFactRef, factRef(formatFact)));
  const previewMutation = validatedWechatPreviewMutation(context, stores, candidateRef, result, shadowWechat);
  const preUploadRef = previewMutation.artifact?.preUploadRef || null;
  const evaluated = evaluateWechatPreUploadArtifactState({ planFact, formatFact, qualityFacts, wholeArticleQualityFacts: shadowWechat.wholeArticleQualityFacts, resourceAttempts: shadowWechat.resourceAttempts, preUploadRef, wholeArticleGateEnabled: result.wholeArticleGateEnabled === true, humanReviewStatus: "not_reviewed" });
  const compatibleEvaluated = clone(evaluated);
  if (!wholeArticleActivated && !(result.state && "wholeArticleGate" in result.state)) delete compatibleEvaluated.wholeArticleGate;
  if (hashWechatArtifactValue(compatibleEvaluated) !== hashWechatArtifactValue(result.state)) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_STATE_MISMATCH");
  const reviewReady = formatFact?.status === "succeeded" && evaluated.blockers.every((item) => item === "human_review_not_approved");
  if (result.state?.status === "pre_upload_review_required" && !reviewReady) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_GATES_REQUIRED");
  for (const [collection, values] of [["resourceAttempts", result.resourceAttempts || []], ["qualityFacts", result.qualityFacts || []]]) {
    if (values.some((fact) => !source[collection].some((stored) => sameRef(factRef(stored), factRef(fact))))) fail("UNIFIED_ARTIFACT_WECHAT_RUNTIME_TOP_LEVEL_FACT_MISMATCH", collection);
  }
  const artifactState = wechatState(context, { ...stores, wechat: shadowWechat, wechatPreviewArtifacts: previewMutation.merged }, candidateRef);
  return { merges, previewMutation, facts: [...specs.flatMap(([collection]) => source[collection].map(clone)), ...(previewMutation.artifact ? [clone(previewMutation.artifact)] : [])], artifactState };
}

function validateCanonicalWechatPlan(plan) {
  if (plan?.contract !== "WechatCanonicalImagePlan@1.0" || !HASH.test(plan.planHash || "")) fail("UNIFIED_ARTIFACT_WECHAT_CANONICAL_PLAN_INVALID");
  const rebuilt = adaptWechatImagePlanOutput({
    plan_id: plan.planId,
    cover: plan.cover?.source || null,
    slots: (plan.slots || []).map((item) => item.source)
  }, {
    skillStatus: plan.skillStatus,
    bindings: plan.bindings,
    warnings: plan.warnings,
    blockedReasons: plan.blockedReasons
  });
  if (hashWechatArtifactValue(rebuilt) !== hashWechatArtifactValue(plan)) fail("UNIFIED_ARTIFACT_WECHAT_CANONICAL_PLAN_MISMATCH");
  return plan;
}

function scopedWechatFacts(context, facts, candidateRef) {
  const expectedProject = projectRef(context);
  const expectedRun = runRef(context);
  return facts.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context)
    && sameRef(fact.platformRunRef, expectedRun)
    && sameRef(fact.candidateRef, candidateRef));
}

function wechatPlanById(context, facts, candidateRef, planFactId) {
  const planFact = scopedWechatFacts(context, facts.planFacts, candidateRef).find((item) => item.id === planFactId);
  if (!planFact) fail("UNIFIED_ARTIFACT_WECHAT_PLAN_FACT_NOT_FOUND", "Wechat plan fact was not found in the exact scope", 404);
  return validateWechatFact(planFact, "WechatImagePlanArtifactFact@1.0");
}

function xhsState(context, stores, candidateRef, reviewPolicy = {}) {
  const expectedProject = projectRef(context);
  const expectedRun = runRef(context);
  const facts = stores.xhsDesignFacts.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun)
    && sameRef(fact.candidateRef, candidateRef)).map(validateXhsFact);
  const latest = facts.at(-1) || null;
  const currentDesignRef = latest ? { id: latest.evidence.id, hash: latest.evidence.evidenceHash } : null;
  const providerPlanFacts = stores.xhsProviderPlans.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef)
    && sameRef(fact.designEvidenceRef, currentDesignRef)).map((fact) => {
      validateXhsProviderPlanFact(fact);
      if (fact.providerApprovalEligible !== true || fact.nextGate !== "HumanProviderExecutionApproval" || fact.plan.execution.status !== "ready_for_isolated_provider_execution") fail("UNIFIED_ARTIFACT_XHS_PROVIDER_PLAN_STATUS_INVALID");
      return fact;
    });
  const currentProviderPlanFact = providerPlanFacts.at(-1) || null;
  const currentPlan = currentProviderPlanFact?.plan || latest?.evidence?.outputs?.integratedPageExecutionPlan || null;
  const currentPlanRef = currentPlan ? { id: currentPlan.id, hash: currentPlan.planHash } : null;
  const attempts = stores.xhsProviderAttempts.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef)).map((fact) => (validateXhsProviderAttemptFact(fact), fact))
    .filter((fact) => sameRef(fact.designEvidenceRef, currentDesignRef)
      && ["succeeded", "provider_task_created", "processing"].includes(fact.status));
  const revisions = stores.xhsPageRevisions.filter((fact) => sameRef(fact.contentProjectRef, expectedProject)
    && materializedMatches(fact, context) && sameRef(fact.platformRunRef, expectedRun) && sameRef(fact.candidateRef, candidateRef)).map((fact) => (validateXhsPageRevisionFact(fact), fact))
    .filter((fact) => sameRef(fact.designEvidenceRef, currentDesignRef));
  validateXhsArtifactFactAppendOnly({ attempts, revisions });
  const latestRevisions = latestBy(revisions, (fact) => fact.pageId);
  const expectedPageIds = (currentPlan?.pages || []).map((page) => page.pageId);
  const orderedRevisionRefs = expectedPageIds.map((pageId) => latestRevisions.find((fact) => fact.pageId === pageId)).filter(Boolean).map((fact) => factRef(fact));
  const missingPageIds = expectedPageIds.filter((pageId) => !latestRevisions.some((fact) => fact.pageId === pageId));
  const unexpectedPageIds = latestRevisions.filter((fact) => !expectedPageIds.includes(fact.pageId)).map((fact) => fact.pageId);
  const complete = expectedPageIds.length > 0 && missingPageIds.length === 0 && unexpectedPageIds.length === 0;
  const visualReview = xhsVisualReviewProjection(stores, expectedProject, expectedRun, candidateRef, currentPlanRef, orderedRevisionRefs, { technicalEligible: complete, materializedProjectRef: context.authorityKind === "atomic_v2" ? context.materializedProjectRef : null, humanOnly: reviewPolicy.humanOnly === true });
  const reviewable = visualReview.humanReviewOpen;
  const skillGateStatus = !complete ? "technical_gate_blocked" : visualReview.status;
  return {
    schemaVersion: "1.0",
    contract: "UnifiedContentArtifactState@1.0",
    contentProjectRef: expectedProject,
    ...(context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(context.materializedProjectRef), authorityKind: context.authorityKind } : {}),
    platform: "xiaohongshu",
    platformRunRef: expectedRun,
    candidateRef: clone(candidateRef),
    status: !complete ? (currentProviderPlanFact ? "provider_execution_approval_required" : "visual_artifacts_required") : reviewable ? "artifact_review_required" : visualReview.status === "human_confirmation_pending" ? "human_visual_confirmation_required" : "visual_skill_review_required",
    providerApprovalEligible: currentProviderPlanFact?.providerApprovalEligible === true || latest?.evidence?.productionEligible === true,
    pageRevisionRefs: revisions.map((fact) => ({ id: fact.id, hash: fact.revisionHash })),
    providerAttemptRefs: attempts.map((fact) => ({ id: fact.id, hash: fact.attemptHash })),
    reviewable,
    selectable: false,
    finalBundleAuthority: false,
    publicationPerformed: false,
    blockers: reviewable ? ["artifact_review_required", "explicit_user_selection_required", "immutable_promotion_required"] : complete ? [visualReview.status === "human_confirmation_pending" ? "human_visual_confirmation_required" : `visual_skill_review_${skillGateStatus}`] : currentProviderPlanFact ? ["human_provider_execution_approval_required", "page_revisions_required"] : ["page_revisions_required", "artifact_review_required"],
    designFactRefs: facts.map(factRef),
    providerPlanFactRefs: providerPlanFacts.map(factRef),
    revisionSetHash: visualReview.revisionSetHash,
    humanReviewOpen: visualReview.humanReviewOpen,
    reviewStages: xhsReviewStages({ technicalEligible: complete, missingPageIds, unexpectedPageIds, designEvidenceRef: currentDesignRef, providerPlanFactRef: currentProviderPlanFact ? factRef(currentProviderPlanFact) : null, planRef: currentPlanRef, visualReview })
  };
}

function wechatState(context, stores, candidateRef) {
  const facts = stores.wechat;
  const planFacts = scopedWechatFacts(context, facts.planFacts, candidateRef).map((fact) => validateWechatFact(fact, "WechatImagePlanArtifactFact@1.0"));
  const latestPlan = planFacts.at(-1) || null;
  if (!latestPlan) return {
    schemaVersion: "1.0", contract: "UnifiedContentArtifactState@1.0", contentProjectRef: projectRef(context), platform: "wechat",
    ...(context.authorityKind.startsWith("atomic_") ? { materializedContentProjectRef: clone(context.materializedProjectRef), authorityKind: context.authorityKind } : {}),
    platformRunRef: runRef(context), candidateRef: clone(candidateRef), status: "pre_upload_resource_required",
    reviewable: false, selectable: false, finalBundleAuthority: false, publicationPerformed: false, blockers: ["wechat_plan_fact_required"], stages: { preUpload: null, postUpload: null, draft: null, publication: null }
  };
  const formatFacts = scopedWechatFacts(context, facts.formatFacts, candidateRef).map((fact) => validateWechatFact(fact, "WechatPreUploadFormatArtifactFact@1.0")).filter((fact) => sameRef(fact.planFactRef, factRef(latestPlan)));
  const latestFormat = formatFacts.at(-1) || null;
  const qualityFacts = scopedWechatFacts(context, facts.qualityFacts, candidateRef).map((fact) => validateWechatFact(fact, "WechatArtifactQualityGateFact@1.0")).filter((fact) => latestFormat && sameRef(fact.formatFactRef, factRef(latestFormat)));
  const wholeArticleQualityFacts = scopedWechatFacts(context, facts.wholeArticleQualityFacts || [], candidateRef).map((fact) => validateWechatFact(fact, "WechatWholeArticleQualityFact@1.0"));
  const previewArtifact = stores.wechatPreviewArtifacts.map(validatePreviewArtifact).filter((artifact) => latestFormat && sameRef(artifact.formatFactRef, factRef(latestFormat))).at(-1) || null;
  const preUpload = evaluateWechatPreUploadArtifactState({ planFact: latestPlan, formatFact: latestFormat, qualityFacts, wholeArticleQualityFacts, resourceAttempts: scopedWechatFacts(context, facts.resourceAttempts, candidateRef), preUploadRef: previewArtifact?.preUploadRef || null, wholeArticleGateEnabled: wholeArticleQualityFacts.length > 0, humanReviewStatus: "not_reviewed" });
  const technicalReviewReady = latestFormat?.status === "succeeded" && preUpload.blockers.every((blocker) => blocker === "human_review_not_approved");
  const lifecycle = scopedWechatFacts(context, facts.lifecycleFacts, candidateRef).map((fact) => validateWechatFact(fact, fact.contract)).filter((fact) => sameRef(fact.imagePlanRef, latestPlan.imagePlanRef));
  const postUpload = lifecycle.filter((fact) => fact.kind === "post_upload").at(-1) || null;
  const draft = lifecycle.filter((fact) => fact.kind === "draft").at(-1) || null;
  const publication = lifecycle.filter((fact) => fact.kind === "publication").at(-1) || null;
  return {
    schemaVersion: "1.0", contract: "UnifiedContentArtifactState@1.0", contentProjectRef: projectRef(context), platform: "wechat",
    ...(context.authorityKind.startsWith("atomic_") ? { materializedContentProjectRef: clone(context.materializedProjectRef), authorityKind: context.authorityKind } : {}),
    platformRunRef: runRef(context), candidateRef: clone(candidateRef), status: preUpload.status,
    reviewable: technicalReviewReady, selectable: false, finalBundleAuthority: false, publicationPerformed: Boolean(publication),
    blockers: [...preUpload.blockers, "explicit_user_selection_required", "immutable_promotion_required"],
    stages: {
      preUpload: latestFormat ? factRef(latestFormat) : null,
      postUpload: postUpload ? factRef(postUpload) : null,
      draft: draft ? factRef(draft) : null,
      publication: publication ? factRef(publication) : null
    },
    planFactRefs: planFacts.map(factRef), qualityFactRefs: qualityFacts.map(factRef), wholeArticleQualityFactRefs: wholeArticleQualityFacts.map(factRef),
    reviewStages: { technicalGate: { status: technicalReviewReady ? "eligible" : "blocked" }, wholeArticleQuality: clone(preUpload.wholeArticleGate), humanArtifactReview: { status: technicalReviewReady ? "available" : "locked" } }
  };
}

export function getUnifiedContentArtifactState(store, input, { featureFlags = {} } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  const candidateRef = resolveCandidate(context, input?.candidateId);
  const stores = readUnifiedContentArtifactStore(store);
  const reviewPolicy = { humanOnly: featureFlags.unifiedContentXhsHumanVisualConfirmationV1 === true && featureFlags.unifiedContentXhsVisualReviewV1 !== true };
  const baseState = context.platform === "xiaohongshu" ? xhsState(context, stores, candidateRef, reviewPolicy) : wechatState(context, stores, candidateRef);
  const material = context.platform === "xiaohongshu" ? currentXhsMaterial(context, stores, candidateRef, reviewPolicy) : currentWechatMaterial(context, stores, candidateRef);
  const projection = reviewProjection(material, scopedReviewActions(stores.reviewActions, context, candidateRef), baseState);
  const humanReviewOpen = context.platform === "xiaohongshu" ? material.humanReviewOpen === true && projection.pendingRedoPageIds.length === 0 : baseState.reviewable === true;
  const reviewStages = context.platform === "xiaohongshu"
    ? projectXhsHumanReviewStage(baseState.reviewStages, projection, humanReviewOpen)
    : baseState.reviewStages ? { ...clone(baseState.reviewStages), humanArtifactReview: { status: projection.selectable ? "approved" : baseState.reviewStages.humanArtifactReview.status } } : undefined;
  const blockers = (baseState.blockers || []).filter((item) => !projection.selectable || !["artifact_review_required", "human_review_not_approved"].includes(item));
  if (projection.pendingRedoPageIds.length) blockers.push("page_redo_pending");
  if (context.platform === "xiaohongshu" && material.missingPageIds.length) blockers.push("page_revisions_missing");
  return {
    ...baseState,
    status: projection.selectable ? (context.platform === "xiaohongshu" ? "artifact_review_approved" : "pre_upload_review_approved") : baseState.status,
    artifactStateHash: projection.artifactStateHash,
    ...(context.platform === "xiaohongshu" ? { humanReviewOpen } : {}),
    selectable: projection.selectable,
    pageRevisionRefs: context.platform === "xiaohongshu" ? projection.includedPages.map((page) => clone(page.revisionRef)) : baseState.pageRevisionRefs,
    finalBundleAuthority: false,
    publicationPerformed: false,
    blockers,
    reviewDecisionRef: projection.decision ? { id: projection.decision.id, hash: projection.decision.factHash } : null,
    reviewStages
  };
}

export function getUnifiedContentArtifactReview(store, input, { featureFlags = {} } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  const candidateRef = resolveCandidate(context, input?.candidateId);
  const stores = readUnifiedContentArtifactStore(store);
  const reviewPolicy = { humanOnly: featureFlags.unifiedContentXhsHumanVisualConfirmationV1 === true && featureFlags.unifiedContentXhsVisualReviewV1 !== true };
  const baseState = context.platform === "xiaohongshu" ? xhsState(context, stores, candidateRef, reviewPolicy) : wechatState(context, stores, candidateRef);
  const material = context.platform === "xiaohongshu" ? currentXhsMaterial(context, stores, candidateRef, reviewPolicy) : currentWechatMaterial(context, stores, candidateRef);
  const actions = scopedReviewActions(stores.reviewActions, context, candidateRef);
  const projection = reviewProjection(material, actions, baseState);
  const humanReviewOpen = context.platform === "xiaohongshu" ? material.humanReviewOpen === true && projection.pendingRedoPageIds.length === 0 : baseState.reviewable === true;
  const reviewStages = context.platform === "xiaohongshu" ? projectXhsHumanReviewStage(material.reviewStages, projection, humanReviewOpen) : material.reviewStages;
  return {
    reviewMaterial: { ...material, pages: context.platform === "xiaohongshu" ? projection.pages : material.pages, ...(context.platform === "xiaohongshu" ? { humanReviewOpen, reviewStages } : {}) },
    artifactState: getUnifiedContentArtifactState(store, input, { featureFlags }),
    actionFacts: actions.map(clone),
    actionStates: projection.actionStates,
    claims: { finalBundleAuthority: false, publicationPerformed: false, selectionPerformed: false, providerCalls: 0, networkCalls: 0 }
  };
}

function projectXhsHumanReviewStage(stages, projection, humanReviewOpen) {
  const decision = projection.decision;
  const staleDecisionFactRefs = projection.actionStates
    .filter((item) => item.status === "stale" && ["approve_set", "reject_set"].includes(item.action))
    .map((item) => ({ id: item.id, hash: item.hash }));
  const status = !humanReviewOpen ? "locked" : decision?.action === "approve_set" && projection.selectable
    ? "approved" : decision?.action === "reject_set" ? "rejected" : "available";
  const blockers = [
    ...(!humanReviewOpen ? ["human_review_not_open"] : []),
    ...(projection.pendingRedoPageIds.length ? ["page_redo_pending"] : []),
    ...(humanReviewOpen && !decision ? ["human_artifact_review_required"] : []),
    ...(decision?.action === "reject_set" ? ["human_artifact_review_rejected"] : [])
  ];
  return {
    ...clone(stages),
    humanArtifactReview: {
      status, blockers, stale: staleDecisionFactRefs.length > 0,
      authorityRefs: { decisionFactRef: decision ? { id: decision.id, hash: decision.factHash } : null, staleDecisionFactRefs }
    }
  };
}

const REVIEW_PROJECTION_AUTHORITY_FIELDS = new Set([
  "reviewStages", "stages", "facts", "cost", "findings", "humanReviewOpen", "technicalGate", "skillVisualReview", "humanArtifactReview"
]);

function rejectReviewProjectionAuthorityInjection(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (REVIEW_PROJECTION_AUTHORITY_FIELDS.has(key)) fail("UNIFIED_ARTIFACT_REVIEW_PROJECTION_AUTHORITY_FORBIDDEN", "Review projection authority is server-derived", 400, { field: key });
    rejectReviewProjectionAuthorityInjection(child);
  }
}

function validateReviewActionPayload(platform, action, payload, projection) {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? clone(payload) : {};
  if (["exclude_page", "restore_page", "request_page_redo"].includes(action)) {
    const pageId = text(value.pageId, "UNIFIED_ARTIFACT_REVIEW_PAGE_ID_REQUIRED");
    const page = projection.pages.find((item) => item.pageId === pageId);
    if (!page || !sameRef(value.pageRevisionRef, page.revisionRef)) fail("UNIFIED_ARTIFACT_REVIEW_PAGE_REVISION_STALE", "Action must bind the current exact page revision", 409);
    if (action === "exclude_page" && page.excluded) fail("UNIFIED_ARTIFACT_REVIEW_PAGE_ALREADY_EXCLUDED");
    if (action === "restore_page" && !page.excluded) fail("UNIFIED_ARTIFACT_REVIEW_PAGE_NOT_EXCLUDED");
    return { pageId, pageRevisionRef: clone(page.revisionRef) };
  }
  if (action === "reorder_pages") {
    if (!Array.isArray(value.pageIds) || value.pageIds.some((id) => typeof id !== "string" || !id.trim())) fail("UNIFIED_ARTIFACT_REVIEW_PAGE_ORDER_INVALID", "pageIds required", 400);
    const expected = projection.includedPages.map((page) => page.pageId).sort();
    const actual = [...value.pageIds];
    if (new Set(actual).size !== actual.length || actual.length !== expected.length || [...actual].sort().some((id, index) => id !== expected[index])) fail("UNIFIED_ARTIFACT_REVIEW_PAGE_ORDER_INVALID", "Order must contain every included current page exactly once", 409);
    return { pageIds: actual };
  }
  if (platform === "xiaohongshu" && ["approve_set", "reject_set"].includes(action)) return {};
  if (platform === "wechat" && ["approve_preupload", "reject_preupload"].includes(action)) return {};
  fail("UNIFIED_ARTIFACT_REVIEW_ACTION_INVALID", "Unsupported artifact review action", 400);
}

export function appendUnifiedContentArtifactReviewAction(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  rejectReviewProjectionAuthorityInjection(input);
  const context = resolveOwnedContext(store, input, featureFlags);
  const candidateRef = resolveCandidate(context, input?.candidateId);
  const action = text(input?.action, "UNIFIED_ARTIFACT_REVIEW_ACTION_REQUIRED");
  if (!(context.platform === "xiaohongshu" ? XHS_REVIEW_ACTIONS : WECHAT_REVIEW_ACTIONS).has(action)) fail("UNIFIED_ARTIFACT_REVIEW_ACTION_INVALID", "Unsupported artifact review action", 400);
  const reviewerId = text(input?.reviewerId, "UNIFIED_ARTIFACT_REVIEW_REVIEWER_REQUIRED");
  const actorType = context.authorityKind === "atomic_v2" && ["approve_set", "reject_set"].includes(action)
    ? text(input?.actorType, "UNIFIED_ARTIFACT_REVIEW_ACTOR_TYPE_REQUIRED") : null;
  if (actorType !== null && actorType !== "user") fail("UNIFIED_ARTIFACT_REVIEW_EXPLICIT_USER_REQUIRED", "Atomic Artifact approval requires actorType=user", 400);
  const reason = text(input?.reason, "UNIFIED_ARTIFACT_REVIEW_REASON_REQUIRED");
  const artifactStateHash = text(input?.artifactStateHash, "UNIFIED_ARTIFACT_REVIEW_STATE_HASH_REQUIRED");
  if (!HASH.test(artifactStateHash)) fail("UNIFIED_ARTIFACT_REVIEW_STATE_HASH_INVALID", "Invalid artifact state hash", 400);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_ARTIFACT_REVIEW_IDEMPOTENCY_KEY_REQUIRED");
  const stores = readUnifiedContentArtifactStore(store);
  const prior = stores.reviewIdempotency.find((item) => item.idempotencyKey === idempotencyKey);
  if (prior) {
    validateArtifactReviewIdempotencyFact(prior);
    const existingAction = stores.reviewActions.find((fact) => sameRef({ id: fact.id, hash: fact.factHash }, prior.actionFactRef));
    if (!existingAction) fail("UNIFIED_ARTIFACT_REVIEW_IDEMPOTENCY_ACTION_MISSING");
    validateArtifactReviewActionFact(existingAction);
    const sameRequest = sameRef(existingAction.contentProjectRef, projectRef(context))
      && sameRef(existingAction.platformRunRef, runRef(context)) && sameRef(existingAction.candidateRef, candidateRef)
      && existingAction.artifactStateHash === artifactStateHash && existingAction.reviewerId === reviewerId
      && (context.authorityKind !== "atomic_v2" || existingAction.actorType === actorType)
      && existingAction.reason === reason && existingAction.action === action
      && hashUnifiedContent(existingAction.payload) === hashUnifiedContent(input?.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {});
    if (!sameRequest || prior.requestHash !== existingAction.requestHash) fail("UNIFIED_ARTIFACT_REVIEW_IDEMPOTENCY_CONFLICT", "Idempotency key was used for another action", 409);
    return { actionFact: clone(existingAction), created: false, artifactReview: getUnifiedContentArtifactReview(store, input, { featureFlags }), counters: { providerCalls: 0, networkCalls: 0 } };
  }
  const reviewPolicy = { humanOnly: featureFlags.unifiedContentXhsHumanVisualConfirmationV1 === true && featureFlags.unifiedContentXhsVisualReviewV1 !== true };
  const baseState = context.platform === "xiaohongshu" ? xhsState(context, stores, candidateRef, reviewPolicy) : wechatState(context, stores, candidateRef);
  if (!baseState.reviewable) fail("UNIFIED_ARTIFACT_REVIEW_NOT_READY", "Technical artifact gates have not passed", 409);
  const material = context.platform === "xiaohongshu" ? currentXhsMaterial(context, stores, candidateRef, reviewPolicy) : currentWechatMaterial(context, stores, candidateRef);
  const projection = reviewProjection(material, scopedReviewActions(stores.reviewActions, context, candidateRef), baseState);
  if (artifactStateHash !== projection.artifactStateHash) fail("UNIFIED_ARTIFACT_REVIEW_STATE_STALE", "Action must bind the current artifact state hash", 409, { expected: projection.artifactStateHash, actual: artifactStateHash });
  const payload = validateReviewActionPayload(context.platform, action, input?.payload, projection);
  const requestHash = hashUnifiedContent({ workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, contentProjectRef: projectRef(context), ...(context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(context.materializedProjectRef), actorType } : {}), platformRunRef: runRef(context), candidateRef, artifactStateHash, reviewerId, reason, action, payload });
  const recordedAt = new Date(now).toISOString();
  const base = {
    schemaVersion: "1.0", contract: "UnifiedArtifactReviewActionFact@1.0",
    id: `artifact-review-action:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: projectRef(context), ...(context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(context.materializedProjectRef) } : {}), platform: context.platform, platformRunRef: runRef(context), candidateRef,
    artifactStateHash, reviewerId, ...(context.authorityKind === "atomic_v2" ? { actorType } : {}), reason, action, payload, idempotencyKey, requestHash, recordedAt
  };
  const actionFact = { ...base, factHash: hashUnifiedContent(base) };
  const idemBase = { schemaVersion: "1.0", contract: "UnifiedArtifactReviewIdempotencyFact@1.0", id: `artifact-review-idempotency:${hashUnifiedContent({ idempotencyKey, requestHash }).slice(0, 24)}`, idempotencyKey, requestHash, actionFactRef: { id: actionFact.id, hash: actionFact.factHash }, recordedAt };
  const idempotencyFact = { ...idemBase, factHash: hashUnifiedContent(idemBase) };
  store.unifiedContentArtifactReviewActions ||= [];
  store.unifiedContentArtifactReviewIdempotency ||= [];
  store.unifiedContentArtifactReviewActions.push(actionFact);
  store.unifiedContentArtifactReviewIdempotency.push(idempotencyFact);
  return { actionFact: clone(actionFact), created: true, artifactReview: getUnifiedContentArtifactReview(store, input, { featureFlags }), counters: { providerCalls: 0, networkCalls: 0 } };
}

export function appendUnifiedContentArtifact(store, input, { now = new Date().toISOString(), featureFlags = {}, authoritativeXhsDesignBindings = null, authoritativeWechatWholeArticleRuntime = null } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  const candidateRef = resolveCandidate(context, input.candidateId);
  const operation = text(input.operation, "UNIFIED_ARTIFACT_OPERATION_REQUIRED");
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_ARTIFACT_IDEMPOTENCY_KEY_REQUIRED");
  const stores = ensureUnifiedContentArtifactStore(store);
  const requestInput = clone(input); delete requestInput.idempotencyKey;
  const requestHash = hashUnifiedContent({ workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, projectId: context.projectId, platform: context.platform, candidateRef, requestInput });
  const prior = stores.idempotencyFacts.find((item) => item.idempotencyKey === idempotencyKey);
  if (prior) {
    if (prior.requestHash !== requestHash) fail("UNIFIED_ARTIFACT_IDEMPOTENCY_CONFLICT");
    const allFacts = [stores.xhsDesignFacts, stores.xhsProviderAttempts, stores.xhsPageRevisions, stores.wechatPreviewArtifacts, ...Object.values(stores.wechat)].flat();
    return { facts: prior.factRefs.map((ref) => clone(allFacts.find((fact) => sameRef(factRef(fact), ref)))).filter(Boolean), created: false, artifactState: getUnifiedContentArtifactState(store, input, { featureFlags }) };
  }
  let facts;
  let pendingCommit = null;
  let validatedState = null;
  if (operation === "xhs_runtime_result") {
    if (context.platform !== "xiaohongshu") fail("UNIFIED_ARTIFACT_OPERATION_PLATFORM_MISMATCH");
    const validated = validatedXhsRuntimeMutation(context, stores, candidateRef, clone(input.runtimeResult), { humanOnly: featureFlags.unifiedContentXhsHumanVisualConfirmationV1 === true && featureFlags.unifiedContentXhsVisualReviewV1 !== true });
    facts = validated.facts;
    validatedState = validated.artifactState;
    pendingCommit = () => {
      store.unifiedContentXhsProviderAttemptFacts = validated.attemptMerge.merged;
      store.unifiedContentXhsPageRevisionFacts = validated.revisionMerge.merged;
    };
  } else if (operation === "wechat_preupload_runtime_result") {
    if (context.platform !== "wechat") fail("UNIFIED_ARTIFACT_OPERATION_PLATFORM_MISMATCH");
    const validated = validatedWechatRuntimeMutation(context, stores, candidateRef, clone(input.runtimeResult), authoritativeWechatWholeArticleRuntime);
    facts = validated.facts;
    validatedState = validated.artifactState;
    pendingCommit = () => {
      for (const collection of ["planFacts", "resourceAttempts", "formatFacts", "qualityFacts", "wholeArticleQualityFacts"]) stores.wechat[collection].splice(0, stores.wechat[collection].length, ...validated.merges[collection].merged);
      stores.wechatPreviewArtifacts.splice(0, stores.wechatPreviewArtifacts.length, ...validated.previewMutation.merged);
    };
  } else if (operation === "xhs_design_evidence") {
    if (context.platform !== "xiaohongshu") fail("UNIFIED_ARTIFACT_OPERATION_PLATFORM_MISMATCH");
    const evidence = clone(input.evidence);
    validateXhsDesignRuntimeEvidence(evidence);
    const expectedEvidenceRunRef = authoritativeXhsDesignBindings?.platformRunRef || runRef(context);
    const expectedEvidenceCandidateRef = authoritativeXhsDesignBindings?.candidateRef || candidateRef;
    if (authoritativeXhsDesignBindings) assertBinding(authoritativeXhsDesignBindings.productCandidateRef, candidateRef, "UNIFIED_ARTIFACT_XHS_AUTHORITY_CANDIDATE_MISMATCH");
    assertBinding(evidence.bindings?.platformRunRef, expectedEvidenceRunRef, "UNIFIED_ARTIFACT_XHS_RUN_MISMATCH");
    assertBinding(evidence.bindings?.candidateRef, expectedEvidenceCandidateRef, "UNIFIED_ARTIFACT_XHS_CANDIDATE_MISMATCH");
    const existing = stores.xhsDesignFacts.find((fact) => fact.idempotencyKey === idempotencyKey);
    if (existing) {
      validateXhsFact(existing);
      if (existing.requestHash !== requestHash) fail("UNIFIED_ARTIFACT_IDEMPOTENCY_CONFLICT");
      facts = [clone(existing)];
    } else {
      const base = { schemaVersion: "1.0", contract: "UnifiedXhsDesignArtifactFact@1.0", id: `xhs-artifact:${evidence.id}:${evidence.evidenceHash.slice(0, 16)}`, workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, contentProjectRef: projectRef(context), ...(context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(context.materializedProjectRef) } : {}), platform: context.platform, platformRunRef: runRef(context), candidateRef, evidence, providerApprovalEligible: evidence.productionEligible === true, pageRevisionRefs: [], selectionAuthority: false, finalBundleAuthority: false, publicationPerformed: false, idempotencyKey, requestHash, recordedAt: new Date(now).toISOString() };
      facts = [{ ...base, factHash: hashUnifiedContent(base) }];
      stores.xhsDesignFacts.push(facts[0]);
    }
  } else {
    if (context.platform !== "wechat") fail("UNIFIED_ARTIFACT_OPERATION_PLATFORM_MISMATCH");
    const w = stores.wechat;
    if (operation === "wechat_plan") {
      validateCanonicalWechatPlan(input.canonicalPlan);
      assertBinding(input.canonicalPlan?.bindings?.contentProjectRef, projectRef(context), "UNIFIED_ARTIFACT_WECHAT_PROJECT_MISMATCH");
      assertBinding(input.canonicalPlan?.bindings?.platformRunRef, runRef(context), "UNIFIED_ARTIFACT_WECHAT_RUN_MISMATCH");
      assertBinding(input.canonicalPlan?.bindings?.candidateRef, candidateRef, "UNIFIED_ARTIFACT_WECHAT_CANDIDATE_MISMATCH");
      facts = [appendWechatImagePlanArtifactFact(w, { canonicalPlan: input.canonicalPlan, idempotencyKey, recordedAt: now })];
    } else {
      const planFact = wechatPlanById(context, w, candidateRef, text(input.planFactId, "UNIFIED_ARTIFACT_WECHAT_PLAN_FACT_ID_REQUIRED"));
      if (operation === "wechat_resources") facts = appendWechatResourceResolutionAttempts(w, { planFact, evidenceByAssetId: input.evidenceByAssetId || {}, attempt: input.attempt, idempotencyKeyPrefix: idempotencyKey, recordedAt: now });
      else if (operation === "wechat_format") facts = [appendWechatFormatArtifactFact(w, { planFact, resourceAttempts: w.resourceAttempts, html: input.html, resourceRefs: input.resourceRefs || [], idempotencyKey, recordedAt: now })];
      else if (operation === "wechat_quality") facts = [appendWechatQualityGateFact(w, { planFact, formatFact: w.formatFacts.find((fact) => fact.id === input.formatFactId), gate: input.gate, status: input.status, evidenceRefs: input.evidenceRefs || [], details: input.details || null, idempotencyKey, recordedAt: now })];
      else if (["wechat_post_upload", "wechat_draft", "wechat_publication"].includes(operation)) {
        const lifecycleInput = { planFact, predecessorRef: input.predecessorRef, evidenceRef: input.evidenceRef, html: input.html, idempotencyKey, recordedAt: now };
        facts = [operation === "wechat_post_upload" ? appendWechatPostUploadArtifactFact(w, lifecycleInput) : operation === "wechat_draft" ? appendWechatDraftArtifactFact(w, lifecycleInput) : appendWechatPublicationArtifactFact(w, lifecycleInput)];
      } else fail("UNIFIED_ARTIFACT_OPERATION_INVALID", "Unsupported artifact append operation", 400);
    }
  }
  const idempotencyBase = { schemaVersion: "1.0", contract: "UnifiedContentArtifactIdempotencyFact@1.0", id: `artifact-idempotency:${hashUnifiedContent({ idempotencyKey, requestHash }).slice(0, 24)}`, idempotencyKey, requestHash, contentProjectRef: projectRef(context), ...(context.authorityKind.startsWith("atomic_") ? { materializedContentProjectRef: clone(context.materializedProjectRef) } : {}), platformRunRef: runRef(context), candidateRef, operation, factRefs: facts.map(factRef), recordedAt: new Date(now).toISOString() };
  pendingCommit?.();
  stores.idempotencyFacts.push({ ...idempotencyBase, factHash: hashUnifiedContent(idempotencyBase) });
  return { facts: clone(facts), created: true, artifactState: validatedState || getUnifiedContentArtifactState(store, input, { featureFlags }) };
}

export function projectUnifiedContentArtifacts(store, snapshot) {
  if (!snapshot) return null;
  const projected = clone(snapshot);
  projected.platforms = projected.platforms.map((platform) => {
    const account = (store.accounts || []).find((item) => (item.socialAccountId || item.id) === platform.accountId && item.companyId === snapshot.contentProject.companyId);
    if (!account) {
      return { ...platform, artifactState: { schemaVersion: "1.0", contract: "LegacyUnifiedContentArtifactProjection@1.0", authority: false, status: "legacy_read_only", selectable: false, finalBundleAuthority: false, publicationPerformed: false, blockers: ["artifact_scope_unverified"] } };
    }
    const scope = { workspaceId: account.workspaceId || "workspace_default", companyId: snapshot.contentProject.companyId, accountId: platform.accountId, projectId: snapshot.contentProject.id, platform: platform.platform };
    const artifactStates = (platform.candidateRefs || []).map((candidate) => getUnifiedContentArtifactState(store, { ...scope, candidateId: candidate.id }));
    const artifactState = artifactStates.length === 1 ? artifactStates[0] : { schemaVersion: "1.0", contract: "UnifiedContentArtifactState@1.0", platform: platform.platform, platformRunRef: runRef(platform), status: "candidate_selection_required", reviewable: false, selectable: false, finalBundleAuthority: false, publicationPerformed: false, blockers: ["candidate_id_required"] };
    return { ...platform, artifactState, artifactStates };
  });
  return projected;
}

export function artifactAwareUnifiedContentStore(store, input) {
  store.unifiedContentReviews ||= [];
  store.unifiedContentSelections ||= [];
  const context = resolveOwnedContext(store, input);
  const state = getUnifiedContentArtifactState(store, input);
  const projects = (store.unifiedContentProjects || []).map((snapshot) => {
    if (snapshot.contentProject.id !== context.snapshot.contentProject.id) return snapshot;
    const copy = clone(snapshot);
    const platform = copy.platforms.find((item) => item.platform === context.platform);
    if (platform && !state.reviewable) {
      platform.reviewInput.input.candidateSet.items = [];
      if (context.platform === "wechat") {
        platform.reviewInput.input.candidateSet.articleRef = null;
        platform.reviewInput.input.candidateSet.imagePlanRef = null;
      }
    }
    if (platform) {
      platform.reviewInput.input.candidateSet.artifactFactRefs = context.platform === "xiaohongshu" ? state.designFactRefs || [] : [state.stages?.preUpload].filter(Boolean);
      platform.reviewInput.input.candidateSet.artifactSelectable = state.selectable;
      platform.reviewInput.input.candidateSet.artifactStateHash = state.artifactStateHash;
      if (context.platform === "xiaohongshu") platform.reviewInput.input.candidateSet.pageRevisionRefs = clone(state.pageRevisionRefs || []);
    }
    return copy;
  });
  return { ...store, unifiedContentProjects: projects };
}
