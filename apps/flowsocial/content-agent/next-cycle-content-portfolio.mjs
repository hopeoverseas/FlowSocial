import { createHash } from "node:crypto";

const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => structuredClone(value);
const BOTTLENECK_EXPERIMENTS = Object.freeze({
  distribution_to_click: { changeVariable: "title_cover_value_proposition", targetMetric: "coverClickRate" },
  delivery_to_open: { changeVariable: "title_value_proposition", targetMetric: "openRate" },
  click_to_consume: { changeVariable: "opening_and_structure", targetMetric: "completionRate" },
  open_to_consume: { changeVariable: "opening_length_and_structure", targetMetric: "completionRate" },
  consume_to_value: { changeVariable: "practical_value_or_interaction", targetMetric: "engagementRate" },
  value_to_relationship: { changeVariable: "series_promise_and_account_value", targetMetric: "followRate" },
  relationship_to_business: { changeVariable: "cta_and_conversion_handoff", targetMetric: "qualifiedLeadRate" }
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function cohortKey(outcome = {}) {
  const attribution = outcome.attribution || {};
  return [attribution.contentPillarId || "unassigned", attribution.contentFunction || "unassigned"].join("::");
}

function outcomeScore(outcome = {}) {
  const derived = outcome.metrics?.derived || {};
  const values = ["coverClickRate", "openRate", "completionRate", "engagementRate", "saveRate", "followRate", "qualifiedLeadRate"]
    .map((key) => finite(derived[key]))
    .filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function strongestCohort(outcomes = []) {
  const groups = new Map();
  for (const outcome of outcomes.filter((item) => item.metrics && item.dataQuality?.eligibleForContentDiagnosis)) {
    const key = cohortKey(outcome);
    const group = groups.get(key) || { key, outcomes: [], scores: [] };
    group.outcomes.push(outcome);
    const score = outcomeScore(outcome);
    if (score !== null) group.scores.push(score);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((item) => item.outcomes.length >= 2 && item.scores.length)
    .map((item) => {
      const [contentPillarId, contentFunction] = item.key.split("::");
      return {
        contentPillarId: contentPillarId === "unassigned" ? null : contentPillarId,
        contentFunction: contentFunction === "unassigned" ? null : contentFunction,
        sampleSize: item.outcomes.length,
        directionalScore: Number((item.scores.reduce((sum, value) => sum + value, 0) / item.scores.length).toFixed(6)),
        evidenceRefs: item.outcomes.flatMap((outcome) => outcome.evidenceRefs || [])
      };
    })
    .sort((left, right) => right.directionalScore - left.directionalScore || right.sampleSize - left.sampleSize)[0] || null;
}

function leadingBottleneck(feedbackWorkspace = {}) {
  return list(feedbackWorkspace.cycleReviews)
    .flatMap((review) => list(review.repeatedBottlenecks).map((item) => ({ ...item, review })))
    .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))[0] || null;
}

function median(values) {
  const usable = values.map(finite).filter((value) => value !== null).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}

function diagnosisBaseline(feedbackWorkspace, stage, metric) {
  const diagnoses = list(feedbackWorkspace.diagnoses).filter((item) => item.funnelStage === stage);
  return {
    metric,
    value: median(diagnoses.map((item) => item.baseline?.metrics?.[metric])),
    diagnosisRefs: diagnoses.map((item) => item.id)
  };
}

function approvedExperiment(strategyAdjustmentWorkspace = {}, socialAccountId, activeStrategySnapshotId) {
  return list(strategyAdjustmentWorkspace.decisions)
    .filter((decision) => decision.socialAccountId === socialAccountId && decision.resolution === "approved_for_next_cycle")
    .filter((decision) => !activeStrategySnapshotId || decision.currentActiveStrategySnapshotId === activeStrategySnapshotId)
    .filter((decision) => !list(strategyAdjustmentWorkspace.bindings).some((binding) => binding.decisionRef?.id === decision.id))
    .map((decision) => ({ decisionRef: { id: decision.id, hash: decision.factHash }, experiment: clone(decision.approvedExperiment) }))[0] || null;
}

function allocateLanes(itemCount, { repairAvailable, evidenceSufficient }) {
  const count = Math.max(1, Math.min(12, Number(itemCount) || 3));
  const weights = repairAvailable
    ? { sustain: 0.6, repair: 0.3, explore: 0.1 }
    : evidenceSufficient ? { sustain: 0.8, repair: 0, explore: 0.2 } : { sustain: 0.8, repair: 0, explore: 0.2 };
  const entries = Object.entries(weights).map(([lane, weight]) => ({ lane, weight, exact: count * weight, count: Math.floor(count * weight) }));
  let remaining = count - entries.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...entries].sort((left, right) => (right.exact - right.count) - (left.exact - left.count) || right.weight - left.weight)) {
    if (!remaining) break;
    item.count += 1;
    remaining -= 1;
  }
  const byLane = Object.fromEntries(entries.map((item) => [item.lane, item.count]));
  if (repairAvailable && count >= 2 && byLane.repair === 0) {
    byLane.repair = 1;
    byLane.sustain = Math.max(0, byLane.sustain - 1);
  }
  if (evidenceSufficient && count >= 5 && byLane.explore === 0) {
    byLane.explore = 1;
    byLane.sustain = Math.max(0, byLane.sustain - 1);
  }
  const sequence = [];
  const remainingByLane = { ...byLane };
  while (sequence.length < count) {
    for (const lane of ["sustain", "repair", "sustain", "explore"]) {
      if (remainingByLane[lane] > 0) {
        sequence.push(lane);
        remainingByLane[lane] -= 1;
      }
      if (sequence.length === count) break;
    }
  }
  return { targetWeights: weights, counts: byLane, sequence };
}

