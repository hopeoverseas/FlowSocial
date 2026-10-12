import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { buildIntegratedPageExecutionPlan, createCostConfirmation, validateIntegratedPageExecutionPlan } from "../image-providers/xhs-integrated-page/execution-plan.mjs";
import { createPromptReviewDecision, transitionPromptReviewDecision } from "../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { validatePromptReviewDecision, validateProviderCapabilitySnapshot, validateVisualAssetRegistrySnapshot } from "../image-providers/xhs-integrated-page/contracts.mjs";
import { validateXhsDesignRuntimeEvidence } from "./xhs-design-runtime-adapter.mjs";
import { buildUnifiedContentXhsProviderAuthority, providerPlanningAuthorityFromSnapshot } from "./unified-content-xhs-provider-authority.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => structuredClone(value);
const REQUIRED_FLAGS = Object.freeze([
  "unifiedContentProductionV1",
  "unifiedContentArtifactsV1",
  "unifiedContentXhsProviderAuthorityV1",
  "unifiedContentXhsProviderPlanV1",
  "xhsIntegratedPageDesignSkill",
  "xhsIntegratedPageDirectionReview",
  "xhsIntegratedPageProviderCompiler",
  "xhsVisualAssetRegistry",
  "xhsIntegratedPageSkillExecutionPlan"
]);
const COLLECTIONS = Object.freeze({
  review: "unifiedContentXhsProviderReviewFacts",
  capability: "unifiedContentXhsProviderCapabilityAuthorityFacts",
  registry: "unifiedContentXhsProviderRegistryAuthorityFacts",
  cost: "unifiedContentXhsProviderCostConfirmationFacts",
  plan: "unifiedContentXhsProviderPlanFacts",
  idempotency: "unifiedContentXhsProviderPlanIdempotencyFacts"
});

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

function hash(value, code) {
  if (!HASH.test(value || "")) fail(code, code, 400);
  return value;
}

function timestamp(value, code) {
  const normalized = text(value, code);
  if (Number.isNaN(Date.parse(normalized)) || new Date(normalized).toISOString() !== normalized) fail(code, code, 400);
  return normalized;
}

function exactRef(value, code) {
  exact(value, ["id", "hash"], code);
  return { id: text(value.id, code), hash: hash(value.hash, code) };
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

function ownedContext(store, input, featureFlags) {
  const requestedRunRef = exactRef(input.platformRunRef, "UNIFIED_XHS_PROVIDER_PLAN_RUN_REF_INVALID");
  const requestedCandidateRef = exactRef(input.candidateRef, "UNIFIED_XHS_PROVIDER_PLAN_CANDIDATE_REF_INVALID");
  const context = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu", candidateRef: requestedCandidateRef }, {
    atomicProductEnabled: featureFlags.unifiedContentAtomicProductV1 === true,
    codes: {
      workspaceRequired: "UNIFIED_XHS_PROVIDER_PLAN_WORKSPACE_REQUIRED", companyRequired: "UNIFIED_XHS_PROVIDER_PLAN_COMPANY_REQUIRED",
      accountRequired: "UNIFIED_XHS_PROVIDER_PLAN_ACCOUNT_REQUIRED", projectRequired: "UNIFIED_XHS_PROVIDER_PLAN_PROJECT_REQUIRED",
      companyNotFound: "UNIFIED_XHS_PROVIDER_PLAN_COMPANY_NOT_FOUND", workspaceMismatch: "UNIFIED_XHS_PROVIDER_PLAN_WORKSPACE_MISMATCH",
      accountOwnershipMismatch: "UNIFIED_XHS_PROVIDER_PLAN_ACCOUNT_OWNERSHIP_MISMATCH", accountWorkspaceMismatch: "UNIFIED_XHS_PROVIDER_PLAN_ACCOUNT_WORKSPACE_MISMATCH",
      projectNotFound: "UNIFIED_XHS_PROVIDER_PLAN_PROJECT_NOT_FOUND", projectOwnershipMismatch: "UNIFIED_XHS_PROVIDER_PLAN_PROJECT_OWNERSHIP_MISMATCH",
      projectAccountMismatch: "UNIFIED_XHS_PROVIDER_PLAN_PROJECT_ACCOUNT_MISMATCH", snapshotHashMismatch: "UNIFIED_XHS_PROVIDER_PLAN_SNAPSHOT_HASH_MISMATCH",
      candidateNotFound: "UNIFIED_XHS_PROVIDER_PLAN_CANDIDATE_STALE_OR_CROSS_SCOPE", candidateMismatch: "UNIFIED_XHS_PROVIDER_PLAN_CANDIDATE_REF_MISMATCH"
    }
  });
  assertRef(requestedRunRef, context.platformRunRef, "UNIFIED_XHS_PROVIDER_PLAN_RUN_REF_MISMATCH");
  assertRef(requestedCandidateRef, context.candidateRef, "UNIFIED_XHS_PROVIDER_PLAN_CANDIDATE_REF_MISMATCH");
  return context;
}

