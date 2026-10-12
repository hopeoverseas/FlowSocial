const HOTSPOT_STATUSES = new Set([
  "discovered",
  "watching",
  "recommended",
  "active",
  "used",
  "ignored",
  "cooling",
  "expired",
  "archived"
]);
const HOTSPOT_RELEVANCE_TIERS = new Set(["direct", "bridge", "weak_experiment", "unrelated"]);

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizeHotspotRecord(item, now = new Date().toISOString()) {
  const status = HOTSPOT_STATUSES.has(item.status) ? item.status : "discovered";
  const sourceEvidence = list(item.sourceEvidence).map((evidence) => ({
    type: evidence.type || "source",
    source: evidence.source || evidence.sourcePlatform || "unknown",
    sourcePlatform: evidence.sourcePlatform || evidence.source || "unknown",
    url: evidence.url || evidence.sourceUrl || null,
    rawUrl: evidence.rawUrl || null,
    title: evidence.title || evidence.label || "",
    label: evidence.label || evidence.title || "",
    signal: evidence.signal || "",
    mode: evidence.mode || item.providerMode || item.providerTrace?.mode || "unknown",
    publishedAt: evidence.publishedAt || evidence.discoveredAt || null,
    capturedAt: evidence.capturedAt || item.collectedAt || item.discoveredAt || now
  }));
  const primaryEvidence = sourceEvidence.find((evidence) => evidence.url) || sourceEvidence[0] || {};
  const legacyRelevanceScore = Number(item.relevanceScore ?? item.score ?? 0);
  const relevanceTier = HOTSPOT_RELEVANCE_TIERS.has(item.relevanceTier)
    ? item.relevanceTier
    : legacyRelevanceScore >= 85
      ? "direct"
      : legacyRelevanceScore >= 70
        ? "bridge"
        : legacyRelevanceScore >= 50
          ? "weak_experiment"
          : "unrelated";
  const firstDiscoveredAt =
    item.firstDiscoveredAt || item.firstSeenAt || item.discoveredAt || item.createdAt || now;
  const lastUpdatedAt = item.lastUpdatedAt || item.lastSeenAt || item.updatedAt || now;
  const providerTrace = {
    provider: item.providerTrace?.provider || item.provider || "unknown",
    mode: item.providerTrace?.mode || item.providerMode || "unknown",
    stage: item.providerTrace?.stage || "collection",
    collectedAt:
      item.providerTrace?.collectedAt || item.collectedAt || item.discoveredAt || item.createdAt || now,
    warnings: list(item.providerTrace?.warnings).map((warning) => String(warning))
  };
  return {
    schemaVersion: "0.1",
    id: item.id,
    kind: "HotspotRecord",
    workspaceId: item.workspaceId || null,
    companyId: item.companyId || null,
    eventId: item.eventId || item.clusterId || null,
    title: item.title || "",
    summary: item.summary || "",
    sourcePlatform:
      item.sourcePlatform || item.platform || primaryEvidence.sourcePlatform || item.poolType || "unknown",
    sourceUrl: item.sourceUrl || item.url || primaryEvidence.url || null,
    collectedAt: item.collectedAt || item.discoveredAt || item.createdAt || now,
    discoveredAt: item.discoveredAt || firstDiscoveredAt,
    firstDiscoveredAt,
    lastUpdatedAt,
    updatedAt: item.updatedAt || lastUpdatedAt,
    lifecycle: item.lifecycle || (status === "archived" ? "expired" : "active"),
    status,
    relevanceScore: legacyRelevanceScore,
    relevanceTier,
    relevanceReason: item.relevanceReason || "",
    requiresSecondConfirmation:
      typeof item.requiresSecondConfirmation === "boolean"
        ? item.requiresSecondConfirmation
        : relevanceTier === "weak_experiment",
    directionId: item.directionId || null,
    strategySnapshotId: item.strategySnapshotId || null,
    accountId: item.accountId || null,
    poolType: item.poolType || null,
    relatedPillars: list(item.relatedPillars),
    suitableAudiences: list(item.suitableAudiences),
    recommendedAngles: list(item.recommendedAngles || item.angles),
    sourceEvidence,
    providerMode: providerTrace.mode,
    providerTrace,
    risks: list(item.risks),
    seenCount: Math.max(1, Number(item.seenCount) || 1),
    committedPreviewItems: Array.from(new Set(list(item.committedPreviewItems).map(String))),
    usedByContentRunIds: Array.from(new Set(list(item.usedByContentRunIds))),
    usedByContentTaskIds: Array.from(new Set(list(item.usedByContentTaskIds))),
    usedByContentIds: Array.from(new Set(list(item.usedByContentIds)))
  };
}

export function normalizeReferencePost(item, now = new Date().toISOString()) {
  return {
    schemaVersion: "0.1",
    id: item.id,
    platform: item.platform || "unknown",
    sourceUrl: item.sourceUrl || item.url || null,
    author: item.author || null,
    title: item.title || "",
    rawText: item.rawText || item.text || "",
    transcript: item.transcript || "",
    mediaAssetIds: list(item.mediaAssetIds),
    metrics: item.metrics || {},
    savedReason: item.savedReason || "",
    usageBoundary: item.usageBoundary || "structure_only",
    status: item.status || "pending_analysis",
    analysisId: item.analysisId || null,
    extractionMode: item.extractionMode || null,
    createdAt: item.createdAt || now
  };
}

export function normalizeViralBlueprint(item, now = new Date().toISOString()) {
  const sourceIds = list(item.sourceReferenceIds || item.sourceIds);
  return {
    schemaVersion: "0.1",
    id: item.id,
    name: item.name || item.viralType || "未命名表达蓝图",
    sourceReferenceIds: sourceIds,
    bestFor: list(item.bestFor || item.suitablePlatforms),
    goals: list(item.goals),
    hookType: item.hookType || null,
    titleFormula: item.titleFormula || "",
    openingFormula: item.openingFormula || "",
    bodyStructure: list(item.bodyStructure || item.bodyFormula || item.structure),
    closingFormula: item.closingFormula || item.interactionFormula || "",
    visualRules: item.visualRules || {},
    requiredEvidence: list(item.requiredEvidence),
    suitableTopics: list(item.suitableTopics),
    doNotCopy: list(item.doNotCopy || item.forbiddenReplication),
    status: item.status || "draft",
    extractionMode: item.extractionMode || "unknown",
    usedByContentIds: list(item.usedByContentIds),
    createdAt: item.createdAt || now
  };
}
