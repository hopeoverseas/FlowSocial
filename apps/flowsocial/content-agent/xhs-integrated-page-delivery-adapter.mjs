import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { stableHash } from "../image-providers/xhs-integrated-page/canonical.mjs";
import { readPngDimensions } from "../image-providers/xhs-integrated-page/png-normalizer.mjs";
import {
  validateFlowSocialDeliveryManifest, validatePageAssetRevision, validatePageFactCheck,
  validatePageNormalizationRecord, validatePageTextCheck, validateRevisionNormalizationBinding,
  validateXhsIntegratedVisualReview, validateXhsVisualSetSnapshot, withHash
} from "../image-providers/xhs-integrated-page/vertical-contracts.mjs";
import { appendDeliveryEvent, createFlowSocialDeliveryManifest } from "./xhs-integrated-page-delivery-tracker.mjs";
import { validateRevisionDag } from "./xhs-integrated-page-version-service.mjs";
import { buildXiaohongshuPlatformDeliveryBundle } from "./platform-delivery-bundle.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const clone = (value) => structuredClone(value);
const ref = (value, field) => ({ id: value.id, hash: value[field] });
const sameRef = (left, right) => Boolean(left && right && left.id === right.id && left.hash === right.hash);
const safeSegment = (value) => {
  const result = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!result) throw new Error("DIRECT_DELIVERY_SAFE_NAME_REQUIRED"); return result;
};

function canonicalFuturePath(input) {
  const value = resolve(input); let existing = value;
  while (!existsSync(existing)) { const parent = dirname(existing); if (parent === existing) break; existing = parent; }
  return resolve(realpathSync(existing), relative(existing, value));
}

function assertIsolatedRoots(deliveryRoot, storeRoot) {
  const root = canonicalFuturePath(deliveryRoot); const store = canonicalFuturePath(storeRoot); const temp = realpathSync(resolve(tmpdir()));
  const normalize = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  const rootKey = normalize(root); const storeKey = normalize(store); const tempKey = normalize(temp);
  if (rootKey === tempKey || !rootKey.startsWith(`${tempKey}${sep}`)) throw new Error("DIRECT_DELIVERY_ROOT_MUST_BE_ISOLATED_TEMP");
  if (rootKey === storeKey || rootKey.startsWith(`${storeKey}${sep}`) || storeKey.startsWith(`${rootKey}${sep}`)) throw new Error("DIRECT_DELIVERY_STORE_ROOT_OVERLAP");
  return root;
}

function inspectFinalPng(bytes, pageId) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1) throw new Error(`DIRECT_DELIVERY_PNG_BYTES_REQUIRED:${pageId}`);
  const dimensions = readPngDimensions(bytes);
  if (dimensions.width !== 1080 || dimensions.height !== 1440) throw new Error(`DIRECT_DELIVERY_FINAL_CANVAS_INVALID:${pageId}`);
  return { bytes: bytes.length, sha256: sha256(bytes), dimensions };
}

function findBoundObject(items, reference, validator, code) {
  const value = items.find((item) => item.id === reference?.id);
  if (!value || !sameRef({ id: value.id, hash: value.checkHash || value.reviewHash }, reference)) throw new Error(code);
  validator(value); return value;
}

function rendererQualityEvidence(rendered, pageId) {
  const quality = rendered?.quality;
  if (!quality || quality.status !== "passed" || !Array.isArray(quality.checks) || !quality.checks.length || quality.checks.some((item) => item?.result !== "pass") || !Array.isArray(quality.blockers) || quality.blockers.length) throw new Error(`DIRECT_DELIVERY_DETERMINISTIC_QUALITY_BLOCKED:${pageId}`);
  return { status: quality.status, checks: clone(quality.checks), blockers: clone(quality.blockers), evidenceHash: stableHash({ status: quality.status, checks: quality.checks, blockers: quality.blockers }) };
}

