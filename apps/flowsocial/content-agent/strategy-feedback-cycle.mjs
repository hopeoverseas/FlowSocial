import { createHash } from "node:crypto";

const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => structuredClone(value);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function fail(code, message, statusCode = 409, details = null) {
  throw Object.assign(new Error(message), { code, statusCode, details });
}

const STAGE_EXPERIMENTS = Object.freeze({
  distribution_to_click: { changeVariable: "title_cover_value_proposition", targetMetric: "coverClickRate", hypothesis: "更清楚地表达目标用户收益，可改善分发后的点击承接。" },
  delivery_to_open: { changeVariable: "title_value_proposition", targetMetric: "openRate", hypothesis: "更清楚地表达阅读收益，可改善送达后的打开承接。" },
  click_to_consume: { changeVariable: "opening_and_structure", targetMetric: "completionRate", hypothesis: "让开头兑现标题承诺并降低结构成本，可改善内容消费。" },
  open_to_consume: { changeVariable: "opening_length_and_structure", targetMetric: "completionRate", hypothesis: "缩短进入主题的路径并优化论证结构，可改善读完表现。" },
  consume_to_value: { changeVariable: "practical_value_or_interaction", targetMetric: "engagementRate", hypothesis: "强化可收藏、可讨论或可转述的增量价值，可改善价值反馈。" },
  value_to_relationship: { changeVariable: "series_promise_and_account_value", targetMetric: "followRate", hypothesis: "强化系列承诺与长期关注理由，可改善关系沉淀。" },
  relationship_to_business: { changeVariable: "cta_and_conversion_handoff", targetMetric: "qualifiedLeadRate", hypothesis: "补齐内容与业务承接之间的路径，可改善有效线索转化。" }
});

function projectCandidate(candidate) {
  const bottleneck = list(candidate.repeatedBottlenecks).sort((left, right) => Number(right.count || 0) - Number(left.count || 0))[0] || null;
  const experiment = STAGE_EXPERIMENTS[bottleneck?.stage] || {
    changeVariable: "strategy_agent_review_required",
    targetMetric: null,
    hypothesis: "保留当前策略不变，由策略 Agent 结合证据解析下一周期的单变量实验。"
  };
  const base = {
    schemaVersion: "1.0",
    contract: "StrategyAdjustmentCandidateProjection@1.0",
    id: candidate.id,
    sourceCandidateId: candidate.id,
    companyId: candidate.companyId || null,
    socialAccountId: candidate.socialAccountId || null,
    currentActiveStrategySnapshotId: candidate.currentEffectiveStrategyId || null,
    growthPlaybookId: candidate.growthPlaybookId || null,
    proposedScope: candidate.proposedScope,
    rationale: candidate.rationale,
    repeatedBottlenecks: clone(list(candidate.repeatedBottlenecks)),
    evidenceRefs: clone(list(candidate.evidenceRefs)),
    evidenceSummary: {
      sampleSize: candidate.sampleSize,
      cycleCount: candidate.cycleCount,
      businessObservedCount: candidate.businessObservedCount,
      confidence: candidate.confidence
    },
    nextCycleExperiment: {
      type: "single_variable_feedback_experiment",
      sourceBottleneck: bottleneck?.stage || null,
      changeVariable: experiment.changeVariable,
      keepConstant: ["active_strategy_snapshot", "account_identity", "growth_playbook", "platform"],
      targetMetric: experiment.targetMetric,
      hypothesis: experiment.hypothesis,
      validationWindow: "next_publishing_cycle"
    },
    authorityBoundary: {
      activeStrategyMutationAllowed: false,
      nextCycleInputAllowedAfterUserConfirmation: true,
      strategyAgentReviewStillRequired: true
    }
  };
  return { ...base, candidateHash: hash(base) };
}

function validateDecision(value) {
  const factHash = value?.factHash;
  const base = value && typeof value === "object" ? { ...value } : {};
  delete base.factHash;
  if (value?.schemaVersion !== "1.0" || value?.contract !== "StrategyAdjustmentDecision@1.0"
    || !value.id || !value.candidateRef?.id || !/^[a-f0-9]{64}$/.test(value.candidateRef?.hash || "")
    || !["approved_for_next_cycle", "rejected"].includes(value.resolution)
    || value.actorType !== "user" || !value.actorId || hash(base) !== factHash
    || value.claims?.activeStrategyMutated !== false
    || value.claims?.nextCycleInputAuthorized !== (value.resolution === "approved_for_next_cycle")) {
    fail("STRATEGY_ADJUSTMENT_DECISION_INVALID", "Strategy adjustment decision fact is invalid");
  }
  return value;
}