function validateDesignFact(fact) {
  if (fact?.contract !== "UnifiedXhsDesignArtifactFact@1.0" || !HASH.test(fact.factHash || "")) fail("UNIFIED_XHS_PROVIDER_PLAN_DESIGN_FACT_INVALID");
  const base = clone(fact); delete base.factHash;
  if (stableHash(base) !== fact.factHash) fail("UNIFIED_XHS_PROVIDER_PLAN_DESIGN_FACT_HASH_MISMATCH");
  validateXhsDesignRuntimeEvidence(fact.evidence);
  return fact;
}

function currentDesignAuthority(store, context, input) {
  const projectRef = context.executionProjectRef;
  const runRef = context.platformRunRef;
  const scoped = (store.unifiedContentXhsDesignFacts || []).filter((fact) => sameRef(fact.contentProjectRef, projectRef)
    && (context.authorityKind !== "atomic_v2" || sameRef(fact.materializedContentProjectRef, context.materializedProjectRef))
    && sameRef(fact.platformRunRef, runRef) && sameRef(fact.candidateRef, context.candidateRef));
  if (!scoped.length) fail("UNIFIED_XHS_PROVIDER_PLAN_DESIGN_FACT_REQUIRED");
  scoped.forEach(validateDesignFact);
  const current = scoped.at(-1);
  const designFactRef = exactRef(input.designFactRef, "UNIFIED_XHS_PROVIDER_PLAN_DESIGN_FACT_REF_INVALID");
  assertRef(designFactRef, factRef(current), "UNIFIED_XHS_PROVIDER_PLAN_DESIGN_FACT_STALE");
  const evidenceRef = { id: current.evidence.id, hash: current.evidence.evidenceHash };
  assertRef(exactRef(input.designEvidenceRef, "UNIFIED_XHS_PROVIDER_PLAN_DESIGN_EVIDENCE_REF_INVALID"), evidenceRef, "UNIFIED_XHS_PROVIDER_PLAN_DESIGN_EVIDENCE_MISMATCH");
  if (current.evidence.outputs?.integratedPageExecutionPlan) fail("UNIFIED_XHS_PROVIDER_PLAN_ALREADY_ATTACHED");
  const invocation = current.evidence.outputs?.skillInvocation;
  const promptSetRef = { id: invocation?.promptSet?.id, hash: invocation?.promptSetHash };
  assertRef(exactRef(input.promptSetRef, "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_SET_REF_INVALID"), promptSetRef, "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_SET_MISMATCH");
  return { designFact: current, designFactRef, evidenceRef, invocation, promptSetRef };
}

function commonBindings(context, design) {
  return {
    workspaceId: context.workspaceId,
    companyId: context.companyId,
    accountId: context.accountId,
    contentProjectRef: clone(context.executionProjectRef),
    ...(context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: clone(context.materializedProjectRef) } : {}),
    platformRunRef: clone(context.platformRunRef),
    candidateRef: clone(context.candidateRef),
    designFactRef: clone(design.designFactRef),
    designEvidenceRef: clone(design.evidenceRef),
    promptSetRef: clone(design.promptSetRef)
  };
}

function withFactHash(base) {
  return { ...base, factHash: stableHash(base) };
}

function validateFact(fact, contract) {
  if (fact?.contract !== contract || !HASH.test(fact.factHash || "")) fail("UNIFIED_XHS_PROVIDER_PLAN_FACT_INVALID", contract);
  const base = clone(fact); delete base.factHash;
  if (stableHash(base) !== fact.factHash) fail("UNIFIED_XHS_PROVIDER_PLAN_FACT_HASH_MISMATCH", contract);
  return fact;
}

