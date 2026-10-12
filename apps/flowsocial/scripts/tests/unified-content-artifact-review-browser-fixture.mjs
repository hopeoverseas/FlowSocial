import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adaptWechatImagePlanOutput } from "../../content-agent/wechat-image-plan-adapter.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { createWechatArtifactFactStore } from "../../content-agent/wechat-artifact-facts.mjs";
import { runWechatPreuploadArtifactRuntime } from "../../content-agent/wechat-preupload-artifact-runtime.mjs";
import { buildXiaohongshuPlatformDeliveryBundle } from "../../content-agent/platform-delivery-bundle.mjs";

function parseArgs(argv) {
  const options = { flagOff: false, selfCheck: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--flag-off") options.flagOff = true;
    else if (argument === "--self-check") options.selfCheck = true;
    else if (argument === "--port") options.port = Number(argv[++index]);
    else if (argument.startsWith("--port=")) options.port = Number(argument.slice("--port=".length));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("A fixed localhost port is required: --port <1-65535>");
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const dataDir = await mkdtemp(join(tmpdir(), "flowsocial-artifact-browser-qa-"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "1";
process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = options.flagOff ? "0" : "1";
process.env.CONTENT_PROMOTION_V1 = options.flagOff ? "0" : "1";
process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = options.flagOff ? "0" : "1";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = options.flagOff ? "0" : "1";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = options.flagOff ? "0" : "1";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_APPROVAL_V1 = options.flagOff ? "0" : "1";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1 = options.flagOff ? "0" : "1";
process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1 = options.flagOff ? "0" : "1";
process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1 = options.flagOff ? "0" : "1";
process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = options.flagOff ? "0" : "1";
process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = options.flagOff ? "0" : "1";
process.env.XHS_VISUAL_ASSET_REGISTRY = options.flagOff ? "0" : "1";
process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = options.flagOff ? "0" : "1";
process.env.FLOW_IMAGE_PROVIDER = "Kie.ai";
process.env.KIE_IMAGE_MODEL = "gpt-image-2-text-to-image";

const { server: applicationServer, setUnifiedContentServerDependenciesForTest } = await import("../../server.mjs");
const { database, readStore, writeStore } = await import("../../storage.mjs");

const h = (letter) => letter.repeat(64);
const ref = (id, letter) => ({ id, hash: h(letter) });
let sharedMasterRef;
let wechatCandidateRef;
const wechatBlockedCandidateRef = ref("browser_qa_wechat_blocked", "0");
let articleRef;
let xhsCandidateRef;
const xhsBlockedCandidateRef = ref("browser_qa_xhs_blocked", "1");
let wechatRunRef;
let xhsRunRef;
let wechatRuntimeRunRef;
let xhsRuntimeRunRef;
let contentProject;
let projectRef;
let fixtureScope;

function domainOutput(capability, platform) {
  if (capability === "build-content-master") return {
    content_master_id: "browser_qa_master", topic_id: "browser_qa_topic", intent_profile_id: "browser_qa_intent", platform: "xiaohongshu",
    content_purpose: { id: "knowledge_howto", label: "fixture", description: "fixture" }, target_audience: ["fixture"], central_question: "fixture",
    central_thesis: "统一母版只生成一次", reader_value: "fixture", content_emphasis: [], strategy_alignment: { content_function: "authority", platform_role: "shared", conversion_stage: { id: "trust", label: "trust", action: "read" }, evidence_requirement: "source", purpose_eligible: true, user_override_applied: false },
    confirmed_facts: [{ fact_id: "F001", fact: "fixture fact", source_ids: ["SRC001"] }], supported_interpretations: [], author_opinions: [], unknowns: [], examples: [],
    knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] }, promotion: { mode: "none", insertion_rule: "do_not_mention", allowed_items: [], allowed_claims: [], forbidden_claims: [], disclosure: "" },
    engagement_policy: { mode: "auto", optimize_for: ["finish"], selected_primary_action: "none", cta_rule: "select_one_primary_action_naturally" }, claims_to_avoid: [], publish_time_checks: [], source_list: [{ source_id: "SRC001", title: "fixture source" }]
  };
  if (capability === "generate-content-outline") return { id: `outline_${platform}`, sections: [{ id: "section_1", heading: "问题" }] };
  if (capability === "write-xhs-content") return {
    platform: "xiaohongshu", post_copy: { title_candidates: ["结果", "问题", "清单"].map((title, index) => ({ title: `${title}${index}`, hook_type: "result", claim_ids: [], risk: "low" })), recommended_title: "结果0", opening: "fixture", body_sections: [{ section_id: "S1", role: "method", text: "fixture", claim_ids: [] }], ending: "fixture", pinned_comment: "", hashtags: ["fixture"], cta: "" },
    deck: { deck_id: "browser_qa_deck", pages: [1, 2].map((page) => ({ page, role: "cover", objective: "测试目标", takeaway: "测试结论", text_layers: [{ type: "headline", text: `浏览器验收页面 ${page}` }], render_strategy: "html_css" })) }
  };
  if (capability === "write-wechat-article") return { platform: "wechat_official_account", title_candidates: [{ title: "公众号候选", approach: "method", claim_ids: [], risk: "low" }], recommended_title: "公众号候选", outline: [{ section_id: "W1", heading: "问题", purpose: "fixture", relation_to_previous: "start", claim_ids: [], boundary_to_cover: "" }], article_markdown: "## 问题\n\nfixture", preflight_checks: [] };
  if (capability === "review-wechat-article") return { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
  if (capability === "generate-platform-titles") return { stage: "final_after_body", platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu", title_brief: {}, candidates: Array.from({ length: 5 }, (_, index) => ({ title_id: `T${index + 1}`, title: `候选标题${index + 1}`, motivation: "balanced", method: "fixture", claim_ids: [], scores: {}, risk: "low", risk_reasons: [] })), recommendations: { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" }, ab_tests: [], same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" } };
  if (capability === "plan-wechat-images") return { plan_id: "browser_qa_wechat_plan", cover: { purpose: "fixture", strategy: "no_image", asset_id: null, image_spec_id: null }, slots: [] };
  throw Object.assign(new Error(`Unexpected fixture capability: ${capability}`), { code: "FIXTURE_CAPABILITY_UNEXPECTED" });
}

async function fixtureGenerateText(request) {
  const capability = request?.skill_runtime?.skill_name;
  const platform = capability === "write-wechat-article" || capability === "review-wechat-article" || capability === "plan-wechat-images" || JSON.stringify(request).includes("platform_brief:browser_qa_master:wechat") ? "wechat" : "xiaohongshu";
  return { mode: "fixture", data: { status: "success", data: domainOutput(capability, platform), warnings: [], blocked_reasons: [] } };
}

function seedProjectStore() {
  const store = readStore();
  const discoveryAccount = store.accounts.find((account) => (account.socialAccountId || account.id) === "acc_xhs");
  assert.ok(discoveryAccount, "the real UI's first account acc_xhs must exist in the isolated seed");
  fixtureScope = {
    workspaceId: "browser_qa_workspace",
    companyId: "browser_qa_company",
    discoveryAccountId: discoveryAccount.socialAccountId || discoveryAccount.id,
    wechatAccountId: "browser_qa_wechat",
    xhsAccountId: discoveryAccount.socialAccountId || discoveryAccount.id
  };
  discoveryAccount.companyId = fixtureScope.companyId;
  discoveryAccount.workspaceId = fixtureScope.workspaceId;
  discoveryAccount.socialAccountId ||= discoveryAccount.id;
  discoveryAccount.accountType ||= "social";
  store.accounts.push(
    { id: fixtureScope.companyId, companyId: fixtureScope.companyId, workspaceId: fixtureScope.workspaceId, accountType: "company" },
    { id: fixtureScope.wechatAccountId, socialAccountId: fixtureScope.wechatAccountId, companyId: fixtureScope.companyId, workspaceId: fixtureScope.workspaceId, accountType: "social", platform: "wechat" }
  );
  store.unifiedContentProjects = [];
  store.contentTasks = [];
  store.contentVersions = [];
  store.contentPromotions = [];
  store.contentPublications = [];
  return writeStore(store);
}

async function createFormalProductSnapshot() {
  const strategyRef = ref("browser_qa_strategy", "7");
  const sourceRef = ref("browser_qa_source", "8");
  const projectId = "browser_qa_project";
  const mechanismBase = {
    schemaVersion: "1.0", contract: "ContentMechanismDecision@1.0", id: "browser_qa_mechanism", companyId: fixtureScope.companyId,
    contentProjectRef: { id: projectId, hash: h("9") }, activeStrategySnapshotRef: strategyRef,
    evaluated: [{ candidateRefs: [sourceRef], factPolicy: null, mechanism: "knowledge", reason: "offline fixture", status: "selected" }],
    selectedMechanism: "knowledge", selectedSourceRefs: [sourceRef], strategyHotspotPolicy: "disabled",
    deviation: { reason: null, status: "none", userConfirmationStatus: "not_required" }, decidedAt: "2026-08-05T12:00:00.000Z", decisionHash: ""
  };
  const mechanismDecision = { ...mechanismBase };
  delete mechanismDecision.decisionHash;
  mechanismDecision.decisionHash = stableHash(mechanismDecision);
  setUnifiedContentServerDependenciesForTest({
    generateText: fixtureGenerateText,
    resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }),
    now: () => "2026-08-05T12:00:00.000Z"
  });
  const created = await apiRequest("/unified-content-projects", { method: "POST", body: {
    requestId: "browser_qa_request",
    orchestrationInput: {
      project: { id: projectId, companyId: fixtureScope.companyId, contentOpportunityRef: ref("browser_qa_opportunity", "6"), activeStrategySnapshotRef: strategyRef,
        accounts: { xiaohongshu: fixtureScope.xhsAccountId, wechat: fixtureScope.wechatAccountId }, platformInputs: { xiaohongshu: { purpose: "fixture" }, wechat: { purpose: "fixture" } }, confirmations: { xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" } } },
      mechanismDecision, sourcePlan: { mode: "knowledge_base", sources: [{ type: "knowledge_base", candidateIds: [sourceRef.id] }] }
    }
  } });
  contentProject = created.contentProject;
  projectRef = { id: contentProject.id, hash: contentProject.projectHash };
  sharedMasterRef = created.sharedContentMasterRef;
  const wechat = created.platforms.find((item) => item.platform === "wechat");
  const xhs = created.platforms.find((item) => item.platform === "xiaohongshu");
  wechatRunRef = wechat.platformRunRef;
  xhsRunRef = xhs.platformRunRef;
  wechatRuntimeRunRef = { id: wechatRunRef.id, hash: wechatRunRef.hash };
  xhsRuntimeRunRef = { id: xhsRunRef.id, hash: xhsRunRef.hash };
  wechatCandidateRef = wechat.candidateRefs[0];
  xhsCandidateRef = xhs.candidateRefs[0];
  articleRef = wechat.reviewInput.input.candidateSet.articleRef;
  const store = readStore();
  store.contentTasks = [{ id: "browser_qa_promotion_task", contentRunId: xhsRunRef.id, companyId: fixtureScope.companyId, accountId: fixtureScope.xhsAccountId, socialAccountId: fixtureScope.xhsAccountId, workspaceId: fixtureScope.workspaceId, platform: "xiaohongshu", version: 1, currentContent: { recommended_title: "FlowSocial 浏览器验收" } }];
  await writeStore(store);
  return created;
}

let internalBaseUrl;
async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${internalBaseUrl}/api/v1${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  assert.ok(response.ok, `${method} ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}

const previewAssets = new Map();
function collectRelativePaths(value, target = []) {
  if (!value || typeof value !== "object") return target;
  for (const [key, child] of Object.entries(value)) {
    if (key === "relativePath" && typeof child === "string") target.push(`/${child.replace(/^[/\\]+/, "").replaceAll("\\", "/")}`);
    else collectRelativePaths(child, target);
  }
  return target;
}

async function createRuntimeFacts() {
  const wechatPlan = adaptWechatImagePlanOutput({ plan_id: "browser_qa_wechat_plan", cover: { purpose: "mood", strategy: "no_image", asset_id: null }, slots: [] }, {
    skillStatus: "success",
    bindings: { contentProjectRef: projectRef, platformRunRef: wechatRuntimeRunRef, candidateRef: wechatCandidateRef, articleRef, imagePlanOutputFactRef: ref("browser_qa_wechat_skill_output", "e") }
  });
  const memoryFiles = new Map();
  const wechatRuntime = await runWechatPreuploadArtifactRuntime({
    store: createWechatArtifactFactStore(),
    planOutput: { status: "success", data: { plan_id: "browser_qa_wechat_plan", cover: { purpose: "mood", strategy: "no_image", asset_id: null }, slots: [] } },
    bindings: wechatPlan.bindings,
    article: { title: "FlowSocial 浏览器验收", body: "这是 deterministic Runtime 生成的上传前模板，不是微信最终成品。" },
    attempt: 1,
    idempotencyKeyPrefix: "browser-qa-wechat-runtime",
    recordedAt: "2026-08-05T12:30:00.000Z"
  }, {
    artifactSink: {
      async write(path, bytes) { memoryFiles.set(path, Buffer.from(bytes)); },
      async read(path) { return Buffer.from(memoryFiles.get(path)); }
    },
    resourceResolvers: {},
    formatHtml: () => "<article><h1>FlowSocial 浏览器验收</h1><p>这是 deterministic Runtime 生成的上传前模板，不是微信最终成品。</p></article>",
    qualityGates: Object.fromEntries(["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => [gate, async () => ({ status: "passed", details: { deterministicFixture: true } })]))
  });
  assert.equal(wechatRuntime.state.status, "pre_upload_review_required");
  await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/wechat/artifacts`, {
    method: "POST",
    body: { workspaceId: fixtureScope.workspaceId, companyId: fixtureScope.companyId, accountId: fixtureScope.wechatAccountId, candidateId: wechatCandidateRef.id, operation: "wechat_preupload_runtime_result", runtimeResult: wechatRuntime, idempotencyKey: "browser-qa-wechat-runtime-result" }
  });

  const xhsScope = { workspaceId: fixtureScope.workspaceId, companyId: fixtureScope.companyId, accountId: fixtureScope.xhsAccountId, candidateId: xhsCandidateRef.id };
  const xhsAuthorityScope = { workspaceId: xhsScope.workspaceId, companyId: xhsScope.companyId, accountId: xhsScope.accountId };
  const currentSnapshot = readStore().unifiedContentProjects.find((item) => item.contentProject?.id === projectRef.id);
  const designCreated = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/design`, { method: "POST", body: {
    ...xhsAuthorityScope, productSnapshotHash: currentSnapshot.productSnapshotHash, platformRunRef: xhsRuntimeRunRef, candidateRef: xhsCandidateRef,
    visualDirection: { stylePackId: "editorial-metaphor", reason: "offline browser QA fixture", pages: [1, 2].map((page) => ({ pageId: `P${page}`, archetypeId: "cover.promise", patternIds: ["pattern.hierarchy.promise-focus"], referenceAssetIds: [], verbatimTextOverride: null, stylePackId: null })) },
    idempotencyKey: "browser-qa-xhs-design"
  } });
  assert.equal(designCreated.evidence.status, "prompt_set_ready");
  assert.equal(designCreated.claims.providerCalls, 0);
  const providerPlanCreated = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/provider-plan`, { method: "POST", body: {
    ...xhsAuthorityScope, productSnapshotHash: currentSnapshot.productSnapshotHash, platformRunRef: xhsRuntimeRunRef, candidateRef: xhsCandidateRef,
    designFactRef: { id: designCreated.artifactFact.id, hash: designCreated.artifactFact.factHash }, designEvidenceRef: { id: designCreated.evidence.id, hash: designCreated.evidence.evidenceHash },
    promptSetRef: { id: designCreated.evidence.outputs.skillInvocation.promptSet.id, hash: designCreated.evidence.outputs.skillInvocation.promptSetHash }, selectedDirectionId: designCreated.providerPlanningOptions.directionCandidates[0].id,
    promptApproval: { reviewedPromptSetHash: designCreated.evidence.outputs.skillInvocation.promptSetHash, approvedBy: "human:browser-qa-fixture", approvedAt: "2026-08-05T12:31:00.000Z" },
    costConfirmation: { currency: "credits", approvedMaxTotal: 100, confirmedBy: "human:browser-qa-fixture", confirmedAt: "2026-08-05T12:31:00.000Z" }, idempotencyKey: "browser-qa-xhs-provider-plan"
  } });
  const xhsPlan = providerPlanCreated.plan;
  const fixturePng = solidRgbaPng(xhsPlan.pages[0].deliveryQualification.target.width, xhsPlan.pages[0].deliveryQualification.target.height, [72, 102, 132, 255]);
  let deterministicTransportCalls = 0;
  setUnifiedContentServerDependenciesForTest({
    xhsProviderTransportContext: { mode: "deterministic_fixture", networked: false },
    xhsProviderTransport: async (_request, context) => { deterministicTransportCalls += 1; return { status: "succeeded", provider: xhsPlan.provider.id, model: xhsPlan.provider.model, taskId: `fixture-${context.pageId}`, cost: 1, bytes: fixturePng }; },
    xhsProviderByteSink: async (payloads) => ({ status: "staged_and_hash_verified", receipts: payloads.map((payload) => ({ attemptRef: payload.attemptRef, rawSha256: payload.rawSha256, normalizedSha256: payload.normalizedSha256 })) })
  });
  for (const [index, page] of xhsPlan.pages.entries()) {
    const approval = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/provider-execution-approval`, { method: "POST", body: {
      ...xhsAuthorityScope, productSnapshotHash: currentSnapshot.productSnapshotHash, platformRunRef: xhsRuntimeRunRef, candidateRef: xhsCandidateRef,
      designFactRef: { id: designCreated.artifactFact.id, hash: designCreated.artifactFact.factHash }, designEvidenceRef: { id: designCreated.evidence.id, hash: designCreated.evidence.evidenceHash },
      providerPlanFactRef: { id: providerPlanCreated.facts.plan.id, hash: providerPlanCreated.facts.plan.factHash }, planRef: { id: xhsPlan.id, hash: xhsPlan.planHash }, targetPageIds: [page.pageId], maxProviderCalls: 1, maxCredits: 100,
      approvedBy: "human:browser-qa-fixture", approvedAt: `2026-08-05T12:${32 + index}:00.000Z`, idempotencyKey: `browser-qa-provider-approval-${page.pageId}`
    } });
    const execution = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/provider-executions`, { method: "POST", body: {
      ...xhsAuthorityScope, productSnapshotHash: currentSnapshot.productSnapshotHash, platformRunRef: xhsRuntimeRunRef, candidateRef: xhsCandidateRef,
      providerPlanFactRef: { id: providerPlanCreated.facts.plan.id, hash: providerPlanCreated.facts.plan.factHash }, approvalFactRef: { id: approval.approvalFact.id, hash: approval.approvalFact.factHash }, targetPageIds: [page.pageId], idempotencyKey: `browser-qa-provider-execution-${page.pageId}`
    } });
    assert.equal(execution.claims.networkCalls, 0);
  }
  const visualAuthority = { capability: "multimodal_vision", provider: "fixture-vision", model: "fixture-vision-1", estimatedCost: 2, currency: "credits" };
  let visualTransportCalls = 0;
  setUnifiedContentServerDependenciesForTest({
    xhsVisualReviewProviderAuthority: visualAuthority,
    xhsVisualReviewAssetReader: async () => ({ bytes: fixturePng, mediaType: "image/png" }),
    xhsVisualReviewTransportContext: { mode: "fixture_multimodal", networked: false },
    xhsVisualReviewMultimodalTransport: async (request) => {
      visualTransportCalls += 1;
      assert.equal(request.attachments.length, xhsPlan.pages.length);
      assert.ok(request.attachments.every((attachment) => Buffer.isBuffer(attachment.bytes)));
      return { status: "succeeded", provider: visualAuthority.provider, model: visualAuthority.model, mode: "fixture_multimodal", productionResult: true, pixelInputConsumed: true, cost: 1,
        output: { status: "success", data: { decision: "pass", page_findings: [], deck_findings: [], passed_checks: ["page necessity", "cross-page narrative", "visual consistency", "text-image complement", "information density", "conversion value", "fact and OCR risk"], rerun_stages: [] }, warnings: [], blocked_reasons: [] } };
    }
  });
  const visualApproval = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/visual-review-approval`, { method: "POST", body: {
    ...xhsAuthorityScope, productSnapshotHash: currentSnapshot.productSnapshotHash, platformRunRef: xhsRuntimeRunRef, candidateRef: xhsCandidateRef,
    designEvidenceRef: { id: designCreated.evidence.id, hash: designCreated.evidence.evidenceHash }, providerPlanFactRef: { id: providerPlanCreated.facts.plan.id, hash: providerPlanCreated.facts.plan.factHash }, planRef: { id: xhsPlan.id, hash: xhsPlan.planHash },
    maxCredits: 3, approvedBy: "human:browser-qa-fixture", approvedAt: "2026-08-05T12:40:00.000Z", idempotencyKey: "browser-qa-visual-review-approval"
  } });
  const visualExecution = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/visual-reviews`, { method: "POST", body: {
    ...xhsAuthorityScope, productSnapshotHash: currentSnapshot.productSnapshotHash, platformRunRef: xhsRuntimeRunRef, candidateRef: xhsCandidateRef,
    designEvidenceRef: { id: designCreated.evidence.id, hash: designCreated.evidence.evidenceHash }, providerPlanFactRef: { id: providerPlanCreated.facts.plan.id, hash: providerPlanCreated.facts.plan.factHash }, planRef: { id: xhsPlan.id, hash: xhsPlan.planHash },
    approvalFactRef: { id: visualApproval.approvalFact.id, hash: visualApproval.approvalFact.factHash }, idempotencyKey: "browser-qa-visual-review-execution"
  } });
  assert.equal(visualExecution.reviewFact.status, "skill_passed");
  assert.equal(visualTransportCalls, 1);
  const richProjection = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/artifact-review?${new URLSearchParams(xhsScope)}`);
  assert.equal(richProjection.reviewMaterial.humanReviewOpen, true);
  assert.equal(richProjection.reviewMaterial.reviewStages.skillVisualReview.status, "skill_passed");
  assert.equal(richProjection.reviewMaterial.reviewStages.skillVisualReview.revisionSetHash, visualExecution.reviewFact.revisionSetHash);
  assert.equal(richProjection.reviewMaterial.reviewStages.skillVisualReview.provider.model, visualAuthority.model);
  assert.equal(richProjection.reviewMaterial.reviewStages.skillVisualReview.usage.providerCalls, 1);
  assert.equal(richProjection.reviewMaterial.reviewStages.skillVisualReview.usage.cost.status, "known");
  assert.equal(richProjection.reviewMaterial.reviewStages.skillVisualReview.usage.cost.value, 1);
  assert.deepEqual(richProjection.reviewMaterial.reviewStages.skillVisualReview.wholeSet.findings, []);
  assert.ok(richProjection.reviewMaterial.reviewStages.skillVisualReview.wholeSet.passedChecks.includes("visual consistency"));
  assert.deepEqual(richProjection.reviewMaterial.reviewStages.skillVisualReview.wholeSet.rerunStages, []);
  assert.deepEqual(richProjection.reviewMaterial.reviewStages.skillVisualReview.pageFindings, []);
  assert.deepEqual(richProjection.reviewMaterial.reviewStages.skillVisualReview.redo.pendingPageIds, []);
  const runtimeFactStore = readStore();
  const xhsRuntime = { revisions: runtimeFactStore.unifiedContentXhsPageRevisionFacts || [], attempts: runtimeFactStore.unifiedContentXhsProviderAttemptFacts || [], counters: { networkCalls: 0 } };
  assert.equal(deterministicTransportCalls, xhsRuntime.revisions.length);
  for (const path of collectRelativePaths(xhsRuntime)) previewAssets.set(path, fixturePng);
  const runtimeStore = readStore();
  const runtimeSnapshot = runtimeStore.unifiedContentProjects.find((item) => item.contentProject?.id === projectRef.id);
  const xhsReviewInput = runtimeSnapshot.platforms.find((item) => item.platform === "xiaohongshu").reviewInput.input.candidateSet;
  xhsReviewInput.pageRevisionRefs = structuredClone(richProjection.artifactState.pageRevisionRefs);
  xhsReviewInput.artifactState = richProjection.artifactState.status;
  xhsReviewInput.items = xhsReviewInput.items.map((item, index) => ({
    ...item,
    purpose: index === 0 ? "hook" : "method",
    necessary: true,
    necessity: "necessary",
    continuityFromPrevious: true,
    visualStyleHash: h("4"),
    copyVisualRelationship: "complementary",
    informationDensity: 0.5,
    clickValue: 1,
    conversionValue: 1
  }));
  assert.equal(xhsReviewInput.pageRevisionRefs.length, xhsRuntime.revisions.length);
  const builtDeliveryBundle = buildXiaohongshuPlatformDeliveryBundle({
    schemaVersion: "1.0",
    platform: "xiaohongshu",
    platformVersionRef: xhsCandidateRef,
    promotedVersionRef: null,
    states: {
      machineReview: { status: "passed", ref: ref("browser_qa_delivery_machine", "a") },
      editorialReview: { status: "passed", ref: ref("browser_qa_delivery_editorial", "b") },
      userSelection: { status: "selected", ref: ref("browser_qa_delivery_selection", "c") },
      promotion: { status: "not_promoted", ref: null },
      publication: { status: "not_published", ref: null }
    },
    copy: { title: "FlowSocial 浏览器验收", body: "隔离 fixture 的晋升正文。", tags: ["浏览器验收"], pinnedComment: "fixture only" },
    selection: { pageRevisionRefs: xhsReviewInput.pageRevisionRefs },
    pages: xhsRuntime.revisions.map((revision, index) => ({
      pageId: revision.pageId,
      fileName: `${revision.pageId}.png`,
      bytes: fixturePng,
      revisionRef: xhsReviewInput.pageRevisionRefs[index]
    }))
  });
  runtimeSnapshot.platforms.find((item) => item.platform === "xiaohongshu").reviewInput.input.promotion = {
    contentTaskId: "browser_qa_promotion_task",
    provenance: "native_shared_master",
    deliveryBundle: { ...builtDeliveryBundle, files: builtDeliveryBundle.files.map(({ content: _content, ...file }) => file) }
  };
  const runtimeSnapshotBase = structuredClone(runtimeSnapshot);
  delete runtimeSnapshotBase.productSnapshotHash;
  runtimeSnapshot.productSnapshotHash = stableHash(runtimeSnapshotBase);
  await writeStore(runtimeStore);
  return { wechatRuntime, xhsRuntime, deterministicTransportCalls, visualTransportCalls };
}

let proxyServer;
let closing = false;
let contentReviewSummary = null;
let promotionSummary = null;
let publicationFeedbackSummary = null;
async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve) => server.close(() => resolve()));
}

async function shutdown({ exitCode = 0 } = {}) {
  if (closing) return;
  closing = true;
  await closeServer(proxyServer);
  await closeServer(applicationServer);
  database.close();
  await rm(dataDir, { recursive: true, force: true });
  if (!options.selfCheck) process.exit(exitCode);
}

try {
  if (!options.flagOff) await seedProjectStore();
  await new Promise((resolve, reject) => applicationServer.listen(0, "127.0.0.1", resolve).once("error", reject));
  internalBaseUrl = `http://127.0.0.1:${applicationServer.address().port}`;
  if (!options.flagOff) await createFormalProductSnapshot();
  const runtimeSummary = options.flagOff ? null : await createRuntimeFacts();

  proxyServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const preview = previewAssets.get(decodeURIComponent(requestUrl.pathname));
    if (preview) {
      response.writeHead(200, { "content-type": "image/png", "content-length": preview.length, "cache-control": "no-store" });
      response.end(preview);
      return;
    }
    const upstream = http.request(`${internalBaseUrl}${request.url || "/"}`, {
      method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${applicationServer.address().port}` }
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on("error", (error) => {
      if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message, fixture_not_live: true }));
    });
    request.pipe(upstream);
  });
  await new Promise((resolve, reject) => proxyServer.listen(options.port, "127.0.0.1", resolve).once("error", reject));
  const url = `http://127.0.0.1:${options.port}/`;

  if (options.selfCheck) {
    const healthResponse = await fetch(`${url}api/v1/health`);
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(health.featureFlags.unifiedContentArtifactsV1, !options.flagOff);
    assert.equal(health.featureFlags.contentPromotionV1, !options.flagOff);
  }
  if (options.selfCheck && !options.flagOff) {
    const preActionStore = readStore();
    assert.equal(preActionStore.unifiedContentReviews?.length || 0, 0, "fixture startup must not prewrite reviews");
    assert.equal(preActionStore.unifiedContentSelections?.length || 0, 0, "fixture startup must not prewrite selections");
    assert.equal(preActionStore.contentPromotions?.length || 0, 0, "fixture startup must not prewrite promotions");
    assert.equal(preActionStore.contentVersions?.length || 0, 0, "fixture startup must not prewrite immutable versions");
    assert.equal(preActionStore.contentPublications?.length || 0, 0, "fixture startup must not prewrite publications");
    const projects = await apiRequest(`/unified-content-projects?${new URLSearchParams({ companyId: fixtureScope.companyId, accountId: fixtureScope.discoveryAccountId })}`);
    const projectItems = Array.isArray(projects) ? projects : projects.items;
    assert.ok(Array.isArray(projectItems) && projectItems.some((item) => item.contentProject?.id === projectRef.id));
    const wechatReview = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/wechat/artifact-review?${new URLSearchParams({ workspaceId: fixtureScope.workspaceId, companyId: fixtureScope.companyId, accountId: fixtureScope.wechatAccountId, candidateId: wechatCandidateRef.id })}`);
    const xhsReview = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/artifact-review?${new URLSearchParams({ workspaceId: fixtureScope.workspaceId, companyId: fixtureScope.companyId, accountId: fixtureScope.xhsAccountId, candidateId: xhsCandidateRef.id })}`);
    assert.equal(wechatReview.reviewMaterial.sixGates.length, 6);
    assert.equal(wechatReview.reviewMaterial.previewArtifact.contract, "UnifiedWechatPreUploadPreviewArtifact@1.0");
    assert.equal(wechatReview.reviewMaterial.previewArtifact.semantics, "pre_upload_template_not_wechat_final");
    assert.match(wechatReview.reviewMaterial.previewArtifact.previewHtml, /Content-Security-Policy/);
    assert.match(wechatReview.reviewMaterial.previewArtifact.previewHtml, /FlowSocial 浏览器验收/);
    assert.equal(wechatReview.reviewMaterial.previewArtifact.sandbox, "");
    assert.equal(xhsReview.reviewMaterial.pages.length, runtimeSummary.xhsRuntime.revisions.length);
    assert.equal(xhsReview.artifactState.selectable, false);
    const xhsActionScope = { workspaceId: fixtureScope.workspaceId, companyId: fixtureScope.companyId, accountId: fixtureScope.xhsAccountId, candidateId: xhsCandidateRef.id };
    const xhsApproval = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/artifact-review`, {
      method: "POST",
      body: {
        ...xhsActionScope,
        artifactStateHash: xhsReview.artifactState.artifactStateHash,
        reviewerId: "human:browser-qa-self-check",
        reason: "deterministic fixture pages passed browser QA self-check",
        action: "approve_set",
        payload: {},
        idempotencyKey: "browser-qa-xhs-approve"
      }
    });
    assert.equal(xhsApproval.artifactReview.artifactState.selectable, true);
    const contentReview = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/reviews`, {
      method: "POST",
      body: { ...xhsActionScope, idempotencyKey: "browser-qa-xhs-content-review" }
    });
    assert.equal(contentReview.created, true);
    assert.deepEqual(contentReview.reviewFact.candidateRef, xhsCandidateRef);
    assert.equal(contentReview.reviewFact.artifactStateHash, xhsApproval.artifactReview.artifactState.artifactStateHash);
    assert.deepEqual(contentReview.reviewFact.sharedContentMasterRef, sharedMasterRef);
    assert.equal(contentReview.reviewFact.state, "editorial_review_passed", JSON.stringify(contentReview.reviewFact));
    const selection = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/selections`, {
      method: "POST",
      body: { ...xhsActionScope, reviewId: contentReview.reviewFact.id, actorId: "human:browser-qa-self-check", action: "confirm_selection", idempotencyKey: "browser-qa-xhs-selection" }
    });
    assert.equal(selection.created, true);
    assert.deepEqual(selection.selectionFact.candidateRef, xhsCandidateRef);
    assert.equal(selection.selectionFact.reviewFactRef.id, contentReview.reviewFact.id);
    assert.equal(selection.selectionFact.reviewFactRef.hash, contentReview.reviewFact.factHash);
    assert.equal(selection.selectionFact.artifactStateHash, xhsApproval.artifactReview.artifactState.artifactStateHash);
    assert.deepEqual(selection.selectionFact.sharedContentMasterRef, sharedMasterRef);
    assert.deepEqual(selection.selectionFact.selectionGate.userSelection.pageRevisionRefs, xhsApproval.artifactReview.artifactState.pageRevisionRefs);
    assert.equal(selection.selectionFact.status, "selected");
    const beforePromotionPreview = readStore();
    const beforePromotionCounts = {
      reviews: beforePromotionPreview.unifiedContentReviews?.length || 0,
      selections: beforePromotionPreview.unifiedContentSelections?.length || 0,
      promotions: beforePromotionPreview.contentPromotions?.length || 0,
      versions: beforePromotionPreview.contentVersions?.length || 0,
      publications: beforePromotionPreview.contentPublications?.length || 0
    };
    const promotionScope = { ...xhsActionScope, selectionId: selection.selectionFact.id };
    const promotionPreview = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/promotion-preview`, {
      method: "POST",
      body: promotionScope
    });
    assert.equal(promotionPreview.claims.writesPerformed, false);
    assert.equal(promotionPreview.claims.platformPublicationPerformed, false);
    assert.deepEqual(promotionPreview.bindings.candidateVersionRef, xhsCandidateRef);
    assert.equal(promotionPreview.bindings.editorialReviewRef.id, contentReview.reviewFact.editorialReview.id);
    assert.equal(promotionPreview.bindings.userSelectionRef.id, selection.selectionFact.selectionGate.userSelection.id);
    const afterPreviewStore = readStore();
    assert.deepEqual({
      reviews: afterPreviewStore.unifiedContentReviews?.length || 0,
      selections: afterPreviewStore.unifiedContentSelections?.length || 0,
      promotions: afterPreviewStore.contentPromotions?.length || 0,
      versions: afterPreviewStore.contentVersions?.length || 0,
      publications: afterPreviewStore.contentPublications?.length || 0
    }, beforePromotionCounts, "promotion preview must perform zero writes");
    const promotionIdempotencyKey = "browser-qa-xhs-promotion";
    const promotion = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/promotion-confirm`, {
      method: "POST",
      body: { ...promotionScope, previewToken: promotionPreview.previewToken, idempotencyKey: promotionIdempotencyKey }
    });
    assert.equal(promotion.created, true);
    assert.deepEqual(promotion.promotion.contentProjectRef, projectRef);
    assert.deepEqual(promotion.promotion.platformRunRef, xhsRuntimeRunRef);
    assert.deepEqual(promotion.promotion.promotedVersionRef, { id: promotion.contentVersion.id, hash: promotion.contentVersion.versionHash });
    const promotionReplay = await apiRequest(`/unified-content-projects/${projectRef.id}/platforms/xiaohongshu/promotion-confirm`, {
      method: "POST",
      body: { ...promotionScope, previewToken: promotionPreview.previewToken, idempotencyKey: promotionIdempotencyKey }
    });
    assert.equal(promotionReplay.created, false);
    assert.equal(promotionReplay.promotion.id, promotion.promotion.id);
    const promotedStore = readStore();
    assert.equal(promotedStore.contentPromotions.length, 1);
    assert.equal(promotedStore.contentVersions.length, 1);
    assert.equal(promotedStore.contentPublications.length, 0);
    const publishedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const cutoffAt = new Date(Date.parse(publishedAt) + 3 * 24 * 60 * 60 * 1000).toISOString();
    const publicationPayload = {
      status: "published",
      platform: "xiaohongshu",
      platformContentId: "691bdec00000000004013cbd",
      url: "https://www.xiaohongshu.com/discovery/item/691bdec00000000004013cbd",
      publishedAt,
      promotionId: promotion.promotion.id,
      promotedVersionRef: promotion.promotion.promotedVersionRef,
      idempotencyKey: "browser-qa-manual-publication",
      note: "fixture only: user-confirmed manual publication record; no platform API call"
    };
    const publication = await apiRequest("/content-tasks/browser_qa_promotion_task/publications", { method: "POST", body: publicationPayload });
    const publicationReplay = await apiRequest("/content-tasks/browser_qa_promotion_task/publications", { method: "POST", body: publicationPayload });
    assert.equal(publicationReplay.id, publication.id);
    assert.equal(publication.promotionStatus, "promoted_exact_version");
    assert.deepEqual(publication.promotionRecordRef, { id: promotion.promotion.id, hash: promotion.promotion.promotionHash });
    assert.deepEqual(publication.promotedVersionRef, promotion.promotion.promotedVersionRef);
    const queriedPublications = await apiRequest("/content-tasks/browser_qa_promotion_task/publications");
    assert.equal(queriedPublications.items.length, 1);
    assert.equal(queriedPublications.items[0].id, publication.id);
    const feedbackPayload = {
      measurementWindow: "72h", cutoffAt, views: 240, impressions: 480, likes: 24, saves: 18,
      comments: 6, shares: 3, platformMetrics: { coverClicks: 72, profileVisits: 19 },
      source: "manual", userFeedback: { qualitativeResult: "fixture-only qualitative result" }
    };
    const feedback = await apiRequest(`/content-publications/${publication.id}/metrics`, { method: "POST", body: feedbackPayload });
    const feedbackReplay = await apiRequest(`/content-publications/${publication.id}/metrics`, { method: "POST", body: feedbackPayload });
    assert.equal(feedbackReplay.snapshot.id, feedback.snapshot.id);
    assert.equal(feedbackReplay.publication.metricHistory.length, 1);
    const feedbackRevision = await apiRequest(`/content-publications/${publication.id}/metrics`, { method: "POST", body: { ...feedbackPayload, views: 260 } });
    assert.equal(feedbackRevision.snapshot.revision, 2);
    assert.equal(feedbackRevision.snapshot.supersedesSnapshotId, feedback.snapshot.id);
    assert.equal(feedbackRevision.publication.metricHistory.length, 2);
    const refreshedPublications = await apiRequest("/content-tasks/browser_qa_promotion_task/publications");
    assert.equal(refreshedPublications.items[0].metricHistory.length, 2);
    publicationFeedbackSummary = {
      manualRecordOnly: true,
      publicationId: publication.id,
      promotionRecordRef: publication.promotionRecordRef,
      promotedVersionRef: publication.promotedVersionRef,
      publishedAt: publication.publishedAt,
      platformContentId: publication.platformContentId,
      idempotentPublicationReplay: true,
      idempotentFeedbackReplay: true,
      feedbackRevisions: refreshedPublications.items[0].metricHistory.length
    };
    promotionSummary = {
      previewReadOnly: true,
      candidateId: promotionPreview.bindings.candidateVersionRef.id,
      selectionId: selection.selectionFact.id,
      promotionId: promotion.promotion.id,
      promotedVersionRef: promotion.promotion.promotedVersionRef,
      idempotentReplay: true,
      publicationRegistered: true
    };
    contentReviewSummary = {
      created: true,
      state: contentReview.reviewFact.state,
      candidateId: contentReview.reviewFact.candidateRef.id,
      artifactStateHash: contentReview.reviewFact.artifactStateHash,
      selectionAttempted: true,
      selectionCreated: true,
      selectionId: selection.selectionFact.id,
      reviewId: contentReview.reviewFact.id
    };
    assert.ok(previewAssets.size > 0);
    const previewResponse = await fetch(new URL(previewAssets.keys().next().value, url));
    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get("content-type"), "image/png");
  }
  if (!options.selfCheck) {
    const ordinaryStore = readStore();
    assert.equal(contentReviewSummary, null, "ordinary fixture startup must remain unreviewed");
    assert.equal(promotionSummary, null, "ordinary fixture startup must remain unpromoted");
    assert.equal(publicationFeedbackSummary, null, "ordinary fixture startup must remain unpublished and without feedback");
    assert.equal(ordinaryStore.unifiedContentReviews?.length || 0, 0);
    assert.equal(ordinaryStore.unifiedContentSelections?.length || 0, 0);
    assert.equal(ordinaryStore.contentPromotions?.length || 0, 0);
    assert.equal(ordinaryStore.contentVersions?.length || 0, 0);
    assert.equal(ordinaryStore.contentPublications?.length || 0, 0);
  }
  if (options.selfCheck && options.flagOff) {
    const flagOffStore = readStore();
    assert.equal(flagOffStore.unifiedContentReviews?.length || 0, 0);
    assert.equal(flagOffStore.unifiedContentSelections?.length || 0, 0);
    assert.equal(flagOffStore.contentPromotions?.length || 0, 0);
    assert.equal(flagOffStore.contentVersions?.length || 0, 0);
    assert.equal(flagOffStore.contentPublications?.length || 0, 0);
    assert.equal(publicationFeedbackSummary, null);
  }

  console.log(JSON.stringify({
    status: options.selfCheck ? "self_check_passed" : "ready",
    url,
    dataDir,
    mode: options.flagOff ? "flag_off" : "flag_on",
    fixture_not_live: true,
    deterministicRuntimeFacts: !options.flagOff,
    deterministicTransportCalls: runtimeSummary?.deterministicTransportCalls || 0,
    deterministicVisualReviewCalls: runtimeSummary?.visualTransportCalls || 0,
    networkCalls: 0,
    realProviderCalls: 0,
    platformCalls: 0,
    productionDatabaseCalls: 0,
    projectId: options.flagOff ? null : projectRef.id,
    discoveryScope: options.flagOff ? null : { companyId: fixtureScope.companyId, accountId: fixtureScope.discoveryAccountId },
    contentReview: options.flagOff ? null : contentReviewSummary,
    promotion: options.flagOff ? null : promotionSummary,
    publicationFeedback: options.flagOff ? null : publicationFeedbackSummary,
    candidates: options.flagOff ? null : {
      wechat: [wechatCandidateRef.id, wechatBlockedCandidateRef.id],
      xiaohongshu: [xhsCandidateRef.id, xhsBlockedCandidateRef.id]
    }
  }, null, 2));

  if (options.selfCheck) await shutdown();
  else {
    process.once("SIGINT", () => void shutdown({ exitCode: 0 }));
    process.once("SIGTERM", () => void shutdown({ exitCode: 0 }));
  }
} catch (error) {
  console.error(error);
  await shutdown({ exitCode: 1 });
  process.exitCode = 1;
}