function validateBinding(value) {
  const base = { ...value };
  delete base.bindingHash;
  if (value?.schemaVersion !== "1.0" || value?.contract !== "StrategyAdjustmentCycleBinding@1.0"
    || !value.id || !value.decisionRef?.id || !/^[a-f0-9]{64}$/.test(value.decisionRef?.hash || "")
    || !value.cycleId || hash(base) !== value.bindingHash) {
    fail("STRATEGY_ADJUSTMENT_CYCLE_BINDING_INVALID", "Strategy adjustment cycle binding is invalid");
  }
  return value;
}

export function ensureStrategyAdjustmentFacts(store) {
  store.strategyAdjustmentDecisions ||= [];
  store.strategyAdjustmentCycleBindings ||= [];
  return { decisions: store.strategyAdjustmentDecisions, bindings: store.strategyAdjustmentCycleBindings };
}

function readStrategyAdjustmentFacts(store) {
  const decisions = store.strategyAdjustmentDecisions === undefined ? [] : store.strategyAdjustmentDecisions;
  const bindings = store.strategyAdjustmentCycleBindings === undefined ? [] : store.strategyAdjustmentCycleBindings;
  if (!Array.isArray(decisions) || !Array.isArray(bindings)) fail("STRATEGY_ADJUSTMENT_STORE_INVALID", "Strategy adjustment collections must be arrays");
  return { decisions, bindings };
}

export function buildStrategyAdjustmentWorkspace(store, feedbackWorkspace, { companyId = null, socialAccountId = null } = {}) {
  const facts = readStrategyAdjustmentFacts(store);
  const decisions = facts.decisions.map(validateDecision);
  const bindings = facts.bindings.map(validateBinding);
  const candidates = list(feedbackWorkspace?.strategyReviewCandidates)
    .map(projectCandidate)
    .filter((item) => (!companyId || item.companyId === companyId) && (!socialAccountId || item.socialAccountId === socialAccountId))
    .map((candidate) => {
      const decision = decisions.find((item) => item.candidateRef.id === candidate.id && item.candidateRef.hash === candidate.candidateHash) || null;
      const binding = decision ? bindings.find((item) => item.decisionRef.id === decision.id && item.decisionRef.hash === decision.factHash) || null : null;
      return { ...candidate, decision: decision ? clone(decision) : null, cycleBinding: binding ? clone(binding) : null };
    });
  return {
    schemaVersion: "1.0",
    contract: "StrategyAdjustmentWorkspace@1.0",
    companyId,
    socialAccountId,
    candidates,
    decisions: decisions.filter((item) => (!companyId || item.companyId === companyId) && (!socialAccountId || item.socialAccountId === socialAccountId)).map(clone),
    bindings: bindings.filter((item) => !companyId || item.companyId === companyId).map(clone),
    policy: {
      activeStrategyMutationAllowed: false,
      requiresExplicitUserDecision: true,
      onlyApprovedUnboundDecisionsEnterNextCycle: true
    }
  };
}

export function confirmStrategyAdjustmentDecision(store, feedbackWorkspace, candidateId, input = {}, { now = new Date().toISOString() } = {}) {
  const workspace = buildStrategyAdjustmentWorkspace(store, feedbackWorkspace, {
    companyId: input.companyId || null,
    socialAccountId: input.socialAccountId || null
  });
  const candidate = workspace.candidates.find((item) => item.id === candidateId);
  if (!candidate || candidate.candidateHash !== input.candidateHash) fail("STRATEGY_ADJUSTMENT_CANDIDATE_STALE", "The exact strategy adjustment candidate is missing or stale");
  if (input.actorType !== "user" || !String(input.actorId || "").trim() || input.userConfirmed !== true) {
    fail("STRATEGY_ADJUSTMENT_USER_CONFIRMATION_REQUIRED", "An explicit user decision is required", 400);
  }
  if (!["approved_for_next_cycle", "rejected"].includes(input.resolution)) fail("STRATEGY_ADJUSTMENT_RESOLUTION_INVALID", "Resolution is invalid", 400);
  if (!String(input.idempotencyKey || "").trim()) fail("STRATEGY_ADJUSTMENT_IDEMPOTENCY_KEY_REQUIRED", "idempotencyKey is required", 400);
  const request = {
    candidateRef: { id: candidate.id, hash: candidate.candidateHash },
    resolution: input.resolution,
    actorType: input.actorType,
    actorId: String(input.actorId).trim(),
    note: String(input.note || "").trim(),
    idempotencyKey: String(input.idempotencyKey).trim()
  };
  const requestHash = hash(request);
  const facts = ensureStrategyAdjustmentFacts(store);
  const replay = facts.decisions.find((item) => item.idempotencyKey === request.idempotencyKey);
  if (replay) {
    validateDecision(replay);
    if (replay.requestHash !== requestHash) fail("STRATEGY_ADJUSTMENT_IDEMPOTENCY_CONFLICT", "idempotencyKey was reused with different semantics");
    return { decision: clone(replay), created: false };
  }
  const previous = facts.decisions.map(validateDecision).find((item) => item.candidateRef.id === candidate.id);
  if (previous) fail("STRATEGY_ADJUSTMENT_ALREADY_DECIDED", "This strategy adjustment candidate already has a final decision");
  const base = {
    schemaVersion: "1.0",
    contract: "StrategyAdjustmentDecision@1.0",
    id: `strategy_adjustment_decision_${hash({ requestHash, idempotencyKey: request.idempotencyKey }).slice(0, 20)}`,
    companyId: candidate.companyId,
    socialAccountId: candidate.socialAccountId,
    currentActiveStrategySnapshotId: candidate.currentActiveStrategySnapshotId,
    candidateRef: request.candidateRef,
    resolution: request.resolution,
    approvedExperiment: request.resolution === "approved_for_next_cycle" ? clone(candidate.nextCycleExperiment) : null,
    evidenceRefs: clone(candidate.evidenceRefs),
    actorType: request.actorType,
    actorId: request.actorId,
    note: request.note,
    idempotencyKey: request.idempotencyKey,
    requestHash,
    confirmedAt: now,
    claims: {
      activeStrategyMutated: false,
      nextCycleInputAuthorized: request.resolution === "approved_for_next_cycle",
      providerCallPerformed: false,
      platformActionPerformed: false
    }
  };
  const decision = { ...base, factHash: hash(base) };
  validateDecision(decision);
  facts.decisions.push(decision);
  return { decision: clone(decision), created: true };
}

