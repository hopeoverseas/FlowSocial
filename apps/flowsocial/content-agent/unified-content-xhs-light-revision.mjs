import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { normalizePngCandidate, sha256Bytes } from "../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { createXhsPageRevisionFact, createXhsProviderAttemptFact, validateXhsArtifactFactAppendOnly } from "./xhs-page-artifact-facts.mjs";
import { resolveUnifiedContentAuthority } from "./unified-content-authority-resolver.mjs";
import { compactXhsAssetPaths } from "./xhs-asset-paths.mjs";
import sharp from "sharp";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => value == null ? value : structuredClone(value);
const ref = (fact, field = "factHash") => ({ id: fact.id, hash: fact[field] });
const sameRef = (a, b) => Boolean(a && b && a.id === b.id && a.hash === b.hash);
const fail = (code, message = code, statusCode = 409, details = null) => { throw Object.assign(new Error(message), { code, statusCode, details }); };
const text = (value, code) => { if (typeof value !== "string" || !value.trim()) fail(code, code, 400); return value.trim(); };
const exactRef = (value, code) => { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "hash,id" || !HASH.test(value.hash || "")) fail(code, code, 400); return { id: text(value.id, code), hash: value.hash }; };
const hashed = (base) => ({ ...base, factHash: stableHash(base) });
const isoNow = (value) => new Date(typeof value === "function" ? value() : value).toISOString();

function requireFlag(featureFlags, key, code) {
  if (featureFlags?.[key] !== true) fail(code, code, 404);
}

function ensure(store) {
  store.unifiedContentXhsLightRevisionPlans ||= [];
  store.unifiedContentXhsLightRevisionApprovals ||= [];
  store.unifiedContentXhsLightRevisionExecutions ||= [];
  store.unifiedContentXhsLightRevisionCompletions ||= [];
  store.unifiedContentXhsLightRevisionCheckpoints ||= [];
  store.unifiedContentXhsLightRevisionReconciliationResolutions ||= [];
  store.unifiedContentXhsHumanVisualConfirmationFacts ||= [];
  store.unifiedContentXhsVisualVersionTags ||= [];
  store.unifiedContentXhsProviderAttemptFacts ||= [];
  store.unifiedContentXhsPageRevisionFacts ||= [];
}

function checkpointResolved(store, checkpoint) {
  return store.unifiedContentXhsLightRevisionReconciliationResolutions.some((item) => sameRef(item.checkpointFactRef, ref(checkpoint)));
}

function authority(store, input, flags) {
  const value = resolveUnifiedContentAuthority(store, { ...input, platform: "xiaohongshu" }, { atomicProductEnabled: flags?.unifiedContentAtomicProductV1 === true, codes: { candidateNotFound: "UNIFIED_XHS_LIGHT_AUTHORITY_REQUIRED" } });
  return { ...value, projectRef: value.executionProjectRef, runRef: value.platformRunRef, candidateRef: value.candidateRef };
}

function scoped(item, ctx) {
  return sameRef(item.contentProjectRef, ctx.projectRef) && sameRef(item.platformRunRef, ctx.runRef) && sameRef(item.candidateRef, ctx.candidateRef)
    && (!ctx.materializedProjectRef || sameRef(item.materializedContentProjectRef, ctx.materializedProjectRef));
}

function planFact(store, ctx, requestedRef) {
  const requested = exactRef(requestedRef, "UNIFIED_XHS_LIGHT_PROVIDER_PLAN_REF_INVALID");
  const value = (store.unifiedContentXhsProviderPlanFacts || []).find((item) => item.id === requested.id && item.factHash === requested.hash && scoped(item, ctx));
  if (!value) fail("UNIFIED_XHS_LIGHT_PROVIDER_PLAN_NOT_FOUND", undefined, 404);
  return value;
}

function expectedPageIds(plan) {
  const ids = (plan?.plan?.pages || []).map((page) => page.pageId).filter(Boolean);
  if (!ids.length) fail("UNIFIED_XHS_LIGHT_PLAN_PAGES_REQUIRED");
  return ids;
}

function currentPageHeads(store, ctx, ids) {
  const values = (store.unifiedContentXhsPageRevisionFacts || []).filter((item) => scoped(item, ctx) && ids.includes(item.pageId));
  const heads = ids.map((pageId) => values.filter((item) => item.pageId === pageId).sort((a, b) => a.revision - b.revision).at(-1)).filter(Boolean);
  return heads;
}

function pagePrompt(store, plan, pageId) {
  const design = (store.unifiedContentXhsDesignFacts || []).find((item) => sameRef(item.evidence ? { id: item.evidence.id, hash: item.evidence.evidenceHash } : null, plan.designEvidenceRef));
  const promptSet = design?.evidence?.outputs?.skillInvocation?.promptSet || design?.evidence?.outputs?.promptSet || {};
  const pages = promptSet.pagePromptSpecs || promptSet.pages || [];
  return pages.find((page) => page.pageId === pageId) || null;
}

async function decodeProviderRaster(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) fail("UNIFIED_XHS_LIGHT_PROVIDER_BYTES_REQUIRED", undefined, 502);
  let metadata;
  try { metadata = await sharp(bytes, { failOn: "error" }).metadata(); }
  catch (error) { fail("UNIFIED_XHS_LIGHT_PROVIDER_RASTER_INVALID", error.message, 502); }
  if (!metadata?.format || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)) fail("UNIFIED_XHS_LIGHT_PROVIDER_RASTER_METADATA_INVALID", undefined, 502);
  const format = metadata.format === "jpg" ? "jpeg" : metadata.format;
  const extension = ({ jpeg: "jpg", png: "png", webp: "webp", avif: "avif", gif: "gif", tiff: "tiff" })[format] || format;
  let pngBytes = bytes;
  if (format !== "png") {
    try { pngBytes = await sharp(bytes, { failOn: "error" }).png().toBuffer(); }
    catch (error) { fail("UNIFIED_XHS_LIGHT_PROVIDER_RASTER_CONVERSION_FAILED", error.message, 502); }
  }
  return { format, extension, mediaType: `image/${format}`, width: metadata.width, height: metadata.height, pngBytes };
}

function appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey, response = null, reason, error = null, rawAsset = null, recordedAt }) {
  const existing = store.unifiedContentXhsLightRevisionExecutions.find((item) => sameRef(item.planFactRef, planRequested) && sameRef(item.approvalFactRef, approvalRequested));
  const priorCheckpoint = store.unifiedContentXhsLightRevisionCheckpoints.find((item) => (existing && sameRef(item.executionFactRef, ref(existing))) || (sameRef(item.planFactRef, planRequested) && sameRef(item.approvalFactRef, approvalRequested)));
  if (priorCheckpoint) return { created: false, status: "reconciliation_required", execution: clone(existing || null), checkpoint: clone(priorCheckpoint), revision: null };
  const checkpoint = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionCheckpointFact@1.0", id: `xhs-light-revision-checkpoint:${executionRequestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), planFactRef: planRequested, approvalFactRef: approvalRequested, ...(existing ? { executionFactRef: ref(existing) } : {}), baseRevisionRef: clone(plan.baseRevisionRef), providerTaskId: response?.taskId || error?.taskId || null, providerCost: Number.isFinite(Number(response?.cost)) ? Number(response.cost) : Number.isFinite(Number(error?.cost)) ? Number(error.cost) : null, approvedMaxCredits: approval.maxCredits, ...(rawAsset ? { providerResultAsset: clone(rawAsset) } : {}), status: "reconciliation_required", reason, error: error ? { code: error.code || "UNIFIED_XHS_LIGHT_POST_PROVIDER_FAILURE", message: error.message || String(error) } : null, requiresReconciliation: true, automaticRetries: 0, executionRequestHash, idempotencyKey, recordedAt });
  if (existing) {
    store.unifiedContentXhsLightRevisionCheckpoints.push(checkpoint);
    return { created: true, status: "reconciliation_required", execution: clone(existing), checkpoint: clone(checkpoint), revision: null };
  }
  const execution = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionExecutionFact@1.0", id: `xhs-light-revision-execution:${executionRequestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), planFactRef: planRequested, approvalFactRef: approvalRequested, baseRevisionRef: clone(plan.baseRevisionRef), checkpointFactRef: ref(checkpoint), providerTaskId: checkpoint.providerTaskId, cost: checkpoint.providerCost, providerCalls: 1, automaticRetries: 0, status: "reconciliation_required", executionRequestHash, idempotencyKey, createdAt: recordedAt });
  store.unifiedContentXhsLightRevisionCheckpoints.push(checkpoint); store.unifiedContentXhsLightRevisionExecutions.push(execution);
  return { created: true, status: "reconciliation_required", execution: clone(execution), checkpoint: clone(checkpoint), revision: null };
}

export function classifyXhsLightEditMode(instruction) {
  const value = String(instruction || "")
    .replace(/(?:必须)?保持[\s\S]*?(?:不变|不动)(?:[，。；;\n]|$)/g, "")
    .replace(/不要(?:修改|改变)[\s\S]*?(?:[。；;\n]|$)/g, "")
    .replace(/标题(?:上方|下方|左侧|右侧|旁边)/g, "该区域");
  const copyTerms = "文字|文案|标题|正文|字样|措辞";
  const layoutTerms = "排版|版式|布局|顺序|位置|字号";
  const copyChange = new RegExp(`(?:修改|替换|改写|重写|删除|增加|新增).{0,16}(?:${copyTerms})|(?:${copyTerms}).{0,16}(?:修改|替换|改写|重写|删除|增加|新增)|(?:${copyTerms}).{0,6}(?:改成|换成)|(?:把|将)(?:${copyTerms}).{0,6}(?:改成|换成)|将[“\"'][^”\"']+[”\"'](?:改成|换成|替换为)[“\"'][^”\"']+[”\"']`);
  const layoutChange = new RegExp(`(?:调整|修改|改变|移动|放大|缩小|重排).{0,12}(?:${layoutTerms})|(?:${layoutTerms}).{0,12}(?:调整|修改|改变|移动|放大|缩小|重排)`);
  return copyChange.test(value) || layoutChange.test(value) ? "regenerate" : "image_edit";
}

export function getUnifiedContentXhsLightRevisionState(store, input, { featureFlags = {} } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); const ctx = authority(store, input, featureFlags); const plan = planFact(store, ctx, input.providerPlanFactRef);
  const pageIds = expectedPageIds(plan); const heads = currentPageHeads(store, ctx, pageIds);
  const plans = store.unifiedContentXhsLightRevisionPlans.filter((item) => scoped(item, ctx));
  const approvals = store.unifiedContentXhsLightRevisionApprovals.filter((item) => scoped(item, ctx));
  const executions = store.unifiedContentXhsLightRevisionExecutions.filter((item) => scoped(item, ctx));
  const completions = store.unifiedContentXhsLightRevisionCompletions.filter((item) => scoped(item, ctx));
  const checkpoints = store.unifiedContentXhsLightRevisionCheckpoints.filter((item) => scoped(item, ctx));
  const resolutions = store.unifiedContentXhsLightRevisionReconciliationResolutions.filter((item) => scoped(item, ctx));
  const unresolvedCheckpoints = checkpoints.filter((item) => item.requiresReconciliation === true && !resolutions.some((resolution) => sameRef(resolution.checkpointFactRef, ref(item))));
  const confirmations = store.unifiedContentXhsHumanVisualConfirmationFacts.filter((item) => scoped(item, ctx));
  const tags = store.unifiedContentXhsVisualVersionTags.filter((item) => scoped(item, ctx));
  const pendingExecution = executions.findLast((execution) => execution.status === "provider_task_created" && !completions.some((item) => sameRef(item.executionFactRef, ref(execution))) && !unresolvedCheckpoints.some((item) => sameRef(item.executionFactRef, ref(execution)) || (sameRef(item.planFactRef, execution.planFactRef) && sameRef(item.approvalFactRef, execution.approvalFactRef)))) || null;
  return { schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionState@1.0", pageHeads: heads.map((item) => ({ pageId: item.pageId, revision: item.revision, revisionRef: ref(item, "revisionHash"), normalizedAsset: clone(item.normalizedAsset) })), expectedPageIds: pageIds, plans: clone(plans), approvals: clone(approvals), executions: clone(executions), completions: clone(completions), checkpoints: clone(checkpoints), resolutions: clone(resolutions), unresolvedCheckpoints: clone(unresolvedCheckpoints), pendingExecution: clone(pendingExecution), latestConfirmation: clone(confirmations.at(-1) || null), versionTags: clone(tags), revisionSetHash: heads.length === pageIds.length ? stableHash(heads.map((item) => ref(item, "revisionHash"))) : null };
}

