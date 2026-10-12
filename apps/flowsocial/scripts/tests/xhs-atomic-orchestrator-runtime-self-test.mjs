import assert from "node:assert/strict";
import { createContentMechanismDecisionV1CompatibilityView, hashUnifiedContent, withUnifiedContentHash, createUnifiedWriterContext } from "../../content-agent/unified-content-contracts.mjs";
import { runUnifiedContentOrchestration } from "../../content-agent/unified-content-orchestrator.mjs";
import { createUnifiedAtomicSkillActivityExecutionPort } from "../../content-agent/unified-skill-activity-executor.mjs";
import { createUnifiedSkillEvidenceCompiler } from "../../content-agent/unified-skill-evidence-compiler.mjs";

const AT = "2026-08-06T09:00:00.000Z";
const strategyRef = { id: "strategy-atomic", hash: hashUnifiedContent({ id: "strategy-atomic" }) };
const opportunityRef = { id: "opportunity-atomic", hash: hashUnifiedContent({ id: "opportunity-atomic" }) };
const designDna = {
  schemaVersion: "1.0", kind: "DesignDNA", id: "dna-atomic", accountId: "account-xhs", version: 1, status: "confirmed",
  colors: ["#16352d"], fontPreferences: ["sans"], layoutPreferences: ["grid"], materials: ["paper"],
  photographyOrIllustrationDirection: "editorial", forbiddenMotifs: ["watermark"], referenceNotes: "fixture",
  approvedTextSummary: "fixture", sources: [], authorization: { approvedFileIds: [], excludedFileIds: [], providerReferenceImageSupported: false, referenceImagesTransmitted: false, externalInputMode: "approved_text_summary_only", disclosure: "fixture" },
  confirmation: { decision: "confirmed", confirmedBy: "fixture", note: "fixture", confirmedAt: AT }, createdAt: AT, updatedAt: AT
};
const designDnaRef = { id: designDna.id, hash: hashUnifiedContent(designDna) };

function decisionV1() {
  return withUnifiedContentHash({
    schemaVersion: "1.0", contract: "ContentMechanismDecision@1.0", id: "mechanism-atomic", companyId: "company-atomic",
    contentProjectRef: { id: "project-input", hash: hashUnifiedContent({ id: "project-input" }) }, activeStrategySnapshotRef: strategyRef,
    evaluated: [{ mechanism: "strategy_only", status: "selected", candidateRefs: [], reason: "fixture", factPolicy: null }],
    selectedMechanism: "strategy_only", selectedSourceRefs: [], strategyHotspotPolicy: "optional",
    deviation: { status: "none", reason: null, userConfirmationStatus: "not_required" }, decidedAt: AT, decisionHash: ""
  }, "decisionHash");
}

const knowledgeSource = { id: "knowledge-atomic", title: "verified knowledge" };
function atomicSourcePlan() {
  return { schemaVersion: "0.1", mode: "knowledge_base", sources: [{ type: "knowledge_base", role: "evidence", required: true, candidateIds: [knowledgeSource.id], assets: [structuredClone(knowledgeSource)] }] };
}
function selectedKnowledgeRef(source = knowledgeSource) {
  return { id: source.id, hash: hashUnifiedContent({ mechanism: "knowledge", sourceType: "knowledge_base", source }) };
}
function decisionV2(sourceRef = selectedKnowledgeRef()) {
  return withUnifiedContentHash({
    schemaVersion: "2.0", contract: "ContentMechanismDecision@2.0", id: "mechanism-atomic-v2", companyId: "company-atomic",
    projectInputRef: { id: "project-input-v2", hash: hashUnifiedContent({ id: "project-input-v2" }) }, activeStrategySnapshotRef: strategyRef,
    taxonomy: { sourceMechanismType: "content_source_mechanism", creativeMechanismAuthority: "platform_writer_context" },
    mechanisms: [{ mechanism: "knowledge", role: "primary", evaluationStatus: "evaluated", candidates: [{ sourceRef, status: "selected", reason: "selected_and_frozen" }], reason: "verified knowledge is primary", factPolicy: null }],
    selectedSourceRefs: [sourceRef], strategyHotspotPolicy: "optional", deviation: { status: "none", reason: null, confirmationEventRef: null },
    decidedAt: AT, decisionHash: ""
  }, "decisionHash");
}

