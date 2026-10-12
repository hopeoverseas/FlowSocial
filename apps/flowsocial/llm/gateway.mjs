import { randomUUID } from "node:crypto";
import { adaptCanonicalSkillEnvelope, adaptWechatArticleCandidate, canonicalContractName, validateContractSchema, validateWechatNarrativeDraftSchema } from "./contracts.mjs";
import { buildMinimalRepairPayload, compactLlmPayload } from "./context-budget.mjs";
import { applyTaskBudgetToProfileApplication, classifyProviderFailure, configuredModelIdentity, createConfiguredAdapter } from "./provider-adapters.mjs";
import { getLlmTaskDefinition, listLlmTasks, resolveLlmProfile, resolveLlmTaskBudget } from "./task-registry.mjs";

const runtime = { bootedAt: new Date().toISOString(), connectionState: "unknown", lastSuccessAt: null, lastFailureAt: null, lastError: null, lastFailure: null, calls: [], byTask: new Map() };
const maxEvents = 200;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function invokeWithin(adapter, args, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("LLM task duration budget exhausted"), {
        code: "MODEL_TASK_TIMEOUT",
        category: "timeout",
        failureClass: "timeout",
        retryable: false
      }));
    }, Math.max(1, timeoutMs));
  });
  return Promise.race([adapter.invoke({ ...args, signal: controller.signal }), timeout])
    .finally(() => clearTimeout(timer));
}

function safeIdentifier(value) {
  const normalized = String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 100);
  return normalized || null;
}

function safeContractDiagnostics(value = null) {
  if (!value || typeof value !== "object") return null;
  const shape = value.topLevelShape && typeof value.topLevelShape === "object" ? {
    type: safeIdentifier(value.topLevelShape.type) || "unknown",
    keys: Array.isArray(value.topLevelShape.keys) ? value.topLevelShape.keys.map(safeIdentifier).filter(Boolean).slice(0, 20) : [],
    unknownKeyCount: Math.max(0, Number(value.topLevelShape.unknownKeyCount || 0))
  } : null;
  return {
    stage: ["provider_parse", "contract_schema", "production_quality_gate", "accepted"].includes(value.stage) ? value.stage : null,
    errorCode: safeIdentifier(value.errorCode),
    validationFieldPaths: Array.isArray(value.validationFieldPaths) ? value.validationFieldPaths.filter((path) => typeof path === "string" && path.length <= 160 && /^[A-Za-z0-9_$.[\]:-]+$/.test(path) && !/\[[^0-9]+\]/.test(path) && !/PRIVATE|PROMPT|SECRET|TOKEN|KEY/i.test(path)).slice(0, 30) : [],
    topLevelShape: shape,
    responseCharacterCount: Number.isFinite(Number(value.responseCharacterCount)) ? Math.max(0, Number(value.responseCharacterCount)) : null,
    parseMode: safeIdentifier(value.parseMode),
    wrapperPath: safeIdentifier(value.wrapperPath)
  };
}

function connectivityStateForFailure(failure) {
  if (["contract_validation", "empty_response", "invalid_json", "provider_4xx"].includes(failure.category)) return "connected";
  if (["authentication", "authorization"].includes(failure.category)) return "authentication_failed";
  if (failure.category === "rate_limit") return "rate_limited";
  if (failure.category === "provider_5xx") return "service_error";
  return "unreachable";
}

function safeFailure(failure, { at, task, traceId, profile, attempt, retryCount, durationMs, recoveryEligible, retryScheduled, contractDiagnostics = null }) {
  return {
    at,
    task,
    traceId,
    profile,
    attempt,
    retryCount,
    errorCode: failure.code,
    errorCategory: failure.category,
    failureClass: failure.failureClass,
    httpStatus: failure.status,
    retryable: failure.retryable,
    recoveryEligible,
    retryScheduled,
    durationMs,
    message: failure.message,
    contractDiagnostics: safeContractDiagnostics(contractDiagnostics)
  };
}

