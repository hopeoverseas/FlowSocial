const list = (value) => Array.isArray(value) ? value : [];

export const RUN_NODE_DEFINITIONS = Object.freeze([
  { id: "direction", label: "内容方向", retryable: false },
  { id: "source_resolution", label: "来源解析", retryable: true },
  { id: "content_master", label: "事实母版", retryable: true },
  { id: "outline", label: "内容大纲", retryable: true },
  { id: "outline_confirmation", label: "大纲确认", retryable: false, humanGate: true },
  { id: "platform_writer", label: "平台正文", retryable: true },
  { id: "title", label: "最终标题", retryable: true },
  { id: "quality", label: "内容质检", retryable: true },
  { id: "render", label: "渲染与资产", retryable: true },
  { id: "visual_review", label: "视觉审核", retryable: true },
  { id: "revision", label: "对话修改", retryable: true, humanGate: true },
  { id: "delivery", label: "交付内容包", retryable: true },
  { id: "feedback", label: "发布反馈", retryable: false, humanGate: true }
]);

const STAGE_TO_NODE = Object.freeze({
  content_master: "content_master",
  outline: "outline",
  platform_writer: "platform_writer",
  title: "title",
  post_render_review: "visual_review",
  quality_review: "quality",
  image_plan: "render",
  optional_revision: "revision",
  revision: "revision",
  source_analysis: "source_resolution",
  source_blueprint: "source_resolution"
});

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function ensureRunLedger(run) {
  if (!run.ledger) {
    const createdAt = run.createdAt || now();
    run.ledger = {
      schemaVersion: "1.0",
      nodes: RUN_NODE_DEFINITIONS.map((definition) => ({ ...definition, status: definition.id === "direction" ? "completed" : "pending", attempts: definition.id === "direction" ? 1 : 0, lastStartedAt: definition.id === "direction" ? createdAt : null, lastCompletedAt: definition.id === "direction" ? createdAt : null, lastError: null, traceIds: [] })),
      decisions: [],
      skillExecutions: [],
      history: [{ at: createdAt, nodeId: "direction", status: "completed", reason: "content_run_created" }]
    };
  }
  return run.ledger;
}

export function updateRunNode(run, nodeId, status, detail = {}) {
  const ledger = ensureRunLedger(run);
  let node = ledger.nodes.find((item) => item.id === nodeId);
  if (!node) {
    node = { id: nodeId, label: detail.label || nodeId, retryable: detail.retryable !== false, status: "pending", attempts: 0, lastStartedAt: null, lastCompletedAt: null, lastError: null, traceIds: [] };
    ledger.nodes.push(node);
  }
  const at = detail.at || now();
  if (status === "running") {
    node.attempts = Number(node.attempts || 0) + 1;
    node.lastStartedAt = at;
    node.lastError = null;
  }
  if (["completed", "needs_review", "blocked", "failed", "skipped"].includes(status)) node.lastCompletedAt = at;
  if (status === "failed" || status === "blocked") node.lastError = detail.error || detail.reason || "unknown_error";
  if (detail.traceId && !node.traceIds.includes(detail.traceId)) node.traceIds.push(detail.traceId);
  node.status = status;
  node.detail = { ...(node.detail || {}), ...clone(detail), at: undefined };
  ledger.history.push({ at, nodeId, status, ...clone(detail) });
  return node;
}

export function recordRunDecision(run, { gate, decision, revision = null, actor = "user", detail = null, at = now() }) {
  const ledger = ensureRunLedger(run);
  const entry = { gate, decision, revision, actor, detail: clone(detail), at };
  ledger.decisions.push(entry);
  ledger.history.push({ at, nodeId: gate, status: "human_decision", decision, actor, revision });
  return entry;
}

