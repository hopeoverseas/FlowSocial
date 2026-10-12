import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  createAtomicUnifiedContentCandidateV2,
  createDeterministicAssemblyFactV2,
  createDeterministicCompilerInputRef,
  createDeterministicComponentFact,
  createExecutionAuthorityBinding,
  createSkillActivityInvocation,
  createValidatedComponentFact,
  validateDeterministicAssemblyFactV2,
  validateDeterministicComponentFact
} from "../../content-agent/unified-execution-contracts.mjs";
import { validateXhsPostPackageV4 } from "../../content-agent/xhs-content-components.mjs";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const ref = (id, character) => ({ id, hash: character.repeat(64) });
const legacyAuthority = {
  companyId: "company_fixture", accountId: "account_fixture",
  activeStrategySnapshotRef: ref("strategy", "1"), contentOpportunityRef: ref("opportunity", "2"),
  mechanismDecisionRef: ref("decision", "3"), contentProjectRef: ref("project", "4"),
  platformRunRef: ref("run", "5"), sharedContentMasterRef: ref("master", "6"),
  platformBriefRef: ref("brief", "7"), confirmedOutlineRef: ref("outline", "8"),
  writerContextRef: ref("context", "9"), designDnaRef: ref("dna", "a")
};
const authority = createExecutionAuthorityBinding({
  family: "atomic_v2", companyId: legacyAuthority.companyId, accountId: legacyAuthority.accountId,
  refs: Object.entries(legacyAuthority).filter(([, value]) => value && typeof value === "object").map(([role, value]) => ({ role, ref: value }))
});

function makeComponent({ id, contract, hashField = "componentHash", status = "ready", payload = {} }) {
  const draft = { schemaVersion: "1.0", contract, id, authorityBinding: structuredClone(legacyAuthority), status, payload: structuredClone(payload) };
  return deepFreeze({ ...draft, [hashField]: hashUnifiedContent(draft) });
}

function validateFixtureComponent(value, hashField = "componentHash") {
  const keys = ["schemaVersion", "contract", "id", "authorityBinding", "status", "payload", hashField];
  const copy = structuredClone(value);
  const expectedHash = copy?.[hashField];
  if (copy) delete copy[hashField];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key)) || value.schemaVersion !== "1.0" || hashUnifiedContent(copy) !== expectedHash) throw new Error("fixture component invalid");
  return value;
}

function makeProviderFact(role, component, index) {
  const invocation = createSkillActivityInvocation({
    id: `invocation-${role}`, skill: { name: `skill-${role}`, version: "1.0.0" }, inputRef: ref(`input-${role}`, String(index + 1)),
    authorityBinding: authority, planHash: "b".repeat(64)
  });
  return createValidatedComponentFact({
    id: `fact-${role}`, invocation, componentRole: role, component, componentHashField: "componentHash",
    validateComponent: validateFixtureComponent, validator: { name: "validateFixtureComponent", version: "1.0.0" }, rawProviderEnvelopeRef: ref(`raw-${role}`, "c")
  });
}

const postCopy = makeComponent({ id: "post-copy", contract: "XhsPostCopy@1.0", payload: { title: "fixture" } });
const carouselPlan = makeComponent({ id: "carousel", contract: "XhsCarouselPlan@2.0", payload: { pages: 6 } });
const visualAssetPlan = makeComponent({ id: "visual", contract: "XhsVisualAssetPlan@1.0", payload: { assets: 1 } });
const providerFacts = {
  postCopy: makeProviderFact("postCopy", postCopy, 0),
  carouselPlan: makeProviderFact("carouselPlan", carouselPlan, 1),
  visualAssetPlan: makeProviderFact("visualAssetPlan", visualAssetPlan, 2)
};

const titleRuntimeOutput = { status: "success", data: { recommendations: { balanced: "title-1" }, candidates: [{ title_id: "title-1", title: "fixture" }] }, warnings: [], blocked_reasons: [] };
const titleFactBase = {
  schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: "title-output-fact",
  invocationRef: ref("title-invocation", "d"), executionRecordRef: ref("title-record", "e"), platform: "xiaohongshu",
  stepId: "platform_titles", capability: "generate-platform-titles", inputContract: "PlatformTitleInput@1.0", outputContract: "PlatformTitleList@1.0",
  planRef: ref("title-plan", "f"), bundleHash: "0".repeat(64), inputHash: "1".repeat(64), outputHash: hashUnifiedContent(titleRuntimeOutput),
  runtimeOutput: titleRuntimeOutput, verifiedDomainOutput: null, executionMode: "real", status: "completed", productionEligibleOutput: true
};
const titleFact = deepFreeze({ ...titleFactBase, factHash: hashUnifiedContent(titleFactBase) });

