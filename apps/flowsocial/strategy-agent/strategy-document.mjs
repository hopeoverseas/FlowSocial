import { adaptAccountPortfolioV1, validateStrategyDocumentV2 } from "../contracts/strategy-content-contracts.mjs";

const list = (value) => Array.isArray(value) ? value.filter((item) => item != null) : value == null ? [] : [value];
const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

function slug(value, fallback) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_|_$/g, "").slice(0, 32);
  return normalized || fallback;
}

function claimMap(claims = []) {
  return new Map(claims.filter((claim) => !["rejected", "conflicting", "superseded"].includes(claim.status)).map((claim) => [claim.fieldPath, claim.value]));
}

function stringList(value) {
  if (Array.isArray(value)) return [...new Set(value.flatMap((item) => typeof item === "string" ? item.split(/[、，,;；\n]/) : item?.name || item?.label || item?.summary || []).map((item) => String(item).trim()).filter(Boolean))];
  if (typeof value === "string") return [...new Set(value.split(/[、，,;；\n]/).map((item) => item.trim()).filter(Boolean))];
  if (value && typeof value === "object") return stringList(value.summary || value.name || []);
  return [];
}

function namedValues(value, keys) {
  if (Array.isArray(value)) return value.flatMap((item)=>namedValues(item,keys));
  if (typeof value==="string") return stringList(value);
  if (!value || typeof value!=="object") return [];
  return [...new Set(Object.entries(value).flatMap(([key,item])=>keys.has(key)?namedValues(item,keys):[]))];
}

function recoverOfferNames(claimValue, strategyInputBundle, businessModel) {
  const keys=new Set(["offers","primaryOffers","products","services","serviceLines","items","names","name","summary"]);
  const facts=Object.values(strategyInputBundle?.dynamicFacts||{}).flat().filter((fact)=>/(offer|product|service|业务|产品|服务)/i.test(`${fact.key||fact.factKey||""} ${fact.factType||""} ${fact.predicate||""}`));
  const decisions=object(strategyInputBundle?.strategyDecisions);
  const decisionValues=list(decisions.accountStrategies).flatMap((item)=>[item.offerNames,item.focusOffers,item.primaryOffers]);
  const values=[...namedValues(claimValue,keys),...facts.flatMap((fact)=>namedValues(fact.value,keys)),...decisionValues.flatMap((value)=>namedValues(value,keys))];
  const unique=[...new Set(values.map((item)=>text(item)).filter(Boolean))];
  return unique.length?unique:[businessModel].filter((item)=>item&&!/^待进一步明确/.test(item));
}

function recoverPillarInputs(strategyInputBundle) {
  const keys=new Set(["pillars","contentPillars","contentDirections","topics","focusPillars","items","names","name","summary"]);
  const facts=Object.values(strategyInputBundle?.dynamicFacts||{}).flat().filter((fact)=>/(pillar|topic|content.focus|内容支柱|内容方向|选题方向)/i.test(`${fact.key||fact.factKey||""} ${fact.factType||""} ${fact.predicate||""}`));
  const decisions=object(strategyInputBundle?.strategyDecisions);
  const decisionValues=list(decisions.accountStrategies).flatMap((item)=>[item.contentPillars,item.focusPillars,item.contentDirections]);
  return [...new Set([...facts.flatMap((fact)=>namedValues(fact.value,keys)),...decisionValues.flatMap((value)=>namedValues(value,keys))])];
}

function riskConstraintList(value) {
  if (!value || value.none === true) return [];
  if (typeof value === "string" || Array.isArray(value)) return stringList(value);
  const source=object(value);
  return stringList([
    source.confidentialInformation,
    source.forbiddenClaims,
    source.dataSourceRules,
    source.caseAuthorizationRules,
    source.mandatoryReviewRules,
    source.advertisingLaw,
    source.industryCompliance,
    source.sensitiveTopics,
    source.competitorRules,
    source.copyrightRules,
    source.brandForbidden,
    source.disclosures,
    source.items
  ]);
}

function normalizePortfolio(input = {}) {
  const keys = ["discovery", "authority", "proof", "solution", "action"];
  const defaults = { discovery: 15, authority: 35, proof: 20, solution: 20, action: 10 };
  const values = Object.fromEntries(keys.map((key) => [key, Math.max(0, Number(input[key] ?? defaults[key]) || 0)]));
  const total = keys.reduce((sum, key) => sum + values[key], 0) || 100;
  const normalized = Object.fromEntries(keys.map((key) => [key, Math.round(values[key] * 10000 / total) / 100]));
  const delta = Math.round((100 - keys.reduce((sum, key) => sum + normalized[key], 0)) * 100) / 100;
  normalized.authority += delta;
  return normalized;
}

