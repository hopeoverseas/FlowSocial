import { createHash, randomUUID } from "node:crypto";

const list = (value) => Array.isArray(value) ? value : [];

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function median(values) {
  const usable = values.map(finite).filter((value) => value !== null).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : Number(((usable[middle - 1] + usable[middle]) / 2).toFixed(6));
}

function metricMap(outcome) {
  const derived = outcome.metrics?.derived || {};
  const platform = outcome.metrics?.platformMetrics || {};
  const known = outcome.metrics?.known || {};
  return {
    coverClickRate: finite(derived.coverClickRate),
    openRate: finite(derived.openRate ?? platform.readDeliveryRate),
    completionRate: finite(derived.completionRate ?? platform.readFinishRate ?? platform.completionRate),
    saveRate: finite(derived.saveRate),
    commentRate: finite(derived.commentRate),
    engagementRate: finite(derived.engagementRate),
    profileVisitRate: finite(derived.profileVisitRate),
    followRate: finite(derived.followRate),
    leadRate: finite(derived.leadRate),
    qualifiedLeadRate: finite(derived.qualifiedLeadRate),
    conversionRate: finite(derived.conversionRate),
    views: finite(known.views),
    impressions: finite(known.impressions)
  };
}

const FUNNELS = {
  xiaohongshu: [
    { stage: "distribution_to_click", metrics: ["coverClickRate"], variable: "title_cover_value_proposition", hypothesis: "标题或封面没有清楚表达目标用户的收益", alternatives: ["平台分发人群发生变化", "发布时间或热点竞争影响初始点击"] },
    { stage: "click_to_consume", metrics: ["completionRate"], variable: "opening_and_structure", hypothesis: "标题承诺与开头、结构或内容密度没有形成连续承接", alternatives: ["内容长度与当前形式不匹配", "流量来源带来的用户意图不同"] },
    { stage: "consume_to_value", metrics: ["saveRate", "commentRate", "engagementRate"], variable: "practical_value_or_interaction", hypothesis: "内容可读，但缺少可收藏、可讨论或可转述的明确价值", alternatives: ["内容目的本身不以互动为主", "样本受热点情绪影响"] },
    { stage: "value_to_relationship", metrics: ["profileVisitRate", "followRate"], variable: "series_promise_and_account_value", hypothesis: "单篇有价值，但账号长期关注理由不清晰", alternatives: ["主页承接尚未完善", "分发人群并非目标受众"] },
    { stage: "relationship_to_business", metrics: ["leadRate", "qualifiedLeadRate", "conversionRate"], variable: "cta_and_conversion_handoff", hypothesis: "内容与业务承接之间存在断点", alternatives: ["线索回填不完整", "当前内容职能不承担直接转化"] }
  ],
  wechat: [
    { stage: "delivery_to_open", metrics: ["openRate"], variable: "title_value_proposition", hypothesis: "标题没有向存量读者清楚表达阅读收益", alternatives: ["推送位置或送达规模变化", "节假日和推送时段影响打开"] },
    { stage: "open_to_consume", metrics: ["completionRate"], variable: "opening_length_and_structure", hypothesis: "开头、长度或论证结构增加了阅读成本", alternatives: ["推荐流与公众号消息的读者意图不同", "文章题材天然需要更长决策时间"] },
    { stage: "consume_to_value", metrics: ["engagementRate"], variable: "information_gain_and_share_trigger", hypothesis: "文章完成了表达，但缺少值得分享或参与的增量", alternatives: ["读者倾向私下转发而非公开互动", "该内容目的以教育而非互动为主"] },
    { stage: "value_to_relationship", metrics: ["followRate"], variable: "column_and_follow_reason", hypothesis: "文章价值没有转化为持续阅读或关注理由", alternatives: ["文后关注数据缺失", "账号已覆盖大部分存量读者"] },
    { stage: "relationship_to_business", metrics: ["leadRate", "qualifiedLeadRate", "conversionRate"], variable: "menu_keyword_or_contact_handoff", hypothesis: "菜单、关键词、企微或表单承接不连续", alternatives: ["业务结果尚未回填", "当前文章不是转化职能内容"] }
  ]
};

function sameValue(left, right) {
  return (left ?? null) === (right ?? null);
}

