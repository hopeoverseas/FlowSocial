import { randomUUID } from "node:crypto";
import {
  normalizeHotspotRecord,
  normalizeReferencePost,
  normalizeViralBlueprint
} from "./library-contracts.mjs";

function canonicalHotspotTitle(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function titleBigrams(value = "") {
  const normalized = canonicalHotspotTitle(value);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2)));
}

function titleSimilarity(left, right) {
  const leftTitle = canonicalHotspotTitle(left);
  const rightTitle = canonicalHotspotTitle(right);
  if (!leftTitle || !rightTitle) return 0;
  if (leftTitle === rightTitle) return 1;
  if (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle)) {
    return Math.min(leftTitle.length, rightTitle.length) / Math.max(leftTitle.length, rightTitle.length);
  }
  const leftSet = titleBigrams(leftTitle);
  const rightSet = titleBigrams(rightTitle);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function sameHotspotScope(left, right) {
  return (
    (left.companyId || null) === (right.companyId || null) &&
    (left.poolType || null) === (right.poolType || null) &&
    (left.directionId || null) === (right.directionId || null)
  );
}

function isSameHotspotEvent(left, right) {
  if (!sameHotspotScope(left, right)) return false;
  if (left.eventId && right.eventId && left.eventId === right.eventId) return true;
  return titleSimilarity(left.originalTitle || left.title, right.originalTitle || right.title) >= 0.72;
}

function mergeEvidence(...collections) {
  const entries = collections.flat().filter(Boolean);
  const keyed = new Map();
  for (const entry of entries) {
    const key = entry.url || entry.sourceUrl || `${entry.source || entry.sourcePlatform || "unknown"}|${entry.title || ""}`;
    if (!keyed.has(key)) keyed.set(key, entry);
  }
  return [...keyed.values()].slice(0, 20);
}

export function ensureHotspotLibrary(store) {
  store.hotspotPreviews ||= [];
  store.hotspotLibrary ||= (store.opportunities || [])
    .filter((item) => item.poolType === "global" || item.poolType === "keyword")
    .map((item) =>
      normalizeHotspotRecord({
        ...item,
        companyId: item.companyId || null,
        status: item.status === "ignored" ? "ignored" : "active",
        firstDiscoveredAt: item.createdAt || item.collectedAt,
        lastUpdatedAt: item.collectedAt || item.createdAt,
        seenCount: 1
      })
    );
  store.hotspotLibrary = store.hotspotLibrary.map((item) => normalizeHotspotRecord(item));
  return store.hotspotLibrary;
}

