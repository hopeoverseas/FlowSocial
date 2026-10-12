import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSavedContentPromotionRequest } from "../../content-agent/content-review-store.mjs";
import { withUnifiedContentHash } from "../../content-agent/unified-content-contracts.mjs";

const dataDir = await mkdtemp(join(tmpdir(), "flowsocial-unified-review-"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "1";
process.env.CONTENT_PROMOTION_V1 = "1";
process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "0";

const { server, setUnifiedContentServerDependenciesForTest } = await import("../../server.mjs");
const { database, readStore, writeStore } = await import("../../storage.mjs");

const h = (letter) => letter.repeat(64);
const ref = (id, letter) => ({ id, hash: h(letter) });

function domainOutput(capability, platform) {
  if (capability === "build-content-master") return {
    content_master_id: "review_master",
    topic_id: "topic_review",
    intent_profile_id: "intent_review",
    platform: "xiaohongshu",
    content_purpose: { id: "knowledge_howto", label: "fixture", description: "fixture" },
    target_audience: ["fixture"], central_question: "fixture", central_thesis: "fixture", reader_value: "fixture", content_emphasis: [],
    strategy_alignment: { content_function: "authority", platform_role: "shared", conversion_stage: { id: "trust", label: "trust", action: "read" }, evidence_requirement: "source", purpose_eligible: true, user_override_applied: false },
    confirmed_facts: [{ fact_id: "F001", fact: "fixture fact", source_ids: ["SRC001"] }],
    supported_interpretations: [], author_opinions: [], unknowns: [], examples: [],
    knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] },
    promotion: { mode: "none", insertion_rule: "do_not_mention", allowed_items: [], allowed_claims: [], forbidden_claims: [], disclosure: "" },
    engagement_policy: { mode: "auto", optimize_for: ["finish"], selected_primary_action: "none", cta_rule: "select_one_primary_action_naturally" },
    claims_to_avoid: [], publish_time_checks: [], source_list: [{ source_id: "SRC001", title: "fixture source" }]
  };
  if (capability === "generate-content-outline") return { id: `outline_${platform}`, sections: [{ id: "s1", heading: "fixture" }] };
  if (capability === "write-xhs-content") return {
    platform: "xiaohongshu",
    post_copy: { title_candidates: [1, 2, 3].map((id) => ({ title: `xhs${id}`, hook_type: "result", claim_ids: [], risk: "low" })), recommended_title: "xhs1", opening: "fixture", body_sections: [{ section_id: "S1", role: "method", text: "fixture", claim_ids: [] }], ending: "", pinned_comment: "", hashtags: [], cta: "" },
    deck: { deck_id: "deck_review", pages: [{ page: 1, role: "cover", objective: "fixture", takeaway: "fixture", text_layers: [], render_strategy: "html_css" }] }
  };
  if (capability === "write-wechat-article") return {
    platform: "wechat_official_account",
    title_candidates: [{ title: "wechat", approach: "method", claim_ids: [], risk: "low" }],
    recommended_title: "wechat",
    outline: [{ section_id: "W1", heading: "fixture", purpose: "fixture", relation_to_previous: "start", claim_ids: [], boundary_to_cover: "" }],
    article_markdown: "## fixture\n\nfixture",
    preflight_checks: []
  };
  if (capability === "review-wechat-article") return { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
  if (capability === "generate-platform-titles") return { stage: "final_after_body", platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu", title_brief: {}, candidates: Array.from({ length: 5 }, (_, index) => ({ title_id: `T${index + 1}`, title: `fixture${index + 1}` })), recommendations: { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" } };
  if (capability === "plan-wechat-images") return { plan_id: "wechat_images", cover: { purpose: "fixture", strategy: "no_image", asset_id: null, image_spec_id: null }, slots: [] };
  throw new Error(`unexpected fixture capability ${capability}`);
}

async function fixtureGenerateText(request) {
  const capability = request?.skill_runtime?.skill_name;
  const platform = ["write-wechat-article", "review-wechat-article", "plan-wechat-images"].includes(capability) || JSON.stringify(request).includes("platform_brief:review_master:wechat") ? "wechat" : "xiaohongshu";
  return { mode: "fixture", data: { status: "success", data: domainOutput(capability, platform), warnings: [], blocked_reasons: [] } };
}

const strategyRef = ref("strategy_review", "a");
const sourceRef = ref("source_review", "b");

