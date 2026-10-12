import {
  appendUnifiedProductionRevision,
  appendUnifiedPromptCostApproval,
  getUnifiedProductionLifecycleState
} from "../contracts/unified-production-lifecycle-contract.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { getUnifiedAtomicMultiplatformProduct } from "./unified-atomic-multiplatform-product.mjs";
import { validateUnifiedSkillDomainOutput } from "./unified-skill-output-contracts.mjs";
import { hashWechatArtifactValue } from "./wechat-image-plan-adapter.mjs";
import { projectWechatGeneratedImageState } from "./wechat-generated-raster-runtime.mjs";

const CONTRACT = "UnifiedWechatProductionControl@1.0";
const REQUEST_CONTRACT = "UnifiedProductionRevisionRequest@1.0";
const PROMPT_PLAN_CONTRACT = "UnifiedWechatPromptPlan@1.0";
const COST_PLAN_CONTRACT = "UnifiedWechatCostPlan@1.0";
const EXECUTION_CONTRACT = "UnifiedWechatRevisionExecution@1.0";

function fail(code, message = code, statusCode = 409) {
  throw Object.assign(new Error(message), { code, statusCode });
}
function clone(value) { return structuredClone(value); }
function text(value, code) { if (typeof value !== "string" || !value.trim()) fail(code, code, 400); return value.trim(); }
function ref(value) { return Boolean(value?.id && /^[a-f0-9]{64}$/.test(value?.hash || "")); }
function sameRef(left, right) { return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash; }
function factRef(value, hashField = "factHash") { return { id: value.id, hash: value[hashField] }; }
function hashed(base, hashField = "factHash") { return { ...base, [hashField]: hashUnifiedContent(base) }; }
function nowValue(value) { const result = text(value, "UNIFIED_PRODUCTION_CONTROL_TIME_REQUIRED"); if (Number.isNaN(Date.parse(result))) fail("UNIFIED_PRODUCTION_CONTROL_TIME_INVALID", undefined, 400); return result; }
function scope(projectId) { return { projectId: text(projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED"), platform: "wechat" }; }

function productAuthority(store, projectId, dependencies = {}) {
  const product = (dependencies.getProduct || getUnifiedAtomicMultiplatformProduct)(store, projectId);
  if (!product) fail("UNIFIED_PRODUCTION_CONTROL_PROJECT_NOT_FOUND", undefined, 404);
  const wechat = product.platforms?.wechat;
  if (wechat?.state !== "materialized" || !ref(product.productIdentityRef) || !ref(wechat.articleRef) || !ref(wechat.imagePlanRef)) {
    fail("UNIFIED_PRODUCTION_CONTROL_WECHAT_NOT_MATERIALIZED");
  }
  return { product, wechat };
}

function latestRevision(store, projectId) {
  return (store.unifiedProductionRevisions || []).filter((item) => item.projectId === projectId && item.platform === "wechat").at(-1) || null;
}

function currentVisualRevisionRef(store, projectId) {
  return getUnifiedProductionLifecycleState(store, scope(projectId)).revisionHeads.visual;
}

function publishCollections(store, prospective, names) {
  for (const name of names) store[name] = clone(prospective[name] || []);
}

function withoutHash(value, field) {
  const copy = clone(value);
  delete copy[field];
  return copy;
}

export function validateUnifiedWechatRevisionExecution(value) {
  if (value?.schemaVersion !== "1.0" || value.contract !== EXECUTION_CONTRACT || value.status !== "completed"
    || typeof value.projectId !== "string" || !value.projectId.trim() || value.platform !== "wechat"
    || !ref(value.requestRef) || !ref(value.productRef) || !ref(value.commitRef) || !ref(value.parentVersionRef)
    || !ref(value.articleRef) || !ref(value.imagePlanRef) || !ref(value.visualPlanRef) || !["copy", "visual"].includes(value.layer)
    || !/^[a-f0-9]{64}$/.test(value.requestHash || "") || typeof value.idempotencyKey !== "string" || !value.idempotencyKey.trim()
    || typeof value.executedBy !== "string" || !value.executedBy.trim() || Number.isNaN(Date.parse(value.executedAt || ""))
    || value.providerCalls !== 0 || value.platformCalls !== 0 || hashUnifiedContent(withoutHash(value, "factHash")) !== value.factHash) {
    fail("UNIFIED_PRODUCTION_REVISION_EXECUTION_INVALID");
  }
  for (const [component, hashField, expected] of [[value.article, "componentHash", value.articleRef], [value.canonicalImagePlan, "componentHash", value.imagePlanRef]]) {
    if (!component || hashUnifiedContent(withoutHash(component, hashField)) !== component[hashField]
      || component.id !== expected.id || component[hashField] !== expected.hash) fail("UNIFIED_PRODUCTION_REVISION_COMPONENT_INVALID");
  }
  if (!sameRef(value.canonicalImagePlan.articleRef, value.articleRef)
    || value.canonicalImagePlan.canonicalPlan?.planHash !== hashWechatArtifactValue(withoutHash(value.canonicalImagePlan.canonicalPlan, "planHash"))) {
    fail("UNIFIED_PRODUCTION_REVISION_COMPONENT_CLOSURE_INVALID");
  }
  return true;
}

function completedExecutions(store, projectId) {
  return (store.unifiedWechatRevisionExecutions || []).filter((item) => item.projectId === projectId && item.platform === "wechat")
    .map((item) => { validateUnifiedWechatRevisionExecution(item); return item; });
}

export function resolveUnifiedWechatProductionVersion(store, projectId, dependencies = {}) {
  const { product, wechat } = productAuthority(store, projectId, dependencies);
  const executions = completedExecutions(store, projectId);
  let expectedParent = wechat.articleRef;
  for (const execution of executions) {
    if (!sameRef(execution.parentVersionRef, expectedParent)
      || !sameRef(execution.productRef, { id: product.id, hash: product.aggregateHash })
      || !sameRef(execution.commitRef, product.commitRefs.wechat)) fail("UNIFIED_PRODUCTION_REVISION_CHAIN_INVALID");
    expectedParent = factRef(execution);
  }
  const latest = executions.at(-1) || null;
  if (!latest) return {
    kind: "base_commit", versionRef: clone(wechat.articleRef), articleRef: clone(wechat.articleRef), imagePlanRef: clone(wechat.imagePlanRef), visualPlanRef: clone(wechat.imagePlanRef),
    article: clone(wechat.article), canonicalImagePlan: clone(wechat.canonicalImagePlan), revisionExecution: null
  };
  if (!sameRef(latest.productRef, { id: product.id, hash: product.aggregateHash }) || !sameRef(latest.commitRef, product.commitRefs.wechat)) {
    fail("UNIFIED_PRODUCTION_REVISION_BASE_STALE");
  }
  return {
    kind: "revision_execution", versionRef: factRef(latest), articleRef: clone(latest.articleRef), imagePlanRef: clone(latest.imagePlanRef), visualPlanRef: clone(latest.visualPlanRef),
    article: clone(latest.article), canonicalImagePlan: clone(latest.canonicalImagePlan), revisionExecution: clone(latest)
  };
}

export function projectUnifiedWechatCurrentProduct(store, product, dependencies = {}) {
  const version = resolveUnifiedWechatProductionVersion(store, product.id, { ...dependencies, getProduct: () => product });
  if (!version.revisionExecution) return clone(product);
  const projected = clone(product);
  projected.platforms.wechat = {
    ...projected.platforms.wechat, articleRef: clone(version.articleRef), imagePlanRef: clone(version.imagePlanRef),
    article: clone(version.article), canonicalImagePlan: clone(version.canonicalImagePlan), productionVersionRef: clone(version.versionRef)
  };
  return projected;
}

function validateReplacementArticle(commit, article, dependencies = {}) {
  if (dependencies.validateArticle) return clone(dependencies.validateArticle(clone(article), clone(commit)));
  const inputs = commit.authorityInputs;
  const sourceSkillInput = {
    platform: "wechat_official_account", content_master: clone(inputs.sharedContentMaster.contentMaster || inputs.sharedContentMaster),
    platform_brief: clone(inputs.platformBrief), confirmed_outline: clone(inputs.confirmedOutline), writer_context: clone(inputs.writerContext)
  };
  return validateUnifiedSkillDomainOutput({
    capability: "write-wechat-article", platform: "wechat", outputContract: "WechatArticle@2.0",
    runtimeOutput: { status: "success", data: clone(article), warnings: [], blocked_reasons: [] },
    sourceContentMaster: inputs.sharedContentMaster.contentMaster || inputs.sharedContentMaster,
    sourceSkillInput, task: "write_wechat_narrative_creative_draft"
  });
}

function revisedCanonicalPlan(current, bindings, promptChanges, layer) {
  const plan = clone(current.canonicalPlan);
  if (!Array.isArray(promptChanges || [])) fail("UNIFIED_PRODUCTION_REVISION_PROMPT_CHANGES_INVALID", undefined, 400);
  const entries = (promptChanges || []).map((item) => [text(item?.slotId, "UNIFIED_PRODUCTION_REVISION_SLOT_REQUIRED"), text(item?.prompt, "UNIFIED_PRODUCTION_REVISION_PROMPT_REQUIRED")]);
  if (new Set(entries.map(([slotId]) => slotId)).size !== entries.length) fail("UNIFIED_PRODUCTION_REVISION_PROMPT_TARGET_DUPLICATE", undefined, 400);
  const changes = new Map(entries);
  if (layer === "visual" && changes.size === 0) fail("UNIFIED_PRODUCTION_REVISION_PROMPT_CHANGES_REQUIRED", undefined, 400);
  let actualChanges = 0;
  const revise = (item) => {
    if (!item) return item;
    const next = clone(item);
    if (changes.has(next.slotId)) {
      if (next.strategy !== "generated_raster") fail("UNIFIED_PRODUCTION_REVISION_PROMPT_TARGET_INVALID", undefined, 400);
      const prompt = changes.get(next.slotId);
      if (next.imageSpec?.prompt !== prompt) actualChanges += 1;
      next.imageSpec.prompt = prompt;
      if (next.source?.image_spec) next.source.image_spec.prompt = prompt;
      if (Object.hasOwn(next.source || {}, "prompt")) next.source.prompt = prompt;
      changes.delete(next.slotId);
    }
    return next;
  };
  plan.cover = revise(plan.cover);
  plan.slots = (plan.slots || []).map(revise);
  if (changes.size) fail("UNIFIED_PRODUCTION_REVISION_PROMPT_TARGET_NOT_FOUND", undefined, 400);
  if (layer === "visual" && actualChanges === 0) fail("UNIFIED_PRODUCTION_REVISION_NO_CHANGE", undefined, 409);
  plan.declarations = [plan.cover, ...(plan.slots || [])].filter(Boolean).map(clone);
  plan.bindings = clone(bindings);
  // A copy revision keeps the visual declarations but binds them to a new
  // article candidate. Give that bound plan its own immutable identity;
  // otherwise the artifact store sees the same plan-fact id with a different
  // hash and correctly rejects it as a conflict.
  const basePlanId = String(plan.planId || "wechat-image-plan").split(":revision:")[0];
  plan.planId = `${basePlanId}:revision:${String(bindings?.candidateRef?.hash || "current").slice(0, 16)}`;
  delete plan.planHash;
  return { ...plan, planHash: hashWechatArtifactValue(plan) };
}

export function executeUnifiedWechatRevision(store, input, dependencies = {}) {
  const projectId = text(input?.projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED");
  const { product, wechat } = productAuthority(store, projectId, dependencies);
  const requestRef = input?.requestRef;
  if (!ref(requestRef)) fail("UNIFIED_PRODUCTION_REVISION_REQUEST_REF_REQUIRED", undefined, 400);
  const requests = (store.unifiedProductionRevisionRequests || []).filter((item) => item.projectId === projectId && sameRef(factRef(item), requestRef));
  if (requests.length !== 1) fail("UNIFIED_PRODUCTION_REVISION_REQUEST_NOT_FOUND", undefined, 404);
  const request = requests[0];
  if (request.layer === "upstream") fail("UNIFIED_PRODUCTION_REVISION_UPSTREAM_RUN_REQUIRED");
  if (request.layer === "copy" && (input?.article == null || Object.hasOwn(input || {}, "promptChanges"))) fail("UNIFIED_PRODUCTION_REVISION_COPY_PAYLOAD_INVALID", undefined, 400);
  if (request.layer === "visual" && (Object.hasOwn(input || {}, "article") || !Array.isArray(input?.promptChanges))) fail("UNIFIED_PRODUCTION_REVISION_VISUAL_PAYLOAD_INVALID", undefined, 400);
  const current = resolveUnifiedWechatProductionVersion(store, projectId, dependencies);
  const commitMatches = (store.unifiedAtomicContentCommits || []).filter((item) => sameRef({ id: item.id, hash: item.commitHash }, product.commitRefs.wechat));
  if (commitMatches.length !== 1) fail("UNIFIED_PRODUCTION_REVISION_COMMIT_REQUIRED");
  const commit = commitMatches[0];
  const prior = completedExecutions(store, projectId).find((item) => sameRef(item.requestRef, requestRef));
  const executedAt = nowValue(input?.executedAt);
  const executedBy = text(input?.executedBy, "UNIFIED_PRODUCTION_CONTROL_ACTOR_REQUIRED");
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_PRODUCTION_CONTROL_IDEMPOTENCY_REQUIRED");
  const requestHash = hashUnifiedContent({ projectId, requestRef, currentVersionRef: prior?.parentVersionRef || current.versionRef, layer: request.layer,
    article: input?.article || null, promptChanges: input?.promptChanges || [], executedBy, executedAt });
  if (prior) {
    if (prior.idempotencyKey !== idempotencyKey || prior.requestHash !== requestHash) fail("UNIFIED_PRODUCTION_REVISION_EXECUTION_IDEMPOTENCY_CONFLICT");
    return { created: false, execution: clone(prior), state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
  }
  const articleValue = request.layer === "copy" ? validateReplacementArticle(commit, input?.article, dependencies) : clone(current.article.article);
  if (request.layer === "copy" && hashUnifiedContent(articleValue) === hashUnifiedContent(current.article.article)) fail("UNIFIED_PRODUCTION_REVISION_NO_CHANGE");
  const articleBase = { schemaVersion: "1.0", contract: "WechatRevisionArticle@1.0", id: `wechat-revision-article:${request.factHash.slice(0, 24)}`,
    authorityHash: current.article.authorityHash, sourceArticleRef: clone(current.articleRef), revisionRequestRef: clone(requestRef), article: clone(articleValue) };
  const article = { ...articleBase, componentHash: hashUnifiedContent(articleBase) };
  const articleRef = factRef(article, "componentHash");
  const canonicalPlan = revisedCanonicalPlan(current.canonicalImagePlan, {
    contentProjectRef: clone(product.productIdentityRef), materializedContentProjectRef: clone(product.platformMaterializedProjectRefs.wechat),
    platformRunRef: clone(wechat.platformRunRef), candidateRef: clone(articleRef), articleRef: clone(articleRef),
    imagePlanOutputFactRef: factRef(commit.skillFacts.imagePlan.outputFact)
  }, input?.promptChanges, request.layer);
  const imageBase = { schemaVersion: "1.0", contract: "WechatRevisionImagePlan@1.0", id: `wechat-revision-image-plan:${request.factHash.slice(0, 24)}`,
    authorityHash: current.canonicalImagePlan.authorityHash, sourceImagePlanRef: clone(current.imagePlanRef), revisionRequestRef: clone(requestRef),
    articleRef: clone(articleRef), canonicalPlan };
  const canonicalImagePlan = { ...imageBase, componentHash: hashUnifiedContent(imageBase) };
  const imagePlanRef = factRef(canonicalImagePlan, "componentHash");
  const base = { schemaVersion: "1.0", contract: EXECUTION_CONTRACT,
    id: `wechat-revision-execution:${request.factHash.slice(0, 24)}`, projectId, platform: "wechat", layer: request.layer,
    requestRef: clone(requestRef), productRef: { id: product.id, hash: product.aggregateHash }, commitRef: clone(product.commitRefs.wechat),
    parentVersionRef: clone(current.versionRef), articleRef, imagePlanRef,
    visualPlanRef: clone(request.layer === "visual" ? imagePlanRef : current.visualPlanRef), article, canonicalImagePlan,
    requestHash, idempotencyKey, executedBy, executedAt, status: "completed", providerCalls: 0, platformCalls: 0 };
  const execution = { ...base, factHash: hashUnifiedContent(base) };
  validateUnifiedWechatRevisionExecution(execution);
  store.unifiedWechatRevisionExecutions = [...(store.unifiedWechatRevisionExecutions || []), execution];
  return { created: true, execution: clone(execution), state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
}

export function projectUnifiedWechatPromptPlan(product, visualRevisionRef) {
  const wechat = product?.platforms?.wechat;
  if (!product?.id || !/^[a-f0-9]{64}$/.test(product.aggregateHash || "") || wechat?.state !== "materialized" || !ref(wechat.imagePlanRef) || !ref(visualRevisionRef)) {
    fail("UNIFIED_PRODUCTION_CONTROL_PROMPT_PLAN_INPUT_INVALID");
  }
  const plan = wechat.canonicalImagePlan?.canonicalPlan || wechat.canonicalImagePlan;
  if (!plan || !/^[a-f0-9]{64}$/.test(plan.planHash || "")) fail("UNIFIED_PRODUCTION_CONTROL_IMAGE_PLAN_REQUIRED");
  const prompts = (plan.declarations || []).filter((item) => item.strategy === "generated_raster").map((item) => ({
    slotId: item.slotId,
    role: item.role,
    strategy: item.strategy,
    prompt: item.imageSpec?.prompt || item.source?.prompt || "",
    size: item.imageSpec?.size || item.source?.image_spec?.size || null
  }));
  const base = {
    schemaVersion: "1.0", contract: PROMPT_PLAN_CONTRACT,
    id: `wechat-prompt-plan:${visualRevisionRef.hash.slice(0, 24)}`,
    projectId: product.id, platform: "wechat", productRef: { id: product.id, hash: product.aggregateHash },
    visualRevisionRef: clone(visualRevisionRef), imagePlanRef: clone(wechat.imagePlanRef), prompts
  };
  return hashed(base, "planHash");
}

export function projectUnifiedWechatCostPlan(promptPlan, maxCredits) {
  if (typeof maxCredits !== "number" || !Number.isFinite(maxCredits) || maxCredits <= 0) fail("UNIFIED_PRODUCTION_CONTROL_MAX_CREDITS_INVALID", undefined, 400);
  const base = {
    schemaVersion: "1.0", contract: COST_PLAN_CONTRACT,
    id: `wechat-cost-plan:${hashUnifiedContent({ promptPlanHash: promptPlan.planHash, maxCredits }).slice(0, 24)}`,
    projectId: promptPlan.projectId, platform: "wechat", promptPlanRef: factRef(promptPlan, "planHash"),
    currency: "credits", estimateStatus: "upper_bound_only", estimatedCredits: null, maxCredits
  };
  return hashed(base, "planHash");
}

function buildPromptPlan(store, projectId, dependencies = {}) {
  const { product } = productAuthority(store, projectId, dependencies);
  const current = resolveUnifiedWechatProductionVersion(store, projectId, dependencies);
  const visualRevisionRef = currentVisualRevisionRef(store, projectId);
  if (!ref(visualRevisionRef)) fail("UNIFIED_PRODUCTION_CONTROL_VISUAL_REVISION_REQUIRED");
  const projected = clone(product);
  projected.platforms.wechat = { ...projected.platforms.wechat, imagePlanRef: clone(current.visualPlanRef), canonicalImagePlan: clone(current.canonicalImagePlan) };
  return projectUnifiedWechatPromptPlan(projected, visualRevisionRef);
}

export function initializeUnifiedWechatProductionControl(store, input, dependencies = {}) {
  const projectId = text(input?.projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED");
  const occurredAt = nowValue(input?.occurredAt);
  const { product, wechat } = productAuthority(store, projectId, dependencies);
  const existing = (store.unifiedProductionRevisions || []).filter((item) => item.projectId === projectId && item.platform === "wechat");
  if (existing.length) return { created: false, state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
  const prospective = clone(store);
  const authority = appendUnifiedProductionRevision(prospective, { scope: scope(projectId), id: `production-revision:${projectId}:authority`, parentRevisionRef: null, changedLayers: ["authority"], sourceRef: product.productIdentityRef, recordedAt: occurredAt }).revision;
  const content = appendUnifiedProductionRevision(prospective, { scope: scope(projectId), id: `production-revision:${projectId}:content`, parentRevisionRef: factRef(authority, "revisionHash"), changedLayers: ["content"], sourceRef: wechat.articleRef, recordedAt: occurredAt }).revision;
  appendUnifiedProductionRevision(prospective, { scope: scope(projectId), id: `production-revision:${projectId}:visual`, parentRevisionRef: factRef(content, "revisionHash"), changedLayers: ["visual"], sourceRef: wechat.imagePlanRef, recordedAt: occurredAt });
  publishCollections(store, prospective, ["unifiedProductionRevisions"]);
  return { created: true, state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
}

export function previewUnifiedWechatPromptCost(store, input, dependencies = {}) {
  const promptPlan = buildPromptPlan(store, input?.projectId, dependencies);
  const costPlan = projectUnifiedWechatCostPlan(promptPlan, input?.maxCredits);
  return { promptPlan, costPlan, providerCalls: 0, platformCalls: 0 };
}

export function approveUnifiedWechatPromptCost(store, input, dependencies = {}) {
  const projectId = text(input?.projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED");
  const preview = previewUnifiedWechatPromptCost(store, input, dependencies);
  if (!sameRef(input?.promptPlanRef, factRef(preview.promptPlan, "planHash")) || !sameRef(input?.costPlanRef, factRef(preview.costPlan, "planHash"))) {
    fail("UNIFIED_PRODUCTION_CONTROL_APPROVAL_STALE");
  }
  const decidedAt = nowValue(input?.decidedAt);
  const decidedBy = text(input?.decidedBy, "UNIFIED_PRODUCTION_CONTROL_ACTOR_REQUIRED");
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_PRODUCTION_CONTROL_IDEMPOTENCY_REQUIRED");
  const prospective = clone(store);
  prospective.unifiedWechatPromptPlans ||= [];
  prospective.unifiedWechatCostPlans ||= [];
  for (const [name, value, hashField] of [["unifiedWechatPromptPlans", preview.promptPlan, "planHash"], ["unifiedWechatCostPlans", preview.costPlan, "planHash"]]) {
    const prior = prospective[name].find((item) => item.id === value.id);
    if (prior && prior[hashField] !== value[hashField]) fail("UNIFIED_PRODUCTION_CONTROL_PLAN_ID_CONFLICT");
    if (!prior) prospective[name].push(clone(value));
  }
  const result = appendUnifiedPromptCostApproval(prospective, {
    scope: scope(projectId), id: `prompt-cost-approval:${hashUnifiedContent({ projectId, idempotencyKey }).slice(0, 24)}`,
    visualRevisionRef: preview.promptPlan.visualRevisionRef,
    promptPlanRef: factRef(preview.promptPlan, "planHash"), costPlanRef: factRef(preview.costPlan, "planHash"),
    decision: input?.decision, decidedBy, decidedAt
  });
  publishCollections(store, prospective, ["unifiedWechatPromptPlans", "unifiedWechatCostPlans", "unifiedPromptCostApprovals"]);
  return { ...result, promptPlan: preview.promptPlan, costPlan: preview.costPlan, state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
}

export async function executeUnifiedWechatGeneratedImages(store, input, dependencies = {}) {
  const projectId = text(input?.projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED");
  if (typeof dependencies.executeGeneratedImages !== "function") fail("UNIFIED_WECHAT_IMAGE_RUNTIME_NOT_READY", undefined, 503);
  const state = getUnifiedWechatProductionControlState(store, { projectId }, dependencies);
  const prompts = state.promptPlan?.prompts || [];
  if (!state.initialized || !prompts.length) fail("UNIFIED_WECHAT_IMAGE_GENERATION_NOT_REQUIRED", undefined, 409);
  if (state.pendingRevisionRequests.length) fail("UNIFIED_WECHAT_IMAGE_REVISION_PENDING");
  const maxCalls = input?.maxCalls;
  if (!Number.isInteger(maxCalls) || maxCalls !== prompts.length) fail("UNIFIED_WECHAT_IMAGE_CALL_BUDGET_INVALID", undefined, 400);
  const attempt = input?.attempt;
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) fail("UNIFIED_WECHAT_IMAGE_ATTEMPT_INVALID", undefined, 400);
  const executedBy = text(input?.executedBy, "UNIFIED_PRODUCTION_CONTROL_ACTOR_REQUIRED");
  const executedAt = nowValue(input?.executedAt);
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_PRODUCTION_CONTROL_IDEMPOTENCY_REQUIRED");
  if (input?.confirmProviderExecution !== true) fail("UNIFIED_WECHAT_IMAGE_EXPLICIT_EXECUTION_CONFIRMATION_REQUIRED", undefined, 400);
  if (!state.promptCostApproval) {
    const maxCreditsPerImage = Number.isFinite(dependencies.maxCreditsPerImage) && dependencies.maxCreditsPerImage > 0
      ? dependencies.maxCreditsPerImage : 20;
    const preview = previewUnifiedWechatPromptCost(store, { projectId, maxCredits: maxCalls * maxCreditsPerImage }, dependencies);
    approveUnifiedWechatPromptCost(store, {
      projectId, maxCredits: preview.costPlan.maxCredits,
      promptPlanRef: factRef(preview.promptPlan, "planHash"), costPlanRef: factRef(preview.costPlan, "planHash"),
      decision: "approved", decidedBy: executedBy, decidedAt: executedAt,
      idempotencyKey: `${idempotencyKey}:provider-execution-authorization`
    }, dependencies);
    if (typeof dependencies.persistStore === "function") await dependencies.persistStore(store);
  }
  const generation = await dependencies.executeGeneratedImages({
    store, projectId, promptPlan: state.promptPlan, attempt, idempotencyKey, executedBy, executedAt
  });
  return { generation, state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies), platformCalls: 0 };
}

export function appendUnifiedWechatRevisionRequest(store, input, dependencies = {}) {
  const projectId = text(input?.projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED");
  productAuthority(store, projectId, dependencies);
  const layer = input?.layer;
  const changedLayers = layer === "copy" ? ["content"] : layer === "visual" ? ["visual"] : layer === "upstream" ? ["authority"] : null;
  if (!changedLayers) fail("UNIFIED_PRODUCTION_CONTROL_REVISION_LAYER_INVALID", undefined, 400);
  const instruction = text(input?.instruction, "UNIFIED_PRODUCTION_CONTROL_REVISION_INSTRUCTION_REQUIRED");
  const actorId = text(input?.actorId, "UNIFIED_PRODUCTION_CONTROL_ACTOR_REQUIRED");
  const idempotencyKey = text(input?.idempotencyKey, "UNIFIED_PRODUCTION_CONTROL_IDEMPOTENCY_REQUIRED");
  const occurredAt = nowValue(input?.occurredAt);
  const prospective = clone(store);
  prospective.unifiedProductionRevisionRequests ||= [];
  const requestBase = { schemaVersion: "1.0", contract: REQUEST_CONTRACT, id: `production-revision-request:${hashUnifiedContent({ projectId, idempotencyKey }).slice(0, 24)}`, projectId, platform: "wechat", layer, instruction, actorId, idempotencyKey, status: "awaiting_execution", occurredAt };
  const request = hashed(requestBase);
  const prior = prospective.unifiedProductionRevisionRequests.find((item) => item.idempotencyKey === idempotencyKey && item.projectId === projectId);
  if (prior) {
    if (prior.factHash !== request.factHash) fail("UNIFIED_PRODUCTION_CONTROL_REVISION_IDEMPOTENCY_CONFLICT");
    return { created: false, request: clone(prior), state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
  }
  const executedRefs = completedExecutions(store, projectId).map((item) => item.requestRef);
  const pending = prospective.unifiedProductionRevisionRequests.filter((item) => item.projectId === projectId && item.platform === "wechat"
    && !executedRefs.some((itemRef) => sameRef(itemRef, factRef(item))));
  if (pending.length) fail("UNIFIED_PRODUCTION_REVISION_PENDING_EXISTS");
  const parent = latestRevision(store, projectId);
  if (!parent) fail("UNIFIED_PRODUCTION_CONTROL_NOT_INITIALIZED");
  prospective.unifiedProductionRevisionRequests.push(clone(request));
  const revision = appendUnifiedProductionRevision(prospective, { scope: scope(projectId), id: `production-revision:${request.factHash.slice(0, 24)}`, parentRevisionRef: factRef(parent, "revisionHash"), changedLayers, sourceRef: factRef(request), recordedAt: occurredAt }).revision;
  publishCollections(store, prospective, ["unifiedProductionRevisionRequests", "unifiedProductionRevisions"]);
  return { created: true, request, revision, state: getUnifiedWechatProductionControlState(store, { projectId }, dependencies) };
}

export function getUnifiedWechatProductionControlState(store, input, dependencies = {}) {
  const projectId = text(input?.projectId, "UNIFIED_PRODUCTION_CONTROL_PROJECT_REQUIRED");
  const lifecycle = getUnifiedProductionLifecycleState(store, scope(projectId));
  const initialized = Boolean(lifecycle.revisionHeads.authority && lifecycle.revisionHeads.content && lifecycle.revisionHeads.visual);
  const promptPlan = initialized ? buildPromptPlan(store, projectId, dependencies) : null;
  const executedRequestRefs = completedExecutions(store, projectId).map((item) => item.requestRef);
  const pendingRequests = (store.unifiedProductionRevisionRequests || []).filter((item) => item.projectId === projectId && item.platform === "wechat"
    && item.status === "awaiting_execution" && !executedRequestRefs.some((itemRef) => sameRef(itemRef, factRef(item))));
  const currentVersion = initialized ? resolveUnifiedWechatProductionVersion(store, projectId, dependencies) : null;
  const promptCostApprovalRequired = Boolean(promptPlan?.prompts?.length);
  const promptCostReady = !promptCostApprovalRequired || Boolean(lifecycle.promptCostApproval);
  const imageGeneration = promptPlan ? projectWechatGeneratedImageState(store, { projectId, promptPlan }) : { required: false, ready: true, processing: false, failed: false, slots: [] };
  return {
    schemaVersion: "1.0", contract: CONTRACT, projectId, initialized, lifecycle,
    promptPlan, promptCostApproval: lifecycle.promptCostApproval,
    promptCostApprovalRequired,
    pendingRevisionRequests: clone(pendingRequests), currentVersion: clone(currentVersion), imageGeneration,
    preuploadAllowed: initialized && promptCostReady && imageGeneration.ready && pendingRequests.length === 0 && !lifecycle.blockers.includes("unknown_effect_reconciliation_required"),
    providerCalls: 0, platformCalls: 0
  };
}
