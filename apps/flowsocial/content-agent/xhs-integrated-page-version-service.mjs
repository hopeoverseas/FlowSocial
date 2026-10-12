import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import {
  validatePageAssetRevision, validatePageCandidate, validatePageFactCheck,
  validatePageNormalizationRecord, validatePageTextCheck, validateRevisionNormalizationBinding,
  validateXhsIntegratedVisualReview, validateXhsVisualSetSnapshot,
  VERTICAL_CONTRACTS, withHash
} from "../image-providers/xhs-integrated-page/vertical-contracts.mjs";
import { assertCandidateSelectable } from "./xhs-integrated-page-offline-pipeline.mjs";
import { appendDeliveryEvent } from "./xhs-integrated-page-delivery-tracker.mjs";

const clone = (value) => structuredClone(value);
const ref = (value, field) => ({ id: value.id, hash: value[field] });
const assetFields = (value) => ({ relativePath: value.relativePath, sha256: value.sha256, bytes: value.bytes, dimensions: value.dimensions });

function assertGateBindings(candidate, normalization, textCheck, factCheck, visualReview) {
  validatePageCandidate(candidate); validatePageNormalizationRecord(normalization);
  validatePageTextCheck(textCheck); validatePageFactCheck(factCheck); validateXhsIntegratedVisualReview(visualReview);
  const refs = [normalization.candidateRef, textCheck.candidateRef, factCheck.candidateRef, visualReview.candidateRef]; if (refs.some((item) => item.id !== candidate.id)) throw new Error("CANDIDATE_GATE_ID_MISMATCH");
  const stage = (changes) => { const base = { ...clone(candidate), ...changes }; delete base.candidateHash; return withHash(base, "candidateHash"); };
  const initial = stage({ normalizationStatus: "pending", finalCanvasStatus: "pending", textStatus: "pending", factStatus: "pending", visualStatus: "pending", blockers: [] });
  const normalized = stage({ textStatus: "pending", factStatus: "pending", visualStatus: "pending", blockers: [] });
  const textPassed = stage({ factStatus: "pending", visualStatus: "pending", blockers: [] });
  const factsPassed = stage({ visualStatus: "pending", blockers: [] });
  if (normalization.candidateRef.hash !== initial.candidateHash || textCheck.candidateRef.hash !== normalized.candidateHash || factCheck.candidateRef.hash !== textPassed.candidateHash || visualReview.candidateRef.hash !== factsPassed.candidateHash) throw new Error("CANDIDATE_GATE_HASH_CHAIN_MISMATCH");
  if (textCheck.status !== candidate.textStatus || factCheck.status !== candidate.factStatus || visualReview.overallStatus !== candidate.visualStatus) throw new Error("CANDIDATE_GATE_STATUS_MISMATCH");
  assertCandidateSelectable(candidate);
}

export function createSnapshotPageFromRevision({ revision, normalization, textCheck, factCheck, visualReview }) {
  validatePageAssetRevision(revision); validatePageNormalizationRecord(normalization);
  validatePageTextCheck(textCheck); validatePageFactCheck(factCheck); validateXhsIntegratedVisualReview(visualReview);
  validateRevisionNormalizationBinding(revision, normalization);
  const expectedRefs = { text: ref(textCheck, "checkHash"), fact: ref(factCheck, "checkHash"), visual: ref(visualReview, "reviewHash") };
  if (stableHash(revision.gateRefs) !== stableHash(expectedRefs)) throw new Error("SNAPSHOT_GATE_REF_MISMATCH");
  if (textCheck.status !== "passed" || factCheck.status !== "passed" || visualReview.overallStatus !== "passed" || normalization.status !== "succeeded" || normalization.outputDimensions.width !== 1080 || normalization.outputDimensions.height !== 1440) throw new Error("SNAPSHOT_PAGE_GATE_BLOCKED");
  return {
    pageId: revision.pageId,
    revisionRef: ref(revision, "revisionHash"),
    source: revision.generationMode === "integrated_page_generation" ? "normalized_integrated" : "deterministic_layout",
    gateSummary: { text: "passed", fact: "passed", visual: "passed", finalCanvas: "passed" }
  };
}

