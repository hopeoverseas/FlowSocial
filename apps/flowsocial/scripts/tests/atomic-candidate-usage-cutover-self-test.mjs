import assert from "node:assert/strict";
import {
  createUnifiedWriterContext,
  hashUnifiedContent,
  withUnifiedContentHash
} from "../../content-agent/unified-content-contracts.mjs";
import {
  createAtomicUnifiedContentCandidateV3,
  createExecutionAuthorityBinding,
  validateUnifiedContentCandidateV3
} from "../../content-agent/unified-execution-contracts.mjs";
import { compileUnifiedAtomicCandidateUsage } from "../../content-agent/unified-atomic-candidate-compiler.mjs";

const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

const sourceA = ref("knowledge-asset-a", "a");
const sourceB = ref("reference-asset-b", "b");
const unplannedSource = ref("unplanned-source", "c");
const platformRunRef = ref("platform-run-atomic", "4");
const masterRef = ref("master-atomic", "5");

function decision(selectedSourceRefs = [sourceA, sourceB]) {
  return withUnifiedContentHash({
    schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "decision-atomic", companyId: "company-atomic",
    projectInputRef: ref("project-input", "1"), activeStrategySnapshotRef: ref("active-strategy", "2"),
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms: [
      { mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", candidates: selectedSourceRefs.map((sourceRef) => ({ sourceRef, status: "selected", reason: "fixture" })), reason: "fixture", factPolicy: null },
      { mechanism: "hotspot", role: "not_selected", evaluationStatus: "evaluated", candidates: [], reason: "not selected", factPolicy: "external_event_not_business_fact" },
      { mechanism: "blueprint", role: "not_selected", evaluationStatus: "not_evaluated", candidates: [], reason: "not evaluated", factPolicy: null },
      { mechanism: "strategy_only", role: "not_selected", evaluationStatus: "evaluated", candidates: [], reason: "not selected", factPolicy: null },
      { mechanism: "user_material", role: "not_selected", evaluationStatus: "not_evaluated", candidates: [], reason: "not evaluated", factPolicy: null }
    ],
    selectedSourceRefs, strategyHotspotPolicy: "disabled", deviation: { status: "none", reason: null, confirmationEventRef: null },
    decidedAt: "2026-08-07T01:00:00.000Z", decisionHash: ""
  }, "decisionHash");
}

function fixture({ traceIds = [], received = [sourceA, sourceB], extraSources = [], creativeMechanism = "checklist", confirmedDeviation = false, conflict = false } = {}) {
  const frozenDecision = freeze(decision());
  const sourcePlan = freeze({
    schemaVersion: "1.0", mode: "mixed", frozenSourceRefs: [...received, ...extraSources],
    sources: conflict
      ? [{ sourceRef: sourceA, candidateIds: [sourceA.id, sourceB.id] }]
      : received.map((sourceRef) => ({ sourceRef, candidateIds: [sourceRef.id] }))
  });
  const strategyPayload = { creativeMechanism: "checklist" };
  let confirmationEvent = null;
  if (confirmedDeviation) {
    confirmationEvent = { contract: "ContentMechanismConfirmationEvent@1.0", id: "creative-confirmation", status: "confirmed", confirmedByType: "user", confirmedAt: "2026-08-07T01:01:00.000Z" };
    strategyPayload.creativeMechanismConfirmationEventRef = { id: confirmationEvent.id, hash: hashUnifiedContent(confirmationEvent) };
    strategyPayload.creativeDeviationReason = "confirmed platform adaptation";
  }
  const strategySnapshot = freeze({ id: "account-strategy-atomic", payload: strategyPayload });
  const decisionRef = { id: frozenDecision.id, hash: frozenDecision.decisionHash };
  const sourcePlanRef = { id: "source-plan-atomic", hash: hashUnifiedContent(sourcePlan) };
  const writerContext = createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "xiaohongshu",
    account_id: "account-atomic", topic_id: "topic-atomic", intent_profile_id: "intent-atomic", content_purpose_id: "purpose-atomic",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "discovery", trust_source: "institution" },
    creative_mechanism: creativeMechanism, journey_stage: "discover", coordination_mode: "standalone",
    matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "fixture", prohibited_overlap: [] },
    authority_refs: { accountStrategyRef: { id: strategySnapshot.id, hash: hashUnifiedContent(strategySnapshot) }, mechanismDecisionRef: decisionRef }
  });
  const writerContextRef = { id: "writer-context-atomic", hash: writerContext.writerContextHash };
  const authorityBinding = createExecutionAuthorityBinding({
    family: "atomic_v2", companyId: "company-atomic", accountId: "account-atomic",
    refs: [
      { role: "mechanismDecisionRef", ref: decisionRef }, { role: "platformRunRef", ref: platformRunRef },
      { role: "sharedContentMasterRef", ref: masterRef }, { role: "writerContextRef", ref: writerContextRef }
    ]
  });
  const assemblyBase = {
    schemaVersion: "2.0", contract: "DeterministicAssemblyFact@2.0", id: "assembly-atomic", status: "validated", authorityBinding,
    requiredRoles: ["postCopy"],
    componentFactRefs: [{ role: "postCopy", kind: "provider_component", factContract: "ValidatedComponentFact@1.0", factRef: ref("fact-post-copy", "6"), componentContract: "XhsPostCopy@1.0", componentRef: ref("post-copy", "7") }],
    assembly: { assembler: "fixtureAssembler", version: "1.0.0", outputContract: "XhsPostPackage@4.0", outputRef: ref("package-atomic", "8") }, factHash: ""
  };
  const assemblyFact = freeze(withUnifiedContentHash(assemblyBase, "factHash"));
  const traceability = freeze({
    id: "trace-atomic", usedFactIds: [], usedInterpretationIds: [], usedKnowledgeAssetIds: traceIds, usedReferenceAssetIds: []
  });
  const compilerInput = {
    factGraphCompilation: freeze({ assembly: { fact: assemblyFact }, deterministicFacts: { traceability: { component: traceability } } }),
    compilerContexts: freeze([{
      capability: "write-xhs-post-copy",
      input: { mechanism_decision: frozenDecision, mechanism_decision_ref: decisionRef, source_plan: sourcePlan, source_plan_ref: sourcePlanRef, writer_context: writerContext }
    }]),
    orchestrationSnapshot: freeze({ platformRuns: [{ platform: "xiaohongshu", platformRunRef }] }),
    strategySnapshot,
    existingConfirmationEvents: confirmationEvent ? [confirmationEvent] : [],
    boundAt: "2026-08-07T01:02:00.000Z"
  };
  return { compilerInput, assemblyFact };
}

