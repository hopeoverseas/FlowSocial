import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUnifiedWriterContext, hashUnifiedContent, withUnifiedContentHash } from "../../content-agent/unified-content-contracts.mjs";
import { createAtomicProviderTextGenerator } from "../../providers.mjs";
import { invokeLlm } from "../../llm/gateway.mjs";
import { createUnifiedAtomicContentCommit } from "../../content-agent/unified-atomic-content-commit-store.mjs";
import { projectAtomicFeedbackPublications } from "../../content-agent/atomic-feedback-workspace-adapter.mjs";
import { normalizePerformanceSnapshot } from "../../content-agent/feedback-engine.mjs";
import { solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { appendUnifiedContentXhsProviderExecutionApproval, executeUnifiedContentXhsProviderExecution } from "../../content-agent/unified-content-xhs-provider-execution.mjs";
import { appendUnifiedContentXhsVisualReviewApproval, executeUnifiedContentXhsVisualReview } from "../../content-agent/unified-content-xhs-visual-review.mjs";
import { deriveUnifiedPlatformCandidate, validateUnifiedSkillDomainOutput } from "../../content-agent/unified-skill-output-contracts.mjs";
import { adaptAuthoritativeWechatImagePlanOutput, hashWechatArtifactValue } from "../../content-agent/wechat-image-plan-adapter.mjs";
import { createFilesystemWechatPreuploadArtifactSink, runWechatPreuploadArtifactRuntime } from "../../content-agent/wechat-preupload-artifact-runtime.mjs";
import { XHS_COMPONENT_SELF_TEST_CLAIMS } from "./xhs-content-components-self-test.mjs";
import { confirmUnifiedStagedAtomicDualBootstrap, createUnifiedStagedAtomicDualBootstrap, resumeUnifiedStagedAtomicDualBootstrap } from "../../content-agent/unified-atomic-multiplatform-product.mjs";

assert.deepEqual(XHS_COMPONENT_SELF_TEST_CLAIMS, {
  providerCalls: 0,
  externalCalls: 0,
  databaseWrites: 0,
  orchestratorChanges: 0,
  legacyV2Mutation: false
}, "split XHS component contracts must remain an offline, additive foundation before feature integration");

const dataDir = await mkdtemp(join(tmpdir(), "flowsocial-unified-content-product-"));
process.env.FLOWSOCIAL_DATA_DIR = dataDir;
process.env.FLOWSOCIAL_TEST_MODE = "1";
process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "0";
process.env.UNIFIED_CONTENT_PREREQUISITES_V1 = "0";
process.env.UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1 = "0";
process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "0";
process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = "0";
process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "0";
process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1 = "0";
process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1 = "0";
process.env.ATOMIC_WECHAT_DRAFT_CREATION_V1 = "0";
process.env.ATOMIC_MANUAL_PUBLICATION_V1 = "0";
process.env.ATOMIC_EXACT_FEEDBACK_V1 = "0";
process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = "0";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = "0";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = "0";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_APPROVAL_V1 = "0";
process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1 = "0";
process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1 = "0";
process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1 = "0";
process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = "0";
process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = "0";
process.env.XHS_VISUAL_ASSET_REGISTRY = "0";
process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = "0";

const { server, setUnifiedContentServerDependenciesForTest } = await import("../../server.mjs");
const { database, readStore, writeStore } = await import("../../storage.mjs");

const prerequisiteCompany = { id: "prerequisite_company_fixture", companyId: "prerequisite_company_fixture", accountType: "company", activeStrategySnapshotId: "prerequisite_strategy_fixture" };
function confirmedDesignDnaFixture(accountId, id) {
  return {
    kind: "DesignDNA", schemaVersion: "1.0", id, accountId, version: 1, status: "confirmed",
    colors: ["#18352d", "暖白"], fontPreferences: ["无衬线标题", "清晰正文"], layoutPreferences: ["稳定网格", "充足留白"],
    materials: ["纸张"], photographyOrIllustrationDirection: "克制的编辑式插画", forbiddenMotifs: ["伪文字", "水印"],
    referenceNotes: "fixture reference", approvedTextSummary: "fixture approved visual summary", sources: [],
    authorization: { approvedFileIds: [], excludedFileIds: [], providerReferenceImageSupported: false, referenceImagesTransmitted: false, externalInputMode: "approved_text_summary_only", disclosure: "fixture" },
    confirmation: { decision: "confirmed", confirmedBy: "fixture_user", note: "fixture", confirmedAt: "2026-08-05T00:00:00.000Z" },
    createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z"
  };
}
const prerequisiteDesignDnaSnapshot = confirmedDesignDnaFixture("prerequisite_xhs_fixture", "dna_prerequisite_fixture_v1");
const confirmedDesignDnaSnapshot = confirmedDesignDnaFixture("xhs_account_fixture", "dna_fixture_v1");
const prerequisiteDesignDnaSnapshotRef = { id: prerequisiteDesignDnaSnapshot.id, hash: hashUnifiedContent(prerequisiteDesignDnaSnapshot) };
const confirmedDesignDnaSnapshotRef = { id: confirmedDesignDnaSnapshot.id, hash: hashUnifiedContent(confirmedDesignDnaSnapshot) };
const prerequisiteXhs = { id: "prerequisite_xhs_fixture", companyId: prerequisiteCompany.id, platform: "xiaohongshu", status: "active", visualStyle: { name: "账号视觉系统", description: "fixture", designDnaSnapshotId: prerequisiteDesignDnaSnapshot.id, designDnaVersion: 1 } };
const prerequisiteWechat = { id: "prerequisite_wechat_fixture", companyId: prerequisiteCompany.id, platform: "wechat", status: "active" };
prerequisiteXhs.subjectType = "company_official";
prerequisiteXhs.accountIdentity = { subjectType: "company_official", trustSources: ["institution"] };
prerequisiteWechat.subjectType = "founder_ip";
prerequisiteWechat.accountIdentity = { subjectType: "founder_ip", trustSources: ["founder_experience"] };
const prerequisiteSeed = readStore();
prerequisiteSeed.accounts ||= [];
prerequisiteSeed.designDnaSnapshots ||= [];
prerequisiteSeed.designDnaSnapshots.push(prerequisiteDesignDnaSnapshot, confirmedDesignDnaSnapshot);
prerequisiteSeed.accounts.push(
  prerequisiteCompany,
  prerequisiteXhs,
  prerequisiteWechat,
  { id: "company_fixture", companyId: "company_fixture", accountType: "company", workspaceId: "workspace_default" },
  { id: "xhs_account_fixture", companyId: "company_fixture", platform: "xiaohongshu", status: "active", workspaceId: "workspace_default", subjectType: "company_official", accountIdentity: { subjectType: "company_official", trustSources: ["institution"] }, visualStyle: { name: "账号视觉系统", description: "fixture", designDnaSnapshotId: confirmedDesignDnaSnapshot.id, designDnaVersion: 1 } },
  { id: "wechat_account_fixture", companyId: "company_fixture", platform: "wechat", status: "active", workspaceId: "workspace_default", subjectType: "founder_ip", accountIdentity: { subjectType: "founder_ip", trustSources: ["founder_experience"] } }
);
writeStore(prerequisiteSeed);
const prerequisiteStrategyPayload = { schemaVersion: "2.0", strategyHotspotPolicy: "optional" };
database.prepare("INSERT INTO strategy_snapshots (id,account_id,version,status,payload_json,source_session_id,created_at,confirmed_at) VALUES (?,?,1,'active',?,NULL,?,?)").run(
  prerequisiteCompany.activeStrategySnapshotId,
  prerequisiteCompany.id,
  JSON.stringify(prerequisiteStrategyPayload),
  "2026-08-06T00:00:00.000Z",
  "2026-08-06T00:00:00.000Z"
);

const OUTLINE_WRITER_ROLE_CASES = Object.freeze([
  { outlineRole: "hook", bodyRole: "scene", pageRole: "cover" },
  { outlineRole: "problem", bodyRole: "problem", pageRole: "problem" },
  { outlineRole: "diagnosis", bodyRole: "conclusion", pageRole: "conclusion" },
  { outlineRole: "evidence", bodyRole: "evidence", pageRole: "evidence" },
  { outlineRole: "method", bodyRole: "method", pageRole: "method" },
  { outlineRole: "example", bodyRole: "evidence", pageRole: "case" },
  { outlineRole: "action", bodyRole: "summary", pageRole: "cta" },
  { outlineRole: "boundary", bodyRole: "warning", pageRole: "warning" }
]);
const PRODUCT_WRITER_ROLE_CASES = Object.freeze(OUTLINE_WRITER_ROLE_CASES.filter((item) => !["method", "boundary"].includes(item.outlineRole)));

function outlineOutput(platform, overrides = {}) {
  const value = {
    outline_id: `outline_${platform}`,
    schema_version: "1.0",
    platform,
    topic: "fixture topic",
    content_promise: "fixture promise",
    content_function: "authority",
    content_purpose_id: "knowledge_howto",
    conversion_stage_id: "trust",
    opening_strategy: "problem first",
    sections: PRODUCT_WRITER_ROLE_CASES.map(({ outlineRole }, index) => ({
      section_id: `S${index + 1}`,
      heading: `fixture heading ${index + 1}`,
      role: outlineRole,
      objective: `fixture objective ${index + 1}`,
      key_points: [],
      claim_ids: [],
      boundary: ""
    })),
    closing_strategy: "summary",
    unresolved_questions: [],
    confirmation_required: true
  };
  return { ...value, ...structuredClone(overrides) };
}

function xhsWriterOutput(overrides = {}) {
  const pages = PRODUCT_WRITER_ROLE_CASES.map(({ pageRole }, index) => ({
    page: index + 1,
    role: pageRole,
    objective: `fixture objective ${index + 1}`,
    takeaway: `fixture takeaway ${index + 1}`,
    text_layers: index === 0
      ? [{ type: "headline", text: "结果0", max_lines: 3, priority: 1 }]
      : [
          { type: "headline", text: `测试页面${index + 1}`, max_lines: 3, priority: 1 },
          { type: "body", text: `页面说明${index + 1}`, max_lines: 4, priority: 2 },
          { type: "footer", text: "页脚", max_lines: 1, priority: 3 }
        ],
    layout_hint: "fixture layout",
    visual_function: index === 0 ? "attention" : "explain",
    visual_need: "fixture visual",
    render_strategy: index === 2 ? "generated_raster" : "html_css",
    asset_ids: index === 2 ? ["xhs-deck-fixture-p03-bg"] : [],
    fact_ids: index === 1 ? ["F001"] : [],
    interpretation_ids: [],
    must_avoid: []
  }));
  const value = {
    platform: "xiaohongshu",
    topic_id: "opportunity_1",
    intent_profile_id: "project_input_fixture",
    content_purpose_id: "knowledge_howto",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "discovery_and_validation", trust_source: "institution" },
    creative_mechanism: "search_answer",
    journey_stage: "discover",
    matrix_coordination: { shared_campaign_topic_id: "opportunity_1", differentiation_angle: "discovery_and_validation:场景触达与需求验证", prohibited_overlap: [] },
    content_promise: "fixture promise",
    engagement_strategy: { mode: "auto", primary_action: "save", reason: "fixture reason", cta_placement: "ending", cta_text: "保存备用" },
    post_copy: {
      title_candidates: ["结果", "问题", "清单"].map((title, index) => ({ title: `${title}${index}`, hook_type: index === 1 ? "problem" : index === 2 ? "checklist" : "result", claim_ids: [], risk: "low" })),
      recommended_title: "结果0",
      opening: "fixture opening",
      body_sections: PRODUCT_WRITER_ROLE_CASES.map(({ bodyRole }, index) => ({ section_id: `S${index + 1}`, role: bodyRole, text: `fixture body ${index + 1}`, claim_ids: ["F001"] })),
      ending: "fixture ending",
      pinned_comment: "",
      hashtags: ["fixture", "method", "knowledge"],
      cta: "保存备用"
    },
    deck: { deck_id: "deck_fixture", canvas: { width: 1080, height: 1440, ratio: "3:4" }, design_dna_version: "dna_fixture_v1", reading_arc: "promise-method-summary", pages },
    image_specs: [{
      asset_id: "xhs-deck-fixture-p03-bg", page: 3, use_case: "stylized-concept", asset_type: "scene-illustration",
      scene: "fixture scene", subject: "fixture subject", style_and_medium: "fixture style", composition: "fixture composition",
      lighting: "fixture lighting", palette: ["neutral"], materials: "fixture material", text_safe_area: "center",
      prompt: "fixture image without text", negative_prompt: "text, letters, numbers, watermark, logo, interface screenshot, illegible symbols",
      reference_asset_ids: [], design_dna_version: "dna_fixture_v1", size: "1024x1536", must_keep: [], must_avoid: [], text_policy: "no_text_in_image"
    }],
    skipped_image_pages: pages.filter((page) => page.page !== 3).map((page) => ({ page: page.page, reason: "html_css" })),
    traceability: { used_fact_ids: ["F001"], used_interpretation_ids: [], used_knowledge_asset_ids: [], page_claim_map: pages.map((page) => ({ page: page.page, claim_ids: page.fact_ids })) },
    preflight_checks: [
      "promise_consistency", "claim_traceability", "image_text_separation", "page_non_repetition",
      "intent_and_promotion_alignment", "account_identity_alignment", "matrix_differentiation"
    ].map((check) => ({ check, result: "pass", detail: "fixture pass" }))
  };
  return { ...value, ...structuredClone(overrides) };
}

function titleOutput(platform, overrides = {}) {
  const motivations = ["balanced", "safe", "spread", "search", "evergreen"];
  const value = {
    stage: "final_after_body",
    platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu",
    title_brief: {
      content_type: "fixture guide",
      target_reader: "fixture reader",
      core_conclusion: "fixture conclusion",
      reader_takeaway: "fixture takeaway",
      strongest_evidence: ["F001"],
      real_entities: [],
      freshness_dependency: "none"
    },
    candidates: motivations.map((motivation, index) => ({
      title_id: `T${index + 1}`,
      title: `${platform} final title ${index + 1}`,
      motivation,
      method: `fixture ${motivation}`,
      claim_ids: ["F001"],
      scores: { fulfillment: 5, relevance: 5, specificity: 4, curiosity: 3, clarity: 5, uniqueness: 4, overall: 5 },
      risk: "low",
      risk_reasons: []
    })),
    recommendations: { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" },
    ab_tests: [{ title_a: "T1", title_b: "T5", single_variable: "motivation", hypothesis: "balanced is clearer" }],
    same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" }
  };
  return { ...value, ...structuredClone(overrides) };
}

function wechatWriterOutput(overrides = {}) {
  const outline = ["问题", "方法", "边界"].map((heading, index) => ({
    section_id: `W${index + 1}`,
    heading,
    purpose: `fixture purpose ${index + 1}`,
    relation_to_previous: index === 0 ? "start" : index === 2 ? "limit" : "explain",
    claim_ids: index < 2 ? ["F001"] : [],
    boundary_to_cover: index === 2 ? "fixture boundary" : ""
  }));
  const value = {
    platform: "wechat_official_account",
    topic_id: "opportunity_1",
    intent_profile_id: "project_input_fixture",
    content_purpose_id: "knowledge_howto",
    account_context: { subject_type: "founder", account_mode: "founder_ip", matrix_role: "authority_and_conversion", trust_source: "experience" },
    creative_mechanism: "framework",
    journey_stage: "convert",
    matrix_coordination: { shared_campaign_topic_id: "opportunity_1", differentiation_angle: "authority_and_conversion:深度权威与业务承接", prohibited_overlap: [] },
    article_promise: "fixture promise",
    core_argument: "fixture argument",
    information_gain: "fixture information gain",
    title_candidates: ["方法", "问题", "结论"].map((title, index) => ({ title: `公众号${title}${index + 1}`, approach: index === 0 ? "method" : index === 1 ? "question" : "conclusion", claim_ids: ["F001"], risk: "low" })),
    recommended_title: "公众号方法1",
    abstract: "fixture abstract with independent reader value",
    opening: { type: "conclusion", text: "fixture opening", claim_ids: ["F001"] },
    outline,
    article_markdown: outline.map((item) => `## ${item.heading}\n\nfixture section ${item.section_id}`).join("\n\n"),
    pull_quotes: [{ text: "fixture quote", claim_ids: ["F001"] }],
    key_takeaways: ["fixture takeaway"],
    share_summary: "fixture share summary",
    share_reason: "fixture share reason",
    discovery_plan: { subscription_value: "fixture subscription value", search_keywords: ["fixture keyword"], recommendation_hook: "fixture hook", social_sharing_context: "fixture sharing context" },
    relationship_handoff: { column: "", related_content_ids: [], menu_path: "", keyword_reply: "", follow_reason: "fixture follow reason", primary_next_step: "fixture next step" },
    engagement_strategy: { mode: "auto", primary_action: "share", reason: "fixture reason", cta_placement: "ending", cta_text: "fixture cta" },
    cta: "fixture cta",
    claim_map: [{ claim_id: "F001", section_ids: ["W1", "W2"] }],
    used_knowledge_asset_ids: [],
    source_list: [{ source_id: "SRC001", title: "fixture source" }],
    publish_time_checks: [{ fact_id: "F001", reason: "fixture freshness", check_before: "publish" }],
    preflight_checks: ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"].map((check) => ({ check, result: ["marketing_disclosure", "relationship_handoff_validity"].includes(check) ? "not_applicable" : "pass", detail: "fixture" }))
  };
  return { ...value, ...structuredClone(overrides) };
}

function domainOutput(capability, platform) {
  if (capability === "build-content-master") return {
    content_master_id: "shared_master_fixture",
    topic_id: "topic_fixture",
    intent_profile_id: "intent_fixture",
    platform: "xiaohongshu",
    content_purpose: { id: "knowledge_howto", label: "fixture", description: "fixture" },
    target_audience: ["fixture"],
    central_question: "fixture",
    central_thesis: "统一母版只生成一次",
    reader_value: "fixture",
    content_emphasis: [],
    strategy_alignment: { content_function: "authority", platform_role: "shared", conversion_stage: { id: "trust", label: "trust", action: "read" }, evidence_requirement: "source", purpose_eligible: true, user_override_applied: false },
    confirmed_facts: [{ fact_id: "F001", fact: "fixture fact", source_ids: ["SRC001"] }],
    supported_interpretations: [],
    author_opinions: [],
    unknowns: [], examples: [],
    knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] },
    promotion: { mode: "none", insertion_rule: "do_not_mention", allowed_items: [], allowed_claims: [], forbidden_claims: [], disclosure: "" },
    engagement_policy: { mode: "auto", optimize_for: ["finish"], selected_primary_action: "none", cta_rule: "select_one_primary_action_naturally" },
    claims_to_avoid: [], publish_time_checks: [], source_list: [{ source_id: "SRC001", title: "fixture source" }]
  };
  if (capability === "generate-content-outline") return outlineOutput(platform);
  if (capability === "write-xhs-content") return xhsWriterOutput();
  if (capability === "write-wechat-article") return wechatWriterOutput();
  if (capability === "review-wechat-article") return { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
  if (capability === "generate-platform-titles") return titleOutput(platform);
  if (capability === "plan-wechat-images") return { plan_id: "wechat_image_plan_1", cover: { purpose: "explain", strategy: "html_chart", asset_id: "wechat_cover_chart", claim_ids: [], image_spec: null }, slots: [{ slot_id: "wechat_inline_chart", after_section_id: "W1", purpose: "explain", strategy: "html_chart", claim_ids: [], asset_id: "wechat_inline_chart", image_spec: null }] };
  throw Object.assign(new Error(`Unexpected fixture capability: ${capability}`), { code: "FIXTURE_CAPABILITY_UNEXPECTED" });
}

const capabilityCalls = new Map();
const titleRuntimeRequests = [];
const wechatRuntimeRequests = [];
const xhsWriterRuntimeRequests = [];
async function fixtureGenerateText(request) {
  const capability = request?.skill_runtime?.skill_name;
  const serializedRequest = JSON.stringify(request);
  const platform = capability === "write-wechat-article" || capability === "review-wechat-article" || capability === "plan-wechat-images" || serializedRequest.includes("platform_brief:shared_master_fixture:wechat") || serializedRequest.includes('"platform":"wechat_official_account"') ? "wechat" : "xiaohongshu";
  capabilityCalls.set(capability, (capabilityCalls.get(capability) || 0) + 1);
  if (capability === "generate-platform-titles") titleRuntimeRequests.push(structuredClone(request));
  if (capability === "write-xhs-content") xhsWriterRuntimeRequests.push(structuredClone(request));
  if (["write-wechat-article", "review-wechat-article", "plan-wechat-images"].includes(capability)) wechatRuntimeRequests.push(structuredClone(request));
  const output = domainOutput(capability, platform);
  return { mode: "real_offline_adapter", data: { status: capability === "generate-content-outline" ? "ready" : "success", data: output, warnings: [], blocked_reasons: [] } };
}

async function atomicFixtureGenerateText(request) {
  const capability = request?.skill_runtime?.skill_name;
  if (capability === "plan-wechat-images" && JSON.stringify(request).includes("atomic_wechat_brief")) {
    return { mode: "real_offline_adapter", data: { status: "success", data: {
      plan_id: "atomic_wechat_image_plan_1",
      cover: { purpose: "explain", strategy: "html_chart", asset_id: "atomic-cover-chart", claim_ids: [], image_spec: null },
      slots: [{ slot_id: "AW1", after_section_id: "W1", purpose: "prove", strategy: "html_chart", claim_ids: ["F001"], asset_id: "atomic-chart-1", image_spec: null }]
    }, warnings: [], blocked_reasons: [] } };
  }
  if (capability === "generate-platform-titles") {
    const platform = request?.input?.platform === "wechat_official_account" ? "wechat" : "xiaohongshu";
    const output = titleOutput(platform);
    output.title_brief.core_conclusion = "原子内容结论";
    output.title_brief.reader_takeaway = "可执行的方法";
    output.candidates = ["原子内容方法", "六步完成内容", "内容质量清单", "稳定产出方法", "团队执行指南"].map((title, index) => ({ ...output.candidates[index], title }));
    output.recommendations = { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" };
    return { mode: "real_offline_adapter", data: { status: "success", data: output, warnings: [], blocked_reasons: [] } };
  }
  if (!["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"].includes(capability)) return fixtureGenerateText(request);
  const outline = request.input?.confirmed_outline;
  const sections = outline?.sections || request.input?.post_copy?.bodySections?.map((item) => ({ section_id: item.sectionId, role: item.outlineRole })) || [];
  const role = Object.fromEntries(PRODUCT_WRITER_ROLE_CASES.map((item) => [item.outlineRole, item]));
  let data;
  if (capability === "write-xhs-post-copy") data = {
    schemaVersion: "1.0", contract: "XhsPostCopyCreativeOutput@1.0", contentPromise: outline.content_promise,
    engagementStrategy: { mode: "auto", primaryAction: "save", reason: "便于执行", ctaPlacement: "ending", ctaText: "保存清单" },
    titleCandidates: ["原子内容方法", "六步完成内容", "内容质量清单"].map((title, index) => ({ title, hookType: ["result", "problem", "checklist"][index], claimIds: ["F001"], risk: "low" })),
    recommendedTitle: "原子内容方法", opening: "先确认内容目标。",
    bodySections: sections.map((item, index) => ({ sectionId: item.section_id, outlineRole: item.role, role: role[item.role].bodyRole, text: `第${index + 1}步的执行说明`, claimIds: index === 0 ? ["F001"] : [], knowledgeAssetIds: [] })),
    ending: "按清单逐项完成。", pinnedComment: "", hashtags: ["内容方法", "执行清单", "质量管理"], cta: "保存清单", promotionUse: { mode: "none", itemIds: [], disclosure: "" }
  };
  else if (capability === "plan-xhs-carousel") data = {
    schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", deck_id: "atomic-deck", reading_arc: "promise-action",
    section_drafts: sections.map((item, index) => ({ objective: `说明第${index + 1}步`, takeaway: `完成第${index + 1}步`, text_layers: [{ type: "headline", text: index === 0 ? "原子内容方法" : `第${index + 1}步`, max_lines: 2, priority: 1 }], layout_hint: "清晰留白", fact_ids: index === 0 ? ["F001"] : [], interpretation_ids: [], knowledge_asset_ids: [] }))
  };
  else data = {
    schemaVersion: "1.0", contract: "XhsVisualAssetPlanCreativeOutput@1.0",
    pageVisuals: PRODUCT_WRITER_ROLE_CASES.map((_, index) => ({ page: index + 1, visualFunction: "explain", visualNeed: `解释第${index + 1}步`, renderStrategy: "html_css", mustKeep: [], mustAvoid: [] })),
    imageSpecs: [], skippedPages: PRODUCT_WRITER_ROLE_CASES.map((_, index) => ({ page: index + 1, reason: "html_css" })),
    pageAssetBindings: PRODUCT_WRITER_ROLE_CASES.map((_, index) => ({ page: index + 1, plannedAssetIds: [] }))
  };
  return { mode: "real_offline_adapter", data: { status: "success", data, warnings: [], blocked_reasons: [] } };
}

function findNested(value, predicate) {
  if (predicate(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const child of Object.values(value)) {
    const found = findNested(child, predicate);
    if (found) return found;
  }
  return null;
}

const canonicalOutlineEnvelope = { status: "ready", data: outlineOutput("xiaohongshu"), warnings: [], blocked_reasons: [] };
const mappedCanonicalOutline = validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: canonicalOutlineEnvelope });
assert.equal(mappedCanonicalOutline.id, canonicalOutlineEnvelope.data.outline_id);
assert.equal(mappedCanonicalOutline.sections[0].id, canonicalOutlineEnvelope.data.sections[0].section_id);
assert.equal(Object.hasOwn(canonicalOutlineEnvelope.data, "id"), false, "external canonical outline must remain immutable and must not acquire an internal alias");
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: { status: "success", data: { id: "legacy_outline", sections: [{ id: "S1", heading: "legacy" }] }, warnings: [], blocked_reasons: [] } }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details?.fieldPaths?.includes("status")
);
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@9.9", runtimeOutput: canonicalOutlineEnvelope }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["outputContract"])
);
for (const status of ["needs_review", "blocked"]) {
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "generate-content-outline", platform: "xiaohongshu", outputContract: "ContentOutline@1.0", runtimeOutput: { status, data: {}, warnings: [], blocked_reasons: [] } }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["status"])
  );
}

const canonicalWriterEnvelope = { status: "success", data: xhsWriterOutput(), warnings: [], blocked_reasons: [] };
const canonicalWriterBefore = structuredClone(canonicalWriterEnvelope);
const canonicalWriter = validateUnifiedSkillDomainOutput({
  capability: "write-xhs-content",
  platform: "xiaohongshu",
  outputContract: "XhsPostPackage@2.0",
  runtimeOutput: canonicalWriterEnvelope,
  sourceContentMaster: domainOutput("build-content-master", "xiaohongshu")
});
assert.deepEqual(canonicalWriter, canonicalWriterEnvelope.data);
assert.deepEqual(canonicalWriterEnvelope, canonicalWriterBefore, "canonical Runtime Output Fact source must remain unchanged");
assert.deepEqual(canonicalWriter.post_copy.body_sections.map((item) => item.role), PRODUCT_WRITER_ROLE_CASES.map((item) => item.bodyRole));
assert.deepEqual(canonicalWriter.deck.pages.map((item) => item.role), PRODUCT_WRITER_ROLE_CASES.map((item) => item.pageRole));
const allHtmlWriter = xhsWriterOutput();
for (const page of allHtmlWriter.deck.pages) {
  page.render_strategy = "html_css";
  page.asset_ids = [];
}
allHtmlWriter.image_specs = [];
allHtmlWriter.skipped_image_pages = allHtmlWriter.deck.pages.map((page) => ({ page: page.page, reason: "html_css" }));
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0",
  runtimeOutput: { status: "success", data: allHtmlWriter, warnings: [], blocked_reasons: [] },
  sourceContentMaster: domainOutput("build-content-master", "xiaohongshu")
}), "all-html deck with an empty ImageSpec list must remain valid");

const xhsNestedShapeTargets = [
  {
    name: "title_candidates", containerPath: "data.post_copy.title_candidates", itemPath: "data.post_copy.title_candidates[]",
    read: (value) => value.post_copy.title_candidates, write: (value, replacement) => { value.post_copy.title_candidates = replacement; }
  },
  {
    name: "body_sections", containerPath: "data.post_copy.body_sections", itemPath: "data.post_copy.body_sections[]",
    read: (value) => value.post_copy.body_sections, write: (value, replacement) => { value.post_copy.body_sections = replacement; }
  },
  {
    name: "deck.pages", containerPath: "data.deck.pages", itemPath: "data.deck.pages[]",
    read: (value) => value.deck.pages, write: (value, replacement) => { value.deck.pages = replacement; }
  },
  {
    name: "text_layers", containerPath: "data.deck.pages[].text_layers", itemPath: "data.deck.pages[].text_layers",
    read: (value) => value.deck.pages[0].text_layers, write: (value, replacement) => { value.deck.pages[0].text_layers = replacement; }
  },
  {
    name: "image_specs", containerPath: "data.image_specs", itemPath: "data.image_specs[]",
    read: (value) => value.image_specs, write: (value, replacement) => { value.image_specs = replacement; }
  },
  {
    name: "skipped_image_pages", containerPath: "data.skipped_image_pages", itemPath: "data.skipped_image_pages[]",
    read: (value) => value.skipped_image_pages, write: (value, replacement) => { value.skipped_image_pages = replacement; }
  },
  {
    name: "page_claim_map", containerPath: "data.traceability.page_claim_map", itemPath: "data.traceability.page_claim_map[]",
    read: (value) => value.traceability.page_claim_map, write: (value, replacement) => { value.traceability.page_claim_map = replacement; }
  },
  {
    name: "preflight_checks", containerPath: "data.preflight_checks", itemPath: "data.preflight_checks[]",
    read: (value) => value.preflight_checks, write: (value, replacement) => { value.preflight_checks = replacement; }
  }
];
for (const target of xhsNestedShapeTargets) {
  for (const { shape, replacement } of [
    { shape: "null container", replacement: null },
    { shape: "primitive container", replacement: "invalid" },
    { shape: "object instead of array", replacement: {} }
  ]) {
    const invalid = xhsWriterOutput();
    target.write(invalid, replacement);
    assert.throws(
      () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
      (error) => error.name !== "TypeError"
        && error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
        && JSON.stringify(error.details?.fieldPaths) === JSON.stringify([target.containerPath]),
      `${target.name} ${shape} must fail at its safe container path`
    );
  }
  for (const { shape, replaceItem } of [
    { shape: "null item", replaceItem: () => null },
    { shape: "primitive item", replaceItem: () => 7 },
    { shape: "missing-key item", replaceItem: (item) => { const result = structuredClone(item); delete result[Object.keys(result)[0]]; return result; } }
  ]) {
    const invalid = xhsWriterOutput();
    const items = target.read(invalid);
    items[0] = replaceItem(items[0]);
    assert.throws(
      () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
      (error) => error.name !== "TypeError"
        && error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
        && JSON.stringify(error.details?.fieldPaths) === JSON.stringify([target.itemPath]),
      `${target.name} ${shape} must fail at its safe item path`
    );
  }
}

for (const { name, expectedPath, mutate } of [
  { name: "missing spec", expectedPath: "data.image_spec_alignment.spec_count", mutate: (value) => { value.image_specs = []; } },
  { name: "duplicate spec page", expectedPath: "data.image_spec_alignment.spec_page_uniqueness", mutate: (value) => { value.image_specs.push(structuredClone(value.image_specs[0])); } },
  { name: "spec page mismatch", expectedPath: "data.image_spec_alignment.generated_page_coverage", mutate: (value) => { value.image_specs[0].page = 2; } },
  { name: "spec asset mismatch", expectedPath: "data.image_spec_alignment.page_asset_binding", mutate: (value) => { value.image_specs[0].asset_id = "PRIVATE_MISMATCHED_ASSET"; } },
  { name: "multiple generated-page assets", expectedPath: "data.image_spec_alignment.single_asset_per_generated_page", mutate: (value) => { value.deck.pages[2].asset_ids.push("PRIVATE_EXTRA_ASSET"); } },
  { name: "ImageSpec Design DNA mismatch", expectedPath: "data.image_spec_alignment.design_dna_version", mutate: (value) => { value.image_specs[0].design_dna_version = "PRIVATE_WRONG_DNA"; } }
]) {
  const invalid = xhsWriterOutput();
  mutate(invalid);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
      && error.details?.fieldPaths?.includes(expectedPath)
      && !JSON.stringify(error.details).includes("PRIVATE_"),
    `${name} must fail at a fixed safe ImageSpec alignment leaf path`
  );
}

const requiredXhsPreflightChecks = ["promise_consistency", "claim_traceability", "image_text_separation", "page_non_repetition", "intent_and_promotion_alignment", "account_identity_alignment", "matrix_differentiation"];
const missingEvidenceRoots = xhsWriterOutput();
delete missingEvidenceRoots.traceability;
delete missingEvidenceRoots.preflight_checks;
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: missingEvidenceRoots, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["data.traceability", "data.preflight_checks"])
    && error.name !== "TypeError"
);
for (const { name, mutate } of [
  { name: "duplicate", mutate: (value) => { value.preflight_checks.push(structuredClone(value.preflight_checks[0])); } },
  { name: "unknown", mutate: (value) => { value.preflight_checks[0].check = "PRIVATE_UNKNOWN_CHECK"; } }
]) {
  const invalid = xhsWriterOutput();
  mutate(invalid);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
      && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["data.preflight_checks[].check"])
      && !JSON.stringify(error.details).includes("PRIVATE_"),
    `${name} XHS preflight name must fail at the safe exact-set path`
  );
}
const matrixNotApplicableWriter = xhsWriterOutput();
matrixNotApplicableWriter.preflight_checks.find((item) => item.check === "matrix_differentiation").result = "not_applicable";
assert.doesNotThrow(() => validateUnifiedSkillDomainOutput({
  capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0",
  runtimeOutput: { status: "success", data: matrixNotApplicableWriter, warnings: [], blocked_reasons: [] },
  sourceContentMaster: domainOutput("build-content-master", "xiaohongshu")
}), "matrix differentiation may be not_applicable for a successful package");
for (const check of requiredXhsPreflightChecks) {
  const missing = xhsWriterOutput();
  missing.preflight_checks = missing.preflight_checks.filter((item) => item.check !== check);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: missing, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details?.fieldPaths?.includes(`data.preflight_checks.${check}`),
    `missing ${check} must fail at its fixed safe preflight leaf path`
  );

  for (const result of check === "matrix_differentiation" ? ["fail"] : ["fail", "not_applicable"]) {
    const invalidResult = xhsWriterOutput();
    invalidResult.preflight_checks.find((item) => item.check === check).result = result;
    assert.throws(
      () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalidResult, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
      (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && error.details?.fieldPaths?.includes(`data.preflight_checks.${check}`),
      `${result} success result for ${check} must fail at its fixed safe preflight leaf path`
    );
  }
}
for (const field of ["warnings", "blocked_reasons"]) {
  const invalid = structuredClone(canonicalWriterEnvelope);
  delete invalid[field];
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: invalid }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify([field])
  );
}
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@9.9", runtimeOutput: canonicalWriterEnvelope }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["outputContract"])
);
for (const status of ["partial", "failed", "needs_review"]) {
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status, data: {}, warnings: [], blocked_reasons: [] } }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["status"])
  );
}
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: { platform: "xiaohongshu", post_copy: {}, deck: { pages: [] }, image_specs: [], skipped_image_pages: [], traceability: {}, preflight_checks: [] }, warnings: [], blocked_reasons: [] } }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && error.details?.fieldPaths?.includes("data.topic_id")
    && !error.details?.fieldPaths?.includes("data")
);
for (const mutate of [
  (value) => { value.deck.pages[2].asset_ids = []; },
  (value) => { value.traceability.used_fact_ids = ["UNKNOWN_FACT"]; value.deck.pages[1].fact_ids = ["UNKNOWN_FACT"]; },
  (value) => { value.deck.pages.splice(5); value.skipped_image_pages = value.skipped_image_pages.filter((item) => item.page <= 5); value.traceability.page_claim_map.splice(5); }
]) {
  const invalid = xhsWriterOutput();
  mutate(invalid);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
  );
}
for (const { path, expectedPaths = [path], mutate } of [
  { path: "data.post_copy.body_sections[].section_id", mutate: (value) => { value.post_copy.body_sections[1].section_id = ""; } },
  { path: "data.post_copy.body_sections[].role", mutate: (value) => { value.post_copy.body_sections[1].role = "hook"; } },
  { path: "data.post_copy.body_sections[].text", mutate: (value) => { value.post_copy.body_sections[1].text = ""; } },
  { path: "data.post_copy.body_sections[].claim_ids", mutate: (value) => { value.post_copy.body_sections[1].claim_ids = null; } },
  { path: "data.deck.pages[].role", mutate: (value) => { value.deck.pages[1].role = "hook"; } },
  { path: "data.deck.pages[].objective", mutate: (value) => { value.deck.pages[1].objective = ""; } },
  { path: "data.deck.pages[].takeaway", mutate: (value) => { value.deck.pages[1].takeaway = ""; } },
  { path: "data.deck.pages[].layout_hint", mutate: (value) => { value.deck.pages[1].layout_hint = ""; } },
  { path: "data.deck.pages[].visual_function", mutate: (value) => { value.deck.pages[1].visual_function = "illustrate"; } },
  { path: "data.deck.pages[].visual_need", mutate: (value) => { value.deck.pages[1].visual_need = null; } },
  { path: "data.deck.pages[].render_strategy", mutate: (value) => { value.deck.pages[1].render_strategy = "image"; } },
  { path: "data.deck.pages[].must_avoid", mutate: (value) => { value.deck.pages[1].must_avoid = null; } }
]) {
  const invalid = xhsWriterOutput();
  mutate(invalid);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(expectedPaths),
    `${path} must fail closed at its safe field path`
  );
}
const unknownBodyClaim = xhsWriterOutput();
unknownBodyClaim.post_copy.body_sections[1].claim_ids = ["UNKNOWN_CLAIM"];
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: unknownBodyClaim, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu") }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["data.reference_integrity"])
);
const opinionMaster = domainOutput("build-content-master", "xiaohongshu");
opinionMaster.author_opinions = [{ opinion_id: "OP001", opinion: "fixture opinion" }];
for (const { location, mutate } of [
  { location: "title", mutate: (value) => { value.post_copy.title_candidates[0].claim_ids = ["OP001"]; } },
  { location: "body", mutate: (value) => { value.post_copy.body_sections[1].claim_ids = ["OP001"]; } },
  { location: "page claim map", mutate: (value) => { value.traceability.page_claim_map[0].claim_ids = ["OP001"]; } }
]) {
  const opinionClaim = xhsWriterOutput();
  mutate(opinionClaim);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: opinionClaim, warnings: [], blocked_reasons: [] }, sourceContentMaster: opinionMaster }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["data.reference_integrity"]),
    `XHS v2.0 must reject opinion IDs in ${location} because it has no versioned opinion trace field`
  );
}
const unusedAuthorizedFactMaster = domainOutput("build-content-master", "xiaohongshu");
unusedAuthorizedFactMaster.confirmed_facts.push({ fact_id: "F_UNUSED", fact: "unused fixture fact", source_ids: ["SRC001"] });
const unusedAuthorizedFactTrace = xhsWriterOutput();
unusedAuthorizedFactTrace.traceability.used_fact_ids.push("F_UNUSED");
assert.throws(
  () => validateUnifiedSkillDomainOutput({ capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0", runtimeOutput: { status: "success", data: unusedAuthorizedFactTrace, warnings: [], blocked_reasons: [] }, sourceContentMaster: unusedAuthorizedFactMaster }),
  (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["data.reference_integrity"]),
  "traceability must not claim an authorized fact that the package never uses"
);

function canonicalTitleInput(platform) {
  const completedContent = domainOutput(platform === "wechat" ? "write-wechat-article" : "write-xhs-content", platform);
  return {
    stage: "final_after_body",
    platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu",
    content_master: domainOutput("build-content-master", "xiaohongshu"),
    completed_content: completedContent,
    preliminary_titles: platform === "wechat" ? completedContent.title_candidates : completedContent.post_copy.title_candidates,
    content_task_brief: { purpose: "fixture" },
    same_account_title_signals: [{ signal_id: "SIG_AUTHORIZED" }],
    editorial_autonomy: {
      choose_low_risk_titles: true,
      empty_claim_ids_when_no_exact_authorized_id: true,
      do_not_invent_claim_ids: true
    }
  };
}

function fixtureOutputFact({ id, platform, capability, runtimeOutput }) {
  const outputHash = hashUnifiedContent(runtimeOutput);
  const base = { id, platform, capability, runtimeOutput: structuredClone(runtimeOutput), outputHash };
  return { ...base, factHash: hashUnifiedContent(base) };
}

const identityWriterFact = fixtureOutputFact({
  id: "writer_fact_identity_fixture",
  platform: "xiaohongshu",
  capability: "write-xhs-content",
  runtimeOutput: { status: "success", data: xhsWriterOutput(), warnings: [], blocked_reasons: [] }
});
const identityTitleFactA = fixtureOutputFact({
  id: "title_fact_identity_fixture_a",
  platform: "xiaohongshu",
  capability: "generate-platform-titles",
  runtimeOutput: { status: "success", data: titleOutput("xiaohongshu"), warnings: [], blocked_reasons: [] }
});
const identityTitleDataB = titleOutput("xiaohongshu");
identityTitleDataB.candidates[0].title = "xiaohongshu revised final title";
const identityTitleFactB = fixtureOutputFact({
  id: "title_fact_identity_fixture_b",
  platform: "xiaohongshu",
  capability: "generate-platform-titles",
  runtimeOutput: { status: "success", data: identityTitleDataB, warnings: [], blocked_reasons: [] }
});
const identityCandidateA = deriveUnifiedPlatformCandidate({
  contentProjectId: "identity_project_fixture",
  platform: "xiaohongshu",
  platformRunRef: { id: "identity_run_fixture", hash: "a".repeat(64) },
  outputFacts: [identityWriterFact, identityTitleFactA]
});
const identityCandidateB = deriveUnifiedPlatformCandidate({
  contentProjectId: "identity_project_fixture",
  platform: "xiaohongshu",
  platformRunRef: { id: "identity_run_fixture", hash: "a".repeat(64) },
  outputFacts: [identityWriterFact, identityTitleFactB]
});
assert.notEqual(identityCandidateA.candidateRef.id, identityCandidateB.candidateRef.id, "title-only retry must create a distinct immutable candidate ID");
assert.notEqual(identityCandidateA.candidateRef.hash, identityCandidateB.candidateRef.hash, "title-only retry must create a distinct immutable candidate hash");
assert.deepEqual(identityCandidateA.candidate.finalTitleBinding.completedContentFactRef, identityCandidateB.candidate.finalTitleBinding.completedContentFactRef);
assert.notDeepEqual(identityCandidateA.candidate.finalTitleBinding.titleOutputFactRef, identityCandidateB.candidate.finalTitleBinding.titleOutputFactRef);
assert.equal(identityCandidateA.candidate.finalTitleBinding.titleOutputFactRef.hash, identityTitleFactA.factHash);
assert.equal(identityCandidateB.candidate.finalTitleBinding.titleOutputFactRef.hash, identityTitleFactB.factHash);
assert.equal(identityCandidateB.candidate.finalTitle, "xiaohongshu revised final title");
for (const platform of ["xiaohongshu", "wechat"]) {
  const envelope = { status: "success", data: titleOutput(platform), warnings: [], blocked_reasons: [] };
  const before = structuredClone(envelope);
  assert.deepEqual(validateUnifiedSkillDomainOutput({
    capability: "generate-platform-titles",
    platform,
    outputContract: "PlatformTitleList@1.0",
    runtimeOutput: envelope,
    sourceContentMaster: domainOutput("build-content-master", "xiaohongshu"),
    sourceTitleInput: canonicalTitleInput(platform)
  }), envelope.data);
  assert.deepEqual(envelope, before, "title validation must not rewrite the Runtime Output Fact source");
}
for (const status of ["failed", "needs_review"]) {
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "generate-platform-titles", platform: "xiaohongshu", outputContract: "PlatformTitleList@1.0", runtimeOutput: { status, data: {}, warnings: [], blocked_reasons: [] } }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["status"])
  );
}
for (const mutate of [
  (value) => { value.title_brief = {}; },
  (value) => { value.candidates[1].title_id = "T1"; },
  (value) => { value.candidates[0].motivation = "invalid"; },
  (value) => { value.candidates[0].scores.overall = 6; },
  (value) => { value.candidates[0].claim_ids = ["UNKNOWN"]; },
  (value) => { value.recommendations.safe = "UNKNOWN"; },
  (value) => { value.candidates[0].risk = "high"; },
  (value) => { value.ab_tests[0].title_b = "UNKNOWN"; },
  (value) => { value.same_account_signal_usage = { used: true, signal_ids: ["UNAUTHORIZED"], interpretation: "fixture" }; }
]) {
  const invalid = titleOutput("xiaohongshu");
  mutate(invalid);
  assert.throws(
    () => validateUnifiedSkillDomainOutput({ capability: "generate-platform-titles", platform: "xiaohongshu", outputContract: "PlatformTitleList@1.0", runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, sourceContentMaster: domainOutput("build-content-master", "xiaohongshu"), sourceTitleInput: canonicalTitleInput("xiaohongshu") }),
    (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
  );
}

const strategyPayload = { schemaVersion: "2.0", fixture: "company strategy authority" };
const strategyRef = { id: "strategy_snapshot_1", hash: hashUnifiedContent(strategyPayload) };
const strategyAuthority = () => ({ id: strategyRef.id, accountId: "company_fixture", status: "active", payload: structuredClone(strategyPayload) });
const sourceRef = { id: "knowledge_source_1", hash: "b".repeat(64) };
const projectId = "content_project_fixture_1";
const mechanismDecision = withUnifiedContentHash({
  schemaVersion: "1.0",
  contract: "ContentMechanismDecision@1.0",
  id: "mechanism_decision_1",
  companyId: "company_fixture",
  contentProjectRef: { id: projectId, hash: "c".repeat(64) },
  activeStrategySnapshotRef: strategyRef,
  evaluated: [{ candidateRefs: [sourceRef], factPolicy: null, mechanism: "knowledge", reason: "fixture knowledge source", status: "selected" }],
  selectedMechanism: "knowledge",
  selectedSourceRefs: [sourceRef],
  strategyHotspotPolicy: "disabled",
  deviation: { reason: null, status: "none", userConfirmationStatus: "not_required" },
  decidedAt: "2026-08-05T12:00:00.000Z",
  decisionHash: ""
}, "decisionHash");

const request = {
  requestId: "request_fixture_1",
  orchestrationInput: {
    project: {
      id: projectId,
      companyId: "company_fixture",
      contentOpportunityRef: { id: "opportunity_1", hash: "d".repeat(64) },
      activeStrategySnapshotRef: strategyRef,
      designDnaSnapshotRef: confirmedDesignDnaSnapshotRef,
      accounts: { xiaohongshu: "xhs_account_fixture", wechat: "wechat_account_fixture" },
      platformInputs: {
        xiaohongshu: {
          purpose: "fixture",
          contentTaskBrief: { purpose: "fixture", targetReader: "fixture reader" },
          sameAccountTitleSignals: [{ signal_id: "SIG_XHS_1", accountId: "xhs_account_fixture", correlation: "fixture only" }],
          sameAccountTitleSignalsAuthorization: { status: "authorized", accountId: "xhs_account_fixture", signalIds: ["SIG_XHS_1"] }
        },
        wechat: { purpose: "fixture", contentTaskBrief: { purpose: "fixture", targetReader: "fixture reader" } }
      },
      confirmations: { xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" } }
    },
    mechanismDecision,
    sourcePlan: { mode: "knowledge_base", sources: [{ type: "knowledge_base", candidateIds: [sourceRef.id] }] }
  },
  reviewInputs: {
    xiaohongshu: { candidateSet: { titleRef: { id: "forged", hash: "f".repeat(64) }, pageRevisionRefs: [{ id: "forged_page", hash: "f".repeat(64) }] } },
    wechat: { candidateSet: { articleRef: { id: "forged", hash: "f".repeat(64) } } }
  }
};
const productAuthoritySeed = readStore();
productAuthoritySeed.accountStrategySnapshots ||= [];
productAuthoritySeed.accountStrategySnapshots.push(
  { id: "account_strategy_prerequisite_xhs", companyId: prerequisiteCompany.id, socialAccountId: prerequisiteXhs.id, status: "active", payload: { matrixRole: "discovery_and_validation", platformPlaybook: { role: "fixture discovery" }, prohibitedOverlap: [], creativeMechanism: "checklist" } },
  { id: "account_strategy_prerequisite_wechat", companyId: prerequisiteCompany.id, socialAccountId: prerequisiteWechat.id, status: "active", payload: { matrixRole: "authority_and_conversion", platformPlaybook: { role: "fixture authority" }, prohibitedOverlap: [], trustSources: ["founder_experience"], creativeMechanism: "framework" } },
  { id: "account_strategy_xhs_writer_context", companyId: "company_fixture", socialAccountId: "xhs_account_fixture", status: "active", payload: { matrixRole: "discovery_and_validation", platformPlaybook: { role: "场景触达与需求验证" }, prohibitedOverlap: [] } },
  { id: "account_strategy_wechat_writer_context", companyId: "company_fixture", socialAccountId: "wechat_account_fixture", status: "active", payload: { matrixRole: "authority_and_conversion", platformPlaybook: { role: "深度权威与业务承接" }, prohibitedOverlap: [], trustSources: ["founder_experience"] } }
);
productAuthoritySeed.unifiedContentOpportunities ||= [];
productAuthoritySeed.unifiedContentOpportunities.push({ id: "opportunity_1", companyId: "company_fixture", topic: "topic_fixture", contentObjective: "knowledge_howto", opportunityHash: "d".repeat(64) });
productAuthoritySeed.unifiedContentPrerequisiteRequests ||= [];
productAuthoritySeed.unifiedContentPrerequisiteRequests.push({
  idempotencyKey: "product_authority_fixture",
  semanticHash: hashUnifiedContent({ projectId, designDnaSnapshotRef: confirmedDesignDnaSnapshotRef }),
  designDnaSnapshotRef: confirmedDesignDnaSnapshotRef,
  contentOpportunityRef: request.orchestrationInput.project.contentOpportunityRef,
  mechanismDecisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash },
  projectInputRef: { id: "project_input_fixture", hash: "e".repeat(64) },
  createdAt: "2026-08-05T12:00:00.000Z"
});
writeStore(productAuthoritySeed);

let baseUrl;
try {
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const prerequisiteRequest = {
    companyId: prerequisiteCompany.id,
    xiaohongshuAccountId: prerequisiteXhs.id,
    wechatAccountId: prerequisiteWechat.id,
    topic: "统一上游 API fixture",
    contentObjective: "验证正式权威前置对象入口",
    hotspotEvaluation: { status: "not_available", candidateRefs: [], reason: "evaluated_no_usable_hotspot", factPolicy: "external_event_not_business_fact" },
    idempotencyKey: "prerequisite_api_fixture_1"
  };
  const prerequisiteDisabled = await fetch(`${baseUrl}/unified-content-prerequisites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(prerequisiteRequest) });
  assert.equal(prerequisiteDisabled.status, 404);
  assert.equal((await prerequisiteDisabled.json()).code, "UNIFIED_CONTENT_PREREQUISITES_DISABLED");
  const legacyOpportunitiesBefore = structuredClone(readStore().contentOpportunities || []);
  process.env.UNIFIED_CONTENT_PREREQUISITES_V1 = "1";
  const prerequisiteCreatedResponse = await fetch(`${baseUrl}/unified-content-prerequisites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(prerequisiteRequest) });
  const prerequisiteCreated = await prerequisiteCreatedResponse.json();
  assert.equal(prerequisiteCreatedResponse.status, 201, JSON.stringify(prerequisiteCreated));
  assert.equal(prerequisiteCreated.opportunity.contract, "UnifiedContentOpportunity@1.0");
  assert.deepEqual(prerequisiteCreated.designDnaSnapshotRef, prerequisiteDesignDnaSnapshotRef);
  assert.equal(prerequisiteCreated.mechanismDecision.contract, "ContentMechanismDecision@1.0");
  assert.equal(prerequisiteCreated.mechanismDecision.projectInputRef.id, prerequisiteCreated.projectInputRef.id);
  assert.equal(prerequisiteCreated.mechanismDecision.selectedMechanism, "strategy_only");
  const flagOffDecisionBefore = structuredClone(prerequisiteCreated.mechanismDecision);
  const prerequisiteReplay = await fetch(`${baseUrl}/unified-content-prerequisites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(prerequisiteRequest) });
  assert.equal(prerequisiteReplay.status, 200);
  assert.equal((await prerequisiteReplay.json()).created, false);
  const prerequisiteConflict = await fetch(`${baseUrl}/unified-content-prerequisites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...prerequisiteRequest, topic: "changed" }) });
  assert.equal(prerequisiteConflict.status, 409);
  assert.equal((await prerequisiteConflict.json()).code, "UNIFIED_PREREQUISITE_IDEMPOTENCY_CONFLICT");
  assert.deepEqual(readStore().contentOpportunities || [], legacyOpportunitiesBefore, "authoritative unified opportunity API must not rewrite legacy ContentOpportunity");

  let nativeBootstrapPersists = 0;
  const nativeBootstrapPersistStore = async (value) => { nativeBootstrapPersists += 1; return writeStore(value); };
  const nativePlanningCallCount = () => [...capabilityCalls.values()].reduce((sum, value) => sum + value, 0);
  const nativeCapabilityCallsBefore = new Map(capabilityCalls);
  const nativePlanningLiveInvocations = [];
  const nativePlanningGenerateText = async (skillRequest, control) => {
    nativePlanningLiveInvocations.push(structuredClone(control?.liveInvocation));
    return atomicFixtureGenerateText(skillRequest);
  };
  setUnifiedContentServerDependenciesForTest({
    generateText: nativePlanningGenerateText,
    resolveActiveStrategySnapshot: (companyId) => companyId === prerequisiteCompany.id
      ? { id: prerequisiteCompany.activeStrategySnapshotId, accountId: prerequisiteCompany.id, status: "active", payload: structuredClone(prerequisiteStrategyPayload) }
      : { id: strategyRef.id },
    now: () => "2026-08-07T14:00:00.000Z",
    persistStore: nativeBootstrapPersistStore
  });
  process.env.UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1 = "1";
  const crossVersionStoreBefore = structuredClone(readStore());
  const crossVersionCallsBefore = nativePlanningCallCount();
  const crossVersionPrerequisite = await fetch(`${baseUrl}/unified-content-prerequisites`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(prerequisiteRequest)
  });
  assert.equal(crossVersionPrerequisite.status, 409);
  assert.equal((await crossVersionPrerequisite.json()).code, "UNIFIED_PREREQUISITE_IDEMPOTENCY_CONFLICT");
  assert.deepEqual(readStore(), crossVersionStoreBefore, "same prerequisite key must not cross-replay from v1 into native v2");
  assert.equal(nativePlanningCallCount(), crossVersionCallsBefore);
  assert.equal(nativeBootstrapPersists, 0);

  const nativePrerequisiteRequest = { ...prerequisiteRequest, idempotencyKey: "prerequisite_api_native_v2_fixture" };
  const nativePrerequisiteResponse = await fetch(`${baseUrl}/unified-content-prerequisites`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nativePrerequisiteRequest)
  });
  const nativePrerequisite = await nativePrerequisiteResponse.json();
  assert.equal(nativePrerequisiteResponse.status, 201, JSON.stringify(nativePrerequisite));
  assert.equal(nativePrerequisite.mechanismDecision.contract, "ContentMechanismDecision@2.0");
  assert.equal(nativePrerequisite.mechanismDecision.schemaVersion, "2.0");
  assert.deepEqual(nativePrerequisite.mechanismDecision.projectInputRef, nativePrerequisite.projectInputRef);
  assert.equal(nativePrerequisite.mechanismDecision.mechanisms.filter((item) => item.role === "primary").length, 1);
  assert.equal(nativePrerequisite.mechanismDecision.mechanisms.find((item) => item.role === "primary").mechanism, "strategy_only");
  assert.deepEqual(nativePrerequisite.mechanismDecision.selectedSourceRefs, []);
  const nativeHotspot = nativePrerequisite.mechanismDecision.mechanisms.find((item) => item.mechanism === "hotspot");
  assert.deepEqual({ role: nativeHotspot.role, evaluationStatus: nativeHotspot.evaluationStatus, candidates: nativeHotspot.candidates,
    reason: nativeHotspot.reason, factPolicy: nativeHotspot.factPolicy }, {
    role: "not_selected", evaluationStatus: "evaluated", candidates: [], reason: prerequisiteRequest.hotspotEvaluation.reason,
    factPolicy: "external_event_not_business_fact"
  });
  const nativePrerequisiteStore = readStore();
  const nativeBinding = nativePrerequisiteStore.unifiedContentPrerequisiteRequests.find((item) => item.idempotencyKey === nativePrerequisiteRequest.idempotencyKey);
  assert.equal(nativeBinding.mechanismDecisionContract, "ContentMechanismDecision@2.0");
  assert.deepEqual(nativeBinding.mechanismDecisionRef, { id: nativePrerequisite.mechanismDecision.id, hash: nativePrerequisite.mechanismDecision.decisionHash });
  assert.deepEqual(nativeBinding.projectInputRef, nativePrerequisite.projectInputRef);
  const nativeReplayStoreBefore = structuredClone(readStore());
  const nativeReplayCallsBefore = nativePlanningCallCount();
  const nativePrerequisiteReplayResponse = await fetch(`${baseUrl}/unified-content-prerequisites`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nativePrerequisiteRequest)
  });
  const nativePrerequisiteReplay = await nativePrerequisiteReplayResponse.json();
  assert.equal(nativePrerequisiteReplayResponse.status, 200, JSON.stringify(nativePrerequisiteReplay));
  assert.equal(nativePrerequisiteReplay.created, false);
  assert.deepEqual(nativePrerequisiteReplay.mechanismDecision, nativePrerequisite.mechanismDecision);
  assert.deepEqual(readStore(), nativeReplayStoreBefore, "native v2 replay must not rewrite prerequisite authority");
  assert.equal(nativePlanningCallCount(), nativeReplayCallsBefore);
  assert.equal(nativeBootstrapPersists, 0);
  const nativeXhsAccount = nativePrerequisiteStore.accounts.find((item) => item.id === prerequisiteXhs.id);
  const nativeWechatAccount = nativePrerequisiteStore.accounts.find((item) => item.id === prerequisiteWechat.id);
  const nativeAccountRefs = {
    xiaohongshu: { id: nativeXhsAccount.id, hash: hashUnifiedContent(nativeXhsAccount) },
    wechat: { id: nativeWechatAccount.id, hash: hashUnifiedContent(nativeWechatAccount) }
  };
  const nativeDecisionRef = { id: nativePrerequisite.mechanismDecision.id, hash: nativePrerequisite.mechanismDecision.decisionHash };
  const nativeBootstrapInput = (suffix, authorizationSourceRefs = [nativeDecisionRef], binding = nativeBinding, decision = nativePrerequisite.mechanismDecision) => ({
    requestId: `native-prerequisite-bootstrap-request-${suffix}`,
    idempotencyKey: `native-prerequisite-bootstrap-key-${suffix}`,
    companyId: prerequisiteCompany.id,
    projectId: `native_prerequisite_bootstrap_project_${suffix}`,
    topicIntent: { topic: nativePrerequisiteRequest.topic, intent: "formal native v2 staged bootstrap" },
    activeStrategySnapshotRef: structuredClone(decision.activeStrategySnapshotRef),
    prerequisiteRef: { id: binding.idempotencyKey, hash: binding.semanticHash },
    accounts: structuredClone(nativeAccountRefs),
    authorizationSourceRefs: structuredClone(authorizationSourceRefs)
  });
  async function assertNativeBootstrapRejected(input, expectedCode) {
    const before = structuredClone(readStore());
    const callsBefore = nativePlanningCallCount();
    const persistsBefore = nativeBootstrapPersists;
    const commitsBefore = (before.unifiedAtomicContentCommits || []).length;
    const response = await fetch(`${baseUrl}/unified-content-projects/bootstrap`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input)
    });
    const failure = await response.json();
    assert.notEqual(response.status, 201, JSON.stringify(failure));
    assert.equal(failure.code, expectedCode, JSON.stringify(failure));
    assert.equal(nativePlanningCallCount(), callsBefore, `${expectedCode} must fail before formal planning Provider calls`);
    assert.equal(nativeBootstrapPersists, persistsBefore + 2, `${expectedCode} must persist only the started and failed attempt receipt`);
    const after = readStore();
    assert.equal((after.unifiedAtomicContentCommits || []).length, commitsBefore, `${expectedCode} must create zero Commit`);
    const beforeReceiptCount = (before.unifiedContentPlanningAttemptReceipts || []).length;
    const attemptReceipts = (after.unifiedContentPlanningAttemptReceipts || []).slice(beforeReceiptCount);
    assert.equal(attemptReceipts.length, 1);
    assert.equal(attemptReceipts[0].status, "failed");
    assert.equal(attemptReceipts[0].providerCallsStarted, 0);
    assert.equal(attemptReceipts[0].lastSafeFailure?.causeCode, expectedCode);
    const businessBefore = structuredClone(before); delete businessBefore.unifiedContentPlanningAttemptReceipts;
    const businessAfter = structuredClone(after); delete businessAfter.unifiedContentPlanningAttemptReceipts;
    assert.deepEqual(businessAfter, businessBefore, `${expectedCode} must be zero-write outside the append-only attempt receipt`);
  }
  const v1Binding = nativePrerequisiteStore.unifiedContentPrerequisiteRequests.find((item) => item.idempotencyKey === prerequisiteRequest.idempotencyKey);
  const v1Decision = nativePrerequisiteStore.unifiedContentMechanismDecisions.find((item) => item.id === v1Binding.mechanismDecisionRef.id
    && item.decisionHash === v1Binding.mechanismDecisionRef.hash);
  await assertNativeBootstrapRejected(
    nativeBootstrapInput("v1-replay", [v1Binding.mechanismDecisionRef], v1Binding, v1Decision),
    "CONTENT_MECHANISM_V2_NATIVE_REQUIRED"
  );
  await assertNativeBootstrapRejected(
    nativeBootstrapInput("wrong-authority", [{ ...nativeDecisionRef, hash: "0".repeat(64) }]),
    "UNIFIED_STAGED_ATOMIC_EXACT_AUTHORITY_REQUIRED"
  );
  await assertNativeBootstrapRejected(
    nativeBootstrapInput("duplicate-authority", [nativeDecisionRef, nativeDecisionRef]),
    "UNIFIED_STAGED_ATOMIC_MECHANISM_AUTHORITY_REQUIRED"
  );

  const nativeBootstrapCreateInput = nativeBootstrapInput("success");
  const nativeBootstrapCallsBefore = nativePlanningCallCount();
  const nativeBootstrapPersistsBefore = nativeBootstrapPersists;
  const nativeBootstrapCommitsBefore = (readStore().unifiedAtomicContentCommits || []).length;
  const nativeBootstrapResponse = await fetch(`${baseUrl}/unified-content-projects/bootstrap`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nativeBootstrapCreateInput)
  });
  const nativeBootstrap = await nativeBootstrapResponse.json();
  assert.equal(nativeBootstrapResponse.status, 201, JSON.stringify(nativeBootstrap));
  assert.equal(nativeBootstrap.bootstrap.state, "awaiting_outline_confirmation");
  assert.equal(nativePlanningCallCount() - nativeBootstrapCallsBefore, 3);
  assert.deepEqual(nativePlanningLiveInvocations, [
    { ordinal: 1, capability: "build-content-master", platform: "xiaohongshu", stepId: "content_master" },
    { ordinal: 2, capability: "generate-content-outline", platform: "xiaohongshu", stepId: "outline" },
    { ordinal: 3, capability: "generate-content-outline", platform: "wechat", stepId: "outline" }
  ], "production staged planning must carry exact server-owned Live invocation identity 1-3");
  assert.equal(nativeBootstrapPersists - nativeBootstrapPersistsBefore, 8, "successful planning persists start, six invocation transitions, and terminal receipt");
  const nativeBootstrapStored = readStore().unifiedStagedAtomicDualBootstraps.find((item) => item.id === nativeBootstrap.bootstrap.id);
  assert.equal(nativeBootstrapStored.planning.invocations.length, 3);
  assert.equal(nativeBootstrapStored.planning.outputFacts.length, 3);
  assert.ok(nativeBootstrapStored.planning.outputFacts.every((item) => item.contract === "UnifiedSkillOutputFact@1.0"));
  assert.deepEqual(nativeBootstrapStored._serverAuthority.orchestrationInput.mechanismDecision, nativePrerequisite.mechanismDecision,
    "staged adapter must preserve the exact native v2 decision and hash");
  assert.equal((readStore().unifiedAtomicContentCommits || []).length, nativeBootstrapCommitsBefore,
    "native prerequisite planning stop point must create zero Atomic Commit");
  const storedFlagOffDecision = readStore().unifiedContentMechanismDecisions.find((item) => item.id === flagOffDecisionBefore.id
    && item.decisionHash === flagOffDecisionBefore.decisionHash);
  assert.deepEqual(storedFlagOffDecision, flagOffDecisionBefore, "native v2 creation must not rewrite the historical v1 decision");

  async function assertNativeSingleAttemptFailure({ suffix, adapterResult }) {
    const before = structuredClone(readStore());
    const persistsBefore = nativeBootstrapPersists;
    const commitsBefore = (before.unifiedAtomicContentCommits || []).length;
    let adapterCalls = 0;
    let gatewayResult = null;
    const failureInvocations = [];
    const atomicProvider = createAtomicProviderTextGenerator({
      invoke: async (options) => {
        gatewayResult = await invokeLlm({
          ...options,
          adapterFactory: () => ({
            invoke: async () => {
              adapterCalls += 1;
              if (adapterResult instanceof Error) throw adapterResult;
              return { data: structuredClone(adapterResult), usage: { total_tokens: 1 }, responseId: `staged_failure_${suffix}` };
            }
          }),
          modelIdentity: { configured: true, provider: "staged-single-attempt-fixture", model: "fixture-model", baseUrl: "https://model.invalid" },
          retryDelay: async () => {},
          traceId: `staged_single_attempt_${suffix}`
        });
        return gatewayResult;
      }
    });
    setUnifiedContentServerDependenciesForTest({
      generateText: async (skillRequest, control) => {
        failureInvocations.push(structuredClone(control?.liveInvocation));
        return atomicProvider(skillRequest, control);
      }
    });
    const response = await fetch(`${baseUrl}/unified-content-projects/bootstrap`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nativeBootstrapInput(suffix))
    });
    assert.notEqual(response.status, 201, JSON.stringify(await response.json()));
    assert.equal(adapterCalls, 1, `${suffix}: retryable/schema failure must invoke the bottom Provider adapter once`);
    assert.equal(gatewayResult.telemetry.retryCount, 0, `${suffix}: Gateway automatic retries must remain zero`);
    assert.equal(JSON.stringify(gatewayResult.data).includes("liveInvocation"), false, `${suffix}: Live control must not become fallback data`);
    assert.deepEqual(failureInvocations, [
      { ordinal: 1, capability: "build-content-master", platform: "xiaohongshu", stepId: "content_master" }
    ]);
    assert.equal(nativeBootstrapPersists, persistsBefore + 4, `${suffix}: failed planning must persist start, invocation start/failure, and terminal receipt`);
    const after = readStore();
    assert.equal((after.unifiedAtomicContentCommits || []).length, commitsBefore, `${suffix}: failed planning must create zero Commit`);
    const receipt = (after.unifiedContentPlanningAttemptReceipts || []).at(-1);
    assert.equal(receipt.status, "failed");
    assert.equal(receipt.providerCallsStarted, 1);
    assert.equal(receipt.providerCallsFailed, 1);
    assert.equal(receipt.retryCount, 0);
    const businessBefore = structuredClone(before); delete businessBefore.unifiedContentPlanningAttemptReceipts;
    const businessAfter = structuredClone(after); delete businessAfter.unifiedContentPlanningAttemptReceipts;
    assert.deepEqual(businessAfter, businessBefore, `${suffix}: failed planning must leave business state unchanged`);
  }
  await assertNativeSingleAttemptFailure({ suffix: "retryable-transport", adapterResult: Object.assign(new Error("private retryable transport detail"), { status: 503 }) });
  await assertNativeSingleAttemptFailure({ suffix: "schema-failure", adapterResult: { wrong: true } });
  setUnifiedContentServerDependenciesForTest({ generateText: nativePlanningGenerateText });
  capabilityCalls.clear();
  nativeCapabilityCallsBefore.forEach((value, key) => capabilityCalls.set(key, value));
  process.env.UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1 = "0";
  setUnifiedContentServerDependenciesForTest({ persistStore: writeStore });

  const disabled = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
  assert.equal(disabled.status, 404);
  assert.equal((await disabled.json()).code, "UNIFIED_CONTENT_PRODUCTION_DISABLED");
  const legacyTasksBefore = structuredClone(readStore().contentTasks || []);

  process.env.UNIFIED_CONTENT_PRODUCTION_V1 = "1";
  setUnifiedContentServerDependenciesForTest({ generateText: fixtureGenerateText, resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }), now: () => "2026-08-05T12:00:00.000Z" });
  const createdResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  assert.equal(created.contentProject.id, projectId);
  assert.equal(created.platforms.length, 2);
  assert.equal(created.actualInvocations.length, 9);
  assert.equal(created.skillOutputFacts.length, 9);
  assert.ok(created.platforms.every((platform) => platform.candidates.every((candidate) => candidate.contract === "UnifiedPlatformCandidate@1.0")), "flag-off Product API must retain Candidate@1");
  assert.equal(JSON.stringify(created).includes("ValidatedComponentFact@1.0"), false, "flag-off Product API must not create hidden atomic component Facts");
  assert.equal(JSON.stringify(created).includes("xhsAtomicArtifacts"), false, "flag-off Product API must not create hidden atomic artifacts");
  const projectsBeforeAtomicGate = readStore().unifiedContentProjects.length;
  const preAtomicCapabilityCalls = new Map(capabilityCalls);
  const preAtomicRequestLengths = { titles: titleRuntimeRequests.length, wechat: wechatRuntimeRequests.length, xhs: xhsWriterRuntimeRequests.length };
  const atomicSourceRef = { id: sourceRef.id, hash: hashUnifiedContent({ mechanism: "knowledge", sourceType: "knowledge_base", source: { id: sourceRef.id } }) };
  const atomicDecision = withUnifiedContentHash({
    schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "mechanism_decision_atomic_gate", companyId: "company_fixture",
    projectInputRef: { id: "project_input_fixture", hash: "e".repeat(64) }, activeStrategySnapshotRef: strategyRef,
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms: [{ mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", candidates: [{ sourceRef: atomicSourceRef, status: "selected", reason: "fixture" }], reason: "fixture", factPolicy: null }],
    selectedSourceRefs: [atomicSourceRef], strategyHotspotPolicy: "disabled", deviation: { status: "none", reason: null, confirmationEventRef: null },
    decidedAt: "2026-08-05T12:00:00.000Z", decisionHash: ""
  }, "decisionHash");
  const atomicSeed = readStore();
  atomicSeed.unifiedContentMechanismDecisions ||= [];
  atomicSeed.unifiedContentMechanismDecisions.push(structuredClone(atomicDecision));
  atomicSeed.unifiedContentSourcePlans ||= [];
  atomicSeed.unifiedContentSourcePlans.push({
    schemaVersion: "1.0", contract: "SourcePlan@1.0", id: "production_staged_source_plan_authority", mode: "knowledge_base",
    frozenSourceRefs: [structuredClone(atomicSourceRef)],
    sources: [{ type: "knowledge_base", candidateIds: [atomicSourceRef.id], sourceRef: structuredClone(atomicSourceRef) }]
  });
  atomicSeed.accountStrategySnapshots.find((item) => item.socialAccountId === "xhs_account_fixture").payload.creativeMechanism = "search_answer";
  atomicSeed.accountStrategySnapshots.find((item) => item.socialAccountId === "wechat_account_fixture").payload.creativeMechanism = "framework";
  atomicSeed.unifiedContentPrerequisiteRequests.push({
    idempotencyKey: "product_authority_atomic_gate", semanticHash: "8".repeat(64), designDnaSnapshotRef: confirmedDesignDnaSnapshotRef,
    contentOpportunityRef: request.orchestrationInput.project.contentOpportunityRef,
    mechanismDecisionRef: { id: atomicDecision.id, hash: atomicDecision.decisionHash }, projectInputRef: atomicDecision.projectInputRef,
    createdAt: "2026-08-05T12:00:00.000Z"
  });
  writeStore(atomicSeed);
  let atomicProductRouteWrites = 0;
  const countedAtomicPersistStore = async (value) => {
    atomicProductRouteWrites += 1;
    return writeStore(value);
  };
  setUnifiedContentServerDependenciesForTest({
    generateText: atomicFixtureGenerateText,
    resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }),
    now: () => "2026-08-05T12:00:00.000Z",
    persistStore: countedAtomicPersistStore,
    serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true }
  });
  const atomicGateRequest = structuredClone(request);
  atomicGateRequest.requestId = "request_atomic_gate_fixture";
  atomicGateRequest.orchestrationInput.mechanismDecision = atomicDecision;
  process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "0";
  const atomicStoreBeforeRequest = structuredClone(readStore());
  const atomicGateResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicGateRequest) });
  const atomicGate = await atomicGateResponse.json();
  assert.equal(atomicGateResponse.status, 409, JSON.stringify(atomicGate));
  assert.equal(atomicGate.code, "UNIFIED_ATOMIC_PERSISTENCE_CUTOVER_PENDING");
  assert.equal(readStore().unifiedContentProjects.length, projectsBeforeAtomicGate, "flag-on gate must stop before Candidate/store persistence");
  assert.deepEqual(readStore(), atomicStoreBeforeRequest, "flag-on gate must perform zero store writes across Candidate, Binding, Selection, and Delivery");
  assert.equal(atomicProductRouteWrites, 0, "graph-on/product-off gate must not call writeStore");
  const totalCapabilityCalls = () => [...capabilityCalls.values()].reduce((sum, value) => sum + value, 0);
  const preAtomicCapabilityTotal = [...preAtomicCapabilityCalls.values()].reduce((sum, value) => sum + value, 0);
  const atomicGateProviderCalls = totalCapabilityCalls() - preAtomicCapabilityTotal;
  capabilityCalls.clear();
  preAtomicCapabilityCalls.forEach((value, key) => capabilityCalls.set(key, value));
  titleRuntimeRequests.length = preAtomicRequestLengths.titles;
  wechatRuntimeRequests.length = preAtomicRequestLengths.wechat;
  xhsWriterRuntimeRequests.length = preAtomicRequestLengths.xhs;

  const atomicProductRequest = structuredClone(atomicGateRequest);
  atomicProductRequest.requestId = "request_atomic_product_fixture";
  atomicProductRequest.orchestrationInput.project.id = "content_project_atomic_product_fixture";
  process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = "0";
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "1";
  const productRequiresGraphCallsBefore = totalCapabilityCalls();
  const productRequiresGraphStoreBefore = structuredClone(readStore());
  const productRequiresGraphResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicProductRequest) });
  assert.equal(productRequiresGraphResponse.status, 409);
  assert.equal((await productRequiresGraphResponse.json()).code, "UNIFIED_ATOMIC_PRODUCT_REQUIRES_GRAPH");
  assert.equal(totalCapabilityCalls(), productRequiresGraphCallsBefore, "product-on/graph-off must fail before any Provider call");
  assert.deepEqual(readStore(), productRequiresGraphStoreBefore, "product-on/graph-off must be zero-write");
  assert.equal(atomicProductRouteWrites, 0, "product-on/graph-off must not call writeStore");

  process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "1";
  setUnifiedContentServerDependenciesForTest({
    generateText: atomicFixtureGenerateText,
    resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }),
    now: () => "2026-08-05T12:00:00.000Z",
    persistStore: countedAtomicPersistStore
  });
  const atomicProjectsBeforeProduct = readStore().unifiedContentProjects.length;
  const atomicCommitsBeforeProduct = readStore().unifiedAtomicContentCommits?.length || 0;
  const atomicProductStoreBefore = structuredClone(readStore());
  const productProviderCallsBefore = totalCapabilityCalls();
  const atomicProductResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicProductRequest) });
  const atomicProduct = await atomicProductResponse.json();
  assert.equal(atomicProductResponse.status, 201, JSON.stringify(atomicProduct));
  assert.equal(atomicProduct.contract, "UnifiedAtomicContentProductProjection@1.0");
  assert.equal(atomicProduct.id, atomicProductRequest.orchestrationInput.project.id);
  assert.equal(atomicProduct.xiaohongshu.state, "materialized");
  assert.equal(atomicProduct.xiaohongshu.title, "原子内容方法");
  assert.equal(atomicProduct.xiaohongshu.postCopy.contract, "XhsPostCopy@1.0");
  assert.equal(atomicProduct.xiaohongshu.carouselPlan.contract, "XhsCarouselPlan@2.0");
  assert.equal(atomicProduct.xiaohongshu.visualAssetPlan.contract, "XhsVisualAssetPlan@1.0");
  assert.equal(atomicProduct.artifactState, "visual_artifacts_required");
  assert.equal(atomicProduct.wechatState, "not_materialized");
  assert.deepEqual(atomicProduct.wechat, { state: "not_materialized", blocker: "wechat_not_materialized" });
  assert.equal(atomicProduct.selected, false);
  assert.equal(atomicProduct.promoted, false);
  assert.equal(atomicProduct.deliveryReady, false);
  assert.equal(atomicProduct.published, false);
  assert.equal(totalCapabilityCalls() - productProviderCallsBefore, atomicGateProviderCalls, "materialization/projection must add zero Provider calls beyond the verified atomic pipeline");
  assert.equal(readStore().unifiedAtomicContentCommits.length, atomicCommitsBeforeProduct + 1);
  assert.equal(readStore().unifiedContentProjects.length, atomicProjectsBeforeProduct, "atomic product must not write legacy unifiedContentProjects");
  const atomicProductStoreAfterWithoutCommits = structuredClone(readStore());
  const atomicProductStoreBeforeWithoutCommits = structuredClone(atomicProductStoreBefore);
  delete atomicProductStoreAfterWithoutCommits.unifiedAtomicContentCommits;
  delete atomicProductStoreBeforeWithoutCommits.unifiedAtomicContentCommits;
  assert.deepEqual(atomicProductStoreAfterWithoutCommits, atomicProductStoreBeforeWithoutCommits, "successful atomic product POST may only append unifiedAtomicContentCommits");
  assert.equal(readStore().unifiedAtomicContentCommits[0].contract, "UnifiedAtomicContentCommit@2.0");
  assert.equal(readStore().unifiedAtomicContentCommits[0].materializedComponents.length, 6);
  const v2ForCompatibility = readStore().unifiedAtomicContentCommits[0];
  const historicalV1 = createUnifiedAtomicContentCommit({
    id: "historical_evidence_only_v1", idempotencyKey: "historical_evidence_only_v1", contentProjectRef: v2ForCompatibility.contentProjectRef,
    platform: v2ForCompatibility.platform, graph: v2ForCompatibility.graph, componentFacts: v2ForCompatibility.componentFacts,
    assemblyFact: v2ForCompatibility.assemblyFact, usageBinding: v2ForCompatibility.usageBinding,
    mechanismExplanation: v2ForCompatibility.mechanismExplanation, candidate: v2ForCompatibility.candidate
  });
  const mixedCommitStore = readStore(); mixedCommitStore.unifiedAtomicContentCommits = [historicalV1, ...mixedCommitStore.unifiedAtomicContentCommits]; writeStore(mixedCommitStore);
  const { listUnifiedAtomicMultiplatformProducts } = await import("../../content-agent/unified-atomic-multiplatform-product.mjs");
  assert.equal(listUnifiedAtomicMultiplatformProducts(readStore()).length, 1, "valid historical v1 must be validated then ignored as product authority");
  const malformedMixed = structuredClone(readStore()); malformedMixed.unifiedAtomicContentCommits[0].commitHash = "0".repeat(64);
  assert.throws(() => listUnifiedAtomicMultiplatformProducts(malformedMixed), (error) => error.code === "UNIFIED_ATOMIC_MULTIPLATFORM_COMMIT_STORE_INVALID");
  assert.equal(atomicProductRouteWrites, 1, "successful atomic product POST must call writeStore exactly once");

  const atomicProductGetResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`);
  assert.equal(atomicProductGetResponse.status, 200);
  const atomicProductGet = await atomicProductGetResponse.json();
  assert.equal(atomicProductGet.projectionHash, atomicProduct.projectionHash, "GET must rebuild the deterministic projection from the persisted Commit");
  const atomicProductListResponse = await fetch(`${baseUrl}/unified-content-projects?companyId=company_fixture&accountId=xhs_account_fixture`);
  assert.equal(atomicProductListResponse.status, 200);
  const atomicProductList = await atomicProductListResponse.json();
  assert.equal(atomicProductList.items.length, 1);
  assert.equal(atomicProductList.items[0].projectionHash, atomicProduct.projectionHash);
  assert.equal(JSON.stringify(atomicProduct).includes("wechat_official_account"), false, "unmaterialized WeChat content must not leak into the projection");
  const { resolveUnifiedContentAuthority, validateUnifiedContentAuthorityResolution } = await import("../../content-agent/unified-content-authority-resolver.mjs");

  const atomicSharedMaster = { schemaVersion: "3.0", contract: "ContentMaster@3.0", id: "shared_master_fixture", ...domainOutput("build-content-master", "xiaohongshu") };
  delete atomicSharedMaster.platform;
  const atomicSharedMasterRef = { id: atomicSharedMaster.id, hash: hashUnifiedContent(atomicSharedMaster) };
  const atomicWechatOutline = outlineOutput("wechat");
  const atomicWechatBrief = { id: "atomic_wechat_brief", platform: "wechat", accountId: "wechat_account_fixture", sharedContentMasterRef: atomicSharedMasterRef, brief: {}, authorized_assets: [
    { asset_id: "atomic-chart-1", strategy: "html_chart", status: "approved", allowsPublication: true, source_id: "SRC001", source_sha256: "7".repeat(64) }
  ] };
  const atomicSourcePlan = structuredClone(atomicProductRequest.orchestrationInput.sourcePlan);
  atomicSourcePlan.schemaVersion = "1.0"; atomicSourcePlan.contract = "SourcePlan@1.0"; atomicSourcePlan.id = `source_plan:${atomicProduct.id}`;
  atomicSourcePlan.frozenSourceRefs = [atomicSourceRef];
  atomicSourcePlan.sources = atomicSourcePlan.sources.map((source) => ({ ...source, sourceRef: atomicSourceRef }));
  const atomicWechatWriterContext = createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "wechat_official_account", account_id: "wechat_account_fixture",
    topic_id: "opportunity_1", intent_profile_id: "project_input_fixture", content_purpose_id: "knowledge_howto",
    account_context: { subject_type: "founder", account_mode: "founder_ip", matrix_role: "authority_and_conversion", trust_source: "experience" },
    creative_mechanism: "framework", journey_stage: "convert", coordination_mode: "coordinated",
    matrix_coordination: { shared_campaign_topic_id: "opportunity_1", differentiation_angle: "authority_and_conversion:深度权威与业务承接", prohibited_overlap: [] },
    authority_refs: {
      activeStrategySnapshotRef: strategyRef, contentOpportunityRef: atomicProductRequest.orchestrationInput.project.contentOpportunityRef,
      mechanismDecisionRef: { id: atomicDecision.id, hash: atomicDecision.decisionHash }, accountRef: { id: "wechat_account_fixture", hash: "1".repeat(64) },
      accountStrategyRef: { id: "account_strategy_wechat_writer_context", hash: hashUnifiedContent(readStore().accountStrategySnapshots.find((item) => item.id === "account_strategy_wechat_writer_context")) },
      sharedContentMasterRef: atomicSharedMasterRef, platformBriefRef: { id: atomicWechatBrief.id, hash: hashUnifiedContent(atomicWechatBrief) },
      confirmedOutlineRef: { id: atomicWechatOutline.outline_id, hash: hashUnifiedContent(atomicWechatOutline) }
    }
  });
  const atomicWechatInput = {
    project: { id: atomicProduct.id, companyId: "company_fixture", accountId: "wechat_account_fixture", contentOpportunityRef: atomicProductRequest.orchestrationInput.project.contentOpportunityRef, activeStrategySnapshotRef: strategyRef },
    authorityInputs: { sharedContentMaster: atomicSharedMaster, mechanismDecision: atomicDecision, sourcePlan: atomicSourcePlan, platformBrief: atomicWechatBrief, confirmedOutline: atomicWechatOutline, writerContext: atomicWechatWriterContext },
    sourcePlanRef: { id: atomicSourcePlan.id, hash: hashUnifiedContent(atomicSourcePlan) }, writerContextRefId: "atomic_wechat_writer_context",
    executionPlan: { schemaVersion: "1.0", contract: "UnifiedAtomicWechatExecutionPlan@1.0", id: "atomic_wechat_plan", platform: "wechat", steps: [
      { id: "platform_writer", kind: "skill", capability: "write-wechat-article", enabled: true, required: true, dependsOn: [], inputContract: "WechatPlatformTopicIntentContentMasterAndConfirmedOutline", outputContract: "WechatArticle@2.0" },
      { id: "wechat_content_review", kind: "skill", capability: "review-wechat-article", enabled: true, required: true, dependsOn: ["platform_writer"], inputContract: "CompletedWechatArticleAndContentContracts", outputContract: "WechatArticleReview@1.0", invocationMode: "content_review" },
      { id: "image_plan", kind: "skill", capability: "plan-wechat-images", enabled: true, required: true, dependsOn: ["wechat_content_review"], inputContract: "CompletedWechatArticlePassedReviewAndAuthorizedAssets", outputContract: "WechatImagePlan@1.0" }
    ] },
    commitId: "atomic_wechat_commit_api", idempotencyKey: "atomic_wechat_commit_api_key", createdAt: "2026-08-05T12:00:00.000Z"
  };
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1 = "1";
  const atomicWechatRoute = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/materialize`;
  const atomicWechatResponse = await fetch(atomicWechatRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicWechatInput) });
  const atomicWechatCreated = await atomicWechatResponse.json();
  assert.equal(atomicWechatResponse.status, 201, JSON.stringify(atomicWechatCreated));
  assert.equal(atomicWechatCreated.product.contract, "UnifiedAtomicMultiplatformProduct@1.0");
  assert.equal(atomicWechatCreated.product.platforms.wechat.state, "materialized");
  assert.notDeepEqual(atomicWechatCreated.product.platformMaterializedProjectRefs.xiaohongshu, atomicWechatCreated.product.platformMaterializedProjectRefs.wechat);
  assert.equal(atomicProductRouteWrites, 2, "WeChat materialization must persist exactly once after the XHS commit");
  const { validateUnifiedAtomicMultiplatformProduct, validateUnifiedAtomicMultiplatformArtifactProjection } = await import("../../content-agent/unified-atomic-multiplatform-product.mjs");
  const rehashComponent = (component) => { delete component.componentHash; component.componentHash = hashUnifiedContent(component); };
  const rehashAggregate = (product) => { delete product.aggregateHash; product.aggregateHash = hashUnifiedContent(product); return product; };
  for (const [label, mutate] of [
    ["article ref closure", (value) => { value.platforms.wechat.article.article.article_promise = "changed"; rehashComponent(value.platforms.wechat.article); }],
    ["review article binding", (value) => { value.platforms.wechat.articleReview.articleRef.hash = "0".repeat(64); rehashComponent(value.platforms.wechat.articleReview); value.platforms.wechat.articleReviewRef = { id: value.platforms.wechat.articleReview.id, hash: value.platforms.wechat.articleReview.componentHash }; }],
    ["image plan review binding", (value) => { value.platforms.wechat.canonicalImagePlan.articleReviewRef.hash = "0".repeat(64); rehashComponent(value.platforms.wechat.canonicalImagePlan); value.platforms.wechat.imagePlanRef = { id: value.platforms.wechat.canonicalImagePlan.id, hash: value.platforms.wechat.canonicalImagePlan.componentHash }; }],
    ["exact blockers", (value) => { value.platforms.wechat.blockers.reverse(); }],
    ["authority boundary", (value) => { value.platforms.wechat.publicationAuthority = true; }]
  ]) {
    const forged = structuredClone(atomicWechatCreated.product); mutate(forged); rehashAggregate(forged);
    assert.throws(() => validateUnifiedAtomicMultiplatformProduct(forged), (error) => typeof error.code === "string", label);
  }
  const atomicWechatReplay = await fetch(atomicWechatRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicWechatInput) });
  assert.equal(atomicWechatReplay.status, 200); assert.equal((await atomicWechatReplay.json()).created, false);
  const replayStore = JSON.stringify(readStore());
  const replayCalls = totalCapabilityCalls();
  for (const [label, mutate] of [
    ["commitId", (value) => { value.commitId = "changed_commit"; }],
    ["project account", (value) => { value.project.accountId = "changed_account"; }],
    ["createdAt", (value) => { value.createdAt = "2026-08-05T12:00:01.000Z"; }],
    ["authorityInputs", (value) => { value.authorityInputs.platformBrief.id = "changed_brief"; }],
    ["sourcePlanRef", (value) => { value.sourcePlanRef.hash = "0".repeat(64); }],
    ["writerContextRefId", (value) => { value.writerContextRefId = "changed_writer_context"; }],
    ["executionPlan", (value) => { value.executionPlan.id = "changed_plan"; }]
  ]) {
    const changed = structuredClone(atomicWechatInput); mutate(changed);
    const response = await fetch(atomicWechatRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(changed) });
    assert.equal(response.status, 409, `${label}: ${JSON.stringify(await response.json())}`);
    assert.equal(totalCapabilityCalls(), replayCalls, `${label} conflict must occur before Skill calls`);
    assert.equal(JSON.stringify(readStore()), replayStore, `${label} conflict must be zero-write`);
    assert.equal(atomicProductRouteWrites, 2, `${label} conflict must not persist`);
  }
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const restartedAggregate = await (await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`)).json();
  assert.equal(restartedAggregate.platforms.wechat.commitRef.hash, atomicWechatCreated.product.platforms.wechat.commitRef.hash);
  const atomicWechatAuthority = resolveUnifiedContentAuthority(readStore(), { workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture", projectId: atomicProduct.id, platform: "wechat", productSnapshotHash: restartedAggregate.aggregateHash }, { atomicProductEnabled: true, atomicWechatProductEnabled: true });
  assert.equal(atomicWechatAuthority.authorityKind, "atomic_wechat_v1");
  assert.equal(validateUnifiedContentAuthorityResolution(atomicWechatAuthority), true);

  const atomicArtifactRoute = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/preupload-artifacts`;
  const disabledArtifactResponse = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(disabledArtifactResponse.status, 404);
  assert.equal((await disabledArtifactResponse.json()).code, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_DISABLED");
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1 = "1";
  const atomicWechatArtifactFiles = new Map();
  const atomicWechatArtifactSink = {
    async write(path, bytes) { atomicWechatArtifactFiles.set(path, Buffer.from(bytes)); },
    async read(path) {
      const bytes = atomicWechatArtifactFiles.get(path);
      if (!bytes) throw Object.assign(new Error("fixture artifact missing"), { code: "FIXTURE_ARTIFACT_MISSING" });
      return Buffer.from(bytes);
    }
  };
  let atomicChartFails = true;
  const atomicArtifactCalls = { resolver: 0, formatter: 0, gates: 0, whole: 0 };
  const artifactRef = (id) => ({ id, hash: hashUnifiedContent({ id }) });
  const atomicChartDefinition = { kind: "comparison", title: "atomic chart", items: [{ title: "A", detail: "B" }] };
  setUnifiedContentServerDependenciesForTest({
    persistStore: async (value) => writeStore(value),
    wechatPreuploadArtifactSink: atomicWechatArtifactSink,
    wechatPreuploadResourceResolvers: {
      async html_chart() {
        atomicArtifactCalls.resolver += 1;
        if (atomicChartFails) throw Object.assign(new Error("fixture chart unavailable"), { code: "FIXTURE_CHART_UNAVAILABLE" });
        return { bytes: Buffer.from("atomic-chart-bytes"), extension: ".png", evidence: { deterministic: true, definition: atomicChartDefinition, definitionHash: hashWechatArtifactValue(atomicChartDefinition) } };
      }
    },
    wechatPreuploadFormatHtml: async ({ article, resources }) => {
      atomicArtifactCalls.formatter += 1;
      return `<article><h1>${article.recommended_title}</h1>${resources.map((item) => `<img src="${item.relativePath}">`).join("")}<main>${article.article_markdown}</main></article>`;
    },
    wechatPreuploadQualityGates: Object.fromEntries(["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => [gate, async () => {
      atomicArtifactCalls.gates += 1;
      return { status: "passed", evidenceRefs: [artifactRef(`atomic-gate-${gate}`)], details: { fixture: true } };
    }])),
    wechatPreuploadWholeArticleQualityGate: async ({ canonicalPlan, planFact, formatFact, resourceAttempts, preUploadRef }) => {
      atomicArtifactCalls.whole += 1;
      const resourceAttemptRefs = formatFact.resourceAttemptRefs;
      return {
        bindings: {
          articleRef: canonicalPlan.bindings.articleRef, imagePlanRef: { id: canonicalPlan.planId, hash: canonicalPlan.planHash },
          imagePlanOutputFactRef: canonicalPlan.bindings.imagePlanOutputFactRef, planFactRef: { id: planFact.id, hash: planFact.factHash },
          formatFactRef: { id: formatFact.id, hash: formatFact.factHash }, preUploadRef, resourceAttemptRefs,
          resourceSetHash: hashWechatArtifactValue(resourceAttempts.filter((fact) => resourceAttemptRefs.some((ref) => ref.id === fact.id && ref.hash === fact.factHash)).map((fact) => ({ ref: { id: fact.id, hash: fact.factHash }, assetId: fact.assetId, relativePath: fact.relativePath, bytes: fact.bytes, sha256: fact.sha256 })))
        },
        content: Object.fromEntries(["sectionContinuity", "informationDensity", "imageNecessity", "imageRedundancy", "imageComplementarity", "cta", "sourceDisclaimer"].map((name) => [name, { status: "passed", evidence: "offline fixture" }])),
        mobile: { viewports: [320, 375, 390, 430].map((width) => ({ width, rendered: true, readable: true, horizontalOverflow: false, styleLoss: false, brokenImages: [], fullPage: width === 390, evidenceRef: artifactRef(`atomic-mobile-${width}`) })) },
        paste: { semantics: "pre_upload_template_not_wechat_final", rendered: true, readable: true, horizontalOverflow: false, styleLoss: false, brokenImages: [], copyArtifactRef: artifactRef("atomic-copy"), htmlArtifactRef: { id: formatFact.id, hash: formatFact.htmlSha256 }, replacementManifestRef: artifactRef("atomic-replacements"), pasteEvidenceRef: artifactRef("atomic-paste"), localResourcePaths: formatFact.localResourcePaths }
      };
    }
  });
  const artifactRequest = (overrides = {}) => ({
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture",
    productSnapshotHash: restartedAggregate.aggregateHash, idempotencyKey: "atomic-artifact-attempt-1",
    idempotencyKeyPrefix: "atomic-artifact-runtime", attempt: 1, recordedAt: "2026-08-07T16:00:00.000Z",
    wholeArticleGateEnabled: true, ...overrides
  });
  const artifactStoreBeforeForbidden = JSON.stringify(readStore());
  const forbiddenArtifact = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...artifactRequest(), planOutput: { forged: true } }) });
  assert.equal(forbiddenArtifact.status, 400);
  assert.equal((await forbiddenArtifact.json()).code, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_CALLER_AUTHORITY_FORBIDDEN");
  assert.equal(JSON.stringify(readStore()), artifactStoreBeforeForbidden);
  assert.deepEqual(atomicArtifactCalls, { resolver: 0, formatter: 0, gates: 0, whole: 0 });
  const staleArtifactAuthority = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(artifactRequest({ productSnapshotHash: "0".repeat(64) })) });
  assert.equal(staleArtifactAuthority.status, 409);
  assert.equal((await staleArtifactAuthority.json()).code, "UNIFIED_ATOMIC_WECHAT_AUTHORITY_PROJECTION_HASH_MISMATCH");
  assert.equal(JSON.stringify(readStore()), artifactStoreBeforeForbidden);
  assert.deepEqual(atomicArtifactCalls, { resolver: 0, formatter: 0, gates: 0, whole: 0 });
  const failedArtifactResponse = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(artifactRequest()) });
  const failedArtifact = await failedArtifactResponse.json();
  assert.equal(failedArtifactResponse.status, 201, JSON.stringify(failedArtifact));
  assert.equal(failedArtifact.artifactState.status, "pre_upload_resource_required");
  assert.equal(failedArtifact.productProjection, null);
  assert.equal(atomicArtifactCalls.resolver, 2, "illustrated delivery resolves both the cover and the inline image");
  assert.equal(readStore().unifiedContentWechatResourceAttempts.length, 2, "failed cover and inline resource evidence must append, not disappear");
  atomicChartFails = false;
  const successfulArtifactRequest = artifactRequest({ idempotencyKey: "atomic-artifact-attempt-2", attempt: 2 });
  const successfulArtifactResponse = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(successfulArtifactRequest) });
  const successfulArtifact = await successfulArtifactResponse.json();
  assert.equal(successfulArtifactResponse.status, 201, JSON.stringify(successfulArtifact));
  assert.equal(successfulArtifact.semantics, "pre_upload_template_not_wechat_final");
  assert.equal(successfulArtifact.platformUploadPerformed, false);
  assert.equal(successfulArtifact.artifactState.reviewable, true);
  assert.equal(successfulArtifact.productProjection.contract, "UnifiedAtomicMultiplatformArtifactProjection@1.0");
  assert.deepEqual(successfulArtifact.productProjection.blockers, ["wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"]);
  assert.equal(successfulArtifact.productProjection.platforms.wechat.humanReviewAuthority, false);
  assert.deepEqual(successfulArtifact.productProjection.baseProduct.blockers, ["wechat_artifact_required", "wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"], "base aggregate must remain immutable");
  const atomicWechatHumanBase = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat`;
  const disabledHumanReview = await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}`);
  assert.equal(disabledHumanReview.status, 404);
  assert.equal((await disabledHumanReview.json()).code, "UNIFIED_ATOMIC_WECHAT_HUMAN_SELECTION_DISABLED");
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1 = "1";
  const humanScope = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture",
    candidateId: atomicWechatAuthority.candidateRef.id, productSnapshotHash: restartedAggregate.aggregateHash,
    commitRef: atomicWechatAuthority.payload.commitRef, materializedContentProjectRef: atomicWechatAuthority.materializedProjectRef,
    articleRef: atomicWechatAuthority.candidateRef
  };
  const initialHumanStateResponse = await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`);
  const initialHumanState = await initialHumanStateResponse.json();
  assert.equal(initialHumanStateResponse.status, 200, JSON.stringify(initialHumanState));
  assert.equal(initialHumanState.artifactApproved, false, "technical pass must not imply human approval");
  assert.equal(initialHumanState.editorialReviewPassed, false);
  assert.equal(initialHumanState.selected, false);
  const beforeMissingActor = JSON.stringify(readStore());
  const wechatMissingActorApproval = await fetch(`${atomicWechatHumanBase}/preupload-artifact-review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...humanScope, artifactStateHash: initialHumanState.artifactStateHash, artifactAuthoritySetHash: initialHumanState.artifactAuthoritySetHash,
    action: "approve_preupload", reason: "fixture approval", occurredAt: "2026-08-07T16:10:00.000Z", idempotencyKey: "wechat-human-approval"
  }) });
  assert.equal(wechatMissingActorApproval.status, 400);
  assert.equal((await wechatMissingActorApproval.json()).code, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_EXPLICIT_USER_REQUIRED");
  assert.equal(JSON.stringify(readStore()), beforeMissingActor);
  const approvedResponse = await fetch(`${atomicWechatHumanBase}/preupload-artifact-review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...humanScope, artifactStateHash: initialHumanState.artifactStateHash, artifactAuthoritySetHash: initialHumanState.artifactAuthoritySetHash,
    action: "approve_preupload", actorId: "user:wechat-reviewer", actorType: "user", reason: "fixture approval",
    occurredAt: "2026-08-07T16:10:00.000Z", idempotencyKey: "wechat-human-approval"
  }) });
  const approved = await approvedResponse.json();
  assert.equal(approvedResponse.status, 201, JSON.stringify(approved));
  assert.equal(approved.reviewFact.contract, "UnifiedAtomicWechatArtifactReviewFact@1.0");
  assert.equal(approved.reviewFact.actorType, "user");
  assert.equal(approved.reviewFact.uploadAuthority, false);
  const wechatApprovedStore = structuredClone(readStore());
  const forgedWechatReviewStore = structuredClone(wechatApprovedStore);
  forgedWechatReviewStore.unifiedAtomicWechatArtifactReviewFacts[0].reason = "correctly rehashed forgery";
  delete forgedWechatReviewStore.unifiedAtomicWechatArtifactReviewFacts[0].factHash;
  forgedWechatReviewStore.unifiedAtomicWechatArtifactReviewFacts[0].factHash = hashUnifiedContent(forgedWechatReviewStore.unifiedAtomicWechatArtifactReviewFacts[0]);
  writeStore(forgedWechatReviewStore);
  const forgedReviewResponse = await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`);
  assert.equal(forgedReviewResponse.status, 409);
  assert.equal((await forgedReviewResponse.json()).code, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_REVIEW_FACT_SEMANTICS_INVALID");
  writeStore(wechatApprovedStore);
  const wechatApprovalReplay = await fetch(`${atomicWechatHumanBase}/preupload-artifact-review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...humanScope, artifactStateHash: initialHumanState.artifactStateHash, artifactAuthoritySetHash: initialHumanState.artifactAuthoritySetHash,
    action: "approve_preupload", actorId: "user:wechat-reviewer", actorType: "user", reason: "fixture approval",
    occurredAt: "2026-08-07T16:10:00.000Z", idempotencyKey: "wechat-human-approval"
  }) });
  assert.equal(wechatApprovalReplay.status, 200);
  assert.equal((await wechatApprovalReplay.json()).created, false);
  const beforeEditorialInjection = JSON.stringify(readStore());
  const editorialInjection = await fetch(`${atomicWechatHumanBase}/editorial-reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...humanScope, artifactReviewFactRef: { id: approved.reviewFact.id, hash: approved.reviewFact.factHash },
    artifactStateHash: initialHumanState.artifactStateHash, artifactAuthoritySetHash: initialHumanState.artifactAuthoritySetHash,
    findings: [{ forged: true }], idempotencyKey: "wechat-editorial"
  }) });
  assert.equal(editorialInjection.status, 400);
  assert.equal((await editorialInjection.json()).code, "UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_INJECTION_FORBIDDEN");
  assert.equal(JSON.stringify(readStore()), beforeEditorialInjection);
  const wechatEditorialResponse = await fetch(`${atomicWechatHumanBase}/editorial-reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...humanScope, artifactReviewFactRef: { id: approved.reviewFact.id, hash: approved.reviewFact.factHash },
    artifactStateHash: initialHumanState.artifactStateHash, artifactAuthoritySetHash: initialHumanState.artifactAuthoritySetHash,
    idempotencyKey: "wechat-editorial"
  }) });
  const wechatEditorial = await wechatEditorialResponse.json();
  assert.equal(wechatEditorialResponse.status, 201, JSON.stringify(wechatEditorial));
  assert.equal(wechatEditorial.reviewFact.contract, "UnifiedAtomicWechatEditorialReviewFact@1.0");
  assert.equal(wechatEditorial.reviewFact.status, "passed");
  assert.equal(wechatEditorial.reviewFact.machineDerived, true);
  const wechatEditorialStore = structuredClone(readStore());
  const forgedWechatEditorialStore = structuredClone(wechatEditorialStore);
  const storedWechatEditorial = forgedWechatEditorialStore.unifiedContentReviews.find((fact) => fact.id === wechatEditorial.reviewFact.id);
  storedWechatEditorial.findings[1].evidence.materialized = false;
  delete storedWechatEditorial.factHash;
  storedWechatEditorial.factHash = hashUnifiedContent(storedWechatEditorial);
  writeStore(forgedWechatEditorialStore);
  const forgedEditorialState = await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`);
  assert.equal(forgedEditorialState.status, 409);
  assert.equal((await forgedEditorialState.json()).code, "UNIFIED_ATOMIC_WECHAT_EDITORIAL_REVIEW_FACT_SEMANTICS_INVALID");
  writeStore(wechatEditorialStore);
  const selectionRequest = (status, idempotencyKey) => ({ ...humanScope,
    artifactReviewFactRef: { id: approved.reviewFact.id, hash: approved.reviewFact.factHash },
    editorialReviewFactRef: { id: wechatEditorial.reviewFact.id, hash: wechatEditorial.reviewFact.factHash },
    artifactStateHash: initialHumanState.artifactStateHash, artifactAuthoritySetHash: initialHumanState.artifactAuthoritySetHash,
    status, actorId: "user:wechat-selector", actorType: "user", occurredAt: "2026-08-07T16:12:00.000Z", idempotencyKey });
  const wechatSelectedResponse = await fetch(`${atomicWechatHumanBase}/human-selections`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(selectionRequest("selected", "wechat-selection")) });
  const wechatSelected = await wechatSelectedResponse.json();
  assert.equal(wechatSelectedResponse.status, 201, JSON.stringify(wechatSelected));
  assert.equal(wechatSelected.selectionFact.contract, "UnifiedAtomicWechatSelectionFact@1.0");
  assert.equal(wechatSelected.selectionFact.status, "selected");
  assert.equal(wechatSelected.selectionFact.uploadAuthority, false);
  const atomicWechatDeliveryBase = atomicWechatHumanBase;
  const disabledWechatPromotion = await fetch(`${atomicWechatDeliveryBase}/promotion-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(humanScope) });
  assert.equal(disabledWechatPromotion.status, 404);
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1 = "1";
  process.env.LOCAL_CONTENT_PROMOTION_V1 = "1";
  process.env.LOCAL_PACKAGE_DELIVERY_V1 = "1";
  let wechatUploadCalls = 0;
  let failWechatUpload = true;
  setUnifiedContentServerDependenciesForTest({
    persistStore: async (value) => writeStore(value),
    wechatUploadAssetReader: async ({ kind, descriptor }) => {
      const path = kind === "html" ? descriptor.relativePath : descriptor.relativePath;
      const bytes = atomicWechatArtifactFiles.get(path);
      if (!bytes) throw Object.assign(new Error("fixture upload source missing"), { code: "FIXTURE_UPLOAD_SOURCE_MISSING" });
      return { bytes: Buffer.from(bytes) };
    },
    wechatResourceUploadTransport: async ({ role }) => {
      wechatUploadCalls += 1;
      if (failWechatUpload) throw Object.assign(new Error("fixture controlled upload failed"), { code: "FIXTURE_CONTROLLED_UPLOAD_FAILED" });
      return role === "cover" ? { mediaId: "fixture-cover-media-id" } : { url: "https://mmbiz.qpic.cn/fixture/atomic-chart-1.png" };
    }
  });
  const promotionScope = { ...humanScope, promotionRef: undefined };
  const promotionPreviewResponse = await fetch(`${atomicWechatDeliveryBase}/promotion-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(promotionScope) });
  const promotionPreview = await promotionPreviewResponse.json();
  assert.equal(promotionPreviewResponse.status, 200, JSON.stringify(promotionPreview));
  assert.equal(promotionPreview.claims.writesPerformed, false);
  const promotionResponse = await fetch(`${atomicWechatDeliveryBase}/promotion-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...promotionScope, previewToken: promotionPreview.previewToken, idempotencyKey: "wechat-promotion-final" }) });
  const promotedWechat = await promotionResponse.json();
  assert.equal(promotionResponse.status, 201, JSON.stringify(promotedWechat));
  assert.equal(promotedWechat.promotion.platformPublicationPerformed, false);
  const wechatPromotionRef = { id: promotedWechat.promotion.id, hash: promotedWechat.promotion.promotionHash };
  const uploadPlanPreviewResponse = await fetch(`${atomicWechatDeliveryBase}/resource-upload-plan-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef }) });
  const uploadPlanPreview = await uploadPlanPreviewResponse.json();
  assert.equal(uploadPlanPreviewResponse.status, 200, JSON.stringify(uploadPlanPreview));
  assert.ok(uploadPlanPreview.request.steps.some((step) => step.operation === "wechat_permanent_material_upload_for_thumb_media_id"));
  assert.ok(uploadPlanPreview.request.steps.some((step) => step.operation === "wechat_uploadimg_for_https_body_url"));
  const beforeUnapprovedPlan = JSON.stringify(readStore());
  const unapprovedPlan = await fetch(`${atomicWechatDeliveryBase}/resource-upload-plan-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, previewToken: uploadPlanPreview.previewToken, idempotencyKey: "wechat-upload-plan", actorType: "user", actorId: "user:publisher", occurredAt: "2026-08-07T16:14:00.000Z", approved: false }) });
  assert.equal(unapprovedPlan.status, 400);
  assert.equal(JSON.stringify(readStore()), beforeUnapprovedPlan);
  const uploadPlanResponse = await fetch(`${atomicWechatDeliveryBase}/resource-upload-plan-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, previewToken: uploadPlanPreview.previewToken, idempotencyKey: "wechat-upload-plan", actorType: "user", actorId: "user:publisher", occurredAt: "2026-08-07T16:14:00.000Z", approved: true }) });
  const approvedUploadPlan = await uploadPlanResponse.json();
  assert.equal(uploadPlanResponse.status, 201, JSON.stringify(approvedUploadPlan));
  const uploadPlanRef = { id: approvedUploadPlan.uploadPlan.id, hash: approvedUploadPlan.uploadPlan.planHash };
  const beforePartialPostCount = (readStore().unifiedContentWechatLifecycleFacts || []).length;
  failWechatUpload = false;
  setUnifiedContentServerDependenciesForTest({ wechatUploadPostprocess: async () => { throw Object.assign(new Error("fixture postprocess failure"), { code: "FIXTURE_POSTPROCESS_FAILED" }); } });
  const callsBeforePostprocessFailure = wechatUploadCalls;
  const postprocessFailureResponse = await fetch(`${atomicWechatDeliveryBase}/resource-upload-executions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadPlanRef, idempotencyKey: "wechat-upload-postprocess-failure" }) });
  const postprocessFailure = await postprocessFailureResponse.json();
  assert.equal(postprocessFailureResponse.status, 201, JSON.stringify(postprocessFailure));
  assert.equal(postprocessFailure.execution.status, "postprocess_failure");
  assert.equal(postprocessFailure.execution.failure.code, "FIXTURE_POSTPROCESS_FAILED");
  assert.equal(postprocessFailure.execution.attempts.length, approvedUploadPlan.uploadPlan.steps.length);
  assert.equal(postprocessFailure.execution.attempts.every((item) => item.status === "succeeded"), true);
  assert.equal(wechatUploadCalls, callsBeforePostprocessFailure + approvedUploadPlan.uploadPlan.steps.length);
  assert.equal(postprocessFailure.uploadEvidence, null);
  assert.equal(postprocessFailure.postUpload, null);
  assert.equal((readStore().unifiedContentWechatLifecycleFacts || []).length, beforePartialPostCount);
  assert.equal((readStore().unifiedAtomicWechatUploadEvidence || []).length, 0);
  assert.equal((readStore().unifiedAtomicWechatDeliveries || []).length, 0);
  setUnifiedContentServerDependenciesForTest({ wechatUploadPostprocess: null });
  failWechatUpload = true;
  const partialUploadResponse = await fetch(`${atomicWechatDeliveryBase}/resource-upload-executions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadPlanRef, idempotencyKey: "wechat-upload-partial" }) });
  const partialUpload = await partialUploadResponse.json();
  assert.equal(partialUploadResponse.status, 201, JSON.stringify(partialUpload));
  assert.equal(partialUpload.execution.status, "partial_failure");
  assert.equal(partialUpload.postUpload, null);
  assert.equal((readStore().unifiedContentWechatLifecycleFacts || []).length, beforePartialPostCount, "partial upload must create no post-upload fact");
  assert.equal((readStore().unifiedAtomicWechatDeliveries || []).length, 0, "partial upload must create no final delivery");
  failWechatUpload = false;
  const successfulUploadResponse = await fetch(`${atomicWechatDeliveryBase}/resource-upload-executions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadPlanRef, idempotencyKey: "wechat-upload-success" }) });
  const successfulUpload = await successfulUploadResponse.json();
  assert.equal(successfulUploadResponse.status, 201, JSON.stringify(successfulUpload));
  assert.equal(successfulUpload.execution.status, "succeeded");
  assert.equal(successfulUpload.postUpload.semantics, "wechat_resources_uploaded_content_not_published");
  assert.equal(/\bsrc=["'](?:assets\/|\.\.?\/|file:|data:)/i.test(successfulUpload.postUpload.html), false);
  const callsBeforeUploadReplay = wechatUploadCalls;
  const successfulUploadReplay = await fetch(`${atomicWechatDeliveryBase}/resource-upload-executions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadPlanRef, idempotencyKey: "wechat-upload-success" }) });
  assert.equal(successfulUploadReplay.status, 200);
  assert.equal(wechatUploadCalls, callsBeforeUploadReplay, "successful upload replay must make zero provider calls");
  const changedUpload = await fetch(`${atomicWechatDeliveryBase}/resource-upload-executions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadPlanRef: { ...uploadPlanRef, hash: "0".repeat(64) }, idempotencyKey: "wechat-upload-success" }) });
  assert.equal(changedUpload.status, 409);
  assert.equal(wechatUploadCalls, callsBeforeUploadReplay, "changed upload semantics must fail before provider calls");
  const uploadEvidenceRef = { id: successfulUpload.uploadEvidence.id, hash: successfulUpload.uploadEvidence.factHash };
  const postUploadRef = { id: successfulUpload.postUpload.id, hash: successfulUpload.postUpload.factHash };
  const validUploadClosureStore = structuredClone(readStore());
  for (const [label, mutate] of [
    ["execution source ref", (fact) => { fact.attempts[0].sourceAttemptRef.hash = "0".repeat(64); }],
    ["execution operation", (fact) => { fact.attempts[0].operation = "forged_upload_operation"; }],
    ["execution response", (fact) => { fact.attempts[0].response.url = "https://mmbiz.qpic.cn/fixture/forged.png"; fact.attempts[0].responseHash = hashUnifiedContent({ url: fact.attempts[0].response.url }); }]
  ]) {
    const forged = structuredClone(validUploadClosureStore);
    const fact = forged.unifiedAtomicWechatUploadExecutions.find((item) => item.id === successfulUpload.execution.id);
    mutate(fact); delete fact.factHash; fact.factHash = hashUnifiedContent(fact); writeStore(forged);
    const response = await fetch(`${atomicWechatDeliveryBase}/resource-upload-executions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadPlanRef, idempotencyKey: "wechat-upload-success" }) });
    assert.equal(response.status, 409, `${label} correctly rehashed forgery must fail closed`);
    assert.equal(wechatUploadCalls, callsBeforeUploadReplay, `${label} forgery must make zero provider calls`);
    writeStore(validUploadClosureStore);
  }
  const deliveryStateUrl = `${atomicWechatDeliveryBase}/delivery-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`;
  for (const [label, collection, id, mutate] of [
    ["evidence plan ref", "unifiedAtomicWechatUploadEvidence", successfulUpload.uploadEvidence.id, (fact) => { fact.uploadPlanRef.hash = "0".repeat(64); }],
    ["evidence execution ref", "unifiedAtomicWechatUploadEvidence", successfulUpload.uploadEvidence.id, (fact) => { fact.executionRef.hash = "0".repeat(64); }],
    ["evidence resource ref", "unifiedAtomicWechatUploadEvidence", successfulUpload.uploadEvidence.id, (fact) => { fact.resources[0].sourceAttemptRef.hash = "0".repeat(64); }],
    ["postupload predecessor ref", "unifiedContentWechatLifecycleFacts", successfulUpload.postUpload.id, (fact) => { fact.predecessorRef.hash = "0".repeat(64); }],
    ["postupload evidence ref", "unifiedContentWechatLifecycleFacts", successfulUpload.postUpload.id, (fact) => { fact.evidenceRef.hash = "0".repeat(64); }],
    ["postupload html", "unifiedContentWechatLifecycleFacts", successfulUpload.postUpload.id, (fact) => { fact.html = `${fact.html}<p>forged</p>`; fact.htmlSha256 = createHash("sha256").update(fact.html).digest("hex"); fact.htmlBytes = Buffer.byteLength(fact.html); }]
  ]) {
    const forged = structuredClone(validUploadClosureStore);
    const fact = forged[collection].find((item) => item.id === id); mutate(fact); delete fact.factHash; fact.factHash = hashUnifiedContent(fact); writeStore(forged);
    const response = await fetch(deliveryStateUrl);
    assert.equal(response.status, 409, `${label} correctly rehashed forgery must fail closed`);
    writeStore(validUploadClosureStore);
  }
  const finalDeliveryResponse = await fetch(`${atomicWechatDeliveryBase}/final-delivery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...humanScope, promotionRef: wechatPromotionRef, uploadEvidenceRef, postUploadRef, idempotencyKey: "wechat-final-delivery" }) });
  const finalWechatDelivery = await finalDeliveryResponse.json();
  assert.equal(finalDeliveryResponse.status, 201, JSON.stringify(finalWechatDelivery));
  assert.equal(finalWechatDelivery.delivery.deliveryReady, true);
  assert.equal(finalWechatDelivery.delivery.published, false);
  assert.equal(finalWechatDelivery.delivery.bundle.manifest.claims.platformUploadPerformed, true);
  assert.equal(finalWechatDelivery.delivery.bundle.manifest.claims.platformPublicationPerformed, false);
  const wechatPublicationScope = {
    ...humanScope, platform: "wechat", contentProjectRef: finalWechatDelivery.delivery.contentProjectRef,
    materializedContentProjectRef: finalWechatDelivery.delivery.materializedContentProjectRef,
    commitRef: finalWechatDelivery.delivery.commitRef, platformRunRef: finalWechatDelivery.delivery.platformRunRef,
    articleRef: finalWechatDelivery.delivery.articleRef, promotionRef: finalWechatDelivery.delivery.promotionRef,
    promotedVersionRef: finalWechatDelivery.delivery.promotedVersionRef, uploadEvidenceRef: finalWechatDelivery.delivery.uploadEvidenceRef,
    postUploadRef: finalWechatDelivery.delivery.postUploadRef,
    deliveryRef: { id: finalWechatDelivery.delivery.id, hash: finalWechatDelivery.delivery.factHash }, manifestRef: finalWechatDelivery.delivery.manifestRef
  };
  const draftPreviewUrl = `${atomicWechatDeliveryBase}/draft-preview`;
  const disabledDraft = await fetch(draftPreviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatPublicationScope) });
  assert.equal(disabledDraft.status, 404);
  assert.equal((await disabledDraft.json()).code, "ATOMIC_WECHAT_DRAFT_CREATION_DISABLED");
  process.env.ATOMIC_WECHAT_DRAFT_CREATION_V1 = "1";
  const draftPreviewResponse = await fetch(draftPreviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatPublicationScope) });
  const draftPreview = await draftPreviewResponse.json();
  assert.equal(draftPreviewResponse.status, 200, JSON.stringify(draftPreview));
  assert.equal(draftPreview.request.draft.thumbMediaId, "fixture-cover-media-id", "the illustrated package must bind its uploaded cover as thumb_media_id");
  assert.equal(draftPreview.claims.draftCreated, false, "preview remains read-only and must not create a WeChat draft");
  const wechatPublicationPreviewUrl = `${atomicWechatDeliveryBase}/manual-publication-preview`;
  const wechatPublicationConfirmUrl = `${atomicWechatDeliveryBase}/manual-publication-confirm`;
  const beforeDisabledWechatPublication = structuredClone(readStore());
  const disabledWechatPublication = await fetch(wechatPublicationPreviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatPublicationScope) });
  assert.equal(disabledWechatPublication.status, 404);
  assert.equal((await disabledWechatPublication.json()).code, "ATOMIC_MANUAL_PUBLICATION_DISABLED");
  assert.deepEqual(readStore(), beforeDisabledWechatPublication);
  process.env.ATOMIC_MANUAL_PUBLICATION_V1 = "1";
  const beforeWechatPublicationPreview = structuredClone(readStore());
  const wechatPublicationPreviewResponse = await fetch(wechatPublicationPreviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatPublicationScope) });
  const wechatPublicationPreview = await wechatPublicationPreviewResponse.json();
  assert.equal(wechatPublicationPreviewResponse.status, 200, JSON.stringify(wechatPublicationPreview));
  assert.equal(wechatPublicationPreview.request.platform, "wechat");
  assert.deepEqual(wechatPublicationPreview.request.uploadEvidenceRef, uploadEvidenceRef);
  assert.deepEqual(wechatPublicationPreview.request.postUploadRef, postUploadRef);
  assert.equal(wechatPublicationPreview.claims.platformApiPublicationPerformed, false);
  assert.deepEqual(readStore(), beforeWechatPublicationPreview, "WeChat publication preview must be read-only");
  const wechatPublicationEvidence = {
    ...wechatPublicationScope, previewToken: wechatPublicationPreview.previewToken, idempotencyKey: "wechat-manual-publication",
    actorType: "user", actorId: "user:wechat-manual-publisher", method: "manual_platform_observation",
    confirmedAt: "2026-08-06T16:12:00.000Z", publishedAt: "2026-07-31T00:00:00.000Z",
    platformContentId: "AbCdEfGhIjKlMnOp", platformUrl: "https://mp.weixin.qq.com/s/AbCdEfGhIjKlMnOp"
  };
  for (const [label, overrides, expectedCode] of [
    ["non-user", { actorType: "service" }, "ATOMIC_MANUAL_PUBLICATION_USER_REQUIRED"],
    ["wrong-method", { method: "provider_response" }, "ATOMIC_MANUAL_PUBLICATION_METHOD_INVALID"],
    ["wrong-domain", { platformUrl: "https://example.com/s/AbCdEfGhIjKlMnOp" }, "ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID"],
    ["wrong-path", { platformUrl: "https://mp.weixin.qq.com/profile/AbCdEfGhIjKlMnOp" }, "ATOMIC_MANUAL_PUBLICATION_URL_CONTENT_ID_INVALID"],
    ["credentials", { platformUrl: "https://user:pass@mp.weixin.qq.com/s/AbCdEfGhIjKlMnOp" }, "ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID"],
    ["port", { platformUrl: "https://mp.weixin.qq.com:8443/s/AbCdEfGhIjKlMnOp" }, "ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID"],
    ["fragment", { platformUrl: "https://mp.weixin.qq.com/s/AbCdEfGhIjKlMnOp#fragment" }, "ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID"],
    ["explicit-id-conflict", { platformContentId: "DifferentWechatId" }, "ATOMIC_MANUAL_PUBLICATION_URL_ID_MISMATCH"],
    ["future-time", { publishedAt: "2099-01-01T00:00:00.000Z" }, "ATOMIC_MANUAL_PUBLICATION_PUBLISHED_AT_INVALID"]
  ]) {
    const before = structuredClone(readStore());
    const response = await fetch(wechatPublicationConfirmUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...wechatPublicationEvidence, ...overrides }) });
    assert.equal(response.status, expectedCode.endsWith("MISMATCH") ? 409 : 400, label);
    assert.equal((await response.json()).code, expectedCode, label);
    assert.deepEqual(readStore(), before, `${label} must be zero-write`);
  }
  const beforeWechatPublication = structuredClone(readStore());
  const wechatPublicationResponse = await fetch(wechatPublicationConfirmUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatPublicationEvidence) });
  const wechatPublication = await wechatPublicationResponse.json();
  assert.equal(wechatPublicationResponse.status, 201, JSON.stringify(wechatPublication));
  assert.equal(wechatPublication.publication.contract, "ControlledManualPublication@1.0");
  assert.equal(wechatPublication.publication.platform, "wechat");
  assert.equal(wechatPublication.publication.canonicalPlatformContentId, "AbCdEfGhIjKlMnOp");
  assert.equal(wechatPublication.publication.canonicalPlatformUrl, "https://mp.weixin.qq.com/s/AbCdEfGhIjKlMnOp");
  assert.deepEqual(wechatPublication.publication.claims, { platformApiPublicationPerformed: false, humanPublicationConfirmed: true });
  const afterWechatPublication = readStore();
  const wechatPublicationChangedKeys = [...new Set([...Object.keys(beforeWechatPublication), ...Object.keys(afterWechatPublication)])]
    .filter((key) => JSON.stringify(beforeWechatPublication[key]) !== JSON.stringify(afterWechatPublication[key])).sort();
  assert.deepEqual(wechatPublicationChangedKeys, ["unifiedAtomicManualPublications"]);
  const wechatPublicationReplay = await fetch(wechatPublicationConfirmUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatPublicationEvidence) });
  const wechatPublicationReplayBody = await wechatPublicationReplay.json();
  assert.equal(wechatPublicationReplay.status, 200, JSON.stringify(wechatPublicationReplayBody));
  assert.equal(wechatPublicationReplayBody.created, false);
  const beforeWechatPublicationConflict = structuredClone(readStore());
  const wechatPublicationConflict = await fetch(wechatPublicationConfirmUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...wechatPublicationEvidence, publishedAt: "2026-07-31T00:01:00.000Z" }) });
  assert.equal(wechatPublicationConflict.status, 409);
  assert.equal((await wechatPublicationConflict.json()).code, "ATOMIC_MANUAL_PUBLICATION_IDEMPOTENCY_CONFLICT");
  assert.deepEqual(readStore(), beforeWechatPublicationConflict);
  const duplicateWechatPublication = await fetch(wechatPublicationConfirmUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...wechatPublicationEvidence, idempotencyKey: "wechat-manual-publication-duplicate" }) });
  assert.equal(duplicateWechatPublication.status, 409);
  assert.equal((await duplicateWechatPublication.json()).code, "ATOMIC_MANUAL_PUBLICATION_CONTENT_DUPLICATE");
  assert.deepEqual(readStore(), beforeWechatPublicationConflict);
  const wechatFeedbackBase = atomicWechatDeliveryBase;
  const wechatFeedbackRequest = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture",
    publicationRef: { id: wechatPublication.publication.id, hash: wechatPublication.publication.factHash },
    platformContentId: "AbCdEfGhIjKlMnOp", platformUrl: "https://mp.weixin.qq.com/s/AbCdEfGhIjKlMnOp"
  };
  const disabledWechatFeedbackBefore = structuredClone(readStore());
  const disabledWechatFeedback = await fetch(`${wechatFeedbackBase}/exact-feedback-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatFeedbackRequest) });
  assert.equal(disabledWechatFeedback.status, 404);
  assert.equal((await disabledWechatFeedback.json()).code, "ATOMIC_EXACT_FEEDBACK_DISABLED");
  assert.deepEqual(readStore(), disabledWechatFeedbackBefore, "disabled WeChat feedback must be zero-write");
  process.env.ATOMIC_EXACT_FEEDBACK_V1 = "1";
  const feedbackPreviewBefore = structuredClone(readStore());
  const feedbackPreviewResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatFeedbackRequest) });
  const feedbackPreview = await feedbackPreviewResponse.json();
  assert.equal(feedbackPreviewResponse.status, 200, JSON.stringify(feedbackPreview));
  assert.equal(feedbackPreview.request.platform, "wechat");
  assert.deepEqual(readStore(), feedbackPreviewBefore, "WeChat feedback preview must be read-only");
  const wechat72hFeedback = {
    ...wechatFeedbackRequest, previewToken: feedbackPreview.previewToken, requestHash: feedbackPreview.requestHash,
    idempotencyKey: "wechat-feedback-72h", actorType: "user", actorId: "user:wechat-analyst",
    measurementWindow: { label: "72h", startedAt: "2026-07-31T00:00:00.000Z", endedAt: "2026-08-03T00:00:00.000Z" },
    cutoffAt: "2026-08-03T00:00:00.000Z", collectedAt: "2026-08-03T01:00:00.000Z",
    source: { kind: "manual_entry", evidenceRef: { id: "wechat-metric-evidence:72h", hash: "7".repeat(64) } },
    metrics: { reads: 1200, likes: 80, shares: 25, favorites: 40, comments: 12, newFollowers: 9 }
  };
  for (const [label, mutate, expectedCode] of [
    ["mixed-xhs-content-id", (value) => { value.platformContentId = "68a1b2c3d4e5f67890123456"; }, "ATOMIC_EXACT_FEEDBACK_CONTENT_ID_MISMATCH"],
    ["xhs-only-metric", (value) => { value.metrics = { views: 100 }; }, "ATOMIC_EXACT_FEEDBACK_METRIC_UNKNOWN"],
    ["fractional-metric", (value) => { value.metrics.reads = 1.5; }, "ATOMIC_EXACT_FEEDBACK_METRIC_INVALID"],
    ["negative-metric", (value) => { value.metrics.reads = -1; }, "ATOMIC_EXACT_FEEDBACK_METRIC_INVALID"],
    ["noncanonical-window", (value) => { value.measurementWindow.endedAt = "2026-08-02T23:00:00.000Z"; }, "ATOMIC_EXACT_FEEDBACK_WINDOW_DURATION_INVALID"],
    ["missing-source", (value) => { value.source = { kind: "manual_entry" }; }, "ATOMIC_EXACT_FEEDBACK_SOURCE_EVIDENCE_REQUIRED"]
  ]) {
    const candidate = structuredClone(wechat72hFeedback); mutate(candidate); candidate.idempotencyKey = `wechat-feedback-reject:${label}`;
    const before = structuredClone(readStore());
    const response = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(candidate) });
    assert.equal((await response.json()).code, expectedCode, label);
    assert.deepEqual(readStore(), before, `${label} must preserve the complete store`);
  }
  const beforeWechat72h = structuredClone(readStore());
  const wechat72hResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechat72hFeedback) });
  const wechat72h = await wechat72hResponse.json();
  assert.equal(wechat72hResponse.status, 201, JSON.stringify(wechat72h));
  assert.equal(wechat72h.snapshot.platform, "wechat");
  assert.deepEqual(Object.keys(readStore()).filter((key) => JSON.stringify(readStore()[key]) !== JSON.stringify(beforeWechat72h[key])), ["unifiedAtomicPublicationMetricSnapshots"]);
  const replay72h = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechat72hFeedback) });
  assert.equal(replay72h.status, 200);
  assert.equal((await replay72h.json()).created, false);
  const wechat7dFeedback = structuredClone(wechat72hFeedback);
  wechat7dFeedback.idempotencyKey = "wechat-feedback-7d-import";
  wechat7dFeedback.measurementWindow = { label: "7d", startedAt: "2026-07-31T00:00:00.000Z", endedAt: "2026-08-07T00:00:00.000Z" };
  wechat7dFeedback.cutoffAt = "2026-08-07T00:00:00.000Z";
  wechat7dFeedback.collectedAt = "2026-08-07T01:00:00.000Z";
  wechat7dFeedback.source = { kind: "csv_import", rawRowHash: "8".repeat(64), batchId: "wechat-batch-7d", rowNumber: 1,
    row: { publicationId: wechatPublication.publication.id, platformContentId: "AbCdEfGhIjKlMnOp" } };
  for (const [label, row] of [
    ["wrong-import-publication", { publicationId: "atomic-manual-publication:wrong", platformContentId: "AbCdEfGhIjKlMnOp" }],
    ["mixed-import-content", { publicationId: wechatPublication.publication.id, platformContentId: "68a1b2c3d4e5f67890123456" }]
  ]) {
    const invalidImport = structuredClone(wechat7dFeedback);
    invalidImport.idempotencyKey = `wechat-feedback-import-reject:${label}`;
    invalidImport.source.row = row;
    const before = structuredClone(readStore());
    const response = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invalidImport) });
    assert.equal(response.status, 409, label);
    assert.equal((await response.json()).code, "ATOMIC_EXACT_FEEDBACK_IMPORT_ID_MISMATCH", label);
    assert.deepEqual(readStore(), before, `${label} must preserve the complete store`);
  }
  const wechat7dResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechat7dFeedback) });
  const wechat7d = await wechat7dResponse.json();
  assert.equal(wechat7dResponse.status, 201, JSON.stringify(wechat7d));
  assert.equal(wechat7d.importBatch.snapshotRef.hash, wechat7d.snapshot.snapshotHash);
  const feedbackStateBefore = structuredClone(readStore());
  const feedbackStateResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-state`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatFeedbackRequest) });
  const feedbackState = await feedbackStateResponse.json();
  assert.equal(feedbackStateResponse.status, 200, JSON.stringify(feedbackState));
  assert.equal(feedbackState.snapshotCount, 2);
  assert.equal(feedbackState.windowMaturity["72h"].snapshotRecorded, true);
  assert.equal(feedbackState.windowMaturity["7d"].snapshotRecorded, true);
  assert.deepEqual(readStore(), feedbackStateBefore, "feedback projection must be read-only");
  const crossPlatformReplayStore = structuredClone(readStore());
  const crossPlatformReplay = crossPlatformReplayStore.unifiedAtomicPublicationMetricSnapshots.find((item) => item.id === wechat72h.snapshot.id);
  crossPlatformReplay.platform = "xiaohongshu";
  crossPlatformReplay.platformContentId = "68a1b2c3d4e5f67890123456";
  crossPlatformReplay.metrics = { views: 1200, likes: 80 };
  crossPlatformReplay.requestHash = hashUnifiedContent({
    schemaVersion: "1.0", contract: "AtomicPublicationFeedbackRequest@1.0", workspaceId: crossPlatformReplay.workspaceId,
    companyId: crossPlatformReplay.companyId, accountId: crossPlatformReplay.accountId, platform: crossPlatformReplay.platform,
    platformContentId: crossPlatformReplay.platformContentId, contentProjectRef: crossPlatformReplay.contentProjectRef,
    publicationRef: crossPlatformReplay.publicationRef, measurementWindow: crossPlatformReplay.measurementWindow,
    cutoffAt: crossPlatformReplay.cutoffAt, collectedAt: crossPlatformReplay.collectedAt, source: crossPlatformReplay.source,
    actorType: crossPlatformReplay.actorType, actorId: crossPlatformReplay.actorId, metrics: crossPlatformReplay.metrics
  });
  crossPlatformReplay.id = `atomic-publication-metrics:${hashUnifiedContent({ requestHash: crossPlatformReplay.requestHash, idempotencyKey: crossPlatformReplay.idempotencyKey }).slice(0, 24)}`;
  delete crossPlatformReplay.snapshotHash; crossPlatformReplay.snapshotHash = hashUnifiedContent(crossPlatformReplay);
  writeStore(crossPlatformReplayStore);
  const crossPlatformReplayBefore = structuredClone(readStore());
  const crossPlatformReplayResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechat72hFeedback) });
  assert.equal(crossPlatformReplayResponse.status, 409);
  assert.equal((await crossPlatformReplayResponse.json()).code, "ATOMIC_EXACT_FEEDBACK_PLATFORM_MISMATCH");
  assert.deepEqual(readStore(), crossPlatformReplayBefore, "correctly rehashed cross-platform existing replay must be zero-write");
  writeStore(feedbackStateBefore);
  const forgedImportStore = structuredClone(readStore());
  const forgedImportBatch = forgedImportStore.unifiedAtomicMetricImportBatches.find((item) => item.id === wechat7d.importBatch.id);
  forgedImportBatch.platformContentId = "68a1b2c3d4e5f67890123456";
  delete forgedImportBatch.batchHash; forgedImportBatch.batchHash = hashUnifiedContent(forgedImportBatch);
  writeStore(forgedImportStore);
  const forgedImportBefore = structuredClone(readStore());
  const forgedImportResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechat7dFeedback) });
  assert.equal(forgedImportResponse.status, 409);
  assert.equal((await forgedImportResponse.json()).code, "ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_SNAPSHOT_MISMATCH");
  assert.deepEqual(readStore(), forgedImportBefore, "correctly rehashed import cross-ref forgery must be zero-write");
  writeStore(feedbackStateBefore);
  const forgedFeedbackStore = structuredClone(readStore());
  const forgedSnapshot = forgedFeedbackStore.unifiedAtomicPublicationMetricSnapshots.find((item) => item.id === wechat72h.snapshot.id);
  forgedSnapshot.publicationRef.hash = "9".repeat(64);
  forgedSnapshot.requestHash = hashUnifiedContent({
    schemaVersion: "1.0", contract: "AtomicPublicationFeedbackRequest@1.0", workspaceId: forgedSnapshot.workspaceId,
    companyId: forgedSnapshot.companyId, accountId: forgedSnapshot.accountId, platform: forgedSnapshot.platform,
    platformContentId: forgedSnapshot.platformContentId, contentProjectRef: forgedSnapshot.contentProjectRef,
    publicationRef: forgedSnapshot.publicationRef, measurementWindow: forgedSnapshot.measurementWindow,
    cutoffAt: forgedSnapshot.cutoffAt, collectedAt: forgedSnapshot.collectedAt, source: forgedSnapshot.source,
    actorType: forgedSnapshot.actorType, actorId: forgedSnapshot.actorId, metrics: forgedSnapshot.metrics
  });
  forgedSnapshot.id = `atomic-publication-metrics:${hashUnifiedContent({ requestHash: forgedSnapshot.requestHash, idempotencyKey: forgedSnapshot.idempotencyKey }).slice(0, 24)}`;
  delete forgedSnapshot.snapshotHash; forgedSnapshot.snapshotHash = hashUnifiedContent(forgedSnapshot);
  writeStore(forgedFeedbackStore);
  const forgedFeedbackBefore = structuredClone(readStore());
  const forgedFeedbackResponse = await fetch(`${wechatFeedbackBase}/exact-feedback-confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechat72hFeedback) });
  assert.equal(forgedFeedbackResponse.status, 404);
  assert.equal((await forgedFeedbackResponse.json()).code, "ATOMIC_EXACT_FEEDBACK_PUBLICATION_MISMATCH");
  assert.deepEqual(readStore(), forgedFeedbackBefore, "correctly rehashed feedback Publication forgery must be zero-write");
  writeStore(feedbackStateBefore);
  process.env.ATOMIC_EXACT_FEEDBACK_V1 = "0";
  const deliveryState = await (await fetch(deliveryStateUrl)).json();
  assert.deepEqual({ promoted: deliveryState.promoted, uploaded: deliveryState.uploaded, deliveryReady: deliveryState.deliveryReady, draftCreated: deliveryState.draftCreated, published: deliveryState.published }, { promoted: true, uploaded: true, deliveryReady: true, draftCreated: false, published: true });
  assert.equal(deliveryState.published, true);
  assert.deepEqual(deliveryState.publicationRef, { id: wechatPublication.publication.id, hash: wechatPublication.publication.factHash });
  assert.equal(deliveryState.blockers.includes("wechat_manual_draft_or_publication_required"), false);
  const validWechatPublicationStore = structuredClone(readStore());
  const forgedWechatPublicationStore = structuredClone(validWechatPublicationStore);
  const forgedWechatPublication = forgedWechatPublicationStore.unifiedAtomicManualPublications.find((item) => item.id === wechatPublication.publication.id);
  forgedWechatPublication.uploadEvidenceRef.hash = "0".repeat(64);
  delete forgedWechatPublication.factHash;
  forgedWechatPublication.factHash = hashUnifiedContent(forgedWechatPublication);
  writeStore(forgedWechatPublicationStore);
  const forgedWechatPublicationState = await fetch(deliveryStateUrl);
  assert.equal(forgedWechatPublicationState.status, 409, "correctly rehashed publication cross-ref forgery must fail closed");
  writeStore(validWechatPublicationStore);
  process.env.ATOMIC_MANUAL_PUBLICATION_V1 = "0";
  const validDeliveryStore = structuredClone(readStore());
  const forgedDeliveryStore = structuredClone(validDeliveryStore);
  forgedDeliveryStore.unifiedAtomicWechatDeliveries[0].published = true;
  delete forgedDeliveryStore.unifiedAtomicWechatDeliveries[0].factHash;
  forgedDeliveryStore.unifiedAtomicWechatDeliveries[0].factHash = hashUnifiedContent(forgedDeliveryStore.unifiedAtomicWechatDeliveries[0]);
  writeStore(forgedDeliveryStore);
  const forgedDeliveryState = await fetch(deliveryStateUrl);
  assert.equal(forgedDeliveryState.status, 409, "correctly rehashed delivery authority forgery must fail closed");
  writeStore(validDeliveryStore);
  const wechatSelectedStore = structuredClone(readStore());
  const forgedWechatSelectionStore = structuredClone(wechatSelectedStore);
  const storedWechatSelection = forgedWechatSelectionStore.unifiedContentSelections.find((fact) => fact.id === wechatSelected.selectionFact.id);
  storedWechatSelection.actorId = "user:forged-selector";
  delete storedWechatSelection.factHash;
  storedWechatSelection.factHash = hashUnifiedContent(storedWechatSelection);
  writeStore(forgedWechatSelectionStore);
  const forgedSelectionState = await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`);
  assert.equal(forgedSelectionState.status, 409);
  assert.equal((await forgedSelectionState.json()).code, "UNIFIED_ATOMIC_WECHAT_SELECTION_FACT_SEMANTICS_INVALID");
  writeStore(wechatSelectedStore);
  const beforeSelectionConflict = JSON.stringify(readStore());
  const selectionConflict = await fetch(`${atomicWechatHumanBase}/human-selections`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(selectionRequest("not_selected", "wechat-selection")) });
  assert.equal(selectionConflict.status, 409);
  assert.equal((await selectionConflict.json()).code, "UNIFIED_ATOMIC_WECHAT_SELECTION_IDEMPOTENCY_CONFLICT");
  assert.equal(JSON.stringify(readStore()), beforeSelectionConflict);
  const notSelectedResponse = await fetch(`${atomicWechatHumanBase}/human-selections`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(selectionRequest("not_selected", "wechat-not-selected")) });
  assert.equal(notSelectedResponse.status, 201);
  assert.equal((await notSelectedResponse.json()).selectionFact.status, "not_selected");
  const completedHumanState = await (await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`)).json();
  assert.equal(completedHumanState.artifactApproved, true);
  assert.equal(completedHumanState.editorialReviewPassed, true);
  assert.equal(completedHumanState.selected, false);
  assert.equal(completedHumanState.selectionStatus, "not_selected");
  assert.equal(completedHumanState.uploadAuthority, false);
  assert.equal(completedHumanState.promotionAuthority, false);
  assert.equal(completedHumanState.deliveryAuthority, false);
  assert.equal(completedHumanState.publicationAuthority, false);
  assert.deepEqual(restartedAggregate.blockers, ["wechat_artifact_required", "wechat_human_review_required", "wechat_selection_required", "wechat_promotion_required"], "base aggregate hash and blockers remain immutable");
  const forgedArtifactProjection = structuredClone(successfulArtifact.productProjection);
  forgedArtifactProjection.platforms.wechat.artifactStateRef.hash = "0".repeat(64);
  delete forgedArtifactProjection.projectionHash;
  forgedArtifactProjection.projectionHash = hashUnifiedContent(forgedArtifactProjection);
  assert.throws(() => validateUnifiedAtomicMultiplatformArtifactProjection(forgedArtifactProjection),
    (error) => error.code === "UNIFIED_ATOMIC_WECHAT_ARTIFACT_PROJECTION_CLOSURE_INVALID",
    "a correctly rehashed artifactStateRef forgery must fail full pure-projection closure");
  const storeBeforeAtomicWechatBypasses = JSON.stringify(readStore());
  const callsBeforeAtomicWechatBypasses = structuredClone(atomicArtifactCalls);
  const genericArtifactRoute = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/artifacts`;
  for (const operation of ["wechat_plan", "wechat_resources", "wechat_format", "wechat_quality", "wechat_preupload_runtime_result", "wechat_post_upload", "wechat_draft", "wechat_publication", "unknown_direct_write"]) {
    const response = await fetch(genericArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture",
      candidateId: atomicWechatAuthority.candidateRef.id, operation, idempotencyKey: `bypass-${operation}`
    }) });
    assert.equal(response.status, 409, operation);
    assert.equal((await response.json()).code, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_STAGE_REQUIRED", operation);
    assert.equal(JSON.stringify(readStore()), storeBeforeAtomicWechatBypasses, `${operation} must be zero-write`);
    assert.deepEqual(atomicArtifactCalls, callsBeforeAtomicWechatBypasses, `${operation} must make zero controlled calls`);
  }
  const genericArtifactReviewRoute = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/artifact-review`;
  const bypassReview = await fetch(genericArtifactReviewRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture",
    candidateId: atomicWechatAuthority.candidateRef.id, action: "approve_preupload", artifactStateHash: successfulArtifact.artifactState.artifactStateHash,
    reviewerId: "human:bypass", reason: "must not be accepted", payload: {}, idempotencyKey: "bypass-review"
  }) });
  assert.equal(bypassReview.status, 409);
  assert.equal((await bypassReview.json()).code, "UNIFIED_ATOMIC_WECHAT_HUMAN_REVIEW_STAGE_REQUIRED");
  assert.equal(JSON.stringify(readStore()), storeBeforeAtomicWechatBypasses);
  assert.deepEqual(atomicArtifactCalls, callsBeforeAtomicWechatBypasses);
  for (const action of ["reviews", "selections"]) {
    const response = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/${action}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture", candidateId: atomicWechatAuthority.candidateRef.id })
    });
    assert.equal(response.status, 409, action);
    assert.equal((await response.json()).code, "UNIFIED_ATOMIC_WECHAT_DOWNSTREAM_STAGE_REQUIRED", action);
    assert.equal(JSON.stringify(readStore()), storeBeforeAtomicWechatBypasses, `${action} must be zero-write`);
    assert.deepEqual(atomicArtifactCalls, callsBeforeAtomicWechatBypasses, `${action} must make zero controlled calls`);
  }
  const disabledExactFeedbackBypass = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/exact-feedback-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture" })
  });
  assert.equal(disabledExactFeedbackBypass.status, 404);
  assert.equal((await disabledExactFeedbackBypass.json()).code, "ATOMIC_EXACT_FEEDBACK_DISABLED");
  assert.equal(JSON.stringify(readStore()), storeBeforeAtomicWechatBypasses, "disabled dedicated exact-feedback stage must be zero-write");
  const disabledAtomicWechatPublicationBypass = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/manual-publication-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "wechat_account_fixture", candidateId: atomicWechatAuthority.candidateRef.id })
  });
  assert.equal(disabledAtomicWechatPublicationBypass.status, 404);
  assert.equal((await disabledAtomicWechatPublicationBypass.json()).code, "ATOMIC_MANUAL_PUBLICATION_DISABLED");
  assert.equal(JSON.stringify(readStore()), storeBeforeAtomicWechatBypasses, "disabled dedicated publication stage must be zero-write");
  assert.equal(readStore().unifiedContentWechatResourceAttempts.length, 4, "retry must preserve both failed attempts and append cover plus inline successes");
  assert.equal(readStore().unifiedContentWechatQualityFacts.length, 6);
  assert.equal(readStore().unifiedContentWechatWholeArticleQualityFacts.length, 1);
  const callsBeforeArtifactReplay = structuredClone(atomicArtifactCalls);
  const artifactReplayResponse = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(successfulArtifactRequest) });
  assert.equal(artifactReplayResponse.status, 200);
  assert.equal((await artifactReplayResponse.json()).created, false);
  assert.deepEqual(atomicArtifactCalls, callsBeforeArtifactReplay, "replay must make zero resource/format/gate calls");
  const storeBeforeArtifactConflict = JSON.stringify(readStore());
  const artifactConflictResponse = await fetch(atomicArtifactRoute, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...successfulArtifactRequest, attempt: 3 }) });
  assert.equal(artifactConflictResponse.status, 409);
  assert.equal((await artifactConflictResponse.json()).code, "UNIFIED_ATOMIC_WECHAT_ARTIFACT_IDEMPOTENCY_CONFLICT");
  assert.equal(JSON.stringify(readStore()), storeBeforeArtifactConflict);
  assert.deepEqual(atomicArtifactCalls, callsBeforeArtifactReplay);
  const upstreamChangedStore = structuredClone(readStore());
  const appendedResourceAttempt = structuredClone(upstreamChangedStore.unifiedContentWechatResourceAttempts.at(-1));
  appendedResourceAttempt.id = `${appendedResourceAttempt.id}:new-upstream-attempt`;
  appendedResourceAttempt.attempt = Number(appendedResourceAttempt.attempt || 2) + 1;
  delete appendedResourceAttempt.factHash;
  appendedResourceAttempt.factHash = hashWechatArtifactValue(appendedResourceAttempt);
  upstreamChangedStore.unifiedContentWechatResourceAttempts.push(appendedResourceAttempt);
  writeStore(upstreamChangedStore);
  const staleHumanStateResponse = await fetch(`${atomicWechatHumanBase}/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`);
  const staleHumanState = await staleHumanStateResponse.json();
  assert.equal(staleHumanStateResponse.status, 200, JSON.stringify(staleHumanState));
  assert.equal(staleHumanState.stale, true, "any new resource attempt must stale prior human authority");
  assert.equal(staleHumanState.artifactApproved, false);
  assert.equal(staleHumanState.editorialReviewPassed, false);
  assert.equal(staleHumanState.selected, false);
  const staleWriteSnapshot = JSON.stringify(readStore());
  const staleSelectionResponse = await fetch(`${atomicWechatHumanBase}/human-selections`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(selectionRequest("selected", "wechat-stale-selection")) });
  assert.equal(staleSelectionResponse.status, 409);
  assert.equal((await staleSelectionResponse.json()).code, "UNIFIED_ATOMIC_WECHAT_SELECTION_HUMAN_APPROVAL_REQUIRED");
  assert.equal(JSON.stringify(readStore()), staleWriteSnapshot, "stale selection must be zero-write");
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const restartedArtifactStateResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/artifacts?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}`);
  const restartedArtifactState = await restartedArtifactStateResponse.json();
  assert.equal(restartedArtifactStateResponse.status, 200, JSON.stringify(restartedArtifactState));
  assert.equal(restartedArtifactState.reviewable, false, "new unformatted resource attempt must relock technical review");
  assert.deepEqual(restartedArtifactState.materializedContentProjectRef, atomicWechatAuthority.materializedProjectRef);
  const restartedHumanStateResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat/human-review-state?workspaceId=workspace_default&companyId=company_fixture&accountId=wechat_account_fixture&candidateId=${encodeURIComponent(atomicWechatAuthority.candidateRef.id)}&productSnapshotHash=${restartedAggregate.aggregateHash}`);
  const restartedHumanState = await restartedHumanStateResponse.json();
  assert.equal(restartedHumanStateResponse.status, 200, JSON.stringify(restartedHumanState));
  assert.equal(restartedHumanState.stale, true, "stale review state must survive listener restart and durable reload");
  assert.equal(restartedHumanState.artifactApproved, false);
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1 = "0";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1 = "0";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1 = "0";

  const atomicAuthority = resolveUnifiedContentAuthority(readStore(), {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture",
    projectId: atomicProduct.id, platform: "xiaohongshu", productSnapshotHash: atomicProduct.projectionHash,
    candidateRef: atomicProduct.refs.candidateRef
  }, { atomicProductEnabled: true });
  assert.equal(atomicAuthority.authorityKind, "atomic_v2");
  assert.deepEqual(atomicAuthority.executionProjectRef, atomicProduct.refs.contentProjectIdentityRef);
  assert.deepEqual(atomicAuthority.materializedProjectRef, atomicProduct.refs.materializedContentProjectRef);
  assert.deepEqual(atomicAuthority.candidateRef, atomicProduct.refs.candidateRef);
  assert.ok(Object.isFrozen(atomicAuthority) && Object.isFrozen(atomicAuthority.payload.components));
  assert.equal(validateUnifiedContentAuthorityResolution(atomicAuthority), true);
  const assertAuthorityMutationCases = (valid, cases) => {
    for (const { name, mutate, code } of cases) {
      const mutated = structuredClone(valid);
      mutate(mutated);
      assert.throws(() => validateUnifiedContentAuthorityResolution(mutated), (error) => error.code === code, name);
    }
  };
  assertAuthorityMutationCases(atomicAuthority, [
    { name: "atomic missing root field", mutate: (value) => { delete value.contract; }, code: "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID" },
    { name: "atomic extra root field", mutate: (value) => { value.legacySnapshot = {}; }, code: "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID" },
    { name: "atomic extra payload field", mutate: (value) => { value.payload.fallback = {}; }, code: "UNIFIED_CONTENT_AUTHORITY_ATOMIC_PAYLOAD_FIELDS_INVALID" },
    { name: "atomic tampered authority hash", mutate: (value) => { value.productAuthorityHash = "0".repeat(64); }, code: "UNIFIED_CONTENT_AUTHORITY_ATOMIC_OWNERSHIP_INVALID" },
    { name: "atomic wrong ref kind", mutate: (value) => { value.executionProjectRef = structuredClone(value.candidateRef); }, code: "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_CLOSURE_INVALID" },
    { name: "atomic detached candidate payload", mutate: (value) => { value.payload.candidate.id += ":tampered"; }, code: "UNIFIED_CONTENT_AUTHORITY_ATOMIC_PAYLOAD_CLOSURE_INVALID" }
  ]);

  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";
  process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = "1";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = "1";
  process.env.FLOW_IMAGE_PROVIDER = "Kie.ai";
  process.env.KIE_IMAGE_MODEL = "gpt-image-2-text-to-image";
  const atomicVisualDirection = {
    stylePackId: "editorial-metaphor", reason: "atomic materialized fixture direction",
    pages: [
      ["cover.promise", "pattern.hierarchy.promise-focus", null], ["comparison.before-after", "pattern.compare.mirrored-columns", null],
      ["list.key-points", "pattern.list.equal-cards", null], ["list.key-points", "pattern.list.equal-cards", null],
      ["process.vertical-steps", "pattern.process.numbered-spine", null], ["summary.cta", "pattern.cta.single-action", null]
    ].map(([archetypeId, patternId, stylePackId], index) => ({ pageId: `P${index + 1}`, archetypeId, patternIds: [patternId], referenceAssetIds: [], verbatimTextOverride: null, stylePackId }))
  };
  const atomicBeforeDesign = structuredClone(readStore());
  const atomicDesignResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu/design`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture",
      productSnapshotHash: atomicProduct.projectionHash, platformRunRef: atomicProduct.refs.platformRunRef,
      candidateRef: atomicProduct.refs.candidateRef, visualDirection: atomicVisualDirection, idempotencyKey: "atomic-xhs-design-fixture"
    })
  });
  const atomicDesign = await atomicDesignResponse.json();
  assert.equal(atomicDesignResponse.status, 201, JSON.stringify(atomicDesign));
  assert.equal(atomicDesign.authorityKind, "atomic_v2");
  assert.deepEqual(atomicDesign.artifactFact.contentProjectRef, atomicProduct.refs.contentProjectIdentityRef);
  assert.deepEqual(atomicDesign.artifactFact.materializedContentProjectRef, atomicProduct.refs.materializedContentProjectRef);
  assert.deepEqual(atomicDesign.artifactFact.candidateRef, atomicProduct.refs.candidateRef);
  assert.deepEqual(atomicDesign.artifactFact.pageRevisionRefs, [], "visual planning is not a PNG revision set");
  assert.equal(atomicDesign.artifactFact.selectionAuthority, false);
  assert.equal(atomicDesign.claims.providerCalls, 0);
  assert.equal(atomicDesign.claims.networkCalls, 0);
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = "1";
  process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = "1";
  process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = "1";
  process.env.XHS_VISUAL_ASSET_REGISTRY = "1";
  process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = "1";
  const atomicPlanResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu/provider-plan`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture",
      productSnapshotHash: atomicProduct.projectionHash, platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef,
      designFactRef: { id: atomicDesign.artifactFact.id, hash: atomicDesign.artifactFact.factHash },
      designEvidenceRef: { id: atomicDesign.evidence.id, hash: atomicDesign.evidence.evidenceHash },
      promptSetRef: { id: atomicDesign.evidence.outputs.skillInvocation.promptSet.id, hash: atomicDesign.evidence.outputs.skillInvocation.promptSetHash },
      selectedDirectionId: atomicDesign.providerPlanningOptions.directionCandidates[0].id,
      promptApproval: { reviewedPromptSetHash: atomicDesign.evidence.outputs.skillInvocation.promptSetHash, approvedBy: "human:atomic-plan-reviewer", approvedAt: "2026-08-06T13:00:00.000Z" },
      costConfirmation: { currency: "credits", approvedMaxTotal: 100, confirmedBy: "human:atomic-budget-owner", confirmedAt: "2026-08-06T13:01:00.000Z" },
      idempotencyKey: "atomic-xhs-provider-plan-fixture"
    })
  });
  const atomicPlan = await atomicPlanResponse.json();
  assert.equal(atomicPlanResponse.status, 201, JSON.stringify(atomicPlan));
  assert.deepEqual(atomicPlan.facts.plan.contentProjectRef, atomicProduct.refs.contentProjectIdentityRef);
  assert.deepEqual(atomicPlan.facts.plan.materializedContentProjectRef, atomicProduct.refs.materializedContentProjectRef);
  assert.deepEqual(atomicPlan.facts.plan.candidateRef, atomicProduct.refs.candidateRef);
  assert.equal(atomicPlan.claims.providerCalls, 0);
  assert.equal(atomicPlan.claims.networkCalls, 0);
  writeStore(atomicBeforeDesign);
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "0";
  process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = "0";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = "0";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = "0";
  process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = "0";
  process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = "0";
  process.env.XHS_VISUAL_ASSET_REGISTRY = "0";
  process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = "0";

  const collisionFreeStore = structuredClone(readStore());
  const readCollisionStore = structuredClone(collisionFreeStore);
  const collidingLegacyProjection = structuredClone(readCollisionStore.unifiedContentProjects[0]);
  collidingLegacyProjection.id = `legacy_collision:${atomicProduct.id}`;
  collidingLegacyProjection.contentProject.id = atomicProduct.id;
  readCollisionStore.unifiedContentProjects.push(collidingLegacyProjection);
  writeStore(readCollisionStore);
  const collidingGetResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`);
  assert.equal(collidingGetResponse.status, 409);
  assert.equal((await collidingGetResponse.json()).code, "UNIFIED_ATOMIC_PRODUCT_ID_COLLISION");
  const collidingListResponse = await fetch(`${baseUrl}/unified-content-projects`);
  assert.equal(collidingListResponse.status, 409);
  assert.equal((await collidingListResponse.json()).code, "UNIFIED_ATOMIC_PRODUCT_ID_COLLISION");
  writeStore(collisionFreeStore);

  const productionStagedStoreBefore = structuredClone(readStore());
  const productionPrerequisite = productionStagedStoreBefore.unifiedContentPrerequisiteRequests.find((item) => item.mechanismDecisionRef?.id === atomicDecision.id);
  const productionXhsAccount = productionStagedStoreBefore.accounts.find((item) => item.id === "xhs_account_fixture");
  const productionWechatAccount = productionStagedStoreBefore.accounts.find((item) => item.id === "wechat_account_fixture");
  const productionStagedInput = {
    requestId: "production-staged-request-fixture", idempotencyKey: "production-staged-key-fixture",
    companyId: "company_fixture", projectId: "production_staged_atomic_project_fixture",
    topicIntent: { topic: "production staged offline fixture", intent: "formal dual bootstrap" },
    activeStrategySnapshotRef: strategyRef,
    prerequisiteRef: { id: productionPrerequisite.idempotencyKey, hash: productionPrerequisite.semanticHash },
    accounts: {
      xiaohongshu: { id: productionXhsAccount.id, hash: hashUnifiedContent(productionXhsAccount) },
      wechat: { id: productionWechatAccount.id, hash: hashUnifiedContent(productionWechatAccount) }
    },
    authorizationSourceRefs: [
      { id: atomicDecision.id, hash: atomicDecision.decisionHash },
      { id: "production_staged_source_plan_authority", hash: hashUnifiedContent(productionStagedStoreBefore.unifiedContentSourcePlans.find((item) => item.id === "production_staged_source_plan_authority")) }
    ]
  };
  let productionStagedPersists = 0;
  setUnifiedContentServerDependenciesForTest({
    generateText: atomicFixtureGenerateText, resolveActiveStrategySnapshot: strategyAuthority,
    now: () => "2026-08-07T13:00:00.000Z", persistStore: async (value) => { productionStagedPersists += 1; return writeStore(value); }
  });
  process.env.UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1 = "1";
  const productionStagedCreateResponse = await fetch(`${baseUrl}/unified-content-projects/bootstrap`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(productionStagedInput)
  });
  const productionStagedCreate = await productionStagedCreateResponse.json();
  assert.equal(productionStagedCreateResponse.status, 201, JSON.stringify(productionStagedCreate));
  assert.equal(productionStagedCreate.bootstrap.state, "awaiting_outline_confirmation");
  assert.equal(readStore().unifiedAtomicContentCommits.filter((item) => item.contentProjectIdentity?.id === productionStagedInput.projectId).length, 0,
    "production planning stage must persist no Commit");
  const productionBootstrapRecord = readStore().unifiedStagedAtomicDualBootstraps.find((item) => item.id === productionStagedCreate.bootstrap.id);
  assert.ok(productionBootstrapRecord.planning.invocations.length >= 3);
  assert.ok(productionBootstrapRecord.planning.invocations.every((item) => item.id && (item.invocationHash || item.inputHash)));
  assert.ok(productionBootstrapRecord.planning.outputFacts.every((item) => item.contract === "UnifiedSkillOutputFact@1.0"));
  const productionConfirmation = {
    actor: { type: "user", id: "human:production-staged" }, confirmedAt: "2026-08-07T13:01:00.000Z",
    outlineRefs: productionStagedCreate.bootstrap.outlineRefs
  };
  const productionConfirmResponse = await fetch(`${baseUrl}/unified-content-projects/bootstrap/${productionStagedCreate.bootstrap.id}/confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(productionConfirmation)
  });
  assert.equal(productionConfirmResponse.status, 201, JSON.stringify(await productionConfirmResponse.json()));
  const confirmedProductionStagedStore = structuredClone(readStore());
  const rehashStagedField = (value, field) => { delete value[field]; value[field] = hashUnifiedContent(value); };
  const stagedTamperCases = [
    ["authority", (record) => { record._serverAuthority.contract = "TamperedAuthority@1.0"; }],
    ["shared master/server planning", (record) => {
      record.planning.outputs.sharedContentMaster.confirmed_facts[0].fact = "tampered";
      record.planning.serverPlanning.sharedContentMaster = structuredClone(record.planning.outputs.sharedContentMaster);
      rehashStagedField(record.planning.serverPlanning, "planningHash");
      const fact = record.planning.outputFacts.find((item) => item.platform === "shared");
      fact.runtimeOutput.data = structuredClone(record.planning.outputs.sharedContentMaster);
      fact.outputHash = hashUnifiedContent(fact.runtimeOutput); rehashStagedField(fact, "factHash");
      record.bootstrapFact.outputFactRefs = record.planning.outputFacts.map((item) => ({ id: item.id, hash: item.factHash }));
      rehashStagedField(record.bootstrapFact, "factHash");
    }],
    ["server planning", (record) => { record.planning.serverPlanning.createdAt = "2026-08-07T13:00:01.000Z"; rehashStagedField(record.planning.serverPlanning, "planningHash"); }],
    ["invocation", (record) => {
      const invocation = record.planning.invocations[0]; invocation.capability = "tampered-capability";
      const base = structuredClone(invocation); delete base.executionRecordHash; delete base.invocationHash; invocation.invocationHash = hashUnifiedContent(base);
      const fact = record.planning.outputFacts[0]; fact.invocationRef.hash = invocation.invocationHash; rehashStagedField(fact, "factHash");
      record.bootstrapFact.invocationRefs[0].hash = invocation.invocationHash; record.bootstrapFact.outputFactRefs[0].hash = fact.factHash;
      rehashStagedField(record.bootstrapFact, "factHash");
    }],
    ["output fact", (record) => {
      const fact = record.planning.outputFacts.find((item) => item.platform === "wechat" && item.capability === "generate-content-outline");
      fact.runtimeOutput.data.sections[0].role = "tampered"; fact.outputHash = hashUnifiedContent(fact.runtimeOutput); rehashStagedField(fact, "factHash");
      const index = record.planning.outputFacts.findIndex((item) => item.id === fact.id); record.bootstrapFact.outputFactRefs[index].hash = fact.factHash;
      rehashStagedField(record.bootstrapFact, "factHash");
    }],
    ["confirmation", (record) => { record.confirmation.outlineRefs.wechat.hash = "0".repeat(64); rehashStagedField(record.confirmation, "confirmationHash"); }]
  ];
  await new Promise((resolve) => server.close(() => resolve()));
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  for (const [label, mutate] of stagedTamperCases) {
    const tampered = structuredClone(confirmedProductionStagedStore);
    mutate(tampered.unifiedStagedAtomicDualBootstraps.find((item) => item.id === productionStagedCreate.bootstrap.id));
    writeStore(tampered);
    const callsBeforeTamperedResume = totalCapabilityCalls();
    const persistsBeforeTamperedResume = productionStagedPersists;
    const response = await fetch(`${baseUrl}/unified-content-projects/bootstrap/${productionStagedCreate.bootstrap.id}/resume`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: productionStagedInput.idempotencyKey })
    });
    assert.equal(response.status, 409, `${label}: ${JSON.stringify(await response.json())}`);
    assert.equal(totalCapabilityCalls(), callsBeforeTamperedResume, `${label}: tampered restart must make zero Provider calls`);
    assert.equal(productionStagedPersists, persistsBeforeTamperedResume, `${label}: tampered restart must make zero persist calls`);
    assert.equal((readStore().unifiedAtomicContentCommits || []).filter((item) => item.contentProjectIdentity?.id === productionStagedInput.projectId).length, 0,
      `${label}: tampered restart must create zero Commit`);
  }
  writeStore(confirmedProductionStagedStore);
  const persistsBeforeResume = productionStagedPersists;
  const productionResumeResponse = await fetch(`${baseUrl}/unified-content-projects/bootstrap/${productionStagedCreate.bootstrap.id}/resume`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: productionStagedInput.idempotencyKey })
  });
  const productionResume = await productionResumeResponse.json();
  assert.equal(productionResumeResponse.status, 201, JSON.stringify(productionResume));
  assert.equal(productionStagedPersists, persistsBeforeResume + 4,
    "production dual Commit resume must durably persist three WeChat stage checkpoints and the final Commit");
  assert.equal(productionResume.product.platforms.wechat.state, "materialized");
  assert.equal(readStore().unifiedAtomicContentCommits.filter((item) => item.contentProjectIdentity?.id === productionResume.product.id).length, 2);
  await new Promise((resolve) => server.close(() => resolve()));
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const productionReplayResponse = await fetch(`${baseUrl}/unified-content-projects/bootstrap/${productionStagedCreate.bootstrap.id}/resume`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: productionStagedInput.idempotencyKey })
  });
  const productionReplay = await productionReplayResponse.json();
  assert.equal(productionReplayResponse.status, 200, JSON.stringify(productionReplay));
  assert.equal(productionReplay.created, false, "restart resume must be stable and use persisted Server authority");
  assert.equal(productionStagedPersists, persistsBeforeResume + 4, "restart replay must not persist again");
  writeStore(productionStagedStoreBefore);
  process.env.UNIFIED_CONTENT_STAGED_ATOMIC_DUAL_BOOTSTRAP_V1 = "0";
  setUnifiedContentServerDependenciesForTest({ persistStore: countedAtomicPersistStore });

  const stagedPair = {
    xiaohongshuCommit: structuredClone(collisionFreeStore.unifiedAtomicContentCommits.find((item) => item.contract === "UnifiedAtomicContentCommit@2.0")),
    wechatCommit: structuredClone(collisionFreeStore.unifiedAtomicContentCommits.find((item) => item.contract === "UnifiedAtomicWechatContentCommit@1.0"))
  };
  assert.ok(stagedPair.xiaohongshuCommit && stagedPair.wechatCommit, "dual bootstrap regression needs the already verified offline Commit pair");
  const stagedStore = { contentTasks: [{ id: "legacy-task-unchanged" }], publications: [{ id: "legacy-publication-unchanged" }] };
  const stagedFlags = { unifiedContentStagedAtomicDualBootstrapV1: true };
  const stagedRefs = {
    activeStrategySnapshotRef: structuredClone(stagedPair.xiaohongshuCommit.contentProjectIdentity.activeStrategySnapshotRef),
    prerequisiteRef: { id: "prerequisite:staged", hash: hashUnifiedContent({ id: "prerequisite:staged" }) },
    accounts: {
      xiaohongshu: { id: stagedPair.xiaohongshuCommit.accountId, hash: hashUnifiedContent({ id: stagedPair.xiaohongshuCommit.accountId }) },
      wechat: { id: stagedPair.wechatCommit.accountId, hash: hashUnifiedContent({ id: stagedPair.wechatCommit.accountId }) }
    },
    authorizationSourceRefs: [{ id: "authorization:staged", hash: hashUnifiedContent({ id: "authorization:staged" }) }]
  };
  const stagedCreateInput = {
    requestId: "staged-request-fixture", idempotencyKey: "staged-idempotency-fixture",
    companyId: stagedPair.xiaohongshuCommit.companyId, projectId: stagedPair.xiaohongshuCommit.contentProjectIdentity.id,
    topicIntent: { topic: "offline staged fixture", intent: "prove atomic dual persistence" }, ...stagedRefs
  };
  const stagedAuthorityRefs = {
    activeStrategySnapshotRef: stagedCreateInput.activeStrategySnapshotRef, prerequisiteRef: stagedCreateInput.prerequisiteRef,
    accountRefs: stagedCreateInput.accounts, authorizationSourceRefs: stagedCreateInput.authorizationSourceRefs
  };
  const stagedPlanBootstrap = async (createInput, suffix = "staged") => {
    const sharedContentMaster = { id: stagedPair.xiaohongshuCommit.usageBinding.sharedContentMasterRef.id, contract: "ContentMaster@3.0", fixture: true };
    const platformRuns = ["xiaohongshu", "wechat"].map((platform) => {
      const outline = { id: `outline:${platform}:${suffix}`, outline_id: `outline:${platform}:${suffix}`, platform, sections: [{ id: "S1", role: "hook" }] };
      return { platform, outline, skillRecords: [{ stepId: "outline", outputHash: hashUnifiedContent(outline) }] };
    });
    const specs = [
      { capability: "build-content-master", platform: "shared", output: sharedContentMaster },
      { capability: "generate-content-outline", platform: "xiaohongshu", output: platformRuns[0].outline },
      { capability: "generate-content-outline", platform: "wechat", output: platformRuns[1].outline }
    ];
    const actualInvocations = specs.map(({ capability, platform }, index) => {
      const executionRecord = { invocationId: `staged-runtime:${suffix}:${index}`, capability, platform };
      const base = { id: `staged-invocation:${suffix}:${index}`, capability, platform, executionRecord };
      return { ...base, executionRecordHash: hashUnifiedContent(executionRecord), invocationHash: hashUnifiedContent(base) };
    });
    const outputFacts = specs.map(({ capability, platform, output }, index) => {
      const runtimeOutput = { status: "ready", data: output, warnings: [], blocked_reasons: [] };
      const base = { schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `staged-output:${suffix}:${index}`,
        invocationRef: { id: actualInvocations[index].id, hash: actualInvocations[index].invocationHash }, platform, capability,
        runtimeOutput, outputHash: hashUnifiedContent(runtimeOutput) };
      return { ...base, factHash: hashUnifiedContent(base) };
    });
    const planningBase = { schemaVersion: "1.0", contract: "UnifiedStagedContentPlanningResult@1.0", sharedContentMaster,
      sharedSkillRecords: [{ capability: "build-content-master", outputHash: hashUnifiedContent(sharedContentMaster) }], platformRuns };
    return {
      authority: { bindingRefs: { activeStrategySnapshotRef: createInput.activeStrategySnapshotRef, prerequisiteRef: createInput.prerequisiteRef, accountRefs: createInput.accounts, authorizationSourceRefs: createInput.authorizationSourceRefs }, resolver: "offline_server_fixture" },
      planning: { ...planningBase, planningHash: hashUnifiedContent(planningBase) }, actualInvocations, outputFacts
    };
  };
  const planningCalls = [];
  const stagedCreated = await createUnifiedStagedAtomicDualBootstrap(stagedStore, stagedCreateInput, {
    featureFlags: stagedFlags, now: () => "2026-08-07T12:30:00.000Z",
    planBootstrap: async (value) => { const result = await stagedPlanBootstrap(value); planningCalls.push(...result.actualInvocations); return result; }
  });
  assert.equal(stagedCreated.created, true);
  assert.equal(planningCalls.length, 3);
  assert.ok(planningCalls.every((item) => item.invocationHash && item.executionRecordHash));
  assert.equal(stagedStore.unifiedAtomicContentCommits, undefined, "planning stop point must create no Commit");
  assert.equal(hashUnifiedContent(stagedAuthorityRefs), hashUnifiedContent(stagedStore.unifiedStagedAtomicDualBootstraps[0].authorityRefs));
  const stagedConfirmation = {
    actor: { type: "user", id: "human:staged-fixture" }, confirmedAt: "2026-08-07T12:31:00.000Z",
    outlineRefs: structuredClone(stagedCreated.bootstrap.outlineRefs)
  };
  const stagedConfirmed = confirmUnifiedStagedAtomicDualBootstrap(stagedStore, stagedCreated.bootstrap.id, stagedConfirmation, { featureFlags: stagedFlags });
  assert.equal(stagedConfirmed.changed, true);
  const legacyBeforeResume = { contentTasks: structuredClone(stagedStore.contentTasks), publications: structuredClone(stagedStore.publications) };
  const stagedResumed = await resumeUnifiedStagedAtomicDualBootstrap(stagedStore, stagedCreated.bootstrap.id, { idempotencyKey: stagedCreateInput.idempotencyKey }, {
    featureFlags: stagedFlags, now: () => "2026-08-07T12:32:00.000Z", materializeBootstrapCommits: async (restored) => {
      assert.equal(restored.authority.resolver, "offline_server_fixture", "resume must restore persisted server authority");
      return structuredClone(stagedPair);
    }
  });
  assert.equal(stagedResumed.created, true);
  assert.equal(stagedStore.unifiedAtomicContentCommits.length, 2);
  assert.equal(stagedResumed.product.platforms.wechat.state, "materialized");
  assert.deepEqual({ contentTasks: stagedStore.contentTasks, publications: stagedStore.publications }, legacyBeforeResume, "dual bootstrap must not rewrite legacy collections");
  const stagedReplay = await resumeUnifiedStagedAtomicDualBootstrap(stagedStore, stagedCreated.bootstrap.id, { idempotencyKey: stagedCreateInput.idempotencyKey }, { featureFlags: stagedFlags });
  assert.equal(stagedReplay.created, false);
  assert.equal(stagedStore.unifiedAtomicContentCommits.length, 2, "stable resume replay must not append duplicate Commits");

  const failedStagedStore = { contentTasks: [{ id: "legacy-failure" }] };
  const failedCreateInput = { ...structuredClone(stagedCreateInput), requestId: "staged-failure-request", idempotencyKey: "staged-failure-key" };
  const failedCreated = await createUnifiedStagedAtomicDualBootstrap(failedStagedStore, failedCreateInput, {
    featureFlags: stagedFlags, now: () => "2026-08-07T12:33:00.000Z",
    planBootstrap: (value) => stagedPlanBootstrap(value, "failure")
  });
  confirmUnifiedStagedAtomicDualBootstrap(failedStagedStore, failedCreated.bootstrap.id, { ...stagedConfirmation, outlineRefs: failedCreated.bootstrap.outlineRefs }, { featureFlags: stagedFlags });
  const failedBefore = structuredClone(failedStagedStore);
  await assert.rejects(() => resumeUnifiedStagedAtomicDualBootstrap(failedStagedStore, failedCreated.bootstrap.id, { idempotencyKey: failedCreateInput.idempotencyKey }, {
    featureFlags: stagedFlags, materializeBootstrapCommits: async () => ({ ...structuredClone(stagedPair), wechatCommit: { ...structuredClone(stagedPair.wechatCommit), commitHash: "0".repeat(64) } })
  }));
  assert.deepEqual(failedStagedStore, failedBefore, "any Commit/aggregate failure must leave both actual Commit slots at zero new writes");

  const atomicReplayCommitsBefore = readStore().unifiedAtomicContentCommits.length;
  const atomicReplayResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicProductRequest) });
  const atomicReplay = await atomicReplayResponse.json();
  assert.equal(atomicReplayResponse.status, 409, JSON.stringify(atomicReplay));
  assert.equal(atomicReplay.code, "UNIFIED_ATOMIC_PRODUCT_ID_COLLISION");
  assert.equal(readStore().unifiedAtomicContentCommits.length, atomicReplayCommitsBefore, "repeat execution with a different verified authority graph must not append a second Commit");
  assert.equal(atomicProductRouteWrites, 2, "repeat conflict must not call writeStore");

  const collisionRequest = structuredClone(atomicProductRequest);
  collisionRequest.requestId = "request_atomic_product_collision_fixture";
  collisionRequest.orchestrationInput.project.id = projectId;
  const collisionStoreBefore = structuredClone(readStore());
  const collisionResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(collisionRequest) });
  assert.equal(collisionResponse.status, 409);
  assert.equal((await collisionResponse.json()).code, "UNIFIED_ATOMIC_PRODUCT_ID_COLLISION");
  assert.deepEqual(readStore(), collisionStoreBefore, "projection collision must fail before append/writeStore");
  assert.equal(atomicProductRouteWrites, 2, "projection collision must not call writeStore");

  capabilityCalls.clear();
  preAtomicCapabilityCalls.forEach((value, key) => capabilityCalls.set(key, value));
  titleRuntimeRequests.length = preAtomicRequestLengths.titles;
  wechatRuntimeRequests.length = preAtomicRequestLengths.wechat;
  xhsWriterRuntimeRequests.length = preAtomicRequestLengths.xhs;
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "0";
  process.env.UNIFIED_CONTENT_XHS_ATOMIC_GRAPH_V1 = "0";
  setUnifiedContentServerDependenciesForTest({ generateText: fixtureGenerateText, resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }), now: () => "2026-08-05T12:00:00.000Z", persistStore: writeStore, serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: false } });
  const legacyXhs = created.platforms.find((item) => item.platform === "xiaohongshu");
  const legacyAuthority = resolveUnifiedContentAuthority(readStore(), {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", projectId: created.contentProject.id,
    platform: "xiaohongshu", productSnapshotHash: created.productSnapshotHash, candidateRef: legacyXhs.candidateRefs[0]
  });
  assert.equal(legacyAuthority.authorityKind, "legacy_snapshot_v1");
  assert.equal(validateUnifiedContentAuthorityResolution(legacyAuthority), true);
  assertAuthorityMutationCases(legacyAuthority, [
    { name: "legacy missing root field", mutate: (value) => { delete value.schemaVersion; }, code: "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID" },
    { name: "legacy extra root field", mutate: (value) => { value.atomicCommit = {}; }, code: "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_FIELDS_INVALID" },
    { name: "legacy extra payload field", mutate: (value) => { value.payload.commit = {}; }, code: "UNIFIED_CONTENT_AUTHORITY_LEGACY_PAYLOAD_FIELDS_INVALID" },
    { name: "legacy tampered authority hash", mutate: (value) => { value.productAuthorityHash = "f".repeat(64); }, code: "UNIFIED_CONTENT_AUTHORITY_LEGACY_SNAPSHOT_HASH_INVALID" },
    { name: "legacy wrong ref kind", mutate: (value) => { value.platformRunRef = structuredClone(value.candidateRef); }, code: "UNIFIED_CONTENT_AUTHORITY_RESOLUTION_CLOSURE_INVALID" },
    { name: "legacy detached candidate ref", mutate: (value) => { value.candidateRef.hash = "a".repeat(64); }, code: "UNIFIED_CONTENT_AUTHORITY_LEGACY_CANDIDATE_CLOSURE_INVALID" }
  ]);
  const legacyListAfterAtomicResponse = await fetch(`${baseUrl}/unified-content-projects`);
  const legacyListAfterAtomic = await legacyListAfterAtomicResponse.json();
  assert.equal(legacyListAfterAtomicResponse.status, 200, JSON.stringify(legacyListAfterAtomic));
  assert.ok(legacyListAfterAtomic.items.every((item) => item.contract === "UnifiedContentProductSnapshot@1.0"), "product flag-off GET/list must remain legacy-compatible");
  assert.equal(JSON.stringify(created).includes("UnifiedContentCandidate@3.0"), false, "flag-off Product API must not create hidden Candidate@3");
  assert.equal(JSON.stringify(created).includes("ContentMechanismUsageBinding@1.0"), false, "flag-off Product API must not create hidden Usage Binding");
  assert.equal(created.callerReviewInputsPolicy, "ignored");
  assert.ok(created.skillOutputFacts.every((item) => item.contract === "UnifiedSkillOutputFact@1.0" && item.factHash && item.outputHash === hashUnifiedContent(item.runtimeOutput)));
  const xhsWriterFact = created.skillOutputFacts.find((item) => item.capability === "write-xhs-content");
  assert.equal(xhsWriterRuntimeRequests.length, 1);
  assert.equal(xhsWriterRuntimeRequests[0].expected_contract, "XhsPostPackage@2.0");
  assert.equal(xhsWriterRuntimeRequests[0].contract, "XhsPostPackage@2.0");
  assert.ok(typeof xhsWriterRuntimeRequests[0].skill_instructions === "string" && xhsWriterRuntimeRequests[0].skill_instructions.length > 0);
  assert.ok(typeof xhsWriterRuntimeRequests[0].skill_contract === "string" && xhsWriterRuntimeRequests[0].skill_contract.length > 0);
  assert.ok(Array.isArray(xhsWriterRuntimeRequests[0].skill_reference_bundle) && xhsWriterRuntimeRequests[0].skill_reference_bundle.length >= 2);
  assert.ok(xhsWriterRuntimeRequests[0].skill_reference_bundle.some((item) => item.path === "SKILL.md" && item.content === xhsWriterRuntimeRequests[0].skill_instructions));
  assert.ok(xhsWriterRuntimeRequests[0].skill_reference_bundle.some((item) => item.path === "references/contract.md" && item.content === xhsWriterRuntimeRequests[0].skill_contract));
  for (const requiredClause of [
    "XHS_ENVELOPE_ROOT_KEYS_EXACT: status,data,warnings,blocked_reasons",
    "XHS_DATA_ROOT_KEYS_EXACT: platform,topic_id,intent_profile_id,content_purpose_id,account_context,creative_mechanism,journey_stage,matrix_coordination,content_promise,engagement_strategy,post_copy,deck,image_specs,skipped_image_pages,traceability,preflight_checks",
    "XHS_REQUIRED_EVIDENCE_SKELETON",
    '"used_fact_ids"',
    '"page_claim_map"',
    '"promise_consistency"',
    '"matrix_differentiation"'
  ]) {
    assert.ok(xhsWriterRuntimeRequests[0].skill_instructions.includes(requiredClause), `Writer instructions must carry ${requiredClause}`);
    assert.ok(xhsWriterRuntimeRequests[0].skill_contract.includes(requiredClause), `Writer contract must carry ${requiredClause}`);
  }
  assert.deepEqual(xhsWriterRuntimeRequests[0].input.design_dna_ref, confirmedDesignDnaSnapshotRef);
  assert.deepEqual(xhsWriterRuntimeRequests[0].input.design_dna, confirmedDesignDnaSnapshot);
  assert.equal(xhsWriterRuntimeRequests[0].input.content_master.content_master_id, "shared_master_fixture");
  assert.equal(xhsWriterRuntimeRequests[0].input.confirmed_outline.outline_id, "outline_xiaohongshu");
  assert.deepEqual(xhsWriterRuntimeRequests[0].input.platform_brief.brief.designDnaRef, confirmedDesignDnaSnapshotRef);
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.contract, "UnifiedWriterContext@1.0");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.account_context.matrix_role, "discovery_and_validation");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.topic_id, "opportunity_1");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.intent_profile_id, "project_input_fixture");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.content_purpose_id, "knowledge_howto");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.creative_mechanism, "search_answer");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.journey_stage, "discover");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.matrix_coordination.differentiation_angle, "discovery_and_validation:场景触达与需求验证");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.matrix_coordination.shared_campaign_topic_id, "opportunity_1");
  assert.equal(xhsWriterRuntimeRequests[0].input.writer_context.writerContextHash, hashUnifiedContent(Object.fromEntries(Object.entries(xhsWriterRuntimeRequests[0].input.writer_context).filter(([key]) => key !== "writerContextHash"))));
  assert.deepEqual(Object.keys(xhsWriterRuntimeRequests[0].input.writer_context.authority_refs).sort(), ["accountRef", "accountStrategyRef", "activeStrategySnapshotRef", "confirmedOutlineRef", "contentOpportunityRef", "mechanismDecisionRef", "platformBriefRef", "sharedContentMasterRef"].sort());
  assert.ok(Object.values(xhsWriterRuntimeRequests[0].input.writer_context.authority_refs).every((ref) => ref.id && /^[a-f0-9]{64}$/.test(ref.hash)));
  const authoritativeWechatWriterRequest = wechatRuntimeRequests.find((item) => item.skill_runtime?.skill_name === "write-wechat-article");
  assert.equal(authoritativeWechatWriterRequest.input.writer_context.account_context.subject_type, "founder");
  assert.equal(authoritativeWechatWriterRequest.input.writer_context.account_context.account_mode, "founder_ip");
  assert.equal(authoritativeWechatWriterRequest.input.writer_context.account_context.trust_source, "experience");
  assert.equal(authoritativeWechatWriterRequest.input.writer_context.account_context.matrix_role, "authority_and_conversion");
  assert.equal(authoritativeWechatWriterRequest.input.writer_context.journey_stage, "convert");
  assert.equal(authoritativeWechatWriterRequest.input.writer_context.matrix_coordination.differentiation_angle, "authority_and_conversion:深度权威与业务承接");
  assert.deepEqual(xhsWriterFact.runtimeOutput, canonicalWriterEnvelope, "verified canonical writer output fact must be preserved without adapter rewriting");
  let missingMatrixAuthorityProviderCalls = 0;
  const completeAuthorityStore = structuredClone(readStore());
  const missingMatrixAuthorityStore = structuredClone(completeAuthorityStore);
  delete missingMatrixAuthorityStore.accountStrategySnapshots.find((item) => item.socialAccountId === "xhs_account_fixture" && item.status === "active").payload.matrixRole;
  writeStore(missingMatrixAuthorityStore);
  setUnifiedContentServerDependenciesForTest({ generateText: async () => { missingMatrixAuthorityProviderCalls += 1; }, resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }) });
  const missingMatrixAuthorityRequest = structuredClone(request);
  missingMatrixAuthorityRequest.requestId = "request_fixture_missing_matrix_authority";
  missingMatrixAuthorityRequest.orchestrationInput.project.id = "content_project_fixture_missing_matrix_authority";
  const missingMatrixAuthorityResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(missingMatrixAuthorityRequest) });
  assert.equal(missingMatrixAuthorityResponse.status, 409);
  assert.equal((await missingMatrixAuthorityResponse.json()).code, "UNIFIED_WRITER_CONTEXT_MATRIX_ROLE_REQUIRED");
  assert.equal(missingMatrixAuthorityProviderCalls, 0, "missing persisted matrix authority must stop before the shared master Provider call");
  writeStore(completeAuthorityStore);
  const missingDifferentiationStore = structuredClone(completeAuthorityStore);
  delete missingDifferentiationStore.accountStrategySnapshots.find((item) => item.socialAccountId === "xhs_account_fixture" && item.status === "active").payload.platformPlaybook;
  writeStore(missingDifferentiationStore);
  const missingDifferentiationRequest = structuredClone(request);
  missingDifferentiationRequest.requestId = "request_fixture_missing_differentiation_authority";
  missingDifferentiationRequest.orchestrationInput.project.id = "content_project_fixture_missing_differentiation_authority";
  const missingDifferentiationResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(missingDifferentiationRequest) });
  assert.equal(missingDifferentiationResponse.status, 409);
  assert.equal((await missingDifferentiationResponse.json()).code, "UNIFIED_WRITER_CONTEXT_DIFFERENTIATION_AUTHORITY_REQUIRED");
  assert.equal(missingMatrixAuthorityProviderCalls, 0, "missing persisted differentiation authority must stop before the shared master Provider call");
  writeStore(completeAuthorityStore);
  setUnifiedContentServerDependenciesForTest({ generateText: fixtureGenerateText, resolveActiveStrategySnapshot: () => ({ id: strategyRef.id }), now: () => "2026-08-05T12:00:00.000Z" });
  const providerCallsBeforeDnaPreconditions = [...capabilityCalls.values()].reduce((sum, value) => sum + value, 0);
  const projectsBeforeDnaPreconditions = readStore().unifiedContentProjects.length;
  const missingDnaRequest = structuredClone(request);
  missingDnaRequest.requestId = "request_fixture_missing_design_dna";
  missingDnaRequest.orchestrationInput.project.id = "content_project_fixture_missing_design_dna";
  delete missingDnaRequest.orchestrationInput.project.designDnaSnapshotRef;
  const missingDnaResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(missingDnaRequest) });
  assert.equal(missingDnaResponse.status, 409);
  assert.equal((await missingDnaResponse.json()).code, "UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED");
  const mismatchedDnaRequest = structuredClone(request);
  mismatchedDnaRequest.requestId = "request_fixture_mismatched_design_dna";
  mismatchedDnaRequest.orchestrationInput.project.id = "content_project_fixture_mismatched_design_dna";
  mismatchedDnaRequest.orchestrationInput.project.designDnaSnapshotRef.hash = "0".repeat(64);
  const mismatchedDnaResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mismatchedDnaRequest) });
  assert.equal(mismatchedDnaResponse.status, 409);
  assert.equal((await mismatchedDnaResponse.json()).code, "UNIFIED_XHS_DESIGN_DNA_REFERENCE_MISMATCH");
  const confirmedStore = structuredClone(readStore());
  const legacyPointerStore = structuredClone(confirmedStore);
  const legacyPointerAccount = legacyPointerStore.accounts.find((item) => item.id === "xhs_account_fixture");
  delete legacyPointerAccount.visualStyle.designDnaSnapshotId;
  legacyPointerAccount.designDnaSnapshotId = confirmedDesignDnaSnapshot.id;
  const legacyPointerRequest = structuredClone(request);
  legacyPointerRequest.requestId = "request_fixture_legacy_design_dna_pointer";
  legacyPointerRequest.orchestrationInput.project.id = "content_project_fixture_legacy_design_dna_pointer";
  writeStore(legacyPointerStore);
  try {
    const legacyPointerResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(legacyPointerRequest) });
    assert.equal(legacyPointerResponse.status, 409);
    assert.equal((await legacyPointerResponse.json()).code, "UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED");
  } finally {
    writeStore(confirmedStore);
  }
  const mutatedConfirmedStore = structuredClone(confirmedStore);
  const mutatedConfirmedSnapshot = mutatedConfirmedStore.designDnaSnapshots.find((item) => item.id === confirmedDesignDnaSnapshot.id);
  mutatedConfirmedSnapshot.colors.push("mutated_after_confirmation");
  const mutatedConfirmedRequest = structuredClone(request);
  mutatedConfirmedRequest.requestId = "request_fixture_mutated_confirmed_design_dna";
  mutatedConfirmedRequest.orchestrationInput.project.id = "content_project_fixture_mutated_confirmed_design_dna";
  mutatedConfirmedRequest.orchestrationInput.project.designDnaSnapshotRef.hash = hashUnifiedContent(mutatedConfirmedSnapshot);
  writeStore(mutatedConfirmedStore);
  try {
    const mutatedConfirmedResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mutatedConfirmedRequest) });
    assert.equal(mutatedConfirmedResponse.status, 409);
    assert.equal((await mutatedConfirmedResponse.json()).code, "UNIFIED_XHS_DESIGN_DNA_PREREQUISITE_MISMATCH");
  } finally {
    writeStore(confirmedStore);
  }
  const unconfirmedStore = structuredClone(confirmedStore);
  const unconfirmedSnapshot = unconfirmedStore.designDnaSnapshots.find((item) => item.id === confirmedDesignDnaSnapshot.id);
  unconfirmedSnapshot.status = "draft";
  const unconfirmedDnaRequest = structuredClone(request);
  unconfirmedDnaRequest.requestId = "request_fixture_unconfirmed_design_dna";
  unconfirmedDnaRequest.orchestrationInput.project.id = "content_project_fixture_unconfirmed_design_dna";
  unconfirmedDnaRequest.orchestrationInput.project.designDnaSnapshotRef.hash = hashUnifiedContent(unconfirmedSnapshot);
  writeStore(unconfirmedStore);
  try {
    const unconfirmedDnaResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(unconfirmedDnaRequest) });
    assert.equal(unconfirmedDnaResponse.status, 409);
    assert.equal((await unconfirmedDnaResponse.json()).code, "UNIFIED_XHS_DESIGN_DNA_NOT_CONFIRMED");
  } finally {
    writeStore(confirmedStore);
  }
  const missingSnapshotStore = structuredClone(confirmedStore);
  missingSnapshotStore.designDnaSnapshots = [];
  const missingSnapshotRequest = structuredClone(request);
  missingSnapshotRequest.requestId = "request_fixture_design_dna_snapshot_missing";
  missingSnapshotRequest.orchestrationInput.project.id = "content_project_fixture_design_dna_snapshot_missing";
  writeStore(missingSnapshotStore);
  try {
    const missingSnapshotResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(missingSnapshotRequest) });
    assert.equal(missingSnapshotResponse.status, 404);
    assert.equal((await missingSnapshotResponse.json()).code, "UNIFIED_XHS_DESIGN_DNA_SNAPSHOT_NOT_FOUND");
  } finally {
    writeStore(confirmedStore);
  }
  assert.equal([...capabilityCalls.values()].reduce((sum, value) => sum + value, 0), providerCallsBeforeDnaPreconditions, "Design DNA prerequisite failures must occur before every Provider invocation");
  assert.equal(readStore().unifiedContentProjects.length, projectsBeforeDnaPreconditions, "Design DNA prerequisite failures must not persist snapshots");
  assert.equal(created.orchestrationSnapshot.sharedContentMaster.id, "shared_master_fixture");
  assert.equal(created.orchestrationSnapshot.sharedContentMaster.sourceOutputContract, "ContentMaster@2.0");
  assert.equal(created.orchestrationSnapshot.sharedContentMaster.contentMaster.content_master_id, "shared_master_fixture");
  assert.equal(created.orchestrationSnapshot.sharedContentMaster.sourceOutputHash, created.skillOutputFacts.find((item) => item.capability === "build-content-master").outputHash);
  const outlineFacts = created.skillOutputFacts.filter((item) => item.capability === "generate-content-outline");
  assert.equal(outlineFacts.length, 2);
  assert.ok(outlineFacts.every((item) => item.runtimeOutput.status === "ready" && item.runtimeOutput.data.outline_id && !Object.hasOwn(item.runtimeOutput.data, "id")));
  assert.ok(created.orchestrationSnapshot.platformRuns.every((run) => run.platformRunRef.outlineRef.id === `outline_${run.platform}`), "canonical outline_id must be mapped only at the internal orchestration boundary");
  assert.ok(created.actualInvocations.every((item) => item.invocationHash && item.executionRecordHash && item.executionRecord.planAuthorization === "planned"));
  assert.ok(created.actualInvocations.every((item) => item.executionMode === "real" && item.executionRecord.productionEligibleOutput === true), "offline real-adapter fixtures must traverse production eligibility gates without external calls");
  assert.equal([...capabilityCalls.values()].reduce((sum, value) => sum + value, 0), 9, "fixture text generation must still pass through all strict Runtime invocations");
  assert.equal(titleRuntimeRequests.length, 2);
  const titleInputs = titleRuntimeRequests.map((runtimeRequest) => findNested(runtimeRequest, (value) => value?.stage === "final_after_body" && value?.content_master?.content_master_id === "shared_master_fixture"));
  assert.ok(titleInputs.every(Boolean), "both title Runtime calls must receive the complete canonical title input");
  assert.ok(titleInputs.every((input) => input.completed_content && input.preliminary_titles.length > 0 && input.content_task_brief?.purpose === "fixture"));
  assert.equal(titleInputs.find((input) => input.platform === "xiaohongshu").same_account_title_signals[0].signal_id, "SIG_XHS_1");
  assert.deepEqual(titleInputs.find((input) => input.platform === "wechat_official_account").same_account_title_signals, []);
  assert.equal(wechatRuntimeRequests.length, 3);
  const wechatWriterRequest = wechatRuntimeRequests.find((item) => item.skill_runtime.skill_name === "write-wechat-article");
  const wechatReviewRequest = wechatRuntimeRequests.find((item) => item.skill_runtime.skill_name === "review-wechat-article");
  const wechatPlanRequest = wechatRuntimeRequests.find((item) => item.skill_runtime.skill_name === "plan-wechat-images");
  assert.equal(wechatWriterRequest.input.content_master.content_master_id, "shared_master_fixture");
  assert.equal(wechatWriterRequest.input.platform_brief.platform, "wechat");
  assert.equal(wechatWriterRequest.input.confirmed_outline.outline_id, "outline_wechat");
  for (const { name, expectedPath, mutate } of [
    { name: "topic binding", expectedPath: "data.topic_id", mutate: (value) => { value.topic_id = "PRIVATE_WRONG_TOPIC"; } },
    { name: "intent binding", expectedPath: "data.intent_profile_id", mutate: (value) => { value.intent_profile_id = "PRIVATE_WRONG_INTENT"; } },
    { name: "purpose binding", expectedPath: "data.content_purpose_id", mutate: (value) => { value.content_purpose_id = "PRIVATE_WRONG_PURPOSE"; } },
    { name: "subject binding", expectedPath: "data.account_context.subject_type", mutate: (value) => { value.account_context.subject_type = "founder"; } },
    { name: "account mode binding", expectedPath: "data.account_context.account_mode", mutate: (value) => { value.account_context.account_mode = "expert"; } },
    { name: "matrix role binding", expectedPath: "data.account_context.matrix_role", mutate: (value) => { value.account_context.matrix_role = "PRIVATE_WRONG_ROLE"; } },
    { name: "trust binding", expectedPath: "data.account_context.trust_source", mutate: (value) => { value.account_context.trust_source = "expertise"; } },
    { name: "mechanism binding", expectedPath: "data.creative_mechanism", mutate: (value) => { value.creative_mechanism = "story"; } },
    { name: "journey binding", expectedPath: "data.journey_stage", mutate: (value) => { value.journey_stage = "trust"; } },
    { name: "campaign binding", expectedPath: "data.matrix_coordination.shared_campaign_topic_id", mutate: (value) => { value.matrix_coordination.shared_campaign_topic_id = "PRIVATE_WRONG_CAMPAIGN"; } },
    { name: "differentiation binding", expectedPath: "data.matrix_coordination.differentiation_angle", mutate: (value) => { value.matrix_coordination.differentiation_angle = "PRIVATE_WRONG_ANGLE"; } },
    { name: "overlap binding", expectedPath: "data.matrix_coordination.prohibited_overlap", mutate: (value) => { value.matrix_coordination.prohibited_overlap = ["PRIVATE_WRONG_OVERLAP"]; } },
    { name: "unknown root field", expectedPath: "data", mutate: (value) => { value.image_spec_alignment = {}; } },
    { name: "unknown page field", expectedPath: "data.deck.pages[]", mutate: (value) => { value.deck.pages[0].unknown_field = true; } }
  ]) {
    const invalid = xhsWriterOutput();
    mutate(invalid);
    assert.throws(
      () => validateUnifiedSkillDomainOutput({
        capability: "write-xhs-content", platform: "xiaohongshu", outputContract: "XhsPostPackage@2.0",
        runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] },
        sourceContentMaster: xhsWriterRuntimeRequests[0].input.content_master,
        sourceSkillInput: xhsWriterRuntimeRequests[0].input
      }),
      (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
        && error.details?.fieldPaths?.includes(expectedPath)
        && !JSON.stringify(error.details).includes("PRIVATE_"),
      `${name} must fail closed at a safe path without echoing Provider data`
    );
  }
  for (const { name, expectedPath, mutate } of [
    { name: "writer context binding", expectedPath: "data.topic_id", mutate: (value) => { value.topic_id = "PRIVATE_WRONG_TOPIC"; } },
    { name: "empty takeaways", expectedPath: "data.key_takeaways", mutate: (value) => { value.key_takeaways = []; } },
    { name: "empty claim sections", expectedPath: "data.claim_map[]", mutate: (value) => { value.claim_map[0].section_ids = []; } },
    { name: "invented source shape", expectedPath: "data.source_list", mutate: (value) => { value.source_list[0].invented = "PRIVATE_SOURCE"; } },
    { name: "duplicate preflight", expectedPath: "data.preflight_checks[].check", mutate: (value) => { value.preflight_checks.push(structuredClone(value.preflight_checks[0])); } },
    { name: "missing continuity preflight", expectedPath: "data.preflight_checks.argument_continuity", mutate: (value) => { value.preflight_checks = value.preflight_checks.filter((item) => item.check !== "argument_continuity"); } },
    { name: "failed traceability preflight", expectedPath: "data.preflight_checks.claim_traceability.result", mutate: (value) => { value.preflight_checks.find((item) => item.check === "claim_traceability").result = "fail"; } }
  ]) {
    const invalid = wechatWriterOutput();
    mutate(invalid);
    assert.throws(
      () => validateUnifiedSkillDomainOutput({
        capability: "write-wechat-article", platform: "wechat", outputContract: "WechatArticle@2.0",
        runtimeOutput: { status: "success", data: invalid, warnings: [], blocked_reasons: [] },
        sourceContentMaster: wechatWriterRequest.input.content_master,
        sourceSkillInput: wechatWriterRequest.input
      }),
      (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
        && error.details?.fieldPaths?.includes(expectedPath)
        && !JSON.stringify(error.details).includes("PRIVATE_"),
      `${name} must fail closed at a safe path without echoing Provider data`
    );
  }
  assert.equal(wechatReviewRequest.input.mode, "report_only");
  assert.deepEqual(wechatReviewRequest.input.article, wechatWriterOutput(), "review must receive the exact canonical writer article");
  assert.deepEqual(wechatReviewRequest.input.content_master, wechatWriterRequest.input.content_master);
  assert.deepEqual(wechatReviewRequest.input.platform_brief, wechatWriterRequest.input.platform_brief);
  assert.deepEqual(wechatPlanRequest.input.article, wechatReviewRequest.input.article);
  assert.deepEqual(wechatPlanRequest.input.article_review, domainOutput("review-wechat-article", "wechat"));
  assert.ok(created.platforms.every((item) => item.deliveryReady === undefined && item.deliveryPreview.deliveryReady === false && item.deliveryPreview.published === false));
  assert.ok(created.platforms.every((item) => item.candidates.every((candidate) => candidate.promoted === false && candidate.deliveryReady === false && candidate.published === false)));
  assert.ok(created.platforms.every((item) => item.platformRunRef.sharedContentMasterRef.hash === created.sharedContentMasterRef.hash));
  const xhs = created.platforms.find((item) => item.platform === "xiaohongshu");
  const wechat = created.platforms.find((item) => item.platform === "wechat");
  assert.equal(xhs.reviewInput.source, "verified_skill_output_facts");
  assert.equal(xhs.reviewInput.callerReviewInputsPolicy, "ignored");
  assert.deepEqual(xhs.reviewInput.input.candidateSet.pageRevisionRefs, [], "deck page specs are not rendered page revisions");
  assert.equal(xhs.candidates[0].artifactState, "visual_artifacts_required");
  assert.equal(xhs.candidates[0].status, "visual_artifacts_required");
  assert.equal(JSON.stringify(xhs).includes("forged_page"), false);
  assert.deepEqual(Object.keys(xhs.reviewInput.input.candidateSet.items[0]).sort(), ["id", "order", "purpose"]);
  assert.equal(wechat.candidates[0].deliverySemantics, "pre_upload_only");
  assert.equal(wechat.candidates[0].status, "pre_upload_resource_required", "an illustrated candidate is not locally deliverable until its exact image resources exist");
  assert.equal(wechat.candidates[0].postUploadArtifactRef, null);
  assert.equal(wechat.candidates[0].imagePlanAuthority.productionEligible, true);
  assert.equal(JSON.stringify(wechat).includes("forged"), false);
  assert.deepEqual(Object.keys(wechat.reviewInput.input.candidateSet.items[0]).sort(), ["id", "order", "purpose"]);
  for (const platform of [xhs, wechat]) {
    const candidate = platform.candidates[0];
    const titleFact = created.skillOutputFacts.find((item) => item.platform === platform.platform && item.capability === "generate-platform-titles");
    const writerFact = created.skillOutputFacts.find((item) => item.platform === platform.platform && ["write-xhs-content", "write-wechat-article"].includes(item.capability));
    assert.equal(candidate.finalTitleBinding.recommendation, "balanced");
    assert.equal(candidate.finalTitleBinding.titleId, "T1");
    assert.equal(candidate.finalTitleBinding.title, candidate.finalTitle);
    assert.deepEqual(candidate.finalTitleBinding.titleOutputFactRef, { id: titleFact.id, hash: titleFact.factHash });
    assert.deepEqual(candidate.finalTitleBinding.completedContentFactRef, { id: writerFact.id, hash: writerFact.factHash });
    assert.equal(candidate.finalTitle, `${platform.platform} final title 1`);
  }
  assert.equal(xhs.candidates[0].postCopy.recommended_title, xhs.candidates[0].finalTitle);
  assert.equal(wechat.candidates[0].article.recommended_title, wechat.candidates[0].finalTitle);
  const wechatWriterFact = created.skillOutputFacts.find((item) => item.platform === "wechat" && item.capability === "write-wechat-article");
  const wechatPlanFact = created.skillOutputFacts.find((item) => item.platform === "wechat" && item.capability === "plan-wechat-images");
  const masterFact = created.skillOutputFacts.find((item) => item.platform === "shared" && item.capability === "build-content-master");
  const preuploadBindings = (candidate) => ({
    contentProjectRef: { id: created.contentProject.id, hash: created.contentProject.projectHash },
    platformRunRef: { id: candidate.platformRunRef.id, hash: candidate.platformRunRef.hash },
    candidateRef: candidate.candidateRef,
    articleRef: candidate.imagePlanAuthority.articleOutputFactRef,
    imagePlanOutputFactRef: candidate.imagePlanAuthority.imagePlanOutputFactRef
  });
  const passingGates = Object.fromEntries(["format", "mobile", "ocr", "fact", "license", "visual"].map((gate) => [gate, async () => ({ status: "passed", evidenceRefs: [], details: { gate, fixture: "offline" } })]));
  const noImageRuntime = await runWechatPreuploadArtifactRuntime({
    candidate: wechat.candidates[0], imagePlanOutputFact: wechatPlanFact,
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data,
    bindings: preuploadBindings(wechat.candidates[0]), attempt: 1, idempotencyKeyPrefix: "strict-no-image", recordedAt: "2026-08-06T12:00:00.000Z"
  }, {
    artifactSink: createFilesystemWechatPreuploadArtifactSink(join(dataDir, "strict-no-image")),
    resourceResolvers: {}, formatHtml: async () => "<html><body>offline no image</body></html>", qualityGates: passingGates
  });
  assert.equal(noImageRuntime.planFact.contract, "WechatImagePlanArtifactFact@1.0");
  assert.equal(noImageRuntime.resourceAttempts.length, 2, "the illustrated fixture records unresolved cover and inline resource attempts");
  assert.equal(noImageRuntime.candidateProjection.platformUploadPerformed, false);
  assert.equal(noImageRuntime.candidateProjection.draftCreated, false);
  assert.equal(noImageRuntime.candidateProjection.publicationPerformed, false);
  await assert.rejects(
    () => runWechatPreuploadArtifactRuntime({ planOutput: wechatPlanFact.runtimeOutput, bindings: preuploadBindings(wechat.candidates[0]), attempt: 1, idempotencyKeyPrefix: "naked", recordedAt: "2026-08-06T12:00:00.000Z" }, {}),
    (error) => error.code === "WECHAT_PREUPLOAD_NAKED_PLAN_OUTPUT_FORBIDDEN"
  );
  for (const mutate of [
    (value) => { value.status = "partial"; },
    (value) => { value.blocked_reasons = ["blocked"]; },
    (value) => { value.data.slots = [{ slot_id: "WS01", after_section_id: "UNKNOWN", purpose: "prove", strategy: "no_image", claim_ids: [], asset_id: null, image_spec: null }]; }
  ]) {
    const invalid = structuredClone(wechatPlanFact.runtimeOutput);
    mutate(invalid);
    assert.throws(() => adaptAuthoritativeWechatImagePlanOutput(invalid, { article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data }), (error) => error.code?.startsWith("WECHAT_IMAGE_PLAN_"));
  }
  const authorizedAsset = { asset_id: "wechat-authorized-01", strategy: "authorized_asset", status: "approved", allowsPublication: true, source_id: "SRC001", source_sha256: "c".repeat(64) };
  const authorizedEnvelope = structuredClone(wechatPlanFact.runtimeOutput);
  authorizedEnvelope.data.slots = [{ slot_id: "WS-AUTH", after_section_id: "W1", purpose: "prove", strategy: "authorized_asset", claim_ids: ["F001"], asset_id: authorizedAsset.asset_id, image_spec: null }];
  assert.equal(adaptAuthoritativeWechatImagePlanOutput(authorizedEnvelope, {
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data, authorizedAssets: [authorizedAsset]
  }).slots[0].assetId, authorizedAsset.asset_id);
  assert.throws(() => adaptAuthoritativeWechatImagePlanOutput(authorizedEnvelope, {
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data, authorizedAssets: []
  }), (error) => error.code === "WECHAT_IMAGE_PLAN_ASSET_REF_INVALID");
  const generatedCoverEnvelope = structuredClone(wechatPlanFact.runtimeOutput);
  generatedCoverEnvelope.data.cover = {
    purpose: "mood", strategy: "generated_raster", asset_id: "wechat-cover-generated-01", claim_ids: [],
    image_spec: { asset_id: "wechat-cover-generated-01", use_case: "stylized-concept", asset_type: "wechat-cover", prompt: "offline cover without text", reference_asset_ids: [], design_dna_version: "dna_fixture_v1", size: "1536x1024", must_avoid: ["文字", "水印", "Logo"], text_policy: "no_text_in_image" }
  };
  assert.equal(adaptAuthoritativeWechatImagePlanOutput(generatedCoverEnvelope, {
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data
  }).cover.imageSpec.asset_type, "wechat-cover");
  generatedCoverEnvelope.data.cover.image_spec.text_policy = "allow_text";
  assert.throws(() => adaptAuthoritativeWechatImagePlanOutput(generatedCoverEnvelope, {
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data
  }), (error) => error.code === "WECHAT_IMAGE_PLAN_NO_TEXT_POLICY_REQUIRED");
  const generatedEnvelope = {
    status: "success",
    data: {
      plan_id: "wechat_image_plan_generated_1",
      cover: { purpose: "pace", strategy: "no_image", asset_id: null, claim_ids: [], image_spec: null },
      slots: [{
        slot_id: "WS01", after_section_id: "W1", purpose: "explain", strategy: "generated_raster", claim_ids: ["F001"], asset_id: "wechat-inline-generated-01",
        image_spec: {
          asset_id: "wechat-inline-generated-01", use_case: "stylized-concept", asset_type: "wechat-inline", prompt: "offline abstract illustration without text",
          reference_asset_ids: [], design_dna_version: "dna_fixture_v1", size: "1536x1024", must_avoid: ["文字", "水印", "Logo"], text_policy: "no_text_in_image"
        }
      }]
    },
    warnings: [], blocked_reasons: []
  };
  const resourceFacts = structuredClone(created.skillOutputFacts);
  const resourcePlanFact = resourceFacts.find((item) => item.platform === "wechat" && item.capability === "plan-wechat-images");
  resourcePlanFact.runtimeOutput = generatedEnvelope;
  resourcePlanFact.outputHash = hashUnifiedContent(generatedEnvelope);
  resourcePlanFact.verifiedDomainOutput = adaptAuthoritativeWechatImagePlanOutput(generatedEnvelope, { article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data });
  delete resourcePlanFact.factHash;
  resourcePlanFact.factHash = hashUnifiedContent(resourcePlanFact);
  const resourceDerived = deriveUnifiedPlatformCandidate({ contentProjectId: projectId, platform: "wechat", platformRunRef: wechat.platformRunRef, outputFacts: resourceFacts });
  const generatedBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const resourceRuntime = await runWechatPreuploadArtifactRuntime({
    candidate: resourceDerived.candidate, imagePlanOutputFact: resourcePlanFact,
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data,
    bindings: preuploadBindings(resourceDerived.candidate), attempt: 1, idempotencyKeyPrefix: "strict-generated", recordedAt: "2026-08-06T12:01:00.000Z"
  }, {
    artifactSink: createFilesystemWechatPreuploadArtifactSink(join(dataDir, "strict-generated")),
    resourceResolvers: { generated_raster: async () => ({ bytes: generatedBytes, extension: ".png", evidence: { providerAttemptRef: { id: "offline-generation-attempt-1", hash: "a".repeat(64) } } }) },
    formatHtml: async () => '<html><body><img src="assets/wechat-inline-generated-01.png"></body></html>', qualityGates: passingGates
  });
  assert.equal(resourceRuntime.resolverCalls.generated_raster, 1);
  assert.equal(resourceRuntime.resourceAttempts[0].status, "succeeded", JSON.stringify(resourceRuntime.resourceAttempts[0]));
  assert.ok(resourceRuntime.candidateProjection.formatFactRef);
  const failedResourceRuntime = await runWechatPreuploadArtifactRuntime({
    candidate: resourceDerived.candidate, imagePlanOutputFact: resourcePlanFact,
    article: wechatWriterFact.runtimeOutput.data, contentMaster: masterFact.runtimeOutput.data,
    bindings: preuploadBindings(resourceDerived.candidate), attempt: 1, idempotencyKeyPrefix: "strict-generated-failure", recordedAt: "2026-08-06T12:02:00.000Z"
  }, {
    artifactSink: createFilesystemWechatPreuploadArtifactSink(join(dataDir, "strict-generated-failure")),
    resourceResolvers: { generated_raster: async () => { throw Object.assign(new Error("offline fixture failure"), { code: "OFFLINE_RESOURCE_FAILED" }); } },
    formatHtml: async () => { throw new Error("formatter must not run"); }, qualityGates: passingGates
  });
  assert.equal(failedResourceRuntime.resourceAttempts[0].status, "blocked");
  assert.equal(failedResourceRuntime.formatFact, null);
  assert.equal(failedResourceRuntime.candidateProjection.formatFactRef, null);
  assert.deepEqual(xhsWriterFact.runtimeOutput, canonicalWriterEnvelope, "visible final title projection must not rewrite the immutable writer output fact");
  for (const [capability, mutate] of [
    ["write-wechat-article", (fact) => { fact.runtimeOutput.status = "needs_review"; }],
    ["review-wechat-article", (fact) => { fact.runtimeOutput.data.decision = "block"; }],
    ["plan-wechat-images", (fact) => { fact.runtimeOutput.status = "needs_review"; }],
    ["plan-wechat-images", (fact) => { fact.executionMode = "fallback"; fact.productionEligibleOutput = false; }]
  ]) {
    const facts = structuredClone(created.skillOutputFacts);
    const fact = facts.find((item) => item.platform === "wechat" && item.capability === capability);
    mutate(fact);
    fact.outputHash = hashUnifiedContent(fact.runtimeOutput);
    delete fact.factHash;
    fact.factHash = hashUnifiedContent(fact);
    assert.throws(
      () => deriveUnifiedPlatformCandidate({ contentProjectId: projectId, platform: "wechat", platformRunRef: wechat.platformRunRef, outputFacts: facts }),
      (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    );
  }
  for (const [capability, mutate] of [
    ["review-wechat-article", (fact) => { fact.runtimeOutput.data.findings.push({ finding_id: "TAMPERED", severity: "blocker" }); }],
    ["plan-wechat-images", (fact) => { fact.runtimeOutput.data.cover.strategy = "generated_raster"; }]
  ]) {
    const staleFacts = structuredClone(created.skillOutputFacts);
    const staleFact = staleFacts.find((item) => item.platform === "wechat" && item.capability === capability);
    const originalOutputHash = staleFact.outputHash;
    const originalFactHash = staleFact.factHash;
    mutate(staleFact);
    assert.equal(staleFact.outputHash, originalOutputHash);
    assert.equal(staleFact.factHash, originalFactHash);
    assert.throws(
      () => deriveUnifiedPlatformCandidate({ contentProjectId: projectId, platform: "wechat", platformRunRef: wechat.platformRunRef, outputFacts: staleFacts }),
      (error) => error.code === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID" && JSON.stringify(error.details?.fieldPaths) === JSON.stringify(["outputFacts"])
    );
  }

  const designUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/design`;
  const visualDirection = {
    stylePackId: "editorial-metaphor",
    reason: "explicit product API fixture direction",
    pages: [
      ["cover.promise", "pattern.hierarchy.promise-focus", null],
      ["comparison.before-after", "pattern.compare.mirrored-columns", null],
      ["list.key-points", "pattern.list.equal-cards", null],
      ["list.key-points", "pattern.list.equal-cards", null],
      ["process.vertical-steps", "pattern.process.numbered-spine", null],
      ["summary.cta", "pattern.cta.single-action", null]
    ].map(([archetypeId, patternId, stylePackId], index) => ({ pageId: `P${index + 1}`, archetypeId, patternIds: [patternId], referenceAssetIds: [], verbatimTextOverride: null, stylePackId }))
  };
  const designRequest = {
    workspaceId: "workspace_default",
    companyId: "company_fixture",
    accountId: "xhs_account_fixture",
    productSnapshotHash: created.productSnapshotHash,
    platformRunRef: xhs.platformRunRef,
    candidateRef: xhs.candidateRefs[0],
    visualDirection,
    idempotencyKey: "xhs_design_stage_fixture_1"
  };
  const designArtifactsDisabled = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(designRequest) });
  assert.equal(designArtifactsDisabled.status, 404);
  assert.equal((await designArtifactsDisabled.json()).code, "UNIFIED_CONTENT_ARTIFACTS_DISABLED");
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";
  const designDisabled = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(designRequest) });
  assert.equal(designDisabled.status, 404);
  assert.equal((await designDisabled.json()).code, "UNIFIED_XHS_DESIGN_FEATURE_DISABLED");
  process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = "1";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = "1";
  process.env.FLOW_IMAGE_PROVIDER = "Kie.ai";
  process.env.KIE_IMAGE_MODEL = "gpt-image-2-text-to-image";
  const designAuthorityStore = structuredClone(readStore());
  const missingDesignAuthorityStore = structuredClone(designAuthorityStore);
  const missingAuthorityProject = missingDesignAuthorityStore.unifiedContentProjects.find((item) => item.productSnapshotHash === created.productSnapshotHash);
  delete missingAuthorityProject.orchestrationSnapshot.platformRuns.find((run) => run.platform === "xiaohongshu").platformBrief.brief.designDna;
  writeStore(missingDesignAuthorityStore);
  try {
    const missingDesignAuthorityResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...designRequest, idempotencyKey: "xhs_design_missing_authority" }) });
    const missingDesignAuthorityFailure = await missingDesignAuthorityResponse.json();
    assert.equal(missingDesignAuthorityResponse.status, 409, JSON.stringify(missingDesignAuthorityFailure));
    assert.equal(missingDesignAuthorityFailure.code, "UNIFIED_XHS_DESIGN_DNA_AUTHORITY_MISSING");
  } finally {
    writeStore(designAuthorityStore);
  }
  const designCreatedResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(designRequest) });
  const designCreated = await designCreatedResponse.json();
  assert.equal(designCreatedResponse.status, 201, JSON.stringify(designCreated));
  assert.equal(designCreated.contract, "UnifiedXhsDesignStageResult@1.0");
  assert.equal(designCreated.evidence.contract, "XhsVisualDesignRuntimeEvidence@1.0");
  assert.equal(designCreated.evidence.status, "prompt_set_ready");
  assert.equal(designCreated.evidence.outputs.skillInvocation.promptSet.status, "draft");
  assert.deepEqual(designCreated.evidence.outputs.skillInvocation.promptSet.blockers, []);
  assert.equal(designCreated.evidence.productionEligible, false);
  assert.equal(designCreated.evidence.outputs.integratedPageExecutionPlan, null);
  assert.equal(designCreated.nextGate, "ProviderExecutionPlanningInputsRequired");
  assert.equal(designCreated.nextGate, designCreated.evidence.nextGate, "product nextGate must match immutable evidence");
  assert.equal(designCreated.artifactFact.evidence.nextGate, designCreated.nextGate, "persisted fact and API gate must agree");
  assert.deepEqual(designCreated.planningReadiness, {
    integratedPageExecutionPlanPresent: false,
    readyForHumanProviderExecutionApproval: false,
    missingAuthorityInputs: ["provider_review_decision_ref", "provider_capability_snapshot_ref", "provider_registry_snapshot_ref", "provider_cost_confirmation_ref"]
  });
  assert.equal(designCreated.providerPlanningOptions.mode, "isolated_experimental");
  assert.equal(designCreated.providerPlanningOptions.productionVerified, false);
  assert.equal(designCreated.providerPlanningOptions.providerApprovalEligible, false);
  assert.equal(designCreated.providerPlanningOptions.directionCandidates.length, 2);
  assert.deepEqual(designCreated.claims, { providerTextCalls: 0, providerImageCalls: 0, providerCalls: 0, platformCalls: 0, externalCalls: 0, networkCalls: 0, databaseWrites: 1, pageRevisionRefs: [], visualReviewPerformed: false, selectionAuthority: false, deliveryBundleCreated: false, publicationPerformed: false });
  assert.deepEqual(designCreated.artifactFact.pageRevisionRefs, []);
  assert.equal(designCreated.artifactFact.selectionAuthority, false);
  assert.equal(designCreated.artifactFact.publicationPerformed, false);
  assert.equal(designCreated.artifactState.status, "visual_artifacts_required");
  assert.equal(designCreated.artifactState.reviewable, false);
  assert.equal(designCreated.artifactState.selectable, false);
  assert.deepEqual(designCreated.artifactState.pageRevisionRefs, []);
  assert.ok(designCreated.artifactState.blockers.includes("artifact_review_required"));
  assert.equal([...capabilityCalls.values()].reduce((sum, value) => sum + value, 0), 9, "design stage must not call the text model or a Provider");
  const designReplayResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(designRequest) });
  const designReplay = await designReplayResponse.json();
  assert.equal(designReplayResponse.status, 200, JSON.stringify(designReplay));
  assert.equal(designReplay.created, false);
  assert.equal(designReplay.artifactFact.factHash, designCreated.artifactFact.factHash);
  const designConflictResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...designRequest, idempotencyKey: "xhs_design_stage_fixture_conflict", visualDirection: { ...visualDirection, reason: "conflicting direction" } }) });
  assert.equal(designConflictResponse.status, 409);
  assert.equal((await designConflictResponse.json()).code, "UNIFIED_XHS_DESIGN_VISUAL_DIRECTION_CONFLICT");
  const designStaleRefResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...designRequest, candidateRef: { ...designRequest.candidateRef, hash: "f".repeat(64) } }) });
  assert.equal(designStaleRefResponse.status, 409);
  assert.equal((await designStaleRefResponse.json()).code, "UNIFIED_XHS_DESIGN_CANDIDATE_REF_MISMATCH");
  const designCrossRunResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...designRequest, platformRunRef: { ...designRequest.platformRunRef, id: "platform_run:another_project:xiaohongshu" } }) });
  assert.equal(designCrossRunResponse.status, 409);
  assert.equal((await designCrossRunResponse.json()).code, "UNIFIED_XHS_DESIGN_RUN_REF_MISMATCH");
  const designInjectedEvidenceResponse = await fetch(designUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...designRequest, evidence: designCreated.evidence, idempotencyKey: "xhs_design_stage_fixture_injected" }) });
  assert.equal(designInjectedEvidenceResponse.status, 400);
  assert.equal((await designInjectedEvidenceResponse.json()).code, "UNIFIED_XHS_DESIGN_CALLER_AUTHORITY_FORBIDDEN");
  assert.equal((readStore().unifiedContentXhsDesignFacts || []).length, 1, "replay and conflicts must not append or rewrite design evidence");

  const providerPlanUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/provider-plan`;
  const providerPlanRequest = {
    workspaceId: "workspace_default",
    companyId: "company_fixture",
    accountId: "xhs_account_fixture",
    productSnapshotHash: created.productSnapshotHash,
    platformRunRef: { id: xhs.platformRunRef.id, hash: xhs.platformRunRef.hash },
    candidateRef: { id: xhs.candidateRefs[0].id, hash: xhs.candidateRefs[0].hash },
    designFactRef: { id: designCreated.artifactFact.id, hash: designCreated.artifactFact.factHash },
    designEvidenceRef: { id: designCreated.evidence.id, hash: designCreated.evidence.evidenceHash },
    promptSetRef: { id: designCreated.evidence.outputs.skillInvocation.promptSet.id, hash: designCreated.evidence.outputs.skillInvocation.promptSetHash },
    selectedDirectionId: designCreated.providerPlanningOptions.directionCandidates[0].id,
    promptApproval: { reviewedPromptSetHash: designCreated.evidence.outputs.skillInvocation.promptSetHash, approvedBy: "human:provider-plan-reviewer", approvedAt: "2026-08-06T13:00:00.000Z" },
    costConfirmation: { currency: "credits", approvedMaxTotal: 100, confirmedBy: "human:provider-plan-budget-owner", confirmedAt: "2026-08-06T13:01:00.000Z" },
    idempotencyKey: "xhs-provider-plan-fixture-1"
  };
  const providerPlanDisabled = await fetch(providerPlanUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(providerPlanRequest) });
  assert.equal(providerPlanDisabled.status, 404);
  assert.equal((await providerPlanDisabled.json()).code, "UNIFIED_XHS_PROVIDER_PLAN_DISABLED");
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = "1";
  const providerPlanDependencyDisabled = await fetch(providerPlanUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(providerPlanRequest) });
  const providerPlanDependencyDisabledBody = await providerPlanDependencyDisabled.json();
  assert.equal(providerPlanDependencyDisabled.status, 404);
  assert.equal(providerPlanDependencyDisabledBody.code, "UNIFIED_XHS_PROVIDER_PLAN_DISABLED");
  assert.ok(providerPlanDependencyDisabledBody.details.disabledFlags.includes("xhsIntegratedPageDirectionReview"));
  process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = "1";
  process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = "1";
  process.env.XHS_VISUAL_ASSET_REGISTRY = "1";
  process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = "1";
  process.env.FLOW_IMAGE_PROVIDER = "Kie.ai";
  process.env.KIE_IMAGE_MODEL = "gpt-image-2-text-to-image";
  const downstreamCounts = () => {
    const current = readStore();
    return {
      attempts: (current.unifiedContentXhsProviderAttemptFacts || []).length,
      revisions: (current.unifiedContentXhsPageRevisionFacts || []).length,
      reviews: (current.unifiedContentArtifactReviewActions || []).length,
      selections: (current.unifiedContentSelections || []).length,
      publications: (current.contentPublications || []).length
    };
  };
  const downstreamBeforeProviderPlan = downstreamCounts();
  const providerPlanCreatedResponse = await fetch(providerPlanUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(providerPlanRequest) });
  const providerPlanCreated = await providerPlanCreatedResponse.json();
  assert.equal(providerPlanCreatedResponse.status, 201, JSON.stringify(providerPlanCreated));
  assert.equal(providerPlanCreated.contract, "UnifiedXhsProviderPlanResult@1.0");
  assert.equal(providerPlanCreated.plan.execution.status, "ready_for_isolated_provider_execution");
  assert.equal(providerPlanCreated.plan.productionEligible, false);
  assert.equal(providerPlanCreated.nextGate, "HumanProviderExecutionApproval");
  assert.equal(providerPlanCreated.providerApprovalEligible, true);
  assert.deepEqual(providerPlanCreated.blockers, []);
  assert.equal(providerPlanCreated.plan.provider.id, "kie.ai");
  assert.equal(providerPlanCreated.plan.provider.model, "gpt-image-2-text-to-image");
  assert.deepEqual(providerPlanCreated.plan.provider.adapter, { id: "kie-jobs-image2", version: "1.0", projectionKey: "image2.text-to-image.v1" });
  assert.deepEqual(providerPlanCreated.claims, { providerCalls: 0, networkCalls: 0, platformCalls: 0, externalCalls: 0, databaseWrites: 1, providerAttemptFacts: 0, pageRevisionFacts: 0, visualReviewPerformed: false, selectionAuthority: false, publicationPerformed: false });
  assert.deepEqual(downstreamCounts(), downstreamBeforeProviderPlan);
  const providerPlanStored = readStore();
  for (const collection of ["unifiedContentXhsProviderReviewFacts", "unifiedContentXhsProviderCapabilityAuthorityFacts", "unifiedContentXhsProviderRegistryAuthorityFacts", "unifiedContentXhsProviderCostConfirmationFacts", "unifiedContentXhsProviderPlanFacts", "unifiedContentXhsProviderPlanIdempotencyFacts"]) {
    assert.equal((providerPlanStored[collection] || []).length, 1, `${collection} must append exactly once`);
  }
  assert.equal((providerPlanStored.unifiedContentXhsDesignFacts || []).length, 1, "provider planning must not rewrite design evidence");
  const providerPlanReplayResponse = await fetch(providerPlanUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(providerPlanRequest) });
  const providerPlanReplay = await providerPlanReplayResponse.json();
  assert.equal(providerPlanReplayResponse.status, 200, JSON.stringify(providerPlanReplay));
  assert.equal(providerPlanReplay.created, false);
  assert.equal(providerPlanReplay.facts.plan.factHash, providerPlanCreated.facts.plan.factHash);
  assert.equal(providerPlanReplay.claims.databaseWrites, 0);
  const providerPlanFactCounts = () => {
    const current = readStore();
    return Object.fromEntries(["unifiedContentXhsProviderReviewFacts", "unifiedContentXhsProviderCapabilityAuthorityFacts", "unifiedContentXhsProviderRegistryAuthorityFacts", "unifiedContentXhsProviderCostConfirmationFacts", "unifiedContentXhsProviderPlanFacts", "unifiedContentXhsProviderPlanIdempotencyFacts"].map((collection) => [collection, (current[collection] || []).length]));
  };
  const providerPlanCountsBeforeRejections = providerPlanFactCounts();
  async function rejectedProviderPlan(mutation, expectedCode, expectedStatus = 409) {
    const body = structuredClone(providerPlanRequest);
    mutation(body);
    const response = await fetch(providerPlanUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    assert.equal(response.status, expectedStatus, JSON.stringify(data));
    assert.equal(data.code, expectedCode, JSON.stringify(data));
    assert.deepEqual(providerPlanFactCounts(), providerPlanCountsBeforeRejections, `${expectedCode} must not append partial facts`);
    return data;
  }
  await rejectedProviderPlan((body) => { body.costConfirmation.approvedMaxTotal = 101; }, "UNIFIED_XHS_PROVIDER_PLAN_IDEMPOTENCY_CONFLICT");
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-stale-candidate"; body.candidateRef.hash = "f".repeat(64); }, "UNIFIED_XHS_PROVIDER_PLAN_CANDIDATE_REF_MISMATCH");
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-cross-run"; body.platformRunRef.id = "platform-run:cross-scope"; }, "UNIFIED_XHS_PROVIDER_PLAN_RUN_REF_MISMATCH");
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-stale-design"; body.designFactRef.hash = "f".repeat(64); }, "UNIFIED_XHS_PROVIDER_PLAN_DESIGN_FACT_STALE");
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-tampered-prompt"; body.promptApproval.reviewedPromptSetHash = "f".repeat(64); }, "UNIFIED_XHS_PROVIDER_PLAN_PROMPT_HASH_MISMATCH");
  const overBudget = await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-over-budget"; body.costConfirmation.approvedMaxTotal = 1; }, "UNIFIED_XHS_PROVIDER_PLAN_BLOCKED");
  assert.ok(overBudget.details.blockers.some((item) => item.code === "COST_BUDGET_EXCEEDED"));
  const currencyMismatch = await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-currency-mismatch"; body.costConfirmation.currency = "CNY"; }, "UNIFIED_XHS_PROVIDER_PLAN_BLOCKED");
  assert.ok(currencyMismatch.details.blockers.some((item) => item.code === "COST_CURRENCY_MISMATCH"));
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-authority-injection"; body.capabilitySnapshot = providerPlanCreated.facts.capability.capabilitySnapshot; }, "UNIFIED_XHS_PROVIDER_PLAN_CALLER_AUTHORITY_FORBIDDEN", 400);
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-model-injection"; body.model = "caller-forged-model"; }, "UNIFIED_XHS_PROVIDER_PLAN_CALLER_AUTHORITY_FORBIDDEN", 400);
  process.env.KIE_IMAGE_MODEL = "unsupported/provider-model-fixture";
  await rejectedProviderPlan((body) => { body.idempotencyKey = "provider-plan-model-mismatch"; }, "UNIFIED_XHS_PROVIDER_PLAN_PROVIDER_MODEL_UNSUPPORTED");
  process.env.KIE_IMAGE_MODEL = "gpt-image-2-text-to-image";
  const untamperedProviderPlanStore = readStore();
  const tamperedProviderPlanStore = structuredClone(untamperedProviderPlanStore);
  tamperedProviderPlanStore.unifiedContentXhsProviderReviewFacts[0].reviewDecision.id = "tampered-review-decision";
  writeStore(tamperedProviderPlanStore);
  const storedTamperReplay = await fetch(providerPlanUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(providerPlanRequest) });
  assert.equal(storedTamperReplay.status, 409);
  assert.equal((await storedTamperReplay.json()).code, "UNIFIED_XHS_PROVIDER_PLAN_FACT_HASH_MISMATCH");
  writeStore(untamperedProviderPlanStore);
  assert.deepEqual(providerPlanFactCounts(), providerPlanCountsBeforeRejections);
  assert.deepEqual(downstreamCounts(), downstreamBeforeProviderPlan);

  const queriedResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}`);
  const queried = await queriedResponse.json();
  assert.equal(queriedResponse.status, 200);
  assert.equal(queried.productSnapshotHash, created.productSnapshotHash);
  assert.deepEqual(queried.platforms.map((item) => item.candidateRefs), created.platforms.map((item) => item.candidateRefs));
  const queriedXhs = queried.platforms.find((item) => item.platform === "xiaohongshu");
  assert.equal(queriedXhs.artifactState.status, "provider_execution_approval_required");
  assert.equal(queriedXhs.artifactState.providerApprovalEligible, true);
  assert.deepEqual(queriedXhs.artifactState.providerPlanFactRefs, [{ id: providerPlanCreated.facts.plan.id, hash: providerPlanCreated.facts.plan.factHash }]);
  assert.equal(queriedXhs.artifactState.reviewable, false);
  assert.equal(queriedXhs.artifactState.selectable, false);

  assert.equal(designCreated.evidence.outputs.integratedPageExecutionPlan, null, "separate provider PlanFact must not rewrite design evidence");
  const approvalUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/provider-execution-approval`;
  const executionUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/provider-executions`;
  const targetPage = providerPlanCreated.plan.pages[0];
  const executionApprovalRequest = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", productSnapshotHash: created.productSnapshotHash,
    platformRunRef: { id: xhs.platformRunRef.id, hash: xhs.platformRunRef.hash }, candidateRef: { id: xhs.candidateRefs[0].id, hash: xhs.candidateRefs[0].hash },
    designFactRef: { id: designCreated.artifactFact.id, hash: designCreated.artifactFact.factHash }, designEvidenceRef: { id: designCreated.evidence.id, hash: designCreated.evidence.evidenceHash },
    providerPlanFactRef: { id: providerPlanCreated.facts.plan.id, hash: providerPlanCreated.facts.plan.factHash }, planRef: { id: providerPlanCreated.plan.id, hash: providerPlanCreated.plan.planHash },
    targetPageIds: [targetPage.pageId], maxProviderCalls: 1, maxCredits: 100, approvedBy: "human:provider-execution-reviewer", approvedAt: "2026-08-06T14:00:00.000Z", idempotencyKey: "xhs-provider-execution-approval-1"
  };
  const providerBytes = solidRgbaPng(targetPage.deliveryQualification.target.width, targetPage.deliveryQualification.target.height, [40, 80, 120, 255]);
  const executionFlags = { unifiedContentXhsProviderExecutionApprovalV1: true, unifiedContentXhsProviderExecutionV1: true };
  const directApprovalInput = { ...executionApprovalRequest, projectId };
  const directExecutionInput = (approvalFact, idempotencyKey) => ({
    workspaceId: executionApprovalRequest.workspaceId, companyId: executionApprovalRequest.companyId, accountId: executionApprovalRequest.accountId, projectId,
    productSnapshotHash: executionApprovalRequest.productSnapshotHash, platformRunRef: executionApprovalRequest.platformRunRef, candidateRef: executionApprovalRequest.candidateRef,
    providerPlanFactRef: executionApprovalRequest.providerPlanFactRef, approvalFactRef: { id: approvalFact.id, hash: approvalFact.factHash }, targetPageIds: [targetPage.pageId], idempotencyKey
  });

  const stagingFailureStore = structuredClone(readStore());
  const stagingApproval = appendUnifiedContentXhsProviderExecutionApproval(stagingFailureStore, { ...directApprovalInput, idempotencyKey: "direct-staging-approval" }, { featureFlags: executionFlags }).approvalFact;
  let stagingFailureCalls = 0;
  const stagingBlocked = await executeUnifiedContentXhsProviderExecution(stagingFailureStore, directExecutionInput(stagingApproval, "direct-staging-execution"), {
    featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false },
    transport: async () => { stagingFailureCalls += 1; return { status: "succeeded", provider: providerPlanCreated.plan.provider.id, model: providerPlanCreated.plan.provider.model, taskId: "staging-orphan-task", cost: 1, bytes: providerBytes }; },
    byteSink: async () => { throw Object.assign(new Error("fixture staging failure"), { code: "FIXTURE_STAGING_FAILED" }); }
  });
  assert.equal(stagingFailureCalls, 1);
  assert.equal(stagingBlocked.staging.status, "failed");
  assert.equal(stagingBlocked.staging.orphanStatus, "possible_staged_orphan");
  assert.equal(stagingBlocked.staging.crossResourceTransaction, false);
  assert.equal(stagingFailureStore.unifiedContentXhsProviderExecutionCheckpointFacts.length, 1);
  assert.equal(stagingFailureStore.unifiedContentXhsProviderAttemptFacts?.length || 0, 0, "unstaged artifact metadata must not merge into Artifact Store");
  const stagingNewApproval = appendUnifiedContentXhsProviderExecutionApproval(stagingFailureStore, { ...directApprovalInput, approvedAt: "2026-08-06T14:01:00.000Z", idempotencyKey: "direct-staging-new-approval" }, { featureFlags: executionFlags }).approvalFact;
  let stagingBlockedRetryCalls = 0;
  await assert.rejects(() => executeUnifiedContentXhsProviderExecution(stagingFailureStore, directExecutionInput(stagingNewApproval, "direct-staging-retry"), { featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false }, transport: async () => { stagingBlockedRetryCalls += 1; }, byteSink: async () => ({}) }), (error) => error.code === "UNIFIED_XHS_PROVIDER_EXECUTION_UNRECONCILED_PAID_CHECKPOINT");
  assert.equal(stagingBlockedRetryCalls, 0);

  const unknownCostStore = structuredClone(readStore());
  const unknownApproval = appendUnifiedContentXhsProviderExecutionApproval(unknownCostStore, { ...directApprovalInput, idempotencyKey: "direct-unknown-cost-approval" }, { featureFlags: executionFlags }).approvalFact;
  let unknownPaidCalls = 0;
  const unknownBlocked = await executeUnifiedContentXhsProviderExecution(unknownCostStore, directExecutionInput(unknownApproval, "direct-unknown-cost-execution"), {
    featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false }, byteSink: async () => ({}),
    transport: async () => { unknownPaidCalls += 1; return { status: "failed", paidTaskCreated: true, costStatus: "unknown", taskId: "unknown-cost-task", checkpoint: { taskId: "unknown-cost-task" } }; }
  });
  assert.equal(unknownPaidCalls, 1);
  assert.equal(unknownBlocked.runtime.attempts.at(-1).error.code, "UNKNOWN_PAID_TASK_COST");
  assert.equal(unknownBlocked.checkpointFactRef.id.startsWith("xhs-provider-execution-checkpoint:"), true);
  const unknownNewApproval = appendUnifiedContentXhsProviderExecutionApproval(unknownCostStore, { ...directApprovalInput, approvedAt: "2026-08-06T14:02:00.000Z", idempotencyKey: "direct-unknown-new-approval" }, { featureFlags: executionFlags }).approvalFact;
  let unknownRetryCalls = 0;
  await assert.rejects(() => executeUnifiedContentXhsProviderExecution(unknownCostStore, directExecutionInput(unknownNewApproval, "direct-unknown-retry"), { featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false }, transport: async () => { unknownRetryCalls += 1; }, byteSink: async () => ({}) }), (error) => error.code === "UNIFIED_XHS_PROVIDER_EXECUTION_UNRECONCILED_PAID_CHECKPOINT");
  assert.equal(unknownRetryCalls, 0);

  const failedPageStore = structuredClone(readStore());
  const failedPageApproval = appendUnifiedContentXhsProviderExecutionApproval(failedPageStore, { ...directApprovalInput, idempotencyKey: "direct-failed-page-approval" }, { featureFlags: executionFlags }).approvalFact;
  const failedPageResult = await executeUnifiedContentXhsProviderExecution(failedPageStore, directExecutionInput(failedPageApproval, "direct-failed-page-execution"), { featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false }, byteSink: async () => ({}), transport: async () => ({ status: "failed", taskId: "failed-page-task", cost: 0, error: { code: "FIXTURE_PAGE_FAILED", message: "fixture" } }) });
  assert.equal(failedPageResult.runtime.newRevisionRefs.length, 0);
  let sameApprovalRetryCalls = 0;
  await assert.rejects(() => executeUnifiedContentXhsProviderExecution(failedPageStore, directExecutionInput(failedPageApproval, "direct-same-approval-retry"), { featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false }, byteSink: async () => ({}), transport: async () => { sameApprovalRetryCalls += 1; } }), (error) => error.code === "UNIFIED_XHS_PROVIDER_EXECUTION_PAGE_ALREADY_ATTEMPTED");
  assert.equal(sameApprovalRetryCalls, 0);
  const retryApproval = appendUnifiedContentXhsProviderExecutionApproval(failedPageStore, { ...directApprovalInput, approvedAt: "2026-08-06T14:03:00.000Z", idempotencyKey: "direct-failed-page-new-approval" }, { featureFlags: executionFlags }).approvalFact;
  let newApprovalRetryCalls = 0;
  const retriedPage = await executeUnifiedContentXhsProviderExecution(failedPageStore, directExecutionInput(retryApproval, "direct-new-approval-retry"), { featureFlags: executionFlags, transportContext: { mode: "fixture", networked: false }, transport: async () => { newApprovalRetryCalls += 1; return { status: "succeeded", provider: providerPlanCreated.plan.provider.id, model: providerPlanCreated.plan.provider.model, taskId: "retried-page-task", cost: 1, bytes: providerBytes }; }, byteSink: async (payloads) => ({ status: "staged_and_hash_verified", receipts: payloads.map((payload) => ({ attemptRef: payload.attemptRef, rawSha256: payload.rawSha256, normalizedSha256: payload.normalizedSha256 })) }) });
  assert.equal(newApprovalRetryCalls, 1);
  assert.equal(retriedPage.runtime.newRevisionRefs.length, 1);
  const approvalDisabled = await fetch(approvalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionApprovalRequest) });
  assert.equal(approvalDisabled.status, 404);
  assert.equal((await approvalDisabled.json()).code, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_DISABLED");
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_APPROVAL_V1 = "1";
  const approvalResponse = await fetch(approvalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionApprovalRequest) });
  const executionApproval = await approvalResponse.json();
  assert.equal(approvalResponse.status, 201, JSON.stringify(executionApproval));
  assert.equal(executionApproval.approvalFact.limits.maxAttemptsPerPage, 1);
  assert.equal(executionApproval.approvalFact.limits.automaticRetries, 0);
  const approvalReplay = await fetch(approvalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionApprovalRequest) });
  assert.equal(approvalReplay.status, 200);
  const approvalInjected = await fetch(approvalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...executionApprovalRequest, model: "caller-model", idempotencyKey: "xhs-provider-execution-approval-injected" }) });
  assert.equal(approvalInjected.status, 400);
  assert.equal((await approvalInjected.json()).code, "UNIFIED_XHS_PROVIDER_EXECUTION_APPROVAL_CALLER_AUTHORITY_FORBIDDEN");
  const executionRequest = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", productSnapshotHash: created.productSnapshotHash,
    platformRunRef: executionApprovalRequest.platformRunRef, candidateRef: executionApprovalRequest.candidateRef,
    providerPlanFactRef: executionApprovalRequest.providerPlanFactRef, approvalFactRef: { id: executionApproval.approvalFact.id, hash: executionApproval.approvalFact.factHash },
    targetPageIds: [targetPage.pageId], idempotencyKey: "xhs-provider-execution-1"
  };
  const executionDisabled = await fetch(executionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionRequest) });
  assert.equal(executionDisabled.status, 404);
  assert.equal((await executionDisabled.json()).code, "UNIFIED_XHS_PROVIDER_EXECUTION_DISABLED");
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1 = "1";
  const missingTransport = await fetch(executionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionRequest) });
  assert.equal(missingTransport.status, 503);
  assert.equal((await missingTransport.json()).code, "UNIFIED_XHS_PROVIDER_EXECUTION_TRANSPORT_NOT_CONFIGURED");
  let providerExecutionCalls = 0;
  setUnifiedContentServerDependenciesForTest({
    xhsProviderTransportContext: { mode: "deterministic_fixture", networked: false },
    xhsProviderTransport: async () => { providerExecutionCalls += 1; return { status: "succeeded", provider: providerPlanCreated.plan.provider.id, model: providerPlanCreated.plan.provider.model, taskId: "fixture-provider-task-1", cost: 1, bytes: providerBytes }; },
    xhsProviderByteSink: async (payloads) => ({ status: "staged_and_hash_verified", receipts: payloads.map((payload) => ({ attemptRef: payload.attemptRef, rawSha256: payload.rawSha256, normalizedSha256: payload.normalizedSha256 })) })
  });
  const executionResponse = await fetch(executionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionRequest) });
  const executionResult = await executionResponse.json();
  assert.equal(executionResponse.status, 201, JSON.stringify(executionResult));
  assert.equal(providerExecutionCalls, 1);
  assert.equal(executionResult.runtime.revisions.length, 1);
  assert.equal(executionResult.runtime.reviewable, true);
  assert.equal(executionResult.runtime.selectable, false);
  assert.equal(executionResult.claims.retries, 0);
  assert.equal(executionResult.claims.networkCalls, 0);
  assert.equal(executionResult.claims.publicationPerformed, false);
  assert.equal(executionResult.staging.crossResourceTransaction, false);
  const incompleteArtifactResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/artifacts?${new URLSearchParams({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", candidateId: xhs.candidateRefs[0].id })}`); const incompleteArtifact = await incompleteArtifactResponse.json(); assert.equal(incompleteArtifactResponse.status, 200, JSON.stringify(incompleteArtifact)); assert.equal(incompleteArtifact.reviewStages.technicalGate.status, "blocked"); assert.equal(incompleteArtifact.humanReviewOpen, false); assert.ok(incompleteArtifact.reviewStages.technicalGate.blockers.includes("page_revisions_missing"));
  const executionReplayResponse = await fetch(executionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(executionRequest) });
  const executionReplay = await executionReplayResponse.json();
  assert.equal(executionReplayResponse.status, 200, JSON.stringify(executionReplay));
  assert.equal(providerExecutionCalls, 1, "execution replay must not call provider again");

  const remainingPages = providerPlanCreated.plan.pages.slice(1);
  const secondProviderApprovalRequest = { ...executionApprovalRequest, targetPageIds: remainingPages.map((page) => page.pageId), maxProviderCalls: remainingPages.length, approvedAt: "2026-08-06T14:10:00.000Z", idempotencyKey: "xhs-provider-execution-approval-2" };
  const secondProviderApprovalResponse = await fetch(approvalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(secondProviderApprovalRequest) });
  const secondProviderApproval = await secondProviderApprovalResponse.json();
  assert.equal(secondProviderApprovalResponse.status, 201, JSON.stringify(secondProviderApproval));
  const secondExecutionRequest = { ...executionRequest, approvalFactRef: { id: secondProviderApproval.approvalFact.id, hash: secondProviderApproval.approvalFact.factHash }, targetPageIds: remainingPages.map((page) => page.pageId), idempotencyKey: "xhs-provider-execution-2" };
  const secondExecutionResponse = await fetch(executionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(secondExecutionRequest) });
  assert.equal(secondExecutionResponse.status, 201, JSON.stringify(await secondExecutionResponse.clone().json()));
  assert.equal(providerExecutionCalls, 6);

  const visualProviderAuthority = { capability: "multimodal_vision", provider: "fixture-vision", model: "fixture-vision-1", estimatedCost: 2, currency: "credits" };
  const visualFlags = { unifiedContentXhsVisualReviewApprovalV1: true, unifiedContentXhsVisualReviewV1: true };
  const visualApprovalInput = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", projectId, productSnapshotHash: created.productSnapshotHash,
    platformRunRef: executionApprovalRequest.platformRunRef, candidateRef: executionApprovalRequest.candidateRef, designEvidenceRef: executionApprovalRequest.designEvidenceRef,
    providerPlanFactRef: executionApprovalRequest.providerPlanFactRef, planRef: executionApprovalRequest.planRef, maxCredits: 3,
    approvedBy: "human:visual-review-approver", approvedAt: "2026-08-06T15:00:00.000Z", idempotencyKey: "xhs-visual-review-approval-1"
  };
  const visualReadyStore = structuredClone(readStore());
  const directVisualApproval = appendUnifiedContentXhsVisualReviewApproval(visualReadyStore, visualApprovalInput, { featureFlags: visualFlags, provider: visualProviderAuthority }).approvalFact;
  const directVisualExecution = (approvalFact, idempotencyKey) => ({ workspaceId: visualApprovalInput.workspaceId, companyId: visualApprovalInput.companyId, accountId: visualApprovalInput.accountId, projectId, productSnapshotHash: visualApprovalInput.productSnapshotHash, platformRunRef: visualApprovalInput.platformRunRef, candidateRef: visualApprovalInput.candidateRef, designEvidenceRef: visualApprovalInput.designEvidenceRef, providerPlanFactRef: visualApprovalInput.providerPlanFactRef, planRef: visualApprovalInput.planRef, approvalFactRef: { id: approvalFact.id, hash: approvalFact.factHash }, idempotencyKey });
  const passOutput = { status: "success", data: { decision: "pass", page_findings: [], deck_findings: [], passed_checks: ["page necessity", "cross-page narrative", "visual consistency", "text-image complement", "information density", "conversion value", "fact and OCR risk"], rerun_stages: [] }, warnings: [], blocked_reasons: [] };
  const fixtureAssetReader = async () => ({ bytes: providerBytes, mediaType: "image/png" });
  const xhsArtifactQuery = new URLSearchParams({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", candidateId: xhs.candidateRefs[0].id });
  const xhsArtifactUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/artifacts?${xhsArtifactQuery}`;
  const xhsArtifactReviewUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/artifact-review`;
  const fetchXhsReviewProjection = async () => {
    const response = await fetch(`${xhsArtifactReviewUrl}?${xhsArtifactQuery}`);
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  const withFixtureStore = async (fixtureStore, inspect) => {
    const restore = structuredClone(readStore());
    writeStore(fixtureStore);
    try { return await inspect(); } finally { writeStore(restore); }
  };
  const metadataStore = structuredClone(visualReadyStore); const metadataApproval = metadataStore.unifiedContentXhsVisualReviewApprovalFacts[0];
  const metadataResult = await executeUnifiedContentXhsVisualReview(metadataStore, directVisualExecution(metadataApproval, "metadata-visual-review"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: fixtureAssetReader, transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => ({ status: "succeeded", provider: visualProviderAuthority.provider, model: visualProviderAuthority.model, mode: "metadata_only", productionResult: false, pixelInputConsumed: false, cost: 1, output: passOutput }) });
  assert.equal(metadataResult.status, "metadata_only_non_production"); assert.equal(metadataResult.claims.humanReviewOpened, false);
  await withFixtureStore(metadataStore, async () => { const projected = await fetchXhsReviewProjection(); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.status, "metadata_only_non_production"); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.provider.pixelInputConsumed, false); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.usage.cost.status, "known"); assert.equal(projected.reviewMaterial.humanReviewOpen, false); });
  const crossScopeStore = structuredClone(metadataStore); const crossScopeInvocation = crossScopeStore.unifiedContentXhsVisualReviewInvocationFacts[0]; crossScopeInvocation.companyId = "other_company"; delete crossScopeInvocation.factHash; crossScopeInvocation.factHash = hashUnifiedContent(crossScopeInvocation);
  await withFixtureStore(crossScopeStore, async () => { const projected = await fetchXhsReviewProjection(); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.status, "blocked_invalid_authority"); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.authorityRefs.invocationFactRef, null); assert.equal(projected.reviewMaterial.humanReviewOpen, false); });
  const unknownVisualStore = structuredClone(visualReadyStore); const unknownVisualApproval = unknownVisualStore.unifiedContentXhsVisualReviewApprovalFacts[0]; let unknownVisualCalls = 0;
  const unknownVisualResult = await executeUnifiedContentXhsVisualReview(unknownVisualStore, directVisualExecution(unknownVisualApproval, "unknown-visual-review"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: fixtureAssetReader, transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => { unknownVisualCalls += 1; throw Object.assign(new Error("unknown paid vision task"), { paidTaskCreated: true, cost: null, providerState: "unknown", checkpoint: { taskId: "vision-unknown" } }); } });
  assert.equal(unknownVisualCalls, 1); assert.equal(unknownVisualResult.status, "checkpoint_required"); assert.equal(unknownVisualStore.unifiedContentXhsVisualReviewCheckpointFacts.length, 1);
  await withFixtureStore(unknownVisualStore, async () => { const projected = await fetchXhsReviewProjection(); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.status, "checkpoint_required"); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.usage.cost.status, "unknown"); assert.ok(projected.reviewMaterial.reviewStages.skillVisualReview.authorityRefs.checkpointFactRef); assert.equal(projected.reviewMaterial.humanReviewOpen, false); });
  const unknownNewVisualApproval = appendUnifiedContentXhsVisualReviewApproval(unknownVisualStore, { ...visualApprovalInput, approvedAt: "2026-08-06T15:01:00.000Z", idempotencyKey: "unknown-new-visual-approval" }, { featureFlags: visualFlags, provider: visualProviderAuthority }).approvalFact; let blockedUnknownCalls = 0;
  await assert.rejects(() => executeUnifiedContentXhsVisualReview(unknownVisualStore, directVisualExecution(unknownNewVisualApproval, "unknown-visual-retry"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: fixtureAssetReader, transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => { blockedUnknownCalls += 1; } }), (error) => error.code === "UNIFIED_XHS_VISUAL_REVIEW_CHECKPOINT_UNRECONCILED"); assert.equal(blockedUnknownCalls, 0);
  const invalidOutputStore = structuredClone(visualReadyStore); const invalidOutputApproval = invalidOutputStore.unifiedContentXhsVisualReviewApprovalFacts[0];
  const invalidOutputResult = await executeUnifiedContentXhsVisualReview(invalidOutputStore, directVisualExecution(invalidOutputApproval, "invalid-output-visual-review"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: fixtureAssetReader, transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => ({ status: "succeeded", provider: visualProviderAuthority.provider, model: visualProviderAuthority.model, pixelInputConsumed: true, productionResult: true, cost: 1, output: { status: "success", data: { decision: "pass" } } }) });
  assert.equal(invalidOutputResult.status, "failed_output_contract"); assert.equal(invalidOutputStore.unifiedContentXhsVisualReviewInvocationFacts.length, 1); assert.equal(invalidOutputStore.unifiedContentXhsVisualReviewExecutionIdempotencyFacts.length, 1);
  await withFixtureStore(invalidOutputStore, async () => { const projected = await fetchXhsReviewProjection(); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.status, "failed_output_contract"); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.provider.status, "failed_output_contract"); assert.equal(projected.reviewMaterial.humanReviewOpen, false); });
  const mismatchStore = structuredClone(visualReadyStore); const mismatchApproval = mismatchStore.unifiedContentXhsVisualReviewApprovalFacts[0]; let mismatchTransportCalls = 0;
  await assert.rejects(() => executeUnifiedContentXhsVisualReview(mismatchStore, directVisualExecution(mismatchApproval, "asset-mismatch-visual-review"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: async () => ({ bytes: Buffer.from("not-the-approved-page"), mediaType: "image/png" }), transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => { mismatchTransportCalls += 1; } }), (error) => error.code === "UNIFIED_XHS_VISUAL_REVIEW_ASSET_MISMATCH"); assert.equal(mismatchTransportCalls, 0); assert.equal(mismatchStore.unifiedContentXhsVisualReviewInvocationFacts.length, 0);
  const staleVisualStore = structuredClone(visualReadyStore); const staleVisualApproval = staleVisualStore.unifiedContentXhsVisualReviewApprovalFacts[0]; const staleRevision = structuredClone(staleVisualStore.unifiedContentXhsPageRevisionFacts[0]); staleRevision.id = `${staleRevision.id}:new`; staleRevision.revision += 1; delete staleRevision.revisionHash; staleRevision.revisionHash = hashUnifiedContent(staleRevision); staleVisualStore.unifiedContentXhsPageRevisionFacts.push(staleRevision); let staleAssetReads = 0; let staleTransportCalls = 0;
  await assert.rejects(() => executeUnifiedContentXhsVisualReview(staleVisualStore, directVisualExecution(staleVisualApproval, "stale-visual-review"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: async () => { staleAssetReads += 1; }, transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => { staleTransportCalls += 1; } }), (error) => error.code === "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_STALE"); assert.equal(staleAssetReads, 0); assert.equal(staleTransportCalls, 0);
  const reviseStore = structuredClone(visualReadyStore); const reviseApproval = reviseStore.unifiedContentXhsVisualReviewApprovalFacts[0]; const reviseOutput = { status: "needs_review", data: { decision: "revise", page_findings: [{ finding_id: "XV01", page: 1, element: "layout", severity: "blocker", issue: "page is redundant", evidence: "pixel evidence", patch: { target: "P1", operation: "redo", value: "simplify" } }], deck_findings: [], passed_checks: [], rerun_stages: ["Renderer"] }, warnings: [], blocked_reasons: [] };
  const reviseResult = await executeUnifiedContentXhsVisualReview(reviseStore, directVisualExecution(reviseApproval, "revise-visual-review"), { featureFlags: visualFlags, provider: visualProviderAuthority, assetReader: fixtureAssetReader, transportContext: { mode: "fixture", networked: false }, multimodalTransport: async () => ({ status: "succeeded", provider: visualProviderAuthority.provider, model: visualProviderAuthority.model, mode: "fixture_multimodal", productionResult: true, pixelInputConsumed: true, cost: 1, output: reviseOutput }) }); assert.equal(reviseResult.status, "redo_required"); assert.equal(reviseResult.invocationFact.productionEligible, true); assert.equal(reviseResult.reviewFact.productionEligible, false); assert.equal(reviseResult.reviewFact.normalizedPageFindings[0].pageRevisionRef.hash, reviseApproval.pageRevisionRefs[0].hash); assert.equal(reviseResult.claims.humanReviewOpened, false);
  await withFixtureStore(reviseStore, async () => { const projected = await fetchXhsReviewProjection(); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.status, "redo_required"); assert.deepEqual(projected.reviewMaterial.reviewStages.skillVisualReview.redo.pendingPageIds, ["P1"]); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.pageFindings[0].pageRevisionRef.hash, reviseApproval.pageRevisionRefs[0].hash); assert.equal(projected.reviewMaterial.humanReviewOpen, false); });

  const visualApprovalUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/visual-review-approval`;
  const visualExecutionUrl = `${baseUrl}/unified-content-projects/${encodeURIComponent(projectId)}/platforms/xiaohongshu/visual-reviews`;
  const visualApprovalRequest = { ...visualApprovalInput }; delete visualApprovalRequest.projectId;
  const legacyBeforeVisualGateResponse = await fetch(xhsArtifactUrl); const legacyBeforeVisualGate = await legacyBeforeVisualGateResponse.json(); assert.equal(legacyBeforeVisualGate.reviewable, false); assert.equal(legacyBeforeVisualGate.humanReviewOpen, false); assert.equal(legacyBeforeVisualGate.reviewStages.skillVisualReview.status, "legacy_not_activated"); assert.equal(legacyBeforeVisualGate.reviewStages.technicalGate.status, "eligible");
  const visualDisabled = await fetch(visualApprovalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(visualApprovalRequest) }); assert.equal(visualDisabled.status, 404);
  process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1 = "1";
  setUnifiedContentServerDependenciesForTest({ xhsVisualReviewProviderAuthority: visualProviderAuthority, xhsVisualReviewAssetReader: fixtureAssetReader, xhsVisualReviewTransportContext: { mode: "fixture_multimodal", networked: false } });
  const visualInjected = await fetch(visualApprovalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...visualApprovalRequest, pages: [], idempotencyKey: "visual-injected-pages" }) }); assert.equal(visualInjected.status, 400); assert.equal((await visualInjected.json()).code, "UNIFIED_XHS_VISUAL_REVIEW_APPROVAL_CALLER_AUTHORITY_FORBIDDEN");
  const visualApprovalResponse = await fetch(visualApprovalUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(visualApprovalRequest) }); const visualApproval = await visualApprovalResponse.json(); assert.equal(visualApprovalResponse.status, 201, JSON.stringify(visualApproval));
  const gatedBeforeReview = await fetch(xhsArtifactUrl); const gatedBefore = await gatedBeforeReview.json(); assert.equal(gatedBefore.reviewable, false); assert.equal(gatedBefore.humanReviewOpen, false); assert.equal(gatedBefore.reviewStages.skillVisualReview.status, "not_reviewed"); assert.equal(gatedBefore.reviewStages.humanArtifactReview.status, "locked");
  const visualExecutionRequest = { workspaceId: visualApprovalRequest.workspaceId, companyId: visualApprovalRequest.companyId, accountId: visualApprovalRequest.accountId, productSnapshotHash: visualApprovalRequest.productSnapshotHash, platformRunRef: visualApprovalRequest.platformRunRef, candidateRef: visualApprovalRequest.candidateRef, designEvidenceRef: visualApprovalRequest.designEvidenceRef, providerPlanFactRef: visualApprovalRequest.providerPlanFactRef, planRef: visualApprovalRequest.planRef, approvalFactRef: { id: visualApproval.approvalFact.id, hash: visualApproval.approvalFact.factHash }, idempotencyKey: "xhs-visual-review-execution-1" };
  const visualExecutionInjected = await fetch(visualExecutionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...visualExecutionRequest, model: "caller-injected-model", idempotencyKey: "visual-execution-injected" }) }); assert.equal(visualExecutionInjected.status, 400); assert.equal((await visualExecutionInjected.json()).code, "UNIFIED_XHS_VISUAL_REVIEW_EXECUTION_CALLER_AUTHORITY_FORBIDDEN");
  const visualExecutionDisabled = await fetch(visualExecutionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(visualExecutionRequest) }); assert.equal(visualExecutionDisabled.status, 404);
  process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1 = "1"; let visualTransportCalls = 0;
  setUnifiedContentServerDependenciesForTest({ xhsVisualReviewMultimodalTransport: async (multimodalRequest) => { visualTransportCalls += 1; assert.equal(multimodalRequest.contract, "UnifiedXhsVisualReviewMultimodalRequest@1.0"); assert.equal(multimodalRequest.attachments.length, 6); assert.ok(multimodalRequest.attachments.every((item) => Buffer.isBuffer(item.bytes) && item.pageRevisionRef.hash)); assert.ok(multimodalRequest.skill.referenceBundle.some((item) => item.path === "SKILL.md") && multimodalRequest.skill.referenceBundle.some((item) => item.path === "references/contract.md")); return { status: "succeeded", provider: visualProviderAuthority.provider, model: visualProviderAuthority.model, mode: "fixture_multimodal", productionResult: true, pixelInputConsumed: true, cost: 1, output: passOutput }; } });
  const visualExecutionResponse = await fetch(visualExecutionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(visualExecutionRequest) }); const visualExecution = await visualExecutionResponse.json(); assert.equal(visualExecutionResponse.status, 201, JSON.stringify(visualExecution)); assert.equal(visualTransportCalls, 1); assert.equal(visualExecution.reviewFact.status, "skill_passed"); assert.equal(visualExecution.invocationFact.pixelInputConsumed, true); assert.equal(visualExecution.invocationFact.providerCalls, 1); assert.equal(visualExecution.claims.automaticRetries, 0);
  const visualReplayResponse = await fetch(visualExecutionUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(visualExecutionRequest) }); assert.equal(visualReplayResponse.status, 200); assert.equal(visualTransportCalls, 1);
  const gatedAfterReview = await fetch(xhsArtifactUrl); const gatedAfter = await gatedAfterReview.json(); assert.equal(gatedAfter.reviewable, true); assert.equal(gatedAfter.humanReviewOpen, true); assert.equal(gatedAfter.reviewStages.skillVisualReview.status, "skill_passed"); assert.equal(gatedAfter.reviewStages.skillVisualReview.revisionSetHash, visualExecution.reviewFact.revisionSetHash); assert.deepEqual(gatedAfter.reviewStages.skillVisualReview.pageRevisionRefs, visualExecution.reviewFact.pageRevisionRefs); assert.equal(gatedAfter.reviewStages.skillVisualReview.provider.name, visualProviderAuthority.provider); assert.equal(gatedAfter.reviewStages.skillVisualReview.provider.model, visualProviderAuthority.model); assert.equal(gatedAfter.reviewStages.skillVisualReview.usage.providerCalls, 1); assert.equal(gatedAfter.reviewStages.skillVisualReview.usage.automaticRetries, 0); assert.equal(gatedAfter.reviewStages.skillVisualReview.usage.cost.status, "known"); assert.equal(gatedAfter.reviewStages.humanArtifactReview.status, "available"); assert.equal(gatedAfter.selectable, false);
  const projectionInjection = await fetch(xhsArtifactReviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", candidateId: xhs.candidateRefs[0].id, artifactStateHash: gatedAfter.artifactStateHash, reviewerId: "human:fixture", reason: "must reject projection injection", action: "approve_set", payload: { humanReviewOpen: true, findings: [] }, reviewStages: {}, idempotencyKey: "xhs-review-projection-injection" }) }); assert.equal(projectionInjection.status, 400); assert.equal((await projectionInjection.json()).code, "UNIFIED_ARTIFACT_REVIEW_PROJECTION_AUTHORITY_FORBIDDEN");
  const approvalActionResponse = await fetch(xhsArtifactReviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", candidateId: xhs.candidateRefs[0].id, artifactStateHash: gatedAfter.artifactStateHash, reviewerId: "human:fixture", reason: "approve exact current set", action: "approve_set", payload: {}, idempotencyKey: "xhs-review-current-approval" }) }); assert.equal(approvalActionResponse.status, 201, JSON.stringify(await approvalActionResponse.clone().json()));
  const approvedProjection = await fetchXhsReviewProjection(); assert.equal(approvedProjection.reviewMaterial.reviewStages.humanArtifactReview.status, "approved"); assert.equal(approvedProjection.reviewMaterial.reviewStages.humanArtifactReview.stale, false);
  const approvedStore = structuredClone(readStore());
  const staleProjectionStore = structuredClone(approvedStore); const projectedStaleRevision = structuredClone(staleProjectionStore.unifiedContentXhsPageRevisionFacts[0]); projectedStaleRevision.id = `${projectedStaleRevision.id}:projection-stale`; projectedStaleRevision.revision += 1; delete projectedStaleRevision.revisionHash; projectedStaleRevision.revisionHash = hashUnifiedContent(projectedStaleRevision); staleProjectionStore.unifiedContentXhsPageRevisionFacts.push(projectedStaleRevision);
  await withFixtureStore(staleProjectionStore, async () => { const projected = await fetchXhsReviewProjection(); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.status, "stale"); assert.equal(projected.reviewMaterial.reviewStages.skillVisualReview.stale, true); assert.equal(projected.reviewMaterial.humanReviewOpen, false); assert.equal(projected.reviewMaterial.reviewStages.humanArtifactReview.status, "locked"); assert.equal(projected.reviewMaterial.reviewStages.humanArtifactReview.stale, true); assert.equal(projected.reviewMaterial.reviewStages.humanArtifactReview.authorityRefs.decisionFactRef, null); });
  await withFixtureStore(approvedStore, async () => { const current = await fetchXhsReviewProjection(); const redoResponse = await fetch(xhsArtifactReviewUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", candidateId: xhs.candidateRefs[0].id, artifactStateHash: current.artifactState.artifactStateHash, reviewerId: "human:fixture", reason: "redo page", action: "request_page_redo", payload: { pageId: "P1", pageRevisionRef: current.reviewMaterial.pages.find((page) => page.pageId === "P1").revisionRef }, idempotencyKey: "xhs-review-redo-projection" }) }); assert.equal(redoResponse.status, 201, JSON.stringify(await redoResponse.clone().json())); const redoProjection = await fetchXhsReviewProjection(); assert.equal(redoProjection.reviewMaterial.humanReviewOpen, false); assert.ok(redoProjection.reviewMaterial.reviewStages.humanArtifactReview.blockers.includes("page_redo_pending")); });
  process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_V1 = "0"; process.env.UNIFIED_CONTENT_XHS_VISUAL_REVIEW_APPROVAL_V1 = "0";
  const gatedFlagOffResponse = await fetch(xhsArtifactUrl); const gatedFlagOff = await gatedFlagOffResponse.json(); assert.equal(gatedFlagOff.reviewStages.skillVisualReview.status, "skill_passed"); assert.equal(gatedFlagOff.reviewStages.humanArtifactReview.status, "approved");

  // Atomic authority must survive the complete artifact path. This fixture is
  // deliberately isolated and non-networked; it stops before human selection.
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "1";
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";
  process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = "1";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = "1";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = "1";
  process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = "1";
  process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = "1";
  process.env.XHS_VISUAL_ASSET_REGISTRY = "1";
  process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = "1";
  const atomicDesignFullResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu/design`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", productSnapshotHash: atomicProduct.projectionHash,
      platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef, visualDirection: atomicVisualDirection, idempotencyKey: "atomic-xhs-full-design"
    })
  });
  const atomicDesignFull = await atomicDesignFullResponse.json();
  assert.equal(atomicDesignFullResponse.status, 201, JSON.stringify(atomicDesignFull));
  const atomicPlanFullResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu/provider-plan`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", productSnapshotHash: atomicProduct.projectionHash,
      platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef,
      designFactRef: { id: atomicDesignFull.artifactFact.id, hash: atomicDesignFull.artifactFact.factHash },
      designEvidenceRef: { id: atomicDesignFull.evidence.id, hash: atomicDesignFull.evidence.evidenceHash },
      promptSetRef: { id: atomicDesignFull.evidence.outputs.skillInvocation.promptSet.id, hash: atomicDesignFull.evidence.outputs.skillInvocation.promptSetHash },
      selectedDirectionId: atomicDesignFull.providerPlanningOptions.directionCandidates[0].id,
      promptApproval: { reviewedPromptSetHash: atomicDesignFull.evidence.outputs.skillInvocation.promptSetHash, approvedBy: "human:atomic-full-plan", approvedAt: "2026-08-06T16:00:00.000Z" },
      costConfirmation: { currency: "credits", approvedMaxTotal: 100, confirmedBy: "human:atomic-full-budget", confirmedAt: "2026-08-06T16:01:00.000Z" },
      idempotencyKey: "atomic-xhs-full-plan"
    })
  });
  const atomicPlanFull = await atomicPlanFullResponse.json();
  assert.equal(atomicPlanFullResponse.status, 201, JSON.stringify(atomicPlanFull));
  const atomicExecutionFlags = { unifiedContentAtomicProductV1: true, unifiedContentXhsProviderExecutionApprovalV1: true, unifiedContentXhsProviderExecutionV1: true };
  const atomicPageIds = atomicPlanFull.plan.pages.map((page) => page.pageId);
  const atomicExecutionApprovalInput = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", projectId: atomicProduct.id, productSnapshotHash: atomicProduct.projectionHash,
    platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef,
    designFactRef: { id: atomicDesignFull.artifactFact.id, hash: atomicDesignFull.artifactFact.factHash }, designEvidenceRef: { id: atomicDesignFull.evidence.id, hash: atomicDesignFull.evidence.evidenceHash },
    providerPlanFactRef: { id: atomicPlanFull.facts.plan.id, hash: atomicPlanFull.facts.plan.factHash }, planRef: { id: atomicPlanFull.plan.id, hash: atomicPlanFull.plan.planHash },
    targetPageIds: atomicPageIds, maxProviderCalls: atomicPageIds.length, maxCredits: 100, approvedBy: "human:atomic-full-execution", approvedAt: "2026-08-06T16:02:00.000Z", idempotencyKey: "atomic-xhs-full-execution-approval"
  };
  const atomicStore = readStore();
  const atomicExecutionApproval = appendUnifiedContentXhsProviderExecutionApproval(atomicStore, atomicExecutionApprovalInput, { featureFlags: atomicExecutionFlags }).approvalFact;
  let atomicFixtureProviderCalls = 0;
  const atomicExecution = await executeUnifiedContentXhsProviderExecution(atomicStore, {
    workspaceId: atomicExecutionApprovalInput.workspaceId, companyId: atomicExecutionApprovalInput.companyId, accountId: atomicExecutionApprovalInput.accountId,
    projectId: atomicProduct.id, productSnapshotHash: atomicProduct.projectionHash, platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef,
    providerPlanFactRef: atomicExecutionApprovalInput.providerPlanFactRef, approvalFactRef: { id: atomicExecutionApproval.id, hash: atomicExecutionApproval.factHash },
    targetPageIds: atomicPageIds, idempotencyKey: "atomic-xhs-full-execution"
  }, {
    featureFlags: atomicExecutionFlags, transportContext: { mode: "atomic_fixture", networked: false },
    transport: async () => { atomicFixtureProviderCalls += 1; return { status: "succeeded", provider: atomicPlanFull.plan.provider.id, model: atomicPlanFull.plan.provider.model, taskId: `atomic-fixture-task-${atomicFixtureProviderCalls}`, cost: 1, bytes: providerBytes }; },
    byteSink: async (payloads) => ({ status: "staged_and_hash_verified", receipts: payloads.map((payload) => ({ attemptRef: payload.attemptRef, rawSha256: payload.rawSha256, normalizedSha256: payload.normalizedSha256 })) })
  });
  assert.equal(atomicFixtureProviderCalls, atomicPageIds.length);
  assert.equal(atomicExecution.runtime.newRevisionRefs.length, atomicPageIds.length);
  assert.ok(atomicExecution.runtime.attempts.every((fact) => assert.deepEqual(fact.materializedContentProjectRef, atomicProduct.refs.materializedContentProjectRef) === undefined));
  assert.ok(atomicExecution.runtime.revisions.every((fact) => assert.deepEqual(fact.materializedContentProjectRef, atomicProduct.refs.materializedContentProjectRef) === undefined));
  const atomicVisualFlags = { unifiedContentAtomicProductV1: true, unifiedContentXhsVisualReviewApprovalV1: true, unifiedContentXhsVisualReviewV1: true };
  const atomicVisualApprovalInput = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", projectId: atomicProduct.id, productSnapshotHash: atomicProduct.projectionHash,
    platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef, designEvidenceRef: atomicExecutionApprovalInput.designEvidenceRef,
    providerPlanFactRef: atomicExecutionApprovalInput.providerPlanFactRef, planRef: atomicExecutionApprovalInput.planRef, maxCredits: 3,
    approvedBy: "human:atomic-full-visual", approvedAt: "2026-08-06T16:03:00.000Z", idempotencyKey: "atomic-xhs-full-visual-approval"
  };
  const atomicVisualApproval = appendUnifiedContentXhsVisualReviewApproval(atomicStore, atomicVisualApprovalInput, { featureFlags: atomicVisualFlags, provider: visualProviderAuthority }).approvalFact;
  let atomicVisualCalls = 0;
  const atomicVisual = await executeUnifiedContentXhsVisualReview(atomicStore, {
    workspaceId: atomicVisualApprovalInput.workspaceId, companyId: atomicVisualApprovalInput.companyId, accountId: atomicVisualApprovalInput.accountId,
    projectId: atomicProduct.id, productSnapshotHash: atomicProduct.projectionHash, platformRunRef: atomicProduct.refs.platformRunRef, candidateRef: atomicProduct.refs.candidateRef,
    designEvidenceRef: atomicVisualApprovalInput.designEvidenceRef, providerPlanFactRef: atomicVisualApprovalInput.providerPlanFactRef, planRef: atomicVisualApprovalInput.planRef,
    approvalFactRef: { id: atomicVisualApproval.id, hash: atomicVisualApproval.factHash }, idempotencyKey: "atomic-xhs-full-visual"
  }, {
    featureFlags: atomicVisualFlags, provider: visualProviderAuthority, assetReader: fixtureAssetReader, transportContext: { mode: "atomic_fixture", networked: false },
    multimodalTransport: async (request) => { atomicVisualCalls += 1; assert.equal(request.attachments.length, atomicPageIds.length); return { status: "succeeded", provider: visualProviderAuthority.provider, model: visualProviderAuthority.model, mode: "atomic_fixture_multimodal", productionResult: true, pixelInputConsumed: true, cost: 1, output: passOutput }; }
  });
  assert.equal(atomicVisualCalls, 1);
  assert.equal(atomicVisual.invocationFact.humanReviewAuthority, false);
  assert.equal(atomicVisual.invocationFact.selectionAuthority, false);
  assert.equal(atomicVisual.reviewFact.humanReviewAuthority, false);
  assert.equal(atomicVisual.reviewFact.selectionAuthority, false);
  assert.equal(atomicVisual.reviewFact.publicationPerformed, false);
  writeStore(atomicStore);
  const atomicArtifactQuery = new URLSearchParams({ workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture", candidateId: atomicProduct.refs.candidateRef.id, productSnapshotHash: atomicProduct.projectionHash });
  const atomicArtifactResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu/artifacts?${atomicArtifactQuery}`);
  const atomicArtifact = await atomicArtifactResponse.json();
  assert.equal(atomicArtifactResponse.status, 200, JSON.stringify(atomicArtifact));
  assert.equal(atomicArtifact.humanReviewOpen, true);
  assert.equal(atomicArtifact.selectable, false);
  assert.notEqual(atomicArtifact.selected, true);
  assert.notEqual(atomicArtifact.promoted, true);
  assert.notEqual(atomicArtifact.deliveryReady, true);
  assert.notEqual(atomicArtifact.publicationPerformed, true);
  assert.equal(atomicArtifact.reviewStages.skillVisualReview.status, "skill_passed");

  const atomicHumanBase = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu`;
  const atomicHumanScope = {
    workspaceId: "workspace_default", companyId: "company_fixture", accountId: "xhs_account_fixture",
    candidateId: atomicProduct.refs.candidateRef.id, productSnapshotHash: atomicProduct.projectionHash
  };
  const skillOnlyStore = structuredClone(readStore());
  const skillOnlyReviewResponse = await fetch(`${atomicHumanBase}/reviews`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, idempotencyKey: "atomic-skill-only-review" })
  });
  assert.equal(skillOnlyReviewResponse.status, 409);
  assert.equal((await skillOnlyReviewResponse.json()).code, "UNIFIED_ATOMIC_REVIEW_HUMAN_ARTIFACT_APPROVAL_REQUIRED");
  assert.deepEqual(readStore(), skillOnlyStore, "Skill pass alone must not append review or selection authority");

  for (const [name, routeProjectId, routePlatform, overrides] of [
    ["cross-company", atomicProduct.id, "xiaohongshu", { companyId: "other-company" }],
    ["cross-account", atomicProduct.id, "xiaohongshu", { accountId: "wechat_account_fixture" }],
    ["cross-platform", atomicProduct.id, "wechat", {}],
    ["wrong-candidate", atomicProduct.id, "xiaohongshu", { candidateId: "candidate:wrong" }],
    ["wrong-project", "content-project:wrong", "xiaohongshu", {}],
    ["wrong-product-hash", atomicProduct.id, "xiaohongshu", { productSnapshotHash: "0".repeat(64) }]
  ]) {
    const attackStore = structuredClone(readStore());
    const response = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(routeProjectId)}/platforms/${routePlatform}/reviews`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...atomicHumanScope, ...overrides, idempotencyKey: `atomic-review-attack-${name}` })
    });
    assert.notEqual(response.status, 201, `${name} must fail`);
    assert.deepEqual(readStore(), attackStore, `${name} must be zero-write`);
  }

  const atomicArtifactReviewUrl = `${atomicHumanBase}/artifact-review`;
  const missingActorStore = structuredClone(readStore());
  const missingActorApproval = await fetch(atomicArtifactReviewUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, artifactStateHash: atomicArtifact.artifactStateHash, reviewerId: "human:atomic-artifact-owner", reason: "approve exact rendered set", action: "approve_set", payload: {}, idempotencyKey: "atomic-artifact-approval-missing-actor" })
  });
  assert.equal(missingActorApproval.status, 400);
  assert.equal((await missingActorApproval.json()).code, "UNIFIED_ARTIFACT_REVIEW_ACTOR_TYPE_REQUIRED");
  assert.deepEqual(readStore(), missingActorStore, "missing explicit user actor must be zero-write");
  const wrongArtifactHashStore = structuredClone(readStore());
  const wrongArtifactHashApproval = await fetch(atomicArtifactReviewUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, artifactStateHash: "0".repeat(64), reviewerId: "human:atomic-artifact-owner", actorType: "user", reason: "wrong state", action: "approve_set", payload: {}, idempotencyKey: "atomic-artifact-approval-wrong-state" })
  });
  assert.equal(wrongArtifactHashApproval.status, 409);
  assert.equal((await wrongArtifactHashApproval.json()).code, "UNIFIED_ARTIFACT_REVIEW_STATE_STALE");
  assert.deepEqual(readStore(), wrongArtifactHashStore, "wrong Artifact State hash must be zero-write");
  const atomicHumanApprovalResponse = await fetch(atomicArtifactReviewUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, artifactStateHash: atomicArtifact.artifactStateHash, reviewerId: "human:atomic-artifact-owner", actorType: "user", reason: "approve exact rendered set", action: "approve_set", payload: {}, idempotencyKey: "atomic-artifact-approval" })
  });
  const atomicHumanApproval = await atomicHumanApprovalResponse.json();
  assert.equal(atomicHumanApprovalResponse.status, 201, JSON.stringify(atomicHumanApproval));
  assert.equal(atomicHumanApproval.actionFact.actorType, "user");
  assert.equal(atomicHumanApproval.artifactReview.artifactState.selectable, true);

  const preEditorialStore = structuredClone(readStore());
  const preEditorialSelection = await fetch(`${atomicHumanBase}/selections`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, reviewId: "missing-review", actorId: "user:atomic-selector", actorType: "user", occurredAt: "2026-08-06T16:05:00.000Z", action: "selected", idempotencyKey: "atomic-selection-before-editorial" })
  });
  assert.equal(preEditorialSelection.status, 409);
  assert.deepEqual(readStore(), preEditorialStore, "selection before Editorial Review must be zero-write");

  const beforeAtomicReview = structuredClone(readStore());
  const atomicReviewResponse = await fetch(`${atomicHumanBase}/reviews`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, idempotencyKey: "atomic-editorial-review" })
  });
  const atomicReview = await atomicReviewResponse.json();
  assert.equal(atomicReviewResponse.status, 201, JSON.stringify(atomicReview));
  assert.equal(atomicReview.reviewFact.contract, "UnifiedAtomicXhsContentReviewFact@1.0");
  assert.equal(atomicReview.reviewFact.machineGate.status, "passed");
  assert.equal(atomicReview.reviewFact.editorialReview.status, "passed");
  assert.deepEqual(atomicReview.reviewFact.materializedContentProjectRef, atomicProduct.refs.materializedContentProjectRef);
  const afterAtomicReview = readStore();
  const atomicReviewChangedKeys = [...new Set([...Object.keys(beforeAtomicReview), ...Object.keys(afterAtomicReview)])]
    .filter((key) => JSON.stringify(beforeAtomicReview[key]) !== JSON.stringify(afterAtomicReview[key])).sort();
  assert.deepEqual(atomicReviewChangedKeys, ["unifiedContentReviews"], "successful Atomic Editorial Review may append only its Review Fact collection");
  assert.deepEqual(readStore().unifiedAtomicContentCommits, beforeAtomicReview.unifiedAtomicContentCommits, "Editorial Review must not modify Atomic Commit");
  assert.deepEqual(readStore().unifiedContentXhsPageRevisionFacts, beforeAtomicReview.unifiedContentXhsPageRevisionFacts, "Editorial Review must not modify Page Revisions");
  const atomicReviewReplay = await fetch(`${atomicHumanBase}/reviews`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...atomicHumanScope, idempotencyKey: "atomic-editorial-review" })
  });
  assert.equal(atomicReviewReplay.status, 200);
  assert.equal((await atomicReviewReplay.json()).created, false);

  const nonUserSelectionStore = structuredClone(readStore());
  const nonUserSelection = await fetch(`${atomicHumanBase}/selections`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, reviewId: atomicReview.reviewFact.id, actorId: "skill:visual-review", actorType: "skill", occurredAt: "2026-08-06T16:05:00.000Z", action: "selected", idempotencyKey: "atomic-selection-non-user" })
  });
  assert.equal(nonUserSelection.status, 400);
  assert.equal((await nonUserSelection.json()).code, "UNIFIED_SELECTION_EXPLICIT_USER_REQUIRED");
  assert.deepEqual(readStore(), nonUserSelectionStore, "Skill identity cannot create a Selection Fact");
  const beforeAtomicSelection = structuredClone(readStore());
  const atomicSelectionResponse = await fetch(`${atomicHumanBase}/selections`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, reviewId: atomicReview.reviewFact.id, actorId: "user:atomic-selector", actorType: "user", occurredAt: "2026-08-06T16:06:00.000Z", action: "selected", idempotencyKey: "atomic-selection" })
  });
  const atomicSelection = await atomicSelectionResponse.json();
  assert.equal(atomicSelectionResponse.status, 201, JSON.stringify(atomicSelection));
  assert.equal(atomicSelection.selectionFact.contract, "UnifiedAtomicXhsSelectionFact@1.0");
  assert.equal(atomicSelection.selectionFact.status, "selected");
  assert.equal(atomicSelection.selectionFact.actorType, "user");
  assert.equal(atomicSelection.selectionFact.promotionAuthority, false);
  assert.equal(atomicSelection.selectionFact.publicationAuthority, false);
  assert.equal(atomicSelection.selectionFact.deliveryReady, false);
  const afterAtomicSelection = readStore();
  const atomicSelectionChangedKeys = [...new Set([...Object.keys(beforeAtomicSelection), ...Object.keys(afterAtomicSelection)])]
    .filter((key) => JSON.stringify(beforeAtomicSelection[key]) !== JSON.stringify(afterAtomicSelection[key])).sort();
  assert.deepEqual(atomicSelectionChangedKeys, ["unifiedContentSelections"], "successful Atomic Selection may append only its Selection Fact collection");
  const atomicSelectionReplay = await fetch(`${atomicHumanBase}/selections`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, reviewId: atomicReview.reviewFact.id, actorId: "user:atomic-selector", actorType: "user", occurredAt: "2026-08-06T16:06:00.000Z", action: "selected", idempotencyKey: "atomic-selection" })
  });
  assert.equal(atomicSelectionReplay.status, 200);
  assert.equal((await atomicSelectionReplay.json()).created, false);
  const selectionConflictStore = structuredClone(readStore());
  const atomicSelectionConflict = await fetch(`${atomicHumanBase}/selections`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, reviewId: atomicReview.reviewFact.id, actorId: "user:atomic-selector", actorType: "user", occurredAt: "2026-08-06T16:06:00.000Z", action: "not_selected", idempotencyKey: "atomic-selection" })
  });
  assert.equal(atomicSelectionConflict.status, 409);
  assert.equal((await atomicSelectionConflict.json()).code, "UNIFIED_SELECTION_IDEMPOTENCY_CONFLICT");
  assert.deepEqual(readStore(), selectionConflictStore, "same key with different Selection semantics must be zero-write");

  const atomicReviewStateResponse = await fetch(`${atomicHumanBase}/review-state?${new URLSearchParams(atomicHumanScope)}`);
  const atomicReviewState = await atomicReviewStateResponse.json();
  assert.equal(atomicReviewStateResponse.status, 200, JSON.stringify(atomicReviewState));
  assert.equal(atomicReviewState.artifactApproved, true);
  assert.equal(atomicReviewState.editorialReviewPassed, true);
  assert.equal(atomicReviewState.selected, true);
  assert.equal(atomicReviewState.promoted, false);
  assert.equal(atomicReviewState.deliveryReady, false);
  assert.equal(atomicReviewState.published, false);
  assert.ok(atomicReviewState.blockers.includes("wechat_not_materialized"));
  const selectedProductResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`);
  const selectedProduct = await selectedProductResponse.json();
  assert.equal(selectedProductResponse.status, 200, JSON.stringify(selectedProduct));
  assert.equal(selectedProduct.projectionHash, atomicProduct.projectionHash, "human read state must not replace immutable product authority hash");
  assert.deepEqual(selectedProduct.reviewState, {
    artifactApproved: true, editorialReviewPassed: true, selected: true, stale: false,
    artifactReviewFactRef: atomicReview.reviewFact.artifactReviewActionRef,
    editorialReviewFactRef: { id: atomicReview.reviewFact.id, hash: atomicReview.reviewFact.factHash },
    selectionFactRef: { id: atomicSelection.selectionFact.id, hash: atomicSelection.selectionFact.factHash }
  });
  assert.equal(selectedProduct.promoted, false);
  assert.equal(selectedProduct.deliveryReady, false);
  assert.equal(selectedProduct.published, false);
  assert.equal(selectedProduct.wechatState, "not_materialized");
  process.env.CONTENT_PROMOTION_V1 = "1";
  const promotionPreviewStore = structuredClone(readStore());
  const atomicPromotionPreviewResponse = await fetch(`${atomicHumanBase}/promotion-preview`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(atomicHumanScope)
  });
  const atomicPromotionPreview = await atomicPromotionPreviewResponse.json();
  assert.equal(atomicPromotionPreviewResponse.status, 200, JSON.stringify(atomicPromotionPreview));
  assert.equal(atomicPromotionPreview.contract, "AtomicXhsContentPromotionPreflight@1.0");
  assert.equal(atomicPromotionPreview.claims.finalDeliveryAuthority, false);
  assert.equal(Object.hasOwn(atomicPromotionPreview.bindings, "deliveryArtifactRef"), false);
  assert.deepEqual(atomicPromotionPreview.bindings.pageRevisionRefs, atomicSelection.selectionFact.pageRevisionRefs);
  assert.deepEqual(readStore(), promotionPreviewStore, "Atomic Promotion preflight must be read-only");
  const beforeAtomicPromotion = structuredClone(readStore());
  const atomicPromotionConfirmResponse = await fetch(`${atomicHumanBase}/promotion-confirm`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, previewToken: atomicPromotionPreview.previewToken, idempotencyKey: "atomic-xhs-promotion" })
  });
  const atomicPromotion = await atomicPromotionConfirmResponse.json();
  assert.equal(atomicPromotionConfirmResponse.status, 201, JSON.stringify(atomicPromotion));
  assert.equal(atomicPromotion.promotion.contract, "AtomicXhsPromotionRecord@1.0");
  assert.equal(atomicPromotion.contentVersion.contract, "AtomicXhsImmutableContentVersion@1.0");
  assert.equal(Object.hasOwn(atomicPromotion.contentVersion, "deliveryBundle"), false);
  assert.deepEqual(atomicPromotion.contentVersion.pageRevisionRefs, atomicSelection.selectionFact.pageRevisionRefs);
  const afterAtomicPromotion = readStore();
  const promotionChangedKeys = [...new Set([...Object.keys(beforeAtomicPromotion), ...Object.keys(afterAtomicPromotion)])]
    .filter((key) => JSON.stringify(beforeAtomicPromotion[key]) !== JSON.stringify(afterAtomicPromotion[key])).sort();
  assert.deepEqual(promotionChangedKeys, ["contentPromotions", "contentVersions"]);
  const atomicPromotionReplayResponse = await fetch(`${atomicHumanBase}/promotion-confirm`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...atomicHumanScope, previewToken: atomicPromotionPreview.previewToken, idempotencyKey: "atomic-xhs-promotion" })
  });
  assert.equal(atomicPromotionReplayResponse.status, 200);
  assert.equal((await atomicPromotionReplayResponse.json()).created, false);
  const promotedProduct = await (await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`)).json();
  assert.equal(promotedProduct.selected, true);
  assert.equal(promotedProduct.promoted, true);
  assert.equal(promotedProduct.deliveryReady, false);
  assert.equal(promotedProduct.published, false);
  const promotionRef = { id: atomicPromotion.promotion.id, hash: atomicPromotion.promotion.promotionHash };
  const deliveryScope = { ...atomicHumanScope, promotionId: atomicPromotion.promotion.id, promotionRef, promotedVersionRef: atomicPromotion.promotion.promotedVersionRef, idempotencyKey: "atomic-xhs-final-delivery" };
  setUnifiedContentServerDependenciesForTest({ xhsDeliveryAssetReader: undefined, xhsVisualReviewAssetReader: undefined });
  const missingDeliveryReaderStore = structuredClone(readStore());
  const missingDeliveryReaderResponse = await fetch(`${atomicHumanBase}/final-delivery`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...deliveryScope, idempotencyKey: "atomic-xhs-delivery-missing-reader" })
  });
  assert.equal(missingDeliveryReaderResponse.status, 503);
  assert.equal((await missingDeliveryReaderResponse.json()).code, "UNIFIED_XHS_DELIVERY_RUNTIME_NOT_READY");
  assert.deepEqual(readStore(), missingDeliveryReaderStore, "missing Delivery asset reader must preserve the complete store shape and values");
  setUnifiedContentServerDependenciesForTest({ xhsDeliveryAssetReader: async () => { throw Object.assign(new Error("fixture delivery reader failed"), { code: "FIXTURE_DELIVERY_READER_FAILED", statusCode: 409 }); } });
  const thrownDeliveryReaderStore = structuredClone(readStore());
  const thrownDeliveryReaderResponse = await fetch(`${atomicHumanBase}/final-delivery`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...deliveryScope, idempotencyKey: "atomic-xhs-delivery-thrown-reader" })
  });
  assert.equal(thrownDeliveryReaderResponse.status, 409);
  assert.equal((await thrownDeliveryReaderResponse.json()).code, "FIXTURE_DELIVERY_READER_FAILED");
  assert.deepEqual(readStore(), thrownDeliveryReaderStore, "thrown Delivery asset reader must preserve the complete store shape and values");
  setUnifiedContentServerDependenciesForTest({ xhsDeliveryAssetReader: async () => ({ bytes: Buffer.from("mismatched selected image bytes"), mediaType: "image/png" }) });
  const mismatchedDeliveryAssetStore = structuredClone(readStore());
  const mismatchedDeliveryAssetResponse = await fetch(`${atomicHumanBase}/final-delivery`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...deliveryScope, idempotencyKey: "atomic-xhs-delivery-asset-mismatch" })
  });
  assert.equal(mismatchedDeliveryAssetResponse.status, 409);
  assert.equal((await mismatchedDeliveryAssetResponse.json()).code, "ATOMIC_XHS_DELIVERY_ASSET_MISMATCH");
  assert.deepEqual(readStore(), mismatchedDeliveryAssetStore, "mismatched Delivery bytes must preserve the complete store shape and values");
  setUnifiedContentServerDependenciesForTest({ xhsDeliveryAssetReader: fixtureAssetReader });
  const beforeAtomicDelivery = structuredClone(readStore());
  const atomicDeliveryResponse = await fetch(`${atomicHumanBase}/final-delivery`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(deliveryScope)
  });
  const atomicDelivery = await atomicDeliveryResponse.json();
  assert.equal(atomicDeliveryResponse.status, 201, JSON.stringify(atomicDelivery));
  assert.equal(atomicDelivery.delivery.contract, "AtomicXhsFinalDeliveryRecord@1.0");
  assert.deepEqual(atomicDelivery.delivery.promotedVersionRef, atomicPromotion.promotion.promotedVersionRef);
  assert.deepEqual(atomicDelivery.delivery.manifest.platformVersionRef, atomicPromotion.promotion.promotedVersionRef);
  assert.deepEqual(atomicDelivery.delivery.manifest.lifecycleRefs, {
    editorialReviewRef: atomicPromotion.contentVersion.editorialReviewRef,
    selectionRef: atomicPromotion.contentVersion.selectionRef,
    promotionRef
  });
  assert.equal(atomicDelivery.delivery.platformPublicationPerformed, false);
  assert.deepEqual(atomicDelivery.delivery.pageRevisionRefs, atomicSelection.selectionFact.pageRevisionRefs);
  assert.deepEqual(atomicDelivery.delivery.files.map((item) => item.path), ["copy/title.txt", "copy/body.txt", "copy/tags.txt", "copy/pinned-comment.txt", ...atomicSelection.selectionFact.pageRevisionRefs.map((_, index) => `images/${String(index + 1).padStart(2, "0")}_P${index + 1}.png`), "manifest.json"]);
  assert.ok(atomicDelivery.delivery.files.every((file) => {
    const bytes = Buffer.from(file.content, file.encoding);
    return bytes.length === file.bytes && createHash("sha256").update(bytes).digest("hex") === file.sha256;
  }), "every persisted final file must retain exact deterministic bytes and SHA-256");
  const afterAtomicDelivery = readStore();
  const deliveryChangedKeys = [...new Set([...Object.keys(beforeAtomicDelivery), ...Object.keys(afterAtomicDelivery)])]
    .filter((key) => JSON.stringify(beforeAtomicDelivery[key]) !== JSON.stringify(afterAtomicDelivery[key])).sort();
  assert.deepEqual(deliveryChangedKeys, ["unifiedAtomicXhsDeliveries"]);
  const atomicDeliveryReplayResponse = await fetch(`${atomicHumanBase}/final-delivery`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(deliveryScope)
  });
  assert.equal(atomicDeliveryReplayResponse.status, 200);
  const atomicDeliveryReplay = await atomicDeliveryReplayResponse.json();
  assert.equal(atomicDeliveryReplay.created, false);
  assert.equal(atomicDeliveryReplay.delivery.deliveryHash, atomicDelivery.delivery.deliveryHash);
  const deliveredProduct = await (await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`)).json();
  assert.equal(deliveredProduct.selected, true);
  assert.equal(deliveredProduct.promoted, true);
  assert.equal(deliveredProduct.deliveryReady, true);
  assert.equal(deliveredProduct.published, false);
  assert.equal(deliveredProduct.projectionHash, atomicProduct.projectionHash);

  const manualPublicationScope = {
    ...atomicHumanScope,
    commitRef: atomicProduct.commitRef,
    contentProjectRef: atomicProduct.refs.contentProjectIdentityRef,
    materializedContentProjectRef: atomicProduct.refs.materializedContentProjectRef,
    platformRunRef: atomicProduct.refs.platformRunRef,
    candidateRef: atomicProduct.refs.candidateRef,
    promotionRef,
    promotedVersionRef: atomicPromotion.promotion.promotedVersionRef,
    deliveryRef: { id: atomicDelivery.delivery.id, hash: atomicDelivery.delivery.deliveryHash },
    manifestRef: atomicDelivery.delivery.manifestRef
  };
  const publicationPreviewUrl = `${atomicHumanBase}/manual-publication-preview`;
  const publicationConfirmUrl = `${atomicHumanBase}/manual-publication-confirm`;
  const flagOffPublicationStore = structuredClone(readStore());
  const flagOffPublicationResponse = await fetch(publicationPreviewUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(manualPublicationScope)
  });
  assert.equal(flagOffPublicationResponse.status, 404);
  assert.equal((await flagOffPublicationResponse.json()).code, "ATOMIC_MANUAL_PUBLICATION_DISABLED");
  assert.deepEqual(readStore(), flagOffPublicationStore, "flag-off Atomic publication must preserve legacy and Atomic stores");
  process.env.ATOMIC_MANUAL_PUBLICATION_V1 = "1";
  const beforePublicationPreview = structuredClone(readStore());
  const publicationPreviewResponse = await fetch(publicationPreviewUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(manualPublicationScope)
  });
  const publicationPreview = await publicationPreviewResponse.json();
  assert.equal(publicationPreviewResponse.status, 200, JSON.stringify(publicationPreview));
  assert.equal(publicationPreview.contract, "ControlledManualPublicationPreflight@1.0");
  assert.deepEqual(publicationPreview.request.deliveryRef, manualPublicationScope.deliveryRef);
  assert.deepEqual(publicationPreview.request.manifestRef, manualPublicationScope.manifestRef);
  assert.equal(publicationPreview.claims.platformApiPublicationPerformed, false);
  assert.deepEqual(readStore(), beforePublicationPreview, "manual publication preview must be read-only");
  const publicationEvidence = {
    ...manualPublicationScope, previewToken: publicationPreview.previewToken, idempotencyKey: "atomic-manual-publication-fixture",
    actorType: "user", actorId: "user:manual-publisher", method: "manual_platform_observation",
    confirmedAt: "2026-08-06T16:12:00.000Z", publishedAt: "2026-07-31T00:00:00.000Z",
    platformContentId: "64b123456789abcdef012345", platformUrl: "https://www.xiaohongshu.com/explore/64b123456789abcdef012345?source=fixture"
  };
  for (const [name, overrides, expectedCode] of [
    ["non-user", { actorType: "skill" }, "ATOMIC_MANUAL_PUBLICATION_USER_REQUIRED"],
    ["wrong-method", { method: "provider_response" }, "ATOMIC_MANUAL_PUBLICATION_METHOD_INVALID"],
    ["missing-evidence", { platformContentId: null, platformUrl: null }, "ATOMIC_MANUAL_PUBLICATION_EVIDENCE_REQUIRED"],
    ["invalid-id", { platformContentId: "not-a-note-id", platformUrl: null }, "ATOMIC_MANUAL_PUBLICATION_CONTENT_ID_INVALID"],
    ["wrong-domain", { platformUrl: "https://example.com/explore/64b123456789abcdef012345" }, "ATOMIC_MANUAL_PUBLICATION_URL_DOMAIN_INVALID"],
    ["url-id-mismatch", { platformUrl: "https://www.xiaohongshu.com/explore/64b123456789abcdef012346" }, "ATOMIC_MANUAL_PUBLICATION_URL_ID_MISMATCH"],
    ["future-time", { publishedAt: "2099-01-01T00:00:00.000Z" }, "ATOMIC_MANUAL_PUBLICATION_PUBLISHED_AT_INVALID"],
    ["mixed-legacy-project", { contentProjectRef: { id: "legacy-project", hash: "1".repeat(64) } }, "ATOMIC_MANUAL_PUBLICATION_PROJECT_MISMATCH"],
    ["wrong-delivery", { deliveryRef: { id: manualPublicationScope.deliveryRef.id, hash: "0".repeat(64) } }, "ATOMIC_MANUAL_PUBLICATION_DELIVERY_MISMATCH"]
  ]) {
    const beforeFailure = structuredClone(readStore());
    const response = await fetch(publicationConfirmUrl, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...publicationEvidence, ...overrides, idempotencyKey: `rejected-${name}` })
    });
    const failure = await response.json();
    assert.equal(failure.code, expectedCode, `${name}: ${JSON.stringify(failure)}`);
    assert.deepEqual(readStore(), beforeFailure, `${name} must preserve complete store equality`);
  }
  const validCrossPlatformReplayStore = structuredClone(readStore());
  const forgedCrossPlatformReplayStore = structuredClone(validCrossPlatformReplayStore);
  const forgedCrossPlatformReplayFact = forgedCrossPlatformReplayStore.unifiedAtomicManualPublications.find((item) => item.platform === "wechat");
  forgedCrossPlatformReplayFact.uploadEvidenceRef.hash = "0".repeat(64);
  delete forgedCrossPlatformReplayFact.factHash;
  forgedCrossPlatformReplayFact.factHash = hashUnifiedContent(forgedCrossPlatformReplayFact);
  writeStore(forgedCrossPlatformReplayStore);
  const beforeForgedCrossPlatformReplay = structuredClone(readStore());
  const forgedCrossPlatformReplay = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...publicationEvidence, idempotencyKey: "wechat-manual-publication" })
  });
  const forgedCrossPlatformReplayFailure = await forgedCrossPlatformReplay.json();
  assert.equal(forgedCrossPlatformReplay.status, 409, JSON.stringify(forgedCrossPlatformReplayFailure));
  assert.equal(forgedCrossPlatformReplayFailure.code, "ATOMIC_MANUAL_PUBLICATION_WECHAT_UPLOAD_CLOSURE_INVALID");
  assert.deepEqual(readStore(), beforeForgedCrossPlatformReplay, "correctly rehashed cross-platform replay forgery must be zero-write");
  writeStore(validCrossPlatformReplayStore);
  const beforeCrossPlatformKeyConflict = structuredClone(readStore());
  const crossPlatformKeyConflict = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...publicationEvidence, idempotencyKey: "wechat-manual-publication" })
  });
  const crossPlatformKeyConflictFailure = await crossPlatformKeyConflict.json();
  assert.equal(crossPlatformKeyConflict.status, 409, JSON.stringify(crossPlatformKeyConflictFailure));
  assert.equal(crossPlatformKeyConflictFailure.code, "ATOMIC_MANUAL_PUBLICATION_IDEMPOTENCY_SCOPE_CONFLICT");
  assert.deepEqual(readStore(), beforeCrossPlatformKeyConflict, "cross-platform idempotency key conflict must be zero-write");
  const beforePublication = structuredClone(readStore());
  const publicationConfirmResponse = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(publicationEvidence)
  });
  const publicationResult = await publicationConfirmResponse.json();
  assert.equal(publicationConfirmResponse.status, 201, JSON.stringify(publicationResult));
  assert.equal(publicationResult.publication.contract, "ControlledManualPublication@1.0");
  assert.equal(publicationResult.publication.canonicalPlatformContentId, "64b123456789abcdef012345");
  assert.equal(publicationResult.publication.canonicalPlatformUrl, "https://www.xiaohongshu.com/explore/64b123456789abcdef012345");
  assert.deepEqual(publicationResult.publication.claims, { platformApiPublicationPerformed: false, humanPublicationConfirmed: true });
  const afterPublication = readStore();
  const publicationChangedKeys = [...new Set([...Object.keys(beforePublication), ...Object.keys(afterPublication)])]
    .filter((key) => JSON.stringify(beforePublication[key]) !== JSON.stringify(afterPublication[key])).sort();
  assert.deepEqual(publicationChangedKeys, ["unifiedAtomicManualPublications"], "publication success may append only the Atomic publication collection");
  assert.equal(afterPublication.contentPublications?.length || 0, beforePublication.contentPublications?.length || 0, "legacy Publication collection must remain unchanged");
  assert.equal(readStore().unifiedAtomicManualPublications.find((item) => item.id === publicationResult.publication.id)?.factHash, publicationResult.publication.factHash, "publication fact must survive persistent store reload");
  const replayResponse = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(publicationEvidence)
  });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.created, false);
  const replacementPublicationResponse = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...publicationEvidence, idempotencyKey: "atomic-manual-publication-replacement-fixture",
      platformContentId: "64b123456789abcdef012346", platformUrl: "https://www.xiaohongshu.com/explore/64b123456789abcdef012346"
    })
  });
  const replacementPublication = await replacementPublicationResponse.json();
  assert.equal(replacementPublicationResponse.status, 201, JSON.stringify(replacementPublication));
  assert.equal(replay.publication.factHash, publicationResult.publication.factHash);
  const conflictStore = structuredClone(readStore());
  const conflictResponse = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...publicationEvidence, publishedAt: "2026-08-06T16:09:00.000Z" })
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json()).code, "ATOMIC_MANUAL_PUBLICATION_IDEMPOTENCY_CONFLICT");
  assert.deepEqual(readStore(), conflictStore);
  const duplicateResponse = await fetch(publicationConfirmUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...publicationEvidence, idempotencyKey: "atomic-manual-publication-duplicate" })
  });
  assert.equal(duplicateResponse.status, 409);
  assert.equal((await duplicateResponse.json()).code, "ATOMIC_MANUAL_PUBLICATION_CONTENT_DUPLICATE");
  assert.deepEqual(readStore(), conflictStore);
  process.env.ATOMIC_EXACT_FEEDBACK_V1 = "1";
  const xhsFeedbackRequest = {
    workspaceId: publicationResult.publication.workspaceId, companyId: publicationResult.publication.companyId,
    accountId: publicationResult.publication.accountId,
    publicationRef: { id: publicationResult.publication.id, hash: publicationResult.publication.factHash },
    platformContentId: publicationResult.publication.canonicalPlatformContentId,
    platformUrl: publicationResult.publication.canonicalPlatformUrl
  };
  const xhsFeedbackBase = atomicHumanBase;
  const xhsFeedbackPreviewResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-preview`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsFeedbackRequest)
  });
  const xhsFeedbackPreview = await xhsFeedbackPreviewResponse.json();
  assert.equal(xhsFeedbackPreviewResponse.status, 200, JSON.stringify(xhsFeedbackPreview));
  const xhsFeedback72h = {
    ...xhsFeedbackRequest, previewToken: xhsFeedbackPreview.previewToken, requestHash: xhsFeedbackPreview.requestHash,
    idempotencyKey: "xhs-feedback-72h-full-closure", actorType: "user", actorId: "user:xhs-analyst",
    measurementWindow: { label: "72h", startedAt: "2026-07-31T00:00:00.000Z", endedAt: "2026-08-03T00:00:00.000Z" },
    cutoffAt: "2026-08-03T00:00:00.000Z", collectedAt: "2026-08-03T01:00:00.000Z",
    source: { kind: "manual_entry", evidenceRef: { id: "xhs-feedback-evidence:72h", hash: "6".repeat(64) } },
    metrics: { views: 2400, likes: 160, saves: 75, comments: 19 }
  };
  const mislabeledWindowStore = structuredClone(readStore());
  const mislabeledWindow = structuredClone(xhsFeedback72h);
  mislabeledWindow.idempotencyKey = "xhs-feedback-mislabeled-window";
  mislabeledWindow.measurementWindow.endedAt = "2026-08-02T23:00:00.000Z";
  const mislabeledWindowResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mislabeledWindow)
  });
  assert.equal(mislabeledWindowResponse.status, 400);
  assert.equal((await mislabeledWindowResponse.json()).code, "ATOMIC_EXACT_FEEDBACK_WINDOW_DURATION_INVALID");
  assert.deepEqual(readStore(), mislabeledWindowStore, "mislabeled XHS window must be zero-write");
  const xhsFeedbackResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsFeedback72h)
  });
  const xhsFeedback = await xhsFeedbackResponse.json();
  assert.equal(xhsFeedbackResponse.status, 201, JSON.stringify(xhsFeedback));
  const atomicFeedbackWorkspaceStore = structuredClone(readStore());
  const atomicFeedbackWorkspaceResponse = await fetch(`${baseUrl}/content-agent/feedback`);
  const atomicFeedbackWorkspace = await atomicFeedbackWorkspaceResponse.json();
  assert.equal(atomicFeedbackWorkspaceResponse.status, 200, JSON.stringify(atomicFeedbackWorkspace));
  assert.equal(atomicFeedbackWorkspace.schemaVersion, "2.2");
  assert.equal(atomicFeedbackWorkspace.sourceSummary.authority, "unified_atomic");
  assert.ok(atomicFeedbackWorkspace.sourceSummary.atomicPublicationCount >= 2);
  assert.equal(atomicFeedbackWorkspace.sourceSummary.atomicWriteAuthorized, false);
  assert.equal(atomicFeedbackWorkspace.sourceSummary.strategyMutationAuthorized, false);
  const atomicXhsOutcome = atomicFeedbackWorkspace.outcomes.find((item) => item.publicationId === publicationResult.publication.id);
  const atomicWechatOutcome = atomicFeedbackWorkspace.outcomes.find((item) => item.publicationId === wechatPublication.publication.id);
  assert.equal(atomicXhsOutcome.attribution.authority, "unified_atomic");
  assert.equal(atomicXhsOutcome.latestObservedPerformanceSnapshotId, xhsFeedback.snapshot.id);
  assert.equal(atomicWechatOutcome.attribution.authority, "unified_atomic");
  assert.equal(atomicWechatOutcome.latestObservedPerformanceSnapshotId, wechat7d.snapshot.id);
  const projectedAtomicPublications = projectAtomicFeedbackPublications(atomicFeedbackWorkspaceStore, {
    normalizeSnapshot: normalizePerformanceSnapshot,
    featureFlags: { atomicPublicationLifecycleV1: false }
  });
  assert.equal(projectedAtomicPublications.find((item) => item.id === publicationResult.publication.id).latestMetrics.views, 2400);
  assert.equal(projectedAtomicPublications.find((item) => item.id === wechatPublication.publication.id).latestMetrics.views, wechat7d.snapshot.metrics.reads);
  assert.deepEqual(readStore(), atomicFeedbackWorkspaceStore, "atomic feedback workspace projection must be read-only");
  const atomicHistoryResponse = await fetch(`${baseUrl}/content-agent/history`);
  const atomicHistory = await atomicHistoryResponse.json();
  assert.equal(atomicHistoryResponse.status, 200, JSON.stringify(atomicHistory));
  assert.equal(atomicHistory.schemaVersion, "1.4");
  assert.ok(atomicHistory.sourceSummary.atomic >= 2);
  assert.ok(atomicHistory.sourceSummary.atomicPublished >= 2);
  const atomicXhsHistory = atomicHistory.items.find((item) => item.exactRefs?.commitRef?.id === publicationResult.publication.commitRef.id);
  const atomicWechatHistory = atomicHistory.items.find((item) => item.exactRefs?.commitRef?.id === wechatPublication.publication.commitRef.id);
  assert.equal(atomicXhsHistory.authority, "unified_atomic");
  assert.equal(atomicXhsHistory.unifiedProjectId, publicationResult.publication.contentProjectRef.id);
  assert.equal(atomicXhsHistory.platform, "xiaohongshu");
  assert.equal(atomicXhsHistory.publication.authority, "unified_atomic");
  assert.equal(atomicWechatHistory.authority, "unified_atomic");
  assert.equal(atomicWechatHistory.unifiedProjectId, wechatPublication.publication.contentProjectRef.id);
  assert.equal(atomicWechatHistory.platform, "wechat");
  assert.deepEqual(readStore(), atomicFeedbackWorkspaceStore, "atomic history projection must be read-only");
  const mixedFeedbackStore = structuredClone(atomicFeedbackWorkspaceStore);
  mixedFeedbackStore.contentTasks ||= [];
  mixedFeedbackStore.contentTasks.push({
    id: "legacy-task-shadowing-atomic-xhs", accountId: publicationResult.publication.accountId,
    companyId: publicationResult.publication.companyId, socialAccountId: publicationResult.publication.accountId,
    platform: publicationResult.publication.platform, status: "published", ideaTitle: "Legacy shadow",
    currentContent: { post_copy: { recommended_title: "Legacy shadow", body: "Legacy shadow body" } },
    createdAt: publicationResult.publication.publishedAt
  });
  mixedFeedbackStore.contentPublications ||= [];
  mixedFeedbackStore.contentPublications.push({
    id: "legacy-publication-shadowing-atomic-xhs",
    contentTaskId: "legacy-task-shadowing-atomic-xhs",
    accountId: publicationResult.publication.accountId,
    socialAccountId: publicationResult.publication.accountId,
    platform: publicationResult.publication.platform,
    status: "published", publishedAt: publicationResult.publication.publishedAt,
    url: publicationResult.publication.canonicalPlatformUrl,
    platformContentId: publicationResult.publication.canonicalPlatformContentId,
    attribution: {}, metricHistory: []
  });
  writeStore(mixedFeedbackStore);
  const mixedFeedbackWorkspaceResponse = await fetch(`${baseUrl}/content-agent/feedback`);
  const mixedFeedbackWorkspace = await mixedFeedbackWorkspaceResponse.json();
  assert.equal(mixedFeedbackWorkspaceResponse.status, 200, JSON.stringify(mixedFeedbackWorkspace));
  assert.equal(mixedFeedbackWorkspace.sourceSummary.authority, "unified_atomic");
  assert.equal(mixedFeedbackWorkspace.sourceSummary.deduplicatedLegacyCount, 1);
  assert.equal(mixedFeedbackWorkspace.outcomes.some((item) => item.publicationId === "legacy-publication-shadowing-atomic-xhs"), false);
  const mixedHistoryResponse = await fetch(`${baseUrl}/content-agent/history`);
  const mixedHistory = await mixedHistoryResponse.json();
  assert.equal(mixedHistoryResponse.status, 200, JSON.stringify(mixedHistory));
  assert.equal(mixedHistory.sourceSummary.deduplicatedLegacy, 1);
  assert.equal(mixedHistory.items.some((item) => item.contentTaskId === "legacy-task-shadowing-atomic-xhs"), false);
  writeStore(atomicFeedbackWorkspaceStore);
  const validXhsFeedbackStore = structuredClone(readStore());
  for (const [label, mutate, expectedCode] of [
    ["temporal-order", (fact) => { fact.publishedAt = "2026-08-06T16:13:00.000Z"; }, "ATOMIC_MANUAL_PUBLICATION_FACT_INVALID"],
    ["recorded-before-confirmed", (fact) => { fact.recordedAt = "2026-08-06T16:11:00.000Z"; }, "ATOMIC_MANUAL_PUBLICATION_FACT_INVALID"],
    ["deterministic-id", (fact) => { fact.id = "atomic-manual-publication:forged-id"; }, "ATOMIC_MANUAL_PUBLICATION_FACT_INVALID"],
    ["semantic-request-hash", (fact) => {
      fact.requestHash = "a".repeat(64);
      fact.id = `atomic-manual-publication:${hashUnifiedContent({ requestHash: fact.requestHash, idempotencyKey: fact.idempotencyKey }).slice(0, 24)}`;
    }, "ATOMIC_MANUAL_PUBLICATION_STORED_CLOSURE_INVALID"]
  ]) {
    const forged = structuredClone(validXhsFeedbackStore);
    const fact = forged.unifiedAtomicManualPublications.find((item) => item.id === publicationResult.publication.id);
    mutate(fact); delete fact.factHash; fact.factHash = hashUnifiedContent(fact); writeStore(forged);
    const forgedRequest = { ...xhsFeedbackRequest, publicationRef: { id: fact.id, hash: fact.factHash } };
    const before = structuredClone(readStore());
    const response = await fetch(`${xhsFeedbackBase}/exact-feedback-preview`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(forgedRequest)
    });
    assert.equal(response.status, 409, label);
    assert.equal((await response.json()).code, expectedCode, label);
    assert.deepEqual(readStore(), before, `${label} correctly rehashed Publication forgery must be zero-write`);
    writeStore(validXhsFeedbackStore);
  }
  const corruptedProjectionStore = structuredClone(validXhsFeedbackStore);
  const corruptedSnapshot = corruptedProjectionStore.unifiedAtomicPublicationMetricSnapshots.find((item) => item.id === xhsFeedback.snapshot.id);
  corruptedSnapshot.metrics.views = -1;
  delete corruptedSnapshot.snapshotHash; corruptedSnapshot.snapshotHash = hashUnifiedContent(corruptedSnapshot);
  writeStore(corruptedProjectionStore);
  const beforeCorruptedProjection = structuredClone(readStore());
  const corruptedProjectionResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsFeedbackRequest)
  });
  assert.equal(corruptedProjectionResponse.status, 409);
  assert.equal((await corruptedProjectionResponse.json()).code, "ATOMIC_EXACT_FEEDBACK_SNAPSHOT_INVALID");
  assert.deepEqual(readStore(), beforeCorruptedProjection, "corrupted relevant Snapshot projection must fail explicitly and remain zero-write");
  writeStore(validXhsFeedbackStore);
  process.env.ATOMIC_EXACT_FEEDBACK_V1 = "0";
  const publishedProduct = await (await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`)).json();
  assert.equal(publishedProduct.artifactState, "published");
  assert.equal(publishedProduct.deliveryReady, true);
  assert.equal(publishedProduct.published, true);
  assert.equal(publishedProduct.xiaohongshu.published, true);
  assert.equal(publishedProduct.projectionHash, atomicProduct.projectionHash);
  const patchStore = structuredClone(readStore());
  const patchResponse = await fetch(publicationConfirmUrl, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ publishedAt: "2026-08-06T16:08:00.000Z" })
  });
  assert.equal(patchResponse.status, 405, "Atomic publication PATCH must remain unavailable");
  assert.deepEqual(readStore(), patchStore);

  const repairedStore = readStore();
  const repairedRevision = structuredClone(repairedStore.unifiedContentXhsPageRevisionFacts.find((item) => item.contentProjectRef.id === atomicProduct.refs.contentProjectIdentityRef.id
    && item.contentProjectRef.hash === atomicProduct.refs.contentProjectIdentityRef.hash));
  repairedRevision.id = `${repairedRevision.id}:human-selection-stale`;
  repairedRevision.revision += 1;
  delete repairedRevision.revisionHash;
  repairedRevision.revisionHash = hashUnifiedContent(repairedRevision);
  repairedStore.unifiedContentXhsPageRevisionFacts.push(repairedRevision);
  writeStore(repairedStore);
  const staleReviewStateResponse = await fetch(`${atomicHumanBase}/review-state?${new URLSearchParams(atomicHumanScope)}`);
  const staleReviewState = await staleReviewStateResponse.json();
  assert.equal(staleReviewStateResponse.status, 200, JSON.stringify(staleReviewState));
  assert.equal(staleReviewState.artifactApproved, false);
  assert.equal(staleReviewState.editorialReviewPassed, false);
  assert.equal(staleReviewState.selected, false);
  assert.equal(staleReviewState.stale, true);
  const staleSelectedProduct = await (await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}`)).json();
  assert.equal(staleSelectedProduct.reviewState.selected, false);
  assert.equal(staleSelectedProduct.reviewState.stale, true);
  assert.equal(staleSelectedProduct.promoted, false);
  assert.equal(staleSelectedProduct.deliveryReady, false);
  assert.equal(staleSelectedProduct.published, false);
  const stalePromotionStore = structuredClone(readStore());
  const stalePromotionResponse = await fetch(`${atomicHumanBase}/promotion-preview`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(atomicHumanScope)
  });
  assert.equal(stalePromotionResponse.status, 409);
  assert.deepEqual(readStore(), stalePromotionStore, "new Page Revision must stale Promotion and Delivery authority without writes");
  process.env.CONTENT_PROMOTION_V1 = "0";
  process.env.ATOMIC_MANUAL_PUBLICATION_V1 = "0";
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "0";
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "0";
  process.env.XHS_INTEGRATED_PAGE_DESIGN_SKILL = "0";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_AUTHORITY_V1 = "0";
  process.env.UNIFIED_CONTENT_XHS_PROVIDER_PLAN_V1 = "0";
  process.env.XHS_INTEGRATED_PAGE_DIRECTION_REVIEW = "0";
  process.env.XHS_INTEGRATED_PAGE_PROVIDER_COMPILER = "0";
  process.env.XHS_VISUAL_ASSET_REGISTRY = "0";
  process.env.XHS_INTEGRATED_PAGE_SKILL_EXECUTION_PLAN = "0";

  const noReviewInputsRequest = structuredClone(request);
  noReviewInputsRequest.requestId = "request_fixture_without_review_inputs";
  noReviewInputsRequest.orchestrationInput.project.id = "content_project_fixture_without_review_inputs";
  delete noReviewInputsRequest.reviewInputs;
  const noReviewInputsResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(noReviewInputsRequest) });
  const noReviewInputs = await noReviewInputsResponse.json();
  assert.equal(noReviewInputsResponse.status, 201, JSON.stringify(noReviewInputs));
  assert.equal(noReviewInputs.callerReviewInputsPolicy, "not_supplied");
  assert.ok(noReviewInputs.platforms.every((item) => item.reviewInput.source === "verified_skill_output_facts" && item.candidateRefs.length === 1));

  const duplicate = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, "UNIFIED_CONTENT_REQUEST_ALREADY_EXISTS");
  const runWechatStopCase = async ({ id, writerEnvelope = null, reviewEnvelope = null, planEnvelope = null, expectedStep, expectedCapability }) => {
    const reached = { writer: 0, title: 0, review: 0, plan: 0 };
    setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
      const capability = skillRequest?.skill_runtime?.skill_name;
      if (capability === "write-wechat-article") {
        reached.writer += 1;
        if (writerEnvelope) return { mode: "fixture", data: structuredClone(writerEnvelope) };
      }
      if (capability === "generate-platform-titles" && findNested(skillRequest, (value) => value?.stage === "final_after_body")?.platform === "wechat_official_account") reached.title += 1;
      if (capability === "review-wechat-article") {
        reached.review += 1;
        if (reviewEnvelope) return { mode: "fixture", data: structuredClone(reviewEnvelope) };
      }
      if (capability === "plan-wechat-images") {
        reached.plan += 1;
        if (planEnvelope) return { mode: "fixture", data: structuredClone(planEnvelope) };
      }
      return fixtureGenerateText(skillRequest);
    } });
    const stopRequest = structuredClone(request);
    stopRequest.requestId = `request_fixture_wechat_${id}`;
    stopRequest.orchestrationInput.project.id = `content_project_fixture_wechat_${id}`;
    const response = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(stopRequest) });
    const failure = await response.json();
    assert.equal(response.status, 400, JSON.stringify(failure));
    assert.equal(failure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
    assert.deepEqual(failure.recovery, { stage: expectedStep === "platform_writer" ? "writer" : "review_render", platform: "wechat", stepId: expectedStep, recoverableFrom: expectedStep });
    assert.equal(reached[expectedCapability], 1, `${id} must invoke the failing WeChat Skill once`);
    if (expectedStep === "platform_writer") assert.deepEqual({ title: reached.title, review: reached.review, plan: reached.plan }, { title: 0, review: 0, plan: 0 }, `${id} must stop before all WeChat downstream Skills`);
    assert.equal(readStore().unifiedContentProjects.length, 2, `${id} must not persist a product snapshot`);
    return reached;
  };
  await runWechatStopCase({
    id: "weak_writer", expectedStep: "platform_writer", expectedCapability: "writer",
    writerEnvelope: { status: "success", data: { platform: "wechat_official_account", title_candidates: [], recommended_title: "x", outline: [], article_markdown: "x", preflight_checks: [] }, warnings: [], blocked_reasons: [] }
  });
  await runWechatStopCase({ id: "writer_needs_review", expectedStep: "platform_writer", expectedCapability: "writer", writerEnvelope: { status: "needs_review", data: {}, warnings: [], blocked_reasons: [] } });
  await runWechatStopCase({ id: "writer_missing_envelope", expectedStep: "platform_writer", expectedCapability: "writer", writerEnvelope: { status: "success", data: wechatWriterOutput() } });
  const reviewNeedsReview = await runWechatStopCase({ id: "review_needs_review", expectedStep: "wechat_content_review", expectedCapability: "review", reviewEnvelope: { status: "needs_review", data: {}, warnings: [], blocked_reasons: [] } });
  assert.equal(reviewNeedsReview.plan, 0, "non-success review must stop before image-plan invocation");
  for (const [id, reviewData] of [
    ["review_block", { decision: "block", findings: [{ finding_id: "WR01", category: "fact", location: "W1", severity: "blocker", issue: "fixture issue", required_action: "fixture action", claim_ids: ["F001"] }], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] }],
    ["review_fact_recheck", { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: true, publish_time_checks: [] }],
    ["review_report_patch", { decision: "pass", findings: [], patches: [{ target: "W1", before: "", after: "fixture", reason: "fixture" }], changes: [], fact_recheck_required: false, publish_time_checks: [] }]
  ]) {
    const reached = await runWechatStopCase({ id, expectedStep: "wechat_content_review", expectedCapability: "review", reviewEnvelope: { status: "success", data: reviewData, warnings: [], blocked_reasons: [] } });
    assert.equal(reached.plan, 0, `${id} must stop before image-plan invocation`);
  }
  const nonSuccessPlan = await runWechatStopCase({ id: "plan_needs_review", expectedStep: "image_plan", expectedCapability: "plan", planEnvelope: { status: "needs_review", data: {}, warnings: [], blocked_reasons: [] } });
  assert.equal(nonSuccessPlan.plan, 1);
  let nonSuccessWriterCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    if (skillRequest?.skill_runtime?.skill_name === "write-xhs-content") {
      nonSuccessWriterCalls += 1;
      return { mode: "fixture", data: { status: "needs_review", data: {}, warnings: [], blocked_reasons: [] } };
    }
    return fixtureGenerateText(skillRequest);
  } });
  const nonSuccessRequest = structuredClone(request);
  nonSuccessRequest.requestId = "request_fixture_writer_needs_review";
  nonSuccessRequest.orchestrationInput.project.id = "content_project_fixture_writer_needs_review";
  const nonSuccessResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nonSuccessRequest) });
  const nonSuccessFailure = await nonSuccessResponse.json();
  assert.equal(nonSuccessResponse.status, 400);
  assert.equal(nonSuccessFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.equal(nonSuccessWriterCalls, 1, "non-success writer output must stop after its first adapter attempt");
  assert.equal(readStore().unifiedContentProjects.length, 2, "non-success writer output must not persist a product snapshot");
  let nestedWriterCalls = 0;
  let nestedWriterDownstreamCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    const capability = skillRequest?.skill_runtime?.skill_name;
    if (capability === "write-xhs-content") {
      nestedWriterCalls += 1;
      const invalid = xhsWriterOutput();
      delete invalid.traceability;
      delete invalid.preflight_checks;
      return { mode: "fixture", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] } };
    }
    if (capability === "generate-platform-titles") nestedWriterDownstreamCalls += 1;
    return fixtureGenerateText(skillRequest);
  } });
  const nestedWriterRequest = structuredClone(request);
  nestedWriterRequest.requestId = "request_fixture_writer_nested_item_invalid";
  nestedWriterRequest.orchestrationInput.project.id = "content_project_fixture_writer_nested_item_invalid";
  const nestedWriterResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nestedWriterRequest) });
  const nestedWriterFailure = await nestedWriterResponse.json();
  assert.equal(nestedWriterResponse.status, 400, JSON.stringify(nestedWriterFailure));
  assert.equal(nestedWriterFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(nestedWriterFailure.recovery, { stage: "writer", platform: "xiaohongshu", stepId: "platform_writer", recoverableFrom: "platform_writer" });
  assert.equal(nestedWriterCalls, 1, "missing Writer evidence roots must stop after one Writer invocation");
  assert.equal(nestedWriterDownstreamCalls, 0, "missing Writer evidence roots must stop before title generation");
  assert.equal(JSON.stringify(nestedWriterFailure).includes("TypeError"), false, "API failure must expose only the coded contract failure");
  assert.equal(readStore().unifiedContentProjects.length, 2, "missing Writer evidence roots must not persist a product snapshot");
  for (const [id, mutate] of [
    ["missing", (output) => { delete output.matrix_coordination.shared_campaign_topic_id; }],
    ["null", (output) => { output.matrix_coordination.shared_campaign_topic_id = null; }],
    ["non_string", (output) => { output.matrix_coordination.shared_campaign_topic_id = { private: true }; }]
  ]) {
    let writerCalls = 0;
    let downstreamCalls = 0;
    setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
      const capability = skillRequest?.skill_runtime?.skill_name;
      if (capability === "write-xhs-content") {
        writerCalls += 1;
        const invalid = xhsWriterOutput();
        mutate(invalid);
        return { mode: "fixture", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] } };
      }
      if (capability === "generate-platform-titles") downstreamCalls += 1;
      return fixtureGenerateText(skillRequest);
    } });
    const matrixRequest = structuredClone(request);
    matrixRequest.requestId = `request_fixture_xhs_campaign_${id}`;
    matrixRequest.orchestrationInput.project.id = `content_project_fixture_xhs_campaign_${id}`;
    const response = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(matrixRequest) });
    const failure = await response.json();
    assert.equal(response.status, 400, JSON.stringify(failure));
    assert.equal(failure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
    assert.deepEqual(failure.recovery, { stage: "writer", platform: "xiaohongshu", stepId: "platform_writer", recoverableFrom: "platform_writer" });
    assert.equal(writerCalls, 1, `${id} campaign value must fail after one XHS Writer invocation with zero retry`);
    assert.equal(downstreamCalls, 0, `${id} campaign value must stop before XHS title generation`);
    assert.equal(readStore().unifiedContentProjects.length, 2, `${id} campaign value must not persist a product snapshot`);
  }
  let semanticWriterCalls = 0;
  let semanticWriterDownstreamCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    const capability = skillRequest?.skill_runtime?.skill_name;
    if (capability === "write-xhs-content") {
      semanticWriterCalls += 1;
      const invalid = xhsWriterOutput();
      invalid.image_specs[0].asset_id = "PRIVATE_SEMANTIC_ASSET_MISMATCH";
      invalid.preflight_checks = invalid.preflight_checks.filter((item) => item.check !== "claim_traceability");
      return { mode: "fixture", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] } };
    }
    if (capability === "generate-platform-titles") semanticWriterDownstreamCalls += 1;
    return fixtureGenerateText(skillRequest);
  } });
  const semanticWriterRequest = structuredClone(request);
  semanticWriterRequest.requestId = "request_fixture_writer_semantic_gate";
  semanticWriterRequest.orchestrationInput.project.id = "content_project_fixture_writer_semantic_gate";
  const semanticWriterResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(semanticWriterRequest) });
  const semanticWriterFailure = await semanticWriterResponse.json();
  assert.equal(semanticWriterResponse.status, 400, JSON.stringify(semanticWriterFailure));
  assert.equal(semanticWriterFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(semanticWriterFailure.recovery, { stage: "writer", platform: "xiaohongshu", stepId: "platform_writer", recoverableFrom: "platform_writer" });
  assert.equal(semanticWriterCalls, 1, "semantic writer failure must not retry or synthesize a replacement output");
  assert.equal(semanticWriterDownstreamCalls, 0, "semantic writer failure must stop before title generation");
  assert.equal(JSON.stringify(semanticWriterFailure).includes("PRIVATE_SEMANTIC_ASSET_MISMATCH"), false, "API failure must expose safe paths only");
  assert.equal(readStore().unifiedContentProjects.length, 2, "semantic writer failure must not persist a candidate snapshot");
  let dnaMismatchWriterCalls = 0;
  let dnaMismatchTitleCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    const capability = skillRequest?.skill_runtime?.skill_name;
    if (capability === "write-xhs-content") {
      dnaMismatchWriterCalls += 1;
      const invalid = xhsWriterOutput();
      invalid.deck.design_dna_version = "wrong_dna";
      for (const spec of invalid.image_specs) spec.design_dna_version = "wrong_dna";
      return { mode: "fixture", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] } };
    }
    if (capability === "generate-platform-titles") dnaMismatchTitleCalls += 1;
    return fixtureGenerateText(skillRequest);
  } });
  const dnaMismatchRequest = structuredClone(request);
  dnaMismatchRequest.requestId = "request_fixture_writer_design_dna_mismatch";
  dnaMismatchRequest.orchestrationInput.project.id = "content_project_fixture_writer_design_dna_mismatch";
  const dnaMismatchResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(dnaMismatchRequest) });
  const dnaMismatchFailure = await dnaMismatchResponse.json();
  assert.equal(dnaMismatchResponse.status, 400, JSON.stringify(dnaMismatchFailure));
  assert.equal(dnaMismatchFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(dnaMismatchFailure.recovery, { stage: "writer", platform: "xiaohongshu", stepId: "platform_writer", recoverableFrom: "platform_writer" });
  assert.equal(dnaMismatchWriterCalls, 1, "Design DNA output mismatch must stop after one Writer invocation");
  assert.equal(dnaMismatchTitleCalls, 0, "Design DNA output mismatch must stop before title generation");
  assert.equal(readStore().unifiedContentProjects.length, 2, "Design DNA output mismatch must not persist a product snapshot");
  let nonSuccessTitleCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    if (skillRequest?.skill_runtime?.skill_name === "generate-platform-titles") {
      nonSuccessTitleCalls += 1;
      return { mode: "fixture", data: { status: "needs_review", data: {}, warnings: [], blocked_reasons: [] } };
    }
    return fixtureGenerateText(skillRequest);
  } });
  const nonSuccessTitleRequest = structuredClone(request);
  nonSuccessTitleRequest.requestId = "request_fixture_title_needs_review";
  nonSuccessTitleRequest.orchestrationInput.project.id = "content_project_fixture_title_needs_review";
  const nonSuccessTitleResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nonSuccessTitleRequest) });
  const nonSuccessTitleFailure = await nonSuccessTitleResponse.json();
  assert.equal(nonSuccessTitleResponse.status, 400);
  assert.equal(nonSuccessTitleFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(nonSuccessTitleFailure.recovery, { stage: "review_render", platform: "xiaohongshu", stepId: "title", recoverableFrom: "title" });
  assert.equal(nonSuccessTitleCalls, 1, "non-success title output must stop after its first adapter attempt");
  assert.equal(readStore().unifiedContentProjects.length, 2, "non-success title output must not persist a product snapshot");
  let invalidTitleCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    if (skillRequest?.skill_runtime?.skill_name === "generate-platform-titles") {
      invalidTitleCalls += 1;
      const invalid = titleOutput("xiaohongshu");
      invalid.recommendations.balanced = "MISSING";
      return { mode: "fixture", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] } };
    }
    return fixtureGenerateText(skillRequest);
  } });
  const invalidTitleRequest = structuredClone(request);
  invalidTitleRequest.requestId = "request_fixture_title_dangling_ref";
  invalidTitleRequest.orchestrationInput.project.id = "content_project_fixture_title_dangling_ref";
  const invalidTitleResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invalidTitleRequest) });
  assert.equal(invalidTitleResponse.status, 400);
  assert.equal((await invalidTitleResponse.json()).code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.equal(invalidTitleCalls, 1, "invalid title output must stop after its first adapter attempt");
  assert.equal(readStore().unifiedContentProjects.length, 2, "invalid title output must not persist a product snapshot");
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    if (skillRequest?.skill_runtime?.skill_name === "write-xhs-content") {
      return { mode: "fixture", data: { status: "success", data: { id: "invalid_writer", candidates: [] }, warnings: [], blocked_reasons: [] } };
    }
    return fixtureGenerateText(skillRequest);
  } });
  const invalidContractRequest = structuredClone(request);
  invalidContractRequest.requestId = "request_fixture_invalid_contract";
  invalidContractRequest.orchestrationInput.project.id = "content_project_fixture_invalid_contract";
  const invalidContract = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invalidContractRequest) });
  const invalidContractFailure = await invalidContract.json();
  assert.equal(invalidContract.status, 400);
  assert.equal(invalidContractFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(invalidContractFailure.recovery, { stage: "writer", platform: "xiaohongshu", stepId: "platform_writer", recoverableFrom: "platform_writer" });
  assert.equal(readStore().unifiedContentProjects.length, 2, "invalid Skill contracts must not persist partial projects");
  let invalidOutlineCalls = 0;
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    invalidOutlineCalls += 1;
    if (skillRequest?.skill_runtime?.skill_name === "generate-content-outline") {
      const invalid = outlineOutput("xiaohongshu");
      delete invalid.sections[1].heading;
      invalid.topic = "PRIVATE_FIXTURE_CONTENT_MUST_NOT_ESCAPE";
      return { mode: "fixture", data: { status: "ready", data: invalid, warnings: [], blocked_reasons: [] } };
    }
    return fixtureGenerateText(skillRequest);
  } });
  const invalidOutlineRequest = structuredClone(request);
  invalidOutlineRequest.requestId = "request_fixture_invalid_outline_contract";
  invalidOutlineRequest.orchestrationInput.project.id = "content_project_fixture_invalid_outline_contract";
  const invalidOutlineResponse = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invalidOutlineRequest) });
  const invalidOutlineFailure = await invalidOutlineResponse.json();
  assert.equal(invalidOutlineResponse.status, 400);
  assert.equal(invalidOutlineFailure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(invalidOutlineFailure.recovery, { stage: "outline", platform: "xiaohongshu", stepId: "outline", recoverableFrom: "outline" });
  assert.equal(invalidOutlineCalls, 2, "adapter path must call the master and failing outline exactly once each");
  assert.equal(JSON.stringify(invalidOutlineFailure).includes("PRIVATE_FIXTURE_CONTENT_MUST_NOT_ESCAPE"), false);
  assert.equal(readStore().unifiedContentProjects.length, 2, "invalid outline contracts must not persist partial projects");
  setUnifiedContentServerDependenciesForTest({ generateText: async (skillRequest) => {
    if (skillRequest?.skill_runtime?.skill_name === "generate-content-outline") throw Object.assign(new Error("fixture outline failure private detail"), { code: "FIXTURE_OUTLINE_FAILED" });
    return fixtureGenerateText(skillRequest);
  } });
  const failedRequest = structuredClone(request);
  failedRequest.requestId = "request_fixture_failure";
  failedRequest.orchestrationInput.project.id = "content_project_fixture_failure";
  const failed = await fetch(`${baseUrl}/unified-content-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(failedRequest) });
  const failure = await failed.json();
  assert.equal(failed.status, 400);
  assert.equal(failure.code, "UNIFIED_ORCHESTRATION_STAGE_FAILED");
  assert.deepEqual(failure.recovery, { stage: "outline", platform: "xiaohongshu", stepId: "outline", recoverableFrom: "outline" });
  assert.equal(JSON.stringify(failure).includes("private detail"), false);

  process.env.ATOMIC_PUBLICATION_LIFECYCLE_V1 = "1";
  process.env.ATOMIC_MANUAL_PUBLICATION_V1 = "1";
  process.env.ATOMIC_EXACT_FEEDBACK_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_PRODUCT_V1 = "1";
  process.env.UNIFIED_CONTENT_ARTIFACTS_V1 = "1";
  process.env.CONTENT_PROMOTION_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PRODUCT_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_ARTIFACT_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_HUMAN_SELECTION_V1 = "1";
  process.env.UNIFIED_CONTENT_ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_V1 = "1";
  const xhsLifecycleBase = `${atomicHumanBase}/publication`;
  const xhsLifecycleScope = {
    ...manualPublicationScope,
    publicationRef: { id: publicationResult.publication.id, hash: publicationResult.publication.factHash },
    platformContentId: publicationResult.publication.canonicalPlatformContentId
  };
  const initialXhsHead = structuredClone(xhsLifecycleScope.publicationRef);
  const correctionPayload = {
    ...xhsLifecycleScope, expectedLifecycleHeadRef: initialXhsHead, idempotencyKey: "xhs-publication-correction-fixture",
    actorType: "user", actorId: "user:lifecycle-reviewer", method: "manual_platform_observation",
    observedAt: "2026-08-06T17:00:00.000Z", effectivePublishedAt: "2026-07-31T01:00:00.000Z",
    evidenceRefs: [{ id: "evidence:xhs-correction", hash: "a".repeat(64) }]
  };
  const correctionResponse = await fetch(`${xhsLifecycleBase}-correction`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(correctionPayload)
  });
  const correction = await correctionResponse.json();
  assert.equal(correctionResponse.status, 201, JSON.stringify(correction));
  assert.equal(correction.fact.contract, "ControlledPublicationCorrection@1.0");
  const correctionRef = { id: correction.fact.id, hash: correction.fact.factHash };
  const correctionReplay = await fetch(`${xhsLifecycleBase}-correction`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(correctionPayload)
  });
  assert.equal(correctionReplay.status, 200, JSON.stringify(await correctionReplay.json()));
  const beforeDuplicateCorrection = structuredClone(readStore());
  const duplicateCorrection = await fetch(`${xhsLifecycleBase}-correction`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...correctionPayload, idempotencyKey: "xhs-publication-correction-duplicate" })
  });
  assert.equal(duplicateCorrection.status, 409);
  assert.equal((await duplicateCorrection.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_DUPLICATE_SEMANTICS");
  assert.deepEqual(readStore(), beforeDuplicateCorrection, "duplicate lifecycle semantics must preserve complete store equality");
  const correctedFeedbackStateResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsFeedbackRequest)
  });
  const correctedFeedbackState = await correctedFeedbackStateResponse.json();
  assert.equal(correctedFeedbackStateResponse.status, 200, JSON.stringify(correctedFeedbackState));
  assert.equal(correctedFeedbackState.lifecycleClassifications.find((item) => item.snapshotRef.id === xhsFeedback.snapshot.id)?.classification,
    "invalid_before_effective_publication", "publication-time correction must reclassify, not rewrite, historical Snapshot evidence");
  const immutableHistoricalSnapshot = readStore().unifiedAtomicPublicationMetricSnapshots.find((item) => item.id === xhsFeedback.snapshot.id);
  assert.equal(immutableHistoricalSnapshot.snapshotHash, xhsFeedback.snapshot.snapshotHash);
  const boundSnapshotPreviewResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-preview`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsFeedbackRequest)
  });
  const boundSnapshotPreview = await boundSnapshotPreviewResponse.json();
  assert.equal(boundSnapshotPreviewResponse.status, 200, JSON.stringify(boundSnapshotPreview));
  const boundSnapshotResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsFeedbackRequest, previewToken: boundSnapshotPreview.previewToken, requestHash: boundSnapshotPreview.requestHash,
      idempotencyKey: "xhs-feedback-lifecycle-bound", actorType: "user", actorId: "user:xhs-analyst",
      measurementWindow: { label: "custom", startedAt: "2026-08-01T01:00:00.000Z", endedAt: "2026-08-01T02:00:00.000Z" },
      cutoffAt: "2026-08-01T02:00:00.000Z", collectedAt: "2026-08-01T02:01:00.000Z",
      source: { kind: "manual_entry", evidenceRef: { id: "xhs-feedback-evidence:lifecycle-bound", hash: "9".repeat(64) } },
      metrics: { views: 25, likes: 2 }
    })
  });
  const boundSnapshot = await boundSnapshotResponse.json();
  assert.equal(boundSnapshotResponse.status, 201, JSON.stringify(boundSnapshot));
  assert.equal(boundSnapshot.lifecycleBinding.contract, "PublicationMetricSnapshotLifecycleBinding@1.0");
  assert.equal(boundSnapshot.lifecycleBinding.classificationAtCapture, "valid_active");
  const beforeStaleLifecycleWrite = structuredClone(readStore());
  const staleTakedown = await fetch(`${xhsLifecycleBase}-takedown`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsLifecycleScope, expectedLifecycleHeadRef: initialXhsHead, idempotencyKey: "xhs-stale-takedown-fixture",
      actorType: "user", actorId: "user:lifecycle-reviewer", method: "manual_platform_observation",
      action: "unpublish", actionAttemptedAt: "2026-08-06T17:05:00.000Z", observedAt: "2026-08-06T17:06:00.000Z",
      outcome: "confirmed_removed", observedAvailability: "unavailable",
      evidenceRefs: [{ id: "evidence:xhs-takedown", hash: "b".repeat(64) }]
    })
  });
  assert.equal(staleTakedown.status, 409);
  assert.equal((await staleTakedown.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_HEAD_CONFLICT");
  assert.deepEqual(readStore(), beforeStaleLifecycleWrite, "stale lifecycle CAS must preserve complete store equality");
  const beforeContradictoryTakedown = structuredClone(readStore());
  const contradictoryTakedown = await fetch(`${xhsLifecycleBase}-takedown`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsLifecycleScope, expectedLifecycleHeadRef: correctionRef, idempotencyKey: "xhs-contradictory-takedown-fixture",
      actorType: "user", actorId: "user:lifecycle-reviewer", method: "manual_platform_observation",
      action: "unpublish", actionAttemptedAt: "2026-08-06T17:05:00.000Z", observedAt: "2026-08-06T17:06:00.000Z",
      outcome: "failed", observedAvailability: "unavailable",
      evidenceRefs: [{ id: "evidence:xhs-contradictory-takedown", hash: "4".repeat(64) }]
    })
  });
  assert.equal(contradictoryTakedown.status, 409);
  assert.equal((await contradictoryTakedown.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  assert.deepEqual(readStore(), beforeContradictoryTakedown, "correctly hashed contradictory takedown request must be zero-write");

  const takedownPayload = {
    ...xhsLifecycleScope, expectedLifecycleHeadRef: correctionRef, idempotencyKey: "xhs-publication-takedown-fixture",
    actorType: "user", actorId: "user:lifecycle-reviewer", method: "manual_platform_observation",
    action: "unpublish", actionAttemptedAt: "2026-08-06T17:05:00.000Z", observedAt: "2026-08-06T17:06:00.000Z",
    outcome: "confirmed_removed", observedAvailability: "unavailable",
    evidenceRefs: [{ id: "evidence:xhs-takedown", hash: "b".repeat(64) }]
  };
  const takedownResponse = await fetch(`${xhsLifecycleBase}-takedown`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(takedownPayload)
  });
  const takedown = await takedownResponse.json();
  assert.equal(takedownResponse.status, 201, JSON.stringify(takedown));
  const takedownRef = { id: takedown.fact.id, hash: takedown.fact.factHash };
  const crossingPreviewResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-preview`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsFeedbackRequest)
  });
  const crossingPreview = await crossingPreviewResponse.json();
  const crossingSnapshotResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsFeedbackRequest, previewToken: crossingPreview.previewToken, requestHash: crossingPreview.requestHash,
      idempotencyKey: "xhs-feedback-crossing-custom", actorType: "user", actorId: "user:xhs-analyst",
      measurementWindow: { label: "custom", startedAt: "2026-08-06T16:00:00.000Z", endedAt: "2026-08-06T18:00:00.000Z" },
      cutoffAt: "2026-08-06T18:00:00.000Z", collectedAt: "2026-08-06T18:01:00.000Z",
      source: { kind: "manual_entry", evidenceRef: { id: "xhs-feedback-evidence:crossing", hash: "8".repeat(64) } },
      metrics: { views: 3 }
    })
  });
  const crossingSnapshot = await crossingSnapshotResponse.json();
  assert.equal(crossingSnapshotResponse.status, 201, JSON.stringify(crossingSnapshot));
  assert.equal(crossingSnapshot.lifecycleBinding.classificationAtCapture, "crossing_custom");
  const beforePostTakedownSnapshot = structuredClone(readStore());
  const postTakedownSnapshotResponse = await fetch(`${xhsFeedbackBase}/exact-feedback-confirm`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsFeedbackRequest, previewToken: crossingPreview.previewToken, requestHash: crossingPreview.requestHash,
      idempotencyKey: "xhs-feedback-post-takedown", actorType: "user", actorId: "user:xhs-analyst",
      measurementWindow: { label: "custom", startedAt: "2026-08-06T17:07:00.000Z", endedAt: "2026-08-06T18:00:00.000Z" },
      cutoffAt: "2026-08-06T18:00:00.000Z", collectedAt: "2026-08-06T18:01:00.000Z",
      source: { kind: "manual_entry", evidenceRef: { id: "xhs-feedback-evidence:post-takedown", hash: "7".repeat(64) } },
      metrics: { views: 1 }
    })
  });
  assert.equal(postTakedownSnapshotResponse.status, 409);
  assert.equal((await postTakedownSnapshotResponse.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_SNAPSHOT_WINDOW_BLOCKED");
  assert.deepEqual(readStore(), beforePostTakedownSnapshot, "post-takedown Snapshot rejection must preserve Snapshot and binding stores");
  const postTakedownCorrectionResponse = await fetch(`${xhsLifecycleBase}-correction`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsLifecycleScope, expectedLifecycleHeadRef: takedownRef, idempotencyKey: "xhs-post-takedown-evidence-correction",
      actorType: "user", actorId: "user:lifecycle-reviewer", method: "manual_platform_observation",
      observedAt: "2026-08-06T17:08:00.000Z", effectivePublishedAt: null,
      evidenceRefs: [{ id: "evidence:xhs-post-takedown-correction", hash: "6".repeat(64) }]
    })
  });
  const postTakedownCorrection = await postTakedownCorrectionResponse.json();
  assert.equal(postTakedownCorrectionResponse.status, 201, JSON.stringify(postTakedownCorrection));
  const postTakedownCorrectionRef = { id: postTakedownCorrection.fact.id, hash: postTakedownCorrection.fact.factHash };
  const beforeRepeatedTakedown = structuredClone(readStore());
  const repeatedTakedownResponse = await fetch(`${xhsLifecycleBase}-takedown`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...takedownPayload, expectedLifecycleHeadRef: postTakedownCorrectionRef, idempotencyKey: "xhs-repeated-confirmed-takedown"
    })
  });
  assert.equal(repeatedTakedownResponse.status, 409);
  assert.equal((await repeatedTakedownResponse.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_TERMINAL_SUCCESSOR_FORBIDDEN");
  assert.deepEqual(readStore(), beforeRepeatedTakedown, "confirmed takedown must reject a second takedown while evidence correction remains allowed");
  const replacementRequest = {
    workspaceId: replacementPublication.publication.workspaceId, companyId: replacementPublication.publication.companyId,
    accountId: replacementPublication.publication.accountId, platform: "xiaohongshu", projectId: replacementPublication.publication.contentProjectRef.id,
    publicationRef: { id: replacementPublication.publication.id, hash: replacementPublication.publication.factHash },
    platformContentId: replacementPublication.publication.canonicalPlatformContentId
  };
  for (const [label, forgedReplacementRequest, expectedStatus, expectedCode] of [
    ["cross-company", { ...replacementRequest, companyId: "other-company" }, 403, "ATOMIC_PUBLICATION_LIFECYCLE_COMPANY_MISMATCH"],
    ["same-content", { ...xhsFeedbackRequest, platform: "xiaohongshu", projectId: publicationResult.publication.contentProjectRef.id }, 409, "ATOMIC_PUBLICATION_LIFECYCLE_REPLACEMENT_SCOPE_INVALID"]
  ]) {
    const before = structuredClone(readStore());
    const response = await fetch(`${xhsLifecycleBase}-replacement`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        ...xhsLifecycleScope, expectedLifecycleHeadRef: postTakedownCorrectionRef, replacementRequest: forgedReplacementRequest,
        expectedReplacementLifecycleHeadRef: forgedReplacementRequest.publicationRef, confirmedTakedownRef: takedownRef,
        idempotencyKey: `xhs-replacement-${label}`, actorType: "user", actorId: "user:lifecycle-reviewer",
        method: "manual_platform_observation", observedAt: "2026-08-06T17:10:00.000Z"
      })
    });
    assert.equal(response.status, expectedStatus, label);
    assert.equal((await response.json()).code, expectedCode, label);
    assert.deepEqual(readStore(), before, `${label} replacement must be zero-write`);
  }
  const beforeDoubleCasFailure = structuredClone(readStore());
  const doubleCasFailure = await fetch(`${xhsLifecycleBase}-replacement`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsLifecycleScope, expectedLifecycleHeadRef: postTakedownCorrectionRef, replacementRequest,
      expectedReplacementLifecycleHeadRef: { id: "stale-head", hash: "c".repeat(64) }, confirmedTakedownRef: takedownRef,
      idempotencyKey: "xhs-replacement-double-cas-failure", actorType: "user", actorId: "user:lifecycle-reviewer",
      method: "manual_platform_observation", observedAt: "2026-08-06T17:10:00.000Z"
    })
  });
  assert.equal(doubleCasFailure.status, 409);
  assert.equal((await doubleCasFailure.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_REPLACEMENT_HEAD_CONFLICT");
  assert.deepEqual(readStore(), beforeDoubleCasFailure, "replacement double-CAS failure must append neither head");
  const replacementLifecycleResponse = await fetch(`${xhsLifecycleBase}-replacement`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...xhsLifecycleScope, expectedLifecycleHeadRef: postTakedownCorrectionRef, replacementRequest,
      expectedReplacementLifecycleHeadRef: replacementRequest.publicationRef, confirmedTakedownRef: takedownRef,
      idempotencyKey: "xhs-replacement-fixture", actorType: "user", actorId: "user:lifecycle-reviewer",
      method: "manual_platform_observation", observedAt: "2026-08-06T17:10:00.000Z"
    })
  });
  const replacementLifecycle = await replacementLifecycleResponse.json();
  assert.equal(replacementLifecycleResponse.status, 201, JSON.stringify(replacementLifecycle));
  const lifecycleStateResponse = await fetch(`${xhsLifecycleBase}-lifecycle-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsLifecycleScope)
  });
  const lifecycleState = await lifecycleStateResponse.json();
  assert.equal(lifecycleStateResponse.status, 200, JSON.stringify(lifecycleState));
  assert.equal(lifecycleState.everPublished, true);
  assert.equal(lifecycleState.published, true, "compatibility published remains historical");
  assert.equal(lifecycleState.currentPlatformState, "replaced");
  assert.equal(lifecycleState.currentlyAvailable, false);
  assert.equal(lifecycleState.effectivePublishedAt, "2026-07-31T01:00:00.000Z");
  const beforeTerminalCorrection = structuredClone(readStore());
  const terminalCorrection = await fetch(`${xhsLifecycleBase}-correction`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...correctionPayload, expectedLifecycleHeadRef: { id: replacementLifecycle.fact.id, hash: replacementLifecycle.fact.factHash },
      idempotencyKey: "xhs-terminal-replacement-correction", observedAt: "2026-08-06T17:11:00.000Z",
      evidenceRefs: [{ id: "evidence:xhs-terminal", hash: "5".repeat(64) }]
    })
  });
  assert.equal(terminalCorrection.status, 409);
  assert.equal((await terminalCorrection.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_TERMINAL_SUCCESSOR_FORBIDDEN");
  assert.deepEqual(readStore(), beforeTerminalCorrection, "replaced old Publication must reject all primary successors");

  const wechatLifecycleScope = {
    ...wechatPublicationScope,
    publicationRef: { id: wechatPublication.publication.id, hash: wechatPublication.publication.factHash },
    platformContentId: wechatPublication.publication.canonicalPlatformContentId
  };
  const currentWechatLifecycleBase = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat`;
  for (const [method, action] of [["GET", "publication-correction"], ["DELETE", "publication-takedown"], ["GET", "exact-feedback-confirm"]]) {
    const before = structuredClone(readStore());
    const response = await fetch(`${currentWechatLifecycleBase}/${action}`, { method });
    assert.equal(response.status, 405, `${method} ${action}`);
    assert.equal((await response.json()).code, "ATOMIC_WECHAT_PROMOTION_UPLOAD_DELIVERY_METHOD_NOT_ALLOWED");
    assert.deepEqual(readStore(), before, `${method} ${action} method gate must be zero-write`);
  }
  const wechatCorrectionResponse = await fetch(`${currentWechatLifecycleBase}/publication-correction`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...wechatLifecycleScope, expectedLifecycleHeadRef: wechatLifecycleScope.publicationRef,
      idempotencyKey: "wechat-publication-correction-fixture", actorType: "user", actorId: "user:lifecycle-reviewer",
      method: "manual_platform_observation", observedAt: "2026-08-06T17:00:00.000Z", effectivePublishedAt: null,
      evidenceRefs: [{ id: "evidence:wechat-correction", hash: "d".repeat(64) }]
    })
  });
  const wechatCorrection = await wechatCorrectionResponse.json();
  assert.equal(wechatCorrectionResponse.status, 201, JSON.stringify(wechatCorrection));
  const wechatTakedownResponse = await fetch(`${currentWechatLifecycleBase}/publication-takedown`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...wechatLifecycleScope, expectedLifecycleHeadRef: { id: wechatCorrection.fact.id, hash: wechatCorrection.fact.factHash },
      idempotencyKey: "wechat-publication-takedown-fixture", actorType: "user", actorId: "user:lifecycle-reviewer",
      method: "manual_platform_observation", action: "make_unavailable", actionAttemptedAt: "2026-08-06T17:05:00.000Z", observedAt: "2026-08-06T17:06:00.000Z",
      outcome: "confirmed_removed", observedAvailability: "unavailable",
      evidenceRefs: [{ id: "evidence:wechat-takedown", hash: "e".repeat(64) }]
    })
  });
  assert.equal(wechatTakedownResponse.status, 201, JSON.stringify(await wechatTakedownResponse.json()));
  const wechatLifecycleStateResponse = await fetch(`${currentWechatLifecycleBase}/publication-lifecycle-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatLifecycleScope)
  });
  const wechatLifecycleState = await wechatLifecycleStateResponse.json();
  assert.equal(wechatLifecycleStateResponse.status, 200, JSON.stringify(wechatLifecycleState));
  assert.equal(wechatLifecycleState.currentPlatformState, "published_unavailable");
  assert.equal(wechatLifecycleState.currentlyAvailable, false);

  const validLifecycleStore = structuredClone(readStore());
  const forgedLifecycleStore = structuredClone(validLifecycleStore);
  const forgedCorrection = forgedLifecycleStore.unifiedAtomicPublicationLifecycleFacts.find((item) => item.contract === "ControlledPublicationCorrection@1.0");
  forgedCorrection.previousLifecycleHeadRef.hash = "f".repeat(64);
  const forgedSemantics = structuredClone(forgedCorrection);
  for (const key of ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "recordedAt", "immutable", "claims", "factHash"]) delete forgedSemantics[key];
  forgedCorrection.requestHash = hashUnifiedContent(forgedSemantics);
  forgedCorrection.id = `atomic-publication-lifecycle:${hashUnifiedContent({ contract: forgedCorrection.contract, requestHash: forgedCorrection.requestHash, idempotencyKey: forgedCorrection.idempotencyKey }).slice(0, 24)}`;
  delete forgedCorrection.factHash;
  forgedCorrection.factHash = hashUnifiedContent(forgedCorrection);
  writeStore(forgedLifecycleStore);
  const beforeForgedLifecycleRead = structuredClone(readStore());
  const forgedLifecycleRead = await fetch(`${xhsLifecycleBase}-lifecycle-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsLifecycleScope)
  });
  assert.equal(forgedLifecycleRead.status, 409);
  assert.equal((await forgedLifecycleRead.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_STORED_CAS_INVALID");
  assert.deepEqual(readStore(), beforeForgedLifecycleRead, "correctly rehashed lifecycle cross-ref forgery must be zero-write");
  writeStore(validLifecycleStore);
  const duplicateLifecycleStore = structuredClone(validLifecycleStore);
  duplicateLifecycleStore.unifiedAtomicPublicationLifecycleFacts.push(structuredClone(duplicateLifecycleStore.unifiedAtomicPublicationLifecycleFacts[0]));
  writeStore(duplicateLifecycleStore);
  const beforeDuplicateStoredLifecycle = structuredClone(readStore());
  const duplicateStoredLifecycleResponse = await fetch(`${xhsLifecycleBase}-lifecycle-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(xhsLifecycleScope)
  });
  assert.equal(duplicateStoredLifecycleResponse.status, 409);
  assert.equal((await duplicateStoredLifecycleResponse.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_STORED_DUPLICATE_INVALID");
  assert.deepEqual(readStore(), beforeDuplicateStoredLifecycle, "stored duplicate id/hash/key/semantics must be read-rejected without writes");
  writeStore(validLifecycleStore);
  const contradictoryStoredLifecycle = structuredClone(validLifecycleStore);
  const contradictoryStoredTakedown = contradictoryStoredLifecycle.unifiedAtomicPublicationLifecycleFacts.find((item) => item.platform === undefined
    && item.contract === "ControlledPublicationTakedown@1.0" && item.action === "make_unavailable");
  contradictoryStoredTakedown.outcome = "failed";
  const contradictoryStoredSemantics = structuredClone(contradictoryStoredTakedown);
  for (const key of ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "recordedAt", "immutable", "claims", "factHash"]) delete contradictoryStoredSemantics[key];
  contradictoryStoredTakedown.requestHash = hashUnifiedContent(contradictoryStoredSemantics);
  contradictoryStoredTakedown.id = `atomic-publication-lifecycle:${hashUnifiedContent({ contract: contradictoryStoredTakedown.contract,
    requestHash: contradictoryStoredTakedown.requestHash, idempotencyKey: contradictoryStoredTakedown.idempotencyKey }).slice(0, 24)}`;
  delete contradictoryStoredTakedown.factHash;
  contradictoryStoredTakedown.factHash = hashUnifiedContent(contradictoryStoredTakedown);
  writeStore(contradictoryStoredLifecycle);
  const beforeContradictoryStoredLifecycle = structuredClone(readStore());
  const contradictoryStoredLifecycleResponse = await fetch(`${currentWechatLifecycleBase}/publication-lifecycle-state`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wechatLifecycleScope)
  });
  assert.equal(contradictoryStoredLifecycleResponse.status, 409);
  assert.equal((await contradictoryStoredLifecycleResponse.json()).code, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  assert.deepEqual(readStore(), beforeContradictoryStoredLifecycle, "correctly rehashed contradictory stored takedown must be zero-write");
  writeStore(validLifecycleStore);

  process.env.ATOMIC_PUBLICATION_FEEDBACK_UI_CUTOVER_V1 = "1";
  const uiStateQuery = (scope) => new URLSearchParams({
    workspaceId: scope.workspaceId, companyId: scope.companyId, accountId: scope.accountId, candidateId: scope.candidateRef.id
  });
  const xhsUiStateBefore = structuredClone(readStore());
  const xhsUiStateResponse = await fetch(`${atomicHumanBase}/publication-feedback-control-state?${uiStateQuery(manualPublicationScope)}`);
  const xhsUiState = await xhsUiStateResponse.json();
  assert.equal(xhsUiStateResponse.status, 200, JSON.stringify(xhsUiState));
  assert.equal(xhsUiState.contract, "AtomicPublicationFeedbackUiState@1.0");
  assert.equal(xhsUiState.platform, "xiaohongshu");
  assert.equal(xhsUiState.states.deliveryReady, true);
  assert.equal(xhsUiState.states.humanPublicationConfirmed, true);
  assert.equal(xhsUiState.claims.platformActionPerformed, false);
  assert.deepEqual(readStore(), xhsUiStateBefore, "XHS publication UI state must be read-only");
  const wechatUiScope = { ...humanScope, candidateRef: finalWechatDelivery.delivery.articleRef };
  const wechatUiStateBefore = structuredClone(readStore());
  const currentWechatUiBase = `${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/wechat`;
  const wechatUiStateResponse = await fetch(`${currentWechatUiBase}/publication-feedback-control-state?${uiStateQuery(wechatUiScope)}`);
  const wechatUiState = await wechatUiStateResponse.json();
  assert.equal(wechatUiStateResponse.status, 200, JSON.stringify(wechatUiState));
  assert.equal(wechatUiState.platform, "wechat");
  assert.equal(wechatUiState.states.resourceUploaded, true);
  assert.equal(wechatUiState.states.humanPublicationConfirmed, true);
  assert.ok(wechatUiState.exactRefs.uploadEvidenceRef?.hash);
  assert.ok(wechatUiState.exactRefs.postUploadRef?.hash);
  assert.deepEqual(readStore(), wechatUiStateBefore, "WeChat publication UI state must be read-only");

  const store = readStore();
  assert.equal(store.unifiedContentProjects.length, 2);
  assert.deepEqual(store.contentTasks || [], legacyTasksBefore, "unified append-only snapshots must not rewrite legacy ContentTask rows");
  assert.equal(JSON.stringify(store.unifiedContentProjects).includes("PK\u0003\u0004"), false, "store must not persist ZIP bytes");
  await new Promise((resolve) => server.close(() => resolve()));
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  assert.equal(readStore().unifiedAtomicManualPublications.find((item) => item.id === publicationResult.publication.id)?.factHash, publicationResult.publication.factHash,
    "immutable manual publication must survive a server listener restart and durable store reload");
  const reloadedUiStateResponse = await fetch(`${baseUrl}/unified-content-projects/${encodeURIComponent(atomicProduct.id)}/platforms/xiaohongshu/publication-feedback-control-state?${uiStateQuery(manualPublicationScope)}`);
  const reloadedUiState = await reloadedUiStateResponse.json();
  assert.equal(reloadedUiStateResponse.status, 200, JSON.stringify(reloadedUiState));
  assert.equal(reloadedUiState.publication.factHash, xhsUiState.publication.factHash, "Atomic publication UI state must survive page/server reload");
  assert.equal(reloadedUiState.claims.platformActionPerformed, false);
  console.log(JSON.stringify({ status: "unified-content-product-api-self-test passed", projectId, invocations: created.actualInvocations.length, platforms: created.platforms.map((item) => item.platform) }, null, 2));
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  database.close();
  await rm(dataDir, { recursive: true, force: true });
}