function projectAccountStrategy(item, accountPortfolio) {
  const matrixRole=accountPortfolio.accountRoles?.[item.socialAccountId] || item.matrixRole || (item.socialAccountId===accountPortfolio.primarySocialAccountId?"primary":"supporting");
  const roleText=String(matrixRole).toLowerCase();
  let contentFunctionTargets=normalizePortfolio(item.contentFunctionTargets);
  let roleLabel=item.platform === "wechat" ? "深度论证与关系承接" : "场景触达与需求发现";
  let conversionResponsibility=item.platform === "wechat" ? "承接深度阅读、关注和业务咨询" : "承接主页访问、私信和跨平台阅读";
  if(accountPortfolio.mode==="role_matrix"){
    if(/authority|trust|权威|信任/.test(roleText)){
      contentFunctionTargets=normalizePortfolio({discovery:10,authority:45,proof:25,solution:15,action:5});
      roleLabel="专业权威与信任沉淀";
    }else if(/product|solution|产品|方案/.test(roleText)){
      contentFunctionTargets=normalizePortfolio({discovery:10,authority:20,proof:20,solution:40,action:10});
      roleLabel="产品教育与方案解释";
    }else if(/conversion|action|转化|承接/.test(roleText)){
      contentFunctionTargets=normalizePortfolio({discovery:5,authority:15,proof:25,solution:25,action:30});
      roleLabel="案例证明与业务承接";
    }else if(/discovery|traffic|触达|发现/.test(roleText)){
      contentFunctionTargets=normalizePortfolio({discovery:40,authority:30,proof:10,solution:15,action:5});
      roleLabel="新用户发现与场景触达";
    }
  }
  const cadence=object(item.recommendedCadence);
  return {
    ...item,
    matrixRole,
    roleLabel,
    planningStatus:"active",
    contentFunctionTargets,
    recommendedCadence:{windowDays:Number(cadence.windowDays||14),items:Math.max(1,Number(cadence.items||2))},
    conversionResponsibility
  };
}

function objectiveType(value) {
  const source = String(value || "");
  if (/流量|曝光|触达|涨粉/.test(source)) return "reach";
  if (/咨询|线索|私域|获客/.test(source)) return "lead_capture";
  if (/成交|转化|销售/.test(source)) return "conversion";
  if (/产品|服务|认知/.test(source)) return "product_education";
  return "authority";
}

function normalizeAudiences(input, fallbackValue) {
  const structuredInput=list(input).filter((item)=>item&&typeof item==="object"&&!Array.isArray(item));
  const source = structuredInput.length ? structuredInput : list(fallbackValue);
  return source.map((item, index) => {
    const data = object(item);
    const name = text(data.name || data.summary || data.description) || text(item) || `目标受众${index + 1}`;
    return {
      ...data,
      id: data.id || `audience_${slug(name, String(index + 1))}`,
      name,
      priority: Number(data.priority || index + 1),
      industries: stringList(data.industries),
      companyStages: stringList(data.companyStages),
      decisionRoles: stringList(data.decisionRoles || data.decisionMakers),
      influencerRoles: stringList(data.influencerRoles),
      jobsToBeDone: stringList(data.jobsToBeDone),
      painPoints: stringList(data.painPoints),
      buyingTriggers: stringList(data.buyingTriggers),
      commonObjections: stringList(data.commonObjections),
      awarenessStage: text(data.awarenessStage) || "unknown",
      preferredLanguage: stringList(data.preferredLanguage),
      contentNeeds: stringList(data.contentNeeds),
      conversionBarriers: stringList(data.conversionBarriers)
    };
  });
}

function normalizeOffers(input, fallbackNames, audienceIds) {
  const structuredInput=list(input).filter((item)=>item&&typeof item==="object"&&!Array.isArray(item));
  const source = structuredInput.length ? structuredInput : stringList(fallbackNames);
  return source.map((item, index) => {
    const data = object(item);
    const name = text(data.name) || text(item) || `产品或服务${index + 1}`;
    return { ...data, id: data.id || `offer_${slug(name, String(index + 1))}`, name, category: text(data.category) || "service", problemsSolved: stringList(data.problemsSolved), applicableScenarios: stringList(data.applicableScenarios), targetAudienceIds: stringList(data.targetAudienceIds).length ? stringList(data.targetAudienceIds) : audienceIds, valuePoints: stringList(data.valuePoints), proofRequirements: stringList(data.proofRequirements), publicClaims: stringList(data.publicClaims), forbiddenClaims: stringList(data.forbiddenClaims) };
  });
}

function normalizePillars(input, offers, objectiveId, audienceIds) {
  const rawInput=list(input);
  const structuredInput=rawInput.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item));
  const namedInput=rawInput.filter((item)=>typeof item==="string"&&item.trim()).map((name)=>({name}));
  const source = structuredInput.length ? structuredInput : namedInput.length ? namedInput : offers.map((offer) => ({ name: offer.name, strategicPurpose: `围绕${offer.name}建立专业认知` }));
  return source.map((item, index) => {
    const data = object(item);
    const name = text(data.name) || text(item) || `内容支柱${index + 1}`;
    return { ...data, id: data.id || `pillar_${slug(name, String(index + 1))}`, name, strategicPurpose: text(data.strategicPurpose) || `围绕${name}持续建立认知与信任`, objectiveIds: stringList(data.objectiveIds).length ? stringList(data.objectiveIds) : [objectiveId], audienceIds: stringList(data.audienceIds).length ? stringList(data.audienceIds) : audienceIds, messageIds: stringList(data.messageIds), typicalProblems: stringList(data.typicalProblems), recommendedContentFunctions: stringList(data.recommendedContentFunctions).length ? stringList(data.recommendedContentFunctions) : ["authority", "proof"], preferredSourceTypes: stringList(data.preferredSourceTypes), evidenceRequirement: text(data.evidenceRequirement) || "medium", weight: Number(data.weight || Math.round(100 / Math.max(source.length, 1))), excludedAngles: stringList(data.excludedAngles) };
  });
}

function conversionSteps(value) {
  if (!value) return [];
  if (Array.isArray(value.steps) && value.steps.length) return stringList(value.steps);
  if (Array.isArray(value.conversionSteps) && value.conversionSteps.length) {
    return value.conversionSteps.map((step)=>typeof step==="string"?step:[step.trigger,step.action,step.channel].filter(Boolean).join("：")).filter(Boolean);
  }
  const direct=[value.entryCTA,value.contactChannel,value.handoffOwner,value.informationCollection,value.leadQualification,value.diagnosticStep,value.nextBusinessStep,value.cooperationEntry].map(text).filter(Boolean);
  if (direct.length) return direct;
  return stringList(value.summary || value).flatMap((item) => item.split(/\s*(?:→|->)\s*/).filter(Boolean));
}

