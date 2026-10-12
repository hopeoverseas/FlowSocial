import assert from "node:assert/strict";
import {
  adaptLegacySinglePlatformRunReadOnly,
  createUnifiedWriterContext,
  hashUnifiedContent,
  withUnifiedContentHash
} from "../../content-agent/unified-content-contracts.mjs";
import {
  runLegacyCompatibleUnifiedContentOrchestration,
  runUnifiedContentOrchestration
} from "../../content-agent/unified-content-orchestrator.mjs";
import { createUnifiedContentProductSnapshot } from "../../content-agent/unified-content-server-adapter.mjs";

const AT = "2026-08-05T10:00:00.000Z";
const strategyRef = { id: "strategy_snapshot_1", hash: hashUnifiedContent({ id: "strategy_snapshot_1", revision: 7 }) };
const opportunityRef = { id: "opportunity_1", hash: hashUnifiedContent({ id: "opportunity_1", topic: "稳定内容系统" }) };
const designDna = {
  schemaVersion: "1.0", kind: "DesignDNA", id: "design_dna_1", accountId: "account_xhs_1", version: 1, status: "confirmed",
  colors: ["#18352d"], fontPreferences: ["sans"], layoutPreferences: ["grid"], materials: ["paper"],
  photographyOrIllustrationDirection: "editorial", forbiddenMotifs: ["watermark"], referenceNotes: "fixture",
  approvedTextSummary: "fixture", sources: [],
  authorization: { approvedFileIds: [], excludedFileIds: [], providerReferenceImageSupported: false, referenceImagesTransmitted: false, externalInputMode: "approved_text_summary_only", disclosure: "fixture" },
  confirmation: { decision: "confirmed", confirmedBy: "fixture", note: "fixture", confirmedAt: AT },
  createdAt: AT, updatedAt: AT
};
const designDnaRef = { id: designDna.id, hash: hashUnifiedContent(designDna) };

function writerContext(platform) {
  const outputPlatform = platform === "wechat" ? "wechat_official_account" : "xiaohongshu";
  return createUnifiedWriterContext({
    schemaVersion: "1.0", contract: "UnifiedWriterContext@1.0", platform: outputPlatform,
    account_id: platform === "wechat" ? "account_wechat_1" : "account_xhs_1",
    topic_id: opportunityRef.id, intent_profile_id: "intent_1", content_purpose_id: "authority",
    account_context: { subject_type: "company", account_mode: "official", matrix_role: "authority", trust_source: "institution" },
    creative_mechanism: platform === "wechat" ? "framework" : "checklist", journey_stage: "trust", coordination_mode: "coordinated",
    matrix_coordination: { shared_campaign_topic_id: opportunityRef.id, differentiation_angle: `${platform}:fixture`, prohibited_overlap: [] },
    authority_refs: {
      activeStrategySnapshotRef: strategyRef, contentOpportunityRef: opportunityRef,
      mechanismDecisionRef: { id: mechanismDecision().id, hash: mechanismDecision().decisionHash },
      accountRef: { id: `account_${platform}`, hash: hashUnifiedContent({ platform, kind: "account" }) },
      accountStrategyRef: { id: `account_strategy_${platform}`, hash: hashUnifiedContent({ platform, kind: "strategy" }) }
    }
  });
}

