import { hashUnifiedContent } from "./unified-content-contracts.mjs";

const OUTCOME_KEYS = new Set(["qualifiedLeads", "salesAcceptedLeads", "proposals", "wonDeals", "revenue"]);
const clone = (value) => structuredClone(value);

function fail(code, statusCode = 409, details = null) {
  throw Object.assign(new Error(code), { code, statusCode, details });
}

function sameRef(left, right) {
  return Boolean(left?.id && left?.hash && right?.id && right?.hash && left.id === right.id && left.hash === right.hash);
}

function normalizedOutcomes(value) {
  const result = {};
  for (const [key, raw] of Object.entries(value || {})) {
    if (!OUTCOME_KEYS.has(key)) fail("ATOMIC_BUSINESS_OUTCOME_KEY_INVALID", 400, { key });
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) fail("ATOMIC_BUSINESS_OUTCOME_VALUE_INVALID", 400, { key });
    result[key] = number;
  }
  if (!Object.keys(result).length) fail("ATOMIC_BUSINESS_OUTCOME_REQUIRED", 400);
  return result;
}

export function confirmAtomicBusinessOutcome(store, input, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  if (featureFlags.atomicExactFeedbackV1 !== true) fail("ATOMIC_EXACT_FEEDBACK_DISABLED", 404);
  const publication = (store.unifiedAtomicManualPublications || []).find((item) => item.id === input.publicationRef?.id && item.factHash === input.publicationRef?.hash);
  if (!publication || publication.accountId !== input.accountId || publication.companyId !== input.companyId
    || publication.workspaceId !== input.workspaceId || publication.platform !== input.platform
    || !sameRef(publication.contentProjectRef, input.contentProjectRef)) fail("ATOMIC_BUSINESS_OUTCOME_PUBLICATION_MISMATCH", 404);
  const metricSnapshot = (store.unifiedAtomicPublicationMetricSnapshots || []).find((item) => item.id === input.metricSnapshotRef?.id && item.snapshotHash === input.metricSnapshotRef?.hash);
  if (!metricSnapshot || !sameRef(metricSnapshot.publicationRef, input.publicationRef)
    || !sameRef(metricSnapshot.contentProjectRef, input.contentProjectRef)) fail("ATOMIC_BUSINESS_OUTCOME_METRIC_SNAPSHOT_MISMATCH", 409);
  const outcomes = normalizedOutcomes(input.outcomes);
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  const actorId = String(input.actorId || "").trim();
  if (!idempotencyKey || !actorId || input.actorType !== "user") fail("ATOMIC_BUSINESS_OUTCOME_USER_CONFIRMATION_REQUIRED", 400);
  const semantics = {
    schemaVersion: "1.0",
    contract: "AtomicBusinessOutcomeSnapshot@1.0",
    workspaceId: publication.workspaceId,
    companyId: publication.companyId,
    accountId: publication.accountId,
    platform: publication.platform,
    contentProjectRef: clone(publication.contentProjectRef),
    publicationRef: { id: publication.id, hash: publication.factHash },
    metricSnapshotRef: { id: metricSnapshot.id, hash: metricSnapshot.snapshotHash },
    measurementWindow: metricSnapshot.measurementWindow.label,
    outcomes,
    source: clone(input.source || { kind: "manual_entry" }),
    actorType: "user",
    actorId
  };
  const requestHash = hashUnifiedContent(semantics);
  store.unifiedAtomicBusinessOutcomeSnapshots ||= [];
  const existing = store.unifiedAtomicBusinessOutcomeSnapshots.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) fail("ATOMIC_BUSINESS_OUTCOME_IDEMPOTENCY_CONFLICT");
    return { snapshot: clone(existing), created: false };
  }
  if (store.unifiedAtomicBusinessOutcomeSnapshots.some((item) => sameRef(item.metricSnapshotRef, semantics.metricSnapshotRef))) {
    fail("ATOMIC_BUSINESS_OUTCOME_SNAPSHOT_ALREADY_BOUND");
  }
  const identity = hashUnifiedContent({ requestHash, idempotencyKey });
  const base = {
    ...semantics,
    id: `atomic-business-outcome:${identity.slice(0, 24)}`,
    idempotencyKey,
    requestHash,
    recordedAt: new Date(now).toISOString(),
    immutable: true,
    claims: { platformMutationPerformed: false, activeStrategyMutated: false, humanConfirmed: true }
  };
  const snapshot = { ...base, factHash: hashUnifiedContent(base) };
  store.unifiedAtomicBusinessOutcomeSnapshots = [...store.unifiedAtomicBusinessOutcomeSnapshots, snapshot];
  return { snapshot: clone(snapshot), created: true };
}

export function validateAtomicBusinessOutcomeSnapshot(value) {
  if (!value || value.contract !== "AtomicBusinessOutcomeSnapshot@1.0" || value.immutable !== true
    || !value.id?.startsWith("atomic-business-outcome:") || !value.factHash) fail("ATOMIC_BUSINESS_OUTCOME_FACT_INVALID");
  const unhashed = clone(value); delete unhashed.factHash;
  if (hashUnifiedContent(unhashed) !== value.factHash) fail("ATOMIC_BUSINESS_OUTCOME_FACT_INVALID");
  normalizedOutcomes(value.outcomes);
  return true;
}
