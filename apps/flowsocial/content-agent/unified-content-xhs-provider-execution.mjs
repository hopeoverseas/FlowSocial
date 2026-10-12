import { createHash } from "node:crypto";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { appendUnifiedContentArtifact } from "./unified-content-artifact-store.mjs";
import { resolveUnifiedContentXhsProviderPlanFacts } from "./unified-content-xhs-provider-plan-store.mjs";
import { executeApprovedXhsPageArtifacts } from "./xhs-page-artifact-runtime.mjs";
import { createXhsProviderApproval, createXhsProviderBudget, validateXhsArtifactFactAppendOnly } from "./xhs-page-artifact-facts.mjs";
import { validateXhsDesignRuntimeEvidence } from "./xhs-design-runtime-adapter.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => value == null ? value : structuredClone(value);

function fail(code, message = code, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function exact(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, code, 400);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(code, code, 400, { allowedFields: [...keys].sort() });
  return value;
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, code, 400);
  return value.trim();
}

function exactRef(value, code) {
  exact(value, ["id", "hash"], code);
  if (!HASH.test(value.hash || "")) fail(code, code, 400);
  return { id: text(value.id, code), hash: value.hash };
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function assertRef(actual, expected, code) {
  if (!sameRef(actual, expected)) fail(code, code, 409, { expected, actual: actual || null });
}

function factRef(fact) {
  return { id: fact.id, hash: fact.factHash };
}

function withFactHash(base) {
  return { ...base, factHash: stableHash(base) };
}

function materializedBinding(context) {
  return context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(context.materializedProjectRef) } : {};
}

function bindRuntimeToMaterializedProject(runtime, context) {
  if (context.authorityKind !== "atomic_v2") return runtime;
  const value = clone(runtime);
  value.bytePayloads = (runtime.bytePayloads || []).map((payload) => ({
    ...clone({ ...payload, rawBytes: undefined, normalizedBytes: undefined }),
    rawBytes: Buffer.isBuffer(payload.rawBytes) ? Buffer.from(payload.rawBytes) : payload.rawBytes,
    normalizedBytes: Buffer.isBuffer(payload.normalizedBytes) ? Buffer.from(payload.normalizedBytes) : payload.normalizedBytes
  }));
  value.materializedContentProjectRef = clone(context.materializedProjectRef);
  const attemptRefs = new Map();
  value.attempts = (value.attempts || []).map((fact) => {
    const oldRef = { id: fact.id, hash: fact.attemptHash };
    const base = { ...fact, materializedContentProjectRef: clone(context.materializedProjectRef) };
    delete base.attemptHash;
    const bound = { ...base, attemptHash: stableHash(base) };
    attemptRefs.set(`${oldRef.id}:${oldRef.hash}`, { id: bound.id, hash: bound.attemptHash });
    return bound;
  });
  value.revisions = (value.revisions || []).map((fact) => {
    const sourceAttemptRef = attemptRefs.get(`${fact.sourceAttemptRef.id}:${fact.sourceAttemptRef.hash}`) || fact.sourceAttemptRef;
    const base = { ...fact, materializedContentProjectRef: clone(context.materializedProjectRef), sourceAttemptRef };
    delete base.revisionHash;
    return { ...base, revisionHash: stableHash(base) };
  });
  const revisionRefs = new Map();
  for (let index = 0; index < (runtime.revisions || []).length; index += 1) {
    const previous = runtime.revisions[index];
    const current = value.revisions[index];
    revisionRefs.set(`${previous.id}:${previous.revisionHash}`, { id: current.id, hash: current.revisionHash });
  }
  value.newAttemptRefs = (value.newAttemptRefs || []).map((ref) => attemptRefs.get(`${ref.id}:${ref.hash}`) || ref);
  value.newRevisionRefs = (value.newRevisionRefs || []).map((ref) => revisionRefs.get(`${ref.id}:${ref.hash}`) || ref);
  value.bytePayloads = (value.bytePayloads || []).map((payload) => ({
    ...payload,
    ...(payload.attemptRef ? { attemptRef: attemptRefs.get(`${payload.attemptRef.id}:${payload.attemptRef.hash}`) || payload.attemptRef } : {}),
    ...(payload.revisionRef ? { revisionRef: revisionRefs.get(`${payload.revisionRef.id}:${payload.revisionRef.hash}`) || payload.revisionRef } : {})
  }));
  validateXhsArtifactFactAppendOnly({ attempts: value.attempts || [], revisions: value.revisions || [] });
  return value;
}

