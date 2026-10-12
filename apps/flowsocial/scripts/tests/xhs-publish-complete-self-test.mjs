import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { assertAudienceSafeProviderPrompt, isFrozen05MInvocation } from "../../image-providers/xhs-integrated-page/execution-plan.mjs";
import { build05ORuntimeInput, loadXhsPackage, loadXhsSourceRegistrySnapshot, validateObservedPageText, validateXhsPublishCompletePackage, validateXhsSourceRegistrySnapshot } from "../../content-agent/xhs-integrated-page-publish-complete.mjs";
import { encodeRgbaPng, readPngDimensions } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { P6_V9_CLEANUP, P7_V8_OVERLAY, build05ODeliveryManifest, build05OPreflight, create05OP6V9Cleanup, create05OP7V8Overlay, create05OReviewPackage, outputDir, prepare05OOffline, repoRoot, run05OPageLive, sourceRegistryPath, verify05OZipBuffer, zipEntries } from "../live/xhs-publish-complete-live.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
function treeHash(root) {
  if (!existsSync(root)) return stableHash([]);
  const walk = (current) => readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(current, entry.name)) : [{ path: relative(root, join(current, entry.name)).replace(/\\/g, "/"), sha256: sha256(readFileSync(join(current, entry.name))) }]);
  return stableHash(walk(root).sort((a, b) => a.path.localeCompare(b.path)));
}
function fileEntries(root) {
  const walk = (current) => readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(current, entry.name)) : [{ path: relative(root, join(current, entry.name)).replace(/\\/g, "/"), bytes: statSync(join(current, entry.name)).size, sha256: sha256(readFileSync(join(current, entry.name))) }]);
  return walk(root);
}

const officialEvidenceBefore = treeHash(outputDir);
const testRoot = mkdtempSync(join(tmpdir(), "flowsocial-05o-self-test-"));
const fixture = resolve("apps/flowsocial/scripts/fixtures/xhs-publish-complete/xhs-post-package-v4.json");
const loaded = loadXhsPackage(fixture);
const source = loadXhsSourceRegistrySnapshot(sourceRegistryPath, { gitCwd: repoRoot });
assert.equal(source.validation.status, "passed");
const quality = validateXhsPublishCompletePackage(loaded.packageValue, { sourceRegistry: source.snapshot });
assert.equal(quality.status, "passed");
assert.deepEqual({ titles: quality.checks.titleCandidates, tags: quality.checks.hashtags, pages: quality.checks.pages, questions: quality.checks.uniqueReaderQuestions, takeaways: quality.checks.uniqueTakeaways }, { titles: 5, tags: 6, pages: 7, questions: 7, takeaways: 7 });
assert.ok(quality.checks.bodyDeckSimilarity < 0.68);
assert.deepEqual(quality.checks.internalVisibleTokens, []);
assert.equal(build05ORuntimeInput(loaded.packageValue, { sourceRegistry: source.snapshot }).contentVersion, 4);

const validate = (value, registry = source.snapshot) => validateXhsPublishCompletePackage(value, { sourceRegistry: registry });
const missingCopy = structuredClone(loaded.packageValue); missingCopy.data.post_copy.hashtags = [];
assert.ok(validate(missingCopy).blockers.includes("HASHTAGS_INVALID"));
const repeated = structuredClone(loaded.packageValue); repeated.data.deck.pages[2].reader_question = repeated.data.deck.pages[1].reader_question;
assert.ok(validate(repeated).blockers.includes("PAGE_QUESTION_OR_TAKEAWAY_REPEATED"));
const leaked = structuredClone(loaded.packageValue); leaked.data.deck.pages[0].text_layers[0].text += " evidence";
assert.ok(validate(leaked).blockers.some((item) => item.startsWith("INTERNAL_ROLE_TOKEN_LEAK")));
const missingClaim = structuredClone(loaded.packageValue); missingClaim.data.deck.pages[0].fact_ids.push("F404");
assert.ok(validate(missingClaim).blockers.includes("CLAIM_REFERENCE_MISSING:F404"));
const duplicateCta = structuredClone(loaded.packageValue); duplicateCta.data.deck.pages[5].text_layers.push({ type: "cta", text: duplicateCta.data.post_copy.cta });
assert.ok(validate(duplicateCta).blockers.includes("SINGLE_CTA_BINDING_INVALID"));

