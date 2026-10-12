import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import {
  validateControlledManualPublication,
  validateControlledManualPublicationClosure
} from "./atomic-manual-publication-store.mjs";
import {
  classifyStoredPublicationSnapshot,
  nextPublicationSnapshotLifecycleBindings,
  preparePublicationSnapshotLifecycleBinding,
  projectAtomicPublicationLifecycle
} from "./atomic-publication-lifecycle-store.mjs";

const HASH = /^[a-f0-9]{64}$/;
const XHS_CONTENT_ID = /^[a-f0-9]{24}$/;
const WECHAT_CONTENT_ID = /^[A-Za-z0-9_-]{6,256}$/;
const WINDOW_LABELS = new Set(["72h", "7d", "final", "custom"]);
const CANONICAL_WINDOW_HOURS = Object.freeze({ "72h": 72, "7d": 168 });
const SOURCE_KINDS = new Set(["manual_entry", "platform_export", "csv_import"]);
const ACTOR_TYPES = new Set(["user", "service"]);
const PLATFORM_RULES = Object.freeze({
  xiaohongshu: Object.freeze({
    contentId: XHS_CONTENT_ID,
    metricKeys: new Set(["impressions", "views", "likes", "saves", "comments", "shares", "follows", "leads", "conversions", "profileVisits", "coverClicks"]),
    canonicalUrl(publication) {
      return publication.canonicalPlatformUrl == null
        || publication.canonicalPlatformUrl === `https://www.xiaohongshu.com/explore/${publication.canonicalPlatformContentId}`;
    }
  }),
  wechat: Object.freeze({
    contentId: WECHAT_CONTENT_ID,
    metricKeys: new Set(["reads", "likes", "shares", "favorites", "comments", "newFollowers", "unfollows", "leads", "conversions"]),
    canonicalUrl(publication) {
      return publication.canonicalPlatformUrl === `https://mp.weixin.qq.com/s/${publication.canonicalPlatformContentId}`;
    }
  })
});
const FORBIDDEN_BINDING_KEYS = new Set(["title", "taskId", "contentTaskId", "allowHistoricalImport", "resolution", "resolutions", "candidatePublicationId"]);
const clone = (value) => structuredClone(value);
const SNAPSHOT_KEYS = ["accountId", "actorId", "actorType", "claims", "collectedAt", "companyId", "contentProjectRef", "contract", "cutoffAt", "id", "idempotencyKey", "immutable", "measurementWindow", "metrics", "platform", "platformContentId", "publicationRef", "recordedAt", "requestHash", "schemaVersion", "snapshotHash", "source", "workspaceId"].sort().join(",");
const BATCH_KEYS = ["actorId", "actorType", "batchHash", "batchId", "collectedAt", "contract", "id", "immutable", "platformContentId", "publicationId", "publicationRef", "rawRowHash", "rowNumber", "schemaVersion", "snapshotRef"].sort().join(",");

function fail(code, statusCode = 409, details = null) {
  throw Object.assign(new Error(code), { code, statusCode, details });
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, 400);
  return value.trim();
}

function exactRef(value, code) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "hash,id"
    || typeof value.id !== "string" || !value.id.trim() || !HASH.test(value.hash || "")) fail(code, 400);
  return value;
}

function hasExactKeys(value, keys) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function timestamp(value, code, now) {
  const raw = text(value, code);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== raw || parsed > Date.parse(now)) fail(code, 400);
  return raw;
}

function validSelfHash(value, field) {
  if (!value || !HASH.test(value[field] || "")) return false;
  const unhashed = clone(value); delete unhashed[field];
  return hashUnifiedContent(unhashed) === value[field];
}

function assertNoLegacyBinding(value, path = "input") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_BINDING_KEYS.has(key)) fail("ATOMIC_EXACT_FEEDBACK_LEGACY_BINDING_FORBIDDEN", 400, { path: `${path}.${key}` });
    assertNoLegacyBinding(nested, `${path}.${key}`);
  }
}

