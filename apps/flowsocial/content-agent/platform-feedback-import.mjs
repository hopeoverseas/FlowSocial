import { createHash, randomUUID } from "node:crypto";
import { mapMetricRow, metricValue, METRIC_DICTIONARY_VERSION } from "./metric-dictionary.mjs";
import { recordPublication, recordPublicationMetrics } from "./publishing-feedback.mjs";
import { confirmAtomicPublicationFeedback, previewAtomicPublicationFeedback } from "./atomic-publication-feedback-store.mjs";
import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { confirmAtomicBusinessOutcome } from "./atomic-business-outcome-store.mjs";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? "").trim();

function stableId(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function normalizedTitle(value) {
  return text(value).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function valueByAliases(row, aliases) {
  const index = new Map(Object.entries(row || {}).map(([key, value]) => [key.trim().toLowerCase().replace(/[\s_\-（）()]/g, ""), value]));
  for (const alias of aliases) {
    const value = index.get(alias.toLowerCase().replace(/[\s_\-（）()]/g, ""));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export function parseFeedbackCsv(csvText = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(csvText).replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
    } else cell += character;
  }
  row.push(cell);
  if (row.some((item) => item !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => text(item));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function metadataFromRow(row) {
  return {
    platformContentId: text(valueByAliases(row, ["platformContentId", "contentId", "笔记ID", "文章ID", "msgid"])) || null,
    url: text(valueByAliases(row, ["url", "link", "内容链接", "笔记链接", "文章链接"])) || null,
    title: text(valueByAliases(row, ["title", "标题", "笔记标题", "文章标题"])) || null,
    publishedAt: text(valueByAliases(row, ["publishedAt", "publishTime", "发布时间", "发布日期"])) || null,
    measurementWindow: text(valueByAliases(row, ["measurementWindow", "window", "观察窗口"])) || "72h",
    cutoffAt: text(valueByAliases(row, ["cutoffAt", "统计截止时间", "数据截止时间"])) || null,
    contentTaskId: text(valueByAliases(row, ["contentTaskId", "任务ID"])) || null,
    publicationId: text(valueByAliases(row, ["publicationId", "发布记录ID"])) || null
  };
}

function businessFromRow(row) {
  const aliases = {
    qualifiedLeads: ["qualifiedLeads", "有效线索", "合格线索"],
    salesAcceptedLeads: ["salesAcceptedLeads", "销售接受线索"],
    proposals: ["proposals", "方案数", "报价数"],
    wonDeals: ["wonDeals", "成交数"],
    revenue: ["revenue", "收入", "成交金额"]
  };
  return Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, metricValue(valueByAliases(row, names))]).filter(([, value]) => value !== null));
}

function atomicPublicationTitle(store, publication) {
  const commit = list(store.unifiedAtomicContentCommits).find((item) => item?.id === publication.commitRef?.id && item?.commitHash === publication.commitRef?.hash);
  return commit?.candidate?.title || commit?.materializedComponents?.article?.title || null;
}

function findMatch(store, accountId, platform, metadata) {
  const atomicPublications = list(store.unifiedAtomicManualPublications).filter((item) => item.accountId === accountId && item.platform === platform);
  const legacyPublications = list(store.contentPublications).filter((item) => item.accountId === accountId && item.platform === platform);
  const exact = (publication, authority, method) => ({
    status: "exact",
    authority,
    publicationId: publication.id,
    projectId: authority === "unified_atomic" ? publication.contentProjectRef?.id || null : null,
    method
  });
  if (metadata.publicationId) {
    const atomic = atomicPublications.find((item) => item.id === metadata.publicationId);
    if (atomic) return exact(atomic, "unified_atomic", "explicit_publication_id");
    const legacy = legacyPublications.find((item) => item.id === metadata.publicationId);
    if (legacy) return exact(legacy, "legacy_content_publication", "explicit_publication_id");
  }
  if (metadata.contentTaskId) {
    const legacy = legacyPublications.find((item) => item.contentTaskId === metadata.contentTaskId);
    if (legacy) return exact(legacy, "legacy_content_publication", "explicit_content_task_id");
  }
  if (metadata.platformContentId) {
    const atomic = atomicPublications.find((item) => item.canonicalPlatformContentId === metadata.platformContentId);
    if (atomic) return exact(atomic, "unified_atomic", "platform_content_id");
    const legacy = legacyPublications.find((item) => item.platformContentId === metadata.platformContentId || item.sourceMetadata?.platformContentId === metadata.platformContentId);
    if (legacy) return exact(legacy, "legacy_content_publication", "platform_content_id");
  }
  if (metadata.url) {
    const atomic = atomicPublications.find((item) => item.canonicalPlatformUrl === metadata.url);
    if (atomic) return exact(atomic, "unified_atomic", "content_url");
    const legacy = legacyPublications.find((item) => item.url === metadata.url || item.sourceMetadata?.contentUrl === metadata.url);
    if (legacy) return exact(legacy, "legacy_content_publication", "content_url");
  }
  if (metadata.title) {
    const taskIds = new Map(list(store.contentTasks).map((task) => [task.id, normalizedTitle(task.currentContent?.post_copy?.recommended_title || task.currentContent?.recommended_title || task.ideaTitle)]));
    const atomicCandidates = atomicPublications.filter((item) => normalizedTitle(atomicPublicationTitle(store, item)) === normalizedTitle(metadata.title));
    const legacyCandidates = legacyPublications.filter((item) => taskIds.get(item.contentTaskId) === normalizedTitle(metadata.title));
    const candidates = [
      ...atomicCandidates.map((item) => ({ publicationId: item.id, authority: "unified_atomic", projectId: item.contentProjectRef?.id || null })),
      ...legacyCandidates.map((item) => ({ publicationId: item.id, authority: "legacy_content_publication", projectId: null }))
    ];
    if (candidates.length) return { status: "candidate", candidates, candidatePublicationIds: candidates.map((item) => item.publicationId), method: "title_review_required" };
  }
  return { status: "unmatched", method: "none" };
}

export function previewMetricImport(store, { accountId, platform, rows = null, csvText = null, source = "platform_export" }, { featureFlags = {} } = {}) {
  if (!accountId || !["xiaohongshu", "wechat"].includes(platform)) throw Object.assign(new Error("accountId and a supported platform are required"), { statusCode: 400 });
  const inputRows = Array.isArray(rows) ? rows : parseFeedbackCsv(csvText);
  if (!inputRows.length) throw Object.assign(new Error("import requires at least one data row"), { statusCode: 400 });
  store.metricImportBatches ||= [];
  const batchId = `metric_import_${randomUUID().slice(0, 8)}`;
  const normalizedRows = inputRows.map((raw, index) => {
    const metadata = metadataFromRow(raw);
    const mapped = mapMetricRow(raw, platform);
    const match = findMatch(store, accountId, platform, metadata);
    return {
      id: `import_row_${stableId(`${batchId}:${index}`)}`,
      rowNumber: index + 2,
      rawEvidence: { ...raw },
      metadata,
      metrics: mapped.metrics,
      platformMetrics: mapped.platformMetrics,
      businessOutcome: businessFromRow(raw),
      unmapped: mapped.unmapped,
      match,
      qualityIssues: [
        ...(!metadata.platformContentId && !metadata.url && !metadata.title && !metadata.publicationId && !metadata.contentTaskId ? ["CONTENT_IDENTITY_MISSING"] : []),
        ...(!Object.keys(mapped.metrics).length && !Object.keys(mapped.platformMetrics).length ? ["METRICS_MISSING"] : []),
        ...(match.status === "candidate" ? ["MATCH_REQUIRES_CONFIRMATION"] : []),
        ...(match.status === "unmatched" ? ["PUBLICATION_NOT_MATCHED"] : []),
        ...(match.authority === "unified_atomic" && featureFlags.atomicExactFeedbackV1 !== true ? ["ATOMIC_EXACT_FEEDBACK_DISABLED"] : [])
      ]
    };
  });
  const batch = {
    id: batchId,
    kind: "MetricImportBatch",
    schemaVersion: "1.0",
    metricDictionaryVersion: METRIC_DICTIONARY_VERSION,
    accountId,
    platform,
    source,
    status: "preview",
    rowCount: normalizedRows.length,
    exactMatchCount: normalizedRows.filter((item) => item.match.status === "exact").length,
    reviewCount: normalizedRows.filter((item) => item.match.status !== "exact").length,
    rows: normalizedRows,
    createdAt: new Date().toISOString(),
    confirmedAt: null
  };
  store.metricImportBatches.push(batch);
  return batch;
}

function atomicMetrics(platform, row) {
  const all = { ...row.metrics, ...row.platformMetrics };
  const aliases = platform === "wechat"
    ? { views: "reads", likes: "likes", saves: "favorites", comments: "comments", shares: "shares", follows: "newFollowers", unfollows: "unfollows", leads: "leads", conversions: "conversions" }
    : { impressions: "impressions", views: "views", likes: "likes", saves: "saves", comments: "comments", shares: "shares", follows: "follows", leads: "leads", conversions: "conversions", profileVisits: "profileVisits", coverClicks: "coverClicks" };
  return Object.fromEntries(Object.entries(aliases)
    .map(([source, target]) => [target, metricValue(all[source])])
    .filter(([, value]) => Number.isSafeInteger(value) && value >= 0));
}

function atomicMeasurementWindow(publication, row) {
  const label = ["72h", "7d", "final", "custom"].includes(row.metadata.measurementWindow) ? row.metadata.measurementWindow : "custom";
  const startedAt = publication.publishedAt;
  const canonicalHours = label === "72h" ? 72 : label === "7d" ? 168 : null;
  const endedAt = canonicalHours
    ? new Date(Date.parse(startedAt) + canonicalHours * 36e5).toISOString()
    : new Date(row.metadata.cutoffAt).toISOString();
  return { label, startedAt, endedAt };
}

function confirmAtomicImportRow(store, batch, row, publication, confirmedBy, featureFlags) {
  const metrics = atomicMetrics(batch.platform, row);
  if (!Object.keys(metrics).length) throw Object.assign(new Error("atomic import row has no supported integer platform metrics"), { code: "ATOMIC_METRICS_MISSING" });
  const request = {
    workspaceId: publication.workspaceId,
    companyId: publication.companyId,
    accountId: publication.accountId,
    platform: publication.platform,
    projectId: publication.contentProjectRef.id,
    publicationRef: { id: publication.id, hash: publication.factHash },
    platformContentId: publication.canonicalPlatformContentId,
    platformUrl: publication.canonicalPlatformUrl
  };
  const preflight = previewAtomicPublicationFeedback(store, request, { featureFlags });
  const collectedAt = new Date().toISOString();
  const atomicKeys = [
    "unifiedAtomicPublicationMetricSnapshots",
    "unifiedAtomicMetricImportBatches",
    "unifiedAtomicPublicationSnapshotLifecycleBindings",
    "unifiedAtomicBusinessOutcomeSnapshots"
  ];
  const checkpoint = new Map(atomicKeys.map((key) => [key, {
    existed: Object.hasOwn(store, key),
    value: store[key]
  }]));
  try {
    const confirmed = confirmAtomicPublicationFeedback(store, {
    request,
    previewToken: preflight.previewToken,
    requestHash: preflight.requestHash,
    idempotencyKey: `metric-import:${batch.id}:${row.id}:${publication.id}:${row.metadata.measurementWindow}`,
    measurementWindow: atomicMeasurementWindow(publication, row),
    cutoffAt: new Date(row.metadata.cutoffAt).toISOString(),
    collectedAt,
    source: {
      kind: "csv_import",
      rawRowHash: hashUnifiedContent(row.rawEvidence),
      batchId: batch.id,
      rowNumber: row.rowNumber,
      row: { publicationId: publication.id, platformContentId: publication.canonicalPlatformContentId }
    },
    actorType: "user",
    actorId: confirmedBy || "workspace_user",
    metrics
    }, { featureFlags, now: collectedAt });
    const outcomes = row.businessOutcome || {};
    const business = Object.keys(outcomes).length ? confirmAtomicBusinessOutcome(store, {
    workspaceId: publication.workspaceId,
    companyId: publication.companyId,
    accountId: publication.accountId,
    platform: publication.platform,
    contentProjectRef: publication.contentProjectRef,
    publicationRef: { id: publication.id, hash: publication.factHash },
    metricSnapshotRef: { id: confirmed.snapshot.id, hash: confirmed.snapshot.snapshotHash },
    outcomes,
    source: { kind: "csv_import", batchId: batch.id, rowNumber: row.rowNumber, rawRowHash: hashUnifiedContent(row.rawEvidence) },
    actorType: "user",
    actorId: confirmedBy || "workspace_user",
    idempotencyKey: `business-outcome:${batch.id}:${row.id}:${publication.id}:${row.metadata.measurementWindow}`
    }, { featureFlags, now: collectedAt }) : null;
    return { ...confirmed, businessOutcomeSnapshot: business?.snapshot || null };
  } catch (error) {
    // Metric and business facts form one local import unit. Restore the exact
    // pre-call array references if the second fact cannot be confirmed.
    for (const [key, state] of checkpoint) {
      if (state.existed) store[key] = state.value;
      else delete store[key];
    }
    throw error;
  }
}

function createHistoricalPublication(store, batch, row) {
  if (!row.metadata.publishedAt || !Number.isFinite(Date.parse(row.metadata.publishedAt))) {
    throw Object.assign(new Error("historical import requires an actual publishedAt"), { statusCode: 400, code: "HISTORICAL_PUBLISHED_AT_REQUIRED" });
  }
  const account = list(store.accounts).find((item) => item.id === batch.accountId) || {};
  const task = {
    id: `content_import_${stableId(`${batch.accountId}:${row.metadata.platformContentId || row.metadata.url || row.metadata.title}:${row.metadata.publishedAt}`)}`,
    schemaVersion: "1.0",
    workspaceId: account.workspaceId || "workspace_default",
    companyId: account.companyId || null,
    socialAccountId: batch.accountId,
    accountId: batch.accountId,
    platform: batch.platform,
    status: "historical_import",
    sourceType: "platform_history_import",
    ideaTitle: row.metadata.title || "历史平台内容",
    currentContent: batch.platform === "xiaohongshu" ? { post_copy: { recommended_title: row.metadata.title || "历史平台内容" } } : { recommended_title: row.metadata.title || "历史平台内容" },
    contentIdentity: { topic: row.metadata.title || "历史平台内容", sourceIds: [] },
    version: 1,
    createdAt: row.metadata.publishedAt,
    updatedAt: new Date().toISOString()
  };
  store.contentTasks ||= [];
  if (!store.contentTasks.some((item) => item.id === task.id)) store.contentTasks.push(task);
  const publication = recordPublication(store, task, { status: "published", platform: batch.platform, platformContentId: row.metadata.platformContentId, url: row.metadata.url, publishedAt: row.metadata.publishedAt, adoptionStatus: "historical_import" });
  return publication;
}

export function confirmMetricImport(store, batchId, { resolutions = {}, allowHistoricalImport = false, confirmedBy = "user" } = {}, { featureFlags = {} } = {}) {
  const batch = list(store.metricImportBatches).find((item) => item.id === batchId);
  if (!batch) throw Object.assign(new Error("metric import batch not found"), { statusCode: 404 });
  if (batch.status === "confirmed") return batch;
  const results = [];
  for (const row of batch.rows) {
    const resolution = resolutions[row.id] || {};
    if (!row.metadata.cutoffAt || !Number.isFinite(Date.parse(row.metadata.cutoffAt))) {
      results.push({ rowId: row.id, status: "skipped", reason: "CUTOFF_AT_REQUIRED" });
      continue;
    }
    let publicationId = row.match.status === "exact" ? row.match.publicationId : resolution.publicationId;
    const atomicPublication = list(store.unifiedAtomicManualPublications).find((item) => item.id === publicationId && item.accountId === batch.accountId && item.platform === batch.platform);
    if (atomicPublication) {
      try {
        const confirmed = confirmAtomicImportRow(store, batch, row, atomicPublication, confirmedBy, featureFlags);
        results.push({ rowId: row.id, status: "imported", authority: "unified_atomic", publicationId: atomicPublication.id, snapshotId: confirmed.snapshot.id, businessOutcomeSnapshotId: confirmed.businessOutcomeSnapshot?.id || null, dataQualityStatus: "accepted", dueAt: null });
      } catch (error) {
        results.push({ rowId: row.id, status: "skipped", authority: "unified_atomic", reason: error.code || "ATOMIC_IMPORT_REJECTED" });
      }
      continue;
    }
    let publication = list(store.contentPublications).find((item) => item.id === publicationId && item.accountId === batch.accountId && item.platform === batch.platform);
    if (publicationId && !publication) {
      results.push({ rowId: row.id, status: "skipped", reason: "RESOLUTION_SCOPE_MISMATCH" });
      continue;
    }
    if (!publication && (resolution.createHistorical === true || allowHistoricalImport)) {
      try {
        publication = createHistoricalPublication(store, batch, row);
      } catch (error) {
        results.push({ rowId: row.id, status: "skipped", reason: error.code || "HISTORICAL_IMPORT_REJECTED" });
        continue;
      }
    }
    if (!publication) {
      results.push({ rowId: row.id, status: "skipped", reason: row.match.status === "candidate" ? "MATCH_NOT_CONFIRMED" : "PUBLICATION_NOT_MATCHED" });
      continue;
    }
    publication.platformContentId ||= row.metadata.platformContentId;
    publication.sourceMetadata = { ...(publication.sourceMetadata || {}), platformContentId: row.metadata.platformContentId, contentUrl: row.metadata.url, importBatchId: batch.id };
    const snapshot = recordPublicationMetrics(publication, {
      ...row.metrics,
      platformMetrics: row.platformMetrics,
      businessOutcome: row.businessOutcome,
      measurementWindow: row.metadata.measurementWindow,
      cutoffAt: row.metadata.cutoffAt,
      collectedAt: new Date().toISOString(),
      source: batch.source,
      importBatchId: batch.id,
      sourceMetadata: { importBatchId: batch.id, rowId: row.id, platformContentId: row.metadata.platformContentId }
    });
    results.push({ rowId: row.id, status: "imported", publicationId: publication.id, snapshotId: snapshot.id, dataQualityStatus: snapshot.dataQuality?.status || "unknown", dueAt: snapshot.dataQuality?.dueAt || null });
  }
  batch.status = results.some((item) => item.status === "skipped") ? "partial" : "confirmed";
  batch.results = results;
  batch.confirmedBy = confirmedBy;
  batch.confirmedAt = new Date().toISOString();
  return batch;
}

