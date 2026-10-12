import { randomUUID } from "node:crypto";
export { adaptPublishingCyclePlanToRollingContentPlan } from "./publishing-cycle-plan.mjs";

const WINDOWS = new Set([7, 14, 30]);
const FUNCTIONS = new Set(["discovery", "authority", "proof", "solution", "action"]);

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

function now() {
  return new Date().toISOString();
}

function addDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function ensureOperatingPlans(store) {
  store.rollingContentPlans ||= [];
  store.contentOpportunities ||= [];
  return store;
}

export function resolvePlanningAccounts({ accounts = [], strategySnapshot = null, requestedIds = [] } = {}) {
  const eligible=list(accounts).filter((item)=>["xiaohongshu","wechat"].includes(item.platform)&&item.status!=="archived");
  const requested=new Set(list(requestedIds));
  const document=strategySnapshot?.document || strategySnapshot?.payload || strategySnapshot || {};
  const portfolio=document?.strategyExtensions?.accountPortfolio || {};
  const strategies=list(document?.strategyExtensions?.accountGrowthStrategies);
  const selected=list(portfolio.selectedSocialAccountIds || portfolio.selectedAccountIds);
  if(!selected.length&&!strategies.length)return eligible.filter((item)=>!requested.size||requested.has(item.id));
  const activeIds=new Set(selected.length?selected:strategies.map((item)=>item.socialAccountId));
  if(portfolio.mode==="single_account"){
    const primary=portfolio.primarySocialAccountId || [...activeIds][0] || null;
    activeIds.clear();
    if(primary)activeIds.add(primary);
  }
  return eligible.filter((item)=>activeIds.has(item.id)&&(!requested.size||requested.has(item.id)));
}

export function validateRollingContentPlan(plan) {
  const errors = [];
  if (plan?.schemaVersion !== "1.0") errors.push({ path: "schemaVersion", message: "must equal 1.0" });
  for (const key of ["id", "workspaceId", "companyId", "strategySnapshotId", "startsAt", "endsAt"]) {
    if (!plan?.[key]) errors.push({ path: key, message: "is required" });
  }
  if (!WINDOWS.has(Number(plan?.windowDays))) errors.push({ path: "windowDays", message: "must be 7, 14, or 30" });
  if (!Array.isArray(plan?.items)) errors.push({ path: "items", message: "must be an array" });
  for (const [index, item] of list(plan?.items).entries()) {
    if (!item.id) errors.push({ path: `items[${index}].id`, message: "is required" });
    if (!item.socialAccountId) errors.push({ path: `items[${index}].socialAccountId`, message: "is required" });
    if (!item.platform) errors.push({ path: `items[${index}].platform`, message: "is required" });
    if (!FUNCTIONS.has(item.contentFunction)) errors.push({ path: `items[${index}].contentFunction`, message: "is invalid" });
    for(const key of ["strategySnapshotId","strategyVersion","growthPlaybookId","playbookVersion","experimentId"]){
      if(item[key]===null||item[key]===undefined||item[key]==="")errors.push({path:`items[${index}].${key}`,message:"is required for run traceability"});
    }
  }
  return { name: "RollingContentPlan", version: "1.0", valid: errors.length === 0, errors };
}