function platformRules(platform, code = "ATOMIC_EXACT_FEEDBACK_PLATFORM_MISMATCH") {
  const rules = PLATFORM_RULES[platform];
  if (!rules) fail(code, 409);
  return rules;
}

function resolvePublication(store, request, featureFlags = {}) {
  assertNoLegacyBinding(request);
  const publicationRef = exactRef(request?.publicationRef, "ATOMIC_EXACT_FEEDBACK_PUBLICATION_REF_REQUIRED");
  const publications = store.unifiedAtomicManualPublications === undefined ? [] : store.unifiedAtomicManualPublications;
  if (!Array.isArray(publications)) fail("ATOMIC_EXACT_FEEDBACK_PUBLICATION_STORE_INVALID");
  const matches = publications.filter((item) => item?.id === publicationRef.id && item?.factHash === publicationRef.hash);
  if (matches.length !== 1) fail("ATOMIC_EXACT_FEEDBACK_PUBLICATION_MISMATCH", 404);
  const publication = matches[0];
  validateControlledManualPublication(publication);
  validateControlledManualPublicationClosure(store, publication, { featureFlags });
  if (request.workspaceId !== publication.workspaceId) fail("ATOMIC_EXACT_FEEDBACK_WORKSPACE_MISMATCH", 403);
  if (request.companyId !== publication.companyId) fail("ATOMIC_EXACT_FEEDBACK_COMPANY_MISMATCH", 403);
  if (request.accountId !== publication.accountId) fail("ATOMIC_EXACT_FEEDBACK_ACCOUNT_MISMATCH", 403);
  if (request.platform !== publication.platform) fail("ATOMIC_EXACT_FEEDBACK_PLATFORM_MISMATCH", 409);
  const rules = platformRules(publication.platform);
  if (!rules.canonicalUrl(publication)) fail("ATOMIC_EXACT_FEEDBACK_PUBLICATION_IDENTITY_INVALID", 409);
  if (request.platformContentId !== publication.canonicalPlatformContentId || !rules.contentId.test(request.platformContentId || "")) {
    fail("ATOMIC_EXACT_FEEDBACK_CONTENT_ID_MISMATCH", 409);
  }
  if (request.projectId !== publication.contentProjectRef?.id) fail("ATOMIC_EXACT_FEEDBACK_PROJECT_MISMATCH", 409);
  if (request.platformUrl != null && request.platformUrl !== publication.canonicalPlatformUrl) {
    fail("ATOMIC_EXACT_FEEDBACK_URL_CROSSCHECK_MISMATCH", 409);
  }
  return publication;
}

function semanticRequest(publication) {
  return {
    schemaVersion: "1.0", contract: "AtomicPublicationFeedbackRequest@1.0",
    workspaceId: publication.workspaceId, companyId: publication.companyId, accountId: publication.accountId,
    platform: publication.platform, platformContentId: publication.canonicalPlatformContentId,
    contentProjectRef: clone(publication.contentProjectRef), publicationRef: { id: publication.id, hash: publication.factHash }
  };
}

export function previewAtomicPublicationFeedback(store, request, { featureFlags = {} } = {}) {
  if (featureFlags.atomicExactFeedbackV1 !== true) fail("ATOMIC_EXACT_FEEDBACK_DISABLED", 404);
  const normalized = semanticRequest(resolvePublication(store, request, featureFlags));
  const requestHash = hashUnifiedContent(normalized);
  return Object.freeze({
    schemaVersion: "1.0", contract: "AtomicPublicationFeedbackPreflight@1.0", status: "validated_read_only",
    requestHash, previewToken: `atomic-exact-feedback-preview:${requestHash}`, request: normalized,
    claims: Object.freeze({ writesPerformed: false, exactPublicationBinding: true, strategyMutationAuthorized: false, feedbackActionAuthorized: false })
  });
}

