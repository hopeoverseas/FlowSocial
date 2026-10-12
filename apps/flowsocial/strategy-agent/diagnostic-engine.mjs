export const diagnosticFieldPolicy = [
  { path: "business.primaryOffers", weight: 18, critical: true },
  { path: "business.businessModel", weight: 10, critical: true },
  { path: "audiences.primary", weight: 18, critical: true },
  { path: "business.conversionPath", weight: 12, critical: true },
  { path: "accountStrategy.primaryGoal", weight: 12, critical: true },
  { path: "accountStrategy.growthStage", weight: 8, critical: false },
  { path: "accountStrategy.platformRoles", weight: 8, critical: false },
  { path: "accountStrategy.contentResources", weight: 7, critical: false },
  { path: "accountStrategy.constraints", weight: 7, critical: false }
];

const placeholderPattern = /^(未提及|未知|暂无|不清楚|待补充|none|null|unknown|n\/a)$/i;

function meaningful(value) {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(value.trim()) && !placeholderPattern.test(value.trim());
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value === "object") return Object.values(value).some(meaningful);
  return true;
}

const usable = (claim) => {
  if (!["confirmed", "inferred"].includes(claim.status) || !meaningful(claim.value)) return false;
  if (claim.status === "inferred" && Number(claim.confidence || 0) < 0.55) return false;
  return true;
};

export function evaluateDiagnosticCompleteness(claims = []) {
  const available = new Set(claims.filter(usable).map((claim) => claim.fieldPath));
  const confirmed = new Set(claims.filter((claim) => claim.status === "confirmed").map((claim) => claim.fieldPath));
  const completeness = diagnosticFieldPolicy.reduce((sum, field) => sum + (available.has(field.path) ? field.weight : 0), 0);
  const criticalMissingFields = diagnosticFieldPolicy.filter((field) => field.critical && !available.has(field.path)).map((field) => field.path);
  const unconfirmedCriticalFields = diagnosticFieldPolicy.filter((field) => field.critical && available.has(field.path) && !confirmed.has(field.path)).map((field) => field.path);
  return {
    completeness: Math.min(100, completeness),
    confirmedCompleteness: Math.min(100, diagnosticFieldPolicy.reduce((sum, field) => sum + (confirmed.has(field.path) ? field.weight : 0), 0)),
    completedFieldCount: diagnosticFieldPolicy.filter((field) => available.has(field.path)).length,
    totalFieldCount: diagnosticFieldPolicy.length,
    criticalMissingFields,
    unconfirmedCriticalFields,
    readyToDraft: completeness >= 60 && criticalMissingFields.length === 0,
    readyToActivate: completeness >= 70 && criticalMissingFields.length === 0 && unconfirmedCriticalFields.length === 0
  };
}

export function evaluateProfileMetrics(claims = [], facts = []) {
  const usableFacts = facts.filter((fact) => !["rejected", "conflicting"].includes(fact.status));
  const categories = new Set(usableFacts.map((fact) => fact.factType).filter(Boolean));
  const verified = usableFacts.filter((fact) => fact.status === "source_verified");
  const publishable = usableFacts.filter((fact) => ["public", "anonymized"].includes(fact.visibility) && fact.contentUsage === "allowed");
  const hasResources = claims.some((claim) => claim.fieldPath === "accountStrategy.contentResources" && usable(claim));
  const hasPlatformRoles = claims.some((claim) => claim.fieldPath === "accountStrategy.platformRoles" && usable(claim));
  return {
    profileRichness: {
      level: categories.size >= 6 || usableFacts.length >= 18 ? "丰富" : categories.size >= 3 || usableFacts.length >= 8 ? "中等" : usableFacts.length ? "初步" : "待积累",
      factCount: usableFacts.length,
      categoryCount: categories.size
    },
    evidenceReadiness: {
      level: verified.length >= 5 && publishable.length >= 5 ? "较高" : verified.length || publishable.length >= 2 ? "中等" : "较低",
      verifiedCount: verified.length,
      publishableCount: publishable.length,
      needsReviewCount: usableFacts.filter((fact) => fact.contentUsage === "needs_review" || fact.visibility === "unknown").length
    },
    contentReadiness: {
      level: hasResources && publishable.length && hasPlatformRoles ? "较高" : hasResources || publishable.length ? "基本可用" : "需要补充",
      hasContentResources: hasResources,
      hasPlatformRoles,
      usableFactCount: publishable.length
    }
  };
}

