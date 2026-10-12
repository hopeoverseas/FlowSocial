import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adaptAuthoritativeWechatImagePlanOutput, adaptWechatImagePlanOutput, hashWechatArtifactValue } from "../../content-agent/wechat-image-plan-adapter.mjs";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { buildXhsDesignRuntimeBindings, runPlannedXhsDesignRuntime } from "../../content-agent/xhs-design-runtime-adapter.mjs";
import { createXhsProviderApproval, createXhsProviderBudget } from "../../content-agent/xhs-page-artifact-facts.mjs";
import { executeApprovedXhsPageArtifacts } from "../../content-agent/xhs-page-artifact-runtime.mjs";
import { solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { createWechatArtifactFactStore } from "../../content-agent/wechat-artifact-facts.mjs";
import { runWechatPreuploadArtifactRuntime } from "../../content-agent/wechat-preupload-artifact-runtime.mjs";
import { appendUnifiedContentArtifact } from "../../content-agent/unified-content-artifact-store.mjs";

const dataDir = await mkdtemp(join(tmpdir(), "flowsocial-unified-artifact-"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "1";
process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "0";

const { server, setUnifiedContentServerDependenciesForTest } = await import("../../server.mjs");
const { database, readStore, writeStore } = await import("../../storage.mjs");

const h = (letter) => letter.repeat(64);
const ref = (id, letter) => ({ id, hash: h(letter) });
const hashedFact = (base) => ({ ...base, factHash: stableHash(base) });
const storedFactRef = (fact) => ({ id: fact.id, hash: fact.factHash });
const projectRef = ref("artifact_project", "a");
const runRef = ref("artifact_wechat_run", "b");
const candidateRef = ref("artifact_wechat_candidate", "c");
const articleRef = ref("artifact_article", "d");
const outputFactRef = ref("artifact_skill_output", "e");
const xhsSharedMaster = { id: "artifact_xhs_master" };
const xhsPlatformRun = { id: "artifact_xhs_run", platform: "xiaohongshu" };
const xhsCandidate = { id: "artifact_xhs_candidate", platform: "xiaohongshu" };
const xhsRunRef = { id: xhsPlatformRun.id, hash: stableHash(xhsPlatformRun) };
const xhsCandidateRef = { id: xhsCandidate.id, hash: stableHash(xhsCandidate) };
const canonicalPlan = adaptWechatImagePlanOutput({ plan_id: "artifact_no_image_plan", cover: { purpose: "mood", strategy: "no_image", asset_id: null }, slots: [] }, {
  skillStatus: "success",
  bindings: { contentProjectRef: projectRef, platformRunRef: runRef, candidateRef, articleRef, imagePlanOutputFactRef: outputFactRef }
});

function authoritativeWechatRuntimeFixture({ id, runtimeOutput, candidateRef: exactCandidateRef, article, contentMaster, authorizedAssets = [] }) {
  const executionRecordRef = { id: `${id}:execution`, hash: stableHash(`${id}:execution`) };
  const canonicalAuthorityPlan = adaptAuthoritativeWechatImagePlanOutput(runtimeOutput, { article, contentMaster, authorizedAssets });
  const outputFactBase = {
    schemaVersion: "1.0",
    contract: "UnifiedSkillOutputFact@1.0",
    id: `${id}:output-fact`,
    capability: "plan-wechat-images",
    executionRecordRef,
    executionMode: "real",
    status: "completed",
    runtimeOutput,
    outputHash: hashUnifiedContent(runtimeOutput),
    productionEligibleOutput: true
  };
  const imagePlanOutputFact = { ...outputFactBase, factHash: hashUnifiedContent(outputFactBase) };
  const imagePlanOutputFactRef = { id: imagePlanOutputFact.id, hash: imagePlanOutputFact.factHash };
  const candidate = {
    candidateRef: exactCandidateRef,
    platformRunRef: runRef,
    imagePlanAuthority: {
      contract: "WechatImagePlanAuthority@1.0",
      candidateRef: exactCandidateRef,
      articleOutputFactRef: articleRef,
      imagePlanOutputFactRef,
      imagePlanOutputRef: { id: imagePlanOutputFact.id, hash: imagePlanOutputFact.outputHash },
      executionRecordRef,
      canonicalPlanHash: canonicalAuthorityPlan.planHash
    }
  };
  const bindings = { contentProjectRef: projectRef, platformRunRef: runRef, candidateRef: exactCandidateRef, articleRef, imagePlanOutputFactRef };
  return { article, contentMaster, authorizedAssets, imagePlanOutputFact, candidate, bindings };
}

function validXhsDesignEvidence() {
  const page = (number) => ({ page: number, role: "cover", text_layers: [{ type: "headline", text: `合法标题${number}` }] });
  const selection = (number) => ({ pageId: `P${number}`, archetypeId: "cover.promise", patternIds: ["pattern.hierarchy.promise-focus"], referenceAssetIds: [], verbatimTextOverride: null, stylePackId: null });
  const runtimeInput = {
    schemaVersion: "1.0", contract: "DesignXhsIntegratedPagesRuntimeInput@1.0", id: "artifact_xhs_runtime",
    xhsPostPackage: { status: "success", data: { platform: "xiaohongshu", post_copy: { cta: "" }, deck: { pages: [page(1), page(2)] } } },
    contentVersion: 1,
    designDna: { snapshotId: "artifact_dna", palette: [], typographyRoles: [], constraints: [] },
    authorizedAssets: [], providerCapability: {}, pageDensity: { P1: "low", P2: "low" },
    visualSelection: { stylePackId: "editorial-metaphor", reason: "offline API fixture", pages: [selection(1), selection(2)] }
  };
  const skillExecutionPlan = {
    kind: "UnifiedContentSkillExecutionPlan@1.0", platform: "xiaohongshu", authorization: { mode: "strict" },
    steps: [{ id: "visual_design", kind: "skill", capability: "design-xhs-integrated-pages", enabled: true, state: "planned", decision: "enabled", inputContract: "DesignXhsIntegratedPagesRuntimeInput@1.0", outputContract: "XhsIntegratedPagePromptSet@1.0" }]
  };
  return runPlannedXhsDesignRuntime({
    runtimeInput, sharedContentMaster: xhsSharedMaster, platformRun: xhsPlatformRun, candidate: xhsCandidate,
    bindings: buildXhsDesignRuntimeBindings({ runtimeInput, sharedContentMaster: xhsSharedMaster, platformRun: xhsPlatformRun, candidate: xhsCandidate }),
    skillExecutionPlan, expectedPlanHash: stableHash(skillExecutionPlan), featureFlags: { xhsIntegratedPageDesignSkill: true }
  });
}

function providerPrompt(sections) {
  return [["页面语义", sections.pageSemantics], ["视觉媒介", sections.visualMedium], ["构图与层级", sections.composition], ["材质空间光影", sections.materialSpaceLight], ["跨页统一", sections.crossPageRules], ["逐字真值", sections.verbatimText], ["负面约束", sections.negativeConstraints]]
    .map(([label, values]) => `${label}：\n${values.map((item) => `- ${item}`).join("\n")}`).join("\n\n");
}

function readyXhsDesignEvidence() {
  const evidence = validXhsDesignEvidence();
  const provider = { id: "fixture-provider", model: "fixture-model", adapter: { id: "fixture-adapter", version: "1.0", projectionKey: "fixture" }, lifecycle: "fixture", createEndpoint: "/fixture", requestFields: [] };
  const pages = evidence.outputs.skillInvocation.promptSet.pagePromptSpecs.map((spec) => {
    const promptSections = { pageSemantics: [spec.contentTruth.headline], visualMedium: ["fixture only"], composition: ["fixture only"], materialSpaceLight: ["fixture only"], crossPageRules: ["fixture only"], verbatimText: [...spec.promptBlocks.verbatimText], negativeConstraints: ["fixture only"] };
    const base = {
      pageId: spec.pageId,
      contentTruthRef: { id: `${spec.id}:truth`, hash: stableHash(spec.contentTruth) },
      assetBindings: { archetype: { id: spec.pageArchetypeId, hash: stableHash(spec.pageArchetypeId) }, stylePack: { id: spec.stylePackId || evidence.outputs.skillInvocation.promptSet.visualStyleSelection.stylePackId, hash: stableHash(spec.stylePackId || evidence.outputs.skillInvocation.promptSet.visualStyleSelection.stylePackId) }, patterns: [], referenceAssets: [] },
      legacyCompiler: { requestRef: { id: `${spec.id}:request`, hash: stableHash(`${spec.id}:request`) }, traceRef: { id: `${spec.id}:trace`, hash: stableHash(`${spec.id}:trace`) }, originalBlockerCodes: [], reclassifiedBlockerCodes: [] },
      promptSections,
      providerRequest: { endpoint: "/fixture", method: "POST", body: { model: provider.model, input: { prompt: providerPrompt(promptSections) } }, requestFields: [] },
      nativeDimensionQualification: { dimensions: { width: 810, height: 1080 }, status: "non_exact_normalizable" },
      deliveryQualification: { target: { width: 1080, height: 1440 }, status: "pending_post_normalization_gates", normalizationMode: "resample" },
      estimatedCost: 0.5,
      blockers: []
    };
    return { ...base, pageHash: stableHash(base) };
  });
  const inputHash = stableHash({ fixture: evidence.evidenceHash });
  const base = { schemaVersion: "1.0", contract: "IntegratedPageExecutionPlan@1.0", id: `fixture-plan:${inputHash.slice(0, 16)}`, mode: "isolated_experimental", skillBinding: { invocationHash: evidence.outputs.skillInvocation.invocationHash, promptSetRef: { id: evidence.outputs.skillInvocation.promptSet.id, hash: evidence.outputs.skillInvocation.promptSetHash } }, reviewBinding: { id: "fixture-review", hash: stableHash("fixture-review") }, capabilitySnapshotRef: { id: "fixture-capability", hash: stableHash("fixture-capability") }, registrySnapshotRef: { id: "fixture-registry", hash: stableHash("fixture-registry") }, provider, cost: { status: "confirmed", confirmationHash: stableHash("fixture-confirmation"), currency: "CNY", estimatedTotal: pages.length * 0.5, approvedMaxTotal: 5 }, pages, states: { provider: "not_called", userSelection: "not_selected", delivery: "not_delivered" }, productionEligible: false, execution: { status: "ready_for_isolated_provider_execution", networkCalls: 0, providerCalls: 0, retries: 0, actualCost: 0, databaseWrites: 0, featureFlag: "fixture_only" }, inputHash };
  const plan = { ...base, planHash: stableHash(base) };
  const ready = structuredClone(evidence);
  ready.outputs.integratedPageExecutionPlan = plan;
  ready.status = "ready_for_human_provider_approval";
  ready.productionEligible = true;
  ready.hashes.providerExecutionPlanHash = plan.planHash;
  ready.hashes.outputHash = stableHash(ready.outputs);
  delete ready.evidenceHash;
  ready.evidenceHash = stableHash(ready);
  return ready;
}

const fixtureStore = readStore();
const legacyTaskCount = fixtureStore.contentTasks?.length || 0;
const legacyPublicationCount = fixtureStore.contentPublications?.length || 0;
fixtureStore.accounts.push(
  { id: "artifact_company", companyId: "artifact_company", workspaceId: "artifact_workspace", accountType: "company" },
  { id: "artifact_wechat", socialAccountId: "artifact_wechat", companyId: "artifact_company", workspaceId: "artifact_workspace", accountType: "social", platform: "wechat" },
  { id: "artifact_xhs", socialAccountId: "artifact_xhs", companyId: "artifact_company", workspaceId: "artifact_workspace", accountType: "social", platform: "xiaohongshu" }
);
fixtureStore.unifiedContentProjects = [{
  schemaVersion: "1.0", contract: "UnifiedContentProductSnapshot@1.0", id: "artifact_snapshot", requestId: "artifact_request",
  contentProject: { schemaVersion: "1.0", contract: "ContentProject@1.0", id: projectRef.id, projectHash: projectRef.hash, companyId: "artifact_company", contentOpportunityRef: ref("artifact_opportunity", "8"), activeStrategySnapshotRef: ref("artifact_strategy", "7"), sharedContentMasterRef: ref("artifact_master", "f"), platformRuns: [runRef, ref("artifact_xhs_run", "3")], state: "candidate_generation", createdAt: "2026-08-05T12:00:00.000Z" },
  sharedContentMasterRef: ref("artifact_master", "f"),
  platforms: [
    { platform: "wechat", accountId: "artifact_wechat", platformRunRef: { ...runRef, sharedContentMasterRef: ref("artifact_master", "f") }, candidateRefs: [candidateRef], candidates: [], reviewInput: { input: { candidateSet: { candidateRef, articleRef, imagePlanRef: { id: canonicalPlan.planId, hash: canonicalPlan.planHash }, titleRef: ref("title", "1"), bodyVersionRef: ref("body", "2"), pageRevisionRefs: [], items: [{ id: "wechat_item", order: 1, purpose: "body" }] } } } },
    { platform: "xiaohongshu", accountId: "artifact_xhs", platformRunRef: { ...xhsRunRef, sharedContentMasterRef: ref("artifact_master", "f") }, candidateRefs: [xhsCandidateRef], candidates: [], reviewInput: { input: { candidateSet: { candidateRef: xhsCandidateRef, titleRef: ref("xhs_title", "5"), bodyVersionRef: ref("xhs_body", "6"), pageRevisionRefs: [], items: [{ id: "xhs_item", order: 1, purpose: "cover" }] } } } }
  ],
  productSnapshotHash: h("9")
}];
await writeStore(fixtureStore);

const scope = { workspaceId: "artifact_workspace", companyId: "artifact_company", accountId: "artifact_wechat", candidateId: candidateRef.id };
let baseUrl;
async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { response, data: await response.json() };
}

try {
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const artifactPath = "/unified-content-projects/artifact_project/platforms/wechat/artifacts";
  const query = new URLSearchParams({ workspaceId: scope.workspaceId, companyId: scope.companyId, accountId: scope.accountId });
  const empty = await request(`${artifactPath}?${query}`);
  assert.equal(empty.response.status, 200);
  assert.equal(empty.data.status, "pre_upload_resource_required");
  assert.equal(empty.data.finalBundleAuthority, false);

  const disabled = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_plan", canonicalPlan, idempotencyKey: "plan-1" } });
  assert.equal(disabled.response.status, 404);
  assert.equal(disabled.data.code, "UNIFIED_CONTENT_ARTIFACTS_DISABLED");
  const disabledReview = await request(`/unified-content-projects/artifact_project/platforms/wechat/artifact-review?${new URLSearchParams(scope)}`);
  assert.equal(disabledReview.response.status, 404);
  assert.equal(disabledReview.data.code, "UNIFIED_CONTENT_ARTIFACTS_DISABLED");
  assert.equal(readStore().unifiedContentWechatPreviewArtifacts, undefined, "flag off must not initialize or write preview artifacts");
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";

  const crossAccount = await request(artifactPath, { method: "POST", body: { ...scope, accountId: "artifact_xhs", operation: "wechat_plan", canonicalPlan, idempotencyKey: "cross-account" } });
  assert.equal(crossAccount.response.status, 403);
  const stalePlan = structuredClone(canonicalPlan);
  stalePlan.bindings.candidateRef = ref("stale", "7");
  const staleBase = structuredClone(stalePlan); delete staleBase.planHash; stalePlan.planHash = hashWechatArtifactValue(staleBase);
  const stale = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_plan", canonicalPlan: stalePlan, idempotencyKey: "stale-plan" } });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.code, "UNIFIED_ARTIFACT_WECHAT_CANDIDATE_MISMATCH");

  const plan = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_plan", canonicalPlan, idempotencyKey: "plan-1" } });
  assert.equal(plan.response.status, 201, JSON.stringify(plan.data));
  assert.equal(plan.data.facts[0].noImage, true);
  assert.equal(plan.data.artifactState.status, "pre_upload_resource_required");
  const retry = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_plan", canonicalPlan, idempotencyKey: "plan-1" } });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.data.facts[0].factHash, plan.data.facts[0].factHash);
  const conflictPlan = structuredClone(canonicalPlan);
  conflictPlan.planId = "conflict";
  const conflictBase = structuredClone(conflictPlan); delete conflictBase.planHash; conflictPlan.planHash = hashWechatArtifactValue(conflictBase);
  const conflict = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_plan", canonicalPlan: conflictPlan, idempotencyKey: "plan-1" } });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.data.code, "UNIFIED_ARTIFACT_IDEMPOTENCY_CONFLICT");

  const format = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_format", planFactId: plan.data.facts[0].id, html: "<article><h1>Fixture</h1></article>", idempotencyKey: "format-1" } });
  assert.equal(format.response.status, 201, JSON.stringify(format.data));
  assert.equal(format.data.facts[0].semantics, "pre_upload_template_not_wechat_final");
  assert.equal(format.data.facts[0].platformUploadPerformed, false);
  assert.equal(format.data.artifactState.finalBundleAuthority, false);
  const gates = ["format", "mobile", "ocr", "fact", "license", "visual"];
  for (const gate of gates) {
    const status = ["ocr", "fact", "license"].includes(gate) ? "not_applicable" : "passed";
    const result = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_quality", planFactId: plan.data.facts[0].id, formatFactId: format.data.facts[0].id, gate, status, idempotencyKey: `gate-${gate}` } });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
  }
  const readyForReview = await request(`${artifactPath}?${query}`);
  assert.equal(readyForReview.data.status, "pre_upload_review_required");
  assert.equal(readyForReview.data.reviewable, true);
  assert.equal(readyForReview.data.selectable, false);
  assert.equal(readyForReview.data.finalBundleAuthority, false);

  const wechatReviewPath = "/unified-content-projects/artifact_project/platforms/wechat/artifact-review";
  const wechatMaterial = await request(`${wechatReviewPath}?${new URLSearchParams(scope)}`);
  assert.equal(wechatMaterial.response.status, 200, JSON.stringify(wechatMaterial.data));
  assert.equal(wechatMaterial.data.reviewMaterial.semantics, "pre_upload_template_not_wechat_final");
  assert.equal(wechatMaterial.data.reviewMaterial.finalWechatArtifact, false);
  assert.equal(wechatMaterial.data.reviewMaterial.sixGates.length, 6);
  assert.equal(wechatMaterial.data.reviewMaterial.previewArtifact, null, "historical facts without a review payload remain readable but not previewable");
  assert.equal(wechatMaterial.data.claims.providerCalls, 0);
  const wechatApprovalBody = { ...scope, artifactStateHash: wechatMaterial.data.artifactState.artifactStateHash, reviewerId: "human:wechat-reviewer", reason: "上传前模板与六项 Gate 均已人工确认", action: "approve_preupload", payload: {}, idempotencyKey: "wechat-preupload-approve-1" };
  const wechatApproval = await request(wechatReviewPath, { method: "POST", body: wechatApprovalBody });
  assert.equal(wechatApproval.response.status, 201, JSON.stringify(wechatApproval.data));
  assert.equal(wechatApproval.data.artifactReview.artifactState.selectable, true);
  assert.equal(wechatApproval.data.artifactReview.artifactState.finalBundleAuthority, false);
  const wechatApprovalReplay = await request(wechatReviewPath, { method: "POST", body: wechatApprovalBody });
  assert.equal(wechatApprovalReplay.response.status, 200);
  assert.equal(wechatApprovalReplay.data.actionFact.factHash, wechatApproval.data.actionFact.factHash);
  const reviewActionCountBeforeConflict = readStore().unifiedContentArtifactReviewActions.length;
  const wechatApprovalConflict = await request(wechatReviewPath, { method: "POST", body: { ...wechatApprovalBody, reason: "同幂等键的不同请求必须冲突" } });
  assert.equal(wechatApprovalConflict.response.status, 409);
  assert.equal(wechatApprovalConflict.data.code, "UNIFIED_ARTIFACT_REVIEW_IDEMPOTENCY_CONFLICT");
  assert.equal(readStore().unifiedContentArtifactReviewActions.length, reviewActionCountBeforeConflict, "conflict must not mutate review facts");
  const wechatFormat2 = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_format", planFactId: plan.data.facts[0].id, html: "<article><h1>Fixture revised</h1></article>", idempotencyKey: "format-2" } });
  assert.equal(wechatFormat2.response.status, 201);
  for (const gate of gates) {
    const status = ["ocr", "fact", "license"].includes(gate) ? "not_applicable" : "passed";
    const result = await request(artifactPath, { method: "POST", body: { ...scope, operation: "wechat_quality", planFactId: plan.data.facts[0].id, formatFactId: wechatFormat2.data.facts[0].id, gate, status, idempotencyKey: `gate-2-${gate}` } });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
  }
  const wechatApprovalStale = await request(`${wechatReviewPath}?${new URLSearchParams(scope)}`);
  assert.equal(wechatApprovalStale.data.artifactState.reviewable, true);
  assert.equal(wechatApprovalStale.data.artifactState.selectable, false, "new format/quality state must stale the old approval");
  assert.notEqual(wechatApprovalStale.data.artifactState.artifactStateHash, wechatApprovalBody.artifactStateHash);
  const staleApprovalReplay = await request(wechatReviewPath, { method: "POST", body: wechatApprovalBody });
  assert.equal(staleApprovalReplay.response.status, 200, "an exact idempotent retry still returns its immutable original fact");
  assert.equal(staleApprovalReplay.data.artifactReview.artifactState.selectable, false, "idempotent replay must not revive a stale approval");

  const runtimeCandidateRef = ref("artifact_wechat_runtime_candidate", "4");
  const runtimePlanOutput = {
    status: "success",
    data: {
      plan_id: "artifact_runtime_image_plan",
      cover: { purpose: "mood", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null },
      slots: [{ slot_id: "runtime-slot", after_section_id: "runtime-section", purpose: "prove", strategy: "authorized_asset", claim_ids: [], asset_id: "runtime-image", image_spec: null }]
    },
    warnings: [],
    blocked_reasons: []
  };
  const runtimeArticle = {
    title: "deterministic runtime",
    body: "fixture only",
    outline: [{ section_id: "runtime-section", claim_ids: [] }],
    claim_map: [],
    source_list: [{ source_id: "runtime-source" }]
  };
  const runtimeContentMaster = { confirmed_facts: [], source_list: [{ source_id: "runtime-source" }] };
  const runtimeAuthorizedAssets = [{
    asset_id: "runtime-image", strategy: "authorized_asset", status: "approved", allowsPublication: true,
    source_id: "runtime-source", source_sha256: h("6")
  }];
  const runtimeAuthority = authoritativeWechatRuntimeFixture({
    id: "artifact-runtime-plan",
    runtimeOutput: runtimePlanOutput,
    candidateRef: runtimeCandidateRef,
    article: runtimeArticle,
    contentMaster: runtimeContentMaster,
    authorizedAssets: runtimeAuthorizedAssets
  });
  const runtimeStore = readStore();
  runtimeStore.unifiedContentProjects[0].platforms.find((item) => item.platform === "wechat").candidateRefs.push(runtimeCandidateRef);
  await writeStore(runtimeStore);
  const memoryFiles = new Map();
  const wechatRuntime = await runWechatPreuploadArtifactRuntime({
    store: createWechatArtifactFactStore(), ...runtimeAuthority,
    attempt: 1, idempotencyKeyPrefix: "api-runtime", recordedAt: "2026-08-05T12:30:00.000Z"
  }, {
    artifactSink: { async write(path, bytes) { memoryFiles.set(path, Buffer.from(bytes)); }, async read(path) { return Buffer.from(memoryFiles.get(path)); } },
    resourceResolvers: { authorized_asset: async () => { const bytes = solidRgbaPng(2, 2, [20, 40, 60, 255]); return { bytes, extension: ".png", evidence: { registryRecordRef: ref("runtime-registry", "7"), license: { id: "runtime-license", allowsPublication: true }, source: { ref: "registry://runtime-image", sha256: createHash("sha256").update(bytes).digest("hex") } } }; } },
    formatHtml: ({ resources }) => `<article><h1>deterministic runtime</h1><img src="${resources[0].relativePath}"><p>fixture only</p></article>`,
    qualityGates: Object.fromEntries(["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => [gate, async () => ({ status: "passed", details: { deterministicFixture: true } })]))
  });
  assert.equal(wechatRuntime.state.status, "pre_upload_review_required");
  const wechatRuntimeAppend = await request(artifactPath, { method: "POST", body: { ...scope, candidateId: runtimeCandidateRef.id, operation: "wechat_preupload_runtime_result", runtimeResult: wechatRuntime, idempotencyKey: "wechat-runtime-result-1" } });
  assert.equal(wechatRuntimeAppend.response.status, 201, JSON.stringify(wechatRuntimeAppend.data));
  assert.equal(wechatRuntimeAppend.data.artifactState.status, "pre_upload_review_required");
  assert.equal(wechatRuntimeAppend.data.artifactState.reviewable, true);
  assert.equal(wechatRuntimeAppend.data.artifactState.selectable, false);
  const runtimeReview = await request(`${wechatReviewPath}?${new URLSearchParams({ ...scope, candidateId: runtimeCandidateRef.id })}`);
  assert.equal(runtimeReview.response.status, 200, JSON.stringify(runtimeReview.data));
  assert.equal(runtimeReview.data.reviewMaterial.previewArtifact.contract, "UnifiedWechatPreUploadPreviewArtifact@1.0");
  assert.equal(runtimeReview.data.reviewMaterial.previewArtifact.semantics, "pre_upload_template_not_wechat_final");
  assert.match(runtimeReview.data.reviewMaterial.previewArtifact.previewHtml, /Content-Security-Policy/);
  assert.match(runtimeReview.data.reviewMaterial.previewArtifact.previewHtml, /default-src 'none'/);
  assert.match(runtimeReview.data.reviewMaterial.previewArtifact.previewHtml, /img-src data:/);
  assert.match(runtimeReview.data.reviewMaterial.previewArtifact.previewHtml, /data:image\/png;base64,/);
  assert.doesNotMatch(runtimeReview.data.reviewMaterial.previewArtifact.previewHtml, /src="assets\//);
  assert.equal(runtimeReview.data.reviewMaterial.previewArtifact.sandbox, "");
  assert.equal("html" in runtimeReview.data.reviewMaterial.formatFact, false, "raw HTML must not be embedded in the format audit fact");
  assert.equal(readStore().unifiedContentWechatPreviewArtifacts.length, 1);

  const previewCountBeforeRejections = readStore().unifiedContentWechatPreviewArtifacts.length;
  for (const [label, mutate, expectedCode] of [
    ["missing", (value) => { value.reviewPayload.resources.pop(); }, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_SET_MISMATCH"],
    ["extra", (value) => { value.reviewPayload.resources.push(structuredClone(value.reviewPayload.resources[0])); }, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_SET_MISMATCH"],
    ["tampered", (value) => { value.reviewPayload.resources[0].content = Buffer.from("tampered").toString("base64"); }, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_MISMATCH"],
    ["media-type", (value) => { value.reviewPayload.resources[0].mediaType = "image/jpeg"; }, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_INVALID"],
    ["traversal", (value) => { value.reviewPayload.resources[0].relativePath = "../escape.png"; }, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_RESOURCE_PATH_INVALID"]
  ]) {
    const rejectedRuntime = structuredClone(wechatRuntime);
    mutate(rejectedRuntime);
    const payloadBase = structuredClone(rejectedRuntime.reviewPayload); delete payloadBase.payloadHash;
    rejectedRuntime.reviewPayload.payloadHash = hashWechatArtifactValue(payloadBase);
    const rejected = await request(artifactPath, { method: "POST", body: { ...scope, candidateId: runtimeCandidateRef.id, operation: "wechat_preupload_runtime_result", runtimeResult: rejectedRuntime, idempotencyKey: `wechat-runtime-rejected-${label}` } });
    assert.equal(rejected.response.status >= 400, true, JSON.stringify(rejected.data));
    assert.equal(rejected.data.code, expectedCode);
    assert.equal(readStore().unifiedContentWechatPreviewArtifacts.length, previewCountBeforeRejections, `${label} rejection must be atomic`);
  }

  const externalCandidateRef = ref("artifact_wechat_external_candidate", "5");
  const externalPlanOutput = {
    status: "success",
    data: { plan_id: "artifact_external_plan", cover: { purpose: "mood", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null }, slots: [] },
    warnings: [],
    blocked_reasons: []
  };
  const externalAuthority = authoritativeWechatRuntimeFixture({
    id: "artifact-external-plan",
    runtimeOutput: externalPlanOutput,
    candidateRef: externalCandidateRef,
    article: { title: "external", body: "forbidden", outline: [{ section_id: "external-section", claim_ids: [] }], claim_map: [], source_list: [] },
    contentMaster: { confirmed_facts: [], source_list: [] }
  });
  const externalSeed = readStore();
  externalSeed.unifiedContentProjects[0].platforms.find((item) => item.platform === "wechat").candidateRefs.push(externalCandidateRef);
  await writeStore(externalSeed);
  const externalFiles = new Map();
  const externalRuntime = await runWechatPreuploadArtifactRuntime({ store: createWechatArtifactFactStore(), ...externalAuthority, attempt: 1, idempotencyKeyPrefix: "external-runtime", recordedAt: "2026-08-05T12:31:00.000Z" }, {
    artifactSink: { async write(path, bytes) { externalFiles.set(path, Buffer.from(bytes)); }, async read(path) { return Buffer.from(externalFiles.get(path)); } }, resourceResolvers: {},
    formatHtml: () => "<article><p>unsafe active content</p><script>alert('forbidden')</script></article>",
    qualityGates: Object.fromEntries(["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => [gate, async () => ({ status: "passed" })]))
  });
  const factsBeforeExternal = readStore().unifiedContentWechatFormatFacts.length;
  const externalRejected = await request(artifactPath, { method: "POST", body: { ...scope, candidateId: externalCandidateRef.id, operation: "wechat_preupload_runtime_result", runtimeResult: externalRuntime, idempotencyKey: "external-runtime-result" } });
  assert.equal(externalRejected.response.status, 400, JSON.stringify(externalRejected.data));
  assert.equal(externalRejected.data.code, "UNIFIED_ARTIFACT_WECHAT_PREVIEW_ACTIVE_CONTENT_FORBIDDEN");
  assert.equal(readStore().unifiedContentWechatFormatFacts.length, factsBeforeExternal, "unsafe HTML must not partially append audit facts");
  assert.equal(readStore().unifiedContentWechatPreviewArtifacts.length, previewCountBeforeRejections, "unsafe HTML must not append a preview artifact");
  const wechatRuntimeReplay = await request(artifactPath, { method: "POST", body: { ...scope, candidateId: runtimeCandidateRef.id, operation: "wechat_preupload_runtime_result", runtimeResult: wechatRuntime, idempotencyKey: "wechat-runtime-result-1" } });
  assert.equal(wechatRuntimeReplay.response.status, 200);
  const alteredWechatRuntime = structuredClone(wechatRuntime);
  alteredWechatRuntime.errors = [{ code: "changed-request" }];
  const wechatRuntimeConflict = await request(artifactPath, { method: "POST", body: { ...scope, candidateId: runtimeCandidateRef.id, operation: "wechat_preupload_runtime_result", runtimeResult: alteredWechatRuntime, idempotencyKey: "wechat-runtime-result-1" } });
  assert.equal(wechatRuntimeConflict.response.status, 409);
  assert.equal(wechatRuntimeConflict.data.code, "UNIFIED_ARTIFACT_IDEMPOTENCY_CONFLICT");

  const xhsScope = { workspaceId: scope.workspaceId, companyId: scope.companyId, accountId: "artifact_xhs" };
  const xhsEvidence = readyXhsDesignEvidence();
  assert.ok(xhsEvidence.outputs.integratedPageExecutionPlan, "human approval gate requires a materialized execution plan");
  assert.equal(xhsEvidence.outputs.integratedPageExecutionPlan.execution.status, "ready_for_isolated_provider_execution");
  assert.equal(xhsEvidence.status, "ready_for_human_provider_approval");
  assert.equal(xhsEvidence.nextGate, "HumanProviderExecutionApproval");
  const xhsInjected = await request("/unified-content-projects/artifact_project/platforms/xiaohongshu/artifacts", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidateRef.id, operation: "xhs_design_evidence", evidence: xhsEvidence, idempotencyKey: "xhs-design-injected" } });
  assert.equal(xhsInjected.response.status, 400, JSON.stringify(xhsInjected.data));
  assert.equal(xhsInjected.data.code, "UNIFIED_XHS_DESIGN_STAGE_REQUIRED");
  assert.equal((readStore().unifiedContentXhsDesignFacts || []).length, 0, "caller evidence injection must not leave a partial artifact fact");
  const xhsStore = readStore();
  const xhsAppend = appendUnifiedContentArtifact(xhsStore, { ...xhsScope, projectId: "artifact_project", platform: "xiaohongshu", candidateId: xhsCandidateRef.id, operation: "xhs_design_evidence", evidence: xhsEvidence, idempotencyKey: "xhs-design-1" });
  writeStore(xhsStore);
  assert.equal(xhsAppend.created, true);
  assert.equal(xhsAppend.artifactState.providerApprovalEligible, true);
  assert.equal("productionEligible" in xhsAppend.artifactState, false);
  assert.deepEqual(xhsAppend.artifactState.pageRevisionRefs, []);
  assert.equal(xhsAppend.artifactState.selectable, false);
  const xhsState = await request(`/unified-content-projects/artifact_project/platforms/xiaohongshu/artifacts?${new URLSearchParams({ ...xhsScope, candidateId: xhsCandidateRef.id })}`);
  assert.equal(xhsState.data.status, "visual_artifacts_required");
  assert.equal(xhsState.data.providerApprovalEligible, true);
  assert.equal("productionEligible" in xhsState.data, false);
  assert.equal(xhsState.data.pageRevisionRefs.length, 0);

  const xhsBudget = createXhsProviderBudget({ currency: "CNY", maxTotal: 5, maxAttemptsPerPage: 1, createdBy: "human:api-fixture", createdAt: "2026-08-05T12:30:00.000Z" });
  const xhsPlan = xhsEvidence.outputs.integratedPageExecutionPlan;
  const xhsApproval = createXhsProviderApproval({
    contentProjectRef: projectRef, platformRunRef: xhsRunRef, candidateRef: xhsCandidateRef,
    designEvidenceRef: { id: xhsEvidence.id, hash: xhsEvidence.evidenceHash }, planRef: { id: xhsPlan.id, hash: xhsPlan.planHash },
    providerRef: { id: "fixture-provider:fixture-model", hash: stableHash(xhsPlan.provider) }, budgetRef: { id: "xhs-provider-budget", hash: xhsBudget.budgetHash },
    approvedBy: "human:api-fixture", approvedAt: "2026-08-05T12:30:00.000Z"
  });
  let fixtureProviderCalls = 0;
  const fixturePng = solidRgbaPng(810, 1080, [80, 100, 120, 255]);
  const xhsRuntime = await executeApprovedXhsPageArtifacts({
    designEvidence: xhsEvidence, contentProjectRef: projectRef, platformRunRef: xhsRunRef, candidateRef: xhsCandidateRef,
    budget: xhsBudget, approval: xhsApproval, idempotencyKey: "api-xhs-runtime", now: () => "2026-08-05T12:30:00.000Z",
    transportContext: { mode: "deterministic_fixture", networked: false, productionResult: false },
    transport: async (_request, context) => { fixtureProviderCalls += 1; return { status: "succeeded", provider: "fixture-provider", model: "fixture-model", taskId: `fixture-${context.pageId}`, cost: 0.5, bytes: fixturePng }; }
  });
  const normalizedBytesBySha = new Map(xhsRuntime.revisions.map((revision) => {
    const payload = xhsRuntime.bytePayloads.find((item) => item.attemptRef.id === revision.sourceAttemptRef.id);
    return [revision.normalizedAsset.sha256, Buffer.from(payload.normalizedBytes)];
  }));
  setUnifiedContentServerDependenciesForTest({
    xhsAssetReader: async (asset) => ({ bytes: Buffer.from(normalizedBytesBySha.get(asset.sha256)), mediaType: "image/png" })
  });
  assert.equal(xhsRuntime.counters.networkCalls, 0);
  const xhsRuntimeAppend = await request("/unified-content-projects/artifact_project/platforms/xiaohongshu/artifacts", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidateRef.id, operation: "xhs_runtime_result", runtimeResult: xhsRuntime, idempotencyKey: "xhs-runtime-result-1" } });
  assert.equal(xhsRuntimeAppend.response.status, 400, JSON.stringify(xhsRuntimeAppend.data));
  assert.equal(xhsRuntimeAppend.data.code, "UNIFIED_XHS_PROVIDER_EXECUTION_STAGE_REQUIRED");
  const xhsRuntimeStore = readStore();
  const xhsRuntimeInternal = appendUnifiedContentArtifact(xhsRuntimeStore, { ...xhsScope, projectId: "artifact_project", platform: "xiaohongshu", candidateId: xhsCandidateRef.id, operation: "xhs_runtime_result", runtimeResult: xhsRuntime, idempotencyKey: "xhs-runtime-result-1" });
  await writeStore(xhsRuntimeStore);
  assert.equal(xhsRuntimeInternal.created, true);
  assert.equal(xhsRuntimeInternal.artifactState.status, "visual_skill_review_required");
  assert.equal(xhsRuntimeInternal.artifactState.reviewable, false, "page revisions alone must not bypass the Skill visual review gate");
  assert.equal(xhsRuntimeInternal.artifactState.humanReviewOpen, false);
  assert.equal(xhsRuntimeInternal.artifactState.pageRevisionRefs.length, xhsRuntime.revisions.length);
  assert.equal(xhsRuntimeInternal.artifactState.selectable, false);
  assert.equal(xhsRuntimeInternal.artifactState.finalBundleAuthority, false);
  const xhsRuntimeReplay = appendUnifiedContentArtifact(xhsRuntimeStore, { ...xhsScope, projectId: "artifact_project", platform: "xiaohongshu", candidateId: xhsCandidateRef.id, operation: "xhs_runtime_result", runtimeResult: xhsRuntime, idempotencyKey: "xhs-runtime-result-1" });
  assert.equal(xhsRuntimeReplay.created, false);
  const xhsFactReuse = appendUnifiedContentArtifact(xhsRuntimeStore, { ...xhsScope, projectId: "artifact_project", platform: "xiaohongshu", candidateId: xhsCandidateRef.id, operation: "xhs_runtime_result", runtimeResult: xhsRuntime, idempotencyKey: "xhs-runtime-result-reuse" });
  assert.equal(xhsFactReuse.created, true);
  assert.equal(xhsFactReuse.facts.length, xhsRuntime.attempts.length + xhsRuntime.revisions.length);
  const visualPageRevisionRefs = xhsPlan.pages.map((page) => {
    const revision = xhsRuntimeStore.unifiedContentXhsPageRevisionFacts.find((fact) => fact.pageId === page.pageId);
    return { id: revision.id, hash: revision.revisionHash };
  });
  const visualRevisionSetHash = stableHash(visualPageRevisionRefs);
  const visualApprovalBase = {
    schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewApprovalFact@1.0", id: "artifact-xhs-visual-approval",
    workspaceId: xhsScope.workspaceId, companyId: xhsScope.companyId, accountId: xhsScope.accountId,
    contentProjectRef: projectRef, platformRunRef: xhsRunRef, candidateRef: xhsCandidateRef,
    designEvidenceRef: { id: xhsEvidence.id, hash: xhsEvidence.evidenceHash }, planRef: { id: xhsPlan.id, hash: xhsPlan.planHash },
    pageRevisionRefs: visualPageRevisionRefs, revisionSetHash: visualRevisionSetHash,
    status: "approved", recordedAt: "2026-08-05T12:31:00.000Z"
  };
  const visualApprovalFact = hashedFact(visualApprovalBase);
  const visualInvocationBase = {
    schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewInvocationFact@1.0", id: "artifact-xhs-visual-invocation",
    workspaceId: xhsScope.workspaceId, companyId: xhsScope.companyId, accountId: xhsScope.accountId,
    contentProjectRef: projectRef, platformRunRef: xhsRunRef, candidateRef: xhsCandidateRef,
    designEvidenceRef: visualApprovalBase.designEvidenceRef, planRef: visualApprovalBase.planRef, approvalFactRef: storedFactRef(visualApprovalFact),
    pageRevisionRefs: visualPageRevisionRefs, revisionSetHash: visualRevisionSetHash,
    provider: "fixture-vision", model: "fixture-vision-1", pixelInputConsumed: true, providerCalls: 1, attempts: 1, automaticRetries: 0,
    credits: 1, productionEligible: true, status: "completed", recordedAt: "2026-08-05T12:32:00.000Z"
  };
  const visualInvocationFact = hashedFact(visualInvocationBase);
  const visualOutput = { status: "success", data: { decision: "pass", page_findings: [], deck_findings: [], passed_checks: ["page necessity", "cross-page narrative", "visual consistency", "text-image complement", "information density", "conversion value", "fact and OCR risk"], rerun_stages: [] }, warnings: [], blocked_reasons: [] };
  const visualReviewFact = hashedFact({
    schemaVersion: "1.0", contract: "UnifiedXhsVisualReviewFact@1.0", id: "artifact-xhs-visual-review",
    workspaceId: xhsScope.workspaceId, companyId: xhsScope.companyId, accountId: xhsScope.accountId,
    contentProjectRef: projectRef, platformRunRef: xhsRunRef, candidateRef: xhsCandidateRef,
    designEvidenceRef: visualApprovalBase.designEvidenceRef, planRef: visualApprovalBase.planRef,
    approvalFactRef: storedFactRef(visualApprovalFact), invocationFactRef: storedFactRef(visualInvocationFact),
    pageRevisionRefs: visualPageRevisionRefs, revisionSetHash: visualRevisionSetHash,
    output: visualOutput, normalizedPageFindings: [], decision: "pass", productionEligible: true,
    humanReviewAuthority: false, selectionAuthority: false, publicationPerformed: false, status: "skill_passed", recordedAt: "2026-08-05T12:32:00.000Z"
  });
  xhsRuntimeStore.unifiedContentXhsVisualReviewApprovalFacts = [visualApprovalFact];
  xhsRuntimeStore.unifiedContentXhsVisualReviewInvocationFacts = [visualInvocationFact];
  xhsRuntimeStore.unifiedContentXhsVisualReviewFacts = [visualReviewFact];
  await writeStore(xhsRuntimeStore);
  process.env.UNIFIED_CONTENT_XHS_HUMAN_VISUAL_CONFIRMATION_V1 = "1";
  process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1 = "0";
  const humanOnlyPending = await request(`/unified-content-projects/artifact_project/platforms/xiaohongshu/artifact-review?${new URLSearchParams({ ...xhsScope, candidateId: xhsCandidateRef.id })}`);
  assert.equal(humanOnlyPending.response.status, 200, JSON.stringify(humanOnlyPending.data));
  assert.equal(humanOnlyPending.data.artifactState.status, "human_visual_confirmation_required");
  assert.deepEqual(humanOnlyPending.data.artifactState.blockers, ["human_visual_confirmation_required"]);
  assert.equal(humanOnlyPending.data.reviewMaterial.reviewStages.skillVisualReview.status, "human_confirmation_pending");
  process.env.UNIFIED_CONTENT_XHS_HUMAN_VISUAL_CONFIRMATION_V1 = "0";
  const xhsReviewPath = "/unified-content-projects/artifact_project/platforms/xiaohongshu/artifact-review";
  const xhsActionScope = { ...xhsScope, candidateId: xhsCandidateRef.id };
  const xhsMaterial = await request(`${xhsReviewPath}?${new URLSearchParams(xhsActionScope)}`);
  assert.equal(xhsMaterial.response.status, 200, JSON.stringify(xhsMaterial.data));
  assert.equal(xhsMaterial.data.reviewMaterial.humanReviewOpen, true);
  assert.equal(xhsMaterial.data.reviewMaterial.reviewStages.skillVisualReview.status, "skill_passed");
  assert.equal(xhsMaterial.data.reviewMaterial.pages.length, xhsRuntime.revisions.length);
  assert.deepEqual(xhsMaterial.data.reviewMaterial.pages.map((page) => page.pageId), xhsEvidence.outputs.integratedPageExecutionPlan.pages.map((page) => page.pageId));
  for (const page of xhsMaterial.data.reviewMaterial.pages) {
    const evidence = JSON.stringify(page.revision);
    assert.match(evidence, /sha256/i);
    assert.match(evidence, /bytes/i);
    assert.match(evidence, /width/i);
    assert.match(evidence, /relativePath/i);
    assert.match(page.previewUrl, /^\/api\/v1\/unified-content-projects\//);
  }
  const exactPreview = await fetch(`${baseUrl.replace(/\/api\/v1$/, "")}${xhsMaterial.data.reviewMaterial.pages[0].previewUrl}`);
  assert.equal(exactPreview.status, 200);
  assert.equal(exactPreview.headers.get("content-type"), "image/png");
  assert.equal(createHash("sha256").update(Buffer.from(await exactPreview.arrayBuffer())).digest("hex"), xhsMaterial.data.reviewMaterial.pages[0].revision.normalizedAsset.sha256);
  const wrongHashUrl = new URL(`${baseUrl.replace(/\/api\/v1$/, "")}${xhsMaterial.data.reviewMaterial.pages[0].previewUrl}`);
  wrongHashUrl.searchParams.set("revisionHash", h("0"));
  const wrongHashPreview = await fetch(wrongHashUrl);
  assert.equal(wrongHashPreview.status, 404, "a preview URL must bind the exact immutable revision hash");
  const firstPage = xhsMaterial.data.reviewMaterial.pages[0];
  const secondPage = xhsMaterial.data.reviewMaterial.pages[1];
  const excludeFirst = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: xhsMaterial.data.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "该页与整套叙事重复", action: "exclude_page", payload: { pageId: firstPage.pageId, pageRevisionRef: firstPage.revisionRef }, idempotencyKey: "xhs-exclude-first" } });
  assert.equal(excludeFirst.response.status, 201, JSON.stringify(excludeFirst.data));
  const afterExcludeHash = excludeFirst.data.artifactReview.artifactState.artifactStateHash;
  assert.notEqual(afterExcludeHash, xhsMaterial.data.artifactState.artifactStateHash);
  const staleApproval = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: xhsMaterial.data.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "陈旧批准应拒绝", action: "approve_set", payload: {}, idempotencyKey: "xhs-stale-approve" } });
  assert.equal(staleApproval.response.status, 409);
  assert.equal(staleApproval.data.code, "UNIFIED_ARTIFACT_REVIEW_STATE_STALE");
  assert.equal(readStore().unifiedContentArtifactReviewActions.length, reviewActionCountBeforeConflict + 1, "stale action must reject before mutation");
  const approveOne = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: afterExcludeHash, reviewerId: "human:xhs-reviewer", reason: "剩余页面构成完整可用内容套件", action: "approve_set", payload: {}, idempotencyKey: "xhs-approve-one" } });
  assert.equal(approveOne.response.status, 201);
  assert.equal(approveOne.data.artifactReview.artifactState.selectable, true);
  assert.equal(approveOne.data.artifactReview.artifactState.pageRevisionRefs.length, 1);
  assert.equal(approveOne.data.artifactReview.claims.selectionPerformed, false);
  const excludeAll = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: afterExcludeHash, reviewerId: "human:xhs-reviewer", reason: "验证排除全部页不能选择", action: "exclude_page", payload: { pageId: secondPage.pageId, pageRevisionRef: secondPage.revisionRef }, idempotencyKey: "xhs-exclude-all" } });
  assert.equal(excludeAll.response.status, 201);
  assert.equal(excludeAll.data.artifactReview.artifactState.selectable, false);
  const restoreFirst = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: excludeAll.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "恢复首屏以请求重做", action: "restore_page", payload: { pageId: firstPage.pageId, pageRevisionRef: firstPage.revisionRef }, idempotencyKey: "xhs-restore-first" } });
  assert.equal(restoreFirst.response.status, 201);
  const restoreSecond = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: restoreFirst.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "恢复第二页以验证排序", action: "restore_page", payload: { pageId: secondPage.pageId, pageRevisionRef: secondPage.revisionRef }, idempotencyKey: "xhs-restore-second" } });
  assert.equal(restoreSecond.response.status, 201);
  const reorder = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: restoreSecond.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "人工调整整套页面顺序", action: "reorder_pages", payload: { pageIds: [secondPage.pageId, firstPage.pageId] }, idempotencyKey: "xhs-reorder" } });
  assert.equal(reorder.response.status, 201);
  assert.deepEqual(reorder.data.artifactReview.reviewMaterial.pages.map((page) => page.pageId), [secondPage.pageId, firstPage.pageId]);
  const redo = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: reorder.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "首屏层级需重做", action: "request_page_redo", payload: { pageId: firstPage.pageId, pageRevisionRef: firstPage.revisionRef }, idempotencyKey: "xhs-redo-first" } });
  assert.equal(redo.response.status, 201);
  assert.deepEqual(redo.data.counters, { providerCalls: 0, networkCalls: 0 });
  assert.equal(redo.data.artifactReview.artifactState.selectable, false);
  const approveAfterRedo = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: redo.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "重做请求已记录，当前套件暂准进入选择", action: "approve_set", payload: {}, idempotencyKey: "xhs-approve-after-redo" } });
  assert.equal(approveAfterRedo.response.status, 201);
  assert.equal(approveAfterRedo.data.artifactReview.artifactState.selectable, false, "pending redo must remain non-selectable until a new runtime revision arrives");
  const rejectSet = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, artifactStateHash: redo.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "人工最终否决整套", action: "reject_set", payload: {}, idempotencyKey: "xhs-reject-set" } });
  assert.equal(rejectSet.response.status, 201);
  assert.equal(rejectSet.data.artifactReview.artifactState.selectable, false);
  const crossCandidateAction = await request(xhsReviewPath, { method: "POST", body: { ...xhsActionScope, candidateId: candidateRef.id, artifactStateHash: redo.data.artifactReview.artifactState.artifactStateHash, reviewerId: "human:xhs-reviewer", reason: "跨候选必须拒绝", action: "approve_set", payload: {}, idempotencyKey: "xhs-cross-candidate-action" } });
  assert.equal(crossCandidateAction.response.status, 409);
  const beforeAtomicReject = readStore();
  const tamperedRuntime = structuredClone(xhsRuntime);
  tamperedRuntime.attempts.at(-1).cost += 1;
  const atomicReject = await request("/unified-content-projects/artifact_project/platforms/xiaohongshu/artifacts", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidateRef.id, operation: "xhs_runtime_result", runtimeResult: tamperedRuntime, idempotencyKey: "xhs-runtime-result-tampered" } });
  assert.equal(atomicReject.response.status, 400);
  assert.equal(atomicReject.data.code, "UNIFIED_XHS_PROVIDER_EXECUTION_STAGE_REQUIRED");
  assert.throws(() => appendUnifiedContentArtifact(beforeAtomicReject, { ...xhsScope, projectId: "artifact_project", platform: "xiaohongshu", candidateId: xhsCandidateRef.id, operation: "xhs_runtime_result", runtimeResult: tamperedRuntime, idempotencyKey: "xhs-runtime-result-tampered" }), (error) => error.code === "XHS_PROVIDER_ATTEMPT_FACT_HASH_MISMATCH");
  assert.equal(readStore().unifiedContentXhsProviderAttemptFacts.length, beforeAtomicReject.unifiedContentXhsProviderAttemptFacts.length, "group validation must reject before mutation");
  const crossCandidateRuntime = await request("/unified-content-projects/artifact_project/platforms/xiaohongshu/artifacts", { method: "POST", body: { ...xhsScope, candidateId: "artifact_wechat_runtime_candidate", operation: "xhs_runtime_result", runtimeResult: xhsRuntime, idempotencyKey: "xhs-runtime-cross-candidate" } });
  assert.equal(crossCandidateRuntime.response.status, 400);
  assert.equal(crossCandidateRuntime.data.code, "UNIFIED_XHS_PROVIDER_EXECUTION_STAGE_REQUIRED");

  const multiCandidateStore = readStore();
  const wechatPlatform = multiCandidateStore.unifiedContentProjects[0].platforms.find((item) => item.platform === "wechat");
  const secondCandidate = ref("artifact_wechat_candidate_2", "0");
  wechatPlatform.candidateRefs.push(secondCandidate);
  await writeStore(multiCandidateStore);
  assert.equal(readStore().unifiedContentProjects[0].platforms.find((item) => item.platform === "wechat").candidateRefs.length, 4);
  const ambiguous = await request(`${artifactPath}?${new URLSearchParams({ workspaceId: scope.workspaceId, companyId: scope.companyId, accountId: scope.accountId })}`);
  assert.equal(ambiguous.response.status, 409, JSON.stringify(ambiguous.data));
  assert.equal(ambiguous.data.code, "UNIFIED_ARTIFACT_CANDIDATE_AMBIGUOUS");
  const firstScoped = await request(`${artifactPath}?${new URLSearchParams({ workspaceId: scope.workspaceId, companyId: scope.companyId, accountId: scope.accountId, candidateId: candidateRef.id })}`);
  assert.equal(firstScoped.response.status, 200);
  assert.equal(firstScoped.data.planFactRefs.length, 1);
  const secondScoped = await request(`${artifactPath}?${new URLSearchParams({ workspaceId: scope.workspaceId, companyId: scope.companyId, accountId: scope.accountId, candidateId: secondCandidate.id })}`);
  assert.equal(secondScoped.response.status, 200);
  assert.equal(secondScoped.data.status, "pre_upload_resource_required");
  assert.equal(secondScoped.data.candidateRef.id, secondCandidate.id);
  assert.equal(secondScoped.data.planFactRefs, undefined, "facts from another candidate must not leak into the projection");
  const projectedProject = await request("/unified-content-projects/artifact_project");
  const projectedWechat = projectedProject.data.platforms.find((item) => item.platform === "wechat");
  assert.equal(projectedWechat.artifactState.status, "candidate_selection_required");
  assert.equal(projectedWechat.artifactStates.length, 4);
  assert.equal(projectedWechat.artifactStates.find((item) => item.candidateRef.id === secondCandidate.id).planFactRefs, undefined);

  const beforeTamper = readStore();
  const tampered = structuredClone(beforeTamper);
  tampered.unifiedContentWechatFormatFacts[0].htmlBytes += 1;
  await writeStore(tampered);
  const rejectedTamper = await request(`${artifactPath}?${new URLSearchParams({ ...scope, candidateId: candidateRef.id })}`);
  assert.equal(rejectedTamper.response.status, 409);
  assert.equal(rejectedTamper.data.code, "UNIFIED_ARTIFACT_WECHAT_FACT_HASH_MISMATCH");
  await writeStore(beforeTamper);
  const stored = readStore();
  assert.equal(stored.unifiedContentWechatPlanFacts.length, 2);
  assert.equal(stored.unifiedContentWechatFormatFacts.length, 3);
  assert.equal(stored.unifiedContentWechatQualityFacts.length, 18);
  assert.equal(stored.unifiedContentWechatPreviewArtifacts.length, 1);
  assert.equal(stored.unifiedContentXhsDesignFacts.length, 1);
  assert.equal(stored.unifiedContentXhsProviderAttemptFacts.length, xhsRuntime.attempts.length);
  assert.equal(stored.unifiedContentXhsPageRevisionFacts.length, xhsRuntime.revisions.length);
  assert.equal(stored.contentPublications?.length || 0, legacyPublicationCount);
  assert.equal(stored.contentTasks?.length || 0, legacyTaskCount);
  assert.equal(stored.unifiedContentSelections?.length || 0, 0, "artifact approval must not create UserSelection authority");
  console.log(JSON.stringify({ status: "unified-content-artifact-api-self-test passed", runtimeFacts: { wechat: wechatRuntime.store.planFacts.length + wechatRuntime.store.resourceAttempts.length + wechatRuntime.store.formatFacts.length + wechatRuntime.store.qualityFacts.length, previewArtifacts: stored.unifiedContentWechatPreviewArtifacts.length, xhsAttempts: xhsRuntime.attempts.length, xhsRevisions: xhsRuntime.revisions.length }, artifactReviewActions: stored.unifiedContentArtifactReviewActions.length, fixtureProviderCalls, networkCalls: 0, realProviderCalls: 0, platformCalls: 0, productionDatabaseCalls: 0 }, null, 2));
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  database.close();
  await rm(dataDir, { recursive: true, force: true });
}
