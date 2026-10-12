import { createHash } from "node:crypto";
import { assertSharedContract, validateContentDirectionCardV1, validateContentExecutionContextV1 } from "../contracts/strategy-content-contracts.mjs";
import { contentFunctionForRole, resolvePurposePolicy, selectConversionStage } from "./content-policy.mjs";
import { projectEditorialDecisionBrief } from "./editorial-decision.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

function shortHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function contentFunctionFor(recommendation) {
  if (recommendation.contentFunction) return recommendation.contentFunction;
  return contentFunctionForRole(recommendation.contentRole, recommendation.format);
}

function findByIdOrName(items, value) {
  return list(items).find((item) => item?.id === value || item?.name === value);
}

export function createContentDirectionCard({ strategyContext, recommendation, platform }) {
  const pillar = findByIdOrName(strategyContext.contentPillars, recommendation.contentPillar) || strategyContext.contentPillars?.[0] || {};
  const audience = findByIdOrName(strategyContext.audiences, recommendation.targetAudience) || strategyContext.audiences?.[0] || {};
  const objectiveId = recommendation.objectiveId || strategyContext.primaryObjectiveId || "objective_legacy_primary";
  const contentFunction = contentFunctionFor(recommendation);
  const contentPurposeId = recommendation.generationPayload?.contentPurposeId || recommendation.suggestedPurposeId || "professional_opinion";
  const requestedContentPurposeId = recommendation.generationPayload?.requestedContentPurposeId
    || recommendation.requestedContentPurposeId
    || recommendation.userRequest?.contentPurposeId
    || null;
  const promotionMode = recommendation.generationPayload?.promotionMode || recommendation.requestedPromotionMode || "none";
  const purposePolicy = resolvePurposePolicy(contentPurposeId);
  const sourcePlan = recommendation.sourcePlan || recommendation.generationPayload?.contentSourcePlan || { sources: [] };
  const knowledgeSource = list(sourcePlan.sources).find((source) => source.type === "knowledge_base");
  const conversionStage = selectConversionStage(strategyContext.conversionLadder, contentFunction, recommendation.requestedConversionStageId);
  const editorialDecisionBrief = projectEditorialDecisionBrief({
    strategyContext,
    platform,
    recommendation,
    contentPurposeId,
    requestedContentPurposeId,
    contentPurposeChanged: Boolean(requestedContentPurposeId && requestedContentPurposeId !== contentPurposeId),
    conversionStage
  });
  const messages = list(strategyContext.messageArchitecture?.supportingMessages);
  const offerIds = list(strategyContext.offers)
    .filter((offer) => !list(offer?.targetAudienceIds).length || !audience.id || offer.targetAudienceIds.includes(audience.id))
    .map((offer) => offer?.id)
    .filter(Boolean);
  const seed = { strategySnapshotId: strategyContext.strategySnapshotId, platform, objectiveId, contentFunction, pillarId: pillar.id, audienceId: audience.id, topic: recommendation.topic, angle: recommendation.angle };
  const card = {
    schemaVersion: "1.0",
    id: `direction_${shortHash(seed)}`,
    strategySnapshotId: strategyContext.strategySnapshotId,
    strategyDecisionRevision: strategyContext.strategyDecisionRevision || strategyContext.decisionProvenance?.decisionRevision || null,
    strategyDecisionHash: strategyContext.strategyDecisionHash || strategyContext.decisionProvenance?.decisionHash || null,
    growthMode: recommendation.growthMode || strategyContext.growthMode || null,
    growthPlaybookId: recommendation.growthPlaybookId || strategyContext.growthStrategy?.selectedPlaybookId || null,
    validationHypothesis: recommendation.validationHypothesis || strategyContext.activeExperimentPlan?.hypothesis || null,
    experimentPlanId: strategyContext.activeExperimentPlan?.id || null,
    platform,
    objectiveId,
    contentFunction,
    contentPurposeId,
    promotionMode,
    pillarId: pillar.id || "pillar_legacy_primary",
    audienceId: audience.id || "audience_legacy_primary",
    topic: recommendation.topic,
    angle: recommendation.angle,
    audienceProblem: editorialDecisionBrief.editorial.audienceProblem,
    coreClaim: editorialDecisionBrief.editorial.coreClaim,
    messageIds: messages.map((item, index) => typeof item === "object" && item?.id ? item.id : `message_${index + 1}`),
    offerIds,
    format: recommendation.format,
    conversionGoal: recommendation.conversionGoal || "",
    conversionStage,
    primaryInteraction: recommendation.requestedPrimaryInteraction || "model_selected",
    evidenceRequirement: purposePolicy.evidence,
    evidenceRequirementDetail: {
      type: purposePolicy.evidence,
      required: Boolean(list(sourcePlan.sources).find((source) => source.required && ["knowledge_base", "strategy_facts", "user_material"].includes(source.type))),
      candidateIds: list(knowledgeSource?.candidateIds),
      candidateCount: list(knowledgeSource?.candidateIds).length,
      selectionMode: list(knowledgeSource?.candidateIds).length ? "available" : "user_selection_required"
    },
    platformRole: strategyContext.platformPlaybooks?.[platform]?.role || strategyContext.platformRoles?.[platform] || "",
    editorialDecisionBrief,
    tacticalLearningPack: strategyContext.tacticalLearningPack || { schemaVersion: "1.0", actions: [] },
    rationale: recommendation.reason || ""
  };
  assertSharedContract(validateContentDirectionCardV1(card));
  return card;
}

