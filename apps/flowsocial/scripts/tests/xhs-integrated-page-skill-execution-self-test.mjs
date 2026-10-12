import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { createProviderCapabilitySnapshot } from "../../image-providers/xhs-integrated-page/capabilities.mjs";
import {
  buildIntegratedPageExecutionPlan,
  assertAudienceSafeProviderPrompt,
  createCostConfirmation,
  decideIntegratedPageEligibility,
  materializeProviderExecutionRequest,
  validateIntegratedPageEligibilityDecision,
  validateIntegratedPageExecutionPlan
} from "../../image-providers/xhs-integrated-page/execution-plan.mjs";
import { buildVisualAssetRegistrySnapshot } from "../../image-providers/xhs-integrated-page/registry.mjs";
import { createPromptReviewDecision, transitionPromptReviewDecision } from "../../image-providers/xhs-integrated-page/review-state-machine.mjs";
import { invokeDesignXhsIntegratedPages, validateDesignSkillInvocation } from "../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { loadLibraries } from "../../skills/design-xhs-integrated-pages/scripts/validate-library.mjs";
import { adaptEvaluationCase, projectXhsPostPackage, validateRuntimeInput } from "../../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testDir, "..", "..");
const json = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const executionFixtures = json(join(appRoot, "scripts", "fixtures", "xhs-integrated-page-skill-execution", "execution-fixtures.json"));
const designFixtures = json(join(appRoot, "scripts", "fixtures", "xhs-integrated-design", "evaluation-cases.json"));
const controlFixtures = json(join(appRoot, "scripts", "fixtures", "xhs-integrated-page-offline-control", "control-fixtures.json"));
const libraries = loadLibraries();
const compilerOptions = { canvas: { width: 1080, height: 1440 }, candidateCount: 1, requestedFeatures: { mask: null, preserveRegions: [], seed: null } };
const flagsOn = { xhsIntegratedPageSkillExecutionPlan: true };

assert.equal(featureFlags().xhsIntegratedPageSkillExecutionPlan, false, "05K Feature Flag must default off");

const registry = buildVisualAssetRegistrySnapshot({ id: "registry:05k:v1", libraries, referenceAssets: controlFixtures.referenceAssets.authorized });
const capabilityFor = (id, dimensions, overrides = {}) => createProviderCapabilitySnapshot({
  id,
  capabilities: {
    integratedChineseTypography: true,
    referenceImages: true,
    exactDimensions: false,
    supportedDimensions: [dimensions],
    maxCandidateCount: 3,
    maskEditing: false,
    preserveRegions: false,
    seedControl: false,
    asyncJobs: true,
    ...overrides
  }
});

function reviewed(invocation, { approvePrompt = true, selectDirection = true } = {}) {
  const direction = controlFixtures.directionCandidates.find((item) => item.stylePackId === invocation.promptSet.visualStyleSelection.stylePackId);
  let decision = createPromptReviewDecision({ id: `review:${invocation.promptSet.id}:05k`, promptSet: invocation.promptSet, directionCandidates: controlFixtures.directionCandidates });
  if (selectDirection) decision = transitionPromptReviewDecision(decision, { lane: "visualDirectionSelection", action: "select", directionId: direction.id, actor: "fixture-user", at: "2026-08-04T00:00:00.000Z" });
  if (approvePrompt) decision = transitionPromptReviewDecision(decision, { lane: "promptReview", action: "approve", reviewedPromptSetHash: invocation.promptSetHash, actor: "fixture-reviewer", at: "2026-08-04T00:01:00.000Z" });
  return decision;
}

const confirmedCost = (max = 100) => createCostConfirmation({ status: "confirmed", currency: "credits", approvedMaxTotal: max, confirmedBy: "fixture-user", confirmedAt: "2026-08-04T00:02:00.000Z" });
const pendingCost = createCostConfirmation({ status: "pending", currency: "credits", approvedMaxTotal: null, confirmedBy: null, confirmedAt: null });