export function buildNextCycleContentPortfolio({
  feedbackWorkspace = {},
  historyIndex = {},
  strategyAdjustmentWorkspace = {},
  tacticalLearningPack = {},
  companyId = null,
  socialAccountId = null,
  platform = null,
  activeStrategySnapshotId = null,
  itemCount = 3,
  publishingCyclePlans = []
} = {}) {
  const outcomes = list(feedbackWorkspace.outcomes).filter((item) => !socialAccountId || item.attribution?.socialAccountId === socialAccountId || item.accountId === socialAccountId);
  const matureOutcomes = outcomes.filter((item) => item.metrics && item.dataQuality?.eligibleForCycleEvidence);
  const winner = strongestCohort(outcomes);
  const bottleneck = leadingBottleneck(feedbackWorkspace);
  const approved = approvedExperiment(strategyAdjustmentWorkspace, socialAccountId, activeStrategySnapshotId);
  const acceptedAction = list(tacticalLearningPack.actions)
    .filter((item) => !socialAccountId || !item.accountId || item.accountId === socialAccountId)
    .filter((item) => !platform || !item.platform || item.platform === platform)
    // An action is consumed by exactly one future plan. Once bound, its
    // execution can still be tracked by the learning pack, but it must not be
    // selected again as the repair variable for another cycle.
    .find((item) => item.status === "accepted") || null;
  const inferredExperiment = BOTTLENECK_EXPERIMENTS[bottleneck?.stage] || null;
  // A repeated bottleneck can shape the reversible content mix. Explicitly
  // accepted actions and approved strategy experiments add exact traceability;
  // none of these paths can mutate the active strategy.
  const repairAvailable = Boolean(acceptedAction || approved?.experiment || bottleneck?.stage);
  const evidenceSufficient = matureOutcomes.length >= 3;
  const allocation = allocateLanes(itemCount, { repairAvailable, evidenceSufficient });
  const historyRefs = list(historyIndex.items).map((item) => item.historyItemId || item.id).filter(Boolean);
  const evidenceRefs = [...new Set([
    ...matureOutcomes.flatMap((item) => item.evidenceRefs || []),
    ...(winner?.evidenceRefs || []),
    ...(approved?.decisionRef?.id ? [approved.decisionRef.id] : []),
    ...(acceptedAction?.actionId ? [acceptedAction.actionId] : [])
  ])];
  const base = {
    schemaVersion: "1.0",
    contract: "NextCycleContentPortfolio@1.0",
    mode: "read_only_projection",
    companyId,
    socialAccountId,
    platform,
    activeStrategySnapshotId,
    evidenceWindow: {
      maturePublicationCount: matureOutcomes.length,
      cycleCount: Math.max(0, ...list(feedbackWorkspace.cycleReviews).map((item) => Number(item.cycleCount || 0))),
      historyItemCount: historyRefs.length,
      confidence: evidenceSufficient ? "directional" : "insufficient"
    },
    allocation,
    sustainSignal: winner ? {
      ...winner,
      interpretation: "只延续表现较好的内容支柱与内容职能，不复用历史选题或正文。"
    } : null,
    repairSignal: repairAvailable ? {
      sourceBottleneck: approved?.experiment?.sourceBottleneck || acceptedAction?.sourceBottleneck || bottleneck?.stage || null,
      changeVariable: approved?.experiment?.changeVariable || acceptedAction?.changeVariable || inferredExperiment?.changeVariable || null,
      targetMetric: approved?.experiment?.targetMetric || acceptedAction?.targetMetric || inferredExperiment?.targetMetric || null,
      hypothesis: approved?.experiment?.hypothesis || null,
      strategyAdjustmentDecisionRef: approved?.decisionRef || null,
      feedbackActionRef: acceptedAction?.actionId ? { id: acceptedAction.actionId } : null,
      baseline: diagnosisBaseline(feedbackWorkspace, approved?.experiment?.sourceBottleneck || acceptedAction?.sourceBottleneck || bottleneck?.stage, approved?.experiment?.targetMetric || acceptedAction?.targetMetric || inferredExperiment?.targetMetric)
    } : null,
    exploreSignal: {
      instruction: "在活动策略边界内选择历史覆盖较少的新问题、新角度或新形式。",
      historyClusterCount: list(historyIndex.clusters).length
    },
    evidenceRefs,
    authorityBoundary: {
      activeStrategyMutationAllowed: false,
      automaticContentProductionAllowed: false,
      exactPlanUserConfirmationRequired: true,
      newTopicRequiredForEverySlot: true,
      newBodyRequiredForEverySlot: true
    }
  };
  const projectionHash = hash(base);
  const portfolio = { ...base, id: `next_cycle_portfolio_${projectionHash.slice(0, 20)}`, projectionHash };
  portfolio.priorCycleEvaluations = list(publishingCyclePlans).flatMap((plan) => {
    const priorPortfolio = list(plan.nextCycleContentPortfolios).find((item) => item.socialAccountId === socialAccountId);
    return priorPortfolio ? [evaluateCycleLearning(priorPortfolio, plan, feedbackWorkspace)] : [];
  });
  return portfolio;
}

