import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { featureFlags } from "../../feature-flags.mjs";
import { stableHash } from "../../image-providers/xhs-integrated-page/canonical.mjs";
import { normalizePngCandidate, solidRgbaPng } from "../../image-providers/xhs-integrated-page/png-normalizer.mjs";
import { validatePageCandidate, validatePageNormalizationRecord } from "../../image-providers/xhs-integrated-page/vertical-contracts.mjs";
import {
  createIntegratedVisualPageSpec, createPageCandidate, evaluateIntegratedVisual,
  evaluatePageFacts, evaluatePageText, normalizePageCandidate, assertCandidateSelectable,
  projectXhsPostPackageReadOnly, runOfflinePagePipeline
} from "../../content-agent/xhs-integrated-page-offline-pipeline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, "../fixtures/xhs-integrated-page-offline-vertical/cases.json"), "utf8"));
const originalFetch = globalThis.fetch; let networkCalls = 0; globalThis.fetch = async () => { networkCalls += 1; throw new Error("NETWORK_FORBIDDEN"); };
const flags = { xhsIntegratedPageOfflinePipeline: true, xhsIntegratedPageOcrGate: true };
const hash = (label) => stableHash({ label });

try {
  const defaults = featureFlags();
  for (const name of ["xhsIntegratedPageOfflinePipeline", "xhsIntegratedPageOcrGate", "xhsIntegratedPageVersioning", "xhsIntegratedPageOfflineReview", "xhsIntegratedPageOfflineDelivery"]) assert.equal(defaults[name], false, `${name} must default false`);
  const oldPackage = { schemaVersion: "2.0", id: fixture.contentTaskId, contentTaskId: fixture.contentTaskId, contentVersion: fixture.contentVersion, pages: fixture.pages.map((page) => ({ ...page, supportingText: ["固定中文真值"] })) };
  const oldHash = stableHash(oldPackage); const projection = projectXhsPostPackageReadOnly(oldPackage); assert.equal(stableHash(oldPackage), oldHash); assert.equal(projection.truths.length, 3);
  const results = [];
  for (let index = 0; index < projection.truths.length; index += 1) {
    const truth = projection.truths[index]; const item = fixture.pages[index]; const sourceBuffer = solidRgbaPng(item.native.width, item.native.height, [220 - index * 20, 230, 210, 255]);
    const spec = createIntegratedVisualPageSpec({ truth, id: `spec:${truth.pageId}`, compositionGoal: item.pageRole, informationHierarchy: ["headline", "body", "cta"], brandDnaRef: { id: "brand:fixture", hash: hash("brand") }, generationMode: "integrated_page_generation" });
    const observation = { headline: truth.headline, numbers: truth.numbers, productNames: truth.productNames, properNouns: [...truth.properNouns, ...truth.protectedTerms], cta: truth.cta, extraText: [], pseudoText: false, confidence: 0.99 };
    const result = runOfflinePagePipeline({ flags, id: `candidate:${truth.pageId}`, spec, truth, compilerTrace: { id: "trace:fixture", traceHash: hash("trace") }, capabilityEvaluation: { evaluationId: "capability:fixture", evaluationHash: hash("capability") }, sourceBuffer, sourceRelativePath: `source/${truth.pageId}.png`, normalization: { mode: item.mode, outputRelativePath: `assets/${truth.pageId}.png`, protectedRegions: [], backgroundStrategy: item.mode === "fit_pad" ? "solid_brand_neutral_light" : null, createdAt: fixture.createdAt }, textObservation: observation, observedFactIds: truth.factIds, extraClaims: [], visualAssertion: { hierarchyStatus: "passed", semanticStatus: "passed", brandingStatus: "passed", watermarkLogoStatus: "passed", crossPageStatus: "passed", observations: [] }, createdAt: fixture.createdAt });
    assert.equal(result.candidate.providerNativeDimensionStatus, "failed"); assert.equal(result.normalization.status, "succeeded"); assert.deepEqual(result.normalization.outputDimensions, { width: 1080, height: 1440 }); assert.equal(result.candidate.finalCanvasStatus, "passed"); assert.equal(result.candidate.textStatus, "passed"); assert.equal(result.candidate.factStatus, "passed"); assert.equal(result.candidate.visualStatus, "passed"); assert.deepEqual(result.counters, { networkCalls: 0, providerCalls: 0, costCredits: 0, activeDatabaseWrites: 0, approvedPromotions: 0 });
    results.push({ truth, spec, sourceBuffer, observation, result });
  }
  assert.equal(results[0].candidate?.providerStatus, undefined);

  const base = results[0];
  for (const negative of fixture.negativeTextCases) {
    const candidate = createPageCandidate({ id: `negative:${negative.id}`, spec: base.spec, compilerTrace: { id: "trace:fixture", traceHash: hash("trace") }, capabilityEvaluation: { evaluationId: "capability:fixture", evaluationHash: hash("capability") }, sourceBuffer: base.sourceBuffer, sourceRelativePath: `source/${negative.id}.png` });
    const normalized = normalizePageCandidate({ candidate, sourceBuffer: base.sourceBuffer, mode: "resample", outputRelativePath: `assets/${negative.id}.png`, protectedRegions: [], createdAt: fixture.createdAt });
    const checked = evaluatePageText({ candidate: normalized.candidate, truth: base.truth, observation: { ...base.observation, ...negative.change }, createdAt: fixture.createdAt }); assert.equal(checked.check.status, negative.expected, negative.id);
  }
  const candidate = createPageCandidate({ id: "independent", spec: base.spec, compilerTrace: { id: "trace:fixture", traceHash: hash("trace") }, capabilityEvaluation: { evaluationId: "capability:fixture", evaluationHash: hash("capability") }, sourceBuffer: base.sourceBuffer, sourceRelativePath: "source/independent.png", providerStatus: "succeeded" });
  assert.equal(candidate.textStatus, "pending"); assert.equal(candidate.factStatus, "pending"); assert.equal(candidate.visualStatus, "pending"); assert.equal(candidate.selectionStatus, "not_selected");
  const facts = evaluatePageFacts({ candidate, truth: base.truth, observedFactIds: [], extraClaims: ["新增事实"], createdAt: fixture.createdAt }); assert.equal(facts.check.status, "failed"); assert.equal(facts.candidate.textStatus, "pending");
  assert.throws(() => assertCandidateSelectable(facts.candidate), (error) => error.code === "PAGE_CANDIDATE_NOT_SELECTABLE" && error.blockers.some((item) => item.code === "FACT_GATE_BLOCKED"));
  const visual = evaluateIntegratedVisual({ candidate, assertion: { hierarchyStatus: "failed", semanticStatus: "failed", brandingStatus: "failed", watermarkLogoStatus: "failed", crossPageStatus: "failed", observations: ["fixed offline negative replay"] }, createdAt: fixture.createdAt }); assert.equal(visual.review.overallStatus, "failed"); assert.equal(visual.candidate.textStatus, "pending"); assert.equal(visual.candidate.factStatus, "pending"); assert.deepEqual(visual.review.blockers.map((item) => item.code).sort(), ["VISUAL_BRANDING_FAILED", "VISUAL_CROSSPAGE_FAILED", "VISUAL_HIERARCHY_FAILED", "VISUAL_SEMANTIC_FAILED", "VISUAL_WATERMARKLOGO_FAILED"]);

  const unsafeSource = solidRgbaPng(1200, 1440); const unsafeCandidate = createPageCandidate({ id: "unsafe-crop", spec: base.spec, compilerTrace: { id: "trace:fixture", traceHash: hash("trace") }, capabilityEvaluation: { evaluationId: "capability:fixture", evaluationHash: hash("capability") }, sourceBuffer: unsafeSource, sourceRelativePath: "source/unsafe.png" });
  const unsafe = normalizePageCandidate({ candidate: unsafeCandidate, sourceBuffer: unsafeSource, mode: "fit_crop", outputRelativePath: "assets/unsafe.png", protectedRegions: [{ x: 0, y: 20, width: 100, height: 100 }], createdAt: fixture.createdAt }); assert.equal(unsafe.record.status, "blocked"); assert(unsafe.record.blockers.some((item) => item.code === "PROTECTED_REGION_CROP"));
  const replacement = solidRgbaPng(1086, 1448, [1, 2, 3, 255]); const changed = normalizePageCandidate({ candidate: base.result.candidate, sourceBuffer: replacement, mode: "resample", outputRelativePath: "assets/replaced.png", declaredSourceSha256: base.result.normalization.inputAsset.sha256, createdAt: fixture.createdAt }); assert.equal(changed.record.status, "blocked"); assert(changed.record.blockers.some((item) => item.code === "SOURCE_ASSET_HASH_MISMATCH"));
  const geometryRef = { id: "candidate:odd", hash: hash("candidate:odd") };
  const oddCrop = normalizePngCandidate({ id: "normalization:odd-crop", candidateRef: geometryRef, sourceBuffer: solidRgbaPng(901, 1201), sourceRelativePath: "source/odd-crop.png", outputRelativePath: "assets/odd-crop.png", mode: "fit_crop", protectedRegions: [], createdAt: fixture.createdAt }); assert.equal(oddCrop.record.status, "succeeded"); assert.equal(oddCrop.record.crop.width * 4, oddCrop.record.crop.height * 3); assert.equal(oddCrop.record.scale.uniform, true); assert(Math.abs(oddCrop.record.scale.x - oddCrop.record.scale.y) < 1e-12);
  const oddPad = normalizePngCandidate({ id: "normalization:odd-pad", candidateRef: geometryRef, sourceBuffer: solidRgbaPng(881, 1169), sourceRelativePath: "source/odd-pad.png", outputRelativePath: "assets/odd-pad.png", mode: "fit_pad", protectedRegions: [], backgroundStrategy: "solid_brand_neutral_light", createdAt: fixture.createdAt }); assert.equal(oddPad.record.status, "succeeded"); assert.deepEqual(oddPad.record.scale, { x: 1, y: 1, uniform: true });
  const oddResample = normalizePngCandidate({ id: "normalization:odd-resample", candidateRef: geometryRef, sourceBuffer: solidRgbaPng(1083, 1444), sourceRelativePath: "source/odd-resample.png", outputRelativePath: "assets/odd-resample.png", mode: "resample", protectedRegions: [], createdAt: fixture.createdAt }); assert.equal(oddResample.record.status, "succeeded"); assert.equal(oddResample.record.scale.uniform, true);
  const oddResampleBlocked = normalizePngCandidate({ id: "normalization:odd-resample-blocked", candidateRef: geometryRef, sourceBuffer: solidRgbaPng(1083, 1445), sourceRelativePath: "source/odd-resample-blocked.png", outputRelativePath: "assets/odd-resample-blocked.png", mode: "resample", protectedRegions: [], createdAt: fixture.createdAt }); assert.equal(oddResampleBlocked.record.status, "blocked"); assert.equal(oddResampleBlocked.record.scale.uniform, false); assert(oddResampleBlocked.record.blockers.some((item) => item.code === "RESAMPLE_ASPECT_RATIO_MISMATCH"));
  const oddNonUniform = normalizePngCandidate({ id: "normalization:odd-blocked", candidateRef: geometryRef, sourceBuffer: solidRgbaPng(1081, 1441), sourceRelativePath: "source/odd-blocked.png", outputRelativePath: "assets/odd-blocked.png", mode: "fit_pad", protectedRegions: [], backgroundStrategy: "solid_brand_neutral_light", createdAt: fixture.createdAt }); assert.equal(oddNonUniform.record.status, "blocked"); assert.equal(oddNonUniform.record.scale.uniform, false); assert(oddNonUniform.record.blockers.some((item) => item.code === "NON_UNIFORM_PIXEL_GEOMETRY")); const liedGeometry = structuredClone(oddNonUniform.record); liedGeometry.scale.uniform = true; assert.throws(() => validatePageNormalizationRecord(liedGeometry), /UNIFORM_FLAG_MISMATCH/);
  const tamperedRecord = structuredClone(base.result.normalization); tamperedRecord.outputDimensions.width = 1079; assert.throws(() => validatePageNormalizationRecord(tamperedRecord));
  const tamperedCandidate = structuredClone(base.result.candidate); tamperedCandidate.textStatus = "failed"; assert.throws(() => validatePageCandidate(tamperedCandidate));
  assert.throws(() => runOfflinePagePipeline({}), /FLAGS_DISABLED/);
  assert.equal(networkCalls, 0);
  console.log("xhs-integrated-page-offline-vertical-self-test: PASS (3 sizes, OCR/fact/visual negatives, hashes, 0 calls)");
} finally { globalThis.fetch = originalFetch; }
