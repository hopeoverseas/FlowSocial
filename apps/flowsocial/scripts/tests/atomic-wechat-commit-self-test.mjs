import assert from "node:assert/strict";
import {
  createUnifiedWriterContext,
  hashUnifiedContent,
  withUnifiedContentHash
} from "../../content-agent/unified-content-contracts.mjs";
import {
  createExecutionAuthorityBinding,
  createSkillActivityInvocation
} from "../../content-agent/unified-execution-contracts.mjs";
import { validateUnifiedSkillDomainOutput } from "../../content-agent/unified-skill-output-contracts.mjs";
import { compileWechatRuntimeOutput } from "../../content-agent/wechat-creative-draft-compiler.mjs";
import {
  createUnifiedAtomicWechatContentCommit,
  validateUnifiedAtomicWechatContentCommit
} from "../../content-agent/unified-atomic-wechat-commit.mjs";
import { createUnifiedAtomicContentCommitStore } from "../../content-agent/unified-atomic-content-commit-store.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";
import { createUnifiedSkillActivityExecutor } from "../../content-agent/unified-skill-activity-executor.mjs";
import { projectWechatImageRuntimeCapability } from "../../content-agent/wechat-image-plan-adapter.mjs";
import { runUnifiedAtomicWechatCommitOrchestration } from "../../content-agent/unified-content-orchestrator.mjs";
import {
  appendUnifiedWechatStageCheckpoint,
  resolveUnifiedWechatStageCheckpoint
} from "../../content-agent/unified-wechat-stage-checkpoint.mjs";

const ref = (id, token) => ({ id, hash: token.repeat(64).slice(0, 64) });
const declaredRef = (value, field) => ({ id: value.id, hash: value[field] });
const envelope = (data, status = "success") => ({ status, data, warnings: [], blocked_reasons: [] });

function identity() {
  const base = { id: "project-wechat", companyId: "company", contentOpportunityRef: ref("opportunity", "1"), activeStrategySnapshotRef: ref("strategy", "2") };
  return { ...base, identityHash: hashUnifiedContent(base) };
}

function mechanismDecision(sourceRef) {
  return withUnifiedContentHash({
    schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "decision-wechat", companyId: "company",
    projectInputRef: ref("project-input", "3"), activeStrategySnapshotRef: ref("strategy", "2"),
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms: [{ mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", candidates: [{ sourceRef, status: "selected", reason: "fixture authority" }], reason: "fixture authority", factPolicy: null }],
    selectedSourceRefs: [sourceRef], strategyHotspotPolicy: "disabled", deviation: { status: "none", reason: null, confirmationEventRef: null },
    decidedAt: "2026-08-07T08:00:00.000Z", decisionHash: ""
  }, "decisionHash");
}

function master() {
  const contentMaster = {
    content_master_id: "master-wechat", topic_id: "topic", intent_profile_id: "intent",
    confirmed_facts: [{ fact_id: "F1", fact: "Every stage is independently recorded.", source_ids: ["S1"] }],
    supported_interpretations: [], author_opinions: [],
    knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] },
    source_list: [{ source_id: "S1", title: "Fixture source" }]
  };
  return { schemaVersion: "1.0", contract: "SharedContentMaster@1.0", id: "master-wechat", contentMaster };
}

function outline() {
  return {
    outline_id: "outline-wechat", schema_version: "1.0", platform: "wechat", topic: "Atomic WeChat", content_promise: "A controlled chain",
    content_function: "authority", content_purpose_id: "knowledge_howto", conversion_stage_id: "trust", opening_strategy: "conclusion first",
    sections: ["Authority", "Review", "Plan"].map((heading, index) => ({ section_id: `W${index + 1}`, heading, role: ["hook", "evidence", "action"][index], objective: "fixture", key_points: [], claim_ids: index < 2 ? ["F1"] : [], boundary: "" })),
    closing_strategy: "summary", unresolved_questions: [], confirmation_required: true
  };
}

