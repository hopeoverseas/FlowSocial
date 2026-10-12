import { resolvePurposePolicy, selectConversionStage } from "./content-policy.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;

function findByIdOrName(items, value) {
  return list(items).find((item) => item?.id === value || item?.name === value);
}

function firstText(...values) {
  for (const value of values.flatMap((item) => Array.isArray(item) ? item : [item])) {
    const resolved = typeof value === "object" ? text(value?.text || value?.label || value?.message) : text(value);
    if (resolved) return resolved;
  }
  return "";
}

function messageText(messageArchitecture, pillar) {
  const messages = list(messageArchitecture?.supportingMessages);
  const selected = messages.find((item) => pillar?.messageIds?.includes(item?.id)) || messages[0];
  return firstText(messageArchitecture?.coreMessage, selected, pillar?.strategicPurpose);
}

function selectPrimaryAction(conversionStage, requestedAction) {
  if (requestedAction && requestedAction !== "model_selected") return requestedAction;
  return firstText(conversionStage?.allowedActions);
}

function evidenceRequirements({ strategyContext, pillar, audience, contentPurposeId }) {
  const audienceId = audience?.id;
  const offers = list(strategyContext.offers).filter((offer) =>
    !list(offer?.targetAudienceIds).length || !audienceId || offer.targetAudienceIds.includes(audienceId)
  );
  return [...new Set([
    text(pillar?.evidenceRequirement),
    resolvePurposePolicy(contentPurposeId).evidence,
    ...offers.flatMap((offer) => list(offer?.proofRequirements)),
    ...list(strategyContext.evidencePolicy?.claimRules).map((item) => firstText(item)),
    ...list(strategyContext.knowledgeEvidencePlan?.queries)
      .filter((query) => !list(query?.targetPaths).length || list(query.targetPaths).some((path) => path.includes("content") || path.includes("evidence")))
      .map((query) => firstText(query?.query, query?.text, query?.purpose))
  ].filter(Boolean))];
}

function forbiddenAngles({ strategyContext, pillar, audience }) {
  const audienceId = audience?.id;
  const offers = list(strategyContext.offers).filter((offer) =>
    !list(offer?.targetAudienceIds).length || !audienceId || offer.targetAudienceIds.includes(audienceId)
  );
  return [...new Set([
    ...list(pillar?.excludedAngles),
    ...offers.flatMap((offer) => list(offer?.forbiddenClaims)),
    ...list(strategyContext.riskPolicy?.forbiddenClaims),
    ...list(strategyContext.riskPolicy?.sensitiveTopics),
    ...list(strategyContext.riskBoundaries)
  ].filter(Boolean))];
}