function selectBaseline(outcome, outcomes) {
  const attribution = outcome.attribution || {};
  const candidates = outcomes.filter((item) => item.publicationId !== outcome.publicationId && item.metrics && item.platform === outcome.platform && item.measurementWindow === outcome.measurementWindow && (item.attribution?.socialAccountId || item.accountId) === (attribution.socialAccountId || outcome.accountId));
  const levels = [
    { id: "same_effective_strategy_function_pillar_format", matches: (item) => sameValue(item.attribution?.effectiveStrategyId, attribution.effectiveStrategyId) && sameValue(item.attribution?.contentFunction, attribution.contentFunction) && sameValue(item.attribution?.contentPillarId, attribution.contentPillarId) && sameValue(item.attribution?.publishingVariables?.format, attribution.publishingVariables?.format) },
    { id: "same_growth_playbook_function", matches: (item) => sameValue(item.attribution?.growthPlaybookId, attribution.growthPlaybookId) && sameValue(item.attribution?.contentFunction, attribution.contentFunction) },
    { id: "same_account_function", matches: (item) => sameValue(item.attribution?.contentFunction, attribution.contentFunction) },
    { id: "same_account_platform_window", matches: () => true }
  ];
  for (const level of levels) {
    const matched = candidates.filter(level.matches);
    if (matched.length >= 2) return { level: level.id, outcomes: matched };
  }
  return { level: "insufficient", outcomes: candidates };
}

function baselineMetrics(items) {
  const maps = items.map(metricMap);
  const keys = [...new Set(maps.flatMap((item) => Object.keys(item)))];
  return Object.fromEntries(keys.map((key) => [key, median(maps.map((item) => item[key]))]));
}

function diagnoseOutcome(outcome, outcomes) {
  const baseline = selectBaseline(outcome, outcomes);
  const current = metricMap(outcome);
  const baselineValues = baselineMetrics(baseline.outcomes);
  const funnel = FUNNELS[outcome.platform] || [];
  let finding = null;
  for (const stage of funnel) {
    const comparisons = stage.metrics.map((metric) => ({ metric, current: current[metric], baseline: baselineValues[metric] })).filter((item) => item.current !== null && item.baseline !== null && item.baseline > 0);
    const weak = comparisons.sort((a, b) => (a.current / a.baseline) - (b.current / b.baseline))[0];
    if (weak && weak.current / weak.baseline < 0.75) { finding = { stage, metric: weak }; break; }
  }
  const evidenceRefs = [outcome.publicationId, ...(baseline.outcomes || []).map((item) => item.publicationId)].filter(Boolean);
  const comparableSampleSize = baseline.outcomes.length;
  const confidence = comparableSampleSize >= 5 ? "medium" : "low";
  return {
    id: `diagnosis_${shortHash(`${outcome.publicationId}:${outcome.measurementWindow}:${outcome.latestPerformanceSnapshotId}`)}`,
    kind: "FunnelDiagnosis",
    schemaVersion: "1.0",
    publicationId: outcome.publicationId,
    contentRunId: outcome.contentRunId,
    accountId: outcome.accountId,
    platform: outcome.platform,
    measurementWindow: outcome.measurementWindow,
    status: finding ? "actionable_observation" : comparableSampleSize >= 2 ? "no_material_bottleneck" : "insufficient_baseline",
    funnelStage: finding?.stage.stage || null,
    observation: finding ? `${finding.metric.metric} 为 ${finding.metric.current}，低于当前同类基线 ${finding.metric.baseline}` : comparableSampleSize >= 2 ? "当前可用指标未发现相对同类基线的明显漏斗短板" : "同账号可比样本不足，暂不形成优化结论",
    baseline: { cohort: baseline.level, sampleSize: comparableSampleSize, metrics: baselineValues },
    primaryHypothesis: finding?.stage.hypothesis || null,
    alternativeExplanations: finding?.stage.alternatives || [],
    evidenceRefs,
    confidence,
    nextAction: finding ? {
      owner: "content_agent",
      changeVariable: finding.stage.variable,
      keepConstant: ["content_function", "content_pillar", "platform", "measurement_window"],
      targetMetric: finding.metric.metric,
      validationDue: "next_3_comparable_posts"
    } : null,
    strategyChangeAllowed: false,
    interpretationBoundary: "Relative account-level observation only; not a causal conclusion."
  };
}

