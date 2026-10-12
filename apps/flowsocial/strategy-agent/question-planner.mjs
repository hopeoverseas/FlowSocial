export const questionDefinitions = {
  "business.primaryOffers": {
    content: "你们当前最希望通过内容推广哪些产品或服务？",
    expectedAnswerType: "offer_inventory",
    goal: "确认主要产品与服务"
  },
  "business.businessModel": {
    content: "这些产品或服务主要通过项目制、订阅制、产品销售，还是其他方式收费和交付？",
    expectedAnswerType: "business_model",
    goal: "确认商业模式"
  },
  "audiences.primary": {
    content: "谁是你们最希望优先影响的客户和决策人？请尽量说明行业、公司类型和职位。",
    expectedAnswerType: "audience_profile",
    goal: "确认核心受众"
  },
  "business.conversionPath": {
    content: "用户看完内容后，通常通过什么方式咨询，并如何进入后续合作？",
    expectedAnswerType: "conversion_path",
    goal: "确认内容到业务的转化路径"
  },
  "accountStrategy.primaryGoal": {
    content: "未来三个月，你最希望账号优先带来什么商业结果？",
    expectedAnswerType: "primary_goal",
    goal: "确认账号主要目标"
  },
  "accountStrategy.growthStage": {
    content: "目前账号处于新建、起号、稳定运营还是转型阶段？",
    expectedAnswerType: "growth_stage",
    goal: "确认账号阶段"
  },
  "accountStrategy.platformRoles": {
    content: "小红书和微信公众号分别希望承担什么角色？请说明两个平台各自优先影响谁、主要发布什么内容、如何承接下一步，以及两边如何配合。账号身份和矩阵方案会在下一步单独选择。",
    expectedAnswerType: "platform_roles",
    goal: "确认平台目标、内容分工与协同关系"
  },
  "accountStrategy.contentResources": {
    content: "目前还有哪些可以作为内容依据的案例、数据、SOP、产品资料、客户常见问题或业务经验？已经上传过的资料不用重复说明。",
    expectedAnswerType: "resource_inventory",
    goal: "确认内容资源"
  },
  "accountStrategy.contentResources.publicUsage": {
    content: "如果目前有可用材料，其中哪些能直接用于公开内容，哪些需要隐去客户名称或敏感信息？",
    expectedAnswerType: "resource_public_usage",
    goal: "确认内容资源的公开使用范围"
  },
  "accountStrategy.constraints": {
    content: "为了避免发布后产生风险，请说明：哪些信息不能公开、哪些效果不能保证，以及哪些内容发布前需要审核？如果目前没有额外规定，也可以直接说“目前没有额外规定”。",
    expectedAnswerType: "constraints",
    goal: "确认内容安全规则"
  }
};
import { getTargetSpec } from "./profile-coverage-registry.mjs";

const normalizeText = (value = "") => String(value).replace(/[\s，。！？、,.!?]/g, "").toLowerCase();
const terminalFieldStates = new Set(["confirmed", "accepted_suggestion", "explicit_none", "temporarily_unknown", "not_available", "skipped"]);
const questionPriorities = {
  "business.primaryOffers":"P0", "business.businessModel":"P0", "audiences.primary":"P0",
  "business.conversionPath":"P0", "accountStrategy.primaryGoal":"P0", "accountStrategy.growthStage":"P1",
  "accountStrategy.platformRoles":"P0", "accountStrategy.contentResources":"P1", "accountStrategy.constraints":"P1"
};
const downstreamDecisions = {
  "business.primaryOffers":"content pillars, promotion focus and offer fit",
  "business.businessModel":"purchase expectation and conversion design",
  "audiences.primary":"positioning, topics, examples and language",
  "business.conversionPath":"CTA, lead handoff and content conversion",
  "accountStrategy.primaryGoal":"content portfolio and success metrics",
  "accountStrategy.growthStage":"experimentation intensity and cadence",
  "accountStrategy.platformRoles":"platform-specific audience, content role, handoff and cross-platform coordination",
  "accountStrategy.contentResources":"evidence availability, public-use boundaries and content feasibility",
  "accountStrategy.constraints":"risk policy and publication review"
};