export function createRollingContentPlan({ ownership, strategySnapshot, windowDays = 7, accountPlans = [], objective = null, experiment = null }) {
  const days = WINDOWS.has(Number(windowDays)) ? Number(windowDays) : 7;
  const createdAt = now();
  const items = accountPlans.flatMap(({ account, plan }) => list(plan?.recommendations).map((recommendation, index) => {
    const missingRequiredSources = list(recommendation.sourcePlan?.sources).filter((source) => source.required && !list(source.candidateIds).length);
    return ({
    id: `plan_item_${randomUUID().slice(0, 8)}`,
    socialAccountId: account.id,
    accountName:account.name || account.id,
    platform: account.platform,
    strategySnapshotId: strategySnapshot.id,
    strategyVersion:Number(strategySnapshot.version||1),
    effectiveStrategyId: plan.strategyContext?.effectiveStrategyId || plan.effectiveStrategyId || null,
    accountStrategySnapshotId:plan.strategyContext?.strategyResolution?.accountStrategySnapshotId||null,
    accountStrategyVersion:plan.strategyContext?.strategyResolution?.accountStrategyVersion||plan.strategyContext?.growthStrategy?.strategyVersion||1,
    directionCardId: recommendation.contentDirectionCard?.id || null,
    recommendationId: recommendation.id,
    sequence: index + 1,
    scheduledFor: addDays(createdAt, Math.min(days - 1, Math.floor((index + 1) * days / (Math.max(list(plan?.recommendations).length, 1) + 1)))).slice(0, 10),
    priority: index === 0 ? "high" : "normal",
    status: missingRequiredSources.length ? "blocked" : "planned",
    blockers: missingRequiredSources.map((source) => ({ code: "REQUIRED_SOURCE_MISSING", sourceType: source.type, message: `缺少必需来源：${source.type}` })),
    contentFunction: recommendation.contentFunction,
    contentPurposeId: recommendation.generationPayload?.contentPurposeId || recommendation.suggestedPurposeId,
    creativeMechanism: recommendation.creativeMechanism || (recommendation.format === "case" ? "proof_story" : recommendation.format === "checklist" ? "checklist_tutorial" : "problem_solution"),
    journeyStage: recommendation.contentFunction === "action" ? "conversion" : ["proof", "solution"].includes(recommendation.contentFunction) ? "consideration" : "awareness",
    accountIdentity: structuredClone(plan.strategyContext?.growthStrategy?.accountIdentity || plan.strategyContext?.accountPolicy || {}),
    matrixRole: plan.strategyContext?.growthStrategy?.matrixRole || plan.strategyContext?.accountPolicy?.matrixRole || null,
    growthMode: recommendation.growthMode || plan.strategyContext?.growthMode || "steady_vertical",
    growthPlaybookId: recommendation.growthPlaybookId || plan.strategyContext?.growthStrategy?.selectedPlaybookId || plan.strategyContext?.accountPolicy?.growthPlaybook || "legacy-steady-vertical",
    playbookVersion:plan.strategyContext?.growthStrategy?.playbookVersion || plan.strategyContext?.accountPolicy?.playbookVersion || "1.0",
    hotspotPolicy: structuredClone(plan.strategyContext?.hotspotPolicy || {}),
    validationHypothesis: recommendation.validationHypothesis || plan.strategyContext?.activeExperimentPlan?.hypothesis || null,
    tacticalActionIds: list(recommendation.contentDirectionCard?.tacticalLearningPack?.actions).map((item) => item.actionId),
    observationWindowDays: Number(plan.strategyContext?.activeExperimentPlan?.windowDays || days),
    exitConditions: list(plan.strategyContext?.activeExperimentPlan?.exitConditions),
    experimentId:plan.strategyContext?.activeExperimentPlan?.id || `experiment_${account.id}_${strategySnapshot.version||1}`,
    topic: recommendation.topic,
    contentPillar: recommendation.contentPillar,
    sourceMode: recommendation.sourcePlan?.mode || "auto",
    rationale: recommendation.reason || "",
    recommendation: structuredClone(recommendation),
    contentRunId: null
  }); }));
  const plan = {
    kind: "RollingContentPlan",
    schemaVersion: "1.0",
    id: `rolling_plan_${randomUUID().slice(0, 8)}`,
    workspaceId: ownership.workspaceId,
    companyId: ownership.companyId,
    matrixId: ownership.company?.matrixId || null,
    strategySnapshotId: strategySnapshot.id,
    strategyVersion: strategySnapshot.version,
    accountPortfolio: structuredClone(strategySnapshot.document?.strategyExtensions?.accountPortfolio || strategySnapshot.payload?.strategyExtensions?.accountPortfolio || {}),
    selectedGrowthPlaybooks: structuredClone(strategySnapshot.document?.strategyExtensions?.selectedGrowthPlaybooks || strategySnapshot.payload?.strategyExtensions?.selectedGrowthPlaybooks || []),
    traceabilityVersion:"1.0",
    windowDays: days,
    objective: objective || "在当前策略边界内平衡触达、信任、证明、方案与行动",
    experiment: experiment ? {
      id: `experiment_${randomUUID().slice(0, 8)}`,
      schemaVersion: "1.0",
      hypothesis: experiment.hypothesis || "",
      primaryMetric: experiment.primaryMetric || null,
      observationWindowDays: Number(experiment.observationWindowDays || days),
      exitConditions: list(experiment.exitConditions),
      status: "planned"
    } : null,
    status: "active",
    startsAt: createdAt,
    endsAt: addDays(createdAt, days),
    items,
    createdAt,
    updatedAt: createdAt
  };
  const validation = validateRollingContentPlan(plan);
  if (!validation.valid) {
    const error = new Error(`RollingContentPlan validation failed: ${validation.errors.map((item) => `${item.path} ${item.message}`).join("; ")}`);
    error.details = validation.errors;
    throw error;
  }
  return plan;
}