export function commitHotspotPreview(
  store,
  preview,
  { selectedIds = [], companyId = null, committedBy = "user" } = {}
) {
  if (!preview) {
    const error = new Error("热点预览不存在，请重新采集后再试");
    error.code = "HOTSPOT_PREVIEW_NOT_FOUND";
    throw error;
  }
  const requestedIds = Array.from(new Set((selectedIds || []).map(String).filter(Boolean)));
  if (!requestedIds.length) {
    const error = new Error("必须明确选择至少一个热点后才能加入热点库");
    error.code = "HOTSPOT_SELECTION_REQUIRED";
    throw error;
  }
  if (companyId && preview.companyId && preview.companyId !== companyId) {
    const error = new Error("该热点预览不属于当前工作区");
    error.code = "HOTSPOT_PREVIEW_SCOPE_MISMATCH";
    throw error;
  }
  const opportunities = preview.opportunities || [];
  const byId = new Map(opportunities.map((item) => [String(item.id), item]));
  const missingIds = requestedIds.filter((itemId) => !byId.has(itemId));
  if (missingIds.length) {
    const error = new Error(`所选热点已失效或不在当前预览中：${missingIds.join("、")}`);
    error.code = "HOTSPOT_PREVIEW_ITEM_NOT_FOUND";
    throw error;
  }

  const library = ensureHotspotLibrary(store);
  const committedAt = new Date().toISOString();
  preview.commitMappings ||= [];
  const existingMappings = new Map(
    preview.commitMappings.map((mapping) => [String(mapping.previewItemId), mapping])
  );
  const mappings = [];
  let added = 0;
  let updated = 0;
  let duplicates = 0;

  for (const previewItemId of requestedIds) {
    const priorMapping = existingMappings.get(previewItemId);
    if (priorMapping) {
      const existingAsset = library.find((item) => item.id === priorMapping.hotspotAssetId);
      if (existingAsset) {
        mappings.push({ ...priorMapping, idempotentReplay: true });
        continue;
      }
    }

    const incoming = normalizeHotspotRecord({
      ...byId.get(previewItemId),
      id: `hotspot_${randomUUID().slice(0, 12)}`,
      companyId: preview.companyId || companyId || null,
      providerTrace: byId.get(previewItemId).providerTrace || preview.run?.providerTrace,
      providerMode: byId.get(previewItemId).providerMode || preview.run?.mode,
      collectedAt: byId.get(previewItemId).collectedAt || preview.createdAt || committedAt,
      firstDiscoveredAt: byId.get(previewItemId).firstDiscoveredAt || preview.createdAt || committedAt,
      lastUpdatedAt: committedAt,
      status: "active",
      committedPreviewItems: [`${preview.id}:${previewItemId}`]
    });
    const existingIndex = library.findIndex((item) => isSameHotspotEvent(item, incoming));
    let hotspotAsset;
    if (existingIndex < 0) {
      hotspotAsset = incoming;
      library.unshift(hotspotAsset);
      added += 1;
    } else {
      const existing = normalizeHotspotRecord(library[existingIndex]);
      const commitKey = `${preview.id}:${previewItemId}`;
      const alreadySeen = existing.committedPreviewItems.includes(commitKey);
      hotspotAsset = normalizeHotspotRecord({
        ...existing,
        ...incoming,
        id: existing.id,
        status: existing.status === "ignored" ? "ignored" : "active",
        firstDiscoveredAt: existing.firstDiscoveredAt,
        discoveredAt: existing.discoveredAt,
        lastUpdatedAt: committedAt,
        sourceEvidence: mergeEvidence(existing.sourceEvidence, incoming.sourceEvidence),
        providerTrace: {
          ...incoming.providerTrace,
          warnings: Array.from(
            new Set([...(existing.providerTrace?.warnings || []), ...(incoming.providerTrace?.warnings || [])])
          )
        },
        seenCount: alreadySeen ? existing.seenCount : existing.seenCount + 1,
        committedPreviewItems: [...existing.committedPreviewItems, commitKey],
        usedByContentRunIds: existing.usedByContentRunIds,
        usedByContentTaskIds: existing.usedByContentTaskIds,
        usedByContentIds: existing.usedByContentIds
      });
      library[existingIndex] = hotspotAsset;
      updated += alreadySeen ? 0 : 1;
      duplicates += 1;
    }
    const mapping = {
      previewId: preview.id,
      previewItemId,
      hotspotAssetId: hotspotAsset.id,
      committedAt,
      committedBy
    };
    preview.commitMappings.push(mapping);
    mappings.push(mapping);
  }

  const committedIds = new Set(preview.commitMappings.map((mapping) => String(mapping.previewItemId)));
  preview.status = committedIds.size >= opportunities.length ? "committed" : "partially_committed";
  preview.committedAt = committedAt;
  preview.commitStats = {
    searched: preview.run?.stats?.collected || 0,
    eligible: requestedIds.length,
    added,
    updated,
    duplicates,
    ignored: 0,
    sourceFailures: preview.run?.warnings?.length || 0
  };
  return {
    ...preview.commitStats,
    mappings,
    items: mappings
      .map((mapping) => library.find((item) => item.id === mapping.hotspotAssetId))
      .filter(Boolean)
  };
}

export function assertHotspotContentEligibility(hotspot, { weakExperimentConfirmed = false } = {}) {
  if (!hotspot) {
    const error = new Error("热点资产不存在或尚未加入热点库");
    error.code = "HOTSPOT_ASSET_NOT_FOUND";
    throw error;
  }
  if (["ignored", "expired", "archived"].includes(hotspot.status) || hotspot.lifecycle === "expired") {
    const error = new Error("该热点已失效或被忽略，不能用于内容生成");
    error.code = "HOTSPOT_ASSET_INACTIVE";
    throw error;
  }
  if (!hotspot.sourceUrl && !(hotspot.sourceEvidence || []).some((item) => item.url)) {
    const error = new Error("该热点缺少可追溯来源链接，不能进入内容生成");
    error.code = "HOTSPOT_SOURCE_URL_REQUIRED";
    throw error;
  }
  if (hotspot.relevanceTier === "unrelated") {
    const error = new Error("该热点与当前业务无关，禁止进入内容生成");
    error.code = "HOTSPOT_UNRELATED";
    throw error;
  }
  if (hotspot.relevanceTier === "weak_experiment" && !weakExperimentConfirmed) {
    const error = new Error("弱相关热点需要用户二次确认后才能进入内容生成");
    error.code = "HOTSPOT_WEAK_CONFIRMATION_REQUIRED";
    throw error;
  }
  return hotspot;
}

function ids(store) {
  return {
    references: new Set((store.referencePosts || []).map((item) => item.analysisId).filter(Boolean)),
    blueprints: new Set((store.viralBlueprintLibrary || []).flatMap((item) => item.sourceReferenceIds || []))
  };
}