export function resolveUnifiedContentXhsLightRevisionCheckpoint(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); const ctx = authority(store, input, featureFlags); const requested = exactRef(input.checkpointFactRef, "UNIFIED_XHS_LIGHT_CHECKPOINT_REF_INVALID");
  const checkpoint = store.unifiedContentXhsLightRevisionCheckpoints.find((item) => item.id === requested.id && item.factHash === requested.hash && scoped(item, ctx));
  if (!checkpoint) fail("UNIFIED_XHS_LIGHT_CHECKPOINT_NOT_FOUND", undefined, 404);
  const decision = text(input.decision, "UNIFIED_XHS_LIGHT_CHECKPOINT_DECISION_REQUIRED");
  if (decision !== "abandoned") fail("UNIFIED_XHS_LIGHT_CHECKPOINT_DECISION_INVALID", undefined, 400);
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_LIGHT_CHECKPOINT_RESOLUTION_IDEMPOTENCY_REQUIRED");
  const requestHash = stableHash({ checkpointFactRef: requested, decision, reason: input.reason, resolvedBy: input.resolvedBy, idempotencyKey });
  const prior = store.unifiedContentXhsLightRevisionReconciliationResolutions.find((item) => item.idempotencyKey === idempotencyKey);
  if (prior) { if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_LIGHT_CHECKPOINT_RESOLUTION_IDEMPOTENCY_CONFLICT"); return { created: false, resolution: clone(prior), checkpoint: clone(checkpoint) }; }
  const existing = store.unifiedContentXhsLightRevisionReconciliationResolutions.find((item) => sameRef(item.checkpointFactRef, requested));
  if (existing) return { created: false, resolution: clone(existing), checkpoint: clone(checkpoint) };
  const fact = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionReconciliationResolutionFact@1.0", id: `xhs-light-revision-resolution:${requestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), checkpointFactRef: requested, planFactRef: clone(checkpoint.planFactRef), approvalFactRef: clone(checkpoint.approvalFactRef), baseRevisionRef: clone(checkpoint.baseRevisionRef), decision, reason: text(input.reason, "UNIFIED_XHS_LIGHT_CHECKPOINT_RESOLUTION_REASON_REQUIRED"), resolvedBy: text(input.resolvedBy, "UNIFIED_XHS_LIGHT_CHECKPOINT_RESOLUTION_ACTOR_REQUIRED"), resolvedAt: isoNow(now), publicationPerformed: false, requestHash, idempotencyKey });
  store.unifiedContentXhsLightRevisionReconciliationResolutions.push(fact);
  return { created: true, resolution: clone(fact), checkpoint: clone(checkpoint) };
}

export function createUnifiedContentXhsLightRevisionPlan(store, input, { featureFlags = {}, assistant = null, now = new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); const ctx = authority(store, input, featureFlags); const providerPlan = planFact(store, ctx, input.providerPlanFactRef);
  const instruction = text(input.instruction, "UNIFIED_XHS_LIGHT_INSTRUCTION_REQUIRED");
  const pageId = text(input.targetPageId, "UNIFIED_XHS_LIGHT_PAGE_ID_REQUIRED");
  if (!expectedPageIds(providerPlan).includes(pageId)) fail("UNIFIED_XHS_LIGHT_PAGE_OUTSIDE_PLAN", undefined, 409, { pageId });
  const baseRevision = currentPageHeads(store, ctx, [pageId])[0];
  if (!baseRevision) fail("UNIFIED_XHS_LIGHT_BASE_REVISION_REQUIRED");
  if (input.baseRevisionRef && !sameRef(exactRef(input.baseRevisionRef, "UNIFIED_XHS_LIGHT_BASE_REVISION_REF_INVALID"), ref(baseRevision, "revisionHash"))) fail("UNIFIED_XHS_LIGHT_BASE_REVISION_STALE");
  const unresolved = store.unifiedContentXhsLightRevisionCheckpoints.find((item) => scoped(item, ctx) && item.requiresReconciliation === true && !checkpointResolved(store, item) && sameRef(item.baseRevisionRef, ref(baseRevision, "revisionHash")));
  if (unresolved) fail("UNIFIED_XHS_LIGHT_RECONCILIATION_REQUIRED", undefined, 409, { checkpointFactRef: ref(unresolved) });
  const pending = store.unifiedContentXhsLightRevisionExecutions.find((item) => scoped(item, ctx) && item.status === "provider_task_created" && sameRef(item.baseRevisionRef, ref(baseRevision, "revisionHash")) && !store.unifiedContentXhsLightRevisionCompletions.some((completion) => sameRef(completion.executionFactRef, ref(item))));
  if (pending) fail("UNIFIED_XHS_LIGHT_TASK_ALREADY_PROCESSING", undefined, 409, { executionFactRef: ref(pending) });
  const canonical = pagePrompt(store, providerPlan, pageId);
  const providerPage = providerPlan.plan?.pages?.find((item) => item.pageId === pageId) || null;
  const lockedText = canonical?.promptBlocks?.verbatimText || canonical?.verbatimText || providerPage?.promptSections?.verbatimText || canonical?.exactText || canonical?.text || canonical?.content || "";
  const lockedTextItems = (Array.isArray(lockedText) ? lockedText : [lockedText]).map((item) => String(item || "").trim()).filter(Boolean);
  const fallbackMode = classifyXhsLightEditMode(instruction);
  const proposedMode = assistant?.editMode === "image_edit" || assistant?.editMode === "regenerate" ? assistant.editMode : fallbackMode;
  const editMode = fallbackMode === "regenerate" ? "regenerate" : proposedMode;
  const basePrompt = providerPage?.providerRequest?.body?.input?.prompt || canonical?.providerPrompt || canonical?.prompt || providerPage?.prompt || "";
  const requestedPrompt = text(assistant?.compiledPrompt || (editMode === "regenerate"
    ? `${basePrompt}\n\n本次修改要求：${instruction}\n必须逐字保留的页面文字：${lockedText}`
    : `以输入图片为基础修改。必须保持全部中文文字、标题层级、页面结构和品牌区域不变。只执行以下视觉修改：${instruction}`), "UNIFIED_XHS_LIGHT_COMPILED_PROMPT_REQUIRED");
  const compiledPrompt = `${requestedPrompt}\n\n唯一允许出现的逐字文字清单：\n${lockedTextItems.map((item) => `- ${item}`).join("\n")}\n画面中的全部可见文字必须逐字来自以上清单；禁止增加、改写、扩写、演示或推测任何指标、数字、标签、案例和说明。输入图片若含清单之外的文字，不得继承。`;
  const requestHash = stableHash({ projectRef: ctx.projectRef, runRef: ctx.runRef, candidateRef: ctx.candidateRef, providerPlanFactRef: ref(providerPlan), targetPageId: pageId, baseRevisionRef: ref(baseRevision, "revisionHash"), instruction, editMode, compiledPrompt, idempotencyKey: input.idempotencyKey });
  const prior = store.unifiedContentXhsLightRevisionPlans.find((item) => item.idempotencyKey === input.idempotencyKey);
  if (prior) { if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_LIGHT_PLAN_IDEMPOTENCY_CONFLICT"); return { created: false, plan: clone(prior) }; }
  const base = { schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionPlan@1.0", id: `xhs-light-revision-plan:${requestHash.slice(0, 24)}`, workspaceId: ctx.workspaceId, companyId: ctx.companyId, accountId: ctx.accountId, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), providerPlanFactRef: ref(providerPlan), planRef: clone(baseRevision.planRef), targetPageId: pageId, baseRevisionRef: ref(baseRevision, "revisionHash"), editMode, instruction, lockedTextHash: stableHash({ text: lockedText }), compiledPrompt, model: editMode === "image_edit" ? "seedream/4.5-edit" : "gpt-image-2-text-to-image", estimatedCredits: null, estimateStatus: "provider_actual_unknown", status: "awaiting_user_approval", createdBy: text(input.createdBy, "UNIFIED_XHS_LIGHT_CREATED_BY_REQUIRED"), createdAt: now, requestHash, idempotencyKey: text(input.idempotencyKey, "UNIFIED_XHS_LIGHT_IDEMPOTENCY_REQUIRED") };
  const fact = hashed(base); store.unifiedContentXhsLightRevisionPlans.push(fact); return { created: true, plan: clone(fact) };
}

export function approveUnifiedContentXhsLightRevision(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); const ctx = authority(store, input, featureFlags); const requested = exactRef(input.planFactRef, "UNIFIED_XHS_LIGHT_PLAN_FACT_REF_INVALID");
  const plan = store.unifiedContentXhsLightRevisionPlans.find((item) => item.id === requested.id && item.factHash === requested.hash && scoped(item, ctx));
  if (!plan) fail("UNIFIED_XHS_LIGHT_PLAN_FACT_NOT_FOUND", undefined, 404);
  const current = currentPageHeads(store, ctx, [plan.targetPageId])[0];
  if (!current || !sameRef(plan.baseRevisionRef, ref(current, "revisionHash"))) fail("UNIFIED_XHS_LIGHT_PLAN_STALE");
  const maxCredits = Number(input.maxCredits); if (!Number.isFinite(maxCredits) || maxCredits <= 0) fail("UNIFIED_XHS_LIGHT_MAX_CREDITS_INVALID", undefined, 400);
  const requestHash = stableHash({ planFactRef: requested, maxCredits, approvedBy: input.approvedBy, idempotencyKey: input.idempotencyKey });
  const prior = store.unifiedContentXhsLightRevisionApprovals.find((item) => item.idempotencyKey === input.idempotencyKey);
  if (prior) { if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_LIGHT_APPROVAL_IDEMPOTENCY_CONFLICT"); return { created: false, approval: clone(prior) }; }
  const fact = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionApprovalFact@1.0", id: `xhs-light-revision-approval:${requestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), planFactRef: requested, baseRevisionRef: clone(plan.baseRevisionRef), maxProviderCalls: 1, automaticRetries: 0, maxCredits, currency: "credits", approvedBy: text(input.approvedBy, "UNIFIED_XHS_LIGHT_APPROVED_BY_REQUIRED"), approvedAt: now, requestHash, idempotencyKey: text(input.idempotencyKey, "UNIFIED_XHS_LIGHT_APPROVAL_IDEMPOTENCY_REQUIRED") });
  store.unifiedContentXhsLightRevisionApprovals.push(fact); return { created: true, approval: clone(fact) };
}

export function recordUnifiedContentXhsLightRevisionReconciliation(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); const ctx = authority(store, input, featureFlags); const planRequested = exactRef(input.planFactRef, "UNIFIED_XHS_LIGHT_PLAN_FACT_REF_INVALID"); const approvalRequested = exactRef(input.approvalFactRef, "UNIFIED_XHS_LIGHT_APPROVAL_REF_INVALID");
  const plan = store.unifiedContentXhsLightRevisionPlans.find((item) => item.id === planRequested.id && item.factHash === planRequested.hash && scoped(item, ctx));
  const approval = store.unifiedContentXhsLightRevisionApprovals.find((item) => item.id === approvalRequested.id && item.factHash === approvalRequested.hash && scoped(item, ctx));
  if (!plan || !approval || !sameRef(approval.planFactRef, planRequested)) fail("UNIFIED_XHS_LIGHT_APPROVED_PLAN_REQUIRED");
  const providerCost = Number(input.providerCost); if (!Number.isFinite(providerCost) || providerCost < 0) fail("UNIFIED_XHS_LIGHT_RECONCILIATION_COST_INVALID", undefined, 400);
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_LIGHT_RECONCILIATION_IDEMPOTENCY_REQUIRED");
  const reason = text(input.reason, "UNIFIED_XHS_LIGHT_RECONCILIATION_REASON_REQUIRED");
  const executionRequestHash = stableHash({ planFactRef: planRequested, approvalFactRef: approvalRequested, externalEffectReconciliation: true, idempotencyKey });
  return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey, response: { taskId: String(input.providerTaskId || "").trim() || null, cost: providerCost }, reason, error: { code: "UNIFIED_XHS_LIGHT_EXTERNAL_EFFECT_RECORDED", message: text(input.recordedBy, "UNIFIED_XHS_LIGHT_RECONCILIATION_ACTOR_REQUIRED") }, recordedAt: isoNow(now) });
}

