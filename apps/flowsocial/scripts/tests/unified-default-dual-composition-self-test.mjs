import assert from "node:assert/strict";
import { hashUnifiedContent } from "../../content-agent/unified-content-contracts.mjs";
import {
  confirmUnifiedStagedAtomicDualBootstrap,
  createUnifiedStagedAtomicDualBootstrap,
  resumeUnifiedStagedAtomicDualBootstrap
} from "../../content-agent/unified-atomic-multiplatform-product.mjs";
import {
  materializeUnifiedStagedAtomicDualBootstrap,
  planUnifiedStagedAtomicDualBootstrap
} from "../../content-agent/unified-content-server-adapter.mjs";

const now = () => "2026-08-12T08:00:00.000Z";
const flags = { unifiedContentStagedAtomicDualBootstrapV1: true };
const strategyDocument = { schemaVersion: "2.0", strategyHotspotPolicy: "disabled", fixture: "golden-composition" };
const strategy = { id: "strategy:golden", accountId: "company:golden", status: "active", document: strategyDocument };
const ref = (value, id = value.id) => ({ id, hash: hashUnifiedContent(value) });
const xhsAccount = { id: "account:xhs:golden", companyId: "company:golden", platform: "xiaohongshu", accountIdentity: { subjectType: "company_official" } };
const wechatAccount = { id: "account:wechat:golden", companyId: "company:golden", platform: "wechat", accountIdentity: { subjectType: "company_official" } };
const designDna = {
  kind: "DesignDNA", schemaVersion: "1.0", id: "dna:golden", accountId: xhsAccount.id, version: 1, status: "confirmed",
  colors: ["#18352d", "#f7f3e8"], fontPreferences: ["sans-serif"], layoutPreferences: ["stable-grid"], materials: ["paper"],
  photographyOrIllustrationDirection: "restrained editorial illustration", forbiddenMotifs: ["watermark"], referenceNotes: "offline fixture",
  approvedTextSummary: "restrained editorial system", sources: [], authorization: { approvedFileIds: [], excludedFileIds: [], providerReferenceImageSupported: false, referenceImagesTransmitted: false, externalInputMode: "approved_text_summary_only", disclosure: "offline fixture" },
  confirmation: { decision: "confirmed", confirmedBy: "human:golden", note: "fixture", confirmedAt: now() }, createdAt: now(), updatedAt: now()
};
xhsAccount.visualStyle = { name: "golden", description: "fixture", designDnaSnapshotId: designDna.id, designDnaVersion: 1 };
const opportunity = { id: "opportunity:golden", companyId: "company:golden", topic: "atomic workflow", contentObjective: "knowledge_howto" };
opportunity.opportunityHash = hashUnifiedContent({ id: opportunity.id, companyId: opportunity.companyId, topic: opportunity.topic, contentObjective: opportunity.contentObjective });
const mechanismBase = {
  schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "decision:golden", companyId: "company:golden",
  projectInputRef: { id: "project-input:golden", hash: "1".repeat(64) }, activeStrategySnapshotRef: ref(strategyDocument, strategy.id),
  taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
  mechanisms: [{ mechanism: "strategy_only", role: "primary", evaluationStatus: "evaluated", candidates: [], reason: "Offline golden fixture.", factPolicy: null }],
  selectedSourceRefs: [], strategyHotspotPolicy: "disabled", deviation: { status: "none", reason: null, confirmationEventRef: null }, decidedAt: now()
};
const mechanismDecision = { ...mechanismBase, decisionHash: hashUnifiedContent(mechanismBase) };
const prerequisite = {
  idempotencyKey: "prerequisite:golden", semanticHash: hashUnifiedContent({ fixture: "golden-prerequisite" }),
  designDnaSnapshotRef: ref(designDna), contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash },
  mechanismDecisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash }, projectInputRef: mechanismDecision.projectInputRef
};
const store = {
  accounts: [xhsAccount, wechatAccount], designDnaSnapshots: [designDna], unifiedContentOpportunities: [opportunity],
  unifiedContentPrerequisiteRequests: [prerequisite], unifiedContentMechanismDecisions: [mechanismDecision],
  accountStrategySnapshots: [
    { id: "account-strategy:xhs", companyId: "company:golden", socialAccountId: xhsAccount.id, status: "active", payload: { matrixRole: "discovery_and_validation", platformPlaybook: { role: "discovery" }, creativeMechanism: "checklist", prohibitedOverlap: [] } },
    { id: "account-strategy:wechat", companyId: "company:golden", socialAccountId: wechatAccount.id, status: "active", payload: { matrixRole: "authority_and_conversion", platformPlaybook: { role: "authority" }, creativeMechanism: "framework", prohibitedOverlap: [] } }
  ], contentTasks: [{ id: "legacy:untouched" }], publications: [{ id: "publication:untouched" }], feedback: [{ id: "feedback:untouched" }]
};
const input = {
  requestId: "request:golden", idempotencyKey: "idempotency:golden", companyId: "company:golden", projectId: "project:golden",
  topicIntent: { topic: "atomic workflow", intent: "explain the verified workflow" }, activeStrategySnapshotRef: ref(strategyDocument, strategy.id),
  prerequisiteRef: ref(prerequisite, prerequisite.idempotencyKey), accounts: { xiaohongshu: ref(xhsAccount), wechat: ref(wechatAccount) },
  authorizationSourceRefs: [{ id: mechanismDecision.id, hash: mechanismDecision.decisionHash }]
};

