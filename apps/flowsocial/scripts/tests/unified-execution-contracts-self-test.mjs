import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  DEFAULT_ATOMIC_ATTEMPT_POLICY,
  UNIFIED_EXECUTION_CONTRACTS,
  adaptMonolithicCandidateV1ReadOnly,
  createAtomicUnifiedContentCandidateV2,
  createDeterministicAssemblyFact,
  createExecutionAuthorityBinding,
  createInitialUnifiedContentRunState,
  createSkillActivityInvocation,
  createValidatedComponentFact,
  transitionUnifiedContentRunState,
  validateDeterministicAssemblyFact,
  validateSkillActivityInvocation,
  validateLegacyMonolithicWriterFact,
  validateUnifiedContentCandidateV2,
  validateUnifiedContentRunState,
  validateValidatedComponentFact
} from "../../content-agent/unified-execution-contracts.mjs";

const ref = (id, character) => ({ id, hash: character.repeat(64) });
const legacyAuthority = {
  companyId: "company_fixture",
  accountId: "account_fixture",
  activeStrategySnapshotRef: ref("strategy_fixture", "1"),
  contentOpportunityRef: ref("opportunity_fixture", "2"),
  mechanismDecisionRef: ref("decision_fixture", "3"),
  contentProjectRef: ref("project_fixture", "4"),
  platformRunRef: ref("run_fixture", "5"),
  sharedContentMasterRef: ref("master_fixture", "6"),
  platformBriefRef: ref("brief_fixture", "7"),
  confirmedOutlineRef: ref("outline_fixture", "8"),
  writerContextRef: ref("context_fixture", "9"),
  designDnaRef: ref("dna_fixture", "a")
};
const authorityRefs = Object.entries(legacyAuthority)
  .filter(([, value]) => value && typeof value === "object")
  .map(([role, value]) => ({ role, ref: structuredClone(value) }));
const atomicAuthority = createExecutionAuthorityBinding({ family: "atomic_v2", companyId: legacyAuthority.companyId, accountId: legacyAuthority.accountId, refs: authorityRefs });
assert.ok(Object.isFrozen(atomicAuthority) && Object.isFrozen(atomicAuthority.refs));
const codePointAuthority = createExecutionAuthorityBinding({
  family: "atomic_v2", companyId: "company_fixture", accountId: "account_fixture",
  refs: ["中", "é", "z", "A"].map((role, index) => ({ role, ref: ref(`role-${index}`, String(index + 1)) }))
});
assert.deepEqual(codePointAuthority.refs.map((item) => item.role), ["A", "z", "é", "中"], "authority roles must use locale-independent code-point order");
assert.equal(createExecutionAuthorityBinding({ family: "atomic_v2", companyId: "company_fixture", accountId: "account_fixture", refs: [...codePointAuthority.refs].reverse() }).authorityHash, codePointAuthority.authorityHash);

const inputRef = ref("skill-input", "b");
const planHash = "c".repeat(64);
const invocation = createSkillActivityInvocation({
  id: "invocation-copy-1",
  skill: { name: "write-xhs-post-copy", version: "1.0.0" },
  inputRef,
  authorityBinding: atomicAuthority,
  planHash
});
validateSkillActivityInvocation(invocation);
assert.deepEqual(invocation.attemptPolicy, DEFAULT_ATOMIC_ATTEMPT_POLICY);
assert.ok(Object.isFrozen(invocation) && Object.isFrozen(invocation.attemptPolicy));

const reorderedAuthority = createExecutionAuthorityBinding({ family: "atomic_v2", companyId: legacyAuthority.companyId, accountId: legacyAuthority.accountId, refs: [...authorityRefs].reverse() });
const invocationRetryIdentity = createSkillActivityInvocation({
  id: "invocation-copy-other-id",
  skill: { name: "write-xhs-post-copy", version: "1.0.0" }, inputRef,
  authorityBinding: reorderedAuthority, planHash
});
assert.equal(invocationRetryIdentity.idempotencyKey, invocation.idempotencyKey, "idempotency identity must ignore invocation ID and authority-ref input order");
assert.notEqual(invocationRetryIdentity.invocationHash, invocation.invocationHash, "the immutable invocation fact still binds its own ID");
const budgetPolicy = { maxAttempts: 3, automaticRetries: 2, timeoutMs: 90_000, maxProviderCalls: 3, costBudget: { currency: "USD", maxAmountMicros: 500_000 } };
const budgeted = createSkillActivityInvocation({ id: "budgeted", skill: { name: "atomic", version: "2" }, inputRef, authorityBinding: atomicAuthority, planHash, attemptPolicy: budgetPolicy });
assert.deepEqual(budgeted.attemptPolicy, budgetPolicy);
assert.throws(
  () => createSkillActivityInvocation({ id: "bad-retry", skill: { name: "atomic", version: "2" }, inputRef, authorityBinding: atomicAuthority, planHash, attemptPolicy: { ...budgetPolicy, automaticRetries: 3 } }),
  (error) => error.details.fieldPaths.includes("input.attemptPolicy.automaticRetries")
);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function makeComponent(id, contract, payload) {
  const draft = { schemaVersion: "1.0", contract, id, authorityBinding: structuredClone(legacyAuthority), payload };
  return deepFreeze({ ...draft, componentHash: hashUnifiedContent(draft) });
}