async function materializeSuccessfulProviderResponse(store, { ctx, planRequested, approvalRequested, plan, approval, current, executionRequestHash, idempotencyKey, response, requestHash, submission = null, transportContext, assetWriter, recordedAt }) {
  if (response.costStatus === "unknown" || !Number.isFinite(Number(response.cost)) || Number(response.cost) > approval.maxCredits) {
    const reason = response.costStatus === "unknown" || !Number.isFinite(Number(response.cost)) ? "provider_cost_unknown" : "provider_cost_exceeded";
    return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey, response, reason, recordedAt });
  }
  const latest = currentPageHeads(store, ctx, [plan.targetPageId])[0];
  if (!latest || !sameRef(plan.baseRevisionRef, ref(latest, "revisionHash"))) return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey, response, reason: "base_revision_changed_after_provider_submission", recordedAt });
  const planAttempts = store.unifiedContentXhsProviderAttemptFacts.filter((item) => scoped(item, ctx) && sameRef(item.planRef, current.planRef));
  const planRevisions = store.unifiedContentXhsPageRevisionFacts.filter((item) => scoped(item, ctx) && sameRef(item.planRef, current.planRef));
  const attemptNumber = Math.max(0, ...planAttempts.filter((item) => item.pageId === plan.targetPageId).map((item) => item.attempt || 0)) + 1;
  const revisionNumber = current.revision + 1; const suffix = `${plan.targetPageId}:a${attemptNumber}`;
  let decoded; let rawAsset = null; let normalized;
  try {
    decoded = await decodeProviderRaster(response.bytes);
    const compactPaths = compactXhsAssetPaths({ candidateRef: ctx.candidateRef, pageId: plan.targetPageId, attempt: attemptNumber, operationKey: executionRequestHash, rawExtension: decoded.extension });
    const rawPath = compactPaths.raw;
    rawAsset = { relativePath: rawPath, sha256: sha256Bytes(response.bytes), bytes: response.bytes.length, mediaType: decoded.mediaType, dimensions: { width: decoded.width, height: decoded.height } };
    await assetWriter({ relativePath: rawPath, bytes: response.bytes });
    const normalizationInputPath = decoded.format === "png" ? rawPath : compactPaths.decoded;
    if (decoded.format !== "png") await assetWriter({ relativePath: normalizationInputPath, bytes: decoded.pngBytes });
    normalized = normalizePngCandidate({ id: `xhs-light-normalization:${stableHash({ executionRequestHash, suffix }).slice(0, 24)}`, candidateRef: ctx.candidateRef, sourceBuffer: decoded.pngBytes, sourceRelativePath: normalizationInputPath, outputRelativePath: compactPaths.normalized, mode: "resample", protectedRegions: [], createdAt: recordedAt });
    if (normalized.record.status !== "succeeded" || !normalized.outputBuffer) fail("UNIFIED_XHS_LIGHT_NORMALIZATION_BLOCKED", undefined, 409, { blockers: normalized.record.blockers });
    await assetWriter({ relativePath: compactPaths.normalized, bytes: normalized.outputBuffer });
  } catch (error) {
    return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey, response, reason: "post_provider_artifact_processing_failed", error, rawAsset, recordedAt });
  }
  const providerRef = { id: `kie.ai:${plan.model}`, hash: stableHash({ provider: "kie.ai", model: plan.model }) }; const budgetRef = { id: approval.id, hash: approval.factHash }; const approvalRef = approvalRequested;
  const attempt = createXhsProviderAttemptFact({ id: `xhs-provider-attempt:${ctx.candidateRef.id}:${stableHash({ executionRequestHash }).slice(0, 12)}:${suffix}`, contentProjectRef: ctx.projectRef, ...(ctx.materializedProjectRef ? { materializedContentProjectRef: ctx.materializedProjectRef } : {}), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: clone(current.designEvidenceRef), planRef: clone(current.planRef), pageId: plan.targetPageId, pageRef: clone(current.pageRef), approvalRef, providerRef, budgetRef, lightRevisionPlanRef: planRequested, attempt: attemptNumber, requestHash, provider: "kie.ai", model: plan.model, transport: { kind: "injected", networked: transportContext.networked === true, context: clone(transportContext) }, idempotencyKey, executionRequestHash, selectionAuthority: false, finalBundleAuthority: false, publicationPerformed: false, recordedAt, status: "succeeded", taskId: response.taskId, rawAsset: clone(rawAsset), normalization: clone(normalized.record), cost: Number(response.cost), error: null });
  const revision = createXhsPageRevisionFact({ id: `xhs-page-revision:${ctx.candidateRef.id}:${plan.targetPageId}:r${revisionNumber}`, contentProjectRef: ctx.projectRef, ...(ctx.materializedProjectRef ? { materializedContentProjectRef: ctx.materializedProjectRef } : {}), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: clone(current.designEvidenceRef), planRef: clone(current.planRef), pageId: plan.targetPageId, pageRef: clone(current.pageRef), approvalRef, providerRef, budgetRef, lightRevisionPlanRef: planRequested, parentRevisionRef: ref(current, "revisionHash"), idempotencyKey, executionRequestHash, revision: revisionNumber, sourceAttemptRef: ref(attempt, "attemptHash"), rawAsset: clone(attempt.rawAsset), normalizedAsset: clone(normalized.record.outputAsset), normalizationRef: { id: normalized.record.id, hash: normalized.record.recordHash }, status: "artifact_review_required", reviewable: true, selectable: false, finalBundleAuthority: false, publicationPerformed: false, createdAt: recordedAt });
  validateXhsArtifactFactAppendOnly({ attempts: [...planAttempts, attempt], revisions: [...planRevisions, revision] });
  store.unifiedContentXhsProviderAttemptFacts.push(attempt); store.unifiedContentXhsPageRevisionFacts.push(revision);
  if (submission) {
    const completionBase = { schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionCompletionFact@1.0", id: `xhs-light-revision-completion:${stableHash({ executionFactRef: ref(submission), successorRevisionRef: ref(revision, "revisionHash") }).slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), executionFactRef: ref(submission), planFactRef: planRequested, approvalFactRef: approvalRequested, providerTaskId: response.taskId, successorRevisionRef: ref(revision, "revisionHash"), cost: Number(response.cost), providerCalls: 0, automaticRetries: 0, status: "succeeded", completedAt: recordedAt };
    const completion = hashed(completionBase); store.unifiedContentXhsLightRevisionCompletions.push(completion);
    return { created: true, status: "succeeded", execution: clone(submission), completion: clone(completion), revision: clone(revision) };
  }
  const execution = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionExecutionFact@1.0", id: `xhs-light-revision-execution:${executionRequestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), planFactRef: planRequested, approvalFactRef: approvalRequested, baseRevisionRef: clone(plan.baseRevisionRef), successorRevisionRef: ref(revision, "revisionHash"), providerTaskId: response.taskId, cost: Number(response.cost), providerCalls: 1, automaticRetries: 0, status: "succeeded", executionRequestHash, idempotencyKey, createdAt: recordedAt });
  store.unifiedContentXhsLightRevisionExecutions.push(execution); return { created: true, status: "succeeded", execution: clone(execution), revision: clone(revision) };
}