const roles = ["hook", "problem", "diagnosis", "evidence", "example", "action"];
const bodyRoles = ["scene", "problem", "conclusion", "evidence", "evidence", "summary"];
const pageRoles = ["cover", "problem", "conclusion", "evidence", "case", "cta"];
const outline = (platform) => ({
  outline_id: `outline:${platform}:golden`, schema_version: "1.0", platform, topic: "atomic workflow", content_promise: platform === "wechat" ? "A verified workflow." : "用同一个内容母版完成双平台原子交付。",
  content_function: "authority", content_purpose_id: "knowledge_howto", conversion_stage_id: "trust", opening_strategy: "problem first",
  sections: roles.map((role, index) => ({ section_id: `S${index + 1}`, heading: `Step ${index + 1}`, role, objective: `Explain stage ${index + 1}.`, presentation_content: `Present stage ${index + 1}.`, key_points: [`Point ${index + 1}`], claim_ids: [], boundary: "" })),
  closing_strategy: "summary", unresolved_questions: [], confirmation_required: true
});
const master = {
  content_master_id: "master:golden", topic_id: opportunity.id, intent_profile_id: "project-input:golden", platform: "xiaohongshu",
  content_purpose: { id: "knowledge_howto", label: "Guide", description: "Offline guide" }, target_audience: ["operators"],
  central_question: "How does the workflow stay atomic?", central_thesis: "One confirmed master feeds two platform commits.", reader_value: "A repeatable workflow.", content_emphasis: [],
  strategy_alignment: { content_function: "authority", platform_role: "shared", conversion_stage: { id: "trust", label: "Trust", action: "read" }, evidence_requirement: "source", purpose_eligible: true, user_override_applied: false },
  confirmed_facts: [{ fact_id: "F001", fact: "The fixture uses one confirmed master.", source_ids: ["SRC001"] }], supported_interpretations: [], author_opinions: [], unknowns: [], examples: [],
  knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] }, promotion: { mode: "none", insertion_rule: "do_not_mention", allowed_items: [], allowed_claims: [], forbidden_claims: [], disclosure: "" },
  engagement_policy: { mode: "auto", optimize_for: ["finish"], selected_primary_action: "none", cta_rule: "select_one_primary_action_naturally" }, claims_to_avoid: [], publish_time_checks: [], source_list: [{ source_id: "SRC001", title: "Fixture source" }]
};
const titles = (platform) => ({
  stage: "final_after_body", platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu",
  title_brief: { content_type: "guide", target_reader: "operators", core_conclusion: "One master feeds both platforms.", reader_takeaway: "Use the atomic workflow.", strongest_evidence: ["F001"], real_entities: [], freshness_dependency: "none" },
  candidates: ["balanced", "safe", "spread", "search", "evergreen"].map((motivation, index) => ({ title_id: `T${index + 1}`, title: platform === "wechat" ? `公众号原子内容流程${index + 1}` : `双平台原子内容流程${index + 1}`, motivation, method: motivation, claim_ids: ["F001"], scores: { fulfillment: 5, relevance: 5, specificity: 4, curiosity: 3, clarity: 5, uniqueness: 4, overall: 5 }, risk: "low", risk_reasons: [] })),
  recommendations: { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" }, ab_tests: [{ title_a: "T1", title_b: "T5", single_variable: "motivation", hypothesis: "Clarity wins." }], same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" }
});
const wechatArticle = () => ({
  platform: "wechat_official_account", topic_id: opportunity.id, intent_profile_id: "project-input:golden", content_purpose_id: "knowledge_howto",
  account_context: { subject_type: "company", account_mode: "official", matrix_role: "authority_and_conversion", trust_source: "institution" }, creative_mechanism: "framework", journey_stage: "convert",
  matrix_coordination: { shared_campaign_topic_id: opportunity.id, differentiation_angle: "authority_and_conversion:authority", prohibited_overlap: [] }, article_promise: "A verified workflow.", core_argument: "Confirm once and adapt twice.", information_gain: "Exact invocation evidence.",
  title_candidates: [1,2,3].map((n) => ({ title: `Atomic workflow ${n}`, approach: n === 1 ? "method" : n === 2 ? "question" : "conclusion", claim_ids: ["F001"], risk: "low" })), recommended_title: "Atomic workflow 1", abstract: "Offline fixture.",
  opening: { type: "conclusion", text: "Start from one master.", claim_ids: ["F001"] }, outline: [1,2,3].map((n) => ({ section_id: `W${n}`, heading: `Part ${n}`, purpose: "Explain the workflow.", relation_to_previous: n === 1 ? "start" : "explain", claim_ids: ["F001"], boundary_to_cover: "" })),
  article_markdown: "## Part 1\n\nOne master.\n\n## Part 2\n\nTwo adaptations.\n\n## Part 3\n\nImmutable commits.", pull_quotes: [{ text: "Confirm once and adapt twice.", claim_ids: ["F001"] }], key_takeaways: ["Use one master."], share_summary: "Atomic workflow.", share_reason: "Repeatable.",
  discovery_plan: { subscription_value: "Workflow guidance.", search_keywords: ["atomic workflow"], recommendation_hook: "One master, two outputs.", social_sharing_context: "Team workflow." }, relationship_handoff: { column: "", related_content_ids: [], menu_path: "", keyword_reply: "", follow_reason: "More workflows.", primary_next_step: "Review." },
  engagement_strategy: { mode: "auto", primary_action: "share", reason: "Useful to teams.", cta_placement: "ending", cta_text: "Share with your team." }, cta: "Share with your team.", claim_map: [{ claim_id: "F001", section_ids: ["W1", "W2", "W3"] }], used_knowledge_asset_ids: [], source_list: [{ source_id: "SRC001", title: "Fixture source" }], publish_time_checks: [],
  preflight_checks: ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"].map((check) => ({ check, result: ["marketing_disclosure", "relationship_handoff_validity"].includes(check) ? "not_applicable" : "pass", detail: "fixture" }))
});

