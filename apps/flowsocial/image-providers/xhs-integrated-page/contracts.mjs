import { stableHash } from "./canonical.mjs";

export const CONTRACTS = Object.freeze({
  promptReviewDecision: "PromptReviewDecision@1.0",
  providerCapabilitySnapshot: "ProviderCapabilitySnapshot@1.0",
  compiledPageGenerationRequest: "CompiledPageGenerationRequest@1.0",
  providerCompilationTrace: "ProviderCompilationTrace@1.0",
  visualAssetRegistrySnapshot: "VisualAssetRegistrySnapshot@1.0",
  visualAssetEvaluationRecord: "VisualAssetEvaluationRecord@1.0"
});

export function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:OBJECT_REQUIRED`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}:FIELDS:${actual.join(",")}`);
  }
}

function assertHash(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || "")) throw new Error(`${label}:HASH_REQUIRED`);
}

function assertHashMatches(value, field, label) {
  assertHash(value[field], label);
  const unhashed = structuredClone(value);
  delete unhashed[field];
  if (value[field] !== stableHash(unhashed)) throw new Error(`${label}:HASH_MISMATCH`);
}

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}:STRING_REQUIRED`);
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) throw new Error(`${label}:STRING_ARRAY_REQUIRED`);
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label}:POSITIVE_INTEGER_REQUIRED`);
}

function validateBlocker(value) {
  assertExactKeys(value, ["code", "scope", "detail", "fallback"], "Blocker");
  assertString(value.code, "Blocker.code");
  assertString(value.scope, "Blocker.scope");
  assertString(value.detail, "Blocker.detail");
  if (value.fallback !== "deterministic_layout") throw new Error("Blocker:FALLBACK_MUST_BE_EXPLICIT");
}

function expectedReviewOverallStatus(value) {
  if (value.blockers.length > 0 || value.visualDirectionSelection.status === "rejected") return "blocked";
  if (value.visualDirectionSelection.status !== "selected") return "direction_pending";
  if (value.promptReview.status !== "approved") return "prompt_review_pending";
  return "awaiting_cost_confirmation";
}

