import { hashUnifiedContent } from "./unified-content-contracts.mjs";
import { validateControlledManualPublicationClosure } from "./atomic-manual-publication-store.mjs";

const HASH = /^[a-f0-9]{64}$/;
const clone = (value) => structuredClone(value);
const EVENT_COLLECTION = "unifiedAtomicPublicationLifecycleFacts";
const BINDING_COLLECTION = "unifiedAtomicPublicationSnapshotLifecycleBindings";
const EVENT_CONTRACTS = new Set([
  "ControlledPublicationCorrection@1.0",
  "ControlledPublicationTakedown@1.0",
  "ControlledPublicationReplacement@1.0"
]);

function fail(code, statusCode = 409, details = null) {
  throw Object.assign(new Error(code), { code, statusCode, details });
}

function exact(value, keys) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
}

function text(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code, 400);
  return value.trim();
}

function timestamp(value, code, now = null) {
  const raw = text(value, code);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== raw || (now && parsed > Date.parse(now))) fail(code, 400);
  return raw;
}

function reference(value, code) {
  if (!exact(value, ["id", "hash"]) || typeof value.id !== "string" || !value.id.trim() || !HASH.test(value.hash || "")) fail(code, 400);
  return value;
}

function sameRef(left, right) {
  return Boolean(left && right && left.id === right.id && left.hash === right.hash);
}

function selfRef(value) {
  return { id: value.id, hash: value.factHash };
}

function publicationRef(value) {
  return { id: value.id, hash: value.factHash };
}

function selfHash(value, field = "factHash") {
  if (!HASH.test(value?.[field] || "")) return false;
  const copy = clone(value); delete copy[field];
  return hashUnifiedContent(copy) === value[field];
}

function normalizeEvidenceRefs(value, code) {
  if (!Array.isArray(value) || !value.length) fail(code, 400);
  const refs = value.map((item) => clone(reference(item, code)))
    .sort((left, right) => left.id.localeCompare(right.id) || left.hash.localeCompare(right.hash));
  if (refs.some((item, index) => index > 0 && sameRef(item, refs[index - 1]))) fail(code, 400);
  return refs;
}

function publicationStore(store) {
  const values = store.unifiedAtomicManualPublications === undefined ? [] : store.unifiedAtomicManualPublications;
  if (!Array.isArray(values)) fail("ATOMIC_PUBLICATION_LIFECYCLE_PUBLICATION_STORE_INVALID");
  return values;
}

function eventStore(store) {
  const values = store[EVENT_COLLECTION] === undefined ? [] : store[EVENT_COLLECTION];
  if (!Array.isArray(values)) fail("ATOMIC_PUBLICATION_LIFECYCLE_EVENT_STORE_INVALID");
  return values;
}

function bindingStore(store) {
  const values = store[BINDING_COLLECTION] === undefined ? [] : store[BINDING_COLLECTION];
  if (!Array.isArray(values)) fail("ATOMIC_PUBLICATION_LIFECYCLE_BINDING_STORE_INVALID");
  return values;
}

function requireEnabled(featureFlags) {
  if (featureFlags.atomicPublicationLifecycleV1 !== true) fail("ATOMIC_PUBLICATION_LIFECYCLE_DISABLED", 404);
  if (featureFlags.atomicManualPublicationV1 !== true) fail("ATOMIC_PUBLICATION_LIFECYCLE_PUBLICATION_AUTHORITY_DISABLED");
}