const allUnknown = compileUnifiedAtomicCandidateUsage(fixture().compilerInput);
const fullChainFixture = fixture();
const fullChain = compileUnifiedAtomicCandidateUsage(fullChainFixture.compilerInput);
const graphWriterContextRef = fullChainFixture.assemblyFact.authorityBinding.refs.find((item) => item.role === "writerContextRef").ref;
assert.deepEqual(allUnknown.usageBinding.sourceUsage.map((item) => item.status), ["unknown_not_proven", "unknown_not_proven"]);
assert.equal(allUnknown.candidate.contract, "UnifiedContentCandidate@3.0");
assert.equal(allUnknown.candidate.authority.family, "atomic_v2");
assert.deepEqual(graphWriterContextRef, fullChain.usageBinding.creativeMechanism.writerContextRef, "flag-on Graph and Usage Binding must share the exact canonical WriterContext ref");
assert.deepEqual(fullChain.candidate.authority.assemblyFactRef, { id: fullChainFixture.assemblyFact.id, hash: fullChainFixture.assemblyFact.factHash });
assert.deepEqual(fullChain.candidate.authority.usageBindingRef, { id: fullChain.usageBinding.id, hash: fullChain.usageBinding.bindingHash });
assert.ok(Object.isFrozen(allUnknown) && Object.isFrozen(allUnknown.candidate) && Object.isFrozen(allUnknown.usageBinding));
validateUnifiedContentCandidateV3(allUnknown.candidate);

const partial = compileUnifiedAtomicCandidateUsage(fixture({ traceIds: [sourceA.id] }).compilerInput);
assert.deepEqual(partial.usageBinding.sourceUsage.map((item) => item.status), ["used", "unknown_not_proven"]);
assert.deepEqual(partial.usageBinding.provenUsedSourceRefs, [sourceA]);
assert.equal(partial.mechanismExplanation.provenance.readOnly, true);
assert.equal(partial.mechanismExplanation.provenance.promotionEligible, false);
assert.equal(compileUnifiedAtomicCandidateUsage(fixture({ traceIds: [sourceA.id] }).compilerInput).candidate.candidateHash, partial.candidate.candidateHash);

const notReceived = compileUnifiedAtomicCandidateUsage(fixture({ received: [sourceA] }).compilerInput);
assert.deepEqual(notReceived.usageBinding.sourceUsage.map((item) => item.status), ["unknown_not_proven", "unused"]);
const unplanned = compileUnifiedAtomicCandidateUsage(fixture({ extraSources: [unplannedSource] }).compilerInput);
assert.deepEqual(unplanned.usageBinding.plannedSourceRefs, [sourceA, sourceB]);
assert.equal(JSON.stringify(unplanned.usageBinding).includes(unplannedSource.id), false);
assert.throws(() => compileUnifiedAtomicCandidateUsage(fixture({ traceIds: [sourceA.id], conflict: true }).compilerInput), (error) => error.code === "UNIFIED_ATOMIC_USAGE_TRACE_SOURCE_CONFLICT");

