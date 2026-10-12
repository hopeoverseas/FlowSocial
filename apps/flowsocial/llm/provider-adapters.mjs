import { getProviderConfig } from "../provider-config.mjs";
import { adaptCanonicalSkillEnvelope, contractExample, validateContractSchema } from "./contracts.mjs";

const RECOVERABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);
const TIMEOUT_CODES = new Set(["TIMEOUT", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "ABORT_ERR", "MODEL_CONNECT_TIMEOUT", "MODEL_FIRST_TOKEN_TIMEOUT", "MODEL_TASK_TIMEOUT"]);
const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL"]);
const CONNECTION_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_SOCKET"]);
const SAFE_CATEGORY_MESSAGES = Object.freeze({
  timeout: "Model provider connection timed out",
  dns: "Model provider hostname could not be resolved",
  connection: "Model provider connection failed",
  authentication: "Model provider rejected the credentials",
  authorization: "Model provider denied access",
  rate_limit: "Model provider rate limit reached",
  provider_4xx: "Model provider rejected the request",
  provider_5xx: "Model provider service error",
  empty_response: "Model provider returned an empty response",
  invalid_json: "Model provider returned invalid JSON",
  contract_validation: "Model output failed contract validation"
});

function providerFailure(code, category, message, { status = null, retryable = false, cause = null, contractDiagnostics = null } = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = category;
  error.status = status;
  error.retryable = retryable;
  if (contractDiagnostics) error.contractDiagnostics = contractDiagnostics;
  if (cause) error.cause = cause;
  return error;
}

export function classifyProviderFailure(error = {}) {
  if (error.category && error.code) return {
    code: error.code,
    category: error.category,
    failureClass: error.failureClass || normalizeFailureClass(error.category),
    status: Number.isFinite(error.status) ? error.status : null,
    retryable: error.retryable === true,
    message: SAFE_CATEGORY_MESSAGES[error.category] || "Model provider request failed"
  };
  const status = Number(error.status);
  if (status === 401) return { code: "MODEL_HTTP_401", category: "authentication", failureClass: "provider", status, retryable: false, message: "Model provider rejected the credentials (HTTP 401)" };
  if (status === 403) return { code: "MODEL_HTTP_403", category: "authorization", failureClass: "provider", status, retryable: false, message: "Model provider denied access (HTTP 403)" };
  if (status === 429) return { code: "MODEL_HTTP_429", category: "rate_limit", failureClass: "provider", status, retryable: true, message: "Model provider rate limit reached (HTTP 429)" };
  if (status >= 400 && status <= 499) return { code: "MODEL_HTTP_4XX", category: "provider_4xx", failureClass: "provider", status, retryable: false, message: `Model provider rejected the request (HTTP ${status})` };
  if (status >= 500 && status <= 599) return { code: "MODEL_HTTP_5XX", category: "provider_5xx", failureClass: "provider", status, retryable: RECOVERABLE_HTTP_STATUSES.has(status), message: `Model provider service error (HTTP ${status})` };
  const causeCode = String(error?.cause?.code || error.code || "").toUpperCase();
  if (error?.name === "AbortError" || TIMEOUT_CODES.has(causeCode)) return { code: "MODEL_TIMEOUT", category: "timeout", failureClass: "timeout", status: null, retryable: true, message: "Model provider connection timed out" };
  if (DNS_CODES.has(causeCode)) return { code: "MODEL_DNS_ERROR", category: "dns", failureClass: "network", status: null, retryable: false, message: "Model provider hostname could not be resolved" };
  if (CONNECTION_CODES.has(causeCode)) return { code: "MODEL_CONNECTION_ERROR", category: "connection", failureClass: "network", status: null, retryable: false, message: "Model provider connection failed" };
  if (error.code === "EMPTY_RESPONSE") return { code: "MODEL_EMPTY_RESPONSE", category: "empty_response", failureClass: "provider", status: null, retryable: false, message: "Model provider returned an empty response" };
  if (error.code === "INVALID_JSON") return { code: "MODEL_INVALID_JSON", category: "invalid_json", failureClass: "invalid_json", status: null, retryable: false, message: "Model provider returned invalid JSON" };
  if (error.code === "CONTRACT_INVALID") return { code: "MODEL_CONTRACT_INVALID", category: "contract_validation", failureClass: "schema_validation", status: null, retryable: false, message: "Model output failed contract validation" };
  return { code: "MODEL_CONNECTION_ERROR", category: "connection", failureClass: "network", status: null, retryable: false, message: "Model provider request failed" };
}

