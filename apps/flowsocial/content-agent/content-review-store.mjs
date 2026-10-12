import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { createUserSelectionGate, reviewContentSet } from "./content-set-review.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { getUnifiedAtomicWechatArtifactReviewBinding, getUnifiedContentArtifactReview } from "./unified-content-artifact-store.mjs";

const PLATFORMS = new Set(["xiaohongshu", "wechat"]);

function fail(code, message = code, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code, 400);
  return value.trim();
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function validRef(value) {
  return Boolean(value && typeof value.id === "string" && value.id.trim() && typeof value.hash === "string" && /^[a-f0-9]{64}$/.test(value.hash));
}

function projectRef(snapshot) {
  return { id: snapshot.contentProject.id, hash: snapshot.contentProject.projectHash };
}

function runRef(platform) {
  return { id: platform.platformRunRef.id, hash: platform.platformRunRef.hash };
}

function reviewRef(review) {
  return { id: review.id, hash: review.reviewHash };
}

function requestIdentity(scope, candidateRef, extra = {}) {
  return hashUnifiedContent({
    workspaceId: scope.workspaceId,
    companyId: scope.companyId,
    accountId: scope.accountId,
    projectId: scope.projectId,
    platform: scope.platform,
    candidateRef,
    ...extra
  });
}

export function ensureUnifiedContentReviewStore(store) {
  store.unifiedContentReviews ||= [];
  store.unifiedContentSelections ||= [];
  return {
    reviews: store.unifiedContentReviews,
    selections: store.unifiedContentSelections
  };
}

function resolveAuthorityContext(store, input, featureFlags) {
  const platform = text(input?.platform, "UNIFIED_REVIEW_PLATFORM_REQUIRED");
  if (!PLATFORMS.has(platform)) fail("UNIFIED_REVIEW_PLATFORM_INVALID", "Unsupported review platform", 400);
  const authority = resolveUnifiedContentAuthority(store, { ...input, platform }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    codes: {
      workspaceRequired: "UNIFIED_REVIEW_WORKSPACE_REQUIRED", companyRequired: "UNIFIED_REVIEW_COMPANY_REQUIRED",
      accountRequired: "UNIFIED_REVIEW_ACCOUNT_REQUIRED", projectRequired: "UNIFIED_REVIEW_PROJECT_REQUIRED",
      companyNotFound: "UNIFIED_REVIEW_COMPANY_NOT_FOUND", workspaceMismatch: "UNIFIED_REVIEW_WORKSPACE_MISMATCH",
      accountOwnershipMismatch: "UNIFIED_REVIEW_ACCOUNT_OWNERSHIP_MISMATCH", accountWorkspaceMismatch: "UNIFIED_REVIEW_ACCOUNT_WORKSPACE_MISMATCH",
      projectNotFound: "UNIFIED_REVIEW_PROJECT_NOT_FOUND", projectOwnershipMismatch: "UNIFIED_REVIEW_PROJECT_OWNERSHIP_MISMATCH",
      projectAccountMismatch: "UNIFIED_REVIEW_PROJECT_ACCOUNT_MISMATCH", snapshotHashMismatch: "UNIFIED_REVIEW_PROJECT_SNAPSHOT_MISMATCH",
      candidateAmbiguous: "UNIFIED_REVIEW_CANDIDATE_STALE_OR_CROSS_PLATFORM",
      candidateNotFound: "UNIFIED_REVIEW_CANDIDATE_STALE_OR_CROSS_PLATFORM",
      candidateMismatch: "UNIFIED_REVIEW_CANDIDATE_STALE_OR_CROSS_PLATFORM"
    }
  });
  if (authority.authorityKind === "legacy_snapshot_v1") {
    return { ...authority, snapshot: authority.payload.snapshot, platformSnapshot: authority.payload.platformSnapshot };
  }
  if (authority.authorityKind !== "atomic_v2" || authority.platform !== "xiaohongshu") fail("UNIFIED_ATOMIC_REVIEW_AUTHORITY_REQUIRED");
  const platformRun = authority.payload.contentProject.platformRuns.find((item) => item.id === authority.platformRunRef.id && item.hash === authority.platformRunRef.hash);
  if (!platformRun) fail("UNIFIED_ATOMIC_REVIEW_PLATFORM_RUN_REQUIRED");
  const artifactReview = getUnifiedContentArtifactReview(store, input, { featureFlags });
  return {
    ...authority,
    authority,
    contentProject: authority.payload.contentProject,
    platformRun,
    candidate: authority.payload.candidate,
    components: authority.payload.components,
    artifactReview
  };
}

function resolveOwnedContext(store, input, featureFlags = {}) {
  return resolveAuthorityContext(store, input, featureFlags);
}

function resolveCandidate(context, candidateId) {
  if (context.authorityKind === "atomic_v2") {
    const id = text(candidateId, "UNIFIED_REVIEW_CANDIDATE_ID_REQUIRED");
    if (id !== context.candidateRef.id) fail("UNIFIED_REVIEW_CANDIDATE_STALE_OR_CROSS_PLATFORM", "Candidate is not an exact current platform candidate", 409);
    return clone(context.candidateRef);
  }
  const id = text(candidateId, "UNIFIED_REVIEW_CANDIDATE_ID_REQUIRED");
  const matches = (context.platformSnapshot.candidateRefs || []).filter((item) => item.id === id);
  if (matches.length !== 1) fail("UNIFIED_REVIEW_CANDIDATE_STALE_OR_CROSS_PLATFORM", "Candidate is not an exact current platform candidate", 409);
  return clone(matches[0]);
}

function candidateSetFor(context, candidateRef) {
  const input = context.platformSnapshot.reviewInput?.input;
  const supplied = input?.candidateSet || input;
  if (!supplied || typeof supplied !== "object") fail("UNIFIED_REVIEW_INPUT_MISSING", "Saved candidate review input is missing", 409);
  return {
    platform: context.platform,
    candidateRef: clone(candidateRef),
    titleRef: clone(supplied.titleRef),
    bodyVersionRef: clone(supplied.bodyVersionRef),
    pageRevisionRefs: clone(supplied.pageRevisionRefs || []),
    articleRef: context.platform === "wechat" ? clone(supplied.articleRef) : undefined,
    imagePlanRef: context.platform === "wechat" ? clone(supplied.imagePlanRef) : undefined,
    items: clone(supplied.items || []),
    artifactState: supplied.artifactState || null,
    deliverySemantics: supplied.deliverySemantics || null,
    postUploadArtifactRef: clone(supplied.postUploadArtifactRef || null),
    artifactSelectable: supplied.artifactSelectable,
    artifactStateHash: supplied.artifactStateHash || null,
    blockers: clone(supplied.blockers || [])
  };
}