function planFor({ sample = designFixtures.cases[0], runtimeInput = null, profile = executionFixtures.profiles.nanoBanana2, capability, reviewOptions, cost = confirmedCost(), flags = flagsOn, registrySnapshot = registry } = {}) {
  const actualRuntimeInput = runtimeInput || adaptEvaluationCase(sample);
  const skillInvocation = invokeDesignXhsIntegratedPages(actualRuntimeInput);
  const reviewDecision = reviewed(skillInvocation, reviewOptions);
  const capabilitySnapshot = capability || capabilityFor(`capability:${profile.model}`, profile.nativeOutputDimensions);
  const plan = buildIntegratedPageExecutionPlan({
    skillInvocation,
    reviewDecision,
    capabilitySnapshot,
    registrySnapshot,
    libraries,
    directionCandidates: controlFixtures.directionCandidates,
    providerProfile: profile,
    compilerOptions,
    costConfirmation: cost,
    flags
  });
  return { skillInvocation, reviewDecision, capabilitySnapshot, plan };
}

const freshRuntimeInput = structuredClone(executionFixtures.freshRuntimeInput);
assert.equal(validateRuntimeInput(freshRuntimeInput), true);
assert.throws(() => invokeDesignXhsIntegratedPages(designFixtures.cases[0]), /DesignXhsIntegratedPagesRuntimeInput@1\.0:FIELDS/, "evaluation envelopes must not be accepted by the production invocation");
const fresh = planFor({ runtimeInput: freshRuntimeInput });
assert.equal(fresh.skillInvocation.promptSet.pagePromptSpecs.length, 3);
assert.equal(fresh.skillInvocation.promptSet.status, "draft");
assert.ok(!JSON.stringify(fresh.skillInvocation.promptSet).includes("80 条样本"), "fresh runtime test must not reuse evaluation content");
const freshProblem = fresh.skillInvocation.promptSet.pagePromptSpecs.find((page) => page.pageId === "P2");
assert.deepEqual(freshProblem.contentTruth.supportingText, ["方向没有冻结", "提示词绕过审阅", "交付状态提前完成"]);
assert.ok(["方向没有冻结", "提示词绕过审阅", "交付状态提前完成"].every((node) => freshProblem.promptBlocks.verbatimText.includes(node)));
assert.equal(freshProblem.expectedTextHash, stableHash(freshProblem.promptBlocks.verbatimText));
const freshCta = fresh.skillInvocation.promptSet.pagePromptSpecs.find((page) => page.pageId === "P3");
assert.equal(freshCta.contentTruth.cta, "保存这套检查清单");
assert.deepEqual(freshCta.contentTruth.supportingText, []);
assert.equal(freshCta.promptBlocks.verbatimText.filter((text) => text === "保存这套检查清单").length, 1);
assert.equal(freshCta.expectedTextHash, stableHash(["保存这套检查清单"]));
const markerInput = structuredClone(freshRuntimeInput);
markerInput.id = "runtime-three-page-presentation-marker-recovery";
markerInput.xhsPostPackage.data.deck.pages[0].text_layers[1].text = "HOOK · 老板的共同困境";
markerInput.xhsPostPackage.data.deck.pages[1].text_layers[1].items[0].text = "METHOD 1/4 · 先选一个 SaaS 场景并沉淀 SOP";
const markerRecovery = planFor({ runtimeInput: markerInput });
const markerPrompt = markerRecovery.plan.pages.map((page) => page.providerRequest.body.input.prompt).join("\n");
assert.doesNotMatch(markerPrompt, /\b(?:HOOK|METHOD)\b/);
assert.match(markerPrompt, /老板的共同困境/);
assert.match(markerPrompt, /第1步 · 先选一个 SaaS 场景并沉淀 SOP/);
const crmInput = structuredClone(freshRuntimeInput);
crmInput.id = "runtime-three-page-crm-truth-recovery";
crmInput.xhsPostPackage.data.deck.pages[1].text_layers[1].items[0].text = "分层结果落到一张小表即可，不必先上 CRM";
const crmRecovery = planFor({ runtimeInput: crmInput });
const crmPrompt = crmRecovery.plan.pages.find((page) => page.pageId === "P2").providerRequest.body.input.prompt;
assert.match(crmPrompt, /不必先上 CRM/);
assert.doesNotThrow(() => assertAudienceSafeProviderPrompt(crmPrompt, ["CRM"]));
assert.throws(() => assertAudienceSafeProviderPrompt(`${crmPrompt}\n- INTERNALLEAK`, ["CRM"]), /ASCII_TOKEN_NOT_ALLOWLISTED:INTERNALLEAK/);
const viBoundInput = structuredClone(freshRuntimeInput);
viBoundInput.visualSelection.stylePackId = "editorial-metaphor";
viBoundInput.visualSelection.reason = "内容自适应创意回归";
viBoundInput.designDna.palette = ["#D71018", "#231815", "#FFFFFF"];
viBoundInput.designDna.typographyRoles = ["中文主标题使用厚重黑体", "正文使用阿里巴巴普惠体"];
viBoundInput.designDna.constraints = ["顶部统一品牌页眉（GreatSell.AI 标识 + 副标 大卖数智视觉识别系统）", "中英文双语对照排版（中文为主、英文为辅）", "禁止霓虹蓝和伪界面"];
const viBound = planFor({ runtimeInput: viBoundInput });
assert.deepEqual(viBound.skillInvocation.promptSet.visualStyleSelection.constraints, ["品牌识别强调色：高饱和暖红色"]);
assert.doesNotMatch(viBound.plan.pages[0].providerRequest.body.input.prompt, /#[0-9A-F]{6}/i, "raw colour codes must never be rendered as visible page copy");
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /高饱和暖红色.*仅用于少量品牌识别/);
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /根据本篇主题、情绪和视觉概念生成主辅色/);
assert.doesNotMatch(viBound.plan.pages[0].providerRequest.body.input.prompt, /#231815|#FFFFFF|厚重黑体|阿里巴巴普惠体|中文排版/, "full palettes and VI typography must stay outside Provider prompts");
const seriesPrompts = viBound.plan.pages.map((page) => page.providerRequest.body.input.prompt);
assert.ok(seriesPrompts.every((prompt) => prompt.includes("本内容包系列配色") && prompt.includes("本内容包系列媒介") && prompt.includes("本内容包系列标题")), "every page must receive the same explicit series visual contract");
assert.equal(new Set(seriesPrompts.map((prompt) => prompt.match(/本内容包系列配色：[\s\S]*?本内容包系列媒介：/)?.[0])).size, 1, "series palette contract must be identical across the batch");
assert.ok(seriesPrompts.every((prompt) => prompt.includes("不得逐页自行改变标题系统") || prompt.includes("所有步骤页面使用完全相同的标题系统")), "series typography must be locked across peer pages");
assert.doesNotMatch(viBound.plan.pages[0].providerRequest.body.input.prompt, /GreatSell|大卖数智视觉识别系统|中英文双语|品牌元素\.AI|品牌页眉/, "VI manual examples must never become visible page copy");
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /所有可见文字必须逐字来自下方真值/);
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /道路、路牌、建筑、服装、屏幕、包装、图标和背景纹理不得出现真值之外/);
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /禁止照搬视觉手册/);
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /先确定本页独有的创意概念/);
assert.match(viBound.plan.pages[0].providerRequest.body.input.prompt, /禁止默认使用信息卡、宫格、中心圆节点图/);
const duplicateCtaInput = structuredClone(freshRuntimeInput);
duplicateCtaInput.xhsPostPackage.data.deck.pages[2].text_layers[0].type = "supporting";
const duplicateCtaTruth = projectXhsPostPackage(duplicateCtaInput.xhsPostPackage, duplicateCtaInput.contentVersion)[2];
assert.deepEqual(duplicateCtaTruth.supportingText, []);
assert.equal(duplicateCtaTruth.cta, "保存这套检查清单");
const conflictingCtaInput = structuredClone(freshRuntimeInput);
conflictingCtaInput.xhsPostPackage.data.deck.pages[2].text_layers[0].text = "立即咨询";
assert.throws(() => projectXhsPostPackage(conflictingCtaInput.xhsPostPackage, conflictingCtaInput.contentVersion), /CTA_TEXT_MISMATCH/);
const duplicateSelectionInput = structuredClone(freshRuntimeInput);
duplicateSelectionInput.visualSelection.pages.push(structuredClone(duplicateSelectionInput.visualSelection.pages[0]));
assert.throws(() => invokeDesignXhsIntegratedPages(duplicateSelectionInput), /VISUAL_SELECTION_PAGE_ID_DUPLICATE:P1/);
const unknownSelectionInput = structuredClone(freshRuntimeInput);
unknownSelectionInput.visualSelection.pages[2].pageId = "P4";
assert.throws(() => invokeDesignXhsIntegratedPages(unknownSelectionInput), /VISUAL_SELECTION_PAGE_UNKNOWN:P4/);
const missingSelectionInput = structuredClone(freshRuntimeInput);
missingSelectionInput.visualSelection.pages.pop();
assert.throws(() => invokeDesignXhsIntegratedPages(missingSelectionInput), /VISUAL_SELECTION_PAGE_MISSING:P3/);
const duplicatePackagePageInput = structuredClone(freshRuntimeInput);
duplicatePackagePageInput.xhsPostPackage.data.deck.pages[2].page = 2;
assert.throws(() => invokeDesignXhsIntegratedPages(duplicatePackagePageInput), /PACKAGE_PAGE_ID_DUPLICATE:P2:PAGE_NUMBER:2/);
const incompatibleArchetypeRoleInput = structuredClone(freshRuntimeInput);
incompatibleArchetypeRoleInput.visualSelection.pages[1].archetypeId = "process.vertical-steps";
assert.throws(() => invokeDesignXhsIntegratedPages(incompatibleArchetypeRoleInput), /ARCHETYPE_PAGE_ROLE_UNSUPPORTED:P2:process\.vertical-steps:problem/);
const incompatibleArchetypeDensityInput = structuredClone(freshRuntimeInput);
incompatibleArchetypeDensityInput.visualSelection.stylePackId = "structured-infographic";
incompatibleArchetypeDensityInput.xhsPostPackage.data.deck.pages[1].role = "method";
incompatibleArchetypeDensityInput.pageDensity.P2 = "high";
assert.throws(() => invokeDesignXhsIntegratedPages(incompatibleArchetypeDensityInput), /ARCHETYPE_DENSITY_UNSUPPORTED:P2:explanation\.concept-map:high/);
const incompatiblePatternInput = structuredClone(freshRuntimeInput);
incompatiblePatternInput.visualSelection.pages[1].patternIds = ["pattern.list.equal-cards"];
assert.throws(() => invokeDesignXhsIntegratedPages(incompatiblePatternInput), /PROMPT_PATTERN_ARCHETYPE_UNSUPPORTED:P2:pattern\.list\.equal-cards:explanation\.concept-map/);
const incompatibleStyleInput = structuredClone(freshRuntimeInput);
incompatibleStyleInput.visualSelection.stylePackId = "structured-infographic";
assert.throws(() => invokeDesignXhsIntegratedPages(incompatibleStyleInput), /STYLE_PACK_PAGE_ROLE_UNSUPPORTED:P2:structured-infographic:problem/);
const incompatibleStyleDensityInput = structuredClone(freshRuntimeInput);
incompatibleStyleDensityInput.pageDensity.P1 = "high";
assert.throws(() => invokeDesignXhsIntegratedPages(incompatibleStyleDensityInput), /STYLE_PACK_DENSITY_UNSUPPORTED:P1:friendly-handdrawn-tech:high/);