function safeProfileApplication(profile, application = null, identity = {}) {
  const source = application || {};
  const request = source.request || {};
  const reasoning = request.reasoning || {};
  const capabilities = source.capabilities || identity.capabilities || {};
  const outputTokenBudget = source.outputTokenBudget || {};
  const profileDegradation = Array.isArray(source.profileDegradation)
    ? source.profileDegradation.map((item) => ({
      capability: safeIdentifier(item?.capability),
      requested: safeIdentifier(item?.requested),
      applied: safeIdentifier(item?.applied),
      reason: safeIdentifier(item?.reason)
    }))
    : [];
  return {
    requestedProfile: safeIdentifier(source.requestedProfile || profile.requestedName || profile.name) || "default",
    appliedProfile: safeIdentifier(source.appliedProfile || profile.appliedName || profile.name) || "default",
    profileMode: safeIdentifier(source.profileMode || profile.mode) || "profiled",
    providerCapabilities: {
      jsonObject: capabilities.jsonObject === true,
      jsonSchema: capabilities.jsonSchema === true,
      structuredOutput: safeIdentifier(capabilities.structuredOutput),
      reasoningControl: safeIdentifier(capabilities.reasoningControl) || "unsupported",
      thinkingToggle: capabilities.thinkingToggle === true,
      reasoningBudget: capabilities.reasoningBudget === true,
      reasoningEffort: capabilities.reasoningEffort === true,
      toolCalling: capabilities.toolCalling === true,
      maxContextTokens: Number.isFinite(capabilities.maxContextTokens) ? capabilities.maxContextTokens : null
    },
    appliedProfileParameters: {
      latencyClass: safeIdentifier(profile.latencyClass),
      temperature: request.temperature === null ? null : Number(request.temperature ?? profile.temperature),
      maxOutputTokens: Number(outputTokenBudget.effectiveMaxOutputTokens || request.maxOutputTokens || profile.maxOutputTokens),
      requestedMaxOutputTokens: Number(outputTokenBudget.requestedMaxOutputTokens || profile.maxOutputTokens),
      taskMaxOutputTokens: Number.isFinite(outputTokenBudget.taskMaxOutputTokens) ? outputTokenBudget.taskMaxOutputTokens : null,
      effectiveMaxOutputTokens: Number(outputTokenBudget.effectiveMaxOutputTokens || request.maxOutputTokens || profile.maxOutputTokens),
      responseMode: safeIdentifier(source.responseMode),
      structuredOutput: safeIdentifier(request.structuredOutput || profile.structuredOutput),
      reasoning: {
        requested: reasoning.requested === true || profile.reasoning?.enabled === true,
        applied: safeIdentifier(reasoning.applied) || (profile.reasoning?.enabled ? "requested" : "disabled"),
        control: safeIdentifier(reasoning.control) || "unsupported",
        effort: safeIdentifier(reasoning.effort),
        budgetTokens: Number.isFinite(reasoning.budgetTokens) ? reasoning.budgetTokens : null
      }
    },
    profileDegradation,
    profileDegraded: source.degraded === true || profileDegradation.length > 0
  };
}

function record(event) {
  runtime.calls.unshift(event);
  runtime.calls = runtime.calls.slice(0, maxEvents);
  const current = runtime.byTask.get(event.task) || { total: 0, success: 0, fallback: 0, durationMs: 0 };
  current.total += 1;
  current.success += event.mode === "live" ? 1 : 0;
  current.fallback += event.fallbackUsed ? 1 : 0;
  current.durationMs += event.durationMs;
  runtime.byTask.set(event.task, current);
}