function validateFact(fact, contract, code = "UNIFIED_XHS_PROVIDER_EXECUTION_FACT_INVALID") {
  if (fact?.contract !== contract || !HASH.test(fact.factHash || "")) fail(code);
  const base = clone(fact); delete base.factHash;
  if (stableHash(base) !== fact.factHash) fail(code);
  return fact;
}

function ownedContext(store, input, featureFlags) {
  const requestedCandidate = exactRef(input.candidateRef, "UNIFIED_XHS_PROVIDER_EXECUTION_CANDIDATE_REF_INVALID");
  const context = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu", candidateRef: requestedCandidate }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    codes: {
      workspaceRequired: "UNIFIED_XHS_PROVIDER_EXECUTION_WORKSPACE_REQUIRED", companyRequired: "UNIFIED_XHS_PROVIDER_EXECUTION_COMPANY_REQUIRED",
      accountRequired: "UNIFIED_XHS_PROVIDER_EXECUTION_ACCOUNT_REQUIRED", projectRequired: "UNIFIED_XHS_PROVIDER_EXECUTION_PROJECT_REQUIRED",
      companyNotFound: "UNIFIED_XHS_PROVIDER_EXECUTION_COMPANY_NOT_FOUND", workspaceMismatch: "UNIFIED_XHS_PROVIDER_EXECUTION_WORKSPACE_MISMATCH",
      accountOwnershipMismatch: "UNIFIED_XHS_PROVIDER_EXECUTION_ACCOUNT_OWNERSHIP_MISMATCH", projectNotFound: "UNIFIED_XHS_PROVIDER_EXECUTION_PROJECT_NOT_FOUND",
      projectOwnershipMismatch: "UNIFIED_XHS_PROVIDER_EXECUTION_PROJECT_SNAPSHOT_MISMATCH", projectAccountMismatch: "UNIFIED_XHS_PROVIDER_EXECUTION_PROJECT_ACCOUNT_MISMATCH",
      snapshotHashMismatch: "UNIFIED_XHS_PROVIDER_EXECUTION_PROJECT_SNAPSHOT_MISMATCH", candidateNotFound: "UNIFIED_XHS_PROVIDER_EXECUTION_CANDIDATE_STALE_OR_CROSS_SCOPE", candidateMismatch: "UNIFIED_XHS_PROVIDER_EXECUTION_CANDIDATE_REF_MISMATCH"
    }
  });
  assertRef(exactRef(input.platformRunRef, "UNIFIED_XHS_PROVIDER_EXECUTION_RUN_REF_INVALID"), context.platformRunRef, "UNIFIED_XHS_PROVIDER_EXECUTION_RUN_REF_MISMATCH");
  assertRef(requestedCandidate, context.candidateRef, "UNIFIED_XHS_PROVIDER_EXECUTION_CANDIDATE_REF_MISMATCH");
  return { ...context, projectRef: context.executionProjectRef, runRef: context.platformRunRef };
}

