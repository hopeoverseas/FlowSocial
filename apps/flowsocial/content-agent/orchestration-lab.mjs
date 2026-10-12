import { ACTIVE_STRATEGY_SNAPSHOT_VERSION, CONTENT_DIRECTION_CARD_VERSION, CONTENT_EXECUTION_CONTEXT_VERSION, CONTENT_STRATEGY_PROFILE_VERSION, FACT_SNAPSHOT_VERSION, STRATEGY_DOCUMENT_VERSION } from "../contracts/strategy-content-contracts.mjs";
import { buildRunTrace } from "./run-ledger.mjs";
import { buildSkillConformanceReport } from "./skill-conformance.mjs";
import { beginContentGeneration, beginOutline, completeContentGeneration, confirmOutline, createContentRun, failContentGeneration, failOutlineGeneration, saveGeneratedOutline } from "./workflow-engine.mjs";

const outline = {
  outline_id: "lab_outline",
  content_promise: "验证总编排状态和合同传递",
  sections: [
    { section_id: "S1", heading: "结论", objective: "说明核心判断", key_points: ["合同优先"] },
    { section_id: "S2", heading: "流程", objective: "说明执行路径", key_points: ["状态可追踪"] },
    { section_id: "S3", heading: "边界", objective: "说明失败处理", key_points: ["失败可重试"] }
  ]
};

export function buildOrchestrationReadinessReport() {
  const skills = buildSkillConformanceReport();
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    contracts: {
      StrategyDocument: STRATEGY_DOCUMENT_VERSION,
      ActiveStrategySnapshot: ACTIVE_STRATEGY_SNAPSHOT_VERSION,
      FactSnapshot: FACT_SNAPSHOT_VERSION,
      ContentStrategyProfile: CONTENT_STRATEGY_PROFILE_VERSION,
      ContentDirectionCard: CONTENT_DIRECTION_CARD_VERSION,
      ContentExecutionContext: CONTENT_EXECUTION_CONTEXT_VERSION,
      ContentRun: "1.0"
    },
    replaceableBoundaries: ["strategy-adapter", "skill-adapter-registry", "platform-metric-adapter"],
    fixedPolicies: ["immutable_snapshots", "confirmed_outline_required", "facts_must_be_traceable", "skills_cannot_control_workflow", "strategy_cannot_be_auto_mutated"],
    skillConformance: skills,
    readyForParallelIntegration: skills.valid,
    blockingReasons: skills.errors
  };
}

export function simulateContentOrchestration({ platform = "xiaohongshu", failOnceAt = null } = {}) {
  if (!["xiaohongshu", "wechat"].includes(platform)) throw Object.assign(new Error("platform must be xiaohongshu or wechat"), { statusCode: 400 });
  if (failOnceAt && !["outline", "platform_writer"].includes(failOnceAt)) throw Object.assign(new Error("failOnceAt must be outline or platform_writer"), { statusCode: 400 });
  const store = { contentTasks: [] };
  const executionContext = { id: "execution_lab", strategySnapshotId: "strategy_lab", factSnapshotId: "facts_lab", knowledgeSnapshotId: "knowledge_lab", directionCard: { id: "direction_lab" } };
  const run = createContentRun(store, {
    accountId: "account_lab",
    recommendation: { id: "recommendation_lab", topic: "总编排验收", reason: "验证可替换契约与失败恢复" },
    generationPayload: { sourceType: "orchestration_lab", ideaTitle: "总编排验收", platform, contentPurposeId: "professional_opinion", contentTaskBrief: { topic: "总编排验收", strategySnapshotId: "strategy_lab", factSnapshotId: "facts_lab" }, contentSourcePlan: { mode: "knowledge_base", sources: [{ type: "knowledge_base", candidateIds: ["knowledge_1"] }] }, contentExecutionContext: executionContext }
  });
  beginOutline(run);
  if (failOnceAt === "outline") {
    failOutlineGeneration(run, new Error("simulated_outline_failure"));
    beginOutline(run);
  }
  saveGeneratedOutline(run, { status: "ready", contentMaster: { confirmed_facts: [{ fact_id: "F1", fact: "验收事实", source_ids: ["knowledge_1"] }] }, outline, validation: { valid: true }, skillTraces: [{ skillName: "generate-content-outline", traceId: "trace_outline_lab", expectedContract: "ContentOutline@1.0" }] });
  confirmOutline(run);
  beginContentGeneration(run);
  if (failOnceAt === "platform_writer") {
    failContentGeneration(run, new Error("simulated_writer_failure"));
    beginContentGeneration(run);
  }
  const writer = platform === "xiaohongshu" ? "write-xhs-content" : "write-wechat-article";
  const task = {
    id: "content_lab",
    status: "succeeded",
    qualityReview: { decision: "pass" },
    executionRecords: [
      { capability: "build-content-master", stage: "content_master", status: "completed", outputContract: "ContentMaster@2.0", traceId: "trace_master_lab" },
      { capability: "generate-content-outline", stage: "outline", status: "completed", outputContract: "ContentOutline@1.0", traceId: "trace_outline_lab" },
      { capability: writer, stage: "platform_writer", status: "completed", outputContract: platform === "xiaohongshu" ? "XhsPostPackage@2.0" : "WechatArticle@2.0", traceId: "trace_writer_lab" },
      { capability: "generate-platform-titles", stage: "title", status: "completed", outputContract: "PlatformTitleList@1.0", traceId: "trace_title_lab" }
    ]
  };
  completeContentGeneration(run, task);
  return { schemaVersion: "1.0", simulated: true, persisted: false, platform, failOnceAt, trace: buildRunTrace(run, task) };
}