function writerContext(platform, mechanismDecision) {
  return createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: platform === "wechat" ? "wechat_official_account" : "xiaohongshu",
    account_id: platform === "wechat" ? "account-wechat" : "account-xhs", topic_id: opportunityRef.id, intent_profile_id: "intent", content_purpose_id: "authority",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "authority", trust_source: "institution" },
    creative_mechanism: platform === "wechat" ? "framework" : "checklist", journey_stage: "trust", coordination_mode: "coordinated",
    matrix_coordination: { shared_campaign_topic_id: opportunityRef.id, differentiation_angle: platform, prohibited_overlap: [] },
    authority_refs: {
      activeStrategySnapshotRef: strategyRef, contentOpportunityRef: opportunityRef,
      mechanismDecisionRef: { id: mechanismDecision.id, hash: mechanismDecision.decisionHash },
      accountRef: { id: `account-${platform}`, hash: hashUnifiedContent({ platform }) },
      accountStrategyRef: { id: `account-strategy-${platform}`, hash: hashUnifiedContent({ platform, strategy: true }) }
    }
  });
}

function orchestrationInput({ naturalize = false, injectedFlag = false, mechanismDecision = decisionV2(), sourcePlan = atomicSourcePlan() } = {}) {
  return {
    ...(injectedFlag ? { serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true } } : {}),
    project: {
      id: "project-atomic", companyId: "company-atomic", contentOpportunityRef: opportunityRef, activeStrategySnapshotRef: strategyRef,
      designDnaSnapshotRef: designDnaRef, designDnaAuthority: { ref: designDnaRef, snapshot: designDna },
      writerContexts: { xiaohongshu: writerContext("xiaohongshu", mechanismDecision), wechat: writerContext("wechat", mechanismDecision) },
      accounts: { xiaohongshu: "account-xhs", wechat: "account-wechat" },
      confirmations: { xiaohongshu: { outline_confirmation: "confirmed" }, wechat: { outline_confirmation: "confirmed" } },
      platformInputs: { xiaohongshu: {}, wechat: {} },
      skillExecutionOptions: { xiaohongshu: naturalize ? { naturalizationMode: "audit_only" } : {} }, createdAt: AT
    },
    mechanismDecision, sourcePlan, masterInput: { topic: "fixture" }
  };
}

const roles = ["hook", "problem", "diagnosis", "method", "evidence", "action"];
function outline(platform) {
  return {
    outline_id: `outline-${platform}`, content_promise: "六页讲清一个可执行方法",
    sections: roles.map((role, index) => ({ section_id: `s${index + 1}`, role, heading: `section ${index + 1}` }))
  };
}

function postEnvelope() {
  const bodyRole = { hook: "scene", problem: "problem", diagnosis: "conclusion", method: "method", evidence: "evidence", action: "summary" };
  return { status: "success", data: {
    schemaVersion: "1.0", contract: "XhsPostCopyCreativeOutput@1.0", contentPromise: "六页讲清一个可执行方法",
    engagementStrategy: { mode: "auto", primaryAction: "save", reason: "方便稍后执行", ctaPlacement: "ending", ctaText: "收藏后执行" },
    titleCandidates: [
      { title: "初稿标题", hookType: "result", claimIds: [], risk: "low" },
      { title: "检查这六步", hookType: "checklist", claimIds: [], risk: "low" },
      { title: "为什么总卡住", hookType: "question", claimIds: [], risk: "low" }
    ], recommendedTitle: "初稿标题", opening: "先看清问题。",
    bodySections: roles.map((role, index) => ({ sectionId: `s${index + 1}`, outlineRole: role, role: bodyRole[role], text: `正文段落 ${index + 1}`, claimIds: [], knowledgeAssetIds: [] })),
    ending: "现在开始第一步。", pinnedComment: "", hashtags: ["行动清单", "实用方法", "效率提升"], cta: "收藏后执行。",
    promotionUse: { mode: "none", itemIds: [], disclosure: "" }
  }, warnings: [], blocked_reasons: [] };
}

