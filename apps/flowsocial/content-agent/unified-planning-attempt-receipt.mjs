import { hashUnifiedContent } from "./unified-content-contracts.mjs";

const CONTRACT = "UnifiedContentPlanningAttemptReceipt@1.0";
const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);
const SAFE_FAILURE_KEYS = Object.freeze(["causeCode", "failureClass", "retryable", "stage", "platform", "stepId", "message"]);

function fail(code, message = code, statusCode = 409) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function exactRef(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 2 || !text(value.id, code) || !text(value.hash, code)) {
    fail(code);
  }
  return { id: value.id, hash: value.hash };
}

export function createUnifiedContentPlanningSuccessBinding(publicBootstrap) {
  const bootstrapId = text(publicBootstrap?.id, "UNIFIED_PLANNING_ATTEMPT_PUBLIC_BOOTSTRAP_ID_REQUIRED");
  const outlineRefs = publicBootstrap?.outlineRefs;
  const targetPlatform = ["xiaohongshu", "wechat"].includes(publicBootstrap?.targetPlatform) ? publicBootstrap.targetPlatform : null;
  const platforms = targetPlatform ? [targetPlatform] : ["xiaohongshu", "wechat"];
  if (!outlineRefs || typeof outlineRefs !== "object" || Array.isArray(outlineRefs)
    || Object.keys(outlineRefs).sort().join(",") !== [...platforms].sort().join(",")) {
    fail("UNIFIED_PLANNING_ATTEMPT_PUBLIC_OUTLINE_REFS_REQUIRED");
  }
  const authority = {
    bootstrapId,
    outlineRefs: Object.fromEntries(platforms.map((platform) => [platform, exactRef(outlineRefs[platform], platform === "wechat"
      ? "UNIFIED_PLANNING_ATTEMPT_PUBLIC_WECHAT_OUTLINE_REF_REQUIRED"
      : "UNIFIED_PLANNING_ATTEMPT_PUBLIC_XHS_OUTLINE_REF_REQUIRED")]))
  };
  return {
    bootstrapId,
    planningRef: {
      id: `planning-binding:${bootstrapId}`,
      hash: hashUnifiedContent(authority)
    }
  };
}

function receipts(store) {
  return Array.isArray(store?.unifiedContentPlanningAttemptReceipts)
    ? store.unifiedContentPlanningAttemptReceipts
    : [];
}

function publicReceipt(receipt) {
  const projected = clone(receipt);
  const checkpointStages = Object.keys(projected.stageCheckpoints || {});
  if (checkpointStages.length) projected.checkpointStages = checkpointStages;
  delete projected.stageCheckpoints;
  return projected;
}

function stageFor({ capability, platform }) {
  if (capability === "build-content-master" && platform === "xiaohongshu") return "master";
  if (capability === "generate-content-outline" && platform === "xiaohongshu") return "xiaohongshu_outline";
  if (capability === "generate-content-outline" && platform === "wechat") return "wechat_outline";
  fail("UNIFIED_PLANNING_ATTEMPT_ACTIVITY_UNSUPPORTED");
}

function safeFailure(value) {
  if (!value || typeof value !== "object") return null;
  const projected = {};
  for (const key of SAFE_FAILURE_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    if (key === "retryable") projected.retryable = value.retryable === true;
    else if (key === "message" && typeof value[key] === "string") projected.message = value[key].slice(0, 240);
    else if (value[key] == null || typeof value[key] === "string") projected[key] = value[key] ?? null;
  }
  if (typeof projected.causeCode !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(projected.causeCode)) {
    projected.causeCode = "DEPENDENCY_FAILED";
  }
  return projected;
}

export function listUnifiedContentPlanningAttemptReceipts(store, { requestId = null, projectId = null } = {}) {
  return receipts(store).filter((item) => (!requestId || item.requestId === requestId) && (!projectId || item.projectId === projectId)).map(publicReceipt);
}