const bogusRef = structuredClone(loaded.packageValue); bogusRef.data.traceability.claims[0].source_refs = ["source:bogus"];
assert.ok(validate(bogusRef).blockers.some((item) => item.startsWith("CLAIM_SOURCE_MISSING")));
const missingSource = structuredClone(source.snapshot); missingSource.sources.shift();
assert.ok(validate(loaded.packageValue, missingSource).blockers.some((item) => item.startsWith("CLAIM_SOURCE_MISSING")));
const wrongClaimHash = structuredClone(source.snapshot); wrongClaimHash.sources[0].claimBindings.F001 = "0".repeat(64);
assert.ok(validate(loaded.packageValue, wrongClaimHash).blockers.some((item) => item.startsWith("CLAIM_SOURCE_HASH_MISMATCH")));
const privateSource = structuredClone(source.snapshot); privateSource.authority.privacy = "private";
assert.ok(validate(loaded.packageValue, privateSource).blockers.includes("SOURCE_PRIVATE"));
const unpublishable = structuredClone(source.snapshot); unpublishable.authority.visibility = "internal_only";
assert.ok(validate(loaded.packageValue, unpublishable).blockers.includes("SOURCE_UNPUBLISHABLE"));
assert.ok(validateXhsSourceRegistrySnapshot(source.snapshot, { originBytes: Buffer.from("tampered") }).blockers.includes("SOURCE_ORIGIN_CONTENT_HASH_MISMATCH"));

const preflight = build05OPreflight();
assert.equal(preflight.plan.execution.status, "ready_for_isolated_provider_execution");
assert.equal(preflight.requests.length, 7);
for (const request of preflight.requests) {
  assert.deepEqual({ model: request.body.model, ratio: request.body.input.aspect_ratio, resolution: request.body.input.resolution }, { model: "gpt-image-2-text-to-image", ratio: "3:4", resolution: "1K" });
  const prompt = request.body.input.prompt;
  assertAudienceSafeProviderPrompt(prompt);
  assert.doesNotMatch(prompt, /\b(?:evidence|problem|method|summary|cta|cover|composition|hierarchy|imageRole|style|archetype|pattern)\b|\bP\d+\b|single-metaphor|dominant-concept|frame-concept/i);
  assert.deepEqual([...new Set([...prompt.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)].map((item) => item[0]).filter((token) => !["AI", "IP"].includes(token)))], []);
}
assert.throws(() => assertAudienceSafeProviderPrompt("single-metaphor-with-balanced-information-zones"), /ASCII_TOKEN_NOT_ALLOWLISTED/);
const historical = { promptSet: { id: "prompt-set:05m-v3-p1-p5-p9-7f195f65012e889d:v1" }, promptSetHash: "1d037fd054143eb5da2de8d1469bb90fd70bd4ec90f527f4dbd1d745706a072f", invocationHash: "1c39503df93bf8c70631f1470812f07d88e446185596186c316e69add44ae1ed" };
assert.equal(isFrozen05MInvocation(historical), true);
assert.equal(isFrozen05MInvocation({ ...historical, promptSet: { id: `${historical.promptSet.id}-forged` } }), false);
assert.equal(isFrozen05MInvocation({ ...historical, promptSetHash: "0".repeat(64) }), false);
assert.equal(isFrozen05MInvocation({ ...historical, invocationHash: "0".repeat(64) }), false);

const p1 = loaded.packageValue.data.deck.pages[0]; const expected = p1.text_layers.map((item) => item.text);
assert.equal(validateObservedPageText({ pageId: "P1", expectedTexts: expected, observedTexts: expected }).status, "passed");
assert.equal(validateObservedPageText({ pageId: "P1", expectedTexts: ["第一行\r\n第二行"], observedTexts: ["第一行\n第二行"] }).status, "passed");
assert.ok(validateObservedPageText({ pageId: "P1", expectedTexts: expected, observedTexts: [...expected, "evidence"] }).blockers.some((item) => item.startsWith("INTERNAL_ROLE_TOKEN_LEAK")));
assert.ok(validateObservedPageText({ pageId: "P1", expectedTexts: expected, observedTexts: [expected[0]], pseudoText: true }).blockers.includes("OCR_PSEUDO_TEXT"));
assert.ok(validateObservedPageText({ pageId: "P6", expectedTexts: ["先跑通一个小流程"], observedTexts: ["1 先跑通一个小流程"] }).blockers.includes("OCR_EXTRA_NUMBER:1"));