function carouselEnvelope({ legacy = false } = {}) {
  const pageRole = { hook: "cover", problem: "problem", diagnosis: "conclusion", method: "method", evidence: "evidence", action: "cta" };
  const current = { status: "success", data: {
    schemaVersion: "1.0", contract: "XhsCarouselPlanCreativeOutput@1.0",
    reading_arc: "承诺到行动",
    section_drafts: roles.map((role, index) => ({
      objective: `页面目标 ${index + 1}`,
      takeaway: `独立结论 ${index + 1}`, text_layers: [{ type: "headline", text: index === 0 ? "最终标题" : `页面文案 ${index + 1}`, max_lines: 2, priority: 1 }],
      layout_hint: `布局 ${index + 1}`, fact_ids: [], interpretation_ids: [], knowledge_asset_ids: []
    }))
  }, warnings: [], blocked_reasons: [] };
  if (legacy === "creative-draft") {
    const { schemaVersion, contract, reading_arc, section_drafts } = current.data;
    return { status: "success", data: { schemaVersion, contract, creative_draft: { readingArc: reading_arc, section_drafts: section_drafts.map(({ objective, takeaway, text_layers, layout_hint, fact_ids, interpretation_ids, knowledge_asset_ids }) => ({ objective, takeaway, text_layers, layout_hint, fact_ids, interpretation_ids, knowledge_asset_ids })) } }, warnings: [], blocked_reasons: [] };
  }
  if (!legacy) return current;
  const { schemaVersion, contract, reading_arc, section_drafts } = current.data;
  return { status: "success", data: { schemaVersion, contract, deck: { id: "legacy", readingArc: reading_arc, pages: section_drafts.map(({ objective, takeaway, text_layers, layout_hint, fact_ids, interpretation_ids, knowledge_asset_ids }) => ({ objective, supporting_text: takeaway, textLayers: text_layers, visual_direction: layout_hint, factIds: fact_ids, interpretationIds: interpretation_ids, knowledgeAssetIds: knowledge_asset_ids })) } }, warnings: [], blocked_reasons: [] };
}

function visualEnvelope() {
  return { status: "success", data: {
    schemaVersion: "1.0", contract: "XhsVisualAssetPlanCreativeOutput@1.0",
    pageVisuals: roles.map((_, index) => ({ page: index + 1, visualFunction: "explain", visualNeed: `排版层级 ${index + 1}`, renderStrategy: "html_css", mustKeep: [], mustAvoid: [] })),
    imageSpecs: [], skippedPages: roles.map((_, index) => ({ page: index + 1, reason: "html_css" })),
    pageAssetBindings: roles.map((_, index) => ({ page: index + 1, plannedAssetIds: [] }))
  }, warnings: [], blocked_reasons: [] };
}

