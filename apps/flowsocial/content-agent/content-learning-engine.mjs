import { createHash, randomUUID } from "node:crypto";
import { createBlueprintVersion, createPatternFingerprint, normalizePatternScope, normalizeViralContentAnalysis, patternVisibleToScope } from "./pattern-contracts.mjs";
import { ensureContentPatternLearning } from "./pattern-library-store.mjs";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const nowIso = () => new Date().toISOString();

function hash(value, length = 16) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function canonical(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function ensureAdvancedContentLearning(store) {
  ensureContentPatternLearning(store);
  store.referenceImportJobs ||= [];
  store.contentPatternClusters ||= [];
  store.blueprintUpgradeProposals ||= [];
  store.contentPatternPerformance ||= [];
  store.contentPatternLifecycleSuggestions ||= [];
  store.skillPromotionCandidates ||= [];
  store.contentSkillPatternPacks ||= [];
  return {
    importJobs: store.referenceImportJobs,
    clusters: store.contentPatternClusters,
    upgradeProposals: store.blueprintUpgradeProposals,
    performance: store.contentPatternPerformance,
    lifecycleSuggestions: store.contentPatternLifecycleSuggestions,
    skillPromotionCandidates: store.skillPromotionCandidates,
    skillPatternPacks: store.contentSkillPatternPacks
  };
}

export function referenceFingerprint(input = {}) {
  const source = canonical(input.sourceUrl || input.url);
  const body = canonical(input.rawText || input.text || input.transcript || "");
  const title = canonical(input.title);
  return `reference_fp_${hash(source || `${title}|${body.slice(0, 2000)}`)}`;
}

export function normalizeReferenceImportItem(input = {}, defaults = {}) {
  const rawText = String(input.rawText || input.text || input.content || "").trim();
  const sourceUrl = String(input.sourceUrl || input.url || "").trim() || null;
  const title = String(input.title || input.name || rawText.split(/\r?\n/).find(Boolean) || "未命名案例").trim().slice(0, 180);
  const metrics = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
  const metricCount = ["views", "likes", "saves", "comments", "shares"].filter((key) => Number(metrics[key] || 0) > 0).length;
  const completeness = [Boolean(title), Boolean(rawText || input.transcript), Boolean(sourceUrl), Boolean(input.author), metricCount >= 2].filter(Boolean).length;
  const qualityGrade = completeness >= 5 ? "A" : completeness >= 3 ? "B" : completeness >= 2 ? "C" : "D";
  const normalized = {
    id: input.id || `reference_import_${randomUUID().slice(0, 8)}`,
    sourceName: input.sourceName || input.name || null,
    platform: input.platform || defaults.platform || "unknown",
    format: input.format || defaults.format || "article",
    accountType: input.accountType || defaults.accountType || "unknown",
    contentFunction: input.contentFunction || defaults.contentFunction || null,
    sourceUrl,
    author: input.author || null,
    title,
    rawText,
    transcript: String(input.transcript || "").trim(),
    mediaAssetIds: list(input.mediaAssetIds),
    metrics,
    publishedAt: input.publishedAt || null,
    savedReason: input.savedReason || "",
    usageBoundary: "structure_only",
    quality: {
      grade: qualityGrade,
      completeness,
      metricCount,
      missing: [!rawText && !input.transcript ? "正文或转写" : null, !sourceUrl ? "来源链接" : null, !input.author ? "作者" : null, metricCount < 2 ? "可比互动数据" : null].filter(Boolean)
    }
  };
  normalized.fingerprint = referenceFingerprint(normalized);
  return normalized;
}

export function createReferenceImportJob(store, { items = [], scope = {}, platform = "unknown", sourceType = "folder", submittedBy = "user" } = {}) {
  ensureAdvancedContentLearning(store);
  const normalizedScope = normalizePatternScope(scope);
  const normalizedItems = list(items).map((item) => normalizeReferenceImportItem(item, { platform }));
  const known = new Set(list(store.referencePosts).map((item) => item.importFingerprint || referenceFingerprint(item)));
  const seen = new Set();
  const accepted = [];
  const duplicates = [];
  const invalid = [];
  for (const item of normalizedItems) {
    if (!item.rawText && !item.transcript && !item.sourceUrl) {
      invalid.push({ name: item.sourceName || item.title, reason: "缺少正文、转写或链接" });
    } else if (known.has(item.fingerprint) || seen.has(item.fingerprint)) {
      duplicates.push({ name: item.sourceName || item.title, fingerprint: item.fingerprint });
    } else {
      accepted.push(item);
      seen.add(item.fingerprint);
    }
  }
  const createdAt = nowIso();
  const job = {
    id: `reference_job_${randomUUID().slice(0, 8)}`,
    schemaVersion: "1.0",
    scope: normalizedScope,
    sourceType,
    platform,
    status: accepted.length ? "processing" : "completed",
    submittedBy,
    counts: { submitted: normalizedItems.length, accepted: accepted.length, duplicates: duplicates.length, invalid: invalid.length, analyzed: 0, failed: 0 },
    duplicates,
    invalid,
    acceptedFingerprints: accepted.map((item) => item.fingerprint),
    createdAt,
    updatedAt: createdAt
  };
  store.referenceImportJobs.push(job);
  return { job, accepted };
}

export function completeReferenceImportJob(job, { analyzed = 0, failed = [] } = {}) {
  job.counts.analyzed = analyzed;
  job.counts.failed = failed.length;
  job.failures = failed;
  job.status = failed.length && !analyzed ? "failed" : failed.length ? "completed_with_errors" : "completed";
  job.updatedAt = nowIso();
  job.completedAt = job.updatedAt;
  return job;
}

function valuesFromAnalysis(analysis) {
  const candidate = analysis.blueprintCandidate || {};
  return [
    ...list(candidate.titleMechanisms).map((value) => ({ type: "title", value })),
    candidate.openingMechanism ? { type: "opening", value: candidate.openingMechanism } : null,
    ...list(candidate.structureRules).map((value) => ({ type: "structure", value })),
    candidate.interactionMechanism ? { type: "interaction", value: candidate.interactionMechanism } : null,
    ...list(candidate.visualRoles).map((value) => ({ type: "visual", value }))
  ].filter(Boolean);
}

function commonMechanisms(analyses) {
  const occurrences = new Map();
  for (const analysis of analyses) {
    const inSample = new Set();
    for (const item of valuesFromAnalysis(analysis)) {
      const key = `${item.type}:${canonical(item.value)}`;
      if (!canonical(item.value) || inSample.has(key)) continue;
      inSample.add(key);
      const current = occurrences.get(key) || { ...item, count: 0, analysisIds: [] };
      current.count += 1;
      current.analysisIds.push(analysis.id);
      occurrences.set(key, current);
    }
  }
  const threshold = Math.max(2, Math.ceil(analyses.length * 0.6));
  const items = [...occurrences.values()];
  return {
    recurring: items.filter((item) => item.count >= threshold).sort((a, b) => b.count - a.count),
    oneOffs: items.filter((item) => item.count === 1),
    threshold
  };
}

export function buildPatternClusters(store, { scope = null } = {}) {
  ensureAdvancedContentLearning(store);
  const analyses = list(store.contentPatternAnalyses).filter((item) => item.status !== "rejected" && (!scope || patternVisibleToScope(item, scope)));
  const references = new Map(list(store.referencePosts).map((item) => [item.id, item]));
  const groups = new Map();
  for (const analysis of analyses) {
    const candidate = analysis.blueprintCandidate || {};
    const key = [candidate.platform || "unknown", candidate.contentArchetype || "other", list(candidate.applicableFunctions)[0] || "general"].join("::");
    const group = groups.get(key) || [];
    group.push(analysis);
    groups.set(key, group);
  }
  const generatedAt = nowIso();
  const clusters = [...groups.entries()].map(([key, members]) => {
    const mechanisms = commonMechanisms(members);
    const sourceReferenceIds = [...new Set(members.flatMap((item) => list(item.sourceReferenceIds)))];
    const authorCount = new Set(sourceReferenceIds.map((id) => references.get(id)?.author).filter(Boolean)).size;
    const sampleCount = members.length;
    const classification = sampleCount >= 3 && authorCount >= 2 && mechanisms.recurring.length ? "stable_commonality" : sampleCount >= 2 && mechanisms.recurring.length ? "scenario_pattern" : "hypothesis";
    const confidenceScore = clamp(15 + sampleCount * 10 + Math.min(authorCount, 4) * 8 + mechanisms.recurring.length * 4, 0, classification === "stable_commonality" ? 92 : 68);
    const first = members[0].blueprintCandidate || {};
    const id = `pattern_cluster_${hash({ scope: members[0].scope, key })}`;
    return {
      id,
      schemaVersion: "1.0",
      scope: members[0].scope,
      clusterKey: key,
      platform: first.platform || "unknown",
      contentArchetype: first.contentArchetype || "other",
      applicableFunctions: list(first.applicableFunctions),
      analysisIds: members.map((item) => item.id),
      sourceReferenceIds,
      sampleCount,
      independentAuthorCount: authorCount,
      classification,
      confidenceScore,
      recurringMechanisms: mechanisms.recurring,
      oneOffMechanisms: mechanisms.oneOffs,
      alternativeExplanations: ["账号体量", "发布时间", "平台分发", "投放", "热点红利"],
      generatedAt,
      updatedAt: generatedAt
    };
  });
  const ids = new Set(clusters.map((item) => item.id));
  store.contentPatternClusters = list(store.contentPatternClusters).filter((item) => !ids.has(item.id));
  store.contentPatternClusters.push(...clusters);
  return clusters;
}

function candidateFromCluster(cluster, members) {
  const byType = (type) => cluster.recurringMechanisms.filter((item) => item.type === type).map((item) => item.value);
  const first = members[0]?.blueprintCandidate || {};
  return {
    platform: cluster.platform,
    contentArchetype: cluster.contentArchetype,
    applicableFunctions: cluster.applicableFunctions,
    suitableAudiences: list(first.suitableAudiences),
    suitableTopics: list(first.suitableTopics),
    titleMechanisms: byType("title"),
    openingMechanism: byType("opening")[0] || "",
    structureRules: byType("structure"),
    visualRoles: byType("visual"),
    interactionMechanism: byType("interaction")[0] || "",
    evidenceRequirements: [...new Set(members.flatMap((item) => list(item.blueprintCandidate?.evidenceRequirements)))],
    prohibitedUses: [...new Set(members.flatMap((item) => list(item.blueprintCandidate?.prohibitedUses)))],
    sourceReferenceIds: cluster.sourceReferenceIds,
    sampleCount: cluster.sampleCount,
    confidence: cluster.confidenceScore >= 70 ? "high" : cluster.confidenceScore >= 45 ? "medium" : "low",
    confidenceScore: cluster.confidenceScore,
    clusterId: cluster.id
  };
}

function diffCandidate(previous = {}, next = {}) {
  previous ||= {};
  next ||= {};
  const fields = ["titleMechanisms", "openingMechanism", "structureRules", "visualRoles", "interactionMechanism", "evidenceRequirements", "prohibitedUses"];
  const changed = fields.filter((field) => JSON.stringify(previous[field] || null) !== JSON.stringify(next[field] || null));
  return { added: changed.filter((field) => previous[field] == null || !list(previous[field]).length), removed: [], changed };
}

export function proposeBlueprintUpgrades(store, { scope = null } = {}) {
  ensureAdvancedContentLearning(store);
  const clusters = buildPatternClusters(store, { scope });
  const analyses = new Map(list(store.contentPatternAnalyses).map((item) => [item.id, item]));
  const proposals = [];
  for (const cluster of clusters.filter((item) => item.classification !== "hypothesis")) {
    const members = cluster.analysisIds.map((id) => analyses.get(id)).filter(Boolean);
    const proposedCandidate = candidateFromCluster(cluster, members);
    proposedCandidate.patternFingerprint = createPatternFingerprint(proposedCandidate);
    const related = list(store.contentPatternBlueprints).filter((item) => item.clusterId === cluster.id || (item.patternFingerprint === proposedCandidate.patternFingerprint && patternVisibleToScope(item, cluster.scope))).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
    const latest = related[0] || null;
    const familyId = latest?.familyId || `pattern_family_${hash({ scope: cluster.scope, clusterKey: cluster.clusterKey })}`;
    proposedCandidate.patternFamilyId = familyId;
    const previousSources = new Set(list(latest?.sourceReferenceIds));
    const newEvidenceCount = cluster.sourceReferenceIds.filter((id) => !previousSources.has(id)).length;
    if (latest && newEvidenceCount === 0) continue;
    const id = `upgrade_${hash({ clusterId: cluster.id, sources: cluster.sourceReferenceIds, latest: latest?.id || null })}`;
    const existing = list(store.blueprintUpgradeProposals).find((item) => item.id === id);
    const proposal = existing || {
      id,
      schemaVersion: "1.0",
      status: "candidate",
      scope: cluster.scope,
      clusterId: cluster.id,
      familyId,
      parentBlueprintId: latest?.id || null,
      proposedVersion: Number(latest?.version || 0) + 1,
      proposalType: latest ? "upgrade" : "create_family",
      reason: latest ? `新增 ${newEvidenceCount} 个可比样本，建议复核并升级` : `发现 ${cluster.sampleCount} 个相似样本，建议创建稳定蓝图家族`,
      proposedCandidate,
      changeSet: diffCandidate(latest, proposedCandidate),
      evidenceWindow: { sourceReferenceIds: cluster.sourceReferenceIds, sampleCount: cluster.sampleCount, independentAuthorCount: cluster.independentAuthorCount },
      confidenceScore: cluster.confidenceScore,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!existing) store.blueprintUpgradeProposals.push(proposal);
    proposals.push(proposal);
  }
  return proposals;
}

export function reviewBlueprintUpgrade(store, proposalId, { decision, reviewerId = "user", notes = "", lifecycle = "testing", scope = null } = {}) {
  ensureAdvancedContentLearning(store);
  const proposal = store.blueprintUpgradeProposals.find((item) => item.id === proposalId);
  if (!proposal) throw Object.assign(new Error("Blueprint upgrade proposal not found"), { statusCode: 404 });
  if (scope && !patternVisibleToScope(proposal, scope)) throw Object.assign(new Error("Blueprint upgrade proposal is outside the current ownership scope"), { statusCode: 403 });
  if (proposal.status !== "candidate") throw Object.assign(new Error("Blueprint upgrade proposal has already been reviewed"), { statusCode: 409 });
  if (!['approve', 'reject'].includes(decision)) throw Object.assign(new Error("decision must be approve or reject"), { statusCode: 400 });
  proposal.status = decision === "approve" ? "approved" : "rejected";
  proposal.review = { decision, reviewerId, notes, reviewedAt: nowIso() };
  proposal.updatedAt = proposal.review.reviewedAt;
  if (decision === "reject") return { proposal: structuredClone(proposal), blueprint: null };
  const analysis = normalizeViralContentAnalysis({
    id: `pattern_analysis_${proposal.id}`,
    mode: "batch_compare",
    status: "approved",
    scope: proposal.scope,
    sourceReferenceIds: proposal.evidenceWindow.sourceReferenceIds,
    sampleAssessment: { level: "comparable_batch", basis: [proposal.reason], comparability: "clustered", missingEvidence: [] },
    blueprintCandidate: proposal.proposedCandidate,
    extractionMode: "deterministic_cluster_v1",
    review: proposal.review
  });
  store.contentPatternAnalyses.push(analysis);
  const blueprint = createBlueprintVersion({
    analysis,
    reviewerId,
    lifecycle,
    priorVersions: store.contentPatternBlueprints,
    familyId: proposal.familyId,
    parentBlueprintId: proposal.parentBlueprintId,
    changeSet: proposal.changeSet,
    evidenceWindow: proposal.evidenceWindow
  });
  store.contentPatternBlueprints.push(blueprint);
  proposal.blueprintId = blueprint.id;
  return { proposal: structuredClone(proposal), blueprint: structuredClone(blueprint) };
}

function objectiveWeights(contentFunction) {
  if (contentFunction === "action") return { engagementRate: 0.15, saveRate: 0.1, commentRate: 0.15, leadRate: 0.3, conversionRate: 0.3 };
  if (contentFunction === "authority" || contentFunction === "proof") return { engagementRate: 0.2, saveRate: 0.35, commentRate: 0.2, followRate: 0.15, leadRate: 0.1 };
  if (contentFunction === "solution") return { engagementRate: 0.2, saveRate: 0.4, commentRate: 0.15, leadRate: 0.15, conversionRate: 0.1 };
  return { engagementRate: 0.55, saveRate: 0.15, commentRate: 0.15, followRate: 0.15 };
}

function metricComposite(metrics, contentFunction) {
  const weights = objectiveWeights(contentFunction);
  let total = 0;
  let used = 0;
  for (const [name, weight] of Object.entries(weights)) {
    const value = metrics?.derivedMetrics?.[name];
    if (!Number.isFinite(value)) continue;
    total += value * weight;
    used += weight;
  }
  return used ? total / used : null;
}

export function buildPatternPerformanceDashboard(store, { scope = null } = {}) {
  ensureAdvancedContentLearning(store);
  const publications = list(store.contentPublications).filter((item) => item.latestMetrics && (!scope || item.accountId === scope.socialAccountId));
  const baselineGroups = new Map();
  for (const publication of publications) {
    const fn = publication.attribution?.contentFunction || "discovery";
    const key = `${publication.accountId}|${publication.platform}|${fn}`;
    const values = baselineGroups.get(key) || [];
    values.push(metricComposite(publication.latestMetrics, fn));
    baselineGroups.set(key, values);
  }
  const outcomesByBlueprint = new Map();
  for (const publication of publications) {
    for (const version of list(publication.attribution?.contentPatternBlueprintVersions)) {
      const values = outcomesByBlueprint.get(version.id) || [];
      values.push(publication);
      outcomesByBlueprint.set(version.id, values);
    }
  }
  const records = [];
  const suggestions = [];
  for (const blueprint of list(store.contentPatternBlueprints).filter((item) => !scope || patternVisibleToScope(item, scope))) {
    const outcomes = outcomesByBlueprint.get(blueprint.id) || [];
    const composites = outcomes.map((publication) => metricComposite(publication.latestMetrics, publication.attribution?.contentFunction || list(blueprint.applicableFunctions)[0] || "discovery")).filter(Number.isFinite);
    const baselineValues = outcomes.map((publication) => {
      const fn = publication.attribution?.contentFunction || list(blueprint.applicableFunctions)[0] || "discovery";
      return average(baselineGroups.get(`${publication.accountId}|${publication.platform}|${fn}`) || []);
    }).filter(Number.isFinite);
    const observed = average(composites);
    const baseline = average(baselineValues);
    const relativeLift = observed !== null && baseline > 0 ? (observed - baseline) / baseline : null;
    const score = relativeLift === null ? null : Math.round(clamp(50 + relativeLift * 35));
    const record = {
      id: `pattern_performance_${blueprint.id}`,
      schemaVersion: "1.0",
      blueprintId: blueprint.id,
      familyId: blueprint.familyId,
      version: blueprint.version,
      scope: blueprint.scope,
      sampleSize: outcomes.length,
      score,
      observedComposite: observed,
      baselineComposite: baseline,
      relativeLift,
      interpretationBoundary: "相关性归因，不等于因果证明；账号、分发、发布时间和投放可能影响结果。",
      updatedAt: nowIso()
    };
    records.push(record);
    blueprint.performanceScore = score;
    if (outcomes.length >= 5 && score !== null) {
      const recommendation = score >= 62 ? "validate" : score < 42 ? "pause" : "keep_testing";
      suggestions.push({
        id: `lifecycle_suggestion_${hash({ blueprintId: blueprint.id, recommendation, sampleSize: outcomes.length })}`,
        blueprintId: blueprint.id,
        scope: blueprint.scope,
        recommendation,
        sampleSize: outcomes.length,
        score,
        status: "candidate",
        reason: recommendation === "validate" ? "至少 5 次可比使用且高于账号基线" : recommendation === "pause" ? "至少 5 次可比使用且持续低于账号基线" : "样本已形成但优势尚不稳定",
        autoApply: false,
        createdAt: nowIso()
      });
    }
  }
  store.contentPatternPerformance = records;
  const existingSuggestionIds = new Set(list(store.contentPatternLifecycleSuggestions).map((item) => item.id));
  store.contentPatternLifecycleSuggestions.push(...suggestions.filter((item) => !existingSuggestionIds.has(item.id)));
  return { records, suggestions: store.contentPatternLifecycleSuggestions, publicationCount: publications.length };
}

function targetSkillsFor(blueprint) {
  const skills = ["generate-content-outline", "generate-platform-titles"];
  if (blueprint.platform === "xiaohongshu") skills.push("write-xhs-content");
  if (blueprint.platform === "wechat") skills.push("write-wechat-article");
  return skills;
}

export function buildSkillPromotionCandidates(store, { scope = null } = {}) {
  ensureAdvancedContentLearning(store);
  const performance = new Map(list(store.contentPatternPerformance).map((item) => [item.blueprintId, item]));
  const created = [];
  for (const blueprint of list(store.contentPatternBlueprints).filter((item) => (!scope || patternVisibleToScope(item, scope)) && item.lifecycle === "validated")) {
    const result = performance.get(blueprint.id);
    if (Number(blueprint.sampleCount || 0) < 3 || Number(result?.sampleSize || 0) < 5 || Number(result?.score || 0) < 62) continue;
    for (const targetSkill of targetSkillsFor(blueprint)) {
      const id = `skill_promotion_${hash({ blueprintId: blueprint.id, targetSkill })}`;
      if (store.skillPromotionCandidates.some((item) => item.id === id)) continue;
      const candidate = {
        id,
        schemaVersion: "1.0",
        status: "candidate",
        scope: blueprint.scope,
        targetSkill,
        blueprintId: blueprint.id,
        familyId: blueprint.familyId,
        blueprintVersion: blueprint.version,
        reason: "蓝图已验证、样本充足且表现高于账号基线，可晋级为专项 Skill 的版本化运行时参考包。",
        proposedReference: {
          titleMechanisms: list(blueprint.titleMechanisms),
          openingMechanism: blueprint.openingMechanism,
          structureRules: list(blueprint.structureRules),
          evidenceRequirements: list(blueprint.evidenceRequirements),
          prohibitedUses: list(blueprint.prohibitedUses)
        },
        evaluation: { required: true, completed: false, regressionPassed: false },
        directSkillFileMutation: false,
        createdAt: nowIso()
      };
      store.skillPromotionCandidates.push(candidate);
      created.push(candidate);
    }
  }
  return { items: store.skillPromotionCandidates, created };
}

export function reviewSkillPromotion(store, candidateId, { decision, reviewerId = "user", notes = "", regressionPassed = false, scope = null } = {}) {
  ensureAdvancedContentLearning(store);
  const candidate = store.skillPromotionCandidates.find((item) => item.id === candidateId);
  if (!candidate) throw Object.assign(new Error("Skill promotion candidate not found"), { statusCode: 404 });
  if (scope && !patternVisibleToScope(candidate, scope)) throw Object.assign(new Error("Skill promotion candidate is outside the current ownership scope"), { statusCode: 403 });
  if (candidate.status !== "candidate") throw Object.assign(new Error("Skill promotion candidate has already been reviewed"), { statusCode: 409 });
  if (!['approve', 'reject'].includes(decision)) throw Object.assign(new Error("decision must be approve or reject"), { statusCode: 400 });
  if (decision === "approve" && !regressionPassed) throw Object.assign(new Error("Skill promotion requires a passed regression evaluation"), { statusCode: 409 });
  candidate.status = decision === "approve" ? "approved" : "rejected";
  candidate.evaluation = { required: true, completed: true, regressionPassed: Boolean(regressionPassed) };
  candidate.review = { decision, reviewerId, notes, reviewedAt: nowIso() };
  let pack = null;
  if (decision === "approve") {
    const previous = list(store.contentSkillPatternPacks).filter((item) => item.targetSkill === candidate.targetSkill && patternVisibleToScope(item, candidate.scope));
    pack = {
      id: `skill_pattern_pack_${hash({ candidateId, version: previous.length + 1 })}`,
      schemaVersion: "1.0",
      targetSkill: candidate.targetSkill,
      version: previous.reduce((max, item) => Math.max(max, Number(item.version || 0)), 0) + 1,
      scope: candidate.scope,
      status: "active",
      blueprintRefs: [{ id: candidate.blueprintId, familyId: candidate.familyId, version: candidate.blueprintVersion }],
      rules: candidate.proposedReference,
      policy: { runtimeReferenceOnly: true, mayMutateSkillFile: false, requiresRegressionForNextVersion: true },
      approvedBy: reviewerId,
      createdAt: nowIso()
    };
    store.contentSkillPatternPacks.push(pack);
    candidate.patternPackId = pack.id;
  }
  return { candidate: structuredClone(candidate), patternPack: pack ? structuredClone(pack) : null };
}
