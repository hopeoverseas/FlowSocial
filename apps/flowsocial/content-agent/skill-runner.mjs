import { randomUUID } from "node:crypto";
import { executeSkill, hashSkillEvidence, loadSkillDefinition } from "../skill-runtime.mjs";
import { buildExecutionRecord, resolveSkillAdapter } from "./skill-adapter-registry.mjs";
import { updateRunNode } from "./run-ledger.mjs";

const STAGE_TO_NODE = Object.freeze({
  source_analysis: "source_resolution",
  source_blueprint: "source_resolution",
  content_master: "content_master",
  outline: "outline",
  platform_writer: "platform_writer",
  optional_revision: "revision",
  title: "title",
  quality_review: "quality",
  image_plan: "render",
  post_render_review: "visual_review",
  revision: "revision"
});

function fallbackUsed(result) {
  return result?.telemetry?.fallbackUsed === true || ["validated_fallback", "orchestrator_fallback", "demo_fallback"].includes(result?.mode);
}

function statusFromResult(result, adapter = null) {
  if (fallbackUsed(result)) {
    if (adapter?.failurePolicy === "block") return "failed";
    if (["review", "review_fallback"].includes(adapter?.failurePolicy)) return "needs_review";
    return "skipped";
  }
  const status = result?.data?.status || result?.status || "completed";
  if (["blocked", "failed", "error"].includes(status)) return "failed";
  if (["needs_review", "review", "revise"].includes(status)) return "needs_review";
  if (["skipped", "degraded"].includes(status)) return "skipped";
  return "completed";
}

function safeErrorCode(error) {
  const value = String(error?.code || "SKILL_EXECUTION_FAILED").replace(/[^A-Z0-9_:-]/gi, "").slice(0, 80);
  return value || "SKILL_EXECUTION_FAILED";
}

const SAFE_ATOMIC_FIELD_PATH_ERROR_CODES = new Set([
  "XHS_ATOMIC_SKILL_OUTPUT_INVALID",
  "XHS_ATOMIC_SKILL_AUTHORITY_INVALID",
  "XHS_CONTENT_COMPONENT_INVALID"
]);
const MAX_SAFE_ATOMIC_FIELD_PATHS = 32;
const MAX_SAFE_ATOMIC_FIELD_PATH_LENGTH = 240;
const MAX_SAFE_GATEWAY_FIELD_PATHS = 30;
const MAX_SAFE_GATEWAY_FIELD_PATH_LENGTH = 100;
const SAFE_GATEWAY_ERROR_CODES = new Set([
  "MODEL_CONNECT_TIMEOUT",
  "MODEL_CONNECTION_ERROR",
  "MODEL_CONTRACT_INVALID",
  "MODEL_DNS_ERROR",
  "MODEL_EMPTY_RESPONSE",
  "MODEL_FIRST_TOKEN_TIMEOUT",
  "MODEL_HTTP_401",
  "MODEL_HTTP_403",
  "MODEL_HTTP_429",
  "MODEL_HTTP_4XX",
  "MODEL_HTTP_5XX",
  "MODEL_INVALID_JSON",
  "MODEL_TASK_TIMEOUT",
  "MODEL_TIMEOUT"
]);
const SAFE_GATEWAY_ERROR_CATEGORIES = new Set([
  "authentication",
  "authorization",
  "connection",
  "contract_validation",
  "dns",
  "empty_response",
  "invalid_json",
  "provider_4xx",
  "provider_5xx",
  "rate_limit",
  "timeout"
]);

function safeAtomicFieldPaths(error) {
  if (!SAFE_ATOMIC_FIELD_PATH_ERROR_CODES.has(error?.code) || !Array.isArray(error?.details?.fieldPaths)) return [];
  const fieldPaths = [];
  for (const path of error.details.fieldPaths) {
    if (typeof path !== "string" || path.length < 1 || path.length > MAX_SAFE_ATOMIC_FIELD_PATH_LENGTH) continue;
    fieldPaths.push(path);
    if (fieldPaths.length === MAX_SAFE_ATOMIC_FIELD_PATHS) break;
  }
  return fieldPaths;
}

function safeGatewayFieldPaths(error) {
  if (error?.gatewayTelemetryFailure !== true || !Array.isArray(error?.gatewayValidationFieldPaths)) return [];
  const fieldPaths = [];
  for (const path of error.gatewayValidationFieldPaths) {
    if (typeof path !== "string" || path.length < 1 || path.length > MAX_SAFE_GATEWAY_FIELD_PATH_LENGTH) continue;
    if (!/^[a-zA-Z0-9_$.[\]:-]+$/.test(path)) continue;
    if (/\[[^0-9]+\]/.test(path)) continue;
    fieldPaths.push(path);
    if (fieldPaths.length === MAX_SAFE_GATEWAY_FIELD_PATHS) break;
  }
  return fieldPaths;
}

