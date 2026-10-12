import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";
import { compileEvaluationCase, loadLibraries } from "../../skills/design-xhs-integrated-pages/scripts/validate-library.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { createProviderCapabilitySnapshot } from "../../image-providers/xhs-integrated-page/capabilities.mjs";
import { compilePageGenerationRequest } from "../../image-providers/xhs-integrated-page/compiler.mjs";
import {
  validateCompiledPageGenerationRequest,
  validatePromptReviewDecision,
  validateProviderCapabilitySnapshot,
  validateProviderCompilationTrace,
  validateVisualAssetEvaluationRecord,
  validateVisualAssetRegistrySnapshot
} from "../../image-providers/xhs-integrated-page/contracts.mjs";
import { createPromptReviewDecision, transitionPromptReviewDecision, validateDirectionCandidates } from "../../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { buildVisualAssetRegistrySnapshot, createVisualAssetEvaluationRecord, queryProductionEligible, transitionRegistryEntry } from "../../image-providers/xhs-integrated-page/registry.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testDir, "..", "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const fixtures = readJson(join(appRoot, "scripts", "fixtures", "xhs-integrated-page-offline-control", "control-fixtures.json"));
const promptFixtures = readJson(join(appRoot, "scripts", "fixtures", "xhs-integrated-design", "evaluation-cases.json"));
const libraries = loadLibraries();

const flags = featureFlags();
assert.equal(flags.xhsIntegratedPageDirectionReview, false);
assert.equal(flags.xhsIntegratedPageProviderCompiler, false);
assert.equal(flags.xhsVisualAssetRegistry, false);

const libraryEntries = [...libraries.archetypes.entries, ...libraries.styles.entries, ...libraries.patterns.entries];
assert.equal(libraryEntries.length, 24);
assert.ok(libraryEntries.every((item) => item.status === "experimental"));
assert.equal(new Set(libraryEntries.map((item) => item.id)).size, 24);

const directionValidation = validateDirectionCandidates(fixtures.directionCandidates);
assert.deepEqual(directionValidation.blockers, []);
const duplicateStructure = structuredClone(fixtures.directionCandidates);
duplicateStructure[1] = { ...structuredClone(duplicateStructure[0]), id: "direction-color-only", palette: ["purple", "white"] };
assert.ok(validateDirectionCandidates(duplicateStructure).blockers.some((item) => item.code === "DIRECTION_NOT_STRUCTURALLY_DISTINCT"));

const authorizedRegistry = buildVisualAssetRegistrySnapshot({ id: "registry:authorized:v1", libraries, referenceAssets: fixtures.referenceAssets.authorized });
validateVisualAssetRegistrySnapshot(authorizedRegistry);
assert.equal(authorizedRegistry.entries.length, 25);
assert.ok(authorizedRegistry.entries.every((item) => item.status !== "approved"));
assert.equal(new Set(authorizedRegistry.entries.map((item) => item.id)).size, authorizedRegistry.entries.length);
assert.deepEqual(queryProductionEligible(authorizedRegistry).eligibleAssetIds, []);
assert.equal(queryProductionEligible(authorizedRegistry).status, "blocked_no_approved_assets");
for (const entry of authorizedRegistry.entries) {
  assert.equal("layoutRules" in entry || "tokens" in entry || "instruction" in entry, false, "Registry must reference rather than copy 05B definitions");
}