export function createSelectedRevision({ candidate, normalization, textCheck, factCheck, visualReview, parentRevision = null, asset, selectedBy, selectedAt, revision, operation = "select", sourceRevision = null }) {
  assertGateBindings(candidate, normalization, textCheck, factCheck, visualReview);
  if (!normalization.outputAsset || stableHash(assetFields(asset)) !== stableHash(assetFields(normalization.outputAsset))) throw new Error("REVISION_NORMALIZATION_ASSET_MISMATCH");
  if (parentRevision) validatePageAssetRevision(parentRevision);
  if (sourceRevision) validatePageAssetRevision(sourceRevision);
  const base = {
    schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.revision,
    id: `revision:${candidate.contentTaskId}:v${candidate.contentVersion}:${candidate.pageId}:r${revision}`,
    contentTaskId: candidate.contentTaskId, contentVersion: candidate.contentVersion, pageId: candidate.pageId,
    revision, parentRevisionId: parentRevision?.id || null, operation,
    generationMode: candidate.generationMode, sourceCandidateRef: ref(candidate, "candidateHash"),
    sourceRevisionRef: sourceRevision ? ref(sourceRevision, "revisionHash") : null,
    asset: clone(asset), normalizationRef: ref(normalization, "recordHash"),
    gateRefs: { text: ref(textCheck, "checkHash"), fact: ref(factCheck, "checkHash"), visual: ref(visualReview, "reviewHash") },
    selectedBy, selectedAt, createdAt: selectedAt
  };
  const value = withHash(base, "revisionHash"); validatePageAssetRevision(value); return value;
}

export function validateRevisionDag(revisions) {
  const byId = new Map();
  for (const revision of revisions) { validatePageAssetRevision(revision); if (byId.has(revision.id)) throw new Error("REVISION_DAG_DUPLICATE_ID"); byId.set(revision.id, revision); }
  for (const revision of revisions) {
    if (!revision.parentRevisionId) continue;
    const parent = byId.get(revision.parentRevisionId);
    if (!parent) throw new Error("REVISION_DAG_PARENT_MISSING");
    if (parent.pageId !== revision.pageId || parent.contentTaskId !== revision.contentTaskId || parent.contentVersion !== revision.contentVersion) throw new Error("REVISION_DAG_CROSS_PAGE_PARENT");
    if (parent.revision >= revision.revision) throw new Error("REVISION_DAG_NON_MONOTONIC");
    const seen = new Set([revision.id]); let cursor = parent;
    while (cursor) { if (seen.has(cursor.id)) throw new Error("REVISION_DAG_CYCLE"); seen.add(cursor.id); cursor = cursor.parentRevisionId ? byId.get(cursor.parentRevisionId) : null; }
  }
  return { status: "passed", revisionCount: revisions.length, dagHash: stableHash(revisions.map((item) => ({ id: item.id, hash: item.revisionHash, parent: item.parentRevisionId })).sort((a, b) => a.id.localeCompare(b.id))) };
}

export function createVisualSetSnapshot({ id, contentTaskId, contentVersion, revision, parentSnapshot = null, operation = "freeze", pages, createdBy, createdAt }) {
  if (parentSnapshot) validateXhsVisualSetSnapshot(parentSnapshot);
  const base = { schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.snapshot, id, contentTaskId, contentVersion, revision, parentSnapshotId: parentSnapshot?.id || null, operation, pages: clone(pages), createdBy, createdAt, blockers: [] };
  const snapshot = withHash(base, "snapshotHash"); validateXhsVisualSetSnapshot(snapshot); return snapshot;
}

async function put(store, type, value, version, hashField) {
  const result = await store.putObject(type, value, { expectedVersion: version, hashField }); return result.version;
}