export function getUnifiedContentPlanningAttemptCheckpoints(store, attemptId) {
  const matches = receipts(store).filter((item) => item.id === attemptId);
  if (matches.length !== 1) fail("UNIFIED_PLANNING_ATTEMPT_IDENTITY_REQUIRED");
  return clone(matches[0].stageCheckpoints || {});
}

export function createUnifiedContentPlanningAttemptReceipt(store, input, { attemptId, resumeFromAttemptId = null, now = () => new Date().toISOString() } = {}) {
  if (!store || typeof store !== "object") fail("UNIFIED_PLANNING_ATTEMPT_STORE_REQUIRED", null, 500);
  const id = text(attemptId, "UNIFIED_PLANNING_ATTEMPT_ID_REQUIRED");
  if (receipts(store).some((item) => item.id === id)) fail("UNIFIED_PLANNING_ATTEMPT_ID_CONFLICT");
  const startedAt = text(now(), "UNIFIED_PLANNING_ATTEMPT_TIME_REQUIRED");
  const prior = resumeFromAttemptId ? receipts(store).find((item) => item.id === resumeFromAttemptId) : null;
  const reusableMaster = prior?.status === "failed" && prior.requestId === input?.requestId && prior.projectId === input?.projectId
    && prior.targetPlatform === (input?.targetPlatform || null) && prior.stageCheckpoints?.master
    ? clone(prior.stageCheckpoints.master) : null;
  const receipt = {
    schemaVersion: "1.0",
    contract: CONTRACT,
    id,
    requestId: text(input?.requestId, "UNIFIED_PLANNING_ATTEMPT_REQUEST_ID_REQUIRED"),
    projectId: text(input?.projectId, "UNIFIED_PLANNING_ATTEMPT_PROJECT_ID_REQUIRED"),
    companyId: text(input?.companyId, "UNIFIED_PLANNING_ATTEMPT_COMPANY_ID_REQUIRED"),
    targetPlatform: ["xiaohongshu", "wechat"].includes(input?.targetPlatform) ? input.targetPlatform : null,
    resumedFromAttemptId: reusableMaster ? prior.id : null,
    reusedStages: reusableMaster ? ["master"] : [],
    stageCheckpoints: reusableMaster ? { master: reusableMaster } : {},
    operation: "staged_content_planning",
    status: "running",
    clientDisposition: "connected",
    clientDisconnectedAt: null,
    currentStage: "authority",
    invocations: {
      master: { started: 0, completed: 0, failed: 0 },
      xiaohongshu_outline: { started: 0, completed: 0, failed: 0 },
      wechat_outline: { started: 0, completed: 0, failed: 0 }
    },
    providerCallsStarted: 0,
    providerCallsCompleted: 0,
    providerCallsFailed: 0,
    retryCount: 0,
    lastSafeFailure: null,
    planningRef: null,
    bootstrapId: null,
    startedAt,
    finishedAt: null
  };
  store.unifiedContentPlanningAttemptReceipts ||= [];
  store.unifiedContentPlanningAttemptReceipts.push(receipt);
  return clone(receipt);
}

function mutableReceipt(store, attemptId) {
  const matches = receipts(store).filter((item) => item.id === attemptId);
  if (matches.length !== 1) fail("UNIFIED_PLANNING_ATTEMPT_IDENTITY_REQUIRED");
  return matches[0];
}