export async function invokeLlm({
  task = "unclassified",
  payload,
  fallback = {},
  contract = payload?.contract || null,
  maxAttempts = null,
  adapterFactory = createConfiguredAdapter,
  modelIdentity = null,
  retryDelay = wait,
  backoffBaseMs = 250,
  traceId: suppliedTraceId = null,
  taskBudgetOverride = null
}) {
  const identity = modelIdentity || configuredModelIdentity();
  const taskDefinition = getLlmTaskDefinition(task);
  const profile = resolveLlmProfile(taskDefinition.profile, { mode: identity.profileMode });
  const initialProfileTelemetry = safeProfileApplication(profile, null, identity);
  const structuredRecoveryEnabled = identity.structuredRecovery !== "disabled";
  const taskBudgetsEnabled = identity.taskBudgets !== "disabled";
  const resolvedTaskBudget = resolveLlmTaskBudget(task, { enabled: taskBudgetsEnabled, override: taskBudgetOverride });
  const taskBudget = resolvedTaskBudget ? { ...resolvedTaskBudget, longJsonGuards: identity.longJsonGuards === "disabled" ? "disabled" : "enabled" } : null;
  const configuredModel = identity.model || null;
  const deepSeekRequest = /^deepseek$/i.test(String(identity.provider || "").trim());
  const requestedModel = deepSeekRequest && taskBudget?.deepSeekModelOverride ? taskBudget.deepSeekModelOverride : configuredModel;
  const effectiveModel = requestedModel;
  const modelTelemetry = { configuredModel, requestedModel, effectiveModel };
  const canonicalContract = canonicalContractName(contract || taskDefinition.contract || "UnstructuredResult@1.0");
  const traceId = safeIdentifier(suppliedTraceId || payload?.traceId || payload?.requestId) || `llm_${randomUUID().slice(0, 12)}`;
  const requestId = safeIdentifier(payload?.requestId) || traceId;
  const correlation = {
    strategyTurnId: safeIdentifier(payload?.strategyTurnId || payload?.turnId),
    skillExecutionRecordId: safeIdentifier(payload?.skillExecutionRecordId),
    contentRunId: safeIdentifier(payload?.contentRunId || payload?.runId),
    platform: safeIdentifier(payload?.liveInvocation?.platform || payload?.platform),
    stepId: safeIdentifier(payload?.liveInvocation?.stepId || payload?.stepId),
    capability: safeIdentifier(payload?.liveInvocation?.capability || payload?.skill_runtime?.skill_name)
  };
  if (!identity.configured) {
    const event = { at: new Date().toISOString(), traceId, requestId, correlation, task, taskLabel: taskDefinition.label || task, taskProfile: taskDefinition.profile, taskBudget, taskBudgetsEnabled, ...initialProfileTelemetry, ...modelTelemetry, skill: taskDefinition.skill, provider: identity.provider, model: effectiveModel, mode: "demo", finalProviderMode: "demo_fallback", providerSucceeded: false, failureClass: "fallback", terminalFailureClass: "not_configured", structuredRecoveryEnabled, durationMs: 0, attempts: 0, attemptsDetail: [], retryCount: 0, schemaValid: true, fallbackUsed: true, costStatus: "not_reported", errorCode: "NOT_CONFIGURED", errorCategory: "not_configured", attemptFailures: [] };
    record(event);
    return { mode: "demo", data: fallback, warning: "Model provider is not configured", telemetry: event };
  }
  const started = Date.now();
  const configuredAttempts = taskBudget?.maxAttempts || 2;
  const requestedAttempts = Math.max(Number(maxAttempts ?? configuredAttempts) || 1, 1);
  const attemptLimit = Math.min(requestedAttempts, configuredAttempts, 3);
  const deadlineAt = taskBudget ? started + taskBudget.totalTimeoutMs : Number.POSITIVE_INFINITY;
  const compactedInput = taskBudget ? compactLlmPayload(payload, taskBudget.contextCharBudget) : { payload, sourceChars: JSON.stringify(payload).length, outputChars: JSON.stringify(payload).length, trimmed: false };
  const inputBudgetTelemetry = { sourceChars: compactedInput.sourceChars, outputChars: compactedInput.outputChars, trimmed: compactedInput.trimmed };
  let activePayload = compactedInput.payload;
  let repairInputUsed = false;
  const attemptFailures = [];
  const attemptsDetail = [];
  const retryDelaysMs = [];
  let lastFailure = null;
  let lastProfileTelemetry = initialProfileTelemetry;
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    const attemptStarted = Date.now();
    try {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) throw Object.assign(new Error("LLM task duration budget exhausted"), { code: "MODEL_TASK_TIMEOUT", category: "timeout", failureClass: "timeout", retryable: false });
      const adapter = adapterFactory();
      const rawProfileApplication = typeof adapter.planProfile === "function" ? adapter.planProfile(profile, taskBudget) : null;
      const profileApplication = applyTaskBudgetToProfileApplication(rawProfileApplication, taskBudget);
      lastProfileTelemetry = safeProfileApplication(profile, profileApplication, identity);
      const invocation = { payload: activePayload, contract: canonicalContract, attempt, profile, profileApplication, taskBudget };
      const response = taskBudget
        ? await invokeWithin(adapter, invocation, remainingMs)
        : await adapter.invoke(invocation);
      lastProfileTelemetry = safeProfileApplication(profile, response.profileApplication || profileApplication, identity);
      const adapted = canonicalContract === "WechatArticle@2.0"
        ? adaptWechatArticleCandidate(response.data)
        : adaptCanonicalSkillEnvelope(canonicalContract, response.data);
      const narrativeWechatWriter = canonicalContract === "WechatArticle@2.0"
        && (task === "write_wechat_article" || task === "write_wechat_narrative_creative_draft" || task === "execute_skill:write-wechat-article");
      const validation = narrativeWechatWriter
        ? validateWechatNarrativeDraftSchema(adapted.value)
        : validateContractSchema(canonicalContract, adapted.value);
      if (!validation.valid) throw Object.assign(new Error("Model output failed contract validation"), {
        code: "CONTRACT_INVALID",
        validationErrors: validation.errors,
        candidateData: adapted.value,
        contractDiagnostics: {
          stage: "contract_schema",
          errorCode: "MODEL_CONTRACT_SCHEMA_INVALID",
          validationFieldPaths: validation.validationFieldPaths || [],
          topLevelShape: response.structuredParse?.topLevelShape || null,
          responseCharacterCount: response.structuredParse?.responseCharacterCount ?? null,
          parseMode: response.structuredParse?.mode || null,
          wrapperPath: adapted.wrapperPath
        }
      });
      // A complete narrative draft marked `needs_review` is reviewable input,
      // not a terminal writer failure. Canonicalize only this narrow task after
      // schema validation and only when the Provider reported no blockers. The
      // independent WeChat review step remains authoritative and may still
      // revise or block the article before image planning/candidate creation.
      const acceptedValue = narrativeWechatWriter
        && adapted.value?.status === "needs_review"
        && Array.isArray(adapted.value?.blocked_reasons)
        && adapted.value.blocked_reasons.length === 0
        ? {
            ...adapted.value,
            status: "success",
            warnings: [...new Set([...(adapted.value.warnings || []), "provider_draft_requires_independent_review"])]
          }
        : adapted.value;
      const attemptDurationMs = Date.now() - attemptStarted;
      attemptsDetail.push({ attempt, task, traceId, profile: lastProfileTelemetry.appliedProfile, outcome: "provider_success", failureClass: null, durationMs: attemptDurationMs, parseMode: safeIdentifier(response.structuredParse?.mode) });
      runtime.lastSuccessAt = new Date().toISOString();
      runtime.connectionState = "connected";
      const contractDiagnostics = safeContractDiagnostics({ stage: "accepted", errorCode: null, validationFieldPaths: [], topLevelShape: response.structuredParse?.topLevelShape || null, responseCharacterCount: response.structuredParse?.responseCharacterCount ?? null, parseMode: response.structuredParse?.mode || null, wrapperPath: adapted.wrapperPath });
      const event = { at: runtime.lastSuccessAt, traceId, requestId, correlation, task, taskLabel: taskDefinition.label || task, taskProfile: taskDefinition.profile, taskBudget, taskBudgetsEnabled, inputBudget: inputBudgetTelemetry, repairInputUsed, ...lastProfileTelemetry, ...modelTelemetry, skill: taskDefinition.skill, provider: identity.provider, model: effectiveModel, providerRequestId: safeIdentifier(response.responseId), mode: "live", finalProviderMode: "live", providerSucceeded: true, failureClass: null, terminalFailureClass: null, structuredRecoveryEnabled, durationMs: Date.now() - started, attempts: attempt, attemptsDetail, retryCount: attempt - 1, retryDelaysMs, schemaValid: true, fallbackUsed: false, costStatus: response.usage ? "usage_reported" : "not_reported", errorCode: null, errorCategory: null, attemptFailures, structuredParseMode: safeIdentifier(response.structuredParse?.mode), contractDiagnostics, usage: response.usage || null };
      record(event);
      return { mode: "live", data: acceptedValue, telemetry: event };
    } catch (error) {
      const failure = classifyProviderFailure(error);
      const failedAt = new Date().toISOString();
      const recoveryEligible = structuredRecoveryEnabled && ["invalid_json", "schema_validation"].includes(failure.failureClass);
      const retryScheduled = attempt < attemptLimit && (failure.retryable || recoveryEligible);
      const rawDiagnostics = error.contractDiagnostics ? {
        stage: error.contractDiagnostics.stage || "provider_parse",
        errorCode: error.contractDiagnostics.errorCode || failure.code,
        ...error.contractDiagnostics
      } : null;
      const recordedFailure = safeFailure(failure, { at: failedAt, task, traceId, profile: lastProfileTelemetry.appliedProfile, attempt, retryCount: attempt - 1, durationMs: Date.now() - attemptStarted, recoveryEligible, retryScheduled, contractDiagnostics: rawDiagnostics });
      attemptFailures.push(recordedFailure);
      attemptsDetail.push({ ...recordedFailure, outcome: "failed" });
      lastFailure = recordedFailure;
      runtime.lastFailureAt = failedAt;
      runtime.lastFailure = recordedFailure;
      runtime.lastError = { message: failure.message, code: failure.code, category: failure.category, failureClass: failure.failureClass, retryable: failure.retryable, traceId };
      runtime.connectionState = connectivityStateForFailure(failure);
      if (!retryScheduled) break;
      if (failure.failureClass === "schema_validation" && taskBudget) {
        activePayload = buildMinimalRepairPayload({
          contract: canonicalContract,
          validationErrors: error.validationErrors,
          candidate: error.candidateData,
          originalPayload: compactedInput.payload,
          charBudget: taskBudget.repairContextCharBudget
        });
        repairInputUsed = true;
      }
      const delayMs = Math.min(backoffBaseMs * (2 ** (attempt - 1)), 2000);
      if (Date.now() + delayMs >= deadlineAt) break;
      retryDelaysMs.push(delayMs);
      await retryDelay(delayMs);
    }
  }
  const event = { at: runtime.lastFailureAt, traceId, requestId, correlation, task, taskLabel: taskDefinition.label || task, taskProfile: taskDefinition.profile, taskBudget, taskBudgetsEnabled, inputBudget: inputBudgetTelemetry, repairInputUsed, ...lastProfileTelemetry, ...modelTelemetry, skill: taskDefinition.skill, provider: identity.provider, model: effectiveModel, mode: "validated_fallback", finalProviderMode: "validated_fallback", providerSucceeded: false, failureClass: "fallback", terminalFailureClass: lastFailure?.failureClass || "network", structuredRecoveryEnabled, durationMs: Date.now() - started, attempts: attemptFailures.length, attemptsDetail, retryCount: Math.max(0, attemptFailures.length - 1), retryDelaysMs, schemaValid: lastFailure?.failureClass === "schema_validation" ? false : null, fallbackUsed: true, costStatus: "not_reported", errorCode: lastFailure?.errorCode || "MODEL_CONNECTION_ERROR", errorCategory: lastFailure?.errorCategory || "connection", httpStatus: lastFailure?.httpStatus || null, contractDiagnostics: lastFailure?.contractDiagnostics || null, attemptFailures };
  record(event);
  return { mode: "validated_fallback", data: fallback, warning: runtime.lastError?.message || "Model provider request failed", telemetry: event };
}

