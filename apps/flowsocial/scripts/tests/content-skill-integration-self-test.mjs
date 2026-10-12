import assert from "node:assert/strict";
import { buildRevisionImpactPlan, buildSkillExecutionPlan, buildUnifiedPlatformSkillExecutionPlan, refreshSkillExecutionPlan } from "../../content-agent/skill-execution-plan.mjs";
import { runContentSkill } from "../../content-agent/skill-runner.mjs";
import { ensureRunLedger } from "../../content-agent/run-ledger.mjs";
import { rerunRevisionDownstream } from "../../content-agent/revision-rerun-engine.mjs";
import { reviseContentPackage } from "../../content-engine.mjs";

const xhs = buildSkillExecutionPlan({
  platform: "xiaohongshu",
  sourcePlan: { mode: "mixed", sources: [{ type: "viral_reference", analysisCandidateIds: ["reference_1"] }, { type: "knowledge_base", candidateIds: ["knowledge_1"] }] },
  options: { naturalizationMode: "audit_only", hasRenderedAssets: false }
});
assert.equal(xhs.steps.find((step) => step.id === "source_analysis").enabled, true);
assert.equal(xhs.referenceAnalysisTrace.decision, "enabled");
assert.equal(xhs.referenceAnalysisTrace.result.status, "pending");
assert.equal(xhs.referenceAnalysisTrace.humanReviewGate.status, "pending");
assert.equal(xhs.steps.find((step) => step.id === "pattern_review").humanConfirmation, true);
assert.ok(xhs.steps.findIndex((step) => step.id === "naturalization") < xhs.steps.findIndex((step) => step.id === "title"));
assert.equal(xhs.steps.find((step) => step.id === "visual_design").state, "skipped");
assert.ok(xhs.steps.findIndex((step) => step.id === "schema_and_reference") < xhs.steps.findIndex((step) => step.id === "visual_design"));
assert.ok(xhs.steps.findIndex((step) => step.id === "visual_design") < xhs.steps.findIndex((step) => step.id === "render"));
assert.equal(xhs.steps.find((step) => step.id === "visual_review").state, "waiting_condition");

const requestedButFlaggedOff = buildSkillExecutionPlan({ platform: "xiaohongshu", options: { enableXhsIntegratedPageDesign: true } });
assert.equal(requestedButFlaggedOff.steps.find((step) => step.id === "visual_design").state, "waiting_condition");
assert.equal(requestedButFlaggedOff.steps.find((step) => step.id === "visual_design").reason, "feature_flag_disabled");
const enabledDesign = buildSkillExecutionPlan({ platform: "xiaohongshu", options: { enableXhsIntegratedPageDesign: true, featureFlags: { xhsIntegratedPageDesignSkill: true } } });
assert.equal(enabledDesign.steps.find((step) => step.id === "visual_design").state, "planned");

const wechat = buildSkillExecutionPlan({ platform: "wechat", sourcePlan: { mode: "knowledge_base", sources: [{ type: "knowledge_base" }] } });
assert.equal(wechat.referenceAnalysisTrace.decision, "skipped");
assert.equal(wechat.steps.find((step) => step.id === "source_analysis").state, "skipped");
assert.ok(wechat.steps.findIndex((step) => step.id === "wechat_content_review") < wechat.steps.findIndex((step) => step.id === "title"));
assert.ok(wechat.steps.findIndex((step) => step.id === "title") < wechat.steps.findIndex((step) => step.id === "image_plan"));
assert.equal(wechat.steps.filter((step) => step.capability === "review-wechat-article").length, 1);

const sharedMasterRef = { id: "shared_master_1", hash: "a".repeat(64) };
const unifiedXhs = buildUnifiedPlatformSkillExecutionPlan({ platform: "xiaohongshu", sourcePlan: { mode: "knowledge_base", sources: [{ type: "knowledge_base" }] }, sharedContentMasterRef: sharedMasterRef, createdAt: "2026-08-05T10:00:00.000Z" });
assert.equal(unifiedXhs.authorization.mode, "strict");
assert.equal(unifiedXhs.steps.filter((step) => step.capability === "build-content-master").length, 0);
assert.deepEqual(unifiedXhs.steps.find((step) => step.id === "shared_content_master").sharedContentMasterRef, sharedMasterRef);
assert.deepEqual(unifiedXhs.steps.find((step) => step.id === "outline").dependsOn, ["shared_content_master"]);