export function wechatArticleFixture(writerContext) {
  const sections = [
    { section_id: "W1", heading: "Authority", purpose: "establish authority", relation_to_previous: "start", claim_ids: ["F1"], boundary_to_cover: "" },
    { section_id: "W2", heading: "Review", purpose: "explain review", relation_to_previous: "support", claim_ids: ["F1"], boundary_to_cover: "" },
    { section_id: "W3", heading: "Plan", purpose: "explain image plan", relation_to_previous: "conclude", claim_ids: [], boundary_to_cover: "" }
  ];
  return {
    platform: "wechat_official_account", topic_id: writerContext.topic_id, intent_profile_id: writerContext.intent_profile_id,
    content_purpose_id: writerContext.content_purpose_id,
    account_context: { subject_type: writerContext.account_context.subject_type, account_mode: writerContext.account_context.account_mode, matrix_role: writerContext.account_context.matrix_role, trust_source: writerContext.account_context.trust_source },
    creative_mechanism: writerContext.creative_mechanism, journey_stage: writerContext.journey_stage,
    matrix_coordination: { shared_campaign_topic_id: writerContext.matrix_coordination.shared_campaign_topic_id, differentiation_angle: writerContext.matrix_coordination.differentiation_angle, prohibited_overlap: writerContext.matrix_coordination.prohibited_overlap },
    article_promise: "Explain a controlled independent WeChat chain.", core_argument: "Independent facts prevent hidden authority mixing.", information_gain: "Separates three formal stages.",
    title_candidates: [
      { title: "Controlled WeChat chain", approach: "method", claim_ids: ["F1"], risk: "low" },
      { title: "Why three stages matter", approach: "question", claim_ids: ["F1"], risk: "low" },
      { title: "Stop mixed authority", approach: "conclusion", claim_ids: ["F1"], risk: "low" }
    ],
    recommended_title: "Controlled WeChat chain", abstract: "A bounded atomic chain.", opening: { type: "conclusion", text: "One file is not proof of one authority.", claim_ids: ["F1"] },
    outline: sections,
    article_markdown: sections.map((item) => `## ${item.heading}\n\n${"A controlled stage preserves exact upstream references. ".repeat(8)}`).join("\n\n"),
    pull_quotes: [{ text: "Every stage is independently recorded.", claim_ids: ["F1"] }], key_takeaways: ["one authority", "three formal facts"],
    share_summary: "Controlled chain", share_reason: "Useful for reviewers",
    discovery_plan: { subscription_value: "repeatable workflows", search_keywords: ["content workflow"], recommendation_hook: "three stages", social_sharing_context: "team review" },
    relationship_handoff: { column: "", related_content_ids: [], menu_path: "", keyword_reply: "", follow_reason: "continue learning", primary_next_step: "review the facts" },
    engagement_strategy: { mode: "auto", primary_action: "share", reason: "team review", cta_placement: "ending", cta_text: "Share with the reviewer." }, cta: "Share with the reviewer.",
    claim_map: [{ claim_id: "F1", section_ids: ["W1", "W2"] }], used_knowledge_asset_ids: [], source_list: [{ source_id: "S1", title: "Fixture source" }],
    publish_time_checks: [{ fact_id: "F1", reason: "recheck before publication", check_before: "publish" }],
    preflight_checks: ["title_body_alignment", "argument_continuity", "claim_traceability", "marketing_disclosure", "intent_and_promotion_alignment", "account_identity_alignment", "relationship_handoff_validity", "matrix_differentiation"]
      .map((check) => ({ check, result: ["marketing_disclosure", "relationship_handoff_validity", "matrix_differentiation"].includes(check) ? "not_applicable" : "pass", detail: "fixture" }))
  };
}

function outputFact({ invocation, stepId, capability, outputContract, runtimeOutput, verifiedDomainOutput = null, index }) {
  const base = {
    schemaVersion: "1.0", contract: "UnifiedSkillOutputFact@1.0", id: `output-fact-${index}`,
    invocationRef: declaredRef(invocation, "invocationHash"), executionRecordRef: ref(`execution-record-${index}`, String(index)),
    platform: "wechat", stepId, capability, inputContract: `FixtureInput@${index}.0`, outputContract,
    planRef: { id: "wechat-plan", hash: invocation.planHash }, bundleHash: String(index + 3).repeat(64).slice(0, 64),
    inputHash: invocation.inputRef.hash, outputHash: hashUnifiedContent(runtimeOutput), runtimeOutput, verifiedDomainOutput,
    executionMode: "real", status: "completed", productionEligibleOutput: true
  };
  return { ...base, factHash: hashUnifiedContent(base) };
}