export async function persistSelectedPage({ store, candidate, normalization, textCheck, factCheck, visualReview, sourceBytes, normalizedBytes, selectedBy, selectedAt, idempotencyKey, expectedVersion, parentRevision = null }) {
  assertGateBindings(candidate, normalization, textCheck, factCheck, visualReview);
  if (!normalization.outputAsset || !sourceBytes || !normalizedBytes) throw new Error("SOURCE_AND_NORMALIZED_ASSETS_REQUIRED");
  await store.writeAsset(normalization.inputAsset.relativePath, sourceBytes, normalization.inputAsset.sha256);
  await store.writeAsset(normalization.outputAsset.relativePath, normalizedBytes, normalization.outputAsset.sha256);
  let version = expectedVersion;
  ({ version } = await store.registerAsset(normalization.inputAsset.relativePath, normalization.inputAsset.sha256, { expectedVersion: version }));
  ({ version } = await store.registerAsset(normalization.outputAsset.relativePath, normalization.outputAsset.sha256, { expectedVersion: version }));
  version = await put(store, "candidates", candidate, version, "candidateHash");
  version = await put(store, "normalizations", normalization, version, "recordHash");
  version = await put(store, "textChecks", textCheck, version, "checkHash");
  version = await put(store, "factChecks", factCheck, version, "checkHash");
  version = await put(store, "visualReviews", visualReview, version, "reviewHash");
  const existing = (await store.listObjects("revisions")).filter((item) => item.pageId === candidate.pageId && item.contentTaskId === candidate.contentTaskId);
  const revision = createSelectedRevision({ candidate, normalization, textCheck, factCheck, visualReview, parentRevision, asset: normalization.outputAsset, selectedBy, selectedAt, revision: Math.max(0, ...existing.map((item) => item.revision)) + 1 });
  version = await put(store, "revisions", revision, version, "revisionHash");
  const event = await appendDeliveryEvent(store, { type: "candidate_selected", aggregateRef: ref(revision, "revisionHash"), actor: selectedBy, at: selectedAt, payload: { candidateRef: ref(candidate, "candidateHash"), revisionRef: ref(revision, "revisionHash"), selectionStatus: "selected" }, idempotencyKey }, version);
  return { revision, event: event.result, version: event.version };
}

export async function rejectCandidate({ store, candidate, actor, at, reasonCodes, idempotencyKey, expectedVersion }) {
  validatePageCandidate(candidate);
  return appendDeliveryEvent(store, { type: "candidate_rejected", aggregateRef: ref(candidate, "candidateHash"), actor, at, payload: { candidateRef: ref(candidate, "candidateHash"), reasonCodes: clone(reasonCodes), selectionStatus: "rejected" }, idempotencyKey }, expectedVersion);
}

export async function persistSnapshot({ store, snapshot, expectedVersion }) {
  validateXhsVisualSetSnapshot(snapshot); const revisions = await store.listObjects("revisions"); const normalizations = await store.listObjects("normalizations"); const normalizationById = new Map(normalizations.map((item) => [item.id, item])); validateRevisionDag(revisions);
  revisions.forEach((revision) => validateRevisionNormalizationBinding(revision, normalizationById.get(revision.normalizationRef.id)));
  const byId = new Map(revisions.map((item) => [item.id, item]));
  for (const page of snapshot.pages) if (byId.get(page.revisionRef.id)?.revisionHash !== page.revisionRef.hash) throw new Error("SNAPSHOT_REVISION_REF_MISMATCH");
  return store.putObject("snapshots", snapshot, { expectedVersion, hashField: "snapshotHash" });
}