export function validatePromptReviewDecision(value) {
  assertExactKeys(value, ["schemaVersion", "contract", "id", "promptSetRef", "visualDirectionSelection", "promptReview", "costConfirmation", "overallStatus", "blockers", "decisionHash"], CONTRACTS.promptReviewDecision);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACTS.promptReviewDecision) throw new Error("PromptReviewDecision:VERSION");
  assertExactKeys(value.promptSetRef, ["id", "schemaVersion", "hash"], "promptSetRef");
  assertExactKeys(value.visualDirectionSelection, ["status", "candidateIds", "candidateRefs", "candidateSetHash", "selectedDirectionRef", "structuralEvidenceHash", "decidedBy", "decidedAt"], "visualDirectionSelection");
  assertExactKeys(value.promptReview, ["status", "reviewedPromptSetHash", "reviewedBy", "reviewedAt"], "promptReview");
  assertExactKeys(value.costConfirmation, ["status", "currency", "estimatedCost", "confirmedBy", "confirmedAt"], "costConfirmation");
  assertString(value.id, "PromptReviewDecision.id");
  assertString(value.promptSetRef.id, "promptSetRef.id");
  assertString(value.promptSetRef.schemaVersion, "promptSetRef.schemaVersion");
  assertHash(value.promptSetRef.hash, "promptSetRef.hash");
  assertStringArray(value.visualDirectionSelection.candidateIds, "visualDirectionSelection.candidateIds");
  if (value.visualDirectionSelection.candidateIds.length < 2) throw new Error("PromptReviewDecision:DIRECTION_CANDIDATES_INSUFFICIENT");
  if (!Array.isArray(value.visualDirectionSelection.candidateRefs)) throw new Error("PromptReviewDecision:CANDIDATE_REFS_ARRAY_REQUIRED");
  for (const ref of value.visualDirectionSelection.candidateRefs) {
    assertExactKeys(ref, ["id", "hash"], "visualDirectionSelection.candidateRef");
    assertString(ref.id, "visualDirectionSelection.candidateRef.id");
    assertHash(ref.hash, "visualDirectionSelection.candidateRef.hash");
  }
  const candidateRefIds = value.visualDirectionSelection.candidateRefs.map((item) => item.id);
  if (new Set(candidateRefIds).size !== candidateRefIds.length) throw new Error("PromptReviewDecision:DUPLICATE_CANDIDATE_REF");
  if (JSON.stringify([...value.visualDirectionSelection.candidateIds].sort()) !== JSON.stringify([...candidateRefIds].sort())) throw new Error("PromptReviewDecision:CANDIDATE_IDS_REFS_MISMATCH");
  const canonicalCandidateRefs = [...value.visualDirectionSelection.candidateRefs].sort((left, right) => left.id.localeCompare(right.id));
  assertHash(value.visualDirectionSelection.candidateSetHash, "visualDirectionSelection.candidateSetHash");
  if (value.visualDirectionSelection.candidateSetHash !== stableHash(canonicalCandidateRefs)) throw new Error("PromptReviewDecision:CANDIDATE_SET_HASH_MISMATCH");
  if (value.visualDirectionSelection.selectedDirectionRef !== null) {
    assertExactKeys(value.visualDirectionSelection.selectedDirectionRef, ["id", "hash"], "visualDirectionSelection.selectedDirectionRef");
    const frozenRef = value.visualDirectionSelection.candidateRefs.find((item) => item.id === value.visualDirectionSelection.selectedDirectionRef.id);
    if (!frozenRef || frozenRef.hash !== value.visualDirectionSelection.selectedDirectionRef.hash) throw new Error("PromptReviewDecision:SELECTED_DIRECTION_REF_MISMATCH");
  }
  assertHash(value.visualDirectionSelection.structuralEvidenceHash, "visualDirectionSelection.structuralEvidenceHash");
  if (!["pending", "selected", "rejected"].includes(value.visualDirectionSelection.status)) throw new Error("PromptReviewDecision:DIRECTION_STATUS");
  if (!["pending", "approved", "changes_requested"].includes(value.promptReview.status)) throw new Error("PromptReviewDecision:PROMPT_STATUS");
  if (value.costConfirmation.status !== "pending" || value.costConfirmation.confirmedBy !== null || value.costConfirmation.confirmedAt !== null) throw new Error("PromptReviewDecision:COST_MUST_REMAIN_PENDING");
  if (!Array.isArray(value.blockers)) throw new Error("PromptReviewDecision:BLOCKERS_ARRAY_REQUIRED");
  value.blockers.forEach(validateBlocker);
  if (value.visualDirectionSelection.status === "selected" && value.visualDirectionSelection.selectedDirectionRef === null) throw new Error("PromptReviewDecision:SELECTED_DIRECTION_REQUIRED");
  if (value.visualDirectionSelection.status !== "selected" && value.visualDirectionSelection.selectedDirectionRef !== null) throw new Error("PromptReviewDecision:SELECTED_DIRECTION_FORBIDDEN");
  if (value.visualDirectionSelection.status === "selected") {
    assertString(value.visualDirectionSelection.decidedBy, "visualDirectionSelection.decidedBy");
    assertString(value.visualDirectionSelection.decidedAt, "visualDirectionSelection.decidedAt");
  } else if (value.visualDirectionSelection.decidedBy !== null || value.visualDirectionSelection.decidedAt !== null) throw new Error("PromptReviewDecision:DIRECTION_AUDIT_FIELDS_FORBIDDEN");
  if (value.promptReview.status === "approved" && value.promptReview.reviewedPromptSetHash !== value.promptSetRef.hash) throw new Error("PromptReviewDecision:REVIEWED_PROMPT_HASH_MISMATCH");
  if (value.promptReview.status === "pending") {
    if (value.promptReview.reviewedPromptSetHash !== null || value.promptReview.reviewedBy !== null || value.promptReview.reviewedAt !== null) throw new Error("PromptReviewDecision:PROMPT_AUDIT_FIELDS_FORBIDDEN");
  } else {
    assertHash(value.promptReview.reviewedPromptSetHash, "promptReview.reviewedPromptSetHash");
    assertString(value.promptReview.reviewedBy, "promptReview.reviewedBy");
    assertString(value.promptReview.reviewedAt, "promptReview.reviewedAt");
  }
  if (value.overallStatus !== expectedReviewOverallStatus(value)) throw new Error("PromptReviewDecision:OVERALL_STATUS_INCONSISTENT");
  assertHashMatches(value, "decisionHash", "PromptReviewDecision");
  return true;
}

