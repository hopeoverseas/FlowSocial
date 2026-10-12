import assert from "node:assert/strict";
import { hashUnifiedContent, withUnifiedContentHash, createUnifiedWriterContext } from "../../content-agent/unified-content-contracts.mjs";
import {
  createDeterministicAssemblyFactV2,
  createDeterministicCompilerInputRef,
  createDeterministicComponentFact,
  createExecutionAuthorityBinding,
  createSkillActivityInvocation,
  createValidatedComponentFact
} from "../../content-agent/unified-execution-contracts.mjs";
import { compileUnifiedAtomicCandidateUsage } from "../../content-agent/unified-atomic-candidate-compiler.mjs";
import {
  createUnifiedAtomicContentCommit,
  createUnifiedAtomicContentCommitStore,
  validateUnifiedAtomicContentCommit
} from "../../content-agent/unified-atomic-content-commit-store.mjs";

const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });
const roles = ["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan", "traceability", "preflightReport"];
const providerRoles = new Set(["postCopy", "carouselPlan", "visualAssetPlan"]);
const hashFields = { postCopy: "componentHash", finalTitleBinding: "bindingHash", carouselPlan: "componentHash", visualAssetPlan: "componentHash", traceability: "traceHash", preflightReport: "reportHash" };

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function fixtureComponent(role, authorityBinding, suffix) {
  const hashField = hashFields[role];
  const draft = {
    schemaVersion: "1.0", contract: `Fixture${role}@1.0`, id: `${role}${suffix}`, authorityBinding,
    status: role === "preflightReport" ? "passed" : "ready", payload: { role },
    ...(role === "traceability" ? { usedFactIds: [], usedInterpretationIds: [], usedKnowledgeAssetIds: [], usedReferenceAssetIds: [] } : {})
  };
  return freeze({ ...draft, [hashField]: hashUnifiedContent(draft) });
}

function validateFixture(value, hashField) {
  const copy = structuredClone(value);
  const declared = copy[hashField];
  delete copy[hashField];
  if (hashUnifiedContent(copy) !== declared) throw new Error("fixture invalid");
  return value;
}