function machineGateFor(context, candidateRef, candidateSet) {
  const checks = [
    { id: "candidate_binding", status: sameRef(candidateSet.candidateRef, candidateRef) ? "passed" : "failed" },
    { id: "title_ref", status: validRef(candidateSet.titleRef) ? "passed" : "failed" },
    { id: "body_ref", status: validRef(candidateSet.bodyVersionRef) ? "passed" : "failed" },
    { id: "review_items", status: Array.isArray(candidateSet.items) && candidateSet.items.length > 0 ? "passed" : "failed" },
    context.platform === "xiaohongshu"
      ? { id: "page_revision_refs", status: Array.isArray(candidateSet.pageRevisionRefs) && candidateSet.pageRevisionRefs.length > 0 && candidateSet.pageRevisionRefs.every(validRef) ? "passed" : "failed" }
      : { id: "article_and_image_plan_refs", status: validRef(candidateSet.articleRef) && validRef(candidateSet.imagePlanRef) ? "passed" : "failed" },
    context.platform === "xiaohongshu"
      ? { id: "rendered_visual_artifacts", status: candidateSet.artifactState == null || (candidateSet.artifactState !== "visual_artifacts_required" && candidateSet.pageRevisionRefs.every(validRef)) ? "passed" : "failed" }
      : { id: "pre_upload_semantics", status: candidateSet.deliverySemantics == null || (candidateSet.deliverySemantics === "pre_upload_only" && candidateSet.postUploadArtifactRef == null) ? "passed" : "failed" }
  ];
  const status = checks.every((item) => item.status === "passed") ? "passed" : "failed";
  const base = {
    schemaVersion: "1.0",
    contract: "UnifiedMachineReviewFact@1.0",
    id: `machine_review:${candidateRef.id}:${hashUnifiedContent(checks).slice(0, 12)}`,
    contentProjectRef: projectRef(context.snapshot),
    platformRunRef: runRef(context.platformSnapshot),
    candidateRef: clone(candidateRef),
    status,
    checks,
    evidenceHash: hashUnifiedContent(checks)
  };
  return { ...base, ref: { id: base.id, hash: hashUnifiedContent(base) } };
}

function idempotent(items, idempotencyKey, requestHash, conflictCode) {
  const existing = items.find((item) => item.idempotencyKey === idempotencyKey);
  if (!existing) return null;
  if (existing.requestHash !== requestHash) fail(conflictCode, "Idempotency key was used for another request", 409);
  return clone(existing);
}

function atomicFactRef(value) {
  return { id: value.id, hash: value.factHash || value.reviewHash };
}

function atomicScope(context) {
  return {
    workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: clone(context.executionProjectRef), materializedContentProjectRef: clone(context.materializedProjectRef),
    platform: "xiaohongshu", platformRunRef: clone(context.platformRunRef), candidateRef: clone(context.candidateRef)
  };
}

function sameAtomicScope(fact, context) {
  return fact?.workspaceId === context.workspaceId && fact.companyId === context.companyId && fact.accountId === context.accountId
    && fact.platform === "xiaohongshu" && sameRef(fact.contentProjectRef, context.executionProjectRef)
    && sameRef(fact.materializedContentProjectRef, context.materializedProjectRef)
    && sameRef(fact.platformRunRef, context.platformRunRef) && sameRef(fact.candidateRef, context.candidateRef);
}

function validateAtomicStoredFact(fact, contract) {
  if (!fact || fact.contract !== contract || !validRef({ id: fact.id, hash: fact.factHash })) fail("UNIFIED_ATOMIC_REVIEW_FACT_INVALID");
  const copy = clone(fact); delete copy.factHash;
  if (hashUnifiedContent(copy) !== fact.factHash) fail("UNIFIED_ATOMIC_REVIEW_FACT_HASH_MISMATCH");
  return fact;
}

function atomicArtifactBinding(context) {
  const review = context.artifactReview;
  const state = review.artifactState;
  const material = review.reviewMaterial;
  const decisionRef = state.reviewDecisionRef;
  const decision = decisionRef ? review.actionFacts.find((item) => sameRef({ id: item.id, hash: item.factHash }, decisionRef)) : null;
  const skillReviewFactRef = material.reviewStages?.skillVisualReview?.reviewFactRef || null;
  if (state.selectable !== true || state.reviewStages?.humanArtifactReview?.status !== "approved"
    || !decision || decision.action !== "approve_set" || decision.actorType !== "user"
    || !validRef(decisionRef) || !validRef(skillReviewFactRef) || !validRef(context.materializedProjectRef)
    || !Array.isArray(state.pageRevisionRefs) || !state.pageRevisionRefs.length || !state.pageRevisionRefs.every(validRef)
    || !/^[a-f0-9]{64}$/.test(state.artifactStateHash || "") || !/^[a-f0-9]{64}$/.test(material.revisionSetHash || "")) {
    fail("UNIFIED_ATOMIC_REVIEW_HUMAN_ARTIFACT_APPROVAL_REQUIRED", "Current exact Artifact State requires an explicit user approval", 409);
  }
  const actionFactRefs = review.actionFacts.map(atomicFactRef);
  return {
    artifactStateHash: state.artifactStateHash,
    artifactReviewActionRef: clone(decisionRef),
    artifactActionSetHash: hashUnifiedContent(actionFactRefs),
    visualReviewFactRef: clone(skillReviewFactRef),
    revisionSetHash: material.revisionSetHash,
    pageRevisionRefs: clone(state.pageRevisionRefs)
  };
}

function resolveAtomicWechatReviewContext(store, input, featureFlags) {
  if (featureFlags.unifiedContentAtomicWechatHumanSelectionV1 !== true) fail("UNIFIED_ATOMIC_WECHAT_HUMAN_SELECTION_DISABLED", "Atomic WeChat human selection is disabled", 404);
  const context = resolveUnifiedContentAuthority(store, { ...input, platform: "wechat" }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    atomicWechatProductEnabled: featureFlags.unifiedContentAtomicWechatProductV1 === true
  });
  if (context.authorityKind !== "atomic_wechat_v1" || context.platform !== "wechat") fail("UNIFIED_ATOMIC_WECHAT_REVIEW_AUTHORITY_REQUIRED");
  const candidateId = text(input?.candidateId, "UNIFIED_ATOMIC_WECHAT_REVIEW_ARTICLE_ID_REQUIRED");
  if (candidateId !== context.candidateRef.id) fail("UNIFIED_ATOMIC_WECHAT_REVIEW_ARTICLE_STALE", "Review must bind the exact materialized Article", 409);
  return context;
}

function assertWechatInputRefs(input, context, approvalRef = null) {
  const refs = {
    commitRef: context.payload.commitRef,
    materializedContentProjectRef: context.materializedProjectRef,
    articleRef: context.candidateRef,
    ...(approvalRef ? { artifactReviewFactRef: approvalRef } : {})
  };
  for (const [key, expected] of Object.entries(refs)) {
    if (!sameRef(input?.[key], expected)) fail(`UNIFIED_ATOMIC_WECHAT_${key.toUpperCase()}_STALE`, `${key} must bind the exact current authority`, 409);
  }
}

function wechatScope(context) {
  return { workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: clone(context.executionProjectRef), materializedContentProjectRef: clone(context.materializedProjectRef),
    platform: "wechat", platformRunRef: clone(context.platformRunRef), candidateRef: clone(context.candidateRef),
    commitRef: clone(context.payload.commitRef), articleRef: clone(context.candidateRef) };
}