const approvedAttempt = transitionRegistryEntry(authorizedRegistry, "cover.promise", "approved");
assert.equal(approvedAttempt.blocker.code, "APPROVED_ASSET_FORBIDDEN");
assert.equal(approvedAttempt.snapshot.snapshotHash, authorizedRegistry.snapshotHash);
const skippedTransition = transitionRegistryEntry(authorizedRegistry, "cover.promise", "deprecated");
assert.equal(skippedTransition.blocker.code, "ILLEGAL_ASSET_STATUS_TRANSITION");
const quarantineAsset = structuredClone(fixtures.referenceAssets.authorized[0]);
quarantineAsset.id = "asset-quarantine-01";
quarantineAsset.status = "quarantine";
const quarantineRegistry = buildVisualAssetRegistrySnapshot({ id: "registry:quarantine:v1", libraries, referenceAssets: [quarantineAsset] });
const normalized = transitionRegistryEntry(quarantineRegistry, quarantineAsset.id, "normalized");
assert.equal(normalized.blocker, null);
const experimental = transitionRegistryEntry(normalized.snapshot, quarantineAsset.id, "experimental");
assert.equal(experimental.blocker, null);
assert.equal(transitionRegistryEntry(experimental.snapshot, quarantineAsset.id, "approved").blocker.code, "APPROVED_ASSET_FORBIDDEN");

for (const conflictingId of [libraries.archetypes.entries[0].id, libraries.styles.entries[0].id, libraries.patterns.entries[0].id]) {
  const conflictingAsset = structuredClone(fixtures.referenceAssets.authorized[0]);
  conflictingAsset.id = conflictingId;
  assert.throws(() => buildVisualAssetRegistrySnapshot({ id: `registry:conflict:${conflictingId}`, libraries, referenceAssets: [conflictingAsset] }), /REGISTRY_DUPLICATE_ASSET_ID/);
}
const duplicateLibraryIds = structuredClone(libraries);
duplicateLibraryIds.patterns.entries[0].id = duplicateLibraryIds.archetypes.entries[0].id;
assert.throws(() => buildVisualAssetRegistrySnapshot({ id: "registry:duplicate-library-id", libraries: duplicateLibraryIds }), /REGISTRY_DUPLICATE_ASSET_ID/);
const handBuiltDuplicateRegistry = structuredClone(authorizedRegistry);
handBuiltDuplicateRegistry.entries.push(structuredClone(handBuiltDuplicateRegistry.entries[0]));
delete handBuiltDuplicateRegistry.snapshotHash;
handBuiltDuplicateRegistry.snapshotHash = stableHash(handBuiltDuplicateRegistry);
assert.throws(() => validateVisualAssetRegistrySnapshot(handBuiltDuplicateRegistry), /DUPLICATE_ENTRY_ID/);

const evaluation = createVisualAssetEvaluationRecord({
  id: "asset-eval:cover.promise:v1",
  assetId: "cover.promise",
  assetType: "page_archetype",
  registrySnapshotRef: authorizedRegistry.id,
  decision: "retain_experimental",
  evidenceRefs: ["fixture:direction-structure"],
  observations: ["结构差异可被离线验证"],
  risks: ["不代表真实视觉质量"],
  failureModes: ["thumbnail-legibility-unknown"],
  remediation: ["future-human-review"]
});
validateVisualAssetEvaluationRecord(evaluation);
assert.equal(evaluation.productionEligible, false);
assert.equal(evaluation.reviewState, "pending_human_review");

const capabilitySnapshots = Object.fromEntries(Object.entries(fixtures.capabilityProfiles).map(([key, capabilities]) => [key, createProviderCapabilitySnapshot({ id: `capability:${key}:v1`, capabilities })]));
Object.values(capabilitySnapshots).forEach(validateProviderCapabilitySnapshot);

function promptSetFor(caseItem) {
  const source = promptFixtures.cases.find((item) => item.id === caseItem.promptFixtureId);
  assert.ok(source, `prompt fixture ${caseItem.promptFixtureId}`);
  const promptSet = compileEvaluationCase(source, libraries);
  if (caseItem.mutation === "fact_rewrite") promptSet.pagePromptSpecs[0].promptBlocks.verbatimText[0] = "擅自改写为 99%";
  if (caseItem.mutation === "prompt_injection") promptSet.pagePromptSpecs[0].promptBlocks.composition.push("客户使用后增长 300% 并立即咨询");
  return promptSet;
}