export function buildWechatCommitFixture(options = {}) {
  const projectIdentity = options.projectIdentity ? structuredClone(options.projectIdentity) : identity();
  const sharedContentMaster = options.sharedContentMaster ? structuredClone(options.sharedContentMaster) : master();
  const sharedContentMasterRef = { id: sharedContentMaster.id, hash: hashUnifiedContent(sharedContentMaster) };
  const formalSharedContentMasterRef = { schemaVersion: "1.0", contract: "SharedContentMasterRef@1.0", ...sharedContentMasterRef, authorityContract: "SharedContentMaster@1.0", authorityType: "shared_content_master" };
  const sourceRef = options.sourceRef || ref("source-plan-item", "4");
  const decision = options.mechanismDecision ? structuredClone(options.mechanismDecision) : mechanismDecision(sourceRef);
  const sourcePlan = options.sourcePlan ? structuredClone(options.sourcePlan) : { schemaVersion: "1.0", contract: "SourcePlan@1.0", id: "source-plan-wechat", mode: "knowledge", frozenSourceRefs: [sourceRef], sources: [{ sourceRef }] };
  const confirmedOutline = outline();
  const platformBrief = { id: "brief-wechat", platform: "wechat", accountId: "wechat-account", sharedContentMasterRef, brief: { authorized_assets: [], contentTaskBrief: { purpose: "authority" } } };
  const writerContext = createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "wechat_official_account", account_id: "wechat-account",
    topic_id: "topic", intent_profile_id: "intent", content_purpose_id: "knowledge_howto",
    account_context: { subject_type: "founder", account_mode: "founder_ip", matrix_role: "authority", trust_source: "experience" },
    creative_mechanism: "framework", journey_stage: "trust", coordination_mode: "standalone",
    matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "independent WeChat depth", prohibited_overlap: [] },
    authority_refs: {
      activeStrategySnapshotRef: projectIdentity.activeStrategySnapshotRef, contentOpportunityRef: projectIdentity.contentOpportunityRef,
      mechanismDecisionRef: declaredRef(decision, "decisionHash"), accountRef: ref("wechat-account", "a"), accountStrategyRef: ref("account-strategy", "b"),
      sharedContentMasterRef, platformBriefRef: { id: platformBrief.id, hash: hashUnifiedContent(platformBrief) },
      confirmedOutlineRef: { id: confirmedOutline.outline_id, hash: hashUnifiedContent(confirmedOutline) }
    }
  });
  const platformRunRef = ref("platform-run-wechat", "5");
  const authorityBinding = createExecutionAuthorityBinding({
    family: "atomic_v2", companyId: "company", accountId: "wechat-account",
    refs: [
      ["contentOpportunityRef", projectIdentity.contentOpportunityRef], ["activeStrategySnapshotRef", projectIdentity.activeStrategySnapshotRef],
      ["contentProjectRef", declaredRef(projectIdentity, "identityHash")], ["platformRunRef", platformRunRef], ["sharedContentMasterRef", sharedContentMasterRef],
      ["mechanismDecisionRef", declaredRef(decision, "decisionHash")], ["sourcePlanRef", { id: sourcePlan.id, hash: hashUnifiedContent(sourcePlan) }],
      ["platformBriefRef", { id: platformBrief.id, hash: hashUnifiedContent(platformBrief) }], ["confirmedOutlineRef", { id: confirmedOutline.outline_id, hash: hashUnifiedContent(confirmedOutline) }],
      ["writerContextRef", { id: "writer-context-wechat", hash: writerContext.writerContextHash }]
    ].map(([role, value]) => ({ role, ref: value }))
  });
  const planHash = "6".repeat(64);
  const articleValue = article(writerContext);
  const reviewValue = { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
  const commonInput = { platform: "wechat_official_account", content_master: sharedContentMaster.contentMaster, platform_brief: platformBrief, confirmed_outline: confirmedOutline, writer_context: writerContext };
  const compiledArticleValue = compileWechatRuntimeOutput(envelope(articleValue), { sourceContentMaster: sharedContentMaster.contentMaster, sourceSkillInput: commonInput });
  const invocationInputs = [commonInput, { ...commonInput, mode: "report_only", article: compiledArticleValue }, {
    ...commonInput, article: compiledArticleValue, article_review: reviewValue, authorized_assets: [],
    image_runtime: projectWechatImageRuntimeCapability([])
  }];
  const invocations = ["write-wechat-article", "review-wechat-article", "plan-wechat-images"].map((name, index) => createSkillActivityInvocation({
    id: `invocation-${index + 1}`, skill: { name, version: "1.0.0" }, inputRef: { id: `input-${index + 1}`, hash: hashUnifiedContent(invocationInputs[index]) }, authorityBinding, planHash
  }));
  const imageEnvelope = envelope({ plan_id: "plan-wechat", cover: { purpose: "explain", strategy: "html_chart", asset_id: "wechat_cover_chart", claim_ids: [], image_spec: null }, slots: [{ slot_id: "wechat_inline_chart", after_section_id: "W1", purpose: "explain", strategy: "html_chart", claim_ids: [], asset_id: "wechat_inline_chart", image_spec: null }] });
  const imagePlan = validateUnifiedSkillDomainOutput({
    capability: "plan-wechat-images", platform: "wechat", outputContract: "WechatImagePlan@1.0", runtimeOutput: imageEnvelope,
    sourceContentMaster: sharedContentMaster.contentMaster,
    sourceSkillInput: invocationInputs[2],
    sourceArticle: compiledArticleValue
  });
  const skillFacts = {
    article: { ordinal: 1, stepId: "platform_writer", capability: "write-wechat-article", invocation: invocations[0], outputFact: outputFact({ invocation: invocations[0], stepId: "platform_writer", capability: "write-wechat-article", outputContract: "WechatArticle@2.0", runtimeOutput: envelope(articleValue), index: 1 }) },
    articleReview: { ordinal: 2, stepId: "wechat_content_review", capability: "review-wechat-article", invocation: invocations[1], outputFact: outputFact({ invocation: invocations[1], stepId: "wechat_content_review", capability: "review-wechat-article", outputContract: "WechatArticleReview@1.0", runtimeOutput: envelope(reviewValue), index: 2 }) },
    imagePlan: { ordinal: 3, stepId: "image_plan", capability: "plan-wechat-images", invocation: invocations[2], outputFact: outputFact({ invocation: invocations[2], stepId: "image_plan", capability: "plan-wechat-images", outputContract: "WechatImagePlan@1.0", runtimeOutput: imageEnvelope, verifiedDomainOutput: imagePlan, index: 3 }) }
  };
  const platformRun = {
    schemaVersion: "1.0", contract: "PlatformRunRef@1.0", id: platformRunRef.id, hash: platformRunRef.hash, platform: "wechat", accountId: "wechat-account",
    sharedContentMasterRef: formalSharedContentMasterRef, platformBriefRef: { id: platformBrief.id, hash: hashUnifiedContent(platformBrief) }, outlineRef: { id: confirmedOutline.outline_id, hash: hashUnifiedContent(confirmedOutline) },
    writerInvocationRef: declaredRef(invocations[0], "invocationHash"), candidateRefs: [], finalVersionRef: null
  };
  const contentProject = withUnifiedContentHash({
    schemaVersion: "1.0", contract: "ContentProject@1.0", id: projectIdentity.id, companyId: "company",
    contentOpportunityRef: projectIdentity.contentOpportunityRef, activeStrategySnapshotRef: projectIdentity.activeStrategySnapshotRef,
    sharedContentMasterRef: formalSharedContentMasterRef,
    platformRuns: [platformRun], state: "candidate_ready", createdAt: "2026-08-07T08:00:00.000Z", projectHash: ""
  }, "projectHash");
  return {
    id: "atomic-wechat-commit", idempotencyKey: "atomic-wechat-key", contentProjectIdentity: projectIdentity, contentProject, authorityBinding,
    authorityInputs: { sharedContentMaster, mechanismDecision: decision, sourcePlan, platformBrief, confirmedOutline, writerContext }, skillFacts
  };
}
const article = wechatArticleFixture;
export const wechatEnvelopeFixture = envelope;

