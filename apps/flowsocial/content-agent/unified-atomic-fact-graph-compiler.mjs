import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import {
  createValidatedComponentFact,
  createDeterministicCompilerInputRef,
  createDeterministicComponentFact,
  createDeterministicAssemblyFactV2,
  validateSkillActivityInvocation
} from "./unified-execution-contracts.mjs";
import {
  createXhsFinalTitleBinding,
  validateXhsPostCopy,
  validateXhsFinalTitleBinding,
  validateXhsCarouselPlanV2,
  validateXhsVisualAssetPlan,
  compileXhsTraceabilityV2,
  validateXhsTraceabilityV2,
  compileXhsContentPreflightV2,
  validateXhsContentPreflightReportV2,
  assembleXhsPostPackageV4,
  validateXhsPostPackageV4
} from "./xhs-content-components.mjs";

const HASH = /^[a-f0-9]{64}$/;
const BUNDLE_KEYS = [
  "schemaVersion", "contract", "id", "capability", "invocation",
  "rawProviderEnvelopeRef", "executionEvidence", "verifiedComponent", "bundleHash"
];
const GRAPH_KEYS = [
  "schemaVersion", "contract", "id", "authorityBinding", "activityRefs",
  "componentFactRefs", "titleUpstreamRef", "assemblyFactRef", "graphHash"
];
const CAPABILITY_REGISTRY = Object.freeze([
  Object.freeze({ capability: "write-xhs-post-copy", role: "postCopy", hashField: "componentHash", validator: validateXhsPostCopy, validatorName: "validateXhsPostCopy" }),
  Object.freeze({ capability: "plan-xhs-carousel", role: "carouselPlan", hashField: "componentHash", validator: validateXhsCarouselPlanV2, validatorName: "validateXhsCarouselPlanV2" }),
  Object.freeze({ capability: "plan-xhs-visual-assets", role: "visualAssetPlan", hashField: "componentHash", validator: validateXhsVisualAssetPlan, validatorName: "validateXhsVisualAssetPlan" })
]);
const ASSEMBLY_ROLES = Object.freeze(["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan", "traceability", "preflightReport"]);