export function recordUnifiedContentPlanningInvocation(store, attemptId, event) {
  const receipt = mutableReceipt(store, attemptId);
  if (receipt.status !== "running") fail("UNIFIED_PLANNING_ATTEMPT_ALREADY_TERMINAL");
  const stage = stageFor(event || {});
  const phase = event?.phase;
  const counts = receipt.invocations[stage];
  if (phase === "started") {
    const retryAllowed = stage !== "master" && counts.started === 1
      && counts.completed === 0 && counts.failed === 0;
    if (counts.started !== 0 && !retryAllowed) fail("UNIFIED_PLANNING_ATTEMPT_RETRY_FORBIDDEN");
    counts.started += 1;
    receipt.providerCallsStarted += 1;
    if (retryAllowed) receipt.retryCount += 1;
    receipt.currentStage = stage;
  } else if (phase === "completed" || phase === "failed") {
    if (counts.started < 1 || counts.started > 2 || counts.completed + counts.failed !== 0) fail("UNIFIED_PLANNING_ATTEMPT_INVOCATION_TRANSITION_INVALID");
    counts[phase] = 1;
    if (phase === "completed") {
      receipt.providerCallsCompleted += 1;
      receipt.providerCallsFailed += counts.started - 1;
      const checkpoint = event?.checkpoint;
      if (checkpoint?.invocation?.id && checkpoint?.outputFact?.id
        && checkpoint.outputFact.invocationRef?.id === checkpoint.invocation.id
        && checkpoint.outputFact.invocationRef?.hash === checkpoint.invocation.invocationHash) {
        receipt.stageCheckpoints[stage] = clone(checkpoint);
      }
    } else receipt.providerCallsFailed += counts.started;
  } else {
    fail("UNIFIED_PLANNING_ATTEMPT_PHASE_INVALID");
  }
  return clone(receipt);
}

export function markUnifiedContentPlanningClientDisconnected(store, attemptId, { at = new Date().toISOString() } = {}) {
  const receipt = mutableReceipt(store, attemptId);
  if (receipt.clientDisposition === "disconnected") return clone(receipt);
  receipt.clientDisposition = "disconnected";
  receipt.clientDisconnectedAt = text(at, "UNIFIED_PLANNING_ATTEMPT_TIME_REQUIRED");
  return clone(receipt);
}

export function finishUnifiedContentPlanningAttempt(store, attemptId, {
  status,
  at = new Date().toISOString(),
  failure = null,
  planningRef = null,
  bootstrapId = null
} = {}) {
  const receipt = mutableReceipt(store, attemptId);
  if (!TERMINAL_STATUSES.has(status)) fail("UNIFIED_PLANNING_ATTEMPT_TERMINAL_STATUS_INVALID");
  if (receipt.status !== "running") {
    if (receipt.status === status) return clone(receipt);
    fail("UNIFIED_PLANNING_ATTEMPT_TERMINAL_CONFLICT");
  }
  if (status === "succeeded") {
    const selectedStages = receipt.targetPlatform ? ["master", `${receipt.targetPlatform}_outline`] : ["master", "xiaohongshu_outline", "wechat_outline"];
    const stages = selectedStages.map((stage) => receipt.invocations[stage]);
    const completedPlanning = selectedStages.every((stage) => receipt.reusedStages.includes(stage)
      || (receipt.invocations[stage].started >= 1 && receipt.invocations[stage].started <= 2
        && receipt.invocations[stage].completed === 1 && receipt.invocations[stage].failed === 0));
    const idempotentReplay = stages.every((item) => item.started === 0 && item.completed === 0 && item.failed === 0);
    if (!completedPlanning && !idempotentReplay) {
      fail("UNIFIED_PLANNING_ATTEMPT_SUCCESS_INCOMPLETE");
    }
    if (!planningRef?.id || !planningRef?.hash || typeof bootstrapId !== "string" || !bootstrapId) {
      fail("UNIFIED_PLANNING_ATTEMPT_SUCCESS_REFERENCE_REQUIRED");
    }
    receipt.planningRef = clone({ id: planningRef.id, hash: planningRef.hash });
    receipt.bootstrapId = bootstrapId;
    receipt.currentStage = "finalize";
  } else {
    receipt.lastSafeFailure = safeFailure(failure) || { causeCode: "DEPENDENCY_FAILED" };
  }
  receipt.status = status;
  receipt.finishedAt = text(at, "UNIFIED_PLANNING_ATTEMPT_TIME_REQUIRED");
  return clone(receipt);
}
