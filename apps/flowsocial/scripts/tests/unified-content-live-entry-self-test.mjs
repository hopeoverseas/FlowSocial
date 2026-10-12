import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createUnifiedContentPrerequisites } from "../../content-agent/unified-content-prerequisite-store.mjs";
import { createAtomicProviderLedger, executeUnifiedLive, hashFile, inspectUnifiedLiveReadiness, prepareUnifiedLivePreflight, resolveCanonicalActiveStrategy, sha256, stableJson, validateIsolationPaths } from "../live/unified-content-live-server.mjs";
import { parseUnifiedLiveCli, runUnifiedLiveCli } from "../live/unified-content-live-run.mjs";

const tmpRoot = resolve("apps/flowsocial/.tmp/unified-content-live-entry-self-test");
rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

const strategyBusinessId = "strategy_fixture";
const designDnaSnapshot = {
  kind: "DesignDNA", schemaVersion: "1.0", id: "dna_live_fixture_v1", accountId: "account_xhs_fixture", version: 1, status: "confirmed",
  colors: ["#18352d", "暖白"], fontPreferences: ["无衬线标题", "清晰正文"], layoutPreferences: ["稳定网格", "充足留白"], materials: ["纸张"],
  photographyOrIllustrationDirection: "克制的编辑式插画", forbiddenMotifs: ["伪文字", "水印"], referenceNotes: "fixture reference", approvedTextSummary: "fixture approved visual summary", sources: [],
  authorization: { approvedFileIds: [], excludedFileIds: [], providerReferenceImageSupported: false, referenceImagesTransmitted: false, externalInputMode: "approved_text_summary_only", disclosure: "fixture" },
  confirmation: { decision: "confirmed", confirmedBy: "fixture_user", note: "fixture", confirmedAt: "2026-08-06T00:00:00.000Z" },
  createdAt: "2026-08-06T00:00:00.000Z", updatedAt: "2026-08-06T00:00:00.000Z"
};
const designDnaSnapshotRef = { id: designDnaSnapshot.id, hash: sha256(stableJson(designDnaSnapshot)) };
const company = { id: "company_fixture", companyId: "company_fixture", name: "Fixture", activeStrategySnapshotId: strategyBusinessId };
const xhs = { id: "account_xhs_fixture", companyId: company.id, platform: "xiaohongshu", visualStyle: { name: "账号视觉系统", description: "fixture", designDnaSnapshotId: designDnaSnapshot.id, designDnaVersion: 1 } };
const wechat = { id: "account_wechat_fixture", companyId: company.id, platform: "wechat" };
xhs.subjectType = "company_official";
xhs.accountIdentity = { subjectType: "company_official", trustSources: ["institution"] };
wechat.subjectType = "founder_ip";
wechat.accountIdentity = { subjectType: "founder_ip", trustSources: ["founder_experience"] };
const strategyPayload = { schemaVersion: "2.0", positioning: "fixture canonical company strategy" };
const strategyHash = sha256(stableJson(strategyPayload));
const strategyRow = {
  id: strategyBusinessId,
  accountId: company.id,
  version: 3,
  status: "active",
  sourceSessionId: "session_fixture",
  createdAt: "2026-08-05T00:00:00.000Z",
  confirmedAt: "2026-08-06T00:00:00.000Z",
  sourceDraftRevisionId: "draft_fixture",
  documentHash: strategyHash,
  contextHash: "3".repeat(64),
  activationReason: "user_confirmed",
  supersedesSnapshotId: "strategy_superseded_fixture",
  metadataCreatedAt: "2026-08-05T00:00:00.000Z"
};
const strategyRowMetadataHash = sha256(stableJson(strategyRow));
const legacyOpportunity = { id: "legacy_single_platform_opportunity", companyId: company.id, strategySnapshotId: strategyBusinessId, platform: "xiaohongshu" };
const store = {
  companies: [company],
  socialAccounts: [xhs, wechat],
  designDnaSnapshots: [designDnaSnapshot],
  accountStrategySnapshots: [
    { id: "strategy_projection_xhs", companyId: company.id, socialAccountId: xhs.id, status: "active", payload: { strategySnapshotId: strategyBusinessId, matrixRole: "discovery_and_validation", platformPlaybook: { role: "场景触达与需求验证" }, prohibitedOverlap: [] } },
    { id: "strategy_projection_wechat", companyId: company.id, socialAccountId: wechat.id, status: "active", payload: { strategySnapshotId: strategyBusinessId, matrixRole: "authority_and_conversion", platformPlaybook: { role: "深度权威与业务承接" }, prohibitedOverlap: [], trustSources: ["founder_experience"] } }
  ],
  contentOpportunities: [legacyOpportunity]
};
const prerequisites = createUnifiedContentPrerequisites(store, {
  companyId: company.id,
  contentObjective: "verify the authoritative unified live entry",
  hotspotEvaluation: {
    candidateRefs: [],
    factPolicy: "external_event_not_business_fact",
    reason: "fixture records that hotspot availability was explicitly evaluated",
    status: "not_available"
  },
  idempotencyKey: "unified_live_entry_fixture",
  topic: "fixture",
  wechatAccountId: wechat.id,
  xiaohongshuAccountId: xhs.id
}, {
  canonicalActiveStrategy: { id: strategyBusinessId, accountId: company.id, status: "active", payload: strategyPayload },
  now: "2026-08-06T00:00:00.000Z"
});
const opportunity = prerequisites.opportunity;
const mechanism = prerequisites.mechanismDecision;
assert.deepEqual(prerequisites.designDnaSnapshotRef, designDnaSnapshotRef);
assert.deepEqual(store.unifiedContentPrerequisiteRequests[0].designDnaSnapshotRef, designDnaSnapshotRef);
const sourceDatabasePath = resolve(tmpRoot, "source.db");