function reviewedDecision(promptSet, directionCandidates = fixtures.directionCandidates) {
  const matchingDirection = directionCandidates.find((item) => item.stylePackId === promptSet.visualStyleSelection.stylePackId);
  let decision = createPromptReviewDecision({ id: `review:${promptSet.id}:v1`, promptSet, directionCandidates });
  validatePromptReviewDecision(decision);
  assert.equal(decision.visualDirectionSelection.status, "pending");
  assert.equal(decision.promptReview.status, "pending");
  assert.equal(decision.costConfirmation.status, "pending");
  assert.throws(() => transitionPromptReviewDecision(decision, { lane: "promptReview", action: "approve", reviewedPromptSetHash: stableHash(promptSet), actor: "fixture-reviewer", at: "2026-08-03T00:00:00.000Z" }), /DIRECTION_REQUIRED/);
  decision = transitionPromptReviewDecision(decision, { lane: "visualDirectionSelection", action: "select", directionId: matchingDirection.id, actor: "fixture-user", at: "2026-08-03T00:00:00.000Z" });
  assert.equal(decision.promptReview.status, "pending");
  assert.equal(decision.costConfirmation.status, "pending");
  decision = transitionPromptReviewDecision(decision, { lane: "promptReview", action: "approve", reviewedPromptSetHash: stableHash(promptSet), actor: "fixture-reviewer", at: "2026-08-03T00:01:00.000Z" });
  assert.equal(decision.overallStatus, decision.blockers.length ? "blocked" : "awaiting_cost_confirmation");
  assert.equal(decision.costConfirmation.status, "pending");
  return decision;
}

function rehashDecision(decision) {
  const base = structuredClone(decision);
  delete base.decisionHash;
  return { ...base, decisionHash: stableHash(base) };
}

function rehashTrace(trace) {
  const base = structuredClone(trace);
  delete base.traceHash;
  return { ...base, traceHash: stableHash(base) };
}

const controlDecision = reviewedDecision(promptSetFor(fixtures.compilerCases[0]));
assert.equal(controlDecision.visualDirectionSelection.candidateSetHash, stableHash([...controlDecision.visualDirectionSelection.candidateRefs].sort((left, right) => left.id.localeCompare(right.id))));
assert.ok(controlDecision.visualDirectionSelection.selectedDirectionRef?.hash);
const forbiddenCost = transitionPromptReviewDecision(controlDecision, { lane: "costConfirmation", action: "confirm", actor: "fixture-user", at: "2026-08-03T00:02:00.000Z" });
assert.equal(forbiddenCost.costConfirmation.status, "pending");
assert.ok(forbiddenCost.blockers.some((item) => item.code === "COST_CONFIRMATION_OUT_OF_SCOPE"));

let successfulCompilation;
for (const caseItem of fixtures.compilerCases) {
  const promptSet = promptSetFor(caseItem);
  const reviewDecision = reviewedDecision(promptSet);
  const registrySnapshot = buildVisualAssetRegistrySnapshot({
    id: `registry:${caseItem.referenceAssets}:v1`,
    libraries,
    referenceAssets: fixtures.referenceAssets[caseItem.referenceAssets]
  });
  const pageSpec = promptSet.pagePromptSpecs.find((item) => item.referenceAssetIds.length > 0) || promptSet.pagePromptSpecs[0];
  const result = compilePageGenerationRequest({
    promptSet,
    pageId: pageSpec.pageId,
    reviewDecision,
    capabilitySnapshot: capabilitySnapshots[caseItem.capabilityProfile],
    registrySnapshot,
    libraries,
    directionCandidates: fixtures.directionCandidates,
    options: caseItem.options
  });
  validateCompiledPageGenerationRequest(result.request);
  validateProviderCompilationTrace(result.trace, result.request);
  assert.deepEqual(result.request.blockers.map((item) => item.code), caseItem.expectedBlockers, caseItem.id);
  assert.deepEqual(result.trace.blockers, result.request.blockers);
  assert.equal(result.request.execution.provider, null);
  assert.equal(result.request.execution.retries, 0);
  assert.equal(result.request.execution.networkCalls, 0);
  assert.equal(result.request.execution.providerCalls, 0);
  assert.equal(result.request.execution.cost, 0);
  assert.equal(result.request.execution.databaseWrites, 0);
  assert.ok(result.request.blockers.every((item) => item.fallback === "deterministic_layout"));
  if (caseItem.id === "happy-deterministic") successfulCompilation = { caseItem, promptSet, reviewDecision, registrySnapshot, result };
}

