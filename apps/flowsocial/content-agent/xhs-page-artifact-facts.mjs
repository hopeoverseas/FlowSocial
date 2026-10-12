import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";

export const XHS_PROVIDER_BUDGET = "XhsProviderExecutionBudget@1.0";
export const XHS_PROVIDER_APPROVAL = "XhsProviderExecutionApproval@1.0";
export const XHS_PROVIDER_ATTEMPT_FACT = "XhsProviderAttemptFact@1.0";
export const XHS_PAGE_REVISION_FACT = "XhsPageArtifactRevisionFact@1.0";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => structuredClone(value);

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function hash(value, code) {
  if (!HASH.test(value || "")) fail(code);
}

function validateHash(value, field, code) {
  hash(value?.[field], `${code}_HASH_REQUIRED`);
  const base = clone(value);
  delete base[field];
  if (stableHash(base) !== value[field]) fail(`${code}_HASH_MISMATCH`);
}

function validateRef(value, code) {
  object(value, `${code}_REQUIRED`);
  if (typeof value.id !== "string" || !value.id) fail(`${code}_ID_REQUIRED`);
  hash(value.hash, `${code}_HASH_REQUIRED`);
}

export function sameXhsArtifactRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

export function createXhsProviderBudget({ currency, maxTotal, maxAttemptsPerPage, createdBy, createdAt }) {
  if (typeof currency !== "string" || !currency || !Number.isFinite(maxTotal) || maxTotal <= 0) fail("XHS_PROVIDER_BUDGET_LIMIT_INVALID");
  if (!Number.isInteger(maxAttemptsPerPage) || maxAttemptsPerPage < 1) fail("XHS_PROVIDER_BUDGET_ATTEMPTS_INVALID");
  if (!createdBy || !createdAt) fail("XHS_PROVIDER_BUDGET_AUDIT_REQUIRED");
  const base = { schemaVersion: "1.0", contract: XHS_PROVIDER_BUDGET, currency, maxTotal, maxAttemptsPerPage, createdBy, createdAt };
  return { ...base, budgetHash: stableHash(base) };
}

export function validateXhsProviderBudget(value) {
  object(value, "XHS_PROVIDER_BUDGET_REQUIRED");
  if (value.schemaVersion !== "1.0" || value.contract !== XHS_PROVIDER_BUDGET) fail("XHS_PROVIDER_BUDGET_IDENTITY_INVALID");
  if (!value.currency || !Number.isFinite(value.maxTotal) || value.maxTotal <= 0 || !Number.isInteger(value.maxAttemptsPerPage) || value.maxAttemptsPerPage < 1) fail("XHS_PROVIDER_BUDGET_LIMIT_INVALID");
  if (!value.createdBy || !value.createdAt) fail("XHS_PROVIDER_BUDGET_AUDIT_REQUIRED");
  validateHash(value, "budgetHash", "XHS_PROVIDER_BUDGET");
  return true;
}

export function createXhsProviderApproval({ contentProjectRef, platformRunRef, candidateRef, designEvidenceRef, planRef, providerRef, budgetRef, approvedBy, approvedAt }) {
  for (const [name, ref] of Object.entries({ contentProjectRef, platformRunRef, candidateRef, designEvidenceRef, planRef, providerRef, budgetRef })) validateRef(ref, `XHS_PROVIDER_APPROVAL_${name.toUpperCase()}`);
  if (!approvedBy || !approvedAt) fail("XHS_PROVIDER_APPROVAL_AUDIT_REQUIRED");
  const base = {
    schemaVersion: "1.0", contract: XHS_PROVIDER_APPROVAL, status: "approved",
    contentProjectRef: clone(contentProjectRef), platformRunRef: clone(platformRunRef), candidateRef: clone(candidateRef),
    designEvidenceRef: clone(designEvidenceRef), planRef: clone(planRef), providerRef: clone(providerRef), budgetRef: clone(budgetRef),
    approvedBy, approvedAt
  };
  return { ...base, approvalHash: stableHash(base) };
}

export function validateXhsProviderApproval(value) {
  object(value, "XHS_PROVIDER_APPROVAL_REQUIRED");
  if (value.schemaVersion !== "1.0" || value.contract !== XHS_PROVIDER_APPROVAL || value.status !== "approved") fail("XHS_PROVIDER_APPROVAL_IDENTITY_INVALID");
  for (const [name, ref] of Object.entries({ contentProjectRef: value.contentProjectRef, platformRunRef: value.platformRunRef, candidateRef: value.candidateRef, designEvidenceRef: value.designEvidenceRef, planRef: value.planRef, providerRef: value.providerRef, budgetRef: value.budgetRef })) validateRef(ref, `XHS_PROVIDER_APPROVAL_${name.toUpperCase()}`);
  if (!value.approvedBy || !value.approvedAt) fail("XHS_PROVIDER_APPROVAL_AUDIT_REQUIRED");
  validateHash(value, "approvalHash", "XHS_PROVIDER_APPROVAL");
  return true;
}

