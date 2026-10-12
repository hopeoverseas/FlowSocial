import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { invokeDesignXhsIntegratedPages } from "../../skills/design-xhs-integrated-pages/scripts/invoke-skill.mjs";
import { validatePagePromptSpec } from "../../skills/design-xhs-integrated-pages/scripts/runtime-compiler.mjs";
import {
  buildSkillDrivenPreflight,
  build05NFullDeckPreflight,
  executeApprovedPreflight,
  execute05NFullDeckPlan,
  execute05MRecovery,
  normalizeProviderArtifact,
  prepare05MRecovery,
  prior05MOutputDir,
  fullDeckPlanPath,
  fullDeckLiveSummaryPath,
  fullDeckOfficialPreflightPath,
  fullDeckPreflightConsumptionLedgerPath,
  p9RecoverySummaryPath,
  fullDeckFixturePath,
  loadConfig,
  promptReviewPath,
  recoveryOutputDir,
  configure05NRecoveryOutputDir,
  runDryRun,
  run05NFullDeckDryRun,
  run05NFullDeckLive,
  run05NP9RecoveryLive,
  run05NSelectedRecoveryLive,
  run05NFullDeckOfficialPreflight,
  parseCliArguments,
  verifyOfficialEvidence,
  fetchSystemCurlText,
  sanitizeEvidence,
  validateIsolation,
  validate05NFullDeckSemanticRouting,
  verify05MRecoveryEvidence
} from "../live/xhs-integrated-page-skill-live.mjs";

const fixedNow = "2026-08-04T08:00:00.000Z";
const authoritativeRecoveryOutputDir = recoveryOutputDir;
const authoritativeEvidence = ["full-deck-offline-plan.json", "full-deck-live-summary.json", "p2.native.png", "p3.native.png", "p5.native.png", "p6.native.png", "p7.native.png", "p8.native.png"].map((name) => {
  const path = resolve(authoritativeRecoveryOutputDir, name);
  return { path, bytes: existsSync(path) ? readFileSync(path) : null };
});
configure05NRecoveryOutputDir(resolve(authoritativeRecoveryOutputDir, "..", "fs-v1-xhs-visual-05n-self-test"));
const originalFetch = globalThis.fetch;
let accidentalNetworkCalls = 0;
globalThis.fetch = async () => {
  accidentalNetworkCalls += 1;
  throw new Error("OFFLINE_SELF_TEST_NETWORK_FORBIDDEN");
};

