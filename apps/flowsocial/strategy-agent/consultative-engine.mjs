import { questionDefinitions } from "./question-planner.mjs";
import { humanizeStrategyValue } from "./strategy-presentation.mjs";

const assistanceIntentMap = {
  request_clarification: "clarification",
  request_examples: "examples",
  request_checklist: "checklist",
  request_recommendation: "recommendation",
  compare_options: "comparison"
};

export const assistanceIntents = new Set(Object.keys(assistanceIntentMap));

const normalizedAnswer = (message = "") => String(message).trim().replace(/[。！!]+$/g, "");
const noMaterialAnswer = /^(?:目前|现在|暂时|现阶段)?(?:没有|暂无|还没有).*(?:资料|材料|资源)$/;
const noCaseAnswer = /^(?:目前|现在|暂时|现阶段)?(?:没有|暂无|还没有).*(?:案例|案例和数据)$/;
const genericNegativeAnswer = /^(?:(?:目前|现在|暂时|现阶段)?(?:没有|暂无|还没有)(?:(?:额外的?|其他|特别的?)?(?:规定|限制|要求|规则|内容|信息|说法|这项)?|.{1,12}(?:规定|限制|要求|规则|内容|信息|说法))|不适用|没有这项|这项没有)$/;

function questionTarget(pendingQuestion = null) {
  const targetType = pendingQuestion?.targetFactKey ? "dynamic_fact" : "core_field";
  const targetId = targetType === "dynamic_fact"
    ? pendingQuestion?.category || pendingQuestion?.targetId || ""
    : pendingQuestion?.targetFieldPaths?.[0] || pendingQuestion?.targetId || "";
  const targetSlotIds = pendingQuestion?.targetSlotIds?.length
    ? pendingQuestion.targetSlotIds
    : pendingQuestion?.relevance?.targetSlotIds || [];
  return { targetType, targetId, targetSlotIds };
}

export function resolveQuestionAnswerDisposition(message = "", { pendingQuestion = null, intent = "" } = {}) {
  const text = normalizedAnswer(message);
  const target = questionTarget(pendingQuestion);
  if (!pendingQuestion) return { kind:"ordinary_answer", ...target, intent:intent || "add_context", suppressExtraction:false };
  if (target.targetId === "accountStrategy.contentResources" && (noMaterialAnswer.test(text) || /^(没有|暂无|目前没有|还没有)$/.test(text))) {
    return {
      kind:"none_declared",
      ...target,
      intent:"direct_answer",
      suppressExtraction:true,
      closeWholeTarget:true,
      coverageStatus:"not_applicable",
      claimValue:{ none:true,status:"none_declared",summary:"目前没有可用于内容创作的材料" }
    };
  }
  if (target.targetId === "case_evidence" && (noCaseAnswer.test(text) || /^(没有|暂无|目前没有|还没有)$/.test(text))) {
    return { kind:"none_declared",...target,intent:"direct_answer",suppressExtraction:true,closeWholeTarget:true,coverageStatus:"not_applicable" };
  }
  if (intent === "skip_field") {
    return { kind:"field_skipped",...target,intent:"skip_field",suppressExtraction:true,closeWholeTarget:true,coverageStatus:"skipped" };
  }
  if (["skip_question","temporarily_unknown","cannot_answer"].includes(intent) || genericNegativeAnswer.test(text)) {
    return {
      kind:genericNegativeAnswer.test(text) ? "explicit_negative" : intent,
      ...target,
      intent:"direct_answer",
      suppressExtraction:true,
      closeWholeTarget:false,
      skippedSlotIds:target.targetSlotIds,
      coverageStatus:"partial"
    };
  }
  return { kind:"ordinary_answer",...target,intent:intent || "direct_answer",suppressExtraction:false };
}

