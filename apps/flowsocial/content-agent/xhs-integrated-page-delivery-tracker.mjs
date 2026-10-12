import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import {
  makeBlocker, validateFlowSocialDeliveryManifest, validatePageAssetRevision, validatePageNormalizationRecord, validateRevisionNormalizationBinding, validateXhsVisualDeliveryEvent, validateXhsVisualSetSnapshot,
  VERTICAL_CONTRACTS, withHash
} from "../image-providers/xhs-integrated-page/vertical-contracts.mjs";

const clone = (value) => structuredClone(value);
const ref = (value, field) => ({ id: value.id, hash: value[field] });
const sameRef = (left, right) => Boolean(left && right && left.id === right.id && left.hash === right.hash);
function immutableRestoreContent(value) { const copy = clone(value); for (const field of ["id", "revision", "parentRevisionId", "operation", "sourceRevisionRef", "selectedBy", "selectedAt", "createdAt", "revisionHash"]) delete copy[field]; return copy; }

export function createDeliveryEvent({ type, aggregateRef, actor, at, payload, idempotencyKey, priorEvents = [] }) {
  const base = { schemaVersion: "1.0", contract: VERTICAL_CONTRACTS.event, id: `event:${stableHash({ type, aggregateRef, idempotencyKey }).slice(0, 24)}`, sequence: priorEvents.length + 1, idempotencyKey, type, aggregateRef: clone(aggregateRef), actor, at, payload: clone(payload), previousEventHash: priorEvents.at(-1)?.eventHash || null };
  const event = withHash(base, "eventHash"); validateXhsVisualDeliveryEvent(event); return event;
}

export function validateDeliveryEventChain(events) {
  const keys = new Set();
  events.forEach((event, index) => {
    validateXhsVisualDeliveryEvent(event);
    if (event.sequence !== index + 1 || event.previousEventHash !== (events[index - 1]?.eventHash || null)) throw new Error("DELIVERY_EVENT_CHAIN_INVALID");
    if (keys.has(event.idempotencyKey)) throw new Error("DELIVERY_EVENT_IDEMPOTENCY_DUPLICATE"); keys.add(event.idempotencyKey);
  });
  return { status: "passed", eventCount: events.length, chainHash: stableHash(events.map((item) => item.eventHash)) };
}

export async function appendDeliveryEvent(store, input, expectedVersion) {
  const priorEvents = await store.listEvents(); const event = createDeliveryEvent({ ...input, priorEvents }); return store.appendEvent(event, { expectedVersion });
}

function resolveSetRestoreContext(snapshot, snapshots, events, blockers) {
  if (snapshot.operation !== "set_restore") return null;
  const currentRef = ref(snapshot, "snapshotHash"); const event = events.find((item) => item.type === "set_restored" && sameRef(item.aggregateRef, currentRef) && sameRef(item.payload.snapshotRef, currentRef));
  if (!event) { blockers.push(makeBlocker("MANIFEST_SET_RESTORE_EVENT_MISSING", snapshot.id, "缺少与当前恢复快照 hash 完整绑定的 set_restored 事件")); return null; }
  const source = snapshots.find((item) => sameRef(ref(item, "snapshotHash"), event.payload.sourceSnapshotRef)); const previous = snapshots.find((item) => sameRef(ref(item, "snapshotHash"), event.payload.previousSnapshotRef));
  if (!source || source.contentTaskId !== snapshot.contentTaskId || source.contentVersion !== snapshot.contentVersion) blockers.push(makeBlocker("MANIFEST_SET_RESTORE_SOURCE_MISMATCH", snapshot.id, "set_restored 的 source snapshot id/hash 或任务版本不匹配"));
  if (!previous || snapshot.parentSnapshotId !== previous.id || previous.contentTaskId !== snapshot.contentTaskId || previous.contentVersion !== snapshot.contentVersion) blockers.push(makeBlocker("MANIFEST_SET_RESTORE_PREVIOUS_MISMATCH", snapshot.id, "set_restored 的 previous snapshot id/hash、父快照或任务版本不匹配"));
  return { event, source, previous };
}