function mechanismDecision({ blocked = false } = {}) {
  return withUnifiedContentHash({
    schemaVersion: "1.0",
    contract: "ContentMechanismDecision@1.0",
    id: blocked ? "mechanism_blocked" : "mechanism_approved",
    companyId: "company_1",
    contentProjectRef: { id: "content_project_input_1", hash: hashUnifiedContent({ id: "content_project_input_1" }) },
    activeStrategySnapshotRef: strategyRef,
    evaluated: [
      {
        mechanism: "hotspot",
        status: "not_available",
        candidateRefs: [],
        reason: "no_hotspot_candidate_available",
        factPolicy: "external_event_not_business_fact"
      },
      {
        mechanism: "strategy_only",
        status: "selected",
        candidateRefs: [],
        reason: "selected_by_source_planner:strategy_only",
        factPolicy: null
      }
    ],
    selectedMechanism: "strategy_only",
    selectedSourceRefs: [],
    strategyHotspotPolicy: blocked ? "required" : "optional",
    deviation: blocked
      ? { status: "blocked", reason: "required hotspot unavailable", userConfirmationStatus: "pending" }
      : { status: "none", reason: null, userConfirmationStatus: "not_required" },
    decidedAt: AT,
    decisionHash: ""
  }, "decisionHash");
}

function input(overrides = {}) {
  return {
    project: {
      id: "content_project_1",
      companyId: "company_1",
      contentOpportunityRef: opportunityRef,
      activeStrategySnapshotRef: strategyRef,
      designDnaSnapshotRef: designDnaRef,
      designDnaAuthority: { ref: designDnaRef, snapshot: designDna },
      writerContexts: { xiaohongshu: writerContext("xiaohongshu"), wechat: writerContext("wechat") },
      accounts: { xiaohongshu: "account_xhs_1", wechat: "account_wechat_1" },
      confirmations: {
        xiaohongshu: { outline_confirmation: "confirmed" },
        wechat: { outline_confirmation: "confirmed" }
      },
      platformInputs: {
        xiaohongshu: { audience: "内容负责人" },
        wechat: { audience: "企业管理者" }
      },
      createdAt: AT
    },
    mechanismDecision: mechanismDecision(),
    sourcePlan: { schemaVersion: "0.1", mode: "strategy_only", sources: [] },
    masterInput: { topic: "稳定内容系统", thesis: "流程与证据共同决定稳定性" },
    ...overrides
  };
}

function writerOutput(platform) {
  if (platform === "xiaohongshu") {
    return {
      invocationId: `writer_${platform}`,
      candidates: [{ id: `candidate_${platform}`, body: `${platform} independent draft` }],
      post_copy: { title_candidates: [{ title: "preliminary xhs title" }], recommended_title: "preliminary xhs title" }
    };
  }
  return {
    invocationId: `writer_${platform}`,
    candidates: [{ id: `candidate_${platform}`, body: `${platform} independent draft` }],
    title_candidates: [{ title: "preliminary wechat title" }],
    recommended_title: "preliminary wechat title"
  };
}

function passingWechatReview() {
  return {
    decision: "pass",
    findings: [],
    patches: [],
    changes: [],
    fact_recheck_required: false,
    publish_time_checks: []
  };
}

function dependencies(overrides = {}) {
  const calls = { master: 0, briefs: [], skills: [], titleInputs: [], imagePlanInputs: [] };
  return {
    calls,
    now: () => AT,
    buildSharedContentMaster: async (_value, authorization) => {
      calls.master += 1;
      assert.equal(authorization.planAuthorization, "strict");
      assert.equal(authorization.step.capability, "build-content-master");
      return {
        schemaVersion: "3.0",
        contract: "ContentMaster@3.0",
        id: "shared_master_1",
        centralThesis: "流程与证据共同决定稳定性",
        confirmedFacts: [{ id: "fact_1", text: "所有平台共享同一事实母版" }]
      };
    },
    buildPlatformBrief: async ({ platform, sharedContentMasterRef, designDnaAuthority }) => {
      calls.briefs.push(platform);
      return {
        schemaVersion: "1.0",
        kind: "PlatformBrief",
        id: `brief_${platform}`,
        platform,
        sharedContentMasterRef,
        authorityType: "shared_content_master",
        editorialAngle: platform === "xiaohongshu" ? "卡片化拆解" : "长文论证",
        ...(platform === "xiaohongshu" ? { brief: { designDnaRef: designDnaAuthority.ref, designDna: designDnaAuthority.snapshot } } : {})
      };
    },
    executeSkillStep: async ({ platform, step, planAuthorization, input: skillInput }) => {
      calls.skills.push(`${platform}:${step.id}`);
      assert.equal(planAuthorization, "strict");
      if (step.id === "outline") return { id: `outline_${platform}`, sections: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] };
      if (step.id === "platform_writer") return writerOutput(platform);
      if (step.id === "title") calls.titleInputs.push(structuredClone(skillInput));
      if (step.id === "wechat_content_review") return passingWechatReview();
      if (step.id === "image_plan") {
        calls.imagePlanInputs.push(structuredClone(skillInput));
        assert.deepEqual(skillInput.article_review, passingWechatReview(), "image plan must receive the exact passing WeChat review");
      }
      return { id: `${step.id}_${platform}`, status: "passed" };
    },
    executeServiceStep: async ({ platform, step }) => ({ id: `${step.id}_${platform}`, service: step.service, status: "completed" }),
    ...overrides
  };
}