function validateFrozenAuthoritySnapshot(snapshot) {
  if (snapshot?.mode !== "isolated_experimental" || snapshot.productionVerified !== false || !HASH.test(snapshot.snapshotHash || "")) fail("UNIFIED_XHS_PROVIDER_PLAN_AUTHORITY_BOUNDARY_INVALID");
  const base = clone(snapshot); delete base.snapshotHash;
  if (stableHash(base) !== snapshot.snapshotHash) fail("UNIFIED_XHS_PROVIDER_PLAN_AUTHORITY_HASH_MISMATCH");
  if (snapshot.providerProfile?.lifecycle !== "experimental" || snapshot.providerProfileRef?.hash !== stableHash(snapshot.providerProfile)) fail("UNIFIED_XHS_PROVIDER_PLAN_PROVIDER_PROFILE_REF_MISMATCH");
  validateProviderCapabilitySnapshot(snapshot.capabilitySnapshot);
  validateVisualAssetRegistrySnapshot(snapshot.registrySnapshot);
  assertRef(snapshot.capabilitySnapshotRef, { id: snapshot.capabilitySnapshot.id, hash: snapshot.capabilitySnapshot.snapshotHash }, "UNIFIED_XHS_PROVIDER_PLAN_CAPABILITY_REF_MISMATCH");
  assertRef(snapshot.registrySnapshotRef, { id: snapshot.registrySnapshot.id, hash: snapshot.registrySnapshot.snapshotHash }, "UNIFIED_XHS_PROVIDER_PLAN_REGISTRY_REF_MISMATCH");
  if (!snapshot.compilerPolicy || snapshot.compilerPolicyRef?.id !== snapshot.compilerPolicy.id || snapshot.compilerPolicyRef?.hash !== snapshot.compilerPolicy.policyHash) fail("UNIFIED_XHS_PROVIDER_PLAN_COMPILER_POLICY_REF_MISMATCH");
  const policyBase = clone(snapshot.compilerPolicy); delete policyBase.policyHash;
  if (stableHash(policyBase) !== snapshot.compilerPolicy.policyHash) fail("UNIFIED_XHS_PROVIDER_PLAN_COMPILER_POLICY_HASH_MISMATCH");
  return true;
}