function validateDirectDeliveryEvidence(value) {
  if (value?.schemaVersion !== "1.0" || value?.contract !== "XhsIntegratedPageDirectDeliveryEvidence@1.0" || !value.requestHash || !value.snapshotRef || !Array.isArray(value.pages)) throw new Error("DIRECT_DELIVERY_EVIDENCE_INVALID");
  const copy = clone(value); delete copy.evidenceHash; if (stableHash(copy) !== value.evidenceHash) throw new Error("DIRECT_DELIVERY_EVIDENCE_HASH_MISMATCH");
  for (const page of value.pages) {
    if (!page.pageId || !page.revisionRef || !["normalized_integrated", "deterministic_layout"].includes(page.source) || !page.relativePath || !Number.isInteger(page.bytes) || !/^[a-f0-9]{64}$/.test(page.sha256 || "") || !/^[a-f0-9]{64}$/.test(page.manifestSourceSha256 || "") || page.dimensions?.width !== 1080 || page.dimensions?.height !== 1440 || !/^[a-f0-9]{64}$/.test(page.qualityEvidenceHash || "")) throw new Error("DIRECT_DELIVERY_EVIDENCE_PAGE_INVALID");
    if (page.source === "normalized_integrated" && (page.byteIdentity !== true || page.rendererInvoked !== false)) throw new Error("DIRECT_DELIVERY_EVIDENCE_INTEGRATED_INVALID");
    if (page.source === "deterministic_layout" && page.rendererInvoked !== true) throw new Error("DIRECT_DELIVERY_EVIDENCE_DETERMINISTIC_INVALID");
  }
  return value;
}

async function collectDeliveryContext(store, snapshot) {
  const [revisions, normalizations, textChecks, factChecks, visualReviews, snapshots, events] = await Promise.all([
    store.listObjects("revisions"), store.listObjects("normalizations"), store.listObjects("textChecks"),
    store.listObjects("factChecks"), store.listObjects("visualReviews"), store.listObjects("snapshots"), store.listEvents()
  ]);
  validateRevisionDag(revisions); const storedSnapshot = snapshots.find((item) => item.id === snapshot.id);
  if (!storedSnapshot || storedSnapshot.snapshotHash !== snapshot.snapshotHash) throw new Error("DIRECT_DELIVERY_SNAPSHOT_NOT_PERSISTED");
  if (snapshot.parentSnapshotId) { const parent = snapshots.find((item) => item.id === snapshot.parentSnapshotId); if (!parent || parent.contentTaskId !== snapshot.contentTaskId || parent.contentVersion !== snapshot.contentVersion || parent.revision >= snapshot.revision) throw new Error("DIRECT_DELIVERY_SNAPSHOT_PARENT_MISMATCH"); }
  return { revisions, normalizations, textChecks, factChecks, visualReviews, snapshots, events };
}

async function readPreparedDirectory({ root, requestHash }) {
  if (!existsSync(root)) throw new Error("DIRECT_DELIVERY_COMMIT_DIRECTORY_MISSING");
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")); const evidence = JSON.parse(await readFile(resolve(root, "delivery-evidence.json"), "utf8"));
  validateFlowSocialDeliveryManifest(manifest); validateDirectDeliveryEvidence(evidence);
  if (evidence.requestHash !== requestHash || !manifest.id.includes(`:direct:${requestHash.slice(0, 24)}:${evidence.evidenceHash.slice(0, 24)}`) || !sameRef(evidence.snapshotRef, manifest.snapshotRef)) throw new Error("DIRECT_DELIVERY_IDEMPOTENCY_BINDING_MISMATCH");
  for (const page of evidence.pages) {
    const bytes = await readFile(resolve(root, page.relativePath)); const actual = inspectFinalPng(bytes, page.pageId); if (actual.sha256 !== page.sha256 || actual.bytes !== page.bytes) throw new Error(`DIRECT_DELIVERY_COMMITTED_FILE_MISMATCH:${page.pageId}`);
    const manifestPage = manifest.pages.find((item) => item.pageId === page.pageId);
    if (manifestPage?.sourceSha256 !== page.manifestSourceSha256) throw new Error(`DIRECT_DELIVERY_MANIFEST_SOURCE_MISMATCH:${page.pageId}`);
    if (page.source === "normalized_integrated" && manifestPage?.normalizedSha256 !== page.sha256) throw new Error(`DIRECT_DELIVERY_MANIFEST_OUTPUT_MISMATCH:${page.pageId}`);
    if (page.source === "deterministic_layout" && manifestPage?.normalizedSha256 !== null) throw new Error(`DIRECT_DELIVERY_MANIFEST_DETERMINISTIC_NORMALIZED_HASH_FORBIDDEN:${page.pageId}`);
  }
  return { directory: root, manifest, pages: clone(evidence.pages), evidence };
}

