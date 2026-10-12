import { authorizationFromUserText } from "./fact-governance.mjs";

const fieldNames = {
  "business.primaryOffers": "产品与服务", "business.businessModel": "商业模式", "audiences.primary": "核心受众", "business.conversionPath": "转化路径", "accountStrategy.primaryGoal": "账号目标", "accountStrategy.growthStage": "账号阶段", "accountStrategy.platformRoles": "平台分工", "accountStrategy.contentResources": "内容资源", "accountStrategy.constraints": "约束与边界"
};

const exactNegative = /^(没有|暂无|目前没有|还没有)[。！!]*$/;
const splitItems = (text) => String(text || "").split(/[、,，;；\n]|以及|和/).map((item) => item.trim()).filter(Boolean);
const fieldMarkerPattern = /(?:主要产品|主要服务|核心业务|产品(?:和|与)?服务|商业模式|收费方式|交付方式|主要客户|目标客户|核心客户|核心受众|账号目标|主要目标|账号阶段|目前处于|小红书|微信公众号|公众号|内容资源|现有资料|可用资料|安全边界|内容边界|不能公开|不得公开|不能承诺|不得承诺|转化路径|咨询入口|承接方式)/;

function compactSegment(value = "") {
  return String(value)
    .replace(/^[：:，,；;\s]+/, "")
    .split(fieldMarkerPattern)[0]
    .split(/[，,]\s*(?:采用|通过|按照|按(?:年|月|项目|次)?(?:收费|订阅|交付)|面向|服务于)/)[0]
    .replace(/[，,]\s*(?:同时|另外|此外|并且)?$/g, "")
    .trim();
}

function capture(message, patterns = []) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    const value = compactSegment(match?.[1] || "");
    if (value) return value;
  }
  return "";
}

function conversionValue(message) {
  const source = capture(message, [
    /(?:转化路径|咨询入口|承接方式)(?:是|为|包括|：|:)?\s*([^。；\n]+)/,
    /(?:用户|客户|读者)(?:看完|看到)[^。；\n]*?((?:私信|添加|联系|扫码|填写|进入)[^。；\n]+)/,
    /(?:内容结尾|文章结尾|文末)[^。；\n]*?((?:私信|添加|联系|扫码|填写|进入)[^。；\n]+)/
  ]);
  if (!source) return null;
  const entryCTA = /内容结尾|文章结尾|文末/.test(message) ? "在内容结尾给出咨询或下一步行动引导" : /私信|添加|联系|扫码|填写|咨询/.test(source) ? "引导有需求的用户发起咨询" : "";
  const contactChannel = /企微|企业微信/.test(source) ? "企业微信" : /微信/.test(source) ? "微信" : /私信/.test(source) ? "平台私信" : /表单|问卷/.test(source) ? "咨询表单" : /电话|手机/.test(source) ? "电话" : /官网/.test(source) ? "官网" : "";
  const handoffOwner = source.match(/(?:由|转给|交给)(销售(?:人员|顾问)?|客服|顾问|运营|负责人)/)?.[1] || (/销售/.test(source) ? "销售人员" : "");
  const diagnosticStep = /诊断|了解需求|需求沟通|沟通需求|会议|演示|demo/i.test(source) ? "确认需求并安排诊断或沟通" : "";
  const nextBusinessStep = /方案|报价|试用|演示/.test(source) ? "根据诊断结果提供方案或下一步安排" : "";
  const cooperationEntry = /签约|合同|付款|立项|合作/.test(source) ? "确认范围后进入签约或合作" : "";
  return {
    summary: source,
    steps: source.split(/\s*(?:→|->|然后|再|之后|并)\s*/).filter(Boolean),
    ...(entryCTA ? { entryCTA } : {}),
    ...(contactChannel ? { contactChannel } : {}),
    ...(handoffOwner ? { handoffOwner } : {}),
    ...(diagnosticStep ? { diagnosticStep } : {}),
    ...(nextBusinessStep ? { nextBusinessStep } : {}),
    ...(cooperationEntry ? { cooperationEntry } : {})
  };
}

