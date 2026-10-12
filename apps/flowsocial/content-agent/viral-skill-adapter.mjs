import { runContentSkill } from "./skill-runner.mjs";
import { normalizePatternScope } from "./pattern-contracts.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

export function buildViralSkillFallback({ payload = {}, legacyAnalysis = {}, scope = {}, referenceId }) {
  const blueprint = legacyAnalysis.blueprint || {};
  const metrics = payload.metrics || legacyAnalysis.baseData?.metrics || {};
  const hasMetrics = ["likes", "saves", "comments", "shares", "views", "reads"].some((key) => Number(metrics[key] || 0) > 0);
  return {
    schemaVersion: "1.0", kind: "ViralContentAnalysis", mode: "single_post", status: "candidate",
    scope: normalizePatternScope(scope), sourceReferenceIds: [referenceId],
    sampleAssessment: {
      level: hasMetrics ? "high_quality_reference" : "unknown",
      basis: hasMetrics ? ["用户提供了可见互动数据"] : ["只有内容样本，没有可验证的表现数据"],
      comparability: "unknown",
      missingEvidence: ["账号粉丝基数", "曝光或阅读量", "同赛道基准", "流量来源", "统计窗口"]
    },
    observations: {
      audienceNeed: list(legacyAnalysis.audienceValue?.pains),
      titleAndCover: [legacyAnalysis.titleAnalysis?.formula, legacyAnalysis.coverAnalysis?.formula].filter(Boolean),
      opening: [legacyAnalysis.openingAnalysis?.type, legacyAnalysis.openingAnalysis?.reasonToContinue].filter(Boolean),
      informationPath: list(legacyAnalysis.bodyStructure).map((item) => item.role || item.purpose).filter(Boolean),
      evidenceMechanism: list(legacyAnalysis.bodyStructure).filter((item) => /案例|数据|证据|反馈/.test(`${item.role || ""}${item.purpose || ""}`)).map((item) => item.role || item.purpose),
      visualRoles: list(legacyAnalysis.pageStructure).map((item) => item.role).filter(Boolean),
      interactionAndConversion: [legacyAnalysis.interactionAnalysis?.savePrompt, legacyAnalysis.interactionAnalysis?.commentPrompt, legacyAnalysis.interactionAnalysis?.productPlacement].filter(Boolean)
    },
    accountInfluence: {
      observedAccountAssets: [payload.accountType || legacyAnalysis.reference?.accountType].filter(Boolean),
      possibleConfounders: ["账号体量", "作者身份", "平台分发", "发布时间", "既有粉丝关系"],
      targetAccountFit: "unknown",
      fitReason: ["缺少目标账号策略与可比样本"]
    },
    platformAnalysis: payload.platform === "wechat" ? {
      titlePromise: [legacyAnalysis.titleAnalysis?.formula].filter(Boolean),
      openingScene: [legacyAnalysis.openingAnalysis?.type].filter(Boolean),
      argumentChain: list(legacyAnalysis.bodyStructure).map((item) => item.role || item.purpose).filter(Boolean),
      evidencePlacement: [], emotionalCurve: [], shareReason: [], followReason: [], relationshipHandoff: [], accountInfrastructureLinks: []
    } : {
      titleCoverPromise: [legacyAnalysis.titleAnalysis?.formula, legacyAnalysis.coverAnalysis?.formula].filter(Boolean),
      firstScreenEntry: [legacyAnalysis.openingAnalysis?.type].filter(Boolean),
      cardSequence: list(legacyAnalysis.pageStructure).map((item) => item.role).filter(Boolean),
      visualInformationRoles: list(legacyAnalysis.pageStructure).map((item) => item.role).filter(Boolean),
      saveMechanism: [legacyAnalysis.interactionAnalysis?.savePrompt].filter(Boolean),
      interactionAndCta: [legacyAnalysis.interactionAnalysis?.commentPrompt, legacyAnalysis.interactionAnalysis?.productPlacement].filter(Boolean)
    },
    successHypotheses: list(legacyAnalysis.successHypotheses).map((hypothesis) => ({ hypothesis, evidenceRefs: [referenceId], confidence: "low", alternativeExplanations: ["账号体量", "平台分发", "发布时间", "投放", "既有粉丝关系", "样本偶然性"] })),
    reusableElements: [blueprint.titleFormula, blueprint.openingFormula, ...list(blueprint.bodyFormula), blueprint.interactionFormula].filter(Boolean),
    nonTransferableElements: ["原作者身份和账号信任", "原文案例与数据", "原图、人物与评论截图"],
    factRisks: ["新内容使用的案例、数字和产品结论必须来自当前公司的确认事实或知识库"],
    doNotCopy: list(legacyAnalysis.doNotCopy || blueprint.forbiddenReplication),
    blueprintCandidate: {
      kind: "ContentPatternBlueprint", schemaVersion: "1.0", lifecycle: "candidate", productionReady: false,
      platform: payload.platform || legacyAnalysis.reference?.platform || "other",
      contentArchetype: payload.contentArchetype || "other", creativeMechanism: payload.creativeMechanism || "other", applicableFunctions: list(payload.applicableFunctions),
      suitableAudiences: list(legacyAnalysis.audienceValue?.audience), suitableTopics: list(blueprint.suitableTopics),
      titleMechanisms: [blueprint.titleFormula].filter(Boolean), openingMechanism: blueprint.openingFormula || "",
      structureRules: list(blueprint.bodyFormula), evidenceRequirements: ["使用当前公司的确认事实或知识库证据"],
      visualRoles: list(legacyAnalysis.pageStructure).map((item) => item.role).filter(Boolean), platformMechanics: {}, applicableSubjectTypes: list(payload.applicableSubjectTypes), applicableAccountModes: list(payload.applicableAccountModes), applicableMatrixRoles: list(payload.applicableMatrixRoles), interactionMechanism: blueprint.interactionFormula || "",
      prohibitedUses: list(legacyAnalysis.doNotCopy || blueprint.forbiddenReplication), sourceReferenceIds: [referenceId],
      sampleCount: 1, confidence: "low", confidenceScore: 25, clusterId: null, patternFamilyId: null
    },
    strategyInsightCandidates: [],
    reviewPolicy: { requiresHumanApproval: true, autoApplyToStrategy: false, autoUseForGeneration: false }
  };
}

