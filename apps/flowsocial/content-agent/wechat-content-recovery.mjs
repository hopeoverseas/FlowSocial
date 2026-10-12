import { randomUUID } from "node:crypto";
import { validateWechatArticleForProduction } from "../content-engine.mjs";

const clone = (value) => structuredClone(value);
export const WECHAT_CONTENT_RECOVERY_POLICY_VERSION = "compact-v2";
export const WECHAT_PROVIDER_RETRY_DELAY_MS = 5 * 60 * 1000;
export const WECHAT_RECOVERY_PROVIDER_APPROVAL = Object.freeze({
  maxPreflightCalls: 1,
  maxContentProviderCalls: 4,
  maxTotalProviderCalls: 5,
  automaticRetries: 0,
  contentProviderCallStages: Object.freeze(["body", "metadata", "review", "image_plan"])
});

const PROVIDER_UNAVAILABLE_CODES = new Set([
  "MODEL_HTTP_429", "MODEL_HTTP_5XX", "MODEL_CONNECTION_ERROR", "MODEL_DNS_ERROR",
  "MODEL_TIMEOUT", "MODEL_CONNECT_TIMEOUT", "MODEL_FIRST_TOKEN_TIMEOUT", "MODEL_TASK_TIMEOUT"
]);

function recoveryError(code, message, statusCode = 409, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, ...details });
}

function consumedContentRecoveryAttempts(task) {
  return (task.wechatRecoveryHistory || []).filter((item) => item.policyVersion === WECHAT_CONTENT_RECOVERY_POLICY_VERSION && item.contentRecoveryAttemptConsumed === true).length;
}

function retryBlocked(task, currentTime) {
  const nextRetryAt = task.nextWechatRecoveryRetryAt || null;
  return nextRetryAt && Date.parse(nextRetryAt) > Date.parse(currentTime) ? nextRetryAt : null;
}

export function getWechatContentRecoveryEligibility(task, { maxManualAttempts = 2, now = new Date().toISOString() } = {}) {
  if (!task || task.platform !== "wechat") return { eligible: false, blocker: "WECHAT_CONTENT_TASK_REQUIRED", attemptsUsed: 0, attemptsRemaining: 0, nextRetryAt: null };
  const validation = validateWechatArticleForProduction(task.currentContent || {});
  const attemptsUsed = consumedContentRecoveryAttempts(task);
  const nextRetryAt = retryBlocked(task, now);
  if (validation.valid) return { eligible: false, blocker: "WECHAT_BODY_RECOVERY_NOT_REQUIRED", validation, attemptsUsed, attemptsRemaining: Math.max(0, maxManualAttempts - attemptsUsed), nextRetryAt: null };
  if (nextRetryAt) return { eligible: false, blocker: "PROVIDER_UNAVAILABLE_RETRY_LATER", validation, attemptsUsed, attemptsRemaining: Math.max(0, maxManualAttempts - attemptsUsed), nextRetryAt };
  if (attemptsUsed >= maxManualAttempts) return { eligible: false, blocker: "WECHAT_BODY_RECOVERY_ATTEMPTS_EXHAUSTED", validation, attemptsUsed, attemptsRemaining: 0, nextRetryAt: null };
  return { eligible: true, blocker: null, validation, attemptsUsed, attemptsRemaining: maxManualAttempts - attemptsUsed, nextRetryAt: null };
}

function providerUnavailable(telemetry = {}) {
  return telemetry.providerSucceeded !== true && (PROVIDER_UNAVAILABLE_CODES.has(telemetry.errorCode) || [429, 500, 502, 503, 504].includes(Number(telemetry.httpStatus)) || ["connection", "dns", "timeout", "provider_5xx", "rate_limit"].includes(telemetry.errorCategory));
}

function latestWriterTelemetry(pipeline = {}) {
  return [...(pipeline.skillTraces || [])].reverse().find((item) => item.providerTraceId || item.traceId || item.errorCode) || null;
}

function appendProviderFailure(task, { telemetry, phase, at, nextRetryAt, windowId }) {
  const record = {
    id: `provider_failure_${randomUUID().slice(0, 12)}`,
    policyVersion: WECHAT_CONTENT_RECOVERY_POLICY_VERSION,
    windowId,
    phase,
    traceId: telemetry.traceId || telemetry.providerTraceId || null,
    errorCode: telemetry.errorCode || "MODEL_CONNECTION_ERROR",
    errorCategory: telemetry.errorCategory || "connection",
    httpStatus: telemetry.httpStatus || null,
    configuredModel: telemetry.configuredModel || null,
    requestedModel: telemetry.requestedModel || null,
    effectiveModel: telemetry.effectiveModel || telemetry.model || null,
    providerCallAt: telemetry.at || telemetry.providerCallAt || at,
    recordedAt: at,
    costStatus: telemetry.costStatus || "not_reported",
    nextRetryAt,
    automaticRetry: false
  };
  task.providerFailureHistory ||= [];
  task.providerFailureHistory.push(record);
  task.nextWechatRecoveryRetryAt = nextRetryAt;
  return record;
}