function sanitizeConversionText(value, fallback = "") {
  const source = text(value).trim();
  if (!source) return fallback;
  const redacted = source
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, "")
    .replace(/(?:微信|企微|wechat|wx|手机号|电话|邮箱|email|账号|ID)\s*[:：]?\s*[A-Za-z0-9_.@+-]{4,}/gi, (match) => match.split(/[:：]/)[0]);
  const compact = redacted.replace(/\s+/g, " ").replace(/[，,；;：:、-]+$/g, "").trim();
  if (!compact) return fallback;
  return compact.length > 72 ? fallback : compact;
}

function normalizeContactChannel(value) {
  const source = text(value);
  if (/私信/.test(source)) return "平台私信";
  if (/企业微信|企微/.test(source)) return "联系企业服务人员";
  if (/微信|wechat|wx/i.test(source)) return "联系业务顾问";
  if (/表单|问卷/.test(source)) return "提交咨询表单";
  if (/电话|手机/.test(source)) return "预约业务沟通";
  if (/邮件|邮箱|email/i.test(source)) return "发送业务咨询";
  return sanitizeConversionText(source, "联系企业服务人员");
}

function normalizeConversionSteps(value, fallbackSteps = []) {
  const normalized = conversionSteps(value).map((step) => sanitizeConversionText(step)).filter(Boolean);
  return normalized.length ? normalized : fallbackSteps.map((step) => sanitizeConversionText(step)).filter(Boolean);
}

function normalizePlatformConversionPaths(value) {
  return Object.fromEntries(Object.entries(object(value)).map(([platform, path]) => {
    const source = object(path);
    return [platform, {
      id: text(source.id) || `conversion_${platform}`,
      steps: normalizeConversionSteps(source),
      entryCTA: sanitizeConversionText(source.entryCTA),
      contactChannel: source.contactChannel ? normalizeContactChannel(source.contactChannel) : ""
    }];
  }));
}

function normalizeCtaOptions(value) {
  return list(value).map((item) => {
    if (typeof item === "string") return sanitizeConversionText(item);
    const source = object(item);
    return {
      id: text(source.id),
      label: sanitizeConversionText(source.label || source.text),
      stage: sanitizeConversionText(source.stage),
      channel: source.channel ? normalizeContactChannel(source.channel) : ""
    };
  }).filter((item) => typeof item === "string" ? Boolean(item) : Boolean(item.label));
}

function portfolioRange(target, rationale) {
  const numeric=Math.max(0,Math.min(100,Number(target)||0));
  return { target:numeric,min:Math.max(0,numeric-10),max:Math.min(100,numeric+10),rationale };
}

function averageDecisionPortfolio(accountStrategies = []) {
  const rows = list(accountStrategies).map((item) => object(item.contentFunctionTargets)).filter((item) => Object.keys(item).length);
  if (!rows.length) return {};
  const keys = ["discovery", "authority", "proof", "solution", "action"];
  return Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, item) => sum + Number(item[key] || 0), 0) / rows.length]));
}