export async function submitUnifiedContentXhsLightRevision(store, input, { featureFlags = {}, transport, referenceUploader, assetReader, transportContext = { mode: "unconfigured", networked: false }, now = () => new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); if (typeof transport?.submit !== "function") fail("UNIFIED_XHS_LIGHT_SUBMIT_RUNTIME_NOT_CONFIGURED", undefined, 503);
  const ctx = authority(store, input, featureFlags); const planRequested = exactRef(input.planFactRef, "UNIFIED_XHS_LIGHT_PLAN_FACT_REF_INVALID"); const approvalRequested = exactRef(input.approvalFactRef, "UNIFIED_XHS_LIGHT_APPROVAL_REF_INVALID");
  const plan = store.unifiedContentXhsLightRevisionPlans.find((item) => item.id === planRequested.id && item.factHash === planRequested.hash && scoped(item, ctx)); const approval = store.unifiedContentXhsLightRevisionApprovals.find((item) => item.id === approvalRequested.id && item.factHash === approvalRequested.hash && scoped(item, ctx));
  if (!plan || !approval || !sameRef(approval.planFactRef, planRequested)) fail("UNIFIED_XHS_LIGHT_APPROVED_PLAN_REQUIRED");
  const current = currentPageHeads(store, ctx, [plan.targetPageId])[0]; if (!current || !sameRef(plan.baseRevisionRef, ref(current, "revisionHash"))) fail("UNIFIED_XHS_LIGHT_EXECUTION_STALE");
  const idempotencyKey = text(input.idempotencyKey, "UNIFIED_XHS_LIGHT_EXECUTION_IDEMPOTENCY_REQUIRED"); const executionRequestHash = stableHash({ planFactRef: planRequested, approvalFactRef: approvalRequested, idempotencyKey });
  const replay = store.unifiedContentXhsLightRevisionExecutions.find((item) => item.idempotencyKey === idempotencyKey); if (replay) { if (replay.executionRequestHash !== executionRequestHash) fail("UNIFIED_XHS_LIGHT_EXECUTION_IDEMPOTENCY_CONFLICT"); return { created: false, status: replay.status, execution: clone(replay) }; }
  const prior = store.unifiedContentXhsLightRevisionExecutions.find((item) => sameRef(item.planFactRef, planRequested) && sameRef(item.approvalFactRef, approvalRequested)); if (prior) fail("UNIFIED_XHS_LIGHT_APPROVAL_ALREADY_EXECUTED", undefined, 409, { executionFactRef: ref(prior), status: prior.status });
  let imageUrls = [];
  if (plan.editMode === "image_edit") {
    if (typeof referenceUploader !== "function" || typeof assetReader !== "function") fail("UNIFIED_XHS_LIGHT_EDIT_RUNTIME_NOT_CONFIGURED", undefined, 503);
    const read = await assetReader(current.normalizedAsset, { pageId: current.pageId }); const bytes = Buffer.isBuffer(read) ? read : read?.bytes; if (!Buffer.isBuffer(bytes)) fail("UNIFIED_XHS_LIGHT_BASE_ASSET_UNAVAILABLE", undefined, 409, { relativePath: current.normalizedAsset.relativePath });
    const uploaded = await referenceUploader({ bytes, mediaType: "image/png", fileName: `${ctx.projectId}-${plan.targetPageId}-${current.revision}.png` }); imageUrls = [uploaded.url];
  }
  const request = { endpoint: "/api/v1/jobs/createTask", method: "POST", body: { model: plan.model, input: { prompt: plan.compiledPrompt, ...(imageUrls.length ? { image_urls: imageUrls } : {}), aspect_ratio: "3:4", quality: "basic", nsfw_checker: true } } };
  const submitted = await transport.submit(request, { ...transportContext, lightRevisionPlanRef: planRequested });
  if (submitted?.status !== "provider_task_created" || typeof submitted.taskId !== "string" || !submitted.taskId) fail("UNIFIED_XHS_LIGHT_TASK_SUBMISSION_INVALID", undefined, 502);
  const recordedAt = new Date(now()).toISOString();
  const execution = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionExecutionFact@1.0", id: `xhs-light-revision-execution:${executionRequestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), planFactRef: planRequested, approvalFactRef: approvalRequested, baseRevisionRef: clone(plan.baseRevisionRef), providerTaskId: submitted.taskId, providerRequestHash: stableHash(request), model: plan.model, creditsBefore: Number.isFinite(Number(submitted.creditsBefore)) ? Number(submitted.creditsBefore) : null, cost: null, providerCalls: 1, automaticRetries: 0, status: "provider_task_created", executionRequestHash, idempotencyKey, createdAt: recordedAt });
  store.unifiedContentXhsLightRevisionExecutions.push(execution); return { created: true, status: "processing", execution: clone(execution) };
}