const calls = [];
async function generateText(request) {
  const capability = request?.skill_runtime?.skill_name;
  const serialized = JSON.stringify(request);
  const platform = request?.input?.platform === "wechat_official_account"
    || ["write-wechat-article", "review-wechat-article", "plan-wechat-images"].includes(capability)
    || (capability === "generate-content-outline" && (serialized.includes("wechat_official_account") || serialized.includes(":wechat")))
    ? "wechat" : "xiaohongshu";
  calls.push({ capability, platform });
  let data;
  let status = "success";
  if (capability === "build-content-master") data = master;
  else if (capability === "generate-content-outline") { data = outline(platform); status = "ready"; }
  else if (capability === "write-xhs-post-copy") data = { schemaVersion: "1.0", contract: "XhsPostCopyCreativeOutput@1.0", contentPromise: "用同一个内容母版完成双平台原子交付。", engagementStrategy: { mode: "auto", primaryAction: "save", reason: "便于团队复用。", ctaPlacement: "ending", ctaText: "保存这份流程。" }, titleCandidates: [1,2,3].map((n) => ({ title: `双平台原子内容流程${n}`, hookType: n === 1 ? "result" : n === 2 ? "problem" : "checklist", claimIds: ["F001"], risk: "low" })), recommendedTitle: "双平台原子内容流程1", opening: "先确认唯一内容母版，再分别适配平台。", bodySections: roles.map((role, index) => ({ sectionId: `S${index + 1}`, outlineRole: role, role: bodyRoles[index], text: `这是第${index + 1}个阶段的执行说明。`, claimIds: index === 0 ? ["F001"] : [], knowledgeAssetIds: [] })), ending: "确认之后再生成不可变提交。", pinnedComment: "", hashtags: ["内容工作流", "双平台内容", "原子编排"], cta: "保存这份流程。", promotionUse: { mode: "none", itemIds: [], disclosure: "" } };
  else if (capability === "generate-platform-titles") data = titles(platform);
  else if (capability === "plan-xhs-carousel") data = { schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0", reading_arc: "promise-action", section_drafts: roles.map((_, index) => ({ objective: `说明第${index + 1}个执行阶段。`, takeaway: `完成第${index + 1}个阶段。`, text_layers: [{ type: "headline", text: index === 0 ? "双平台原子内容流程1" : `第${index + 1}个阶段`, max_lines: 2, priority: 1 }], layout_hint: "清晰网格与稳定留白", fact_ids: index === 0 ? ["F001"] : [], interpretation_ids: [], knowledge_asset_ids: [] })) };
  else if (capability === "plan-xhs-visual-assets") data = { schemaVersion: "1.0", contract: "XhsVisualAssetPlanCreativeOutput@1.0", pageVisuals: roles.map((_, index) => ({ page: index + 1, visualFunction: "explain", visualNeed: `Explain stage ${index + 1}.`, renderStrategy: "html_css", mustKeep: [], mustAvoid: [] })), imageSpecs: [], skippedPages: roles.map((_, index) => ({ page: index + 1, reason: "html_css" })), pageAssetBindings: roles.map((_, index) => ({ page: index + 1, plannedAssetIds: [] })) };
  else if (capability === "write-wechat-article") data = wechatArticle();
  else if (capability === "review-wechat-article") data = { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
  else if (capability === "plan-wechat-images") data = {
    plan_id: "wechat-images:golden",
    cover: { purpose: "pace", strategy: "html_chart", asset_id: "cover_chart", claim_ids: [], image_spec: null },
    slots: [{ slot_id: "inline_chart_1", after_section_id: "W1", purpose: "explain", strategy: "html_chart", claim_ids: [], asset_id: "inline_chart_1", image_spec: null }]
  };
  else throw new Error(`Unexpected capability: ${capability}`);
  return { mode: "real_offline_adapter", data: { status, data, warnings: [], blocked_reasons: [] } };
}

const dependencies = { featureFlags: flags, now, generateText, resolveActiveStrategySnapshot: async () => strategy };
dependencies.planBootstrap = (value) => planUnifiedStagedAtomicDualBootstrap(store, value, dependencies);
dependencies.materializeBootstrapCommits = (staged) => materializeUnifiedStagedAtomicDualBootstrap(store, staged, dependencies);
const immutableBefore = { contentTasks: structuredClone(store.contentTasks), publications: structuredClone(store.publications), feedback: structuredClone(store.feedback) };
const created = await createUnifiedStagedAtomicDualBootstrap(store, input, dependencies);
assert.equal(created.bootstrap.state, "awaiting_outline_confirmation");
assert.deepEqual(calls.map((item) => item.capability), ["build-content-master", "generate-content-outline", "generate-content-outline"]);
assert.equal(store.unifiedAtomicContentCommits, undefined);
const confirmation = { actor: { type: "user", id: "human:golden" }, confirmedAt: "2026-08-12T08:01:00.000Z", outlineRefs: created.bootstrap.outlineRefs };
confirmUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, confirmation, { featureFlags: flags });
const beforeResume = calls.length;
const resumed = await resumeUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, { idempotencyKey: input.idempotencyKey }, dependencies);
assert.equal(resumed.created, true);
const materializationCalls = calls.slice(beforeResume);
assert.deepEqual(materializationCalls.map((item) => item.capability), [
  "write-xhs-post-copy", "generate-platform-titles", "plan-xhs-carousel",
  "write-wechat-article", "review-wechat-article", "plan-wechat-images"
]);
assert.equal(materializationCalls.length, 6, "WeChat image planning must analyze the approved article through its real Skill invocation");
assert.equal(materializationCalls.filter((item) => item.capability === "generate-platform-titles").length, 1,
  "generate-platform-titles remains the XHS-only title authority");