function dependencies({ atomic = true, naturalize = false, failCapability = null, failService = null, invalidTitle = false, legacyCarousel = false, masterPromotion = { mode: "none", allowed_items: [], disclosure: "" } } = {}) {
  const calls = { master: 0, briefs: [], skills: [], providers: [], atomicPort: [], services: [], planHashBeforeProvider: null, postCopyHashAtTitle: null, briefAuthority: null, writerAuthority: null };
  const deps = {
    calls, now: () => AT,
    ...(atomic ? { serverFeatureFlags: { unifiedContentXhsAtomicGraphV1: true } } : {}),
    buildSharedContentMaster: async () => {
      calls.master += 1;
      return {
        schemaVersion: "3.0", contract: "ContentMaster@3.0", id: "master-atomic", content_master_id: "master-atomic",
        confirmed_facts: [], supported_interpretations: [], author_opinions: [], knowledge_contract: { allowed_assets: [] }, promotion: structuredClone(masterPromotion)
      };
    },
    buildPlatformBrief: async ({ platform, sharedContentMasterRef, designDnaAuthority, contentMechanismDecisionRef, sourcePlanRef }) => {
      calls.briefs.push(platform);
      if (platform === "xiaohongshu" && contentMechanismDecisionRef) calls.briefAuthority = { contentMechanismDecisionRef, sourcePlanRef };
      return {
        schemaVersion: "1.0", kind: "PlatformBrief", id: `brief-${platform}`, platform, accountId: platform === "xiaohongshu" ? "account-xhs" : "account-wechat",
        sharedContentMasterRef, authorityType: "shared_content_master",
        ...(platform === "xiaohongshu" ? { brief: { contentTaskBrief: { objective: "authority" }, designDnaRef: designDnaAuthority.ref, designDna: designDnaAuthority.snapshot, authorizedReferenceAssets: [] } } : {})
      };
    },
    buildPlatformExecutionPlan: async (plan) => {
      if (plan.platform === "xiaohongshu" && plan.graphMode === "atomic_v4") calls.planHashBeforeProvider = hashUnifiedContent(plan);
      return plan;
    },
    executeSkillStep: async ({ platform, step, input, executionPlan }) => {
      calls.skills.push(`${platform}:${step.capability}`);
      if (step.id === "outline") return outline(platform);
      if (step.id === "naturalization") { assert.equal(input.mode, "audit_only"); return { status: "passed", rewrite: { forbidden: true } }; }
      if (step.id === "title") {
        if (platform === "xiaohongshu") calls.postCopyHashAtTitle = input.completed_content.componentHash;
        if (platform === "xiaohongshu" && invalidTitle) return { id: "title-output-invalid", candidates: [], recommendations: { balanced: "missing" } };
        return { id: "title-output", candidates: [{ title_id: "final-balanced", title: "最终标题", risk: "low", claim_ids: [] }], recommendations: { balanced: "final-balanced" } };
      }
      if (step.id === "platform_writer") return platform === "xiaohongshu"
        ? { invocationId: "writer-xiaohongshu", candidates: [{ id: "candidate-xiaohongshu" }], post_copy: { title_candidates: [{ title: "小红书标题" }], recommended_title: "小红书标题" } }
        : { invocationId: "writer-wechat", candidates: [{ id: "candidate-wechat" }], title_candidates: [{ title: "微信标题" }], recommended_title: "微信标题" };
      if (step.id === "wechat_content_review") return { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] };
      return { id: `${step.id}-${platform}`, status: "passed" };
    },
    executeServiceStep: async ({ platform, step }) => {
      calls.services.push(`${platform}:${step.id}`);
      if (step.id === failService) throw Object.assign(new Error("fixture service failure"), { code: `FAIL_${step.id.toUpperCase()}` });
      return { id: `${step.id}-${platform}`, status: "passed" };
    },
    generateText: async (request) => {
      const capability = request.skill_runtime.skill_name;
      calls.providers.push(capability);
      if (capability === "write-xhs-post-copy") calls.writerAuthority = {
        mechanismDecisionRef: structuredClone(request.input.mechanism_decision_ref),
        sourcePlanRef: structuredClone(request.input.source_plan_ref)
      };
      assert.match(calls.planHashBeforeProvider || "", /^[a-f0-9]{64}$/, "atomic plan/hash must be fixed before Provider transport");
      if (capability === failCapability) throw Object.assign(new Error("fixture failure"), { code: `FAIL_${capability.toUpperCase().replaceAll("-", "_")}` });
      const envelope = capability === "write-xhs-post-copy" ? postEnvelope() : capability === "plan-xhs-carousel" ? carouselEnvelope({ legacy: legacyCarousel }) : visualEnvelope();
      return { data: envelope, mode: "offline_fixture" };
    }
  };
  const atomicPort = createUnifiedAtomicSkillActivityExecutionPort({
    generateText: deps.generateText,
    evidenceCompiler: createUnifiedSkillEvidenceCompiler()
  });
  deps.executeAtomicSkillActivity = async (request) => {
    calls.atomicPort.push(request.capability);
    return atomicPort(request);
  };
  if (naturalize) deps.serverFeatureFlags.unifiedContentXhsAtomicGraphV1 = true;
  return deps;
}

