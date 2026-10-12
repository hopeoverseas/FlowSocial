import {
  hashUnifiedContent,
  validateContentMechanismUsageBinding,
  validateMechanismExplanation
} from "./unified-content-contracts.mjs";

export const UNIFIED_EXECUTION_CONTRACTS = Object.freeze({
  invocation: "SkillActivityInvocation@1.0",
  componentFact: "ValidatedComponentFact@1.0",
  deterministicComponentFact: "DeterministicComponentFact@1.0",
  assemblyFact: "DeterministicAssemblyFact@1.0",
  assemblyFactV2: "DeterministicAssemblyFact@2.0",
  candidate: "UnifiedContentCandidate@2.0",
  candidateV3: "UnifiedContentCandidate@3.0",
  runState: "UnifiedContentRunState@1.0"
});

export const DEFAULT_ATOMIC_ATTEMPT_POLICY = Object.freeze({
  maxAttempts: 1,
  automaticRetries: 0,
  timeoutMs: 60_000,
  maxProviderCalls: 1,
  costBudget: null
});

const HASH = /^[a-f0-9]{64}$/;
const REF_KEYS = ["id", "hash"];
const AUTHORITY_KEYS = ["family", "companyId", "accountId", "refs", "authorityHash"];
const FAMILIES = new Set(["monolithic_v1", "atomic_v2"]);

function invalid(contract, fieldPaths) {
  throw Object.assign(new Error("Unified execution contract validation failed"), {
    code: "UNIFIED_EXECUTION_CONTRACT_INVALID",
    statusCode: 409,
    details: { contract, fieldPaths: [...new Set(fieldPaths)] }
  });
}