const deps = dependencies();
const snapshot = await runUnifiedContentOrchestration(input(), deps);
assert.equal(deps.calls.master, 1, "shared ContentMaster must be built exactly once");
assert.deepEqual(deps.calls.briefs, ["xiaohongshu", "wechat"]);
assert.equal(deps.calls.titleInputs.length, 2);
assert.ok(deps.calls.titleInputs.every((value) => value.stage === "final_after_body" && value.content_master.id === "shared_master_1" && value.completed_content && value.preliminary_titles.length === 1 && value.content_task_brief));
assert.deepEqual(deps.calls.titleInputs.map((value) => value.platform), ["xiaohongshu", "wechat_official_account"]);
assert.equal(deps.calls.imagePlanInputs.length, 1, "image plan must be reached exactly once after passing review");
assert.ok(deps.calls.skills.indexOf("wechat:wechat_content_review") < deps.calls.skills.indexOf("wechat:image_plan"), "image plan invocation must follow the passing review invocation");
assert.equal(snapshot.authorizationMode, "strict");
assert.equal(snapshot.entryMode, "native_strict");
assert.equal(snapshot.platformRuns.length, 2);
assert.equal(snapshot.contentProject.platformRuns.length, 2);
assert.equal(snapshot.sharedSkillRecords.length, 1);
assert.equal(snapshot.sharedSkillRecords[0].capability, "build-content-master");
assert.ok(snapshot.platformRuns.every((run) => run.platformRunRef.sharedContentMasterRef.id === snapshot.sharedContentMasterRef.id));
assert.ok(snapshot.platformRuns.every((run) => run.platformRunRef.sharedContentMasterRef.hash === snapshot.sharedContentMasterRef.hash));
assert.notEqual(snapshot.platformRuns[0].platformBriefRef.hash, snapshot.platformRuns[1].platformBriefRef.hash);
assert.notEqual(snapshot.platformRuns[0].platformRunRef.outlineRef.hash, snapshot.platformRuns[1].platformRunRef.outlineRef.hash);
assert.notEqual(snapshot.platformRuns[0].platformRunRef.writerInvocationRef.hash, snapshot.platformRuns[1].platformRunRef.writerInvocationRef.hash);
assert.ok(snapshot.platformRuns.every((run) => run.executionPlan.authorization.mode === "strict"));
assert.ok(snapshot.platformRuns.every((run) => run.executionPlan.steps.some((step) => step.id === "shared_content_master" && step.kind === "binding")));
assert.ok(snapshot.platformRuns.flatMap((run) => run.skillRecords).every((record) => record.planAuthorization === "strict" && record.inputContract && record.outputContract && Array.isArray(record.dependsOn)));
assert.equal(snapshot.stateBindings.strategyHash, strategyRef.hash);
assert.equal(snapshot.stateBindings.sharedContentMasterHash, snapshot.sharedContentMasterRef.hash);
const snapshotWithoutHash = structuredClone(snapshot);
delete snapshotWithoutHash.snapshotHash;
assert.equal(snapshot.snapshotHash, hashUnifiedContent(snapshotWithoutHash));