const happy = planFor();
const repeated = planFor();
assert.equal(repeated.skillInvocation.invocationHash, happy.skillInvocation.invocationHash);
assert.equal(repeated.plan.planHash, happy.plan.planHash, "same frozen input must produce a stable plan hash");
assert.equal(validateDesignSkillInvocation(happy.skillInvocation), true);
assert.equal(validateIntegratedPageExecutionPlan(happy.plan), true);
assert.equal(happy.plan.execution.status, "ready_for_isolated_provider_execution");
assert.equal(happy.plan.productionEligible, false);
assert.equal(happy.plan.states.provider, "not_called");
assert.equal(happy.plan.states.ocr, "not_run");
assert.equal(happy.plan.states.fact, "not_run");
assert.equal(happy.plan.states.visual, "not_run");
assert.equal(happy.plan.states.userSelection, "not_selected");
assert.equal(happy.plan.states.delivery, "not_delivered");
assert.ok(happy.plan.pages.every((page) => page.legacyCompiler.originalBlockerCodes.includes("UNSUPPORTED_DIMENSIONS")));
assert.ok(happy.plan.pages.every((page) => page.legacyCompiler.reclassifiedBlockerCodes.includes("UNSUPPORTED_DIMENSIONS")));
assert.ok(happy.plan.pages.every((page) => page.nativeDimensionQualification.status === "non_exact_normalizable"));
assert.ok(happy.plan.pages.every((page) => page.deliveryQualification.status === "pending_post_normalization_gates"));
assert.ok(happy.plan.pages[0].providerRequest.body.input.prompt.includes(happy.skillInvocation.promptSet.pagePromptSpecs[0].contentTruth.headline));
assert.ok(happy.plan.pages[0].providerRequest.body.input.prompt.includes("视觉媒介"));
assert.ok(happy.plan.pages[0].providerRequest.body.input.prompt.includes("材质空间光影"));
assert.ok(happy.plan.pages[0].providerRequest.body.input.prompt.includes("跨页统一"));