export function validateProviderCapabilitySnapshot(value) {
  assertExactKeys(value, ["schemaVersion", "contract", "id", "source", "status", "productionVerified", "capabilities", "snapshotHash"], CONTRACTS.providerCapabilitySnapshot);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACTS.providerCapabilitySnapshot || value.source !== "offline_fixture" || value.productionVerified !== false) throw new Error("ProviderCapabilitySnapshot:BOUNDARY");
  assertExactKeys(value.capabilities, ["integratedChineseTypography", "referenceImages", "exactDimensions", "supportedDimensions", "maxCandidateCount", "maskEditing", "preserveRegions", "seedControl", "asyncJobs"], "capabilities");
  assertString(value.id, "ProviderCapabilitySnapshot.id");
  if (value.status !== "complete") throw new Error("ProviderCapabilitySnapshot:STATUS");
  for (const key of ["integratedChineseTypography", "referenceImages", "exactDimensions", "maskEditing", "preserveRegions", "seedControl", "asyncJobs"]) {
    if (typeof value.capabilities[key] !== "boolean") throw new Error(`ProviderCapabilitySnapshot:${key}:BOOLEAN_REQUIRED`);
  }
  if (!Array.isArray(value.capabilities.supportedDimensions)) throw new Error("ProviderCapabilitySnapshot:DIMENSIONS_ARRAY_REQUIRED");
  for (const item of value.capabilities.supportedDimensions) assertExactKeys(item, ["width", "height"], "supportedDimension");
  for (const item of value.capabilities.supportedDimensions) {
    assertPositiveInteger(item.width, "supportedDimension.width");
    assertPositiveInteger(item.height, "supportedDimension.height");
  }
  assertPositiveInteger(value.capabilities.maxCandidateCount, "capabilities.maxCandidateCount");
  assertHashMatches(value, "snapshotHash", "ProviderCapabilitySnapshot");
  return true;
}

export function validateCompiledPageGenerationRequest(value) {
  assertExactKeys(value, ["schemaVersion", "contract", "id", "promptSetRef", "pagePromptSpecRef", "reviewDecisionRef", "capabilitySnapshotRef", "registrySnapshotRef", "canvas", "candidateCount", "prompt", "referenceAssets", "requestedFeatures", "expectedTextHash", "execution", "blockers", "compiledHash"], CONTRACTS.compiledPageGenerationRequest);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACTS.compiledPageGenerationRequest) throw new Error("CompiledPageGenerationRequest:VERSION");
  for (const key of ["promptSetRef", "pagePromptSpecRef", "reviewDecisionRef", "capabilitySnapshotRef", "registrySnapshotRef"]) assertExactKeys(value[key], ["id", "hash"], key);
  assertString(value.id, "CompiledPageGenerationRequest.id");
  for (const key of ["promptSetRef", "pagePromptSpecRef", "reviewDecisionRef", "capabilitySnapshotRef", "registrySnapshotRef"]) {
    assertString(value[key].id, `${key}.id`);
    assertHash(value[key].hash, `${key}.hash`);
  }
  assertExactKeys(value.canvas, ["width", "height"], "canvas");
  assertExactKeys(value.prompt, ["verbatimText", "composition", "style", "negativeConstraints"], "compiledPrompt");
  assertExactKeys(value.requestedFeatures, ["mask", "preserveRegions", "seed"], "requestedFeatures");
  assertExactKeys(value.execution, ["status", "provider", "retries", "networkCalls", "providerCalls", "cost", "databaseWrites"], "execution");
  assertPositiveInteger(value.canvas.width, "canvas.width");
  assertPositiveInteger(value.canvas.height, "canvas.height");
  assertPositiveInteger(value.candidateCount, "candidateCount");
  for (const key of ["verbatimText", "composition", "style", "negativeConstraints"]) assertStringArray(value.prompt[key], `prompt.${key}`);
  if (!Array.isArray(value.referenceAssets) || !Array.isArray(value.requestedFeatures.preserveRegions) || !Array.isArray(value.blockers)) throw new Error("CompiledPageGenerationRequest:ARRAY_REQUIRED");
  if (value.execution.provider !== null || value.execution.retries !== 0 || value.execution.networkCalls !== 0 || value.execution.providerCalls !== 0 || value.execution.cost !== 0 || value.execution.databaseWrites !== 0) throw new Error("CompiledPageGenerationRequest:OFFLINE_ONLY");
  value.blockers.forEach(validateBlocker);
  if (value.execution.status !== (value.blockers.length ? "blocked" : "awaiting_cost_confirmation")) throw new Error("CompiledPageGenerationRequest:EXECUTION_STATUS");
  assertHash(value.expectedTextHash, "CompiledPageGenerationRequest.expectedTextHash");
  assertHashMatches(value, "compiledHash", "CompiledPageGenerationRequest.compiledHash");
  return true;
}

