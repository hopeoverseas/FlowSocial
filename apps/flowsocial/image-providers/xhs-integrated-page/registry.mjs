import { clone, stableHash } from "./canonical.mjs";
import { CONTRACTS, validateVisualAssetEvaluationRecord, validateVisualAssetRegistrySnapshot, withComputedHash } from "./contracts.mjs";

const lifecycle = ["quarantine", "normalized", "experimental", "approved", "deprecated"];
const blocker = (code, scope, detail) => ({ code, scope, detail, fallback: "deterministic_layout" });

function registryEntry({ id, assetType, sourceRef, sourceHash, status, license, authorization = null, applicability, failureModes }) {
  if (status === "approved") throw new Error(`APPROVED_ASSET_FORBIDDEN:${id}`);
  const base = {
    id,
    assetType,
    sourceRef,
    sourceHash,
    status,
    license,
    authorization,
    applicabilityHash: stableHash(applicability),
    failureModesHash: stableHash(failureModes)
  };
  return { ...base, entryHash: stableHash(base) };
}

function libraryEntries(document, assetType, sourceRef) {
  return document.entries.map((entry) => registryEntry({
    id: entry.id,
    assetType,
    sourceRef,
    sourceHash: stableHash(entry),
    status: entry.status,
    license: { id: entry.source.license, allowsOfflineCompilation: true, allowsGenerationReference: false },
    applicability: entry.applicability,
    failureModes: entry.failureModes
  }));
}

export function buildVisualAssetRegistrySnapshot({ id, libraries, referenceAssets = [] }) {
  const sources = [
    { document: libraries.archetypes, assetType: "page_archetype", sourceRef: "skills/design-xhs-integrated-pages/references/page-archetypes.json" },
    { document: libraries.styles, assetType: "style_pack", sourceRef: "skills/design-xhs-integrated-pages/references/style-packs.json" },
    { document: libraries.patterns, assetType: "prompt_pattern", sourceRef: "skills/design-xhs-integrated-pages/references/prompt-patterns.json" }
  ];
  const entries = sources.flatMap((item) => libraryEntries(item.document, item.assetType, item.sourceRef));
  for (const asset of referenceAssets) {
    entries.push(registryEntry({
      id: asset.id,
      assetType: "reference_asset",
      sourceRef: asset.sourceRef,
      sourceHash: asset.sourceHash,
      status: asset.status,
      license: asset.license,
      authorization: asset.authorization,
      applicability: asset.applicability,
      failureModes: asset.failureModes
    }));
  }
  const seenIds = new Set();
  for (const entry of entries) {
    if (seenIds.has(entry.id)) throw new Error(`REGISTRY_DUPLICATE_ASSET_ID:${entry.id}`);
    seenIds.add(entry.id);
  }
  const sourceLibraries = sources.map((item) => ({ library: item.document.library, schemaVersion: item.document.schemaVersion, sourceRef: item.sourceRef, sourceHash: stableHash(item.document) }));
  const base = {
    schemaVersion: "1.0",
    contract: CONTRACTS.visualAssetRegistrySnapshot,
    id,
    lifecycle,
    sourceLibraries,
    entries,
    productionQuery: {
      status: "blocked_no_approved_assets",
      eligibleAssetIds: [],
      blocker: blocker("NO_APPROVED_ASSETS", "productionQuery", "本任务禁止 approved，生产查询为空")
    }
  };
  const snapshot = { ...base, snapshotHash: stableHash(base) };
  validateVisualAssetRegistrySnapshot(snapshot);
  return snapshot;
}

export function transitionRegistryEntry(snapshot, assetId, toStatus) {
  validateVisualAssetRegistrySnapshot(snapshot);
  const entry = snapshot.entries.find((item) => item.id === assetId);
  if (!entry) return { snapshot, blocker: blocker("REGISTRY_ASSET_NOT_FOUND", assetId, "Registry 中不存在该资产") };
  const fromIndex = lifecycle.indexOf(entry.status);
  const toIndex = lifecycle.indexOf(toStatus);
  if (fromIndex < 0 || toIndex !== fromIndex + 1) return { snapshot, blocker: blocker("ILLEGAL_ASSET_STATUS_TRANSITION", assetId, `${entry.status} -> ${toStatus}`) };
  if (toStatus === "approved") return { snapshot, blocker: blocker("APPROVED_ASSET_FORBIDDEN", assetId, "FS-V1-XHS-VISUAL-05C-R 禁止晋级 approved") };
  const next = clone(snapshot);
  const target = next.entries.find((item) => item.id === assetId);
  target.status = toStatus;
  const entryBase = { ...target };
  delete entryBase.entryHash;
  target.entryHash = stableHash(entryBase);
  const snapshotBase = { ...next };
  delete snapshotBase.snapshotHash;
  next.snapshotHash = stableHash(snapshotBase);
  validateVisualAssetRegistrySnapshot(next);
  return { snapshot: next, blocker: null };
}

export function queryProductionEligible(snapshot) {
  validateVisualAssetRegistrySnapshot(snapshot);
  return clone(snapshot.productionQuery);
}

export function createVisualAssetEvaluationRecord(input) {
  const base = {
    schemaVersion: "1.0",
    contract: CONTRACTS.visualAssetEvaluationRecord,
    id: input.id,
    assetId: input.assetId,
    assetType: input.assetType,
    registrySnapshotRef: input.registrySnapshotRef,
    evaluationMode: "offline_fixture",
    decision: input.decision,
    evidenceRefs: [...input.evidenceRefs],
    observations: [...input.observations],
    risks: [...input.risks],
    failureModes: [...input.failureModes],
    remediation: [...input.remediation],
    reviewState: "pending_human_review",
    productionEligible: false
  };
  const record = withComputedHash(base, "recordHash");
  validateVisualAssetEvaluationRecord(record);
  return record;
}
