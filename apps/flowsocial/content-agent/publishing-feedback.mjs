import { createHash, randomUUID } from "node:crypto";
import { assessPerformanceSnapshot, buildPublicationMaturity, extractPublicationAttribution, normalizePerformanceSnapshot } from "./feedback-engine.mjs";
import { publicationPromotionBinding } from "./content-promotion.mjs";

const ALLOWED_STATUSES = new Set(["draft", "scheduled", "published", "failed", "archived"]);
const STANDARD_WINDOWS = new Set(["72h", "7d", "final"]);
const WINDOW_PRIORITY = Object.freeze({ unspecified: 0, custom: 0, "72h": 1, "7d": 2, final: 3 });
const SNAPSHOT_IGNORED_FIELDS = new Set(["id", "revision", "supersedesSnapshotId", "collectedAt", "source", "sourceMetadata", "importBatchId", "payloadFingerprint", "snapshotIdentity", "rawMetrics", "dataQuality", "maturity"]);

function optionalIsoTimestamp(value, field) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw Object.assign(new Error(`${field} must be a valid timestamp`), { statusCode: 400, code: "INVALID_TIMESTAMP", field });
  }
  return new Date(timestamp).toISOString();
}

function cleanIdentifier(value) {
  const identifier = String(value || "").trim();
  return identifier || null;
}

export function extractPlatformContentId(platform, rawUrl) {
  if (!rawUrl) return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (platform === "xiaohongshu" && (hostname === "xiaohongshu.com" || hostname.endsWith(".xiaohongshu.com"))) {
    const match = url.pathname.match(/^\/(?:discovery\/item|explore)\/([a-f\d]{24})\/?$/i);
    return match?.[1]?.toLowerCase() || null;
  }
  if (platform === "wechat" && hostname === "mp.weixin.qq.com") {
    const article = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{8,})\/?$/);
    if (article) return article[1];
    const biz = cleanIdentifier(url.searchParams.get("__biz"));
    const mid = cleanIdentifier(url.searchParams.get("mid"));
    const idx = cleanIdentifier(url.searchParams.get("idx"));
    return biz && mid && idx ? `wechat:${biz}:${mid}:${idx}` : null;
  }
  return null;
}

function snapshotWindowKey(snapshot = {}) {
  const window = snapshot.measurementWindow || "unspecified";
  return STANDARD_WINDOWS.has(window) ? window : `${window}:${snapshot.cutoffAt || snapshot.windowEndedAt || "unspecified"}`;
}

function snapshotFingerprint(snapshot = {}) {
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(snapshot).filter(([key]) => !SNAPSHOT_IGNORED_FIELDS.has(key))))).digest("hex").slice(0, 16);
}

function metricDelta(previous = {}, current = {}) {
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])];
  return Object.fromEntries(keys.map((key) => {
    const before = Number.isFinite(previous[key]) ? previous[key] : null;
    const now = Number.isFinite(current[key]) ? current[key] : null;
    return [key, { previous: before, current: now, delta: before !== null && now !== null ? now - before : null }];
  }));
}

export function latestPerformanceSnapshot(publication) {
  return [...(publication?.metricHistory || [])].sort((left, right) => {
    const priority = (WINDOW_PRIORITY[right.measurementWindow] || 0) - (WINDOW_PRIORITY[left.measurementWindow] || 0);
    if (priority) return priority;
    const revision = Number(right.revision || 1) - Number(left.revision || 1);
    return revision || String(right.collectedAt || "").localeCompare(String(left.collectedAt || ""));
  })[0] || publication?.latestMetrics || null;
}

export function buildPublicationTimeline(publication = {}, { now = new Date().toISOString() } = {}) {
  const groups = new Map();
  const history = (publication.metricHistory || []).length ? publication.metricHistory : [publication.latestMetrics].filter(Boolean);
  for (const snapshot of history) {
    const window = snapshot.measurementWindow || "unspecified";
    const group = groups.get(window) || [];
    group.push(snapshot);
    groups.set(window, group);
  }
  const windows = Object.fromEntries(["72h", "7d", "final"].map((window) => {
    const revisions = [...(groups.get(window) || [])].sort((left, right) => Number(right.revision || 1) - Number(left.revision || 1));
    const assessedRevisions = revisions.map((snapshot) => ({ snapshotId: snapshot.id, ...assessPerformanceSnapshot(publication, snapshot, { now }) }));
    const accepted = revisions.find((snapshot) => assessPerformanceSnapshot(publication, snapshot, { now }).status === "accepted") || null;
    return [window, { latest: revisions[0] || null, latestAccepted: accepted, revisions, assessments: assessedRevisions }];
  }));
  const baseline = windows["72h"].latestAccepted;
  const comparisons = Object.fromEntries(["7d", "final"].map((window) => {
    const current = windows[window].latestAccepted;
    return [window, baseline && current ? {
      fromWindow: "72h",
      toWindow: window,
      previousSnapshotId: baseline.id,
      currentSnapshotId: current.id,
      known: metricDelta(Object.fromEntries(Object.keys(baseline.metricAvailability || {}).map((key) => [key, baseline[key]])), Object.fromEntries(Object.keys(current.metricAvailability || {}).map((key) => [key, current[key]]))),
      platformMetrics: metricDelta(baseline.platformMetrics || {}, current.platformMetrics || {}),
      businessOutcome: metricDelta(baseline.businessOutcome || {}, current.businessOutcome || {})
    } : null];
  }));
  const maturity = buildPublicationMaturity(publication, { now });
  return {
    schemaVersion: "1.1",
    publishedAt: publication.publishedAt || null,
    stages: [
      { id: "published", at: publication.publishedAt || null, status: publication.publishedAt ? "complete" : "pending" },
      ...["72h", "7d", "final"].map((window) => ({ id: window, dueAt: maturity.windows[window].dueAt, at: windows[window].latestAccepted?.cutoffAt || windows[window].latestAccepted?.collectedAt || null, status: maturity.windows[window].status, snapshotId: windows[window].latestAccepted?.id || null, latestObservedSnapshotId: windows[window].latest?.id || null, revision: windows[window].latest?.revision || null }))
    ],
    windows,
    comparisons,
    maturity
  };
}