const atomicDeps = dependencies({ naturalize: true });
const atomicInput = orchestrationInput({ naturalize: true });
const expectedDecisionRef = { id: atomicInput.mechanismDecision.id, hash: atomicInput.mechanismDecision.decisionHash };
const expectedSourcePlanRef = { id: "source_plan:project-atomic", hash: hashUnifiedContent(atomicInput.sourcePlan) };
const atomicSnapshot = await runUnifiedContentOrchestration(atomicInput, atomicDeps);
const xhs = atomicSnapshot.platformRuns.find((run) => run.platform === "xiaohongshu");
assert.equal(xhs.executionPlan.graphMode, "atomic_v4");
assert(!xhs.executionPlan.steps.some((step) => step.capability === "write-xhs-content"));
assert.deepEqual(atomicDeps.calls.providers, ["write-xhs-post-copy", "plan-xhs-carousel"], "integrated-page compatibility handoff must not call the text Provider");
assert.deepEqual(atomicDeps.calls.atomicPort, ["write-xhs-post-copy", "plan-xhs-carousel", "plan-xhs-visual-assets"], "all atomic Skills must traverse the one injected execution Port");
assert.equal(atomicDeps.calls.skills.filter((item) => item === "xiaohongshu:generate-platform-titles").length, 1, "Title must remain on the existing generic Executor dependency");
assert.equal(atomicDeps.calls.skills.filter((item) => item === "xiaohongshu:naturalize-copy").length, 1);
assert.equal(xhs.platformRunRef.candidateRefs.length, 0);
assert.equal(xhs.executionPlanHash, hashUnifiedContent(xhs.executionPlan));
assert.equal(xhs.skillRecords.find((record) => record.stepId === "xhs_post_copy").attempt, 1);
assert.equal(xhs.skillRecords.find((record) => record.stepId === "xhs_post_copy").planAuthorization, "strict");
assert.equal(xhs.skillRecords.find((record) => record.stepId === "xhs_post_copy").executionPlanHash, xhs.executionPlanHash);
assert.equal(xhs.skillRecords.find((record) => record.stepId === "xhs_package").outputContract, "XhsPostPackage@4.0");
assert.equal(atomicDeps.calls.postCopyHashAtTitle, xhs.skillRecords.find((record) => record.stepId === "xhs_post_copy").componentHash);
assert.equal(xhs.platformRunRef.writerInvocationRef.id, "xhs-package:project-atomic");
assert.equal(xhs.xhsAtomicArtifacts.postCopy.recommendedTitle, "初稿标题");
assert.equal(xhs.xhsAtomicArtifacts.finalTitleBinding.title, "最终标题");
assert.equal(xhs.xhsAtomicArtifacts.carouselPlan.pages[0].textLayers[0].text, "最终标题");
assert.equal(xhs.xhsAtomicArtifacts.visualAssetPlan.imageSpecs.length, 0);
assert.ok(xhs.xhsAtomicArtifacts.visualAssetPlan.pageVisuals.every((item) => item.renderStrategy === "html_css"));
assert.equal(xhs.skillRecords.find((record) => record.stepId === "xhs_visual_assets").executionMode, "deterministic_adapter");
assert.equal(xhs.xhsAtomicArtifacts.traceability.titleClaimIds.length, 0);
assert.equal(xhs.xhsAtomicArtifacts.preflightReport.status, "passed");
assert.equal(xhs.xhsAtomicArtifacts.package.contract, "XhsPostPackage@4.0");
assert.equal(xhs.xhsAtomicArtifacts.postCopy.componentHash, atomicDeps.calls.postCopyHashAtTitle, "final title binding must not mutate PostCopy");
assert.deepEqual(atomicDeps.calls.briefAuthority, { contentMechanismDecisionRef: expectedDecisionRef, sourcePlanRef: expectedSourcePlanRef });
assert.deepEqual(xhs.platformBrief.contentMechanismDecisionRef, expectedDecisionRef);
assert.deepEqual(xhs.platformBrief.sourcePlanRef, expectedSourcePlanRef);
assert.deepEqual(atomicDeps.calls.writerAuthority, { mechanismDecisionRef: expectedDecisionRef, sourcePlanRef: expectedSourcePlanRef });
assert.deepEqual(xhs.xhsAtomicArtifacts.contentMechanismDecisionRef, expectedDecisionRef);
assert.deepEqual(xhs.xhsAtomicArtifacts.sourcePlanRef, expectedSourcePlanRef);
assert.deepEqual(xhs.xhsAtomicArtifacts.postCopy.authorityBinding.mechanismDecisionRef, expectedDecisionRef);
assert.deepEqual(atomicSnapshot.contentMechanismDecisionRef, expectedDecisionRef);
assert.deepEqual(atomicSnapshot.frozenSourcePlanRef, expectedSourcePlanRef);