function reviewInput(platform, { redundant = false, omitImagePlan = false } = {}) {
  const candidateSet = {
    titleRef: ref(`title_${platform}`, "d"),
    bodyVersionRef: ref(`body_${platform}`, "e"),
    pageRevisionRefs: platform === "xiaohongshu" ? [ref("page_xhs_1", "f")] : [],
    items: [{
      id: `item_${platform}_1`,
      order: 1,
      purpose: "hook",
      necessary: !redundant,
      necessity: redundant ? "redundant" : "necessary",
      continuityFromPrevious: true,
      visualStyleHash: h("1"),
      copyVisualRelationship: "complementary",
      informationDensity: 0.5,
      clickValue: 1,
      conversionValue: 1
    }]
  };
  if (platform === "wechat") {
    candidateSet.articleRef = ref("article_wechat", "2");
    candidateSet.imagePlanRef = omitImagePlan ? null : ref("image_plan_wechat", "3");
  }
  return candidateSet;
}

function projectRequest(requestId, projectId, options = {}) {
  const mechanismDecision = withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: "ContentMechanismDecision@1.0",
    id: `mechanism_${projectId}`,
    companyId: "company_review",
    contentProjectRef: ref(projectId, "c"),
    activeStrategySnapshotRef: strategyRef,
    evaluated: [{ candidateRefs: [sourceRef], factPolicy: null, mechanism: "knowledge", reason: "fixture", status: "selected" }],
    selectedMechanism: "knowledge",
    selectedSourceRefs: [sourceRef],
    strategyHotspotPolicy: "disabled",
    deviation: { reason: null, status: "none", userConfirmationStatus: "not_required" },
    decidedAt: "2026-08-05T12:00:00.000Z",
    decisionHash: ""
  }, "decisionHash");
  return {
    requestId,
    orchestrationInput: {
      project: {
        id: projectId,
        companyId: "company_review",
        contentOpportunityRef: ref(`opportunity_${projectId}`, "4"),
        activeStrategySnapshotRef: strategyRef,
        accounts: { xiaohongshu: "account_review_xhs", wechat: "account_review_wechat" },
        platformInputs: { xiaohongshu: {}, wechat: {} },
        confirmations: { xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" } }
      },
      mechanismDecision,
      sourcePlan: { mode: "knowledge_base", sources: [{ type: "knowledge_base", candidateIds: [sourceRef.id] }] }
    },
    reviewInputs: {
      xiaohongshu: reviewInput("xiaohongshu", options.xiaohongshu),
      wechat: reviewInput("wechat", options.wechat)
    }
  };
}