function decision(sourceRef, suffix) {
  return withUnifiedContentHash({
    schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: `decision${suffix}`, companyId: "company",
    projectInputRef: ref(`project-input${suffix}`, "1"), activeStrategySnapshotRef: ref(`strategy${suffix}`, "2"),
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms: [{ mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", candidates: [{ sourceRef, status: "selected", reason: "fixture" }], reason: "fixture", factPolicy: null }],
    selectedSourceRefs: [sourceRef], strategyHotspotPolicy: "disabled", deviation: { status: "none", reason: null, confirmationEventRef: null },
    decidedAt: "2026-08-07T03:00:00.000Z", decisionHash: ""
  }, "decisionHash");
}

function buildCommit({ suffix = "", accountId = "account", idempotencyKey = `commit-key${suffix}` } = {}) {
  const contentProjectRef = ref("content-project", "3");
  const platformRunRef = ref("platform-run", "4");
  const masterRef = ref("master", "5");
  const sourceRef = ref(`source${suffix}`, "a");
  const mechanismDecision = freeze(decision(sourceRef, suffix));
  const mechanismDecisionRef = { id: mechanismDecision.id, hash: mechanismDecision.decisionHash };
  const strategySnapshot = freeze({ id: `account-strategy${suffix}`, payload: { creativeMechanism: "checklist" } });
  const writerContext = createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "xiaohongshu", account_id: accountId,
    topic_id: "topic", intent_profile_id: "intent", content_purpose_id: "purpose",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "discovery", trust_source: "institution" },
    creative_mechanism: "checklist", journey_stage: "discover", coordination_mode: "standalone",
    matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "fixture", prohibited_overlap: [] },
    authority_refs: { accountStrategyRef: { id: strategySnapshot.id, hash: hashUnifiedContent(strategySnapshot) }, mechanismDecisionRef }
  });
  const writerContextRef = { id: `writer-context${suffix}`, hash: writerContext.writerContextHash };
  const legacyAuthority = {
    companyId: "company", accountId, contentProjectRef, platformRunRef, sharedContentMasterRef: masterRef,
    mechanismDecisionRef, writerContextRef
  };
  const authority = createExecutionAuthorityBinding({
    family: "atomic_v2", companyId: "company", accountId,
    refs: Object.entries(legacyAuthority).filter(([key]) => key.endsWith("Ref")).map(([role, value]) => ({ role, ref: value }))
  });
  const components = {};
  const facts = {};
  for (const role of roles) {
    const component = fixtureComponent(role, legacyAuthority, suffix);
    components[role] = component;
    if (providerRoles.has(role)) {
      const invocation = createSkillActivityInvocation({
        id: `invocation-${role}${suffix}`, skill: { name: `skill-${role}`, version: "1.0.0" }, inputRef: ref(`input-${role}${suffix}`, "6"), authorityBinding: authority, planHash: "7".repeat(64)
      });
      facts[role] = createValidatedComponentFact({
        id: `fact-${role}${suffix}`, invocation, componentRole: role, component, componentHashField: hashFields[role],
        validateComponent: (value) => validateFixture(value, hashFields[role]), validator: { name: `validate-${role}`, version: "1.0.0" }, rawProviderEnvelopeRef: ref(`raw-${role}${suffix}`, "8")
      });
    } else {
      const upstreamFacts = [{ kind: "provider_component", role: "postCopy", fact: facts.postCopy }];
      const input = freeze({ role });
      const inputRef = createDeterministicCompilerInputRef({ id: `compiler-input-${role}${suffix}`, input, upstreamFacts, authorityBinding: authority });
      const compiled = createDeterministicComponentFact({
        id: `fact-${role}${suffix}`, producer: { name: `compile-${role}`, version: "1.0.0", authorityBinding: authority }, input, inputRef, upstreamFacts,
        componentRole: role, compiler: () => component, validateComponent: (value) => validateFixture(value, hashFields[role]),
        validator: { name: `validate-${role}`, version: "1.0.0" }, componentHashField: hashFields[role]
      });
      facts[role] = compiled.fact;
    }
  }
  const componentEntries = roles.map((role) => ({ role, fact: facts[role], component: components[role], componentHashField: hashFields[role] }));
  const assembly = createDeterministicAssemblyFactV2({
    id: `package${suffix}`, componentEntries,
    assemblySpec: { name: "fixture-assembler", version: "1.0.0", requiredRoles: roles, outputContract: "XhsPostPackage@4.0" },
    assembler: ({ id, components: values }) => {
      const draft = {
        schemaVersion: "4.0", contract: "XhsPostPackage@4.0", id, authorityBinding: legacyAuthority,
        componentRefs: Object.fromEntries(roles.map((role) => [role, { id: values[role].id, hash: values[role][hashFields[role]] }])),
        assembly: { mode: "deterministic_component_assembly", status: "assembled", providerAuthored: false, mutable: false }
      };
      return freeze({ ...draft, packageHash: hashUnifiedContent(draft) });
    },
    validateAssembly: () => true, assemblyHashField: "packageHash"
  });
  const componentFacts = roles.map((role) => ({ role, kind: providerRoles.has(role) ? "provider_component" : "deterministic_component", fact: facts[role] }));
  const graphBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicFactGraph@1.0", id: `graph${suffix}`, authorityBinding: authority,
    activityRefs: ["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"].map((capability, index) => ({ capability, bundleRef: ref(`bundle-${index}${suffix}`, "9") })),
    componentFactRefs: componentFacts.map((item) => ({ role: item.role, kind: item.kind, factRef: { id: item.fact.id, hash: item.fact.factHash }, componentRef: item.fact.componentRef })),
    titleUpstreamRef: ref(`title${suffix}`, "b"), assemblyFactRef: { id: assembly.fact.id, hash: assembly.fact.factHash }
  };
  const graph = freeze({ ...graphBase, graphHash: hashUnifiedContent(graphBase) });
  const sourcePlan = freeze({ schemaVersion: "1.0", mode: "knowledge", frozenSourceRefs: [sourceRef], sources: [{ sourceRef, candidateIds: [sourceRef.id] }] });
  const sourcePlanRef = { id: `source-plan${suffix}`, hash: hashUnifiedContent(sourcePlan) };
  const candidateUsage = compileUnifiedAtomicCandidateUsage({
    factGraphCompilation: freeze({ assembly, deterministicFacts: { traceability: { component: components.traceability } } }),
    compilerContexts: freeze([{ capability: "write-xhs-post-copy", input: { mechanism_decision: mechanismDecision, mechanism_decision_ref: mechanismDecisionRef, source_plan: sourcePlan, source_plan_ref: sourcePlanRef, writer_context: writerContext } }]),
    orchestrationSnapshot: freeze({ platformRuns: [{ platform: "xiaohongshu", platformRunRef }] }),
    strategySnapshot, existingConfirmationEvents: [], boundAt: "2026-08-07T03:01:00.000Z"
  });
  return createUnifiedAtomicContentCommit({
    id: `atomic-commit${suffix}`, idempotencyKey, contentProjectRef, platform: "xiaohongshu", graph, componentFacts,
    assemblyFact: assembly.fact, usageBinding: candidateUsage.usageBinding, mechanismExplanation: candidateUsage.mechanismExplanation, candidate: candidateUsage.candidate
  });
}

