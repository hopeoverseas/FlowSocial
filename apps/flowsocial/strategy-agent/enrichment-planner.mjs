import { dynamicFactSpecs } from "./profile-coverage-registry.mjs";

export const enrichmentQuestionDefinitions = dynamicFactSpecs.map((spec)=>({ targetFactKey:spec.targetFactKey, category:spec.id, content:spec.question, expectedAnswerType:"profile_detail", priority:spec.priority }));

const alwaysRelevant = new Set(["audience_insight","brand_expression","operating_capacity","compliance_risk"]);
const explicitDecisionCategories = new Set(["account_identity", "account_portfolio", "growth_strategy"]);

function claimValue(claims, fieldPath) {
  return claims.find((claim)=>claim.fieldPath===fieldPath && !["rejected","conflicting"].includes(claim.status))?.value;
}

function semanticRevisionFromCoverage(coverage, claim = null, prefix = "context") {
  const assessment=coverage?.assessment || {};
  if (assessment.semanticContextRevision) return String(assessment.semanticContextRevision);
  if (assessment.contextInvalidationId) return `invalidated:${assessment.contextInvalidationId}`;
  const resourceId=assessment.candidateId || assessment.fileId || claim?.value?.knowledgeAssetIds?.slice?.().sort?.().join(",");
  if (resourceId) return `${prefix}:${resourceId}`;
  if (assessment.resolution === "none_declared" || claim?.value?.none === true) return `${prefix}:none`;
  return "baseline";
}

function normalizeQuestionContextRevision(question) {
  const semantic=question?.relevance?.semanticContextRevision;
  if (semantic) return String(semantic);
  const legacy=String(question?.relevance?.contextRevision || "");
  if (!legacy || legacy === "legacy" || /^\d{4}-\d\d-\d\dT/.test(legacy)) return "baseline";
  return legacy;
}

function enrichmentRelevance(spec, claims = [], facts = []) {
  const resourceValue = claimValue(claims,"accountStrategy.contentResources");
  const resourcesDeclaredNone = resourceValue?.none === true || resourceValue?.status === "none_declared";
  const constraintsAlreadyKnown = claimValue(claims,"accountStrategy.constraints") != null;
  const goal = JSON.stringify(claimValue(claims,"accountStrategy.primaryGoal") || "");
  const stage = JSON.stringify(claimValue(claims,"accountStrategy.growthStage") || "");
  const resources = JSON.stringify(claimValue(claims,"accountStrategy.contentResources") || "");
  const platformRoles = JSON.stringify(claimValue(claims,"accountStrategy.platformRoles") || "");
  const factsText = JSON.stringify(facts.map((fact)=>fact.value));
  const commercial = /咨询|线索|获客|转化|成交|推广|产品|服务|私域|销售/.test(goal);
  const authority = /信任|专业|干货|观点|教育|认知/.test(goal);
  const reach = /流量|曝光|触达|涨粉|热点|行业影响力/.test(goal);
  const hasXhs = /小红书|xiaohongshu|xhs/i.test(platformRoles);
  const hasWechat = /公众号|微信|wechat/i.test(platformRoles);
  const matrixSignal = /矩阵|多个账号|双账号|多账号|官方号.{0,12}(创始人|专家|产品)|创始人.{0,12}(官方号|专家|产品)/.test(`${platformRoles}${factsText}`);
  const rules = {
    account_portfolio: [matrixSignal,"用于决定单账号还是角色协同矩阵，以及账号之间的内容和转化归属",["矩阵决策","账号分工","重复边界"]],
    xiaohongshu_infrastructure: [hasXhs,"用于确定小红书账号模式、图文产能、正式承接和主要指标",["小红书账号策略","视觉产能","转化承接"]],
    wechat_infrastructure: [hasWechat,"用于确定公众号账号模式、栏目、发现入口和关注后承接",["公众号账号策略","栏目与菜单","关系承接"]],
    platform_operation: [hasXhs || hasWechat,"用于定义实际启用平台的内容与协同规则",["平台执行规则","跨平台复用"]],
    purchase_decision: [commercial,"用于决定面向谁解释采购顾虑，以及哪些内容适合承接线索",["受众优先级","转化内容角度","销售异议内容"]],
    conversion_sales: [commercial,"用于把账号内容与真实咨询承接连接起来",["CTA边界","线索承接","转化型内容"]],
    offer_detail: [commercial,"用于生成准确的产品教育与服务场景内容",["产品内容边界","适用场景","方案型选题"]],
    customer_scenario: [commercial || /案例|场景/.test(resources),"用于把抽象服务转成可理解的客户场景",["小红书场景表达","公众号案例论证"]],
    case_evidence: [!resourcesDeclaredNone && (/案例|数据|成果|customer_case/.test(resources) || /案例|成果|证明/.test(goal)),"用于判断能否安全生成案例与证明类内容",["案例选题","证据等级","公开边界"]],
    expert_knowledge: [/SOP|流程|经验|方法|问答|faq/i.test(resources) || authority,"用于识别可持续输出的专业方法与干货",["内容支柱","干货选题","知识检索"]],
    market_context: [reach || /市场|竞品|趋势|政策/.test(factsText),"用于确定热点和行业解读的监测范围",["热点方向","行业解读","选题时效"]],
    business_calendar: [/活动|发布|直播|课程|报告|招聘|促销/.test(factsText),"用于安排有明确截止时间的传播任务",["阶段运营计划","活动内容"]],
    performance_learning: [!/起号|新建|account_setup/.test(stage),"用于让后续策略从历史表现中学习",["内容组合调整","标题与结构复盘"]]
  };
  if (spec.id === "case_evidence" && resourcesDeclaredNone) return { ask:false,tier:"conditional",reason:"用户已明确当前没有可用材料，不再追问案例和公开权限",downstreamUse:[] };
  if (spec.id === "compliance_risk" && resourcesDeclaredNone && constraintsAlreadyKnown) return { ask:false,tier:"conditional",reason:"用户已说明当前没有材料，且核心内容安全规则已有结论，不重复追问案例、数据和公开权限",downstreamUse:[] };
  if (alwaysRelevant.has(spec.id)) return { ask:true,tier:"required",reason:"当前策略与内容执行需要的长期运营信息",downstreamUse:{ account_identity:["账号身份","信任模型","矩阵角色"],growth_strategy:["增长方法选择","热点边界","实验退出条件"],audience_insight:["选题问题","内容语言"],brand_expression:["账号语气","品牌一致性"],operating_capacity:["可执行节奏","审核边界"],compliance_risk:["事实与发布风险"] }[spec.id] || [] };
  const [ask=false,reason="当前目标下不是必要信息",downstreamUse=[]] = rules[spec.id] || [];
  return { ask:Boolean(ask),tier:"conditional",reason,downstreamUse };
}

