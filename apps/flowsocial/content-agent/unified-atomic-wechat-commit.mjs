import {
  hashUnifiedContent,
  validateContentMechanismDecisionV2,
  validateContentProject
} from "./unified-content-contracts.mjs";
import { validateSkillActivityInvocation } from "./unified-execution-contracts.mjs";
import { validateUnifiedSkillDomainOutput } from "./unified-skill-output-contracts.mjs";
import { hashWechatArtifactValue, projectWechatImageRuntimeCapability } from "./wechat-image-plan-adapter.mjs";
import { compileWechatRuntimeOutput } from "./wechat-creative-draft-compiler.mjs";

const CONTRACT = "UnifiedAtomicWechatContentCommit@1.0";
const HASH = /^[a-f0-9]{64}$/;
const STEPS = Object.freeze([
  Object.freeze({ stepId: "platform_writer", capability: "write-wechat-article", outputContract: "WechatArticle@2.0", role: "article" }),
  Object.freeze({ stepId: "wechat_content_review", capability: "review-wechat-article", outputContract: "WechatArticleReview@1.0", role: "articleReview" }),
  Object.freeze({ stepId: "image_plan", capability: "plan-wechat-images", outputContract: "WechatImagePlan@1.0", role: "imagePlan" })
]);
const ROOT_KEYS = Object.freeze([
  "schemaVersion", "contract", "id", "companyId", "accountId", "platform", "contentProjectRef", "materializedContentProjectRef",
  "platformRunRef", "contentProjectIdentity", "contentProject", "authorityBinding", "authorityInputs", "skillFacts", "compilerFacts",
  "materializedComponents", "authorityBoundary", "idempotencyKey", "commitHash"
]);
const INPUT_KEYS = Object.freeze([
  "id", "idempotencyKey", "contentProjectIdentity", "contentProject", "authorityBinding", "authorityInputs", "skillFacts"
]);
const OUTPUT_FACT_KEYS = Object.freeze([
  "schemaVersion", "contract", "id", "invocationRef", "executionRecordRef", "platform", "stepId", "capability", "inputContract",
  "outputContract", "planRef", "bundleHash", "inputHash", "outputHash", "runtimeOutput", "verifiedDomainOutput", "executionMode", "status",
  "productionEligibleOutput", "factHash"
]);
const FORBIDDEN_KEYS = new Set([
  "rawProviderEnvelope", "rawProviderPayload", "providerPayload", "providerEnvelope", "providerResponse", "providerMetadata",
  "apiKey", "appSecret", "accessToken", "refreshToken", "uploadMaterial", "uploadMaterials", "binary", "bytes", "buffer",
  "tempUrl", "temporaryUrl", "signedUrl", "presignedUrl", "mutableProjection"
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
  catch { fail("UNIFIED_ATOMIC_WECHAT_COMMIT_INVALID", ["$"]); }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function withoutHash(value, field) {
  const copy = clone(value);
  delete copy[field];
  return copy;
}

function hashed(value, field) {
  return HASH.test(value?.[field] || "") && hashUnifiedContent(withoutHash(value, field)) === value[field];
}

function declaredRef(value, field) {
  return { id: value?.id, hash: value?.[field] };
}

function authorityRef(binding, role) {
  return binding?.refs?.find((item) => item.role === role)?.ref || null;
}

function bareRef(value) {
  return { id: value?.id, hash: value?.hash };
}

function validateNoForbiddenPayload(value, path = "$", seen = new WeakSet()) {
  if (!value || typeof value !== "object") return;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || (typeof Blob !== "undefined" && value instanceof Blob)) {
    fail("UNIFIED_ATOMIC_WECHAT_FORBIDDEN_PAYLOAD", [path]);
  }
  if (seen.has(value)) fail("UNIFIED_ATOMIC_WECHAT_COMMIT_INVALID", [path]);
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) fail("UNIFIED_ATOMIC_WECHAT_FORBIDDEN_PAYLOAD", [`${path}.${key}`]);
    validateNoForbiddenPayload(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function containsWechatUpstreamViolation(value, path = "$", seen = new WeakSet()) {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return path;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (/^(?:xhs|xiaohongshu)(?:Output|Package|Candidate|Artifact|Ref|Authority)?$/i.test(key)
      || key === "sourcePlatformOutputRef"
      || (typeof child === "string" && /^(?:Xhs|Xiaohongshu).+@\d/i.test(child))) return childPath;
    const nested = containsWechatUpstreamViolation(child, childPath, seen);
    if (nested) return nested;
  }
  seen.delete(value);
  return null;
}

function validateIdentity(value) {
  if (!exact(value, ["id", "companyId", "contentOpportunityRef", "activeStrategySnapshotRef", "identityHash"])
    || !text(value.id) || !text(value.companyId) || !ref(value.contentOpportunityRef) || !ref(value.activeStrategySnapshotRef)
    || !hashed(value, "identityHash")) fail("UNIFIED_ATOMIC_WECHAT_PROJECT_IDENTITY_INVALID", ["$.contentProjectIdentity"]);
}

function validateAuthorityBinding(value) {
  const roles = [
    "contentOpportunityRef", "activeStrategySnapshotRef", "contentProjectRef", "platformRunRef", "sharedContentMasterRef",
    "mechanismDecisionRef", "sourcePlanRef", "platformBriefRef", "confirmedOutlineRef", "writerContextRef"
  ];
  if (!exact(value, ["family", "companyId", "accountId", "refs", "authorityHash"])
    || value.family !== "atomic_v2"
    || !text(value.companyId) || !text(value.accountId) || !Array.isArray(value.refs) || value.refs.length !== roles.length
    || roles.some((role) => value.refs.filter((item) => exact(item, ["role", "ref"]) && item.role === role && ref(item.ref)).length !== 1)
    || !hashed(value, "authorityHash")) fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_INVALID", ["$.authorityBinding"]);
}

function validateOutputFact(fact, invocation, spec) {
  if (!exact(fact, OUTPUT_FACT_KEYS) || fact.schemaVersion !== "1.0" || fact.contract !== "UnifiedSkillOutputFact@1.0"
    || fact.platform !== "wechat" || fact.stepId !== spec.stepId || fact.capability !== spec.capability || fact.outputContract !== spec.outputContract
    || fact.status !== "completed" || fact.executionMode !== "real" || fact.productionEligibleOutput !== true
    || !ref(fact.invocationRef) || !sameRef(fact.invocationRef, declaredRef(invocation, "invocationHash"))
    || fact.inputHash !== invocation.inputRef.hash || !ref(fact.executionRecordRef) || !ref(fact.planRef)
    || fact.planRef.hash !== invocation.planHash || !HASH.test(fact.bundleHash || "") || !HASH.test(fact.outputHash || "")
    || !exact(fact.runtimeOutput, ["status", "data", "warnings", "blocked_reasons"])
    || fact.runtimeOutput.status !== "success" || fact.runtimeOutput.blocked_reasons.length !== 0
    || hashUnifiedContent(fact.runtimeOutput) !== fact.outputHash || !hashed(fact, "factHash")) {
    fail("UNIFIED_ATOMIC_WECHAT_SKILL_OUTPUT_FACT_INVALID", [`$.skillFacts.${spec.role}.outputFact`]);
  }
}

function domainInputs(inputs, article = null, review = null, { includeImageRuntime = true } = {}) {
  const common = {
    platform: "wechat_official_account",
    content_master: clone(inputs.sharedContentMaster.contentMaster || inputs.sharedContentMaster),
    platform_brief: clone(inputs.platformBrief),
    confirmed_outline: clone(inputs.confirmedOutline),
    writer_context: clone(inputs.writerContext)
  };
  if (!article) return common;
  if (!review) return { ...common, mode: "report_only", article: clone(article) };
  const authorizedAssets = clone(inputs.platformBrief?.brief?.authorized_assets || inputs.platformBrief?.authorized_assets || []);
  return {
    ...common,
    article: clone(article),
    article_review: clone(review),
    authorized_assets: authorizedAssets,
    ...(includeImageRuntime ? { image_runtime: clone(inputs.imageRuntimeCapability || projectWechatImageRuntimeCapability(authorizedAssets)) } : {})
  };
}

function validateSkillFacts(value, inputs, authority) {
  if (!exact(value, STEPS.map((item) => item.role))) fail("UNIFIED_ATOMIC_WECHAT_SKILL_FACT_SET_INVALID", ["$.skillFacts"]);
  let article = null;
  let review = null;
  let imagePlan = null;
  for (let index = 0; index < STEPS.length; index += 1) {
    const spec = STEPS[index];
    const entry = value[spec.role];
    const currentSkillInput = domainInputs(inputs, article, review);
    const legacySkillInput = spec.role === "imagePlan" ? domainInputs(inputs, article, review, { includeImageRuntime: false }) : null;
    const sourceSkillInput = legacySkillInput && entry?.invocation?.inputRef?.hash === hashUnifiedContent(legacySkillInput)
      ? legacySkillInput : currentSkillInput;
    if (!exact(entry, ["ordinal", "stepId", "capability", "invocation", "outputFact"])
      || entry.ordinal !== index + 1 || entry.stepId !== spec.stepId || entry.capability !== spec.capability) {
      fail("UNIFIED_ATOMIC_WECHAT_SKILL_ORDER_INVALID", [`$.skillFacts.${spec.role}`]);
    }
    try { validateSkillActivityInvocation(entry.invocation); }
    catch { fail("UNIFIED_ATOMIC_WECHAT_SKILL_INVOCATION_INVALID", [`$.skillFacts.${spec.role}.invocation`]); }
    if (entry.invocation.skill?.name !== spec.capability || entry.invocation.planHash !== value.article.invocation.planHash
      || entry.invocation.attemptPolicy?.maxProviderCalls !== 1 || entry.invocation.attemptPolicy?.automaticRetries !== 0
      || entry.invocation.authorityBinding?.authorityHash !== authority.authorityHash
      || entry.invocation.inputRef.hash !== hashUnifiedContent(sourceSkillInput)) {
      fail("UNIFIED_ATOMIC_WECHAT_SKILL_INVOCATION_INVALID", [`$.skillFacts.${spec.role}.invocation`]);
    }
    validateOutputFact(entry.outputFact, entry.invocation, spec);
    let verified;
    try {
      verified = validateUnifiedSkillDomainOutput({
        capability: spec.capability,
        platform: "wechat",
        outputContract: spec.outputContract,
        runtimeOutput: entry.outputFact.runtimeOutput,
        sourceContentMaster: inputs.sharedContentMaster.contentMaster || inputs.sharedContentMaster,
        sourceSkillInput,
        sourceArticle: article,
        task: spec.role === "article" ? "write_wechat_narrative_creative_draft" : null
      });
    } catch (error) {
      const failure = Object.assign(new Error("UNIFIED_ATOMIC_WECHAT_SKILL_OUTPUT_INVALID"), {
        code: "UNIFIED_ATOMIC_WECHAT_SKILL_OUTPUT_INVALID", statusCode: 409,
        details: { fieldPaths: [`$.skillFacts.${spec.role}.outputFact.runtimeOutput`], causeCode: error?.code || null, causeFieldPaths: error?.details?.fieldPaths || [] }
      });
      throw failure;
    }
    if (spec.role === "article") article = compileWechatRuntimeOutput(entry.outputFact.runtimeOutput, {
      sourceContentMaster: inputs.sharedContentMaster.contentMaster || inputs.sharedContentMaster,
      sourceSkillInput
    });
    if (spec.role === "articleReview") review = verified;
    if (spec.role === "imagePlan") imagePlan = verified;
    if (spec.role === "imagePlan" && hashUnifiedContent(entry.outputFact.verifiedDomainOutput) !== hashUnifiedContent(verified)) {
      fail("UNIFIED_ATOMIC_WECHAT_SKILL_OUTPUT_INVALID", ["$.skillFacts.imagePlan.outputFact.verifiedDomainOutput"]);
    }
    if (spec.role !== "imagePlan" && entry.outputFact.verifiedDomainOutput !== null) {
      fail("UNIFIED_ATOMIC_WECHAT_SKILL_OUTPUT_INVALID", [`$.skillFacts.${spec.role}.outputFact.verifiedDomainOutput`]);
    }
  }
  return { article, review, imagePlan };
}

function validateAuthorityInputs(inputs, binding) {
  const keys = ["sharedContentMaster", "mechanismDecision", "sourcePlan", "platformBrief", "confirmedOutline", "writerContext"];
  const exactAuthorityShape = exact(inputs, keys) || exact(inputs, [...keys, "imageRuntimeCapability"]);
  if (!exactAuthorityShape || !object(inputs.sharedContentMaster) || !object(inputs.sourcePlan) || !object(inputs.platformBrief)
    || !object(inputs.confirmedOutline) || !object(inputs.writerContext)) fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_INPUTS_INVALID", ["$.authorityInputs"]);
  if (inputs.imageRuntimeCapability != null) {
    const capability = inputs.imageRuntimeCapability;
    const declaresIllustratedRequirement = Object.hasOwn(capability, "illustrated_delivery_required")
      || Object.hasOwn(capability, "minimum_inline_images");
    if (!object(capability) || !Array.isArray(capability.allowed_strategies)
      || typeof capability.generated_raster_available !== "boolean"
      || (declaresIllustratedRequirement && (capability.illustrated_delivery_required !== true
        || !Number.isInteger(capability.minimum_inline_images) || capability.minimum_inline_images < 1))
      || !text(capability.html_chart_mode) || !text(capability.instruction)
      || capability.allowed_strategies.includes("generated_raster") !== capability.generated_raster_available) {
      fail("UNIFIED_ATOMIC_WECHAT_IMAGE_RUNTIME_CAPABILITY_INVALID", ["$.authorityInputs.imageRuntimeCapability"]);
    }
  }
  try { validateContentMechanismDecisionV2(inputs.mechanismDecision); }
  catch { fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_INPUTS_INVALID", ["$.authorityInputs.mechanismDecision"]); }
  const upstreamViolation = ["sharedContentMaster", "mechanismDecision", "sourcePlan", "platformBrief", "confirmedOutline", "writerContext"]
    .map((key) => containsWechatUpstreamViolation(inputs[key], `$.authorityInputs.${key}`)).find(Boolean);
  if (upstreamViolation) fail("UNIFIED_ATOMIC_WECHAT_CROSS_PLATFORM_UPSTREAM_FORBIDDEN", [upstreamViolation]);
  const expected = {
    sharedContentMasterRef: { id: inputs.sharedContentMaster.id, hash: hashUnifiedContent(inputs.sharedContentMaster) },
    mechanismDecisionRef: declaredRef(inputs.mechanismDecision, "decisionHash"),
    sourcePlanRef: { id: authorityRef(binding, "sourcePlanRef")?.id, hash: hashUnifiedContent(inputs.sourcePlan) },
    platformBriefRef: { id: inputs.platformBrief.id, hash: hashUnifiedContent(inputs.platformBrief) },
    confirmedOutlineRef: { id: inputs.confirmedOutline.outline_id || inputs.confirmedOutline.id, hash: hashUnifiedContent(inputs.confirmedOutline) },
    writerContextRef: { id: authorityRef(binding, "writerContextRef")?.id, hash: inputs.writerContext.writerContextHash }
  };
  const mismatches = Object.entries(expected).filter(([role, value]) => !sameRef(authorityRef(binding, role), value)).map(([role]) => `$.authorityBinding.refs.${role}`);
  if (mismatches.length) fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_INPUT_REF_MISMATCH", mismatches);
  if (inputs.platformBrief.platform !== "wechat" || !sameRef(inputs.platformBrief.sharedContentMasterRef, expected.sharedContentMasterRef)
    || inputs.platformBrief.accountId !== binding.accountId
    || inputs.confirmedOutline.platform !== "wechat" || inputs.writerContext.platform !== "wechat_official_account"
    || inputs.writerContext.account_id !== binding.accountId || !hashed(inputs.writerContext, "writerContextHash")) {
    fail("UNIFIED_ATOMIC_WECHAT_PLATFORM_AUTHORITY_INVALID", ["$.authorityInputs"]);
  }
  const writerRefs = inputs.writerContext.authority_refs;
  const writerChecks = [
    ["activeStrategySnapshotRef", authorityRef(binding, "activeStrategySnapshotRef")],
    ["contentOpportunityRef", authorityRef(binding, "contentOpportunityRef")],
    ["mechanismDecisionRef", expected.mechanismDecisionRef], ["sharedContentMasterRef", expected.sharedContentMasterRef],
    ["platformBriefRef", expected.platformBriefRef], ["confirmedOutlineRef", expected.confirmedOutlineRef]
  ];
  if (writerChecks.some(([role, value]) => !sameRef(writerRefs?.[role], value))) {
    fail("UNIFIED_ATOMIC_WECHAT_WRITER_CONTEXT_AUTHORITY_MISMATCH", ["$.authorityInputs.writerContext.authority_refs"]);
  }
  const sourcePlanRefs = Array.isArray(inputs.sourcePlan.frozenSourceRefs) ? inputs.sourcePlan.frozenSourceRefs : [];
  const selectedRefs = inputs.mechanismDecision.selectedSourceRefs;
  const refKeys = (refs) => refs.map((item) => `${item.id}:${item.hash}`).sort();
  if (JSON.stringify(refKeys(sourcePlanRefs)) !== JSON.stringify(refKeys(selectedRefs))) {
    fail("UNIFIED_ATOMIC_WECHAT_SOURCE_AUTHORITY_MISMATCH", ["$.authorityInputs.sourcePlan.frozenSourceRefs", "$.authorityInputs.mechanismDecision.selectedSourceRefs"]);
  }
}

function materializeComponents(skillFacts, values, authorityHash) {
  const articleBase = {
    schemaVersion: "1.0", contract: "WechatAtomicArticle@1.0", id: `wechat-article:${skillFacts.article.outputFact.id}`,
    authorityHash, sourceOutputFactRef: declaredRef(skillFacts.article.outputFact, "factHash"), article: clone(values.article)
  };
  const article = { ...articleBase, componentHash: hashUnifiedContent(articleBase) };
  const reviewBase = {
    schemaVersion: "1.0", contract: "WechatAtomicArticleReview@1.0", id: `wechat-review:${skillFacts.articleReview.outputFact.id}`,
    authorityHash, sourceOutputFactRef: declaredRef(skillFacts.articleReview.outputFact, "factHash"), articleRef: declaredRef(article, "componentHash"),
    review: clone(values.review)
  };
  const articleReview = { ...reviewBase, componentHash: hashUnifiedContent(reviewBase) };
  const imageBase = {
    schemaVersion: "1.0", contract: "WechatAtomicCanonicalImagePlan@1.0", id: `wechat-image-plan:${values.imagePlan.planId}`,
    authorityHash, sourceOutputFactRef: declaredRef(skillFacts.imagePlan.outputFact, "factHash"), articleRef: declaredRef(article, "componentHash"),
    articleReviewRef: declaredRef(articleReview, "componentHash"), canonicalPlan: clone(values.imagePlan)
  };
  const imagePlan = { ...imageBase, componentHash: hashUnifiedContent(imageBase) };
  return { article, articleReview, imagePlan };
}

function compileFacts(skillFacts, components, authorityHash) {
  const skillOutputFactRefs = STEPS.map(({ role }) => declaredRef(skillFacts[role].outputFact, "factHash"));
  const traceBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicWechatCompilerFact@1.0", id: `wechat-trace:${authorityHash.slice(0, 24)}`,
    kind: "deterministic_compiler", role: "traceability", compiler: { name: "compileUnifiedAtomicWechatTraceability", version: "1.0.0" },
    authorityHash, inputRefs: skillOutputFactRefs, outputRefs: [declaredRef(components.article, "componentHash"), declaredRef(components.articleReview, "componentHash"), declaredRef(components.imagePlan, "componentHash")],
    status: "compiled"
  };
  const traceability = { ...traceBase, factHash: hashUnifiedContent(traceBase) };
  const preflightBase = {
    schemaVersion: "1.0", contract: "UnifiedAtomicWechatCompilerFact@1.0", id: `wechat-preflight:${authorityHash.slice(0, 24)}`,
    kind: "deterministic_compiler", role: "preflight", compiler: { name: "compileUnifiedAtomicWechatPreflight", version: "1.0.0" },
    authorityHash, inputRefs: [declaredRef(traceability, "factHash"), ...skillOutputFactRefs], outputRefs: [declaredRef(components.imagePlan, "componentHash")],
    status: "passed"
  };
  return { traceability, preflight: { ...preflightBase, factHash: hashUnifiedContent(preflightBase) } };
}

function validateDerived(value, expected) {
  if (hashUnifiedContent(value.materializedComponents) !== hashUnifiedContent(expected.materializedComponents)) {
    fail("UNIFIED_ATOMIC_WECHAT_COMPONENT_CLOSURE_INVALID", ["$.materializedComponents"]);
  }
  if (hashUnifiedContent(value.compilerFacts) !== hashUnifiedContent(expected.compilerFacts)
    || Object.values(value.compilerFacts).some((fact) => fact.kind !== "deterministic_compiler" || !hashed(fact, "factHash"))) {
    fail("UNIFIED_ATOMIC_WECHAT_COMPILER_FACT_INVALID", ["$.compilerFacts"]);
  }
  if (value.materializedComponents.imagePlan.canonicalPlan.contract !== "WechatCanonicalImagePlan@1.0"
    || value.materializedComponents.imagePlan.canonicalPlan.authority !== true
    || value.materializedComponents.imagePlan.canonicalPlan.planHash !== hashWechatArtifactValue(withoutHash(value.materializedComponents.imagePlan.canonicalPlan, "planHash"))) {
    fail("UNIFIED_ATOMIC_WECHAT_IMAGE_PLAN_INVALID", ["$.materializedComponents.imagePlan.canonicalPlan"]);
  }
}

export function validateUnifiedAtomicWechatContentCommit(value) {
  if (!exact(value, ROOT_KEYS) || value.schemaVersion !== "1.0" || value.contract !== CONTRACT || value.platform !== "wechat"
    || !text(value.id) || !text(value.companyId) || !text(value.accountId) || !text(value.idempotencyKey)
    || !ref(value.contentProjectRef) || !ref(value.materializedContentProjectRef) || !ref(value.platformRunRef)) {
    fail("UNIFIED_ATOMIC_WECHAT_COMMIT_INVALID", ["$"]);
  }
  if (!hashed(value, "commitHash")) fail("UNIFIED_ATOMIC_WECHAT_COMMIT_HASH_MISMATCH", ["$.commitHash"]);
  validateNoForbiddenPayload(value);
  validateIdentity(value.contentProjectIdentity);
  try { validateContentProject(value.contentProject); }
  catch (error) {
    throw Object.assign(new Error("UNIFIED_ATOMIC_WECHAT_CONTENT_PROJECT_INVALID"), {
      code: "UNIFIED_ATOMIC_WECHAT_CONTENT_PROJECT_INVALID", statusCode: 409,
      details: { fieldPaths: ["$.contentProject"], causeCode: error?.message || error?.code || null }
    });
  }
  validateAuthorityBinding(value.authorityBinding);
  validateAuthorityInputs(value.authorityInputs, value.authorityBinding);
  const refs = Object.fromEntries(value.authorityBinding.refs.map((item) => [item.role, item.ref]));
  const run = value.contentProject.platformRuns.find((item) => item.platform === "wechat");
  const closure = [
    ["$.companyId", value.companyId === value.contentProject.companyId && value.companyId === value.contentProjectIdentity.companyId && value.companyId === value.authorityBinding.companyId],
    ["$.accountId", value.accountId === value.authorityBinding.accountId && run?.accountId === value.accountId],
    ["$.contentProjectRef", sameRef(value.contentProjectRef, declaredRef(value.contentProjectIdentity, "identityHash")) && sameRef(value.contentProjectRef, refs.contentProjectRef)],
    ["$.materializedContentProjectRef", sameRef(value.materializedContentProjectRef, declaredRef(value.contentProject, "projectHash"))],
    ["$.platformRunRef", Boolean(run) && sameRef(value.platformRunRef, bareRef(run)) && sameRef(value.platformRunRef, refs.platformRunRef)],
    ["$.contentOpportunityRef", sameRef(value.contentProject.contentOpportunityRef, value.contentProjectIdentity.contentOpportunityRef) && sameRef(refs.contentOpportunityRef, value.contentProjectIdentity.contentOpportunityRef)],
    ["$.activeStrategySnapshotRef", sameRef(value.contentProject.activeStrategySnapshotRef, value.contentProjectIdentity.activeStrategySnapshotRef) && sameRef(refs.activeStrategySnapshotRef, value.contentProjectIdentity.activeStrategySnapshotRef)],
    ["$.sharedContentMasterRef", sameRef(bareRef(value.contentProject.sharedContentMasterRef), refs.sharedContentMasterRef) && sameRef(bareRef(run?.sharedContentMasterRef), refs.sharedContentMasterRef)],
    ["$.platformRunRef.writerInvocationRef", sameRef(run?.writerInvocationRef, declaredRef(value.skillFacts?.article?.invocation, "invocationHash"))]
  ];
  const failures = closure.filter(([, passed]) => !passed).map(([path]) => path);
  if (failures.length) fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_CLOSURE_INVALID", failures);
  const values = validateSkillFacts(value.skillFacts, value.authorityInputs, value.authorityBinding);
  const materializedComponents = materializeComponents(value.skillFacts, values, value.authorityBinding.authorityHash);
  const compilerFacts = compileFacts(value.skillFacts, materializedComponents, value.authorityBinding.authorityHash);
  validateDerived(value, { materializedComponents, compilerFacts });
  if (!exact(value.authorityBoundary, ["productProjectionAuthority", "artifactAuthority", "humanReviewAuthority", "promotionAuthority", "publicationPerformed"])
    || Object.values(value.authorityBoundary).some((item) => item !== false)) {
    fail("UNIFIED_ATOMIC_WECHAT_AUTHORITY_BOUNDARY_INVALID", ["$.authorityBoundary"]);
  }
  return value;
}

export function createUnifiedAtomicWechatContentCommit(input) {
  if (!exact(input, INPUT_KEYS)) fail("UNIFIED_ATOMIC_WECHAT_COMMIT_INPUT_INVALID", ["$"]);
  const frozen = deepFreeze(clone(input));
  validateIdentity(frozen.contentProjectIdentity);
  validateAuthorityBinding(frozen.authorityBinding);
  validateAuthorityInputs(frozen.authorityInputs, frozen.authorityBinding);
  const values = validateSkillFacts(frozen.skillFacts, frozen.authorityInputs, frozen.authorityBinding);
  const materializedComponents = materializeComponents(frozen.skillFacts, values, frozen.authorityBinding.authorityHash);
  const compilerFacts = compileFacts(frozen.skillFacts, materializedComponents, frozen.authorityBinding.authorityHash);
  const draft = {
    schemaVersion: "1.0", contract: CONTRACT, id: frozen.id,
    companyId: frozen.authorityBinding.companyId, accountId: frozen.authorityBinding.accountId, platform: "wechat",
    contentProjectRef: declaredRef(frozen.contentProjectIdentity, "identityHash"),
    materializedContentProjectRef: declaredRef(frozen.contentProject, "projectHash"),
    platformRunRef: clone(authorityRef(frozen.authorityBinding, "platformRunRef")),
    contentProjectIdentity: clone(frozen.contentProjectIdentity), contentProject: clone(frozen.contentProject),
    authorityBinding: clone(frozen.authorityBinding), authorityInputs: clone(frozen.authorityInputs), skillFacts: clone(frozen.skillFacts),
    compilerFacts, materializedComponents,
    authorityBoundary: { productProjectionAuthority: false, artifactAuthority: false, humanReviewAuthority: false, promotionAuthority: false, publicationPerformed: false },
    idempotencyKey: frozen.idempotencyKey
  };
  const value = deepFreeze({ ...draft, commitHash: hashUnifiedContent(draft) });
  validateUnifiedAtomicWechatContentCommit(value);
  return value;
}

export function createUnifiedAtomicWechatSkillFactFromControlled({ ordinal, step, invocation, controlledOutputFact }) {
  const spec = STEPS[ordinal - 1];
  if (!spec || step?.id !== spec.stepId || step?.capability !== spec.capability
    || controlledOutputFact?.contract !== "UnifiedSkillOutputFact@1.0"
    || controlledOutputFact.platform !== "wechat" || controlledOutputFact.stepId !== spec.stepId
    || controlledOutputFact.capability !== spec.capability || controlledOutputFact.outputContract !== spec.outputContract
    || controlledOutputFact.inputHash !== invocation?.inputRef?.hash || controlledOutputFact.planRef?.hash !== invocation?.planHash
    || controlledOutputFact.executionMode !== "real" || controlledOutputFact.status !== "completed"
    || controlledOutputFact.productionEligibleOutput !== true || hashUnifiedContent(controlledOutputFact.runtimeOutput) !== controlledOutputFact.outputHash) {
    fail("UNIFIED_ATOMIC_WECHAT_CONTROLLED_OUTPUT_FACT_INVALID", ["controlledOutputFact"]);
  }
  const outputBase = {
    schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0",
    id: `atomic_wechat_output_fact:${invocation.id}`,
    invocationRef: declaredRef(invocation, "invocationHash"), executionRecordRef: clone(controlledOutputFact.executionRecordRef),
    platform: "wechat", stepId: spec.stepId, capability: spec.capability,
    inputContract: step.inputContract, outputContract: spec.outputContract,
    planRef: clone(controlledOutputFact.planRef), bundleHash: controlledOutputFact.bundleHash,
    inputHash: controlledOutputFact.inputHash, outputHash: controlledOutputFact.outputHash,
    runtimeOutput: clone(controlledOutputFact.runtimeOutput), verifiedDomainOutput: clone(controlledOutputFact.verifiedDomainOutput),
    executionMode: controlledOutputFact.executionMode, status: controlledOutputFact.status,
    productionEligibleOutput: controlledOutputFact.productionEligibleOutput
  };
  const outputFact = deepFreeze({ ...outputBase, factHash: hashUnifiedContent(outputBase) });
  validateOutputFact(outputFact, invocation, spec);
  return deepFreeze({ ordinal, stepId: spec.stepId, capability: spec.capability, invocation: clone(invocation), outputFact });
}