export function projectEditorialDecisionBrief({
  strategyContext,
  platform,
  recommendation,
  contentPurposeId = null,
  conversionStage = null
}) {
  const audience = findByIdOrName(strategyContext.audiences, recommendation.targetAudience)
    || strategyContext.audiences?.[0]
    || {};
  const pillar = findByIdOrName(strategyContext.contentPillars, recommendation.contentPillar)
    || strategyContext.contentPillars?.[0]
    || {};
  const purposeId = contentPurposeId || recommendation.suggestedPurposeId || "professional_opinion";
  const resolvedConversionStage = conversionStage
    || selectConversionStage(strategyContext.conversionLadder, recommendation.contentFunction, recommendation.requestedConversionStageId);
  const strategyProblem = firstText(
    audience.painPoints,
    audience.jobsToBeDone,
    audience.buyingTriggers,
    pillar.typicalProblems
  );
  const strategyClaim = messageText(strategyContext.messageArchitecture, pillar);
  const audienceProblem = text(recommendation.audienceProblem, strategyProblem
    || `${audience.name || "核心目标用户"}缺少判断${pillar.name || "当前主题"}优先级和行动方式的清晰标准`);
  const coreClaim = text(recommendation.coreClaim, strategyClaim
    || `讨论${pillar.name || "当前主题"}需要结合真实场景、适用边界和下一步行动`);
  const hasRichSemantics = Boolean(
    strategyProblem
    || strategyClaim
    || list(pillar.typicalProblems).length
    || list(pillar.excludedAngles).length
    || list(audience.commonObjections).length
    || list(audience.contentNeeds).length
  );
  const evidence = evidenceRequirements({ strategyContext, pillar, audience, contentPurposeId: purposeId });
  const risks = forbiddenAngles({ strategyContext, pillar, audience });
  const playbook = strategyContext.growthStrategy || {};
  const experiment = strategyContext.activeExperimentPlan || {};
  const platformPlaybook = strategyContext.platformPlaybooks?.[platform] || {};
  const primaryAction = selectPrimaryAction(resolvedConversionStage, recommendation.requestedPrimaryInteraction);
  const brief = {
    kind: "EditorialDecisionBrief",
    schemaVersion: "1.0",
    projectionMode: hasRichSemantics ? "strategy_semantic_projection" : "legacy_projection",
    strategySnapshotId: strategyContext.strategySnapshotId || null,
    audience: {
      id: audience.id || null,
      name: audience.name || recommendation.targetAudience || "核心目标用户",
      priorityTask: firstText(audience.jobsToBeDone, audience.contentNeeds),
      pain: firstText(audience.painPoints, pillar.typicalProblems) || audienceProblem,
      buyingTrigger: firstText(audience.buyingTriggers),
      objection: firstText(audience.commonObjections, audience.conversionBarriers)
    },
    editorial: {
      topic: recommendation.topic,
      audienceProblem,
      coreClaim,
      supportingMessage: firstText(list(strategyContext.messageArchitecture?.supportingMessages), pillar.strategicPurpose),
      pillarId: pillar.id || null,
      pillarName: pillar.name || recommendation.contentPillar,
      pillarPurpose: pillar.strategicPurpose || "",
      contentFunction: recommendation.contentFunction,
      contentPurposeId: purposeId,
      format: recommendation.format,
      angle: recommendation.angle
    },
    sourceAndEvidence: {
      requirements: evidence,
      preferredSourceTypes: list(pillar.preferredSourceTypes),
      knowledgeFolderIds: list(strategyContext.knowledgeFolderIds),
      minimumStrength: text(pillar.evidenceRequirement, resolvePurposePolicy(purposeId).evidence)
    },
    boundaries: {
      forbiddenAngles: risks,
      phrasesToAvoid: list(strategyContext.messageArchitecture?.phrasesToAvoid),
      mandatoryDisclosures: list(strategyContext.riskPolicy?.mandatoryDisclosures)
    },
    distribution: {
      platform,
      platformRole: platformPlaybook.role || strategyContext.platformRoles?.[platform] || "",
      platformConstraints: list(platformPlaybook.constraints),
      growthMode: strategyContext.growthMode || playbook.growthMode || null,
      growthPlaybookId: recommendation.growthPlaybookId || playbook.selectedPlaybookId || null,
      experimentPlanId: experiment.id || null,
      experimentHypothesis: recommendation.validationHypothesis || experiment.hypothesis || null
    },
    conversion: {
      stageId: resolvedConversionStage?.id || null,
      stageLabel: resolvedConversionStage?.label || null,
      primaryAction: primaryAction || null
    },
    provenance: {
      audiencePath: audience.id ? `strategy.audiences.${audience.id}` : "legacy.audiences",
      pillarPath: pillar.id ? `strategy.contentSystem.pillars.${pillar.id}` : "legacy.contentPillars",
      messagePath: strategyClaim ? "strategy.messageArchitecture" : "legacy_projection",
      riskPath: strategyContext.riskPolicy ? "strategy.riskPolicy" : "legacy.riskBoundaries"
    }
  };
  brief.writingBrief = {
    targetAudience: brief.audience.name,
    audienceTask: brief.audience.priorityTask,
    audienceProblem,
    buyingTrigger: brief.audience.buyingTrigger,
    objectionToResolve: brief.audience.objection,
    topic: brief.editorial.topic,
    coreClaim,
    supportingMessage: brief.editorial.supportingMessage,
    contentFunction: brief.editorial.contentFunction,
    contentPurposeId: brief.editorial.contentPurposeId,
    format: brief.editorial.format,
    angle: brief.editorial.angle,
    evidenceRequirements: evidence,
    forbiddenAngles: risks,
    platformRole: brief.distribution.platformRole,
    platformConstraints: brief.distribution.platformConstraints,
    primaryAction: brief.conversion.primaryAction,
    experimentHypothesis: brief.distribution.experimentHypothesis
  };
  return brief;
}

export function resolveEditorialDecisionBrief(value) {
  if (value?.kind === "EditorialDecisionBrief" && value?.schemaVersion === "1.0") return structuredClone(value);
  return {
    kind: "EditorialDecisionBrief",
    schemaVersion: "1.0",
    projectionMode: "legacy_projection",
    writingBrief: null
  };
}