function appendWindow(task, window) {
  window.totalProviderCalls = Number(window.preflightCalls || 0) + Number(window.contentProviderCalls || 0);
  if (window.preflightCalls > WECHAT_RECOVERY_PROVIDER_APPROVAL.maxPreflightCalls
    || window.contentProviderCalls > WECHAT_RECOVERY_PROVIDER_APPROVAL.maxContentProviderCalls
    || window.totalProviderCalls > WECHAT_RECOVERY_PROVIDER_APPROVAL.maxTotalProviderCalls) {
    throw recoveryError("WECHAT_RECOVERY_WINDOW_CALL_LIMIT_EXCEEDED", "单个恢复窗口的 Provider 调用次数越界", 500);
  }
  task.wechatRecoveryWindowHistory ||= [];
  task.wechatRecoveryWindowHistory.push(window);
}

function stageFromExecutionRecord(record) {
  if (record?.capability === "write-wechat-article") return record.stage === "metadata" ? "metadata" : "body";
  if (record?.capability === "review-wechat-article") return "review";
  if (record?.capability === "plan-wechat-images") return "image_plan";
  return null;
}

function actualContentProviderUsage(pipeline, fallback = 1) {
  const records = (pipeline?.executionRecords || []).map((record) => ({ record, stage: stageFromExecutionRecord(record) })).filter((item) => item.stage);
  const unique = [];
  const seen = new Set();
  for (const item of records) {
    const key = item.record.invocationId || item.record.traceId || `${item.stage}:${unique.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item.stage);
  }
  const declaredStages = Array.isArray(pipeline?.wechatSkillChain?.providerCallStages) ? pipeline.wechatSkillChain.providerCallStages : [];
  const stages = unique.length ? unique : declaredStages;
  const writerProviderCalls = Number.isInteger(Number(pipeline?.writerRecovery?.providerCalls)) ? Number(pipeline.writerRecovery.providerCalls) : stages.filter((stage) => ["body", "metadata"].includes(stage)).length;
  const writerProviderCallStages = clone(pipeline?.writerRecovery?.providerCallStages || stages.filter((stage) => ["body", "metadata"].includes(stage)));
  if (stages.length) return { contentProviderCalls: stages.length, contentProviderCallStages: stages, writerProviderCalls, writerProviderCallStages };
  const safeFallback = Math.max(0, Number(fallback || 0));
  return { contentProviderCalls: safeFallback, contentProviderCallStages: safeFallback ? ["body"] : [], writerProviderCalls: safeFallback, writerProviderCallStages: safeFallback ? ["body"] : [] };
}

function unavailableResult(task, { telemetry, phase, startedAt, completedAt, window, retryDelayMs }) {
  const nextRetryAt = new Date(Date.parse(completedAt) + retryDelayMs).toISOString();
  const providerFailure = appendProviderFailure(task, { telemetry, phase, at: completedAt, nextRetryAt, windowId: window.id });
  window.completedAt = completedAt;
  window.status = "provider_unavailable";
  window.nextRetryAt = nextRetryAt;
  appendWindow(task, window);
  task.updatedAt = completedAt;
  return { task, recovered: false, providerUnavailable: true, code: "PROVIDER_UNAVAILABLE_RETRY_LATER", nextRetryAt, providerFailure, recoveryRecord: null, versionRecord: null, liveWindow: window, startedAt };
}

export async function recoverWechatContentTask({ task, runProviderPreflight = null, runPipeline, actor = "workspace_user", now = () => new Date().toISOString(), maxManualAttempts = 2, providerRetryDelayMs = WECHAT_PROVIDER_RETRY_DELAY_MS }) {
  const eligibilityNow = now();
  const eligibility = getWechatContentRecoveryEligibility(task, { maxManualAttempts, now: eligibilityNow });
  if (!eligibility.eligible) {
    const message = eligibility.blocker === "WECHAT_BODY_RECOVERY_NOT_REQUIRED" ? "当前公众号正文不需要恢复"
      : eligibility.blocker === "WECHAT_BODY_RECOVERY_ATTEMPTS_EXHAUSTED" ? "公众号正文恢复次数已用尽"
        : eligibility.blocker === "PROVIDER_UNAVAILABLE_RETRY_LATER" ? "Provider 暂不可用，请在 nextRetryAt 后手动重试"
          : "需要一个公众号 ContentTask";
    throw recoveryError(eligibility.blocker, message, eligibility.blocker === "PROVIDER_UNAVAILABLE_RETRY_LATER" ? 503 : 409, { nextRetryAt: eligibility.nextRetryAt });
  }
  if (typeof runPipeline !== "function") throw recoveryError("WECHAT_BODY_RECOVERY_RUNNER_REQUIRED", "缺少公众号正文恢复执行器", 500);
  const startedAt = eligibilityNow;
  const window = {
    id: `wechat_recovery_window_${randomUUID().slice(0, 12)}`,
    policyVersion: WECHAT_CONTENT_RECOVERY_POLICY_VERSION,
    actor,
    startedAt,
    completedAt: null,
    preflightCalls: 0,
    writerProviderCalls: 0,
    writerProviderCallStages: [],
    contentProviderCalls: 0,
    totalProviderCalls: 0,
    contentProviderCallStages: [],
    maxPreflightCalls: WECHAT_RECOVERY_PROVIDER_APPROVAL.maxPreflightCalls,
    maxContentProviderCalls: WECHAT_RECOVERY_PROVIDER_APPROVAL.maxContentProviderCalls,
    maxProviderCalls: WECHAT_RECOVERY_PROVIDER_APPROVAL.maxTotalProviderCalls,
    approvedContentProviderCallStages: clone(WECHAT_RECOVERY_PROVIDER_APPROVAL.contentProviderCallStages),
    automaticRetry: false,
    status: "running",
    nextRetryAt: null
  };
  if (window.maxPreflightCalls + window.maxContentProviderCalls > window.maxProviderCalls) {
    throw recoveryError("WECHAT_RECOVERY_WINDOW_APPROVAL_INVALID", "公众号恢复审批预算无效", 500);
  }

  if (typeof runProviderPreflight === "function") {
    window.preflightCalls = 1;
    const preflight = await runProviderPreflight();
    if (providerUnavailable(preflight?.telemetry || {})) {
      return unavailableResult(task, { telemetry: preflight.telemetry, phase: "provider_preflight", startedAt, completedAt: now(), window, retryDelayMs: providerRetryDelayMs });
    }
    if (preflight?.telemetry?.providerSucceeded !== true) throw recoveryError("WECHAT_RECOVERY_PREFLIGHT_INVALID", "Provider 预检没有返回可验证成功状态", 503);
  }

  const triggerTraces = (task.skillTraces || []).filter((item) => item.status === "failed" || item.errorCode);
  let pipeline;
  try {
    pipeline = await runPipeline({
      attempt: eligibility.attemptsUsed + 1,
      maxManualAttempts,
      providerCallApproval: clone(WECHAT_RECOVERY_PROVIDER_APPROVAL)
    });
  } catch (error) {
    window.contentProviderCalls = 1;
    pipeline = {
      status: "blocked", skillTraces: [], executionRecords: [], writerRecovery: null,
      qualityReview: { status: "needs_review", decision: "block", checks: [], blockers: [error.code || "WECHAT_BODY_RECOVERY_FAILED"] },
      recoveryError: { code: error.code || "WECHAT_BODY_RECOVERY_FAILED", message: error.message }
    };
  }
  const usage = actualContentProviderUsage(pipeline, window.contentProviderCalls || 1);
  window.writerProviderCalls = usage.writerProviderCalls;
  window.writerProviderCallStages = usage.writerProviderCallStages;
  window.contentProviderCalls = usage.contentProviderCalls;
  window.contentProviderCallStages = usage.contentProviderCallStages;
  window.totalProviderCalls = window.preflightCalls + window.contentProviderCalls;
  if (window.contentProviderCalls > window.maxContentProviderCalls || window.totalProviderCalls > window.maxProviderCalls) {
    throw recoveryError("WECHAT_RECOVERY_WINDOW_CALL_LIMIT_EXCEEDED", "单个恢复窗口的 Provider 调用次数越界", 500);
  }
  const completedAt = now();
  const writerTelemetry = latestWriterTelemetry(pipeline);
  if (writerTelemetry && providerUnavailable(writerTelemetry)) {
    task.skillTraces = [...(task.skillTraces || []), ...(pipeline.skillTraces || [])];
    task.executionRecords = [...(task.executionRecords || []), ...(pipeline.executionRecords || [])];
    task.writerRecovery = clone(pipeline.writerRecovery || task.writerRecovery || null);
    return unavailableResult(task, { telemetry: writerTelemetry, phase: "content_recovery", startedAt, completedAt, window, retryDelayMs: providerRetryDelayMs });
  }

  const outputValidation = validateWechatArticleForProduction(pipeline.contentPackage || {});
  const recovered = pipeline.status === "succeeded" && pipeline.qualityReview?.status === "passed" && outputValidation.valid;
  const contentRecoveryAttemptConsumed = !outputValidation.valid && (
    ["contract_validation", "production_quality_gate"].includes(writerTelemetry?.errorCategory)
    || ["MODEL_CONTRACT_INVALID", "WECHAT_ARTICLE_CONTRACT_INVALID", "WECHAT_ARTICLE_QUALITY_GATE_FAILED"].includes(writerTelemetry?.errorCode)
  );
  const contentRecoveryAttempt = contentRecoveryAttemptConsumed ? eligibility.attemptsUsed + 1 : null;
  const recoveryRecord = {
    id: `wechat_recovery_${randomUUID().slice(0, 12)}`, stage: "platform_writer", policyVersion: WECHAT_CONTENT_RECOVERY_POLICY_VERSION,
    attempt: contentRecoveryAttempt, contentRecoveryAttempt, contentRecoveryAttemptConsumed, maxManualAttempts, actor, startedAt, completedAt,
    fromVersion: Number(task.version || 1), outcome: recovered ? "recovered" : contentRecoveryAttemptConsumed ? "content_contract_blocked" : "downstream_blocked",
    triggerTraceIds: triggerTraces.map((item) => item.traceId || item.providerTraceId).filter(Boolean),
    triggerErrorCodes: [...new Set(triggerTraces.map((item) => item.errorCode).filter(Boolean))],
    failedTraceIds: (pipeline.skillTraces || []).filter((item) => item.status === "failed").map((item) => item.traceId || item.providerTraceId).filter(Boolean),
    errorCodes: [...new Set((pipeline.skillTraces || []).map((item) => item.errorCode).filter(Boolean).concat(pipeline.recoveryError?.code || []))],
    writerRecovery: clone(pipeline.writerRecovery || null),
    providerCallApproval: clone(WECHAT_RECOVERY_PROVIDER_APPROVAL),
    providerCallUsage: {
      preflightCalls: window.preflightCalls,
      writerProviderCalls: window.writerProviderCalls,
      writerProviderCallStages: clone(window.writerProviderCallStages),
      contentProviderCalls: window.contentProviderCalls,
      contentProviderCallStages: clone(window.contentProviderCallStages),
      totalProviderCalls: window.totalProviderCalls,
      automaticRetries: 0
    },
    contractDiagnostics: clone((pipeline.skillTraces || []).filter((item) => item.contractDiagnostics).map((item) => ({
      traceId: item.traceId || item.providerTraceId || null,
      failureStage: item.failureStage || item.contractDiagnostics?.stage || null,
      diagnostics: item.contractDiagnostics
    }))),
    qualityBlockers: clone(pipeline.qualityReview?.blockers || []), outputValidation
  };
  task.wechatRecoveryHistory ||= [];
  task.wechatRecoveryHistory.push(recoveryRecord);
  task.skillTraces = [...(task.skillTraces || []), ...(pipeline.skillTraces || [])];
  task.executionRecords = [...(task.executionRecords || []), ...(pipeline.executionRecords || [])];
  task.writerRecovery = clone(pipeline.writerRecovery || task.writerRecovery || null);
  task.qualityReview = clone(pipeline.qualityReview || task.qualityReview);
  task.status = recovered ? "succeeded" : "blocked";
  task.updatedAt = completedAt;
  task.nextWechatRecoveryRetryAt = null;
  window.completedAt = completedAt;
  window.status = recovered ? "recovered" : recoveryRecord.outcome;
  appendWindow(task, window);
  if (!recovered) return { task, recovered: false, providerUnavailable: false, recoveryRecord, versionRecord: null, liveWindow: window };
  const parentVersion = Number(task.version || 1);
  const nextVersion = parentVersion + 1;
  task.version = nextVersion;
  task.currentContent = clone(pipeline.contentPackage);
  task.contentMaster = clone(pipeline.contentMaster || task.contentMaster);
  task.imagePlan = clone(pipeline.contentPackage.image_plan);
  task.providerMode = pipeline.providerMode;
  task.pipeline = clone(pipeline.pipeline || []);
  task.delivery = null;
  task.assetSummary = null;
  const versionRecord = { id: `version_${randomUUID().slice(0, 8)}`, contentTaskId: task.id, version: nextVersion, parentVersion, recoveryId: recoveryRecord.id, content: clone(task.currentContent), contentMaster: clone(task.contentMaster), qualityReview: clone(task.qualityReview), intentProfileId: task.contentIntentProfile?.profile_id || null, createdAt: completedAt };
  return { task, recovered: true, providerUnavailable: false, recoveryRecord, versionRecord, liveWindow: window };
}