const buildFixture = buildWechatCommitFixture;

function rehash(value) {
  const copy = structuredClone(value);
  delete copy.commitHash;
  return { ...copy, commitHash: hashUnifiedContent(copy) };
}

const input = buildFixture();
const commit = createUnifiedAtomicWechatContentCommit(input);
validateUnifiedAtomicWechatContentCommit(commit);
assert.equal(commit.platform, "wechat");
assert.deepEqual(Object.values(commit.skillFacts).map((item) => item.capability), ["write-wechat-article", "review-wechat-article", "plan-wechat-images"]);
assert.equal(Object.values(commit.skillFacts).every((item) => item.invocation.attemptPolicy.maxProviderCalls === 1 && item.invocation.attemptPolicy.automaticRetries === 0), true);
assert.deepEqual(Object.values(commit.compilerFacts).map((item) => item.kind), ["deterministic_compiler", "deterministic_compiler"]);
assert.equal(commit.materializedComponents.articleReview.articleRef.hash, commit.materializedComponents.article.componentHash);
assert.equal(commit.materializedComponents.imagePlan.articleReviewRef.hash, commit.materializedComponents.articleReview.componentHash);
assert.equal(commit.materializedComponents.imagePlan.canonicalPlan.contract, "WechatCanonicalImagePlan@1.0");
assert.deepEqual(commit.authorityBoundary, { productProjectionAuthority: false, artifactAuthority: false, humanReviewAuthority: false, promotionAuthority: false, publicationPerformed: false });
assert.ok(Object.isFrozen(commit) && Object.isFrozen(commit.materializedComponents.article.article));
assert.equal(createUnifiedAtomicWechatContentCommit(buildFixture()).commitHash, commit.commitHash);