function constraintsValue(message) {
  if (!/(不能公开|不得公开|保密|脱敏|不能承诺|不得承诺|不保证|不虚构|数据.{0,8}来源|案例.{0,8}(授权|脱敏)|发布前.{0,8}审核|内容边界|安全边界)/.test(message)) return null;
  const result = { summary: capture(message, [/(?:安全边界|内容边界|内容安全规则)(?:是|为|包括|：|:)?\s*([^。\n]+)/]) || "已说明内容公开与表达边界" };
  const clauses = message.split(/[。；\n]/).map((item) => item.trim()).filter(Boolean);
  const find = (pattern) => clauses.filter((item) => pattern.test(item)).join("；");
  const confidentialInformation = find(/不能公开|不得公开|保密|客户名称|内部信息|敏感信息|脱敏/);
  const forbiddenClaims = find(/不能承诺|不得承诺|不保证|绝对化|不虚构|夸大/);
  const dataSourceRules = find(/数据.{0,8}(来源|核实|引用|标注)|不虚构.{0,8}数据/);
  const caseAuthorizationRules = find(/案例.{0,8}(授权|同意|脱敏|隐去)|不虚构.{0,8}案例|未经授权/);
  const mandatoryReviewRules = find(/发布前.{0,8}(审核|确认)|需要.{0,8}(审核|法务|负责人确认)|人工审核/);
  return {
    ...result,
    ...(confidentialInformation ? { confidentialInformation } : {}),
    ...(forbiddenClaims ? { forbiddenClaims } : {}),
    ...(dataSourceRules ? { dataSourceRules } : {}),
    ...(caseAuthorizationRules ? { caseAuthorizationRules } : {}),
    ...(mandatoryReviewRules ? { mandatoryReviewRules } : {})
  };
}

function explicitMultiFieldValues(message) {
  const values = new Map();
  const offers = capture(message, [
    /(?:主要产品|主要服务|核心业务|产品(?:和|与)?服务)(?:是|为|包括|有|：|:)?\s*([^。；\n]+)/,
    /(?:我们|公司)(?:主要)?(?:提供|经营|从事)\s*([^。；\n]+)/
  ]);
  if (offers) values.set("business.primaryOffers", splitItems(offers.replace(/^(包括|有)/, "")));
  const businessModel = capture(message, [
    /(?:商业模式|收费方式)(?:是|为|包括|：|:)?\s*([^。；\n]+)/,
    /((?:按年|年度|按月|订阅制|项目制|按项目|产品销售)[^。；\n]*(?:收费|订阅|交付|销售)?)/
  ]);
  if (businessModel) values.set("business.businessModel", businessModel);
  const audience = capture(message, [/(?:主要客户|目标客户|核心客户|核心受众|主要面向)(?:是|为|包括|有|：|:)?\s*([^。；\n]+)/]);
  if (audience) values.set("audiences.primary", audienceValue(audience));
  const conversion = conversionValue(message);
  if (conversion) values.set("business.conversionPath", conversion);
  const goal = capture(message, [/(?:账号目标|主要目标|希望账号|希望内容)(?:是|为|能够|带来|：|:)?\s*([^。；\n]+)/]);
  if (goal) values.set("accountStrategy.primaryGoal", { summary: goal, primaryOutcome: goal });
  const stage = capture(message, [/(?:账号阶段|目前处于|现在处于)(?:是|为|：|:)?\s*([^。；，,\n]+)/]);
  if (stage || /(?:刚开始|新建账号|正在起号|起号阶段)/.test(message)) values.set("accountStrategy.growthStage", valueForTarget("accountStrategy.growthStage", stage || message));
  if (/小红书[^。；\n]*(?:公众号|微信公众号)|(?:公众号|微信公众号)[^。；\n]*小红书/.test(message)) values.set("accountStrategy.platformRoles", platformRolesValue(message));
  const resources = capture(message, [/(?:内容资源|现有资料|可用资料|用于内容的资料|目前有)(?:是|为|包括|有|：|:)?\s*([^。；\n]*(?:案例|数据|SOP|产品资料|公司资料|客户问答|业务经验)[^。；\n]*)/i]);
  if (resources) {
    const authorization = authorizationFromUserText(resources);
    const publicUsage=/脱敏|隐去/.test(resources)?"anonymized":authorization.publicUsage;
    values.set("accountStrategy.contentResources", { summary: resources, resourceTypes: splitItems(resources), publicUsage });
  } else if (/(?:目前|现在)?(?:没有|暂无|还没有)(?:可用|现成|用于内容)?(?:的)?(?:资料|案例|数据|SOP|内容资源)/i.test(message)) {
    values.set("accountStrategy.contentResources", { none: true, summary: "用户确认目前暂无可用于内容创作的现成资源", publicUsage: "unknown" });
  }
  const constraints = constraintsValue(message);
  if (constraints) values.set("accountStrategy.constraints", constraints);
  else if (/(?:安全边界|内容边界|额外规定)[^。；\n]*(?:没有|暂无)|(?:没有|暂无)(?:额外)?(?:限制|规定|内容约束)/.test(message)) values.set("accountStrategy.constraints", { none: true, summary: "用户确认目前暂无额外内容约束" });
  return values;
}