const reviewedReference = refreshSkillExecutionPlan(xhs, { referenceAnalysis: { status: "completed", analysisId: "analysis_1", reviewStatus: "approved", contentPatternSnapshotId: "pattern_snapshot_1" } });
assert.equal(reviewedReference.referenceAnalysisTrace.result.analysisId, "analysis_1");
assert.equal(reviewedReference.referenceAnalysisTrace.humanReviewGate.status, "approved");
assert.equal(reviewedReference.steps.find((step) => step.id === "pattern_review").state, "completed");
assert.equal(reviewedReference.steps.find((step) => step.id === "content_master").state, "planned");

const impact = buildRevisionImpactPlan({ platform: "xiaohongshu", requestClass: "image_spec", changedPaths: ["/image_specs/0/prompt"] });
assert.equal(impact.rerunFrom, "visual_design");
assert.deepEqual(impact.affectedSteps, ["visual_design", "render", "visual_review"]);

const run = { id: "run_test", createdAt: new Date().toISOString() };
ensureRunLedger(run);
const titleStep = xhs.steps.find((step) => step.id === "title");
const success = await runContentSkill({
  capability: "generate-platform-titles",
  platform: "xiaohongshu",
  input: { completed_content: {} },
  generateText: async () => ({ mode: "mock", data: { status: "success", data: { candidates: [] } } }),
  fallback: { status: "needs_review", data: { candidates: [] } },
  planStep: titleStep,
  run
});
assert.equal(success.executionRecord.status, "completed");
assert.equal(success.skillTrace.providerSucceeded, null, "missing Provider telemetry must remain unknown rather than false or true");
assert.equal(success.executionRecord.inputContract, titleStep.inputContract);
assert.ok(success.skillTrace.invocationId);
assert.equal(run.ledger.nodes.find((node) => node.id === "title").status, "completed");

let writerAttempts = 0;
let writerError;
try { await runContentSkill({
  capability: "write-xhs-content",
  platform: "xiaohongshu",
  input: {},
  generateText: async () => { writerAttempts += 1; throw new Error("temporary provider failure PRIVATE_PROMPT"); },
  fallback: {},
  planStep: xhs.steps.find((step) => step.id === "platform_writer")
}); } catch (error) { writerError = error; }
assert.equal(writerAttempts, 2);
assert.equal(writerError?.code, "SKILL_EXECUTION_FAILED");
assert.equal(writerError?.message, "write-xhs-content execution failed");
assert.equal(JSON.stringify(writerError).includes("PRIVATE_PROMPT"), false);

let recoveryAttempts = 0;
await assert.rejects(() => runContentSkill({
  capability: "write-wechat-article",
  platform: "wechat",
  input: {},
  generateText: async () => { recoveryAttempts += 1; throw Object.assign(new Error("PRIVATE_RECOVERY_BODY"), { code: "MODEL_HTTP_5XX" }); },
  fallback: {},
  task: "write_wechat_article_v2_recovery",
  planStep: wechat.steps.find((step) => step.id === "platform_writer")
}), (error) => error.code === "MODEL_HTTP_5XX" && !error.message.includes("PRIVATE_RECOVERY_BODY"));
assert.equal(recoveryAttempts, 1, "manual recovery must not inherit the two-attempt orchestrator plan");

const degraded = await runContentSkill({
  capability: "plan-wechat-images",
  platform: "wechat",
  input: {},
  generateText: async () => { throw new Error("image planner unavailable"); },
  fallback: { cover: null, slots: [] },
  planStep: wechat.steps.find((step) => step.id === "image_plan")
});
assert.equal(degraded.executionRecord.status, "skipped");
assert.equal(degraded.executionRecord.failurePolicy, "keep_text_only");
assert.equal(degraded.executionRecord.productionEligibleOutput, false);
assert.equal(degraded.skillTrace.fallbackUsed, true);
assert.equal(JSON.stringify(degraded).includes("image planner unavailable"), false);