function normalizeWindow(value, publication, now) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("ATOMIC_EXACT_FEEDBACK_WINDOW_REQUIRED", 400);
  const label = text(value.label, "ATOMIC_EXACT_FEEDBACK_WINDOW_LABEL_REQUIRED");
  if (!WINDOW_LABELS.has(label)) fail("ATOMIC_EXACT_FEEDBACK_WINDOW_LABEL_INVALID", 400);
  const startedAt = timestamp(value.startedAt, "ATOMIC_EXACT_FEEDBACK_WINDOW_START_INVALID", now);
  const endedAt = timestamp(value.endedAt, "ATOMIC_EXACT_FEEDBACK_WINDOW_END_INVALID", now);
  if (Date.parse(startedAt) < Date.parse(publication.publishedAt) || Date.parse(endedAt) <= Date.parse(startedAt)) {
    fail("ATOMIC_EXACT_FEEDBACK_WINDOW_ORDER_INVALID", 400);
  }
  const canonicalHours = CANONICAL_WINDOW_HOURS[label];
  if (canonicalHours && Date.parse(endedAt) - Date.parse(startedAt) !== canonicalHours * 36e5) {
    fail("ATOMIC_EXACT_FEEDBACK_WINDOW_DURATION_INVALID", 400);
  }
  return { label, startedAt, endedAt };
}

function normalizeMetrics(value, platform) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) fail("ATOMIC_EXACT_FEEDBACK_METRICS_REQUIRED", 400);
  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    if (!platformRules(platform, "ATOMIC_EXACT_FEEDBACK_PLATFORM_INVALID").metricKeys.has(key)) {
      fail("ATOMIC_EXACT_FEEDBACK_METRIC_UNKNOWN", 400, { key, platform });
    }
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) fail("ATOMIC_EXACT_FEEDBACK_METRIC_INVALID", 400, { key });
    normalized[key] = value[key];
  }
  return normalized;
}

function normalizeSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("ATOMIC_EXACT_FEEDBACK_SOURCE_REQUIRED", 400);
  const kind = text(value.kind, "ATOMIC_EXACT_FEEDBACK_SOURCE_KIND_REQUIRED");
  if (!SOURCE_KINDS.has(kind)) fail("ATOMIC_EXACT_FEEDBACK_SOURCE_KIND_INVALID", 400);
  if (kind === "csv_import") {
    if (!hasExactKeys(value, ["kind", "rawRowHash", "batchId", "rowNumber", "row"]) || !HASH.test(value.rawRowHash || "")) {
      fail("ATOMIC_EXACT_FEEDBACK_IMPORT_RAW_ROW_HASH_REQUIRED", 400);
    }
    const row = value.row;
    if (!hasExactKeys(row, ["publicationId", "platformContentId"])) fail("ATOMIC_EXACT_FEEDBACK_IMPORT_EXACT_IDS_REQUIRED", 400);
    const normalized = { kind, rawRowHash: value.rawRowHash, import: {
      batchId: text(value.batchId, "ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_REQUIRED"),
      rowNumber: Number(value.rowNumber), publicationId: text(row.publicationId, "ATOMIC_EXACT_FEEDBACK_IMPORT_PUBLICATION_REQUIRED"),
      platformContentId: text(row.platformContentId, "ATOMIC_EXACT_FEEDBACK_IMPORT_CONTENT_ID_REQUIRED")
    } };
    if (!Number.isSafeInteger(normalized.import.rowNumber) || normalized.import.rowNumber < 1) fail("ATOMIC_EXACT_FEEDBACK_IMPORT_ROW_INVALID", 400);
    return normalized;
  }
  if (hasExactKeys(value, ["kind", "evidenceRef"])) {
    return { kind, evidenceRef: clone(exactRef(value.evidenceRef, "ATOMIC_EXACT_FEEDBACK_SOURCE_EVIDENCE_INVALID")) };
  }
  if (hasExactKeys(value, ["kind", "rawRowHash"]) && HASH.test(value.rawRowHash || "")) return { kind, rawRowHash: value.rawRowHash };
  fail("ATOMIC_EXACT_FEEDBACK_SOURCE_EVIDENCE_REQUIRED", 400);
}