const request = materializeProviderExecutionRequest({ plan: happy.plan, pageId: "P1", expectedPlanHash: happy.plan.planHash, skillInvocation: happy.skillInvocation });
assert.equal(happy.plan.provider.id, "kie.ai");
assert.deepEqual(happy.plan.provider.adapter, { id: "kie-jobs-nano-banana-2", version: "1.0", projectionKey: "nano-banana-2.v1" });
assert.equal(request.body.model, "nano-banana-2");
assert.deepEqual(Object.keys(request.body.input).sort(), ["aspect_ratio", "image_input", "output_format", "prompt", "resolution"].sort());
assert.throws(() => materializeProviderExecutionRequest({ plan: happy.plan, pageId: "P1", expectedPlanHash: happy.plan.planHash, skillInvocation: happy.skillInvocation, prompt: "05E hardcoded geometric prompt" }), /FIELDS/);
assert.throws(() => buildIntegratedPageExecutionPlan({
  skillInvocation: happy.skillInvocation,
  reviewDecision: happy.reviewDecision,
  capabilitySnapshot: happy.capabilitySnapshot,
  registrySnapshot: registry,
  libraries,
  directionCandidates: controlFixtures.directionCandidates,
  providerProfile: executionFixtures.profiles.nanoBanana2,
  compilerOptions,
  costConfirmation: confirmedCost(),
  flags: flagsOn,
  hardcodedLivePrompt: "05G bypass"
}), /FIELDS/);
assert.throws(() => materializeProviderExecutionRequest({ plan: happy.plan, pageId: "P1", expectedPlanHash: stableHash("tampered"), skillInvocation: happy.skillInvocation }), /PLAN_HASH_MISMATCH/);