const offlineRoot = join(testRoot, "offline");
const offline = prepare05OOffline({ targetDir: offlineRoot });
assert.deepEqual({ content: offline.contentQuality.status, calls: offline.boundaries.providerCalls, writes: offline.boundaries.productionWrites, retries: offline.approvedBudget.automaticRetries }, { content: "passed", calls: 0, writes: 0, retries: 0 });
assert.equal(JSON.parse(readFileSync(join(offlineRoot, "offline-preflight.json"), "utf8")).planHash, preflight.plan.planHash);

const overlayRoot = join(testRoot, "overlay"); mkdirSync(overlayRoot);
const overlayBasePath = join(overlayRoot, "base.png"); const overlayOutputPath = join(overlayRoot, "derived.png"); const overlayEvidencePath = join(overlayRoot, "evidence.json");
const basePixels = Buffer.alloc(1080 * 1440 * 4, 245); for (let index = 3; index < basePixels.length; index += 4) basePixels[index] = 255;
const baseBytes = encodeRgbaPng(1080, 1440, basePixels); writeFileSync(overlayBasePath, baseBytes); const baseSha = sha256(baseBytes);
const testOverlaySpec = { ...P7_V8_OVERLAY, baseProviderAssetSha: baseSha };
const overlay = create05OP7V8Overlay({ basePath: overlayBasePath, outputPath: overlayOutputPath, evidencePath: overlayEvidencePath, spec: testOverlaySpec });
assert.deepEqual({ status: overlay.status, calls: overlay.providerCalls, pure: overlay.pureProvider, outside: overlay.outsideSafeAreaPixelHashBefore === overlay.outsideSafeAreaPixelHashAfter, dimensions: readPngDimensions(readFileSync(overlayOutputPath)) }, { status: "passed", calls: 0, pure: false, outside: true, dimensions: { width: 1080, height: 1440 } });
assert.ok(overlay.changedPixelsInsideSafeArea > 500); assert.equal(sha256(readFileSync(overlayBasePath)), baseSha);
assert.throws(() => create05OP7V8Overlay({ basePath: overlayBasePath, outputPath: overlayOutputPath, evidencePath: overlayEvidencePath, spec: { ...testOverlaySpec, baseProviderAssetSha: "0".repeat(64) } }), /BASE_PROVIDER_ASSET_SHA_MISMATCH/);
assert.throws(() => create05OP7V8Overlay({ basePath: overlayBasePath, outputPath: overlayOutputPath, evidencePath: overlayEvidencePath, spec: { ...testOverlaySpec, safeArea: { x: 90, y: 100, width: 900, height: 200 } } }), /SAFE_AREA_INVALID/);
assert.throws(() => create05OP7V8Overlay({ basePath: overlayBasePath, outputPath: overlayOutputPath, evidencePath: overlayEvidencePath, spec: { ...testOverlaySpec, renderStrategy: "silent_fallback" } }), /OVERLAY_CONTRACT_INVALID/);

const cleanupRoot = join(testRoot, "cleanup"); mkdirSync(cleanupRoot);
const cleanup = create05OP6V9Cleanup({ outputPath: join(cleanupRoot, "p6.png"), evidencePath: join(cleanupRoot, "evidence.json") });
assert.equal(cleanup.status, "passed"); assert.equal(cleanup.renderStrategy, "provider_raster_with_artifact_cleanup"); assert.equal(cleanup.providerCalls, 0); assert.equal(cleanup.pureProvider, false);
assert.equal(cleanup.outsideMaskPixelHashBefore, cleanup.outsideMaskPixelHashAfter); assert.equal(cleanup.pseudoArtifactGate.after.darkPixels, 0); assert.equal(cleanup.pseudoArtifactGate.after.longestDarkHorizontalRun, 0);
assert.equal(sha256(readFileSync(resolve(repoRoot, cleanup.baseProviderPath))), P6_V9_CLEANUP.baseProviderAssetSha);
assert.throws(() => create05OP6V9Cleanup({ outputPath: join(cleanupRoot, "bad.png"), evidencePath: join(cleanupRoot, "bad.json"), spec: { ...P6_V9_CLEANUP, maskRegions: [{ id: "bad", x: 0, y: 0, width: 5, height: 5 }] } }), /MASK_COUNT_INVALID/);