export function ensureContentPublications(store) {
  store.contentPublications ||= [];
  return store.contentPublications;
}

export function recordPublication(store, task, payload = {}) {
  const status = payload.status || "published";
  if (!ALLOWED_STATUSES.has(status)) throw Object.assign(new Error("invalid publication status"), { statusCode: 400 });
  const run = (store.contentRuns || store.contentWorkflows || []).find((item) => item.id === (task.contentRunId || task.contentWorkflowId));
  const socialAccountId = run?.socialAccountId || task.socialAccountId || task.accountId;
  const platform = payload.platform || task.platform;
  const platformContentId = cleanIdentifier(payload.platformContentId) || extractPlatformContentId(platform, payload.url);
  const publishedAt = optionalIsoTimestamp(payload.publishedAt, "publishedAt") ?? null;
  const scheduledAt = optionalIsoTimestamp(payload.scheduledAt, "scheduledAt") ?? null;
  const idempotencyKey = (payload.idempotencyKey || platformContentId)
    ? `${platform}:${socialAccountId}:${payload.idempotencyKey || platformContentId}`
    : `${platform}:${socialAccountId}:${task.id}:${publishedAt || status}`;
  const promotionBinding = publicationPromotionBinding(store, task, payload);
  const existing = ensureContentPublications(store).find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    if (promotionBinding.promotionStatus === "promoted_exact_version"
      && (existing.promotionStatus !== promotionBinding.promotionStatus
        || existing.promotionRecordRef?.id !== promotionBinding.promotionRecordRef.id
        || existing.promotedVersionRef?.hash !== promotionBinding.promotedVersionRef.hash)) {
      throw Object.assign(new Error("Publication idempotency key is bound to another promotion state"), { statusCode: 409, code: "PUBLICATION_PROMOTION_IDEMPOTENCY_CONFLICT" });
    }
    return existing;
  }
  const attribution = extractPublicationAttribution(task, run);
  const cycleId = payload.cycleId || attribution.cycleId || null;
  const slotId = payload.slotId || attribution.slotId || null;
  const publication = {
    id: `publication_${randomUUID().slice(0, 8)}`,
    schemaVersion: "1.1",
    contentTaskId: task.id,
    contentRunId: task.contentRunId || task.contentWorkflowId || null,
    accountId: task.accountId,
    workspaceId: run?.workspaceId || task.workspaceId || null,
    companyId: run?.companyId || task.companyId || null,
    socialAccountId,
    platform,
    platformContentId,
    cycleId,
    slotId,
    idempotencyKey,
    ...promotionBinding,
    attribution: { ...attribution, cycleId, slotId },
    status,
    url: payload.url || null,
    scheduledAt,
    publishedAt,
    note: payload.note || "",
    userFeedback: {
      adoptionStatus: payload.adoptionStatus || "unknown",
      modificationSummary: payload.modificationSummary || "",
      qualitativeResult: payload.qualitativeResult || "",
      leadQuality: payload.leadQuality || "unknown"
    },
    metricHistory: [],
    latestMetrics: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  ensureContentPublications(store).push(publication);
  if (run?.rollingPlanId && run?.rollingPlanItemId) {
    const plan = (store.rollingContentPlans || []).find((item) => item.id === run.rollingPlanId);
    const planItem = plan?.items?.find((item) => item.id === run.rollingPlanItemId);
    if (planItem) {
      planItem.status = status === "published" ? "published" : status === "scheduled" ? "scheduled" : planItem.status;
      planItem.publicationId = publication.id;
      planItem.updatedAt = new Date().toISOString();
      plan.updatedAt = new Date().toISOString();
    }
  }
  task.publicationStatus = publication.status;
  task.publicationId = publication.id;
  return publication;
}