function normalizeFailureClass(category = "") {
  if (category === "timeout") return "timeout";
  if (["dns", "connection"].includes(category)) return "network";
  if (category === "invalid_json") return "invalid_json";
  if (category === "contract_validation") return "schema_validation";
  return "provider";
}

async function firstTokenText(response, controller, firstTokenTimeoutMs) {
  if (!response.body?.getReader) return response.text();
  const reader = response.body.getReader();
  let firstTimer;
  let first;
  try {
    first = await Promise.race([
      reader.read(),
      new Promise((resolve, reject) => {
        firstTimer = setTimeout(() => {
          controller.abort();
          reject(providerFailure("MODEL_FIRST_TOKEN_TIMEOUT", "timeout", "Model provider first token timed out", { retryable: true }));
        }, firstTokenTimeoutMs);
      })
    ]);
  } finally {
    clearTimeout(firstTimer);
  }
  const decoder = new TextDecoder();
  let text = first.done ? "" : decoder.decode(first.value, { stream: true });
  while (!first.done) {
    const next = await reader.read();
    if (next.done) break;
    text += decoder.decode(next.value, { stream: true });
  }
  return text + decoder.decode();
}

export function readProviderResponseText(response, controller, timeoutPolicy = {}) {
  const nonStreamingJson = timeoutPolicy.responseMode === "non_streaming_json";
  const longJsonGuardsEnabled = timeoutPolicy.longJsonGuards !== "disabled";
  if (nonStreamingJson && longJsonGuardsEnabled) return response.text();
  return firstTokenText(response, controller, Number(timeoutPolicy.firstTokenTimeoutMs || 120000));
}

async function fetchJson(url, options = {}, timeoutPolicy = {}) {
  const policy = typeof timeoutPolicy === "number"
    ? { connectionTimeoutMs: timeoutPolicy, firstTokenTimeoutMs: timeoutPolicy }
    : timeoutPolicy;
  const connectionTimeoutMs = Number(policy.connectionTimeoutMs || 120000);
  const firstTokenTimeoutMs = Number(policy.firstTokenTimeoutMs || 120000);
  const controller = new AbortController();
  const upstreamSignal = policy.signal || options.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
  }
  let timer = setTimeout(() => controller.abort("MODEL_CONNECT_TIMEOUT"), connectionTimeoutMs);
  try {
    let response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (cause) {
      if (controller.signal.reason === "MODEL_CONNECT_TIMEOUT") {
        throw providerFailure("MODEL_CONNECT_TIMEOUT", "timeout", "Model provider connection timed out", { retryable: true, cause });
      }
      const classified = classifyProviderFailure(cause);
      throw providerFailure(classified.code, classified.category, classified.message, { status: classified.status, retryable: classified.retryable, cause });
    }
    clearTimeout(timer);
    timer = null;
    const text = await readProviderResponseText(response, controller, { ...policy, firstTokenTimeoutMs });
    let body = null;
    if (text) {
      try { body = JSON.parse(text); }
      catch {
        if (response.ok) throw providerFailure("MODEL_INVALID_JSON", "invalid_json", "Model provider returned invalid JSON");
      }
    }
    if (!response.ok) {
      const classified = classifyProviderFailure({ status: response.status });
      throw providerFailure(classified.code, classified.category, classified.message, { status: response.status, retryable: classified.retryable });
    }
    if (!text) throw providerFailure("MODEL_EMPTY_RESPONSE", "empty_response", "Model provider returned an empty response");
    return body;
  } finally {
    if (timer) clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", abortFromUpstream);
  }
}