function createFixtureDatabase(path, { state = store, activeRows = 1, canonicalStatus = "active", payload = strategyPayload } = {}) {
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE app_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE strategy_snapshots (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      source_session_id TEXT,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      UNIQUE(account_id, version)
    );
    CREATE TABLE strategy_snapshot_meta (
      strategy_snapshot_id TEXT PRIMARY KEY,
      source_draft_revision_id TEXT,
      document_hash TEXT,
      context_hash TEXT,
      activation_reason TEXT NOT NULL DEFAULT 'user_confirmed',
      supersedes_snapshot_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (strategy_snapshot_id) REFERENCES strategy_snapshots(id) ON DELETE CASCADE
    );
  `);
  database.prepare("INSERT INTO app_state VALUES (1, ?, 1, ?)").run(JSON.stringify(state), "2026-08-06T00:00:00.000Z");
  const insertSnapshot = database.prepare("INSERT INTO strategy_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertMeta = database.prepare("INSERT INTO strategy_snapshot_meta VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertSnapshot.run(strategyBusinessId, company.id, 3, canonicalStatus, JSON.stringify(payload), strategyRow.sourceSessionId, strategyRow.createdAt, strategyRow.confirmedAt);
  insertMeta.run(strategyBusinessId, strategyRow.sourceDraftRevisionId, strategyRow.documentHash, strategyRow.contextHash, strategyRow.activationReason, strategyRow.supersedesSnapshotId, strategyRow.metadataCreatedAt);
  insertSnapshot.run("strategy_superseded_fixture", company.id, 2, "superseded", JSON.stringify({ positioning: "old" }), "session_old", "2026-08-01T00:00:00.000Z", "2026-08-02T00:00:00.000Z");
  if (activeRows > 1) insertSnapshot.run("strategy_unexpected_active", company.id, 4, "active", JSON.stringify({ positioning: "ambiguous" }), "session_other", "2026-08-06T01:00:00.000Z", "2026-08-06T01:00:00.000Z");
  database.close();
}

createFixtureDatabase(sourceDatabasePath);

const providerConfig = { text: { provider: "fixture-provider", model: "fixture-model", protocol: "openai-compatible" }, image: { enabled: false } };
const currentFlags = { unifiedContentProductionV1: true, xhsIntegratedPageDesignSkill: false };
const objectRef = (value) => ({ id: value.id, objectHash: sha256(stableJson(value)) });
const strategyRef = () => ({ id: strategyBusinessId, rowMetadataHash: strategyRowMetadataHash, payloadHash: strategyHash });

function approvalFor(name) {
  return {
    contract: "UnifiedContentLiveApproval@1.0",
    mode: "live",
    approved: true,
    approvedBy: "controller_fixture",
    approvedAt: "2026-08-06T00:00:00.000Z",
    requestId: `request_${name}`,
    sourceDatabasePath,
    sourceDatabaseSha256: hashFile(sourceDatabasePath),
    destinationDataDir: resolve(tmpRoot, name),
    destinationDatabaseSha256: sha256(stableJson(store)),
    resolvedProvider: { provider: "fixture-provider", model: "fixture-model", protocol: "openai-compatible", configHash: sha256(stableJson(providerConfig)) },
    featureFlags: currentFlags,
    budget: { maxTextCalls: 9, maxCallsPerSkill: 1, automaticRetries: 0, hotspotCalls: 0, imageCalls: 0, platformPublicationCalls: 0 },
    targets: {
      company: objectRef(company),
      accounts: { xiaohongshu: objectRef(xhs), wechat: objectRef(wechat) },
      activeStrategy: strategyRef(),
      contentOpportunity: objectRef(opportunity),
      mechanismDecision: objectRef(mechanism)
    },
    orchestrationInput: {
      project: {
        id: `project_${name}`,
        companyId: company.id,
        contentOpportunityRef: { id: opportunity.id, hash: opportunity.opportunityHash },
        activeStrategySnapshotRef: { id: strategyBusinessId, hash: strategyHash },
        designDnaSnapshotRef,
        accounts: { xiaohongshu: xhs.id, wechat: wechat.id },
        confirmations: { xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" } },
        skillExecutionOptions: { xiaohongshu: {}, wechat: {} }
      },
      mechanismDecision: mechanism,
      sourcePlan: { mode: "strategy_only", sources: [] },
      masterInput: { topic: "fixture" }
    }
  };
}

function liveTitleOutput(platform) {
  const motivations = ["balanced", "safe", "spread", "search", "evergreen"];
  return {
    stage: "final_after_body", platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu",
    title_brief: { content_type: "fixture", target_reader: "fixture", core_conclusion: "fixture", reader_takeaway: "fixture", strongest_evidence: ["F1"], real_entities: [], freshness_dependency: "none" },
    candidates: motivations.map((motivation, index) => ({ title_id: `T${index + 1}`, title: `title ${index + 1}`, motivation, method: "fixture", claim_ids: ["F1"], scores: { fulfillment: 5, relevance: 5, specificity: 5, curiosity: 5, clarity: 5, uniqueness: 5, overall: 5 }, risk: "low", risk_reasons: [] })),
    recommendations: { balanced: "T1", safe: "T2", spread: "T3", search: "T4", experiment: "T5" },
    ab_tests: [], same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" }
  };
}

const LIVE_OUTLINE_WRITER_ROLE_CASES = Object.freeze([
  { outlineRole: "hook", bodyRole: "scene", pageRole: "cover" },
  { outlineRole: "problem", bodyRole: "problem", pageRole: "problem" },
  { outlineRole: "diagnosis", bodyRole: "conclusion", pageRole: "conclusion" },
  { outlineRole: "evidence", bodyRole: "evidence", pageRole: "evidence" },
  { outlineRole: "method", bodyRole: "method", pageRole: "method" },
  { outlineRole: "example", bodyRole: "evidence", pageRole: "case" },
  { outlineRole: "action", bodyRole: "summary", pageRole: "cta" },
  { outlineRole: "boundary", bodyRole: "warning", pageRole: "warning" }
]);

function liveXhsWriterOutput() {
  const pages = LIVE_OUTLINE_WRITER_ROLE_CASES.map(({ pageRole }, index) => ({ page: index + 1, role: pageRole, objective: "fixture", takeaway: "fixture", text_layers: [{ type: "headline", text: `页面${index + 1}`, max_lines: 2, priority: 1 }], layout_hint: "fixture", visual_function: index === 0 ? "attention" : "explain", visual_need: "", render_strategy: "html_css", asset_ids: [], fact_ids: index === 0 ? ["F1"] : [], interpretation_ids: [], must_avoid: [] }));
  return {
    platform: "xiaohongshu", topic_id: opportunity.id, intent_profile_id: mechanism.projectInputRef.id, content_purpose_id: opportunity.contentObjective,
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "discovery_and_validation", trust_source: "institution" }, creative_mechanism: "checklist", journey_stage: "discover",
    matrix_coordination: { shared_campaign_topic_id: opportunity.id, differentiation_angle: "discovery_and_validation:场景触达与需求验证", prohibited_overlap: [] }, content_promise: "fixture",
    engagement_strategy: { mode: "auto", primary_action: "save", reason: "fixture", cta_placement: "ending", cta_text: "" },
    post_copy: { title_candidates: [1, 2, 3].map((index) => ({ title: `候选${index}`, hook_type: "result", claim_ids: ["F1"], risk: "low" })), recommended_title: "候选1", opening: "fixture", body_sections: LIVE_OUTLINE_WRITER_ROLE_CASES.map(({ bodyRole }, index) => ({ section_id: `S${index + 1}`, role: bodyRole, text: `fixture ${index + 1}`, claim_ids: ["F1"] })), ending: "fixture", pinned_comment: "", hashtags: ["a", "b", "c"], cta: "" },
    deck: { deck_id: "deck", canvas: { width: 1080, height: 1440, ratio: "3:4" }, design_dna_version: designDnaSnapshot.id, reading_arc: "fixture", pages }, image_specs: [],
    skipped_image_pages: pages.map((page) => ({ page: page.page, reason: "html_css" })),
    traceability: { used_fact_ids: ["F1"], used_interpretation_ids: [], used_knowledge_asset_ids: [], page_claim_map: pages.map((page) => ({ page: page.page, claim_ids: page.fact_ids })) },
    preflight_checks: ["promise_consistency", "claim_traceability", "image_text_separation", "page_non_repetition", "intent_and_promotion_alignment", "account_identity_alignment", "matrix_differentiation"].map((check) => ({ check, result: "pass", detail: "" }))
  };
}

function liveWechatWriterOutput() {
  const outline = ["问题", "方法", "边界"].map((heading, index) => ({ section_id: `W${index + 1}`, heading, purpose: "fixture", relation_to_previous: index === 0 ? "start" : index === 2 ? "limit" : "explain", claim_ids: index < 2 ? ["F1"] : [], boundary_to_cover: "" }));
  return {
    platform: "wechat_official_account", topic_id: opportunity.id, intent_profile_id: mechanism.projectInputRef.id, content_purpose_id: opportunity.contentObjective,
    account_context: { subject_type: "founder", account_mode: "founder_ip", matrix_role: "authority_and_conversion", trust_source: "experience" }, creative_mechanism: "framework", journey_stage: "convert",
    matrix_coordination: { shared_campaign_topic_id: opportunity.id, differentiation_angle: "authority_and_conversion:深度权威与业务承接", prohibited_overlap: [] }, article_promise: "fixture", core_argument: "fixture", information_gain: "fixture",
    title_candidates: [1, 2, 3].map((index) => ({ title: `公众号候选${index}`, approach: "method", claim_ids: ["F1"], risk: "low" })), recommended_title: "公众号候选1", abstract: "fixture", opening: { type: "conclusion", text: "fixture", claim_ids: ["F1"] }, outline,
    article_markdown: outline.map((item) => `## ${item.heading}\n\nfixture`).join("\n\n"), pull_quotes: [], key_takeaways: ["fixture"], share_summary: "fixture", share_reason: "fixture",
    discovery_plan: { subscription_value: "fixture", search_keywords: ["fixture"], recommendation_hook: "fixture", social_sharing_context: "fixture" }, relationship_handoff: { column: "", related_content_ids: [], menu_path: "", keyword_reply: "", follow_reason: "fixture", primary_next_step: "fixture" },
    engagement_strategy: { mode: "auto", primary_action: "share", reason: "fixture", cta_placement: "ending", cta_text: "" }, cta: "", claim_map: [{ claim_id: "F1", section_ids: ["W1", "W2"] }], used_knowledge_asset_ids: [], source_list: [{ source_id: "S1", title: "fixture" }], publish_time_checks: [{ fact_id: "F1", reason: "fixture", check_before: "publish" }],
    preflight_checks: ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"].map((check) => ({ check, result: ["marketing_disclosure", "relationship_handoff_validity"].includes(check) ? "not_applicable" : "pass", detail: "" }))
  };
}