const producer = (name) => ({ name, version: "1.0.0", authorityBinding: authority });
const compilerCounts = { finalTitleBinding: 0, traceability: 0, preflightReport: 0 };

function compileDeterministic({ id, role, contract, hashField, input, upstreamFacts, status = "ready" }) {
  const inputRef = createDeterministicCompilerInputRef({ id: `compiler-input-${role}`, input, upstreamFacts, authorityBinding: authority });
  return createDeterministicComponentFact({
    id: `fact-${role}`, producer: producer(`compile-${role}`), input, inputRef, upstreamFacts, componentRole: role,
    compiler: ({ input: frozenInput, upstreamFacts: frozenFacts }) => {
      compilerCounts[role] += 1;
      assert.ok(Object.isFrozen(frozenInput) && Object.isFrozen(frozenFacts));
      return makeComponent({ id, contract, hashField, status, payload: { inputHash: hashUnifiedContent(frozenInput), upstreamCount: frozenFacts.length } });
    },
    validateComponent: (value) => validateFixtureComponent(value, hashField), validator: { name: `validate-${role}`, version: "1.0.0" }, componentHashField: hashField
  });
}

const finalTitleInput = deepFreeze({ recommendation: "balanced" });
const finalTitleUpstream = [
  { kind: "provider_component", role: "post_copy", fact: providerFacts.postCopy },
  { kind: "validated_skill_output", role: "title_output", fact: titleFact }
];
const finalTitle = compileDeterministic({ id: "final-title", role: "finalTitleBinding", contract: "XhsFinalTitleBinding@1.0", hashField: "bindingHash", input: finalTitleInput, upstreamFacts: finalTitleUpstream });

const traceInput = deepFreeze({ mode: "deterministic_trace" });
const traceUpstream = [
  { kind: "provider_component", role: "post_copy", fact: providerFacts.postCopy },
  { kind: "deterministic_component", role: "final_title", fact: finalTitle.fact },
  { kind: "provider_component", role: "carousel", fact: providerFacts.carouselPlan },
  { kind: "provider_component", role: "visual", fact: providerFacts.visualAssetPlan }
];
const traceability = compileDeterministic({ id: "trace", role: "traceability", contract: "XhsTraceability@2.0", hashField: "traceHash", input: traceInput, upstreamFacts: traceUpstream });

const preflightInput = deepFreeze({ mode: "deterministic_preflight" });
const preflightUpstream = [...traceUpstream, { kind: "deterministic_component", role: "trace", fact: traceability.fact }];
const preflightReport = compileDeterministic({ id: "preflight", role: "preflightReport", contract: "XhsContentPreflightReport@2.0", hashField: "reportHash", input: preflightInput, upstreamFacts: preflightUpstream, status: "passed" });
assert.deepEqual(compilerCounts, { finalTitleBinding: 1, traceability: 1, preflightReport: 1 }, "each deterministic compiler must execute inside its factory exactly once");
assert.ok(Object.isFrozen(finalTitle.fact) && Object.isFrozen(finalTitle.component) && Object.isFrozen(finalTitle.fact.upstreamFactRefs));
assert.deepEqual(Object.keys(finalTitle.fact).includes("invocationRef"), false);
assert.deepEqual(Object.keys(finalTitle.fact).includes("audit"), false);

const localeUpstream = [
  { kind: "validated_skill_output", role: "标题", fact: titleFact },
  { kind: "provider_component", role: "A", fact: providerFacts.postCopy }
];
const localeInput = deepFreeze({ locale: "stable" });
const localeRefA = createDeterministicCompilerInputRef({ id: "locale-input", input: localeInput, upstreamFacts: localeUpstream, authorityBinding: authority });
const localeRefB = createDeterministicCompilerInputRef({ id: "locale-input", input: localeInput, upstreamFacts: [...localeUpstream].reverse(), authorityBinding: authority });
assert.equal(localeRefA.hash, localeRefB.hash, "upstream ordering must be stable across locale and caller order");
assert.throws(
  () => createDeterministicCompilerInputRef({ id: "title-only", input: localeInput, upstreamFacts: [{ kind: "validated_skill_output", role: "title_output", fact: titleFact }], authorityBinding: authority }),
  (error) => error.details.fieldPaths.includes("input.upstreamFacts.authorityBound"),
  "a deterministic component must have at least one authority-bound upstream"
);