export function buildDiagnosticTurnRequest({ session, turns, claims, latestUserMessage, pendingQuestion = null, currentFacts = [], historicalClaims = [], historicalFacts = [], sessionContext = null, coverageStates = [] }) {
  return {
    task: "analyze_diagnostic_turn",
    contract: "DiagnosticTurnResult@3.0",
    session: { id: session.id, mode: session.mode, status: session.status },
    recentTurns: (turns || []).slice(-8),
    currentClaims: claims || [],
    currentFacts: (currentFacts || []).slice(-40),
    historicalClaims: (historicalClaims || []).slice(-20),
    historicalFacts: (historicalFacts || []).slice(-20),
    sessionContext,
    pendingQuestion,
    currentCoverage: coverageStates,
    latestUserMessage,
    fieldPolicy: diagnosticFieldPolicy,
    coreFieldSpecs,
    dynamicFactSpecs,
    rules: [
      "区分用户明确事实、用户偏好、Agent推断和尚未验证的策略假设",
      "优先选择能改变下游策略的高信息增益问题",
      "一次最多提出两个紧密相关的问题",
      "不得重复询问已有明确答案",
      "不得把Agent推断写成已确认事实",
      "优先把latestUserMessage理解为对pendingQuestion的回答",
      "区分完整回答、部分回答、纠正、否认和暂时无法回答",
      "除9个核心字段外，还要提取行业经验、案例、资源、市场、偏好、约束等动态事实",
      "简单执行任务不得被强制升级为完整战略咨询",
      "先判断用户是在回答、求解释、求示例、求清单、求建议、采纳/修改/拒绝建议、跳过还是纠正信息",
      "用户请求帮助时不得把我不清楚写成字段答案，也不得关闭当前问题"
      ,"非空答案不等于字段完成。必须逐项判断目标规格中的必需信息；缺失时状态必须为partial并生成自然的追问"
      ,"同一个字段至少允许多轮追问，直到必需信息充分、用户明确跳过或确认不适用；不得因已经问过就停止"
      ,"追问每次聚焦最多三个最重要缺口，结合用户上一轮回答自然承接，禁止重复原题"
      ,"动态事实也按目标规格评估；回答了一个点后继续补齐该类别，再进入下一个类别"
      ,"strategyReady表示足以形成策略判断，contentReady表示足以指导下游内容；两者要分别判断"
      ,"pendingQuestion.targetFieldPaths 是本轮抽取的最高优先级；回答合理时必须先生成目标字段操作"
      ,"SaaS行业不等于SaaS订阅商业模式，数字化转型不等于账号转型阶段，介绍内容产品不等于已经存在转化路径"
      ,"不得根据单个宽泛关键词虚构用户没有表达的业务事实"
      ,"acknowledgement只能回应latestUserMessage，不得沿用上一轮内容"
      ,"currentClaims与currentFacts才是本轮事实；historicalClaims与historicalFacts只是历史候选，未经本轮确认不得表述为当前事实"
      ,"账号阶段、平台分工、账号目标和转化路径属于高变化信息，重新诊断时不得从历史候选直接继承"
      ,"如果引用历史候选，必须使用‘上一次记录为……，现在仍然如此吗’的确认问法"
    ],
    outputSchema: {
      intent: "direct_answer | request_clarification | request_examples | request_checklist | request_recommendation | compare_options | adopt_recommendation | modify_recommendation | reject_recommendation | cannot_answer | temporarily_unknown | skip_question | skip_field | correct_previous | add_context | off_topic",
      intentConfidence: 0,
      targetFieldAnswer: { fieldPath: "", value: null, confidence: 0, evidenceText: "" },
      additionalFieldCandidates: [{ fieldPath: "", value: null, confidence: 0, evidenceText: "", requiresConfirmation: false }],
      claims: [{ fieldPath: "", value: null, type: "fact | user_preference | agent_hypothesis", sourceType: "user_statement | uploaded_file | agent_inference", confidence: 0, status: "confirmed | inferred | conflicting | rejected" }],
      coreClaimOperations: [{ operation: "create | append | refine | replace | correct | confirm | reject", fieldPath: "", value: null, type: "fact | user_preference | agent_hypothesis", confidence: 0, status: "confirmed | inferred | conflicting | rejected" }],
      discoveredFactOperations: [{ operation: "create | append | refine | replace | correct | confirm | reject", factKey: "", factType: "", subject: "company", predicate: "", value: null, status: "user_asserted | source_verified | agent_inferred | needs_confirmation | conflicting | rejected", confidence: 0, visibility: "public | anonymized | internal | forbidden | unknown", contentUsage: "allowed | needs_review | prohibited" }],
      answerAssessment: { status: "answered | partially_answered | ambiguous | not_answered | correction", answeredFieldPaths: [], remainingGaps: [] },
      targetAssessment: { targetType:"core_field | dynamic_fact", targetId:"", capturedSlots:[{slot:"",value:null,confidence:0,source:"user_statement"}], missingRequiredSlots:[], missingOptionalSlots:[], status:"partial | sufficient | confirmed | skipped | not_applicable", strategyReady:false, contentReady:false, followUpNeeded:true, followUpQuestion:"" },
      acknowledgement: "",
      assistanceRequest: { required: false, type: "clarification | examples | checklist | recommendation | comparison", targetFieldPath: "" },
      recommendationAction: { recommendationId: "", action: "accept | modify | reject", modifiedValue: null },
      conflicts: [{ fieldPath: "", description: "", claimIds: [] }],
      missingCriticalFields: [],
      nextQuestion: "",
      nextQuestionRecommendation: "",
      questionGoal: "",
      stopReason: ""
    }
  };
}