function tryParseObject(candidate) {
  try {
    const value = JSON.parse(candidate);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const SAFE_TOP_LEVEL_KEYS = new Set(["status", "data", "result", "response", "output", "article_markdown", "title_candidates", "outline", "information_gain", "image_plan", "warnings", "blocked_reasons"]);

function topLevelShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value, keys: [], unknownKeyCount: 0 };
  const keys = Object.keys(value);
  return {
    type: "object",
    keys: keys.filter((key) => SAFE_TOP_LEVEL_KEYS.has(key)).sort(),
    unknownKeyCount: keys.filter((key) => !SAFE_TOP_LEVEL_KEYS.has(key)).length
  };
}

function parseDiagnostics(content, { parseMode, parsed = null } = {}) {
  return {
    responseCharacterCount: String(content || "").length,
    parseMode,
    topLevelShape: parsed ? topLevelShape(parsed) : { type: "unparsed_text", keys: [], unknownKeyCount: 0 }
  };
}

function extractJsonObjects(source) {
  const results = [];
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") inString = false;
        continue;
      }
      if (character === "\"") inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const value = tryParseObject(source.slice(start, index + 1));
          if (value) results.push(value);
          break;
        }
      }
    }
  }
  return results;
}

function contractValidCandidate(contract, candidates) {
  if (!contract) return null;
  for (const candidate of candidates) {
    const adapted = adaptCanonicalSkillEnvelope(contract, candidate);
    if (validateContractSchema(contract, adapted.value).valid) return candidate;
  }
  return null;
}

export function parseStructuredContentResult(content, contract = null) {
  const withoutThinking = String(content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!withoutThinking) throw providerFailure("MODEL_EMPTY_RESPONSE", "empty_response", "Model provider returned empty content", { contractDiagnostics: parseDiagnostics(content, { parseMode: "empty" }) });
  const direct = tryParseObject(withoutThinking);
  if (direct) return { data: direct, parseMode: "direct", diagnostics: parseDiagnostics(content, { parseMode: "direct", parsed: direct }) };
  const fencedMatch = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    const fenced = tryParseObject(fencedMatch[1].trim());
    if (fenced) return { data: fenced, parseMode: "markdown_json", diagnostics: parseDiagnostics(content, { parseMode: "markdown_json", parsed: fenced }) };
  }
  const extracted = extractJsonObjects(withoutThinking);
  const contractCandidate = contractValidCandidate(contract, extracted);
  const selected = contractCandidate || extracted[0] || null;
  const embeddedParseMode = contractCandidate ? "embedded_contract_json" : "embedded_json";
  if (selected) return { data: selected, parseMode: embeddedParseMode, diagnostics: parseDiagnostics(content, { parseMode: embeddedParseMode, parsed: selected }) };
  const likelyTruncated = withoutThinking.startsWith("{") && !withoutThinking.trimEnd().endsWith("}");
  const parseMode = likelyTruncated ? "truncated_json" : "invalid_json";
  throw providerFailure("MODEL_INVALID_JSON", "invalid_json", "Model provider returned invalid structured JSON", { contractDiagnostics: parseDiagnostics(content, { parseMode }) });
}

export function parseStructuredContent(content) {
  return parseStructuredContentResult(content).data;
}