try {
  assert.equal(validateIsolation(), true);
  const dryRun = runDryRun({ now: fixedNow });
  assert.equal(accidentalNetworkCalls, 0);
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(dryRun.source.allowedInput, "deck-spec.json only");
  assert.deepEqual(dryRun.source.forbiddenSiblingInputs, ["html", "css", "deterministic_png"]);
  assert.match(dryRun.source.fileSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(dryRun.pages.map((page) => page.pageId), ["P1", "P5", "P9"]);
  assert.deepEqual(dryRun.pages.map((page) => [page.sourcePageRole, page.runtimePageRole]), [["cover", "cover"], ["content", "problem"], ["content", "cta"]]);
  assert.deepEqual(dryRun.pages.map((page) => page.truth.pageRole), ["cover", "problem", "cta"]);
  assert.deepEqual(dryRun.pages.map((page) => page.archetypeRef.id), ["cover.promise", "explanation.concept-map", "summary.cta"]);
  assert.deepEqual(dryRun.pages.map((page) => page.patternRefs.map((item) => item.id)), [["pattern.hierarchy.promise-focus"], ["pattern.map.hub-spokes"], ["pattern.cta.single-action"]]);
  assert.ok(dryRun.pages.every((page) => page.stylePackRef.id === "editorial-metaphor"));
  assert.ok(dryRun.pages.every((page) => /^[a-f0-9]{64}$/.test(page.truthHash) && /^[a-f0-9]{64}$/.test(page.sourcePageHash)));
  assert.equal(dryRun.pages[0].truth.headline, "AI数智官落地前，先看这3个问题");
  assert.deepEqual(dryRun.pages[0].truth.supportingText, ["企业资料、业务场景、协作流程"]);
  assert.equal(dryRun.pages[1].truth.headline, "你的企业准备好了吗？");
  assert.deepEqual(dryRun.pages[1].truth.supportingText, ["有可用资料吗？场景明确吗？协作顺畅吗？"]);
  assert.equal(dryRun.pages[2].truth.headline, "下一步行动");
  assert.equal(dryRun.pages[2].truth.cta, "私信回复「诊断清单」\n领取AI数智官落地自检表");
  assert.ok(dryRun.pages.every((page) => page.requestMaterialization === "blocked_pending_controller_prompt_review"));
  assert.ok(dryRun.pages.every((page) => page.requestFields.join(",") === "model,input.prompt,input.aspect_ratio,input.resolution"));
  assert.ok(dryRun.pages.every((page) => page.requestSummary.model === "gpt-image-2-text-to-image" && page.requestSummary.candidates === 1));
  assert.ok(dryRun.pages.every((page) => page.providerPrompt.includes("整套共享同一创意世界和品牌识别锚点") && page.providerPrompt.includes("逐字真值")));
  assert.ok(dryRun.pages.every((page) => page.providerPrompt.includes("每页媒介与构图可随内容变化") && !page.providerPrompt.includes("酒红、暖白、炭黑")));
  const antiTemplateConstraints = ["整页必须像完成的原创编辑设计海报，保持纸面编辑设计与单一隐喻", "禁止网页、UI、仪表盘、组件库、卡片式信息面板、HTML/CSS 截图感", "不得让矩形卡片成为主构图"];
  const audienceSafeAntiTemplateConstraints = ["整页必须像完成的原创编辑设计海报，保持纸面编辑设计与单一隐喻", "禁止网页、界面、仪表盘、组件库、卡片式信息面板、网页排版 截图感", "不得让矩形卡片成为主构图"];
  assert.ok(dryRun.pages.every((page) => antiTemplateConstraints.every((constraint) => page.truth.forbiddenClaims.includes(constraint)) && audienceSafeAntiTemplateConstraints.every((constraint) => page.providerPrompt.includes(constraint))));
  assert.ok(dryRun.pages.every((page) => !/deterministic PNG/i.test(page.providerPrompt)));
  assert.equal(dryRun.plan.status, "blocked");
  assert.notEqual(dryRun.skill.promptSetHash, "2bec63ff1168542686345b870f054f7e44a1324f7cb2e3265792fd0d9f9daf86", "anti-template constraint must change Prompt Set hash");
  assert.equal(dryRun.plan.states.promptReview, "pending");
  assert.equal(dryRun.plan.productionEligible, false);
  assert.equal(dryRun.pages[0].archetypeRef.id, "cover.promise");
  assert.deepEqual(dryRun.boundaries, { featureFlagDefault: false, isolatedExperimentalOverrideForPlan: true, productionEligible: false, actualPaidRequests: 0, networkCalls: 0, providerCalls: 0, automaticRetries: 0, databaseWrites: 0, productionWrites: false, userSelection: "not_selected", delivery: "not_delivered" });
  assert.equal(dryRun.budget.maxCreditsPerRequest, 8);
  assert.equal(dryRun.budget.maxTotalCredits, 24);
  assert.equal(dryRun.budget.estimatedTotalCredits, 18);
  const persisted = JSON.parse(readFileSync(promptReviewPath, "utf8"));
  assert.equal(persisted.evidenceHash, dryRun.evidenceHash);
  assert.ok(!/Bearer\s+\S+|task[_-][a-z0-9_-]+|resultUrls|rawResponse/i.test(JSON.stringify(persisted)));

  assert.throws(() => buildSkillDrivenPreflight({ prompt: "bypass Skill" }), /LIVE_HARNESS_INPUT_FIELDS:prompt/);
  assert.throws(() => buildSkillDrivenPreflight({ sourcePath: "C:\\tmp\\deck-spec.json" }), /LIVE_HARNESS_INPUT_FIELDS:sourcePath/);
  assert.ok(sanitizeEvidence("Bearer secret task_abcd?token=secret").includes("[REDACTED]"));

  const approval = { schemaVersion: "1.0", decision: "approved", promptSetHash: dryRun.skill.promptSetHash, reviewedBy: "controller-offline-self-test", reviewedAt: "2026-08-04T08:05:00.000Z" };
  const approved = buildSkillDrivenPreflight({ now: fixedNow, promptApproval: approval });
  assert.equal(approved.plan.execution.status, "ready_for_isolated_provider_execution");
  assert.equal(approved.plan.productionEligible, false);
  assert.ok(approved.requests.every((item) => item.status === "materialized_from_skill_plan"));
  assert.ok(approved.requests.every((item, index) => item.request.body.input.prompt === approved.plan.pages[index].providerRequest.body.input.prompt));
  assert.ok(approved.requests.every((item) => audienceSafeAntiTemplateConstraints.every((constraint) => item.request.body.input.prompt.includes(constraint))));
  assert.ok(approved.requests.every((item) => Object.keys(item.request.body.input).sort().join(",") === "aspect_ratio,prompt,resolution"));
  const tamperedApproval = { ...approval, promptSetHash: "0".repeat(64) };
  assert.throws(() => buildSkillDrivenPreflight({ now: fixedNow, promptApproval: tamperedApproval }), /PROMPT_HASH_MISMATCH/);
  const tamperedRequestPreflight = structuredClone(approved);
  tamperedRequestPreflight.requests[0].request.body.input.prompt = "independent provider prompt";
  await assert.rejects(() => executeApprovedPreflight({ preflight: tamperedRequestPreflight }), /INDEPENDENT_PROVIDER_REQUEST_FORBIDDEN:P1/);
  const weakenedConstraintPreflight = structuredClone(approved);
  weakenedConstraintPreflight.invocation.promptSet.pagePromptSpecs[0].promptBlocks.negativeConstraints = weakenedConstraintPreflight.invocation.promptSet.pagePromptSpecs[0].promptBlocks.negativeConstraints.filter((item) => item !== antiTemplateConstraints[1]);
  assert.notEqual(stableHash(weakenedConstraintPreflight.invocation.promptSet), approved.invocation.promptSetHash);
  await assert.rejects(() => executeApprovedPreflight({ preflight: weakenedConstraintPreflight }), /SKILL_PROMPT_SET_HASH_MISMATCH/);

  const normalizedProbe = normalizeProviderArtifact("SELFTEST", solidRgbaPng(3, 4), { createdAt: fixedNow });
  assert.deepEqual(normalizedProbe.nativeAsset.dimensions, { width: 3, height: 4 });
  assert.equal(normalizedProbe.providerNativeDimensionStatus, "failed");
  assert.equal(normalizedProbe.normalizationStatus, "succeeded");
  assert.equal(normalizedProbe.finalCanvasStatus, "passed");
  assert.deepEqual(normalizedProbe.normalizedAsset.dimensions, { width: 1080, height: 1440 });
  assert.equal(normalizedProbe.normalizationEvidence.mode, "resample");
  assert.equal(normalizedProbe.normalizationEvidence.scale.uniform, true);
  assert.equal(normalizedProbe.normalizationEvidence.crop, null);
  assert.equal(normalizedProbe.normalizationEvidence.pad, null);

  const official = async (config) => ({ verified: true, model: config.providerProfile.model, projectionKey: config.providerProfile.adapter.projectionKey, estimatedCreditsPerRequest: config.providerProfile.estimatedCostPerCandidate });
  const artifact = async (pageId, bytes) => ({ nativeAsset: { filename: `${pageId}.native.png`, sha256: "a".repeat(64), bytes: bytes.length, dimensions: { width: 1086, height: 1448 } }, normalizedAsset: { filename: `${pageId}.normalized.png`, sha256: "b".repeat(64), bytes: bytes.length, dimensions: { width: 1080, height: 1440 } }, providerNativeDimensionStatus: "failed", normalizationStatus: "succeeded", finalCanvasStatus: "passed", normalizationEvidence: { mode: "resample", recordHash: "c".repeat(64), scale: { x: 1, y: 1, uniform: true }, crop: null, pad: null }, blocker: null });
  const successCalls = [];
  const successCredits = [100, 94, 94, 88, 88, 82];
  const success = await executeApprovedPreflight({ preflight: approved, operations: {
    verifyOfficialProfile: official,
    credits: async () => successCredits.shift(),
    createTask: async (_key, request) => { successCalls.push(request); return `task-${successCalls.length}`; },
    pollTask: async () => ({ state: "success" }),
    downloadResult: async () => Buffer.from("offline-png-fixture"),
    persistArtifact: artifact
  } });
  assert.equal(success.actualPaidRequests, 3);
  assert.equal(success.actualCredits, 18);
  assert.equal(success.stoppedBy, null);
  assert.equal(successCalls.length, 3);
  assert.deepEqual(successCalls, approved.requests.map((item) => item.request));
  assert.ok(success.records.every((item) => item.providerStatus === "succeeded" && item.providerNativeDimensionStatus === "failed" && item.normalizationStatus === "succeeded" && item.finalCanvasStatus === "passed" && item.costStatus === "measured" && item.productionEligible === false));
  assert.ok(success.records.every((item) => item.ocr === "not_run" && item.fact === "not_run" && item.visual === "not_run" && item.manualAesthetic === "not_run"));

  let createCalls = 0;
  const preCostStop = await executeApprovedPreflight({ preflight: approved, operations: { verifyOfficialProfile: official, credits: async () => { throw new Error("cost offline"); }, createTask: async () => { createCalls += 1; }, persistArtifact: artifact } });
  assert.equal(preCostStop.actualPaidRequests, 0);
  assert.equal(createCalls, 0);
  assert.match(preCostStop.stoppedBy, /^PRE_CALL_COST_QUERY_FAILED/);

  let postCreditCalls = 0;
  const postCostStop = await executeApprovedPreflight({ preflight: approved, operations: {
    verifyOfficialProfile: official,
    credits: async () => { postCreditCalls += 1; if (postCreditCalls === 1) return 100; throw new Error("post cost unavailable"); },
    createTask: async () => "task-post",
    pollTask: async () => ({}),
    downloadResult: async () => Buffer.from("offline-png-fixture"),
    persistArtifact: artifact
  } });
  assert.equal(postCostStop.actualPaidRequests, 1);
  assert.equal(postCostStop.records.length, 1);
  assert.match(postCostStop.stoppedBy, /^POST_CALL_COST_QUERY_FAILED/);

  let providerCreateCalls = 0;
  const providerStop = await executeApprovedPreflight({ preflight: approved, operations: {
    verifyOfficialProfile: official,
    credits: async () => 100,
    createTask: async () => { providerCreateCalls += 1; throw new Error("provider failed"); },
    persistArtifact: artifact
  } });
  assert.equal(providerCreateCalls, 1);
  assert.equal(providerStop.actualPaidRequests, 1);
  assert.equal(providerStop.records.length, 1);
  assert.match(providerStop.stoppedBy, /^PROVIDER_STOP/);

  let normalizationCreateCalls = 0;
  const normalizationCredits = [100, 94];
  const normalizationStop = await executeApprovedPreflight({ preflight: approved, operations: {
    verifyOfficialProfile: official,
    credits: async () => normalizationCredits.shift(),
    createTask: async () => { normalizationCreateCalls += 1; return "opaque-normalization-handle"; },
    pollTask: async () => ({}),
    downloadResult: async () => Buffer.from("invalid-png"),
    persistArtifact: async (pageId, bytes) => normalizeProviderArtifact(pageId, bytes, { createdAt: fixedNow })
  } });
  assert.equal(normalizationCreateCalls, 1);
  assert.equal(normalizationStop.actualPaidRequests, 1);
  assert.equal(normalizationStop.records.length, 1);
  assert.equal(normalizationStop.records[0].providerStatus, "succeeded");
  assert.equal(normalizationStop.records[0].normalizationStatus, "blocked");
  assert.equal(normalizationStop.records[0].finalCanvasStatus, "blocked");
  assert.match(normalizationStop.stoppedBy, /^NORMALIZATION_FAILED/);
  assert.equal(normalizationStop.records[0].ocr, "not_run");

  let overCostQueries = 0;
  const overCostStop = await executeApprovedPreflight({ preflight: approved, operations: {
    verifyOfficialProfile: official,
    credits: async () => (++overCostQueries === 1 ? 100 : 91),
    createTask: async () => "task-over",
    pollTask: async () => ({}),
    downloadResult: async () => Buffer.from("offline-png-fixture"),
    persistArtifact: artifact
  } });
  assert.equal(overCostStop.actualPaidRequests, 1);
  assert.equal(overCostStop.records[0].actualCredits, 9);
  assert.equal(overCostStop.stoppedBy, "ACTUAL_CREDITS_PER_REQUEST_EXCEEDED");

  let officialCreateCalls = 0;
  const officialStop = await executeApprovedPreflight({ preflight: approved, operations: { verifyOfficialProfile: async () => { throw new Error("official unavailable"); }, createTask: async () => { officialCreateCalls += 1; } } });
  assert.equal(officialStop.actualPaidRequests, 0);
  assert.equal(officialCreateCalls, 0);
  assert.match(officialStop.stoppedBy, /^OFFICIAL_PREFLIGHT_FAILED/);

  const recovery = prepare05MRecovery({ createdAt: fixedNow });
  assert.equal(recovery.evidence.p1.reused_existing_provider_asset, true);
  assert.equal(recovery.evidence.p1.additionalProviderCalls, 0);
  assert.deepEqual(recovery.evidence.p1.nativeAsset.dimensions, { width: 1086, height: 1448 });
  assert.equal(recovery.evidence.p1.nativeAsset.bitDepth, 8);
  assert.equal(recovery.evidence.p1.nativeAsset.colorType, 2);
  assert.deepEqual(recovery.evidence.p1.normalizedAsset.dimensions, { width: 1080, height: 1440 });
  assert.equal(recovery.evidence.p1.normalization.scale.uniform, true);
  assert.equal(recovery.evidence.p1.normalization.crop, null);
  assert.equal(recovery.evidence.p1.normalization.pad, null);
  assert.equal(existsSync(resolve(recoveryOutputDir, "p1.normalized.png")), true);
  const priorRun = JSON.parse(readFileSync(resolve(prior05MOutputDir, "run-summary.json"), "utf8"));
  const priorP1 = JSON.parse(readFileSync(resolve(prior05MOutputDir, "p1.evaluation.json"), "utf8"));
  const priorBytes = readFileSync(resolve(prior05MOutputDir, "p1.native.png"));
  assert.throws(() => verify05MRecoveryEvidence({ runSummary: { ...priorRun, promptSetHash: "0".repeat(64) }, p1Evaluation: priorP1, nativeBytes: priorBytes, preflight: recovery.preflight }), /05M_RUN_SUMMARY_IDENTITY_MISMATCH/);
  assert.throws(() => verify05MRecoveryEvidence({ runSummary: priorRun, p1Evaluation: { ...priorP1, requestHash: "0".repeat(64) }, nativeBytes: priorBytes, preflight: recovery.preflight }), /05M_P1_EVALUATION_MISMATCH/);
  const recoveryCalls = [];
  const recoveryCredits = [100, 94, 94, 88];
  const recovered = await execute05MRecovery({ recovery, operations: {
    verifyOfficialProfile: official,
    credits: async () => recoveryCredits.shift(),
    createTask: async (_key, request) => { recoveryCalls.push(stableHash(request)); return `opaque-${recoveryCalls.length}`; },
    pollTask: async () => ({}), downloadResult: async () => Buffer.from("offline"), persistArtifact: artifact
  } });
  assert.equal(recovered.actualPaidRequests, 2);
  assert.equal(recovered.p1AdditionalProviderCalls, 0);
  assert.deepEqual(recovered.records.map((item) => item.pageId), ["P5", "P9"]);
  assert.deepEqual(recoveryCalls, recovery.evidence.pendingPages.map((item) => item.requestHash));
  assert.ok(!recovered.records.some((item) => item.pageId === "P1"));
  let stoppedRecoveryCalls = 0;
  const stoppedRecovery = await execute05MRecovery({ recovery, operations: {
    verifyOfficialProfile: official, credits: async () => 100,
    createTask: async () => { stoppedRecoveryCalls += 1; throw new Error("first recovery page failed"); }, persistArtifact: artifact
  } });
  assert.equal(stoppedRecoveryCalls, 1);
  assert.deepEqual(stoppedRecovery.records.map((item) => item.pageId), ["P5"]);
  assert.match(stoppedRecovery.stoppedBy, /^RECOVERY_STOP/);

  const fullDryRun = run05NFullDeckDryRun({ now: fixedNow });
  assert.equal(existsSync(fullDeckPlanPath), true);
  const persistedFullPlan = JSON.parse(readFileSync(fullDeckPlanPath, "utf8"));
  assert.equal(persistedFullPlan.boundaries.providerCalls, 0);
  assert.ok(persistedFullPlan.pages.every((page) => typeof page.semanticRationale === "string" && page.crossPageDnaBound === true && page.antiTemplateConstraintsBound === true));
  assert.deepEqual(fullDryRun.evidence.pages.map((page) => page.pageId), ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
  assert.deepEqual(fullDryRun.evidence.pages.map((page) => page.stylePackRef.id), ["editorial-metaphor", "editorial-metaphor", "editorial-metaphor", "editorial-metaphor", "editorial-metaphor", "friendly-handdrawn-tech", "editorial-metaphor", "editorial-metaphor", "editorial-metaphor"]);
  assert.deepEqual(fullDryRun.evidence.pages.map((page) => page.archetypeRef.id), ["cover.promise", "explanation.concept-map", "explanation.concept-map", "explanation.concept-map", "explanation.concept-map", "process.vertical-steps", "list.key-points", "summary.cta", "summary.cta"]);
  assert.ok(fullDryRun.evidence.pages.every((page) => antiTemplateConstraints.every((constraint) => page.truth.forbiddenClaims.includes(constraint)) && audienceSafeAntiTemplateConstraints.every((constraint) => page.providerPrompt.includes(constraint))));
  assert.equal(fullDryRun.evidence.budget.previousPaidRequests, 1);
  assert.equal(fullDryRun.evidence.budget.maxNewProviderCalls, 8);
  assert.equal(fullDryRun.evidence.budget.maxNewCredits, 64);
  assert.equal(fullDryRun.evidence.budget.maxTotalCreditsIncludingPrior, 67);
  assert.deepEqual(fullDryRun.evidence.pages.map((page) => page.runtimePageRole), ["cover", "problem", "evidence", "problem", "problem", "method", "evidence", "summary", "cta"]);
  assert.ok(fullDryRun.evidence.pages.every((page) => typeof page.semanticRationale === "string" && page.semanticRationale.length > 0));
  assert.ok(fullDryRun.evidence.pages.every((page) => ["全套保持纸面编辑设计、酒红/炭黑/暖白色彩", "主标题、正文和行动提示", "方法页", "视觉规范"].every((term) => page.providerPrompt.includes(term))));
  const fullConfig = loadConfig(fullDeckFixturePath, ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
  const semanticDrift = structuredClone(fullConfig); semanticDrift.selectedPages.find((page) => page.pageId === "P6").runtimePageRole = "case";
  assert.throws(() => validate05NFullDeckSemanticRouting(semanticDrift), /05N_SEMANTIC_ROLE_MISMATCH:P6/);
  const fullApproval = { schemaVersion: "1.0", decision: "approved", promptSetHash: fullDryRun.invocation.promptSetHash, reviewedBy: "controller-offline-self-test", reviewedAt: fixedNow };
  const fullApproved = build05NFullDeckPreflight({ now: fixedNow, promptApproval: fullApproval });
  assert.equal(fullApproved.plan.execution.status, "ready_for_isolated_provider_execution");
  assert.equal(fullApproved.requests.length, 9);
  const p6 = fullApproved.invocation.promptSet.pagePromptSpecs.find((page) => page.pageId === "P6");
  assert.equal(p6.contentTruth.pageRole, "method");
  assert.equal(p6.schemaVersion, "1.1");
  assert.equal(p6.stylePackId, "friendly-handdrawn-tech");
  assert.deepEqual(p6.semanticAuxiliaryStyle, { adapter: "semantic_auxiliary_style@1.0", primaryStylePackId: "editorial-metaphor", auxiliaryStylePackId: "friendly-handdrawn-tech", requiredPageRole: "method", designDnaPreserved: true, antiTemplateConstraintsPreserved: true });
  assert.equal(p6.pageArchetypeId, "process.vertical-steps");
  assert.deepEqual(p6.promptPatternIds, ["pattern.process.numbered-spine", "pattern.process.phase-bands"]);
  const legacyP1 = fullApproved.invocation.promptSet.pagePromptSpecs.find((page) => page.pageId === "P1");
  assert.equal(legacyP1.schemaVersion, "1.0");
  assert.equal(validatePagePromptSpec(legacyP1, { strictExpectedTextHash: true }), true);
  assert.equal(validatePagePromptSpec(p6, { strictExpectedTextHash: true }), true);
  const v10WithAuxiliaryField = { ...legacyP1, stylePackId: "friendly-handdrawn-tech" };
  assert.throws(() => validatePagePromptSpec(v10WithAuxiliaryField), /PagePromptSpec:FIELDS/);
  const v11MissingAdapter = structuredClone(p6); delete v11MissingAdapter.semanticAuxiliaryStyle;
  assert.throws(() => validatePagePromptSpec(v11MissingAdapter), /PagePromptSpec:FIELDS/);
  const versionMismatch = structuredClone(p6); versionMismatch.schemaVersion = "1.0";
  assert.throws(() => validatePagePromptSpec(versionMismatch), /PAGE_PROMPT_SPEC_IDENTITY_INVALID/);
  const tamperedAdapter = structuredClone(p6); tamperedAdapter.semanticAuxiliaryStyle.requiredPageRole = "case";
  assert.throws(() => validatePagePromptSpec(tamperedAdapter), /PAGE_PROMPT_SPEC_AUXILIARY_ADAPTER_INVALID/);
  const impermissibleDrift = structuredClone(fullApproved.runtimeInput);
  impermissibleDrift.visualSelection.pages.find((page) => page.pageId === "P5").stylePackId = "friendly-handdrawn-tech";
  const driftInvocation = invokeDesignXhsIntegratedPages(impermissibleDrift);
  assert.equal(driftInvocation.promptSet.status, "blocked");
  assert.ok(driftInvocation.promptSet.blockers.some((item) => item.code === "CROSS_PAGE_STYLE_DRIFT" && item.pageId === "P5"));
  await assert.rejects(() => execute05NFullDeckPlan({ preflight: fullApproved, operations: {} }), /05N_FULL_DECK_P1_REUSE_EVIDENCE_REQUIRED/);
  const fullCalls = [];
  const fullCredits = [100, 94, 94, 88, 88, 82, 82, 76, 76, 70, 70, 64, 64, 58, 58, 52];
  const fullResult = await execute05NFullDeckPlan({ preflight: fullApproved, recovery, operations: {
    verifyOfficialProfile: official, credits: async () => fullCredits.shift(),
    createTask: async (_key, request) => { fullCalls.push(request); return `opaque-full-${fullCalls.length}`; },
    pollTask: async () => ({}), downloadResult: async () => Buffer.from("offline"), persistArtifact: artifact
  } });
  assert.deepEqual(fullResult.records.map((item) => item.pageId), ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
  assert.deepEqual(fullCalls, fullApproved.requests.slice(1).map((item) => item.request));
  assert.equal(fullResult.actualNewProviderCalls, 8);
  assert.equal(fullResult.actualNewCredits, 48);
  assert.equal(fullResult.totalCreditsIncludingPrior, 51);
  assert.equal(fullResult.stoppedBy, null);
  assert.equal(fullResult.records[0].reused_existing_provider_asset, true);
  let fullFailureCalls = 0;
  const fullFailure = await execute05NFullDeckPlan({ preflight: fullApproved, recovery, operations: {
    verifyOfficialProfile: official, credits: async () => 100,
    createTask: async () => { fullFailureCalls += 1; throw new Error("P2 failed"); }, pollTask: async () => ({}), downloadResult: async () => Buffer.from("offline"), persistArtifact: artifact
  } });
  assert.equal(fullFailureCalls, 1);
  assert.deepEqual(fullFailure.records.map((item) => item.pageId), ["P1", "P2"]);
  assert.match(fullFailure.stoppedBy, /^FULL_DECK_STOP/);

  const controllerApprovalFile = "controller-full-deck-self-test.json";
  writeFileSync(resolve(recoveryOutputDir, controllerApprovalFile), `${JSON.stringify(fullApproval)}\n`, "utf8");
  const evidenceConfig = fullApproved.config;
  const evidencePass = await verifyOfficialEvidence(evidenceConfig, { fetchTextOperation: async (url) => {
    if (url === evidenceConfig.officialEvidence.documentationUrl) return "gpt-image-2";
    if (url === evidenceConfig.officialEvidence.pricingUrl) return `price ${evidenceConfig.officialEvidence.priceUsdPerImage}`;
    return `credit ${evidenceConfig.officialEvidence.creditUsd}`;
  } });
  assert.equal(evidencePass.verified, true);
  await assert.rejects(() => verifyOfficialEvidence(evidenceConfig, { fetchTextOperation: async (url) => { if (url === evidenceConfig.officialEvidence.pricingUrl) { const error = new Error("fetch failed"); error.cause = { code: "ECONNRESET" }; throw error; } return "gpt-image-2 0.03 0.005"; } }), /OFFICIAL_EVIDENCE_FETCH_FAILED:pricing:ECONNRESET/);
  const curlCalls = [];
  const curlEvidence = await verifyOfficialEvidence(evidenceConfig, { transport: "system_curl", spawnOperation: (command, args, options) => {
    curlCalls.push({ command, args, options });
    const url = args.at(-1);
    const body = url === evidenceConfig.officialEvidence.documentationUrl ? "gpt-image-2" : url === evidenceConfig.officialEvidence.pricingUrl ? "price 0.03" : "credit 0.005";
    return { status: 0, stdout: Buffer.from(`${body}\n200`, "utf8") };
  } });
  assert.equal(curlEvidence.verified, true);
  assert.ok(Object.values(curlEvidence.evidence).every((item) => item.transport === "system_curl" && item.bytes > 0));
  assert.equal(curlCalls.length, 3);
  assert.ok(curlCalls.every(({ command, args, options }) => command === "curl.exe" && args.includes("-L") && args.includes("--max-time") && args.includes("30") && args.includes("--proto") && args.includes("=https") && options.maxBuffer > 1_000_000));
  assert.throws(() => fetchSystemCurlText(evidenceConfig.officialEvidence.documentationUrl, { spawnOperation: () => ({ error: { code: "ENOENT" } }) }), /SYSTEM_CURL_UNAVAILABLE:ENOENT/);
  assert.throws(() => fetchSystemCurlText(evidenceConfig.officialEvidence.documentationUrl, { spawnOperation: () => ({ status: 28, stdout: Buffer.alloc(0) }) }), /SYSTEM_CURL_FAILED:EXIT_28/);
  assert.throws(() => fetchSystemCurlText(evidenceConfig.officialEvidence.documentationUrl, { spawnOperation: () => ({ status: 0, stdout: Buffer.from("unavailable\n503") }) }), /SYSTEM_CURL_HTTP_503/);
  let forbiddenNodeFallbacks = 0;
  await assert.rejects(() => verifyOfficialEvidence(evidenceConfig, { transport: "system_curl", fetchTextOperation: async () => { forbiddenNodeFallbacks += 1; return "gpt-image-2 0.03 0.005"; }, spawnOperation: () => ({ status: 28, stdout: Buffer.alloc(0) }) }), /OFFICIAL_EVIDENCE_FETCH_FAILED:documentation:SYSTEM_CURL_FAILED:EXIT_28/);
  assert.equal(forbiddenNodeFallbacks, 0);
  const freshVerifiedAt = new Date().toISOString();
  const officialRecoveryPass = await run05NFullDeckOfficialPreflight({ approvalFile: controllerApprovalFile, transport: "system_curl", verifiedAt: freshVerifiedAt, operations: { verifyOfficialProfile: async (_config, options) => { assert.equal(options.transport, "system_curl"); return curlEvidence; } } });
  assert.equal(officialRecoveryPass.officialProfile, "passed");
  assert.equal(officialRecoveryPass.providerCalls, 0);
  assert.equal(officialRecoveryPass.paidCalls, 0);
  assert.equal(officialRecoveryPass.apiKeyLoaded, false);
  assert.match(officialRecoveryPass.verifiedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(Object.keys(officialRecoveryPass.officialEvidence).sort(), ["credit", "documentation", "pricing"]);
  assert.equal(officialRecoveryPass.transport, "system_curl");
  assert.ok(Object.values(officialRecoveryPass.officialEvidence).every((item) => /^https:\/\//.test(item.url) && /^[a-f0-9]{64}$/.test(item.contentSha256) && Number.isInteger(item.bytes) && item.transport === "system_curl"));
  const credentialSnapshotHash = (value) => stableHash({ planHash: value.planHash, invocationHash: value.invocationHash, promptSetHash: value.promptSetHash, approvalHash: value.approvalHash, verifiedAt: value.verifiedAt, transport: value.transport, officialEvidence: value.officialEvidence, officialProfile: value.officialProfile, failure: value.failure, providerCalls: value.providerCalls, paidCalls: value.paidCalls, automaticRetries: value.automaticRetries, apiKeyLoaded: value.apiKeyLoaded, productionWrites: value.productionWrites });
  const wrapperCalls = [];
  const wrapperCredits = [100, 94, 94, 88, 88, 82, 82, 76, 76, 70, 70, 64, 64, 58, 58, 52];
  const wrapperSummary = await run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "full-deck-official-preflight.json", apiKey: "offline-wrapper-key", operations: {
    verifyOfficialProfile: official,
    credits: async () => { const consumed = JSON.parse(readFileSync(fullDeckOfficialPreflightPath, "utf8")); assert.ok(consumed.consumedAt && /^[a-f0-9]{32}$/.test(consumed.consumerRunNonce)); return wrapperCredits.shift(); },
    createTask: async (_key, request) => { wrapperCalls.push(request); return `task-wrapper-${wrapperCalls.length}`; },
    pollTask: async () => ({ state: "success" }),
    downloadResult: async () => solidRgbaPng(30, 40)
  } });
  assert.equal(wrapperSummary.mode, "isolated-full-deck-live");
  assert.equal(wrapperSummary.actualNewProviderCalls, 8);
  assert.equal(wrapperSummary.actualNewCredits, 48);
  assert.equal(wrapperSummary.totalCreditsIncludingPrior, 51);
  assert.equal(wrapperSummary.automaticRetries, 0);
  assert.equal(wrapperSummary.productionWrites, false);
  assert.deepEqual(wrapperCalls, fullApproved.requests.slice(1).map((item) => item.request));
  assert.deepEqual(wrapperSummary.records.map((item) => item.pageId), ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
  assert.equal(wrapperSummary.records[0].reusedExistingProviderAsset, true);
  assert.equal(wrapperSummary.records[0].additionalProviderCalls, 0);
  assert.equal(wrapperSummary.officialPreflight.snapshotHash, officialRecoveryPass.snapshotHash);
  assert.ok(wrapperSummary.officialPreflight.consumedAt);
  assert.match(wrapperSummary.officialPreflight.consumerRunNonce, /^[a-f0-9]{32}$/);
  assert.ok(JSON.parse(readFileSync(fullDeckPreflightConsumptionLedgerPath, "utf8")).consumed.some((entry) => entry.snapshotHash === officialRecoveryPass.snapshotHash));
  assert.ok(wrapperSummary.records.slice(1).every((item) => item.provider === "succeeded" && item.providerNativeDimensions === "failed" && item.normalization === "succeeded" && item.finalCanvas === "passed"));
  assert.ok(wrapperSummary.records.every((item) => item.ocr === "not_run" && item.fact === "not_run" && item.visual === "not_run" && item.manualAesthetic === "not_run" && item.userSelection === "not_selected" && item.delivery === "not_delivered"));
  const persistedWrapperSummary = readFileSync(fullDeckLiveSummaryPath, "utf8");
  assert.doesNotMatch(persistedWrapperSummary, /offline-wrapper-key|task-wrapper|resultUrls|Bearer\s+/i);
  const selectedRecoveryApprovalFile = "controller-selected-recovery-self-test.json";
  const selectedRecoveryApproval = { schemaVersion: "1.0", contract: "XhsIntegratedPage05NSelectedRecoveryApproval@1.0", decision: "approved", pages: [{ pageId: "P4", allowCreateTask: true }, { pageId: "P9", allowCreateTask: false }], promptSetHash: fullApproved.invocation.promptSetHash, invocationHash: fullApproved.invocation.invocationHash, approvalHash: stableHash(fullApproval), maxNewProviderCalls: 1, maxNewCredits: 8, automaticRetries: 0, reviewedBy: "controller-offline-self-test", reviewedAt: fixedNow, consumedAt: null, consumerRunNonce: null };
  writeFileSync(resolve(recoveryOutputDir, selectedRecoveryApprovalFile), `${JSON.stringify(selectedRecoveryApproval)}\n`, "utf8");
  const selectedCreateCalls = []; const selectedCredits = [100, 94];
  const selectedRecovery = await run05NSelectedRecoveryLive({ approvalFile: controllerApprovalFile, recoveryApprovalFile: selectedRecoveryApprovalFile, apiKey: "offline-wrapper-key", operations: { credits: async () => selectedCredits.shift(), createTask: async (_key, request) => { selectedCreateCalls.push(request); return "task-p4-correction"; }, pollTask: async () => ({ state: "success" }), downloadResult: async () => solidRgbaPng(30, 40) } });
  assert.deepEqual(selectedRecovery.pages, ["P4", "P9"]);
  assert.equal(selectedRecovery.newProviderCalls, 1); assert.equal(selectedRecovery.newCredits, 6);
  assert.equal(selectedCreateCalls.length, 1);
  assert.ok(selectedCreateCalls[0].body.input.prompt.includes("误区二：AI智能体可以一步到位？"));
  assert.deepEqual(selectedRecovery.records.map((item) => item.pageId), ["P4", "P9"]);
  assert.ok(selectedRecovery.records.every((item) => item.ocr === "not_run" && item.visual === "not_run"));
  await assert.rejects(() => run05NSelectedRecoveryLive({ approvalFile: controllerApprovalFile, recoveryApprovalFile: selectedRecoveryApprovalFile, apiKey: "offline-wrapper-key", operations: {} }), /SELECTED_RECOVERY_APPROVAL_INVALID/);
  const sixPageBudgetApproval = { ...selectedRecoveryApproval, pages: ["P2", "P3", "P5", "P6", "P7", "P8"].map((pageId) => ({ pageId, allowCreateTask: true })), maxNewProviderCalls: 6, maxNewCredits: 40, consumedAt: null, consumerRunNonce: null };
  writeFileSync(resolve(recoveryOutputDir, "controller-six-page-invalid-budget.json"), `${JSON.stringify(sixPageBudgetApproval)}\n`, "utf8");
  await assert.rejects(() => run05NSelectedRecoveryLive({ approvalFile: controllerApprovalFile, recoveryApprovalFile: "controller-six-page-invalid-budget.json", apiKey: "offline-wrapper-key", operations: {} }), /SELECTED_RECOVERY_BUDGET_INVALID/);
  const p9RecoveryApprovalFile = "controller-p9-recovery-self-test.json";
  const p9RecoveryApproval = { schemaVersion: "1.0", contract: "XhsIntegratedPage05NP9RecoveryApproval@1.0", decision: "approved", pageId: "P9", promptSetHash: fullApproved.invocation.promptSetHash, invocationHash: fullApproved.invocation.invocationHash, approvalHash: stableHash(fullApproval), allowCreateTask: false, maxNewProviderCalls: 0, maxNewCredits: 0, automaticRetries: 0, reviewedBy: "controller-offline-self-test", reviewedAt: fixedNow, consumedAt: null, consumerRunNonce: null };
  writeFileSync(resolve(recoveryOutputDir, p9RecoveryApprovalFile), `${JSON.stringify(p9RecoveryApproval)}\n`, "utf8");
  let p9RecoveryCreates = 0;
  const p9Recovered = await run05NP9RecoveryLive({ approvalFile: controllerApprovalFile, recoveryApprovalFile: p9RecoveryApprovalFile, apiKey: "offline-wrapper-key", operations: { pollTask: async (_key, taskId) => { assert.equal(typeof taskId, "string"); return { state: "success" }; }, downloadResult: async () => solidRgbaPng(30, 40), createTask: async () => { p9RecoveryCreates += 1; } } });
  assert.equal(p9Recovered.resumedFromCheckpoint, true);
  assert.equal(p9Recovered.record.additionalProviderCalls, 0);
  assert.equal(p9RecoveryCreates, 0);
  assert.equal(existsSync(p9RecoverySummaryPath), true);
  assert.doesNotMatch(readFileSync(p9RecoverySummaryPath, "utf8"), /task-wrapper|offline-wrapper-key/i);
  await assert.rejects(() => run05NP9RecoveryLive({ approvalFile: controllerApprovalFile, recoveryApprovalFile: p9RecoveryApprovalFile, apiKey: "offline-wrapper-key", operations: {} }), /P9_RECOVERY_APPROVAL_INVALID/);
  const p9PlaceholderApprovalFile = "controller-p9-placeholder-self-test.json";
  writeFileSync(resolve(recoveryOutputDir, p9PlaceholderApprovalFile), `${JSON.stringify({ ...p9RecoveryApproval, consumedAt: null, consumerRunNonce: null })}\n`, "utf8");
  writeFileSync(resolve(recoveryOutputDir, "p9.native.png"), Buffer.alloc(75));
  await assert.rejects(() => run05NP9RecoveryLive({ approvalFile: controllerApprovalFile, recoveryApprovalFile: p9PlaceholderApprovalFile, apiKey: "offline-wrapper-key", operations: {} }), /P9_PLACEHOLDER_ARTIFACT_REJECTED/);
  assert.deepEqual(parseCliArguments(["--full-deck-live", "--approval-file", controllerApprovalFile, "--official-preflight-file", "full-deck-official-preflight.json"]), { mode: "full-deck-live", approvalFile: controllerApprovalFile, officialPreflightFile: "full-deck-official-preflight.json" });
  assert.deepEqual(parseCliArguments(["--recover-p9-live", "--approval-file", controllerApprovalFile, "--recovery-approval-file", p9RecoveryApprovalFile]), { mode: "recover-p9-live", approvalFile: controllerApprovalFile, recoveryApprovalFile: p9RecoveryApprovalFile });
  assert.throws(() => parseCliArguments(["--recover-p9-live", "--approval-file", controllerApprovalFile]), /P9_RECOVERY_CLI_REQUIRES_EXACTLY/);
  assert.deepEqual(parseCliArguments(["--recover-selected-pages-live", "--approval-file", controllerApprovalFile, "--recovery-approval-file", selectedRecoveryApprovalFile]), { mode: "recover-selected-pages-live", approvalFile: controllerApprovalFile, recoveryApprovalFile: selectedRecoveryApprovalFile });
  assert.throws(() => parseCliArguments(["--full-deck-live"]), /FULL_DECK_LIVE_CLI_REQUIRES_EXACTLY/);
  assert.throws(() => parseCliArguments(["--full-deck-live", "--approval-file", controllerApprovalFile, "--live"]), /FULL_DECK_LIVE_CLI_REQUIRES_EXACTLY/);
  assert.throws(() => parseCliArguments(["--approval-file", controllerApprovalFile, "--full-deck-live"]), /FULL_DECK_LIVE_CLI_REQUIRES_EXACTLY/);
  assert.deepEqual(parseCliArguments(["--full-deck-official-preflight", "--approval-file", controllerApprovalFile]), { mode: "full-deck-official-preflight", approvalFile: controllerApprovalFile, transport: "node_fetch" });
  assert.deepEqual(parseCliArguments(["--full-deck-official-preflight", "--approval-file", controllerApprovalFile, "--transport", "system_curl"]), { mode: "full-deck-official-preflight", approvalFile: controllerApprovalFile, transport: "system_curl" });
  assert.throws(() => parseCliArguments(["--full-deck-official-preflight", "--approval-file", controllerApprovalFile, "--transport", "auto"]), /FULL_DECK_OFFICIAL_PREFLIGHT_CLI_REQUIRES_EXACTLY/);
  assert.throws(() => parseCliArguments(["--full-deck-official-preflight"]), /FULL_DECK_OFFICIAL_PREFLIGHT_CLI_REQUIRES_EXACTLY/);

  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "full-deck-official-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_CREDENTIAL_ALREADY_CONSUMED/);
  const staleCredential = { ...officialRecoveryPass, verifiedAt: "2020-01-01T00:00:00.000Z", consumedAt: null, consumerRunNonce: null };
  staleCredential.snapshotHash = credentialSnapshotHash(staleCredential);
  writeFileSync(resolve(recoveryOutputDir, "stale-preflight.json"), `${JSON.stringify(staleCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "stale-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_CREDENTIAL_STALE/);
  const tamperedCredential = { ...officialRecoveryPass, consumedAt: null, consumerRunNonce: null, promptSetHash: "0".repeat(64) };
  writeFileSync(resolve(recoveryOutputDir, "tampered-preflight.json"), `${JSON.stringify(tamperedCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "tampered-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_CREDENTIAL_BINDING_MISMATCH/);
  const proofTamperedCredential = { ...officialRecoveryPass, consumedAt: null, consumerRunNonce: null, snapshotHash: "0".repeat(64) };
  writeFileSync(resolve(recoveryOutputDir, "proof-tampered-preflight.json"), `${JSON.stringify(proofTamperedCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "proof-tampered-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_CREDENTIAL_TAMPERED/);
  const wrongSourceCredential = structuredClone(officialRecoveryPass); wrongSourceCredential.consumedAt = null; wrongSourceCredential.consumerRunNonce = null; wrongSourceCredential.officialEvidence.documentation.url = "https://invalid.example/docs"; wrongSourceCredential.snapshotHash = credentialSnapshotHash(wrongSourceCredential);
  writeFileSync(resolve(recoveryOutputDir, "wrong-source-preflight.json"), `${JSON.stringify(wrongSourceCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "wrong-source-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_EVIDENCE_INVALID:documentation/);
  const missingHashCredential = structuredClone(officialRecoveryPass); missingHashCredential.consumedAt = null; missingHashCredential.consumerRunNonce = null; delete missingHashCredential.officialEvidence.credit.contentSha256; missingHashCredential.snapshotHash = credentialSnapshotHash(missingHashCredential);
  writeFileSync(resolve(recoveryOutputDir, "missing-hash-preflight.json"), `${JSON.stringify(missingHashCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "missing-hash-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_EVIDENCE_INVALID:credit/);
  const wrongApprovalCredential = structuredClone(officialRecoveryPass); wrongApprovalCredential.consumedAt = null; wrongApprovalCredential.consumerRunNonce = null; wrongApprovalCredential.approvalHash = "f".repeat(64); wrongApprovalCredential.snapshotHash = credentialSnapshotHash(wrongApprovalCredential);
  writeFileSync(resolve(recoveryOutputDir, "wrong-approval-preflight.json"), `${JSON.stringify(wrongApprovalCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "wrong-approval-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_CREDENTIAL_BINDING_MISMATCH/);
  const replayCredential = { ...officialRecoveryPass, consumedAt: null, consumerRunNonce: null };
  writeFileSync(resolve(recoveryOutputDir, "replay-preflight.json"), `${JSON.stringify(replayCredential)}\n`, "utf8");
  await assert.rejects(() => run05NFullDeckLive({ approvalFile: controllerApprovalFile, officialPreflightFile: "replay-preflight.json", apiKey: "offline-wrapper-key", operations: {} }), /OFFICIAL_PREFLIGHT_CREDENTIAL_REPLAYED_IN_LIVE_SUMMARY/);
  const officialRecoveryStop = await run05NFullDeckOfficialPreflight({ approvalFile: controllerApprovalFile, operations: { verifyOfficialProfile: async () => { throw new Error("OFFICIAL_EVIDENCE_FETCH_FAILED:documentation:ENOTFOUND"); } } });
  assert.equal(officialRecoveryStop.officialProfile, "blocked");
  assert.match(officialRecoveryStop.failure, /^OFFICIAL_EVIDENCE_FETCH_FAILED:documentation:ENOTFOUND$/);
  assert.equal(existsSync(fullDeckOfficialPreflightPath), true);

  assert.notEqual(recoveryOutputDir, authoritativeRecoveryOutputDir);
  for (const evidence of authoritativeEvidence) {
    if (evidence.bytes === null) assert.equal(existsSync(evidence.path), false, `self-test created authoritative evidence: ${evidence.path}`);
    else assert.deepEqual(readFileSync(evidence.path), evidence.bytes, `self-test changed authoritative evidence: ${evidence.path}`);
  }
  assert.equal(accidentalNetworkCalls, 0);
  console.log(JSON.stringify({ status: "passed", sourceFileSha256: dryRun.source.fileSha256, pageTruthHashes: dryRun.pages.map((page) => ({ pageId: page.pageId, truthHash: page.truthHash })), promptSetHash: dryRun.skill.promptSetHash, planStatus: dryRun.plan.status, approvedMaterializedRequests: approved.requests.length, sequentialStopCases: 6, networkCalls: 0, providerCalls: 0, automaticRetries: 0, productionWrites: false }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
