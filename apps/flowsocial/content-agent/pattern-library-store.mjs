import { createBlueprintVersion, createContentPatternSnapshot, normalizePatternScope, normalizeViralContentAnalysis, patternVisibleToScope } from "./pattern-contracts.mjs";

export function ensureContentPatternLearning(store) {
  store.contentPatternAnalyses ||= [];
  store.contentPatternBlueprints ||= [];
  store.contentPatternSnapshots ||= [];
  return {
    analyses: store.contentPatternAnalyses,
    blueprints: store.contentPatternBlueprints,
    snapshots: store.contentPatternSnapshots
  };
}

function inferredAssessment(payload = {}) {
  const metrics = payload.metrics || {};
  const hasMetrics = ["likes", "saves", "comments", "shares", "views"].some((key) => Number(metrics[key] || 0) > 0);
  return {
    level: hasMetrics ? "high_quality_reference" : "unknown",
    basis: hasMetrics ? ["用户提供了前台可见互动数据"] : ["仅有内容样本，缺少可验证的表现数据"],
    comparability: "unknown",
    missingEvidence: ["账号粉丝基数", "曝光或阅读量", "同赛道基准", "流量来源", "发布时间与统计窗口"]
  };
}

export function recordPatternAnalysisCandidate(store, { payload = {}, legacyAnalysis = {}, skillAnalysis = null, skillTrace = null, scope }) {
  ensureContentPatternLearning(store);
  const referenceId = legacyAnalysis.referencePostId || `reference_${legacyAnalysis.id}`;
  const legacyBlueprint = legacyAnalysis.blueprint || {};
  const analysis = skillAnalysis ? normalizeViralContentAnalysis({
    ...skillAnalysis,
    id: skillAnalysis.id || `pattern_analysis_${legacyAnalysis.id}`,
    scope: normalizePatternScope(scope),
    sourceReferenceIds: skillAnalysis.sourceReferenceIds?.length ? skillAnalysis.sourceReferenceIds : [referenceId],
    extractionMode: skillTrace ? "skill_runtime" : skillAnalysis.extractionMode || "skill_fallback",
    skillTrace
  }) : normalizeViralContentAnalysis({
    id: `pattern_analysis_${legacyAnalysis.id}`,
    mode: "single_post",
    scope: normalizePatternScope(scope),
    sourceReferenceIds: [referenceId],
    sampleAssessment: inferredAssessment(payload),
    observations: {
      audienceNeed: [legacyAnalysis.titleAnalysis?.audience, legacyAnalysis.titleAnalysis?.painPoint].filter(Boolean),
      titleAndCover: [legacyAnalysis.titleAnalysis?.formula, legacyAnalysis.coverAnalysis?.formula].filter(Boolean),
      opening: [legacyAnalysis.openingAnalysis?.hookType, legacyAnalysis.openingAnalysis?.summary].filter(Boolean),
      informationPath: legacyAnalysis.structureAnalysis?.flow || legacyBlueprint.bodyStructure || [],
      evidenceMechanism: legacyAnalysis.structureAnalysis?.evidence || [],
      visualRoles: legacyAnalysis.visualAnalysis?.pageRoles || [],
      interactionAndConversion: [legacyBlueprint.closingFormula, legacyAnalysis.conversionAnalysis?.summary].filter(Boolean)
    },
    successHypotheses: [{
      hypothesis: "标题、开头、信息路径与互动设计可能共同提升点击、停留、收藏或评论意愿",
      evidenceRefs: [referenceId],
      confidence: "low",
      alternativeExplanations: ["账号体量", "平台分发", "发布时间", "投放", "既有粉丝关系", "样本偶然性"]
    }],
    reusableElements: [legacyBlueprint.titleFormula, legacyBlueprint.openingFormula, ...(legacyBlueprint.bodyStructure || []), legacyBlueprint.closingFormula].filter(Boolean),
    nonTransferableElements: ["原作者身份与账号信任", "原文案例与数据", "原图、人物和评论截图"],
    factRisks: ["迁移后使用的案例、数字、产品结论必须来自当前公司的已确认知识或事实快照"],
    doNotCopy: legacyAnalysis.doNotCopy || legacyBlueprint.forbiddenReplication || ["原文句式", "原案例", "原图", "独特版式"],
    blueprintCandidate: {
      platform: payload.platform || legacyAnalysis.reference?.platform || "unknown",
      contentArchetype: payload.contentArchetype || "other",
      applicableFunctions: payload.applicableFunctions || [],
      titleFormula: legacyBlueprint.titleFormula,
      openingFormula: legacyBlueprint.openingFormula,
      bodyStructure: legacyBlueprint.bodyStructure,
      closingFormula: legacyBlueprint.closingFormula,
      visualRoles: legacyAnalysis.visualAnalysis?.pageRoles || [],
      requiredEvidence: legacyBlueprint.requiredEvidence || ["使用当前公司的已确认事实或知识库证据"],
      suitableTopics: legacyBlueprint.suitableTopics || [],
      doNotCopy: legacyAnalysis.doNotCopy || legacyBlueprint.forbiddenReplication,
      sourceReferenceIds: [referenceId],
      sampleCount: 1,
      confidence: "low"
    },
    extractionMode: legacyAnalysis.extractionMode || "demo_rule_based"
  });
  if (skillTrace) analysis.skillTrace = structuredClone(skillTrace);
  store.contentPatternAnalyses = store.contentPatternAnalyses.filter((item) => item.id !== analysis.id);
  store.contentPatternAnalyses.push(analysis);
  legacyAnalysis.contentPatternAnalysisId = analysis.id;
  legacyAnalysis.patternSkillTrace = skillTrace || null;
  legacyAnalysis.extractionMode = skillTrace ? "skill_runtime" : legacyAnalysis.extractionMode || "demo_rule_based";
  return analysis;
}