function wechatFactScope(fact) {
  return { workspaceId: fact.workspaceId, companyId: fact.companyId, accountId: fact.accountId,
    contentProjectRef: clone(fact.contentProjectRef), materializedContentProjectRef: clone(fact.materializedContentProjectRef),
    platform: "wechat", platformRunRef: clone(fact.platformRunRef), candidateRef: clone(fact.candidateRef),
    commitRef: clone(fact.commitRef), articleRef: clone(fact.articleRef) };
}

function sameWechatScope(fact, context) {
  return fact?.workspaceId === context.workspaceId && fact.companyId === context.companyId && fact.accountId === context.accountId
    && fact.platform === "wechat" && sameRef(fact.contentProjectRef, context.executionProjectRef)
    && sameRef(fact.materializedContentProjectRef, context.materializedProjectRef) && sameRef(fact.platformRunRef, context.platformRunRef)
    && sameRef(fact.candidateRef, context.candidateRef) && sameRef(fact.commitRef, context.payload.commitRef)
    && sameRef(fact.articleRef, context.candidateRef);
}

function wechatEditorialChecks(context, binding) {
  const article = context.payload.article;
  const withoutHash = clone(article); delete withoutHash.componentHash;
  return [
    { id: "immutable_article_closure", status: hashUnifiedContent(withoutHash) === article.componentHash ? "passed" : "failed", evidence: { articleRef: clone(context.candidateRef) } },
    { id: "article_content_present", status: article.article && JSON.stringify(article.article).length > 20 ? "passed" : "failed", evidence: { materialized: Boolean(article.article) } },
    { id: "preupload_technical_gate", status: binding.artifactState.reviewable === true ? "passed" : "failed", evidence: { artifactStateHash: binding.artifactState.artifactStateHash } },
    { id: "explicit_human_artifact_approval", status: binding.approved === true ? "passed" : "failed", evidence: { artifactReviewFactRef: clone(binding.currentReviewFactRef) } },
    { id: "preupload_not_final", status: binding.artifactState.finalBundleAuthority === false && binding.artifactState.publicationPerformed === false ? "passed" : "failed", evidence: { finalBundleAuthority: false, publicationPerformed: false } }
  ];
}

function validateAtomicWechatEditorialFact(fact, context = null, binding = null) {
  if (!fact || fact.schemaVersion !== "1.0" || fact.contract !== "UnifiedAtomicWechatEditorialReviewFact@1.0"
    || !validRef({ id: fact.id, hash: fact.factHash }) || !Array.isArray(fact.findings)
    || !["passed", "failed"].includes(fact.status) || fact.machineDerived !== true
    || fact.uploadAuthority !== false || fact.promotionAuthority !== false || fact.deliveryAuthority !== false || fact.publicationAuthority !== false) {
    fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_FACT_INVALID");
  }
  const copy = clone(fact); delete copy.factHash;
  if (hashUnifiedContent(copy) !== fact.factHash) fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_FACT_HASH_MISMATCH");
  const expectedRequestHash = hashUnifiedContent({ ...wechatFactScope(fact), artifactReviewFactRef: fact.artifactReviewFactRef,
    artifactStateHash: fact.artifactStateHash, artifactAuthoritySetHash: fact.artifactAuthoritySetHash });
  if (fact.requestHash !== expectedRequestHash
    || fact.id !== `atomic-wechat-editorial-review:${hashUnifiedContent({ requestHash: fact.requestHash, idempotencyKey: fact.idempotencyKey }).slice(0, 24)}`) {
    fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_FACT_SEMANTICS_INVALID");
  }
  const findingIds = ["immutable_article_closure", "article_content_present", "preupload_technical_gate", "explicit_human_artifact_approval", "preupload_not_final"];
  if (fact.findings.length !== findingIds.length || fact.findings.some((finding, index) => finding?.id !== findingIds[index]
    || !["passed", "failed"].includes(finding.status))
    || (fact.status === "passed") !== fact.findings.every((finding) => finding.status === "passed")
    || !sameRef(fact.findings[0]?.evidence?.articleRef, fact.articleRef)
    || fact.findings[1]?.evidence?.materialized !== true
    || fact.findings[2]?.evidence?.artifactStateHash !== fact.artifactStateHash
    || !sameRef(fact.findings[3]?.evidence?.artifactReviewFactRef, fact.artifactReviewFactRef)
    || fact.findings[4]?.evidence?.finalBundleAuthority !== false || fact.findings[4]?.evidence?.publicationPerformed !== false) {
    fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_FACT_SEMANTICS_INVALID");
  }
  if (context && binding) {
    const expected = wechatEditorialChecks(context, binding);
    const expectedStatus = expected.every((item) => item.status === "passed") ? "passed" : "failed";
    if (!sameWechatScope(fact, context) || !sameRef(fact.artifactReviewFactRef, binding.currentReviewFactRef)
      || fact.artifactStateHash !== binding.artifactState.artifactStateHash || fact.artifactAuthoritySetHash !== binding.artifactAuthoritySetHash
      || hashUnifiedContent(fact.findings) !== hashUnifiedContent(expected) || fact.status !== expectedStatus) {
      fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_FACT_CLOSURE_INVALID");
    }
  }
  return fact;
}

function validateAtomicWechatSelectionFact(fact) {
  if (!fact || fact.schemaVersion !== "1.0" || fact.contract !== "UnifiedAtomicWechatSelectionFact@1.0"
    || !validRef({ id: fact.id, hash: fact.factHash }) || !["selected", "not_selected"].includes(fact.status)
    || fact.actorType !== "user" || [fact.contentProjectRef, fact.materializedContentProjectRef, fact.platformRunRef, fact.candidateRef, fact.commitRef, fact.articleRef, fact.artifactReviewFactRef, fact.editorialReviewFactRef].some((value) => !validRef(value))
    || !/^[a-f0-9]{64}$/.test(fact.artifactStateHash || "") || !/^[a-f0-9]{64}$/.test(fact.artifactAuthoritySetHash || "")
    || [fact.actorId, fact.occurredAt, fact.idempotencyKey, fact.requestHash, fact.createdAt].some((value) => typeof value !== "string" || !value.trim())
    || Number.isNaN(Date.parse(fact.occurredAt)) || Number.isNaN(Date.parse(fact.createdAt))
    || fact.uploadAuthority !== false || fact.promotionAuthority !== false
    || fact.deliveryAuthority !== false || fact.publicationAuthority !== false) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_FACT_INVALID");
  const copy = clone(fact); delete copy.factHash;
  if (hashUnifiedContent(copy) !== fact.factHash) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_FACT_HASH_MISMATCH");
  const expectedRequestHash = hashUnifiedContent({ ...wechatFactScope(fact), artifactReviewFactRef: fact.artifactReviewFactRef,
    editorialReviewFactRef: fact.editorialReviewFactRef, artifactStateHash: fact.artifactStateHash,
    artifactAuthoritySetHash: fact.artifactAuthoritySetHash, status: fact.status, actorId: fact.actorId,
    actorType: fact.actorType, occurredAt: fact.occurredAt });
  if (fact.requestHash !== expectedRequestHash
    || fact.id !== `atomic-wechat-selection:${hashUnifiedContent({ requestHash: fact.requestHash, idempotencyKey: fact.idempotencyKey }).slice(0, 24)}`) {
    fail("UNIFIED_ATOMIC_WECHAT_SELECTION_FACT_SEMANTICS_INVALID");
  }
  return fact;
}