function assertSnapshot(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== SNAPSHOT_KEYS
      || value.schemaVersion !== "3.0" || value.contract !== "PublicationMetricSnapshot@3.0" || value.immutable !== true
      || typeof value.id !== "string" || !value.id.startsWith("atomic-publication-metrics:")
      || typeof value.idempotencyKey !== "string" || !value.idempotencyKey.trim() || !HASH.test(value.requestHash || "")
      || typeof value.workspaceId !== "string" || !value.workspaceId.trim() || typeof value.companyId !== "string" || !value.companyId.trim()
      || typeof value.accountId !== "string" || !value.accountId.trim() || !PLATFORM_RULES[value.platform]
      || !PLATFORM_RULES[value.platform].contentId.test(value.platformContentId || "") || !ACTOR_TYPES.has(value.actorType)
      || typeof value.actorId !== "string" || !value.actorId.trim()) throw new Error("root");
    exactRef(value.contentProjectRef, "ATOMIC_EXACT_FEEDBACK_SNAPSHOT_INVALID");
    exactRef(value.publicationRef, "ATOMIC_EXACT_FEEDBACK_SNAPSHOT_INVALID");
    if (!hasExactKeys(value.measurementWindow, ["label", "startedAt", "endedAt"]) || !WINDOW_LABELS.has(value.measurementWindow.label)
      || !canonicalTimestamp(value.measurementWindow.startedAt) || !canonicalTimestamp(value.measurementWindow.endedAt)
      || !canonicalTimestamp(value.cutoffAt) || !canonicalTimestamp(value.collectedAt) || !canonicalTimestamp(value.recordedAt)
      || Date.parse(value.measurementWindow.endedAt) <= Date.parse(value.measurementWindow.startedAt)
      || (CANONICAL_WINDOW_HOURS[value.measurementWindow.label]
        && Date.parse(value.measurementWindow.endedAt) - Date.parse(value.measurementWindow.startedAt) !== CANONICAL_WINDOW_HOURS[value.measurementWindow.label] * 36e5)
      || Date.parse(value.cutoffAt) < Date.parse(value.measurementWindow.endedAt)
      || Date.parse(value.collectedAt) < Date.parse(value.cutoffAt) || Date.parse(value.recordedAt) < Date.parse(value.collectedAt)) throw new Error("time");
    normalizeMetrics(value.metrics, value.platform);
    const normalizedSource = value.source?.kind === "csv_import"
      ? normalizeStoredImportSource(value.source, value.platform)
      : normalizeSource(value.source);
    if (hashUnifiedContent(normalizedSource) !== hashUnifiedContent(value.source)) throw new Error("source");
    if (value.source.kind === "csv_import" && (value.source.import.publicationId !== value.publicationRef.id
      || value.source.import.platformContentId !== value.platformContentId)) throw new Error("import identity");
    const semanticHash = hashUnifiedContent({
      schemaVersion: "1.0", contract: "AtomicPublicationFeedbackRequest@1.0",
      workspaceId: value.workspaceId, companyId: value.companyId, accountId: value.accountId,
      platform: value.platform, platformContentId: value.platformContentId,
      contentProjectRef: clone(value.contentProjectRef), publicationRef: clone(value.publicationRef),
      measurementWindow: clone(value.measurementWindow), cutoffAt: value.cutoffAt, collectedAt: value.collectedAt,
      source: clone(value.source), actorType: value.actorType, actorId: value.actorId, metrics: clone(value.metrics)
    });
    const identity = hashUnifiedContent({ requestHash: semanticHash, idempotencyKey: value.idempotencyKey });
    if (value.requestHash !== semanticHash || value.id !== `atomic-publication-metrics:${identity.slice(0, 24)}`) throw new Error("request identity");
    if (!hasExactKeys(value.claims, ["publicationCreated", "publicationMutated", "strategyMutationAuthorized", "feedbackActionAuthorized", "qualitativeInterpretationIncluded"])
      || value.claims.publicationCreated !== false || value.claims.publicationMutated !== false
      || value.claims.strategyMutationAuthorized !== false || value.claims.feedbackActionAuthorized !== false
      || value.claims.qualitativeInterpretationIncluded !== false || !validSelfHash(value, "snapshotHash")) throw new Error("claims/hash");
  } catch (error) {
    if (error?.code === "ATOMIC_EXACT_FEEDBACK_SNAPSHOT_INVALID") throw error;
    fail("ATOMIC_EXACT_FEEDBACK_SNAPSHOT_INVALID");
  }
}