const artifacts = join(testRoot, "artifacts"); const evidenceRoot = join(testRoot, "evidence"); const delivery = join(testRoot, "manifest-input");
mkdirSync(artifacts); mkdirSync(evidenceRoot); mkdirSync(join(delivery, "pages"), { recursive: true });
const records = [];
for (let index = 0; index < 7; index += 1) {
  const pageId = `P${index + 1}`; const pixels = Buffer.alloc(1080 * 1440 * 4, 230 + index); for (let p = 3; p < pixels.length; p += 4) pixels[p] = 255;
  const png = encodeRgbaPng(1080, 1440, pixels); const name = `${pageId.toLowerCase()}.png`; writeFileSync(join(artifacts, name), png); writeFileSync(join(delivery, "pages", name), png);
  records.push({ pageId, providerStatus: "succeeded", normalizationStatus: "passed", finalCanvasStatus: "passed", ocr: "passed", fact: "passed", visual: "passed", manualAesthetic: "passed", reviewStatus: "passed", userSelection: "not_selected", artifact: { normalizedPath: name, normalizedSha256: sha256(png), normalizedDimensions: { width: 1080, height: 1440 } } });
}
const p6Evidence = { status: "passed", pseudoArtifactGate: { status: "passed" }, outsideMaskPixelHashBefore: "same", outsideMaskPixelHashAfter: "same" }; writeFileSync(join(evidenceRoot, "p6-v9-cleanup-evidence.json"), jsonBytes(p6Evidence));
Object.assign(records[5], { providerStatus: "reused_existing_provider_asset", renderStrategy: "provider_raster_with_artifact_cleanup", pureProvider: false, cleanupEvidenceHash: stableHash(p6Evidence), cleanupEvidenceFileSha256: sha256(readFileSync(join(evidenceRoot, "p6-v9-cleanup-evidence.json"))) });
const p7Evidence = { status: "passed", outsideSafeAreaPixelHashBefore: "same", outsideSafeAreaPixelHashAfter: "same" }; writeFileSync(join(evidenceRoot, "p7-v8-overlay-evidence.json"), jsonBytes(p7Evidence));
Object.assign(records[6], { providerStatus: "reused_existing_provider_asset", renderStrategy: "provider_raster_with_exact_text_overlay", pureProvider: false, overlayEvidenceHash: stableHash(p7Evidence), overlayEvidenceFileSha256: sha256(readFileSync(join(evidenceRoot, "p7-v8-overlay-evidence.json"))) });
writeFileSync(join(delivery, "xhs-post-package.json"), jsonBytes(loaded.packageValue)); writeFileSync(join(delivery, "quality-evidence.json"), jsonBytes({ contentVersion: 9 }));
const entries = fileEntries(delivery);
const manifest = build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: quality.packageHash, records, fileEntries: entries, evidenceRoot, artifactRoot: artifacts });
assert.equal(manifest.pageCount, 7); assert.equal(manifest.contentVersion, 9); assert.equal(manifest.states[5].renderStrategy, "provider_raster_with_artifact_cleanup"); assert.equal(manifest.states[6].renderStrategy, "provider_raster_with_exact_text_overlay");
assert.throws(() => build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: "0".repeat(64), records, fileEntries: entries, evidenceRoot, artifactRoot: artifacts }), /PACKAGE_HASH_MISMATCH/);
assert.throws(() => build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: quality.packageHash, records: records.slice(1), fileEntries: entries, evidenceRoot, artifactRoot: artifacts }), /PAGE_REVIEWS_REQUIRED/);
assert.throws(() => build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: quality.packageHash, records, fileEntries: entries.slice(1), evidenceRoot, artifactRoot: artifacts }), /FILE_SET_INVALID/);
assert.throws(() => build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: quality.packageHash, records, fileEntries: [...entries, { path: "stale.txt", bytes: 1, sha256: "0".repeat(64) }], evidenceRoot, artifactRoot: artifacts }), /FILE_SET_INVALID/);
const wrongEntrySha = structuredClone(entries); wrongEntrySha.find((item) => item.path === "pages/p3.png").sha256 = "0".repeat(64);
assert.throws(() => build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: quality.packageHash, records, fileEntries: wrongEntrySha, evidenceRoot, artifactRoot: artifacts }), /FILE_ARTIFACT_MISMATCH/);
const wrongDimensions = structuredClone(records); wrongDimensions[0].artifact.normalizedDimensions.width = 1079;
assert.throws(() => build05ODeliveryManifest({ packageValue: loaded.packageValue, packageHash: quality.packageHash, records: wrongDimensions, fileEntries: entries, evidenceRoot, artifactRoot: artifacts }), /PAGE_DIMENSIONS_INVALID/);