function rehash(commit) {
  const copy = structuredClone(commit);
  delete copy.commitHash;
  return { ...copy, commitHash: hashUnifiedContent(copy) };
}

const commit = buildCommit();
validateUnifiedAtomicContentCommit(commit);
assert.ok(Object.isFrozen(commit) && Object.isFrozen(commit.graph) && Object.isFrozen(commit.componentFacts[0].fact));
assert.equal(commit.componentFacts.length, 6);
assert.equal(JSON.stringify(commit).includes("rawProviderEnvelope\""), false);
assert.equal(buildCommit().commitHash, commit.commitHash, "commit hash must be stable");
assert.doesNotThrow(() => validateUnifiedAtomicContentCommit(JSON.parse(JSON.stringify(commit))), "serialized commit must round-trip");

for (const [label, mutate] of [
  ["graph", (value) => { value.graph.graphHash = "0".repeat(64); }],
  ["assembly", (value) => { value.assemblyFact.factHash = "0".repeat(64); }],
  ["usage", (value) => { value.usageBinding.bindingHash = "0".repeat(64); }],
  ["explanation", (value) => { value.mechanismExplanation.explanationHash = "0".repeat(64); }],
  ["candidate", (value) => { value.candidate.candidateHash = "0".repeat(64); }]
]) {
  const invalid = structuredClone(commit);
  mutate(invalid);
  const candidate = label === "raw payload" ? invalid : rehash(invalid);
  assert.throws(() => validateUnifiedAtomicContentCommit(candidate), (error) => error.code?.startsWith("UNIFIED_ATOMIC_CONTENT_COMMIT"), label);
}
const forbidden = structuredClone(commit);
forbidden.componentFacts[0].fact.rawProviderEnvelope = { private: true };
assert.throws(() => validateUnifiedAtomicContentCommit(rehash(forbidden)), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_FORBIDDEN_PAYLOAD");
for (const [label, mutate] of [
  ["project ref", (value) => { value.contentProjectRef.hash = "0".repeat(64); }],
  ["graph fact ref", (value) => { value.graph.componentFactRefs[0].factRef.hash = "0".repeat(64); }],
  ["assembly component ref", (value) => { value.assemblyFact.componentFactRefs[0].componentRef.hash = "0".repeat(64); }],
  ["usage platform ref", (value) => { value.usageBinding.platformRunRef.hash = "0".repeat(64); }],
  ["candidate usage ref", (value) => { value.candidate.authority.usageBindingRef.hash = "0".repeat(64); }]
]) {
  const invalid = structuredClone(commit);
  mutate(invalid);
  assert.throws(() => validateUnifiedAtomicContentCommit(rehash(invalid)), (error) => error.code?.startsWith("UNIFIED_ATOMIC_CONTENT_COMMIT"), label);
}
for (let index = 0; index < commit.componentFacts.length; index += 1) {
  const invalid = structuredClone(commit);
  invalid.componentFacts[index].fact.factHash = "0".repeat(64);
  assert.throws(() => validateUnifiedAtomicContentCommit(rehash(invalid)), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_NESTED_CONTRACT_INVALID", `fact ${index}`);
}
for (const invalid of [null, 7, { ...commit, extra: true }, { ...commit, contract: "UnifiedContentCandidate@3.0" }]) {
  assert.throws(() => validateUnifiedAtomicContentCommit(invalid), (error) => error instanceof TypeError === false && error.code?.startsWith("UNIFIED_ATOMIC_CONTENT_COMMIT"));
}

const backing = { unifiedContentProjects: [{ id: "legacy-project" }] };
const store = createUnifiedAtomicContentCommitStore(backing);
assert.deepEqual(Object.keys(store).sort(), ["append", "getByCandidate", "getByCommit", "listByProject"]);
assert.deepEqual(store.listByProject("content-project"), []);
const beforeFailure = JSON.stringify(backing);
const invalidCommit = structuredClone(commit);
invalidCommit.commitHash = "0".repeat(64);
assert.throws(() => store.append(invalidCommit), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_HASH_MISMATCH");
assert.equal(JSON.stringify(backing), beforeFailure, "failed append must be zero-write");
const throwingBacking = {};
let throwingValues = [];
Object.defineProperty(throwingBacking, "unifiedAtomicContentCommits", {
  configurable: true, get: () => throwingValues, set: () => { throw new Error("fixture write failure"); }
});
assert.throws(() => createUnifiedAtomicContentCommitStore(throwingBacking).append(commit), /fixture write failure/);
assert.deepEqual(throwingValues, [], "exception during the single collection assignment must leave the prior collection unchanged");
const appended = store.append(commit);
assert.equal(backing.unifiedAtomicContentCommits.length, 1);
assert.deepEqual(backing.unifiedContentProjects, [{ id: "legacy-project" }]);
assert.equal(store.append(JSON.parse(JSON.stringify(commit))).commitHash, commit.commitHash);
assert.equal(backing.unifiedAtomicContentCommits.length, 1, "idempotent replay must not duplicate");
assert.equal(store.getByCommit(commit.id).commitHash, commit.commitHash);
assert.equal(store.getByCommit(commit.commitHash).id, commit.id);
assert.equal(store.getByCandidate(commit.candidate.id).commitHash, commit.commitHash);
assert.equal(store.getByCandidate(commit.candidate.candidateHash).id, commit.id);
assert.equal(store.listByProject(commit.contentProjectRef.hash).length, 1);
assert.ok(Object.isFrozen(appended) && Object.isFrozen(store.getByCommit(commit.id)) && Object.isFrozen(store.listByProject(commit.contentProjectRef.id)));
assert.throws(() => { store.getByCommit(commit.id).id = "mutated"; }, TypeError);

const sameKeyDifferent = rehash({ ...structuredClone(commit), id: "other-id" });
assert.throws(() => store.append(sameKeyDifferent), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_IDEMPOTENCY_CONFLICT");
const sameCandidateDifferent = rehash({ ...structuredClone(commit), id: "other-id", idempotencyKey: "other-key" });
assert.throws(() => store.append(sameCandidateDifferent), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_CANDIDATE_CONFLICT");
const otherAuthority = buildCommit({ suffix: "-other", accountId: "other-account", idempotencyKey: "other-authority-key" });
assert.throws(() => store.append(otherAuthority), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_AUTHORITY_CONFLICT");
assert.equal(backing.unifiedAtomicContentCommits.length, 1);

console.log("atomic-content-commit-store-self-test: ok");