function liveMatrixContractOutput(capability, platform, targetPlatform, mutate) {
  if (capability === "build-content-master") return {
    content_master_id: `master_matrix_${targetPlatform}`, confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }],
    supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "fixture" }],
    knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] }
  };
  if (capability === "generate-content-outline") return {
    outline_id: `outline_matrix_${platform}`, schema_version: "1.0", platform, topic: "fixture", content_promise: "fixture",
    content_function: "authority", content_purpose_id: "purpose", conversion_stage_id: "trust", opening_strategy: "fixture",
    sections: LIVE_OUTLINE_WRITER_ROLE_CASES.map(({ outlineRole }, index) => ({ section_id: `S${index + 1}`, heading: `heading ${index + 1}`, role: outlineRole, objective: "fixture", key_points: [], claim_ids: [], boundary: "" })),
    closing_strategy: "fixture", unresolved_questions: [], confirmation_required: true
  };
  if (capability === "write-xhs-content") {
    const output = liveXhsWriterOutput();
    if (targetPlatform === "xiaohongshu") mutate(output);
    return output;
  }
  if (capability === "generate-platform-titles") return liveTitleOutput(platform);
  if (capability === "write-wechat-article") {
    const output = liveWechatWriterOutput();
    if (targetPlatform === "wechat") mutate(output);
    return output;
  }
  throw Object.assign(new Error("matrix contract failure must stop before downstream Skills"), { code: "UNEXPECTED_PROVIDER_CALL" });
}

assert.deepEqual(parseUnifiedLiveCli([]), { mode: "dry-run", approvalFile: null, approvalSha256: null });
assert.deepEqual(parseUnifiedLiveCli(["--dry-run"]), { mode: "dry-run", approvalFile: null, approvalSha256: null });
assert.throws(() => parseUnifiedLiveCli(["--live"]), (error) => error.code === "UNIFIED_LIVE_CLI_ARGUMENTS_FORBIDDEN");
const defaultResult = await runUnifiedLiveCli([], { providerConfig, currentFlags });
assert.equal(defaultResult.providerCalls, 0);
assert.equal(defaultResult.externalCalls, 0);

const canonical = resolveCanonicalActiveStrategy(sourceDatabasePath, company, strategyRef());
assert.equal(canonical.canonical.id, strategyBusinessId, "business strategy id must come from strategy_snapshots.id");
assert.equal(canonical.canonical.accountId, company.id);
assert.equal(canonical.canonical.status, "active");
assert.equal(canonical.canonical.payload.positioning, strategyPayload.positioning);
assert.equal(store.accountStrategySnapshots.length, 2, "account projections intentionally contain duplicate active business strategy refs");
const duplicateDatabasePath = resolve(tmpRoot, "duplicate-active.db");
createFixtureDatabase(duplicateDatabasePath, { activeRows: 2 });
assert.throws(() => resolveCanonicalActiveStrategy(duplicateDatabasePath, company, strategyRef()), (error) => error.code === "LIVE_ACTIVE_STRATEGY_ROW_AMBIGUOUS");
const tamperedMetadataRef = strategyRef();
tamperedMetadataRef.rowMetadataHash = "0".repeat(64);
assert.throws(() => resolveCanonicalActiveStrategy(sourceDatabasePath, company, tamperedMetadataRef), (error) => error.code === "LIVE_ACTIVE_STRATEGY_ROW_METADATA_HASH_MISMATCH");
const tamperedPayloadRef = strategyRef();
tamperedPayloadRef.payloadHash = "0".repeat(64);
assert.throws(() => resolveCanonicalActiveStrategy(sourceDatabasePath, company, tamperedPayloadRef), (error) => error.code === "LIVE_ACTIVE_STRATEGY_PAYLOAD_HASH_MISMATCH");
const supersededDatabasePath = resolve(tmpRoot, "superseded-only.db");
createFixtureDatabase(supersededDatabasePath, { canonicalStatus: "superseded" });
assert.throws(() => resolveCanonicalActiveStrategy(supersededDatabasePath, company, strategyRef()), (error) => error.code === "LIVE_ACTIVE_STRATEGY_ROW_MISSING");

const dry = approvalFor("dry");
const dryPreflight = prepareUnifiedLivePreflight({ approval: dry, store, providerConfig, currentFlags });
dry.planHash = dryPreflight.planHash;
const dryApprovalPath = resolve(tmpRoot, "dry-approval.json");
writeFileSync(dryApprovalPath, JSON.stringify(dry));
const dryResult = await runUnifiedLiveCli(["--dry-run", "--approval-file", dryApprovalPath], { providerConfig, currentFlags });
assert.equal(dryResult.plan.calls.length, 9);
assert.equal(dryResult.plan.executionBudget.providerTextCalls, 9);
assert.equal(dryResult.plan.executionBudget.deterministicInvocations, 0);
assert.deepEqual(dryResult.plan.calls.map((call) => call.executionClass), Array(9).fill("provider_text"));
assert.deepEqual([...new Set(dryResult.plan.nodes.map((node) => node.executionClass))].sort(), ["binding", "deterministic", "human_gate", "provider_image", "provider_multimodal", "provider_text", "service"]);
assert.ok(["completed", "planned", "skipped", "waiting_condition"].every((state) => dryResult.plan.nodes.some((node) => node.state === state)));
assert.ok(dryResult.plan.nodes.every((node) => node.executionClass && node.phase && (node.state === "completed" || node.reason)));
const skillNodes = dryResult.plan.nodes.filter((node) => node.kind === "skill");
assert.ok(skillNodes.every((node) => ["completed", "planned", "waiting_condition", "skipped"].includes(node.state) && node.reason && ["stable", "stable_conditional"].includes(node.lifecycle)));
assert.deepEqual(new Set(dryResult.plan.skillCoverage.applicableCapabilities), new Set(["build-content-master", "generate-content-outline", "write-xhs-content", "write-wechat-article", "generate-platform-titles", "review-wechat-article", "plan-wechat-images", "design-xhs-integrated-pages", "review-xhs-visuals", "naturalize-copy", "revise-content-package", "analyze-viral-content", "viral-content-remixer"]));
assert.ok(Object.values(dryResult.plan.skillCoverage.skillNodeHashes).every((value) => /^[a-f0-9]{64}$/.test(value)));
assert.ok(dryResult.plan.nodes.filter((node) => node.capability === "viral-content-remixer").every((node) => node.state === "skipped" && node.reason === "compatibility_only_requires_explicit_authorized_reference"));
const wechatCapabilities = dryResult.plan.nodes.filter((node) => node.platform === "wechat" && node.kind === "skill").map((node) => node.capability);
assert.ok(["write-wechat-article", "review-wechat-article", "plan-wechat-images"].every((capability) => wechatCapabilities.includes(capability)));
assert.ok(dryResult.plan.nodes.filter((node) => ["write-wechat-article", "review-wechat-article", "plan-wechat-images"].includes(node.capability)).every((node) => node.state === "planned" && node.contractBoundary.invocationAuthority === "strict_skill_execution_plan"));
assert.ok(dryResult.plan.nodes.filter((node) => ["WechatHtmlFormatter", "WechatHtmlValidator"].includes(node.service)).every((node) => node.category === "service" && node.contractBoundary.skillInvocation === false));
assert.ok(dryResult.plan.nodes.filter((node) => ["naturalization", "revision"].includes(node.stepId)).every((node) => node.state === "skipped"));
assert.ok(dryResult.plan.stages.find((stage) => stage.id === "S2A")?.stageHash);
assert.ok(dryResult.plan.stages.find((stage) => stage.id === "S2B")?.stageHash);
assert.ok(dryResult.plan.stages.filter((stage) => !["S2A", "S2B"].includes(stage.id)).every((stage) => /^[a-f0-9]{64}$/.test(stage.stageHash)));
assert.ok(dryResult.plan.stages.every((stage) => stage.stopPoint && stage.budget.automaticRetries === 0));
assert.ok(dryResult.plan.nodes.every((node) => node.automaticRetries === 0 && node.failureRecovery.automaticRetry === false && node.failureRecovery.rerunFrom === node.stepId && node.failureRecovery.preserveCompletedUpstream === true));
assert.equal(dryResult.plan.executionBudget.automaticRetries, 0);
assert.equal(dryResult.plan.executionBudget.providerMultimodalCalls, 0);
assert.equal(dryResult.plan.executionBudget.conditionalProviderMultimodalCalls, 1);
assert.equal(dryResult.plan.currentStopPoint, "candidate_text_and_plan_only_no_provider_image_no_platform_publication");
assert.equal(dryResult.providerCalls, 0);
assert.equal(dryResult.productionDatabaseWrites, 0);
await assert.rejects(
  () => runUnifiedLiveCli(["--live", "--approval-file", dryApprovalPath, "--approval-sha256", "0".repeat(64)], { providerConfig, currentFlags }),
  (error) => error.code === "LIVE_APPROVAL_HASH_MISMATCH"
);