export function saveRollingContentPlan(store, plan) {
  ensureOperatingPlans(store);
  for (const item of store.rollingContentPlans) {
    if (item.companyId === plan.companyId && item.status === "active") item.status = "superseded";
  }
  store.rollingContentPlans.push(plan);
  return plan;
}

export function listRollingContentPlans(store, { companyId = null, socialAccountId = null, status = null } = {}) {
  ensureOperatingPlans(store);
  return store.rollingContentPlans.filter((plan) => (!companyId || plan.companyId === companyId) && (!status || plan.status === status) && (!socialAccountId || plan.items.some((item) => item.socialAccountId === socialAccountId)));
}

export function markPlanItemStarted(store, { planId, itemId, contentRunId }) {
  ensureOperatingPlans(store);
  const plan = store.rollingContentPlans.find((item) => item.id === planId);
  const item = plan?.items?.find((candidate) => candidate.id === itemId);
  if (!plan || !item) throw new Error("滚动计划任务不存在");
  item.status = "in_progress";
  item.contentRunId = contentRunId;
  item.startedAt = now();
  plan.updatedAt = now();
  return item;
}

export function createContentOpportunity(store, { ownership, platform, sourceType = "user_brief", sourceId = null, topic, angle = null, contentPurposeId = null, preferredSourceMode = "auto", metadata = {} }) {
  ensureOperatingPlans(store);
  if (!ownership?.companyId || !ownership?.socialAccountId || !platform || !String(topic || "").trim()) throw new Error("内容机会必须绑定公司、社媒账号、平台和主题");
  const opportunity = {
    kind: "ContentOpportunity",
    schemaVersion: "1.0",
    id: `opportunity_${randomUUID().slice(0, 8)}`,
    workspaceId: ownership.workspaceId,
    companyId: ownership.companyId,
    socialAccountId: ownership.socialAccountId,
    platform,
    sourceType,
    sourceId,
    topic: String(topic).trim(),
    angle,
    contentPurposeId,
    preferredSourceMode,
    metadata: structuredClone(metadata),
    status: "ready",
    contentRunId: null,
    createdAt: now(),
    updatedAt: now()
  };
  store.contentOpportunities.push(opportunity);
  return opportunity;
}

export function listContentOpportunities(store, { companyId = null, socialAccountId = null, sourceType = null, status = null } = {}) {
  ensureOperatingPlans(store);
  return store.contentOpportunities.filter((item) => (!companyId || item.companyId === companyId) && (!socialAccountId || item.socialAccountId === socialAccountId) && (!sourceType || item.sourceType === sourceType) && (!status || item.status === status));
}

export function markOpportunityStarted(store, opportunityId, contentRunId) {
  ensureOperatingPlans(store);
  const opportunity = store.contentOpportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw new Error("内容机会不存在");
  if (opportunity.contentRunId && opportunity.contentRunId !== contentRunId) {
    const error = new Error("该内容机会已经绑定唯一 ContentRun");
    error.code = "CONTENT_OPPORTUNITY_RUN_EXISTS";
    error.contentRunId = opportunity.contentRunId;
    throw error;
  }
  opportunity.status = "in_progress";
  opportunity.contentRunId = contentRunId;
  opportunity.updatedAt = now();
  return opportunity;
}
