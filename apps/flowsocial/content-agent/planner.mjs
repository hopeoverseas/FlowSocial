import { createContentIdentity, createContentSourceEvidence, createContentTaskBrief, createGenerationPayload } from "./contracts.mjs";
import { evaluateDuplication } from "./deduplicator.mjs";
import { planContentSources } from "./source-planner.mjs";
import { CONTENT_FUNCTIONS, legacyRoleForFunction, normalizeFunctionPolicy, purposeForFunction } from "./content-policy.mjs";
import { projectEditorialDecisionBrief } from "./editorial-decision.mjs";
import { compactAudienceLabel, normalizePlanningTopic } from "./planning-topic.mjs";
import { buildContentLearningInstruction } from "./next-cycle-content-portfolio.mjs";

const ROLE_LABELS = {
  traffic: "获得目标用户触达",
  trust: "建立专业信任",
  product: "解释产品与服务价值",
  conversion: "推动咨询或下一步行动"
};

const ROLE_FORMATS = {
  traffic: ["opinion", "checklist"],
  trust: ["howto", "case"],
  product: ["misconception", "howto"],
  conversion: ["case", "checklist"]
};

const FUNCTION_FORMATS = {
  discovery: ["opinion", "checklist"],
  authority: ["howto", "opinion"],
  proof: ["case", "comparison"],
  solution: ["howto", "misconception"],
  action: ["case", "checklist"]
};

function historyRoleCounts(history = []) {
  const counts = { traffic: 0, trust: 0, product: 0, conversion: 0 };
  for (const item of history) {
    const role = item.contentIdentity?.contentRole || item.contentRole;
    if (role in counts) counts[role] += 1;
  }
  return counts;
}

function historyFunctionCounts(history = []) {
  const counts = Object.fromEntries(CONTENT_FUNCTIONS.map((key) => [key, 0]));
  for (const item of history) {
    const contentFunction = item.contentExecutionContext?.directionCard?.contentFunction
      || item.contentDirectionCard?.contentFunction
      || item.contentIdentity?.contentFunction
      || null;
    if (contentFunction in counts) counts[contentFunction] += 1;
    else {
      const role = item.contentIdentity?.contentRole || item.contentRole;
      if (role === "traffic") counts.discovery += 1;
      else if (role === "product") counts.solution += 1;
      else if (role === "conversion") counts.action += 1;
      else if (role === "trust") counts.authority += 1;
    }
  }
  return counts;
}

function chooseRoles(portfolio, history, limit) {
  const counts = historyRoleCounts(history);
  const total = Math.max(Object.values(counts).reduce((sum, value) => sum + value, 0), 1);
  return Object.keys(counts)
    .map((role) => ({
      role,
      deficit: Number(portfolio[role] || 0) / 100 - counts[role] / total
    }))
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, limit)
    .map((item) => item.role);
}

function chooseFunctions(strategyContext, history, limit) {
  const counts = historyFunctionCounts(history);
  const total = Math.max(Object.values(counts).reduce((sum, value) => sum + value, 0), 1);
  const policy = normalizeFunctionPolicy(strategyContext);
  return CONTENT_FUNCTIONS.map((contentFunction) => {
    const actualShare = counts[contentFunction] / total;
    const targetShare = Number(policy[contentFunction]?.target || 0) / 100;
    const belowMinimum = actualShare < Number(policy[contentFunction]?.min || 0) / 100;
    return {
      contentFunction,
      deficit: targetShare - actualShare + (belowMinimum ? 0.25 : 0),
      policy: policy[contentFunction]
    };
  }).sort((left, right) => right.deficit - left.deficit).slice(0, limit);
}