function questionFingerprint(fieldPath, targetSlotIds = [], contextRevision = "legacy") {
  return `${fieldPath}:${[...targetSlotIds].sort().join(",") || "field"}:${contextRevision || "legacy"}`;
}

function questionRelevance(fieldPath, targetSlotIds = [], contextRevision = "legacy") {
  return {
    priority: questionPriorities[fieldPath] || "P2",
    decisionAffected: downstreamDecisions[fieldPath] || "strategy quality",
    downstreamConsumers: ["strategy_agent","content_agent"],
    targetSlotIds,
    contextRevision,
    semanticContextRevision: contextRevision,
    ledgerKey: questionFingerprint(fieldPath,targetSlotIds,contextRevision),
    ask: Boolean(downstreamDecisions[fieldPath]),
    reason: downstreamDecisions[fieldPath] ? "fills a concrete downstream decision" : "no downstream decision mapping"
  };
}

const meaningful = (value) => {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(value.trim()) && !/^(未知|暂无|待补充|不清楚|unknown)$/i.test(value.trim());
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value === "object") return Object.values(value).some(meaningful);
  return true;
};

function claimValue(claims, fieldPath) {
  return claims.find((claim) => claim.fieldPath === fieldPath)?.value;
}

function slotIds(items = []) {
  return new Set(items.map((item) => typeof item === "string" ? item : item?.slot || item?.id).filter(Boolean));
}

function semanticContextRevision(fieldPath, coverage, claim) {
  const assessment = coverage?.assessment || {};
  if (assessment.semanticContextRevision) return String(assessment.semanticContextRevision);
  if (assessment.contextInvalidationId) return `invalidated:${assessment.contextInvalidationId}`;
  if (fieldPath === "accountStrategy.contentResources") {
    const resourceId = assessment.candidateId || assessment.fileId || claim?.value?.knowledgeAssetIds?.slice?.().sort?.().join(",");
    if (resourceId) return `resources:${resourceId}`;
    if (assessment.resolution === "none_declared" || claim?.value?.none === true) return "resources:none";
  }
  return "baseline";
}

function normalizeQuestionContextRevision(question) {
  const semantic = question?.relevance?.semanticContextRevision;
  if (semantic) return String(semantic);
  const legacy = String(question?.relevance?.contextRevision || "");
  // updatedAt used to be persisted as the context revision. Treat those values
  // as one baseline context so a database write cannot reopen the same slot.
  if (!legacy || legacy === "legacy" || /^\d{4}-\d\d-\d\dT/.test(legacy)) return "baseline";
  return legacy;
}

function needsPublicUsageFollowup(claims, stateMap, coverageStates) {
  const coverage = coverageStates.find((item) => item.targetType === "core_field" && item.targetId === "accountStrategy.contentResources");
  const closedSlots = new Set([...slotIds(coverage?.capturedSlots), ...slotIds(coverage?.skippedSlots)]);
  if (closedSlots.has("publicUsage") || coverage?.strategyReady || ["skipped", "not_applicable"].includes(coverage?.status)) return false;
  if (terminalFieldStates.has(stateMap.get("accountStrategy.contentResources.publicUsage")?.state)) return false;
  const value = claimValue(claims, "accountStrategy.contentResources");
  return value && typeof value === "object" && value.none !== true && !["public", "anonymized", "internal", "forbidden"].includes(value.publicUsage);
}