function validateStoredFacts(facts) {
  validateFact(facts.review, "UnifiedXhsProviderReviewFact@1.0");
  validatePromptReviewDecision(facts.review.reviewDecision);
  validateFact(facts.capability, "UnifiedXhsProviderCapabilityAuthorityFact@1.0");
  validateFrozenAuthoritySnapshot(facts.capability.authoritySnapshot);
  validateProviderCapabilitySnapshot(facts.capability.capabilitySnapshot);
  validateFact(facts.registry, "UnifiedXhsProviderRegistryAuthorityFact@1.0");
  validateVisualAssetRegistrySnapshot(facts.registry.registrySnapshot);
  validateFact(facts.cost, "UnifiedXhsProviderCostConfirmationFact@1.0");
  validateFact(facts.plan, "UnifiedXhsProviderPlanFact@1.0");
  validateIntegratedPageExecutionPlan(facts.plan.plan);
  if (facts.plan.plan.execution.status !== "ready_for_isolated_provider_execution" || facts.plan.providerApprovalEligible !== true || facts.plan.nextGate !== "HumanProviderExecutionApproval") fail("UNIFIED_XHS_PROVIDER_PLAN_STORED_STATUS_INVALID");
  const bindingKeys = ["contentProjectRef", ...(facts.plan.materializedContentProjectRef ? ["materializedContentProjectRef"] : []), "platformRunRef", "candidateRef", "designFactRef", "designEvidenceRef", "promptSetRef"];
  for (const fact of [facts.review, facts.capability, facts.registry, facts.cost]) {
    if (fact.workspaceId !== facts.plan.workspaceId || fact.companyId !== facts.plan.companyId || fact.accountId !== facts.plan.accountId) fail("UNIFIED_XHS_PROVIDER_PLAN_FACT_SCOPE_MISMATCH");
    for (const key of bindingKeys) assertRef(fact[key], facts.plan[key], "UNIFIED_XHS_PROVIDER_PLAN_FACT_BINDING_MISMATCH");
  }
  assertRef(facts.plan.reviewFactRef, factRef(facts.review), "UNIFIED_XHS_PROVIDER_PLAN_REVIEW_FACT_REF_MISMATCH");
  assertRef(facts.plan.capabilityAuthorityFactRef, factRef(facts.capability), "UNIFIED_XHS_PROVIDER_PLAN_CAPABILITY_FACT_REF_MISMATCH");
  assertRef(facts.plan.registryAuthorityFactRef, factRef(facts.registry), "UNIFIED_XHS_PROVIDER_PLAN_REGISTRY_FACT_REF_MISMATCH");
  assertRef(facts.plan.costConfirmationFactRef, factRef(facts.cost), "UNIFIED_XHS_PROVIDER_PLAN_COST_FACT_REF_MISMATCH");
  assertRef(facts.plan.plan.reviewBinding, { id: facts.review.reviewDecision.id, hash: facts.review.reviewDecision.decisionHash }, "UNIFIED_XHS_PROVIDER_PLAN_REVIEW_BINDING_MISMATCH");
  assertRef(facts.plan.plan.capabilitySnapshotRef, { id: facts.capability.capabilitySnapshot.id, hash: facts.capability.capabilitySnapshot.snapshotHash }, "UNIFIED_XHS_PROVIDER_PLAN_CAPABILITY_BINDING_MISMATCH");
  assertRef(facts.plan.plan.registrySnapshotRef, { id: facts.registry.registrySnapshot.id, hash: facts.registry.registrySnapshot.snapshotHash }, "UNIFIED_XHS_PROVIDER_PLAN_REGISTRY_BINDING_MISMATCH");
  assertRef(facts.plan.plan.skillBinding.promptSetRef, facts.plan.promptSetRef, "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_BINDING_MISMATCH");
  if (facts.plan.plan.provider.id !== facts.capability.authoritySnapshot.providerProfile.provider
    || facts.plan.plan.provider.model !== facts.capability.authoritySnapshot.providerProfile.model
    || stableHash(facts.plan.plan.provider.adapter) !== stableHash(facts.capability.authoritySnapshot.providerProfile.adapter)) fail("UNIFIED_XHS_PROVIDER_PLAN_PROVIDER_BINDING_MISMATCH");
  const confirmationBase = clone(facts.cost.costConfirmation); delete confirmationBase.confirmationHash;
  if (stableHash(confirmationBase) !== facts.cost.costConfirmation.confirmationHash
    || facts.plan.plan.cost.confirmationHash !== facts.cost.costConfirmation.confirmationHash
    || facts.plan.plan.cost.currency !== facts.cost.costConfirmation.currency
    || facts.plan.plan.cost.approvedMaxTotal !== facts.cost.costConfirmation.approvedMaxTotal) fail("UNIFIED_XHS_PROVIDER_PLAN_COST_BINDING_MISMATCH");
  if (Object.values(facts.plan.claims).some((value) => value !== 0 && value !== false)
    || facts.plan.states.provider !== "not_called" || facts.plan.states.userSelection !== "not_selected"
    || facts.plan.states.delivery !== "not_delivered" || facts.plan.states.publication !== "not_published") fail("UNIFIED_XHS_PROVIDER_PLAN_DOWNSTREAM_BOUNDARY_INVALID");
  return true;
}

function factsForIdempotency(store, idem) {
  const result = {};
  for (const key of ["review", "capability", "registry", "cost", "plan"]) {
    const fact = (store[COLLECTIONS[key]] || []).find((item) => sameRef(factRef(item), idem.factRefs[key]));
    if (!fact) fail("UNIFIED_XHS_PROVIDER_PLAN_IDEMPOTENCY_FACT_MISSING");
    result[key] = fact;
  }
  validateStoredFacts(result);
  return result;
}