const designRequested = approvalFor("design-requested");
designRequested.featureFlags = { ...currentFlags, xhsIntegratedPageDesignSkill: true };
designRequested.orchestrationInput.project.skillExecutionOptions.xiaohongshu = { enableXhsIntegratedPageDesign: true };
const designPreflight = prepareUnifiedLivePreflight({ approval: designRequested, store, providerConfig, currentFlags: designRequested.featureFlags });
assert.equal(designPreflight.plan.calls.length, 9, "deterministic design must not consume text Provider budget");
assert.equal(designPreflight.plan.executionBudget.providerTextCalls, 9);
assert.equal(designPreflight.plan.executionBudget.deterministicInvocations, 1);
const designNode = designPreflight.plan.nodes.find((node) => node.capability === "design-xhs-integrated-pages");
assert.equal(designNode.executionClass, "deterministic");
assert.equal(designNode.state, "waiting_condition");
assert.equal(designNode.reason, "awaiting_master_run_candidate_and_visual_selection_bindings");
assert.equal(designNode.category, "deterministic_skill");
assert.equal(designNode.contractBoundary.conditionSatisfiedState, "planned");
assert.deepEqual(designNode.contractBoundary.executionProduces, ["prompt_set", "provider_execution_plan"]);
assert.equal(designNode.contractBoundary.providerCalls, 0);
const multimodalReviewNode = designPreflight.plan.nodes.find((node) => node.capability === "review-xhs-visuals");
assert.equal(multimodalReviewNode.executionClass, "provider_multimodal");
assert.equal(multimodalReviewNode.state, "waiting_condition");
assert.equal(multimodalReviewNode.contractBoundary.modality, "text_and_images");
assert.equal(multimodalReviewNode.contractBoundary.reviewScope, "whole_set");
assert.equal(multimodalReviewNode.contractBoundary.mayPassWithoutRenderedPages, false);
assert.equal(designPreflight.plan.calls.some((call) => call.capability === "review-xhs-visuals"), false, "multimodal review cannot be called before rendered PageRevisions exist");
const providerApprovalNode = designPreflight.plan.nodes.find((node) => node.service === "HumanProviderExecutionApproval");
const imageProviderNode = designPreflight.plan.nodes.find((node) => node.service === "XhsIntegratedPageImageProvider");
const visualSelectionNode = designPreflight.plan.nodes.find((node) => node.service === "UserVisualSelection");
assert.equal(providerApprovalNode.category, "human_gate");
assert.deepEqual(providerApprovalNode.contractBoundary.approvalBinds, ["design_evidence_hash", "provider_execution_plan_hash", "budget_hash"]);
assert.equal(imageProviderNode.category, "provider_image");
assert.deepEqual(imageProviderNode.dependsOn, [providerApprovalNode.id]);
assert.equal(visualSelectionNode.category, "human_gate");
assert.deepEqual(visualSelectionNode.contractBoundary.requires, ["multimodal_whole_set_review_pass", "exact_page_revision_set"]);
assert.equal(designPreflight.plan.executionBudget.providerImageCalls, 0);
const forgedDesignBindings = approvalFor("forged-design-bindings");
forgedDesignBindings.featureFlags = { ...currentFlags, xhsIntegratedPageDesignSkill: true };
forgedDesignBindings.orchestrationInput.project.skillExecutionOptions.xiaohongshu = { enableXhsIntegratedPageDesign: true, xhsDesignBindingsReady: true };
assert.throws(() => prepareUnifiedLivePreflight({ approval: forgedDesignBindings, store, providerConfig, currentFlags: forgedDesignBindings.featureFlags }), (error) => error.code === "LIVE_POST_CANDIDATE_BINDINGS_FORBIDDEN");

let mismatchedDelegateCalls = 0;
const mismatchLedger = createAtomicProviderLedger({ path: resolve(tmpRoot, "mismatch-ledger.json"), plan: dryResult.plan, delegate: async () => { mismatchedDelegateCalls += 1; } });
await assert.rejects(
  () => mismatchLedger.generateText({}, { liveInvocation: { ...dryResult.plan.calls[1] } }),
  (error) => error.code === "LIVE_CALL_IDENTITY_MISMATCH"
);
assert.equal(mismatchedDelegateCalls, 0);
assert.equal(mismatchLedger.state.entries.length, 0, "identity mismatch must not consume the next quota");
assert.equal(mismatchLedger.state.violation.consumedEntries, 0);

let providerCalls = 0;
const live = approvalFor("live");
live.planHash = prepareUnifiedLivePreflight({ approval: live, store, providerConfig, currentFlags }).planHash;
const liveHash = "a".repeat(64);
const liveResult = await executeUnifiedLive({
  approval: live,
  approvalFileHash: liveHash,
  operations: {
    providerConfig,
    currentFlags,
    generateText: async () => {
      providerCalls += 1;
      return { mode: "live", data: { fixture: true }, telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" } };
    },
    runProductEntry: async ({ generateText, plan }) => {
      for (const call of plan.calls) await generateText({ omitted: true }, { task: call.capability, liveInvocation: { ordinal: call.ordinal, capability: call.capability, platform: call.platform, stepId: call.stepId } });
      return { id: "product_fixture", productSnapshotHash: "f".repeat(64), actualInvocations: plan.calls.map((call) => ({ platform: call.platform, stepId: call.stepId, capability: call.capability, executionMode: "real", status: "completed" })) };
    }
  }
});
assert.equal(providerCalls, 9);
assert.equal(liveResult.providerCalls, 9);
assert.equal(liveResult.imageCalls, 0);
assert.equal(liveResult.hotspotCalls, 0);
assert.equal(liveResult.platformPublicationCalls, 0);
assert.equal(liveResult.platformPublished, false);
assert.equal(liveResult.currentStopPoint, "candidate_text_and_plan_only_no_provider_image_no_platform_publication");
assert.deepEqual(liveResult.skillCoverage.applicableCapabilities, live.planHash ? prepareUnifiedLivePreflight({ approval: live, store, providerConfig, currentFlags }).plan.skillCoverage.applicableCapabilities : []);
assert.ok(liveResult.stages.every((stage) => stage.stopPoint && stage.budget.automaticRetries === 0));
assert.equal(hashFile(sourceDatabasePath), live.sourceDatabaseSha256, "source database must remain unchanged");

let missingDnaProviderCalls = 0;
const missingDnaAuthority = approvalFor("missing-dna-authority");
delete missingDnaAuthority.orchestrationInput.project.designDnaSnapshotRef;
missingDnaAuthority.planHash = prepareUnifiedLivePreflight({ approval: missingDnaAuthority, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: missingDnaAuthority,
    approvalFileHash: "8".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async () => { missingDnaProviderCalls += 1; }
    }
  }),
  (error) => error.code === "UNIFIED_XHS_DESIGN_DNA_REFERENCE_REQUIRED"
);
assert.equal(missingDnaProviderCalls, 0, "missing Design DNA authority must stop before the first Provider call");
assert.equal(hashFile(sourceDatabasePath), missingDnaAuthority.sourceDatabaseSha256, "Design DNA precondition failure must not modify source database");