export function buildProviderMessages({ payload, contract, attempt }) {
  const example = contractExample(contract, payload);
  const outlineInput = payload?.input || payload;
  const plan = Array.isArray(outlineInput?.presentation_section_plan) ? outlineInput.presentation_section_plan : null;
  const cardinalityInstruction = contract === "ContentOutline@1.0" && outlineInput?.platform === "xiaohongshu" && plan?.length
    ? ` XHS CARDINALITY HARD CONSTRAINT: output exactly ${plan.length} data.sections in the exact order and placement kinds supplied by presentation_section_plan; do not collapse sections to the number of core units, and do not add or remove sections.`
    : "";
  const carouselCardinality = contract === "XhsCarouselPlanCreativeOutput@1.0" ? outlineInput?.outline_cardinality : null;
  const carouselInstruction = carouselCardinality && Number.isSafeInteger(carouselCardinality.sectionCount)
    && Array.isArray(carouselCardinality.sectionOrder) && carouselCardinality.sectionOrder.length === carouselCardinality.sectionCount
      ? ` XHS CAROUSEL CARDINALITY / CREATIVE-DRAFT CONTRACT IS AUTHORITATIVE: the top-level data object MUST contain exactly schemaVersion, contract, reading_arc, and section_drafts. Never return pages, deck, page IDs, page numbers, roles, section IDs, canvas, authority references, or hashes. Output data.section_drafts with exactly ${carouselCardinality.sectionCount} creative section drafts, one for each confirmed outline section, in this exact order: ${carouselCardinality.sectionOrder.map((item, index) => `${index + 1}:${item.sectionId}/${item.outlineRole}`).join(", ")}. Do not collapse, reorder, synthesize, or omit drafts. Each draft MUST contain only objective, takeaway, text_layers, layout_hint, fact_ids, interpretation_ids and knowledge_asset_ids.`
      : "";
  const wechatNarrativeInstruction = contract === "WechatArticle@2.0"
    && payload?.task === "write_wechat_narrative_creative_draft"
      ? " WECHAT NARRATIVE INSTANCE HARD CONSTRAINT: return one JSON INSTANCE, never a JSON Schema, field catalogue, analysis object, or prose wrapper. The root must contain exactly status, data, warnings, blocked_reasons. status must be success or needs_review. data must be the completed article draft and must include article_markdown, title_candidates, outline, and information_gain. Do not wrap data in schema, properties, payload, content, answer, final, or metadata."
      : "";
  const retryNote = attempt > 1 ? "上一轮输出未通过JSON解析或合同校验。本轮必须补齐所有必填字段，只返回一个完整JSON对象，不要解释，不要Markdown。" : "";
  return [
    { role: "system", content: `你是 FlowSocial 的结构化策略引擎。必须只返回合法 JSON 对象。输出需符合合同 ${contract}。JSON 示例：${JSON.stringify(example)}。${retryNote}` },
    ...(cardinalityInstruction ? [{ role: "system", content: cardinalityInstruction.trim() }] : []),
    ...(carouselInstruction ? [{ role: "system", content: carouselInstruction.trim() }] : []),
    ...(wechatNarrativeInstruction ? [{ role: "system", content: wechatNarrativeInstruction.trim() }] : []),
    { role: "user", content: JSON.stringify(payload) }
  ];
}

function safeSnapshotValue(value) {
  if (Array.isArray(value)) return value.map(safeSnapshotValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/(api.?key|secret|access.?token|authorization|password|credential)/i.test(key)) return [key, "[REDACTED]"];
    return [key, safeSnapshotValue(item)];
  }));
  return value;
}

/** Build an offline, secret-safe final request snapshot for contract tests. */
export function createSecretSafeProviderRequestSnapshot({ payload, contract, attempt = 1, profile = null, capabilities = {}, taskBudget = null } = {}) {
  const application = applyTaskBudgetToProfileApplication(planProviderProfile(profile, capabilities), taskBudget);
  const messages = buildProviderMessages({ payload, contract, attempt });
  const cardinality = payload?.input?.outline_cardinality || payload?.outline_cardinality || null;
  return safeSnapshotValue({
    contract,
    attempt,
    cardinality,
    profile: {
      requested: application.requestedProfile,
      applied: application.appliedProfile,
      temperature: application.request.temperature,
      maxOutputTokens: application.request.maxOutputTokens,
      structuredOutput: application.request.structuredOutput,
      reasoning: application.request.reasoning,
      profileDegradation: application.profileDegradation,
      degraded: application.degraded
    },
    messages: messages.map((message) => ({ role: message.role, content: message.role === "user" ? "[REDACTED_PAYLOAD]" : message.content }))
  });
}

export const buildSecretSafeProviderRequestSnapshot = createSecretSafeProviderRequestSnapshot;