export function classifyIntentDeterministically(message = "", { pendingQuestion = null, pendingRecommendation = null, intentOverride = "" } = {}) {
  if (intentOverride) return { intent: intentOverride, confidence: 1, source: "ui_override" };
  const text = String(message).trim();
  if (pendingRecommendation && /^(可以|好的|好|行|就这样|采用|采纳|按这个|用这个|同意)[吧。！!]*$/.test(text)) return { intent: "adopt_recommendation", confidence: 0.98, source: "deterministic" };
  if (pendingRecommendation && /(采纳|采用|就用|按这个|按你说的|这个方案可以)/.test(text) && !/(不|别|暂不|再想想)/.test(text)) return { intent: "adopt_recommendation", confidence: 0.96, source: "deterministic" };
  if (pendingRecommendation && /(调整|修改|改成|换成|但是|不过)/.test(text)) return { intent: "modify_recommendation", confidence: 0.9, source: "deterministic" };
  if (pendingRecommendation && /(不采用|不采纳|不合适|都不适合|换一个)/.test(text)) return { intent: "reject_recommendation", confidence: 0.96, source: "deterministic" };
  if (/(列.*清单|清单.*对照|对照.*清单|盘点表)/.test(text)) return { intent: "request_checklist", confidence: 0.98, source: "deterministic" };
  if (/(举.*例|例子|示例)/.test(text)) return { intent: "request_examples", confidence: 0.96, source: "deterministic" };
  if (/(有什么建议|给.*建议|怎么设置|怎么选|推荐.*方案|你建议)/.test(text)) return { intent: "request_recommendation", confidence: 0.97, source: "deterministic" };
  if (/(区别|对比|比较.*方案|哪个好)/.test(text)) return { intent: "compare_options", confidence: 0.9, source: "deterministic" };
  if (/(什么意思|不理解|解释一下|说具体点|没听懂)/.test(text)) return { intent: "request_clarification", confidence: 0.96, source: "deterministic" };
  if (/^(跳过整个字段|整个字段跳过|这项都跳过|不处理这个字段)$/.test(text)) return { intent: "skip_field", confidence: 0.99, source: "deterministic" };
  if (/^(暂时跳过|先跳过|跳过|跳过这个问题|不回答)$/.test(text)) return { intent: "skip_question", confidence: 0.99, source: "deterministic" };
  if (/(暂时不清楚|暂时不知道|以后再补|稍后补充)/.test(text) && !/[？?]|建议|清单|例/.test(text)) return { intent: "temporarily_unknown", confidence: 0.92, source: "deterministic" };
  if (genericNegativeAnswer.test(normalizedAnswer(text)) || noMaterialAnswer.test(normalizedAnswer(text)) || noCaseAnswer.test(normalizedAnswer(text))) {
    const target = pendingQuestion?.targetFieldPaths?.[0] || "";
    if (["accountStrategy.contentResources", "accountStrategy.constraints"].includes(target)) return { intent: "direct_answer", confidence: 0.99, source: "field_semantic_negative" };
    return { intent: "cannot_answer", confidence: 0.92, source: "deterministic" };
  }
  if (/(之前说错|更正|纠正|不是.*而是)/.test(text)) return { intent: "correct_previous", confidence: 0.86, source: "deterministic" };
  return { intent: pendingQuestion ? "direct_answer" : "add_context", confidence: pendingQuestion ? 0.9 : 0.65, source: "deterministic" };
}

function companyContext(claims = []) {
  const get = (path) => claims.find((item) => item.fieldPath === path)?.value;
  return {
    offers: get("business.primaryOffers") || [],
    audience: get("audiences.primary") || [],
    goal: get("accountStrategy.primaryGoal") || "",
    platformRoles: get("accountStrategy.platformRoles") || {}
  };
}