function makeCandidate({ strategyContext, platform, pillar, contentFunction, functionPolicy, index, hotspot, learningLane = "sustain", noveltyVariant = 0 }) {
  const role = legacyRoleForFunction(contentFunction);
  const audienceProfile = strategyContext.audiences[index % Math.max(strategyContext.audiences.length, 1)] || {};
  const audience = compactAudienceLabel(audienceProfile);
  const formats = FUNCTION_FORMATS[contentFunction] || ROLE_FORMATS[role];
  const format = formats[index % formats.length];
  const platformRole = strategyContext.platformRoles[platform] || "";
  const audienceProblems = [...(audienceProfile.painPoints || []), ...(audienceProfile.jobsToBeDone || [])].filter(Boolean);
  const pillarProblems = (pillar.typicalProblems || []).filter(Boolean);
  const strategyProblem = pillarProblems[index % Math.max(pillarProblems.length, 1)]
    || audienceProblems[index % Math.max(audienceProblems.length, 1)]
    || "";
  const topicByFunction = {
    discovery: strategyProblem ? `${audience}为什么总卡在${pillar.name}：${strategyProblem}` : `${audience}在${pillar.name}上最容易忽略什么`,
    authority: strategyProblem ? `${pillar.name}落地方法：帮${audience}解决${strategyProblem}` : `${pillar.name}怎么做：给${audience}一套可执行方法`,
    proof: strategyProblem ? `${pillar.name}是否有效：用案例验证${strategyProblem}` : `${pillar.name}真实案例：从过程到结果怎么验证`,
    solution: strategyProblem ? `解决${strategyProblem}：${pillar.name}的具体应用方案` : `${pillar.name}应用指南：从问题判断到方案选择`,
    action: strategyProblem ? `${audience}现在可以做什么：围绕${strategyProblem}的行动清单` : `${audience}的${pillar.name}下一步行动清单`
  };
  const topicVariantsByPlatform = {
    xiaohongshu: [
      `${pillar.name}的新场景：${audience}如何判断${strategyProblem || "真正优先级"}`,
      `${audience}做${pillar.name}时最容易误判的一个环节`,
      `${pillar.name}从哪里开始：给${audience}的判断清单`,
      `${strategyProblem || pillar.name}为什么反复出现：拆解关键原因`,
      `${pillar.name}案例复盘：哪些做法有效，哪些条件不能照搬`,
      `${audience}推进${pillar.name}前，应该先确认的三个边界`,
      `${pillar.name}的两种路径：${audience}应该如何选择`,
      `换一个角度看${pillar.name}：被忽略的执行成本`
    ],
    wechat: [
      `${pillar.name}深度解析：${audience}如何判断${strategyProblem || "业务优先级"}`,
      `${pillar.name}决策误区：${audience}最容易忽略的关键环节`,
      `${pillar.name}决策框架：从业务问题到落地路径`,
      `${strategyProblem || pillar.name}反复出现的原因与系统解法`,
      `${pillar.name}案例复盘：有效做法、适用条件与不可照搬之处`,
      `${pillar.name}落地之前：${audience}需要确认的三个业务边界`,
      `${pillar.name}路径比较：${audience}如何选择适合自己的方案`,
      `${pillar.name}的隐性成本：一份面向决策者的执行分析`
    ]
  };
  const topicVariants = topicVariantsByPlatform[platform] || topicVariantsByPlatform.xiaohongshu;
  const rawTopic = hotspot?.title
    ? `${hotspot.title}：对${audience}真正意味着什么`
    : topicVariants[noveltyVariant % topicVariants.length] || topicByFunction[contentFunction] || `${audience}在${pillar.name}上最容易忽略的关键问题`;
  const topic = normalizePlanningTopic(rawTopic, {
    contentFunction,
    contentPillar: pillar.name,
    audience: audienceProfile
  });
  const audienceProblem = hotspot?.audienceProblem || strategyProblem || `${audience}缺少判断${pillar.name}优先级和行动方式的清晰标准`;
  const coreClaim = hotspot?.recommendedAngle
    || strategyContext.messageArchitecture?.coreMessage
    || pillar.strategicPurpose
    || `讨论${pillar.name}不能只给结论，还要结合真实业务场景、适用边界和下一步行动`;
  const candidate = {
    id: `candidate_${index + 1}`,
    platform,
    topic,
    contentPillar: pillar.name,
    contentRole: role,
    contentFunction,
    targetAudience: audience,
    audienceProblem,
    coreClaim,
    angle: hotspot ? "热点业务影响" : ["新场景判断", "常见误判", "行动清单", "原因拆解", "案例复盘", "适用边界", "路径比较", "执行成本"][noveltyVariant % 8],
    format,
    conversionGoal: strategyContext.conversionPath,
    reason: `补足“${ROLE_LABELS[role]}”中的 ${contentFunction} 职能；${platformRole || "符合当前平台角色"}；围绕策略内容支柱“${pillar.name}”展开。${functionPolicy?.rationale || ""}`,
    suggestedPurposeId: purposeForFunction(contentFunction, { hasHotspot: Boolean(hotspot), format }),
    functionPolicy,
    sourceHint: hotspot ? "hotspot_mixed" : role === "traffic" ? "auto" : "knowledge"
    ,growthMode: strategyContext.growthMode || "steady_vertical"
    ,growthPlaybookId: strategyContext.growthStrategy?.selectedPlaybookId || null
    ,hotspotRelevanceTier: hotspot?.relevanceTier || hotspot?.bridgeTier || null
    ,validationHypothesis: strategyContext.activeExperimentPlan?.hypothesis || `验证${contentFunction}内容能否带来与当前账号目标一致的平台和业务信号`
    ,learningLane
    ,noveltyVariant
    ,motherTopicKey: `${pillar.id || pillar.name}::${strategyProblem || audience}`
    ,platformTopicVariant: platform
    ,crossPlatformReusePolicy: "shared_mother_topic_distinct_platform_angle"
  };
  const editorialDecisionBrief = projectEditorialDecisionBrief({
    strategyContext,
    platform,
    recommendation: candidate,
    contentPurposeId: candidate.suggestedPurposeId
  });
  return {
    ...candidate,
    audienceProblem: editorialDecisionBrief.editorial.audienceProblem,
    coreClaim: editorialDecisionBrief.editorial.coreClaim,
    editorialDecisionBrief
  };
}