const repeated = compilePageGenerationRequest({
  promptSet: successfulCompilation.promptSet,
  pageId: successfulCompilation.result.request.pagePromptSpecRef.id.split(":").slice(-2, -1)[0] || "P1",
  reviewDecision: successfulCompilation.reviewDecision,
  capabilitySnapshot: capabilitySnapshots.full,
  registrySnapshot: successfulCompilation.registrySnapshot,
  libraries,
  directionCandidates: fixtures.directionCandidates,
  options: successfulCompilation.caseItem.options
});
assert.equal(repeated.request.compiledHash, successfulCompilation.result.request.compiledHash);
assert.equal(repeated.trace.compiledHash, successfulCompilation.result.trace.compiledHash);
assert.equal(repeated.trace.traceHash, successfulCompilation.result.trace.traceHash);

const inconsistentOverall = rehashDecision({ ...structuredClone(controlDecision), overallStatus: "blocked" });
assert.throws(() => validatePromptReviewDecision(inconsistentOverall), /OVERALL_STATUS_INCONSISTENT/);
const inconsistentBlockers = structuredClone(controlDecision);
inconsistentBlockers.blockers.push({ code: "DIRECTION_SOURCE_MISSING", scope: "direction-structured", detail: "fixture blocker", fallback: "deterministic_layout" });
assert.throws(() => validatePromptReviewDecision(rehashDecision(inconsistentBlockers)), /OVERALL_STATUS_INCONSISTENT/);

function compileCandidateScenario(directionCandidates, reviewDecision) {
  const pageSpec = successfulCompilation.promptSet.pagePromptSpecs[0];
  return compilePageGenerationRequest({
    promptSet: successfulCompilation.promptSet,
    pageId: pageSpec.pageId,
    reviewDecision,
    capabilitySnapshot: capabilitySnapshots.full,
    registrySnapshot: successfulCompilation.registrySnapshot,
    libraries,
    directionCandidates,
    options: successfulCompilation.caseItem.options
  });
}

const pendingReviewDecision = createPromptReviewDecision({
  id: "review:pending-not-compilable:v1",
  promptSet: successfulCompilation.promptSet,
  directionCandidates: fixtures.directionCandidates
});
const pendingCompilation = compileCandidateScenario(fixtures.directionCandidates, pendingReviewDecision);
assert.equal(pendingCompilation.request.execution.status, "blocked");
assert.ok(pendingCompilation.request.blockers.some((item) => item.code === "REVIEW_DECISION_NOT_COMPILABLE"));

const reviewBlockerScenarios = [
  {
    expectedCode: "DIRECTION_NOT_STRUCTURALLY_DISTINCT",
    mutate(candidates) {
      candidates[1] = { ...structuredClone(candidates[0]), id: candidates[1].id, stylePackId: candidates[1].stylePackId, palette: ["violet", "white"] };
    }
  },
  { expectedCode: "DIRECTION_SOURCE_MISSING", mutate(candidates) { candidates[0].source = ""; } },
  { expectedCode: "DIRECTION_LICENSE_MISSING", mutate(candidates) { candidates[0].license = ""; } },
  {
    expectedCode: "DIRECTION_CAPABILITY_UNAVAILABLE",
    mutate(candidates) {
      candidates[0].capabilityStatus = { snapshotRef: "capability-blocked", status: "blocked", blockers: [{ code: "DIRECTION_CAPABILITY_UNAVAILABLE", detail: "fixture capability blocker" }] };
    }
  }
];
for (const scenario of reviewBlockerScenarios) {
  const candidates = structuredClone(fixtures.directionCandidates);
  scenario.mutate(candidates);
  const blockedDecision = reviewedDecision(successfulCompilation.promptSet, candidates);
  assert.equal(blockedDecision.overallStatus, "blocked");
  assert.ok(blockedDecision.blockers.some((item) => item.code === scenario.expectedCode));
  const compiled = compileCandidateScenario(candidates, blockedDecision);
  assert.equal(compiled.request.execution.status, "blocked");
  assert.ok(compiled.request.blockers.some((item) => item.code === scenario.expectedCode));
  assert.ok(compiled.request.blockers.some((item) => item.code === "REVIEW_DECISION_NOT_COMPILABLE"));
}