function validateScope(value, prefix) {
  validateRef(value.contentProjectRef, `${prefix}_PROJECT_REF`);
  validateRef(value.platformRunRef, `${prefix}_RUN_REF`);
  validateRef(value.candidateRef, `${prefix}_CANDIDATE_REF`);
  validateRef(value.designEvidenceRef, `${prefix}_DESIGN_REF`);
  validateRef(value.planRef, `${prefix}_PLAN_REF`);
  validateRef(value.pageRef, `${prefix}_PAGE_REF`);
  validateRef(value.approvalRef, `${prefix}_APPROVAL_REF`);
  validateRef(value.providerRef, `${prefix}_PROVIDER_REF`);
  validateRef(value.budgetRef, `${prefix}_BUDGET_REF`);
}

export function createXhsProviderAttemptFact(input) {
  const base = clone(input);
  base.schemaVersion = "1.0";
  base.contract = XHS_PROVIDER_ATTEMPT_FACT;
  const fact = { ...base, attemptHash: stableHash(base) };
  validateXhsProviderAttemptFact(fact);
  return fact;
}

export function validateXhsProviderAttemptFact(value) {
  object(value, "XHS_PROVIDER_ATTEMPT_FACT_REQUIRED");
  if (value.schemaVersion !== "1.0" || value.contract !== XHS_PROVIDER_ATTEMPT_FACT || !value.id || !value.pageId || !Number.isInteger(value.attempt) || value.attempt < 1) fail("XHS_PROVIDER_ATTEMPT_FACT_IDENTITY_INVALID");
  if (!value.idempotencyKey) fail("XHS_PROVIDER_ATTEMPT_IDEMPOTENCY_KEY_REQUIRED");
  hash(value.executionRequestHash, "XHS_PROVIDER_ATTEMPT_EXECUTION_REQUEST_HASH_REQUIRED");
  if (!["succeeded", "failed", "budget_exceeded"].includes(value.status)) fail("XHS_PROVIDER_ATTEMPT_FACT_STATUS_INVALID");
  validateScope(value, "XHS_PROVIDER_ATTEMPT_FACT");
  hash(value.requestHash, "XHS_PROVIDER_ATTEMPT_REQUEST_HASH_REQUIRED");
  if (!value.provider || !value.model || !Number.isFinite(value.cost) || value.cost < 0) fail("XHS_PROVIDER_ATTEMPT_PROVIDER_EVIDENCE_INVALID");
  if (value.transport?.kind !== "injected" || typeof value.transport.networked !== "boolean" || value.transport.context?.networked !== value.transport.networked) fail("XHS_PROVIDER_ATTEMPT_TRANSPORT_NETWORK_INVALID");
  if (value.status === "succeeded") {
    if (!value.taskId || !value.rawAsset || !value.normalization) fail("XHS_PROVIDER_ATTEMPT_SUCCESS_EVIDENCE_REQUIRED");
    hash(value.rawAsset.sha256, "XHS_PROVIDER_ATTEMPT_RAW_SHA_REQUIRED");
    if (!Number.isInteger(value.rawAsset.bytes) || value.rawAsset.bytes < 1 || !value.rawAsset.dimensions?.width || !value.rawAsset.dimensions?.height) fail("XHS_PROVIDER_ATTEMPT_RAW_ASSET_INVALID");
    hash(value.normalization.recordHash, "XHS_PROVIDER_ATTEMPT_NORMALIZATION_HASH_REQUIRED");
    if (value.normalization.status === "succeeded") {
      hash(value.normalization.outputAsset?.sha256, "XHS_PROVIDER_ATTEMPT_NORMALIZED_SHA_REQUIRED");
      if (!Number.isInteger(value.normalization.outputAsset?.bytes) || value.normalization.outputAsset.bytes < 1) fail("XHS_PROVIDER_ATTEMPT_NORMALIZED_BYTES_INVALID");
      if (value.normalization.outputAsset?.dimensions?.width !== 1080 || value.normalization.outputAsset?.dimensions?.height !== 1440) fail("XHS_PROVIDER_ATTEMPT_NORMALIZED_DIMENSIONS_INVALID");
    }
  }
  if (value.status !== "succeeded" && !value.error?.code) fail("XHS_PROVIDER_ATTEMPT_FAILURE_EVIDENCE_REQUIRED");
  if (value.selectionAuthority !== false || value.finalBundleAuthority !== false || value.publicationPerformed !== false) fail("XHS_PROVIDER_ATTEMPT_AUTHORITY_INVALID");
  validateHash(value, "attemptHash", "XHS_PROVIDER_ATTEMPT_FACT");
  return true;
}

