import { normalizeFactSnapshot } from "./contracts.mjs";

import { normalizePlanningAudience } from "./planning-topic.mjs";

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function names(items) {
  return list(items).map((item) => typeof item === "string" ? item : item?.name).filter(Boolean);
}

function latestId(snapshot) {
  return snapshot.id || snapshot.strategySnapshotId || snapshot.snapshotId || null;
}

function legacyPortfolio(portfolio = {}) {
  return {
    traffic: Number(portfolio.discovery || 0),
    trust: Number(portfolio.authority || 0) + Number(portfolio.proof || 0),
    product: Number(portfolio.solution || 0),
    conversion: Number(portfolio.action || 0)
  };
}

function legacyFunctionPolicy(portfolio = {}) {
  const authority = Math.round(Number(portfolio.trust || 0) * 0.7);
  const proof = Number(portfolio.trust || 0) - authority;
  const functions = {
    discovery: Number(portfolio.traffic || 0),
    authority,
    proof,
    solution: Number(portfolio.product || 0),
    action: Number(portfolio.conversion || 0)
  };
  return {
    reviewWindowDays: 30,
    functions: Object.fromEntries(Object.entries(functions).map(([key, target]) => [key, { min: Math.max(0, target - 10), target, max: Math.min(100, target + 10), rationale: "由旧版四类内容配比兼容投影" }])),
    adjustmentRule: "旧版策略兼容模式；具体顺序由内容 Agent 按历史和用户选择决定"
  };
}

function fallbackConversionLadder(conversionSystem = {}, legacyPath = "") {
  const pathSteps = list(conversionSystem?.primaryPath?.steps).length
    ? list(conversionSystem.primaryPath.steps)
    : legacyPath ? [legacyPath] : [];
  return {
    stages: [
      { id: "engagement", label: "内容内互动", allowedActions: ["收藏", "评论", "转发", "关注"], suitableFunctions: ["discovery", "authority"] },
      { id: "content_handoff", label: "内容承接", allowedActions: ["查看系列内容", "领取清单或报告"], suitableFunctions: ["authority", "proof", "solution"] },
      { id: "lead_capture", label: "线索承接", allowedActions: [conversionSystem.entryCTA, conversionSystem.contactChannel, "咨询"].filter(Boolean), suitableFunctions: ["proof", "solution", "action"] },
      { id: "business_action", label: "业务下一步", allowedActions: [conversionSystem.diagnosticStep, conversionSystem.nextBusinessStep, conversionSystem.cooperationEntry].filter(Boolean), suitableFunctions: ["action"] }
    ],
    fullBusinessPath: pathSteps,
    selectionRule: "单篇内容只选择一个主要阶段和一个主要动作"
  };
}

function resolvedFactSnapshot(accountId, currentFacts, providedFactSnapshot) {
  const factSnapshot = providedFactSnapshot || normalizeFactSnapshot({ accountId, facts: currentFacts });
  factSnapshot.factSnapshotId ||= factSnapshot.id || `facts:${accountId}:${factSnapshot.capturedAt}`;
  return factSnapshot;
}