function resolvePageSelection({ page, revision, revisionById, events, setContext, blockers }) {
  const currentRef = ref(revision, "revisionHash"); const rejected = events.some((event) => event.type === "candidate_rejected" && sameRef(event.payload.candidateRef, revision.sourceCandidateRef));
  if (revision.operation === "select" && !setContext) {
    const selected = events.find((event) => event.type === "candidate_selected" && sameRef(event.aggregateRef, currentRef) && sameRef(event.payload.revisionRef, currentRef) && sameRef(event.payload.candidateRef, revision.sourceCandidateRef));
    if (!selected) blockers.push(makeBlocker("MANIFEST_CANDIDATE_SELECTION_MISSING", page.pageId, "缺少与页面修订及候选 hash 完全一致的 candidate_selected 事件"));
  } else {
    if (setContext && revision.operation !== "set_restore") blockers.push(makeBlocker("MANIFEST_SET_RESTORE_PAGE_OPERATION_INVALID", page.pageId, "整套恢复快照中的每页必须是 set_restore 新修订"));
    const source = revision.sourceRevisionRef && revisionById.get(revision.sourceRevisionRef.id); const previous = revision.parentRevisionId && revisionById.get(revision.parentRevisionId);
    if (source && stableHash(immutableRestoreContent(revision)) !== stableHash(immutableRestoreContent(source))) blockers.push(makeBlocker("MANIFEST_PAGE_RESTORE_CONTENT_MISMATCH", page.pageId, "恢复修订的不可变业务内容与 source revision 不一致"));
    const restored = events.find((event) => event.type === "page_restored" && sameRef(event.aggregateRef, currentRef) && sameRef(event.payload.revisionRef, currentRef));
    if (!restored) blockers.push(makeBlocker("MANIFEST_PAGE_RESTORE_EVENT_MISSING", page.pageId, "恢复页面缺少与当前修订 hash 完整绑定的 page_restored 事件"));
    else {
      if (!source || source.pageId !== revision.pageId || source.contentTaskId !== revision.contentTaskId || source.contentVersion !== revision.contentVersion || !sameRef(ref(source, "revisionHash"), revision.sourceRevisionRef) || !sameRef(restored.payload.sourceRevisionRef, revision.sourceRevisionRef)) blockers.push(makeBlocker("MANIFEST_PAGE_RESTORE_SOURCE_MISMATCH", page.pageId, "page_restored 的 source revision id/hash 或任务页面不匹配"));
      if (!previous || previous.pageId !== revision.pageId || previous.contentTaskId !== revision.contentTaskId || previous.contentVersion !== revision.contentVersion || !sameRef(restored.payload.previousRevisionRef, ref(previous, "revisionHash"))) blockers.push(makeBlocker("MANIFEST_PAGE_RESTORE_PREVIOUS_MISMATCH", page.pageId, "page_restored 的 previous revision id/hash 或任务页面不匹配"));
      if (setContext && restored.sequence >= setContext.event.sequence) blockers.push(makeBlocker("MANIFEST_SET_RESTORE_CHAIN_ORDER_INVALID", page.pageId, "逐页恢复事件必须先于 set_restored 事件"));
    }
    if (setContext) {
      const sourcePage = setContext.source?.pages.find((item) => item.pageId === page.pageId); const previousPage = setContext.previous?.pages.find((item) => item.pageId === page.pageId);
      if (!sourcePage || !sameRef(sourcePage.revisionRef, revision.sourceRevisionRef)) blockers.push(makeBlocker("MANIFEST_SET_RESTORE_SOURCE_PAGE_MISMATCH", page.pageId, "源快照缺页或源修订 hash 不匹配"));
      if (sourcePage && stableHash({ pageId: page.pageId, source: page.source, gateSummary: page.gateSummary }) !== stableHash({ pageId: sourcePage.pageId, source: sourcePage.source, gateSummary: sourcePage.gateSummary })) blockers.push(makeBlocker("MANIFEST_SET_RESTORE_PAGE_CONTENT_MISMATCH", page.pageId, "整套恢复页的来源或 gateSummary 与 source snapshot 对应页不一致"));
      const previousRevision = previousPage && revisionById.get(previousPage.revisionRef.id); if (!previousPage || !previousRevision || !sameRef(previousPage.revisionRef, ref(previousRevision, "revisionHash")) || previousPage.revisionRef.id !== revision.parentRevisionId) blockers.push(makeBlocker("MANIFEST_SET_RESTORE_PREVIOUS_PAGE_MISMATCH", page.pageId, "前序快照缺页或父修订 hash 不匹配"));
    }
  }
  if (rejected) blockers.push(makeBlocker("MANIFEST_CANDIDATE_REJECTED", page.pageId, "页面来源候选在选择或恢复后存在 rejected 事件"));
}

