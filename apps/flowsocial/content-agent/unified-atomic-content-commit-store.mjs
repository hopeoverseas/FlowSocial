import {
  hashUnifiedContent,
  validateContentProject,
  validateContentMechanismUsageBinding,
  validateMechanismExplanation
} from "./unified-content-contracts.mjs";
import {
  validateDeterministicAssemblyFactV2,
  validateDeterministicComponentFact,
  validateUnifiedContentCandidateV3,
  validateValidatedComponentFact
} from "./unified-execution-contracts.mjs";
import { validateUnifiedAtomicFactGraph } from "./unified-atomic-fact-graph-compiler.mjs";
import {
  validateXhsPostCopy,
  validateXhsFinalTitleBinding,
  validateXhsCarouselPlanV2,
  validateXhsVisualAssetPlan,
  validateXhsTraceabilityV2,
  validateXhsContentPreflightReportV2,
  validateXhsPostPackageV4
} from "./xhs-content-components.mjs";
import { validateUnifiedAtomicWechatContentCommit } from "./unified-atomic-wechat-commit.mjs";

const CONTRACT = "UnifiedAtomicContentCommit@1.0";
const MATERIALIZED_CONTRACT = "UnifiedAtomicContentCommit@2.0";
const WECHAT_CONTRACT = "UnifiedAtomicWechatContentCommit@1.0";
const HASH = /^[a-f0-9]{64}$/;
const ROLES = Object.freeze(["postCopy", "finalTitleBinding", "carouselPlan", "visualAssetPlan", "traceability", "preflightReport"]);
const ROOT_KEYS = Object.freeze([
  "schemaVersion", "contract", "id", "companyId", "accountId", "platform", "contentProjectRef", "platformRunRef",
  "graph", "componentFacts", "assemblyFact", "usageBinding", "mechanismExplanation", "candidate", "idempotencyKey", "commitHash"
]);
const INPUT_KEYS = Object.freeze([
  "id", "idempotencyKey", "contentProjectRef", "platform", "graph", "componentFacts", "assemblyFact", "usageBinding", "mechanismExplanation", "candidate"
]);
const MATERIALIZED_ROOT_KEYS = Object.freeze([
  "schemaVersion", "contract", "id", "companyId", "accountId", "platform", "contentProjectRef", "platformRunRef",
  "contentProjectIdentity", "contentProject", "materializedContentProjectRef", "graph", "componentFacts", "materializedComponents", "assemblyFact", "assemblyOutput",
  "usageBinding", "mechanismExplanation", "candidate", "idempotencyKey", "commitHash"
]);
const MATERIALIZED_INPUT_KEYS = Object.freeze([
  "id", "idempotencyKey", "contentProjectIdentity", "contentProject", "platform", "graph", "componentFacts", "materializedComponents",
  "assemblyFact", "assemblyOutput", "usageBinding", "mechanismExplanation", "candidate"
]);
const MATERIALIZED_REGISTRY = Object.freeze([
  Object.freeze({ role: "postCopy", kind: "provider_component", contract: "XhsPostCopy@1.0", hashField: "componentHash", validator: validateXhsPostCopy }),
  Object.freeze({ role: "finalTitleBinding", kind: "deterministic_component", contract: "XhsFinalTitleBinding@1.0", hashField: "bindingHash", validator: validateXhsFinalTitleBinding }),
  Object.freeze({ role: "carouselPlan", kind: "provider_component", contract: "XhsCarouselPlan@2.0", hashField: "componentHash", validator: validateXhsCarouselPlanV2 }),
  Object.freeze({ role: "visualAssetPlan", kind: "provider_component", contract: "XhsVisualAssetPlan@1.0", hashField: "componentHash", validator: validateXhsVisualAssetPlan }),
  Object.freeze({ role: "traceability", kind: "deterministic_component", contract: "XhsTraceability@2.0", hashField: "traceHash", validator: validateXhsTraceabilityV2 }),
  Object.freeze({ role: "preflightReport", kind: "deterministic_component", contract: "XhsContentPreflightReport@2.0", hashField: "reportHash", validator: validateXhsContentPreflightReportV2 })
]);
const FORBIDDEN_KEYS = new Set([
  "rawProviderEnvelope", "rawProviderPayload", "providerPayload", "apiKey", "appSecret", "accessToken", "refreshToken",
  "uploadMaterial", "uploadMaterials", "uploadedFile", "uploadedFiles", "binary", "bytes", "mutableProjection"
]);
const MATERIALIZED_FORBIDDEN_KEYS = new Set([
  ...FORBIDDEN_KEYS, "secret", "secrets", "buffer",
  "tempUrl", "temporaryUrl", "signedUrl", "presignedUrl", "mutableProjection", "providerEnvelope", "providerResponse",
  "providerMetadata", "unvalidatedProviderMetadata"
]);