export function buildContentLearningInstruction(portfolio, assignment = {}, candidate = {}) {
  const base = {
    schemaVersion: "1.0",
    contract: "ContentLearningInstruction@1.0",
    portfolioRef: { id: portfolio.id, hash: portfolio.projectionHash },
    lane: assignment.lane || "sustain",
    sourceEvidenceRefs: clone(portfolio.evidenceRefs || []),
    inheritedPattern: {
      contentPillarId: assignment.contentPillarId || portfolio.sustainSignal?.contentPillarId || null,
      contentFunction: assignment.contentFunction || portfolio.sustainSignal?.contentFunction || null
    },
    experiment: assignment.lane === "repair" ? clone(portfolio.repairSignal) : null,
    novelty: {
      newTopicRequired: true,
      newBodyRequired: true,
      candidateTopic: candidate.topic || null,
      prohibitedReuse: ["source_topic", "source_body", "source_outline"],
      requiredDelta: ["new_audience_problem_or_scenario", "new_angle", "new_evidence_or_example"]
    },
    claims: { activeStrategyMutated: false, historicalContentCloned: false }
  };
  return { ...base, instructionHash: hash(base) };
}

export function formatContentLearningObjective(baseObjective, instruction = null) {
  const objective = String(baseObjective || "完成本周期内容目标").trim();
  if (!instruction) return objective;
  const lane = { sustain: "延续有效内容模式", repair: "修复已识别漏斗问题", explore: "探索策略边界内的新方向" }[instruction.lane] || "执行本周期学习任务";
  const experiment = instruction.experiment;
  const experimentText = experiment?.changeVariable
    ? `；重点调整 ${experiment.changeVariable}${experiment.targetMetric ? `，观察 ${experiment.targetMetric}` : ""}`
    : "";
  return `${objective}；${lane}；必须使用全新选题和全新正文，不得复用历史选题、正文或大纲${experimentText}`;
}

export function rebindContentLearningInstructionTopic(instruction, topic) {
  if (!instruction) return null;
  const next = clone(instruction);
  delete next.instructionHash;
  next.novelty = { ...next.novelty, candidateTopic: String(topic || "").trim() || null };
  return { ...next, instructionHash: hash(next) };
}

export function evaluateCycleLearning(portfolio, cyclePlan, feedbackWorkspace = {}) {
  const repairSlots = list(cyclePlan?.slots).filter((slot) => slot.learningLane === "repair" && slot.zone !== "buffer");
  const slotIds = new Set(repairSlots.map((slot) => slot.slotId));
  const outcomes = list(feedbackWorkspace.outcomes).filter((outcome) => {
    const attribution = outcome.attribution || {};
    return (outcome.cycleId === cyclePlan.cycleId || attribution.cycleId === cyclePlan.cycleId)
      && slotIds.has(outcome.slotId || attribution.slotId)
      && outcome.metrics;
  });
  const metric = portfolio.repairSignal?.targetMetric || null;
  const observed = metric ? outcomes.map((item) => finite(item.metrics?.derived?.[metric])).filter((value) => value !== null) : [];
  const baseline = finite(portfolio.repairSignal?.baseline?.value);
  const current = observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : null;
  const ratio = baseline && current !== null ? current / baseline : null;
  const status = observed.length < Math.min(3, Math.max(1, repairSlots.length)) || ratio === null
    ? "insufficient"
    : ratio >= 1.1 ? "supported" : ratio >= 0.98 ? "partially_supported" : "rejected";
  const base = {
    schemaVersion: "1.0",
    contract: "CycleLearningEvaluation@1.0",
    portfolioRef: { id: portfolio.id, hash: portfolio.projectionHash },
    cycleId: cyclePlan.cycleId,
    socialAccountId: portfolio.socialAccountId,
    metric,
    baseline,
    current: current === null ? null : Number(current.toFixed(6)),
    observedSlotCount: outcomes.length,
    requiredSlotCount: repairSlots.length,
    status,
    evidenceRefs: outcomes.flatMap((item) => item.evidenceRefs || []),
    interpretationBoundary: "跨新选题的账号级方向性比较，不应表述为严格因果 A/B 结论。",
    claims: { activeStrategyMutated: false, autoStrategyActivationAllowed: false }
  };
  return { ...base, evaluationHash: hash(base) };
}