export function createXhsPageRevisionFact(input) {
  const base = { ...clone(input), schemaVersion: "1.0", contract: XHS_PAGE_REVISION_FACT };
  const fact = { ...base, revisionHash: stableHash(base) };
  validateXhsPageRevisionFact(fact);
  return fact;
}

export function validateXhsPageRevisionFact(value) {
  object(value, "XHS_PAGE_REVISION_FACT_REQUIRED");
  if (value.schemaVersion !== "1.0" || value.contract !== XHS_PAGE_REVISION_FACT || !value.id || !value.pageId || !Number.isInteger(value.revision) || value.revision < 1) fail("XHS_PAGE_REVISION_FACT_IDENTITY_INVALID");
  if (!value.idempotencyKey) fail("XHS_PAGE_REVISION_IDEMPOTENCY_KEY_REQUIRED");
  hash(value.executionRequestHash, "XHS_PAGE_REVISION_EXECUTION_REQUEST_HASH_REQUIRED");
  validateScope(value, "XHS_PAGE_REVISION_FACT");
  validateRef(value.sourceAttemptRef, "XHS_PAGE_REVISION_ATTEMPT_REF");
  validateRef(value.normalizationRef, "XHS_PAGE_REVISION_NORMALIZATION_REF");
  hash(value.rawAsset?.sha256, "XHS_PAGE_REVISION_RAW_SHA_REQUIRED");
  hash(value.normalizedAsset?.sha256, "XHS_PAGE_REVISION_NORMALIZED_SHA_REQUIRED");
  if (!Number.isInteger(value.rawAsset?.bytes) || value.rawAsset.bytes < 1 || !Number.isInteger(value.normalizedAsset?.bytes) || value.normalizedAsset.bytes < 1) fail("XHS_PAGE_REVISION_ASSET_BYTES_INVALID");
  if (value.normalizedAsset?.dimensions?.width !== 1080 || value.normalizedAsset?.dimensions?.height !== 1440) fail("XHS_PAGE_REVISION_DIMENSIONS_INVALID");
  if (value.status !== "artifact_review_required" || value.reviewable !== true || value.selectable !== false || value.finalBundleAuthority !== false || value.publicationPerformed !== false) fail("XHS_PAGE_REVISION_STATE_BOUNDARY_INVALID");
  validateHash(value, "revisionHash", "XHS_PAGE_REVISION_FACT");
  return true;
}

export function validateXhsArtifactFactAppendOnly({ attempts = [], revisions = [] }) {
  const ids = new Set();
  const attemptsByRef = new Map();
  const attemptNumbers = new Map();
  for (const fact of attempts) {
    validateXhsProviderAttemptFact(fact);
    if (ids.has(fact.id)) fail("XHS_ARTIFACT_FACT_DUPLICATE_ID");
    ids.add(fact.id);
    const key = `${fact.contentProjectRef.hash}:${fact.platformRunRef.hash}:${fact.candidateRef.hash}:${fact.pageId}`;
    const previous = attemptNumbers.get(key) || 0;
    if (fact.attempt <= previous) fail("XHS_PROVIDER_ATTEMPT_NON_MONOTONIC");
    attemptNumbers.set(key, fact.attempt);
    attemptsByRef.set(`${fact.id}:${fact.attemptHash}`, fact);
  }
  const revisionNumbers = new Map();
  for (const fact of revisions) {
    validateXhsPageRevisionFact(fact);
    if (ids.has(fact.id)) fail("XHS_ARTIFACT_FACT_DUPLICATE_ID");
    ids.add(fact.id);
    const key = `${fact.contentProjectRef.hash}:${fact.platformRunRef.hash}:${fact.candidateRef.hash}:${fact.pageId}`;
    const previous = revisionNumbers.get(key) || 0;
    if (fact.revision <= previous) fail("XHS_PAGE_REVISION_NON_MONOTONIC");
    revisionNumbers.set(key, fact.revision);
    const attempt = attemptsByRef.get(`${fact.sourceAttemptRef.id}:${fact.sourceAttemptRef.hash}`);
    if (!attempt || attempt.status !== "succeeded") fail("XHS_PAGE_REVISION_ATTEMPT_BINDING_INVALID");
    if (fact.idempotencyKey !== attempt.idempotencyKey || fact.executionRequestHash !== attempt.executionRequestHash) fail("XHS_PAGE_REVISION_IDEMPOTENCY_BINDING_MISMATCH");
    if (!sameXhsArtifactRef(fact.pageRef, attempt.pageRef) || !sameXhsArtifactRef(fact.candidateRef, attempt.candidateRef)) fail("XHS_PAGE_REVISION_SCOPE_MISMATCH");
    if (stableHash(fact.rawAsset) !== stableHash(attempt.rawAsset) || stableHash(fact.normalizedAsset) !== stableHash(attempt.normalization.outputAsset) || fact.normalizationRef.hash !== attempt.normalization.recordHash) fail("XHS_PAGE_REVISION_ASSET_BINDING_MISMATCH");
  }
  return true;
}