assert.equal(store.unifiedAtomicContentCommits.length, 2);
const [xhsCommit, wechatCommit] = store.unifiedAtomicContentCommits;
const authorityRef = (commit, role) => commit.authorityBinding.refs.find((item) => item.role === role).ref;
assert.equal(xhsCommit.accountId, xhsAccount.id);
assert.equal(wechatCommit.accountId, wechatAccount.id);
assert.deepEqual(xhsCommit.usageBinding.sharedContentMasterRef, authorityRef(wechatCommit, "sharedContentMasterRef"));
assert.deepEqual(xhsCommit.graph.authorityBinding.refs.find((item) => item.role === "confirmedOutlineRef").ref, created.bootstrap.outlineRefs.xiaohongshu);
assert.deepEqual(authorityRef(wechatCommit, "confirmedOutlineRef"), created.bootstrap.outlineRefs.wechat);
assert.ok(xhsCommit.componentFacts.length >= 3 && Object.keys(wechatCommit.skillFacts).length === 3, "both commits bind verified output facts");
assert.deepEqual({ contentTasks: store.contentTasks, publications: store.publications, feedback: store.feedback }, immutableBefore);
const callsBeforeReplay = calls.length;
const commitHashes = store.unifiedAtomicContentCommits.map((item) => item.commitHash);
const replay = await resumeUnifiedStagedAtomicDualBootstrap(store, created.bootstrap.id, { idempotencyKey: input.idempotencyKey }, dependencies);
assert.equal(replay.created, false);
assert.equal(calls.length, callsBeforeReplay);
assert.deepEqual(store.unifiedAtomicContentCommits.map((item) => item.commitHash), commitHashes);