let actualServerAdapterAttempts = 0;
const actualRouteFailure = approvalFor("actual-route-failure");
actualRouteFailure.planHash = prepareUnifiedLivePreflight({ approval: actualRouteFailure, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: actualRouteFailure,
    approvalFileHash: "e".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async () => {
        actualServerAdapterAttempts += 1;
        throw Object.assign(new Error("fixture provider stop"), { code: "FIXTURE_PROVIDER_STOP" });
      }
    }
  }),
  (error) => error.stage === "master" && error.stepId === "content_master" && error.causeCode === "FIXTURE_PROVIDER_STOP"
);
assert.equal(actualServerAdapterAttempts, 1, "actual Live Server Adapter and Orchestrator path must enforce zero retry");
assert.equal(hashFile(sourceDatabasePath), actualRouteFailure.sourceDatabaseSha256, "actual adapter failure must not modify source database");

let outlineContractProviderCalls = 0;
const outlineContractFailure = approvalFor("outline-contract-failure");
outlineContractFailure.planHash = prepareUnifiedLivePreflight({ approval: outlineContractFailure, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: outlineContractFailure,
    approvalFileHash: "7".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async (_request, options) => {
        outlineContractProviderCalls += 1;
        const capability = options?.liveInvocation?.capability;
        if (capability === "build-content-master") return {
          mode: "live",
          data: {
            status: "success",
            data: {
              content_master_id: "master_outline_contract_fixture",
              confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }],
              supported_interpretations: [],
              author_opinions: [],
              source_list: [{ source_id: "S1", title: "fixture" }]
            },
            warnings: [],
            blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "generate-content-outline") return {
          mode: "live",
          data: {
            status: "ready",
            data: {
              outline_id: "outline_contract_fixture",
              schema_version: "1.0",
              platform: "xiaohongshu",
              topic: "PRIVATE_FIXTURE_CONTENT_MUST_NOT_ESCAPE",
              content_promise: "fixture",
              content_function: "authority",
              content_purpose_id: "fixture",
              conversion_stage_id: "fixture",
              opening_strategy: "fixture",
              sections: Array.from({ length: 3 }, (_, index) => ({
                section_id: `S${index + 1}`,
                ...(index === 1 ? {} : { heading: "fixture" }),
                role: index === 0 ? "hook" : "method",
                objective: "fixture",
                key_points: [],
                claim_ids: [],
                boundary: ""
              })),
              closing_strategy: "fixture",
              unresolved_questions: [],
              confirmation_required: true
            },
            warnings: [],
            blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        throw Object.assign(new Error("unexpected third provider call"), { code: "UNEXPECTED_PROVIDER_CALL" });
      }
    }
  }),
  (error) => error.stage === "outline"
    && error.stepId === "outline"
    && error.capability === "generate-content-outline"
    && error.causeCode === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["data.sections[].heading"])
);
assert.equal(outlineContractProviderCalls, 2, "outline contract failure must consume one master call and one outline call with zero retry");
const outlineContractLedger = JSON.parse(readFileSync(resolve(outlineContractFailure.destinationDataDir, "provider-ledger.json"), "utf8"));
assert.equal(outlineContractLedger.halted, true);
assert.deepEqual(outlineContractLedger.stop, {
  code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID",
  stage: "outline",
  platform: "xiaohongshu",
  stepId: "outline",
  capability: "generate-content-outline",
  fieldPaths: ["data.sections[].heading"]
});
assert.equal(JSON.stringify(outlineContractLedger).includes("PRIVATE_FIXTURE_CONTENT_MUST_NOT_ESCAPE"), false, "Live ledger must not persist field values, prompts, or Provider output");
const outlineContractDatabase = new DatabaseSync(resolve(outlineContractFailure.destinationDataDir, "flowsocial.db"), { readOnly: true });
try {
  const isolatedStore = JSON.parse(outlineContractDatabase.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
  assert.equal((isolatedStore.unifiedContentProjects || []).length, 0, "failed outline validation must not persist a product snapshot");
} finally {
  outlineContractDatabase.close();
}
assert.equal(hashFile(sourceDatabasePath), outlineContractFailure.sourceDatabaseSha256, "outline contract failure must not modify the source database");

let writerEnvelopeProviderCalls = 0;
const writerEnvelopeFailure = approvalFor("writer-envelope-failure");
writerEnvelopeFailure.planHash = prepareUnifiedLivePreflight({ approval: writerEnvelopeFailure, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: writerEnvelopeFailure,
    approvalFileHash: "6".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async (_request, options) => {
        writerEnvelopeProviderCalls += 1;
        const capability = options?.liveInvocation?.capability;
        if (capability === "build-content-master") return {
          mode: "live",
          data: {
            status: "success",
            data: {
              content_master_id: "master_writer_envelope_fixture",
              confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }],
              supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "fixture" }]
            },
            warnings: [], blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "generate-content-outline") return {
          mode: "live",
          data: {
            status: "ready",
            data: {
              outline_id: "outline_writer_envelope_fixture", schema_version: "1.0", platform: "xiaohongshu",
              topic: "fixture", content_promise: "fixture", content_function: "authority",
              content_purpose_id: "fixture", conversion_stage_id: "fixture", opening_strategy: "fixture",
              sections: Array.from({ length: 3 }, (_, index) => ({ section_id: `S${index + 1}`, heading: "fixture", role: index === 0 ? "hook" : "method", objective: "fixture", key_points: [], claim_ids: [], boundary: "" })),
              closing_strategy: "fixture", unresolved_questions: [], confirmation_required: true
            },
            warnings: [], blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "write-xhs-content") return {
          mode: "live",
          data: { status: "success", data: { platform: "xiaohongshu", private_fixture_value: "MUST_NOT_ESCAPE" } },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        throw Object.assign(new Error("unexpected fourth provider call"), { code: "UNEXPECTED_PROVIDER_CALL" });
      }
    }
  }),
  (error) => error.stage === "writer"
    && error.stepId === "platform_writer"
    && error.capability === "write-xhs-content"
    && error.causeCode === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["warnings", "blocked_reasons"])
);
assert.equal(writerEnvelopeProviderCalls, 3, "writer envelope failure must consume one call per reached Skill and never retry");
const writerEnvelopeLedger = JSON.parse(readFileSync(resolve(writerEnvelopeFailure.destinationDataDir, "provider-ledger.json"), "utf8"));
assert.deepEqual(writerEnvelopeLedger.stop, {
  code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID", stage: "writer", platform: "xiaohongshu",
  stepId: "platform_writer", capability: "write-xhs-content", fieldPaths: ["warnings", "blocked_reasons"]
});
assert.equal(JSON.stringify(writerEnvelopeLedger).includes("MUST_NOT_ESCAPE"), false, "Live ledger must contain paths only, never Provider field values");
const writerEnvelopeDatabase = new DatabaseSync(resolve(writerEnvelopeFailure.destinationDataDir, "flowsocial.db"), { readOnly: true });
try {
  const isolatedStore = JSON.parse(writerEnvelopeDatabase.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
  assert.equal((isolatedStore.unifiedContentProjects || []).length, 0, "failed writer envelope validation must not persist a product snapshot");
} finally {
  writerEnvelopeDatabase.close();
}
assert.equal(hashFile(sourceDatabasePath), writerEnvelopeFailure.sourceDatabaseSha256, "writer envelope failure must not modify the source database");

let writerNestedProviderCalls = 0;
const writerNestedFailure = approvalFor("writer-nested-failure");
writerNestedFailure.planHash = prepareUnifiedLivePreflight({ approval: writerNestedFailure, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: writerNestedFailure,
    approvalFileHash: "4".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async (_request, options) => {
        writerNestedProviderCalls += 1;
        const capability = options?.liveInvocation?.capability;
        if (capability === "build-content-master") return {
          mode: "live",
          data: {
            status: "success",
            data: {
              content_master_id: "master_writer_nested_fixture",
              confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }],
              supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "fixture" }]
            },
            warnings: [], blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "generate-content-outline") return {
          mode: "live",
          data: {
            status: "ready",
            data: {
              outline_id: "outline_writer_nested_fixture", schema_version: "1.0", platform: "xiaohongshu",
              topic: "fixture", content_promise: "fixture", content_function: "authority",
              content_purpose_id: "fixture", conversion_stage_id: "fixture", opening_strategy: "fixture",
              sections: LIVE_OUTLINE_WRITER_ROLE_CASES.map(({ outlineRole }, index) => ({ section_id: `S${index + 1}`, heading: `fixture ${index + 1}`, role: outlineRole, objective: "fixture", key_points: [], claim_ids: [], boundary: "" })),
              closing_strategy: "fixture", unresolved_questions: [], confirmation_required: true
            },
            warnings: [], blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "write-xhs-content") {
          const invalid = liveXhsWriterOutput();
          delete invalid.traceability;
          delete invalid.preflight_checks;
          return {
            mode: "live",
            data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] },
            telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
          };
        }
        throw Object.assign(new Error("unexpected fourth provider call"), { code: "UNEXPECTED_PROVIDER_CALL" });
      }
    }
  }),
  (error) => error.stage === "writer"
    && error.stepId === "platform_writer"
    && error.capability === "write-xhs-content"
    && error.causeCode === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["data.traceability", "data.preflight_checks"])
);
assert.equal(writerNestedProviderCalls, 3, "missing Writer evidence roots must consume one call per reached Skill and stop before titles");
const writerNestedLedger = JSON.parse(readFileSync(resolve(writerNestedFailure.destinationDataDir, "provider-ledger.json"), "utf8"));
assert.deepEqual(writerNestedLedger.stop, {
  code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID", stage: "writer", platform: "xiaohongshu",
  stepId: "platform_writer", capability: "write-xhs-content",
  fieldPaths: ["data.traceability", "data.preflight_checks"]
});
assert.equal(JSON.stringify(writerNestedLedger).includes("TypeError"), false, "Live ledger must persist safe evidence-root paths, never native error text");
const writerNestedDatabase = new DatabaseSync(resolve(writerNestedFailure.destinationDataDir, "flowsocial.db"), { readOnly: true });
try {
  const isolatedStore = JSON.parse(writerNestedDatabase.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
  assert.equal((isolatedStore.unifiedContentProjects || []).length, 0, "missing Writer evidence roots must not persist a product snapshot");
} finally {
  writerNestedDatabase.close();
}
assert.equal(hashFile(sourceDatabasePath), writerNestedFailure.sourceDatabaseSha256, "nested writer failure must not modify the source database");

for (const targetPlatform of ["xiaohongshu", "wechat"]) {
  for (const [caseId, mutate] of [
    ["missing", (output) => { delete output.matrix_coordination.shared_campaign_topic_id; }],
    ["null", (output) => { output.matrix_coordination.shared_campaign_topic_id = null; }],
    ["non-string", (output) => { output.matrix_coordination.shared_campaign_topic_id = ["PRIVATE_INVALID_CAMPAIGN_ID"]; }]
  ]) {
    let matrixProviderCalls = 0;
    const matrixFailure = approvalFor(`writer-matrix-${targetPlatform}-${caseId}`);
    const matrixPreflight = prepareUnifiedLivePreflight({ approval: matrixFailure, store, providerConfig, currentFlags });
    matrixFailure.planHash = matrixPreflight.planHash;
    const expectedCapability = targetPlatform === "wechat" ? "write-wechat-article" : "write-xhs-content";
    const expectedFieldPaths = caseId === "missing"
      ? ["data.matrix_coordination", "data.matrix_coordination.shared_campaign_topic_id"]
      : ["data.matrix_coordination.shared_campaign_topic_id"];
    const writerOrdinal = matrixPreflight.plan.calls.find((call) => call.platform === targetPlatform && call.capability === expectedCapability).ordinal;
    await assert.rejects(
      () => executeUnifiedLive({
        approval: matrixFailure,
        approvalFileHash: "7".repeat(64),
        operations: {
          providerConfig,
          currentFlags,
          generateText: async (_request, options) => {
            matrixProviderCalls += 1;
            const capability = options?.liveInvocation?.capability;
            const platform = options?.liveInvocation?.platform;
            const data = liveMatrixContractOutput(capability, platform, targetPlatform, mutate);
            return {
              mode: "live",
              data: { status: capability === "generate-content-outline" ? "ready" : "success", data, warnings: [], blocked_reasons: [] },
              telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
            };
          }
        }
      }),
      (error) => error.stage === "writer"
        && error.stepId === "platform_writer"
        && error.capability === expectedCapability
        && error.causeCode === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
        && JSON.stringify(error.fieldPaths) === JSON.stringify(expectedFieldPaths)
    );
    assert.equal(matrixProviderCalls, writerOrdinal, `${targetPlatform} ${caseId} campaign value must call every reached Skill once, use zero retry, and stop before downstream Skills`);
    const matrixLedger = JSON.parse(readFileSync(resolve(matrixFailure.destinationDataDir, "provider-ledger.json"), "utf8"));
    assert.deepEqual(matrixLedger.stop, {
      code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID", stage: "writer", platform: targetPlatform,
      stepId: "platform_writer", capability: expectedCapability, fieldPaths: expectedFieldPaths
    });
    assert.equal(JSON.stringify(matrixLedger).includes("PRIVATE_INVALID_CAMPAIGN_ID"), false, "Live ledger must not persist invalid Provider field values");
    const matrixDatabase = new DatabaseSync(resolve(matrixFailure.destinationDataDir, "flowsocial.db"), { readOnly: true });
    try {
      const isolatedStore = JSON.parse(matrixDatabase.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
      assert.equal((isolatedStore.unifiedContentProjects || []).length, 0, `${targetPlatform} ${caseId} campaign failure must not persist a product snapshot`);
    } finally {
      matrixDatabase.close();
    }
    assert.equal(hashFile(sourceDatabasePath), matrixFailure.sourceDatabaseSha256, `${targetPlatform} ${caseId} campaign failure must not modify the source database`);
  }
}

let writerSemanticProviderCalls = 0;
const writerSemanticFailure = approvalFor("writer-semantic-failure");
writerSemanticFailure.planHash = prepareUnifiedLivePreflight({ approval: writerSemanticFailure, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: writerSemanticFailure,
    approvalFileHash: "7".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async (_request, options) => {
        writerSemanticProviderCalls += 1;
        const capability = options?.liveInvocation?.capability;
        if (capability === "build-content-master") return {
          mode: "live",
          data: {
            status: "success",
            data: {
              content_master_id: "master_writer_semantic_fixture",
              confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }],
              supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "fixture" }]
            },
            warnings: [], blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "generate-content-outline") return {
          mode: "live",
          data: {
            status: "ready",
            data: {
              outline_id: "outline_writer_semantic_fixture", schema_version: "1.0", platform: "xiaohongshu",
              topic: "fixture", content_promise: "fixture", content_function: "authority",
              content_purpose_id: "fixture", conversion_stage_id: "fixture", opening_strategy: "fixture",
              sections: LIVE_OUTLINE_WRITER_ROLE_CASES.map(({ outlineRole }, index) => ({ section_id: `S${index + 1}`, heading: `fixture ${index + 1}`, role: outlineRole, objective: "fixture", key_points: [], claim_ids: [], boundary: "" })),
              closing_strategy: "fixture", unresolved_questions: [], confirmation_required: true
            },
            warnings: [], blocked_reasons: []
          },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "write-xhs-content") {
          const invalid = liveXhsWriterOutput();
          invalid.deck.pages[2].render_strategy = "generated_raster";
          invalid.deck.pages[2].asset_ids = ["xhs-semantic-p03-bg"];
          invalid.image_specs = [{
            asset_id: "PRIVATE_SEMANTIC_ASSET_MISMATCH", page: 3, use_case: "stylized-concept", asset_type: "scene-illustration",
            scene: "fixture", subject: "fixture", style_and_medium: "fixture", composition: "fixture", lighting: "fixture",
            palette: ["neutral"], materials: "fixture", text_safe_area: "center", prompt: "fixture without text",
            negative_prompt: "text, letters, numbers, watermark, logo", reference_asset_ids: [], design_dna_version: designDnaSnapshot.id,
            size: "1024x1536", must_keep: [], must_avoid: [], text_policy: "no_text_in_image"
          }];
          invalid.skipped_image_pages = invalid.skipped_image_pages.filter((item) => item.page !== 3);
          invalid.preflight_checks = invalid.preflight_checks.filter((item) => item.check !== "claim_traceability");
          return { mode: "live", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" } };
        }
        throw Object.assign(new Error("unexpected fourth provider call"), { code: "UNEXPECTED_PROVIDER_CALL" });
      }
    }
  }),
  (error) => error.stage === "writer"
    && error.stepId === "platform_writer"
    && error.capability === "write-xhs-content"
    && error.causeCode === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["data.image_spec_alignment.page_asset_binding", "data.preflight_checks.claim_traceability"])
);
assert.equal(writerSemanticProviderCalls, 3, "semantic writer failure must call each reached Skill once with zero retry and no downstream call");
const writerSemanticLedger = JSON.parse(readFileSync(resolve(writerSemanticFailure.destinationDataDir, "provider-ledger.json"), "utf8"));
assert.deepEqual(writerSemanticLedger.stop, {
  code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID", stage: "writer", platform: "xiaohongshu",
  stepId: "platform_writer", capability: "write-xhs-content",
  fieldPaths: ["data.image_spec_alignment.page_asset_binding", "data.preflight_checks.claim_traceability"]
});
assert.equal(JSON.stringify(writerSemanticLedger).includes("PRIVATE_SEMANTIC_ASSET_MISMATCH"), false, "Live ledger must persist fixed safe semantic paths only");
const writerSemanticDatabase = new DatabaseSync(resolve(writerSemanticFailure.destinationDataDir, "flowsocial.db"), { readOnly: true });
try {
  const isolatedStore = JSON.parse(writerSemanticDatabase.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
  assert.equal((isolatedStore.unifiedContentProjects || []).length, 0, "failed semantic writer validation must not persist a product snapshot");
} finally {
  writerSemanticDatabase.close();
}
assert.equal(hashFile(sourceDatabasePath), writerSemanticFailure.sourceDatabaseSha256, "semantic writer failure must not modify the source database");

let writerDnaMismatchCalls = 0;
const writerDnaMismatch = approvalFor("writer-dna-mismatch");
writerDnaMismatch.planHash = prepareUnifiedLivePreflight({ approval: writerDnaMismatch, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: writerDnaMismatch,
    approvalFileHash: "9".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async (_request, options) => {
        writerDnaMismatchCalls += 1;
        const capability = options?.liveInvocation?.capability;
        if (capability === "build-content-master") return {
          mode: "live", data: { status: "success", data: { content_master_id: "master_writer_dna_fixture", confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }], supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "fixture" }] }, warnings: [], blocked_reasons: [] },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "generate-content-outline") return {
          mode: "live", data: { status: "ready", data: { outline_id: "outline_writer_dna_fixture", schema_version: "1.0", platform: "xiaohongshu", topic: "fixture", content_promise: "fixture", content_function: "authority", content_purpose_id: "fixture", conversion_stage_id: "fixture", opening_strategy: "fixture", sections: LIVE_OUTLINE_WRITER_ROLE_CASES.map(({ outlineRole }, index) => ({ section_id: `S${index + 1}`, heading: `fixture ${index + 1}`, role: outlineRole, objective: "fixture", key_points: [], claim_ids: [], boundary: "" })), closing_strategy: "fixture", unresolved_questions: [], confirmation_required: true }, warnings: [], blocked_reasons: [] },
          telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" }
        };
        if (capability === "write-xhs-content") {
          const invalid = liveXhsWriterOutput();
          invalid.deck.design_dna_version = "wrong_dna";
          return { mode: "live", data: { status: "success", data: invalid, warnings: [], blocked_reasons: [] }, telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" } };
        }
        throw Object.assign(new Error("unexpected fourth provider call"), { code: "UNEXPECTED_PROVIDER_CALL" });
      }
    }
  }),
  (error) => error.stage === "writer"
    && error.stepId === "platform_writer"
    && error.causeCode === "UNIFIED_XHS_WRITER_DESIGN_DNA_BINDING_MISMATCH"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["data.deck.design_dna_version"])
);
assert.equal(writerDnaMismatchCalls, 3, "Writer Design DNA mismatch must stop before title generation with zero retry");
const writerDnaMismatchLedger = JSON.parse(readFileSync(resolve(writerDnaMismatch.destinationDataDir, "provider-ledger.json"), "utf8"));
assert.deepEqual(writerDnaMismatchLedger.stop, {
  code: "UNIFIED_XHS_WRITER_DESIGN_DNA_BINDING_MISMATCH", stage: "writer", platform: "xiaohongshu",
  stepId: "platform_writer", capability: "write-xhs-content", fieldPaths: ["data.deck.design_dna_version"]
});
assert.equal(hashFile(sourceDatabasePath), writerDnaMismatch.sourceDatabaseSha256, "Writer Design DNA mismatch must not modify source database");