export async function continueUnifiedContentXhsLightRevision(store, input, { featureFlags = {}, transport, assetWriter, transportContext = { mode: "unconfigured", networked: false }, now = () => new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); if (typeof transport?.readResult !== "function" || typeof assetWriter !== "function") fail("UNIFIED_XHS_LIGHT_CONTINUE_RUNTIME_NOT_CONFIGURED", undefined, 503);
  const ctx = authority(store, input, featureFlags); const requested = exactRef(input.executionFactRef, "UNIFIED_XHS_LIGHT_EXECUTION_REF_INVALID");
  if (input.executionId && requested.id !== input.executionId) fail("UNIFIED_XHS_LIGHT_EXECUTION_PATH_REF_MISMATCH", undefined, 400);
  const submission = store.unifiedContentXhsLightRevisionExecutions.find((item) => item.id === requested.id && item.factHash === requested.hash && item.status === "provider_task_created" && scoped(item, ctx)); if (!submission) fail("UNIFIED_XHS_LIGHT_SUBMISSION_NOT_FOUND", undefined, 404);
  const completion = store.unifiedContentXhsLightRevisionCompletions.find((item) => sameRef(item.executionFactRef, requested)); if (completion) { const revision = store.unifiedContentXhsPageRevisionFacts.find((item) => sameRef(ref(item, "revisionHash"), completion.successorRevisionRef)); return { created: false, status: "succeeded", execution: clone(submission), completion: clone(completion), revision: clone(revision || null) }; }
  const checkpoint = store.unifiedContentXhsLightRevisionCheckpoints.find((item) => sameRef(item.executionFactRef, requested) || (sameRef(item.planFactRef, submission.planFactRef) && sameRef(item.approvalFactRef, submission.approvalFactRef))); if (checkpoint) return { created: false, status: "reconciliation_required", execution: clone(submission), checkpoint: clone(checkpoint), revision: null };
  const plan = store.unifiedContentXhsLightRevisionPlans.find((item) => sameRef(ref(item), submission.planFactRef) && scoped(item, ctx)); const approval = store.unifiedContentXhsLightRevisionApprovals.find((item) => sameRef(ref(item), submission.approvalFactRef) && scoped(item, ctx)); if (!plan || !approval) fail("UNIFIED_XHS_LIGHT_SUBMISSION_AUTHORITY_MISSING");
  const current = currentPageHeads(store, ctx, [plan.targetPageId])[0]; const recordedAt = new Date(now()).toISOString(); let response;
  try { response = await transport.readResult({ taskId: submission.providerTaskId, model: submission.model || plan.model, creditsBefore: submission.creditsBefore }); }
  catch (error) { throw Object.assign(error, { statusCode: error.statusCode || 502, details: { providerTaskIdPersisted: true, safeToRetryStatusQuery: true } }); }
  if (response?.status === "processing") return { created: false, status: "processing", providerState: response.providerState, execution: clone(submission), revision: null };
  if (response?.status === "failed") return appendReconciliation(store, { ctx, planRequested: submission.planFactRef, approvalRequested: submission.approvalFactRef, plan, approval, executionRequestHash: submission.executionRequestHash, idempotencyKey: submission.idempotencyKey, response, reason: "provider_task_failed", error: response.error, recordedAt });
  if (response?.status !== "succeeded" || !Buffer.isBuffer(response.bytes)) fail("UNIFIED_XHS_LIGHT_PROVIDER_RESULT_INVALID", undefined, 502);
  return materializeSuccessfulProviderResponse(store, { ctx, planRequested: submission.planFactRef, approvalRequested: submission.approvalFactRef, plan, approval, current, executionRequestHash: submission.executionRequestHash, idempotencyKey: submission.idempotencyKey, response, requestHash: submission.providerRequestHash, submission, transportContext, assetWriter, recordedAt });
}