function normalizeStoredImportSource(value, platform) {
  if (!hasExactKeys(value, ["kind", "rawRowHash", "import"]) || value.kind !== "csv_import" || !HASH.test(value.rawRowHash || "")
    || !hasExactKeys(value.import, ["batchId", "rowNumber", "publicationId", "platformContentId"])
    || typeof value.import.batchId !== "string" || !value.import.batchId.trim()
    || !Number.isSafeInteger(value.import.rowNumber) || value.import.rowNumber < 1
    || typeof value.import.publicationId !== "string" || !value.import.publicationId.trim()
    || !PLATFORM_RULES[platform]?.contentId.test(value.import.platformContentId || "")) fail("ATOMIC_EXACT_FEEDBACK_SNAPSHOT_INVALID");
  return value;
}

function assertImportBatch(value, snapshot) {
  const contentIdValid = snapshot
    ? platformRules(snapshot.platform, "ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_INVALID").contentId.test(value?.platformContentId || "")
    : XHS_CONTENT_ID.test(value?.platformContentId || "") || WECHAT_CONTENT_ID.test(value?.platformContentId || "");
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== BATCH_KEYS
    || value.schemaVersion !== "1.0" || value.contract !== "AtomicMetricImportBatch@1.0" || value.immutable !== true
    || typeof value.id !== "string" || !value.id.startsWith("atomic-metric-import:")
    || typeof value.batchId !== "string" || !value.batchId.trim() || !Number.isSafeInteger(value.rowNumber) || value.rowNumber < 1
    || typeof value.publicationId !== "string" || !value.publicationId.trim() || !contentIdValid
    || !HASH.test(value.rawRowHash || "") || !ACTOR_TYPES.has(value.actorType) || typeof value.actorId !== "string" || !value.actorId.trim()
    || !canonicalTimestamp(value.collectedAt) || !validSelfHash(value, "batchHash")) fail("ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_INVALID");
  exactRef(value.publicationRef, "ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_INVALID");
  exactRef(value.snapshotRef, "ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_INVALID");
  if (snapshot && (value.publicationId !== snapshot.publicationRef.id || value.platformContentId !== snapshot.platformContentId
    || value.publicationRef.id !== snapshot.publicationRef.id || value.publicationRef.hash !== snapshot.publicationRef.hash
    || value.snapshotRef.id !== snapshot.id || value.snapshotRef.hash !== snapshot.snapshotHash
    || value.rawRowHash !== snapshot.source.rawRowHash || value.batchId !== snapshot.source.import.batchId
    || value.rowNumber !== snapshot.source.import.rowNumber || value.actorType !== snapshot.actorType
    || value.actorId !== snapshot.actorId || value.collectedAt !== snapshot.collectedAt
    || value.id !== `atomic-metric-import:${hashUnifiedContent({ requestHash: snapshot.requestHash, idempotencyKey: snapshot.idempotencyKey }).slice(0, 24)}`)) {
    fail("ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_SNAPSHOT_MISMATCH");
  }
}

function snapshotRequest(snapshot) {
  return {
    workspaceId: snapshot.workspaceId, companyId: snapshot.companyId, accountId: snapshot.accountId,
    platform: snapshot.platform, projectId: snapshot.contentProjectRef.id,
    publicationRef: clone(snapshot.publicationRef), platformContentId: snapshot.platformContentId
  };
}

