import { getUnifiedAtomicContentProductProjection, validateUnifiedAtomicContentProductProjection } from "./unified-atomic-product-projection.mjs";
import { validateUnifiedAtomicContentCommitV2 } from "./unified-atomic-content-commit-store.mjs";
import { validateUnifiedAtomicWechatContentCommit } from "./unified-atomic-wechat-commit.mjs";
import {
  getUnifiedAtomicMultiplatformProduct,
  validateUnifiedAtomicMultiplatformProduct
} from "./unified-atomic-multiplatform-product.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { resolveUnifiedWechatProductionVersion, validateUnifiedWechatRevisionExecution } from "./unified-wechat-production-control.mjs";

const HASH = /^[a-f0-9]{64}$/;
const RESOLUTION_CONTRACT = "UnifiedContentAuthorityResolution@1.0";
const ROOT_KEYS = Object.freeze([
  "schemaVersion", "contract", "authorityKind", "workspaceId", "companyId", "accountId", "projectId", "platform",
  "productAuthorityHash", "executionProjectRef", "materializedProjectRef", "platformRunRef", "candidateRef", "payload"
]);
const ATOMIC_PAYLOAD_KEYS = Object.freeze([
  "projection", "commit", "contentProjectIdentity", "contentProject", "candidate", "assemblyOutput", "components", "componentFacts", "graph", "commitRef"
]);
const LEGACY_PAYLOAD_KEYS = Object.freeze(["snapshot", "platformSnapshot"]);
const ATOMIC_WECHAT_PAYLOAD_KEYS = Object.freeze([
  "product", "commit", "contentProjectIdentity", "contentProject", "article", "articleReview", "canonicalImagePlan",
  "compilerFacts", "skillFacts", "commitRef", "revisionExecution"
]);
const ATOMIC_COMPONENT_ROLES = Object.freeze(["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan", "traceability", "preflightReport"]);
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

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exact(value, keys, errorCode = "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID") {
  if (!object(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) fail(errorCode, errorCode, 409);
  return value;
}

function validRef(value, errorCode = "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_REF_INVALID") {
  if (!object(value) || typeof value.id !== "string" || !value.id.trim() || !HASH.test(value.hash || "")) fail(errorCode, errorCode, 409);
  return value;
}

function assertSameRef(actual, expected, errorCode = "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_CLOSURE_INVALID") {
  validRef(actual, errorCode);
  validRef(expected, errorCode);
  if (!sameRef(actual, expected)) fail(errorCode, errorCode, 409, { expected, actual });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function code(codes, key, fallback) {
  return codes?.[key] || fallback;
}

function validateAtomicResolution(value) {
  exact(value.payload, ATOMIC_PAYLOAD_KEYS, "UNIFIED_CONTENT_AUTHORITY_ATOMIC_PAYLOAD_FIELDS_INVALID");
  const { projection, commit, contentProjectIdentity, contentProject, candidate, assemblyOutput, components, componentFacts, graph, commitRef } = value.payload;
  validateUnifiedAtomicContentProductProjection(projection);
  validateUnifiedAtomicContentCommitV2(commit);
  exact(components, ATOMIC_COMPONENT_ROLES, "UNIFIED_CONTENT_AUTHORITY_ATOMIC_COMPONENTS_INVALID");
  exact(componentFacts, ATOMIC_COMPONENT_ROLES, "UNIFIED_CONTENT_AUTHORITY_ATOMIC_COMPONENT_FACTS_INVALID");
  if (value.platform !== "xiaohongshu" || projection.contract !== "UnifiedAtomicContentProductProjection@1.0"
    || commit.contract !== "UnifiedAtomicContentCommit@2.0" || candidate.contract !== "UnifiedContentCandidate@3.0"
    || assemblyOutput.contract !== "XhsPostPackage@4.0") fail("UNIFIED_CONTENT_AUTHORITY_ATOMIC_CONTRACT_INVALID");
  if (value.productAuthorityHash !== projection.projectionHash || value.projectId !== commit.contentProjectIdentity.id
    || value.companyId !== commit.companyId || value.accountId !== commit.accountId || value.companyId !== projection.companyId || value.accountId !== projection.accountId) {
    fail("UNIFIED_CONTENT_AUTHORITY_ATOMIC_OWNERSHIP_INVALID");
  }
  assertSameRef(commitRef, { id: commit.id, hash: commit.commitHash });
  assertSameRef(projection.commitRef, commitRef);
  assertSameRef(value.executionProjectRef, { id: commit.contentProjectIdentity.id, hash: commit.contentProjectIdentity.identityHash });
  assertSameRef(value.executionProjectRef, projection.refs.contentProjectIdentityRef);
  assertSameRef(value.materializedProjectRef, commit.materializedContentProjectRef);
  assertSameRef(value.materializedProjectRef, projection.refs.materializedContentProjectRef);
  assertSameRef(value.platformRunRef, commit.platformRunRef);
  assertSameRef(value.platformRunRef, projection.refs.platformRunRef);
  assertSameRef(value.candidateRef, { id: commit.candidate.id, hash: commit.candidate.candidateHash });
  assertSameRef(value.candidateRef, projection.refs.candidateRef);
  if (hashUnifiedContent(contentProjectIdentity) !== hashUnifiedContent(commit.contentProjectIdentity)
    || hashUnifiedContent(contentProject) !== hashUnifiedContent(commit.contentProject)
    || hashUnifiedContent(candidate) !== hashUnifiedContent(commit.candidate)
    || hashUnifiedContent(assemblyOutput) !== hashUnifiedContent(commit.assemblyOutput)
    || hashUnifiedContent(graph) !== hashUnifiedContent(commit.graph)) fail("UNIFIED_CONTENT_AUTHORITY_ATOMIC_PAYLOAD_CLOSURE_INVALID");
  for (const role of ATOMIC_COMPONENT_ROLES) {
    const materialized = commit.materializedComponents.find((item) => item.role === role);
    if (!materialized || hashUnifiedContent(components[role]) !== hashUnifiedContent(materialized.component)
      || hashUnifiedContent(componentFacts[role]) !== hashUnifiedContent(materialized.fact)) fail("UNIFIED_CONTENT_AUTHORITY_ATOMIC_COMPONENT_CLOSURE_INVALID");
  }
}

function validateLegacyResolution(value) {
  exact(value.payload, LEGACY_PAYLOAD_KEYS, "UNIFIED_CONTENT_AUTHORITY_LEGACY_PAYLOAD_FIELDS_INVALID");
  const { snapshot, platformSnapshot } = value.payload;
  if (snapshot?.schemaVersion !== "1.0" || snapshot?.contract !== "UnifiedContentProductSnapshot@1.0") fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_SNAPSHOT_CONTRACT_INVALID");
  if (!HASH.test(snapshot.productSnapshotHash || "") || value.productAuthorityHash !== snapshot.productSnapshotHash) fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_SNAPSHOT_HASH_INVALID");
  const runs = (snapshot.platforms || []).filter((item) => item.platform === value.platform && item.accountId === value.accountId);
  if (runs.length !== 1 || hashUnifiedContent(runs[0]) !== hashUnifiedContent(platformSnapshot)) fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_RUN_CLOSURE_INVALID");
  if (value.projectId !== snapshot.contentProject?.id || value.companyId !== snapshot.contentProject?.companyId) fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_OWNERSHIP_INVALID");
  assertSameRef(value.executionProjectRef, { id: snapshot.contentProject.id, hash: snapshot.contentProject.projectHash });
  assertSameRef(value.materializedProjectRef, value.executionProjectRef);
  assertSameRef(value.platformRunRef, platformSnapshot.platformRunRef);
  const candidates = (platformSnapshot.candidateRefs || []).filter((item) => sameRef(item, value.candidateRef));
  if (candidates.length !== 1) fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_CANDIDATE_CLOSURE_INVALID");
}

function validateAtomicWechatResolution(value) {
  exact(value.payload, ATOMIC_WECHAT_PAYLOAD_KEYS, "UNIFIED_CONTENT_AUTHORITY_ATOMIC_WECHAT_PAYLOAD_FIELDS_INVALID");
  const { product, commit, contentProjectIdentity, contentProject, article, articleReview, canonicalImagePlan, compilerFacts, skillFacts, commitRef, revisionExecution } = value.payload;
  validateUnifiedAtomicMultiplatformProduct(product);
  validateUnifiedAtomicWechatContentCommit(commit);
  if (value.platform !== "wechat" || value.authorityKind !== "atomic_wechat_v1" || commit.platform !== "wechat"
    || value.productAuthorityHash !== product.aggregateHash || value.projectId !== commit.contentProjectIdentity.id
    || value.companyId !== commit.companyId || value.accountId !== commit.accountId) fail("UNIFIED_CONTENT_AUTHORITY_ATOMIC_WECHAT_OWNERSHIP_INVALID");
  assertSameRef(commitRef, { id: commit.id, hash: commit.commitHash });
  assertSameRef(product.commitRefs.wechat, commitRef);
  assertSameRef(value.executionProjectRef, commit.contentProjectRef);
  assertSameRef(value.executionProjectRef, product.productIdentityRef);
  assertSameRef(value.materializedProjectRef, commit.materializedContentProjectRef);
  assertSameRef(value.materializedProjectRef, product.platformMaterializedProjectRefs.wechat);
  assertSameRef(value.platformRunRef, commit.platformRunRef);
  const expectedArticleRef = revisionExecution
    ? (validateUnifiedWechatRevisionExecution(revisionExecution), revisionExecution.articleRef)
    : { id: commit.materializedComponents.article.id, hash: commit.materializedComponents.article.componentHash };
  assertSameRef(value.candidateRef, expectedArticleRef);
  if (hashUnifiedContent(contentProjectIdentity) !== hashUnifiedContent(commit.contentProjectIdentity)
    || hashUnifiedContent(contentProject) !== hashUnifiedContent(commit.contentProject)
    || hashUnifiedContent(article) !== hashUnifiedContent(revisionExecution?.article || commit.materializedComponents.article)
    || hashUnifiedContent(articleReview) !== hashUnifiedContent(commit.materializedComponents.articleReview)
    || hashUnifiedContent(canonicalImagePlan) !== hashUnifiedContent(revisionExecution?.canonicalImagePlan || commit.materializedComponents.imagePlan)
    || hashUnifiedContent(compilerFacts) !== hashUnifiedContent(commit.compilerFacts)
    || hashUnifiedContent(skillFacts) !== hashUnifiedContent(commit.skillFacts)) fail("UNIFIED_CONTENT_AUTHORITY_ATOMIC_WECHAT_PAYLOAD_CLOSURE_INVALID");
}

export function validateUnifiedContentAuthorityResolution(value) {
  exact(value, ROOT_KEYS);
  if (value.schemaVersion !== "1.0" || value.contract !== RESOLUTION_CONTRACT) fail("UNIFIED_CONTENT_AUTHORITY_RESOLUTION_CONTRACT_INVALID");
  for (const key of ["workspaceId", "companyId", "accountId", "projectId", "platform"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) fail("UNIFIED_CONTENT_AUTHORITY_RESOLUTION_IDENTITY_INVALID");
  }
  if (!HASH.test(value.productAuthorityHash || "")) fail("UNIFIED_CONTENT_AUTHORITY_RESOLUTION_HASH_INVALID");
  for (const refName of ["executionProjectRef", "materializedProjectRef", "platformRunRef", "candidateRef"]) validRef(value[refName]);
  if (value.authorityKind === "atomic_v2") validateAtomicResolution(value);
  else if (value.authorityKind === "atomic_wechat_v1") validateAtomicWechatResolution(value);
  else if (value.authorityKind === "legacy_snapshot_v1") validateLegacyResolution(value);
  else fail("UNIFIED_CONTENT_AUTHORITY_RESOLUTION_KIND_INVALID");
  return true;
}

function resolution(value) {
  validateUnifiedContentAuthorityResolution(value);
  return deepFreeze(value);
}

function ownedAccount(store, input, codes) {
  const workspaceId = text(input?.workspaceId, code(codes, "workspaceRequired", "UNIFIED_CONTENT_AUTHORITY_WORKSPACE_REQUIRED"));
  const companyId = text(input?.companyId, code(codes, "companyRequired", "UNIFIED_CONTENT_AUTHORITY_COMPANY_REQUIRED"));
  const accountId = text(input?.accountId, code(codes, "accountRequired", "UNIFIED_CONTENT_AUTHORITY_ACCOUNT_REQUIRED"));
  const projectId = text(input?.projectId, code(codes, "projectRequired", "UNIFIED_CONTENT_AUTHORITY_PROJECT_REQUIRED"));
  const platform = input?.platform || "xiaohongshu";
  const company = (store.accounts || []).find((item) => item.id === companyId && (item.accountType === "company" || item.companyId === item.id));
  if (!company) fail(code(codes, "companyNotFound", "UNIFIED_CONTENT_AUTHORITY_COMPANY_NOT_FOUND"), "Company not found", 404);
  if ((company.workspaceId || "workspace_default") !== workspaceId) fail(code(codes, "workspaceMismatch", "UNIFIED_CONTENT_AUTHORITY_WORKSPACE_MISMATCH"), "Company does not belong to workspace", 403);
  const account = (store.accounts || []).find((item) => (item.socialAccountId || item.id) === accountId && item.companyId === companyId && item.accountType !== "company");
  if (!account || account.platform !== platform) fail(code(codes, "accountOwnershipMismatch", "UNIFIED_CONTENT_AUTHORITY_ACCOUNT_OWNERSHIP_MISMATCH"), "Account does not belong to company or platform", 403);
  if ((account.workspaceId || company.workspaceId || "workspace_default") !== workspaceId) fail(code(codes, "accountWorkspaceMismatch", "UNIFIED_CONTENT_AUTHORITY_ACCOUNT_WORKSPACE_MISMATCH"), "Account does not belong to workspace", 403);
  return { workspaceId, companyId, accountId, projectId, platform };
}

function atomicAuthority(store, scope, input, codes) {
  if (scope.platform !== "xiaohongshu") fail("UNIFIED_ATOMIC_AUTHORITY_PLATFORM_NOT_MATERIALIZED", "Atomic authority does not materialize the requested platform", 409);
  const projection = getUnifiedAtomicContentProductProjection(store, scope.projectId);
  if (!projection) fail(code(codes, "projectNotFound", "UNIFIED_ATOMIC_AUTHORITY_PROJECT_NOT_FOUND"), "Atomic content project not found", 404);
  if (projection.companyId !== scope.companyId) fail(code(codes, "projectOwnershipMismatch", "UNIFIED_ATOMIC_AUTHORITY_PROJECT_OWNERSHIP_MISMATCH"), "Project does not belong to company", 403);
  if (projection.accountId !== scope.accountId || projection.xiaohongshu.accountId !== scope.accountId) fail(code(codes, "projectAccountMismatch", "UNIFIED_ATOMIC_AUTHORITY_PROJECT_ACCOUNT_MISMATCH"), "Project run does not belong to account", 403);
  const authorityHash = input?.productSnapshotHash;
  if (authorityHash !== undefined && (!HASH.test(authorityHash || "") || authorityHash !== projection.projectionHash)) {
    fail(code(codes, "snapshotHashMismatch", "UNIFIED_ATOMIC_AUTHORITY_PROJECTION_HASH_MISMATCH"), "Caller must bind the exact atomic product projection", 409);
  }
  const commits = store.unifiedAtomicContentCommits || [];
  const matches = commits.filter((item) => item?.schemaVersion === "2.0" && item?.contract === "UnifiedAtomicContentCommit@2.0"
    && item.id === projection.commitRef.id && item.commitHash === projection.commitRef.hash);
  if (matches.length !== 1) fail("UNIFIED_ATOMIC_AUTHORITY_COMMIT_AMBIGUOUS", "Atomic materialized commit is missing or duplicated", 409);
  const commit = clone(matches[0]);
  validateUnifiedAtomicContentCommitV2(commit);
  const candidateRef = { id: commit.candidate.id, hash: commit.candidate.candidateHash };
  if (!sameRef(candidateRef, projection.refs.candidateRef) || !sameRef(commit.platformRunRef, projection.refs.platformRunRef)
    || !sameRef(commit.materializedContentProjectRef, projection.refs.materializedContentProjectRef)) {
    fail("UNIFIED_ATOMIC_AUTHORITY_PROJECTION_STALE", "Atomic projection does not match its materialized commit", 409);
  }
  return resolution({
    schemaVersion: "1.0",
    contract: RESOLUTION_CONTRACT,
    authorityKind: "atomic_v2",
    ...scope,
    projectId: commit.contentProjectIdentity.id,
    productAuthorityHash: projection.projectionHash,
    executionProjectRef: clone(projection.refs.contentProjectIdentityRef),
    materializedProjectRef: clone(projection.refs.materializedContentProjectRef),
    platformRunRef: clone(projection.refs.platformRunRef),
    candidateRef: clone(candidateRef),
    payload: {
      projection: clone(projection),
      commit: clone(commit),
      contentProjectIdentity: clone(commit.contentProjectIdentity),
      contentProject: clone(commit.contentProject),
      candidate: clone(commit.candidate),
      assemblyOutput: clone(commit.assemblyOutput),
      components: Object.fromEntries(commit.materializedComponents.map((item) => [item.role, clone(item.component)])),
      componentFacts: Object.fromEntries(commit.materializedComponents.map((item) => [item.role, clone(item.fact)])),
      graph: clone(commit.graph),
      commitRef: clone(projection.commitRef)
    }
  });
}

function atomicWechatAuthority(store, scope, input, codes) {
  if (scope.platform !== "wechat") fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_PLATFORM_INVALID", "Atomic WeChat authority requires WeChat", 409);
  const product = getUnifiedAtomicMultiplatformProduct(store, scope.projectId);
  if (!product) fail(code(codes, "projectNotFound", "UNIFIED_ATOMIC_WECHAT_AUTHORITY_PROJECT_NOT_FOUND"), "Atomic content project not found", 404);
  if (product.companyId !== scope.companyId) fail(code(codes, "projectOwnershipMismatch", "UNIFIED_ATOMIC_WECHAT_AUTHORITY_PROJECT_OWNERSHIP_MISMATCH"), "Project does not belong to company", 403);
  const platform = product.platforms.wechat;
  if (platform.state !== "materialized") fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_NOT_MATERIALIZED", "Atomic WeChat is not materialized", 409);
  if (platform.accountId !== scope.accountId) fail(code(codes, "projectAccountMismatch", "UNIFIED_ATOMIC_WECHAT_AUTHORITY_PROJECT_ACCOUNT_MISMATCH"), "Project run does not belong to account", 403);
  if (input?.productSnapshotHash !== undefined && input.productSnapshotHash !== product.aggregateHash) {
    fail(code(codes, "snapshotHashMismatch", "UNIFIED_ATOMIC_WECHAT_AUTHORITY_PROJECTION_HASH_MISMATCH"), "Caller must bind the exact aggregate product", 409);
  }
  const matches = (store.unifiedAtomicContentCommits || []).filter((item) => item?.contract === "UnifiedAtomicWechatContentCommit@1.0"
    && item.id === platform.commitRef.id && item.commitHash === platform.commitRef.hash);
  if (matches.length !== 1) fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_COMMIT_AMBIGUOUS", "Atomic WeChat commit is missing or duplicated", 409);
  const commit = clone(matches[0]);
  validateUnifiedAtomicWechatContentCommit(commit);
  const current = resolveUnifiedWechatProductionVersion(store, scope.projectId, { getProduct: () => product });
  return resolution({
    schemaVersion: "1.0", contract: RESOLUTION_CONTRACT, authorityKind: "atomic_wechat_v1", ...scope,
    projectId: commit.contentProjectIdentity.id, productAuthorityHash: product.aggregateHash,
    executionProjectRef: clone(commit.contentProjectRef), materializedProjectRef: clone(commit.materializedContentProjectRef),
    platformRunRef: clone(commit.platformRunRef),
    candidateRef: clone(current.articleRef),
    payload: {
      product: clone(product), commit, contentProjectIdentity: clone(commit.contentProjectIdentity), contentProject: clone(commit.contentProject),
      article: clone(current.article), articleReview: clone(commit.materializedComponents.articleReview),
      canonicalImagePlan: clone(current.canonicalImagePlan), compilerFacts: clone(commit.compilerFacts),
      skillFacts: clone(commit.skillFacts), commitRef: clone(platform.commitRef), revisionExecution: clone(current.revisionExecution)
    }
  });
}

function legacyAuthority(store, scope, input, codes) {
  const matches = (store.unifiedContentProjects || []).filter((item) => item.id === scope.projectId || item.contentProject?.id === scope.projectId);
  if (matches.length !== 1) {
    if (matches.length > 1) fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_PROJECT_AMBIGUOUS", "Legacy content project is duplicated", 409);
    fail(code(codes, "projectNotFound", "UNIFIED_CONTENT_AUTHORITY_PROJECT_NOT_FOUND"), "Unified content project not found", 404);
  }
  const snapshot = matches[0];
  if (snapshot.contentProject?.companyId !== scope.companyId) fail(code(codes, "projectOwnershipMismatch", "UNIFIED_CONTENT_AUTHORITY_PROJECT_OWNERSHIP_MISMATCH"), "Project does not belong to company", 403);
  const platformSnapshot = snapshot.platforms?.find((item) => item.platform === scope.platform);
  if (!platformSnapshot || platformSnapshot.accountId !== scope.accountId) fail(code(codes, "projectAccountMismatch", "UNIFIED_CONTENT_AUTHORITY_PROJECT_ACCOUNT_MISMATCH"), "Project run does not belong to account", 403);
  if (input?.productSnapshotHash !== undefined && (!HASH.test(input.productSnapshotHash || "") || input.productSnapshotHash !== snapshot.productSnapshotHash)) {
    fail(code(codes, "snapshotHashMismatch", "UNIFIED_CONTENT_AUTHORITY_SNAPSHOT_HASH_MISMATCH"), "Caller must bind the exact product snapshot", 409);
  }
  const candidateRefs = platformSnapshot.candidateRefs || [];
  const requested = input?.candidateRef || (input?.candidateId ? { id: input.candidateId } : null);
  const candidateMatches = requested ? candidateRefs.filter((item) => item.id === requested.id) : candidateRefs;
  if (candidateMatches.length !== 1) {
    if (!requested && candidateMatches.length > 1) {
      fail(code(codes, "candidateAmbiguous", code(codes, "candidateNotFound", "UNIFIED_CONTENT_AUTHORITY_CANDIDATE_AMBIGUOUS")), "Candidate must be selected explicitly", 409);
    }
    fail(code(codes, "candidateNotFound", code(codes, "candidateMismatch", "UNIFIED_CONTENT_AUTHORITY_CANDIDATE_STALE_OR_CROSS_PLATFORM")), "Candidate is not current for this run", 409);
  }
  if (requested?.hash && !sameRef(requested, candidateMatches[0])) {
    fail(code(codes, "candidateMismatch", "UNIFIED_CONTENT_AUTHORITY_CANDIDATE_STALE_OR_CROSS_PLATFORM"), "Candidate is not current for this run", 409);
  }
  const executionProjectRef = { id: snapshot.contentProject.id, hash: snapshot.contentProject.projectHash };
  return resolution({
    schemaVersion: "1.0",
    contract: RESOLUTION_CONTRACT,
    authorityKind: "legacy_snapshot_v1",
    ...scope,
    projectId: snapshot.contentProject.id,
    productAuthorityHash: snapshot.productSnapshotHash,
    executionProjectRef,
    materializedProjectRef: clone(executionProjectRef),
    platformRunRef: clone(platformSnapshot.platformRunRef),
    candidateRef: clone(candidateMatches[0]),
    payload: { snapshot: clone(snapshot), platformSnapshot: clone(platformSnapshot) }
  });
}

export function resolveUnifiedContentAuthority(store, input, { atomicProductEnabled = false, atomicWechatProductEnabled = false, codes = {} } = {}) {
  if (atomicWechatProductEnabled && !atomicProductEnabled) fail("UNIFIED_ATOMIC_WECHAT_PRODUCT_REQUIRES_ATOMIC_PRODUCT");
  const before = atomicProductEnabled ? null : store.unifiedAtomicContentCommits;
  const scope = ownedAccount(store, input, codes);
  const resolved = atomicProductEnabled
    ? (atomicWechatProductEnabled && scope.platform === "wechat" ? atomicWechatAuthority(store, scope, input, codes) : atomicAuthority(store, scope, input, codes))
    : legacyAuthority(store, scope, input, codes);
  if (!atomicProductEnabled && store.unifiedAtomicContentCommits !== before) fail("UNIFIED_CONTENT_AUTHORITY_LEGACY_STORE_MUTATED");
  return resolved;
}