const mutations = [
  ["duplicate", (value) => { value.skillFacts.imagePlan = structuredClone(value.skillFacts.articleReview); }],
  ["order", (value) => { value.skillFacts.articleReview.ordinal = 3; }],
  ["fallback", (value) => { value.skillFacts.article.outputFact.executionMode = "fallback"; }],
  ["non-success", (value) => { value.skillFacts.article.outputFact.runtimeOutput.status = "needs_review"; }],
  ["stale article", (value) => { value.materializedComponents.articleReview.articleRef.hash = "0".repeat(64); }],
  ["mixed account", (value) => { value.authorityBinding.accountId = "other"; }],
  ["mixed run", (value) => { value.platformRunRef.hash = "0".repeat(64); }],
  ["xhs upstream", (value) => { value.authorityInputs.sourcePlan.sourcePlatformOutputRef = { contract: "XhsPostPackage@4.0" }; }],
  ["compiler masquerade", (value) => { value.compilerFacts.traceability.kind = "skill_invocation"; }],
  ["extra invocation", (value) => { value.skillFacts.extra = structuredClone(value.skillFacts.article); }],
  ["image plan", (value) => { value.materializedComponents.imagePlan.canonicalPlan.planHash = "0".repeat(64); }],
  ["authority expansion", (value) => { value.authorityBoundary.artifactAuthority = true; }]
];
for (const [label, mutate] of mutations) {
  const invalid = structuredClone(commit);
  mutate(invalid);
  assert.throws(() => validateUnifiedAtomicWechatContentCommit(rehash(invalid)), (error) => error.code?.startsWith("UNIFIED_ATOMIC_WECHAT"), label);
}

for (const [label, mutate] of mutations.slice(0, 8)) {
  const rejectedBacking = {};
  const rejectedStore = createUnifiedAtomicContentCommitStore(rejectedBacking);
  const invalidCommit = structuredClone(commit);
  mutate(invalidCommit);
  assert.throws(() => rejectedStore.append(rehash(invalidCommit)), undefined, `${label} append must fail`);
  assert.equal(rejectedBacking.unifiedAtomicContentCommits, undefined, `${label} append must be zero-write`);
}

const backing = {};
const store = createUnifiedAtomicContentCommitStore(backing);
const invalid = structuredClone(commit);
invalid.commitHash = "0".repeat(64);
assert.throws(() => store.append(invalid));
assert.equal(backing.unifiedAtomicContentCommits, undefined, "failed append must be zero-write");
assert.equal(store.append(commit).commitHash, commit.commitHash);
assert.equal(store.append(JSON.parse(JSON.stringify(commit))).commitHash, commit.commitHash);
assert.equal(backing.unifiedAtomicContentCommits.length, 1, "stable replay must not append twice");
const conflict = createUnifiedAtomicWechatContentCommit({ ...buildFixture(), id: "changed-commit", idempotencyKey: commit.idempotencyKey });
assert.throws(() => store.append(conflict), (error) => error.code === "UNIFIED_ATOMIC_CONTENT_COMMIT_IDEMPOTENCY_CONFLICT");
assert.equal(backing.unifiedAtomicContentCommits.length, 1, "idempotency conflict must be zero-write");
assert.equal(store.getByCandidate("none"), null, "WeChat v1 has no candidate authority");
assert.equal(store.listByProject(commit.contentProjectRef.id).length, 1);