async function json(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

const scope = { workspaceId: "workspace_review", companyId: "company_review" };
let baseUrl;
try {
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  setUnifiedContentServerDependenciesForTest({ generateText: fixtureGenerateText, resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }), now: () => "2026-08-05T12:00:00.000Z" });
  const created = await json("/unified-content-projects", { method: "POST", body: projectRequest("request_review", "project_review") });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const store = readStore();
  store.accounts.push(
    { id: "company_review", companyId: "company_review", workspaceId: scope.workspaceId, accountType: "company", name: "Review fixture" },
    { id: "account_review_xhs", socialAccountId: "account_review_xhs", companyId: "company_review", workspaceId: scope.workspaceId, accountType: "social", platform: "xiaohongshu" },
    { id: "account_review_wechat", socialAccountId: "account_review_wechat", companyId: "company_review", workspaceId: scope.workspaceId, accountType: "social", platform: "wechat" }
  );
  await writeStore(store);

  const xhsCandidate = created.data.platforms.find((item) => item.platform === "xiaohongshu").candidateRefs[0];
  const wechatCandidate = created.data.platforms.find((item) => item.platform === "wechat").candidateRefs[0];
  const xhsScope = { ...scope, accountId: "account_review_xhs" };
  const wechatScope = { ...scope, accountId: "account_review_wechat" };

  process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "0";
  const reviewDisabled = await json("/unified-content-projects/project_review/platforms/xiaohongshu/reviews", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidate.id, idempotencyKey: "review-disabled" } });
  assert.equal(reviewDisabled.response.status, 404);
  assert.equal(reviewDisabled.data.code, "UNIFIED_CONTENT_PRODUCTION_DISABLED");
  process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "1";
  const xhsReview = await json("/unified-content-projects/project_review/platforms/xiaohongshu/reviews", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidate.id, idempotencyKey: "review-xhs-1" } });
  assert.equal(xhsReview.response.status, 201, JSON.stringify(xhsReview.data));
  assert.equal(xhsReview.data.reviewFact.editorialReview, null);
  assert.equal(xhsReview.data.reviewFact.state, "machine_review_blocked");
  assert.equal(xhsReview.data.reviewFact.machineGate.checks.find((item) => item.id === "rendered_visual_artifacts").status, "failed");
  const xhsReviewRetry = await json("/unified-content-projects/project_review/platforms/xiaohongshu/reviews", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidate.id, idempotencyKey: "review-xhs-1" } });
  assert.equal(xhsReviewRetry.response.status, 200);
  assert.equal(xhsReviewRetry.data.reviewFact.factHash, xhsReview.data.reviewFact.factHash);

  const crossPlatform = await json("/unified-content-projects/project_review/platforms/xiaohongshu/reviews", { method: "POST", body: { ...xhsScope, candidateId: wechatCandidate.id, idempotencyKey: "cross-platform" } });
  assert.equal(crossPlatform.response.status, 409);
  assert.equal(crossPlatform.data.code, "UNIFIED_REVIEW_CANDIDATE_STALE_OR_CROSS_PLATFORM");
  const crossAccount = await json("/unified-content-projects/project_review/platforms/xiaohongshu/reviews", { method: "POST", body: { ...wechatScope, candidateId: xhsCandidate.id, idempotencyKey: "cross-account" } });
  assert.equal(crossAccount.response.status, 403);
  const crossWorkspace = await json("/unified-content-projects/project_review/platforms/xiaohongshu/reviews", { method: "POST", body: { ...xhsScope, workspaceId: "workspace_other", candidateId: xhsCandidate.id, idempotencyKey: "cross-workspace" } });
  assert.equal(crossWorkspace.response.status, 403);

  const xhsSelectionBlocked = await json("/unified-content-projects/project_review/platforms/xiaohongshu/selections", { method: "POST", body: { ...xhsScope, candidateId: xhsCandidate.id, reviewId: xhsReview.data.reviewFact.id, actorId: "user_review", action: "confirm_selection", idempotencyKey: "select-xhs-blocked" } });
  assert.equal(xhsSelectionBlocked.response.status, 409);
  assert.equal(xhsSelectionBlocked.data.code, "UNIFIED_SELECTION_EDITORIAL_REVIEW_MISSING");

  const wechatReview = await json("/unified-content-projects/project_review/platforms/wechat/reviews", { method: "POST", body: { ...wechatScope, candidateId: wechatCandidate.id, idempotencyKey: "review-wechat-1" } });
  assert.equal(wechatReview.response.status, 201, JSON.stringify(wechatReview.data));
  assert.equal(wechatReview.data.reviewFact.editorialReview.dimensions.length, 6);
  assert.equal(wechatReview.data.reviewFact.state, "changes_required");
  assert.equal(wechatReview.data.reviewFact.editorialReview.status, "changes_required");
  assert.ok(wechatReview.data.reviewFact.editorialReview.dimensions.some((item) => item.status === "failed"), "Flag off must preserve the original review semantics");
  const wechatSelected = await json("/unified-content-projects/project_review/platforms/wechat/selections", { method: "POST", body: { ...wechatScope, candidateId: wechatCandidate.id, reviewId: wechatReview.data.reviewFact.id, actorId: "user_review", action: "selected", idempotencyKey: "select-wechat-blocked" } });
  assert.equal(wechatSelected.response.status, 400);
  assert.equal(wechatSelected.data.code, "UserSelectionGate:EDITORIAL_REVIEW_REQUIRED");

  const newerReview = await json("/unified-content-projects/project_review/platforms/wechat/reviews", { method: "POST", body: { ...wechatScope, candidateId: wechatCandidate.id, idempotencyKey: "review-wechat-2" } });
  assert.equal(newerReview.response.status, 201);
  const staleSelection = await json("/unified-content-projects/project_review/platforms/wechat/selections", { method: "POST", body: { ...wechatScope, candidateId: wechatCandidate.id, reviewId: wechatReview.data.reviewFact.id, actorId: "user_review", action: "selected", idempotencyKey: "stale-selection" } });
  assert.equal(staleSelection.response.status, 409);
  assert.equal(staleSelection.data.code, "UNIFIED_SELECTION_STALE_OR_CROSS_PLATFORM_REVIEW");
  assert.throws(() => buildSavedContentPromotionRequest(readStore(), { ...wechatScope, projectId: "project_review", platform: "wechat", candidateId: wechatCandidate.id, selectionId: "selection_does_not_exist" }), { code: "UNIFIED_PROMOTION_SELECTION_STALE_OR_CROSS_PLATFORM" });
  const latestSelected = await json("/unified-content-projects/project_review/platforms/wechat/selections", { method: "POST", body: { ...wechatScope, candidateId: wechatCandidate.id, reviewId: newerReview.data.reviewFact.id, actorId: "user_review", action: "selected", idempotencyKey: "select-wechat-latest" } });
  assert.equal(latestSelected.response.status, 400);
  assert.equal(latestSelected.data.code, "UserSelectionGate:EDITORIAL_REVIEW_REQUIRED");

  const stateQuery = new URLSearchParams(wechatScope);
  const state = await json(`/unified-content-projects/project_review/platforms/wechat/review-state?${stateQuery}`);
  assert.equal(state.response.status, 200);
  assert.equal(state.data.reviewFacts.length, 2);
  assert.equal(state.data.selectionFacts.length, 0);

  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";
  const multiCandidateStore = readStore();
  const multiCandidatePlatform = multiCandidateStore.unifiedContentProjects
    .find((item) => item.contentProject.id === "project_review").platforms
    .find((item) => item.platform === "xiaohongshu");
  const secondXhsCandidate = ref("candidate_review_xhs_2", "9");
  multiCandidatePlatform.candidateRefs.push(secondXhsCandidate);
  await writeStore(multiCandidateStore);
  const ambiguousReviewState = await json(`/unified-content-projects/project_review/platforms/xiaohongshu/review-state?${new URLSearchParams(xhsScope)}`);
  assert.equal(ambiguousReviewState.response.status, 409);
  assert.equal(ambiguousReviewState.data.code, "UNIFIED_ARTIFACT_CANDIDATE_AMBIGUOUS");
  const exactReviewState = await json(`/unified-content-projects/project_review/platforms/xiaohongshu/review-state?${new URLSearchParams({ ...xhsScope, candidateId: xhsCandidate.id })}`);
  assert.equal(exactReviewState.response.status, 200, JSON.stringify(exactReviewState.data));
  assert.ok(exactReviewState.data.reviewFacts.length > 0);
  assert.ok(exactReviewState.data.reviewFacts.every((item) => item.candidateRef.id === xhsCandidate.id));

  const blocked = await json("/unified-content-projects", { method: "POST", body: projectRequest("request_blocked", "project_blocked", { xiaohongshu: { redundant: true }, wechat: { omitImagePlan: true } }) });
  assert.equal(blocked.response.status, 201);
  const blockedCandidate = blocked.data.platforms.find((item) => item.platform === "xiaohongshu").candidateRefs[0];
  const blockedReview = await json("/unified-content-projects/project_blocked/platforms/xiaohongshu/reviews", { method: "POST", body: { ...xhsScope, candidateId: blockedCandidate.id, idempotencyKey: "review-blocked" } });
  assert.equal(blockedReview.response.status, 201);
  assert.equal(blockedReview.data.reviewFact.editorialReview, null);
  const blockedSelection = await json("/unified-content-projects/project_blocked/platforms/xiaohongshu/selections", { method: "POST", body: { ...xhsScope, candidateId: blockedCandidate.id, reviewId: blockedReview.data.reviewFact.id, actorId: "user_review", action: "selected", idempotencyKey: "select-blocked" } });
  assert.equal(blockedSelection.response.status, 409);
  assert.equal(blockedSelection.data.code, "UNIFIED_SELECTION_EDITORIAL_REVIEW_MISSING");
  const machineBlockedCandidate = blocked.data.platforms.find((item) => item.platform === "wechat").candidateRefs[0];
  const machineBlocked = await json("/unified-content-projects/project_blocked/platforms/wechat/reviews", { method: "POST", body: { ...wechatScope, candidateId: machineBlockedCandidate.id, idempotencyKey: "review-machine-blocked" } });
  assert.equal(machineBlocked.response.status, 201);
  assert.equal(machineBlocked.data.reviewFact.state, "machine_review_blocked", "without verified Artifact facts, forged caller inputs remain blocked");
  assert.equal(machineBlocked.data.reviewFact.editorialReview, null);

  assert.equal((readStore().contentTasks || []).some((item) => item.id === "content_task_review_wechat"), false, "review API must not fabricate or mutate legacy content tasks");
  console.log(JSON.stringify({ status: "unified-content-review-api-self-test passed", reviews: readStore().unifiedContentReviews.length, selections: readStore().unifiedContentSelections.length, platforms: ["xiaohongshu", "wechat"] }, null, 2));
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  database.close();
  await rm(dataDir, { recursive: true, force: true });
}
