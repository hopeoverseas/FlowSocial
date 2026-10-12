import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CAPABILITY_STATUSES = Object.freeze([
  "verified_supported",
  "verified_unsupported",
  "not_exposed",
  "not_tested"
]);

export const MAX_BILLABLE_CALLS = 8;
export const DEFAULT_PLANNED_CALLS = 5;
export const DEFAULT_CANDIDATE_COUNT = 1;
export const CREDIT_ESTIMATE = Object.freeze({
  minimumPerCall: 10,
  maximumPerCall: 50,
  source: "https://docs.kie.ai/market/quickstart",
  note: "Kie.ai 官方市场说明图片模型通常消耗 10–50 credits/次；模型页未公开更精确单价"
});

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "../../../..");
const fixturePath = resolve(dirname(scriptPath), "../fixtures/xhs-integrated-page-provider/samples.json");
const fixedOutputDir = resolve(repositoryRoot, ".tmp/xhs-integrated-page-provider-capability");
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

function parseArgs(argv) {
  const live = argv.includes("--live");
  const dryRun = argv.includes("--dry-run") || !live;
  if (live && argv.includes("--dry-run")) throw new Error("--live and --dry-run are mutually exclusive");
  return { live, dryRun };
}

function safeTaskId(value) {
  const source = String(value || "");
  if (!source) return null;
  return source.length <= 12 ? source : `${source.slice(0, 8)}…${source.slice(-4)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /(?:api.?key|authorization|cookie|token|secret)/i.test(key) ? "[REDACTED]" : redactSensitive(item)
  ]));
}

export function assertIsolatedOutput(outputDir, root = repositoryRoot) {
  const expected = resolve(root, ".tmp/xhs-integrated-page-provider-capability");
  const actual = resolve(outputDir);
  if (actual !== expected) throw new Error(`Output must be isolated at ${expected}`);
  const relation = relative(resolve(root, ".tmp"), actual);
  if (!relation || relation.startsWith("..") || isAbsolute(relation)) throw new Error("Output must remain inside repository .tmp");
  return actual;
}

export function validateCandidateCount(requested, returned) {
  const requestedCount = Number(requested);
  const returnedCount = Number(returned);
  return {
    requested: requestedCount,
    returned: returnedCount,
    valid: Number.isInteger(requestedCount) && requestedCount >= 1 && requestedCount <= 3 && returnedCount === requestedCount
  };
}

export function summarizeCreditEvidence(before, after, estimate) {
  const consumed = Number(before) - Number(after);
  if (!Number.isFinite(consumed)) throw new Error("Credit evidence requires numeric before and after values");
  return {
    source: "Kie.ai GET /api/v1/chat/credit before and after probe",
    consumed,
    estimate
  };
}

export function inspectImageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return { format: "unknown", width: null, height: null };
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: "jpeg", width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (offset + 4 >= buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const kind = buffer.subarray(12, 16).toString("ascii");
    if (kind === "VP8X" && buffer.length >= 30) {
      const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
      const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
      return { format: "webp", width, height };
    }
    if (kind === "VP8 " && buffer.length >= 30) {
      return { format: "webp", width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (kind === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return { format: "unknown", width: null, height: null };
}

function exactCanvasCheck(dimensions, canvas) {
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  return {
    expected: { width: canvas.width, height: canvas.height },
    actual: { width: width || null, height: height || null },
    exact: width === canvas.width && height === canvas.height,
    ratio3x4: Boolean(width && height && Math.abs(width / height - 3 / 4) < 0.002)
  };
}

function buildPrompt(sample, fixture) {
  const textLines = [sample.headline, sample.supportingText, ...(sample.labels || [])].filter(Boolean);
  return [
    "生成一张完整的小红书信息设计页面，竖版 3:4，目标画布 1080×1440。图片本身必须包含最终中文排版，不留给后续叠字。",
    `页面任务：${sample.promptPurpose || sample.id}。`,
    `品牌视觉：${fixture.brandStyle.description}。`,
    "请逐字使用且只使用以下文字，不得改写、漏字、增加事实、英文、水印或无关 Logo：",
    ...textLines.map((line) => `「${line}」`),
    "保证主标题、辅助文字、标签层级清楚，缩略图下仍可读，构图像成熟编辑设计而非照片加白框。"
  ].join("\n");
}

function buildReferencePrompt(fixture) {
  const sample = fixture.referenceStyleSample;
  return [
    "把输入图片仅作为已授权的品牌风格和构图参考，生成一张新的完整 3:4 小红书信息页。",
    `保持输入图的色板、字体视觉角色、网格、留白和装饰语言。目标画布 1080×1440。`,
    "逐字使用且只使用以下中文，不复制输入图原有文案，不增加事实、英文、水印或无关 Logo：",
    `「${sample.headline}」`,
    `「${sample.supportingText}」`,
    ...sample.labels.map((line) => `「${line}」`)
  ].join("\n");
}

export function createProbePlan(fixture, provider = {}) {
  const baseRequests = fixture.samples.map((sample) => ({
    id: sample.id,
    capability: "integrated_chinese_full_page",
    model: provider.model || "seedream/4.5-text-to-image",
    input: { prompt: buildPrompt(sample, fixture), aspect_ratio: "3:4", quality: provider.quality || "basic", nsfw_checker: true },
    candidateCount: 1,
    expectedText: [sample.headline, sample.supportingText, ...(sample.labels || [])].filter(Boolean)
  }));
  return {
    schemaVersion: "1.0",
    provider: provider.provider || "Kie.ai",
    baseUrl: provider.baseUrl || "https://api.kie.ai",
    textModel: provider.model || "seedream/4.5-text-to-image",
    editModel: "seedream/4.5-edit",
    quality: provider.quality || "basic",
    outputDir: fixedOutputDir,
    requests: [
      ...baseRequests,
      {
        id: "reference_style",
        capability: "reference_image_and_image_to_image",
        dependsOn: "cover",
        model: "seedream/4.5-edit",
        input: { prompt: buildReferencePrompt(fixture), image_urls: ["$OUTPUT:cover"], aspect_ratio: "3:4", quality: provider.quality || "basic", nsfw_checker: true },
        candidateCount: 1,
        expectedText: [fixture.referenceStyleSample.headline, fixture.referenceStyleSample.supportingText, ...fixture.referenceStyleSample.labels]
      },
      {
        id: "local_edit",
        capability: "prompt_local_edit_without_mask",
        dependsOn: fixture.localEdit.sourceSampleId,
        model: "seedream/4.5-edit",
        input: { prompt: fixture.localEdit.instruction, image_urls: [`$OUTPUT:${fixture.localEdit.sourceSampleId}`], aspect_ratio: "3:4", quality: provider.quality || "basic", nsfw_checker: true },
        candidateCount: 1,
        expectedText: baseRequests.find((item) => item.id === fixture.localEdit.sourceSampleId)?.expectedText || []
      }
    ],
    estimatedBillableCalls: DEFAULT_PLANNED_CALLS,
    maximumBillableCalls: MAX_BILLABLE_CALLS,
    automaticRetries: 0,
    creditEstimate: { minimum: DEFAULT_PLANNED_CALLS * CREDIT_ESTIMATE.minimumPerCall, maximum: DEFAULT_PLANNED_CALLS * CREDIT_ESTIMATE.maximumPerCall, ...CREDIT_ESTIMATE },
    declaredApiSurface: {
      mask: "not_exposed",
      preserveRegions: "not_exposed",
      exactDimensions: "not_exposed",
      candidateCount: "not_exposed"
    }
  };
}

export function validateProbePlan(plan) {
  const errors = [];
  if (plan.estimatedBillableCalls > MAX_BILLABLE_CALLS) errors.push("billable call budget exceeds 8");
  if (plan.requests.length !== plan.estimatedBillableCalls) errors.push("request count does not match budget");
  if (plan.automaticRetries !== 0) errors.push("automatic retries must be zero");
  if (plan.requests.some((item) => item.candidateCount !== DEFAULT_CANDIDATE_COUNT)) errors.push("base capability requests must ask for exactly one candidate");
  if (!Number.isFinite(plan.creditEstimate.minimum) || !Number.isFinite(plan.creditEstimate.maximum)) errors.push("credit estimate is required before live calls");
  assertIsolatedOutput(plan.outputDir);
  return { valid: errors.length === 0, errors };
}

async function fetchJson(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.msg || body?.error || `Provider HTTP ${response.status}`), { statusCode: response.status });
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCredits({ fetchImpl, baseUrl, apiKey }) {
  const body = await fetchJson(fetchImpl, `${baseUrl}/api/v1/chat/credit`, { headers: { Authorization: `Bearer ${apiKey}` } }, 30000);
  const credits = Number(body.data);
  if (body.code !== 200 || !Number.isFinite(credits)) throw new Error(body.msg || "Provider did not return a numeric credit balance");
  return credits;
}

export async function executeProviderTask({
  fetchImpl = fetch,
  waitImpl = wait,
  baseUrl,
  apiKey,
  request,
  outputDir,
  timeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 2500,
  maxPolls = 180
}) {
  let createAttempts = 0;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  createAttempts += 1;
  const created = await fetchJson(fetchImpl, `${baseUrl}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: request.model, input: request.input })
  }, 60000);
  const taskId = created.data?.taskId;
  if (created.code !== 200 || !taskId) throw Object.assign(new Error(created.msg || "Provider did not return a task id"), { createAttempts });
  const states = [];
  let pollCount = 0;
  let terminal = null;
  while (Date.now() - startedMs < timeoutMs && pollCount < maxPolls) {
    await waitImpl(pollIntervalMs);
    pollCount += 1;
    const record = await fetchJson(fetchImpl, `${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    }, 30000);
    const state = String(record.data?.state || "unknown");
    states.push({ poll: pollCount, state, at: new Date().toISOString() });
    if (state === "success") { terminal = record; break; }
    if (["fail", "failed", "error", "cancelled", "canceled"].includes(state)) {
      throw Object.assign(new Error(record.data?.failMsg || `Provider task ended as ${state}`), { taskId: safeTaskId(taskId), createAttempts, pollCount, states });
    }
  }
  if (!terminal) throw Object.assign(new Error("Provider task polling timed out"), { taskId: safeTaskId(taskId), createAttempts, pollCount, states });
  let result = {};
  try { result = JSON.parse(terminal.data?.resultJson || "{}"); } catch { result = {}; }
  const urls = Array.isArray(result.resultUrls) ? result.resultUrls.filter(Boolean) : [];
  const files = [];
  for (const [index, url] of urls.entries()) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Generated image download failed with HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const dimensions = inspectImageDimensions(buffer);
    const extension = dimensions.format === "jpeg" ? ".jpg" : dimensions.format === "webp" ? ".webp" : ".png";
    const filePath = resolve(outputDir, `${request.id}-candidate-${index + 1}${extension}`);
    await writeFile(filePath, buffer);
    files.push({ index: index + 1, filePath, byteLength: buffer.length, sha256: sha256(buffer), dimensions });
  }
  return {
    requestId: request.id,
    capability: request.capability,
    providerTaskId: safeTaskId(taskId),
    taskIdHash: sha256(taskId),
    createAttempts,
    pollCount,
    states,
    terminalState: "success",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
    requestedCandidateCount: request.candidateCount,
    returnedCandidateCount: urls.length,
    candidateCheck: validateCandidateCount(request.candidateCount, urls.length),
    files,
    sourceUrlEvidence: urls.map((url) => ({ host: new URL(url).host, urlHash: sha256(url) })),
    providerResultUrls: urls
  };
}

async function resolveProviderConfig() {
  const candidates = [];
  if (process.env.FLOWSOCIAL_PROVIDER_CONFIG_ROOT) candidates.push(resolve(process.env.FLOWSOCIAL_PROVIDER_CONFIG_ROOT, "apps/flowsocial/provider-config.mjs"));
  candidates.push(resolve(repositoryRoot, "apps/flowsocial/provider-config.mjs"));
  const dotGit = resolve(repositoryRoot, ".git");
  try {
    const pointer = (await readFile(dotGit, "utf8")).trim().replace(/^gitdir:\s*/i, "");
    const marker = pointer.replace(/\\/g, "/").indexOf("/.git/worktrees/");
    if (marker > 0) candidates.push(resolve(pointer.replace(/\\/g, "/").slice(0, marker), "apps/flowsocial/provider-config.mjs"));
  } catch {
    // A normal checkout has a .git directory; the repository-local candidate already covers it.
  }
  for (const candidate of [...new Set(candidates)]) {
    try {
      await access(candidate);
      const module = await import(`${pathToFileURL(candidate).href}?probe=${Date.now()}`);
      const config = module.getProviderConfig();
      if (config.KIE_API_KEY) return { config, source: candidate === candidates[0] ? "configured_root" : "primary_workspace_read_only" };
    } catch {
      // Continue to the next read-only config source.
    }
  }
  const module = await import(pathToFileURL(resolve(repositoryRoot, "apps/flowsocial/provider-config.mjs")).href);
  return { config: module.getProviderConfig(), source: "worktree_defaults" };
}

function initialCapabilityMatrix() {
  return {
    integratedChineseTypography: { status: "not_tested", reason: "requires real generated page and manual visual review" },
    referenceImages: { status: "not_tested", reason: "seedream/4.5-edit exposes image_urls; real style-control result pending" },
    imageToImage: { status: "not_tested", reason: "seedream/4.5-edit exposes image_urls; real response pending" },
    localEditing: { status: "not_tested", reason: "prompt-local edit response and unchanged-region review pending" },
    maskEditing: { status: "not_exposed", reason: "current documented request contract has no mask field" },
    preserveRegions: { status: "not_exposed", reason: "current documented request contract has no structured preserve/lock field" },
    exactDimensions: { status: "not_exposed", reason: "current documented request contract exposes aspect_ratio and quality, not width/height" },
    candidateCount: { status: "not_exposed", reason: "current documented request contract has no candidate-count field; probe sends one task per candidate" },
    cost: { status: "not_tested", reason: "actual credit delta requires live calls" },
    asyncLifecycle: { status: "not_tested", reason: "task creation, polling and terminal state require live calls" }
  };
}

function safePlanSummary(plan, keyConfigured, configSource) {
  return redactSensitive({
    mode: "dry-run",
    provider: plan.provider,
    baseUrl: plan.baseUrl,
    textModel: plan.textModel,
    editModel: plan.editModel,
    quality: plan.quality,
    keyConfigured,
    configSource,
    outputDir: plan.outputDir,
    requestCount: plan.requests.length,
    maximumBillableCalls: plan.maximumBillableCalls,
    candidateCountPerRequest: 1,
    automaticRetries: plan.automaticRetries,
    creditEstimate: plan.creditEstimate,
    calls: plan.requests.map((item) => ({ id: item.id, capability: item.capability, model: item.model, candidateCount: item.candidateCount, dependsOn: item.dependsOn || null, expectedText: item.expectedText })),
    capabilityMatrix: initialCapabilityMatrix(),
    productionWrites: false
  });
}

async function runLive({ plan, fixture, config, configSource }) {
  const validation = validateProbePlan(plan);
  if (!validation.valid) throw new Error(`Live preflight failed: ${validation.errors.join("; ")}`);
  if (!config.KIE_API_KEY) throw new Error("Live preflight failed: KIE_API_KEY is not configured");
  if (!Number.isFinite(plan.creditEstimate.maximum)) throw new Error("Live preflight failed: fee cannot be estimated");
  const baseUrl = String(config.KIE_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl.startsWith("https://")) throw new Error("Live preflight failed: provider base URL must use HTTPS");
  const outputDir = assertIsolatedOutput(plan.outputDir);
  await mkdir(outputDir, { recursive: true });
  const creditsBefore = await fetchCredits({ fetchImpl: fetch, baseUrl, apiKey: config.KIE_API_KEY });
  if (creditsBefore < plan.creditEstimate.maximum) {
    const blocked = { status: "blocked_before_billable_call", reason: "insufficient credits for conservative maximum estimate", availableCredits: creditsBefore, requiredMaximumEstimate: plan.creditEstimate.maximum, billableCalls: 0 };
    await writeFile(resolve(outputDir, "live-result.json"), JSON.stringify(blocked, null, 2));
    throw new Error("Live preflight stopped before generation because available credits are below the conservative maximum estimate");
  }
  const results = [];
  const outputUrls = new Map();
  let billableCalls = 0;
  for (const requestTemplate of plan.requests) {
    if (billableCalls >= MAX_BILLABLE_CALLS) break;
    const request = structuredClone(requestTemplate);
    if (request.dependsOn && !outputUrls.has(request.dependsOn)) {
      results.push({ requestId: request.id, status: "not_tested", reason: `dependency ${request.dependsOn} did not produce a candidate`, billable: false });
      continue;
    }
    if (request.input.image_urls) request.input.image_urls = request.input.image_urls.map((url) => url.startsWith("$OUTPUT:") ? outputUrls.get(url.slice(8)) : url);
    billableCalls += 1;
    try {
      const result = await executeProviderTask({ baseUrl, apiKey: config.KIE_API_KEY, request, outputDir });
      const { providerResultUrls, ...safeResult } = result;
      results.push({ ...safeResult, status: "provider_succeeded", canvasChecks: result.files.map((file) => exactCanvasCheck(file.dimensions, fixture.canvas)) });
      if (providerResultUrls[0]) outputUrls.set(request.id, providerResultUrls[0]);
    } catch (error) {
      results.push({ requestId: request.id, status: "provider_failed", reason: String(error.message || error), createAttempts: Number(error.createAttempts || 1), providerTaskId: error.taskId || null, pollCount: error.pollCount || 0, billable: true });
    }
  }
  const creditsAfter = await fetchCredits({ fetchImpl: fetch, baseUrl, apiKey: config.KIE_API_KEY });
  const report = redactSensitive({
    schemaVersion: "1.0",
    mode: "live",
    provider: plan.provider,
    textModel: plan.textModel,
    editModel: plan.editModel,
    quality: plan.quality,
    configSource,
    executedAt: new Date().toISOString(),
    billableCalls,
    candidateCountPerRequest: 1,
    automaticRetries: 0,
    productionWrites: false,
    outputDir,
    creditEvidence: summarizeCreditEvidence(creditsBefore, creditsAfter, plan.creditEstimate),
    capabilityMatrix: initialCapabilityMatrix(),
    results
  });
  await writeFile(resolve(outputDir, "live-result.json"), JSON.stringify(report, null, 2));
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const { config, source } = await resolveProviderConfig();
  const provider = { provider: config.FLOW_IMAGE_PROVIDER, baseUrl: config.KIE_BASE_URL, model: config.KIE_IMAGE_MODEL, quality: config.KIE_IMAGE_QUALITY };
  const plan = createProbePlan(fixture, provider);
  const validation = validateProbePlan(plan);
  if (!validation.valid) throw new Error(`Probe plan invalid: ${validation.errors.join("; ")}`);
  if (args.dryRun) {
    const summary = safePlanSummary(plan, Boolean(config.KIE_API_KEY), source);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }
  const report = await runLive({ plan, fixture, config, configSource: source });
  console.log(JSON.stringify({ mode: report.mode, provider: report.provider, billableCalls: report.billableCalls, automaticRetries: report.automaticRetries, productionWrites: report.productionWrites, outputDir: report.outputDir, consumedCredits: report.creditEvidence.consumed, results: report.results.map((item) => ({ requestId: item.requestId, status: item.status, providerTaskId: item.providerTaskId || null, returnedCandidateCount: item.returnedCandidateCount || 0, terminalState: item.terminalState || null })) }, null, 2));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(JSON.stringify(redactSensitive({ status: "failed", error: error.message, code: error.code || null }), null, 2));
    process.exitCode = 1;
  });
}