const selectedDirectionId = successfulCompilation.reviewDecision.visualDirectionSelection.selectedDirectionRef.id;
const candidateReplacementMutations = {
  compositionModel(candidate) { candidate.compositionModel = `${candidate.compositionModel}-replaced`; },
  hierarchyStrategy(candidate) { candidate.hierarchyStrategy = `${candidate.hierarchyStrategy}-replaced`; },
  imageRole(candidate) { candidate.imageRole = `${candidate.imageRole}-replaced`; },
  source(candidate) { candidate.source = `${candidate.source}-replaced`; },
  license(candidate) { candidate.license = `${candidate.license}-replaced`; },
  risks(candidate) { candidate.risks = [...candidate.risks, "replacement-risk"]; },
  capabilityStatus(candidate) { candidate.capabilityStatus = { ...candidate.capabilityStatus, snapshotRef: "capability-replaced" }; }
};
for (const [field, mutate] of Object.entries(candidateReplacementMutations)) {
  const candidates = structuredClone(fixtures.directionCandidates);
  const selected = candidates.find((item) => item.id === selectedDirectionId);
  mutate(selected);
  const compiled = compileCandidateScenario(candidates, successfulCompilation.reviewDecision);
  assert.equal(compiled.request.execution.status, "blocked", field);
  assert.ok(compiled.request.blockers.some((item) => item.code === "DIRECTION_CANDIDATE_SET_MISMATCH"), field);
  assert.ok(compiled.request.blockers.some((item) => item.code === "SELECTED_DIRECTION_HASH_MISMATCH"), field);
  assert.notEqual(compiled.trace.visualDirectionVerification.candidateSetHash, compiled.trace.visualDirectionVerification.reviewedCandidateSetHash, field);
}