const requiredRoles = ["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan", "traceability", "preflightReport"];
const entries = [
  { role: "postCopy", fact: providerFacts.postCopy, component: postCopy, componentHashField: "componentHash" },
  { role: "finalTitleBinding", fact: finalTitle.fact, component: finalTitle.component, componentHashField: "bindingHash" },
  { role: "carouselPlan", fact: providerFacts.carouselPlan, component: carouselPlan, componentHashField: "componentHash" },
  { role: "visualAssetPlan", fact: providerFacts.visualAssetPlan, component: visualAssetPlan, componentHashField: "componentHash" },
  { role: "traceability", fact: traceability.fact, component: traceability.component, componentHashField: "traceHash" },
  { role: "preflightReport", fact: preflightReport.fact, component: preflightReport.component, componentHashField: "reportHash" }
];
const hashFields = { postCopy: "componentHash", finalTitleBinding: "bindingHash", carouselPlan: "componentHash", visualAssetPlan: "componentHash", traceability: "traceHash", preflightReport: "reportHash" };
let assemblerCalls = 0;
function assemblePackage({ id, components }) {
  assemblerCalls += 1;
  const draft = {
    schemaVersion: "4.0", contract: "XhsPostPackage@4.0", id, authorityBinding: structuredClone(legacyAuthority),
    componentRefs: Object.fromEntries(requiredRoles.map((role) => [role, { id: components[role].id, hash: components[role][hashFields[role]] }])),
    assembly: { mode: "deterministic_component_assembly", status: "assembled", providerAuthored: false, mutable: false }
  };
  return deepFreeze({ ...draft, packageHash: hashUnifiedContent(draft) });
}
const assemblySpec = { name: "assemble-xhs-post-package-v4", version: "1.0.0", requiredRoles: [...requiredRoles].reverse(), outputContract: "XhsPostPackage@4.0" };
const assembly = createDeterministicAssemblyFactV2({
  id: "assembly-v2", componentEntries: entries, assemblySpec, assembler: assemblePackage,
  validateAssembly: validateXhsPostPackageV4, assemblyHashField: "packageHash",
  assemblyOutput: deepFreeze({ contract: "XhsPostPackage@4.0", id: "caller-forgery" })
});
assert.equal(assemblerCalls, 1, "factory must execute the assembler and ignore any caller-supplied preconstructed output field");
assert.equal(assembly.assemblyOutput.id, "assembly-v2");
assert.ok(Object.isFrozen(assembly.fact) && Object.isFrozen(assembly.assemblyOutput));
validateDeterministicAssemblyFactV2(assembly.fact);
assert.deepEqual(assembly.fact.componentFactRefs.map((item) => item.kind).sort(), ["deterministic_component", "deterministic_component", "deterministic_component", "provider_component", "provider_component", "provider_component"]);
assert.equal(createDeterministicAssemblyFactV2({ id: "assembly-v2", componentEntries: [...entries].reverse(), assemblySpec, assembler: assemblePackage, validateAssembly: validateXhsPostPackageV4, assemblyHashField: "packageHash" }).fact.factHash, assembly.fact.factHash);
assert.throws(
  () => createDeterministicAssemblyFactV2({
    id: "assembly-extra-ref", componentEntries: entries, assemblySpec,
    assembler: (context) => {
      const output = structuredClone(assemblePackage(context));
      output.componentRefs.extraRole = ref("extra-component", "5");
      delete output.packageHash;
      output.packageHash = hashUnifiedContent(output);
      return deepFreeze(output);
    },
    validateAssembly: () => true, assemblyHashField: "packageHash"
  }),
  (error) => error.details.fieldPaths.includes("input.assembler.result.componentRefs"),
  "Assembly v2 must reject extra Package componentRef keys without relying on the injected validator"
);