export function normalizeDiagnosticAnalysis(raw = {}) {
  const structuredCandidates = [raw.targetFieldAnswer, ...(Array.isArray(raw.additionalFieldCandidates) ? raw.additionalFieldCandidates : [])]
    .filter((item) => item?.fieldPath && item.value != null)
    .map((item) => ({ operation: item.requiresConfirmation ? "create" : "create", fieldPath: item.fieldPath, value: item.value, type: item.requiresConfirmation ? "agent_hypothesis" : "fact", sourceType: item.requiresConfirmation ? "agent_inference" : "user_statement", confidence: item.confidence, status: item.requiresConfirmation ? "inferred" : "confirmed" }));
  const claims = [...(Array.isArray(raw.claims) ? raw.claims.filter((claim) => claim?.fieldPath) : []), ...structuredCandidates];
  const coreClaimOperations = Array.isArray(raw.coreClaimOperations) && raw.coreClaimOperations.length
    ? raw.coreClaimOperations.filter((item) => item?.fieldPath)
    : claims.map((claim) => ({ operation: "create", ...claim }));
  return {
    intent: String(raw.intent || "direct_answer"),
    intentConfidence: Math.min(1, Math.max(0, Number(raw.intentConfidence) || 0)),
    claims,
    coreClaimOperations,
    discoveredFactOperations: Array.isArray(raw.discoveredFactOperations) ? raw.discoveredFactOperations.filter((item) => item?.factKey && item?.predicate) : [],
    answerAssessment: raw.answerAssessment && typeof raw.answerAssessment === "object" ? raw.answerAssessment : { status: "ambiguous", answeredFieldPaths: [], remainingGaps: [] },
    targetAssessment: raw.targetAssessment && typeof raw.targetAssessment === "object" ? raw.targetAssessment : null,
    acknowledgement: String(raw.acknowledgement || "").trim(),
    assistanceRequest: raw.assistanceRequest && typeof raw.assistanceRequest === "object" ? raw.assistanceRequest : null,
    recommendationAction: raw.recommendationAction && typeof raw.recommendationAction === "object" ? raw.recommendationAction : null,
    assistanceResponse: String(raw.assistanceResponse || "").trim(),
    recommendationDraft: raw.recommendationDraft && typeof raw.recommendationDraft === "object" ? raw.recommendationDraft : null,
    conflicts: Array.isArray(raw.conflicts) ? raw.conflicts : [],
    missingCriticalFields: Array.isArray(raw.missingCriticalFields) ? raw.missingCriticalFields : [],
    nextQuestion: String(raw.nextQuestion || "").trim(),
    nextQuestionRecommendation: String(raw.nextQuestionRecommendation || raw.nextQuestion || "").trim(),
    questionGoal: String(raw.questionGoal || "").trim(),
    stopReason: String(raw.stopReason || "").trim()
  };
}
import { coreFieldSpecs, dynamicFactSpecs } from "./profile-coverage-registry.mjs";