const invalidDecision = structuredClone(controlDecision);
invalidDecision.unexpected = true;
assert.throws(() => validatePromptReviewDecision(invalidDecision), /FIELDS/);
const invalidCapability = structuredClone(capabilitySnapshots.full);
invalidCapability.capabilities.maxCandidateCount = "3";
assert.throws(() => validateProviderCapabilitySnapshot(invalidCapability), /POSITIVE_INTEGER_REQUIRED/);
const invalidRequest = structuredClone(successfulCompilation.result.request);
invalidRequest.execution.providerCalls = 1;
assert.throws(() => validateCompiledPageGenerationRequest(invalidRequest), /OFFLINE_ONLY/);
for (const [label, mutate] of Object.entries({
  decisions(trace) { trace.decisions[0].action = "tampered"; },
  blockers(trace) { trace.blockers.push({ code: "TAMPERED", scope: "trace", detail: "tampered", fallback: "deterministic_layout" }); },
  inputContracts(trace) { trace.inputContracts[0].id = "tampered-input"; },
  registryReference(trace) { trace.registrySnapshotRef = "tampered-registry"; },
  capabilityReference(trace) { trace.capabilitySnapshotHash = stableHash("tampered-capability"); },
  counters(trace) { trace.counters.networkCalls = 1; }
})) {
  const tamperedTrace = structuredClone(successfulCompilation.result.trace);
  mutate(tamperedTrace);
  assert.throws(() => validateProviderCompilationTrace(tamperedTrace, successfulCompilation.result.request), /HASH_MISMATCH|NONZERO_COUNTER|REFERENCE_MISMATCH/, label);
}
const forgedCompiledReference = structuredClone(successfulCompilation.result.trace);
forgedCompiledReference.compiledHash = stableHash("different-request");
forgedCompiledReference.compiledRequestRef.hash = forgedCompiledReference.compiledHash;
assert.throws(() => validateProviderCompilationTrace(rehashTrace(forgedCompiledReference), successfulCompilation.result.request), /REQUEST_REFERENCE_MISMATCH/);
const forgedRegistryReference = structuredClone(successfulCompilation.result.trace);
forgedRegistryReference.registrySnapshotRef = "registry:forged:v1";
assert.throws(() => validateProviderCompilationTrace(rehashTrace(forgedRegistryReference), successfulCompilation.result.request), /REGISTRY_REFERENCE_MISMATCH/);
const forgedCapabilityReference = structuredClone(successfulCompilation.result.trace);
forgedCapabilityReference.capabilitySnapshotHash = stableHash("forged-capability");
assert.throws(() => validateProviderCompilationTrace(rehashTrace(forgedCapabilityReference), successfulCompilation.result.request), /CAPABILITY_REFERENCE_MISMATCH/);
assert.throws(() => validateProviderCompilationTrace(successfulCompilation.result.trace), /COMPILED_REQUEST_REQUIRED/);
const invalidRegistry = structuredClone(authorizedRegistry);
invalidRegistry.entries[0].status = "approved";
assert.throws(() => validateVisualAssetRegistrySnapshot(invalidRegistry), /APPROVED_FORBIDDEN/);
const invalidEvaluation = structuredClone(evaluation);
invalidEvaluation.decision = "approved";
assert.throws(() => validateVisualAssetEvaluationRecord(invalidEvaluation), /APPROVAL_FORBIDDEN/);
const tamperedEvaluation = structuredClone(evaluation);
tamperedEvaluation.observations.push("tampered-after-hash");
assert.throws(() => validateVisualAssetEvaluationRecord(tamperedEvaluation), /HASH_MISMATCH/);

for (const contractFile of ["PromptReviewDecision.md", "ProviderCapabilitySnapshot.md", "CompiledPageGenerationRequest.md", "ProviderCompilationTrace.md", "VisualAssetRegistrySnapshot.md", "VisualAssetEvaluationRecord.md"]) {
  const text = readFileSync(join(appRoot, "contracts", contractFile), "utf8");
  assert.match(text, /schemaVersion/);
  assert.match(text, /上游|上游继续|上游可/);
  assert.match(text, /回退/);
}
const promptReviewContractText = readFileSync(join(appRoot, "contracts", "PromptReviewDecision.md"), "utf8");
assert.match(promptReviewContractText, /candidateSetHash/);
assert.match(promptReviewContractText, /selectedDirectionRef/);
assert.match(promptReviewContractText, /overallStatus.*blockers|blockers.*overallStatus/s);
const traceContractText = readFileSync(join(appRoot, "contracts", "ProviderCompilationTrace.md"), "utf8");
assert.match(traceContractText, /visualDirectionVerification/);
assert.match(traceContractText, /traceHash/);
assert.match(traceContractText, /compiledRequestRef\.hash == compiledHash == request\.compiledHash/);
const registryContractText = readFileSync(join(appRoot, "contracts", "VisualAssetRegistrySnapshot.md"), "utf8");
assert.match(registryContractText, /全局唯一/);
assert.match(registryContractText, /REGISTRY_DUPLICATE_ASSET_ID/);

console.log(JSON.stringify({
  status: "passed",
  directionCandidates: fixtures.directionCandidates.length,
  registryEntries: authorizedRegistry.entries.length,
  compilerCases: fixtures.compilerCases.length,
  reviewBlockerCases: reviewBlockerScenarios.length,
  candidateReplacementCases: Object.keys(candidateReplacementMutations).length,
  traceTamperCases: 10,
  registryDuplicateCases: 5,
  stableCompiledHash: successfulCompilation.result.request.compiledHash,
  networkCalls: 0,
  providerCalls: 0,
  retries: 0,
  cost: 0,
  databaseWrites: 0,
  liveTests: "not_run",
  approvedAssets: 0,
  productionEntryEnabled: false
}));