function gatewayFailureFromResult(result) {
  if (result?.mode !== "validated_fallback" || result?.telemetry?.providerSucceeded !== false || result?.data != null) return null;
  return Object.assign(new Error("Gateway returned no production data"), {
    code: SAFE_GATEWAY_ERROR_CODES.has(result.telemetry.errorCode) ? result.telemetry.errorCode : "SKILL_EXECUTION_FAILED",
    errorCategory: SAFE_GATEWAY_ERROR_CATEGORIES.has(result.telemetry.errorCategory) ? result.telemetry.errorCategory : "skill_execution",
    gatewayTelemetryFailure: true,
    gatewayValidationFieldPaths: result.telemetry.contractDiagnostics?.validationFieldPaths,
    gatewayContractDiagnostics: result.telemetry.contractDiagnostics ? {
      stage: result.telemetry.contractDiagnostics.stage || null,
      errorCode: result.telemetry.contractDiagnostics.errorCode || null,
      parseMode: result.telemetry.contractDiagnostics.parseMode || null,
      topLevelShape: result.telemetry.contractDiagnostics.topLevelShape || null,
      responseCharacterCount: Number.isFinite(result.telemetry.contractDiagnostics.responseCharacterCount) ? result.telemetry.contractDiagnostics.responseCharacterCount : null
    } : null
  });
}

function sanitizedSkillError(error, capability) {
  const safeError = Object.assign(new Error(`${capability} execution failed`), {
    code: safeErrorCode(error),
    errorCategory: String(error?.errorCategory || error?.category || "skill_execution").replace(/[^a-z0-9_:-]/gi, "").slice(0, 80) || "skill_execution",
    statusCode: Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : 500,
    capability,
    failurePolicy: "block"
  });
  const fieldPaths = safeAtomicFieldPaths(error).concat(safeGatewayFieldPaths(error));
  if (fieldPaths.length) safeError.fieldPaths = fieldPaths;
  if (error?.gatewayContractDiagnostics) safeError.gatewayContractDiagnostics = structuredClone(error.gatewayContractDiagnostics);
  return safeError;
}

function validatePlanStep(step, capability, adapter, authorizationMode) {
  if (!step) {
    if (authorizationMode === "strict") throw Object.assign(new Error(`Execution plan does not authorize ${capability}`), { code: "SKILL_STEP_NOT_PLANNED", statusCode: 409 });
    return "legacy_unplanned";
  }
  if (step.kind !== "skill" || step.capability !== capability) throw new Error(`Execution plan step ${step.id} does not authorize ${capability}`);
  if (!step.enabled) throw Object.assign(new Error(`Execution plan step ${step.id} is waiting for condition: ${step.reason || "unknown"}`), { code: "SKILL_STEP_NOT_ENABLED", statusCode: 409 });
  if (step.outputContract !== adapter.outputContract) throw new Error(`Execution plan output mismatch for ${capability}: ${step.outputContract} != ${adapter.outputContract}`);
  return "planned";
}

function executionMode(result) {
  const mode = String(result?.mode || "unknown").toLowerCase();
  if (fallbackUsed(result)) return "fallback";
  if (mode.includes("deterministic")) return "deterministic_adapter";
  if (["mock", "fixture", "test", "demo"].some((token) => mode.includes(token))) return "mock_fixture";
  return "real";
}

function fallbackResult({ fallback, adapter, capability, error, attempts }) {
  const review = ["review", "review_fallback"].includes(adapter.failurePolicy);
  const skipped = ["keep_original", "keep_text_only", "keep_current_version", "remove_source"].includes(adapter.failurePolicy);
  return {
    data: fallback,
    mode: "orchestrator_fallback",
    warning: `${capability} failed after ${attempts} attempt(s) [${safeErrorCode(error)}]`,
    status: review ? "needs_review" : skipped ? "skipped" : "failed"
  };
}