export function reviewPatternAnalysis(store, analysisId, { decision, reviewerId = "user", notes = "", lifecycle = "approved", scope = null } = {}) {
  ensureContentPatternLearning(store);
  const analysis = store.contentPatternAnalyses.find((item) => item.id === analysisId);
  if (!analysis) throw Object.assign(new Error("Content pattern analysis not found"), { statusCode: 404 });
  if (scope && !patternVisibleToScope(analysis, scope)) throw Object.assign(new Error("Content pattern analysis is outside the current ownership scope"), { statusCode: 403 });
  if (analysis.status !== "candidate") throw Object.assign(new Error("Content pattern analysis has already been reviewed"), { statusCode: 409 });
  if (!['approve', 'reject'].includes(decision)) throw Object.assign(new Error("decision must be approve or reject"), { statusCode: 400 });
  const reviewedAt = new Date().toISOString();
  analysis.status = decision === "approve" ? "approved" : "rejected";
  analysis.review = { decision, reviewerId, notes, reviewedAt };
  analysis.updatedAt = reviewedAt;
  let blueprint = null;
  if (decision === "approve") {
    blueprint = createBlueprintVersion({ analysis, reviewerId, lifecycle, priorVersions: store.contentPatternBlueprints, now: reviewedAt });
    store.contentPatternBlueprints.push(blueprint);
  }
  return { analysis: structuredClone(analysis), blueprint: blueprint ? structuredClone(blueprint) : null };
}

export function listEligiblePatternBlueprints(store, { scope, platform = null, contentFunction = null, topic = "" } = {}) {
  ensureContentPatternLearning(store);
  return store.contentPatternBlueprints.filter((item) => {
    if (!item.productionReady || !["approved", "testing", "validated"].includes(item.lifecycle)) return false;
    if (!patternVisibleToScope(item, scope)) return false;
    if (platform && item.platform !== "unknown" && item.platform !== platform) return false;
    if (contentFunction && item.applicableFunctions?.length && !item.applicableFunctions.includes(contentFunction)) return false;
    if (topic && item.suitableTopics?.length && !item.suitableTopics.some((value) => topic.includes(value) || value.includes(topic))) return false;
    return true;
  });
}

export function snapshotPatternsForPlan(store, { scope, blueprintIds }) {
  ensureContentPatternLearning(store);
  const visible = store.contentPatternBlueprints.filter((item) => patternVisibleToScope(item, scope));
  const snapshot = createContentPatternSnapshot({ scope, blueprints: visible, sourcePlanIds: blueprintIds });
  const existing = store.contentPatternSnapshots.find((item) => item.id === snapshot.id);
  if (!existing) store.contentPatternSnapshots.push(structuredClone(snapshot));
  return structuredClone(existing || snapshot);
}

export function updatePatternBlueprintLifecycle(store, blueprintId, { lifecycle, reviewerId = "user", notes = "", scope = null } = {}) {
  ensureContentPatternLearning(store);
  if (!["approved", "testing", "validated", "paused", "retired"].includes(lifecycle)) throw Object.assign(new Error("Invalid blueprint lifecycle"), { statusCode: 400 });
  const blueprint = store.contentPatternBlueprints.find((item) => item.id === blueprintId);
  if (!blueprint) throw Object.assign(new Error("Content pattern blueprint not found"), { statusCode: 404 });
  if (scope && !patternVisibleToScope(blueprint, scope)) throw Object.assign(new Error("Content pattern blueprint is outside the current ownership scope"), { statusCode: 403 });
  blueprint.lifecycle = lifecycle;
  blueprint.productionReady = ["approved", "testing", "validated"].includes(lifecycle);
  blueprint.updatedAt = new Date().toISOString();
  blueprint.lifecycleHistory ||= [];
  blueprint.lifecycleHistory.push({ lifecycle, reviewerId, notes, at: blueprint.updatedAt });
  return structuredClone(blueprint);
}

export function recordPatternUsage(store, task) {
  ensureContentPatternLearning(store);
  const snapshotId = task.contentPatternSnapshotId || task.contentExecutionContext?.contentPatternSnapshotId || task.generationPayload?.contentPatternSnapshotId;
  if (!snapshotId) return;
  const snapshot = store.contentPatternSnapshots.find((item) => item.id === snapshotId);
  for (const selected of snapshot?.blueprintVersions || []) {
    const blueprint = store.contentPatternBlueprints.find((item) => item.id === selected.id);
    if (!blueprint) continue;
    blueprint.usedByContentIds = [...new Set([...(blueprint.usedByContentIds || []), task.id])];
    blueprint.lastUsedAt = task.createdAt || new Date().toISOString();
  }
}