export function ensureReferenceLibraries(store) {
  store.referencePosts ||= [];
  store.viralBlueprintLibrary ||= [];
  const known = ids(store);
  for (const analysis of store.referenceAnalyses || []) {
    if (!known.references.has(analysis.id)) {
      const referenceId = analysis.referencePostId || `reference_${analysis.id}`;
      store.referencePosts.push(normalizeReferencePost({
        id: referenceId,
        ...analysis.reference,
        analysisId: analysis.id,
        extractionMode: "demo_rule_based",
        status: "analyzed_demo",
        createdAt: analysis.createdAt
      }));
      analysis.referencePostId = referenceId;
      known.references.add(analysis.id);
    }
    const referenceId = analysis.referencePostId || `reference_${analysis.id}`;
    if (analysis.blueprint && !known.blueprints.has(referenceId)) {
      const blueprintId = analysis.blueprintId || `blueprint_${analysis.id}`;
      store.viralBlueprintLibrary.push(normalizeViralBlueprint({
        id: blueprintId,
        ...analysis.blueprint,
        sourceReferenceIds: [referenceId],
        doNotCopy: analysis.doNotCopy || analysis.blueprint.forbiddenReplication,
        extractionMode: "demo_rule_based",
        status: "needs_skill_upgrade",
        createdAt: analysis.createdAt
      }));
      analysis.blueprintId = blueprintId;
      known.blueprints.add(referenceId);
    }
  }
  return { referencePosts: store.referencePosts, viralBlueprints: store.viralBlueprintLibrary };
}

export function recordReferenceAnalysis(store, payload, analysis) {
  ensureReferenceLibraries(store);
  const referenceId = `reference_${analysis.id}`;
  const blueprintId = `blueprint_${analysis.id}`;
  const referencePost = normalizeReferencePost({
    id: referenceId,
    platform: payload.platform || analysis.reference?.platform,
    sourceUrl: payload.url || analysis.reference?.url,
    author: payload.author || null,
    title: payload.title || analysis.reference?.title,
    rawText: payload.rawText || payload.text || "",
    transcript: payload.transcript || "",
    mediaAssetIds: payload.mediaAssetIds || [],
    metrics: payload.metrics || analysis.baseData?.metrics || {},
    savedReason: payload.savedReason || "",
    usageBoundary: payload.usageBoundary || "structure_only",
    status: "analyzed_demo",
    analysisId: analysis.id,
    extractionMode: "demo_rule_based",
    createdAt: analysis.createdAt
  });
  const viralBlueprint = normalizeViralBlueprint({
    id: blueprintId,
    ...analysis.blueprint,
    sourceReferenceIds: [referenceId],
    doNotCopy: analysis.doNotCopy || analysis.blueprint?.forbiddenReplication,
    extractionMode: "demo_rule_based",
    status: "needs_skill_upgrade",
    createdAt: analysis.createdAt
  });
  store.referencePosts = (store.referencePosts || []).filter((item) => item.id !== referenceId);
  store.referencePosts.push(referencePost);
  store.viralBlueprintLibrary = (store.viralBlueprintLibrary || []).filter((item) => item.id !== blueprintId);
  store.viralBlueprintLibrary.push(viralBlueprint);
  analysis.referencePostId = referenceId;
  analysis.blueprintId = blueprintId;
  analysis.extractionMode = "demo_rule_based";
  analysis.productionReady = false;
  return { referencePost, viralBlueprint };
}

export function recordContentSourceUsage(store, task) {
  ensureReferenceLibraries(store);
  ensureHotspotLibrary(store);
  const hotspotIds = new Set(task.contentSourceEvidence?.hotspots?.map((item) => item.id) || []);
  const blueprintIds = new Set(task.contentSourceEvidence?.viralBlueprints?.map((item) => item.id) || []);
  for (const hotspot of store.hotspotLibrary || []) {
    if (!hotspotIds.has(hotspot.id)) continue;
    const contentRunId = task.contentRunId || task.runId || task.workflowId || null;
    hotspot.usedByContentRunIds = contentRunId
      ? [...new Set([...(hotspot.usedByContentRunIds || []), contentRunId])]
      : [...new Set(hotspot.usedByContentRunIds || [])];
    hotspot.usedByContentTaskIds = [...new Set([...(hotspot.usedByContentTaskIds || []), task.id])];
    hotspot.usedByContentIds = [...new Set([...(hotspot.usedByContentIds || []), task.id])];
    hotspot.lastUsedAt = task.createdAt;
  }
  for (const blueprint of store.viralBlueprintLibrary || []) {
    if (!blueprintIds.has(blueprint.id)) continue;
    blueprint.usedByContentIds = [...new Set([...(blueprint.usedByContentIds || []), task.id])];
    blueprint.lastUsedAt = task.createdAt;
  }
}