const fieldCoach = {
  "business.primaryOffers": {
    explanation: "这个问题想确认账号优先围绕哪些产品或服务展开，而不是要求你罗列公司的全部业务。它决定后续选题会集中解决什么问题、内容里自然带出什么价值，以及用户最终可以咨询什么。你可以回答核心产品、重点服务和当前最想推广的一项。",
    examples: ["我们优先推广企业知识库和帮助中心，暂时不重点宣传其他产品。", "主要推广知识库咨询、实施和内容迁移服务。", "先以AI智能搜索为切入口，再带出完整的数字内容体验平台。"],
    checklist: ["核心产品名称", "重点服务名称", "当前最想推广的项目", "暂时不宣传的业务", "最常解决的客户问题"]
  },
  "business.businessModel": {
    explanation: "这个问题是在确认客户如何购买以及你们如何交付。相同产品如果是订阅、项目制或订阅加实施服务，内容中的价格预期、决策周期和转化方式都会不同。你可以说明主要收费方式、交付周期，以及是否包含咨询、部署或持续服务。",
    examples: ["以年度SaaS订阅为主，另收实施和内容迁移服务费。", "主要按项目报价，完成诊断、建设和交付。", "标准版按年订阅，大客户采用私有化部署和项目制交付。"],
    checklist: ["订阅或项目制", "收费周期", "是否私有化部署", "是否包含实施", "是否有持续服务"]
  },
  "audiences.primary": {
    explanation: "这个问题不是泛泛地问所有潜在客户，而是要找出内容最应该优先说服的那一群人。行业决定内容场景，公司阶段决定需求紧迫度，职位决定对方关心的是成本、效率、客户体验还是技术风险。小红书需要用他们熟悉的场景吸引注意，公众号则需要针对决策顾虑深入论证。你可以从行业、公司阶段、使用者和最终决策人四个角度回答。",
    examples: ["优先影响SaaS和科技行业的成长期公司，主要决策人是客户成功VP。", "先面向有大量产品文档的中大型企业，使用者是内容运营，决策者是数字化负责人。", "优先面向正在建设帮助中心的出海企业，影响客户成功负责人和海外市场负责人。"],
    checklist: ["客户所属行业", "公司阶段或规模", "主要使用者职位", "核心决策人职位", "最迫切的问题", "触发采购的事件"]
  },
  "business.conversionPath": {
    explanation: "这个问题是在确认用户看完内容后，怎样从关注变成真实商机。它会影响文章结尾应该引导私信、添加企业微信、预约演示还是领取资料，也决定后续怎样筛选和跟进线索。你可以按‘看到内容—采取动作—进入承接渠道—沟通或成交’来回答。",
    examples: ["用户看完后私信领取清单，再添加企业微信预约产品演示。", "公众号文章引导填写官网表单，由销售联系并安排需求诊断。", "小红书负责引导私信，公众号承接深度案例，最后预约方案沟通。"],
    checklist: ["内容触达入口", "第一步行动", "承接渠道", "资料或权益", "筛选方式", "销售沟通节点"]
  },
  "accountStrategy.primaryGoal": {
    explanation: "这个问题想确定未来一段时间内容运营最优先服务什么商业结果。流量、专业信任、产品推广和有效咨询都可以同时存在，但需要一个主目标决定选题比例和评价标准。你可以说明未来三个月最希望增加什么，以及什么结果算成功。",
    examples: ["优先获得更多企业客户咨询，同时建立知识库领域的专业认知。", "先完成起号和稳定更新，积累第一批精准关注者。", "重点推广私有化部署服务，并引导目标客户预约演示。"],
    checklist: ["未来三个月主目标", "期望客户动作", "是否强调流量", "是否强调咨询", "是否推广具体产品", "衡量成功的指标"]
  },
  "accountStrategy.growthStage": {
    explanation: "这个问题是为了判断账号现在需要从零验证方向、稳定放大有效内容，还是重新调整定位。不同阶段的选题密度、更新频率和试错方式不同。你可以说明账号是否新建、是否有稳定内容、是否已经出现过有效选题。",
    examples: ["账号刚新建，目前处于起号和验证内容方向阶段。", "已经稳定更新半年，需要放大能够带来咨询的内容。", "原来主要发公司新闻，现在准备转向行业专业内容。"],
    checklist: ["账号创建时间", "当前更新频率", "是否有稳定方向", "是否出现有效内容", "是否准备调整定位"]
  },
  "accountStrategy.platformRoles": {
    explanation: "这个问题不是让两个平台只能发一种内容，而是确认它们在同一条获客链路中的主要分工。小红书更适合用具体场景、问题、清单和视觉化表达触达陌生用户；公众号更适合用长文、案例和方法论建立深度信任。你可以从首次触达、专业解释、私域承接和转化四个角度说明两个平台分别更偏向什么。",
    examples: ["小红书负责用场景干货触达新用户，公众号负责系统讲解和案例沉淀。", "小红书重点做品牌认知和搜索曝光，公众号承接活动、报告和销售线索。", "两个平台都发干货，但小红书更轻量，公众号负责完整方法论和转化。"],
    checklist: ["小红书是否负责首次触达", "小红书是否强调收藏搜索", "公众号是否负责深度解释", "公众号是否承接私域", "两个平台如何复用内容", "最终转化入口"]
  },
  "accountStrategy.contentResources": {
    explanation: "这个问题是在盘点哪些真实业务材料能成为内容依据。资源越具体，后续文章越不容易空泛，也越能避免虚构案例和数据。你不需要已经整理成文章，只要说明现有产品资料、客户问题、案例、SOP、数据或业务经验即可。",
    examples: ["有产品介绍、实施SOP和三个客户案例，案例名称不能公开。", "暂时没有成体系资料，但销售团队积累了很多客户高频问题。", "有帮助中心、白皮书和产品演示截图，可以用于内容创作。"],
    checklist: []
  },
  "accountStrategy.constraints": {
    explanation: "这个问题是在确认发布内容时要遵守的安全规则，避免泄露客户信息、夸大效果或使用不合规说法。你可以用日常语言说明：什么不能公开、什么不能保证、什么发布前要找人审核。如果公司目前没有额外规定，也可以直接说明。",
    examples: ["不能公开客户名称，项目数据只能脱敏，也不能承诺一定提升转化率。", "医疗客户案例需要法务确认，不能使用绝对化效果表达。", "目前没有额外限制，但所有数据必须有来源，不能虚构案例。"],
    checklist: []
  }
};