const preProvider = decideIntegratedPageEligibility({ plan: happy.plan, pageId: "P1" });
assert.equal(validateIntegratedPageEligibilityDecision(preProvider), true);
assert.equal(preProvider.eligibleStage, "provider_execution");
const selectable = decideIntegratedPageEligibility({ plan: happy.plan, pageId: "P1", evidence: executionFixtures.safeEvidence });
assert.equal(validateIntegratedPageEligibilityDecision(selectable), true);
assert.equal(selectable.providerNativeDimensionStatus, "failed", "native dimension fact must remain failed");
assert.equal(selectable.finalDeliveryDimensionStatus, "passed");
assert.equal(selectable.eligibleStage, "candidate_selection");
assert.equal(selectable.userSelectionStatus, "not_selected");
assert.equal(selectable.deliveryStatus, "not_delivered");
const stretched = structuredClone(executionFixtures.safeEvidence);
stretched.normalization.nonUniformStretch = true;
const stretchedDecision = decideIntegratedPageEligibility({ plan: happy.plan, pageId: "P1", evidence: stretched });
assert.equal(stretchedDecision.eligibleStage, "blocked");
assert.ok(stretchedDecision.blockers.some((item) => item.code === "NON_UNIFORM_STRETCH"));
const cropped = structuredClone(executionFixtures.safeEvidence);
cropped.normalization.protectedRegionCrop = true;
assert.ok(decideIntegratedPageEligibility({ plan: happy.plan, pageId: "P1", evidence: cropped }).blockers.some((item) => item.code === "PROTECTED_REGION_CROP"));
const failedGate = structuredClone(executionFixtures.safeEvidence);
failedGate.gates.ocr = "failed";
assert.ok(decideIntegratedPageEligibility({ plan: happy.plan, pageId: "P1", evidence: failedGate }).blockers.some((item) => item.code === "OCR_GATE_FAILED"));