export async function executeUnifiedContentXhsLightRevision(store, input, { featureFlags = {}, transport, referenceUploader, assetReader, assetWriter, transportContext = { mode: "unconfigured", networked: false }, now = () => new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsLightRevisionV1", "UNIFIED_XHS_LIGHT_REVISION_DISABLED");
  ensure(store); if (![transport, assetWriter].every((item) => typeof item === "function")) fail("UNIFIED_XHS_LIGHT_RUNTIME_NOT_CONFIGURED", undefined, 503);
  const ctx = authority(store, input, featureFlags); const planRequested = exactRef(input.planFactRef, "UNIFIED_XHS_LIGHT_PLAN_FACT_REF_INVALID"); const approvalRequested = exactRef(input.approvalFactRef, "UNIFIED_XHS_LIGHT_APPROVAL_REF_INVALID");
  const plan = store.unifiedContentXhsLightRevisionPlans.find((item) => item.id === planRequested.id && item.factHash === planRequested.hash && scoped(item, ctx));
  const approval = store.unifiedContentXhsLightRevisionApprovals.find((item) => item.id === approvalRequested.id && item.factHash === approvalRequested.hash && scoped(item, ctx));
  if (!plan || !approval || !sameRef(approval.planFactRef, planRequested)) fail("UNIFIED_XHS_LIGHT_APPROVED_PLAN_REQUIRED");
  const current = currentPageHeads(store, ctx, [plan.targetPageId])[0]; if (!current || !sameRef(plan.baseRevisionRef, ref(current, "revisionHash"))) fail("UNIFIED_XHS_LIGHT_EXECUTION_STALE");
  const executionRequestHash = stableHash({ planFactRef: planRequested, approvalFactRef: approvalRequested, idempotencyKey: input.idempotencyKey });
  const replay = store.unifiedContentXhsLightRevisionExecutions.find((item) => item.idempotencyKey === input.idempotencyKey);
  if (replay) { if (replay.executionRequestHash !== executionRequestHash) fail("UNIFIED_XHS_LIGHT_EXECUTION_IDEMPOTENCY_CONFLICT"); return { created: false, execution: clone(replay) }; }
  const priorApprovedAttempt = store.unifiedContentXhsLightRevisionExecutions.find((item) => sameRef(item.planFactRef, planRequested) && sameRef(item.approvalFactRef, approvalRequested));
  if (priorApprovedAttempt) fail("UNIFIED_XHS_LIGHT_APPROVAL_ALREADY_EXECUTED", undefined, 409, { executionFactRef: ref(priorApprovedAttempt), status: priorApprovedAttempt.status || "succeeded" });
  let imageUrls = [];
  if (plan.editMode === "image_edit") {
    if (typeof referenceUploader !== "function" || typeof assetReader !== "function") fail("UNIFIED_XHS_LIGHT_EDIT_RUNTIME_NOT_CONFIGURED", undefined, 503);
    const read = await assetReader(current.normalizedAsset, { pageId: current.pageId }); const bytes = Buffer.isBuffer(read) ? read : read?.bytes;
    if (!Buffer.isBuffer(bytes)) fail("UNIFIED_XHS_LIGHT_BASE_ASSET_UNAVAILABLE", undefined, 409, { relativePath: current.normalizedAsset.relativePath });
    const uploaded = await referenceUploader({ bytes, mediaType: "image/png", fileName: `${ctx.projectId}-${plan.targetPageId}-${current.revision}.png` }); imageUrls = [uploaded.url];
  }
  const request = { endpoint: "/api/v1/jobs/createTask", method: "POST", body: { model: plan.model, input: { prompt: plan.compiledPrompt, ...(imageUrls.length ? { image_urls: imageUrls } : {}), aspect_ratio: "3:4", quality: "basic", nsfw_checker: true } } };
  const recordedAt = new Date(now()).toISOString();
  let response;
  try { response = await transport(request, { ...transportContext, lightRevisionPlanRef: planRequested }); }
  catch (error) {
    if (error?.paidTaskCreated === true || error?.taskId) return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey: input.idempotencyKey, response: null, reason: "provider_effect_result_unknown", error, recordedAt });
    throw error;
  }
  if (response?.status !== "succeeded" || !Buffer.isBuffer(response.bytes)) fail("UNIFIED_XHS_LIGHT_PROVIDER_FAILED", response?.error?.message || "Provider edit failed", 502);
  if (response.costStatus === "unknown" || !Number.isFinite(Number(response.cost)) || Number(response.cost) > approval.maxCredits) {
    const reason = response.costStatus === "unknown" || !Number.isFinite(Number(response.cost)) ? "provider_cost_unknown" : "provider_cost_exceeded";
    return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey: input.idempotencyKey, response, reason, recordedAt });
  }
  const planAttempts = store.unifiedContentXhsProviderAttemptFacts.filter((item) => scoped(item, ctx) && sameRef(item.planRef, current.planRef));
  const planRevisions = store.unifiedContentXhsPageRevisionFacts.filter((item) => scoped(item, ctx) && sameRef(item.planRef, current.planRef));
  const attemptNumber = Math.max(0, ...planAttempts.filter((item) => item.pageId === plan.targetPageId).map((item) => item.attempt || 0)) + 1;
  const revisionNumber = current.revision + 1; const suffix = `${plan.targetPageId}:a${attemptNumber}`;
  let decoded; let rawAsset = null; let normalized;
  try {
    decoded = await decodeProviderRaster(response.bytes);
    const compactPaths = compactXhsAssetPaths({ candidateRef: ctx.candidateRef, pageId: plan.targetPageId, attempt: attemptNumber, operationKey: executionRequestHash, rawExtension: decoded.extension });
    const rawPath = compactPaths.raw;
    rawAsset = { relativePath: rawPath, sha256: sha256Bytes(response.bytes), bytes: response.bytes.length, mediaType: decoded.mediaType, dimensions: { width: decoded.width, height: decoded.height } };
    await assetWriter({ relativePath: rawPath, bytes: response.bytes });
    const normalizationInputPath = decoded.format === "png" ? rawPath : compactPaths.decoded;
    if (decoded.format !== "png") await assetWriter({ relativePath: normalizationInputPath, bytes: decoded.pngBytes });
    normalized = normalizePngCandidate({ id: `xhs-light-normalization:${stableHash({ executionRequestHash, suffix }).slice(0, 24)}`, candidateRef: ctx.candidateRef, sourceBuffer: decoded.pngBytes, sourceRelativePath: normalizationInputPath, outputRelativePath: compactPaths.normalized, mode: "resample", protectedRegions: [], createdAt: recordedAt });
    if (normalized.record.status !== "succeeded" || !normalized.outputBuffer) fail("UNIFIED_XHS_LIGHT_NORMALIZATION_BLOCKED", undefined, 409, { blockers: normalized.record.blockers });
    await assetWriter({ relativePath: compactPaths.normalized, bytes: normalized.outputBuffer });
  } catch (error) {
    return appendReconciliation(store, { ctx, planRequested, approvalRequested, plan, approval, executionRequestHash, idempotencyKey: input.idempotencyKey, response, reason: "post_provider_artifact_processing_failed", error, rawAsset, recordedAt });
  }
  const providerRef = { id: `kie.ai:${plan.model}`, hash: stableHash({ provider: "kie.ai", model: plan.model }) }; const budgetRef = { id: approval.id, hash: approval.factHash }; const approvalRef = approvalRequested;
  const attempt = createXhsProviderAttemptFact({ id: `xhs-provider-attempt:${ctx.candidateRef.id}:${stableHash({ executionRequestHash }).slice(0, 12)}:${suffix}`, contentProjectRef: ctx.projectRef, ...(ctx.materializedProjectRef ? { materializedContentProjectRef: ctx.materializedProjectRef } : {}), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: clone(current.designEvidenceRef), planRef: clone(current.planRef), pageId: plan.targetPageId, pageRef: clone(current.pageRef), approvalRef, providerRef, budgetRef, lightRevisionPlanRef: planRequested, attempt: attemptNumber, requestHash: stableHash(request), provider: "kie.ai", model: plan.model, transport: { kind: "injected", networked: transportContext.networked === true, context: clone(transportContext) }, idempotencyKey: input.idempotencyKey, executionRequestHash, selectionAuthority: false, finalBundleAuthority: false, publicationPerformed: false, recordedAt, status: "succeeded", taskId: response.taskId, rawAsset: clone(rawAsset), normalization: clone(normalized.record), cost: Number(response.cost), error: null });
  const revision = createXhsPageRevisionFact({ id: `xhs-page-revision:${ctx.candidateRef.id}:${plan.targetPageId}:r${revisionNumber}`, contentProjectRef: ctx.projectRef, ...(ctx.materializedProjectRef ? { materializedContentProjectRef: ctx.materializedProjectRef } : {}), platformRunRef: ctx.runRef, candidateRef: ctx.candidateRef, designEvidenceRef: clone(current.designEvidenceRef), planRef: clone(current.planRef), pageId: plan.targetPageId, pageRef: clone(current.pageRef), approvalRef, providerRef, budgetRef, lightRevisionPlanRef: planRequested, parentRevisionRef: ref(current, "revisionHash"), idempotencyKey: input.idempotencyKey, executionRequestHash, revision: revisionNumber, sourceAttemptRef: ref(attempt, "attemptHash"), rawAsset: clone(attempt.rawAsset), normalizedAsset: clone(normalized.record.outputAsset), normalizationRef: { id: normalized.record.id, hash: normalized.record.recordHash }, status: "artifact_review_required", reviewable: true, selectable: false, finalBundleAuthority: false, publicationPerformed: false, createdAt: new Date(now()).toISOString() });
  validateXhsArtifactFactAppendOnly({ attempts: [...planAttempts, attempt], revisions: [...planRevisions, revision] });
  store.unifiedContentXhsProviderAttemptFacts.push(attempt); store.unifiedContentXhsPageRevisionFacts.push(revision);
  const execution = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsLightRevisionExecutionFact@1.0", id: `xhs-light-revision-execution:${executionRequestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), planFactRef: planRequested, approvalFactRef: approvalRequested, baseRevisionRef: clone(plan.baseRevisionRef), successorRevisionRef: ref(revision, "revisionHash"), providerTaskId: response.taskId, cost: Number(response.cost), providerCalls: 1, automaticRetries: 0, status: "succeeded", executionRequestHash, idempotencyKey: input.idempotencyKey, createdAt: recordedAt });
  store.unifiedContentXhsLightRevisionExecutions.push(execution); return { created: true, execution: clone(execution), revision: clone(revision) };
}