const checklistByField = {
  "accountStrategy.contentResources": [
    "产品与服务资料：产品介绍、方案、报价说明、实施流程、常见问题",
    "客户案例：客户背景、问题、解决过程、成果和反馈",
    "数据与成果：效率、成本、咨询量、交付周期等可验证数据",
    "方法与SOP：销售、客服、交付、培训或检查清单",
    "专业经验：高频问题、常见误区、选型建议和避坑经验",
    "公司与品牌资料：公司简介、团队故事、品牌理念和企业动态",
    "图片与视频素材：产品图、项目截图、工作现场、团队照片和演示视频",
    "公开边界：可公开、仅可脱敏以及完全不能使用的资料"
  ],
  "business.conversionPath": ["内容触达入口", "用户采取的第一步动作", "承接渠道", "线索筛选方式", "销售沟通节点", "成交或签约步骤"],
  "audiences.primary": ["客户所属行业", "公司规模或类型", "主要决策人职位", "使用者职位", "最常见问题", "购买决策触发点"],
  "accountStrategy.constraints": ["哪些客户或项目信息不能公开", "哪些效果不能承诺或保证", "数据引用需要注明什么", "哪些内容发布前需要审核", "哪些说法需要避免"]
};

for (const [fieldPath, coach] of Object.entries(fieldCoach)) {
  if (!coach.checklist?.length && checklistByField[fieldPath]) coach.checklist = checklistByField[fieldPath];
}