async function verifyCommittedDirectory({ root, event, requestHash, storeVersion }) {
  const prepared = await readPreparedDirectory({ root, requestHash });
  if (!sameRef(event.aggregateRef, ref(prepared.manifest, "manifestHash")) || !sameRef(event.payload.manifestRef, ref(prepared.manifest, "manifestHash"))) throw new Error("DIRECT_DELIVERY_IDEMPOTENCY_BINDING_MISMATCH");
  return { ...prepared, event, version: storeVersion, idempotent: true };
}

async function resolveIdempotentReplay({ store, root, idempotencyKey, requestHash }) {
  const events = await store.listEvents(); const event = events.find((item) => item.idempotencyKey === idempotencyKey);
  if (!event) return null;
  if (event.type !== "package_prepared" || !event.aggregateRef?.id?.includes(`:direct:${requestHash.slice(0, 24)}:`)) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
  return verifyCommittedDirectory({ root, event, requestHash, storeVersion: (await store.readState()).version });
}

export async function deliverIntegratedPageSnapshot({ store, snapshot, deliveryRoot, actor, at, idempotencyKey, expectedVersion, flags, renderDeterministicPage = null, operations = {} }) {
  if (flags?.xhsIntegratedPageDirectDelivery !== true) throw new Error("XHS_INTEGRATED_PAGE_DIRECT_DELIVERY_FLAG_DISABLED");
  validateXhsVisualSetSnapshot(snapshot); const root = assertIsolatedRoots(deliveryRoot, store.root);
  const requestHash = stableHash({ snapshotRef: ref(snapshot, "snapshotHash"), deliveryRoot: root, actor, idempotencyKey });
  const io = { writeFile: operations.writeFile || writeFile, rename: operations.rename || rename, remove: operations.remove || rm, appendEvent: operations.appendEvent || appendDeliveryEvent };
  const replay = await resolveIdempotentReplay({ store, root, idempotencyKey, requestHash }); if (replay) return replay;
  if (existsSync(root)) {
    let prepared; try { prepared = await readPreparedDirectory({ root, requestHash }); } catch { throw new Error("DIRECT_DELIVERY_IMMUTABLE_DIRECTORY_CONFLICT"); }
    try {
      const eventResult = await io.appendEvent(store, { type: "package_prepared", aggregateRef: ref(prepared.manifest, "manifestHash"), actor, at, payload: { manifestRef: ref(prepared.manifest, "manifestHash"), downloadStatus: "not_downloaded", platformDeliveryStatus: "not_delivered", userSelectionChanged: false }, idempotencyKey }, expectedVersion);
      return { ...prepared, event: eventResult.result, version: eventResult.version, idempotent: false, recoveredPendingCommit: true };
    } catch (error) {
      const reconciled = await resolveIdempotentReplay({ store, root, idempotencyKey, requestHash }); if (reconciled) return { ...reconciled, recoveredAfterCommit: true };
      throw error;
    }
  }
  const context = await collectDeliveryContext(store, snapshot);
  const preview = createFlowSocialDeliveryManifest({ id: `manifest:${snapshot.id}`, snapshot, revisions: context.revisions, normalizations: context.normalizations, snapshots: context.snapshots, events: context.events, createdAt: at });
  if (preview.blockers.length) throw Object.assign(new Error("DIRECT_DELIVERY_MANIFEST_BLOCKED"), { blockers: preview.blockers });

  const revisionById = new Map(context.revisions.map((item) => [item.id, item])); const normalizationById = new Map(context.normalizations.map((item) => [item.id, item]));
  const stageRoot = `${root}.stage-${randomUUID()}`; const pages = []; let finalCreated = false;
  try {
    await mkdir(resolve(stageRoot, "pages"), { recursive: true }); const realStage = realpathSync(stageRoot); const realTemp = realpathSync(resolve(tmpdir())); if (!realStage.startsWith(`${realTemp}${sep}`)) throw new Error("DIRECT_DELIVERY_STAGE_REALPATH_ESCAPE");
    for (const [index, page] of snapshot.pages.entries()) {
      const revision = revisionById.get(page.revisionRef.id); if (!revision || revision.revisionHash !== page.revisionRef.hash) throw new Error(`DIRECT_DELIVERY_REVISION_REF_MISMATCH:${page.pageId}`); validatePageAssetRevision(revision);
      if (revision.contentTaskId !== snapshot.contentTaskId || revision.contentVersion !== snapshot.contentVersion || revision.pageId !== page.pageId) throw new Error(`DIRECT_DELIVERY_REVISION_VERSION_MISMATCH:${page.pageId}`);
      const expectedSource = revision.generationMode === "integrated_page_generation" ? "normalized_integrated" : "deterministic_layout"; if (page.source !== expectedSource) throw new Error(`DIRECT_DELIVERY_PAGE_SOURCE_MISMATCH:${page.pageId}`);
      const normalization = normalizationById.get(revision.normalizationRef.id); validatePageNormalizationRecord(normalization); validateRevisionNormalizationBinding(revision, normalization);
      if (normalization.status !== "succeeded" || normalization.outputDimensions.width !== 1080 || normalization.outputDimensions.height !== 1440) throw new Error(`DIRECT_DELIVERY_NORMALIZATION_BLOCKED:${page.pageId}`);
      const textCheck = findBoundObject(context.textChecks, revision.gateRefs.text, validatePageTextCheck, `DIRECT_DELIVERY_TEXT_GATE_REF_MISMATCH:${page.pageId}`); const factCheck = findBoundObject(context.factChecks, revision.gateRefs.fact, validatePageFactCheck, `DIRECT_DELIVERY_FACT_GATE_REF_MISMATCH:${page.pageId}`); const visualReview = findBoundObject(context.visualReviews, revision.gateRefs.visual, validateXhsIntegratedVisualReview, `DIRECT_DELIVERY_VISUAL_GATE_REF_MISMATCH:${page.pageId}`);
      if (textCheck.status !== "passed" || factCheck.status !== "passed" || visualReview.overallStatus !== "passed" || Object.values(page.gateSummary).some((status) => status !== "passed")) throw new Error(`DIRECT_DELIVERY_PAGE_GATE_BLOCKED:${page.pageId}`);

      const revisionBytes = await readFile(store.resolveForRead(revision.asset.relativePath)); await store.verifyAsset(revision.asset.relativePath, revision.asset.sha256); const revisionAsset = inspectFinalPng(revisionBytes, page.pageId);
      let finalBytes = revisionBytes; let rendererInvoked = false; let qualityEvidenceHash = stableHash({ gateRefs: revision.gateRefs, gateSummary: page.gateSummary });
      if (revision.generationMode === "deterministic_layout") {
        if (typeof renderDeterministicPage !== "function") throw new Error(`DIRECT_DELIVERY_DETERMINISTIC_RENDERER_REQUIRED:${page.pageId}`);
        const rendered = await renderDeterministicPage({ page: clone(page), revision: clone(revision), sourceBytes: Buffer.from(revisionBytes) }); finalBytes = Buffer.isBuffer(rendered) ? rendered : rendered?.pngBytes; rendererInvoked = true; qualityEvidenceHash = rendererQualityEvidence(Buffer.isBuffer(rendered) ? null : rendered, page.pageId).evidenceHash;
      }
      const output = inspectFinalPng(finalBytes, page.pageId);
      if (page.source === "normalized_integrated" && (output.sha256 !== revisionAsset.sha256 || output.bytes !== revisionAsset.bytes)) throw new Error(`DIRECT_DELIVERY_INTEGRATED_BYTE_IDENTITY_MISMATCH:${page.pageId}`);
      const fileName = `${String(index + 1).padStart(2, "0")}_${safeSegment(page.pageId)}.png`; const relativePath = `pages/${fileName}`; const stagedPath = resolve(stageRoot, relativePath);
      await io.writeFile(stagedPath, finalBytes); const verified = inspectFinalPng(await readFile(stagedPath), page.pageId); if (verified.sha256 !== output.sha256 || verified.bytes !== output.bytes) throw new Error(`DIRECT_DELIVERY_WRITE_VERIFICATION_FAILED:${page.pageId}`);
      pages.push({ pageId: page.pageId, source: page.source, generationMode: revision.generationMode, revisionRef: clone(page.revisionRef), relativePath, bytes: verified.bytes, sha256: verified.sha256, dimensions: verified.dimensions, revisionAssetSha256: revision.asset.sha256, manifestSourceSha256: normalization.inputAsset.sha256, byteIdentity: verified.sha256 === revision.asset.sha256 && verified.bytes === revision.asset.bytes, rendererInvoked, qualityEvidenceHash });
    }
    const evidence = withHash({ schemaVersion: "1.0", contract: "XhsIntegratedPageDirectDeliveryEvidence@1.0", requestHash, snapshotRef: ref(snapshot, "snapshotHash"), pages: clone(pages), createdAt: at }, "evidenceHash"); validateDirectDeliveryEvidence(evidence);
    const manifestBase = clone(preview); manifestBase.id = `manifest:${snapshot.id}:direct:${requestHash.slice(0, 24)}:${evidence.evidenceHash.slice(0, 24)}`;
    for (const page of pages) { const manifestPage = manifestBase.pages.find((item) => item.pageId === page.pageId); if (manifestPage.sourceSha256 !== page.manifestSourceSha256) throw new Error(`DIRECT_DELIVERY_MANIFEST_SOURCE_MISMATCH:${page.pageId}`); if (page.source === "normalized_integrated") manifestPage.normalizedSha256 = page.sha256; else if (manifestPage.normalizedSha256 !== null) throw new Error(`DIRECT_DELIVERY_MANIFEST_DETERMINISTIC_NORMALIZED_HASH_FORBIDDEN:${page.pageId}`); }
    delete manifestBase.manifestHash; const manifest = withHash(manifestBase, "manifestHash"); validateFlowSocialDeliveryManifest(manifest);
    await io.writeFile(resolve(stageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"); await io.writeFile(resolve(stageRoot, "delivery-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    try { await io.rename(stageRoot, root); finalCreated = true; } catch (error) { if (existsSync(root) && !existsSync(stageRoot)) finalCreated = true; else throw error; }
    let eventResult;
    try {
      eventResult = await io.appendEvent(store, { type: "package_prepared", aggregateRef: ref(manifest, "manifestHash"), actor, at, payload: { manifestRef: ref(manifest, "manifestHash"), downloadStatus: "not_downloaded", platformDeliveryStatus: "not_delivered", userSelectionChanged: false }, idempotencyKey }, expectedVersion);
    } catch (error) {
      const reconciled = await resolveIdempotentReplay({ store, root, idempotencyKey, requestHash }); if (reconciled) return { ...reconciled, recoveredAfterCommit: true };
      throw error;
    }
    return { directory: root, manifest, event: eventResult.result, version: eventResult.version, pages, evidence, idempotent: false };
  } catch (error) {
    if (existsSync(stageRoot)) await io.remove(stageRoot, { recursive: true, force: true });
    if (finalCreated && existsSync(root)) await io.remove(root, { recursive: true, force: true });
    throw error;
  }
}

export { validateDirectDeliveryEvidence };

export function buildXhsUserFriendlyDelivery(input) {
  return buildXiaohongshuPlatformDeliveryBundle(input);
}