const reasoningCapabilities = new Set(["unsupported", "thinking_toggle", "always_on", "reasoning_effort", "anthropic_budget"]);

export function resolveProviderCapabilities(config = {}, providerName = "") {
  const provider = String(providerName || config.FLOW_MODEL_PROVIDER || "").toLowerCase();
  const protocol = String(config.FLOW_MODEL_PROTOCOL || "openai").toLowerCase();
  const model = String(config.FLOW_MODEL_NAME || "").toLowerCase();
  const configured = String(config.FLOW_MODEL_REASONING_CAPABILITY || "auto").toLowerCase();
  let reasoningControl = reasoningCapabilities.has(configured) ? configured : "unsupported";
  if (configured === "auto") {
    if (protocol === "anthropic" || provider.includes("anthropic") || provider.includes("claude")) {
      reasoningControl = /claude-(?:3-7|4|sonnet-4|opus-4)/.test(model) ? "anthropic_budget" : "unsupported";
    } else if (provider.includes("deepseek") || model.includes("deepseek")) {
      reasoningControl = model.includes("reasoner") ? "always_on" : "thinking_toggle";
    } else {
      reasoningControl = "unsupported";
    }
  }
  const anthropic = protocol === "anthropic" || provider.includes("anthropic") || provider.includes("claude");
  return {
    jsonObject: !anthropic,
    jsonSchema: false,
    structuredOutput: anthropic ? "prompt_only" : "json_object",
    reasoningControl,
    thinkingToggle: reasoningControl === "thinking_toggle",
    reasoningBudget: reasoningControl === "anthropic_budget",
    reasoningEffort: reasoningControl === "reasoning_effort",
    toolCalling: provider.includes("deepseek"),
    maxContextTokens: provider.includes("deepseek") ? 128000 : null
  };
}

function degradation(capability, requested, applied, reason) {
  return { capability, requested, applied, reason };
}

export function planProviderProfile(profile, capabilities = {}) {
  const requested = profile || { name: "default", temperature: 0.2, maxOutputTokens: 8192, structuredOutput: "json_object", reasoning: { enabled: false, budgetTokens: 0, effort: "low" } };
  const profileDegradation = [];
  const request = {
    temperature: Number(requested.temperature ?? 0.2),
    maxOutputTokens: Number(requested.maxOutputTokens || 8192),
    structuredOutput: capabilities.jsonObject ? "json_object" : "prompt_only",
    reasoning: { requested: requested.reasoning?.enabled === true, applied: "disabled", control: capabilities.reasoningControl || "unsupported" }
  };
  if (requested.structuredOutput === "json_object" && !capabilities.jsonObject) {
    profileDegradation.push(degradation("structured_output", "json_object", "prompt_only", "provider_does_not_support_json_object_mode"));
  }
  if (requested.reasoning?.enabled) {
    if (capabilities.reasoningControl === "thinking_toggle") {
      request.reasoning = { ...request.reasoning, applied: "enabled", providerParameter: "thinking" };
    } else if (capabilities.reasoningControl === "always_on") {
      request.reasoning = { ...request.reasoning, applied: "always_on", providerParameter: null };
    } else if (capabilities.reasoningControl === "reasoning_effort") {
      request.reasoning = { ...request.reasoning, applied: "enabled", providerParameter: "reasoning_effort", effort: requested.reasoning.effort || "high" };
    } else if (capabilities.reasoningControl === "anthropic_budget") {
      const budgetTokens = Math.max(1024, Math.min(Number(requested.reasoning.budgetTokens || 8192), request.maxOutputTokens - 1));
      request.reasoning = { ...request.reasoning, applied: "enabled", providerParameter: "thinking", budgetTokens };
      request.temperature = null;
    } else {
      profileDegradation.push(degradation("reasoning", "enabled", "unsupported", "provider_or_model_does_not_support_reasoning_control"));
    }
  } else if (capabilities.reasoningControl === "always_on") {
    request.reasoning = { ...request.reasoning, applied: "always_on", providerParameter: null };
    profileDegradation.push(degradation("reasoning", "disabled", "always_on", "configured_model_cannot_disable_reasoning"));
  } else if (capabilities.reasoningControl === "thinking_toggle") {
    request.reasoning = { ...request.reasoning, applied: "disabled", providerParameter: "thinking" };
  }
  return {
    requestedProfile: requested.requestedName || requested.name || "default",
    appliedProfile: requested.appliedName || requested.name || "default",
    profileMode: requested.mode || "profiled",
    capabilities: { ...capabilities },
    request,
    profileDegradation,
    degraded: profileDegradation.length > 0
  };
}