function recommendationForField(fieldPath, context) {
  if (fieldPath === "business.primaryOffers") return { recommendedValue: context.offers?.length ? context.offers : ["先选择最能代表核心价值、最容易用内容讲清的一项产品或服务"], rationale: ["集中一个主线更容易形成稳定认知", "其他产品仍可作为场景或案例自然带出"], alternatives: ["按客户痛点组织产品线", "按交付阶段组织服务"] };
  if (fieldPath === "business.businessModel") return { recommendedValue: "如果同时包含标准产品和企业交付，可先按‘标准订阅/产品费用 + 实施或定制服务’的混合模式表达，并由你确认实际收费方式", rationale: ["能够同时解释标准能力和大客户交付", "不会把行业词误当成商业模式"], alternatives: ["纯SaaS订阅", "纯项目制交付"] };
  if (fieldPath === "audiences.primary") return { recommendedValue: { industries: ["与现有产品场景最匹配的企业服务、SaaS或科技行业"], companyStages: ["已有一定内容和客户服务规模的成长期企业"], decisionMakers: ["客户成功负责人", "数字化或内容运营负责人"] }, rationale: ["这些角色直接承担知识交付、客户教育和体验一致性问题", `与${Array.isArray(context.offers) ? context.offers.join("、") : context.offers || "当前产品服务"}更容易形成明确内容场景`], alternatives: [{ decisionMakers: ["市场负责人", "IT负责人"] }] };
  if (fieldPath === "business.conversionPath") return {
    recommendedValue: "内容触达 → 私信或添加企业微信 → 领取诊断清单/脱敏案例 → 初步需求诊断 → 预约方案沟通 → 确认项目范围 → 签约交付",
    rationale: ["企业服务决策周期较长，需要先建立信任", "资料领取可以降低咨询门槛", "需求诊断有助于筛选有效客户"],
    alternatives: ["内容触达 → 预约直播/课程 → 企业微信承接 → 咨询", "内容触达 → 官网表单 → 销售跟进 → 方案沟通"]
  };
  if (fieldPath === "accountStrategy.platformRoles") return {
    recommendedValue: { xiaohongshu: "用具体场景、问题和清单完成首次触达与收藏", wechat: "用系统文章、案例和方法论建立深度信任并承接咨询" },
    rationale: ["小红书更适合轻量场景触达", "公众号适合完整论证和长期沉淀"],
    alternatives: [{ xiaohongshu: "品牌曝光", wechat: "活动与客户运营" }]
  };
  if (fieldPath === "accountStrategy.primaryGoal") return {
    recommendedValue: "优先建立专业信任并获得有效咨询，同时沉淀可复用的行业内容资产",
    rationale: ["兼顾短期线索与长期品牌资产", "适合专业服务型业务"],
    alternatives: ["优先扩大行业曝光", "优先沉淀私域用户", "优先推广具体产品服务"]
  };
  if (fieldPath === "accountStrategy.contentResources") return {
    recommendedValue: { summary: "先从产品资料、高频客户问题、项目SOP和可脱敏案例开始建立内容资源库", publicUsage: "needs_confirmation" },
    rationale: ["这些资料最接近真实业务", "更容易转化为干货、案例和观点内容"],
    alternatives: ["先整理10个客户高频问题", "先整理3个可脱敏案例"]
  };
  if (fieldPath === "accountStrategy.growthStage") return {
    recommendedValue: "account_setup",
    rationale: ["当内容方向和更新节奏尚未稳定时，先按起号阶段规划更稳妥"],
    alternatives: ["stable_operation", "transformation"]
  };
  if (fieldPath === "accountStrategy.constraints") return { recommendedValue: ["不公开未经授权的客户名称", "不虚构案例和效果数据", "不使用保证、一定、百分百等绝对承诺", "敏感数据需要脱敏或标注来源"], rationale: ["这是企业内容最基本的可信度和合规边界", "后续可以根据行业要求继续补充"], alternatives: ["所有案例发布前人工审核"] };
  return {
    recommendedValue: `围绕${context.goal || "当前业务目标"}先采用可验证、可调整的基础方案`,
    rationale: ["当前信息仍有限，先形成可验证假设，再根据内容反馈迭代"],
    alternatives: []
  };
}

export function buildAssistanceFallback({ intent, fieldPath, claims = [] }) {
  const definition = questionDefinitions[fieldPath] || {};
  const context = companyContext(claims);
  const coach = fieldCoach[fieldPath] || { explanation: `这个问题用于确认${definition.goal || fieldPath}，它会影响后续策略和内容生成。`, examples: [], checklist: [] };
  if (intent === "request_clarification") return {
    assistanceType: "clarification",
    targetFieldPath: fieldPath,
    assistantMessage: `${coach.explanation}\n\n你不需要使用专业术语，按照当前真实情况回答即可。`
  };
  if (intent === "request_examples") return {
    assistanceType: "examples",
    targetFieldPath: fieldPath,
    examples: coach.examples,
    assistantMessage: `可以。下面是回答格式示例，不代表我已经认定这是你们公司的真实情况：\n${coach.examples.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n你可以选择最接近的一种，再按实际情况修改。`
  };
  if (intent === "request_checklist") {
    const items = coach.checklist?.length ? coach.checklist : checklistByField[fieldPath] || ["当前实际做法", "已有资料或资源", "希望达到的结果", "不能接受的边界", "暂时不确定的部分"];
    return { assistanceType: "checklist", targetFieldPath: fieldPath, checklist: items, assistantMessage: `可以，你可以对照下面的清单回答，不需要全部具备：\n${items.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n挑你现在确定的部分告诉我就可以。` };
  }
  const recommendation = recommendationForField(fieldPath, context);
  return {
    assistanceType: "recommendation",
    recommendation,
    assistantMessage: `可以。结合目前已经确认的业务信息，我建议先采用下面这版：\n\n${humanizeStrategyValue(recommendation.recommendedValue)}\n\n${recommendation.rationale.map((item) => `- ${item}`).join("\n")}\n\n你可以采纳，或者告诉我希望怎么调整。`
  };
}