function buildStrategyExtensions({ strategyInputBundle, strategy, business, contentResources, portfolio, conversionSystem }) {
  const goal = text(strategy.objectives?.find((item)=>item.id===strategy.primaryObjectiveId)?.label || strategy.objectives?.[0]?.label);
  const stage = text(strategy.growthStage);
  const evidenceTypes = stringList(contentResources.resourceTypes);
  const hasProof = evidenceTypes.some((item)=>/case|案例|data|数据|成果/i.test(item));
  const reasons = {
    discovery:/起号|新建|exploration|account_setup/.test(stage) ? "当前仍需验证触达和选题方向" : "维持稳定的新用户触达",
    authority:/信任|专业|认知|干货|观点/.test(goal) ? "首要目标需要持续建立专业认知" : "维持账号的专业解释能力",
    proof:hasProof ? "已有案例或数据证据，可以承担证明任务" : "当前公开证据有限，证明类内容应保持审慎",
    solution:/产品|服务|咨询|转化|推广/.test(goal) ? "需要让目标客户理解产品服务的适用场景和价值" : "用于把专业认知连接到可执行方案",
    action:/咨询|线索|转化|成交|私域/.test(goal) ? "账号需要在合适内容中承接下一步行动" : "避免在非转化阶段过度推动行动"
  };
  const stages=[
    { id:"engagement",label:"轻互动",allowedActions:["收藏","评论","关注"],suitableFunctions:["discovery","authority"] },
    { id:"content_handoff",label:"内容承接",allowedActions:["查看系列内容","阅读公众号文章","领取清单或报告"],suitableFunctions:["authority","proof","solution"] },
    { id:"lead_capture",label:"线索获取",allowedActions:[conversionSystem.contactChannel || "私信或联系企业人员"].filter(Boolean),suitableFunctions:["proof","solution","action"] },
    { id:"business_action",label:"商业推进",allowedActions:[conversionSystem.diagnosticStep,conversionSystem.nextBusinessStep,conversionSystem.cooperationEntry].filter(Boolean),suitableFunctions:["action"] }
  ];
  const retrieved=list(strategyInputBundle?.retrievedKnowledgeEvidence);
  const evidenceRequest=strategyInputBundle?.knowledgeEvidenceRequest || {schemaVersion:"1.0",mode:"targeted_retrieval",queries:[]};
  const factSourceCounts={ conversation:list(strategyInputBundle?.coreClaims).length,dynamicFacts:Object.values(strategyInputBundle?.dynamicFacts||{}).flat().length,confirmedKnowledge:list(strategyInputBundle?.knowledgeEvidence).length,retrievedKnowledge:retrieved.length,performanceSignals:list(strategyInputBundle?.performanceSignals).length };
  const strategyDecisions=object(strategyInputBundle?.strategyDecisions);
  const accountPortfolio=adaptAccountPortfolioV1(object(strategyDecisions.portfolioDecision),list(strategyDecisions.accountStrategies));
  const accountGrowthStrategies=list(strategyDecisions.accountStrategies).filter((item)=>accountPortfolio.selectedSocialAccountIds.includes(item.socialAccountId)).map((item)=>projectAccountStrategy(item,accountPortfolio));
  const selectedIds=new Set(accountGrowthStrategies.map((item)=>item.socialAccountId));
  const platformInfrastructure=Object.values(strategyInputBundle?.dynamicFacts||{}).flat().filter((fact)=>/xiaohongshu_infrastructure|wechat_infrastructure|platform\.(xiaohongshu|wechat)_infrastructure/i.test(`${fact.key} ${fact.factType}`)).map((fact)=>({factId:fact.id,key:fact.key,value:fact.value,platformScope:fact.platformScope}));
  return {
    schemaVersion:"1.0",
    role:"long_term_account_guidance",
    reviewHorizonDays:90,
    contentFunctionPolicy:{
      reviewWindowDays:30,
      functions:Object.fromEntries(Object.entries(portfolio).map(([key,value])=>[key,portfolioRange(value,reasons[key]||"根据当前策略组合保持动态平衡")])),
      adjustmentRule:"目标值用于长期组合，具体发布顺序由下游按平台、近期历史和用户选择滚动决定"
    },
    purposeEligibilityPolicy:{
      discovery:["hotspot_industry_explainer","interactive_discussion","professional_opinion"],
      authority:["knowledge_howto","professional_opinion","hotspot_industry_explainer"],
      proof:["case_result_showcase","professional_opinion"],
      solution:["knowledge_howto","product_service_promotion","case_result_showcase"],
      action:["product_service_promotion","case_result_showcase","event_announcement"],
      rule:"这是适用范围而不是单篇内容决定；用户对本篇内容目的的选择优先"
    },
    conversionLadder:{ stages,fullBusinessPath:list(conversionSystem.primaryPath?.steps),selectionRule:"单篇内容只选择一个主要阶段和一个主要动作，不把整条销售路径写进每篇内容" },
    operatingEnvelope:{ planningWindowDays:30,capacitySignals:Object.entries(strategyInputBundle?.dynamicFacts||{}).flatMap(([,facts])=>list(facts)).filter((fact)=>/operating|capacity|cadence|review|team/i.test(`${fact.key} ${fact.factType} ${fact.predicate}`)).map((fact)=>({factId:fact.id,key:fact.key,value:fact.value})),rule:"只定义产能与审核范围，不生成具体发布日期" },
    knowledgeEvidencePlan:{ ...evidenceRequest,retrievalStatus:retrieved.length?"retrieved":"no_matching_evidence",retrievedEvidence:retrieved.map((item)=>({id:item.id,queryId:item.queryId,fileId:item.fileId,fileName:item.fileName,targetPaths:item.targetPaths,score:item.score})),usageRules:["对话确认决定当前方向","知识库只补充事实和证据","知识冲突不得自动覆盖用户回答","内容素材不得自动升级为长期策略"] },
    accountPortfolio:Object.keys(object(strategyDecisions.portfolioDecision)).length ? accountPortfolio : null,
    accountGrowthStrategies,
    selectedGrowthPlaybooks:list(strategyDecisions.selectedGrowthPlaybooks).filter((item)=>selectedIds.has(item.socialAccountId)).map((item)=>({ ...item,playbookVersion:item.playbookVersion||accountGrowthStrategies.find((strategy)=>strategy.socialAccountId===item.socialAccountId)?.playbookVersion||"1.0" })),
    accountPlanningStates:list(strategyDecisions.accountStrategies).map((item)=>({socialAccountId:item.socialAccountId,status:selectedIds.has(item.socialAccountId)?"active":"pending",planningStatus:selectedIds.has(item.socialAccountId)?"active":"pending",reason:selectedIds.has(item.socialAccountId)?"已纳入当前账号组合":"未纳入当前账号组合，保持待规划"})),
    hotspotPolicy:{ accountPolicies:accountGrowthStrategies.map((item)=>({socialAccountId:item.socialAccountId,growthMode:item.growthMode,...object(item.hotspotPolicy)})),globalRules:["热点必须标记直接相关、自然桥接或弱相关实验","完全无关热点不进入自动推荐","不得自动删除历史内容"] },
    experimentPlans:accountGrowthStrategies.map((item)=>({socialAccountId:item.socialAccountId,playbookId:item.selectedPlaybookId,...object(item.experimentPlan)})),
    platformInfrastructure,
    decisionProvenance:{ sourcePriority:["current_confirmed_conversation","confirmed_knowledge_evidence","performance_signals","model_hypothesis"],sourceCounts:factSourceCounts,decisionRevision:strategyDecisions.decisionRevision||null,decisionHash:strategyDecisions.decisionHash||null }
  };
}