function assertSnapshotPublicationClosure(store, snapshot, featureFlags) {
  assertSnapshot(snapshot);
  const publication = resolvePublication(store, snapshotRequest(snapshot), featureFlags);
  if (snapshot.contentProjectRef.id !== publication.contentProjectRef.id
    || snapshot.contentProjectRef.hash !== publication.contentProjectRef.hash
    || Date.parse(snapshot.measurementWindow.startedAt) < Date.parse(publication.publishedAt)) {
    fail("ATOMIC_EXACT_FEEDBACK_SNAPSHOT_PUBLICATION_MISMATCH");
  }
  return publication;
}

export function confirmAtomicPublicationFeedback(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  if (featureFlags.atomicExactFeedbackV1 !== true) fail("ATOMIC_EXACT_FEEDBACK_DISABLED", 404);
  assertNoLegacyBinding(input);
  const idempotencyKey = text(input?.idempotencyKey, "ATOMIC_EXACT_FEEDBACK_IDEMPOTENCY_REQUIRED");
  const preflight = previewAtomicPublicationFeedback(store, input?.request, { featureFlags });
  if (input.previewToken !== preflight.previewToken) fail("ATOMIC_EXACT_FEEDBACK_PREVIEW_TOKEN_MISMATCH");
  if (input.requestHash !== preflight.requestHash) fail("ATOMIC_EXACT_FEEDBACK_REQUEST_HASH_MISMATCH");
  if (!ACTOR_TYPES.has(input.actorType)) fail("ATOMIC_EXACT_FEEDBACK_ACTOR_TYPE_INVALID", 400);
  const actorId = text(input.actorId, "ATOMIC_EXACT_FEEDBACK_ACTOR_REQUIRED");
  const publication = resolvePublication(store, input.request, featureFlags);
  const measurementWindow = normalizeWindow(input.measurementWindow, publication, now);
  const cutoffAt = timestamp(input.cutoffAt, "ATOMIC_EXACT_FEEDBACK_CUTOFF_INVALID", now);
  const collectedAt = timestamp(input.collectedAt, "ATOMIC_EXACT_FEEDBACK_COLLECTED_AT_INVALID", now);
  if (Date.parse(cutoffAt) < Date.parse(measurementWindow.endedAt) || Date.parse(collectedAt) < Date.parse(cutoffAt)) {
    fail("ATOMIC_EXACT_FEEDBACK_TIME_ORDER_INVALID", 400);
  }
  const source = normalizeSource(input.source);
  if (source.import && (source.import.publicationId !== publication.id || source.import.platformContentId !== publication.canonicalPlatformContentId)) {
    fail("ATOMIC_EXACT_FEEDBACK_IMPORT_ID_MISMATCH", 409);
  }
  const metrics = normalizeMetrics(input.metrics, publication.platform);
  const semantics = {
    ...preflight.request, measurementWindow, cutoffAt, collectedAt, source, actorType: input.actorType, actorId, metrics
  };
  const requestHash = hashUnifiedContent(semantics);
  const snapshots = store.unifiedAtomicPublicationMetricSnapshots === undefined ? [] : store.unifiedAtomicPublicationMetricSnapshots;
  const batches = store.unifiedAtomicMetricImportBatches === undefined ? [] : store.unifiedAtomicMetricImportBatches;
  if (!Array.isArray(snapshots) || !Array.isArray(batches)) fail("ATOMIC_EXACT_FEEDBACK_STORE_INVALID");
  for (const snapshot of snapshots) assertSnapshotPublicationClosure(store, snapshot, featureFlags);
  for (const batch of batches) {
    const snapshot = snapshots.find((item) => item.id === batch.snapshotRef?.id && item.snapshotHash === batch.snapshotRef?.hash);
    if (!snapshot) fail("ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_ORPHANED");
    assertImportBatch(batch, snapshot);
  }
  const existing = snapshots.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    assertSnapshotPublicationClosure(store, existing, featureFlags);
    if (existing.requestHash !== requestHash) fail("ATOMIC_EXACT_FEEDBACK_IDEMPOTENCY_CONFLICT");
    let existingBatch = null;
    if (source.import) {
      const matches = batches.filter((item) => item.snapshotRef?.id === existing.id && item.snapshotRef?.hash === existing.snapshotHash);
      if (matches.length !== 1) fail("ATOMIC_EXACT_FEEDBACK_IMPORT_BATCH_REPLAY_INVALID");
      assertImportBatch(matches[0], existing);
      existingBatch = matches[0];
    }
    let lifecycleBinding = null;
    if (featureFlags.atomicPublicationLifecycleV1 === true) {
      const bindings = store.unifiedAtomicPublicationSnapshotLifecycleBindings || [];
      if (!Array.isArray(bindings)) fail("ATOMIC_PUBLICATION_LIFECYCLE_BINDING_STORE_INVALID");
      lifecycleBinding = bindings.find((item) => item.snapshotRef?.id === existing.id && item.snapshotRef?.hash === existing.snapshotHash) || null;
      classifyStoredPublicationSnapshot(store, publication, existing, { featureFlags });
    }
    return { snapshot: clone(existing), importBatch: clone(existingBatch),
      ...(featureFlags.atomicPublicationLifecycleV1 === true ? { lifecycleBinding: clone(lifecycleBinding) } : {}), created: false };
  }
  const sourceIdentity = source.evidenceRef?.hash || source.rawRowHash;
  if (snapshots.some((item) => item.publicationRef?.id === publication.id && item.measurementWindow?.label === measurementWindow.label
    && item.measurementWindow?.startedAt === measurementWindow.startedAt && item.measurementWindow?.endedAt === measurementWindow.endedAt
    && (item.source?.evidenceRef?.hash || item.source?.rawRowHash) === sourceIdentity)) fail("ATOMIC_EXACT_FEEDBACK_DUPLICATE_WINDOW_SOURCE");
  const identity = hashUnifiedContent({ requestHash, idempotencyKey });
  const base = {
    ...semantics, schemaVersion: "3.0", contract: "PublicationMetricSnapshot@3.0",
    id: `atomic-publication-metrics:${identity.slice(0, 24)}`, idempotencyKey, requestHash,
    publicationRef: { id: publication.id, hash: publication.factHash }, recordedAt: new Date(now).toISOString(), immutable: true,
    claims: { publicationCreated: false, publicationMutated: false, strategyMutationAuthorized: false, feedbackActionAuthorized: false, qualitativeInterpretationIncluded: false }
  };
  const snapshot = { ...base, snapshotHash: hashUnifiedContent(base) };
  let importBatch = null;
  if (source.import) {
    const batchBase = {
      schemaVersion: "1.0", contract: "AtomicMetricImportBatch@1.0", id: `atomic-metric-import:${identity.slice(0, 24)}`,
      ...source.import, publicationRef: clone(snapshot.publicationRef), snapshotRef: { id: snapshot.id, hash: snapshot.snapshotHash },
      rawRowHash: source.rawRowHash, actorType: input.actorType, actorId, collectedAt, immutable: true
    };
    importBatch = { ...batchBase, batchHash: hashUnifiedContent(batchBase) };
  }
  assertSnapshot(snapshot);
  if (importBatch) assertImportBatch(importBatch, snapshot);
  const lifecycle = featureFlags.atomicPublicationLifecycleV1 === true
    ? preparePublicationSnapshotLifecycleBinding(store, publication, snapshot, { featureFlags, now })
    : null;
  const feedbackAppend = { unifiedAtomicPublicationMetricSnapshots: [...snapshots, snapshot] };
  if (importBatch) feedbackAppend.unifiedAtomicMetricImportBatches = [...batches, importBatch];
  if (lifecycle?.created) feedbackAppend.unifiedAtomicPublicationSnapshotLifecycleBindings = nextPublicationSnapshotLifecycleBindings(store, lifecycle.binding);
  // All validation finishes before this synchronous assignment boundary; no Provider, browser, database or platform operation is involved.
  Object.assign(store, feedbackAppend);
  return { snapshot: clone(snapshot), importBatch: clone(importBatch),
    ...(featureFlags.atomicPublicationLifecycleV1 === true ? { lifecycleBinding: clone(lifecycle?.binding || null) } : {}), created: true };
}

