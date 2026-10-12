import { createContentIdentity, createContentSourceEvidence, createContentTaskBrief, createGenerationPayload } from "./contracts.mjs";
import { evaluateDuplication } from "./deduplicator.mjs";
import { planContentSources } from "./source-planner.mjs";
import { contentFunctionForRole, legacyRoleForFunction, resolvePurposePolicy } from "./content-policy.mjs";
import { projectEditorialDecisionBrief } from "./editorial-decision.mjs";

function findPillar(strategyContext, requested) {
  if (!requested) return strategyContext.contentPillars[0]?.name || "核心专业能力";
  return strategyContext.contentPillars.find((item) => item.id === requested || item.name === requested)?.name || requested;
}

export function planDirectedContent({
  strategyContext,
  platform,
  request,
  history = [],
  hotspots = [],
  knowledgeItems = [],
  viralBlueprints = [],
  userMaterials = [],
  requireProductionReadyBlueprints = false
}) {
  if (!request?.topic?.trim()) throw new Error("user-directed content requires topic");
  const audience = request.targetAudience
    || strategyContext.audiences[0]?.name
    || "核心目标用户";
  const purposePolicy = resolvePurposePolicy(request.contentPurposeId || "professional_opinion");
  const contentFunction = request.contentFunction
    || purposePolicy.functions?.[0]
    || contentFunctionForRole(request.contentRole, request.format);
  const contentRole = request.contentRole || legacyRoleForFunction(contentFunction);
  const candidateSeed = {
    id: "candidate_user_directed",
    platform,
    topic: request.topic.trim(),
    contentPillar: findPillar(strategyContext, request.contentPillar),
    contentRole,
    contentFunction,
    targetAudience: audience,
    audienceProblem: request.audienceProblem || "",
    coreClaim: request.coreClaim || "",
    angle: request.angle || "用户指定",
    format: request.format || "opinion",
    conversionGoal: request.conversionGoal || strategyContext.conversionPath,
    reason: "用户主动指定主题；Agent保留策略、重复、事实和来源检查",
    sourceHint: request.preferredSourceMode || "auto"
    ,suggestedPurposeId: request.contentPurposeId || null
    ,requestedContentPurposeId: request.contentPurposeId || null
    ,requestedPromotionMode: request.promotionMode || null
    ,requestedPrimaryInteraction: request.primaryInteraction || null
    ,requestedConversionStageId: request.conversionStageId || null
  };
  const editorialDecisionBrief = projectEditorialDecisionBrief({
    strategyContext,
    platform,
    recommendation: candidateSeed,
    contentPurposeId: request.contentPurposeId || "professional_opinion"
  });
  const candidate = {
    ...candidateSeed,
    audienceProblem: editorialDecisionBrief.editorial.audienceProblem,
    coreClaim: editorialDecisionBrief.editorial.coreClaim,
    editorialDecisionBrief
  };
  const duplication = evaluateDuplication(candidate, history);
  const contentTaskBrief = createContentTaskBrief({
    strategyContext,
    platform,
    recommendation: candidate,
    userInstruction: request.userInstruction || "",
    generationMode: "user_directed"
  });
  const sourcePlan = planContentSources({
    brief: contentTaskBrief,
    strategyContext,
    hotspots,
    knowledgeItems,
    viralBlueprints,
    userMaterials,
    requireProductionReadyBlueprints,
    preferredMode: request.preferredSourceMode || "auto",
    selectedSourceIds: request.sourceIds || []
  });
  const contentIdentity = createContentIdentity(
    contentTaskBrief,
    sourcePlan.sources.flatMap((source) => source.candidateIds)
  );
  const generationPayload = createGenerationPayload({
    brief: contentTaskBrief,
    sourcePlan,
    identity: contentIdentity,
    strategyContext
  });
  generationPayload.contentSourceEvidence = createContentSourceEvidence({ sourcePlan, hotspots, viralBlueprints, userMaterials });
  generationPayload.requestedContentPurposeId = request.contentPurposeId || null;
  generationPayload.temporaryMaterials = generationPayload.contentSourceEvidence.userMaterials;
  generationPayload.uploadedImageNames = generationPayload.temporaryMaterials.filter((item) => item.type === "image").map((item) => item.name);
  return {
    ...candidate,
    duplication,
    sourcePlan,
    contentTaskBrief,
    contentIdentity,
    generationPayload
  };
}