let wechatReviewBlockCalls = 0;
const run09ShapedWriterContexts = [];
const wechatReviewBlock = approvalFor("wechat-review-block");
assert.equal(wechatReviewBlock.orchestrationInput.project.platformInputs, undefined, "RUN-09-shaped approval must not require test-only platformInputs");
const wechatReviewPreflight = prepareUnifiedLivePreflight({ approval: wechatReviewBlock, store, providerConfig, currentFlags });
wechatReviewBlock.planHash = wechatReviewPreflight.planHash;
const wechatReviewOrdinal = wechatReviewPreflight.plan.calls.find((call) => call.capability === "review-wechat-article").ordinal;
await assert.rejects(
  () => executeUnifiedLive({
    approval: wechatReviewBlock,
    approvalFileHash: "5".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async (_request, options) => {
        wechatReviewBlockCalls += 1;
        const capability = options?.liveInvocation?.capability;
        const platform = options?.liveInvocation?.platform;
        if (["write-xhs-content", "write-wechat-article"].includes(capability)) run09ShapedWriterContexts.push(structuredClone(_request.input.writer_context));
        let data;
        let status = capability === "generate-content-outline" ? "ready" : "success";
        if (capability === "build-content-master") data = {
          content_master_id: "master_wechat_review_fixture", confirmed_facts: [{ fact_id: "F1", fact: "fixture", source_ids: ["S1"] }],
          supported_interpretations: [], author_opinions: [], source_list: [{ source_id: "S1", title: "fixture" }],
          knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] }
        };
        else if (capability === "generate-content-outline") data = {
          outline_id: `outline_${platform}`, schema_version: "1.0", platform, topic: "fixture", content_promise: "fixture", content_function: "authority", content_purpose_id: "purpose", conversion_stage_id: "trust", opening_strategy: "fixture",
          sections: Array.from({ length: 3 }, (_, index) => ({ section_id: `S${index + 1}`, heading: `heading ${index + 1}`, role: index === 0 ? "hook" : "method", objective: "fixture", key_points: [], claim_ids: [], boundary: "" })), closing_strategy: "fixture", unresolved_questions: [], confirmation_required: true
        };
        else if (capability === "write-xhs-content") data = liveXhsWriterOutput();
        else if (capability === "write-wechat-article") data = liveWechatWriterOutput();
        else if (capability === "generate-platform-titles") data = liveTitleOutput(platform);
        else if (capability === "review-wechat-article") data = { decision: "block", findings: [{ finding_id: "WR01", category: "fact", location: "W1", severity: "blocker", issue: "fixture issue", required_action: "fixture action", claim_ids: ["F1"] }], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
        else throw Object.assign(new Error("image plan must not be called after review block"), { code: "UNEXPECTED_PROVIDER_CALL" });
        return { mode: "live", data: { status, data, warnings: [], blocked_reasons: [] }, telemetry: { providerSucceeded: true, fallbackUsed: false, costStatus: "fixture_zero_cost" } };
      }
    }
  }),
  (error) => error.stage === "review_render"
    && error.stepId === "wechat_content_review"
    && error.capability === "review-wechat-article"
    && error.causeCode === "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["data.review_readiness"])
);
assert.equal(wechatReviewBlockCalls, wechatReviewOrdinal, "review block must stop at its first call and before image planning");
assert.deepEqual(run09ShapedWriterContexts.map((context) => context.account_context.matrix_role), ["discovery_and_validation", "authority_and_conversion"]);
assert.deepEqual(run09ShapedWriterContexts.map((context) => context.matrix_coordination.differentiation_angle), ["discovery_and_validation:场景触达与需求验证", "authority_and_conversion:深度权威与业务承接"]);
assert.ok(run09ShapedWriterContexts.every((context) => context.writerContextHash && context.topic_id === opportunity.id && context.intent_profile_id === mechanism.projectInputRef.id && context.content_purpose_id === opportunity.contentObjective));
const wechatReviewLedger = JSON.parse(readFileSync(resolve(wechatReviewBlock.destinationDataDir, "provider-ledger.json"), "utf8"));
assert.deepEqual(wechatReviewLedger.stop, { code: "UNIFIED_SKILL_OUTPUT_STATUS_NOT_READY", stage: "review_render", platform: "wechat", stepId: "wechat_content_review", capability: "review-wechat-article", fieldPaths: ["data.review_readiness"] });
assert.equal(JSON.stringify(wechatReviewLedger).includes("fixture issue"), false, "review ledger must persist field paths without review content");
const wechatReviewDatabase = new DatabaseSync(resolve(wechatReviewBlock.destinationDataDir, "flowsocial.db"), { readOnly: true });
try {
  const isolatedStore = JSON.parse(wechatReviewDatabase.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
  assert.equal((isolatedStore.unifiedContentProjects || []).length, 0, "review block must not persist a product snapshot");
} finally {
  wechatReviewDatabase.close();
}
assert.equal(hashFile(sourceDatabasePath), wechatReviewBlock.sourceDatabaseSha256, "review block must not modify the source database");

const tamperedBudget = approvalFor("tampered-budget");
tamperedBudget.budget.maxTextCalls = 8;
assert.throws(() => prepareUnifiedLivePreflight({ approval: tamperedBudget, store, providerConfig, currentFlags }), (error) => error.code === "LIVE_BUDGET_INVALID");
const missing = approvalFor("missing");
delete missing.targets.contentOpportunity;
delete missing.targets.mechanismDecision;
const missingStore = { ...structuredClone(store), unifiedContentOpportunities: [], unifiedContentMechanismDecisions: [] };
assert.equal(missingStore.contentOpportunities.length, 1, "legacy opportunity remains present and must not be used as launcher fallback");
const missingReadiness = inspectUnifiedLiveReadiness({ approval: missing, store: missingStore, providerConfig, currentFlags });
assert.equal(missingReadiness.status, "blocked_prerequisites");
assert.deepEqual(missingReadiness.blockers.map((item) => item.code), ["LIVE_CONTENT_OPPORTUNITY_MISSING", "LIVE_MECHANISM_DECISION_MISSING"]);
assert.equal(missingReadiness.preparationPlan.launcherWrites, false);
assert.equal(missingReadiness.preparationPlan.mode, "official_product_entry_in_isolated_copy");
assert.equal(missingReadiness.providerCalls, 0);
assert.throws(() => prepareUnifiedLivePreflight({ approval: missing, store: missingStore, providerConfig, currentFlags }), (error) => error.code === "LIVE_PREREQUISITES_MISSING");
const missingDatabasePath = resolve(tmpRoot, "missing-prerequisites.db");
createFixtureDatabase(missingDatabasePath, { state: missingStore });
missing.sourceDatabasePath = missingDatabasePath;
missing.sourceDatabaseSha256 = hashFile(missingDatabasePath);
missing.destinationDatabaseSha256 = sha256(stableJson(missingStore));
const missingApprovalPath = resolve(tmpRoot, "missing-prerequisites-approval.json");
writeFileSync(missingApprovalPath, JSON.stringify(missing));
const missingDryRun = await runUnifiedLiveCli(["--dry-run", "--approval-file", missingApprovalPath], { providerConfig, currentFlags });
assert.equal(missingDryRun.status, "blocked_prerequisites");
assert.equal(missingDryRun.providerCalls, 0);
assert.equal(missingDryRun.externalCalls, 0);
assert.equal(missingDryRun.productionDatabaseWrites, 0);
const tamperedStrategyRef = approvalFor("tampered-strategy-ref");
tamperedStrategyRef.orchestrationInput.project.activeStrategySnapshotRef.hash = "9".repeat(64);
assert.throws(() => prepareUnifiedLivePreflight({ approval: tamperedStrategyRef, store, providerConfig, currentFlags }), (error) => error.code === "LIVE_ACTIVE_STRATEGY_REF_HASH_MISMATCH");
const drift = approvalFor("flag-drift");
assert.throws(() => prepareUnifiedLivePreflight({ approval: drift, store, providerConfig, currentFlags: { ...currentFlags, xhsIntegratedPageDesignSkill: true } }), (error) => error.code === "LIVE_FEATURE_FLAG_DRIFT");
const providerDrift = approvalFor("provider-drift");
assert.throws(() => prepareUnifiedLivePreflight({ approval: providerDrift, store, providerConfig: { changed: true }, currentFlags }), (error) => error.code === "LIVE_PROVIDER_CONFIG_DRIFT");

let planTamperCalls = 0;
const planTamper = approvalFor("plan-tamper");
planTamper.planHash = "0".repeat(64);
await assert.rejects(
  () => executeUnifiedLive({ approval: planTamper, approvalFileHash: "d".repeat(64), operations: { providerConfig, currentFlags, generateText: async () => { planTamperCalls += 1; } } }),
  (error) => error.code === "LIVE_PLAN_HASH_MISMATCH"
);
assert.equal(planTamperCalls, 0);

assert.throws(() => validateIsolationPaths({ sourceDatabasePath, destinationDataDir: resolve(tmpRoot, "../../escape") }), (error) => error.code === "LIVE_DESTINATION_OUTSIDE_TMP");
try {
  const link = resolve(tmpRoot, "linked-destination");
  symlinkSync(resolve(tmpRoot, "real-destination"), link, "junction");
  assert.throws(() => validateIsolationPaths({ sourceDatabasePath, destinationDataDir: link }), (error) => error.code === "LIVE_PATH_LINK_FORBIDDEN");
} catch (error) {
  if (!["EPERM", "EACCES", "ENOENT"].includes(error?.code)) throw error;
}

let failedDelegateCalls = 0;
const retry = approvalFor("retry");
retry.planHash = prepareUnifiedLivePreflight({ approval: retry, store, providerConfig, currentFlags }).planHash;
await assert.rejects(
  () => executeUnifiedLive({
    approval: retry,
    approvalFileHash: "b".repeat(64),
    operations: {
      providerConfig,
      currentFlags,
      generateText: async () => { failedDelegateCalls += 1; throw Object.assign(new Error("private provider detail"), { code: "PROVIDER_503" }); },
      runProductEntry: async ({ generateText, plan }) => {
        const identity = { ordinal: plan.calls[0].ordinal, capability: plan.calls[0].capability, platform: plan.calls[0].platform, stepId: plan.calls[0].stepId };
        await assert.rejects(() => generateText("secret prompt", { liveInvocation: identity }), (error) => error.code === "PROVIDER_503");
        await generateText("must not leave process", { liveInvocation: identity });
      }
    }
  }),
  (error) => error.code === "LIVE_LEDGER_HALTED"
);
assert.equal(failedDelegateCalls, 1, "retry attempt must be rejected locally before provider");

const noApproval = approvalFor("no-approval");
noApproval.approved = false;
await assert.rejects(() => executeUnifiedLive({ approval: noApproval, approvalFileHash: "c".repeat(64), operations: { providerConfig, currentFlags } }), (error) => error.code === "LIVE_EXPLICIT_APPROVAL_REQUIRED");

rmSync(tmpRoot, { recursive: true, force: true });
console.log(JSON.stringify({
  status: "unified-content-live-entry-self-test passed",
  plannedTextCalls: dryResult.plan.calls.length,
  fixtureProviderCalls: providerCalls,
  actualServerAdapterAttempts,
  outlineContractProviderCalls,
  failedProviderCalls: failedDelegateCalls,
  externalCalls: 0,
  productionDatabaseWrites: 0,
  automaticRetries: 0
}, null, 2));