const upstreamPlan = refreshSkillExecutionPlan(wechat, { revisionRequested: true });
const upstreamTask = { id: "content_upstream", version: 1, platform: "wechat", currentContent: { recommended_title: "原题", article_markdown: "原文" }, contentMaster: { confirmed_facts: [] }, contentIntentProfile: {}, skillExecutionPlan: upstreamPlan };
const upstreamPatch = { status: "needs_review", data: { content_task_id: upstreamTask.id, base_version: 1, user_instruction: "加入新的客户案例", request_class: "claim", execution_mode: "rerun_upstream", target_paths: [], locked_paths: [], operations: [], evidence_impact: "requires_new_evidence", rerun_plan: [], quality_checks: [], version: { parent: 1, proposed: 2, change_summary: "新增案例" }, clarifying_question: "请提供案例证据" } };
const upstream = await reviseContentPackage({ task: upstreamTask, instruction: "加入新的客户案例", routing: { requestClass: "claim", executionMode: "rerun_upstream" } }, { generateText: async () => ({ mode: "mock", data: upstreamPatch }), planStep: upstreamPlan.steps.find((step) => step.id === "revision") || null });
assert.equal(upstream.requiresUpstreamConfirmation, true);
assert.deepEqual(upstream.contentPackage, upstreamTask.currentContent);
assert.equal(upstream.patch.status, "awaiting_upstream_confirmation");

const longSection = "稳定内容运营需要明确流程、事实边界和复盘机制。".repeat(35);
const revisedWechat = { recommended_title: "稳定内容系统", title_candidates: ["稳定内容系统"], abstract: "方法说明", opening: "先看问题。", article_markdown: `## 问题\n${longSection}\n## 方法\n${longSection}\n## 行动\n${longSection}`, cta: "保存方法", claim_map: [], image_plan: { cover: null, slots: [] } };
const downstreamTask = { id: "content_downstream", version: 1, platform: "wechat", contentRunId: "run_1", currentContent: revisedWechat, contentMaster: { reader_value: "建立稳定内容系统", central_thesis: "稳定运营依赖流程", confirmed_facts: [], source_list: [] }, confirmedOutline: { outline_id: "outline_1", content_promise: "建立稳定内容系统", sections: [{ section_id: "S1", heading: "问题", objective: "说明问题", key_points: ["问题"] }, { section_id: "S2", heading: "方法", objective: "说明方法", key_points: ["方法"] }, { section_id: "S3", heading: "行动", objective: "说明行动", key_points: ["行动"] }] }, contentIntentProfile: {}, contentTaskBrief: {}, skillExecutionPlan: wechat };
const downstreamImpact = buildRevisionImpactPlan({ platform: "wechat", requestClass: "copy", changedPaths: ["/article_markdown"] });
const downstream = await rerunRevisionDownstream({ task: downstreamTask, contentPackage: revisedWechat, revisionImpact: downstreamImpact, instruction: "精简正文" }, { generateText: async (request) => request.skill_runtime.skill_name === "review-wechat-article" ? ({ mode: "mock", data: { status: "success", data: { decision: "pass", findings: [], patches: [], changes: [], fact_recheck_required: false, publish_time_checks: [] } } }) : ({ mode: "mock", data: { status: "success", data: { stage: "final_after_body", platform: "wechat_official_account", candidates: [{ title_id: "T01", title: "稳定内容运营，先建立流程", claim_ids: [], risk: "low", scores: { overall: 4 } }], recommendations: { balanced: "T01" }, ab_tests: [], same_account_signal_usage: { used: false, signal_ids: [], interpretation: "" } } } }) });
assert.ok(downstream.executedSteps.includes("wechat_content_review"));
assert.ok(downstream.executedSteps.includes("title"));
assert.ok(downstream.executedSteps.includes("quality"));
assert.equal(downstream.contentPackage.recommended_title, "稳定内容运营，先建立流程");

console.log(JSON.stringify({
  status: "content-skill-integration-self-test passed",
  xhsSteps: xhs.steps.length,
  wechatSteps: wechat.steps.length,
  writerAttempts,
  recoveryAttempts,
  imagePlannerFallback: degraded.executionRecord.status,
  revisionAffectedSteps: impact.affectedSteps,
  upstreamProtected: upstream.requiresUpstreamConfirmation,
  downstreamExecuted: downstream.executedSteps
}, null, 2));

