import { createHash, randomUUID } from "node:crypto";
import { BUSINESS_METRICS, CORE_METRICS, CORE_METRICS_BY_PLATFORM, METRIC_DICTIONARY_VERSION, PLATFORM_METRIC_KEYS, metricValue } from "./metric-dictionary.mjs";
import { buildCycleReviews, buildFunnelDiagnoses, buildStrategyReviewCandidates } from "./feedback-review-engine.mjs";
import { atomicPublicationIdentity, projectAtomicFeedbackPublications } from "./atomic-feedback-workspace-adapter.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const KNOWN_METRICS = CORE_METRICS;
const PLATFORM_METRIC_ALIASES = Object.freeze({
  xiaohongshu: { coverClicks: ["coverClicks", "cover_clicks"], profileVisits: ["profileVisits", "profile_visits"], directMessages: ["directMessages", "direct_messages"] },
  wechat: { delivered: ["delivered", "deliveries"], opens: ["opens", "readers"], completions: ["completions", "finishedReads"], menuClicks: ["menuClicks", "menu_clicks"], keywordReplies: ["keywordReplies", "keyword_replies"], unsubscribes: ["unsubscribes", "unfollows"] }
});
const STANDARD_FEEDBACK_WINDOWS = Object.freeze({
  "72h": 72 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  final: 30 * 24 * 60 * 60 * 1000
});
const MISSING_FIELD_CODES = Object.freeze({
  platformContentId: "PLATFORM_CONTENT_ID_MISSING",
  publishedAt: "PUBLISHED_AT_MISSING",
  socialAccountId: "SOCIAL_ACCOUNT_ID_MISSING",
  strategyAttribution: "STRATEGY_ATTRIBUTION_MISSING",
  growthPlaybookId: "GROWTH_PLAYBOOK_ID_MISSING"
});

function isoTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isoAt(time) {
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function finiteMetric(value) {
  return metricValue(value);
}

function rate(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null;
}

function latestMetric(publication) {
  const priority = { unspecified: 0, custom: 0, "72h": 1, "7d": 2, final: 3 };
  return [...list(publication?.metricHistory)].sort((left, right) => (priority[right.measurementWindow] || 0) - (priority[left.measurementWindow] || 0) || Number(right.revision || 1) - Number(left.revision || 1) || String(right.collectedAt || "").localeCompare(String(left.collectedAt || "")))[0] || publication?.latestMetrics || null;
}

function executionContext(task = {}, run = null) {
  return task.contentExecutionContext
    || task.generationPayload?.contentExecutionContext
    || run?.generationPayload?.contentExecutionContext
    || null;
}

export function extractPublicationAttribution(task = {}, run = null) {
  const context = executionContext(task, run);
  const direction = context?.directionCard
    || task.contentDirectionCard
    || task.generationPayload?.contentDirectionCard
    || run?.generationPayload?.contentDirectionCard
    || {};
  const sourcePlan = context?.sourcePlan || task.contentSourcePlan || run?.generationPayload?.contentSourcePlan || {};
  const sourceIdsByType = Object.fromEntries(list(sourcePlan.sources).map((source) => [source.type, list(source.candidateIds)]));
  const content = task.currentContent || task.contentPackage || {};
  const finalTitle = content.post_copy?.recommended_title || content.recommended_title || task.ideaTitle || null;
  const selectedTitle = list(task.titleCandidates || task.platformTitles?.titles).find((item) => item.id === task.selectedTitleId) || null;
  return {
    schemaVersion: "2.0",
    workspaceId: run?.workspaceId || task.workspaceId || context?.workspaceId || null,
    companyId: run?.companyId || task.companyId || context?.companyId || null,
    socialAccountId: run?.socialAccountId || task.socialAccountId || task.accountId || context?.socialAccountId || null,
    matrixId: run?.matrixId || task.matrixId || null,
    rollingPlanId: run?.rollingPlanId || task.rollingPlanId || null,
    rollingPlanItemId: run?.rollingPlanItemId || task.rollingPlanItemId || null,
    cycleId: run?.cycleId || run?.sourcePublishingCycleId || task.cycleId || task.sourcePublishingCycleId || task.generationPayload?.cycleId || task.generationPayload?.sourcePublishingCycleId || null,
    slotId: run?.slotId || run?.sourcePublishingSlotId || task.slotId || task.sourcePublishingSlotId || task.generationPayload?.slotId || task.generationPayload?.sourcePublishingSlotId || null,
    contentOpportunityId: run?.contentOpportunityId || task.contentOpportunityId || null,
    effectiveStrategyId: run?.effectiveStrategyId || context?.effectiveStrategyId || null,
    strategyResolution: run?.generationPayload?.strategyResolution || context?.strategyResolution || context?.resolvedPolicies?.strategyResolution || null,
    strategySnapshotId: context?.strategySnapshotId || task.strategySnapshotId || task.contentTaskBrief?.strategySnapshotId || null,
    strategySnapshotVersion: task.strategySnapshotVersion || null,
    strategyDecisionRevision: run?.strategyDecisionRevision || task.strategyDecisionRevision || context?.strategyDecisionRevision || null,
    strategyDecisionHash: run?.strategyDecisionHash || task.strategyDecisionHash || context?.strategyDecisionHash || null,
    factSnapshotId: context?.factSnapshotId || task.factSnapshotId || task.contentTaskBrief?.factSnapshotId || null,
    knowledgeSnapshotId: context?.knowledgeSnapshotId || task.knowledgeSnapshotId || null,
    contentPatternSnapshotId: context?.contentPatternSnapshotId || task.contentPatternSnapshotId || task.generationPayload?.contentPatternSnapshotId || run?.contentPatternSnapshotId || null,
    contentPatternBlueprintVersions: list(task.contentSourceEvidence?.viralBlueprints || task.generationPayload?.contentPatternSnapshot?.blueprintVersions || run?.generationPayload?.contentPatternSnapshot?.blueprintVersions).map((item) => ({ id: item.id, familyId: item.familyId, version: item.version })),
    contentExecutionContextId: context?.id || null,
    directionCardId: direction.id || null,
    objectiveId: direction.objectiveId || null,
    contentFunction: direction.contentFunction || null,
    contentPillarId: direction.pillarId || null,
    audienceId: direction.audienceId || null,
    topic: direction.topic || task.contentIdentity?.topic || task.ideaTitle || null,
    sourcePlanId: sourcePlan.id || null,
    sourceIdsByType,
    contentVersion: Number(task.version || 1),
    selectedTitleId: task.selectedTitleId || null,
    finalTitle,
    titleMechanism: selectedTitle?.mechanism || selectedTitle?.strategy || direction.titleMechanism || null,
    creativeMechanism: direction.creativeMechanism || task.contentTaskBrief?.creativeMechanism || null,
    growthMode: run?.growthMode || task.growthMode || context?.growthMode || null,
    growthPlaybookId: run?.growthPlaybookId || task.growthPlaybookId || context?.growthPlaybookId || null,
    validationHypothesis: run?.validationHypothesis || task.validationHypothesis || context?.validationHypothesis || null,
    experimentPlanId: run?.experimentPlanId || task.experimentPlanId || context?.experimentPlanId || null,
    selectedCoverId: task.selectedCoverId || null,
    coverMechanism: direction.coverMechanism || content.deck?.pages?.[0]?.page_role || null,
    openingMechanism: direction.openingMechanism || content.post_copy?.opening_mechanism || null,
    structureMechanism: direction.structureMechanism || task.outline?.structure || null,
    primaryCta: direction.conversionStage?.id || null,
    publishingVariables: {
      format: direction.format || task.contentTaskBrief?.format || null,
      publishType: task.publishType || null,
      scheduledFor: run?.generationPayload?.scheduledFor || null,
      commercial: Boolean(direction.promotionMode && direction.promotionMode !== "none"),
      wordCount: typeof content.article_markdown === "string" ? content.article_markdown.length : null
    }
  };
}

export function assessPerformanceSnapshot(publication = {}, snapshot = {}, { now = new Date().toISOString() } = {}) {
  const attribution = publication.attribution || {};
  const publishedAt = isoTime(publication.publishedAt);
  const evaluatedAt = isoTime(now) ?? Date.now();
  const window = snapshot.measurementWindow || "unspecified";
  const offset = STANDARD_FEEDBACK_WINDOWS[window];
  const dueAt = publishedAt !== null && offset !== undefined ? publishedAt + offset : null;
  const evidenceAt = isoTime(snapshot.cutoffAt || snapshot.windowEndedAt || snapshot.collectedAt);
  const cycleId = publication.cycleId || attribution.cycleId || null;
  const slotId = publication.slotId || attribution.slotId || null;
  const missingFields = [];
  if (!publication.platformContentId) missingFields.push("platformContentId");
  if (publishedAt === null) missingFields.push("publishedAt");
  if (!(publication.socialAccountId || publication.accountId || attribution.socialAccountId)) missingFields.push("socialAccountId");
  if (!(attribution.effectiveStrategyId || attribution.strategySnapshotId)) missingFields.push("strategyAttribution");
  if (!attribution.growthPlaybookId) missingFields.push("growthPlaybookId");
  const issues = missingFields.map((field) => ({ code: MISSING_FIELD_CODES[field], field, severity: "error" }));
  if (offset === undefined) issues.push({ code: "MEASUREMENT_WINDOW_UNSUPPORTED", field: "measurementWindow", severity: "error" });
  if (evidenceAt === null) issues.push({ code: "EVIDENCE_TIME_INVALID", field: "cutoffAt", severity: "error" });
  const early = dueAt !== null && (evidenceAt === null || evidenceAt < dueAt || evaluatedAt < dueAt);
  if (early) issues.push({ code: "MEASUREMENT_WINDOW_NOT_MATURE", field: "measurementWindow", severity: "error", dueAt: isoAt(dueAt), evidenceAt: isoAt(evidenceAt) });
  const accepted = issues.length === 0;
  const cycleBound = Boolean(cycleId && slotId);
  return {
    schemaVersion: "1.0",
    status: accepted ? "accepted" : "data_quality_issue",
    measurementWindow: window,
    dueAt: isoAt(dueAt),
    evidenceAt: isoAt(evidenceAt),
    evaluatedAt: isoAt(evaluatedAt),
    timing: dueAt === null || evidenceAt === null ? "unknown" : evidenceAt < dueAt ? "early" : evidenceAt === dueAt ? "on_deadline" : "late",
    missingFields,
    issues,
    cycleId,
    slotId,
    cycleBinding: cycleBound ? "bound" : "legacy_unbound",
    eligibleForContentDiagnosis: accepted,
    eligibleForCycleEvidence: accepted && cycleBound && ["7d", "final"].includes(window)
  };
}

export function buildPublicationMaturity(publication = {}, { now = new Date().toISOString() } = {}) {
  const evaluatedAt = isoTime(now) ?? Date.now();
  const publishedAt = isoTime(publication.publishedAt);
  const windows = Object.fromEntries(Object.entries(STANDARD_FEEDBACK_WINDOWS).map(([window, offset]) => {
    const dueTime = publishedAt === null ? null : publishedAt + offset;
    const history = list(publication.metricHistory).length ? list(publication.metricHistory) : [publication.latestMetrics].filter(Boolean);
    const revisions = history.filter((item) => item.measurementWindow === window);
    const assessed = revisions.map((snapshot) => ({ snapshot, assessment: assessPerformanceSnapshot(publication, snapshot, { now: isoAt(evaluatedAt) }) }));
    const accepted = assessed.filter((item) => item.assessment.status === "accepted").sort((left, right) => Number(right.snapshot.revision || 1) - Number(left.snapshot.revision || 1))[0] || null;
    const latest = [...assessed].sort((left, right) => Number(right.snapshot.revision || 1) - Number(left.snapshot.revision || 1))[0] || null;
    const status = accepted ? "captured" : latest?.assessment.status === "data_quality_issue" ? "data_quality_issue" : dueTime !== null && evaluatedAt >= dueTime ? "ready" : "awaiting";
    return [window, {
      dueAt: isoAt(dueTime),
      status,
      latestSnapshotId: latest?.snapshot.id || null,
      acceptedSnapshotId: accepted?.snapshot.id || null,
      revision: latest?.snapshot.revision || null,
      issues: latest?.assessment.issues || []
    }];
  }));
  const probe = assessPerformanceSnapshot(publication, { measurementWindow: "72h", cutoffAt: isoAt(publishedAt === null ? null : publishedAt + STANDARD_FEEDBACK_WINDOWS["72h"]) }, { now: isoAt(Math.max(evaluatedAt, publishedAt === null ? evaluatedAt : publishedAt + STANDARD_FEEDBACK_WINDOWS["72h"])) });
  const publicationIssues = probe.issues.filter((item) => !["MEASUREMENT_WINDOW_NOT_MATURE", "EVIDENCE_TIME_INVALID"].includes(item.code));
  let queueStage;
  if (publicationIssues.length || Object.values(windows).some((item) => item.status === "data_quality_issue")) queueStage = "data_quality_issue";
  else if (windows["7d"].status === "captured" || windows.final.status === "captured") queueStage = "mature";
  else if (windows["72h"].status === "awaiting") queueStage = "awaiting_72h";
  else if (windows["72h"].status === "ready") queueStage = "ready_for_72h";
  else if (windows["7d"].status === "awaiting") queueStage = "awaiting_7d";
  else queueStage = "ready_for_7d";
  const issueTargetWindow = ["72h", "7d", "final"].find((window) => windows[window].status === "data_quality_issue") || null;
  const progressionTargetWindow = windows["72h"].status !== "captured" ? "72h" : windows["7d"].status !== "captured" ? "7d" : null;
  const targetWindow = queueStage.includes("72h") ? "72h" : queueStage.includes("7d") ? "7d" : queueStage === "data_quality_issue" ? (issueTargetWindow || progressionTargetWindow) : null;
  const nextAllowedAction = queueStage === "data_quality_issue"
    ? "repair_required_fields_or_record_a_new_revision_after_due_at"
    : queueStage === "ready_for_72h" ? "record_72h_snapshot"
      : queueStage === "ready_for_7d" ? "record_7d_snapshot"
        : queueStage.startsWith("awaiting_") ? "wait_until_due_at" : "cycle_review_allowed_when_cycle_bound";
  const targetDueTime = targetWindow ? isoTime(windows[targetWindow].dueAt) : null;
  const windowIssues = Object.values(windows).filter((item) => item.status === "data_quality_issue").flatMap((item) => item.issues);
  return {
    schemaVersion: "1.0",
    evaluatedAt: isoAt(evaluatedAt),
    publishedAt: publication.publishedAt || null,
    queueStage,
    windows,
    missingFields: [...new Set(publicationIssues.map((item) => item.field).filter(Boolean))],
    qualityIssues: [...publicationIssues, ...windowIssues],
    cycleId: publication.cycleId || publication.attribution?.cycleId || null,
    slotId: publication.slotId || publication.attribution?.slotId || null,
    cycleBinding: publication.cycleId || publication.attribution?.cycleId ? (publication.slotId || publication.attribution?.slotId ? "bound" : "legacy_unbound") : "legacy_unbound",
    nextAllowedAction,
    distance: targetWindow ? { targetWindow, dueAt: windows[targetWindow].dueAt, remainingMs: targetDueTime === null ? null : Math.max(0, targetDueTime - evaluatedAt), state: queueStage } : null
  };
}

export function normalizePerformanceSnapshot(payload = {}, capturedAt = new Date().toISOString()) {
  const nestedMetrics = { ...object(payload.metrics), ...object(payload.platformMetrics) };
  const reportedMetricKeys = [];
  const known = {};
  const metricAvailability = {};
  for (const key of KNOWN_METRICS) {
    const candidate = payload[key] ?? nestedMetrics[key];
    const value = finiteMetric(candidate);
    if (value !== null) reportedMetricKeys.push(key);
    known[key] = value;
    metricAvailability[key] = value === null ? "missing" : "reported";
    delete nestedMetrics[key];
  }
  const platform = payload.platform || payload.sourceMetadata?.platform || "unknown";
  const allowedPlatformMetrics = PLATFORM_METRIC_KEYS[platform] || null;
  const platformMetrics = allowedPlatformMetrics
    ? Object.fromEntries(allowedPlatformMetrics.map((key) => [key, finiteMetric(nestedMetrics[key])]))
    : Object.fromEntries(Object.entries(nestedMetrics).filter(([, value]) => value !== undefined));
  for (const [canonical, aliases] of Object.entries(PLATFORM_METRIC_ALIASES[platform] || {})) {
    const candidate = aliases.map((key) => payload[key] ?? payload.metrics?.[key] ?? payload.platformMetrics?.[key]).find((value) => value !== undefined && value !== null && value !== "");
    const normalized = finiteMetric(candidate);
    if (normalized !== null) platformMetrics[canonical] = normalized;
  }
  const platformMetricAvailability = Object.fromEntries(Object.entries(platformMetrics).map(([key, value]) => [key, value === null ? "missing" : "reported"]));
  const businessSource = { ...object(payload.businessOutcome), ...object(payload.businessMetrics) };
  const businessOutcome = Object.fromEntries(BUSINESS_METRICS.map((key) => [key, finiteMetric(businessSource[key])]).filter(([, value]) => value !== null));
  const denominator = known.views ?? known.impressions ?? null;
  const weightedEngagement = [known.likes, known.saves, known.comments, known.shares].some((value) => value !== null)
    ? Number(known.likes || 0) + Number(known.saves || 0) * 2 + Number(known.comments || 0) * 2 + Number(known.shares || 0) * 3
    : null;
  const wasReported = (key) => reportedMetricKeys.includes(key);
  const denominatorReported = wasReported("views") || wasReported("impressions");
  const engagementReported = ["likes", "saves", "comments", "shares"].some(wasReported);
  return {
    id: `metrics_${randomUUID().slice(0, 8)}`,
    schemaVersion: "2.0",
    metricDictionaryVersion: payload.metricDictionaryVersion || METRIC_DICTIONARY_VERSION,
    ...known,
    rawMetrics: { ...object(payload.metrics), ...Object.fromEntries(KNOWN_METRICS.map((key) => [key, payload[key]]).filter(([, value]) => value !== undefined)) },
    metricAvailability,
    platformMetrics,
    platformMetricAvailability,
    availableCoreMetrics: CORE_METRICS_BY_PLATFORM[platform] || CORE_METRICS,
    platform,
    businessOutcome,
    reportedMetricKeys,
    derivedMetrics: {
      engagementRate: denominatorReported && engagementReported && weightedEngagement !== null ? rate(weightedEngagement, denominator) : null,
      saveRate: denominatorReported && wasReported("saves") ? rate(known.saves, denominator) : null,
      commentRate: denominatorReported && wasReported("comments") ? rate(known.comments, denominator) : null,
      followRate: denominatorReported && wasReported("follows") ? rate(known.follows, denominator) : null,
      leadRate: denominatorReported && wasReported("leads") ? rate(known.leads, denominator) : null,
      conversionRate: denominatorReported && wasReported("conversions") ? rate(known.conversions, denominator) : null
      ,coverClickRate: platform === "xiaohongshu" && Number.isFinite(platformMetrics.coverClicks) && wasReported("impressions") ? rate(platformMetrics.coverClicks, known.impressions) : null
      ,profileVisitRate: platform === "xiaohongshu" && Number.isFinite(platformMetrics.profileVisits) && denominatorReported ? rate(platformMetrics.profileVisits, denominator) : null
      ,openRate: platform === "wechat" && (Number.isFinite(platformMetrics.opens) || wasReported("views")) && Number.isFinite(platformMetrics.delivered) ? rate(platformMetrics.opens ?? known.views, platformMetrics.delivered) : null
      ,completionRate: platform === "wechat" && Number.isFinite(platformMetrics.completions) && (Number.isFinite(platformMetrics.opens) || wasReported("views")) ? rate(platformMetrics.completions, platformMetrics.opens ?? known.views) : null
      ,qualifiedLeadRate: Object.hasOwn(businessOutcome, "qualifiedLeads") && wasReported("leads") ? rate(businessOutcome.qualifiedLeads, known.leads) : null
    },
    // Keep legacy fields while existing planners migrate to derivedMetrics.
    engagementRate: denominatorReported && engagementReported && weightedEngagement !== null ? rate(weightedEngagement, denominator) : null,
    conversionRate: denominatorReported && wasReported("conversions") ? rate(known.conversions, denominator) : null,
    measurementWindow: payload.measurementWindow || payload.window || "unspecified",
    windowStartedAt: payload.windowStartedAt || null,
    windowEndedAt: payload.windowEndedAt || null,
    collectedAt: payload.collectedAt || capturedAt,
    source: payload.source || "manual",
    sourceMetadata: object(payload.sourceMetadata),
    importBatchId: payload.importBatchId || payload.sourceMetadata?.importBatchId || null,
    cutoffAt: payload.cutoffAt || payload.windowEndedAt || payload.collectedAt || capturedAt,
    revision: Number(payload.revision || 1),
    supersedesSnapshotId: payload.supersedesSnapshotId || null
  };
}

export function buildContentOutcomeReport(publication, task = null, { now = new Date().toISOString() } = {}) {
  const observedMetrics = latestMetric(publication);
  const metricCandidates = list(publication.metricHistory).length ? list(publication.metricHistory) : [publication.latestMetrics].filter(Boolean);
  const metrics = [...metricCandidates]
    .filter((snapshot) => assessPerformanceSnapshot(publication, snapshot, { now }).eligibleForContentDiagnosis)
    .sort((left, right) => {
      const priority = { unspecified: 0, custom: 0, "72h": 1, "7d": 2, final: 3 };
      return (priority[right.measurementWindow] || 0) - (priority[left.measurementWindow] || 0)
        || Number(right.revision || 1) - Number(left.revision || 1);
    })[0] || null;
  const attribution = publication.attribution || (task ? extractPublicationAttribution(task) : {});
  const maturity = buildPublicationMaturity(publication, { now });
  const assessment = metrics ? assessPerformanceSnapshot(publication, metrics, { now }) : null;
  const observedAssessment = observedMetrics ? assessPerformanceSnapshot(publication, observedMetrics, { now }) : null;
  return {
    id: `outcome_${publication.id}`,
    schemaVersion: "1.0",
    accountId: publication.accountId,
    publicationId: publication.id,
    contentTaskId: publication.contentTaskId,
    contentRunId: publication.contentRunId,
    platform: publication.platform,
    status: publication.status,
    publishedAt: publication.publishedAt,
    attribution,
    cycleId: publication.cycleId || attribution.cycleId || null,
    slotId: publication.slotId || attribution.slotId || null,
    maturity,
    dataQuality: {
      status: maturity.queueStage === "data_quality_issue" ? "issue" : "valid",
      missingFields: maturity.missingFields,
      qualityIssues: maturity.qualityIssues,
      selectedSnapshotAssessment: assessment,
      latestObservedSnapshotAssessment: observedAssessment,
      eligibleForContentDiagnosis: Boolean(assessment?.eligibleForContentDiagnosis),
      eligibleForCycleEvidence: Boolean(assessment?.eligibleForCycleEvidence)
    },
    latestObservedPerformanceSnapshotId: observedMetrics?.id || null,
    latestPerformanceSnapshotId: metrics?.id || null,
    measurementWindow: metrics?.measurementWindow || null,
    metrics: metrics ? {
      reportedMetricKeys: metrics.reportedMetricKeys || [],
      known: Object.fromEntries(KNOWN_METRICS.map((key) => [key, metrics[key] ?? null])),
      metricAvailability: metrics.metricAvailability || Object.fromEntries(KNOWN_METRICS.map((key) => [key, (metrics.reportedMetricKeys || []).includes(key) ? "reported" : "missing"])),
      platformMetrics: metrics.platformMetrics || {},
      platformMetricAvailability: metrics.platformMetricAvailability || {},
      availableCoreMetrics: metrics.availableCoreMetrics || CORE_METRICS_BY_PLATFORM[publication.platform] || CORE_METRICS,
      businessOutcome: metrics.businessOutcome || {},
      derived: metrics.derivedMetrics || { engagementRate: metrics.engagementRate, conversionRate: metrics.conversionRate }
    } : null,
    userFeedback: publication.userFeedback || {},
    evidenceRefs: [publication.id, metrics?.id].filter(Boolean),
    interpretationBoundary: "Observed result only; it must not be treated as a platform causal rule or directly mutate strategy."
  };
}

function aggregate(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(6)) : null;
}