export function updatePublication(publication, payload = {}) {
  if (!publication) throw Object.assign(new Error("publication is required"), { statusCode: 404 });
  const status = payload.status || publication.status;
  if (!ALLOWED_STATUSES.has(status)) throw Object.assign(new Error("invalid publication status"), { statusCode: 400 });
  const previousStatus = publication.status;
  for (const field of ["promotionStatus", "promotionRecordRef", "promotedVersionRef"]) {
    if (Object.hasOwn(payload, field) && JSON.stringify(payload[field]) !== JSON.stringify(publication[field] ?? null)) {
      throw Object.assign(new Error(`${field} is immutable`), { statusCode: 409, code: "PUBLICATION_PROMOTION_BINDING_IMMUTABLE", field });
    }
  }
  publication.status = status;
  if (Object.hasOwn(payload, "url")) publication.url = payload.url || null;
  if (Object.hasOwn(payload, "scheduledAt")) publication.scheduledAt = optionalIsoTimestamp(payload.scheduledAt, "scheduledAt");
  if (Object.hasOwn(payload, "publishedAt")) publication.publishedAt = optionalIsoTimestamp(payload.publishedAt, "publishedAt");
  else if (status === "published" && previousStatus === "scheduled" && !publication.publishedAt && publication.scheduledAt) publication.publishedAt = publication.scheduledAt;
  if (Object.hasOwn(payload, "note")) publication.note = payload.note || "";
  if (Object.hasOwn(payload, "platformContentId")) publication.platformContentId = cleanIdentifier(payload.platformContentId) || extractPlatformContentId(publication.platform, publication.url);
  else if (!publication.platformContentId && Object.hasOwn(payload, "url")) publication.platformContentId = extractPlatformContentId(publication.platform, publication.url);
  for (const field of ["accountId", "workspaceId", "companyId", "socialAccountId", "cycleId", "slotId"]) {
    if (Object.hasOwn(payload, field)) publication[field] = payload[field] || null;
  }
  if (payload.attribution && typeof payload.attribution === "object") {
    publication.attribution = { ...(publication.attribution || {}), ...payload.attribution };
  }
  if (Object.hasOwn(payload, "cycleId") || Object.hasOwn(payload, "slotId")) {
    publication.attribution = { ...(publication.attribution || {}), cycleId: publication.cycleId || null, slotId: publication.slotId || null };
  }
  if (payload.userFeedback && typeof payload.userFeedback === "object") publication.userFeedback = { ...(publication.userFeedback || {}), ...payload.userFeedback };
  publication.updatedAt = new Date().toISOString();
  return publication;
}

export function recordPublicationMetrics(publication, payload, { now = new Date().toISOString() } = {}) {
  publication.metricHistory ||= [];
  const cutoffAt = optionalIsoTimestamp(payload?.cutoffAt ?? payload?.windowEndedAt, "cutoffAt");
  if (!cutoffAt) throw Object.assign(new Error("cutoffAt is required for a performance snapshot"), { statusCode: 400, code: "CUTOFF_AT_REQUIRED", field: "cutoffAt" });
  const comparablePayload = { ...payload, cutoffAt, platform: publication.platform };
  const normalized = normalizePerformanceSnapshot(comparablePayload, now);
  const identity = snapshotWindowKey(normalized);
  const fingerprint = snapshotFingerprint(normalized);
  const sameIdentity = publication.metricHistory.filter((item) => (item.snapshotIdentity || snapshotWindowKey(item)) === identity);
  const exact = sameIdentity.find((item) => item.payloadFingerprint === fingerprint);
  if (exact) {
    publication.latestMetrics = latestPerformanceSnapshot(publication);
    publication.updatedAt = new Date().toISOString();
    return exact;
  }
  const previous = sameIdentity.sort((left, right) => Number(left.revision || 1) - Number(right.revision || 1)).at(-1) || null;
  const snapshot = {
    ...normalized,
    revision: Number(previous?.revision || 0) + 1,
    supersedesSnapshotId: previous?.id || null
  };
  snapshot.snapshotIdentity = identity;
  snapshot.payloadFingerprint = fingerprint;
  snapshot.dataQuality = assessPerformanceSnapshot(publication, snapshot, { now });
  snapshot.maturity = {
    dueAt: snapshot.dataQuality.dueAt,
    timing: snapshot.dataQuality.timing,
    eligibleForContentDiagnosis: snapshot.dataQuality.eligibleForContentDiagnosis,
    eligibleForCycleEvidence: snapshot.dataQuality.eligibleForCycleEvidence
  };
  publication.metricHistory.push(snapshot);
  publication.latestMetrics = latestPerformanceSnapshot(publication);
  if (payload.userFeedback && typeof payload.userFeedback === "object") {
    publication.userFeedback = { ...(publication.userFeedback || {}), ...payload.userFeedback };
  }
  publication.updatedAt = new Date().toISOString();
  return snapshot;
}