export function confirmUnifiedContentXhsHumanVisualSet(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  requireFlag(featureFlags, "unifiedContentXhsHumanVisualConfirmationV1", "UNIFIED_XHS_HUMAN_VISUAL_CONFIRMATION_DISABLED");
  ensure(store); const ctx = authority(store, input, featureFlags); const providerPlan = planFact(store, ctx, input.providerPlanFactRef); const ids = expectedPageIds(providerPlan); const heads = currentPageHeads(store, ctx, ids);
  const unresolved = store.unifiedContentXhsLightRevisionCheckpoints.find((item) => scoped(item, ctx) && item.requiresReconciliation === true && !checkpointResolved(store, item));
  if (unresolved) fail("UNIFIED_XHS_HUMAN_CONFIRMATION_RECONCILIATION_REQUIRED", undefined, 409, { checkpointFactRef: ref(unresolved) });
  if (heads.length !== ids.length) fail("UNIFIED_XHS_HUMAN_CONFIRMATION_PAGE_SET_INCOMPLETE");
  const submitted = input.pageRevisionRefs.map((item) => exactRef(item, "UNIFIED_XHS_HUMAN_CONFIRMATION_REVISION_REF_INVALID")); const expected = heads.map((item) => ref(item, "revisionHash"));
  if (stableHash(submitted) !== stableHash(expected)) fail("UNIFIED_XHS_HUMAN_CONFIRMATION_STALE", undefined, 409, { expected });
  const revisionSetHash = stableHash(expected); const requestHash = stableHash({ revisionSetHash, confirmedBy: input.confirmedBy, label: input.versionLabel || null, idempotencyKey: input.idempotencyKey });
  const prior = store.unifiedContentXhsHumanVisualConfirmationFacts.find((item) => item.idempotencyKey === input.idempotencyKey);
  if (prior) { if (prior.requestHash !== requestHash) fail("UNIFIED_XHS_HUMAN_CONFIRMATION_IDEMPOTENCY_CONFLICT"); return { created: false, confirmation: clone(prior), versionTag: clone(store.unifiedContentXhsVisualVersionTags.find((item) => sameRef(item.confirmationFactRef, ref(prior)))) }; }
  const confirmation = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsHumanVisualConfirmationFact@1.0", id: `xhs-human-visual-confirmation:${requestHash.slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), providerPlanFactRef: ref(providerPlan), planRef: clone(providerPlan.plan ? { id: providerPlan.plan.id, hash: providerPlan.plan.planHash } : heads[0].planRef), pageRevisionRefs: expected, revisionSetHash, decision: "approved", confirmedBy: text(input.confirmedBy, "UNIFIED_XHS_HUMAN_CONFIRMED_BY_REQUIRED"), confirmedAt: isoNow(now), requestHash, idempotencyKey: text(input.idempotencyKey, "UNIFIED_XHS_HUMAN_CONFIRMATION_IDEMPOTENCY_REQUIRED"), selectionAuthority: false, publicationPerformed: false });
  const version = store.unifiedContentXhsVisualVersionTags.filter((item) => scoped(item, ctx)).length + 1; const label = String(input.versionLabel || "").trim() || `XHS-v${version}`;
  const versionTag = hashed({ schemaVersion: "1.0", contract: "UnifiedXhsVisualVersionTagFact@1.0", id: `xhs-visual-version:${stableHash({ candidateRef: ctx.candidateRef, version, revisionSetHash }).slice(0, 24)}`, contentProjectRef: clone(ctx.projectRef), ...(ctx.materializedProjectRef ? { materializedContentProjectRef: clone(ctx.materializedProjectRef) } : {}), platformRunRef: clone(ctx.runRef), candidateRef: clone(ctx.candidateRef), version, label, confirmationFactRef: ref(confirmation), pageRevisionRefs: expected, revisionSetHash, taggedBy: confirmation.confirmedBy, taggedAt: confirmation.confirmedAt, immutable: true, publicationPerformed: false });
  store.unifiedContentXhsHumanVisualConfirmationFacts.push(confirmation); store.unifiedContentXhsVisualVersionTags.push(versionTag); return { created: true, confirmation: clone(confirmation), versionTag: clone(versionTag) };
}
