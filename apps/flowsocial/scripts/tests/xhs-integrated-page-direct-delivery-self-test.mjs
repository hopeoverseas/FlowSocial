import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { featureFlags } from "../../feature-flags.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { validateXhsVisualSetSnapshot, withHash } from "../../image-providers/xhs-integrated-page/vertical-contracts.mjs";
import { deliverIntegratedPageSnapshot } from "../../content-agent/xhs-integrated-page-delivery-adapter.mjs";
import { appendDeliveryEvent } from "../../content-agent/xhs-integrated-page-delivery-tracker.mjs";
import { OfflineIntegratedPageStore } from "../../content-agent/xhs-integrated-page-offline-store.mjs";
import { createIntegratedVisualPageSpec, runOfflinePagePipeline } from "../../content-agent/xhs-integrated-page-offline-pipeline.mjs";
import { createSnapshotPageFromRevision, createVisualSetSnapshot, persistSelectedPage, persistSnapshot, restorePage } from "../../content-agent/xhs-integrated-page-version-service.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, "../fixtures/xhs-integrated-page-direct-delivery/scenario.json"), "utf8"));
const hash = (label) => stableHash({ label });
const ref = (value, field) => ({ id: value.id, hash: value[field] });
const flags = { xhsIntegratedPageOfflinePipeline: true, xhsIntegratedPageOcrGate: true, xhsIntegratedPageVersioning: true, xhsIntegratedPageOfflineDelivery: true, xhsIntegratedPageDirectDelivery: true };
const runRoot = await mkdtemp(join(tmpdir(), "flowsocial-xhs-05l-"));
const store = new OfflineIntegratedPageStore({ root: join(runRoot, "store"), flags });
const originalFetch = globalThis.fetch; let networkCalls = 0; globalThis.fetch = async () => { networkCalls += 1; throw new Error("NETWORK_FORBIDDEN"); };
async function exists(path) { try { await stat(path); return true; } catch { return false; } }

async function listFiles(root, current = root, output = []) {
  for (const item of await readdir(current, { withFileTypes: true })) {
    const path = join(current, item.name);
    if (item.isDirectory()) await listFiles(root, path, output); else output.push(path.slice(root.length + 1).replaceAll("\\", "/"));
  }
  return output;
}

function makeTruth(item) {
  const base = { schemaVersion: "1.0", contract: "PageContentTruth@1.0", id: `truth:${fixture.contentTaskId}:${item.pageId}`, contentTaskId: fixture.contentTaskId, contentVersion: fixture.contentVersion, pageId: item.pageId, pageRole: item.pageRole, headline: item.headline, supportingText: ["整页候选保持内容真值"], labels: [], cta: item.pageRole === "cta" ? "开始下一步" : null, factIds: [item.factId], protectedTerms: ["FlowSocial"], productNames: ["FlowSocial"], properNouns: [], numbers: [], forbiddenClaims: [] };
  return { ...base, truthHash: stableHash(base) };
}

function makePageRun(item, generationMode = "integrated_page_generation", suffix = "integrated") {
  const truth = makeTruth(item); const bytes = solidRgbaPng(1080, 1440, item.color);
  const spec = createIntegratedVisualPageSpec({ truth, id: `spec:${item.pageId}:${suffix}`, compositionGoal: item.pageRole, informationHierarchy: ["headline", "body"], brandDnaRef: { id: "brand:05l", hash: hash("brand:05l") }, generationMode });
  const result = runOfflinePagePipeline({ flags, id: `candidate:${item.pageId}:${suffix}`, spec, truth, compilerTrace: { id: "trace:05l", traceHash: hash("trace:05l") }, capabilityEvaluation: { evaluationId: "capability:05l", evaluationHash: hash("capability:05l") }, sourceBuffer: bytes, sourceRelativePath: `source/${item.pageId}-${suffix}.png`, normalization: { mode: "none", outputRelativePath: `normalized/${item.pageId}-${suffix}.png`, protectedRegions: [], backgroundStrategy: null, createdAt: fixture.createdAt }, textObservation: { headline: truth.headline, numbers: [], productNames: ["FlowSocial"], properNouns: ["FlowSocial"], cta: truth.cta, extraText: [], pseudoText: false, confidence: 0.99 }, observedFactIds: truth.factIds, extraClaims: [], visualAssertion: { hierarchyStatus: "passed", semanticStatus: "passed", brandingStatus: "passed", watermarkLogoStatus: "passed", crossPageStatus: "passed", observations: [] }, createdAt: fixture.createdAt });
  return { truth, bytes, ...result };
}