export function atomicWechatOrchestratorFixture(options = {}) {
  const projectIdentity = options.projectIdentity ? structuredClone(options.projectIdentity) : identity();
  const sourceRef = options.sourceRef || ref("source-plan-item", "4");
  const decision = options.mechanismDecision ? structuredClone(options.mechanismDecision) : mechanismDecision(sourceRef);
  const sharedContentMaster = options.sharedContentMaster ? structuredClone(options.sharedContentMaster) : {
    schemaVersion: "3.0", contract: "ContentMaster@3.0", id: "master-wechat",
    content_master_id: "master-wechat", topic_id: "topic", intent_profile_id: "intent",
    confirmed_facts: [{ fact_id: "F1", fact: "Every stage is independently recorded.", source_ids: ["S1"] }],
    supported_interpretations: [], author_opinions: [],
    knowledge_contract: { enabled: false, snapshot_id: "", allowed_assets: [], forbidden_uses: [] },
    source_list: [{ source_id: "S1", title: "Fixture source" }]
  };
  const sharedContentMasterRef = { id: sharedContentMaster.id, hash: hashUnifiedContent(sharedContentMaster) };
  const confirmedOutline = outline();
  const platformBrief = { id: "brief-wechat", platform: "wechat", accountId: "wechat-account", sharedContentMasterRef, brief: { authorized_assets: [] } };
  const writerContext = createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: "wechat_official_account", account_id: "wechat-account",
    topic_id: "topic", intent_profile_id: "intent", content_purpose_id: "knowledge_howto",
    account_context: { subject_type: "founder", account_mode: "founder_ip", matrix_role: "authority", trust_source: "experience" },
    creative_mechanism: "framework", journey_stage: "trust", coordination_mode: "standalone",
    matrix_coordination: { shared_campaign_topic_id: "", differentiation_angle: "independent WeChat depth", prohibited_overlap: [] },
    authority_refs: {
      activeStrategySnapshotRef: projectIdentity.activeStrategySnapshotRef, contentOpportunityRef: projectIdentity.contentOpportunityRef,
      mechanismDecisionRef: declaredRef(decision, "decisionHash"), accountRef: ref("wechat-account", "a"), accountStrategyRef: ref("account-strategy", "b"),
      sharedContentMasterRef, platformBriefRef: { id: platformBrief.id, hash: hashUnifiedContent(platformBrief) },
      confirmedOutlineRef: { id: confirmedOutline.outline_id, hash: hashUnifiedContent(confirmedOutline) }
    }
  });
  const sourcePlan = options.sourcePlan ? structuredClone(options.sourcePlan) : { schemaVersion: "1.0", contract: "SourcePlan@1.0", id: "source-plan-wechat", mode: "knowledge", frozenSourceRefs: [sourceRef], sources: [{ sourceRef }] };
  const sourcePlanRef = { id: sourcePlan.id || "source-plan-wechat", hash: hashUnifiedContent(sourcePlan) };
  const executionPlan = {
    schemaVersion: "1.0", contract: "UnifiedAtomicWechatExecutionPlan@1.0", id: "atomic-wechat-plan", platform: "wechat",
    steps: [
      { id: "platform_writer", kind: "skill", capability: "write-wechat-article", enabled: true, required: true, dependsOn: [], inputContract: "WechatPlatformTopicIntentContentMasterAndConfirmedOutline", outputContract: "WechatArticle@2.0" },
      { id: "wechat_content_review", kind: "skill", capability: "review-wechat-article", enabled: true, required: true, dependsOn: ["platform_writer"], inputContract: "CompletedWechatArticleAndContentContracts", outputContract: "WechatArticleReview@1.0", invocationMode: "content_review" },
      { id: "image_plan", kind: "skill", capability: "plan-wechat-images", enabled: true, required: true, dependsOn: ["wechat_content_review"], inputContract: "CompletedWechatArticlePassedReviewAndAuthorizedAssets", outputContract: "WechatImagePlan@1.0" }
    ]
  };
  return {
    project: { id: projectIdentity.id, companyId: "company", accountId: "wechat-account", contentOpportunityRef: projectIdentity.contentOpportunityRef, activeStrategySnapshotRef: projectIdentity.activeStrategySnapshotRef },
    authorityInputs: { sharedContentMaster, mechanismDecision: decision, sourcePlan, platformBrief, confirmedOutline, writerContext },
    sourcePlanRef, writerContextRefId: "writer-context-wechat", executionPlan,
    commitId: options.commitId || "orchestrated-wechat-commit", idempotencyKey: options.idempotencyKey || "orchestrated-wechat-key", createdAt: "2026-08-07T08:00:00.000Z"
  };
}
const atomicOrchestratorFixture = atomicWechatOrchestratorFixture;

async function runAtomicOrchestratorScenario({ mode = "real_offline_adapter", failCapability = null, blockReview = false, reviewDecision = "pass" } = {}) {
  const fixture = atomicOrchestratorFixture();
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const calls = [];
  const invocationsSeenBeforeCall = [];
  const executor = createUnifiedSkillActivityExecutor({
    evidenceCompiler,
    generateText: async (request) => {
      const capability = request.skill_runtime.skill_name;
      calls.push(capability);
      if (capability === failCapability) return { mode, data: envelope({}, "needs_review"), telemetry: { attempts: 1, providerSucceeded: mode === "real_offline_adapter" } };
      const writer = article(fixture.authorityInputs.writerContext);
      const data = capability === "write-wechat-article" ? writer
        : capability === "review-wechat-article"
          ? { decision: blockReview ? "block" : reviewDecision, findings: blockReview ? [{ finding_id: "B1", category: "fact", location: "W1", severity: "blocker", issue: "fixture blocker", required_action: "stop", claim_ids: ["F1"] }] : reviewDecision === "revise" ? [{ finding_id: "S1", category: "readability", location: "W1", severity: "suggestion", issue: "可进一步精简", required_action: "人工可选修改", claim_ids: [] }] : [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] }
          : { plan_id: "plan-wechat", cover: { purpose: "explain", strategy: "html_chart", asset_id: "wechat_cover_chart", claim_ids: [], image_spec: null }, slots: [{ slot_id: "wechat_inline_chart", after_section_id: "W1", purpose: "explain", strategy: "html_chart", claim_ids: [], asset_id: "wechat_inline_chart", image_spec: null }] };
      return { mode, data: envelope(data), telemetry: { attempts: 1, providerSucceeded: true } };
    }
  });
  const result = await runUnifiedAtomicWechatCommitOrchestration(fixture, {
    executeSkillStep: async (request) => {
      assert.equal(request.atomicInvocation.contract, "SkillActivityInvocation@1.0", "formal invocation must exist before the controlled call");
      invocationsSeenBeforeCall.push(request.atomicInvocation.capability || request.atomicInvocation.skill.name);
      return executor({ ...request, capability: request.step.capability });
    },
    getControlledOutputFact: ({ step }) => evidenceCompiler.resolveUniqueOutputFact({ capability: step.capability, platform: "wechat" })
  });
  return { result, calls, invocationsSeenBeforeCall, evidenceCompiler };
}