function fail(code, fieldPaths = []) {
  throw Object.assign(new Error(code), { code, statusCode: 409, details: { fieldPaths: [...new Set(fieldPaths)] } });
}

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exact(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function text(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function ref(value) {
  return exact(value, ["id", "hash"]) && text(value.id) && HASH.test(value.hash || "");
}

function sameRef(left, right) {
  return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash;
}

function clone(value) {
  try { return structuredClone(value); }
  catch { fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INVALID", ["$"]); }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function withoutHash(value, field = "commitHash") {
  const copy = clone(value);
  delete copy[field];
  return copy;
}

function authorityRef(authority, role) {
  return authority?.refs?.find((item) => item.role === role)?.ref || null;
}

function validateNoForbiddenPayload(value, path = "$", seen = new WeakSet(), allowSharedReferences = false, forbiddenKeys = FORBIDDEN_KEYS) {
  if (!value || typeof value !== "object") return;
  if (allowSharedReferences && (value instanceof ArrayBuffer || ArrayBuffer.isView(value)
    || (typeof Blob !== "undefined" && value instanceof Blob))) {
    fail("UNIFIED_ATOMIC_CONTENT_COMMIT_FORBIDDEN_PAYLOAD", [path]);
  }
  if (seen.has(value)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INVALID", [path]);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoForbiddenPayload(item, `${path}[${index}]`, seen, allowSharedReferences, forbiddenKeys));
    if (allowSharedReferences) seen.delete(value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_FORBIDDEN_PAYLOAD", [`${path}.${key}`]);
    validateNoForbiddenPayload(child, `${path}.${key}`, seen, allowSharedReferences, forbiddenKeys);
  }
  if (allowSharedReferences) seen.delete(value);
}

function calculatedCommitHash(value) {
  try { return hashUnifiedContent(withoutHash(value)); }
  catch { fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INVALID", ["$"]); }
}

function safeValidate(path, validator, value) {
  try {
    validator(value);
  } catch {
    fail("UNIFIED_ATOMIC_CONTENT_COMMIT_NESTED_CONTRACT_INVALID", [path]);
  }
}

function sameValue(left, right) {
  try { return hashUnifiedContent(left) === hashUnifiedContent(right); }
  catch { return false; }
}

function declaredRef(value, hashField) {
  return { id: value?.id, hash: value?.[hashField] };
}

function bareRef(value) {
  return { id: value?.id, hash: value?.hash };
}

function componentAuthority(value) {
  return value.materializedComponents?.[0]?.component?.authorityBinding || null;
}

function validateContentProjectIdentity(value) {
  if (!exact(value, ["id", "companyId", "contentOpportunityRef", "activeStrategySnapshotRef", "identityHash"])
    || !text(value.id) || !text(value.companyId) || !ref(value.contentOpportunityRef) || !ref(value.activeStrategySnapshotRef)
    || !HASH.test(value.identityHash || "") || hashUnifiedContent(withoutHash(value, "identityHash")) !== value.identityHash) {
    fail("UNIFIED_ATOMIC_CONTENT_PROJECT_IDENTITY_INVALID", ["$.contentProjectIdentity"]);
  }
}

function validateComponentFactSet(componentFacts, graph, assemblyFact, authorityHash) {
  if (!Array.isArray(componentFacts) || componentFacts.length !== ROLES.length) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_COMPONENT_FACTS_INVALID", ["$.componentFacts"]);
  const graphRefs = graph.componentFactRefs || [];
  const assemblyRefs = assemblyFact.componentFactRefs || [];
  for (let index = 0; index < ROLES.length; index += 1) {
    const role = ROLES[index];
    const entry = componentFacts[index];
    const graphEntry = graphRefs[index];
    const assemblyEntry = assemblyRefs.find((item) => item.role === role);
    if (!exact(entry, ["role", "kind", "fact"]) || entry.role !== role || entry.kind !== graphEntry?.kind) {
      fail("UNIFIED_ATOMIC_CONTENT_COMMIT_COMPONENT_FACTS_INVALID", [`$.componentFacts[${index}]`]);
    }
    if (entry.kind === "provider_component") safeValidate(`$.componentFacts[${index}].fact`, validateValidatedComponentFact, entry.fact);
    else if (entry.kind === "deterministic_component") safeValidate(`$.componentFacts[${index}].fact`, validateDeterministicComponentFact, entry.fact);
    else fail("UNIFIED_ATOMIC_CONTENT_COMMIT_COMPONENT_FACTS_INVALID", [`$.componentFacts[${index}].kind`]);
    const factRef = { id: entry.fact.id, hash: entry.fact.factHash };
    if (entry.fact.componentRole !== role
      || entry.fact.authorityBinding?.authorityHash !== authorityHash
      || !sameRef(graphEntry?.factRef, factRef)
      || !sameRef(graphEntry?.componentRef, entry.fact.componentRef)
      || !sameRef(assemblyEntry?.factRef, factRef)
      || !sameRef(assemblyEntry?.componentRef, entry.fact.componentRef)
      || assemblyEntry?.kind !== entry.kind) {
      fail("UNIFIED_ATOMIC_CONTENT_COMMIT_COMPONENT_CLOSURE_INVALID", [`$.componentFacts[${index}]`]);
    }
  }
}

function validateAtomicClosure(value) {
  const authority = value.graph.authorityBinding;
  const assembly = value.assemblyFact;
  const candidate = value.candidate;
  const binding = value.usageBinding;
  const explanation = value.mechanismExplanation;
  const assemblyRef = { id: assembly.id, hash: assembly.factHash };
  const bindingRef = { id: binding.id, hash: binding.bindingHash };
  const explanationRef = { id: explanation.sourceBindingRef.id, hash: explanation.explanationHash };
  const closureChecks = [
    ["$.graph.authorityBinding", authority?.family === "atomic_v2" && authority.authorityHash === assembly.authorityBinding?.authorityHash],
    ["$.companyId", value.companyId === authority?.companyId && value.companyId === candidate.companyId && value.companyId === binding.companyId],
    ["$.accountId", value.accountId === authority?.accountId && value.accountId === candidate.accountId && value.accountId === binding.accountId],
    ["$.contentProjectRef", sameRef(value.contentProjectRef, authorityRef(authority, "contentProjectRef"))],
    ["$.platformRunRef", sameRef(value.platformRunRef, authorityRef(authority, "platformRunRef")) && sameRef(value.platformRunRef, candidate.platformRunRef) && sameRef(value.platformRunRef, binding.platformRunRef)],
    ["$.graph.assemblyFactRef", sameRef(value.graph.assemblyFactRef, assemblyRef)],
    ["$.candidate.authority.assemblyFactRef", sameRef(candidate.authority?.assemblyFactRef, assemblyRef)],
    ["$.candidate.authority.usageBindingRef", candidate.authority?.family === "atomic_v2" && sameRef(candidate.authority.usageBindingRef, bindingRef)],
    ["$.mechanismExplanation.sourceBindingRef", sameRef(explanation.sourceBindingRef, bindingRef)],
    ["$.candidate.mechanismExplanationRef", sameRef(candidate.mechanismExplanationRef, explanationRef)],
    ["$.usageBinding.decisionRef", sameRef(binding.decisionRef, authorityRef(authority, "mechanismDecisionRef"))],
    ["$.usageBinding.sharedContentMasterRef", sameRef(binding.sharedContentMasterRef, authorityRef(authority, "sharedContentMasterRef"))],
    ["$.usageBinding.creativeMechanism.writerContextRef", sameRef(binding.creativeMechanism?.writerContextRef, authorityRef(authority, "writerContextRef"))]
  ];
  const failed = closureChecks.filter(([, passed]) => !passed).map(([path]) => path);
  if (failed.length) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_CLOSURE_INVALID", failed);
}

export function validateUnifiedAtomicContentCommit(value) {
  if (!exact(value, ROOT_KEYS)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INVALID", ["$"]);
  if (value.schemaVersion !== "1.0" || value.contract !== CONTRACT) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INVALID", ["$.schemaVersion", "$.contract"]);
  if (!text(value.id) || !text(value.companyId) || !text(value.accountId) || value.platform !== "xiaohongshu"
    || !ref(value.contentProjectRef) || !ref(value.platformRunRef) || !text(value.idempotencyKey)) {
    fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INVALID", ["$.id", "$.companyId", "$.accountId", "$.platform", "$.contentProjectRef", "$.platformRunRef", "$.idempotencyKey"]);
  }
  if (!HASH.test(value.commitHash || "") || calculatedCommitHash(value) !== value.commitHash) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_HASH_MISMATCH", ["$.commitHash"]);
  validateNoForbiddenPayload(value);
  safeValidate("$.graph", validateUnifiedAtomicFactGraph, value.graph);
  safeValidate("$.assemblyFact", validateDeterministicAssemblyFactV2, value.assemblyFact);
  safeValidate("$.usageBinding", validateContentMechanismUsageBinding, value.usageBinding);
  safeValidate("$.mechanismExplanation", validateMechanismExplanation, value.mechanismExplanation);
  safeValidate("$.candidate", validateUnifiedContentCandidateV3, value.candidate);

  validateAtomicClosure(value);
  validateComponentFactSet(value.componentFacts, value.graph, value.assemblyFact, value.graph.authorityBinding.authorityHash);
  return value;
}

export function createUnifiedAtomicContentCommit(input) {
  if (!exact(input, INPUT_KEYS)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_INPUT_INVALID", ["$"]);
  const frozen = deepFreeze(clone(input));
  const authority = frozen.graph?.authorityBinding;
  const draft = {
    schemaVersion: "1.0", contract: CONTRACT, id: frozen.id,
    companyId: authority?.companyId, accountId: authority?.accountId, platform: frozen.platform,
    contentProjectRef: clone(frozen.contentProjectRef), platformRunRef: clone(authorityRef(authority, "platformRunRef")),
    graph: clone(frozen.graph), componentFacts: clone(frozen.componentFacts), assemblyFact: clone(frozen.assemblyFact),
    usageBinding: clone(frozen.usageBinding), mechanismExplanation: clone(frozen.mechanismExplanation), candidate: clone(frozen.candidate),
    idempotencyKey: frozen.idempotencyKey
  };
  const value = deepFreeze({ ...draft, commitHash: hashUnifiedContent(draft) });
  validateUnifiedAtomicContentCommit(value);
  return value;
}

function validateMaterializedComponentSet(value) {
  const entries = value.materializedComponents;
  if (!Array.isArray(entries) || entries.length !== MATERIALIZED_REGISTRY.length) {
    fail("UNIFIED_ATOMIC_MATERIALIZED_COMPONENTS_INVALID", ["$.materializedComponents"]);
  }
  const legacyAuthority = componentAuthority(value);
  const graphRefs = value.graph.componentFactRefs;
  const assemblyRefs = value.assemblyFact.componentFactRefs;
  for (let index = 0; index < MATERIALIZED_REGISTRY.length; index += 1) {
    const spec = MATERIALIZED_REGISTRY[index];
    const entry = entries[index];
    const factEntry = value.componentFacts[index];
    const graphEntry = graphRefs[index];
    const assemblyEntry = assemblyRefs.find((item) => item.role === spec.role);
    const path = `$.materializedComponents[${index}]`;
    if (!exact(entry, ["role", "kind", "fact", "component", "componentHashField"])
      || entry.role !== spec.role || entry.kind !== spec.kind || entry.componentHashField !== spec.hashField
      || entry.component?.contract !== spec.contract) {
      fail("UNIFIED_ATOMIC_MATERIALIZED_COMPONENTS_INVALID", [path]);
    }
    safeValidate(`${path}.component`, spec.validator, entry.component);
    if (!HASH.test(entry.component?.[spec.hashField] || "")
      || hashUnifiedContent(withoutHash(entry.component, spec.hashField)) !== entry.component[spec.hashField]) {
      fail("UNIFIED_ATOMIC_MATERIALIZED_COMPONENT_HASH_MISMATCH", [`${path}.component.${spec.hashField}`]);
    }
    const materialRef = declaredRef(entry.component, spec.hashField);
    if (!sameValue(entry.fact, factEntry?.fact)
      || entry.fact?.componentRole !== spec.role || entry.fact?.componentContract !== spec.contract
      || !sameRef(entry.fact?.componentRef, materialRef)
      || graphEntry?.role !== spec.role || graphEntry?.kind !== spec.kind
      || !sameRef(graphEntry?.factRef, declaredRef(entry.fact, "factHash")) || !sameRef(graphEntry?.componentRef, materialRef)
      || assemblyEntry?.role !== spec.role || assemblyEntry?.kind !== spec.kind
      || assemblyEntry?.factContract !== entry.fact?.contract || assemblyEntry?.componentContract !== spec.contract
      || !sameRef(assemblyEntry?.factRef, declaredRef(entry.fact, "factHash")) || !sameRef(assemblyEntry?.componentRef, materialRef)) {
      fail("UNIFIED_ATOMIC_MATERIALIZED_COMPONENT_CLOSURE_INVALID", [path]);
    }
    if (!sameValue(entry.component.authorityBinding, legacyAuthority)) {
      fail("UNIFIED_ATOMIC_MATERIALIZED_COMPONENT_AUTHORITY_INVALID", [`${path}.component.authorityBinding`]);
    }
  }
}

function validateMaterializedAuthority(value) {
  const authority = value.graph.authorityBinding;
  const legacy = componentAuthority(value);
  const identity = value.contentProjectIdentity;
  const project = value.contentProject;
  const platformRun = project.platformRuns.find((item) => item.platform === value.platform);
  const checks = [
    ["$.contentProjectRef", sameRef(value.contentProjectRef, { id: identity.id, hash: identity.identityHash })],
    ["$.materializedContentProjectRef", sameRef(value.materializedContentProjectRef, { id: project.id, hash: project.projectHash })],
    ["$.contentProject.id", project.id === identity.id],
    ["$.contentProject.companyId", project.companyId === identity.companyId && project.companyId === value.companyId && legacy?.companyId === value.companyId],
    ["$.contentProject.contentOpportunityRef", sameRef(project.contentOpportunityRef, identity.contentOpportunityRef) && sameRef(project.contentOpportunityRef, legacy?.contentOpportunityRef)],
    ["$.contentProject.activeStrategySnapshotRef", sameRef(project.activeStrategySnapshotRef, identity.activeStrategySnapshotRef) && sameRef(project.activeStrategySnapshotRef, legacy?.activeStrategySnapshotRef)],
    ["$.contentProject.sharedContentMasterRef", sameRef(bareRef(project.sharedContentMasterRef), legacy?.sharedContentMasterRef)
      && sameRef(bareRef(project.sharedContentMasterRef), authorityRef(authority, "sharedContentMasterRef"))],
    ["$.contentProject.platformRuns", Boolean(platformRun) && platformRun.accountId === value.accountId
      && sameRef({ id: platformRun.id, hash: platformRun.hash }, value.platformRunRef)
      && sameRef(bareRef(platformRun.sharedContentMasterRef), bareRef(project.sharedContentMasterRef))],
    ["$.materializedComponents[0].component.authorityBinding.contentProjectRef", sameRef(legacy?.contentProjectRef, value.contentProjectRef)],
    ["$.materializedComponents[0].component.authorityBinding.platformRunRef", sameRef(legacy?.platformRunRef, value.platformRunRef)],
    ["$.materializedComponents[0].component.authorityBinding.mechanismDecisionRef", sameRef(legacy?.mechanismDecisionRef, authorityRef(authority, "mechanismDecisionRef"))],
    ["$.materializedComponents[0].component.authorityBinding.writerContextRef", sameRef(legacy?.writerContextRef, authorityRef(authority, "writerContextRef"))]
  ];
  const failed = checks.filter(([, passed]) => !passed).map(([path]) => path);
  if (failed.length) fail("UNIFIED_ATOMIC_MATERIALIZED_AUTHORITY_INVALID", failed);
}

export function validateUnifiedAtomicContentCommitV2(value) {
  if (!exact(value, MATERIALIZED_ROOT_KEYS)) fail("UNIFIED_ATOMIC_MATERIALIZED_COMMIT_INVALID", ["$"]);
  if (value.schemaVersion !== "2.0" || value.contract !== MATERIALIZED_CONTRACT) {
    fail("UNIFIED_ATOMIC_MATERIALIZED_COMMIT_INVALID", ["$.schemaVersion", "$.contract"]);
  }
  if (!text(value.id) || !text(value.companyId) || !text(value.accountId) || value.platform !== "xiaohongshu"
    || !ref(value.contentProjectRef) || !ref(value.materializedContentProjectRef) || !ref(value.platformRunRef) || !text(value.idempotencyKey)) {
    fail("UNIFIED_ATOMIC_MATERIALIZED_COMMIT_INVALID", ["$.id", "$.companyId", "$.accountId", "$.platform", "$.contentProjectRef", "$.materializedContentProjectRef", "$.platformRunRef", "$.idempotencyKey"]);
  }
  if (!HASH.test(value.commitHash || "") || calculatedCommitHash(value) !== value.commitHash) {
    fail("UNIFIED_ATOMIC_MATERIALIZED_COMMIT_HASH_MISMATCH", ["$.commitHash"]);
  }
  validateNoForbiddenPayload(value, "$", new WeakSet(), true, MATERIALIZED_FORBIDDEN_KEYS);
  validateContentProjectIdentity(value.contentProjectIdentity);
  safeValidate("$.contentProject", validateContentProject, value.contentProject);
  safeValidate("$.graph", validateUnifiedAtomicFactGraph, value.graph);
  safeValidate("$.assemblyFact", validateDeterministicAssemblyFactV2, value.assemblyFact);
  safeValidate("$.assemblyOutput", validateXhsPostPackageV4, value.assemblyOutput);
  safeValidate("$.usageBinding", validateContentMechanismUsageBinding, value.usageBinding);
  safeValidate("$.mechanismExplanation", validateMechanismExplanation, value.mechanismExplanation);
  safeValidate("$.candidate", validateUnifiedContentCandidateV3, value.candidate);

  validateAtomicClosure(value);
  validateComponentFactSet(value.componentFacts, value.graph, value.assemblyFact, value.graph.authorityBinding.authorityHash);
  validateMaterializedComponentSet(value);
  validateMaterializedAuthority(value);
  const outputRef = declaredRef(value.assemblyOutput, "packageHash");
  if (value.assemblyFact.assembly.outputContract !== "XhsPostPackage@4.0"
    || !sameRef(value.assemblyFact.assembly.outputRef, outputRef)
    || !sameRef(value.candidate.authority?.assemblyFactRef, declaredRef(value.assemblyFact, "factHash"))) {
    fail("UNIFIED_ATOMIC_MATERIALIZED_ASSEMBLY_CLOSURE_INVALID", ["$.assemblyOutput", "$.assemblyFact.assembly.outputRef", "$.candidate.authority.assemblyFactRef"]);
  }
  const packageRefs = value.assemblyOutput.componentRefs;
  for (let index = 0; index < MATERIALIZED_REGISTRY.length; index += 1) {
    const spec = MATERIALIZED_REGISTRY[index];
    if (!sameRef(packageRefs?.[spec.role], declaredRef(value.materializedComponents[index].component, spec.hashField))) {
      fail("UNIFIED_ATOMIC_MATERIALIZED_ASSEMBLY_CLOSURE_INVALID", [`$.assemblyOutput.componentRefs.${spec.role}`]);
    }
  }
  return value;
}

export function createUnifiedAtomicContentCommitV2(input) {
  if (!exact(input, MATERIALIZED_INPUT_KEYS)) fail("UNIFIED_ATOMIC_MATERIALIZED_COMMIT_INPUT_INVALID", ["$"]);
  const frozen = deepFreeze(clone(input));
  const authority = frozen.graph?.authorityBinding;
  validateContentProjectIdentity(frozen.contentProjectIdentity);
  const projectRef = { id: frozen.contentProjectIdentity.id, hash: frozen.contentProjectIdentity.identityHash };
  const materializedProjectRef = { id: frozen.contentProject?.id, hash: frozen.contentProject?.projectHash };
  const draft = {
    schemaVersion: "2.0", contract: MATERIALIZED_CONTRACT, id: frozen.id,
    companyId: authority?.companyId, accountId: authority?.accountId, platform: frozen.platform,
    contentProjectRef: projectRef, platformRunRef: clone(authorityRef(authority, "platformRunRef")),
    contentProjectIdentity: clone(frozen.contentProjectIdentity), contentProject: clone(frozen.contentProject), materializedContentProjectRef: materializedProjectRef,
    graph: clone(frozen.graph), componentFacts: clone(frozen.componentFacts),
    materializedComponents: clone(frozen.materializedComponents), assemblyFact: clone(frozen.assemblyFact), assemblyOutput: clone(frozen.assemblyOutput),
    usageBinding: clone(frozen.usageBinding), mechanismExplanation: clone(frozen.mechanismExplanation), candidate: clone(frozen.candidate),
    idempotencyKey: frozen.idempotencyKey
  };
  const value = deepFreeze({ ...draft, commitHash: hashUnifiedContent(draft) });
  validateUnifiedAtomicContentCommitV2(value);
  return value;
}

function validateAnyCommit(value) {
  if (value?.schemaVersion === "1.0" && value?.contract === WECHAT_CONTRACT) return validateUnifiedAtomicWechatContentCommit(value);
  if (value?.schemaVersion === "2.0" && value?.contract === MATERIALIZED_CONTRACT) return validateUnifiedAtomicContentCommitV2(value);
  return validateUnifiedAtomicContentCommit(value);
}

function authorityIdentity(commit) {
  return commit.contract === WECHAT_CONTRACT ? commit.authorityBinding.authorityHash : commit.graph.authorityBinding.authorityHash;
}

export function createUnifiedAtomicContentCommitStore(backingStore) {
  if (!object(backingStore)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_STORE_REQUIRED", ["store"]);

  function current() {
    const values = backingStore.unifiedAtomicContentCommits;
    if (values === undefined) return [];
    if (!Array.isArray(values)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_STORE_INVALID", ["store.unifiedAtomicContentCommits"]);
    values.forEach((item, index) => {
      try { validateAnyCommit(item); }
      catch { fail("UNIFIED_ATOMIC_CONTENT_COMMIT_STORE_INVALID", [`store.unifiedAtomicContentCommits[${index}]`]); }
    });
    return values;
  }

  function defensive(value) {
    return value == null ? null : deepFreeze(clone(value));
  }

  return Object.freeze({
    append(commitInput) {
      const candidate = deepFreeze(clone(commitInput));
      validateAnyCommit(candidate);
      const values = current();
      const keyMatch = values.find((item) => item.idempotencyKey === candidate.idempotencyKey);
      if (keyMatch) {
        if (keyMatch.commitHash === candidate.commitHash) return defensive(keyMatch);
        fail("UNIFIED_ATOMIC_CONTENT_COMMIT_IDEMPOTENCY_CONFLICT", ["$.idempotencyKey"]);
      }
      if (values.some((item) => item.id === candidate.id)) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_ID_CONFLICT", ["$.id"]);
      const platformMatches = values.filter((item) => sameRef(item.platformRunRef, candidate.platformRunRef));
      if (platformMatches.some((item) => authorityIdentity(item) !== authorityIdentity(candidate))) {
        fail("UNIFIED_ATOMIC_CONTENT_COMMIT_AUTHORITY_CONFLICT", ["$.platformRunRef", "$.graph.authorityBinding"]);
      }
      if (candidate.candidate && values.some((item) => item.candidate
        && (item.candidate.id === candidate.candidate.id || item.candidate.candidateHash === candidate.candidate.candidateHash))) {
        fail("UNIFIED_ATOMIC_CONTENT_COMMIT_CANDIDATE_CONFLICT", ["$.candidate"]);
      }
      if (platformMatches.length) fail("UNIFIED_ATOMIC_CONTENT_COMMIT_PLATFORM_RUN_CONFLICT", ["$.platformRunRef"]);
      const stored = deepFreeze(clone(candidate));
      backingStore.unifiedAtomicContentCommits = [...values, stored];
      return defensive(stored);
    },

    getByCommit(idOrHash) {
      return defensive(current().find((item) => item.id === idOrHash || item.commitHash === idOrHash) || null);
    },

    getByCandidate(idOrHash) {
      return defensive(current().find((item) => item.candidate && (item.candidate.id === idOrHash || item.candidate.candidateHash === idOrHash)) || null);
    },

    listByProject(idOrHash) {
      return deepFreeze(current().filter((item) => item.contentProjectRef.id === idOrHash || item.contentProjectRef.hash === idOrHash
        || item.materializedContentProjectRef?.id === idOrHash || item.materializedContentProjectRef?.hash === idOrHash).map((item) => clone(item)));
    }
  });
}