export function resolveConfirmedStrategyAdjustmentInputs(store, { companyId, decisionIds = [], activeStrategySnapshotId } = {}) {
  if (!Array.isArray(decisionIds)) fail("STRATEGY_ADJUSTMENT_DECISION_IDS_INVALID", "strategyAdjustmentDecisionIds must be an array", 400);
  const facts = readStrategyAdjustmentFacts(store);
  const boundIds = new Set(facts.bindings.map(validateBinding).map((item) => item.decisionRef.id));
  const requested = new Set(list(decisionIds));
  if (!requested.size) {
    return { decisionRefs: [], userDecisions: [], experimentByAccount: {} };
  }
  const decisions = facts.decisions.map(validateDecision).filter((item) => item.companyId === companyId
    && item.resolution === "approved_for_next_cycle"
    && item.currentActiveStrategySnapshotId === activeStrategySnapshotId
    && requested.has(item.id)
    && !boundIds.has(item.id));
  if (decisions.length !== requested.size) fail("STRATEGY_ADJUSTMENT_DECISION_SCOPE_INVALID", "One or more strategy adjustment decisions are unavailable, stale, rejected, or already bound");
  return {
    decisionRefs: decisions.map((item) => ({ id: item.id, hash: item.factHash })),
    userDecisions: decisions.map((item) => ({
      decisionId: item.id,
      status: "pending",
      type: "apply_confirmed_feedback_experiment",
      strategyAdjustmentDecisionRef: { id: item.id, hash: item.factHash },
      socialAccountId: item.socialAccountId,
      experiment: clone(item.approvedExperiment)
    })),
    experimentByAccount: Object.fromEntries(decisions.map((item) => [item.socialAccountId, clone(item.approvedExperiment)]))
  };
}

export function bindStrategyAdjustmentsToCycle(store, decisionRefs, cycleId, { companyId, boundAt = new Date().toISOString() } = {}) {
  const facts = ensureStrategyAdjustmentFacts(store);
  const created = [];
  for (const decisionRef of list(decisionRefs)) {
    const decision = facts.decisions.map(validateDecision).find((item) => item.id === decisionRef.id && item.factHash === decisionRef.hash);
    if (!decision || decision.companyId !== companyId || decision.resolution !== "approved_for_next_cycle") fail("STRATEGY_ADJUSTMENT_DECISION_BINDING_SCOPE_INVALID", "Decision cannot be bound to this cycle");
    const existing = facts.bindings.map(validateBinding).find((item) => item.decisionRef.id === decision.id);
    if (existing) {
      if (existing.cycleId !== cycleId) fail("STRATEGY_ADJUSTMENT_DECISION_ALREADY_BOUND", "Decision is already bound to another cycle");
      continue;
    }
    const base = {
      schemaVersion: "1.0",
      contract: "StrategyAdjustmentCycleBinding@1.0",
      id: `strategy_adjustment_binding_${hash({ decisionRef, cycleId }).slice(0, 20)}`,
      companyId,
      decisionRef: clone(decisionRef),
      cycleId,
      boundAt,
      claims: { activeStrategyMutated: false, exactDecisionBound: true }
    };
    const binding = { ...base, bindingHash: hash(base) };
    validateBinding(binding);
    facts.bindings.push(binding);
    created.push(clone(binding));
  }
  return created;
}