const emptySoftPromotionSnapshot = await runUnifiedContentOrchestration(
  orchestrationInput(),
  dependencies({ masterPromotion: { mode: "soft", allowed_items: [], disclosure: "" } })
);
const emptySoftPromotionXhs = emptySoftPromotionSnapshot.platformRuns.find((run) => run.platform === "xiaohongshu");
assert.equal(emptySoftPromotionXhs.xhsAtomicArtifacts.postCopy.promotionUse.mode, "none", "soft promotion without authorized items must safely degrade to none");
assert.equal(emptySoftPromotionXhs.xhsAtomicArtifacts.preflightReport.status, "passed");

const legacyAtomic = await runUnifiedContentOrchestration(orchestrationInput({ naturalize: true }), dependencies({ naturalize: true, legacyCarousel: true }));
assert.equal(legacyAtomic.platformRuns.find((run) => run.platform === "xiaohongshu").xhsAtomicArtifacts.carouselPlan.pages[0].page, 1, "legacy deck wrapper is adapted while Runtime owns page order");
const creativeDraftAtomic = await runUnifiedContentOrchestration(orchestrationInput({ naturalize: true }), dependencies({ naturalize: true, legacyCarousel: "creative-draft" }));
const creativePages = creativeDraftAtomic.platformRuns.find((run) => run.platform === "xiaohongshu").xhsAtomicArtifacts.carouselPlan.pages;
assert.equal(creativePages[0].page, 1, "Creative Draft adapter assigns page numbers mechanically");
assert.equal(creativePages[0].role, "cover", "Creative Draft adapter assigns page roles from the confirmed outline");
assert.equal(creativePages[0].textLayers[0].text, "最终标题", "Runtime binds the confirmed title to the cover headline");

const missingPort = dependencies();
delete missingPort.executeAtomicSkillActivity;
await assert.rejects(
  () => runUnifiedContentOrchestration(orchestrationInput(), missingPort),
  (error) => error.code === "UNIFIED_XHS_ATOMIC_EXECUTION_PORT_REQUIRED"
);
assert.deepEqual(missingPort.calls.providers, [], "missing Port must fail before every atomic Provider call");