function hotspotTier(item = {}) {
  if (["direct", "bridge", "weak_experiment", "unrelated"].includes(item.relevanceTier)) return item.relevanceTier;
  const score = Number(item.relevanceScore ?? item.score ?? 0);
  return score >= 80 ? "direct" : score >= 55 ? "bridge" : "weak_experiment";
}

function bestPerformanceSignal(history, role, platform) {
  const matched = history
    .filter((item) => (item.contentIdentity?.contentRole || item.contentRole) === role && (!platform || item.platform === platform) && item.publication?.metrics)
    .map((item) => {
      const metrics = item.publication.metrics;
      const derived = metrics.derivedMetrics || metrics.derived || {};
      return { contentTaskId: item.id || item.historyItemId, title: item.title || item.currentContent?.post_copy?.recommended_title || item.currentContent?.recommended_title || item.ideaTitle, role, platform: item.platform, engagementRate: Number(derived.engagementRate || metrics.engagementRate || 0), saves: Number(metrics.saves || 0), follows: Number(metrics.follows || 0) };
    })
    .sort((left, right) => (right.engagementRate + right.saves / 1000 + right.follows / 500) - (left.engagementRate + left.saves / 1000 + left.follows / 500));
  return matched[0] || null;
}

export function recommendContentTasks({
  strategyContext,
  platform,
  history = [],
  hotspots = [],
  knowledgeItems = [],
  viralBlueprints = [],
  userMaterials = [],
  requireProductionReadyBlueprints = false,
  contentPortfolio = null,
  limit = 3
}) {
  const pillars = strategyContext.contentPillars.length
    ? strategyContext.contentPillars
    : [{ id: "pillar_primary", name: strategyContext.valueProposition || "核心专业能力" }];
  const functions = chooseFunctions(strategyContext, history, limit);
  const relevantHotspots = hotspots
    .filter((item) => !["ignored", "expired", "archived"].includes(item.status))
    .map((item) => ({ ...item, relevanceTier: hotspotTier(item) }))
    .filter((item) => {
      const policy = strategyContext.hotspotPolicy || {};
      const allowed = Array.isArray(policy.allowedTiers) && policy.allowedTiers.length ? policy.allowedTiers : ["direct", "bridge"];
      return item.relevanceTier !== "unrelated" && allowed.includes(item.relevanceTier);
    })
    .sort((a, b) => Number(b.relevanceScore || b.score || 0) - Number(a.relevanceScore || a.score || 0));

  const laneSequence = contentPortfolio?.allocation?.sequence || [];
  const candidates = [];
  for (const [{ contentFunction: proposedFunction, policy }, index] of functions.map((item, index) => [item, index])) {
    const learningLane = laneSequence[index] || "sustain";
    const contentFunction = learningLane === "sustain" && contentPortfolio?.sustainSignal?.contentFunction
      ? contentPortfolio.sustainSignal.contentFunction : proposedFunction;
    const preferredPillarId = learningLane === "sustain" ? contentPortfolio?.sustainSignal?.contentPillarId : null;
    const pillar = pillars.find((item) => item.id === preferredPillarId || item.name === preferredPillarId) || pillars[index % pillars.length];
    const hotspot = contentFunction === "discovery" ? relevantHotspots.shift() : null;
    let candidate = null;
    let duplication = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const proposal = makeCandidate({
        strategyContext,
        platform,
        pillar,
        contentFunction,
        functionPolicy: policy,
        index,
        hotspot,
        learningLane,
        noveltyVariant: history.length + index + attempt
      });
      const assessment = evaluateDuplication(proposal, [...history, ...candidates]);
      if (["allow", "warn"].includes(assessment.decision)) {
        candidate = proposal;
        duplication = { ...assessment, attempts: attempt + 1, hardGatePassed: true };
        break;
      }
    }
    if (!candidate) continue;
    const learningInstruction = contentPortfolio
      ? buildContentLearningInstruction(contentPortfolio, { lane: learningLane, contentPillarId: pillar.id || pillar.name, contentFunction }, candidate)
      : null;
    const brief = createContentTaskBrief({ strategyContext, platform, recommendation: candidate });
    if (learningInstruction) brief.contentLearningInstruction = learningInstruction;
    const sourcePlan = planContentSources({
      brief,
      strategyContext,
      hotspots: hotspot ? [hotspot] : relevantHotspots,
      knowledgeItems,
      viralBlueprints,
      userMaterials,
      requireProductionReadyBlueprints,
      preferredMode: candidate.sourceHint === "knowledge" ? "knowledge" : "auto"
    });
    const contentIdentity = createContentIdentity(brief, sourcePlan.sources.flatMap((source) => source.candidateIds));
    const generationPayload = createGenerationPayload({ brief, sourcePlan, identity: contentIdentity, strategyContext });
    if (learningInstruction) generationPayload.contentLearningInstruction = learningInstruction;
    generationPayload.growthTrace = {
      schemaVersion:"1.0",
      socialAccountId:strategyContext.socialAccountId || null,
      accountName:strategyContext.accountPolicy?.accountName || null,
      strategySnapshotId:strategyContext.strategySnapshotId,
      strategyVersion:strategyContext.strategyResolution?.companyStrategyVersion || null,
      effectiveStrategyId:strategyContext.effectiveStrategyId || null,
      accountStrategySnapshotId:strategyContext.strategyResolution?.accountStrategySnapshotId || null,
      accountStrategyVersion:strategyContext.strategyResolution?.accountStrategyVersion || null,
      portfolioMode:strategyContext.accountPortfolio?.mode || strategyContext.strategyResolution?.portfolioMode || "legacy_single_account",
      matrixRole:strategyContext.growthStrategy?.matrixRole || strategyContext.accountPolicy?.matrixRole || null,
      growthPlaybookId:candidate.growthPlaybookId || strategyContext.accountPolicy?.growthPlaybook || "legacy-steady-vertical",
      playbookVersion:strategyContext.growthStrategy?.playbookVersion || strategyContext.accountPolicy?.playbookVersion || "1.0",
      experimentId:strategyContext.activeExperimentPlan?.id || `experiment_${strategyContext.socialAccountId || "company"}_${strategyContext.strategySnapshotId || "legacy"}`,
      experimentHypothesis:candidate.validationHypothesis,
      observationWindowDays:Number(strategyContext.activeExperimentPlan?.windowDays || 0) || null,
      exitConditions:Array.isArray(strategyContext.activeExperimentPlan?.exitConditions) ? strategyContext.activeExperimentPlan.exitConditions : []
    };
    const performanceSignal = bestPerformanceSignal(history, candidate.contentRole, platform);
    generationPayload.titlePerformanceSignals = performanceSignal ? [performanceSignal] : [];
    generationPayload.contentSourceEvidence = createContentSourceEvidence({ sourcePlan, hotspots: hotspot ? [hotspot, ...relevantHotspots] : relevantHotspots, viralBlueprints, userMaterials });
    generationPayload.temporaryMaterials = generationPayload.contentSourceEvidence.userMaterials;
    generationPayload.uploadedImageNames = generationPayload.temporaryMaterials.filter((item) => item.type === "image").map((item) => item.name);
    candidates.push({
      ...candidate,
      duplication,
      nextCyclePortfolioRef: contentPortfolio ? { id: contentPortfolio.id, hash: contentPortfolio.projectionHash } : null,
      contentLearningInstruction: learningInstruction,
      sourcePlan,
      contentTaskBrief: brief,
      contentIdentity,
      performanceSignal,
      generationPayload
    });
  }

  return candidates;
}