function projectV2(strategySnapshot, currentFacts, providedFactSnapshot) {
  const payload = strategySnapshot.document || strategySnapshot.payload || strategySnapshot;
  const strategy = payload.strategy || {};
  const business = payload.business || {};
  const objectives = list(strategy.objectives).sort((a, b) => Number(b?.weight || 0) - Number(a?.weight || 0));
  const audiences = list(strategy.audiences).sort((a, b) => Number(a?.priority || 999) - Number(b?.priority || 999));
  const pillars = list(strategy.contentSystem?.pillars);
  const contentFunctionPortfolio = strategy.contentSystem?.portfolio || { discovery: 0, authority: 0, proof: 0, solution: 0, action: 0 };
  const platformPlaybooks = strategy.platformPlaybooks || {};
  const accountId = payload.accountId || strategySnapshot.accountId || "unknown_account";
  const factSnapshot = resolvedFactSnapshot(accountId, currentFacts, providedFactSnapshot);
  const allPlaybookTones = Object.values(platformPlaybooks).flatMap((playbook) => list(playbook?.toneDefaults));
  const riskPolicy = strategy.riskPolicy || {};
  const primaryObjective = objectives.find((item) => item.id === strategy.primaryObjectiveId) || objectives[0] || {};
  const extensions = payload.strategyExtensions || {};
  const accountGrowthStrategies = list(extensions.accountGrowthStrategies);
  const currentAccountGrowth = accountGrowthStrategies.find((item) => item.socialAccountId === strategySnapshot.socialAccountId)
    || accountGrowthStrategies.find((item) => item.platform === strategySnapshot?.document?.strategy?.accountPolicy?.platform)
    || null;

  return {
    schemaVersion: "1.0",
    sourceStrategySchemaVersion: "2.0",
    strategySnapshotId: latestId(strategySnapshot),
    strategySnapshotVersion: strategySnapshot.version || null,
    factSnapshotId: factSnapshot.factSnapshotId,
    accountId,
    workspaceId:strategySnapshot.workspaceId||null,
    companyId:strategySnapshot.companyId||accountId,
    socialAccountId:strategySnapshot.socialAccountId||null,
    effectiveStrategyId:strategySnapshot.effectiveStrategyId||null,
    strategyResolution:strategySnapshot.resolution||null,
    accountStage: strategy.growthStage || "unknown",
    operatingMode: strategy.operatingMode || "assisted",
    businessModel: business.businessModel || "",
    offers: list(business.offers),
    primaryOffers: list(business.offers).map((item) => item?.name || String(item)).filter(Boolean),
    valueProposition: business.valueProposition || strategy.positioning?.positioningStatement || "",
    primaryObjectiveId: primaryObjective.id || "",
    primaryGoal: primaryObjective.label || "",
    objectives,
    audiences: audiences.map((item) => ({ ...normalizePlanningAudience(item), priority: Number(item.priority || 0) })),
    messageArchitecture: strategy.messageArchitecture || {},
    platformPlaybooks,
    platformRoles: Object.fromEntries(Object.entries(platformPlaybooks).map(([platform, playbook]) => [platform, playbook?.role || ""])),
    contentPillars: pillars.map((item, index) => ({ ...item, id: item.id || `pillar_${index + 1}`, name: item.name || String(item) })),
    contentFunctionPortfolio,
    contentFunctionPolicy: extensions.contentFunctionPolicy || {
      reviewWindowDays: 30,
      functions: Object.fromEntries(Object.entries(contentFunctionPortfolio).map(([key, target]) => [key, { min: Math.max(0, Number(target) - 10), target: Number(target), max: Math.min(100, Number(target) + 10), rationale: "由活动策略内容组合投影" }])),
      adjustmentRule: "具体顺序由内容 Agent 按历史和用户选择决定"
    },
    contentPortfolio: legacyPortfolio(contentFunctionPortfolio),
    purposeEligibilityPolicy: extensions.purposeEligibilityPolicy || {},
    conversionLadder: extensions.conversionLadder || fallbackConversionLadder(strategy.conversionSystem),
    operatingEnvelope: extensions.operatingEnvelope || {},
    knowledgeEvidencePlan: extensions.knowledgeEvidencePlan || {},
    decisionProvenance: extensions.decisionProvenance || {},
    strategyDecisionRevision: extensions.decisionProvenance?.decisionRevision || null,
    strategyDecisionHash: extensions.decisionProvenance?.decisionHash || null,
    accountPortfolio: extensions.accountPortfolio || {},
    accountGrowthStrategies,
    selectedGrowthPlaybooks: list(extensions.selectedGrowthPlaybooks),
    growthStrategy: currentAccountGrowth,
    growthMode: currentAccountGrowth?.growthMode || strategy.accountPolicy?.growthMode || "steady_vertical",
    hotspotPolicy: currentAccountGrowth?.hotspotPolicy || extensions.hotspotPolicy || {},
    experimentPlans: list(extensions.experimentPlans),
    activeExperimentPlan: currentAccountGrowth?.experimentPlan || list(extensions.experimentPlans).find((item) => item.socialAccountId === strategySnapshot.socialAccountId) || null,
    platformInfrastructure: list(extensions.platformInfrastructure),
    conversionSystem: strategy.conversionSystem || {},
    conversionPath: strategy.conversionSystem?.primaryPath?.steps?.join(" → ") || "",
    dynamicContext: strategy.dynamicContext || {},
    matrixPolicy: strategy.matrixPolicy || {},
    accountPolicy: strategy.accountPolicy || {},
    accountPlanningStatus:currentAccountGrowth?.planningStatus || (extensions.accountPortfolio?.mode?"active":"legacy_active"),
    recommendedCadence:currentAccountGrowth?.recommendedCadence || strategy.accountPolicy?.recommendedCadence || {},
    conversionResponsibility:currentAccountGrowth?.conversionResponsibility || strategy.accountPolicy?.conversionResponsibility || null,
    contentContext: payload.contentContext || {},
    evidencePolicy: strategy.evidencePolicy || {},
    riskPolicy,
    tone: [...new Set(allPlaybookTones.filter(Boolean))],
    riskBoundaries: [...new Set([...list(riskPolicy.forbiddenClaims), ...list(riskPolicy.sensitiveTopics)])],
    knowledgeFolderIds: list(strategy.evidencePolicy?.knowledgeFolderIds),
    confirmedClaimIds: list(payload.governance?.confirmedClaimIds),
    strategyFactIds: list(payload.governance?.strategyFactIds),
    factApplications:list(payload.governance?.factApplications),
    profileCoverage:payload.governance?.profileCoverage || null,
    hypotheses: list(payload.governance?.hypotheses),
    conflicts: list(payload.governance?.conflicts),
    missingInformation: list(payload.governance?.missingInformation),
    factSnapshot
  };
}