export async function analyzeViralWithSkill({ payload = {}, legacyAnalysis, scope, generateText }) {
  const referenceId = legacyAnalysis.referencePostId || `reference_${legacyAnalysis.id}`;
  const fallback = buildViralSkillFallback({ payload, legacyAnalysis, scope, referenceId });
  const input = {
    mode: "single_post", scope: normalizePatternScope(scope),
    references: [{ id: referenceId, platform: payload.platform || legacyAnalysis.reference?.platform || "unknown", title: payload.title || legacyAnalysis.reference?.title || "", body: payload.rawText || payload.text || payload.transcript || "", metrics: payload.metrics || legacyAnalysis.baseData?.metrics || {}, comments: list(payload.comments), author: payload.author || null, accountType: payload.accountType || legacyAnalysis.reference?.accountType || null, publishedAt: payload.publishedAt || null, visibleEvidenceOnly: true }],
    rules: ["单篇样本只能生成低置信度假设", "观察、解释与替代解释必须分开", "只提取抽象机制，不复用原文、案例、身份、图片或独特版式", "候选蓝图必须等待人工审核，不能修改策略"]
  };
  const result = await runContentSkill({ capability: "analyze-viral-content", platform: payload.platform || null, input, generateText, fallback, expectedContract: "ViralContentAnalysis@1.0", task: "analyze_viral_content_v1" });
  return { analysis: result?.data?.data || result?.data || fallback, skillTrace: result.skillTrace, executionRecord: result.executionRecord, providerMode: result.mode || "unknown", warning: result.warning || null };
}