export function buildAssistanceRequest({ intent, fieldPath, claims = [], facts = [], turns = [], knowledgeEvidence = [], pendingQuestion, allowExternalResearch = false }) {
  const coach = fieldCoach[fieldPath] || {};
  const relevantTurns=turns.filter((turn)=>turn.role==="user"||turn.role==="assistant").slice(-12).map((turn)=>({role:turn.role,content:turn.content,createdAt:turn.createdAt||null}));
  return {
    task: "provide_diagnostic_assistance",
    contract: "DiagnosticAssistanceResult@2.0",
    intent,
    targetFieldPath: fieldPath,
    pendingQuestion,
    currentClaims: claims,
    relevantFacts: facts.slice(-20),
    relevantConversationTurns: relevantTurns,
    knowledgeEvidence: knowledgeEvidence.filter((item)=>item.status==="confirmed").slice(-12),
    externalResearchPolicy: { allowed:Boolean(allowExternalResearch),mode:allowExternalResearch?"evidence_snapshot_only":"disabled",rules:["外部信息只能作为建议依据，不能覆盖用户确认事实","必须记录来源、检索时间和有效期","涉及公司内部做法时不得依靠外部推断"] },
    fieldCoach: coach,
    rules: ["使用自然、顾问式中文", "必须具体回应pendingQuestion和targetFieldPath", "解释要说明问题含义、策略影响、双平台影响和回答维度", "例子必须结合当前业务且明确只是示例", "优先使用已确认字段、动态事实和相关历史对话", "不得把外部行业惯例或模型推断写成公司事实", "建议必须标记为建议而不是事实", "一次给出一个推荐方案和最多两个备选", "明确邀请用户采纳、调整或拒绝"],
    outputSchema: { assistantMessage: "", assistanceType: "clarification | examples | checklist | recommendation | comparison", targetFieldPath: fieldPath, checklist: [], examples: [], recommendation: { recommendedValue: null, rationale: [], alternatives: [] } }
  };
}

export function validateAssistanceRelevance(result = {}, fieldPath = "", intent = "") {
  const message = String(result.assistantMessage || "");
  if (!message.trim()) return { valid: false, reason: "empty assistance" };
  if (result.targetFieldPath && result.targetFieldPath !== fieldPath) return { valid: false, reason: "wrong target field" };
  if (intent === "request_examples" && !(Array.isArray(result.examples) && result.examples.length) && !/示例|例如|比如/.test(message)) return { valid: false, reason: "examples missing" };
  if (intent === "request_checklist" && !(Array.isArray(result.checklist) && result.checklist.length)) return { valid: false, reason: "checklist missing" };
  const recommendation = result.recommendation;
  if (intent === "request_recommendation" && recommendation?.recommendedValue == null) return { valid: false, reason: "recommendation missing" };
  if (fieldPath === "accountStrategy.platformRoles" && intent === "request_recommendation" && !/小红书/.test(JSON.stringify(recommendation)) ) return { valid: false, reason: "xiaohongshu role missing" };
  if (fieldPath === "audiences.primary" && intent === "request_recommendation" && !/(行业|公司|决策|负责人|客户)/.test(JSON.stringify(recommendation))) return { valid: false, reason: "audience dimensions missing" };
  return { valid: true, reason: null };
}

export function buildDialogueComposerRequest({ userMessage, intent, acknowledgement, nextQuestion, claims = [], facts = [], assistance = null, recommendation = null }) {
  return {
    task: "compose_consultative_diagnostic_reply",
    contract: "ConsultativeReply@1.0",
    userMessage,
    intent,
    acknowledgement,
    nextQuestion,
    assistance,
    recommendation,
    currentClaims: claims,
    relevantFacts: facts.slice(-12),
    rules: [
      "像有经验的策略顾问一样自然回应，不像表单机器人",
      "先回应用户刚才的具体内容，再自然过渡到下一步",
      "不得虚构公司事实，不得把建议说成用户事实",
      "一次最多提出一个核心问题",
      "避免每轮都用已记录开头，避免原样复述用户长句",
      "如果用户在求助，优先解决求助，不关闭原问题",
      "如果nextQuestion非空，回复结尾必须自然提出nextQuestion对应的问题，不得擅自换成其他字段"
    ],
    outputSchema: { assistantMessage: "" }
  };
}

export function assistanceTypeForIntent(intent) {
  return assistanceIntentMap[intent] || null;
}