function fail(code, message = code, details = null) {
  throw Object.assign(new Error(message), { code, statusCode: 409, details });
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function exact(value, keys) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function ref(value) {
  return exact(value, ["id", "hash"]) && typeof value.id === "string" && value.id && HASH.test(value.hash);
}

function sameHash(left, right, code) {
  if (left !== right) fail(code);
}

function withoutHash(value, field) {
  const copy = clone(value);
  delete copy[field];
  return copy;
}

export function validateUnifiedAtomicActivityBundle(value) {
  if (!exact(value, BUNDLE_KEYS)) fail("UNIFIED_ATOMIC_ACTIVITY_BUNDLE_INVALID", undefined, { fieldPaths: ["$"] });
  if (value.schemaVersion !== "1.0" || value.contract !== "UnifiedAtomicActivityBundle@1.0") fail("UNIFIED_ATOMIC_ACTIVITY_BUNDLE_INVALID");
  if (!CAPABILITY_REGISTRY.some((entry) => entry.capability === value.capability)) fail("UNIFIED_ATOMIC_ACTIVITY_CAPABILITY_INVALID");
  validateSkillActivityInvocation(value.invocation);
  if (value.invocation.skill.name !== value.capability) fail("UNIFIED_ATOMIC_ACTIVITY_INVOCATION_MISMATCH");
  if (!ref(value.rawProviderEnvelopeRef)) fail("UNIFIED_ATOMIC_ACTIVITY_RAW_REF_INVALID");
  if (value.executionEvidence?.outputHash !== value.rawProviderEnvelopeRef.hash) fail("UNIFIED_ATOMIC_ACTIVITY_OUTPUT_STALE");
  if (value.executionEvidence?.executionPlanHash !== value.invocation.planHash) fail("UNIFIED_ATOMIC_ACTIVITY_PLAN_STALE");
  if (!value.verifiedComponent || typeof value.verifiedComponent !== "object") fail("UNIFIED_ATOMIC_ACTIVITY_COMPONENT_REQUIRED");
  if (!HASH.test(value.bundleHash) || hashUnifiedContent(withoutHash(value, "bundleHash")) !== value.bundleHash) fail("UNIFIED_ATOMIC_ACTIVITY_BUNDLE_HASH_MISMATCH");
  return value;
}

function validateTitleFact(value) {
  if (value?.contract !== "UnifiedSkillOutputFact@1.0" || value?.capability !== "generate-platform-titles" || value?.platform !== "xiaohongshu") {
    fail("UNIFIED_ATOMIC_TITLE_FACT_REQUIRED");
  }
  if (hashUnifiedContent(withoutHash(value, "factHash")) !== value.factHash) fail("UNIFIED_ATOMIC_TITLE_FACT_STALE");
  if (hashUnifiedContent(value.runtimeOutput) !== value.outputHash || value.runtimeOutput?.status !== "success") fail("UNIFIED_ATOMIC_TITLE_OUTPUT_STALE");
}

function deterministic({ role, id, producerName, input, upstreamFacts, compiler, validator, validatorName, hashField, authorityBinding }) {
  const frozenInput = deepFreeze(clone(input));
  const inputRef = createDeterministicCompilerInputRef({ id: `atomic_compiler_input:${id}`, input: frozenInput, upstreamFacts, authorityBinding });
  return createDeterministicComponentFact({
    id: `atomic_component_fact:${id}`,
    producer: { name: producerName, version: "1.0.0", authorityBinding },
    input: frozenInput,
    inputRef,
    upstreamFacts,
    componentRole: role,
    compiler,
    validateComponent: validator,
    validator: { name: validatorName, version: "1.0.0" },
    componentHashField: hashField
  });
}

function graphRef(item) {
  return { id: item.id, hash: item.factHash || item.bundleHash };
}

export function compileUnifiedAtomicFactGraph({ activityBundles, compilerContexts, titleFact, orchestrationSnapshot }) {
  if (!Array.isArray(activityBundles) || activityBundles.length !== CAPABILITY_REGISTRY.length) fail("UNIFIED_ATOMIC_ACTIVITY_SET_INVALID");
  if (!Array.isArray(compilerContexts) || compilerContexts.length !== CAPABILITY_REGISTRY.length) fail("UNIFIED_ATOMIC_COMPILER_CONTEXT_SET_INVALID");
  validateTitleFact(titleFact);
  const bundles = activityBundles.map((item) => deepFreeze(clone(item)));
  const contexts = compilerContexts.map((item) => deepFreeze(clone(item)));
  const capabilities = bundles.map((item) => item.capability);
  if (new Set(capabilities).size !== capabilities.length || capabilities.some((item, index) => item !== CAPABILITY_REGISTRY[index].capability)) {
    fail("UNIFIED_ATOMIC_ACTIVITY_ORDER_INVALID");
  }

  const provider = {};
  let authorityHash = null;
  for (let index = 0; index < CAPABILITY_REGISTRY.length; index += 1) {
    const registry = CAPABILITY_REGISTRY[index];
    const bundle = bundles[index];
    const context = contexts[index];
    validateUnifiedAtomicActivityBundle(bundle);
    if (context.capability !== registry.capability || context.step?.capability !== registry.capability) fail("UNIFIED_ATOMIC_COMPILER_CONTEXT_MISMATCH");
    sameHash(hashUnifiedContent({ input: context.input, systemContext: context.systemContext }), bundle.invocation.inputRef.hash, "UNIFIED_ATOMIC_ACTIVITY_INPUT_STALE");
    sameHash(hashUnifiedContent(context.executionPlan), bundle.invocation.planHash, "UNIFIED_ATOMIC_ACTIVITY_PLAN_STALE");
    if (context.step.outputContract !== bundle.invocation.skill.version) fail("UNIFIED_ATOMIC_ACTIVITY_VERSION_STALE");
    registry.validator(bundle.verifiedComponent);
    authorityHash ||= bundle.invocation.authorityBinding.authorityHash;
    if (authorityHash !== bundle.invocation.authorityBinding.authorityHash) fail("UNIFIED_ATOMIC_CROSS_AUTHORITY_FORBIDDEN");
    provider[registry.role] = {
      component: bundle.verifiedComponent,
      fact: createValidatedComponentFact({
        id: `atomic_component_fact:${bundle.id}`,
        invocation: bundle.invocation,
        componentRole: registry.role,
        component: bundle.verifiedComponent,
        componentHashField: registry.hashField,
        validateComponent: registry.validator,
        validator: { name: registry.validatorName, version: "1.0.0" },
        rawProviderEnvelopeRef: bundle.rawProviderEnvelopeRef
      })
    };
  }

  const xhsRun = orchestrationSnapshot?.platformRuns?.find((item) => item.platform === "xiaohongshu");
  const artifacts = xhsRun?.xhsAtomicArtifacts;
  if (!artifacts || artifacts.package?.contract !== "XhsPostPackage@4.0") fail("UNIFIED_ATOMIC_ORCHESTRATION_ARTIFACTS_REQUIRED");
  const authorityBinding = provider.postCopy.fact.authorityBinding;
  const postContext = contexts[0];
  const visualContext = contexts[2];
  const contentMaster = postContext.input?.content_master?.contentMaster || postContext.input?.content_master;
  const confirmedOutline = postContext.input?.confirmed_outline;
  const authorizedReferenceAssets = visualContext.systemContext?.authorizedReferenceAssets || [];
  const frozenTitleFact = deepFreeze(clone(titleFact));
  const titleOutput = frozenTitleFact.runtimeOutput.data;

  const finalTitleUpstream = [
    { kind: "provider_component", role: "postCopy", fact: provider.postCopy.fact },
    { kind: "validated_skill_output", role: "titleOutput", fact: frozenTitleFact }
  ];
  const finalTitle = deterministic({
    role: "finalTitleBinding", id: artifacts.finalTitleBinding.id, producerName: "createXhsFinalTitleBinding",
    input: { postCopy: provider.postCopy.component, titleOutput, titleOutputRef: { id: artifacts.finalTitleBinding.titleOutputRef.id, hash: hashUnifiedContent(titleOutput) }, contentMaster },
    upstreamFacts: finalTitleUpstream, authorityBinding,
    compiler: ({ input }) => createXhsFinalTitleBinding({ id: artifacts.finalTitleBinding.id, ...input }),
    validator: validateXhsFinalTitleBinding, validatorName: "validateXhsFinalTitleBinding", hashField: "bindingHash"
  });
  sameHash(finalTitle.component.bindingHash, artifacts.finalTitleBinding.bindingHash, "UNIFIED_ATOMIC_FINAL_TITLE_COMPILER_DRIFT");

  const traceUpstream = [
    { kind: "provider_component", role: "postCopy", fact: provider.postCopy.fact },
    { kind: "deterministic_component", role: "finalTitleBinding", fact: finalTitle.fact },
    { kind: "provider_component", role: "carouselPlan", fact: provider.carouselPlan.fact },
    { kind: "provider_component", role: "visualAssetPlan", fact: provider.visualAssetPlan.fact }
  ];
  const traceability = deterministic({
    role: "traceability", id: artifacts.traceability.id, producerName: "compileXhsTraceabilityV2",
    input: { postCopy: provider.postCopy.component, finalTitleBinding: finalTitle.component, carouselPlan: provider.carouselPlan.component, visualAssetPlan: provider.visualAssetPlan.component, contentMaster, authorizedReferenceAssets },
    upstreamFacts: traceUpstream, authorityBinding,
    compiler: ({ input }) => compileXhsTraceabilityV2(input), validator: validateXhsTraceabilityV2, validatorName: "validateXhsTraceabilityV2", hashField: "traceHash"
  });
  sameHash(traceability.component.traceHash, artifacts.traceability.traceHash, "UNIFIED_ATOMIC_TRACE_COMPILER_DRIFT");

  const preflightUpstream = [...traceUpstream, { kind: "deterministic_component", role: "traceability", fact: traceability.fact }];
  const preflight = deterministic({
    role: "preflightReport", id: artifacts.preflightReport.id, producerName: "compileXhsContentPreflightV2",
    input: { postCopy: provider.postCopy.component, finalTitleBinding: finalTitle.component, carouselPlan: provider.carouselPlan.component, visualAssetPlan: provider.visualAssetPlan.component, traceability: traceability.component, contentMaster, confirmedOutline, authorizedReferenceAssets },
    upstreamFacts: preflightUpstream, authorityBinding,
    compiler: ({ input }) => compileXhsContentPreflightV2(input), validator: validateXhsContentPreflightReportV2, validatorName: "validateXhsContentPreflightReportV2", hashField: "reportHash"
  });
  sameHash(preflight.component.reportHash, artifacts.preflightReport.reportHash, "UNIFIED_ATOMIC_PREFLIGHT_COMPILER_DRIFT");

  const entries = [
    { role: "postCopy", ...provider.postCopy, componentHashField: "componentHash" },
    { role: "finalTitleBinding", fact: finalTitle.fact, component: finalTitle.component, componentHashField: "bindingHash" },
    { role: "carouselPlan", ...provider.carouselPlan, componentHashField: "componentHash" },
    { role: "visualAssetPlan", ...provider.visualAssetPlan, componentHashField: "componentHash" },
    { role: "traceability", fact: traceability.fact, component: traceability.component, componentHashField: "traceHash" },
    { role: "preflightReport", fact: preflight.fact, component: preflight.component, componentHashField: "reportHash" }
  ];
  const assembly = createDeterministicAssemblyFactV2({
    id: artifacts.package.id,
    componentEntries: entries,
    assemblySpec: { name: "assembleXhsPostPackageV4", version: "1.0.0", requiredRoles: ASSEMBLY_ROLES, outputContract: "XhsPostPackage@4.0" },
    assembler: ({ id, components }) => assembleXhsPostPackageV4({ id, ...components }),
    validateAssembly: validateXhsPostPackageV4,
    assemblyHashField: "packageHash"
  });
  sameHash(assembly.assemblyOutput.packageHash, artifacts.package.packageHash, "UNIFIED_ATOMIC_PACKAGE_ASSEMBLER_DRIFT");

  const factEntries = [
    ["postCopy", "provider_component", provider.postCopy.fact],
    ["finalTitleBinding", "deterministic_component", finalTitle.fact],
    ["carouselPlan", "provider_component", provider.carouselPlan.fact],
    ["visualAssetPlan", "provider_component", provider.visualAssetPlan.fact],
    ["traceability", "deterministic_component", traceability.fact],
    ["preflightReport", "deterministic_component", preflight.fact]
  ];
  const draft = {
    schemaVersion: "1.0", contract: "UnifiedAtomicFactGraph@1.0", id: `atomic_fact_graph:${xhsRun.platformRunRef.id}`,
    authorityBinding: clone(authorityBinding),
    activityRefs: bundles.map((item) => ({ capability: item.capability, bundleRef: graphRef(item) })),
    componentFactRefs: factEntries.map(([role, kind, fact]) => ({ role, kind, factRef: graphRef(fact), componentRef: clone(fact.componentRef) })),
    titleUpstreamRef: { id: frozenTitleFact.id, hash: frozenTitleFact.factHash },
    assemblyFactRef: graphRef(assembly.fact)
  };
  const graph = deepFreeze({ ...draft, graphHash: hashUnifiedContent(draft) });
  validateUnifiedAtomicFactGraph(graph);
  return deepFreeze({ graph, providerFacts: clone(provider), deterministicFacts: { finalTitle, traceability, preflight }, assembly });
}

export function validateUnifiedAtomicFactGraph(value) {
  if (!exact(value, GRAPH_KEYS)) fail("UNIFIED_ATOMIC_FACT_GRAPH_INVALID", undefined, { fieldPaths: ["$"] });
  if (value.schemaVersion !== "1.0" || value.contract !== "UnifiedAtomicFactGraph@1.0") fail("UNIFIED_ATOMIC_FACT_GRAPH_INVALID");
  if (!Array.isArray(value.activityRefs) || value.activityRefs.length !== 3 || value.activityRefs.some((item, index) => !exact(item, ["capability", "bundleRef"]) || item.capability !== CAPABILITY_REGISTRY[index].capability || !ref(item.bundleRef))) fail("UNIFIED_ATOMIC_FACT_GRAPH_ACTIVITY_REFS_INVALID");
  if (!Array.isArray(value.componentFactRefs) || value.componentFactRefs.length !== 6 || value.componentFactRefs.some((item, index) => !exact(item, ["role", "kind", "factRef", "componentRef"]) || item.role !== ASSEMBLY_ROLES[index] || !ref(item.factRef) || !ref(item.componentRef))) fail("UNIFIED_ATOMIC_FACT_GRAPH_COMPONENT_REFS_INVALID");
  if (!ref(value.titleUpstreamRef) || !ref(value.assemblyFactRef)) fail("UNIFIED_ATOMIC_FACT_GRAPH_REF_INVALID");
  if (JSON.stringify(value).includes("rawProviderEnvelope") || Object.hasOwn(value, "rawProviderEnvelope")) fail("UNIFIED_ATOMIC_FACT_GRAPH_RAW_PAYLOAD_FORBIDDEN");
  if (!HASH.test(value.graphHash) || hashUnifiedContent(withoutHash(value, "graphHash")) !== value.graphHash) fail("UNIFIED_ATOMIC_FACT_GRAPH_HASH_MISMATCH");
  return value;
}