export function applyTaskBudgetToProfileApplication(application, taskBudget = null) {
  if (!application || !taskBudget) return application;
  const requestedMaxOutputTokens = Number(application.outputTokenBudget?.requestedMaxOutputTokens ?? application.request.maxOutputTokens);
  const taskMaxOutputTokens = Number(taskBudget.maxOutputTokens);
  const effectiveMaxOutputTokens = Number.isFinite(taskMaxOutputTokens)
    ? Math.min(requestedMaxOutputTokens, taskMaxOutputTokens)
    : requestedMaxOutputTokens;
  const request = {
    ...application.request,
    maxOutputTokens: effectiveMaxOutputTokens,
    reasoning: { ...application.request.reasoning }
  };
  const profileDegradation = [...(application.profileDegradation || [])];
  if (taskBudget.reasoningMode === "disable_when_toggleable"
    && application.capabilities?.thinkingToggle === true
    && request.reasoning.applied === "enabled") {
    request.reasoning = { ...request.reasoning, applied: "disabled" };
    profileDegradation.push(degradation("reasoning", "enabled", "disabled", "task_latency_policy_for_non_streaming_json"));
  }
  return {
    ...application,
    request,
    outputTokenBudget: { requestedMaxOutputTokens, taskMaxOutputTokens: Number.isFinite(taskMaxOutputTokens) ? taskMaxOutputTokens : null, effectiveMaxOutputTokens },
    responseMode: taskBudget.responseMode || "non_streaming_json",
    profileDegradation,
    degraded: application.degraded === true || profileDegradation.length > 0
  };
}

function openAiRequestBody(config, messages, application) {
  const body = { model: config.FLOW_MODEL_NAME, max_tokens: application.request.maxOutputTokens, messages, stream: false };
  if (application.request.temperature != null) body.temperature = application.request.temperature;
  if (application.request.structuredOutput === "json_object") body.response_format = { type: "json_object" };
  if (application.request.reasoning.providerParameter === "thinking") body.thinking = { type: application.request.reasoning.applied === "enabled" ? "enabled" : "disabled" };
  if (application.request.reasoning.providerParameter === "reasoning_effort") body.reasoning_effort = application.request.reasoning.effort;
  return body;
}

export class OpenAICompatibleAdapter {
  constructor(config, provider = "OpenAI-compatible", transport = fetchJson) { this.config = config; this.provider = provider; this.transport = transport; }
  getCapabilities() { return resolveProviderCapabilities(this.config, this.provider); }
  planProfile(profile, taskBudget = null) { return applyTaskBudgetToProfileApplication(planProviderProfile(profile, this.getCapabilities()), taskBudget); }
  async invoke({ payload, contract, attempt = 1, profile, profileApplication = null, taskBudget = null, signal = null }) {
    const application = profileApplication || this.planProfile(profile, taskBudget);
    const requestBody = openAiRequestBody(this.config, buildProviderMessages({ payload, contract, attempt }), application);
    if (this.provider === "DeepSeek" && taskBudget?.deepSeekModelOverride) requestBody.model = taskBudget.deepSeekModelOverride;
    const response = await this.transport(`${this.config.FLOW_MODEL_BASE_URL.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.FLOW_MODEL_API_KEY}` }, body: JSON.stringify(requestBody) }, { ...taskBudget, responseMode: application.responseMode || taskBudget?.responseMode || "non_streaming_json", signal });
    const content = response.choices?.[0]?.message?.content;
    const parsed = parseStructuredContentResult(content, contract);
    return { data: parsed.data, structuredParse: { mode: parsed.parseMode, ...parsed.diagnostics }, usage: response.usage || null, responseId: response.id || null, profileApplication: application };
  }
}