export async function restorePage({ store, sourceRevision, currentRevision, actor, at, idempotencyKey, expectedVersion, operation = "page_restore" }) {
  validatePageAssetRevision(sourceRevision); validatePageAssetRevision(currentRevision);
  if (sourceRevision.pageId !== currentRevision.pageId) throw new Error("RESTORE_PAGE_MISMATCH");
  const prior = (await store.listEvents()).find((item) => item.idempotencyKey === idempotencyKey);
  if (prior) return { revision: await store.getObject("revisions", prior.payload.revisionRef.id), event: prior, version: (await store.readState()).version, idempotent: true };
  const all = await store.listObjects("revisions"); const nextNumber = Math.max(...all.filter((item) => item.pageId === currentRevision.pageId).map((item) => item.revision)) + 1;
  const base = { ...clone(sourceRevision), id: `revision:${sourceRevision.contentTaskId}:v${sourceRevision.contentVersion}:${sourceRevision.pageId}:r${nextNumber}`, revision: nextNumber, parentRevisionId: currentRevision.id, operation, sourceRevisionRef: ref(sourceRevision, "revisionHash"), selectedBy: actor, selectedAt: at, createdAt: at };
  delete base.revisionHash; const revision = withHash(base, "revisionHash"); validatePageAssetRevision(revision);
  const putResult = await store.putObject("revisions", revision, { expectedVersion, hashField: "revisionHash" });
  const event = await appendDeliveryEvent(store, { type: "page_restored", aggregateRef: ref(revision, "revisionHash"), actor, at, payload: { sourceRevisionRef: ref(sourceRevision, "revisionHash"), previousRevisionRef: ref(currentRevision, "revisionHash"), revisionRef: ref(revision, "revisionHash") }, idempotencyKey }, putResult.version);
  return { revision, event: event.result, version: event.version, idempotent: false };
}

export async function restoreSet({ store, sourceSnapshot, currentSnapshot, actor, at, idempotencyKey, expectedVersion }) {
  validateXhsVisualSetSnapshot(sourceSnapshot); validateXhsVisualSetSnapshot(currentSnapshot);
  const prior = (await store.listEvents()).find((item) => item.idempotencyKey === idempotencyKey);
  if (prior) return { snapshot: await store.getObject("snapshots", prior.payload.snapshotRef.id), event: prior, version: (await store.readState()).version, idempotent: true };
  let version = expectedVersion; const pages = [];
  for (const sourcePage of sourceSnapshot.pages) {
    const currentPage = currentSnapshot.pages.find((item) => item.pageId === sourcePage.pageId); if (!currentPage) throw new Error("RESTORE_SET_PAGE_MISSING");
    const sourceRevision = await store.getObject("revisions", sourcePage.revisionRef.id); const currentRevision = await store.getObject("revisions", currentPage.revisionRef.id);
    const restored = await restorePage({ store, sourceRevision, currentRevision, actor, at, idempotencyKey: `${idempotencyKey}:${sourcePage.pageId}`, expectedVersion: version, operation: "set_restore" }); version = restored.version;
    pages.push({ ...clone(sourcePage), revisionRef: ref(restored.revision, "revisionHash") });
  }
  const snapshots = await store.listObjects("snapshots"); const snapshot = createVisualSetSnapshot({ id: `snapshot:${sourceSnapshot.contentTaskId}:r${snapshots.length + 1}`, contentTaskId: sourceSnapshot.contentTaskId, contentVersion: sourceSnapshot.contentVersion, revision: Math.max(0, ...snapshots.map((item) => item.revision)) + 1, parentSnapshot: currentSnapshot, operation: "set_restore", pages, createdBy: actor, createdAt: at });
  const stored = await persistSnapshot({ store, snapshot, expectedVersion: version }); version = stored.version;
  const event = await appendDeliveryEvent(store, { type: "set_restored", aggregateRef: ref(snapshot, "snapshotHash"), actor, at, payload: { sourceSnapshotRef: ref(sourceSnapshot, "snapshotHash"), previousSnapshotRef: ref(currentSnapshot, "snapshotHash"), snapshotRef: ref(snapshot, "snapshotHash") }, idempotencyKey }, version);
  return { snapshot, event: event.result, version: event.version, idempotent: false };
}

export { validateRevisionNormalizationBinding };