writeFileSync(join(delivery, "manifest.json"), jsonBytes(manifest)); const zipFiles = fileEntries(delivery); const zip = zipEntries(zipFiles.map((item) => ({ name: item.path, data: readFileSync(join(delivery, item.path)) })));
assert.equal(verify05OZipBuffer(zip, zipFiles).status, "passed");
const tamperedZip = Buffer.from(zip); tamperedZip[100] ^= 0xff; assert.throws(() => verify05OZipBuffer(tamperedZip, zipFiles), /ZIP_/);
assert.throws(() => verify05OZipBuffer(zip, zipFiles.slice(1)), /ZIP_ENTRY_SET_INVALID/);
const wrongZipSha = structuredClone(zipFiles); wrongZipSha[0].sha256 = "0".repeat(64); assert.throws(() => verify05OZipBuffer(zip, wrongZipSha), /ZIP_ENTRY_BYTES_OR_SHA_INVALID/);
const staleTarget = join(testRoot, "stale-delivery"); mkdirSync(staleTarget); assert.throws(() => create05OReviewPackage({ statePath: join(testRoot, "missing-ledger.json"), targetRoot: staleTarget, zipPath: join(testRoot, "stale.zip") }), /DELIVERY_TARGET_ALREADY_EXISTS/);

const interruptionRoot = join(testRoot, "checkpoint"); const interruptionState = join(interruptionRoot, "live-ledger.json"); let creates = 0;
const firstInterrupted = await run05OPageLive("P1", { apiKey: "offline-test-key", statePath: interruptionState, checkpointDir: join(interruptionRoot, "checkpoints"), operations: { credits: async () => 100, createTask: async () => { creates += 1; return "offline-task-id"; }, pollTask: async () => { throw new Error("SIMULATED_POLL_INTERRUPTION"); } } });
assert.equal(firstInterrupted.providerStatus, "interrupted_recoverable"); assert.equal(firstInterrupted.failureStage, "polling"); assert.equal(creates, 1);
const resumedInterrupted = await run05OPageLive("P1", { apiKey: "offline-test-key", statePath: interruptionState, checkpointDir: join(interruptionRoot, "checkpoints"), operations: { credits: async () => { throw new Error("RESUME_MUST_NOT_QUERY_PRE_CREDIT"); }, createTask: async () => { throw new Error("RESUME_MUST_NOT_CREATE_TASK"); }, pollTask: async () => { throw new Error("SIMULATED_SECOND_POLL_INTERRUPTION"); } } });
assert.equal(resumedInterrupted.providerStatus, "interrupted_recoverable"); assert.equal(resumedInterrupted.resumeCount, 1); assert.equal(creates, 1);
const checkpointState = JSON.parse(readFileSync(interruptionState, "utf8")); assert.equal(checkpointState.attemptedProviderRequests, 1); assert.equal(checkpointState.records[0].providerRequestAttemptCount, 1);

assert.equal(treeHash(outputDir), officialEvidenceBefore, "self-test must not change any official evidence byte");
console.log("xhs-publish-complete-self-test: PASS (source authority, full prompt allowlist, isolated overlays, P6 cleanup, hard Manifest/ZIP gates, official evidence unchanged)");