export function validateProviderCompilationTrace(value, compiledRequest) {
  assertExactKeys(value, ["schemaVersion", "contract", "id", "compiledRequestRef", "inputContracts", "registrySnapshotRef", "registrySnapshotHash", "capabilitySnapshotRef", "capabilitySnapshotHash", "visualDirectionVerification", "decisions", "blockers", "compiledHash", "counters", "traceHash"], CONTRACTS.providerCompilationTrace);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACTS.providerCompilationTrace) throw new Error("ProviderCompilationTrace:VERSION");
  assertExactKeys(value.compiledRequestRef, ["id", "hash"], "compiledRequestRef");
  assertString(value.id, "ProviderCompilationTrace.id");
  assertString(value.compiledRequestRef.id, "compiledRequestRef.id");
  assertHash(value.compiledRequestRef.hash, "compiledRequestRef.hash");
  if (value.compiledRequestRef.hash !== value.compiledHash) throw new Error("ProviderCompilationTrace:COMPILED_HASH_MISMATCH");
  if (!Array.isArray(value.inputContracts) || !Array.isArray(value.decisions) || !Array.isArray(value.blockers)) throw new Error("ProviderCompilationTrace:ARRAY_REQUIRED");
  for (const item of value.inputContracts) assertExactKeys(item, ["contract", "id", "schemaVersion", "hash"], "inputContractTrace");
  for (const item of value.decisions) assertExactKeys(item, ["field", "sourceRef", "action", "valueHash"], "compilationDecision");
  for (const item of value.inputContracts) {
    assertString(item.contract, "inputContract.contract");
    assertString(item.id, "inputContract.id");
    assertString(item.schemaVersion, "inputContract.schemaVersion");
    assertHash(item.hash, "inputContract.hash");
  }
  for (const item of value.decisions) {
    assertString(item.field, "compilationDecision.field");
    assertString(item.sourceRef, "compilationDecision.sourceRef");
    assertString(item.action, "compilationDecision.action");
    assertHash(item.valueHash, "compilationDecision.valueHash");
  }
  assertExactKeys(value.visualDirectionVerification, ["candidateSetHash", "reviewedCandidateSetHash", "structuralEvidenceHash", "reviewedStructuralEvidenceHash", "selectedDirectionRef", "reviewedSelectedDirectionRef"], "visualDirectionVerification");
  for (const key of ["candidateSetHash", "reviewedCandidateSetHash", "structuralEvidenceHash", "reviewedStructuralEvidenceHash"]) assertHash(value.visualDirectionVerification[key], `visualDirectionVerification.${key}`);
  for (const key of ["selectedDirectionRef", "reviewedSelectedDirectionRef"]) {
    if (value.visualDirectionVerification[key] !== null) {
      assertExactKeys(value.visualDirectionVerification[key], ["id", "hash"], `visualDirectionVerification.${key}`);
      assertString(value.visualDirectionVerification[key].id, `visualDirectionVerification.${key}.id`);
      assertHash(value.visualDirectionVerification[key].hash, `visualDirectionVerification.${key}.hash`);
    }
  }
  assertExactKeys(value.counters, ["networkCalls", "providerCalls", "retries", "cost", "databaseWrites"], "traceCounters");
  if (Object.values(value.counters).some((item) => item !== 0)) throw new Error("ProviderCompilationTrace:NONZERO_COUNTER");
  value.blockers.forEach(validateBlocker);
  assertHash(value.compiledHash, "ProviderCompilationTrace.compiledHash");
  if (compiledRequest === undefined || compiledRequest === null) throw new Error("ProviderCompilationTrace:COMPILED_REQUEST_REQUIRED");
  validateCompiledPageGenerationRequest(compiledRequest);
  if (value.compiledRequestRef.id !== compiledRequest.id || value.compiledRequestRef.hash !== compiledRequest.compiledHash || value.compiledHash !== compiledRequest.compiledHash) throw new Error("ProviderCompilationTrace:REQUEST_REFERENCE_MISMATCH");
  if (value.registrySnapshotRef !== compiledRequest.registrySnapshotRef.id || value.registrySnapshotHash !== compiledRequest.registrySnapshotRef.hash) throw new Error("ProviderCompilationTrace:REGISTRY_REFERENCE_MISMATCH");
  if (value.capabilitySnapshotRef !== compiledRequest.capabilitySnapshotRef.id || value.capabilitySnapshotHash !== compiledRequest.capabilitySnapshotRef.hash) throw new Error("ProviderCompilationTrace:CAPABILITY_REFERENCE_MISMATCH");
  assertHashMatches(value, "traceHash", "ProviderCompilationTrace.traceHash");
  return true;
}