const mixedFamily = dependencies();
mixedFamily.buildPlatformExecutionPlan = async (plan) => {
  if (plan.platform === "xiaohongshu" && plan.graphMode === "atomic_v4") {
    plan.steps.push({ id: "forbidden_monolithic_writer", kind: "skill", capability: "write-xhs-content", enabled: true, state: "ready", required: true, dependsOn: ["outline"], inputContract: "XhsWriterInput@1.0", outputContract: "XhsPostPackage@2.0" });
  }
  return plan;
};
await assert.rejects(
  () => runUnifiedContentOrchestration(orchestrationInput(), mixedFamily),
  (error) => error.code === "XHS_GRAPH_AUTHORITY_FAMILY_MIXED"
);
assert.deepEqual(mixedFamily.calls.atomicPort, [], "mixed monolithic/atomic authority must fail before the Port");
assert.deepEqual(mixedFamily.calls.providers, [], "mixed monolithic/atomic authority must fail before Provider execution");

const v1 = decisionV1();
const compatibilityView = createContentMechanismDecisionV1CompatibilityView(v1);
const staleDecision = decisionV2({ id: knowledgeSource.id, hash: "0".repeat(64) });
const duplicatePlan = atomicSourcePlan();
duplicatePlan.sources[0].candidateIds.push(knowledgeSource.id);
const staleWriterContextInput = orchestrationInput();
staleWriterContextInput.project.writerContexts = {
  ...staleWriterContextInput.project.writerContexts,
  xiaohongshu: writerContext("xiaohongshu", v1)
};
for (const [label, rejectedInput, code] of [
  ["v1", orchestrationInput({ mechanismDecision: v1 }), "CONTENT_MECHANISM_V2_NATIVE_REQUIRED"],
  ["compatibility_view", orchestrationInput({ mechanismDecision: compatibilityView }), "CONTENT_MECHANISM_V2_NATIVE_REQUIRED"],
  ["missing_source_plan", orchestrationInput({ sourcePlan: null }), "ContentMechanismDecisionV2:SOURCE_PLAN"],
  ["stale_source", orchestrationInput({ mechanismDecision: staleDecision }), "CONTENT_MECHANISM_V2_SOURCE_PLAN_REF_MISMATCH"],
  ["duplicate_source", orchestrationInput({ sourcePlan: duplicatePlan }), "ContentMechanismDecisionV2:SOURCE_PLAN_REF_ID_DUPLICATE"],
  ["stale_writer_context", staleWriterContextInput, "CONTENT_MECHANISM_V2_WRITER_CONTEXT_REF_MISMATCH"]
]) {
  const rejectedDeps = dependencies();
  await assert.rejects(() => runUnifiedContentOrchestration(rejectedInput, rejectedDeps), (error) => error.code === code, label);
  assert.equal(rejectedDeps.calls.master, 0, `${label} must fail before shared master Skill`);
  assert.deepEqual(rejectedDeps.calls.briefs, [], `${label} must fail before Brief construction`);
  assert.deepEqual(rejectedDeps.calls.skills, [], `${label} must have zero Skill calls`);
  assert.deepEqual(rejectedDeps.calls.providers, [], `${label} must have zero Provider calls`);
  assert.deepEqual(rejectedDeps.calls.atomicPort, [], `${label} must have zero atomic Port calls`);
  assert.deepEqual(rejectedDeps.calls.services, [], `${label} must have zero service calls`);
}

for (const capability of ["write-xhs-post-copy", "plan-xhs-carousel"]) {
  const failing = dependencies({ failCapability: capability });
  await assert.rejects(
    () => runUnifiedContentOrchestration(orchestrationInput(), failing),
    (error) => error.stepId === ({ "write-xhs-post-copy": "xhs_post_copy", "plan-xhs-carousel": "xhs_carousel", "plan-xhs-visual-assets": "xhs_visual_assets" })[capability]
      && error.capability === capability && error.recoverable === true
  );
  const failureIndex = failing.calls.providers.indexOf(capability);
  assert.equal(failing.calls.providers.length, failureIndex + 1, `${capability} failure must stop all downstream Provider calls`);
  assert(!failing.calls.providers.includes("write-xhs-content"));
  assert.deepEqual(failing.calls.atomicPort, failing.calls.providers, `${capability} must not bypass the atomic Port`);
  assert(!failing.calls.skills.includes("xiaohongshu:write-xhs-content"), `${capability} failure must not fall back to the monolithic Writer`);
}