/**
 * This is the only place where the content agent knows the current strategy shape.
 * Keep it read-only: changes in the strategy agent should be absorbed here.
 */
export function projectStrategyForContent(strategySnapshot, currentFacts = [], providedFactSnapshot = null) {
  const candidate = strategySnapshot.document || strategySnapshot.payload || strategySnapshot;
  if (candidate?.schemaVersion === "2.0" && candidate?.strategy) return projectV2(strategySnapshot, currentFacts, providedFactSnapshot);
  const payload = strategySnapshot.payload || strategySnapshot;
  const business = payload.business || {};
  const strategy = payload.accountStrategy || {};
  const audiences = list(payload.audiences).sort((a, b) => Number(b?.priority || 0) - Number(a?.priority || 0));
  const accountId = payload.accountId || strategySnapshot.accountId || "unknown_account";
  const factSnapshot = resolvedFactSnapshot(accountId, currentFacts, providedFactSnapshot);
  const legacyContentPortfolio = {
    traffic: Number(strategy.contentPortfolio?.traffic ?? 25),
    trust: Number(strategy.contentPortfolio?.trust ?? 35),
    product: Number(strategy.contentPortfolio?.product ?? 25),
    conversion: Number(strategy.contentPortfolio?.conversion ?? 15)
  };

  return {
    schemaVersion: "0.1",
    strategySnapshotId: latestId(strategySnapshot),
    strategySnapshotVersion: strategySnapshot.version || null,
    accountId,
    workspaceId:strategySnapshot.workspaceId||null,
    companyId:strategySnapshot.companyId||accountId,
    socialAccountId:strategySnapshot.socialAccountId||null,
    accountStage: strategy.growthStage || "unknown",
    operatingMode: strategy.operatingMode || "assisted",
    businessModel: business.businessModel || "",
    primaryOffers: list(business.primaryOffers),
    valueProposition: business.valueProposition || "",
    conversionPath: business.conversionPath || "",
    primaryGoal: strategy.primaryGoal || "",
    audiences: audiences.map((item) => ({
      ...normalizePlanningAudience(item),
      id: item.id || null,
      priority: Number(item.priority || 0),
      status: item.status || "unknown"
    })),
    platformRoles: strategy.platformRoles || {},
    contentPillars: list(strategy.contentPillars).map((item, index) => ({
      id: item.id || `pillar_${index + 1}`,
      name: item.name || String(item)
    })),
    contentPortfolio: legacyContentPortfolio,
    contentFunctionPortfolio: {
      discovery: legacyContentPortfolio.traffic,
      authority: Math.round(legacyContentPortfolio.trust * 0.7),
      proof: legacyContentPortfolio.trust - Math.round(legacyContentPortfolio.trust * 0.7),
      solution: legacyContentPortfolio.product,
      action: legacyContentPortfolio.conversion
    },
    contentFunctionPolicy: legacyFunctionPolicy(legacyContentPortfolio),
    purposeEligibilityPolicy: {},
    conversionLadder: fallbackConversionLadder({}, business.conversionPath),
    operatingEnvelope: {},
    knowledgeEvidencePlan: {},
    decisionProvenance: {},
    tone: names(strategy.tone),
    riskBoundaries: names(strategy.forbiddenTopics),
    knowledgeFolderIds: list(payload.knowledgeScope?.folderIds),
    confirmedClaimIds: list(payload.confirmedClaimIds),
    hypotheses: list(payload.hypotheses),
    missingInformation: list(payload.missingInformation),
    factSnapshot
  };
}