export function createFlowSocialDeliveryManifest({ id, snapshot, revisions, normalizations, snapshots = [], events, createdAt }) {
  validateXhsVisualSetSnapshot(snapshot); validateDeliveryEventChain(events); const revisionById = new Map(revisions.map((item) => { validatePageAssetRevision(item); return [item.id, item]; })); const normalizationById = new Map(normalizations.map((item) => { validatePageNormalizationRecord(item); return [item.id, item]; })); snapshots.forEach(validateXhsVisualSetSnapshot); const blockers = []; const setContext = resolveSetRestoreContext(snapshot, snapshots, events, blockers);
  const pages = snapshot.pages.map((page) => {
    const revision = revisionById.get(page.revisionRef.id); if (!revision || revision.revisionHash !== page.revisionRef.hash) { blockers.push(makeBlocker("MANIFEST_REVISION_REF_MISMATCH", page.pageId, "快照页面修订不存在或 hash 不一致")); return null; }
    const normalization = normalizationById.get(revision.normalizationRef.id); try { validateRevisionNormalizationBinding(revision, normalization); } catch { blockers.push(makeBlocker("MANIFEST_NORMALIZATION_ASSET_MISMATCH", page.pageId, "修订资产未与规范化输出完整绑定")); }
    resolvePageSelection({ page, revision, revisionById, events, setContext, blockers });
    return { pageId: page.pageId, revisionRef: page.revisionRef, source: page.source, sourceSha256: normalization?.inputAsset.sha256 || revision.asset.sha256, normalizedSha256: page.source === "normalized_integrated" ? normalization?.outputAsset?.sha256 || null : null, gateSummary: clone(page.gateSummary) };
  }).filter(Boolean);
  if (!events.length) blockers.push(makeBlocker("MANIFEST_SELECTION_EVENTS_EMPTY", snapshot.id, "Manifest 不得在没有逐页选择事件时声明 selected 或 prepared"));
  const selectedAllPages = pages.length === snapshot.pages.length && !blockers.length;
  const base = {
    schemaVersion: "3.0", contract: VERTICAL_CONTRACTS.manifest, id, source: "offline_snapshot", legacyRef: null, contentTaskId: snapshot.contentTaskId, contentVersion: snapshot.contentVersion,
    snapshotRef: ref(snapshot, "snapshotHash"), pages, packageStatus: selectedAllPages && !blockers.length ? "prepared" : "blocked", downloadStatus: "not_downloaded", platformDeliveryStatus: "not_delivered", userSelectionStatus: selectedAllPages ? "selected" : "not_selected",
    eventsRef: events.map((item) => { validateXhsVisualDeliveryEvent(item); return ref(item, "eventHash"); }), createdAt, blockers
  };
  const manifest = withHash(base, "manifestHash"); validateFlowSocialDeliveryManifest(manifest); return manifest;
}

export async function prepareOfflinePackage({ store, snapshot, revisions, normalizations, actor, at, idempotencyKey, expectedVersion, flags }) {
  if (flags?.xhsIntegratedPageOfflineDelivery !== true) throw new Error("XHS_INTEGRATED_PAGE_OFFLINE_DELIVERY_FLAG_DISABLED");
  const priorEvents = await store.listEvents(); const snapshots = await store.listObjects("snapshots"); const manifest = createFlowSocialDeliveryManifest({ id: `manifest:${snapshot.id}`, snapshot, revisions, normalizations, snapshots, events: priorEvents, createdAt: at });
  if (manifest.blockers.length) throw Object.assign(new Error("OFFLINE_PACKAGE_BLOCKED"), { blockers: manifest.blockers });
  const put = await store.putObject("manifests", manifest, { expectedVersion, hashField: "manifestHash" });
  const eventResult = await appendDeliveryEvent(store, { type: "package_prepared", aggregateRef: ref(manifest, "manifestHash"), actor, at, payload: { manifestRef: ref(manifest, "manifestHash"), downloadStatus: "not_downloaded", platformDeliveryStatus: "not_delivered", userSelectionChanged: false }, idempotencyKey }, put.version);
  return { manifest, event: eventResult.result, version: eventResult.version };
}