export function getLlmRuntimeStatus(modelIdentity = null) {
  const identity = modelIdentity || configuredModelIdentity();
  const recentCalls = runtime.calls.slice(0, 20);
  return {
    ...identity,
    runtimeStartedAt: runtime.bootedAt,
    connectionState: !identity.configured ? "unavailable" : recentCalls.length ? runtime.connectionState : "unknown",
    lastSuccessAt: runtime.lastSuccessAt,
    lastFailureAt: runtime.lastFailureAt,
    lastError: runtime.lastError,
    lastFailure: runtime.lastFailure,
    recentCalls,
    recentFailures: recentCalls.flatMap((event) => event.attemptFailures || []).slice(0, 20),
    registeredTasks: listLlmTasks(),
    tasks: Object.fromEntries([...runtime.byTask.entries()].map(([task, value]) => [task, { ...value, averageDurationMs: value.total ? Math.round(value.durationMs / value.total) : 0, fallbackRate: value.total ? Number((value.fallback / value.total).toFixed(3)) : 0 }]))
  };
}

export function resetLlmRuntimeForTests() {
  runtime.bootedAt = new Date().toISOString();
  runtime.connectionState = "unknown";
  runtime.lastSuccessAt = null;
  runtime.lastFailureAt = null;
  runtime.lastError = null;
  runtime.lastFailure = null;
  runtime.calls = [];
  runtime.byTask = new Map();
}