let liveRuntimeProviderAttempts = 0;
const liveDecision = mechanismDecision();
const liveRuntimeStore = {
  accounts: [
    { id: "account_xhs_1", companyId: "company_1", platform: "xiaohongshu", accountIdentity: { subjectType: "company_official", trustSources: ["institution"] }, visualStyle: { designDnaSnapshotId: designDna.id, designDnaVersion: 1 } },
    { id: "account_wechat_1", companyId: "company_1", platform: "wechat", accountIdentity: { subjectType: "company_official", trustSources: ["institution"] } }
  ],
  designDnaSnapshots: [designDna],
  unifiedContentPrerequisiteRequests: [{ mechanismDecisionRef: { id: liveDecision.id, hash: liveDecision.decisionHash }, designDnaSnapshotRef: designDnaRef, projectInputRef: { id: "intent_1", hash: hashUnifiedContent({ id: "intent_1" }) } }],
  unifiedContentOpportunities: [{ id: opportunityRef.id, opportunityHash: opportunityRef.hash, companyId: "company_1", topic: "稳定内容系统", contentObjective: "authority" }],
  accountStrategySnapshots: [
    { id: "strategy_xhs", accountId: "account_xhs_1", companyId: "company_1", status: "active", payload: { matrixRole: "authority", differentiationAngle: "xhs:fixture", creativeMechanism: "checklist", journeyStage: "trust" } },
    { id: "strategy_wechat", accountId: "account_wechat_1", companyId: "company_1", status: "active", payload: { matrixRole: "authority", differentiationAngle: "wechat:fixture", creativeMechanism: "framework", journeyStage: "trust" } }
  ]
};
await assert.rejects(
  () => createUnifiedContentProductSnapshot(liveRuntimeStore, { requestId: "live_zero_retry_fixture", orchestrationInput: input() }, {
    liveExecution: true,
    resolveActiveStrategySnapshot: async () => ({ id: strategyRef.id }),
    generateText: async () => {
      liveRuntimeProviderAttempts += 1;
      throw Object.assign(new Error("fixture provider failure"), { code: "FIXTURE_PROVIDER_FAILED" });
    }
  }),
  (error) => error.stage === "master" && error.stepId === "content_master" && error.causeCode === "FIXTURE_PROVIDER_FAILED"
);
assert.equal(liveRuntimeProviderAttempts, 1, "Live Server Adapter must propagate maxAttempts=1 into actual runContentSkill");
assert.equal(liveRuntimeStore.unifiedContentProjects.length, 0, "failed Live Runtime must not append a product snapshot");

await assert.rejects(
  () => runUnifiedContentOrchestration(input(), dependencies({
    buildPlatformBrief: async ({ platform, sharedContentMasterRef }) => ({
      id: `brief_${platform}`,
      platform,
      sharedContentMasterRef,
      authorityType: "shared_content_master",
      sourcePlatformOutputRef: platform === "xiaohongshu" ? { id: "wechat_draft", hash: "f".repeat(64) } : null
    })
  })),
  (error) => error.code === "CROSS_PLATFORM_AUTHORITY_FORBIDDEN"
);

await assert.rejects(
  () => runUnifiedContentOrchestration(input(), dependencies({
    buildPlatformExecutionPlan: async (plan, planInput) => ({
      ...plan,
      steps: planInput.platform === "xiaohongshu" ? plan.steps.filter((step) => step.id !== "platform_writer") : plan.steps
    })
  })),
  (error) => error.code === "SKILL_STEP_NOT_PLANNED"
);

await assert.rejects(
  () => runUnifiedContentOrchestration(input({ mechanismDecision: mechanismDecision({ blocked: true }) }), dependencies()),
  (error) => error.code === "CONTENT_MECHANISM_USER_CONFIRMATION_REQUIRED"
);