export function planNextEnrichmentQuestion({ facts = [], claims = [], previousQuestions = [], coverageStates = [], preferredCategory = null } = {}) {
  const coverageMap = new Map(coverageStates.filter((x)=>x.targetType === "dynamic_fact").map((x)=>[x.targetId,x]));
  const coreCoverageMap = new Map(coverageStates.filter((x)=>x.targetType === "core_field").map((x)=>[x.targetId,x]));
  const resolvedCoreSlot = (fieldPath,slotId) => {
    const coverage=coreCoverageMap.get(fieldPath);
    return Boolean(coverage?.capturedSlots?.some((item)=>item.slot===slotId) || coverage?.skippedSlots?.includes(slotId));
  };
  const coveredByCoreLedger = (category,slotId) => {
    const mappings = {
      case_evidence:{
        authorization:["accountStrategy.contentResources","publicUsage"],
        anonymization:["accountStrategy.contentResources","publicUsage"]
      },
      compliance_risk:{
        clientIdentity:["accountStrategy.constraints","confidentialInformation"],
        projectDetails:["accountStrategy.constraints","confidentialInformation"],
        internalProcess:["accountStrategy.constraints","confidentialInformation"],
        productInfo:["accountStrategy.constraints","confidentialInformation"],
        employeeInfo:["accountStrategy.constraints","confidentialInformation"],
        absoluteClaims:["accountStrategy.constraints","forbiddenClaims"],
        reviewOwner:["accountStrategy.constraints","mandatoryReviewRules"]
      }
    };
    const target=mappings[category]?.[slotId];
    return target ? resolvedCoreSlot(target[0],target[1]) : false;
  };
  const relatedCoreRevision = (category) => {
    const fieldPaths=category==="case_evidence"
      ? ["accountStrategy.contentResources"]
      : category==="compliance_risk"
        ? ["accountStrategy.contentResources","accountStrategy.constraints"]
        : [];
    const revisions=fieldPaths.map((fieldPath)=>{
      const claim=claims.find((item)=>item.fieldPath===fieldPath);
      return semanticRevisionFromCoverage(coreCoverageMap.get(fieldPath),claim,fieldPath);
    }).filter((revision)=>revision!=="baseline");
    return revisions.length ? revisions.join("|") : "baseline";
  };
  const previousByKey = new Map();
  const askedLedgerKeys = new Set();
  for (const q of previousQuestions) {
    previousByKey.set(q.targetFactKey,Math.max(previousByKey.get(q.targetFactKey)||0,q.attempt||1));
    const slots=q.relevance?.targetSlotIds || [];
    const contextRevision=normalizeQuestionContextRevision(q);
    for (const slotId of slots) askedLedgerKeys.add(`${q.category || q.targetId}:${slotId}:${contextRevision}`);
  }
  const relevantSpecs = dynamicFactSpecs
    .filter((spec) => !explicitDecisionCategories.has(spec.id))
    .map((spec)=>({spec,relevance:enrichmentRelevance(spec,claims,facts)}))
    .filter((item)=>item.relevance.ask)
    .sort((left,right)=>{
      const leftCoverage=coverageMap.get(left.spec.id) || coverageMap.get(left.spec.targetFactKey);
      const rightCoverage=coverageMap.get(right.spec.id) || coverageMap.get(right.spec.targetFactKey);
      const leftStarted=Boolean(leftCoverage && !leftCoverage.strategyReady && !["skipped","not_applicable"].includes(leftCoverage.status));
      const rightStarted=Boolean(rightCoverage && !rightCoverage.strategyReady && !["skipped","not_applicable"].includes(rightCoverage.status));
      if (leftStarted!==rightStarted) return Number(rightStarted)-Number(leftStarted);
      return Number(left.relevance.tier!=="required")-Number(right.relevance.tier!=="required");
    });
  const candidates = preferredCategory
    ? [...relevantSpecs.filter((x)=>x.spec.id===preferredCategory),...relevantSpecs.filter((x)=>x.spec.id!==preferredCategory)]
    : relevantSpecs;
  for (const candidate of candidates) {
    const { spec,relevance } = candidate;
    const coverage=coverageMap.get(spec.id) || coverageMap.get(spec.targetFactKey);
    if (coverage?.strategyReady || ["skipped","not_applicable"].includes(coverage?.status)) continue;
    const dynamicRevision=semanticRevisionFromCoverage(coverage,null,spec.id);
    const coreRevision=relatedCoreRevision(spec.id);
    const semanticRevisions=[dynamicRevision,coreRevision].filter((revision)=>revision&&revision!=="baseline");
    const contextRevision=semanticRevisions.length ? semanticRevisions.join("|") : "baseline";
    const attempt=(previousByKey.get(spec.targetFactKey)||0)+1;
    const missing=(coverage?.missingRequiredSlots || spec.slots.filter((x)=>x.required).map((x)=>x.id))
      .filter((slotId)=>!coveredByCoreLedger(spec.id,slotId))
      .filter((slotId)=>!askedLedgerKeys.has(`${spec.id}:${slotId}:${contextRevision}`))
      .slice(0,3);
    if (!missing.length) continue;
    const labels=missing.map((id)=>spec.slots.find((x)=>x.id===id)?.label || id);
    const content=coverage && attempt>1
      ? `关于“${spec.label}”，刚才的信息已记录。为了让后续选题和内容不需要猜测，还需要补充：${labels.join("、")}。请按真实情况说明；不适用或暂时不想回答可以直接跳过。`
      : spec.question;
    return { targetFactKey:spec.targetFactKey,category:spec.id,content,expectedAnswerType:"profile_detail",attempt,priority:spec.priority,targetType:"dynamic_fact",targetId:spec.id,relevance:{...relevance,questionGoal:spec.label,targetSlotIds:missing,contextRevision,semanticContextRevision:contextRevision,ledgerKey:`${spec.id}:${missing.join(",")}:${contextRevision}`} };
  }
  return null;
}

export function enrichmentCompletionMessage() {
  return "动态画像的计划项已经逐项处理完成。已确认的信息会进入策略、选题和内容上下文；跳过项不会被模型猜测。你可以生成或更新策略草案，也可以随时修改任一字段。";
}

export function enrichmentStartMessage(question) {
  return `九项策略骨架已经完成。接下来会继续补充受众洞察、品牌表达、运营产能、合规风险和平台执行条件等高价值事实。账号身份、单账号或矩阵选择、增长打法将在独立的策略决策步骤中由你确认，不会在这里重复追问。系统只追问与当前账号运营决策相关的信息；每类信息会追问到足够使用，或由你选择跳过当前问题。\n\n${question.content}`;
}