export class DeepSeekAdapter extends OpenAICompatibleAdapter {
  constructor(config, transport = fetchJson) { super(config, "DeepSeek", transport); }
}

export class AnthropicAdapter {
  constructor(config, transport = fetchJson) { this.config = config; this.provider = "Anthropic"; this.transport = transport; }
  getCapabilities() { return resolveProviderCapabilities({ ...this.config, FLOW_MODEL_PROTOCOL: "anthropic" }, this.provider); }
  planProfile(profile, taskBudget = null) { return applyTaskBudgetToProfileApplication(planProviderProfile(profile, this.getCapabilities()), taskBudget); }
  async invoke({ payload, contract, attempt = 1, profile, profileApplication = null, taskBudget = null, signal = null }) {
    const application = profileApplication || this.planProfile(profile, taskBudget);
    const messages = buildProviderMessages({ payload, contract, attempt });
    const requestBody = { model: this.config.FLOW_MODEL_NAME, max_tokens: application.request.maxOutputTokens, system: messages.filter((item) => item.role === "system").map((item) => item.content).join("\n"), messages: [messages[messages.length - 1]] };
    if (application.request.temperature != null) requestBody.temperature = application.request.temperature;
    if (application.request.reasoning.providerParameter === "thinking" && application.request.reasoning.applied === "enabled") requestBody.thinking = { type: "enabled", budget_tokens: application.request.reasoning.budgetTokens };
    const response = await this.transport(`${this.config.FLOW_MODEL_BASE_URL.replace(/\/$/, "")}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": this.config.FLOW_MODEL_API_KEY, "Anthropic-Version": "2023-06-01" }, body: JSON.stringify(requestBody) }, { ...taskBudget, responseMode: application.responseMode || taskBudget?.responseMode || "non_streaming_json", signal });
    const parsed = parseStructuredContentResult(response.content?.find((item) => item.type === "text")?.text, contract);
    return { data: parsed.data, structuredParse: { mode: parsed.parseMode, ...parsed.diagnostics }, usage: response.usage || null, responseId: response.id || null, profileApplication: application };
  }
}

export function createConfiguredAdapter({ transport = fetchJson } = {}) {
  const config = getProviderConfig();
  const provider = String(config.FLOW_MODEL_PROVIDER || "").toLowerCase();
  const protocol = String(config.FLOW_MODEL_PROTOCOL || "openai").toLowerCase();
  if (protocol === "anthropic" || provider.includes("anthropic") || provider.includes("claude")) return new AnthropicAdapter(config, transport);
  if (provider.includes("deepseek") || String(config.FLOW_MODEL_NAME || "").toLowerCase().includes("deepseek")) return new DeepSeekAdapter(config, transport);
  return new OpenAICompatibleAdapter(config, config.FLOW_MODEL_PROVIDER || "OpenAI-compatible", transport);
}

export function configuredModelIdentity() {
  const config = getProviderConfig();
  return { provider: config.FLOW_MODEL_PROVIDER, model: config.FLOW_MODEL_NAME, baseUrl: config.FLOW_MODEL_BASE_URL, protocol: config.FLOW_MODEL_PROTOCOL, profileMode: config.FLOW_LLM_PROFILE_MODE || "profiled", structuredRecovery: config.FLOW_MODEL_STRUCTURED_RECOVERY || "enabled", taskBudgets: config.FLOW_MODEL_TASK_BUDGETS || "enabled", longJsonGuards: config.FLOW_MODEL_LONG_JSON_GUARDS || "enabled", capabilities: resolveProviderCapabilities(config), configured: Boolean(config.FLOW_MODEL_API_KEY && config.FLOW_MODEL_BASE_URL && config.FLOW_MODEL_NAME) };
}