function audienceValue(message) {
  const industryVocabulary = ["SaaS", "科技", "制造业", "外贸", "跨境电商", "消费电子", "智能硬件", "教育", "医疗", "金融", "零售", "企业服务"];
  const stageVocabulary = ["初创期", "成长期", "成熟期", "大型", "中型", "中小型", "集团型"];
  const industries = industryVocabulary.filter((item) => new RegExp(item, "i").test(message));
  const companyStages = stageVocabulary.filter((item) => message.includes(item));
  const roleMatch = message.match(/(?:核心|主要|最终)?决策人(?:是|为|包括)?([^。；，\n]+)/) || message.match(/(?:优先影响|面向)(?:的是)?[^。；，\n]*?(VP|负责人|总监|经理|老板|创始人|CEO|CTO|CIO)/i);
  return { summary: message.trim(), industries, companyStages, decisionMakers: roleMatch?.[1] ? splitItems(roleMatch[1]) : [] };
}

function platformRolesValue(message) {
  const xhs = message.match(/小红书(?:负责|主要|希望|用来|承担)?([^。；\n]*?)(?=[，,]\s*(?:而|同时|微信公众号|公众号)|。|；|$)/)?.[1]?.replace(/^[：:，,]/, "").trim();
  const wechat = message.match(/(?:微信公众号|公众号)(?:负责|主要|希望|用来|承担)?([^。；\n]*?)(?=[，,]\s*(?:而|同时|小红书)|。|；|$)/)?.[1]?.replace(/^[：:，,]/, "").trim();
  const summary=[xhs&&`小红书：${xhs}`,wechat&&`公众号：${wechat}`].filter(Boolean).join("；");
  return { summary, ...(xhs ? { xiaohongshu: xhs } : {}), ...(wechat ? { wechat } : {}) };
}