export async function recordDownload({ store, manifest, actor, at, idempotencyKey, expectedVersion }) {
  validateFlowSocialDeliveryManifest(manifest); return appendDeliveryEvent(store, { type: "download_recorded", aggregateRef: ref(manifest, "manifestHash"), actor, at, payload: { packagePrepared: true, downloadStatus: "downloaded", platformDeliveryStatus: "not_delivered", userSelectionChanged: false }, idempotencyKey }, expectedVersion);
}
export async function recordDelivery({ store, manifest, actor, at, idempotencyKey, expectedVersion, platformStatus = "not_delivered" }) {
  validateFlowSocialDeliveryManifest(manifest); if (platformStatus === "delivered") throw new Error("OFFLINE_PLATFORM_DELIVERED_FORBIDDEN"); if (platformStatus !== "not_delivered") throw new Error("OFFLINE_PLATFORM_STATUS_INVALID"); return appendDeliveryEvent(store, { type: "delivery_marked", aggregateRef: ref(manifest, "manifestHash"), actor, at, payload: { platformDeliveryStatus: platformStatus, packageStatus: manifest.packageStatus, downloadStatusIndependent: true, userSelectionChanged: false }, idempotencyKey }, expectedVersion);
}

export function adaptManifest2ReadOnly(input) {
  const before = stableHash(input); const legacy = clone(input); const files = Array.isArray(legacy.files) ? legacy.files : []; const blockers = [];
  const rawPages = legacy.pages || legacy.storyboard?.pages || legacy.renderInputs || [];
  if (!rawPages.length) blockers.push(makeBlocker("LEGACY_MANIFEST_PAGES_MISSING", legacy.contentTaskId || "legacy", "Manifest 2.0 缺少逐页映射"));
  const pages = rawPages.map((page, index) => {
    const pageId = page.pageId || page.page_id || `P${index + 1}`; const file = files.find((item) => item.pageId === pageId || String(item.path || "").includes(pageId)); const sourceSha256 = /^[a-f0-9]{64}$/.test(file?.sha256 || "") ? file.sha256 : stableHash({ legacyManifest: legacy.id || legacy.contentTaskId, pageId, missingHash: true });
    if (!file?.sha256) blockers.push(makeBlocker("LEGACY_MANIFEST_PAGE_HASH_MISSING", pageId, "历史 Manifest 页面缺少源字节 hash"));
    return { pageId, revisionRef: null, source: "legacy_manifest", sourceSha256, normalizedSha256: null, gateSummary: { text: "legacy_quality_unknown", fact: "legacy_quality_unknown", visual: "legacy_quality_unknown", finalCanvas: "legacy_quality_unknown" } };
  });
  const legacyHash = stableHash(legacy); const base = { schemaVersion: "3.0", contract: VERTICAL_CONTRACTS.manifest, id: `manifest3:legacy:${legacyHash.slice(0, 20)}`, source: "legacy_manifest_adapter", legacyRef: { id: legacy.id || `manifest2:${legacy.contentTaskId || "unknown"}`, hash: legacyHash }, contentTaskId: legacy.contentTaskId || "legacy", contentVersion: Number(legacy.version || 1), snapshotRef: null, pages, packageStatus: "legacy_unknown", downloadStatus: "legacy_unknown", platformDeliveryStatus: "legacy_unknown", userSelectionStatus: "legacy_unknown", eventsRef: [], createdAt: legacy.createdAt || "1970-01-01T00:00:00.000Z", blockers };
  const manifest = withHash(base, "manifestHash"); validateFlowSocialDeliveryManifest(manifest); if (stableHash(input) !== before) throw new Error("MANIFEST2_ADAPTER_MUTATED_INPUT"); return manifest;
}