export function createContentExecutionContext({ strategyContext, directionCard, recommendation, userRequest = null, knowledgeItems = [], createdAt = new Date().toISOString() }) {
  const sourcePlan = recommendation.sourcePlan || { schemaVersion: "0.1", sources: [] };
  const selectedKnowledgeIds = sourcePlan.sources
    .filter((source) => source.type === "knowledge_base")
    .flatMap((source) => list(source.candidateIds));
  const knowledgeVersionSeed = selectedKnowledgeIds.length
    ? selectedKnowledgeIds
    : list(knowledgeItems).map((item) => `${item.id}:${item.updatedAt || item.createdAt || "unknown"}`);
  const contentIntentProfile = {
    purposeId: directionCard.contentPurposeId,
    promotionMode: directionCard.promotionMode,
    primaryInteraction: directionCard.primaryInteraction,
    contentFunction: directionCard.contentFunction,
    conversionStage: directionCard.conversionStage,
    evidenceRequirement: directionCard.evidenceRequirement,
    selectedBy: userRequest?.contentPurposeId ? "user" : "planner_suggestion",
    purposeEligibility: {
      eligible: !strategyContext.purposeEligibilityPolicy?.[directionCard.contentFunction]?.length
        || strategyContext.purposeEligibilityPolicy[directionCard.contentFunction].includes(directionCard.contentPurposeId),
      eligiblePurposeIds: list(strategyContext.purposeEligibilityPolicy?.[directionCard.contentFunction]),
      rule: "用户对本篇内容目的的明确选择优先；策略范围只产生提示，不自动否决"
    }
  };
  const resolvedPolicies = {
    platformPlaybook: strategyContext.platformPlaybooks?.[directionCard.platform] || {},
    evidencePolicy: strategyContext.evidencePolicy || {},
    riskPolicy: strategyContext.riskPolicy || { forbiddenClaims: list(strategyContext.riskBoundaries) },
    contentFunctionPolicy: strategyContext.contentFunctionPolicy || {},
    conversionLadder: strategyContext.conversionLadder || {},
    operatingEnvelope: strategyContext.operatingEnvelope || {},
    knowledgeEvidencePlan: strategyContext.knowledgeEvidencePlan || {},
    strategyResolution: strategyContext.strategyResolution || null,
    matrixPolicy: strategyContext.matrixPolicy || {},
    accountPolicy: strategyContext.accountPolicy || {},
    tacticalLearningPack: strategyContext.tacticalLearningPack || { schemaVersion: "1.0", actions: [] },
    priorityOrder: ["legal_and_fact_boundaries", "user_overrides", "account_strategy", "matrix_strategy", "company_strategy", "rolling_plan", "direction_card", "content_intent", "platform_playbook", "planner", "skill_defaults"]
  };
  const userOverrides = userRequest ? {
    topic: userRequest.topic || null,
    contentRole: userRequest.contentRole || null,
    preferredSourceMode: userRequest.preferredSourceMode || null,
    contentPurposeId: userRequest.contentPurposeId || null,
    promotionMode: userRequest.promotionMode || null,
    primaryInteraction: userRequest.primaryInteraction || null,
    conversionStageId: userRequest.conversionStageId || null,
    userInstruction: userRequest.userInstruction || null
  } : {};
  const base = {
    workspaceId:strategyContext.workspaceId||null,
    companyId:strategyContext.companyId||strategyContext.accountId,
    socialAccountId:strategyContext.socialAccountId||null,
    effectiveStrategyId:strategyContext.effectiveStrategyId||null,
    strategyDecisionRevision:directionCard.strategyDecisionRevision||strategyContext.strategyDecisionRevision||strategyContext.decisionProvenance?.decisionRevision||null,
    strategyDecisionHash:directionCard.strategyDecisionHash||strategyContext.strategyDecisionHash||strategyContext.decisionProvenance?.decisionHash||null,
    growthMode:directionCard.growthMode||null,
    growthPlaybookId:directionCard.growthPlaybookId||null,
    validationHypothesis:directionCard.validationHypothesis||null,
    experimentPlanId:directionCard.experimentPlanId||null,
    strategySnapshotId: strategyContext.strategySnapshotId,
    factSnapshotId: strategyContext.factSnapshotId || strategyContext.factSnapshot?.factSnapshotId,
    knowledgeSnapshotId: `knowledge_plan_${shortHash(knowledgeVersionSeed)}`,
    directionCard,
    editorialDecisionBrief: structuredClone(directionCard.editorialDecisionBrief),
    writingBrief: structuredClone(directionCard.editorialDecisionBrief?.writingBrief || null),
    strategyProjectionSnapshot: {
      kind: "ContentStrategyProjectionSnapshot",
      schemaVersion: "1.0",
      strategySnapshotId: strategyContext.strategySnapshotId,
      strategySnapshotVersion: strategyContext.strategySnapshotVersion || null,
      audience: structuredClone(strategyContext.audiences?.find((item) => item.id === directionCard.audienceId) || null),
      pillar: structuredClone(strategyContext.contentPillars?.find((item) => item.id === directionCard.pillarId) || null),
      messageArchitecture: structuredClone(strategyContext.messageArchitecture || {}),
      evidencePolicy: structuredClone(strategyContext.evidencePolicy || {}),
      riskPolicy: structuredClone(strategyContext.riskPolicy || {})
    },
    growthPlaybookSnapshot: structuredClone(strategyContext.growthStrategy || null),
    experimentSnapshot: structuredClone(strategyContext.activeExperimentPlan || null),
    contentIntentProfile,
    sourcePlan,
    resolvedPolicies,
    userOverrides,
    createdAt
  };
  const context = { schemaVersion: "1.0", id: `execution_${shortHash(base)}`, ...base };
  assertSharedContract(validateContentExecutionContextV1(context));
  return context;
}

export function attachExecutionContracts({ strategyContext, recommendation, platform, userRequest = null, knowledgeItems = [] }) {
  const contentDirectionCard = createContentDirectionCard({ strategyContext, recommendation, platform });
  const contentExecutionContext = createContentExecutionContext({ strategyContext, directionCard: contentDirectionCard, recommendation, userRequest, knowledgeItems });
  return {
    ...recommendation,
    contentDirectionCard,
    contentExecutionContext,
    generationPayload: {
      ...recommendation.generationPayload,
      contentDirectionCard,
      contentExecutionContext
    }
  };
}