const blockedScenarios = [
  ["direction", planFor({ reviewOptions: { selectDirection: false, approvePrompt: false } }).plan, "VISUAL_DIRECTION_NOT_SELECTED"],
  ["prompt", planFor({ reviewOptions: { selectDirection: true, approvePrompt: false } }).plan, "PROMPT_REVIEW_NOT_APPROVED"],
  ["cost", planFor({ cost: pendingCost }).plan, "COST_NOT_CONFIRMED"],
  ["flag", planFor({ flags: { xhsIntegratedPageSkillExecutionPlan: false } }).plan, "FEATURE_FLAG_DISABLED"],
  ["capability", planFor({ capability: capabilityFor("capability:no-typography", executionFixtures.profiles.nanoBanana2.nativeOutputDimensions, { integratedChineseTypography: false }) }).plan, "MISSING_CAPABILITY"]
];
for (const [label, plan, code] of blockedScenarios) {
  assert.equal(plan.execution.status, "blocked", label);
  assert.ok(plan.pages.some((page) => page.blockers.some((item) => item.code === code)), `${label}:${code}`);
}

const licenseRegistry = structuredClone(registry);
const styleEntry = licenseRegistry.entries.find((item) => item.id === "structured-infographic");
styleEntry.license.allowsOfflineCompilation = false;
const styleBase = structuredClone(styleEntry); delete styleBase.entryHash; styleEntry.entryHash = stableHash(styleBase);
const registryBase = structuredClone(licenseRegistry); delete registryBase.snapshotHash; licenseRegistry.snapshotHash = stableHash(registryBase);
const licenseBlocked = planFor({ registrySnapshot: licenseRegistry }).plan;
assert.equal(licenseBlocked.execution.status, "blocked");
assert.ok(licenseBlocked.pages.some((page) => page.blockers.some((item) => item.code === "SOURCE_LICENSE_INELIGIBLE")));

const textSample = structuredClone(designFixtures.cases[0]);
textSample.input.xhsPostPackage.data.deck.pages[0].text_layers[0].text += "（修订）";
const replacedInvocation = planFor({ sample: textSample }).skillInvocation;
assert.throws(() => materializeProviderExecutionRequest({ plan: happy.plan, pageId: "P1", expectedPlanHash: happy.plan.planHash, skillInvocation: replacedInvocation }), /SKILL_INVOCATION_HASH_MISMATCH/);
const styleSample = structuredClone(designFixtures.cases[0]);
styleSample.selection.stylePackId = "friendly-handdrawn-tech";
const patternSample = structuredClone(designFixtures.cases[0]);
patternSample.selection.pages[0].patternIds = ["pattern.hierarchy.thumbnail-legibility"];
const image2 = planFor({ profile: executionFixtures.profiles.image2, capability: capabilityFor("capability:image2", executionFixtures.profiles.image2.nativeOutputDimensions) });
const image2Request = materializeProviderExecutionRequest({ plan: image2.plan, pageId: "P1", expectedPlanHash: image2.plan.planHash, skillInvocation: image2.skillInvocation });
assert.equal(image2.plan.provider.id, "kie.ai");
assert.deepEqual(image2.plan.provider.adapter, { id: "kie-jobs-image2", version: "1.0", projectionKey: "image2.text-to-image.v1" });
assert.equal(image2Request.body.model, "gpt-image-2-text-to-image");
assert.deepEqual(Object.keys(image2Request.body.input).sort(), ["aspect_ratio", "prompt", "resolution"].sort());
assert.notDeepEqual(image2Request.requestFields, request.requestFields, "Image 2 and Nano Banana 2 projections are not equivalent");
const alternateImage2Profile = structuredClone(executionFixtures.profiles.image2);
alternateImage2Profile.provider = "future-image-provider";
alternateImage2Profile.model = "image-2-compatible-entry";
alternateImage2Profile.adapter = { id: "future-image-jobs", version: "1.0", projectionKey: "image2.text-to-image.v1" };
alternateImage2Profile.createEndpoint = "/v2/image-tasks";
const alternateImage2 = planFor({ profile: alternateImage2Profile, capability: capabilityFor("capability:alternate-image2", alternateImage2Profile.nativeOutputDimensions) });
assert.equal(alternateImage2.plan.provider.id, "future-image-provider");
assert.equal(alternateImage2.plan.provider.adapter.projectionKey, "image2.text-to-image.v1");
assert.equal(alternateImage2.plan.execution.status, "ready_for_isolated_provider_execution");
const changedPlans = [
  planFor({ sample: textSample }).plan,
  planFor({ sample: styleSample }).plan,
  planFor({ sample: patternSample }).plan,
  image2.plan,
  alternateImage2.plan,
  planFor({ capability: capabilityFor("capability:nano:changed", executionFixtures.profiles.nanoBanana2.nativeOutputDimensions, { asyncJobs: false }) }).plan,
  planFor({ cost: confirmedCost(101) }).plan
];
for (const plan of changedPlans) assert.notEqual(plan.planHash, happy.plan.planHash);

