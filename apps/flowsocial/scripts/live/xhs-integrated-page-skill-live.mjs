import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { featureFlags } from "../../feature-flags.mjs";
import { createProviderCapabilitySnapshot } from "../../image-providers/xhs-integrated-page/capabilities.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import {
  buildIntegratedPageExecutionPlan,
  createCostConfirmation,
  materializeProviderExecutionRequest
} from "../../image-providers/xhs-integrated-page/execution-plan.mjs";
import { normalizePngCandidate, readPngDimensions, readPngMetadata } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { buildVisualAssetRegistrySnapshot } from "../../image-providers/xhs-integrated-page/registry.mjs";
import { createPromptReviewDecision, transitionPromptReviewDecision } from "../../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { adaptHistoricalV10Invocation, invokeDesignXhsIntegratedPages } from "../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { loadLibraries } from "../../skills/design-xhs-integrated-pages/scripts/validate-library.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../../..");
export const fixturePath = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-integrated-page-skill-live/preflight.json");
export const fullDeckFixturePath = resolve(repoRoot, "apps/flowsocial/scripts/fixtures/xhs-integrated-page-skill-live/full-deck-preflight.json");
export const outputDir = resolve(repoRoot, "apps/flowsocial/.tmp/fs-v1-xhs-visual-05m");
export const promptReviewPath = resolve(outputDir, "prompt-review.json");
export let recoveryOutputDir = resolve(repoRoot, "apps/flowsocial/.tmp/fs-v1-xhs-visual-05n");
export let fullDeckPlanPath = resolve(recoveryOutputDir, "full-deck-offline-plan.json");
export let fullDeckLiveSummaryPath = resolve(recoveryOutputDir, "full-deck-live-summary.json");
export let fullDeckOfficialPreflightPath = resolve(recoveryOutputDir, "full-deck-official-preflight.json");
export let fullDeckPreflightConsumptionLedgerPath = resolve(recoveryOutputDir, "full-deck-preflight-consumption-ledger.json");
export let p9RecoverySummaryPath = resolve(recoveryOutputDir, "p9-recovery-summary.json");
export const prior05MOutputDir = "C:\\Users\\kiera\\Documents\\社媒-worktrees\\xhs-visual-05m\\apps\\flowsocial\\.tmp\\fs-v1-xhs-visual-05m";
const API_ROOT = "https://api.kie.ai";
const OFFICIAL_EVIDENCE_URLS = Object.freeze({ documentation: "https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image", pricing: "https://kie.ai/gpt-image-2", credit: "https://kie.ai/qwen/image-edit" });
const OFFICIAL_EVIDENCE_TRANSPORTS = Object.freeze(["node_fetch", "system_curl"]);
const OFFICIAL_EVIDENCE_MAX_BYTES = 1_000_000;
const PAGE_IDS = Object.freeze(["P1", "P5", "P9"]);
const FULL_DECK_PAGE_IDS = Object.freeze(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
const FULL_DECK_PENDING_PAGE_IDS = Object.freeze(FULL_DECK_PAGE_IDS.slice(1));
const MAX_SELECTED_RECOVERY_PAGES = FULL_DECK_PENDING_PAGE_IDS.length;
const FULL_DECK_SEMANTIC_ROLES = Object.freeze({ P1: "cover", P2: "problem", P3: "evidence", P4: "problem", P5: "problem", P6: "method", P7: "evidence", P8: "summary", P9: "cta" });
const RECOVERY_PAGE_IDS = Object.freeze(["P5", "P9"]);
const PRIOR_05M = Object.freeze({
  nativeSha256: "217ec892f93dd82cb8117cc85f71cc03651f440904497cd8e41c49654440af71",
  promptSetHash: "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f",
  invocationHash: "1c39503df93bf8c70631f1470812f07d88e446185596186c316e69add44ae1ed",
  planHash: "1559773b51656a595af5a6a1564876b89783365ca5529b4cffca54e19111983d",
  requestHashes: Object.freeze({ P1: "abfb827c658c3fafcd92cae631789e4cf0de1bbd5335876e2ccc5419b63071d0", P5: "9586120375ce399e0452f9f5b4aca5849cb3955d9debc4b59fd17ccba8ac0009", P9: "cb6ebc972e45bb74cfb4bc91b08ff6986e2d772cf3a79404595ad021d8a2b6c8" })
});
const ALLOWED_BUILD_FIELDS = Object.freeze(["promptApproval", "now"]);
const EDITORIAL_ANTI_TEMPLATE_CONSTRAINTS = Object.freeze([
  "整页必须像完成的原创编辑设计海报，保持纸面编辑设计与单一隐喻",
  "禁止网页、UI、仪表盘、组件库、卡片式信息面板、HTML/CSS 截图感",
  "不得让矩形卡片成为主构图"
]);
const AUDIENCE_SAFE_ANTI_TEMPLATE_CONSTRAINTS = Object.freeze([
  "整页必须像完成的原创编辑设计海报，保持纸面编辑设计与单一隐喻",
  "禁止网页、界面、仪表盘、组件库、卡片式信息面板、网页排版 截图感",
  "不得让矩形卡片成为主构图"
]);
const sha256Bytes = (value) => createHash("sha256").update(value).digest("hex");
const exact = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:OBJECT_REQUIRED`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) throw new Error(`${label}:FIELDS:${Object.keys(value).sort().join(",")}`);
};
const within = (child, parent) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export function sanitizeEvidence(value) {
  return String(value)
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:KIE_API_KEY|KIEAI_API_KEY|KIE_AI_API_KEY)\s*[=:]\s*\S+/gi, "API_KEY=[REDACTED]")
    .replace(/[?&](?:token|key|signature)=[^&\s]+/gi, (match) => `${match[0]}credential=[REDACTED]`)
    .replace(/\btask[_-][a-z0-9_-]+\b/gi, "[REDACTED_ID]");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

export function loadConfig(path = fixturePath, pageIds = PAGE_IDS) {
  const value = readJson(path);
  exact(value, ["schemaVersion", "sourceDeckPath", "expectedSourceFileSha256", "expectedSourcePageHashes", "contentVersion", "selectedStylePackId", "selectedDirectionId", "selectedPages", "providerProfile", "officialEvidence", "budget", "capabilities", "directionCandidates"], "05m.config");
  assert.equal(value.schemaVersion, "1.0");
  assert.deepEqual(value.selectedPages.map((item) => item.pageId), pageIds);
  assert.equal(value.selectedStylePackId, "editorial-metaphor");
  assert.equal(value.providerProfile.provider, "kie.ai");
  assert.equal(value.providerProfile.model, "gpt-image-2-text-to-image");
  assert.equal(value.providerProfile.adapter.projectionKey, "image2.text-to-image.v1");
  assert.deepEqual(value.providerProfile.requestFields, ["model", "input.prompt", "input.aspect_ratio", "input.resolution"]);
  assert.equal(value.budget.approvedPaidRequests, pageIds.length);
  assert.equal(value.budget.candidatesPerRequest, 1);
  assert.equal(value.budget.automaticRetries, 0);
  assert.ok(value.providerProfile.estimatedCostPerCandidate <= value.budget.maxCreditsPerRequest);
  assert.ok(value.providerProfile.estimatedCostPerCandidate * value.budget.approvedPaidRequests <= value.budget.maxTotalCredits);
  assert.equal(value.budget.maxCreditsPerRequest, 8);
  assert.ok(value.budget.maxTotalCredits >= value.providerProfile.estimatedCostPerCandidate * pageIds.length);
  return value;
}

export function validateIsolation(target = outputDir) {
  const isolatedRoot = resolve(repoRoot, "apps/flowsocial/.tmp/fs-v1-xhs-visual-05m");
  assert.equal(resolve(target), isolatedRoot, "05M output directory changed");
  const ignoredProbe = relative(repoRoot, resolve(target, "prompt-review.json"));
  assert.equal(spawnSync("git", ["check-ignore", "--quiet", "--", ignoredProbe], { cwd: repoRoot }).status, 0, "05M output is not git ignored");
  if (existsSync(target)) {
    assert.equal(lstatSync(target).isSymbolicLink(), false, "05M output is a symlink");
    assert.ok(within(realpathSync(target), realpathSync(resolve(repoRoot, "apps/flowsocial/.tmp"))), "05M output escaped isolation");
  }
  return true;
}

function loadFrozenDeck(sourcePath, config, pageIds = PAGE_IDS) {
  if (basename(sourcePath).toLowerCase() !== "deck-spec.json") throw new Error("SOURCE_MUST_BE_DECK_SPEC_JSON");
  const bytes = readFileSync(sourcePath);
  const deck = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  if (!Array.isArray(deck.pages)) throw new Error("SOURCE_DECK_PAGES_REQUIRED");
  const selected = pageIds.map((pageId) => {
    const matches = deck.pages.filter((page) => page.page_id === pageId);
    if (matches.length !== 1) throw new Error(`SOURCE_PAGE_ID_NOT_UNIQUE:${pageId}`);
    return matches[0];
  });
  const sourceFileHash = sha256Bytes(bytes);
  if (sourceFileHash !== config.expectedSourceFileSha256) throw new Error("SOURCE_DECK_FILE_HASH_CHANGED");
  for (const page of selected) if (stableHash(page) !== config.expectedSourcePageHashes[page.page_id]) throw new Error(`SOURCE_PAGE_HASH_CHANGED:${page.page_id}`);
  return { sourcePath, sourceFileHash, selected };
}

function adaptRuntimeInput(source, config) {
  const selections = new Map(config.selectedPages.map((item) => [item.pageId, item]));
  const fullDeck = config.budget?.maxNewProviderCalls === 8;
  const fullDeckDnaConstraint = "全套保持纸面编辑设计、酒红/炭黑/暖白色彩和 headline/body/cta 文字角色；P6 的手绘辅助不得改变该 DNA";
  const pages = source.selected.map((page) => {
    const selection = selections.get(page.page_id);
    if (page.page_role !== selection.sourcePageRole) throw new Error(`SOURCE_PAGE_ROLE_CHANGED:${page.page_id}`);
    const textLayers = page.text_layers.map((layer) => ({
      type: selection.runtimePageRole === "cta" && layer.type === "body" ? "cta" : layer.type,
      text: layer.text
    }));
    return {
      page: page.page_number,
      role: selection.runtimePageRole,
      text_layers: textLayers,
      fact_ids: [...page.fact_ids],
      interpretation_ids: [...page.interpretation_ids],
      must_avoid: ["不得增加未冻结事实、数据、产品能力或 CTA", "不得生成英文伪文字、竞品品牌、艺术家、IP 或 1:1 复刻要求", ...(fullDeck ? [fullDeckDnaConstraint] : []), ...EDITORIAL_ANTI_TEMPLATE_CONSTRAINTS]
    };
  });
  const p9Cta = pages.find((page) => page.page === 9).text_layers.find((layer) => layer.type === "cta")?.text || "";
  return {
    schemaVersion: "1.0",
    contract: "DesignXhsIntegratedPagesRuntimeInput@1.0",
    id: `05m-v3-p1-p5-p9-${source.sourceFileHash.slice(0, 16)}`,
    xhsPostPackage: { status: "success", data: { platform: "xiaohongshu", post_copy: { cta: p9Cta }, deck: { pages } } },
    contentVersion: config.contentVersion,
    designDna: {
      snapshotId: fullDeck ? "design-dna:05n:editorial-primary-friendly-method-auxiliary" : "design-dna:05m:user-confirmed-editorial-metaphor",
      palette: ["burgundy", "paper", "charcoal"],
      typographyRoles: ["headline", "body", "cta"],
      constraints: [fullDeck ? "九页以 editorial-metaphor 为主；仅 P6/method 可使用 friendly-handdrawn-tech 语义辅助，保持同一纸面、酒红/炭黑/暖白与文字角色" : "三页共享 editorial-metaphor", "逐字保留中文真值", "主隐喻不得替代事实", "禁止 HTML/CSS 二次排版", ...EDITORIAL_ANTI_TEMPLATE_CONSTRAINTS]
    },
    authorizedAssets: [],
    providerCapability: { integratedChineseTypography: true, exactDimensions: false, referenceImages: false },
    pageDensity: Object.fromEntries(config.selectedPages.map((item) => [item.pageId, item.density])),
    visualSelection: {
      stylePackId: config.selectedStylePackId,
      reason: fullDeck ? "用户确认 editorial-metaphor 为主方向；P6 的冻结三步方法按 semantic_auxiliary_style Adapter 使用 friendly-handdrawn-tech，其他页面保持 editorial-metaphor" : "用户于 2026-08-04 确认三页共享 editorial-metaphor",
      pages: config.selectedPages.map((item) => ({ pageId: item.pageId, archetypeId: item.archetypeId, patternIds: [...item.patternIds], referenceAssetIds: [], verbatimTextOverride: null, stylePackId: item.stylePackId || null }))
    }
  };
}

function reviewDecision(invocation, config, promptApproval, now) {
  let decision = createPromptReviewDecision({ id: `05m-review:${invocation.runtimeInputRef.id}`, promptSet: invocation.promptSet, directionCandidates: config.directionCandidates });
  decision = transitionPromptReviewDecision(decision, { lane: "visualDirectionSelection", action: "select", directionId: config.selectedDirectionId, actor: "user-confirmed-2026-08-04", at: now });
  if (promptApproval) {
    exact(promptApproval, ["schemaVersion", "decision", "promptSetHash", "reviewedBy", "reviewedAt"], "05m.promptApproval");
    if (promptApproval.schemaVersion !== "1.0" || promptApproval.decision !== "approved" || !String(promptApproval.reviewedBy).startsWith("controller-")) throw new Error("CONTROLLER_PROMPT_APPROVAL_INVALID");
    decision = transitionPromptReviewDecision(decision, { lane: "promptReview", action: "approve", reviewedPromptSetHash: promptApproval.promptSetHash, actor: promptApproval.reviewedBy, at: promptApproval.reviewedAt });
  }
  return decision;
}

function buildEvidence(preflight, pageIds = PAGE_IDS) {
  const { config, source, invocation, plan, requests, runtimeInput, flagsDefault } = preflight;
  return {
    schemaVersion: "1.0",
    contract: "XhsIntegratedPageSkillLivePreflight@1.0",
    mode: "dry-run",
    source: { path: source.sourcePath, fileSha256: source.sourceFileHash, allowedInput: "deck-spec.json only", forbiddenSiblingInputs: ["html", "css", "deterministic_png"] },
    pages: plan.pages.map((page, index) => {
      const spec = invocation.promptSet.pagePromptSpecs[index];
      const binding = invocation.assetBindings[index];
      const sourcePage = source.selected[index];
      const selection = config.selectedPages[index];
      const request = requests[index]?.request || page.providerRequest;
      return {
        pageId: page.pageId,
        sourcePageRole: selection.sourcePageRole,
        runtimePageRole: selection.runtimePageRole,
        ...(selection.semanticRationale ? { semanticRationale: selection.semanticRationale } : {}),
        sourcePageHash: stableHash(sourcePage),
        truth: spec.contentTruth,
        truthHash: stableHash(spec.contentTruth),
        archetypeRef: binding.archetype,
        stylePackRef: binding.stylePack,
        patternRefs: binding.patterns,
        requestMaterialization: requests[index]?.status || "blocked_pending_controller_prompt_review",
        requestFields: request.requestFields,
        requestSummary: { endpoint: request.endpoint, method: request.method, model: request.body.model, aspectRatio: request.body.input.aspect_ratio, resolution: request.body.input.resolution, candidates: 1 },
        providerPrompt: request.body.input.prompt,
        providerPromptHash: stableHash(request.body.input.prompt)
      };
    }),
    runtimeInputRef: { contract: runtimeInput.contract, id: runtimeInput.id, hash: stableHash(runtimeInput) },
    skill: { name: invocation.skill.name, version: invocation.skill.version, invocationHash: invocation.invocationHash, promptSetHash: invocation.promptSetHash },
    plan: { contract: plan.contract, id: plan.id, hash: plan.planHash, status: plan.execution.status, productionEligible: plan.productionEligible, states: plan.states },
    review: { selectedStylePackId: config.selectedStylePackId, selectedDirectionId: config.selectedDirectionId, promptStatus: plan.states.promptReview, requiredApproval: { schemaVersion: "1.0", decision: "approved", promptSetHash: invocation.promptSetHash, reviewedBy: "controller-<name>", reviewedAt: "ISO-8601" } },
    provider: { id: config.providerProfile.provider, model: config.providerProfile.model, adapter: config.providerProfile.adapter, officialEvidence: config.officialEvidence },
    budget: { ...config.budget, estimatedCreditsPerRequest: config.providerProfile.estimatedCostPerCandidate, estimatedTotalCredits: config.providerProfile.estimatedCostPerCandidate * pageIds.length },
    boundaries: { featureFlagDefault: flagsDefault, isolatedExperimentalOverrideForPlan: true, productionEligible: false, actualPaidRequests: 0, networkCalls: 0, providerCalls: 0, automaticRetries: 0, databaseWrites: 0, productionWrites: false, userSelection: "not_selected", delivery: "not_delivered" },
    evidenceHash: stableHash({ source: source.sourceFileHash, invocation: invocation.invocationHash, plan: plan.planHash, promptHashes: plan.pages.map((page) => stableHash(page.providerRequest.body.input.prompt)) })
  };
}

function buildPreflightFromConfig(config, pageIds, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("05m.buildOptions:OBJECT_REQUIRED");
  if (Object.keys(options).some((key) => !ALLOWED_BUILD_FIELDS.includes(key))) throw new Error(`LIVE_HARNESS_INPUT_FIELDS:${Object.keys(options).sort().join(",")}`);
  const source = loadFrozenDeck(config.sourceDeckPath, config, pageIds);
  const runtimeInput = adaptRuntimeInput(source, config);
  const generatedInvocation = invokeDesignXhsIntegratedPages(runtimeInput);
  // Never coerce a newly compiled prompt set into the historical 05M
  // identity. The adapter exists only for an invocation that already carries
  // the frozen prompt hash; new definitions must create new immutable hashes.
  const invocation = pageIds === PAGE_IDS && generatedInvocation.promptSetHash === "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f"
    ? adaptHistoricalV10Invocation(generatedInvocation)
    : generatedInvocation;
  if (invocation.promptSet.status !== "draft" || invocation.promptSet.blockers.length) throw new Error("SKILL_PROMPT_SET_BLOCKED");
  const libraries = loadLibraries();
  const capabilitySnapshot = createProviderCapabilitySnapshot({ id: "capability-image2-05m", capabilities: config.capabilities });
  const registrySnapshot = buildVisualAssetRegistrySnapshot({ id: "registry-05m-skill-live", libraries, referenceAssets: [] });
  const now = options.now || new Date().toISOString();
  const review = reviewDecision(invocation, config, options.promptApproval || null, now);
  const cost = createCostConfirmation({ status: "confirmed", currency: "credits", approvedMaxTotal: config.budget.maxTotalCredits, confirmedBy: "user-budget-authorization-2026-08-04", confirmedAt: "2026-08-04T00:00:00.000Z" });
  const flagsDefault = featureFlags().xhsIntegratedPageSkillExecutionPlan;
  if (flagsDefault !== false) throw new Error("FEATURE_FLAG_MUST_REMAIN_DEFAULT_OFF");
  const plan = buildIntegratedPageExecutionPlan({
    skillInvocation: invocation,
    reviewDecision: review,
    capabilitySnapshot,
    registrySnapshot,
    libraries,
    directionCandidates: config.directionCandidates,
    providerProfile: config.providerProfile,
    compilerOptions: { canvas: { width: 1080, height: 1440 }, candidateCount: 1, requestedFeatures: { mask: null, preserveRegions: [], seed: null } },
    costConfirmation: cost,
    flags: { xhsIntegratedPageSkillExecutionPlan: true }
  });
  const requests = options.promptApproval
    ? pageIds.map((pageId) => ({ status: "materialized_from_skill_plan", request: materializeProviderExecutionRequest({ plan, pageId, expectedPlanHash: plan.planHash, skillInvocation: invocation }) }))
    : plan.pages.map(() => null);
  const preflight = { config, source, runtimeInput, invocation, plan, requests, flagsDefault };
  return { ...preflight, evidence: buildEvidence(preflight, pageIds) };
}

export function configure05NRecoveryOutputDir(target) {
  const tmpRoot = resolve(repoRoot, "apps/flowsocial/.tmp");
  if (!within(target, tmpRoot) || resolve(target) === tmpRoot) throw new Error("05N_RECOVERY_OUTPUT_MUST_BE_TMP_SUBDIRECTORY");
  recoveryOutputDir = resolve(target);
  fullDeckPlanPath = resolve(recoveryOutputDir, "full-deck-offline-plan.json"); fullDeckLiveSummaryPath = resolve(recoveryOutputDir, "full-deck-live-summary.json"); fullDeckOfficialPreflightPath = resolve(recoveryOutputDir, "full-deck-official-preflight.json"); fullDeckPreflightConsumptionLedgerPath = resolve(recoveryOutputDir, "full-deck-preflight-consumption-ledger.json"); p9RecoverySummaryPath = resolve(recoveryOutputDir, "p9-recovery-summary.json");
  return validateRecoveryIsolation();
}

export function validateRecoveryIsolation(target = recoveryOutputDir) {
  const tmpRoot = resolve(repoRoot, "apps/flowsocial/.tmp");
  assert.ok(within(target, tmpRoot) && resolve(target) !== tmpRoot, "05N output escaped isolation");
  const ignoredProbe = relative(repoRoot, resolve(target, "sentinel.json"));
  assert.equal(spawnSync("git", ["check-ignore", "--quiet", "--", ignoredProbe], { cwd: repoRoot }).status, 0, "05N output is not git ignored");
  if (existsSync(target)) { assert.equal(lstatSync(target).isSymbolicLink(), false, "05N output is a symlink"); assert.ok(within(realpathSync(target), realpathSync(tmpRoot)), "05N output escaped isolation"); }
  return true;
}

export function buildSkillDrivenPreflight(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("05m.buildOptions:OBJECT_REQUIRED");
  if (Object.keys(options).some((key) => !ALLOWED_BUILD_FIELDS.includes(key))) throw new Error(`LIVE_HARNESS_INPUT_FIELDS:${Object.keys(options).sort().join(",")}`);
  return buildPreflightFromConfig(loadConfig(), PAGE_IDS, options);
}

export function build05NFullDeckPreflight(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("05n.fullDeckOptions:OBJECT_REQUIRED");
  if (Object.keys(options).some((key) => !ALLOWED_BUILD_FIELDS.includes(key))) throw new Error(`FULL_DECK_HARNESS_INPUT_FIELDS:${Object.keys(options).sort().join(",")}`);
  const config = loadConfig(fullDeckFixturePath, FULL_DECK_PAGE_IDS);
  if (config.budget.previousPaidRequests !== 1 || config.budget.maxNewProviderCalls !== 8 || config.budget.maxNewCredits !== 64 || config.budget.maxTotalCreditsIncludingPrior !== 67 || config.budget.priorConsumedCredits !== 3) throw new Error("05N_FULL_DECK_BUDGET_INVALID");
  validate05NFullDeckSemanticRouting(config);
  return buildPreflightFromConfig(config, FULL_DECK_PAGE_IDS, options);
}

export function validate05NFullDeckSemanticRouting(config) {
  const selected = config?.selectedPages;
  if (!Array.isArray(selected) || selected.length !== FULL_DECK_PAGE_IDS.length) throw new Error("05N_FULL_DECK_SEMANTIC_SELECTION_INVALID");
  for (const pageId of FULL_DECK_PAGE_IDS) {
    const choice = selected.find((item) => item.pageId === pageId);
    if (!choice || choice.runtimePageRole !== FULL_DECK_SEMANTIC_ROLES[pageId] || typeof choice.semanticRationale !== "string" || !choice.semanticRationale.trim()) throw new Error(`05N_SEMANTIC_ROLE_MISMATCH:${pageId}`);
    if (pageId === "P6") {
      if (choice.runtimePageRole !== "method" || choice.stylePackId !== "friendly-handdrawn-tech" || choice.archetypeId !== "process.vertical-steps" || !choice.patternIds.includes("pattern.process.numbered-spine")) throw new Error("05N_P6_METHOD_AUXILIARY_STYLE_REQUIRED");
    } else if (choice.stylePackId) throw new Error(`05N_AUXILIARY_STYLE_FORBIDDEN:${pageId}`);
  }
  return true;
}

function writeEvidence(path, value) {
  assert.ok(within(path, outputDir), "evidence escaped 05M isolation");
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (/Bearer\s+\S+|\btask[_-][a-z0-9_-]+\b|resultUrls|rawResponse/i.test(serialized)) throw new Error("SENSITIVE_EVIDENCE_FORBIDDEN");
  writeFileSync(path, serialized, "utf8");
}

function writeRecoveryEvidence(path, value) {
  assert.ok(within(path, recoveryOutputDir), "evidence escaped 05N isolation");
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (/Bearer\s+\S+|\btask[_-][a-z0-9_-]+\b|resultUrls|rawResponse/i.test(serialized)) throw new Error("SENSITIVE_EVIDENCE_FORBIDDEN");
  writeFileSync(path, serialized, "utf8");
}

export function run05NFullDeckDryRun(options = {}) {
  mkdirSync(recoveryOutputDir, { recursive: true });
  const preflight = build05NFullDeckPreflight(options);
  const evidence = {
    schemaVersion: "1.0", contract: "XhsIntegratedPage05NFullDeckOfflinePlan@1.0", mode: "offline-prepared",
    p1: { reused_existing_provider_asset: true, additionalProviderCalls: 0, requiredPriorNativeSha256: PRIOR_05M.nativeSha256 },
    pages: preflight.evidence.pages.map((page) => ({ pageId: page.pageId, runtimePageRole: page.runtimePageRole, semanticRationale: page.semanticRationale, archetypeRef: page.archetypeRef, stylePackRef: page.stylePackRef, patternRefs: page.patternRefs, requestHash: page.providerPromptHash, antiTemplateConstraintsBound: AUDIENCE_SAFE_ANTI_TEMPLATE_CONSTRAINTS.every((constraint) => page.providerPrompt.includes(constraint)), crossPageDnaBound: ["全套保持纸面编辑设计、酒红/炭黑/暖白色彩", "主标题、正文和行动提示", "方法页", "视觉规范"].every((term) => page.providerPrompt.includes(term)) })),
    pendingProviderOrder: [...FULL_DECK_PENDING_PAGE_IDS],
    budget: { previousPaidRequests: preflight.config.budget.previousPaidRequests, priorConsumedCredits: preflight.config.budget.priorConsumedCredits, maxNewProviderCalls: preflight.config.budget.maxNewProviderCalls, candidatesPerRequest: preflight.config.budget.candidatesPerRequest, automaticRetries: preflight.config.budget.automaticRetries, maxCreditsPerRequest: preflight.config.budget.maxCreditsPerRequest, maxNewCredits: preflight.config.budget.maxNewCredits, maxTotalCreditsIncludingPrior: preflight.config.budget.maxTotalCreditsIncludingPrior },
    gates: { provider: "not_run", normalization: "not_run", ocr: "not_run", fact: "not_run", visual: "not_run", crossPageConsistency: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered" },
    boundaries: { networkCalls: 0, providerCalls: 0, automaticRetries: 0, productionWrites: false, featureFlagDefault: preflight.flagsDefault },
    evidenceHash: stableHash({ planHash: preflight.plan.planHash, promptSetHash: preflight.invocation.promptSetHash, pageHashes: preflight.evidence.pages.map((page) => page.providerPromptHash) })
  };
  writeRecoveryEvidence(fullDeckPlanPath, evidence);
  return { ...preflight, fullDeckPlanPath, fullDeckEvidence: evidence };
}

export function runDryRun(options = {}) {
  validateIsolation();
  mkdirSync(outputDir, { recursive: true });
  validateIsolation();
  const preflight = buildSkillDrivenPreflight(options);
  writeEvidence(promptReviewPath, preflight.evidence);
  return { ...preflight.evidence, promptReviewPath };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.text();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body.code !== undefined && body.code !== 200) || body.success === false) throw new Error(`KIE_HTTP_${response.status}_CODE_${body.code ?? "UNKNOWN"}`);
  return body;
}

function officialFetchFailure(source, error) {
  const cause = error?.cause?.code || error?.cause?.message || error?.message || "UNKNOWN";
  return `OFFICIAL_EVIDENCE_FETCH_FAILED:${source}:${sanitizeEvidence(cause)}`;
}

function exactOfficialEvidenceSources(config) {
  const configured = { documentation: config.officialEvidence.documentationUrl, pricing: config.officialEvidence.pricingUrl, credit: config.officialEvidence.creditSourceUrl };
  if (JSON.stringify(configured) !== JSON.stringify(OFFICIAL_EVIDENCE_URLS)) throw new Error("OFFICIAL_EVIDENCE_URLS_NOT_FIXED");
  return OFFICIAL_EVIDENCE_URLS;
}

export function fetchSystemCurlText(url, { spawnOperation = spawnSync } = {}) {
  if (!Object.values(OFFICIAL_EVIDENCE_URLS).includes(url)) throw new Error("SYSTEM_CURL_URL_NOT_ALLOWLISTED");
  const result = spawnOperation("curl.exe", ["-L", "-sS", "--max-time", "30", "--max-filesize", String(OFFICIAL_EVIDENCE_MAX_BYTES), "--proto", "=https", "--output", "-", "--write-out", "\n%{http_code}", url], { encoding: null, windowsHide: true, maxBuffer: OFFICIAL_EVIDENCE_MAX_BYTES + 32 });
  if (result?.error) throw new Error(`SYSTEM_CURL_UNAVAILABLE:${sanitizeEvidence(result.error.code || result.error.message)}`);
  if (result?.status !== 0) throw new Error(`SYSTEM_CURL_FAILED:EXIT_${result?.status ?? "UNKNOWN"}`);
  const output = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout || "");
  const marker = output.lastIndexOf(Buffer.from("\n"));
  if (marker < 1 || output.length > OFFICIAL_EVIDENCE_MAX_BYTES + 8) throw new Error("SYSTEM_CURL_RESPONSE_INVALID");
  const status = Number(output.subarray(marker + 1).toString("ascii").trim());
  const body = output.subarray(0, marker);
  if (!Number.isInteger(status) || status < 200 || status > 299) throw new Error(`SYSTEM_CURL_HTTP_${Number.isFinite(status) ? status : "INVALID"}`);
  if (body.length < 1 || body.length > OFFICIAL_EVIDENCE_MAX_BYTES) throw new Error("SYSTEM_CURL_RESPONSE_SIZE_INVALID");
  return { text: body.toString("utf8"), bytes: body.length, transport: "system_curl" };
}

export async function verifyOfficialEvidence(config, { transport = "node_fetch", fetchTextOperation = fetchText, spawnOperation = spawnSync } = {}) {
  if (!OFFICIAL_EVIDENCE_TRANSPORTS.includes(transport)) throw new Error("OFFICIAL_EVIDENCE_TRANSPORT_INVALID");
  const sources = Object.entries(exactOfficialEvidenceSources(config));
  const documents = {};
  for (const [source, url] of sources) {
    try {
      documents[source] = transport === "system_curl"
        ? fetchSystemCurlText(url, { spawnOperation })
        : { text: await fetchTextOperation(url), bytes: null, transport: "node_fetch" };
      if (documents[source].transport === "node_fetch") documents[source].bytes = Buffer.byteLength(documents[source].text, "utf8");
      if (!Number.isInteger(documents[source].bytes) || documents[source].bytes < 1 || documents[source].bytes > OFFICIAL_EVIDENCE_MAX_BYTES) throw new Error("OFFICIAL_EVIDENCE_RESPONSE_SIZE_INVALID");
    }
    catch (error) { throw new Error(officialFetchFailure(source, error)); }
  }
  if (!/gpt[- ]?image[- ]?2/i.test(documents.documentation.text) || !documents.pricing.text.includes(String(config.officialEvidence.priceUsdPerImage)) || !documents.credit.text.includes(String(config.officialEvidence.creditUsd))) throw new Error("OFFICIAL_PROFILE_OR_PRICE_UNVERIFIED");
  return { verified: true, provider: "kie.ai", model: config.providerProfile.model, endpoint: config.providerProfile.createEndpoint, projectionKey: config.providerProfile.adapter.projectionKey, estimatedCreditsPerRequest: config.providerProfile.estimatedCostPerCandidate, evidence: Object.fromEntries(sources.map(([source, url]) => [source, { url, contentSha256: sha256Bytes(documents[source].text), bytes: documents[source].bytes, transport }])) };
}

export function loadApiKey() {
  for (const name of ["KIE_API_KEY", "KIEAI_API_KEY", "KIE_AI_API_KEY"]) if (process.env[name]) return process.env[name];
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoRoot, encoding: "utf8" });
  const primaryRoot = common.status === 0 ? resolve(common.stdout.trim(), "..") : repoRoot;
  for (const path of [resolve(repoRoot, ".env.local"), resolve(repoRoot, "apps/flowsocial/.env.local"), resolve(primaryRoot, ".env.local"), resolve(primaryRoot, "apps/flowsocial/.env.local")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(KIE_API_KEY|KIEAI_API_KEY|KIE_AI_API_KEY)\s*=\s*(.*?)\s*$/);
      if (match) return match[2].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("KIE_API_KEY_NOT_CONFIGURED");
}

export const defaultLiveOperations = {
  async verifyOfficialProfile(config, options = {}) {
    return verifyOfficialEvidence(config, options);
  },
  async credits(apiKey) {
    const body = await fetchJson(`${API_ROOT}/api/v1/chat/credit`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!Number.isFinite(body.data)) throw new Error("CREDITS_VALUE_INVALID");
    return body.data;
  },
  async createTask(apiKey, request) {
    const body = await fetchJson(`${API_ROOT}${request.endpoint}`, { method: request.method, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(request.body) });
    const taskId = body?.data?.taskId ?? body?.data?.task_id;
    if (typeof taskId !== "string" || !taskId) throw new Error("TASK_ID_MISSING");
    return taskId;
  },
  async pollTask(apiKey, taskId, { maxPolls = 180, intervalMs = 3000 } = {}) {
    assert.ok(Number.isInteger(maxPolls) && maxPolls > 0 && maxPolls <= 300);
    for (let count = 0; count < maxPolls; count += 1) {
      const body = await fetchJson(`${API_ROOT}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const state = body?.data?.state;
      if (state === "success") return body.data;
      if (state === "fail") throw new Error(`KIE_TASK_FAILED_${body?.data?.failCode || "UNKNOWN"}`);
      if (!["waiting", "queuing", "generating"].includes(state)) throw new Error("KIE_TASK_STATE_UNKNOWN");
      if (count + 1 < maxPolls) await new Promise((done) => setTimeout(done, intervalMs));
    }
    throw new Error("KIE_POLL_LIMIT_REACHED");
  },
  async downloadResult(task) {
    const parsed = typeof task.resultJson === "string" ? JSON.parse(task.resultJson) : task.resultJson;
    if (!Array.isArray(parsed?.resultUrls) || parsed.resultUrls.length !== 1) throw new Error("EXACTLY_ONE_CANDIDATE_REQUIRED");
    const url = new URL(parsed.resultUrls[0]);
    if (url.protocol !== "https:") throw new Error("RESULT_URL_PROTOCOL_INVALID");
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`RESULT_DOWNLOAD_${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  },
  persistArtifact(pageId, bytes) { return normalizeProviderArtifact(pageId, bytes, { persist: true }); }
};

export function normalizeProviderArtifact(pageId, bytes, { persist = false, createdAt = new Date().toISOString() } = {}) {
  if (!PAGE_IDS.includes(pageId) && pageId !== "SELFTEST") throw new Error(`ARTIFACT_PAGE_ID_INVALID:${pageId}`);
  const nativeFilename = `${pageId.toLowerCase()}.native.png`;
  const normalizedFilename = `${pageId.toLowerCase()}.normalized.png`;
  const nativeRelativePath = relative(repoRoot, resolve(outputDir, nativeFilename));
  const normalizedRelativePath = relative(repoRoot, resolve(outputDir, normalizedFilename));
  const nativePath = resolve(outputDir, nativeFilename);
  const normalizedPath = resolve(outputDir, normalizedFilename);
  assert.ok(within(nativePath, outputDir) && within(normalizedPath, outputDir));
  const nativeAsset = { filename: nativeFilename, sha256: sha256Bytes(bytes), bytes: bytes.length, dimensions: null };
  if (persist) writeFileSync(nativePath, bytes);
  try {
    nativeAsset.dimensions = readPngDimensions(bytes);
    const normalized = normalizePngCandidate({
      id: `05m-normalization:${pageId}:${nativeAsset.sha256.slice(0, 16)}`,
      candidateRef: { id: `05m-candidate:${pageId}`, hash: nativeAsset.sha256 },
      sourceBuffer: bytes,
      sourceRelativePath: nativeRelativePath,
      declaredSourceSha256: nativeAsset.sha256,
      outputRelativePath: normalizedRelativePath,
      mode: "resample",
      protectedRegions: [],
      createdAt
    });
    const safe = normalized.record.status === "succeeded"
      && normalized.outputBuffer
      && normalized.record.mode === "resample"
      && normalized.record.scale.uniform === true
      && normalized.record.crop === null
      && normalized.record.pad === null
      && normalized.finalCanvasStatus === "passed"
      && normalized.record.outputAsset?.dimensions.width === 1080
      && normalized.record.outputAsset?.dimensions.height === 1440;
    if (!safe) {
      return { nativeAsset, normalizedAsset: null, providerNativeDimensionStatus: normalized.providerNativeDimensionStatus, normalizationStatus: "blocked", finalCanvasStatus: "blocked", normalizationEvidence: { mode: "resample", recordHash: normalized.record.recordHash, scale: normalized.record.scale, crop: normalized.record.crop, pad: normalized.record.pad }, blocker: `NORMALIZATION_BLOCKED:${normalized.record.blockers.map((item) => item.code).join("|") || "FINAL_CANVAS_INVALID"}` };
    }
    if (persist) writeFileSync(normalizedPath, normalized.outputBuffer);
    return { nativeAsset, normalizedAsset: { filename: normalizedFilename, sha256: normalized.record.outputAsset.sha256, bytes: normalized.record.outputAsset.bytes, dimensions: normalized.record.outputAsset.dimensions }, providerNativeDimensionStatus: normalized.providerNativeDimensionStatus, normalizationStatus: "succeeded", finalCanvasStatus: "passed", normalizationEvidence: { mode: "resample", recordHash: normalized.record.recordHash, scale: normalized.record.scale, crop: null, pad: null }, blocker: null };
  } catch (error) {
    return { nativeAsset, normalizedAsset: null, providerNativeDimensionStatus: "blocked", normalizationStatus: "blocked", finalCanvasStatus: "blocked", normalizationEvidence: { mode: "resample", recordHash: null, scale: null, crop: null, pad: null }, blocker: `NORMALIZATION_FAILED:${sanitizeEvidence(error.message)}` };
  }
}

function assert05MHistory({ runSummary, p1Evaluation, nativeBytes, preflight }) {
  if (runSummary.mode !== "live" || runSummary.planHash !== PRIOR_05M.planHash || runSummary.promptSetHash !== PRIOR_05M.promptSetHash || runSummary.invocationHash !== PRIOR_05M.invocationHash) throw new Error("05M_RUN_SUMMARY_IDENTITY_MISMATCH");
  if (runSummary.actualPaidRequests !== 1 || runSummary.actualCredits !== 3 || runSummary.automaticRetries !== 0 || runSummary.productionWrites !== false || runSummary.records?.length !== 1) throw new Error("05M_RUN_SUMMARY_CALL_HISTORY_MISMATCH");
  if (stableHash(runSummary.records[0]) !== stableHash(p1Evaluation)) throw new Error("05M_P1_EVALUATION_MISMATCH");
  if (p1Evaluation.pageId !== "P1" || p1Evaluation.requestHash !== PRIOR_05M.requestHashes.P1 || p1Evaluation.providerStatus !== "succeeded" || p1Evaluation.nativeAsset?.sha256 !== PRIOR_05M.nativeSha256) throw new Error("05M_P1_EVIDENCE_INVALID");
  if (sha256Bytes(nativeBytes) !== PRIOR_05M.nativeSha256) throw new Error("05M_P1_NATIVE_HASH_MISMATCH");
  const metadata = readPngMetadata(nativeBytes);
  if (metadata.width !== 1086 || metadata.height !== 1448 || metadata.bitDepth !== 8 || metadata.colorType !== 2 || metadata.interlace !== 0) throw new Error("05M_P1_NATIVE_FORMAT_MISMATCH");
  if (preflight.invocation.invocationHash !== PRIOR_05M.invocationHash || preflight.invocation.promptSetHash !== PRIOR_05M.promptSetHash) throw new Error("05M_SKILL_IDENTITY_MISMATCH");
  for (let index = 0; index < PAGE_IDS.length; index += 1) if (stableHash(preflight.requests[index].request) !== PRIOR_05M.requestHashes[PAGE_IDS[index]]) throw new Error(`05M_REQUEST_HASH_MISMATCH:${PAGE_IDS[index]}`);
  return metadata;
}

export function verify05MRecoveryEvidence(input) { return assert05MHistory(input); }

export function prepare05MRecovery({ sourceDir = prior05MOutputDir, targetDir = recoveryOutputDir, persist = true, createdAt = new Date().toISOString() } = {}) {
  if (resolve(sourceDir) !== resolve(prior05MOutputDir)) throw new Error("05M_SOURCE_DIR_MUST_BE_FROZEN");
  if (resolve(targetDir) !== resolve(recoveryOutputDir)) throw new Error("05N_OUTPUT_DIR_MUST_BE_ISOLATED");
  const runSummary = readJson(resolve(sourceDir, "run-summary.json"));
  const p1Evaluation = readJson(resolve(sourceDir, "p1.evaluation.json"));
  const nativeBytes = readFileSync(resolve(sourceDir, "p1.native.png"));
  const approval = readJson(resolve(sourceDir, "controller-approval.json"));
  const preflight = buildSkillDrivenPreflight({ promptApproval: approval, now: approval.reviewedAt });
  const metadata = assert05MHistory({ runSummary, p1Evaluation, nativeBytes, preflight });
  const normalized = normalizePngCandidate({
    id: `05n-normalization:P1:${PRIOR_05M.nativeSha256.slice(0, 16)}`, candidateRef: { id: "05m-candidate:P1", hash: PRIOR_05M.nativeSha256 },
    sourceBuffer: nativeBytes, sourceRelativePath: relative(repoRoot, resolve(sourceDir, "p1.native.png")), declaredSourceSha256: PRIOR_05M.nativeSha256,
    outputRelativePath: relative(repoRoot, resolve(targetDir, "p1.normalized.png")), mode: "resample", protectedRegions: [], createdAt
  });
  if (normalized.record.status !== "succeeded" || normalized.finalCanvasStatus !== "passed" || normalized.record.crop !== null || normalized.record.pad !== null || normalized.record.scale.uniform !== true) throw new Error("05N_P1_NORMALIZATION_BLOCKED");
  const evidence = {
    schemaVersion: "1.0", contract: "XhsIntegratedPage05MRecovery@1.0", mode: "offline-prepared", priorRun: { planHash: runSummary.planHash, invocationHash: runSummary.invocationHash, promptSetHash: runSummary.promptSetHash },
    p1: { reused_existing_provider_asset: true, additionalProviderCalls: 0, nativeAsset: { path: resolve(sourceDir, "p1.native.png"), sha256: PRIOR_05M.nativeSha256, bytes: nativeBytes.length, dimensions: { width: metadata.width, height: metadata.height }, bitDepth: metadata.bitDepth, colorType: metadata.colorType }, normalizedAsset: { path: resolve(targetDir, "p1.normalized.png"), ...normalized.record.outputAsset }, normalization: { mode: "resample", scale: normalized.record.scale, crop: null, pad: null, pixelSemantics: "RGB values preserved by decode; opaque alpha=255 added; nearest-neighbor uniform resample" } },
    pendingPages: RECOVERY_PAGE_IDS.map((pageId) => ({ pageId, requestHash: PRIOR_05M.requestHashes[pageId] })),
    budget: { maxNewProviderCalls: 2, maxCreditsPerCall: 8, maxNewCredits: 16, automaticRetries: 0 },
    counters: { networkCalls: 0, providerCalls: 0, additionalProviderCalls: 0, credits: 0, productionWrites: 0 },
    gates: { ocr: "not_run", fact: "not_run", visual: "not_run", crossPageConsistency: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered" }
  };
  if (persist) {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(resolve(targetDir, "p1.normalized.png"), normalized.outputBuffer);
    writeRecoveryEvidence(resolve(targetDir, "offline-replay.json"), evidence);
  }
  return { preflight, evidence, normalizedBuffer: normalized.outputBuffer };
}

function normalizeRecoveryArtifact(pageId, bytes, createdAt = new Date().toISOString()) {
  if (!RECOVERY_PAGE_IDS.includes(pageId)) throw new Error(`RECOVERY_PAGE_ID_INVALID:${pageId}`);
  const nativePath = resolve(recoveryOutputDir, `${pageId.toLowerCase()}.native.png`); const normalizedPath = resolve(recoveryOutputDir, `${pageId.toLowerCase()}.normalized.png`);
  assert.ok(within(nativePath, recoveryOutputDir) && within(normalizedPath, recoveryOutputDir)); mkdirSync(recoveryOutputDir, { recursive: true }); writeFileSync(nativePath, bytes);
  const nativeAsset = { filename: basename(nativePath), sha256: sha256Bytes(bytes), bytes: bytes.length, dimensions: readPngDimensions(bytes) };
  const normalized = normalizePngCandidate({ id: `05n-normalization:${pageId}:${nativeAsset.sha256.slice(0, 16)}`, candidateRef: { id: `05n-candidate:${pageId}`, hash: nativeAsset.sha256 }, sourceBuffer: bytes, sourceRelativePath: relative(repoRoot, nativePath), declaredSourceSha256: nativeAsset.sha256, outputRelativePath: relative(repoRoot, normalizedPath), mode: "resample", protectedRegions: [], createdAt });
  if (normalized.record.status !== "succeeded" || normalized.finalCanvasStatus !== "passed") return { nativeAsset, normalizedAsset: null, normalizationStatus: "blocked", finalCanvasStatus: "blocked", blocker: `NORMALIZATION_BLOCKED:${normalized.record.blockers.map((item) => item.code).join("|") || "FINAL_CANVAS_INVALID"}` };
  writeFileSync(normalizedPath, normalized.outputBuffer);
  return { nativeAsset, normalizedAsset: { filename: basename(normalizedPath), sha256: normalized.record.outputAsset.sha256, bytes: normalized.record.outputAsset.bytes, dimensions: normalized.record.outputAsset.dimensions }, normalizationStatus: "succeeded", finalCanvasStatus: "passed", blocker: null };
}

function normalizeFullDeckArtifact(pageId, bytes, createdAt = new Date().toISOString()) {
  if (!FULL_DECK_PENDING_PAGE_IDS.includes(pageId)) throw new Error(`FULL_DECK_ARTIFACT_PAGE_ID_INVALID:${pageId}`);
  const nativePath = resolve(recoveryOutputDir, `${pageId.toLowerCase()}.native.png`); const normalizedPath = resolve(recoveryOutputDir, `${pageId.toLowerCase()}.normalized.png`);
  assert.ok(within(nativePath, recoveryOutputDir) && within(normalizedPath, recoveryOutputDir)); mkdirSync(recoveryOutputDir, { recursive: true }); writeFileSync(nativePath, bytes);
  const nativeAsset = { filename: basename(nativePath), sha256: sha256Bytes(bytes), bytes: bytes.length, dimensions: readPngDimensions(bytes) };
  const normalized = normalizePngCandidate({ id: `05n-full-deck-normalization:${pageId}:${nativeAsset.sha256.slice(0, 16)}`, candidateRef: { id: `05n-full-deck-candidate:${pageId}`, hash: nativeAsset.sha256 }, sourceBuffer: bytes, sourceRelativePath: relative(repoRoot, nativePath), declaredSourceSha256: nativeAsset.sha256, outputRelativePath: relative(repoRoot, normalizedPath), mode: "resample", protectedRegions: [], createdAt });
  if (normalized.record.status !== "succeeded" || normalized.finalCanvasStatus !== "passed") return { nativeAsset, normalizedAsset: null, providerNativeDimensionStatus: normalized.providerNativeDimensionStatus, normalizationStatus: "blocked", finalCanvasStatus: "blocked", blocker: `NORMALIZATION_BLOCKED:${normalized.record.blockers.map((item) => item.code).join("|") || "FINAL_CANVAS_INVALID"}` };
  writeFileSync(normalizedPath, normalized.outputBuffer);
  return { nativeAsset, normalizedAsset: { filename: basename(normalizedPath), sha256: normalized.record.outputAsset.sha256, bytes: normalized.record.outputAsset.bytes, dimensions: normalized.record.outputAsset.dimensions }, providerNativeDimensionStatus: normalized.providerNativeDimensionStatus, normalizationStatus: "succeeded", finalCanvasStatus: "passed", blocker: null };
}

function taskCheckpointPath(pageId) {
  if (!FULL_DECK_PENDING_PAGE_IDS.includes(pageId)) throw new Error(`FULL_DECK_CHECKPOINT_PAGE_INVALID:${pageId}`);
  return resolve(recoveryOutputDir, `${pageId.toLowerCase()}.task-checkpoint.private.json`);
}

function writeTaskCheckpoint({ pageId, taskId, preflight, requestHash, createdAt = new Date().toISOString() }) {
  if (typeof taskId !== "string" || !taskId) throw new Error("FULL_DECK_CHECKPOINT_TASK_ID_REQUIRED");
  const path = taskCheckpointPath(pageId);
  assert.ok(within(path, recoveryOutputDir));
  const value = { schemaVersion: "1.0", contract: "XhsIntegratedPage05NTaskCheckpoint@1.0", pageId, taskId, planHash: preflight.plan.planHash, invocationHash: preflight.invocation.invocationHash, promptSetHash: preflight.invocation.promptSetHash, requestHash, createdAt, state: "created" };
  writeFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  return value;
}

function readTaskCheckpoint(pageId, preflight, requestHash) {
  const path = taskCheckpointPath(pageId);
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) return null;
  const value = readJson(path);
  if (value?.schemaVersion !== "1.0" || value.contract !== "XhsIntegratedPage05NTaskCheckpoint@1.0" || value.pageId !== pageId || typeof value.taskId !== "string" || !value.taskId || value.planHash !== preflight.plan.planHash || value.invocationHash !== preflight.invocation.invocationHash || value.promptSetHash !== preflight.invocation.promptSetHash || value.requestHash !== requestHash) throw new Error("FULL_DECK_CHECKPOINT_BINDING_INVALID");
  return value;
}

export async function execute05MRecovery({ recovery, apiKey = "offline-test-key", operations = {} }) {
  if (recovery.evidence.p1.reused_existing_provider_asset !== true || recovery.evidence.p1.additionalProviderCalls !== 0 || recovery.evidence.p1.nativeAsset.sha256 !== PRIOR_05M.nativeSha256) throw new Error("05N_P1_REUSE_EVIDENCE_REQUIRED");
  const io = { ...defaultLiveOperations, persistArtifact: normalizeRecoveryArtifact, ...operations }; const records = []; let actualPaidRequests = 0; let actualCredits = 0; let stoppedBy = null;
  try {
    const official = await io.verifyOfficialProfile(recovery.preflight.config);
    if (!official?.verified || official.model !== recovery.preflight.config.providerProfile.model || official.projectionKey !== "image2.text-to-image.v1" || official.estimatedCreditsPerRequest > 8) throw new Error("OFFICIAL_PREFLIGHT_MISMATCH");
  } catch (error) { return { actualPaidRequests, actualCredits, records, stoppedBy: `OFFICIAL_PREFLIGHT_FAILED:${sanitizeEvidence(error.message)}`, automaticRetries: 0, productionWrites: false }; }
  for (const pageId of RECOVERY_PAGE_IDS) {
    const index = PAGE_IDS.indexOf(pageId); const request = recovery.preflight.requests[index].request;
    if (stableHash(request) !== PRIOR_05M.requestHashes[pageId]) throw new Error(`05M_REQUEST_HASH_MISMATCH:${pageId}`);
    if (actualPaidRequests >= 2 || actualCredits + recovery.preflight.config.providerProfile.estimatedCostPerCandidate > 16) { stoppedBy = "RECOVERY_BUDGET_STOP_LINE"; break; }
    let before;
    try { before = await io.credits(apiKey); if (!Number.isFinite(before) || before < 8) throw new Error("INSUFFICIENT_OR_UNKNOWN_CREDITS"); }
    catch (error) { stoppedBy = `PRE_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`; break; }
    const record = { pageId, requestHash: stableHash(request), providerStatus: "pending", normalizationStatus: "not_run", finalCanvasStatus: "pending", costStatus: "pending", actualCredits: null, blocker: null };
    try {
      actualPaidRequests += 1; const taskId = await io.createTask(apiKey, request); const task = await io.pollTask(apiKey, taskId, { maxPolls: 180, intervalMs: 3000 }); const bytes = await io.downloadResult(task); record.providerStatus = "succeeded";
      const artifact = await io.persistArtifact(pageId, bytes); record.nativeAsset = artifact.nativeAsset; record.normalizedAsset = artifact.normalizedAsset; record.normalizationStatus = artifact.normalizationStatus; record.finalCanvasStatus = artifact.finalCanvasStatus; if (artifact.blocker) record.blocker = artifact.blocker;
    } catch (error) { record.providerStatus = record.providerStatus === "succeeded" ? "succeeded" : "failed"; record.normalizationStatus = "blocked"; record.finalCanvasStatus = "blocked"; record.blocker = `RECOVERY_STOP:${sanitizeEvidence(error.message)}`; }
    try { const after = await io.credits(apiKey); const delta = Math.max(0, before - after); record.actualCredits = delta; actualCredits += delta; if (delta > 8 || actualCredits > 16) record.blocker = [record.blocker, delta > 8 ? "ACTUAL_CREDITS_PER_REQUEST_EXCEEDED" : "ACTUAL_TOTAL_CREDITS_EXCEEDED"].filter(Boolean).join("|"); else record.costStatus = "measured"; }
    catch (error) { record.blocker = [record.blocker, `POST_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`].filter(Boolean).join("|"); }
    records.push(record); if (record.blocker) { stoppedBy = record.blocker; break; }
  }
  return { actualPaidRequests, actualCredits, records, stoppedBy, automaticRetries: 0, productionWrites: false, p1AdditionalProviderCalls: 0 };
}

// P1 remains a byte-bound historical asset; it is never a createTask candidate.
export async function execute05NFullDeckPlan({ preflight, recovery, apiKey = "offline-test-key", operations = {} }) {
  if (!preflight || preflight.plan?.execution?.status !== "ready_for_isolated_provider_execution" || preflight.plan.productionEligible !== false) throw new Error("05N_APPROVED_FULL_DECK_PLAN_REQUIRED");
  const budget = preflight.config?.budget;
  if (!budget || budget.previousPaidRequests !== 1 || budget.priorConsumedCredits !== 3 || budget.maxNewProviderCalls !== 8 || budget.maxNewCredits !== 64 || budget.maxTotalCreditsIncludingPrior !== 67 || budget.automaticRetries !== 0 || budget.candidatesPerRequest !== 1) throw new Error("05N_FULL_DECK_BUDGET_INVALID");
  if (preflight.requests.length !== FULL_DECK_PAGE_IDS.length) throw new Error("05N_FULL_DECK_REQUEST_COUNT_INVALID");
  if (recovery?.evidence?.p1?.reused_existing_provider_asset !== true || recovery.evidence.p1.additionalProviderCalls !== 0 || recovery.evidence.p1.nativeAsset?.sha256 !== PRIOR_05M.nativeSha256 || recovery.evidence.p1.normalizedAsset?.dimensions?.width !== 1080 || recovery.evidence.p1.normalizedAsset?.dimensions?.height !== 1440) throw new Error("05N_FULL_DECK_P1_REUSE_EVIDENCE_REQUIRED");
  const p1Request = preflight.requests[0];
  if (p1Request.status !== "materialized_from_skill_plan") throw new Error("05N_FULL_DECK_P1_PLAN_BINDING_REQUIRED");
  const requests = new Map(preflight.requests.map((item, index) => [FULL_DECK_PAGE_IDS[index], item]));
  for (const pageId of FULL_DECK_PENDING_PAGE_IDS) {
    const item = requests.get(pageId);
    if (!item || item.status !== "materialized_from_skill_plan") throw new Error(`05N_FULL_DECK_REQUEST_MISSING:${pageId}`);
    const expected = materializeProviderExecutionRequest({ plan: preflight.plan, pageId, expectedPlanHash: preflight.plan.planHash, skillInvocation: preflight.invocation });
    if (stableHash(item.request) !== stableHash(expected)) throw new Error(`05N_INDEPENDENT_PROVIDER_REQUEST_FORBIDDEN:${pageId}`);
  }
  const io = { ...operations };
  if (typeof io.verifyOfficialProfile !== "function" || typeof io.credits !== "function" || typeof io.createTask !== "function" || typeof io.pollTask !== "function" || typeof io.downloadResult !== "function" || typeof io.persistArtifact !== "function") throw new Error("05N_FULL_DECK_OPERATIONS_REQUIRED");
  const records = [{ pageId: "P1", reused_existing_provider_asset: true, additionalProviderCalls: 0, priorNativeSha256: PRIOR_05M.nativeSha256, providerStatus: "succeeded", providerNativeDimensionStatus: "failed", normalizationStatus: "succeeded", finalCanvasStatus: "passed", costStatus: "historical", actualCredits: 3, ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered", blocker: null }];
  let actualNewProviderCalls = 0; let actualNewCredits = 0; let stoppedBy = null;
  try {
    const official = await io.verifyOfficialProfile(preflight.config);
    if (!official?.verified || official.model !== preflight.config.providerProfile.model || official.projectionKey !== "image2.text-to-image.v1" || official.estimatedCreditsPerRequest > budget.maxCreditsPerRequest) throw new Error("OFFICIAL_PREFLIGHT_MISMATCH");
  } catch (error) {
    return { records, actualNewProviderCalls, actualNewCredits, totalCreditsIncludingPrior: budget.priorConsumedCredits, automaticRetries: 0, productionWrites: false, stoppedBy: `OFFICIAL_PREFLIGHT_FAILED:${sanitizeEvidence(error.message)}` };
  }
  for (const pageId of FULL_DECK_PENDING_PAGE_IDS) {
    if (actualNewProviderCalls >= budget.maxNewProviderCalls || actualNewCredits + preflight.config.providerProfile.estimatedCostPerCandidate > budget.maxNewCredits || budget.priorConsumedCredits + actualNewCredits + preflight.config.providerProfile.estimatedCostPerCandidate > budget.maxTotalCreditsIncludingPrior) { stoppedBy = "05N_FULL_DECK_BUDGET_STOP_LINE"; break; }
    let before;
    try {
      before = await io.credits(apiKey);
      if (!Number.isFinite(before) || before < budget.maxCreditsPerRequest) throw new Error("INSUFFICIENT_OR_UNKNOWN_CREDITS");
    } catch (error) { stoppedBy = `PRE_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`; break; }
    const record = { pageId, additionalProviderCalls: 1, requestHash: stableHash(requests.get(pageId).request), providerStatus: "pending", providerNativeDimensionStatus: "pending", normalizationStatus: "not_run", finalCanvasStatus: "pending", costStatus: "pending", actualCredits: null, ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered", blocker: null };
    try {
      actualNewProviderCalls += 1;
      const requestHash = stableHash(requests.get(pageId).request);
      const taskId = await io.createTask(apiKey, requests.get(pageId).request);
      writeTaskCheckpoint({ pageId, taskId, preflight, requestHash });
      const task = await io.pollTask(apiKey, taskId, { maxPolls: 180, intervalMs: 3000 });
      const artifact = await io.persistArtifact(pageId, await io.downloadResult(task));
      record.providerStatus = "succeeded"; record.providerNativeDimensionStatus = artifact.providerNativeDimensionStatus; record.normalizationStatus = artifact.normalizationStatus; record.finalCanvasStatus = artifact.finalCanvasStatus;
      if (artifact.blocker || artifact.normalizationStatus !== "succeeded" || artifact.finalCanvasStatus !== "passed") record.blocker = artifact.blocker || "NORMALIZATION_BLOCKED";
    } catch (error) { record.providerStatus = "failed"; record.providerNativeDimensionStatus = "blocked"; record.normalizationStatus = "blocked"; record.finalCanvasStatus = "blocked"; record.blocker = `FULL_DECK_STOP:${sanitizeEvidence(error.message)}`; }
    try {
      const after = await io.credits(apiKey); const delta = Math.max(0, before - after); record.actualCredits = delta; actualNewCredits += delta;
      if (delta > budget.maxCreditsPerRequest) record.blocker = [record.blocker, "ACTUAL_CREDITS_PER_REQUEST_EXCEEDED"].filter(Boolean).join("|");
      else if (actualNewCredits > budget.maxNewCredits || budget.priorConsumedCredits + actualNewCredits > budget.maxTotalCreditsIncludingPrior) record.blocker = [record.blocker, "ACTUAL_TOTAL_CREDITS_EXCEEDED"].filter(Boolean).join("|");
      else record.costStatus = "measured";
    } catch (error) { record.blocker = [record.blocker, `POST_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`].filter(Boolean).join("|"); }
    records.push(record); if (record.blocker) { stoppedBy = record.blocker; break; }
  }
  return { records, actualNewProviderCalls, actualNewCredits, totalCreditsIncludingPrior: budget.priorConsumedCredits + actualNewCredits, automaticRetries: 0, productionWrites: false, stoppedBy };
}

export async function run05MRecoveryLive({ operations = {}, apiKey = null } = {}) {
  const recovery = prepare05MRecovery();
  const execution = await execute05MRecovery({ recovery, apiKey: apiKey || loadApiKey(), operations });
  const summary = { schemaVersion: "1.0", mode: "05m-two-page-recovery-live", provider: "kie.ai", model: "gpt-image-2-text-to-image", priorPlanHash: PRIOR_05M.planHash, invocationHash: PRIOR_05M.invocationHash, promptSetHash: PRIOR_05M.promptSetHash, approvedNewPaidRequests: 2, p1: recovery.evidence.p1, ...execution };
  writeRecoveryEvidence(resolve(recoveryOutputDir, "recovery-run-summary.json"), summary);
  for (const record of execution.records) writeRecoveryEvidence(resolve(recoveryOutputDir, `${record.pageId.toLowerCase()}.evaluation.json`), record);
  return summary;
}

export async function executeApprovedPreflight({ preflight, apiKey = "offline-test-key", operations = {} }) {
  exact({ preflight, apiKey, operations }, ["preflight", "apiKey", "operations"], "05m.executeApprovedPreflight");
  if (preflight.plan.execution.status !== "ready_for_isolated_provider_execution" || preflight.plan.productionEligible !== false || preflight.requests.some((item) => item.status !== "materialized_from_skill_plan")) throw new Error("APPROVED_SKILL_PLAN_REQUIRED");
  for (let index = 0; index < PAGE_IDS.length; index += 1) {
    const expected = materializeProviderExecutionRequest({ plan: preflight.plan, pageId: PAGE_IDS[index], expectedPlanHash: preflight.plan.planHash, skillInvocation: preflight.invocation });
    if (stableHash(preflight.requests[index].request) !== stableHash(expected)) throw new Error(`INDEPENDENT_PROVIDER_REQUEST_FORBIDDEN:${PAGE_IDS[index]}`);
  }
  const io = { ...defaultLiveOperations, ...operations };
  const records = [];
  let actualPaidRequests = 0;
  let actualCredits = 0;
  let stoppedBy = null;
  try {
    const official = await io.verifyOfficialProfile(preflight.config);
    if (!official?.verified || official.model !== preflight.config.providerProfile.model || official.projectionKey !== "image2.text-to-image.v1" || official.estimatedCreditsPerRequest > preflight.config.budget.maxCreditsPerRequest) throw new Error("OFFICIAL_PREFLIGHT_MISMATCH");
  } catch (error) {
    return { actualPaidRequests, actualCredits, records, stoppedBy: `OFFICIAL_PREFLIGHT_FAILED:${sanitizeEvidence(error.message)}`, automaticRetries: 0, productionWrites: false };
  }
  for (let index = 0; index < preflight.requests.length; index += 1) {
    const pageId = PAGE_IDS[index];
    if (actualPaidRequests >= preflight.config.budget.approvedPaidRequests || actualCredits + preflight.config.providerProfile.estimatedCostPerCandidate > preflight.config.budget.maxTotalCredits) {
      stoppedBy = "BUDGET_STOP_LINE";
      break;
    }
    let before;
    try {
      before = await io.credits(apiKey);
      if (!Number.isFinite(before) || before < preflight.config.budget.maxCreditsPerRequest) throw new Error("INSUFFICIENT_OR_UNKNOWN_CREDITS");
    } catch (error) {
      stoppedBy = `PRE_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`;
      break;
    }
    const record = { pageId, requestHash: stableHash(preflight.requests[index].request), providerStatus: "pending", providerNativeDimensionStatus: "pending", normalizationStatus: "not_run", finalCanvasStatus: "pending", costStatus: "pending", actualCredits: null, nativeAsset: null, normalizedAsset: null, normalizationEvidence: null, ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered", productionEligible: false, blocker: null };
    let nativeBytes;
    try {
      actualPaidRequests += 1;
      const taskId = await io.createTask(apiKey, preflight.requests[index].request);
      const task = await io.pollTask(apiKey, taskId, { maxPolls: 180, intervalMs: 3000 });
      nativeBytes = await io.downloadResult(task);
      record.providerStatus = "succeeded";
    } catch (error) {
      record.providerStatus = "failed";
      record.providerNativeDimensionStatus = "blocked";
      record.normalizationStatus = "blocked";
      record.finalCanvasStatus = "blocked";
      record.costStatus = "blocked";
      record.blocker = `PROVIDER_STOP:${sanitizeEvidence(error.message)}`;
      records.push(record);
      stoppedBy = record.blocker;
      break;
    }
    try {
      const artifact = await io.persistArtifact(pageId, nativeBytes);
      record.nativeAsset = artifact.nativeAsset;
      record.normalizedAsset = artifact.normalizedAsset;
      record.providerNativeDimensionStatus = artifact.providerNativeDimensionStatus;
      record.normalizationStatus = artifact.normalizationStatus;
      record.finalCanvasStatus = artifact.finalCanvasStatus;
      record.normalizationEvidence = artifact.normalizationEvidence;
      if (artifact.blocker) record.blocker = artifact.blocker;
    } catch (error) {
      record.providerNativeDimensionStatus = "blocked";
      record.normalizationStatus = "blocked";
      record.finalCanvasStatus = "blocked";
      record.blocker = `NORMALIZATION_FAILED:${sanitizeEvidence(error.message)}`;
    }
    try {
      const after = await io.credits(apiKey);
      const delta = Math.max(0, before - after);
      record.actualCredits = delta;
      actualCredits += delta;
      if (delta > preflight.config.budget.maxCreditsPerRequest) {
        record.costStatus = "blocked";
        record.blocker = [record.blocker, "ACTUAL_CREDITS_PER_REQUEST_EXCEEDED"].filter(Boolean).join("|");
      } else if (actualCredits > preflight.config.budget.maxTotalCredits) {
        record.costStatus = "blocked";
        record.blocker = [record.blocker, "ACTUAL_TOTAL_CREDITS_EXCEEDED"].filter(Boolean).join("|");
      } else record.costStatus = "measured";
    } catch (error) {
      record.costStatus = "blocked";
      record.blocker = [record.blocker, `POST_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`].filter(Boolean).join("|");
    }
    records.push(record);
    if (record.blocker) {
      stoppedBy = record.blocker;
      break;
    }
  }
  return { actualPaidRequests, actualCredits, records, stoppedBy, automaticRetries: 0, productionWrites: false };
}

function readApprovalFile(filename) {
  if (!filename || basename(filename) !== filename) throw new Error("APPROVAL_FILE_NAME_REQUIRED");
  const path = resolve(outputDir, filename);
  if (!within(path, outputDir)) throw new Error("APPROVAL_FILE_ESCAPED_ISOLATION");
  return readJson(path);
}

function readFullDeckApprovalFile(filename) {
  if (!filename || basename(filename) !== filename || !filename.endsWith(".json")) throw new Error("FULL_DECK_APPROVAL_FILE_NAME_REQUIRED");
  const path = resolve(recoveryOutputDir, filename);
  if (!within(path, recoveryOutputDir) || !existsSync(path) || lstatSync(path).isSymbolicLink()) throw new Error("FULL_DECK_APPROVAL_FILE_INVALID");
  return readJson(path);
}

function fullDeckSafeRecord(record) {
  return {
    pageId: record.pageId,
    reusedExistingProviderAsset: record.reused_existing_provider_asset === true,
    additionalProviderCalls: record.additionalProviderCalls ?? (record.pageId === "P1" ? 0 : 1),
    provider: record.providerStatus,
    providerNativeDimensions: record.providerNativeDimensionStatus ?? "not_run",
    normalization: record.normalizationStatus,
    finalCanvas: record.finalCanvasStatus,
    cost: record.costStatus ?? "not_run",
    actualCredits: record.actualCredits,
    ocr: record.ocr,
    fact: record.fact,
    visual: record.visual,
    manualAesthetic: record.manualAesthetic,
    userSelection: record.userSelection,
    delivery: record.delivery,
    blocker: record.blocker ? sanitizeEvidence(record.blocker) : null
  };
}

function readP9RecoveryApprovalFile(filename) {
  if (!filename || basename(filename) !== filename || !filename.endsWith(".json")) throw new Error("P9_RECOVERY_APPROVAL_FILE_NAME_REQUIRED");
  const path = resolve(recoveryOutputDir, filename);
  if (!within(path, recoveryOutputDir) || !existsSync(path) || lstatSync(path).isSymbolicLink()) throw new Error("P9_RECOVERY_APPROVAL_FILE_INVALID");
  return { path, value: readJson(path) };
}

function validateP9RecoveryApproval({ approvalFile, recoveryApproval, preflight }) {
  const value = recoveryApproval.value;
  const keys = ["schemaVersion", "contract", "decision", "pageId", "promptSetHash", "invocationHash", "approvalHash", "allowCreateTask", "maxNewProviderCalls", "maxNewCredits", "automaticRetries", "reviewedBy", "reviewedAt", "consumedAt", "consumerRunNonce"];
  exact(value, keys, "05n.p9RecoveryApproval");
  if (value.schemaVersion !== "1.0" || value.contract !== "XhsIntegratedPage05NP9RecoveryApproval@1.0" || value.decision !== "approved" || value.pageId !== "P9" || !String(value.reviewedBy).startsWith("controller-") || value.promptSetHash !== preflight.invocation.promptSetHash || value.invocationHash !== preflight.invocation.invocationHash || value.approvalHash !== stableHash(approvalFile) || value.automaticRetries !== 0 || value.consumedAt !== null || value.consumerRunNonce !== null) throw new Error("P9_RECOVERY_APPROVAL_INVALID");
  if (value.allowCreateTask === true && (value.maxNewProviderCalls !== 1 || value.maxNewCredits !== 8)) throw new Error("P9_RECOVERY_CREATE_BUDGET_INVALID");
  if (value.allowCreateTask === false && (value.maxNewProviderCalls !== 0 || value.maxNewCredits !== 0)) throw new Error("P9_RECOVERY_POLL_BUDGET_INVALID");
  return value;
}

function consumeP9RecoveryApproval(recoveryApproval, value, consumedAt = new Date().toISOString()) {
  const nonce = sha256Bytes(`${value.approvalHash}:${consumedAt}:${process.pid}`).slice(0, 32);
  const current = readJson(recoveryApproval.path);
  if (current.consumedAt !== null || current.consumerRunNonce !== null || current.approvalHash !== value.approvalHash) throw new Error("P9_RECOVERY_APPROVAL_ALREADY_CONSUMED");
  const consumed = { ...current, consumedAt, consumerRunNonce: nonce };
  writeRecoveryEvidence(recoveryApproval.path, consumed);
  return consumed;
}

function assertNoP9PlaceholderArtifact() {
  const nativePath = resolve(recoveryOutputDir, "p9.native.png");
  if (existsSync(nativePath) && readFileSync(nativePath).length <= 100) throw new Error("P9_PLACEHOLDER_ARTIFACT_REJECTED");
}

export async function run05NP9RecoveryLive({ approvalFile, recoveryApprovalFile, operations = {}, apiKey = null } = {}) {
  validateRecoveryIsolation(); mkdirSync(recoveryOutputDir, { recursive: true });
  const approval = readFullDeckApprovalFile(approvalFile);
  const preflight = build05NFullDeckPreflight({ promptApproval: approval, now: approval.reviewedAt });
  const request = preflight.requests.find((item, index) => FULL_DECK_PAGE_IDS[index] === "P9")?.request;
  if (!request) throw new Error("P9_RECOVERY_REQUEST_MISSING");
  const requestHash = stableHash(request);
  const recoveryApproval = readP9RecoveryApprovalFile(recoveryApprovalFile);
  const gate = validateP9RecoveryApproval({ approvalFile: approval, recoveryApproval, preflight });
  assertNoP9PlaceholderArtifact();
  const checkpoint = readTaskCheckpoint("P9", preflight, requestHash);
  if (!checkpoint && !gate.allowCreateTask) throw new Error("P9_RECOVERY_CHECKPOINT_REQUIRED");
  const io = { ...defaultLiveOperations, persistArtifact: normalizeFullDeckArtifact, ...operations };
  if (typeof io.pollTask !== "function" || typeof io.downloadResult !== "function" || typeof io.persistArtifact !== "function" || (!checkpoint && (typeof io.credits !== "function" || typeof io.createTask !== "function"))) throw new Error("P9_RECOVERY_OPERATIONS_REQUIRED");
  const resolvedApiKey = apiKey || loadApiKey();
  const consumed = consumeP9RecoveryApproval(recoveryApproval, gate);
  const record = { pageId: "P9", resumedFromCheckpoint: Boolean(checkpoint), additionalProviderCalls: 0, providerStatus: "pending", providerNativeDimensionStatus: "pending", normalizationStatus: "not_run", finalCanvasStatus: "pending", costStatus: checkpoint ? "not_applicable" : "pending", actualCredits: 0, ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered", blocker: null };
  let before = null; let taskId = checkpoint?.taskId;
  try {
    if (!taskId) {
      before = await io.credits(resolvedApiKey); if (!Number.isFinite(before) || before < 8) throw new Error("INSUFFICIENT_OR_UNKNOWN_CREDITS");
      taskId = await io.createTask(resolvedApiKey, request); record.additionalProviderCalls = 1;
      writeTaskCheckpoint({ pageId: "P9", taskId, preflight, requestHash });
    }
    const task = await io.pollTask(resolvedApiKey, taskId, { maxPolls: 180, intervalMs: 3000 });
    const artifact = await io.persistArtifact("P9", await io.downloadResult(task));
    record.providerStatus = "succeeded"; record.providerNativeDimensionStatus = artifact.providerNativeDimensionStatus; record.normalizationStatus = artifact.normalizationStatus; record.finalCanvasStatus = artifact.finalCanvasStatus;
    if (artifact.blocker || artifact.normalizationStatus !== "succeeded" || artifact.finalCanvasStatus !== "passed") record.blocker = artifact.blocker || "NORMALIZATION_BLOCKED";
  } catch (error) { record.providerStatus = "failed"; record.providerNativeDimensionStatus = "blocked"; record.normalizationStatus = "blocked"; record.finalCanvasStatus = "blocked"; record.blocker = `P9_RECOVERY_STOP:${sanitizeEvidence(error.message)}`; }
  if (before !== null) {
    try { const after = await io.credits(resolvedApiKey); record.actualCredits = Math.max(0, before - after); if (record.actualCredits > 8) record.blocker = [record.blocker, "ACTUAL_CREDITS_PER_REQUEST_EXCEEDED"].filter(Boolean).join("|"); else record.costStatus = "measured"; }
    catch (error) { record.blocker = [record.blocker, `POST_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`].filter(Boolean).join("|"); }
  }
  const summary = { schemaVersion: "1.0", contract: "XhsIntegratedPage05NP9RecoverySummary@1.0", mode: "isolated-p9-recovery-live", pageId: "P9", planHash: preflight.plan.planHash, invocationHash: preflight.invocation.invocationHash, promptSetHash: preflight.invocation.promptSetHash, approvalHash: stableHash(approval), recoveryApprovalHash: stableHash(consumed), resumedFromCheckpoint: Boolean(checkpoint), maxNewProviderCalls: gate.maxNewProviderCalls, maxNewCredits: gate.maxNewCredits, automaticRetries: 0, productionWrites: false, record: fullDeckSafeRecord(record) };
  writeRecoveryEvidence(p9RecoverySummaryPath, summary);
  return summary;
}

function validateSelectedRecoveryApproval({ approval, recoveryApproval, preflight }) {
  const value = recoveryApproval.value;
  exact(value, ["schemaVersion", "contract", "decision", "pages", "promptSetHash", "invocationHash", "approvalHash", "maxNewProviderCalls", "maxNewCredits", "automaticRetries", "reviewedBy", "reviewedAt", "consumedAt", "consumerRunNonce"], "05n.selectedRecoveryApproval");
  if (value.schemaVersion !== "1.0" || value.contract !== "XhsIntegratedPage05NSelectedRecoveryApproval@1.0" || value.decision !== "approved" || !String(value.reviewedBy).startsWith("controller-") || value.promptSetHash !== preflight.invocation.promptSetHash || value.invocationHash !== preflight.invocation.invocationHash || value.approvalHash !== stableHash(approval) || value.automaticRetries !== 0 || value.consumedAt !== null || value.consumerRunNonce !== null || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > MAX_SELECTED_RECOVERY_PAGES) throw new Error("SELECTED_RECOVERY_APPROVAL_INVALID");
  const ids = value.pages.map((item) => item?.pageId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !FULL_DECK_PENDING_PAGE_IDS.includes(id)) || value.pages.some((item) => typeof item.allowCreateTask !== "boolean")) throw new Error("SELECTED_RECOVERY_PAGE_LIST_INVALID");
  const creates = value.pages.filter((item) => item.allowCreateTask).length;
  if (value.maxNewProviderCalls !== creates || value.maxNewProviderCalls > value.pages.length || value.maxNewCredits !== creates * 8 || value.maxNewCredits > value.pages.length * 8) throw new Error("SELECTED_RECOVERY_BUDGET_INVALID");
  return value;
}

function assertP4FrozenTextBinding(preflight, request) {
  const spec = preflight.invocation.promptSet.pagePromptSpecs.find((item) => item.pageId === "P4");
  const frozen = "误区二：AI智能体可以一步到位？";
  if (!spec || !JSON.stringify(spec.contentTruth).includes(frozen) || !String(request?.body?.input?.prompt || "").includes(frozen)) throw new Error("P4_FROZEN_EXACT_TEXT_BINDING_REQUIRED");
}

export async function run05NSelectedRecoveryLive({ approvalFile, recoveryApprovalFile, operations = {}, apiKey = null } = {}) {
  validateRecoveryIsolation(); mkdirSync(recoveryOutputDir, { recursive: true });
  const approval = readFullDeckApprovalFile(approvalFile); const preflight = build05NFullDeckPreflight({ promptApproval: approval, now: approval.reviewedAt });
  const recoveryApproval = readP9RecoveryApprovalFile(recoveryApprovalFile); const gate = validateSelectedRecoveryApproval({ approval, recoveryApproval, preflight });
  const requests = new Map(preflight.requests.map((item, index) => [FULL_DECK_PAGE_IDS[index], item.request]));
  const work = gate.pages.map((page) => ({ ...page, request: requests.get(page.pageId) })).sort((a, b) => a.pageId.localeCompare(b.pageId));
  if (work.some((item) => !item.request)) throw new Error("SELECTED_RECOVERY_REQUEST_MISSING");
  for (const item of work) { if (item.pageId === "P4") assertP4FrozenTextBinding(preflight, item.request); if (item.pageId === "P9") assertNoP9PlaceholderArtifact(); item.requestHash = stableHash(item.request); item.checkpoint = item.pageId === "P4" ? null : readTaskCheckpoint(item.pageId, preflight, item.requestHash); if (!item.checkpoint && !item.allowCreateTask) throw new Error(`SELECTED_RECOVERY_CHECKPOINT_REQUIRED:${item.pageId}`); }
  const io = { ...defaultLiveOperations, persistArtifact: normalizeFullDeckArtifact, ...operations }; if (typeof io.pollTask !== "function" || typeof io.downloadResult !== "function" || typeof io.persistArtifact !== "function" || work.some((item) => !item.checkpoint) && (typeof io.credits !== "function" || typeof io.createTask !== "function")) throw new Error("SELECTED_RECOVERY_OPERATIONS_REQUIRED");
  const resolvedApiKey = apiKey || loadApiKey(); const consumed = consumeP9RecoveryApproval(recoveryApproval, gate); let newCalls = 0; let newCredits = 0; const records = [];
  for (const item of work) {
    const record = { pageId: item.pageId, resumedFromCheckpoint: Boolean(item.checkpoint), additionalProviderCalls: 0, providerStatus: "pending", providerNativeDimensionStatus: "pending", normalizationStatus: "not_run", finalCanvasStatus: "pending", costStatus: item.checkpoint ? "not_applicable" : "pending", actualCredits: 0, ocr: "not_run", fact: "not_run", visual: "not_run", manualAesthetic: "not_run", userSelection: "not_selected", delivery: "not_delivered", blocker: null }; let before = null; let taskId = item.checkpoint?.taskId;
    try { if (!taskId) { before = await io.credits(resolvedApiKey); if (!Number.isFinite(before) || before < 8 || newCalls >= gate.maxNewProviderCalls) throw new Error("SELECTED_RECOVERY_PRECALL_BUDGET_STOP"); taskId = await io.createTask(resolvedApiKey, item.request); writeTaskCheckpoint({ pageId: item.pageId, taskId, preflight, requestHash: item.requestHash }); record.additionalProviderCalls = 1; newCalls += 1; } const task = await io.pollTask(resolvedApiKey, taskId, { maxPolls: 180, intervalMs: 3000 }); const artifact = await io.persistArtifact(item.pageId, await io.downloadResult(task)); record.providerStatus = "succeeded"; record.providerNativeDimensionStatus = artifact.providerNativeDimensionStatus; record.normalizationStatus = artifact.normalizationStatus; record.finalCanvasStatus = artifact.finalCanvasStatus; if (artifact.blocker || artifact.normalizationStatus !== "succeeded" || artifact.finalCanvasStatus !== "passed") record.blocker = artifact.blocker || "NORMALIZATION_BLOCKED"; }
    catch (error) { record.providerStatus = "failed"; record.providerNativeDimensionStatus = "blocked"; record.normalizationStatus = "blocked"; record.finalCanvasStatus = "blocked"; record.blocker = `SELECTED_RECOVERY_STOP:${sanitizeEvidence(error.message)}`; }
    if (before !== null) try { const after = await io.credits(resolvedApiKey); record.actualCredits = Math.max(0, before - after); newCredits += record.actualCredits; if (record.actualCredits > 8 || newCredits > gate.maxNewCredits) record.blocker = [record.blocker, "SELECTED_RECOVERY_ACTUAL_BUDGET_EXCEEDED"].filter(Boolean).join("|"); else record.costStatus = "measured"; } catch (error) { record.blocker = [record.blocker, `POST_CALL_COST_QUERY_FAILED:${sanitizeEvidence(error.message)}`].filter(Boolean).join("|"); }
    records.push(fullDeckSafeRecord(record)); if (record.blocker) break;
  }
  const summary = { schemaVersion: "1.0", contract: "XhsIntegratedPage05NSelectedRecoverySummary@1.0", mode: "isolated-selected-recovery-live", pages: work.map((item) => item.pageId), planHash: preflight.plan.planHash, invocationHash: preflight.invocation.invocationHash, promptSetHash: preflight.invocation.promptSetHash, approvalHash: stableHash(approval), recoveryApprovalHash: stableHash(consumed), newProviderCalls: newCalls, newCredits, maxNewProviderCalls: gate.maxNewProviderCalls, maxNewCredits: gate.maxNewCredits, automaticRetries: 0, productionWrites: false, records };
  writeRecoveryEvidence(resolve(recoveryOutputDir, "selected-recovery-summary.json"), summary); return summary;
}

export function summarize05NFullDeckLive({ preflight, approval, execution, officialPreflight }) {
  return {
    schemaVersion: "1.0",
    contract: "XhsIntegratedPage05NFullDeckLiveSummary@1.0",
    mode: "isolated-full-deck-live",
    provider: preflight.config.providerProfile.provider,
    model: preflight.config.providerProfile.model,
    planHash: preflight.plan.planHash,
    invocationHash: preflight.invocation.invocationHash,
    promptSetHash: preflight.invocation.promptSetHash,
    approvalHash: stableHash(approval),
    officialPreflight: { snapshotHash: officialPreflight.snapshotHash, verifiedAt: officialPreflight.verifiedAt, consumedAt: officialPreflight.consumedAt, consumerRunNonce: officialPreflight.consumerRunNonce },
    budget: {
      priorPaidRequests: preflight.config.budget.previousPaidRequests,
      priorConsumedCredits: preflight.config.budget.priorConsumedCredits,
      maxNewProviderCalls: preflight.config.budget.maxNewProviderCalls,
      maxCreditsPerCall: preflight.config.budget.maxCreditsPerRequest,
      maxNewCredits: preflight.config.budget.maxNewCredits,
      maxTotalCreditsIncludingPrior: preflight.config.budget.maxTotalCreditsIncludingPrior,
      candidatesPerRequest: preflight.config.budget.candidatesPerRequest,
      automaticRetries: 0
    },
    actualNewProviderCalls: execution.actualNewProviderCalls,
    actualNewCredits: execution.actualNewCredits,
    totalCreditsIncludingPrior: execution.totalCreditsIncludingPrior,
    automaticRetries: 0,
    productionWrites: false,
    stoppedBy: execution.stoppedBy ? sanitizeEvidence(execution.stoppedBy) : null,
    records: execution.records.map(fullDeckSafeRecord)
  };
}

function readFullDeckOfficialPreflightFile(filename) {
  if (!filename || basename(filename) !== filename || !filename.endsWith(".json")) throw new Error("FULL_DECK_OFFICIAL_PREFLIGHT_FILE_NAME_REQUIRED");
  const path = resolve(recoveryOutputDir, filename);
  if (!within(path, recoveryOutputDir) || !existsSync(path) || lstatSync(path).isSymbolicLink()) throw new Error("FULL_DECK_OFFICIAL_PREFLIGHT_FILE_INVALID");
  return { path, value: readJson(path) };
}

function expectedOfficialSources(config) {
  return exactOfficialEvidenceSources(config);
}

function officialPreflightSnapshot(value) {
  return { planHash: value.planHash, invocationHash: value.invocationHash, promptSetHash: value.promptSetHash, approvalHash: value.approvalHash, verifiedAt: value.verifiedAt, transport: value.transport, officialEvidence: value.officialEvidence, officialProfile: value.officialProfile, failure: value.failure, providerCalls: value.providerCalls, paidCalls: value.paidCalls, automaticRetries: value.automaticRetries, apiKeyLoaded: value.apiKeyLoaded, productionWrites: value.productionWrites };
}

function validate05NOfficialPreflightCredential({ credential, preflight, approval, now = Date.now, maxAgeMs = 10 * 60 * 1000 }) {
  const value = credential.value;
  if (!value || value.schemaVersion !== "1.1" || value.contract !== "XhsIntegratedPage05NOfficialPreflight@1.1" || value.mode !== "isolated-official-evidence-preflight" || !OFFICIAL_EVIDENCE_TRANSPORTS.includes(value.transport)) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_IDENTITY_INVALID");
  if (value.officialProfile !== "passed" || value.failure !== null || value.providerCalls !== 0 || value.paidCalls !== 0 || value.automaticRetries !== 0 || value.apiKeyLoaded !== false || value.productionWrites !== false) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_GATE_INVALID");
  if (value.planHash !== preflight.plan.planHash || value.invocationHash !== preflight.invocation.invocationHash || value.promptSetHash !== preflight.invocation.promptSetHash || value.approvalHash !== stableHash(approval)) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_BINDING_MISMATCH");
  const verifiedAtMs = Date.parse(value.verifiedAt);
  if (!Number.isFinite(verifiedAtMs) || verifiedAtMs > now() || now() - verifiedAtMs > maxAgeMs) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_STALE");
  const expectedSources = expectedOfficialSources(preflight.config);
  if (!value.officialEvidence || JSON.stringify(Object.keys(value.officialEvidence).sort()) !== JSON.stringify(Object.keys(expectedSources).sort())) throw new Error("OFFICIAL_PREFLIGHT_EVIDENCE_SOURCES_INVALID");
  for (const [source, url] of Object.entries(expectedSources)) if (value.officialEvidence[source]?.url !== url || !/^[a-f0-9]{64}$/.test(value.officialEvidence[source]?.contentSha256 || "") || !Number.isInteger(value.officialEvidence[source]?.bytes) || value.officialEvidence[source].bytes < 1 || value.officialEvidence[source].bytes > OFFICIAL_EVIDENCE_MAX_BYTES || value.officialEvidence[source].transport !== value.transport) throw new Error(`OFFICIAL_PREFLIGHT_EVIDENCE_INVALID:${source}`);
  if (value.snapshotHash !== stableHash(officialPreflightSnapshot(value))) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_TAMPERED");
  if (value.consumedAt !== null || value.consumerRunNonce !== null) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_ALREADY_CONSUMED");
  if (existsSync(fullDeckLiveSummaryPath)) {
    const prior = readJson(fullDeckLiveSummaryPath);
    if (prior?.officialPreflight?.snapshotHash === value.snapshotHash) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_REPLAYED_IN_LIVE_SUMMARY");
  }
  if (existsSync(fullDeckPreflightConsumptionLedgerPath)) {
    const ledger = readJson(fullDeckPreflightConsumptionLedgerPath);
    if (!Array.isArray(ledger?.consumed) || ledger.consumed.some((entry) => entry.snapshotHash === value.snapshotHash)) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_REPLAYED_IN_CONSUMPTION_LEDGER");
  }
  return value;
}

function consume05NOfficialPreflightCredential({ credential, value, consumedAt = new Date().toISOString(), consumerRunNonce = sha256Bytes(`${value.snapshotHash}:${consumedAt}:${process.pid}`).slice(0, 32) }) {
  if (!/^[a-f0-9]{32}$/.test(consumerRunNonce)) throw new Error("OFFICIAL_PREFLIGHT_CONSUMER_NONCE_INVALID");
  const current = readJson(credential.path);
  if (current.snapshotHash !== value.snapshotHash || current.consumedAt !== null || current.consumerRunNonce !== null) throw new Error("OFFICIAL_PREFLIGHT_CREDENTIAL_CONSUME_CONFLICT");
  const consumed = { ...current, consumedAt, consumerRunNonce };
  writeRecoveryEvidence(credential.path, consumed);
  const ledger = existsSync(fullDeckPreflightConsumptionLedgerPath) ? readJson(fullDeckPreflightConsumptionLedgerPath) : { schemaVersion: "1.0", contract: "XhsIntegratedPage05NOfficialPreflightConsumptionLedger@1.0", consumed: [] };
  if (ledger.schemaVersion !== "1.0" || ledger.contract !== "XhsIntegratedPage05NOfficialPreflightConsumptionLedger@1.0" || !Array.isArray(ledger.consumed) || ledger.consumed.some((entry) => entry.snapshotHash === value.snapshotHash)) throw new Error("OFFICIAL_PREFLIGHT_CONSUMPTION_LEDGER_CONFLICT");
  ledger.consumed.push({ snapshotHash: value.snapshotHash, consumedAt, consumerRunNonce });
  writeRecoveryEvidence(fullDeckPreflightConsumptionLedgerPath, ledger);
  return consumed;
}

export async function run05NFullDeckLive({ approvalFile, officialPreflightFile, operations = {}, apiKey = null, now = Date.now } = {}) {
  validateRecoveryIsolation();
  mkdirSync(recoveryOutputDir, { recursive: true });
  const approval = readFullDeckApprovalFile(approvalFile);
  const preflight = build05NFullDeckPreflight({ promptApproval: approval, now: approval.reviewedAt });
  const recovery = prepare05MRecovery();
  const credential = readFullDeckOfficialPreflightFile(officialPreflightFile);
  const officialPreflight = validate05NOfficialPreflightCredential({ credential, preflight, approval, now });
  const resolvedApiKey = apiKey || loadApiKey();
  const consumedOfficialPreflight = consume05NOfficialPreflightCredential({ credential, value: officialPreflight });
  const execution = await execute05NFullDeckPlan({
    preflight,
    recovery,
    apiKey: resolvedApiKey,
    operations: { ...defaultLiveOperations, persistArtifact: normalizeFullDeckArtifact, ...operations, verifyOfficialProfile: async () => ({ verified: true, provider: "kie.ai", model: preflight.config.providerProfile.model, endpoint: preflight.config.providerProfile.createEndpoint, projectionKey: preflight.config.providerProfile.adapter.projectionKey, estimatedCreditsPerRequest: preflight.config.providerProfile.estimatedCostPerCandidate }) }
  });
  const summary = summarize05NFullDeckLive({ preflight, approval, execution, officialPreflight: consumedOfficialPreflight });
  writeRecoveryEvidence(fullDeckLiveSummaryPath, summary);
  return summary;
}

export async function run05NFullDeckOfficialPreflight({ approvalFile, transport = "node_fetch", operations = {}, verifiedAt = new Date().toISOString() } = {}) {
  validateRecoveryIsolation();
  if (!OFFICIAL_EVIDENCE_TRANSPORTS.includes(transport)) throw new Error("OFFICIAL_EVIDENCE_TRANSPORT_INVALID");
  mkdirSync(recoveryOutputDir, { recursive: true });
  const approval = readFullDeckApprovalFile(approvalFile);
  const preflight = build05NFullDeckPreflight({ promptApproval: approval, now: approval.reviewedAt });
  const io = { ...defaultLiveOperations, ...operations };
  let officialProfile = "blocked";
  let failure = null;
  let verifiedEvidence = null;
  try {
    const verified = await io.verifyOfficialProfile(preflight.config, { transport });
    if (!verified?.verified || verified.model !== preflight.config.providerProfile.model || verified.projectionKey !== "image2.text-to-image.v1" || verified.estimatedCreditsPerRequest > preflight.config.budget.maxCreditsPerRequest) throw new Error("OFFICIAL_PREFLIGHT_MISMATCH");
    const expectedSources = expectedOfficialSources(preflight.config);
    if (!verified.evidence || Object.keys(verified.evidence).length !== 3 || Object.entries(expectedSources).some(([source, url]) => verified.evidence[source]?.url !== url || !/^[a-f0-9]{64}$/.test(verified.evidence[source]?.contentSha256 || "") || !Number.isInteger(verified.evidence[source]?.bytes) || verified.evidence[source].bytes < 1 || verified.evidence[source].bytes > OFFICIAL_EVIDENCE_MAX_BYTES || verified.evidence[source].transport !== transport)) throw new Error("OFFICIAL_PREFLIGHT_EVIDENCE_INVALID");
    officialProfile = "passed"; verifiedEvidence = verified.evidence;
  } catch (error) { failure = sanitizeEvidence(error.message); }
  const summary = {
    schemaVersion: "1.1",
    contract: "XhsIntegratedPage05NOfficialPreflight@1.1",
    mode: "isolated-official-evidence-preflight",
    planHash: preflight.plan.planHash,
    invocationHash: preflight.invocation.invocationHash,
    promptSetHash: preflight.invocation.promptSetHash,
    approvalHash: stableHash(approval),
    verifiedAt,
    transport,
    officialEvidence: verifiedEvidence,
    officialProfile,
    failure,
    providerCalls: 0,
    paidCalls: 0,
    automaticRetries: 0,
    apiKeyLoaded: false,
    productionWrites: false,
    consumedAt: null,
    consumerRunNonce: null,
    nextAction: officialProfile === "passed" ? "controller_may_open_separate_full_deck_window" : "stop_and_record_official_evidence_failure"
  };
  summary.snapshotHash = stableHash(officialPreflightSnapshot(summary));
  writeRecoveryEvidence(fullDeckOfficialPreflightPath, summary);
  return summary;
}

export async function runLive({ approvalFile, operations = {}, apiKey = null } = {}) {
  validateIsolation();
  mkdirSync(outputDir, { recursive: true });
  const approval = readApprovalFile(approvalFile);
  const preflight = buildSkillDrivenPreflight({ promptApproval: approval });
  const execution = await executeApprovedPreflight({ preflight, apiKey: apiKey || loadApiKey(), operations });
  const summary = { schemaVersion: "1.0", mode: "live", provider: "kie.ai", model: "gpt-image-2-text-to-image", planHash: preflight.plan.planHash, invocationHash: preflight.invocation.invocationHash, promptSetHash: preflight.invocation.promptSetHash, approvedPaidRequests: 3, ...execution };
  writeEvidence(resolve(outputDir, "run-summary.json"), summary);
  for (const record of execution.records) writeEvidence(resolve(outputDir, `${record.pageId.toLowerCase()}.evaluation.json`), record);
  return summary;
}

export function parseCliArguments(args) {
  if (!Array.isArray(args)) throw new Error("CLI_ARGUMENTS_ARRAY_REQUIRED");
  if (args.length === 0) return { mode: "dry-run" };
  if (args.length === 1 && args[0] === "--recover-05m-live") return { mode: "recover-05m-live" };
  if (args[0] === "--live" && args.length === 3 && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--")) return { mode: "live", approvalFile: args[2] };
  if (args[0] === "--full-deck-live" && args.length === 5 && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--") && args[3] === "--official-preflight-file" && args[4] && !args[4].startsWith("--")) return { mode: "full-deck-live", approvalFile: args[2], officialPreflightFile: args[4] };
  if (args[0] === "--recover-p9-live" && args.length === 5 && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--") && args[3] === "--recovery-approval-file" && args[4] && !args[4].startsWith("--")) return { mode: "recover-p9-live", approvalFile: args[2], recoveryApprovalFile: args[4] };
  if (args[0] === "--recover-selected-pages-live" && args.length === 5 && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--") && args[3] === "--recovery-approval-file" && args[4] && !args[4].startsWith("--")) return { mode: "recover-selected-pages-live", approvalFile: args[2], recoveryApprovalFile: args[4] };
  if (args[0] === "--full-deck-official-preflight" && args.length === 3 && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--")) return { mode: "full-deck-official-preflight", approvalFile: args[2], transport: "node_fetch" };
  if (args[0] === "--full-deck-official-preflight" && args.length === 5 && args[1] === "--approval-file" && args[2] && !args[2].startsWith("--") && args[3] === "--transport" && OFFICIAL_EVIDENCE_TRANSPORTS.includes(args[4])) return { mode: "full-deck-official-preflight", approvalFile: args[2], transport: args[4] };
  if (args.includes("--full-deck-live")) throw new Error("FULL_DECK_LIVE_CLI_REQUIRES_EXACTLY:--full-deck-live --approval-file <controller-approval.json> --official-preflight-file <verified-preflight.json>");
  if (args.includes("--recover-p9-live")) throw new Error("P9_RECOVERY_CLI_REQUIRES_EXACTLY:--recover-p9-live --approval-file <controller-approval.json> --recovery-approval-file <controller-p9-recovery.json>");
  if (args.includes("--recover-selected-pages-live")) throw new Error("SELECTED_RECOVERY_CLI_REQUIRES_EXACTLY:--recover-selected-pages-live --approval-file <controller-approval.json> --recovery-approval-file <controller-selected-recovery.json>");
  if (args.includes("--full-deck-official-preflight")) throw new Error("FULL_DECK_OFFICIAL_PREFLIGHT_CLI_REQUIRES_EXACTLY:--full-deck-official-preflight --approval-file <controller-approval.json> [--transport node_fetch|system_curl]");
  if (args.includes("--live")) throw new Error("LIVE_CLI_REQUIRES_EXACTLY:--live --approval-file <approval.json>");
  throw new Error(`CLI_ARGUMENT_FORBIDDEN:${args.join(" ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const cli = parseCliArguments(process.argv.slice(2));
    let result;
    if (cli.mode === "live") result = await runLive({ approvalFile: cli.approvalFile });
    else if (cli.mode === "full-deck-live") result = await run05NFullDeckLive({ approvalFile: cli.approvalFile, officialPreflightFile: cli.officialPreflightFile });
    else if (cli.mode === "recover-p9-live") result = await run05NSelectedRecoveryLive({ approvalFile: cli.approvalFile, recoveryApprovalFile: cli.recoveryApprovalFile });
    else if (cli.mode === "recover-selected-pages-live") result = await run05NSelectedRecoveryLive({ approvalFile: cli.approvalFile, recoveryApprovalFile: cli.recoveryApprovalFile });
    else if (cli.mode === "full-deck-official-preflight") result = await run05NFullDeckOfficialPreflight({ approvalFile: cli.approvalFile, transport: cli.transport });
    else if (cli.mode === "recover-05m-live") result = await run05MRecoveryLive();
    else result = runDryRun();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${sanitizeEvidence(error.message)}\n`);
    process.exitCode = 1;
  }
}