export function projectAtomicPublicationFeedback(store, request, options = {}) {
  const { featureFlags = {} } = options;
  const now = options.now ?? new Date().toISOString();
  const clockSource = options.clockSource ?? (Object.hasOwn(options, "now") ? "provided" : "system");
  if (featureFlags.atomicExactFeedbackV1 !== true) fail("ATOMIC_EXACT_FEEDBACK_DISABLED", 404);
  const publication = resolvePublication(store, request, featureFlags);
  const snapshots = store.unifiedAtomicPublicationMetricSnapshots || [];
  if (!Array.isArray(snapshots)) fail("ATOMIC_EXACT_FEEDBACK_STORE_INVALID");
  const related = snapshots.filter((item) => item?.publicationRef?.id === publication.id
    || item?.publicationRef?.hash === publication.factHash
    || (item?.platform === publication.platform && item?.accountId === publication.accountId
      && item?.platformContentId === publication.canonicalPlatformContentId));
  for (const item of related) assertSnapshotPublicationClosure(store, item, featureFlags);
  const exactItems = related.filter((item) => item.publicationRef.id === publication.id && item.publicationRef.hash === publication.factHash
    && item.platformContentId === publication.canonicalPlatformContentId);
  const lifecycleClassifications = featureFlags.atomicPublicationLifecycleV1 === true
    ? exactItems.map((item) => ({ snapshot: item, lifecycle: classifyStoredPublicationSnapshot(store, publication, item, { featureFlags }) }))
    : exactItems.map((item) => ({ snapshot: item, lifecycle: { classification: "valid_active", bindingRef: null } }));
  const items = lifecycleClassifications.filter((item) => ["valid_active", "valid_pre_takedown"].includes(item.lifecycle.classification)).map((item) => item.snapshot)
    .sort((left, right) => left.collectedAt.localeCompare(right.collectedAt) || left.id.localeCompare(right.id));
  const latest = items.at(-1) || null;
  const effectivePublishedAt = featureFlags.atomicPublicationLifecycleV1 === true
    ? projectAtomicPublicationLifecycle(store, request, { featureFlags }).effectivePublishedAt
    : publication.publishedAt;
  const ageHours = Math.max(0, (Date.parse(now) - Date.parse(effectivePublishedAt)) / 36e5);
  const maturity = ageHours >= 168 ? "7d_ready" : ageHours >= 72 ? "72h_ready" : "collecting";
  const windowMaturity = {
    evaluatedAt: new Date(now).toISOString(), clockSource,
    "72h": { elapsed: ageHours >= 72, snapshotRecorded: items.some((item) => item.measurementWindow.label === "72h") },
    "7d": { elapsed: ageHours >= 168, snapshotRecorded: items.some((item) => item.measurementWindow.label === "7d") }
  };
  return Object.freeze({
    schemaVersion: "1.0", contract: "AtomicPublicationFeedbackProjection@1.0",
    publicationRef: { id: publication.id, hash: publication.factHash }, platformContentId: publication.canonicalPlatformContentId,
    snapshotCount: items.length, latestSnapshotRef: latest ? { id: latest.id, hash: latest.snapshotHash } : null,
    latestMetrics: latest ? clone(latest.metrics) : null, latestMeasurementWindow: latest ? clone(latest.measurementWindow) : null,
    ...(featureFlags.atomicPublicationLifecycleV1 === true ? { lifecycleClassifications: lifecycleClassifications.map((item) => ({ snapshotRef: { id: item.snapshot.id, hash: item.snapshot.snapshotHash }, ...clone(item.lifecycle) })) } : {}),
    maturity, windowMaturity, qualitativeObservations: [], interpretations: [],
    claims: { readOnly: true, strategyMutationAuthorized: false, feedbackActionAuthorized: false }
  });
}

export function validatePublicationMetricSnapshotV3(value) {
  assertSnapshot(value);
  return true;
}

export function validateAtomicMetricImportBatch(value, snapshot = null) {
  assertImportBatch(value, snapshot);
  return true;
}