export function appendUnifiedAtomicWechatEditorialReview(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  for (const forbidden of ["reviewFact", "editorialReview", "findings", "reviewState", "authorityProjection"]) {
    if (Object.hasOwn(input || {}, forbidden)) fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_INJECTION_FORBIDDEN", "Editorial review is server-derived", 400, { field: forbidden });
  }
  const context = resolveAtomicWechatReviewContext(store, input, featureFlags);
  const binding = getUnifiedAtomicWechatArtifactReviewBinding(store, input, { featureFlags });
  if (!binding.approved || !binding.currentReviewFactRef) fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_HUMAN_APPROVAL_REQUIRED");
  assertWechatInputRefs(input, context, binding.currentReviewFactRef);
  if (input?.artifactStateHash !== binding.artifactState.artifactStateHash || input?.artifactAuthoritySetHash !== binding.artifactAuthoritySetHash) {
    fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_ARTIFACT_STALE");
  }
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_IDEMPOTENCY_KEY_REQUIRED");
  const scope = wechatScope(context);
  const requestHash = hashUnifiedContent({ ...scope, artifactReviewFactRef: binding.currentReviewFactRef,
    artifactStateHash: binding.artifactState.artifactStateHash, artifactAuthoritySetHash: binding.artifactAuthoritySetHash });
  const facts = (store.unifiedContentReviews || []).filter((fact) => fact?.contract === "UnifiedAtomicWechatEditorialReviewFact@1.0").map((fact) => validateAtomicWechatEditorialFact(fact));
  const existing = facts.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) fail("UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_IDEMPOTENCY_CONFLICT");
    validateAtomicWechatEditorialFact(existing, context, binding);
    return { reviewFact: clone(existing), created: false };
  }
  const findings = wechatEditorialChecks(context, binding);
  const status = findings.every((item) => item.status === "passed") ? "passed" : "failed";
  const base = { schemaVersion: "1.0", contract: "UnifiedAtomicWechatEditorialReviewFact@1.0",
    id: `atomic-wechat-editorial-review:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    ...scope, artifactReviewFactRef: clone(binding.currentReviewFactRef), artifactStateHash: binding.artifactState.artifactStateHash,
    artifactAuthoritySetHash: binding.artifactAuthoritySetHash, findings, status, machineDerived: true, idempotencyKey, requestHash,
    createdAt: new Date(now).toISOString(), uploadAuthority: false, promotionAuthority: false, deliveryAuthority: false, publicationAuthority: false };
  const reviewFact = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedContentReviews = [...(store.unifiedContentReviews || []), reviewFact];
  return { reviewFact: clone(reviewFact), created: true };
}

export function appendUnifiedAtomicWechatSelection(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  const context = resolveAtomicWechatReviewContext(store, input, featureFlags);
  const binding = getUnifiedAtomicWechatArtifactReviewBinding(store, input, { featureFlags });
  if (!binding.approved || !binding.currentReviewFactRef) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_HUMAN_APPROVAL_REQUIRED");
  assertWechatInputRefs(input, context, binding.currentReviewFactRef);
  const reviews = (store.unifiedContentReviews || []).filter((fact) => fact?.contract === "UnifiedAtomicWechatEditorialReviewFact@1.0" && sameWechatScope(fact, context))
    .map((fact) => validateAtomicWechatEditorialFact(fact, context, binding));
  const latestReview = reviews.at(-1) || null;
  if (!latestReview || latestReview.status !== "passed" || !sameRef(input?.editorialReviewFactRef, atomicFactRef(latestReview))) {
    fail("UNIFIED_ATOMIC_WECHAT_SELECTION_EDITORIAL_REVIEW_REQUIRED");
  }
  if (input?.artifactStateHash !== binding.artifactState.artifactStateHash || input?.artifactAuthoritySetHash !== binding.artifactAuthoritySetHash) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_ARTIFACT_STALE");
  if (input?.actorType !== "user") fail("UNIFIED_ATOMIC_WECHAT_SELECTION_EXPLICIT_USER_REQUIRED", "Selection requires actorType=user", 400);
  const actorId = text(input?.actorId, "UNIFIED_ATOMIC_WECHAT_SELECTION_ACTOR_REQUIRED");
  const occurredAt = text(input?.occurredAt, "UNIFIED_ATOMIC_WECHAT_SELECTION_OCCURRED_AT_REQUIRED");
  if (Number.isNaN(Date.parse(occurredAt))) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_OCCURRED_AT_INVALID", "occurredAt must be ISO-8601", 400);
  const status = text(input?.status, "UNIFIED_ATOMIC_WECHAT_SELECTION_STATUS_REQUIRED");
  if (!["selected", "not_selected"].includes(status)) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_STATUS_INVALID", "Use selected or not_selected", 400);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_ATOMIC_WECHAT_SELECTION_IDEMPOTENCY_KEY_REQUIRED");
  const scope = wechatScope(context);
  const requestHash = hashUnifiedContent({ ...scope, artifactReviewFactRef: binding.currentReviewFactRef,
    editorialReviewFactRef: atomicFactRef(latestReview), artifactStateHash: binding.artifactState.artifactStateHash,
    artifactAuthoritySetHash: binding.artifactAuthoritySetHash, status, actorId, actorType: "user", occurredAt: new Date(occurredAt).toISOString() });
  const facts = (store.unifiedContentSelections || []).filter((fact) => fact?.contract === "UnifiedAtomicWechatSelectionFact@1.0").map(validateAtomicWechatSelectionFact);
  const existing = facts.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) fail("UNIFIED_ATOMIC_WECHAT_SELECTION_IDEMPOTENCY_CONFLICT");
    return { selectionFact: clone(existing), created: false };
  }
  const base = { schemaVersion: "1.0", contract: "UnifiedAtomicWechatSelectionFact@1.0",
    id: `atomic-wechat-selection:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 24)}`,
    ...scope, artifactReviewFactRef: clone(binding.currentReviewFactRef), editorialReviewFactRef: atomicFactRef(latestReview),
    artifactStateHash: binding.artifactState.artifactStateHash, artifactAuthoritySetHash: binding.artifactAuthoritySetHash,
    status, actorId, actorType: "user", occurredAt: new Date(occurredAt).toISOString(), idempotencyKey, requestHash,
    createdAt: new Date(now).toISOString(), uploadAuthority: false, promotionAuthority: false, deliveryAuthority: false, publicationAuthority: false };
  const selectionFact = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedContentSelections = [...(store.unifiedContentSelections || []), selectionFact];
  return { selectionFact: clone(selectionFact), created: true };
}

export function listUnifiedAtomicWechatReviewState(store, input, { featureFlags = {} } = {}) {
  const context = resolveAtomicWechatReviewContext(store, input, featureFlags);
  const binding = getUnifiedAtomicWechatArtifactReviewBinding(store, input, { featureFlags });
  const reviews = (store.unifiedContentReviews || []).filter((fact) => fact?.contract === "UnifiedAtomicWechatEditorialReviewFact@1.0" && sameWechatScope(fact, context))
    .map((fact) => validateAtomicWechatEditorialFact(fact));
  const latestReview = reviews.at(-1) || null;
  let editorialCurrent = false;
  if (latestReview && binding.approved) {
    try { validateAtomicWechatEditorialFact(latestReview, context, binding); editorialCurrent = latestReview.status === "passed"; } catch {}
  }
  const selections = (store.unifiedContentSelections || []).filter((fact) => fact?.contract === "UnifiedAtomicWechatSelectionFact@1.0" && sameWechatScope(fact, context)).map(validateAtomicWechatSelectionFact);
  const latestSelection = selections.at(-1) || null;
  const selectionCurrent = Boolean(editorialCurrent && latestSelection && sameRef(latestSelection.artifactReviewFactRef, binding.currentReviewFactRef)
    && sameRef(latestSelection.editorialReviewFactRef, atomicFactRef(latestReview))
    && latestSelection.artifactStateHash === binding.artifactState.artifactStateHash
    && latestSelection.artifactAuthoritySetHash === binding.artifactAuthoritySetHash);
  return { schemaVersion: "1.0", contract: "UnifiedAtomicWechatReviewProjection@1.0", authorityKind: "atomic_wechat_v1",
    contentProjectRef: clone(context.executionProjectRef), materializedContentProjectRef: clone(context.materializedProjectRef), platform: "wechat",
    platformRunRef: clone(context.platformRunRef), articleRef: clone(context.candidateRef), commitRef: clone(context.payload.commitRef),
    artifactStateHash: binding.artifactState.artifactStateHash, artifactAuthoritySetHash: binding.artifactAuthoritySetHash,
    artifactApproved: binding.approved, editorialReviewPassed: editorialCurrent,
    selected: selectionCurrent && latestSelection.status === "selected", selectionStatus: selectionCurrent ? latestSelection.status : "not_selected",
    stale: binding.stale || Boolean((reviews.length && !editorialCurrent) || (selections.length && !selectionCurrent)),
    currentArtifactReviewFactRef: binding.currentReviewFactRef, currentEditorialReviewFactRef: editorialCurrent ? atomicFactRef(latestReview) : null,
    currentSelectionFactRef: selectionCurrent ? atomicFactRef(latestSelection) : null,
    artifactReviewFacts: binding.reviewFacts, editorialReviewFacts: reviews.map(clone), selectionFacts: selections.map(clone),
    uploadAuthority: false, promotionAuthority: false, deliveryAuthority: false, publicationAuthority: false,
    blockers: [...(!binding.approved ? ["wechat_human_review_required"] : []), ...(binding.approved && !editorialCurrent ? ["wechat_editorial_review_required"] : []),
      ...(editorialCurrent && !selectionCurrent ? ["wechat_selection_required"] : []), "wechat_upload_required", "wechat_promotion_required"] };
}

function atomicReviewDimensions(context, binding) {
  const carousel = context.components.carouselPlan;
  const visual = context.components.visualAssetPlan;
  const copyComponent = context.components.postCopy;
  const pages = carousel.pages || [];
  const body = copyComponent.bodySections || [];
  const dimensions = [
    ["page_necessity", pages.length > 0 && pages.length === binding.pageRevisionRefs.length && new Set(pages.map((item) => item.outlineSectionId)).size === pages.length, { pageCount: pages.length, revisionCount: binding.pageRevisionRefs.length }],
    ["sequence_continuity", pages.every((item, index) => item.page === index + 1) && body.length === pages.length, { pageOrder: pages.map((item) => item.page), bodySectionCount: body.length }],
    ["visual_consistency", typeof visual.designDnaVersion === "string" && visual.designDnaVersion === carousel.designDnaVersion, { carouselDesignDnaVersion: carousel.designDnaVersion, visualDesignDnaVersion: visual.designDnaVersion }],
    ["copy_visual_complementarity", sameRef(carousel.postCopyRef, { id: copyComponent.id, hash: copyComponent.componentHash }) && sameRef(visual.carouselPlanRef, { id: carousel.id, hash: carousel.componentHash }), { postCopyRef: clone(carousel.postCopyRef), carouselPlanRef: clone(visual.carouselPlanRef) }],
    ["information_density", body.length === pages.length && body.every((item) => typeof item.text === "string" && item.text.trim().length > 0), { populatedSections: body.filter((item) => typeof item.text === "string" && item.text.trim()).length }],
    ["click_conversion_value", Boolean(copyComponent.recommendedTitle?.trim()) && copyComponent.engagementStrategy?.primaryAction !== "none", { titlePresent: Boolean(copyComponent.recommendedTitle?.trim()), primaryAction: copyComponent.engagementStrategy?.primaryAction || null }]
  ];
  return dimensions.map(([id, passed, evidence]) => ({ id, status: passed ? "passed" : "failed", evidence }));
}

function createAtomicReviewFacts(context, binding, { idempotencyKey, requestHash, now }) {
  const scope = atomicScope(context);
  const checks = [
    { id: "atomic_candidate_v3", status: context.candidate.contract === "UnifiedContentCandidate@3.0" ? "passed" : "failed" },
    { id: "materialized_content", status: context.components.postCopy?.contract === "XhsPostCopy@1.0" && context.components.carouselPlan?.contract === "XhsCarouselPlan@2.0" ? "passed" : "failed" },
    { id: "human_artifact_approval", status: validRef(binding.artifactReviewActionRef) ? "passed" : "failed" },
    { id: "visual_skill_review", status: validRef(binding.visualReviewFactRef) ? "passed" : "failed" },
    { id: "page_revision_set", status: binding.pageRevisionRefs.length > 0 && binding.pageRevisionRefs.every(validRef) ? "passed" : "failed" }
  ];
  const machineBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicXhsMachineReviewFact@1.0",
    id: `atomic-machine-review:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    ...scope, artifactStateHash: binding.artifactStateHash, artifactReviewActionRef: clone(binding.artifactReviewActionRef),
    visualReviewFactRef: clone(binding.visualReviewFactRef), revisionSetHash: binding.revisionSetHash,
    pageRevisionRefs: clone(binding.pageRevisionRefs), status: checks.every((item) => item.status === "passed") ? "passed" : "failed", checks
  };
  const machineGate = { ...machineBase, factHash: hashUnifiedContent(machineBase) };
  const dimensions = atomicReviewDimensions(context, binding);
  const failed = dimensions.filter((item) => item.status !== "passed");
  const editorialBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicXhsEditorialReview@1.0",
    id: `atomic-editorial-review:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    ...scope, machineGateRef: atomicFactRef(machineGate), artifactStateHash: binding.artifactStateHash,
    artifactReviewActionRef: clone(binding.artifactReviewActionRef), visualReviewFactRef: clone(binding.visualReviewFactRef),
    revisionSetHash: binding.revisionSetHash, pageRevisionRefs: clone(binding.pageRevisionRefs), dimensions,
    findings: failed.map((item) => ({ dimension: item.id, evidence: clone(item.evidence) })),
    status: machineGate.status === "passed" && failed.length === 0 ? "passed" : "changes_required",
    targetRecoveryStage: failed.length ? "review_render" : null, reviewedAt: new Date(now).toISOString()
  };
  const editorialReview = { ...editorialBase, reviewHash: hashUnifiedContent(editorialBase) };
  return { machineGate, editorialReview };
}

function appendAtomicReview(store, context, input, { now }) {
  const candidateRef = resolveCandidate(context, input.candidateId);
  const binding = atomicArtifactBinding(context);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_REVIEW_IDEMPOTENCY_KEY_REQUIRED");
  const requestHash = requestIdentity(context, candidateRef, {
    materializedProjectRef: context.materializedProjectRef, artifactStateHash: binding.artifactStateHash,
    artifactReviewActionRef: binding.artifactReviewActionRef, artifactActionSetHash: binding.artifactActionSetHash,
    visualReviewFactRef: binding.visualReviewFactRef, revisionSetHash: binding.revisionSetHash, pageRevisionRefs: binding.pageRevisionRefs
  });
  const existing = idempotent(store.unifiedContentReviews || [], idempotencyKey, requestHash, "UNIFIED_REVIEW_IDEMPOTENCY_CONFLICT");
  if (existing) return { reviewFact: existing, created: false };
  const { machineGate, editorialReview } = createAtomicReviewFacts(context, binding, { idempotencyKey, requestHash, now });
  const base = {
    schemaVersion: "1.0", contract: "UnifiedAtomicXhsContentReviewFact@1.0",
    id: `atomic-review-fact:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    ...atomicScope(context), commitRef: clone(context.payload.commitRef), artifactStateHash: binding.artifactStateHash,
    artifactReviewActionRef: clone(binding.artifactReviewActionRef), artifactActionSetHash: binding.artifactActionSetHash,
    visualReviewFactRef: clone(binding.visualReviewFactRef), revisionSetHash: binding.revisionSetHash,
    pageRevisionRefs: clone(binding.pageRevisionRefs), machineGate, editorialReview,
    state: editorialReview.status === "passed" ? "editorial_review_passed" : "changes_required",
    targetRecoveryStage: editorialReview.targetRecoveryStage, idempotencyKey, requestHash, createdAt: new Date(now).toISOString()
  };
  const reviewFact = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedContentReviews = [...(store.unifiedContentReviews || []), reviewFact];
  return { reviewFact: clone(reviewFact), created: true };
}