export function resolveUnifiedContentXhsProviderPlanFacts(store, providerPlanFactRef) {
  const requested = exactRef(providerPlanFactRef, "UNIFIED_XHS_PROVIDER_PLAN_FACT_REF_INVALID");
  const plan = (store[COLLECTIONS.plan] || []).find((fact) => sameRef(factRef(fact), requested));
  if (!plan) fail("UNIFIED_XHS_PROVIDER_PLAN_FACT_NOT_FOUND", "Provider plan fact not found", 404);
  const facts = { plan };
  const refs = {
    review: plan.reviewFactRef,
    capability: plan.capabilityAuthorityFactRef,
    registry: plan.registryAuthorityFactRef,
    cost: plan.costConfirmationFactRef
  };
  for (const [key, ref] of Object.entries(refs)) {
    const fact = (store[COLLECTIONS[key]] || []).find((item) => sameRef(factRef(item), ref));
    if (!fact) fail("UNIFIED_XHS_PROVIDER_PLAN_LINKED_FACT_MISSING", key, 409);
    facts[key] = fact;
  }
  validateStoredFacts(facts);
  return clone(facts);
}

function resultProjection(facts, created) {
  return {
    schemaVersion: "1.0",
    contract: "UnifiedXhsProviderPlanResult@1.0",
    created,
    facts: Object.fromEntries(Object.entries(facts).map(([key, fact]) => [key, clone(fact)])),
    plan: clone(facts.plan.plan),
    nextGate: "HumanProviderExecutionApproval",
    providerApprovalEligible: true,
    blockers: [],
    claims: {
      providerCalls: 0, networkCalls: 0, platformCalls: 0, externalCalls: 0,
      databaseWrites: created ? 1 : 0, providerAttemptFacts: 0, pageRevisionFacts: 0,
      visualReviewPerformed: false, selectionAuthority: false, publicationPerformed: false
    }
  };
}