const scopedPlanningInput = {
  ...structuredClone(input), requestId: "request:golden:scoped-xhs", idempotencyKey: "idempotency:golden:scoped-xhs",
  projectId: "project:golden:scoped-xhs", targetPlatform: "xiaohongshu"
};
let masterCheckpoint = null;
const beforeScopedPlanning = calls.length;
const firstScopedPlanning = await planUnifiedStagedAtomicDualBootstrap(store, scopedPlanningInput, {
  ...dependencies,
  attemptObserver: async (event) => {
    if (event.phase === "completed" && event.capability === "build-content-master") masterCheckpoint = structuredClone(event.checkpoint);
  }
});
assert.ok(masterCheckpoint?.invocation?.invocationHash && masterCheckpoint?.outputFact?.factHash);
assert.deepEqual(calls.slice(beforeScopedPlanning).map((item) => item.capability), ["build-content-master", "generate-content-outline"]);
assert.deepEqual(firstScopedPlanning.planning.platformRuns.map((item) => item.platform), ["xiaohongshu"]);

const beforeCheckpointResume = calls.length;
const resumedScopedPlanning = await planUnifiedStagedAtomicDualBootstrap(store, scopedPlanningInput, {
  ...dependencies, planningCheckpoint: { master: masterCheckpoint }
});
assert.deepEqual(calls.slice(beforeCheckpointResume).map((item) => item.capability), ["generate-content-outline"],
  "checkpoint recovery must not call the Provider for an already completed master");
assert.equal(resumedScopedPlanning.actualInvocations.length, 2, "restored evidence plus the new outline must close the planning proof");
assert.deepEqual(resumedScopedPlanning.planning.platformRuns.map((item) => item.platform), ["xiaohongshu"]);

console.log(JSON.stringify({
  status: "unified-default-dual-composition-self-test passed",
  planningCachedInvocations: calls.slice(0, 3), materializationProviderInvocations: materializationCalls,
  generatePlatformTitlesIsAdditionalProviderCall: true, duplicateWechatMaterializationDetected: false, exactFiveProviderCallScopeConformance: true,
  retries: 0, realProviderCalls: 0, networkCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, imageCalls: 0,
  platformWrites: 0, publicationWrites: 0, feedbackWrites: 0, monolithicXhsFallbackCalls: 0
}, null, 2));