export function appendUnifiedContentReview(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  if (context.authorityKind === "atomic_v2") return appendAtomicReview(store, context, input, { now });
  const candidateRef = resolveCandidate(context, input.candidateId);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_REVIEW_IDEMPOTENCY_KEY_REQUIRED");
  const candidateSet = candidateSetFor(context, candidateRef);
  const requestHash = requestIdentity(context, candidateRef, { artifactStateHash: candidateSet.artifactStateHash });
  const { reviews } = ensureUnifiedContentReviewStore(store);
  const existing = idempotent(reviews, idempotencyKey, requestHash, "UNIFIED_REVIEW_IDEMPOTENCY_CONFLICT");
  if (existing) return { reviewFact: existing, created: false };
  const machineGate = machineGateFor(context, candidateRef, candidateSet);
  let editorialReview = null;
  if (machineGate.status === "passed") {
    editorialReview = reviewContentSet({
      id: `editorial_review:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
      contentProject: context.snapshot.contentProject,
      platformRun: context.platformSnapshot.platformRunRef,
      candidateSet,
      machineGate,
      reviewedAt: new Date(now).toISOString()
    });
  }
  const base = {
    schemaVersion: "1.0",
    contract: "UnifiedContentReviewFact@1.0",
    id: `review_fact:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    workspaceId: context.workspaceId,
    companyId: context.companyId,
    accountId: context.accountId,
    contentProjectRef: projectRef(context.snapshot),
    platform: context.platform,
    platformRunRef: runRef(context.platformSnapshot),
    sharedContentMasterRef: clone(context.snapshot.sharedContentMasterRef),
    candidateRef,
    artifactStateHash: candidateSet.artifactStateHash,
    machineGate,
    editorialReview,
    state: machineGate.status !== "passed" ? "machine_review_blocked" : editorialReview.status === "passed" ? "editorial_review_passed" : "changes_required",
    targetRecoveryStage: editorialReview?.targetRecoveryStage || null,
    idempotencyKey,
    requestHash,
    createdAt: new Date(now).toISOString()
  };
  const reviewFact = { ...base, factHash: hashUnifiedContent(base) };
  reviews.push(reviewFact);
  return { reviewFact: clone(reviewFact), created: true };
}

function latestReview(reviews, context, candidateRef) {
  return reviews.filter((item) => item.contentProjectRef.id === context.snapshot.contentProject.id
    && item.platform === context.platform
    && sameRef(item.platformRunRef, runRef(context.platformSnapshot))
    && sameRef(item.candidateRef, candidateRef)).at(-1) || null;
}

function latestAtomicReview(reviews, context) {
  return reviews.map((item) => item?.contract === "UnifiedAtomicXhsContentReviewFact@1.0"
    ? validateAtomicStoredFact(item, "UnifiedAtomicXhsContentReviewFact@1.0") : item)
    .filter((item) => item?.contract === "UnifiedAtomicXhsContentReviewFact@1.0" && sameAtomicScope(item, context)).at(-1) || null;
}

function assertAtomicReviewCurrent(reviewFact, context, binding) {
  if (!reviewFact || reviewFact.state !== "editorial_review_passed" || reviewFact.editorialReview?.status !== "passed"
    || reviewFact.artifactStateHash !== binding.artifactStateHash
    || !sameRef(reviewFact.artifactReviewActionRef, binding.artifactReviewActionRef)
    || reviewFact.artifactActionSetHash !== binding.artifactActionSetHash
    || !sameRef(reviewFact.visualReviewFactRef, binding.visualReviewFactRef)
    || reviewFact.revisionSetHash !== binding.revisionSetHash
    || hashUnifiedContent(reviewFact.pageRevisionRefs) !== hashUnifiedContent(binding.pageRevisionRefs)) {
    fail("UNIFIED_SELECTION_ARTIFACT_REVIEW_STALE", "Editorial review is not bound to the current approved Artifact State", 409);
  }
}

function appendAtomicSelection(store, context, input, { now }) {
  resolveCandidate(context, input.candidateId);
  const binding = atomicArtifactBinding(context);
  const reviewId = text(input?.reviewId, "UNIFIED_SELECTION_REVIEW_ID_REQUIRED");
  const actorId = text(input?.actorId, "UNIFIED_SELECTION_ACTOR_REQUIRED");
  if (input?.actorType !== "user") fail("UNIFIED_SELECTION_EXPLICIT_USER_REQUIRED", "Selection requires actorType=user", 400);
  const occurredAt = text(input?.occurredAt, "UNIFIED_SELECTION_OCCURRED_AT_REQUIRED");
  if (Number.isNaN(Date.parse(occurredAt))) fail("UNIFIED_SELECTION_OCCURRED_AT_INVALID", "occurredAt must be ISO-8601", 400);
  const action = input?.action === "confirm_selection" ? "selected" : input?.action;
  if (!["selected", "not_selected"].includes(action)) fail("UNIFIED_SELECTION_ACTION_INVALID", "Selection action must be explicit", 400);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_SELECTION_IDEMPOTENCY_KEY_REQUIRED");
  const reviewFact = latestAtomicReview(store.unifiedContentReviews || [], context);
  if (!reviewFact || reviewFact.id !== reviewId) fail("UNIFIED_SELECTION_STALE_OR_CROSS_PLATFORM_REVIEW", "Selection must bind the latest exact Atomic review", 409);
  assertAtomicReviewCurrent(reviewFact, context, binding);
  const requestHash = requestIdentity(context, context.candidateRef, {
    materializedProjectRef: context.materializedProjectRef, reviewFactRef: atomicFactRef(reviewFact),
    artifactStateHash: binding.artifactStateHash, artifactReviewActionRef: binding.artifactReviewActionRef,
    artifactActionSetHash: binding.artifactActionSetHash, visualReviewFactRef: binding.visualReviewFactRef,
    revisionSetHash: binding.revisionSetHash, pageRevisionRefs: binding.pageRevisionRefs,
    actorId, actorType: "user", occurredAt: new Date(occurredAt).toISOString(), action
  });
  const existing = idempotent(store.unifiedContentSelections || [], idempotencyKey, requestHash, "UNIFIED_SELECTION_IDEMPOTENCY_CONFLICT");
  if (existing) return { selectionFact: existing, created: false };
  const base = {
    schemaVersion: "1.0", contract: "UnifiedAtomicXhsSelectionFact@1.0",
    id: `atomic-selection-fact:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    ...atomicScope(context), commitRef: clone(context.payload.commitRef), reviewFactRef: atomicFactRef(reviewFact),
    editorialReviewRef: { id: reviewFact.editorialReview.id, hash: reviewFact.editorialReview.reviewHash },
    artifactStateHash: binding.artifactStateHash, artifactReviewActionRef: clone(binding.artifactReviewActionRef),
    artifactActionSetHash: binding.artifactActionSetHash, visualReviewFactRef: clone(binding.visualReviewFactRef),
    revisionSetHash: binding.revisionSetHash, pageRevisionRefs: clone(binding.pageRevisionRefs),
    status: action, actorId, actorType: "user", occurredAt: new Date(occurredAt).toISOString(),
    promotionAuthority: false, publicationAuthority: false, deliveryReady: false,
    idempotencyKey, requestHash, createdAt: new Date(now).toISOString()
  };
  const selectionFact = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedContentSelections = [...(store.unifiedContentSelections || []), selectionFact];
  return { selectionFact: clone(selectionFact), created: true };
}

export function appendUnifiedContentSelection(store, input, { now = new Date().toISOString(), featureFlags = {} } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  if (context.authorityKind === "atomic_v2") return appendAtomicSelection(store, context, input, { now });
  const candidateRef = resolveCandidate(context, input.candidateId);
  const reviewId = text(input?.reviewId, "UNIFIED_SELECTION_REVIEW_ID_REQUIRED");
  const actorId = text(input?.actorId, "UNIFIED_SELECTION_ACTOR_REQUIRED");
  const action = input?.action === "confirm_selection" ? "selected" : input?.action;
  if (!["selected", "not_selected"].includes(action)) fail("UNIFIED_SELECTION_ACTION_INVALID", "Selection action must be explicit", 400);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_SELECTION_IDEMPOTENCY_KEY_REQUIRED");
  const { reviews, selections } = ensureUnifiedContentReviewStore(store);
  const reviewFact = reviews.find((item) => item.id === reviewId
    && item.contentProjectRef.id === context.snapshot.contentProject.id
    && item.companyId === context.companyId && item.accountId === context.accountId && item.platform === context.platform);
  const latest = latestReview(reviews, context, candidateRef);
  if (!reviewFact || reviewFact.id !== latest?.id || !sameRef(reviewFact.candidateRef, candidateRef) || reviewFact.platform !== context.platform) {
    fail("UNIFIED_SELECTION_STALE_OR_CROSS_PLATFORM_REVIEW", "Selection must bind the latest exact platform review", 409);
  }
  if (!reviewFact.editorialReview) fail("UNIFIED_SELECTION_EDITORIAL_REVIEW_MISSING", "Machine review did not produce an editorial review", 409);
  const candidateSet = candidateSetFor(context, candidateRef);
  if (candidateSet.artifactSelectable === false) fail("UNIFIED_SELECTION_ARTIFACT_REVIEW_REQUIRED", "Artifact set must be explicitly approved before selection", 409);
  if (candidateSet.artifactStateHash && reviewFact.artifactStateHash !== candidateSet.artifactStateHash) fail("UNIFIED_SELECTION_ARTIFACT_REVIEW_STALE", "Editorial review is bound to a stale artifact state", 409);
  const requestHash = requestIdentity(context, candidateRef, { reviewRef: reviewRef(reviewFact.editorialReview), artifactStateHash: candidateSet.artifactStateHash, actorId, action });
  const existing = idempotent(selections, idempotencyKey, requestHash, "UNIFIED_SELECTION_IDEMPOTENCY_CONFLICT");
  if (existing) return { selectionFact: existing, created: false };
  const gate = createUserSelectionGate({
    id: `selection_gate:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    contentProject: context.snapshot.contentProject,
    platformRun: context.platformSnapshot.platformRunRef,
    candidateSet,
    editorialReview: reviewFact.editorialReview,
    event: {
      id: `selection_event:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
      actorId,
      actorType: "user",
      action,
      occurredAt: new Date(now).toISOString()
    }
  });
  const base = {
    schemaVersion: "1.0",
    contract: "UnifiedContentSelectionFact@1.0",
    id: `selection_fact:${hashUnifiedContent({ requestHash, idempotencyKey }).slice(0, 20)}`,
    workspaceId: context.workspaceId,
    companyId: context.companyId,
    accountId: context.accountId,
    contentProjectRef: projectRef(context.snapshot),
    platform: context.platform,
    platformRunRef: runRef(context.platformSnapshot),
    sharedContentMasterRef: clone(context.snapshot.sharedContentMasterRef),
    candidateRef,
    reviewFactRef: { id: reviewFact.id, hash: reviewFact.factHash },
    artifactStateHash: candidateSet.artifactStateHash,
    selectionGate: gate,
    status: gate.status,
    idempotencyKey,
    requestHash,
    createdAt: new Date(now).toISOString()
  };
  const selectionFact = { ...base, factHash: hashUnifiedContent(base) };
  selections.push(selectionFact);
  return { selectionFact: clone(selectionFact), created: true };
}

function listAtomicReviewState(store, context) {
  const reviews = (store.unifiedContentReviews || []).filter((item) => item?.contract === "UnifiedAtomicXhsContentReviewFact@1.0" && sameAtomicScope(item, context)).map((item) => clone(validateAtomicStoredFact(item, "UnifiedAtomicXhsContentReviewFact@1.0")));
  const selections = (store.unifiedContentSelections || []).filter((item) => item?.contract === "UnifiedAtomicXhsSelectionFact@1.0" && sameAtomicScope(item, context)).map((item) => clone(validateAtomicStoredFact(item, "UnifiedAtomicXhsSelectionFact@1.0")));
  let binding = null;
  try { binding = atomicArtifactBinding(context); } catch {}
  const latestReviewFact = reviews.at(-1) || null;
  let editorialReviewPassed = false;
  if (binding && latestReviewFact) {
    try { assertAtomicReviewCurrent(latestReviewFact, context, binding); editorialReviewPassed = true; } catch {}
  }
  const latestSelection = selections.at(-1) || null;
  const selectionCurrent = Boolean(editorialReviewPassed && latestSelection
    && sameRef(latestSelection.reviewFactRef, atomicFactRef(latestReviewFact))
    && latestSelection.artifactStateHash === binding.artifactStateHash
    && latestSelection.artifactActionSetHash === binding.artifactActionSetHash
    && sameRef(latestSelection.visualReviewFactRef, binding.visualReviewFactRef)
    && latestSelection.revisionSetHash === binding.revisionSetHash
    && hashUnifiedContent(latestSelection.pageRevisionRefs) === hashUnifiedContent(binding.pageRevisionRefs));
  return {
    authorityKind: "atomic_v2", contentProjectRef: clone(context.executionProjectRef), materializedContentProjectRef: clone(context.materializedProjectRef),
    platform: "xiaohongshu", platformRunRef: clone(context.platformRunRef), candidateRef: clone(context.candidateRef),
    artifactApproved: Boolean(binding), editorialReviewPassed,
    selected: selectionCurrent ? latestSelection.status === "selected" : false,
    selectionStatus: selectionCurrent ? latestSelection.status : "not_selected",
    stale: Boolean((reviews.length && !editorialReviewPassed) || (selections.length && !selectionCurrent)),
    promoted: false, deliveryReady: false, published: false,
    blockers: [
      ...(!binding ? ["human_artifact_review_required"] : []),
      ...(binding && !editorialReviewPassed ? ["editorial_review_required"] : []),
      ...(editorialReviewPassed && !selectionCurrent ? ["user_selection_required"] : []),
      "promotion_required", "wechat_not_materialized"
    ],
    artifactStateHash: binding?.artifactStateHash || context.artifactReview.artifactState.artifactStateHash,
    artifactReviewActionRef: binding?.artifactReviewActionRef || null,
    visualReviewFactRef: binding?.visualReviewFactRef || null,
    currentReviewFactRef: editorialReviewPassed ? atomicFactRef(latestReviewFact) : null,
    currentSelectionFactRef: selectionCurrent ? atomicFactRef(latestSelection) : null,
    reviewFacts: reviews, selectionFacts: selections
  };
}

export function listUnifiedContentReviewState(store, input, { featureFlags = {} } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  if (context.authorityKind === "atomic_v2") return listAtomicReviewState(store, context);
  const { reviews, selections } = ensureUnifiedContentReviewStore(store);
  const scopedReviews = reviews.filter((item) => item.contentProjectRef.id === context.snapshot.contentProject.id
    && item.companyId === context.companyId && item.accountId === context.accountId && item.platform === context.platform);
  const scopedSelections = selections.filter((item) => item.contentProjectRef.id === context.snapshot.contentProject.id
    && item.companyId === context.companyId && item.accountId === context.accountId && item.platform === context.platform);
  return {
    contentProjectRef: projectRef(context.snapshot),
    platform: context.platform,
    platformRunRef: runRef(context.platformSnapshot),
    machineReviews: scopedReviews.map((item) => item.machineGate).filter((item, index, all) => all.findIndex((other) => sameRef(other.ref, item.ref)) === index).map(clone),
    editorialReviews: scopedReviews.filter((item) => item.editorialReview).map((item) => clone(item.editorialReview)),
    reviewFacts: scopedReviews.map(clone),
    selectionFacts: scopedSelections.map(clone)
  };
}

export function buildSavedContentPromotionRequest(store, input, { featureFlags = {} } = {}) {
  const context = resolveOwnedContext(store, input, featureFlags);
  if (context.authorityKind === "atomic_v2") fail("UNIFIED_ATOMIC_SELECTION_PROMOTION_NOT_AUTHORIZED", "Atomic selection does not grant promotion authority", 409);
  const candidateRef = resolveCandidate(context, input.candidateId);
  const selectionId = text(input?.selectionId, "UNIFIED_PROMOTION_SELECTION_ID_REQUIRED");
  const { reviews, selections } = ensureUnifiedContentReviewStore(store);
  const selectionFact = selections.find((item) => item.id === selectionId
    && item.contentProjectRef.id === context.snapshot.contentProject.id
    && item.companyId === context.companyId && item.accountId === context.accountId && item.platform === context.platform);
  const latest = latestReview(reviews, context, candidateRef);
  const currentCandidateSet = candidateSetFor(context, candidateRef);
  if (!selectionFact || selectionFact.status !== "selected" || !sameRef(selectionFact.candidateRef, candidateRef) || selectionFact.platform !== context.platform) {
    fail("UNIFIED_PROMOTION_SELECTION_STALE_OR_CROSS_PLATFORM", "Promotion requires the exact saved selected fact", 409);
  }
  if (selectionFact.reviewFactRef.id !== latest?.id || selectionFact.reviewFactRef.hash !== latest?.factHash) {
    fail("UNIFIED_PROMOTION_REVIEW_STALE", "Promotion selection is bound to a stale review", 409);
  }
  if (currentCandidateSet.artifactStateHash && selectionFact.artifactStateHash !== currentCandidateSet.artifactStateHash) fail("UNIFIED_PROMOTION_ARTIFACT_REVIEW_STALE", "Promotion selection is bound to a stale artifact state", 409);
  const promotion = context.platformSnapshot.reviewInput?.input?.promotion;
  if (!promotion?.deliveryBundle || !promotion?.contentTaskId || !promotion?.provenance) {
    fail("UNIFIED_PROMOTION_SAVED_INPUT_MISSING", "Saved delivery and task bindings are required", 409);
  }
  const deliveryBundle = clone(promotion.deliveryBundle);
  return {
    schemaVersion: "1.0",
    contract: "ContentPromotionRequest@1.0",
    contentTaskId: promotion.contentTaskId,
    companyId: context.companyId,
    accountId: context.accountId,
    provenance: promotion.provenance,
    contentProject: clone(context.snapshot.contentProject),
    platformRun: clone(context.platformSnapshot.platformRunRef),
    candidateSet: currentCandidateSet,
    editorialReview: clone(latest.editorialReview),
    selectionGate: clone(selectionFact.selectionGate),
    deliveryBundle,
    sourceManifestRef: clone(deliveryBundle.manifestRef),
    deliveryArtifactRef: { id: `delivery-bundle:${deliveryBundle.platformVersionRef.id}`, hash: deliveryBundle.bundleHash }
  };
}