function requirePaths(contract, tests) {
  const failed = tests.filter(([, passed]) => !passed).map(([path]) => path);
  if (failed.length) invalid(contract, failed);
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

function hash(value) {
  return typeof value === "string" && HASH.test(value);
}

function ref(value) {
  return exact(value, REF_KEYS) && text(value.id) && hash(value.hash);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function isDeepFrozen(value) {
  if (!value || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

function withHash(value, field) {
  const copy = clone(value);
  delete copy[field];
  return { ...copy, [field]: hashUnifiedContent(copy) };
}

function validHash(value, field) {
  if (!object(value) || !hash(value[field])) return false;
  const copy = clone(value);
  delete copy[field];
  return hashUnifiedContent(copy) === value[field];
}

function sameRef(left, right) {
  return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash;
}

function compareCodePoints(left, right) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function validateAuthority(value, contract, path, expectedFamily = null) {
  const refs = value?.refs;
  const roles = Array.isArray(refs) ? refs.map((item) => item?.role) : [];
  const sortedRoles = [...roles].sort(compareCodePoints);
  const authorityCopy = object(value) ? { family: value.family, companyId: value.companyId, accountId: value.accountId, refs: value.refs } : null;
  requirePaths(contract, [
    [path, exact(value, AUTHORITY_KEYS)],
    [`${path}.family`, FAMILIES.has(value?.family) && (!expectedFamily || value.family === expectedFamily)],
    [`${path}.companyId`, text(value?.companyId)],
    [`${path}.accountId`, text(value?.accountId)],
    [`${path}.refs`, Array.isArray(refs) && refs.length > 0],
    [`${path}.refs[]`, Array.isArray(refs) && refs.every((item) => exact(item, ["role", "ref"]) && text(item.role) && ref(item.ref))],
    [`${path}.refs[].role`, roles.length === new Set(roles).size && JSON.stringify(roles) === JSON.stringify(sortedRoles)],
    [`${path}.authorityHash`, hash(value?.authorityHash) && object(authorityCopy) && hashUnifiedContent(authorityCopy) === value.authorityHash]
  ]);
  return value;
}

export function createExecutionAuthorityBinding({ family, companyId, accountId, refs }) {
  const contract = "ExecutionAuthorityBinding";
  requirePaths(contract, [
    ["$.family", FAMILIES.has(family)],
    ["$.companyId", text(companyId)],
    ["$.accountId", text(accountId)],
    ["$.refs", Array.isArray(refs) && refs.length > 0],
    ["$.refs[]", Array.isArray(refs) && refs.every((item) => exact(item, ["role", "ref"]) && text(item.role) && ref(item.ref))]
  ]);
  const orderedRefs = clone(refs).sort((left, right) => compareCodePoints(left.role, right.role));
  const draft = { family, companyId, accountId, refs: orderedRefs };
  const value = { ...draft, authorityHash: hashUnifiedContent(draft) };
  validateAuthority(value, contract, "$", family);
  return deepFreeze(value);
}

function componentMatchesAuthority(componentAuthority, executionAuthority) {
  return object(componentAuthority)
    && componentAuthority.companyId === executionAuthority.companyId
    && componentAuthority.accountId === executionAuthority.accountId
    && executionAuthority.refs.every(({ role, ref: authorityRef }) => sameRef(componentAuthority[role], authorityRef));
}

function validateAttemptPolicy(value, contract, path = "$.attemptPolicy") {
  const budget = value?.costBudget;
  requirePaths(contract, [
    [path, exact(value, ["maxAttempts", "automaticRetries", "timeoutMs", "maxProviderCalls", "costBudget"])],
    [`${path}.maxAttempts`, Number.isInteger(value?.maxAttempts) && value.maxAttempts >= 1],
    [`${path}.automaticRetries`, Number.isInteger(value?.automaticRetries) && value.automaticRetries >= 0 && value.automaticRetries < value.maxAttempts],
    [`${path}.timeoutMs`, Number.isInteger(value?.timeoutMs) && value.timeoutMs > 0],
    [`${path}.maxProviderCalls`, Number.isInteger(value?.maxProviderCalls) && value.maxProviderCalls >= 0 && value.maxProviderCalls <= value.maxAttempts],
    [`${path}.costBudget`, budget === null || (exact(budget, ["currency", "maxAmountMicros"]) && /^[A-Z]{3}$/.test(budget.currency) && Number.isInteger(budget.maxAmountMicros) && budget.maxAmountMicros > 0)]
  ]);
}

function invocationIdentity(value) {
  return {
    skill: value.skill,
    inputRef: value.inputRef,
    authorityBinding: value.authorityBinding,
    planHash: value.planHash,
    attemptPolicy: value.attemptPolicy
  };
}

const INVOCATION_KEYS = ["schemaVersion", "contract", "id", "skill", "inputRef", "authorityBinding", "planHash", "attemptPolicy", "idempotencyKey", "invocationHash"];

export function validateSkillActivityInvocation(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.invocation;
  requirePaths(contract, [
    ["$", exact(value, INVOCATION_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "1.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.skill", exact(value?.skill, ["name", "version"]) && text(value.skill.name) && text(value.skill.version)],
    ["$.inputRef", ref(value?.inputRef)],
    ["$.planHash", hash(value?.planHash)],
    ["$.idempotencyKey", hash(value?.idempotencyKey) && object(value) && hashUnifiedContent(invocationIdentity(value)) === value.idempotencyKey],
    ["$.invocationHash", validHash(value, "invocationHash")]
  ]);
  validateAuthority(value.authorityBinding, contract, "$.authorityBinding");
  validateAttemptPolicy(value.attemptPolicy, contract);
  return value;
}

export function createSkillActivityInvocation({ id, skill, inputRef, authorityBinding, planHash, attemptPolicy = DEFAULT_ATOMIC_ATTEMPT_POLICY }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.invocation;
  validateAuthority(authorityBinding, contract, "input.authorityBinding");
  validateAttemptPolicy(attemptPolicy, contract, "input.attemptPolicy");
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.skill", exact(skill, ["name", "version"]) && text(skill.name) && text(skill.version)],
    ["input.inputRef", ref(inputRef)],
    ["input.planHash", hash(planHash)]
  ]);
  const base = {
    schemaVersion: "1.0", contract, id, skill: clone(skill), inputRef: clone(inputRef),
    authorityBinding: clone(authorityBinding), planHash, attemptPolicy: clone(attemptPolicy)
  };
  const value = withHash({ ...base, idempotencyKey: hashUnifiedContent(invocationIdentity(base)), invocationHash: "" }, "invocationHash");
  validateSkillActivityInvocation(value);
  return deepFreeze(value);
}

const COMPONENT_FACT_KEYS = ["schemaVersion", "contract", "id", "status", "invocationRef", "componentRole", "componentContract", "componentRef", "authorityBinding", "validator", "audit", "factHash"];

export function validateValidatedComponentFact(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.componentFact;
  requirePaths(contract, [
    ["$", exact(value, COMPONENT_FACT_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "1.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.status", value?.status === "validated"],
    ["$.invocationRef", ref(value?.invocationRef)],
    ["$.componentRole", text(value?.componentRole)],
    ["$.componentContract", text(value?.componentContract)],
    ["$.componentRef", ref(value?.componentRef)],
    ["$.validator", exact(value?.validator, ["name", "version"]) && text(value.validator.name) && text(value.validator.version)],
    ["$.audit", exact(value?.audit, ["rawProviderEnvelopeRef", "rawEnvelopeAuthoritative"])],
    ["$.audit.rawProviderEnvelopeRef", value?.audit?.rawProviderEnvelopeRef === null || ref(value?.audit?.rawProviderEnvelopeRef)],
    ["$.audit.rawEnvelopeAuthoritative", value?.audit?.rawEnvelopeAuthoritative === false],
    ["$.audit.authoritySeparation", value?.audit?.rawProviderEnvelopeRef === null || !sameRef(value?.audit?.rawProviderEnvelopeRef, value?.componentRef)],
    ["$.factHash", validHash(value, "factHash")]
  ]);
  validateAuthority(value.authorityBinding, contract, "$.authorityBinding", "atomic_v2");
  return value;
}

export function createValidatedComponentFact({ id, invocation, componentRole, component, componentHashField, validateComponent, validator, rawProviderEnvelopeRef = null }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.componentFact;
  validateSkillActivityInvocation(invocation);
  requirePaths(contract, [
    ["input.invocation", isDeepFrozen(invocation) && invocation.authorityBinding.family === "atomic_v2"],
    ["input.componentRole", text(componentRole)],
    ["input.component", object(component) && isDeepFrozen(component)],
    ["input.component.status", component?.status === undefined || ["success", "validated", "passed", "ready"].includes(component.status)],
    ["input.component.id", text(component?.id)],
    ["input.component.contract", text(component?.contract)],
    ["input.componentHashField", text(componentHashField) && hash(component?.[componentHashField])],
    ["input.validateComponent", typeof validateComponent === "function"],
    ["input.validator", exact(validator, ["name", "version"]) && text(validator.name) && text(validator.version)],
    ["input.rawProviderEnvelopeRef", rawProviderEnvelopeRef === null || ref(rawProviderEnvelopeRef)]
  ]);
  const componentCopy = clone(component);
  const declaredHash = componentCopy[componentHashField];
  delete componentCopy[componentHashField];
  requirePaths(contract, [
    ["input.component.hash", hashUnifiedContent(componentCopy) === declaredHash],
    ["input.component.authorityBinding", componentMatchesAuthority(component.authorityBinding, invocation.authorityBinding)]
  ]);
  const validationResult = validateComponent(component);
  requirePaths(contract, [["input.validateComponent.result", validationResult === component || validationResult === true]]);
  const draft = {
    schemaVersion: "1.0", contract, id, status: "validated",
    invocationRef: { id: invocation.id, hash: invocation.invocationHash }, componentRole,
    componentContract: component.contract, componentRef: { id: component.id, hash: declaredHash },
    authorityBinding: clone(invocation.authorityBinding), validator: clone(validator),
    audit: { rawProviderEnvelopeRef: clone(rawProviderEnvelopeRef), rawEnvelopeAuthoritative: false }, factHash: ""
  };
  const value = withHash(draft, "factHash");
  validateValidatedComponentFact(value);
  return deepFreeze(value);
}

const DETERMINISTIC_COMPONENT_FACT_KEYS = ["schemaVersion", "contract", "id", "producer", "inputRef", "upstreamFactRefs", "componentRole", "componentContract", "componentRef", "authorityBinding", "validator", "factHash"];
const UPSTREAM_KINDS = new Set(["provider_component", "deterministic_component", "validated_skill_output"]);

function upstreamSortKey(item) {
  return `${item.kind}\u0000${item.role}`;
}

function validateUpstreamFactRef(value, contract, path) {
  const expectedContract = value?.kind === "provider_component" ? UNIFIED_EXECUTION_CONTRACTS.componentFact
    : value?.kind === "deterministic_component" ? UNIFIED_EXECUTION_CONTRACTS.deterministicComponentFact
      : value?.kind === "validated_skill_output" ? "UnifiedSkillOutputFact@1.0" : null;
  requirePaths(contract, [
    [path, exact(value, ["kind", "role", "factContract", "factRef"])],
    [`${path}.kind`, UPSTREAM_KINDS.has(value?.kind)],
    [`${path}.role`, text(value?.role)],
    [`${path}.factContract`, text(value?.factContract) && value.factContract === expectedContract],
    [`${path}.factRef`, ref(value?.factRef)]
  ]);
}

export function validateDeterministicComponentFact(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.deterministicComponentFact;
  const upstreamRefs = value?.upstreamFactRefs;
  const upstreamRoles = Array.isArray(upstreamRefs) ? upstreamRefs.map((item) => item?.role) : [];
  const upstreamKeys = Array.isArray(upstreamRefs) ? upstreamRefs.map(upstreamSortKey) : [];
  const sortedUpstreamKeys = [...upstreamKeys].sort(compareCodePoints);
  requirePaths(contract, [
    ["$", exact(value, DETERMINISTIC_COMPONENT_FACT_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "1.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.producer", exact(value?.producer, ["kind", "name", "version"]) && value.producer.kind === "deterministic_compiler" && text(value.producer.name) && text(value.producer.version)],
    ["$.inputRef", ref(value?.inputRef)],
    ["$.upstreamFactRefs", Array.isArray(upstreamRefs) && upstreamRefs.length > 0],
    ["$.upstreamFactRefs[].role", upstreamRoles.length === new Set(upstreamRoles).size],
    ["$.upstreamFactRefs.order", JSON.stringify(upstreamKeys) === JSON.stringify(sortedUpstreamKeys)],
    ["$.componentRole", text(value?.componentRole)],
    ["$.componentContract", text(value?.componentContract)],
    ["$.componentRef", ref(value?.componentRef)],
    ["$.validator", exact(value?.validator, ["name", "version"]) && text(value.validator.name) && text(value.validator.version)],
    ["$.factHash", validHash(value, "factHash")]
  ]);
  if (Array.isArray(upstreamRefs)) upstreamRefs.forEach((item, index) => validateUpstreamFactRef(item, contract, `$.upstreamFactRefs[${index}]`));
  validateAuthority(value.authorityBinding, contract, "$.authorityBinding", "atomic_v2");
  return value;
}

function validateUnifiedSkillOutputUpstreamFact(value) {
  const contract = "UnifiedSkillOutputFact@1.0";
  const output = value?.runtimeOutput;
  requirePaths(contract, [
    ["$", exact(value, UNIFIED_SKILL_OUTPUT_FACT_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "1.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.invocationRef", ref(value?.invocationRef)],
    ["$.executionRecordRef", ref(value?.executionRecordRef)],
    ["$.platform", text(value?.platform)],
    ["$.stepId", text(value?.stepId)],
    ["$.capability", value?.capability === "generate-platform-titles"],
    ["$.inputContract", text(value?.inputContract)],
    ["$.outputContract", text(value?.outputContract)],
    ["$.planRef", ref(value?.planRef)],
    ["$.bundleHash", hash(value?.bundleHash)],
    ["$.inputHash", hash(value?.inputHash)],
    ["$.outputHash", hash(value?.outputHash) && object(output) && hashUnifiedContent(output) === value.outputHash],
    ["$.runtimeOutput", exact(output, ["status", "data", "warnings", "blocked_reasons"])],
    ["$.runtimeOutput.status", output?.status === "success"],
    ["$.runtimeOutput.data", object(output?.data)],
    ["$.runtimeOutput.warnings", Array.isArray(output?.warnings) && output.warnings.every((item) => typeof item === "string")],
    ["$.runtimeOutput.blocked_reasons", Array.isArray(output?.blocked_reasons) && output.blocked_reasons.length === 0 && output.blocked_reasons.every((item) => typeof item === "string")],
    ["$.verifiedDomainOutput", value?.verifiedDomainOutput === null],
    ["$.executionMode", text(value?.executionMode)],
    ["$.status", value?.status === "completed"],
    ["$.productionEligibleOutput", typeof value?.productionEligibleOutput === "boolean"],
    ["$.factHash", validHash(value, "factHash")]
  ]);
  return value;
}

function normalizeUpstreamFacts(upstreamFacts, contract, expectedAuthority = null) {
  requirePaths(contract, [["input.upstreamFacts", Array.isArray(upstreamFacts) && upstreamFacts.length > 0 && upstreamFacts.every((item) => exact(item, ["kind", "role", "fact"]) && UPSTREAM_KINDS.has(item.kind) && text(item.role) && object(item.fact))]]);
  const roles = upstreamFacts.map((item) => item.role);
  requirePaths(contract, [["input.upstreamFacts.roles", roles.length === new Set(roles).size]]);
  const validated = upstreamFacts.map((item) => {
    if (item.kind === "provider_component") validateValidatedComponentFact(item.fact);
    else if (item.kind === "deterministic_component") validateDeterministicComponentFact(item.fact);
    else validateUnifiedSkillOutputUpstreamFact(item.fact);
    return item;
  }).sort((left, right) => compareCodePoints(upstreamSortKey(left), upstreamSortKey(right)));
  if (expectedAuthority) {
    const authorityBound = validated.filter((item) => item.kind === "provider_component" || item.kind === "deterministic_component");
    requirePaths(contract, [
      ["input.upstreamFacts.authorityBound", authorityBound.length > 0],
      ["input.upstreamFacts.authorityBinding", authorityBound.every((item) => item.fact.authorityBinding.authorityHash === expectedAuthority.authorityHash)]
    ]);
  }
  const refs = validated.map((item) => ({
    kind: item.kind,
    role: item.role,
    factContract: item.fact.contract,
    factRef: { id: item.fact.id, hash: item.fact.factHash }
  }));
  return { validated, refs };
}

export function createDeterministicCompilerInputRef({ id, input, upstreamFacts, authorityBinding }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.deterministicComponentFact;
  requirePaths(contract, [["input.id", text(id)], ["input.input", object(input) && isDeepFrozen(input)]]);
  validateAuthority(authorityBinding, contract, "input.authorityBinding", "atomic_v2");
  const { refs } = normalizeUpstreamFacts(upstreamFacts, contract, authorityBinding);
  return deepFreeze({ id, hash: hashUnifiedContent({ input, upstreamFactRefs: refs }) });
}

export function createDeterministicComponentFact({ id, producer, input, inputRef, upstreamFacts, componentRole, compiler, validateComponent, validator, componentHashField }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.deterministicComponentFact;
  validateAuthority(producer?.authorityBinding, contract, "input.producer.authorityBinding", "atomic_v2");
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.producer", exact(producer, ["name", "version", "authorityBinding"]) && text(producer.name) && text(producer.version)],
    ["input.input", object(input) && isDeepFrozen(input)],
    ["input.inputRef", ref(inputRef)],
    ["input.componentRole", text(componentRole)],
    ["input.compiler", typeof compiler === "function"],
    ["input.validateComponent", typeof validateComponent === "function"],
    ["input.validator", exact(validator, ["name", "version"]) && text(validator.name) && text(validator.version)],
    ["input.componentHashField", text(componentHashField)]
  ]);
  const { validated, refs } = normalizeUpstreamFacts(upstreamFacts, contract, producer.authorityBinding);
  requirePaths(contract, [["input.inputRef.hash", inputRef.hash === hashUnifiedContent({ input, upstreamFactRefs: refs })]]);
  const compilerContext = deepFreeze({
    input: deepFreeze(clone(input)),
    upstreamFacts: deepFreeze(validated.map((item) => ({ kind: item.kind, role: item.role, fact: deepFreeze(clone(item.fact)) })))
  });
  let component;
  try {
    component = compiler(compilerContext);
  } catch {
    invalid(contract, ["input.compiler.result"]);
  }
  requirePaths(contract, [["input.compiler.result", object(component) && isDeepFrozen(component)]]);
  requirePaths(contract, [
    ["input.compiler.result.id", text(component?.id)],
    ["input.compiler.result.contract", text(component?.contract)],
    ["input.compiler.result.hash", hash(component?.[componentHashField])]
  ]);
  const componentCopy = clone(component);
  const componentHash = componentCopy[componentHashField];
  delete componentCopy[componentHashField];
  requirePaths(contract, [
    ["input.compiler.result.hash", hashUnifiedContent(componentCopy) === componentHash],
    ["input.compiler.result.authorityBinding", componentMatchesAuthority(component.authorityBinding, producer.authorityBinding)]
  ]);
  let validatorResult;
  try {
    validatorResult = validateComponent(component);
  } catch {
    invalid(contract, ["input.validateComponent.result"]);
  }
  requirePaths(contract, [["input.validateComponent.result", validatorResult === component || validatorResult === true]]);
  const fact = withHash({
    schemaVersion: "1.0", contract, id,
    producer: { kind: "deterministic_compiler", name: producer.name, version: producer.version },
    inputRef: clone(inputRef), upstreamFactRefs: clone(refs), componentRole,
    componentContract: component.contract, componentRef: { id: component.id, hash: componentHash },
    authorityBinding: clone(producer.authorityBinding), validator: clone(validator), factHash: ""
  }, "factHash");
  validateDeterministicComponentFact(fact);
  return deepFreeze({ component, fact: deepFreeze(fact) });
}

const ASSEMBLY_FACT_KEYS = ["schemaVersion", "contract", "id", "status", "authorityBinding", "requiredRoles", "componentFactRefs", "assembly", "factHash"];

export function validateDeterministicAssemblyFact(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.assemblyFact;
  const roles = Array.isArray(value?.componentFactRefs) ? value.componentFactRefs.map((item) => item?.role) : [];
  requirePaths(contract, [
    ["$", exact(value, ASSEMBLY_FACT_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "1.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.status", value?.status === "validated"],
    ["$.requiredRoles", Array.isArray(value?.requiredRoles) && value.requiredRoles.length > 0 && value.requiredRoles.every(text) && new Set(value.requiredRoles).size === value.requiredRoles.length && JSON.stringify(value.requiredRoles) === JSON.stringify([...value.requiredRoles].sort())],
    ["$.componentFactRefs", Array.isArray(value?.componentFactRefs) && value.componentFactRefs.length > 0 && value.componentFactRefs.every((item) => exact(item, ["role", "factRef", "componentContract", "componentRef"]) && text(item.role) && ref(item.factRef) && text(item.componentContract) && ref(item.componentRef))],
    ["$.componentFactRefs[].role", roles.length === new Set(roles).size && JSON.stringify(roles) === JSON.stringify(value?.requiredRoles)],
    ["$.componentFactRefs.atomicOnly", Array.isArray(value?.componentFactRefs) && !value.componentFactRefs.some((item) => item.role === "write-xhs-content" || /XhsPostPackage@2\.0/.test(item.componentContract))],
    ["$.assembly", exact(value?.assembly, ["assembler", "version", "outputContract", "outputRef"]) && text(value.assembly.assembler) && text(value.assembly.version) && text(value.assembly.outputContract) && ref(value.assembly.outputRef)],
    ["$.factHash", validHash(value, "factHash")]
  ]);
  validateAuthority(value.authorityBinding, contract, "$.authorityBinding", "atomic_v2");
  return value;
}

export function createDeterministicAssemblyFact({ id, componentFacts, requiredRoles, assemblyOutput, assemblyHashField, validateAssembly, assembler }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.assemblyFact;
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.componentFacts", Array.isArray(componentFacts) && componentFacts.length > 0 && componentFacts.every(isDeepFrozen)],
    ["input.requiredRoles", Array.isArray(requiredRoles) && requiredRoles.length > 0 && requiredRoles.every(text) && new Set(requiredRoles).size === requiredRoles.length],
    ["input.assemblyOutput", object(assemblyOutput) && isDeepFrozen(assemblyOutput)],
    ["input.assemblyHashField", text(assemblyHashField) && hash(assemblyOutput?.[assemblyHashField])],
    ["input.validateAssembly", typeof validateAssembly === "function"],
    ["input.assembler", exact(assembler, ["name", "version"]) && text(assembler.name) && text(assembler.version)]
  ]);
  componentFacts.forEach(validateValidatedComponentFact);
  const orderedRoles = [...requiredRoles].sort(compareCodePoints);
  const factsByRole = new Map(componentFacts.map((fact) => [fact.componentRole, fact]));
  const authorityHash = componentFacts[0]?.authorityBinding.authorityHash;
  const outputCopy = clone(assemblyOutput);
  const outputHash = outputCopy[assemblyHashField];
  delete outputCopy[assemblyHashField];
  requirePaths(contract, [
    ["input.componentFacts.roles", factsByRole.size === componentFacts.length && orderedRoles.every((role) => factsByRole.has(role)) && factsByRole.size === orderedRoles.length],
    ["input.componentFacts.atomicOnly", !componentFacts.some((fact) => fact.componentRole === "write-xhs-content" || /XhsPostPackage@2\.0/.test(fact.componentContract))],
    ["input.componentFacts.authorityBinding", componentFacts.every((fact) => fact.authorityBinding.family === "atomic_v2" && fact.authorityBinding.authorityHash === authorityHash)],
    ["input.assemblyOutput.hash", hashUnifiedContent(outputCopy) === outputHash],
    ["input.assemblyOutput.authorityBinding", componentMatchesAuthority(assemblyOutput.authorityBinding, componentFacts[0].authorityBinding)],
    ["input.assemblyOutput.componentRefs", object(assemblyOutput.componentRefs) && orderedRoles.every((role) => sameRef(assemblyOutput.componentRefs[role], factsByRole.get(role)?.componentRef))]
  ]);
  const assemblyValidationResult = validateAssembly(assemblyOutput);
  requirePaths(contract, [["input.validateAssembly.result", assemblyValidationResult === assemblyOutput || assemblyValidationResult === true]]);
  const orderedFacts = orderedRoles.map((role) => factsByRole.get(role));
  const draft = {
    schemaVersion: "1.0", contract, id, status: "validated", authorityBinding: clone(orderedFacts[0].authorityBinding),
    requiredRoles: orderedRoles,
    componentFactRefs: orderedFacts.map((fact) => ({ role: fact.componentRole, factRef: { id: fact.id, hash: fact.factHash }, componentContract: fact.componentContract, componentRef: clone(fact.componentRef) })),
    assembly: { assembler: assembler.name, version: assembler.version, outputContract: assemblyOutput.contract, outputRef: { id: assemblyOutput.id, hash: outputHash } }, factHash: ""
  };
  const value = withHash(draft, "factHash");
  validateDeterministicAssemblyFact(value);
  return deepFreeze(value);
}

const ASSEMBLY_FACT_V2_KEYS = ["schemaVersion", "contract", "id", "status", "authorityBinding", "requiredRoles", "componentFactRefs", "assembly", "factHash"];
const ASSEMBLY_COMPONENT_FACT_KINDS = new Set(["provider_component", "deterministic_component"]);

export function validateDeterministicAssemblyFactV2(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.assemblyFactV2;
  const refs = value?.componentFactRefs;
  const roles = Array.isArray(refs) ? refs.map((item) => item?.role) : [];
  requirePaths(contract, [
    ["$", exact(value, ASSEMBLY_FACT_V2_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "2.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.status", value?.status === "validated"],
    ["$.requiredRoles", Array.isArray(value?.requiredRoles) && value.requiredRoles.length > 0 && value.requiredRoles.every(text) && new Set(value.requiredRoles).size === value.requiredRoles.length && JSON.stringify(value.requiredRoles) === JSON.stringify([...value.requiredRoles].sort(compareCodePoints))],
    ["$.componentFactRefs", Array.isArray(refs) && refs.length > 0 && refs.every((item) => exact(item, ["role", "kind", "factContract", "factRef", "componentContract", "componentRef"]) && text(item.role) && ASSEMBLY_COMPONENT_FACT_KINDS.has(item.kind) && text(item.factContract) && ref(item.factRef) && text(item.componentContract) && ref(item.componentRef)
      && item.factContract === (item.kind === "provider_component" ? UNIFIED_EXECUTION_CONTRACTS.componentFact : UNIFIED_EXECUTION_CONTRACTS.deterministicComponentFact))],
    ["$.componentFactRefs[].role", roles.length === new Set(roles).size && JSON.stringify(roles) === JSON.stringify(value?.requiredRoles)],
    ["$.componentFactRefs.componentOnly", Array.isArray(refs) && !refs.some((item) => item.factContract === "UnifiedSkillOutputFact@1.0" || item.componentContract === "XhsPostPackage@2.0" || item.role === "write-xhs-content")],
    ["$.assembly", exact(value?.assembly, ["assembler", "version", "outputContract", "outputRef"]) && text(value.assembly.assembler) && text(value.assembly.version) && text(value.assembly.outputContract) && ref(value.assembly.outputRef)],
    ["$.assembly.outputContract", value?.assembly?.outputContract !== "XhsPostPackage@2.0"],
    ["$.factHash", validHash(value, "factHash")]
  ]);
  validateAuthority(value.authorityBinding, contract, "$.authorityBinding", "atomic_v2");
  return value;
}

function validateAssemblyV2Entry(entry, contract) {
  requirePaths(contract, [["input.componentEntries[]", exact(entry, ["role", "fact", "component", "componentHashField"]) && text(entry.role) && object(entry.fact) && object(entry.component) && text(entry.componentHashField)]]);
  let kind;
  if (entry.fact.contract === UNIFIED_EXECUTION_CONTRACTS.componentFact) {
    validateValidatedComponentFact(entry.fact);
    kind = "provider_component";
  } else if (entry.fact.contract === UNIFIED_EXECUTION_CONTRACTS.deterministicComponentFact) {
    validateDeterministicComponentFact(entry.fact);
    kind = "deterministic_component";
  } else {
    invalid(contract, ["input.componentEntries[].fact.contract"]);
  }
  const componentCopy = clone(entry.component);
  const componentHash = componentCopy?.[entry.componentHashField];
  if (object(componentCopy)) delete componentCopy[entry.componentHashField];
  requirePaths(contract, [
    ["input.componentEntries[].fact", isDeepFrozen(entry.fact)],
    ["input.componentEntries[].component", isDeepFrozen(entry.component)],
    ["input.componentEntries[].role", entry.fact.componentRole === entry.role],
    ["input.componentEntries[].component.contract", entry.component.contract === entry.fact.componentContract],
    ["input.componentEntries[].component.ref", entry.component.id === entry.fact.componentRef.id && componentHash === entry.fact.componentRef.hash],
    ["input.componentEntries[].component.hash", hash(componentHash) && object(componentCopy) && hashUnifiedContent(componentCopy) === componentHash],
    ["input.componentEntries[].component.authorityBinding", componentMatchesAuthority(entry.component.authorityBinding, entry.fact.authorityBinding)],
    ["input.componentEntries[].componentOnly", entry.fact.componentContract !== "XhsPostPackage@2.0" && entry.role !== "write-xhs-content"]
  ]);
  return { ...entry, kind };
}

export function createDeterministicAssemblyFactV2({ id, componentEntries, assemblySpec, assembler, validateAssembly, assemblyHashField }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.assemblyFactV2;
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.componentEntries", Array.isArray(componentEntries) && componentEntries.length > 0],
    ["input.assemblySpec", exact(assemblySpec, ["name", "version", "requiredRoles", "outputContract"]) && text(assemblySpec.name) && text(assemblySpec.version) && Array.isArray(assemblySpec.requiredRoles) && assemblySpec.requiredRoles.length > 0 && assemblySpec.requiredRoles.every(text) && new Set(assemblySpec.requiredRoles).size === assemblySpec.requiredRoles.length && text(assemblySpec.outputContract) && assemblySpec.outputContract !== "XhsPostPackage@2.0"],
    ["input.assembler", typeof assembler === "function"],
    ["input.validateAssembly", typeof validateAssembly === "function"],
    ["input.assemblyHashField", text(assemblyHashField)]
  ]);
  const requiredRoles = [...assemblySpec.requiredRoles].sort(compareCodePoints);
  const entries = componentEntries.map((entry) => validateAssemblyV2Entry(entry, contract));
  const entriesByRole = new Map(entries.map((entry) => [entry.role, entry]));
  const authorityHash = entries[0]?.fact.authorityBinding.authorityHash;
  requirePaths(contract, [
    ["input.componentEntries.roles", entriesByRole.size === entries.length && entriesByRole.size === requiredRoles.length && requiredRoles.every((role) => entriesByRole.has(role))],
    ["input.componentEntries.authorityBinding", entries.every((entry) => entry.fact.authorityBinding.authorityHash === authorityHash)],
    ["input.componentEntries.preflight", entries.filter((entry) => /preflight/i.test(entry.role)).every((entry) => entry.component.status === "passed")]
  ]);
  const components = deepFreeze(Object.fromEntries(requiredRoles.map((role) => [role, deepFreeze(clone(entriesByRole.get(role).component))])));
  let assemblyOutput;
  try {
    assemblyOutput = assembler(deepFreeze({ id, components }));
  } catch {
    invalid(contract, ["input.assembler.result"]);
  }
  requirePaths(contract, [
    ["input.assembler.result", object(assemblyOutput) && isDeepFrozen(assemblyOutput)],
    ["input.assembler.result.id", assemblyOutput?.id === id],
    ["input.assembler.result.contract", assemblyOutput?.contract === assemblySpec.outputContract],
    ["input.assembler.result.hash", hash(assemblyOutput?.[assemblyHashField])],
    ["input.assembler.result.authorityBinding", componentMatchesAuthority(assemblyOutput?.authorityBinding, entries[0].fact.authorityBinding)],
    ["input.assembler.result.componentRefs", object(assemblyOutput?.componentRefs)
      && Object.keys(assemblyOutput.componentRefs).length === requiredRoles.length
      && requiredRoles.every((role) => Object.hasOwn(assemblyOutput.componentRefs, role) && sameRef(assemblyOutput.componentRefs[role], entriesByRole.get(role).fact.componentRef))]
  ]);
  const outputCopy = clone(assemblyOutput);
  const outputHash = outputCopy[assemblyHashField];
  delete outputCopy[assemblyHashField];
  requirePaths(contract, [["input.assembler.result.hash", hashUnifiedContent(outputCopy) === outputHash]]);
  let validatorResult;
  try {
    validatorResult = validateAssembly(assemblyOutput);
  } catch {
    invalid(contract, ["input.validateAssembly.result"]);
  }
  requirePaths(contract, [["input.validateAssembly.result", validatorResult === assemblyOutput || validatorResult === true]]);
  const orderedEntries = requiredRoles.map((role) => entriesByRole.get(role));
  const fact = withHash({
    schemaVersion: "2.0", contract, id, status: "validated", authorityBinding: clone(orderedEntries[0].fact.authorityBinding), requiredRoles,
    componentFactRefs: orderedEntries.map((entry) => ({
      role: entry.role, kind: entry.kind, factContract: entry.fact.contract, factRef: { id: entry.fact.id, hash: entry.fact.factHash },
      componentContract: entry.fact.componentContract, componentRef: clone(entry.fact.componentRef)
    })),
    assembly: { assembler: assemblySpec.name, version: assemblySpec.version, outputContract: assemblyOutput.contract, outputRef: { id: assemblyOutput.id, hash: outputHash } }, factHash: ""
  }, "factHash");
  validateDeterministicAssemblyFactV2(fact);
  return deepFreeze({ assemblyOutput, fact: deepFreeze(fact) });
}

const CANDIDATE_KEYS = ["schemaVersion", "contract", "id", "platformRunRef", "authority", "candidateHash"];

export function validateUnifiedContentCandidateV2(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.candidate;
  const authority = value?.authority;
  requirePaths(contract, [
    ["$", exact(value, CANDIDATE_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "2.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.platformRunRef", ref(value?.platformRunRef)],
    ["$.authority.family", FAMILIES.has(authority?.family)],
    ["$.candidateHash", validHash(value, "candidateHash")]
  ]);
  if (authority?.family === "atomic_v2") {
    requirePaths(contract, [["$.authority", exact(authority, ["family", "assemblyFactRef"])], ["$.authority.assemblyFactRef", ref(authority?.assemblyFactRef)]]);
  } else if (authority?.family === "monolithic_v1") {
    const provenance = authority?.provenance;
    requirePaths(contract, [
      ["$.authority", exact(authority, ["family", "monolithicFactRef", "monolithicContract", "provenance"])],
      ["$.authority.monolithicFactRef", ref(authority?.monolithicFactRef)],
      ["$.authority.monolithicContract", text(authority?.monolithicContract)],
      ["$.authority.provenance", exact(provenance, ["kind", "readOnly", "promotionEligible", "nativeCandidateV2"])],
      ["$.authority.provenance.kind", provenance?.kind === "monolithic_candidate_v1_compatibility_adapter"],
      ["$.authority.provenance.readOnly", provenance?.readOnly === true],
      ["$.authority.provenance.promotionEligible", provenance?.promotionEligible === false],
      ["$.authority.provenance.nativeCandidateV2", provenance?.nativeCandidateV2 === false]
    ]);
  }
  return value;
}

export function createAtomicUnifiedContentCandidateV2({ id, platformRunRef, assemblyFact }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.candidate;
  validateDeterministicAssemblyFact(assemblyFact);
  requirePaths(contract, [
    ["input.id", text(id)], ["input.platformRunRef", ref(platformRunRef)], ["input.assemblyFact", isDeepFrozen(assemblyFact)],
    ["input.assemblyFact.monolithicRoleForbidden", !assemblyFact.componentFactRefs.some((item) => item.role === "write-xhs-content" || /XhsPostPackage@2\.0/.test(item.componentContract))]
  ]);
  const value = withHash({
    schemaVersion: "2.0", contract, id, platformRunRef: clone(platformRunRef),
    authority: { family: "atomic_v2", assemblyFactRef: { id: assemblyFact.id, hash: assemblyFact.factHash } }, candidateHash: ""
  }, "candidateHash");
  validateUnifiedContentCandidateV2(value);
  return deepFreeze(value);
}

const CANDIDATE_V3_KEYS = ["schemaVersion", "contract", "id", "companyId", "accountId", "platformRunRef", "authority", "mechanismExplanationRef", "candidateHash"];

export function validateUnifiedContentCandidateV3(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.candidateV3;
  const authority = value?.authority;
  requirePaths(contract, [
    ["$", exact(value, CANDIDATE_V3_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "3.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.companyId", text(value?.companyId)],
    ["$.accountId", text(value?.accountId)],
    ["$.platformRunRef", ref(value?.platformRunRef)],
    ["$.authority", exact(authority, ["family", "assemblyFactRef", "usageBindingRef"])],
    ["$.authority.family", authority?.family === "atomic_v2"],
    ["$.authority.assemblyFactRef", ref(authority?.assemblyFactRef)],
    ["$.authority.usageBindingRef", ref(authority?.usageBindingRef)],
    ["$.mechanismExplanationRef", ref(value?.mechanismExplanationRef)],
    ["$.candidateHash", validHash(value, "candidateHash")]
  ]);
  return value;
}

function authorityRef(authorityBinding, role) {
  return authorityBinding?.refs?.find((item) => item.role === role)?.ref || null;
}

export function createAtomicUnifiedContentCandidateV3({ id, platformRunRef, assemblyFact, usageBinding, mechanismExplanation }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.candidateV3;
  validateDeterministicAssemblyFactV2(assemblyFact);
  validateContentMechanismUsageBinding(usageBinding);
  validateMechanismExplanation(mechanismExplanation);
  const authority = assemblyFact.authorityBinding;
  const expectedRefs = [
    ["platformRunRef", platformRunRef],
    ["mechanismDecisionRef", usageBinding.decisionRef],
    ["sharedContentMasterRef", usageBinding.sharedContentMasterRef]
  ];
  requirePaths(contract, [
    ["input.id", text(id)],
    ["input.platformRunRef", ref(platformRunRef)],
    ["input.assemblyFact", isDeepFrozen(assemblyFact)],
    ["input.usageBinding", isDeepFrozen(usageBinding)],
    ["input.mechanismExplanation", isDeepFrozen(mechanismExplanation)],
    ["input.assemblyFact.family", authority.family === "atomic_v2"],
    ["input.companyId", authority.companyId === usageBinding.companyId],
    ["input.accountId", authority.accountId === usageBinding.accountId],
    ["input.platformRunRef.binding", sameRef(platformRunRef, usageBinding.platformRunRef)],
    ["input.writerContextRef", sameRef(authorityRef(authority, "writerContextRef"), usageBinding.creativeMechanism.writerContextRef)],
    ["input.mechanismExplanation.sourceBindingRef", sameRef(mechanismExplanation.sourceBindingRef, { id: usageBinding.id, hash: usageBinding.bindingHash })],
    ...expectedRefs.map(([role, expectedRef]) => [`input.authorityBinding.refs.${role}`, sameRef(authorityRef(authority, role), expectedRef)])
  ]);
  const value = withHash({
    schemaVersion: "3.0", contract, id,
    companyId: authority.companyId, accountId: authority.accountId,
    platformRunRef: clone(platformRunRef),
    authority: {
      family: "atomic_v2",
      assemblyFactRef: { id: assemblyFact.id, hash: assemblyFact.factHash },
      usageBindingRef: { id: usageBinding.id, hash: usageBinding.bindingHash }
    },
    mechanismExplanationRef: { id: mechanismExplanation.sourceBindingRef.id, hash: mechanismExplanation.explanationHash },
    candidateHash: ""
  }, "candidateHash");
  validateUnifiedContentCandidateV3(value);
  return deepFreeze(value);
}

const UNIFIED_SKILL_OUTPUT_FACT_KEYS = [
  "schemaVersion", "contract", "id", "invocationRef", "executionRecordRef", "platform", "stepId", "capability",
  "inputContract", "outputContract", "planRef", "bundleHash", "inputHash", "outputHash", "runtimeOutput",
  "verifiedDomainOutput", "executionMode", "status", "productionEligibleOutput", "factHash"
];
const LEGACY_WRITER_PLATFORMS = Object.freeze({ "write-xhs-content": Object.freeze(["xiaohongshu"]), "write-wechat-article": Object.freeze(["wechat", "wechat_official_account"]) });

export function validateLegacyMonolithicWriterFact(value) {
  const contract = "UnifiedSkillOutputFact@1.0";
  const output = value?.runtimeOutput;
  requirePaths(contract, [
    ["$", exact(value, UNIFIED_SKILL_OUTPUT_FACT_KEYS)],
    ["$.schemaVersion", value?.schemaVersion === "1.0"],
    ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)],
    ["$.invocationRef", ref(value?.invocationRef)],
    ["$.executionRecordRef", ref(value?.executionRecordRef)],
    ["$.capability", Object.hasOwn(LEGACY_WRITER_PLATFORMS, value?.capability)],
    ["$.platform", LEGACY_WRITER_PLATFORMS[value?.capability]?.includes(value?.platform) === true],
    ["$.stepId", text(value?.stepId)],
    ["$.inputContract", text(value?.inputContract)],
    ["$.outputContract", text(value?.outputContract)],
    ["$.planRef", ref(value?.planRef)],
    ["$.bundleHash", hash(value?.bundleHash)],
    ["$.inputHash", hash(value?.inputHash)],
    ["$.outputHash", hash(value?.outputHash) && object(output) && hashUnifiedContent(output) === value.outputHash],
    ["$.runtimeOutput", exact(output, ["status", "data", "warnings", "blocked_reasons"])],
    ["$.runtimeOutput.status", output?.status === "success"],
    ["$.runtimeOutput.data", object(output?.data)],
    ["$.runtimeOutput.warnings", Array.isArray(output?.warnings) && output.warnings.every((item) => typeof item === "string")],
    ["$.runtimeOutput.blocked_reasons", Array.isArray(output?.blocked_reasons) && output.blocked_reasons.every((item) => typeof item === "string") && output.blocked_reasons.length === 0],
    ["$.verifiedDomainOutput", value?.verifiedDomainOutput === null],
    ["$.executionMode", text(value?.executionMode)],
    ["$.status", value?.status === "completed"],
    ["$.productionEligibleOutput", typeof value?.productionEligibleOutput === "boolean"],
    ["$.factHash", validHash(value, "factHash")]
  ]);
  return value;
}

export function adaptMonolithicCandidateV1ReadOnly({ id, platformRunRef, monolithicFact }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.candidate;
  validateLegacyMonolithicWriterFact(monolithicFact);
  requirePaths(contract, [
    ["input.id", text(id)], ["input.platformRunRef", ref(platformRunRef)],
    ["input.monolithicFact", isDeepFrozen(monolithicFact)]
  ]);
  const value = withHash({
    schemaVersion: "2.0", contract, id, platformRunRef: clone(platformRunRef),
    authority: {
      family: "monolithic_v1", monolithicFactRef: { id: monolithicFact.id, hash: monolithicFact.factHash }, monolithicContract: monolithicFact.contract,
      provenance: { kind: "monolithic_candidate_v1_compatibility_adapter", readOnly: true, promotionEligible: false, nativeCandidateV2: false }
    }, candidateHash: ""
  }, "candidateHash");
  validateUnifiedContentCandidateV2(value);
  return deepFreeze(value);
}

const RUN_STATES = Object.freeze(["planned", "components_running", "components_validated", "assembly_validated", "candidate_ready", "user_review", "component_failed", "assembly_failed", "candidate_failed"]);
const NEXT_STATES = Object.freeze({
  planned: ["components_running"],
  components_running: ["components_validated", "component_failed"],
  components_validated: ["assembly_validated", "assembly_failed"],
  assembly_validated: ["candidate_ready", "candidate_failed"],
  candidate_ready: ["user_review"],
  user_review: [], component_failed: [], assembly_failed: [], candidate_failed: []
});
const GATES_BY_STATE = Object.freeze({
  planned: [], components_running: [], component_failed: [],
  components_validated: ["components"], assembly_failed: ["components"],
  assembly_validated: ["components", "assembly"], candidate_failed: ["components", "assembly"],
  candidate_ready: ["components", "assembly", "candidate"], user_review: ["components", "assembly", "candidate"]
});
const FAILURE_STAGE = Object.freeze({ component_failed: "components", assembly_failed: "assembly", candidate_failed: "candidate" });
const RUN_STATE_KEYS = ["schemaVersion", "contract", "id", "contentRunRef", "state", "completedGates", "previousStateRef", "transition", "failure", "stateHash"];

export function validateUnifiedContentRunState(value) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.runState;
  const transition = value?.transition;
  const expectedGates = GATES_BY_STATE[value?.state];
  const failureStage = FAILURE_STAGE[value?.state];
  requirePaths(contract, [
    ["$", exact(value, RUN_STATE_KEYS)], ["$.schemaVersion", value?.schemaVersion === "1.0"], ["$.contract", value?.contract === contract],
    ["$.id", text(value?.id)], ["$.contentRunRef", ref(value?.contentRunRef)], ["$.state", RUN_STATES.includes(value?.state)],
    ["$.completedGates", Array.isArray(value?.completedGates) && expectedGates && JSON.stringify(value.completedGates) === JSON.stringify(expectedGates)],
    ["$.previousStateRef", value?.previousStateRef === null || ref(value?.previousStateRef)],
    ["$.transition", exact(transition, ["from", "to", "eventRef"])],
    ["$.transition.from", transition?.from === null || RUN_STATES.includes(transition?.from)], ["$.transition.to", transition?.to === value?.state], ["$.transition.eventRef", ref(transition?.eventRef)],
    ["$.failure", failureStage ? exact(value?.failure, ["stage", "code", "evidenceRef"]) && value.failure.stage === failureStage && text(value.failure.code) && ref(value.failure.evidenceRef) : value?.failure === null],
    ["$.stateHash", validHash(value, "stateHash")]
  ]);
  if (transition?.from === null) {
    requirePaths(contract, [["$.state.initial", value.state === "planned" && value.previousStateRef === null]]);
  } else {
    requirePaths(contract, [["$.transition.allowed", NEXT_STATES[transition.from]?.includes(value.state) && ref(value.previousStateRef)]]);
  }
  return value;
}

export function createInitialUnifiedContentRunState({ id, contentRunRef, eventRef }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.runState;
  requirePaths(contract, [["input.id", text(id)], ["input.contentRunRef", ref(contentRunRef)], ["input.eventRef", ref(eventRef)]]);
  const value = withHash({
    schemaVersion: "1.0", contract, id, contentRunRef: clone(contentRunRef), state: "planned", completedGates: [], previousStateRef: null,
    transition: { from: null, to: "planned", eventRef: clone(eventRef) }, failure: null, stateHash: ""
  }, "stateHash");
  validateUnifiedContentRunState(value);
  return deepFreeze(value);
}

export function transitionUnifiedContentRunState(current, { toState, eventRef, failure = null }) {
  const contract = UNIFIED_EXECUTION_CONTRACTS.runState;
  validateUnifiedContentRunState(current);
  requirePaths(contract, [
    ["input.current", isDeepFrozen(current)], ["input.toState", RUN_STATES.includes(toState) && NEXT_STATES[current.state].includes(toState)], ["input.eventRef", ref(eventRef)]
  ]);
  const failureStage = FAILURE_STAGE[toState];
  requirePaths(contract, [["input.failure", failureStage ? exact(failure, ["stage", "code", "evidenceRef"]) && failure.stage === failureStage && text(failure.code) && ref(failure.evidenceRef) : failure === null]]);
  const value = withHash({
    schemaVersion: "1.0", contract, id: current.id, contentRunRef: clone(current.contentRunRef), state: toState,
    completedGates: clone(GATES_BY_STATE[toState]), previousStateRef: { id: current.id, hash: current.stateHash },
    transition: { from: current.state, to: toState, eventRef: clone(eventRef) }, failure: clone(failure), stateHash: ""
  }, "stateHash");
  validateUnifiedContentRunState(value);
  return deepFreeze(value);
}