const phaseFailures = [
  ["master", { buildSharedContentMaster: async () => { throw Object.assign(new Error("private master failure"), { code: "MASTER_UNAVAILABLE" }); } }],
  ["outline", { executeSkillStep: async ({ step }) => { if (step.id === "outline") throw Object.assign(new Error("private outline failure"), { code: "OUTLINE_UNAVAILABLE" }); return {}; } }],
  ["writer", { executeSkillStep: async ({ platform, step }) => { if (step.id === "platform_writer") throw Object.assign(new Error("private writer failure"), { code: "WRITER_UNAVAILABLE" }); if (step.id === "outline") return { id: `outline_${platform}` }; return {}; } }],
  ["review_render", { executeSkillStep: async ({ platform, step }) => { if (step.id === "title") throw Object.assign(new Error("private review failure"), { code: "REVIEW_UNAVAILABLE" }); if (step.id === "outline") return { id: `outline_${platform}` }; if (step.id === "platform_writer") return writerOutput(platform); return {}; } }]
];
for (const [stage, override] of phaseFailures) {
  await assert.rejects(
    () => runUnifiedContentOrchestration(input(), dependencies(override)),
    (error) => error.stage === stage && error.recoverable === true && !error.message.includes("private")
  );
}

await assert.rejects(
  () => runUnifiedContentOrchestration(input(), dependencies({
    executeSkillStep: async ({ step }) => {
      if (step.id === "outline") throw Object.assign(new Error("private validation content"), {
        code: "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID",
        details: { fieldPaths: ["data.sections[].heading", "data.image_spec_alignment", "private.value", "data.sections[].heading"] }
      });
      return {};
    }
  })),
  (error) => error.stage === "outline"
    && error.causeCode === "UNIFIED_SKILL_OUTPUT_CONTRACT_INVALID"
    && JSON.stringify(error.fieldPaths) === JSON.stringify(["data.sections[].heading", "data.image_spec_alignment"])
    && !error.message.includes("private validation content")
);

const legacyProjection = adaptLegacySinglePlatformRunReadOnly({ id: "legacy_run_05o", platform: "xiaohongshu", packageHash: "legacy_hash" });
const compatibilityDeps = dependencies({
  buildSharedContentMaster: async () => ({ schemaVersion: "3.0", contract: "ContentMaster@3.0", id: "new_native_master_from_legacy_input", centralThesis: "兼容输入不改写历史" }),
  executeSkillStep: async ({ platform, step, planAuthorization }) => {
    assert.equal(planAuthorization, "compatibility");
    if (step.id === "outline") return { id: `outline_${platform}` };
    if (step.id === "platform_writer") return writerOutput(platform);
    if (step.id === "wechat_content_review") return passingWechatReview();
    return { id: `${step.id}_${platform}` };
  }
});
const compatibility = await runLegacyCompatibleUnifiedContentOrchestration({ ...input(), legacyProjection }, compatibilityDeps);
assert.equal(compatibility.entryMode, "legacy_compatibility");
assert.equal(compatibility.legacyProjection.provenance, "legacy_single_platform");
assert.equal(compatibility.legacyProjection.sharedContentMasterRef, null);
assert.equal(compatibility.legacyProjection.promotionEligible, false);
assert.equal(legacyProjection.sharedContentMasterRef, null, "legacy projection must remain immutable and un-relabelled");

console.log(JSON.stringify({
  status: "unified-content-orchestrator-self-test passed",
  masterBuilds: deps.calls.master,
  platforms: snapshot.platformRuns.map((run) => run.platform),
  strictSkillRecords: snapshot.platformRuns.reduce((total, run) => total + run.skillRecords.length, 0),
  phaseFailures: phaseFailures.map(([stage]) => stage),
  legacyProvenance: compatibility.legacyProjection.provenance
}, null, 2));