export function attachTaskExecutionToRun(run, task) {
  const ledger = ensureRunLedger(run);
  const records = list(task.executionRecords);
  const traces = list(task.skillTraces);
  ledger.skillExecutions = records.length
    ? clone(records)
    : traces.map((trace) => ({
      capability: trace.skillName,
      status: trace.status || "completed",
      traceId: trace.traceId || trace.id || null,
      outputContract: trace.expectedContract || null,
      executionMode: trace.executionMode || "legacy_unknown",
      planAuthorization: trace.planAuthorization || "legacy_unknown",
      bundleHash: trace.bundleHash || null,
      inputHash: trace.inputHash || null,
      outputHash: trace.outputHash || null,
      executionPlanHash: trace.executionPlanHash || null,
      executedAt: trace.completedAt || task.createdAt || now()
    }));
  for (const record of ledger.skillExecutions) {
    const nodeId = STAGE_TO_NODE[record.stage] || (record.capability === "generate-platform-titles" ? "title" : null);
    if (!nodeId) continue;
    updateRunNode(run, nodeId, record.status === "failed" ? "failed" : record.status === "needs_review" ? "needs_review" : "completed", { capability: record.capability, traceId: record.traceId || null, outputContract: record.outputContract || null });
  }
  if (!ledger.nodes.find((item) => item.id === "platform_writer")?.status || ledger.nodes.find((item) => item.id === "platform_writer")?.status === "running") {
    updateRunNode(run, "platform_writer", task.status === "succeeded" ? "completed" : "needs_review", { contentTaskId: task.id });
  }
  const qualityDecision = task.qualityReview?.decision || task.qualityReview?.status || null;
  updateRunNode(run, "quality", ["block", "blocked", "failed"].includes(qualityDecision) ? "blocked" : qualityDecision === "needs_review" ? "needs_review" : "completed", { decision: qualityDecision || "completed" });
  return ledger;
}

export function buildRunTrace(run, task = null) {
  const ledger = ensureRunLedger(run);
  if (task && !ledger.skillExecutions.length) attachTaskExecutionToRun(run, task);
  const nodes = ledger.nodes.map((node) => ({ ...clone(node), retryAvailable: Boolean(node.retryable && ["failed", "blocked", "needs_review"].includes(node.status)) }));
  const activeNode = nodes.find((node) => node.status === "running") || null;
  const blockers = nodes.filter((node) => ["failed", "blocked"].includes(node.status)).map((node) => ({ nodeId: node.id, label: node.label, error: node.lastError }));
  return {
    schemaVersion: "1.0",
    kind: "ContentRunTrace",
    runId: run.id,
    state: run.state,
    version: run.version,
    lineage: {
      workspaceId: run.workspaceId || null,
      companyId: run.companyId || null,
      socialAccountId: run.socialAccountId || run.accountId || null,
      strategySnapshotId: run.strategySnapshotId || null,
      factSnapshotId: run.factSnapshotId || null,
      knowledgeSnapshotId: run.knowledgeSnapshotId || null,
      contentPatternSnapshotId: run.contentPatternSnapshotId || null,
      contentExecutionContextId: run.contentExecutionContextId || null,
      directionCardId: run.directionCardId || null,
      contentOpportunityId: run.contentOpportunityId || null,
      hotspotAssetIds: clone(
        run.hotspotAssetIds
        || run.sourceEvidenceSnapshot?.hotspots?.map((item) => item.id)
        || []
      ),
      contentTaskId: run.contentTaskId || task?.id || null
    },
    activeNode,
    nodes,
    blockers,
    executionPlan: clone(run.skillExecutionPlan || task?.skillExecutionPlan || null),
    sourceTrace: clone(run.sourceTrace || task?.contentSourceTrace || null),
    sourceEvidenceSnapshot: clone(run.sourceEvidenceSnapshot || null),
    decisions: clone(ledger.decisions),
    skillExecutions: clone(ledger.skillExecutions),
    events: clone(run.events || []),
    ledgerHistory: clone(ledger.history),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}