const validatorCases = [
  ["deterministic component", validateDeterministicComponentFact, finalTitle.fact, "factHash"],
  ["assembly v2", validateDeterministicAssemblyFactV2, assembly.fact, "factHash"]
];
for (const [name, validator, source, hashField] of validatorCases) {
  for (const shape of ["missing", "extra", "null", "primitive"]) {
    let value;
    if (shape === "null") value = null;
    else if (shape === "primitive") value = 9;
    else {
      value = structuredClone(source);
      if (shape === "missing") delete value.schemaVersion;
      else value.privateSecret = "DO_NOT_ECHO";
    }
    assert.throws(() => validator(value), (error) => error.code === "UNIFIED_EXECUTION_CONTRACT_INVALID" && error.details.fieldPaths.includes("$") && !JSON.stringify(error.details).includes("DO_NOT_ECHO"), `${name} ${shape} must fail safely`);
  }
  const tampered = structuredClone(source);
  tampered[hashField] = "f".repeat(64);
  assert.throws(() => validator(tampered), (error) => error.details.fieldPaths.includes(`$.${hashField}`));
}

for (const [label, compiler] of [
  ["throw", () => { throw new Error("private compiler failure"); }], ["false", () => false], ["null", () => null], ["other", () => deepFreeze({ unrelated: true })]
]) {
  const input = deepFreeze({ failure: label });
  const inputRef = createDeterministicCompilerInputRef({ id: `failure-${label}`, input, upstreamFacts: finalTitleUpstream, authorityBinding: authority });
  assert.throws(
    () => createDeterministicComponentFact({ id: `failure-${label}`, producer: producer("compiler"), input, inputRef, upstreamFacts: finalTitleUpstream, componentRole: "finalTitleBinding", compiler, validateComponent: validateFixtureComponent, validator: { name: "validator", version: "1" }, componentHashField: "bindingHash" }),
    (error) => error.details.fieldPaths.some((path) => path.startsWith("input.compiler.result")) && !JSON.stringify(error.details).includes("private compiler failure")
  );
}
for (const result of [false, null, undefined, {}]) {
  const input = deepFreeze({ validator: String(result) });
  const inputRef = createDeterministicCompilerInputRef({ id: `validator-${String(result)}`, input, upstreamFacts: finalTitleUpstream, authorityBinding: authority });
  assert.throws(
    () => createDeterministicComponentFact({ id: "validator-failure", producer: producer("compiler"), input, inputRef, upstreamFacts: finalTitleUpstream, componentRole: "finalTitleBinding", compiler: () => makeComponent({ id: "validator-component", contract: "XhsFinalTitleBinding@1.0", hashField: "bindingHash" }), validateComponent: () => result, validator: { name: "validator", version: "1" }, componentHashField: "bindingHash" }),
    (error) => error.details.fieldPaths.includes("input.validateComponent.result")
  );
}

const arbitraryFactDraft = { contract: "ArbitraryFact@1.0", id: "arbitrary" };
const arbitraryFact = deepFreeze({ ...arbitraryFactDraft, factHash: hashUnifiedContent(arbitraryFactDraft) });
assert.throws(() => createDeterministicCompilerInputRef({ id: "arbitrary", input: finalTitleInput, upstreamFacts: [{ kind: "validated_skill_output", role: "title_output", fact: arbitraryFact }], authorityBinding: authority }), (error) => error.details.fieldPaths.includes("$"));
const staleTitleFact = structuredClone(titleFact);
staleTitleFact.outputHash = "f".repeat(64);
delete staleTitleFact.factHash;
staleTitleFact.factHash = hashUnifiedContent(staleTitleFact);
deepFreeze(staleTitleFact);
assert.throws(() => createDeterministicCompilerInputRef({ id: "stale-title", input: finalTitleInput, upstreamFacts: [{ kind: "validated_skill_output", role: "title_output", fact: staleTitleFact }], authorityBinding: authority }), (error) => error.details.fieldPaths.includes("$.outputHash"));

