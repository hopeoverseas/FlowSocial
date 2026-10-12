import { evaluateStrategyDraftReadiness } from "./strategy-engine.mjs";

const labels = {
  "business.primaryOffers": "主要产品/服务",
  "business.businessModel": "商业模式",
  "audiences.primary": "核心受众",
  "business.conversionPath": "转化路径",
  "accountStrategy.primaryGoal": "账号主目标",
  "accountStrategy.growthStage": "账号阶段",
  "accountStrategy.platformRoles": "平台目标与分工",
  "accountStrategy.contentResources": "内容资源",
  "accountStrategy.constraints": "内容安全规则"
};

export function buildStrategyReadinessSnapshot({ claims = [], fieldStates = [], coverageStates = [], pendingQuestion = null, pendingRecommendation = null, draftRevision = null, sessionMeta = null } = {}) {
  const base = evaluateStrategyDraftReadiness(claims, fieldStates, coverageStates);
  const blockingIssues = [];
  for (const fieldPath of base.minimumMissingFields) {
    blockingIssues.push({ code: "MINIMUM_FIELD_UNPROCESSED", fieldPath, message: `${labels[fieldPath] || fieldPath}尚未处理完成` });
  }
  const pendingMinimumField = (pendingQuestion?.targetFieldPaths || []).find((fieldPath) => base.minimumMissingFields.includes(fieldPath));
  if (pendingMinimumField) {
    blockingIssues.push({ code: "PENDING_MINIMUM_QUESTION", fieldPath: pendingMinimumField, message: `仍有一个最小草案问题等待回答：${pendingQuestion.content}` });
  }
  if (pendingRecommendation && ["pending_confirmation", "refining", "revision_ready"].includes(pendingRecommendation.status)) {
    blockingIssues.push({ code: "PENDING_RECOMMENDATION", fieldPath: pendingRecommendation.targetFieldPath, message: "仍有一条策略建议等待确认或调整" });
  }

  const draftIssues = [];
  if (draftRevision) {
    if (draftRevision.stale) draftIssues.push({ code: "DRAFT_STALE", message: "当前草案基于旧信息，请重新生成", details: draftRevision.staleReasons || [] });
    if (sessionMeta && (draftRevision.sourceClaimRevision !== sessionMeta.claimRevision || draftRevision.sourceFactRevision !== sessionMeta.factRevision)) {
      draftIssues.push({ code: "DRAFT_CONTEXT_CHANGED", message: "草案生成后策略信息已更新，请重新生成" });
    }
    if (draftRevision.validation?.valid === false) draftIssues.push({ code: "DRAFT_INVALID", message: "草案没有通过结构校验" });
    if (draftRevision.validation?.semanticGate?.passed === false) {
      const reasons=(draftRevision.validation.semanticGate.errors||[]).map((item)=>item.message).filter(Boolean);
      draftIssues.push({ code:"DRAFT_SEMANTIC_GATE_FAILED",message:`草案语义门禁未通过：${reasons[0]||"字段含义或来源不可靠"}`,details:reasons });
    }
    const activationAllowed = draftRevision.validation?.activationAllowed ?? draftRevision.validation?.semanticGate?.activationAllowed;
    const handoffAllowed = draftRevision.validation?.handoffAllowed ?? draftRevision.validation?.semanticGate?.handoffAllowed;
    if (draftRevision.validation?.semanticGate?.passed !== false && (activationAllowed === false || handoffAllowed === false)) {
      draftIssues.push({
        code: "DRAFT_ACTIVATION_NOT_ALLOWED",
        message: "策略草案尚未同时取得激活和内容交接许可",
        details: { activationAllowed, handoffAllowed }
      });
    }
  }

  const warnings = [
    ...base.minimumAssumptionFields.map((fieldPath) => ({ code: "FIELD_ASSUMPTION_REQUIRED", fieldPath, message: `${labels[fieldPath] || fieldPath}没有确定值，草案中必须标记为假设` })),
    ...base.fields.filter((item) => !item.processed && !item.requiredForDraft).map((item) => ({ code: "OPTIONAL_FIELD_UNPROCESSED", fieldPath: item.fieldPath, message: `${labels[item.fieldPath] || item.fieldPath}可在草案后继续补充以提升置信度` }))
  ];
  if (draftRevision?.validation?.semanticGate?.sourceMode === "validated_fallback") {
    warnings.push({code:"DRAFT_FALLBACK_SOURCE",message:"当前草案使用确定性 fallback，页面会显示来源与风险；只有通过语义门禁后才能激活。"});
  }
  const canGenerateDraft = base.canGenerateMinimumDraft && !pendingRecommendation && !pendingMinimumField;
  const canActivate = canGenerateDraft && Boolean(draftRevision) && !draftIssues.length;
  const stage=!base.minimumDraftReady?"core_diagnosis":base.qualityComplete?"quality_complete":"minimum_ready";
  const nextAction=!base.minimumDraftReady
    ? {type:"continue_core",target:"agent",label:"继续完成核心诊断"}
    : {type:"confirm_strategy_decisions",target:"agent",label:"确认账号身份与增长打法"};
  return {
    ...base,
    schemaVersion: "1.2",
    stage,
    core: { processed: Math.min(9, base.processedCount), sufficient: Math.min(9, base.confirmedCount), total: 9, complete: base.coreComplete },
    coreDiagnosis:{answered:Math.min(9,base.processedCount),total:9,minimumReady:base.minimumDraftReady,qualityComplete:base.qualityComplete,missingFields:[...base.minimumMissingFields],qualityGapFields:[...base.qualityGapFields]},
    strategyDecision:{status:"not_started",ready:false,blockers:[]},
    nextAction,
    dynamicOptional: true,
    blockingItems: [...blockingIssues, ...draftIssues],
    blockingIssues: [...blockingIssues, ...draftIssues],
    qualityWarnings: warnings,
    warnings,
    canGenerateMinimumDraft: canGenerateDraft,
    canGenerateHighConfidenceDraft: base.qualityComplete && !pendingRecommendation,
    canGenerateDraft,
    canActivate,
    availableActions: {
      generateDraft: canGenerateDraft,
      enrichOptionalFields: canGenerateDraft && !base.coreComplete,
      activateDraft: canActivate
    }
  };
}