export function validateVisualAssetRegistrySnapshot(value) {
  assertExactKeys(value, ["schemaVersion", "contract", "id", "lifecycle", "sourceLibraries", "entries", "productionQuery", "snapshotHash"], CONTRACTS.visualAssetRegistrySnapshot);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACTS.visualAssetRegistrySnapshot) throw new Error("VisualAssetRegistrySnapshot:VERSION");
  if (JSON.stringify(value.lifecycle) !== JSON.stringify(["quarantine", "normalized", "experimental", "approved", "deprecated"])) throw new Error("VisualAssetRegistrySnapshot:LIFECYCLE");
  assertString(value.id, "VisualAssetRegistrySnapshot.id");
  if (!Array.isArray(value.sourceLibraries) || !Array.isArray(value.entries)) throw new Error("VisualAssetRegistrySnapshot:ARRAY_REQUIRED");
  const entryIds = value.entries.map((entry) => entry.id);
  if (new Set(entryIds).size !== entryIds.length) throw new Error("VisualAssetRegistrySnapshot:DUPLICATE_ENTRY_ID");
  for (const source of value.sourceLibraries) assertExactKeys(source, ["library", "schemaVersion", "sourceRef", "sourceHash"], "registrySourceLibrary");
  for (const entry of value.entries) {
    assertExactKeys(entry, ["id", "assetType", "sourceRef", "sourceHash", "status", "license", "authorization", "applicabilityHash", "failureModesHash", "entryHash"], "registryEntry");
    if (entry.status === "approved") throw new Error("VisualAssetRegistrySnapshot:APPROVED_FORBIDDEN");
    if (!["quarantine", "normalized", "experimental", "deprecated"].includes(entry.status)) throw new Error("VisualAssetRegistrySnapshot:STATUS");
    assertExactKeys(entry.license, ["id", "allowsOfflineCompilation", "allowsGenerationReference"], "registryLicense");
    if (entry.authorization !== null) assertExactKeys(entry.authorization, ["status", "evidenceHash"], "registryAuthorization");
    assertHashMatches(entry, "entryHash", "registryEntry");
  }
  assertExactKeys(value.productionQuery, ["status", "eligibleAssetIds", "blocker"], "productionQuery");
  if (value.productionQuery.eligibleAssetIds.length !== 0) throw new Error("VisualAssetRegistrySnapshot:PRODUCTION_QUERY_MUST_BE_EMPTY");
  assertHashMatches(value, "snapshotHash", "VisualAssetRegistrySnapshot");
  return true;
}

export function validateVisualAssetEvaluationRecord(value) {
  assertExactKeys(value, ["schemaVersion", "contract", "id", "assetId", "assetType", "registrySnapshotRef", "evaluationMode", "decision", "evidenceRefs", "observations", "risks", "failureModes", "remediation", "reviewState", "productionEligible", "recordHash"], CONTRACTS.visualAssetEvaluationRecord);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACTS.visualAssetEvaluationRecord || value.evaluationMode !== "offline_fixture") throw new Error("VisualAssetEvaluationRecord:BOUNDARY");
  if (!["retain_experimental", "reject", "needs_review"].includes(value.decision) || value.reviewState !== "pending_human_review" || value.productionEligible !== false) throw new Error("VisualAssetEvaluationRecord:APPROVAL_FORBIDDEN");
  assertString(value.id, "VisualAssetEvaluationRecord.id");
  assertString(value.assetId, "VisualAssetEvaluationRecord.assetId");
  assertString(value.assetType, "VisualAssetEvaluationRecord.assetType");
  for (const key of ["evidenceRefs", "observations", "risks", "failureModes", "remediation"]) assertStringArray(value[key], `VisualAssetEvaluationRecord.${key}`);
  assertHashMatches(value, "recordHash", "VisualAssetEvaluationRecord");
  return true;
}

export function withComputedHash(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return { ...copy, [field]: stableHash(copy) };
}