const coveredArchetypes = new Set();
const coveredStyles = new Set();
const coveredPatterns = new Set();
const baseCoverageSample = designFixtures.cases[0];
for (const pattern of libraries.patterns.entries) {
  const archetypeId = pattern.applicability.archetypes[0];
  const archetype = libraries.archetypes.entries.find((item) => item.id === archetypeId);
  const pageRole = archetype.applicability.pageRoles[0];
  const style = libraries.styles.entries.find((item) => item.applicability.pageRoles.includes(pageRole)) || libraries.styles.entries[0];
  const sample = structuredClone(baseCoverageSample);
  sample.id = `05k-coverage-${pattern.id}`;
  sample.input.xhsPostPackage.data.deck.pages[1].role = pageRole;
  sample.selection.stylePackId = style.id;
  sample.selection.pages[1] = { pageId: "P2", archetypeId, patternIds: [pattern.id], referenceAssetIds: [] };
  const invocation = invokeDesignXhsIntegratedPages(adaptEvaluationCase(sample));
  const binding = invocation.assetBindings.find((item) => item.pageId === "P2");
  assert.equal(binding.archetype.id, archetypeId);
  assert.equal(binding.stylePack.id, style.id);
  assert.equal(binding.patterns[0].id, pattern.id);
  coveredArchetypes.add(archetypeId);
  coveredStyles.add(style.id);
  coveredPatterns.add(pattern.id);
}
for (const sample of [designFixtures.cases[0], designFixtures.cases[1], designFixtures.cases[2]]) {
  const invocation = invokeDesignXhsIntegratedPages(adaptEvaluationCase(sample));
  invocation.assetBindings.forEach((binding) => {
    coveredArchetypes.add(binding.archetype.id);
    coveredStyles.add(binding.stylePack.id);
    binding.patterns.forEach((item) => coveredPatterns.add(item.id));
  });
}
assert.equal(coveredArchetypes.size, 6);
assert.equal(coveredStyles.size, 3);
assert.equal(coveredPatterns.size, 15);

for (const contract of ["IntegratedPageExecutionPlan.md", "IntegratedPageEligibilityDecision.md"]) {
  const text = readFileSync(join(appRoot, "contracts", contract), "utf8");
  assert.match(text, /schemaVersion/);
  assert.match(text, /上游/);
  assert.match(text, /回退/);
}

console.log(JSON.stringify({
  status: "passed",
  planHash: happy.plan.planHash,
  archetypes: coveredArchetypes.size,
  stylePacks: coveredStyles.size,
  promptPatterns: coveredPatterns.size,
  providerProfiles: Object.keys(executionFixtures.profiles),
  blockerScenarios: blockedScenarios.length + 1,
  hashMutationCases: changedPlans.length,
  nativeDimensionStatus: selectable.providerNativeDimensionStatus,
  finalDeliveryDimensionStatus: selectable.finalDeliveryDimensionStatus,
  eligibleStage: selectable.eligibleStage,
  networkCalls: 0,
  providerCalls: 0,
  retries: 0,
  cost: 0,
  databaseWrites: 0,
  productionEligible: false
}, null, 2));