function applyRealCycleEvidence(reviews = [], outcomes = []) {
  return reviews.map((review) => {
    const matched = outcomes.filter((outcome) => {
      const attribution = outcome.attribution || {};
      return (attribution.socialAccountId || outcome.accountId) === review.socialAccountId
        && (attribution.effectiveStrategyId || null) === (review.effectiveStrategyId || null)
        && (attribution.growthPlaybookId || null) === (review.growthPlaybookId || null);
    });
    const cycleIds = [...new Set(matched.map((item) => item.cycleId || item.attribution?.cycleId).filter(Boolean))];
    const repeatedPattern = Number(review.repeatedBottlenecks?.[0]?.count || 0) >= 3;
    const eligibleForStrategyReview = review.sampleSize >= 5 && cycleIds.length >= 2 && review.businessObservedCount >= 2 && repeatedPattern;
    return {
      ...review,
      cycleCount: cycleIds.length,
      cycleIds,
      eligibleForStrategyReview,
      confidence: eligibleForStrategyReview ? "high" : repeatedPattern ? "medium" : "low"
    };
  });
}

export function buildFeedbackWorkspace(store, { accountId = null, companyId = null, socialAccountId = null, strategySnapshotId = null, now = new Date().toISOString(), featureFlags = {} } = {}) {
  const tasks = new Map(list(store.contentTasks).map((task) => [task.id, task]));
  const atomicPublications = projectAtomicFeedbackPublications(store, { normalizeSnapshot: normalizePerformanceSnapshot, featureFlags });
  const atomicIdentities = new Set(atomicPublications.map(atomicPublicationIdentity));
  const legacyPublications = list(store.contentPublications)
    .filter((publication) => !atomicIdentities.has(atomicPublicationIdentity(publication)));
  const sourcePublications = [...legacyPublications, ...atomicPublications];
  const outcomes = sourcePublications
    .filter((publication) => {
      const task=tasks.get(publication.contentTaskId) || {};
      const attribution=publication.attribution || extractPublicationAttribution(task);
      const publicationCompanyId=attribution.companyId || publication.companyId || task.companyId || null;
      const publicationSocialAccountId=attribution.socialAccountId || publication.socialAccountId || publication.accountId || task.socialAccountId || task.accountId || null;
      if (companyId && publicationCompanyId !== companyId) return false;
      if (socialAccountId && publicationSocialAccountId !== socialAccountId) return false;
      return !accountId || publication.accountId === accountId || publicationCompanyId === accountId || publicationSocialAccountId === accountId;
    })
    .map((publication) => buildContentOutcomeReport(publication, tasks.get(publication.contentTaskId), { now }))
    .filter((outcome) => !strategySnapshotId || outcome.attribution.strategySnapshotId === strategySnapshotId);

  const groups = new Map();
  for (const outcome of outcomes.filter((item) => item.metrics && item.dataQuality?.eligibleForContentDiagnosis)) {
    const attribution = outcome.attribution || {};
    const key = [attribution.socialAccountId || outcome.accountId || "unknown", attribution.strategySnapshotId || "unbound", outcome.platform || "unknown", outcome.measurementWindow || "unspecified", attribution.objectiveId || "unknown", attribution.contentFunction || "unknown", attribution.contentPillarId || "unknown"].join("::");
    const group = groups.get(key) || { key, outcomes: [], attribution, platform: outcome.platform };
    group.outcomes.push(outcome);
    groups.set(key, group);
  }

  const learningSignals = [...groups.values()].map((group) => {
    const sampleSize = group.outcomes.length;
    const rates = (name) => group.outcomes.map((item) => item.metrics?.derived?.[name]).filter((value) => Number.isFinite(value));
    const measurementWindow = group.outcomes[0]?.measurementWindow || "unspecified";
    const eligibleForPatternReview = sampleSize >= 3
      && Boolean(group.attribution.strategySnapshotId)
      && Boolean(group.attribution.contentFunction)
      && measurementWindow !== "unspecified";
    return {
      id: `learning_${shortHash(group.key)}`,
      schemaVersion: "1.0",
      accountId: accountId || group.outcomes[0]?.accountId,
      strategySnapshotId: group.attribution.strategySnapshotId || null,
      platform: group.platform,
      measurementWindow,
      objectiveId: group.attribution.objectiveId || null,
      contentFunction: group.attribution.contentFunction || null,
      contentPillarId: group.attribution.contentPillarId || null,
      scope: eligibleForPatternReview ? "account_pattern_candidate" : "content_only",
      sampleSize,
      aggregateMetrics: {
        engagementRate: aggregate(rates("engagementRate")),
        saveRate: aggregate(rates("saveRate")),
        followRate: aggregate(rates("followRate")),
        leadRate: aggregate(rates("leadRate")),
        conversionRate: aggregate(rates("conversionRate"))
      },
      evidenceRefs: group.outcomes.flatMap((item) => item.evidenceRefs),
      eligibleForPatternReview,
      eligibleForStrategyReview: false,
      confidence: sampleSize >= 5 ? "medium" : "low",
      interpretation: eligibleForPatternReview
        ? "A comparable cohort exists; content agent may use it as a pattern candidate, not as a causal conclusion."
        : "Insufficient comparable samples; use only for content-level exploration."
    };
  });

  const diagnosisOutcomes = outcomes.filter((item) => item.dataQuality?.eligibleForContentDiagnosis);
  const cycleOutcomes = outcomes.filter((item) => item.dataQuality?.eligibleForCycleEvidence);
  const diagnoses = buildFunnelDiagnoses(diagnosisOutcomes);
  const cycleReviews = applyRealCycleEvidence(buildCycleReviews(cycleOutcomes, diagnoses), cycleOutcomes);
  const strategyReviewCandidates = buildStrategyReviewCandidates(cycleReviews);

  const strategySignalBundle = {
    schemaVersion: "2.0",
    kind: "PerformanceSignalBundle",
    accountId: socialAccountId || accountId,
    companyId,
    socialAccountId,
    strategySnapshotId,
    generatedAt: new Date().toISOString(),
    mode: "candidate_read_only",
    signals: strategyReviewCandidates,
    withheldSignals: learningSignals,
    policy: {
      autoApply: false,
      mayMutateActiveStrategy: false,
      requiresStrategyAgentReview: true,
      requiresUserConfirmationForNewStrategy: true
    }
  };
  const rollingPlanSignals = Object.values(outcomes.filter((item) => item.attribution?.rollingPlanId).reduce((groups, outcome) => {
    const planId = outcome.attribution.rollingPlanId;
    groups[planId] ||= { rollingPlanId: planId, companyId: outcome.attribution.companyId, socialAccountIds: new Set(), publicationCount: 0, measuredCount: 0, qualifiedLeads: 0, wonDeals: 0 };
    groups[planId].publicationCount += 1;
    if (outcome.metrics && outcome.dataQuality?.eligibleForContentDiagnosis) groups[planId].measuredCount += 1;
    if (outcome.attribution.socialAccountId) groups[planId].socialAccountIds.add(outcome.attribution.socialAccountId);
    groups[planId].qualifiedLeads += Number(outcome.metrics?.businessOutcome?.qualifiedLeads || 0);
    groups[planId].wonDeals += Number(outcome.metrics?.businessOutcome?.wonDeals || 0);
    return groups;
  }, {})).map((item) => ({ ...item, socialAccountIds: [...item.socialAccountIds], scope: "rolling_plan", recommendation: "用于下一轮滚动计划调整；不自动修改长期策略" }));
  const growthPlaybookSignals = Object.values(outcomes.filter((item) => item.attribution?.growthPlaybookId).reduce((groups, outcome) => {
    const key = `${outcome.attribution.socialAccountId || "unknown"}:${outcome.attribution.growthPlaybookId}`;
    groups[key] ||= {
      socialAccountId: outcome.attribution.socialAccountId || null,
      growthPlaybookId: outcome.attribution.growthPlaybookId,
      growthMode: outcome.attribution.growthMode || null,
      validationHypotheses: new Set(),
      publicationCount: 0,
      measuredCount: 0,
      qualifiedLeads: 0,
      wonDeals: 0
    };
    groups[key].publicationCount += 1;
    if (outcome.metrics && outcome.dataQuality?.eligibleForContentDiagnosis) groups[key].measuredCount += 1;
    if (outcome.attribution.validationHypothesis) groups[key].validationHypotheses.add(outcome.attribution.validationHypothesis);
    groups[key].qualifiedLeads += Number(outcome.metrics?.businessOutcome?.qualifiedLeads || 0);
    groups[key].wonDeals += Number(outcome.metrics?.businessOutcome?.wonDeals || 0);
    return groups;
  }, {})).map((item) => ({
    ...item,
    validationHypotheses: [...item.validationHypotheses],
    scope: "growth_playbook",
    recommendation: "达到观察窗口和样本门槛后，由策略 Agent 复核并由用户确认是否调整打法；不自动改写激活策略"
  }));
  const accountSnapshots = list(store.platformAccountSnapshots)
    .filter((snapshot) => !accountId || snapshot.accountId === accountId)
    .sort((left, right) => String(left.refDate || left.collectedAt).localeCompare(String(right.refDate || right.collectedAt)));
  return {
    schemaVersion: "2.2", accountId, companyId, socialAccountId, strategySnapshotId,
    sourceSummary: {
      authority: atomicPublications.length ? (legacyPublications.length ? "mixed_read_only" : "unified_atomic") : "legacy_read_only",
      atomicPublicationCount: atomicPublications.length,
      legacyPublicationCount: legacyPublications.length,
      deduplicatedLegacyCount: list(store.contentPublications).length - legacyPublications.length,
      atomicWriteAuthorized: false,
      strategyMutationAuthorized: false
    },
    outcomes, accountSnapshots, learningSignals, diagnoses, cycleReviews, strategyReviewCandidates,
    rollingPlanSignals, growthPlaybookSignals, strategySignalBundle
  };
}

export { KNOWN_METRICS };