try {
  assert.equal(featureFlags().xhsIntegratedPageDirectDelivery, false, "direct-delivery flag must default off");
  let state = await store.initialize(); const selected = [];
  for (const item of fixture.pages) {
    const run = makePageRun(item);
    const persisted = await persistSelectedPage({ store, candidate: run.candidate, normalization: run.normalization, textCheck: run.textCheck, factCheck: run.factCheck, visualReview: run.visualReview, sourceBytes: run.sourceBytes, normalizedBytes: run.normalizedBytes, selectedBy: fixture.actor, selectedAt: fixture.createdAt, idempotencyKey: `select:${item.pageId}:integrated`, expectedVersion: state.version });
    state = await store.readState(); selected.push({ item, run, revision: persisted.revision });
  }
  const integratedPages = selected.map(({ run, revision }) => createSnapshotPageFromRevision({ revision, normalization: run.normalization, textCheck: run.textCheck, factCheck: run.factCheck, visualReview: run.visualReview }));
  const integratedSnapshot = createVisualSetSnapshot({ id: "snapshot:05l:integrated", contentTaskId: fixture.contentTaskId, contentVersion: fixture.contentVersion, revision: 1, pages: integratedPages, createdBy: fixture.actor, createdAt: fixture.createdAt });
  ({ version: state.version } = await persistSnapshot({ store, snapshot: integratedSnapshot, expectedVersion: state.version }));

  let rendererCalls = 0;
  const integratedDelivery = await deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: join(runRoot, "delivery-integrated"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:integrated", expectedVersion: state.version, flags, renderDeterministicPage: async () => { rendererCalls += 1; throw new Error("INTEGRATED_PAGE_MUST_NOT_CALL_RENDERER"); } });
  state = await store.readState();
  assert.equal(rendererCalls, 0); assert.equal(integratedDelivery.pages.length, 9);
  assert.equal(integratedDelivery.pages.every((page) => page.source === "normalized_integrated" && page.byteIdentity && !page.rendererInvoked && !page.htmlCreatedByAdapter), true);
  assert.equal((await listFiles(integratedDelivery.directory)).some((path) => path.endsWith(".html")), false, "all-integrated delivery must not create HTML");
  for (const page of integratedDelivery.pages) assert.deepEqual(await readFile(join(integratedDelivery.directory, page.relativePath)), selected.find((item) => item.item.pageId === page.pageId).run.normalizedBytes);
  assert.deepEqual({ package: integratedDelivery.manifest.packageStatus, download: integratedDelivery.manifest.downloadStatus, platform: integratedDelivery.manifest.platformDeliveryStatus, selection: integratedDelivery.manifest.userSelectionStatus }, { package: "prepared", download: "not_downloaded", platform: "not_delivered", selection: "selected" });
  const integratedVersion = state.version; const integratedReplay = await deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: integratedDelivery.directory, actor: fixture.actor, at: "2026-08-05T00:00:00.000Z", idempotencyKey: "package:05l:integrated", expectedVersion: 0, flags, operations: { writeFile: async () => { throw new Error("REPLAY_MUST_NOT_WRITE"); } }, renderDeterministicPage: async () => { throw new Error("REPLAY_MUST_NOT_RENDER"); } });
  assert.equal(integratedReplay.idempotent, true); assert.equal((await store.readState()).version, integratedVersion);
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: join(runRoot, "same-key-different-root"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:integrated", expectedVersion: state.version, flags }), /IDEMPOTENCY_KEY_CONFLICT/); assert.equal(await exists(join(runRoot, "same-key-different-root")), false);

  const deterministicItem = fixture.pages.find((item) => item.pageId === fixture.mixedDeterministicPageId);
  const deterministicRun = makePageRun({ ...deterministicItem, color: [210, 180, 120, 255] }, "deterministic_layout", "deterministic");
  const prior = selected.find((item) => item.item.pageId === deterministicItem.pageId);
  const deterministicPersisted = await persistSelectedPage({ store, candidate: deterministicRun.candidate, normalization: deterministicRun.normalization, textCheck: deterministicRun.textCheck, factCheck: deterministicRun.factCheck, visualReview: deterministicRun.visualReview, sourceBytes: deterministicRun.sourceBytes, normalizedBytes: deterministicRun.normalizedBytes, selectedBy: fixture.actor, selectedAt: fixture.createdAt, idempotencyKey: `select:${deterministicItem.pageId}:deterministic`, expectedVersion: state.version, parentRevision: prior.revision });
  state = await store.readState();
  const deterministicPage = createSnapshotPageFromRevision({ revision: deterministicPersisted.revision, normalization: deterministicRun.normalization, textCheck: deterministicRun.textCheck, factCheck: deterministicRun.factCheck, visualReview: deterministicRun.visualReview });
  const mixedSnapshot = createVisualSetSnapshot({ id: "snapshot:05l:mixed", contentTaskId: fixture.contentTaskId, contentVersion: fixture.contentVersion, revision: 2, parentSnapshot: integratedSnapshot, pages: integratedPages.map((page) => page.pageId === deterministicPage.pageId ? deterministicPage : page), createdBy: fixture.actor, createdAt: fixture.createdAt });
  ({ version: state.version } = await persistSnapshot({ store, snapshot: mixedSnapshot, expectedVersion: state.version })); rendererCalls = 0;
  const deterministicOutput = solidRgbaPng(1080, 1440, [35, 70, 120, 255]);
  const mixedDelivery = await deliverIntegratedPageSnapshot({ store, snapshot: mixedSnapshot, deliveryRoot: join(runRoot, "delivery-mixed"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:mixed", expectedVersion: state.version, flags, renderDeterministicPage: async () => { rendererCalls += 1; return { pngBytes: deterministicOutput, quality: { status: "passed", checks: [{ check: "renderer_final_canvas", result: "pass" }, { check: "renderer_quality_report", result: "pass" }], blockers: [] } }; } });
  state = await store.readState(); assert.equal(rendererCalls, 1);
  assert.equal(mixedDelivery.pages.filter((page) => page.source === "deterministic_layout").length, 1);
  assert.equal(mixedDelivery.pages.filter((page) => page.source === "normalized_integrated").length, 8);
  const deterministicDelivered = mixedDelivery.pages.find((page) => page.pageId === deterministicItem.pageId); assert.equal(deterministicDelivered.rendererInvoked, true); assert.equal(deterministicDelivered.byteIdentity, false); assert.notEqual(deterministicDelivered.sha256, deterministicPersisted.revision.asset.sha256);
  const deterministicManifestPage = mixedDelivery.manifest.pages.find((page) => page.pageId === deterministicItem.pageId); assert.equal(deterministicManifestPage.sourceSha256, deterministicRun.normalization.inputAsset.sha256); assert.equal(deterministicDelivered.manifestSourceSha256, deterministicManifestPage.sourceSha256); assert.notEqual(deterministicManifestPage.sourceSha256, deterministicDelivered.sha256); assert.equal(deterministicManifestPage.normalizedSha256, null); assert(mixedDelivery.manifest.id.includes(mixedDelivery.evidence.evidenceHash.slice(0, 24))); assert.equal(mixedDelivery.event.aggregateRef.hash, mixedDelivery.manifest.manifestHash);
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: mixedSnapshot, deliveryRoot: join(runRoot, "negative-renderer-missing"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:renderer-missing", expectedVersion: state.version, flags }), /DETERMINISTIC_RENDERER_REQUIRED/);

  const restored = await restorePage({ store, sourceRevision: prior.revision, currentRevision: deterministicPersisted.revision, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "restore:05l:P5", expectedVersion: state.version });
  state = await store.readState();
  const restoredPage = createSnapshotPageFromRevision({ revision: restored.revision, normalization: prior.run.normalization, textCheck: prior.run.textCheck, factCheck: prior.run.factCheck, visualReview: prior.run.visualReview });
  const restoredSnapshot = createVisualSetSnapshot({ id: "snapshot:05l:restored", contentTaskId: fixture.contentTaskId, contentVersion: fixture.contentVersion, revision: 3, parentSnapshot: mixedSnapshot, operation: "freeze", pages: mixedSnapshot.pages.map((page) => page.pageId === restoredPage.pageId ? restoredPage : page), createdBy: fixture.actor, createdAt: fixture.createdAt });
  ({ version: state.version } = await persistSnapshot({ store, snapshot: restoredSnapshot, expectedVersion: state.version }));
  const restoredDelivery = await deliverIntegratedPageSnapshot({ store, snapshot: restoredSnapshot, deliveryRoot: join(runRoot, "delivery-restored"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:restored", expectedVersion: state.version, flags, renderDeterministicPage: async () => { throw new Error("RESTORED_INTEGRATED_PAGE_MUST_NOT_CALL_RENDERER"); } });
  state = await store.readState(); assert.equal(restoredDelivery.pages.find((page) => page.pageId === restoredPage.pageId).sha256, prior.revision.asset.sha256); assert.equal(restored.revision.parentRevisionId, deterministicPersisted.revision.id); assert.equal(restored.revision.sourceRevisionRef.id, prior.revision.id);

  const mixedReplayVersion = state.version; const mixedReplay = await deliverIntegratedPageSnapshot({ store, snapshot: mixedSnapshot, deliveryRoot: mixedDelivery.directory, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:mixed", expectedVersion: 0, flags, renderDeterministicPage: async () => { throw new Error("IDEMPOTENT_REPLAY_MUST_NOT_RENDER"); } }); assert.equal(mixedReplay.idempotent, true); assert.equal((await store.readState()).version, mixedReplayVersion);
  const mixedManifestPath = join(mixedDelivery.directory, "manifest.json"); const committedManifestText = await readFile(mixedManifestPath, "utf8"); const sourceSemanticTamper = JSON.parse(committedManifestText); sourceSemanticTamper.pages.find((page) => page.pageId === deterministicItem.pageId).sourceSha256 = deterministicDelivered.sha256; delete sourceSemanticTamper.manifestHash; const rehashedSourceSemanticTamper = withHash(sourceSemanticTamper, "manifestHash"); await writeFile(mixedManifestPath, `${JSON.stringify(rehashedSourceSemanticTamper, null, 2)}\n`, "utf8");
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: mixedSnapshot, deliveryRoot: mixedDelivery.directory, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:mixed", expectedVersion: state.version, flags }), /MANIFEST_SOURCE_MISMATCH/); await writeFile(mixedManifestPath, committedManifestText, "utf8");
  const deterministicPath = join(mixedDelivery.directory, deterministicDelivered.relativePath); const committedDeterministicBytes = await readFile(deterministicPath); await writeFile(deterministicPath, solidRgbaPng(1080, 1440, [1, 1, 1, 255]));
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: mixedSnapshot, deliveryRoot: mixedDelivery.directory, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "package:05l:mixed", expectedVersion: state.version, flags }), /COMMITTED_FILE_MISMATCH/); await writeFile(deterministicPath, committedDeterministicBytes);

  const assertNoPreparedState = async (key, root, priorVersion) => { assert.equal(await exists(root), false); assert.equal((await store.listEvents()).some((event) => event.idempotencyKey === key), false); assert.equal((await store.readState()).version, priorVersion); };
  let faultVersion = (await store.readState()).version; const writeFaultRoot = join(runRoot, "fault-write");
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: writeFaultRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:write", expectedVersion: faultVersion, flags, operations: { writeFile: async () => { throw new Error("INJECTED_WRITE_FAILURE"); } } }), /INJECTED_WRITE_FAILURE/); await assertNoPreparedState("fault:write", writeFaultRoot, faultVersion);
  const renameFaultRoot = join(runRoot, "fault-rename-before"); await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: renameFaultRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:rename-before", expectedVersion: faultVersion, flags, operations: { rename: async () => { throw new Error("INJECTED_RENAME_FAILURE"); } } }), /INJECTED_RENAME_FAILURE/); await assertNoPreparedState("fault:rename-before", renameFaultRoot, faultVersion);
  const eventFaultRoot = join(runRoot, "fault-event-before"); await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: eventFaultRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:event-before", expectedVersion: faultVersion, flags, operations: { appendEvent: async () => { throw new Error("INJECTED_EVENT_FAILURE"); } } }), /INJECTED_EVENT_FAILURE/); await assertNoPreparedState("fault:event-before", eventFaultRoot, faultVersion);
  const recoverableRoot = join(runRoot, "fault-recoverable-pending"); await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: recoverableRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:recoverable-pending", expectedVersion: faultVersion, flags, operations: { appendEvent: async () => { throw new Error("INJECTED_PROCESS_INTERRUPTION"); }, remove: async () => { throw new Error("INJECTED_CLEANUP_INTERRUPTION"); } } }), /INJECTED_CLEANUP_INTERRUPTION/); assert.equal(await exists(recoverableRoot), true); assert.equal((await store.listEvents()).some((event) => event.idempotencyKey === "fault:recoverable-pending"), false);
  const recoveredPending = await deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: recoverableRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:recoverable-pending", expectedVersion: faultVersion, flags }); assert.equal(recoveredPending.recoveredPendingCommit, true); assert.equal((await store.listEvents()).some((event) => event.idempotencyKey === "fault:recoverable-pending"), true); state = await store.readState(); faultVersion = state.version;
  const renameAfterRoot = join(runRoot, "fault-rename-after"); const renameAfter = await deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: renameAfterRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:rename-after", expectedVersion: faultVersion, flags, operations: { rename: async (source, target) => { await rename(source, target); throw new Error("INJECTED_RENAME_AFTER_SUCCESS"); } } }); assert.equal(await exists(renameAfterRoot), true); assert.equal(renameAfter.event.idempotencyKey, "fault:rename-after"); state = await store.readState();
  const eventAfterRoot = join(runRoot, "fault-event-after"); const eventAfter = await deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: eventAfterRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:event-after", expectedVersion: state.version, flags, operations: { appendEvent: async (...args) => { await appendDeliveryEvent(...args); throw new Error("INJECTED_EVENT_AFTER_SUCCESS"); } } }); assert.equal(eventAfter.recoveredAfterCommit, true); assert.equal(await exists(eventAfterRoot), true); state = await store.readState();

  const qualityFaultRoot = join(runRoot, "fault-quality"); await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: mixedSnapshot, deliveryRoot: qualityFaultRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "fault:quality", expectedVersion: state.version, flags, renderDeterministicPage: async () => ({ pngBytes: deterministicOutput, quality: { status: "failed", checks: [{ check: "quality", result: "fail" }], blockers: ["failed"] } }) }), /DETERMINISTIC_QUALITY_BLOCKED/); assert.equal(await exists(qualityFaultRoot), false); assert.equal((await store.listEvents()).some((event) => event.idempotencyKey === "fault:quality"), false);

  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: join(store.root, "nested-delivery"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:inside-store", expectedVersion: state.version, flags }), /STORE_ROOT_OVERLAP/);
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: runRoot, actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:contains-store", expectedVersion: state.version, flags }), /STORE_ROOT_OVERLAP/);
  const junctionRoot = join(runRoot, "store-junction"); await symlink(store.root, junctionRoot, "junction");
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: join(junctionRoot, "nested-delivery"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:junction", expectedVersion: state.version, flags }), /STORE_ROOT_OVERLAP/);
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: resolve(process.cwd(), "not-an-isolated-direct-delivery"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:escape", expectedVersion: state.version, flags }), /ROOT_MUST_BE_ISOLATED_TEMP/);

  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: join(runRoot, "negative-flag"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:flag", expectedVersion: state.version, flags: { ...flags, xhsIntegratedPageDirectDelivery: false } }), /FLAG_DISABLED/);
  const wrongSourceBase = structuredClone(integratedSnapshot); wrongSourceBase.pages[0].source = "deterministic_layout"; delete wrongSourceBase.snapshotHash; const wrongSource = withHash(wrongSourceBase, "snapshotHash"); validateXhsVisualSetSnapshot(wrongSource);
  const wrongSourceStore = Object.create(store); wrongSourceStore.listObjects = async (type) => type === "snapshots" ? [...(await store.listObjects(type)).filter((item) => item.id !== wrongSource.id), wrongSource] : store.listObjects(type);
  await assert.rejects(deliverIntegratedPageSnapshot({ store: wrongSourceStore, snapshot: wrongSource, deliveryRoot: join(runRoot, "negative-source"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:source", expectedVersion: state.version, flags }), /PAGE_SOURCE_MISMATCH/);
  const blockedGateBase = structuredClone(integratedSnapshot); blockedGateBase.pages[0].gateSummary.text = "failed"; delete blockedGateBase.snapshotHash; const blockedGate = withHash(blockedGateBase, "snapshotHash"); assert.throws(() => validateXhsVisualSetSnapshot(blockedGate), /GATE_BLOCKED/);
  const noEventsStore = Object.create(store); noEventsStore.listEvents = async () => [];
  await assert.rejects(deliverIntegratedPageSnapshot({ store: noEventsStore, snapshot: integratedSnapshot, deliveryRoot: join(runRoot, "negative-selection"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:selection", expectedVersion: state.version, flags }), (error) => error.message === "DIRECT_DELIVERY_MANIFEST_BLOCKED" && error.blockers.some((item) => item.code === "MANIFEST_CANDIDATE_SELECTION_MISSING"));
  const missingParentBase = structuredClone(mixedSnapshot); missingParentBase.parentSnapshotId = "snapshot:missing"; delete missingParentBase.snapshotHash; const missingParent = withHash(missingParentBase, "snapshotHash"); validateXhsVisualSetSnapshot(missingParent);
  const missingParentStore = Object.create(store); missingParentStore.listObjects = async (type) => type === "snapshots" ? [...(await store.listObjects(type)).filter((item) => item.id !== missingParent.id), missingParent] : store.listObjects(type);
  await assert.rejects(deliverIntegratedPageSnapshot({ store: missingParentStore, snapshot: missingParent, deliveryRoot: join(runRoot, "negative-parent"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:parent", expectedVersion: state.version, flags }), /SNAPSHOT_PARENT_MISMATCH/);
  const wrongVersionBase = structuredClone(integratedSnapshot); wrongVersionBase.contentVersion += 1; delete wrongVersionBase.snapshotHash; const wrongVersion = withHash(wrongVersionBase, "snapshotHash"); validateXhsVisualSetSnapshot(wrongVersion);
  const wrongVersionStore = Object.create(store); wrongVersionStore.listObjects = async (type) => type === "snapshots" ? [...(await store.listObjects(type)).filter((item) => item.id !== wrongVersion.id), wrongVersion] : store.listObjects(type);
  await assert.rejects(deliverIntegratedPageSnapshot({ store: wrongVersionStore, snapshot: wrongVersion, deliveryRoot: join(runRoot, "negative-version"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:version", expectedVersion: state.version, flags }), /REVISION_VERSION_MISMATCH/);
  const firstAssetPath = store.resolveForRead(prior.revision.asset.relativePath); const originalBytes = await readFile(firstAssetPath); const tamperedBytes = Buffer.from(originalBytes); tamperedBytes[tamperedBytes.length - 1] ^= 0xff; await writeFile(firstAssetPath, tamperedBytes);
  await assert.rejects(deliverIntegratedPageSnapshot({ store, snapshot: integratedSnapshot, deliveryRoot: join(runRoot, "negative-hash"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:hash", expectedVersion: state.version, flags }), /ASSET_HASH_MISMATCH/); await writeFile(firstAssetPath, originalBytes);
  const missingRevisionStore = Object.create(store); missingRevisionStore.listObjects = async (type) => type === "revisions" ? (await store.listObjects(type)).filter((revision) => revision.id !== prior.revision.id) : store.listObjects(type);
  await assert.rejects(deliverIntegratedPageSnapshot({ store: missingRevisionStore, snapshot: mixedSnapshot, deliveryRoot: join(runRoot, "negative-revision-parent"), actor: fixture.actor, at: fixture.createdAt, idempotencyKey: "negative:revision-parent", expectedVersion: state.version, flags }), /REVISION_DAG_PARENT_MISSING/);

  const integrity = await store.auditIntegrity(); assert.equal(integrity.status, "passed"); assert.deepEqual(integrity.counters, { networkCalls: 0, providerCalls: 0, costCredits: 0, activeDatabaseWrites: 0, approvedPromotions: 0 });
  assert.equal(networkCalls, 0);
  console.log("xhs-integrated-page-direct-delivery-self-test: PASS (9-page direct bytes, mixed source, restore, negative gates, 0 calls)");
} finally {
  globalThis.fetch = originalFetch;
  await rm(runRoot, { recursive: true, force: true });
}