export function appendUnifiedContentXhsProviderPlan(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  exact(input, [
    "workspaceId", "companyId", "accountId", "projectId", "productSnapshotHash", "platformRunRef", "candidateRef",
    "designFactRef", "designEvidenceRef", "promptSetRef", "selectedDirectionId", "promptApproval", "costConfirmation", "idempotencyKey"
  ], "UNIFIED_XHS_PROVIDER_PLAN_CALLER_AUTHORITY_FORBIDDEN");
  const disabledFlags = REQUIRED_FLAGS.filter((name) => featureFlags[name] !== true);
  if (disabledFlags.length) fail("UNIFIED_XHS_PROVIDER_PLAN_DISABLED", "XHS Provider plan is disabled", 404, { disabledFlags });
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_PROVIDER_PLAN_IDEMPOTENCY_KEY_REQUIRED");
  const context = ownedContext(store, input, featureFlags);
  const design = currentDesignAuthority(store, context, input);
  const promptApproval = exact(input.promptApproval, ["reviewedPromptSetHash", "approvedBy", "approvedAt"], "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_APPROVAL_INVALID");
  hash(promptApproval.reviewedPromptSetHash, "UNIFIED_XHS_PROVIDER_PLAN_REVIEWED_PROMPT_HASH_INVALID");
  const approvedBy = text(promptApproval.approvedBy, "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_APPROVER_REQUIRED");
  const approvedAt = timestamp(promptApproval.approvedAt, "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_APPROVED_AT_INVALID");
  if (promptApproval.reviewedPromptSetHash !== design.promptSetRef.hash) fail("UNIFIED_XHS_PROVIDER_PLAN_PROMPT_HASH_MISMATCH");
  const costInput = exact(input.costConfirmation, ["currency", "approvedMaxTotal", "confirmedBy", "confirmedAt"], "UNIFIED_XHS_PROVIDER_PLAN_COST_CONFIRMATION_INVALID");
  const currency = text(costInput.currency, "UNIFIED_XHS_PROVIDER_PLAN_COST_CURRENCY_REQUIRED");
  if (!Number.isFinite(costInput.approvedMaxTotal) || costInput.approvedMaxTotal <= 0) fail("UNIFIED_XHS_PROVIDER_PLAN_COST_MAX_INVALID", "approvedMaxTotal must be positive", 400);
  const confirmedBy = text(costInput.confirmedBy, "UNIFIED_XHS_PROVIDER_PLAN_COST_ACTOR_REQUIRED");
  const confirmedAt = timestamp(costInput.confirmedAt, "UNIFIED_XHS_PROVIDER_PLAN_COST_CONFIRMED_AT_INVALID");
  const selectedDirectionId = text(input.selectedDirectionId, "UNIFIED_XHS_PROVIDER_PLAN_DIRECTION_REQUIRED");
  const normalizedRequest = {
    workspaceId: context.workspaceId, companyId: context.companyId, accountId: context.accountId,
    contentProjectRef: context.executionProjectRef, ...(context.authorityKind === "atomic_v2" ? { materializedContentProjectRef: context.materializedProjectRef } : {}), productSnapshotHash: input.productSnapshotHash,
    platformRunRef: context.platformRunRef, candidateRef: context.candidateRef,
    designFactRef: design.designFactRef, designEvidenceRef: design.evidenceRef, promptSetRef: design.promptSetRef,
    selectedDirectionId,
    promptApproval: { reviewedPromptSetHash: promptApproval.reviewedPromptSetHash, approvedBy, approvedAt },
    costConfirmation: { currency, approvedMaxTotal: costInput.approvedMaxTotal, confirmedBy, confirmedAt }
  };
  const requestHash = stableHash(normalizedRequest);
  const prior = (store[COLLECTIONS.idempotency] || []).find((fact) => fact.idempotencyKey === idempotencyKey);
  if (prior) {
    validateFact(prior, "UnifiedXhsProviderPlanIdempotencyFact@1.0");
    if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_PROVIDER_PLAN_IDEMPOTENCY_CONFLICT");
    return resultProjection(factsForIdempotency(store, prior), false);
  }

  let authoritySnapshot;
  try {
    authoritySnapshot = buildUnifiedContentXhsProviderAuthority({ stylePackId: design.invocation.promptSet.visualStyleSelection.stylePackId });
  } catch (error) {
    if (error.message === "UNIFIED_XHS_PROVIDER_AUTHORITY_CONFIG_UNSUPPORTED") fail("UNIFIED_XHS_PROVIDER_PLAN_PROVIDER_MODEL_UNSUPPORTED", error.message);
    throw error;
  }
  const planningAuthority = providerPlanningAuthorityFromSnapshot(authoritySnapshot);
  const selectedDirection = authoritySnapshot.directionCandidates.find((candidate) => candidate.id === selectedDirectionId);
  if (!selectedDirection) fail("UNIFIED_XHS_PROVIDER_PLAN_DIRECTION_NOT_SERVER_ISSUED", "Selected direction is not in the current server authority snapshot", 409);
  let reviewDecision = createPromptReviewDecision({ id: `provider-review:${requestHash.slice(0, 24)}`, promptSet: design.invocation.promptSet, directionCandidates: authoritySnapshot.directionCandidates });
  reviewDecision = transitionPromptReviewDecision(reviewDecision, { lane: "visualDirectionSelection", action: "select", directionId: selectedDirectionId, actor: approvedBy, at: approvedAt });
  reviewDecision = transitionPromptReviewDecision(reviewDecision, { lane: "promptReview", action: "approve", reviewedPromptSetHash: promptApproval.reviewedPromptSetHash, actor: approvedBy, at: approvedAt });
  validatePromptReviewDecision(reviewDecision);
  const costConfirmation = createCostConfirmation({ status: "confirmed", currency, approvedMaxTotal: costInput.approvedMaxTotal, confirmedBy, confirmedAt });
  const plan = buildIntegratedPageExecutionPlan({
    skillInvocation: design.invocation,
    reviewDecision,
    ...planningAuthority,
    costConfirmation,
    flags: { xhsIntegratedPageSkillExecutionPlan: true }
  });
  validateIntegratedPageExecutionPlan(plan);
  const blockers = plan.pages.flatMap((page) => page.blockers).filter((item, index, items) => items.findIndex((other) => stableHash(other) === stableHash(item)) === index);
  if (plan.execution.status !== "ready_for_isolated_provider_execution") fail("UNIFIED_XHS_PROVIDER_PLAN_BLOCKED", "Provider plan has unresolved blockers", 409, { blockers });

  const recordedAt = timestamp(now, "UNIFIED_XHS_PROVIDER_PLAN_RECORDED_AT_INVALID");
  const binding = commonBindings(context, design);
  const authoritySnapshotRef = { id: authoritySnapshot.id, hash: authoritySnapshot.snapshotHash };
  const reviewBase = { schemaVersion: "1.0", contract: "UnifiedXhsProviderReviewFact@1.0", id: `xhs-provider-review-fact:${requestHash.slice(0, 24)}`, ...binding, reviewDecision, selectedDirectionRef: reviewDecision.visualDirectionSelection.selectedDirectionRef, idempotencyKey, requestHash, recordedAt };
  const reviewFact = withFactHash(reviewBase);
  const capabilityBase = { schemaVersion: "1.0", contract: "UnifiedXhsProviderCapabilityAuthorityFact@1.0", id: `xhs-provider-capability-fact:${requestHash.slice(0, 24)}`, ...binding, authoritySnapshotRef, providerProfileRef: authoritySnapshot.providerProfileRef, authoritySnapshot, capabilitySnapshot: authoritySnapshot.capabilitySnapshot, idempotencyKey, requestHash, recordedAt };
  const capabilityFact = withFactHash(capabilityBase);
  const registryBase = { schemaVersion: "1.0", contract: "UnifiedXhsProviderRegistryAuthorityFact@1.0", id: `xhs-provider-registry-fact:${requestHash.slice(0, 24)}`, ...binding, authoritySnapshotRef, registrySnapshot: authoritySnapshot.registrySnapshot, libraryRefs: authoritySnapshot.libraryRefs, idempotencyKey, requestHash, recordedAt };
  const registryFact = withFactHash(registryBase);
  const costBase = { schemaVersion: "1.0", contract: "UnifiedXhsProviderCostConfirmationFact@1.0", id: `xhs-provider-cost-fact:${requestHash.slice(0, 24)}`, ...binding, providerProfileRef: authoritySnapshot.providerProfileRef, costConfirmation, idempotencyKey, requestHash, recordedAt };
  const costFact = withFactHash(costBase);
  const planBase = {
    schemaVersion: "1.0", contract: "UnifiedXhsProviderPlanFact@1.0", id: `xhs-provider-plan-fact:${requestHash.slice(0, 24)}`, ...binding,
    reviewFactRef: factRef(reviewFact), capabilityAuthorityFactRef: factRef(capabilityFact), registryAuthorityFactRef: factRef(registryFact), costConfirmationFactRef: factRef(costFact),
    authoritySnapshotRef, plan, nextGate: "HumanProviderExecutionApproval", providerApprovalEligible: true, blockers: [],
    states: { provider: "not_called", userSelection: "not_selected", delivery: "not_delivered", publication: "not_published" },
    claims: { providerCalls: 0, networkCalls: 0, platformCalls: 0, externalCalls: 0, providerAttemptFacts: 0, pageRevisionFacts: 0, visualReviewPerformed: false, selectionAuthority: false, publicationPerformed: false },
    idempotencyKey, requestHash, recordedAt
  };
  const planFact = withFactHash(planBase);
  const facts = { review: reviewFact, capability: capabilityFact, registry: registryFact, cost: costFact, plan: planFact };
  validateStoredFacts(facts);
  const idempotencyBase = {
    schemaVersion: "1.0", contract: "UnifiedXhsProviderPlanIdempotencyFact@1.0", id: `xhs-provider-plan-idempotency:${stableHash({ idempotencyKey, requestHash }).slice(0, 24)}`,
    idempotencyKey, requestHash, ...binding,
    factRefs: Object.fromEntries(Object.entries(facts).map(([key, fact]) => [key, factRef(fact)])), recordedAt
  };
  const idempotencyFact = withFactHash(idempotencyBase);
  for (const [key, fact] of Object.entries(facts)) {
    const existing = (store[COLLECTIONS[key]] || []).find((item) => item.id === fact.id);
    if (existing && existing.factHash !== fact.factHash) fail("UNIFIED_XHS_PROVIDER_PLAN_IMMUTABLE_FACT_CONFLICT", key, 409);
  }
  for (const [key, fact] of Object.entries(facts)) {
    store[COLLECTIONS[key]] ||= [];
    if (!store[COLLECTIONS[key]].some((item) => item.id === fact.id)) store[COLLECTIONS[key]].push(fact);
  }
  store[COLLECTIONS.idempotency] ||= [];
  store[COLLECTIONS.idempotency].push(idempotencyFact);
  return resultProjection(facts, true);
}