function resolvePublication(store, request, featureFlags) {
  const target = reference(request?.publicationRef, "ATOMIC_PUBLICATION_LIFECYCLE_PUBLICATION_REF_REQUIRED");
  const matches = publicationStore(store).filter((item) => sameRef(publicationRef(item), target));
  if (matches.length !== 1) fail("ATOMIC_PUBLICATION_LIFECYCLE_PUBLICATION_MISMATCH", 404);
  const publication = matches[0];
  validateControlledManualPublicationClosure(store, publication, { featureFlags });
  if (request.workspaceId !== publication.workspaceId) fail("ATOMIC_PUBLICATION_LIFECYCLE_WORKSPACE_MISMATCH", 403);
  if (request.companyId !== publication.companyId) fail("ATOMIC_PUBLICATION_LIFECYCLE_COMPANY_MISMATCH", 403);
  if (request.accountId !== publication.accountId) fail("ATOMIC_PUBLICATION_LIFECYCLE_ACCOUNT_MISMATCH", 403);
  if (request.platform !== publication.platform) fail("ATOMIC_PUBLICATION_LIFECYCLE_PLATFORM_MISMATCH");
  if (request.projectId !== publication.contentProjectRef?.id) fail("ATOMIC_PUBLICATION_LIFECYCLE_PROJECT_MISMATCH");
  if (request.platformContentId !== publication.canonicalPlatformContentId) fail("ATOMIC_PUBLICATION_LIFECYCLE_CONTENT_ID_MISMATCH");
  return publication;
}