const orchestrated = await runAtomicOrchestratorScenario();
assert.deepEqual(orchestrated.calls, ["write-wechat-article", "review-wechat-article", "plan-wechat-images"]);
assert.deepEqual(orchestrated.invocationsSeenBeforeCall, orchestrated.calls);
assert.equal(orchestrated.evidenceCompiler.getActualInvocations().length, 3, "controlled executor must record three actual invocations");
assert.equal(orchestrated.evidenceCompiler.getSkillOutputFacts().length, 3, "controlled executor must produce three first-party output facts");
assert.equal(orchestrated.result.commit.contract, "UnifiedAtomicWechatContentCommit@1.0");
assert.deepEqual(Object.values(orchestrated.result.commit.skillFacts).map((item) => item.capability), orchestrated.calls);
assert.equal(orchestrated.result.commit.authorityBoundary.publicationPerformed, false);

const editorialSuggestion = await runAtomicOrchestratorScenario({ reviewDecision: "revise" });
assert.deepEqual(editorialSuggestion.calls, ["write-wechat-article", "review-wechat-article", "plan-wechat-images"],
  "editorial suggestions without safety blockers must not stop package generation");

for (const scenario of [
  { label: "writer non-success", options: { failCapability: "write-wechat-article" }, expectedCalls: ["write-wechat-article"] },
  { label: "review blocker", options: { blockReview: true }, expectedCalls: ["write-wechat-article", "review-wechat-article"] },
  { label: "mock writer", options: { mode: "mock" }, expectedCalls: ["write-wechat-article"] },
  { label: "fallback writer", options: { mode: "validated_fallback" }, expectedCalls: ["write-wechat-article"] }
]) {
  let observedCalls = [];
  const fixture = atomicOrchestratorFixture();
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const executor = createUnifiedSkillActivityExecutor({ evidenceCompiler, generateText: async (request) => {
    const capability = request.skill_runtime.skill_name;
    observedCalls.push(capability);
    if (scenario.options.mode) return { mode: scenario.options.mode, data: envelope(article(fixture.authorityInputs.writerContext)), telemetry: { attempts: 1, providerSucceeded: scenario.options.mode === "mock" } };
    if (scenario.options.failCapability === capability) return { mode: "real_offline_adapter", data: envelope({}, "needs_review"), telemetry: { attempts: 1, providerSucceeded: true } };
    if (scenario.options.blockReview && capability === "review-wechat-article") return { mode: "real_offline_adapter", data: envelope({ decision: "block", findings: [{ finding_id: "B1", category: "fact", location: "W1", severity: "blocker", issue: "fixture blocker", required_action: "stop", claim_ids: ["F1"] }], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] }), telemetry: { attempts: 1, providerSucceeded: true } };
    return { mode: "real_offline_adapter", data: envelope(article(fixture.authorityInputs.writerContext)), telemetry: { attempts: 1, providerSucceeded: true } };
  } });
  await assert.rejects(() => runUnifiedAtomicWechatCommitOrchestration(fixture, {
    executeSkillStep: (request) => executor({ ...request, capability: request.step.capability }),
    getControlledOutputFact: ({ step }) => evidenceCompiler.resolveUniqueOutputFact({ capability: step.capability, platform: "wechat" })
  }), undefined, scenario.label);
  assert.deepEqual(observedCalls, scenario.expectedCalls, `${scenario.label} must short-circuit later Skills`);
}