function assertAssemblyRejected(label, changedEntries, expectedPath, spec = assemblySpec) {
  assert.throws(
    () => createDeterministicAssemblyFactV2({ id: label, componentEntries: changedEntries, assemblySpec: spec, assembler: assemblePackage, validateAssembly: validateXhsPostPackageV4, assemblyHashField: "packageHash" }),
    (error) => error.details.fieldPaths.includes(expectedPath), label
  );
}
assertAssemblyRejected("missing-role", entries.slice(0, -1), "input.componentEntries.roles");
assertAssemblyRejected("extra-role", [...entries, { ...entries[0], role: "extraRole" }], "input.componentEntries[].role");
assertAssemblyRejected("duplicate-role", [...entries.slice(0, -1), entries[0]], "input.componentEntries.roles");
const staleComponent = structuredClone(postCopy);
staleComponent.payload.title = "tampered";
deepFreeze(staleComponent);
assertAssemblyRejected("stale-component", [{ ...entries[0], component: staleComponent }, ...entries.slice(1)], "input.componentEntries[].component.hash");
const staleRefFact = structuredClone(providerFacts.postCopy);
staleRefFact.componentRef.id = "stale-post-copy-ref";
delete staleRefFact.factHash;
staleRefFact.factHash = hashUnifiedContent(staleRefFact);
deepFreeze(staleRefFact);
assertAssemblyRejected("stale-ref", [{ ...entries[0], fact: staleRefFact }, ...entries.slice(1)], "input.componentEntries[].component.ref");
const otherLegacyAuthority = { ...structuredClone(legacyAuthority), accountId: "other-account" };
const otherAuthority = createExecutionAuthorityBinding({
  family: "atomic_v2", companyId: otherLegacyAuthority.companyId, accountId: otherLegacyAuthority.accountId,
  refs: Object.entries(otherLegacyAuthority).filter(([, value]) => value && typeof value === "object").map(([role, value]) => ({ role, ref: value }))
});
const otherCarouselDraft = { schemaVersion: "1.0", contract: "XhsCarouselPlan@2.0", id: "other-carousel", authorityBinding: otherLegacyAuthority, status: "ready", payload: { pages: 6 } };
const otherCarousel = deepFreeze({ ...otherCarouselDraft, componentHash: hashUnifiedContent(otherCarouselDraft) });
const otherInvocation = createSkillActivityInvocation({ id: "other-invocation", skill: { name: "other-carousel", version: "1" }, inputRef: ref("other-input", "3"), authorityBinding: otherAuthority, planHash: "b".repeat(64) });
const otherCarouselFact = createValidatedComponentFact({ id: "other-carousel-fact", invocation: otherInvocation, componentRole: "carouselPlan", component: otherCarousel, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validateFixtureComponent", version: "1" } });
assertAssemblyRejected("cross-authority", [entries[0], { ...entries[1] }, { ...entries[2], fact: otherCarouselFact, component: otherCarousel }, ...entries.slice(3)], "input.componentEntries.authorityBinding");
const otherDeterministicInput = deepFreeze({ authority: "other" });
const otherProviderUpstream = [{ kind: "provider_component", role: "carousel", fact: otherCarouselFact }];
const otherDeterministicInputRef = createDeterministicCompilerInputRef({ id: "other-deterministic-input", input: otherDeterministicInput, upstreamFacts: otherProviderUpstream, authorityBinding: otherAuthority });
const otherDeterministic = createDeterministicComponentFact({
  id: "other-deterministic-fact", producer: { name: "other-compiler", version: "1", authorityBinding: otherAuthority },
  input: otherDeterministicInput, inputRef: otherDeterministicInputRef, upstreamFacts: otherProviderUpstream, componentRole: "otherTrace",
  compiler: () => {
    const draft = { schemaVersion: "1.0", contract: "OtherTrace@1.0", id: "other-trace", authorityBinding: structuredClone(otherLegacyAuthority), status: "ready", payload: {} };
    return deepFreeze({ ...draft, traceHash: hashUnifiedContent(draft) });
  },
  validateComponent: (value) => validateFixtureComponent(value, "traceHash"), validator: { name: "validateOtherTrace", version: "1" }, componentHashField: "traceHash"
});
let crossAuthorityCompilerCalls = 0;
for (const [label, mismatchedUpstream] of [
  ["provider", otherProviderUpstream],
  ["deterministic", [{ kind: "deterministic_component", role: "other_trace", fact: otherDeterministic.fact }]]
]) {
  const crossInput = deepFreeze({ mismatch: label });
  const crossInputRef = createDeterministicCompilerInputRef({ id: `cross-${label}`, input: crossInput, upstreamFacts: mismatchedUpstream, authorityBinding: otherAuthority });
  assert.throws(
    () => createDeterministicComponentFact({
      id: `cross-${label}`, producer: producer("main-authority-compiler"), input: crossInput, inputRef: crossInputRef, upstreamFacts: mismatchedUpstream,
      componentRole: "forbidden", compiler: () => { crossAuthorityCompilerCalls += 1; return postCopy; }, validateComponent: validateFixtureComponent,
      validator: { name: "validateFixtureComponent", version: "1" }, componentHashField: "componentHash"
    }),
    (error) => error.details.fieldPaths.includes("input.upstreamFacts.authorityBinding"),
    `cross-authority ${label} upstream must fail before compiler execution`
  );
}
assert.equal(crossAuthorityCompilerCalls, 0, "authority mismatch must stop before any compiler call");
assert.throws(() => createDeterministicAssemblyFactV2({ id: "package2", componentEntries: entries, assemblySpec: { ...assemblySpec, outputContract: "XhsPostPackage@2.0" }, assembler: assemblePackage, validateAssembly: validateXhsPostPackageV4, assemblyHashField: "packageHash" }), (error) => error.details.fieldPaths.includes("input.assemblySpec"));
const package2Component = makeComponent({ id: "legacy-package", contract: "XhsPostPackage@2.0" });
const package2Invocation = createSkillActivityInvocation({ id: "package2-invocation", skill: { name: "legacy-writer", version: "1" }, inputRef: ref("package2-input", "4"), authorityBinding: authority, planHash: "b".repeat(64) });
const package2Fact = createValidatedComponentFact({ id: "package2-fact", invocation: package2Invocation, componentRole: "postCopy", component: package2Component, componentHashField: "componentHash", validateComponent: validateFixtureComponent, validator: { name: "validateFixtureComponent", version: "1" } });
assertAssemblyRejected("package2-component", [{ ...entries[0], fact: package2Fact, component: package2Component }, ...entries.slice(1)], "input.componentEntries[].componentOnly");
assertAssemblyRejected("skill-fact-entry", [{ ...entries[0], fact: titleFact }, ...entries.slice(1)], "input.componentEntries[].fact.contract");
const monolithicWriterFact = structuredClone(titleFact);
monolithicWriterFact.capability = "write-xhs-content";
delete monolithicWriterFact.factHash;
monolithicWriterFact.factHash = hashUnifiedContent(monolithicWriterFact);
deepFreeze(monolithicWriterFact);
assertAssemblyRejected("monolithic-writer-fact", [{ ...entries[0], fact: monolithicWriterFact }, ...entries.slice(1)], "input.componentEntries[].fact.contract");

for (const [label, badAssembler] of [
  ["throw", () => { throw new Error("private assembler failure"); }], ["false", () => false], ["null", () => null], ["other", () => deepFreeze({ unrelated: true })]
]) {
  assert.throws(
    () => createDeterministicAssemblyFactV2({ id: `assembler-${label}`, componentEntries: entries, assemblySpec, assembler: badAssembler, validateAssembly: validateXhsPostPackageV4, assemblyHashField: "packageHash" }),
    (error) => error.details.fieldPaths.some((path) => path.startsWith("input.assembler.result")) && !JSON.stringify(error.details).includes("private assembler failure")
  );
}
for (const result of [false, null, undefined, {}]) {
  assert.throws(
    () => createDeterministicAssemblyFactV2({ id: `assembly-validator-${String(result)}`, componentEntries: entries, assemblySpec, assembler: assemblePackage, validateAssembly: () => result, assemblyHashField: "packageHash" }),
    (error) => error.details.fieldPaths.includes("input.validateAssembly.result")
  );
}

const failedPreflightInput = deepFreeze({ mode: "failed" });
const failedPreflight = compileDeterministic({ id: "failed-preflight", role: "preflightReport", contract: "XhsContentPreflightReport@2.0", hashField: "reportHash", input: failedPreflightInput, upstreamFacts: preflightUpstream, status: "failed" });
assertAssemblyRejected("failed-preflight", [...entries.slice(0, -1), { role: "preflightReport", fact: failedPreflight.fact, component: failedPreflight.component, componentHashField: "reportHash" }], "input.componentEntries.preflight");
assert.throws(() => createAtomicUnifiedContentCandidateV2({ id: "candidate-must-remain-v1", platformRunRef: ref("platform-run", "2"), assemblyFact: assembly.fact }), "Candidate@2 must remain bound to the unchanged AssemblyFact v1 contract");

assert.deepEqual(finalTitleInput, { recommendation: "balanced" });
assert.deepEqual(traceInput, { mode: "deterministic_trace" });
assert.deepEqual(preflightInput, { mode: "deterministic_preflight" });

export const DETERMINISTIC_FACT_GRAPH_SELF_TEST_CLAIMS = Object.freeze({ providerCalls: 0, externalCalls: 0, databaseWrites: 0, browserCalls: 0, platformWrites: 0, serverChanges: 0, orchestratorChanges: 0 });
console.log("deterministic-fact-graph-self-test: ok");