function validateCommon(value, contract, keys) {
  if (!exact(value, keys) || value.schemaVersion !== "1.0" || value.contract !== contract || value.immutable !== true
    || !text(value.id, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID") || !text(value.idempotencyKey, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
    || !HASH.test(value.requestHash || "") || value.actorType !== "user" || !text(value.actorId, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
    || value.method !== "manual_platform_observation" || !timestamp(value.recordedAt, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
    || !selfHash(value)) fail("ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  reference(value.publicationRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
}

const CORRECTION_KEYS = ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "publicationRef", "previousLifecycleHeadRef",
  "effectivePublishedAt", "evidenceRefs", "actorType", "actorId", "method", "observedAt", "recordedAt", "immutable", "claims", "factHash"];
const TAKEDOWN_KEYS = ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "publicationRef", "previousLifecycleHeadRef",
  "action", "actionAttemptedAt", "outcome", "observedAt", "observedAvailability", "evidenceRefs", "actorType", "actorId", "method", "recordedAt", "immutable", "claims", "factHash"];
const REPLACEMENT_KEYS = ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "publicationRef", "replacementPublicationRef",
  "previousLifecycleHeadRef", "replacementPreviousLifecycleHeadRef", "confirmedTakedownRef", "actorType", "actorId", "method", "observedAt",
  "recordedAt", "immutable", "claims", "factHash"];

export function validateAtomicPublicationLifecycleFact(value) {
  if (!EVENT_CONTRACTS.has(value?.contract)) fail("ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  if (value.contract === "ControlledPublicationCorrection@1.0") {
    validateCommon(value, value.contract, CORRECTION_KEYS);
    reference(value.previousLifecycleHeadRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    const evidence = normalizeEvidenceRefs(value.evidenceRefs, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    if (hashUnifiedContent(evidence) !== hashUnifiedContent(value.evidenceRefs)
      || (value.effectivePublishedAt !== null && !timestamp(value.effectivePublishedAt, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID"))
      || !timestamp(value.observedAt, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
      || (value.effectivePublishedAt !== null && Date.parse(value.effectivePublishedAt) > Date.parse(value.observedAt))
      || !exact(value.claims, ["identityChanged", "publicationMutated", "platformActionPerformed"])
      || value.claims.identityChanged !== false || value.claims.publicationMutated !== false || value.claims.platformActionPerformed !== false) fail("ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  } else if (value.contract === "ControlledPublicationTakedown@1.0") {
    validateCommon(value, value.contract, TAKEDOWN_KEYS);
    reference(value.previousLifecycleHeadRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    const evidence = normalizeEvidenceRefs(value.evidenceRefs, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    if (hashUnifiedContent(evidence) !== hashUnifiedContent(value.evidenceRefs)
      || !["delete", "unpublish", "make_unavailable"].includes(value.action)
      || !["confirmed_removed", "failed", "unknown"].includes(value.outcome)
      || !["available", "unavailable", "unknown"].includes(value.observedAvailability)
      || !timestamp(value.actionAttemptedAt, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
      || !timestamp(value.observedAt, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
      || Date.parse(value.observedAt) < Date.parse(value.actionAttemptedAt)
      || !((value.outcome === "confirmed_removed" && value.observedAvailability === "unavailable")
        || (value.outcome === "failed" && value.observedAvailability === "available")
        || (value.outcome === "unknown" && value.observedAvailability === "unknown"))
      || !exact(value.claims, ["platformActionExecutedBySystem", "localStateProvesPlatformRollback"])
      || value.claims.platformActionExecutedBySystem !== false || value.claims.localStateProvesPlatformRollback !== false) fail("ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  } else {
    validateCommon(value, value.contract, REPLACEMENT_KEYS);
    reference(value.replacementPublicationRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    reference(value.previousLifecycleHeadRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    reference(value.replacementPreviousLifecycleHeadRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    reference(value.confirmedTakedownRef, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
    if (sameRef(value.publicationRef, value.replacementPublicationRef) || !timestamp(value.observedAt, "ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID")
      || !exact(value.claims, ["oldPublicationMutated", "newPublicationMutated", "platformActionPerformed"])
      || value.claims.oldPublicationMutated !== false || value.claims.newPublicationMutated !== false || value.claims.platformActionPerformed !== false) fail("ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  }
  const copy = clone(value);
  for (const key of ["schemaVersion", "contract", "id", "idempotencyKey", "requestHash", "recordedAt", "immutable", "claims", "factHash"]) delete copy[key];
  const semanticHash = hashUnifiedContent(copy);
  const expectedId = `atomic-publication-lifecycle:${hashUnifiedContent({ contract: value.contract, requestHash: semanticHash, idempotencyKey: value.idempotencyKey }).slice(0, 24)}`;
  if (value.requestHash !== semanticHash || value.id !== expectedId) fail("ATOMIC_PUBLICATION_LIFECYCLE_FACT_INVALID");
  return true;
}

function validateLifecycleClosure(store, featureFlags) {
  const publications = publicationStore(store);
  const byRef = new Map();
  const heads = new Map();
  for (const publication of publications) {
    validateControlledManualPublicationClosure(store, publication, { featureFlags });
    const ref = publicationRef(publication);
    byRef.set(`${ref.id}:${ref.hash}`, publication);
    heads.set(ref.id, ref);
  }
  const history = new Map(publications.map((item) => [item.id, []]));
  const facts = eventStore(store);
  const seenIds = new Set();
  const seenHashes = new Set();
  const seenKeys = new Set();
  const seenSemantics = new Set();
  for (const fact of facts) {
    validateAtomicPublicationLifecycleFact(fact);
    const semanticKey = `${fact.contract}:${fact.requestHash}`;
    if (seenIds.has(fact.id) || seenHashes.has(fact.factHash) || seenKeys.has(fact.idempotencyKey) || seenSemantics.has(semanticKey)) {
      fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_DUPLICATE_INVALID");
    }
    seenIds.add(fact.id); seenHashes.add(fact.factHash); seenKeys.add(fact.idempotencyKey); seenSemantics.add(semanticKey);
    const primary = byRef.get(`${fact.publicationRef.id}:${fact.publicationRef.hash}`);
    if (!primary) fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_CLOSURE_INVALID");
    const primaryHistory = history.get(primary.id);
    if (primaryHistory.some((item) => item.contract === "ControlledPublicationReplacement@1.0" && sameRef(item.publicationRef, fact.publicationRef))) {
      fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_TERMINAL_SUCCESSOR_INVALID");
    }
    if (fact.contract === "ControlledPublicationTakedown@1.0" && primaryHistory.some((item) => item.contract === "ControlledPublicationTakedown@1.0"
      && item.outcome === "confirmed_removed" && item.observedAvailability === "unavailable")) {
      fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_TERMINAL_SUCCESSOR_INVALID");
    }
    if (!sameRef(heads.get(primary.id), fact.previousLifecycleHeadRef)) fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_CAS_INVALID");
    if (fact.contract === "ControlledPublicationReplacement@1.0") {
      const replacement = byRef.get(`${fact.replacementPublicationRef.id}:${fact.replacementPublicationRef.hash}`);
      if (!replacement || replacement.workspaceId !== primary.workspaceId || replacement.companyId !== primary.companyId
        || replacement.platform !== primary.platform || replacement.accountId !== primary.accountId
        || replacement.canonicalPlatformContentId === primary.canonicalPlatformContentId
        || !sameRef(heads.get(replacement.id), fact.replacementPreviousLifecycleHeadRef)) fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_REPLACEMENT_INVALID");
      const takedown = history.get(primary.id).find((item) => sameRef(selfRef(item), fact.confirmedTakedownRef));
      if (!takedown || takedown.contract !== "ControlledPublicationTakedown@1.0" || takedown.outcome !== "confirmed_removed"
        || takedown.observedAvailability !== "unavailable") fail("ATOMIC_PUBLICATION_LIFECYCLE_STORED_REPLACEMENT_INVALID");
      heads.set(replacement.id, selfRef(fact));
      history.get(replacement.id).push(fact);
    }
    heads.set(primary.id, selfRef(fact));
    history.get(primary.id).push(fact);
  }
  return { publications, byRef, heads, history };
}

function commonInput(store, input, options) {
  requireEnabled(options.featureFlags || {});
  const now = new Date(options.now ?? new Date().toISOString()).toISOString();
  const publication = resolvePublication(store, input?.request, options.featureFlags);
  const closure = validateLifecycleClosure(store, options.featureFlags);
  const expected = reference(input.expectedLifecycleHeadRef, "ATOMIC_PUBLICATION_LIFECYCLE_EXPECTED_HEAD_REQUIRED");
  const idempotencyKey = text(input.idempotencyKey, "ATOMIC_PUBLICATION_LIFECYCLE_IDEMPOTENCY_REQUIRED");
  const replayCandidate = eventStore(store).find((item) => item.idempotencyKey === idempotencyKey) || null;
  if (replayCandidate) validateAtomicPublicationLifecycleFact(replayCandidate);
  const actorId = text(input.actorId, "ATOMIC_PUBLICATION_LIFECYCLE_ACTOR_REQUIRED");
  if (input.actorType !== "user" || input.method !== "manual_platform_observation") fail("ATOMIC_PUBLICATION_LIFECYCLE_HUMAN_OBSERVATION_REQUIRED", 400);
  return { now, publication, closure, expected, idempotencyKey, actorId, replayCandidate };
}

function createFact(contract, semantics, idempotencyKey, recordedAt, claims) {
  const requestHash = hashUnifiedContent(semantics);
  const id = `atomic-publication-lifecycle:${hashUnifiedContent({ contract, requestHash, idempotencyKey }).slice(0, 24)}`;
  const base = { schemaVersion: "1.0", contract, id, idempotencyKey, requestHash, ...semantics, recordedAt, immutable: true, claims };
  const fact = { ...base, factHash: hashUnifiedContent(base) };
  validateAtomicPublicationLifecycleFact(fact);
  return fact;
}

function appendWithReplay(store, fact, closure) {
  const originalCollection = store[EVENT_COLLECTION];
  const facts = eventStore(store);
  const sameKey = facts.find((item) => item.idempotencyKey === fact.idempotencyKey);
  if (sameKey) {
    validateAtomicPublicationLifecycleFact(sameKey);
    if (sameKey.contract !== fact.contract || sameKey.requestHash !== fact.requestHash) fail("ATOMIC_PUBLICATION_LIFECYCLE_IDEMPOTENCY_CONFLICT");
    return { fact: clone(sameKey), created: false };
  }
  if (facts.some((item) => item.contract === fact.contract && item.requestHash === fact.requestHash)) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_DUPLICATE_SEMANTICS");
  }
  const primaryHistory = closure.history.get(fact.publicationRef.id) || [];
  if (primaryHistory.some((item) => item.contract === "ControlledPublicationReplacement@1.0" && sameRef(item.publicationRef, fact.publicationRef))) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_TERMINAL_SUCCESSOR_FORBIDDEN");
  }
  if (fact.contract === "ControlledPublicationTakedown@1.0" && primaryHistory.some((item) => item.contract === "ControlledPublicationTakedown@1.0"
    && item.outcome === "confirmed_removed" && item.observedAvailability === "unavailable")) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_TERMINAL_SUCCESSOR_FORBIDDEN");
  }
  if (!sameRef(closure.heads.get(fact.publicationRef.id), fact.previousLifecycleHeadRef)) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_HEAD_CONFLICT");
  }
  if (fact.contract === "ControlledPublicationReplacement@1.0"
    && !sameRef(closure.heads.get(fact.replacementPublicationRef.id), fact.replacementPreviousLifecycleHeadRef)) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_REPLACEMENT_HEAD_CONFLICT");
  }
  if (facts.some((item) => item.id === fact.id || item.factHash === fact.factHash)) fail("ATOMIC_PUBLICATION_LIFECYCLE_DUPLICATE");
  // Recheck both the immutable array identity and its derived heads immediately before the single assignment.
  if (store[EVENT_COLLECTION] !== originalCollection) fail("ATOMIC_PUBLICATION_LIFECYCLE_CONCURRENT_WRITE");
  const current = validateLifecycleClosure(store, { atomicManualPublicationV1: true, unifiedContentAtomicProductV1: true,
    unifiedContentAtomicWechatProductV1: true, unifiedContentAtomicWechatArtifactV1: true,
    unifiedContentAtomicWechatHumanSelectionV1: true, unifiedContentAtomicWechatPromotionUploadDeliveryV1: true });
  for (const [id, head] of closure.heads) if (!sameRef(current.heads.get(id), head)) fail("ATOMIC_PUBLICATION_LIFECYCLE_HEAD_CONFLICT");
  store[EVENT_COLLECTION] = [...facts, fact];
  return { fact: clone(fact), created: true };
}

export function confirmAtomicPublicationCorrection(store, input, options = {}) {
  const context = commonInput(store, input, options);
  const observedAt = timestamp(input.observedAt, "ATOMIC_PUBLICATION_LIFECYCLE_OBSERVED_AT_INVALID", context.now);
  const effectivePublishedAt = input.effectivePublishedAt == null ? null : timestamp(input.effectivePublishedAt, "ATOMIC_PUBLICATION_LIFECYCLE_EFFECTIVE_TIME_INVALID", context.now);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs, "ATOMIC_PUBLICATION_LIFECYCLE_EVIDENCE_REQUIRED");
  const semantics = { publicationRef: publicationRef(context.publication), previousLifecycleHeadRef: clone(context.expected), effectivePublishedAt,
    evidenceRefs, actorType: "user", actorId: context.actorId, method: input.method, observedAt };
  const fact = createFact("ControlledPublicationCorrection@1.0", semantics, context.idempotencyKey, context.now,
    { identityChanged: false, publicationMutated: false, platformActionPerformed: false });
  return appendWithReplay(store, fact, context.closure);
}

export function confirmAtomicPublicationTakedown(store, input, options = {}) {
  const context = commonInput(store, input, options);
  const actionAttemptedAt = timestamp(input.actionAttemptedAt, "ATOMIC_PUBLICATION_LIFECYCLE_ACTION_TIME_INVALID", context.now);
  const observedAt = timestamp(input.observedAt, "ATOMIC_PUBLICATION_LIFECYCLE_OBSERVED_AT_INVALID", context.now);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs, "ATOMIC_PUBLICATION_LIFECYCLE_EVIDENCE_REQUIRED");
  const semantics = { publicationRef: publicationRef(context.publication), previousLifecycleHeadRef: clone(context.expected), action: input.action, actionAttemptedAt,
    outcome: input.outcome, observedAt, observedAvailability: input.observedAvailability, evidenceRefs,
    actorType: "user", actorId: context.actorId, method: input.method };
  const fact = createFact("ControlledPublicationTakedown@1.0", semantics, context.idempotencyKey, context.now,
    { platformActionExecutedBySystem: false, localStateProvesPlatformRollback: false });
  return appendWithReplay(store, fact, context.closure);
}

export function confirmAtomicPublicationReplacement(store, input, options = {}) {
  const context = commonInput(store, input, options);
  const replacement = resolvePublication(store, input.replacementRequest, options.featureFlags || {});
  if (replacement.id === context.publication.id || replacement.workspaceId !== context.publication.workspaceId
    || replacement.companyId !== context.publication.companyId || replacement.platform !== context.publication.platform
    || replacement.accountId !== context.publication.accountId
    || replacement.canonicalPlatformContentId === context.publication.canonicalPlatformContentId) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_REPLACEMENT_SCOPE_INVALID");
  }
  const replacementExpected = reference(input.expectedReplacementLifecycleHeadRef, "ATOMIC_PUBLICATION_LIFECYCLE_REPLACEMENT_HEAD_REQUIRED");
  const takedownRef = reference(input.confirmedTakedownRef, "ATOMIC_PUBLICATION_LIFECYCLE_TAKEDOWN_REF_REQUIRED");
  const takedown = context.closure.history.get(context.publication.id).find((item) => sameRef(selfRef(item), takedownRef));
  if (!takedown || takedown.contract !== "ControlledPublicationTakedown@1.0" || takedown.outcome !== "confirmed_removed"
    || takedown.observedAvailability !== "unavailable") fail("ATOMIC_PUBLICATION_LIFECYCLE_CONFIRMED_TAKEDOWN_REQUIRED");
  const observedAt = timestamp(input.observedAt, "ATOMIC_PUBLICATION_LIFECYCLE_OBSERVED_AT_INVALID", context.now);
  const semantics = { publicationRef: publicationRef(context.publication), replacementPublicationRef: publicationRef(replacement),
    previousLifecycleHeadRef: clone(context.expected), replacementPreviousLifecycleHeadRef: clone(replacementExpected), confirmedTakedownRef: clone(takedownRef),
    actorType: "user", actorId: context.actorId, method: input.method, observedAt };
  const fact = createFact("ControlledPublicationReplacement@1.0", semantics, context.idempotencyKey, context.now,
    { oldPublicationMutated: false, newPublicationMutated: false, platformActionPerformed: false });
  return appendWithReplay(store, fact, context.closure);
}

function lifecycleState(store, publication, featureFlags) {
  const closure = validateLifecycleClosure(store, featureFlags);
  const history = closure.history.get(publication.id) || [];
  let effectivePublishedAt = publication.publishedAt;
  let effectiveEvidenceRefs = [];
  let takedown = null;
  let replacement = null;
  for (const fact of history) {
    if (fact.contract === "ControlledPublicationCorrection@1.0") {
      effectivePublishedAt = fact.effectivePublishedAt || effectivePublishedAt;
      effectiveEvidenceRefs = clone(fact.evidenceRefs);
    } else if (fact.contract === "ControlledPublicationTakedown@1.0") takedown = fact;
    else if (fact.contract === "ControlledPublicationReplacement@1.0" && sameRef(fact.publicationRef, publicationRef(publication))) replacement = fact;
  }
  let currentPlatformState = "published_available";
  let currentlyAvailable = true;
  if (replacement) { currentPlatformState = "replaced"; currentlyAvailable = false; }
  else if (takedown?.outcome === "confirmed_removed" && takedown.observedAvailability === "unavailable") { currentPlatformState = "published_unavailable"; currentlyAvailable = false; }
  else if (takedown && (takedown.outcome === "unknown" || takedown.observedAvailability === "unknown")) { currentPlatformState = "unknown"; currentlyAvailable = null; }
  else if (takedown?.observedAvailability === "available") { currentPlatformState = "published_available"; currentlyAvailable = true; }
  return { closure, history, effectivePublishedAt, effectiveEvidenceRefs, takedown, replacement, currentPlatformState, currentlyAvailable };
}

export function projectAtomicPublicationLifecycle(store, request, { featureFlags = {} } = {}) {
  requireEnabled(featureFlags);
  const publication = resolvePublication(store, request, featureFlags);
  const state = lifecycleState(store, publication, featureFlags);
  return Object.freeze({
    schemaVersion: "1.0", contract: "ControlledPublicationLifecycleProjection@1.0",
    publicationRef: publicationRef(publication), platform: publication.platform, everPublished: true, published: true,
    currentPlatformState: state.currentPlatformState, currentlyAvailable: state.currentlyAvailable,
    effectivePublishedAt: state.effectivePublishedAt, effectiveEvidenceRefs: state.effectiveEvidenceRefs,
    lifecycleHeadRef: clone(state.closure.heads.get(publication.id)),
    correctionRefs: state.history.filter((item) => item.contract === "ControlledPublicationCorrection@1.0").map(selfRef),
    takedownRefs: state.history.filter((item) => item.contract === "ControlledPublicationTakedown@1.0").map(selfRef),
    replacementRefs: state.history.filter((item) => item.contract === "ControlledPublicationReplacement@1.0").map(selfRef)
  });
}

function classifySnapshotWindow(store, publication, snapshot, featureFlags) {
  const state = lifecycleState(store, publication, featureFlags);
  const start = Date.parse(snapshot.measurementWindow.startedAt);
  const end = Date.parse(snapshot.measurementWindow.endedAt);
  if (start < Date.parse(state.effectivePublishedAt)) return { classification: "invalid_before_effective_publication", lifecycleHeadRef: state.closure.heads.get(publication.id), takedownRef: null };
  if (!state.takedown) return { classification: "valid_active", lifecycleHeadRef: state.closure.heads.get(publication.id), takedownRef: null };
  const boundary = state.takedown.outcome === "confirmed_removed" && state.takedown.observedAvailability === "unavailable"
    ? Date.parse(state.takedown.observedAt) : Date.parse(state.takedown.actionAttemptedAt);
  const takedownRef = selfRef(state.takedown);
  if (end <= boundary) return { classification: "valid_pre_takedown", lifecycleHeadRef: state.closure.heads.get(publication.id), takedownRef };
  if (state.takedown.outcome !== "confirmed_removed" || state.takedown.observedAvailability !== "unavailable") {
    return { classification: "invalid_unresolved_availability", lifecycleHeadRef: state.closure.heads.get(publication.id), takedownRef };
  }
  if (start < boundary && end > boundary) return { classification: snapshot.measurementWindow.label === "custom" ? "crossing_custom" : "invalid_crossing_canonical", lifecycleHeadRef: state.closure.heads.get(publication.id), takedownRef };
  return { classification: "invalid_post_takedown", lifecycleHeadRef: state.closure.heads.get(publication.id), takedownRef };
}

const BINDING_KEYS = ["schemaVersion", "contract", "id", "snapshotRef", "publicationRef", "lifecycleHeadRefAtCapture", "takedownRefAtCapture",
  "effectivePublishedAtAtCapture", "classificationAtCapture", "createdAt", "immutable", "bindingHash"];

export function validatePublicationSnapshotLifecycleBinding(value) {
  if (!exact(value, BINDING_KEYS) || value.schemaVersion !== "1.0" || value.contract !== "PublicationMetricSnapshotLifecycleBinding@1.0"
    || value.immutable !== true || !text(value.id, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID")
    || !reference(value.snapshotRef, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID")
    || !reference(value.publicationRef, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID")
    || !reference(value.lifecycleHeadRefAtCapture, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID")
    || (value.takedownRefAtCapture !== null && !reference(value.takedownRefAtCapture, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID"))
    || !timestamp(value.effectivePublishedAtAtCapture, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID")
    || !["valid_active", "valid_pre_takedown", "crossing_custom"].includes(value.classificationAtCapture)
    || !timestamp(value.createdAt, "ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID") || !selfHash(value, "bindingHash")
    || value.id !== `atomic-publication-snapshot-lifecycle:${hashUnifiedContent({ snapshotRef: value.snapshotRef, publicationRef: value.publicationRef }).slice(0, 24)}`) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_BINDING_INVALID");
  }
  return true;
}

export function preparePublicationSnapshotLifecycleBinding(store, publication, snapshot, { featureFlags = {}, now = new Date().toISOString() } = {}) {
  requireEnabled(featureFlags);
  validateControlledManualPublicationClosure(store, publication, { featureFlags });
  if (!sameRef(snapshot.publicationRef, publicationRef(publication))) fail("ATOMIC_PUBLICATION_LIFECYCLE_SNAPSHOT_PUBLICATION_MISMATCH");
  const classification = classifySnapshotWindow(store, publication, snapshot, featureFlags);
  if (!["valid_active", "valid_pre_takedown", "crossing_custom"].includes(classification.classification)) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_SNAPSHOT_WINDOW_BLOCKED", 409, { classification: classification.classification });
  }
  const state = lifecycleState(store, publication, featureFlags);
  const base = {
    schemaVersion: "1.0", contract: "PublicationMetricSnapshotLifecycleBinding@1.0",
    id: `atomic-publication-snapshot-lifecycle:${hashUnifiedContent({ snapshotRef: { id: snapshot.id, hash: snapshot.snapshotHash }, publicationRef: publicationRef(publication) }).slice(0, 24)}`,
    snapshotRef: { id: snapshot.id, hash: snapshot.snapshotHash }, publicationRef: publicationRef(publication),
    lifecycleHeadRefAtCapture: clone(classification.lifecycleHeadRef), takedownRefAtCapture: classification.takedownRef ? clone(classification.takedownRef) : null,
    effectivePublishedAtAtCapture: state.effectivePublishedAt, classificationAtCapture: classification.classification,
    createdAt: new Date(now).toISOString(), immutable: true
  };
  const binding = { ...base, bindingHash: hashUnifiedContent(base) };
  validatePublicationSnapshotLifecycleBinding(binding);
  const existing = bindingStore(store).find((item) => sameRef(item.snapshotRef, binding.snapshotRef));
  if (existing) {
    validatePublicationSnapshotLifecycleBinding(existing);
    if (existing.bindingHash !== binding.bindingHash) fail("ATOMIC_PUBLICATION_LIFECYCLE_BINDING_CONFLICT");
    return { binding: clone(existing), created: false };
  }
  return { binding, created: true };
}

export function nextPublicationSnapshotLifecycleBindings(store, binding) {
  validatePublicationSnapshotLifecycleBinding(binding);
  const bindings = bindingStore(store);
  if (bindings.some((item) => sameRef(item.snapshotRef, binding.snapshotRef))) fail("ATOMIC_PUBLICATION_LIFECYCLE_BINDING_DUPLICATE");
  return [...bindings, clone(binding)];
}

export function classifyStoredPublicationSnapshot(store, publication, snapshot, { featureFlags = {} } = {}) {
  requireEnabled(featureFlags);
  const bindings = bindingStore(store);
  for (const binding of bindings) validatePublicationSnapshotLifecycleBinding(binding);
  const matches = bindings.filter((item) => sameRef(item.snapshotRef, { id: snapshot.id, hash: snapshot.snapshotHash }));
  if (matches.length > 1 || (matches.length === 1 && !sameRef(matches[0].publicationRef, publicationRef(publication)))) {
    fail("ATOMIC_PUBLICATION_LIFECYCLE_BINDING_CLOSURE_INVALID");
  }
  return { ...classifySnapshotWindow(store, publication, snapshot, featureFlags), bindingRef: matches[0] ? { id: matches[0].id, hash: matches[0].bindingHash } : null };
}