export async function runContentSkill({ capability, platform, input, generateText, fallback = null, task = null, expectedContract = null, planStep = null, executionPlan = null, planAuthorization = "compatibility", run = null, validateOutput = null, maxAttempts = null, retryErrorCodes = null }) {
  const adapter = resolveSkillAdapter(capability, platform);
  if (!adapter) throw new Error(`Unknown or unsupported content Skill: ${capability} for ${platform || "all platforms"}`);
  if (!["compatibility", "strict"].includes(planAuthorization)) throw new Error(`Unsupported plan authorization mode: ${planAuthorization}`);
  const planAuthorizationStatus = validatePlanStep(planStep, capability, adapter, planAuthorization);
  const definition = loadSkillDefinition(capability);
  const effectiveOutputContract = expectedContract || adapter.outputContract;
  const executionPlanHash = hashSkillEvidence(executionPlan || (planStep ? { schemaVersion: "plan-step@1", step: planStep } : null));
  const inputHash = hashSkillEvidence(input);
  const nodeId = STAGE_TO_NODE[adapter.stage] || adapter.stage;
  const requestedAttempts = Math.max(1, Number(maxAttempts || planStep?.retry?.maxAttempts || 1));
  const attemptsAllowed = task === "write_wechat_article_v2_recovery" ? 1 : requestedAttempts;
  const invocationId = `skill_call_${randomUUID().slice(0, 12)}`;
  let lastError = null;
  let attemptsMade = 0;
  if (run) updateRunNode(run, nodeId, "running", { capability, invocationId, inputContract: adapter.inputContract });

  for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
    attemptsMade = attempt;
    try {
      const result = await executeSkill({ skillName: capability, input, generateText, fallback, expectedContract: effectiveOutputContract, task });
      const gatewayFailure = gatewayFailureFromResult(result);
      if (gatewayFailure) throw gatewayFailure;
      if (typeof validateOutput === "function") {
        const validation = validateOutput(result?.data);
        if (validation === false || validation?.valid === false) throw new Error(`Output validation failed for ${capability}`);
      } else if (result?.data == null) throw new Error(`Skill ${capability} returned no data`);
      result.skillTrace = { traceId: result.skillTrace?.traceId || invocationId, invocationId, attempt, inputContract: adapter.inputContract, ...result.skillTrace };
      const status = statusFromResult(result, adapter);
      result.skillTrace.status = status;
      result.skillTrace.executionMode = executionMode(result);
      result.skillTrace.planAuthorization = planAuthorizationStatus;
      result.skillTrace.executionPlanHash = executionPlanHash;
      result.skillTrace.fallbackUsed = fallbackUsed(result);
      result.skillTrace.providerSucceeded = result?.telemetry ? result.telemetry.providerSucceeded === true : null;
      result.skillTrace.errorCode = result?.telemetry?.errorCode || null;
      result.skillTrace.errorCategory = result?.telemetry?.errorCategory || null;
      const executionRecord = buildExecutionRecord({ capability, platform, trace: result.skillTrace, status, inputVersion: adapter.inputContract, outputVersion: effectiveOutputContract });
      executionRecord.productionEligibleOutput = status === "completed" && result.skillTrace.executionMode === "real" && executionRecord.productionEligibleOutput;
      executionRecord.fallbackUsed = fallbackUsed(result);
      executionRecord.executionMode = result.skillTrace.executionMode;
      executionRecord.planAuthorization = planAuthorizationStatus;
      executionRecord.bundleHash = result.skillTrace.bundleHash;
      executionRecord.inputHash = result.skillTrace.inputHash;
      executionRecord.outputHash = result.skillTrace.outputHash;
      executionRecord.executionPlanHash = executionPlanHash;
      executionRecord.invocationId = invocationId;
      executionRecord.attempt = attempt;
      executionRecord.invocationMode = planStep?.invocationMode || null;
      if (run) updateRunNode(run, nodeId, status === "failed" ? "failed" : status, { capability, invocationId, traceId: result.skillTrace.traceId, attempt });
      return { ...result, executionRecord };
    } catch (error) {
      lastError = error;
      const retryAllowed = !Array.isArray(retryErrorCodes) || retryErrorCodes.includes(error?.code);
      if (attempt < attemptsAllowed && retryAllowed) continue;
      break;
    }
  }

  if (adapter.failurePolicy === "block" || fallback == null) {
    const safeError = sanitizedSkillError(lastError, capability);
    if (run) updateRunNode(run, nodeId, "failed", { capability, invocationId, errorCode: safeError.code });
    throw safeError;
  }
  const result = fallbackResult({ fallback, adapter, capability, error: lastError, attempts: attemptsMade });
  const status = statusFromResult(result, adapter);
  const trace = { traceId: invocationId, invocationId, skillName: capability, skillVersion: definition.version, expectedContract: effectiveOutputContract, bundleHash: definition.bundleHash, inputHash, outputHash: hashSkillEvidence(result.data), executionPlanHash, planAuthorization: planAuthorizationStatus, providerMode: "orchestrator_fallback", executionMode: "fallback", status, fallbackUsed: true, providerSucceeded: false, errorCode: safeErrorCode(lastError), errorCategory: "skill_execution", startedAt: null, completedAt: new Date().toISOString(), attempts: attemptsMade };
  const executionRecord = buildExecutionRecord({ capability, platform, trace, status, inputVersion: adapter.inputContract, outputVersion: effectiveOutputContract });
  executionRecord.productionEligibleOutput = false;
  executionRecord.fallbackUsed = true;
  executionRecord.executionMode = "fallback";
  executionRecord.planAuthorization = planAuthorizationStatus;
  executionRecord.bundleHash = trace.bundleHash;
  executionRecord.inputHash = trace.inputHash;
  executionRecord.outputHash = trace.outputHash;
  executionRecord.executionPlanHash = trace.executionPlanHash;
  executionRecord.invocationId = invocationId;
  executionRecord.attempt = attemptsMade;
  if (run) updateRunNode(run, nodeId, status, { capability, invocationId, traceId: invocationId, errorCode: safeErrorCode(lastError) });
  return { ...result, skillTrace: trace, executionRecord };
}