export function planNextDiagnosticQuestion({ progress, claims = [], fieldStates = [], coverageStates = [], previousQuestions = [], modelRecommendation: _modelRecommendation = "", answerAssessment = {}, targetAssessment = null }) {
  const asked = new Set(previousQuestions.map((item) => normalizeText(item.content)));
  const attempts = new Map();
  const askedFingerprints = new Set();
  for (const item of previousQuestions) {
    for (const field of item.targetFieldPaths || []) {
      attempts.set(field, Math.max(attempts.get(field) || 0, item.attempt || 1));
      askedFingerprints.add(questionFingerprint(field,item.targetSlotIds||[],normalizeQuestionContextRevision(item)));
    }
  }

  const resolved = resolveDiagnosticState(claims, fieldStates, coverageStates);
  const stateMap = new Map(fieldStates.map((item) => [item.fieldPath, item]));
  const contextRevisionFor = (fieldPath) => {
    const coverage=coverageStates.find((item)=>item.targetType==="core_field"&&item.targetId===fieldPath);
    const claim=claims.find((item)=>item.fieldPath===fieldPath&&!['rejected','conflicting'].includes(item.status));
    return semanticContextRevision(fieldPath,coverage,claim);
  };
  const fieldResultMap = new Map(resolved.fields.map((item) => [item.fieldPath, item]));
  const isResolved = (fieldPath) => fieldResultMap.get(fieldPath)?.effective || terminalFieldStates.has(stateMap.get(fieldPath)?.state);
  const unresolvedFields = [...new Set([...resolved.missingFields, ...resolved.unresolvedFields])];
  const unresolvedCritical = diagnosticFieldOrder.slice(0, 5).filter((fieldPath) => !fieldResultMap.get(fieldPath)?.effective);
  const unresolvedOptional = diagnosticFieldOrder.slice(5).filter((fieldPath) => !isResolved(fieldPath));
  const candidateFields = [
    ...unresolvedCritical,
    ...(needsPublicUsageFollowup(claims, stateMap, coverageStates) ? ["accountStrategy.contentResources.publicUsage"] : []),
    ...unresolvedOptional
  ];

  // Once the minimum viable strategy is available, stop the automatic
  // questionnaire. Optional enrichment is an explicit user action after draft.
  if (resolved.canGenerateMinimumDraft) {
    return {
      content: resolved.coreComplete
        ? "九项策略信息已处理完成，可以生成策略草案。"
        : "生成第一版策略草案所需的最小信息已经具备。其余信息可在草案后按需补充，不再自动追问。",
      goal: "进入策略草案",
      targetFieldPaths: [],
      targetSlotIds: [],
      expectedAnswerType: "action_selection",
      questionMode: "minimum_ready",
      attempt: 1,
      unresolvedFields: resolved.unresolvedFields
    };
  }

  if (targetAssessment?.followUpNeeded && targetAssessment.targetType === "core_field" && targetAssessment.targetId && !isResolved(targetAssessment.targetId)) {
    const targetSpec=getTargetSpec("core_field",targetAssessment.targetId);
    const contextRevision=contextRevisionFor(targetAssessment.targetId);
    const targetSlotIds = (targetAssessment.missingRequiredSlots || []).filter((slotId)=>!askedFingerprints.has(questionFingerprint(targetAssessment.targetId,[slotId],contextRevision))).slice(0,1);
    if (!targetSlotIds.length) targetAssessment = null;
    else {
    const missingLabels = targetSlotIds.map((id)=>targetSpec?.slots?.find((item)=>item.id===id)?.label||id).join("、");
    const relevance=questionRelevance(targetAssessment.targetId,targetSlotIds,contextRevision);
    return {
      content: targetAssessment.followUpQuestion || `刚才的信息已经记录，但要让后续策略和内容可执行，还需要补充：${missingLabels}。请结合真实情况说明；不适用或暂时不想回答也可以直接跳过。`,
      goal: `补完整${questionDefinitions[targetAssessment.targetId]?.goal || "策略字段"}`,
      targetFieldPaths: [targetAssessment.targetId], expectedAnswerType:"coverage_follow_up", questionMode:"coverage_follow_up",
      targetSlotIds,relevance,attempt:(attempts.get(targetAssessment.targetId)||0)+1, unresolvedFields
    };
    }
  }

  for (const fieldPath of candidateFields) {
    const baseField = fieldPath.split(".publicUsage")[0];
    const alreadyPresent = isResolved(baseField) && !resolved.requiredSkippedFields.includes(baseField);
    if (fieldPath === baseField && alreadyPresent) continue;
    const definition = questionDefinitions[fieldPath];
    if (!definition) continue;
    const coverage=coverageStates.find((item)=>item.targetType==="core_field"&&item.targetId===baseField);
    const spec=getTargetSpec("core_field",baseField);
    const contextRevision=contextRevisionFor(baseField);
    const requiredSlots=fieldPath.endsWith(".publicUsage")
      ? ["publicUsage"]
      : (coverage?.missingRequiredSlots?.length?coverage.missingRequiredSlots:(spec?.slots||[]).filter((item)=>item.required).map((item)=>item.id));
    const targetSlotIds=requiredSlots
      .filter((slotId)=>!askedFingerprints.has(questionFingerprint(baseField,[slotId],contextRevision)))
      .slice(0,1);
    if (!targetSlotIds.length && askedFingerprints.has(questionFingerprint(baseField,[],contextRevision))) continue;
    const relevance=questionRelevance(baseField,targetSlotIds,contextRevision);
    if (!relevance.ask) continue;
    const previousAttempt = Math.max(attempts.get(fieldPath) || 0, stateMap.get(fieldPath)?.attempts || 0);
    const repeated = asked.has(normalizeText(definition.content));
    const repeatedTarget=askedFingerprints.has(questionFingerprint(baseField,targetSlotIds,contextRevision));
    if (repeatedTarget) continue;
    const wasSkippedRequired = resolved.requiredSkippedFields.includes(fieldPath);
    const guidedContent = wasSkippedRequired
      ? `${definition.content}\n这是生成策略草案所需的核心信息。你可以直接补充，也可以让我根据现有业务给出一版建议，由你确认后写入。`
      : previousAttempt >= 1 || repeated || repeatedTarget
      ? `${definition.content}\n如果暂时不确定，你也可以让我解释、列清单、给出建议，或者直接说“暂时跳过”。`
      : definition.content;
    return {
      ...definition,
      content: guidedContent,
      targetFieldPaths: [baseField],
      targetSlotIds,
      relevance,
      questionMode: previousAttempt ? "guided_follow_up" : "initial",
      attempt: previousAttempt + 1,
      unresolvedFields
    };
  }

  const completionContent = resolved.coreComplete
    ? "九项策略骨架已经处理完成，生成策略草案所需的信息已经具备。你现在可以选择：生成策略草案、继续完善动态事实，或者修改已有策略字段。核心诊断已经结束，但对话不会关闭。"
    : `核心信息已经可以生成初步草案，但还有 ${resolved.unresolvedFields.length} 项策略信息需要确认。我们会继续逐项完成，不会提前结束诊断。`;
  return {
    content: completionContent,
    goal: "完成骨架后允许继续丰富画像",
    targetFieldPaths: [],
    expectedAnswerType: "free_text",
    questionMode: "complete",
    attempt: 1,
    unresolvedFields: []
  };
}

export function openingDiagnosticQuestion() {
  return {
    content: "先用一段话介绍你们的业务、主要客户，以及现在最希望账号带来的结果。",
    goal: "建立第一版业务与账号画像",
    targetFieldPaths: ["business.primaryOffers", "business.businessModel", "audiences.primary", "accountStrategy.primaryGoal"],
    targetSlotIds: [],
    relevance: { priority:"P0",decisionAffected:"initial business, audience and objective hypotheses",downstreamConsumers:["strategy_agent","content_agent"],ask:true,reason:"establishes the first diagnostic context" },
    expectedAnswerType: "business_overview",
    questionMode: "opening",
    attempt: 1
  };
}
import { diagnosticFieldOrder, resolveDiagnosticState } from "./diagnostic-state-resolver.mjs";