const invalidAtomicComponent = dependencies();
const validAtomicGenerateText = invalidAtomicComponent.generateText;
invalidAtomicComponent.generateText = async (request) => {
  if (request.skill_runtime.skill_name === "write-xhs-post-copy") {
    invalidAtomicComponent.calls.providers.push("write-xhs-post-copy");
    const invalid = postEnvelope();
    delete invalid.data.contentPromise;
    return { data: invalid, mode: "offline_fixture" };
  }
  return validAtomicGenerateText(request);
};
const invalidAtomicPort = createUnifiedAtomicSkillActivityExecutionPort({
  generateText: invalidAtomicComponent.generateText,
  evidenceCompiler: createUnifiedSkillEvidenceCompiler()
});
invalidAtomicComponent.executeAtomicSkillActivity = async (request) => {
  invalidAtomicComponent.calls.atomicPort.push(request.capability);
  return invalidAtomicPort(request);
};
await assert.rejects(
  () => runUnifiedContentOrchestration(orchestrationInput(), invalidAtomicComponent),
  (error) => error.stepId === "xhs_post_copy" && error.causeCode === "XHS_ATOMIC_SKILL_OUTPUT_INVALID"
);
assert.deepEqual(invalidAtomicComponent.calls.atomicPort, ["write-xhs-post-copy"]);
assert.deepEqual(invalidAtomicComponent.calls.providers, ["write-xhs-post-copy"]);
assert(!invalidAtomicComponent.calls.skills.includes("xiaohongshu:write-xhs-content"));

for (const [fixture, expectedStep] of [
  [{ failService: "title_consistency" }, "title_consistency"],
  [{ invalidTitle: true }, "xhs_final_title_binding"]
]) {
  const failing = dependencies(fixture);
  await assert.rejects(
    () => runUnifiedContentOrchestration(orchestrationInput(), failing),
    (error) => error.stepId === expectedStep && error.recoverable === true
  );
  assert.deepEqual(failing.calls.providers, ["write-xhs-post-copy"], `${expectedStep} failure must stop carousel and visual Provider calls`);
}

const off = dependencies({ atomic: false });
const offInput = { mechanismDecision: decisionV1(), sourcePlan: { schemaVersion: "0.1", mode: "strategy_only", sources: [] } };
const injected = await runUnifiedContentOrchestration(orchestrationInput({ injectedFlag: true, ...offInput }), off);
const offBaselineDeps = dependencies({ atomic: false });
const offBaseline = await runUnifiedContentOrchestration(orchestrationInput(offInput), offBaselineDeps);
const injectedXhs = injected.platformRuns.find((run) => run.platform === "xiaohongshu");
assert.equal(injectedXhs.executionPlan.graphMode, undefined, "caller payload must not enable atomic graph");
assert(off.calls.skills.includes("xiaohongshu:write-xhs-content"));
assert.deepEqual(off.calls.providers, []);
assert.deepEqual(off.calls.atomicPort, [], "flag-off must not make hidden atomic Port calls");
assert.deepEqual(injected, offBaseline, "flag-off snapshot must be byte-for-byte compatible when caller injects a flag");
assert.deepEqual(off.calls.skills, offBaselineDeps.calls.skills, "flag-off call order must remain compatible");

console.log(JSON.stringify({
  status: "xhs-atomic-orchestrator-runtime-self-test passed",
  graphMode: xhs.executionPlan.graphMode,
  providerOrder: atomicDeps.calls.providers,
  packageContract: xhs.skillRecords.find((record) => record.stepId === "xhs_package").outputContract
}, null, 2));