export function createStrategyDocumentV2({ accountId, claims = [], strategyInputBundle, suggestion = {} }) {
  const byPath = claimMap(claims);
  const suggested = suggestion?.schemaVersion === "2.0" ? suggestion : {};
  const suggestedBusiness = object(suggested.business);
  const suggestedStrategy = object(suggested.strategy);
  const audienceClaim = byPath.get("audiences.primary");
  const audiences = normalizeAudiences(suggestedStrategy.audiences, audienceClaim);
  const audienceIds = audiences.map((item) => item.id);
  const businessModel = text(byPath.get("business.businessModel")?.summary || byPath.get("business.businessModel")) || text(suggestedBusiness.businessModel) || "待进一步明确的业务模式";
  const offerClaim = byPath.get("business.primaryOffers");
  const offers = normalizeOffers(suggestedBusiness.offers, recoverOfferNames(offerClaim,strategyInputBundle,businessModel), audienceIds);
  const primaryGoal = text(byPath.get("accountStrategy.primaryGoal")?.summary || byPath.get("accountStrategy.primaryGoal")) || text(suggestedStrategy.objectives?.[0]?.label) || "建立目标受众的专业认知";
  const suggestedObjectives = list(suggestedStrategy.objectives).filter((item)=>item&&typeof item==="object"&&!Array.isArray(item));
  const objectives = suggestedObjectives.length ? suggestedObjectives.map((item, index) => ({ id: item.id || `objective_${index + 1}`, type: text(item.type) || objectiveType(item.label), label: text(item.label) || primaryGoal, priority: Number(item.priority || index + 1), weight: Number(item.weight || (index ? 30 : 70)), timeHorizon: text(item.timeHorizon) || "90_days", successSignals: stringList(item.successSignals) })) : [{ id: "objective_primary", type: objectiveType(primaryGoal), label: primaryGoal, priority: 1, weight: 100, timeHorizon: "90_days", successSignals: [] }];
  const primaryObjectiveId = objectives.some((item) => item.id === suggestedStrategy.primaryObjectiveId) ? suggestedStrategy.primaryObjectiveId : objectives[0].id;
  const valueProposition = text(suggestedBusiness.valueProposition) || `围绕${offers.map((item) => item.name).join("、")}，帮助${audiences.map((item) => item.name).join("、")}解决实际业务问题`;
  const positioning = object(suggestedStrategy.positioning);
  const platformRoleClaim = object(byPath.get("accountStrategy.platformRoles"));
  const suggestedPlaybooks = object(suggestedStrategy.platformPlaybooks);
  const constraintsClaim=byPath.get("accountStrategy.constraints");
  const constraints = riskConstraintList(constraintsClaim);
  const contentResources = object(byPath.get("accountStrategy.contentResources"));
  const recoveredPillars=recoverPillarInputs(strategyInputBundle);
  const pillars = normalizePillars(list(suggestedStrategy.contentSystem?.pillars).length?suggestedStrategy.contentSystem.pillars:recoveredPillars, offers, primaryObjectiveId, audienceIds);
  const strategyFacts = Object.entries(strategyInputBundle?.dynamicFacts || {}).filter(([impact]) => ["strategy", "platform", "risk"].includes(impact)).flatMap(([, facts]) => facts).filter((fact)=>fact.factType!=="diagnostic_detail");
  const allFacts = Object.entries(strategyInputBundle?.dynamicFacts || {}).flatMap(([impact,facts])=>(Array.isArray(facts)?facts:[]).filter((fact)=>fact.factType!=="diagnostic_detail").map((fact)=>({impact,fact})));
  const appliedPaths={ strategy:["strategy.positioning","strategy.audiences","strategy.contentSystem"],platform:["strategy.platformPlaybooks"],risk:["strategy.evidencePolicy","strategy.riskPolicy"],topic:["contentContext.topicSignals"],content_only:["contentContext.supportingFacts"] };
  const factApplications=allFacts.map(({impact,fact})=>({ factId:fact.id || fact.key, factKey:fact.key, disposition:["forbidden","prohibited"].includes(fact.contentUsage)?"blocked":impact==="topic"?"topic_context":impact==="content_only"?"content_context":"applied", appliedToPaths:["forbidden","prohibited"].includes(fact.contentUsage)?["strategy.riskPolicy"]:(appliedPaths[impact]||[]), reason:`按 ${impact} 影响级别路由` }));
  const skippedCoverage=list(strategyInputBundle?.coverageSnapshot?.core?.items).filter((item)=>["skipped","not_applicable"].includes(item.status)).map((item)=>item.label || item.targetId);
  const conversion = byPath.get("business.conversionPath");
  const steps = normalizeConversionSteps(conversion);
  const suggestedConversion=object(suggestedStrategy.conversionSystem);
  const suggestedSteps=normalizeConversionSteps(object(suggestedConversion.primaryPath)).filter((step)=>!/^@\{/.test(step));
  const entryCTA=sanitizeConversionText(conversion?.entryCTA || suggestedConversion.entryCTA,"提出下一步行动邀请");
  const contactChannel=normalizeContactChannel(conversion?.contactChannel || suggestedConversion.contactChannel);
  const handoffOwner=sanitizeConversionText(conversion?.handoffOwner || suggestedConversion.handoffOwner,"业务承接人员");
  const informationCollection=sanitizeConversionText(conversion?.informationCollection || suggestedConversion.informationCollection,"收集基本需求信息");
  const leadQualification=sanitizeConversionText(conversion?.leadQualification || suggestedConversion.leadQualification,"确认需求与合作条件");
  const diagnosticStep=sanitizeConversionText(conversion?.diagnosticStep || suggestedConversion.diagnosticStep,"安排需求诊断");
  const nextBusinessStep=sanitizeConversionText(conversion?.nextBusinessStep || suggestedConversion.nextBusinessStep,"确认下一步方案");
  const cooperationEntry=sanitizeConversionText(conversion?.cooperationEntry || suggestedConversion.cooperationEntry,"进入正式合作评估");
  const structuredSteps=[entryCTA,contactChannel,handoffOwner,informationCollection,leadQualification,diagnosticStep,nextBusinessStep,cooperationEntry];
  const canonicalConversion={
    entryCTA,
    contactChannel,
    handoffOwner,
    informationCollection,
    leadQualification,
    diagnosticStep,
    nextBusinessStep,
    cooperationEntry,
    primaryPath:{ id:text(object(suggestedConversion.primaryPath).id)||"conversion_primary",steps:steps.length?steps:suggestedSteps.length?suggestedSteps:structuredSteps },
    platformPaths:normalizePlatformConversionPaths(suggestedConversion.platformPaths),
    ctaOptions:normalizeCtaOptions(suggestedConversion.ctaOptions),
    forbiddenConversionMethods:stringList(suggestedConversion.forbiddenConversionMethods)
  };
  const factValue=(fact)=>typeof fact.value==="string"?fact.value:JSON.stringify(fact.value);
  const dynamicContext={
    strategySignals:allFacts.filter(({impact})=>impact==="strategy").map(({fact})=>({factId:fact.id,key:fact.key,value:factValue(fact)})),
    platformSignals:allFacts.filter(({impact})=>impact==="platform").map(({fact})=>({factId:fact.id,key:fact.key,value:factValue(fact),platformScope:fact.platformScope})),
    riskSignals:allFacts.filter(({impact})=>impact==="risk").map(({fact})=>({factId:fact.id,key:fact.key,value:factValue(fact)}))
  };
  const contentContext={
    topicSignals:allFacts.filter(({impact})=>impact==="topic").map(({fact})=>({factId:fact.id,key:fact.key,value:factValue(fact)})),
    supportingFacts:allFacts.filter(({impact})=>impact==="content_only").map(({fact})=>({factId:fact.id,key:fact.key,value:factValue(fact),contentUsage:fact.contentUsage}))
  };
  const strategyDecisions=object(strategyInputBundle?.strategyDecisions);
  const suggestedPortfolio=object(suggestedStrategy.contentSystem?.portfolio);
  const decisionPortfolio=averageDecisionPortfolio(strategyDecisions.accountStrategies);
  const resolvedPortfolio=normalizePortfolio(Object.keys(suggestedPortfolio).length ? suggestedPortfolio : decisionPortfolio);
  const document = {
    schemaVersion: "2.0",
    accountId,
    business: { businessModel, valueProposition, offers },
    strategy: {
      diagnosis: object(suggestedStrategy.diagnosis),
      growthStage: text(byPath.get("accountStrategy.growthStage")?.summary || byPath.get("accountStrategy.growthStage")) || text(suggestedStrategy.growthStage) || "exploration",
      operatingMode: text(suggestedStrategy.operatingMode) || "guided",
      objectives,
      primaryObjectiveId,
      positioning: { category: text(positioning.category) || businessModel, positioningStatement: text(positioning.positioningStatement) || valueProposition, differentiators: stringList(positioning.differentiators), competitorAlternatives: stringList(positioning.competitorAlternatives), notFor: stringList(positioning.notFor) },
      audiences,
      messageArchitecture: { coreMessage: text(suggestedStrategy.messageArchitecture?.coreMessage) || valueProposition, supportingMessages: list(suggestedStrategy.messageArchitecture?.supportingMessages), misconceptionsToCorrect: stringList(suggestedStrategy.messageArchitecture?.misconceptionsToCorrect), phrasesToUse: stringList(suggestedStrategy.messageArchitecture?.phrasesToUse), phrasesToAvoid: stringList(suggestedStrategy.messageArchitecture?.phrasesToAvoid) },
      contentSystem: { pillars, portfolio: resolvedPortfolio },
      platformPlaybooks: {
        xiaohongshu: { ...object(suggestedPlaybooks.xiaohongshu), role: text(suggestedPlaybooks.xiaohongshu?.role || platformRoleClaim.xiaohongshu) || "场景触达与认知建立", priorityAudienceIds: stringList(suggestedPlaybooks.xiaohongshu?.priorityAudienceIds).length ? stringList(suggestedPlaybooks.xiaohongshu?.priorityAudienceIds) : audienceIds, objectivePriorities: stringList(suggestedPlaybooks.xiaohongshu?.objectivePriorities).length ? stringList(suggestedPlaybooks.xiaohongshu?.objectivePriorities) : [primaryObjectiveId], toneDefaults: stringList(suggestedPlaybooks.xiaohongshu?.toneDefaults), promotionDefault: text(suggestedPlaybooks.xiaohongshu?.promotionDefault) || "soft", constraints: stringList(suggestedPlaybooks.xiaohongshu?.constraints) },
        wechat: { ...object(suggestedPlaybooks.wechat), role: text(suggestedPlaybooks.wechat?.role || platformRoleClaim.wechat) || "深度论证与信任沉淀", priorityAudienceIds: stringList(suggestedPlaybooks.wechat?.priorityAudienceIds).length ? stringList(suggestedPlaybooks.wechat?.priorityAudienceIds) : audienceIds, objectivePriorities: stringList(suggestedPlaybooks.wechat?.objectivePriorities).length ? stringList(suggestedPlaybooks.wechat?.objectivePriorities) : [primaryObjectiveId], toneDefaults: stringList(suggestedPlaybooks.wechat?.toneDefaults), promotionDefault: text(suggestedPlaybooks.wechat?.promotionDefault) || "soft", constraints: stringList(suggestedPlaybooks.wechat?.constraints) }
      },
      conversionSystem: canonicalConversion,
      evidencePolicy: { ...object(suggestedStrategy.evidencePolicy), defaultVisibility: text(suggestedStrategy.evidencePolicy?.defaultVisibility) || "internal_only", knowledgeFolderIds: stringList(suggestedStrategy.evidencePolicy?.knowledgeFolderIds || contentResources.knowledgeAssetIds), claimRules: list(suggestedStrategy.evidencePolicy?.claimRules), casePolicy: object(suggestedStrategy.evidencePolicy?.casePolicy) },
      riskPolicy: { ...object(suggestedStrategy.riskPolicy), forbiddenClaims: [...new Set(["不得虚构案例或数据","不得使用未经授权的客户身份信息","不得作出无法验证的绝对化承诺",...constraints, ...stringList(suggestedStrategy.riskPolicy?.forbiddenClaims)])], sensitiveTopics: stringList(suggestedStrategy.riskPolicy?.sensitiveTopics), legalChecks: stringList(suggestedStrategy.riskPolicy?.legalChecks), mandatoryDisclosures: stringList(suggestedStrategy.riskPolicy?.mandatoryDisclosures) },
      dynamicContext,
      operatingPolicy: object(suggestedStrategy.operatingPolicy),
      measurement: object(suggestedStrategy.measurement)
    },
    contentContext,
    strategyExtensions: buildStrategyExtensions({ strategyInputBundle,strategy:{ ...suggestedStrategy,growthStage:text(byPath.get("accountStrategy.growthStage")?.summary || byPath.get("accountStrategy.growthStage")) || text(suggestedStrategy.growthStage) || "exploration",objectives,primaryObjectiveId },business:{businessModel,valueProposition,offers},contentResources,portfolio:resolvedPortfolio,conversionSystem:canonicalConversion }),
    governance: {
      confirmedClaimIds: list(strategyInputBundle?.provenance?.claimIds),
      strategyFactIds: strategyFacts.map((fact) => fact.id).filter(Boolean),
      factApplications,
      profileCoverage: strategyInputBundle?.coverageSnapshot || null,
      knowledgeSourceIds: [...new Set([...list(strategyInputBundle?.provenance?.knowledgeCandidateIds),...list(strategyInputBundle?.provenance?.retrievedKnowledgeEvidenceIds)])],
      factSnapshotId: strategyInputBundle?.provenance?.factSnapshotId || null,
      hypotheses: [...list(suggested.governance?.hypotheses), ...list(strategyInputBundle?.inferredClaims)],
      conflicts: [...list(suggested.governance?.conflicts), ...list(strategyInputBundle?.conflicts)],
      missingInformation: [...new Set([...stringList(suggested.governance?.missingInformation), ...list(strategyInputBundle?.missingInformation),...skippedCoverage])],
      sourceContextHash: strategyInputBundle?.contextHash || "context_unavailable"
    }
  };
  return document;
}

export function validateGeneratedStrategyDocument(document) {
  return validateStrategyDocumentV2(document);
}

const genericOfferPattern=/^(?:主要|核心|优先|我们的|公司)?(?:产品|服务|业务|产品服务|产品与服务|主要产品|主要服务)$/;
const misplacedChannelPattern=/(?:添加|加|联系)?(?:销售)?(?:微信|企微)|平台私信|电话|手机号|咨询表单|扫码|二维码|咨询入口/i;
const companyIntroductionPattern=/(?:是一家|核心业务|主要客户|商业模式|总部位于|公司主要|我们主要)/;
const riskLanguagePattern=/(?:不得|不能|禁止|避免|未经|授权|虚构|来源|审核|保密|脱敏|合规|承诺|敏感|广告法)/;

function semanticError(code,path,message) {
  return {code,path,message,severity:"blocking"};
}

function semanticSourceText(claims,strategyInputBundle) {
  const claimValues=claims.filter((item)=>!["rejected","conflicting","superseded"].includes(item.status)).map((item)=>item.value);
  const facts=Object.values(strategyInputBundle?.dynamicFacts||{}).flat().map((item)=>item.value);
  const decisions=object(strategyInputBundle?.strategyDecisions);
  return JSON.stringify([...claimValues,...facts,decisions]).replace(/\s+/g,"").toLowerCase();
}

function sourceContains(source,value) {
  const normalized=String(value||"").replace(/[\s，,。；;：:、（）()\-_/]/g,"").toLowerCase();
  return normalized.length>=2 && source.includes(normalized);
}

export function validateStrategyDocumentSemantics({ document,claims=[],strategyInputBundle=null,providerMode="" }={}) {
  const errors=[];
  const warnings=[];
  const fallbackUsed=String(providerMode).includes("fallback");
  const offers=list(document?.business?.offers);
  const roles=object(document?.strategy?.platformPlaybooks);
  const pillars=list(document?.strategy?.contentSystem?.pillars);
  const conversion=object(document?.strategy?.conversionSystem);
  const riskClaims=stringList(document?.strategy?.riskPolicy?.forbiddenClaims);
  const source=semanticSourceText(claims,strategyInputBundle);

  for (const [index,offer] of offers.entries()) {
    const name=text(object(offer).name||offer);
    if (!name || genericOfferPattern.test(name) || name.length>48 || companyIntroductionPattern.test(name) || /[。；\n]/.test(name)) {
      errors.push(semanticError("OFFER_NAME_NOT_SEMANTIC",`business.offers[${index}].name`,"产品或服务名称必须是具体业务名称，不能使用“主要产品”等占位词或整段公司介绍"));
    } else if (fallbackUsed && source && !sourceContains(source,name)) {
      errors.push(semanticError("FALLBACK_OFFER_WITHOUT_SOURCE",`business.offers[${index}].name`,`fallback 草案中的“${name}”无法追溯到已确认字段、事实或账号决策`));
    }
  }
  for (const platform of ["xiaohongshu","wechat"]) {
    const role=text(roles[platform]?.role);
    if (!role || misplacedChannelPattern.test(role)) {
      errors.push(semanticError("PLATFORM_ROLE_IS_CONVERSION_CHANNEL",`strategy.platformPlaybooks.${platform}.role`,`${platform==="xiaohongshu"?"小红书":"公众号"}角色必须说明平台承担的内容与受众职能，不能把咨询入口当作平台角色`));
    }
  }
  for (const [index,pillar] of pillars.entries()) {
    const name=text(object(pillar).name||pillar);
    if (!name || /^(?:主要|核心)?(?:内容|内容支柱|行业内容|产品内容)$/.test(name) || name.length>60 || companyIntroductionPattern.test(name)) {
      errors.push(semanticError("CONTENT_PILLAR_NOT_SEMANTIC",`strategy.contentSystem.pillars[${index}].name`,"内容支柱必须是可持续的业务主题，不能是占位词或整段介绍"));
    }
  }
  const conversionSteps=normalizeConversionSteps(object(conversion.primaryPath));
  if (!conversionSteps.length || conversionSteps.some((step)=>step.length>80||companyIntroductionPattern.test(step))) {
    errors.push(semanticError("CONVERSION_PATH_NOT_ACTIONABLE","strategy.conversionSystem.primaryPath","转化路径必须由可执行的行动步骤组成，不能复制公司介绍"));
  }
  if (roles.xiaohongshu?.role===conversion.contactChannel || roles.wechat?.role===conversion.contactChannel) {
    errors.push(semanticError("CONVERSION_CHANNEL_MISPLACED","strategy.conversionSystem.contactChannel","咨询入口与平台角色发生错位"));
  }
  for (const [index,claim] of riskClaims.entries()) {
    if (claim.length>100 || (companyIntroductionPattern.test(claim)&&!riskLanguagePattern.test(claim))) {
      errors.push(semanticError("RISK_POLICY_CONTAINS_BUSINESS_INTRO",`strategy.riskPolicy.forbiddenClaims[${index}]`,"风险规则中混入了公司介绍；这里只能保留明确的禁止、授权、来源或审核规则"));
    }
  }
  if (fallbackUsed) warnings.push({code:"FALLBACK_REQUIRES_REVIEW",message:"本草案使用了确定性 fallback。即使通过语义门禁，也应重点核对产品、平台分工、转化路径和风险边界。"});
  const passed=errors.length===0;
  return {
    schemaVersion:"1.0",
    passed,
    activationAllowed:passed,
    handoffAllowed:passed,
    sourceMode:fallbackUsed?"validated_fallback":"model_or_rule_validated",
    riskLevel:passed?(fallbackUsed?"medium":"low"):"high",
    errors,
    warnings
  };
}

const repairBoundaries = [
  "business.businessModel", "business.valueProposition", "business.offers",
  "strategy.growthStage", "strategy.operatingMode", "strategy.objectives", "strategy.primaryObjectiveId",
  "strategy.positioning", "strategy.audiences", "strategy.messageArchitecture", "strategy.contentSystem",
  "strategy.platformPlaybooks", "strategy.conversionSystem", "strategy.evidencePolicy", "strategy.riskPolicy",
  "strategy.dynamicContext", "strategy.operatingPolicy", "strategy.measurement", "contentContext",
  "strategyExtensions", "governance"
];

function pathValue(target, path) {
  return path.split(".").reduce((value, key) => value?.[key], target);
}

function assignPath(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((item, key) => item[key] ||= {}, target);
  parent[last] = structuredClone(value);
}

export function repairGeneratedStrategyDocument({ candidate, fallback }) {
  const initial = validateGeneratedStrategyDocument(candidate);
  if (initial.valid) return { document: candidate, validation: initial, repairTrace: [], mode: "none" };
  const repaired = structuredClone(candidate);
  const boundaries = [...new Set(initial.errors.map((error) => repairBoundaries.find((boundary) => error.path === boundary || error.path.startsWith(`${boundary}.`))).filter(Boolean))];
  const repairTrace = [];
  for (const boundary of boundaries) {
    assignPath(repaired, boundary, pathValue(fallback, boundary));
    repairTrace.push({ path: boundary, action: "replace_invalid_field", source: "deterministic_fallback" });
  }
  repaired.governance ||= structuredClone(fallback.governance);
  repaired.governance.repairTrace = repairTrace;
  const repairedValidation = validateGeneratedStrategyDocument(repaired);
  if (repairedValidation.valid) return { document: repaired, validation: repairedValidation, repairTrace, mode: "field_repairs" };
  const safeFallback = structuredClone(fallback);
  const fallbackTrace = [...repairTrace, { path: "$", action: "replace_unrecoverable_document", source: "deterministic_fallback", remainingErrors: repairedValidation.errors }];
  safeFallback.governance.repairTrace = fallbackTrace;
  return { document: safeFallback, validation: validateGeneratedStrategyDocument(safeFallback), repairTrace: fallbackTrace, mode: "validated_fallback" };
}