function valueForTarget(fieldPath, message) {
  const text = message.trim();
  if (fieldPath === "business.primaryOffers") return splitItems(text.replace(/^(我们|公司|目前|主要)*(提供|产品包括|服务包括|主要产品是|主要服务是)/, ""));
  if (fieldPath === "business.businessModel") return text;
  if (fieldPath === "audiences.primary") return audienceValue(text);
  if (fieldPath === "business.conversionPath") return text;
  if (fieldPath === "accountStrategy.primaryGoal") return text;
  if (fieldPath === "accountStrategy.growthStage") {
    if (/刚开始|新建|起号/.test(text)) return "account_setup";
    if (/稳定运营|稳定更新|成熟账号/.test(text)) return "stable_operation";
    if (/账号.*转型|重新定位|调整定位/.test(text)) return "transformation";
    return text;
  }
  if (fieldPath === "accountStrategy.platformRoles") return platformRolesValue(text);
  if (fieldPath === "accountStrategy.contentResources") return exactNegative.test(text) ? { none: true, summary: "用户确认目前暂无可用于内容创作的现成资源", publicUsage: "unknown" } : { summary: text, publicUsage: authorizationFromUserText(text).publicUsage };
  if (fieldPath === "accountStrategy.constraints") return exactNegative.test(text) ? { none: true, summary: "用户确认目前暂无额外内容约束" } : { summary: text, items: splitItems(text) };
  return text;
}

export function buildDeterministicDiagnosticFallback(message = "", claims = [], pendingQuestion = null) {
  const text = String(message || "").trim();
  const known = new Set(claims.map((item) => item.fieldPath));
  const pendingTargets = pendingQuestion?.targetFieldPaths || [];
  const operationMap = new Map();
  const factOperations = [];
  const add = (fieldPath, value, confidence = 0.98, extra = {}) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    operationMap.set(fieldPath, { operation: known.has(fieldPath) ? "correct" : "create", fieldPath, value, type: "fact", sourceType: "user_statement", confidence, status: "confirmed", ...extra });
  };

  if (pendingTargets.length === 1 && text && !/^(暂时跳过|先跳过|跳过|不回答)$/.test(text)) {
    const target = pendingTargets[0];
    const targetValue=valueForTarget(target,text);
    add(target, targetValue, 0.99, exactNegative.test(text) && ["accountStrategy.contentResources", "accountStrategy.constraints"].includes(target) ? { resolutionState: "explicit_none" } : {});
    if(target==="accountStrategy.contentResources"&&!exactNegative.test(text)){
      const publicUsage=targetValue?.publicUsage||"unknown";
      const authorization=authorizationFromUserText(text);
      factOperations.push({operation:"create",factKey:"company.content_resources",factType:"content_resource",subject:"company",predicate:"has_content_resources",value:targetValue,status:"user_asserted",confidence:0.99,visibility:authorization.visibility,contentUsage:authorization.contentUsage,sourceType:"user_statement"});
    }
  }

  for (const [fieldPath, value] of explicitMultiFieldValues(text)) add(fieldPath, value, 0.93, value?.none === true ? { resolutionState: "explicit_none" } : {});
  const operations = [...operationMap.values()];
  if (pendingQuestion && text) factOperations.push({ operation: "create", factKey: `diagnostic.answer.${pendingQuestion.id}`, factType: "diagnostic_detail", subject: "company", predicate: "answered_diagnostic_question", value: { question: pendingQuestion.content, answer: text }, status: "user_asserted", confidence: 0.95, visibility: "unknown", contentUsage: "needs_review" });

  const answeredFields = [...new Set(operations.map((item) => item.fieldPath))];
  const audience = operations.find((item) => item.fieldPath === "audiences.primary")?.value;
  const acknowledgement = audience?.summary
    ? `明白了，${audience.summary.replace(/^Baklib最想优先影响的是/, "Baklib当前优先影响")}。我已经把行业、公司阶段和决策人写入核心受众。`
    : answeredFields.length ? `明白了，我已经从这次回答中确认了${answeredFields.map((field) => fieldNames[field]).join("、")}。` : "";
  return {
    intent: "direct_answer",
    intentConfidence: 0.65,
    claims: operations,
    coreClaimOperations: operations,
    discoveredFactOperations: factOperations,
    answerAssessment: { status: answeredFields.length ? "answered" : "ambiguous", answeredFieldPaths: answeredFields, remainingGaps: [] },
    acknowledgement,
    conflicts: [], missingCriticalFields: [], nextQuestionRecommendation: "", questionGoal: "补齐会影响下游策略的关键信息", stopReason: ""
  };
}