export function buildFunnelDiagnoses(outcomes = []) {
  return outcomes.filter((item) => item.metrics && ["72h", "7d", "final"].includes(item.measurementWindow)).map((outcome) => diagnoseOutcome(outcome, outcomes));
}

function cycleBucket(iso, days = 14) {
  const time = new Date(iso || 0).getTime();
  return Number.isFinite(time) ? Math.floor(time / (days * 86_400_000)) : null;
}

export function buildCycleReviews(outcomes = [], diagnoses = []) {
  const groups = new Map();
  for (const outcome of outcomes.filter((item) => item.metrics && ["7d", "final"].includes(item.measurementWindow))) {
    const attribution = outcome.attribution || {};
    const key = [attribution.socialAccountId || outcome.accountId, attribution.effectiveStrategyId || attribution.strategySnapshotId || "unbound", attribution.growthPlaybookId || "unbound"].join("::");
    const group = groups.get(key) || { key, outcomes: [], attribution };
    group.outcomes.push(outcome);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const publicationIds = new Set(group.outcomes.map((item) => item.publicationId));
    const groupDiagnoses = diagnoses.filter((item) => publicationIds.has(item.publicationId));
    const bottlenecks = Object.entries(groupDiagnoses.filter((item) => item.funnelStage).reduce((acc, item) => { acc[item.funnelStage] = (acc[item.funnelStage] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
    const cycles = new Set(group.outcomes.map((item) => cycleBucket(item.publishedAt)).filter((item) => item !== null));
    const businessObserved = group.outcomes.filter((item) => Object.keys(item.metrics?.businessOutcome || {}).length).length;
    const sampleSize = group.outcomes.length;
    const repeatedPattern = bottlenecks[0]?.[1] >= 3;
    const eligible = sampleSize >= 5 && cycles.size >= 2 && businessObserved >= 2 && repeatedPattern;
    return {
      id: `cycle_review_${shortHash(group.key)}`,
      kind: "CycleReview",
      schemaVersion: "1.0",
      socialAccountId: group.attribution.socialAccountId || group.outcomes[0]?.accountId,
      companyId: group.attribution.companyId || null,
      effectiveStrategyId: group.attribution.effectiveStrategyId || null,
      growthPlaybookId: group.attribution.growthPlaybookId || null,
      sampleSize,
      cycleCount: cycles.size,
      businessObservedCount: businessObserved,
      repeatedBottlenecks: bottlenecks.map(([stage, count]) => ({ stage, count })),
      keep: groupDiagnoses.filter((item) => item.status === "no_material_bottleneck").map((item) => item.publicationId),
      improve: groupDiagnoses.filter((item) => item.status === "actionable_observation").map((item) => item.publicationId),
      eligibleForStrategyReview: eligible,
      confidence: eligible ? "high" : repeatedPattern ? "medium" : "low",
      evidenceRefs: group.outcomes.flatMap((item) => item.evidenceRefs || []),
      interpretation: eligible ? "跨周期可比样本、重复模式和业务结果已达到策略复核候选门槛。" : "证据仅用于下一轮内容和实验规划，暂不上行修改策略。"
    };
  });
}

export function buildStrategyReviewCandidates(cycleReviews = []) {
  return cycleReviews.filter((item) => item.eligibleForStrategyReview).map((review) => ({
    id: `strategy_candidate_${shortHash(review.id)}`,
    kind: "StrategyReviewCandidate",
    schemaVersion: "1.0",
    status: "candidate_read_only",
    companyId: review.companyId,
    socialAccountId: review.socialAccountId,
    currentEffectiveStrategyId: review.effectiveStrategyId,
    growthPlaybookId: review.growthPlaybookId,
    proposedScope: "account_strategy_review",
    proposedChange: { fieldPath: "to_be_resolved_by_strategy_agent", operation: "review", value: null },
    rationale: review.interpretation,
    repeatedBottlenecks: review.repeatedBottlenecks,
    evidenceRefs: review.evidenceRefs,
    sampleSize: review.sampleSize,
    cycleCount: review.cycleCount,
    businessObservedCount: review.businessObservedCount,
    confidence: review.confidence,
    autoApply: false,
    mayMutateActiveStrategy: false,
    requiresStrategyAgentReview: true,
    requiresUserConfirmation: true
  }));
}

export function ensureFeedbackActions(store) {
  store.feedbackActions ||= [];
  return store.feedbackActions;
}

export function buildTacticalLearningPack(store, { accountId, platform } = {}) {
  const actions = ensureFeedbackActions(store).filter((item) =>
    ["accepted", "injected_into_plan", "running", "supported"].includes(item.status)
    && (!accountId || item.accountId === accountId)
    && (!platform || item.platform === platform)
  );
  return {
    kind: "TacticalLearningPack",
    schemaVersion: "1.0",
    accountId,
    platform,
    mode: "account_scoped_reversible",
    actions: actions.map((item) => ({
      actionId: item.id,
      accountId: item.accountId,
      platform: item.platform,
      status: item.status,
      sourceBottleneck: item.sourceBottleneck || item.funnelStage || null,
      changeVariable: item.changeVariable,
      keepConstant: item.keepConstant,
      targetMetric: item.targetMetric,
      appliesTo: item.appliesTo,
      validationDue: item.validationDue
    })),
    mayOverrideFacts: false,
    mayOverrideRiskPolicy: false,
    mayMutateStrategy: false
  };
}

export function acceptFeedbackAction(store, diagnosis, { acceptedBy = "user", appliesTo = {}, note = "" } = {}) {
  if (!diagnosis?.nextAction) throw Object.assign(new Error("diagnosis has no actionable recommendation"), { statusCode: 409 });
  const existing = ensureFeedbackActions(store).find((item) => item.diagnosisId === diagnosis.id && !["rejected", "insufficient"].includes(item.status));
  if (existing) return existing;
  const action = {
    id: `feedback_action_${randomUUID().slice(0, 8)}`,
    kind: "OptimizationAction",
    schemaVersion: "1.0",
    diagnosisId: diagnosis.id,
    publicationId: diagnosis.publicationId,
    sourceContentRunId: diagnosis.contentRunId,
    accountId: diagnosis.accountId,
    platform: diagnosis.platform,
    measurementWindow: diagnosis.measurementWindow,
    status: "accepted",
    ...diagnosis.nextAction,
    appliesTo,
    note,
    acceptedBy,
    acceptedAt: new Date().toISOString(),
    nextContentRunId: null,
    validation: null
  };
  ensureFeedbackActions(store).push(action);
  return action;
}

export function createFeedbackFollowupRun(store, action, sourceRun) {
  void store; void action; void sourceRun;
  throw Object.assign(new Error("反馈动作不能克隆旧选题或旧正文；请通过下一周期内容组合生成全新选题"), {
    statusCode: 410,
    code: "FEEDBACK_FOLLOWUP_CLONE_RETIRED"
  });
}

export function updateFeedbackAction(store, actionId, { status, validation = null, note = null, nextCycleId = null, nextSlotIds = null } = {}) {
  const allowed = new Set(["accepted", "injected_into_plan", "running", "supported", "partially_supported", "rejected", "insufficient"]);
  if (!allowed.has(status)) throw Object.assign(new Error("invalid feedback action status"), { statusCode: 400 });
  const action = ensureFeedbackActions(store).find((item) => item.id === actionId);
  if (!action) throw Object.assign(new Error("feedback action not found"), { statusCode: 404 });
  action.status = status;
  if (validation) action.validation = { ...validation, evaluatedAt: new Date().toISOString() };
  if (note !== null) action.note = note;
  if (nextCycleId !== null) action.nextCycleId = nextCycleId;
  if (nextSlotIds !== null) action.nextSlotIds = [...nextSlotIds];
  action.updatedAt = new Date().toISOString();
  return action;
}

export function bindFeedbackActionsToCycle(store, plan) {
  const actionIds = new Set((plan?.nextCycleContentPortfolios || []).map((item) => item?.repairSignal?.feedbackActionRef?.id).filter(Boolean));
  return ensureFeedbackActions(store).filter((item) => actionIds.has(item.id)).map((action) => updateFeedbackAction(store, action.id, {
    status: "injected_into_plan",
    nextCycleId: plan.cycleId,
    nextSlotIds: (plan.slots || []).filter((slot) => slot.zone !== "buffer" && slot.contentLearningInstruction?.experiment?.feedbackActionRef?.id === action.id).map((slot) => slot.slotId)
  }));
}