function planAuthority(store, context, providerPlanFactRef) {
  const facts = resolveUnifiedContentXhsProviderPlanFacts(store, providerPlanFactRef);
  const planFact = facts.plan;
  assertRef(planFact.contentProjectRef, context.projectRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_PROJECT_MISMATCH");
  if (context.authorityKind === "atomic_v2") assertRef(planFact.materializedContentProjectRef, context.materializedProjectRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_MATERIALIZED_PROJECT_MISMATCH");
  assertRef(planFact.platformRunRef, context.runRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_RUN_MISMATCH");
  assertRef(planFact.candidateRef, context.candidateRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_CANDIDATE_MISMATCH");
  const current = (store.unifiedContentXhsProviderPlanFacts || []).filter((fact) => sameRef(fact.contentProjectRef, context.projectRef)
    && (context.authorityKind !== "atomic_v2" || sameRef(fact.materializedContentProjectRef, context.materializedProjectRef))
    && sameRef(fact.platformRunRef, context.runRef) && sameRef(fact.candidateRef, context.candidateRef)
    && sameRef(fact.designEvidenceRef, planFact.designEvidenceRef)).at(-1);
  if (!current || !sameRef(factRef(current), factRef(planFact))) fail("UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_STALE");
  const designFact = (store.unifiedContentXhsDesignFacts || []).find((fact) => sameRef(factRef(fact), planFact.designFactRef));
  if (!designFact) fail("UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_FACT_REQUIRED");
  validateFact(designFact, "UnifiedXhsDesignArtifactFact@1.0", "UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_FACT_INVALID");
  validateXhsDesignRuntimeEvidence(designFact.evidence);
  assertRef({ id: designFact.evidence.id, hash: designFact.evidence.evidenceHash }, planFact.designEvidenceRef, "UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_EVIDENCE_MISMATCH");
  if (designFact.evidence.outputs?.integratedPageExecutionPlan !== null) fail("UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_EVIDENCE_MUTATED");
  return { facts, planFact, designFact, designEvidence: designFact.evidence };
}

function pageIds(value, known, code) {
  if (!Array.isArray(value) || !value.length || new Set(value).size !== value.length || value.some((id) => typeof id !== "string" || !known.has(id))) fail(code, code, 400);
  return [...value];
}

function approvalCollections(store) {
  store.unifiedContentXhsProviderExecutionApprovalFacts ||= [];
  store.unifiedContentXhsProviderExecutionApprovalIdempotencyFacts ||= [];
  store.unifiedContentXhsProviderExecutionIdempotencyFacts ||= [];
  store.unifiedContentXhsProviderExecutionCheckpointFacts ||= [];
  return { facts: store.unifiedContentXhsProviderExecutionApprovalFacts, idempotency: store.unifiedContentXhsProviderExecutionApprovalIdempotencyFacts, executions: store.unifiedContentXhsProviderExecutionIdempotencyFacts, checkpoints: store.unifiedContentXhsProviderExecutionCheckpointFacts };
}

function appendExecutionCheckpoint(collections, { context, authority, approvalFact, runtime, idempotencyKey, status, orphanStatus, details, recordedAt }) {
  const base = {
    schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionCheckpointFact@1.0",
    id: `xhs-provider-execution-checkpoint:${stableHash({ providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact), idempotencyKey, status }).slice(0, 24)}`,
    workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, contentProjectRef: context.projectRef, ...materializedBinding(context),
    platformRunRef: context.runRef, candidateRef: context.candidateRef, providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact),
    planRef: approvalFact.planRef, status, requiresReconciliation: true, orphanStatus, crossResourceTransaction: false,
    providerAttempts: clone(runtime.attempts), providerCheckpoints: clone(runtime.checkpoints), counters: clone(runtime.counters), details: clone(details), idempotencyKey, recordedAt
  };
  const fact = withFactHash(base);
  const existing = collections.checkpoints.find((item) => item.id === fact.id);
  if (existing && existing.factHash !== fact.factHash) fail("UNIFIED_XHS_PROVIDER_EXECUTION_CHECKPOINT_CONFLICT");
  if (!existing) collections.checkpoints.push(fact);
  return existing || fact;
}

function appendExecutionIdempotency(collections, { idempotencyKey, requestHash, result, recordedAt }) {
  const base = { schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionIdempotencyFact@1.0", id: `xhs-provider-execution-idempotency:${requestHash.slice(0, 24)}`, idempotencyKey, requestHash, result: clone(result), recordedAt };
  collections.executions.push(withFactHash(base));
}

export function validateUnifiedContentXhsProviderExecutionApprovalFact(fact) {
  validateFact(fact, "UnifiedXhsProviderExecutionApprovalFact@1.0", "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_FACT_INVALID");
  if (fact.status !== "approved" || fact.limits?.maxAttemptsPerPage !== 1 || fact.limits?.automaticRetries !== 0
    || !Number.isInteger(fact.limits?.maxProviderCalls) || fact.limits.maxProviderCalls < 1 || !Number.isFinite(fact.limits?.maxCredits) || fact.limits.maxCredits <= 0) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_LIMITS_INVALID");
  if (!sameRef(fact.runtimeApprovalRef, { id: `xhs-provider-approval:${fact.runtimeApproval.approvalHash.slice(0, 20)}`, hash: fact.runtimeApproval.approvalHash })) fail("UNIFIED_XHS_PROVIDER_EXECUTION_RUNTIME_APPROVAL_REF_INVALID");
  if (fact.runtimeBudgetRef?.hash !== fact.runtimeBudget?.budgetHash) fail("UNIFIED_XHS_PROVIDER_EXECUTION_RUNTIME_BUDGET_REF_INVALID");
  return fact;
}

export function appendUnifiedContentXhsProviderExecutionApproval(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  exact(input, ["workspaceId", "companyId", "accountId", "projectId", "productSnapshotHash", "platformRunRef", "candidateRef", "designFactRef", "designEvidenceRef", "providerPlanFactRef", "planRef", "targetPageIds", "maxProviderCalls", "maxCredits", "approvedBy", "approvedAt", "idempotencyKey"], "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_CALLER_AUTHORITY_FORBIDDEN");
  if (featureFlags.unifiedContentXhsProviderExecutionApprovalV1 !== true) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_DISABLED", "Provider execution approval is disabled", 404);
  const context = ownedContext(store, input, featureFlags);
  const authority = planAuthority(store, context, exactRef(input.providerPlanFactRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_FACT_REF_INVALID"));
  assertRef(exactRef(input.designFactRef, "UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_FACT_REF_INVALID"), authority.planFact.designFactRef, "UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_FACT_REF_MISMATCH");
  assertRef(exactRef(input.designEvidenceRef, "UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_EVIDENCE_REF_INVALID"), authority.planFact.designEvidenceRef, "UNIFIED_XHS_PROVIDER_EXECUTION_DESIGN_EVIDENCE_REF_MISMATCH");
  assertRef(exactRef(input.planRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_REF_INVALID"), { id: authority.planFact.plan.id, hash: authority.planFact.plan.planHash }, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_REF_MISMATCH");
  const known = new Set(authority.planFact.plan.pages.map((page) => page.pageId));
  const approvedPageIds = pageIds(input.targetPageIds, known, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_PAGE_IDS_INVALID");
  if (!Number.isInteger(input.maxProviderCalls) || input.maxProviderCalls < 1 || input.maxProviderCalls > approvedPageIds.length) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_CALL_LIMIT_INVALID", "maxProviderCalls exceeds approved pages", 400);
  if (!Number.isFinite(input.maxCredits) || input.maxCredits <= 0 || input.maxCredits > authority.planFact.plan.cost.approvedMaxTotal) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_CREDIT_LIMIT_INVALID", "maxCredits exceeds plan approval", 400);
  const estimated = authority.planFact.plan.pages.filter((page) => approvedPageIds.includes(page.pageId)).reduce((sum, page) => sum + page.estimatedCost, 0);
  if (estimated > input.maxCredits) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_ESTIMATE_EXCEEDS_CREDITS");
  const approvedBy = text(input.approvedBy, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVER_REQUIRED");
  const approvedAt = new Date(text(input.approvedAt, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVED_AT_REQUIRED")).toISOString();
  if (approvedAt !== input.approvedAt) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVED_AT_INVALID", "approvedAt must be canonical UTC", 400);
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_IDEMPOTENCY_KEY_REQUIRED");
  const request = { workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, contentProjectRef: context.projectRef, ...materializedBinding(context), platformRunRef: context.runRef, candidateRef: context.candidateRef, designFactRef: authority.planFact.designFactRef, designEvidenceRef: authority.planFact.designEvidenceRef, providerPlanFactRef: factRef(authority.planFact), planRef: { id: authority.planFact.plan.id, hash: authority.planFact.plan.planHash }, approvedPageIds, maxProviderCalls: input.maxProviderCalls, maxCredits: input.maxCredits, approvedBy, approvedAt };
  const requestHash = stableHash(request);
  const collections = approvalCollections(store);
  const prior = collections.idempotency.find((fact) => fact.idempotencyKey === idempotencyKey);
  if (prior) {
    validateFact(prior, "UnifiedXhsProviderExecutionApprovalIdempotencyFact@1.0");
    if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_IDEMPOTENCY_CONFLICT");
    const fact = collections.facts.find((item) => sameRef(factRef(item), prior.approvalFactRef));
    if (!fact) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_IDEMPOTENCY_FACT_MISSING");
    validateUnifiedContentXhsProviderExecutionApprovalFact(fact);
    return { created: false, approvalFact: clone(fact), nextGate: "ApprovedProviderExecution", claims: { providerCalls: 0, networkCalls: 0, databaseWrites: 0 } };
  }
  const budget = createXhsProviderBudget({ currency: authority.planFact.plan.cost.currency, maxTotal: input.maxCredits, maxAttemptsPerPage: 1, createdBy: approvedBy, createdAt: approvedAt });
  const providerRef = { id: `${authority.planFact.plan.provider.id}:${authority.planFact.plan.provider.model}`, hash: stableHash(authority.planFact.plan.provider) };
  const runtimeApproval = createXhsProviderApproval({ contentProjectRef: context.projectRef, platformRunRef: context.runRef, candidateRef: context.candidateRef, designEvidenceRef: authority.planFact.designEvidenceRef, planRef: request.planRef, providerRef, budgetRef: { id: "xhs-provider-budget", hash: budget.budgetHash }, approvedBy, approvedAt });
  const recordedAt = new Date(now).toISOString();
  const base = { schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionApprovalFact@1.0", id: `xhs-provider-execution-approval:${requestHash.slice(0, 24)}`, workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, contentProjectRef: context.projectRef, ...materializedBinding(context), platformRunRef: context.runRef, candidateRef: context.candidateRef, designFactRef: authority.planFact.designFactRef, designEvidenceRef: authority.planFact.designEvidenceRef, providerPlanFactRef: factRef(authority.planFact), planRef: request.planRef, providerRef, approvedPageIds, limits: { maxProviderCalls: input.maxProviderCalls, maxCredits: input.maxCredits, currency: budget.currency, maxAttemptsPerPage: 1, automaticRetries: 0 }, runtimeBudget: budget, runtimeBudgetRef: { id: "xhs-provider-budget", hash: budget.budgetHash }, runtimeApproval, runtimeApprovalRef: { id: `xhs-provider-approval:${runtimeApproval.approvalHash.slice(0, 20)}`, hash: runtimeApproval.approvalHash }, status: "approved", approvedBy, approvedAt, idempotencyKey, requestHash, recordedAt };
  const approvalFact = withFactHash(base);
  validateUnifiedContentXhsProviderExecutionApprovalFact(approvalFact);
  const idemBase = { schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionApprovalIdempotencyFact@1.0", id: `xhs-provider-execution-approval-idempotency:${stableHash({ idempotencyKey, requestHash }).slice(0, 24)}`, idempotencyKey, requestHash, approvalFactRef: factRef(approvalFact), recordedAt };
  collections.facts.push(approvalFact);
  collections.idempotency.push(withFactHash(idemBase));
  return { created: true, approvalFact: clone(approvalFact), nextGate: "ApprovedProviderExecution", claims: { providerCalls: 0, networkCalls: 0, databaseWrites: 1 } };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function verifiedPayloads(result) {
  const newAttempts = new Set(result.newAttemptRefs.map((ref) => `${ref.id}:${ref.hash}`));
  return result.bytePayloads.map((payload) => {
    const attempt = result.attempts.find((fact) => fact.id === payload.attemptRef.id && fact.attemptHash === payload.attemptRef.hash);
    const revision = result.revisions.find((fact) => fact.sourceAttemptRef.id === payload.attemptRef.id && fact.sourceAttemptRef.hash === payload.attemptRef.hash);
    if (!attempt || !newAttempts.has(`${payload.attemptRef.id}:${payload.attemptRef.hash}`) || !Buffer.isBuffer(payload.rawBytes)) fail("UNIFIED_XHS_PROVIDER_EXECUTION_STAGING_BINDING_INVALID", "Staged bytes must bind a newly created attempt", 409, { attemptRef: payload.attemptRef, attemptFound: Boolean(attempt), newAttempt: newAttempts.has(`${payload.attemptRef.id}:${payload.attemptRef.hash}`), rawBytes: Buffer.isBuffer(payload.rawBytes) });
    if (sha256(payload.rawBytes) !== attempt.rawAsset.sha256) fail("UNIFIED_XHS_PROVIDER_EXECUTION_STAGING_HASH_MISMATCH");
    if (revision && (!Buffer.isBuffer(payload.normalizedBytes) || sha256(payload.normalizedBytes) !== revision.normalizedAsset.sha256)) fail("UNIFIED_XHS_PROVIDER_EXECUTION_STAGING_HASH_MISMATCH");
    if (!revision && payload.normalizedBytes != null && !Buffer.isBuffer(payload.normalizedBytes)) fail("UNIFIED_XHS_PROVIDER_EXECUTION_STAGING_BINDING_INVALID");
    return {
      attemptRef: clone(payload.attemptRef),
      rawBytes: Buffer.from(payload.rawBytes),
      normalizedBytes: revision ? Buffer.from(payload.normalizedBytes) : null,
      rawSha256: attempt.rawAsset.sha256,
      normalizedSha256: revision?.normalizedAsset.sha256 || null,
      rawRelativePath: attempt.rawAsset.relativePath,
      normalizedRelativePath: revision?.normalizedAsset.relativePath || null
    };
  });
}

export async function executeUnifiedContentXhsProviderExecution(store, input, { featureFlags = {}, transport = null, byteSink = null, transportContext = { mode: "unconfigured", networked: false }, now = () => new Date().toISOString() } = {}) {
  exact(input, ["workspaceId", "companyId", "accountId", "projectId", "productSnapshotHash", "platformRunRef", "candidateRef", "providerPlanFactRef", "approvalFactRef", "targetPageIds", "idempotencyKey"], "UNIFIED_XHS_PROVIDER_EXECUTION_CALLER_AUTHORITY_FORBIDDEN");
  if (featureFlags.unifiedContentXhsProviderExecutionV1 !== true) fail("UNIFIED_XHS_PROVIDER_EXECUTION_DISABLED", "Provider execution is disabled", 404);
  if (typeof transport !== "function") fail("UNIFIED_XHS_PROVIDER_EXECUTION_TRANSPORT_NOT_CONFIGURED", "Provider transport is not configured", 503);
  if (typeof byteSink !== "function") fail("UNIFIED_XHS_PROVIDER_EXECUTION_BYTE_SINK_NOT_CONFIGURED", "Artifact staging sink is not configured", 503);
  const context = ownedContext(store, input, featureFlags);
  const authority = planAuthority(store, context, exactRef(input.providerPlanFactRef, "UNIFIED_XHS_PROVIDER_EXECUTION_PLAN_FACT_REF_INVALID"));
  const requestedApprovalRef = exactRef(input.approvalFactRef, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_FACT_REF_INVALID");
  const approvalFact = (store.unifiedContentXhsProviderExecutionApprovalFacts || []).find((fact) => sameRef(factRef(fact), requestedApprovalRef));
  if (!approvalFact) fail("UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_FACT_NOT_FOUND", "Execution approval not found", 404);
  validateUnifiedContentXhsProviderExecutionApprovalFact(approvalFact);
  for (const [actual, expected, code] of [[approvalFact.contentProjectRef, context.projectRef, "PROJECT"], [approvalFact.platformRunRef, context.runRef, "RUN"], [approvalFact.candidateRef, context.candidateRef, "CANDIDATE"], [approvalFact.providerPlanFactRef, factRef(authority.planFact), "PLAN_FACT"]]) assertRef(actual, expected, `UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_${code}_MISMATCH`);
  if (context.authorityKind === "atomic_v2") assertRef(approvalFact.materializedContentProjectRef, context.materializedProjectRef, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_MATERIALIZED_PROJECT_MISMATCH");
  const requestedPages = pageIds(input.targetPageIds, new Set(approvalFact.approvedPageIds), "UNIFIED_XHS_PROVIDER_EXECUTION_PAGE_IDS_NOT_APPROVED");
  const executionRequestHash = stableHash({ workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, contentProjectRef: context.projectRef, ...materializedBinding(context), platformRunRef: context.runRef, candidateRef: context.candidateRef, providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact), targetPageIds: requestedPages, idempotencyKey: input.idempotencyKey });
  const collections = approvalCollections(store);
  const priorExecution = collections.executions.find((fact) => fact.idempotencyKey === input.idempotencyKey);
  if (priorExecution) {
    validateFact(priorExecution, "UnifiedXhsProviderExecutionIdempotencyFact@1.0");
    if (priorExecution.requestHash !== executionRequestHash) fail("UNIFIED_XHS_PROVIDER_EXECUTION_IDEMPOTENCY_CONFLICT");
    return { ...clone(priorExecution.result), created: false, claims: { ...clone(priorExecution.result.claims), providerCalls: 0, networkCalls: 0, retries: 0 } };
  }
  const unreconciled = collections.checkpoints.map((fact) => validateFact(fact, "UnifiedXhsProviderExecutionCheckpointFact@1.0"))
    .find((fact) => fact.requiresReconciliation === true && sameRef(fact.contentProjectRef, context.projectRef) && sameRef(fact.platformRunRef, context.runRef)
      && sameRef(fact.candidateRef, context.candidateRef) && sameRef(fact.providerPlanFactRef, factRef(authority.planFact)));
  if (unreconciled) fail("UNIFIED_XHS_PROVIDER_EXECUTION_UNRECONCILED_PAID_CHECKPOINT", "A paid provider checkpoint requires explicit reconciliation before another call", 409, { checkpointFactRef: factRef(unreconciled), status: unreconciled.status, orphanStatus: unreconciled.orphanStatus });
  const existingAttempts = (store.unifiedContentXhsProviderAttemptFacts || []).filter((fact) => sameRef(fact.contentProjectRef, context.projectRef) && (context.authorityKind !== "atomic_v2" || sameRef(fact.materializedContentProjectRef, context.materializedProjectRef)) && sameRef(fact.platformRunRef, context.runRef) && sameRef(fact.candidateRef, context.candidateRef) && sameRef(fact.designEvidenceRef, approvalFact.designEvidenceRef) && sameRef(fact.planRef, approvalFact.planRef));
  const attemptOffsets = (store.unifiedContentXhsProviderAttemptFacts || [])
    .filter((fact) => sameRef(fact.contentProjectRef, context.projectRef) && sameRef(fact.platformRunRef, context.runRef) && sameRef(fact.candidateRef, context.candidateRef) && sameRef(fact.designEvidenceRef, approvalFact.designEvidenceRef))
    .reduce((map, fact) => { map[fact.pageId] = Math.max(Number(map[fact.pageId] || 0), Number(fact.attempt || 0)); return map; }, {});
  const existingRevisions = (store.unifiedContentXhsPageRevisionFacts || []).filter((fact) => sameRef(fact.contentProjectRef, context.projectRef) && (context.authorityKind !== "atomic_v2" || sameRef(fact.materializedContentProjectRef, context.materializedProjectRef)) && sameRef(fact.platformRunRef, context.runRef) && sameRef(fact.candidateRef, context.candidateRef) && sameRef(fact.designEvidenceRef, approvalFact.designEvidenceRef) && sameRef(fact.planRef, approvalFact.planRef));
  validateXhsArtifactFactAppendOnly({ attempts: existingAttempts, revisions: existingRevisions });
  const sameRequestReplay = existingAttempts.some((fact) => fact.idempotencyKey === input.idempotencyKey);
  if (!sameRequestReplay) {
    const unavailable = requestedPages.filter((pageId) => existingRevisions.some((fact) => fact.pageId === pageId)
      || existingAttempts.some((fact) => fact.pageId === pageId
        && sameRef(fact.approvalRef, approvalFact.runtimeApprovalRef)
        && ["succeeded", "failed", "provider_task_created", "processing"].includes(fact.status)));
    if (unavailable.length) fail("UNIFIED_XHS_PROVIDER_EXECUTION_PAGE_ALREADY_ATTEMPTED", "Approved page was already attempted", 409, { pageIds: unavailable });
  }
  const approvedAttempts = existingAttempts.filter((fact) => sameRef(fact.approvalRef, approvalFact.runtimeApprovalRef)
    && ["succeeded", "failed", "provider_task_created", "processing"].includes(fact.status));
  const remainingCalls = approvalFact.limits.maxProviderCalls - approvedAttempts.length;
  if (!sameRequestReplay && (remainingCalls <= 0 || requestedPages.length > remainingCalls)) fail("UNIFIED_XHS_PROVIDER_EXECUTION_CALL_LIMIT_REACHED");
  const consumedCredits = existingAttempts.reduce((sum, fact) => sum + fact.cost, 0);
  if (consumedCredits >= approvalFact.limits.maxCredits && !sameRequestReplay) fail("UNIFIED_XHS_PROVIDER_EXECUTION_CREDIT_LIMIT_REACHED");
    const runtime = bindRuntimeToMaterializedProject(await executeApprovedXhsPageArtifacts({ designEvidence: authority.designEvidence, providerPlanFact: authority.planFact, approvalFactRef: factRef(approvalFact), contentProjectRef: context.projectRef, platformRunRef: context.runRef, candidateRef: context.candidateRef, budget: approvalFact.runtimeBudget, approval: approvalFact.runtimeApproval, transport, transportContext, existingAttempts, existingRevisions, targetPageIds: requestedPages, attemptOffsets, idempotencyKey: text(input.idempotencyKey, "UNIFIED_XHS_PROVIDER_EXECUTION_IDEMPOTENCY_KEY_REQUIRED"), retryPolicy: { maxAttemptsPerPage: 1, retryableCodes: [], stopOnPageFailure: false }, maxProviderCalls: Math.max(0, remainingCalls), initialActualCost: consumedCredits, now }), context);
  if (runtime.blockers.includes("unknown_paid_task_cost_checkpoint_required")) {
    const checkpointFact = appendExecutionCheckpoint(collections, { context, authority, approvalFact, runtime, idempotencyKey: input.idempotencyKey, status: "unknown_paid_task_cost", orphanStatus: "provider_task_state_unknown", details: { reason: "paid_task_cost_unknown" }, recordedAt: new Date(now()).toISOString() });
    const blocked = { schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionResult@1.0", created: true, providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact), checkpointFactRef: factRef(checkpointFact), runtime: { ...clone(runtime), bytePayloads: [] }, staging: { status: "not_started", receipts: [], orphanStatus: "provider_task_state_unknown", crossResourceTransaction: false }, artifactState: null, claims: { providerCalls: runtime.counters.providerCalls, networkCalls: runtime.counters.networkCalls, retries: 0, automaticRetries: 0, selectionAuthority: false, publicationPerformed: false, crossResourceTransaction: false } };
    appendExecutionIdempotency(collections, { idempotencyKey: input.idempotencyKey, requestHash: executionRequestHash, result: blocked, recordedAt: new Date(now()).toISOString() });
    return blocked;
  }
  const payloads = verifiedPayloads(runtime);
  let staging = { status: "no_payloads", receipts: [], orphanStatus: "none", crossResourceTransaction: false };
  if (payloads.length) {
    try {
      const staged = await byteSink(payloads, { workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, projectId: context.projectId, providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact), idempotencyKey: input.idempotencyKey });
      if (staged?.status !== "staged_and_hash_verified" || !Array.isArray(staged.receipts) || staged.receipts.length !== payloads.length) fail("UNIFIED_XHS_PROVIDER_EXECUTION_STAGING_RECEIPTS_INVALID");
      for (const payload of payloads) {
        const receipt = staged.receipts.find((item) => sameRef(item.attemptRef, payload.attemptRef));
        if (!receipt || receipt.rawSha256 !== payload.rawSha256 || (payload.normalizedSha256 && receipt.normalizedSha256 !== payload.normalizedSha256)) fail("UNIFIED_XHS_PROVIDER_EXECUTION_STAGING_RECEIPTS_INVALID");
      }
      staging = { status: staged.status, receipts: clone(staged.receipts), orphanStatus: "staged_until_metadata_commit", crossResourceTransaction: false };
    } catch (error) {
      const checkpointFact = appendExecutionCheckpoint(collections, { context, authority, approvalFact, runtime, idempotencyKey: input.idempotencyKey, status: "staging_failed_after_provider_call", orphanStatus: "possible_staged_orphan", details: { code: error.code || "STAGING_FAILED", message: error.message }, recordedAt: new Date(now()).toISOString() });
      const blocked = { schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionResult@1.0", created: true, providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact), checkpointFactRef: factRef(checkpointFact), runtime: { ...clone(runtime), bytePayloads: [] }, staging: { status: "failed", receipts: [], orphanStatus: "possible_staged_orphan", crossResourceTransaction: false }, artifactState: null, claims: { providerCalls: runtime.counters.providerCalls, networkCalls: runtime.counters.networkCalls, retries: runtime.counters.retries, automaticRetries: 0, selectionAuthority: false, publicationPerformed: false, crossResourceTransaction: false } };
      appendExecutionIdempotency(collections, { idempotencyKey: input.idempotencyKey, requestHash: executionRequestHash, result: blocked, recordedAt: new Date(now()).toISOString() });
      return blocked;
    }
  }
  const runtimeForStore = { ...clone(runtime), bytePayloads: [], staging: clone(staging) };
  const appended = appendUnifiedContentArtifact(store, { workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId, projectId: context.projectId, productSnapshotHash: context.productAuthorityHash, platform: "xiaohongshu", candidateId: context.candidateRef.id, operation: "xhs_runtime_result", runtimeResult: runtimeForStore, idempotencyKey: `provider-execution:${input.idempotencyKey}` }, { featureFlags });
  const result = { schemaVersion: "1.0", contract: "UnifiedXhsProviderExecutionResult@1.0", created: appended.created, providerPlanFactRef: factRef(authority.planFact), approvalFactRef: factRef(approvalFact), runtime: runtimeForStore, staging: { ...staging, orphanStatus: appended.created ? "metadata_committed_staged_files_retained" : staging.orphanStatus }, artifactState: appended.artifactState, claims: { providerCalls: runtime.counters.providerCalls, networkCalls: runtime.counters.networkCalls, retries: runtime.counters.retries, automaticRetries: 0, selectionAuthority: false, publicationPerformed: false, crossResourceTransaction: false } };
  appendExecutionIdempotency(collections, { idempotencyKey: input.idempotencyKey, requestHash: executionRequestHash, result, recordedAt: new Date(now()).toISOString() });
  return result;
}