assert.throws(() => compileUnifiedAtomicCandidateUsage(fixture({ creativeMechanism: "trend_bridge" }).compilerInput), (error) => error.code === "UNIFIED_ATOMIC_USAGE_CREATIVE_CONFIRMATION_REQUIRED");
const confirmed = compileUnifiedAtomicCandidateUsage(fixture({ creativeMechanism: "trend_bridge", confirmedDeviation: true }).compilerInput);
assert.equal(confirmed.usageBinding.creativeMechanism.alignment, "deviated");
assert.equal(confirmed.usageBinding.creativeMechanism.confirmationEventRef.id, "creative-confirmation");
assert.throws(
  () => compileUnifiedAtomicCandidateUsage({ ...fixture().compilerInput, confirmationEvent: { status: "confirmed" } }),
  (error) => error.code === "UNIFIED_ATOMIC_CANDIDATE_COMPILER_INPUT_INVALID",
  "callers cannot inject confirmation claims"
);

const staleAssembly = structuredClone(fixture().assemblyFact);
staleAssembly.factHash = "0".repeat(64);
assert.throws(
  () => createAtomicUnifiedContentCandidateV3({ id: "stale-assembly", platformRunRef, assemblyFact: freeze(staleAssembly), usageBinding: allUnknown.usageBinding, mechanismExplanation: allUnknown.mechanismExplanation }),
  (error) => error.code === "UNIFIED_EXECUTION_CONTRACT_INVALID"
);
const sameIdDifferentHashFixture = fixture();
const sameIdDifferentHashInput = structuredClone(sameIdDifferentHashFixture.compilerInput);
const originalAuthority = sameIdDifferentHashInput.factGraphCompilation.assembly.fact.authorityBinding;
const mismatchedWriterAuthority = createExecutionAuthorityBinding({
  family: originalAuthority.family,
  companyId: originalAuthority.companyId,
  accountId: originalAuthority.accountId,
  refs: originalAuthority.refs.map((item) => item.role === "writerContextRef"
    ? { role: item.role, ref: { id: item.ref.id, hash: "f".repeat(64) } }
    : item)
});
sameIdDifferentHashInput.factGraphCompilation.assembly.fact.authorityBinding = mismatchedWriterAuthority;
delete sameIdDifferentHashInput.factGraphCompilation.assembly.fact.factHash;
sameIdDifferentHashInput.factGraphCompilation.assembly.fact.factHash = hashUnifiedContent(sameIdDifferentHashInput.factGraphCompilation.assembly.fact);
freeze(sameIdDifferentHashInput);
assert.throws(
  () => compileUnifiedAtomicCandidateUsage(sameIdDifferentHashInput),
  (error) => error.code === "UNIFIED_ATOMIC_USAGE_WRITER_CONTEXT_STALE",
  "same WriterContext ID with a different hash must not cross the Graph-to-Usage boundary"
);
assert.throws(
  () => createAtomicUnifiedContentCandidateV3({
    id: "same-id-different-writer-hash", platformRunRef,
    assemblyFact: sameIdDifferentHashInput.factGraphCompilation.assembly.fact,
    usageBinding: allUnknown.usageBinding,
    mechanismExplanation: allUnknown.mechanismExplanation
  }),
  (error) => error.code === "UNIFIED_EXECUTION_CONTRACT_INVALID" && error.details.fieldPaths.includes("input.writerContextRef"),
  "same WriterContext ID with a different hash must not cross the Usage-to-Candidate boundary"
);
const staleBinding = structuredClone(allUnknown.usageBinding);
staleBinding.bindingHash = "0".repeat(64);
assert.throws(
  () => createAtomicUnifiedContentCandidateV3({ id: "stale-binding", platformRunRef, assemblyFact: fixture().assemblyFact, usageBinding: freeze(staleBinding), mechanismExplanation: allUnknown.mechanismExplanation }),
  (error) => error.code === "ContentMechanismUsageBinding:HASH_MISMATCH"
);
const crossAuthorityBinding = structuredClone(allUnknown.usageBinding);
crossAuthorityBinding.companyId = "company-other";
delete crossAuthorityBinding.bindingHash;
crossAuthorityBinding.bindingHash = hashUnifiedContent(crossAuthorityBinding);
assert.throws(
  () => createAtomicUnifiedContentCandidateV3({ id: "cross-authority", platformRunRef, assemblyFact: fixture().assemblyFact, usageBinding: freeze(crossAuthorityBinding), mechanismExplanation: allUnknown.mechanismExplanation }),
  (error) => error.code === "UNIFIED_EXECUTION_CONTRACT_INVALID"
);

for (const invalid of [null, 7, { ...allUnknown.candidate, extra: true }, { schemaVersion: "2.0", contract: "UnifiedContentCandidate@2.0" }, { rawProviderEnvelope: { status: "ok" } }]) {
  assert.throws(() => validateUnifiedContentCandidateV3(invalid), (error) => error instanceof TypeError === false && error.code === "UNIFIED_EXECUTION_CONTRACT_INVALID");
}

console.log("atomic-candidate-usage-cutover-self-test: ok");