for (const evidenceMode of ["missing", "duplicate", "mismatched"]) {
  const fixture = atomicOrchestratorFixture();
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const calls = [];
  const executor = createUnifiedSkillActivityExecutor({ evidenceCompiler, generateText: async (request) => {
    calls.push(request.skill_runtime.skill_name);
    return { mode: "real_offline_adapter", data: envelope(article(fixture.authorityInputs.writerContext)), telemetry: { attempts: 1, providerSucceeded: true } };
  } });
  await assert.rejects(() => runUnifiedAtomicWechatCommitOrchestration(fixture, {
    executeSkillStep: (request) => executor({ ...request, capability: request.step.capability }),
    getControlledOutputFact: ({ step }) => {
      const fact = evidenceCompiler.resolveUniqueOutputFact({ capability: step.capability, platform: "wechat" });
      if (evidenceMode === "missing") return null;
      if (evidenceMode === "duplicate") return [fact, structuredClone(fact)];
      return { ...fact, inputHash: "0".repeat(64) };
    }
  }), undefined, `${evidenceMode} controlled evidence must fail`);
  assert.deepEqual(calls, ["write-wechat-article"], `${evidenceMode} evidence must stop before Review`);
}

const checkpointFixture = atomicOrchestratorFixture({ commitId: "checkpoint-wechat-commit", idempotencyKey: "checkpoint-wechat-key" });
const checkpointStore = {};
async function checkpointAttempt({ failImagePlan = false } = {}) {
  const evidenceCompiler = createUnifiedSkillEvidenceCompiler();
  const calls = [];
  const executor = createUnifiedSkillActivityExecutor({ evidenceCompiler, generateText: async (request) => {
    const capability = request.skill_runtime.skill_name;
    calls.push(capability);
    if (failImagePlan && capability === "plan-wechat-images") {
      return { mode: "real_offline_adapter", data: envelope({}, "needs_review"), telemetry: { attempts: 1, providerSucceeded: true } };
    }
    const writer = article(checkpointFixture.authorityInputs.writerContext);
    const data = capability === "write-wechat-article" ? writer
      : capability === "review-wechat-article"
        ? { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] }
        : { plan_id: "checkpoint-image-plan", cover: { purpose: "explain", strategy: "html_chart", asset_id: "wechat_cover_chart", claim_ids: [], image_spec: null }, slots: [{ slot_id: "wechat_inline_chart", after_section_id: "W1", purpose: "explain", strategy: "html_chart", claim_ids: [], asset_id: "wechat_inline_chart", image_spec: null }] };
    return { mode: "real_offline_adapter", data: envelope(data), telemetry: { attempts: 1, providerSucceeded: true } };
  } });
  const dependencies = {
    executeSkillStep: (request) => executor({ ...request, capability: request.step.capability }),
    getControlledOutputFact: ({ step }) => evidenceCompiler.resolveUniqueOutputFact({ capability: step.capability, platform: "wechat" }),
    resolveStepCheckpoint: ({ step, inputHash, planHash, invocation }) => resolveUnifiedWechatStageCheckpoint(checkpointStore, {
      materializationId: checkpointFixture.commitId, stepId: step.id, capability: step.capability,
      inputHash, planHash, invocationHash: invocation.invocationHash
    }),
    persistStepCheckpoint: ({ step, inputHash, planHash, invocation, outputFact }) => appendUnifiedWechatStageCheckpoint(checkpointStore, {
      materializationId: checkpointFixture.commitId, stepId: step.id, capability: step.capability,
      inputHash, planHash, invocationHash: invocation.invocationHash, outputFact,
      completedAt: "2026-08-25T00:00:00.000Z"
    })
  };
  const result = await runUnifiedAtomicWechatCommitOrchestration(checkpointFixture, dependencies);
  return { result, calls };
}

await assert.rejects(() => checkpointAttempt({ failImagePlan: true }));
assert.equal(checkpointStore.unifiedWechatStageCheckpoints.length, 2,
  "writer and review checkpoints must survive a later image-plan failure");
const resumedFromCheckpoints = await checkpointAttempt();
assert.deepEqual(resumedFromCheckpoints.calls, ["plan-wechat-images"],
  "resume must reuse exact writer and review facts and call only the unfinished stage");
assert.equal(checkpointStore.unifiedWechatStageCheckpoints.length, 3);
assert.equal(resumedFromCheckpoints.result.commit.contract, "UnifiedAtomicWechatContentCommit@1.0");

console.log(JSON.stringify({
  status: "atomic-wechat-commit-self-test passed", formalSkillFacts: 3, deterministicCompilerFacts: 2, orchestratedControlledSkillCalls: orchestrated.calls.length,
  realProviderCalls: 0, externalApiCalls: 0, activeDatabaseWrites: 0, browserCalls: 0, imageGenerationCalls: 0, platformWrites: 0
}, null, 2));