function validateFixtureComponent(value) {
  const keys = ["schemaVersion", "contract", "id", "authorityBinding", "payload", "componentHash"];
  const copy = structuredClone(value);
  const componentHash = copy?.componentHash;
  if (copy) delete copy.componentHash;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key)) || value.schemaVersion !== "1.0" || hashUnifiedContent(copy) !== componentHash) {
    throw new Error("fixture component invalid");
  }
  return value;
}

const copyComponent = makeComponent("copy-1", "FixtureCopy@1.0", { text: "fixture" });
const carouselComponent = makeComponent("carousel-1", "FixtureCarousel@1.0", { pages: 6 });
const copyFact = createValidatedComponentFact({
  id: "copy-fact-1", invocation, componentRole: "post_copy", component: copyComponent, componentHashField: "componentHash",
  validateComponent: validateFixtureComponent, validator: { name: "validateFixtureComponent", version: "1.0.0" }, rawProviderEnvelopeRef: ref("provider-envelope-audit", "d")
});
const carouselInvocation = createSkillActivityInvocation({ id: "invocation-carousel-1", skill: { name: "plan-xhs-carousel", version: "1.0.0" }, inputRef: ref("carousel-input", "e"), authorityBinding: atomicAuthority, planHash });
const carouselFact = createValidatedComponentFact({
  id: "carousel-fact-1", invocation: carouselInvocation, componentRole: "carousel_plan", component: carouselComponent, componentHashField: "componentHash",
  validateComponent: validateFixtureComponent, validator: { name: "validateFixtureComponent", version: "1.0.0" }
});
validateValidatedComponentFact(copyFact);
assert.equal(copyFact.audit.rawEnvelopeAuthoritative, false);
assert.notDeepEqual(copyFact.audit.rawProviderEnvelopeRef, copyFact.componentRef);
assert.ok(Object.isFrozen(copyFact) && Object.isFrozen(copyFact.componentRef));

