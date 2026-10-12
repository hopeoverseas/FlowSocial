import { createHash } from "node:crypto";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";

const SUBMISSION_CONTRACT = "UnifiedWechatGeneratedImageSubmission@1.0";
const RESULT_CONTRACT = "UnifiedWechatGeneratedImageResult@1.0";
const HASH = /^[a-f0-9]{64}$/;
const clean = (value) => String(value ?? "").trim();
const clone = (value) => structuredClone(value);

function fail(code, message = code, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

function ref(value) { return Boolean(value?.id && HASH.test(value?.hash || "")); }
function sameRef(left, right) { return ref(left) && ref(right) && left.id === right.id && left.hash === right.hash; }
function factRef(value, hashField) { return { id: value.id, hash: value[hashField] }; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function hashed(base, field) { return { ...base, [field]: hashUnifiedContent(base) }; }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function requestFor(prompt, model) {
  const compiledPrompt = `${clean(prompt.prompt)}\n\n公众号${prompt.role === "cover" ? "封面" : "正文插图"}。只根据文章语义创作画面，不要把文章标题、段落标题或正文排进图片。画面内不得出现任何文字、字母、数字、Logo、水印或界面截图。`;
  if (!clean(prompt.prompt)) fail("UNIFIED_WECHAT_IMAGE_PROMPT_REQUIRED", undefined, 400, { slotId: prompt.slotId });
  return {
    endpoint: "/api/v1/jobs/createTask",
    method: "POST",
    body: {
      model,
      input: { prompt: compiledPrompt, aspect_ratio: prompt.size === "1024x1024" ? "1:1" : "3:2", quality: "basic", nsfw_checker: true }
    },
    compiledPrompt
  };
}

function validateSubmission(value) {
  const base = clone(value); delete base.submissionHash;
  if (value?.schemaVersion !== "1.0" || value.contract !== SUBMISSION_CONTRACT || !clean(value.id)
    || !clean(value.projectId) || value.platform !== "wechat" || !ref(value.promptPlanRef) || !ref(value.visualRevisionRef)
    || !ref(value.imagePlanRef) || !clean(value.slotId) || !["cover", "inline"].includes(value.role)
    || !HASH.test(value.promptHash || "") || !clean(value.model) || value.provider !== "kie.ai" || !clean(value.providerTaskId)
    || !clean(value.idempotencyKey) || !Number.isInteger(value.attempt) || value.attempt < 1 || value.attempt > 3
    || !clean(value.submittedBy) || Number.isNaN(Date.parse(value.submittedAt || ""))
    || !HASH.test(value.submissionHash || "") || hashUnifiedContent(base) !== value.submissionHash) fail("UNIFIED_WECHAT_IMAGE_SUBMISSION_INVALID");
  return value;
}

function validateResult(value) {
  const base = clone(value); delete base.resultHash;
  if (value?.schemaVersion !== "1.0" || value.contract !== RESULT_CONTRACT || !clean(value.id) || !clean(value.projectId)
    || value.platform !== "wechat" || !ref(value.submissionRef) || !clean(value.slotId)
    || !["succeeded", "failed"].includes(value.status) || Number.isNaN(Date.parse(value.completedAt || ""))
    || (value.status === "succeeded" && (!clean(value.relativePath) || !HASH.test(value.sha256 || "") || !Number.isInteger(value.bytes) || value.bytes < 1))
    || !HASH.test(value.resultHash || "") || hashUnifiedContent(base) !== value.resultHash) fail("UNIFIED_WECHAT_IMAGE_RESULT_INVALID");
  return value;
}

export function projectWechatGeneratedImageState(store, { projectId, promptPlan }) {
  const submissions = (store.unifiedWechatImageGenerationSubmissions || []).filter((item) => item.projectId === projectId
    && sameRef(item.promptPlanRef, factRef(promptPlan, "planHash"))).map((item) => clone(validateSubmission(item)));
  const results = (store.unifiedWechatImageGenerationResults || []).filter((item) => item.projectId === projectId)
    .map((item) => clone(validateResult(item)));
  const slots = (promptPlan.prompts || []).map((prompt) => {
    const slotSubmissions = submissions.filter((item) => item.slotId === prompt.slotId).sort((a, b) => a.attempt - b.attempt);
    const submission = slotSubmissions.at(-1) || null;
    const result = submission ? results.find((item) => sameRef(item.submissionRef, factRef(submission, "submissionHash"))) || null : null;
    return {
      slotId: prompt.slotId, role: prompt.role, status: result?.status || (submission ? "processing" : "waiting"),
      attempt: submission?.attempt || 0, providerTaskId: submission?.providerTaskId || null,
      assetRef: result?.status === "succeeded" ? { relativePath: result.relativePath, sha256: result.sha256, bytes: result.bytes } : null,
      error: result?.status === "failed" ? clone(result.error) : null
    };
  });
  return {
    required: slots.length > 0,
    ready: slots.every((item) => item.status === "succeeded"),
    processing: slots.some((item) => item.status === "processing"),
    failed: slots.some((item) => item.status === "failed"),
    slots
  };
}

export function createWechatGeneratedRasterExecution({ providerTransport, assetWriter, persistStore, model = "seedream/4.5-text-to-image", maxPolls = 180, pollIntervalMs = 3000 } = {}) {
  if (typeof providerTransport?.submit !== "function" || typeof providerTransport?.readResult !== "function") fail("UNIFIED_WECHAT_IMAGE_PROVIDER_TRANSPORT_REQUIRED", undefined, 500);
  if (typeof assetWriter !== "function" || typeof persistStore !== "function") fail("UNIFIED_WECHAT_IMAGE_RUNTIME_DEPENDENCY_REQUIRED", undefined, 500);
  return async ({ store, projectId, promptPlan, attempt, idempotencyKey, executedBy, executedAt }) => {
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) fail("UNIFIED_WECHAT_IMAGE_ATTEMPT_INVALID", undefined, 400);
    const promptPlanRef = factRef(promptPlan, "planHash");
    store.unifiedWechatImageGenerationSubmissions ||= [];
    store.unifiedWechatImageGenerationResults ||= [];
    for (const prompt of promptPlan.prompts || []) {
      const request = requestFor(prompt, model);
      const promptHash = hashUnifiedContent({ slotId: prompt.slotId, prompt: request.compiledPrompt, model, size: prompt.size || null });
      const slotKey = `${idempotencyKey}:${prompt.slotId}:attempt-${attempt}`;
      let submission = store.unifiedWechatImageGenerationSubmissions.find((item) => item.projectId === projectId && item.idempotencyKey === slotKey) || null;
      if (!submission) {
        const provider = await providerTransport.submit(request);
        const base = {
          schemaVersion: "1.0", contract: SUBMISSION_CONTRACT,
          id: `wechat-image-submission:${hashUnifiedContent({ projectId, slotKey }).slice(0, 24)}`,
          projectId, platform: "wechat", promptPlanRef, visualRevisionRef: clone(promptPlan.visualRevisionRef), imagePlanRef: clone(promptPlan.imagePlanRef),
          slotId: prompt.slotId, role: prompt.role, promptHash, model, provider: "kie.ai", providerTaskId: provider.taskId,
          idempotencyKey: slotKey, attempt, submittedBy: executedBy, submittedAt: executedAt
        };
        submission = hashed(base, "submissionHash");
        validateSubmission(submission);
        store.unifiedWechatImageGenerationSubmissions.push(clone(submission));
        await persistStore(store);
      } else {
        validateSubmission(submission);
        if (submission.promptHash !== promptHash || !sameRef(submission.promptPlanRef, promptPlanRef)) fail("UNIFIED_WECHAT_IMAGE_EXECUTION_IDEMPOTENCY_CONFLICT");
      }
      const submissionRef = factRef(submission, "submissionHash");
      let prior = store.unifiedWechatImageGenerationResults.find((item) => sameRef(item.submissionRef, submissionRef)) || null;
      if (prior) continue;
      let result = null;
      for (let poll = 0; poll < maxPolls; poll += 1) {
        result = await providerTransport.readResult({ taskId: submission.providerTaskId, model: submission.model });
        if (result.status !== "processing") break;
        if (poll + 1 < maxPolls) await wait(pollIntervalMs);
      }
      if (!result || result.status === "processing") fail("UNIFIED_WECHAT_IMAGE_RECONCILIATION_REQUIRED", undefined, 409, { taskId: submission.providerTaskId, slotId: prompt.slotId });
      let resultBase;
      if (result.status === "succeeded") {
        if (!Buffer.isBuffer(result.bytes) || !result.bytes.length) fail("UNIFIED_WECHAT_IMAGE_PROVIDER_BYTES_REQUIRED");
        const relativePath = `provider/${promptPlan.planHash.slice(0, 16)}/${prompt.slotId}/attempt-${attempt}.png`;
        const receipt = await assetWriter({ relativePath, bytes: result.bytes });
        resultBase = {
          schemaVersion: "1.0", contract: RESULT_CONTRACT, id: `wechat-image-result:${submission.submissionHash.slice(0, 24)}`,
          projectId, platform: "wechat", submissionRef, slotId: prompt.slotId, status: "succeeded",
          relativePath: receipt.relativePath, sha256: receipt.sha256 || sha256(result.bytes), bytes: receipt.bytes || result.bytes.length,
          cost: Number.isFinite(result.cost) ? result.cost : null, costStatus: result.costStatus || "unknown", error: null, completedAt: new Date().toISOString()
        };
      } else {
        resultBase = {
          schemaVersion: "1.0", contract: RESULT_CONTRACT, id: `wechat-image-result:${submission.submissionHash.slice(0, 24)}`,
          projectId, platform: "wechat", submissionRef, slotId: prompt.slotId, status: "failed",
          relativePath: null, sha256: null, bytes: null, cost: Number.isFinite(result.cost) ? result.cost : null,
          costStatus: result.costStatus || "unknown", error: clone(result.error || { code: "UNIFIED_WECHAT_IMAGE_PROVIDER_FAILED", message: "Provider failed" }), completedAt: new Date().toISOString()
        };
      }
      prior = hashed(resultBase, "resultHash");
      validateResult(prior);
      store.unifiedWechatImageGenerationResults.push(clone(prior));
      await persistStore(store);
      if (prior.status === "failed") fail("UNIFIED_WECHAT_IMAGE_PROVIDER_FAILED", prior.error?.message || undefined, 409, { slotId: prompt.slotId, taskId: submission.providerTaskId });
    }
    return projectWechatGeneratedImageState(store, { projectId, promptPlan });
  };
}

export function createWechatGeneratedRasterResolver({ store, assetReader, projectId, promptPlan } = {}) {
  if (typeof assetReader !== "function") fail("UNIFIED_WECHAT_IMAGE_ASSET_READER_REQUIRED", undefined, 500);
  if (!clean(projectId) || !ref(promptPlan && factRef(promptPlan, "planHash"))) fail("UNIFIED_WECHAT_IMAGE_RESOLVER_SCOPE_REQUIRED", undefined, 500);
  return async ({ declaration }) => {
    const promptPlanRef = factRef(promptPlan, "planHash");
    const submission = (store.unifiedWechatImageGenerationSubmissions || []).filter((item) => item.projectId === projectId
      && item.slotId === declaration.slotId && sameRef(item.promptPlanRef, promptPlanRef))
      .map((item) => validateSubmission(item)).sort((a, b) => b.attempt - a.attempt)[0];
    if (!submission) fail("UNIFIED_WECHAT_IMAGE_GENERATION_REQUIRED", undefined, 409, { slotId: declaration.slotId });
    const result = (store.unifiedWechatImageGenerationResults || []).map((item) => validateResult(item))
      .find((item) => sameRef(item.submissionRef, factRef(submission, "submissionHash")) && item.status === "succeeded");
    if (!result) fail("UNIFIED_WECHAT_IMAGE_GENERATION_NOT_READY", undefined, 409, { slotId: declaration.slotId, taskId: submission.providerTaskId });
    const asset = await assetReader({ relativePath: result.relativePath });
    if (!Buffer.isBuffer(asset.bytes) || sha256(asset.bytes) !== result.sha256) fail("UNIFIED_WECHAT_IMAGE_ASSET_HASH_MISMATCH");
    return {
      bytes: asset.bytes, extension: ".png",
      evidence: {
        providerAttemptRef: factRef(submission, "submissionHash"), providerTaskId: submission.providerTaskId,
        provider: submission.provider, model: submission.model, cost: result.cost, costStatus: result.costStatus
      }
    };
  };
}