const mutableComponent = structuredClone(copyComponent);
assert.throws(
  () => createValidatedComponentFact({ id: "mutable", invocation, componentRole: "post_copy", component: mutableComponent, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.component")
);
const tamperedComponent = structuredClone(copyComponent);
tamperedComponent.payload.text = "tampered";
deepFreeze(tamperedComponent);
assert.throws(
  () => createValidatedComponentFact({ id: "tampered", invocation, componentRole: "post_copy", component: tamperedComponent, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.component.hash")
);
assert.throws(
  () => createValidatedComponentFact({ id: "raw-authority", invocation, componentRole: "post_copy", component: copyComponent, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" }, rawProviderEnvelopeRef: { id: copyComponent.id, hash: copyComponent.componentHash } }),
  (error) => error.details.fieldPaths.includes("$.audit.authoritySeparation")
);
const failedComponent = deepFreeze({ ...structuredClone(copyComponent), status: "failed" });
assert.throws(
  () => createValidatedComponentFact({ id: "failed", invocation, componentRole: "post_copy", component: failedComponent, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" } }),
  "failed/extra-shape output cannot become a fact"
);
const wrongAuthorityComponent = makeComponent("copy-other", "FixtureCopy@1.0", { text: "fixture" });
const wrongAuthorityMutable = structuredClone(wrongAuthorityComponent);
wrongAuthorityMutable.authorityBinding.accountId = "other-account";
delete wrongAuthorityMutable.componentHash;
wrongAuthorityMutable.componentHash = hashUnifiedContent(wrongAuthorityMutable);
deepFreeze(wrongAuthorityMutable);
assert.throws(
  () => createValidatedComponentFact({ id: "wrong-authority", invocation, componentRole: "post_copy", component: wrongAuthorityMutable, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.component.authorityBinding")
);

function makeAssembly(componentFacts) {
  const draft = {
    schemaVersion: "1.0", contract: "FixturePackage@1.0", id: "package-1", authorityBinding: structuredClone(legacyAuthority),
    componentRefs: Object.fromEntries(componentFacts.map((fact) => [fact.componentRole, structuredClone(fact.componentRef)]))
  };
  return deepFreeze({ ...draft, packageHash: hashUnifiedContent(draft) });
}
function validateFixtureAssembly(value) {
  const copy = structuredClone(value);
  const packageHash = copy?.packageHash;
  if (copy) delete copy.packageHash;
  if (!value || value.contract !== "FixturePackage@1.0" || hashUnifiedContent(copy) !== packageHash) throw new Error("fixture package invalid");
  return value;
}
const assemblyOutput = makeAssembly([copyFact, carouselFact]);
const assemblyFact = createDeterministicAssemblyFact({
  id: "assembly-fact-1", componentFacts: [copyFact, carouselFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput,
  assemblyHashField: "packageHash", validateAssembly: validateFixtureAssembly, assembler: { name: "assemble-fixture", version: "1.0.0" }
});
validateDeterministicAssemblyFact(assemblyFact);
assert.deepEqual(assemblyFact.requiredRoles, ["carousel_plan", "post_copy"]);
assert.ok(Object.isFrozen(assemblyFact) && Object.isFrozen(assemblyFact.componentFactRefs));
assert.doesNotThrow(() => createDeterministicAssemblyFact({ id: "true-validator", componentFacts: [copyFact, carouselFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput, assemblyHashField: "packageHash", validateAssembly: () => true, assembler: { name: "assemble", version: "1" } }));
for (const [label, validatorResult] of [["false", false], ["null", null], ["undefined", undefined], ["other object", {}]]) {
  assert.throws(
    () => createDeterministicAssemblyFact({ id: `bad-validator-${label}`, componentFacts: [copyFact, carouselFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput, assemblyHashField: "packageHash", validateAssembly: () => validatorResult, assembler: { name: "assemble", version: "1" } }),
    (error) => error.details.fieldPaths.includes("input.validateAssembly.result"),
    `assembly validator result ${label} must fail closed`
  );
}
assert.throws(
  () => createDeterministicAssemblyFact({ id: "missing", componentFacts: [copyFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput, assemblyHashField: "packageHash", validateAssembly: validateFixtureAssembly, assembler: { name: "assemble", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.componentFacts.roles")
);
assert.throws(
  () => createDeterministicAssemblyFact({ id: "duplicate", componentFacts: [copyFact, copyFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput, assemblyHashField: "packageHash", validateAssembly: validateFixtureAssembly, assembler: { name: "assemble", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.componentFacts.roles")
);
const wrongAssemblyRefMutable = structuredClone(assemblyOutput);
wrongAssemblyRefMutable.componentRefs.post_copy = ref("different-component", "d");
delete wrongAssemblyRefMutable.packageHash;
wrongAssemblyRefMutable.packageHash = hashUnifiedContent(wrongAssemblyRefMutable);
deepFreeze(wrongAssemblyRefMutable);
assert.throws(
  () => createDeterministicAssemblyFact({ id: "wrong-ref", componentFacts: [copyFact, carouselFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput: wrongAssemblyRefMutable, assemblyHashField: "packageHash", validateAssembly: validateFixtureAssembly, assembler: { name: "assemble", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.assemblyOutput.componentRefs")
);

const otherAuthority = createExecutionAuthorityBinding({ family: "atomic_v2", companyId: legacyAuthority.companyId, accountId: "other-account", refs: authorityRefs });
const otherLegacyAuthority = { ...structuredClone(legacyAuthority), accountId: "other-account" };
const otherInvocation = createSkillActivityInvocation({ id: "other-invocation", skill: { name: "other", version: "1" }, inputRef, authorityBinding: otherAuthority, planHash });
const otherComponent = (() => { const draft = { schemaVersion: "1.0", contract: "Other@1.0", id: "other", authorityBinding: otherLegacyAuthority, payload: {} }; return deepFreeze({ ...draft, componentHash: hashUnifiedContent(draft) }); })();
const otherFact = createValidatedComponentFact({ id: "other-fact", invocation: otherInvocation, componentRole: "carousel_plan", component: otherComponent, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" } });
assert.throws(
  () => createDeterministicAssemblyFact({ id: "mixed", componentFacts: [copyFact, otherFact], requiredRoles: ["post_copy", "carousel_plan"], assemblyOutput, assemblyHashField: "packageHash", validateAssembly: validateFixtureAssembly, assembler: { name: "assemble", version: "1" } }),
  (error) => error.details.fieldPaths.includes("input.componentFacts.authorityBinding"),
  "cross-authority facts must not assemble"
);

const platformRunRef = ref("platform-run", "f");
const atomicCandidate = createAtomicUnifiedContentCandidateV2({ id: "candidate-atomic", platformRunRef, assemblyFact });
validateUnifiedContentCandidateV2(atomicCandidate);
assert.deepEqual(Object.keys(atomicCandidate.authority).sort(), ["assemblyFactRef", "family"]);
const legacyRuntimeOutput = { status: "success", data: { post_copy: { recommended_title: "fixture" } }, warnings: [], blocked_reasons: [] };
const monolithicFactDraft = {
  schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: "legacy-writer-fact",
  invocationRef: ref("legacy-invocation", "0"), executionRecordRef: ref("legacy-record", "1"),
  platform: "xiaohongshu", stepId: "xhs_writer", capability: "write-xhs-content",
  inputContract: "XhsWriterInput@1.0", outputContract: "XhsPostPackage@2.0", planRef: ref("legacy-plan", "2"),
  bundleHash: "3".repeat(64), inputHash: "4".repeat(64), outputHash: hashUnifiedContent(legacyRuntimeOutput),
  runtimeOutput: legacyRuntimeOutput, verifiedDomainOutput: null, executionMode: "real", status: "completed", productionEligibleOutput: true
};
const monolithicFact = deepFreeze({ ...monolithicFactDraft, factHash: hashUnifiedContent(monolithicFactDraft) });
validateLegacyMonolithicWriterFact(monolithicFact);
const monolithicCandidate = adaptMonolithicCandidateV1ReadOnly({ id: "candidate-legacy", platformRunRef, monolithicFact });
validateUnifiedContentCandidateV2(monolithicCandidate);
assert.deepEqual(monolithicCandidate.authority.provenance, { kind: "monolithic_candidate_v1_compatibility_adapter", readOnly: true, promotionEligible: false, nativeCandidateV2: false });
const arbitrarySelfHashedDraft = { contract: "ArbitraryFact@1.0", id: "arbitrary", payload: "self-consistent" };
const arbitrarySelfHashedFact = deepFreeze({ ...arbitrarySelfHashedDraft, factHash: hashUnifiedContent(arbitrarySelfHashedDraft) });
assert.throws(
  () => adaptMonolithicCandidateV1ReadOnly({ id: "candidate-arbitrary", platformRunRef, monolithicFact: arbitrarySelfHashedFact }),
  (error) => error.details.contract === "UnifiedSkillOutputFact@1.0" && error.details.fieldPaths.includes("$"),
  "an arbitrary self-hashed object must not become monolithic authority"
);
for (const [field, value, expectedPath] of [
  ["capability", "generate-platform-titles", "$.capability"],
  ["status", "failed", "$.status"],
  ["outputHash", "f".repeat(64), "$.outputHash"]
]) {
  const invalidLegacyFact = structuredClone(monolithicFact);
  invalidLegacyFact[field] = value;
  delete invalidLegacyFact.factHash;
  invalidLegacyFact.factHash = hashUnifiedContent(invalidLegacyFact);
  deepFreeze(invalidLegacyFact);
  assert.throws(() => adaptMonolithicCandidateV1ReadOnly({ id: `candidate-${field}`, platformRunRef, monolithicFact: invalidLegacyFact }), (error) => error.details.fieldPaths.includes(expectedPath));
}
const mixedCandidate = structuredClone(atomicCandidate);
mixedCandidate.authority.monolithicFactRef = monolithicCandidate.authority.monolithicFactRef;
delete mixedCandidate.candidateHash;
mixedCandidate.candidateHash = hashUnifiedContent(mixedCandidate);
assert.throws(() => validateUnifiedContentCandidateV2(mixedCandidate), (error) => error.details.fieldPaths.includes("$.authority"));

const monolithicRoleAssembly = structuredClone(assemblyFact);
monolithicRoleAssembly.componentFactRefs[1].role = "write-xhs-content";
monolithicRoleAssembly.requiredRoles[1] = "write-xhs-content";
delete monolithicRoleAssembly.factHash;
monolithicRoleAssembly.factHash = hashUnifiedContent(monolithicRoleAssembly);
deepFreeze(monolithicRoleAssembly);
assert.throws(
  () => createAtomicUnifiedContentCandidateV2({ id: "bad-atomic", platformRunRef, assemblyFact: monolithicRoleAssembly }),
  (error) => error.details.fieldPaths.includes("$.componentFactRefs.atomicOnly")
);

const runRef = ref("content-run", "1");
const event = (name, character) => ref(name, character);
const planned = createInitialUnifiedContentRunState({ id: "run-state", contentRunRef: runRef, eventRef: event("planned-event", "2") });
const running = transitionUnifiedContentRunState(planned, { toState: "components_running", eventRef: event("start-event", "3") });
const componentsReady = transitionUnifiedContentRunState(running, { toState: "components_validated", eventRef: event("components-event", "4") });
const assembled = transitionUnifiedContentRunState(componentsReady, { toState: "assembly_validated", eventRef: event("assembly-event", "5") });
const candidateReady = transitionUnifiedContentRunState(assembled, { toState: "candidate_ready", eventRef: event("candidate-event", "6") });
const userReview = transitionUnifiedContentRunState(candidateReady, { toState: "user_review", eventRef: event("review-event", "7") });
assert.deepEqual(userReview.completedGates, ["components", "assembly", "candidate"]);
assert.ok(Object.isFrozen(userReview));
assert.throws(() => transitionUnifiedContentRunState(planned, { toState: "candidate_ready", eventRef: event("skip", "8") }), (error) => error.details.fieldPaths.includes("input.toState"));
const failed = transitionUnifiedContentRunState(running, { toState: "component_failed", eventRef: event("failed", "9"), failure: { stage: "components", code: "VALIDATION_FAILED", evidenceRef: event("failure-evidence", "a") } });
assert.throws(() => transitionUnifiedContentRunState(failed, { toState: "candidate_ready", eventRef: event("illegal-recovery", "b") }), (error) => error.details.fieldPaths.includes("input.toState"));

const validatorCases = [
  ["invocation", validateSkillActivityInvocation, invocation, "invocationHash"],
  ["component fact", validateValidatedComponentFact, copyFact, "factHash"],
  ["assembly fact", validateDeterministicAssemblyFact, assemblyFact, "factHash"],
  ["candidate", validateUnifiedContentCandidateV2, atomicCandidate, "candidateHash"],
  ["run state", validateUnifiedContentRunState, userReview, "stateHash"]
];
for (const [name, validator, source, hashField] of validatorCases) {
  for (const shape of ["missing", "extra", "null", "primitive"]) {
    let invalidValue;
    if (shape === "null") invalidValue = null;
    else if (shape === "primitive") invalidValue = 42;
    else {
      invalidValue = structuredClone(source);
      if (shape === "missing") delete invalidValue.schemaVersion;
      else invalidValue.privateSecret = "DO_NOT_ECHO";
    }
    assert.throws(
      () => validator(invalidValue),
      (error) => error.code === "UNIFIED_EXECUTION_CONTRACT_INVALID" && error.details.fieldPaths.includes("$") && !JSON.stringify(error.details).includes("DO_NOT_ECHO"),
      `${name} ${shape} must fail safely at the exact root`
    );
  }
  const tampered = structuredClone(source);
  tampered[hashField] = "0".repeat(64);
  assert.throws(() => validator(tampered), (error) => error.details.fieldPaths.includes(`$.${hashField}`), `${name} hash tampering must fail`);
}

const sourceInputs = { legacyAuthority: structuredClone(legacyAuthority), authorityRefs: structuredClone(authorityRefs), budgetPolicy: structuredClone(budgetPolicy), copyComponent: structuredClone(copyComponent), assemblyOutput: structuredClone(assemblyOutput) };
assert.deepEqual({ legacyAuthority, authorityRefs, budgetPolicy, copyComponent, assemblyOutput }, sourceInputs, "constructors must not mutate source inputs");
assert.equal(createSkillActivityInvocation({ id: invocation.id, skill: invocation.skill, inputRef, authorityBinding: atomicAuthority, planHash }).invocationHash, invocation.invocationHash);
assert.equal(createAtomicUnifiedContentCandidateV2({ id: atomicCandidate.id, platformRunRef, assemblyFact }).candidateHash, atomicCandidate.candidateHash);

export const UNIFIED_EXECUTION_SELF_TEST_CLAIMS = Object.freeze({ providerCalls: 0, externalCalls: 0, databaseWrites: 0, browserCalls: 0, platformWrites: 0 });
console.log("unified-execution-contracts-self-test: ok");
